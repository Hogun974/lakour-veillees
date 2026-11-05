// L'immersion v14 chez chaque client (scripts/immersion.mjs) : une mort fait trembler l'écran (court, modéré) ; la nuit
// tombe en brume sous les jetons, que toute autre phase dissipe ; l'aube a ses lueurs, la victoire les siennes, à la couleur
// du vainqueur ; rien si le réglage client « Effets visuels » est coupé, si le système demande moins de mouvement ou en
// mode photosensible ; aucun argument secret des hooks n'est lu (ni le mort, ni sa cause, ni l'état).
// Le canevas de Foundry est simulé ici (CanvasShakeEffect et ParticleGenerator notent ce qu'on leur demande).
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois) : elle doit alors échouer.
// Lancer : npm run essais
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, reglages, erreursHooks } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";
const VIE = 16000;   // au-delà de la plus longue vie d'une particule

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [immersion, regl] = await Promise.all([m("scripts/immersion.mjs"), m("scripts/reglages.mjs")]);
  return { immersion, reglages: regl, entree: readFileSync(join(racine, "lakour-loups.mjs"), "utf8") };
}

// Un joueur (u1) devant le canevas simulé. -> le journal de ce que le canevas a reçu.
function chezUnJoueur(M, { reglage = true, reduit = false, photosensible = false, pret = true } = {}) {
  installerFoundry({ joueurs: 3 });
  M.reglages.enregistrerReglages(() => {});
  M.immersion.brancherImmersion();
  game.user = game.users.get("u1");
  const journal = { secousses: [], generateurs: [] };
  class FausseSecousse {
    constructor(options) { this.options = options; journal.secousses.push(this); }
    play() { this.jouee = true; return Promise.resolve(); }
  }
  class FauxGenerateur {
    constructor(options) { this.options = options; this.arrets = []; this.conteneur = null; journal.generateurs.push(this); }
    start() { this.demarre = true; this.conteneur = { sortLayer: 0, eventMode: "none" }; }
    get particlesContainer() { return this.conteneur; }
    stop({ hard = false } = {}) { this.arrets.push(hard ? "net" : "doux"); }
  }
  foundry.canvas = { animation: { CanvasShakeEffect: FausseSecousse, ParticleGenerator: FauxGenerateur } };
  globalThis.canvas = { ready: pret, scene: { id: "village" }, stage: { x: 0, y: 0 }, primary: { nom: "primary" }, photosensitiveMode: photosensible };
  globalThis.PIXI = { Texture: { WHITE: "blanc", from: () => "tache" }, BLEND_MODES: { NORMAL: 0, ADD: 1, SCREEN: 3 } };
  globalThis.matchMedia = requete => ({ matches: reduit && requete === "(prefers-reduced-motion: reduce)" });
  game.settings.set(ID, "effetsVisuels", reglage);
  return journal;
}

// Les arguments tels qu'un hook les porte, piégés : toute clé lue est notée.
function piege(lus, nom, objet) {
  return new Proxy(objet, { get(cible, cle, r) { if (typeof cle === "string") lus.push(`${nom}.${cle}`); return Reflect.get(cible, cle, r); } });
}
const ETAT = { partie: "p1", phase: "nuit", tour: 2, morts: [{ acteurId: "a1", cause: "loups" }], vainqueur: "", causes: { a1: "poison" } };
const mort = (lus = []) => piege(lus, "mort", { acteurId: "a1", revele: true, roleCle: "loup", cause: "loups" });
const etat = (lus = []) => piege(lus, "etat", structuredClone(ETAT));
const phase = (p, lus) => Hooks.callAll("lakourLoups.phase", p, etat(lus));
const dernier = j => j.generateurs.at(-1);

