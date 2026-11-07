// Doublure de Foundry en mémoire pour le système lakour-loups : acteurs, objets, réglages, socket (avec destinataires et
// identifiant de l'émetteur, comme le serveur v14), chat, hooks.
// Options : le vrai contenu de lakour-veillees (compendiums roles/metiers/batiments résolus par fromUuid, getIndex,
// fetch de compositions.json) et des JOUEURS SIMULÉS qui répondent aux fenêtres de nuit et de vote par le socket du système.
// Les villageois tenus par des compagnons IA (system.compagnon, sans joueur) ne sont pas simulés ici : ils répondent par le
// résolveur du MJ IA (api.resolveurs.compagnon), branché par l'essai.
// Le plateau : des SCÈNES (ajouterScene : la carte du village, avec son plan dans les drapeaux) et leurs JETONS
// (création, mise à jour, déplacements par moveTokens, hooks preUpdateToken / preMoveToken comme dans le navigateur qui
// modifie). Les hooks sont appelés pour de bon (Hooks.on / Hooks.callAll / Hooks.call) ; journalHooks les note tous.
// Utilisée par essais/loups-api.test.mjs, essais/integration-loups.test.mjs (par essais/outils/partie-loups.mjs, que le simulateur
// d'équilibre reprend : essais/outils/simuler-veillees.mjs) et essais/compagnons.test.mjs.
// Le coffre : celui du MJ IA (sous-module modules/lakour-mj-ia, scripts/coffre.js), le vrai, branché comme dans Foundry sur
// game.modules.get("lakour-mj-ia").api.coffre (option moteur, vraie par défaut ; moteur: false = le module coupé).
import { readFileSync, readdirSync } from "node:fs";
import { creerHasard, choisir, melanger } from "../../systems/lakour-loups/logique/hasard.mjs";
import * as L from "../../systems/lakour-loups/logique/index.mjs";
import * as CoffreMoteur from "../../modules/lakour-mj-ia/scripts/coffre.js";

const RACINE = new URL("../../", import.meta.url);
export const FR = JSON.parse(readFileSync(new URL("systems/lakour-loups/lang/fr.json", RACINE), "utf8"));

// ------------------------------------------------------------------ documents
let compteur = 0;
export const nouvelId = () => `id${String(++compteur).padStart(13, "0")}`;
const chemin = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
function appliquer(cible, changements) {
  for (const [k, v] of Object.entries(changements)) {
    if (k.includes(".")) {
      const parties = k.split(".");
      const dernier = parties.pop();
      let o = cible;
      for (const p of parties) o = o[p] ??= {};
      o[dernier] = structuredClone(v);
    } else if (v && typeof v === "object" && !Array.isArray(v) && cible[k] && typeof cible[k] === "object") appliquer(cible[k], v);
    else cible[k] = structuredClone(v);
  }
}

export class Collection extends Map {
  filter(f) { return [...this.values()].filter(f); }
  find(f) { return [...this.values()].find(f); }
  map(f) { return [...this.values()].map(f); }
  some(f) { return [...this.values()].some(f); }
  get contents() { return [...this.values()]; }
}

const DEFAUTS_ROLE = { cle: "", camp: "village", description: "", victoire: "", effet: "", apparence: "", victoireCle: "",
  nuit: { actif: false, ordre: 50, premiereNuitSeulement: false, uneNuitSurDeux: false, cibles: 1, soiMeme: false, invite: "" }, usages: { max: 0, restant: 0 } };

export class FauxObjet {
  constructor(donnees, parent = null) {
    this.id = donnees._id ?? nouvelId();
    this.name = donnees.name; this.type = donnees.type; this.img = donnees.img ?? "icons/svg/item-bag.svg";
    this.system = structuredClone({ ...(donnees.type === "role" ? DEFAUTS_ROLE : { usages: { max: 0, restant: 0 } }), ...(donnees.system ?? {}) });
    if (donnees.type === "role") this.system.nuit = { ...DEFAUTS_ROLE.nuit, ...(donnees.system?.nuit ?? {}) };
    this.parent = parent; this.documentName = "Item";
    this.uuid = parent ? `Actor.${parent.id}.Item.${this.id}` : `Item.${this.id}`;
  }
  async update(c) { appliquer(this, c); return this; }
  async delete() { this.parent?.items.delete(this.id); }
  toObject() { return structuredClone({ _id: this.id, name: this.name, type: this.type, img: this.img, system: this.system }); }
}

export class FauxActeur {
  constructor(d) {
    this.id = nouvelId(); this.name = d.name; this.type = d.type; this.img = d.img ?? "icons/svg/mystery-man.svg";
    this.system = { joueur: "", compagnon: false, vivant: true, revele: false, camp: "village", maison: "", amoureux: "", silence: false, protections: 0, notes: "", ...structuredClone(d.system ?? {}) };
    this.ownership = structuredClone(d.ownership ?? { default: 0 });
    this.flags = structuredClone(d.flags ?? {});
    this.prototypeToken = structuredClone(d.prototypeToken ?? {});
    this.items = new Collection(); this.statuses = new Set(); this.uuid = `Actor.${this.id}`; this.documentName = "Actor";
  }
  get isOwner() { return globalThis.game.user.isGM || this.ownership[globalThis.game.user.id] === 3; }
  async update(c) { appliquer(this, c); globalThis.Hooks.callAll("updateActor", this); return this; }
  async delete() { globalThis.game.actors.delete(this.id); return this; }
  async createEmbeddedDocuments(type, liste) { return liste.map(d => { const o = new FauxObjet(d, this); this.items.set(o.id, o); return o; }); }
  async deleteEmbeddedDocuments(type, ids) { for (const id of ids) this.items.delete(id); }
  async toggleStatusEffect(s, { active }) { if (active) this.statuses.add(s); else this.statuses.delete(s); }
  async getTokenDocument(donnees = {}) {
    const base = { name: this.name, actorId: this.id, actorLink: true, ...structuredClone(this.prototypeToken ?? {}), ...structuredClone(donnees) };
    base.actorId = this.id;
    return { toObject: () => structuredClone(base) };
  }
}

// ------------------------------------------------------------------ scènes et jetons
export class FauxJeton {
  constructor(d, scene) {
    this.id = d._id ?? nouvelId(); this.parent = scene; this.documentName = "Token";
    Object.assign(this, { name: "", actorId: null, x: 0, y: 0, locked: false, alpha: 1, hidden: false, width: 1, height: 1, level: null,
      texture: { src: "", tint: "#ffffff" }, ...structuredClone({ ...d, _id: undefined }) });
    delete this._id;
    this.texture = { src: "", tint: "#ffffff", ...(d.texture ?? {}) };
  }
  get actor() { return globalThis.game.actors.get(this.actorId) ?? null; }
  update(c, o) { return this.parent.updateEmbeddedDocuments("Token", [{ _id: this.id, ...c }], o).then(r => r[0]); }
}

