// Conditions de victoire. Logique pure.
//
// verifierVictoire({ villageois, morts, primes }) -> "village" | "meute" | <acteurId> | ""
//   villageois : [{ id, vivant, camp, amoureux, role: { cle, victoireCle } }]
//   morts      : etat.morts ([{ acteurId, tour, phase, cause }]) — cause "vote" = exécuté par le village
//   primes     : { <id du chasseur de primes>: <id de sa cible> }
//
// Dans l'ordre :
// 1. solitaire « exécuté » (le Revenant) : gagne s'il a été exécuté par le vote ;
//    solitaire « cible-executee » (le Chasseur de primes) : gagne si sa cible a été exécutée par le vote ;
// 2. personne en vie : pas de vainqueur ("") ;
// 3. les deux derniers vivants sont amoureux : ils gagnent ensemble (leur camp s'ils en partagent un, sinon l'id
//    du premier des deux) ;
// 4. « dernier-survivant » (le Pyromane) : il gagne seul s'il est le dernier vivant, ou le dernier avec un seul autre
//    joueur qui n'est pas un loup ;
// 5. plus de loup ni de tueur solitaire en vie : le village gagne ;
// 6. la meute est au moins aussi nombreuse que tous les autres vivants : la meute gagne.

export function victoireCleDe(role) {
  if (!role) return "";
  if (role.victoireCle) return role.victoireCle;
  const cle = role.cle ?? "";
  if (/revenant/.test(cle)) return "execute";
  if (/pyromane|incendiaire/.test(cle)) return "dernier-survivant";
  if (/chasseu.*prime/.test(cle)) return "cible-executee";
  return "";
}

export function verifierVictoire({ villageois = [], morts = [], primes = {} } = {}) {
  const executes = new Set(morts.filter(m => m.cause === "vote").map(m => m.acteurId));

  for (const v of villageois) {
    const cle = victoireCleDe(v.role);
    if (cle === "execute" && executes.has(v.id)) return v.id;
    if (cle === "cible-executee" && primes[v.id] && executes.has(primes[v.id])) return v.id;
  }

  const vivants = villageois.filter(v => v.vivant !== false);
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
