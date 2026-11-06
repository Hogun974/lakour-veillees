// Les politiques par rôle (systems/lakour-loups/logique/politiques.mjs, Le Pacte, étape 6) : chaque effet de rôle du contenu, chaque
// pouvoir de jour et chaque geste a sa politique ; le savoir se lit dans le carnet en français comme en anglais ; à l'adresse 1, chacun
// use de ce qu'il sait (la Liseuse sonde un inconnu, le village vote contre un loup connu, le Garde protège un rôle utile révélé,
// l'Herboriste sauve et empoisonne un loup connu, la meute vise d'abord les rôles d'information) ; à l'adresse 0, le hasard.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../systems/lakour-loups/logique/politiques.mjs";
import { POUVOIRS_JOUR, creerHasard, GESTES } from "../systems/lakour-loups/logique/index.mjs";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";

const FR = JSON.parse(readFileSync(new URL("../systems/lakour-loups/lang/fr.json", import.meta.url), "utf8")).LAKOUR_LOUPS;
const EN = JSON.parse(readFileSync(new URL("../systems/lakour-loups/lang/en.json", import.meta.url), "utf8")).LAKOUR_LOUPS;
const chemin = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const remplir = (g, d) => g.replace(/\{(\w+)\}/g, (_, k) => d[k]);
const NOMS = Object.fromEntries(ROLES.map(r => [r.name, r.system.cle]));
const CAMPS = o => Object.fromEntries(Object.entries(o.Camps).map(([c, l]) => [l, c]));
// Huit villageois : a (moi), b … h.
const VILLAGE = ["a", "b", "c", "d", "e", "f", "g", "h"].map(id => ({ id, nom: `Nom ${id.toUpperCase()}`, vivant: true, revele: false, camp: "", role: "" }));
const savoir = (o = {}) => P.savoirDuJoueur({ moi: "a", camp: "village", villageois: VILLAGE, gabarits: FR, nomsDesRoles: NOMS, nomsDesCamps: CAMPS(FR), roles: EQUILIBRE, ...o });
const candidats = (ids = VILLAGE.map(v => v.id)) => ids.map(id => ({ id, nom: `Nom ${id.toUpperCase()}` }));

test("contrat : chaque effet de rôle du contenu, chaque pouvoir de jour et chaque geste a sa politique", () => {
  const effets = [...new Set(ROLES.map(r => r.system.effet ?? ""))];
  assert.ok(effets.length > 30, `${effets.length} effets lus`);
  for (const e of effets) assert.equal(typeof P.POLITIQUES[e], "function", `effet « ${e} » sans politique`);
  for (const p of Object.keys(POUVOIRS_JOUR)) assert.ok(P.NATURE_DES_POUVOIRS[p], `pouvoir de jour « ${p} » sans nature`);
  for (const g of Object.values(GESTES)) assert.equal(typeof P.POLITIQUES_DES_GESTES[g.objet], "function", `geste « ${g.objet} » sans politique`);
  for (const objet of ["emporter", "votants", "succession", "departage", "chambriere", "supplique", "grace", "prevot", "logement", "chaine"]) {
    assert.equal(typeof P.POLITIQUES_DES_GESTES[objet], "function", `demande « ${objet} » sans politique`);
  }
  // Chaque gabarit lu existe dans les deux langues du système.
  for (const [p] of P.GABARITS_DU_SAVOIR) {
    assert.equal(typeof chemin(FR, p), "string", `fr : ${p}`);
    assert.equal(typeof chemin(EN, p), "string", `en : ${p}`);
  }
});

test("savoir : visions, lanterne, flair, Fournière, tombes, annonces démenties — en français comme en anglais", () => {
  for (const [dico, camps] of [[FR, CAMPS(FR)], [EN, CAMPS(EN)]]) {
    const textes = [
      remplir(dico.Nuit.VoirRole, { nom: "Nom B", role: dico === FR ? "Loup de Brumecombe" : "Loup de Brumecombe", camp: dico.Camps.meute }),
      remplir(dico.Nuit.VoirCamp, { nom: "Nom C", camp: dico.Camps.village }),
      remplir(dico.Nuit.EclairerOui, { nom: "Nom E", loups: "Nom D" }),
      remplir(dico.Nuit.FuretNon, { noms: "Nom F, Nom G" }),
      remplir(dico.Village.Fourniere, { nom: "Nom H" })
    ];
    const s = P.savoirDuJoueur({ moi: "a", camp: "village", villageois: VILLAGE, gabarits: dico, nomsDesRoles: NOMS, nomsDesCamps: camps, roles: EQUILIBRE, textes });
    assert.deepEqual([...s.loups].sort(), ["b", "d", "h"], dico === FR ? "fr" : "en");
    assert.deepEqual([...s.innocents].sort(), ["c", "f", "g"]);
    assert.equal(s.roles.b, "loup-de-brumecombe");
  }
  // Une annonce démentie : « c est un loup », dit par d ; c révélé du Village : d est un menteur, donc un loup.
  const vus = VILLAGE.map(v => (v.id === "c" ? { ...v, vivant: false, revele: true, camp: "village", role: "villageois" } : v));
  const s = savoir({ villageois: vus, annonces: [{ par: "d", cible: "c", camp: "meute" }, { par: "e", cible: "f", camp: "meute" }] });
  assert.deepEqual(s.menteurs, ["d"]);
  assert.ok(s.loups.includes("d"));
  assert.ok(s.soupcons.f >= 3, "une annonce crue : un fort soupçon");
  assert.ok(s.utiles.includes("e"), "qui a parlé est une cible pour la meute");
  // Le Registre : qui a voté contre un loup démasqué est presque sûrement du Village.
  const loupMort = VILLAGE.map(v => (v.id === "b" ? { ...v, vivant: false, revele: true, camp: "meute", role: "loup-de-brumecombe" } : v));
  const r = savoir({ villageois: loupMort, registre: [{ type: "vote", votes: { g: "b", h: "c" }, elus: ["b"] }] });
  assert.ok(r.soupcons.g < 0 && !r.soupcons.h);
});

