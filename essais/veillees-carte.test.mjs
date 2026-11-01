// Essais de la carte du village de Brumecombe (lakour-veillees) : 18 maisons et 10 bâtiments en repères, place du
// village, scène v14 (grille de 1,5 m, lumières, vision), fonds plat et relief autonomes, plans.json, repères lisibles
// par le MJ IA. Mutations : maison absente, bâtiment en double, chevauchement, plan invalide.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fabriquer, verifierCarte, BATIMENTS_ATTENDUS } from "../outils/fabriquer-veillees.mjs";
import { CLE_VILLAGE, PLAN_VILLAGE, MAISONS, decorVillage as decor } from "../modules/lakour-veillees/contenu/village.mjs";
import { fondSVG, scene } from "../modules/lakour-veillees/contenu/cartes.mjs";
import { reperesDuPlan, trouverRepere } from "../modules/lakour-mj-ia/scripts/placement.js";

const M = "lakour-veillees";
const docs = fabriquer();
const village = docs.find(d => d.pack === "scenes" && d.doc.flags[M].cle === CLE_VILLAGE)?.doc;
const lire = chemin => { try { return readFileSync(chemin, "utf8"); } catch { return null; } };

test("la scène du village existe, avec son plan dans les drapeaux", () => {
  assert.ok(village);
  assert.deepEqual(village.flags[M].plan, PLAN_VILLAGE);
  assert.ok(village.flags[M].description.length > 100);
});

test("la carte a ses 18 maisons et ses 10 bâtiments en repères, et la place du village", () => {
  assert.deepEqual(verifierCarte(PLAN_VILLAGE), []);
  const noms = PLAN_VILLAGE.elements.map(e => e.nom);
  for (let i = 1; i <= 18; i++) assert.ok(noms.includes(`Maison ${i}`), `Maison ${i}`);
  for (const b of BATIMENTS_ATTENDUS) assert.ok(noms.includes(b), b);
  assert.equal(noms.length, 28);
  assert.ok(PLAN_VILLAGE.pieces.some(p => p.nom === "Place du village"));
  // Les repères des objets bâtiment désignent bien des éléments de la carte.
  for (const b of docs.filter(d => d.pack === "batiments")) assert.ok(noms.includes(b.doc.system.repere), b.doc.name);
});

test("les maisons 13 à 18 et la Grange sont sur l'autre rive (à l'est du Pont)", () => {
  const pont = PLAN_VILLAGE.elements.find(e => e.nom === "Pont");
  for (const m of MAISONS) {
    const n = Number(m.nom.split(" ")[1]);
    if (n >= 13) assert.ok(m.x >= pont.x + pont.l, m.nom);
    else assert.ok(m.x + m.l <= pont.x, m.nom);
  }
  assert.ok(PLAN_VILLAGE.elements.find(e => e.nom === "Grange").x >= pont.x + pont.l);
});

test("le MJ IA retrouve les repères : « devant la chapelle », « Maison 3 », « près du puits », « sur la place »", () => {
  const salles = PLAN_VILLAGE.pieces.map(p => ({ nom: p.nom, x1: p.x, y1: p.y, x2: p.x + p.l - 1, y2: p.y + p.h - 1 }));
  const reperes = reperesDuPlan(PLAN_VILLAGE, salles);
  assert.equal(trouverRepere(reperes, "devant la chapelle")?.nom, "Chapelle");
  assert.equal(trouverRepere(reperes, "Maison 3")?.nom, "Maison 3");
  assert.equal(trouverRepere(reperes, "Maison 13")?.nom, "Maison 13");
  assert.equal(trouverRepere(reperes, "près du puits")?.nom, "Puits");
  assert.equal(trouverRepere(reperes, "au pied du gibet")?.nom, "Gibet");
  assert.match(trouverRepere(reperes, "à l'entrée de la place du village")?.nom ?? "", /Place du village/);
});

test("scène v14 : grille de 1,5 m, aucun mur sur la place, lumières, tout le village visible, pénombre", () => {
  assert.equal(village.grid.distance, 1.5);
  assert.equal(village.grid.units, "m");
  assert.equal(village.width, PLAN_VILLAGE.largeur * 100);
  assert.equal(village.tokenVision, false, "jeu de société : chacun voit tout le village");
  assert.ok(village.environment.darknessLevel > 0.3 && village.environment.darknessLevel < 0.8);
  assert.ok(village.lights.length >= 18 + 10);
  // Seuls les bords de la carte ont des murs : la place est ouverte de tous côtés.
  const L = PLAN_VILLAGE.largeur * 100, H = PLAN_VILLAGE.hauteur * 100;
  for (const w of village.walls) {
    const [x1, y1, x2, y2] = w.c;
    assert.ok((x1 === x2 && (x1 === 0 || x1 === L)) || (y1 === y2 && (y1 === 0 || y1 === H)), `mur intérieur ${w.c}`);
  }
  for (const d of village.drawings) assert.ok(d.hidden && d.author, "étiquettes des pièces : MJ seulement, avec un auteur");
});

