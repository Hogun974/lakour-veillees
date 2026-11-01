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
// - un pouvoir à usages comptés et épuisés n'est plus réveillé.

import { ORDRE_MEUTE, CLE_MEUTE } from "./constantes.mjs";

export function seReveille(role, tour) {
  const n = role?.nuit;
  if (!n?.actif) return false;
  if (n.premiereNuitSeulement && tour !== 1) return false;
  if (n.uneNuitSurDeux && tour % 2 !== 0) return false;
  const u = role.usages;
  if (u && Number(u.max) > 0 && Number(u.restant) <= 0) return false;
  return true;
}

export function agitAvecLaMeute(role) {
  return role?.camp === "meute" && Number(role?.nuit?.ordre ?? 50) === ORDRE_MEUTE;
}

export function ordreDeNuit(villageois = [], tour = 1) {
  const vivants = villageois.filter(v => v.vivant !== false);
  const etapes = new Map();

  const meute = vivants.filter(v => v.camp === "meute").map(v => v.id);
  if (meute.length) etapes.set(CLE_MEUTE, { roleCle: CLE_MEUTE, acteurIds: meute, ordre: ORDRE_MEUTE, invite: "", cibles: 1, soiMeme: false });

  for (const v of vivants) {
    const role = v.role;
    if (!role?.cle || agitAvecLaMeute(role) || !seReveille(role, tour)) continue;
    const etape = etapes.get(role.cle) ?? {
      roleCle: role.cle, acteurIds: [], ordre: Number(role.nuit.ordre ?? 50),
      invite: role.nuit.invite ?? "", cibles: Number(role.nuit.cibles ?? 1), soiMeme: Boolean(role.nuit.soiMeme)
    };
    etape.acteurIds.push(v.id);
    etapes.set(role.cle, etape);
  }

  return [...etapes.values()].sort((a, b) =>
    a.ordre - b.ordre
    || (a.roleCle === CLE_MEUTE ? -1 : b.roleCle === CLE_MEUTE ? 1 : 0)
    || a.roleCle.localeCompare(b.roleCle));
}
