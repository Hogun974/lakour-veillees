// Le genre des personnages et les accords des messages (parties en vrai, 7 novembre 2026) : « Ondine Malefosse (homme…) », « femme, vieux »,
// « Edmée Vaissière, le Hobereau, gracie Edmée Vaissière : il n'est pas exécuté », « Tour 5 · generee » sur la Table.
// - le genre suit le prénom (logique/prenoms.mjs ; scripts/api.mjs, traitsImposes) : un trait posé à la main passe avant, l'âge reste tiré ;
// - les marques de genre « [masculin|féminin] » (logique/grammaire.mjs), branchées sur les villageois nommés (scripts/donnees.mjs, t) ;
// - les titres des personnalités au féminin (Village.Personnalites.<p>.Femme / Homme) ; le Hobereau qui se gracie lui-même ;
// - le libellé de la composition dans l'en-tête de la Table (logique/composition.mjs, libelleDeLaComposition), jamais la clé brute ;
// - la Liseuse de cendres dans toute composition tirée du niveau « Le Pacte » (ROLES_DU_NIVEAU).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as L from "../systems/lakour-loups/logique/index.mjs";
import { remplir, aDesMarquesDeGenre } from "../systems/lakour-loups/logique/grammaire.mjs";
import { lecteurDeGabarit } from "../systems/lakour-loups/logique/politiques.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS, CIBLES } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { compositions } from "../modules/lakour-veillees/contenu/compositions.mjs";
import { installerFoundry, creerObjetMonde, messages } from "./doublures/foundry-loups.mjs";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const lire = f => readFileSync(join(RACINE, f), "utf8");
const FR = JSON.parse(lire("systems/lakour-loups/lang/fr.json"));
const EN = JSON.parse(lire("systems/lakour-loups/lang/en.json"));
const chemin = (o, c) => c.split(".").reduce((x, k) => x?.[k], o);
const aplatir = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? aplatir(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const variables = g => [...g.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
const genres = { Edmée: "femme", Colin: "homme", Ondine: "femme" };
const genreDe = v => genres[v] ?? "";

test("grammaire : [masculin|féminin] suit la donnée qui nomme quelqu'un — la dernière avant, sinon la suivante, sinon la clé nommée", () => {
  const g = (gabarit, d, o = {}) => remplir(gabarit, d, { genreDe, ...o });
  assert.equal(g("{hobereau}, [le Hobereau|la Hobereaute], gracie {nom} : [il|elle] n'est pas exécuté[|e].", { hobereau: "Edmée", nom: "Colin" }),
    "Edmée, la Hobereaute, gracie Colin : il n'est pas exécuté.");
  assert.equal(g("{hobereau}, [le Hobereau|la Hobereaute], gracie {nom} : [il|elle] n'est pas exécuté[|e].", { hobereau: "Colin", nom: "Edmée" }),
    "Colin, le Hobereau, gracie Edmée : elle n'est pas exécutée.");
  assert.equal(g("Juger [l'accusé|l'accusée] : {nom}", { nom: "Ondine" }), "Juger l'accusée : Ondine", "la donnée qui suit, faute de mieux");
  assert.equal(g("{nom} contre {cible} : [nom:il|elle] perd, {cible} est désigné[|e]", { nom: "Edmée", cible: "Colin" }), "Edmée contre Colin : elle perd, Colin est désigné");
  assert.equal(g("{nom} est seul[|e]", { nom: "Inconnu" }), "Inconnu est seul", "genre inconnu : le masculin");
  assert.equal(g("[vieux|vieille] ({ans} ans)", { ans: 70 }, { genre: "femme" }), "vieille (70 ans)", "l'option genre, sans personne nommée");
  assert.equal(g("{nom} wins: [he|she] lost [his|her] life.", { nom: "Edmée" }, { langue: "en" }), "Edmée wins: she lost her life.");
  assert.equal(g("{n} loup(s) chez {nom}, [qu'il|qu'elle] dit", { n: 2, nom: "Edmée" }), "2 loups chez Edmée, qu'elle dit", "nombre et genre ensemble");
  assert.equal(remplir("[Morts]", {}), "[Morts]", "un crochet sans | n'est pas une marque");
});

test("langues : chaque marque de genre a sa donnée, et rien ne reste entre crochets, au masculin comme au féminin", () => {
  let vus = 0;
  for (const [langue, dico] of [["fr", FR], ["en", EN]]) {
    for (const [cle, gabarit] of aplatir(dico)) {
      if (!aDesMarquesDeGenre(gabarit)) continue;
      vus++;
      // Une marque sans donnée resterait brute (t() sans données ne remplit rien) — sauf les causes de mort et l'âge, accordés par genre.
      assert.ok(variables(gabarit).length || /\.(Causes)\./.test(cle) || /^LAKOUR_LOUPS\.Causes\./.test(cle), `${langue} ${cle} : une marque sans donnée`);
      for (const genre of ["femme", "homme"]) {
        const d = Object.fromEntries(variables(gabarit).map(k => [k, "X"]));
        const texte = remplir(gabarit, d, { langue, genre });
        assert.doesNotMatch(texte, /\[[^\]]*\|[^\]]*\]/, `${langue} ${cle} : ${texte}`);
      }
    }
  }
  assert.ok(vus >= 100, `${vus} gabarits accordés`);
  // Les messages relevés en vrai, accordés au féminin.
  const fem = (cle, d) => remplir(chemin(FR, cle), d, { genreDe });
  assert.equal(fem("LAKOUR_LOUPS.Village.GraceSoi", { hobereau: "Edmée", nom: "Edmée" }), "Edmée, la Hobereaute, se gracie elle-même : elle n'est pas exécutée, et sa carte reste cachée.");
  assert.equal(fem("LAKOUR_LOUPS.Village.ImmunitePerdue", { nom: "Edmée", cible: "Colin" }), "Edmée, la Cabaretière, a voté contre Colin, que le vote a désigné : elle perd son immunité.");
  assert.equal(fem("LAKOUR_LOUPS.Traits.Age.vieux", { ans: 70, genre: "femme" }), "[vieux|vieille] (70 ans)".replace("[vieux|vieille]", "vieux"), "sans option : le masculin");
  assert.equal(remplir(chemin(FR, "LAKOUR_LOUPS.Traits.Age.vieux"), { ans: 70 }, { genre: "femme" }), "vieille (70 ans)");
  assert.equal(remplir(chemin(EN, "LAKOUR_LOUPS.Village.GraceSoi"), { hobereau: "Edmée", nom: "Edmée" }, { langue: "en", genreDe }), "Edmée, the Squire, pardons herself: no execution, and her card stays hidden.");
  // Les titres des personnalités : chacune a sa forme féminine (la Fournière, au livre, a sa forme masculine).
  for (const [p, x] of Object.entries(FR.LAKOUR_LOUPS.Village.Personnalites)) assert.ok(x.Femme || x.Homme, `${p} : ni Femme ni Homme`);
  assert.deepEqual(Object.fromEntries(Object.entries(FR.LAKOUR_LOUPS.Village.Personnalites).map(([p, x]) => [p, x.Femme ?? x.Nom])), {
    metayer: "Métayère", prieur: "Prieure", remegeux: "Remégeuse", regent: "Régente", fourniere: "Fournière", perruquier: "Perruquière",
    cabaretier: "Cabaretière", prevot: "Prévôte", hobereau: "Hobereaute", chemineau: "Chemineaude" });
  assert.equal(FR.LAKOUR_LOUPS.Village.Personnalites.fourniere.Homme, "Fournier");
  // Ce qui disait « il » d'un joueur n'existe plus, en français, dans les messages relevés.
  for (const cle of ["Village.Grace", "Village.ImmunitePerdue", "Pacte.Grace", "Nuit.AieulMorsure", "Ambigus.Devouement", "Ambigus.BailliPerdu", "Gazette.Revenante"]) {
    assert.doesNotMatch(chemin(FR.LAKOUR_LOUPS, cle), /(^|[\s:;,.])(il|elle) /, `${cle} : un pronom figé`);
  }
});

