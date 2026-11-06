// LE VILLAGE (Le Pacte, étape 4 de docs/plan-le-pacte.md) : la variante du jeu de soirée où des PERSONNALITÉS tiennent chacune un
// bâtiment du village, qui leur donne un pouvoir EN PLUS de leur carte de rôle secrète. Logique pure.
//
// Sur table, le narrateur pose devant certains joueurs, face visible, une carte de bâtiment (jeton « rôle visible ») : tout le
// village sait qui est le Prieur, le Cabaretier ou un Métayer ; la carte de rôle, elle, reste secrète. Les joueurs sans bâtiment
// sont des CHEMINEAUX (vagabonds), publics eux aussi. Ici, qui tient quoi vit dans le socle des bâtiments tenus (tenures.mjs,
// etat.tenures, public) ; ce que la variante garde en plus vit dans etat.village (public : tout y est connu de la table).
//
// Les bâtiments (clés stables) et leur personnalité (table « Personnalités du village » du plan) :
// - « metairie-1 » à « metairie-6 » — Métayers (permanent) : à partir du deuxième jour, les Métayers vivants votent entre eux pour
//   désigner le Bailli, parmi eux (bailli.mjs : electionPossible, candidatsSuccession ; pacte.mjs, filtrerVotants). Mort, le
//   Bailli choisit son successeur parmi les Métayers vivants. Le dernier Métayer mort, il n'y a plus de Bailli (api.mjs : la
//   charge est abolie). Cela remplace l'élection du Bailli par tout le village.
// - « prieure » — Prieur (unique) : à tout moment le jour, même après la désignation du condamné, un joueur lui montre sa carte
//   en secret (pouvoir de jour, jour.mjs).
// - « masure » — Remégeux (unique) : à tout moment le jour, il rend à un joueur le pouvoir UNIQUE de bâtiment que celui-ci a
//   déjà utilisé (jour.mjs).
// - « ecole » — Régent (permanent) : chaque jour, juste avant le vote, il prive jusqu'à deux joueurs de vote à ce tour (ils
//   débattent encore) ; il ne vote jamais lui-même ; il peut priver le Cabaretier, jamais un Chemineau (jour.mjs).
// - « fournil » — Fournière (permanent) : chaque nuit, quand la meute se rendort, elle entrouvre les yeux. Adaptation en ligne
//   (la table a ses yeux, pas l'écran) : avec la chance CHANCE_FOURNIERE, elle entrevoit UN loup vivant au hasard, dont le nom
//   lui est écrit au carnet ; sinon, rien (apercusDeLaFourniere).
// - « echoppe » — Perruquier (unique) : à tout moment le jour, il élimine un joueur (jamais un Chemineau). Un loup : il est
//   félicité et survit ; sinon, il est éliminé aussitôt. Cause « rasoir » ; une mort du village pour l'Aïeul (pacte.mjs,
//   CAUSES_SANS_SAGESSE).
// - « cabaret » — Cabaretier (permanent, conditionnel) : la meute ne peut pas le dévorer, le village ne peut pas voter contre lui
//   (retiré des proies et des candidats). S'il vote contre un joueur que le vote désigne (même gracié ensuite), il perd son
//   immunité (et son jeton). Sur table, il vote seul, avant les autres, tant qu'il a son immunité : adaptation en ligne, son vote
//   est rendu public dès qu'il le pose (api.mjs, recevoirVote). Les autres pouvoirs (Perruquier, Pie, Régent…) le touchent.
// - « prevote » — Prévôt (permanent) : quand un bâtiment se libère (la mort de son occupant), il peut y installer un Chemineau de
//   son choix, qui peut refuser (deux demandes, api.mjs : suivreVacances). Le Chemineau prend la place du bâtiment (seule la
//   tenure change : le cercle du socle ne bouge pas), rend son baluchon et reçoit le pouvoir rétabli. Plusieurs bâtiments
//   libérés le même matin : chacun à son tour. Le Prévôt mort, plus aucun logement n'est attribué.
// - « manoir » — Hobereau (unique) : après un vote d'exécution, à la demande du futur condamné, il peut le gracier : le gracié
//   n'est pas éliminé et ne montre pas sa carte. Il peut se gracier lui-même (api.mjs : proposerLaGrace, deux demandes courtes).
// Et l'Incendiaire, un RÔLE du Village (contenu, effet « incendier », une fois par partie, appelé la nuit) : il désigne un
// bâtiment (en ligne : son occupant ; un Chemineau n'en a pas) ; au matin, le bâtiment est détruit pour toujours, son occupant
// devient Chemineau ; si c'était la maison de la proie de la meute, le premier loup vivant à DROITE de la proie est carbonisé
// (cause publique « incendie ») et la meute n'a pas de victime cette nuit (resolution.mjs).
//
// Un pouvoir PERMANENT vaut toute la partie ; un pouvoir UNIQUE sert une fois. Un bâtiment détruit prive son occupant du pouvoir
// (il est retiré des tenures). Un occupant éliminé rend son bâtiment, qui devient vacant (le socle) et attend le Prévôt. Un
// Chemineau installé reçoit le pouvoir ENTIER : un pouvoir unique déjà servi redevient disponible (l'usage est rangé avec
// l'occupant qui l'a pris : epuises[cle] = acteurId, qui ne vaut plus pour un autre occupant).
// Les pouvoirs du Régent, du Perruquier, de la Pie et de l'Incendiaire n'ont aucun effet sur un Chemineau (candidats filtrés).
// La sagesse perdue (l'Aïeul, pacte.mjs) : les personnalités perdent leur pouvoir comme les métiers (ce sont des pouvoirs
// spéciaux de villageois ; tous publics, les perdre tous ne trahit personne) — sauf les Métayers : la désignation du Bailli est
// la charge, et les charges restent (étape 3a).
//
// État PUBLIC etat.village :
//   { actif: Boolean (la variante, prise à la distribution), detruits: [cle] (brûlés par l'Incendiaire),
//     epuises: { cle: acteurId } (pouvoir unique servi, ou immunité du Cabaretier perdue, par cet occupant),
//     attente: [cle] (bâtiments libérés qui attendent le Prévôt), regent: null | { tour, ids, par } (privés de vote ce jour),
//     graces: [{ acteurId, tour, numero }] (les graciés du Hobereau, n° du vote), cabaret: null | { numero, cible } (le vote public du
//     Cabaretier au vote en cours) }
import { normaliserTenures } from "./tenures.mjs";
import { creerHasard, melanger, choisir } from "./hasard.mjs";

