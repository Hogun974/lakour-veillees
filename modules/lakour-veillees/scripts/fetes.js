// Les Veillées de fête de Brumecombe : la déclinaison de chaque fête du calendrier du moteur (lakour-mj-ia, docs/fetes.md) et son
// journal. Données seules, sans dépendance : lues par main.js (enregistrement auprès du moteur, dans le navigateur) et par
// contenu/fetes.mjs (journaux des compendiums, à la fabrication). L'identifiant de chaque journal est celui que fabrique
// contenu/aides.mjs (identifiant(`journaux:<cle>`)) : un essai vérifie qu'ils concordent.
//
// Les RÈGLES de chaque veillée sont celles du système lakour-loups (logique/fetes.mjs) : une variante que le narrateur choisit à la
// distribution ; la fête du calendrier ne fait que la proposer. Ni la description (carte publique du moteur) ni la consigne (ligne
// donnée au narrateur IA) ne disent un secret de partie.
//
// Bilingue : les textes français sont ceux des sources (nom, description, consigne, journal.nom) ; leur version anglaise est sous
// « en ». textesDeFete(f) rend la fête dans la langue du module (anglais dans lakour-veillees-en, scripts/identite.js) : main.js
// enregistre celle-là auprès du moteur. Le nom anglais du journal doit être celui du dictionnaire contenu/en/journaux.json
// (essais/traduction-veillees.test.mjs).
import { ANGLAIS, ID } from "./identite.js";

export const MODULE_FETES = ID;
export const DOSSIER_IMAGES_FETES = `modules/${MODULE_FETES}/assets/fetes`;
export const imageDeFete = fete => `${DOSSIER_IMAGES_FETES}/${fete}.jpg`;

