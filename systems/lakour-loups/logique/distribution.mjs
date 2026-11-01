// Distribution aléatoire des rôles, métiers et maisons. Logique pure.
//
// distribuer({ roles, metiers, joueurs, maisons, graine })
//   -> [{ joueur, role, metier, maison }] dans l'ordre des joueurs.
// - les rôles sont mélangés ; s'il y en a plus que de joueurs, on en tire autant que de joueurs ; s'il en manque,
//   les derniers joueurs reçoivent `null` (Foundry leur donne alors un simple villageois) ;
// - les métiers sont mélangés de même (null s'il en manque) ;
// - les maisons sont mélangées ("" s'il en manque) ;
// - même graine -> même distribution.

import { creerHasard, melanger, choisir } from "./hasard.mjs";
import { victoireCleDe } from "./victoire.mjs";

export function distribuer({ roles = [], metiers = [], joueurs = [], maisons = [], graine, hasard } = {}) {
  const h = hasard ?? creerHasard(graine);
  const r = melanger(roles, h);
  const m = melanger(metiers, h);
  const s = melanger(maisons, h);
  return joueurs.map((joueur, i) => ({ joueur, role: r[i] ?? null, metier: m[i] ?? null, maison: s[i] ?? "" }));
}

// Les maisons d'un village de n joueurs, réparties sur les deux rives de la carte : les maisons 1 à 12 sont du côté de la
// place, les maisons 13 à 18 sur l'autre rive (au-delà du Pont). Environ un tiers des joueurs dort sur l'autre rive,
// pour que le Pont compte quelle que soit la taille du village : 6 joueurs -> 1 à 4, 13 et 14 ; 18 joueurs -> 1 à 18.
export function maisonsDuVillage(n) {
  const total = Math.max(0, Math.floor(Number(n) || 0));
  if (total > 18) return Array.from({ length: total }, (_, i) => `Maison ${i + 1}`);
  const autreRive = total >= 4 ? Math.min(6, Math.round(total / 3)) : 0;
  const place = total - autreRive;
  return [...Array.from({ length: place }, (_, i) => `Maison ${i + 1}`), ...Array.from({ length: autreRive }, (_, i) => `Maison ${13 + i}`)];
}

// Numéro d'une maison (« Maison 13 » -> 13), 0 si elle n'en a pas.
export const numeroDeMaison = maison => Number(/(\d+)/.exec(String(maison ?? ""))?.[1] ?? 0);
// L'autre rive : les maisons 13 à 18.
export const surLAutreRive = maison => {
  const n = numeroDeMaison(maison);
  return n >= 13 && n <= 18;
};

// Donne à chaque chasseur de primes une cible au hasard parmi les autres villageois vivants.
// villageois : [{ id, vivant, role }] -> { chasseurId: cibleId }
export function designerPrimes(villageois = [], hasard = Math.random) {
  const primes = {};
  for (const v of villageois) {
    if (victoireCleDe(v.role) !== "cible-executee") continue;
    const cible = choisir(villageois.filter(x => x.id !== v.id && x.vivant !== false).map(x => x.id), hasard);
    if (cible) primes[v.id] = cible;
  }
  return primes;
}
