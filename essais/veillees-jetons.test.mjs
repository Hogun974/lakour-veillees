// Essais des jetons de lakour-veillees : un jeton par rôle (anneau selon le camp), le jeton neutre « villageois » qui
// cache le rôle, un par métier et par bâtiment, figurants ; index.json / index-3d.json par clé de RÔLE (contrat §2),
// figurants.json, CREDITS.md, images des objets et des acteurs. Mutations sur des fichiers lus en mémoire.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listeJetons, verifierJetons, indexJoueurs } from "../outils/fabriquer-jetons-veillees.mjs";
import { fabriquer } from "../outils/fabriquer-veillees.mjs";
import { COULEURS_ANNEAU, INDEX_JOUEURS, JETON_NEUTRE, FICHIER_FIGURANTS } from "../modules/lakour-veillees/contenu/jetons.mjs";
import { cheminJeton, cheminJeton3d } from "../modules/lakour-veillees/contenu/aides.mjs";

const M = "lakour-veillees";
const liste = listeJetons();
const docs = fabriquer();
const roles = docs.filter(d => d.pack === "roles").map(d => d.doc);
const lireDisque = chemin => (existsSync(chemin) ? readFileSync(chemin, "utf8") : null);

test("tous les jetons sont présents, autonomes, avec le bon anneau ; index, figurants et crédits cohérents", () => {
  assert.deepEqual(verifierJetons(), []);
});

test("un jeton par rôle, anneau selon le camp ; le villageois porte le jeton neutre", () => {
  assert.deepEqual(liste.roles.map(j => j.cle).sort(), roles.map(r => r.system.cle).sort());
  for (const r of roles) {
    const j = liste.roles.find(x => x.cle === r.system.cle);
    const attendu = r.system.cle === JETON_NEUTRE ? COULEURS_ANNEAU.neutre : COULEURS_ANNEAU[r.system.camp];
    assert.equal(j.anneau, attendu, r.name);
    assert.equal(r.img, cheminJeton(r.system.cle), `${r.name} : image de l'objet`);
  }
  // Le jeton neutre ne trahit aucun camp.
  for (const camp of ["meute", "village", "solitaire"]) assert.notEqual(COULEURS_ANNEAU.neutre.couleur, COULEURS_ANNEAU[camp].couleur);
});

test("index.json et index-3d.json : clé du rôle -> jeton, rien de plus, jeton neutre compris", () => {
  for (const style of ["2d", "3d"]) {
    const index = JSON.parse(readFileSync(INDEX_JOUEURS[style], "utf8"));
    assert.deepEqual(index, indexJoueurs(liste.roles, style));
    assert.equal(index[JETON_NEUTRE], style === "3d" ? cheminJeton3d(JETON_NEUTRE) : cheminJeton(JETON_NEUTRE));
    for (const chemin of Object.values(index)) assert.ok(existsSync(chemin), chemin);
  }
});

test("un jeton par métier et par bâtiment, images des objets ; figurants.json pour le MJ IA", () => {
  for (const pack of ["metiers", "batiments"]) {
    for (const d of docs.filter(x => x.pack === pack)) {
      assert.ok(existsSync(d.doc.img) && existsSync(d.doc.img.replace("/jetons/", "/jetons/3d/")), `${d.doc.name} : ${d.doc.img}`);
    }
  }
  assert.equal(liste.metiers.length, 12);
  assert.equal(liste.batiments.length, 10);
  const types = JSON.parse(readFileSync(FICHIER_FIGURANTS, "utf8"));
  assert.ok(Object.keys(types).length >= 10);
  assert.equal(types.villageois.jeton, JETON_NEUTRE, "le villageois anonyme porte le jeton neutre");
  for (const a of docs.filter(d => d.pack === "villageois")) assert.ok(existsSync(a.doc.img), `${a.doc.name} : ${a.doc.img}`);
});

test("CREDITS.md cite game-icons.net, la licence CC BY 3.0 et chaque icône utilisée", () => {
  const credits = readFileSync(`modules/${M}/CREDITS.md`, "utf8");
  assert.match(credits, /game-icons\.net/);
  assert.match(credits, /CC BY 3\.0/);
  for (const j of [...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants]) assert.ok(credits.includes(j.icone), j.icone);
  assert.doesNotMatch(credits, /thiercelieux/i);
});

// ---------------------------------------------------------------- Mutations (fichiers lus en mémoire)

test("mutation : jeton absent, anneau repeint, index faux, figurant cassé, crédits incomplets", () => {
  const remplace = (chemin, f) => c => (c === chemin ? f(lireDisque(c)) : lireDisque(c));
  const attendre = (lire, motif) => {
    const erreurs = verifierJetons(lire);
    assert.ok(erreurs.some(e => motif.test(e)), `${motif} attendu, obtenu : ${erreurs.join(" ; ") || "aucune erreur"}`);
  };
  attendre(remplace(cheminJeton("herboriste"), () => null), /herboriste : jeton absent/);
  attendre(remplace(cheminJeton3d("loup-hurleur"), t => t.replaceAll("#8a1414", "#2e7d36")), /loup-hurleur\.svg : anneau #2e7d36 au lieu de #8a1414/);
  attendre(remplace(cheminJeton("revenant"), t => t.replace("<title>", '<image href="http://x/y.png"/><title>')), /référence externe/);
  attendre(remplace(INDEX_JOUEURS["2d"], t => JSON.stringify({ ...JSON.parse(t), vampire: "x.svg" })), /clé vampire qui n'est pas un rôle/);
  attendre(remplace(INDEX_JOUEURS["3d"], t => { const i = JSON.parse(t); delete i.villageois; return JSON.stringify(i); }), /jeton neutre « villageois » absent/);
  attendre(remplace(FICHIER_FIGURANTS, t => JSON.stringify({ ...JSON.parse(t), loup: { libelle: "Loup", jeton: "loup-inconnu" } })), /figurants\.json : loup ->/);
  attendre(remplace(join("modules", M, "CREDITS.md").replaceAll("\\", "/"), t => t.replace(/\| \[ghost\].*\n/, "")), /CREDITS\.md ne cite pas lorc\/ghost/);
});

test("mutation : un rôle sans icône fait échouer la liste des jetons", () => {
  const faux = [...roles, { ...roles[0], name: "Vampire", system: { ...roles[0].system, cle: "vampire" } }];
  assert.throws(() => listeJetons(faux), /Aucune icône pour vampire/);
});
