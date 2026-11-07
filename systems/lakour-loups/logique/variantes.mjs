// Les VARIANTES du jeu de soirée (Le Pacte, étape 5 ; docs/plan-le-pacte.md). Logique pure.
//
// Chaque variante est une règle de la veillée, PUBLIQUE (comme la Petite tablée ou Le Village) : choisie à la préparation (réglage
// monde, défaut : non ; case de la Table de jeu), recopiée dans l'état à la distribution (etat.variantes), jamais changée ensuite.
// Ce que chacune garde de secret vit dans etat.variantesSecret (les secrets du MJ, etat.mjs).
//
// - Veillée aux chandelles (« chandelles ») : une chandelle devant chaque joueur ; celle d'un mort est soufflée (la victime de la meute
//   au matin, le condamné après le vote). Adaptation en ligne : une chandelle sur la carte de chacun, à la Table de jeu (allumée tant
//   qu'il vit). Version angoissante (« angoissante ») : ce sont les loups eux-mêmes qui soufflent la chandelle de leur victime ; si plus
//   d'une chandelle s'éteint, la meute n'a pas de victime. Adaptation : chaque loup souffle séparément une chandelle (son choix de la
//   nuit, demanderActionMeute) ; s'ils n'ont pas tous soufflé la même, pas de victime, et le village voit au matin les chandelles
//   éteintes (annoncées, puis rallumées). Un loup qui ne souffle rien n'éteint rien.
// - La Chaîne des innocents (« chaine ») : le vote d'exécution se fait autrement. Tous les vivants sont debout ; le voisin de gauche
//   du dernier éliminé (cercle.mjs) désigne un villageois debout dont il garantit l'innocence ; celui-ci s'assied et désigne à son
//   tour, et ainsi de suite : le dernier debout est le condamné. Les loups peuvent se blanchir entre eux. Adaptation : sans réponse
//   au délai, le sort désigne à la place du joueur (la chaîne ne s'arrête jamais) ; sans mort encore, la chaîne part du Bailli, sinon
//   de la première place du cercle. Ni voix double, ni plume, ni égalité : il n'y a pas de voix.
// - Le Mur des murmures (« mur ») : chaque nuit, chaque vivant peut écrire une courte phrase anonyme ; au matin, le narrateur les lit
//   toutes, mêlées. Les auteurs ne sont JAMAIS gardés : les phrases entrent au secret du MJ sans nom, déjà mêlées (graverUnMurmure).
//   Adaptation : un réveil de tous les vivants à la fin de la nuit (étape « mur », ORDRE_MUR), une fenêtre d'écriture chacun.
// - Double visage (« doubleVisage » : "petite" | "grande") : petite complication — un rôle VISIBLE (public dès la distribution) tiré
//   de VISAGES (et jusqu'à deux Villageois), puis une carte d'allégeance secrète (loupsDoubleVisage(n) loups, le reste villageois) qui
//   fait le camp ; grande complication — les mêmes cartes, deux par joueur, face cachée : une carte de loup fait un loup, une carte à
//   pouvoir donne son pouvoir (deux cartes à pouvoir : les deux ; la seconde vit dans la fiche, fiche.seconde). 7 à 18 joueurs : au-delà
//   de 9, un second paquet (deux fois les mêmes cartes ; 3 loups jusqu'à 13, 4 au-delà). La Liseuse de cendres lit les cartes secrètes.
//   Réglage « une allégeance loup de plus » (« allegeanceLoup », Le Pacte, étape 6c, décidé avec Jordan ; seulement avec Double visage) :
//   une carte d'allégeance loup de plus au paquet (petite et grande complication), à la place d'une allégeance villageoise. Le paquet du
//   livre favorise le village d'autant plus que la table est grande (docs/equilibre-veillees.md) : mesuré, conseillé dès 16 joueurs en
//   petite complication (et à 13), dès 12 en grande ; en dessous, la carte de plus donne la partie à la meute.
// - Les Vendanges (« vendanges ») : un loup de plus que le barème, et chaque pouvoir est « éméché » (voir plus bas, et resolution.mjs).
// - L'Envoûtement (« envoutement ») : la victime de la meute n'est pas éliminée, elle perd ses pouvoirs et reste envoûtée, en secret
//   (elle seule le sait) ; condamnée par le village, elle entraîne dans la mort toutes les envoûtées d'avant elle ; la meute gagne
//   quand elle a envoûté l'avant-dernier villageois.
// - La Peste noire existe à part (peste.mjs). Les Hameaux ne sont pas faits : voir docs/plan-le-pacte.md (proposition chiffrée).
//
// Exclusions (variantesPermises) : aucune variante dans une Nuit de la Saint-Martin ; ni Double visage, ni Vendanges, ni Envoûtement à
// la petite tablée (ses dosages sont mesurés sans elles) ni dans une peste noire (sans meute, elles n'ont pas de sens ; elles
// empêchent le tirage d'une peste) ; Double visage de 7 à 18 joueurs ; la Chaîne remplace le Banc des accusés.

