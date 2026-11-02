// Fiches du système : villageois (rôle visible seulement du propriétaire et du MJ), rôle, métier, bâtiment.
// Mise en page façon carte à jouer : en-tête avec portrait et « pilules » (Rôle · Camp · Métier · Maison), état en
// insignes, pouvoirs en cartes (« atouts ») avec icône, usages restants et texte en infobulle.
import { ID, CAMPS, EFFETS, VICTOIRES } from "../../logique/constantes.mjs";
import { t, roleDe, metierDe, libelleCamp, lireEtat, roleVisible } from "../donnees.mjs";
import { mesSecrets } from "../prive.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const enrichir = (html, doc) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: doc, secrets: doc.isOwner });

const choixCamps = () => Object.fromEntries(CAMPS.map(c => [c, libelleCamp(c)]));
function choixEffets(actuel) {
  const liste = { "": t("LAKOUR_LOUPS.Effets.aucun") };
  for (const e of EFFETS) liste[e] = `${e} — ${t(`LAKOUR_LOUPS.Effets.${e}`)}`;
  if (actuel && !(actuel in liste)) liste[actuel] = actuel;
  return liste;
}
const libelleEffet = e => (!e ? "" : EFFETS.includes(e) ? t(`LAKOUR_LOUPS.Effets.${e}`) : e);

// Usages d'un pouvoir : « 1 / 2 » et une rangée de jetons (pleins = restants), jusqu'à 10.
function usagesDe(objet) {
  const { max = 0, restant = 0 } = objet?.system?.usages ?? {};
  if (!(max > 0)) return { usages: "", jetons: [] };
  return { usages: `${restant} / ${max}`, jetons: max <= 10 ? Array.from({ length: max }, (_, i) => ({ plein: i < restant })) : [] };
}

// Le rythme d'un pouvoir : la nuit (l'ordre de réveil chez le MJ seulement), le jour, le nombre de cibles.
function rythmeDe(objet, gm) {
  const s = objet?.system ?? {}, liste = [];
  const marque = (classe, icone, texte) => liste.push({ classe, icone, texte });
  if (s.nuit?.actif) {
    marque("nuit", "fa-moon", gm ? t("LAKOUR_LOUPS.Fiche.NuitOrdre", { ordre: s.nuit.ordre }) : t("LAKOUR_LOUPS.Role.Actif"));
    if (s.nuit.premiereNuitSeulement) marque("nuit", "fa-hourglass-start", t("LAKOUR_LOUPS.Role.PremiereNuit"));
    if (s.nuit.uneNuitSurDeux) marque("nuit", "fa-circle-half-stroke", t("LAKOUR_LOUPS.Role.UneNuitSurDeux"));
    if (s.nuit.soiMeme) marque("nuit", "fa-user", t("LAKOUR_LOUPS.Role.SoiMeme"));
  }
  if (s.jour?.actif) marque("jour", "fa-sun", t("LAKOUR_LOUPS.Metier.PouvoirDeJour"));
  const cibles = s.nuit?.actif ? s.nuit.cibles : s.jour?.actif ? s.jour.cibles : 0;
  if (cibles > 0) marque("cibles", "fa-crosshairs", t("LAKOUR_LOUPS.Fiche.Cibles", { n: cibles }));
  return liste;
}

// Une carte de pouvoir (rôle ou métier) : icône, nom, rythme, usages, texte enrichi (et en infobulle).
async function atout(objet, gm) {
  const description = await enrichir(objet.system.description, objet);
  const victoire = objet.system.victoire ? await enrichir(objet.system.victoire, objet) : "";
  const bulle = victoire ? `${description}<hr><p><strong>${t("LAKOUR_LOUPS.Role.Victoire")}</strong></p>${victoire}` : description;
  return {
    id: objet.id, nom: objet.name, img: objet.img, description, victoire, bulle,
    ...usagesDe(objet), rythme: rythmeDe(objet, gm), effet: gm ? libelleEffet(objet.system.effet) : ""
  };
}

