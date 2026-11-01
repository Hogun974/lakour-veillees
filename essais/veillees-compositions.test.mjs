// Essais des compositions de lakour-veillees (assets/compositions.json) : de 6 à 18 joueurs, trois niveaux, autant de
// rôles que de joueurs pour chaque taille de la plage (en complétant par des villageois), rôles et bâtiments existants.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fabriquer, verifierCompositions, rolesPourCompositions, batimentsPourCompositions, FICHIER_COMPOSITIONS
} from "../outils/fabriquer-veillees.mjs";
import { compositions, composer, nombreDeLoups } from "../modules/lakour-veillees/contenu/compositions.mjs";

const docs = fabriquer();
const roles = rolesPourCompositions(docs), batiments = batimentsPourCompositions(docs);
const camp = Object.fromEntries(roles.map(r => [r.cle, r.camp]));
const surDisque = JSON.parse(readFileSync(FICHIER_COMPOSITIONS, "utf8"));
const attendre = (compos, motif) => {
  const erreurs = verifierCompositions(compos, roles, batiments);
  assert.ok(erreurs.some(e => motif.test(e)), `${motif} attendu, obtenu : ${erreurs.join(" ; ") || "aucune erreur"}`);
};

test("compositions.json est à jour et conforme", () => {
  assert.deepEqual(surDisque, compositions(), "relancer npm run fabriquer-veillees");
  assert.deepEqual(verifierCompositions(surDisque, roles, batiments), []);
});

test("chaque composition : forme du contrat, autant de rôles que de joueurs pour chaque taille, rôles qui existent", () => {
  for (const [cle, c] of Object.entries(surDisque)) {
    assert.deepEqual(Object.keys(c).sort(), ["batiments", "joueurs", "libelle", "niveau", "roles"], cle);
    assert.ok(["debutants", "classique", "chaos"].includes(c.niveau), cle);
    const [min, max] = c.joueurs;
    for (let n = min; n <= max; n++) {
      const completes = [...c.roles, ...Array(Math.max(0, n - c.roles.length)).fill("villageois")];
      assert.equal(completes.length, n, `${cle} : ${n} joueurs`);
      for (const r of completes) assert.ok(r in camp, `${cle} : rôle ${r} inconnu`);
    }
    for (const b of c.batiments) assert.ok(batiments.includes(b), `${cle} : bâtiment ${b}`);
    assert.ok(c.batiments.length >= 4 && c.batiments.length <= 6, cle);
  }
});

test("de 6 à 18 joueurs dans chacun des trois niveaux", () => {
  for (const niveau of ["debutants", "classique", "chaos"]) {
    const tailles = Object.values(surDisque).filter(c => c.niveau === niveau).flatMap(c => {
      const t = [];
      for (let n = c.joueurs[0]; n <= c.joueurs[1]; n++) t.push(n);
      return t;
    });
    for (let n = 6; n <= 18; n++) assert.ok(tailles.includes(n), `${niveau} : ${n} joueurs`);
  }
});

test("dosage : les loups selon le nombre de joueurs, jamais la moitié ; débutants sans solitaire ni loup spécial", () => {
  for (const c of Object.values(surDisque)) {
    const n = c.joueurs[0];
    const meute = c.roles.filter(r => camp[r] === "meute");
    assert.equal(meute.length, nombreDeLoups(n), c.libelle);
    assert.ok(meute.includes("loup-de-brumecombe"), `${c.libelle} : au moins un loup simple`);
    assert.ok(meute.length * 2 < n);
    if (c.niveau === "debutants") {
      assert.ok(!c.roles.some(r => camp[r] === "solitaire"), c.libelle);
      assert.ok(meute.every(r => r === "loup-de-brumecombe"), c.libelle);
    }
  }
  // Les deux bornes du plan : 6 joueurs débutants et 18 joueurs classiques.
  assert.deepEqual([...composer("debutants", 6).roles].sort(), ["garde-du-pont", "liseuse-de-cendres", "loup-de-brumecombe", "loup-de-brumecombe", "villageois", "villageois"]);
  const grand = composer("classique", 18).roles;
  assert.equal(grand.filter(r => camp[r] === "meute").length, 5);
  assert.ok(grand.includes("loup-affame"));
  assert.equal(grand.filter(r => camp[r] === "solitaire").length, 2);
  assert.equal(grand.filter(r => r === "villageois").length, 3);
});

// ---------------------------------------------------------------- Mutations

test("mutation : un rôle de trop, un rôle inconnu, une plage impossible sont repérés", () => {
  const c = structuredClone(surDisque);
  c["classique-10"].roles.push("sonneur");
  attendre(c, /classique-10 : 11 rôles pour 10 joueurs/);
  const d = structuredClone(surDisque);
  d["chaos-12"].roles[3] = "vampire";
  attendre(d, /chaos-12 : rôle « vampire » inconnu/);
  const e = structuredClone(surDisque);
  e["debutants-08"].joueurs = [8, 9]; // 8 rôles complétés par un villageois à 9 : accepté
  assert.deepEqual(verifierCompositions(e, roles, batiments), []);
  e["debutants-08"].joueurs = [7, 9]; // 8 rôles pour 7 joueurs : refusé
  attendre(e, /debutants-08 : 8 rôles pour 7 joueurs/);
});

test("mutation : trop de loups, rôle unique en double, bâtiments manquants ou inconnus, taille non couverte", () => {
  const a = structuredClone(surDisque);
  a["classique-06"].roles = ["loup-de-brumecombe", "loup-de-brumecombe", "loup-affame", "villageois", "villageois", "villageois"];
  attendre(a, /trop de loups/);
  const b = structuredClone(surDisque);
  b["chaos-14"].roles[b["chaos-14"].roles.indexOf("villageois")] = "herboriste";
  attendre(b, /rôle « herboriste » en double/);
  const c = structuredClone(surDisque);
  c["classique-12"].batiments = ["chapelle", "moulin", "taverne"];
  attendre(c, /3 bâtiments/);
  c["classique-12"].batiments = ["chapelle", "moulin", "taverne", "beffroi"];
  attendre(c, /bâtiment « beffroi » inconnu/);
  const d = structuredClone(surDisque);
  delete d["chaos-17"];
  attendre(d, /niveau chaos : aucune composition pour 17 joueurs/);
  const e = structuredClone(surDisque);
  e["chaos-09"].niveau = "expert";
  attendre(e, /niveau « expert » inconnu/);
});
