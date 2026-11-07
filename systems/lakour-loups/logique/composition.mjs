// Composition équilibrée et variée d'une partie, d'après l'équilibre fourni par le module de contenu
// (lakour-veillees : assets/equilibre.json, { roles: { cle: { camp, poids, niveau, joueursMin, unique, information?, protection? } },
// batiments: { cle: { niveau } }, cibles: { niveau: { n: cible } } }).
// Le champ « cibles » (Le Pacte, étape 6) : pour chaque niveau et chaque nombre de joueurs, la somme des poids qui donne une chance sur
// deux au village contre la meute, mesurée par simulation (essais/outils/calibrer-poids.mjs, docs/equilibre-veillees.md) ; cibleDe
// la lit (une taille absente : la plus proche ; un niveau sans cibles : 0, la petite tablée cibleTablee).
// Principe : on tire de nombreuses compositions possibles qui respectent les règles du niveau (nombre de loups, loups spéciaux,
// solitaires, au moins un rôle d'information), puis on garde l'une des meilleures selon trois critères :
//   - l'équilibre : somme des poids proche de la cible de la taille et du niveau (cibleDe : autant de chances pour chaque camp) ;
//   - la variété : les rôles et bâtiments des dernières parties sont pénalisés (historique), pour changer d'une partie à l'autre ;
//   - les souhaits : rôles à inclure absolument, rôles exclus.
// Pur et reproductible avec une graine.
// La peste noire (option peste, logique/peste.mjs) : aucun rôle de la meute (ni loup, ni rôle du camp de la meute) ; les
// places vont au village (et aux solitaires que le niveau permet), au moins un rôle d'information comme d'habitude.
// Les cartes qui vont ensemble (equilibre.roles[cle].groupe : les Lavandières par deux, les Bûcherons par trois, Le Pacte) : tirées
// toutes ou aucune, jamais au-delà des places ; un groupe demandé (inclure) entre en entier.
// Le Pacte, étape 3b : avec le Chapardeur (ambigus.mjs), le paquet comptera DEUX cartes Villageois de plus (n + 2 cartes), ajoutées
// à la distribution (api.distribuer, cartesAAjouter) ; les deux non distribuées resteront au centre. La composition, elle, garde ses
// n rôles (les outils qui la lisent, le MJ IA compris, comptent n places) et le signale : centre: 2. L'équilibre se compte sur ces n.
import { creerHasard, melanger } from "./hasard.mjs";
import { cartesAAjouter, CARTES_DU_CENTRE } from "./ambigus.mjs";
import { NIVEAU_PETITE_TABLEE, nombreDeLoupsTablee, ombresTablee } from "./tablee.mjs";

// Les niveaux : les trois classiques, « Le Pacte » (Le Pacte, étape 5 : seulement les rôles du jeu de soirée, ROLES_DU_LIVRE, au
// dosage du niveau classique ; le niveau proposé d'abord par la Table de jeu) et la « petite tablée » (tablee.mjs : peu d'humains, des
// compagnons IA), qui puise dans les rôles permis au niveau classique avec ses propres règles de dosage (tirerTablee). La petite
// tablée reste la dernière ; Le Pacte vient après le chaos (tous les rôles du livre, quel que soit leur niveau, y sont permis).
export const NIVEAU_LE_PACTE = "le-pacte";
export const NIVEAUX = ["debutants", "classique", "chaos", NIVEAU_LE_PACTE, NIVEAU_PETITE_TABLEE];
const RANGS = { debutants: 0, classique: 1, chaos: 2, [NIVEAU_LE_PACTE]: 2, [NIVEAU_PETITE_TABLEE]: 1 };
const rangNiveau = n => RANGS[n] ?? 0;

// Loups selon le nombre de joueurs (même barème que les compositions prêtes du contenu) et le niveau : Le Pacte, étape 6c (décidé avec
// Jordan), les DÉBUTANTS ont un loup de moins que le barème, jamais moins d'un (LOUPS_DE_MOINS) — à l'adresse d'une table de débutants
// (0,5), même le village le plus armé du niveau laissait la meute à 70 % (docs/equilibre-veillees.md). Sans niveau : le barème.
export const LOUPS_DE_MOINS = Object.freeze({ debutants: 1 });
export const nombreDeLoups = (n, niveau = "") => Math.max(1, (n <= 8 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5) - (LOUPS_DE_MOINS[niveau] ?? 0));
// Loups à pouvoir propre et solitaires permis selon le niveau.
const LOUPS_SPECIAUX = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2], [NIVEAU_LE_PACTE]: [0, 1] };
const SOLITAIRES = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2], [NIVEAU_LE_PACTE]: [0, 1] };
const nombreDeBatiments = n => (n < 10 ? 4 : n < 14 ? 5 : 6);
const BASE_LOUP = "loup-de-brumecombe", BASE_VILLAGE = "villageois";

