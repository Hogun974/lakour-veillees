// L'état d'une partie et ses transitions. Logique pure : chaque fonction reçoit un état et en renvoie un nouveau,
// sans toucher à l'ancien.
//
// L'état COMPLET (celui que manipulent ces fonctions et le MJ actif) est rangé en deux morceaux (separerEtat) :
// - le réglage monde « lakour-loups.partie », PUBLIC : Foundry l'envoie à tous les navigateurs (code serveur v14 :
//   tous les réglages du monde sont livrés à chaque joueur), il ne contient donc aucun secret ;
// - les SECRETS, gardés par le MJ actif seul (mémoire + réglage « client » de son navigateur, jamais envoyé au
//   serveur en clair : seulement chiffré, dans le coffre, voir coffre.mjs) : choix de la nuit, nuit précédente et son bilan, maisons aspergées, primes, fioles, votes en cours,
//   vraies causes des morts de la nuit, chronique secrète, carnets secrets des joueurs.
//
// Forme (contrat §1), plus quelques champs d'extension marqués « + » ([S] = secret) :
// { +partie (id de la partie), phase, tour, composition, batiments: [uuid], +batimentsCles: [cle],
//   vote: { ouvert, +numero, +objet ("execution" | "chapelle" | "bailli"), candidats, votes [S], +exprimes (qui a voté, sans le choix),
//           double, finit, +duree, +majoriteAbsolue, +prolonge (porteur du ruban), +resultat (+poids, +departage : bailli.mjs) },
//   nuit [S]: { actions: [{ acteurId, roleCle, cibles, quand, +effet, +texte }] },
//   morts: [{ acteurId, tour, phase, cause }] (cause publique masquée : voir causePublique), vainqueur,
//   historique: [{ tour, phase, texte }],
//   +nuitPrecedente [S]: { actions, bilan }, +asperges [S], +primes [S], +fioles [S], +voteDoubleDemain, +nuitResolue,
//   +causes [S]: { acteurId: vraie cause }, +journalSecret [S]: [{ tour, phase, texte }], +carnets [S]: { acteurId: [entrée] },
//   +jour: pouvoirs de jour (voir jour.mjs), +pont: { bloqueNuit }, +cimetiere: [acteurId dont le camp a été annoncé],
//   composition [S] (la clé de composition : elle trahirait les rôles en jeu ; le MJ seul la voit),
//   +peste [S]: null | { active, porteur, victimes, decouverte, crieur } (la variante Peste noire, peste.mjs ; dévoilée à la fin),
//   +bailli: { actif, acteurId, depuis, succession, election } (la charge publique du Bailli, bailli.mjs),
//   +registre: [entrée] (le Registre du greffier, public : votes clos, morts et cause publique, Bailli, déclarations ; registre.mjs),
//   +masques [S]: [cle de rôle] (les Masques de veillée de la meute, masques.mjs),
//   +souffle: { actif, utilises } (le Dernier souffle des morts, souffle.mjs), +presage: { actif, cle, tour } (l'Almanach des
//   brumes, almanach.mjs), +glas: N (le Glas final, calendrier.mjs), +somnambules [S]: { acteurId: { croit, vrai, devoile } }
//   (somnambule.mjs), +bonneEtoile [S]: acteurId (la Bonne étoile du narrateur, calendrier.mjs),
//   +aConsigner [S]: null | { roles, batiments, niveau, composition, quand } (la composition de la partie en cours, versée au
//   réglage monde « historique » seulement quand la partie est finie ou abandonnée : livré à tous, il la trahirait) ;
//   vote : +mainLevee (le jour de foire de l'Almanach : les voix sont publiques pendant le vote), +banc ({ accuse } : un jugement du
//   Banc des accusés), resultat : +souffles, +banc ({ accuse, pour, total }), +deuil (le candidat de la voix du deuil) ;
//   +passage: { actif, gens } et +partis: [{ acteurId, tour, comment }] (les Gens de passage, départs et exils, passage.mjs),
//   +banc: { actif, tour, accusations, juges } (banc.mjs), +deuil: { actif, compte } et +pouvoirsDeuil [S] (deuil.mjs),
//   +format: "" | "saint-martin" et +autel [S]: [cle] (la Nuit de la Saint-Martin, saintmartin.mjs),
//   +fiches [S]: { acteurId: { camp, amoureux, protections, role } } (fiches.mjs : tout ce qui est secret d'un villageois ; ses
//   documents n'en gardent rien avant la révélation publique), +secretsIncomplets [S] (une partie reprise sans tous ses secrets) }
// 0.9.0 : pont [S] (le Pont bloqué la nuit suivante trahirait la vraie cause d'une mort de nuit sur l'autre rive) et
// voteDoubleDemain [S] (la cloche du Sonneur : publique seulement quand le vote s'ouvre, vote.double).
// 0.10.0 : +fete: { cle, neige, defile } (la veillée de fête en jeu, publique ; fetes.mjs) et +secretsDeFete [S]: { masque, present,
// presentOuvert, promis } (qui porte le masque du Carnaval, qui a reçu le présent d'hiver, qui sont les promis).
// Le socle du Pacte (publics) : +cercle: [acteurId] (l'ordre des places autour de la table, fixé à la distribution ; cercle.mjs),
// +tenures: { cleBatiment: acteurId | null } (les bâtiments tenus par un joueur ; tenures.mjs), +evenements: [{ cle, tire, debut,
// fin, type, quand }] (les événements en cours : immédiats, différés, permanents ; evenements.mjs).
// Le Pacte, étape 3a (pacte.mjs) : +pacte (public : la sagesse perdue, les Innocents graciés, l'égalité du Souffre-douleur et sa
// liste de votants, la plume noire de la Pie, le second vote du Greffier) et +pacteSecret [S] (les vies perdues des Aïeux, le flair
// perdu des Furets, les loups contaminés par le Vieux Sergent, le signe du Greffier).

