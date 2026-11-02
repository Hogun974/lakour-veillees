// Le Glas du deuil (variante). Logique pure.
//
// Réglage monde « glasDuDeuil » (faux par défaut), recopié à la distribution. Chaque INNOCENT (un exécuté qui n'était pas du camp
// de la meute à sa mort) exécuté par le vote fait sonner le glas du deuil, et la meute y gagne un pouvoir collectif :
//   1er glas : une VISION — à la nuit qui suit, la meute (à la majorité des loups libres) désigne un joueur et chaque loup apprend
//              son camp (tel que le voient les visions) ; une fois ;
//   2e glas  : une VOIX DU DEUIL — à chaque vote d'exécution, une voix de plus va au candidat que la meute a désigné EN SECRET
//              (une demande de meute à l'ouverture du vote, comme la vision ; sans réponse : un candidat au hasard). Jamais tirée
//              des bulletins (publics au dépouillement) : rien n'y relie la voix aux votes des loups ; jusqu'à la fin ;
//   3e glas  : le LINCEUL — à la nuit qui suit, aucune protection ne tient contre la meute (ni garde, ni remède, ni verrou, ni
//              asile, ni Taverne) ; une fois. Au-delà, le glas sonne encore, sans rien de plus.
// Public : etat.deuil = { actif, compte } — le glas s'annonce au village de façon vague (« le glas sonne pour la 2e fois »), sans
// dire ce qu'il donne : il dit seulement qu'un innocent a été exécuté (règle voulue de la variante). SECRET (le MJ) :
// etat.pouvoirsDeuil = { visions, voix, linceul (n° de la nuit, 0 : aucun), cible ({ numero, cible } : le choix secret de la meute
// pour le vote n° numero, ou null) }. La voix du deuil se lit au dépouillement comme
// « une voix sans visage » (resultat.deuil : le candidat qu'elle a rejoint) : jamais d'où elle vient.
// Une peste noire n'a pas de meute : le glas y sonne, sans pouvoir.
import { normaliserEtat } from "./etat.mjs";
import { choisir } from "./hasard.mjs";

export const CLE_DEUIL = "deuil";
export const ORDRE_DEUIL = 41;

export const deuilInitial = (actif = false) => ({ actif: Boolean(actif), compte: 0 });
export const pouvoirsDeuilInitiaux = () => ({ visions: 0, voix: false, linceul: 0, cible: null });

export function normaliserDeuil(d) {
  const x = d && typeof d === "object" ? d : {};
  return { actif: Boolean(x.actif), compte: Math.max(0, Number(x.compte) || 0) };
}
export function normaliserPouvoirsDeuil(p) {
  const x = p && typeof p === "object" ? p : {};
  const c = x.cible && typeof x.cible === "object" && x.cible.cible ? { numero: Number(x.cible.numero) || 0, cible: String(x.cible.cible) } : null;
  return { visions: Math.max(0, Number(x.visions) || 0), voix: Boolean(x.voix), linceul: Number(x.linceul) || 0, cible: c };
}

// Un exécuté par le vote : innocent (camp à sa mort hors meute) -> le glas sonne et la meute gagne son pouvoir.
// -> { etat, sonne: Boolean, compte }
export function sonnerDeuil(e, { camp }) {
  const etat = normaliserEtat(e);
  if (!etat.deuil.actif || camp === "meute") return { etat, sonne: false, compte: etat.deuil.compte };
  const n = ++etat.deuil.compte;
  const p = etat.pouvoirsDeuil;
  if (n === 1) p.visions += 1;
  if (n === 2) p.voix = true;
  if (n === 3) p.linceul = etat.phase === "nuit" ? etat.tour : etat.tour + 1;
  return { etat, sonne: true, compte: n };
}

// Le choix secret de la meute pour la voix du vote n° numero (demande de meute à l'ouverture du vote, chez le MJ).
export function choisirVoixDuDeuil(e, { numero, cible = "" }) {
  const etat = normaliserEtat(e);
  etat.pouvoirsDeuil.cible = cible ? { numero: Number(numero) || 0, cible } : null;
  return etat;
}

// La voix du deuil : le candidat choisi en secret par la meute pour CE vote, sinon un candidat au hasard ; "" sans voix.
// Rien ne vient des bulletins. candidats : [acteurId] du vote.
export function voixDuDeuil({ etat, candidats = [], hasard = Math.random } = {}) {
  if (!etat?.pouvoirsDeuil?.voix || (etat?.vote?.objet ?? "execution") !== "execution") return "";
  const choix = etat.pouvoirsDeuil.cible;
  if (choix && choix.numero === etat.vote.numero && candidats.includes(choix.cible)) return choix.cible;
  return choisir(candidats, hasard) ?? "";
}

// La vision du deuil est-elle due cette nuit ? (des visions en réserve, une meute vivante)
export const visionDuDeuilDue = (etat, villageois = []) => (etat?.pouvoirsDeuil?.visions ?? 0) > 0
  && villageois.some(v => v.vivant !== false && v.camp === "meute");

// Le linceul vaut-il pour la nuit n° `nuit` ?
export const linceulDeLaNuit = (etat, nuit) => (etat?.pouvoirsDeuil?.linceul ?? 0) === nuit && nuit > 0;
