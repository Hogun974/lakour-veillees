// Composition équilibrée et variée d'une partie, d'après l'équilibre fourni par le module de contenu
// (lakour-veillees : assets/equilibre.json, { roles: { cle: { camp, poids, niveau, joueursMin, unique, information?, protection? } },
// batiments: { cle: { niveau } } }).
// Principe : on tire de nombreuses compositions possibles qui respectent les règles du niveau (nombre de loups, loups spéciaux,
// solitaires, au moins un rôle d'information), puis on garde l'une des meilleures selon trois critères :
//   - l'équilibre : somme des poids proche de la cible (0 = autant de chances pour chaque camp) ;
//   - la variété : les rôles et bâtiments des dernières parties sont pénalisés (historique), pour changer d'une partie à l'autre ;
//   - les souhaits : rôles à inclure absolument, rôles exclus.
// Pur et reproductible avec une graine.
// La peste noire (option peste, logique/peste.mjs) : aucun rôle de la meute (ni loup, ni rôle du camp de la meute) ; les
// places vont au village (et aux solitaires que le niveau permet), au moins un rôle d'information comme d'habitude.
import { creerHasard, melanger } from "./hasard.mjs";
import { NIVEAU_PETITE_TABLEE, nombreDeLoupsTablee, ombresTablee } from "./tablee.mjs";

// Les niveaux : les trois classiques, et la « petite tablée » (tablee.mjs : peu d'humains, des compagnons IA), qui puise dans les
// rôles permis au niveau classique avec ses propres règles de dosage (tirerTablee).
export const NIVEAUX = ["debutants", "classique", "chaos", NIVEAU_PETITE_TABLEE];
const RANGS = { debutants: 0, classique: 1, chaos: 2, [NIVEAU_PETITE_TABLEE]: 1 };
const rangNiveau = n => RANGS[n] ?? 0;

// Loups selon le nombre de joueurs (même barème que les compositions prêtes du contenu).
export const nombreDeLoups = n => (n <= 8 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5);
// Loups à pouvoir propre et solitaires permis selon le niveau.
const LOUPS_SPECIAUX = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2] };
const SOLITAIRES = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2] };
const nombreDeBatiments = n => (n < 10 ? 4 : n < 14 ? 5 : 6);
const BASE_LOUP = "loup-de-brumecombe", BASE_VILLAGE = "villageois";

