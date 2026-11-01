// L'état d'une partie et ses transitions. Logique pure : chaque fonction reçoit un état et en renvoie un nouveau,
// sans toucher à l'ancien.
//
// L'état COMPLET (celui que manipulent ces fonctions et le MJ actif) est rangé en deux morceaux (separerEtat) :
// - le réglage monde « lakour-loups.partie », PUBLIC : Foundry l'envoie à tous les navigateurs (code serveur v14 :
//   tous les réglages du monde sont livrés à chaque joueur), il ne contient donc aucun secret ;
// - les SECRETS, gardés par le MJ actif seul (mémoire + réglage « client » de son navigateur, jamais envoyé au
//   serveur) : choix de la nuit, nuit précédente et son bilan, maisons aspergées, primes, fioles, votes en cours,
//   vraies causes des morts de la nuit, chronique secrète, carnets secrets des joueurs.
//
// Forme (contrat §1), plus quelques champs d'extension marqués « + » ([S] = secret) :
// { +partie (id de la partie), phase, tour, composition, batiments: [uuid], +batimentsCles: [cle],
//   vote: { ouvert, +numero, +objet ("execution" | "chapelle"), candidats, votes [S], +exprimes (qui a voté, sans le choix),
//           double, finit, +duree, +majoriteAbsolue, +prolonge (porteur du ruban), +resultat },
//   nuit [S]: { actions: [{ acteurId, roleCle, cibles, quand, +effet, +texte }] },
//   morts: [{ acteurId, tour, phase, cause }] (cause publique masquée : voir causePublique), vainqueur,
//   historique: [{ tour, phase, texte }],
//   +nuitPrecedente [S]: { actions, bilan }, +asperges [S], +primes [S], +fioles [S], +voteDoubleDemain, +nuitResolue,
//   +causes [S]: { acteurId: vraie cause }, +journalSecret [S]: [{ tour, phase, texte }], +carnets [S]: { acteurId: [entrée] },
//   +jour: pouvoirs de jour (voir jour.mjs), +pont: { bloqueNuit }, +cimetiere: [acteurId dont le camp a été annoncé] }

import { PHASES, causePublique } from "./constantes.mjs";
import { decompterVotes } from "./votes.mjs";

export function jourInitial() {
  // effets : [{ type, acteurId, cible, nuit }] posés de jour pour la nuit n° `nuit` (verrou, surveille, gite, traversee,
  // taverne, lame, cachette, asile, ecluse). benis : à vie. rubans : jusqu'au vote où ils servent. puits : le dernier mot.
  return { effets: [], benis: [], rubans: [], puits: null, conteuse: null, appel: null };
}

export function etatInitial() {
  return {
    partie: "", phase: "preparation", tour: 0, composition: "", batiments: [], batimentsCles: [],
    vote: { ouvert: false, numero: 0, objet: "execution", candidats: [], votes: {}, exprimes: [], double: false, finit: 0, duree: 0,
      majoriteAbsolue: false, prolonge: "", resultat: null },
    nuit: { actions: [] },
    morts: [], vainqueur: "", historique: [],
    nuitPrecedente: { actions: [], bilan: null }, asperges: [], primes: {}, fioles: {}, voteDoubleDemain: false, nuitResolue: 0,
    causes: {}, journalSecret: [], carnets: {},
    jour: jourInitial(), pont: { bloqueNuit: 0 }, cimetiere: []
  };
}

const copie = o => JSON.parse(JSON.stringify(o ?? {}));

export function normaliserEtat(e) {
  const base = etatInitial();
  const x = copie(e);
  const etat = { ...base, ...x };
  etat.vote = { ...base.vote, ...(x.vote ?? {}) };
  etat.nuit = { ...base.nuit, ...(x.nuit ?? {}) };
  etat.nuitPrecedente = { ...base.nuitPrecedente, ...(x.nuitPrecedente ?? {}) };
  etat.jour = { ...base.jour, ...(x.jour ?? {}) };
  etat.pont = { ...base.pont, ...(x.pont ?? {}) };
  for (const cle of ["batiments", "batimentsCles", "morts", "historique", "asperges", "journalSecret", "cimetiere"]) if (!Array.isArray(etat[cle])) etat[cle] = [];
  for (const cle of ["effets", "benis", "rubans"]) if (!Array.isArray(etat.jour[cle])) etat.jour[cle] = [];
  for (const cle of ["primes", "fioles", "causes", "carnets"]) if (!etat[cle] || typeof etat[cle] !== "object") etat[cle] = {};
  if (!Array.isArray(etat.vote.exprimes)) etat.vote.exprimes = [];
  if (!PHASES.includes(etat.phase)) etat.phase = "preparation";
  etat.tour = Number(etat.tour) || 0;
  return etat;
}