const VERIFICATIONS = {
  "branchée à l'init ; réglage client « Effets visuels », affiché, activé par défaut"(M) {
    assert.match(M.entree, /Hooks\.once\("init", \(\) => \{[\s\S]*\n  brancherImmersion\(\);[\s\S]*\n\}\);\n\n\/\/ -+ prêt/);
    chezUnJoueur(M);
    const { conf } = reglages.get(`${ID}.effetsVisuels`);
    assert.equal(conf.scope, "client");
    assert.equal(conf.config, true);
    assert.equal(conf.default, true);
    assert.equal(conf.type, Boolean);
    // Libellé et aide traduits (lang/fr.json et lang/en.json du système), comme les autres réglages.
    const langue = l => JSON.parse(readFileSync(join(SYSTEME, `lang/${l}.json`), "utf8")).LAKOUR_LOUPS.Reglages.EffetsVisuels;
    assert.equal(conf.name, "LAKOUR_LOUPS.Reglages.EffetsVisuels.Nom");
    assert.equal(conf.hint, "LAKOUR_LOUPS.Reglages.EffetsVisuels.Aide");
    assert.equal(langue("fr").Nom, "Effets visuels");
    assert.equal(langue("en").Nom, "Visual effects");
    assert.ok(langue("fr").Aide && langue("en").Aide);
  },

  "une mort : l'écran tremble, brièvement et modérément"(M) {
    const j = chezUnJoueur(M);
    Hooks.callAll("lakourLoups.elimination", mort());
    assert.equal(j.secousses.length, 1);
    const [s] = j.secousses;
    assert.ok(s.jouee);
    assert.equal(s.options.target, canvas.stage, "la caméra");
    assert.ok(s.options.duration > 0 && s.options.duration <= 1000, `durée ${s.options.duration}`);
    assert.ok(s.options.maxDisplacement > 0 && s.options.maxDisplacement <= 10, `amplitude ${s.options.maxDisplacement}`);
    assert.equal(j.generateurs.length, 0);
  },

  "la nuit tombe : une seule brume, discrète, sous les jetons ; le jour la dissipe puis la détruit"(M) {
    const j = chezUnJoueur(M);
    phase("nuit");
    phase("nuit");
    assert.equal(j.generateurs.length, 1, "une seule brume");
    const b = j.generateurs[0];
    assert.ok(b.demarre);
    assert.equal(b.options.container, canvas.primary);
    assert.ok(b.conteneur.sortLayer > 600 && b.conteneur.sortLayer < 700, "entre dessins (600) et jetons (700)");
    assert.ok(Math.max(...b.options.alpha) <= 0.2, "discrète");
    assert.deepEqual(M.immersion.etatImmersion(), { brume: true, passagers: 0 });
    phase("jour");
    assert.deepEqual(b.arrets, ["doux"], "les dernières nappes s'effacent seules");
    assert.equal(M.immersion.etatImmersion().brume, false);
    mock.timers.tick(VIE);
    assert.deepEqual(b.arrets, ["doux", "net"], "puis le générateur est détruit");
    assert.equal(M.immersion.etatImmersion().passagers, 0);
    assert.equal(j.generateurs.length, 1, "le jour n'a pas d'effet à lui");
  },

  "l'aube : des lueurs passagères, dorées, et la brume se dissipe"(M) {
    const j = chezUnJoueur(M);
    phase("nuit");
    phase("aube");
    assert.equal(j.generateurs.length, 2);
    const [b, aube] = j.generateurs;
    assert.deepEqual(b.arrets, ["doux"]);
    assert.equal(aube.options.tint, M.immersion.AUBE.tint);
    assert.ok(aube.conteneur.sortLayer < 700, "sous les jetons");
    mock.timers.tick(M.immersion.DUREES.aube);
    assert.deepEqual(aube.arrets, ["doux"], "plus de nouvelles lueurs");
    mock.timers.tick(VIE);
    assert.deepEqual(aube.arrets, ["doux", "net"]);
  },

  "la victoire : des lueurs à la couleur du vainqueur ; la brume se dissipe"(M) {
    const j = chezUnJoueur(M);
    phase("nuit");
    Hooks.callAll("lakourLoups.victoire", "meute", etat());
    assert.deepEqual(j.generateurs[0].arrets, ["doux"]);
    assert.equal(dernier(j).options.tint, M.immersion.COULEURS_VICTOIRE.meute);
    Hooks.callAll("lakourLoups.victoire", "village", etat());
    assert.equal(dernier(j).options.tint, M.immersion.COULEURS_VICTOIRE.village);
    Hooks.callAll("lakourLoups.victoire", "id0000000000004", etat());
    assert.equal(dernier(j).options.tint, M.immersion.COULEURS_VICTOIRE.solitaire, "un solitaire");
    mock.timers.tick(M.immersion.DUREES.victoire);
    mock.timers.tick(VIE);
    assert.ok(j.generateurs.slice(1).every(g => g.arrets.join() === "doux,net"));
  },

  "réglage coupé : rien du tout"(M) {
    const j = chezUnJoueur(M, { reglage: false });
    Hooks.callAll("lakourLoups.elimination", mort());
    phase("nuit"); phase("aube");
    Hooks.callAll("lakourLoups.victoire", "village", etat());
    assert.deepEqual([j.secousses.length, j.generateurs.length], [0, 0]);
  },

  "réglage coupé en pleine nuit : la brume s'arrête net ; rallumé : elle revient"(M) {
    const j = chezUnJoueur(M);
    game.settings.set(ID, "partie", { ...game.settings.get(ID, "partie"), phase: "nuit" });
    phase("nuit");
    game.settings.set(ID, "effetsVisuels", false);
    assert.deepEqual(j.generateurs[0].arrets, ["net"]);
    game.settings.set(ID, "effetsVisuels", true);
    assert.equal(j.generateurs.length, 2);
    assert.ok(M.immersion.etatImmersion().brume);
  },

  "mouvement réduit, ou mode photosensible : rien de mouvant"(M) {
    for (const options of [{ reduit: true }, { photosensible: true }]) {
      const j = chezUnJoueur(M, options);
      Hooks.callAll("lakourLoups.elimination", mort());
      phase("nuit"); phase("aube");
      Hooks.callAll("lakourLoups.victoire", "meute", etat());
      assert.deepEqual([j.secousses.length, j.generateurs.length], [0, 0], JSON.stringify(options));
    }
  },

  "aucun argument secret n'est lu (ni le mort, ni sa cause, ni l'état)"(M) {
    chezUnJoueur(M);
    const lus = [];
    Hooks.callAll("lakourLoups.elimination", mort(lus));
    phase("nuit", lus); phase("aube", lus); phase("vote", lus);
    Hooks.callAll("lakourLoups.victoire", "meute", etat(lus));
    assert.deepEqual(lus, []);
    assert.deepEqual(erreursHooks, []);
  },

  "sans canevas prêt : rien, sans erreur"(M) {
    const j = chezUnJoueur(M, { pret: false });
    Hooks.callAll("lakourLoups.elimination", mort());
    phase("nuit");
    Hooks.callAll("lakourLoups.victoire", "village", etat());
    assert.deepEqual([j.secousses.length, j.generateurs.length], [0, 0]);
    assert.deepEqual(erreursHooks, []);
  },

  "le canevas démonté arrête tout net ; redessiné en pleine nuit, la brume revient"(M) {
    const j = chezUnJoueur(M);
    phase("nuit"); phase("aube");
    Hooks.callAll("canvasTearDown", canvas);
    assert.deepEqual(j.generateurs.map(g => g.arrets.at(-1)), ["net", "net"]);
    assert.deepEqual(M.immersion.etatImmersion(), { brume: false, passagers: 0 });
    game.settings.set(ID, "partie", { ...game.settings.get(ID, "partie"), phase: "nuit" });
    Hooks.callAll("canvasReady", canvas);
    assert.equal(j.generateurs.length, 3);
    assert.ok(M.immersion.etatImmersion().brume);
    game.settings.set(ID, "partie", { ...game.settings.get(ID, "partie"), phase: "jour" });
    Hooks.callAll("canvasTearDown", canvas);
    Hooks.callAll("canvasReady", canvas);
    assert.equal(j.generateurs.length, 3, "de jour, pas de brume");
  }
};

