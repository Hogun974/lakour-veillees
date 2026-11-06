// Les DERNIERS GESTES : ce qu'un mourant décide lui-même, au moment de sa mort. Logique pure.
//
// Sur table, la Braconnière qui tombe désigne aussitôt, du doigt, celui qu'elle emporte : personne ne choisit à sa place. Plus
// tard, d'autres rôles du livre feront de même (le Souffre-douleur exécuté désigne qui votera le lendemain, le Vieux Sergent…),
// et le Bailli remet déjà son sceau ainsi (bailli.mjs, succession). Le mécanisme est donc commun :
// - un rôle dont l'effet porte un geste (GESTES : « emporter » pour la Braconnière) meurt ;
// - le système envoie à son joueur (ou à son compagnon IA) une demande POSTHUME (api.mjs, demandeLibre({ posthume: true })),
//   avec les vivants pour candidats ;
// - sa réponse est appliquée (verifierGeste puis, pour « emporter », la mort de la cible, cause « emporte ») ;
// - sans réponse au délai, s'il passe, ou si le MJ préfère trancher, le MJ garde la main : l'étape « emporter » de la Table
//   (etapes.mjs) reste proposée tant que le geste n'est pas fait, et le premier qui le fait (joueur ou MJ) l'a fait.
// Un geste qui tue (« emporter ») est « fait » quand une mort de sa cause l'a suivi, ce même tour (la nuit tombée, c'est trop
// tard) : chaque mort de cette cause sert le plus ancien mourant qui attend encore (deux Braconnières tombées la même nuit demandent
// deux morts). L'étape « emporter » de la Table (etapes.mjs, emporteursEnAttente) lit ce même compte.
// Un geste qui ne tue pas (« votants ») dit lui-même quand il est dû (quand : sa mort le permet-elle ?) et quand il est fait (fait).
// Le village qui a perdu sa sagesse (pacte.mjs) : plus aucun rôle du Village n'a de dernier geste. Un condamné dont la Chambrière a
// pris la carte (ambigus.mjs, carteReprise) non plus : sa carte est partie avec elle avant d'être retournée.
import { EFFET_SOUFFRE_DOULEUR, normaliserPacte, pouvoirPerdu, sagesseEstPerdue, estGracie } from "./pacte.mjs";
import { carteReprise } from "./ambigus.mjs";

export const GESTES = {
  // La Braconnière : elle emporte un vivant dans la tombe (une cible, elle-même exclue).
  emporter: { effet: "emporter", cause: "emporte", objet: "emporter", nombre: 1 },
  // Le Souffre-douleur condamné par une égalité (pacte.mjs, etat.pacte.egalite) : il désigne ceux qui voteront aux votes
  // d'exécution du lendemain (un au moins, tous les vivants s'il veut ; nombre 0 : autant que de candidats). Fait : sa liste est
  // posée (etat.pacte.votants, par lui).
  votants: { effet: EFFET_SOUFFRE_DOULEUR, objet: "votants", nombre: 0,
    quand: (etat, m) => m.cause === "vote" && normaliserPacte(etat?.pacte).egalite?.acteurId === m.acteurId,
    fait: (etat, acteurId) => { const v = normaliserPacte(etat?.pacte).votants; return v?.par === acteurId && v.tour === (Number(etat?.tour) || 0) + 1; } }
};
export const CLES_DES_GESTES = Object.keys(GESTES);

// Le geste que porte un rôle (rôle à plat : { effet, camp }) ; "" s'il n'en porte pas (ou plus : sansPouvoirs, la sagesse perdue).
export const gesteDuRole = (role, sansPouvoirs = false) => (pouvoirPerdu(sansPouvoirs, role) ? "" : CLES_DES_GESTES.find(cle => GESTES[cle].effet === role?.effet) ?? "");

// Le geste dont la mort a cette cause ("" : aucun).
export const gesteDeLaCause = cause => CLES_DES_GESTES.find(cle => GESTES[cle].cause === cause) ?? "";

// Les gestes qui attendent encore leur mourant, dans l'ordre des morts : [{ acteurId, geste }]. Un par mort qui porte un geste,
// ce tour-ci (un mort de la cause même du geste, emporté à son tour, n'en fait pas), servi par la première mort de sa cause qui
// le suit. ignorer : [`${geste}:${acteurId}`] (le MJ a dit « personne » : « emporter:<id> », comme l'étape de la Table) — un
// mourant écarté n'attend plus rien, et ne prend la mort de personne.
export function gestesEnAttente(etat, villageois = [], ignorer = []) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const morts = (Array.isArray(etat?.morts) ? etat.morts : []).filter(m => m.tour === etat.tour);
  const sans = sagesseEstPerdue(etat);
  const sortie = [];
  for (const geste of CLES_DES_GESTES) {
    const { cause, quand, fait } = GESTES[geste];
    const porte = m => gesteDuRole(parId.get(m.acteurId)?.role, sans) === geste && !ignorer.includes(`${geste}:${m.acteurId}`) && !carteReprise(etat, m.acteurId);
    if (fait) {
      for (const m of morts) if (porte(m) && quand(etat, m) && !fait(etat, m.acteurId)) sortie.push({ acteurId: m.acteurId, geste });
      continue;
    }
    const enAttente = [];
    for (const m of morts) {
      if (m.cause === cause) enAttente.shift();
      else if (porte(m)) enAttente.push(m.acteurId);
    }
    sortie.push(...enAttente.map(acteurId => ({ acteurId, geste })));
  }
  return sortie;
}

// Le geste de ce mourant attend-il encore ?
export const gesteEnAttente = (etat, villageois, acteurId, geste) => gestesEnAttente(etat, villageois).some(g => g.acteurId === acteurId && g.geste === geste);

// Ceux que le mourant peut désigner : les vivants, lui excepté ; pour la liste des votants (etat donné), pas un Innocent gracié (il
// ne vote plus).
export const candidatsDuGeste = (villageois = [], acteurId, { etat = null, geste = "" } = {}) => {
  const ids = villageois.filter(v => v.vivant !== false && v.id !== acteurId).map(v => v.id);
  return geste === "votants" && etat ? ids.filter(id => !estGracie(etat, id)) : ids;
};
// Combien il peut en désigner (nombre 0 : tous les candidats).
export const nombreDuGeste = (geste, candidats = []) => GESTES[geste]?.nombre || Math.max(1, candidats.length);

// La réponse du mourant, vérifiée sur l'état d'APRÈS (elle arrive quand elle arrive) :
// -> { ok, raison: "" | "partie" (une autre partie) | "fin" (partie finie) | "geste" (inconnu) | "fait" (déjà fait : le MJ a
//      tranché, ou la nuit est tombée) | "personne" (il passe, ou aucun vivant désigné), cibles: [acteurId] }
export function verifierGeste({ etat, villageois = [], acteurId, geste, cibles = [], partie = etat?.partie } = {}) {
  const non = raison => ({ ok: false, raison, cibles: [] });
  const def = GESTES[geste];
  if (!def) return non("geste");
  if ((etat?.partie ?? "") !== partie) return non("partie");
  if (etat?.vainqueur || etat?.phase === "fin") return non("fin");
  if (!gesteEnAttente(etat, villageois, acteurId, geste)) return non("fait");
  const candidats = candidatsDuGeste(villageois, acteurId, { etat, geste });
  const admis = new Set(candidats);
  const choix = [...new Set(Array.isArray(cibles) ? cibles : [])].filter(id => admis.has(id)).slice(0, nombreDuGeste(geste, candidats));
  return choix.length ? { ok: true, raison: "", cibles: choix } : non("personne");
}
