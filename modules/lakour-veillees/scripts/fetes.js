// Les Veillées de fête de Brumecombe : la déclinaison de chaque fête du calendrier du moteur (lakour-mj-ia, docs/fetes.md) et son
// journal. Données seules, sans dépendance : lues par main.js (enregistrement auprès du moteur, dans le navigateur) et par
// contenu/fetes.mjs (journaux des compendiums, à la fabrication). L'identifiant de chaque journal est celui que fabrique
// contenu/aides.mjs (identifiant(`journaux:<cle>`)) : un essai vérifie qu'ils concordent.
//
// Les RÈGLES de chaque veillée sont celles du système lakour-loups (logique/fetes.mjs) : une variante que le narrateur choisit à la
// distribution ; la fête du calendrier ne fait que la proposer. Ni la description (carte publique du moteur) ni la consigne (ligne
// donnée au narrateur IA) ne disent un secret de partie.
export const MODULE_FETES = "lakour-veillees";
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
    journal: { cle: "fete-nuit-des-ames", id: "BmG4Y4VZkG7WKJvi", nom: "Veillée de fête — La Nuit des âmes" }
  },
  {
    id: "veillee-d-hiver", fete: "noel", nom: "La Veillée d'hiver",
    description: "Au cœur de l'hiver, Brumecombe veille autour du grand feu de la place, et l'on boit le vin chaud jusqu'au premier chant "
      + "du coq. La Dame aux grelots passe dans la neige et laisse un présent sur un seuil, sans dire lequel ; au matin, la neige fraîche a "
      + "souvent effacé les traces de la nuit.",
    consigne: "Veillée d'hiver : feu sur la place, vin chaud, grelots dans la neige. Si la veillée est en jeu, ne dis jamais qui a reçu le "
      + "présent de la Dame aux grelots ni s'il s'est ouvert ; la neige du matin, elle, est annoncée à tous",
    decor: { palette: "givre", ornements: ["neige", "bougies", "guirlandes"] },
    journal: { cle: "fete-veillee-d-hiver", id: "a8RAYEHwiH28vEHH", nom: "Veillée de fête — La Veillée d'hiver" }
  },
  {
    id: "carnaval-des-masques", fete: "carnaval", nom: "Le Carnaval des masques",
    description: "Au Mardi gras, Brumecombe défile masquée derrière le mannequin de paille, au son des crécelles. Un masque de trop circule, "
      + "dit-on, qui trompe jusqu'aux devins ; et le défilé montre toujours un visage que personne au village ne porte.",
    consigne: "Carnaval à Brumecombe : défilé masqué, mannequin de paille, crécelles et beignets. Si la veillée est en jeu, ne dis jamais "
      + "qui porte le masque du Carnaval ; le masque du défilé, annoncé à tous, peut être rappelé",
    decor: { palette: "carnaval", ornements: ["masques", "confettis"] },
    journal: { cle: "fete-carnaval-des-masques", id: "BkKcHUvFdizeWTno", nom: "Veillée de fête — Le Carnaval des masques" }
  },
  {
    id: "fete-des-promis", fete: "saint-valentin", nom: "La Fête des promis",
    description: "À la mi-février, les jeunes gens de Brumecombe nouent des rubans sous le Pont et se promettent l'un à l'autre devant la "
      + "rivière. Deux cœurs se sont trouvés cette année ; on raconte que la meute, tapie dans les roseaux, les a vus s'embrasser.",
    consigne: "Fête des promis : rubans noués sous le Pont, chansons, pain d'épice en cœur. Si la veillée est en jeu, ne dis jamais qui sont "
      + "les promis, même si on te le demande, et ne confirme aucune promesse qu'on se réclame",
    decor: { palette: "rose", ornements: ["coeurs", "bougies"] },
    journal: { cle: "fete-fete-des-promis", id: "PIQAzYQp9aFwh59a", nom: "Veillée de fête — La Fête des promis" }
  }
];
