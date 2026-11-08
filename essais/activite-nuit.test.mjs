// L'activité que Foundry diffuse à tous (User#broadcastActivity : curseur, ping, règle, cibles, voyant « parle ») est masquée
// la nuit, chez tous ; le jour, chez personne, même pendant un choix secret (relecture adverse : masquer le seul joueur qui choisit
// le désignerait) (logique/activite.mjs, scripts/activite.mjs). Le navigateur d'un joueur est simulé sur
// la doublure (essais/doublures/foundry-loups.mjs), avec un AVMaster qui fait comme celui de Foundry v14
// (client/av/master.mjs, broadcast : {av: {speaking}} à chaque changement) et les salons vocaux (scripts/salons.mjs). La règle
// éprouvée : un villageois et un loup envoient EXACTEMENT les mêmes messages, de la tombée de la nuit au matin, dans les deux
// ordres d'arrivée (phase publique puis ligne des salons, ou l'inverse).
// Aussi : un message de socket sans émetteur est refusé (canal.mjs) ; le carnet nettoie le HTML ; les notes d'un villageois ne
// gardent pas de bloc secret.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installerFoundry } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 4 });
const salons = await import("../systems/lakour-loups/scripts/salons.mjs");
const activite = await import("../systems/lakour-loups/scripts/activite.mjs");
const choix = await import("../systems/lakour-loups/scripts/apps/choix.mjs");
const socket = await import("../systems/lakour-loups/scripts/socket.mjs");
const canal = await import("../systems/lakour-loups/scripts/canal.mjs");
const carnet = await import("../systems/lakour-loups/scripts/apps/carnet.mjs");
const garde = await import("../systems/lakour-loups/scripts/garde.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const L0 = await import("../systems/lakour-loups/logique/index.mjs");
const ID = "lakour-loups";
const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

enregistrerReglages(() => {});
activite.brancherCrochetsActivite();
const repos = () => new Promise(r => setImmediate(r));

// ------------------------------------------------------------------ le navigateur d'un joueur
async function phase(p) {
  const etat = game.settings.get(ID, "partie");
  await game.settings.set(ID, "partie", { ...etat, partie: "essai", phase: p });
  // Chez le joueur, l'état public qui change rafraîchit le plateau local (lakour-loups.mjs : rafraichirPlateauLocal).
  activite.verifierActivite();
}

// Un AVMaster comme celui de Foundry v14 : broadcast(intention) diffuse {av: {speaking}} quand l'état change.
function fauxMaitre(voix) {
  const activity = {};
  return {
    mode: 3, broadcasting: false,
    client: { peers: new Map(), getMediaStreamForUser: () => ({ getTracks: () => [] }), toggleBroadcast() {} },
    settings: { client: { voice: { mode: voix } }, activity, getUser: () => ({ muted: false, hidden: false }) },
    broadcast(intention) {
      this.broadcasting = Boolean(intention);
      this.client.toggleBroadcast(this.broadcasting);
      const a = (activity[game.user.id] ??= {});
      if (a.speaking !== this.broadcasting) game.user.broadcastActivity({ av: { speaking: this.broadcasting } });
      a.speaking = this.broadcasting;
    }
  };
}

const LIGNES = {
  jour: { phase: "jour", salon: "village", peutParler: true, auditeurs: ["mj", "u1", "u2", "u3", "u4"], entend: ["mj", "u1", "u2", "u3", "u4"] },
  nuitVillage: { phase: "nuit", salon: "nuit", peutParler: false, auditeurs: [], entend: ["mj"] },
  nuitLoup: { phase: "nuit", salon: "taniere", peutParler: true, auditeurs: ["mj", "u3"], entend: ["mj", "u3"], loups: ["a2", "a3"] },
  aube: { phase: "aube", salon: "village", peutParler: true, auditeurs: ["mj", "u1", "u2", "u3", "u4"], entend: ["mj", "u1", "u2", "u3", "u4"] }
};
const sans = (ligne, moi) => ({ ...ligne, auditeurs: ligne.auditeurs.filter(x => x !== moi), entend: ligne.entend.filter(x => x !== moi) });

// Prépare le navigateur de userId le jour (voix « always » : Foundry ouvre le micro d'emblée) ; -> son journal d'activité.
async function navigateur(userId, voix) {
  game.user = game.users.get("mj");
  activite.debrancherActivite();
  salons.rendreTout();
  salons.oublierSalons();
  game.user = game.users.get(userId);
  const journal = [];
  Object.setPrototypeOf(game.user, { broadcastActivity(d) { journal.push(structuredClone(d)); } });
  game.webrtc = fauxMaitre(voix);
  await phase("jour");
  assert.equal(activite.brancherActivite(), true);
  salons.recevoirLigne({ partie: "essai", ligne: sans(LIGNES.jour, userId) });
  if (voix === "always") game.webrtc.broadcast(true);
  return journal;
}

// Une nuit, du crépuscule au matin. ordre : "public" (la phase publique d'abord) ou "ligne" (la ligne des salons d'abord).
// -> ce qui est parti du navigateur pendant ce temps.
async function uneNuit(userId, ligneNuit, { voix = "always", ordre = "public" } = {}) {
  const journal = await navigateur(userId, voix);
  game.user.broadcastActivity({ cursor: { x: 10, y: 10 } });
  assert.deepEqual(journal.at(-1), { cursor: { x: 10, y: 10 } }, "le jour, le curseur part");
  const debut = journal.length;
  const ligne = () => salons.recevoirLigne({ partie: "essai", ligne: sans(ligneNuit, userId) });
  if (ordre === "public") { await phase("nuit"); ligne(); } else { ligne(); await phase("nuit"); }
  await repos();
  assert.equal(activite.activiteMasqueeIci(), true);
  // La nuit : la souris, un ping, la règle, une cible, la voix (appuyer pour parler, détection de voix) : rien ne part.
  game.user.broadcastActivity({ cursor: { x: 20, y: 30 } });
  game.user.broadcastActivity({});
  game.user.broadcastActivity({ cursor: { x: 1, y: 2 }, ping: { scene: "s", style: "pulse" } });
  game.user.broadcastActivity({ ruler: { path: [], hidden: false } });
  game.user.broadcastActivity({ targets: ["t1"] });
  game.user.broadcastActivity({ plannedMovements: { t1: null } });
  game.user.broadcastActivity({ av: { muted: true, hidden: false } });
  game.webrtc.broadcast(true);
  game.webrtc.broadcast(false);
  if (voix === "always") game.webrtc.broadcast(true);
  await repos();
  const pendantLaNuit = journal.slice(debut);
  // Le matin.
  const aube = () => salons.recevoirLigne({ partie: "essai", ligne: sans(LIGNES.aube, userId) });
  if (ordre === "public") { await phase("aube"); aube(); } else { aube(); await phase("aube"); }
  await repos();
  assert.equal(activite.activiteMasqueeIci(), false);
  const matin = journal.slice(debut);
  game.user.broadcastActivity({ cursor: { x: 5, y: 5 } });
  assert.deepEqual(journal.at(-1), { cursor: { x: 5, y: 5 } }, "le jour revenu, le curseur repart");
  return { pendantLaNuit, matin };
}

const EFFACEE = { cursor: null, ruler: null, plannedMovements: null, av: { muted: false, hidden: false, speaking: false } };

test("activité la nuit : rien ne part ; villageois et loup envoient les mêmes messages, dans les deux ordres d'arrivée", async () => {
  try {
    for (const voix of ["always", "activity", "ptt"]) {
      for (const ordre of ["public", "ligne"]) {
        const villageois = await uneNuit("u1", LIGNES.nuitVillage, { voix, ordre });
        const loup = await uneNuit("u2", LIGNES.nuitLoup, { voix, ordre });
        const quoi = `${voix}, ${ordre} d'abord`;
        assert.deepEqual(villageois.pendantLaNuit, [EFFACEE], `${quoi} : seul l'effacement part à la tombée de la nuit (villageois)`);
        assert.deepEqual(loup.pendantLaNuit, [EFFACEE], `${quoi} : seul l'effacement part à la tombée de la nuit (loup)`);
        const parle = voix === "always";
        assert.deepEqual(villageois.matin, [EFFACEE, { av: { muted: false, hidden: false, speaking: parle } }], `${quoi} : villageois`);
        assert.deepEqual(loup.matin, villageois.matin, `${quoi} : le loup envoie exactement ce qu'envoie le villageois`);
      }
    }
  } finally {
    game.user = game.users.get("mj");
    activite.debrancherActivite();
    salons.rendreTout();
    delete game.webrtc;
  }
});

test("activité : un choix secret de jour ne la masque pas (il désignerait le joueur) ; le MJ n'est jamais masqué ; tout est rendu", async () => {
  // La doublure d'ApplicationV2 ne ferme rien : on lui donne un _onClose, appelé à la main comme le ferait Foundry.
  const Base = Object.getPrototypeOf(choix.FenetreChoix.prototype);
  Base._onClose = function () {};
  try {
    const journal = await navigateur("u1", "always");
    const debut = journal.length;
    let rendu = null;
    const f = choix.ouvrirChoixLocal({ acteurNom: "Juge", invite: "Qui ?", candidats: [{ id: "a3", nom: "Mathurin" }] }, c => { rendu = c; });
    assert.equal(choix.choixEnCours(), true);
    assert.equal(activite.activiteMasqueeIci(), false, "le jour, un choix secret ne masque rien : il désignerait celui qui choisit");
    game.user.broadcastActivity({ cursor: { x: 3, y: 3 } });
    game.webrtc.broadcast(false);
    await f._onClose({});
    await repos();
    assert.deepEqual(rendu, [], "fermer, c'est passer");
    assert.equal(choix.choixEnCours(), false);
    assert.deepEqual(journal.slice(debut), [{ cursor: { x: 3, y: 3 } }, { av: { speaking: false } }], "son curseur et sa voix partent comme ceux des autres");
    // Le MJ : jamais enveloppé.
    game.user = game.users.get("mj");
    activite.debrancherActivite();
    const mj = game.users.get("mj");
    Object.setPrototypeOf(mj, { broadcastActivity() {} });
    assert.equal(activite.brancherActivite(), false);
    assert.equal(Object.hasOwn(mj, "broadcastActivity"), false);
    await phase("nuit");
    assert.equal(activite.activiteMasqueeIci(), false, "le MJ, la nuit, reste visible");
    // Un joueur rendu tel quel.
    game.user = game.users.get("u1");
    activite.brancherActivite();
    assert.equal(Object.hasOwn(game.user, "broadcastActivity"), true);
    activite.debrancherActivite();
    assert.equal(Object.hasOwn(game.user, "broadcastActivity"), false, "game.user rendu tel quel");
  } finally {
    delete Base._onClose;
    game.user = game.users.get("mj");
    activite.debrancherActivite();
    salons.rendreTout();
    delete game.webrtc;
    await phase("preparation");
  }
});

// ------------------------------------------------------------------ logique pure, et ses mutations
const VERIFICATIONS = {
  "filtrer : retire curseur, ping, règle, cibles, déplacements prévus et voix": L => {
    const tout = { sceneId: "s", levelId: "n", cursor: { x: 1, y: 1 }, ping: {}, ruler: null, targets: [], plannedMovements: null, av: { speaking: true, muted: false } };
    assert.deepEqual(L.filtrerActivite(tout), { sceneId: "s", levelId: "n" });
    assert.ok("cursor" in tout && "av" in tout, "l'activité d'origine n'est pas touchée");
  },
  "filtrer : rien ne reste, rien ne part (null)": L => {
    assert.equal(L.filtrerActivite({}), null);
    assert.equal(L.filtrerActivite({ cursor: { x: 1, y: 1 } }), null);
    assert.equal(L.filtrerActivite({ av: { speaking: false } }), null);
  },
  "masquée : la nuit (phase publique ou ligne), chez tous ; le jour, jamais, même pendant un choix secret ; jamais un MJ": L => {
    assert.equal(L.activiteMasquee({ phases: ["nuit", ""] }), true);
    assert.equal(L.activiteMasquee({ phases: ["jour", "nuit"] }), true, "la ligne de nuit arrivée avant la phase");
    assert.equal(L.activiteMasquee({ phases: ["aube", "aube"] }), false);
    assert.equal(L.activiteMasquee({ phases: ["jour", "jour"], choixSecret: true }), false, "le jour, personne");
    assert.equal(L.activiteMasquee({ phases: ["vote", "aube"], choixSecret: true }), false);
    assert.equal(L.activiteMasquee({ mj: true, phases: ["nuit"], choixSecret: true }), false);
  },
  "effacée : curseur, règle, déplacements, voyant éteint ; l'état A/V gardé": L => {
    assert.deepEqual(L.activiteEffacee({ muted: true, hidden: false }), { cursor: null, ruler: null, plannedMovements: null, av: { muted: true, hidden: false, speaking: false } });
  }
};
function echecs(L) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { verifier(L); } catch (e) { liste.push(`${nom} : ${e.message.split("\n")[0]}`); }
  }
  return liste;
}

