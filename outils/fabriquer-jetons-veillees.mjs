// Fabrique les jetons du module lakour-veillees : un SVG autonome de 400×400 par rôle (anneau selon le camp ; le rôle
// « villageois » est le jeton neutre qui cache le rôle), par métier (metier-<cle>), par bâtiment (batiment-<cle>) et par
// figurant à part (figurant-<cle>), en version plate (assets/jetons/<cle>.svg) et en relief (assets/jetons/3d/<cle>.svg) ;
// les index des jetons de joueur (assets/jetons/index.json et index-3d.json : clé du RÔLE -> chemin), la liste des
// types de figurants (assets/jetons/figurants.json) et les crédits (CREDITS.md : icônes CC BY 3.0).
// Le dessin et la lecture des tracés sont les aides communes du moteur (modules/lakour-mj-ia/outils/jetons-commun.mjs,
// sous-module) ; icônes dans modules/lakour-mj-ia/outils/game-icons/.
// Correspondances : modules/lakour-veillees/contenu/jetons.mjs.
// Usage : npm run fabriquer-jetons-veillees                (puis npm run fabriquer-veillees)
//         npm run fabriquer-jetons-veillees -- --source <dossier icons-master de l'archive game-icons>
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  argumentSource, controleurJetons, dessinerJetons, ecrivainDisque, lanceDirectement, lecteurDisque, lireIcone as lireIconeCommune, tableauCredits
} from "../modules/lakour-mj-ia/outils/jetons-commun.mjs";
import { cheminJeton, cheminJeton3d, cleJetonBatiment, cleJetonMetier } from "../modules/lakour-veillees/contenu/aides.mjs";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { METIERS } from "../modules/lakour-veillees/contenu/metiers.mjs";
import { BATIMENTS } from "../modules/lakour-veillees/contenu/batiments.mjs";
import {
  AUTEURS, COULEURS_ANNEAU, DOSSIER_JETONS, FICHIER_FIGURANTS, INDEX_JOUEURS, JETON_NEUTRE,
  JETONS_BATIMENTS, JETONS_FIGURANTS, JETONS_METIERS, JETONS_ROLES, TYPES_FIGURANTS
} from "../modules/lakour-veillees/contenu/jetons.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE = "lakour-veillees";

// Tracés d'une icône : copie locale (game-icons du moteur), sinon prise dans l'archive --source, vérifiée puis copiée.
export const lireIcone = (nom, source) => lireIconeCommune(nom, { auteurs: AUTEURS, source });

// ---------------------------------------------------------------- Liste des jetons

const anneauDuRole = r => (r.system.cle === JETON_NEUTRE ? COULEURS_ANNEAU.neutre : COULEURS_ANNEAU[r.system.camp]);

export function listeJetons(roles = ROLES, metiers = METIERS, batiments = BATIMENTS) {
  const jeton = (cle, titre, icone, anneau, extra = {}) => ({ cle, titre, icone, anneau, plat: cheminJeton(cle), relief: cheminJeton3d(cle), ...extra });
  const listeRoles = roles.map(r => jeton(r.system.cle, r.system.cle === JETON_NEUTRE ? "Villageois (rôle caché)" : `Rôle — ${r.name}`,
    JETONS_ROLES[r.system.cle], anneauDuRole(r), { role: true }));
  const listeMetiers = metiers.map(m => jeton(cleJetonMetier(m.system.cle), `Métier — ${m.name}`, JETONS_METIERS[m.system.cle], COULEURS_ANNEAU.metier));
  const listeBatiments = batiments.map(b => jeton(cleJetonBatiment(b.system.cle), `Bâtiment — ${b.name}`, JETONS_BATIMENTS[b.system.cle], COULEURS_ANNEAU.batiment));
  const figurants = Object.entries(JETONS_FIGURANTS).map(([cle, f]) => jeton(cle, f.titre, f.icone, COULEURS_ANNEAU.figurant));
  const tous = [...listeRoles, ...listeMetiers, ...listeBatiments, ...figurants];
  for (const j of tous) if (!j.icone) throw new Error(`Aucune icône pour ${j.cle} : ajouter la ligne dans contenu/jetons.mjs`);
  const verifierCles = (table, connues, quoi) => {
    for (const cle of Object.keys(table)) if (!connues.includes(cle)) throw new Error(`contenu/jetons.mjs cite ${quoi} ${cle}, qui n'existe pas`);
  };
  verifierCles(JETONS_ROLES, roles.map(r => r.system.cle), "le rôle");
  verifierCles(JETONS_METIERS, metiers.map(m => m.system.cle), "le métier");
  verifierCles(JETONS_BATIMENTS, batiments.map(b => b.system.cle), "le bâtiment");
  const cles = tous.map(j => j.cle);
  const doublon = cles.find((c, i) => cles.indexOf(c) !== i);
  if (doublon) throw new Error(`Jeton en double : ${doublon}`);
  for (const [type, f] of Object.entries(TYPES_FIGURANTS)) {
    if (!f.libelle) throw new Error(`Type de figurant ${type} sans libellé`);
    if (!cles.includes(f.jeton)) throw new Error(`Type de figurant ${type} : jeton ${f.jeton} inconnu`);
  }
  if (!listeRoles.some(j => j.cle === JETON_NEUTRE)) throw new Error(`Le jeton neutre « ${JETON_NEUTRE} » doit être un rôle`);
  return { roles: listeRoles, metiers: listeMetiers, batiments: listeBatiments, figurants };
}

