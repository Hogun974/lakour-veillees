// Décompte du vote du village. Logique pure.
//
// Règles :
// - un vote ne compte que s'il vient d'un votant admis (vivant) et désigne un candidat ; "" ou null = abstention ;
// - chaque voix pèse 1, ou le poids donné à ce votant (`poids`, ex. une voix qui compte double) ;
// - égalité en tête -> personne n'est désigné ;
// - vote double (la cloche du Sonneur) : deux villageois sont désignés, les deux premiers ; une égalité qui
//   déborde la place restante laisse cette place vide (personne) ;
// - majorité absolue (le Gibet) : il faut plus de la moitié des voix possibles des votants admis.

export function decompterVotes({ votes = {}, candidats = null, votants = null, double = false, poids = {}, majoriteAbsolue = false } = {}) {
  const admisCandidats = candidats?.length ? new Set(candidats) : null;
  const admisVotants = votants ? new Set(votants) : null;
  const valides = {};
  const decompte = {};
  for (const [votant, cible] of Object.entries(votes)) {
    if (!cible) continue;
    if (admisVotants && !admisVotants.has(votant)) continue;
    if (admisCandidats && !admisCandidats.has(cible)) continue;
    valides[votant] = cible;
    decompte[cible] = (decompte[cible] ?? 0) + poidsDe(poids, votant);
  }

  // Groupes de même score, du plus fort au plus faible.
  const scores = [...new Set(Object.values(decompte))].sort((a, b) => b - a);
  const groupes = scores.map(s => Object.keys(decompte).filter(id => decompte[id] === s).sort());
  const places = double ? 2 : 1;
  const elus = [];
  for (const groupe of groupes) {
    if (elus.length + groupe.length > places) break;   // égalité qui déborde : personne pour la place restante
    elus.push(...groupe);
    if (elus.length === places) break;
  }

  // Majorité absolue : sur les voix possibles des votants admis (à défaut, sur les voix exprimées).
  let retenus = elus;
  if (majoriteAbsolue) {
    const total = admisVotants
      ? [...admisVotants].reduce((s, v) => s + poidsDe(poids, v), 0)
      : Object.keys(valides).reduce((s, v) => s + poidsDe(poids, v), 0);
    retenus = elus.filter(id => decompte[id] * 2 > total);
  }

  const tete = groupes[0] ?? [];
  return {
    decompte,
    votes: valides,
    elus: retenus,
    elu: retenus[0] ?? null,
    egalite: tete.length > places
  };
}

function poidsDe(poids, votant) {
  const p = Number(poids?.[votant]);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

// Majorité simple d'un petit groupe (la meute) : le plus choisi ; égalité -> le premier choisi dans le temps.
// choix : [{ votant, cible, quand }]
// L'échéance d'un vote ouvert à minuteur : -> { cle, dans } (ms avant zéro), ou null (pas de vote ouvert, ou sans minuteur).
// La clé change avec le vote (nouveau numéro, ou prolongé d'une minute par le ruban) : l'ancienne échéance ne vaut plus.
export function echeanceDuVote(vote, maintenant = Date.now()) {
  if (!vote?.ouvert || !(vote.finit > 0)) return null;
  return { cle: `${vote.numero}|${vote.finit}`, dans: Math.max(0, vote.finit - maintenant) };
}

export function majoriteMeute(choix = []) {
  const valides = choix.filter(c => c?.cible);
  if (!valides.length) return null;
  const decompte = {};
  for (const c of valides) decompte[c.cible] = (decompte[c.cible] ?? 0) + 1;
  const max = Math.max(...Object.values(decompte));
  const enTete = new Set(Object.keys(decompte).filter(id => decompte[id] === max));
  const ordonnes = [...valides].sort((a, b) => (a.quand ?? 0) - (b.quand ?? 0));
  return ordonnes.find(c => enTete.has(c.cible)).cible;
}
