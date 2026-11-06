// Le plateau verrouillé, chez le MJ actif : les jetons des villageois sur la scène du village, leur place à chaque phase,
// leur apparence publique et la lumière. Le calcul est dans la logique pure (logique/plateau.mjs) ; ici, on le joue.
//
// - À la distribution, chaque villageois (compagnons IA compris) reçoit un jeton sur la scène du village, devant sa maison,
//   verrouillé (TokenDocument.locked), avec l'image NEUTRE (jamais celle de son rôle tant qu'il n'est pas révélé).
// - À chaque phase (hook lakourLoups.phase), à chaque mort ou révélation (updateActor), le MJ actif remet la scène en
//   ordre : lumière, places (déplacements animés « walk » qui ignorent les murs, Scene#moveTokens), image, transparence et
//   statuts publics (mort, silence). Un mort est d'abord marqué sur place, puis va au cimetière.
// - Les joueurs ne déplacent pas les jetons : le verrou de Foundry (locked : ni glisser ni flèches), plus le refus de
//   preUpdateToken et de preMoveToken pour un non-MJ (dans le navigateur qui tente la modification). Le serveur laisse
//   un propriétaire modifier son jeton : un joueur qui contournerait son navigateur (console) le pourrait encore.
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif } from "./canal.mjs";
import { lireEtat, tousLesVillageois, villageoisAPlat, roleDe, roleRevele } from "./donnees.mjs";
import { ambiancePourPhase } from "./ambiance.mjs";

// ------------------------------------------------------------------ configuration (fournie par le module de contenu)
const config = {
  jetonNeutre: "",                 // image qui cache le rôle (le contenu des Veillées : son jeton « villageois »)
  styliser: src => src             // chemin selon le style visuel (plat / relief)
};
export function configurerPlateau({ jetonNeutre, styliser } = {}) {
  if (typeof jetonNeutre === "string" && jetonNeutre) config.jetonNeutre = jetonNeutre;
  if (typeof styliser === "function") config.styliser = styliser;
  planifierMiseEnScene();
}
export const imageNeutre = () => config.styliser(config.jetonNeutre || "icons/svg/mystery-man.svg");

// L'image publique du jeton d'un acteur : celle de son rôle s'il est révélé (ou à la fin), l'image neutre sinon.
// L'image d'un rôle révélé est celle de son objet PUBLIC (le document) : chez le MJ, la fiche secrète a pu changer depuis (échange du
// Colporteur) et le jeton, vu de tous, la trahirait. À la fin, le vrai rôle.
export function imageDuJeton(acteur, phase = lireEtat().phase) {
  const role = phase === "fin" ? roleDe(acteur) ?? roleRevele(acteur) : roleRevele(acteur);
  if (L.imageDuJeton({ revele: acteur?.system?.revele }, phase) === "role" && role?.img) return config.styliser(role.img);
  return imageNeutre();
}

// Délais (ms) : regroupement des demandes, temps où un mort reste marqué sur place, attente maximale d'une animation.
export const delais = { regroupement: 250, marque: 1600, animation: 9000, lumiere: 4000 };
export function reglerDelais(d = {}) { Object.assign(delais, d); }

// Apparence publique d'un jeton de villageois.
export const APPARENCE = { vivant: { alpha: 1, tint: "#ffffff" }, mort: { alpha: 0.6, tint: "#8f8a84" } };

// ------------------------------------------------------------------ la scène du village
// Le plan d'une scène : le drapeau « plan » d'un module de contenu (lakour-veillees : flags["lakour-veillees"].plan).
export function planDeScene(scene) {
  for (const v of Object.values(scene?.flags ?? {})) if (Array.isArray(v?.plan?.elements)) return v.plan;
  return null;
}
const aDesMaisons = scene => Boolean(planDeScene(scene)?.elements.some(e => /^Maison \d+$/.test(e.nom)));

// La scène du village : l'active si c'en est une, sinon la première qui a des maisons.
export function sceneDuVillage() {
  const scenes = game.scenes;
  if (!scenes) return null;
  if (scenes.active && aDesMaisons(scenes.active)) return scenes.active;
  return scenes.find(aDesMaisons) ?? null;
}

