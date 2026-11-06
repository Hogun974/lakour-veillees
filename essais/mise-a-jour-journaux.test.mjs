// La mise à jour d'un journal déjà installé (scripts/mise-a-jour.js, fichier commun aux modules de contenu LaKour) : pages
// nouvelles ajoutées, pages intactes remises à jour, pages retouchées laissées au MJ, pages du MJ IA protégées ; et le numéro
// que l'installateur compare suit module.json (sans quoi la mise à jour n'est jamais proposée).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MODULE = "lakour-veillees";
const RACINE = new URL(`../modules/${MODULE}/`, import.meta.url);
const { empreinte, pageIntacte, pageDuMjIa, planMiseAJour, avecEmpreintes, MARGE_CREATION_MS } = await import(new URL("scripts/mise-a-jour.js", RACINE));

const ID = MODULE;
const page = (id, cle, contenu, sort, extra = {}) => ({ _id: id, name: `Page ${cle ?? id}`, type: "text", sort, text: { content: contenu, format: 1 }, flags: cle ? { [ID]: { cle } } : {}, ...extra });
const neuve = { createdTime: 1000, modifiedTime: 1000 };
const retouchee = { createdTime: 1000, modifiedTime: 1000 + 3_600_000 };
const vide = { creer: [], maj: [], supprimer: [], gardees: [] };

test("empreinte : stable, sensible au texte", () => {
  assert.equal(empreinte("<p>Bonjour</p>"), empreinte("<p>Bonjour</p>"));
  assert.notEqual(empreinte("<p>Bonjour</p>"), empreinte("<p>Bonjour.</p>"));
  assert.equal(typeof empreinte(), "string");
});

test("page intacte : par l'empreinte, sinon par les dates", () => {
  const p = page("a", "x", "<p>A</p>", 100);
  assert.equal(pageIntacte(ID, { ...p, _stats: neuve }), true);
  assert.equal(pageIntacte(ID, { ...p, _stats: retouchee }), false);
  assert.equal(pageIntacte(ID, p), false, "sans dates ni empreinte : on ne touche pas");
  assert.equal(pageIntacte(ID, { ...p, _stats: { createdTime: 1000, modifiedTime: 1059 } }), true, "date de modification posée par le serveur juste après la création");
  assert.equal(pageIntacte(ID, { ...p, _stats: { createdTime: 1000, modifiedTime: 1000 + MARGE_CREATION_MS + 1 } }), false);
  const marquee = avecEmpreintes(ID, [p])[0];
  assert.equal(pageIntacte(ID, { ...marquee, _stats: retouchee }), true, "l'empreinte prime sur les dates");
  assert.equal(pageIntacte(ID, { ...marquee, text: { content: "<p>A modifié</p>" } }), false);
});

test("plan par clé : ajoute, met à jour l'intact, garde le retouché, ignore les pages du MJ", () => {
  const actuelles = [
    page("p1", "etat", "<p>ancien état</p>", 500, { _stats: neuve }),
    page("p2", "abri", "<p>abri retouché par le MJ</p>", 700, { _stats: retouchee }),
    page("p3", "bruit", "<p>bruit</p>", 800, { _stats: neuve }),
    page("mj1", null, "<p>à moi</p>", 50, { name: "Notes du MJ", _stats: neuve })
  ];
  const modeles = [
    page("p1", "etat", "<p>nouvel état</p>", 500, { _stats: { createdTime: 1 } }),
    page("p2", "abri", "<p>nouvel abri</p>", 700),
    page("z1", "zerbaz", "<p>zerbaz</p>", 800, { _stats: { createdTime: 1 } }),
    page("p3", "bruit", "<p>bruit</p>", 900)
  ];
  const { creer, maj, supprimer, gardees } = planMiseAJour(ID, actuelles, modeles);
  assert.equal(creer.length, 1);
  assert.equal(creer[0]._id, "z1");
  assert.equal(creer[0]._stats, undefined, "pas de dates du compendium");
  assert.equal(creer[0].flags[ID].cle, "zerbaz");
  assert.equal(creer[0].flags[ID].empreinte, empreinte("<p>zerbaz</p>"));
  assert.deepEqual(maj.find(m => m._id === "p1"), { _id: "p1", "text.content": "<p>nouvel état</p>", [`flags.${ID}.empreinte`]: empreinte("<p>nouvel état</p>") });
  assert.deepEqual(maj.find(m => m._id === "p3"), { _id: "p3", sort: 900, [`flags.${ID}.empreinte`]: empreinte("<p>bruit</p>") });
  assert.equal(maj.some(m => m._id === "p2" || m._id === "mj1"), false);
  assert.deepEqual(supprimer, [], "une page sans marque du module n'est jamais retirée");
  assert.deepEqual(gardees, ["Page abri"]);
});