// Rôles permis pour ce niveau et ce nombre de joueurs, rangés par famille.
// Petite tablée : les rôles du niveau classique, sans leur minimum de joueurs (une table de 5 peut avoir une Herboriste), sans
// le Loup déguisé (il rendrait aveugle la seule lanterne de la table), sans les tueurs solitaires (Pyromane, Dame du gué : trop
// pour une tablée de six), mais avec les solitaires qui ne tuent pas et dont la victoire ne tombe pas toute seule à si peu de
// votes (le Colporteur ; le Chasseur de primes gagnait une partie sur cinq, sa cible exécutée par le sort, et le Revenant une sur
// quatre, pendu par un village qui vote vite).
export const HORS_TABLEE = ["loup-deguise", "pyromane", "dame-du-gue"];
// Le Pacte, étape 3a : les rôles du Village du jeu de soirée ne sortent pas à la petite tablée, dont les dosages ont été mesurés sans
// eux. Étape 6 : ils y restent hors (ses compagnons IA jouent sans les politiques par rôle, que le simulateur mesure : à revoir quand
// le moteur les branchera). Aux niveaux classique et chaos (et Le Pacte), le générateur les tire, compositions prêtes comprises.
export const PACTE_HORS_TABLEE = ["franc-villageois", "aieul", "souffre-douleur", "innocent", "lavandiere", "bucheron", "furet", "gardeuse-d-oies",
  "greffier-begue", "vieux-sergent", "pie",
  // Le Pacte, étape 3b : les ambigus, les solitaires du livre et le Loup pâle, de même.
  "chapardeur", "bateleur", "matin", "enfant-des-bois", "chambriere", "feu-follet", "joueur-de-vielle", "illumine", "loup-pale",
  // Le Pacte, étape 9 : la Liseuse d'étoiles (le Spiritisme), de même.
  "liseuse-d-etoiles"];
export const SOLITAIRES_TABLEE = ["colporteur"];
export const HORS_TABLEE_BATIMENTS = ["gibet", "pont"];
// Le mode « Le Pacte » (étape 5) : les rôles du livre de règles du jeu de soirée, dans nos clés (docs/plan-le-pacte.md), jamais nos
// créations — les loups, les villageois, les ambigus et les solitaires du livre ; l'Incendiaire seulement avec la variante « Le
// Village » (equilibre.village), dont les personnalités ne sont pas des rôles. Ni nos bâtiments communaux (la Chapelle, le Gibet… :
// une composition « Le Pacte » n'en a aucun), ni nos métiers (nouvellePartie n'en distribue pas à ce niveau).
export const ROLES_DU_LIVRE = ["loup-de-brumecombe", "loup-affame", "louve-mere", "loup-pale",
  "villageois", "franc-villageois", "liseuse-de-cendres", "entremetteuse", "herboriste", "braconniere", "enfant-de-la-brume", "garde-du-pont",
  "aieul", "souffre-douleur", "innocent", "lavandiere", "bucheron", "furet", "gardeuse-d-oies", "greffier-begue", "vieux-sergent", "pie",
  "incendiaire", "chapardeur", "bateleur", "matin", "enfant-des-bois", "chambriere", "feu-follet", "joueur-de-vielle", "illumine", "liseuse-d-etoiles"];
