// Relecture 7 : ce que les fiches, les révélations, la migration et le relais de la parole ne doivent jamais perdre ni trahir.
// - « Rejouer » (une nouvelle partie distribuée sur les mêmes villageois, sans remise à zéro) : chaque joueur reçoit SA fiche de la
//   nouvelle partie, même identique à la précédente (son navigateur a vidé les siennes au changement de partie).
// - Révélé de son vivant : le document montre le camp du RÔLE, jamais le camp actuel ; une morsure (camp changé) n'écrit rien au
//   document ; un rôle déjà publié n'est pas remplacé (un rôle donné ou échangé ensuite reste secret) ; à sa mort (réglage
//   « revelerALaMort »), le vrai rôle et le vrai camp.
// - Migration d'une partie d'avant 0.9.0 : les fiches sont rangées et scellées AVANT qu'un document ne soit touché ; interrompue,
//   elle se rejoue sans perte.
// - Canal des morts : avec « mortsVoientTout », ceux qui gardent leur Dernier souffle et ceux qui l'ont rendu ne se lisent pas.
// - Jets de dés privés pendant une partie : « pour soi » affiché chez son auteur seul, sans document ; « MJ seul » et « aveugle »
//   relayés au MJ avec formule et résultat (un jet aveugle n'est pas montré à son auteur).
// Chaque vérification est rejouée sur des copies mutées du système.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, messages, reglages, calme, apiCoffreMoteur } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";
const JOUEURS = n => Array.from({ length: n }, (_, i) => `u${i + 1}`);

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, reglagesM, socket, secrets, coffre, prive, parole] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"),
    m("scripts/socket.mjs"), m("scripts/secrets.mjs"), m("scripts/coffre.mjs"), m("scripts/prive.mjs"), m("scripts/parole.mjs")]);
  return { api: api.api, reglages: reglagesM, socket, secrets, coffre, prive, parole };
}

// Un monde neuf ; la mémoire des modules (secrets, coffre, carnet) repart de zéro, comme une page neuve.
function monde(M, joueurs = 5) {
  installerFoundry({ joueurs });
  M.secrets.oublierSecrets();
  M.coffre.oublierCoffre();
  M.prive.oublierPrive();
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
}
const role = (nom, system) => creerObjetMonde(nom, "role", system);
const ROLES = {
  loup: () => role("Loup", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
  louve: () => role("Louve mère", { cle: "louve-mere", camp: "meute", effet: "mordre", usages: { max: 1, restant: 1 }, nuit: { actif: true, ordre: 41 } }),
  juge: () => role("Juge de paix", { cle: "juge-de-paix", effet: "annuler-vote" }),
  conteuse: () => role("Conteuse", { cle: "conteuse" }),
  villageois: () => role("Villageois", { cle: "villageois" })
};
const villageois = () => game.actors.filter(a => a.type === "villageois");
const avecRole = (M, cle) => villageois().find(a => M.api.roleDe(a)?.system.cle === cle);
const roleAuDocument = a => a.items.filter(i => i.type === "role").map(i => i.name).join(",");
const valeur = cle => structuredClone(reglages.get(`${ID}.${cle}`).valeur);

// Livre à un joueur (son navigateur : ce module, game.user = lui) ce qui lui était adressé depuis l'indice n.
function livrerA(M, userId, depuis) {
  const avant = game.user;
  game.user = game.users.get(userId);
  try {
    for (const e of emissions.slice(depuis)) {
      if (e.canal !== `system.${ID}` || !e.recipients?.includes(userId) || !["fiche", "vus", "secret", "carnet"].includes(e.type)) continue;
      const { canal: _c, recipients: _r, ...m } = e;
      M.socket.traiterMessage(structuredClone(m), "mj");
    }
  } finally { game.user = avant; }
}

// Une partie à 5 : Loup, Louve mère, Juge de paix, deux villageois.
async function partieDuJuge(M, graine) {
  monde(M, 5);
  await M.api.distribuer({ roles: [ROLES.loup(), ROLES.louve(), ROLES.juge(), ROLES.villageois(), ROLES.villageois()], joueurs: JOUEURS(5), graine,
    composition: "c", batiments: [] });
  return { juge: avecRole(M, "juge-de-paix"), loup: avecRole(M, "loup-de-brumecombe"), louve: avecRole(M, "louve-mere") };
}
// La nuit où la meute attaque le Juge et où la Louve mère le mord : il rejoint la meute en secret.
async function mordre(M, { juge, loup, louve }) {
  await M.api.changerPhase("nuit");
  await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [juge.id], effet: "tuer" });
  await M.api.noterAction({ acteurId: louve.id, roleCle: "louve-mere", cibles: [juge.id], effet: "mordre" });
  await M.api.changerPhase("aube");
  await M.api.resoudreNuit();
  await M.api.changerPhase("jour");
}

