// Les rôles du Village venus du jeu de soirée (Le Pacte, étape 3a de docs/plan-le-pacte.md) : ce qu'ils ont en commun, et ce
// que l'état garde d'eux. Logique pure.
//
// Les rôles et leur clé d'effet (contenu lakour-veillees, roles.mjs) :
// - Franc-Villageois : aucun effet, rôle PUBLIC dès la distribution (role.public, socle du Pacte) ;
// - Aïeul (« resister ») : la première attaque de la meute (ou la première morsure de la Louve mère) ne le tue pas ; tombé de la
//   main du village (vote, poison, Braconnière), le village perd sa sagesse (sagessePerdue) ;
// - Souffre-douleur (« egalite ») : une égalité au vote d'exécution le condamne, lui, avant tout départage (etat.mjs, cloreVote) ;
//   mort ainsi, son dernier geste désigne qui votera le lendemain (derniers-gestes.mjs, geste « votants ») ;
// - Innocent (« grace ») : condamné par le vote, il est gracié (carte retournée), reste en jeu, ne vote plus jamais ;
// - Lavandières, Bûcherons (« fratrie », nuit.nuitsImpaires) : ils se reconnaissent la première nuit, puis se retrouvent une nuit
//   sur deux (nuits impaires) dans un salon à eux (salons.mjs) ;
// - Furet (« flairer ») : un joueur et ses deux voisins vivants ; aucun loup parmi eux, il perd son flair pour toujours ;
// - Gardeuse d'oies (« cacarder ») : chaque matin, les oies cacardent si un loup est l'un de ses deux voisins vivants ;
// - Greffier bègue (« second-vote ») : une fois, pendant ou juste après un vote d'exécution qui condamne, un second vote ;
// - Vieux Sergent (« contaminer ») : dévoré par la meute, il contamine le premier loup vivant à sa gauche, mort la nuit suivante ;
// - Pie (« plume ») : chaque nuit, une plume noire sur un joueur : deux voix de plus contre lui au vote d'exécution du jour.
//
// État PUBLIC etat.pacte :
//   { innocentSuit: Boolean (réglage pris à la distribution : un Innocent gracié tombe avec l'Aïeul),
//     sagessePerdue: 0 | n° du tour où le village a perdu sa sagesse,
//     gracies: [{ acteurId, tour, numero }] (les Innocents graciés, n° du vote),
//     egalite: null | { acteurId, tour, numero } (le Souffre-douleur condamné par une égalité),
//     votants: null | { tour, ids, par } (les seuls qui votent aux votes d'exécution du tour `tour`),
//     plume: null | { cible, tour, servi } (servi : n° du vote où elle a pesé, 0 : pas encore),
//     secondVote: null | { tour, numero } (le second vote du Greffier, ouvert : annoncé à tous, sans dire qui) }
// SECRETS etat.pacteSecret (chez le MJ actif, jamais dans l'état public) :
//   { aieux: [acteurId] (première vie perdue), furets: [acteurId] (flair perdu), contamines: [{ acteurId, nuit }],
//     signal: null | { tour, numero, par } (le signe du Greffier, avant que le second vote ne s'ouvre) }
import { trioAutour, voisins, premierAGauche } from "./cercle.mjs";
import { filtrerVotantsDuVillage, gracieParLeHobereau } from "./personnalites.mjs";
import { carteDeLEffet } from "./variantes.mjs";
import { filtrerVotantsDeLaGazette } from "./gazette.mjs";

export const EFFET_AIEUL = "resister";
export const EFFET_SOUFFRE_DOULEUR = "egalite";
export const EFFET_INNOCENT = "grace";
export const EFFET_FRATRIE = "fratrie";
export const EFFET_FURET = "flairer";
export const EFFET_OIES = "cacarder";
export const EFFET_GREFFIER = "second-vote";
export const EFFET_SERGENT = "contaminer";
export const EFFET_PIE = "plume";
export const CLE_GREFFIER = "greffier-begue";

// Le votant fictif de la plume noire (jamais un acteur) et son poids.
export const VOIX_DE_LA_PLUME = "~plume";
export const POIDS_DE_LA_PLUME = 2;

const liste = x => (Array.isArray(x) ? [...new Set(x.map(String).filter(Boolean))] : []);
const vivant = v => Boolean(v) && v.vivant !== false;

export const pacteInitial = ({ innocentSuit = false } = {}) => ({ innocentSuit: Boolean(innocentSuit), sagessePerdue: 0, gracies: [], egalite: null,
  votants: null, plume: null, secondVote: null });
export const pacteSecretInitial = () => ({ aieux: [], furets: [], contamines: [], signal: null });

