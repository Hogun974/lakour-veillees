// Les politiques par rôle (systems/lakour-loups/logique/politiques.mjs, Le Pacte, étape 6) : chaque effet de rôle du contenu, chaque
// pouvoir de jour et chaque geste a sa politique ; le savoir se lit dans le carnet en français comme en anglais ; à l'adresse 1, chacun
// use de ce qu'il sait (la Liseuse sonde un inconnu, le village vote contre un loup connu, le Garde protège un rôle utile révélé,
// l'Herboriste sauve et empoisonne un loup connu, la meute vise d'abord les rôles d'information) ; à l'adresse 0, le hasard. Étape 6c :
// la méfiance envers le Joueur de vielle (les charmés le cherchent ensemble parmi les non-charmés, l'accusent au débat ; le village
// vote contre un accusé quand la vielle menace ; la meute le vise sous la même menace).
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

test("Joueur de vielle (étape 6c) : les charmés le cherchent ensemble parmi les non-charmés, en français comme en anglais", () => {
  const charme = (moi, autres, dico = FR) => P.savoirDuJoueur({ moi, camp: "village", villageois: VILLAGE, gabarits: dico, nomsDesRoles: NOMS, nomsDesCamps: CAMPS(dico), roles: EQUILIBRE,
    textes: [remplir(dico.Ambigus.Charmes, { noms: autres.map(id => `Nom ${id.toUpperCase()}`).join(", ") })] });
  // Trois charmés (a, b, c) : le Joueur de vielle est parmi d … h ; pas encore de menace (cinq non-charmés).
  for (const dico of [FR, EN]) {
    const s = charme("a", ["b", "c"], dico);
    assert.deepEqual([s.charmes.sort(), s.vielle, s.vielleEnJeu, s.menaceDeLaVielle], [["a", "b", "c"], ["d", "e", "f", "g", "h"], true, false], dico === FR ? "fr" : "en");
  }
  // Un innocent connu n'est pas suspect ; le Joueur de vielle lui-même ne se cherche pas.
  const vu = P.savoirDuJoueur({ moi: "a", camp: "village", villageois: VILLAGE, gabarits: FR, nomsDesRoles: NOMS, nomsDesCamps: CAMPS(FR), roles: EQUILIBRE,
    textes: [remplir(FR.Ambigus.Charmes, { noms: "Nom B, Nom C" }), remplir(FR.Nuit.VoirCamp, { nom: "Nom E", camp: FR.Camps.village })] });
  assert.ok(!vu.vielle.includes("e"));
  assert.equal(savoir({ role: "joueur-de-vielle", charmesAppeles: 2 }).vielleEnJeu, false);
  // Cinq charmés (a … e) : il ne reste que f, g, h — la vielle peut gagner cette nuit. Chaque charmé vote le même suspect, avant même
  // un loup connu ; il l'accuse au débat.
  const h = creerHasard("vielle");
  const tous = ["a", "b", "c", "d", "e"];
  const votes = new Set(tous.map(moi => {
    const s = charme(moi, tous.filter(x => x !== moi));
    assert.equal(s.menaceDeLaVielle, true, `${moi} : la menace`);
    return P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: s, adresse: 1, hasard: h, place: { rumeur: "b" } });
  }));
  assert.equal(votes.size, 1, `les charmés s'accordent (${[...votes]})`);
  assert.ok(["f", "g", "h"].includes([...votes][0]));
  const avecLoup = P.savoirDuJoueur({ ...{ moi: "a", camp: "village", villageois: VILLAGE, gabarits: FR, nomsDesRoles: NOMS, nomsDesCamps: CAMPS(FR), roles: EQUILIBRE },
    textes: [remplir(FR.Ambigus.Charmes, { noms: "Nom B, Nom C, Nom D, Nom E" }), remplir(FR.Nuit.VoirRole, { nom: "Nom B", role: "Loup de Brumecombe", camp: FR.Camps.meute })] });
  assert.ok(["f", "g", "h"].includes(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: avecLoup, adresse: 1, hasard: h, place: { rumeur: "b" } })), "la vielle d'abord : elle gagne cette nuit");
  const dit = P.annoncesDuJoueur({ savoir: charme("a", ["b", "c", "d", "e"]), adresse: 1, hasard: h, vivants: VILLAGE.map(v => v.id) });
  assert.deepEqual(dit, [{ cible: [...votes][0], camp: "solitaire" }]);
  // Trois charmés, cinq suspects : pas encore d'accusation (trop de suspects, pas de menace).
  assert.deepEqual(P.annoncesDuJoueur({ savoir: charme("a", ["b", "c"]), adresse: 1, hasard: h, vivants: VILLAGE.map(v => v.id) }), []);
  // À l'adresse 0, un charmé vote au hasard (comme avant).
  const auHasard = new Set(Array.from({ length: 60 }, () => P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: charme("a", ["b", "c", "d", "e"]), adresse: 0, hasard: h, place: { rumeur: "b" } })));
  assert.ok(auHasard.size > 2, "au hasard, n'importe qui");
});

