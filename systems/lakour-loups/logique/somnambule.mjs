// Le Somnambule (rôle du Village) et la Rosière (rôle du Village). Logique pure.
//
// LE SOMNAMBULE croit tenir un rôle d'information (REVES : Liseuse de cendres, Fossoyeur ou Sourcier), choisi à la distribution,
// de préférence absent de la partie (deux porteurs d'un même rôle se trahiraient, et l'ordre de nuit ne réveille qu'un
// porteur par rôle). Il reçoit la carte de ce rôle, et son villageois PORTE l'objet de ce rôle : fiche, Table, infobulle,
// carnet et compagnon IA le voient ainsi, et la console de Foundry aussi (rien n'y trahit le Somnambule). Le vrai rôle vit
// dans les secrets du MJ : etat.somnambules = { acteurId: { croit: cle, vrai: uuid du rôle Somnambule, devoile } }.
// - La nuit, il est réveillé comme le rôle qu'il croit tenir ; ses visions sont FAUSSES mais plausibles (resolution.mjs,
//   option somnambules) : le camp inverse (un loup « du Village », tout autre « de la Meute ») ; « même camp » pour deux
//   joueurs de camps différents, et l'inverse ; pour un mort, le nom d'un autre rôle du contenu.
// - Il est du Village (son camp ne change pas, sauf morsure). À sa mort, et pour tous à la fin de la partie, l'objet de rôle
//   est remplacé par le vrai (le Somnambule) avant toute révélation : on le découvre Somnambule.
// - Le Colporteur qui échange son rôle prend le rêve avec : le Somnambule devient celui qui reçoit l'objet du rôle rêvé.
//
// LA ROSIÈRE (victoire.mjs) : si le village l'exécute par le vote, le Village perd aussitôt (la meute gagne ; dans une peste
// noire, la peste) ; la nuit, elle meurt comme tout le monde.
import { choisir } from "./hasard.mjs";

export const CLE_SOMNAMBULE = "somnambule";
export const CLE_ROSIERE = "rosiere";
export const REVES = ["liseuse-de-cendres", "fossoyeur", "sourcier"];

// Le rôle que croit tenir le Somnambule : parmi les rêves disponibles dans le contenu, de préférence absents de la partie.
// disponibles : [cle] du contenu ; enJeu : [cle] des rôles distribués. -> cle | ""
export function choisirReve({ disponibles = [], enJeu = [], hasard = Math.random } = {}) {
  const possibles = REVES.filter(c => disponibles.includes(c));
  const absents = possibles.filter(c => !enJeu.includes(c));
  return choisir(absents.length ? absents : possibles, hasard) ?? "";
}

// Les Somnambules qui rêvent encore (non dévoilés) : [acteurId].
export const reveurs = somnambules => Object.entries(somnambules ?? {}).filter(([, s]) => s && !s.devoile).map(([id]) => id);

// Le camp que lit une vision fausse (une vision d'un seul joueur) : l'inverse de son apparence.
export const campInverse = apparence => (apparence === "meute" ? "village" : "meute");

// Les rôles qu'un Fossoyeur rêvé peut lire sur un mort : ceux du contenu, hors meute et hors Somnambule (un « loup » rêvé, ou
// « Somnambule », trahiraient le rêve). roles : [{ cle, nom, camp }] -> [nom]
export const nomsFactices = (roles = []) => roles.filter(r => r?.nom && r.camp !== "meute" && r.cle !== CLE_SOMNAMBULE).map(r => r.nom);

// Le rôle que voit une vision fausse sur un mort : un autre rôle du contenu (noms), au hasard ; à défaut, « ? ».
export function roleFactice(vrai, noms = [], hasard = Math.random) {
  return choisir(noms.filter(n => n && n !== vrai), hasard) ?? "?";
}
