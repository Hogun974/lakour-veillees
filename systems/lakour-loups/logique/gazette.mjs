// La GAZETTE DE LA LUNE et ce qui l'entoure (Le Pacte, étape 9 ; docs/gazette-de-la-lune.md). Logique pure.
//
// - Les TRAITS VISIBLES des personnages (etat.traits, PUBLIC) : à la distribution, chaque villageois reçoit des traits tirés au hasard,
//   affichés sur sa fiche publique et à la Table : genre (femme / homme), âge (jeune / vieux, moitié-moitié autant que possible, avec
//   un âge en années qui départage « le plus jeune »), lunettes, bijou visible, sabots, coiffe sombre, pipe (oui / non, en proportions
//   raisonnables : PROPORTIONS_DES_TRAITS) et « habite le bourg / un écart » (déduit de la maison : les maisons 13 à 18, sur l'autre
//   rive, sont des écarts). Un trait imposé (le drapeau `traits` d'un acteur : un portrait, un genre posé par le MJ) est respecté ; les
//   autres équilibrent autour de lui. Les cartes « femmes / hommes / jeunes / vieux / le plus jeune » et le Spiritisme les lisent ;
//   l'Illuminé peut partager le village selon l'un d'eux (ambigus.mjs, CRITERES_DE_PARTAGE).
// - La GAZETTE (variante, réglage « gazette ») : un paquet des 31 cartes Événement (CARTES_DE_LA_GAZETTE), mélangé (SECRET : l'ordre
//   du paquet vit dans etat.gazetteSecret) ; chaque matin sauf le premier (ou un matin sur deux, sur trois : rythme), la carte du dessus
//   est lue au chat par le dernier éliminé (adaptation : « lue par X ») et s'applique aussitôt (poserLaCarte). Le narrateur peut choisir
//   ses cartes (choix : pas de tirage, il lit celle qu'il veut) et poser des cartes permanentes dès le début. Chaque carte entre au
//   registre des événements (evenements.mjs) : immédiate (ce jour, parfois aussi la nuit qui suit), « nuit » (la nuit qui vient),
//   permanente (jusqu'à la fin), ou en attente (Dépit, Enthousiasme, Influences, Spectre : jusqu'à ce qu'elle serve, puis retirée).
//   L'Almanach des brumes est une autre variante : l'un ou l'autre (gazetteOuAlmanach).
// - Le CRIEUR PUBLIC (réglage « crieurPublic ») : une charge PUBLIQUE nommée par le Bailli (jamais lui-même) ; avant la partie, le
//   narrateur lui confie N cartes Événement (jamais de Spiritisme ; SECRÈTES : etat.gazetteSecret.main et le carnet du Crieur) ; chaque
//   matin dès le lendemain de sa nomination, il peut en lire une, qui s'applique aussitôt. Le Bailli peut le révoquer après l'annonce et
//   avant le vote (pouvoir de jour « crieur-public », jour.mjs) ; élu Bailli, il transmet sa charge ; mort, le Bailli désigne son
//   successeur ; un nouveau Bailli garde ou change de Crieur (attenteDuCrieur). Avec la Gazette, ses cartes sont retirées du paquet.
// - L'EXÉCUTEUR (carte 20) : une charge élue (modèle du Bailli : vote « executeur ») qui seule apprend le rôle des condamnés du vote,
//   qui ne sont plus révélés ; mort, il désigne son successeur.
// - La LISEUSE D'ÉTOILES et le SPIRITISME : le narrateur garde les 5 cartes Séance (SEANCES) ; chaque nuit, la Liseuse d'étoiles dit
//   si elle veut s'en servir ; au matin, la carte est lue (ses 4 questions), elle choisit une question et désigne le Spirite (un vivant)
//   qui la pose au PREMIER MORT ; adaptation : le système calcule la vraie réponse (reponseDeLEsprit) et l'annonce « l'esprit répond ».
//
// etat.gazette (PUBLIC) : { actif, rythme, choix, tirees: [{ cle, tour, lecteur, source }], restantes, marques: [{ type, tour, ids, cle }],
//   prives: [{ tour, acteurId, cle }], marches: [{ acteurId, tour }], commis: null | { acteurId, retour }, variante: null | { cle, carte,
//   tour, avant, appliquee }, crieur: { actif, acteurId, depuis, par, cartes, annonce }, executeur: { actif, acteurId, attendu, election,
//   succession }, spiritisme: { restantes: [cle], derniere: null | { tour, carte, question, spirite, designes, reponse, mort } } }
// etat.gazetteSecret (SECRET) : { paquet: [cle] (le dessus en tête), main: [cle] (les cartes du Crieur), sots: null | { tour, roles,
//   fioles }, allies: [acteurId] (le Méchant Benêt), vuUnLoup: Boolean (la Liseuse de cendres a lu une carte de loup), seance: null | { tour, par } (la
//   nuit où la Liseuse d'étoiles a dit oui, et elle), aVuTout: [acteurId] (les morts qui ont reçu les cartes des autres ou entendu la
//   tanière : la Revenue ne les ramène pas) }
// etat.traits (PUBLIC) : { acteurId: { genre, ans, age, lunettes, bijou, sabots, coiffe, pipe, bourg } }

import { melanger, choisir } from "./hasard.mjs";
import { surLAutreRive } from "./distribution.mjs";
import { voisins, cercleDe, premierAGauche } from "./cercle.mjs";
import { tirerEvenement, retirerEvenement, normaliserEvenements, evenementVaut } from "./evenements.mjs";
import { inscrire } from "./registre.mjs";
import { causePublique } from "./constantes.mjs";

const vivant = v => Boolean(v) && v.vivant !== false;
const liste = x => (Array.isArray(x) ? [...new Set(x.map(y => String(y ?? "")).filter(Boolean))] : []);
const objet = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const copie = o => JSON.parse(JSON.stringify(o ?? null));
const entier = (x, min = 0) => Math.max(min, Math.floor(Number(x) || 0));

// ======================================================================= les traits visibles
export const GENRES = ["femme", "homme"];
export const AGES = ["jeune", "vieux"];
// Les traits oui / non et la proportion de « oui » (raisonnable : une coiffe sombre sur trois têtes, une pipe sur quatre…).
export const PROPORTIONS_DES_TRAITS = Object.freeze({ lunettes: 0.3, bijou: 0.35, sabots: 0.5, coiffe: 0.4, pipe: 0.25 });
export const TRAITS_OUI_NON = Object.keys(PROPORTIONS_DES_TRAITS);
export const CLES_DES_TRAITS = ["genre", "age", ...TRAITS_OUI_NON, "bourg"];
// L'âge en années : les jeunes de 16 à 39 ans, les vieux de 50 à 84 (l'âge départage « la moitié la plus jeune » et « le plus jeune »).
export const ANS = Object.freeze({ jeune: [16, 39], vieux: [50, 84] });

export const traitsInitiaux = () => ({});
export const habiteLeBourg = maison => !surLAutreRive(maison);

export function normaliserTrait(t) {
  const x = objet(t);
  const age = AGES.includes(x.age) ? x.age : Number(x.ans) >= ANS.vieux[0] ? "vieux" : "jeune";
  const ans = entier(x.ans) || ANS[age][0];
  return { genre: GENRES.includes(x.genre) ? x.genre : "femme", ans, age, ...Object.fromEntries(TRAITS_OUI_NON.map(c => [c, Boolean(x[c])])),
    bourg: x.bourg === undefined ? true : Boolean(x.bourg) };
}
export const normaliserTraits = x => Object.fromEntries(Object.entries(objet(x)).map(([id, t]) => [id, normaliserTrait(t)]));

// Une moitié-moitié autant que possible, autour des valeurs imposées : ids sans valeur, valeurs déjà posées. -> { id: valeur }
function equilibrer(ids, deja = [], valeurs, hasard) {
  const compte = Object.fromEntries(valeurs.map(v => [v, deja.filter(x => x === v).length]));
  const sortie = {};
  for (const id of melanger(ids, hasard)) {
    const min = Math.min(...valeurs.map(v => compte[v]));
    const v = choisir(valeurs.filter(x => compte[x] === min), hasard);
    sortie[id] = v;
    compte[v] += 1;
  }
  return sortie;
}
function ansDe(age, pris, hasard) {
  const [a, b] = ANS[age];
  const libres = Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(n => !pris.has(n));
  const n = choisir(libres.length ? libres : [a, b], hasard);
  pris.add(n);
  return n;
}

