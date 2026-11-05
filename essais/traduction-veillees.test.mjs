// Module anglais lakour-veillees-en (outils/fabriquer-veillees.mjs --langue en, dictionnaires modules/lakour-veillees/contenu/en/*.json,
// outil commun modules/lakour-mj-ia/outils/traduction.mjs) :
// - mêmes documents et mêmes _id (et _key) que le module français, pack par pack ;
// - aucun uuid, chemin d'image ni portée de drapeaux vers « lakour-veillees » sans « -en » ;
// - les CLÉS que le système lakour-loups et le MJ IA lisent ne bougent pas : system.cle, camp, effet, repère et maison, plan de la
//   carte (« Maison 1 »…, « Place du village »), compositions et équilibre ;
// - les dictionnaires sont à jour (aucune entrée obsolète), complets (aucun texte en français), chaque traduction garde les balises ;
// - un même rôle ou bâtiment porte le même nom anglais partout (pages du guide, épingles de la carte, journaux de fête de fetes.js) ;
// - le manifeste anglais : identifiant, conflit avec le module français, étiquettes, dossier, légendes ; libellés des compositions ;
// - scripts/identite.js : l'identifiant français dans node ; l'empaqueteur connaît le module anglais ;
// - sur le disque, si `npm run fabriquer-veillees-en` a tourné : contrat des modules de contenu, assets récrits, figurants traduits.
// Aucun réseau.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fabriquer, fabriquerAnglais, lireDictionnaires, manifesteAnglais, libellesDeCompositions, CLES_NON_TRADUITES, MODULE_EN, OPTIONS_TRADUCTION, TYPE_PACK,
  BATIMENTS_ATTENDUS, cartesAnglaises, lireLibellesDeCartes, traduireSVG } from "../outils/fabriquer-veillees.mjs";
import { textesGraves } from "../modules/lakour-veillees/contenu/cartes.mjs";
import { compositions } from "../modules/lakour-veillees/contenu/compositions.mjs";
import { FETES_VEILLEES, MODULE_FETES, textesDeFete } from "../modules/lakour-veillees/scripts/fetes.js";
import { ANGLAIS, ID, ID_FRANCAIS } from "../modules/lakour-veillees/scripts/identite.js";
import { ecartsBalises, extraire, lireChemin } from "../modules/lakour-mj-ia/outils/traduction.mjs";
import { verifierModuleDeContenu } from "../modules/lakour-mj-ia/outils/contrat-contenu.mjs";
import { PAQUETS, urlsDePublication } from "../outils/empaqueter-paquets.mjs";

const M = "lakour-veillees";
const francais = fabriquer();
const { dictionnaire, packs } = lireDictionnaires();
const { documents: anglais, rapport } = fabriquerAnglais(francais, dictionnaire);
const texteAnglais = JSON.stringify(anglais.map(d => d.doc));
const parCle = new Map(anglais.map(d => [d.cle, d]));
const en = cle => parCle.get(cle).doc;
const fr = cle => francais.find(d => d.cle === cle).doc;

// Tous les _id d'un document, à toute profondeur.
const ids = v => (Array.isArray(v) ? v.flatMap(ids) : v && typeof v === "object" ? [...(typeof v._id === "string" ? [v._id] : []), ...Object.values(v).flatMap(ids)] : []);

test("lakour-veillees-en : mêmes documents, mêmes _id et _key que lakour-veillees, pack par pack", () => {
  assert.equal(anglais.length, francais.length);
  for (const f of francais) {
    const e = parCle.get(f.cle);
    assert.ok(e, `document absent du module anglais : ${f.cle}`);
    assert.equal(e.pack, f.pack);
    assert.equal(e.doc._id, f.doc._id, `${f.cle} : _id différent`);
    assert.equal(e.doc._key, f.doc._key, `${f.cle} : _key différente`);
    assert.deepEqual(ids(e.doc).sort(), ids(f.doc).sort(), `${f.cle} : identifiants embarqués différents`);
  }
});

