// Petite grammaire des messages : élision, accord en nombre et accord en genre, sans Foundry (éprouvée par essais/grammaire.test.mjs).
//
// remplir(gabarit, donnees, { langue, genres, genreDe, genre }) remplace les {cle} d'un gabarit de langue (comme game.i18n.format) et,
// en plus :
// - en français, élide le mot qui précède une donnée commençant par une voyelle : « on raconte que {indice} » avec
//   « une seule maison… » donne « on raconte qu'une seule maison… » ; « de {nom} » avec « Anne » donne « d'Anne ».
//   Mots élidés : que (et jusque, lorsque, puisque), de, le, la, ne, se, je, me, te. Le « h » n'est jamais élidé (h aspiré).
// - accorde les marques de nombre du gabarit sur la dernière donnée numérique qui les précède (à défaut : donnees.n) :
//   « (s) », « (x) », « (es) » s'ajoutent au pluriel, « (singulier|pluriel) » choisit une forme. Singulier : moins de 2 en
//   français (0 loup, 1 loup), exactement 1 en anglais (0 wolves, 1 wolf). Sans nombre connu, la marque reste telle quelle.
//   « {n} loup(s) (vit|vivent) encore » -> « 1 loup vit encore », « 3 loups vivent encore ».
// - accorde les marques de genre « [masculin|féminin] » sur le genre (« homme » / « femme ») d'une donnée qui nomme quelqu'un : la
//   dernière donnée de genre connu qui précède la marque (à défaut : la première qui la suit ; à défaut : l'option genre, puis le
//   masculin). « [cle:masculin|féminin] » suit la donnée « cle » elle-même. Le genre d'une donnée : genres[cle], sinon
//   genreDe(valeur, cle) (le système y lit les traits visibles du villageois nommé : scripts/donnees.mjs). Une forme peut être vide :
//   « {nom} n'est pas exécuté[|e] » -> « Edmée n'est pas exécutée » ; « {qui}, [le Prieur|la Prieure], … » ; « [he|she] ».
// Une donnée absente laisse « {cle} » visible (plutôt que « undefined »).

const ELIDABLE = /(^|[\s«( "'’])(jusque|lorsque|puisque|que|de|le|la|ne|se|je|me|te) $/iu;
const VOYELLE = /^[aeiouàâäéèêëîïôöùûüœæ]/iu;
// (Une marque de nombre ne contient jamais de crochets : « (voter pour [l'accusé le|l'accusée la] condamne) » n'en est pas une.)
const MARQUE = /\{(\w+)\}|\((s|x|es)\)|\(([^()|{}[\]]*)\|([^()|{}[\]]*)\)|\[(?:(\w+):)?([^[\]|{}]*)\|([^[\]|{}]*)\]/g;
// Une marque de genre, pour la reconnaître ailleurs (politiques.mjs lit les gabarits ; les essais vérifient les langues).
export const MARQUE_DE_GENRE = /\[(?:(\w+):)?([^[\]|{}]*)\|([^[\]|{}]*)\]/g;
export const aDesMarquesDeGenre = gabarit => /\[(?:\w+:)?[^[\]|{}]*\|[^[\]|{}]*\]/.test(String(gabarit ?? ""));
const genreValide = g => (g === "femme" || g === "homme" ? g : "");

const nombreDe = v => (typeof v === "number" && Number.isFinite(v)) ? v
  : typeof v === "string" && /^\s*-?\d+\s*$/.test(v) ? Number(v) : null;

export const auSingulier = (n, langue = "fr") => (String(langue).startsWith("fr") ? Math.abs(n) < 2 : Math.abs(n) === 1);

// « que » + « une seule maison » -> « qu'une seule maison » ; « que » + « Bastien » -> « que Bastien ».
export function elider(mot, suite) {
  const texte = String(suite ?? "");
  if (!VOYELLE.test(texte) || !/^(jusque|lorsque|puisque|que|de|le|la|ne|se|je|me|te)$/iu.test(mot)) return `${mot} ${texte}`;
  return `${mot.slice(0, -1)}'${texte}`;
}

// La forme qui convient à un genre : genre « femme » -> la féminine, sinon la masculine. accorder("homme", "exécuté", "exécutée").
export const accorder = (genre, masculin, feminin) => (genreValide(genre) === "femme" ? feminin : masculin);

export function remplir(gabarit, donnees = {}, { langue = "fr", genres = {}, genreDe = null, genre = "" } = {}) {
  const fr = String(langue).startsWith("fr");
  const d = donnees ?? {};
  const defaut = nombreDe(d.n);
  const source = String(gabarit ?? "");
  const avecGenre = aDesMarquesDeGenre(source);
  // Le genre d'une donnée, cherché une fois (genreDe peut lire l'état du jeu) et seulement si une marque de genre le demande.
  const connus = new Map();
  const genreDeLaCle = cle => {
    if (!connus.has(cle)) {
      let g = genreValide((genres ?? {})[cle]);
      if (!g && typeof genreDe === "function" && d[cle] !== undefined && d[cle] !== null) {
        try { g = genreValide(genreDe(d[cle], cle)); } catch { g = ""; }
      }
      connus.set(cle, g);
    }
    return connus.get(cle);
  };
  const marques = [...source.matchAll(MARQUE)];
  const morceaux = [];
  let dernier = null, dernierGenre = "", pos = 0;
  for (const [i, m] of marques.entries()) {
    morceaux.push(source.slice(pos, m.index));
    pos = m.index + m[0].length;
    if (m[6] !== undefined) {
      // Le genre : la donnée nommée ; sinon la dernière de genre connu, sinon la première qui suit ; sinon l'option, sinon le masculin.
      let g = m[5] !== undefined ? genreDeLaCle(m[5]) : dernierGenre;
      if (!g && m[5] === undefined) {
        for (const x of marques.slice(i + 1)) if (x[1] !== undefined && (g = genreDeLaCle(x[1]))) break;
      }
      morceaux.push(accorder(g || genre, m[6], m[7]));
      continue;
    }
    if (m[1] !== undefined) {
      const v = d[m[1]];
      if (v === undefined || v === null) { morceaux.push(m[0]); continue; }
      const nb = nombreDe(v);
      if (nb !== null) dernier = nb;
      if (avecGenre) { const g = genreDeLaCle(m[1]); if (g) dernierGenre = g; }
      const texte = String(v);
      const avant = morceaux.length - 1;
      if (fr && VOYELLE.test(texte) && ELIDABLE.test(morceaux[avant])) {
        morceaux[avant] = morceaux[avant].replace(ELIDABLE, (_, bord, mot) => `${bord}${mot.slice(0, -1)}'`);
      }
      morceaux.push(texte);
      continue;
    }
    const n = dernier ?? defaut;
    if (n === null) { morceaux.push(m[0]); continue; }
    const un = auSingulier(n, langue);
    morceaux.push(m[2] !== undefined ? (un ? "" : m[2]) : (un ? m[3] : m[4]));
  }
  morceaux.push(source.slice(pos));
  return morceaux.join("");
}