test("les politiques lisent le carnet sous l'une ou l'autre forme (« chez lui » / « chez elle »)", () => {
  const re = lecteurDeGabarit(FR.LAKOUR_LOUPS.Village.Fourniere);
  for (const genre of ["femme", "homme"]) {
    const texte = remplir(FR.LAKOUR_LOUPS.Village.Fourniere, { nom: "Ondine Malefosse" }, { genre });
    assert.equal(re.exec(texte)?.groups?.nom, "Ondine Malefosse", texte);
  }
});

test("prénoms : chaque nom de la table du village a son genre ; un prénom porté par les deux ne dit rien", () => {
  const table = lire("modules/lakour-veillees/contenu/tables.mjs");
  const noms = JSON.parse(`[${table.match(/const NOMS = \[([\s\S]*?)\];/)[1]}]`);
  assert.ok(noms.length >= 40);
  for (const n of noms) assert.ok(["femme", "homme"].includes(L.genreDuPrenom(n)), `${n} : genre inconnu`);
  assert.equal(L.genreDuPrenom("Ondine Malefosse"), "femme");
  assert.equal(L.genreDuPrenom("Félicien Morteau"), "homme");
  assert.equal(L.genreDuPrenom("Edmée Vaissière"), "femme");
  assert.equal(L.genreDuPrenom("Jean-Baptiste Rameau"), "homme");
  assert.equal(L.genreDuPrenom("marie-claude"), "femme");
  for (const n of ["Camille Roux", "Dominique", "Joueur 3", "", "Hogun974"]) assert.equal(L.genreDuPrenom(n), "", n);
  // Le trait tiré respecte le genre imposé (un prénom) et tire encore l'âge.
  const vs = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, maison: `Maison ${i + 1}` }));
  const t = L.tirerTraits(vs, { hasard: L.creerHasard("prenoms"), imposes: { v0: { genre: "femme" }, v1: { genre: "femme" }, v2: { genre: "femme" } } });
  assert.deepEqual([t.v0.genre, t.v1.genre, t.v2.genre], ["femme", "femme", "femme"]);
  assert.equal(Object.values(t).filter(x => x.genre === "femme").length, 4, "les autres équilibrent autour");
  assert.deepEqual(new Set(Object.values(t).map(x => x.age)), new Set(["jeune", "vieux"]), "l'âge reste tiré");
});

