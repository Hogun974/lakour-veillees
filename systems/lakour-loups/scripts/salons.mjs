// Salons vocaux des Veillées, dans la voix intégrée de Foundry (A/V) — logique/salons.mjs pour la matrice.
//
// Chez le MJ actif (lui seul connaît les camps) : à chaque changement (phase, mort, silence, camp, distribution, nouvelle
// partie, réglage), la matrice est recalculée et chaque navigateur reçoit SA ligne, à lui seul, par le socket du système
// (`{ type: "salon", partie, ligne }`, recipients : [son userId]) : son salon, s'il peut parler, qui l'entend, qui il
// entend. Un non-loup n'y apprend jamais qui est loup ; un loup y apprend la meute, comme dans le jeu. Rien dans un réglage
// monde ni dans un document. Le hook `lakourLoups.audibilite` ({ phase }, sans secret) prévient de chaque changement :
// chez tous pour ce qui est public (phase, mort, silence, réglage, distribution, nouvelle partie), chez le MJ seul pour ce
// qui ne l'est pas (un villageois mordu qui rejoint la meute).
//
// Dans chaque navigateur, d'après sa ligne : les flux A/V des gens qu'on ne doit pas entendre sont coupés LOCALEMENT
// (pistes du flux distant désactivées, élément <video> muet, voyant « parle » éteint : rien ne trahit un loup qui parle la
// nuit), et son propre micro est coupé quand on doit se taire (AVMaster#broadcast et AVClient#toggleBroadcast enveloppés
// sur l'instance, toujours à false). Aucun réglage A/V persistant n'est modifié (ni muted, ni volume) ; tout est rendu
// quand la ligne le permet (préparatifs, fin, salons coupés), et quand on quitte le monde. Le MJ n'est jamais coupé.
// Sans A/V (mode « Désactivé »), rien n'est touché et le bandeau reste discret.
//
// Code client de Foundry v14 lu pour cela (server/client/av) : AVMaster (game.webrtc : mode, broadcast, canUserShareAudio),
// SimplePeerAVClient (getMediaStreamForUser, toggleBroadcast qui règle `enabled` des pistes du flux local, toggleAudio),
// CameraViews (ui.webrtc : getUserVideoElement, getUserCameraView, setUserIsSpeaking ; le son d'un joueur passe par son
// <video class="user-camera">, srcObject = son flux ; rendu à nouveau à chaque flux reçu).
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif, emettre, annoncer } from "./canal.mjs";
import { t, lirePublic, villageoisAPlat } from "./donnees.mjs";
import { secretsMJ } from "./secrets.mjs";

const lire = (cle, defaut) => { try { return game.settings.get(ID, cle) ?? defaut; } catch { return defaut; } };
export const salonsAutomatiques = () => lire("salonsAutomatiques", true) !== false;

// La table vue de ce navigateur (documents et réglages, que tous ont) ; loupsConnus : ce qu'un loup sait de sa meute.
function table({ loupsConnus = [] } = {}) {
  return {
    villageois: villageoisAPlat().map(v => ({ id: v.id, joueur: v.joueur, vivant: v.vivant, silence: v.silence, camp: v.camp,
      role: v.role ? { camp: v.role.camp } : null })),
    utilisateurs: game.users.map(u => ({ id: u.id, mj: Boolean(u.isGM) })),
    mortsVoientTout: Boolean(lire("mortsVoientTout", true)),
    automatique: salonsAutomatiques(),
    loupsConnus
  };
}

// ------------------------------------------------------------------ la ligne de ce navigateur
let maLigne = null;
export const ligneCourante = () => (maLigne ? foundry.utils.deepClone(maLigne) : null);

function changerMaLigne(ligne, partie) {
  const avant = JSON.stringify(maLigne);
  maLigne = ligne ? { ...foundry.utils.deepClone(ligne), partie: partie ?? "" } : null;
  appliquerVoix();
  if (JSON.stringify(maLigne) !== avant) Hooks.callAll("lakourLoups.salon", ligneCourante());
}

