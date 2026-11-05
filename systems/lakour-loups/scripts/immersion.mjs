// L'immersion des Veillées, avec les nouveautés du canevas de Foundry v14, chez CHAQUE client, d'après les seuls hooks
// publics que le MJ actif diffuse à tous (scripts/canal.mjs, annoncer) :
// - une mort (lakourLoups.elimination) : un léger tremblement de l'écran, court et modéré
//   (foundry.canvas.animation.CanvasShakeEffect, client/canvas/animation/shake.mjs) ;
// - la tombée de la nuit (lakourLoups.phase « nuit ») : une brume nocturne discrète, sous les jetons
//   (foundry.canvas.animation.ParticleGenerator, client/canvas/animation/particle-generator.mjs), qui se dissipe d'elle-même
//   à toute autre phase ; le lever du jour (« aube ») : quelques lueurs dorées qui montent, puis s'effacent ;
// - la victoire (lakourLoups.victoire) : une envolée de lueurs à la couleur du camp vainqueur.
// Aucun secret : chez le MJ actif, ces hooks portent l'état complet et la vraie cause d'une mort, chez les joueurs leur
// version publique ; on n'en lit ici QUE le nom de la phase et le vainqueur (déjà annoncé à tous), jamais le mort, sa
// cause ni l'état. Rien n'est cliquable (conteneurs de particules sans événements, sous les jetons) ; rien ne bouge si le
// joueur a coupé le réglage client « Effets visuels », si son système demande moins de mouvement (prefers-reduced-motion)
// ou si le mode photosensible de Foundry est actif.
import { ID } from "../logique/constantes.mjs";
import { lirePublic } from "./donnees.mjs";

export const REGLAGE = "effetsVisuels";

// Le tremblement d'une mort : bref (une demi-seconde), quelques pixels, doux (bruit lissé, retour rapide).
export const SECOUSSE = Object.freeze({ duration: 500, maxDisplacement: 6, smoothness: 0.55, returnSpeed: 0.2, invalidateMasks: true });

// Les particules : des taches rondes et floues (texture dessinée ici), en mode « ambient » (densité constante dans la vue).
export const BRUME = Object.freeze({
  mode: "ambient", count: 200, initial: 0.5, viewPadding: 0.2, lifetime: [9000, 15000], fade: { in: 0.35, out: 0.35 },
  velocity: { x: [4, 14], y: [-3, 3] }, alpha: [0.05, 0.12], scale: [3, 6], tint: 0xc9d3e6, melange: "NORMAL"
});
export const AUBE = Object.freeze({
  mode: "ambient", count: 120, initial: 0.6, viewPadding: 0.1, lifetime: [2500, 4000], fade: { in: 0.3, out: 0.5 },
  velocity: { x: [-6, 6], y: [-28, -14] }, alpha: [0.15, 0.3], scale: [0.25, 0.6], tint: 0xffd9a0, melange: "SCREEN"
});
export const VICTOIRE = Object.freeze({
  mode: "ambient", count: 360, initial: 0.6, viewPadding: 0.1, lifetime: [3000, 5000], fade: { in: 0.2, out: 0.5 },
  velocity: { x: [-10, 10], y: [-55, -25] }, alpha: [0.25, 0.5], scale: [0.2, 0.55], tint: 0xf2c46b, melange: "SCREEN"
});
export const COULEURS_VICTOIRE = Object.freeze({ village: 0xf2c46b, meute: 0xd0553f, solitaire: 0xb7a6e8 });
// Combien de temps chaque effet passager fait naître des particules (ensuite, celles qui restent s'effacent seules).
export const DUREES = Object.freeze({ aube: 3000, victoire: 5000 });
const VIE_MAX = 15000;                 // la plus longue vie d'une particule : après, le générateur est détruit
const SOUS_LES_JETONS = 650;           // PrimaryCanvasGroup.SORT_LAYERS : DRAWINGS 600 < ici < TOKENS 700

let branche = null;
let brume = null;                      // le générateur de la brume nocturne, tant qu'il fait nuit
const passagers = new Set();           // aube, victoire, brumes qui se dissipent : détruits à la fin de leur vie
let texture = null;

