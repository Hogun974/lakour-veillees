// Petite grammaire des messages : élision et accord en nombre, sans Foundry (éprouvée par essais/grammaire.test.mjs).
//
// remplir(gabarit, donnees, { langue }) remplace les {cle} d'un gabarit de langue (comme game.i18n.format) et, en plus :
// - en français, élide le mot qui précède une donnée commençant par une voyelle : « on raconte que {indice} » avec
//   « une seule maison… » donne « on raconte qu'une seule maison… » ; « de {nom} » avec « Anne » donne « d'Anne ».
//   Mots élidés : que (et jusque, lorsque, puisque), de, le, la, ne, se, je, me, te. Le « h » n'est jamais élidé (h aspiré).
// - accorde les marques de nombre du gabarit sur la dernière donnée numérique qui les précède (à défaut : donnees.n) :
//   « (s) », « (x) », « (es) » s'ajoutent au pluriel, « (singulier|pluriel) » choisit une forme. Singulier : moins de 2 en
//   français (0 loup, 1 loup), exactement 1 en anglais (0 wolves, 1 wolf). Sans nombre connu, la marque reste telle quelle.
//   « {n} loup(s) (vit|vivent) encore » -> « 1 loup vit encore », « 3 loups vivent encore ».
// Une donnée absente laisse « {cle} » visible (plutôt que « undefined »).

const ELIDABLE = /(^|[\s«( "'’])(jusque|lorsque|puisque|que|de|le|la|ne|se|je|me|te) $/iu;
const VOYELLE = /^[aeiouàâäéèêëîïôöùûüœæ]/iu;
const MARQUE = /\{(\w+)\}|\((s|x|es)\)|\(([^()|{}]*)\|([^()|{}]*)\)/g;

const nombreDe = v => (typeof v === "number" && Number.isFinite(v)) ? v
  : typeof v === "string" && /^\s*-?\d+\s*$/.test(v) ? Number(v) : null;

export const auSingulier = (n, langue = "fr") => (String(langue).startsWith("fr") ? Math.abs(n) < 2 : Math.abs(n) === 1);

// « que » + « une seule maison » -> « qu'une seule maison » ; « que » + « Bastien » -> « que Bastien ».
export function elider(mot, suite) {
  const texte = String(suite ?? "");
  if (!VOYELLE.test(texte) || !/^(jusque|lorsque|puisque|que|de|le|la|ne|se|je|me|te)$/iu.test(mot)) return `${mot} ${texte}`;
  return `${mot.slice(0, -1)}'${texte}`;
}

export function remplir(gabarit, donnees = {}, { langue = "fr" } = {}) {
  const fr = String(langue).startsWith("fr");
  const d = donnees ?? {};
  const defaut = nombreDe(d.n);
  const morceaux = [];
  let dernier = null, pos = 0;
  for (const m of String(gabarit ?? "").matchAll(MARQUE)) {
    morceaux.push(String(gabarit).slice(pos, m.index));
    pos = m.index + m[0].length;
    if (m[1] !== undefined) {
      const v = d[m[1]];
      if (v === undefined || v === null) { morceaux.push(m[0]); continue; }
      const nb = nombreDe(v);
      if (nb !== null) dernier = nb;
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
  morceaux.push(String(gabarit ?? "").slice(pos));
  return morceaux.join("");
}
