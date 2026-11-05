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
// Dans chaque navigateur, d'après sa ligne : sa voix (son et image) ne PART que vers ceux qui doivent l'entendre
// (ligne.auditeurs) — côté émetteur, RTCRtpSender#replaceTrack(null) vers les autres ; s'il ne peut pas trier, micro et
// caméra coupés à la source, pour tous (voir « côté émetteur » plus bas). En plus (défense en profondeur), les flux A/V
// des gens qu'on ne doit pas entendre sont coupés LOCALEMENT
// (pistes du flux distant désactivées, élément <video> muet, voyant « parle » éteint : rien ne trahit un loup qui parle la
// nuit), et son propre micro est coupé quand on doit se taire (AVMaster#broadcast et AVClient#toggleBroadcast enveloppés
// sur l'instance, toujours à false). Le voyant « parle » que Foundry diffuse à tous (User#broadcastActivity, av.speaking) et le
// curseur ne partent pas la nuit : scripts/activite.mjs. Aucun réglage A/V persistant n'est modifié (ni muted, ni volume) ; tout est rendu
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
  const pub = lirePublic();
  return {
    // souffle : ce mort garde-t-il son Dernier souffle (logique/souffle.mjs) ? Il n'entend alors rien de ce qui trahit les rôles.
    villageois: villageoisAPlat().map(v => ({ id: v.id, joueur: v.joueur, vivant: v.vivant, silence: v.silence, camp: v.camp,
      role: v.role ? { camp: v.role.camp } : null, souffle: L.aSonSouffle(pub, v) })),
    utilisateurs: game.users.map(u => ({ id: u.id, mj: Boolean(u.isGM) })),
    mortsVoientTout: Boolean(lire("mortsVoientTout", true)), souffleActif: Boolean(pub.souffle?.actif),
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
    tab.villageois.map(v => [v.id, v.joueur, v.vivant, v.silence, v.souffle]), tab.utilisateurs]);
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

// ------------------------------------------------------------------ côté émetteur : ma voix ne part que vers qui l'entend
// La coupure locale ci-dessus ne suffit pas : le flux d'un loup arriverait quand même chez un villageois, qui pourrait
// rallumer les pistes dans la console, ou mesurer le niveau de chaque flux pour savoir qui parle la nuit. Ici, c'est
// l'émetteur qui trie : vers un pair qui ne doit pas l'entendre (absent de ligne.auditeurs), chaque RTCRtpSender porte la
// piste null (RTCRtpSender#replaceTrack(null) : plus un paquet, sans renégociation), et la vraie piste vers les autres.
// Son et image : tous les émetteurs de la connexion.
//
// Lu dans le client v14 (client/av/clients/simplepeer.mjs) : `peers = new Map()` (userId -> pair SimplePeer) ;
// connectPeer fait `new SimplePeer({ stream: localStream })` puis aussitôt `peers.set(userId, peer)`, avant toute
// signalisation ; updateLocalStream (autre micro, autre caméra) fait `peer.removeStream(ancien)` puis `peer.addStream(neuf)`
// (dans SimplePeer : `_pc.removeTrack` / `_pc.addTrack`). Hypothèse restante (bibliothèque SimplePeer, non vérifiable sans
// A/V réel) : la RTCPeerConnection d'un pair est dans `_pc`. On accepte aussi `pc`, `peerConnection`, `connection`, ou un
// pair qui est lui-même une connexion (getSenders) ; sinon, repli. Recalcul : à
// chaque ligne reçue, chaque rendu des caméras, réglage A/V, connexion d'un joueur, pair ajouté (`peers.set` enveloppé sur
// l'instance : trié avant que la négociation ne parte), piste ajoutée ou retirée (`addTrack`, `addTransceiver`,
// `removeTrack` enveloppés sur la connexion), renégociation (`negotiationneeded`, `signalingstatechange`), et piste
// changée par Foundry ou SimplePeer (autre micro, autre caméra : `replaceTrack` enveloppé sur l'émetteur, qui note la vraie
// piste et n'envoie que null à qui ne doit pas l'entendre).
//
// Repli : si ce navigateur ne peut pas trier (pas de `peers`, pair sans connexion lisible, émetteur sans replaceTrack,
// replaceTrack(null) refusé…) alors que sa voix ne doit pas aller à tout le monde, son micro ET sa caméra sont coupés à la
// source (pistes du flux local éteintes, AVMaster#broadcast, AVClient#toggleBroadcast et #toggleVideo forcés à false),
// pour tous, avec un avertissement : mieux vaut une meute muette qu'une meute qui se trahit.
//
// Prudence : une ligne d'une autre phase que l'état public (la ligne de la nouvelle phase n'est pas encore arrivée), ou pas
// de ligne pendant une partie : ma voix ne part que vers les MJ.
const PHASES_LIBRES = ["preparation", "fin", ""];
const PROPRIETES_CONNEXION = ["_pc", "pc", "peerConnection", "connection"];

