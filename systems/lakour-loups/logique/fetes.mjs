// Les VEILLÉES DE FÊTE : quatre variantes de saison, une par fête du calendrier du moteur (lakour-mj-ia, docs/fetes.md). Logique pure.
//
// Une variante de partie, choisie à la distribution (distribuer / nouvellePartie({ fete }), case de la Table, réglage monde
// « veilleeDeFete ») ; jamais imposée par la date : la fête du calendrier ne fait que la PROPOSER (la Table la pré-sélectionne).
// Une seule veillée de fête par partie ; aucune dans la Nuit de la Saint-Martin. Public : etat.fete = { cle, neige, defile, defileNom }
// (la fête en jeu, le dernier matin de neige, le masque du défilé : sa clé et son nom). SECRET (le MJ actif ; coffre) : etat.secretsDeFete = { masque,
// masqueTombe, present, presentOuvert, promis } — qui porte le masque (et s'il est tombé), qui a reçu le présent, qui sont les promis.
//
// - LA NUIT DES ÂMES (halloween) : à l'aube qui suit une nuit meurtrière, l'âme du premier mort de la nuit s'assoit au pied du lit
//   d'un vivant tiré au hasard et lui murmure, en secret, si deux autres vivants tirés au hasard sont du même camp (tel que le
//   voient les visions). Mais les âmes frappent fort : chaque loup vivant apprend, en secret, à quelle porte elle a frappé.
// - LA VEILLÉE D'HIVER (noel) : à la distribution, un joueur tiré au hasard (tous camps) reçoit en secret le PRÉSENT de la Dame
//   aux grelots : le premier coup qui devait le tuer la nuit échoue (meute, peste, poison, feu, tueurs ; ni le chagrin, ni le
//   vote, ni le linceul du Glas du deuil), une fois. Et à chaque aube, la neige peut tomber (une chance sur trois, jamais
//   deux aubes de suite ; annoncée à tous) : ce jour-là, elle a recouvert les traces — Chasseresse, Ramoneuse, Tanneur et Colporteur de nouvelles n'apprennent
//   rien (leur pouvoir attend un autre matin), le Lavoir se tait.
// - LE CARNAVAL DES MASQUES (carnaval) : à la distribution, un joueur tiré au hasard (tous camps) porte en secret le MASQUE du
//   Carnaval : la PREMIÈRE vision du Village qui se pose sur lui (Liseuse, Sourcier, prière de la Pèlerine) le voit du camp opposé à
//   celui qu'elle verrait, puis le masque tombe, sans bruit ; un regard de la meute (Loup flaireur, vision du Glas du deuil, loup qui
//   lit pour elle) n'est jamais trompé. Et le DÉFILÉ montre à tous un masque que personne au village ne porte : l'un des Masques de
//   veillée de la meute si elle en a au moins deux (elle perd cet alibi, jamais le dernier), sinon un rôle du Village absent.
// - LA FÊTE DES PROMIS (saint-valentin) : à la distribution, deux joueurs du Village tirés au hasard sont promis l'un à l'autre :
//   chacun apprend en secret le nom de l'autre (un allié sûr) ; mais les promis s'affichent, et la meute apprend leurs deux noms.
import { choisir, melanger } from "./hasard.mjs";
import { campInverse, CLE_SOMNAMBULE, CLE_ROSIERE } from "./somnambule.mjs";
import { apparenceDe } from "./resolution.mjs";

export const NUIT_DES_AMES = "nuit-des-ames";
export const VEILLEE_D_HIVER = "veillee-d-hiver";
export const CARNAVAL_DES_MASQUES = "carnaval-des-masques";
export const FETE_DES_PROMIS = "fete-des-promis";

// Chaque veillée de fête et la fête du calendrier du moteur qui la propose.
export const VEILLEES_DE_FETE = {
  [NUIT_DES_AMES]: { fete: "halloween" },
  [VEILLEE_D_HIVER]: { fete: "noel" },
  [CARNAVAL_DES_MASQUES]: { fete: "carnaval" },
  [FETE_DES_PROMIS]: { fete: "saint-valentin" }
};
export const CLES_DE_FETE = Object.keys(VEILLEES_DE_FETE);

// La neige de la Veillée d'hiver : une chance sur trois à chaque aube, jamais deux aubes de suite. Les pouvoirs du matin qu'elle aveugle (ils lisent des traces).
export const CHANCE_NEIGE = 1 / 3;
export const POUVOIRS_DE_TRACES = ["chasseresse", "ramoneuse", "tanneur", "colporteur-de-nouvelles"];