export const estDuLivre = cle => ROLES_DU_LIVRE.includes(cle);
// Les rôles qu'un niveau met dans TOUTE composition tirée (générée, et donc prête : les compositions prêtes sont tirées par le
// générateur), comme la contrainte « au moins un rôle d'information » : au jeu de soirée de Jordan, la Voyante est toujours là, donc
// la Liseuse de cendres au niveau « Le Pacte », dès 6 joueurs (son minimum). Un rôle exclu (exclure) reste exclu ; une composition
// choisie à la main ou Double visage (son propre paquet) n'y passent pas.
export const ROLES_DU_NIVEAU = Object.freeze({ [NIVEAU_LE_PACTE]: Object.freeze(["liseuse-de-cendres"]) });
// Le Pacte, étape 4 : un rôle marqué village (equilibre.roles[cle].village, l'Incendiaire) ne sort que dans la variante « Le Village »
// (option village du générateur) : sans bâtiments tenus, il n'aurait rien à faire. Jamais à la petite tablée (composer n'y passe pas
// l'option), que la variante n'a pas.
function catalogue(equilibre, n, niveau, exclure, peste = false, village = false) {
  const tablee = niveau === NIVEAU_PETITE_TABLEE;
  const livre = niveau === NIVEAU_LE_PACTE;
  const permis = Object.entries(equilibre.roles ?? {}).filter(([cle, r]) =>
    !exclure.has(cle) && !(peste && r.camp === "meute") && !(r.village && !village) && (!livre || estDuLivre(cle))
    && (tablee ? (rangNiveau(r.niveau) <= rangNiveau(niveau) || SOLITAIRES_TABLEE.includes(cle)) && !HORS_TABLEE.includes(cle) && !PACTE_HORS_TABLEE.includes(cle)
      : rangNiveau(r.niveau) <= rangNiveau(niveau) && n >= (r.joueursMin ?? 0)));
  const famille = f => permis.filter(f).map(([cle]) => cle);
  return {
    permis: new Map(permis),
    loupsSpeciaux: famille(([cle, r]) => r.camp === "meute" && cle !== BASE_LOUP),
    solitaires: famille(([cle, r]) => r.camp === "solitaire" && (!tablee || SOLITAIRES_TABLEE.includes(cle))),
    // Un rôle « surDemande » (Somnambule, Rosière) ne sort jamais d'un tirage : seulement si on le demande (inclure, rôles choisis).
    pouvoirsVillage: famille(([cle, r]) => r.camp === "village" && cle !== BASE_VILLAGE && !r.surDemande),
    information: famille(([cle, r]) => r.camp === "village" && r.information),
    protection: famille(([, r]) => r.camp === "village" && r.protection)
  };
}

// Le libellé d'une composition pour la Table de veillée (etat.composition : sa clé) : { cle (du dictionnaire LAKOUR_LOUPS.Table.Composition),
// donnees } — jamais la clé brute (« generee », « le-pacte-08 ») : « composition générée », « Le Pacte — 8 joueurs ». Une clé inconnue (une
// composition d'un autre contenu) est lue en clair, sans ses tirets.
export const COMPOSITIONS_NOMMEES = ["generee", "choisie", "reprise", "double-visage", "saint-martin"];
export function libelleDeLaComposition(cle) {
  const c = String(cle ?? "").trim();
  if (!c) return null;
  if (COMPOSITIONS_NOMMEES.includes(c)) return { cle: c, donnees: null };
  const m = /^(.+)-(\d{1,2})$/.exec(c);
  if (m && NIVEAUX.includes(m[1])) return { cle: m[1] === NIVEAU_PETITE_TABLEE ? "preteTablee" : "prete", donnees: { niveau: m[1], n: Number(m[2]) } };
  return { cle: "autre", donnees: { nom: c.replace(/[-_]+/g, " ") } };
}

// Somme des poids d'une liste de rôles.
export const equilibreDe = (roles, equilibre) => roles.reduce((s, cle) => s + (equilibre.roles?.[cle]?.poids ?? 0), 0);

// Pénalité de répétition : un rôle de la dernière partie coûte plus qu'un rôle d'il y a cinq parties.
function penaliteHistorique(cles, historique, champ) {
  let p = 0;
  historique.slice(-5).reverse().forEach((partie, age) => {
    const passes = new Set(partie[champ] ?? []);
    for (const c of new Set(cles)) if (passes.has(c) && c !== BASE_LOUP && c !== BASE_VILLAGE) p += 1.5 / (age + 1);
  });
  return p;
}

// Le nombre de cartes d'un rôle : son groupe (Lavandières : 2, Bûcherons : 3), sinon une.
export const tailleDuGroupe = (cle, permis) => Math.max(1, Number(permis.get(cle)?.groupe) || 1);

