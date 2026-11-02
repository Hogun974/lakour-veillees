// Le Dernier souffle : chaque mort garde UNE voix pour le reste de la partie. Logique pure.
//
// Réglage monde « dernierSouffle » (vrai par défaut), recopié dans l'état à la distribution (etat.souffle.actif). Public :
// etat.souffle = { actif, utilises: [acteurId] } (les morts qui ont déjà rendu leur dernier souffle).
// - Un mort qui n'a pas encore soufflé peut voter à un vote d'EXÉCUTION seulement (ni la Chapelle, ni l'élection du Bailli) ;
//   sa voix pèse 1 et se change tant que le vote est ouvert, comme celle d'un vivant ; il n'est jamais candidat.
// - Le souffle est rendu au dépouillement d'un vote où sa voix compte (resultat.souffles) ; un vote prolongé par le ruban ne
//   le consomme pas encore ; un vote annulé par le Juge de paix l'a consommé (il a été dépouillé).
// - Le total du Gibet ne compte que les morts qui ont soufflé à ce vote (pas tous les morts, qui pèseraient sans voter).
// - Les morts parlent entre eux dans leur salon (logique/salons.mjs : « morts », réglage « mortsVoientTout » pour la tanière) :
//   le souffle ne leur rend pas la parole auprès des vivants.

export const souffleInitial = (actif = false) => ({ actif: Boolean(actif), utilises: [] });

export function normaliserSouffle(s) {
  const x = s && typeof s === "object" ? s : {};
  return { actif: Boolean(x.actif), utilises: Array.isArray(x.utilises) ? [...new Set(x.utilises.map(String))] : [] };
}

const mort = v => Boolean(v) && v.vivant === false;

// Ce mort a-t-il encore son dernier souffle ? (v : un villageois à plat, ou { id, vivant })
export const aSonSouffle = (etat, v) => Boolean(etat?.souffle?.actif) && mort(v) && !(etat.souffle.utilises ?? []).includes(v.id);

// Les morts qui ont encore leur souffle.
export const souffleurs = ({ etat, villageois = [] }) => villageois.filter(v => aSonSouffle(etat, v)).map(v => v.id);

// Qui peut voter au vote ouvert : les vivants, et à un vote d'exécution, les morts qui ont encore leur souffle.
export function votantsAdmis({ etat, villageois = [] }) {
  const vivants = villageois.filter(v => !mort(v)).map(v => v.id);
  if ((etat?.vote?.objet ?? "execution") !== "execution") return vivants;
  return [...vivants, ...souffleurs({ etat, villageois })];
}

// Qui a voté au vote ouvert, vivants et morts à part : { exprimes: vivants qui ont voté, attendus: vivants, souffles: morts qui
// ont soufflé }. Les voix qui manquent sont celles des vivants ; un mort n'est jamais attendu.
export function compteDesVoix({ etat, villageois = [] }) {
  const vivants = new Set(villageois.filter(v => !mort(v)).map(v => v.id));
  const exprimes = etat?.vote?.exprimes ?? [];
  return { exprimes: exprimes.filter(id => vivants.has(id)).length, attendus: vivants.size, souffles: exprimes.filter(id => !vivants.has(id)).length };
}

// Ce mort peut-il souffler maintenant (bandeau, fenêtre de vote) ?
export const peutSouffler = (etat, v) => Boolean(etat?.vote?.ouvert) && etat.vote.objet === "execution" && aSonSouffle(etat, v);