export const cleDeFete = cle => (CLES_DE_FETE.includes(cle) ? cle : "");
// La veillée que propose une fête du calendrier du moteur ("halloween" -> "nuit-des-ames") ; "" sinon.
export const veilleeDuCalendrier = fete => CLES_DE_FETE.find(c => VEILLEES_DE_FETE[c].fete === fete) ?? "";

export const feteInitiale = (cle = "") => ({ cle: cleDeFete(cle), neige: 0, defile: "", defileNom: "" });
export function normaliserFete(f) {
  const x = f && typeof f === "object" ? f : {};
  return { cle: cleDeFete(x.cle), neige: Math.max(0, Number(x.neige) || 0), defile: String(x.defile ?? ""), defileNom: String(x.defileNom ?? "") };
}

export const secretsDeFeteInitiaux = () => ({ masque: "", masqueTombe: false, present: "", presentOuvert: false, promis: [] });
export function normaliserSecretsDeFete(s) {
  const x = s && typeof s === "object" ? s : {};
  return { masque: String(x.masque ?? ""), masqueTombe: Boolean(x.masqueTombe), present: String(x.present ?? ""), presentOuvert: Boolean(x.presentOuvert),
    promis: Array.isArray(x.promis) ? x.promis.map(String).slice(0, 2) : [] };
}

// La veillée de fête en jeu ("" : aucune) ; estFete(etat, cle) : est-ce celle-là ?
export const feteEnJeu = etat => normaliserFete(etat?.fete).cle;
export const estFete = (etat, cle) => Boolean(cle) && feteEnJeu(etat) === cle;

// ------------------------------------------------------------------ à la distribution : les tirages secrets
// joueurs : [{ id, camp }] (les fiches neuves). -> secretsDeFete. Le hasard : celui de la graine (reproductible).
export function tirerSecretsDeFete(cle, { joueurs = [], hasard = Math.random } = {}) {
  const s = secretsDeFeteInitiaux();
  const ids = joueurs.map(j => j.id).filter(Boolean);
  if (cle === VEILLEE_D_HIVER) s.present = choisir(ids, hasard) ?? "";
  if (cle === CARNAVAL_DES_MASQUES) s.masque = choisir(ids, hasard) ?? "";
  if (cle === FETE_DES_PROMIS) {
    const village = melanger(joueurs.filter(j => j.id && j.camp === "village").map(j => j.id), hasard);
    if (village.length >= 2) s.promis = village.slice(0, 2);
  }
  return s;
}

// Le défilé du Carnaval : un masque que personne ne porte, choisi parmi les rôles du Village absents de la partie (comme les masques :
// ni « villageois », ni Somnambule, ni Rosière, ni rôle « sur demande »). Si la meute a au moins deux Masques de veillée, l'un d'eux
// défile (elle perd cet alibi, jamais le dernier) ; avec un seul, il ne défile pas (garde-fou : la meute garde toujours un alibi).
// roles : [{ cle, camp, surDemande }] du contenu ; enJeu : [cle] distribuées. -> cle | ""
export function choisirDefile({ masques = [], roles = [], enJeu = [], hasard = Math.random } = {}) {
  const siens = [...new Set(masques.filter(c => !enJeu.includes(c)))].sort();
  if (siens.length >= 2) return choisir(siens, hasard) ?? "";
  const absents = [...new Set(roles.filter(r => r?.cle && r.camp === "village" && r.cle !== "villageois" && r.cle !== CLE_SOMNAMBULE
    && r.cle !== CLE_ROSIERE && !r.surDemande && !enJeu.includes(r.cle) && !siens.includes(r.cle)).map(r => r.cle))].sort();
  return choisir(absents, hasard) ?? "";
}

// ------------------------------------------------------------------ le masque du Carnaval
// Qui porte le masque ("" : personne, pas de Carnaval, ou le masque déjà tombé).
export function masqueDuCarnaval(etat) {
  if (!estFete(etat, CARNAVAL_DES_MASQUES)) return "";
  const s = normaliserSecretsDeFete(etat?.secretsDeFete);
  return s.masqueTombe ? "" : s.masque;
}
// Le masque trompe-t-il cette vision ? Seulement sur son porteur, et seulement un regard qui n'est pas celui de la meute (Loup flaireur,
// vision du Glas du deuil, loup mordu qui lit pour elle, loup qui reçoit un murmure) : la meute, qui connaît les siens, reconnaîtrait
// sinon le porteur d'un masque qui lui montre un loup de trop. observateur : { camp } de celui qui regarde (null : un regard du Village).
export const masqueTrompe = (v, masque = "", observateur = null) => Boolean(v && masque && v.id === masque && observateur?.camp !== "meute");
// Le camp que voit une vision : l'apparence, retournée pour le porteur du masque quand le masque trompe ce regard.
export function apparenceMasquee(v, masque = "", observateur = null) {
  const a = apparenceDe(v);
  return masqueTrompe(v, masque, observateur) ? campInverse(a) : a;
}