// Prend jusqu'à « nombre » PLACES parmi ces rôles (mélangés), sans doublon, chaque groupe en entier et seulement s'il tient dans les
// places restantes (max : n).
function prendreDans(roles, cat, liste, nombre, hasard, max) {
  let reste = nombre;
  for (const cle of melanger(liste.filter(c => !roles.includes(c)), hasard)) {
    if (reste <= 0) break;
    const k = tailleDuGroupe(cle, cat.permis);
    if (k > reste || roles.length + k > max) continue;
    for (let i = 0; i < k; i++) roles.push(cle);
    reste -= k;
  }
}
// Les souhaits (rôles imposés) : un groupe entre en entier, une seule fois.
function inclureDans(roles, cat, inclure) {
  for (const cle of inclure) {
    if (!cat.permis.has(cle)) continue;
    const k = tailleDuGroupe(cle, cat.permis);
    if (k > 1) { if (!roles.includes(cle)) for (let i = 0; i < k; i++) roles.push(cle); continue; }
    if (!cat.permis.get(cle).unique || !roles.includes(cle)) roles.push(cle);
  }
}

// Une composition tirée au hasard qui respecte les règles du niveau (ou null si impossible).
function tirer(n, niveau, cat, inclure, hasard, peste = false, loupsEnPlus = 0) {
  const roles = [];
  const prendre = (liste, nombre) => prendreDans(roles, cat, liste, nombre, hasard, n);
  const entre = ([min, max]) => min + Math.floor(hasard() * (max - min + 1));
  // Souhaits d'abord (rôles imposés), dans la limite du nombre de joueurs.
  inclureDans(roles, cat, inclure);
  const loups = peste ? 0 : nombreDeLoups(n, niveau) + loupsEnPlus;
  const loupsDeja = roles.filter(c => cat.permis.get(c)?.camp === "meute").length;
  prendre(cat.loupsSpeciaux, Math.max(0, Math.min(entre(LOUPS_SPECIAUX[niveau]), loups - 1) - roles.filter(c => cat.loupsSpeciaux.includes(c)).length));
  // (Le loup de base exclu, ou une peste noire sans meute : pas de loup ajouté, plutôt qu'une boucle sans fin.)
  while (cat.permis.has(BASE_LOUP) && roles.filter(c => cat.permis.get(c)?.camp === "meute").length < Math.max(loups, loupsDeja)) roles.push(BASE_LOUP);
  if (n >= 8) prendre(cat.solitaires, Math.max(0, entre(SOLITAIRES[niveau]) - roles.filter(c => cat.solitaires.includes(c)).length));
  // Les rôles que le niveau met dans toute composition (Le Pacte : la Liseuse de cendres, comme la Voyante du jeu de soirée), s'ils
  // sont permis (ni exclus, ni hors de leur minimum de joueurs) et pas déjà là.
  inclureDans(roles, cat, (ROLES_DU_NIVEAU[niveau] ?? []).filter(c => !roles.includes(c) && roles.length < n));
  // Au moins un rôle d'information pour le village.
  if (!roles.some(c => cat.information.includes(c))) prendre(cat.information, 1);
  // Pouvoirs de village : de 0 à 100 % des places restantes, le reste en simples villageois (Le Pacte, étape 6 : de 15 à 70 %
  // avant ; les petites tables, où la meute pèse le plus, demandent un village plus armé, et les grandes tables de débutants un
  // village moins armé, que ces bornes ne le permettaient).
  const reste = n - roles.length;
  if (reste < 0) return null;
  // Nombre de pouvoirs tiré largement : quand le niveau en offre peu (débutants), en prendre moins équilibre mieux.
  prendre(cat.pouvoirsVillage, Math.round(reste * hasard()));
  while (roles.length < n) roles.push(BASE_VILLAGE);
  return roles.slice(0, n);
}