let autorises = null;              // null : tous ; sinon les userId qui peuvent recevoir ma voix
const connexions = new Map();      // RTCPeerConnection -> { userId, pc, emetteurs: Set, rendre: [fonctions], fautive }
const emetteurs = new WeakMap();   // RTCRtpSender -> { sender, c, vraie, envoyee, attente, avant, rendre }
let pairsEnveloppes = null;        // { pairs, rendre } : la Map des pairs dont set/delete sont enveloppés
let rendreSourceFn = null;
let averti = false;

// À qui ma voix peut-elle aller ? null : à tous (rien à trier).
function destinatairesVoix() {
  if (!avActif() || game.user?.isGM || !salonsAutomatiques()) return null;
  const phase = String(lirePublic().phase ?? "");
  const ligne = maLigne;
  if (ligne && ligne.phase === phase) return ["libre", "mj"].includes(ligne.salon) ? null : new Set((ligne.auditeurs ?? []).map(String));
  if (PHASES_LIBRES.includes(phase)) return null;
  return new Set(game.users.filter(u => u.isGM).map(u => u.id));
}
const autorise = userId => autorises === null || autorises.has(String(userId));

function connexionDe(pair) {
  if (!pair || typeof pair !== "object") return null;
  if (typeof pair.getSenders === "function") return pair;
  for (const p of PROPRIETES_CONNEXION) {
    try { const c = pair[p]; if (c && typeof c.getSenders === "function") return c; } catch { /* accesseur */ }
  }
  return null;
}
const fermee = pc => pc?.signalingState === "closed" || pc?.connectionState === "closed";
const pairsDe = client => { const p = client?.peers; return p && typeof p === "object" ? p : null; };
const entrees = pairs => (typeof pairs.entries === "function" ? [...pairs.entries()] : Object.entries(pairs));

// Envoie cette piste (ou null) sur cet émetteur, si ce n'est déjà fait. Un refus de couper rend la connexion « fautive » :
// repli à la source.
function envoyer(e, piste) {
  if (e.envoyee === piste) return;
  e.envoyee = piste;
  e.attente++;
  let p;
  try { p = e.avant.call(e.sender, piste); } catch (err) { p = Promise.reject(err); }
  Promise.resolve(p).catch(err => {
    if (piste !== null || fermee(e.c.pc)) return;
    console.warn(`${ID} | émetteur`, err);
    e.c.fautive = true;
    appliquerVoix();
  }).finally(() => { e.attente--; });
}

// Un émetteur : enveloppé (sa vraie piste notée, null vers qui ne doit pas l'entendre), puis réglé.
function garderEmetteur(sender, c) {
  if (!sender || typeof sender.replaceTrack !== "function") return null;
  let e = emetteurs.get(sender);
  if (!e) {
    const piste = sender.track ?? null;
    e = { sender, c, vraie: piste, envoyee: piste, attente: 0, avant: null, rendre: null };
    emetteurs.set(sender, e);
  }
  e.c = c;
  c.emetteurs.add(sender);
  if (!e.rendre) {
    e.rendre = envelopper(sender, "replaceTrack", avant => {
      e.avant = avant;
      return function (piste) {
        e.vraie = piste ?? null;
        const voulue = autorise(e.c.userId) ? e.vraie : null;
        e.envoyee = voulue;
        e.attente++;
        let p;
        try { p = avant.call(this, voulue); } catch (err) { p = Promise.reject(err); }
        return Promise.resolve(p).finally(() => { e.attente--; });
      };
    });
  }
  return e;
}

function reglerEmetteur(e) {
  const piste = e.sender.track ?? null;
  // Une piste posée sans passer par replaceTrack (addTrack qui reprend un émetteur, removeTrack natif) : c'est la vraie.
  if (!e.attente && piste !== e.envoyee) { e.vraie = piste; e.envoyee = piste; }
  envoyer(e, autorise(e.c.userId) ? e.vraie : null);
}