test("plan par identifiant (pages sans clé) : les épingles gardent leur cible", () => {
  const actuelles = [page("s1", null, "<p>scène 1</p>", 100, { _stats: neuve }), page("s2", null, "<p>scène 2 à moi</p>", 200, { _stats: retouchee })];
  const modeles = [page("s1", null, "<p>scène 1 corrigée</p>", 100), page("s2", null, "<p>scène 2</p>", 200), page("s3", null, "<p>scène 3</p>", 300)];
  const { creer, maj, gardees } = planMiseAJour(ID, actuelles, modeles);
  assert.deepEqual(maj, [{ _id: "s1", "text.content": "<p>scène 1 corrigée</p>", [`flags.${ID}.empreinte`]: empreinte("<p>scène 1 corrigée</p>") }]);
  assert.deepEqual(creer.map(p => p._id), ["s3"]);
  assert.deepEqual(gardees, ["Page s2"]);
});

test("plan : une page à clé importée sans clé se retrouve par son identifiant", () => {
  const actuelles = [page("p1", null, "<p>état</p>", 500, { name: "Page etat", _stats: neuve })];
  const { creer, maj } = planMiseAJour(ID, actuelles, [page("p1", "etat", "<p>état</p>", 500)]);
  assert.deepEqual(creer, []);
  assert.deepEqual(maj, [{ _id: "p1", [`flags.${ID}.cle`]: "etat", [`flags.${ID}.empreinte`]: empreinte("<p>état</p>") }]);
});

test("plan : les pages du MJ IA ne sont jamais touchées", () => {
  const ajoutee = page("ia1", null, "<p>écrite par l'IA</p>", 950, { _stats: neuve, flags: { "lakour-mj-ia": { ajoutee: true }, [ID]: { empreinte: empreinte("<p>écrite par l'IA</p>") } } });
  const reecrite = page("p1", "etat", "<p>réécrite</p>", 500, { _stats: neuve, flags: { [ID]: { cle: "etat" }, "lakour-mj-ia": { historique: [{ avant: "x" }] } } });
  assert.equal(pageDuMjIa(ajoutee), true);
  assert.deepEqual(planMiseAJour(ID, [ajoutee, reecrite], [page("p1", "etat", "<p>nouvel état</p>", 500)]), vide);
});

test("plan : une page du module retirée du compendium part si elle est intacte", () => {
  const vieille = avecEmpreintes(ID, [page("v1", "ancienne", "<p>ancienne</p>", 100)])[0];
  const vieilleRetouchee = { ...avecEmpreintes(ID, [page("v2", "ancienne2", "<p>x</p>", 200)])[0], text: { content: "<p>x modifié</p>" } };
  assert.deepEqual(planMiseAJour(ID, [vieille, vieilleRetouchee], []).supprimer, ["v1"]);
});

test("plan : une seconde passe ne change plus rien", () => {
  const modeles = [page("p1", "etat", "<p>état</p>", 500), page("z1", "zerbaz", "<p>zerbaz</p>", 800), page("s9", null, "<p>sans clé</p>", 900)];
  const actuelles = avecEmpreintes(ID, modeles).map(p => ({ ...p, _stats: retouchee }));
  assert.deepEqual(planMiseAJour(ID, actuelles, modeles), vide);
});

test("plan : un identifiant de page déjà pris n'est pas réutilisé", () => {
  const actuelles = [page("z1", "autre", "", 10)];
  const { creer } = planMiseAJour(ID, actuelles, [page("z1", "zerbaz", "<p>zerbaz</p>", 800)]);
  assert.equal(creer[0]._id, undefined);
});

test("le numéro de contenu de l'installateur suit module.json", () => {
  const main = readFileSync(new URL("scripts/main.js", RACINE), "utf8");
  const module = JSON.parse(readFileSync(new URL("module.json", RACINE), "utf8"));
  assert.equal(main.match(/const VERSION_CONTENU = "([^"]+)"/)?.[1], module.version);
});
