// Compositions de partie toutes prêtes, de 6 à 18 joueurs, en trois niveaux, et de 4 à 12 places pour la « Petite tablée »
// (système 0.11.0 : peu d'humains, des compagnons IA ; celles-là sont tirées par le générateur du système, à graine fixe, pour
// être équilibrées comme les siennes). Une composition par niveau et par nombre de joueurs (joueurs: [n, n]) :
// sa liste de rôles en compte exactement n, complétée par des « villageois ».
// Écrites dans assets/compositions.json par outils/fabriquer-veillees.mjs (forme : docs/loups-contrat.md §2).
//
// Règles de dosage :
// - loups : 2 jusqu'à 8 joueurs, 3 jusqu'à 12, 4 jusqu'à 15, 5 au-delà ;
// - débutants : loups simples, pouvoirs faciles, aucun solitaire, la moitié du village sans pouvoir ;
// - classique : quelques loups spéciaux, un à deux solitaires, un quart de villageois sans pouvoir ;
// - chaos : loups spéciaux, jusqu'à trois solitaires, pouvoirs qui se croisent, peu de villageois.

import { composer as composerSysteme } from "../../../systems/lakour-loups/logique/composition.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS } from "./equilibre.mjs";

export const NIVEAUX = {
  debutants: {
    libelle: "Débutants",
    loupsSpeciaux: () => [],
    solitaires: () => [],
    village: ["liseuse-de-cendres", "garde-du-pont", "herboriste", "braconniere", "veilleuse-de-lanterne", "fossoyeur", "sonneur", "juge-de-paix"],
    villageois: v => Math.floor(v / 2),
    batiments: () => ["chapelle", "puits", "moulin", "lavoir"]
  },
  classique: {
    libelle: "Classique",
    loupsSpeciaux: n => (n >= 16 ? ["loup-affame", "loup-deguise", "loup-des-roseaux"] : n >= 14 ? ["loup-affame", "loup-des-roseaux"]
      : n >= 12 ? ["loup-affame"] : []),
    solitaires: n => ["revenant", "chasseur-de-primes"].slice(0, n >= 16 ? 2 : n >= 10 ? 1 : 0),
    // Le Louvetier dès 12 joueurs : une seconde vision au village, qui brouille la première.
    village: ["liseuse-de-cendres", "garde-du-pont", "herboriste", "braconniere", "veilleuse-de-lanterne", "louvetier", "entremetteuse",
      "fossoyeur", "sonneur", "juge-de-paix", "conteuse", "ermite"],
    villageois: v => Math.ceil(v / 4),
    batiments: n => (n >= 12 ? ["chapelle", "moulin", "taverne", "puits", "cimetiere", "gibet"] : ["chapelle", "moulin", "taverne", "puits", "cimetiere"])
  },
  chaos: {
    libelle: "Chaos",
    loupsSpeciaux: () => ["loup-hurleur", "louve-mere", "loup-affame", "loup-flaireur", "loup-deguise"],
    // Dès 15 joueurs, deux tueurs solitaires (Pyromane, Dame du gué) ; le Pêcheur de nuit, dès 12, peut les atteindre.
    solitaires: n => ["pyromane", "colporteur", "dame-du-gue", "revenant", "chasseur-de-primes"].slice(0, n >= 15 ? 3 : n >= 11 ? 2 : n >= 7 ? 1 : 0),
    village: ["liseuse-de-cendres", "herboriste", "enfant-de-la-brume", "entremetteuse", "messager", "pecheur-de-nuit", "gardienne-des-cles", "sourcier",
      "conteuse", "ermite", "sonneur", "juge-de-paix", "veilleuse-de-lanterne", "braconniere", "fossoyeur"],
    villageois: v => Math.floor(v / 5),
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
  const c = composerSysteme(n, { roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS }, { niveau: NIVEAU_PETITE_TABLEE, graine: `petite-tablee-${n}` });
  return { libelle: `Petite tablée — ${n} places`, joueurs: [n, n], niveau: NIVEAU_PETITE_TABLEE, roles: [...c.roles].sort(), batiments: c.batiments };
}

export function composer(niveau, n) {
  const N = NIVEAUX[niveau];
  if (!N) throw new Error(`Niveau inconnu : ${niveau}`);
  const loups = nombreDeLoups(n);
  const speciaux = N.loupsSpeciaux(n).slice(0, loups - 1); // toujours au moins un loup simple
  const meute = ["loup-de-brumecombe", ...speciaux, ...Array(loups - 1 - speciaux.length).fill("loup-de-brumecombe")];
  const solitaires = N.solitaires(n);
  const v = n - loups - solitaires.length;
  const pouvoirs = N.village.slice(0, Math.min(N.village.length, v - N.villageois(v)));
  const village = [...pouvoirs, ...Array(v - pouvoirs.length).fill("villageois")];
  return {
    libelle: `${N.libelle} — ${n} joueurs`,
    joueurs: [n, n],
    niveau,
    roles: [...meute, ...village, ...solitaires],
    batiments: N.batiments(n)
  };
}

// Toutes les compositions, clé « <niveau>-<n> » (ex. « classique-12 », « petite-tablee-07 »).
export function compositions() {
  const toutes = {};
  for (const niveau of Object.keys(NIVEAUX)) {
    for (let n = MIN_JOUEURS; n <= MAX_JOUEURS; n++) toutes[`${niveau}-${String(n).padStart(2, "0")}`] = composer(niveau, n);
  }
  for (let n = MIN_TABLEE; n <= MAX_TABLEE; n++) toutes[`${NIVEAU_PETITE_TABLEE}-${String(n).padStart(2, "0")}`] = composerTablee(n);
  return toutes;
}
