// Les ÉVÉNEMENTS : ce qui change la règle pour un temps (un jour, une nuit, plusieurs, ou jusqu'à la fin). Logique pure.
//
// L'Almanach des brumes (almanach.mjs) ne tire qu'un présage à la fois, et chaque effet y est lu à sa place (vote, nuit, Registre…).
// La Gazette de la lune (les 36 cartes de nouvelle lune du livre, plus tard) et le Crieur public en demandent davantage : plusieurs
// événements à la fois, des effets IMMÉDIATS, DIFFÉRÉS (qui tombent quelques tours plus tard) ou PERMANENTS. D'où ce registre,
// PUBLIC comme les présages (un événement s'annonce à tout le village) :
//
//   etat.evenements = [{ cle, tire, debut, fin, type, quand }]
//     cle   : l'événement (clé de sa définition) ;
//     tire  : le tour où il a été tiré ;
//     type  : "immediat" (il vaut tout de suite) | "differe" (il tombe `delai` tours plus tard) | "permanent" (jusqu'à la fin) ;
//     quand : "jour" (il touche le jour : aube, débat, vote) | "nuit" (il touche la nuit) ;
//     debut : le premier tour où il vaut (n° du jour, ou de la nuit) ; fin : le dernier (0 : jamais de fin, un permanent).
//
// Une définition : { type, quand, delai, duree } (delai : tours d'attente d'un différé, 0 sinon ; duree : tours où il vaut,
// 1 par défaut ; ignorée pour un permanent). Le premier tour possible : le jour même si l'on tire le jour ou la nuit (le tour n
// compte la nuit n puis le jour n) ; pour la nuit, la nuit qui vient si l'on tire de jour, la nuit même si l'on tire la nuit.
//
// L'Almanach continue de vivre dans etat.presage, à l'identique ; ses présages passent par les mêmes lecteurs : le présage en
// cours y est vu comme un événement immédiat (un présage de jour vaut le jour de son tirage, un présage de nuit, givre ou crue,
// la nuit qui suit) — evenementActif(etat, "givre", n, "nuit") dit exactement ce que dit presageDeLaNuit(etat, n).
import { PRESAGES, normaliserPresage } from "./almanach.mjs";

export const TYPES_D_EVENEMENT = ["immediat", "differe", "permanent"];
export const MOMENTS_D_EVENEMENT = ["jour", "nuit"];
// Les phases du jour (un événement « jour » y vaut) ; la nuit : la phase "nuit". Ni les préparatifs ni la fin.
export const PHASES_DU_JOUR_EVENEMENT = ["aube", "jour", "vote"];
// Au-delà, les plus vieux événements finis sont oubliés (l'état public reste petit).
export const TAILLE_DES_EVENEMENTS = 100;

export const evenementsInitiaux = () => [];

const entier = (x, min = 0) => Math.max(min, Math.floor(Number(x) || 0));

// Une définition complète : { type, quand, delai, duree }.
export function normaliserDefinition(d) {
  const x = d && typeof d === "object" ? d : {};
  const type = TYPES_D_EVENEMENT.includes(x.type) ? x.type : "immediat";
  return {
    type, quand: MOMENTS_D_EVENEMENT.includes(x.quand) ? x.quand : "jour",
    delai: type === "differe" ? entier(x.delai ?? 1, 1) : 0,
    duree: type === "permanent" ? 0 : entier(x.duree ?? 1, 1)
  };
}

// Un événement rangé ; null s'il est illisible.
export function normaliserEvenement(x) {
  if (!x || typeof x !== "object" || !x.cle) return null;
  const type = TYPES_D_EVENEMENT.includes(x.type) ? x.type : "immediat";
  const debut = entier(x.debut);
  return {
    cle: String(x.cle), tire: entier(x.tire), debut, fin: type === "permanent" ? 0 : Math.max(debut, entier(x.fin)), type,
    quand: MOMENTS_D_EVENEMENT.includes(x.quand) ? x.quand : "jour", ...(x.source ? { source: String(x.source) } : {})
  };
}

export function normaliserEvenements(liste) {
  return Array.isArray(liste) ? liste.map(normaliserEvenement).filter(Boolean) : [];
}

// Le moment d'une phase : "jour", "nuit", ou "" (préparatifs, fin : aucun événement n'y vaut).
export const momentDeLaPhase = phase => (phase === "nuit" ? "nuit" : PHASES_DU_JOUR_EVENEMENT.includes(phase) ? "jour" : "");