// Reçue du MJ actif (socket, message d'un MJ seulement : voir socket.mjs).
export function recevoirLigne({ partie, ligne } = {}) {
  if (!ligne || typeof ligne !== "object" || !Array.isArray(ligne.entend) || !Array.isArray(ligne.auditeurs)) return false;
  changerMaLigne(ligne, partie);
  return true;
}

// Une ligne encore valable (même phase que l'état public) : sinon on attend la suivante, en restant prudent.
const ligneAJour = () => (maLigne && maLigne.phase === lirePublic().phase ? maLigne : null);

// ------------------------------------------------------------------ API (game.lakourLoups.audibilite / audibiliteActeur)
// Chez le MJ actif : la matrice complète. Ailleurs : prudent, d'après ce que ce navigateur sait (sa ligne pour lui-même ;
// pour un autre, aucun camp connu, sauf la meute pour un loup).
export function audibilite(userId = game.user?.id) {
  const pub = lirePublic();
  if (estMJActif()) {
    const r = L.audibilite(pub, secretsMJ(), String(userId ?? ""), table());
    // acteursAuditeurs : les compagnons IA qui l'entendent (servi au MJ IA pour router la transcription ; jamais hors du MJ actif).
    return { peutParler: r.peutParler, auditeurs: r.auditeurs, acteursAuditeurs: r.acteursAuditeurs };
  }
  const ligne = ligneAJour();
  if (ligne && userId === game.user.id) return { peutParler: Boolean(ligne.peutParler), auditeurs: [...ligne.auditeurs] };
  const r = L.audibilite(pub, null, String(userId ?? ""), table({ loupsConnus: ligne?.loups ?? [] }));
  return { peutParler: r.peutParler, auditeurs: r.auditeurs };
}

export function audibiliteActeur(acteurId) {
  const pub = lirePublic();
  const secrets = estMJActif() ? secretsMJ() : null;
  const r = L.audibilite(pub, secrets, { acteurId: String(acteurId ?? "") }, table({ loupsConnus: secrets ? [] : ligneAJour()?.loups ?? [] }));
  return { peutParler: r.peutParler, auditeurs: r.auditeurs, acteursAuditeurs: r.acteursAuditeurs };
}

// ------------------------------------------------------------------ chez le MJ actif : calcul et envoi des lignes
let envoyees = new Map();   // userId -> ligne envoyée (JSON)
let derniere = { globale: null, publique: null };

export function oublierSalons() {
  envoyees = new Map();
  derniere = { globale: null, publique: null };
  maLigne = null;
}

// Les destinataires d'une ligne : les joueurs connectés (un MJ entend tout, il n'en a pas besoin).
const destinataires = () => game.users.filter(u => !u.isGM && u.active !== false && u.id !== game.user.id);

function emettreLigne(userId, ligne, partie) {
  envoyees.set(userId, JSON.stringify(ligne));
  emettre({ type: "salon", partie, ligne }, [userId]);
}

// Recalcule la matrice ; chaque ligne qui a changé part à son seul joueur. forcer : le hook part même sans changement
// (phase, distribution, nouvelle partie, réglage). -> les lignes { userId: ligne }, null hors du MJ actif.
export function rafraichirSalons({ forcer = false } = {}) {
  if (!estMJActif()) return null;
  const pub = lirePublic();
  const tab = table();
  const lignes = L.lignesDeTous(pub, secretsMJ(), tab);
  for (const u of destinataires()) {
    const ligne = lignes[u.id];
    if (ligne && envoyees.get(u.id) !== JSON.stringify(ligne)) emettreLigne(u.id, ligne, pub.partie);
  }
  changerMaLigne(lignes[game.user.id] ?? null, pub.partie);
  const globale = JSON.stringify(lignes);
  // Ce que tous peuvent savoir : la phase, les réglages, qui joue, qui est mort, qui est réduit au silence.
  const publique = JSON.stringify([pub.partie, pub.phase, tab.automatique, tab.mortsVoientTout,
    tab.villageois.map(v => [v.id, v.joueur, v.vivant, v.silence]), tab.utilisateurs]);
  if (forcer || publique !== derniere.publique) annoncer("lakourLoups.audibilite", [{ phase: pub.phase }]);
  else if (globale !== derniere.globale) Hooks.callAll("lakourLoups.audibilite", { phase: pub.phase });
  derniere = { globale, publique };
  return lignes;
}

