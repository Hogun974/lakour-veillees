// La peste noire dans l'API du système (game.lakourLoups) et ce que voit chacun : nouvelle partie de peste (choisie, ou tirée
// au sort avec la chance du réglage caché), distribution sans meute, drapeau et composition jamais publics (réglage monde,
// hooks, socket), l'étape « la peste » (choix du narrateur, du porteur MORT par une demande posthume, hasard au délai), la mort
// annoncée comme une proie de la meute, le carnet du porteur, le cri (juste : victoire du village, Chroniques ; faux : le crieur
// pendu ; par le socket : seulement pour soi), le bandeau (bouton du cri le jour). Sur la doublure de Foundry.
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, reglages, envoyerAuMJ, calme, messages, journalHooks, FR } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const P = FR.LAKOUR_LOUPS.Peste;

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, bandeau, local] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"),
    m("logique/index.mjs"), m("scripts/apps/bandeau.mjs"), m("scripts/plateau-local.mjs")]);
  return { api: api.api, socket, reglages: reglagesM, L, bandeau, local };
}

// Un monde : n joueurs simulés à la main (aucun ne répond seul), des rôles du monde dont un loup.
function monde(M, { joueurs = 6, contenu = false, chancePeste = 0 } = {}) {
  installerFoundry({ joueurs, contenu, chancePeste });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.local.remettreAZero();
  delete globalThis.canvas;
  return {
    loup: creerObjetMonde("Loup de Brumecombe", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    garde: creerObjetMonde("Garde du pont", "role", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }),
    villageois: creerObjetMonde("Villageois", "role", { cle: "villageois" }),
    forgeron: creerObjetMonde("Forgeron", "metier", { cle: "forgeron" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
// Rien de la peste ni de la composition ne sort avant la fin : réglage monde, hooks diffusés, autres messages du socket.
function rienDePublic(depuis = 0) {
  const pub = publicBrut();
  assert.ok(!("peste" in pub) || pub.phase === "fin", "peste dans l'état public");
  assert.equal(pub.composition, "", "composition dans l'état public");
  for (const e of emissions.slice(depuis)) {
    const texte = JSON.stringify(e);
    if (e.type === "hook") {
      assert.equal(e.recipients, null);
      if (["lakourLoups.victoire", "lakourLoups.cri"].includes(e.nom)) continue;
      assert.doesNotMatch(texte, /"peste"|peste noire/i, `${e.nom} : ${texte}`);
      for (const a of e.args ?? []) if (a && typeof a === "object" && "composition" in a) assert.equal(a.composition, "", `${e.nom} : composition diffusée`);
    } else assert.equal(e.recipients?.length, 1, `${e.type} sans destinataire unique`);
  }
}

// Une partie de peste distribuée à la main : u1…u6, le loup retiré d'office.
async function pesteDistribuee(M, U) {
  await M.api.distribuer({ roles: [U.loup, U.garde, U.villageois, U.villageois, U.villageois, U.villageois], metiers: [U.forgeron],
    joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "peste", composition: "essai", batiments: [], peste: true });
  await M.api.changerPhase("nuit");
}

const VERIFICATIONS = {
  async "distribution de peste : aucun loup, drapeau et composition secrets, carte de rôle sans meute"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    assert.ok(villageois().every(a => secretDuMJ.camp(roleDe(a)) !== "meute" && secretDuMJ.camp(a) !== "meute"), "le loup est retiré");
    assert.equal(villageois().filter(a => roleDe(a).system.cle === "villageois").length, 5);
    assert.equal(M.api.etat().peste.active, true);
    assert.equal(M.api.etat().composition, "essai", "le MJ garde la composition");
    rienDePublic();
    // Une partie ordinaire : rien non plus (les deux se ressemblent).
    const V = monde(M);
    await M.api.distribuer({ roles: [V.loup, V.villageois], joueurs: ["u1", "u2", "u3", "u4"], graine: "x", composition: "essai", batiments: [] });
    assert.equal(M.api.etat().peste, null);
    rienDePublic();
  },

  async "nouvelle partie : peste choisie, tirée au sort (chance du réglage), jamais pour des rôles choisis ; hook public sans composition"(M) {
    monde(M, { contenu: true, chancePeste: 0 });
    await M.api.distribuer({ roles: [], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "a", batiments: [] });
    let r = await M.api.nouvellePartie({ graine: "sans" });
    assert.equal(r.composition.peste, false);
    assert.ok(villageois().some(a => secretDuMJ.camp(a) === "meute"));
    const n = emissions.length;
    r = await M.api.nouvellePartie({ peste: true, graine: "choisie" });
    assert.equal(r.composition.peste, true);
    assert.ok(villageois().every(a => secretDuMJ.camp(a) !== "meute"), "peste choisie : aucun loup");
    assert.match(r.composition.libelle, /PESTE NOIRE/, "le MJ le voit");
    const h = emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.nouvellePartie");
    assert.deepEqual(Object.keys(h.args[0]).sort(), ["compagnons", "joueurs", "partie"], "aucune composition annoncée");
    rienDePublic(n);
    // Le tirage : chance 1 -> peste ; des rôles choisis ne la tirent jamais ; peste: false l'interdit.
    await game.settings.set("lakour-loups", "chancePeste", 1);
    assert.equal((await M.api.nouvellePartie({ graine: "tiree" })).composition.peste, true);
    assert.equal((await M.api.nouvellePartie({ roles: ["loup-de-brumecombe", "herboriste"] })).composition.peste, false);
    assert.ok(villageois().some(a => roleDe(a).system.cle === "loup-de-brumecombe"));
    assert.equal((await M.api.nouvellePartie({ peste: false })).composition.peste, false);
    // Reproductible : même graine, même tirage.
    await game.settings.set("lakour-loups", "chancePeste", 0.5);
    const tirages = [];
    for (const g of ["g1", "g2", "g3", "g1", "g2", "g3"]) tirages.push((await M.api.nouvellePartie({ graine: g })).composition.peste);
    assert.deepEqual(tirages.slice(0, 3), tirages.slice(3));
    assert.equal(M.api.chancePeste(), 0.5);
  },

  async "la peste, première nuit : la victime du narrateur, ou le hasard ; personne n'est réveillé"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    const ordre = M.api.ordreDeNuit();
    assert.deepEqual(ordre.map(e => e.roleCle), ["garde-du-pont", "peste"]);
    const x = villageois()[3];
    const n = emissions.length;
    const r = await M.api.reveiller("peste", { cible: x.id, delai: 50 });
    assert.deepEqual([r.cibles, r.hasard], [[x.id], false]);
    assert.equal(emissions.slice(n).filter(e => e.type === "demande").length, 0);
    assert.deepEqual(M.api.etat().nuit.actions.at(-1), { ...M.api.etat().nuit.actions.at(-1), acteurId: "", roleCle: "peste", cibles: [x.id] });
    // Sans choix : le hasard, noté au MJ.
    M.api.etat();
    const r2 = await M.api.reveiller("peste", { delai: 50 });
    assert.equal(r2.hasard, true);
    assert.equal(r2.cibles.length, 1);
    assert.ok(M.api.etat().journalSecret.some(j => j.texte.startsWith("La peste frappe au hasard")));
    rienDePublic();
  },

  async "l'aube : la victime meurt comme une proie de la meute ; elle devient le porteur et l'apprend en secret"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    const x = villageois().find(a => roleDe(a).system.cle === "villageois");
    await M.api.reveiller("peste", { cible: x.id });
    const n = emissions.length, c = messages.length;
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.deces, [{ acteurId: x.id, cause: "peste" }]);
    assert.equal(x.system.vivant, false);
    assert.equal(M.api.etat().peste.porteur, x.id);
    assert.equal(publicBrut().morts[0].cause, "nuit", "cause publique");
    const mort = messages.slice(c).find(m => m.content.includes(x.name));
    assert.ok(mort.content.includes(FR.LAKOUR_LOUPS.Causes.nuit), "même annonce qu'une victime de la meute");
    const elim = emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.elimination");
    assert.equal(elim.args[0].cause, "nuit");
    const carnet = emissions.slice(n).find(e => e.type === "secret" && e.entree.acteurId === x.id);
    assert.deepEqual(carnet?.recipients, [x.system.joueur], "le porteur l'apprend, lui seul");
    assert.ok(carnet.entree.texte.includes("peste noire"));
    rienDePublic(n);
  },

  async "nuits suivantes : le porteur MORT choisit par une demande secrète (posthume) ; sans réponse, le hasard"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    const x = villageois().find(a => roleDe(a).system.cle === "villageois");
    await M.api.reveiller("peste", { cible: x.id });
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("nuit");
    assert.deepEqual(M.api.ordreDeNuit().find(e => e.roleCle === "peste").acteurIds, [x.id], "le porteur est réveillé, mort");
    const y = villageois().find(a => a.system.vivant && roleDe(a).system.cle === "villageois");
    let n = emissions.length;
    const attente = M.api.reveiller("peste", { cible: y.id, delai: 5000 });
    await calme();
    const d = emissions.slice(n).find(e => e.type === "demande");
    assert.ok(d?.posthume, "une demande au porteur");
    assert.deepEqual(d.recipients, [x.system.joueur]);
    assert.equal(d.invite, P.InvitePorteur);
    assert.ok(d.candidats.every(c => game.actors.get(c.id).system.vivant), "seulement des vivants");
    const z = villageois().find(a => a.system.vivant && a.id !== y.id && roleDe(a).system.cle === "villageois");
    // Un autre joueur ne peut pas répondre à sa place ; lui, mort, oui.
    envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: [y.id], userId: "u6" }, { emetteur: "u6" });
    envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: [z.id], userId: x.system.joueur }, { emetteur: x.system.joueur });
    const r = await attente;
    assert.deepEqual([r.cibles, r.hasard], [[z.id], false], "le choix du porteur (la cible du narrateur est ignorée)");
    // Sans réponse au délai : le hasard.
    n = emissions.length;
    const r2 = await M.api.reveiller("peste", { delai: 30 });
    assert.equal(r2.hasard, true);
    assert.ok(emissions.slice(n).some(e => e.type === "annuler"), "la fenêtre du porteur se ferme");
    rienDePublic();
  },

  async "le cri juste : la partie s'arrête, le village gagne, récit et Chroniques « Peste noire »"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    await M.api.changerPhase("jour");
    const crieur = villageois()[1];
    const n = emissions.length;
    commeJoueur(crieur.system.joueur);
    assert.equal(M.api.peutCrier(crieur.id).ok, true, "le joueur sait qu'il peut crier");
    commeMJ();
    envoyerAuMJ(CANAL, { type: "peste", acteurId: crieur.id, userId: crieur.system.joueur }, { emetteur: crieur.system.joueur });
    await calme();
    const e = M.api.etat();
    assert.deepEqual([e.vainqueur, e.phase, e.peste.decouverte], ["village", "fin", true]);
    assert.equal(crieur.system.vivant, true);
    const chat = messages.map(m => m.content).join("\n");
    assert.ok(chat.includes(FR.LAKOUR_LOUPS.Victoire.villagePeste));
    assert.ok(chat.includes(P.Recit), "le récit dévoile la peste");
    const journal = game.journal.find(j => j.getFlag("lakour-loups", "chroniques"));
    assert.ok(journal.pages.some(p => p.name.includes(P.Chronique)), "les Chroniques");
    assert.equal(publicBrut().peste.active, true, "dévoilé à la fin");
    const victoire = emissions.slice(n).find(x => x.type === "hook" && x.nom === "lakourLoups.victoire");
    assert.equal(victoire.args[1].peste.active, true);
  },

  async "le cri faux : le crieur pendu pour avoir semé la panique ; on ne crie que pour soi, le jour, vivant"(M) {
    const U = monde(M);
    await M.api.distribuer({ roles: [U.loup, U.garde, U.villageois, U.villageois, U.villageois, U.villageois], metiers: [U.forgeron],
      joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "ordinaire", composition: "essai", batiments: [] });
    await M.api.changerPhase("jour");
    const crieur = villageois().find(a => secretDuMJ.camp(a) !== "meute");
    const autre = villageois().find(a => a.id !== crieur.id && a.system.joueur);
    // Un joueur ne crie pas pour un autre.
    envoyerAuMJ(CANAL, { type: "peste", acteurId: crieur.id, userId: autre.system.joueur }, { emetteur: autre.system.joueur });
    await calme();
    assert.equal(crieur.system.vivant, true, "cri au nom d'un autre refusé");
    const r = await M.api.crierPeste(crieur.id);
    assert.deepEqual([r.juste, crieur.system.vivant], [false, false]);
    assert.equal(publicBrut().morts.find(m => m.acteurId === crieur.id).cause, "panique");
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Causes.panique)));
    await assert.rejects(() => M.api.crierPeste(crieur.id), e => e.message === P.Refus.mort);
    await M.api.changerPhase("nuit");
    await assert.rejects(() => M.api.crierPeste(autre.id), e => e.message === P.Refus.phase);
    assert.equal(M.api.etat().vainqueur, "");
  },

  async "la peste l'emporte quand il ne reste qu'un vivant"(M) {
    const U = monde(M, { joueurs: 4 });
    await M.api.distribuer({ roles: [U.villageois, U.villageois, U.villageois, U.villageois], joueurs: ["u1", "u2", "u3", "u4"], graine: "fin", batiments: [], peste: true });
    const [a, b, c] = villageois();
    await M.api.eliminer(a.id, { cause: "vote" });
    await M.api.eliminer(b.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "", "deux vivants, sans loup : la partie continue");
    await M.api.eliminer(c.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "peste");
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Victoire.peste)));
  },

  async "le bandeau : le bouton du cri pour un vivant, le jour ; pas la nuit, pas pour un mort"(M) {
    const U = monde(M);
    await pesteDistribuee(M, U);
    const moi = villageois()[2];
    commeJoueur(moi.system.joueur);
    assert.ok(!M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauPeste"), "pas la nuit");
    commeMJ();
    await M.api.changerPhase("jour");
    commeJoueur(moi.system.joueur);
    assert.ok(M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauPeste"), "le jour");
    commeMJ();
    await M.api.eliminer(moi.id, { cause: "vote" });
    commeJoueur(moi.system.joueur);
    assert.ok(!M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauPeste"), "pas pour un mort");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "      if (peste) e.peste = L.pesteInitiale();\n", "", "drapeau posé à la distribution"],
  ["scripts/api.mjs", "const sansLoup = peste && cache.get(att.role)?.system?.camp === \"meute\";", "const sansLoup = false;", "loups retirés d'une peste"],
  ["scripts/api.mjs", "[{ partie, joueurs: resume.joueurs.length, compagnons: resume.compagnons.length }]",
    "[{ partie, joueurs: resume.joueurs.length, compagnons: resume.compagnons.length, composition: { cle: compo.cle, libelle: compo.libelle } }]", "composition annoncée"],
  ["scripts/api.mjs", "L.tirerPeste({ graine, chance: api.chancePeste() })", "false", "tirage de la peste"],
  ["scripts/api.mjs", "const enPeste = !court && (peste === true || ", "const enPeste = !court && (", "peste choisie par le MJ"],
  ["scripts/api.mjs", " && !p.demande.posthume", "", "réponse du porteur mort"],
  ["scripts/api.mjs", "      if (porteur) cibles = await demanderAuPorteur(", "      if (false) cibles = await demanderAuPorteur(", "le porteur choisit"],
  ["scripts/api.mjs", "      else if (candidats.includes(cible)) cibles = [cible];\n", "", "le narrateur choisit"],
  ["scripts/api.mjs", "        cibles = [L.choisir(candidats)];", "        cibles = [];", "le hasard au délai"],
  ["scripts/api.mjs", "let x = L.suivrePeste(L.cloreNuit(e, { asperges: r.asperges, fioles: r.fioles, bilan: r.bilan, pontFranchi: r.pontFranchi && cles.includes(\"pont\") }), r.deces);",
    "let x = L.cloreNuit(e, { asperges: r.asperges, fioles: r.fioles, bilan: r.bilan, pontFranchi: r.pontFranchi && cles.includes(\"pont\") });", "le porteur suit la victime"],
  ["scripts/api.mjs", "      await envoyerSecret(porteur, { texte: t(\"LAKOUR_LOUPS.Peste.CarnetPorteur\") });\n", "", "carnet du porteur"],
  ["scripts/api.mjs", "morts: e.morts, primes: e.primes, peste: e.peste, saintMartin, strict: pariteStricte(e) });", "morts: e.morts, primes: e.primes, saintMartin, strict: pariteStricte(e) });", "victoire de la peste"],
  ["scripts/api.mjs", "    if (r.mort) await api.eliminer(r.mort, { cause: \"panique\" });\n", "", "crieur pendu"],
  ["scripts/api.mjs", "if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;\n  try {\n    await api.crierPeste",
    "if (!acteur || !user) return false;\n  try {\n    await api.crierPeste", "on ne crie que pour soi"],
  ["scripts/api.mjs", ", ...(L.estPeste(etat) ? { peste: true } : {}) })", " })", "Chroniques « Peste noire »"],
  ["scripts/api.mjs", "  const peste = L.estPeste(etat) ? `<p><strong>${t(\"LAKOUR_LOUPS.Peste.Recit\")}</strong></p>` : \"\";", "  const peste = \"\";", "récit de fin"],
  ["scripts/api.mjs", "    if (roleCle === CLE_PESTE) return reveillerLaPeste(entree, { delai: ms, cible });\n", "", "l'étape de la peste"],
  ["scripts/donnees.mjs", "  if (v === \"village\" && etat?.peste?.active) return t(\"LAKOUR_LOUPS.Victoire.villagePeste\");\n", "", "victoire du cri annoncée"],
  ["scripts/socket.mjs", "    case \"peste\": return estMJActif() && recevoirCri(pourMoi);\n", "", "cri par le socket"],
  ["scripts/apps/bandeau.mjs", "    if (cri?.ok) bouton(\"bandeauPeste\"", "    if (false) bouton(\"bandeauPeste\"", "bouton du cri"],
  ["logique/etat.mjs", "  delete pub.peste;\n", "", "drapeau public"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-peste-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { commeMJ(); }
  }
  return liste;
}

test("peste (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("peste (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

// Le journal des hooks reste utilisé par d'autres essais : rien à faire ici.
void journalHooks;

test("peste noire : ni Meunière ni Moulin (ils compteraient « 0 loup ») ; métiers remplacés, autant que de joueurs", async () => {
  const L = await import("../systems/lakour-loups/logique/index.mjs");
  const m = (uuid, cle) => ({ uuid, cle });
  const liste = [m("f", "forgeron"), m("mu", "meuniere"), m("c", "cure"), m("mu", "meuniere")];
  const sortie = L.metiersSansIndice(liste);
  assert.equal(sortie.length, 4, "un métier par place");
  assert.ok(!sortie.includes("mu"), "plus de Meunière");
  assert.deepEqual(L.metiersSansIndice([m("f", "forgeron"), m("c", "cure")]), ["f", "c"], "sans Meunière : inchangé");
  assert.deepEqual(L.HORS_PESTE.batiments, ["moulin"]);
});
