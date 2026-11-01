// Une sélection faite au clic sur le plateau, chez le seul joueur qui choisit (choix de nuit, cible d'un pouvoir de jour).
// Logique pure : elle ne quitte jamais le navigateur du joueur ; seul le choix VALIDÉ part au MJ actif, par le socket.
//
// nouvelleSelection({ id, mode, candidats, nombre }) -> { id, mode, candidats, nombre, choisis: [] }
// basculer(sel, acteurId) -> nouvelle sélection (inchangée si ce n'est pas un candidat) :
//   nombre = 1 : le clic remplace le choix (ou l'annule s'il porte sur le même) ;
//   nombre > 1 : le clic ajoute ou retire, sans dépasser le nombre demandé.
// pretAValider(sel) : au moins une cible choisie (ou aucune à choisir).

export function nouvelleSelection({ id = "", mode = "nuit", candidats = [], nombre = 1 } = {}) {
  const n = Math.max(0, Math.floor(Number(nombre) || 0));
  return { id: String(id), mode, candidats: [...new Set(candidats.filter(Boolean))], nombre: n, choisis: [] };
}

export const estCandidat = (sel, acteurId) => Boolean(sel && sel.candidats.includes(acteurId));

export function basculer(sel, acteurId) {
  if (!estCandidat(sel, acteurId) || sel.nombre === 0) return sel;
  const choisis = [...sel.choisis];
  const i = choisis.indexOf(acteurId);
  if (i >= 0) choisis.splice(i, 1);
  else if (sel.nombre === 1) choisis.splice(0, choisis.length, acteurId);
  else if (choisis.length < sel.nombre) choisis.push(acteurId);
  return { ...sel, choisis };
}

export const pretAValider = sel => Boolean(sel) && (sel.nombre === 0 || sel.choisis.length > 0);