// ------------------------------------------------------------------ villageois
export class FicheVillageois extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [ID, "loups-fiche", "loups-fiche-villageois"],
    position: { width: 640, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { ouvrirObjet: FicheVillageois.#ouvrirObjet, retirerObjet: FicheVillageois.#retirerObjet }
  };

  static PARTS = { fiche: { template: `systems/${ID}/templates/fiche-villageois.hbs`, scrollable: [".loups-corps"] } };

  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const a = this.document, s = a.system;
    const gm = game.user.isGM;
    const etat = lireEtat();
    const voitRole = etat.phase === "fin" || roleVisible(a);
    const role = roleDe(a), metier = metierDe(a);
    // La prime n'est pas dans l'état public : le MJ actif la connaît, le joueur la tient de son carnet secret.
    const prime = gm ? etat.primes?.[a.id] ?? "" : (a.isOwner && s.joueur === game.user.id ? mesSecrets().prime : "");
    const amoureuxNom = (a.isOwner || gm) && s.amoureux ? game.actors.get(s.amoureux)?.name ?? "" : "";
    // Un joueur ne reçoit jamais le document entier (rôle, camp, amoureux y sont) : seulement les champs publics.
    const { document: _document, model: _modele, source: _source, ...publics } = contexte;
    const insigne = (classe, icone, texte, bulle = "") => ({ classe, icone, texte, bulle });
    const etats = [
      s.vivant ? insigne("vivant", "fa-heart-pulse", t("LAKOUR_LOUPS.Fiche.Vivant")) : insigne("mort", "fa-cross", t("LAKOUR_LOUPS.Table.Mort")),
      s.revele && insigne("revele", "fa-eye", t("LAKOUR_LOUPS.Fiche.Revele")),
      s.silence && insigne("silence", "fa-comment-slash", t("LAKOUR_LOUPS.Table.Silence")),
      s.vivant && etat.bailli?.actif && etat.bailli.acteurId === a.id && insigne("bailli", "fa-stamp", t("LAKOUR_LOUPS.Bailli.Titre"), t("LAKOUR_LOUPS.Bailli.Aide")),
      gm && s.protections > 0 && insigne("protege", "fa-shield-halved", t("LAKOUR_LOUPS.Fiche.Protege", { n: s.protections }), t("LAKOUR_LOUPS.Fiche.Protections")),
      amoureuxNom && insigne("amoureux", "fa-heart", amoureuxNom, t("LAKOUR_LOUPS.Fiche.Amoureux"))
    ].filter(Boolean);
    const vueRole = voitRole && role ? await atout(role, gm) : null;
    const vueMetier = metier ? await atout(metier, gm) : null;
    return {
      ...(gm ? contexte : publics),
      acteur: { id: a.id, uuid: a.uuid, name: a.name, img: a.img },
      system: gm ? s : { joueur: s.joueur, compagnon: s.compagnon, vivant: s.vivant, revele: s.revele, silence: s.silence, maison: s.maison, notes: s.notes },
      gm, proprietaire: a.isOwner, voitRole,
      editable: this.isEditable,
      role: vueRole ? { ...vueRole, camp: libelleCamp(role.system.camp), campCle: role.system.camp } : null,
      metier: vueMetier,
      campLibelle: voitRole ? libelleCamp(s.camp) : "",
      campCle: voitRole ? s.camp : "",
      etats,
      camps: gm ? choixCamps() : {},
      joueurs: gm ? Object.fromEntries([["", t("LAKOUR_LOUPS.Fiche.Personne")], ...game.users.filter(u => !u.isGM).map(u => [u.id, u.name])]) : {},
      joueurNom: game.users.get(s.joueur)?.name ?? t(s.compagnon ? "LAKOUR_LOUPS.Fiche.Compagnon" : "LAKOUR_LOUPS.Fiche.Personne"),
      autres: gm ? Object.fromEntries([["", "—"], ...game.actors.filter(x => x.type === "villageois" && x.id !== a.id).map(x => [x.id, x.name])]) : {},
      amoureuxNom,
      prime: prime ? game.actors.get(prime)?.name ?? "" : "",
      notesEnrichies: await enrichir(s.notes, a)
    };
  }

  // Un seul rôle et un seul métier : le nouveau remplace l'ancien. Seul le MJ donne un rôle.
  async _onDropItem(event, item) {
    if (!["role", "metier"].includes(item.type)) return super._onDropItem(event, item);
    if (item.type === "role" && !game.user.isGM) return null;
    if (!this.actor.isOwner || this.actor.uuid === item.parent?.uuid) return null;
    const anciens = this.actor.items.filter(i => i.type === item.type).map(i => i.id);
    if (anciens.length) await this.actor.deleteEmbeddedDocuments("Item", anciens);
    const cree = await super._onDropItem(event, item);
    if (cree && item.type === "role") await this.actor.update({ "system.camp": cree.system.camp });
    return cree;
  }

  static #ouvrirObjet(event, cible) {
    // Le rôle révélé d'un autre se lit dans la carte et l'infobulle : sa fiche n'est ouverte qu'à qui peut la voir.
    const objet = this.document.items.get(cible.dataset.itemId);
    if (objet?.testUserPermission(game.user, "OBSERVER")) objet.sheet.render({ force: true });
  }

  static async #retirerObjet(event, cible) {
    if (!game.user.isGM) return;
    await this.document.items.get(cible.dataset.itemId)?.delete();
  }
}

