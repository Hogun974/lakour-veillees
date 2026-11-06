// Salons vocaux des Veillées (voix intégrée de Foundry, A/V) : qui entend qui, qui peut parler. Logique pure, calculée
// chez le MJ actif (lui seul connaît les camps) ; chaque navigateur ne reçoit que SA ligne (scripts/salons.mjs).
// Voir lakour-mj-ia/docs/voix-et-ecoute.md §3 et docs/loups-contrat.md.
//
// | Qui parle            | Jour (aube, jour, vote)       | Nuit                                                          |
// |----------------------|-------------------------------|---------------------------------------------------------------|
// | un vivant            | tous (vivants et morts)       | personne, micro coupé — sauf un loup : les loups (et les morts si mortsVoientTout) |
// | un mort              | les morts seulement           | les morts seulement                                           |
// | un réduit au silence | personne pendant jour et vote | personne                                                      |
//
// - Le MJ (tout utilisateur MJ) entend tout et parle à tous ; préparatifs et fin : tout le monde parle à tout le monde.
// - Un loup, c'est le camp ACTUEL du villageois (« meute ») : les loups de la meute (Loup de Brumecombe, affamé, déguisé,
//   Louve mère, hurleur, flaireur, des roseaux), le villageois mordu par la Louve mère (changerCamp à l'aube : il rejoint
//   la tanière la nuit suivante), et pas un loup dont le Colporteur a pris le rôle (son camp suit le rôle reçu). Le rôle ne sert que si
//   le camp manque.
// - Un spectateur (utilisateur sans villageois) est traité comme un mort : il observe ; mais il n'entend jamais la tanière.
// - Le Dernier souffle (souffle.mjs) : un mort qui garde encore sa voix ne doit rien savoir des rôles cachés. Avec
//   « mortsVoientTout », il n'entend pas la tanière, et les morts se partagent en deux salons : ceux qui gardent leur souffle
//   (et les spectateurs, quand le souffle est en jeu : table.souffleActif) entre eux, ceux qui l'ont rendu (et voient tout)
//   entre eux. table.villageois[].souffle : vrai tant qu'il le garde.
// - Les camps ne sont connus que du MJ actif : sans ses secrets (secretsMJ null, chez un autre navigateur), on ne compte
//   comme loups que ceux que ce navigateur connaît (table.loupsConnus : la meute, pour un loup), sinon personne.
// - Les fratries du Pacte (pacte.mjs : les Lavandières, les Bûcherons) : les nuits où elles veillent (la première, puis une sur
//   deux), leurs membres vivants se parlent entre eux, dans le salon « fratrie » (les morts qui voient tout les entendent, comme la
//   tanière). table.villageois[].fratrie : la clé du rôle qui veille cette nuit ("" sinon), calculée par le MJ actif ; ailleurs, un
//   frère ne connaît que les siens (table.freresConnus, reçus dans sa ligne). Un loup reste dans la tanière.
//
// audibilite(etatPublic, secretsMJ, locuteur, table) -> { peutParler, auditeurs: [userId], acteursAuditeurs: [acteurId], salon }
//   locuteur : un userId, { userId } ou { acteurId } (compagnon IA, ou villageois d'un joueur) ;
//   table : { villageois: [{ id, joueur, vivant, silence, camp, role: { camp }, fratrie }], utilisateurs: [{ id, mj }],
//             mortsVoientTout, automatique (réglage « Salons vocaux automatiques », vrai par défaut), loupsConnus, freresConnus }.
// ligneDe(etatPublic, secretsMJ, userId, table) -> la ligne d'un navigateur : { salon, peutParler, auditeurs, entend, loups? }.

export const PHASES_LIBRES = ["preparation", "fin"];
export const PHASES_DE_NUIT = ["nuit"];
export const PHASES_DU_JOUR_MUET = ["jour", "vote"];
// Les salons : « mj » (entend tout, parle à tous), « libre » (préparatifs, fin, salons coupés), « village » (le jour, un
// vivant parle à tous), « taniere » (la nuit, un loup parle aux loups), « morts » (un mort ou un spectateur parle aux morts),
// « nuit » (la nuit, un vivant se tait), « silence » (réduit au silence), « fratrie » (la nuit d'une fratrie, ses membres entre eux).
export const SALONS = ["mj", "libre", "village", "taniere", "morts", "nuit", "silence", "fratrie"];
export const SALONS_QUI_PARLENT = ["mj", "libre", "village", "taniere", "morts", "fratrie"];

