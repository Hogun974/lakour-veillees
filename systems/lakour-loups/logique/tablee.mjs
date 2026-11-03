// La « Petite tablée » (0.11.0) : une veillée pour peu d'humains (1 à 4 joueurs) et des compagnons IA qui complètent (2 à 8), de
// 4 à 12 places. Logique pure ; branchée par scripts/api.mjs (distribuer, nouvellePartie, cloreVote, trancher) et par le
// générateur (composition.mjs, niveau « petite-tablee »).
//
// Les règles du mode sont PUBLIQUES (le guide du joueur les donne) ; ce qu'elles contraignent, c'est le tirage, jamais ce qui
// s'annonce : la composition reste secrète, et rien de qui tient quoi ne sort du tirage.
// 1. La meute est courte : 1 loup jusqu'à 7 places, 2 de 8 à 10, 3 à 11 et 12 (nombreDeLoupsTablee). Dès 6 places, au moins
//    deux rôles de l'OMBRE (loups et solitaires) sont en jeu (ombresTablee).
// 2. Le partage des camps (contraintesTablee, reglesTablee) : garanti — les humains ne sont jamais tous loups (2 humains et plus),
//    ni tous du même camp (3 et plus) ; favorisé, tiré en secret — l'ombre des deux côtés de la table (3 humains et plus) et une
//    lanterne chez un humain du Village. Jamais une déduction certaine (voir reglesTablee).
// 3. Le rythme : le Glas final est posé d'office (glasTablee : au plus 3 jours jusqu'à 6 places, puis un jour de plus par deux
//    places) et, au vote d'exécution, une égalité en tête que le Bailli ne tranche pas est tranchée par le sort (sortTranche).
//    Le RÉGIME DES DEUX LOUPS (deuxLoupsTablee : 8 places et plus) : la première nuit est BLANCHE, la meute se reconnaît mais ne
//    chasse pas (jour.mjs, candidatsDeNuit), et la meute doit être PLUS nombreuse que les autres vivants pour l'emporter
//    (victoire.mjs, strict : à égalité, la veillée continue, le village a encore un vote). À un seul loup, la règle ordinaire :
//    mesuré sur les parties simulées (essais/integration-loups.test.mjs), c'est ce qui ramène chaque taille dans la fourchette.
// 4. Les compagnons IA parlent d'abord aux humains (lakour-mj-ia, compagnons.js : un biais de parole, jamais de vote).
import { creerHasard, melanger } from "./hasard.mjs";

export const NIVEAU_PETITE_TABLEE = "petite-tablee";
export const TABLEE = { placesMin: 4, placesMax: 12, humainsMin: 1, humainsMax: 4, compagnonsMin: 2, compagnonsMax: 8 };

// Loups d'une petite tablée de n places.
export const nombreDeLoupsTablee = n => (n <= 7 ? 1 : n <= 10 ? 2 : 3);
// Rôles de l'ombre (loups + solitaires) voulus : dès 6 places, au moins deux ; à 11 et 12, quatre (trois loups et le Colporteur).
export const ombresTablee = n => (n >= 11 ? 4 : n >= 6 ? Math.max(2, nombreDeLoupsTablee(n)) : nombreDeLoupsTablee(n));
// Le régime des deux loups (8 places et plus) : nuit blanche la première nuit, et la meute doit être plus nombreuse pour gagner.
export const deuxLoupsTablee = places => nombreDeLoupsTablee(places) >= 2;
export const nuitBlancheTablee = deuxLoupsTablee;
export const pariteStricteTablee = deuxLoupsTablee;
// Le Glas final posé d'office (jour N) : la veillée ne traîne pas.
export const glasTablee = n => Math.max(3, Math.ceil((Number(n) || 0) / 2));

export const estOmbre = camp => camp === "meute" || camp === "solitaire";

// La tablée est-elle dans les clous du mode ? -> { ok, raison: "" | "humains" | "compagnons" | "places" } (un avis, pas un refus :
// le tirage contraint vaut pour toute table, mais le mode est pensé pour 1 à 4 humains et 2 à 8 compagnons).
export function verifierTablee({ humains = 0, compagnons = 0 } = {}) {
  const n = humains + compagnons;
  if (n < TABLEE.placesMin || n > TABLEE.placesMax) return { ok: false, raison: "places" };
  if (humains < TABLEE.humainsMin || humains > TABLEE.humainsMax) return { ok: false, raison: "humains" };
  if (compagnons < TABLEE.compagnonsMin || compagnons > TABLEE.compagnonsMax) return { ok: false, raison: "compagnons" };
  return { ok: true, raison: "" };
}

