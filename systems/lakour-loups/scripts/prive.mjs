// Ce que le navigateur d'un JOUEUR sait en propre : son carnet secret (son rôle, ce qu'il apprend la nuit, les mots du
// Messager), sa FICHE (0.9.0 : son rôle, ses usages restants, son camp, son amoureux ; ni le document ni un réglage monde ne les
// portent plus), sa prime s'il est Chasseur de primes, son vote en cours et, mort qui voit tout (« mortsVoientTout »), les rôles
// des autres. Tout arrive du MJ actif par le socket, adressé à ce seul joueur (recipients), et reste ici : mémoire, plus un
// réglage de portée « client » (localStorage) pour survivre à un rechargement. Rien de tout cela n'est écrit dans le monde.
//
// Le réglage client « carnet » est rangé par [monde][userId] : deux comptes qui se succèdent dans un même navigateur ne lisent
// jamais le carnet l'un de l'autre. L'ancienne forme (d'avant 0.9.0, à la racine) est effacée : le MJ actif renvoie tout au
// « bonjour » du joueur.
import { ID } from "../logique/constantes.mjs";

const vide = () => ({ partie: "", entrees: [], prime: "", vote: { numero: 0, cible: "" }, fiches: {}, vus: {} });
let cache = vide();

const objet = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const monde = () => String(game.world?.id ?? "");
const moi = () => String(game.user?.id ?? "");
const lireBrut = () => { try { return objet(game.settings.get(ID, "carnet")); } catch { return {}; } };

export const mesSecrets = () => cache;

export function oublierPrive() {
  cache = vide();
}

export function chargerPrive(partie) {
  const brut = lireBrut();
  // L'ancienne forme, à la racine : ni par monde ni par compte. Effacée ; le MJ renverra tout.
  if (typeof brut.partie === "string") {
    try { game.settings.set(ID, "carnet", {}); } catch { /* sans stockage local */ }
    cache = { ...vide(), partie };
    return;
  }
  const c = objet(objet(brut[monde()])[moi()]);
  cache = c.partie && c.partie === partie ? { ...vide(), ...c, fiches: objet(c.fiches), vus: objet(c.vus) } : { ...vide(), partie };
}

function sauver() {
  try {
    const brut = lireBrut();
    const tout = typeof brut.partie === "string" ? {} : brut;
    game.settings.set(ID, "carnet", { ...tout, [monde()]: { ...objet(tout[monde()]), [moi()]: cache } });
  } catch { /* sans stockage local */ }
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

// Sa fiche (son villageois) : null la retire (nouvelle partie, plus de rôle).
export function recevoirFiche({ partie, acteurId, fiche }) {
  if (!acteurId) return false;
  memePartie(partie);
  if (fiche && typeof fiche === "object") cache.fiches = { ...cache.fiches, [acteurId]: fiche };
  else {
    const { [acteurId]: _retiree, ...reste } = cache.fiches;
    cache.fiches = reste;
  }
  sauver();
  return true;
}

// Mort qui voit tout : les rôles et camps des autres ({} : plus rien, il garde son souffle ou la partie a changé).
export function recevoirVus({ partie, vus }) {
  memePartie(partie);
  cache.vus = objet(vus);
  sauver();
  return true;
}

export function noterMonVote({ partie, numero, cible }) {
  memePartie(partie);
  cache.vote = { numero: Number(numero) || 0, cible: cible ?? "" };
  sauver();
}

// Mon vote dans le vote ouvert n° numero ("" si je n'ai pas voté, ou si c'était un autre vote).
export const monVote = numero => (cache.vote.numero === numero ? cache.vote.cible : "");
