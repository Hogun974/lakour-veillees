// Les secrets de la partie, chez le MJ actif seulement.
//
// Foundry v14 livre à TOUS les navigateurs tous les réglages du monde et tous les documents (acteurs, objets, messages
// de chat, chuchotements compris) : rien de secret ne peut y être rangé en clair. Les secrets (choix de la nuit, bilan
// de la nuit, primes, fioles, maisons aspergées, votes en cours, vraies causes des morts, carnets des joueurs) vivent
// donc dans la mémoire du MJ actif, recopiés dans un réglage de portée « client » : il est rangé dans le navigateur
// du MJ (localStorage) et n'est jamais envoyé au serveur en clair. Recharger la page du MJ les retrouve ; un autre
// navigateur, ou un autre MJ, les reprend du coffre chiffré (coffre.mjs), avec les parts de clé de deux joueurs connectés ;
// sans elles, la partie continue sans les choix déjà faits (voir secretsPerdus).
import { ID } from "../logique/constantes.mjs";

let memoire = null;
let surGarde = null;

// Le coffre (coffre.mjs) suit chaque garde des secrets.
export function quandSecretsGardes(fn) {
  surGarde = fn;
}

export function oublierSecrets() {
  memoire = null;
}

export function secretsMJ() {
  if (memoire) return memoire;
  try { memoire = game.settings.get(ID, "secrets") ?? {}; } catch { memoire = {}; }
  return memoire;
}

export async function garderSecrets(secret) {
  memoire = secret;
  try { await game.settings.set(ID, "secrets", secret); } catch (e) { console.warn(`${ID} | secrets non enregistrés dans ce navigateur`, e); }
  surGarde?.(secret);
}

// Une partie en cours dont ce navigateur n'a pas les secrets (autre MJ, autre navigateur, stockage effacé).
export function secretsPerdus(publicEtat) {
  if (!publicEtat?.partie || ["preparation", "fin"].includes(publicEtat.phase)) return false;
  return (secretsMJ()?.partie ?? "") !== publicEtat.partie;
}
