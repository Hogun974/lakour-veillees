// Essais du contenu de lakour-veillees : rôles, métiers, bâtiments et villageois conformes au contrat
// (docs/loups-contrat.md) : camps, clés d'effet connues, ordres de nuit cohérents, repères, module.json.
// Chaque règle est vérifiée sur le vrai contenu, puis sur des copies cassées (mutations).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fabriquer, verifierDocuments, TYPE_PACK } from "../outils/fabriquer-veillees.mjs";
import { CAMPS, EFFETS, ORDRE_MEUTE, VICTOIRES, role, metier, batiment } from "../modules/lakour-veillees/contenu/aides.mjs";

const M = "lakour-veillees";
const docs = fabriquer();
const du = pack => docs.filter(d => d.pack === pack).map(d => d.doc);
const roles = du("roles"), metiers = du("metiers"), batiments = du("batiments");
const parCle = cle => roles.find(r => r.system.cle === cle);

// Copie profonde des documents fabriqués, avec une modification sur le document de clé donnée.
const mute = (cle, f) => docs.map(d => {
  const c = structuredClone(d);
  if (c.cle === cle) f(c.doc);
  return c;
});
const attendre = (liste, motif) => {
  const erreurs = verifierDocuments(liste);
  assert.ok(erreurs.some(e => motif.test(e)), `${motif} attendu, obtenu : ${erreurs.join(" ; ") || "aucune erreur"}`);
};

test("le contenu fabriqué est conforme au contrat", () => {
  assert.deepEqual(verifierDocuments(docs), []);
});

test("une quarantaine de rôles plus le villageois : meute, village et solitaires, clés uniques", () => {
  // (dont les trois Gens de passage, qui n'entrent qu'en cours de partie, et les onze rôles du Village du Pacte, étape 3a)
  assert.ok(roles.length >= 40 && roles.length <= 60, `${roles.length} rôles`);
  const parCamp = Object.groupBy(roles, r => r.system.camp);
  assert.deepEqual(Object.keys(parCamp).sort(), [...CAMPS].sort());
  assert.ok(parCamp.meute.length >= 5 && parCamp.solitaire.length >= 4 && parCamp.village.length >= 12);
  assert.equal(new Set(roles.map(r => r.system.cle)).size, roles.length);
  const v = parCle("villageois");
  assert.ok(v && !v.system.nuit.actif && v.system.effet === "" && v.system.camp === "village");
  for (const r of roles) {
    assert.equal(r.type, "role");
    assert.ok(r.system.description.length > 60, `${r.name} : pouvoir trop court`);
    assert.equal(r.flags[M].cle, r.system.cle);
  }
});

test("clés d'effet : toutes connues du contrat, et chaque grand mécanisme du plan est représenté", () => {
  const utilisees = new Set([...roles, ...metiers, ...batiments].map(d => d.system.effet).filter(Boolean));
  for (const e of utilisees) assert.ok(EFFETS.includes(e), e);
  for (const e of ["tuer", "proteger", "voir-camp", "voir-role-mort", "eclairer", "silence", "vote-double", "annuler-vote", "remede",
    "lien-amour", "echanger-role", "mordre", "emporter", "asperger", "epier", "messager", "voir-actif"]) {
    assert.ok(utilisees.has(e), `aucun rôle n'utilise ${e}`);
  }
});

