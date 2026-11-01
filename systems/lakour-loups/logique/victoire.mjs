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

// Le récit de fin de partie : chacun, son rôle, son camp, son métier, son sort (la vraie cause, enfin dévoilée) et s'il est
// parmi les vainqueurs. Les survivants d'abord, puis les morts du dernier tombé au premier.
// -> [{ id, nom, role, camp, metier, vivant, mort: { tour, phase, cause } | null, gagnant }]
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
