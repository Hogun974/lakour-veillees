// Le signal « à toi » : un tintement chez le seul joueur attendu (choix secret de la nuit, vote qui s'ouvre), jamais
// diffusé, jamais chez le MJ, coupé par son réglage client ; le titre de l'onglet clignote s'il regarde ailleurs. Le jour, un choix
// secret ne tinte pas (relecture adverse : son micro ouvert le ferait entendre à tous) : le titre seul.
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois) : elle doit alors échouer.
// Lancer : npm run essais
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [socket, reglages, signal] = await Promise.all([m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("scripts/signal.mjs")]);
  return { socket, reglages, signal, entree: readFileSync(join(racine, "lakour-loups.mjs"), "utf8") };
}

// Un joueur (u1) dans son navigateur, la nuit (ou le jour : phase) ; les sons joués sont notés.
function chezUnJoueur(M, { reglage = true, phase = "nuit" } = {}) {
  installerFoundry({ joueurs: 3 });
  M.reglages.enregistrerReglages(() => {});
  game.settings.set("lakour-loups", "signalTour", reglage);
  game.settings.set("lakour-loups", "partie", { ...game.settings.get("lakour-loups", "partie"), partie: "essai", phase });
  game.user = game.users.get("u1");
  const sons = [];
  foundry.audio = { AudioHelper: { play: (donnees, diffuser) => { sons.push({ donnees, diffuser }); } } };
  globalThis.CONFIG = { sounds: { notification: "sounds/notify.wav" } };
  return sons;
}

const demande = destinataire => ({ type: "demande", id: "d1", destinataire, acteurId: "a1", invite: "Qui ?", mode: "texte", max: 20,
  candidats: [], nombre: 1, delai: 10000, finit: Date.now() + 10000 });

const VERIFICATIONS = {
  "un choix secret de la nuit : tintement chez le seul destinataire, jamais diffusé"(M) {
    const sons = chezUnJoueur(M);
    M.socket.traiterMessage(demande("u2"), "mj");
    assert.equal(sons.length, 0, "pas pour moi : rien");
    M.socket.traiterMessage(demande("u1"), "mj");
    assert.equal(sons.length, 1);
    assert.equal(sons[0].diffuser, false, "joué chez moi seul");
    assert.equal(sons[0].donnees.channel, "interface");
    assert.equal(sons[0].donnees.loop, false);
  },

  "le jour, un choix secret ne tinte pas (le micro ouvert le ferait entendre à tous) : le titre seul"(M) {
    const sons = chezUnJoueur(M, { phase: "jour" });
    const ecouteurs = new Map();
    globalThis.document = { hidden: true, title: "Brumecombe", addEventListener: (n, f) => ecouteurs.set(n, f), removeEventListener: n => ecouteurs.delete(n) };
    mock.timers.enable({ apis: ["setInterval"] });
    try {
      M.socket.traiterMessage(demande("u1"), "mj");
      assert.equal(sons.length, 0, "pas de tintement le jour");
      mock.timers.tick(1000);
      assert.equal(document.title, `🔔 ${game.i18n.localize("LAKOUR_LOUPS.Signal.Choix")}`, "le titre clignote");
    } finally { mock.timers.reset(); M.signal.arreterClignotement(); delete globalThis.document; }
  },

  "ni chez le MJ, ni réglage coupé"(M) {
    let sons = chezUnJoueur(M);
    game.user = game.users.get("mj");
    assert.equal(M.signal.signaler("x"), false);
    sons = chezUnJoueur(M, { reglage: false });
    M.socket.traiterMessage(demande("u1"), "mj");
    assert.equal(sons.length, 0);
  },

  "onglet caché : le titre clignote jusqu'au retour, puis revient"(M) {
    chezUnJoueur(M);
    const ecouteurs = new Map();
    globalThis.document = { hidden: true, title: "Brumecombe", addEventListener: (n, f) => ecouteurs.set(n, f), removeEventListener: n => ecouteurs.delete(n) };
    mock.timers.enable({ apis: ["setInterval"] });
    try {
      M.signal.signaler("À toi de choisir");
      mock.timers.tick(1000);
      assert.equal(document.title, "🔔 À toi de choisir");
      mock.timers.tick(1000);
      assert.equal(document.title, "Brumecombe");
      document.hidden = false;
      ecouteurs.get("visibilitychange")();
      mock.timers.tick(5000);
      assert.equal(document.title, "Brumecombe", "rendu à son retour");
      assert.ok(!ecouteurs.has("visibilitychange"));
    } finally { mock.timers.reset(); M.signal.arreterClignotement(); delete globalThis.document; }
  },

  "onglet visible : le titre ne bouge pas"(M) {
    chezUnJoueur(M);
    globalThis.document = { hidden: false, title: "Brumecombe", addEventListener() { throw new Error("écoute inutile"); } };
    mock.timers.enable({ apis: ["setInterval"] });
    try { M.signal.signaler("x"); mock.timers.tick(1000); assert.equal(document.title, "Brumecombe"); }
    finally { mock.timers.reset(); M.signal.arreterClignotement(); delete globalThis.document; }
  },

  "le vote qui s'ouvre sonne chez chaque vivant (et chez un mort qui garde son Dernier souffle)"(M) {
    assert.match(M.entree, /const votant = Boolean\(moi\?\.system\.vivant\) \|\| Boolean\(moi && api\.peutSouffler\(moi\.id\)\.ok\);/);
    assert.match(M.entree, /if \(!voteEtaitOuvert && votant\) signaler\(t\("LAKOUR_LOUPS\.Signal\.Vote"\)\);/);
  }
};

const MUTATIONS = [
  ["scripts/socket.mjs", "      signaler(game.i18n.localize(\"LAKOUR_LOUPS.Signal.Choix\"), { son: deNuit() });\n", "", "choix secret signalé"],
  ["scripts/socket.mjs", "{ son: deNuit() }", "{ son: true }", "le jour, pas de tintement"],
  ["scripts/signal.mjs", "  if (son) try {", "  try {", "sans son, rien ne sonne"],
  ["scripts/socket.mjs", "      if (message.destinataire !== game.user.id) return true;\n", "", "au seul destinataire"],
  ["scripts/signal.mjs", "channel: \"interface\" }, false)", "channel: \"interface\" }, true)", "jamais diffusé"],
  ["scripts/signal.mjs", "if (game.user?.isGM || !game.settings.get(ID, \"signalTour\")) return false;", "", "ni MJ ni réglage coupé"],
  ["scripts/signal.mjs", "if (typeof document === \"undefined\" || !document.hidden || clignotement) return;", "if (typeof document === \"undefined\" || clignotement) return;", "onglet visible tranquille"],
  ["scripts/signal.mjs", "const retour = () => { if (!document.hidden) arreterClignotement(); };", "const retour = () => {};", "retour à l'onglet"],
  ["lakour-loups.mjs", "if (!voteEtaitOuvert && votant) signaler(", "if (false) signaler(", "vote signalé"],
  ["lakour-loups.mjs", " || Boolean(moi && api.peutSouffler(moi.id).ok);", ";", "le Dernier souffle signalé"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-signal-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  cpSync(join(SYSTEME, "lakour-loups.mjs"), join(dossier, "lakour-loups.mjs"));
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
  }
  return liste;
}

test("signal : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("signal : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
