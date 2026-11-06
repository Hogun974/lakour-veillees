// Essais par mutation du SOCLE du Pacte (logique pure) : le cercle (ordre des places, voisins, morts sautés, circularité,
// arrivée en cours de partie, petite tablée, mise en scène du jour), les derniers gestes (le mourant choisit : qui attend encore,
// ce qu'il peut désigner, sa réponse vérifiée), les bâtiments tenus (tenir, libérer, vacance à la mort et Registre) et les
// événements (immédiats, différés, permanents ; l'Almanach lu par les mêmes lecteurs, à l'identique). Chaque règle est cassée à
// son tour dans une copie de la logique, et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 }, usages: { max: 0, restant: 0 } },
  braco: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
// Six places : les maisons ne suivent pas l'ordre des ids (le cercle doit suivre les maisons).
const v = (id, maison, role = "villageois", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison, silence: false,
  role: structuredClone(ROLE[role]), ...extra });
const table = () => [v("f", "Maison 6"), v("c", "Maison 3", "loup"), v("a", "Maison 1"), v("e", "Maison 5", "braco"), v("b", "Maison 2"), v("d", "Maison 4", "loup")];
const mort = (vs, ...ids) => vs.map(x => (ids.includes(x.id) ? { ...x, vivant: false } : x));
const avecCercle = (L, vs, extra = {}) => ({ ...L.fixerCercle({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1 }, vs), ...extra });

