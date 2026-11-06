// Composition équilibrée et variée (systems/lakour-loups/logique/composition.mjs), sur l'équilibre réel du contenu
// (modules/lakour-veillees/assets/equilibre.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composer, equilibreDe, nombreDeLoups, NIVEAUX, HORS_TABLEE, HORS_TABLEE_BATIMENTS, SOLITAIRES_TABLEE, villageoisTablee, cibleDe } from "../systems/lakour-loups/logique/composition.mjs";
import { NIVEAU_PETITE_TABLEE, nombreDeLoupsTablee, ombresTablee } from "../systems/lakour-loups/logique/tablee.mjs";
const CLASSIQUES = NIVEAUX.filter(n => n !== NIVEAU_PETITE_TABLEE);

const EQ = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));
const camp = c => EQ.roles[c].camp;
const speciaux = roles => roles.filter(c => camp(c) === "meute" && c !== "loup-de-brumecombe");
const solitaires = roles => roles.filter(c => camp(c) === "solitaire");

test("toute taille de 6 à 18, tout niveau classique : bon nombre de rôles et de loups, équilibre à ±2 de la cible du contenu, rôles uniques", () => {
  for (const niveau of CLASSIQUES) for (let n = 6; n <= 18; n++) for (let g = 0; g < 8; g++) {
    const c = composer(n, EQ, { niveau, graine: `${niveau}/${n}/${g}` });
    const ou = `${niveau}, ${n} joueurs, graine ${g}`;
    assert.equal(c.roles.length, n, ou);
    assert.equal(c.roles.filter(r => camp(r) === "meute").length, nombreDeLoups(n), `${ou} : loups`);
    assert.ok(Math.abs(c.somme - cibleDe(n, niveau, EQ)) <= 2, `${ou} : équilibre ${c.somme} (cible ${cibleDe(n, niveau, EQ)})`);
    assert.equal(c.somme, equilibreDe(c.roles, EQ));
    for (const r of c.roles) {
      const e = EQ.roles[r];
      assert.ok(NIVEAUX.indexOf(e.niveau) <= NIVEAUX.indexOf(niveau), `${ou} : ${r} hors niveau`);
      assert.ok(n >= e.joueursMin, `${ou} : ${r} demande ${e.joueursMin} joueurs`);
      if (e.unique) assert.equal(c.roles.filter(x => x === r).length, 1, `${ou} : ${r} en double`);
    }
    assert.ok(c.roles.some(r => EQ.roles[r].information), `${ou} : aucun rôle d'information`);
  }
});

