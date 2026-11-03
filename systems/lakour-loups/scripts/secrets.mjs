// Les secrets de la partie, chez le MJ actif seulement.
//
// Foundry v14 livre à TOUS les navigateurs tous les réglages du monde et tous les documents (acteurs, objets, messages
// de chat, chuchotements compris) : rien de secret ne peut y être rangé en clair. Les secrets (rôles et camps des villageois,
// choix de la nuit, bilan de la nuit, primes, fioles, maisons aspergées, votes en cours, vraies causes des morts, carnets des
// joueurs) vivent donc dans la mémoire du MJ actif, recopiés dans un réglage de portée « client » : il est rangé dans le
// navigateur du MJ (localStorage) et n'est jamais envoyé au serveur en clair. Recharger la page du MJ les retrouve ; un autre
// navigateur, ou un autre MJ, les reprend du coffre chiffré (coffre.mjs : le coffre du MJ IA) ; sans lui, la partie continue sans
// les choix déjà faits (voir secretsPerdus).
//
// Le réglage client « secrets » est rangé par [monde][userId] (0.9.0) : un navigateur partagé par deux mondes, ou par deux
// comptes, ne mélange rien ; seul un MJ le lit, et seulement pour lui-même. L'ancienne forme (les secrets à la racine du
// réglage, d'avant 0.9.0) est reprise une fois par le MJ actif (migrerSecretsAnciens), puis effacée.
//
// Chaque garde des secrets prévient le coffre (quandSecretsGardes) : il ne scelle PAS à chaque fois (une écriture du réglage
// monde « coffre » pendant la nuit trahirait le rythme des choix de nuit), seulement aux moments publics et à intervalle fixe.
import { ID } from "../logique/constantes.mjs";

let memoire = null;
let surGarde = null;

const objet = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const monde = () => String(game.world?.id ?? "");
const lireBrut = () => { try { return objet(game.settings.get(ID, "secrets")); } catch { return {}; } };
// L'ancienne forme (avant 0.9.0) : des secrets à la racine, avec leur partie.
const estAncienne = v => typeof v?.partie === "string";

// Le coffre (coffre.mjs) suit chaque garde des secrets.
export function quandSecretsGardes(fn) {
  surGarde = fn;
}

export function oublierSecrets() {
  memoire = null;
}

// Les secrets de ce MJ dans ce monde (ceux de ce navigateur), {} pour un joueur.
export function secretsMJ() {
  if (memoire) return memoire;
  if (!game.user?.isGM) return {};
  const brut = lireBrut();
  memoire = estAncienne(brut) ? {} : objet(objet(brut[monde()])[game.user.id]);
  return memoire;
}

// La révision du coffre que portent ces secrets (revCoffre, coffre.mjs) : gardée d'une garde à l'autre pour la même partie
// (l'état complet de la logique ne la connaît pas), la plus haute l'emporte.
export async function garderSecrets(secret) {
  const avant = memoire ?? secretsMJ();
  // Des secrets qui perdent toutes les fiches de la partie (écrits sans elles) ne gardent pas la révision : jamais « à jour » vides.
  const vides = o => !Object.keys(objet(o?.fiches)).length;
  if (secret && typeof secret === "object" && avant?.partie && avant.partie === secret.partie && !(vides(secret) && !vides(avant))) {
    const rev = Math.max(Number(secret.revCoffre) || 0, Number(avant.revCoffre) || 0);
    if (rev) secret = { ...secret, revCoffre: rev };
    if (!secret.ivCoffre && avant.ivCoffre) secret = { ...secret, ivCoffre: avant.ivCoffre };
  }
  memoire = secret;
  if (game.user?.isGM) {
    try {
      const brut = lireBrut();
      const tout = estAncienne(brut) ? {} : brut;
      await game.settings.set(ID, "secrets", { ...tout, [monde()]: { ...objet(tout[monde()]), [game.user.id]: secret } });
    } catch (e) { console.warn(`${ID} | secrets non enregistrés dans ce navigateur`, e); }
  }
  surGarde?.(secret);
}

// La révision (et le vecteur) du coffre que ce navigateur vient de sceller pour cette partie.
export async function noterRevision(partie, rev, iv = "") {
  const s = secretsMJ();
  if (!s?.partie || s.partie !== partie) return;
  await garderSecrets({ ...s, revCoffre: Math.max(Number(rev) || 0, Number(s.revCoffre) || 0), ...(iv ? { ivCoffre: iv } : {}) });
}

// Les secrets d'avant 0.9.0 rangés à la racine du réglage (navigateur du MJ) : rendus une fois s'ils sont ceux de cette
// partie, puis effacés (ils ne sont pas rangés par monde ni par compte). -> les secrets, ou null.
export async function migrerSecretsAnciens(partie) {
  if (!game.user?.isGM) return null;
  const brut = lireBrut();
  if (!estAncienne(brut)) return null;
  try { await game.settings.set(ID, "secrets", {}); } catch { /* sans stockage local */ }
  return partie && brut.partie === partie ? brut : null;
}

// Une partie en cours dont ce navigateur n'a pas les secrets (autre MJ, autre navigateur, stockage effacé), ou seulement une
// partie (secretsIncomplets : une partie reprise d'avant 0.9.0 sans ses secrets).
export function secretsPerdus(publicEtat) {
  // Les préparatifs d'une partie distribuée comptent : les rôles sont déjà dans les secrets (fiches).
  if (!publicEtat?.partie || publicEtat.phase === "fin") return false;
  const s = secretsMJ();
  return (s?.partie ?? "") !== publicEtat.partie || Boolean(s?.secretsIncomplets);
}
