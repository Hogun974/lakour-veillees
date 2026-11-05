// La carte du village qu'on lit : chaque bâtiment a son épingle vers sa page du guide du joueur (visible des joueurs),
// aucune zone ne gêne le plateau (pas de pause, de téléportation ni de texte : le système déplace les jetons en les
// animant), les sons déduits par le moteur restent ; et l'installateur garde les identifiants des journaux (les épingles
// les visent), leur visibilité, et rafraîchit une carte ou un guide d'une version précédente.
// Chaque vérification est rejouée sur des copies mutées (installateur ou contenu fabriqué) : elle doit alors échouer.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { fabriquer } from "../outils/fabriquer-veillees.mjs";
import { BATIMENTS_CARTE, PLATEAU_VILLAGE, pageDuBatiment } from "../modules/lakour-veillees/contenu/village.mjs";
import { GUIDES } from "../modules/lakour-veillees/contenu/guides.mjs";
import { BATIMENTS } from "../modules/lakour-veillees/contenu/batiments.mjs";
import { planVersScene, SONS_AMBIANCE } from "../modules/lakour-mj-ia/scripts/cartes.js";

const ID = "lakour-veillees";
const MAIN = fileURLToPath(new URL(`../modules/${ID}/scripts/main.js`, import.meta.url));
const ICONES = new Set(readFileSync(new URL("../modules/lakour-mj-ia/outils/icones-foundry14.txt", import.meta.url), "utf8").split(/\r?\n/).filter(Boolean));
const DOCS = fabriquer();
const sansBalises = h => String(h ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const enCase = n => ({ x: n.x / 100 - 0.5, y: n.y / 100 - 0.5 });

// ---------------------------------------------------------------- Doublure de Foundry (installateur)

const poser = (o, chemin, v) => {
  const parts = chemin.split("."); let x = o;
  for (const p of parts.slice(0, -1)) x = x[p] ??= {};
  x[parts.at(-1)] = v;
};
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: c => c, DialogV2: {} } },
  utils: {
    mergeObject: (a, b) => { const o = structuredClone(a); for (const [k, v] of Object.entries(b)) poser(o, k, v); return o; },
    setProperty: poser, getRoute: r => r, objectsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  }
};
globalThis.Hooks = { once() {}, on() {} };
globalThis.fetch = async () => ({ json: async () => ({}) });
globalThis.ui = { notifications: { info() {} } };

const embarque = d => ({ ...d, id: d._id, getFlag: (m, k) => d.flags?.[m]?.[k] });
const duCompendium = d => ({
  ...structuredClone(d), id: d._id, getFlag: (m, k) => d.flags?.[m]?.[k], toObject: () => structuredClone(d),
  ...(d.pages ? { pages: d.pages.map(p => ({ ...structuredClone(p), id: p._id, toObject: () => structuredClone(p) })) } : {})
});

function journalDuMonde(d) {
  const j = { ...structuredClone(d), id: d._id, pages: (d.pages ?? []).map(p => ({ ...structuredClone(p), id: p._id, getFlag: (m, k) => p.flags?.[m]?.[k], toObject: () => structuredClone(p) })) };
  j.getFlag = (m, k) => j.flags?.[m]?.[k];
  j.deleteEmbeddedDocuments = async (t, ids) => { j.pages = j.pages.filter(p => !ids.includes(p.id)); };
  j.createEmbeddedDocuments = async (t, pages, o = {}) => {
    j.pages.push(...pages.map((p, i) => { const pid = o.keepId ? p._id : `PageNeuve${i}`.padEnd(16, "0"); return { ...p, _id: pid, id: pid }; }));
  };
  j.updateEmbeddedDocuments = async (t, majs) => {
    for (const { _id, ...maj } of majs) { const p = j.pages.find(x => x.id === _id); for (const [k, v] of Object.entries(maj)) poser(p, k, v); }
  };
  j.update = async maj => { for (const [k, v] of Object.entries(maj)) poser(j, k, v); };
  return j;
}