// Les traits tirés à la distribution. villageois : [{ id, maison }] ; imposes : { id: { genre?, age?, ans?, lunettes?… } } (le drapeau
// d'un acteur, un portrait) ; deja : les traits déjà tirés (un arrivant s'équilibre avec eux). -> { id: trait }
export function tirerTraits(villageois = [], { hasard = Math.random, imposes = {}, deja = {} } = {}) {
  const ids = villageois.map(v => String(v.id));
  const imp = id => objet(imposes[id]);
  const anciens = Object.values(normaliserTraits(deja));
  const genres = equilibrer(ids.filter(id => !GENRES.includes(imp(id).genre)),
    [...anciens.map(t => t.genre), ...ids.map(id => imp(id).genre).filter(g => GENRES.includes(g))], GENRES, hasard);
  const ageImpose = id => (AGES.includes(imp(id).age) ? imp(id).age : Number(imp(id).ans) > 0 ? (Number(imp(id).ans) >= ANS.vieux[0] ? "vieux" : "jeune") : "");
  const ages = equilibrer(ids.filter(id => !ageImpose(id)), [...anciens.map(t => t.age), ...ids.map(ageImpose).filter(Boolean)], AGES, hasard);
  const pris = new Set([...anciens.map(t => t.ans), ...ids.map(id => entier(imp(id).ans)).filter(Boolean)]);
  const sortie = {};
  for (const v of villageois) {
    const id = String(v.id), x = imp(id);
    const age = ageImpose(id) || ages[id];
    const ans = entier(x.ans) || ansDe(age, pris, hasard);
    sortie[id] = normaliserTrait({
      genre: GENRES.includes(x.genre) ? x.genre : genres[id], age, ans,
      ...Object.fromEntries(TRAITS_OUI_NON.map(c => [c, typeof x[c] === "boolean" ? x[c] : hasard() < PROPORTIONS_DES_TRAITS[c]])),
      bourg: typeof x.bourg === "boolean" ? x.bourg : habiteLeBourg(v.maison)
    });
  }
  return sortie;
}

export const traitsDe = (etat, id) => (etat?.traits?.[id] ? normaliserTrait(etat.traits[id]) : null);
// Les vivants d'un genre (ou d'un âge) : ids.
export const duGenre = (etat, ids, genre) => ids.filter(id => traitsDe(etat, id)?.genre === genre);
// Les ids rangés du plus jeune au plus vieux (l'âge en années, puis l'identifiant).
export const parAge = (etat, ids) => [...ids].sort((a, b) => (traitsDe(etat, a)?.ans ?? 0) - (traitsDe(etat, b)?.ans ?? 0) || String(a).localeCompare(String(b)));
// La moitié la plus jeune (ou la plus âgée) des vivants : la moitié arrondie en dessous, au moins un.
export const moitieLaPlusJeune = (etat, ids) => parAge(etat, ids).slice(0, Math.max(1, Math.floor(ids.length / 2)));
export const moitieLaPlusAgee = (etat, ids) => parAge(etat, ids).reverse().slice(0, Math.max(1, Math.floor(ids.length / 2)));
export const lePlusJeune = (etat, ids) => parAge(etat, ids)[0] ?? "";

// ======================================================================= les cartes
// sorte : "immediat" (ce jour ; nuit : aussi la nuit qui suit) | "nuit" (la nuit qui vient) | "permanent" (jusqu'à la fin) | "vote"
// (le vote de ce jour, ou, attente, le prochain : retirée quand elle a servi). quand : le moment d'une permanente. min : vivants requis.
// variante : la variante du livre que le narrateur peut appliquer ce seul tour. conduite : une règle de conduite à l'oral.
export const CARTES_DE_LA_GAZETTE = Object.freeze({
  somnambule: { sorte: "permanent" },
  inondation: { sorte: "immediat", nuit: true, min: 6 },
  "marche-du-malin": { sorte: "immediat" },
  "lune-noire": { sorte: "immediat", conduite: true },
  "bal-du-samedi": { sorte: "immediat", nuit: true },
  cueillette: { sorte: "immediat" },
  "dimanche-de-soleil": { sorte: "immediat", variante: "envoutement" },
  "pile-ou-face": { sorte: "immediat" },
  "saint-vincent": { sorte: "immediat" },
  revenante: { sorte: "immediat" },
  "bonnes-manieres": { sorte: "immediat", conduite: true },
  "toucher-mortel": { sorte: "permanent", quand: "nuit" },
  "jour-des-sots": { sorte: "immediat", nuit: true },
  "fin-des-vendanges": { sorte: "immediat", variante: "vendanges" },
  "petit-commis": { sorte: "immediat", nuit: true },
  "retour-de-flamme": { sorte: "nuit" },
  "grande-defiance": { sorte: "vote" },
  "banquet-des-veterans": { sorte: "immediat" },
  depit: { sorte: "vote", attente: true },
  executeur: { sorte: "permanent" },
  influences: { sorte: "vote", attente: true },
  "nuit-des-sots": { sorte: "nuit" },
  chatiment: { sorte: "immediat" },
  battue: { sorte: "immediat", nuit: true },
  enthousiasme: { sorte: "vote", attente: true },
  enfouissement: { sorte: "permanent" },
  "mechant-benet": { sorte: "nuit" },
  "ni-loup-ni-moi": { sorte: "immediat", conduite: true },
  "lundi-gris": { sorte: "immediat", variante: "chaine" },
  spectre: { sorte: "nuit", attente: true },
  cauchemar: { sorte: "vote" }
});
export const CLES_DE_LA_GAZETTE = Object.keys(CARTES_DE_LA_GAZETTE);
// Les permanentes que le narrateur peut poser dès le début.
export const CARTES_PERMANENTES = CLES_DE_LA_GAZETTE.filter(c => CARTES_DE_LA_GAZETTE[c].sorte === "permanent");
export const CARTES_DE_CONDUITE = CLES_DE_LA_GAZETTE.filter(c => CARTES_DE_LA_GAZETTE[c].conduite);
export const estCarteDeLaGazette = cle => CLES_DE_LA_GAZETTE.includes(cle);
export const RYTHMES_DE_LA_GAZETTE = [1, 2, 3];
// Le Crieur public : le conseil du livre (5 cartes au plus), et le nombre par défaut.
export const CARTES_DU_CRIEUR_MAX = 5;
export const CARTES_DU_CRIEUR = 3;

// Le Jour des sots : les rôles qui échangent leur pouvoir (livre : Sorcière ↔ Voyante, Chasseur ↔ Petite fille, Salvateur ↔ Ancien).
export const PAIRES_DES_SOTS = Object.freeze([["herboriste", "liseuse-de-cendres"], ["braconniere", "enfant-de-la-brume"], ["garde-du-pont", "aieul"]]);
// La Nuit des sots : ceux qui deviennent loups (livre : Chasseur, Sorcière, Voyante).
export const TUEURS_DES_SOTS = Object.freeze(["braconniere", "herboriste", "liseuse-de-cendres"]);
export const CHAMPS_DU_POUVOIR = ["effet", "nuit", "usages"];

// Les étapes de nuit que la Gazette ajoute (nuit.mjs, options.gazette) : le geste du Toucher mortel, la seconde proie de la Crue, le
// Spectre, le Méchant Benêt, les loups devenus liseuses de la Nuit des sots ; et la Liseuse d'étoiles (son rôle, roles.mjs).
export const CLE_TOUCHER = "toucher";
export const CLE_CRUE = "crue";
export const CLE_SPECTRE = "spectre";
export const CLE_BENET = "benet";
export const CLE_SOTS_VOYANCE = "sots-voyance";
export const ORDRE_BENET = 0;
export const ORDRE_SOTS_VOYANCE = 4;
export const ETAPES_DE_LA_GAZETTE = [CLE_TOUCHER, CLE_CRUE, CLE_SPECTRE, CLE_BENET, CLE_SOTS_VOYANCE];
export const CLE_LISEUSE_D_ETOILES = "liseuse-d-etoiles";
export const EFFET_SPIRITISME = "spiritisme";
export const CLE_VILLAGEOIS_SIMPLE = "villageois";

// Les mots défendus de « Ni loup ni moi » (relevé automatique dans le texte), par langue du monde.
export const MOTS_INTERDITS = Object.freeze({ fr: ["loup", "loups", "moi"], en: ["wolf", "wolves", "me"] });
export function motInterdit(texte, langue = "fr") {
  const mots = MOTS_INTERDITS[langue] ?? MOTS_INTERDITS.fr;
  const propre = String(texte ?? "").replace(/<[^>]*>/g, " ").toLowerCase();
  return propre.split(/[^\p{L}'’-]+/u).flatMap(m => m.split(/['’-]/)).find(m => mots.includes(m)) ?? "";
}

// ======================================================================= le Spiritisme
export const SEANCES = Object.freeze({
  "seance-1": ["meme-camp", "loup-lunettes", "herboriste-homme", "bailli-villageois"],
  "seance-2": ["loup-homme", "loup-femme", "voisin-loup", "designe-villageois"],
  "seance-3": ["suis-je-villageois", "loup-bailli", "loup-bourg", "loup-pipe"],
  "seance-4": ["liseuse-a-vu-loup", "loups-voisins", "loup-bijou", "suis-je-loup"],
  "seance-5": ["loup-sabots", "loup-coiffe", "loups-hommes", "loups-femmes"]
});
export const CLES_DES_SEANCES = Object.keys(SEANCES);
// Les questions où le Spirite désigne des joueurs (« les 2 joueurs que je désigne », « le joueur que je désigne »).
export const DESIGNATIONS_DES_QUESTIONS = Object.freeze({ "meme-camp": 2, "voisin-loup": 1, "designe-villageois": 1 });

