// Le Pacte, étape 2 : nos rôles alignés sur le jeu de soirée, dans l'API du système (game.lakourLoups), sur la doublure de
// Foundry. La Liseuse lit le rôle (le mot « meute » reste quand il en est) ; l'Herboriste apprend la vraie proie (pas un infecté,
// l'Enfant de la brume surprise à la place) et verse deux fioles la même nuit, ses usages comptés juste ; l'Enfant qui épie : la
// surprise tirée quand son choix est noté ; le Garde du pont : la cible d'hier n'est pas proposée ; le Loup affamé : ni la proie
// de la meute ni un loup ; le Sonneur sonne de jour ; le Loup déguisé perd son masque au vote ; la voix du Bailli tranche une
// égalité d'office. Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, envoyerAuMJ, calme, messages, FR } from "./doublures/foundry-loups.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, socket, reglages: reglagesM, L, racine };
}

async function monde(M) {
  installerFoundry({ joueurs: 7, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 1);
  await game.settings.set("lakour-loups", "masques", false);
  await game.settings.set("lakour-loups", "bailli", false);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    deguise: role("Loup déguisé", { cle: "loup-deguise", camp: "meute", effet: "tuer", apparence: "village", nuit: { actif: true, ordre: 40 } }),
    louve: role("Louve mère", { cle: "louve-mere", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41 }, usages: { max: 1, restant: 1 } }),
    affame: role("Loup affamé", { cle: "loup-affame", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 42, tantQueMeuteEntiere: true } }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-role", nuit: { actif: true, ordre: 60 } }),
    herboriste: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 },
      nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true, invite: "Désigne la victime pour la sauver, quelqu'un d'autre pour l'empoisonner." } }),
    enfant: role("Enfant de la brume", { cle: "enfant-de-la-brume", effet: "epier", nuit: { actif: true, ordre: 39, soiMeme: true } }),
    garde: role("Garde du pont", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20, soiMeme: true } }),
    sonneur: role("Sonneur", { cle: "sonneur", effet: "vote-double", usages: { max: 1, restant: 1 } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const de = c => villageois().find(a => cle(a) === c);
const tous = c => villageois().filter(a => cle(a) === c);
async function partie(M, roles) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine: "pacte", composition: "essai", batiments: [] });
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandeDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id).at(-1);
const repondre = (demande, cibles) => envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: cibles.map(a => a.id), userId: demande.destinataire },
  { emetteur: demande.destinataire });
const carnets = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret");
const carnetDe = (acteur, depuis = 0) => carnets(depuis).filter(e => e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "");
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ")).join("\n");
const usages = a => roleDe(a)?.system.usages.restant;
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
// Réveille un rôle (comme la Table de jeu), attend sa demande et y répond.
async function reveiller(M, roleCle, acteur, cibles) {
  const n = emissions.length;
  const fin = M.api.reveiller(roleCle, { delai: 60000 });
  await attendre(() => demandeDe(acteur, n), `la demande de ${roleCle}`);
  const d = demandeDe(acteur, n);
  repondre(d, cibles(d));
  await fin;
  return d;
}

