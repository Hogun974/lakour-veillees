// Le genre d'un prénom (traits visibles : gazette.mjs, tirerTraits ; accords : grammaire.mjs). Logique pure.
//
// Un personnage dont le prénom est connu reçoit le genre de ce prénom à la distribution (au lieu du tirage) : « Ondine Malefosse »
// est une femme, « Félicien Morteau » un homme. Les listes : tous les prénoms de la table « Noms de villageois » du module de contenu
// (lakour-veillees et lakour-veillees-en : les mêmes noms), ceux des noms de secours des compagnons du MJ IA (compagnons-jeu.js) et des
// prénoms usuels, français et anglais. Un prénom porté par les deux (Camille, Dominique, Claude, Alix…) ou inconnu ne dit rien : le
// tirage décide. Un trait posé à la main (drapeau « traits » de l'acteur) passe avant (scripts/api.mjs, traitsImposes).
//
// genreDuPrenom(nom) : « femme », « homme » ou "" ; le prénom est le premier mot du nom (« Jean-Baptiste » entier d'abord, puis « Jean »),
// sans accents ni casse.

const sansAccents = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const liste = s => s.split(/\s+/).filter(Boolean).map(sansAccents);

// Les prénoms de Brumecombe (table « Noms de villageois » du contenu ; noms de secours du MJ IA).
export const PRENOMS_DE_BRUMECOMBE = Object.freeze({
  femme: ["Ysaline", "Odile", "Bertille", "Perrine", "Guillemette", "Mahaut", "Clémence", "Jacquette", "Aliénor", "Margot", "Solène",
    "Philippine", "Agathe", "Isaure", "Rosalie", "Hermine", "Blanche", "Edmée", "Apolline", "Ondine", "Léontine"],
  homme: ["Mathurin", "Anselme", "Gaspard", "Colin", "Aymeric", "Thibaut", "Félicien", "Eudes", "Sylvestre", "Bastien", "Honoré", "Hugon",
    "Léonce", "Valentin", "Firmin", "Quentin", "Augustin", "Josselin", "Norbert", "Baptistin"]
});

const FEMMES = liste(`
  Adèle Adeline Adrienne Agathe Agnès Albertine Alice Aline Amandine Amélie Anaïs Andrée Angèle Angélique Anne Annette Annie Antoinette
  Apolline Ariane Armelle Arlette Aude Audrey Augustine Aurélie Aurore Barbara Béatrice Bénédicte Bérénice Bernadette Berthe Blandine
  Brigitte Capucine Carole Caroline Catherine Cécile Céline Chantal Charlène Charlotte Chloé Christelle Christiane Christine Claire Clara
  Clarisse Claudine Clémentine Clotilde Colette Constance Coralie Corinne Cunégonde Danielle Delphine Denise Diane Dorothée Éléonore
  Élisabeth Élise Éloïse Élodie Émeline Émilie Emma Emmanuelle Estelle Eugénie Ève Évelyne Fanny Félicie Fernande Flore Florence Francine
  Françoise Frédérique Gabrielle Geneviève Georgette Germaine Ginette Gisèle Héloïse Hélène Henriette Hortense Huguette Ida Inès Irène
  Isabelle Jacqueline Jeanne Jeannette Jocelyne Joëlle Joséphine Judith Julie Julienne Juliette Justine Laetitia Laure Laurence Léa Léonie
  Léopoldine Lina Lise Lisette Louise Lucie Lucienne Lucille Lydie Madeleine Manon Marcelle Margaux Marguerite Marianne Marie Marielle Marine
  Marion Marthe Martine Mathilde Maud Mélanie Mélissa Michèle Micheline Mireille Monique Morgane Nadège Nadine Nathalie Nicole Noélie Noëlle
  Noémie Océane Odette Olympe Pascale Patricia Paule Paulette Pauline Pélagie Pénélope Pierrette Rachel Raymonde Rebecca Régine Reine
  Renée Rolande Rose Roseline Roxane Sabine Sandrine Sarah Séverine Sidonie Simone Solange Sophie Suzanne Sylvie Thérèse Ursule Valentine
  Valérie Véronique Victoire Victorine Violette Virginie Yolande Yvette Yvonne Ysoline Zélie Zoé
  Abigail Alison Amanda Amy Ann Anna Ava Betty Beatrice Bridget Carol Clementine Deborah Donna Dorothy Edith Eleanor Elizabeth Ellen Emily
  Florence Grace Gwendolyn Hannah Harriet Helen Isabel Isabella Jane Janet Jennifer Jessica Joan Karen Katherine Kathleen Laura Linda Lisa
  Lucy Margaret Martha Mary Matilda Megan Melissa Mia Michelle Molly Nancy Olivia Peggy Rosalind Ruth Sandra Sharon Sophia Stephanie Susan
  Winifred`);