export const METAIRIES = ["metairie-1", "metairie-2", "metairie-3", "metairie-4", "metairie-5", "metairie-6"];
// Le bâtiment -> sa personnalité, et la durée de son pouvoir.
export const BATIMENTS_DU_VILLAGE = Object.freeze({
  ...Object.fromEntries(METAIRIES.map(cle => [cle, { personnalite: "metayer", pouvoir: "permanent" }])),
  prieure: { personnalite: "prieur", pouvoir: "unique" },
  masure: { personnalite: "remegeux", pouvoir: "unique" },
  ecole: { personnalite: "regent", pouvoir: "permanent" },
  fournil: { personnalite: "fourniere", pouvoir: "permanent" },
  echoppe: { personnalite: "perruquier", pouvoir: "unique" },
  cabaret: { personnalite: "cabaretier", pouvoir: "permanent" },
  prevote: { personnalite: "prevot", pouvoir: "permanent" },
  manoir: { personnalite: "hobereau", pouvoir: "unique" }
});
export const PERSONNALITES = ["metayer", "prieur", "remegeux", "regent", "fourniere", "perruquier", "cabaretier", "prevot", "hobereau"];
export const CLE_CHEMINEAU = "chemineau";
// L'Incendiaire (rôle du Village, contenu lakour-veillees).
export const CLE_INCENDIAIRE = "incendiaire";
export const EFFET_INCENDIAIRE = "incendier";
// La Fournière entrevoit un loup une nuit sur trois (adaptation en ligne ; à recalibrer à l'étape 6, simulation).
export const CHANCE_FOURNIERE = 1 / 3;
// Le Régent prive de vote jusqu'à deux joueurs.
export const CIBLES_DU_REGENT = 2;
// Le Hobereau : la fenêtre de chacune de ses deux demandes (le condamné demande grâce, le Hobereau répond), juste après le
// décompte. Adaptation en ligne : sur table, le condamné le supplie de vive voix avant qu'on retourne sa carte.
export const DELAI_GRACE = 30000;
// Les Métayers désignent le Bailli à partir du deuxième jour.
export const JOUR_DES_METAYERS = 2;
// L'ordre où la proposition de distribution prend les personnalités (les plus simples d'abord ; le Prévôt seulement s'il y a des
// Chemineaux à loger ; le Remégeux en dernier, quand il y a des pouvoirs uniques à rendre).
export const ORDRE_DES_PERSONNALITES = ["prieure", "cabaret", "echoppe", "ecole", "manoir", "fournil", "prevote", "masure"];

