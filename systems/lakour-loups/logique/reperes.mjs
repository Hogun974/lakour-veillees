// Les repères de la carte du village, par NOM : « Maison 1 » à « Maison 18 » (system.maison des villageois) et les dix bâtiments
// (system.repere des objets batiment : Chapelle, Moulin, Taverne, Gibet, Puits, Forge, Cimetière, Pont, Lavoir, Grange). Ces noms
// sont des CLÉS : le système les lit par nom (plateau.mjs : seuil d'une maison, rassemblement devant un bâtiment), le MJ IA aussi,
// et le module anglais lakour-veillees-en les garde en français pour que la même carte serve aux deux langues. Seul l'AFFICHAGE
// se traduit, ici : libelleDeRepere(nom, traduire) rend le libellé dans la langue de Foundry (lang/<langue>.json, clés
// LAKOUR_LOUPS.Reperes.*), et le nom tel quel pour tout ce qui n'est pas un repère connu (une maison nommée à la main, « »).
// Logique pure : le traducteur est passé en paramètre (scripts/donnees.mjs fournit libelleRepere, branché sur game.i18n).
export const REPERES = Object.freeze(["chapelle", "moulin", "taverne", "gibet", "puits", "forge", "cimetiere", "pont", "lavoir", "grange"]);

const normaliser = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

// Le repère que désigne un nom : { cle: "maison", n } pour « Maison 7 », { cle: "chapelle" } pour « Chapelle », null sinon.
export function repereDe(nom) {
  const n = normaliser(nom);
  const maison = /^maison (\d+)$/.exec(n);
  if (maison) return { cle: "maison", n: Number(maison[1]) };
  return REPERES.includes(n) ? { cle: n } : null;
}

// Le libellé affiché d'un repère : traduire(cle, donnees) est game.i18n (format avec { n } pour une maison, localize sinon).
// Sans traduction (clé inconnue, traducteur absent), le nom reste tel quel.
export function libelleDeRepere(nom, traduire) {
  const r = repereDe(nom);
  if (!r || typeof traduire !== "function") return nom ?? "";
  const cle = `LAKOUR_LOUPS.Reperes.${r.cle}`;
  const libelle = r.cle === "maison" ? traduire(cle, { n: r.n }) : traduire(cle);
  return typeof libelle === "string" && libelle && libelle !== cle ? libelle : nom;
}
