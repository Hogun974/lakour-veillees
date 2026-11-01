// Placement des jetons sur le contenu des Veillées : repères du village de Brumecombe dans l'état du jeu. Essai tiré
// de essais/placement.test.mjs de l'archive (foundry-modules@bc94625) ; le reste du placement, sur des données
// d'essai, est éprouvé dans le moteur (lakour-mj-ia, essais/placement.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { reperesDuPlan } from "../modules/lakour-mj-ia/scripts/placement.js";

test("repères dans l'état du jeu : éléments d'abord, noms très répétés regroupés (village de Brumecombe)", async () => {
  const { resumerReperes } = await import("../modules/lakour-mj-ia/scripts/placement.js");
  const { readFileSync } = await import("node:fs");
  const plan = JSON.parse(readFileSync("modules/lakour-veillees/assets/cartes/plans.json", "utf8"));
  const village = Object.values(plan)[0];
  const salles = village.pieces.map(p => ({ nom: p.nom, x1: p.x, y1: p.y, x2: p.x + p.l - 1, y2: p.y + p.h - 1 }));
  const lignes = resumerReperes(reperesDuPlan(village, salles));
  assert.ok(lignes.some(l => l.startsWith("Chapelle")), "les bâtiments sont là");
  assert.ok(lignes.some(l => l.startsWith("Maison 18")), "les 18 maisons sont là");
  assert.ok(lignes.findIndex(l => l.startsWith("Maison 1 ")) < lignes.findIndex(l => / ×\d+$/.test(l)), "éléments avant les passages");
  assert.ok(lignes.filter(l => /^Passage/.test(l)).length <= 2, "passages regroupés");
  assert.ok(lignes.length <= 60);
  // Mutation : sans regroupement, les passages déborderaient.
  const bruts = reperesDuPlan(village, salles);
  assert.ok(bruts.filter(r => r.type !== "element").length > 20);
});