// Un journal du monde (les Chroniques) : pages texte, drapeaux, propriété.
export class FauxJournal {
  constructor(d) {
    this.id = nouvelId(); this.uuid = `JournalEntry.${this.id}`; this.name = d.name; this.flags = structuredClone(d.flags ?? {});
    this.ownership = structuredClone(d.ownership ?? {}); this.pages = new Collection();
    this.ajouter(d.pages ?? []);
  }
  ajouter(pages) { for (const p of pages) { const page = { ...structuredClone(p), id: nouvelId() }; this.pages.set(page.id, page); } }
  getFlag(scope, cle) { return this.flags?.[scope]?.[cle]; }
  async createEmbeddedDocuments(type, pages) { this.ajouter(pages); return pages; }
  async deleteEmbeddedDocuments(type, ids) { for (const id of ids) this.pages.delete(id); return ids; }
}

export class FausseScene {
  constructor({ nom = "Scène", plan = null, module = MODULE_CONTENU, cle = "village-de-brumecombe", obscurite = 0.55, taille = 100 } = {}) {
    this.id = nouvelId(); this.name = nom; this.documentName = "Scene";
    this.flags = plan ? { [module]: { cle, plan: structuredClone(plan) } } : {};
    this.grid = { size: taille }; this.dimensions = { sceneX: 0, sceneY: 0, size: taille };
    this.environment = { darknessLevel: obscurite, darknessLock: false };
    this.initialLevel = { id: "niveau0000000001" };
    this.tokens = new Collection();
    this.journal = { mouvements: [], majs: [], creations: [], suppressions: [], lumieres: [], activations: 0 };
  }
  get active() { return globalThis.game.scenes?.idActive === this.id; }
  getFlag(module, cle) { return this.flags?.[module]?.[cle]; }
  async activate() { globalThis.game.scenes.idActive = this.id; this.journal.activations++; return this; }
  async update(c, options = {}) {
    if ("environment.darknessLevel" in c) { this.environment.darknessLevel = c["environment.darknessLevel"]; this.journal.lumieres.push({ valeur: this.environment.darknessLevel, options }); }
    return this;
  }
  async createEmbeddedDocuments(type, liste) {
    const crees = liste.map(d => { const t = new FauxJeton(d, this); this.tokens.set(t.id, t); return t; });
    this.journal.creations.push(...crees.map(t => t.id));
    return crees;
  }
  async deleteEmbeddedDocuments(type, ids) { for (const id of ids) this.tokens.delete(id); this.journal.suppressions.push(...ids); return ids; }
  // Comme le navigateur qui modifie : preUpdateToken peut refuser (false) ; un changement de x, y passe aussi par preMoveToken.
  async updateEmbeddedDocuments(type, majs, options = {}) {
    const faits = [];
    for (const { _id, ...c } of majs) {
      const t = this.tokens.get(_id);
      if (!t) continue;
      if (globalThis.Hooks.call("preUpdateToken", t, structuredClone(c), options, globalThis.game.user.id) === false) continue;
      if (("x" in c || "y" in c) && globalThis.Hooks.call("preMoveToken", t, { destination: { x: c.x ?? t.x, y: c.y ?? t.y } }, options) === false) continue;
      appliquer(t, c);
      this.journal.majs.push({ id: _id, c: structuredClone(c), options, user: globalThis.game.user.id });
      faits.push(t);
    }
    return faits;
  }
  // Scene#moveTokens de Foundry v14 : { id: { destination: { x, y, action }, constrainOptions, … } }.
  async moveTokens(instructions, options = {}) {
    const r = {};
    for (const [id, ins] of Object.entries(instructions)) {
      const t = this.tokens.get(id);
      const d = ins.destination ?? ins.waypoints?.at(-1) ?? {};
      if (!t) { r[id] = false; continue; }
      const move = { destination: { x: d.x, y: d.y }, method: options.method ?? "api", constrainOptions: ins.constrainOptions, action: d.action };
      if (globalThis.Hooks.call("preUpdateToken", t, { x: d.x, y: d.y }, options, globalThis.game.user.id) === false
        || globalThis.Hooks.call("preMoveToken", t, move, options) === false) { r[id] = false; continue; }
      this.journal.mouvements.push({ id, de: { x: t.x, y: t.y }, vers: { x: d.x, y: d.y }, action: d.action, constrainOptions: structuredClone(ins.constrainOptions ?? {}), options: structuredClone(options) });
      t.x = d.x; t.y = d.y;
      r[id] = true;
    }
    return r;
  }
}

// Une scène dans le monde (la carte du village : plan dans les drapeaux du module de contenu).
export function ajouterScene(options = {}) {
  const sc = new FausseScene(options);
  globalThis.game.scenes.set(sc.id, sc);
  if (options.active) globalThis.game.scenes.idActive = sc.id;
  return sc;
}

// ------------------------------------------------------------------ contenu réel de lakour-veillees (src/)
export const MODULE_CONTENU = "lakour-veillees";
const DOSSIERS_CONTENU = ["roles", "metiers", "batiments"];
// Les tables du narrateur (noms de villageois pour les compagnons IA, rumeurs…), en RollTable.
export const TABLES = readdirSync(new URL(`modules/${MODULE_CONTENU}/src/tables/`, RACINE)).filter(f => f.endsWith(".json")).sort()
  .map(f => JSON.parse(readFileSync(new URL(`modules/${MODULE_CONTENU}/src/tables/${f}`, RACINE), "utf8")));
const lireDossier = nom => {
  const dossier = new URL(`modules/${MODULE_CONTENU}/src/${nom}/`, RACINE);
  return readdirSync(dossier).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(new URL(f, dossier), "utf8")));
};
export const CONTENU = Object.fromEntries(DOSSIERS_CONTENU.map(n => [n, lireDossier(n)]));
export const COMPOSITIONS_BRUTES = readFileSync(new URL(`modules/${MODULE_CONTENU}/assets/compositions.json`, RACINE), "utf8");

// Un compendium : documents, getIndex({ fields }) avec uuid, getDocument.
function fauxCompendium(nom, sources) {
  const collection = `${MODULE_CONTENU}.${nom}`;
  const documents = new Collection();
  for (const s of sources) {
    const doc = new FauxObjet(s);
    doc.uuid = `Compendium.${collection}.Item.${doc.id}`;
    doc.pack = collection;
    documents.set(doc.id, doc);
  }
  return {
    collection, documentName: "Item", metadata: { id: collection, name: nom, type: "Item", packageName: MODULE_CONTENU },
    documents,
    async getIndex({ fields = [] } = {}) {
      const index = new Collection();
      for (const d of documents.values()) {
        const entree = { _id: d.id, uuid: d.uuid, name: d.name, type: d.type, img: d.img };
        for (const f of fields) {
          const v = chemin(d, f);
          if (v === undefined) continue;
          const parties = f.split(".");
          const dernier = parties.pop();
          let o = entree;
          for (const p of parties) o = o[p] ??= {};
          o[dernier] = structuredClone(v);
        }
        index.set(d.id, entree);
      }
      return index;
    },
    async getDocument(id) { return documents.get(id) ?? null; },
    async getDocuments() { return documents.contents; }
  };
}

