// Jetons des Veillées de Brumecombe : quelle silhouette game-icons.net pour quel rôle, métier, bâtiment et figurant.
// Icônes de game-icons.net, licence CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/) : le dossier avant le
// « / » est l'auteur sur game-icons. Pour changer une icône : modifier la ligne ici, puis
// `npm run fabriquer-jetons-veillees` (ajouter `-- --source <dossier icons-master de l'archive game-icons>` si l'icône
// n'a pas encore été copiée dans modules/lakour-mj-ia/outils/game-icons/), puis `npm run fabriquer-veillees`.
// Images, index (index.json / index-3d.json), figurants.json et CREDITS.md sont écrits par outils/fabriquer-jetons-veillees.mjs.
import { DOSSIER_JETONS } from "./aides.mjs";

export { DOSSIER_JETONS };
export const INDEX_JOUEURS = { "2d": `${DOSSIER_JETONS}/index.json`, "3d": `${DOSSIER_JETONS}/index-3d.json` };
export const FICHIER_FIGURANTS = `${DOSSIER_JETONS}/figurants.json`;

// Jeton neutre : il cache le rôle (c'est aussi le jeton du rôle « villageois »). Tous les joueurs le portent sur la
// carte tant que leur rôle n'est pas révélé.
export const JETON_NEUTRE = "villageois";

// Clé du rôle -> icône « auteur/nom ».
export const JETONS_ROLES = {
  // --- La Meute
  "loup-de-brumecombe": "lorc/wolf-head",
  "loup-affame": "lorc/bestial-fangs",
  "loup-deguise": "lorc/domino-mask",
  "louve-mere": "lorc/paw-heart",
  "loup-hurleur": "lorc/wolf-howl",
  "loup-flaireur": "delapouite/sniffing-dog",
  "loup-des-roseaux": "lorc/werewolf",                 // tapi, aux aguets
  // --- Le Village
  "villageois": "lorc/cowled",                          // jeton neutre : capuchon, visage dans l'ombre
  "veilleuse-de-lanterne": "lorc/lantern-flame",
  "liseuse-de-cendres": "lorc/crystal-ball",
  "herboriste": "delapouite/herbs-bundle",
  "garde-du-pont": "delapouite/stone-bridge",
  "sonneur": "lorc/ringing-bell",
  "fossoyeur": "skoll/hasty-grave",
  "braconniere": "lorc/wolf-trap",
  "conteuse": "lorc/open-book",
  "juge-de-paix": "lorc/gavel",
  "enfant-de-la-brume": "delapouite/fog",
  "ermite": "lorc/hood",
  "messager": "lorc/envelope",
  "entremetteuse": "lorc/cupidon-arrow",
  "gardienne-des-cles": "lorc/skeleton-key",
  "sourcier": "lorc/droplets",                        // il cherche l'eau
  "louvetier": "lorc/hound",                          // ses chiens de meute
  "pecheur-de-nuit": "lorc/harpoon-trident",
  "somnambule": "lorc/candle-light",                  // il marche la nuit, une chandelle à la main
  "rosiere": "delapouite/jewel-crown",                // la couronne de l'année
  // --- Les solitaires
  "revenant": "lorc/ghost",
  "colporteur": "lorc/swap-bag",
  "chasseur-de-primes": "delapouite/target-poster",
  "pyromane": "delapouite/torch",
  "dame-du-gue": "lorc/spectre"                        // la femme pâle du gué
};

// Clé du métier -> icône (fichier « metier-<cle> »).
export const JETONS_METIERS = {
  "forgeron": "lorc/anvil",
  "meuniere": "delapouite/flour",
  "garde": "lorc/halberd",
  "cure": "lorc/prayer",
  "chasseresse": "delapouite/bow-arrow",
  "aubergiste": "lorc/beer-stein",
  "apothicaire": "skoll/pestle-mortar",
  "colporteur-de-nouvelles": "lorc/scroll-unfurled",
  "tisserande": "caro-asercion/spinning-wheel",
  "passeur": "delapouite/wood-canoe",
  "tanneur": "delapouite/animal-hide",
  "maitresse-d-ecole": "delapouite/teacher",
  "ramoneuse": "delapouite/broom",                   // le hérisson du ramoneur
  "eclusiere": "lorc/anchor"
};