export const estDuVillage = cle => Object.prototype.hasOwnProperty.call(BATIMENTS_DU_VILLAGE, cle);
export const personnaliteDuBatiment = cle => BATIMENTS_DU_VILLAGE[cle]?.personnalite ?? "";
export const estMetairie = cle => METAIRIES.includes(cle);

const liste = x => (Array.isArray(x) ? [...new Set(x.map(String).filter(Boolean))] : []);
const vivant = v => Boolean(v) && v.vivant !== false;

export const villageInitial = (actif = false) => ({ actif: Boolean(actif), detruits: [], epuises: {}, attente: [], regent: null, graces: [], cabaret: null });

export function normaliserVillage(v) {
  const x = v && typeof v === "object" ? v : {};
  const epuises = {};
  for (const [cle, id] of Object.entries(x.epuises && typeof x.epuises === "object" ? x.epuises : {})) if (estDuVillage(cle) && id) epuises[cle] = String(id);
  return {
    actif: Boolean(x.actif),
    detruits: liste(x.detruits).filter(estDuVillage),
    epuises,
    attente: liste(x.attente).filter(estDuVillage),
    regent: x.regent && typeof x.regent === "object" && Array.isArray(x.regent.ids)
      ? { tour: Number(x.regent.tour) || 0, ids: liste(x.regent.ids), par: String(x.regent.par ?? "") } : null,
    graces: (Array.isArray(x.graces) ? x.graces : []).filter(g => g?.acteurId)
      .map(g => ({ acteurId: String(g.acteurId), tour: Number(g.tour) || 0, numero: Number(g.numero) || 0 })),
    cabaret: x.cabaret && typeof x.cabaret === "object" && x.cabaret.cible
      ? { numero: Number(x.cabaret.numero) || 0, cible: String(x.cabaret.cible) } : null
  };
}

export const villageActif = etat => Boolean(etat?.village?.actif);
const sagessePerdue = etat => Number(etat?.pacte?.sagessePerdue) > 0;

// ------------------------------------------------------------------ qui tient quoi
// L'occupant d'un bâtiment du village encore debout : son acteurId, ou "".
export function occupant(etat, cle) {
  if (!villageActif(etat) || !estDuVillage(cle) || normaliserVillage(etat.village).detruits.includes(cle)) return "";
  return normaliserTenures(etat?.tenures)[cle] ?? "";
}
// Le bâtiment du village que tient ce joueur (un seul : le premier rangé), ou "".
export function batimentDe(etat, acteurId) {
  if (!villageActif(etat) || !acteurId) return "";
  const detruits = normaliserVillage(etat.village).detruits;
  return Object.entries(normaliserTenures(etat.tenures)).find(([cle, id]) => id === String(acteurId) && estDuVillage(cle) && !detruits.includes(cle))?.[0] ?? "";
}
// Sa personnalité ("metayer", "prieur"… ; "chemineau" sans bâtiment ; "" hors de la variante).
export function personnaliteDe(etat, acteurId) {
  if (!villageActif(etat)) return "";
  const cle = batimentDe(etat, acteurId);
  return cle ? personnaliteDuBatiment(cle) : CLE_CHEMINEAU;
}
export const estChemineau = (etat, acteurId) => villageActif(etat) && Boolean(acteurId) && !batimentDe(etat, acteurId);
// Les Chemineaux vivants. -> [acteurId]
export const chemineaux = (etat, villageois = []) => (villageActif(etat) ? villageois.filter(v => vivant(v) && estChemineau(etat, v.id)).map(v => v.id) : []);
// Les bâtiments libérés (vacants, encore debout) : [cle].
export function vacantsDuVillage(etat) {
  if (!villageActif(etat)) return [];
  const t = normaliserTenures(etat.tenures);
  const detruits = normaliserVillage(etat.village).detruits;
  return Object.keys(t).filter(cle => estDuVillage(cle) && !t[cle] && !detruits.includes(cle));
}