// ------------------------------------------------------------------ objets
class FicheObjet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [ID, "loups-fiche", "loups-fiche-objet"],
    position: { width: 580, height: 660 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  // Le texte et les règles d'un rôle ou d'un métier possédé ne se modifient que chez le MJ.
  get isEditable() {
    return super.isEditable && (game.user.isGM || !this.document.parent);
  }

  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const i = this.document;
    const gm = game.user.isGM;
    const enrichis = {};
    for (const champ of ["description", "victoire", "regle"]) if (champ in i.system) enrichis[champ] = await enrichir(i.system[champ], i);
    return {
      ...contexte, objet: i, system: i.system, editable: this.isEditable, gm, enrichis, effets: choixEffets(i.system.effet),
      ...usagesDe(i), rythme: rythmeDe(i, gm), effetLibelle: gm ? libelleEffet(i.system.effet) : ""
    };
  }
}

export class FicheRole extends FicheObjet {
  static DEFAULT_OPTIONS = {
    classes: ["loups-fiche-role"],
    // Le rôle d'un villageois n'est pas montré aux autres joueurs (droit « limité » sur l'acteur).
    viewPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
  };
  static PARTS = { fiche: { template: `systems/${ID}/templates/fiche-role.hbs`, scrollable: [".loups-corps"] } };

  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    return {
      ...c, camps: choixCamps(), solitaire: this.document.system.camp === "solitaire",
      victoires: Object.fromEntries(VICTOIRES.map(v => [v, t(`LAKOUR_LOUPS.Victoires.${v || "aucune"}`)])),
      apparences: { "": t("LAKOUR_LOUPS.Role.ApparenceCamp"), village: libelleCamp("village"), meute: libelleCamp("meute") }
    };
  }
}

export class FicheMetier extends FicheObjet {
  static DEFAULT_OPTIONS = { classes: ["loups-fiche-metier"] };
  static PARTS = { fiche: { template: `systems/${ID}/templates/fiche-metier.hbs`, scrollable: [".loups-corps"] } };
}

export class FicheBatiment extends FicheObjet {
  static DEFAULT_OPTIONS = { classes: ["loups-fiche-batiment"] };
  static PARTS = { fiche: { template: `systems/${ID}/templates/fiche-batiment.hbs`, scrollable: [".loups-corps"] } };
}
