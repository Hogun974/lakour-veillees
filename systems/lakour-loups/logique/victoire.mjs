// Conditions de victoire. Logique pure.
//
// verifierVictoire({ villageois, morts, primes, peste, glas, strict }) -> "village" | "meute" | "peste" | <acteurId> | ""
//   villageois : [{ id, vivant, camp, amoureux, role: { cle, victoireCle } }]
//   morts      : etat.morts ([{ acteurId, tour, phase, cause }]) — cause "vote" = exécuté par le village
//   primes     : { <id du chasseur de primes>: <id de sa cible> }
//   peste      : etat.peste (secret du MJ ; null pour une partie ordinaire)
//   glas       : le Glas final a sonné (glasSonne : le jour N du narrateur est passé) -> la partie doit finir
//   strict     : la Petite tablée (tablee.mjs) : la meute doit être PLUS nombreuse que les autres vivants (à égalité, rien)
//
// Dans l'ordre :
// 1. solitaire « exécuté » (le Revenant) : gagne s'il a été exécuté par le vote ;
//    solitaire « cible-executee » (le Chasseur de primes) : gagne si sa cible a été exécutée par le vote ;
//    solitaire « premier-tour » (le Feu follet, ambigus.mjs) : gagne s'il a été éliminé au premier tour (le premier vote, ou la meute
//    ou le poison de la première nuit) ;
// 1 bis. la Rosière (somnambule.mjs) exécutée par le vote : le Village perd aussitôt -> la meute (dans une peste noire : la peste) ;
// 2. peste noire (logique/peste.mjs) : reconnue (cri juste) -> le village ; sinon, un vivant ou moins -> la peste ; sinon
//    rien (ni « plus de loup » ni amants ni tueur solitaire ne finissent une partie de peste) ;
//    personne en vie : pas de vainqueur ("") ;
// 2 bis. le Pacte, étape 3b (ambigus.mjs, victoireDesAmbigus) : le Joueur de vielle vivant (pas devenu loup) dont tous les autres
//    vivants sont charmés (charmes) ; l'Illuminé vivant (pas devenu loup) quand tout l'autre groupe est éliminé (groupes) ; le
//    Loup pâle dernier vivant ;
// 3. les deux derniers vivants sont amoureux : ils gagnent ensemble (leur camp s'ils en partagent un, sinon l'id
//    du premier des deux) ; deux amants de camps différents ne gagnent que de cette façon (bilanDePartie ne les compte jamais
//    parmi les gagnants de leur camp) ;
// 4. « dernier-survivant » (le Pyromane) : il gagne seul s'il est le dernier vivant, ou le dernier avec un seul autre
//    joueur qui n'est pas un loup ;
// 5. plus de loup ni de tueur solitaire en vie : le village gagne ;
// 5 bis. l'Envoûtement (variantes.mjs, envoutes : les envoûtés, secret du MJ) : la meute a envoûté l'avant-dernier villageois (au plus
//    un vivant hors de la meute qui ne soit pas envoûté) : la meute gagne ;
// 6. la meute est au moins aussi nombreuse que tous les autres vivants : la meute gagne (strict : plus nombreuse) ;
// 7. le Glas final a sonné sans autre vainqueur : la meute si un loup vit encore, sinon le tueur solitaire qui vit encore
//    (le premier), sinon le village ; dans une peste noire, la peste.

import { VAINQUEUR_PESTE } from "./constantes.mjs";
import { CLE_ROSIERE } from "./somnambule.mjs";
import { victoireSaintMartin } from "./saintmartin.mjs";
import { VICTOIRE_FEU_FOLLET, VICTOIRE_LOUP_PALE, feuFolletGagne, victoireDesAmbigus } from "./ambigus.mjs";
import { meuteEnvoute } from "./variantes.mjs";

export function victoireCleDe(role) {
  if (!role) return "";
  if (role.victoireCle) return role.victoireCle;
  const cle = role.cle ?? "";
  if (/revenant/.test(cle)) return "execute";
  // (L'Incendiaire du Pacte, étape 4, est un rôle du Village qui ne gagne pas seul : sa clé n'entre plus ici.)
  if (/pyromane/.test(cle)) return "dernier-survivant";
  if (/chasseu.*prime/.test(cle)) return "cible-executee";
  return "";
}

