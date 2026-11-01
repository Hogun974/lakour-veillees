// Qui peut écrire au chat. Logique pure, appliquée dans le navigateur de l'auteur (refus avant l'envoi) et, en garde,
// chez le MJ actif (un message passé outre est retiré).
//
// - le MJ n'est jamais bloqué, ni un utilisateur sans villageois (spectateur) ;
// - un MORT ne parle plus aux vivants : un message public ou chuchoté à un vivant est refusé ; avec le canal des morts,
//   il est changé en chuchotement aux seuls morts et au MJ ; un chuchotement au seul MJ (et aux morts, si le canal est
//   ouvert) passe tel quel ;
// - un villageois RÉDUIT AU SILENCE se tait pendant le débat et le vote du jour (phases « jour » et « vote ») : seul un
//   chuchotement au MJ passe.
//
// decisionParole({ mj, moi: { vivant, silence } | null, phase, chuchote: [userId], mjs: [userId], morts: [userId],
//   canalDesMorts }) -> { ok: true } | { ok: true, chuchoter: [userId] } | { ok: false, raison: "mort" | "silence" }

export const PHASES_DU_SILENCE = ["jour", "vote"];

export function decisionParole({ mj = false, moi = null, phase = "", chuchote = [], mjs = [], morts = [], canalDesMorts = true } = {}) {
  if (mj || !moi) return { ok: true };
  const versSeulement = permis => chuchote.length > 0 && chuchote.every(id => permis.includes(id));
  if (moi.vivant === false) {
    const permis = [...mjs, ...(canalDesMorts ? morts : [])];
    if (versSeulement(permis)) return { ok: true };
    if (canalDesMorts) return { ok: true, chuchoter: [...new Set(permis)] };
    return { ok: false, raison: "mort" };
  }
  if (moi.silence && PHASES_DU_SILENCE.includes(phase)) {
    if (versSeulement(mjs)) return { ok: true };
    return { ok: false, raison: "silence" };
  }
  return { ok: true };
}

// Un message déjà envoyé (garde du MJ actif) : faut-il le retirer ? Oui s'il aurait dû être refusé, ou s'il devait être
// changé en chuchotement aux morts et ne l'a pas été.
export function messageARetirer(entree) {
  const d = decisionParole(entree);
  return !d.ok || Boolean(d.chuchoter);
}