// ------------------------------------------------------------------ ce qui est permis
export function mouvementReduit() {
  try { return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch { return false; }
}

export function effetsPermis() {
  let voulu = true;
  try { voulu = game.settings.get(ID, REGLAGE) !== false; } catch { /* réglage pas encore enregistré : par défaut */ }
  return voulu && !mouvementReduit() && !globalThis.canvas?.photosensitiveMode;
}

const canevasPret = () => Boolean(globalThis.canvas?.ready && canvas.scene && canvas.stage);
const animation = () => globalThis.foundry?.canvas?.animation ?? {};
function phaseCourante() {
  try { return lirePublic().phase ?? ""; } catch { return ""; }
}

// ------------------------------------------------------------------ les effets
// Une mort : l'écran tremble un instant. -> l'effet joué, ou null.
export function secouer() {
  const { CanvasShakeEffect } = animation();
  if (!CanvasShakeEffect || !effetsPermis() || !canevasPret()) return null;
  try {
    const secousse = new CanvasShakeEffect({ target: canvas.stage, ...SECOUSSE });
    secousse.play();
    return secousse;
  } catch (e) { console.warn(`${ID} | tremblement`, e); return null; }
}

// Une tache ronde aux bords fondus (dessinée une fois) ; sans document (ou sans 2D), le carré blanc de PIXI.
function textureDouce() {
  if (texture) return texture;
  try {
    const toile = document.createElement("canvas");
    toile.width = toile.height = 64;
    const c = toile.getContext("2d");
    const degrade = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    degrade.addColorStop(0, "rgba(255,255,255,1)");
    degrade.addColorStop(0.5, "rgba(255,255,255,0.45)");
    degrade.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = degrade;
    c.fillRect(0, 0, 64, 64);
    texture = PIXI.Texture.from(toile);
  } catch { texture = PIXI.Texture.WHITE; }
  return texture;
}

// Fait naître des particules (sous les jetons, sans événements). duree : au-delà, plus de nouvelles particules.
function lancer({ melange, ...config }, duree = 0) {
  const { ParticleGenerator } = animation();
  if (!ParticleGenerator || !effetsPermis() || !canevasPret()) return null;
  try {
    const generateur = new ParticleGenerator({
      ...config, container: canvas.primary, textures: [textureDouce()], particleAnchor: { x: 0.5, y: 0.5 },
      blend: globalThis.PIXI?.BLEND_MODES?.[melange] ?? 0
    });
    generateur.start();
    const conteneur = generateur.particlesContainer;
    if (conteneur && "sortLayer" in conteneur) conteneur.sortLayer = SOUS_LES_JETONS;
    if (duree) {
      passagers.add(generateur);
      setTimeout(() => eteindre(generateur), duree);
    }
    return generateur;
  } catch (e) { console.warn(`${ID} | particules`, e); return null; }
}

// Plus de nouvelles particules : les dernières s'effacent seules, puis le générateur est détruit.
function eteindre(generateur) {
  if (!generateur.particlesContainer) return;   // déjà détruit (changement de scène entre-temps)
  try { generateur.stop(); } catch { /* déjà détruit */ }
  passagers.add(generateur);
  setTimeout(() => detruire(generateur), VIE_MAX + 1000);
}
function detruire(generateur) {
  passagers.delete(generateur);
  try { generateur.stop({ hard: true }); } catch { /* déjà détruit */ }
}

export function allumerBrume() {
  if (!brume) brume = lancer(BRUME);
  return brume;
}

export function dissiperBrume() {
  if (!brume) return;
  const b = brume;
  brume = null;
  eteindre(b);
}

export const leverDuJour = () => lancer(AUBE, DUREES.aube);

// vainqueur : "village", "meute" ou l'id d'un solitaire (public : la victoire est annoncée à tous).
export function couleurDuVainqueur(vainqueur) {
  return COULEURS_VICTOIRE[vainqueur] ?? COULEURS_VICTOIRE.solitaire;
}
export function feterVictoire(vainqueur) {
  dissiperBrume();
  return lancer({ ...VICTOIRE, tint: couleurDuVainqueur(vainqueur) }, DUREES.victoire);
}

// Tout s'arrête net (scène démontée, réglage coupé).
export function toutEteindre() {
  if (brume) detruire(brume);
  brume = null;
  for (const g of [...passagers]) detruire(g);
}

// La phase publique qui commence : la brume tombe la nuit, se dissipe à toute autre phase ; l'aube a ses lueurs.
export function quandPhase(phase) {
  if (typeof phase !== "string") return;
  if (phase === "nuit") { allumerBrume(); return; }
  dissiperBrume();
  if (phase === "aube") leverDuJour();
}

// Le canevas (re)dessiné, ou le réglage changé : la brume suit la phase en cours, s'il fait nuit.
function suivreLaPhase() {
  if (!effetsPermis()) { toutEteindre(); return; }
  if (phaseCourante() === "nuit") allumerBrume();
}

export const etatImmersion = () => ({ brume: Boolean(brume), passagers: passagers.size });

export function oublierImmersion() {
  brume = null;
  passagers.clear();
  texture = null;
}

// ------------------------------------------------------------------ branchement (init)
export function brancherImmersion() {
  if (branche === Hooks) return;   // une fois par Hooks (les essais en recréent un par monde)
  branche = Hooks;
  oublierImmersion();
  game.settings.register(ID, REGLAGE, {
    name: "LAKOUR_LOUPS.Reglages.EffetsVisuels.Nom", hint: "LAKOUR_LOUPS.Reglages.EffetsVisuels.Aide",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => suivreLaPhase()
  });
  // Les hooks publics : on n'en lit que la phase et le vainqueur.
  Hooks.on("lakourLoups.phase", phase => quandPhase(phase));
  Hooks.on("lakourLoups.elimination", () => secouer());
  Hooks.on("lakourLoups.victoire", vainqueur => feterVictoire(vainqueur));
  // Les particules vivent dans le canevas : démontées avec lui, rallumées (la nuit) quand il revient.
  Hooks.on("canvasTearDown", () => toutEteindre());
  Hooks.on("canvasReady", () => suivreLaPhase());
}
