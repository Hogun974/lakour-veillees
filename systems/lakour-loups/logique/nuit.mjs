// Ordre de réveil de la nuit. Logique pure.
//
// Entrée : les villageois « à plat » ({ id, vivant, camp, role: { cle, camp, nuit, usages } }) et le n° de la nuit.
// Sortie : [{ roleCle, acteurIds, ordre, invite, cibles, soiMeme }], du plus tôt au plus tard.
//
// - la meute est réveillée d'un bloc à l'ordre 40 (clé "meute") : tous les vivants du camp ACTUEL "meute",
//   mordus compris ;
// - un rôle de la meute réglé à l'ordre 40 n'a pas de réveil à lui (il agit avec la meute) ; un rôle de la meute
//   à un autre ordre (Loup affamé, Loup hurleur…) est réveillé à part, en plus ;
// - premiereNuitSeulement : nuit 1 seulement ; uneNuitSurDeux : les nuits paires (2, 4, 6…) ; nuitsImpaires : la première nuit,
//   puis une nuit sur deux (1, 3, 5… : les Lavandières et les Bûcherons, qui se reconnaissent puis se retrouvent) ;
// - tantQueMeuteEntiere (le Loup affamé) : chaque nuit, tant qu'aucun membre de la meute n'a été éliminé (meuteEntiere) ; dès
//   qu'un mort était de la meute (son camp au moment de sa mort : un loup, un mordu, plus tard un Mâtin ou un Enfant des bois
//   devenu loup), le pouvoir est perdu pour toujours ;
// - un pouvoir à usages comptés et épuisés n'est plus réveillé ;
// - le village a perdu sa sagesse (l'Aïeul tombé de la main du village, pacte.mjs : sagessePerdue) : plus aucun rôle du Village
//   (sa carte) n'est réveillé, jusqu'à la fin ;
// - peste noire (options.peste = etat.peste, actif) : pas de meute ; à sa place, à l'ordre 40, l'étape « la peste »
//   (clé "peste"), réveillée chaque nuit ; acteurIds : [le porteur] (la dernière victime morte de la peste, qui choisit
//   la suivante), ou [] tant qu'il n'y en a pas (le narrateur choisit).
// - Le Pacte, étape 3b (ambigus.mjs) : premiereNuitSeulement vaut pour la nuit `nuit.debut` du rôle (1 par défaut ; un rôle repris
//   par la Chambrière joue sa première nuit à la nuit qui suit) ; un Joueur de vielle devenu loup ne se réveille plus ;
//   options.emprunts : { acteurId: rôle à plat } — la carte jouée cette nuit par un Bateleur : il se réveille EN PLUS à l'ordre de
//   cette carte, pour son pouvoir ; options.charmes : [acteurId] — les charmés vivants se réveillent ensemble à ORDRE_CHARMES
//   (étape « charmes », sans choix), tant qu'un Joueur de vielle joue.