test("lakour-veillees-en : aucun uuid, chemin ni drapeau vers le module français ; images et drapeaux du module anglais", () => {
  assert.ok(!texteAnglais.includes(`Compendium.${M}.`), "uuid vers lakour-veillees");
  assert.ok(!texteAnglais.includes(`modules/${M}/`), "chemin vers modules/lakour-veillees/");
  assert.ok(!texteAnglais.includes(`"${M}":`), "portée de drapeaux lakour-veillees");
  assert.ok(texteAnglais.includes(`modules/${MODULE_EN}/assets/jetons/`), "les jetons du module anglais sont les siens");
  for (const { cle, doc } of anglais) assert.equal(doc.flags[MODULE_EN]?.cle, fr(cle).flags[M].cle, `${cle} : drapeau cle`);
  const scene = en("scenes:village-de-brumecombe");
  assert.match(scene.levels[0].background.src, new RegExp(`^modules/${MODULE_EN}/assets/cartes/`));
  for (const p of en("journaux:fete-nuit-des-ames").pages.filter(p => p.type === "image")) assert.match(p.src, new RegExp(`^modules/${MODULE_EN}/assets/fetes/`));
});

test("les clés lues par le système et le MJ IA ne sont jamais traduites (system.cle, camp, effet, repère, maison, plan de la carte)", () => {
  assert.deepEqual(CLES_NON_TRADUITES, ["repere", "maison", "nom", "texte"]);
  for (const { cle, doc } of anglais.filter(d => ["roles", "metiers", "batiments", "villageois"].includes(d.pack))) {
    const s = fr(cle).system;
    for (const champ of ["cle", "camp", "effet", "apparence", "victoireCle", "repere", "maison", "jeton"]) {
      if (champ in s) assert.equal(doc.system[champ], s[champ], `${cle} : system.${champ}`);
    }
    assert.equal(doc.img, fr(cle).img.replace(`modules/${M}/`, `modules/${MODULE_EN}/`), `${cle} : image`);
  }
  // Le plan de la carte (lu par logique/plateau.mjs du système : « Maison 1 »…, repères des bâtiments, « Place du village »).
  const plan = en("scenes:village-de-brumecombe").flags[MODULE_EN].plan;
  assert.deepEqual(plan, fr("scenes:village-de-brumecombe").flags[M].plan);
  assert.ok(plan.elements.some(e => e.nom === "Maison 18") && plan.elements.some(e => e.nom === "Cimetière"));
  assert.ok(plan.pieces.some(p => p.nom === "Place du village"));
  // Les repères des bâtiments anglais sont toujours des éléments de la carte.
  const elements = new Set(plan.elements.map(e => e.nom));
  for (const b of anglais.filter(d => d.pack === "batiments")) assert.ok(elements.has(b.doc.system.repere), `${b.cle} : repère ${b.doc.system.repere}`);
  // Les textes, eux, sont bien traduits.
  assert.notEqual(en("batiments:chapelle").name, fr("batiments:chapelle").name);
  assert.notEqual(en("roles:liseuse-de-cendres").system.description, fr("roles:liseuse-de-cendres").system.description);
});

test("dictionnaires contenu/en : un par pack, à jour, complets, sans écart de balises", () => {
  assert.deepEqual(packs.sort(), Object.keys(TYPE_PACK).sort());
  assert.deepEqual(rapport.obsoletes, [], "le français a changé : relancer node outils/fabriquer-veillees.mjs --extraire");
  assert.deepEqual(rapport.erreurs, []);
  assert.deepEqual(rapport.manquants, [], "textes encore en français dans le module anglais");
  const { tout } = extraire(francais, OPTIONS_TRADUCTION);
  for (const [cle, entree] of Object.entries(dictionnaire)) {
    const pack = cle.split("/")[0];
    for (const [chemin, t] of Object.entries(entree)) {
      if (chemin.startsWith("_")) continue;
      assert.equal(tout[pack]?.[cle]?.[chemin]?.fr, t.fr, `${cle}:${chemin} : entrée sans source (relancer --extraire)`);
      assert.ok(t.en, `${cle}:${chemin} : non traduit`);
      assert.deepEqual(ecartsBalises(t.fr, t.en), [], `${cle}:${chemin}`);
      assert.ok(!t.enAncien, `${cle}:${chemin} : enAncien à vérifier`);
    }
  }
});

