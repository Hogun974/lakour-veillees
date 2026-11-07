// Les Gens de passage, les départs et l'exil. Logique pure.
//
// Réglage monde « gensDePassage » (vrai par défaut : sans lui, personne ne peut entrer en cours de partie), recopié à la
// distribution (etat.passage.actif). Public : etat.passage = { actif, gens: { acteurId: { cle, tour } } }, etat.partis =
// [{ acteurId, tour, comment: "exil" | "depart" }].
// - L'ARRIVÉE : un joueur qui arrive en cours de partie (à l'aube ou au débat, pas pendant un vote, ni la nuit, ni une partie
//   finie) entre comme gens de passage : un rôle de passage (ROLES_DE_PASSAGE, PUBLIC : le village sait qui il est) et un camp
//   SECRET, tiré pour ne pas déséquilibrer (campDePassage : la meute si elle est en dessous de son compte, sinon le village ;
//   jamais la meute dans une peste noire, qui n'a pas de loup). Son pouvoir est fort mais ponctuel (une fois, de jour : jour.mjs).
// - LE DÉPART : un joueur qui doit partir tôt quitte la veillée sans mourir : ni mort, ni rôle révélé, ni camp annoncé ; sa voix en
//   cours est retirée, il n'agit plus ; il ne gagne ni ne perd. S'il était le Bailli, la charge devient vacante (personne à qui
//   demander le sceau). La partie continue avec les autres (la victoire est vérifiée comme après une mort).
// - L'EXIL : le village peut chasser un gens de passage par un vote d'exil (objet "exil", candidats : les gens de passage) : l'élu
//   part comme ci-dessus, son camp n'est pas révélé.
// Le système marque un parti « vivant: false » sur son document (toutes les règles le comptent alors absent : votes, nuit,
// victoire, Dernier souffle exclu) et le range dans etat.partis, jamais dans etat.morts.
import { choisir } from "./hasard.mjs";
import { normaliserEtat } from "./etat.mjs";
import { nombreDeLoups } from "./composition.mjs";
import { inscrire } from "./registre.mjs";
import { ajouterAuCercle } from "./cercle.mjs";

export const ROLES_DE_PASSAGE = ["remouleur", "montreur-d-ours", "pelerine"];
export const PHASES_ARRIVEE = ["aube", "jour"];

export const passageInitial = (actif = false) => ({ actif: Boolean(actif), gens: {} });

export function normaliserPassage(p) {
  const x = p && typeof p === "object" ? p : {};
  const gens = x.gens && typeof x.gens === "object" ? Object.fromEntries(Object.entries(x.gens).map(([id, g]) => [id, { cle: String(g?.cle ?? ""), tour: Number(g?.tour) || 0 }])) : {};
  return { actif: Boolean(x.actif), gens };
}

export const estParti = (etat, id) => (etat?.partis ?? []).some(p => p.acteurId === id);

// Peut-on accueillir un gens de passage maintenant ? -> { ok, raison: "" | "inactif" | "fin" | "phase" | "vote" }
export function verifierArrivee(e) {
  const etat = normaliserEtat(e);
  const non = raison => ({ ok: false, raison });
  if (!etat.passage.actif) return non("inactif");
  if (!etat.partie || etat.phase === "fin" || etat.vainqueur) return non("fin");
  if (!PHASES_ARRIVEE.includes(etat.phase)) return non("phase");
  if (etat.vote.ouvert) return non("vote");
  return { ok: true, raison: "" };
}

// Le camp secret d'un gens de passage : la meute si elle est en dessous de son compte pour le village qui s'agrandit (avec une
// part de hasard, pour que rien ne soit sûr), sinon le village (et parfois la meute). Jamais la meute dans une peste noire.
// villageois : les présents (vivants) AVANT son arrivée ; niveau : celui de la veillée (les débutants ont un loup de moins, nombreDeLoups).
export function campDePassage({ villageois = [], peste = false, hasard = Math.random, niveau = "" } = {}) {
  if (peste) return "village";
  const vivants = villageois.filter(v => v.vivant !== false);
  const loups = vivants.filter(v => v.camp === "meute").length;
  const manque = loups < nombreDeLoups(vivants.length + 1, niveau);
  return hasard() < (manque ? 0.7 : 0.15) ? "meute" : "village";
}