import { PHASES, causePublique } from "./constantes.mjs";
import { decompterVotes } from "./votes.mjs";
import { bailliInitial, normaliserBailli, bailliEnCharge, poidsDesVoix, ouvrirSuccession, entreeDeVote } from "./bailli.mjs";
import { inscrire } from "./registre.mjs";
import { souffleInitial, normaliserSouffle } from "./souffle.mjs";
import { presageInitial, normaliserPresage, presageDuJour } from "./almanach.mjs";
import { normaliserGlas } from "./calendrier.mjs";
import { passageInitial, normaliserPassage } from "./passage.mjs";
import { bancInitial, normaliserBanc, verdictDuBanc } from "./banc.mjs";
import { deuilInitial, pouvoirsDeuilInitiaux, normaliserDeuil, normaliserPouvoirsDeuil, voixDuDeuil } from "./deuil.mjs";
import { feteInitiale, normaliserFete, secretsDeFeteInitiaux, normaliserSecretsDeFete } from "./fetes.mjs";
import { sortTranche } from "./tablee.mjs";
import { cercleInitial, normaliserCercle } from "./cercle.mjs";
import { tenuresInitiales, normaliserTenures, libererALaMort } from "./tenures.mjs";
import { evenementsInitiaux, normaliserEvenements } from "./evenements.mjs";
import { pacteInitial, pacteSecretInitial, normaliserPacte, normaliserPacteSecret, plumeDuVote, VOIX_DE_LA_PLUME, POIDS_DE_LA_PLUME } from "./pacte.mjs";

