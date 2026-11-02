// Les Masques de veillée : ce que la meute peut prétendre être sans risque. Logique pure.
//
// À la distribution d'une partie AVEC meute (jamais une peste noire, qui n'a pas de loup ; réglage monde « masques », vrai par
// défaut), la meute reçoit, en secret, NOMBRE_DE_MASQUES rôles du camp du Village ABSENTS de la partie : aucun villageois ne les
// tient, personne ne pourra donc la contredire en se réclamant du même rôle. Les mêmes pour toute la meute, remis au carnet
// secret de chaque loup (et d'un villageois qui la rejoint en cours de partie). Ils sont rangés dans les secrets du MJ
// (etat.masques) : jamais dans l'état public, ni dans un hook, ni dans un message qui ne va pas à un loup.
// Le simple « villageois » n'est pas un masque (se dire sans pouvoir ne demande pas d'alibi), ni le Somnambule (personne ne
// se sait somnambule), ni la Rosière ou un autre rôle « sur demande » (roles[].surDemande : une meute qui se dit Rosière
// n'a rien à craindre du vote, et le village le sentirait). Moins de rôles absents que de masques voulus : la meute en reçoit moins (aucun : rien n'est remis).
import { creerHasard, melanger } from "./hasard.mjs";
import { CLE_SOMNAMBULE, CLE_ROSIERE } from "./somnambule.mjs";

export const MASQUES_MIN = 2;
export const MASQUES_MAX = 3;
// Un loup seul : deux masques ; une meute : trois (plus de bouches à couvrir).
export const nombreDeMasques = loups => (loups >= 2 ? MASQUES_MAX : MASQUES_MIN);

// roles : [{ cle, camp }] (tout le contenu disponible) ; enJeu : [cle] des rôles distribués ; loups : taille de la meute.
// -> [cle] ; graine (ou hasard) : reproductible.
export function choisirMasques({ roles = [], enJeu = [], loups = 0, graine, hasard } = {}) {
  if (!(loups > 0)) return [];
  const absents = [...new Map(roles.filter(r => r?.cle && r.camp === "village" && r.cle !== "villageois" && r.cle !== CLE_SOMNAMBULE && r.cle !== CLE_ROSIERE && !r.surDemande && !enJeu.includes(r.cle))
    .map(r => [r.cle, r])).keys()].sort();
  const h = hasard ?? creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `masques|${graine}`);
  return melanger(absents, h).slice(0, nombreDeMasques(loups));
}
