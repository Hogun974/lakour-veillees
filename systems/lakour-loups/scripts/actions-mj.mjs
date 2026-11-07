// Les actions du MJ HUMAIN, telles que les font les boutons de la Table de jeu, sans narrateur IA : préparer et
// distribuer, mener la nuit rôle par rôle, résoudre l'aube, ouvrir le débat, élire le Bailli, ouvrir le vote, exécuter, emporter,
// vérifier la victoire, rejouer. La mise en scène (jetons, lumière, statuts, ambiances) suit d'elle-même chaque changement : elle est
// branchée sur les hooks du système, pas sur le MJ IA. Ici, pas de boîte de dialogue : la Table les pose avant d'appeler.
import { t, tousLesVillageois, lireEtat } from "./donnees.mjs";
import { REGLAGES_DES_VARIANTES, CLES_DES_VARIANTES, choixDesVariantes } from "../logique/variantes.mjs";

const api = () => game.lakourLoups;

// ------------------------------------------------------------------ préparation (état local de la Table du MJ)
// { coches: [userId] | null (null : tous les joueurs connectés), mode: "auto" | "manuel", niveau, roles: { cle: n },
//   peste: partie de peste noire choisie par le MJ (sinon, une partie générée le devient rarement d'elle-même),
//   format: "" ou "saint-martin" (la Nuit de la Saint-Martin : sa propre composition, ni peste ni rôles choisis),
//   fete: null (pas encore choisie : la Table pré-sélectionne la veillée proposée, veilleeProposee) | "" (aucune) | clé de veillée,
//   village: la variante « Le Village » (Pacte, étape 4 ; pré-cochée si le réglage « leVillage » s'en souvient),
//   variantes: { chandelles?, angoissante?, chaine?, mur?, doubleVisage?, vendanges?, envoutement? } (Pacte, étape 5 : les variantes du jeu de
//   soirée ; une case non touchée suit son réglage monde, qui se souvient du dernier choix),
//   gazette: { actif?, crieur?, permanentes? } (Pacte, étape 9 : la Gazette de la lune, le Crieur public, les cartes permanentes posées dès
//   le début ; une case non touchée suit son réglage) }
// Le niveau pré-sélectionné : la Petite tablée si le réglage monde s'en souvient (0.11.0), sinon « Le Pacte » (étape 5 : les rôles du
// jeu de soirée, le niveau proposé d'abord).
const niveauParDefaut = () => { try { return game.settings.get("lakour-loups", "petiteTablee") ? "petite-tablee" : "le-pacte"; } catch { return "le-pacte"; } };
const villageParDefaut = () => { try { return Boolean(game.settings.get("lakour-loups", "leVillage")); } catch { return false; } };
export const nouvellePreparation = () => ({ coches: null, mode: "auto", niveau: niveauParDefaut(), roles: {}, peste: false, format: "", fete: null });
// La case « Le Village » : celle que le MJ a cochée, sinon le réglage (village absent de la préparation neuve : il suit le réglage).
export const villagePrepare = prep => (typeof prep.village === "boolean" ? prep.village : villageParDefaut());
// Les variantes cochées : celles que le MJ a touchées, sinon leurs réglages.
const lireVariante = c => { try { return game.settings.get("lakour-loups", REGLAGES_DES_VARIANTES[c]); } catch { return c === "doubleVisage" ? "" : false; } };
// Les bâtiments du village et les métiers (étape 5) : ceux que le MJ a choisis, sinon les réglages.
const lireMonde = (cle, defaut) => { try { return game.settings.get("lakour-loups", cle) ?? defaut; } catch { return defaut; } };
export const batimentsPrepares = prep => (["hasard", "aucun", "choisis"].includes(prep.batiments) ? prep.batiments : lireMonde("batimentsDuVillage", "hasard"));
export const batimentsChoisisPrepares = prep => (Array.isArray(prep.batimentsChoisis) ? prep.batimentsChoisis : [...(lireMonde("batimentsChoisis", []) ?? [])]);
export const metiersPrepares = prep => (typeof prep.metiers === "boolean" ? prep.metiers : lireMonde("metiersEnJeu", true) !== false);
export function basculerBatiment(prep, cle) {
  const liste = new Set(batimentsChoisisPrepares(prep));
  if (liste.has(cle)) liste.delete(cle); else liste.add(cle);
  prep.batimentsChoisis = [...liste];
  return prep;
}
// La Gazette de la lune et le Crieur public (étape 9) : les cases du MJ, sinon les réglages.
export const gazettePreparee = prep => ({ actif: lireMonde("gazette", false) === true, crieur: lireMonde("crieurPublic", false) === true,
  permanentes: [...(lireMonde("gazettePermanentes", []) ?? [])], ...(prep.gazette ?? {}) });