const CHAMPS = { AmbientSound: "sounds", Region: "regions", Note: "notes" };
function sceneDuMonde(d) {
  const s = { ...structuredClone(d), id: d._id, levels: { contents: [] }, tokens: [] };
  for (const c of Object.values(CHAMPS)) s[c] = (s[c] ?? []).map(embarque);
  s.getFlag = (m, k) => s.flags?.[m]?.[k];
  s.setFlag = async (m, k, v) => { ((s.flags ??= {})[m] ??= {})[k] = v; };
  s.deleteEmbeddedDocuments = async (t, ids) => { s[CHAMPS[t]] = s[CHAMPS[t]].filter(x => !ids.includes(x.id)); };
  s.createEmbeddedDocuments = async (t, docs, o = {}) => {
    s[CHAMPS[t]].push(...docs.map((x, i) => embarque({ ...x, _id: o.keepId && x._id ? x._id : `Neuf${t}${i}`.padEnd(16, "0").slice(0, 16) })));
  };
  return s;
}

// Un monde : journaux et scènes déjà là ; le compendium vient des documents fabriqués. fromCompendium imite Foundry :
// sans keepId l'identifiant part, sans clearOwnership: false la visibilité est remise à « aucun ».
function monde(docs, { journaux = [], scenes = [] } = {}) {
  const compendium = pack => docs.filter(d => d.pack === pack).map(d => duCompendium(d.doc));
  const J = Object.assign(journaux.map(journalDuMonde), {});
  const S = Object.assign(scenes.map(sceneDuMonde), {});
  J.get = id => J.find(x => x.id === id);
  S.get = id => S.find(x => x.id === id);
  J.fromCompendium = (d, o = {}) => {
    const x = d.toObject();
    if (!o.keepId) delete x._id;
    if (o.clearOwnership !== false) x.ownership = { default: 0, mj: 3 };
    return x;
  };
  S.fromCompendium = d => { const x = d.toObject(); delete x._id; return x; };
  let n = 0;
  globalThis.game = {
    packs: { get: nom => ({ [`${ID}.journaux`]: { getDocuments: async () => compendium("journaux") }, [`${ID}.scenes`]: { getDocuments: async () => compendium("scenes") } })[nom] },
    journal: J, scenes: S, actors: [], folders: { find: () => ({ id: "DossierDuMonde00" }) },
    i18n: { localize: k => k, format: k => k }, user: { id: "mj" }, modules: { get: () => null }, settings: { set: async () => {} }
  };
  globalThis.JournalEntry = { implementation: { create: async (d, o = {}) => { const j = journalDuMonde({ ...d, _id: o.keepId ? d._id : `JournalNeuf${n++}`.padEnd(16, "0") }); J.push(j); return j; } } };
  globalThis.Scene = { implementation: { create: async d => { const s = sceneDuMonde({ ...d, _id: `SceneNeuve${n++}`.padEnd(16, "0") }); S.push(s); return s; } } };
  return game;
}

const village = g => g.scenes.find(s => s.getFlag(ID, "cle") === "village-de-brumecombe");
const guide = (g, cle) => g.journal.find(j => j.getFlag(ID, "cle") === cle);
// Les épingles du module dans le monde : chacune vise un journal du monde visible des joueurs et une page qui y existe.
function epinglesDuMonde(g) {
  const notes = village(g).notes.filter(n => n.getFlag(ID, "carte"));
  assert.equal(notes.length, BATIMENTS_CARTE.length, "une épingle par bâtiment");
  for (const n of notes) {
    const j = g.journal.get(n.entryId);
    assert.ok(j, `« ${n.text} » : journal ${n.entryId} absent du monde`);
    assert.ok(j.ownership.default >= 2, `« ${n.text} » : ${j.name} n'est pas visible des joueurs`);
    assert.ok(j.pages.some(p => p.id === n.pageId && p.name === n.text), `« ${n.text} » : page ${n.pageId} absente de ${j.name}`);
  }
  return notes;
}

// ---------------------------------------------------------------- Batterie (installateur M.main, contenu M.docs)

const sceneDe = docs => docs.find(d => d.pack === "scenes").doc;