// uuid -> document : Item.x (monde), Actor.x, Actor.x.Item.y, Compendium.<module>.<pack>.Item.x.
function resoudreUuid(uuid) {
  const p = String(uuid ?? "").split(".");
  if (p[0] === "Item" && p.length === 2) return game.items.get(p[1]) ?? null;
  if (p[0] === "Actor") {
    const a = game.actors.get(p[1]);
    if (p.length === 2) return a ?? null;
    if (p[2] === "Item") return a?.items.get(p[3]) ?? null;
    return null;
  }
  if (p[0] === "Compendium" && p.length === 5) return game.packs?.get(`${p[1]}.${p[2]}`)?.documents.get(p[4]) ?? null;
  return null;
}

// ------------------------------------------------------------------ installation
export let journalHooks, emissions, messages, reglages, erreursHooks = [];
let ecouteursMJ = [], clients = [], enVol = new Set(), erreursSocket = [];
export const erreurs = () => erreursSocket;

// Livraison asynchrone d'un message de socket (comme le réseau) ; calme() attend que tout soit livré et traité.
function livrer(fn) {
  const p = new Promise(r => setImmediate(r)).then(fn).catch(e => { erreursSocket.push(e); });
  enVol.add(p);
  p.finally(() => enVol.delete(p));
  return p;
}
export async function calme() {
  for (let i = 0; i < 1000; i++) {
    await new Promise(r => setImmediate(r));
    if (!enVol.size) return;
    await Promise.allSettled([...enVol]);
  }
  throw new Error("Socket : messages toujours en vol après 1000 tours.");
}

// Un joueur (un autre navigateur) envoie un message au MJ par le socket du système. emetteur : l'identifiant que le
// serveur de Foundry ajoute d'après la session (second argument reçu) ; absent, comme sur un serveur ancien.
export function envoyerAuMJ(canal, message, { emetteur } = {}) {
  for (const e of ecouteursMJ.filter(e => e.canal === canal)) livrer(() => e.fn(structuredClone(message), emetteur));
}
// Un autre navigateur se branche : il reçoit ce que le MJ émet, avec les destinataires (null = tous).
export function brancherClient(fn) { clients.push(fn); }
// Le message est-il livré au navigateur de cet utilisateur ? (comme handleCustomSocket du serveur v14)
export const livreA = (emission, userId) => !emission.recipients || emission.recipients.includes(userId);

