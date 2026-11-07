// Caméras des joueurs aux Veillées (logique/cameras.mjs, scripts/cameras.mjs ; le travail dans chaque navigateur est fait par le
// moteur commun, lakour-mj-ia/scripts/cameras.js, et éprouvé dans ses propres essais). Ici : la règle ligne par ligne du tableau
// (la nuit tous les vivants, les morts, les spectateurs, les absents du jour de la Gazette, les réduits au silence pendant le jour
// et le vote ; jamais un MJ ; rien aux préparatifs ni à la fin) ; « chaque fois que le jeu coupe le micro, la caméra est remplacée »
// sur toute la matrice des salons vocaux ; la non-fuite (ni camp, ni rôle, ni fratrie ne changent rien ; la nuit, un loup et un
// villageois ont exactement la même caméra ; rien ne part par le socket, rien n'est écrit) ; l'image (réglage, module anglais,
// repli) ; une batterie par mutation ; puis deux parties simulées avec le vrai moteur (si le sous-module a ses caméras).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { jouerPartie, villageois as villageoisDuMonde, roleDe } from "./outils/partie-loups.mjs";
import { emissions } from "./doublures/foundry-loups.mjs";

const L0 = await import("../systems/lakour-loups/logique/index.mjs");
const cameras = await import("../systems/lakour-loups/scripts/cameras.mjs");
const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));
const MOTEUR_CAMERAS = new URL("../modules/lakour-mj-ia/scripts/cameras.js", import.meta.url);
const moteurAvecCameras = existsSync(MOTEUR_CAMERAS);

// ------------------------------------------------------------------ une table d'essai (comme loups-salons.test.mjs)
// u1 loup, u2 louve mère, u3 et u4 villageois, u5 mort, u6 réduit au silence, u7 spectateur (sans villageois) ; c1, c2 : compagnons.
const v = (id, joueur, camp, extra = {}) => ({ id, joueur, vivant: true, silence: false, camp, role: { camp }, ...extra });
const VILLAGEOIS = () => [
  v("l1", "u1", "meute"), v("l2", "u2", "meute"), v("x3", "u3", "village"), v("x4", "u4", "village"),
  v("m5", "u5", "village", { vivant: false }), v("s6", "u6", "village", { silence: true }), v("c1", "", "meute"), v("c2", "", "village")
];
const UTILISATEURS = [{ id: "mj", mj: true }, ...["u1", "u2", "u3", "u4", "u5", "u6", "u7"].map(id => ({ id, mj: false }))];
const JOUEURS = UTILISATEURS.filter(u => !u.mj).map(u => u.id);
const PHASES = ["preparation", "nuit", "aube", "jour", "vote", "fin"];
// La Gazette : x4 est parti au bal (absent du jour 2).
const etat = (phase, extra = {}) => ({ partie: "p", phase, tour: 2, gazette: { marques: [{ type: "absent", tour: 2, ids: ["x4"], cle: "bal-du-samedi" }] }, ...extra });
const camera = (L, phase, userId, options = {}) => L.cameraDe(etat(phase, options.etat), { userId, mj: userId === "mj", villageois: options.villageois ?? VILLAGEOIS(), actif: options.actif ?? true });
const raisons = (L, phase, options) => Object.fromEntries(JOUEURS.map(u => [u, camera(L, phase, u, options).raison]));

