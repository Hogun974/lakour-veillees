// Doublure de Foundry en mémoire pour le système lakour-loups : acteurs, objets, réglages, socket (avec destinataires et
// identifiant de l'émetteur, comme le serveur v14), chat, hooks.
// Options : le vrai contenu de lakour-veillees (compendiums roles/metiers/batiments résolus par fromUuid, getIndex,
// fetch de compositions.json) et des JOUEURS SIMULÉS qui répondent aux fenêtres de nuit et de vote par le socket du système.
// Les villageois tenus par des compagnons IA (system.compagnon, sans joueur) ne sont pas simulés ici : ils répondent par le
// résolveur du MJ IA (api.resolveurs.compagnon), branché par l'essai.
// Le plateau : des SCÈNES (ajouterScene : la carte du village, avec son plan dans les drapeaux) et leurs JETONS
// (création, mise à jour, déplacements par moveTokens, hooks preUpdateToken / preMoveToken comme dans le navigateur qui
// modifie). Les hooks sont appelés pour de bon (Hooks.on / Hooks.callAll / Hooks.call) ; journalHooks les note tous.
// Utilisée par essais/loups-api.test.mjs, essais/integration-loups.test.mjs et essais/compagnons.test.mjs.
import { readFileSync, readdirSync } from "node:fs";
import { creerHasard, choisir, melanger } from "../../systems/lakour-loups/logique/hasard.mjs";
import * as L from "../../systems/lakour-loups/logique/index.mjs";

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