// La vraie réponse de l'esprit (oui : true). villageois : à plat, rôles et camps ACTUELS (MJ) ; spirite : celui qui pose la question ;
// designes : ceux qu'il a désignés ; vuUnLoup : la Liseuse de cendres a lu une carte de loup. Les « loups » sont les loups en vie (camp
// actuel « meute », mordus compris).
export function reponseDeLEsprit({ question, etat, villageois = [], spirite = "", designes = [] } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const loups = villageois.filter(v => vivant(v) && v.camp === "meute").map(v => v.id);
  const trait = (id, c) => traitsDe(etat, id)?.[c];
  const unLoup = f => loups.some(f);
  const simple = id => parId.get(id)?.role?.cle === CLE_VILLAGEOIS_SIMPLE;
  const bailli = etat?.bailli?.actif && vivant(parId.get(etat.bailli.acteurId)) ? etat.bailli.acteurId : "";
  const campDe = id => { const v = parId.get(id); return !v ? "" : v.camp === "solitaire" ? `solitaire:${id}` : v.camp; };
  switch (question) {
    case "meme-camp": return designes.length >= 2 && campDe(designes[0]) === campDe(designes[1]);
    case "loup-lunettes": return unLoup(id => trait(id, "lunettes"));
    case "herboriste-homme": {
      const h = villageois.filter(v => v.role?.cle === "herboriste");
      return (h.find(vivant) ?? h[0]) ? trait((h.find(vivant) ?? h[0]).id, "genre") === "homme" : false;
    }
    case "bailli-villageois": return Boolean(bailli) && simple(bailli);
    case "loup-homme": return unLoup(id => trait(id, "genre") === "homme");
    case "loup-femme": return unLoup(id => trait(id, "genre") === "femme");
    case "voisin-loup": {
      if (!designes[0]) return false;
      const { gauche, droite } = voisins(etat, villageois, designes[0]);
      return [gauche, droite].some(id => loups.includes(id));
    }
    case "designe-villageois": return Boolean(designes[0]) && simple(designes[0]);
    case "suis-je-villageois": return simple(spirite);
    case "loup-bailli": return Boolean(bailli) && loups.includes(bailli);
    case "loup-bourg": return unLoup(id => trait(id, "bourg"));
    case "loup-pipe": return unLoup(id => trait(id, "pipe"));
    case "liseuse-a-vu-loup": return Boolean(normaliserGazetteSecret(etat?.gazetteSecret).vuUnLoup);
    case "loups-voisins": return loups.some(id => { const v = voisins(etat, villageois, id); return [v.gauche, v.droite].some(x => x !== id && loups.includes(x)); });
    case "loup-bijou": return unLoup(id => trait(id, "bijou"));
    case "suis-je-loup": return loups.includes(spirite);
    case "loup-sabots": return unLoup(id => trait(id, "sabots"));
    case "loup-coiffe": return unLoup(id => trait(id, "coiffe"));
    case "loups-hommes": return loups.length > 0 && loups.every(id => trait(id, "genre") === "homme");
    case "loups-femmes": return loups.length > 0 && loups.every(id => trait(id, "genre") === "femme");
    default: return false;
  }
}

// Le premier mort de la partie (celui que le Spirite interroge) : "" s'il n'y en a pas encore.
export const premierMort = etat => String((etat?.morts ?? [])[0]?.acteurId ?? "");
// Le dernier éliminé (il lit la carte de la Gazette ; le Châtiment, les Influences, le Cauchemar partent de lui) : "" sinon.
export const dernierElimine = etat => String((etat?.morts ?? []).at(-1)?.acteurId ?? "");

// ======================================================================= l'état
export const crieurInitial = (actif = false) => ({ actif: Boolean(actif), acteurId: "", depuis: 0, par: "", cartes: 0, annonce: 0 });
export const executeurInitial = () => ({ actif: false, acteurId: "", attendu: false, election: -1, succession: null });
export const spiritismeInitial = () => ({ restantes: [...CLES_DES_SEANCES], derniere: null });
export const gazetteInitiale = ({ actif = false, rythme = 1, choix = false, crieur = false } = {}) => ({
  actif: Boolean(actif), rythme: RYTHMES_DE_LA_GAZETTE.includes(Number(rythme)) ? Number(rythme) : 1, choix: Boolean(choix),
  tirees: [], restantes: 0, marques: [], prives: [], marches: [], commis: null, variante: null,
  crieur: crieurInitial(crieur), executeur: executeurInitial(), spiritisme: spiritismeInitial()
});
export const gazetteSecretInitial = () => ({ paquet: [], main: [], sots: null, allies: [], vuUnLoup: false, seance: null, aVuTout: [] });

export function normaliserGazette(g) {
  const x = objet(g);
  const base = gazetteInitiale(x);
  const c = objet(x.crieur), ex = objet(x.executeur), sp = objet(x.spiritisme);
  const marque = m => ({ type: String(m?.type ?? ""), tour: entier(m?.tour), ids: liste(m?.ids), cle: String(m?.cle ?? "") });
  return { ...base,
    tirees: (Array.isArray(x.tirees) ? x.tirees : []).filter(t => t?.cle).map(t => ({ cle: String(t.cle), tour: entier(t.tour), lecteur: String(t.lecteur ?? ""),
      source: String(t.source ?? "gazette") })).slice(-60),
    restantes: entier(x.restantes),
    marques: (Array.isArray(x.marques) ? x.marques : []).filter(m => m?.type).map(marque).slice(-80),
    prives: (Array.isArray(x.prives) ? x.prives : []).filter(p => p?.acteurId).map(p => ({ tour: entier(p.tour), acteurId: String(p.acteurId), cle: String(p.cle ?? "") })).slice(-80),
    marches: (Array.isArray(x.marches) ? x.marches : []).filter(m => m?.acteurId).map(m => ({ acteurId: String(m.acteurId), tour: entier(m.tour) })),
    commis: x.commis?.acteurId ? { acteurId: String(x.commis.acteurId), retour: entier(x.commis.retour) } : null,
    variante: x.variante?.cle ? { cle: String(x.variante.cle), carte: String(x.variante.carte ?? ""), tour: entier(x.variante.tour), avant: x.variante.avant ?? false,
      appliquee: Boolean(x.variante.appliquee) } : null,
    crieur: { actif: Boolean(c.actif), acteurId: String(c.acteurId ?? ""), depuis: entier(c.depuis), par: String(c.par ?? ""), cartes: entier(c.cartes), annonce: entier(c.annonce) },
    executeur: { actif: Boolean(ex.actif), acteurId: String(ex.acteurId ?? ""), attendu: Boolean(ex.attendu), election: typeof ex.election === "number" ? ex.election : -1,
      succession: ex.succession?.de ? { de: String(ex.succession.de), tour: entier(ex.succession.tour) } : null },
    spiritisme: { restantes: Array.isArray(sp.restantes) ? sp.restantes.filter(c => CLES_DES_SEANCES.includes(c)) : [...CLES_DES_SEANCES],
      derniere: sp.derniere && typeof sp.derniere === "object" ? copie(sp.derniere) : null }
  };
}
export function normaliserGazetteSecret(s) {
  const x = objet(s);
  return {
    paquet: (Array.isArray(x.paquet) ? x.paquet : []).filter(estCarteDeLaGazette),
    main: (Array.isArray(x.main) ? x.main : []).filter(estCarteDeLaGazette),
    sots: x.sots && typeof x.sots === "object" && Array.isArray(x.sots.paires)
      ? { tour: entier(x.sots.tour), paires: x.sots.paires.filter(p => Array.isArray(p) && p.length === 2).map(p => p.map(String)), fioles: objet(copie(x.sots.fioles)) } : null,
    allies: liste(x.allies), vuUnLoup: Boolean(x.vuUnLoup),
    seance: x.seance?.par ? { tour: entier(x.seance.tour), par: String(x.seance.par) } : null,
    aVuTout: liste(x.aVuTout)
  };
}
// Les morts qui ont tout vu (réglage « mortsVoientTout » : les cartes des autres, la tanière) : la Revenue ne les ramène jamais.
export const aToutVu = (etat, acteurId) => normaliserGazetteSecret(etat?.gazetteSecret).aVuTout.includes(String(acteurId ?? ""));
// Il a tout vu (état modifié sur place). -> true si c'est nouveau
export function noterQuIlAToutVu(etat, acteurId) {
  const s = normaliserGazetteSecret(etat.gazetteSecret);
  if (!acteurId || s.aVuTout.includes(String(acteurId))) return false;
  s.aVuTout.push(String(acteurId));
  etat.gazetteSecret = s;
  return true;
}
const gaz = etat => normaliserGazette(etat?.gazette);
const sec = etat => normaliserGazetteSecret(etat?.gazetteSecret);