test("adresse 1 : la Liseuse sonde un inconnu, le village vote contre un loup connu, le Garde protège un utile, l'Herboriste sauve et empoisonne", () => {
  const h = creerHasard("politiques");
  const textes = [remplir(FR.Nuit.VoirRole, { nom: "Nom B", role: "Loup de Brumecombe", camp: FR.Camps.meute }), remplir(FR.Nuit.VoirCamp, { nom: "Nom C", camp: FR.Camps.village })];
  const s = savoir({ textes });
  for (let i = 0; i < 20; i++) {
    const [vu] = P.politiqueDeNuit({ effet: "voir-role", candidats: candidats(), savoir: s, adresse: 1, hasard: h, roles: EQUILIBRE });
    assert.ok(!["a", "b", "c"].includes(vu), `la Liseuse sonde un inconnu (${vu})`);
    assert.equal(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: s, adresse: 1, hasard: h, place: { rumeur: "e" } }), "b");
  }
  // Le Garde : la Liseuse révélée (un rôle d'information), plutôt qu'un autre.
  const vus = VILLAGE.map(v => (v.id === "e" ? { ...v, revele: true, camp: "village", role: "liseuse-de-cendres" } : v));
  for (let i = 0; i < 10; i++) assert.deepEqual(P.politiqueDeNuit({ effet: "proteger", candidats: candidats(["b", "c", "d", "e", "f"]), savoir: savoir({ villageois: vus }), adresse: 1, hasard: h, roles: EQUILIBRE }), ["e"]);
  // L'Herboriste : le remède à la victime, le poison au loup connu.
  const invite = `${remplir(FR.Nuit.ProiesDeLaMeute, { noms: "Nom D" })} ${ROLES.find(r => r.system.cle === "herboriste").system.nuit.invite}`;
  assert.deepEqual(P.politiqueDeNuit({ effet: "remede", candidats: candidats(["b", "c", "d", "e"]), nombre: 2, invite, savoir: s, adresse: 1, hasard: h, roles: EQUILIBRE }), ["d", "b"]);
  // La meute : la Liseuse révélée d'abord, jamais un loup.
  const loup = P.savoirDuJoueur({ moi: "a", camp: "meute", allies: ["b"], villageois: vus, roles: EQUILIBRE });
  for (let i = 0; i < 10; i++) assert.deepEqual(P.politiqueDeNuit({ effet: "tuer", candidats: candidats(["b", "c", "d", "e"]), savoir: loup, adresse: 1, hasard: h, roles: EQUILIBRE }), ["e"]);
  for (let i = 0; i < 10; i++) assert.notEqual(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: loup, adresse: 1, hasard: h, place: { rumeur: "b", proie: "d" } }), "b");
  // Le débat : un villageois adroit dit les loups qu'il a lus (une fois).
  assert.deepEqual(P.annoncesDuJoueur({ savoir: s, adresse: 1, hasard: h, vivants: VILLAGE.map(v => v.id) }), [{ cible: "b", camp: "meute" }]);
  assert.deepEqual(P.annoncesDuJoueur({ savoir: s, adresse: 1, hasard: h, dejaDites: ["b"], vivants: VILLAGE.map(v => v.id) }), []);
});

test("adresse 0 : le hasard (le savoir ne sert pas) ; même graine, mêmes choix", () => {
  const textes = [remplir(FR.Nuit.VoirRole, { nom: "Nom B", role: "Loup de Brumecombe", camp: FR.Camps.meute })];
  const s = savoir({ textes });
  const vus = new Set();
  const h = creerHasard("hasard");
  for (let i = 0; i < 200; i++) for (const id of P.politiqueDeNuit({ effet: "voir-role", candidats: candidats(), savoir: s, adresse: 0, hasard: h })) vus.add(id);
  assert.ok(vus.has("a") && vus.has("b"), "au hasard, la Liseuse peut sonder n'importe qui");
  const tirer = graine => { const g = creerHasard(graine); return Array.from({ length: 30 }, () => P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: s, adresse: 0.5, hasard: g, place: { rumeur: "c" } })); };
  assert.deepEqual(tirer("x"), tirer("x"));
  // Le jour : un pouvoir hostile sur un soupçonné, un pouvoir amical sur un sûr.
  const jour = P.politiqueDuJour({ possibles: [{ pouvoir: "garde", candidats: candidats(["b", "c", "d"]), cibles: 1 }], savoir: s, adresse: 1, hasard: creerHasard("j"), pouvoirs: 1 });
  assert.deepEqual(jour, { pouvoir: "garde", cibles: ["b"] });
  assert.equal(P.annulerLeVote({ elus: ["c"], savoir: savoir({ textes: [remplir(FR.Nuit.VoirCamp, { nom: "Nom C", camp: FR.Camps.village })] }), adresse: 1 }), true);
  assert.equal(P.annulerLeVote({ elus: ["b"], savoir: s, adresse: 1 }), false);
});