// Le pouvoir du bâtiment est-il entre les mains de cet occupant, maintenant ? Le bâtiment debout et tenu par lui ; la sagesse du
// village (sauf les métairies : la charge de Bailli) ; un pouvoir unique pas encore servi PAR LUI, l'immunité du Cabaretier pas
// encore perdue PAR LUI. -> "" (oui) | "absent" | "sagesse" | "usage"
export function raisonDuPouvoir(etat, cle, acteurId) {
  if (!acteurId || occupant(etat, cle) !== String(acteurId)) return "absent";
  if (sagessePerdue(etat) && !estMetairie(cle)) return "sagesse";
  if (normaliserVillage(etat.village).epuises[cle] === String(acteurId)) return "usage";
  return "";
}
export const pouvoirIntact = (etat, cle, acteurId) => !raisonDuPouvoir(etat, cle, acteurId);
// Le porteur VIVANT d'un pouvoir intact : son acteurId, ou "". villageois : à plat (null : sans vérifier la vie).
export function porteur(etat, cle, villageois = null) {
  const id = occupant(etat, cle);
  if (!id || !pouvoirIntact(etat, cle, id)) return "";
  if (villageois && !vivant(villageois.find(v => v.id === id))) return "";
  return id;
}

// Le pouvoir est servi (unique), ou l'immunité perdue (Cabaretier) : rangé avec son occupant. (etat normalisé, modifié sur place)
export function marquerEpuise(etat, cle, acteurId) {
  const v = normaliserVillage(etat.village);
  etat.village = { ...v, epuises: { ...v.epuises, [cle]: String(acteurId) } };
  return etat;
}
// Le pouvoir unique rendu (le Remégeux), ou rétabli pour un nouvel occupant (le Prévôt). (modifié sur place)
export function retablir(etat, cle) {
  const v = normaliserVillage(etat.village);
  const epuises = { ...v.epuises };
  delete epuises[cle];
  etat.village = { ...v, epuises };
  return etat;
}
// Un Chemineau installé dans un bâtiment (le Prévôt ; le narrateur à la préparation) : la tenure change, le pouvoir est rétabli.
// Le bâtiment sort de l'attente du Prévôt. (modifié sur place)
export function installer(etat, cle, acteurId) {
  etat.tenures = { ...normaliserTenures(etat.tenures), [cle]: acteurId ? String(acteurId) : null };
  retablir(etat, cle);
  const v = normaliserVillage(etat.village);
  etat.village = { ...v, attente: v.attente.filter(c => c !== cle) };
  return etat;
}
// Des bâtiments brûlés (l'Incendiaire) : retirés pour toujours ; leur occupant devient Chemineau. (modifié sur place)
export function detruire(etat, cles = []) {
  const t = normaliserTenures(etat.tenures);
  for (const cle of cles) delete t[cle];
  etat.tenures = t;
  const v = normaliserVillage(etat.village);
  etat.village = { ...v, detruits: [...new Set([...v.detruits, ...cles])], attente: v.attente.filter(c => !cles.includes(c)),
    epuises: Object.fromEntries(Object.entries(v.epuises).filter(([c]) => !cles.includes(c))) };
  return etat;
}
// Les bâtiments libérés à une mort attendent le Prévôt (ajouterMort). (modifié sur place)
export function attendreLePrevot(etat, cles = []) {
  if (!villageActif(etat)) return etat;
  const v = normaliserVillage(etat.village);
  const nouveaux = cles.filter(estDuVillage);
  if (nouveaux.length) etat.village = { ...v, attente: [...new Set([...v.attente, ...nouveaux])] };
  return etat;
}
// Le Prévôt a décidé (ou ne peut plus) pour ce bâtiment : il sort de l'attente. (modifié sur place)
export function sortirDeLAttente(etat, cle) {
  const v = normaliserVillage(etat.village);
  etat.village = { ...v, attente: v.attente.filter(c => c !== cle) };
  return etat;
}

