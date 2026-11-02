// Les Saints du calendrier : deux réglages du narrateur, posés à la Table du MJ. Logique pure.
//
// - LA BONNE ÉTOILE (secret) : le narrateur protège en secret un joueur débutant la PREMIÈRE nuit (comme une protection de
//   Garde, arrêtée par le givre de l'Almanach, qui ne tombe jamais la première nuit). etat.bonneEtoile : acteurId, dans les
//   secrets du MJ ; personne n'en est prévenu, pas même le protégé.
// - LE GLAS FINAL (public, annoncé) : etat.glas = N (0 : jamais). La partie s'arrête au jour N, après son vote d'exécution
//   (ou dès qu'un tour suivant commence, si ce vote n'a pas eu lieu) : verifierVictoire({ glas: true }) — la meute si un loup
//   vit encore, sinon le tueur solitaire qui vit encore, sinon le village ; dans une peste noire, la peste.
import { voteExecutionDuJour } from "./bailli.mjs";

export const normaliserGlas = n => Math.max(0, Math.floor(Number(n) || 0));

// Le glas a-t-il sonné ? (le jour N est fini : son vote d'exécution a eu lieu, ou un tour plus tard a commencé)
export function glasSonne(etat) {
  const n = normaliserGlas(etat?.glas);
  if (!n || etat?.phase === "fin" || etat?.vainqueur) return false;
  return etat.tour > n || (etat.tour === n && voteExecutionDuJour(etat));
}

// La Bonne étoile vaut-elle cette nuit ? -> [acteurId] (la première nuit seulement).
export const etoilesDeLaNuit = (etat, nuit) => (nuit === 1 && etat?.bonneEtoile ? [etat.bonneEtoile] : []);