// saintMartin : null (partie ordinaire) ; false (Nuit de la Saint-Martin, avant la fin : rien ne tombe) ; true (sa fin :
// victoireSaintMartin, saintmartin.mjs).
// charmes : les charmés du Joueur de vielle (secret du MJ) ; groupes : le partage annoncé pour l'Illuminé (ambigus.mjs,
// contexteDesAmbigus).
export function verifierVictoire({ villageois = [], morts = [], primes = {}, peste = null, glas = false, saintMartin = null, strict = false, charmes = [], groupes = null, envoutes = [] } = {}) {
  if (saintMartin !== null) return saintMartin ? victoireSaintMartin({ villageois, morts }) : "";
  const executes = new Set(morts.filter(m => m.cause === "vote").map(m => m.acteurId));

  for (const v of villageois) {
    const cle = victoireCleDe(v.role);
    if (cle === "execute" && executes.has(v.id)) return v.id;
    if (cle === "cible-executee" && primes[v.id] && executes.has(primes[v.id])) return v.id;
    if (cle === VICTOIRE_FEU_FOLLET && feuFolletGagne(v, morts)) return v.id;
  }

  if (villageois.some(v => v.role?.cle === CLE_ROSIERE && executes.has(v.id))) return peste?.active ? VAINQUEUR_PESTE : "meute";

  const vivants = villageois.filter(v => v.vivant !== false);
  if (peste?.active) {
    if (peste.decouverte) return "village";
    if (glas) return VAINQUEUR_PESTE;
    return vivants.length <= 1 ? VAINQUEUR_PESTE : "";
  }
  // Personne en vie : pas de vainqueur, sauf au Glas final, qui doit finir la partie : sans loup ni tueur solitaire vivant, le
  // village (règle 7 ci-dessous). Une Braconnière qui emporte le dernier loup en mourant vide le village (petite tablée, parité stricte).
  if (!vivants.length) return glas ? "village" : "";

  const ambigu = victoireDesAmbigus({ villageois, vivants, charmes, groupes, victoireCleDe });
  if (ambigu) return ambigu;

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
  if (meuteEnvoute({ villageois, envoutes })) return "meute";
  if (meute > 0 && (strict ? meute > vivants.length - meute : meute >= vivants.length - meute)) return "meute";
  if (glas) return meute > 0 ? "meute" : tueurs[0]?.id ?? "village";
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

// partis : etat.partis (passage.mjs) — un parti (départ, exil) ne gagne ni ne perd : ligne « parti », jamais gagnant.
export function bilanDePartie({ villageois = [], morts = [], causes = {}, vainqueur = "", partis = [] } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const gagnants = new Set();
  // Deux amants de camps différents (l'Entremetteuse) ne gagnent qu'en restant les deux derniers vivants : jamais avec leur camp.
  const desAmantsMeles = v => { const lie = parId.get(v.amoureux); return Boolean(lie && lie.amoureux === v.id && lie.camp !== v.camp); };
  // Le Loup pâle (ambigus.mjs) chasse avec la meute, mais ne gagne qu'en dernier vivant : jamais avec elle.
  const pale = v => victoireCleDe(v.role) === VICTOIRE_LOUP_PALE;
  if (vainqueur === "village" || vainqueur === "meute") {
    for (const v of villageois) if (v.camp === vainqueur && !desAmantsMeles(v)) gagnants.add(v.id);
    for (const v of villageois) if (pale(v)) gagnants.delete(v.id);
  } else if (parId.has(vainqueur)) {
    const v = parId.get(vainqueur), lie = parId.get(v.amoureux);
    gagnants.add(v.id);
    // Des amoureux de camps différents l'emportent ensemble.
    if (lie && lie.amoureux === v.id && v.vivant !== false && lie.vivant !== false) gagnants.add(lie.id);
  }
  const rang = new Map(morts.map((m, i) => [m.acteurId, i]));
  const lignes = villageois.map(v => {
    const m = rang.has(v.id) ? morts[rang.get(v.id)] : null;
    const p = m ? null : partis.find(x => x.acteurId === v.id) ?? null;
    return {
      id: v.id, nom: v.nom ?? "", role: v.role?.nom ?? "", camp: v.camp ?? "", metier: v.metier?.nom ?? "", vivant: v.vivant !== false,
      mort: v.vivant === false && !p ? { tour: m?.tour ?? 0, phase: m?.phase ?? "", cause: causes[v.id] ?? m?.cause ?? "" } : null,
      ...(p ? { parti: { tour: p.tour, comment: p.comment } } : {}),
      gagnant: gagnants.has(v.id) && !p
    };
  });
  const ordre = l => (l.vivant ? -1 : rang.get(l.id) ?? -0.5);
  return lignes.sort((a, b) => (a.vivant !== b.vivant ? (a.vivant ? -1 : 1) : ordre(b) - ordre(a)) || a.nom.localeCompare(b.nom));
}