const grilleDe = scene => ({ size: scene.grid?.size ?? 100, sceneX: scene.dimensions?.sceneX ?? 0, sceneY: scene.dimensions?.sceneY ?? 0 });
const estJetonDeVillageois = doc => {
  const a = doc?.actor ?? game.actors?.get(doc?.actorId);
  return a?.type === "villageois";
};

// ------------------------------------------------------------------ verrou (tous les navigateurs)
export function refuserSiJoueur(doc, changements) {
  return L.modificationPermise({ mj: game.user.isGM, villageois: estJetonDeVillageois(doc), changements: changements ?? {} }) ? undefined : false;
}
export function refuserMouvement(doc) {
  return game.user.isGM || !estJetonDeVillageois(doc) ? undefined : false;
}

// ------------------------------------------------------------------ mise en scène (MJ actif)
let file = Promise.resolve();
let prevue = false;
let activerAuProchain = false;
const vusVivants = new Map();      // acteurId -> vivant à la dernière mise en scène (pour marquer un mort sur place)
const attendre = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

// Demande une mise en scène (regroupée : plusieurs demandes rapprochées n'en font qu'une). Chez le MJ actif seulement.
export function planifierMiseEnScene({ activer = false } = {}) {
  if (!estMJActif()) return file;
  activerAuProchain ||= activer;
  if (prevue) return file;
  prevue = true;
  file = file.then(async () => {
    if (delais.regroupement) await attendre(delais.regroupement);
    prevue = false;
    const activerIci = activerAuProchain;
    activerAuProchain = false;
    await mettreEnScene({ activer: activerIci });
  }).catch(e => { prevue = false; console.warn(`${ID} | mise en scène`, e); });
  return file;
}

// Attend que la scène soit en ordre (toutes les mises en scène demandées sont jouées).
export async function attendreMiseEnScene() {
  for (let i = 0; i < 50; i++) {
    const f = file;
    await f;
    if (f === file && !prevue) return;
  }
}

// Ce que la mise en scène veut pour la phase en cours (positions en pixels, image, apparence) ; sans Foundry au-delà des
// documents. -> { scene, plan, jetons: Map(acteurId -> { x, y, ou, src, alpha, tint, mort, silence }), obscurite } | null
export function voulu(scene = sceneDuVillage()) {
  if (!scene) return null;
  const plateau = L.lirePlateau(planDeScene(scene));
  if (!plateau) return null;
  const etat = lireEtat();
  // Les partis (départ, exil : logique/passage.mjs) quittent le plateau : ni place, ni jeton.
  const partis = new Set((etat.partis ?? []).map(p => p.acteurId));
  // Le cercle de la place suit l'ordre des places de la partie (etat.cercle, logique/cercle.mjs).
  const plan = L.miseEnScene({ plateau, phase: etat.phase, villageois: villageoisAPlat().filter(v => !partis.has(v.id)), morts: etat.morts, cercle: etat.cercle });
  const g = grilleDe(scene);
  const jetons = new Map();
  for (const j of plan.jetons) {
    const acteur = game.actors.get(j.id);
    const px = j.x === null ? null : L.versPixels(j, g);
    jetons.set(j.id, { ...(px ?? { x: null, y: null }), ou: j.ou, src: imageDuJeton(acteur, etat.phase), ...(j.mort ? APPARENCE.mort : APPARENCE.vivant),
      mort: j.mort, silence: j.silence });
  }
  return { scene, plateau, jetons, obscurite: plan.obscurite, phase: etat.phase };
}

