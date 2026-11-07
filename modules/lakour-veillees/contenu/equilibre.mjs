// Équilibre des rôles de Brumecombe, pour composer des parties justes (générateur du système lakour-loups,
// logique/composition.mjs). Écrit dans assets/equilibre.json par outils/fabriquer-veillees.mjs.
// poids : ce que le rôle apporte à son camp, du point de vue du village (positif = aide le village, négatif = l'affaiblit).
//         Le Loup de Brumecombe vaut -6 et le Villageois +1 (les deux références) ; une partie équilibrée a une somme proche de la
//         CIBLE de sa taille et de son niveau (CIBLES, plus bas). Le Pacte, étapes 6 et 6b : tous les poids sont MESURÉS par
//         simulation (essais/outils/calibrer-poids.mjs : régression logistique sur des milliers de parties, chaque niveau joué à son
//         adresse de référence — débutants 0,5, classique et Le Pacte 0,75, chaos 1 —, docs/equilibre-veillees.md) ; des poids
//         communs à tous les niveaux, l'écart entre les adresses passe par les cibles ; un rôle trop rare dans l'échantillon (moins
//         de 30 parties) garde son poids posé à la main.
// niveau : niveau minimal où le rôle peut sortir (debutants < classique < chaos) ; joueursMin : nombre minimal de joueurs ;
// unique : au plus un exemplaire (tous sauf le loup de base et le villageois) ; surDemande : jamais tiré par le générateur ;
// village : seulement avec la variante « Le Village » (Le Pacte, étape 4 : l'Incendiaire).
// groupe : n — des cartes qui vont toujours ensemble (les Lavandières par deux, les Bûcherons par trois) : le générateur les tire
//          toutes ou aucune ; le poids est celui d'UNE carte.
export const EQUILIBRE = {
  // --- Meute
  "loup-de-brumecombe": { camp: "meute", poids: -6, niveau: "debutants", joueursMin: 4, unique: false },
  "loup-deguise": { camp: "meute", poids: -9, niveau: "classique", joueursMin: 8, unique: true },
  "loup-affame": { camp: "meute", poids: -15, niveau: "classique", joueursMin: 10, unique: true },
  "louve-mere": { camp: "meute", poids: -13, niveau: "chaos", joueursMin: 10, unique: true },
  "loup-hurleur": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 8, unique: true },
  "loup-flaireur": { camp: "meute", poids: -7, niveau: "classique", joueursMin: 9, unique: true },
  "loup-des-roseaux": { camp: "meute", poids: -6, niveau: "classique", joueursMin: 10, unique: true },
  // Le Loup pâle (Le Pacte, étape 3b) : un loup qui dévore aussi les siens, une nuit sur deux.
  "loup-pale": { camp: "meute", poids: 0, niveau: "chaos", joueursMin: 12, unique: true },
  // --- Village : information
  "liseuse-de-cendres": { camp: "village", poids: 4, niveau: "debutants", joueursMin: 4, unique: true, information: true },
  "sourcier": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "veilleuse-de-lanterne": { camp: "village", poids: 4, niveau: "classique", joueursMin: 7, unique: true, information: true },
  "fossoyeur": { camp: "village", poids: 1, niveau: "debutants", joueursMin: 7, unique: true, information: true },
  "ermite": { camp: "village", poids: 2, niveau: "classique", joueursMin: 9, unique: true, information: true },
  "enfant-de-la-brume": { camp: "village", poids: 4, niveau: "classique", joueursMin: 8, unique: true, information: true },
  // Le Louvetier voit juste chaque nuit, mais les visions le donnent pour un loup : un peu moins que la Liseuse.
  "louvetier": { camp: "village", poids: 4, niveau: "classique", joueursMin: 9, unique: true, information: true },
  // --- Village : protection et soin
  "garde-du-pont": { camp: "village", poids: 4, niveau: "debutants", joueursMin: 4, unique: true, protection: true },
  "gardienne-des-cles": { camp: "village", poids: 3, niveau: "classique", joueursMin: 9, unique: true, protection: true },
  // (Le Pacte, étape 6 : dès 6 joueurs, et non 7 : à six, deux loups contre quatre, la meute gagnait 87 % des parties simulées ;
  // sans l'Herboriste, aucune composition de six n'atteignait sa cible.)
  "herboriste": { camp: "village", poids: 4, niveau: "debutants", joueursMin: 6, unique: true, protection: true },
  // --- Village : jour et vote
  "braconniere": { camp: "village", poids: 2, niveau: "debutants", joueursMin: 7, unique: true },
  "sonneur": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "juge-de-paix": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true },
  "conteuse": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "messager": { camp: "village", poids: 1, niveau: "classique", joueursMin: 9, unique: true },
  // Un seul harpon, qui peut tuer un voisin aussi bien qu'un loup, mais qui atteint les tueurs solitaires.
  "pecheur-de-nuit": { camp: "village", poids: 0, niveau: "classique", joueursMin: 9, unique: true },
  "entremetteuse": { camp: "village", poids: 0, niveau: "chaos", joueursMin: 8, unique: true },
  // Le Somnambule occupe une place de vision, mais ses visions mentent : il égare le village. La Rosière : une voix, mais
  // l'exécuter fait perdre le village. Rôles « sur demande » : jamais tirés d'office par le générateur, seulement choisis
  // par le narrateur (composition à la main, rôles imposés).
  "somnambule": { camp: "village", poids: -1, niveau: "chaos", joueursMin: 9, unique: true, surDemande: true },
  "rosiere": { camp: "village", poids: -1, niveau: "classique", joueursMin: 8, unique: true, surDemande: true },
  // Les gens de passage : jamais distribués, seulement donnés à un joueur qui arrive en cours de partie (camp tiré à part).
  "remouleur": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "montreur-d-ours": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "pelerine": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "villageois": { camp: "village", poids: 1, niveau: "debutants", joueursMin: 4, unique: false },
  // --- Village : les rôles du jeu de soirée (Le Pacte, étape 3a)
  "franc-villageois": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "aieul": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "souffre-douleur": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "innocent": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "lavandiere": { camp: "village", poids: 1, niveau: "classique", joueursMin: 9, unique: false, groupe: 2 },
  "bucheron": { camp: "village", poids: 1, niveau: "chaos", joueursMin: 12, unique: false, groupe: 3 },
  "furet": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "gardeuse-d-oies": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "greffier-begue": { camp: "village", poids: 2, niveau: "chaos", joueursMin: 9, unique: true },
  "vieux-sergent": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true },
  "pie": { camp: "village", poids: 0, niveau: "chaos", joueursMin: 9, unique: true },
  // --- Ambigus (Le Pacte, étape 3b). Le Chapardeur ajoute deux cartes Villageois au paquet (le centre) : elles ne comptent pas dans
  // l'équilibre (logique/composition.mjs ; la calibration compte les rôles distribués). Le Mâtin et l'Enfant des bois peuvent passer
  // à la meute : leur poids mesuré le compte.
  "chapardeur": { camp: "village", poids: 4, niveau: "chaos", joueursMin: 8, unique: true },
  "bateleur": { camp: "village", poids: 1, niveau: "chaos", joueursMin: 9, unique: true },
  "matin": { camp: "village", poids: -2, niveau: "chaos", joueursMin: 9, unique: true },
  "enfant-des-bois": { camp: "village", poids: -4, niveau: "classique", joueursMin: 8, unique: true },
  "chambriere": { camp: "village", poids: -2, niveau: "classique", joueursMin: 8, unique: true },
  // --- La Liseuse d'étoiles (Le Pacte, étape 9) : cinq questions au premier mort, au plus ; hors petite tablée.
  "liseuse-d-etoiles": { camp: "village", poids: 1, niveau: "classique", joueursMin: 8, unique: true, information: true },
  // --- La variante « Le Village » (Le Pacte, étape 4). village : le générateur ne tire l'Incendiaire que si la variante est choisie
  // (il n'aurait rien à brûler sans elle) ; jamais à la petite tablée.
  "incendiaire": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true, village: true },
  // --- Solitaires
  "revenant": { camp: "solitaire", poids: 1, niveau: "classique", joueursMin: 9, unique: true },
  "chasseur-de-primes": { camp: "solitaire", poids: 0, niveau: "classique", joueursMin: 9, unique: true },
  "colporteur": { camp: "solitaire", poids: -3, niveau: "chaos", joueursMin: 8, unique: true },
  "pyromane": { camp: "solitaire", poids: -5, niveau: "chaos", joueursMin: 10, unique: true },
  // Ne tue qu'une nuit sur deux (le Pyromane peut tout embraser d'un coup), mais la meute ne peut pas la tuer.
  "dame-du-gue": { camp: "solitaire", poids: -3, niveau: "chaos", joueursMin: 10, unique: true },
  // Les solitaires du jeu de soirée (Le Pacte, étape 3b). Le Feu follet gagne rarement, puis rejoint le Village (son jour d'ouverture
  // aide le village : un vote avant la première nuit).
  "feu-follet": { camp: "solitaire", poids: 1, niveau: "classique", joueursMin: 8, unique: true },
  "joueur-de-vielle": { camp: "solitaire", poids: 0, niveau: "chaos", joueursMin: 10, unique: true },
  "illumine": { camp: "solitaire", poids: -2, niveau: "chaos", joueursMin: 10, unique: true }
};

