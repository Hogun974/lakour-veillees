// L'activité d'un joueur que Foundry diffuse à tous (curseur, ping, règle, cibles, voyant « parle ») : masquée la nuit, chez tous ;
// jamais le jour, même pendant un choix secret (masquer le seul qui choisit le désignerait : logique/activite.mjs).
//
// Lu dans Foundry v14 (14.370) :
// - client/documents/user.mjs : User#broadcastActivity(data) émet `userActivity` par le socket (seulement pour soi-même).
// - serveur, dist/components/activity.mjs : le message est relayé à TOUS les autres navigateurs (socket.broadcast.emit), sans
//   filtre ni droit, avec l'heure de l'activité (lastActivityTime) et idle:false ajoutés ; sceneId, levelId, cursor, ruler,
//   targets et av sont gardés et rejoués à qui se connecte (getUserActivity). Un message, même vide, dit « il est actif ».
// - client/documents/collections/users.mjs (Users.#handleUserActivity) : chez chacun, av -> AVSettings#handleUserActivity
//   (game.webrtc.settings.activity, ui.webrtc.setUserIsSpeaking) ; cursor, ping, ruler, targets, plannedMovements -> la carte.
// - Ce qui diffuse : la souris sur la carte (ControlsLayer#_onMouseMove : {cursor} avec le droit SHOW_CURSOR, {} sans), le
//   ping (Canvas#ping : {cursor, ping}, droit PING_CANVAS), la règle (BaseRuler : {ruler}, null sans SHOW_RULER), les cibles
//   (TokenLayer : {targets}), les déplacements prévus (Token : {plannedMovements}), la voix (AVMaster#broadcast :
//   {av: {speaking}} à chaque changement : en détection de voix, à chaque phrase ; en mode « toujours », le micro coupé la
//   nuit d'un non-loup passerait à false, pas celui d'un loup), les réglages A/V (AVSettings : {av: {muted, hidden}}), la
//   scène vue (Canvas : {sceneId, levelId, …}). Les droits SHOW_CURSOR, SHOW_RULER et PING_CANVAS ne sont vérifiés que par
//   le navigateur émetteur ; le serveur relaie tout.
// La voix elle-même est triée par scripts/salons.mjs ; ici, ce qui l'entoure.
//
// Chez un joueur (jamais chez un MJ), User#broadcastActivity est enveloppé sur l'instance game.user. Tant que son activité
// est masquée : cursor, ping, ruler, targets, plannedMovements et av sont retirés ; s'il ne reste rien, rien ne part. Au
// début du masquage, un message efface ce que les autres voyaient encore (curseur, règle, déplacements prévus ; voyant
// « parle » à false). À la fin, la voix est resynchronisée par un seul message ({av: {muted, hidden, speaking}}), une fois la
// ligne des salons de la nouvelle phase arrivée (salons.mjs a alors rouvert le micro ou non) ; si un message de voix part
// entre-temps, c'est lui qui porte l'état. Chaque joueur, loup ou non, envoie ainsi les mêmes messages au même moment.
// Ce n'est qu'une enveloppe dans le navigateur du joueur : elle protège ses secrets de SES propres gestes, pas d'un joueur qui
// voudrait se trahir lui-même.
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { lirePublic } from "./donnees.mjs";
import { ligneCourante } from "./salons.mjs";
import { surChoixEnCours } from "./apps/choix.mjs";

// Au plus ce délai pour la ligne des salons de la nouvelle phase (sans MJ actif, elle ne vient pas).
export const DELAI_RESYNCHRO = 5000;

let rendreFn = null;   // remet game.user comme avant
let moi = null;        // l'utilisateur enveloppé (game.user ne change pas dans Foundry ; dans les essais, si)
let envoi = null;      // la vraie méthode, sans filtre
let masquee = false;
let resynchro = null;  // { minuterie } : la voix à resynchroniser après le masquage

// Remplace une méthode sur l'instance (pas sur la classe) ; rend une fonction qui remet l'objet comme avant.
function envelopper(objet, nom, fabrique) {
  const propre = Object.hasOwn(objet, nom);
  const avant = objet[nom];
  objet[nom] = fabrique(avant);
  return () => { if (propre) objet[nom] = avant; else delete objet[nom]; };
}

const phasePublique = () => { try { return String(lirePublic().phase ?? ""); } catch { return ""; } };

