// Hasard reproductible : une graine (nombre ou texte) donne toujours la même suite. Sans graine : Math.random.

// Graine texte -> entier 32 bits (FNV-1a).
export function hacher(texte) {
  let h = 0x811c9dc5;
  for (const c of String(texte)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Générateur mulberry32 : renvoie une fonction () -> [0, 1).
export function creerHasard(graine) {
  if (graine === undefined || graine === null || graine === "") return Math.random;
  let a = (typeof graine === "number" ? graine : hacher(graine)) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mélange de Fisher-Yates, sans toucher au tableau d'origine.
export function melanger(tableau, hasard = Math.random) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export function choisir(tableau, hasard = Math.random) {
  if (!tableau.length) return undefined;
  return tableau[Math.floor(hasard() * tableau.length)];
}
