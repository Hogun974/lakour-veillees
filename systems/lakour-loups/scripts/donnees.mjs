// Passerelle entre les documents Foundry et la logique pure (villageois « à plat »).
import { ID } from "../logique/constantes.mjs";
import { normaliserEtat, fusionnerEtat } from "../logique/etat.mjs";
import { estMJActif } from "./canal.mjs";
import { secretsMJ } from "./secrets.mjs";

export const t = (cle, donnees) => (donnees ? game.i18n.format(cle, donnees) : game.i18n.localize(cle));

export const tousLesVillageois = () => game.actors.filter(a => a.type === "villageois");
export const roleDe = acteur => acteur?.items.find(i => i.type === "role") ?? null;
export const metierDe = acteur => acteur?.items.find(i => i.type === "metier") ?? null;

export function aPlat(acteur) {
  const s = acteur.system;
  const role = roleDe(acteur), metier = metierDe(acteur);
  return {
    id: acteur.id, nom: acteur.name, joueur: s.joueur, vivant: s.vivant, revele: s.revele, camp: s.camp, maison: s.maison,
    amoureux: s.amoureux, silence: s.silence, protections: s.protections,
    role: role ? { cle: role.system.cle, nom: role.name, camp: role.system.camp, effet: role.system.effet, apparence: role.system.apparence,
      victoireCle: role.system.victoireCle, nuit: { ...role.system.nuit }, usages: { ...role.system.usages } } : null,
    metier: metier ? { cle: metier.system.cle, nom: metier.name, effet: metier.system.effet, usages: { ...metier.system.usages } } : null
  };
}

export const villageoisAPlat = () => tousLesVillageois().map(aPlat);

// L'état public : le réglage monde « lakour-loups.partie », le même dans tous les navigateurs.
export function lirePublic() {
  return normaliserEtat(game.settings.get(ID, "partie"));
}

// L'état complet chez le MJ actif (public + secrets qu'il garde, voir secrets.mjs) ; l'état public partout ailleurs.
export function lireEtat() {
  const pub = lirePublic();
  return estMJActif() ? fusionnerEtat(pub, secretsMJ()) : pub;
}

// L'état tel que l'utilisateur courant a le droit de le voir (le même : un joueur n'a jamais que l'état public).
export const etatVisible = lireEtat;

// Les clés des bâtiments en jeu (enregistrées à la distribution ; à défaut, retrouvées d'après les documents).
export function clesDesBatiments(etat = lirePublic()) {
  if (etat.batimentsCles?.length) return [...etat.batimentsCles];
  return etat.batiments.map(u => {
    const d = fromUuidSync(u);
    return d?.system?.cle || String(d?.name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(la|le|les|l')\s*/, "").trim();
  }).filter(Boolean);
}

// Le villageois vivant (ou non) incarné par l'utilisateur courant.
export function monVillageois(user = game.user) {
  return tousLesVillageois().find(a => a.system.joueur === user.id) ?? null;
}

// Le rôle de cet acteur est-il visible de l'utilisateur courant ?
export function roleVisible(acteur, user = game.user) {
  if (user.isGM || acteur.system.revele || acteur.isOwner) return true;
  const moi = monVillageois(user);
  return Boolean(moi && !moi.system.vivant && game.settings.get(ID, "mortsVoientTout"));
}

// Libellés localisés.
export const libellePhase = p => t(`LAKOUR_LOUPS.Phases.${p}`);
export const libelleCamp = c => t(`LAKOUR_LOUPS.Camps.${c}`);
export function libelleCause(c) {
  const cle = `LAKOUR_LOUPS.Causes.${c}`;
  return game.i18n.has(cle) ? t(cle) : (c || t("LAKOUR_LOUPS.Causes.narrateur"));
}
export function libelleVainqueur(v) {
  if (!v) return "";
  if (v === "village" || v === "meute") return t(`LAKOUR_LOUPS.Victoire.${v}`);
  const a = game.actors.get(v);
  const lie = a?.system.amoureux ? game.actors.get(a.system.amoureux) : null;
  if (lie && lie.system.vivant && a.system.vivant) return t("LAKOUR_LOUPS.Victoire.amoureux", { a: a.name, b: lie.name });
  return t("LAKOUR_LOUPS.Victoire.solitaire", { nom: a?.name ?? v });
}
