// Le coffre des secrets d'AVANT 0.9.0 : logique pure (navigateur et Node), gardée pour la seule migration d'une partie en cours.
//
// Depuis 0.9.0, les secrets des Veillées sont scellés avec le coffre du MJ IA (lakour-mj-ia, scripts/coffre.js et
// coffre-logique.js : seuil à la majorité des comptes joueurs, parts accusées, empreinte, renouvellement, clé de secours), voir
// scripts/coffre.mjs. L'ancien coffre ({ partie, iv, donnees }, AES-GCM, clé { partie, k } rangée dans le navigateur du MJ sous
// le réglage client « cleCoffre ») ne sert plus qu'à reprendre, dans le MÊME navigateur du MJ, une partie commencée avant la
// mise à jour : il est ouvert une fois, puis rescellé avec le coffre du MJ IA. Les anciennes parts des joueurs (seuil 2, rendues
// à n'importe quel MJ) ne sont plus acceptées : elles sont effacées chez chaque joueur.

const versOctets = (n, taille) => {
  const octets = new Uint8Array(taille);
  for (let i = taille - 1; i >= 0; i--) { octets[i] = Number(n & 0xffn); n >>= 8n; }
  return octets;
};
const deHex = h => { try { return BigInt(`0x${String(h || "0")}`); } catch { return 0n; } };
const deBase64 = texte => Uint8Array.from(atob(texte), c => c.charCodeAt(0));

// Un coffre de l'ancienne forme (sans la marque « chiffre » des objets scellés du MJ IA).
export const estAncien = coffre => Boolean(coffre && typeof coffre === "object" && coffre.donnees && coffre.iv && coffre.partie && !coffre.chiffre);

// Les secrets d'un ancien coffre avec l'ancienne clé, ou null (mauvaise clé, autre partie, coffre abîmé).
export async function ouvrirAncien(coffre, cle) {
  if (!estAncien(coffre) || !cle?.k || coffre.partie !== cle.partie) return null;
  try {
    const k = await globalThis.crypto.subtle.importKey("raw", versOctets(deHex(cle.k), 32), "AES-GCM", false, ["decrypt"]);
    const clair = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(coffre.iv) }, k, deBase64(coffre.donnees));
    const secret = JSON.parse(new TextDecoder().decode(clair));
    return secret?.partie === coffre.partie ? secret : null;
  } catch { return null; }
}
