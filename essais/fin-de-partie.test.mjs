// La partie finie, plus rien ne se passe (vu en vraie partie : « La meute l'emporte », le récit de fin, puis « Le Bailli … nomme …
// Crieuse publique ») : ni nomination du Crieur public (le Bailli, compagnon IA, qui répond après la victoire ; la mort du Crieur qui
// finit la partie), ni annonce du Crieur au matin, ni succession du Bailli ou de l'Exécuteur ; les fenêtres encore ouvertes se
// ferment chez leur joueur, un compagnon IA n'est plus attendu, et aucune demande ne part plus. Chaque vérification est rejouée sur
// des copies mutées du système (une garde retirée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, envoyerAuMJ, calme, messages } from "./doublures/foundry-loups.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, attendreVacances: api.attendreVacances, attendreGazette: api.attendreGazette,
    attendreSuccession: api.attendreSuccession, socket, reglages: reglagesM, L, racine };
}

async function monde(M) {
  installerFoundry({ joueurs: 10, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  for (const [cle, v] of [["delaiChoix", 1], ["masques", false], ["bailli", true], ["dernierSouffle", false], ["revelerALaMort", true]]) await game.settings.set("lakour-loups", cle, v);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const cle = a => secretDuMJ.role(a)?.system.cle;
const tous = c => villageois().filter(a => cle(a) === c);
const n = (U, k) => Array.from({ length: k }, () => U.villageois);
const pub = () => game.settings.get("lakour-loups", "partie");
const CRIEUR = { crieur: true, cartesDuCrieur: ["lune-noire", "enfouissement"] };
async function partie(M, roles, { compagnons = [], graine = "fin" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length - compagnons.length), compagnons, graine, composition: "essai",
    batiments: [], gazette: CRIEUR });
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandesA = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id);
const demandeDe = (acteur, depuis = 0) => demandesA(acteur, depuis).at(-1);
const repondre = (d, ids) => envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: ids, texte: "", userId: d.destinataire }, { emetteur: d.destinataire });
async function repondreA(acteur, ids, k, message) {
  await attendre(() => demandeDe(acteur, k), message);
  const d = demandeDe(acteur, k);
  repondre(d, typeof ids === "function" ? ids(d) : ids);
  return d;
}
const annulee = (d, depuis = 0) => emissions.slice(depuis).some(e => e.type === "annuler" && e.id === d.id);
// Le chat depuis cet index, sans l'annonce de la victoire ni le récit de fin (ce que la fin elle-même poste).
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content))
  .filter(c => !c.includes("loups-recit") && !/l(’|')emporte/.test(c))
  .map(c => c.replace(/<[^>]+>/g, " ").trim()).filter(Boolean).join("\n");
// Le village l'emporte : le loup éliminé par le narrateur, la victoire déclarée. -> l'index du chat juste avant la victoire (une
// tâche qui reprend pendant que la fin s'annonce poste avant le récit : elle compte aussi)
async function victoireDuVillage(M) {
  for (const l of tous("loup-de-brumecombe")) if (l.system.vivant) await M.api.eliminer(l.id, { cause: "narrateur" });
  const k = messages.length;
  assert.equal(await M.api.verifierVictoire(), "village");
  assert.equal(pub().vainqueur, "village");
  return k;
}
// Tout ce qui court encore (Gazette, succession du Bailli, derniers gestes, Prévôt) : jusqu'au bout.
async function toutAttendre(M) {
  for (let i = 0; i < 3; i++) {
    await calme();
    await M.attendreGazette();
    await M.attendreSuccession();
    await M.attendreGestes();
    await M.attendreVacances();
  }
}
// Une partie avec un compagnon IA qui ne soit pas le loup (le village l'emporte en éliminant le loup).
async function partieAvecCompagnon(M, U) {
  for (let i = 0; i < 20; i++) {
    await partie(M, [U.loup, ...n(U, 6)], { compagnons: ["Ysaline"], graine: `fin-${i}` });
    const ia = villageois().find(a => a.system.compagnon);
    if (ia && cle(ia) !== "loup-de-brumecombe") return ia;
  }
  assert.fail("aucune graine ne laisse le compagnon hors de la meute");
}

const VERIFICATIONS = {
  async "le Bailli compagnon IA qui répond après la victoire ne nomme pas de Crieur public (ni le sort à sa place) ; rien au chat"(M) {
    const U = await monde(M);
    let rendre = null;
    const vues = [];
    M.api.resolveurs.compagnon = d => {
      vues.push(d);
      return d.objet === "crieur-nommer" ? new Promise(r => { rendre = r; }) : [];
    };
    const ia = await partieAvecCompagnon(M, U);
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(ia.id);
    await attendre(() => rendre, "le Bailli compagnon doit nommer le Crieur");
    const d = vues.find(v => v.objet === "crieur-nommer");
    const k = await victoireDuVillage(M);
    rendre([d.candidats[0].id]);   // il répond, trop tard
    await toutAttendre(M);
    assert.equal(pub().gazette.crieur.acteurId, "", "pas de Crieur nommé après la fin");
    assert.equal(chat(k), "", "rien au chat après le récit de fin");
    assert.ok(!M.api.registre().some(x => x.type === "gazette" && x.quoi === "crieur"), "rien au Registre");
    assert.ok(!emissions.some(e => e.type === "secret" && /cartes de votre charge/i.test(e.entree?.texte ?? "")), "aucune main de Crieur envoyée");
  },

  async "la mort qui finit la partie n'appelle ni Crieur public ni successeur de l'Exécuteur"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, ...n(U, 4)]);
    const [b, c, x] = tous("villageois");
    await M.api.changerPhase("jour");
    const k0 = emissions.length;
    await M.api.nommerBailli(b.id);
    await repondreA(b, [c.id], k0, "le Bailli nomme le Crieur");
    await M.attendreGazette();
    assert.equal(pub().gazette.crieur.acteurId, c.id);
    // Le Crieur est aussi l'Exécuteur (la carte posée) ; un villageois tombe, la partie continue (2 loups contre 3).
    await game.settings.set("lakour-loups", "partie", { ...pub(), gazette: { ...pub().gazette, executeur: { ...pub().gazette.executeur, actif: true, acteurId: c.id } } });
    await M.api.eliminer(x.id, { cause: "narrateur" });
    assert.equal(await M.api.verifierVictoire(), "");
    // Le Crieur (et Exécuteur) tombe : 2 loups contre 2, la meute l'emporte. Personne n'est sollicité.
    const k = emissions.length;
    await M.api.eliminer(c.id, { cause: "narrateur" });
    await toutAttendre(M);
    assert.deepEqual([...demandesA(b, k), ...demandesA(c, k)].map(d => d.objet), [], "ni Crieur à nommer, ni successeur à désigner");
    const m = messages.length;
    assert.equal(await M.api.verifierVictoire(), "meute");
    await toutAttendre(M);
    assert.equal(chat(m), "");
  },

  async "le Crieur qui réfléchit à son annonce quand la partie finit : sa fenêtre se ferme, ni carte ni « rien à annoncer »"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 6)]);
    const vs = tous("villageois");
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    let k0 = emissions.length;
    await M.api.nommerBailli(vs[0].id);
    await repondreA(vs[0], [vs[1].id], k0, "le Bailli nomme le Crieur");
    await M.attendreGazette();
    assert.equal(pub().gazette.crieur.acteurId, vs[1].id);
    await M.api.changerPhase("nuit");
    k0 = emissions.length;
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await attendre(() => demandeDe(vs[1], k0)?.objet === "crieur-annonce", "on demande au Crieur s'il a une annonce");
    const d = demandeDe(vs[1], k0);
    const k1 = emissions.length;
    const k = await victoireDuVillage(M);
    await calme();
    assert.ok(annulee(d, k1), "la fenêtre du Crieur se ferme à la victoire");
    repondre(d, ["lune-noire"]);   // trop tard
    await toutAttendre(M);
    assert.equal(chat(k), "", "rien au chat après le récit de fin");
    assert.deepEqual(M.api.gazetteSecrets().main, ["lune-noire", "enfouissement"], "aucune carte lue");
  },

  async "la succession du Bailli encore ouverte à la victoire : ni successeur, ni vacance annoncée"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "delaiChoix", 5);   // le sceau ne se demande qu'avec une seconde au moins devant lui
    await partie(M, [U.loup, ...n(U, 5)]);
    const [b, x] = tous("villageois");
    await M.api.changerPhase("jour");
    const k0 = emissions.length;
    await M.api.nommerBailli(b.id);
    // Le Bailli nomme son Crieur (la demande d'abord), puis tombe : il doit remettre le sceau.
    await repondreA(b, [x.id], k0, "le Bailli nomme le Crieur");
    await M.attendreGazette();
    const k1 = emissions.length;
    await M.api.eliminer(b.id, { cause: "narrateur" });
    await attendre(() => demandeDe(b, k1)?.objet === "succession", "la demande posthume du sceau");
    const d = demandeDe(b, k1);
    const k = await victoireDuVillage(M);
    await calme();
    assert.ok(annulee(d), "la fenêtre posthume se ferme à la victoire");
    repondre(d, [x.id]);   // trop tard
    await toutAttendre(M);
    assert.equal(pub().bailli.acteurId, "", "pas de successeur après la fin");
    assert.equal(chat(k), "", "ni succession ni vacance au chat");
  },

  async "la partie finie, aucune demande ne part plus ; les fenêtres ouvertes se ferment, un compagnon n'est plus attendu"(M) {
    const U = await monde(M);
    const vues = [];
    M.api.resolveurs.compagnon = d => { vues.push(d); return new Promise(() => {}); };   // un compagnon qui réfléchit sans fin
    const ia = await partieAvecCompagnon(M, U);
    const x = tous("villageois").find(a => !a.system.compagnon);
    const candidats = villageois().filter(a => a.system.vivant).map(a => a.id);
    const k0 = emissions.length;
    const p = M.api.demanderAction({ acteurId: x.id, invite: "essai", candidats, delai: 3000, objet: "essai" });
    const q = M.api.demanderAction({ acteurId: ia.id, invite: "essai", candidats, delai: 3000, objet: "essai" });
    await attendre(() => demandeDe(x, k0) && vues.length, "les deux demandes");
    const d = demandeDe(x, k0);
    const k1 = emissions.length;
    const debut = Date.now();
    await victoireDuVillage(M);
    await calme();
    assert.ok(annulee(d, k1), "la fenêtre du joueur se ferme à la victoire");
    assert.deepEqual(await p, []);
    assert.deepEqual(await q, []);
    assert.ok(Date.now() - debut < 2500, "le compagnon n'est plus attendu jusqu'au délai");
    // Après la fin : rien ne part, ni chez un joueur ni chez un compagnon.
    const k2 = emissions.length, v2 = vues.length;
    assert.deepEqual(await M.api.demanderAction({ acteurId: x.id, invite: "essai", candidats, delai: 3000 }), []);
    assert.deepEqual(await M.api.demanderAction({ acteurId: ia.id, invite: "essai", candidats, delai: 3000 }), []);
    assert.equal(await M.api.demanderTexte({ acteurId: x.id, invite: "essai", delai: 3000 }), "");
    assert.equal(await M.api.demanderTexte({ acteurId: ia.id, invite: "essai", delai: 3000 }), "");
    assert.deepEqual([demandesA(x, k2).length, vues.length - v2], [0, 0], "aucune demande après la fin");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    if (maintenant.partie !== avant.partie || L.partieFinie(maintenant) || maintenant.bailli.acteurId !== a.bailli",
    "    if (maintenant.partie !== avant.partie || maintenant.bailli.acteurId !== a.bailli", "Crieur : nommé après la fin"],
  ["scripts/api.mjs", "    if (!a || partieGagnee(avant)) return;", "    if (!a) return;", "Crieur : demandé quand la mort finit la partie"],
  ["scripts/api.mjs", "  // Sa mort finit la partie : personne à désigner (la charge se ferme avec la partie).\n  if (partieGagnee()) return;\n", "",
    "Exécuteur : successeur demandé quand sa mort finit la partie"],
  ["scripts/api.mjs", "  // La partie finie pendant qu'il réfléchissait : rien, pas même « il se tait ».\n  if (L.partieFinie(lireEtat())) return;\n", "",
    "Crieur : « rien à annoncer » après la fin"],
  ["scripts/api.mjs", "    if (e.partie !== avant.partie || L.partieFinie(e) || e.bailli.succession?.de !== s.de)", "    if (e.partie !== avant.partie || e.bailli.succession?.de !== s.de)",
    "Bailli : succession après la fin"],
  ["scripts/api.mjs", "      couperLesDemandes();\n", "", "victoire : les demandes coupées"],
  ["scripts/api.mjs", "    if (!acteur.system.vivant || L.partieFinie(lireEtat())) return Promise.resolve([]);", "    if (!acteur.system.vivant) return Promise.resolve([]);",
    "demanderAction : rien après la fin"],
  ["scripts/api.mjs", "    if (!acteur.system.vivant || L.partieFinie(lireEtat())) return Promise.resolve(\"\");", "    if (!acteur.system.vivant) return Promise.resolve(\"\");",
    "demanderTexte : rien après la fin"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fin-de-partie-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, () => apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally {
      game.user = game.users.get("mj");
      await toutAttendre(M).catch(() => {});
    }
  }
  return liste;
}

test("fin de partie : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("fin de partie : chaque garde retirée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
