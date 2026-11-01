import { ROLES } from "./roles.mjs";
import { METIERS } from "./metiers.mjs";
import { BATIMENTS } from "./batiments.mjs";
import { GUIDES } from "./guides.mjs";
import { TABLES } from "./tables.mjs";
import { ACTEURS } from "./acteurs.mjs";
import { CARTES } from "./village.mjs";

// Tout le contenu du module, dans l'ordre des compendiums.
export const DOCUMENTS = [...ROLES, ...METIERS, ...BATIMENTS, ...GUIDES, ...TABLES, ...CARTES, ...ACTEURS];
