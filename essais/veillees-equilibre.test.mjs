// L'équilibre des Veillées (Le Pacte, étapes 6, 6b et 6c, docs/equilibre-veillees.md) : le simulateur (essais/outils/simuler-veillees.mjs)
// en mode rapide — 16 parties par case, graine fixe, quatre niveaux, quatre tailles, chaque niveau joué à son ADRESSE DE RÉFÉRENCE
// (ADRESSE_DU_NIVEAU : débutants 0,5 ; classique et Le Pacte 0,75 ; chaos 1), des compositions générées aux poids et aux cibles
// calibrés — doit rester dans des bornes LARGES autour de la mesure longue : la part de la meute parmi les parties que gagne la meute
// ou le village (la calibration vise 50 % ; depuis l'étape 6c, les débutants aussi, avec un loup de moins ; les solitaires
// à part), par niveau (toutes tailles, 64 parties : à 20 points de la référence) et par taille (tous niveaux, 64 parties : de 30 à
// 80 %). Ces bornes détectent une dérive franche (un rôle, une règle, une politique qui fait basculer la partie) sans casser au moindre
// souffle du hasard ; les valeurs mesurées à l'écriture sont rappelées en commentaire. La mesure longue est hors de la suite :
//   node essais/outils/simuler-veillees.mjs --parties 400 --adresse niveau --graine 6b-apres   (débutants, étape 6c : --graine 6c-apres ;
//   le Vieux Sergent, novembre 2026 : --parties 300 --graine sergent)
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { simuler, mesurer, bilanDe, solitairesDe, ADRESSE_DU_NIVEAU } from "./outils/simuler-veillees.mjs";

const TAILLES = [6, 10, 14, 18];
const NIVEAUX = ["debutants", "classique", "chaos", "le-pacte"];
const PARTIES = 16;
// La part de la meute dans la mesure longue (docs/equilibre-veillees.md, « Après »), à l'adresse de chaque niveau (étape 6c : les
// débutants, un loup de moins, visent eux aussi 50 %).
const REFERENCE = { debutants: 0.5, classique: 0.5, chaos: 0.5, "le-pacte": 0.5 };
const resultats = await simuler({ parties: PARTIES, graine: "rapide", tailles: TAILLES, niveaux: NIVEAUX, adresses: ["niveau"], fils: 8 });
const m = mesurer(resultats);
// La part de la meute parmi les parties gagnées par la meute ou le village.
const part = l => { const b = bilanDe(l); return b.meute / Math.max(1, b.meute + b.village); };

test("équilibre rapide : aucune partie en erreur, toutes jouées jusqu'à la victoire", () => {
  assert.equal(resultats.length, TAILLES.length * NIVEAUX.length * PARTIES);
  assert.deepEqual(resultats.filter(r => r.erreur).map(r => `${r.cas} #${r.i} : ${r.erreur}`), []);
  for (const r of resultats) assert.ok(r.vainqueur, `${r.cas} #${r.i} : pas de vainqueur`);
});

test("équilibre rapide : à chaque niveau (toutes tailles, à son adresse), la meute reste à 20 points de la mesure longue", () => {
  // mesuré à l'écriture (étape 6c) : débutants 53 %, classique 47 %, chaos 47 %, Le Pacte 44 % (la mesure longue, 2 800 parties
  // par niveau : 52 % aux débutants, étape 6c ; 54 % au classique, étape 6b ; 51 et 48 % au chaos et à Le Pacte, étape 6c ;
  // docs/equilibre-veillees.md). Remesuré en novembre 2026 (la Liseuse imposée à Le Pacte, le Vieux Sergent aux débutants) : débutants
  // 45 %, classique 47 %, chaos 47 %, Le Pacte 58 %.
  for (const niveau of NIVEAUX) {
    const l = resultats.filter(r => r.niveau === niveau);
    assert.ok(l.every(r => r.adresse === ADRESSE_DU_NIVEAU[niveau]), `${niveau} : à l'adresse ${ADRESSE_DU_NIVEAU[niveau]}`);
    assert.ok(Math.abs(part(l) - REFERENCE[niveau]) <= 0.2, `${niveau} : meute ${Math.round(100 * part(l))} % sur ${l.length} parties (référence ${100 * REFERENCE[niveau]} %)`);
  }
});

test("équilibre rapide : la meute gagne entre 30 et 80 % des parties à chaque taille (tous niveaux, chacun à son adresse)", () => {
  // mesuré à l'écriture (étape 6c) : 6 joueurs 53 %, 10 : 44 %, 14 : 47 %, 18 : 47 % (la mesure longue de l'étape 6b, avant le loup
  // de moins des débutants : 61, 54, 54, 55 %). Novembre 2026 : 53, 44, 45, 55 %.
  for (const n of TAILLES) {
    const l = resultats.filter(r => r.n === n);
    assert.ok(part(l) >= 0.3 && part(l) <= 0.8, `${n} joueurs : meute ${Math.round(100 * part(l))} % sur ${l.length} parties`);
  }
});

test("équilibre rapide : les solitaires ne raflent pas la mise (au plus une partie sur trois là où l'un d'eux est)", () => {
  // Chacun, sur trop peu de parties pour une borne serrée (le Joueur de vielle gagne 15 % des parties où il est depuis l'étape 6c, 32 % avant :
  // docs/equilibre-veillees.md) : tous ensemble, puis chacun à au plus une sur deux quand il a joué au moins 20 parties. Mesuré à
  // l'écriture (étape 6c) : 8 victoires sur 87 parties ; le Revenant 3 sur 27, le Chasseur de primes 3 sur 13, le Joueur de vielle 0
  // sur 11 (novembre 2026 : 8 sur 83).
  const avecUn = resultats.filter(r => !r.erreur && r.roles.some(c => c in solitairesDe([r])));
  const gagnees = avecUn.filter(r => r.camp !== "meute" && r.camp !== "village");
  assert.ok(gagnees.length <= avecUn.length / 3, `solitaires : ${gagnees.length} victoires sur ${avecUn.length} parties`);
  for (const [cle, x] of Object.entries(solitairesDe(resultats))) {
    if (x.parties < 20) continue;
    assert.ok(x.part <= 1 / 2, `${cle} : ${x.victoires} victoires sur ${x.parties}`);
  }
  assert.ok(m.parNiveau.size === NIVEAUX.length);
});

test("équilibre rapide : même graine, mêmes parties (le simulateur est déterministe)", async () => {
  const [a] = await simuler({ parties: 1, graine: "rapide", tailles: [10], niveaux: ["classique"], adresses: ["niveau"], fils: 1 });
  const b = resultats.find(r => r.niveau === "classique" && r.n === 10 && r.i === 0);
  assert.deepEqual({ camp: a.camp, tours: a.tours, roles: a.roles }, { camp: b.camp, tours: b.tours, roles: b.roles });
});