// Une connexion vers un pair : ses émetteurs gardés, ses ajouts de pistes et renégociations surveillés.
function garderConnexion(userId, pair) {
  const pc = connexionDe(pair);
  if (!pc) return null;
  let c = connexions.get(pc);
  if (c && c.userId !== userId) { oublierConnexion(pc); c = null; }
  if (c) return c;
  c = { userId, pc, emetteurs: new Set(), rendre: [], fautive: false };
  connexions.set(pc, c);
  const trier = s => { try { const e = garderEmetteur(s, c); if (e) reglerEmetteur(e); else { c.fautive = true; appliquerVoix(); } } catch (err) { console.warn(`${ID} | émetteur`, err); } };
  if (typeof pc.addTrack === "function") {
    c.rendre.push(envelopper(pc, "addTrack", avant => function (...args) { const s = avant.apply(this, args); trier(s); return s; }));
  }
  if (typeof pc.addTransceiver === "function") {
    c.rendre.push(envelopper(pc, "addTransceiver", avant => function (...args) { const t = avant.apply(this, args); trier(t?.sender); return t; }));
  }
  if (typeof pc.removeTrack === "function") {
    c.rendre.push(envelopper(pc, "removeTrack", avant => function (s, ...args) {
      const r = avant.call(this, s, ...args);
      const e = emetteurs.get(s);
      if (e && !e.attente) { e.vraie = null; e.envoyee = s?.track ?? null; }
      return r;
    }));
  }
  if (typeof pc.addEventListener === "function") {
    const relancer = () => { if (connexions.get(pc) === c && !reglerConnexion(c)) appliquerVoix(); };
    for (const nom of ["negotiationneeded", "signalingstatechange"]) pc.addEventListener(nom, relancer);
    c.rendre.push(() => { for (const nom of ["negotiationneeded", "signalingstatechange"]) pc.removeEventListener?.(nom, relancer); });
  }
  return c;
}

// -> vrai si chaque émetteur de cette connexion est trié.
function reglerConnexion(c) {
  if (fermee(c.pc)) return true;
  let liste;
  try { liste = c.pc.getSenders(); } catch { return false; }
  let ok = !c.fautive;
  for (const s of liste ?? []) {
    const e = garderEmetteur(s, c);
    if (e) reglerEmetteur(e);
    else ok = false;
  }
  return ok;
}

// Ne suit plus une connexion : enveloppes retirées (l'état des émetteurs reste noté, pour une coupure en cours). rendre :
// vraies pistes reposées (tout le monde peut m'entendre) ; sinon (pair parti, connexion abandonnée par le client A/V),
// ce qui était coupé le reste.
function oublierConnexion(pc, { rendre = false } = {}) {
  const c = connexions.get(pc);
  if (!c) return;
  connexions.delete(pc);
  for (const s of c.emetteurs) {
    const e = emetteurs.get(s);
    if (!e) continue;
    if (rendre && !fermee(pc)) envoyer(e, e.vraie);
    e.rendre?.();
    e.rendre = null;
  }
  for (const r of c.rendre) r();
}

function lacherPairs() {
  pairsEnveloppes?.rendre();
  pairsEnveloppes = null;
}

// Un pair ajouté ou retiré par le client A/V : trié aussitôt.
function brancherPairs(pairs) {
  if (pairsEnveloppes?.pairs === pairs) return;
  lacherPairs();
  if (typeof pairs.set !== "function") return;
  const r1 = envelopper(pairs, "set", avant => function (userId, pair) {
    const r = avant.call(this, userId, pair);
    try { const c = garderConnexion(String(userId), pair); if (!c || !reglerConnexion(c)) appliquerVoix(); } catch (err) { console.warn(`${ID} | émetteur`, err); }
    return r;
  });
  const r2 = typeof pairs.delete === "function"
    ? envelopper(pairs, "delete", avant => function (userId) {
      const pc = connexionDe(this.get?.(userId));
      const r = avant.call(this, userId);
      if (pc) oublierConnexion(pc);
      return r;
    })
    : () => {};
  pairsEnveloppes = { pairs, rendre: () => { r1(); r2(); } };
}

function lacherEmetteur() {
  autorises = null;
  for (const pc of [...connexions.keys()]) oublierConnexion(pc, { rendre: true });
  lacherPairs();
}

// Trie mes émetteurs d'après ma ligne. -> vrai si ma voix ne va qu'où elle doit (ou si elle peut aller partout), faux s'il
// faut le repli.
function appliquerEmetteur() {
  const qui = destinatairesVoix();
  if (qui === null) { lacherEmetteur(); return true; }
  autorises = qui;
  const pairs = pairsDe(game.webrtc?.client);
  let ok = Boolean(pairs);
  const vus = new Set();
  if (pairs) {
    brancherPairs(pairs);
    for (const [userId, pair] of entrees(pairs)) {
      const c = garderConnexion(String(userId), pair);
      if (!c) { ok = false; continue; }
      vus.add(c.pc);
      if (!reglerConnexion(c)) ok = false;
    }
  }
  for (const pc of [...connexions.keys()]) if (!vus.has(pc)) oublierConnexion(pc);
  if (ok) return true;
  // Rien à cacher si tous ceux qui sont là peuvent m'entendre.
  return !game.users.some(u => u.id !== game.user.id && u.active !== false && !qui.has(u.id));
}

