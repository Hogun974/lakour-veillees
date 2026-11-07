// La préparation de la Table de veillée en onglets (demandé par Jordan après les parties du 7 novembre 2026 : la section occupait tout
// l'écran avant la liste des vivants). Joueurs, Composition, Village, Variantes, Gazette ; « Distribuer » et le résumé d'une ligne des
// choix actifs toujours visibles dessous ; l'onglet ouvert retenu par navigateur ; chaque case garde son action et son réglage.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as L from "../systems/lakour-loups/logique/index.mjs";

const lire = chemin => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8");
const GABARIT = lire("../systems/lakour-loups/templates/table.hbs");
const SCRIPT = lire("../systems/lakour-loups/scripts/apps/table.mjs");
const FR = JSON.parse(lire("../systems/lakour-loups/lang/fr.json")).LAKOUR_LOUPS;
const EN = JSON.parse(lire("../systems/lakour-loups/lang/en.json")).LAKOUR_LOUPS;
const PREPARATION = GABARIT.slice(GABARIT.indexOf('<section class="loups-encart loups-preparation">'), GABARIT.indexOf("</section>", GABARIT.indexOf("loups-preparation")));
// Le contenu d'un panneau (de son ouverture au panneau suivant, ou au résumé).
const panneau = cle => {
  const i = PREPARATION.indexOf(`<div class="loups-prep-onglet" data-onglet="${cle}"`);
  const fins = [...PREPARATION.matchAll(/<div class="loups-prep-onglet" data-onglet=|loups-prep-resume/g)].map(m => m.index).filter(j => j > i);
  return i < 0 ? "" : PREPARATION.slice(i, Math.min(...fins));
};