// ------------------------------------------------------------------ le présent de la Veillée d'hiver
// Le présent qui veille encore cette nuit ("" : aucun, ou déjà ouvert).
export function presentDeLaNuit(etat) {
  if (!estFete(etat, VEILLEE_D_HIVER)) return "";
  const s = normaliserSecretsDeFete(etat?.secretsDeFete);
  return s.present && !s.presentOuvert ? s.present : "";
}

// ------------------------------------------------------------------ la neige de la Veillée d'hiver
// A-t-il neigé ce matin (le jour du tour `tour`) ?
export const neigeDuJour = (etat, tour = etat?.tour) => estFete(etat, VEILLEE_D_HIVER) && Number(tour) > 0 && normaliserFete(etat.fete).neige === Number(tour);
// La neige tombe-t-elle cette nuit ? (tirée à l'aube du tour etat.tour : une chance sur trois, jamais deux aubes de suite)
export const tirerNeige = (etat, hasard = Math.random) => estFete(etat, VEILLEE_D_HIVER)
  && !(Number(etat.tour) > 1 && normaliserFete(etat.fete).neige === Number(etat.tour) - 1) && hasard() < CHANCE_NEIGE;
// Un pouvoir du matin que la neige aveugle aujourd'hui.
export const aveuglePar = (etat, pouvoir) => POUVOIRS_DE_TRACES.includes(pouvoir) && neigeDuJour(etat);

// ------------------------------------------------------------------ le murmure des âmes (Nuit des âmes)
// À l'aube, après les morts de la nuit. villageois : APRÈS la nuit ; deces : [{ acteurId, cause }] de resoudreNuit ; masque : le
// porteur du masque (jamais en même temps, mais la règle tient : il ne trompe pas un receveur loup). -> null | { ame, receveur, a,
// b, meme, loups: [acteurId] }. L'âme : le premier mort de la nuit (hors chagrin s'il y en a un autre) ; le receveur et la paire :
// des vivants distincts.
export function murmureDesAmes({ villageois = [], deces = [], masque = "", hasard = Math.random } = {}) {
  const ame = (deces.find(d => d.cause !== "chagrin") ?? deces[0])?.acteurId;
  if (!ame) return null;
  const vivants = villageois.filter(v => v.vivant !== false);
  if (vivants.length < 3) return null;
  const receveur = choisir(vivants, hasard);
  const [a, b] = melanger(vivants.filter(v => v.id !== receveur.id), hasard);
  const meme = apparenceMasquee(a, masque, receveur) === apparenceMasquee(b, masque, receveur);
  const loups = vivants.filter(v => v.camp === "meute").map(v => v.id);
  return { ame, receveur: receveur.id, a: a.id, b: b.id, meme, loups };
}

// Les messages du murmure : au receveur (le murmure), à chaque loup vivant (la porte : le nom du receveur, rien d'autre), au MJ.
// nom : id -> nom. -> [msg] ({ destinataire, cle, texte, donnees })
export function messagesDuMurmure(m, nom = id => id) {
  if (!m) return [];
  const msg = (destinataire, cle, texte, donnees) => ({ destinataire, cle: `LAKOUR_LOUPS.Fetes.Ames.${cle}`, texte, donnees });
  const d = { ame: nom(m.ame), a: nom(m.a), b: nom(m.b), nom: nom(m.receveur) };
  return [
    msg(m.receveur, m.meme ? "MurmureMeme" : "MurmureAutre", m.meme
      ? `L'âme de ${d.ame} s'est assise au pied de votre lit. Elle murmure que ${d.a} et ${d.b} sont du même camp.`
      : `L'âme de ${d.ame} s'est assise au pied de votre lit. Elle murmure que ${d.a} et ${d.b} ne sont pas du même camp.`, { ame: d.ame, a: d.a, b: d.b }),
    ...m.loups.map(id => msg(id, "Porte", `Cette nuit, une âme a frappé à la porte de ${d.nom}.`, { nom: d.nom })),
    msg("mj", m.meme ? "MjMeme" : "MjAutre", m.meme
      ? `Nuit des âmes : l'âme de ${d.ame} a murmuré à ${d.nom} que ${d.a} et ${d.b} sont du même camp.`
      : `Nuit des âmes : l'âme de ${d.ame} a murmuré à ${d.nom} que ${d.a} et ${d.b} ne sont pas du même camp.`, d)
  ];
}