// L'activité de ce navigateur doit-elle être masquée, maintenant ? La nuit, celle de tous ; le jour, celle de personne, même pendant
// un choix secret (relecture adverse : masquer le seul joueur qui choisit le désignerait ; logique/activite.mjs).
export function activiteMasqueeIci() {
  const u = game.user;
  if (!u || u.isGM) return false;
  return L.activiteMasquee({ mj: false, phases: [phasePublique(), String(ligneCourante()?.phase ?? "")] });
}

// L'état A/V public de ce joueur (micro coupé, caméra cachée), tel que Foundry le diffuse.
function etatAV() {
  try {
    const s = game.webrtc?.settings?.getUser?.(game.user.id);
    return s ? { muted: Boolean(s.muted), hidden: Boolean(s.hidden) } : {};
  } catch { return {}; }
}
const parleIci = () => { try { return Boolean(game.webrtc?.broadcasting); } catch { return false; } };

function annulerResynchro() {
  if (!resynchro) return;
  clearTimeout(resynchro.minuterie);
  resynchro = null;
}

function envoyer(donnees) {
  try { envoi?.(donnees); } catch (e) { console.warn(`${ID} | activité`, e); }
}

// La voix après le masquage, en un seul message. AVMaster compare ses changements à game.webrtc.settings.activity : on l'y note.
function resynchroniser() {
  annulerResynchro();
  if (!envoi || masquee || game.user !== moi) return;
  const av = { ...etatAV(), speaking: parleIci() };
  try { const a = game.webrtc?.settings?.activity?.[game.user.id]; if (a) a.speaking = av.speaking; } catch { /* sans A/V */ }
  envoyer({ av });
}

// La ligne des salons est-elle celle de la phase publique ? (sans ligne : rien à attendre)
const ligneAJour = () => { const l = ligneCourante(); return !l || l.phase === phasePublique(); };

function programmerResynchro() {
  if (!resynchro) {
    resynchro = { minuterie: setTimeout(resynchroniser, DELAI_RESYNCHRO) };
    resynchro.minuterie?.unref?.();
  }
  // Après la pile en cours : un message de voix qui part maintenant (le micro rouvert par salons.mjs) porte déjà l'état.
  if (ligneAJour()) queueMicrotask(() => { if (resynchro && !masquee && ligneAJour()) resynchroniser(); });
}

// Le masquage commence ou finit : efface, ou resynchronise la voix. -> masquée ou non.
export function verifierActivite() {
  if (!envoi || game.user !== moi) return masquee;
  const m = activiteMasqueeIci();
  if (m !== masquee) {
    masquee = m;
    if (m) {
      annulerResynchro();
      envoyer(L.activiteEffacee(etatAV()));
    } else programmerResynchro();
  } else if (!m && resynchro && ligneAJour()) programmerResynchro();
  return masquee;
}

export const activiteBranchee = () => Boolean(rendreFn);

// Au « ready », chez un joueur seulement.
export function brancherActivite() {
  const u = game.user;
  if (rendreFn || !u || u.isGM || typeof u.broadcastActivity !== "function") return false;
  moi = u;
  rendreFn = envelopper(u, "broadcastActivity", avant => {
    envoi = donnees => avant.call(u, donnees);
    return function (donnees = {}, ...reste) {
      verifierActivite();
      if (masquee) {
        const permis = L.filtrerActivite(donnees);
        return permis ? avant.call(this, permis, ...reste) : undefined;
      }
      if (resynchro && donnees && typeof donnees === "object" && "av" in donnees) {
        annulerResynchro();
        donnees = { ...donnees, av: { ...etatAV(), ...donnees.av } };
      }
      return avant.call(this, donnees, ...reste);
    };
  });
  masquee = false;
  verifierActivite();
  return true;
}

// Pour les essais : game.user rendu tel quel.
export function debrancherActivite() {
  annulerResynchro();
  rendreFn?.();
  rendreFn = null;
  moi = null;
  envoi = null;
  masquee = false;
}

let crochets = false;
export function brancherCrochetsActivite() {
  if (crochets) return;
  crochets = true;
  // La phase publique, la ligne des salons (elle peut arriver avant la phase), un choix secret qui s'ouvre ou se ferme.
  for (const nom of ["lakourLoups.phase", "lakourLoups.aube", "lakourLoups.victoire", "lakourLoups.nouvellePartie", "lakourLoups.audibilite", "lakourLoups.salon"]) {
    Hooks.on(nom, () => { verifierActivite(); });
  }
  surChoixEnCours(() => { verifierActivite(); });
}