// Index des jetons de joueur (clé du rôle -> chemin du jeton), plat ("2d") ou relief ("3d").
export const indexJoueurs = (roles, style) => Object.fromEntries(roles.map(r => [r.cle, style === "3d" ? r.relief : r.plat]));

// ---------------------------------------------------------------- Vérification (utilisée aussi par les essais)

const lireDisque = lecteurDisque(RACINE);

// lire(chemin relatif au dépôt) -> texte ou null si absent.
export function verifierJetons(lire = lireDisque, liste = listeJetons()) {
  const erreurs = [];
  const controler = controleurJetons(lire, erreurs);
  for (const j of [...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants]) {
    controler(j.plat, j.cle, j.anneau.couleur);
    controler(j.relief, `${j.cle} (3D)`, j.anneau.couleur);
  }
  for (const style of ["2d", "3d"]) {
    const chemin = INDEX_JOUEURS[style];
    const brut = lire(chemin);
    if (brut === null) { erreurs.push(`${chemin} absent`); continue; }
    let index;
    try { index = JSON.parse(brut); } catch { erreurs.push(`${chemin} : JSON illisible`); continue; }
    const attendu = indexJoueurs(liste.roles, style);
    for (const cle of Object.keys(index)) if (!(cle in attendu)) erreurs.push(`${chemin} : clé ${cle} qui n'est pas un rôle`);
    for (const [cle, jeton] of Object.entries(attendu)) if (index[cle] !== jeton) erreurs.push(`${chemin} : ${cle} -> ${index[cle]} au lieu de ${jeton}`);
    if (!index[JETON_NEUTRE]) erreurs.push(`${chemin} : jeton neutre « ${JETON_NEUTRE} » absent`);
  }
  const texte = lire(FICHIER_FIGURANTS);
  if (texte === null) erreurs.push(`${FICHIER_FIGURANTS} absent`);
  else {
    const types = JSON.parse(texte);
    if (Object.keys(types).length < 10) erreurs.push(`figurants.json : ${Object.keys(types).length} types seulement`);
    for (const [type, f] of Object.entries(types)) {
      if (!f.libelle || !f.jeton) { erreurs.push(`figurants.json : ${type} incomplet`); continue; }
      for (const chemin of [cheminJeton(f.jeton), cheminJeton3d(f.jeton)]) if (lire(chemin) === null) erreurs.push(`figurants.json : ${type} -> ${chemin} absent`);
    }
  }
  const credits = lire(`modules/${MODULE}/CREDITS.md`);
  if (credits === null) erreurs.push("CREDITS.md absent");
  else {
    for (const j of [...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants]) {
      if (!credits.includes(`${j.icone.split("/")[1]}](https://game-icons.net/1x1/${j.icone}.html)`)) erreurs.push(`CREDITS.md ne cite pas ${j.icone}`);
    }
    if (!/CC BY 3\.0/.test(credits)) erreurs.push("CREDITS.md ne cite pas la licence CC BY 3.0");
  }
  return erreurs;
}

// ---------------------------------------------------------------- Crédits