// ------------------------------------------------------------------ la distribution
// Les bâtiments proposés pour n places (une proposition : le narrateur la change avant la première nuit). Quelques Chemineaux
// (aucun sous cinq places, un jusqu'à sept, puis un pour six places), des métairies (de deux à six, un tiers des tenanciers, dès
// cinq tenanciers : sinon pas de Bailli), puis les personnalités dans ORDRE_DES_PERSONNALITES (le Prévôt seulement s'il y a des
// Chemineaux) ; le surplus va aux métairies, puis aux Chemineaux. -> [cle] (au plus n)
export function proposerLeVillage(n) {
  const places = Math.max(0, Math.floor(Number(n) || 0));
  const nbChemineaux = places >= 8 ? Math.max(1, Math.round(places / 6)) : places >= 5 ? 1 : 0;
  const tenanciers = places - nbChemineaux;
  let metairies = tenanciers >= 5 ? Math.min(METAIRIES.length, Math.max(2, Math.round(tenanciers / 3))) : 0;
  const ordre = ORDRE_DES_PERSONNALITES.filter(cle => cle !== "prevote" || nbChemineaux > 0);
  const autres = ordre.slice(0, Math.max(0, tenanciers - metairies));
  metairies = Math.min(METAIRIES.length, tenanciers - autres.length);
  return [...autres, ...METAIRIES.slice(0, metairies)];
}
// Les bâtiments confiés au hasard (graine) : { cle: acteurId }. ids : les joueurs dans l'ordre des places.
export function distribuerLeVillage(ids = [], { batiments = proposerLeVillage(ids.length), graine } = {}) {
  const melanges = melanger(ids.map(String), creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `village|${graine}`));
  return Object.fromEntries(batiments.slice(0, melanges.length).map((cle, i) => [cle, melanges[i]]));
}

// ------------------------------------------------------------------ le vote (Régent, Métayers, Cabaretier)
// Les votants permis par la variante parmi ids (pacte.mjs, filtrerVotants, l'appelle) : le Régent ne vote jamais ; aux votes
// d'exécution de ce tour, ceux qu'il a privés ; au vote du Bailli, les seuls Métayers.
export function filtrerVotantsDuVillage(etat, ids = [], objet = "execution") {
  if (!villageActif(etat)) return ids;
  const regent = porteur(etat, "ecole");
  let admis = regent ? ids.filter(id => id !== regent) : ids;
  const r = normaliserVillage(etat.village).regent;
  if (objet === "execution" && r && r.tour === Number(etat?.tour)) admis = admis.filter(id => !r.ids.includes(id));
  if (objet === "bailli") {
    const metayers = new Set(metayersDe(etat));
    admis = admis.filter(id => metayers.has(id));
  }
  return admis;
}
// Les Métayers (tenanciers d'une métairie debout) : [acteurId]. villageois : pour ne garder que les vivants.
export function metayersDe(etat, villageois = null) {
  if (!villageActif(etat)) return [];
  const ids = [...new Set(METAIRIES.map(cle => occupant(etat, cle)).filter(Boolean))];
  return villageois ? ids.filter(id => vivant(villageois.find(v => v.id === id))) : ids;
}
// Le Cabaretier immunisé (vivant si villageois est donné) : son acteurId, ou "".
export const cabaretierImmunise = (etat, villageois = null) => porteur(etat, "cabaret", villageois);
// Les candidats d'un vote : sans le Cabaretier immunisé, à un vote d'exécution.
export const candidatsDuVillage = (etat, ids = [], objet = "execution") => {
  const c = objet === "execution" ? cabaretierImmunise(etat) : "";
  return c ? ids.filter(id => id !== c) : ids;
};
// Le Cabaretier perd-il son immunité à ce vote ? Il a voté contre un joueur que le vote a désigné (gracié ensuite ou non).
// resultat : un vote d'exécution clos (départage fait). -> son acteurId, ou ""
export function cabaretierQuiPerd(etat, resultat) {
  const c = cabaretierImmunise(etat);
  if (!c || !resultat || resultat.objet !== "execution" || resultat.departage?.enAttente) return "";
  const cible = resultat.votes?.[c];
  return cible && (resultat.elus ?? []).includes(cible) ? c : "";
}