const VERIFICATIONS = {
  async "Liseuse : le rôle, le mot « Meute » quand il en est ; le Loup déguisé en Villageois"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.deguise, U.liseuse, U.villageois, U.villageois, U.villageois]);
    const liseuse = de("liseuse-de-cendres");
    const lire = async cible => {
      await M.api.changerPhase("nuit");
      await M.api.noterAction({ acteurId: liseuse.id, roleCle: "liseuse-de-cendres", cibles: [cible.id] });
      await M.api.changerPhase("aube");
      const n = emissions.length;
      await M.api.resoudreNuit({ chuchoter: true });
      await M.api.changerPhase("jour");
      return carnetDe(liseuse, n).find(t => /Les cendres parlent/.test(t));
    };
    const loup = de("loup-de-brumecombe");
    assert.equal(await lire(loup), `Les cendres parlent : ${loup.name} est « Loup de Brumecombe », du camp « Meute ».`);
    const deguise = de("loup-deguise");
    assert.equal(await lire(deguise), `Les cendres parlent : ${deguise.name} est « Villageois », du camp « Village ».`);
  },

  async "Herboriste : elle apprend la proie, pas l'infecté ; l'Enfant surprise à la place ; deux fioles, usages justes"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.louve, U.herboriste, U.enfant, U.villageois, U.villageois, U.villageois]);
    const [loup, louve, herbo, enfant] = ["loup-de-brumecombe", "louve-mere", "herboriste", "enfant-de-la-brume"].map(de);
    const [x, y, z] = tous("villageois");
    // Nuit 1 : la Louve infecte la proie ; l'Herboriste n'a aucun nom à apprendre.
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [x.id] });
    await M.api.noterAction({ acteurId: louve.id, roleCle: "louve-mere", cibles: [x.id] });
    assert.deepEqual(M.api.proiesDeLaNuit(), { proies: [x.id], mordus: [x.id], aSauver: [] });
    const d1 = await reveiller(M, "herboriste", herbo, () => []);
    assert.ok(!d1.invite.includes(x.name), "l'infecté n'est pas nommé");
    assert.equal(d1.nombre, 2, "deux fioles possibles");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    assert.equal(secretDuMJ.camp(x), "meute", "infecté, pas mort");
    assert.ok(x.system.vivant);
    // Nuit 2 : l'Enfant épie, surprise (le risque à 1) ; l'Herboriste apprend son nom, la sauve et empoisonne y.
    await M.api.changerPhase("jour");
    await game.settings.set("lakour-loups", "chanceEpier", 1);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: enfant.id, roleCle: "enfant-de-la-brume", cibles: [enfant.id] });
    assert.equal(M.api.etat().nuit.actions.at(-1).surprise, true, "la surprise est tirée quand le choix est noté");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [z.id] });
    const d2 = await reveiller(M, "herboriste", herbo, () => [enfant, y]);
    assert.ok(d2.invite.includes(enfant.name) && !d2.invite.includes(z.name), "la vraie proie : l'Enfant");
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [y.id], "l'Enfant sauvée, y empoisonné, z épargné");
    assert.equal(usages(herbo), 0, "les deux fioles sont vides");
    assert.ok(!M.api.ordreDeNuit().some(e => e.roleCle === "herboriste"));
  },

  async "Herboriste : une fiole déjà vide rend son usage, une seule fois"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.herboriste, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, herbo] = ["loup-de-brumecombe", "herboriste"].map(de);
    const [x, y, z] = tous("villageois");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: herbo.id, roleCle: "herboriste", cibles: [x.id] });
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    assert.equal(usages(herbo), 1, "le poison versé");
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [y.id] });
    await M.api.noterAction({ acteurId: herbo.id, roleCle: "herboriste", cibles: [y.id, z.id] });
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [], "y sauvé ; le poison, déjà vide, ne tue pas z");
    assert.equal(usages(herbo), 0, "plus rien : le remède vient d'être versé");
  },

  async "Enfant de la brume : pas surprise, elle apprend le nom des loups"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, U.enfant, U.villageois, U.villageois, U.villageois]);
    const enfant = de("enfant-de-la-brume");
    await game.settings.set("lakour-loups", "chanceEpier", 0);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: enfant.id, roleCle: "enfant-de-la-brume", cibles: [enfant.id] });
    assert.equal(M.api.etat().nuit.actions.at(-1).surprise, false);
    const x = tous("villageois")[0];
    await M.api.noterAction({ acteurId: tous("loup-de-brumecombe")[0].id, roleCle: "meute", cibles: [x.id] });
    await M.api.changerPhase("aube");
    const n = emissions.length;
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [x.id]);
    const vu = carnetDe(enfant, n).find(t => /vous voyez passer la meute/.test(t));
    for (const l of tous("loup-de-brumecombe")) assert.ok(vu.includes(l.name), `${l.name} nommé`);
  },

  async "Garde du pont : la cible d'hier n'est pas proposée ; Loup affamé : ni la proie de la meute ni un loup"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.affame, U.garde, U.villageois, U.villageois, U.villageois]);
    const [loup, affame, garde] = ["loup-de-brumecombe", "loup-affame", "garde-du-pont"].map(de);
    const [x, y] = tous("villageois");
    await M.api.changerPhase("nuit");
    const d1 = await reveiller(M, "garde-du-pont", garde, () => [x]);
    assert.ok(d1.candidats.some(c => c.id === x.id));
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [y.id] });
    const da = await reveiller(M, "loup-affame", affame, () => []);
    assert.ok(!da.candidats.some(c => c.id === y.id || c.id === loup.id || c.id === affame.id), "ni la proie, ni un loup");
    assert.ok(da.candidats.some(c => c.id === x.id));
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    const d2 = await reveiller(M, "garde-du-pont", garde, () => []);
    assert.ok(!d2.candidats.some(c => c.id === x.id), "pas deux nuits de suite");
    assert.ok(d2.candidats.some(c => c.id === garde.id), "lui-même, oui");
  },

  async "Sonneur : de jour, la cloche rend le vote double (au débat, ou le vote ouvert)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.sonneur, U.villageois, U.villageois, U.villageois, U.villageois]);
    const sonneur = de("sonneur");
    await M.api.changerPhase("jour");
    const p = M.api.pouvoirsDeJour(sonneur.id).find(x => x.pouvoir === "sonneur");
    assert.ok(p?.possible, "un pouvoir de jour du Sonneur");
    const n = messages.length;
    await M.api.agirDeJour({ acteurId: sonneur.id, pouvoir: "sonneur" });
    assert.match(chat(n), /tire la corde/);
    assert.equal(sonneur.system.revele, true, "il se révèle");
    const v = await M.api.ouvrirVote({ duree: 0 });
    assert.equal(v.double, true, "le prochain vote désigne deux condamnés");
    assert.equal(usages(sonneur), 0);
    await assert.rejects(() => M.api.agirDeJour({ acteurId: sonneur.id, pouvoir: "sonneur" }));
  },

  async "Loup déguisé : le plus désigné d'un vote sans être exécuté perd son masque (en secret)"(M) {
    const U = await monde(M);
    await partie(M, [U.deguise, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const deguise = de("loup-deguise");
    const [a, b, c, d] = tous("villageois");
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[a, deguise], [b, c], [c, deguise], [d, c]]);
    const n = emissions.length;
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [], "égalité : personne");
    assert.equal(roleDe(deguise).system.apparence, "", "le masque est tombé");
    assert.ok(carnetDe(deguise, n).some(t => t === FR.LAKOUR_LOUPS.Deguise.Carnet), "il l'apprend");
    assert.ok(M.api.etat().journalSecret.some(x => x.texte.includes(deguise.name) && /son masque tombe/.test(x.texte)), "le narrateur le sait");
    assert.equal(roleDe(c).system.apparence, "", "rien chez un villageois");
  },

  async "Bailli : sa voix tranche l'égalité d'office, sans rien lui demander"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [bailli, x, y, w] = tous("villageois");
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[bailli, x], [w, y], [y, y]]);
    const n = emissions.length, m = messages.length;
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [x.id], "sa voix (double) allait à x : x");
    assert.deepEqual(r.departage.auto, [x.id]);
    assert.ok(!demandeDe(bailli, n), "aucune demande au Bailli");
    assert.match(chat(m), /avait voté pour/);
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "const aSauver = proies.filter(id => !mordus.includes(id));", "const aSauver = proies;", "Herboriste : l'infecté n'est pas une victime"],
  ["logique/resolution.mjs", "if (enfant && villageois.some(v => v.vivant !== false && v.camp === \"meute\")) proies.push(enfant);", "if (false) proies.push(enfant);", "Herboriste : l'Enfant surprise"],
  ["scripts/api.mjs", "const surprise = epie ? Math.random() < Number(reglage(\"chanceEpier\") ?? L.RISQUE_ENFANT) : undefined;", "const surprise = undefined;", "Enfant : surprise tirée au choix"],
  ["scripts/api.mjs", "const fois = role?.system.effet === \"remede\" ? Math.max(1, Math.min(2, cibles.length)) : 1;", "const fois = 1;", "Herboriste : un usage par fiole"],
  ["scripts/api.mjs", "restant: Math.max(0, u.max - versees)", "restant: u.restant + 1", "Herboriste : usages rendus justes"],
  ["logique/jour.mjs", "if (hier) ids = ids.filter(id => id !== hier);", "", "Garde : la cible d'hier retirée"],
  ["logique/jour.mjs", "ids = ids.filter(id => !proies.has(id));", "", "Loup affamé : une autre victime"],
  ["logique/jour.mjs", "  sonneur: { source: \"role\", cibles: 0, phases: JOURNEE, revele: true },\n", "", "Sonneur : un pouvoir de jour"],
  ["scripts/api.mjs", "    for (const id of L.masquesQuiTombent({ resultat, villageois: villageoisAPlat() })) await tomberLeMasque(id);\n", "", "Loup déguisé : le masque tombe au vote"],
  ["scripts/api.mjs", "  if (tombe) await envoyerSecret(acteurId, { texte: t(\"LAKOUR_LOUPS.Deguise.Carnet\") });\n", "", "Loup déguisé : il l'apprend"],
  ["logique/etat.mjs", "if (sienne && resultat.departage.candidats.includes(sienne)) {", "if (false) {", "Bailli : sa voix tranche"],
  ["scripts/api.mjs", "const auto = d?.auto?.length ?", "const auto = false ?", "Bailli : annoncé au village"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { game.user = game.users.get("mj"); await calme().catch(() => {}); await M.attendreGestes().catch(() => {}); }
  }
  return liste;
}

test("Pacte, étape 2 (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 2 (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