// Le rôle de passage tiré : un de ceux du contenu (disponibles), pas encore venu dans cette partie si possible.
export function roleDePassage({ etat, disponibles = [], hasard = Math.random } = {}) {
  const possibles = ROLES_DE_PASSAGE.filter(c => disponibles.includes(c));
  const deja = new Set(Object.values(etat?.passage?.gens ?? {}).map(g => g.cle));
  const neufs = possibles.filter(c => !deja.has(c));
  return choisir(neufs.length ? neufs : possibles, hasard) ?? "";
}

// Un gens de passage entre (public : son rôle, et le tour de son arrivée ; son camp reste au MJ et sur son document).
export function accueillir(e, { acteurId, cle }) {
  const etat = normaliserEtat(e);
  etat.passage.gens[acteurId] = { cle, tour: etat.tour };
  inscrire(etat, { type: "passage", acteurId, comment: "arrivee", cle });
  // Il s'assoit au bout du cercle (cercle.mjs) : les voisins des autres ne changent pas.
  return ajouterAuCercle(etat, acteurId);
}

// Un villageois quitte la veillée (départ, ou exil voté) : ni mort ni révélé ; sa voix en cours retirée, et celles qui le
// désignaient ; seul candidat du vote (accusé du Banc, gens de passage d'un exil) : le vote se clôt sans élu (resultat.depart) ;
// Bailli : vacance.
export function partir(e, { acteurId, comment = "depart" }) {
  const etat = normaliserEtat(e);
  if (estParti(etat, acteurId) || etat.morts.some(m => m.acteurId === acteurId)) return etat;
  etat.partis.push({ acteurId, tour: etat.tour, comment });
  if (etat.vote.ouvert && acteurId in etat.vote.votes) {
    delete etat.vote.votes[acteurId];
    etat.vote.exprimes = Object.keys(etat.vote.votes);
  }
  if (etat.vote.ouvert && etat.vote.candidats.includes(acteurId)) {
    for (const [votant, cible] of Object.entries(etat.vote.votes)) if (cible === acteurId) delete etat.vote.votes[votant];
    etat.vote.exprimes = Object.keys(etat.vote.votes);
  }
  etat.vote.candidats = etat.vote.ouvert ? etat.vote.candidats.filter(id => id !== acteurId) : etat.vote.candidats;
  if (etat.vote.ouvert && (!etat.vote.candidats.length || etat.vote.banc?.accuse === acteurId)) {
    const v = etat.vote;
    v.ouvert = false;
    v.exprimes = [];
    v.resultat = { decompte: {}, elu: null, elus: [], votes: {}, egalite: false, objet: v.objet, numero: v.numero, tour: etat.tour, souffles: [],
      poids: {}, departage: null, depart: acteurId, ...(v.banc ? { banc: { accuse: v.banc.accuse, pour: 0, total: 0 } } : {}) };
    v.votes = {};
  }
  if (etat.bailli?.actif && (etat.bailli.acteurId === acteurId || etat.bailli.succession?.de === acteurId)) {
    etat.bailli.acteurId = "";
    etat.bailli.succession = null;
    inscrire(etat, { type: "bailli", acteurId: "", comment: "vacance", de: acteurId });
  }
  inscrire(etat, { type: "passage", acteurId, comment });
  return etat;
}

// Les candidats d'un vote d'exil : les gens de passage encore là (ni partis, ni morts).
export const candidatsExil = (etat, villageois = []) => Object.keys(etat?.passage?.gens ?? {})
  .filter(id => !estParti(etat, id) && villageois.some(v => v.id === id && v.vivant !== false));
