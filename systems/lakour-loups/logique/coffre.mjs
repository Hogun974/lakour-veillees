// Le coffre des secrets : logique pure (navigateur et Node), sans Foundry.
//
// Les secrets de la partie vivent chez le MJ actif (scripts/secrets.mjs). Pour qu'un autre navigateur du MJ puisse les
// reprendre, ils sont aussi rangés CHIFFRÉS sur le serveur (réglage monde « coffre », livré à tous : illisible sans la
// clé). La clé (AES-GCM, 256 bits) reste chez le MJ ; chaque joueur en reçoit une PART, à lui seul, par le socket.
// Partage de Shamir à seuil 2, sur le corps des entiers modulo P = 2^521 - 1 (premier de Mersenne) : la droite
// y = k + a·x, où k est la clé et a un nombre tiré au hasard ; la part d'un joueur est le point (x, y), x tiré de son
// identifiant. Un point seul ne dit rien de k (pour tout k, un a l'explique) ; deux points donnent la droite, donc k.
// Un joueur seul ne lit donc pas les secrets ; deux joueurs connectés suffisent au MJ pour les retrouver.
//
// Le clair est complété d'espaces jusqu'à un multiple de TAILLE_BLOC : la taille du coffre ne trahit pas, nuit après
// nuit, qui a agi.

export const P = (1n << 521n) - 1n;
export const TAILLE_BLOC = 4096;

const mod = n => ((n % P) + P) % P;

function puissance(base, exposant) {
  let r = 1n, b = mod(base), e = exposant;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return r;
}
const inverse = n => puissance(n, P - 2n);

const versNombre = octets => octets.reduce((n, o) => (n << 8n) | BigInt(o), 0n);
function versOctets(n, taille) {
  const octets = new Uint8Array(taille);
  for (let i = taille - 1; i >= 0; i--) { octets[i] = Number(n & 0xffn); n >>= 8n; }
  return octets;
}
const hasard = taille => globalThis.crypto.getRandomValues(new Uint8Array(taille));
const enHex = n => n.toString(16);
const deHex = h => BigInt(`0x${String(h || "0")}`);

// L'abscisse d'un joueur : son identifiant lu comme un nombre (jamais nul, distinct d'un joueur à l'autre).
export const abscisse = userId => mod(versNombre(new TextEncoder().encode(String(userId))));

// Une nouvelle clé de partie : { partie, k, a } (nombres en hexadécimal, pour le stockage).
export function nouvelleCle(partie) {
  return { partie, k: enHex(versNombre(hasard(32))), a: enHex(mod(versNombre(hasard(72)))) };
}

// La part d'un joueur : { partie, x, y }.
export function partDe(cle, userId) {
  const x = abscisse(userId);
  return { partie: cle.partie, x: enHex(x), y: enHex(mod(deHex(cle.k) + deHex(cle.a) * x)) };
}

// La clé retrouvée à partir de deux parts de la même partie ({ partie, k, a }), ou null.
export function reconstituer(parts = []) {
  const valides = parts.filter(p => p?.partie && p.x && p.y);
  for (let i = 0; i < valides.length; i++) {
    for (let j = i + 1; j < valides.length; j++) {
      const [p, q] = [valides[i], valides[j]];
      if (p.partie !== q.partie) continue;
      const [x1, y1, x2, y2] = [deHex(p.x), deHex(p.y), deHex(q.x), deHex(q.y)];
      if (x1 === x2) continue;
      const a = mod((y2 - y1) * inverse(x2 - x1));
      return { partie: p.partie, k: enHex(mod(y1 - a * x1)), a: enHex(a) };   // une part fausse donne une clé qui n'ouvre rien
    }
  }
  return null;
}

const versBase64 = octets => btoa(Array.from(octets, o => String.fromCharCode(o)).join(""));
const deBase64 = texte => Uint8Array.from(atob(texte), c => c.charCodeAt(0));
const cleAES = (cle, usage) => globalThis.crypto.subtle.importKey("raw", versOctets(deHex(cle.k), 32), "AES-GCM", false, [usage]);

// Chiffre les secrets : { partie, iv, donnees } (base64), à ranger dans le réglage monde « coffre ».
export async function sceller(secret, cle) {
  const clair = JSON.stringify(secret);
  const complete = clair.padEnd(Math.ceil((clair.length + 1) / TAILLE_BLOC) * TAILLE_BLOC, " ");
  const iv = hasard(12);
  const chiffre = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cleAES(cle, "encrypt"),
    new TextEncoder().encode(complete));
  return { partie: cle.partie, iv: versBase64(iv), donnees: versBase64(new Uint8Array(chiffre)) };
}

// Les secrets du coffre, ou null (mauvaise clé, autre partie, coffre abîmé : AES-GCM refuse tout ce qui a été touché).
export async function ouvrir(coffre, cle) {
  if (!coffre?.donnees || !cle?.k || coffre.partie !== cle.partie) return null;
  try {
    const clair = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(coffre.iv) }, await cleAES(cle, "decrypt"),
      deBase64(coffre.donnees));
    const secret = JSON.parse(new TextDecoder().decode(clair));
    return secret?.partie === coffre.partie ? secret : null;
  } catch { return null; }
}