import { voisins, trioAutour, premierAGauche, cercleDe } from "./cercle.mjs";
import { melanger, choisir } from "./hasard.mjs";

export const MODES_DOUBLE_VISAGE = ["petite", "grande"];
// Les réglages monde de chaque variante (scripts/reglages.mjs).
export const REGLAGES_DES_VARIANTES = { chandelles: "chandelles", angoissante: "chandellesAngoissantes", chaine: "chaineDesInnocents",
  mur: "murDesMurmures", doubleVisage: "doubleVisage", allegeanceLoup: "allegeanceLoupEnPlus", vendanges: "vendanges", envoutement: "envoutement" };
export const CLES_DES_VARIANTES = Object.keys(REGLAGES_DES_VARIANTES);

const vivant = v => Boolean(v) && v.vivant !== false;
const liste = x => (Array.isArray(x) ? [...new Set(x.map(y => String(y ?? "")).filter(Boolean))] : []);

// ------------------------------------------------------------------ le choix des variantes, et l'état
export const choixDesVariantes = (x = {}) => ({
  chandelles: Boolean(x?.chandelles), angoissante: Boolean(x?.chandelles && x?.angoissante), chaine: Boolean(x?.chaine), mur: Boolean(x?.mur),
  doubleVisage: MODES_DOUBLE_VISAGE.includes(x?.doubleVisage) ? x.doubleVisage : "",
  // Une allégeance loup de plus : seulement avec Double visage (comme la version angoissante avec les chandelles).
  allegeanceLoup: Boolean(MODES_DOUBLE_VISAGE.includes(x?.doubleVisage) && x?.allegeanceLoup),
  vendanges: Boolean(x?.vendanges), envoutement: Boolean(x?.envoutement)
});

// Le public : les règles de la veillée ; ratees : les chandelles soufflées par une meute en désaccord (angoissante) ; chaineEnCours :
// la Chaîne des innocents du vote ouvert ; murmures : le mur du dernier matin ({ tour, textes }).
export const variantesInitiales = (choix = {}) => ({ ...choixDesVariantes(choix), ratees: [], chaineEnCours: null, murmures: null });
// Les secrets : souffles (les chandelles soufflées cette nuit par les loups, angoissante) ; murmures (les phrases de la nuit, SANS
// auteur, déjà mêlées) ; envoutes ; triangle (les Vendanges : le trompeur, le trompé, le nouvel amant) ; cartes (Double visage : les
// cartes secrètes de chacun, pour la Liseuse et la fin de partie).
export const variantesSecretInitial = () => ({ souffles: null, murmures: [], envoutes: [], triangle: null, cartes: {} });

function normaliserChaine(c) {
  if (!c || typeof c !== "object") return null;
  return { tour: Number(c.tour) || 0, numero: Number(c.numero) || 0, debout: liste(c.debout),
    assis: (Array.isArray(c.assis) ? c.assis : []).filter(x => x?.id).map(x => ({ id: String(x.id), par: String(x.par ?? ""), ...(x.hasard ? { hasard: true } : {}) })),
    designateur: String(c.designateur ?? ""), condamne: String(c.condamne ?? "") };
}