const MUTATIONS = [
  ["lakour-loups.mjs", "  brancherImmersion();   //", "  //", "branchée à l'init"],
  ["scripts/immersion.mjs", "scope: \"client\", config: true, type: Boolean, default: true,", "scope: \"world\", config: true, type: Boolean, default: true,", "réglage client"],
  ["scripts/immersion.mjs", "  Hooks.on(\"lakourLoups.elimination\", () => secouer());\n", "", "une mort tremble"],
  ["scripts/immersion.mjs", "duration: 500, maxDisplacement: 6,", "duration: 5000, maxDisplacement: 35,", "tremblement modéré"],
  ["scripts/immersion.mjs", "if (!brume) brume = lancer(BRUME);", "brume = lancer(BRUME);", "une seule brume"],
  ["scripts/immersion.mjs", "if (conteneur && \"sortLayer\" in conteneur) conteneur.sortLayer = SOUS_LES_JETONS;", "", "sous les jetons"],
  ["scripts/immersion.mjs", "  dissiperBrume();\n  if (phase === \"aube\")", "  if (phase === \"aube\")", "le jour dissipe la brume"],
  ["scripts/immersion.mjs", "  if (phase === \"aube\") leverDuJour();\n", "", "lueurs de l'aube"],
  ["scripts/immersion.mjs", "  setTimeout(() => detruire(generateur), VIE_MAX + 1000);\n", "", "détruit après sa vie"],
  ["scripts/immersion.mjs", "      setTimeout(() => eteindre(generateur), duree);\n", "", "effet passager"],
  ["scripts/immersion.mjs", "return COULEURS_VICTOIRE[vainqueur] ?? COULEURS_VICTOIRE.solitaire;", "return COULEURS_VICTOIRE.village;", "couleur du vainqueur"],
  ["scripts/immersion.mjs", "export function feterVictoire(vainqueur) {\n  dissiperBrume();", "export function feterVictoire(vainqueur) {", "la victoire dissipe la brume"],
  ["scripts/immersion.mjs", "voulu = game.settings.get(ID, REGLAGE) !== false;", "voulu = true;", "réglage coupé"],
  ["scripts/immersion.mjs", "return voulu && !mouvementReduit() && !globalThis.canvas?.photosensitiveMode;", "return voulu && !globalThis.canvas?.photosensitiveMode;", "mouvement réduit"],
  ["scripts/immersion.mjs", "return voulu && !mouvementReduit() && !globalThis.canvas?.photosensitiveMode;", "return voulu && !mouvementReduit();", "mode photosensible"],
  ["scripts/immersion.mjs", "if (!effetsPermis()) { toutEteindre(); return; }", "if (!effetsPermis()) return;", "coupé en pleine nuit"],
  ["scripts/immersion.mjs", "  if (phaseCourante() === \"nuit\") allumerBrume();\n", "", "la brume revient"],
  ["scripts/immersion.mjs", "  Hooks.on(\"canvasTearDown\", () => toutEteindre());\n", "", "démontage"],
  ["scripts/immersion.mjs", "const canevasPret = () => Boolean(globalThis.canvas?.ready && canvas.scene && canvas.stage);", "const canevasPret = () => true;", "canevas prêt"],
  ["scripts/immersion.mjs", "Hooks.on(\"lakourLoups.elimination\", () => secouer());", "Hooks.on(\"lakourLoups.elimination\", infos => infos?.cause !== \"x\" && secouer());", "secret : la cause"],
  ["scripts/immersion.mjs", "Hooks.on(\"lakourLoups.phase\", phase => quandPhase(phase));", "Hooks.on(\"lakourLoups.phase\", (phase, etat) => quandPhase(etat?.phase ?? phase));", "secret : l'état"],
  ["scripts/immersion.mjs", "Hooks.on(\"lakourLoups.victoire\", vainqueur => feterVictoire(vainqueur));", "Hooks.on(\"lakourLoups.victoire\", (vainqueur, etat) => feterVictoire(etat?.morts ? vainqueur : vainqueur));", "secret : l'état final"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-immersion-mutant-"));
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
    mock.timers.enable({ apis: ["setTimeout"] });
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { mock.timers.reset(); }
  }
  delete globalThis.canvas; delete globalThis.PIXI; delete globalThis.matchMedia;
  return liste;
}

test("immersion : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("immersion : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
