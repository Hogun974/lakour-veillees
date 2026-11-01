// Le plateau du village : où se tient chaque jeton à chaque phase, et quelle lumière. Logique pure (aucun appel à Foundry),
// jouée chez le MJ actif par scripts/plateau.mjs et éprouvée en Node (essais/loups-plateau.test.mjs).
//
// Coordonnées en CASES de la carte (une case = un jeton de 1 × 1) ; un point est le CENTRE d'un jeton.
// La carte fournit un plan (drapeau « plan » de la scène, docs/loups-contrat.md) : des pièces, dont la place du village, et
// des éléments nommés (« Maison 1 »… « Maison 18 », « Cimetière », « Gibet », « Puits »…). Un plan peut préciser le
// plateau (plan.plateau : seuils des maisons, cercle de la place, cimetière) ; à défaut, il est déduit des éléments.
//
// - nuit, aube, préparatifs : chacun devant sa maison (son seuil) ;
// - jour, vote, fin : les vivants en cercle sur la place, à intervalles réguliers, sans se chevaucher ni chevaucher le
//   Gibet ou le Puits ;
// - les morts : au cimetière, rangés dans l'ordre des morts ;
// - l'image : neutre tant que le rôle n'est pas révélé ; celle du rôle s'il l'est, et pour tous à la fin.
import { numeroDeMaison } from "./distribution.mjs";

// Obscurité de la scène selon la phase (0 = plein jour, 1 = nuit noire).
export const LUMIERE = { preparation: 0, nuit: 0.85, aube: 0.4, jour: 0, vote: 0.15, fin: 0.3 };
export const lumiereDePhase = phase => LUMIERE[phase] ?? LUMIERE.preparation;

// Phases où les vivants se tiennent en cercle sur la place.
export const PHASES_DU_CERCLE = ["jour", "vote", "fin"];

// Écart voulu entre deux voisins du cercle (centre à centre, en cases) : un jeton fait 1 case de large.
export const ECART_CERCLE = 1.45;
// Distance minimale entre deux centres de jetons (jetons ronds de 1 case : 1 = ils se touchent sans se chevaucher).
export const DISTANCE_MIN = 1;

const normaliser = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const rect = r => (r && [r.x, r.y, r.l, r.h].every(Number.isFinite) ? { x: r.x, y: r.y, l: r.l, h: r.h } : null);
const arrondi = n => Math.round(n * 1000) / 1000;

// Le plateau d'un plan : { largeur, hauteur, place, cercle, cimetiere, seuils: { maison: {x, y} }, obstacles: [rect],
// elements }. null si le plan n'a pas d'éléments.
export function lirePlateau(plan) {
  if (!plan || !Array.isArray(plan.elements) || !plan.elements.length) return null;
  const p = plan.plateau ?? {};
  const elements = plan.elements.map(e => ({ ...e }));
  const element = nom => elements.find(e => normaliser(e.nom) === normaliser(nom)) ?? null;
  const place = rect(p.place) ?? rect((plan.pieces ?? []).find(x => /\bplace\b/.test(normaliser(x.nom))));
  const cimetiere = rect(p.cimetiere) ?? rect(element("Cimetière"));
  // Seuils : ceux du plan, sinon une case sous chaque élément (devant la porte).
  const seuils = {};
  for (const e of elements) seuils[e.nom] = { x: e.x + e.l / 2, y: e.y + e.h + 0.5 };
  for (const [nom, s] of Object.entries(p.seuils ?? {})) if (Number.isFinite(s?.x) && Number.isFinite(s?.y)) seuils[nom] = { x: s.x, y: s.y };
  // Ce qui encombre la place (Gibet, Puits…) : le cercle l'évite.
  const obstacles = place ? elements.filter(e => e.x < place.x + place.l && place.x < e.x + e.l && e.y < place.y + place.h && place.y < e.y + e.h).map(rect) : [];
  let cercle = null;
  if (p.cercle && Number.isFinite(p.cercle.x) && Number.isFinite(p.cercle.y) && Number.isFinite(p.cercle.rayon)) {
    cercle = { x: p.cercle.x, y: p.cercle.y, rayon: p.cercle.rayon, rayonMin: Number.isFinite(p.cercle.rayonMin) ? p.cercle.rayonMin : p.cercle.rayon };
  } else if (place) {
    const rayon = Math.max(1, Math.min(place.l, place.h) / 2 - 1);
    cercle = { x: place.x + place.l / 2, y: place.y + place.h / 2, rayon, rayonMin: rayon };
  }
  return { largeur: plan.largeur, hauteur: plan.hauteur, place, cercle, cimetiere, seuils, obstacles, elements };
}