export function normaliserVariantes(v) {
  const x = v && typeof v === "object" ? v : {};
  return { ...choixDesVariantes(x),
    ratees: (Array.isArray(x.ratees) ? x.ratees : []).map(r => ({ tour: Number(r?.tour) || 0, ids: liste(r?.ids) })).slice(-20),
    chaineEnCours: normaliserChaine(x.chaineEnCours),
    murmures: x.murmures && typeof x.murmures === "object" ? { tour: Number(x.murmures.tour) || 0, textes: (Array.isArray(x.murmures.textes) ? x.murmures.textes : []).map(String) } : null };
}

export function normaliserVariantesSecret(s) {
  const x = s && typeof s === "object" ? s : {};
  const t = x.triangle;
  return {
    souffles: x.souffles && typeof x.souffles === "object" ? { tour: Number(x.souffles.tour) || 0, ids: liste(x.souffles.ids) } : null,
    murmures: (Array.isArray(x.murmures) ? x.murmures : []).map(String),
    envoutes: (Array.isArray(x.envoutes) ? x.envoutes : []).filter(e => e?.acteurId).map(e => ({ acteurId: String(e.acteurId), tour: Number(e.tour) || 0 })),
    triangle: t && t.trompeur && t.trompe && t.amant ? { trompeur: String(t.trompeur), trompe: String(t.trompe), amant: String(t.amant) } : null,
    cartes: x.cartes && typeof x.cartes === "object" && !Array.isArray(x.cartes)
      ? Object.fromEntries(Object.entries(x.cartes).map(([id, c]) => [id, (Array.isArray(c) ? c : []).map(String)])) : {}
  };
}

const variantesDe = etat => normaliserVariantes(etat?.variantes);
const secretDe = etat => normaliserVariantesSecret(etat?.variantesSecret);

export const DOUBLE_VISAGE = Object.freeze({ min: 7, max: 18 });
// Les variantes que cette veillée peut avoir (voir l'en-tête). places : le nombre de joueurs (0 : inconnu, Double visage gardé).
export function variantesPermises(voulues = {}, { saintMartin = false, tablee = false, peste = false, places = 0 } = {}) {
  if (saintMartin) return choixDesVariantes();
  const c = choixDesVariantes(voulues);
  if (tablee || peste) Object.assign(c, { doubleVisage: "", vendanges: false, envoutement: false });
  if (c.doubleVisage && places && (places < DOUBLE_VISAGE.min || places > DOUBLE_VISAGE.max)) c.doubleVisage = "";
  if (!c.doubleVisage) c.allegeanceLoup = false;
  return c;
}
// Ces variantes empêchent le tirage d'une peste noire (elles ont besoin de la meute).
export const sansPeste = (choix = {}) => Boolean(choix.doubleVisage || choix.vendanges || choix.envoutement);
// Les variantes en jeu, dans l'ordre (pour l'annonce et la Table) : ["chandelles", "chaine", …] ; Double visage : "doubleVisage".
export const variantesEnJeu = etat => {
  const v = variantesDe(etat);
  return ["chandelles", "chaine", "mur", "doubleVisage", "vendanges", "envoutement"].filter(c => Boolean(v[c]));
};

