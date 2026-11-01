// Composition équilibrée et variée (systems/lakour-loups/logique/composition.mjs), sur l'équilibre réel du contenu
// (modules/lakour-veillees/assets/equilibre.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composer, equilibreDe, nombreDeLoups, NIVEAUX } from "../systems/lakour-loups/logique/composition.mjs";

const EQ = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));
const camp = c => EQ.roles[c].camp;
const speciaux = roles => roles.filter(c => camp(c) === "meute" && c !== "loup-de-brumecombe");
const solitaires = roles => roles.filter(c => camp(c) === "solitaire");

test("toute taille de 6 à 18, tout niveau : bon nombre de rôles et de loups, équilibre à ±2, rôles uniques", () => {
  for (const niveau of NIVEAUX) for (let n = 6; n <= 18; n++) for (let g = 0; g < 8; g++) {
    const c = composer(n, EQ, { niveau, graine: `${niveau}/${n}/${g}` });
    const ou = `${niveau}, ${n} joueurs, graine ${g}`;
    assert.equal(c.roles.length, n, ou);
    assert.equal(c.roles.filter(r => camp(r) === "meute").length, nombreDeLoups(n), `${ou} : loups`);
    assert.ok(Math.abs(c.somme) <= 2, `${ou} : équilibre ${c.somme}`);
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