const VERIFICATIONS = {
  // ------------------------------------------------------------ le cercle
  "cercle : l'ordre des maisons (numéros croissants), départagé par l'id ; une maison sans numéro au bout": L => {
    assert.deepEqual(L.ordreDesPlaces(table()), ["a", "b", "c", "d", "e", "f"]);
    assert.deepEqual(L.ordreDesPlaces([v("z", "Maison 2"), v("y", "Maison 2"), v("x", "Taverne"), v("w", "Maison 10"), v("u", "Maison 9")]), ["y", "z", "u", "w", "x"]);
    const e = avecCercle(L, table());
    assert.deepEqual(e.cercle, ["a", "b", "c", "d", "e", "f"]);
    assert.deepEqual(L.normaliserEtat(e).cercle, ["a", "b", "c", "d", "e", "f"], "gardé par la normalisation");
    assert.deepEqual(L.normaliserEtat({ cercle: ["a", "a", "", null, "b"] }).cercle, ["a", "b"], "sans doublon ni vide");
    assert.deepEqual(L.etatInitial().cercle, []);
    assert.deepEqual(L.separerEtat(e).public.cercle, e.cercle, "le cercle est public");
  },
  "cercle : voisins de gauche (place précédente) et de droite (suivante), le cercle se referme": L => {
    const vs = table(), e = avecCercle(L, vs);
    assert.deepEqual(L.voisins(e, vs, "c"), { gauche: "b", droite: "d" });
    assert.deepEqual(L.voisins(e, vs, "a"), { gauche: "f", droite: "b" }, "le premier a le dernier à sa gauche");
    assert.deepEqual(L.voisins(e, vs, "f"), { gauche: "e", droite: "a" }, "le dernier a le premier à sa droite");
    assert.deepEqual(L.voisins(e, vs, "inconnu"), { gauche: "", droite: "" });
  },
  "cercle : les morts (et les partis) sont sautés ; sans vivantsSeulement, les voisins de chaise": L => {
    const vs = mort(table(), "b", "f"), e = avecCercle(L, table());
    assert.deepEqual(L.voisins(e, vs, "c"), { gauche: "a", droite: "d" });
    assert.deepEqual(L.voisins(e, vs, "a"), { gauche: "e", droite: "c" }, "deux morts sautés, en refermant le cercle");
    assert.deepEqual(L.voisins(e, vs, "c", { vivantsSeulement: false }), { gauche: "b", droite: "d" });
    assert.deepEqual(L.voisins(e, vs, "b"), { gauche: "a", droite: "c" }, "un mort a encore des voisins vivants");
    const deux = mort(table(), "b", "c", "d", "f");
    assert.deepEqual(L.voisins(e, deux, "a"), { gauche: "e", droite: "e" }, "à deux vivants, l'autre des deux côtés");
    assert.deepEqual(L.voisins(e, mort(table(), "b", "c", "d", "e", "f"), "a"), { gauche: "", droite: "" }, "seul vivant : personne");
  },
  "cercle : le trio autour d'un vivant, et le premier à gauche qui convient": L => {
    const vs = mort(table(), "b"), e = avecCercle(L, table());
    assert.deepEqual(L.trioAutour(e, vs, "c"), ["a", "c", "d"]);
    assert.deepEqual(L.trioAutour(e, vs, "b"), [], "un mort n'a pas de trio");
    assert.deepEqual(L.trioAutour(e, mort(table(), "b", "c", "d", "f"), "a"), ["e", "a"], "à deux vivants : deux noms, sans doublon");
    const loup = x => x.camp === "meute";
    assert.equal(L.premierAGauche(e, vs, "f", loup), "d", "à gauche de f : e (pas loup), puis d");
    assert.equal(L.premierAGauche(e, vs, "c", loup), "d", "le cercle se referme, lui-même exclu");
    assert.equal(L.premierAGauche(e, mort(table(), "d"), "e", loup), "c");
    assert.equal(L.premierAGauche(e, mort(table(), "c", "d"), "e", loup), "", "plus de loup vivant");
    assert.equal(L.premierAGauche(e, vs, "c"), "a", "sans filtre : le premier vivant à gauche");
  },
  "cercle : un arrivant s'assoit au bout, sans déplacer personne ; une partie sans cercle se range par maisons": L => {
    const vs = table();
    let e = { ...avecCercle(L, vs), passage: L.passageInitial(true) };
    e = L.accueillir(e, { acteurId: "g", cle: "pelerine" });
    assert.deepEqual(e.cercle, ["a", "b", "c", "d", "e", "f", "g"]);
    const avecG = [...vs, v("g", "Maison 2")];
    assert.deepEqual(L.voisins(e, avecG, "g"), { gauche: "f", droite: "a" }, "au bout, même avec une petite maison");
    assert.deepEqual(L.voisins(e, avecG, "b"), { gauche: "a", droite: "c" }, "les voisins des autres ne changent pas");
    assert.deepEqual(L.accueillir(e, { acteurId: "g", cle: "pelerine" }).cercle.length, 7, "pas deux fois");
    const ancien = { ...L.etatInitial(), passage: L.passageInitial(true) };
    assert.deepEqual(L.accueillir(ancien, { acteurId: "g", cle: "pelerine" }).cercle, [], "sans cercle rangé, rien");
    assert.deepEqual(L.cercleDe(ancien, avecG), ["a", "b", "g", "c", "d", "e", "f"], "sans cercle : l'ordre des maisons");
    assert.deepEqual(L.cercleDe({ cercle: ["c", "x", "a"] }, vs), ["c", "a", "b", "d", "e", "f"], "les inconnus oubliés, les absents au bout");
  },
  "cercle : petite tablée (quatre, puis trois, puis deux places)": L => {
    const vs = [v("q", "Maison 4"), v("p", "Maison 1"), v("r", "Maison 2"), v("s", "Maison 3")];
    const e = avecCercle(L, vs);
    assert.deepEqual(e.cercle, ["p", "r", "s", "q"]);
    assert.deepEqual(L.voisins(e, vs, "p"), { gauche: "q", droite: "r" });
    assert.deepEqual(L.trioAutour(e, mort(vs, "s"), "r"), ["p", "r", "q"]);
    assert.deepEqual(L.voisins(e, mort(vs, "s", "q"), "p"), { gauche: "r", droite: "r" });
  },
  "cercle : la mise en scène du jour suit l'ordre des places": L => {
    const plateau = L.lirePlateau({ largeur: 40, hauteur: 40, elements: [{ nom: "Moulin", x: 0, y: 0, l: 1, h: 1 }], plateau: { cercle: { x: 20, y: 20, rayon: 6 }, seuils: {} } });
    // Des maisons sans numéro : l'ordre des maisons rangerait par nom ; le cercle de la partie l'emporte.
    const vs = [v("a", "Taverne"), v("b", "Moulin"), v("c", "Forge")].map(x => ({ ...x, nom: x.maison }));
    const sans = L.miseEnScene({ plateau, phase: "jour", villageois: vs });
    const avec = L.miseEnScene({ plateau, phase: "jour", villageois: vs, cercle: ["a", "b", "c"] });
    const places = L.placesEnCercle(plateau, 3);
    const ou = (s, id) => { const j = s.jetons.find(x => x.id === id); return { x: j.x, y: j.y }; };
    assert.deepEqual([ou(avec, "a"), ou(avec, "b"), ou(avec, "c")], places, "dans l'ordre du cercle");
    assert.deepEqual(ou(sans, "c"), places[0], "sans cercle : l'ordre des maisons (Forge d'abord)");
    // Un mort n'a plus de place au cercle : les vivants se resserrent dans le même ordre.
    const unMort = L.miseEnScene({ plateau, phase: "jour", villageois: mort(vs, "b"), cercle: ["a", "b", "c"] });
    assert.deepEqual([ou(unMort, "a"), ou(unMort, "c")], L.placesEnCercle(plateau, 2));
  },

  // ------------------------------------------------------------ les derniers gestes
  "gestes : la Braconnière morte ce tour attend son geste ; une mort « emporte » l'a fait ; le tour suivant, plus rien": L => {
    const vs = mort(table(), "e");
    const e = { ...avecCercle(L, table()), morts: [{ acteurId: "e", tour: 1, phase: "aube", cause: "meute" }] };
    assert.deepEqual(L.gestesEnAttente(e, vs), [{ acteurId: "e", geste: "emporter" }]);
    assert.equal(L.gesteEnAttente(e, vs, "e", "emporter"), true);
    const fait = { ...e, morts: [...e.morts, { acteurId: "a", tour: 1, phase: "aube", cause: "emporte" }] };
    assert.deepEqual(L.gestesEnAttente(fait, mort(vs, "a")), [], "fait");
    assert.deepEqual(L.gestesEnAttente({ ...e, tour: 2 }, vs), [], "la nuit tombée, trop tard");
    assert.deepEqual(L.gestesEnAttente(e, vs, ["emporter:e"]), [], "le MJ a dit « personne »");
    // Emportée elle-même (une Braconnière emporte l'autre) : la seconde n'emporte personne (comme l'étape de la Table l'a
    // toujours compté), et sa mort fait le geste de la première.
    const deux = [...mort(table(), "e"), v("h", "Maison 7", "braco", { vivant: false })];
    const chaine = { ...e, morts: [...e.morts, { acteurId: "h", tour: 1, phase: "aube", cause: "emporte" }] };
    assert.deepEqual(L.gestesEnAttente(chaine, deux), [], "emportée, elle n'emporte pas");
    // Deux Braconnières mortes la même nuit : deux gestes, faits l'un après l'autre.
    const nuit2 = { ...e, morts: [...e.morts, { acteurId: "h", tour: 1, phase: "aube", cause: "meute" }] };
    assert.deepEqual(L.gestesEnAttente(nuit2, deux).map(g => g.acteurId), ["e", "h"]);
    assert.deepEqual(L.gestesEnAttente({ ...nuit2, morts: [...nuit2.morts, { acteurId: "a", tour: 1, cause: "emporte" }] }, mort(deux, "a")).map(g => g.acteurId), ["h"]);
    assert.equal(L.gesteDuRole(ROLE.braco), "emporter");
    assert.equal(L.gesteDuRole(ROLE.loup), "");
    assert.equal(L.gesteDeLaCause("emporte"), "emporter");
  },
  "gestes : il désigne un vivant (lui excepté) ; sa réponse est vérifiée sur l'état d'après": L => {
    const vs = mort(table(), "e", "b");
    const e = { ...avecCercle(L, table()), morts: [{ acteurId: "b", tour: 1, cause: "vote" }, { acteurId: "e", tour: 1, cause: "meute" }] };
    assert.deepEqual(L.candidatsDuGeste(vs, "e"), ["f", "c", "a", "d"]);
    assert.ok(!L.candidatsDuGeste(table(), "e").includes("e"), "jamais lui-même");
    const ok = L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "emporter", cibles: ["d", "c"] });
    assert.deepEqual(ok, { ok: true, raison: "", cibles: ["d"] }, "une cible, la première");
    assert.equal(L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "emporter", cibles: ["b"] }).raison, "personne", "pas un mort");
    assert.equal(L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "emporter", cibles: ["e"] }).raison, "personne", "pas elle-même");
    assert.equal(L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "emporter", cibles: [] }).raison, "personne");
    assert.equal(L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "emporter", cibles: ["d"], partie: "autre" }).raison, "partie");
    assert.equal(L.verifierGeste({ etat: { ...e, vainqueur: "village", phase: "fin" }, villageois: vs, acteurId: "e", geste: "emporter", cibles: ["d"] }).raison, "fin");
    const fait = { ...e, morts: [...e.morts, { acteurId: "a", tour: 1, cause: "emporte" }] };
    assert.equal(L.verifierGeste({ etat: fait, villageois: mort(vs, "a"), acteurId: "e", geste: "emporter", cibles: ["d"] }).raison, "fait", "le MJ a tranché avant");
    assert.equal(L.verifierGeste({ etat: e, villageois: vs, acteurId: "e", geste: "inconnu", cibles: ["d"] }).raison, "geste");
  },
  "gestes : l'étape de la Table attend la Braconnière tant que la question est chez elle (le bouton reste)": L => {
    const vs = mort(table(), "e");
    const { public: p, secret: s } = L.separerEtat({ ...avecCercle(L, table()), phase: "aube", nuitResolue: 1, morts: [{ acteurId: "e", tour: 1, phase: "aube", cause: "meute" }] });
    const libre = L.etapeSuivante(p, s, { villageois: vs });
    assert.deepEqual([libre.cle, libre.action, libre.attente, libre.detail.cle], ["emporter", "emporter", false, "emporter"]);
    const demande = L.etapeSuivante(p, s, { villageois: vs, attente: ["geste:e"] });
    assert.deepEqual([demande.cle, demande.action, demande.attente, demande.detail.cle], ["emporter", "emporter", true, "emporterDemande"]);
  },

  // ------------------------------------------------------------ les bâtiments tenus
  "tenures : tenir, libérer, qui tient, ce qu'il tient, les vacants ; publiques, normalisées": L => {
    let e = L.tenir(L.etatInitial(), "prieure", "a");
    e = L.tenir(e, "fournil", "a");
    e = L.tenir(e, "echoppe", "b");
    assert.equal(L.tenuPar(e, "prieure"), "a");
    assert.equal(L.tenuPar(e, "inconnu"), null);
    assert.deepEqual(L.batimentsDe(e, "a"), ["prieure", "fournil"]);
    assert.deepEqual(L.vacants(e), []);
    e = L.liberer(e, "fournil");
    assert.deepEqual([L.tenuPar(e, "fournil"), L.vacants(e), L.batimentsDe(e, "a")], [null, ["fournil"], ["prieure"]]);
    e = L.tenir(e, "echoppe", "c");
    assert.deepEqual([L.tenuPar(e, "echoppe"), L.batimentsDe(e, "b")], ["c", []], "un nouvel occupant chasse l'ancien");
    assert.deepEqual(L.separerEtat(e).public.tenures, e.tenures, "public");
    assert.deepEqual(L.normaliserEtat({ tenures: { a: "", b: "x", "": "y" } }).tenures, { a: null, b: "x" });
    assert.deepEqual(L.normaliserEtat({ tenures: ["x"] }).tenures, {});
    const avant = L.etatInitial();
    L.tenir(avant, "prieure", "a");
    assert.deepEqual(avant.tenures, {}, "l'état d'origine n'est pas touché");
  },
  "tenures : à la mort de l'occupant, ses bâtiments deviennent vacants, et le Registre l'inscrit": L => {
    let e = { ...L.tenir(L.tenir(L.tenir({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 2 }, "prieure", "a"), "fournil", "a"), "echoppe", "b") };
    e = L.ajouterMort(e, { acteurId: "a", cause: "vote", quand: 10 });
    assert.deepEqual(L.vacants(e), ["prieure", "fournil"]);
    assert.equal(L.tenuPar(e, "echoppe"), "b");
    const x = e.registre.at(-1);
    assert.deepEqual([x.type, x.acteurId, x.batiments, x.tour, x.quand], ["vacance", "a", ["prieure", "fournil"], 2, 10]);
    assert.ok(L.TYPES_DU_REGISTRE.includes("vacance"));
    const n = e.registre.length;
    e = L.ajouterMort(e, { acteurId: "c", cause: "meute" });
    assert.equal(e.registre.filter(y => y.type === "vacance").length, 1, "un mort sans bâtiment : rien");
    assert.equal(e.registre.length, n + 1);
  },

  // ------------------------------------------------------------ les événements
  "événements : immédiat (ce jour), différé (plus tard), permanent (jusqu'à la fin), du jour ou de la nuit": L => {
    let e = { ...L.etatInitial(), partie: "p", phase: "aube", tour: 2 };
    e = L.tirerEvenement(e, { cle: "foire-aux-loups", definition: { type: "immediat", quand: "jour" } });
    e = L.tirerEvenement(e, { cle: "orage", definition: { type: "differe", quand: "nuit", delai: 2, duree: 2 } });
    e = L.tirerEvenement(e, { cle: "couvre-feu", definition: { type: "permanent", quand: "nuit" } });
    assert.deepEqual(e.evenements.map(x => [x.cle, x.tire, x.debut, x.fin, x.type, x.quand]), [
      ["foire-aux-loups", 2, 2, 2, "immediat", "jour"], ["orage", 2, 5, 6, "differe", "nuit"], ["couvre-feu", 2, 3, 0, "permanent", "nuit"]]);
    const actif = (cle, tour, phase) => L.evenementActif(e, cle, tour, phase);
    assert.deepEqual([actif("foire-aux-loups", 2, "jour"), actif("foire-aux-loups", 2, "vote"), actif("foire-aux-loups", 3, "jour"), actif("foire-aux-loups", 2, "nuit")], [true, true, false, false]);
    assert.deepEqual([4, 5, 6, 7].map(n => actif("orage", n, "nuit")), [false, true, true, false], "différé de deux nuits, pour deux nuits");
    assert.deepEqual([2, 3, 30].map(n => actif("couvre-feu", n, "nuit")), [false, true, true], "permanent dès la nuit qui vient");
    assert.equal(actif("couvre-feu", 30, "preparation"), false, "ni les préparatifs ni la fin");
    assert.equal(L.evenementActif({ ...e, tour: 3, phase: "nuit" }, "couvre-feu"), true, "tour et phase de l'état par défaut");
    assert.deepEqual(L.evenementsActifs(e, 5, "nuit"), ["orage", "couvre-feu"]);
    // Tiré pendant la nuit : un événement de nuit vaut cette nuit-là.
    const nuit = L.tirerEvenement({ ...L.etatInitial(), phase: "nuit", tour: 4 }, { cle: "brume", definition: { type: "immediat", quand: "nuit" } });
    assert.equal(L.evenementActif(nuit, "brume", 4, "nuit"), true);
    assert.deepEqual(L.separerEtat(e).public.evenements, e.evenements, "public");
    assert.deepEqual(L.purgerEvenements(e, 7).evenements.map(x => x.cle), ["couvre-feu"], "les finis oubliés, pas le permanent");
    assert.deepEqual(L.retirerEvenement(e, "orage").evenements.map(x => x.cle), ["foire-aux-loups", "couvre-feu"]);
    assert.deepEqual(L.normaliserEtat({ evenements: [{ cle: "x", debut: 3, fin: 1, type: "bizarre" }, null, { pas: "de clé" }] }).evenements,
      [{ cle: "x", tire: 0, debut: 3, fin: 3, type: "immediat", quand: "jour" }]);
    assert.deepEqual(L.normaliserDefinition({ type: "differe" }), { type: "differe", quand: "jour", delai: 1, duree: 1 }, "un différé attend au moins un tour");
  },
  "événements : l'Almanach passe par les mêmes lecteurs, à l'identique de ses présages": L => {
    for (const cle of L.CLES_PRESAGES) for (const tirage of [1, 3]) {
      const e = { ...L.etatInitial(), partie: "p", phase: "jour", tour: tirage, presage: { actif: true, cle, tour: tirage } };
      for (let tour = 0; tour <= 6; tour++) {
        assert.equal(L.evenementActif(e, cle, tour, "nuit"), L.presageDeLaNuit(e, tour) === cle, `${cle} tiré au tour ${tirage}, nuit ${tour}`);
        assert.equal(L.evenementActif(e, cle, tour, "jour"), L.PRESAGES[cle].quand === "jour" && L.presageDuJour(e, tour) === cle, `${cle} tiré au tour ${tirage}, jour ${tour}`);
      }
    }
    const sans = { ...L.etatInitial(), presage: { actif: false, cle: "givre", tour: 1 } };
    assert.equal(L.evenementActif(sans, "givre", 2, "nuit"), false, "sans Almanach, aucun présage");
    assert.equal(L.evenementDuPresage({ ...L.etatInitial(), presage: { actif: true, cle: "", tour: 1 } }), null);
    const e = { ...L.etatInitial(), presage: { actif: true, cle: "crue", tour: 2 } };
    assert.deepEqual(L.evenementsEnCours(e, 3).map(x => [x.cle, x.source, x.debut]), [["crue", "almanach", 3]]);
  }
};