// ------------------------------------------------------------------ public / secret
// separerEtat(etat complet) -> { public, secret } ; fusionnerEtat(public, secret) -> etat complet.
// Des secrets d'une autre partie (partie différente) sont ignorés.
export function separerEtat(e) {
  const etat = normaliserEtat(e);
  const base = etatInitial();
  const secret = {
    partie: etat.partie, nuit: etat.nuit, nuitPrecedente: etat.nuitPrecedente, asperges: etat.asperges, primes: etat.primes,
    fioles: etat.fioles, journalSecret: etat.journalSecret, carnets: etat.carnets, votes: etat.vote.votes, causes: {}
  };
  const pub = copie(etat);
  pub.nuit = base.nuit;
  pub.nuitPrecedente = base.nuitPrecedente;
  for (const cle of ["asperges", "primes", "fioles", "journalSecret", "carnets", "causes"]) pub[cle] = base[cle];
  pub.vote.exprimes = etat.vote.ouvert ? Object.keys(etat.vote.votes) : [];
  pub.vote.votes = {};
  pub.morts = etat.morts.map(m => {
    const visible = causePublique(m.cause);
    if (visible !== m.cause) secret.causes[m.acteurId] = m.cause;
    return { ...m, cause: visible };
  });
  for (const [id, cause] of Object.entries(etat.causes)) if (!(id in secret.causes)) secret.causes[id] = cause;
  return { public: pub, secret: copie(secret) };
}

export function fusionnerEtat(pub, secret) {
  const etat = normaliserEtat(pub);
  if (!secret || typeof secret !== "object" || (secret.partie ?? "") !== etat.partie) return etat;
  const s = copie(secret);
  if (s.nuit) etat.nuit = { ...etat.nuit, ...s.nuit };
  if (s.nuitPrecedente) etat.nuitPrecedente = { ...etat.nuitPrecedente, ...s.nuitPrecedente };
  for (const cle of ["asperges", "journalSecret"]) if (Array.isArray(s[cle])) etat[cle] = s[cle];
  for (const cle of ["primes", "fioles", "carnets"]) if (s[cle] && typeof s[cle] === "object") etat[cle] = s[cle];
  if (s.votes && typeof s.votes === "object") etat.vote.votes = s.votes;
  etat.causes = s.causes ?? {};
  etat.morts = etat.morts.map(m => (etat.causes[m.acteurId] ? { ...m, cause: etat.causes[m.acteurId] } : m));
  return etat;
}

// Ce que voient les joueurs (et ce que le socket diffuse) : l'état public.
export function etatPublic(e) {
  return separerEtat(e).public;
}

// ------------------------------------------------------------------ transitions
export function journaliser(e, texte) {
  const etat = normaliserEtat(e);
  etat.historique.push({ tour: etat.tour, phase: etat.phase, texte });
  return etat;
}

// Une note pour le seul MJ (chronique secrète : actions de la nuit, messages privés envoyés).
export function journaliserSecret(e, texte) {
  const etat = normaliserEtat(e);
  etat.journalSecret.push({ tour: etat.tour, phase: etat.phase, texte });
  if (etat.journalSecret.length > 200) etat.journalSecret = etat.journalSecret.slice(-200);
  return etat;
}

// Passer à une phase. "nuit" : tour + 1, actions de la nuit remises à zéro. Quitter "vote" ferme le vote.
export function passerPhase(e, phase) {
  if (!PHASES.includes(phase)) throw new Error(`Phase inconnue : ${phase}`);
  const etat = normaliserEtat(e);
  if (phase === "nuit") {
    etat.tour += 1;
    etat.nuit = { actions: [] };
    etat.jour.conteuse = null;
    etat.jour.appel = null;
  }
  if (phase !== "vote") etat.vote.ouvert = false;
  etat.phase = phase;
  return etat;
}

export function ajouterAction(e, { acteurId, roleCle, cibles = [], effet, texte }, quand = Date.now()) {
  const etat = normaliserEtat(e);
  const action = { acteurId, roleCle, cibles: [...cibles], quand };
  if (effet) action.effet = effet;
  if (texte) action.texte = String(texte);
  etat.nuit.actions.push(action);
  return etat;
}