// Une petite tablée (tablee.mjs) : peu de loups (nombreDeLoupsTablee), au moins deux rôles de l'ombre dès 6 places (un solitaire
// qui ne tue pas complète la meute ; parfois un de plus dès 9), un loup à pouvoir au plus (une fois sur deux, dès 7 places), une
// lanterne (deux dès 8), une protection dès 6, et presque pas de simples villageois (un pour six places) : chacun a quelque chose
// à faire la nuit.
export const villageoisTablee = n => Math.min(1, Math.floor(n / 6));
function tirerTablee(n, cat, inclure, hasard, peste = false) {
  const roles = [];
  const prendre = (liste, nombre) => prendreDans(roles, cat, liste, nombre, hasard, n);
  const compte = liste => roles.filter(c => liste.includes(c)).length;
  inclureDans(roles, cat, inclure);
  const loups = peste ? 0 : nombreDeLoupsTablee(n);
  if (!peste) {
    if (n >= 7 && hasard() < 0.5) prendre(cat.loupsSpeciaux, Math.max(0, Math.min(1, loups - 1) - compte(cat.loupsSpeciaux)));
    while (cat.permis.has(BASE_LOUP) && roles.filter(c => cat.permis.get(c)?.camp === "meute").length < loups) roles.push(BASE_LOUP);
  }
  const solitaires = Math.max(0, ombresTablee(n) - loups) + (n >= 5 && hasard() < 0.35 ? 1 : 0);
  prendre(cat.solitaires, Math.max(0, solitaires - compte(cat.solitaires)));
  prendre(cat.information, Math.max(0, (n >= 8 ? 2 : 1) - compte(cat.information)));
  if (n >= 6) prendre(cat.protection, Math.max(0, 1 - compte(cat.protection)));
  const reste = n - roles.length;
  if (reste < 0) return null;
  prendre(cat.pouvoirsVillage, Math.max(0, reste - villageoisTablee(n)));
  while (roles.length < n) roles.push(BASE_VILLAGE);
  return roles.slice(0, n);
}
// La cible d'équilibre d'une petite tablée, sur l'échelle des poids du contenu : la meute y est courte mais va vite (deux votes
// manqués suffisent souvent), le village doit être bien armé. Réglée par les parties simulées (essais/integration-loups.test.mjs).
// Repli seulement (Le Pacte, étape 6) : un contenu qui donne ses cibles (equilibre.cibles, ci-dessous) les fait passer avant.
export const cibleTablee = n => (n <= 5 ? 6 : n === 6 ? 3 : n <= 8 ? 5 : n <= 10 ? 1 : 9);
// La cible d'équilibre d'une composition de n joueurs à ce niveau (Le Pacte, étape 6) : celle que donne le contenu
// (equilibre.cibles[niveau][n], mesurée par simulation : essais/outils/calibrer-poids.mjs, docs/equilibre-veillees.md), sinon la cible
// de la petite tablée (cibleTablee) à ce niveau, sinon 0. Une taille absente de la table prend la cible de la plus proche.
// variantes (variantes.mjs, choixDesVariantes) : chaque variante active ajoute son ajustement mesuré (equilibre.ajustements[cle], en
// poids : les Vendanges, la Chaîne des innocents ou l'Envoûtement déplacent l'équilibre ; la composition le compense).
export function cibleDe(n, niveau, equilibre, variantes = null) {
  const table = equilibre?.cibles?.[niveau];
  const tailles = table && typeof table === "object" ? Object.keys(table).map(Number).filter(Number.isFinite) : [];
  let cible = niveau === NIVEAU_PETITE_TABLEE ? cibleTablee(n) : 0;
  if (tailles.length) {
    const proche = tailles.reduce((m, t) => (Math.abs(t - n) < Math.abs(m - n) ? t : m), tailles[0]);
    cible = Number(table[proche]) || 0;
  }
  const ajustements = equilibre?.ajustements ?? {};
  for (const [cle, valeur] of Object.entries(variantes && typeof variantes === "object" ? variantes : {})) {
    if (valeur && Number.isFinite(Number(ajustements[cle]))) cible += Number(ajustements[cle]);
  }
  return cible;
}

// Les rôles d'une liste sans la meute (peste noire) : chaque rôle du camp de la meute devient un simple villageois.
export const sansMeute = (roles, equilibre) => roles.map(cle => (equilibre.roles?.[cle]?.camp === "meute" ? BASE_VILLAGE : cle));

