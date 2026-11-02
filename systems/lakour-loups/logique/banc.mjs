// Le Banc des accusés (variante). Logique pure.
//
// Réglage monde « banc » (faux par défaut), recopié à la distribution (etat.banc.actif). Public : etat.banc = { actif, tour,
// accusations: [{ par, contre }], juges: [acteurId jugés ce jour] } (remis à zéro chaque jour).
// - ACCUSER : pendant le débat (phase « jour »), chaque vivant (pas réduit au silence) accuse au plus UNE fois par jour, un autre
//   vivant ; chacun ne peut être accusé qu'UNE fois par jour (le premier qui l'accuse).
// - JUGER : les accusés passent au vote un par un, dans l'ordre des accusations (un vote d'exécution, vote.banc = { accuse },
//   un seul candidat) : voter pour l'accusé, c'est voter « pour » ; s'abstenir, c'est voter « contre ». Il est exécuté si les
//   « pour » pèsent au moins la moitié des voix des vivants (le total pondéré : le Bailli compte double, au total aussi) ; avec le
//   Gibet, plus de la moitié. Les voix du Dernier souffle comptent parmi les « pour », pas au total (ce sont des morts).
//   La cloche du Sonneur et le glas n'y changent rien (un seul accusé). Le Juge de paix peut annuler un jugement : il se rejoue.
//   Le ruban de la Tisserande joue comme d'habitude (une minute de plus).
// - Dès qu'un accusé est exécuté, les autres ne sont plus jugés ce jour-là (une exécution par jour) ; sans accusation, pas de vote.
import { normaliserEtat } from "./etat.mjs";

export const bancInitial = (actif = false) => ({ actif: Boolean(actif), tour: 0, accusations: [], juges: [] });

export function normaliserBanc(b) {
  const x = b && typeof b === "object" ? b : {};
  return { actif: Boolean(x.actif), tour: Number(x.tour) || 0,
    accusations: Array.isArray(x.accusations) ? x.accusations.map(a => ({ par: String(a?.par ?? ""), contre: String(a?.contre ?? "") })) : [],
    juges: Array.isArray(x.juges) ? x.juges.map(String) : [] };
}

// Le banc du jour (un banc d'un autre jour est vide).
const duJour = etat => (etat.banc.tour === etat.tour ? etat.banc : { ...bancInitial(etat.banc.actif), tour: etat.tour });

// Peut-il accuser ? -> { ok, raison: "" | "inactif" | "phase" | "absent" | "mort" | "silence" | "deja" | "cible" | "accuse" }
export function verifierAccusation({ villageois = [], etat: e, par = "", contre = "" } = {}) {
  const etat = normaliserEtat(e);
  const non = raison => ({ ok: false, raison });
  if (!etat.banc.actif) return non("inactif");
  if (etat.phase !== "jour" || etat.vote.ouvert) return non("phase");
  const a = villageois.find(v => v.id === par), c = villageois.find(v => v.id === contre);
  if (!a) return non("absent");
  if (a.vivant === false) return non("mort");
  if (a.silence) return non("silence");
  const banc = duJour(etat);
  if (banc.accusations.some(x => x.par === par)) return non("deja");
  if (!c || c.vivant === false || contre === par) return non("cible");
  if (banc.accusations.some(x => x.contre === contre)) return non("accuse");
  return { ok: true, raison: "" };
}

// L'accusation, inscrite au banc du jour. -> { ok, raison, etat }
export function accuser({ villageois = [], etat: e, par, contre } = {}) {
  const v = verifierAccusation({ villageois, etat: e, par, contre });
  const etat = normaliserEtat(e);
  if (!v.ok) return { ok: false, raison: v.raison, etat };
  etat.banc = duJour(etat);
  etat.banc.accusations.push({ par, contre });
  return { ok: true, raison: "", etat };
}

// L'accusé à juger maintenant : le premier du banc du jour pas encore jugé, encore vivant, tant que personne n'a été exécuté par
// un jugement aujourd'hui. -> acteurId | ""
export function prochainAccuse(e, villageois = []) {
  const etat = normaliserEtat(e);
  if (!etat.banc.actif || etat.banc.tour !== etat.tour) return "";
  const executeAujourdhui = etat.morts.some(m => m.cause === "vote" && m.tour === etat.tour);
  if (executeAujourdhui) return "";
  const vivant = id => villageois.length ? villageois.some(v => v.id === id && v.vivant !== false) : true;
  return etat.banc.accusations.map(a => a.contre).find(id => !etat.banc.juges.includes(id) && vivant(id)) ?? "";
}

// Un jugement s'ouvre : l'accusé est noté jugé (une seule fois par jour, sauf annulation du Juge de paix, qui rouvre le vote).
export function noterJugement(etat, accuse) {
  etat.banc = duJour(etat);
  if (!etat.banc.juges.includes(accuse)) etat.banc.juges.push(accuse);
  return etat;
}

// Le verdict d'un jugement (logique de cloreVote). votes : { votant: cible } ; vivants : [acteurId] des votants vivants ;
// poids : { votant: n } ; strict : le Gibet (plus de la moitié). -> { pour, total, condamne }
export function verdictDuBanc({ accuse, votes = {}, vivants = [], poids = {}, strict = false } = {}) {
  const p = id => (Number(poids[id]) > 0 ? Number(poids[id]) : 1);
  const pour = Object.entries(votes).filter(([, c]) => c === accuse).reduce((s, [votant]) => s + p(votant), 0);
  const total = vivants.reduce((s, id) => s + p(id), 0);
  const condamne = total > 0 && (strict ? pour * 2 > total : pour * 2 >= total);
  return { pour, total, condamne };
}
