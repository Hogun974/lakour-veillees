// Constantes partagées par la logique pure et par Foundry. Aucun appel à Foundry ici.

export const ID = "lakour-loups";
export const CANAL = `system.${ID}`;

export const PHASES = ["preparation", "nuit", "aube", "jour", "vote", "fin"];
export const CAMPS = ["village", "meute", "solitaire"];

// Ordre de réveil de la meute (contrat §1) : les loups de base y sont groupés.
export const ORDRE_MEUTE = 40;
// Clé de rôle réservée à l'action collective de la meute (noterAction({ roleCle: "meute", … })).
export const CLE_MEUTE = "meute";
// Clé réservée à l'étape « la peste » de la variante Peste noire (logique/peste.mjs) : elle prend la place de la meute dans
// l'ordre de nuit (même ordre, 40) ; noterAction({ roleCle: "peste", … }) note sa victime.
export const CLE_PESTE = "peste";
// Vainqueur de la peste noire quand le village s'éteint sans l'avoir reconnue.
export const VAINQUEUR_PESTE = "peste";
// La peste noire est RARE : une partie composée d'elle-même (nouvellePartie, loups_composer) en devient une avec cette chance,
// tirée par le générateur à graine (tirerPeste). Le MJ humain peut aussi la choisir.
export const CHANCE_PESTE = 1 / 30;

// Clés d'effet du contrat (§4). "" = arbitré par le narrateur.
export const EFFETS = [
  "tuer", "proteger", "voir-camp", "voir-role-mort", "eclairer", "silence", "vote-double", "annuler-vote",
  "remede", "poison", "lien-amour", "echanger-role", "mordre", "emporter", "asperger", "embraser",
  "epier", "messager", "voir-actif"
];

// Celles que le système applique de lui-même : à l'aube (resoudreNuit, dont le message porté par le Messager) ou de jour
// (agirDeJour : « annuler-vote » du Juge de paix). Les autres sont rendues au narrateur.
export const EFFETS_AUTOMATISES = [
  "tuer", "proteger", "voir-camp", "voir-role-mort", "eclairer", "silence", "vote-double", "remede", "poison",
  "lien-amour", "echanger-role", "mordre", "emporter", "asperger", "embraser", "epier", "voir-actif", "messager", "annuler-vote"
];
export const EFFETS_NARRATEUR = EFFETS.filter(e => !EFFETS_AUTOMATISES.includes(e));

// Conditions de victoire lisibles par la machine pour les solitaires (champ de rôle `victoireCle`, extension
// du contrat ; à défaut, déduite de la clé du rôle, voir victoire.mjs).
export const VICTOIRES = ["", "execute", "dernier-survivant", "cible-executee"];

// Causes de mort normalisées.
export const CAUSES = { meute: "meute", nuit: "nuit", poison: "poison", feu: "feu", chagrin: "chagrin", vote: "vote",
  emporte: "emporte", epie: "epie", narrateur: "narrateur", peste: "peste", panique: "panique" };

// Causes qui trahiraient un rôle (la meute, l'Herboriste, le Pyromane, l'Enfant de la brume) ou la peste noire : l'état
// public dit seulement « mort dans la nuit », comme pour une victime de la meute. La vraie cause reste chez le MJ (le Tanneur
// la lit pour dire s'il y a des traces de crocs ; le récit de fin et les Chroniques la dévoilent).
export const CAUSES_SECRETES = ["meute", "poison", "feu", "epie", "peste"];
export const causePublique = cause => (CAUSES_SECRETES.includes(cause) ? CAUSES.nuit : cause);
