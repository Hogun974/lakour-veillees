// Passerelle entre les documents Foundry et la logique pure (villageois « à plat »).
//
// Ce qui est secret d'un villageois (rôle, camp, amoureux, protections) n'est PAS dans son document (0.9.0, logique/fiches.mjs) :
// - chez le MJ actif, il vient de ses secrets (etat.fiches), et de là seulement : jamais d'un document, qu'un joueur aurait pu
//   modifier ;
// - chez un joueur, de sa propre fiche, reçue du MJ actif par le socket (prive.mjs) ; mort qui voit tout, des rôles des autres
//   reçus de même ; sinon, seul un rôle révélé à tous (objet `role` créé sur le document à la révélation publique) se voit ;
// - chez un autre MJ (assistant, MJ inactif) : comme un joueur sans villageois, le public seulement.
import { ID } from "../logique/constantes.mjs";
import { normaliserEtat, fusionnerEtat } from "../logique/etat.mjs";
import { aSonSouffle } from "../logique/souffle.mjs";
import { normaliserFiche } from "../logique/fiches.mjs";
import { estMJActif } from "./canal.mjs";
import { secretsMJ } from "./secrets.mjs";
import { mesSecrets } from "./prive.mjs";
import { secretsAJour } from "./coffre.mjs";

export const t = (cle, donnees) => (donnees ? game.i18n.format(cle, donnees) : game.i18n.localize(cle));

export const tousLesVillageois = () => game.actors.filter(a => a.type === "villageois");
export const metierDe = acteur => acteur?.items.find(i => i.type === "metier") ?? null;
// Le rôle révélé à tous : l'objet `role` du document (créé à la révélation publique, ou à la fin de la partie).
export const roleRevele = acteur => acteur?.items?.find?.(i => i.type === "role") ?? null;

// ------------------------------------------------------------------ fiches secrètes connues de ce navigateur
// Chez le MJ actif : toutes les fiches de la partie en cours (ses secrets), s'ils sont à jour (pas plus vieux que le coffre :
// coffre.mjs) ; {} sinon (il ne joue jamais sur des secrets périmés). null ailleurs.
function fichesDuMJ() {
  if (!estMJActif()) return null;
  const s = secretsMJ();
  let partie = "";
  try { partie = game.settings.get(ID, "partie")?.partie ?? ""; } catch { partie = ""; }
  return s?.partie && s.partie === partie && secretsAJour(partie) ? s.fiches ?? {} : {};
}

// La fiche d'un villageois telle que ce navigateur la connaît, ou null : chez le MJ actif, ses secrets ; chez son joueur, la
// sienne ; chez un mort qui voit tout, celle que le MJ lui a montrée.
export function ficheConnue(acteur, fiches = fichesDuMJ()) {
  if (!acteur) return null;
  if (fiches) return fiches[acteur.id] ? normaliserFiche(fiches[acteur.id]) : null;
  const p = mesSecrets();
  const f = acteur.system?.joueur && acteur.system.joueur === game.user?.id ? p.fiches?.[acteur.id] : p.vus?.[acteur.id];
  return f ? normaliserFiche(f) : null;
}

// Un objet de rôle d'après une fiche (forme d'un objet Foundry : name, img, system ; jamais un document du monde).
function objetSecret(role, acteur) {
  return { id: "", _id: "", type: "role", documentName: "Item", secret: true, name: role.name, img: role.img || "icons/svg/mystery-man.svg",
    uuid: role.source ?? "", source: role.source ?? "", parent: acteur ?? null, system: role.system,
    toObject() { return { name: role.name, type: "role", img: role.img, system: JSON.parse(JSON.stringify(role.system)) }; } };
}

// Le rôle d'un villageois tel que ce navigateur le connaît : chez le MJ actif, celui de ses secrets (jamais celui du document) ;
// ailleurs, le sien, ceux qu'un mort voit, ou un rôle révélé.
export function roleDe(acteur, fiches = fichesDuMJ()) {
  if (!acteur) return null;
  const f = ficheConnue(acteur, fiches);
  if (f?.role) return objetSecret(f.role, acteur);
  if (fiches) return null;
  return roleRevele(acteur);
}

// Son camp : chez le MJ actif, ses secrets ; ailleurs, sa fiche, ce qu'un mort voit, ou le camp publié à la révélation ("" : inconnu).
export function campDe(acteur, fiches = fichesDuMJ()) {
  if (!acteur) return "";
  const f = ficheConnue(acteur, fiches);
  if (f) return f.camp;
  if (fiches) return "";
  return acteur.system?.revele || roleRevele(acteur) ? acteur.system?.camp || roleRevele(acteur)?.system?.camp || "" : "";
}
export const amoureuxDe = (acteur, fiches = fichesDuMJ()) => ficheConnue(acteur, fiches)?.amoureux ?? (fiches ? "" : acteur?.system?.amoureux ?? "");
export const protectionsDe = (acteur, fiches = fichesDuMJ()) => (fiches ? ficheConnue(acteur, fiches)?.protections ?? 0 : 0);