export function installerFoundry({ joueurs = 6, contenu = false } = {}) {
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
    user: mj, users, actors: new Collection(), items, journal: new Collection(), ready: true, system: { id: "lakour-loups" },
    i18n: { localize: c => formater(c), format: formater, has: c => typeof chemin(FR, c) === "string" },
    settings: {
      register(id, cle, conf) { reglages.set(`${id}.${cle}`, { valeur: structuredClone(conf.default), conf }); },
      get(id, cle) { return structuredClone(reglages.get(`${id}.${cle}`).valeur); },
      async set(id, cle, v) { const r = reglages.get(`${id}.${cle}`); r.valeur = structuredClone(v); r.conf.onChange?.(structuredClone(v)); return v; }
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

export function creerObjetMonde(name, type, system) {
  const o = new FauxObjet({ name, type, system });
  game.items.set(o.id, o);
  return o.uuid;
}


// ------------------------------------------------------------------ joueurs simulés
// Chaque joueur est un navigateur branché sur le socket « system.lakour-loups ». Comme le vrai serveur, la doublure ne
// lui livre que ce qui lui est adressé (recipients) ; il répond au MJ actif avec l'identifiant que le serveur ajoute
// (emetteur). Il reçoit ses demandes de nuit (choix, ou mot à écrire pour le Messager), son carnet secret, l'annonce du
// vote (hook lakourLoups.phase), l'aube (lakourLoups.aube : il use alors de ses pouvoirs de jour), la clôture du vote
// (lakourLoups.voteClos : un Juge de paix peut l'annuler) et les morts (lakourLoups.elimination : un mort parle au Puits).
// Choix aléatoires mais reproductibles (graine). Il ne lit que ce que son joueur sait : l'état PUBLIC (réglage monde),
// son rôle, sa meute s'il est loup, les rôles révélés, son carnet.
// Options : mortsVotent (les morts tentent de voter), fraude (un joueur tente de voter ou de répondre à la place d'un
// autre), pouvoirs (probabilité d'user d'un pouvoir de jour possible, 0 = jamais).
export function simulerJoueurs({ graine = "joueurs", canal = "system.lakour-loups", mortsVotent = true, fraude = true, pouvoirs = 0.5 } = {}) {
  const h = creerHasard(graine);
  const journal = { reponses: [], bulletins: [], refusAttendus: [], demandes: [], textes: [], secrets: [], jour: [], fuites: [] };
  let dernierVote = "";
  const roleDe = a => a?.items.find(i => i.type === "role") ?? null;
  const metierDe = a => a?.items.find(i => i.type === "metier") ?? null;
  const acteurDe = userId => game.actors.find(a => a.type === "villageois" && a.system.joueur === userId);
  const estLoup = a => a?.system.camp === "meute";
  const tirer = (liste, n) => melanger(liste, h).slice(0, n);
  const etatPublic = () => game.settings.get("lakour-loups", "partie");
  const aPlat = a => ({ id: a.id, nom: a.name, vivant: a.system.vivant, revele: a.system.revele, camp: a.system.camp, maison: a.system.maison,
    silence: a.system.silence, role: roleDe(a) ? { cle: roleDe(a).system.cle, usages: { ...roleDe(a).system.usages } } : null,
    metier: metierDe(a) ? { cle: metierDe(a).system.cle, usages: { ...metierDe(a).system.usages } } : null });
  const envoyer = (message, qui) => envoyerAuMJ(canal, message, { emetteur: qui });

  function choixDeNuit(d) {
    const moi = game.actors.get(d.acteurId);
    const role = roleDe(moi);
    const effet = role?.system.effet ?? "";
    const ids = d.candidats.map(c => c.id);
    const autres = ids.filter(id => id !== moi.id);
    if (estLoup(moi)) return tirer(autres.filter(id => !estLoup(game.actors.get(id))), 1);   // un loup vise un non-loup
    switch (effet) {
      case "voir-camp": case "proteger": case "eclairer": case "voir-role-mort": return tirer(ids, d.nombre);
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
    const vivants = game.actors.filter(a => a.type === "villageois" && a.system.vivant);
    const nonLoups = v.candidats.filter(id => !estLoup(game.actors.get(id)));
    const proieDuJour = choisir(nonLoups, h);                                   // la meute s'est concertée
    const rumeur = choisir(v.candidats, h);                                      // le soupçon qui court au village
    // Loups connus du village : démasqués (lanterne, mort révélée), ou lus dans les cendres par un villageois qui le dit au
    // débat (lu dans SON carnet secret).
    const connus = new Set(v.candidats.filter(id => { const a = game.actors.get(id); return a.system.revele && estLoup(a); }));
    for (const s of journal.secrets) {
      const lecteur = acteurDe(s.userId);
      const lu = /Les cendres parlent : (.+?) est du camp « Meute »/.exec(s.texte ?? "");
      if (!lu || !lecteur?.system.vivant || estLoup(lecteur)) continue;
      const suspect = game.actors.find(a => a.type === "villageois" && a.name === lu[1]);
      if (suspect && v.candidats.includes(suspect.id)) connus.add(suspect.id);
    }
    const loupsDemasques = [...connus];
    // Seuls les joueurs humains votent par leur navigateur ; les compagnons votent par le résolveur du MJ IA.
    for (const a of vivants.filter(x => x.system.joueur)) {
      let cible;
      if (v.objet === "chapelle") cible = estLoup(a) ? choisir(v.candidats.filter(id => estLoup(game.actors.get(id))), h) ?? rumeur : rumeur;
      else if (estLoup(a)) cible = proieDuJour && proieDuJour !== a.id ? proieDuJour : choisir(nonLoups.filter(id => id !== a.id), h);
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
  function usePouvoirs(etat, filtre = () => true) {
    if (!pouvoirs) return;
    for (const a of game.actors.filter(x => x.type === "villageois" && x.system.joueur)) {
      const villageois = game.actors.filter(x => x.type === "villageois").map(aPlat);
      const possibles = L.pouvoirsDe({ villageois, etat, acteurId: a.id }).filter(p => p.possible && filtre(p));
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
    if (["demande", "annuler", "secret", "carnet", "monVote", "avis"].includes(m.type) && !recipients) journal.fuites.push(m);
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
      const cibles = choixDeNuit(m);
      journal.reponses.push({ id: m.id, acteurId: m.acteurId, cibles });
      envoyer({ type: "reponse", id: m.id, cibles, userId: m.destinataire }, m.destinataire);
    } else if (m.type === "secret") {
      for (const u of recipients ?? []) journal.secrets.push({ userId: u, texte: m.entree?.texte ?? m.entree?.html ?? "", entree: m.entree });
    } else if (m.type === "hook" && m.nom === "lakourLoups.phase" && m.args?.[0] === "vote") voter(m.args[1]);
    else if (m.type === "hook" && m.nom === "lakourLoups.aube") usePouvoirs(etatPublic());
    else if (m.type === "hook" && m.nom === "lakourLoups.voteClos") {
      const r = m.args?.[0];
      if (r?.objet === "execution" && r.elus?.length && h() < 0.6) usePouvoirs(etatPublic(), p => p.pouvoir === "juge-de-paix");
    } else if (m.type === "hook" && m.nom === "lakourLoups.elimination") {
      const mort = game.actors.get(m.args?.[0]?.acteurId);
      if (mort?.system.joueur && h() < 0.7) usePouvoirs(etatPublic(), p => p.pouvoir === "puits");
    }
  });
  return { journal, acteurDe, calme };
}