// L'Almanach ou la Gazette : jamais les deux (la Gazette l'emporte quand les deux sont demandés).
export const gazetteOuAlmanach = ({ gazette = false, almanach = false } = {}) => ({ gazette: Boolean(gazette), almanach: Boolean(almanach) && !gazette });
export const gazetteActive = etat => gaz(etat).actif;
export const crieurActif = etat => gaz(etat).crieur.actif;

// Le paquet de la mise en place : les 31 cartes mélangées, sans celles du Crieur ni les permanentes posées dès le début.
export function preparerLePaquet({ hasard = Math.random, sans = [] } = {}) {
  return melanger(CLES_DE_LA_GAZETTE.filter(c => !sans.includes(c)), hasard);
}
// Les cartes confiées au Crieur : celles choisies par le narrateur (jamais de Spiritisme), sinon n au hasard.
export function cartesPourLeCrieur({ n = CARTES_DU_CRIEUR, choisies = [], hasard = Math.random, sans = [] } = {}) {
  const voulues = liste(choisies).filter(estCarteDeLaGazette).filter(c => !sans.includes(c));
  if (voulues.length) return voulues;
  return melanger(CLES_DE_LA_GAZETTE.filter(c => !sans.includes(c)), hasard).slice(0, Math.max(0, Math.min(CLES_DE_LA_GAZETTE.length, entier(n))));
}

// ======================================================================= les événements d'une carte
// Les définitions (evenements.mjs) de la carte : immédiate (le jour), nuit (la nuit qui vient), permanente, en attente.
export function definitionsDeLaCarte(cle) {
  const c = CARTES_DE_LA_GAZETTE[cle];
  if (!c) return [];
  if (c.sorte === "permanent") return [{ type: "permanent", quand: c.quand ?? "jour" }];
  if (c.attente) return [{ type: "permanent", quand: c.sorte === "nuit" ? "nuit" : "jour" }];
  if (c.sorte === "nuit") return [{ type: "immediat", quand: "nuit" }];
  return [{ type: "immediat", quand: "jour" }, ...(c.nuit ? [{ type: "immediat", quand: "nuit" }] : [])];
}

// La carte vaut-elle à ce tour et à ce moment ? (une permanente, une carte en attente : tant qu'elle est au registre)
export function carteActive(etat, cle, tour = etat?.tour ?? 0, phase = etat?.phase ?? "") {
  return normaliserEvenements(etat?.evenements).some(ev => ev.cle === cle && ev.source === "gazette" && evenementVaut(ev, tour, phase));
}
// Une carte permanente ou en attente posée (quel que soit le moment) : le Toucher, l'Exécuteur, le Dépit…
export const cartePosee = (etat, cle) => normaliserEvenements(etat?.evenements).some(ev => ev.cle === cle && ev.source === "gazette"
  && ev.type === "permanent" && ev.debut <= Number(etat?.tour ?? 0) + 1);
// La carte vaut-elle pour la nuit n° `nuit` ?
export const carteDeLaNuit = (etat, cle, nuit) => carteActive(etat, cle, nuit, "nuit");
// La carte vaut-elle le jour n° `tour` (aube, débat, vote) ?
export const carteDuJour = (etat, cle, tour = etat?.tour ?? 0) => carteActive(etat, cle, tour, "jour");
// Une carte en attente a servi : retirée du registre des événements. (état modifié sur place)
export function consommerLaCarte(etat, cle) {
  Object.assign(etat, retirerEvenement(etat, cle));
  return etat;
}

// Les marques posées par une carte (absents, protégés, intouchables, loups qui ne chassent pas, voix triple) : ids, pour un tour.
export const marques = (etat, type, tour) => [...new Set(gaz(etat).marques.filter(m => m.type === type && m.tour === tour).flatMap(m => m.ids))];
function marquer(g, type, tour, ids, cle) {
  if (ids.length) g.marques.push({ type, tour, ids: [...ids], cle });
}
// Les absents d'un jour (ni débat ni vote) ; les protégés (on ne peut pas voter contre eux).
export const absentsDuJour = (etat, tour = etat?.tour ?? 0) => marques(etat, "absent", tour);
export const protegesDuJour = (etat, tour = etat?.tour ?? 0) => marques(etat, "protege", tour);
// La nuit : ceux que la meute ne peut pas dévorer, les loups qui ne chassent pas.
export const intouchablesDeLaNuit = (etat, nuit) => marques(etat, "intouchable", nuit);
export const sansChasseDeLaNuit = (etat, nuit) => marques(etat, "sansChasse", nuit);
// Les voix qui comptent triple à un vote d'exécution ce jour (le Petit Commis rappelé).
export const POIDS_DU_COMMIS = 3;
export const poidsDeLaGazette = (etat, objetDuVote = etat?.vote?.objet ?? "execution") => (objetDuVote === "execution"
  ? Object.fromEntries(marques(etat, "triple", Number(etat?.tour ?? 0)).map(id => [id, POIDS_DU_COMMIS])) : {});
// Les privés de vote de ce jour par le narrateur (Lune noire, Bonnes manières, Ni loup ni moi).
export const privesDuJour = (etat, tour = etat?.tour ?? 0) => [...new Set(gaz(etat).prives.filter(p => p.tour === tour).map(p => p.acteurId))];
// Une carte de conduite vaut-elle aujourd'hui ? (le narrateur peut alors retirer le vote d'un contrevenant)
export const conduiteDuJour = (etat, tour = etat?.tour ?? 0) => CARTES_DE_CONDUITE.filter(c => carteDuJour(etat, c, tour));

// Les votants permis par la Gazette (pacte.mjs, filtrerVotants) : ni les absents (tout vote du jour), ni les privés de vote (vote
// d'exécution), ni l'accusé du Châtiment (son propre jugement).
export function filtrerVotantsDeLaGazette(etat, ids = [], objetDuVote = "execution") {
  const tour = Number(etat?.tour ?? 0);
  const hors = new Set(absentsDuJour(etat, tour));
  if (objetDuVote === "execution") for (const id of privesDuJour(etat, tour)) hors.add(id);
  if (objetDuVote === "chatiment") for (const id of etat?.vote?.candidats ?? []) hors.add(id);
  return ids.filter(id => !hors.has(id));
}
// Les candidats d'un vote d'exécution permis par la Gazette : pas les protégés du jour.
export function candidatsDeLaGazette(etat, ids = [], objetDuVote = "execution") {
  if (objetDuVote !== "execution") return ids;
  const proteges = new Set(protegesDuJour(etat));
  return ids.filter(id => !proteges.has(id));
}
// Un vote d'exécution est-il permis aujourd'hui ? (La Crue : pas de vote ce jour.) -> "" ou la raison
export const voteEmpeche = etat => (carteDuJour(etat, "inondation") ? "inondation" : "");
// Le Jour des sots : un amoureux vote obligatoirement contre son amant (vivant) ; -> l'id imposé, ou "".
export function voteImpose(etat, votant, villageois = []) {
  if (!carteDuJour(etat, "jour-des-sots")) return "";
  const amant = villageois.find(v => v.id === votant)?.amoureux ?? "";
  return amant && vivant(villageois.find(v => v.id === amant)) ? amant : "";
}
// Le Jour des sots : si l'un des amants meurt ce tour (ce jour, la nuit qui suit), l'autre survit.
export const amoursSuspendues = (etat, tour = etat?.tour ?? 0, phase = etat?.phase ?? "") =>
  carteActive(etat, "jour-des-sots", tour, phase) || (phase === "aube" && carteDeLaNuit(etat, "jour-des-sots", tour));

// ======================================================================= poser une carte
const msg = (cle, texte, donnees = {}) => ({ destinataire: "public", cle: `LAKOUR_LOUPS.Gazette.${cle}`, texte, donnees });
const secret = (destinataire, cle, texte, donnees = {}) => ({ destinataire, cle: `LAKOUR_LOUPS.Gazette.${cle}`, texte, donnees });