const ids = liste => [...new Set(liste.filter(Boolean))];

function estLoup(v, secrets, table) {
  if (secrets === null || secrets === undefined) return (table.loupsConnus ?? []).includes(v.id);
  const camp = v.camp || v.role?.camp || "";
  return camp === "meute";
}

// La fratrie qui veille cette nuit pour ce villageois ("" sinon). Sans les secrets du MJ, seulement les frères que ce navigateur
// connaît (les siens), et lui-même.
function fratrieDe(v, secrets, table) {
  const f = String(v.fratrie ?? "");
  if (secrets === null || secrets === undefined) return f && ((table.freresConnus ?? []).includes(v.id) || v.joueur === table.moi) ? f : "";
  return f;
}

// Les participants : chaque utilisateur (MJ, joueur, spectateur) et chaque villageois sans utilisateur (compagnon IA).
// Un MJ qui incarne un villageois reste le MJ.
export function participants(etatPublic, secretsMJ, table = {}) {
  const villageois = table.villageois ?? [];
  const utilisateurs = table.utilisateurs ?? [];
  const mjs = new Set(utilisateurs.filter(u => u.mj).map(u => u.id));
  const liste = [];
  for (const u of utilisateurs) {
    const v = villageois.find(x => x.joueur === u.id) ?? null;
    if (mjs.has(u.id)) liste.push({ userId: u.id, acteurId: v?.id ?? "", mj: true, vivant: true, silence: false, loup: false });
    else if (v) liste.push({ userId: u.id, acteurId: v.id, mj: false, vivant: v.vivant !== false, silence: Boolean(v.silence), loup: estLoup(v, secretsMJ, table), souffle: Boolean(v.souffle),
      fratrie: fratrieDe(v, secretsMJ, table) });
    else liste.push({ userId: u.id, acteurId: "", mj: false, vivant: false, silence: false, loup: false, spectateur: true, souffle: Boolean(table.souffleActif) });
  }
  const connus = new Set(utilisateurs.map(u => u.id));
  for (const v of villageois) {
    if (v.joueur && connus.has(v.joueur)) continue;
    liste.push({ userId: "", acteurId: v.id, mj: false, vivant: v.vivant !== false, silence: Boolean(v.silence), loup: estLoup(v, secretsMJ, table), souffle: Boolean(v.souffle),
      fratrie: fratrieDe(v, secretsMJ, table) });
  }
  return liste;
}

// Le salon d'un participant dans cette phase.
export function salonDe(p, phase, { automatique = true } = {}) {
  if (!p) return "nuit";
  if (p.mj) return "mj";
  if (!automatique || !phase || PHASES_LIBRES.includes(phase)) return "libre";
  if (!p.vivant) return "morts";
  if (p.silence && (PHASES_DU_JOUR_MUET.includes(phase) || PHASES_DE_NUIT.includes(phase))) return "silence";
  if (PHASES_DE_NUIT.includes(phase) && p.fratrie && !p.loup) return "fratrie";
  if (PHASES_DE_NUIT.includes(phase)) return p.loup ? "taniere" : "nuit";
  return "village";
}

export const peutParlerDans = salon => SALONS_QUI_PARLENT.includes(salon);