// Clé du bâtiment -> icône (fichier « batiment-<cle> », image de l'objet).
export const JETONS_BATIMENTS = {
  "chapelle": "delapouite/church",
  "moulin": "delapouite/windmill",
  "taverne": "delapouite/tavern-sign",
  "gibet": "lorc/gibbet",
  "puits": "delapouite/well",
  "forge": "lorc/anvil-impact",
  "cimetiere": "delapouite/graveyard",
  "pont": "delapouite/stone-bridge",
  "lavoir": "delapouite/empty-wood-bucket",
  "grange": "delapouite/barn"
};

// Jetons à part pour les figurants (fichier « figurant-<cle> »).
export const JETONS_FIGURANTS = {
  "figurant-enfant": { titre: "Figurant — Enfant", icone: "delapouite/baby-face" },
  "figurant-paysan": { titre: "Figurant — Paysan", icone: "delapouite/farmer" },
  "figurant-religieuse": { titre: "Figurant — Religieuse", icone: "cathelineau/nun-face" },
  "figurant-chien": { titre: "Figurant — Chien de ferme", icone: "delapouite/sitting-dog" },
  "figurant-corbeau": { titre: "Figurant — Corbeau", icone: "lorc/raven" },
  "figurant-chat": { titre: "Figurant — Chat", icone: "lorc/cat" },
  "figurant-ombre": { titre: "Figurant — Silhouette dans la brume", icone: "darkzaitzev/hooded-figure" },
  "figurant-lavandiere": { titre: "Figurant — Lavandière", icone: "delapouite/broom" }
};

// Types de figurants proposés au MJ IA (assets/jetons/figurants.json) : jeton = nom de fichier dans assets/jetons/.
export const TYPES_FIGURANTS = {
  villageois: { libelle: "Villageois anonyme", jeton: "villageois" },
  garde: { libelle: "Garde du guet", jeton: "metier-garde" },
  cure: { libelle: "Curé", jeton: "metier-cure" },
  forgeron: { libelle: "Forgeron", jeton: "metier-forgeron" },
  meuniere: { libelle: "Meunière", jeton: "metier-meuniere" },
  aubergiste: { libelle: "Aubergiste", jeton: "metier-aubergiste" },
  passeur: { libelle: "Passeur", jeton: "metier-passeur" },
  enfant: { libelle: "Enfant", jeton: "figurant-enfant" },
  paysan: { libelle: "Paysan", jeton: "figurant-paysan" },
  religieuse: { libelle: "Religieuse", jeton: "figurant-religieuse" },
  lavandiere: { libelle: "Lavandière", jeton: "figurant-lavandiere" },
  chien: { libelle: "Chien de ferme", jeton: "figurant-chien" },
  corbeau: { libelle: "Corbeau", jeton: "figurant-corbeau" },
  chat: { libelle: "Chat", jeton: "figurant-chat" },
  ombre: { libelle: "Silhouette dans la brume", jeton: "figurant-ombre" }
};

// Dossier game-icons -> nom de l'auteur tel que l'écrit game-icons.net (license.txt de l'archive).
export const AUTEURS = {
  "lorc": "Lorc",
  "delapouite": "Delapouite",
  "skoll": "Skoll",
  "darkzaitzev": "DarkZaitzev",
  "cathelineau": "Cathelineau",
  "caro-asercion": "Caro Asercion"
};

// Couleur de l'anneau : selon le camp pour les rôles, neutre pour le jeton qui cache le rôle, bronze pour les métiers
// (publics), ardoise pour les bâtiments, ambre pour les figurants.
export const COULEURS_ANNEAU = {
  meute: { attitude: "meute", couleur: "#8a1414" },          // rouge sang
  village: { attitude: "village", couleur: "#2e7d36" },      // vert
  solitaire: { attitude: "solitaire", couleur: "#6a3d8a" },  // violet
  neutre: { attitude: "neutre", couleur: "#6b6458" },        // gris de pierre
  metier: { attitude: "métier", couleur: "#9a7b3a" },        // bronze
  batiment: { attitude: "bâtiment", couleur: "#4a5a6a" },    // ardoise
  figurant: { attitude: "figurant", couleur: "#c8871a" }     // ambre
};