test("un même rôle ou bâtiment porte le même nom anglais partout : guide, épingles, fêtes, journaux", () => {
  // Noms de rôles : tous traduits (sauf les quelques noms identiques dans les deux langues), tous distincts.
  const nomsRoles = anglais.filter(d => d.pack === "roles").map(d => d.doc.name);
  assert.equal(new Set(nomsRoles).size, nomsRoles.length, "deux rôles portent le même nom anglais");
  const identiques = anglais.filter(d => d.pack === "roles" && d.doc.name === fr(d.cle).name).map(d => d.cle);
  assert.deepEqual(identiques, ["roles:revenant"]);
  // Les pages des bâtiments du guide du joueur portent le nom anglais du bâtiment, et l'épingle de la carte aussi.
  const guide = en("journaux:guide-du-joueur");
  const scene = en("scenes:village-de-brumecombe");
  for (const b of anglais.filter(d => d.pack === "batiments")) {
    const page = guide.pages.find(p => p._id === fr("journaux:guide-du-joueur").pages.find(x => x.name === fr(b.cle).name)._id);
    assert.equal(page.name, b.doc.name, `${b.cle} : page du guide`);
    const note = scene.notes.find(n => n.pageId === page._id);
    assert.equal(note?.text, b.doc.name, `${b.cle} : épingle`);
    assert.ok(guide.pages.find(p => p.name === "The buildings").text.content.includes(`<strong>${b.doc.name}</strong>`), `${b.cle} : liste des bâtiments`);
  }
  // Les listes de rôles du guide citent chaque rôle sous son nom anglais.
  const listes = guide.pages.filter(p => ["The roles of the Pack", "The roles of the Village", "The Loners"].includes(p.name)).map(p => p.text.content).join("");
  for (const r of anglais.filter(d => d.pack === "roles" && !["remouleur", "montreur-d-ours", "pelerine"].includes(d.doc.system.cle))) {
    assert.ok(listes.includes(`<strong>${r.doc.name}</strong>`), `${r.cle} : absent des listes du guide`);
  }
  // L'ordre de réveil du guide du narrateur reprend les invites anglaises des rôles.
  const nuit = en("journaux:guide-du-narrateur").pages.find(p => p.name === "Running the night").text.content;
  for (const r of anglais.filter(d => d.pack === "roles" && d.doc.system.nuit.actif && d.doc.system.camp !== "meute")) {
    assert.ok(nuit.includes(r.doc.system.nuit.invite), `${r.cle} : invite absente de l'ordre de réveil`);
  }
  // Les journaux de fête portent le nom anglais que scripts/fetes.js donne au moteur (textesDeFete, module anglais).
  for (const f of FETES_VEILLEES) {
    const j = anglais.find(d => d.doc._id === f.journal.id);
    assert.equal(j.doc.name, textesDeFete(f, true).journal.nom, f.id);
    assert.equal(j.doc.pages[0].name, f.en.nom, `${f.id} : page d'illustration`);
    assert.ok(guide.pages.find(p => p.name === "The holiday vigils").text.content.includes(`<strong>${f.en.nom}</strong>`), `${f.id} : guide du joueur`);
  }
});