// L'auditeur a entend-il le locuteur l ? (salons déjà calculés)
function entend(a, l, salonL, mortsVoientTout) {
  if (a === l || !peutParlerDans(salonL)) return false;
  if (a.mj || salonL === "mj" || salonL === "libre" || salonL === "village") return true;
  // Le Dernier souffle : un mort qui garde sa voix n'entend ni la tanière, ni les morts qui voient tout (et réciproquement).
  if (salonL === "taniere" && !a.vivant && a.souffle) return false;
  // Un spectateur (sans villageois, il n'a jamais joué) n'entend jamais la tanière, même si « les morts voient tout ».
  if (salonL === "taniere" && a.spectateur) return false;
  if (salonL === "morts" && mortsVoientTout && Boolean(a.souffle) !== Boolean(l.souffle)) return false;
  if (salonL === "taniere") return (a.vivant && a.loup) || (!a.vivant && Boolean(mortsVoientTout));
  // La fratrie : ses membres vivants (même clé) ; les morts qui voient tout, sauf ceux qui gardent leur souffle et les spectateurs.
  if (salonL === "fratrie") return (a.vivant && !a.loup && a.fratrie === l.fratrie) || (!a.vivant && Boolean(mortsVoientTout) && !a.souffle && !a.spectateur);
  if (salonL === "morts") return !a.vivant;
  return false;
}

function trouver(liste, locuteur) {
  if (typeof locuteur === "string") return liste.find(p => p.userId === locuteur) ?? null;
  if (locuteur?.userId) return liste.find(p => p.userId === locuteur.userId) ?? null;
  if (locuteur?.acteurId) return liste.find(p => p.acteurId === locuteur.acteurId) ?? null;
  return null;
}

export function audibilite(etatPublic, secretsMJ, locuteur, table = {}) {
  const phase = etatPublic?.phase ?? "";
  const options = { automatique: table.automatique !== false };
  const liste = participants(etatPublic, secretsMJ, table);
  const l = trouver(liste, locuteur);
  if (!l) return { peutParler: false, auditeurs: [], acteursAuditeurs: [], salon: "nuit" };
  const salon = salonDe(l, phase, options);
  const qui = liste.filter(a => entend(a, l, salon, table.mortsVoientTout));
  return {
    peutParler: peutParlerDans(salon),
    auditeurs: ids(qui.map(a => a.userId)),
    acteursAuditeurs: ids(qui.map(a => a.acteurId)),
    salon
  };
}

// La ligne d'un navigateur : son salon, s'il peut parler, qui l'entend, et qui il entend (userId seulement). Un loup, la
// nuit, y apprend la meute (loups : acteurIds), comme dans le jeu ; personne d'autre n'y trouve un loup.
export function ligneDe(etatPublic, secretsMJ, userId, table = {}) {
  const phase = etatPublic?.phase ?? "";
  const options = { automatique: table.automatique !== false };
  const liste = participants(etatPublic, secretsMJ, table);
  const moi = trouver(liste, userId);
  const a = audibilite(etatPublic, secretsMJ, userId, table);
  const entendus = moi ? liste.filter(l => l.userId && entend(moi, l, salonDe(l, phase, options), table.mortsVoientTout)) : [];
  const ligne = { phase, salon: a.salon, peutParler: a.peutParler, auditeurs: a.auditeurs, entend: ids(entendus.map(l => l.userId)) };
  if (a.salon === "taniere") ligne.loups = ids(liste.filter(p => p.vivant && p.loup && !p.mj).map(p => p.acteurId));
  if (a.salon === "fratrie") ligne.freres = ids(liste.filter(p => p.vivant && !p.loup && !p.mj && p.fratrie === moi.fratrie).map(p => p.acteurId));
  return ligne;
}

// Toutes les lignes (chez le MJ actif) : { userId: ligne }.
export function lignesDeTous(etatPublic, secretsMJ, table = {}) {
  return Object.fromEntries((table.utilisateurs ?? []).map(u => [u.id, ligneDe(etatPublic, secretsMJ, u.id, table)]));
}

// La voix de Foundry est-elle prête pour une veillée ? mode : réglage monde « rtcWorldSettings ».mode (0 = désactivé) ;
// utilisateurs : [{ nom, isGM, diffuse }] (diffuse : droit « Diffuser l'audio »). -> { desactive, muets: [nom], pret }
export function diagnosticVoix({ mode = 0, utilisateurs = [] } = {}) {
  const desactive = !Number(mode);
  const muets = utilisateurs.filter(u => !u.isGM && !u.diffuse).map(u => u.nom);
  return { desactive, muets, pret: !desactive && !muets.length };
}