// La boîte d'un jeton de 1 × 1 centré en c.
const boite = c => ({ x: c.x - 0.5, y: c.y - 0.5, l: 1, h: 1 });
const chevauche = (a, b) => a.x < b.x + b.l - 1e-9 && b.x < a.x + a.l - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
const contient = (r, b) => b.x >= r.x - 1e-9 && b.y >= r.y - 1e-9 && b.x + b.l <= r.x + r.l + 1e-9 && b.y + b.h <= r.y + r.h + 1e-9;

// Les défauts d'une disposition : jeton hors de la place, sur un obstacle, ou trop près d'un autre.
export function defautsDuCercle(plateau, places) {
  const defauts = [];
  places.forEach((c, i) => {
    const b = boite(c);
    if (plateau.place && !contient(plateau.place, b)) defauts.push(`place ${i + 1} hors de la place`);
    for (const o of plateau.obstacles ?? []) if (chevauche(o, b)) defauts.push(`place ${i + 1} sur un obstacle`);
    for (let j = i + 1; j < places.length; j++) {
      if (Math.hypot(c.x - places[j].x, c.y - places[j].y) < DISTANCE_MIN - 1e-9) defauts.push(`places ${i + 1} et ${j + 1} se chevauchent`);
    }
  });
  return defauts;
}

function disposer(cercle, n, rayon, depart) {
  return Array.from({ length: n }, (_, i) => {
    const a = depart + (2 * Math.PI * i) / n;
    return { x: arrondi(cercle.x + rayon * Math.cos(a)), y: arrondi(cercle.y + rayon * Math.sin(a)) };
  });
}

// n places régulières en cercle sur la place, la première en haut, dans le sens des aiguilles d'une montre. Le rayon
// suit le nombre (ECART_CERCLE entre voisins) entre rayonMin et rayon ; si une disposition touche un obstacle, on la
// tourne un peu, puis on essaie d'autres rayons ; on garde la meilleure.
export function placesEnCercle(plateau, n) {
  const total = Math.max(0, Math.floor(Number(n) || 0));
  if (!total || !plateau?.cercle) return [];
  const c = plateau.cercle;
  if (total === 1) return [{ x: c.x, y: c.y - c.rayonMin }];
  const voulu = Math.min(c.rayon, Math.max(c.rayonMin, (total * ECART_CERCLE) / (2 * Math.PI)));
  const rayons = [voulu, ...[c.rayon, c.rayonMin, (c.rayon + c.rayonMin) / 2].filter(r => r !== voulu)];
  let meilleure = null;
  for (const r of rayons) {
    for (let k = 0; k < 24; k++) {
      // Rotations alternées autour du haut : 0, +δ, −δ, +2δ…
      const pas = ((Math.ceil(k / 2) * (k % 2 ? 1 : -1)) * (2 * Math.PI / total)) / 24;
      const places = disposer(c, total, r, -Math.PI / 2 + pas);
      const d = defautsDuCercle(plateau, places).length;
      if (!d) return places;
      if (!meilleure || d < meilleure.d) meilleure = { places, d };
    }
  }
  return meilleure.places;
}

// La place n° i (à partir de 0) au cimetière : en rangées, de gauche à droite et de haut en bas, assez espacées pour que
// les noms ne se recouvrent pas (1,5 case en largeur, 1,25 en hauteur) ; au-delà, on recommence par-dessus (décalé).
export const PAS_DU_CIMETIERE = { x: 1.5, y: 1.25 };
export function placeAuCimetiere(plateau, i) {
  const c = plateau?.cimetiere;
  if (!c) return null;
  const colonnes = Math.max(1, Math.floor((c.l - 1) / PAS_DU_CIMETIERE.x) + 1), rangees = Math.max(1, Math.floor((c.h - 1) / PAS_DU_CIMETIERE.y) + 1);
  const mx = (c.l - 1 - (colonnes - 1) * PAS_DU_CIMETIERE.x) / 2, my = (c.h - 1 - (rangees - 1) * PAS_DU_CIMETIERE.y) / 2;
  const k = Math.max(0, i) % (colonnes * rangees), tour = Math.floor(Math.max(0, i) / (colonnes * rangees));
  return { x: arrondi(c.x + 0.5 + mx + (k % colonnes) * PAS_DU_CIMETIERE.x + tour * 0.3), y: arrondi(c.y + 0.5 + my + Math.floor(k / colonnes) * PAS_DU_CIMETIERE.y + tour * 0.3) };
}

// Le seuil d'une maison (centre du jeton) ; null si la carte ne la connaît pas.
export function seuilDe(plateau, maison) {
  if (!plateau || !maison) return null;
  const s = plateau.seuils[maison] ?? Object.entries(plateau.seuils).find(([nom]) => normaliser(nom) === normaliser(maison))?.[1];
  return s ? { x: s.x, y: s.y } : null;
}