// La carte `cle` posée (lue au matin du tour courant, ou par le Crieur) : ses événements, ses effets immédiats. etat : complet et
// normalisé (modifié sur place). villageois : à plat (rôles connus du MJ). lecteur : celui qui la lit (le dernier éliminé, le Crieur ;
// "" : le narrateur). source : "gazette" | "crieur" | "narrateur" | "debut".
// -> { annonces: [msg], prives: [msg], gestes: [{ type, … }] } — gestes : ce que Foundry fait ensuite (silence, revenir, chatiment,
//    cauchemar, election-executeur, bailli).
export function poserLaCarte(etat, cle, { villageois = [], hasard = Math.random, lecteur = "", source = "gazette", maintenant = Date.now() } = {}) {
  const sortie = { annonces: [], prives: [], gestes: [] };
  const c = CARTES_DE_LA_GAZETTE[cle];
  if (!c) return sortie;
  const g = normaliserGazette(etat.gazette);
  const tour = Number(etat.tour) || 0;
  const nom = id => villageois.find(v => v.id === id)?.nom ?? id;
  const noms = ids => ids.map(nom).join(", ");
  const vivants = villageois.filter(vivant).map(v => v.id);
  g.tirees.push({ cle, tour, lecteur, source });
  inscrire(etat, { type: "gazette", quoi: "carte", cle, acteurId: lecteur, source }, maintenant);
  // La Crue n'a d'effet qu'avec au moins six vivants.
  if (c.min && vivants.length < c.min) {
    sortie.annonces.push(msg("SansEffet", "Il reste trop peu de monde au village : la carte reste sans effet.", { n: c.min }));
    etat.gazette = g;
    return sortie;
  }
  let x = etat;
  for (const d of definitionsDeLaCarte(cle)) x = tirerEvenement(x, { cle, definition: d, tour, phase: etat.phase === "nuit" ? "aube" : etat.phase, source: "gazette" });
  etat.evenements = x.evenements;
  const absents = (ids, { proteges = true, nuit = false } = {}) => {
    marquer(g, "absent", tour, ids, cle);
    if (proteges) marquer(g, "protege", tour, ids, cle);
    if (nuit) { marquer(g, "intouchable", tour + 1, ids, cle); marquer(g, "sansChasse", tour + 1, ids, cle); }
    if (ids.length) sortie.gestes.push({ type: "silence", ids: [...ids] });
  };
  switch (cle) {
    case "inondation": {
      const femmes = duGenre(etat, vivants, "femme"), hommes = duGenre(etat, vivants, "homme");
      sortie.annonces.push(msg("Refuges", "Les femmes se réfugient au prieuré, les hommes au cabaret.", { femmes: noms(femmes) || "—", hommes: noms(hommes) || "—" }));
      break;
    }
    case "bal-du-samedi": {
      const danseurs = moitieLaPlusJeune(etat, vivants);
      absents(danseurs, { nuit: true });
      sortie.annonces.push(msg("Absents", "Partis jusqu'au soir.", { noms: noms(danseurs) }));
      break;
    }
    case "cueillette": {
      const femmes = duGenre(etat, vivants, "femme");
      absents(femmes);
      sortie.annonces.push(msg("Absents", "Partis jusqu'au soir.", { noms: noms(femmes) || "—" }));
      // L'Herboriste récupère une fiole déjà vidée (le remède d'abord), juste avant la nuit.
      for (const h of villageois.filter(v => vivant(v) && v.role?.effet === "remede")) {
        const vides = objet(etat.fioles?.[h.id]);
        const fiole = vides.remede ? "remede" : vides.poison ? "poison" : "";
        if (!fiole) continue;
        etat.fioles = { ...objet(etat.fioles), [h.id]: { ...vides, [fiole]: false } };
        const f = etat.fiches?.[h.id];
        const u = f?.role?.system?.usages;
        if (u && Number(u.max) > 0) f.role.system.usages = { ...u, restant: Math.min(Number(u.max), Number(u.restant || 0) + 1) };
        sortie.prives.push(secret(h.id, `Fiole.${fiole}`, "Vous rapportez de la cueillette de quoi remplir une fiole vide.", {}));
      }
      break;
    }
    case "banquet-des-veterans": {
      const vieux = moitieLaPlusAgee(etat, vivants);
      absents(vieux);
      sortie.annonces.push(msg("Absents", "Partis jusqu'au soir.", { noms: noms(vieux) }));
      break;
    }
    case "battue": {
      const hommes = duGenre(etat, vivants, "homme");
      absents(hommes, { nuit: true });
      sortie.annonces.push(msg("Absents", "Partis jusqu'à l'aube.", { noms: noms(hommes) || "—" }));
      break;
    }
    case "petit-commis": {
      const commis = lePlusJeune(etat, vivants);
      if (commis) {
        marquer(g, "absent", tour, [commis], cle);
        marquer(g, "intouchable", tour + 1, [commis], cle);
        marquer(g, "triple", tour + 1, [commis], cle);
        g.commis = { acteurId: commis, retour: tour + 1 };
        sortie.gestes.push({ type: "silence", ids: [commis] });
        sortie.annonces.push(msg("Commis", "Le plus jeune part chercher de l'aide.", { nom: nom(commis) }));
      }
      break;
    }
    case "saint-vincent": {
      const b = objet(etat.bailli);
      if (!b.actif) { sortie.annonces.push(msg("SansBailli", "Brumecombe n'a pas de Bailli dans cette veillée : la fête passe.")); break; }
      const ancien = String(b.acteurId ?? "");
      etat.bailli = { ...b, acteurId: "", succession: null, election: -1 };
      inscrire(etat, { type: "bailli", acteurId: "", comment: "destitue", ...(ancien ? { de: ancien } : {}) }, maintenant);
      sortie.annonces.push(msg("Destitue", "Le Bailli est destitué : le village en élit un nouveau.", { nom: ancien ? nom(ancien) : "—" }));
      sortie.gestes.push({ type: "bailli" });
      break;
    }
    case "revenante": {
      // La dernière victime de la meute ; mais un mort qui a tout vu (les cartes des autres, la tanière : aVuTout, secret) ne revient
      // jamais parmi les vivants : la carte est alors sans effet, dite comme quand il n'y a personne (rien ne distingue les deux).
      const causes = ["meute", "epie"];
      const m = [...(etat.morts ?? [])].reverse().find(x => causes.includes(etat.causes?.[x.acteurId] ?? x.cause) && !vivant(villageois.find(v => v.id === x.acteurId))
        && !(etat.partis ?? []).some(p => p.acteurId === x.acteurId));
      if (m && !aToutVu(etat, m.acteurId)) sortie.gestes.push({ type: "revenir", acteurId: m.acteurId });
      else sortie.annonces.push(msg("PersonneARevenir", "Personne ne revient d'entre les morts."));
      break;
    }
    case "executeur":
      g.executeur = { ...executeurInitial(), actif: true, attendu: true };
      sortie.gestes.push({ type: "election-executeur" });
      break;
    case "chatiment": {
      const par = dernierElimine(etat);
      if (par) sortie.gestes.push({ type: "chatiment", par });
      else sortie.annonces.push(msg("PersonnePourChatier", "Personne n'est encore tombé : la carte reste sans effet."));
      break;
    }
    case "cauchemar":
      sortie.gestes.push({ type: "cauchemar" });
      break;
    case "jour-des-sots": {
      const sots = echangerLesPouvoirs(etat, villageois, { tour });
      for (const [a, b] of sots.paires) {
        sortie.prives.push(secret(a, "SotsPouvoir", "Ce tour, votre pouvoir est celui d'un autre.", { role: villageois.find(v => v.id === b)?.role?.nom ?? "" }));
        sortie.prives.push(secret(b, "SotsPouvoir", "Ce tour, votre pouvoir est celui d'un autre.", { role: villageois.find(v => v.id === a)?.role?.nom ?? "" }));
      }
      break;
    }
    default:
      if (c.variante) g.variante = { cle: c.variante, carte: cle, tour, avant: false, appliquee: false };
  }
  etat.gazette = g;
  return sortie;
}