// Fin de nuit : les actions et le bilan passent dans nuitPrecedente, les maisons aspergées sont retenues.
// pontFranchi : la meute a tué sur l'autre rive, elle ne traversera pas la nuit suivante.
export function cloreNuit(e, { asperges, fioles, bilan, pontFranchi = false } = {}) {
  const etat = normaliserEtat(e);
  etat.nuitPrecedente = { actions: etat.nuit.actions, bilan: bilan ? copie(bilan) : null };
  etat.nuit = { actions: [] };
  etat.nuitResolue = etat.tour;
  if (asperges) etat.asperges = [...asperges];
  if (fioles) etat.fioles = copie(fioles);
  if (pontFranchi) etat.pont = { bloqueNuit: etat.tour + 1 };
  return etat;
}

// objet : "execution" (le vote du jour) ou "chapelle" (l'asile de la Chapelle, à main levée : ni Gibet ni cloche).
export function ouvrirVote(e, { candidats = [], duree = 0, double, majoriteAbsolue = false, objet = "execution", maintenant = Date.now() } = {}) {
  const etat = normaliserEtat(e);
  const execution = objet !== "chapelle";
  etat.vote = {
    ouvert: true, numero: (Number(etat.vote.numero) || 0) + 1, objet: execution ? "execution" : "chapelle",
    candidats: [...candidats], votes: {}, exprimes: [],
    double: execution ? (double ?? Boolean(etat.voteDoubleDemain)) : false,
    finit: duree > 0 ? maintenant + duree : 0, duree: duree > 0 ? duree : 0,
    majoriteAbsolue: execution && Boolean(majoriteAbsolue), prolonge: "", resultat: null
  };
  if (execution) etat.voteDoubleDemain = false;
  etat.phase = "vote";
  return etat;
}

// Un vote reçu. votants : ids admis (vivants). Renvoie { etat, ok, raison }.
export function enregistrerVote(e, { votant, cible, votants = null, maintenant = Date.now() }) {
  const etat = normaliserEtat(e);
  const v = etat.vote;
  if (!v.ouvert) return { etat, ok: false, raison: "ferme" };
  if (v.finit && maintenant > v.finit) return { etat, ok: false, raison: "temps" };
  if (votants && !votants.includes(votant)) return { etat, ok: false, raison: "votant" };
  if (cible && v.candidats.length && !v.candidats.includes(cible)) return { etat, ok: false, raison: "candidat" };
  if (cible) v.votes[votant] = cible;
  else delete v.votes[votant];
  v.exprimes = Object.keys(v.votes);
  return { etat, ok: true, raison: "" };
}

// Clôture. Le ruban de la Tisserande : si le plus désigné d'un vote d'exécution porte un ruban, le dépouillement est
// suspendu — le vote reste ouvert une minute de plus (prolongation, en ms) pour sa défense, et le ruban est dénoué.
// -> { etat, resultat } ou { etat, resultat: null, prolonge: acteurId }.
export function cloreVote(e, { votants = null, poids = {}, maintenant = Date.now(), prolongation = 60000 } = {}) {
  const etat = normaliserEtat(e);
  const v = etat.vote;
  const r = decompterVotes({ votes: v.votes, candidats: v.candidats, votants, double: v.double, poids, majoriteAbsolue: v.majoriteAbsolue });
  if (v.objet === "execution") {
    const max = Math.max(0, ...Object.values(r.decompte));
    const porteur = max > 0 ? etat.jour.rubans.find(id => r.decompte[id] === max) : null;
    if (porteur) {
      etat.jour.rubans = etat.jour.rubans.filter(id => id !== porteur);
      v.prolonge = porteur;
      v.finit = maintenant + prolongation;
      return { etat, resultat: null, prolonge: porteur };
    }
  }
  const resultat = { decompte: r.decompte, elu: r.elu, elus: r.elus, votes: r.votes, egalite: r.egalite,
    objet: v.objet, numero: v.numero, tour: etat.tour };
  v.ouvert = false;
  v.exprimes = [];
  v.resultat = resultat;
  return { etat, resultat };
}

export function ajouterMort(e, { acteurId, cause = "" }) {
  const etat = normaliserEtat(e);
  if (!etat.morts.some(m => m.acteurId === acteurId)) etat.morts.push({ acteurId, tour: etat.tour, phase: etat.phase, cause });
  return etat;
}

export function declarerVainqueur(e, vainqueur) {
  const etat = normaliserEtat(e);
  etat.vainqueur = vainqueur;
  if (vainqueur) etat.phase = "fin";
  return etat;
}

// Un message secret remis à un joueur (carnet). entree : { id, texte | html, quand }.
export function ajouterAuCarnet(e, acteurId, entree) {
  const etat = normaliserEtat(e);
  (etat.carnets[acteurId] ??= []).push({ ...copie(entree), tour: etat.tour, phase: etat.phase });
  return etat;
}