// Les règles du partage. Deux sont GARANTIES (publiques, et sans déduction certaine au-delà de ce que la règle dit) :
// - « humains jamais tous loups » (2 humains et plus) ;
// - « humains jamais tous du même camp » (3 humains et plus).
// Deux sont FAVORISÉES, pas garanties : tirées en secret à chaque distribution (reglesTablee), sinon une déduction deviendrait
// certaine (à deux humains, « l'ombre des deux côtés » dirait au villageois que son ami est de l'ombre ; « la lanterne chez un
// humain » dirait à l'ombre qui tient la lanterne) :
// - « l'ombre des deux côtés de la table » (3 humains et plus, CHANCE_OMBRE) : un rôle de l'ombre chez les humains ET chez les
//   compagnons, quand il y en a deux ;
// - « une lanterne chez un humain du Village » (CHANCE_LANTERNE) : un rôle d'information chez un humain du Village, s'il y en a.
// Mesuré (scratchpad relecture14/deduction.mjs) : aucune déduction « si je suis X, l'autre humain est Y » n'atteint 100 %, et
// chacune reste à moins de 15 points du tirage libre.
export const CHANCE_OMBRE = 0.5;
export const CHANCE_LANTERNE = 0.5;
export function reglesTablee({ humains = 0, hasard = Math.random } = {}) {
  const ombre = humains >= 3 && hasard() < CHANCE_OMBRE;
  const lanterne = humains >= 1 && hasard() < CHANCE_LANTERNE;
  return { ombre, lanterne };
}
export const REGLES_GARANTIES = { ombre: false, lanterne: false };

// Les contraintes du partage, vérifiées sur une attribution : places = [{ humain: Boolean, role: { camp, information } | null }]
// (un rôle null est un simple villageois) ; regles : { ombre, lanterne } (les règles favorisées à appliquer ; par défaut, les
// seules garanties). -> [] si tout va bien, sinon la liste des règles violées.
export function contraintesTablee(places, regles = REGLES_GARANTIES) {
  const camp = p => p.role?.camp ?? "village";
  const humains = places.filter(p => p.humain), compagnons = places.filter(p => !p.humain);
  const ombres = places.filter(p => estOmbre(camp(p))).length;
  const infos = places.filter(p => p.role?.information).length;
  const manques = [];
  if (humains.length >= 2 && humains.every(p => camp(p) === "meute")) manques.push("humains-tous-loups");
  if (humains.length >= 3 && (humains.every(p => camp(p) === "village") || humains.every(p => estOmbre(camp(p))))) manques.push("humains-meme-camp");
  if (regles?.ombre && humains.length >= 3 && ombres >= 2 && compagnons.length) {
    if (!humains.some(p => estOmbre(camp(p)))) manques.push("ombre-sans-humain");
    if (!compagnons.some(p => estOmbre(camp(p)))) manques.push("ombre-sans-compagnon");
  }
  const humainsDuVillage = humains.filter(p => camp(p) === "village");
  if (regles?.lanterne && infos && humainsDuVillage.length && !humainsDuVillage.some(p => p.role?.information)) manques.push("lanterne-sans-humain");
  return manques;
}

// Le tirage contraint : comme distribution.mjs/distribuer (rôles, métiers et maisons mélangés), mais les règles favorisées sont
// tirées en secret (reglesTablee), puis les rôles sont rebattus jusqu'à satisfaire contraintesTablee (au plus `essais` fois ; à
// défaut, le tirage qui en viole le moins). roles : [clé ou uuid], decrire(role) -> { camp, information } ; humains : Set des
// joueurs humains (les autres sont des compagnons).
// -> { tirage: [{ joueur, role, metier, maison }], regles: { ombre, lanterne }, manques: [règles encore violées], essais: n }
export function distribuerTablee({ roles = [], metiers = [], joueurs = [], maisons = [], humains = new Set(), decrire = () => null, graine, hasard, essais = 400 } = {}) {
  const h = hasard ?? creerHasard(graine);
  const m = melanger(metiers, h);
  const s = melanger(maisons, h);
  const regles = reglesTablee({ humains: joueurs.filter(j => humains.has(j)).length, hasard: h });
  let meilleur = null;
  let n = 0;
  for (; n < Math.max(1, essais); n++) {
    const r = melanger(roles, h);
    const places = joueurs.map((joueur, i) => ({ humain: humains.has(joueur), role: r[i] ? decrire(r[i]) : null }));
    const manques = contraintesTablee(places, regles);
    if (!meilleur || manques.length < meilleur.manques.length) meilleur = { r, manques };
    if (!manques.length) break;
  }
  const tirage = joueurs.map((joueur, i) => ({ joueur, role: meilleur.r[i] ?? null, metier: m[i] ?? null, maison: s[i] ?? "" }));
  return { tirage, regles, manques: meilleur.manques, essais: Math.min(n + 1, essais) };
}

// Le sort tranche une égalité (vote d'exécution, petite tablée) : parmi les ex æquo `candidats` (vivants), autant que de
// `places`. -> [acteurId] (l'ordre du tirage).
export function sortTranche({ candidats = [], places = 1, hasard = Math.random } = {}) {
  return melanger([...new Set(candidats)], hasard).slice(0, Math.max(0, places));
}
