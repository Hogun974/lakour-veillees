// L'équilibre des Veillées (Le Pacte, étape 6, docs/equilibre-veillees.md) : le simulateur (essais/outils/simuler-veillees.mjs) en
// mode rapide — 16 parties par case, graine fixe, quatre niveaux, quatre tailles, des joueurs d'adresse 1 (ils usent de tout ce
// qu'ils savent), des compositions générées aux poids et aux cibles calibrés — doit rester dans des bornes LARGES : la meute gagne
// entre 30 et 70 % des parties que gagne la meute ou le village (ce que la calibration vise : 50 % ; les solitaires à part), par niveau
// (toutes tailles, 64 parties) et par taille (tous niveaux, 64 parties). Ces bornes détectent une dérive franche (un
// rôle, une règle, une politique qui fait basculer la partie) sans casser au moindre souffle du hasard ; les valeurs mesurées à
// l'écriture sont rappelées en commentaire. La mesure longue (400 parties par case, deux adresses) est hors de la suite :
//   node essais/outils/simuler-veillees.mjs --parties 400 --adresse 1,0.5 --graine apres
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { simuler, mesurer, bilanDe, solitairesDe } from "./outils/simuler-veillees.mjs";

const TAILLES = [6, 10, 14, 18];
const NIVEAUX = ["debutants", "classique", "chaos", "le-pacte"];
const PARTIES = 16;
const resultats = await simuler({ parties: PARTIES, graine: "rapide", tailles: TAILLES, niveaux: NIVEAUX, adresses: [1], fils: 8 });
const m = mesurer(resultats);
// La part de la meute parmi les parties gagnées par la meute ou le village.
const part = l => { const b = bilanDe(l); return b.meute / Math.max(1, b.meute + b.village); };

test("équilibre rapide : aucune partie en erreur, toutes jouées jusqu'à la victoire", () => {
  assert.equal(resultats.length, TAILLES.length * NIVEAUX.length * PARTIES);
  assert.deepEqual(resultats.filter(r => r.erreur).map(r => `${r.cas} #${r.i} : ${r.erreur}`), []);
  for (const r of resultats) assert.ok(r.vainqueur, `${r.cas} #${r.i} : pas de vainqueur`);
});

test("équilibre rapide : la meute gagne entre 30 et 70 % des parties à chaque niveau (toutes tailles)", () => {
  // mesuré à l'écriture : débutants 34 %, classique 45 %, chaos 52 %, Le Pacte 42 % (la mesure longue, 2 800 parties par niveau :
  // 45, 50, 48, 48 % ; docs/equilibre-veillees.md)
  for (const niveau of NIVEAUX) {
    const l = resultats.filter(r => r.niveau === niveau);
    assert.ok(part(l) >= 0.3 && part(l) <= 0.7, `${niveau} : meute ${Math.round(100 * part(l))} % sur ${l.length} parties`);
  }
});

test("équilibre rapide : la meute gagne entre 30 et 70 % des parties à chaque taille (tous niveaux)", () => {
  // mesuré à l'écriture : 6 joueurs 38 %, 10 : 37 %, 14 : 45 %, 18 : 55 % (la mesure longue : 49, 53, 50, 43 %)
  for (const n of TAILLES) {
    const l = resultats.filter(r => r.n === n);
    assert.ok(part(l) >= 0.3 && part(l) <= 0.7, `${n} joueurs : meute ${Math.round(100 * part(l))} % sur ${l.length} parties`);
  }
});

test("équilibre rapide : les solitaires ne raflent pas la mise (au plus une partie sur trois là où l'un d'eux est)", () => {
  // Chacun, sur trop peu de parties pour une borne serrée (le Chasseur de primes gagne 28 % des parties où il est, sur 700 :
  // docs/equilibre-veillees.md) : tous ensemble, puis chacun à au plus une sur deux quand il a joué au moins 20 parties. Mesuré à
  // l'écriture : 24 victoires sur 102 parties ; le Revenant 9 sur 24.
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
  const [a] = await simuler({ parties: 1, graine: "rapide", tailles: [10], niveaux: ["classique"], adresses: [1], fils: 1 });
  const b = resultats.find(r => r.niveau === "classique" && r.n === 10 && r.i === 0);
  assert.deepEqual({ camp: a.camp, tours: a.tours, roles: a.roles }, { camp: b.camp, tours: b.tours, roles: b.roles });
});
