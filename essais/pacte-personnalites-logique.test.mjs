// Le Pacte, étape 4 (logique pure) : la variante « Le Village » — la proposition de distribution, les personnalités et les Chemineaux
// (publics), les pouvoirs permanents et uniques (servis par un occupant, rétablis pour le suivant, éteints avec la sagesse ou le
// bâtiment brûlé), les Métayers et le Bailli (deuxième jour, entre eux, la succession parmi eux), le Prieur, le Remégeux, le Régent (ses
// privés de vote, sa propre voix), le Perruquier (un loup, ou sa méprise), le Cabaretier (ni proie ni candidat, son immunité perdue),
// le Hobereau (la grâce du vote), la Fournière (une chance), les bâtiments libérés qui attendent le Prévôt, l'Incendiaire (un bâtiment,
// la maison de la proie : le loup à droite carbonisé, pas de victime), la Pie et le Chemineau ; le générateur (l'Incendiaire seulement
// avec la variante, jamais à la petite tablée, toujours à ±2) et le contenu. Chaque règle est cassée à son tour dans une copie de la
// logique, et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { GUIDES, ordreDeReveil } from "../modules/lakour-veillees/contenu/guides.mjs";
import { JETONS_ROLES } from "../modules/lakour-veillees/contenu/jetons.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const sansNuit = { actif: false, cibles: 0 };
const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 } },
  louve: { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41, cibles: 1 } },
  pale: { cle: "loup-pale", nom: "Loup pâle", camp: "meute", effet: "trahir", nuit: { actif: true, ordre: 41, cibles: 1, uneNuitSurDeux: true } },
  incendiaire: { cle: "incendiaire", nom: "Incendiaire", camp: "village", effet: "incendier", nuit: { actif: true, ordre: 19, cibles: 1, soiMeme: true }, usages: { max: 1, restant: 1 } },
  pie: { cle: "pie", nom: "Pie", camp: "village", effet: "plume", nuit: { actif: true, ordre: 46, cibles: 1 } },
  aieul: { cle: "aieul", nom: "Aïeul", camp: "village", effet: "resister", nuit: sansNuit },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: sansNuit }
};
// Huit places, a à h dans l'ordre des maisons (le cercle) ; extra : autre camp, vivant…
const MAISONS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
const v = (id, role = "villageois", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${MAISONS[id]}`,
  silence: false, role: { usages: { max: 0, restant: 0 }, apparence: "", ...structuredClone(ROLE[role]) }, ...extra });
const mort = (vs, ...ids) => vs.map(x => (ids.includes(x.id) ? { ...x, vivant: false } : x));
// Le village de l'essai : a loup, b Prieur, c Régent, d Perruquier, e Cabaretier, f et g Métayers, h Chemineau (Incendiaire, ou Pie).
const village = () => [v("a", "loup"), v("b"), v("c"), v("d"), v("e"), v("f"), v("g"), v("h", "incendiaire")];
const TENURES = { prieure: "b", ecole: "c", echoppe: "d", cabaret: "e", "metairie-1": "f", "metairie-2": "g", masure: "", manoir: "", fournil: "", prevote: "" };
const etatDe = (L, vs, extra = {}) => L.normaliserEtat({ ...L.fixerCercle({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 2 }, vs),
  village: { actif: true }, tenures: { ...TENURES }, ...extra });
const tenures = (L, e, t) => L.normaliserEtat({ ...e, tenures: { ...e.tenures, ...t } });
const nuit = (L, vs, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: 2, hasard: () => 0, cercle: L.ordreDesPlaces(vs), ...extra });
const meute = (cible, par = "a") => ({ acteurId: par, roleCle: "meute", cibles: [cible] });
const pouvoir = (L, e, vs, acteurId, p, cibles = []) => L.appliquerPouvoir({ villageois: vs, etat: e, acteurId, pouvoir: p, cibles, batiments: [] });
const raison = (L, e, vs, acteurId, p, cibles = []) => { const r = L.verifierPouvoir({ villageois: vs, etat: e, acteurId, pouvoir: p, cibles, batiments: [] }); return r.ok ? "" : r.raison; };
const tenusDe = (L, e, vs) => Object.fromEntries(vs.map(x => [x.id, L.batimentDe(e, x.id)]).filter(([, c]) => c));

const VERIFICATIONS = {
  // ------------------------------------------------------------ la distribution
  "distribution : une proposition selon la table, des Chemineaux, le Prévôt seulement s'il y a des Chemineaux": L => {
    assert.deepEqual(L.proposerLeVillage(4), ["prieure", "cabaret", "echoppe", "ecole"], "quatre places : ni métairie ni Chemineau");
    const six = L.proposerLeVillage(6);
    assert.equal(six.length, 5, "un Chemineau");
    assert.equal(six.filter(L.estMetairie).length, 2);
    const douze = L.proposerLeVillage(12);
    assert.equal(douze.length, 10, "deux Chemineaux");
    assert.ok(douze.includes("prevote"));
    const vingt = L.proposerLeVillage(20);
    assert.equal(vingt.filter(L.estMetairie).length, 6, "six métairies au plus");
    assert.ok(vingt.length <= 14 && L.PERSONNALITES.every(p => p === "metayer" || vingt.some(c => L.personnaliteDuBatiment(c) === p)));
    for (let n = 1; n <= 7; n++) assert.ok(!L.proposerLeVillage(n).includes("prevote") || n >= 5, `${n} : pas de Prévôt sans Chemineau`);
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const t1 = L.distribuerLeVillage(ids, { graine: "x" });
    assert.deepEqual(t1, L.distribuerLeVillage(ids, { graine: "x" }), "reproductible");
    assert.equal(new Set(Object.values(t1)).size, Object.keys(t1).length, "un bâtiment par joueur");
    assert.equal(Object.keys(t1).length, L.proposerLeVillage(8).length);
  },
  "personnalités : publiques ; sans bâtiment, Chemineau ; rien hors de la variante": L => {
    const vs = village(), e = etatDe(L, vs);
    assert.equal(L.personnaliteDe(e, "b"), "prieur");
    assert.equal(L.personnaliteDe(e, "f"), "metayer");
    assert.equal(L.personnaliteDe(e, "h"), "chemineau");
    assert.deepEqual(L.chemineaux(e, vs), ["a", "h"]);
    assert.deepEqual(L.chemineaux(e, mort(vs, "h")), ["a"], "les vivants");
    const sans = L.normaliserEtat({ ...e, village: { actif: false } });
    assert.equal(L.personnaliteDe(sans, "b"), "");
    assert.deepEqual(L.chemineaux(sans, vs), []);
    assert.equal(L.etatPublic(e).village.actif, true, "public");
  },
  // ------------------------------------------------------------ les pouvoirs : permanents, uniques, rétablis, éteints
  "pouvoir unique : servi une fois par son occupant, rétabli pour un Chemineau installé ; un bâtiment brûlé ne donne plus rien": L => {
    const vs = village();
    let e = etatDe(L, vs);
    const a = pouvoir(L, e, vs, "b", "prieure", ["a"]);
    assert.ok(a.ok);
    assert.equal(raison(L, a.etat, vs, "b", "prieure", ["c"]), "usage", "une fois");
    assert.equal(raison(L, a.etat, vs, "c", "prieure", ["a"]), "absent", "le pouvoir est à l'occupant");
    assert.equal(raison(L, L.tenir(a.etat, "prieure", "c"), vs, "c", "prieure", ["a"]), "", "un autre occupant le trouve entier");
    e = L.installer(L.normaliserEtat(a.etat), "prieure", "h");
    assert.equal(raison(L, e, vs, "h", "prieure", ["a"]), "", "rétabli pour le nouvel occupant");
    assert.equal(raison(L, e, vs, "b", "prieure", ["a"]), "absent");
    e = L.detruire(L.normaliserEtat(e), ["prieure"]);
    assert.equal(raison(L, e, vs, "h", "prieure", ["a"]), "absent", "brûlé");
    assert.equal(L.personnaliteDe(e, "h"), "chemineau");
  },
  "sagesse perdue (l'Aïeul) : les personnalités perdent leur pouvoir, les Métayers gardent la désignation du Bailli": L => {
    const vs = village();
    const e = L.perdreLaSagesse(etatDe(L, vs, { bailli: { actif: true } }));
    assert.equal(raison(L, e, vs, "b", "prieure", ["a"]), "sagesse");
    assert.equal(L.cabaretierImmunise(e), "", "plus d'immunité");
    assert.ok(L.filtrerVotants(e, ["a", "b", "c"]).includes("c"), "le Régent sans pouvoir vote de nouveau");
    assert.equal(L.electionPossible({ etat: e, villageois: vs }).ok, true, "les Métayers désignent toujours le Bailli");
    assert.ok(L.CAUSES_SANS_SAGESSE.includes("rasoir"), "le rasoir du Perruquier est une mort du village");
    assert.equal(L.sagesseALaMort(etatDe(L, [v("a", "aieul")]), { role: ROLE.aieul, cause: "rasoir" }).perdue, true);
  },
  // ------------------------------------------------------------ le Prieur, le Remégeux
  "Prieur : la carte montrée en secret ; Remégeux : rend un pouvoir unique servi, et seulement celui-là": L => {
    const vs = village();
    let e = tenures(L, etatDe(L, vs), { masure: "g", "metairie-2": "" });
    const a = pouvoir(L, e, vs, "b", "prieure", ["a"]);
    assert.equal(a.prives.length, 1);
    assert.equal(a.prives[0].destinataire, "b");
    assert.equal(a.prives[0].donnees.role, "Loup de Brumecombe");
    assert.ok(!a.annonces.some(m => /Loup/.test(m.texte)), "l'annonce ne dit pas la carte");
    assert.deepEqual(a.village, { quoi: "prieur", acteurId: "b", ids: ["a"] });
    e = a.etat;
    assert.deepEqual(L.candidatsDuPouvoir({ villageois: vs, etat: e, acteurId: "g", pouvoir: "masure" }), ["b"], "seulement un pouvoir unique servi");
    const r = pouvoir(L, e, vs, "g", "masure", ["b"]);
    assert.ok(r.ok);
    assert.equal(raison(L, r.etat, vs, "b", "prieure", ["c"]), "", "le Prieur peut de nouveau");
    assert.equal(raison(L, r.etat, vs, "g", "masure", ["b"]), "usage", "le Remégeux, une fois");
  },
  // ------------------------------------------------------------ le Régent
  "Régent : un ou deux privés de vote ce jour-là (jamais un Chemineau), une fois par jour, au débat ; lui ne vote jamais": L => {
    const vs = village();
    const e = etatDe(L, vs);
    assert.deepEqual(L.candidatsDuPouvoir({ villageois: vs, etat: e, acteurId: "c", pouvoir: "ecole" }), ["b", "d", "e", "f", "g"], "ni lui, ni les Chemineaux");
    assert.equal(raison(L, e, vs, "c", "ecole", ["b", "d", "e"]), "cibles", "deux au plus");
    assert.equal(raison(L, e, vs, "c", "ecole", ["h"]), "cibles", "pas un Chemineau");
    assert.equal(raison(L, { ...e, phase: "vote" }, vs, "c", "ecole", ["b"]), "phase", "avant le vote");
    const r = pouvoir(L, e, vs, "c", "ecole", ["b", "e"]);
    assert.ok(r.ok);
    assert.equal(raison(L, r.etat, vs, "c", "ecole", ["d"]), "deja", "une fois par jour");
    assert.deepEqual(L.filtrerVotants(r.etat, ["a", "b", "c", "d", "e"], "execution"), ["a", "d"], "le Régent ne vote pas, ses privés non plus");
    assert.deepEqual(L.filtrerVotants({ ...r.etat, tour: 3 }, ["a", "b", "c", "d", "e"], "execution"), ["a", "b", "d", "e"], "le lendemain, seul le Régent ne vote pas");
    assert.deepEqual(L.filtrerVotants(e, ["a", "c"], "chapelle"), ["a"], "jamais");
  },
  // ------------------------------------------------------------ le Perruquier
  "Perruquier : un loup, il est félicité ; un innocent, il tombe aussi ; jamais un Chemineau": L => {
    const vs = village();
    const e = etatDe(L, vs);
    assert.ok(!L.candidatsDuPouvoir({ villageois: vs, etat: e, acteurId: "d", pouvoir: "echoppe" }).includes("h"), "pas un Chemineau");
    const loup = pouvoir(L, tenures(L, e, { echoppe: "d", prieure: "a" }), vs, "d", "echoppe", ["a"]);
    assert.deepEqual(loup.morts, [{ acteurId: "a", cause: "rasoir" }]);
    const innocent = pouvoir(L, e, vs, "d", "echoppe", ["b"]);
    assert.deepEqual(innocent.morts, [{ acteurId: "b", cause: "rasoir" }, { acteurId: "d", cause: "rasoir" }]);
    assert.equal(raison(L, innocent.etat, vs, "d", "echoppe", ["c"]), "usage");
    const mordu = vs.map(x => (x.id === "b" ? { ...x, camp: "meute" } : x));
    assert.equal(pouvoir(L, e, mordu, "d", "echoppe", ["b"]).morts.length, 1, "un mordu est un loup");
  },
  // ------------------------------------------------------------ le Cabaretier
  "Cabaretier : ni candidat du vote d'exécution, ni proie de la meute ; voter contre un condamné lui coûte son immunité": L => {
    const vs = village();
    const e = etatDe(L, vs);
    assert.deepEqual(L.candidatsDuVillage(e, ["a", "e"], "execution"), ["a"]);
    assert.deepEqual(L.candidatsDuVillage(e, ["a", "e"], "chapelle"), ["a", "e"]);
    assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: { ...e, phase: "nuit" }, roleCle: "meute" }).includes("e"), "pas une proie");
    const r = nuit(L, vs, [meute("e")], { immunises: ["e"] });
    assert.deepEqual(r.morts, [], "la meute repart bredouille");
    assert.ok(r.sauves.some(s => s.acteurId === "e" && s.par === "cabaret"));
    assert.equal(L.cabaretierQuiPerd(e, { objet: "execution", votes: { e: "b" }, elus: ["b"] }), "e");
    assert.equal(L.cabaretierQuiPerd(e, { objet: "execution", votes: { e: "b" }, elus: ["c"] }), "");
    const perdu = L.marquerEpuise(L.normaliserEtat(e), "cabaret", "e");
    assert.equal(L.cabaretierImmunise(perdu), "");
    assert.deepEqual(L.candidatsDuVillage(perdu, ["a", "e"]), ["a", "e"]);
  },
  // ------------------------------------------------------------ le Hobereau
  "Hobereau : sa grâce vaut pour ce vote ; son usage est pris": L => {
    const vs = village();
    let e = tenures(L, etatDe(L, vs), { manoir: "g", "metairie-2": "" });
    e = L.gracierParLeHobereau(L.normaliserEtat(e), { acteurId: "b", par: "g", numero: 3 });
    assert.ok(L.gracieAuVote(e, "b", 3), "gracié par ce vote");
    assert.ok(!L.gracieAuVote(e, "b", 4));
    assert.equal(L.porteur(e, "manoir", vs), "", "une fois");
    assert.ok(L.filtrerVotants(e, ["b"]).includes("b"), "le gracié du Hobereau vote encore (ce n'est pas l'Innocent)");
  },
  // ------------------------------------------------------------ les Métayers et le Bailli
  "Métayers : le Bailli, à partir du deuxième jour, par eux et parmi eux ; la succession parmi les Métayers vivants": L => {
    const vs = village();
    const e = L.normaliserEtat({ ...etatDe(L, vs), bailli: { actif: true } });
    assert.equal(L.electionPossible({ etat: { ...e, tour: 1 }, villageois: vs }).raison, "jourDeux");
    assert.equal(L.electionPossible({ etat: e, villageois: vs }).ok, true);
    assert.equal(L.electionPossible({ etat: e, villageois: mort(vs, "f", "g") }).raison, "metayers");
    assert.deepEqual(L.candidatsElection(e, vs), ["f", "g"]);
    assert.deepEqual(L.filtrerVotants(e, ["a", "b", "f", "g"], "bailli"), ["f", "g"]);
    const s = L.normaliserEtat({ ...e, bailli: { actif: true, acteurId: "", succession: { de: "f", tour: 2 } } });
    assert.deepEqual(L.candidatsSuccession(s, mort(vs, "f")), ["g"]);
    const sans = L.normaliserEtat({ ...e, village: { actif: false } });
    assert.equal(L.candidatsSuccession({ ...sans, bailli: { succession: { de: "f" } } }, vs).length, 7, "hors de la variante, tous les vivants");
  },
  // ------------------------------------------------------------ le Prévôt : les bâtiments libérés attendent
  "Prévôt : un occupant meurt, son bâtiment devient vacant et attend ; un Chemineau installé le quitte de l'attente": L => {
    const vs = village();
    const e = L.ajouterMort(etatDe(L, vs), { acteurId: "b", cause: "meute" });
    assert.equal(L.occupant(e, "prieure"), "");
    assert.deepEqual(L.normaliserVillage(e.village).attente, ["prieure"]);
    assert.ok(L.vacantsDuVillage(e).includes("prieure"));
    const x = L.installer(L.normaliserEtat(e), "prieure", "h");
    assert.deepEqual(L.normaliserVillage(x.village).attente, []);
    assert.equal(L.personnaliteDe(x, "h"), "prieur");
    const sans = L.ajouterMort(L.normaliserEtat({ ...etatDe(L, vs), village: { actif: false } }), { acteurId: "b", cause: "meute" });
    assert.deepEqual(L.normaliserVillage(sans.village).attente, [], "hors de la variante, personne n'attend le Prévôt");
  },
  // ------------------------------------------------------------ la Fournière
  "Fournière : une chance d'entrevoir un loup vivant (jamais elle-même) ; rien sans son pouvoir": L => {
    const vs = village();
    const e = tenures(L, etatDe(L, vs), { fournil: "g", "metairie-2": "" });
    assert.deepEqual(L.apercusDeLaFourniere({ etat: e, villageois: vs, hasard: () => 0 }), [{ acteurId: "g", loup: "a" }]);
    assert.deepEqual(L.apercusDeLaFourniere({ etat: e, villageois: vs, hasard: () => 0.9 }), [], "deux nuits sur trois, rien");
    assert.deepEqual(L.apercusDeLaFourniere({ etat: L.perdreLaSagesse(L.normaliserEtat(e)), villageois: vs, hasard: () => 0 }), []);
    assert.equal(L.CHANCE_FOURNIERE, 1 / 3);
  },
  // ------------------------------------------------------------ l'Incendiaire
  "Incendiaire : un bâtiment (son occupant), jamais un Chemineau ; la maison de la proie : pas de victime, le loup à DROITE carbonisé": L => {
    // Le cercle : a loup, b, c, d, e, f, g, h — et un second loup en c pour distinguer la gauche de la droite.
    const vs = village().map(x => (x.id === "c" ? { ...x, camp: "meute", role: { ...x.role, ...structuredClone(ROLE.loup) } } : x));
    const e = { ...etatDe(L, vs), phase: "nuit" };
    const cand = L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "h", roleCle: "incendiaire" });
    assert.ok(cand.includes("b") && !cand.includes("a") && !cand.includes("h"), "des occupants, pas des Chemineaux");
    const tenus = tenusDe(L, e, vs);
    const ailleurs = nuit(L, vs, [meute("d"), { acteurId: "h", roleCle: "incendiaire", cibles: ["f"] }], { batimentsTenus: tenus });
    assert.deepEqual(ailleurs.incendies, [{ par: "h", occupant: "f", batiment: "metairie-1", loup: "", proie: false }]);
    assert.deepEqual(ailleurs.morts, ["d"], "la proie d'ailleurs meurt");
    const chez = nuit(L, vs, [meute("b"), { acteurId: "h", roleCle: "incendiaire", cibles: ["b"] }], { batimentsTenus: tenus });
    assert.deepEqual(chez.morts, ["c"], "la proie en réchappe ; le premier loup à sa droite (c, pas a à sa gauche) périt");
    assert.deepEqual(chez.deces, [{ acteurId: "c", cause: "incendie" }]);
    assert.equal(chez.bilan.victime, "", "la meute n'a pas de victime");
    const louve = vs.map(x => (x.id === "a" ? { ...x, role: { ...x.role, ...structuredClone(ROLE.louve) } } : x));
    const mordu = nuit(L, louve, [meute("b"), { acteurId: "a", roleCle: "louve-mere", cibles: ["b"] }, { acteurId: "h", roleCle: "incendiaire", cibles: ["b"] }], { batimentsTenus: tenus });
    assert.ok(!mordu.changements.some(c => c.type === "camp"), "ni morsure");
    assert.deepEqual(nuit(L, vs, [meute("b"), { acteurId: "h", roleCle: "incendiaire", cibles: ["a"] }], { batimentsTenus: tenus }).incendies, [], "un Chemineau n'a rien à brûler");
    assert.equal(L.victoireCleDe({ cle: "incendiaire" }), "", "un villageois, pas un tueur solitaire");
  },
  "Pie : sa plume ne se pose pas sur un Chemineau": L => {
    const vs = village().map(x => (x.id === "g" ? { ...x, role: { ...x.role, ...structuredClone(ROLE.pie) } } : x));
    const e = { ...etatDe(L, vs), phase: "nuit" };
    assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "g", roleCle: "pie" }).includes("h"));
    assert.ok(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "g", roleCle: "pie" }).includes("b"));
    assert.equal(nuit(L, vs, [{ acteurId: "g", roleCle: "pie", cibles: ["h"] }], { chemineaux: ["a", "h"] }).plume, "");
    assert.equal(nuit(L, vs, [{ acteurId: "g", roleCle: "pie", cibles: ["b"] }], { chemineaux: ["a", "h"] }).plume, "b");
  },
  // ------------------------------------------------------------ le générateur et le contenu
  "générateur : l'Incendiaire seulement avec Le Village, jamais à la petite tablée ; toujours à ±2": L => {
    const eq = { roles: Object.fromEntries(Object.entries(EQUILIBRE).filter(([, r]) => !r.surDemande)), batiments: { puits: { niveau: "debutants" } } };
    for (let g = 0; g < 15; g++) assert.ok(!L.composer(10, eq, { niveau: "chaos", graine: `sans/${g}`, essais: 30 }).roles.includes("incendiaire"), "sans la variante");
    assert.ok(!L.composer(10, eq, { niveau: "classique", inclure: ["incendiaire"], graine: "voulu", essais: 30 }).roles.includes("incendiaire"), "même demandé");
    assert.ok(L.composer(10, eq, { niveau: "classique", inclure: ["incendiaire"], graine: "voulu", essais: 30, village: true }).roles.includes("incendiaire"));
    for (let g = 0; g < 10; g++) assert.ok(!L.composer(10, eq, { niveau: "petite-tablee", graine: `t${g}`, essais: 40, village: true }).roles.includes("incendiaire"));
    for (const n of [8, 10, 12, 15]) {
      const c = L.composer(n, eq, { niveau: "classique", inclure: ["incendiaire"], graine: `pm/${n}`, village: true });
      assert.ok(Math.abs(c.somme) <= 2, `${n} places : ${c.somme}`);
    }
  },
  "contenu : l'Incendiaire (effet, ordre, une fois, équilibre, jeton) ; les pages « Le Village » des guides": () => {
    const r = ROLES.find(x => x.system.cle === "incendiaire");
    assert.ok(r);
    assert.deepEqual([r.system.camp, r.system.effet, r.system.nuit.ordre, r.system.usages.max, r.system.nuit.soiMeme], ["village", "incendier", 19, 1, true]);
    assert.equal(r.system.victoire, "");
    assert.equal(EQUILIBRE.incendiaire?.village, true);
    assert.ok(["classique", "chaos"].includes(EQUILIBRE.incendiaire.niveau));
    assert.ok(JETONS_ROLES.incendiaire);
    const ordre = ordreDeReveil();
    assert.ok(ordre.findIndex(e => e.o === 19) < ordre.findIndex(e => e.o === 20), "juste avant le Garde du pont");
    const page = (cle, titre) => GUIDES.find(j => j.__cle === `journaux:${cle}`).pages.find(p => p.name === titre)?.text.content ?? "";
    const variante = page("regles-des-variantes", "Le Village");
    for (const mot of ["Métayers", "Prieur", "Remégeux", "Régent", "Fournière", "Perruquier", "Cabaretier", "Prévôt", "Hobereau", "Chemineaux", "Incendiaire"]) {
      assert.ok(variante.includes(mot), `variantes : ${mot}`);
    }
    assert.ok(page("guide-du-narrateur", "Le Village").includes("Incendiaire"));
  }
};

const MUTATIONS = [
  ["personnalites.mjs", "  let admis = regent ? ids.filter(id => id !== regent) : ids;", "  let admis = ids;", "Régent : il ne vote jamais"],
  ["personnalites.mjs", "  if (objet === \"execution\" && r && r.tour === Number(etat?.tour)) admis = admis.filter(id => !r.ids.includes(id));\n", "", "Régent : ses privés de vote"],
  ["personnalites.mjs", "    admis = admis.filter(id => metayers.has(id));\n", "", "Métayers : eux seuls votent"],
  ["personnalites.mjs", "  if (normaliserVillage(etat.village).epuises[cle] === String(acteurId)) return \"usage\";\n", "", "pouvoir unique : une fois"],
  ["personnalites.mjs", "  if (normaliserVillage(etat.village).epuises[cle] === String(acteurId)) return \"usage\";", "  if (normaliserVillage(etat.village).epuises[cle]) return \"usage\";", "un nouvel occupant : le pouvoir entier"],
  ["personnalites.mjs", "  if (sagessePerdue(etat) && !estMetairie(cle)) return \"sagesse\";\n", "", "sagesse perdue : les personnalités aussi"],
  ["personnalites.mjs", "  if (!loups.length || !(hasard() < chance)) return [];", "  if (!loups.length) return [];", "Fournière : une chance"],
  ["personnalites.mjs", "  return cible && (resultat.elus ?? []).includes(cible) ? c : \"\";", "  return \"\";", "Cabaretier : l'immunité perdue"],
  ["personnalites.mjs", "  const nbChemineaux = places >= 8 ? Math.max(1, Math.round(places / 6)) : places >= 5 ? 1 : 0;", "  const nbChemineaux = 0;", "distribution : des Chemineaux"],
  ["jour.mjs", "    case \"echoppe\": return candidatsDuVillageois(etat, villageois, acteurId, { sansChemineaux: true });", "    case \"echoppe\": return candidatsDuVillageois(etat, villageois, acteurId);", "Régent et Perruquier : pas un Chemineau"],
  ["jour.mjs", "      const loup = parId.get(c)?.camp === \"meute\";", "      const loup = true;", "Perruquier : sa méprise"],
  ["jour.mjs", "      retablir(etat, cle);\n", "", "Remégeux : le pouvoir rendu"],
  ["jour.mjs", "      if (normaliserVillage(etat.village).regent?.tour === etat.tour) return non(\"deja\");\n", "", "Régent : une fois par jour"],
  ["jour.mjs", "  if (cabaretier && (chasse || roleCle === CLE_PESTE)) ids = ids.filter(id => id !== cabaretier);\n", "", "Cabaretier : pas une proie"],
  ["jour.mjs", "    if (role.effet === EFFET_INCENDIAIRE) ids = candidatsDeLIncendiaire(etat, ids);\n", "", "Incendiaire : un bâtiment"],
  ["jour.mjs", ".filter(id => !estChemineau(etat, id));", ";", "Pie : pas un Chemineau"],
  ["resolution.mjs", "      loup = premierADroite(placesDuCercle, villageois, c, v => v.camp === \"meute\");", "      loup = premierAGauche(placesDuCercle, villageois, c, v => v.camp === \"meute\");", "Incendiaire : le loup à droite"],
  ["resolution.mjs", "      victimeMeute = null;\n", "", "Incendiaire : pas de victime"],
  ["resolution.mjs", "    if (cible === proieBrulee || immunes.has(cible)) continue;\n", "", "Incendiaire : ni morsure"],
  ["resolution.mjs", "    if (x.meute && immunes.has(x.cible)) {", "    if (false) {", "Cabaretier : la meute repart bredouille"],
  ["resolution.mjs", " && !sansToit.has(c)) sortie.plume = c;", ") sortie.plume = c;", "Pie : la plume d'un Chemineau"],
  ["bailli.mjs", "  if (villageActif(etat) && etat.tour < JOUR_DES_METAYERS) return non(\"jourDeux\");\n", "", "Métayers : le deuxième jour"],
  ["bailli.mjs", "candidatsElection(etat, villageois).filter(id => id !== etat?.bailli?.succession?.de)", "idsVivants(villageois).filter(id => id !== etat?.bailli?.succession?.de)", "Métayers : la succession"],
  ["etat.mjs", "    attendreLePrevot(etat, tenus);\n", "", "Prévôt : les bâtiments libérés attendent"],
  ["pacte.mjs", "\"emporte\", \"rasoir\"]", "\"emporte\"]", "Aïeul : le rasoir est une mort du village"],
  ["pacte.mjs", "\n  || gracieParLeHobereau(etat, acteurId, numero);", ";", "Hobereau : gracié au vote"],
  ["composition.mjs", " && !(r.village && !village)", "", "Incendiaire : seulement avec Le Village"],
  ["victoire.mjs", "  if (/pyromane/.test(cle)) return \"dernier-survivant\";", "  if (/pyromane|incendiaire/.test(cle)) return \"dernier-survivant\";", "Incendiaire : un villageois"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-personnalites-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === fichier) {
      assert.ok(texte.includes(avant), `mutation introuvable dans ${f} : ${avant}`);
      texte = texte.replace(avant, apres);
    }
    writeFileSync(join(dossier, f), texte);
  }
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

function echecs(L) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { verifier(L); } catch (e) { liste.push({ nom, e }); }
  }
  return liste;
}

test("Pacte, étape 4 (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 4 (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