import { ORDRE_MEUTE, CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { CLE_DEUIL, ORDRE_DEUIL } from "./deuil.mjs";
import { pouvoirPerdu } from "./pacte.mjs";
import { CLE_CHARMES, ORDRE_CHARMES, EFFET_VIELLE, vielleEnJeu, charmesVivants } from "./ambigus.mjs";

// La meute est-elle encore entière ? Aucun mort (ni parti) dont le camp était « meute ».
export const meuteEntiere = (villageois = []) => !villageois.some(v => v.vivant === false && v.camp === "meute");

// entiere : la meute est-elle entière (meuteEntiere) ? Par défaut oui (sans les villageois, on ne peut pas savoir).
// sansPouvoirs : le village a perdu sa sagesse (pacte.mjs) ; un rôle du Village ne se réveille plus.
export function seReveille(role, numero, { entiere = true, sansPouvoirs = false } = {}) {
  const n = role?.nuit;
  if (!n?.actif) return false;
  if (pouvoirPerdu(sansPouvoirs, role)) return false;
  // Le Pacte, étape 3b : un rôle repris en cours de partie (la Chambrière) compte ses nuits depuis n.debut, sa première nuit.
  const tour = n.premiereNuitSeulement && Number(n.debut) > 1 ? numero - Number(n.debut) + 1 : numero;
  if (n.premiereNuitSeulement && tour !== 1) return false;
  if (n.uneNuitSurDeux && tour % 2 !== 0) return false;
  if (n.nuitsImpaires && tour % 2 !== 1) return false;
  if (n.tantQueMeuteEntiere && !entiere) return false;
  const u = role.usages;
  if (u && Number(u.max) > 0 && Number(u.restant) <= 0) return false;
  return true;
}

export function agitAvecLaMeute(role) {
  return role?.camp === "meute" && Number(role?.nuit?.ordre ?? 50) === ORDRE_MEUTE;
}

// Une étape de rôle (créée au premier porteur), et son porteur.
function ajouter(etapes, role, acteurId, extra = {}) {
  const etape = etapes.get(role.cle) ?? {
    roleCle: role.cle, acteurIds: [], ordre: Number(role.nuit.ordre ?? 50),
    invite: role.nuit.invite ?? "", cibles: Number(role.nuit.cibles ?? 1), soiMeme: Boolean(role.nuit.soiMeme), ...extra
  };
  etape.acteurIds.push(acteurId);
  etapes.set(role.cle, etape);
}

// La meute et la peste passent avant les rôles de même ordre.
const groupe = e => e.roleCle === CLE_MEUTE || e.roleCle === CLE_PESTE;

// deuil (Glas du deuil, deuil.mjs) : la vision due cette nuit -> l'étape « deuil » (CLE_DEUIL, ordre 41), toute la meute réveillée.
// sagessePerdue : le village a perdu sa sagesse (pacte.mjs, sagesseEstPerdue(etat)) — les rôles du Village ne sont plus réveillés.
// emprunts, charmes : le Pacte, étape 3b (ambigus.mjs, nuitDesAmbigus) — les cartes jouées par un Bateleur, les charmés.
export function ordreDeNuit(villageois = [], tour = 1, { peste = null, deuil = false, sagessePerdue = false, emprunts = {}, charmes = [] } = {}) {
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
    if (!role?.cle || agitAvecLaMeute(role) || !seReveille(role, tour, { entiere, sansPouvoirs: sagessePerdue })) continue;
    // Le Joueur de vielle infecté devient loup simple : il ne charme plus.
    if (role.effet === EFFET_VIELLE && v.camp === "meute") continue;
    ajouter(etapes, role, v.id);
  }
  // Le Bateleur : la carte qu'il joue cette nuit le réveille en plus, à son ordre (s'il a encore son pouvoir).
  for (const [id, role] of Object.entries(emprunts ?? {})) {
    const v = vivants.find(x => x.id === id);
    if (!v || !role?.cle || pouvoirPerdu(sagessePerdue, v.role) || !seReveille(role, tour, { entiere, sansPouvoirs: sagessePerdue })) continue;
    ajouter(etapes, role, id, { emprunt: true });
  }
  // Les charmés du Joueur de vielle, ensemble, à la fin de la nuit.
  const charmesDeLaNuit = charmes?.length && vielleEnJeu(villageois) ? charmesVivants(villageois, charmes) : [];
  if (charmesDeLaNuit.length) etapes.set(CLE_CHARMES, { roleCle: CLE_CHARMES, acteurIds: charmesDeLaNuit, ordre: ORDRE_CHARMES, invite: "", cibles: 0, soiMeme: false });

  return [...etapes.values()].sort((a, b) =>
    a.ordre - b.ordre
    || (groupe(a) ? -1 : groupe(b) ? 1 : 0)
    || a.roleCle.localeCompare(b.roleCle));
}
