// La calibration des poids (essais/outils/calibrer-poids.mjs, Le Pacte, étape 6) : la régression logistique retrouve des effets connus
// sur des parties inventées, l'échelle ramène les poids à celle du contenu (Villageois +1, Loup de Brumecombe -6), la cible d'une
// taille est la somme des poids qui donne une chance sur deux, l'échantillon est varié et reproductible.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { logistique, calibrer, echantillon, ciblesDeLaTablee, ANCRES } from "./outils/calibrer-poids.mjs";
import { ADRESSE_DU_NIVEAU } from "./outils/simuler-veillees.mjs";
import { creerHasard } from "../systems/lakour-loups/logique/hasard.mjs";
import { nombreDeLoups } from "../systems/lakour-loups/logique/composition.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";

test("logistique : retrouve des effets connus (deux variables et une ordonnée)", () => {
  const h = creerHasard("logistique");
  const vrai = [0.8, -0.5, 0.3];
  const lignes = [];
  for (let i = 0; i < 6000; i++) {
    const a = Math.floor(h() * 3), b = Math.floor(h() * 2);
    const eta = vrai[0] * a + vrai[1] * b + vrai[2];
    lignes.push({ x: [[0, a], [1, b], [2, 1]], y: h() < 1 / (1 + Math.exp(-eta)) ? 1 : 0 });
  }
  const { beta, erreurs } = logistique(lignes, [{ lambda: 0 }, { lambda: 0 }, { lambda: 0 }]);
  for (let j = 0; j < 3; j++) assert.ok(Math.abs(beta[j] - vrai[j]) < 4 * erreurs[j], `β${j} = ${beta[j]} ± ${erreurs[j]} (vrai ${vrai[j]})`);
});

test("calibrer : des parties inventées où la Liseuse vaut deux fois l'Herboriste ; échelle, poids, cibles", () => {
  // Effets vrais en logit : Liseuse +0,8, Herboriste +0,4 ; ordonnée de chaque case : -0,4 (la meute gagne un peu plus sans eux).
  const h = creerHasard("calibrer");
  const parties = [];
  for (let i = 0; i < 8000; i++) {
    const n = [8, 10, 12][i % 3];
    const roles = ["loup-de-brumecombe", "loup-de-brumecombe", ...(h() < 0.5 ? ["liseuse-de-cendres"] : []), ...(h() < 0.5 ? ["herboriste"] : [])];
    while (roles.length < n) roles.push("villageois");
    const eta = -0.4 + 0.8 * roles.includes("liseuse-de-cendres") + 0.4 * roles.includes("herboriste");
    parties.push({ niveau: "classique", n, roles, batiments: [], variante: "ordinaire", camp: h() < 1 / (1 + Math.exp(-eta)) ? "village" : "meute" });
  }
  const c = calibrer(parties, { lambda: 0.01 });
  const l = c.poids["liseuse-de-cendres"], b = c.poids.herboriste;
  assert.ok(Math.abs((l.brut - ANCRES.village) / (b.brut - ANCRES.village) - 2) < 0.6, `rapport ${l.brut} / ${b.brut}`);
  assert.ok(c.u > 0, "échelle positive");
  // La cible : avec Liseuse et Herboriste (logit +0,8), la partie penche vers le village ; la cible est entre la somme sans eux
  // et la somme avec eux, là où le logit s'annule (ici aux deux tiers de la Liseuse seule).
  for (const n of [8, 10, 12]) {
    const m = nombreDeLoups(n);
    const base = (n - m) - 6 * m;
    const t = c.cibles.classique[n];
    assert.ok(t.brute > base && t.brute < base + (l.brut - 1) + (b.brut - 1), `${n} : cible ${t.brute}, base ${base}`);
  }
});

test("échantillon : varié (niveaux, tailles, cibles), reproductible ; la petite tablée garde ses compositions", () => {
  const a = echantillon(40, { graine: "essai" }), b = echantillon(40, { graine: "essai" });
  assert.deepEqual(a, b);
  assert.deepEqual(new Set(a.map(t => t.c.niveau)), new Set(["debutants", "classique", "chaos", "le-pacte"]));
  assert.ok(new Set(a.map(t => t.c.n)).size >= 8, "des tailles variées");
  assert.ok(Math.max(...a.map(t => t.c.somme)) - Math.min(...a.map(t => t.c.somme)) >= 10, "des sommes variées");
  for (const t of a) assert.equal(t.c.roles.length, t.c.n);
  // L'adresse de référence de chaque niveau (Le Pacte, étape 6b) : --adresse niveau.
  for (const t of echantillon(8, { graine: "essai", adresse: "niveau" })) assert.equal(t.c.adresse, ADRESSE_DU_NIVEAU[t.c.niveau], t.c.niveau);
  assert.deepEqual(ADRESSE_DU_NIVEAU, { debutants: 0.5, classique: 0.75, chaos: 1, "le-pacte": 0.75 });
  // Aux poids actuels, les cibles de la petite tablée sont les anciennes (à l'arrondi près : les compositions ne bougent pas).
  const memes = ciblesDeLaTablee(Object.fromEntries(Object.entries(EQUILIBRE).map(([k, r]) => [k, r.poids])), { tirages: 30 });
  for (let n = 4; n <= 12; n++) assert.ok(Number.isInteger(memes[n]), `${n} : ${memes[n]}`);
});