// ------------------------------------------------------------------ la batterie
const VERIFICATIONS = {
  "préparatifs et fin : la caméra de chacun": L => {
    for (const phase of ["preparation", "fin", ""]) for (const u of [...JOUEURS, "mj"]) assert.deepEqual(camera(L, phase, u), { remplacee: false, raison: "" }, `${phase} ${u}`);
  },
  "la nuit : TOUS les vivants remplacés (loups compris), les morts et le spectateur aussi": L => {
    assert.deepEqual(raisons(L, "nuit"), { u1: "nuit", u2: "nuit", u3: "nuit", u4: "nuit", u5: "mort", u6: "nuit", u7: "spectateur" });
  },
  "l'aube : les morts, le spectateur, l'absent ; le réduit au silence parle à l'aube, sa caméra aussi": L => {
    assert.deepEqual(raisons(L, "aube"), { u1: "", u2: "", u3: "", u4: "absent", u5: "mort", u6: "", u7: "spectateur" });
  },
  "le jour et le vote : aussi le réduit au silence": L => {
    for (const phase of ["jour", "vote"]) {
      assert.deepEqual(raisons(L, phase), { u1: "", u2: "", u3: "", u4: "absent", u5: "mort", u6: "silence", u7: "spectateur" }, phase);
    }
  },
  "absent un autre jour : rien": L => {
    assert.equal(camera(L, "jour", "u4", { etat: { tour: 3 } }).remplacee, false);
  },
  "un MJ jamais remplacé, même s'il incarne un villageois mort": L => {
    const vs = [...VILLAGEOIS(), v("mj1", "mj", "village", { vivant: false })];
    for (const phase of PHASES) assert.equal(camera(L, phase, "mj", { villageois: vs }).remplacee, false, phase);
  },
  "réglage décoché : personne n'est remplacé": L => {
    for (const phase of PHASES) for (const u of JOUEURS) assert.equal(camera(L, phase, u, { actif: false }).remplacee, false);
  },
  "une raison connue, le remplacement dit vrai": L => {
    for (const phase of PHASES) for (const u of JOUEURS) {
      const c = camera(L, phase, u);
      assert.deepEqual(Object.keys(c).sort(), ["raison", "remplacee"]);
      assert.equal(c.remplacee, Boolean(c.raison));
      if (c.raison) assert.ok(L.RAISONS_DE_CAMERA.includes(c.raison), c.raison);
    }
  },
  "l'image : le réglage, sinon le module de contenu ; le repli à côté": L => {
    assert.deepEqual(L.imagesDeCamera("", "lakour-veillees"),
      { image: "modules/lakour-veillees/assets/camera/loup-garou.webp", repli: "modules/lakour-veillees/assets/camera/loup-garou.svg" });
    assert.deepEqual(L.imagesDeCamera("  ", "lakour-veillees-en"),
      { image: "modules/lakour-veillees-en/assets/camera/loup-garou.webp", repli: "modules/lakour-veillees-en/assets/camera/loup-garou.svg" });
    assert.equal(L.imagesDeCamera(" worlds/brumecombe/loup.png ").image, "worlds/brumecombe/loup.png");
    assert.equal(L.imagesDeCamera("", "../x").repli, "modules/lakour-veillees/assets/camera/loup-garou.svg");
  }
};
function echecs(L) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { verifier(L); } catch (e) { liste.push(`${nom} : ${e.message.split("\n")[0]}`); }
  }
  return liste;
}

test("caméras, logique pure : la batterie passe", () => { assert.deepEqual(echecs(L0), []); });

// ------------------------------------------------------------------ le micro coupé par le jeu => la caméra remplacée
test("chaque fois que le jeu coupe ou restreint le micro (salons vocaux), la caméra est remplacée", () => {
  let cas = 0;
  for (const mortsVoientTout of [false, true]) for (const phase of PHASES) {
    // Une fratrie qui veille cette nuit (les Lavandières) : x3 et s6.
    const vs = VILLAGEOIS().map(x => (["x3", "s6"].includes(x.id) ? { ...x, fratrie: "lavandieres" } : x));
    const table = { utilisateurs: UTILISATEURS, villageois: vs, mortsVoientTout };
    for (const u of JOUEURS) {
      const ligne = L0.ligneDe(etat(phase), { partie: "p" }, u, table);
      const restreint = !ligne.peutParler || !["village", "libre", "mj"].includes(ligne.salon);
      const c = L0.cameraDe(etat(phase), { userId: u, villageois: vs });
      if (restreint) { cas++; assert.equal(c.remplacee, true, `${phase} ${u} : salon ${ligne.salon}, caméra laissée`); }
    }
  }
  assert.ok(cas >= 30, `assez de cas éprouvés (${cas})`);
});

