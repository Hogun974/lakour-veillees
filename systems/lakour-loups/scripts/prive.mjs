// Ce que le navigateur d'un JOUEUR sait en propre : son carnet secret (son rôle, ce qu'il apprend la nuit, les mots du
// Messager), sa prime s'il est Chasseur de primes, et son vote en cours. Tout arrive du MJ actif par le socket, adressé
// à ce seul joueur (recipients), et reste ici : mémoire, plus un réglage de portée « client » (localStorage) pour
// survivre à un rechargement. Rien de tout cela n'est écrit dans le monde.
import { ID } from "../logique/constantes.mjs";

const vide = () => ({ partie: "", entrees: [], prime: "", vote: { numero: 0, cible: "" } });
let cache = vide();

export const mesSecrets = () => cache;

export function oublierPrive() {
  cache = vide();
}

export function chargerPrive(partie) {
  try {
    const c = game.settings.get(ID, "carnet");
    cache = c?.partie && c.partie === partie ? { ...vide(), ...c } : { ...vide(), partie };
  } catch { cache = { ...vide(), partie }; }
}

function sauver() {
  try { game.settings.set(ID, "carnet", cache); } catch { /* sans stockage local */ }
  Hooks.callAll("lakourLoups.prive", cache);
}

// Une autre partie a commencé : on repart d'un carnet vide.
function memePartie(partie) {
  if (partie !== undefined && partie !== cache.partie) cache = { ...vide(), partie };
}

export function recevoirSecret({ partie, entree }) {
  memePartie(partie);
  if (entree?.id && !cache.entrees.some(e => e.id === entree.id)) cache.entrees.push(entree);
  sauver();
}

export function recevoirCarnet({ partie, entrees = [], prime = "", vote }) {
  memePartie(partie);
  for (const e of entrees) if (e?.id && !cache.entrees.some(x => x.id === e.id)) cache.entrees.push(e);
  cache.entrees.sort((a, b) => (a.quand ?? 0) - (b.quand ?? 0));
  cache.prime = prime ?? "";
  if (vote) cache.vote = { numero: Number(vote.numero) || 0, cible: vote.cible ?? "" };
  sauver();
}

export function noterMonVote({ partie, numero, cible }) {
  memePartie(partie);
  cache.vote = { numero: Number(numero) || 0, cible: cible ?? "" };
  sauver();
}

// Mon vote dans le vote ouvert n° numero ("" si je n'ai pas voté, ou si c'était un autre vote).
export const monVote = numero => (cache.vote.numero === numero ? cache.vote.cible : "");