export function changerGazette(prep, cle, valeur) {
  prep.gazette = { ...(prep.gazette ?? {}), [cle]: valeur };
  return prep;
}
export function basculerPermanente(prep, cle) {
  const liste = new Set(gazettePreparee(prep).permanentes);
  if (liste.has(cle)) liste.delete(cle); else liste.add(cle);
  return changerGazette(prep, "permanentes", [...liste]);
}
export const variantesPreparees = prep => choixDesVariantes({ ...Object.fromEntries(CLES_DES_VARIANTES.map(c => [c, lireVariante(c)])), ...(prep.variantes ?? {}) });
export function changerVariante(prep, cle, valeur) {
  if (!CLES_DES_VARIANTES.includes(cle)) return prep;
  prep.variantes = { ...(prep.variantes ?? {}), [cle]: valeur };
  return prep;
}

// La veillée de fête que la Table propose au MJ (pré-sélectionnée, jamais imposée) : celle du réglage s'il en nomme une, sinon
// celle de la fête du calendrier du moteur ce jour-là ("" : aucune).
export const veilleeProposee = () => api()?.veilleesDeFete?.()?.proposee ?? "";

export const joueursConnectes = () => game.users.filter(u => !u.isGM && u.active);
export const compagnonsDuVillage = () => tousLesVillageois().filter(a => a.system.compagnon && !a.system.joueur);
export const iaDisponible = () => Boolean(api()?.compagnons?.disponible);

export function joueursCoches(prep) {
  const connectes = joueursConnectes().map(u => u.id);
  return prep.coches === null ? connectes : prep.coches.filter(id => game.users.get(id));
}

export function cocher(prep, userId) {
  const liste = new Set(joueursCoches(prep));
  if (liste.has(userId)) liste.delete(userId);
  else liste.add(userId);
  prep.coches = [...liste];
  return prep;
}

// La liste des rôles choisis à la main, complétée de villageois jusqu'au nombre de places.
export function rolesManuels(prep, total) {
  const roles = Object.entries(prep.roles).flatMap(([cle, n]) => Array.from({ length: Math.max(0, n) }, () => cle));
  while (roles.length < total) roles.push("villageois");
  return roles;
}

export function changerRole(prep, cle, delta) {
  prep.roles[cle] = Math.max(0, (prep.roles[cle] ?? 0) + Number(delta || 0));
  if (!prep.roles[cle]) delete prep.roles[cle];
  return prep;
}

// L'équilibre d'une liste de rôles (poids du contenu) : { somme, verdict: "equilibree" | "village" | "meute", loups, loupsConseilles }.
// niveau : celui de la préparation (les débutants ont un loup de moins : nombreDeLoups, Le Pacte, étape 6c).
export function equilibreDesRoles(roles, equilibre, niveau = "") {
  const L = api().logique;
  const somme = L.equilibreDe(roles, equilibre);
  const loups = roles.filter(c => equilibre.roles?.[c]?.camp === "meute").length;
  return { somme, verdict: Math.abs(somme) <= 2 ? "equilibree" : somme > 0 ? "village" : "meute", loups, loupsConseilles: roles.length >= 4 ? L.nombreDeLoups(roles.length, niveau) : 0 };
}