// chancePeste : la chance d'une peste noire pour une partie composée d'elle-même (réglage « lakour-loups.chancePeste ») ;
// 0 par défaut, pour que les parties des essais restent reproductibles (la rareté s'éprouve sur L.tirerPeste).
// dernierSouffle : le réglage « lakour-loups.dernierSouffle » (vrai dans Foundry) ; faux par défaut ici, pour que les morts
// simulés qui tentent de voter soient refusés comme avant (ses propres essais l'activent : essais/lot2-*.test.mjs).
// rapide (le simulateur, essais/outils/partie-loups.mjs sans vérification) : un réglage lu est recopié de son JSON (gardé jusqu'à
// l'écriture suivante), comme Foundry qui les range en JSON, au lieu d'un clone structuré à chaque lecture (le quart du temps d'une
// partie) ; les valeurs des réglages du système sont du JSON pur : mêmes parties.
export function installerFoundry({ joueurs = 6, contenu = false, chancePeste = 0, dernierSouffle = false, moteur = true, rapide = false } = {}) {
  compteur = 0;
  journalHooks = []; emissions = []; messages = []; reglages = new Map();
  ecouteursMJ = []; clients = []; enVol = new Set(); erreursSocket = [];
  const users = new Collection();
  const mj = { id: "mj", name: "Meneuse", isGM: true, active: true };
  users.set("mj", mj);
  for (let i = 1; i <= joueurs; i++) users.set(`u${i}`, { id: `u${i}`, name: `Joueur ${i}`, isGM: false, active: true });
  Object.defineProperty(users, "activeGM", { get: () => mj });
  const formater = (cle, d = {}) => {
    const brut = chemin(FR, cle);
    return typeof brut === "string" ? brut.replace(/\{(\w+)\}/g, (_, k) => d[k] ?? `{${k}}`) : cle;
  };
  const items = new Collection();
  globalThis.game = {
    user: mj, users, actors: new Collection(), items, journal: new Collection(), ready: true, system: { id: "lakour-loups" }, world: { id: "brumecombe" },
    i18n: { localize: c => formater(c), format: formater, has: c => typeof chemin(FR, c) === "string" },
    settings: {
      register(id, cle, conf) {
        const valeur = id === "lakour-loups" && cle === "chancePeste" ? chancePeste
          : id === "lakour-loups" && cle === "dernierSouffle" ? dernierSouffle : structuredClone(conf.default);
        reglages.set(`${id}.${cle}`, { valeur, conf });
      },
      get(id, cle) {
        const r = reglages.get(`${id}.${cle}`);
        if (!rapide || r.valeur === undefined) return structuredClone(r.valeur);
        r.json ??= JSON.stringify(r.valeur);
        return JSON.parse(r.json);
      },
      async set(id, cle, v) { const r = reglages.get(`${id}.${cle}`); r.valeur = structuredClone(v); r.json = undefined; r.conf.onChange?.(structuredClone(v)); return v; }
    },
    socket: {
      // Comme le serveur v14 : { recipients } restreint la livraison à ces utilisateurs (noté dans emissions).
      emit: (canal, m, options = {}) => {
        const recipients = Array.isArray(options?.recipients) ? [...options.recipients] : null;
        emissions.push({ canal, ...structuredClone(m), recipients });
        for (const c of clients) livrer(() => c(canal, structuredClone(m), recipients));
      },
      on: (canal, fn) => { ecouteursMJ.push({ canal, fn }); }
    }
  };
  items.fromCompendium = doc => { const d = doc.toObject(); delete d._id; return d; };
  // Le MJ IA : son coffre (réglages du moteur, API comme dans scripts/main.js du moteur).
  CoffreMoteur.oublierCoffre();
  game.modules = new Collection();
  if (moteur) {
    const enregistrer = (cle, scope, type, defaut) => game.settings.register("lakour-mj-ia", cle, { scope, config: false, type, default: defaut });
    for (const cle of ["trousseau", "coffreCarnet", "filsScelles"]) enregistrer(cle, "world", Object, {});
    for (const cle of ["cleCarnet", "partCarnet"]) enregistrer(cle, "client", Object, {});
    for (const cle of ["horloges", "enquetes", "contacts"]) enregistrer(cle, "world", Array, []);
    game.modules.set("lakour-mj-ia", { id: "lakour-mj-ia", active: true, api: { coffre: apiCoffreMoteur() } });
  }
  // Des hooks qui appellent leurs écouteurs (comme Foundry) ; une erreur d'écouteur est notée, sans arrêter les autres.
  const ecouteursHooks = new Map();
  erreursHooks = [];
  const ecouteurs = nom => [...(ecouteursHooks.get(nom) ?? [])];
  globalThis.Hooks = {
    callAll: (nom, ...args) => {
      journalHooks.push({ nom, args });
      for (const e of ecouteurs(nom)) {
        if (e.once) ecouteursHooks.get(nom).delete(e);
        try { const r = e.fn(...args); if (r?.catch) r.catch(err => erreursHooks.push(err)); } catch (err) { erreursHooks.push(err); }
      }
      return true;
    },
    call: (nom, ...args) => {
      journalHooks.push({ nom, args });
      for (const e of ecouteurs(nom)) {
        try { if (e.fn(...args) === false) return false; } catch (err) { erreursHooks.push(err); }
      }
      return true;
    },
    on: (nom, fn) => { if (!ecouteursHooks.has(nom)) ecouteursHooks.set(nom, new Set()); const e = { fn }; ecouteursHooks.get(nom).add(e); return e; },
    once: (nom, fn) => { if (!ecouteursHooks.has(nom)) ecouteursHooks.set(nom, new Set()); const e = { fn, once: true }; ecouteursHooks.get(nom).add(e); return e; }
  };
  const scenes = new Collection();
  scenes.idActive = null;
  Object.defineProperty(scenes, "active", { get: () => scenes.get(scenes.idActive) ?? null });
  game.scenes = scenes;
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }, TOKEN_DISPOSITIONS: { NEUTRAL: 0 },
    TOKEN_DISPLAY_MODES: { NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 } };
  globalThis.Actor = { implementation: { create: async d => { const a = new FauxActeur(d); game.actors.set(a.id, a); return a; } } };
  globalThis.JournalEntry = { implementation: { create: async d => { const j = new FauxJournal(d); game.journal.set(j.id, j); return j; } } };
  globalThis.ChatMessage = { implementation: { create: async m => { messages.push(m); return m; } } };
  globalThis.fromUuid = async uuid => resoudreUuid(uuid);
  globalThis.fromUuidSync = uuid => resoudreUuid(uuid);
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.foundry = {
    utils: { deepClone: o => structuredClone(o), randomID: () => nouvelId(), escapeHTML: s => String(s).replace(/</g, "&lt;"), getRoute: r => `/${r}` },
    applications: {
      api: { ApplicationV2: class { render() {} close() {} get rendered() { return false; } }, HandlebarsApplicationMixin: c => c },
      handlebars: { renderTemplate: async (chemin, d) => `<carte ${d.role}|${d.camp}|${d.meute}|${d.prime}>` },
      ux: { TextEditor: { implementation: { enrichHTML: async h => h } } }
    }
  };
  if (contenu) {
    game.packs = new Collection(DOSSIERS_CONTENU.map(n => [`${MODULE_CONTENU}.${n}`, fauxCompendium(n, CONTENU[n])]));
    const tables = new Collection(TABLES.map(t => [t._id, { ...structuredClone(t), documentName: "RollTable", results: new Collection(t.results.map(r => [r._id, r])) }]));
    game.packs.set(`${MODULE_CONTENU}.tables`, { collection: `${MODULE_CONTENU}.tables`, documentName: "RollTable", documents: tables,
      async getDocuments() { return tables.contents; } });
    // fetch d'un fichier du module de contenu : le vrai fichier du dépôt (compositions et équilibre des rôles).
    const FICHIERS = { "compositions.json": COMPOSITIONS_BRUTES, "equilibre.json": readFileSync(new URL(`modules/${MODULE_CONTENU}/assets/equilibre.json`, RACINE), "utf8") };
    globalThis.fetch = async url => {
      const u = String(url);
      const fichier = Object.keys(FICHIERS).find(f => u.endsWith(`modules/${MODULE_CONTENU}/assets/${f}`));
      if (!fichier) return { ok: false, status: 404, json: async () => { throw new Error(`404 ${u}`); } };
      return { ok: true, status: 200, json: async () => JSON.parse(FICHIERS[fichier]), text: async () => FICHIERS[fichier] };
    };
    // Réglage du MJ IA lu par loups_composer / loups_distribuer (historique des compositions).
    game.settings.register("lakour-mj-ia", "historiqueLoups", { scope: "world", config: false, type: Array, default: [] });
  }
}

// Pour la comptabilité des essais : ce que le MJ actif sait d'un villageois (ses secrets, 0.9.0), lu comme le MJ, quel que soit
// l'utilisateur courant de l'essai. Les documents n'ont plus ni rôle (avant sa révélation), ni camp, ni amoureux, ni protections.
const commeLeMJ = fn => {
  const avant = globalThis.game.user;
  globalThis.game.user = globalThis.game.users.activeGM ?? avant;
  try { return fn(); } finally { globalThis.game.user = avant; }
};
const acteurDe = a => (typeof a === "string" ? globalThis.game.actors.get(a) : a);
const estVillageois = a => acteurDe(a)?.type === "villageois";
// Les fiches du MJ actif : par l'API du système si l'essai l'a posée, sinon dans son réglage client (rangé par monde et compte).
const ficheBrute = a => {
  const id = acteurDe(a)?.id;
  const api = globalThis.game.lakourLoups;
  if (typeof api?.fiche === "function") return commeLeMJ(() => api.fiche(id));
  const s = reglages?.get("lakour-loups.secrets")?.valeur?.brumecombe?.mj;
  const partie = reglages?.get("lakour-loups.partie")?.valeur?.partie;
  const f = s?.partie && s.partie === partie ? s.fiches?.[id] : null;
  return f ? structuredClone(f) : null;
};
globalThis.secretDuMJ = {
  role: a => {
    if (!a) return null;
    const api = globalThis.game.lakourLoups;
    if (typeof api?.roleDe === "function") return commeLeMJ(() => api.roleDe(acteurDe(a)));
    const r = ficheBrute(a)?.role;
    return r ? { id: "", name: r.name, img: r.img, type: "role", system: r.system } : null;
  },
  // Un objet de rôle (pas un villageois) : son camp de départ.
  camp: a => (!a ? "" : estVillageois(a) ? ficheBrute(a)?.camp ?? "" : a.system?.camp ?? ""),
  fiche: a => (a ? ficheBrute(a) : null),
  amoureux: a => (a ? ficheBrute(a)?.amoureux ?? "" : ""),
  protections: a => (a ? ficheBrute(a)?.protections ?? 0 : 0)
};