// ======================================================================= le Jour des sots : les pouvoirs échangés
// Les paires présentes (les deux vivants) échangent effet, réveil et usages ; les fioles suivent le remède. (état modifié sur place)
// -> { paires: [[a, b]], sots: null | { tour, paires, fioles: { vers: { de, avant } } } }
export function echangerLesPouvoirs(etat, villageois = [], { tour = Number(etat.tour) || 0 } = {}) {
  const paires = [];
  const fioles = {};
  for (const [ca, cb] of PAIRES_DES_SOTS) {
    const a = villageois.find(v => vivant(v) && v.role?.cle === ca), b = villageois.find(v => vivant(v) && v.role?.cle === cb);
    const fa = etat.fiches?.[a?.id], fb = etat.fiches?.[b?.id];
    if (!fa?.role?.system || !fb?.role?.system) continue;
    // Les fioles de l'Herboriste passent à qui tient son remède ce tour (ce qu'elle a déjà versé compte).
    for (const [de, vers, sys] of [[a.id, b.id, fa.role.system], [b.id, a.id, fb.role.system]]) {
      if (sys.effet !== "remede") continue;
      fioles[vers] = { de, avant: copie(etat.fioles?.[vers] ?? null) };
      etat.fioles = { ...objet(etat.fioles), [vers]: copie(etat.fioles?.[de] ?? {}) };
    }
    echangerLesChamps(fa.role.system, fb.role.system);
    paires.push([a.id, b.id]);
  }
  const sots = paires.length ? { tour, paires, fioles } : null;
  if (sots) etat.gazetteSecret = { ...normaliserGazetteSecret(etat.gazetteSecret), sots };
  return { paires, sots };
}
function echangerLesChamps(x, y) {
  for (const champ of CHAMPS_DU_POUVOIR) [x[champ], y[champ]] = [copie(y[champ]), copie(x[champ])];
}
// Au matin qui suit, chacun reprend son pouvoir, tel que l'autre l'a laissé (usages pris, fioles versées). (modifié sur place)
// -> [acteurId] rendus
export function rendreLesPouvoirs(etat, tour = Number(etat.tour) || 0) {
  const s = normaliserGazetteSecret(etat.gazetteSecret);
  if (!s.sots || s.sots.tour >= tour) return [];
  for (const [vers, f] of Object.entries(s.sots.fioles)) {
    const fioles = { ...objet(etat.fioles), [f.de]: copie(etat.fioles?.[vers] ?? {}) };
    if (f.avant) fioles[vers] = f.avant; else delete fioles[vers];
    etat.fioles = fioles;
  }
  const rendus = [];
  for (const [a, b] of s.sots.paires) {
    const x = etat.fiches?.[a]?.role?.system, y = etat.fiches?.[b]?.role?.system;
    if (!x || !y) continue;
    echangerLesChamps(x, y);
    rendus.push(a, b);
  }
  etat.gazetteSecret = { ...s, sots: null };
  return rendus;
}

// ======================================================================= la nuit
// La proie choisie par la meute cette nuit (majorité ; égalité : le premier noté) ; unanime : tous les loups notés sont d'accord.
export function proieDeLaMeute(actions = [], { unanime = false } = {}) {
  const meute = actions.filter(a => a.roleCle === "meute" && a.cibles?.[0]);
  if (!meute.length) return "";
  const cibles = [...new Set(meute.map(a => a.cibles[0]))];
  if (unanime && cibles.length > 1) return "";
  const compte = {};
  for (const a of meute) compte[a.cibles[0]] = (compte[a.cibles[0]] ?? 0) + 1;
  const max = Math.max(...Object.values(compte));
  return [...meute].sort((a, b) => (a.quand ?? 0) - (b.quand ?? 0)).find(a => compte[a.cibles[0]] === max).cibles[0];
}

// Les options de l'ordre de la nuit (nuit.mjs : options.gazette). villageois : à plat ; actions : celles notées cette nuit.
// -> null, ou { etapes: [étape], sansReveil: [acteurId] (leurs rôles ne se réveillent pas), meute: null | [acteurId] (qui chasse à la
//    place des loups : la Nuit des sots) }
export function nuitDeLaGazette(etat, nuit, villageois = [], actions = etat?.nuit?.actions ?? []) {
  const vivants = villageois.filter(vivant);
  const loups = vivants.filter(v => v.camp === "meute").map(v => v.id);
  const sortie = { etapes: [], sansReveil: [], meute: null };
  const etape = (roleCle, acteurIds, ordre, cibles = 1, extra = {}) => ({ roleCle, acteurIds, ordre, invite: "", cibles, soiMeme: false, gazette: true, ...extra });
  // La Nuit des sots : les loups lisent chacun une carte ; la Braconnière, l'Herboriste et la Liseuse de cendres chassent ensemble.
  const sots = carteDeLaNuit(etat, "nuit-des-sots", nuit);
  if (sots) {
    const tueurs = vivants.filter(v => TUEURS_DES_SOTS.includes(v.role?.cle)).map(v => v.id);
    sortie.meute = tueurs;
    sortie.sansReveil = [...loups, ...tueurs];
    if (loups.length) sortie.etapes.push(etape(CLE_SOTS_VOYANCE, loups, ORDRE_SOTS_VOYANCE));
  }
  const chasseurs = sots ? sortie.meute : loups.filter(id => !sansChasseDeLaNuit(etat, nuit).includes(id));
  const proie = proieDeLaMeute(actions);
  // Le Méchant Benêt : le premier éliminé de la partie désigne un joueur, en tout début de nuit.
  const benet = premierMort(etat);
  if (carteDeLaNuit(etat, "mechant-benet", nuit) && benet && !vivant(villageois.find(v => v.id === benet))) sortie.etapes.push(etape(CLE_BENET, [benet], ORDRE_BENET, 1, { posthume: true }));
  if (proie && chasseurs.length) {
    // Le Toucher mortel : un loup marque sa proie d'un second geste ; la Crue : une seconde proie dans le même refuge ; le Spectre : la
    // proie ouvre les yeux et désigne un ancien loup.
    // Avec le Toucher mortel, le Spectre attend le geste sur cette proie : réveillée avant, elle apprendrait la meute (ses candidats) et
    // serait peut-être épargnée faute de toucher, villageoise qui connaît les loups.
    const touchee = !cartePosee(etat, "toucher-mortel") || actions.some(a => a.roleCle === CLE_TOUCHER && a.cibles?.[0] === proie);
    if (cartePosee(etat, "toucher-mortel")) sortie.etapes.push(etape(CLE_TOUCHER, [...chasseurs], 40));
    if (carteDeLaNuit(etat, "inondation", nuit) && !sots) sortie.etapes.push(etape(CLE_CRUE, [...chasseurs], 40));
    if (cartePosee(etat, "spectre") && touchee && !sots && !carteDeLaNuit(etat, "retour-de-flamme", nuit)) sortie.etapes.push(etape(CLE_SPECTRE, [proie], 40));
  }
  return sortie.etapes.length || sortie.meute || sortie.sansReveil.length ? sortie : null;
}

// Les candidats d'une étape de la Gazette (api.reveiller). -> [acteurId]
export function candidatsDeLEtape(etat, { roleCle, villageois = [], actions = etat?.nuit?.actions ?? [], candidatsMeute = [] } = {}) {
  const vivants = villageois.filter(vivant);
  const proie = proieDeLaMeute(actions);
  switch (roleCle) {
    case CLE_TOUCHER: return [...candidatsMeute];
    case CLE_CRUE: {
      const genre = traitsDe(etat, proie)?.genre;
      return candidatsMeute.filter(id => id !== proie && traitsDe(etat, id)?.genre === genre);
    }
    case CLE_SPECTRE: return vivants.filter(v => v.camp === "meute" && v.id !== proie).map(v => v.id);
    // Tous les vivants (lui est mort) : ne proposer que les non-loups lui montrerait la meute en creux ; un loup désigné, rien (benetDesigne).
    case CLE_BENET: return vivants.map(v => v.id);
    case CLE_SOTS_VOYANCE: return vivants.map(v => v.id);
    default: return [];
  }
}