// L'événement d'une définition, tiré au tour `tour`, pendant la phase `phase`. -> { cle, tire, debut, fin, type, quand }
export function creerEvenement(cle, definition, { tour = 0, phase = "aube", source = "" } = {}) {
  const d = normaliserDefinition(definition);
  const premier = d.quand === "nuit" && phase !== "nuit" ? tour + 1 : tour;
  const debut = premier + d.delai;
  return normaliserEvenement({ cle, tire: tour, debut, fin: d.type === "permanent" ? 0 : debut + d.duree - 1, type: d.type, quand: d.quand, source });
}

// Un événement tiré, rangé dans l'état (nouvel état ; l'ancien n'est pas touché). tour, phase : ceux de l'état par défaut.
export function tirerEvenement(etat, { cle, definition, tour = etat?.tour ?? 0, phase = etat?.phase ?? "aube", source = "" } = {}) {
  const ev = creerEvenement(cle, definition, { tour, phase, source });
  let liste = [...normaliserEvenements(etat?.evenements), ev];
  // Trop d'événements : les plus vieux qui sont finis s'en vont d'abord.
  while (liste.length > TAILLE_DES_EVENEMENTS) {
    const i = liste.findIndex(x => x.fin && x.fin < tour);
    liste.splice(i < 0 ? 0 : i, 1);
  }
  return { ...etat, evenements: liste };
}

// Un événement retiré (toutes ses occurrences) : une carte annulée, un effet levé par le narrateur. -> un nouvel état
export const retirerEvenement = (etat, cle) => ({ ...etat, evenements: normaliserEvenements(etat?.evenements).filter(x => x.cle !== cle) });

// Les événements finis avant ce tour, oubliés. -> un nouvel état
export const purgerEvenements = (etat, tour = etat?.tour ?? 0) => ({ ...etat,
  evenements: normaliserEvenements(etat?.evenements).filter(x => !x.fin || x.fin >= tour) });

// La définition d'un présage de l'Almanach : un événement immédiat, du jour ou de la nuit qui suit.
export const definitionDuPresage = cle => (PRESAGES[cle] ? { type: "immediat", quand: PRESAGES[cle].quand, duree: 1 } : null);

// Le présage en cours de l'Almanach, vu comme un événement (tiré à l'aube de son tour) ; null sans Almanach ni présage.
export function evenementDuPresage(etat) {
  const p = normaliserPresage(etat?.presage);
  if (!p.actif || !p.cle) return null;
  return creerEvenement(p.cle, definitionDuPresage(p.cle), { tour: p.tour, phase: "aube", source: "almanach" });
}

// Tous les événements connus de l'état : ceux du registre, puis le présage de l'Almanach.
export function tousLesEvenements(etat) {
  const presage = evenementDuPresage(etat);
  return [...normaliserEvenements(etat?.evenements), ...(presage ? [presage] : [])];
}

// L'événement vaut-il à ce tour et à cette phase ? (phase : celle de l'état par défaut ; tour : idem)
// (Un événement a toujours un moment, « jour » ou « nuit » : les préparatifs et la fin, sans moment, n'en voient aucun.)
export function evenementVaut(ev, tour, phase) {
  return Boolean(ev) && ev.quand === momentDeLaPhase(phase) && tour >= ev.debut && (!ev.fin || tour <= ev.fin);
}

// L'événement `cle` est-il actif au tour `tour` pendant la phase `phase` ? Le lecteur de toutes les règles d'événement.
export function evenementActif(etat, cle, tour = etat?.tour ?? 0, phase = etat?.phase ?? "") {
  return tousLesEvenements(etat).some(ev => ev.cle === cle && evenementVaut(ev, tour, phase));
}

// Les clés des événements actifs à ce tour et à cette phase (sans doublon, dans l'ordre du tirage).
export function evenementsActifs(etat, tour = etat?.tour ?? 0, phase = etat?.phase ?? "") {
  return [...new Set(tousLesEvenements(etat).filter(ev => evenementVaut(ev, tour, phase)).map(ev => ev.cle))];
}

// Les événements qui restent à venir ou en cours (pas finis) à ce tour : pour la Table et le narrateur.
export const evenementsEnCours = (etat, tour = etat?.tour ?? 0) => tousLesEvenements(etat).filter(ev => !ev.fin || ev.fin >= tour);