// La Petite tablée (0.11.0, tablee.mjs) : 4 à 12 places, sa meute courte, l'ombre dès 6 places, une lanterne, presque pas de simples
// villageois, ni Loup déguisé ni tueur solitaire, ni Gibet ni Pont ; équilibre proche de sa cible.
test("petite tablée : 4 à 12 places, loups selon son barème, deux rôles de l'ombre dès 6, lanterne, village actif", () => {
  for (let n = 4; n <= 12; n++) for (let g = 0; g < 10; g++) {
    const c = composer(n, EQ, { niveau: NIVEAU_PETITE_TABLEE, graine: `tablee/${n}/${g}` });
    const ou = `petite tablée, ${n} places, graine ${g}`;
    assert.equal(c.roles.length, n, ou);
    assert.equal(c.niveau, NIVEAU_PETITE_TABLEE);
    assert.equal(c.roles.filter(r => camp(r) === "meute").length, nombreDeLoupsTablee(n), `${ou} : loups`);
    assert.ok(c.roles.filter(r => camp(r) !== "village").length >= ombresTablee(n), `${ou} : rôles de l'ombre`);
    assert.ok(c.roles.some(r => EQ.roles[r].information), `${ou} : aucune lanterne`);
    if (n >= 8) assert.ok(c.roles.filter(r => EQ.roles[r].information).length >= 2, `${ou} : une seule lanterne`);
    if (n >= 6) assert.ok(c.roles.some(r => EQ.roles[r].protection), `${ou} : aucune protection`);
    assert.ok(c.roles.filter(r => r === "villageois").length <= villageoisTablee(n), `${ou} : trop de simples villageois`);
    assert.ok(speciaux(c.roles).length <= 1, `${ou} : plus d'un loup à pouvoir`);
    for (const r of c.roles) {
      assert.ok(!HORS_TABLEE.includes(r), `${ou} : ${r} n'a pas sa place`);
      if (camp(r) === "solitaire") assert.ok(SOLITAIRES_TABLEE.includes(r), `${ou} : solitaire ${r}`);
      assert.ok(NIVEAUX.indexOf(EQ.roles[r].niveau) <= 1 || SOLITAIRES_TABLEE.includes(r), `${ou} : ${r} hors niveau classique`);
      if (EQ.roles[r].unique) assert.equal(c.roles.filter(x => x === r).length, 1, `${ou} : ${r} en double`);
    }
    assert.ok(Math.abs(c.somme - cibleDe(n, NIVEAU_PETITE_TABLEE, EQ)) <= 3, `${ou} : équilibre ${c.somme} loin de la cible ${cibleDe(n, NIVEAU_PETITE_TABLEE, EQ)}`);
    for (const b of c.batiments) assert.ok(!HORS_TABLEE_BATIMENTS.includes(b), `${ou} : bâtiment ${b}`);
    assert.ok(c.batiments.length >= 4);
  }
  assert.throws(() => composer(13, EQ, { niveau: NIVEAU_PETITE_TABLEE }), /12 places au plus/);
  // Une petite tablée de peste noire : aucun loup, le reste comme d'habitude.
  const p = composer(8, EQ, { niveau: NIVEAU_PETITE_TABLEE, graine: "peste", peste: true });
  assert.equal(p.roles.filter(r => camp(r) === "meute").length, 0);
  assert.equal(p.roles.length, 8);
});

test("niveaux : débutants sans loup spécial ni solitaire ; chaos avec au moins un loup spécial et un solitaire dès 10 joueurs", () => {
  for (let n = 6; n <= 18; n++) for (let g = 0; g < 5; g++) {
    const d = composer(n, EQ, { niveau: "debutants", graine: g });
    assert.deepEqual([speciaux(d.roles), solitaires(d.roles)], [[], []], `débutants ${n}`);
    if (n >= 10) {
      const c = composer(n, EQ, { niveau: "chaos", graine: g });
      assert.ok(speciaux(c.roles).length >= 1, `chaos ${n} : loup spécial`);
      assert.ok(solitaires(c.roles).length >= 1, `chaos ${n} : solitaire`);
    }
  }
});

test("variété : avec l'historique, les parties successives changent de rôles et de bâtiments", () => {
  const historique = [];
  const vus = new Set();
  let changements = 0;
  for (let g = 0; g < 6; g++) {
    const c = composer(12, EQ, { niveau: "classique", historique, graine: `suite-${g}` });
    const pouvoirs = c.roles.filter(r => r !== "villageois" && r !== "loup-de-brumecombe");
    if (historique.length) {
      const avant = new Set(historique.at(-1).roles);
      changements += pouvoirs.filter(r => !avant.has(r)).length;
    }
    pouvoirs.forEach(r => vus.add(r));
    historique.push(c);
  }
  assert.ok(vus.size >= 10, `seulement ${vus.size} rôles différents en 6 parties`);
  assert.ok(changements >= 10, `trop peu de nouveaux rôles d'une partie à l'autre (${changements})`);
  // Mutation : sans historique, la même graine redonne la même composition (reproductible), l'historique la fait changer.
  const a = composer(12, EQ, { niveau: "classique", graine: "x" });
  assert.deepEqual(composer(12, EQ, { niveau: "classique", graine: "x" }).roles, a.roles);
  const b = composer(12, EQ, { niveau: "classique", graine: "x", historique: [a, a, a] });
  assert.notDeepEqual([...b.roles].sort(), [...a.roles].sort());
});

