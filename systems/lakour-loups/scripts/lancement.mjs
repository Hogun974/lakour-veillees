// Au lancement du monde, la veillée repart de zéro (réglage « repartirAZero », activé par défaut) : un loup-garou ne se
// reprend pas d'une soirée à l'autre. Chez le MJ actif, une fois par lancement : Foundry note la date du lancement dans
// game.world.lastPlayed ; un simple rechargement de la page (F5) ne la change pas, et la partie en cours reste.
import { ID } from "../logique/constantes.mjs";
import { estMJActif } from "./canal.mjs";

// -> true si le village a été remis à zéro.
export async function repartirAuLancement(api) {
  if (!estMJActif() || !game.settings.get(ID, "repartirAZero")) return false;
  const lancement = game.world?.lastPlayed ?? "";
  const traite = game.settings.get(ID, "lancementTraite");
  if (!lancement || traite === lancement) return false;
  await game.settings.set(ID, "lancementTraite", lancement);
  // Première fois que ce code tourne (mise à jour en cours de séance) : on note le lancement en cours sans rien effacer ;
  // c'est au prochain lancement du monde que la veillée repartira de zéro.
  if (!traite) return false;
  await api.remettreAZero();
  ui.notifications?.info(game.i18n.localize("LAKOUR_LOUPS.Reglages.RepartirAZero.Fait"));
  return true;
}
