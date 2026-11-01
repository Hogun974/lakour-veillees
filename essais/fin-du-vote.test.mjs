// Le vote à minuteur se clôt de lui-même à zéro, chez le MJ actif (comme les votes du MJ IA) ; sans minuteur, il attend le
// MJ ; clos à la main, rejoué ou prolongé par le ruban, l'ancienne échéance ne vaut plus ; un vote clos ne se recompte pas.
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois) : elle doit alors échouer.
// Lancer : npm run essais
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, reglages, fin, votes] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"), m("scripts/fin-du-vote.mjs"), m("logique/votes.mjs")]);
  return { api: api.api, reglages, fin, votes };
}

// Un village de quatre, en plein jour, le vote ouvert pour `duree` ms (0 = sans minuteur).
async function villageAuVote(M, duree) {
  installerFoundry({ joueurs: 4 });
  M.reglages.enregistrerReglages(() => {});
  const role = cle => creerObjetMonde(cle, "role", { cle, ...(cle === "loup" ? { camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } } : {}) });
  await M.api.distribuer({ roles: [role("loup"), role("villageois"), role("villageois"), role("villageois")], metiers: [],
    joueurs: ["u1", "u2", "u3", "u4"], graine: "fin-du-vote", composition: "essai-4", batiments: [] });
  await M.api.changerPhase("jour");
  return M.api.ouvrirVote({ duree });
}

// Lance la surveillance (minuteries simulées) et avance de `ms` : -> le nombre de clôtures demandées.
function apres(M, ms, { clore = () => {}, avant = () => {} } = {}) {
  M.fin.oublierFinDuVote();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let n = 0;
    M.fin.surveillerFinDuVote(() => { n++; return clore(); });
    avant();
    mock.timers.tick(ms);
    return n;
  } finally { mock.timers.reset(); }
}

const VERIFICATIONS = {
  "échéance : vote ouvert à minuteur seulement, clé changée avec le vote"(M) {
    const { echeanceDuVote } = M.votes;
    assert.equal(echeanceDuVote({ ouvert: false, numero: 1, finit: 5000 }, 1000), null);
    assert.equal(echeanceDuVote({ ouvert: true, numero: 1, finit: 0 }, 1000), null, "sans minuteur, pas d'échéance");
    assert.deepEqual(echeanceDuVote({ ouvert: true, numero: 1, finit: 5000 }, 1000), { cle: "1|5000", dans: 4000 });
    assert.equal(echeanceDuVote({ ouvert: true, numero: 1, finit: 5000 }, 9000).dans, 0, "déjà passée : tout de suite");
    assert.notEqual(echeanceDuVote({ ouvert: true, numero: 2, finit: 5000 }).cle, "1|5000", "un nouveau vote");
    assert.notEqual(echeanceDuVote({ ouvert: true, numero: 1, finit: 65000 }).cle, "1|5000", "prolongé par le ruban");
  },

  async "à zéro, le vote se clôt une fois, pas avant"(M) {
    const v = await villageAuVote(M, 30000);
    const dans = v.finit - Date.now();
    assert.equal(apres(M, dans - 1000), 0, "pas avant zéro");
    let p;
    assert.equal(apres(M, dans + M.fin.MARGE + 50, { clore: () => (p = M.api.cloreVote()) }), 1);
    const r = await p;
    assert.equal(r.objet, "execution");
    assert.equal(M.api.etat().vote.ouvert, false, "le vote est clos");
  },

  async "surveiller deux fois le même vote ne le clôt qu'une fois"(M) {
    await villageAuVote(M, 30000);
    let n = 0;
    M.fin.oublierFinDuVote();
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      M.fin.surveillerFinDuVote(() => n++);
      M.fin.surveillerFinDuVote(() => n++);
      mock.timers.tick(40000);
    } finally { mock.timers.reset(); }
    assert.equal(n, 1);
  },

  async "sans minuteur, le vote attend le MJ"(M) {
    await villageAuVote(M, 0);
    assert.equal(apres(M, 3600000), 0);
  },

  async "clos à la main avant zéro : l'échéance ne vaut plus"(M) {
    await villageAuVote(M, 30000);
    let n = 0;
    M.fin.oublierFinDuVote();
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      M.fin.surveillerFinDuVote(() => n++);
      game.settings.set("lakour-loups", "partie", { ...structuredClone(M.api.etat()), vote: { ...M.api.etat().vote, ouvert: false } });
      mock.timers.tick(40000);
    } finally { mock.timers.reset(); }
    assert.equal(n, 0);
  },

  async "seul le MJ actif clôt, même s'il a passé la main pendant le vote"(M) {
    await villageAuVote(M, 30000);
    const mj = game.user;
    try {
      game.user = game.users.get("u1");
      assert.equal(apres(M, 40000), 0, "un joueur ne programme rien");
      game.user = mj;
      assert.equal(apres(M, 40000, { avant: () => { game.user = game.users.get("u1"); } }), 0, "plus MJ actif à zéro");
    } finally { game.user = mj; }
  },

  async "un vote déjà clos ne se recompte pas"(M) {
    await villageAuVote(M, 0);
    await M.api.cloreVote();
    await assert.rejects(() => M.api.cloreVote(), /Aucun vote n'est ouvert|PasDeVote/);
  }
};

const MUTATIONS = [
  ["logique/votes.mjs", "if (!vote?.ouvert || !(vote.finit > 0)) return null;", "if (!vote?.ouvert) return null;", "sans minuteur, pas d'échéance"],
  ["logique/votes.mjs", "{ cle: `${vote.numero}|${vote.finit}`,", "{ cle: `${vote.numero}`,", "prolongation reconnue"],
  ["scripts/fin-du-vote.mjs", "if (!estMJActif() || echeanceDuVote(lireEtat().vote)?.cle !== e.cle) return;", "", "échéance périmée ignorée"],
  ["scripts/fin-du-vote.mjs", "if (!estMJActif() || echeanceDuVote(lireEtat().vote)?.cle", "if (echeanceDuVote(lireEtat().vote)?.cle", "MJ actif encore à zéro"],
  ["scripts/fin-du-vote.mjs", "}, e.dans + MARGE)", "}, 0)", "pas avant zéro"],
  ["scripts/api.mjs", "if (!e?.vote?.ouvert) throw new Error(t(\"LAKOUR_LOUPS.Erreurs.PasDeVote\"));", "", "vote clos non recompté"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fin-du-vote-mutant-"));
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

test("fin du vote : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("fin du vote : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