const MUTATIONS = [
  ["cercle.mjs", "rang(a) - rang(b) || String(a.id).localeCompare(String(b.id))", "String(a.id).localeCompare(String(b.id))", "cercle : l'ordre des maisons"],
  ["cercle.mjs", "numeroDeMaison(v.maison) || Number.MAX_SAFE_INTEGER", "numeroDeMaison(v.maison)", "cercle : une maison sans numéro au bout"],
  ["cercle.mjs", "gauche: premierDansLeSens(etat, villageois, acteurId, -1, garder)", "gauche: premierDansLeSens(etat, villageois, acteurId, +1, garder)", "cercle : la gauche est la place précédente"],
  ["cercle.mjs", "const id = cercle[(((i + pas * k) % n) + n) % n];", "const id = cercle[i + pas * k];", "cercle : il se referme"],
  ["cercle.mjs", "const garder = vivantsSeulement ? estVivant : v => Boolean(v);", "const garder = v => Boolean(v);", "cercle : les morts sautés"],
  ["cercle.mjs", "if (!estVivant(centre) || ", "if (", "trio : un mort n'en a pas"],
  ["cercle.mjs", "[...new Set([gauche, String(centreId), droite].filter(Boolean))]", "[gauche, String(centreId), droite].filter(Boolean)", "trio : sans doublon"],
  ["cercle.mjs", "v => estVivant(v) && Boolean(filtre(v))", "v => Boolean(filtre(v))", "premier à gauche : un vivant"],
  ["cercle.mjs", "if (acteurId && cercle.length && !cercle.includes(String(acteurId)))", "if (acteurId)", "arrivant : au bout, une fois, s'il y a un cercle"],
  ["cercle.mjs", "return [...assis, ...ordreDesPlaces(villageois.filter(v => !dedans.has(String(v.id))))];", "return assis;", "cercle : les absents au bout"],
  ["passage.mjs", "return ajouterAuCercle(etat, acteurId);", "return etat;", "arrivant : assis au cercle"],
  ["plateau.mjs", "Array.isArray(ordreDeTable) && ordreDeTable.length ?", "false ?", "mise en scène : l'ordre des places"],
  ["etat.mjs", "  etat.cercle = normaliserCercle(etat.cercle);\n", "", "cercle : normalisé"],
  ["derniers-gestes.mjs", ".filter(m => m.tour === etat.tour)", "", "geste : le tour de la mort seulement"],
  ["derniers-gestes.mjs", "if (m.cause === cause) enAttente.shift();", "if (m.cause === cause) continue;", "geste : fait par une mort de sa cause"],
  ["derniers-gestes.mjs", " && !ignorer.includes(`${geste}:${m.acteurId}`)", "", "geste : le MJ dit « personne »"],
  ["derniers-gestes.mjs", "v.vivant !== false && v.id !== acteurId", "v.vivant !== false", "geste : pas soi-même"],
  ["derniers-gestes.mjs", "if (!gesteEnAttente(etat, villageois, acteurId, geste)) return non(\"fait\");", "", "geste : déjà fait"],
  ["derniers-gestes.mjs", "if (etat?.vainqueur || etat?.phase === \"fin\") return non(\"fin\");", "", "geste : partie finie"],
  ["derniers-gestes.mjs", ".slice(0, nombreDuGeste(geste, candidats))", "", "geste : une cible"],
  ["etapes.mjs", "const demande = Boolean(emporteur) && attente.includes(`geste:${emporteur}`);", "const demande = false;", "étape : attendre la Braconnière"],
  ["tenures.mjs", "etat.tenures = { ...etat.tenures, [cle]: acteurId ? String(acteurId) : null };", "etat.tenures = { ...etat.tenures, [cle]: String(acteurId) };", "tenures : libérer"],
  ["tenures.mjs", ".filter(([, id]) => !id).map(([cle]) => cle)", ".map(([cle]) => cle)", "tenures : les vacants"],
  ["tenures.mjs", "  inscrire(etat, { type: \"vacance\", acteurId, batiments: tenus }, quand);\n", "", "tenures : au Registre"],
  ["tenures.mjs", "if (!tenus.length) return etat;", "", "tenures : rien sans bâtiment"],
  ["etat.mjs", "    libererALaMort(etat, acteurId, quand);\n", "", "tenures : vacants à la mort"],
  ["evenements.mjs", "const premier = d.quand === \"nuit\" && phase !== \"nuit\" ? tour + 1 : tour;", "const premier = tour;", "événement : la nuit qui vient"],
  ["evenements.mjs", "const debut = premier + d.delai;", "const debut = premier;", "événement : différé"],
  ["evenements.mjs", "fin: type === \"permanent\" ? 0 : Math.max(debut, entier(x.fin))", "fin: Math.max(debut, entier(x.fin))", "événement : permanent"],
  ["evenements.mjs", "(!ev.fin || tour <= ev.fin)", "true", "événement : sa fin"],
  ["evenements.mjs", "ev.quand === momentDeLaPhase(phase) && ", "", "événement : jour ou nuit"],
  ["evenements.mjs", "return [...normaliserEvenements(etat?.evenements), ...(presage ? [presage] : [])];", "return normaliserEvenements(etat?.evenements);", "événement : l'Almanach lu"],
  ["evenements.mjs", "if (!p.actif || !p.cle) return null;", "if (!p.cle) return null;", "événement : l'Almanach coupé"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-socle-mutant-"));
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

test("socle (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("socle (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
