// Les fiches des Veillées (villageois, rôle, métier, bâtiment) et la carte de rôle du carnet secret :
// - chaque variable lue par un gabarit est fournie par son contexte (contexte réel de _prepareContext, sur la doublure) ;
// - chaque data-action a son gestionnaire, et les actions d'avant sont toujours là ;
// - AUCUN SECRET (rôle, camp non révélé, amoureux, protections, prime) n'arrive au contexte d'un joueur qui ne doit pas
//   le voir — pas même dans le document que Foundry joint au contexte ; le propriétaire, le MJ, les morts (si le réglage
//   le permet) et la fin de partie le voient ;
// - la feuille de style reste confinée aux classes du système, avec un thème clair pour chaque jeton du thème sombre.
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois) : elle doit alors échouer.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry } from "./doublures/foundry-loups.mjs";

const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";
const GABARITS = ["fiche-villageois", "fiche-role", "fiche-metier", "fiche-batiment", "carte-role"];

// Le socle des fiches de Foundry v14 (DocumentSheetV2) : ce que fiches.mjs en utilise. Comme Foundry, le contexte de base
// porte le document entier (document, model, source) : à la fiche de ne pas le donner à qui ne doit pas tout voir.
function brancherFiches() {
  class FeuilleDocument {
    constructor({ document } = {}) { this.document = document; }
    get actor() { return this.document; }
    get isEditable() { return game.user.isGM || this.document.isOwner === true; }
    async _prepareContext() {
      const d = this.document;
      return { document: d, model: d, source: d, fields: {}, editable: this.isEditable, user: game.user, rootId: "racine" };
    }
  }
  foundry.applications.sheets = { ActorSheetV2: class extends FeuilleDocument {}, ItemSheetV2: class extends FeuilleDocument {} };
}

async function charger(racine) {
  installerFoundry({ joueurs: 4 });
  brancherFiches();
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [fiches, prive, secrets, etat, fichesLogique] = await Promise.all([m("scripts/apps/fiches.mjs"), m("scripts/prive.mjs"), m("scripts/secrets.mjs"),
    m("logique/etat.mjs"), m("logique/fiches.mjs")]);
  const lire = f => readFileSync(join(racine, f), "utf8");
  return {
    fiches, prive, secrets, etat, fichesLogique,
    gabarits: Object.fromEntries(GABARITS.map(g => [g, lire(`templates/${g}.hbs`)])),
    css: lire("styles/lakour-loups.css"), api: lire("scripts/api.mjs")
  };
}

// ------------------------------------------------------------------ lecture des gabarits et du code
const AIDES = new Set(["if", "unless", "each", "with", "else", "localize", "selectOptions", "checked", "lookup", "eq", "ne", "lt", "gt",
  "and", "or", "not", "concat", "editor", "formInput", "formGroup", "numberFormat", "ifThen", "disabled", "this", "true", "false", "null"]);

// Les noms lus à la racine d'un gabarit (hors {{#each}}, où le contexte devient l'élément parcouru), sous-expressions et
// paramètres nommés compris.
function racines(hbs) {
  const noms = new Set();
  let profondeur = 0;
  for (const [, brut] of hbs.matchAll(/\{\{\{?~?([\s\S]*?)~?\}?\}\}/g)) {
    let b = brut.trim();
    if (b.startsWith("!")) continue;
    if (b.startsWith("/")) { if (b.startsWith("/each")) profondeur--; continue; }
    const each = b.startsWith("#each");
    if (b.startsWith("#")) b = b.slice(1);
    for (const jeton of b.replace(/"[^"]*"|'[^']*'/g, " ").split(/[\s()]+/).filter(Boolean)) {
      const valeur = jeton.includes("=") ? jeton.slice(jeton.indexOf("=") + 1) : jeton;
      const m = valeur.match(/^(@root\.)?([A-Za-z_]\w*)/);
      if (!m || AIDES.has(m[2])) continue;
      if (profondeur === 0 || m[1]) noms.add(m[2]);
    }
    if (each) profondeur++;
  }
  return noms;
}

const actionsDe = hbs => new Set([...hbs.matchAll(/data-action="(\w+)"/g)].map(x => x[1]));

