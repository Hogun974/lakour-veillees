// Le Bailli de Brumecombe : une charge PUBLIQUE, tenue par un villageois élu. Logique pure.
//
// Réglage monde « bailli » (vrai par défaut), recopié dans l'état à la distribution (etat.bailli.actif) : un réglage changé en
// cours de partie ne change pas la partie en cours. La charge existe aussi dans une peste noire : son absence trahirait la
// variante.
// - L'ÉLECTION : un jour sans Bailli vivant (le premier jour, ou après une charge restée vacante), le village l'élit par un vote
//   dédié (objet "bailli", tous les vivants candidats, chacun une voix, sans Gibet ni cloche ni ruban), AVANT le vote
//   d'exécution. Égalité : le sort désigne l'un des ex aequo. Personne (toutes les voix abstenues) : la charge reste vacante
//   jusqu'au lendemain (une élection par jour).
// - LA VOIX DOUBLE : aux votes d'exécution, la voix du Bailli vivant pèse POIDS_DU_BAILLI au dépouillement (et compte double
//   dans le total du Gibet).
// - LE DÉPARTAGE : une égalité qui laisse une place vide (en tête, ou pour la seconde place d'un vote double) est tranchée par
//   lui : il choisit parmi les ex aequo (une demande secrète, comme un choix de nuit ; un compagnon IA par son résolveur). Il peut
//   se désigner lui-même. S'il passe, personne pour cette place. Avec le Gibet, seulement parmi ceux qui ont la majorité.
// - LA SUCCESSION : à sa mort (quelle qu'en soit la cause), il remet le sceau à un vivant de son choix (demande posthume). Sans
//   réponse au délai, la charge reste vacante : le village élira un nouveau Bailli au prochain jour (le jour même, si le vote
//   d'exécution n'a pas encore eu lieu). La succession ne dure jamais plus que le délai des choix, compté depuis sa mort
//   (succession.quand), même si la page du MJ est rechargée entre-temps (api.reprendre). Choix retenu plutôt que le hasard : un sceau tiré au sort donnerait la voix double à un
//   loup sans que personne ne l'ait voulu.
//
// etat.bailli : { actif, acteurId ("" : charge vacante), depuis (tour), succession: null | { de, tour }, election (tour de la
//   dernière élection, -1 : jamais) } — public, comme tout ce qu'il contient.
import { choisir } from "./hasard.mjs";
import { normaliserEtat } from "./etat.mjs";
import { inscrire } from "./registre.mjs";

export const POIDS_DU_BAILLI = 2;
// Les phases où l'élection est proposée (le débat, ou le vote quand celui d'exécution n'a pas encore eu lieu).
export const PHASES_ELECTION = ["jour", "vote"];

export const bailliInitial = (actif = false) => ({ actif: Boolean(actif), acteurId: "", depuis: 0, succession: null, election: -1 });

export function normaliserBailli(b) {
  const x = b && typeof b === "object" ? b : {};
  const s = x.succession && typeof x.succession === "object" && x.succession.de
    ? { de: String(x.succession.de), tour: Number(x.succession.tour) || 0, quand: Number(x.succession.quand) || 0 } : null;
  return { actif: Boolean(x.actif), acteurId: String(x.acteurId ?? ""), depuis: Number(x.depuis) || 0, succession: s,
    election: typeof x.election === "number" ? x.election : -1 };
}

const vivant = v => Boolean(v) && v.vivant !== false;
const idsVivants = villageois => villageois.filter(vivant).map(v => v.id);

// Le Bailli en charge : son id s'il est actif et vivant (vivants : [acteurId] ; null = sans vérifier), "" sinon.
export function bailliEnCharge(etat, vivants = null) {
  const b = normaliserBailli(etat?.bailli);
  if (!b.actif || !b.acteurId) return "";
  return !vivants || vivants.includes(b.acteurId) ? b.acteurId : "";
}

// Le poids des voix d'un dépouillement : la voix du Bailli vivant compte double, aux votes d'exécution seulement.
export function poidsDesVoix(etat, vivants = null) {
  if ((etat?.vote?.objet ?? "execution") !== "execution") return {};
  const id = bailliEnCharge(etat, vivants);
  return id ? { [id]: POIDS_DU_BAILLI } : {};
}