// Avant la résolution de l'aube (resolution.mjs ne connaît pas la Gazette) : les actions et les villageois de la nuit, transformés.
// -> { villageois, actions, immunises, messages: [msg MJ], retour: null | { victime }, spectre: null | { victime, loup }, crue: "" }
export function preparerLaNuit(etat, { villageois = [], actions = [], tour = Number(etat?.tour) || 1, hasard = Math.random } = {}) {
  const sortie = { villageois, actions: [...actions], immunises: intouchablesDeLaNuit(etat, tour), messages: [], retour: null, spectre: null, crue: "" };
  const mj = (cle, texte, donnees = {}) => sortie.messages.push({ destinataire: "mj", cle: `LAKOUR_LOUPS.Gazette.Nuit.${cle}`, texte, donnees });
  const nom = id => villageois.find(v => v.id === id)?.nom ?? id;
  const sots = carteDeLaNuit(etat, "nuit-des-sots", tour);
  // Les danseurs, les chasseurs de la Battue : un loup parti ne dévore pas.
  const partis = new Set(sansChasseDeLaNuit(etat, tour));
  if (partis.size && !sots) sortie.actions = sortie.actions.filter(a => !(a.roleCle === "meute" && partis.has(a.acteurId)));
  // La Nuit des sots : les loups lisent (camp du Village le temps d'une nuit), les trois tueurs sont la meute.
  if (sots) {
    const tueurs = new Set(villageois.filter(v => vivant(v) && TUEURS_DES_SOTS.includes(v.role?.cle)).map(v => v.id));
    sortie.villageois = villageois.map(v => (v.camp === "meute" && vivant(v) ? { ...v, camp: "village" } : tueurs.has(v.id) ? { ...v, camp: "meute" } : v));
    sortie.actions = sortie.actions.map(a => (a.roleCle === CLE_SOTS_VOYANCE ? { ...a, effet: "voir-role" } : a));
  }
  // Le Jour des sots : les amants ne s'entraînent pas dans la mort cette nuit.
  if (carteDeLaNuit(etat, "jour-des-sots", tour)) sortie.villageois = sortie.villageois.map(v => (v.amoureux ? { ...v, amoureux: "" } : v));
  const proie = proieDeLaMeute(sortie.actions);
  // Le Toucher mortel : sans geste sur la proie, elle est épargnée.
  if (proie && cartePosee(etat, "toucher-mortel") && !sortie.actions.some(a => a.roleCle === CLE_TOUCHER && a.cibles?.[0] === proie)) {
    sortie.actions = sortie.actions.filter(a => a.roleCle !== "meute");
    mj("PasTouchee", "Aucun loup n'a touché la proie : elle est épargnée.", { nom: nom(proie) });
  }
  const proieRetenue = proieDeLaMeute(sortie.actions);
  // Le Retour de flamme : la meute ne tue pas ; un simple Villageois devient loup, sinon le premier loup à gauche de la proie est foudroyé.
  if (carteDeLaNuit(etat, "retour-de-flamme", tour)) {
    const unanime = proieDeLaMeute(sortie.actions, { unanime: true });
    sortie.actions = sortie.actions.filter(a => a.roleCle !== "meute");
    if (unanime) sortie.retour = { victime: unanime };
    else if (proieRetenue) mj("Desaccord", "La meute ne s'est pas accordée : aucune victime.", {});
  } else if (proieRetenue && cartePosee(etat, "spectre") && !sots) {
    // Le Spectre : la proie devient loup et désigne un ancien loup, éliminé à sa place.
    const choix = sortie.actions.find(a => a.roleCle === CLE_SPECTRE && a.acteurId === proieRetenue)?.cibles?.[0] ?? "";
    const anciens = villageois.filter(v => vivant(v) && v.camp === "meute" && v.id !== proieRetenue).map(v => v.id);
    const loup = anciens.includes(choix) ? choix : choisir(anciens, hasard) ?? "";
    sortie.actions = sortie.actions.filter(a => a.roleCle !== "meute");
    if (loup) sortie.spectre = { victime: proieRetenue, loup };
  }
  // La Crue : une seconde proie, dans le refuge de la première (le même genre).
  const crue = carteDeLaNuit(etat, "inondation", tour) && proieRetenue && sortie.actions.some(a => a.roleCle === "meute")
    ? sortie.actions.find(a => a.roleCle === CLE_CRUE && a.cibles?.[0]) : null;
  const seconde = crue && crue.cibles[0] !== proieRetenue && traitsDe(etat, crue.cibles[0])?.genre === traitsDe(etat, proieRetenue)?.genre ? crue.cibles[0] : "";
  sortie.actions = sortie.actions.filter(a => ![CLE_TOUCHER, CLE_CRUE, CLE_SPECTRE, CLE_BENET].includes(a.roleCle));
  if (seconde) {
    sortie.actions.push({ acteurId: crue.acteurId, roleCle: CLE_CRUE, cibles: [seconde], effet: "tuer", quand: crue.quand });
    sortie.crue = seconde;
  }
  return sortie;
}

// Les loups qui chassent cette nuit selon la Gazette (api.demanderActionMeute) : les tueurs de la Nuit des sots, sinon les loups qui ne
// sont ni danseurs ni chasseurs de la Battue. -> null (rien à changer) ou [acteurId]
export function chasseursDeLaGazette(etat, nuit, villageois = []) {
  if (carteDeLaNuit(etat, "nuit-des-sots", nuit)) return villageois.filter(v => vivant(v) && TUEURS_DES_SOTS.includes(v.role?.cle)).map(v => v.id);
  const partis = sansChasseDeLaNuit(etat, nuit);
  return partis.length ? villageois.filter(v => vivant(v) && v.camp === "meute" && !partis.includes(v.id)).map(v => v.id) : null;
}

// Le Somnambule (carte 1) : les rôles que la Liseuse de cendres a lus cette nuit, sans dire sur qui. actions : celles de la nuit ;
// villageois : à plat. Une lecture de la Liseuse : l'étape « liseuse-de-cendres » (sa carte, sa seconde carte de Double visage, ou la
// carte jouée par un Bateleur : noterAction donne alors à l'action l'effet de la carte), ou une action sans étape notée par qui tient la
// carte. -> [nom de rôle]
export const CLE_LISEUSE_DE_CENDRES = "liseuse-de-cendres";
export function rolesLusParLaLiseuse(actions = [], villageois = [], lire = v => v?.role?.nom ?? "") {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const deLaLiseuse = a => a.roleCle === CLE_LISEUSE_DE_CENDRES || (!a.roleCle && parId.get(a.acteurId)?.role?.cle === CLE_LISEUSE_DE_CENDRES);
  return actions.filter(a => (a.effet ?? parId.get(a.acteurId)?.role?.effet) === "voir-role" && a.roleCle !== CLE_SOTS_VOYANCE && deLaLiseuse(a))
    .flatMap(a => a.cibles ?? []).map(id => lire(parId.get(id))).filter(Boolean);
}
// La Liseuse de cendres a-t-elle lu une carte de loup cette nuit ? (Spiritisme, Séance IV)
export const liseuseAVuUnLoup = (actions = [], villageois = [], apparent = v => v?.role?.camp) =>
  rolesLusParLaLiseuse(actions, villageois, v => (apparent(v) === "meute" ? "loup" : "")).length > 0;

// ======================================================================= le matin
// Ce qui finit au matin du tour `tour` : les pouvoirs échangés du Jour des sots, la variante appliquée pour un tour. (modifié sur place)
// -> { rendus: [acteurId], variante: "" | cle de variante remise }
export function finDuTourDeLaGazette(etat, tour = Number(etat.tour) || 0) {
  const rendus = rendreLesPouvoirs(etat, tour);
  const g = normaliserGazette(etat.gazette);
  let variante = "";
  if (g.variante && g.variante.tour < tour) {
    if (g.variante.appliquee && etat.variantes) {
      etat.variantes = { ...etat.variantes, [g.variante.cle]: Boolean(g.variante.avant) };
      variante = g.variante.cle;
    }
    g.variante = null;
  }
  if (g.commis && g.commis.retour < tour) g.commis = null;
  etat.gazette = g;
  return { rendus, variante };
}
// Le narrateur applique ce tour la variante du livre que la carte propose (Dimanche de soleil, Fin des vendanges, Lundi gris).
export function appliquerLaVarianteDuJour(etat) {
  const g = normaliserGazette(etat.gazette);
  if (!g.variante || g.variante.appliquee || g.variante.tour !== Number(etat.tour)) return { ok: false, cle: "" };
  const v = objet(etat.variantes);
  g.variante = { ...g.variante, avant: Boolean(v[g.variante.cle]), appliquee: true };
  etat.variantes = { ...v, [g.variante.cle]: true };
  etat.gazette = g;
  return { ok: true, cle: g.variante.cle };
}

// Le tirage du matin est-il dû ? (la Gazette active, pas le premier matin, un matin sur `rythme`, le narrateur ne choisit pas)
export function tirageDu(etat) {
  const g = normaliserGazette(etat?.gazette);
  const tour = Number(etat?.tour) || 0;
  return g.actif && !g.choix && tour >= 2 && (tour - 2) % g.rythme === 0 && !g.tirees.some(t => t.tour === tour && t.source === "gazette");
}
// La carte du dessus, prise du paquet (secret). -> "" si le paquet est vide (état modifié sur place)
export function prendreLaCarte(etat, cle = "") {
  const s = normaliserGazetteSecret(etat.gazetteSecret);
  const i = cle ? s.paquet.indexOf(cle) : 0;
  if (i < 0 || !s.paquet.length) return "";
  const [carte] = s.paquet.splice(i, 1);
  etat.gazetteSecret = s;
  etat.gazette = { ...normaliserGazette(etat.gazette), restantes: s.paquet.length };
  return carte;
}