// Rôles permis pour ce niveau et ce nombre de joueurs, rangés par famille.
// Petite tablée : les rôles du niveau classique, sans leur minimum de joueurs (une table de 5 peut avoir une Herboriste), sans
// le Loup déguisé (il rendrait aveugle la seule lanterne de la table), sans les tueurs solitaires (Pyromane, Dame du gué : trop
// pour une tablée de six), mais avec les solitaires qui ne tuent pas et dont la victoire ne tombe pas toute seule à si peu de
// votes (le Colporteur ; le Chasseur de primes gagnait une partie sur cinq, sa cible exécutée par le sort, et le Revenant une sur
// quatre, pendu par un village qui vote vite).
export const HORS_TABLEE = ["loup-deguise", "pyromane", "dame-du-gue"];
export const SOLITAIRES_TABLEE = ["colporteur"];
export const HORS_TABLEE_BATIMENTS = ["gibet", "pont"];
function catalogue(equilibre, n, niveau, exclure, peste = false) {
  const tablee = niveau === NIVEAU_PETITE_TABLEE;
  const permis = Object.entries(equilibre.roles ?? {}).filter(([cle, r]) =>
    !exclure.has(cle) && !(peste && r.camp === "meute")
    && (tablee ? (rangNiveau(r.niveau) <= rangNiveau(niveau) || SOLITAIRES_TABLEE.includes(cle)) && !HORS_TABLEE.includes(cle)
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

// Une composition tirée au hasard qui respecte les règles du niveau (ou null si impossible).
function tirer(n, niveau, cat, inclure, hasard, peste = false) {
  const roles = [];
  const prendre = (liste, nombre) => {
    const libres = melanger(liste.filter(c => !roles.includes(c)), hasard);
    roles.push(...libres.slice(0, nombre));
  };
  const entre = ([min, max]) => min + Math.floor(hasard() * (max - min + 1));
  // Souhaits d'abord (rôles imposés), dans la limite du nombre de joueurs.
  for (const cle of inclure) if (cat.permis.has(cle) && (!cat.permis.get(cle).unique || !roles.includes(cle))) roles.push(cle);
  const loups = peste ? 0 : nombreDeLoups(n);
  const loupsDeja = roles.filter(c => cat.permis.get(c)?.camp === "meute").length;
  prendre(cat.loupsSpeciaux, Math.max(0, Math.min(entre(LOUPS_SPECIAUX[niveau]), loups - 1) - roles.filter(c => cat.loupsSpeciaux.includes(c)).length));
  // (Le loup de base exclu, ou une peste noire sans meute : pas de loup ajouté, plutôt qu'une boucle sans fin.)
  while (cat.permis.has(BASE_LOUP) && roles.filter(c => cat.permis.get(c)?.camp === "meute").length < Math.max(loups, loupsDeja)) roles.push(BASE_LOUP);
  if (n >= 8) prendre(cat.solitaires, Math.max(0, entre(SOLITAIRES[niveau]) - roles.filter(c => cat.solitaires.includes(c)).length));
  // Au moins un rôle d'information pour le village.
  if (!roles.some(c => cat.information.includes(c))) prendre(cat.information, 1);
  // Pouvoirs de village : de 15 à 70 % des places restantes, le reste en simples villageois.
  const reste = n - roles.length;
  if (reste < 0) return null;
  // Nombre de pouvoirs tiré largement : quand le niveau en offre peu (débutants), en prendre moins équilibre mieux.
  prendre(cat.pouvoirsVillage, Math.round(reste * (0.15 + hasard() * 0.55)));
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
  const prendre = (liste, nombre) => {
    const libres = melanger(liste.filter(c => !roles.includes(c)), hasard);
    roles.push(...libres.slice(0, nombre));
  };
  const compte = liste => roles.filter(c => liste.includes(c)).length;
  for (const cle of inclure) if (cat.permis.has(cle) && (!cat.permis.get(cle).unique || !roles.includes(cle))) roles.push(cle);
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
export const cibleTablee = n => (n <= 5 ? 6 : n === 6 ? 3 : n <= 8 ? 5 : n <= 10 ? 1 : 9);

// Les rôles d'une liste sans la meute (peste noire) : chaque rôle du camp de la meute devient un simple villageois.
export const sansMeute = (roles, equilibre) => roles.map(cle => (equilibre.roles?.[cle]?.camp === "meute" ? BASE_VILLAGE : cle));

// Point d'entrée. options : { niveau, inclure: [cle], exclure: [cle], historique: [{ roles, batiments }], cible = 0, graine, essais = 400,
// peste (true : composition de peste noire, sans meute ; l'équilibre ne compte plus, seule la variété) }
// Petite tablée (niveau NIVEAU_PETITE_TABLEE, tablee.mjs) : tirerTablee, cible cibleTablee(n) sauf cible donnée, 4 à 12 places.
export function composer(n, equilibre, { niveau = "classique", inclure = [], exclure = [], historique = [], cible = 0, graine, essais = 1200, peste = false } = {}) {
  if (!Number.isInteger(n) || n < 4) throw new Error(`Il faut au moins 4 joueurs (${n}).`);
  if (!NIVEAUX.includes(niveau)) throw new Error(`Niveau inconnu : ${niveau}.`);
  const tablee = niveau === NIVEAU_PETITE_TABLEE;
  if (tablee && n > 12) throw new Error(`Une petite tablée compte 12 places au plus (${n}).`);
  if (tablee && cible === 0) cible = cibleTablee(n);
  const hasard = creerHasard(graine);
  const cat = catalogue(equilibre, n, niveau, new Set(exclure), peste);
  const inconnus = inclure.filter(c => !equilibre.roles?.[c]);
  if (inconnus.length) throw new Error(`Rôles inconnus : ${inconnus.join(", ")}.`);
  const candidats = [];
  for (let i = 0; i < essais; i++) {
    const voulus = peste ? sansMeute(inclure, equilibre).filter(c => c !== BASE_VILLAGE) : inclure;
    const roles = tablee ? tirerTablee(n, cat, voulus, hasard, peste) : tirer(n, niveau, cat, voulus, hasard, peste);
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
  // Petite tablée : ni Gibet (il bloque trop de votes à six) ni Pont (une seule rive, à si peu de maisons).
  const batimentsPermis = Object.entries(equilibre.batiments ?? {}).filter(([cle, b]) => rangNiveau(b.niveau) <= rangNiveau(niveau) && !(tablee && HORS_TABLEE_BATIMENTS.includes(cle))).map(([cle]) => cle);
  const batiments = melanger(batimentsPermis, hasard)
    .map(cle => ({ cle, p: penaliteHistorique([cle], historique, "batiments") + hasard() * 0.3 }))
    .sort((a, b) => a.p - b.p).slice(0, nombreDeBatiments(n)).map(b => b.cle);
  const compte = c => choix.roles.filter(r => equilibre.roles[r]?.camp === c).length;
  return {
    roles: melanger(choix.roles, hasard), batiments, somme: choix.somme, niveau,
    camps: { meute: compte("meute"), village: compte("village"), solitaire: compte("solitaire") },
    verdict: peste ? "peste noire" : Math.abs(choix.somme - cible) <= 2 ? "équilibrée" : choix.somme > cible ? "favorable au village" : "favorable à la meute",
    ...(peste ? { peste: true } : {})
  };
}