const VERIFICATIONS = {
  "chaque bâtiment de la carte a son épingle vers sa page du guide du joueur, visible"({ docs }) {
    const s = sceneDe(docs), journaux = docs.filter(d => d.pack === "journaux").map(d => d.doc);
    assert.equal(s.notes.length, BATIMENTS_CARTE.length);
    for (const b of BATIMENTS_CARTE) {
      const objet = docs.find(d => d.pack === "batiments" && d.doc.system.repere === b.nom).doc;
      const notes = s.notes.filter(n => n.text === objet.name);
      assert.equal(notes.length, 1, `${b.nom} : une épingle`);
      const n = notes[0], c = enCase(n);
      assert.ok(c.x >= b.x - 1 && c.x <= b.x + b.l && c.y >= b.y - 1 && c.y <= b.y + b.h, `${b.nom} : épingle en ${c.x},${c.y}, loin du bâtiment`);
      assert.ok(ICONES.has(n.texture.src), `${b.nom} : icône ${n.texture.src} inconnue de Foundry 14`);
      const j = journaux.find(x => x._id === n.entryId);
      assert.ok(j, `${b.nom} : journal ${n.entryId} absent`);
      assert.ok(j.ownership.default >= 2, `${b.nom} : ${j.name} caché aux joueurs`);
      const page = j.pages.find(p => p._id === n.pageId);
      assert.ok(page, `${b.nom} : page ${n.pageId} absente de ${j.name}`);
      assert.equal(page.name, objet.name);
      assert.ok(sansBalises(page.text.content).includes(sansBalises(objet.system.regle).slice(0, 60)), `${b.nom} : la page ne donne pas la règle`);
      assert.ok(sansBalises(page.text.content).includes(sansBalises(objet.system.description)), `${b.nom} : la page ne donne pas la description`);
    }
  },

  "aucune épingle là où le système range les jetons (cimetière, seuils, cercle)"({ docs }) {
    const p = PLATEAU_VILLAGE, c = p.cimetiere;
    for (const n of sceneDe(docs).notes) {
      const { x, y } = enCase(n), cx = x + 0.5, cy = y + 0.5;
      assert.ok(!(cx > c.x && cx < c.x + c.l && cy > c.y && cy < c.y + c.h), `« ${n.text} » sous les morts du cimetière`);
      for (const [maison, s] of Object.entries(p.seuils)) assert.ok(Math.hypot(s.x - cx, s.y - cy) >= 1, `« ${n.text} » sur le seuil de ${maison}`);
      const d = Math.hypot(cx - p.cercle.x, cy - p.cercle.y);
      assert.ok(d < p.cercle.rayonMin - 1 || d > p.cercle.rayon + 1, `« ${n.text} » sur le cercle du jour`);
    }
  },

  "aucune zone : ni pause, ni téléportation, ni texte au passage des jetons"({ docs }) {
    const s = sceneDe(docs);
    assert.ok(!(s.flags[ID].plan.zones ?? []).some(z => ["pause", "teleport", "texte"].includes(z.type)), "zone interdite dans le plan");
    assert.deepEqual(s.regions.flatMap(r => r.behaviors.map(b => b.type)).filter(t => ["pauseGame", "teleportToken", "displayScrollingText"].includes(t)), []);
    assert.equal(s.regions.length, 0);
  },

  "les sons déduits par le moteur restent, plus deux sons d'ambiance au plus"({ docs }) {
    const s = sceneDe(docs), plan = s.flags[ID].plan;
    const { scene: deduite } = planVersScene({ ...plan, sons: [], notes: [] }, { taille: 100, distance: 1.5 });
    const cle = x => JSON.stringify([x.name, x.x, x.y, x.radius, x.path, x.volume]);
    const presents = new Set(s.sounds.map(cle));
    assert.ok(deduite.sounds.length >= 2);
    for (const d of deduite.sounds) assert.ok(presents.has(cle(d)), `son déduit perdu : ${d.name}`);
    assert.ok(s.sounds.length - deduite.sounds.length <= 2, "deux sons de plus au plus");
    for (const x of s.sounds) {
      assert.ok(SONS_AMBIANCE.includes(x.path.split("/").pop().replace(".wav", "")), x.path);
      assert.ok(x.volume <= 0.35, `${x.name} trop fort`);
    }
  },

  async "monde neuf : journaux au même identifiant, visibilité du compendium, épingles valides"({ main, docs }) {
    const g = monde(docs);
    await main.installer();
    for (const d of docs.filter(x => x.pack === "journaux")) {
      const j = guide(g, d.doc.flags[ID].cle);
      assert.equal(j.id, d.doc._id, `${d.doc.name} garde son identifiant`);
      assert.equal(j.ownership.default, d.doc.ownership.default, `${d.doc.name} garde sa visibilité`);
    }
    epinglesDuMonde(g);
    assert.ok(village(g).sounds.every(x => x.getFlag(ID, "carte")) && village(g).sounds.length === sceneDe(docs).sounds.length);
  },

  async "identifiant du guide déjà pris : nouvel identifiant, épingles raccordées"({ main, docs }) {
    const cle = docs.find(d => d.cle === "journaux:guide-du-joueur").doc;
    const g = monde(docs, { journaux: [{ _id: cle._id, name: "Notes du MJ", flags: {}, ownership: { default: 0 }, pages: [] }] });
    await main.installer();
    const j = guide(g, "guide-du-joueur");
    assert.notEqual(j.id, cle._id);
    assert.ok(epinglesDuMonde(g).every(n => n.entryId === j.id));
  },

  async "monde d'une version précédente : guide et carte rafraîchis une fois, ajouts du MJ gardés"({ main, docs }) {
    const gj = docs.find(d => d.cle === "journaux:guide-du-joueur").doc, sc = sceneDe(docs);
    const ancienGuide = { ...structuredClone(gj), _id: "AncienGuide00001", ownership: { default: 0, mj: 3 }, pages: gj.pages.slice(0, 8) };
    const autres = docs.filter(d => d.pack === "journaux" && d.doc !== gj).map(d => ({ ...structuredClone(d.doc), flags: { [ID]: { ...d.doc.flags[ID], version: "0.5.0" } } }));
    const ancienneScene = {
      ...structuredClone(sc), _id: "AncienneScene001", flags: { [ID]: { cle: sc.flags[ID].cle } }, notes: [{ _id: "NoteDuMJ00000001", text: "Cachette", flags: {} }],
      sounds: [...structuredClone(sc.sounds.slice(0, 2)), { _id: "SonDuMJ000000001", name: "cloche", flags: {} }]
    };
    const g = monde(docs, { journaux: [ancienGuide, ...autres], scenes: [ancienneScene] });
    await main.installer();
    const j = guide(g, "guide-du-joueur");
    assert.equal(j.id, "AncienGuide00001", "le guide du monde reste");
    assert.deepEqual(j.pages.map(p => p.id), gj.pages.map(p => p._id), "pages reprises avec leurs identifiants");
    assert.equal(j.ownership.default, 2, "visible des joueurs");
    assert.equal(j.ownership.mj, 3, "droits du MJ gardés");
    const s = village(g);
    assert.equal(g.scenes.length, 1, "pas de seconde carte");
    epinglesDuMonde(g);
    assert.ok(s.notes.some(n => n.id === "NoteDuMJ00000001"), "épingle du MJ gardée");
    assert.ok(s.sounds.some(x => x.id === "SonDuMJ000000001"), "son du MJ gardé");
    assert.equal(s.sounds.length, sc.sounds.length + 1, "aucun son du module en double");
    // Une seconde installation ne touche plus à rien.
    const avant = JSON.stringify([j.pages, s.sounds, s.notes]);
    s.createEmbeddedDocuments = j.createEmbeddedDocuments = async () => { throw new Error("rien à recréer"); };
    await main.installer();
    assert.equal(JSON.stringify([j.pages, s.sounds, s.notes]), avant);
  }
};

