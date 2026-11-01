// Cartes du module : plans en cases convertis en scènes v14 par le même convertisseur que l'outil creer_scene du
// MJ IA (modules/lakour-mj-ia/scripts/cartes.js), fonds dessinés plat et relief par le même rendu
// (cartes-rendu.js), plus un décor propre à la carte (toits, rivière, chemins, arbres, étiquettes, nuit) posé par-dessus.
// Écrit assets/cartes/<cle>.svg, assets/cartes/3d/<cle>.svg et assets/cartes/plans.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { planVersScene } from "../../lakour-mj-ia/scripts/cartes.js";
import { planVersSVG } from "../../lakour-mj-ia/scripts/cartes-rendu.js";
import { MODULE, STATS, identifiant } from "./aides.mjs";

export const TAILLE = 100;     // pixels par case
export const DISTANCE = 1.5;   // mètres par case (grille du système lakour-loups)

// Fond complet : rendu commun + décor (SVG inséré avant </svg>), pour un style "2d" ou "3d".
export function fondSVG(plan, style, decor) {
  const { erreurs, svg } = planVersSVG(plan, { taille: TAILLE, style });
  if (erreurs.length) return { erreurs };
  const ajout = decor ? decor(plan, { t: TAILLE, style }) : "";
  return { erreurs: [], svg: svg.replace(/<\/svg>$/, `${ajout}</svg>`) };
}

function ecrire(fichier, texte) {
  let actuel = null;
  try { actuel = readFileSync(fichier, "utf8"); } catch { /* pas encore écrit */ }
  if (actuel !== texte) writeFileSync(fichier, texte);
}

function ecrireFond(cle, plan, decor) {
  for (const style of ["2d", "3d"]) {
    const { erreurs, svg } = fondSVG(plan, style, decor);
    if (erreurs.length) throw new Error(`Fond de « ${cle} » (${style}) : ${erreurs.join(" ; ")}`);
    const dossier = new URL(style === "3d" ? "../assets/cartes/3d/" : "../assets/cartes/", import.meta.url);
    mkdirSync(dossier, { recursive: true });
    ecrire(new URL(`${cle}.svg`, dossier), svg);
  }
  return `modules/${MODULE}/assets/cartes/${cle}.svg`;
}

// Plans de toutes les cartes (assets/cartes/plans.json), écrits une fois après le chargement des cartes (microtâche).
const PLANS = {};
let ecriturePrevue = false;
function prevoirPlans() {
  if (ecriturePrevue) return;
  ecriturePrevue = true;
  queueMicrotask(() => {
    ecriturePrevue = false;
    const dossier = new URL("../assets/cartes/", import.meta.url);
    mkdirSync(dossier, { recursive: true });
    ecrire(new URL("plans.json", dossier), `${JSON.stringify(PLANS, null, 1)}\n`);
  });
}

// Un dessin exige un auteur : auteur fictif fixe, remplacé par le MJ à l'import (scripts/main.js).
export const AUTEUR_CARTES = identifiant("auteur-cartes");

// visionDesJetons : false = tout le monde voit tout le village (jeu de société), la pénombre reste une ambiance.
export function scene({ cle, nom, plan, description, decor, visionDesJetons = false, obscurite = null }) {
  const { erreurs, scene: s } = planVersScene(plan, { taille: TAILLE, distance: DISTANCE });
  if (erreurs.length) throw new Error(`Carte « ${nom} » : ${erreurs.join(" ; ")}`);
  s.levels[0].background.src = ecrireFond(cle, plan, decor);
  PLANS[cle] = plan;
  prevoirPlans();
  s.drawings = s.drawings.filter(d => d.hidden); // restent les étiquettes de pièces (MJ seulement)
  s.tokenVision = visionDesJetons;
  if (obscurite !== null) s.environment.darknessLevel = obscurite;
  const _id = identifiant(`scenes:${cle}`);
  const embarquer = (liste, collection) => liste.map((d, i) => {
    const eid = d._id ?? identifiant(`scenes:${cle}:${collection}:${i}`);
    return { ...d, _id: eid, _key: `!scenes.${collection}!${_id}.${eid}`, flags: {} };
  });
  return {
    __pack: "scenes", __cle: `scenes:${cle}`,
    _id, _key: `!scenes!${_id}`, name: nom, navName: nom, navigation: true, active: false,
    ...s,
    levels: embarquer(s.levels, "levels"), walls: embarquer(s.walls, "walls"),
    drawings: embarquer(s.drawings, "drawings").map(d => ({ ...d, author: AUTEUR_CARTES })), lights: embarquer(s.lights, "lights"),
    // Scène vivante : sons d'ambiance, épingles de journal et zones ; les comportements d'une zone sont embarqués
    // un niveau plus bas (clé « !scenes.regions.behaviors!scène.zone.comportement », comme les effets des objets d'acteurs).
    sounds: embarquer(s.sounds, "sounds"), notes: embarquer(s.notes, "notes"),
    regions: embarquer(s.regions, "regions").map(r => ({ ...r, behaviors: r.behaviors.map(b => ({ ...b, _key: `!scenes.regions.behaviors!${_id}.${r._id}.${b._id}` })) })),
    tokens: [], tiles: [],
    ownership: { default: 0 }, folder: null, sort: 0,
    flags: { [MODULE]: { cle, description, plan } }, _stats: STATS
  };
}