// Les clés d'un objet littéral JS commençant à l'accolade « debut » (chaînes et parenthèses respectées).
function clesObjet(js, debut) {
  const cles = new Set();
  let profondeur = 0, morceau = "", chaine = null;
  for (let i = debut; i < js.length; i++) {
    const c = js[i];
    if (chaine) { if (c === chaine && js[i - 1] !== "\\") chaine = null; if (profondeur > 1) continue; morceau += c; continue; }
    if ("\"'`".includes(c)) { chaine = c; if (profondeur === 1) morceau += c; continue; }
    if ("{[(".includes(c)) { profondeur++; if (profondeur === 1) continue; }
    if ("}])".includes(c)) { profondeur--; if (profondeur === 0) break; }
    if (profondeur === 1 && c === ",") { cles.add(morceau.trim().match(/^[A-Za-z_]\w*/)?.[0]); morceau = ""; continue; }
    if (profondeur === 1) morceau += c;
  }
  cles.add(morceau.trim().match(/^[A-Za-z_]\w*/)?.[0]);
  cles.delete(undefined);
  return cles;
}

// Les sélecteurs d'une feuille de style (règles de @media comprises, @keyframes exclus) ; les blocs de règles par en-tête.
function regles(css) {
  const liste = [];
  const lireBloc = texte => {
    let pos = 0;
    for (;;) {
      const ouvre = texte.indexOf("{", pos);
      if (ouvre < 0) return;
      let p = 1, j = ouvre + 1;
      while (j < texte.length && p) { if (texte[j] === "{") p++; else if (texte[j] === "}") p--; j++; }
      const tete = texte.slice(pos, ouvre).trim(), corps = texte.slice(ouvre + 1, j - 1);
      if (/^@(media|supports|layer)/.test(tete)) lireBloc(corps);
      else if (!tete.startsWith("@")) liste.push({ tete, selecteurs: tete.split(",").map(s => s.trim()).filter(Boolean), corps });
      pos = j;
    }
  };
  lireBloc(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  return liste;
}
const jetons = (corps, prefixe) => new Set([...corps.matchAll(new RegExp(`(${prefixe}[\\w-]+)\\s*:`, "g"))].map(x => x[1]));

// Tout ce qu'un contexte contient (textes, nombres, clés), en suivant objets, tableaux et collections.
function contenu(valeur, vus = new Set(), sortie = []) {
  if (valeur === null || valeur === undefined) return sortie;
  if (typeof valeur !== "object") { sortie.push(String(valeur)); return sortie; }
  if (vus.has(valeur)) return sortie;
  vus.add(valeur);
  for (const [k, v] of valeur instanceof Map ? valeur.entries() : Object.entries(valeur)) { sortie.push(String(k)); contenu(v, vus, sortie); }
  return sortie;
}

// ------------------------------------------------------------------ le village
// Alice (u1) : solitaire secrète, amoureuse de Bob, protégée cette nuit, chasseuse de primes (cible : Dora).
// Bob (u2), Carl (u3, mort), Dora (u4). Les marqueurs ne doivent apparaître que chez qui a le droit de les voir.
const SECRETS_ALICE = ["Rôle-Secret-Alice", "POUVOIR-SECRET-ALICE", "VICTOIRE-SECRETE-ALICE", "secret-alice.webp", "solitaire", "Solitaire"];
const AMOUREUX = "Bob-Amoureux", CIBLE = "Dora-Cible", PROTEGE = "Protégé";

// Le modèle 0.9.0 : le document d'Alice ne porte que le public ; son rôle, son camp, son amoureux et ses protections sont dans
// les secrets du MJ (fiches) ; elle reçoit SA fiche (projection du MJ, logique/fiches.mjs) ; un mort qui voit tout, les vues
// des autres. L'objet de rôle et le camp n'entrent au document qu'une fois révélés (ou la partie finie).
const ROLE_ALICE = { name: "Rôle-Secret-Alice", type: "role", img: "roles/secret-alice.webp",
  system: { cle: "chasseur-de-primes", camp: "solitaire", description: "<p>POUVOIR-SECRET-ALICE</p>", victoire: "<p>VICTOIRE-SECRETE-ALICE</p>",
    effet: "tuer", nuit: { actif: true, ordre: 33, cibles: 1 }, usages: { max: 2, restant: 1 } } };
let FICHES = {};

async function monde(M, { phase = "jour", mortsVoientTout = true, revele = false } = {}) {
  installerFoundry({ joueurs: 4 });
  game.settings.register(ID, "carnet", { default: {} });
  game.settings.register(ID, "mortsVoientTout", { default: mortsVoientTout });
  const creer = async (name, joueur, system = {}) => Actor.implementation.create({ name, type: "villageois",
    system: { joueur, camp: "", ...system }, ownership: { default: 0, [joueur]: 2 } });
  const bob = await creer(AMOUREUX, "u2");
  const carl = await creer("Carl", "u3", { vivant: false });
  const dora = await creer(CIBLE, "u4");
  const publie = revele || phase === "fin";
  const alice = await creer("Alice", "u1", { maison: "3", revele, ...(publie ? { camp: "solitaire" } : {}) });
  if (publie) await alice.createEmbeddedDocuments("Item", [structuredClone(ROLE_ALICE)]);
  await alice.createEmbeddedDocuments("Item", [{ name: "Forgeronne", type: "metier", img: "metiers/forge.webp",
    system: { cle: "forgeron", description: "<p>Elle bat le fer.</p>", jour: { actif: true, cibles: 1, invite: "" }, usages: { max: 3, restant: 3 } } }]);
  // Un objet de rôle du monde, pour la fiche de rôle (gabarits).
  const role = new (Object.getPrototypeOf(alice.items.contents[0]).constructor)(structuredClone(ROLE_ALICE));
  FICHES = {
    [alice.id]: M.fichesLogique.ficheDuRole(ROLE_ALICE, { camp: "solitaire" }),
    [bob.id]: M.fichesLogique.ficheDuRole({ name: "Veilleur", type: "role", system: { cle: "villageois", camp: "village" } }),
    [dora.id]: M.fichesLogique.ficheDuRole({ name: "Villageoise", type: "role", system: { cle: "villageois", camp: "village" } }),
    [carl.id]: M.fichesLogique.ficheDuRole({ name: "Villageois", type: "role", system: { cle: "villageois", camp: "village" } })
  };
  FICHES[alice.id] = { ...FICHES[alice.id], amoureux: bob.id, protections: 2 };
  game.settings.register(ID, "partie", { default: { ...M.etat.etatInitial(), partie: "p1", phase } });
  // Chez le MJ actif, ses secrets (rangés par monde et par compte) : fiches, prime d'Alice ; chez chaque joueur, son carnet (chez()).
  game.settings.register(ID, "secrets", { default: { brumecombe: { mj: { partie: "p1", primes: { [alice.id]: dora.id }, fiches: FICHES } } } });
  M.secrets.oublierSecrets();
  M.prive.oublierPrive();
  return { alice, bob, carl, dora, role };
}

// L'utilisateur courant devient userId ; son navigateur reçoit ce que le MJ actif lui envoie : son carnet (sa prime), SA fiche
// (projection), et, mort qui voit tout, les vues des autres.
function chez(M, userId, prime = "") {
  game.user = game.users.get(userId);
  M.prive.oublierPrive();
  if (userId === "mj") return;
  M.prive.chargerPrive("p1");
  if (prime) M.prive.recevoirCarnet({ partie: "p1", prime });
  const moi = game.actors.find(a => a.system.joueur === userId);
  if (moi && FICHES[moi.id]) M.prive.recevoirFiche({ partie: "p1", acteurId: moi.id, fiche: M.fichesLogique.ficheDuJoueur(FICHES[moi.id]) });
  // Les vues d'un mort (reçues quand le réglage le permettait : un réglage coupé ensuite ne les efface pas de son navigateur).
  if (moi && !moi.system.vivant) {
    M.prive.recevoirVus({ partie: "p1", vus: Object.fromEntries(Object.entries(FICHES).filter(([id]) => id !== moi.id).map(([id, f]) => [id, M.fichesLogique.vueDesMorts(f)])) });
  }
}

const contexteVillageois = (M, acteur) => new M.fiches.FicheVillageois({ document: acteur })._prepareContext({});
const fuites = (ctx, marqueurs) => { const tout = contenu(ctx); return marqueurs.filter(m => tout.some(x => x.includes(m))); };

const VERIFICATIONS = {
  async "un autre joueur ne reçoit ni le rôle, ni le camp, ni l'amoureux, ni les protections, ni la prime"(M) {
    const { alice, dora } = await monde(M);
    chez(M, "u2", dora.id);                       // Bob a sa propre prime : elle ne doit pas s'afficher chez Alice
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.voitRole, false);
    assert.equal(ctx.role, null);
    assert.equal(ctx.campCle, "");
    assert.equal(ctx.campLibelle, "");
    assert.equal(ctx.prime, "");
    assert.equal(ctx.amoureuxNom, "");
    assert.ok(!("document" in ctx) && !("source" in ctx) && !("model" in ctx), "le document entier est joint au contexte");
    assert.deepEqual(fuites(ctx, [...SECRETS_ALICE, AMOUREUX, CIBLE, PROTEGE]), []);
    // Ni le document (aucun objet de rôle, aucun camp), ni le navigateur de Bob (sa fiche seulement) n'ont rien d'Alice.
    assert.equal(alice.items.filter(i => i.type === "role").length, 0);
    assert.equal(alice.system.camp, "");
    assert.deepEqual(Object.keys(M.prive.mesSecrets().fiches), [game.actors.find(a => a.system.joueur === "u2").id]);
    assert.equal(ctx.metier?.nom, "Forgeronne", "le métier reste public");
    assert.equal(ctx.secret, null, "aucun champ secret hors du MJ actif");
  },

  async "le propriétaire voit son rôle, son camp, son amoureux, sa prime ; pas ses protections"(M) {
    const { alice, dora } = await monde(M);
    chez(M, "u1", dora.id);
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.voitRole, true);
    assert.equal(ctx.role?.nom, "Rôle-Secret-Alice");
    assert.match(ctx.role.bulle, /POUVOIR-SECRET-ALICE[\s\S]*VICTOIRE-SECRETE-ALICE/, "le texte en infobulle");
    assert.equal(ctx.role.usages, "1 / 2");
    assert.deepEqual(ctx.role.jetons.map(j => j.plein), [true, false]);
    assert.equal(ctx.campCle, "solitaire");
    assert.equal(ctx.amoureuxNom, AMOUREUX);
    assert.equal(ctx.prime, CIBLE);
    assert.ok(ctx.etats.some(e => e.classe === "amoureux"));
    assert.ok(!("document" in ctx));
    assert.deepEqual(fuites(ctx, [PROTEGE]), [], "les protections sont l'affaire du MJ");
    assert.equal(ctx.role.effet, "", "l'effet automatisé reste chez le MJ");
  },

  async "le MJ voit tout, protections et prime comprises"(M) {
    const { alice } = await monde(M);
    chez(M, "mj");
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.role?.nom, "Rôle-Secret-Alice");
    assert.equal(ctx.prime, CIBLE);
    assert.equal(ctx.amoureuxNom, AMOUREUX);
    assert.ok(ctx.etats.some(e => e.classe === "protege" && e.texte.includes("2")));
    // Les champs secrets du formulaire du MJ (camp, amoureux, protections) : de ses secrets, pas du document.
    assert.deepEqual(ctx.secret, { camp: "solitaire", amoureux: game.actors.find(a => a.name === AMOUREUX).id, protections: 2 });
    assert.equal(ctx.system.camp, "", "le document n'a pas le camp");
    assert.ok(Object.keys(ctx.camps).length === 3 && Object.keys(ctx.autres).length === 4);
    assert.ok(ctx.role.rythme.some(r => r.texte.includes("33")), "l'ordre de réveil, chez le MJ");
  },

  async "rôle révélé : tout le monde voit rôle et camp, jamais l'amoureux, la prime ni les protections"(M) {
    const { alice } = await monde(M, { revele: true });
    chez(M, "u2");
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.role?.nom, "Rôle-Secret-Alice");
    assert.equal(ctx.campCle, "solitaire");
    assert.deepEqual(fuites(ctx, [AMOUREUX, CIBLE, PROTEGE]), []);
    assert.ok(!ctx.role.rythme.some(r => r.texte.includes("33")), "l'ordre de réveil reste chez le MJ");
  },

  async "un mort voit les rôles si le réglage le permet, sinon rien"(M) {
    let { alice } = await monde(M, { mortsVoientTout: true });
    chez(M, "u3");
    assert.equal((await contexteVillageois(M, alice)).role?.nom, "Rôle-Secret-Alice");
    ({ alice } = await monde(M, { mortsVoientTout: false }));
    chez(M, "u3");
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.role, null);
    assert.deepEqual(fuites(ctx, SECRETS_ALICE), []);
  },

  async "fin de partie : les rôles sont dévoilés à tous"(M) {
    const { alice } = await monde(M, { phase: "fin" });
    chez(M, "u4");
    const ctx = await contexteVillageois(M, alice);
    assert.equal(ctx.role?.nom, "Rôle-Secret-Alice");
    assert.equal(ctx.campLibelle, "Solitaire");
  },

  async "chaque variable lue par les gabarits des fiches est fournie par le contexte"(M) {
    const manque = [];
    const verifier = (nom, ctx) => { for (const r of racines(M.gabarits[nom])) if (!(r in ctx)) manque.push(`${nom} (${game.user.id}) : ${r}`); };
    const { alice, role } = await monde(M);
    for (const u of ["mj", "u1", "u2"]) {
      chez(M, u);
      verifier("fiche-villageois", await contexteVillageois(M, alice));
    }
    const metier = alice.items.find(i => i.type === "metier");
    const batiment = new (Object.getPrototypeOf(role).constructor)({ name: "Le Moulin", type: "batiment", system: { cle: "moulin", description: "", regle: "", repere: "M", effet: "" } });
    for (const u of ["mj", "u1"]) {
      chez(M, u);
      verifier("fiche-role", await new M.fiches.FicheRole({ document: role })._prepareContext({}));
      verifier("fiche-metier", await new M.fiches.FicheMetier({ document: metier })._prepareContext({}));
      verifier("fiche-batiment", await new M.fiches.FicheBatiment({ document: batiment })._prepareContext({}));
    }
    assert.deepEqual(manque, []);
    assert.ok(racines(M.gabarits["fiche-villageois"]).has("etats"), "lecture des gabarits ratée");
  },

  "la carte de rôle ne lit que ce que l'envoi (api.mjs) lui donne"(M) {
    const debut = M.api.indexOf("{", M.api.indexOf("templates/carte-role.hbs`"));
    const fournies = clesObjet(M.api, debut);
    assert.ok(fournies.has("acteur") && fournies.has("prime"), "lecture de l'envoi ratée");
    assert.deepEqual([...racines(M.gabarits["carte-role"])].filter(n => !fournies.has(n)), []);
  },

  "chaque data-action a son gestionnaire ; les actions d'avant sont gardées"(M) {
    const natives = new Set(["editImage"]);
    const villageois = new Set([...Object.keys(M.fiches.FicheVillageois.DEFAULT_OPTIONS.actions ?? {}), ...natives]);
    const vues = actionsDe(M.gabarits["fiche-villageois"]);
    assert.deepEqual([...vues].filter(a => !villageois.has(a)), []);
    for (const a of ["ouvrirObjet", "retirerObjet", "editImage"]) assert.ok(vues.has(a), `action perdue : ${a}`);
    for (const g of ["fiche-role", "fiche-metier", "fiche-batiment"]) {
      const a = actionsDe(M.gabarits[g]);
      assert.deepEqual([...a], ["editImage"], g);
    }
    assert.equal(actionsDe(M.gabarits["carte-role"]).size, 0, "la carte du carnet n'a pas d'action");
  },

  "la feuille de style est confinée au système, avec un thème clair complet"(M) {
    const toutes = regles(M.css);
    assert.ok(toutes.length > 100, "lecture de la feuille ratée");
    const hors = toutes.flatMap(r => r.selecteurs).filter(s => !/\.lakour-loups\b|\.loups-|#lakour-loups|\.lakour-|\.carte-role/.test(s));
    assert.deepEqual(hors, [], "sélecteurs hors du système");
    const sombre = toutes.find(r => r.tete.replace(/\s+/g, " ") === ".lakour-loups.loups-fiche, .lakour-loups.carte-role");
    const clair = toutes.find(r => r.selecteurs.includes("body.theme-light .application.lakour-loups.loups-fiche:not(.theme-dark)") && /--lf-/.test(r.corps));
    assert.ok(sombre && clair, "jetons sombres ou clairs introuvables");
    for (const s of [".application.lakour-loups.loups-fiche.theme-light", "body.theme-light .lakour-loups.carte-role"]) assert.ok(clair.selecteurs.includes(s), s);
    const manquants = [...jetons(sombre.corps, "--lf-")].filter(j => j !== "--lf-teinte" && !jetons(clair.corps, "--lf-").has(j));
    assert.deepEqual(manquants, [], "jetons sans valeur claire");
    const base = toutes.find(r => r.tete === ".lakour-loups");
    const couleurs = [...jetons(base.corps, "--loups-")].filter(j => !["--loups-titre", "--loups-rayon"].includes(j));
    assert.deepEqual(couleurs.filter(j => !jetons(clair.corps, "--loups-").has(j)), [], "couleurs sans valeur claire");
  }
};