// ---------------------------------------------------------------- Mutations

const avecScene = f => docs => docs.map(d => { const c = structuredClone(d); if (c.pack === "scenes") f(c.doc, docs); return c; });
const avecJournal = (cle, f) => docs => docs.map(d => { const c = structuredClone(d); if (c.cle === `journaux:${cle}`) f(c.doc); return c; });
const MUTATIONS = [
  ["contenu", avecScene(s => { s.notes = s.notes.filter(n => n.text !== "La Forge"); }), "épingle de la Forge retirée"],
  ["contenu", avecScene((s, docs) => { const n = docs.find(d => d.cle === "journaux:guide-du-narrateur").doc; s.notes[3].entryId = n._id; s.notes[3].pageId = n.pages[0]._id; }), "épingle vers le guide caché"],
  ["contenu", avecJournal("guide-du-joueur", j => { j.pages = j.pages.filter(p => p.name !== "Le Puits"); }), "page du Puits absente"],
  ["contenu", avecJournal("guide-du-joueur", j => { j.ownership.default = 0; }), "guide du joueur caché"],
  ["contenu", avecScene(s => { s.notes[1].x = 2350; s.notes[1].y = 450; }), "épingle sous les morts du cimetière"],
  ["contenu", avecScene(s => { s.regions.push({ _id: "ZonePause0000001", behaviors: [{ type: "pauseGame" }] }); }), "zone pause"],
  ["contenu", avecScene(s => { s.sounds = s.sounds.filter(x => !x.name.startsWith("forge")); }), "son déduit perdu"],
  ["main.js", "{ keepId: libre, clearOwnership: false }", "{ keepId: libre }", "visibilité du compendium perdue"],
  ["main.js", "const libre = !game.journal.get(j.id);", "const libre = false;", "identifiant du compendium perdu"],
  ["main.js", "entryId: journaux.get(n.entryId) ?? n.entryId", "entryId: n.entryId", "épingles non raccordées"],
  ["main.js", " || duModule.has(d.id)", "", "sons d'avant 0.5.0 en double"],
  ["main.js", "plan.creer, { keepId: true });", "plan.creer);", "pages rafraîchies sans leur identifiant"],
  ["main.js", "\"ownership.default\": source.ownership.default, ", "", "visibilité non réparée au rafraîchissement"],
  ["main.js", "  if (scene.getFlag(ID, \"version\") === VERSION_CONTENU) return false;\n", "", "carte rafraîchie à chaque installation"]
];