export function normaliserPacte(p) {
  const x = p && typeof p === "object" ? p : {};
  const marque = m => (m && typeof m === "object" && m.acteurId ? { acteurId: String(m.acteurId), tour: Number(m.tour) || 0, numero: Number(m.numero) || 0 } : null);
  return {
    innocentSuit: Boolean(x.innocentSuit), sagessePerdue: Math.max(0, Number(x.sagessePerdue) || 0),
    gracies: (Array.isArray(x.gracies) ? x.gracies : []).map(marque).filter(Boolean),
    egalite: marque(x.egalite),
    votants: x.votants && typeof x.votants === "object" && Array.isArray(x.votants.ids)
      ? { tour: Number(x.votants.tour) || 0, ids: liste(x.votants.ids), par: String(x.votants.par ?? "") } : null,
    plume: x.plume && typeof x.plume === "object" && x.plume.cible
      ? { cible: String(x.plume.cible), tour: Number(x.plume.tour) || 0, servi: Number(x.plume.servi) || 0 } : null,
    secondVote: x.secondVote && typeof x.secondVote === "object" ? { tour: Number(x.secondVote.tour) || 0, numero: Number(x.secondVote.numero) || 0 } : null
  };
}

export function normaliserPacteSecret(s) {
  const x = s && typeof s === "object" ? s : {};
  return {
    aieux: liste(x.aieux), furets: liste(x.furets),
    contamines: (Array.isArray(x.contamines) ? x.contamines : []).filter(c => c?.acteurId).map(c => ({ acteurId: String(c.acteurId), nuit: Number(c.nuit) || 0 })),
    signal: x.signal && typeof x.signal === "object" && x.signal.par
      ? { tour: Number(x.signal.tour) || 0, numero: Number(x.signal.numero) || 0, par: String(x.signal.par) } : null
  };
}

// ------------------------------------------------------------------ la sagesse du village (l'Aïeul)
// Le village a-t-il perdu sa sagesse ? Dès lors, jusqu'à la fin : les rôles du VILLAGE (la carte, pas le camp actuel : comme sur
// table, le meneur cesse d'appeler les cartes du Village, une Liseuse mordue comprise) n'ont plus aucun pouvoir, de nuit, de jour
// ou à leur mort ; tous les métiers non plus (un loup qui garderait le sien se trahirait). Les charges (le Bailli) restent.
export const sagesseEstPerdue = etat => Number(etat?.pacte?.sagessePerdue) > 0;
// Ce rôle (à plat ou system : { camp }) a-t-il perdu son pouvoir ? perdue : sagesseEstPerdue(etat), ou un booléen déjà lu.
export const pouvoirPerdu = (perdue, role) => Boolean(perdue) && Boolean(role) && (role.camp ?? "village") === "village";

// Les causes qui brisent la sagesse : l'Aïeul tombé de la main du village — le vote, le poison de l'Herboriste, la Braconnière
// et le rasoir du Perruquier (Le Village, personnalites.mjs). Ni la meute, ni le chagrin, ni le harpon ou la noyade (cause « nuit »,
// qui ne les distingue pas), ni l'incendie.
export const CAUSES_SANS_SAGESSE = ["vote", "poison", "emporte", "rasoir"];

// L'Aïeul meurt : le village perd-il sa sagesse ? -> { perdue: Boolean, innocents: [acteurId à emporter avec lui] }
// innocents : les Innocents déjà graciés, encore vivants, si le réglage le veut (innocentSuit).
export function sagesseALaMort(etat, { role = null, cause = "", villageois = [] } = {}) {
  if (role?.effet !== EFFET_AIEUL || sagesseEstPerdue(etat) || !CAUSES_SANS_SAGESSE.includes(cause)) return { perdue: false, innocents: [] };
  const p = normaliserPacte(etat?.pacte);
  const gracies = new Set(p.gracies.map(g => g.acteurId));
  return { perdue: true, innocents: p.innocentSuit ? villageois.filter(v => vivant(v) && gracies.has(v.id)).map(v => v.id) : [] };
}

// La sagesse perdue (etat déjà normalisé, modifié sur place).
export function perdreLaSagesse(etat) {
  etat.pacte = { ...normaliserPacte(etat.pacte), sagessePerdue: Math.max(1, Number(etat.tour) || 0) };
  return etat;
}

// ------------------------------------------------------------------ l'Innocent
export const estGracie = (etat, acteurId) => normaliserPacte(etat?.pacte).gracies.some(g => g.acteurId === acteurId);
// Gracié par CE vote (n°) : l'étape « exécuter » de la Table ne le propose plus. Le Village (personnalites.mjs) : la grâce du
// Hobereau aussi.
export const gracieAuVote = (etat, acteurId, numero) => normaliserPacte(etat?.pacte).gracies.some(g => g.acteurId === acteurId && g.numero === numero)
  || gracieParLeHobereau(etat, acteurId, numero);