// Le vote d'exécution de ce tour a-t-il eu lieu (clos) ?
export const voteExecutionDuJour = etat => Boolean(etat?.vote?.resultat && !etat.vote.ouvert
  && etat.vote.resultat.objet === "execution" && etat.vote.resultat.tour === etat.tour);

// Une égalité attend-elle le départage du Bailli ? (on ne rouvre pas de vote et on ne change pas de phase avant)
export const departageEnAttente = etat => Boolean(!etat?.vote?.ouvert && etat?.vote?.resultat?.departage?.enAttente);

// Peut-on ouvrir l'élection maintenant ? (permission : la Table et l'API refusent sinon, avec la raison)
// -> { ok, raison: "" | "inactif" | "fin" | "phase" | "vote" (un vote ouvert) | "bailli" (un Bailli vivant) | "succession" }
export function electionPossible({ etat: e, villageois = [] } = {}) {
  const etat = normaliserEtat(e);
  const non = raison => ({ ok: false, raison });
  if (!etat.bailli.actif) return non("inactif");
  if (etat.phase === "fin" || etat.vainqueur) return non("fin");
  if (!["aube", "jour", "vote"].includes(etat.phase)) return non("phase");
  if (etat.vote.ouvert) return non("vote");
  if (etat.bailli.succession) return non("succession");
  if (bailliEnCharge(etat, idsVivants(villageois))) return non("bailli");
  return { ok: true, raison: "" };
}

// L'élection est-elle due (étape proposée au MJ humain) ? Permise, au débat ou au vote, pas encore faite ce jour, et avant le
// vote d'exécution du jour. -> { ok, raison } (raisons en plus : "deja", "execution")
export function electionAttendue({ etat: e, villageois = [] } = {}) {
  const etat = normaliserEtat(e);
  const p = electionPossible({ etat, villageois });
  if (!p.ok) return p;
  if (!PHASES_ELECTION.includes(etat.phase)) return { ok: false, raison: "phase" };
  if (etat.bailli.election === etat.tour) return { ok: false, raison: "deja" };
  if (voteExecutionDuJour(etat)) return { ok: false, raison: "execution" };
  return { ok: true, raison: "" };
}

// Installe un Bailli. comment : "election" | "sort" | "succession" | "nomme" (le narrateur).
function installer(etat, acteurId, comment, de = "") {
  etat.bailli.acteurId = acteurId;
  etat.bailli.depuis = etat.tour;
  etat.bailli.succession = null;
  inscrire(etat, { type: "bailli", acteurId, comment, ...(de ? { de } : {}) });
}

// Le vote du Bailli vient d'être clos (resultat, objet "bailli") : l'élu, ou le sort parmi les ex aequo en tête, ou personne.
// -> { etat, elu: acteurId | "", sort: Boolean }
export function elireBailli(e, resultat, { villageois = [], hasard = Math.random } = {}) {
  const etat = normaliserEtat(e);
  etat.bailli.election = etat.tour;
  const vivants = idsVivants(villageois);
  const admis = id => !villageois.length || vivants.includes(id);
  let elu = resultat?.elus?.length === 1 && admis(resultat.elus[0]) ? resultat.elus[0] : "";
  let sort = false;
  if (!elu && resultat?.egalite) {
    const max = Math.max(0, ...Object.values(resultat.decompte ?? {}));
    const tete = Object.keys(resultat.decompte ?? {}).filter(id => max > 0 && resultat.decompte[id] === max && admis(id)).sort();
    elu = choisir(tete, hasard) ?? "";
    sort = Boolean(elu);
  }
  // Le résultat public (et son entrée au Registre) nomme l'élu, sort compris : la Table l'affiche « élu », pas « personne ».
  const r = etat.vote.resultat;
  if (elu && r?.objet === "bailli" && r.numero === resultat?.numero) {
    Object.assign(r, { elus: [elu], elu, sort });
    const x = [...etat.registre].reverse().find(y => y.type === "vote" && y.numero === r.numero);
    if (x) x.elus = [elu];
  }
  if (elu) installer(etat, elu, sort ? "sort" : "election");
  else inscrire(etat, { type: "bailli", acteurId: "", comment: "vacance" });
  return { etat, elu, sort };
}