// ------------------------------------------------------------------ Veillée aux chandelles
export const chandellesActives = etat => variantesDe(etat).chandelles;
export const chandellesAngoissantes = etat => variantesDe(etat).angoissante;
// Les chandelles que les loups ont soufflées ([{ cible }] ou [acteurId]) : distinctes, sans les loups qui n'ont rien soufflé ; la
// victime seulement s'ils ont tous soufflé la même.
export function chandellesSoufflees(choix = []) {
  const ids = [...new Set((choix ?? []).map(c => (c && typeof c === "object" ? c.cible : c)).filter(Boolean).map(String))];
  return { ids, cible: ids.length === 1 ? ids[0] : "" };
}
// Les souffles de la nuit (secret, état normalisé modifié sur place).
export function noterLesSouffles(etat, { tour = Number(etat?.tour) || 0, ids = [] } = {}) {
  etat.variantesSecret = { ...secretDe(etat), souffles: { tour, ids: liste(ids) } };
  return etat;
}
// Au matin : les chandelles d'une meute en désaccord, à annoncer ([] sinon) ; elles passent au public (ratees), les souffles sont oubliés.
export function chandellesDuMatin(etat, tour) {
  const s = secretDe(etat).souffles;
  const ids = s && s.tour === tour && s.ids.length > 1 ? s.ids : [];
  etat.variantesSecret = { ...secretDe(etat), souffles: null };
  if (ids.length) {
    const v = variantesDe(etat);
    etat.variantes = { ...v, ratees: [...v.ratees, { tour, ids }].slice(-20) };
  }
  return ids;
}

// ------------------------------------------------------------------ La Chaîne des innocents
export const chaineActive = etat => variantesDe(etat).chaine;
export const chaineEnCours = etat => variantesDe(etat).chaineEnCours;
// Celui qui commence : le premier encore debout à la gauche du dernier éliminé ; sans mort, le Bailli s'il est debout, sinon la
// première place du cercle encore debout.
export function premierDeLaChaine(etat, villageois = [], debout = []) {
  const parmi = new Set(debout);
  const dernier = (Array.isArray(etat?.morts) ? etat.morts : []).at(-1)?.acteurId ?? "";
  if (dernier) {
    const g = premierAGauche(etat, villageois, dernier, v => parmi.has(String(v.id)));
    if (g) return g;
  }
  const bailli = etat?.bailli?.actif ? etat.bailli.acteurId : "";
  if (bailli && parmi.has(bailli)) return bailli;
  return cercleDe(etat, villageois).find(id => parmi.has(id)) ?? debout[0] ?? "";
}
// La chaîne s'ouvre (état normalisé, modifié sur place) : debout = les candidats du vote ; un seul debout, il est condamné.
export function ouvrirLaChaine(etat, { debout = [], premier = "", numero = Number(etat?.vote?.numero) || 0 } = {}) {
  const d = liste(debout);
  etat.variantes = { ...variantesDe(etat), chaineEnCours: { tour: Number(etat.tour) || 0, numero, debout: d, assis: [], designateur: premier || d[0] || "",
    condamne: d.length === 1 ? d[0] : "" } };
  return etat;
}
// Ceux que le désignateur peut asseoir : les debout, lui excepté.
export const candidatsDeLaChaine = c => (c && !c.condamne ? c.debout.filter(id => id !== c.designateur) : []);
// Une désignation (état normalisé, modifié sur place) -> { ok, raison: "" | "close" | "tour" | "cible", condamne }
export function designerDansLaChaine(etat, { par = "", cible = "", hasard = false } = {}) {
  const c = normaliserChaine(variantesDe(etat).chaineEnCours);
  if (!c || c.condamne) return { ok: false, raison: "close", condamne: c?.condamne ?? "" };
  if (par !== c.designateur) return { ok: false, raison: "tour", condamne: "" };
  if (!candidatsDeLaChaine(c).includes(cible)) return { ok: false, raison: "cible", condamne: "" };
  c.debout = c.debout.filter(id => id !== cible);
  c.assis.push({ id: cible, par, ...(hasard ? { hasard: true } : {}) });
  c.designateur = cible;
  if (c.debout.length === 1) c.condamne = c.debout[0];
  etat.variantes = { ...variantesDe(etat), chaineEnCours: c };
  return { ok: true, raison: "", condamne: c.condamne };
}
// La clôture (état normalisé, modifié sur place) : le résultat d'un vote d'exécution sans voix, le dernier debout condamné.
// -> { etat, resultat }
export function cloreLaChaine(etat) {
  const c = normaliserChaine(variantesDe(etat).chaineEnCours);
  const condamne = c?.condamne ?? "";
  const v = etat.vote;
  const resultat = { decompte: {}, elu: condamne || null, elus: condamne ? [condamne] : [], votes: {}, egalite: false, objet: "execution",
    numero: v.numero, tour: Number(etat.tour) || 0, souffles: [], poids: {}, departage: null,
    chaine: { assis: c ? c.assis.map(x => ({ ...x })) : [], condamne } };
  v.ouvert = false;
  v.exprimes = [];
  v.resultat = resultat;
  etat.variantes = { ...variantesDe(etat), chaineEnCours: null };
  return { etat, resultat };
}