test("souhaits : rôles imposés présents, rôles exclus absents ; erreurs claires", () => {
  for (let g = 0; g < 10; g++) {
    const c = composer(10, EQ, { niveau: "classique", inclure: ["sonneur", "conteuse"], exclure: ["liseuse-de-cendres", "garde-du-pont"], graine: g });
    assert.ok(c.roles.includes("sonneur") && c.roles.includes("conteuse"));
    assert.ok(!c.roles.includes("liseuse-de-cendres") && !c.roles.includes("garde-du-pont"));
  }
  assert.throws(() => composer(3, EQ), /au moins 4 joueurs/);
  assert.throws(() => composer(8, EQ, { niveau: "facile" }), /Niveau inconnu/);
  assert.throws(() => composer(8, EQ, { inclure: ["sorciere"] }), /Rôles inconnus : sorciere/);
});

test("bâtiments : 4 à 6 selon la taille, permis par le niveau, sans doublon", () => {
  for (const [n, attendu] of [[6, 4], [10, 5], [14, 6], [18, 6]]) {
    const c = composer(n, EQ, { niveau: "classique", graine: n });
    assert.equal(c.batiments.length, attendu);
    assert.equal(new Set(c.batiments).size, attendu);
    for (const b of c.batiments) assert.notEqual(EQ.batiments[b].niveau, "chaos", `${b} hors niveau classique`);
  }
  // Débutants : seulement les bâtiments simples, même si la taille en voudrait plus.
  const permis = Object.keys(EQ.batiments).filter(b => EQ.batiments[b].niveau === "debutants");
  const d = composer(18, EQ, { niveau: "debutants", graine: 1 });
  assert.equal(d.batiments.length, Math.min(6, permis.length));
  for (const b of d.batiments) assert.ok(permis.includes(b), `${b} hors niveau débutants`);
});

// Le Pacte, étape 6 : la cible d'équilibre par niveau et par taille vient du contenu (equilibre.cibles, calibrée par simulation) ;
// sans elle, 0 (la petite tablée : cibleTablee) ; une taille absente prend la plus proche ; une cible donnée passe avant.
test("cibleDe : la cible du contenu par niveau et par taille, la plus proche, sinon 0 ; composer la vise", () => {
  const eq = { ...EQ, cibles: { classique: { 8: 3, 12: -2 } } };
  assert.equal(cibleDe(8, "classique", eq), 3);
  assert.equal(cibleDe(11, "classique", eq), -2, "la taille la plus proche");
  assert.equal(cibleDe(8, "chaos", eq), 0, "sans cible pour ce niveau : 0");
  assert.equal(cibleDe(6, NIVEAU_PETITE_TABLEE, { roles: EQ.roles }), 3, "petite tablée sans cible du contenu : cibleTablee");
  for (let g = 0; g < 6; g++) {
    assert.ok(Math.abs(composer(8, eq, { niveau: "classique", graine: `cible/${g}` }).somme - 3) <= 2);
    assert.ok(Math.abs(composer(8, eq, { niveau: "classique", graine: `cible/${g}`, cible: -4 }).somme + 4) <= 2, "une cible donnée passe avant");
  }
  // Une variante choisie ajoute son ajustement (equilibre.ajustements) ; une variante absente ou non choisie, rien.
  const aj = { ...eq, ajustements: { vendanges: 5, chaine: -2 } };
  assert.equal(cibleDe(8, "classique", aj, { vendanges: true, chaine: false, mur: true }), 8);
  assert.equal(cibleDe(8, "classique", aj, { vendanges: true, chaine: true }), 6);
  assert.equal(cibleDe(8, "classique", aj), 3);
  for (let g = 0; g < 4; g++) assert.ok(Math.abs(composer(8, aj, { niveau: "classique", graine: `aj/${g}`, variantes: { vendanges: true } }).somme - 8) <= 2);
  for (const [cle, x] of Object.entries(EQ.ajustements ?? {})) assert.ok(Number.isFinite(x), `ajustement ${cle} : ${x}`);
  for (const [niveau, t] of Object.entries(EQ.cibles ?? {})) for (const [n, c] of Object.entries(t)) assert.ok(Number.isFinite(c), `${niveau} ${n} : ${c}`);
});