// HTML d'une description -> texte brut sur une ligne (infobulles des boutons).
const ENTITES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&rsquo;": "’" };
export function texteBrut(html) {
  return String(html ?? "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, e => ENTITES[e] ?? e).replace(/\s+/g, " ").trim();
}

export function aPlat(acteur, fiches = fichesDuMJ()) {
  const s = acteur.system;
  const role = roleDe(acteur, fiches), metier = metierDe(acteur);
  return {
    id: acteur.id, nom: acteur.name, joueur: s.joueur, vivant: s.vivant, revele: s.revele, camp: campDe(acteur, fiches), maison: s.maison,
    amoureux: amoureuxDe(acteur, fiches), silence: s.silence, protections: protectionsDe(acteur, fiches),
    role: role ? { cle: role.system.cle, nom: role.name, camp: role.system.camp, effet: role.system.effet, apparence: role.system.apparence,
      victoireCle: role.system.victoireCle, nuit: { ...role.system.nuit }, usages: { ...role.system.usages } } : null,
    metier: metier ? { cle: metier.system.cle, nom: metier.name, effet: metier.system.effet, usages: { ...metier.system.usages } } : null
  };
}

export const villageoisAPlat = () => {
  const fiches = fichesDuMJ();
  return tousLesVillageois().map(a => aPlat(a, fiches));
};

// L'état public : le réglage monde « lakour-loups.partie », le même dans tous les navigateurs.
export function lirePublic() {
  return normaliserEtat(game.settings.get(ID, "partie"));
}

// L'état complet chez le MJ actif (public + secrets qu'il garde, voir secrets.mjs) ; l'état public partout ailleurs.
// Des secrets périmés (un autre MJ a scellé depuis) ne sont pas fusionnés : le MJ voit le public jusqu'à la réouverture du coffre.
export function lireEtat() {
  const pub = lirePublic();
  return estMJActif() && (!pub.partie || secretsAJour(pub.partie) || secretsMJ()?.partie !== pub.partie) ? fusionnerEtat(pub, secretsMJ()) : pub;
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

// Le rôle de cet acteur est-il visible de l'utilisateur courant ? Le MJ, son joueur (system.joueur, pas la propriété du
// document : un joueur n'est plus propriétaire de son villageois), un rôle révélé. Un mort voit tout (réglage
// « mortsVoientTout »), sauf tant qu'il garde son Dernier souffle (logique/souffle.mjs) : il voterait en connaissant les loups.
export function roleVisible(acteur, user = game.user) {
  if (user.isGM || acteur.system.revele || (acteur.system.joueur && acteur.system.joueur === user.id)) return true;
  const moi = monVillageois(user);
  return Boolean(moi && !moi.system.vivant && game.settings.get(ID, "mortsVoientTout") && !aSonSouffle(lirePublic(), { id: moi.id, vivant: false }));
}

// Libellés localisés.
export const libellePhase = p => t(`LAKOUR_LOUPS.Phases.${p}`);
export const libelleCamp = c => (c ? t(`LAKOUR_LOUPS.Camps.${c}`) : "");
export function libelleCause(c) {
  const cle = `LAKOUR_LOUPS.Causes.${c}`;
  return game.i18n.has(cle) ? t(cle) : (c || t("LAKOUR_LOUPS.Causes.narrateur"));
}
// etat : l'état de la partie (complet chez le MJ, public ailleurs, où la peste noire n'apparaît qu'à la fin).
export function libelleVainqueur(v, etat = null) {
  if (!v) return "";
  if (v === "peste") return t("LAKOUR_LOUPS.Victoire.peste");
  // La Nuit de la Saint-Martin : un innocent exécuté sans loup en jeu, personne ne gagne.
  if (v === "brume") return t("LAKOUR_LOUPS.Victoire.brume");
  if (v === "village" && etat?.peste?.active) return t("LAKOUR_LOUPS.Victoire.villagePeste");
  if (v === "village" || v === "meute") return t(`LAKOUR_LOUPS.Victoire.${v}`);
  const a = game.actors.get(v);
  const lieId = amoureuxDe(a);
  const lie = lieId ? game.actors.get(lieId) : null;
  if (lie && lie.system.vivant && a.system.vivant) return t("LAKOUR_LOUPS.Victoire.amoureux", { a: a.name, b: lie.name });
  return t("LAKOUR_LOUPS.Victoire.solitaire", { nom: a?.name ?? v });
}