export function credits(liste) {
  const { lignes, auteurs } = tableauCredits([...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants], AUTEURS);
  return `# Crédits — Les Veillées de Brumecombe

Jeu original de déduction sociale, de la famille des jeux de « loup-garou » nés du jeu traditionnel *Mafia*, pour un
usage non commercial. Tous les textes de ce module (rôles, métiers, bâtiments, guides, variantes, tables) et la
carte du village de Brumecombe sont originaux. Aucun texte, aucune carte ni aucune illustration d'un jeu édité n'est
reproduit.

## Carte du village

La carte (\`assets/cartes/\`) est dessinée par programme : rendu commun des cartes La Kour
(\`lakour-mj-ia/scripts/cartes-rendu.js\`) et décor propre au village (\`contenu/village.mjs\`). Aucune image extérieure.

## Illustrations

L'illustration de l'écran d'accueil (\`assets/monde/\`) et celles des veillées de fête (\`assets/fetes/<fête>.jpg\` : halloween, noel,
carnaval, saint-valentin) ont été générées localement avec ComfyStudio (FLUX.2 klein 9B), sans service distant, pour l'usage
privé de la table.

## Icônes des jetons

Les silhouettes des jetons (\`assets/jetons/\`) sont des icônes de **[game-icons.net](https://game-icons.net)**,
publiées sous licence **Creative Commons Attribution 3.0 (CC BY 3.0)** :
<https://creativecommons.org/licenses/by/3.0/>. Source : <https://github.com/game-icons/icons>.

Icons made by ${auteurs}, from game-icons.net (CC BY 3.0).

Modifications : tracés recolorés et composés dans un médaillon (anneau de couleur selon le camp du rôle — rouge pour
la Meute, vert pour le Village, violet pour les solitaires, gris de pierre pour le jeton neutre qui cache le rôle —,
bronze pour les métiers, ardoise pour les bâtiments, ambre pour les figurants ; fond en dégradé, ombre, version en
relief). Fichiers produits par \`outils/fabriquer-jetons-veillees.mjs\` ; les correspondances sont dans
\`contenu/jetons.mjs\`.

| Icône | Auteur | Utilisée pour |
|---|---|---|
${lignes}

## Licence

Les textes et les images originaux de ce module sont sous licence **CC BY-NC-SA 4.0**
(<https://creativecommons.org/licenses/by-nc-sa/4.0/>), attribution « LaKour — Hogun974 » ; son code (scripts, gabarits,
styles, \`lang/\`) est sous licence **MIT**. Le détail et les mentions des tiers sont dans \`LICENCE-CONTENU.md\` et
\`LICENSE\`, livrés dans l'archive avec ce fichier. Les icônes de game-icons.net créditées ci-dessus restent sous CC BY 3.0.
Foundry VTT est une marque de Foundry Gaming, LLC ; ce module n'y est pas affilié.
`;
}

// ---------------------------------------------------------------- Fabrication

export function fabriquerJetons({ source } = {}) {
  const liste = listeJetons();
  const ecrire = ecrivainDisque(RACINE);
  rmSync(join(RACINE, DOSSIER_JETONS), { recursive: true, force: true });
  dessinerJetons([...liste.roles, ...liste.metiers, ...liste.batiments, ...liste.figurants], { ecrire, auteurs: AUTEURS, source });
  for (const style of ["2d", "3d"]) ecrire(INDEX_JOUEURS[style], `${JSON.stringify(indexJoueurs(liste.roles, style), null, 2)}\n`);
  ecrire(FICHIER_FIGURANTS, `${JSON.stringify(TYPES_FIGURANTS, null, 2)}\n`);
  ecrire(`modules/${MODULE}/CREDITS.md`, credits(liste));
  return liste;
}

if (lanceDirectement(import.meta.url)) {
  const liste = fabriquerJetons({ source: argumentSource() });
  console.log(`${liste.roles.length} jetons de rôle (dont le jeton neutre « ${JETON_NEUTRE} »), ${liste.metiers.length} de métier, ${liste.batiments.length} de bâtiment et ${liste.figurants.length} de figurant, en version plate et en relief, dans ${DOSSIER_JETONS}/`);
  console.log(`Index des jetons de joueur : ${INDEX_JOUEURS["2d"]} et ${INDEX_JOUEURS["3d"]}`);
  console.log(`${Object.keys(TYPES_FIGURANTS).length} types de figurants dans ${FICHIER_FIGURANTS}`);
  const erreurs = verifierJetons();
  if (erreurs.length) { console.error(`Jetons non conformes :\n- ${erreurs.join("\n- ")}`); process.exit(1); }
  console.log("Lancer ensuite : npm run fabriquer-veillees");
}
