// Le coffre des secrets, branché sur Foundry (logique et chiffrement : logique/coffre.mjs).
// - Chez le MJ actif : chaque fois que les secrets sont gardés (secrets.mjs), le coffre (réglage monde, chiffré) suit ; à
//   chaque nouvelle partie, une nouvelle clé, et chaque joueur connecté reçoit sa part, à lui seul ; un joueur qui arrive
//   ou recharge la reçoit aussi (api.envoyerCarnet).
// - Chez un joueur : sa part, rangée dans son navigateur (réglage « client »), rendue au seul MJ qui la demande (l'émetteur
//   donné par le serveur fait foi).
// - Un MJ actif sans les secrets de la partie en cours (autre navigateur, autre MJ) demande leurs parts aux joueurs
//   connectés ; dès que deux concordent, il rouvre le coffre et la partie reprend là où elle en était. Tant qu'il attend,
//   il ne rescelle rien : le coffre d'une partie n'est jamais écrasé par des secrets incomplets.
import { ID } from "../logique/constantes.mjs";
import * as C from "../logique/coffre.mjs";
import { emettre, estMJActif } from "./canal.mjs";
import { garderSecrets, quandSecretsGardes } from "./secrets.mjs";

let cle = null;              // la clé de la partie, chez le MJ actif
let aRetrouver = "";         // la partie dont ce MJ attend les parts
let recues = new Map();      // userId -> part rendue
let retrouves = null;        // rappel quand les secrets sont retrouvés
let file = Promise.resolve();

const lire = nom => { try { return game.settings.get(ID, nom) ?? {}; } catch { return {}; } };
const joueursConnectes = () => game.users.filter(u => u.active && !u.isGM).map(u => u.id);

export function oublierCoffre() {
  cle = null;
  aRetrouver = "";
  recues = new Map();
  retrouves = null;
  file = Promise.resolve();
}

function maCle(partie) {
  if (cle?.partie !== partie) {
    const gardee = lire("cleCoffre");
    cle = gardee.partie === partie && gardee.k ? gardee : null;
  }
  return cle;
}

// ------------------------------------------------------------------ chez le MJ actif : ranger
// Après chaque garde des secrets : le coffre suit, une écriture à la fois. Rend la promesse de cette écriture.
export function rangerAuCoffre(secret) {
  if (!estMJActif()) return file;
  file = file.then(() => sceller(secret)).catch(e => console.warn(`${ID} | coffre des secrets non rangé`, e));
  return file;
}
quandSecretsGardes(rangerAuCoffre);
export const rangement = () => file;

async function sceller(secret) {
  const partie = secret?.partie ?? "";
  if (aRetrouver && aRetrouver !== partie) aRetrouver = "";   // une autre partie a commencé : plus rien à retrouver
  const coffre = lire("coffre");
  if (!partie) {
    if (coffre.partie) await game.settings.set(ID, "coffre", {});
    return;
  }
  let c = maCle(partie);
  if (!c) {
    if (coffre.partie === partie) return;   // le coffre de cette partie attend ses parts : surtout ne pas l'écraser
    c = cle = C.nouvelleCle(partie);
    await game.settings.set(ID, "cleCoffre", c);
    for (const id of joueursConnectes()) envoyerPart(id, partie);
  }
  await game.settings.set(ID, "coffre", await C.sceller(secret, c));
}

// La part d'un joueur, à lui seul.
function envoyerPart(userId, partie) {
  const c = maCle(partie);
  if (!c || !game.users.get(userId) || game.users.get(userId).isGM) return false;
  emettre({ type: "part", ...C.partDe(c, userId) }, [userId]);
  return true;
}

// Un joueur se connecte ou recharge : il reçoit sa part ; si ce MJ attend des parts, on lui demande la sienne.
export function joueurArrive(userId, partie) {
  if (!estMJActif() || !userId || !partie) return false;
  if (aRetrouver === partie) emettre({ type: "rendrePart", partie }, [userId]);
  return envoyerPart(userId, partie);
}

// ------------------------------------------------------------------ chez le MJ actif : retrouver
// Ce navigateur n'a pas les secrets de la partie en cours : on les cherche dans le coffre. Rend true si la recherche est
// lancée (ou déjà aboutie avec la clé de ce navigateur) ; false s'il n'y a rien à retrouver.
export async function chercherSecrets(partie, quandRetrouves = null) {
  const coffre = lire("coffre");
  if (!estMJActif() || !partie || coffre.partie !== partie) return false;
  retrouves = quandRetrouves;
  const c = maCle(partie);
  if (c) {
    const secret = await C.ouvrir(coffre, c);
    if (secret) return reprendre(secret, c).then(() => true);
  }
  aRetrouver = partie;
  recues = new Map();
  emettre({ type: "rendrePart", partie }, joueursConnectes());
  return true;
}

export const enAttenteDeParts = () => Boolean(aRetrouver);

// La part rendue par un joueur (userId : l'émetteur réel). Dès que deux parts ouvrent le coffre, les secrets reviennent.
export async function recevoirPartRendue({ partie, x, y, userId }) {
  if (!aRetrouver || partie !== aRetrouver || !userId || game.users.get(userId)?.isGM) return false;
  if (C.abscisse(userId).toString(16) !== String(x)) return false;   // la part d'un autre joueur
  recues.set(userId, { partie, x: String(x), y: String(y) });
  const parts = [...recues.values()];
  const coffre = lire("coffre");
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const c = C.reconstituer([parts[i], parts[j]]);
      const secret = c && await C.ouvrir(coffre, c);
      if (secret && aRetrouver === partie) {
        await reprendre(secret, c);
        return true;
      }
    }
  }
  return true;
}

async function reprendre(secret, c) {
  cle = c;
  aRetrouver = "";
  recues = new Map();
  await game.settings.set(ID, "cleCoffre", c);
  await garderSecrets(secret);
  const rappel = retrouves;
  retrouves = null;
  await rappel?.(secret);
}

// ------------------------------------------------------------------ chez un joueur
// Sa part, envoyée par un MJ.
export async function recevoirPart({ partie, x, y } = {}) {
  if (game.user.isGM || !partie || !x || !y) return false;
  await game.settings.set(ID, "partCoffre", { partie, x: String(x), y: String(y) });
  return true;
}

// Un MJ (emetteur : l'identifiant donné par le serveur, obligatoire) demande sa part pour rouvrir le coffre.
export function rendrePart({ partie } = {}, emetteur) {
  if (game.user.isGM || !emetteur || !game.users.get(emetteur)?.isGM) return false;
  const p = lire("partCoffre");
  if (!p.partie || p.partie !== partie) return false;
  emettre({ type: "partRendue", partie: p.partie, x: p.x, y: p.y, userId: game.user.id }, [emetteur]);
  return true;
}