// Ajouter ou retirer un joueur IA (par le point d'enregistrement du MJ IA).
export async function ajouterIA(n = 1) {
  const point = api()?.compagnons;
  if (!point?.disponible) throw new Error(t("LAKOUR_LOUPS.Preparation.IAIndisponible"));
  return point.creer(n);
}
export async function retirerIA() {
  const dernier = compagnonsDuVillage().at(-1);
  if (!dernier) return false;
  const point = api()?.compagnons;
  if (typeof point?.retirer === "function") await point.retirer(dernier.id);
  if (game.actors.get(dernier.id)) await dernier.delete();
  return true;
}

// « Distribuer » : les joueurs cochés et les compagnons IA du village, composition équilibrée (auto) ou choisie.
export async function distribuer(prep) {
  const joueurs = joueursCoches(prep);
  const compagnons = compagnonsDuVillage().map(a => a.id);
  const total = joueurs.length + compagnons.length;
  if (prep.format === "saint-martin") return api().nouvellePartie({ memesJoueurs: false, joueurs, compagnons, niveau: prep.niveau, format: "saint-martin" });
  return api().nouvellePartie({ memesJoueurs: false, joueurs, compagnons, niveau: prep.niveau, format: "",
    roles: prep.mode === "manuel" ? rolesManuels(prep, total) : [], ...(prep.peste ? { peste: true } : {}),
    ...(prep.niveau === "petite-tablee" ? {} : { village: villagePrepare(prep) }),
    variantes: variantesPreparees(prep),
    ...(prep.niveau === "petite-tablee" ? {} : { gazette: gazettePreparee(prep) }),
    batiments: batimentsPrepares(prep) === "choisis" ? batimentsChoisisPrepares(prep) : batimentsPrepares(prep), metiers: metiersPrepares(prep),
    fete: prep.fete ?? veilleeProposee() });
}

// ------------------------------------------------------------------ la partie, étape par étape
export async function phase(p) { return api().changerPhase(p); }

// Réveille tous les rôles qui restent, dans l'ordre de la nuit. La peste sans porteur (peste noire, première nuit) :
// choisirPeste() rend la victime choisie par le MJ ("" : au hasard ; null : il s'arrête là) ; sans lui, le hasard.
export async function reveillerTout({ choisirPeste = null, ...options } = {}) {
  const faits = [];
  for (let i = 0; i < 40; i++) {
    const e = api().etapeSuivante();
    if (e.cle !== "reveiller") break;
    let extra = {};
    if (e.donnees.peste && !e.donnees.qui && typeof choisirPeste === "function") {
      const cible = await choisirPeste();
      if (cible === null) break;
      extra = { cible };
    }
    faits.push(await api().reveiller(e.donnees.role, { ...options, ...extra }));
  }
  return faits;
}

// L'aube : la nuit est résolue (messages remis aux carnets secrets), puis la victoire est vérifiée.
export async function aube() {
  if (lireEtat().phase === "nuit") await api().changerPhase("aube");
  const r = await api().resoudreNuit({ chuchoter: true });
  await api().verifierVictoire();
  return r;
}

export async function executer(acteurId) {
  const morts = await api().eliminer(acteurId, { cause: "vote" });
  await api().verifierVictoire();
  return morts;
}

export async function emporter(acteurId) {
  const morts = await api().eliminer(acteurId, { cause: "emporte" });
  await api().verifierVictoire();
  return morts;
}

// Fait l'étape proposée (logique/etapes.mjs). choix : { cible } pour « emporter » (qui est emporté).
export async function faireEtape(etape, { cible = "", delai } = {}) {
  switch (etape.action) {
    case "distribuer": return api().nouvellePartie({ memesJoueurs: tousLesVillageois().length > 0 });
    case "phase": return phase(etape.donnees.phase);
    case "reveiller": return api().reveiller(etape.donnees.role, { delai });
    case "aube": return aube();
    case "ouvrirVote": return api().ouvrirVote({});
    case "cloreVote": return api().cloreVote();
    case "executer": return executer(etape.donnees.id);
    case "emporter": return cible ? emporter(cible) : null;
    case "victoire": return api().verifierVictoire();
    case "voteChapelle": return api().ouvrirVote({ objet: "chapelle" });
    case "voteBailli": return api().ouvrirVote({ objet: "bailli" });
    case "rejouer": return api().nouvellePartie({ memesJoueurs: true });
    default: return null;
  }
}
