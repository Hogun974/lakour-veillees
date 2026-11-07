// Caméras des joueurs aux Veillées (vidéo intégrée de Foundry, A/V) : quand la caméra d'un joueur est REMPLACÉE par une image
// (un loup-garou). Logique pure ; la liaison est dans scripts/cameras.mjs, qui pose cette règle dans le moteur commun
// (lakour-mj-ia, api.cameras.regle : son navigateur éteint sa piste vidéo, tous les navigateurs montrent l'image). Voir
// docs/loups-contrat.md §1 « Caméras » et lakour-mj-ia/docs/voix-et-ecoute.md §4.
//
// | Qui                                  | Préparatifs, fin | Nuit         | Aube, jour, vote                                   |
// |--------------------------------------|------------------|--------------|----------------------------------------------------|
// | un vivant                            | sa caméra        | remplacée    | sa caméra ; remplacée s'il est absent (Gazette) ou réduit au silence (jour, vote) |
// | un mort (ou parti)                   | sa caméra        | remplacée    | remplacée                                          |
// | un spectateur (sans villageois)      | sa caméra        | remplacée    | remplacée                                          |
// | un MJ                                | jamais remplacée                                                                     |
//
// - Seulement ce que TOUS les navigateurs savent : la phase et les absents du jour (état public, etat.gazette), qui est vivant et qui
//   est réduit au silence (documents des villageois), à qui est chaque villageois. Jamais un camp, un rôle, une fratrie, une ligne
//   des salons : chaque navigateur calcule donc la même chose pour chacun, et rien ne trahit qui se réveille la nuit (TOUS les
//   vivants y sont remplacés, loups compris, avec la même raison « nuit »).
// - Remplacée chaque fois que le jeu coupe le micro (salons.mjs : nuit, mort, spectateur, réduit au silence pendant le jour et le
//   vote), et aussi pour les absents du jour de la Gazette (Petit Commis, danseurs, cueilleuses, chasseurs, vétérans : partis).
//   Un loup qui parle à la tanière, un frère qui parle à sa fratrie : remplacés comme les autres (yeux fermés).
import { PHASES_LIBRES, PHASES_DE_NUIT, PHASES_DU_JOUR_MUET } from "./salons.mjs";
import { absentsDuJour } from "./gazette.mjs";

export const RAISONS_DE_CAMERA = ["nuit", "mort", "spectateur", "absent", "silence"];
// L'image, dans le module de contenu (lakour-veillees, ou lakour-veillees-en) ; le repli, dessiné à la main, à côté.
export const IMAGE_DE_CAMERA = "assets/camera/loup-garou.webp";
export const REPLI_DE_CAMERA = "assets/camera/loup-garou.svg";

const garder = { remplacee: false, raison: "" };
const remplacer = raison => ({ remplacee: true, raison });

// La caméra d'un utilisateur. etatPublic : l'état public de la partie (phase, tour, gazette) ; villageois : [{ id, joueur, vivant,
// silence }] (tout autre champ est ignoré) ; mj : un MJ n'est jamais remplacé ; actif : le réglage « cameraRemplacee ».
// -> { remplacee, raison } (raison : une de RAISONS_DE_CAMERA, ou "").
export function cameraDe(etatPublic, { userId = "", mj = false, villageois = [], actif = true } = {}) {
  if (!actif || mj || !userId) return { ...garder };
  const phase = String(etatPublic?.phase ?? "");
  if (!phase || PHASES_LIBRES.includes(phase)) return { ...garder };
  const v = (villageois ?? []).find(x => x?.joueur === userId);
  if (!v) return remplacer("spectateur");
  if (v.vivant === false) return remplacer("mort");
  if (PHASES_DE_NUIT.includes(phase)) return remplacer("nuit");
  if (absentsDuJour(etatPublic, Number(etatPublic?.tour) || 0).includes(v.id)) return remplacer("absent");
  if (v.silence && PHASES_DU_JOUR_MUET.includes(phase)) return remplacer("silence");
  return { ...garder };
}

// L'image et son repli : le réglage « imageCamera » s'il est rempli, sinon celle du module de contenu actif.
export function imagesDeCamera(reglage = "", moduleDeContenu = "lakour-veillees") {
  const module = /^[a-z0-9-]+$/.test(String(moduleDeContenu ?? "")) ? moduleDeContenu : "lakour-veillees";
  const repli = `modules/${module}/${REPLI_DE_CAMERA}`;
  const choisie = typeof reglage === "string" ? reglage.trim() : "";
  return { image: choisie || `modules/${module}/${IMAGE_DE_CAMERA}`, repli };
}