// L'Innocent condamné par le vote est-il gracié ? Il faut son rôle, la grâce pas encore servie, et la sagesse du village.
export const graceDue = (etat, { acteurId, role, cause }) => cause === "vote" && role?.effet === EFFET_INNOCENT && !estGracie(etat, acteurId)
  && !pouvoirPerdu(sagesseEstPerdue(etat), role);

// La grâce (etat déjà normalisé, modifié sur place) : il reste en jeu, ne votera plus. Bailli, il perd la charge, qui ne passe à
// personne : le village n'aura plus de Bailli (bailli.actif faux). -> { etat, bailli: Boolean (la charge est abolie) }
export function gracier(etat, acteurId, { numero = Number(etat?.vote?.numero) || 0 } = {}) {
  const p = normaliserPacte(etat.pacte);
  p.gracies.push({ acteurId, tour: Number(etat.tour) || 0, numero });
  etat.pacte = p;
  const bailli = Boolean(etat.bailli?.actif && etat.bailli.acteurId === acteurId);
  if (bailli) etat.bailli = { ...etat.bailli, actif: false, acteurId: "", succession: null };
  return { etat, bailli };
}

// ------------------------------------------------------------------ qui vote
// Les votants permis parmi ids, pour le vote ouvert (ou objet donné) : jamais un Innocent gracié ; aux votes d'exécution du tour
// désigné par le Souffre-douleur, seulement ceux de sa liste. Le Village (personnalites.mjs) : jamais le Régent ; aux votes
// d'exécution du jour, ni ceux qu'il a privés de vote ; au vote du Bailli, les seuls Métayers.
export function filtrerVotants(etat, ids = [], objet = etat?.vote?.objet ?? "execution") {
  const p = normaliserPacte(etat?.pacte);
  const gracies = new Set(p.gracies.map(g => g.acteurId));
  let admis = ids.filter(id => !gracies.has(id));
  if (objet === "execution" && p.votants && p.votants.tour === Number(etat?.tour)) {
    const permis = new Set(p.votants.ids);
    admis = admis.filter(id => permis.has(id));
  }
  // La Gazette (gazette.mjs) : ni les absents du jour, ni les privés de vote par le narrateur, ni l'accusé du Châtiment.
  return filtrerVotantsDeLaGazette(etat, filtrerVotantsDuVillage(etat, admis, objet), objet);
}

// Ce villageois est-il privé de ce vote (gracié, ou hors de la liste du Souffre-douleur) ? (bandeau, fenêtre de vote, Table)
export const priveDeVote = (etat, acteurId, objet) => Boolean(acteurId) && !filtrerVotants(etat, [acteurId], objet).length;

// La liste du Souffre-douleur (etat normalisé, modifié sur place) : pour les votes d'exécution du tour suivant.
export function designerVotants(etat, { par, ids = [] } = {}) {
  etat.pacte = { ...normaliserPacte(etat.pacte), votants: { tour: (Number(etat.tour) || 0) + 1, ids: liste(ids), par: String(par ?? "") } };
  return etat;
}

// ------------------------------------------------------------------ le Souffre-douleur
// Celui qui paiera une égalité : un Souffre-douleur vivant qui a son pouvoir (villageois à plat, rôles connus du MJ ; sa carte, ou
// sa seconde carte : Double visage) ; "" sinon.
export function souffreDouleur(etat, villageois = []) {
  const perdue = sagesseEstPerdue(etat);
  return villageois.find(v => { const c = carteDeLEffet(v, EFFET_SOUFFRE_DOULEUR); return vivant(v) && c && !pouvoirPerdu(perdue, c); })?.id ?? "";
}

// ------------------------------------------------------------------ la Pie
// Les rôles qu'une plume noire ne peut pas désigner. Elle-même non plus. Un Chemineau (la variante « Le Village », qui n'est pas un
// rôle mais l'absence de bâtiment) est écarté à part : jour.mjs (candidatsDeNuit) et resolution.mjs (chemineaux).
export const EXCLUS_DE_LA_PLUME = [];
export const candidatsDeLaPlume = (villageois = [], pieId = "", ids = villageois.filter(vivant).map(v => v.id)) => {
  const parId = new Map(villageois.map(v => [v.id, v]));
  return ids.filter(id => id !== pieId && !EXCLUS_DE_LA_PLUME.includes(parId.get(id)?.role?.cle ?? ""));
};
// La plume qui pèse au vote d'exécution ouvert : sa cible, si elle est du jour et n'a pas encore servi ; "" sinon.
export function plumeDuVote(etat) {
  const p = normaliserPacte(etat?.pacte).plume;
  return p && p.tour === Number(etat?.tour) && !p.servi ? p.cible : "";
}
// La plume posée au matin (etat normalisé, modifié sur place).
export function poserLaPlume(etat, cible) {
  etat.pacte = { ...normaliserPacte(etat.pacte), plume: cible ? { cible, tour: Number(etat.tour) || 0, servi: 0 } : null };
  return etat;
}
// Un vote annulé (le Juge de paix) : la plume qui y avait pesé pèsera au revote.
export function rendreLaPlume(etat, numero) {
  const p = normaliserPacte(etat.pacte);
  if (p.plume?.servi === numero) etat.pacte = { ...p, plume: { ...p.plume, servi: 0 } };
  return etat;
}