// Un jeton par villageois sur la scène du village : crée ceux qui manquent (à leur place), retire les doublons, les jetons
// d'acteurs disparus et ceux des partis (départ, exil). Les autres jetons (figurants) ne sont pas touchés.
async function assurerJetons(scene, cible) {
  const parActeur = new Map();
  const aRetirer = [];
  const partis = new Set((lireEtat().partis ?? []).map(p => p.acteurId));
  for (const t of scene.tokens.contents ?? [...scene.tokens.values()]) {
    const acteur = game.actors.get(t.actorId);
    if (!acteur) { if (t.actorId) aRetirer.push(t.id); continue; }
    if (acteur.type !== "villageois") continue;
    if (parActeur.has(acteur.id) || partis.has(acteur.id)) aRetirer.push(t.id);
    else parActeur.set(acteur.id, t);
  }
  if (aRetirer.length) await scene.deleteEmbeddedDocuments("Token", aRetirer);
  const nouveaux = [];
  const g = grilleDe(scene);
  for (const acteur of tousLesVillageois()) {
    if (parActeur.has(acteur.id) || partis.has(acteur.id)) continue;
    const v = cible.jetons.get(acteur.id);
    const pos = v?.x !== null && v?.x !== undefined ? { x: v.x, y: v.y }
      : L.versPixels({ x: (cible.plateau.cercle?.x ?? 1), y: (cible.plateau.cercle?.y ?? 1) }, g);
    const donnees = {
      ...pos, name: acteur.name, actorLink: true, locked: true, level: scene.initialLevel?.id,
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, displayName: CONST.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50,
      displayBars: CONST.TOKEN_DISPLAY_MODES?.NONE ?? 0, lockRotation: true, width: 1, height: 1,
      texture: { src: v?.src ?? imageNeutre(), tint: v?.tint ?? "#ffffff" }, alpha: v?.alpha ?? 1
    };
    const doc = typeof acteur.getTokenDocument === "function" ? await acteur.getTokenDocument(donnees) : null;
    nouveaux.push(doc ? doc.toObject() : { ...donnees, actorId: acteur.id });
  }
  if (nouveaux.length) await scene.createEmbeddedDocuments("Token", nouveaux);
}

const jetonDe = (scene, acteurId) => (scene.tokens.contents ?? [...scene.tokens.values()]).find(t => t.actorId === acteurId) ?? null;

// Les statuts publics de l'acteur : mort (surimpression du crâne) et réduit au silence.
async function statuts(acteur, { mort, silence }) {
  if (typeof acteur.toggleStatusEffect !== "function") return;
  const a = acteur.statuses ?? new Set();
  try {
    if (a.has("dead") !== mort) await acteur.toggleStatusEffect("dead", { active: mort, overlay: true });
    if (a.has("silence") !== silence) await acteur.toggleStatusEffect("silence", { active: silence });
  } catch (e) { console.warn(`${ID} | statuts de ${acteur.name}`, e); }
}

// Déplace des jetons : marche animée, sans s'arrêter aux murs (le bord de la carte en a), sans règle ni rotation.
async function deplacer(scene, mouvements) {
  if (!mouvements.length) return;
  if (typeof scene.moveTokens === "function") {
    const instructions = {};
    for (const m of mouvements) {
      instructions[m.id] = { destination: { x: m.x, y: m.y, action: "walk" }, constrainOptions: { ignoreWalls: true, ignoreCost: true }, autoRotate: false, showRuler: false };
    }
    const fin = scene.moveTokens(instructions, { method: "api", pan: false, animation: { movementSpeed: 8 }, lakourLoups: true });
    await Promise.race([fin, attendre(delais.animation)]);
  } else {
    await scene.updateEmbeddedDocuments("Token", mouvements.map(m => ({ _id: m.id, x: m.x, y: m.y })), { animate: true, lakourLoups: true });
  }
}