const charger = chemin => import(`${pathToFileURL(chemin).href}?${Math.random()}`);

async function chargerMutant(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "veillees-carte-mutant-"));
  const texte = readFileSync(MAIN, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans main.js : ${avant}`);
  writeFileSync(join(dossier, "main.js"), texte.replace(avant, apres));
  // Importés par main.js : fetes.js, mise-a-jour.js et identite.js (qui retombe sur l'identifiant français hors d'un dossier
  // modules/<id>/).
  for (const f of ["fetes.js", "identite.js", "mise-a-jour.js"]) writeFileSync(join(dossier, f), readFileSync(join(MAIN, "..", f), "utf8"));
  try { return await charger(join(dossier, "main.js")); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
  }
  return liste;
}

test("carte épinglée : le module d'origine passe toute la batterie", async () => {
  const e = await echecs({ main: await charger(MAIN), docs: DOCS });
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("carte épinglée : chaque règle cassée est détectée par la batterie", async () => {
  const main = await charger(MAIN);
  const passees = [];
  for (const mutation of MUTATIONS) {
    const [ou, a, b] = mutation, regle = mutation.at(-1);
    const M = ou === "main.js" ? { main: await chargerMutant(a, b), docs: DOCS } : { main, docs: a(DOCS) };
    if (!(await echecs(M)).length) passees.push(`${regle} (${ou})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("épingle vers une cible absente : la fabrication échoue", () => {
  assert.throws(() => pageDuBatiment("Moulin à eau"), /aucun bâtiment n'a ce repère/);
  const sansPuits = GUIDES.map(g => ({ ...g, pages: g.pages.filter(p => p.name !== "Le Puits") }));
  assert.throws(() => pageDuBatiment("Puits", sansPuits), /page « Le Puits » absente du guide du joueur/);
  const cache = GUIDES.map(g => ({ ...g, ownership: { default: 0 } }));
  assert.throws(() => pageDuBatiment("Puits", cache), /pas visible des joueurs/);
  assert.throws(() => pageDuBatiment("Puits", GUIDES.filter(g => g.flags[ID].cle !== "guide-du-joueur")), /guide du joueur absent/);
  assert.deepEqual(Object.keys(pageDuBatiment("Puits", GUIDES, BATIMENTS)).sort(), ["entryId", "pageId", "titre"]);
});

test("versions : VERSION_CONTENU de l'installateur = version de module.json", () => {
  const module = JSON.parse(readFileSync(new URL(`../modules/${ID}/module.json`, import.meta.url), "utf8"));
  assert.match(readFileSync(MAIN, "utf8"), new RegExp(`const VERSION_CONTENU = "${module.version.replace(/\./g, "\\.")}";`));
});