// ------------------------------------------------------------------ Le Mur des murmures
export const CLE_MUR = "mur";
export const ORDRE_MUR = 95;
export const LONGUEUR_MURMURE = 120;
export const murActif = etat => variantesDe(etat).mur;
export const nettoyerMurmure = texte => String(texte ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MURMURE);
// Une phrase gravée (état normalisé, modifié sur place) : SANS auteur, glissée à une place au hasard parmi celles de la nuit.
export function graverUnMurmure(etat, texte, hasard = Math.random) {
  const mot = nettoyerMurmure(texte);
  if (!mot) return etat;
  const murmures = [...secretDe(etat).murmures];
  murmures.splice(Math.floor(hasard() * (murmures.length + 1)), 0, mot);
  etat.variantesSecret = { ...secretDe(etat), murmures };
  return etat;
}
// Au matin (état normalisé, modifié sur place) : le mur devient public, mêlé encore une fois. -> les phrases ([] : mur vide)
export function lireLeMur(etat, tour, hasard = Math.random) {
  const textes = melanger(secretDe(etat).murmures, hasard);
  etat.variantesSecret = { ...secretDe(etat), murmures: [] };
  etat.variantes = { ...variantesDe(etat), murmures: { tour, textes } };
  return textes;
}

// ------------------------------------------------------------------ Double visage
export const VISAGES = ["liseuse-de-cendres", "braconniere", "herboriste", "entremetteuse", "garde-du-pont", "aieul", "souffre-douleur"];
// Les pouvoirs passifs (lus sur la carte principale par le reste du système) : dans la grande complication, ils passent devant.
export const PASSIFS_DU_VISAGE = ["aieul", "souffre-douleur", "braconniere"];
export const CARTE_LOUP = "loup-de-brumecombe";
export const CARTE_VILLAGEOIS = "villageois";
export const doubleVisage = etat => variantesDe(etat).doubleVisage;
// Les loups d'allégeance : deux pour un paquet (7 à 9 joueurs), puis trois jusqu'à 13, quatre au-delà (deux paquets) ; enPlus (le
// réglage « une allégeance loup de plus », allegeanceLoup) : une de plus (ALLEGEANCES_LOUP_EN_PLUS).
export const ALLEGEANCES_LOUP_EN_PLUS = 1;
// (enPlus === true : un index de .map n'en fait pas une.)
export const loupsDoubleVisage = (n, enPlus = false) => (n <= 9 ? 2 : n <= 13 ? 3 : 4) + (enPlus === true ? ALLEGEANCES_LOUP_EN_PLUS : 0);
// Le réglage est-il en jeu dans cette veillée ?
export const allegeanceLoupEnPlus = etat => Boolean(variantesDe(etat).allegeanceLoup);
// Les cartes VISIBLES pour n joueurs : les sept pouvoirs, puis deux Villageois ; au-delà de 9, un second paquet dans le même ordre.
export function paquetDoubleVisage(n) {
  if (!Number.isInteger(n) || n < DOUBLE_VISAGE.min || n > DOUBLE_VISAGE.max) throw new Error(`Double visage : ${DOUBLE_VISAGE.min} à ${DOUBLE_VISAGE.max} joueurs (${n}).`);
  const un = [...VISAGES, CARTE_VILLAGEOIS, CARTE_VILLAGEOIS];
  return [...un, ...un].slice(0, n);
}
// Les allégeances de n places, mêlées : "meute" ou "village" (enPlus : une allégeance loup de plus).
export function allegeances(n, hasard = Math.random, enPlus = false) {
  const k = loupsDoubleVisage(n, enPlus);
  return melanger([...Array(k).fill("meute"), ...Array(Math.max(0, n - k)).fill("village")], hasard);
}
// La grande complication : les cartes visibles et les cartes d'allégeance, mêlées, deux par joueur (enPlus : une allégeance loup de
// plus). -> [[cle, cle]] (n paires)
export function cartesDeLaGrande(paquet = [], hasard = Math.random, enPlus = false) {
  const n = paquet.length;
  const k = loupsDoubleVisage(n, enPlus);
  const tas = melanger([...paquet, ...Array(k).fill(CARTE_LOUP), ...Array(Math.max(0, n - k)).fill(CARTE_VILLAGEOIS)], hasard);
  return Array.from({ length: n }, (_, i) => [tas[2 * i], tas[2 * i + 1]]);
}
// Deux cartes -> { principale, seconde, camp } : une carte de loup fait un loup ; la principale est le pouvoir passif s'il y en a un
// (le système le lit là), sinon la première carte à pouvoir ; sans pouvoir, le Loup ou le Villageois ; deux fois le même pouvoir
// n'en donne qu'un.
export function lireDeuxCartes(cartes = []) {
  const [a = CARTE_VILLAGEOIS, b = CARTE_VILLAGEOIS] = cartes;
  const loup = a === CARTE_LOUP || b === CARTE_LOUP;
  let pouvoirs = [...new Set([a, b].filter(c => c !== CARTE_LOUP && c !== CARTE_VILLAGEOIS))];
  if (pouvoirs.length === 2 && PASSIFS_DU_VISAGE.includes(pouvoirs[1]) && !PASSIFS_DU_VISAGE.includes(pouvoirs[0])) pouvoirs = [pouvoirs[1], pouvoirs[0]];
  return { principale: pouvoirs[0] ?? (loup ? CARTE_LOUP : CARTE_VILLAGEOIS), seconde: pouvoirs[1] ?? "", camp: loup ? "meute" : "village" };
}
// Ce que lit la Liseuse de cendres chez chacun (les cartes SECRÈTES) : petite complication, l'allégeance ; grande, les deux cartes.
// nomDe(cle) : le nom d'une carte. -> { acteurId: { nom, camp } } ({} hors de la variante)
export function visagesPourLaLiseuse(etat, nomDe = c => c) {
  const mode = doubleVisage(etat);
  if (!mode) return {};
  const cartes = secretDe(etat).cartes;
  const sortie = {};
  for (const [id, f] of Object.entries(etat?.fiches ?? {})) {
    const camp = f?.camp === "meute" ? "meute" : "village";
    sortie[id] = mode === "grande" && cartes[id]?.length ? { nom: cartes[id].map(nomDe).join(" + "), camp }
      : { nom: nomDe(camp === "meute" ? CARTE_LOUP : CARTE_VILLAGEOIS), camp };
  }
  return sortie;
}
// La seconde carte d'un villageois à plat (aPlat : seconde), ou d'une fiche ; null sinon.
export const secondeDe = v => (v?.seconde?.cle ? v.seconde : null);
// Le villageois porte-t-il ce pouvoir, sur l'une ou l'autre de ses cartes ?
export const porteLEffet = (v, effet) => Boolean(effet) && (v?.role?.effet === effet || v?.seconde?.effet === effet);
// La carte (rôle à plat) qui porte cet effet : la principale, sinon la seconde ; null.
export const carteDeLEffet = (v, effet) => (v?.role?.effet === effet ? v.role : v?.seconde?.effet === effet ? v.seconde : null);