test("Joueur de vielle (étape 6c) : le village vote contre un accusé quand la vielle menace ; la meute le vise aussi", () => {
  // g ne l'est pas, charmé : il entend le narrateur appeler les charmés (trois nuits : huit vivants, six charmés au plus — la menace).
  // a l'accuse (une annonce « solitaire ») ; e accuse h d'être un loup.
  const annonces = [{ par: "a", cible: "f", camp: "solitaire" }, { par: "e", cible: "h", camp: "meute" }];
  const h = creerHasard("village-vielle");
  const pour = (charmesAppeles, o = {}) => P.savoirDuJoueur({ moi: "g", camp: "village", villageois: VILLAGE, gabarits: FR, nomsDesRoles: NOMS, nomsDesCamps: CAMPS(FR), roles: EQUILIBRE, annonces, charmesAppeles, ...o });
  const menace = pour(3);
  assert.deepEqual([menace.vielleEnJeu, menace.menaceDeLaVielle, menace.vielle, menace.vielleConnue], [true, true, ["f"], ["f"]]);
  for (let i = 0; i < 10; i++) assert.equal(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: menace, adresse: 1, hasard: h, place: { rumeur: "h" } }), "f", "sous la menace : l'accusé");
  for (let i = 0; i < 10; i++) assert.equal(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: pour(1), adresse: 1, hasard: h, place: { rumeur: "h" } }), "h", "sans menace : le loup annoncé");
  // Un loup connu passe avant (le village ne sait la menace qu'à peu près).
  const loupConnu = pour(3, { textes: [remplir(FR.Nuit.VoirRole, { nom: "Nom B", role: "Loup de Brumecombe", camp: FR.Camps.meute })] });
  assert.equal(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: loupConnu, adresse: 1, hasard: h, place: { rumeur: "h" } }), "b");
  // La rumeur du jour compte l'accusation.
  assert.equal(P.rumeurDuJour({ candidats: ["c", "f"], annonces, adresse: 1, hasard: h }), "f");
  // La meute (a, avec b) : un utile d'abord (la Liseuse révélée, d, ou c qui a parlé) ; sous la menace, l'accusé (f), la nuit comme au vote.
  const vus = VILLAGE.map(v => (v.id === "d" ? { ...v, revele: true, camp: "village", role: "liseuse-de-cendres" } : v));
  const loup = n => P.savoirDuJoueur({ moi: "a", camp: "meute", allies: ["b"], villageois: vus, roles: EQUILIBRE, annonces: [{ par: "c", cible: "f", camp: "solitaire" }], charmesAppeles: n });
  assert.ok(["c", "d"].includes(P.politiqueDeNuit({ effet: "tuer", candidats: candidats(["c", "d", "e", "f", "g"]), savoir: loup(1), adresse: 1, hasard: h, roles: EQUILIBRE })[0]));
  assert.deepEqual(P.politiqueDeNuit({ effet: "tuer", candidats: candidats(["c", "d", "e", "f", "g"]), savoir: loup(3), adresse: 1, hasard: h, roles: EQUILIBRE }), ["f"]);
  assert.equal(P.politiqueDeVote({ candidats: VILLAGE.map(v => v.id), savoir: loup(3), adresse: 1, hasard: h, place: { rumeur: "c", proie: "e" } }), "f");
  // Une accusation de vielle contre un loup révélé ne fait pas de son auteur un menteur.
  const loupRevele = VILLAGE.map(v => (v.id === "f" ? { ...v, vivant: false, revele: true, camp: "meute", role: "loup-de-brumecombe" } : v));
  assert.deepEqual(pour(3, { villageois: loupRevele }).menteurs, []);
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