test("ordres de nuit : meute groupée à 40, protections avant, réactions après, Fossoyeur en dernier", () => {
  const actifs = roles.filter(r => r.system.nuit.actif);
  const o = cle => parCle(cle).system.nuit.ordre;
  assert.equal(o("loup-de-brumecombe"), ORDRE_MEUTE);
  for (const r of roles.filter(x => x.system.camp === "meute")) assert.ok(r.system.nuit.actif && r.system.nuit.ordre >= ORDRE_MEUTE, r.name);
  assert.ok(o("entremetteuse") < o("garde-du-pont") && o("garde-du-pont") < ORDRE_MEUTE);
  assert.ok(o("gardienne-des-cles") < ORDRE_MEUTE && o("veilleuse-de-lanterne") < ORDRE_MEUTE);
  assert.ok(o("louve-mere") > ORDRE_MEUTE && o("herboriste") > ORDRE_MEUTE);
  // Le Pacte, étape 5 : l'ordre d'appel du livre — elle épie pendant la chasse, juste après le choix de la meute.
  assert.ok(o("enfant-de-la-brume") > ORDRE_MEUTE && o("enfant-de-la-brume") < o("louve-mere"), "l'enfant épie pendant la chasse");
  assert.equal(Math.max(...actifs.map(r => r.system.nuit.ordre)), o("fossoyeur"));
  assert.ok(parCle("entremetteuse").system.nuit.premiereNuitSeulement);
  assert.ok(parCle("loup-affame").system.nuit.tantQueMeuteEntiere && !parCle("loup-affame").system.nuit.uneNuitSurDeux, "le Loup affamé : chaque nuit, tant que la meute est entière");
  assert.equal(parCle("herboriste").system.nuit.cibles, 2, "deux fioles la même nuit");
  assert.equal(parCle("liseuse-de-cendres").system.effet, "voir-role", "la Liseuse lit le rôle");
  for (const r of actifs) assert.ok(r.system.nuit.invite.endsWith("?") || r.system.nuit.invite.endsWith("."), `${r.name} : invite`);
  // Les rôles de jour n'ont aucun réglage de nuit.
  for (const cle of ["sonneur", "juge-de-paix", "conteuse", "braconniere", "revenant", "villageois"]) assert.equal(parCle(cle).system.nuit.actif, false, cle);
});

test("solitaires : chacun a sa condition de victoire ; les autres n'en ont pas (sauf le Loup pâle, qui ne gagne pas avec la meute)", () => {
  for (const r of roles) {
    if (r.system.camp === "solitaire" || r.system.cle === "loup-pale") assert.ok(r.system.victoire.length > 30, r.name);
    else assert.equal(r.system.victoire, "", r.name);
  }
});

test("14 métiers publics et 10 bâtiments, avec règle et repère", () => {
  assert.equal(metiers.length, 14);
  for (const m of metiers) {
    assert.equal(m.type, "metier");
    assert.ok(m.system.jour.actif && m.system.jour.invite, m.name);
    assert.ok(m.system.usages.max >= 1);
  }
  assert.equal(batiments.length, 10);
  for (const b of batiments) {
    assert.equal(b.type, "batiment");
    assert.ok(b.system.regle.length > 40 && b.system.repere, b.name);
  }
});

test("villageois non joués : acteurs « villageois » du contrat, figurants nommés", () => {
  const acteurs = du("villageois");
  assert.ok(acteurs.length >= 5);
  for (const a of acteurs) {
    assert.equal(a.type, "villageois");
    assert.deepEqual(Object.keys(a.system).sort(), ["amoureux", "camp", "joueur", "maison", "notes", "protections", "revele", "silence", "vivant"]);
    assert.equal(a.system.joueur, "");
  }
});

test("module.json : système lakour-loups, compendiums du contrat, sources fabriquées", () => {
  const mod = JSON.parse(readFileSync(`modules/${M}/module.json`, "utf8"));
  assert.equal(mod.id, M);
  assert.deepEqual(mod.relationships.systems.map(s => s.id), ["lakour-loups"]);
  assert.deepEqual(Object.fromEntries(mod.packs.map(p => [p.name, p.type])), TYPE_PACK);
  for (const p of mod.packs) {
    if (["Item", "Actor"].includes(p.type)) assert.equal(p.system, "lakour-loups", p.name);
    for (const d of docs.filter(x => x.pack === p.name)) assert.ok(existsSync(`modules/${M}/src/${p.name}/${d.cle.split(":")[1]}.json`), `${d.cle} non fabriqué`);
  }
  assert.ok(mod.esmodules.includes("scripts/main.js"));
  const fr = JSON.parse(readFileSync(`modules/${M}/lang/fr.json`, "utf8")), en = JSON.parse(readFileSync(`modules/${M}/lang/en.json`, "utf8"));
  assert.deepEqual(Object.keys(fr.LAKOURVEIL).sort(), Object.keys(en.LAKOURVEIL).sort());
  const sources = readFileSync(`modules/${M}/scripts/main.js`, "utf8") + readFileSync(`modules/${M}/templates/installation.hbs`, "utf8");
  for (const cle of sources.match(/LAKOURVEIL\.[A-Za-z]+/g)) assert.ok(cle.split(".")[1] in fr.LAKOURVEIL, cle);
});