// ------------------------------------------------------------------ Les Vendanges
export const vendangesActives = etat => variantesDe(etat).vendanges;
export const LOUPS_DES_VENDANGES = 1;
// Les proies permises : un voisin vivant d'un loup vivant (jamais un loup).
export function proiesDesVendanges(etat, villageois = []) {
  const loups = villageois.filter(v => vivant(v) && v.camp === "meute");
  const meute = new Set(loups.map(v => v.id));
  const ids = new Set();
  for (const l of loups) {
    const { gauche, droite } = voisins(etat, villageois, l.id);
    for (const id of [gauche, droite]) if (id && !meute.has(id)) ids.add(id);
  }
  return [...ids];
}
// La garde du Garde du pont : lui-même ou l'un de ses deux voisins vivants.
export function gardeDesVendanges(etat, villageois = [], gardeId = "") {
  const { gauche, droite } = voisins(etat, villageois, gardeId);
  return [...new Set([gardeId, gauche, droite].filter(Boolean))];
}
// La Braconnière (morte) emporte l'un de ses deux voisins vivants.
export function voisinsDeLaBraconniere(etat, villageois = [], id = "") {
  const { gauche, droite } = voisins(etat, villageois, id);
  return [...new Set([gauche, droite].filter(x => x && x !== id))];
}
// La Liseuse : le joueur désigné et ses deux voisins (trioAutour), leurs rôles lus sans dire à qui est quoi.
export const trioDeLaLiseuse = (etat, villageois, cible) => trioAutour(etat, villageois, cible);
// La fiole unique de l'Herboriste : le sort décide, quatre issues équiprobables.
export const ISSUES_DE_LA_FIOLE = ["gueri", "villageois", "loup", "mort"];
export const issueDeLaFiole = (hasard = Math.random) => choisir(ISSUES_DE_LA_FIOLE, hasard);
// Le rôle d'un joueur aux Vendanges, ajusté à la distribution (données d'objet { name, img, system }) : l'Herboriste n'a qu'une fiole
// (une cible, un usage), le Joueur de vielle ne charme qu'un joueur à la fois. Les autres pouvoirs « éméchés » se règlent ailleurs.
export function roleDesVendanges(role) {
  const s = role?.system;
  if (!s) return role;
  if (s.effet === "remede") return { ...role, system: { ...s, usages: { max: 1, restant: 1 }, nuit: { ...(s.nuit ?? {}), cibles: 1 } } };
  if (s.effet === "charmer") return { ...role, system: { ...s, nuit: { ...(s.nuit ?? {}), cibles: 1 } } };
  return role;
}
// L'Entremetteuse, la première nuit, désigne ensuite l'un des deux amants et un autre joueur : un triangle. -> null si invalide.
// amants : [a, b] (le couple qu'elle a uni) ; cibles : les deux joueurs désignés.
export function triangleDesVendanges(amants = [], cibles = []) {
  const [a, b] = amants;
  if (!a || !b || a === b) return null;
  const [x, y] = [...new Set(cibles.filter(Boolean))];
  if (!x || !y) return null;
  const dansLeCouple = [x, y].filter(id => id === a || id === b);
  if (dansLeCouple.length !== 1) return null;
  const trompeur = dansLeCouple[0];
  const amant = trompeur === x ? y : x;
  return { trompeur, trompe: trompeur === a ? b : a, amant };
}
export const CLE_TROMPERIE = "tromperie";
export const triangleDe = etat => secretDe(etat).triangle;
// Qui meurt avec un mort, dans le triangle : le trompé n'entraîne personne ; le trompeur et l'amant entraînent les deux autres.
export function suiteDuTriangle(triangle, mortId) {
  if (!triangle) return [];
  const { trompeur, trompe, amant } = triangle;
  if (mortId === trompeur) return [amant, trompe];
  if (mortId === amant) return [trompeur, trompe];
  return [];
}
// Un vote interdit aux Vendanges : deux amants ne votent pas l'un contre l'autre (le trompé ne vote pas contre le trompeur), mais le
// trompeur peut voter contre le trompé. amoureux : acteurId -> son amoureux (fiches).
export function voteInterditParLAmour({ triangle = null, amoureux = {}, votant = "", cible = "" } = {}) {
  if (!votant || !cible || votant === cible) return false;
  if (triangle && votant === triangle.trompeur && cible === triangle.trompe) return false;
  if (triangle && votant === triangle.trompe && cible === triangle.trompeur) return true;
  if (triangle && [votant, cible].includes(triangle.trompeur) && [votant, cible].includes(triangle.amant)) return true;
  return amoureux[votant] === cible && amoureux[cible] === votant;
}
// Le Souffre-douleur des Vendanges : il meurt à la place d'un de ses deux voisins condamné par le vote (le premier). -> l'élu remplacé, "".
export function voisinDuBouc(etat, villageois = [], boucId = "", elus = []) {
  if (!boucId || elus.includes(boucId)) return "";
  const { gauche, droite } = voisins(etat, villageois, boucId);
  return elus.find(id => id && (id === gauche || id === droite)) ?? "";
}
// Le Bailli des Vendanges vote seul, avant les autres : tant qu'il n'a pas voté (et au plus jusqu'à « jusqua »), les autres attendent.
export const attendLeBailli = (vote, votant, maintenant = Date.now()) => Boolean(vote?.bailliDabord?.acteurId) && votant !== vote.bailliDabord.acteurId
  && !(vote.bailliDabord.acteurId in (vote.votes ?? {})) && maintenant < (Number(vote.bailliDabord.jusqua) || 0);