const HOMMES = liste(`
  Adam Adolphe Adrien Alain Alban Albert Alexandre Alexis Alfred Alphonse Amaury Ambroise Amédée André Anthony Antoine Antonin Aristide
  Armand Arnaud Arsène Arthur Aubin Auguste Aurélien Barnabé Barthélemy Basile Benjamin Benoît Bernard Bertrand Blaise Boniface Boris Bruno
  Casimir Cédric Charles Christian Christophe Clément Côme Constant Corentin Cyprien Cyril Damien Daniel David Denis Didier Désiré Donatien
  Édouard Edmond Élie Éloi Émile Emmanuel Enzo Éric Ernest Étienne Eugène Évariste Évrard Fabien Fabrice Félix Ferdinand Fernand Florent
  Florian François Franck Frédéric Gabin Gabriel Gaël Gaëtan Gaston Gauthier Geoffroy Georges Gérard Germain Gilbert Gilles Grégoire Guillaume
  Gustave Guy Hector Henri Hippolyte Hubert Hugo Hugues Ignace Isidore Jacques Jean Jérémie Jérôme Joachim Joël Jordan Joseph Jules Julien
  Justin Kévin Laurent Lazare Léo Léon Léonard Léopold Lionel Loïc Louis Luc Lucas Lucien Ludovic Marc Marcel Marius Martin Mathias Mathieu
  Mathis Matthieu Maurice Maxence Maxime Médéric Michel Nathan Nicolas Noé Noël Octave Olivier Oscar Pascal Patrice Patrick Paul Philibert
  Philippe Pierre Prosper Raoul Raphaël Raymond Régis Rémi Rémy Renaud René Richard Robert Robin Rodolphe Roger Roland Romain Samuel
  Sébastien Serge Séraphin Simon Stéphane Sylvain Théo Théodore Théophile Thibault Thierry Thomas Timothée Tristan Ulysse Urbain Victor
  Vincent Xavier Yann Yves Yvon Zacharie
  Andrew Benedict Brian Edmund Edward Frederick George Gregory Harry Henry Hugh Jack James Jason John Jonathan Joshua Kevin Matthew Michael
  Oliver Peter Ralph Stephen Steven Timothy Walter William`);
// Portés par les deux : rien n'en est déduit (le tirage décide).
const MIXTES = new Set(liste("Camille Dominique Claude Alix Sacha Sasha Charlie Morgan Lou Andrea Céleste Eden Noa Ange Leslie"));

const GENRES = new Map([
  ...HOMMES.map(p => [p, "homme"]), ...FEMMES.map(p => [p, "femme"]),
  ...PRENOMS_DE_BRUMECOMBE.homme.map(p => [sansAccents(p), "homme"]), ...PRENOMS_DE_BRUMECOMBE.femme.map(p => [sansAccents(p), "femme"])
]);

// Le genre d'un prénom seul (sans accents ni casse) : « femme », « homme » ou "".
const genreDUnMot = mot => {
  const p = sansAccents(mot);
  return !p || MIXTES.has(p) ? "" : GENRES.get(p) ?? "";
};

// Le genre du prénom d'un nom de personnage : « femme », « homme » ou "" (inconnu, ou porté par les deux).
export function genreDuPrenom(nom) {
  const premier = String(nom ?? "").trim().split(/\s+/)[0] ?? "";
  if (!premier || MIXTES.has(sansAccents(premier))) return "";
  const entier = genreDUnMot(premier);
  if (entier) return entier;
  // Un prénom composé inconnu : son premier morceau (« Jean-Eudes » : Jean ; « Marie-Ondine » : Marie).
  const [tete] = premier.split("-");
  return tete && tete !== premier ? genreDUnMot(tete) : "";
}
