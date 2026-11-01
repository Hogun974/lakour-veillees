// Le vote à minuteur se clôt de lui-même à zéro, chez le MJ actif (comme les votes du MJ IA) : le dépouillement, puis
// l'exécution que le MJ confirme (cloreLeVote). Un vote sans minuteur attend toujours que le MJ le close.
import { echeanceDuVote } from "../logique/votes.mjs";
import { lireEtat, t } from "./donnees.mjs";
import { estMJActif } from "./canal.mjs";

export const MARGE = 500;   // ms après zéro : les dernières voix envoyées arrivent
let prevue = null;          // { cle, minuterie }

// Appelée à chaque changement d'état : (re)programme la clôture du vote ouvert, ou l'annule.
export function surveillerFinDuVote(clore) {
  const e = estMJActif() ? echeanceDuVote(lireEtat().vote) : null;
  if (e?.cle === prevue?.cle) return;
  clearTimeout(prevue?.minuterie);
  prevue = e && {
    cle: e.cle,
    minuterie: setTimeout(() => {
      prevue = null;
      // Clos, rejoué ou prolongé entre-temps, ou un autre MJ a pris la main : rien.
      if (!estMJActif() || echeanceDuVote(lireEtat().vote)?.cle !== e.cle) return;
      ui.notifications.info(t("LAKOUR_LOUPS.Table.TempsEcoule"));
      return clore();
    }, e.dans + MARGE)
  };
}

export function oublierFinDuVote() {
  clearTimeout(prevue?.minuterie);
  prevue = null;
}
