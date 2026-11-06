// Équilibre des rôles de Brumecombe, pour composer des parties justes (générateur du système lakour-loups,
// logique/composition.mjs). Écrit dans assets/equilibre.json par outils/fabriquer-veillees.mjs.
// poids : ce que le rôle apporte à son camp, du point de vue du village (positif = aide le village, négatif = l'affaiblit).
//         Une partie équilibrée a une somme proche de 0 : chaque loup « coûte » autour de -6, chaque villageois rapporte +1.
// niveau : niveau minimal où le rôle peut sortir (debutants < classique < chaos) ; joueursMin : nombre minimal de joueurs ;
// unique : au plus un exemplaire (tous sauf le loup de base et le villageois) ; surDemande : jamais tiré par le générateur ;
// village : seulement avec la variante « Le Village » (Le Pacte, étape 4 : l'Incendiaire).
// groupe : n — des cartes qui vont toujours ensemble (les Lavandières par deux, les Bûcherons par trois) : le générateur les tire
//          toutes ou aucune ; le poids est celui d'UNE carte.
// Le Pacte, étape 3a : les poids des rôles du Village du jeu de soirée sont PROVISOIRES (posés à la main) ; l'étape 6 les calibrera
// par simulation et les fera entrer dans les compositions prêtes.
export const EQUILIBRE = {
  // --- Meute
  "loup-de-brumecombe": { camp: "meute", poids: -6, niveau: "debutants", joueursMin: 4, unique: false },
  "loup-deguise": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 8, unique: true },
  "loup-affame": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 10, unique: true },
  "louve-mere": { camp: "meute", poids: -9, niveau: "chaos", joueursMin: 10, unique: true },
  "loup-hurleur": { camp: "meute", poids: -7, niveau: "classique", joueursMin: 8, unique: true },
  "loup-flaireur": { camp: "meute", poids: -8, niveau: "classique", joueursMin: 9, unique: true },
  "loup-des-roseaux": { camp: "meute", poids: -7, niveau: "classique", joueursMin: 10, unique: true },
  // Le Loup pâle (Le Pacte, étape 3b ; poids provisoire) : un loup qui dévore aussi les siens, une nuit sur deux.
  "loup-pale": { camp: "meute", poids: -5, niveau: "chaos", joueursMin: 12, unique: true },
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
  // Les gens de passage : jamais distribués, seulement donnés à un joueur qui arrive en cours de partie (camp tiré à part).
  "remouleur": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "montreur-d-ours": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "pelerine": { camp: "village", poids: 0, niveau: "debutants", joueursMin: 4, unique: true, surDemande: true },
  "villageois": { camp: "village", poids: 1, niveau: "debutants", joueursMin: 4, unique: false },
  // --- Village : les rôles du jeu de soirée (Le Pacte, étape 3a ; poids provisoires)
  "franc-villageois": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true },
  "aieul": { camp: "village", poids: 5, niveau: "classique", joueursMin: 8, unique: true },
  "souffre-douleur": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true },
  "innocent": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true },
  "lavandiere": { camp: "village", poids: 3, niveau: "classique", joueursMin: 9, unique: false, groupe: 2 },
  "bucheron": { camp: "village", poids: 3, niveau: "chaos", joueursMin: 12, unique: false, groupe: 3 },
  "furet": { camp: "village", poids: 5, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "gardeuse-d-oies": { camp: "village", poids: 4, niveau: "classique", joueursMin: 8, unique: true, information: true },
  "greffier-begue": { camp: "village", poids: 3, niveau: "chaos", joueursMin: 9, unique: true },
  "vieux-sergent": { camp: "village", poids: 3, niveau: "classique", joueursMin: 8, unique: true },
  "pie": { camp: "village", poids: 3, niveau: "chaos", joueursMin: 9, unique: true },
  // --- Ambigus (Le Pacte, étape 3b ; poids provisoires). Le Chapardeur ajoute deux cartes Villageois au paquet (le centre) : elles
  // ne comptent pas dans l'équilibre (logique/composition.mjs). Le Mâtin et l'Enfant des bois, qui peuvent passer à la meute, sont
  // montés de -2 et -1 à -1 et 0 pour garder le générateur à ±2 (comme les poids de l'étape 3a, à calibrer à l'étape 6).
  "chapardeur": { camp: "village", poids: 0, niveau: "chaos", joueursMin: 8, unique: true },
  "bateleur": { camp: "village", poids: 4, niveau: "chaos", joueursMin: 9, unique: true },
  "matin": { camp: "village", poids: -1, niveau: "chaos", joueursMin: 9, unique: true },
  "enfant-des-bois": { camp: "village", poids: 0, niveau: "classique", joueursMin: 8, unique: true },
  "chambriere": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true },
  // --- La variante « Le Village » (Le Pacte, étape 4 ; poids provisoire). village : le générateur ne tire l'Incendiaire que si la
  // variante est choisie (il n'aurait rien à brûler sans elle) ; jamais à la petite tablée.
  "incendiaire": { camp: "village", poids: 2, niveau: "classique", joueursMin: 8, unique: true, village: true },
  // --- Solitaires
  "revenant": { camp: "solitaire", poids: -2, niveau: "classique", joueursMin: 9, unique: true },
  "chasseur-de-primes": { camp: "solitaire", poids: -2, niveau: "classique", joueursMin: 9, unique: true },
  "colporteur": { camp: "solitaire", poids: -1, niveau: "chaos", joueursMin: 8, unique: true },
  "pyromane": { camp: "solitaire", poids: -6, niveau: "chaos", joueursMin: 10, unique: true },
  // Ne tue qu'une nuit sur deux (le Pyromane peut tout embraser d'un coup), mais la meute ne peut pas la tuer.
  "dame-du-gue": { camp: "solitaire", poids: -5, niveau: "chaos", joueursMin: 10, unique: true },
  // Les solitaires du jeu de soirée (Le Pacte, étape 3b ; poids provisoires). Le Feu follet gagne rarement, puis rejoint le Village
  // (0 plutôt que -1 : le générateur reste à ±2).
  "feu-follet": { camp: "solitaire", poids: 0, niveau: "classique", joueursMin: 8, unique: true },
  "joueur-de-vielle": { camp: "solitaire", poids: -4, niveau: "chaos", joueursMin: 10, unique: true },
  "illumine": { camp: "solitaire", poids: -3, niveau: "chaos", joueursMin: 10, unique: true }
};

// Bâtiments : niveau minimal (les plus perturbants attendent le niveau classique ou chaos).
export const EQUILIBRE_BATIMENTS = {
  chapelle: { niveau: "debutants" }, puits: { niveau: "debutants" }, moulin: { niveau: "debutants" }, lavoir: { niveau: "debutants" },
  taverne: { niveau: "classique" }, forge: { niveau: "classique" }, cimetiere: { niveau: "classique" }, pont: { niveau: "classique" },
  grange: { niveau: "classique" }, gibet: { niveau: "chaos" }
};