// L'ordre du cercle : par numéro de maison, puis par nom (chacun garde ses voisins d'un jour à l'autre).
export function ordreDuCercle(villageois = []) {
  return [...villageois].sort((a, b) => (numeroDeMaison(a.maison) || 99) - (numeroDeMaison(b.maison) || 99)
    || String(a.maison ?? "").localeCompare(String(b.maison ?? ""), "fr") || String(a.nom ?? "").localeCompare(String(b.nom ?? ""), "fr")
    || String(a.id).localeCompare(String(b.id)));
}

// Quelle image montre le jeton : "role" si son rôle est révélé (ou à la fin, pour tous), "neutre" sinon.
export const imageDuJeton = (v, phase) => (v?.revele || phase === "fin" ? "role" : "neutre");

// La mise en scène d'une phase. villageois : [{ id, nom, maison, vivant, revele, silence }] ; morts : etat.morts (ordre
// des morts). -> { phase, obscurite, jetons: [{ id, x, y, ou: "maison" | "cercle" | "cimetiere" | "reste", image, mort,
// silence }] }. Un villageois sans place connue (maison inconnue de la carte, carte sans cimetière) a ou: "reste" et
// x, y null : son jeton ne bouge pas.
export function miseEnScene({ plateau, phase = "preparation", villageois = [], morts = [] } = {}) {
  const jetons = [];
  const morts_ = villageois.filter(v => v.vivant === false);
  const rang = id => {
    const i = morts.findIndex(m => m.acteurId === id);
    return i < 0 ? morts.length + morts_.findIndex(v => v.id === id) : i;
  };
  const vivants = villageois.filter(v => v.vivant !== false);
  const cercle = PHASES_DU_CERCLE.includes(phase);
  const places = cercle ? placesEnCercle(plateau, vivants.length) : [];
  const rangDuCercle = new Map(ordreDuCercle(vivants).map((v, i) => [v.id, i]));
  // Deux villageois sur le même seuil (deux dormeurs d'une même maison) : le second se range à côté.
  const pris = new Map();
  const seuilLibre = v => {
    const s = seuilDe(plateau, v.maison);
    if (!s) return null;
    const cle = `${s.x}:${s.y}`;
    const n = pris.get(cle) ?? 0;
    pris.set(cle, n + 1);
    return { x: s.x + n, y: s.y };
  };
  for (const v of ordreDuCercle(villageois)) {
    let point = null, ou = "reste";
    if (v.vivant === false) {
      point = placeAuCimetiere(plateau, [...morts_].sort((a, b) => rang(a.id) - rang(b.id)).findIndex(x => x.id === v.id));
      if (point) ou = "cimetiere";
    } else if (cercle && places.length) {
      point = places[rangDuCercle.get(v.id)];
      ou = "cercle";
    } else {
      point = seuilLibre(v);
      if (point) ou = "maison";
    }
    jetons.push({ id: v.id, x: point?.x ?? null, y: point?.y ?? null, ou, image: imageDuJeton(v, phase), mort: v.vivant === false, silence: Boolean(v.silence) && v.vivant !== false });
  }
  return { phase, obscurite: lumiereDePhase(phase), jetons };
}

// Du centre d'un jeton (en cases) au coin haut-gauche en pixels de la scène. grille : { size, sceneX, sceneY }.
export function versPixels(point, grille, taille = 1) {
  const size = Number(grille?.size) || 100;
  return { x: Math.round((Number(grille?.sceneX) || 0) + (point.x - taille / 2) * size), y: Math.round((Number(grille?.sceneY) || 0) + (point.y - taille / 2) * size) };
}

// Du coin haut-gauche en pixels au centre en cases.
export function versCases(pixels, grille, taille = 1) {
  const size = Number(grille?.size) || 100;
  return { x: arrondi((pixels.x - (Number(grille?.sceneX) || 0)) / size + taille / 2), y: arrondi((pixels.y - (Number(grille?.sceneY) || 0)) / size + taille / 2) };
}

// Un joueur ne déplace ni ne retouche un jeton de villageois : position, verrou, image, transparence, taille, visibilité.
// Le MJ (le système, chez le MJ actif) le peut toujours ; les autres jetons (figurants) ne sont pas concernés.
export const CHAMPS_DU_JETON_VERROUILLES = ["x", "y", "elevation", "rotation", "locked", "texture", "alpha", "hidden", "width", "height", "level", "shape", "_movementHistory"];
export function modificationPermise({ mj = false, villageois = false, changements = {} } = {}) {
  if (mj || !villageois) return true;
  return !Object.keys(changements ?? {}).some(k => CHAMPS_DU_JETON_VERROUILLES.includes(k.split(".")[0]));
}
