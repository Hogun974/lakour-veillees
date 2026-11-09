// Essais des jetons de lakour-veillees : un jeton par rôle (anneau selon le camp), le jeton neutre « villageois » qui
// cache le rôle, un par métier et par bâtiment, figurants ; index.json / index-3d.json par clé de RÔLE (contrat §2),
// figurants.json, CREDITS.md, images des objets et des acteurs ; jetons peints (assets/jetons/ia/<clé>.webp) pour chaque clé.
// Mutations sur des fichiers lus en mémoire.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listeJetons, verifierJetons, indexJoueurs } from "../outils/fabriquer-jetons-veillees.mjs";
import { fabriquer } from "../outils/fabriquer-veillees.mjs";
import { COULEURS_ANNEAU, DOSSIER_JETONS, INDEX_JOUEURS, JETON_NEUTRE, FICHIER_FIGURANTS } from "../modules/lakour-veillees/contenu/jetons.mjs";
import { cheminJeton, cheminJeton3d, cheminJetonIA, cheminJetonSvg, cleJetonBatiment, cleJetonMetier } from "../modules/lakour-veillees/contenu/aides.mjs";

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
    // À plat, le jeton peint (moteur 0.46.0) ; en relief, le SVG.
    assert.equal(index[JETON_NEUTRE], style === "3d" ? cheminJeton3d(JETON_NEUTRE) : cheminJetonIA(JETON_NEUTRE));
    for (const chemin of Object.values(index)) assert.ok(existsSync(chemin), chemin);
  }
});