test("fonds plat et relief : présents, à jour, autonomes (aucune ressource extérieure), avec le décor du village", () => {
  const src = village.levels[0].background.src;
  assert.equal(src, `modules/${M}/assets/cartes/${CLE_VILLAGE}.svg`);
  for (const [chemin, style] of [[src, "2d"], [src.replace("/cartes/", "/cartes/3d/"), "3d"]]) {
    const svg = lire(chemin);
    assert.ok(svg?.startsWith("<svg"), chemin);
    assert.equal(svg, fondSVG(PLAN_VILLAGE, style, decor).svg, `${chemin} : relancer npm run fabriquer-veillees`);
    assert.doesNotMatch(svg, /href|<image|<script|url\((?!#)/i, `${chemin} : ressource extérieure`);
    assert.match(svg, /id="decor-brumecombe"/);
    assert.match(svg, />Brumecombe</);
    for (let i = 1; i <= 18; i++) assert.match(svg, new RegExp(`>${i}</text>`), `${chemin} : numéro de la maison ${i}`);
    for (const b of BATIMENTS_ATTENDUS) assert.ok(svg.includes(`>${b}</text>`), `${chemin} : étiquette ${b}`);
  }
  assert.notEqual(lire(src), lire(src.replace("/cartes/", "/cartes/3d/")), "le relief diffère du plat");
});

test("plans.json porte le plan du village", () => {
  const plans = JSON.parse(lire(`modules/${M}/assets/cartes/plans.json`));
  assert.deepEqual(plans[CLE_VILLAGE], PLAN_VILLAGE);
});

// ---------------------------------------------------------------- Mutations

test("mutation : une maison absente, un bâtiment en double ou hors carte, deux éléments qui se chevauchent", () => {
  const sans = structuredClone(PLAN_VILLAGE);
  sans.elements = sans.elements.filter(e => e.nom !== "Maison 7");
  assert.ok(verifierCarte(sans).some(e => /Maison 7/.test(e)));
  assert.ok(verifierCarte(sans).some(e => /17 maisons/.test(e)));
  const double = structuredClone(PLAN_VILLAGE);
  double.elements.push({ nom: "Forge", x: 0, y: 28, l: 1, h: 1 });
  assert.ok(verifierCarte(double).some(e => /« Forge » absent ou en double/.test(e)));
  const dehors = structuredClone(PLAN_VILLAGE);
  dehors.elements.find(e => e.nom === "Grange").x = 40;
  assert.ok(verifierCarte(dehors).some(e => /Grange » hors de la carte/.test(e)));
  const chevauche = structuredClone(PLAN_VILLAGE);
  chevauche.elements.find(e => e.nom === "Maison 1").x = 2;
  assert.ok(verifierCarte(chevauche).some(e => /« Maison 1 » et « Moulin » se chevauchent|« Moulin » et « Maison 1 » se chevauchent/.test(e)));
  const sansPlace = structuredClone(PLAN_VILLAGE);
  sansPlace.pieces = sansPlace.pieces.slice(0, 1);
  sansPlace.ouvertures = [];
  assert.ok(verifierCarte(sansPlace).some(e => /Place du village/.test(e)));
});

test("mutation : un plan invalide fait échouer la fabrication de la scène", () => {
  const plan = structuredClone(PLAN_VILLAGE);
  plan.ouvertures.push({ x: 18, y: 14, cote: "nord", type: "porte" }); // au milieu de la place : aucun mur
  assert.throws(() => scene({ cle: "essai-mutation-village", nom: "Essai", plan, description: "Essai", decor }), /pas de mur à cet endroit/);
});

test("le plateau du village : un seuil devant chaque maison, le cercle sur la place, le cimetière sur son repère", async () => {
  const L = await import("../systems/lakour-loups/logique/index.mjs");
  const p = L.lirePlateau(PLAN_VILLAGE);
  for (const m of MAISONS) assert.ok(PLAN_VILLAGE.plateau.seuils[m.nom], m.nom);
  assert.equal(Object.keys(PLAN_VILLAGE.plateau.seuils).length, 18);
  const place = PLAN_VILLAGE.pieces.find(x => x.nom === "Place du village");
  const c = PLAN_VILLAGE.plateau.cercle;
  assert.ok(c.x - c.rayon - 0.5 >= place.x && c.x + c.rayon + 0.5 <= place.x + place.l && c.y - c.rayon - 0.5 >= place.y && c.y + c.rayon + 0.5 <= place.y + place.h, "le cercle tient sur la place");
  assert.deepEqual(PLAN_VILLAGE.plateau.cimetiere, (({ x, y, l, h }) => ({ x, y, l, h }))(PLAN_VILLAGE.elements.find(e => e.nom === "Cimetière")));
  for (let n = 4; n <= 18; n++) assert.deepEqual(L.defautsDuCercle(p, L.placesEnCercle(p, n)), [], `${n} joueurs`);
  // Mutation : un cercle trop grand déborde de la place.
  const trop = L.lirePlateau({ ...PLAN_VILLAGE, plateau: { ...PLAN_VILLAGE.plateau, cercle: { ...c, rayon: 7, rayonMin: 7 } } });
  assert.ok(L.defautsDuCercle(trop, L.placesEnCercle(trop, 18)).length > 0);
});