// ------------------------------------------------------------------ non-fuite
test("non-fuite : ni le camp, ni le rôle, ni la fratrie ne changent une caméra ; la nuit, loup et villageois à l'identique", () => {
  const camps = ["meute", "village", "solitaire"];
  for (const phase of PHASES) {
    const reference = raisons(L0, phase);
    for (let essai = 0; essai < 12; essai++) {
      const melange = VILLAGEOIS().map((x, i) => ({ ...x, camp: camps[(i + essai) % 3], role: { camp: camps[(i * 7 + essai) % 3], cle: `role-${essai}` },
        fratrie: essai % 2 ? "bucherons" : "", loup: essai % 3 === 0, amoureux: "x3" }));
      assert.deepEqual(raisons(L0, phase, { villageois: melange }), reference, `${phase}, essai ${essai}`);
    }
  }
  // La nuit : le loup qui parle à la tanière (u1), la louve (u2), le villageois qui dort (u3) : la même caméra, la même raison.
  const nuit = ["u1", "u2", "u3"].map(u => camera(L0, "nuit", u));
  assert.deepEqual(nuit[0], { remplacee: true, raison: "nuit" });
  assert.deepEqual(nuit[1], nuit[0]);
  assert.deepEqual(nuit[2], nuit[0]);
});