test("installateur : monde lakour-loups seulement, guides et scène importés, plans recopiés, bouton dans les réglages", () => {
  const main = readFileSync(`modules/${M}/scripts/main.js`, "utf8");
  assert.match(main, /const SYSTEME = "lakour-loups"/);
  for (const motif of [/journaux`\)\.getDocuments/, /scenes`\)\?\.getDocuments/, /plans\.json/, /registerMenu/, /lakourStyleVisuel/, /cheminSelonStyle/]) assert.match(main, motif);
});

test("extensions du système : apparence (Loup déguisé vu village, Louvetier vu meute) et victoireCle des solitaires", async () => {
  const { VICTOIRES: VICTOIRES_SYSTEME } = await import("../systems/lakour-loups/logique/constantes.mjs");
  const { apparenceDe } = await import("../systems/lakour-loups/logique/resolution.mjs");
  const { victoireCleDe } = await import("../systems/lakour-loups/logique/victoire.mjs");
  assert.deepEqual(VICTOIRES, VICTOIRES_SYSTEME, "mêmes clés de victoire que le système");
  const attendues = { revenant: "execute", pyromane: "dernier-survivant", "dame-du-gue": "dernier-survivant", "chasseur-de-primes": "cible-executee", colporteur: "",
    // Le Pacte, étape 3b : les solitaires du livre et le Loup pâle.
    "feu-follet": "premier-tour", "joueur-de-vielle": "tous-charmes", illumine: "autre-groupe", "loup-pale": "seul-survivant" };
  const apparences = { "loup-deguise": "village", louvetier: "meute" };
  for (const r of roles) {
    const s = r.system;
    assert.equal(s.apparence, apparences[s.cle] ?? "", `${r.name} : apparence`);
    assert.equal(s.victoireCle, attendues[s.cle] ?? "", `${r.name} : victoireCle`);
    // Le système lit bien ces champs : vision et victoire.
    const v = { camp: s.camp, role: { cle: s.cle, apparence: s.apparence, victoireCle: s.victoireCle } };
    assert.equal(apparenceDe(v), apparences[s.cle] ?? s.camp, r.name);
    assert.equal(victoireCleDe(v.role), attendues[s.cle] ?? "", r.name);
  }
});