// Remet la scène du village en ordre pour la phase en cours (MJ actif). activer : active la scène si ce n'est pas elle.
export async function mettreEnScene({ activer = false } = {}) {
  if (!estMJActif()) return null;
  const etat = lireEtat();
  if (!etat.partie) return null;          // pas de partie : rien à mettre en scène
  const scene = sceneDuVillage();
  if (!scene) return null;
  if (activer && !scene.active && typeof scene.activate === "function") await scene.activate();
  let cible = voulu(scene);
  if (!cible) return null;
  await assurerJetons(scene, cible);
  cible = voulu(scene);

  // Apparence (image, transparence, teinte, verrou) et statuts publics, tout de suite.
  const majs = [];
  for (const acteur of tousLesVillageois()) {
    const t = jetonDe(scene, acteur.id), v = cible.jetons.get(acteur.id);
    if (!t || !v) continue;
    const m = { _id: t.id };
    if (t.texture?.src !== v.src) m["texture.src"] = v.src;
    if (String(t.texture?.tint ?? "#ffffff").toLowerCase() !== v.tint) m["texture.tint"] = v.tint;
    if (t.alpha !== v.alpha) m.alpha = v.alpha;
    if (t.locked !== true) m.locked = true;
    if (Object.keys(m).length > 1) majs.push(m);
    await statuts(acteur, v);
  }
  if (majs.length) await scene.updateEmbeddedDocuments("Token", majs, { lakourLoups: true });

  // Lumière.
  const obscurite = scene.environment?.darknessLevel;
  if (!scene.environment?.darknessLock && Math.abs((obscurite ?? 0) - cible.obscurite) > 0.005) {
    await scene.update({ "environment.darknessLevel": cible.obscurite }, { animateDarkness: delais.lumiere });
  }

  // Places : les vivants d'abord ; un mort tout juste tombé reste marqué sur place un instant, puis va au cimetière.
  const bouger = (filtre = () => true) => tousLesVillageois().filter(filtre).map(acteur => {
    const t = jetonDe(scene, acteur.id), v = cible.jetons.get(acteur.id);
    if (!t || !v || v.x === null || (Math.abs(t.x - v.x) < 1 && Math.abs(t.y - v.y) < 1)) return null;
    return { id: t.id, x: v.x, y: v.y };
  }).filter(Boolean);
  const nouveauxMorts = tousLesVillageois().filter(a => !a.system.vivant && vusVivants.get(a.id) === true).map(a => a.id);
  await deplacer(scene, bouger(a => !nouveauxMorts.includes(a.id)));
  if (nouveauxMorts.length) {
    if (delais.marque) await attendre(delais.marque);
    await deplacer(scene, bouger(a => nouveauxMorts.includes(a.id)));
  }
  vusVivants.clear();
  for (const a of tousLesVillageois()) vusVivants.set(a.id, Boolean(a.system.vivant));
  return cible;
}

// ------------------------------------------------------------------ branchement (hooks)
let branche = null;
export function brancherPlateau() {
  if (branche === Hooks) return;   // une fois par Hooks (les essais en recréent un par monde)
  branche = Hooks;
  // Verrou : dans le navigateur qui tente de déplacer ou de retoucher un jeton de villageois.
  Hooks.on("preUpdateToken", (doc, changements) => refuserSiJoueur(doc, changements));
  Hooks.on("preMoveToken", doc => refuserMouvement(doc));
  // Mise en scène chez le MJ actif : à chaque phase, à chaque mort, révélation, silence ou changement de maison.
  Hooks.on("lakourLoups.phase", phase => {
    planifierMiseEnScene({ activer: true });
    ambiancePourPhase(phase);   // nuit, tension du vote : les sons du MJ IA s'il est actif (sinon rien)
  });
  // La victoire passe en phase « fin » sans hook de phase : tous les rôles se révèlent sur les jetons.
  Hooks.on("lakourLoups.victoire", () => { planifierMiseEnScene(); ambiancePourPhase("fin"); });
  Hooks.on("updateActor", (acteur, changements) => {
    if (acteur?.type !== "villageois") return;
    const s = changements?.system;
    if (!changements || !s || ["vivant", "revele", "silence", "maison"].some(k => k in s) || "name" in changements) planifierMiseEnScene();
  });
  Hooks.on("createItem", item => { if (item.parent?.type === "villageois" && item.type === "role" && item.parent.system.revele) planifierMiseEnScene(); });
}

export function oublierPlateau() {
  vusVivants.clear();
  file = Promise.resolve();
  prevue = false;
  activerAuProchain = false;
}
