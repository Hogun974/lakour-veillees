// Essais des journaux et des tables de lakour-veillees : guide du joueur visible (règles, déroulement, tous les rôles,
// métiers et bâtiments), guide du narrateur caché (rythme, ambiance, MJ IA, morts, égalités, ordre de réveil),
// variantes visibles, livre de Brumecombe visible (l'univers, sans règle ni secret) ; tables d'au moins 20 résultats ; textes originaux (aucune référence à un jeu édité).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fabriquer, verifierDocuments } from "../outils/fabriquer-veillees.mjs";
import { ordreDeReveil } from "../modules/lakour-veillees/contenu/guides.mjs";
import { FETES_VEILLEES, imageDeFete } from "../modules/lakour-veillees/scripts/fetes.js";
import { identifiant } from "../modules/lakour-veillees/contenu/aides.mjs";

const M = "lakour-veillees";
const docs = fabriquer();
const journal = cle => docs.find(d => d.pack === "journaux" && d.doc.flags[M].cle === cle);
const texte = d => d.doc.pages.map(p => `${p.name} ${p.text?.content ?? ""}`).join(" ").replace(/<[^>]+>/g, " ");
const attendre = (liste, motif) => {
  const erreurs = verifierDocuments(liste);
  assert.ok(erreurs.some(e => motif.test(e)), `${motif} attendu, obtenu : ${erreurs.join(" ; ") || "aucune erreur"}`);
};

test("huit journaux : guide du joueur visible, guide du narrateur caché, variantes et livre de Brumecombe visibles, une veillée de fête illustrée par fête", () => {
  assert.equal(docs.filter(d => d.pack === "journaux").length, 4 + FETES_VEILLEES.length);
  assert.equal(journal("livre-de-brumecombe").doc.ownership.default, 2);
  assert.equal(journal("guide-du-joueur").doc.ownership.default, 2);
  assert.equal(journal("guide-du-narrateur").doc.ownership.default, 0);
  assert.equal(journal("regles-des-variantes").doc.ownership.default, 2);
  for (const d of docs.filter(x => x.pack === "journaux")) for (const p of d.doc.pages) assert.equal(p.ownership.default, -1, `${d.doc.name} / ${p.name} hérite du journal`);
});

test("guide du joueur : règles, nuit, jour, vote, égalité, et tous les rôles, métiers et bâtiments", () => {
  const t = texte(journal("guide-du-joueur"));
  for (const mot of ["nuit", "aube", "débat", "vote", "Égalité", "Village", "Meute", "solitaires", "amants", "message privé", "Table de jeu"]) assert.ok(t.includes(mot), mot);
  for (const d of docs.filter(x => ["roles", "metiers", "batiments"].includes(x.pack))) assert.ok(t.includes(d.doc.name), d.doc.name);
  // Aucun secret de partie ni conseil de narrateur dans le guide du joueur.
  assert.doesNotMatch(t, /MJ IA|ordreDeNuit/);
});

test("guide du narrateur : mener, rythme, ambiance gothique d'automne, conseils pour un MJ IA, morts et égalités", () => {
  const t = texte(journal("guide-du-narrateur"));
  for (const mot of ["Mener la nuit", "rythme", "automne", "gothique", "MJ IA", "message privé", "égalité", "Raconter une mort", "Cas particuliers", "chronique"]) {
    assert.ok(t.toLowerCase().includes(mot.toLowerCase()), mot);
  }
  // L'ordre de réveil du guide suit les rôles : la meute groupée, l'Entremetteuse d'abord, le Fossoyeur en dernier.
  const ordre = ordreDeReveil();
  assert.equal(ordre[0].texte, "Entremetteuse (première nuit seulement)");
  assert.equal(ordre.at(-1).texte, "Fossoyeur");
  assert.equal(ordre.filter(e => e.texte.startsWith("La meute")).length, 1);
  for (const e of ordre) assert.ok(t.includes(e.texte), e.texte);
});

test("variantes : révélation, nombre de loups, temps de débat, rôles autorisés, ambiance", () => {
  const t = texte(journal("regles-des-variantes")).toLowerCase();
  for (const mot of ["révélation à la mort", "nombre de loups", "temps de débat", "rôles autorisés", "ambiance", "comique"]) assert.ok(t.includes(mot), mot);
});

test("quatre tables d'au moins 20 résultats : noms, rumeurs, présages, morts mystérieuses", () => {
  const tables = docs.filter(d => d.pack === "tables");
  assert.deepEqual(tables.map(d => d.doc.flags[M].cle).sort(), ["morts-mysterieuses", "noms-de-villageois", "presages-de-l-aube", "rumeurs"]);
  for (const d of tables) {
    assert.ok(d.doc.results.length >= 20, d.doc.name);
    assert.equal(new Set(d.doc.results.map(r => r.description)).size, d.doc.results.length, `${d.doc.name} : doublon`);
  }
});