// L'API du coffre du MJ IA, telle que son main.js la publie (game.modules.get("lakour-mj-ia").api.coffre).
// Les rappels posés sur une API ne servent que tant qu'elle est celle du module installé (une installation de la doublure par
// vérification : les rappels d'un système chargé avant, ou d'une copie mutée, ne répondent plus à sa place).
export function apiCoffreMoteur() {
  const api = {
    etat: () => CoffreMoteur.etatCoffre(),
    chercher: () => CoffreMoteur.chercherCoffre(),
    renouveler: o => CoffreMoteur.renouveler(o),
    exporterSecours: () => CoffreMoteur.exporterSecours(),
    importerSecours: f => CoffreMoteur.importerSecours(f),
    sceller: contenu => CoffreMoteur.scellerPourAutre(contenu),
    scellerEnPartant: contenu => CoffreMoteur.scellerEnPartant(contenu),
    ouvrirScelle: scelle => CoffreMoteur.ouvrirPourAutre(scelle),
    scellerAvec: (contenu, cle) => CoffreMoteur.scellerAvec(contenu, cle),
    siRenouvele: fn => CoffreMoteur.siRenouvele(cle => (enPlace() ? fn(cle) : undefined)),
    siDisponible: fn => CoffreMoteur.siCleDisponible((...a) => (enPlace() ? fn(...a) : undefined))
  };
  const enPlace = () => globalThis.game?.modules?.get?.("lakour-mj-ia")?.api?.coffre === api;
  return api;
}
export { CoffreMoteur };

export function creerObjetMonde(name, type, system) {
  const o = new FauxObjet({ name, type, system });
  game.items.set(o.id, o);
  return o.uuid;
}


// ------------------------------------------------------------------ joueurs simulés
// Ce que les politiques lisent du contenu (Le Pacte, étape 6) : les noms des rôles, l'équilibre (information, protection),
// l'invite de la chasse de la meute, les libellés des camps.
const PAS_DE_FILTRE = () => true;
let cacheContenu = null;
function contenuDesPolitiques() {
  if (!cacheContenu) {
    let equilibre = {};
    try { equilibre = JSON.parse(readFileSync(new URL(`modules/${MODULE_CONTENU}/assets/equilibre.json`, RACINE), "utf8")).roles ?? {}; } catch { equilibre = {}; }
    cacheContenu = { noms: Object.fromEntries(CONTENU.roles.map(r => [r.name, r.system.cle])), equilibre,
      invite: CONTENU.roles.find(r => r.system.cle === "loup-de-brumecombe")?.system.nuit?.invite ?? "" };
  }
  return cacheContenu;
}
const nomsDesRoles = () => contenuDesPolitiques().noms;
const equilibreDesRoles = () => contenuDesPolitiques().equilibre;
const INVITE_MEUTE = () => contenuDesPolitiques().invite;
const NOMS_DES_CAMPS = Object.fromEntries(Object.entries(FR.LAKOUR_LOUPS.Camps ?? {}).map(([cle, libelle]) => [libelle, cle]));

