// L'activité d'un joueur que Foundry diffuse à tous (User#broadcastActivity) : ce qu'on en retire quand elle trahirait un rôle
// secret. Logique pure ; le branchement, et ce qui a été lu dans le client et le serveur v14, sont dans scripts/activite.mjs.
import { PHASES_DE_NUIT } from "./salons.mjs";

// Le curseur, le ping, la règle, les cibles, les déplacements prévus, et la voix (« av » : le voyant « parle », le micro coupé,
// la caméra cachée).
export const CLES_ACTIVITE_MASQUEES = ["cursor", "ping", "ruler", "targets", "plannedMovements", "av"];

// -> l'activité qui peut partir (une copie, sans ce qui est masqué), ou null s'il ne reste rien : le serveur relaie même un
// message vide (avec l'heure de l'activité), qui dirait encore « il bouge ».
export function filtrerActivite(activite = {}) {
  const reste = {};
  for (const [cle, valeur] of Object.entries(activite ?? {})) if (!CLES_ACTIVITE_MASQUEES.includes(cle)) reste[cle] = valeur;
  return Object.keys(reste).length ? reste : null;
}

// L'activité de ce navigateur est-elle masquée ? Jamais celle d'un MJ ; celle de chaque joueur la nuit (phases : celle de l'état
// public et celle de sa ligne des salons, l'une peut arriver avant l'autre).
// Relecture adverse : un choix secret ne masque RIEN de plus. La nuit, l'activité de tous est déjà masquée ; le jour (la Chambrière
// après le vote, la voix du deuil des loups pendant le vote, le signe du Greffier bègue, la Conteuse, la séance de Spiritisme…),
// masquer le seul joueur qui choisit le désignerait à tous (son curseur qui s'efface, son voyant « parle » qui s'éteint) : le jour, on
// masque tout le monde ou personne — personne. (choixSecret reste accepté, sans effet.)
export function activiteMasquee({ mj = false, phases = [] } = {}) {
  if (mj) return false;
  return phases.some(p => PHASES_DE_NUIT.includes(p));
}

// Au début du masquage : efface chez les autres ce qu'ils voyaient encore (curseur, règle, déplacements prévus, voyant « parle »).
// av : l'état A/V public de ce joueur (micro coupé, caméra cachée), qui reste tel quel.
export function activiteEffacee(av = {}) {
  return { cursor: null, ruler: null, plannedMovements: null, av: { ...av, speaking: false } };
}