// ------------------------------------------------------------------ le Hobereau
export const gracieParLeHobereau = (etat, acteurId, numero = null) => normaliserVillage(etat?.village).graces
  .some(g => g.acteurId === acteurId && (numero === null || g.numero === numero));
// La grâce du Hobereau (modifié sur place) : le gracié du vote n°, l'usage du manoir pris.
export function gracierParLeHobereau(etat, { acteurId, par, numero = Number(etat?.vote?.numero) || 0 }) {
  const v = normaliserVillage(etat.village);
  etat.village = { ...v, graces: [...v.graces, { acteurId: String(acteurId), tour: Number(etat.tour) || 0, numero }] };
  marquerEpuise(etat, "manoir", par);
  return etat;
}

// ------------------------------------------------------------------ candidats des pouvoirs de jour
// Les vivants, sans lui-même ; sansChemineaux : ni un Chemineau (le Régent, le Perruquier).
export const candidatsDuVillageois = (etat, villageois = [], acteurId = "", { sansChemineaux = false } = {}) => villageois
  .filter(v => vivant(v) && v.id !== acteurId && !(sansChemineaux && estChemineau(etat, v.id))).map(v => v.id);
// Le Remégeux : les vivants (pas lui) dont le pouvoir unique de bâtiment est servi (par eux).
export function candidatsDuRemegeux(etat, villageois = [], acteurId = "") {
  return villageois.filter(v => vivant(v) && v.id !== acteurId).filter(v => {
    const cle = batimentDe(etat, v.id);
    return cle && BATIMENTS_DU_VILLAGE[cle].pouvoir === "unique" && normaliserVillage(etat.village).epuises[cle] === v.id;
  }).map(v => v.id);
}
// L'Incendiaire : les vivants qui tiennent un bâtiment debout (le bâtiment se désigne par son occupant ; un Chemineau n'en a pas).
export const candidatsDeLIncendiaire = (etat, ids = []) => ids.filter(id => Boolean(batimentDe(etat, id)));

// ------------------------------------------------------------------ la nuit
// La Fournière entrouvre les yeux quand la meute se rendort : avec la chance donnée, un loup vivant au hasard (jamais elle-même),
// villageois du début de la nuit. -> [{ acteurId, loup }] (rien si elle ne voit rien)
export function apercusDeLaFourniere({ etat, villageois = [], hasard = Math.random, chance = CHANCE_FOURNIERE } = {}) {
  const f = porteur(etat, "fournil", villageois);
  if (!f) return [];
  const loups = villageois.filter(v => vivant(v) && v.camp === "meute" && v.id !== f).map(v => v.id);
  if (!loups.length || !(hasard() < chance)) return [];
  return [{ acteurId: f, loup: choisir(loups, hasard) }];
}
// Le Cabaretier immunisé, pour la nuit : [acteurId] (resolution.mjs, immunises).
export const immunisesDeLaNuit = (etat, villageois = null) => { const c = cabaretierImmunise(etat, villageois); return c ? [c] : []; };
