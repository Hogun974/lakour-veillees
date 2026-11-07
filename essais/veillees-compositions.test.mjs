// Essais des compositions de lakour-veillees (assets/compositions.json) : de 6 à 18 joueurs, trois niveaux, autant de
// rôles que de joueurs pour chaque taille de la plage (en complétant par des villageois), rôles et bâtiments existants.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fabriquer, verifierCompositions, rolesPourCompositions, batimentsPourCompositions, FICHIER_COMPOSITIONS
} from "../outils/fabriquer-veillees.mjs";
import { compositions, composer, nombreDeLoups, composerTablee, composerLePacte, nombreDeLoupsTablee, NIVEAU_PETITE_TABLEE, MIN_TABLEE, MAX_TABLEE, NIVEAUX, EQUILIBRE_COMPLET } from "../modules/lakour-veillees/contenu/compositions.mjs";
import { composer as composerSysteme, equilibreDe, cibleDe } from "../systems/lakour-loups/logique/composition.mjs";

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
    assert.ok(["debutants", "classique", "chaos", "le-pacte", NIVEAU_PETITE_TABLEE].includes(c.niveau), cle);
    const [min, max] = c.joueurs;
    for (let n = min; n <= max; n++) {
      const completes = [...c.roles, ...Array(Math.max(0, n - c.roles.length)).fill("villageois")];
      assert.equal(completes.length, n, `${cle} : ${n} joueurs`);
      for (const r of completes) assert.ok(r in camp, `${cle} : rôle ${r} inconnu`);
    }
    for (const b of c.batiments) assert.ok(batiments.includes(b), `${cle} : bâtiment ${b}`);
    // Le Pacte (étape 5) : aucun de nos bâtiments communaux.
    if (c.niveau === "le-pacte") assert.deepEqual(c.batiments, [], cle);
    else assert.ok(c.batiments.length >= 4 && c.batiments.length <= 6, cle);
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
    assert.equal(meute.length, c.niveau === NIVEAU_PETITE_TABLEE ? nombreDeLoupsTablee(n) : nombreDeLoups(n, c.niveau), c.libelle);
    assert.ok(meute.includes("loup-de-brumecombe"), `${c.libelle} : au moins un loup simple`);
    assert.ok(meute.length * 2 < n);
    if (c.niveau === "debutants") {
      assert.ok(!c.roles.some(r => camp[r] === "solitaire"), c.libelle);
      assert.ok(meute.every(r => r === "loup-de-brumecombe"), c.libelle);
    }
  }
});

// Le Pacte, étape 6 : toutes les compositions prêtes sont tirées par le générateur du système, à graine fixe, sur l'équilibre calibré
// (poids et cibles du contenu) ; les bâtiments restent ceux du niveau (Le Pacte : aucun). Contrôle d'équilibre : la somme des poids
// de chacune est à ±2 de la cible de sa taille et de son niveau (la petite tablée : ±3, comme le générateur).
test("équilibre : chaque composition prête est celle du générateur à graine fixe, à ±2 de la cible de sa taille et de son niveau", () => {
  for (const [cle, c] of Object.entries(surDisque)) {
    const n = c.joueurs[0];
    const somme = equilibreDe(c.roles, EQUILIBRE_COMPLET), cible = cibleDe(n, c.niveau, EQUILIBRE_COMPLET);
    assert.ok(Math.abs(somme - cible) <= (c.niveau === NIVEAU_PETITE_TABLEE ? 3 : 2), `${cle} : somme ${somme}, cible ${cible}`);
    if (c.niveau === NIVEAU_PETITE_TABLEE) continue;
    const graine = `${c.niveau}-${n}`;
    assert.deepEqual(c.roles, [...composerSysteme(n, EQUILIBRE_COMPLET, { niveau: c.niveau, graine }).roles].sort(), `${cle} : le générateur, graine « ${graine} »`);
    assert.deepEqual(c.batiments, c.niveau === "le-pacte" ? [] : NIVEAUX[c.niveau].batiments(n), `${cle} : les bâtiments du niveau`);
  }
  assert.deepEqual(composer("classique", 12), surDisque["classique-12"]);
  assert.deepEqual(composerLePacte(9), surDisque["le-pacte-09"]);
  assert.throws(() => composer("expert", 8), /Niveau inconnu/);
});

// La Petite tablée (système 0.11.0) : 4 à 12 places, meute courte, l'ombre dès 6 places, une lanterne, un village actif, ni Gibet ni Pont.
test("petite tablée : une composition prête de 4 à 12 places, même barème que le générateur du système", () => {
  for (let n = MIN_TABLEE; n <= MAX_TABLEE; n++) {
    const c = surDisque[`${NIVEAU_PETITE_TABLEE}-${String(n).padStart(2, "0")}`];
    assert.ok(c, `petite-tablee-${n}`);
    assert.deepEqual(c, composerTablee(n));
    assert.equal(c.roles.length, n);
    assert.equal(c.roles.filter(r => camp[r] === "meute").length, nombreDeLoupsTablee(n));
    if (n >= 6) assert.ok(c.roles.filter(r => camp[r] !== "village").length >= 2, `${c.libelle} : deux rôles de l'ombre`);
    assert.ok(c.roles.some(r => ["liseuse-de-cendres", "sourcier", "veilleuse-de-lanterne", "fossoyeur", "ermite", "enfant-de-la-brume", "louvetier"].includes(r)), `${c.libelle} : une lanterne`);
    assert.ok(c.roles.filter(r => r === "villageois").length <= Math.floor(n / 6), `${c.libelle} : village actif`);
    assert.ok(!c.roles.includes("loup-deguise") && !c.roles.includes("pyromane") && !c.roles.includes("dame-du-gue"), c.libelle);
    assert.ok(!c.batiments.includes("gibet") && !c.batiments.includes("pont"), c.libelle);
  }
  assert.throws(() => composerTablee(13), /4 à 12 places/);
  assert.ok(!Object.values(surDisque).some(c => c.niveau !== NIVEAU_PETITE_TABLEE && c.joueurs[0] < 6), "les niveaux classiques commencent à 6");
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
  const unique = b["chaos-14"].roles.find(r => r !== "villageois" && r !== "loup-de-brumecombe" && camp[r] === "village" && b["chaos-14"].roles.filter(x => x === r).length === 1
    && !["lavandiere", "bucheron"].includes(r));
  b["chaos-14"].roles[b["chaos-14"].roles.findIndex(r => r !== unique && camp[r] === "village")] = unique;
  attendre(b, new RegExp(`rôle « ${unique} » en double`));
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