test("textes originaux : aucune référence au jeu édité dans le module ni dans le contenu", () => {
  const fichiers = dossier => readdirSync(dossier).flatMap(n => {
    const c = join(dossier, n);
    return statSync(c).isDirectory() ? (["packs", "jetons"].includes(n) ? [] : fichiers(c)) : [c];
  });
  for (const f of fichiers(`modules/${M}`).filter(f => /\.(mjs|js|json|md|hbs)$/.test(f))) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /thiercelieux/i, f);
  }
});

test("veillées de fête : un journal visible par fête, l'illustration en tête, la fête puis ses règles ; guides et variantes en parlent", () => {
  assert.deepEqual(FETES_VEILLEES.map(f => f.fete).sort(), ["carnaval", "halloween", "noel", "saint-valentin"]);
  for (const f of FETES_VEILLEES) {
    const j = journal(f.journal.cle);
    assert.ok(j, f.journal.cle);
    assert.equal(j.doc._id, identifiant(`journaux:${f.journal.cle}`), "l'identifiant de scripts/fetes.js est celui du compendium");
    assert.equal(j.doc._id, f.journal.id);
    assert.equal(j.doc.ownership.default, 2, "visible des joueurs");
    assert.equal(j.doc.pages[0].type, "image");
    assert.equal(j.doc.pages[0].src, `modules/lakour-veillees/assets/fetes/${f.fete}.jpg`);
    assert.equal(j.doc.pages[0].src, imageDeFete(f.fete));
    assert.ok(existsSync(j.doc.pages[0].src), "image provisoire présente");
    assert.deepEqual(j.doc.pages.slice(1).map(p => p.name), ["La fête à Brumecombe", "Les règles de la veillée"]);
    assert.ok(texte(j).includes("narrateur ne"), "le narrateur ne confirme jamais un secret de fête");
    assert.ok(f.description.length <= 600 && f.consigne.length <= 300, "limites du moteur");
    assert.match(f.consigne, /ne dis jamais/, "la consigne garde les secrets");
  }
  const joueur = texte(journal("guide-du-joueur")), narrateur = texte(journal("guide-du-narrateur")), variantes = texte(journal("regles-des-variantes"));
  for (const f of FETES_VEILLEES) for (const t of [joueur, narrateur]) assert.ok(t.includes(f.nom), f.nom);
  assert.match(variantes, /Veillées de fête/);
  assert.match(narrateur, /ne les confirme ni ne les démens/);
});

// ---------------------------------------------------------------- Mutations

test("mutation : guide du narrateur rendu visible, guide du joueur caché, page vide, rôle oublié du guide", () => {
  const avec = (cle, f) => docs.map(d => {
    const c = structuredClone(d);
    if (c.cle === `journaux:${cle}`) f(c.doc);
    return c;
  });
  attendre(avec("guide-du-narrateur", d => { d.ownership.default = 2; }), /Guide du narrateur : visibilité 2 au lieu de 0/);
  attendre(avec("guide-du-joueur", d => { d.ownership.default = 0; }), /Guide du joueur : visibilité 0 au lieu de 2/);
  attendre(avec("regles-des-variantes", d => { d.pages[0].text.content = "<p> </p>"; }), /page vide/);
  attendre(avec("guide-du-joueur", d => { for (const p of d.pages) p.text.content = p.text.content.replaceAll("Herboriste", "Guérisseuse"); }), /ne cite pas « Herboriste »/);
  attendre(docs.filter(d => d.cle !== "journaux:guide-du-narrateur"), /journal guide-du-narrateur absent/);
  attendre(docs.filter(d => d.cle !== "journaux:fete-nuit-des-ames"), /journal fete-nuit-des-ames absent/);
  attendre(avec("fete-veillee-d-hiver", d => { d.pages[0].src = "modules/lakour-veillees/assets/monde/fond.jpg"; }), /illustration .* au lieu de modules\/lakour-veillees\/assets\/fetes\/noel\.jpg/);
  attendre(avec("fete-carnaval-des-masques", d => { d.pages[0].src = "modules/lakour-veillees/assets/fetes/absente.jpg"; }), /illustration/);
  attendre(avec("fete-fete-des-promis", d => { d.ownership.default = 0; }), /visibilité 0 au lieu de 2/);
  attendre(avec("fete-nuit-des-ames", d => { d.pages[2].text.content = "<p> </p>"; }), /page vide/);
  attendre(avec("fete-nuit-des-ames", d => { d._id = "autreIdentifian"; d._key = "!journal!autreIdentifian"; }), /identifiant autreIdentifian/);
});

test("mutation : table trop courte ou mal numérotée", () => {
  const avec = f => docs.map(d => {
    const c = structuredClone(d);
    if (c.cle === "tables:rumeurs") f(c.doc);
    return c;
  });
  attendre(avec(d => { d.results = d.results.slice(0, 12); d.formula = "1d12"; }), /12 résultats seulement/);
  attendre(avec(d => { d.results[4].range = [9, 9]; }), /plage 9,9 au rang 5/);
  attendre(avec(d => { d.formula = "1d6"; }), /formule 1d6/);
});