// ------------------------------------------------------------------ L'Envoûtement
export const envoutementActif = etat => variantesDe(etat).envoutement;
export const envoutesDe = etat => secretDe(etat).envoutes.map(e => e.acteurId);
// Les envoûtés de la nuit (état normalisé, modifié sur place).
export function envouter(etat, ids = [], tour = Number(etat?.tour) || 0) {
  const s = secretDe(etat);
  const deja = new Set(s.envoutes.map(e => e.acteurId));
  etat.variantesSecret = { ...s, envoutes: [...s.envoutes, ...liste(ids).filter(id => !deja.has(id)).map(acteurId => ({ acteurId, tour }))] };
  return etat;
}
// Un rôle envoûté (données d'objet) : il garde son nom et sa carte, il perd tout pouvoir (ni réveil, ni effet, ni usage).
export function roleEnvoute(role) {
  const s = role?.system;
  if (!s) return role;
  return { ...role, system: { ...s, effet: "", envoute: true, nuit: { ...(s.nuit ?? {}), actif: false }, usages: { max: 0, restant: 0 } } };
}
// Condamnée par le village, une envoûtée entraîne toutes celles d'avant elle. -> [acteurId]
export function envoutesPrecedents(etat, acteurId) {
  const ids = envoutesDe(etat);
  const i = ids.indexOf(acteurId);
  return i > 0 ? ids.slice(0, i) : [];
}
// La meute a gagné : elle a envoûté l'avant-dernier villageois (au plus un vivant hors de la meute qui ne soit pas envoûté).
export function meuteEnvoute({ villageois = [], envoutes = [] } = {}) {
  if (!envoutes.length) return false;
  const vivants = villageois.filter(vivant);
  const meute = vivants.filter(v => v.camp === "meute").length;
  return meute > 0 && vivants.filter(v => v.camp !== "meute" && !envoutes.includes(v.id)).length <= 1;
}

// ------------------------------------------------------------------ ce que la nuit, la résolution et la victoire en lisent
// L'ordre de la nuit (nuit.mjs) : le mur, le réveil de la tromperie (Vendanges, première nuit).
export const nuitDesVariantes = (etat, tour) => ({ mur: murActif(etat), tromperie: vendangesActives(etat) && tour === 1 });
// La victoire (victoire.mjs) : les envoûtés.
export const contexteDesVariantes = etat => ({ envoutes: envoutementActif(etat) ? envoutesDe(etat) : [] });