const MUTATIONS = [
  ["scripts/apps/fiches.mjs", "const voitRole = etat.phase === \"fin\" || roleVisible(a);", "const voitRole = true;", "rôle caché aux autres"],
  ["scripts/apps/fiches.mjs", "const voitRole = etat.phase === \"fin\" || roleVisible(a);", "const voitRole = false;", "rôle montré au propriétaire"],
  ["scripts/apps/fiches.mjs", "campCle: voitRole ? camp : \"\",", "campCle: campDe(a) || \"village\",", "clé du camp gardée"],
  ["scripts/apps/fiches.mjs", "campLibelle: voitRole ? libelleCamp(camp) : \"\",", "campLibelle: libelleCamp(camp || \"village\"),", "camp gardé"],
  ["scripts/apps/fiches.mjs", "...(gm ? contexte : publics),", "...contexte,", "document entier retiré"],
  ["scripts/apps/fiches.mjs", "secret: estMJActif() ? { camp, amoureux, protections } : null,", "secret: { camp, amoureux, protections: protectionsDe(a) || 2 },", "champs secrets chez le MJ actif seulement"],
  ["scripts/apps/fiches.mjs", "(sienne ? mesSecrets().prime : \"\")", "mesSecrets().prime", "prime à son seul joueur"],
  // Les secrets d'un villageois, chez un joueur : sa fiche seulement (donnees.mjs, ficheConnue) — pas celle d'un autre.
  ["scripts/donnees.mjs", "const f = acteur.system?.joueur && acteur.system.joueur === game.user?.id ? p.fiches?.[acteur.id] : p.vus?.[acteur.id];",
    "const f = Object.values(p.fiches ?? {})[0] ?? p.vus?.[acteur.id];", "sa fiche à lui seul"],
  // Un mort voit tout : le rôle des autres (vues) ne sert que si le réglage le permet encore (roleVisible).
  ["scripts/donnees.mjs", "return Boolean(moi && !moi.system.vivant && game.settings.get(ID, \"mortsVoientTout\")", "return Boolean(moi && !moi.system.vivant", "mortsVoientTout respecté"],
  // Le joueur n'est plus propriétaire : son rôle se voit par son joueur (system.joueur), pas par la propriété du document.
  ["scripts/donnees.mjs", "if (user.isGM || acteur.system.revele || (acteur.system.joueur && acteur.system.joueur === user.id)) return true;",
    "if (user.isGM || acteur.system.revele || acteur.isOwner) return true;", "rôle vu par son joueur"],
  ["scripts/apps/fiches.mjs", "effet: gm ? libelleEffet(objet.system.effet) : \"\"", "effet: libelleEffet(objet.system.effet)", "effet chez le MJ"],
  ["scripts/apps/fiches.mjs", "marque(\"nuit\", \"fa-moon\", gm ? t(", "marque(\"nuit\", \"fa-moon\", true ? t(", "ordre de réveil chez le MJ"],
  ["scripts/apps/fiches.mjs", "      etats,\n", "", "insignes d'état fournis"],
  ["scripts/apps/fiches.mjs", "...usagesDe(i), rythme: rythmeDe(i, gm),", "rythme: rythmeDe(i, gm),", "usages des objets fournis"],
  ["scripts/apps/fiches.mjs", "actions: { ouvrirObjet: FicheVillageois.#ouvrirObjet,", "actions: { ouvrir: FicheVillageois.#ouvrirObjet,", "action ouvrirObjet"],
  ["templates/fiche-villageois.hbs", "{{joueurNom}}", "{{nomDuJoueur}}", "variable du gabarit fournie"],
  ["templates/fiche-villageois.hbs", "data-action=\"retirerObjet\" data-item-id=\"{{role.id}}\"", "data-action=\"jeter\" data-item-id=\"{{role.id}}\"", "action sans gestionnaire"],
  ["templates/carte-role.hbs", "{{acteur}}", "{{acteurNom}}", "carte lue d'après l'envoi"],
  ["styles/lakour-loups.css", "/* ------------------------------------------------------------------ fiches */", ".window-content { color: red; }\n/* fiches */", "style confiné"],
  ["styles/lakour-loups.css", "  --lf-coeur: #a8385a;\n", "", "thème clair complet"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fiches-mutant-"));
  cpSync(SYSTEME, dossier, { recursive: true });
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

test("fiches : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("fiches : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
