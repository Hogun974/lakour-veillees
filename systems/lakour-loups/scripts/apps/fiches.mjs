// Fiches du système : villageois (rôle visible seulement du propriétaire et du MJ), rôle, métier, bâtiment.
// Mise en page façon carte à jouer : en-tête avec portrait et « pilules » (Rôle · Camp · Métier · Maison), état en
// insignes, pouvoirs en cartes (« atouts ») avec icône, usages restants et texte en infobulle.
import { ID, CAMPS, EFFETS, VICTOIRES } from "../../logique/constantes.mjs";
import { t, roleDe, campDe, amoureuxDe, protectionsDe, metierDe, libelleCamp, libelleRepere, maisonNumerotee, lireEtat, roleVisible } from "../donnees.mjs";
import { mesSecrets } from "../prive.mjs";
import { estMJActif } from "../canal.mjs";

// Les champs SECRETS de la fiche (0.9.0) : ils ne vivent pas dans le document, mais dans les secrets du MJ actif. Le formulaire
// du MJ les nomme « secret.* » ; à l'envoi, ils partent à game.lakourLoups.reglerFiche (jamais au document).
const CHAMPS_SECRETS = ["camp", "amoureux", "protections"];

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
    if (s.nuit.tantQueMeuteEntiere) marque("nuit", "fa-paw", t("LAKOUR_LOUPS.Role.TantQueMeuteEntiere"));
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
    // Rôle, camp, amoureux, protections : ce que CE navigateur sait (donnees.mjs) — le MJ actif, ses secrets ; le joueur, sa fiche.
    const role = roleDe(a), metier = metierDe(a);
    const camp = campDe(a), amoureux = amoureuxDe(a), protections = protectionsDe(a);
    const sienne = Boolean(s.joueur) && s.joueur === game.user.id;
    // La prime n'est pas dans l'état public : le MJ actif la connaît, le joueur la tient de son carnet secret.
    const prime = gm ? etat.primes?.[a.id] ?? "" : (sienne ? mesSecrets().prime : "");
    const amoureuxNom = (sienne || gm) && amoureux ? game.actors.get(amoureux)?.name ?? "" : "";
    // Un joueur ne reçoit jamais le document entier : seulement les champs publics.
    const { document: _document, model: _modele, source: _source, ...publics } = contexte;
    const insigne = (classe, icone, texte, bulle = "") => ({ classe, icone, texte, bulle });
    const etats = [
      s.vivant ? insigne("vivant", "fa-heart-pulse", t("LAKOUR_LOUPS.Fiche.Vivant")) : insigne("mort", "fa-cross", t("LAKOUR_LOUPS.Table.Mort")),
      s.revele && insigne("revele", "fa-eye", t("LAKOUR_LOUPS.Fiche.Revele")),
      s.silence && insigne("silence", "fa-comment-slash", t("LAKOUR_LOUPS.Table.Silence")),
      s.vivant && etat.bailli?.actif && etat.bailli.acteurId === a.id && insigne("bailli", "fa-stamp", t("LAKOUR_LOUPS.Bailli.Titre"), t("LAKOUR_LOUPS.Bailli.Aide")),
      gm && protections > 0 && insigne("protege", "fa-shield-halved", t("LAKOUR_LOUPS.Fiche.Protege", { n: protections }), t("LAKOUR_LOUPS.Fiche.Protections")),
      amoureuxNom && insigne("amoureux", "fa-heart", amoureuxNom, t("LAKOUR_LOUPS.Fiche.Amoureux"))
    ].filter(Boolean);
    const vueRole = voitRole && role ? await atout(role, gm) : null;
    const vueMetier = metier ? await atout(metier, gm) : null;
    return {
      ...(gm ? contexte : publics),
      acteur: { id: a.id, uuid: a.uuid, name: a.name, img: a.img },
      system: gm ? s : { joueur: s.joueur, compagnon: s.compagnon, vivant: s.vivant, revele: s.revele, silence: s.silence, maison: s.maison, notes: s.notes },
      // La maison affichée dans la langue de Foundry (« House 7 ») ; le champ du MJ garde la clé (« Maison 7 »).
      maisonLibelle: libelleRepere(s.maison),
      maisonEtiquette: !maisonNumerotee(s.maison),   // « Maison 4 » seul, pas « Maison Maison 4 »
      // Les champs secrets, chez le MJ actif seulement (lui seul a les secrets ; un autre MJ ne les a pas).
      secret: estMJActif() ? { camp, amoureux, protections } : null,
      gm, proprietaire: sienne, voitRole,
      editable: this.isEditable,
      role: vueRole ? { ...vueRole, secret: Boolean(role.secret), uuid: role.uuid ?? "", camp: libelleCamp(role.system.camp), campCle: role.system.camp } : null,
      metier: vueMetier,
      campLibelle: voitRole ? libelleCamp(camp) : "",
      campCle: voitRole ? camp : "",
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

  // Un seul rôle et un seul métier : le nouveau remplace l'ancien. Seul le MJ ACTIF donne un rôle, et dans la fiche secrète
  // (game.lakourLoups.donnerRole), jamais sur le document.
  async _onDropItem(event, item) {
    if (!["role", "metier"].includes(item.type)) return super._onDropItem(event, item);
    if (!game.user.isGM || this.actor.uuid === item.parent?.uuid) return null;
    if (item.type === "role") {
      if (!estMJActif()) { ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.MJInactif")); return null; }
      try { await game.lakourLoups.donnerRole(this.actor.id, item.uuid); } catch (e) { ui.notifications.error(e.message); }
      return null;
    }
    const anciens = this.actor.items.filter(i => i.type === item.type).map(i => i.id);
    if (anciens.length) await this.actor.deleteEmbeddedDocuments("Item", anciens);
    return super._onDropItem(event, item);
  }

  // Le formulaire du MJ : les champs « secret.* » partent aux secrets (reglerFiche), le reste au document ; la case « Révélé »
  // cochée publie le rôle (game.lakourLoups.reveler).
  #secretsSaisis = null;
  _prepareSubmitData(event, form, formData, updateData) {
    const plat = formData?.object ?? {};
    const saisis = {};
    for (const champ of CHAMPS_SECRETS) {
      const cle = `secret.${champ}`;
      if (cle in plat) { saisis[champ] = plat[cle]; delete plat[cle]; }
    }
    this.#secretsSaisis = Object.keys(saisis).length ? saisis : null;
    return super._prepareSubmitData(event, form, formData, updateData);
  }

  async _processSubmitData(event, form, submitData, options) {
    const saisis = this.#secretsSaisis;
    this.#secretsSaisis = null;
    const revele = submitData?.system?.revele === true && !this.document.system.revele;
    if (revele) delete submitData.system.revele;
    await super._processSubmitData(event, form, submitData, options);
    // Un MJ qui n'est pas l'actif n'a pas les secrets : ni rôle, ni camp, ni « Révélé » ne passent par lui (il est prévenu).
    if (!estMJActif()) {
      if (revele || saisis) ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.MJInactif"));
      return;
    }
    try {
      if (saisis) {
        const actuel = { camp: campDe(this.document), amoureux: amoureuxDe(this.document), protections: protectionsDe(this.document) };
        const changes = {};
        if (saisis.camp !== undefined && saisis.camp !== actuel.camp && saisis.camp) changes.camp = saisis.camp;
        if (saisis.amoureux !== undefined && saisis.amoureux !== actuel.amoureux) changes.amoureux = saisis.amoureux;
        if (saisis.protections !== undefined && Number(saisis.protections) !== actuel.protections) changes.protections = Number(saisis.protections) || 0;
        if (Object.keys(changes).length) await game.lakourLoups.reglerFiche(this.document.id, changes);
      }
      if (revele) await game.lakourLoups.reveler(this.document.id);
    } catch (e) { ui.notifications.error(e.message); }
  }

  static #ouvrirObjet(event, cible) {
    // Le rôle révélé d'un autre se lit dans la carte et l'infobulle : sa fiche n'est ouverte qu'à qui peut la voir. Un rôle
    // secret (fiche du MJ, ou la sienne) n'est pas un objet du document : on ouvre le rôle d'origine (compendium), s'il est connu.
    const objet = this.document.items.get(cible.dataset.itemId);
    if (objet?.testUserPermission(game.user, "OBSERVER")) return objet.sheet.render({ force: true });
    const uuid = cible.dataset.uuid;
    if (!objet && uuid) fromUuid(uuid).then(d => d?.sheet?.render({ force: true })).catch(() => null);
  }

  static async #retirerObjet(event, cible) {
    if (!game.user.isGM) return;
    const objet = this.document.items.get(cible.dataset.itemId);
    if (objet) return objet.delete();
    // Le rôle secret : retiré de la fiche (MJ actif).
    if (cible.dataset.secret && !estMJActif()) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.MJInactif"));
    if (cible.dataset.secret) await game.lakourLoups.donnerRole(this.document.id, null);
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
      ...usagesDe(i), rythme: rythmeDe(i, gm), effetLibelle: gm ? libelleEffet(i.system.effet) : "",
      // Bâtiment : le repère de la carte affiché dans la langue de Foundry ; le champ du MJ garde la clé.
      repereLibelle: libelleRepere(i.system.repere ?? "")
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
