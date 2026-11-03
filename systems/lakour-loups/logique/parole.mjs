// Qui peut écrire au chat. Logique pure, appliquée dans le navigateur de l'auteur (refus avant l'envoi) et, en garde,
// chez le MJ actif (un message passé outre est retiré).
//
// Foundry v14 livre TOUT message de chat à tous les navigateurs, chuchotements compris (contrat §6) : un chuchotement n'est
// jamais secret. Depuis 0.9.0, ce qui ne doit être lu que de quelques-uns ne passe donc plus par un document ChatMessage mais
// par un RELAIS du MJ actif (socket, { recipients }) : le message s'affiche localement chez ses seuls destinataires
// (scripts/parole.mjs). Pendant une partie (une partie distribuée, pas encore finie) :
// - le MJ n'est jamais bloqué, ni un utilisateur sans villageois (spectateur) quand il parle à tous ;
// - un MORT ne parle plus aux vivants : avec le canal des morts, tout ce qu'il écrit part au relais « morts » (les morts et
//   les MJ) ; un message au seul MJ, au relais « mj » ; sans le canal, le reste est refusé ;
// - un villageois RÉDUIT AU SILENCE se tait pendant le débat et le vote du jour (phases « jour » et « vote ») : seul un mot au
//   MJ passe (relais « mj ») ;
// - un CHUCHOTEMENT de joueur (spectateur compris) : au seul MJ, il part au relais « mj » ; à un autre joueur, il est refusé
//   (il serait lisible de tous dans la console).
// Hors partie (préparatifs sans distribution, partie finie), le chat est libre, chuchotements compris.
//
// - un message « pour soi » (jet de dés privé à soi seul) : affiché chez son auteur seul, sans document ; un jet « MJ seul » ou
//   « aveugle » part au relais « mj » avec sa formule et son résultat (scripts/parole.mjs, resumeDesJets).
// decisionParole({ mj, moiId, moi: { vivant, silence } | null, phase, chuchote: [userId], mjs: [userId], morts: [userId],
//   canalDesMorts, enPartie }) -> { ok: true } | { ok: false, relais: "morts" | "mj" } | { ok: false, local: true }
//   | { ok: false, raison: "mort" | "silence" | "chuchotement" }

export const PHASES_DU_SILENCE = ["jour", "vote"];
export const CANAUX_DE_RELAIS = ["morts", "mj"];
// Un message relayé : une ligne de chat, pas un roman.
export const LONGUEUR_RELAIS = 1000;

export function decisionParole({ mj = false, moiId = "", moi = null, phase = "", chuchote = [], mjs = [], morts = [], canalDesMorts = true, enPartie = true } = {}) {
  if (mj || !enPartie) return { ok: true };
  // Un message « pour soi » (jet de dés privé : chuchoté à soi seul) : affiché chez lui seul, sans document (relecture 7).
  if (moiId && chuchote.length && chuchote.every(id => id === moiId)) return { ok: false, local: true };
  const versSeulement = permis => chuchote.length > 0 && chuchote.every(id => permis.includes(id));
  const auMJ = versSeulement(mjs);
  if (moi && moi.vivant === false) {
    if (canalDesMorts) return { ok: false, relais: auMJ ? "mj" : "morts" };
    if (auMJ) return { ok: false, relais: "mj" };
    return { ok: false, raison: "mort" };
  }
  if (moi?.silence && PHASES_DU_SILENCE.includes(phase)) {
    if (auMJ) return { ok: false, relais: "mj" };
    return { ok: false, raison: "silence" };
  }
  if (chuchote.length) return auMJ ? { ok: false, relais: "mj" } : { ok: false, raison: "chuchotement" };
  return { ok: true };
}

// Un message déjà envoyé (garde du MJ actif) : faut-il le retirer ? Oui s'il aurait dû être refusé ou relayé.
export function messageARetirer(entree) {
  return !decisionParole(entree).ok;
}

// Le relais, chez le MJ actif : à qui livrer un message de ce joueur (jamais à lui-même : il l'affiche déjà), ou null s'il n'y a
// pas droit. canal "morts" : un mort (canal ouvert) écrit aux morts et aux MJ ; canal "mj" : tout joueur écrit aux MJ.
// Le Dernier souffle (relecture 7, comme les salons vocaux : logique/salons.mjs) : avec « mortsVoientTout », les morts se partagent
// en deux canaux — ceux qui gardent leur souffle (ils votent encore : rien des rôles cachés) entre eux, ceux qui l'ont rendu (et voient
// tout) entre eux. moi.souffle : l'auteur garde le sien ; souffles : les morts (userId) qui gardent le leur.
export function destinatairesDuRelais({ canal, auteur, moi = null, mjs = [], morts = [], souffles = [], mortsVoientTout = true, canalDesMorts = true, enPartie = true } = {}) {
  if (!CANAUX_DE_RELAIS.includes(canal) || !auteur || !enPartie) return null;
  if (canal === "morts" && !(canalDesMorts && moi && moi.vivant === false)) return null;
  const memeCanal = id => !mortsVoientTout || souffles.includes(id) === Boolean(moi?.souffle);
  const liste = canal === "morts" ? [...mjs, ...morts.filter(memeCanal)] : [...mjs];
  return [...new Set(liste)].filter(id => id && id !== auteur);
}

// Le résumé d'un jet de dés relayé : [{ formule, total }] et sa légende -> « Légende : 1d20+2 → 17 ; 2d6 → 7 » ("" sans jet).
export function resumeDesJets(jets = [], legende = "") {
  const parties = (jets ?? []).filter(j => j && (j.formule || j.total !== undefined)).map(j => `${j.formule ?? "?"} → ${j.total ?? "?"}`);
  if (!parties.length) return "";
  const titre = texteDuRelais(legende);
  return `🎲 ${titre ? `${titre} : ` : ""}${parties.join(" ; ")}`;
}

// Le texte d'un message relayé : sans balises, sur LONGUEUR_RELAIS caractères au plus ("" : rien à relayer).
export function texteDuRelais(texte) {
  const brut = String(texte ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return brut.length > LONGUEUR_RELAIS ? `${brut.slice(0, LONGUEUR_RELAIS - 1)}…` : brut;
}