// Le votant fictif de la voix du deuil (jamais un acteur).
export const VOIX_DU_DEUIL = "~deuil";
// Les objets d'un vote : l'exécution du jour, l'asile de la Chapelle, l'élection du Bailli, l'exil d'un gens de passage.
export const OBJETS_DE_VOTE = ["execution", "chapelle", "bailli", "exil"];

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
    jour: jourInitial(), pont: { bloqueNuit: 0 }, cimetiere: [], peste: null,
    bailli: bailliInitial(), registre: [], masques: [],
    souffle: souffleInitial(), presage: presageInitial(), glas: 0, somnambules: {}, bonneEtoile: "", aConsigner: null,
    passage: passageInitial(), partis: [], banc: bancInitial(), deuil: deuilInitial(), pouvoirsDeuil: pouvoirsDeuilInitiaux(), format: "", autel: [],
    fiches: {}, secretsIncomplets: false, fete: feteInitiale(), secretsDeFete: secretsDeFeteInitiaux(),
    // 0.11.0 : la Petite tablée (tablee.mjs), publique : une règle de la veillée, jamais un secret (qui tient quoi n'en sort pas).
    petiteTablee: false,
    // 0.11.0 : les places distribuées (public, annoncé) : le régime des deux loups de la Petite tablée se compte sur elles, jamais
    // sur les figurants ni les arrivants.
    places: 0,
    // Le socle du Pacte, public : l'ordre des places (cercle.mjs), les bâtiments tenus (tenures.mjs), les événements (evenements.mjs).
    cercle: cercleInitial(), tenures: tenuresInitiales(), evenements: evenementsInitiaux(),
    // Le Pacte, étape 3a (pacte.mjs) : les rôles du Village du jeu de soirée — le public, et les secrets du MJ.
    pacte: pacteInitial(), pacteSecret: pacteSecretInitial()
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
  for (const cle of ["batiments", "batimentsCles", "morts", "historique", "asperges", "journalSecret", "cimetiere", "registre", "masques", "partis", "autel"]) if (!Array.isArray(etat[cle])) etat[cle] = [];
  for (const cle of ["effets", "benis", "rubans"]) if (!Array.isArray(etat.jour[cle])) etat.jour[cle] = [];
  for (const cle of ["primes", "fioles", "causes", "carnets", "somnambules", "fiches"]) if (!etat[cle] || typeof etat[cle] !== "object" || Array.isArray(etat[cle])) etat[cle] = {};
  etat.secretsIncomplets = Boolean(etat.secretsIncomplets);
  etat.voteDoubleDemain = Boolean(etat.voteDoubleDemain);
  if (!Array.isArray(etat.vote.exprimes)) etat.vote.exprimes = [];
  if (!PHASES.includes(etat.phase)) etat.phase = "preparation";
  etat.peste = normaliserPeste(etat.peste);
  etat.bailli = normaliserBailli(etat.bailli);
  etat.souffle = normaliserSouffle(etat.souffle);
  etat.presage = normaliserPresage(etat.presage);
  etat.glas = normaliserGlas(etat.glas);
  etat.bonneEtoile = String(etat.bonneEtoile ?? "");
  etat.passage = normaliserPassage(etat.passage);
  etat.banc = normaliserBanc(etat.banc);
  etat.deuil = normaliserDeuil(etat.deuil);
  etat.pouvoirsDeuil = normaliserPouvoirsDeuil(etat.pouvoirsDeuil);
  etat.format = String(etat.format ?? "");
  etat.fete = normaliserFete(etat.fete);
  etat.secretsDeFete = normaliserSecretsDeFete(etat.secretsDeFete);
  etat.petiteTablee = Boolean(etat.petiteTablee);
  etat.places = Math.max(0, Math.floor(Number(etat.places) || 0));
  etat.cercle = normaliserCercle(etat.cercle);
  etat.tenures = normaliserTenures(etat.tenures);
  etat.evenements = normaliserEvenements(etat.evenements);
  etat.pacte = normaliserPacte(etat.pacte);
  etat.pacteSecret = normaliserPacteSecret(etat.pacteSecret);
  etat.tour = Number(etat.tour) || 0;
  return etat;
}