// Les CIBLES d'équilibre (Le Pacte, étapes 6, 6b et 6c) : pour chaque niveau et chaque taille, la somme des poids qui donne au village une
// chance sur deux contre la meute, à l'adresse de référence du niveau, mesurée par simulation (essais/outils/calibrer-poids.mjs,
// docs/equilibre-veillees.md) ; bornée à ce que le générateur atteint (le classique et Le Pacte à six joueurs, les débutants de 13 à 18
// joueurs : le village le plus armé que le générateur sache faire n'y suffit pas à 50 %). Étape 6c : les débutants ont un loup de
// moins (composition.mjs, nombreDeLoups) ; leurs cibles viennent de deux seconds passages (graines « 6c-val1 », « 6c-val2 ») ; le générateur
// (logique/composition.mjs, cibleDe) vise cette somme au lieu de 0. Écrites dans assets/equilibre.json (champ « cibles »). Sans
// cible pour un niveau, le générateur vise 0 (la petite tablée : cibleTablee). Le Pacte (novembre 2026) : la Liseuse de cendres est dans
// toute composition tirée du niveau (composition.mjs, ROLES_DU_NIVEAU) ; ses cibles viennent de deux seconds passages (graines
// « liseuse-val1 », « liseuse-val2 »).
// <cibles> (écrit par essais/outils/calibrer-poids.mjs)
export const CIBLES = {
  "chaos": { 6: 1, 7: 1, 8: -5, 9: -3, 10: -8, 11: -10, 12: -14, 13: -14, 14: -16, 15: -18, 16: -20, 17: -21, 18: -23 },
  "classique": { 6: 1, 7: 3, 8: -2, 9: 1, 10: 0, 11: -2, 12: -6, 13: -6, 14: -8, 15: -9, 16: -12, 17: -14, 18: -15 },
  "debutants": { 6: 4, 7: 3, 8: 3, 9: 5, 10: 5, 11: 5, 12: 7, 13: 2, 14: 3, 15: 4, 16: -2, 17: -1, 18: 0 },
  "le-pacte": { 6: 1, 7: 3, 8: 1, 9: 2, 10: 0, 11: -3, 12: -5, 13: -7, 14: -10, 15: -11, 16: -12, 17: -15, 18: -17 },
  "petite-tablee": { 4: 5, 5: 5, 6: 2, 7: 4, 8: 4, 9: 1, 10: 0, 11: 2, 12: 4 }
};
// </cibles>
// Les AJUSTEMENTS de cible des variantes (Le Pacte, étape 6) : ce qu'une variante du jeu de soirée, quand elle est choisie, ajoute à la
// cible (en poids ; positif : la variante aide la meute, le générateur arme davantage le village). Mesurés contre la partie ordinaire
// (essais/outils/simuler-veillees.mjs --variantes, docs/equilibre-veillees.md) ; seules les variantes franchement déséquilibrées en ont un.
// Écrits dans assets/equilibre.json (champ « ajustements ») ; le générateur les ajoute (cibleDe). Double visage fait sa propre
// composition : pas d'ajustement possible ; la Chaîne des innocents ne bouge pas avec la composition (un conseil de dosage, un ou deux
// loups de moins, dans les guides). Étape 6b (adresse 0,75) : l'Envoûtement passe de -7 à -12 (-17 points pour la meute à -7, -7 à
// -12) ; les Vendanges gardent +11 (+19 points pour la meute ; +16 n'y change rien : le générateur arme déjà le village au maximum).
export const AJUSTEMENTS = { vendanges: 11, envoutement: -12 };

// Bâtiments : niveau minimal (les plus perturbants attendent le niveau classique ou chaos).
export const EQUILIBRE_BATIMENTS = {
  chapelle: { niveau: "debutants" }, puits: { niveau: "debutants" }, moulin: { niveau: "debutants" }, lavoir: { niveau: "debutants" },
  taverne: { niveau: "classique" }, forge: { niveau: "classique" }, cimetiere: { niveau: "classique" }, pont: { niveau: "classique" },
  grange: { niveau: "classique" }, gibet: { niveau: "chaos" }
};