// La ligne d'un joueur qui (se re)connecte, ou qui recharge (« bonjour »).
export function envoyerLigne(userId) {
  if (!estMJActif() || !userId || userId === game.user.id) return false;
  const pub = lirePublic();
  const ligne = L.ligneDe(pub, secretsMJ(), userId, table());
  emettreLigne(userId, ligne, pub.partie);
  return true;
}

// Le réglage « Salons vocaux automatiques » (ou « Les morts voient tout ») a changé : partout.
export function quandReglageSalons() {
  if (estMJActif()) rafraichirSalons({ forcer: true });
  else {
    appliquerVoix();
    Hooks.callAll("lakourLoups.salon", ligneCourante());
  }
}

// ------------------------------------------------------------------ la voix de Foundry dans ce navigateur
const DESACTIVE = 0;   // AVSettings.AV_MODES.DISABLED
export function avActif() {
  try {
    const w = game.webrtc;
    return Boolean(w?.client) && Number(w.mode ?? w.settings?.world?.mode ?? DESACTIVE) !== DESACTIVE;
  } catch { return false; }
}

// Remplace une méthode sur l'instance (pas sur la classe) ; rend une fonction qui remet l'objet comme avant.
function envelopper(objet, nom, fabrique) {
  const propre = Object.hasOwn(objet, nom);
  const avant = objet[nom];
  objet[nom] = fabrique(avant);
  return () => { if (propre) objet[nom] = avant; else delete objet[nom]; };
}

const coupes = new Set();   // userId dont ce navigateur a coupé le flux
let rendreMicroFn = null;
let rendreVoyantFn = null;

function fluxDe(userId) {
  try { return game.webrtc?.client?.getMediaStreamForUser?.(userId) ?? null; } catch { return null; }
}

// Le flux d'un autre : coupé (son, image, <video> muet) ou rendu. Un flux jamais coupé n'est pas touché.
function reglerFlux(userId, entendre) {
  if (entendre && !coupes.has(userId)) return;
  if (entendre) coupes.delete(userId);
  else coupes.add(userId);
  for (const piste of fluxDe(userId)?.getTracks?.() ?? []) piste.enabled = entendre;
  try {
    const video = ui.webrtc?.getUserVideoElement?.(userId);
    if (video && !entendre) { video.muted = true; video.dataset.lakourCoupe = "1"; }
    else if (video?.dataset?.lakourCoupe) { video.muted = false; delete video.dataset.lakourCoupe; }
    ui.webrtc?.getUserCameraView?.(userId)?.classList?.toggle("lakour-coupe", !entendre);
  } catch { /* sans caméras affichées */ }
}

// Le voyant « parle » d'un flux coupé reste éteint (sinon un loup qui parle la nuit se trahirait).
function reglerVoyant() {
  const cam = ui.webrtc;
  if (!cam || typeof cam.setUserIsSpeaking !== "function") return;
  if (coupes.size && !rendreVoyantFn) {
    rendreVoyantFn = envelopper(cam, "setUserIsSpeaking", avant => function (userId, parle) { return avant.call(this, userId, parle && !coupes.has(userId)); });
  }
  for (const id of coupes) { try { cam.setUserIsSpeaking(id, false); } catch { /* caméra absente */ } }
  if (!coupes.size && rendreVoyantFn) { rendreVoyantFn(); rendreVoyantFn = null; }
}

