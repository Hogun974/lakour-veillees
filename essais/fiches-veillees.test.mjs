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
  const [fiches, prive, secrets, etat] = await Promise.all([m("scripts/apps/fiches.mjs"), m("scripts/prive.mjs"), m("scripts/secrets.mjs"), m("logique/etat.mjs")]);
  const lire = f => readFileSync(join(racine, f), "utf8");
  return {
    fiches, prive, secrets, etat,
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

async function monde(M, { phase = "jour", mortsVoientTout = true, revele = false } = {}) {
  installerFoundry({ joueurs: 4 });
  game.settings.register(ID, "carnet", { default: {} });
  game.settings.register(ID, "mortsVoientTout", { default: mortsVoientTout });
  const creer = async (name, joueur, system = {}) => Actor.implementation.create({ name, type: "villageois",
    system: { joueur, ...system }, ownership: { default: 0, [joueur]: 3 } });
  const bob = await creer(AMOUREUX, "u2");
  const carl = await creer("Carl", "u3", { vivant: false });
  const dora = await creer(CIBLE, "u4");
  const alice = await creer("Alice", "u1", { camp: "solitaire", maison: "3", amoureux: bob.id, protections: 2, revele });
  const [role] = await alice.createEmbeddedDocuments("Item", [{ name: "Rôle-Secret-Alice", type: "role", img: "roles/secret-alice.webp",
    system: { cle: "chasseur-de-primes", camp: "solitaire", description: "<p>POUVOIR-SECRET-ALICE</p>", victoire: "<p>VICTOIRE-SECRETE-ALICE</p>",
      effet: "tuer", nuit: { actif: true, ordre: 33, cibles: 1 }, usages: { max: 2, restant: 1 } } }]);
  await alice.createEmbeddedDocuments("Item", [{ name: "Forgeronne", type: "metier", img: "metiers/forge.webp",
    system: { cle: "forgeron", description: "<p>Elle bat le fer.</p>", jour: { actif: true, cibles: 1, invite: "" }, usages: { max: 3, restant: 3 } } }]);
  await bob.createEmbeddedDocuments("Item", [{ name: "Veilleur", type: "role", system: { cle: "villageois", camp: "village" } }]);
  game.settings.register(ID, "partie", { default: { ...M.etat.etatInitial(), partie: "p1", phase } });
  // Chez le MJ actif, les secrets (la prime d'Alice) ; chez chaque joueur, son carnet (posé par chez()).
  game.settings.register(ID, "secrets", { default: { partie: "p1", primes: { [alice.id]: dora.id } } });
  M.secrets.oublierSecrets();
  M.prive.oublierPrive();
  return { alice, bob, carl, dora, role };
}

// L'utilisateur courant devient userId ; son carnet secret porte la prime de son villageois, s'il en a une.
function chez(M, userId, prime = "") {
  game.user = game.users.get(userId);
  M.prive.oublierPrive();
  if (prime) M.prive.recevoirCarnet({ partie: "p1", prime });
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
    assert.deepEqual(fuites(ctx, [...SECRETS_ALICE, AMOUREUX, CIBLE, PROTEGE, alice.items.find(i => i.type === "role").id]), []);
    assert.equal(ctx.metier?.nom, "Forgeronne", "le métier reste public");
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
    assert.equal(ctx.system.camp, "solitaire");
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
  ["scripts/apps/fiches.mjs", "const vueRole = voitRole && role ?", "const vueRole = role ?", "carte du rôle gardée"],
  ["scripts/apps/fiches.mjs", "campCle: voitRole ? s.camp : \"\",", "campCle: s.camp,", "clé du camp gardée"],
  ["scripts/apps/fiches.mjs", "campLibelle: voitRole ? libelleCamp(s.camp) : \"\",", "campLibelle: libelleCamp(s.camp),", "camp gardé"],
  ["scripts/apps/fiches.mjs", "...(gm ? contexte : publics),", "...contexte,", "document entier retiré"],
  ["scripts/apps/fiches.mjs", "system: gm ? s : {", "system: true ? s : {", "champs publics seulement"],
  ["scripts/apps/fiches.mjs", "gm && s.protections > 0 && insigne(", "s.protections > 0 && insigne(", "protections chez le MJ"],
  ["scripts/apps/fiches.mjs", "const amoureuxNom = (a.isOwner || gm) && s.amoureux ?", "const amoureuxNom = s.amoureux ?", "amoureux gardé"],
  ["scripts/apps/fiches.mjs", "(a.isOwner && s.joueur === game.user.id ? mesSecrets().prime : \"\")", "mesSecrets().prime", "prime à son seul joueur"],
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