test("un jeton par métier et par bâtiment, images des objets ; figurants.json pour le MJ IA", () => {
  for (const [pack, cle] of [["metiers", cleJetonMetier], ["batiments", cleJetonBatiment]]) {
    for (const d of docs.filter(x => x.pack === pack)) {
      const jeton = cle(d.doc.system.cle);
      assert.equal(d.doc.img, cheminJeton(jeton), `${d.doc.name} : image de l'objet`);
      for (const chemin of [d.doc.img, cheminJetonSvg(jeton), cheminJeton3d(jeton)]) assert.ok(existsSync(chemin), `${d.doc.name} : ${chemin}`);
    }
  }
  assert.equal(liste.metiers.length, 14);
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

// ---------------------------------------------------------------- Jetons peints (assets/jetons/ia/)

// Dimensions et canal alpha d'un WebP (en-tête RIFF « VP8X » : drapeau alpha, largeur et hauteur sur 24 bits).
function enteteWebp(octets) {
  if (octets.toString("latin1", 0, 4) !== "RIFF" || octets.toString("latin1", 8, 12) !== "WEBP") return null;
  if (octets.toString("latin1", 12, 16) !== "VP8X") return { vp8x: false };
  return { vp8x: true, alpha: Boolean(octets[20] & 0x10), largeur: 1 + octets.readUIntLE(24, 3), hauteur: 1 + octets.readUIntLE(27, 3) };
}

test("jetons peints : chaque clé de index.json a son WebP, et chaque rôle, métier, bâtiment et figurant aussi", () => {
  for (const cle of Object.keys(JSON.parse(readFileSync(INDEX_JOUEURS["2d"], "utf8")))) assert.ok(existsSync(cheminJetonIA(cle)), `${cheminJetonIA(cle)} absent`);
  const tous = [...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants];
  assert.equal(tous.length, 89);
  for (const j of tous) {
    assert.equal(j.ia, cheminJetonIA(j.cle));
    assert.ok(existsSync(j.ia), `${j.ia} absent`);
    assert.deepEqual(enteteWebp(readFileSync(j.ia)), { vp8x: true, alpha: true, largeur: 512, hauteur: 512 }, `${j.ia} : WebP 512×512 avec transparence attendu`);
    assert.equal(cheminJeton(j.cle), j.ia, `${j.cle} : les documents prennent le jeton peint`);
  }
  // Rien d'orphelin dans ia/ : une clé disparue laisserait un fichier mort dans le module.
  const cles = new Set(tous.map(j => j.cle));
  for (const f of readdirSync(join(DOSSIER_JETONS, "ia"))) assert.ok(f.endsWith(".webp") && cles.has(f.slice(0, -5)), `ia/${f} ne correspond à aucun jeton`);
  for (const r of roles) assert.equal(r.img, cheminJetonIA(r.system.cle), `${r.name} : jeton peint`);
  // figurants.json : le jeton SVG reste (obligatoire), l'image peinte s'ajoute (relative à assets/jetons/).
  for (const [type, f] of Object.entries(JSON.parse(readFileSync(FICHIER_FIGURANTS, "utf8")))) {
    assert.equal(f.image, `ia/${f.jeton}.webp`, `figurants.json : ${type}`);
    assert.ok(existsSync(cheminJetonSvg(f.jeton)) && existsSync(join(DOSSIER_JETONS, f.image)), type);
  }
  for (const a of docs.filter(d => d.pack === "villageois")) {
    assert.match(a.doc.img, /\/jetons\/ia\/[a-z0-9-]+\.webp$/, `${a.doc.name} : jeton peint`);
    assert.equal(a.doc.prototypeToken.texture.src, a.doc.img);
  }
  assert.match(readFileSync(`modules/${M}/CREDITS.md`, "utf8"), /FLUX\.2 klein 9B/);
});

test("jetons peints : le style relief ne touche pas aux WebP ; le jeton neutre du plateau est le villageois peint", () => {
  const main = readFileSync(`modules/${M}/scripts/main.js`, "utf8");
  assert.match(main, /const JETON_NEUTRE = `modules\/\$\{ID\}\/assets\/jetons\/ia\/villageois\.webp`/);
  assert.match(main, /!src\.endsWith\("\.svg"\)\) return src;/);
});

test("fabriquer les jetons garde les jetons peints (assets/jetons/ia/ n'est pas effacé)", () => {
  const script = readFileSync("outils/fabriquer-jetons-veillees.mjs", "utf8");
  assert.match(script, /if \(f !== "ia"\) rmSync/);
});

// ---------------------------------------------------------------- Mutations (fichiers lus en mémoire)

test("mutation : jeton absent, anneau repeint, index faux, figurant cassé, crédits incomplets", () => {
  const remplace = (chemin, f) => c => (c === chemin ? f(lireDisque(c)) : lireDisque(c));
  const attendre = (lire, motif) => {
    const erreurs = verifierJetons(lire);
    assert.ok(erreurs.some(e => motif.test(e)), `${motif} attendu, obtenu : ${erreurs.join(" ; ") || "aucune erreur"}`);
  };
  attendre(remplace(cheminJetonSvg("herboriste"), () => null), /herboriste : jeton absent/);
  attendre(remplace(cheminJeton3d("loup-hurleur"), t => t.replaceAll("#8a1414", "#2e7d36")), /loup-hurleur\.svg : anneau #2e7d36 au lieu de #8a1414/);
  attendre(remplace(cheminJetonSvg("revenant"), t => t.replace("<title>", '<image href="http://x/y.png"/><title>')), /référence externe/);
  attendre(remplace(INDEX_JOUEURS["2d"], t => JSON.stringify({ ...JSON.parse(t), vampire: "x.svg" })), /clé vampire qui n'est pas un rôle/);
  attendre(remplace(INDEX_JOUEURS["3d"], t => { const i = JSON.parse(t); delete i.villageois; return JSON.stringify(i); }), /jeton neutre « villageois » absent/);
  attendre(remplace(FICHIER_FIGURANTS, t => JSON.stringify({ ...JSON.parse(t), loup: { libelle: "Loup", jeton: "loup-inconnu" } })), /figurants\.json : loup ->/);
  attendre(remplace(FICHIER_FIGURANTS, t => { const f = JSON.parse(t); delete f.chat.image; return JSON.stringify(f); }), /figurants\.json : chat : image absente au lieu de ia\/figurant-chat\.webp/);
  attendre(remplace(join("modules", M, "CREDITS.md").replaceAll("\\", "/"), t => t.replace(/\| \[ghost\].*\n/, "")), /CREDITS\.md ne cite pas lorc\/ghost/);
});

test("mutation : un rôle sans icône fait échouer la liste des jetons", () => {
  const faux = [...roles, { ...roles[0], name: "Vampire", system: { ...roles[0].system, cle: "vampire" } }];
  assert.throws(() => listeJetons(faux), /Aucune icône pour vampire/);
});
