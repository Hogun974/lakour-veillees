// Identifiant du module, lu dans l'adresse de ce fichier : « lakour-veillees » (français) ou « lakour-veillees-en » (version
// anglaise, engendrée par outils/fabriquer-veillees.mjs --langue en : mêmes scripts, mêmes _id de documents, drapeaux sous sa
// propre portée). Foundry sert chaque module sous /modules/<id>/ ; dans node (essais, fabricant), le chemin du dépôt contient
// aussi modules/<id>/. Tout ce qui porte l'identifiant du module (réglages, drapeaux, compendiums « <id>.journaux », chemins
// « modules/<id>/… », compositions.json, equilibre.json, jeton neutre) passe par ID : les deux modules fonctionnent sans autre
// changement. Même mécanisme que lakour-40k (docs/traduction.md du moteur).
export const ID_FRANCAIS = "lakour-veillees";
export const ID = /\/modules\/([^/]+)\//.exec(decodeURIComponent(new URL(import.meta.url).pathname))?.[1] ?? ID_FRANCAIS;
// Version anglaise du module ?
export const ANGLAIS = ID !== ID_FRANCAIS;
