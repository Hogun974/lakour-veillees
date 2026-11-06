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
// Un geste est « fait » quand une mort de sa cause l'a suivi, ce même tour (la nuit tombée, c'est trop tard) : chaque mort de
// cette cause sert le plus ancien mourant qui attend encore (deux Braconnières tombées la même nuit demandent deux morts).
// L'étape « emporter » de la Table (etapes.mjs, emporteursEnAttente) lit ce même compte.
export const GESTES = {
  // La Braconnière : elle emporte un vivant dans la tombe (une cible, elle-même exclue).
  emporter: { effet: "emporter", cause: "emporte", objet: "emporter", nombre: 1 }
};
export const CLES_DES_GESTES = Object.keys(GESTES);

// Le geste que porte un rôle (rôle à plat : { effet }) ; "" s'il n'en porte pas.
export const gesteDuRole = role => CLES_DES_GESTES.find(cle => GESTES[cle].effet === role?.effet) ?? "";

// Le geste dont la mort a cette cause ("" : aucun).
export const gesteDeLaCause = cause => CLES_DES_GESTES.find(cle => GESTES[cle].cause === cause) ?? "";

// Les gestes qui attendent encore leur mourant, dans l'ordre des morts : [{ acteurId, geste }]. Un par mort qui porte un geste,
// ce tour-ci (un mort de la cause même du geste, emporté à son tour, n'en fait pas), servi par la première mort de sa cause qui
// le suit. ignorer : [`${geste}:${acteurId}`] (le MJ a dit « personne » : « emporter:<id> », comme l'étape de la Table) — un
// mourant écarté n'attend plus rien, et ne prend la mort de personne.
export function gestesEnAttente(etat, villageois = [], ignorer = []) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const morts = (Array.isArray(etat?.morts) ? etat.morts : []).filter(m => m.tour === etat.tour);
  const sortie = [];
  for (const geste of CLES_DES_GESTES) {
    const { cause } = GESTES[geste];
    const enAttente = [];
    for (const m of morts) {
      if (m.cause === cause) enAttente.shift();
      else if (gesteDuRole(parId.get(m.acteurId)?.role) === geste && !ignorer.includes(`${geste}:${m.acteurId}`)) enAttente.push(m.acteurId);
    }
    sortie.push(...enAttente.map(acteurId => ({ acteurId, geste })));
  }
  return sortie;
}

// Le geste de ce mourant attend-il encore ?
export const gesteEnAttente = (etat, villageois, acteurId, geste) => gestesEnAttente(etat, villageois).some(g => g.acteurId === acteurId && g.geste === geste);

// Ceux que le mourant peut désigner : les vivants, lui excepté.
export const candidatsDuGeste = (villageois = [], acteurId) => villageois.filter(v => v.vivant !== false && v.id !== acteurId).map(v => v.id);

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
  const admis = new Set(candidatsDuGeste(villageois, acteurId));
  const choix = [...new Set(Array.isArray(cibles) ? cibles : [])].filter(id => admis.has(id)).slice(0, def.nombre);
  return choix.length ? { ok: true, raison: "", cibles: choix } : non("personne");
}