// Son propre micro : coupé (toute intention de parler devient false : appuyer pour parler, détection de voix, « toujours »),
// puis rendu (en mode « toujours », le micro se rouvre de lui-même).
function couperMicro() {
  const w = game.webrtc;
  if (rendreMicroFn || !w?.client) return;
  const r1 = envelopper(w, "broadcast", avant => function () { return avant.call(this, false); });
  const r2 = envelopper(w.client, "toggleBroadcast", avant => function () { return avant.call(this, false); });
  rendreMicroFn = () => { r1(); r2(); };
  try { w.broadcast(false); } catch (e) { console.warn(`${ID} | micro`, e); }
}

function rendreMicro() {
  if (!rendreMicroFn) return;
  rendreMicroFn();
  rendreMicroFn = null;
  const w = game.webrtc;
  try { w.broadcast(w.settings?.client?.voice?.mode === "always"); } catch (e) { console.warn(`${ID} | micro`, e); }
}

export const microCoupe = () => Boolean(rendreMicroFn);
export const fluxCoupes = () => [...coupes];

// Tout rendre : fin de partie, salons coupés, A/V désactivé, départ du monde.
export function rendreTout() {
  for (const id of [...coupes]) reglerFlux(id, true);
  reglerVoyant();
  rendreMicro();
}

// Applique la ligne de ce navigateur à la voix de Foundry.
export function appliquerVoix() {
  if (!avActif()) return rendreTout();
  const ligne = maLigne;
  const libre = Boolean(game.user?.isGM) || !salonsAutomatiques() || !ligne || ["libre", "mj"].includes(ligne.salon);
  if (libre) return rendreTout();
  for (const u of game.users.filter(x => x.id !== game.user.id)) reglerFlux(u.id, ligne.entend.includes(u.id));
  reglerVoyant();
  if (ligne.peutParler) rendreMicro();
  else couperMicro();
}

// ------------------------------------------------------------------ le bandeau
const SALONS_AFFICHES = ["nuit", "taniere", "morts", "silence"];
export function salonAffiche() {
  if (game.user?.isGM || !salonsAutomatiques() || !avActif()) return null;
  const ligne = ligneAJour();
  if (!ligne || !SALONS_AFFICHES.includes(ligne.salon)) return null;
  return { cle: ligne.salon, texte: t(`LAKOUR_LOUPS.Bandeau.Salon.${ligne.salon}`), aide: t("LAKOUR_LOUPS.Bandeau.Salon.Aide") };
}

// ------------------------------------------------------------------ branchements (hook « init » du système)
export function brancherSalons() {
  // La phase change par lakourLoups.phase, et aussi par la victoire (phase « fin ») et l'aube.
  for (const nom of ["lakourLoups.phase", "lakourLoups.nouvellePartie", "lakourLoups.victoire", "lakourLoups.aube"]) {
    Hooks.on(nom, () => { rafraichirSalons({ forcer: true }); });
  }
  for (const nom of ["lakourLoups.elimination", "lakourLoups.jour", "lakourLoups.voteClos", "createActor", "deleteActor", "createUser", "deleteUser"]) {
    Hooks.on(nom, () => { rafraichirSalons(); });
  }
  Hooks.on("updateActor", acteur => { if (acteur?.type === "villageois") rafraichirSalons(); });
  Hooks.on("userConnected", (user, connecte) => {
    if (!user) return;
    if (connecte) envoyerLigne(user.id);
    else envoyees.delete(user.id);
  });
  // Les caméras sont rendues à nouveau à chaque flux reçu, chaque réglage A/V : la coupure locale est réappliquée.
  for (const nom of ["renderCameraViews", "renderCameraPopout", "rtcSettingsChanged"]) Hooks.on(nom, () => { appliquerVoix(); });
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => { try { rendreTout(); } catch { /* départ */ } });
  }
}