// ------------------------------------------------------------------ la Gardeuse d'oies
// Les Gardeuses dont les oies cacardent ce matin (villageois APRÈS la nuit : seuls les vivants comptent) : un loup (camp actuel,
// le vrai : les oies sentent la bête, aucune apparence ne les trompe) est l'un de ses deux voisins vivants ; ou elle-même est
// devenue loup (infectée). -> [acteurId]
export function oiesQuiCacardent(etat, villageois = []) {
  const perdue = sagesseEstPerdue(etat);
  const parId = new Map(villageois.map(v => [v.id, v]));
  return villageois.filter(v => vivant(v) && v.role?.effet === EFFET_OIES && !pouvoirPerdu(perdue, v.role)).filter(v => {
    if (v.camp === "meute") return true;
    const { gauche, droite } = voisins(etat, villageois, v.id);
    return [gauche, droite].some(id => id && id !== v.id && parId.get(id)?.camp === "meute");
  }).map(v => v.id);
}

// ------------------------------------------------------------------ le Furet
export const furetAveugle = (etat, acteurId) => normaliserPacteSecret(etat?.pacteSecret).furets.includes(acteurId);
// Le groupe flairé : le joueur désigné et ses deux voisins vivants (cercle.mjs, trioAutour).
export const groupeDuFuret = (etat, villageois, cible) => trioAutour(etat, villageois, cible);

// ------------------------------------------------------------------ le Vieux Sergent
// Le loup qu'il contamine : le premier loup vivant à sa gauche (villageois APRÈS la nuit). "" s'il n'y en a pas.
export const loupContamine = (etat, villageois, sergentId) => premierAGauche(etat, villageois, sergentId, v => v.camp === "meute");
// Ceux qui meurent de la contamination cette nuit-là (n°).
export const contaminesDeLaNuit = (etat, nuit) => normaliserPacteSecret(etat?.pacteSecret).contamines.filter(c => c.nuit === nuit).map(c => c.acteurId);

// ------------------------------------------------------------------ les fratries
// La fratrie qui veille cette nuit-là (Lavandières, Bûcherons) : la clé du rôle si ce rôle se réveille cette nuit, "" sinon.
// seReveille : la règle de nuit.mjs (passée ici pour ne pas lier les deux modules).
export const fratrieDeLaNuit = (role, tour, seReveille, options = {}) => (role?.effet === EFFET_FRATRIE && seReveille(role, tour, options) ? role.cle : "");
// Les autres membres vivants de sa fratrie (même clé de rôle). -> [acteurId]
export const freresDe = (villageois = [], acteurId) => {
  const moi = villageois.find(v => v.id === acteurId);
  if (!moi?.role?.cle || moi.role.effet !== EFFET_FRATRIE) return [];
  return villageois.filter(v => v.id !== acteurId && vivant(v) && v.role?.cle === moi.role.cle).map(v => v.id);
};

// ------------------------------------------------------------------ le Greffier bègue
// Le second vote est-il dû maintenant ? Un signe du Greffier ce jour-là, pas encore servi ; le dernier vote d'exécution du jour est
// clos, a désigné quelqu'un, et chacun de ses condamnés est tombé (ou a été gracié) — au moins un mort. villageois : à plat.
export function secondVoteDu(etat, villageois = []) {
  const s = normaliserPacteSecret(etat?.pacteSecret).signal;
  const p = normaliserPacte(etat?.pacte);
  const v = etat?.vote ?? {};
  const r = v.resultat;
  if (!s || s.tour !== Number(etat?.tour) || (p.secondVote && p.secondVote.tour === s.tour)) return false;
  if (v.ouvert || !r || r.objet !== "execution" || r.tour !== Number(etat?.tour) || r.numero !== v.numero || r.departage?.enAttente) return false;
  if (!(r.elus ?? []).length) return false;
  const parId = new Map(villageois.map(x => [x.id, x]));
  const tombes = r.elus.filter(id => parId.get(id)?.vivant === false);
  return tombes.length > 0 && r.elus.every(id => parId.get(id)?.vivant === false || gracieAuVote(etat, id, r.numero));
}
