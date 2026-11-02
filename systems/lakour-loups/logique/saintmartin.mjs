// La Nuit de la Saint-Martin : le format court (une dizaine de minutes). Logique pure.
//
// Une variante de partie (nouvellePartie({ format: "saint-martin" })), publique : etat.format = "saint-martin".
// - LA COMPOSITION : AUTEL rôles de plus que de joueurs ; ceux qui restent dorment « sous l'autel de la Chapelle » (secret du MJ :
//   etat.autel = [cle]) : personne ne sait lesquels manquent. Dans la réserve : loupsSaintMartin(n) + 1 loups (l'un d'eux peut
//   dormir sous l'autel), une Liseuse de cendres, un Colporteur (l'échange de rôles de la nuit), des rôles simples du contenu,
//   et au moins un villageois.
// - LE DÉROULEMENT : UNE seule nuit (l'ordre habituel, échanges du Colporteur compris), une aube, un débat, UN seul vote
//   d'exécution, puis la fin — sans Bailli, sans Almanach, sans Banc des accusés (qui demanderaient d'autres votes ou d'autres
//   jours). Avant ce vote, aucune victoire ne tombe.
// - LA FIN (victoireSaintMartin) : un loup exécuté -> le village ; le Revenant exécuté -> lui ; sinon, un loup encore vivant ->
//   la meute ; sans loup parmi les joueurs (tous sous l'autel) : le village s'il n'a exécuté personne, sinon la brume l'emporte
//   (VAINQUEUR_BRUME : personne ne gagne).
import { creerHasard, melanger } from "./hasard.mjs";
import { victoireCleDe } from "./victoire.mjs";

export const FORMAT_SAINT_MARTIN = "saint-martin";
export const AUTEL = 3;
export const VAINQUEUR_BRUME = "brume";
const SOCLE = ["liseuse-de-cendres", "colporteur"];
const SIMPLES = ["garde-du-pont", "fossoyeur", "veilleuse-de-lanterne", "sourcier", "herboriste", "revenant"];

export const estSaintMartin = etat => etat?.format === FORMAT_SAINT_MARTIN;
export const loupsSaintMartin = n => (n >= 7 ? 2 : 1);

// La composition : n + AUTEL rôles, mélangés ; les n premiers aux joueurs, les AUTEL derniers sous l'autel.
// disponibles : [cle] du contenu. -> { joueurs: [cle] (n), autel: [cle] (AUTEL) }
export function composerSaintMartin(n, { disponibles = [], graine, hasard } = {}) {
  const h = hasard ?? creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `saint-martin|${graine}`);
  const total = n + AUTEL;
  const permis = c => disponibles.includes(c);
  const roles = [];
  for (let i = 0; i < loupsSaintMartin(n) + 1 && roles.length < total; i++) if (permis("loup-de-brumecombe")) roles.push("loup-de-brumecombe");
  for (const c of SOCLE) if (permis(c) && roles.length < total) roles.push(c);
  for (const c of melanger(SIMPLES.filter(permis), h)) if (roles.length < total - 1) roles.push(c);
  while (roles.length < total) roles.push("villageois");
  const tires = melanger(roles, h);
  return { joueurs: tires.slice(0, n), autel: tires.slice(n) };
}

// La fin de la Saint-Martin, après son unique vote d'exécution (et ses exécutions). saintMartinFinie : le vote a eu lieu et
// ses condamnés sont morts (verifierVictoire, saintMartin: true).
// villageois : [{ id, vivant, camp, role }] ; morts : etat.morts. -> "village" | "meute" | VAINQUEUR_BRUME | acteurId
export function victoireSaintMartin({ villageois = [], morts = [] } = {}) {
  const executes = morts.filter(m => m.cause === "vote").map(m => villageois.find(v => v.id === m.acteurId)).filter(Boolean);
  if (executes.some(v => v.camp === "meute")) return "village";
  const revenant = executes.find(v => victoireCleDe(v.role) === "execute");
  if (revenant) return revenant.id;
  if (villageois.some(v => v.vivant !== false && v.camp === "meute")) return "meute";
  return executes.length ? VAINQUEUR_BRUME : "village";
}

// Le vote de la Saint-Martin a-t-il eu lieu (clos, d'exécution) ? Alors la partie peut finir. Son vote : le dernier vote
// d'exécution du Registre (non annulé), même si un vote d'exil l'a suivi ; aucun vote ouvert.
// villageois : pour vérifier que ses condamnés sont bien morts (l'exécution suit le dépouillement).
export function saintMartinFinie(etat, villageois = []) {
  if (!estSaintMartin(etat) || etat.vote?.ouvert || !(etat.tour >= 1)) return false;
  const r = [...(etat.registre ?? [])].reverse().find(x => x.type === "vote" && x.objet === "execution" && !x.annule);
  if (!r) return false;
  return (r.elus ?? []).every(id => villageois.find(v => v.id === id)?.vivant === false);
}