test("Table : l'en-tête dit la composition en clair (« composition générée »), jamais sa clé brute", () => {
  const cles = ["generee", "choisie", "reprise", "double-visage", "saint-martin", "le-pacte-08", "classique-12", "debutants-06", "chaos-18", "petite-tablee-06",
    ...Object.keys(compositions()), "ma-composition"];
  for (const [langue, dico] of [["fr", FR], ["en", EN]]) {
    for (const cle of cles) {
      const l = L.libelleDeLaComposition(cle);
      const gabarit = chemin(dico, `LAKOUR_LOUPS.Table.Composition.${l.cle}`);
      assert.equal(typeof gabarit, "string", `${langue} : Table.Composition.${l.cle}`);
      const donnees = l.donnees ? { ...l.donnees, ...(l.donnees.niveau ? { niveau: chemin(dico, `LAKOUR_LOUPS.Table.Composition.Niveaux.${l.donnees.niveau}`) } : {}) } : {};
      const texte = remplir(gabarit, donnees, { langue });
      assert.notEqual(texte, cle, `${langue} ${cle} : la clé brute`);
      assert.doesNotMatch(texte, /\bgeneree\b|le-pacte|petite-tablee|double-visage|saint-martin|ma-composition|\{|undefined/, `${langue} ${cle} : ${texte}`);
    }
  }
  assert.equal(remplir(FR.LAKOUR_LOUPS.Table.Composition.generee, {}), "composition générée");
  assert.equal(EN.LAKOUR_LOUPS.Table.Composition.generee, "generated composition");
  assert.equal(remplir(FR.LAKOUR_LOUPS.Table.Composition.prete, { niveau: "Le Pacte", n: 8 }), "Le Pacte — 8 joueurs, composition prête");
  assert.equal(L.libelleDeLaComposition(""), null);
  // La Table passe par ce libellé (scripts/apps/table.mjs), jamais par etat.composition tel quel.
  const table = lire("systems/lakour-loups/scripts/apps/table.mjs");
  assert.match(table, /composition: gm \? libelleDeComposition\(etat\.composition\) : ""/);
  assert.doesNotMatch(table, /composition: gm \? etat\.composition/);
});

test("Le Pacte : la Liseuse de cendres dans toute composition tirée, générée comme prête, dès 6 joueurs ; pas ailleurs d'office", () => {
  const eq = { roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS, cibles: CIBLES };
  for (let n = 6; n <= 18; n++) {
    for (let g = 0; g < 12; g++) {
      const c = L.composer(n, eq, { niveau: "le-pacte", graine: `liseuse|${n}|${g}`, essais: 300 });
      assert.ok(c.roles.includes("liseuse-de-cendres"), `le-pacte ${n} (${g}) : ${c.roles.join(", ")}`);
    }
    const prete = compositions()[`le-pacte-${String(n).padStart(2, "0")}`];
    assert.ok(prete.roles.includes("liseuse-de-cendres"), `composition prête le-pacte-${n}`);
    // Les cibles extrêmes aussi (la Liseuse entre avant le dosage des pouvoirs).
    for (const cible of [-60, 60]) assert.ok(L.composer(n, eq, { niveau: "le-pacte", cible, graine: "borne", essais: 300 }).roles.includes("liseuse-de-cendres"));
  }
  // Exclue à la main, elle reste exclue ; la peste noire la garde (un rôle du Village).
  assert.ok(!L.composer(10, eq, { niveau: "le-pacte", exclure: ["liseuse-de-cendres"], graine: "x" }).roles.includes("liseuse-de-cendres"));
  assert.ok(L.composer(10, eq, { niveau: "le-pacte", peste: true, graine: "x" }).roles.includes("liseuse-de-cendres"));
  // Aux autres niveaux, rien d'imposé (au moins un rôle d'information, comme avant).
  const sans = Array.from({ length: 30 }, (_, g) => L.composer(10, eq, { niveau: "classique", graine: `cl|${g}`, essais: 300 })).filter(c => !c.roles.includes("liseuse-de-cendres"));
  assert.ok(sans.length > 0, "le classique ne l'impose pas");
  assert.deepEqual(L.ROLES_DU_NIVEAU, { "le-pacte": ["liseuse-de-cendres"] });
});

// ------------------------------------------------------------------ l'API, sur la doublure de Foundry
test("API : le personnage d'un joueur prend le genre de son prénom ; un trait posé sur l'acteur passe avant ; « la Cabaretière » sur la Table", async () => {
  installerFoundry({ joueurs: 6, contenu: true });
  const [{ api }, socket, reglages] = await Promise.all(["scripts/api.mjs", "scripts/socket.mjs", "scripts/reglages.mjs"].map(f => import(new URL(`../systems/lakour-loups/${f}`, import.meta.url).href)));
  reglages.enregistrerReglages(() => {});
  socket.ecouterSocket();
  game.lakourLoups = api;
  api.resolveurs.compagnon = null;
  for (const [cle, v] of [["delaiChoix", 1], ["masques", false], ["bailli", false]]) await game.settings.set("lakour-loups", cle, v);
  const noms = ["Ondine Malefosse", "Félicien Morteau", "Edmée Vaissière", "Colin Hautecœur", "Camille Roux", "Joueur 6"];
  noms.forEach((n, i) => { game.users.get(`u${i + 1}`).name = n; });
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  const loup = role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } });
  const vil = role("Villageois", { cle: "villageois" });
  const distribuer = graine => api.distribuer({ roles: [loup, vil, vil, vil, vil, vil], metiers: [], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine,
    composition: "essai", batiments: [], village: true });
  await distribuer("prenoms");
  const acteur = n => game.actors.find(a => a.type === "villageois" && a.name === n);
  const traits = () => game.settings.get("lakour-loups", "partie").traits;
  assert.deepEqual(noms.slice(0, 4).map(n => traits()[acteur(n).id].genre), ["femme", "homme", "femme", "homme"]);
  assert.match(api.traits(acteur("Ondine Malefosse").id).texte, /^femme, (jeune|vieille) \(\d+ ans\)/);
  // Un trait posé à la main l'emporte sur le prénom.
  acteur("Ondine Malefosse").flags["lakour-loups"] = { traits: { genre: "homme" } };
  await distribuer("prenoms-2");
  assert.equal(traits()[acteur("Ondine Malefosse").id].genre, "homme");
  delete acteur("Ondine Malefosse").flags["lakour-loups"];
  await distribuer("prenoms-3");
  // La personnalité au féminin pour une femme, au masculin pour un homme (titre public : api.village, api.personnalite).
  await api.installer("cabaret", acteur("Edmée Vaissière").id);
  await api.installer("fournil", acteur("Colin Hautecœur").id);
  assert.equal(api.personnalite(acteur("Edmée Vaissière").id).titre, "Cabaretière");
  assert.equal(api.personnalite(acteur("Colin Hautecœur").id).titre, "Fournier");
  const k = messages.length;
  await api.installer("prevote", acteur("Ondine Malefosse").id);
  assert.match(messages.slice(k).map(m => m.content).join("\n"), /Ondine Malefosse tient désormais Le? ?\S*.*\(Prévôte\)/);
});