// Le repli : micro et caméra éteints à la source, pour tous (le micro par couperMicro, à côté).
function couperSource() {
  const client = game.webrtc?.client;
  if (!rendreSourceFn) {
    const eteintes = new Set();
    const r = client && typeof client.toggleVideo === "function"
      ? envelopper(client, "toggleVideo", avant => function () { return avant.call(this, false); })
      : () => {};
    rendreSourceFn = () => {
      r();
      for (const p of eteintes) p.enabled = true;   // seulement les caméras que ce repli a éteintes
    };
    rendreSourceFn.eteintes = eteintes;
    if (!averti) {
      averti = true;
      // TODO clé de traduction (Salons, « Repli ») dans lang/fr.json et en.json : texte en dur en attendant.
      const texte = "Veillées : la voix de Foundry ne permet pas de choisir à qui partent ton micro et ta caméra. Pour ne rien trahir, ils sont coupés pour tous tant que ton salon est fermé.";
      try { ui.notifications?.warn?.(texte, { permanent: false }); } catch { /* sans interface */ }
      console.warn(`${ID} | ${texte}`);
    }
  }
  let local = null;
  try { local = client?.localStream ?? fluxDe(game.user.id); } catch { local = null; }
  // L'image seulement : le son, c'est couperMicro (AVClient#toggleBroadcast(false) éteint les pistes audio), qui le rendra
  // selon le mode de voix (rallumer ici ouvrirait le micro d'un « appuyer pour parler »).
  for (const piste of local?.getTracks?.() ?? []) {
    if (piste.kind === "audio" || !piste.enabled) continue;
    rendreSourceFn.eteintes.add(piste);
    piste.enabled = false;
  }
}

function rendreSource() {
  if (!rendreSourceFn) return;
  rendreSourceFn();
  rendreSourceFn = null;
  averti = false;
}

export const voixRepliee = () => Boolean(rendreSourceFn);
// Pour le débogage et les essais : à qui ma voix peut aller (null : tous), connexions triées, repli.
export const etatEmetteur = () => ({ autorises: autorises ? [...autorises].sort() : null, connexions: connexions.size, repli: voixRepliee() });

// Tout rendre : fin de partie, salons coupés, A/V désactivé, départ du monde.
export function rendreTout() {
  for (const id of [...coupes]) reglerFlux(id, true);
  reglerVoyant();
  lacherEmetteur();
  rendreSource();
  rendreMicro();
}

// Applique la ligne de ce navigateur à la voix de Foundry : côté émetteur d'abord (à qui part ma voix), puis la coupure
// locale (ce que j'entends), en plus.
export function appliquerVoix() {
  if (!avActif()) return rendreTout();
  const repli = !appliquerEmetteur();
  const ligne = maLigne;
  const libre = Boolean(game.user?.isGM) || !salonsAutomatiques() || !ligne || ["libre", "mj"].includes(ligne.salon);
  if (libre) {
    for (const id of [...coupes]) reglerFlux(id, true);
    reglerVoyant();
  } else {
    for (const u of game.users.filter(x => x.id !== game.user.id)) reglerFlux(u.id, ligne.entend.includes(u.id));
    reglerVoyant();
  }
  if (repli) {
    couperMicro();
    couperSource();
  } else {
    rendreSource();
    if (libre || ligne.peutParler) rendreMicro();
    else couperMicro();
  }
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
  // Chez un joueur, la phase publique peut changer avant que sa ligne n'arrive : sa voix est triée aussitôt (prudence).
  for (const nom of ["lakourLoups.phase", "lakourLoups.nouvellePartie", "lakourLoups.victoire", "lakourLoups.aube"]) {
    Hooks.on(nom, () => { if (!rafraichirSalons({ forcer: true })) appliquerVoix(); });
  }
  Hooks.on("lakourLoups.audibilite", () => { if (!estMJActif()) appliquerVoix(); });
  for (const nom of ["lakourLoups.elimination", "lakourLoups.jour", "lakourLoups.voteClos", "createActor", "deleteActor", "createUser", "deleteUser"]) {
    Hooks.on(nom, () => { rafraichirSalons(); });
  }
  Hooks.on("updateActor", acteur => { if (acteur?.type === "villageois") rafraichirSalons(); });
  Hooks.on("userConnected", (user, connecte) => {
    if (!user) return;
    if (connecte) envoyerLigne(user.id);
    else envoyees.delete(user.id);
    // Un pair qui arrive (ou repart) : mes émetteurs sont triés à nouveau.
    appliquerVoix();
  });
  // Les caméras sont rendues à nouveau à chaque flux reçu, chaque réglage A/V : la coupure locale est réappliquée.
  for (const nom of ["renderCameraViews", "renderCameraPopout", "rtcSettingsChanged"]) Hooks.on(nom, () => { appliquerVoix(); });
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => { try { rendreTout(); } catch { /* départ */ } });
  }
}