test("gabarit : cinq panneaux, chacun ouvert ou caché selon preparation.ouvert ; la barre d'onglets mène à prepOnglet", () => {
  assert.match(PREPARATION, /<nav class="loups-prep-onglets" role="tablist">/);
  assert.match(PREPARATION, /\{\{#each preparation\.onglets\}\}<button type="button" role="tab"[^>]*data-action="prepOnglet" data-onglet="\{\{cle\}\}"/);
  for (const { cle } of L.ONGLETS_DE_LA_PREPARATION) {
    assert.match(PREPARATION, new RegExp(`<div class="loups-prep-onglet" data-onglet="${cle}" role="tabpanel" \\{\\{#unless preparation\\.ouvert\\.${cle}\\}\\}hidden\\{\\{/unless\\}\\}>`), cle);
  }
  // Ce que chaque onglet range (mêmes actions, mêmes champs qu'avant les onglets).
  const attendu = {
    joueurs: ["prepCocher", "prepRetirerIA", "prepIA", "voixActiver", "voixMicro"],
    composition: ["prepMode", 'name="prepNiveau"', "prepRole", "preparation.tablee", "preparation.equilibre"],
    village: ["prepPeste", "prepSaintMartin", "prepVillage", 'name="prepBatiments"', "prepBatiment\"", "prepMetiers"],
    variantes: ["prepVariante", 'name="prepDoubleVisage"', "preparation.variantes.allegeance"],
    gazette: ['data-cle="actif"', 'data-cle="crieur"', "prepPermanente", 'name="prepFete"']
  };
  for (const [cle, morceaux] of Object.entries(attendu)) for (const m of morceaux) assert.ok(panneau(cle).includes(m), `${cle} : ${m}`);
  // Sous les onglets, hors de tout panneau : le résumé, puis « Distribuer ».
  const apres = PREPARATION.slice(PREPARATION.indexOf("loups-prep-resume"));
  assert.match(apres, /\{\{preparation\.resume\}\}/);
  assert.match(apres, /data-action="distribuer"/);
  assert.doesNotMatch(apres, /data-onglet=/);
  assert.equal((PREPARATION.match(/data-action="distribuer"/g) ?? []).length, 1);
});

test("table.mjs : l'action prepOnglet, l'onglet retenu par navigateur, les onglets et le résumé au contexte", () => {
  assert.match(SCRIPT, /prepOnglet: TableDeJeu\.#prepOnglet/);
  assert.match(SCRIPT, /static #prepOnglet\(event, cible\) \{ retenirOnglet\(cible\.dataset\.onglet\); this\.render\(\); \}/);
  assert.match(SCRIPT, /export const ONGLET_RETENU = `\$\{ID\}\.ongletDeLaPreparation`;/);
  assert.match(SCRIPT, /localStorage\?\.getItem\(ONGLET_RETENU\)/);
  assert.match(SCRIPT, /localStorage\?\.setItem\(ONGLET_RETENU/);
  assert.match(SCRIPT, /L\.ongletsDeLaPreparation\(preparation, ongletRetenu\(\)\)/);
  assert.match(SCRIPT, /preparation\.resume = L\.resumeDeLaPreparation\(preparation, t, \{ niveau: p\.niveau \}\)/);
  for (const dico of [FR, EN]) {
    for (const { cle } of L.ONGLETS_DE_LA_PREPARATION) assert.equal(typeof dico.Preparation.Onglets[cle], "string", cle);
    for (const c of ["Manuel", "SansBatiments", "BatimentsChoisis", "SansMetiers"]) assert.equal(typeof dico.Preparation.Resume[c], "string", c);
    assert.equal(typeof dico.Preparation.Formats, "string");
  }
});

test("onglets : l'onglet retenu s'il existe, sinon le premier ; un onglet sans rien à régler disparaît", () => {
  const plein = { variantes: { cases: [] }, gazette: { actif: false }, fetes: { saintMartin: false, options: [] } };
  const o = L.ongletsDeLaPreparation(plein, "variantes");
  assert.deepEqual(o.onglets.map(x => x.cle), ["joueurs", "composition", "village", "variantes", "gazette"]);
  assert.deepEqual(o.onglets.filter(x => x.actif).map(x => x.cle), ["variantes"]);
  assert.deepEqual(o.ouvert, { joueurs: false, composition: false, village: false, variantes: true, gazette: false });
  // Une Nuit de la Saint-Martin : ni variantes, ni Gazette, ni fête ; l'onglet retenu « variantes » cède au premier.
  const sm = L.ongletsDeLaPreparation({ variantes: null, gazette: null, fetes: { saintMartin: true } }, "variantes");
  assert.deepEqual(sm.onglets.map(x => x.cle), ["joueurs", "composition", "village"]);
  assert.equal(sm.ouvert.joueurs, true);
  assert.equal(L.ongletsDeLaPreparation(plein, "").ouvert.joueurs, true, "rien de retenu : Joueurs");
  // La petite tablée (pas de Gazette) garde l'onglet si une veillée de fête se prépare.
  assert.ok(L.ongletsDeLaPreparation({ gazette: null, fetes: { saintMartin: false } }).onglets.some(x => x.cle === "gazette"));
});

test("résumé : une ligne des choix actifs, dans l'ordre des onglets", () => {
  const t = (cle, d) => ({ "LAKOUR_LOUPS.Table.Composition.Niveaux.le-pacte": "Le Pacte", "LAKOUR_LOUPS.Village.Nom": "Le Village",
    "LAKOUR_LOUPS.Preparation.Gazette": "La Gazette de la lune", "LAKOUR_LOUPS.Preparation.Crieur": "Le Crieur public", "LAKOUR_LOUPS.Peste.Preparation": "Partie peste noire",
    "LAKOUR_LOUPS.Variantes.DoubleVisage.Nom": "Double visage", "LAKOUR_LOUPS.Preparation.Resume.SansMetiers": "sans métiers",
    "LAKOUR_LOUPS.Preparation.Resume.Manuel": `${d?.n} rôles choisis à la main`, "LAKOUR_LOUPS.SaintMartin.Preparation": "Nuit de la Saint-Martin" })[cle] ?? cle;
  const prep = { auto: true, village: true, villagePossible: true, batiments: { modes: [{ cle: "hasard", choisi: true }], metiers: false },
    variantes: { cases: [{ cle: "chandelles", nom: "Veillée aux chandelles", coche: true }, { cle: "mur", nom: "Le Mur des murmures", coche: false }],
      doubleVisage: [{ cle: "", choisi: false }, { cle: "petite", nom: "petite complication", choisi: true }], allegeance: { coche: true, nom: "une allégeance loup de plus" } },
    gazette: { actif: true, crieur: true }, fetes: { saintMartin: false, options: [{ cle: "", choisie: false }, { cle: "carnaval", nom: "Le Carnaval des masques", choisie: true }] } };
  assert.equal(L.resumeDeLaPreparation(prep, t, { niveau: "le-pacte" }),
    "Le Pacte · Le Village · sans métiers · Veillée aux chandelles · Double visage (petite complication) + une allégeance loup de plus · La Gazette de la lune · Le Crieur public · Le Carnaval des masques");
  assert.equal(L.resumeDeLaPreparation({ manuel: true, choisis: 9, peste: true }, t, { niveau: "le-pacte" }), "9 rôles choisis à la main · Partie peste noire");
  assert.equal(L.resumeDeLaPreparation({ saintMartin: true, auto: true }, t, { niveau: "classique" }), "Nuit de la Saint-Martin");
});