// ======================================================================= les charges : le Crieur public, l'Exécuteur
const bailliVivant = (etat, villageois) => {
  const b = objet(etat?.bailli);
  return b.actif && b.acteurId && vivant(villageois.find(v => v.id === b.acteurId)) ? String(b.acteurId) : "";
};
// Ce qu'attend la charge du Crieur : null, ou { quoi: "nommer" | "transmettre" | "garder", bailli, par (qui choisit), actuel, candidats }.
export function attenteDuCrieur(etat, villageois = []) {
  const g = normaliserGazette(etat?.gazette);
  if (!g.crieur.actif || etat?.vainqueur || etat?.phase === "fin") return null;
  const bailli = bailliVivant(etat, villageois);
  if (!bailli) return null;
  const actuel = vivant(villageois.find(v => v.id === g.crieur.acteurId)) ? g.crieur.acteurId : "";
  const autres = villageois.filter(v => vivant(v) && v.id !== bailli).map(v => v.id);
  if (!autres.length) return null;
  if (actuel && actuel === bailli) return { quoi: "transmettre", bailli, par: bailli, actuel, candidats: autres };
  if (!actuel) return normaliserGazetteSecret(etat?.gazetteSecret).main.length ? { quoi: "nommer", bailli, par: bailli, actuel: "", candidats: autres } : null;
  if (g.crieur.par !== bailli) return { quoi: "garder", bailli, par: bailli, actuel, candidats: [actuel, ...autres.filter(id => id !== actuel)] };
  return null;
}
// Le Crieur nommé (ou gardé) par le Bailli. (état modifié sur place) -> { acteurId, change }
export function nommerLeCrieur(etat, { acteurId = "", par = "" } = {}) {
  const g = normaliserGazette(etat.gazette);
  const change = acteurId !== g.crieur.acteurId;
  g.crieur = { ...g.crieur, acteurId: String(acteurId), par: String(par), ...(change ? { depuis: Number(etat.tour) || 0, annonce: 0 } : {}),
    cartes: normaliserGazetteSecret(etat.gazetteSecret).main.length };
  etat.gazette = g;
  inscrire(etat, { type: "gazette", quoi: change ? "crieur" : "crieur-garde", acteurId, ...(par ? { par } : {}) });
  return { acteurId, change };
}
// L'annonce du Crieur est-elle due ce matin ? (vivant, nommé avant ce jour, des cartes en main, pas encore demandée ce jour)
export function annonceDuCrieurDue(etat, villageois = []) {
  const g = normaliserGazette(etat?.gazette);
  const c = g.crieur;
  return c.actif && Boolean(c.acteurId) && vivant(villageois.find(v => v.id === c.acteurId)) && Number(etat?.tour) > c.depuis
    && c.annonce !== Number(etat?.tour) && normaliserGazetteSecret(etat?.gazetteSecret).main.length > 0 && !etat?.vainqueur;
}
// La révocation du Crieur par le Bailli (pouvoir de jour) : -> "" ou la raison (jour.mjs).
export function raisonDeLaRevocation(etat, villageois = []) {
  const g = normaliserGazette(etat?.gazette);
  if (!g.crieur.actif || !g.crieur.acteurId) return "crieur";
  if (annonceDuCrieurDue(etat, villageois)) return "annonce";
  return "";
}

// L'Exécuteur élu (vote « executeur » clos) : l'élu, ou le sort parmi les ex æquo en tête ; personne : il reste attendu.
export function elireExecuteur(etat, resultat, { villageois = [], hasard = Math.random } = {}) {
  const g = normaliserGazette(etat.gazette);
  g.executeur.election = Number(etat.tour) || 0;
  const vivants = villageois.filter(vivant).map(v => v.id);
  let elu = resultat?.elus?.length === 1 && vivants.includes(resultat.elus[0]) ? resultat.elus[0] : "";
  let sort = false;
  if (!elu && resultat?.egalite) {
    const max = Math.max(0, ...Object.values(resultat.decompte ?? {}));
    elu = choisir(Object.keys(resultat.decompte ?? {}).filter(id => max > 0 && resultat.decompte[id] === max && vivants.includes(id)).sort(), hasard) ?? "";
    sort = Boolean(elu);
  }
  if (elu) {
    g.executeur = { ...g.executeur, acteurId: elu, attendu: false, succession: null };
    if (etat.vote?.resultat?.numero === resultat?.numero) Object.assign(etat.vote.resultat, { elus: [elu], elu, sort });
    inscrire(etat, { type: "gazette", quoi: "executeur", acteurId: elu });
  }
  etat.gazette = g;
  return { elu, sort };
}
// L'Exécuteur en charge (vivant) : son id, "" sinon.
export const executeurEnCharge = (etat, villageois = []) => {
  const e = normaliserGazette(etat?.gazette).executeur;
  return e.actif && e.acteurId && vivant(villageois.find(v => v.id === e.acteurId)) ? e.acteurId : "";
};
// L'élection de l'Exécuteur est-elle due ? (la carte posée, personne en charge ni succession, pas de vote ouvert, une par jour)
export function electionExecuteurDue(etat, villageois = []) {
  const e = normaliserGazette(etat?.gazette).executeur;
  return e.actif && e.attendu && !e.succession && !etat?.vote?.ouvert && e.election !== Number(etat?.tour) && ["aube", "jour", "vote"].includes(etat?.phase)
    && !executeurEnCharge(etat, villageois) && !etat?.vainqueur;
}

// ======================================================================= les votes de la Gazette
// Grande Défiance : chacun donne deux voix à deux amis ; ceux qui n'en reçoivent aucune sont éliminés. votes : { votant: [a, b] }.
export const VOIX_DE_LA_DEFIANCE = 2;
export function decompterDefiance({ votes = {}, candidats = [], votants = null } = {}) {
  const admis = votants ? new Set(votants) : null;
  const decompte = Object.fromEntries(candidats.map(id => [id, 0]));
  const valides = {};
  for (const [votant, choix] of Object.entries(votes)) {
    if (admis && !admis.has(votant)) continue;
    const amis = [...new Set([].concat(choix ?? []).filter(id => id && id !== votant && id in decompte))].slice(0, VOIX_DE_LA_DEFIANCE);
    if (!amis.length) continue;
    valides[votant] = amis;
    for (const id of amis) decompte[id] += 1;
  }
  const elus = candidats.filter(id => decompte[id] === 0);
  return { decompte, votes: valides, elus, elu: elus[0] ?? null, egalite: false, departage: null };
}
// Le Cauchemar : le ou les plus cités sont éliminés. -> elus
export function plusCites(decompte = {}) {
  const max = Math.max(0, ...Object.values(decompte));
  return max > 0 ? Object.keys(decompte).filter(id => decompte[id] === max).sort() : [];
}
// L'ordre d'un vote à tour de rôle (Influences, Cauchemar) : du premier, puis vers sa gauche (cercle.mjs), les vivants admis.
export function ordreAGauche(etat, villageois = [], premier = "", admis = null) {
  const cercle = cercleDe(etat, villageois);
  const vivants = new Set(villageois.filter(vivant).map(v => v.id));
  const permis = id => vivants.has(id) && (!admis || admis.includes(id));
  if (!cercle.length) return [];
  let i = cercle.indexOf(premier);
  if (i < 0) i = 0;
  const ordre = [];
  for (let k = 0; k < cercle.length; k++) {
    const id = cercle[(((i - k) % cercle.length) + cercle.length) % cercle.length];
    if (permis(id)) ordre.push(id);
  }
  return ordre;
}
// Le premier du Cauchemar : le voisin de gauche (vivant) du dernier éliminé ; sans mort, la première place du cercle.
export function premierDuCauchemar(etat, villageois = []) {
  const dernier = dernierElimine(etat);
  return (dernier && premierAGauche(etat, villageois, dernier)) || cercleDe(etat, villageois).find(id => vivant(villageois.find(v => v.id === id))) || "";
}

// ======================================================================= la fin : alliés et marchés
// Le rôle d'un mort que la Gazette cache : "enfouissement" (la carte 26 : une victime de la meute, et avec elle toute mort que le village
// apprend comme « mort dans la nuit » — poison, feu, peste, Spectre : en révéler une trahirait que ce n'était pas la meute), "executeur"
// (un condamné du vote, la carte 20 : seul l'Exécuteur l'apprend), "" sinon. (Appelé avant la mort : l'Exécuteur condamné est encore vivant.)
export function roleCacheParLaGazette(etat, { cause = "", villageois = [] } = {}) {
  if (cause && causePublique(cause) === "nuit" && cartePosee(etat, "enfouissement")) return "enfouissement";
  if (cause === "vote" && executeurEnCharge(etat, villageois)) return "executeur";
  return "";
}
// La séance demandée cette nuit par la Liseuse d'étoiles : { tour, par } si elle est due ce matin (tour), null sinon.
export function seanceDuMatin(etat) {
  const s = normaliserGazetteSecret(etat?.gazetteSecret).seance;
  return s && s.tour === Number(etat?.tour) ? s : null;
}

// Le Méchant Benêt : un allié secret de la meute gagne avec elle. -> [acteurId]
export const alliesDeLaMeute = etat => normaliserGazetteSecret(etat?.gazetteSecret).allies;
// Qui a passé un marché avec le Malin et finit dans le camp perdant (exclu de la partie suivante). camp : (id) -> camp actuel.
export function marchesPerdus(etat, { vainqueur = etat?.vainqueur ?? "", campDe = () => "" } = {}) {
  const allies = new Set(alliesDeLaMeute(etat));
  return normaliserGazette(etat?.gazette).marches.map(m => m.acteurId).filter(id => {
    const camp = allies.has(id) ? "meute" : campDe(id);
    if (!vainqueur) return false;
    if (vainqueur === "village" || vainqueur === "meute") return camp !== vainqueur;
    return id !== vainqueur;
  });
}

// Le public et le secret d'une veillée (etat.mjs : separerEtat, fusionnerEtat).
export const contexteDeLaGazette = etat => ({ allies: alliesDeLaMeute(etat) });
