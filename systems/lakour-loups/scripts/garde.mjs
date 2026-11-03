// La garde des documents de la partie (0.9.0), dans le navigateur qui tente la modification.
//
// Un joueur n'est plus propriétaire de son villageois (OBSERVER depuis 0.9.0) : le serveur de Foundry refuse donc déjà qu'il le
// modifie (se mettre « meute », se donner un rôle de nuit, des usages). Par défense en profondeur, ces hooks refusent aussi,
// avant tout envoi, toute création, modification ou suppression d'un villageois ou de ses objets par un utilisateur qui n'est
// pas MJ ; un document resté propriétaire (monde d'avant la migration, droits changés à la main) ne s'ouvre donc pas pour autant.
// Rien de ce que lit le MJ actif n'en dépend : il ne lit jamais un rôle ni un camp dans un document, seulement dans ses secrets.
const estVillageois = doc => doc?.documentName === "Actor" ? doc.type === "villageois" : doc?.type === "villageois";

// -> false (refus) si l'utilisateur n'est pas MJ et que le document est un villageois ou un objet d'un villageois.
export function refuserSiJoueur(doc, userId) {
  const acteur = doc?.documentName === "Item" || doc?.parent?.documentName === "Actor" ? doc.parent : doc;
  if (!estVillageois(acteur)) return undefined;
  const user = (userId && game.users?.get?.(userId)) || game.user;
  if (user?.isGM) return undefined;
  try { ui.notifications?.warn(game.i18n.localize("LAKOUR_LOUPS.Erreurs.FicheVerrouillee")); } catch { /* sans interface */ }
  return false;
}

export function brancherGarde() {
  Hooks.on("preUpdateActor", (acteur, changements, options, userId) => refuserSiJoueur(acteur, userId));
  Hooks.on("preDeleteActor", (acteur, options, userId) => refuserSiJoueur(acteur, userId));
  Hooks.on("preCreateItem", (objet, donnees, options, userId) => (objet?.parent ? refuserSiJoueur(objet, userId) : undefined));
  Hooks.on("preUpdateItem", (objet, changements, options, userId) => (objet?.parent ? refuserSiJoueur(objet, userId) : undefined));
  Hooks.on("preDeleteItem", (objet, options, userId) => (objet?.parent ? refuserSiJoueur(objet, userId) : undefined));
}
