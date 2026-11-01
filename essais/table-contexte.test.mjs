// La Table de veillée : chaque variable que le gabarit lit hors d'une boucle doit être fournie par _prepareContext.
// (L'« Ordre de nuit » calculé mais jamais passé au gabarit : pas de bouton Réveiller, la meute ne pouvait pas chasser.)
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const lire = chemin => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8");
const GABARIT = lire("../systems/lakour-loups/templates/table.hbs");
const SCRIPT = lire("../systems/lakour-loups/scripts/apps/table.mjs");

// Les noms lus à la racine du gabarit (hors {{#each}}, où le contexte devient l'élément parcouru).
function racinesDuGabarit(hbs) {
  const noms = new Set();
  let profondeur = 0;
  for (const [, balise] of hbs.matchAll(/\{\{\{?([^}]*)\}?\}\}/g)) {
    const b = balise.trim();
    if (b.startsWith("/each")) { profondeur--; continue; }
    if (b.startsWith("!") || b.startsWith("else") || b.startsWith("/")) continue;
    const m = b.match(/^#(if|unless|each)\s+([A-Za-z_]\w*)/) ?? b.match(/^([A-Za-z_]\w*)(?:\.\w+)*$/);
    const nom = m?.[2] ?? m?.[1];
    if (nom && profondeur === 0 && !["this", "else"].includes(nom)) noms.add(nom);
    if (b.startsWith("#each")) profondeur++;
  }
  return noms;
}

// Les clés de l'objet rendu par _prepareContext (son dernier « return { … } »).
function clesDuContexte(js) {
  const debut = js.indexOf("{", js.lastIndexOf("return {", js.indexOf("async _onRender")));
  const cles = new Set();
  let profondeur = 0, morceau = "";
  for (const c of js.slice(debut)) {
    if ("{[(".includes(c)) profondeur++;
    if ("}])".includes(c)) profondeur--;
    if (profondeur === 0) break;
    if (profondeur === 1 && c === ",") { cles.add(morceau.trim().match(/^[A-Za-z_]\w*/)?.[0]); morceau = ""; continue; }
    if (profondeur > 1 || c !== "{") morceau += c;
  }
  cles.add(morceau.trim().match(/^[A-Za-z_]\w*/)?.[0]);
  cles.delete(undefined);
  return cles;
}

test("Table de veillée : le gabarit ne lit que ce que _prepareContext fournit", () => {
  const fournies = clesDuContexte(SCRIPT);
  assert.ok(fournies.has("gm") && fournies.has("etape"), "lecture du contexte ratée");
  const manquantes = [...racinesDuGabarit(GABARIT)].filter(n => !fournies.has(n));
  assert.deepEqual(manquantes, [], `variables du gabarit absentes du contexte : ${manquantes.join(", ")}`);
});

test("Table de veillée : la nuit, l'Ordre de nuit (et son bouton Réveiller) reçoit ses données", () => {
  assert.ok(racinesDuGabarit(GABARIT).has("nuit"));
  assert.ok(clesDuContexte(SCRIPT).has("nuit"), "« nuit » n'est pas passé au gabarit : pas de bouton Réveiller");
  assert.match(GABARIT, /data-action="reveiller" data-role="\{\{roleCle\}\}"/);
});

test("mutation : retirer « nuit » du contexte est détecté", () => {
  const mute = SCRIPT.replace("etape, preparation, nuit,", "etape, preparation,");
  assert.notEqual(mute, SCRIPT);
  assert.ok(!clesDuContexte(mute).has("nuit"));
  assert.ok([...racinesDuGabarit(GABARIT)].some(n => !clesDuContexte(mute).has(n)));
});