test("non-fuite : la source de la règle ne lit ni camp, ni rôle, ni secret, ni ligne des salons ; rien ne part, rien ne s'écrit", () => {
  const logique = readFileSync(join(SOURCE, "cameras.mjs"), "utf8").replace(/\/\/.*$/gm, "");
  const script = readFileSync(new URL("../systems/lakour-loups/scripts/cameras.mjs", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  for (const mot of [/\bcamp\b/, /\brole\b/, /fratrie/, /secret/i, /ligne/, /loup(s)?Connus/]) {
    assert.doesNotMatch(logique, mot, `logique/cameras.mjs lit ${mot}`);
    assert.doesNotMatch(script, mot, `scripts/cameras.mjs lit ${mot}`);
  }
  for (const geste of [/emettre|socket|versMJ|annoncer/, /settings\.set|\.update\(|setFlag|create\(/]) assert.doesNotMatch(script, geste, `scripts/cameras.mjs : ${geste}`);
});

// ------------------------------------------------------------------ mutations
const MUTATIONS = [
  ["  if (!actif || mj || !userId) return { ...garder };", "  if (!actif || !userId) return { ...garder };", "un MJ jamais remplacé"],
  ["  if (!actif || mj || !userId) return { ...garder };", "  if (mj || !userId) return { ...garder };", "le réglage décoché"],
  ["if (!phase || PHASES_LIBRES.includes(phase)) return { ...garder };", "if (!phase) return { ...garder };", "rien aux préparatifs ni à la fin"],
  ["  if (!v) return remplacer(\"spectateur\");\n", "  if (!v) return { ...garder };\n", "le spectateur remplacé"],
  ["  if (v.vivant === false) return remplacer(\"mort\");\n", "", "les morts remplacés"],
  ["  if (PHASES_DE_NUIT.includes(phase)) return remplacer(\"nuit\");\n", "", "la nuit, tous les vivants"],
  ["if (absentsDuJour(etatPublic, Number(etatPublic?.tour) || 0).includes(v.id)) return remplacer(\"absent\");", "", "les absents de la Gazette"],
  ["if (v.silence && PHASES_DU_JOUR_MUET.includes(phase)) return remplacer(\"silence\");", "if (v.silence) return remplacer(\"silence\");", "le silence ne vaut pas à l'aube"],
  ["if (v.silence && PHASES_DU_JOUR_MUET.includes(phase)) return remplacer(\"silence\");", "", "les réduits au silence"],
  ["return { image: choisie || `modules/${module}/${IMAGE_DE_CAMERA}`, repli };", "return { image: `modules/${module}/${IMAGE_DE_CAMERA}`, repli };", "l'image réglable"]
];

async function chargerMutant(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "cameras-mutant-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === "cameras.mjs") {
      assert.ok(texte.includes(avant), `mutation introuvable : ${avant}`);
      texte = texte.replace(avant, apres);
    }
    writeFileSync(join(dossier, f), texte);
  }
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

for (const [avant, apres, regle] of MUTATIONS) {
  test(`mutation des caméras « ${regle} » : détectée`, async () => {
    const L = await chargerMutant(avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}

// ------------------------------------------------------------------ la liaison (scripts/cameras.mjs) sur la doublure
// Un moteur réduit à son API des caméras : la règle posée, les actualisations comptées.
function moteurFactice() {
  const m = { regles: [], actualisations: 0 };
  m.api = { regle: fn => { m.regles.push(fn); return () => { m.regles = m.regles.filter(x => x !== fn); }; }, actualiser: () => { m.actualisations++; } };
  game.modules.set("lakour-mj-ia", { ...(game.modules.get("lakour-mj-ia") ?? {}), id: "lakour-mj-ia", active: true,
    api: { ...(game.modules.get("lakour-mj-ia")?.api ?? {}), cameras: m.api } });
  return m;
}

test("liaison : la règle posée une fois dans le moteur ; l'image du module actif (français, anglais) ou du réglage ; un MJ jamais", async () => {
  await jouerPartie({ n: 6, niveau: "debutants", graine: "camera-liaison", verifier: false, apresMonde: async () => {
    cameras.debrancherCameras();
    const sans = game.modules.get("lakour-mj-ia");
    game.modules.set("lakour-mj-ia", { ...sans, api: { coffre: sans.api.coffre } });
    assert.equal(cameras.poserRegle(), false, "un moteur sans caméras : rien");
    assert.equal(cameras.actualiserCameras(), false);
    const m = moteurFactice();
    assert.equal(cameras.poserRegle(), true);
    assert.equal(cameras.poserRegle(), true, "pas deux fois");
    assert.equal(m.regles.length, 1);
    // Avant la distribution (préparatifs) : personne n'est remplacé.
    for (const u of game.users.contents) assert.equal(m.regles[0](u), null, u.id);
    globalThis.__moteurFactice = m;
  } });
  const m = globalThis.__moteurFactice;
  delete globalThis.__moteurFactice;
  const regle = m.regles[0];
  // La partie est finie (phase « fin ») : on la remet à la nuit pour lire la règle.
  const pub = game.settings.get("lakour-loups", "partie");
  await game.settings.set("lakour-loups", "partie", { ...pub, phase: "nuit" });
  const joueur = game.users.find(u => !u.isGM && villageoisDuMonde().some(a => a.system.joueur === u.id && a.system.vivant))
    ?? game.users.find(u => !u.isGM);
  assert.equal(regle(game.users.find(u => u.isGM)), null, "le MJ");
  assert.deepEqual(regle(joueur), { image: "modules/lakour-veillees/assets/camera/loup-garou.webp",
    repli: "modules/lakour-veillees/assets/camera/loup-garou.svg", raison: villageoisDuMonde().some(a => a.system.joueur === joueur.id && a.system.vivant) ? "nuit" : "mort" });
  await repos();
  game.modules.set("lakour-veillees", { id: "lakour-veillees", active: false });
  game.modules.set("lakour-veillees-en", { id: "lakour-veillees-en", active: true });
  assert.equal(regle(joueur).image, "modules/lakour-veillees-en/assets/camera/loup-garou.webp", "le module anglais");
  game.modules.delete("lakour-veillees-en");
  await game.settings.set("lakour-loups", "imageCamera", "worlds/brumecombe/loup.png");
  await repos();
  assert.equal(regle(joueur).image, "worlds/brumecombe/loup.png", "le réglage");
  assert.ok(m.actualisations > 0, "un réglage changé : le moteur actualise");
  await game.settings.set("lakour-loups", "cameraRemplacee", false);
  await repos();
  assert.equal(regle(joueur), null, "remplacement décoché");
  await game.settings.set("lakour-loups", "cameraRemplacee", true);
  await game.settings.set("lakour-loups", "imageCamera", "");
  // Rien ne part par le socket, rien ne s'écrit, quand la règle est lue ou que le moteur actualise.
  const avant = emissions.length;
  const ecrire = game.settings.set;
  let ecritures = 0;
  game.settings.set = async (...a) => { ecritures++; return ecrire.apply(game.settings, a); };
  try {
    for (const u of game.users.contents) regle(u);
    cameras.actualiserCameras();
  } finally { game.settings.set = ecrire; }
  assert.equal(emissions.length, avant);
  assert.equal(ecritures, 0);
  cameras.debrancherCameras();
  assert.equal(m.regles.length, 0, "la règle retirée");
});
const repos = () => new Promise(r => setImmediate(r));

// ------------------------------------------------------------------ deux parties simulées, avec le vrai moteur
// À chaque phase, à chaque villageois changé : la caméra de chaque joueur, calculée par le moteur ; un loup et un villageois de
// même état public ont la même ; la nuit, tous les vivants sont remplacés ; le jour, un vivant ni absent ni muet garde la sienne.
async function partieObservee(options) {
  const C = await import(MOTEUR_CAMERAS.href);
  const vus = { nuits: 0, loupsLaNuit: 0, villageoisLaNuit: 0, morts: 0, jours: 0, absents: 0, silences: 0 };
  const observer = () => {
    const pub = game.lakourLoups ? game.settings.get("lakour-loups", "partie") : null;
    const phase = String(pub?.phase ?? "");
    // Comme quandEtatChange (lakour-loups.mjs) : la règle relue, le moteur actualise ; puis la caméra de chacun, vue du moteur.
    cameras.actualiserCameras();
    const videos = Object.fromEntries(game.users.contents.map(u => [u.id, C.api.video(u.id)]));
    const absents = L0.absentsDuJour(pub ?? {}, Number(pub?.tour) || 0);
    const parEtat = new Map();
    for (const u of game.users.contents) {
      const d = videos[u.id];
      if (u.isGM) { assert.equal(d.partage, true, "le MJ"); continue; }
      const a = villageoisDuMonde().find(x => x.system.joueur === u.id);
      const camp = a ? (roleDe(a)?.system?.camp ?? "") : "";
      if (!phase || ["preparation", "fin"].includes(phase)) { assert.equal(d.partage, true, `${phase} ${u.id}`); continue; }
      if (!a) { assert.equal(d.raison, "spectateur"); continue; }
      if (!a.system.vivant) { vus.morts++; assert.deepEqual([d.partage, d.raison], [false, "mort"], `${phase} ${u.id} mort`); continue; }
      if (phase === "nuit") {
        vus[camp === "meute" ? "loupsLaNuit" : "villageoisLaNuit"]++;
        assert.deepEqual([d.diffuse, d.partage, d.raison], [true, false, "nuit"], `nuit ${u.id} (${camp})`);
        assert.equal(d.image, "modules/lakour-veillees/assets/camera/loup-garou.webp");
      } else if (absents.includes(a.id)) { vus.absents++; assert.equal(d.raison, "absent"); }
      else if (a.system.silence && ["jour", "vote"].includes(phase)) { vus.silences++; assert.equal(d.raison, "silence"); }
      else { vus.jours++; assert.equal(d.partage, true, `${phase} ${u.id} vivant`); }
      // Non-fuite : à état public égal, même caméra, quel que soit le camp.
      const cle = JSON.stringify([a.system.vivant, a.system.silence, absents.includes(a.id)]);
      if (parEtat.has(cle)) assert.deepEqual(d, parEtat.get(cle), `${phase} : deux joueurs de même état public, deux caméras`);
      else parEtat.set(cle, d);
    }
    if (phase === "nuit") vus.nuits++;
  };
  const r = await jouerPartie({ ...options, apresMonde: async () => {
    C.oublierCameras();
    cameras.debrancherCameras();
    game.modules.get("lakour-mj-ia").api.cameras = C.api;
    assert.equal(cameras.poserRegle(), true);
    for (const nom of ["lakourLoups.phase", "lakourLoups.aube", "updateActor"]) Hooks.on(nom, () => observer());
  } });
  cameras.debrancherCameras();
  return { ...r, vus };
}

test("deux parties simulées avec le moteur : la nuit tous les vivants (loups compris), les morts ; le jour, les autres (absents, muets à part)", { skip: moteurAvecCameras ? false : "sous-module lakour-mj-ia sans caméras (moteur avant 0.44) : à remonter" }, async () => {
  const a = await partieObservee({ n: 8, niveau: "classique", graine: "camera-brume" });
  const b = await partieObservee({ n: 10, niveau: "chaos", graine: "camera-chaos" });
  const vus = Object.fromEntries(Object.keys(a.vus).map(k => [k, a.vus[k] + b.vus[k]]));
  assert.ok(a.vainqueur && b.vainqueur, "les deux parties vont au bout");
  assert.ok(vus.nuits >= 2 && vus.loupsLaNuit > 0 && vus.villageoisLaNuit > 0, JSON.stringify(vus));
  assert.ok(vus.morts > 0 && vus.jours > 0, JSON.stringify(vus));
  if (process.env.TRACE_LOUPS) console.log("caméras vues", vus);
});
