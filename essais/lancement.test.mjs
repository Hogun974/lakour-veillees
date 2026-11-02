// Un loup-garou ne se reprend pas : à chaque LANCEMENT du monde, chez le MJ actif, la veillée repart de zéro (rôles, métiers,
// morts, chat, secrets) ; un rechargement de la page (même lastPlayed) ne touche à rien ; réglage coupé : rien.
// Chaque vérification est rejouée sur des copies mutées du système.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, messages } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, reglages, lancement] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"), m("scripts/lancement.mjs")]);
  return { api: api.api, reglages, lancement };
}

// Une partie bien entamée : rôles distribués, un mort, des messages au chat ; le monde lancé à `lance`.
async function partieEntamee(M, lance = "lancement-1") {
  installerFoundry({ joueurs: 4 });
  M.reglages.enregistrerReglages(() => {});
  globalThis.game.messages = { get size() { return messages.length; } };
  globalThis.ChatMessage.implementation.deleteDocuments = async (ids, { deleteAll } = {}) => { if (deleteAll) messages.length = 0; };
  globalThis.game.world = { lastPlayed: lance };
  const role = cle => creerObjetMonde(cle, "role", { cle, ...(cle === "loup" ? { camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } } : {}) });
  const metier = creerObjetMonde("Forgeron", "metier", { cle: "forgeron" });
  await M.api.distribuer({ roles: [role("loup"), role("villageois"), role("villageois"), role("villageois")], metiers: [metier, metier, metier, metier],
    joueurs: ["u1", "u2", "u3", "u4"], graine: "lancement", composition: "essai-4", batiments: [] });
  await M.api.changerPhase("jour");
  const victime = game.actors.contents[1];
  await M.api.eliminer(victime.id, { cause: "vote", reveler: true });
  messages.push({ content: "un message de la partie" });
  return victime;
}

const VERIFICATIONS = {
  async "lancement du monde : la veillée repart de zéro, villageois gardés"(M) {
    const victime = await partieEntamee(M);
    await game.settings.set(ID, "lancementTraite", "lancement-0");
    assert.ok(M.api.etat().partie, "une partie était en cours");
    assert.equal(await M.lancement.repartirAuLancement(M.api), true);
    const e = M.api.etat();
    assert.equal(e.partie, "");
    assert.equal(e.phase, "preparation");
    assert.deepEqual(e.morts, []);
    assert.equal(game.actors.size, 4, "les villageois restent, liés à leurs joueurs");
    for (const a of game.actors.contents) {
      assert.equal(a.items.filter(i => i.type === "role" || i.type === "metier").length, 0, `${a.name} : plus de rôle ni de métier`);
      assert.equal(a.system.vivant, true);
      assert.equal(a.system.revele, false);
      assert.ok(a.system.joueur, "lien au joueur gardé");
    }
    assert.ok(!victime.statuses.has("dead"), "plus de crâne");
    assert.equal(messages.length, 0, "chat vidé");
    assert.equal(game.settings.get(ID, "lancementTraite"), "lancement-1");
  },

  async "première fois (mise à jour en pleine séance) : le lancement est noté, rien n'est effacé"(M) {
    await partieEntamee(M);
    assert.equal(await M.lancement.repartirAuLancement(M.api), false);
    assert.ok(M.api.etat().partie, "la partie en cours reste");
    assert.equal(game.settings.get(ID, "lancementTraite"), "lancement-1");
  },

  async "rechargement de la page (même lancement) : la partie en cours reste"(M) {
    await partieEntamee(M);
    await game.settings.set(ID, "lancementTraite", "lancement-1");
    assert.equal(await M.lancement.repartirAuLancement(M.api), false);
    assert.ok(M.api.etat().partie);
    assert.equal(M.api.etat().morts.length, 1);
  },

  async "nouveau lancement après un précédent : remis à zéro de nouveau"(M) {
    await partieEntamee(M, "lancement-2");
    await game.settings.set(ID, "lancementTraite", "lancement-1");
    assert.equal(await M.lancement.repartirAuLancement(M.api), true);
    assert.equal(M.api.etat().partie, "");
  },

  async "réglage coupé, ou pas le MJ actif : rien"(M) {
    await partieEntamee(M);
    await game.settings.set(ID, "lancementTraite", "lancement-0");
    await game.settings.set(ID, "repartirAZero", false);
    assert.equal(await M.lancement.repartirAuLancement(M.api), false);
    assert.ok(M.api.etat().partie);
    await game.settings.set(ID, "repartirAZero", true);
    game.user = game.users.get("u1");
    try { assert.equal(await M.lancement.repartirAuLancement(M.api), false); }
    finally { game.user = game.users.get("mj"); }
    assert.ok(M.api.etat().partie);
  }
};

const MUTATIONS = [
  ["scripts/lancement.mjs", "if (!lancement || traite === lancement) return false;", "if (!lancement) return false;", "un rechargement ne remet rien à zéro"],
  ["scripts/lancement.mjs", "  if (!traite) return false;\n", "", "première fois : rien d'effacé"],
  ["scripts/lancement.mjs", "if (!estMJActif() || !game.settings.get(ID, \"repartirAZero\")) return false;", "", "réglage et MJ actif"],
  ["scripts/lancement.mjs", "  await game.settings.set(ID, \"lancementTraite\", lancement);\n", "", "lancement noté"],
  ["scripts/api.mjs", "      if (objets.length) await a.deleteEmbeddedDocuments(\"Item\", objets);\n", "", "rôles et métiers retirés"],
  ["scripts/api.mjs", "    if (game.messages?.size) await ChatMessage.implementation.deleteDocuments([], { deleteAll: true });\n", "", "chat vidé"],
  ["scripts/api.mjs", "    const etat = await modifierEtat(() => L.etatInitial());\n    annoncer(\"lakourLoups.phase\", [\"preparation\", etat]", "    const etat = lireEtat();\n    annoncer(\"lakourLoups.phase\", [\"preparation\", etat]", "état de la partie effacé"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-lancement-mutant-"));
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
  }
  return liste;
}

test("lancement : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("lancement : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
