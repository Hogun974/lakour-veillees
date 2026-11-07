// Caméras des joueurs aux Veillées : la règle de logique/cameras.mjs posée dans le moteur commun (lakour-mj-ia, api.cameras,
// scripts/cameras.js du moteur), qui fait le travail dans chaque navigateur : la piste vidéo du joueur remplacé est éteinte à la
// source dans SON navigateur (plus une image de sa caméra ne part), et tous les navigateurs montrent l'image (un loup-garou) à la
// place de sa vignette ; quand la règle ne vaut plus, sa caméra revient (si le MJ permet les caméras : réglage du moteur).
//
// Réglages du système : « cameraRemplacee » (vrai par défaut) et « imageCamera » (vide : l'image du module de contenu actif,
// modules/<lakour-veillees ou lakour-veillees-en>/assets/camera/loup-garou.webp ; repli : loup-garou.svg à côté, puis l'avatar).
//
// Rien ne transite par ce mécanisme : ni socket, ni réglage ou document écrit. Chaque navigateur calcule la règle chez lui, avec ce
// que tous savent (l'état public, les documents des villageois : vivant, silence, joueur) ; jamais les secrets du MJ actif, même
// chez lui (un camp ou une fratrie changerait sa vignette d'un joueur, et tous les autres la verraient différemment).
// Recalcul : à chaque changement de l'état public (lakour-loups.mjs, quandEtatChange), d'un villageois, d'un réglage ; le moteur,
// lui, réapplique à chaque rendu des caméras. Sans le moteur, ou un moteur sans caméras (avant 0.44), rien ne se passe.
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { lirePublic, tousLesVillageois } from "./donnees.mjs";

const MOTEUR = "lakour-mj-ia";
const lire = (cle, defaut) => { try { return game.settings.get(ID, cle) ?? defaut; } catch { return defaut; } };
export const remplacementActif = () => lire("cameraRemplacee", true) !== false;

// Le module de contenu actif : le français, sinon l'anglais (les deux ne peuvent pas être actifs ensemble).
function moduleDeContenu() {
  const actif = id => Boolean(game.modules?.get?.(id)?.active);
  return !actif("lakour-veillees") && actif("lakour-veillees-en") ? "lakour-veillees-en" : "lakour-veillees";
}

// Les villageois tels que tous les voient : rien d'autre que ces quatre champs publics.
export const villageoisPublics = () => {
  try { return tousLesVillageois().map(a => ({ id: a.id, joueur: a.system?.joueur ?? "", vivant: a.system?.vivant !== false, silence: Boolean(a.system?.silence) })); } catch { return []; }
};

// Le contexte d'une actualisation (lu une fois pour tous les utilisateurs, oublié à la fin de la tâche en cours).
let contexte = null;
function lireContexte() {
  if (!contexte) {
    let pub = {};
    try { pub = lirePublic(); } catch { pub = {}; }
    contexte = { pub, villageois: villageoisPublics(), actif: remplacementActif(), images: L.imagesDeCamera(lire("imageCamera", ""), moduleDeContenu()) };
    queueMicrotask(() => { contexte = null; });
  }
  return contexte;
}

// La règle donnée au moteur : utilisateur Foundry -> null (sa caméra) ou { image, repli, raison }.
export function regleDesVeillees(utilisateur) {
  if (!utilisateur || utilisateur.isGM) return null;
  const c = lireContexte();
  const r = L.cameraDe(c.pub, { userId: String(utilisateur.id ?? ""), mj: false, villageois: c.villageois, actif: c.actif });
  return r.remplacee ? { image: c.images.image, repli: c.images.repli, raison: r.raison } : null;
}

const apiDuMoteur = () => { try { return game.modules?.get?.(MOTEUR)?.api?.cameras ?? null; } catch { return null; } };

let retirer = null;
// Pose la règle (une fois) si le moteur a ses caméras. -> vrai si elle est posée.
export function poserRegle() {
  if (retirer) return true;
  const api = apiDuMoteur();
  if (typeof api?.regle !== "function") return false;
  retirer = api.regle(regleDesVeillees);
  return true;
}

// Après un changement (état public, villageois, réglage) : le moteur recalcule et réapplique.
export function actualiserCameras() {
  contexte = null;
  if (!retirer && !poserRegle()) return false;
  try { apiDuMoteur()?.actualiser?.(); } catch (e) { console.warn(`${ID} | caméras`, e); }
  return true;
}

let branche = false;
// Au crochet « setup » du système (après le « init » du moteur, qui a son API des caméras ; avant la connexion A/V), et sinon
// au crochet « lakour-mj-ia.pret ».
export function brancherCameras() {
  if (branche) return;
  branche = true;
  if (!poserRegle()) Hooks.once(`${MOTEUR}.pret`, () => { poserRegle(); });
  for (const nom of ["createActor", "deleteActor", "createUser", "deleteUser", "lakourLoups.nouvellePartie"]) Hooks.on(nom, () => { actualiserCameras(); });
  Hooks.on("updateActor", acteur => { if (acteur?.type === "villageois") actualiserCameras(); });
}

// Pour les essais : la règle retirée du moteur.
export function debrancherCameras() {
  retirer?.();
  retirer = null;
  contexte = null;
}