const VERIFICATIONS = {
  async "Rejouer : chaque joueur reçoit sa fiche de la nouvelle partie, même identique à la précédente"(M) {
    monde(M, 4);
    const roles = [ROLES.loup(), ROLES.conteuse(), ROLES.villageois(), ROLES.villageois()];
    const distribuer = () => M.api.distribuer({ roles, joueurs: JOUEURS(4), graine: "meme", composition: "c", batiments: [] });
    await distribuer();
    const p1 = M.api.etat().partie;
    const n = emissions.length;
    await distribuer();   // « Rejouer » : nouvellePartie -> distribuer, sans remise à zéro
    const p2 = M.api.etat().partie;
    assert.notEqual(p2, p1);
    const fiches = emissions.slice(n).filter(e => e.type === "fiche" && e.partie === p2).map(e => e.recipients[0]).sort();
    assert.deepEqual(fiches, JOUEURS(4), "une fiche à chaque joueur pour la nouvelle partie");
    // Chez la Conteuse : son navigateur change de partie (vidé), puis lit ce qui lui est adressé : son rôle est là.
    const conteuse = avecRole(M, "conteuse");
    game.user = game.users.get(conteuse.system.joueur);
    try {
      M.prive.chargerPrive(p2);
      livrerA(M, conteuse.system.joueur, n);
      assert.equal(M.api.roleDe(conteuse)?.system.cle, "conteuse", "son rôle, chez elle");
    } finally { game.user = game.users.get("mj"); }
  },

  async "révélé puis mordu : le document garde le camp de son rôle ; à sa mort, le vrai camp"(M) {
    const q = await partieDuJuge(M, "p5");
    await M.api.reveler(q.juge.id);
    assert.equal(roleAuDocument(q.juge), "Juge de paix");
    assert.equal(q.juge.system.camp, "village", "le camp du rôle révélé");
    await mordre(M, q);
    assert.equal(q.juge.system.vivant, true);
    assert.equal(M.api.campDe(q.juge), "meute", "chez le MJ : mordu");
    assert.equal(q.juge.system.camp, "village", "la morsure reste secrète");
    assert.equal(roleAuDocument(q.juge), "Juge de paix");
    await M.api.eliminer(q.juge.id, { cause: "vote" });
    assert.equal(q.juge.system.camp, "meute", "à sa mort (révélée), son vrai camp");
  },

  async "mordu puis révélé : le document dit le camp du rôle, pas la morsure"(M) {
    const q = await partieDuJuge(M, "p5b");
    await mordre(M, q);
    assert.equal(M.api.campDe(q.juge), "meute");
    await M.api.reveler(q.juge.id);
    assert.equal(roleAuDocument(q.juge), "Juge de paix");
    assert.equal(q.juge.system.revele, true);
    assert.equal(q.juge.system.camp, "village", "le camp de son rôle, jamais le camp actuel");
  },

  async "révélé : un rôle échangé ou donné ensuite reste secret ; le rôle publié ne change pas"(M) {
    const q = await partieDuJuge(M, "p5c");
    await M.api.reveler(q.juge.id);
    await M.api.echangerRoles(q.juge.id, q.loup.id);   // le Colporteur, ou le MJ
    assert.equal(M.api.roleDe(q.juge)?.system.cle, "loup-de-brumecombe", "chez le MJ : le rôle reçu");
    assert.equal(roleAuDocument(q.juge), "Juge de paix", "le document garde le rôle publié");
    assert.equal(q.juge.system.camp, "village");
    await M.api.donnerRole(q.juge.id, ROLES.louve());
    assert.equal(M.api.roleDe(q.juge)?.system.cle, "louve-mere");
    assert.equal(roleAuDocument(q.juge), "Juge de paix", "un rôle donné à un révélé ne se lit pas sur son document");
    assert.equal(q.juge.system.camp, "village");
  },

  async "migration interrompue : les fiches sont rangées et scellées d'abord ; rejouée, rien n'est perdu"(M) {
    monde(M, 5);
    await M.api.distribuer({ roles: [ROLES.loup(), ROLES.juge(), ROLES.villageois(), ROLES.villageois(), ROLES.villageois()], joueurs: JOUEURS(5),
      graine: "p6", composition: "c", batiments: [] });
    await M.api.changerPhase("nuit");
    const attendus = Object.fromEntries(villageois().map(a => [a.id, `${M.api.roleDe(a).name}/${M.api.campDe(a)}`]));
    // Le monde tel qu'en 0.8.0 : rôles et camps sur les documents, joueurs propriétaires ; des secrets sans fiches.
    for (const a of villageois()) {
      const r = M.api.roleDe(a);
      await a.createEmbeddedDocuments("Item", [{ name: r.name, type: "role", system: structuredClone(r.system) }]);
      await a.update({ "system.camp": M.api.campDe(a), [`ownership.${a.system.joueur}`]: 3 });
    }
    const s = structuredClone(M.secrets.secretsMJ());
    delete s.fiches;
    M.secrets.oublierSecrets();
    await M.secrets.garderSecrets(s);
    await M.coffre.sceller();   // le coffre d'avant : sans fiches
    await M.coffre.rangement();
    const fichesAuCoffre = async () => {
      const { partie: _p, rev: _r, ...scelle } = valeur("coffre");
      return Object.keys((await apiCoffreMoteur().ouvrirScelle(scelle))?.fiches ?? {}).length;
    };
    assert.equal(await fichesAuCoffre(), 0);
    // Interrompue à la première écriture du 3e document (page fermée, réseau, erreur du serveur).
    const A3 = villageois()[2];
    const vraiUpdate = A3.update.bind(A3);
    let auMoment = null;
    A3.update = async () => {
      await M.coffre.rangement();
      auMoment = { fiches: Object.keys(M.secrets.secretsMJ().fiches ?? {}).length, coffre: await fichesAuCoffre() };
      throw new Error("connexion perdue");
    };
    await assert.rejects(() => M.api.migrer(), /connexion perdue/);
    A3.update = vraiUpdate;
    assert.deepEqual(auMoment, { fiches: 5, coffre: 5 }, "avant le premier document touché : rangées et scellées");
    await M.api.migrer();   // le « ready » suivant
    await calme();
    const apres = Object.fromEntries(villageois().map(a => [a.id, `${M.api.roleDe(a)?.name ?? "PERDU"}/${M.api.campDe(a)}`]));
    assert.deepEqual(apres, attendus, "aucun rôle perdu");
    assert.ok(villageois().every(a => !roleAuDocument(a) && !a.system.camp), "les documents sont vidés");
  },

  async "canal des morts : souffle gardé et souffle rendu ne se lisent pas"(M) {
    monde(M, 5);
    await M.api.distribuer({ roles: [ROLES.loup(), ROLES.villageois(), ROLES.villageois(), ROLES.villageois(), ROLES.villageois()], joueurs: JOUEURS(5),
      graine: "p7", composition: "c", batiments: [] });
    const [A, B] = villageois().filter(a => M.api.campDe(a) !== "meute");
    await M.api.eliminer(A.id, { cause: "vote" });
    await M.api.eliminer(B.id, { cause: "vote" });
    // Le Dernier souffle en jeu : A l'a rendu (il voit tout), B le garde (il votera encore).
    const pub = game.settings.get(ID, "partie");
    await game.settings.set(ID, "partie", { ...pub, souffle: { actif: true, utilises: [A.id] } });
    const relais = (auteur) => {
      const n = emissions.length;
      assert.equal(M.parole.relayer({ texte: "Le loup, c'est lui !", canal: "morts", userId: auteur.system.joueur }), true, "relayé (le MJ, qui relaie, le lit)");
      return emissions.slice(n).filter(e => e.type === "parole").flatMap(e => e.recipients);
    };
    const deA = relais(A), deB = relais(B);
    assert.ok(!deA.includes(B.system.joueur), "celui qui voit tout n'écrit pas à celui qui vote encore");
    assert.ok(!deB.includes(A.system.joueur), "ni l'inverse");
    // Sans « mortsVoientTout », un seul canal des morts.
    await game.settings.set(ID, "mortsVoientTout", false);
    assert.ok(relais(A).includes(B.system.joueur));
  },

  async "jets de dés privés : « pour soi » chez l'auteur seul ; « MJ seul » et « aveugle » relayés avec formule et résultat"(M) {
    monde(M, 4);
    await M.api.distribuer({ roles: [ROLES.loup(), ROLES.villageois(), ROLES.villageois(), ROLES.villageois()], joueurs: JOUEURS(4),
      graine: "p8", composition: "c", batiments: [] });
    const affiches = [];
    globalThis.ui.chat = { postOne: m => affiches.push({ chez: game.user.id, contenu: String(m.content ?? ""), jets: (m.rolls ?? []).map(r => `${r.formula}=${r.total}`) }) };
    const creer = globalThis.ChatMessage.implementation.create;
    globalThis.ChatMessage.implementation = Object.assign(class { constructor(d) { Object.assign(this, d); } }, { create: creer });
    const jet = (whisper, blind = false) => ({ whisper, blind, flavor: "Crocheter la serrure", content: "17", rolls: [{ formula: "1d20+2", total: 17 }] });
    const nbMessages = messages.length;
    game.user = game.users.get("u1");
    try {
      let n = emissions.length;
      assert.equal(M.parole.avantMessage(jet(["u1"]), {}, {}, "u1"), false, "aucun document");
      assert.deepEqual(affiches.at(-1), { chez: "u1", contenu: "17", jets: ["1d20+2=17"] }, "affiché chez lui");
      assert.equal(emissions.length, n, "rien n'est envoyé");
      n = emissions.length;
      assert.equal(M.parole.avantMessage(jet(["mj"]), {}, {}, "u1"), false);
      const auMJ = emissions.slice(n).filter(e => e.type === "paroleEnvoi");
      assert.equal(auMJ.length, 1);
      assert.match(auMJ[0].texte, /Crocheter la serrure : 1d20\+2 → 17/, "formule et résultat au MJ");
      n = emissions.length;
      assert.equal(M.parole.avantMessage(jet(["mj"], true), {}, {}, "u1"), false);
      assert.match(emissions.slice(n).find(e => e.type === "paroleEnvoi").texte, /1d20\+2 → 17/);
      assert.ok(!/17/.test(affiches.at(-1).contenu.replace(/<[^>]+>/g, "")), "un jet aveugle n'est pas montré à son auteur");
    } finally { game.user = game.users.get("mj"); }
    assert.equal(messages.length, nbMessages, "aucun message de chat créé");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    const fichesAvant = secret.partie === partieAvant ? copieAvant : {};", "    const fichesAvant = copieAvant;", "fiches renvoyées à une nouvelle partie"],
  ["scripts/api.mjs", "  const camp = toutDire ? f?.camp : campPublie || a.system.camp || publie?.system?.camp || objet?.system.camp;", "  const camp = f?.camp;", "de son vivant, le camp du rôle"],
  ["scripts/api.mjs", "    if (!deja.length || (toutDire && !(deja.length === 1 && deja[0].system?.cle === objet.system.cle))) {", "    if (!(deja.length === 1 && deja[0].system?.cle === objet.system.cle)) {", "rôle publié jamais remplacé de son vivant"],
  ["scripts/api.mjs", "    // Un villageois qui rejoint la meute (morsure) reçoit ses Masques de veillée.\n", "    if (a.system.revele) await a.update({ \"system.camp\": camp });\n", "camp changé jamais écrit au document"],
  ["scripts/api.mjs", "    if (montrer) await revelerPubliquement(acteurId, { marquer: false, mort: true });", "    if (montrer) await revelerPubliquement(acteurId, { marquer: false });", "à la mort, le vrai camp"],
  ["scripts/api.mjs", "    if (Object.keys(fiches).length) {\n      const avec", "    if (false) {\n      const avec", "migration : fiches rangées d'abord"],
  ["scripts/api.mjs", "      }, { sansSecrets: true });\n      await sceller();\n", "      }, { sansSecrets: true });\n", "migration : fiches scellées d'abord"],
  ["scripts/api.mjs", "        e.fiches = { ...fiches, ...(e.fiches ?? {}) };", "        e.fiches = { ...fiches };", "migration rejouée sans perte"],
  ["logique/parole.mjs", "  const memeCanal = id => !mortsVoientTout || souffles.includes(id) === Boolean(moi?.souffle);", "  const memeCanal = () => true;", "souffle : deux canaux des morts"],
  ["scripts/parole.mjs", "    souffles: joueursDe(a => !a.system.vivant && !partis.has(a.id) && souffle(a)),", "    souffles: [],", "qui garde son souffle"],
  ["scripts/parole.mjs", "souffle: !moi.system.vivant && souffle(moi) }", "souffle: false }", "l'auteur garde son souffle"],
  ["logique/parole.mjs", "  if (moiId && chuchote.length && chuchote.every(id => id === moiId)) return { ok: false, local: true };\n", "", "jet pour soi affiché localement"],
  ["scripts/parole.mjs", "    const texte = resume || L.texteDuRelais(", "    const texte = L.texteDuRelais(", "formule et résultat relayés"],
  ["scripts/parole.mjs", "{ aveugle: Boolean(resume && (message.blind ?? donnees?.blind)) }", "{ aveugle: false }", "jet aveugle caché à son auteur"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-publication-mutant-"));
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
    game.user = game.users.get("mj");
    M.coffre.oublierCoffre();
  }
  return liste;
}

test("publication et parole : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("publication et parole : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