test("activité, logique pure : la batterie passe", () => { assert.deepEqual(echecs(L0), []); });

const MUTATIONS = [
  ["export const CLES_ACTIVITE_MASQUEES = [\"cursor\", \"ping\", \"ruler\", \"targets\", \"plannedMovements\", \"av\"];", "export const CLES_ACTIVITE_MASQUEES = [\"cursor\", \"ping\", \"ruler\", \"targets\", \"plannedMovements\"];", "la voix masquée"],
  ["export const CLES_ACTIVITE_MASQUEES = [\"cursor\", \"ping\", \"ruler\", \"targets\", \"plannedMovements\", \"av\"];", "export const CLES_ACTIVITE_MASQUEES = [\"ping\", \"ruler\", \"targets\", \"plannedMovements\", \"av\"];", "le curseur masqué"],
  ["return Object.keys(reste).length ? reste : null;", "return reste;", "un message vide ne part pas"],
  ["return phases.some(p => PHASES_DE_NUIT.includes(p));", "return PHASES_DE_NUIT.includes(phases[0]);", "la ligne de nuit compte"],
  ["export function activiteMasquee({ mj = false, phases = [] } = {}) {", "export function activiteMasquee({ mj = false, phases = [], choixSecret = false } = {}) {\n  if (!mj && choixSecret) return true;", "le jour, un choix secret ne masque personne"],
  ["  if (mj) return false;\n", "", "le MJ jamais masqué"],
  ["av: { ...av, speaking: false }", "av: { ...av }", "le voyant éteint"]
];