// La variante Peste noire : null, ou sa forme complète.
function normaliserPeste(p) {
  if (!p || typeof p !== "object" || !p.active) return null;
  return { active: true, porteur: String(p.porteur ?? ""), victimes: Array.isArray(p.victimes) ? [...p.victimes] : [],
    decouverte: Boolean(p.decouverte), crieur: String(p.crieur ?? "") };
}

// ------------------------------------------------------------------ public / secret
// separerEtat(etat complet) -> { public, secret } ; fusionnerEtat(public, secret) -> etat complet.
// Des secrets d'une autre partie (partie différente) sont ignorés.
export function separerEtat(e) {
  const etat = normaliserEtat(e);
  const base = etatInitial();
  const secret = {
    partie: etat.partie, nuit: etat.nuit, nuitPrecedente: etat.nuitPrecedente, asperges: etat.asperges, primes: etat.primes,
    fioles: etat.fioles, journalSecret: etat.journalSecret, carnets: etat.carnets, votes: etat.vote.votes, causes: {},
    composition: etat.composition, peste: etat.peste, masques: etat.masques, somnambules: etat.somnambules, bonneEtoile: etat.bonneEtoile,
    aConsigner: etat.aConsigner, pouvoirsDeuil: etat.pouvoirsDeuil, autel: etat.autel,
    fiches: etat.fiches, pont: etat.pont, voteDoubleDemain: etat.voteDoubleDemain, secretsIncomplets: etat.secretsIncomplets,
    secretsDeFete: etat.secretsDeFete, pacteSecret: etat.pacteSecret
  };
  const pub = copie(etat);
  pub.nuit = base.nuit;
  pub.nuitPrecedente = base.nuitPrecedente;
  for (const cle of ["asperges", "primes", "fioles", "journalSecret", "masques", "somnambules", "bonneEtoile", "aConsigner", "pouvoirsDeuil", "autel", "carnets", "causes", "composition",
    "fiches", "pont", "voteDoubleDemain", "secretsIncomplets", "secretsDeFete"]) pub[cle] = base[cle] && typeof base[cle] === "object" ? copie(base[cle]) : base[cle];
  pub.pacteSecret = pacteSecretInitial();   // le Pacte : vies des Aïeux, flair des Furets, contaminés, signe du Greffier
  // La peste noire n'existe pas dans l'état public avant la fin (ni même la clé) ; à la fin, la partie se dévoile.
  delete pub.peste;
  if (etat.phase === "fin" && etat.peste) pub.peste = copie(etat.peste);
  pub.vote.exprimes = etat.vote.ouvert ? Object.keys(etat.vote.votes) : [];
  pub.vote.votes = {};
  // Jour de foire (Almanach des brumes) : le vote se fait à main levée, les voix sont publiques pendant le vote.
  if (etat.vote.ouvert && etat.vote.mainLevee) pub.vote.votes = copie(etat.vote.votes);
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
  for (const cle of ["asperges", "journalSecret", "masques"]) if (Array.isArray(s[cle])) etat[cle] = s[cle];
  for (const cle of ["primes", "fioles", "carnets", "somnambules"]) if (s[cle] && typeof s[cle] === "object") etat[cle] = s[cle];
  if (typeof s.bonneEtoile === "string") etat.bonneEtoile = s.bonneEtoile;
  if (s.aConsigner !== undefined) etat.aConsigner = s.aConsigner;
  if (s.pouvoirsDeuil) etat.pouvoirsDeuil = normaliserPouvoirsDeuil(s.pouvoirsDeuil);
  if (Array.isArray(s.autel)) etat.autel = s.autel;
  if (s.votes && typeof s.votes === "object") etat.vote.votes = s.votes;
  if (typeof s.composition === "string") etat.composition = s.composition;
  if (s.peste !== undefined) etat.peste = normaliserPeste(s.peste);
  if (s.fiches && typeof s.fiches === "object" && !Array.isArray(s.fiches)) etat.fiches = s.fiches;
  // Secrets d'avant 0.9.0 : le Pont et la cloche étaient publics ; ils restent tels que l'état public les a, jusqu'à la prochaine écriture.
  if (s.pont && typeof s.pont === "object") etat.pont = { bloqueNuit: Number(s.pont.bloqueNuit) || 0 };
  if (typeof s.voteDoubleDemain === "boolean") etat.voteDoubleDemain = s.voteDoubleDemain;
  if (s.secretsDeFete) etat.secretsDeFete = normaliserSecretsDeFete(s.secretsDeFete);
  if (s.pacteSecret) etat.pacteSecret = normaliserPacteSecret(s.pacteSecret);
  etat.secretsIncomplets = Boolean(s.secretsIncomplets);
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

// surprise : l'Enfant de la brume qui épie a-t-elle été surprise par la meute (tiré quand son choix est noté) ?
export function ajouterAction(e, { acteurId, roleCle, cibles = [], effet, texte, surprise }, quand = Date.now()) {
  const etat = normaliserEtat(e);
  const action = { acteurId, roleCle, cibles: [...cibles], quand };
  if (effet) action.effet = effet;
  if (texte) action.texte = String(texte);
  if (typeof surprise === "boolean") action.surprise = surprise;
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

// objet : "execution" (le vote du jour), "chapelle" (l'asile de la Chapelle, à main levée : ni Gibet ni cloche) ou "bailli"
// (l'élection du Bailli : ni Gibet, ni cloche, ni ruban, ni voix double).
// banc : l'accusé d'un jugement du Banc des accusés (banc.mjs) : un vote d'exécution à un seul candidat, sans voix double.
// "exil" : chasser un gens de passage (passage.mjs) : ni Gibet ni cloche.
export function ouvrirVote(e, { candidats = [], duree = 0, double, majoriteAbsolue = false, objet = "execution", banc = "", maintenant = Date.now() } = {}) {
  const etat = normaliserEtat(e);
  const sujet = OBJETS_DE_VOTE.includes(objet) ? objet : "execution";
  const execution = sujet === "execution";
  if (execution && banc) candidats = [banc];
  etat.vote = {
    ouvert: true, numero: (Number(etat.vote.numero) || 0) + 1, objet: sujet,
    candidats: [...candidats], votes: {}, exprimes: [],
    double: execution ? (double ?? Boolean(etat.voteDoubleDemain)) : false,
    finit: duree > 0 ? maintenant + duree : 0, duree: duree > 0 ? duree : 0,
    majoriteAbsolue: execution && (Boolean(majoriteAbsolue) || presageDuJour(etat) === "lune-rousse"), prolonge: "", resultat: null,
    mainLevee: presageDuJour(etat) === "foire"
  };
  if (execution) etat.voteDoubleDemain = false;
  // Le glas de l'Almanach : ce jour-là seulement (pas reporté au lendemain si l'on ne vote pas).
  if (execution && presageDuJour(etat) === "glas") etat.vote.double = true;
  if (execution && banc) Object.assign(etat.vote, { banc: { accuse: banc }, double: false });
  // L'élection du Bailli se tient au débat, sans changer de phase (les pouvoirs du matin restent permis, pas d'ambiance du vote).
  if (sujet !== "bailli") etat.phase = "vote";
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
// Le Bailli (bailli.mjs) : sa voix compte double à un vote d'exécution (votants : les vivants ; il doit en être) ; une égalité
// qui laisse une place vide attend son départage (resultat.departage.enAttente, puis trancherVote) ; s'il a voté pour l'un des
// ex aequo, c'est celui-là, sans rien lui demander (departage.auto ; une place restante d'un vote double attend encore son choix). Le vote clos entre au
// Registre (un vote à départager, une fois tranché).
// -> { etat, resultat } ou { etat, resultat: null, prolonge: acteurId }.
// souffles : les morts qui ont encore leur Dernier souffle (souffle.mjs) ; leur voix rendue au dépouillement est consommée.
// hasard : la voix du deuil (deuil.mjs) sans choix secret de la meute va à un candidat au hasard. Un jugement du Banc des accusés
// (vote.banc) se tranche par verdictDuBanc : condamné si les « pour » pèsent la moitié des voix des vivants.
// Le Pacte (pacte.mjs) : la plume noire de la Pie pèse POIDS_DE_LA_PLUME voix contre sa cible au premier vote d'exécution du jour
// (une voix sans votant, comme celle du deuil ; resultat.plume) ; souffreDouleur : le Souffre-douleur vivant (rôle connu du MJ) —
// une égalité qui laisse une place vide à un vote d'exécution le condamne, lui, à la place des ex æquo, avant toute autre règle
// de départage (ni Bailli, ni sort) : resultat.souffreDouleur, etat.pacte.egalite (son dernier geste, derniers-gestes.mjs).
export function cloreVote(e, { votants = null, poids = {}, maintenant = Date.now(), prolongation = 60000, souffles = [], hasard = Math.random, souffreDouleur = "" } = {}) {
  const etat = normaliserEtat(e);
  const v = etat.vote;
  const pesees = { ...poidsDesVoix(etat, votants), ...poids };
  const bailli = v.objet === "execution" && !v.banc ? bailliEnCharge(etat, votants) : "";
  // La voix du deuil : une voix sans visage, qui ne pèse qu'une fois.
  const deuil = voixDuDeuil({ etat, candidats: v.candidats, hasard });
  // La plume noire de la Pie : deux voix sans visage contre sa cible, si elle est candidate.
  const plume = v.objet === "execution" ? plumeDuVote(etat) : "";
  const plumee = plume && (!v.candidats.length || v.candidats.includes(plume)) ? plume : "";
  const votes = deuil ? { ...v.votes, [VOIX_DU_DEUIL]: deuil } : v.votes;
  const admis = deuil && votants ? [...votants, VOIX_DU_DEUIL] : votants;
  if (plumee) pesees[VOIX_DE_LA_PLUME] = POIDS_DE_LA_PLUME;
  const r = decompterVotes({ votes: plumee ? { ...votes, [VOIX_DE_LA_PLUME]: plumee } : votes, candidats: v.candidats,
    votants: plumee && admis ? [...admis, VOIX_DE_LA_PLUME] : admis, double: v.double, poids: pesees, majoriteAbsolue: v.majoriteAbsolue });
  delete r.votes[VOIX_DU_DEUIL];
  delete r.votes[VOIX_DE_LA_PLUME];
  if (v.banc) {
    const vivants = (votants ?? Object.keys(v.votes)).filter(id => !souffles.includes(id));
    const vd = verdictDuBanc({ accuse: v.banc.accuse, votes: { ...r.votes, ...(deuil ? { [VOIX_DU_DEUIL]: deuil } : {}), ...(plumee ? { [VOIX_DE_LA_PLUME]: plumee } : {}) },
      vivants, poids: pesees, strict: v.majoriteAbsolue });
    Object.assign(r, { elus: vd.condamne ? [v.banc.accuse] : [], elu: vd.condamne ? v.banc.accuse : null, egalite: false, departage: null,
      banc: { accuse: v.banc.accuse, pour: vd.pour, total: vd.total } });
  }
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
  // La plume a pesé à ce vote (dépouillé) : elle ne pèsera plus, sauf si le Juge de paix l'annule (rendreLaPlume).
  if (plumee) etat.pacte = { ...etat.pacte, plume: { ...etat.pacte.plume, servi: v.numero } };
  const souffle = v.objet === "execution" ? souffles.filter(id => id in r.votes) : [];
  etat.souffle.utilises = [...new Set([...etat.souffle.utilises, ...souffle])];
  const resultat = { decompte: r.decompte, elu: r.elu, elus: r.elus, votes: r.votes, egalite: r.egalite,
    objet: v.objet, numero: v.numero, tour: etat.tour, souffles: souffle, ...(r.banc ? { banc: r.banc } : {}), ...(deuil ? { deuil } : {}), ...(plumee ? { plume: plumee } : {}),
    poids: Object.fromEntries(Object.entries(pesees).filter(([id]) => id in r.votes)),
    departage: bailli && r.departage ? { par: bailli, candidats: r.departage.candidats, places: r.departage.places, enAttente: true, choix: [] } : null };
  // Le Souffre-douleur paie l'égalité, avant toute autre règle (la voix du Bailli, son choix, le sort) : il prend la place laissée
  // vide, à la place des ex æquo. Déjà condamné (vote double), il n'en prend pas une seconde.
  const bouc = v.objet === "execution" && !v.banc && r.departage && souffreDouleur && !resultat.elus.includes(souffreDouleur) ? souffreDouleur : "";
  if (bouc) {
    resultat.elus = [...resultat.elus, bouc];
    resultat.elu = resultat.elus[0] ?? null;
    resultat.departage = null;
    r.departage = null;   // l'égalité est payée : ni Bailli ni sort
    resultat.souffreDouleur = bouc;
    etat.pacte = { ...etat.pacte, egalite: { acteurId: bouc, tour: etat.tour, numero: v.numero } };
  }
  // La voix du Bailli tranche d'elle-même : il a voté pour l'un des ex aequo, c'est lui qui est désigné.
  const sienne = resultat.departage ? r.votes[bailli] : "";
  if (sienne && resultat.departage.candidats.includes(sienne)) {
    const d = resultat.departage;
    resultat.elus = [...resultat.elus, sienne];
    resultat.elu = resultat.elus[0] ?? null;
    resultat.departage = d.places > 1
      ? { ...d, candidats: d.candidats.filter(id => id !== sienne), places: d.places - 1, choix: [sienne], auto: [sienne] }
      : { ...d, enAttente: false, choix: [sienne], auto: [sienne] };
  }
  // Petite tablée (tablee.mjs) : pas de jour sans verdict. Une égalité en tête d'un vote d'exécution que personne ne tranche
  // (pas de Bailli en charge) est tranchée par le sort, parmi les ex æquo ; resultat.sort = les désignés par le sort.
  if (etat.petiteTablee && v.objet === "execution" && !v.banc && !resultat.departage && r.departage) {
    const tires = sortTranche({ candidats: r.departage.candidats, places: r.departage.places, hasard });
    resultat.elus = [...resultat.elus, ...tires];
    resultat.elu = resultat.elus[0] ?? null;
    resultat.sort = tires;
  }
  v.ouvert = false;
  etat.pouvoirsDeuil.cible = null;
  v.exprimes = [];
  v.resultat = resultat;
  if (!resultat.departage?.enAttente) inscrire(etat, entreeDeVote(resultat), maintenant);
  return { etat, resultat };
}

// Une mort : au Registre avec sa cause PUBLIQUE ; le Bailli qui meurt laisse la charge à son successeur (bailli.mjs) ; les
// bâtiments qu'il tenait deviennent vacants (tenures.mjs).
export function ajouterMort(e, { acteurId, cause = "", quand = Date.now() }) {
  const etat = normaliserEtat(e);
  if (!etat.morts.some(m => m.acteurId === acteurId)) {
    etat.morts.push({ acteurId, tour: etat.tour, phase: etat.phase, cause });
    inscrire(etat, { type: "mort", acteurId, cause }, quand);   // le Registre n'en garde que la cause publique (registre.mjs)
    ouvrirSuccession(etat, acteurId, quand);
    libererALaMort(etat, acteurId, quand);
  }
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