export const FETES_VEILLEES = [
  {
    id: "nuit-des-ames", fete: "halloween", nom: "La Nuit des âmes",
    description: "À Brumecombe, la nuit des âmes, on taille des lanternes dans les navets et l'on laisse la porte entrebâillée : les morts de "
      + "l'année reviennent s'asseoir au coin du feu. Les anciens disent qu'ils murmurent des choses vraies… et que les loups entendent à "
      + "quelle porte ils frappent.",
    consigne: "Nuit des âmes à Brumecombe : lanternes de navet aux fenêtres, portes entrebâillées pour les morts. Si la veillée est en jeu, "
      + "ne dis jamais à qui une âme a murmuré ni ce qu'elle a dit, et ne confirme aucune parole qu'on lui prête",
    decor: { palette: "crepuscule", ornements: ["bougies", "feuilles", "citrouilles"] },
    journal: { cle: "fete-nuit-des-ames", id: "BmG4Y4VZkG7WKJvi", nom: "Veillée de fête — La Nuit des âmes" },
    en: {
      nom: "The Night of Souls",
      description: "In Brumecombe, on the night of souls, lanterns are carved out of turnips and doors are left ajar: the year's dead come "
        + "back to sit by the fire. The elders say they whisper true things… and that the wolves can hear which door they knock on.",
      consigne: "Night of Souls in Brumecombe: turnip lanterns in the windows, doors left ajar for the dead. If the vigil is in play, never "
        + "say whom a soul whispered to nor what it said, and never confirm any words attributed to it",
      journal: { nom: "Holiday Vigil — The Night of Souls" }
    }
  },
  {
    id: "veillee-d-hiver", fete: "noel", nom: "La Veillée d'hiver",
    description: "Au cœur de l'hiver, Brumecombe veille autour du grand feu de la place, et l'on boit le vin chaud jusqu'au premier chant "
      + "du coq. La Dame aux grelots passe dans la neige et laisse un présent sur un seuil, sans dire lequel ; au matin, la neige fraîche a "
      + "souvent effacé les traces de la nuit.",
    consigne: "Veillée d'hiver : feu sur la place, vin chaud, grelots dans la neige. Si la veillée est en jeu, ne dis jamais qui a reçu le "
      + "présent de la Dame aux grelots ni s'il s'est ouvert ; la neige du matin, elle, est annoncée à tous",
    decor: { palette: "givre", ornements: ["neige", "bougies", "guirlandes"] },
    journal: { cle: "fete-veillee-d-hiver", id: "a8RAYEHwiH28vEHH", nom: "Veillée de fête — La Veillée d'hiver" },
    en: {
      nom: "The Winter Vigil",
      description: "In the heart of winter, Brumecombe keeps watch around the great fire on the square, and mulled wine is drunk until the "
        + "first crow of the rooster. The Lady of Bells passes through the snow and leaves a gift on one doorstep, without saying "
        + "which; by morning, fresh snow has often wiped away the traces of the night.",
      consigne: "Winter Vigil: fire on the square, mulled wine, sleigh bells in the snow. If the vigil is in play, never say who received "
        + "the Lady of Bells' gift nor whether it opened; the morning snow, on the other hand, is announced to all",
      journal: { nom: "Holiday Vigil — The Winter Vigil" }
    }
  },
  {
    id: "carnaval-des-masques", fete: "carnaval", nom: "Le Carnaval des masques",
    description: "Au Mardi gras, Brumecombe défile masquée derrière le mannequin de paille, au son des crécelles. Un masque de trop circule, "
      + "dit-on, qui trompe jusqu'aux devins ; et le défilé montre toujours un visage que personne au village ne porte.",
    consigne: "Carnaval à Brumecombe : défilé masqué, mannequin de paille, crécelles et beignets. Si la veillée est en jeu, ne dis jamais "
      + "qui porte le masque du Carnaval ; le masque du défilé, annoncé à tous, peut être rappelé",
    decor: { palette: "carnaval", ornements: ["masques", "confettis"] },
    journal: { cle: "fete-carnaval-des-masques", id: "BkKcHUvFdizeWTno", nom: "Veillée de fête — Le Carnaval des masques" },
    en: {
      nom: "The Carnival of Masks",
      description: "On Shrove Tuesday, Brumecombe parades in masks behind the straw effigy, to the sound of rattles. One mask too many is "
        + "said to go around, one that fools even the seers; and the parade always shows a face that no one in the village wears.",
      consigne: "Carnival in Brumecombe: masked parade, straw effigy, rattles and fritters. If the vigil is in play, never say who wears "
        + "the Carnival mask; the parade's mask, announced to all, may be recalled",
      journal: { nom: "Holiday Vigil — The Carnival of Masks" }
    }
  },
  {
    id: "fete-des-promis", fete: "saint-valentin", nom: "La Fête des promis",
    description: "À la mi-février, les jeunes gens de Brumecombe nouent des rubans sous le Pont et se promettent l'un à l'autre devant la "
      + "rivière. Deux cœurs se sont trouvés cette année ; on raconte que la meute, tapie dans les roseaux, les a vus s'embrasser.",
    consigne: "Fête des promis : rubans noués sous le Pont, chansons, pain d'épice en cœur. Si la veillée est en jeu, ne dis jamais qui sont "
      + "les promis, même si on te le demande, et ne confirme aucune promesse qu'on se réclame",
    decor: { palette: "rose", ornements: ["coeurs", "bougies"] },
    journal: { cle: "fete-fete-des-promis", id: "PIQAzYQp9aFwh59a", nom: "Veillée de fête — La Fête des promis" },
    en: {
      nom: "The Feast of the Betrothed",
      description: "In mid-February, the young people of Brumecombe tie ribbons under the Bridge and promise themselves to one another "
        + "before the river. Two hearts found each other this year; it is said that the pack, crouched in the reeds, saw them kiss.",
      consigne: "Feast of the Betrothed: ribbons tied under the Bridge, songs, heart-shaped gingerbread. If the vigil is in play, never say "
        + "who the betrothed are, even if asked, and never confirm any promise someone claims",
      journal: { nom: "Holiday Vigil — The Feast of the Betrothed" }
    }
  }
];

// La fête dans la langue du module : la même, avec ses textes anglais (nom, description, consigne, journal.nom) quand le module est
// lakour-veillees-en. Clé, fête du calendrier, décor et identifiant du journal ne changent pas.
export function textesDeFete(f, anglais = ANGLAIS) {
  if (!anglais || !f.en) return f;
  const { en, ...reste } = f;
  return { ...reste, nom: en.nom, description: en.description, consigne: en.consigne, journal: { ...f.journal, nom: en.journal?.nom ?? f.journal.nom } };
}