async function chargerMutant(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "activite-mutant-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === "activite.mjs") {
      assert.ok(texte.includes(avant), `mutation introuvable : ${avant}`);
      texte = texte.replace(avant, apres);
    }
    writeFileSync(join(dossier, f), texte);
  }
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

for (const [avant, apres, regle] of MUTATIONS) {
  test(`mutation de l'activité « ${regle} » : détectée`, async () => {
    const L = await chargerMutant(avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}

// ------------------------------------------------------------------ F1, F6 : socket, carnet, notes
test("socket : un message sans émetteur donné par le serveur est refusé (Foundry v14 le donne toujours)", () => {
  assert.equal(canal.auteur({ userId: "u1" }), null, "sans émetteur, la déclaration ne suffit pas");
  assert.equal(canal.auteur({ userId: "u1" }, "u2"), null, "déclaration contredite");
  assert.equal(canal.auteur({ userId: "u1" }, "u1"), "u1");
  assert.equal(canal.auteur({}, "u1"), "u1");
  assert.equal(canal.vientDUnMJ({}), false);
  assert.equal(canal.vientDUnMJ({ userId: "mj" }), false, "se dire MJ ne suffit pas");
  assert.equal(canal.vientDUnMJ({}, "mj"), true);
  game.user = game.users.get("u1");
  try {
    assert.equal(socket.traiterMessage({ type: "avis", texte: "faux", userId: "mj" }), false);
    assert.equal(socket.traiterMessage({ type: "hook", nom: "lakourLoups.victoire", args: ["meute"] }), false);
    assert.equal(socket.traiterMessage({ type: "avis", texte: "vrai" }, "mj"), true);
  } finally { game.user = game.users.get("mj"); }
});

test("carnet : le HTML d'une entrée est nettoyé (foundry.utils.cleanHTML), sinon réduit au texte", () => {
  const brut = "<p onclick=\"x()\">Bonjour</p><script>alert(1)</script><img src=x onerror=alert(1)>";
  assert.equal(foundry.utils.cleanHTML, undefined);
  const texte = carnet.nettoyerHTML(brut);
  assert.ok(!/<script|onerror|onclick|<img/i.test(texte), texte);
  assert.match(texte, /Bonjour/);
  const vus = [];
  foundry.utils.cleanHTML = (h, options) => { vus.push([h, options]); return "<p>propre</p>"; };
  try {
    assert.equal(carnet.nettoyerHTML(brut), "<p>propre</p>");
    assert.deepEqual(vus, [[brut, undefined]], "sans auteur : jamais d'iframe à scripts");
  } finally { delete foundry.utils.cleanHTML; }
});

test("notes d'un villageois : un bloc secret n'est pas gardé (Foundry v14 envoie l'acteur entier à tous)", () => {
  const notes = "<p>Public</p><section class=\"secret\" id=\"secret-1\"><p>Loup ?</p><section><p>imbriqué</p></section></section><p>Fin</p>"
    + "<section class=\"note\"><p>gardé</p></section><section class='secret revealed'><p>révélé</p></section>";
  assert.equal(L0.retirerBlocsSecrets(notes), "<p>Public</p><p>Fin</p><section class=\"note\"><p>gardé</p></section>");
  assert.equal(L0.retirerBlocsSecrets("<p>a</p><section class=\"secret\"><p>jamais fermé"), "<p>a</p>");
  assert.equal(L0.contientBlocSecret("<p>rien</p>"), false);
  // À la modification (changements imbriqués ou à plat) et à la création (updateSource).
  const imbriques = { system: { notes } };
  assert.equal(garde.retirerNotesSecretes(imbriques), true);
  assert.ok(!imbriques.system.notes.includes("Loup"));
  const plats = { "system.notes": notes };
  assert.equal(garde.retirerNotesSecretes(plats), true);
  assert.ok(!plats["system.notes"].includes("Loup"));
  assert.equal(garde.retirerNotesSecretes({ system: { vivant: false } }), false);
  const source = [];
  assert.equal(garde.retirerNotesSecretes({ system: { notes } }, { updateSource: d => source.push(d) }), true);
  assert.ok(!source[0]["system.notes"].includes("Loup"));
});