// Le Bailli meurt : la charge attend son successeur (ajouterMort l'appelle). quand : l'heure de sa mort (la succession ne dure
// pas plus que le délai des choix, même après un rechargement de la page du MJ).
export function ouvrirSuccession(etat, deId, quand = Date.now()) {
  if (!etat.bailli?.actif || etat.bailli.acteurId !== deId) return etat;
  etat.bailli.acteurId = "";
  etat.bailli.succession = { de: deId, tour: etat.tour, quand };
  return etat;
}

// Le temps qui reste au défunt pour remettre le sceau (ms, 0 : trop tard, la charge devient vacante).
export function resteDeSuccession(etat, delai, maintenant = Date.now()) {
  const s = etat?.bailli?.succession;
  if (!s) return 0;
  return Math.max(0, delai - Math.max(0, maintenant - (Number(s.quand) || 0)));
}

// Ceux à qui le Bailli défunt peut remettre le sceau : les vivants.
export const candidatsSuccession = (etat, villageois = []) => idsVivants(villageois).filter(id => id !== etat?.bailli?.succession?.de);

// Le défunt a choisi (successeur : acteurId, "" s'il a passé ou n'a pas répondu). -> { etat, acteurId, comment }
export function nommerSuccesseur(e, { successeur = "", villageois = [] } = {}) {
  const etat = normaliserEtat(e);
  const s = etat.bailli.succession;
  if (!s) return { etat, acteurId: etat.bailli.acteurId, comment: "" };
  if (successeur && candidatsSuccession(etat, villageois).includes(successeur)) {
    installer(etat, successeur, "succession", s.de);
    return { etat, acteurId: successeur, comment: "succession" };
  }
  etat.bailli.succession = null;
  inscrire(etat, { type: "bailli", acteurId: "", comment: "vacance", de: s.de });
  return { etat, acteurId: "", comment: "vacance" };
}

// Le narrateur nomme un Bailli (correction, ou un joueur qui le dit à voix haute) : un vivant ; la succession en cours se clôt.
export function nommerBailli(e, acteurId, { villageois = [] } = {}) {
  const etat = normaliserEtat(e);
  if (!etat.bailli.actif || !idsVivants(villageois).includes(acteurId)) return { etat, ok: false };
  installer(etat, acteurId, "nomme");
  return { etat, ok: true };
}

// Le Bailli (ou le narrateur à sa place) tranche une égalité (vote d'exécution clos, departage en attente) : choix parmi les ex
// aequo encore vivants (vivants : [acteurId] ; null = sans vérifier), autant que de places. Un vote rouvert ou déjà tranché n'est
// pas touché ; la nuit tombée, plus personne n'est condamné pour ce vote (il entre au Registre sans condamné).
export function trancherVote(e, choix = [], { vivants = null } = {}) {
  const etat = normaliserEtat(e);
  const r = etat.vote.resultat;
  if (etat.vote.ouvert || !r?.departage?.enAttente) return etat;
  const d = r.departage;
  const permis = id => d.candidats.includes(id) && (!vivants || vivants.includes(id));
  const admis = etat.phase === "nuit" ? [] : [...new Set(choix)].filter(permis).slice(0, d.places);
  r.elus = [...r.elus, ...admis];
  r.elu = r.elus[0] ?? null;
  r.departage = { ...d, enAttente: false, choix: admis };
  inscrire(etat, entreeDeVote(r));
  return etat;
}

// L'entrée du Registre pour un vote clos (ce qui est public après la clôture).
export function entreeDeVote(r) {
  return { type: "vote", numero: r.numero, objet: r.objet, votes: { ...(r.votes ?? {}) }, decompte: { ...(r.decompte ?? {}) },
    elus: [...(r.elus ?? [])], egalite: Boolean(r.egalite), poids: { ...(r.poids ?? {}) },
    departage: r.departage ? { par: r.departage.par, choix: [...(r.departage.choix ?? [])] } : null };
}