test("manifeste anglais : identifiant, conflit avec le module français, étiquettes, dossier, légendes, adresses ; libellés des compositions", () => {
  const manifeste = JSON.parse(readFileSync(new URL(`../modules/${M}/module.json`, import.meta.url), "utf8"));
  const traductions = JSON.parse(readFileSync(new URL(`../modules/${M}/contenu/en/module.json`, import.meta.url), "utf8"));
  const e = manifesteAnglais(manifeste, traductions);
  assert.equal(e.id, MODULE_EN);
  assert.equal(e.version, manifeste.version);
  assert.equal(e.title, "La Kour — The Vigils of Brumecombe");
  assert.ok(e.relationships.conflicts.some(c => c.id === M && c.type === "module"));
  assert.deepEqual(e.relationships.systems, manifeste.relationships.systems);
  assert.equal(e.packs.length, manifeste.packs.length);
  for (const p of e.packs) { assert.equal(p.label, traductions.packs[p.name], p.name); assert.equal(p.path, `packs/${p.name}`); }
  assert.equal(e.packFolders[0].name, "The Vigils of Brumecombe");
  assert.deepEqual(e.packFolders[0].packs, manifeste.packFolders[0].packs);
  for (const m of e.media) assert.ok(Object.values(traductions.media).includes(m.caption), m.caption);
  assert.match(e.manifest, /lakour-veillees-en\.json$/);
  assert.match(e.download, /lakour-veillees-en\.zip$/);
  assert.deepEqual(e.esmodules, manifeste.esmodules);
  // compositions.json : mêmes clés, mêmes rôles et bâtiments (des clés) ; seuls les libellés changent, tous traduits.
  const compos = compositions();
  const libelles = libellesDeCompositions(compos, traductions.niveaux);
  for (const c of Object.values(compos)) assert.ok(libelles[c.libelle] && libelles[c.libelle] !== c.libelle, c.libelle);
  assert.equal(libelles["Classique — 12 joueurs"], "Classic — 12 players");
  assert.equal(libelles["Petite tablée — 7 places"], "Small table — 7 seats");
});

