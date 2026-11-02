// Conditions de victoire. Logique pure.
//
// verifierVictoire({ villageois, morts, primes, peste }) -> "village" | "meute" | "peste" | <acteurId> | ""
//   villageois : [{ id, vivant, camp, amoureux, role: { cle, victoireCle } }]
//   morts      : etat.morts ([{ acteurId, tour, phase, cause }]) — cause "vote" = exécuté par le village
//   primes     : { <id du chasseur de primes>: <id de sa cible> }
//   peste      : etat.peste (secret du MJ ; null pour une partie ordinaire)
//
// Dans l'ordre :
// 1. solitaire « exécuté » (le Revenant) : gagne s'il a été exécuté par le vote ;
//    solitaire « cible-executee » (le Chasseur de primes) : gagne si sa cible a été exécutée par le vote ;
// 2. peste noire (logique/peste.mjs) : reconnue (cri juste) -> le village ; sinon, un vivant ou moins -> la peste ; sinon
//    rien (ni « plus de loup » ni amants ni tueur solitaire ne finissent une partie de peste) ;
//    personne en vie : pas de vainqueur ("") ;
// 3. les deux derniers vivants sont amoureux : ils gagnent ensemble (leur camp s'ils en partagent un, sinon l'id
//    du premier des deux) ;
// 4. « dernier-survivant » (le Pyromane) : il gagne seul s'il est le dernier vivant, ou le dernier avec un seul autre
//    joueur qui n'est pas un loup ;
// 5. plus de loup ni de tueur solitaire en vie : le village gagne ;
// 6. la meute est au moins aussi nombreuse que tous les autres vivants : la meute gagne.

import { VAINQUEUR_PESTE } from "./constantes.mjs";

export function victoireCleDe(role) {
  if (!role) return "";
  if (role.victoireCle) return role.victoireCle;
  const cle = role.cle ?? "";
  if (/revenant/.test(cle)) return "execute";
  if (/pyromane|incendiaire/.test(cle)) return "dernier-survivant";
  if (/chasseu.*prime/.test(cle)) return "cible-executee";
  return "";
}

export function verifierVictoire({ villageois = [], morts = [], primes = {}, peste = null } = {}) {
  const executes = new Set(morts.filter(m => m.cause === "vote").map(m => m.acteurId));

  for (const v of villageois) {
    const cle = victoireCleDe(v.role);
    if (cle === "execute" && executes.has(v.id)) return v.id;
    if (cle === "cible-executee" && primes[v.id] && executes.has(primes[v.id])) return v.id;
  }

  const vivants = villageois.filter(v => v.vivant !== false);
  if (peste?.active) {
    if (peste.decouverte) return "village";
    return vivants.length <= 1 ? VAINQUEUR_PESTE : "";
  }
  if (!vivants.length) return "";

  if (vivants.length === 2) {
    const [a, b] = vivants;
    if (a.amoureux === b.id && b.amoureux === a.id) {
      if (a.camp === b.camp && a.camp !== "solitaire") return a.camp;
      return a.id;
    }
  }

  const tueurs = vivants.filter(v => victoireCleDe(v.role) === "dernier-survivant");
  if (tueurs.length === 1 && (vivants.length === 1 || (vivants.length === 2 && vivants.find(v => v !== tueurs[0]).camp !== "meute"))) return tueurs[0].id;

  const meute = vivants.filter(v => v.camp === "meute").length;
  if (meute === 0 && tueurs.length === 0) return "village";
  if (meute > 0 && meute >= vivants.length - meute) return "meute";
  return "";
}

// Le récit de fin de partie : chacun, son rôle, son camp, son métier, son sort (la vraie cause, enfin dévoilée) et s'il est
// parmi les vainqueurs. Les survivants d'abord, puis les morts du dernier tombé au premier.
// -> [{ id, nom, role, camp, metier, vivant, mort: { tour, phase, cause } | null, gagnant }]
// Le palmarès des Chroniques : par joueur humain (les joueurs IA n'y figurent pas), ses veillées, ses victoires, ses
// survies (en vie au dernier matin) et ses parties dans la meute. Le plus de victoires d'abord, puis le meilleur taux.
// chroniques : [{ lignes: [{ joueur, camp, vivant, gagnant }] }].
export function palmares(chroniques = []) {
  const parJoueur = new Map();
  for (const c of chroniques) {
    for (const l of c?.lignes ?? []) {
      if (!l.joueur) continue;
      const p = parJoueur.get(l.joueur) ?? { joueur: l.joueur, parties: 0, victoires: 0, survies: 0, meute: 0 };
      p.parties++;
      if (l.gagnant) p.victoires++;
      if (l.vivant) p.survies++;
      if (l.camp === "meute") p.meute++;
      parJoueur.set(l.joueur, p);
    }
  }
  return [...parJoueur.values()].sort((a, b) => b.victoires - a.victoires || b.victoires / b.parties - a.victoires / a.parties
    || a.joueur.localeCompare(b.joueur));
}

export function bilanDePartie({ villageois = [], morts = [], causes = {}, vainqueur = "" } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const gagnants = new Set();
  if (vainqueur === "village" || vainqueur === "meute") {
    for (const v of villageois) if (v.camp === vainqueur) gagnants.add(v.id);
  } else if (parId.has(vainqueur)) {
    const v = parId.get(vainqueur), lie = parId.get(v.amoureux);
    gagnants.add(v.id);
    // Des amoureux de camps différents l'emportent ensemble.
    if (lie && lie.amoureux === v.id && v.vivant !== false && lie.vivant !== false) gagnants.add(lie.id);
  }
  const rang = new Map(morts.map((m, i) => [m.acteurId, i]));
  const lignes = villageois.map(v => {
    const m = rang.has(v.id) ? morts[rang.get(v.id)] : null;
    return {
      id: v.id, nom: v.nom ?? "", role: v.role?.nom ?? "", camp: v.camp ?? "", metier: v.metier?.nom ?? "", vivant: v.vivant !== false,
      mort: v.vivant === false ? { tour: m?.tour ?? 0, phase: m?.phase ?? "", cause: causes[v.id] ?? m?.cause ?? "" } : null,
      gagnant: gagnants.has(v.id)
    };
  });
  const ordre = l => (l.vivant ? -1 : rang.get(l.id) ?? -0.5);
  return lignes.sort((a, b) => (a.vivant !== b.vivant ? (a.vivant ? -1 : 1) : ordre(b) - ordre(a)) || a.nom.localeCompare(b.nom));
}
