// Équilibre des rôles de Brumecombe, pour composer des parties justes (générateur du système lakour-loups,
// logique/composition.mjs). Écrit dans assets/equilibre.json par outils/fabriquer-veillees.mjs.
// poids : ce que le rôle apporte à son camp, du point de vue du village (positif = aide le village, négatif = l'affaiblit).
//         Une partie équilibrée a une somme proche de 0 : chaque loup « coûte » autour de -6, chaque villageois rapporte +1.
// niveau : niveau minimal où le rôle peut sortir (debutants < classique < chaos) ; joueursMin : nombre minimal de joueurs ;
// unique : au plus un exemplaire (tous sauf le loup de base et le villageois) ; surDemande : jamais tiré par le générateur.
export const EQUILIBRE = {
  // --- Meute
  "loup-de-brumecombe": { camp: "meute", poids: -6, niveau: "debutants", joueursMin: 4, unique: false },
  "loup-deguise": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 8, unique: true },
  "loup-affame": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 10, unique: true },
  "louve-mere": { camp: "meute", poids: -9, niveau: "chaos", joueursMin: 10, unique: true },
  "loup-hurleur": { camp: "meute", poids: -7, niveau: "classique", joueursMin: 8, unique: true },
  "loup-flaireur": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 9, unique: true },
  "loup-des-roseaux": { camp: "meute", poids: -7, niveau: "classique", joueursMin: 10, unique: true },
  // --- Village : information
  "liseuse-de-cendres": { camp: "village", poids: 7, niveau: "debutants", joueursMin: 4, unique: true, information: true },
  "sourcier": { camp: "village", poids: 4, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "veilleuse-de-lanterne": { camp: "village", poids: 5, niveau: "classique", joueursMin: 7, unique: true, information: true },
  "fossoyeur": { camp: "village", poids: 3, niveau: "debutants", joueursMin: 7, unique: true, information: true },
  "ermite": { camp: "village", poids: 3, niveau: "classique", joueursMin: 9, unique: true, information: true },
  "enfant-de-la-brume": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true, information: true },
  // Le Louvetier voit juste chaque nuit, mais les visions le donnent pour un loup : un peu moins que la Liseuse.
  "louvetier": { camp: "village", poids: 4, niveau: "classique", joueursMin: 9, unique: true, information: true },
  // --- Village : protection et soin
  "garde-du-pont": { camp: "village", poids: 4, niveau: "debutants", joueursMin: 4, unique: true, protection: true },
  "gardienne-des-cles": { camp: "village", poids: 3, niveau: "classique", joueursMin: 9, unique: true, protection: true },
  "herboriste": { camp: "village", poids: 5, niveau: "debutants", joueursMin: 7, unique: true, protection: true },
  // --- Village : jour et vote
  "braconniere": { camp: "village", poids: 3, niveau: "debutants", joueursMin: 7, unique: true },
  "sonneur": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true },
  "juge-de-paix": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true },
  "conteuse": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true },
  "messager": { camp: "village", poids: 2, niveau: "classique", joueursMin: 9, unique: true },
  // Un seul harpon, qui peut tuer un voisin aussi bien qu'un loup, mais qui atteint les tueurs solitaires.
  "pecheur-de-nuit": { camp: "village", poids: 3, niveau: "classique", joueursMin: 9, unique: true },
  "entremetteuse": { camp: "village", poids: -1, niveau: "chaos", joueursMin: 8, unique: true },
  // Le Somnambule occupe une place de vision, mais ses visions mentent : il égare le village. La Rosière : une voix, mais
  // l'exécuter fait perdre le village. Rôles « sur demande » : jamais tirés d'office par le générateur, seulement choisis
  // par le narrateur (composition à la main, rôles imposés).
  "somnambule": { camp: "village", poids: -1, niveau: "chaos", joueursMin: 9, unique: true, surDemande: true },
  "rosiere": { camp: "village", poids: -1, niveau: "classique", joueursMin: 8, unique: true, surDemande: true },
  "villageois": { camp: "village", poids: 1, niveau: "debutants", joueursMin: 4, unique: false },
  // --- Solitaires
  "revenant": { camp: "solitaire", poids: -2, niveau: "classique", joueursMin: 9, unique: true },
  "chasseur-de-primes": { camp: "solitaire", poids: -2, niveau: "classique", joueursMin: 9, unique: true },
  "colporteur": { camp: "solitaire", poids: -1, niveau: "chaos", joueursMin: 8, unique: true },
  "pyromane": { camp: "solitaire", poids: -6, niveau: "chaos", joueursMin: 10, unique: true },
  // Ne tue qu'une nuit sur deux (le Pyromane peut tout embraser d'un coup), mais la meute ne peut pas la tuer.
  "dame-du-gue": { camp: "solitaire", poids: -5, niveau: "chaos", joueursMin: 10, unique: true }
};

// Bâtiments : niveau minimal (les plus perturbants attendent le niveau classique ou chaos).
export const EQUILIBRE_BATIMENTS = {
  chapelle: { niveau: "debutants" }, puits: { niveau: "debutants" }, moulin: { niveau: "debutants" }, lavoir: { niveau: "debutants" },
  taverne: { niveau: "classique" }, forge: { niveau: "classique" }, cimetiere: { niveau: "classique" }, pont: { niveau: "classique" },
  grange: { niveau: "classique" }, gibet: { niveau: "chaos" }
};
