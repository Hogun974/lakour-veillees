// Le cercle : l'ordre des places autour de la table, fixé à la distribution et rangé dans l'état PUBLIC (etat.cercle =
// [acteurId…]). Logique pure.
//
// Sur table, chacun a sa chaise : ses voisins de gauche et de droite ne changent pas de la partie, et plusieurs rôles du livre
// s'en servent (le Furet flaire un joueur et ses deux voisins, la Gardeuse d'oies grogne si un loup est à côté d'elle, le Vieux
// Sergent rouillé emporte le premier loup à sa gauche, la variante Double visage passe un rôle au voisin). En ligne, il n'y a
// pas de chaise : la place est donc celle de la maison (system.maison, numéros croissants — Maison 1, Maison 2…), départagée
// par l'identifiant du villageois pour rester stable d'un rechargement à l'autre ; un gens de passage arrivé en cours de partie
// (passage.mjs) s'assoit au bout du cercle, sans déplacer personne.
// « Gauche » : la place PRÉCÉDENTE dans le tableau ; « droite » : la suivante ; le cercle se referme (le premier a le dernier
// à sa gauche). Les morts (et les partis : vivant false) sont sautés quand on ne veut que les vivants, comme sur table, où l'on
// regarde le premier joueur encore en jeu de chaque côté.
// Le jour, la mise en scène en cercle sur la place (plateau.mjs, miseEnScene) suit cet ordre : chacun y retrouve ses voisins.
import { numeroDeMaison } from "./distribution.mjs";

export const cercleInitial = () => [];

// Un tableau d'identifiants sans doublon ni vide.
export function normaliserCercle(c) {
  if (!Array.isArray(c)) return [];
  return [...new Set(c.map(x => String(x ?? "")).filter(Boolean))];
}

// L'ordre des places d'après les maisons : numéros croissants (une maison sans numéro, « Taverne », après les numérotées),
// départage par l'identifiant. villageois : [{ id, maison }] -> [acteurId]
export function ordreDesPlaces(villageois = []) {
  const rang = v => numeroDeMaison(v.maison) || Number.MAX_SAFE_INTEGER;
  return [...villageois].sort((a, b) => rang(a) - rang(b) || String(a.id).localeCompare(String(b.id))).map(v => String(v.id));
}

// Le cercle fixé (à la distribution) : l'ordre des maisons des villageois en jeu. -> un nouvel état (l'ancien n'est pas touché)
export function fixerCercle(etat, villageois = []) {
  return { ...etat, cercle: ordreDesPlaces(villageois) };
}

// Un arrivant s'assoit au bout du cercle (rien s'il y est déjà). Modifie sur place l'état reçu (déjà normalisé) et le rend.
// Une partie sans cercle rangé (d'avant le cercle) le garde vide : cercleDe y range alors tout le monde par maisons, et
// l'arrivant, assis seul, passerait devant les autres.
export function ajouterAuCercle(etat, acteurId) {
  const cercle = normaliserCercle(etat.cercle);
  if (acteurId && cercle.length && !cercle.includes(String(acteurId))) cercle.push(String(acteurId));
  etat.cercle = cercle;
  return etat;
}

// Le cercle effectif : celui de l'état, réduit aux villageois connus, puis ceux qui n'y sont pas (une partie d'avant le cercle,
// un villageois ajouté à la main) au bout, dans l'ordre des maisons. -> [acteurId]
export function cercleDe(etat, villageois = []) {
  const connus = new Set(villageois.map(v => String(v.id)));
  const assis = normaliserCercle(etat?.cercle).filter(id => connus.has(id));
  const dedans = new Set(assis);
  return [...assis, ...ordreDesPlaces(villageois.filter(v => !dedans.has(String(v.id))))];
}

const estVivant = v => Boolean(v) && v.vivant !== false;

// Le premier à partir de acteurId dans un sens (pas : -1 = gauche, +1 = droite) qui satisfait garder ; "" si personne.
function premierDansLeSens(etat, villageois, acteurId, pas, garder) {
  const cercle = cercleDe(etat, villageois);
  const i = cercle.indexOf(String(acteurId));
  if (i < 0) return "";
  const parId = new Map(villageois.map(v => [String(v.id), v]));
  const n = cercle.length;
  for (let k = 1; k < n; k++) {
    const id = cercle[(((i + pas * k) % n) + n) % n];
    if (garder(parId.get(id))) return id;
  }
  return "";
}

// Les voisins d'une place : { gauche, droite } (acteurId, "" si personne). vivantsSeulement : les morts et les partis sont
// sautés (par défaut) ; sinon, les voisins de chaise. La place d'un mort a encore des voisins (on regarde de part et d'autre).
// À deux vivants, l'autre est à la fois à gauche et à droite.
export function voisins(etat, villageois = [], acteurId, { vivantsSeulement = true } = {}) {
  const garder = vivantsSeulement ? estVivant : v => Boolean(v);
  return {
    gauche: premierDansLeSens(etat, villageois, acteurId, -1, garder),
    droite: premierDansLeSens(etat, villageois, acteurId, +1, garder)
  };
}

// Le trio autour d'un vivant : [gauche, centre, droite], vivants, sans doublon (à deux vivants : deux noms) ; [] si le centre
// est mort ou hors du cercle. (Le Furet flaire ces trois-là.)
export function trioAutour(etat, villageois = [], centreId) {
  const centre = villageois.find(v => String(v.id) === String(centreId));
  if (!estVivant(centre) || !cercleDe(etat, villageois).includes(String(centreId))) return [];
  const { gauche, droite } = voisins(etat, villageois, centreId);
  return [...new Set([gauche, String(centreId), droite].filter(Boolean))];
}

// Le premier vivant à gauche de acteurId (lui exclu) qui satisfait filtre(villageois) ; "" si personne. (Le Vieux Sergent : le
// premier loup à sa gauche.)
export function premierAGauche(etat, villageois = [], acteurId, filtre = () => true) {
  return premierDansLeSens(etat, villageois, acteurId, -1, v => estVivant(v) && Boolean(filtre(v)));
}

// Le premier vivant à droite (la place suivante), de même. (L'Incendiaire de la variante « Le Village » : le premier loup à la
// droite de la proie dont la maison brûle est carbonisé.)
export function premierADroite(etat, villageois = [], acteurId, filtre = () => true) {
  return premierDansLeSens(etat, villageois, acteurId, +1, v => estVivant(v) && Boolean(filtre(v)));
}