test("scripts/identite.js : identifiant lu dans l'adresse du script (français dans node) ; fêtes bilingues ; empaqueteur", () => {
  assert.equal(ID, ID_FRANCAIS);
  assert.equal(ANGLAIS, false);
  assert.equal(MODULE_FETES, M);
  for (const f of FETES_VEILLEES) {
    assert.equal(textesDeFete(f), f, "dans node, la fête reste française");
    const t = textesDeFete(f, true);
    assert.ok(t.nom !== f.nom && t.description !== f.description && t.consigne !== f.consigne && t.journal.nom !== f.journal.nom, f.id);
    assert.deepEqual([t.id, t.fete, t.decor, t.journal.cle, t.journal.id], [f.id, f.fete, f.decor, f.journal.cle, f.journal.id]);
    assert.ok(!("en" in t));
  }
  const main = readFileSync(new URL(`../modules/${M}/scripts/main.js`, import.meta.url), "utf8");
  assert.match(main, /import \{ ID \} from "\.\/identite\.js"/);
  assert.ok(!/const ID = "/.test(main), "main.js ne doit plus fixer l'identifiant en dur");
  const paquet = PAQUETS.find(p => p.id === MODULE_EN);
  assert.ok(paquet?.facultatif && paquet.publie === "lakour-veillees-en.json" && paquet.zip === "lakour-veillees-en.zip");
  assert.match(urlsDePublication("Hogun974/lakour-veillees", "v1.0.0", paquet.publie, paquet.zip).manifest, /\/releases\/latest\/download\/lakour-veillees-en\.json$/);
});

const surLeDisque = existsSync(new URL(`../modules/${MODULE_EN}/src`, import.meta.url));
test("lakour-veillees-en sur le disque (si fabriqué) : contrat des modules de contenu, assets récrits, figurants et compositions traduits", { skip: !surLeDisque && "npm run fabriquer-veillees-en n'a pas tourné" }, () => {
  assert.deepEqual(verifierModuleDeContenu(`modules/${MODULE_EN}`, { minFigurants: 10, minJoueurs: 8 }), []);
  const lire = f => JSON.parse(readFileSync(new URL(`../modules/${MODULE_EN}/${f}`, import.meta.url), "utf8"));
  const lireFr = f => JSON.parse(readFileSync(new URL(`../modules/${M}/${f}`, import.meta.url), "utf8"));
  for (const chemin of Object.values(lire("assets/jetons/index.json"))) assert.match(chemin, new RegExp(`^modules/${MODULE_EN}/`));
  assert.deepEqual(lire("assets/cartes/plans.json"), lireFr("assets/cartes/plans.json"), "les plans (des clés) sont les mêmes");
  const figurants = lire("assets/jetons/figurants.json"), figurantsFr = lireFr("assets/jetons/figurants.json");
  assert.deepEqual(Object.keys(figurants), Object.keys(figurantsFr));
  for (const [type, f] of Object.entries(figurants)) { assert.equal(f.jeton, figurantsFr[type].jeton); assert.notEqual(f.libelle, figurantsFr[type].libelle, type); }
  const compos = lire("assets/compositions.json"), composFr = lireFr("assets/compositions.json");
  assert.deepEqual(Object.keys(compos), Object.keys(composFr));
  for (const [cle, c] of Object.entries(compos)) {
    assert.deepEqual({ ...c, libelle: "" }, { ...composFr[cle], libelle: "" }, cle);
    assert.notEqual(c.libelle, composFr[cle].libelle, cle);
  }
  assert.deepEqual(lire("assets/equilibre.json"), lireFr("assets/equilibre.json"));
  assert.ok(existsSync(new URL(`../modules/${MODULE_EN}/scripts/identite.js`, import.meta.url)));
  assert.equal(lire("module.json").id, MODULE_EN);
});

// Cartes anglaises : les fonds SVG du module anglais sont redessinés avec contenu/en/cartes.json (outils/fabriquer-veillees.mjs).
// Libellés français connus : tous ceux du dictionnaire des cartes dont l'anglais diffère, plus les noms français des bâtiments.
const libellesCartes = lireLibellesDeCartes();
const francaisConnus = [...Object.entries(libellesCartes).filter(([fr, en]) => fr !== en).map(([fr]) => fr), ...BATIMENTS_ATTENDUS];
const textesAnglais = svg => textesGraves(svg);

test("cartes anglaises : chaque libellé gravé a sa traduction, aucun texte français connu, noms des épingles anglaises", () => {
  const { fichiers, erreurs } = cartesAnglaises(libellesCartes);
  assert.deepEqual(erreurs, []);
  assert.deepEqual(fichiers.map(f => f.chemin).sort(), ["cartes/3d/village-de-brumecombe.svg", "cartes/village-de-brumecombe.svg"]);
  const epingles = en("scenes:village-de-brumecombe").notes.map(n => n.text);
  for (const { chemin, svg } of fichiers) {
    const textes = textesAnglais(svg);
    for (const t of textes) assert.ok(!francaisConnus.includes(t), `${chemin} : « ${t} » gravé en français`);
    for (const nom of epingles) assert.ok(textes.includes(nom), `${chemin} : « ${nom} » (épingle) absent du fond`);
    assert.ok(textes.includes("Village square"), chemin);
  }
  // Le contrôle mord : un libellé sans entrée ou un libellé laissé en français est signalé.
  const { Puits, ...sansPuits } = libellesCartes;
  assert.ok(cartesAnglaises(sansPuits).erreurs.some(e => e.includes("« Puits »")));
  assert.ok(traduireSVG("<svg><text>Lavoir</text><text><tspan>Mot inconnu</tspan></text></svg>", libellesCartes).inconnus.includes("Mot inconnu"));
});

test("lakour-veillees-en sur le disque (si fabriqué) : aucune image de carte du module anglais ne contient de texte français connu", { skip: !surLeDisque && "npm run fabriquer-veillees-en n'a pas tourné" }, () => {
  const assets = new URL(`../modules/${MODULE_EN}/assets/`, import.meta.url);
  const svgs = readdirSync(assets, { recursive: true }).map(f => String(f).replaceAll("\\", "/")).filter(f => f.endsWith(".svg"));
  assert.ok(svgs.includes("cartes/village-de-brumecombe.svg") && svgs.includes("cartes/3d/village-de-brumecombe.svg"));
  for (const f of svgs) {
    for (const t of textesAnglais(readFileSync(new URL(f, assets), "utf8"))) assert.ok(!francaisConnus.includes(t), `${f} : « ${t} » gravé en français (relancer npm run fabriquer-veillees-en)`);
  }
});