test("conventions du système dans les textes : poison sur un autre que la victime, embrasement en se désignant", () => {
  assert.match(parCle("herboriste").system.description, /n'importe qui d'autre/);
  assert.match(parCle("herboriste").system.nuit.invite, /quelqu'un d'autre pour l'empoisonner/);
  assert.match(parCle("pyromane").system.description, /tu te désignes toi-même/);
  assert.ok(parCle("pyromane").system.nuit.soiMeme);
});

test("automatisation de bout en bout : chaque métier a son pouvoir de jour dans le système, chaque effet de rôle est appliqué", async () => {
  const { POUVOIRS_JOUR } = await import("../systems/lakour-loups/logique/jour.mjs");
  const { EFFETS_AUTOMATISES } = await import("../systems/lakour-loups/logique/constantes.mjs");
  for (const m of metiers) assert.equal(POUVOIRS_JOUR[m.system.cle]?.source, "metier", `${m.name} : pouvoir de jour inconnu du système`);
  for (const m of metiers) assert.equal(POUVOIRS_JOUR[m.system.cle].cibles, m.system.jour.cibles, `${m.name} : cibles`);
  for (const r of roles.filter(x => x.system.effet)) {
    assert.ok(EFFETS_AUTOMATISES.includes(r.system.effet) || POUVOIRS_JOUR[r.system.cle]?.source === "role", `${r.name} : effet ${r.system.effet} non appliqué`);
  }
});

test("nouveaux visages (0.6.0) : jeton, poids, composition prête, fiche au guide du joueur, consignes au narrateur", async () => {
  const { NOUVEAUX_ROLES: TOUS, NOUVEAUX_METIERS, ROLES_DU_PACTE, ROLES_DU_PACTE_3B, ROLES_DU_PACTE_9 } = await import("../modules/lakour-veillees/contenu/guides.mjs");
  // Les rôles du Pacte (étapes 3a et 3b) ont leurs propres essais (pacte-village-*, pacte-ambigus-*) : pas encore de composition prête.
  const NOUVEAUX_ROLES = TOUS.filter(c => !ROLES_DU_PACTE.includes(c) && !ROLES_DU_PACTE_3B.includes(c) && !ROLES_DU_PACTE_9.includes(c));
  const equilibre = JSON.parse(readFileSync(`modules/${M}/assets/equilibre.json`, "utf8"));
  const compos = Object.values(JSON.parse(readFileSync(`modules/${M}/assets/compositions.json`, "utf8")));
  const page = (cle, titre) => docs.find(d => d.cle === `journaux:${cle}`).doc.pages.filter(p => !titre || p.name === titre).map(p => p.text.content).join(" ");
  const fiches = page("guide-du-joueur", "Nouveaux visages de la veillée"), narrateur = page("guide-du-narrateur");
  assert.deepEqual(NOUVEAUX_ROLES.map(c => parCle(c).system.camp), ["meute", "village", "village", "solitaire"]);
  for (const cle of NOUVEAUX_ROLES) {
    const r = parCle(cle);
    assert.ok(existsSync(r.img), `${r.name} : jeton`);
    assert.equal(equilibre.roles[cle]?.camp, r.system.camp, `${r.name} : poids`);
    assert.ok(compos.some(c => c.roles.includes(cle)), `${r.name} : dans aucune composition prête`);
    assert.ok(fiches.includes(r.name) && fiches.includes(r.system.description.slice(3, 60)), `${r.name} : fiche du guide`);
    assert.ok(narrateur.includes(r.name), `${r.name} : absent du guide du narrateur`);
  }
  for (const cle of NOUVEAUX_METIERS) {
    const m = metiers.find(x => x.system.cle === cle);
    assert.ok(existsSync(m.img) && fiches.includes(m.name) && narrateur.includes(m.name), m.name);
  }
  assert.match(fiches, /Victoire\.<\/strong> Tu gagnes <strong>seule<\/strong>/, "la victoire de la Dame du gué");
});

// ---------------------------------------------------------------- Mutations

test("mutation : un camp inconnu, une clé d'effet inventée, un solitaire sans victoire sont repérés", () => {
  attendre(mute("roles:herboriste", d => { d.system.camp = "clergé"; }), /camp « clergé » inconnu/);
  attendre(mute("roles:herboriste", d => { d.system.effet = "ressusciter"; }), /clé d'effet « ressusciter » inconnue/);
  attendre(mute("metiers:forgeron", d => { d.system.effet = "forger"; }), /clé d'effet « forger » inconnue/);
  attendre(mute("roles:revenant", d => { d.system.victoire = ""; }), /solitaire sans condition de victoire/);
  attendre(mute("roles:liseuse-de-cendres", d => { d.system.victoire = "<p>gagne</p>"; }), /victoire propre hors solitaire/);
});

test("mutation : des ordres de nuit incohérents sont repérés", () => {
  attendre(mute("roles:garde-du-pont", d => { d.system.nuit.ordre = 45; }), /protection garde-du-pont passe après la meute/);
  attendre(mute("roles:herboriste", d => { d.system.nuit.ordre = 30; }), /herboriste réagit à la victime/);
  attendre(mute("roles:liseuse-de-cendres", d => { d.system.nuit.ordre = 40; }), /hors meute se réveille à 40/);
  attendre(mute("roles:ermite", d => { d.system.nuit.ordre = 95; }), /fossoyeur interroge les morts et doit passer en dernier/);
  attendre(mute("roles:loup-hurleur", d => { d.system.nuit.ordre = 12; }), /loup se réveille seul avant la meute/);
  attendre(mute("roles:entremetteuse", d => { d.system.nuit.ordre = 25; }), /entremetteuse doit passer avant les protections/);
  attendre(mute("roles:sonneur", d => { d.system.nuit.invite = "Sonnes-tu ?"; }), /sans action de nuit, mais avec des réglages/);
  attendre(mute("roles:liseuse-de-cendres", d => { d.system.nuit.invite = ""; }), /rôle de nuit sans invite/);
  const sansMeute = mute("roles:loup-de-brumecombe", d => { d.system.nuit.ordre = 41; });
  sansMeute.find(d => d.cle === "roles:loup-deguise").doc.system.nuit.ordre = 41;
  attendre(sansMeute, /aucun loup simple à 40/);
});

test("mutation : villageois doté d'un pouvoir, rôle en double, usages faux, référence interdite", () => {
  attendre(mute("roles:villageois", d => { d.system.effet = "tuer"; }), /le villageois n'a ni pouvoir ni action/);
  attendre(mute("roles:sourcier", d => { d.system.cle = "liseuse-de-cendres"; d.flags[M].cle = "liseuse-de-cendres"; }), /clé de rôle en double/);
  attendre(mute("roles:sonneur", d => { d.system.usages.restant = 3; }), /usages incohérents/);
  attendre(mute("roles:conteuse", d => { d.system.description += "<p>Comme à Thiercelieux.</p>"; }), /référence interdite/);
  attendre(mute("roles:conteuse", d => { d.img = "icons/svg/mystery-man.svg"; }), /image/);
});

test("mutation : bâtiment sans règle ou dont le repère n'est pas sur la carte", () => {
  attendre(mute("batiments:gibet", d => { d.system.regle = ""; }), /bâtiment sans règle/);
  attendre(mute("batiments:gibet", d => { d.system.repere = "Potence"; }), /repère « Potence » absent de la carte/);
});

test("mutation : apparence ou clé de victoire inconnues, victoire de solitaire hors solitaire", () => {
  attendre(mute("roles:loup-deguise", d => { d.system.apparence = "fantome"; }), /apparence « fantome » inconnue/);
  attendre(mute("roles:loup-deguise", d => { d.system.apparence = "meute"; }), /apparence identique au camp réel/);
  attendre(mute("roles:revenant", d => { d.system.victoireCle = "pendu"; }), /clé de victoire « pendu » inconnue/);
  attendre(mute("roles:sonneur", d => { d.system.victoireCle = "execute"; }), /clé de victoire hors solitaire/);
  attendre(mute("roles:pyromane", d => { delete d.system.victoireCle; }), /clé de victoire « undefined » inconnue/);
  assert.throws(() => role({ cle: "x", nom: "X", camp: "village", pouvoir: "p", victoireCle: "execute" }), /réservée aux solitaires/);
  assert.throws(() => role({ cle: "x", nom: "X", camp: "meute", pouvoir: "p", apparence: "brume", nuit: { ordre: 40, invite: "?" } }), /apparence « brume »/);
});

test("les constructeurs refusent un camp, un effet ou un solitaire mal formés", () => {
  assert.throws(() => role({ cle: "x", nom: "X", camp: "clergé", pouvoir: "p" }), /camp « clergé » inconnu/);
  assert.throws(() => role({ cle: "x", nom: "X", camp: "village", pouvoir: "p", effet: "voler" }), /clé d'effet « voler »/);
  assert.throws(() => role({ cle: "x", nom: "X", camp: "solitaire", pouvoir: "p" }), /condition de victoire/);
  assert.throws(() => role({ cle: "x", nom: "X", camp: "village", pouvoir: "p", nuit: { ordre: 30 } }), /invite/);
  assert.throws(() => metier({ cle: "x", nom: "X", pouvoir: "p", effet: "forger" }), /clé d'effet « forger »/);
  assert.throws(() => batiment({ cle: "x", nom: "X", description: "d", regle: "r" }), /repère/);
});
