// Compositions de partie toutes prêtes, de 6 à 18 joueurs, en quatre niveaux (débutants, classique, chaos, Le Pacte), et de 4 à 12
// places pour la « Petite tablée » (système 0.11.0 : peu d'humains, des compagnons IA). Une composition par niveau et par nombre de
// joueurs (joueurs: [n, n]) : sa liste de rôles en compte exactement n, complétée par des « villageois ».
// Écrites dans assets/compositions.json par outils/fabriquer-veillees.mjs (forme : docs/loups-contrat.md §2).
//
// Le Pacte, étape 6 : TOUTES sont tirées par le générateur du système (logique/composition.mjs, composer), à graine fixe
// (« <niveau>-<n> »), sur l'équilibre calibré par simulation (equilibre.mjs : poids et cibles, docs/equilibre-veillees.md) : une
// composition prête vaut une composition générée. Les règles de dosage sont celles du générateur (loups : 2 jusqu'à 8 joueurs, 3
// jusqu'à 12, 4 jusqu'à 15, 5 au-delà ; débutants : loups simples, aucun solitaire ; classique : un loup à pouvoir et un solitaire au
// plus ; chaos : un ou deux de chaque ; Le Pacte : les rôles du jeu de soirée, au dosage classique). Les choix de chaque niveau sont
// gardés : ses bâtiments (NIVEAUX[niveau].batiments, ci-dessous ; Le Pacte et la petite tablée : ceux du générateur, aucun pour Le Pacte),
// et les métiers (distribués à tous par la Table de jeu, sauf au Pacte).

import { composer as composerSysteme } from "../../../systems/lakour-loups/logique/composition.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS, CIBLES, AJUSTEMENTS } from "./equilibre.mjs";

// L'équilibre complet du contenu (celui d'assets/equilibre.json) : poids, bâtiments, cibles.
export const EQUILIBRE_COMPLET = { roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS, cibles: CIBLES, ajustements: AJUSTEMENTS };

// Les bâtiments de chaque niveau, choisis à la main : les plus faciles pour débutants, le Gibet dès 12 joueurs en classique, le Pont et
// la Grange en chaos.
export const NIVEAUX = {
  debutants: { libelle: "Débutants", batiments: () => ["chapelle", "puits", "moulin", "lavoir"] },
  classique: {
    libelle: "Classique",
    batiments: n => (n >= 12 ? ["chapelle", "moulin", "taverne", "puits", "cimetiere", "gibet"] : ["chapelle", "moulin", "taverne", "puits", "cimetiere"])
  },
  chaos: {
    libelle: "Chaos",
    batiments: n => (n >= 12 ? ["taverne", "gibet", "pont", "forge", "grange", "lavoir"] : ["taverne", "pont", "forge", "grange", "lavoir"])
  }
};

export const MIN_JOUEURS = 6;
export const MAX_JOUEURS = 18;
export const nombreDeLoups = n => (n <= 8 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5);

// La Petite tablée (niveau « petite-tablee », systems/lakour-loups/logique/tablee.mjs) : 4 à 12 places, meute courte (1 loup
// jusqu'à 7 places, 2 jusqu'à 10, 3 au-delà), au moins deux rôles de l'ombre dès 6 places (le Colporteur ; quatre à 11 et 12),
// une lanterne (deux dès 8), une protection dès 6, un simple villageois au plus (dès six places), ni Loup déguisé ni tueur solitaire, ni
// Gibet ni Pont, à la cible d'équilibre du mode. Tirée par le générateur du système lui-même (composer, niveau petite-tablee), à
// graine fixe : la composition prête vaut une composition générée.
export const NIVEAU_PETITE_TABLEE = "petite-tablee";
export const MIN_TABLEE = 4;
export const MAX_TABLEE = 12;
export const nombreDeLoupsTablee = n => (n <= 7 ? 1 : n <= 10 ? 2 : 3);

export function composerTablee(n) {
  if (n < MIN_TABLEE || n > MAX_TABLEE) throw new Error(`Une petite tablée compte de ${MIN_TABLEE} à ${MAX_TABLEE} places (${n}).`);
  const c = composerSysteme(n, EQUILIBRE_COMPLET, { niveau: NIVEAU_PETITE_TABLEE, graine: `petite-tablee-${n}` });
  return { libelle: `Petite tablée — ${n} places`, joueurs: [n, n], niveau: NIVEAU_PETITE_TABLEE, roles: [...c.roles].sort(), batiments: c.batiments };
}

// Le mode « Le Pacte » (système, logique/composition.mjs, niveau « le-pacte », Le Pacte étape 5) : seulement les rôles du jeu de
// soirée (ROLES_DU_LIVRE), au dosage du niveau classique, sans aucun de nos bâtiments communaux ; tiré par le générateur du système à
// graine fixe, comme les autres.
export const NIVEAU_LE_PACTE = "le-pacte";
export function composerLePacte(n) {
  if (n < MIN_JOUEURS || n > MAX_JOUEURS) throw new Error(`Le Pacte compte de ${MIN_JOUEURS} à ${MAX_JOUEURS} joueurs (${n}).`);
  const c = composerSysteme(n, EQUILIBRE_COMPLET, { niveau: NIVEAU_LE_PACTE, graine: `le-pacte-${n}` });
  return { libelle: `Le Pacte — ${n} joueurs`, joueurs: [n, n], niveau: NIVEAU_LE_PACTE, roles: [...c.roles].sort(), batiments: c.batiments };
}

// Débutants, classique, chaos : le générateur du système à graine fixe, les bâtiments du niveau.
export function composer(niveau, n) {
  const N = NIVEAUX[niveau];
  if (!N) throw new Error(`Niveau inconnu : ${niveau}`);
  if (n < MIN_JOUEURS || n > MAX_JOUEURS) throw new Error(`De ${MIN_JOUEURS} à ${MAX_JOUEURS} joueurs (${n}).`);
  const c = composerSysteme(n, EQUILIBRE_COMPLET, { niveau, graine: `${niveau}-${n}` });
  return { libelle: `${N.libelle} — ${n} joueurs`, joueurs: [n, n], niveau, roles: [...c.roles].sort(), batiments: N.batiments(n) };
}

// Toutes les compositions, clé « <niveau>-<n> » (ex. « classique-12 », « le-pacte-09 », « petite-tablee-07 »).
export function compositions() {
  const toutes = {};
  for (const niveau of Object.keys(NIVEAUX)) {
    for (let n = MIN_JOUEURS; n <= MAX_JOUEURS; n++) toutes[`${niveau}-${String(n).padStart(2, "0")}`] = composer(niveau, n);
  }
  for (let n = MIN_JOUEURS; n <= MAX_JOUEURS; n++) toutes[`${NIVEAU_LE_PACTE}-${String(n).padStart(2, "0")}`] = composerLePacte(n);
  for (let n = MIN_TABLEE; n <= MAX_TABLEE; n++) toutes[`${NIVEAU_PETITE_TABLEE}-${String(n).padStart(2, "0")}`] = composerTablee(n);
  return toutes;
}