// Point d'entrée. options : { niveau, inclure: [cle], exclure: [cle], historique: [{ roles, batiments }], cible (par défaut
// cibleDe(n, niveau, equilibre) : la cible du contenu pour cette taille et ce niveau), graine, essais = 1200,
// peste (true : composition de peste noire, sans meute ; l'équilibre ne compte plus, seule la variété), village (la variante « Le
// Village » : ses rôles, l'Incendiaire, peuvent sortir ; jamais à la petite tablée), loupsEnPlus (la variante « Les Vendanges »,
// variantes.mjs : des loups de plus que le barème ; jamais à la petite tablée), variantes (Le Pacte, étape 6 : les variantes de la veillée,
// { vendanges, chaine, envoutement… } : leur ajustement de cible, cibleDe) }
// Petite tablée (niveau NIVEAU_PETITE_TABLEE, tablee.mjs) : tirerTablee, à sa cible (cibleDe), 4 à 12 places.
export function composer(n, equilibre, { niveau = "classique", village = false, inclure = [], exclure = [], historique = [], cible, graine,
  essais = 1200, peste = false, loupsEnPlus = 0, variantes = null } = {}) {
  if (!Number.isInteger(n) || n < 4) throw new Error(`Il faut au moins 4 joueurs (${n}).`);
  if (!NIVEAUX.includes(niveau)) throw new Error(`Niveau inconnu : ${niveau}.`);
  const tablee = niveau === NIVEAU_PETITE_TABLEE;
  if (tablee && n > 12) throw new Error(`Une petite tablée compte 12 places au plus (${n}).`);
  cible = cible === undefined || cible === null || !Number.isFinite(Number(cible)) ? cibleDe(n, niveau, equilibre, tablee ? null : variantes) : Number(cible);
  const hasard = creerHasard(graine);
  const cat = catalogue(equilibre, n, niveau, new Set(exclure), peste, village && !tablee);
  const inconnus = inclure.filter(c => !equilibre.roles?.[c]);
  if (inconnus.length) throw new Error(`Rôles inconnus : ${inconnus.join(", ")}.`);
  const candidats = [];
  for (let i = 0; i < essais; i++) {
    const voulus = peste ? sansMeute(inclure, equilibre).filter(c => c !== BASE_VILLAGE) : inclure;
    const roles = tablee ? tirerTablee(n, cat, voulus, hasard, peste) : tirer(n, niveau, cat, voulus, hasard, peste, Math.max(0, Number(loupsEnPlus) || 0));
    if (!roles) continue;
    const somme = equilibreDe(roles, equilibre);
    const score = (peste ? 0 : Math.abs(somme - cible) * 2) + penaliteHistorique(roles, historique, "roles") + hasard() * 0.5;
    candidats.push({ roles, somme, score });
  }
  if (!candidats.length) throw new Error(`Aucune composition possible pour ${n} joueurs avec ces contraintes.`);
  candidats.sort((a, b) => a.score - b.score);
  // Au hasard parmi celles qui valent presque la meilleure (pas une de plus loin) : deux parties de suite ne se ressemblent
  // pas, sans sacrifier l'équilibre (un point d'écart de plus que la meilleure, mais jamais au-delà de ±2 quand elle y est).
  const ecart = Math.abs(candidats[0].somme - cible);
  const tolere = Math.max(ecart, Math.min(ecart + 1, 2));
  const proches = candidats.filter(c => c.score <= candidats[0].score + 1 && (peste || Math.abs(c.somme - cible) <= tolere));
  const choix = proches[Math.floor(hasard() * Math.min(8, proches.length))];
  // Bâtiments du niveau, les moins joués récemment d'abord.
  // Petite tablée : ni Gibet (il bloque trop de votes à six) ni Pont (une seule rive, à si peu de maisons). Le Pacte : aucun (le jeu de
  // soirée n'a pas nos bâtiments communaux).
  const batimentsPermis = niveau === NIVEAU_LE_PACTE ? []
    : Object.entries(equilibre.batiments ?? {}).filter(([cle, b]) => rangNiveau(b.niveau) <= rangNiveau(niveau) && !(tablee && HORS_TABLEE_BATIMENTS.includes(cle))).map(([cle]) => cle);
  const batiments = melanger(batimentsPermis, hasard)
    .map(cle => ({ cle, p: penaliteHistorique([cle], historique, "batiments") + hasard() * 0.3 }))
    .sort((a, b) => a.p - b.p).slice(0, nombreDeBatiments(n)).map(b => b.cle);
  const compte = c => choix.roles.filter(r => equilibre.roles[r]?.camp === c).length;
  // Le Chapardeur : deux cartes Villageois de plus au paquet (le centre), ajoutées à la distribution.
  const centre = cartesAAjouter(choix.roles, n);
  return {
    roles: melanger(choix.roles, hasard), batiments, somme: choix.somme, niveau, ...(centre.length ? { centre: CARTES_DU_CENTRE } : {}),
    camps: { meute: compte("meute"), village: compte("village"), solitaire: compte("solitaire") },
    verdict: peste ? "peste noire" : Math.abs(choix.somme - cible) <= 2 ? "équilibrée" : choix.somme > cible ? "favorable au village" : "favorable à la meute",
    ...(peste ? { peste: true } : {})
  };
}
