// Composition équilibrée et variée d'une partie, d'après l'équilibre fourni par le module de contenu
// (lakour-veillees : assets/equilibre.json, { roles: { cle: { camp, poids, niveau, joueursMin, unique, information?, protection? } },
// batiments: { cle: { niveau } } }).
// Principe : on tire de nombreuses compositions possibles qui respectent les règles du niveau (nombre de loups, loups spéciaux,
// solitaires, au moins un rôle d'information), puis on garde l'une des meilleures selon trois critères :
//   - l'équilibre : somme des poids proche de la cible (0 = autant de chances pour chaque camp) ;
//   - la variété : les rôles et bâtiments des dernières parties sont pénalisés (historique), pour changer d'une partie à l'autre ;
//   - les souhaits : rôles à inclure absolument, rôles exclus.
// Pur et reproductible avec une graine.
import { creerHasard, melanger } from "./hasard.mjs";

export const NIVEAUX = ["debutants", "classique", "chaos"];
const rangNiveau = n => Math.max(0, NIVEAUX.indexOf(n));

// Loups selon le nombre de joueurs (même barème que les compositions prêtes du contenu).
export const nombreDeLoups = n => (n <= 8 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5);
// Loups à pouvoir propre et solitaires permis selon le niveau.
const LOUPS_SPECIAUX = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2] };
const SOLITAIRES = { debutants: [0, 0], classique: [0, 1], chaos: [1, 2] };
const nombreDeBatiments = n => (n < 10 ? 4 : n < 14 ? 5 : 6);
const BASE_LOUP = "loup-de-brumecombe", BASE_VILLAGE = "villageois";

// Rôles permis pour ce niveau et ce nombre de joueurs, rangés par famille.
function catalogue(equilibre, n, niveau, exclure) {
  const permis = Object.entries(equilibre.roles ?? {}).filter(([cle, r]) =>
    !exclure.has(cle) && rangNiveau(r.niveau) <= rangNiveau(niveau) && n >= (r.joueursMin ?? 0));
  const famille = f => permis.filter(f).map(([cle]) => cle);
  return {
    permis: new Map(permis),
    loupsSpeciaux: famille(([cle, r]) => r.camp === "meute" && cle !== BASE_LOUP),
    solitaires: famille(([, r]) => r.camp === "solitaire"),
    pouvoirsVillage: famille(([cle, r]) => r.camp === "village" && cle !== BASE_VILLAGE),
    information: famille(([cle, r]) => r.camp === "village" && r.information)
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
function tirer(n, niveau, cat, inclure, hasard) {
  const roles = [];
  const prendre = (liste, nombre) => {
    const libres = melanger(liste.filter(c => !roles.includes(c)), hasard);
    roles.push(...libres.slice(0, nombre));
  };
  const entre = ([min, max]) => min + Math.floor(hasard() * (max - min + 1));
  // Souhaits d'abord (rôles imposés), dans la limite du nombre de joueurs.
  for (const cle of inclure) if (cat.permis.has(cle) && (!cat.permis.get(cle).unique || !roles.includes(cle))) roles.push(cle);
  const loups = nombreDeLoups(n);
  const loupsDeja = roles.filter(c => cat.permis.get(c)?.camp === "meute").length;
  prendre(cat.loupsSpeciaux, Math.max(0, Math.min(entre(LOUPS_SPECIAUX[niveau]), loups - 1) - roles.filter(c => cat.loupsSpeciaux.includes(c)).length));
  while (roles.filter(c => cat.permis.get(c)?.camp === "meute").length < Math.max(loups, loupsDeja)) roles.push(BASE_LOUP);
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

// Point d'entrée. options : { niveau, inclure: [cle], exclure: [cle], historique: [{ roles, batiments }], cible = 0, graine, essais = 400 }
export function composer(n, equilibre, { niveau = "classique", inclure = [], exclure = [], historique = [], cible = 0, graine, essais = 1200 } = {}) {
  if (!Number.isInteger(n) || n < 4) throw new Error(`Il faut au moins 4 joueurs (${n}).`);
  if (!NIVEAUX.includes(niveau)) throw new Error(`Niveau inconnu : ${niveau}.`);
  const hasard = creerHasard(graine);
  const cat = catalogue(equilibre, n, niveau, new Set(exclure));
  const inconnus = inclure.filter(c => !equilibre.roles?.[c]);
  if (inconnus.length) throw new Error(`Rôles inconnus : ${inconnus.join(", ")}.`);
  const candidats = [];
  for (let i = 0; i < essais; i++) {
    const roles = tirer(n, niveau, cat, inclure, hasard);
    if (!roles) continue;
    const somme = equilibreDe(roles, equilibre);
    const score = Math.abs(somme - cible) * 2 + penaliteHistorique(roles, historique, "roles") + hasard() * 0.5;
    candidats.push({ roles, somme, score });
  }
  if (!candidats.length) throw new Error(`Aucune composition possible pour ${n} joueurs avec ces contraintes.`);
  candidats.sort((a, b) => a.score - b.score);
  // Au hasard parmi celles qui valent presque la meilleure (pas une de plus loin) : deux parties de suite ne se ressemblent
  // pas, sans sacrifier l'équilibre.
  const proches = candidats.filter(c => c.score <= candidats[0].score + 1 && Math.abs(c.somme - cible) <= Math.abs(candidats[0].somme - cible) + 1);
  const choix = proches[Math.floor(hasard() * Math.min(8, proches.length))];
  // Bâtiments du niveau, les moins joués récemment d'abord.
  const batimentsPermis = Object.entries(equilibre.batiments ?? {}).filter(([, b]) => rangNiveau(b.niveau) <= rangNiveau(niveau)).map(([cle]) => cle);
  const batiments = melanger(batimentsPermis, hasard)
    .map(cle => ({ cle, p: penaliteHistorique([cle], historique, "batiments") + hasard() * 0.3 }))
    .sort((a, b) => a.p - b.p).slice(0, nombreDeBatiments(n)).map(b => b.cle);
  const compte = c => choix.roles.filter(r => equilibre.roles[r]?.camp === c).length;
  return {
    roles: melanger(choix.roles, hasard), batiments, somme: choix.somme, niveau,
    camps: { meute: compte("meute"), village: compte("village"), solitaire: compte("solitaire") },
    verdict: Math.abs(choix.somme - cible) <= 2 ? "équilibrée" : choix.somme > cible ? "favorable au village" : "favorable à la meute"
  };
}
