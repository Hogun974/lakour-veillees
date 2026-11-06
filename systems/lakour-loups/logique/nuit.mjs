// Ordre de réveil de la nuit. Logique pure.
//
// Entrée : les villageois « à plat » ({ id, vivant, camp, role: { cle, camp, nuit, usages } }) et le n° de la nuit.
// Sortie : [{ roleCle, acteurIds, ordre, invite, cibles, soiMeme }], du plus tôt au plus tard.
//
// - la meute est réveillée d'un bloc à l'ordre 40 (clé "meute") : tous les vivants du camp ACTUEL "meute",
//   mordus compris ;
// - un rôle de la meute réglé à l'ordre 40 n'a pas de réveil à lui (il agit avec la meute) ; un rôle de la meute
//   à un autre ordre (Loup affamé, Loup hurleur…) est réveillé à part, en plus ;
// - premiereNuitSeulement : nuit 1 seulement ; uneNuitSurDeux : les nuits paires (2, 4, 6…) ;
// - tantQueMeuteEntiere (le Loup affamé) : chaque nuit, tant qu'aucun membre de la meute n'a été éliminé (meuteEntiere) ; dès
//   qu'un mort était de la meute (son camp au moment de sa mort : un loup, un mordu, plus tard un Mâtin ou un Enfant des bois
//   devenu loup), le pouvoir est perdu pour toujours ;
// - un pouvoir à usages comptés et épuisés n'est plus réveillé ;
// - peste noire (options.peste = etat.peste, actif) : pas de meute ; à sa place, à l'ordre 40, l'étape « la peste »
//   (clé "peste"), réveillée chaque nuit ; acteurIds : [le porteur] (la dernière victime morte de la peste, qui choisit
//   la suivante), ou [] tant qu'il n'y en a pas (le narrateur choisit).

import { ORDRE_MEUTE, CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { CLE_DEUIL, ORDRE_DEUIL } from "./deuil.mjs";

// La meute est-elle encore entière ? Aucun mort (ni parti) dont le camp était « meute ».
export const meuteEntiere = (villageois = []) => !villageois.some(v => v.vivant === false && v.camp === "meute");

// entiere : la meute est-elle entière (meuteEntiere) ? Par défaut oui (sans les villageois, on ne peut pas savoir).
export function seReveille(role, tour, { entiere = true } = {}) {
  const n = role?.nuit;
  if (!n?.actif) return false;
  if (n.premiereNuitSeulement && tour !== 1) return false;
  if (n.uneNuitSurDeux && tour % 2 !== 0) return false;
  if (n.tantQueMeuteEntiere && !entiere) return false;
  const u = role.usages;
  if (u && Number(u.max) > 0 && Number(u.restant) <= 0) return false;
  return true;
}

export function agitAvecLaMeute(role) {
  return role?.camp === "meute" && Number(role?.nuit?.ordre ?? 50) === ORDRE_MEUTE;
}

// La meute et la peste passent avant les rôles de même ordre.
const groupe = e => e.roleCle === CLE_MEUTE || e.roleCle === CLE_PESTE;

// deuil (Glas du deuil, deuil.mjs) : la vision due cette nuit -> l'étape « deuil » (CLE_DEUIL, ordre 41), toute la meute réveillée.
export function ordreDeNuit(villageois = [], tour = 1, { peste = null, deuil = false } = {}) {
  const vivants = villageois.filter(v => v.vivant !== false);
  const entiere = meuteEntiere(villageois);
  const etapes = new Map();

  if (peste?.active) {
    const porteur = villageois.some(v => v.id === peste.porteur) ? peste.porteur : "";
    etapes.set(CLE_PESTE, { roleCle: CLE_PESTE, acteurIds: porteur ? [porteur] : [], ordre: ORDRE_MEUTE, invite: "", cibles: 1, soiMeme: false });
  } else {
    const meute = vivants.filter(v => v.camp === "meute").map(v => v.id);
    if (meute.length) etapes.set(CLE_MEUTE, { roleCle: CLE_MEUTE, acteurIds: meute, ordre: ORDRE_MEUTE, invite: "", cibles: 1, soiMeme: false });
    if (meute.length && deuil) etapes.set(CLE_DEUIL, { roleCle: CLE_DEUIL, acteurIds: [...meute], ordre: ORDRE_DEUIL, invite: "", cibles: 1, soiMeme: false });
  }

  for (const v of vivants) {
    const role = v.role;
    if (!role?.cle || agitAvecLaMeute(role) || !seReveille(role, tour, { entiere })) continue;
    const etape = etapes.get(role.cle) ?? {
      roleCle: role.cle, acteurIds: [], ordre: Number(role.nuit.ordre ?? 50),
      invite: role.nuit.invite ?? "", cibles: Number(role.nuit.cibles ?? 1), soiMeme: Boolean(role.nuit.soiMeme)
    };
    etape.acteurIds.push(v.id);
    etapes.set(role.cle, etape);
  }

  return [...etapes.values()].sort((a, b) =>
    a.ordre - b.ordre
    || (groupe(a) ? -1 : groupe(b) ? 1 : 0)
    || a.roleCle.localeCompare(b.roleCle));
}