// Chaque joueur est un navigateur branché sur le socket « system.lakour-loups ». Comme le vrai serveur, la doublure ne
// lui livre que ce qui lui est adressé (recipients) ; il répond au MJ actif avec l'identifiant que le serveur ajoute
// (emetteur). Il reçoit ses demandes de nuit (choix, ou mot à écrire pour le Messager), son carnet secret, l'annonce du
// vote (hooks lakourLoups.phase et lakourLoups.voteOuvert), l'aube (lakourLoups.aube : il use alors de ses pouvoirs de jour), la clôture du vote
// (lakourLoups.voteClos : un Juge de paix peut l'annuler) et les morts (lakourLoups.elimination : un mort parle au Puits).
// Choix aléatoires mais reproductibles (graine). Il ne lit que ce que son joueur sait : l'état PUBLIC (réglage monde),
// son rôle, sa meute s'il est loup, les rôles révélés, son carnet.
// Options : mortsVotent (les morts tentent de voter), fraude (un joueur tente de voter ou de répondre à la place d'un
// autre), pouvoirs (probabilité d'user d'un pouvoir de jour possible, 0 = jamais).
// adresse (Le Pacte, étape 6 ; absente : les joueurs au hasard de toujours, mêmes tirages) : de 0 à 1, chaque joueur suit les
// politiques par rôle du système (logique/politiques.mjs) d'après ce qu'il sait — son carnet, le chat public, les rôles révélés et
// ce qui s'est dit au débat (journal.annonces : un villageois adroit dit les loups qu'il a découverts, un loup ment parfois) —, et
// use de son information avec cette probabilité. Ni fraude ni morts qui votent dans ce mode (rien ne s'y vérifie). Le Pacte, étape 6c :
// chacun entend aussi, comme à la table, le narrateur appeler les charmés la nuit (« les charmés, ouvrez les yeux ») : dès lors, tous
// savent qu'un Joueur de vielle joue (charmesAppeles, les nuits d'appel ; la doublure l'entend au hook lakourLoups.reveil du MJ).
export function simulerJoueurs({ graine = "joueurs", canal = "system.lakour-loups", mortsVotent = true, fraude = true, pouvoirs = 0.5, adresse = null } = {}) {
  const h = creerHasard(graine);
  const journal = { reponses: [], bulletins: [], refusAttendus: [], demandes: [], textes: [], secrets: [], jour: [], fuites: [], annonces: [] };
  let dernierVote = "";
  const adroits = adresse !== null && adresse !== undefined;
  if (adroits) { mortsVotent = false; fraude = false; }
  const nuitsDeCharme = new Set();
  if (adroits) globalThis.Hooks.on("lakourLoups.reveil", x => { if (x?.roleCle === "charmes" && x.enCours) nuitsDeCharme.add(etatPublic()?.tour ?? 0); });
  // Ce que chaque joueur sait (0.9.0) : SA fiche (rôle, usages, camp), reçue du MJ par le socket ; sa meute s'il est loup (sa
  // carte de rôle, les nouvelles du carnet) ; les rôles et camps révélés à tous (documents). Jamais le rôle d'un autre.
  const fiches = new Map();   // acteurId -> fiche reçue par son joueur
  const roleRevele = a => a?.items.find(i => i.type === "role") ?? null;
  const roleDe = a => fiches.get(a?.id)?.role ?? roleRevele(a);
  const metierDe = a => a?.items.find(i => i.type === "metier") ?? null;
  const acteurDe = userId => game.actors.find(a => a.type === "villageois" && a.system.joueur === userId);
  const campPublic = a => (a?.system.revele ? a.system.camp : "");
  const meuteDe = userId => {
    const noms = new Set();
    for (const s of journal.secrets.filter(x => x.userId === userId)) {
      const carte = /^<carte [^|]*\|[^|]*\|([^|]*)\|/.exec(s.entree?.html ?? "");
      if (carte) { noms.clear(); for (const n of carte[1].split(", ").filter(Boolean)) noms.add(n); }
      const nouveau = /^(.+?), gens de passage, est des vôtres/.exec(s.texte ?? "");
      if (nouveau) noms.add(nouveau[1]);
    }
    return noms;
  };
  // Pour le joueur userId, l'acteur a est-il un loup ?
  const estLoupPour = (userId, a) => {
    const moi = acteurDe(userId);
    if (!a) return false;
    if (a.id === moi?.id) return fiches.get(moi.id)?.camp === "meute";
    if (campPublic(a) === "meute") return true;
    return fiches.get(moi?.id)?.camp === "meute" && meuteDe(userId).has(a.name);
  };
  const tirer = (liste, n) => melanger(liste, h).slice(0, n);
  const etatPublic = () => game.settings.get("lakour-loups", "partie");
  // Le village vu par le joueur userId : son rôle et les rôles révélés, rien d'autre.
  const aPlatPour = userId => a => {
    const role = a.system.joueur === userId ? roleDe(a) : roleRevele(a);
    return { id: a.id, nom: a.name, vivant: a.system.vivant, revele: a.system.revele, camp: a.system.joueur === userId ? fiches.get(a.id)?.camp ?? "" : campPublic(a),
      maison: a.system.maison, silence: a.system.silence, role: role ? { cle: role.system.cle, usages: { ...role.system.usages } } : null,
      metier: metierDe(a) ? { cle: metierDe(a).system.cle, usages: { ...metierDe(a).system.usages } } : null };
  };
  const envoyer = (message, qui) => envoyerAuMJ(canal, message, { emetteur: qui });

  // ---- les politiques (adresse) : le savoir d'un joueur, d'après ce que son navigateur a reçu et ce qui s'est dit au débat.
  const villageoisDuMonde = () => game.actors.filter(a => a.type === "villageois");
  function savoirPour(userId) {
    const moi = acteurDe(userId);
    const camp = fiches.get(moi?.id)?.camp || "village";
    const tous = villageoisDuMonde();
    const vus = tous.map(a => ({ id: a.id, nom: a.name, vivant: a.system.vivant, revele: a.system.revele, camp: campPublic(a),
      role: (a.id === moi?.id ? roleDe(a) : roleRevele(a))?.system.cle ?? "" }));
    const noms = camp === "meute" ? meuteDe(userId) : new Set();
    const allies = tous.filter(a => noms.has(a.name)).map(a => a.id);
    const amour = fiches.get(moi?.id)?.amoureux;
    const etat = etatPublic();
    const aPlat = tous.map(a => ({ id: a.id, vivant: a.system.vivant }));
    return L.savoirDuJoueur({ moi: moi?.id ?? "", camp, allies: [...allies, ...(amour ? [amour] : [])],
      textes: journal.secrets.filter(s => s.userId === userId).map(s => s.texte), publics: messagesPublics(),
      villageois: vus, gabarits: FR.LAKOUR_LOUPS, nomsDesRoles: nomsDesRoles(), nomsDesCamps: NOMS_DES_CAMPS, annonces: journal.annonces,
      roles: equilibreDesRoles(), registre: etat?.registre ?? [], role: roleDe(moi)?.system.cle ?? "", groupes: etat?.ambigus?.groupes ?? null,
      charmesAppeles: nuitsDeCharme.size, voisins: id => { try { const v = L.voisins(etat, aPlat, id); return [v?.gauche, v?.droite].filter(Boolean); } catch { return []; } } });
  }
  // Le chat public, une fois pour toutes les lectures d'un même instant (seuls les messages qui portent un savoir public).
  let publicsLus = { n: -1, textes: [] };
  function messagesPublics() {
    if (publicsLus.n !== messages.length) {
      publicsLus = { n: messages.length, textes: messages.map(m => String(m.content ?? "")).filter(t => /tombes|cacardent|loup|camp|wolf|geese|graves/i.test(t)) };
    }
    return publicsLus.textes;
  }
  const choixPasses = (acteurId, effet) => journal.reponses.filter(r => r.acteurId === acteurId && r.effet === effet).flatMap(r => r.cibles);
  function choixAdroit(d) {
    const moi = game.actors.get(d.acteurId);
    const role = roleDe(moi);
    const chasse = Boolean(INVITE_MEUTE() && String(d.invite ?? "").endsWith(INVITE_MEUTE()));
    const effet = chasse ? "tuer" : role?.system.effet ?? "";
    return { effet, cibles: L.politiqueDeNuit({ effet, objet: d.objet ?? "", candidats: d.candidats, nombre: d.nombre ?? 1, invite: d.invite, savoir: savoirPour(d.destinataire),
      adresse, hasard: h, roles: equilibreDesRoles(), nomsDesRoles: nomsDesRoles(), deja: choixPasses(d.acteurId, effet), solitaire: role?.system.camp === "solitaire" }) };
  }
  // Le débat : ce que chacun dit tout haut (une fois chaque loup découvert ; un loup ment parfois).
  function debattre(etat) {
    const vivants = villageoisDuMonde().filter(a => a.system.vivant);
    for (const a of vivants.filter(x => x.system.joueur && !x.system.silence)) {
      const dejaDites = journal.annonces.filter(x => x.par === a.id).map(x => x.cible);
      for (const x of L.annoncesDuJoueur({ savoir: savoirPour(a.system.joueur), adresse, hasard: h, dejaDites, vivants: vivants.map(v => v.id) })) {
        journal.annonces.push({ tour: etat?.tour ?? 0, par: a.id, ...x });
      }
    }
  }
  // Le Juge de paix, juste après le dépouillement : il annule s'il sait qu'un condamné est innocent (logique/politiques.mjs).
  function annulerAdroit(etat, elus) {
    for (const a of villageoisDuMonde().filter(x => x.system.joueur && x.system.vivant)) {
      const villageois = villageoisDuMonde().map(aPlatPour(a.system.joueur));
      const p = L.pouvoirsDe({ villageois, etat, acteurId: a.id }).find(x => x.possible && x.pouvoir === "juge-de-paix");
      if (!p || !L.annulerLeVote({ elus, savoir: savoirPour(a.system.joueur), adresse, hasard: h })) continue;
      journal.jour.push({ tour: etat.tour, acteurId: a.id, pouvoir: p.pouvoir, cibles: [] });
      envoyer({ type: "jour", acteurId: a.id, pouvoir: p.pouvoir, cibles: [], texte: "", userId: a.system.joueur }, a.system.joueur);
    }
  }
  // Le débat d'un jour (une fois par tour), juste avant son premier vote : ce que la nuit a appris est dit à temps.
  let dernierDebat = -1;
  function voterAdroit(etat) {
    const v = etat.vote;
    if (dernierDebat !== etat.tour) { dernierDebat = etat.tour; debattre(etat); }
    const vivants = villageoisDuMonde().filter(a => a.system.vivant);
    const humains = vivants.filter(x => x.system.joueur);
    const savoirs = new Map(humains.map(a => [a.id, savoirPour(a.system.joueur)]));
    const unLoup = humains.find(x => savoirs.get(x.id).camp === "meute");
    const proie = unLoup ? L.proieDuVoteDeLaMeute({ candidats: v.candidats, savoir: savoirs.get(unLoup.id), adresse, hasard: h }) : "";
    const public1 = savoirs.get(humains.find(x => savoirs.get(x.id).camp !== "meute")?.id) ?? { menteurs: [] };
    const connus = v.candidats.filter(id => campPublic(game.actors.get(id)) === "meute");
    const revele = new Map(villageoisDuMonde().filter(a => a.system.revele).map(a => [a.id, campPublic(a)]));
    const rumeur = L.rumeurDuJour({ candidats: v.candidats, annonces: journal.annonces, menteurs: public1.menteurs ?? [], hasard: h, adresse, connus,
      fiables: L.fiablesDesAnnonces(journal.annonces, revele) });
    const objet = v.objet === "chapelle" ? "chapelle" : v.objet === "bailli" ? "bailli" : "execution";
    for (const a of humains) {
      const cible = L.politiqueDeVote({ objet, candidats: v.candidats, savoir: savoirs.get(a.id), adresse, hasard: h, place: { rumeur, proie } }) ?? "";
      journal.bulletins.push({ tour: etat.tour, numero: v.numero, votant: a.id, cible });
      envoyer({ type: "vote", votant: a.id, cible, userId: a.system.joueur }, a.system.joueur);
    }
  }

  function choixDeNuit(d) {
    const moi = game.actors.get(d.acteurId);
    const role = roleDe(moi);
    const effet = role?.system.effet ?? "";
    const ids = d.candidats.map(c => c.id);
    const autres = ids.filter(id => id !== moi.id);
    const loup = a => estLoupPour(d.destinataire, a);
    if (loup(moi)) return tirer(autres.filter(id => !loup(game.actors.get(id))), 1);   // un loup vise un non-loup
    switch (effet) {
      case "voir-camp": case "voir-role": case "proteger": case "eclairer": case "voir-role-mort": return tirer(ids, d.nombre);
      case "lien-amour": case "messager": return tirer(ids, d.nombre);
      case "asperger": return ids.includes(moi.id) && h() < 0.25 ? [moi.id] : tirer(autres, 1);
      case "epier": return ids.includes(moi.id) && h() < 0.5 ? [moi.id] : [];
      case "remede": {
        // L'invite lui dit qui la meute a attaqué : souvent elle le sauve, parfois elle empoisonne quelqu'un d'autre.
        // Sans mémoire de ses fioles : au système de refuser une fiole déjà vide.
        const attaques = (/a attaqué (.+?)\. /.exec(d.invite)?.[1] ?? "").split(", ");
        const victimes = d.candidats.filter(c => attaques.includes(c.nom)).map(c => c.id);
        if (victimes.length && h() < 0.6) return tirer(victimes, 1);
        return h() < 0.4 ? tirer(autres.filter(id => !victimes.includes(id)), 1) : [];
      }
      case "echanger-role": return h() < 0.5 ? tirer(ids, 1) : [];
      default: return h() < 0.8 ? tirer(ids, d.nombre) : [];
    }
  }

  function voter(etat) {
    const v = etat.vote;
    const cle = `${v?.numero}`;
    if (!v?.ouvert || dernierVote === cle) return;
    dernierVote = cle;
    if (adroits) return voterAdroit(etat);
    const vivants = game.actors.filter(a => a.type === "villageois" && a.system.vivant);
    // La meute (vue d'un loup joueur : sa carte de rôle) se concerte sur une proie hors de la meute.
    const unLoup = vivants.find(x => x.system.joueur && estLoupPour(x.system.joueur, x));
    const nonLoups = v.candidats.filter(id => !(unLoup && estLoupPour(unLoup.system.joueur, game.actors.get(id))));
    const proieDuJour = choisir(nonLoups, h);                                   // la meute s'est concertée
    const rumeur = choisir(v.candidats, h);                                      // le soupçon qui court au village
    // Loups connus du village : démasqués (lanterne, mort révélée), ou lus dans les cendres par un villageois qui le dit au
    // débat (lu dans SON carnet secret).
    const connus = new Set(v.candidats.filter(id => campPublic(game.actors.get(id)) === "meute"));
    for (const s of journal.secrets) {
      const lecteur = acteurDe(s.userId);
      // Le camp (Loup flaireur, Louvetier, ancienne Liseuse) ou le rôle (la Liseuse : « X est « Loup de Brumecombe », du camp « Meute » »).
      const lu = /Les cendres parlent : (.+?) est (?:« .+? », )?du camp « Meute »/.exec(s.texte ?? "");
      if (!lu || !lecteur?.system.vivant || estLoupPour(s.userId, lecteur)) continue;
      const suspect = game.actors.find(a => a.type === "villageois" && a.name === lu[1]);
      if (suspect && v.candidats.includes(suspect.id)) connus.add(suspect.id);
    }
    const loupsDemasques = [...connus];
    // Seuls les joueurs humains votent par leur navigateur ; les compagnons votent par le résolveur du MJ IA.
    for (const a of vivants.filter(x => x.system.joueur)) {
      let cible;
      const loup = x => estLoupPour(a.system.joueur, x);
      if (v.objet === "chapelle") cible = loup(a) ? choisir(v.candidats.filter(id => loup(game.actors.get(id))), h) ?? rumeur : rumeur;
      else if (loup(a)) cible = proieDuJour && proieDuJour !== a.id ? proieDuJour : choisir(nonLoups.filter(id => id !== a.id), h);
      else if (loupsDemasques.length && h() < 0.85) cible = choisir(loupsDemasques, h);
      else {
        const x = h();
        cible = x < 0.1 ? "" : x < 0.7 && rumeur !== a.id ? rumeur : choisir(v.candidats.filter(id => id !== a.id), h);
      }
      cible ??= "";
      journal.bulletins.push({ tour: etat.tour, numero: v.numero, votant: a.id, cible });
      envoyer({ type: "vote", votant: a.id, cible, userId: a.system.joueur }, a.system.joueur);
    }
    if (mortsVotent) {
      for (const mort of game.actors.filter(a => a.type === "villageois" && !a.system.vivant)) {
        const cible = choisir(v.candidats, h) ?? "";
        journal.refusAttendus.push({ tour: etat.tour, votant: mort.id, cible, raison: "mort" });
        envoyer({ type: "vote", votant: mort.id, cible, userId: mort.system.joueur }, mort.system.joueur);
      }
    }
    const humains = vivants.filter(x => x.system.joueur);
    if (fraude && humains.length >= 2) {
      const [tricheur, victime] = tirer(humains, 2);
      // Il vote au nom d'un autre, sous son propre nom, puis en se faisant passer pour lui (le serveur dit qui il est).
      journal.refusAttendus.push({ tour: etat.tour, votant: victime.id, cible: tricheur.id, raison: "fraude" });
      envoyer({ type: "vote", votant: victime.id, cible: tricheur.id, userId: tricheur.system.joueur }, tricheur.system.joueur);
      envoyer({ type: "vote", votant: victime.id, cible: tricheur.id, userId: victime.system.joueur }, tricheur.system.joueur);
    }
  }

  // Les pouvoirs de jour possibles de ce joueur, vus de son navigateur (état public).
  function usePouvoirs(etat, filtre = PAS_DE_FILTRE) {
    if (!pouvoirs) return;
    for (const a of game.actors.filter(x => x.type === "villageois" && x.system.joueur)) {
      const villageois = game.actors.filter(x => x.type === "villageois").map(aPlatPour(a.system.joueur));
      const possibles = L.pouvoirsDe({ villageois, etat, acteurId: a.id }).filter(p => p.possible && filtre(p));
      // (Le Puits, à la mort, se choisit comme avant : un dernier mot ne change rien à la partie.)
      if (adroits && filtre === PAS_DE_FILTRE) {
        // La politique du jour (logique/politiques.mjs) : le pouvoir et ses cibles d'après ce qu'il sait.
        const choix = possibles.length ? L.politiqueDuJour({ possibles, savoir: savoirPour(a.system.joueur), adresse, hasard: h, pouvoirs }) : null;
        if (!choix) continue;
        const p = possibles.find(x => x.pouvoir === choix.pouvoir);
        const texte = p?.texte ? "Je n'ai rien vu venir dans la brume." : "";
        journal.jour.push({ tour: etat.tour, acteurId: a.id, pouvoir: choix.pouvoir, cibles: choix.cibles });
        envoyer({ type: "jour", acteurId: a.id, pouvoir: choix.pouvoir, cibles: choix.cibles, texte, userId: a.system.joueur }, a.system.joueur);
        continue;
      }
      if (!possibles.length || h() >= pouvoirs) continue;
      const p = choisir(possibles, h);
      const cibles = tirer(p.candidats, p.cibles);
      const texte = p.texte ? "Je n'ai rien vu venir dans la brume." : "";
      journal.jour.push({ tour: etat.tour, acteurId: a.id, pouvoir: p.pouvoir, cibles });
      envoyer({ type: "jour", acteurId: a.id, pouvoir: p.pouvoir, cibles, texte, userId: a.system.joueur }, a.system.joueur);
    }
  }

  brancherClient((c, m, recipients) => {
    if (c !== canal) return;
    // Ce que le serveur livre à chaque joueur : tout s'il n'y a pas de destinataires, sinon les seuls destinataires.
    const pour = userId => !recipients || recipients.includes(userId);
    if (["demande", "annuler", "secret", "carnet", "monVote", "avis", "fiche", "vus", "parole", "salon"].includes(m.type) && !recipients) journal.fuites.push(m);
    if (m.type === "fiche") {
      // Sa fiche, à lui seul : rangée pour son seul joueur (le destinataire doit être celui de l'acteur).
      const a = game.actors.get(m.acteurId);
      if (a && recipients?.length === 1 && recipients[0] === a.system.joueur) {
        if (m.fiche) fiches.set(m.acteurId, structuredClone(m.fiche));
        else fiches.delete(m.acteurId);
      } else journal.fuites.push(m);
      return;
    }
    if (m.type === "demande") {
      const user = game.users.get(m.destinataire);
      if (!user?.active || user.isGM || !pour(m.destinataire)) return;
      journal.demandes.push(m);
      if (m.mode === "texte") {
        const texte = h() < 0.85 ? `Méfie-toi de la maison ${1 + Math.floor(h() * 12)}, on y veille tard.` : "";
        journal.textes.push({ id: m.id, acteurId: m.acteurId, texte });
        envoyer({ type: "reponse", id: m.id, cibles: [], texte, userId: m.destinataire }, m.destinataire);
        return;
      }
      // Fraude : un autre joueur (un mort de préférence) tente de répondre à sa place, avant lui.
      const autres = game.actors.filter(a => a.type === "villageois" && a.system.joueur && a.system.joueur !== m.destinataire);
      const tricheur = fraude ? choisir(autres.filter(a => !a.system.vivant), h) ?? choisir(autres, h) : null;
      if (tricheur && m.candidats.length) {
        journal.refusAttendus.push({ demande: m.id, userId: tricheur.system.joueur, raison: "reponse" });
        envoyer({ type: "reponse", id: m.id, cibles: [m.candidats[0].id], userId: tricheur.system.joueur }, tricheur.system.joueur);
        envoyer({ type: "reponse", id: m.id, cibles: [m.candidats[0].id], userId: m.destinataire }, tricheur.system.joueur);
      }
      const { effet, cibles } = adroits ? choixAdroit(m) : { effet: "", cibles: choixDeNuit(m) };
      journal.reponses.push({ id: m.id, acteurId: m.acteurId, cibles, ...(adroits ? { effet } : {}) });
      envoyer({ type: "reponse", id: m.id, cibles, userId: m.destinataire }, m.destinataire);
    } else if (m.type === "secret") {
      for (const u of recipients ?? []) journal.secrets.push({ userId: u, texte: m.entree?.texte ?? m.entree?.html ?? "", entree: m.entree });
    } else if (m.type === "hook" && m.nom === "lakourLoups.phase" && m.args?.[0] === "vote") voter(m.args[1]);
    // L'élection du Bailli s'ouvre sans changer de phase : on vote à l'annonce du vote ouvert (une fois par vote).
    else if (m.type === "hook" && m.nom === "lakourLoups.voteOuvert") voter(etatPublic());
    else if (m.type === "hook" && m.nom === "lakourLoups.aube") usePouvoirs(etatPublic());
    else if (m.type === "hook" && m.nom === "lakourLoups.voteClos") {
      const r = m.args?.[0];
      if (adroits && r?.objet === "execution" && r.elus?.length) annulerAdroit(etatPublic(), r.elus);
      else if (r?.objet === "execution" && r.elus?.length && h() < 0.6) usePouvoirs(etatPublic(), p => p.pouvoir === "juge-de-paix");
    } else if (m.type === "hook" && m.nom === "lakourLoups.elimination") {
      const mort = game.actors.get(m.args?.[0]?.acteurId);
      if (mort?.system.joueur && h() < 0.7) usePouvoirs(etatPublic(), p => p.pouvoir === "puits");
    }
  });
  // Branchés en pleine partie (page chargée après la distribution) : chacun demande son carnet et sa fiche au MJ (« bonjour »).
  if (etatPublic()?.partie) {
    for (const u of game.users.filter(x => !x.isGM && x.active)) envoyer({ type: "bonjour", userId: u.id }, u.id);
  }
  return { journal, acteurDe, calme, fiches };
}
