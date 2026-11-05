// L'Almanach des brumes : à chaque aube, un présage tiré change la règle du jour (ou de la nuit qui suit). Logique pure.
//
// Variante, réglage monde « almanach » (faux par défaut), recopié à la distribution (etat.presage.actif). Public :
// etat.presage = { actif, cle, tour } — le présage tiré à l'aube du tour `tour` ; annoncé à tout le village (chat, Table).
// Jamais deux fois de suite le même. Effets, tous appliqués par la logique :
//   ciel-clair   : rien ne change ;
//   givre        : la nuit suivante, aucune protection ne tient (Garde, Gardienne, protections du narrateur, verrou du Forgeron) ;
//   crue         : la nuit suivante, le Pont est coupé (la meute ne chasse pas l'autre rive, comme Pont bloqué ou écluse) ;
//   foire        : vote à main levée : aujourd'hui, les voix sont publiques pendant le vote (vote.mainLevee) ;
//   brouillard   : aucune déclaration au Registre du greffier aujourd'hui ;
//   glas         : le vote d'exécution du jour désigne deux condamnés (comme la cloche du Sonneur ; ce jour-là seulement) ;
//   lune-rousse  : le vote d'exécution du jour exige la majorité absolue (comme le Gibet) ;
//   rumeur       : une nouvelle vraie et floue sur la nuit passée est criée (comme le Lavoir) ;
//   vent-du-nord : le vent emporte les silences : personne n'est réduit au silence aujourd'hui ;
//   sceau-brise  : la voix du Bailli ne compte pas double aujourd'hui (il tranche toujours les égalités).
// « Aujourd'hui » : le tour du présage (aube, débat, vote) ; « la nuit suivante » : la nuit n° tour + 1.
import { choisir } from "./hasard.mjs";
import { normaliserEtat } from "./etat.mjs";
import { indiceFlou } from "./jour.mjs";
import { elider } from "./grammaire.mjs";

export const PRESAGES = {
  "ciel-clair": { quand: "jour" },
  givre: { quand: "nuit" },
  crue: { quand: "nuit" },
  foire: { quand: "jour" },
  brouillard: { quand: "jour" },
  glas: { quand: "jour" },
  "lune-rousse": { quand: "jour" },
  rumeur: { quand: "jour" },
  "vent-du-nord": { quand: "jour" },
  "sceau-brise": { quand: "jour" }
};
export const CLES_PRESAGES = Object.keys(PRESAGES);

export const presageInitial = (actif = false) => ({ actif: Boolean(actif), cle: "", tour: 0 });

export function normaliserPresage(p) {
  const x = p && typeof p === "object" ? p : {};
  return { actif: Boolean(x.actif), cle: CLES_PRESAGES.includes(x.cle) ? x.cle : "", tour: Number(x.tour) || 0 };
}

// Le présage qui vaut pour le jour du tour `tour` ("" sans almanach, ou sans présage ce jour-là).
export function presageDuJour(etat, tour = etat?.tour) {
  const p = normaliserPresage(etat?.presage);
  return p.actif && p.cle && p.tour === tour ? p.cle : "";
}

// Le présage qui vaut pour la nuit n° `nuit` : celui tiré à l'aube précédente, s'il touche la nuit.
export function presageDeLaNuit(etat, nuit) {
  const p = normaliserPresage(etat?.presage);
  return p.actif && p.cle && p.tour === nuit - 1 && PRESAGES[p.cle].quand === "nuit" ? p.cle : "";
}

// Le présage de ce matin : au hasard, jamais le même que la veille.
export function tirerPresage(etat, hasard = Math.random) {
  const avant = normaliserPresage(etat?.presage).cle;
  return choisir(CLES_PRESAGES.filter(c => c !== avant), hasard);
}

const msg = (cle, texte, donnees = {}) => ({ destinataire: "public", cle: `LAKOUR_LOUPS.Almanach.${cle}`, texte, donnees });

// Le présage tiré à l'aube du tour courant, appliqué. villageois : APRÈS la nuit ; bilan : celui de la nuit (rumeur).
// -> { etat, cle, annonces: [msg], changements: [{ type: "silence", acteurId, valeur: false }] }
export function appliquerPresage(e, { cle, villageois = [], bilan = null, hasard = Math.random } = {}) {
  const etat = normaliserEtat(e);
  const sortie = { etat, cle: "", annonces: [], changements: [] };
  if (!etat.presage.actif || !PRESAGES[cle]) return sortie;
  etat.presage = { actif: true, cle, tour: etat.tour };
  sortie.cle = cle;
  sortie.annonces.push(msg("Annonce", `Almanach des brumes : ${cle}.`, { presage: cle }));
  if (cle === "rumeur") {
    const indice = indiceFlou({ bilan, villageois, hasard });
    sortie.annonces.push(msg("Rumeur", `La rumeur court ${elider("que", indice.texte)}`, { indice }));
  }
  if (cle === "vent-du-nord") {
    for (const v of villageois) if (v.vivant !== false && v.silence) sortie.changements.push({ type: "silence", acteurId: v.id, valeur: false });
  }
  return sortie;
}
