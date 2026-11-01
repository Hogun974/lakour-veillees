// Fiches du système : villageois (rôle visible seulement du propriétaire et du MJ), rôle, métier, bâtiment.
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

// ------------------------------------------------------------------ villageois
export class FicheVillageois extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [ID, "loups-fiche", "loups-fiche-villageois"],
    position: { width: 600, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { ouvrirObjet: FicheVillageois.#ouvrirObjet, retirerObjet: FicheVillageois.#retirerObjet }
  };

  static PARTS = { fiche: { template: `systems/${ID}/templates/fiche-villageois.hbs`, scrollable: [".loups-corps"] } };

  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const a = this.document;
    const gm = game.user.isGM;
    const voitRole = lireEtat().phase === "fin" || roleVisible(a);
    const role = roleDe(a), metier = metierDe(a);
    // La prime n'est pas dans l'état public : le MJ actif la connaît, le joueur la tient de son carnet secret.
    const prime = gm ? lireEtat().primes?.[a.id] ?? "" : (a.isOwner && a.system.joueur === game.user.id ? mesSecrets().prime : "");
    return {
      ...contexte,
      acteur: a, system: a.system, gm, proprietaire: a.isOwner, voitRole,
      editable: this.isEditable,
      role: voitRole && role ? {
        id: role.id, nom: role.name, img: role.img, camp: libelleCamp(role.system.camp),
        description: await enrichir(role.system.description, role),
        victoire: role.system.victoire ? await enrichir(role.system.victoire, role) : "",
        usages: role.system.usages.max > 0 ? `${role.system.usages.restant} / ${role.system.usages.max}` : ""
      } : null,
      metier: metier ? { id: metier.id, nom: metier.name, img: metier.img, description: await enrichir(metier.system.description, metier),
        usages: metier.system.usages.max > 0 ? `${metier.system.usages.restant} / ${metier.system.usages.max}` : "" } : null,
      campLibelle: voitRole ? libelleCamp(a.system.camp) : "",
      camps: choixCamps(),
      joueurs: Object.fromEntries([["", t("LAKOUR_LOUPS.Fiche.Personne")], ...game.users.filter(u => !u.isGM).map(u => [u.id, u.name])]),
      joueurNom: game.users.get(a.system.joueur)?.name ?? t(a.system.compagnon ? "LAKOUR_LOUPS.Fiche.Compagnon" : "LAKOUR_LOUPS.Fiche.Personne"),
      autres: Object.fromEntries([["", "—"], ...game.actors.filter(x => x.type === "villageois" && x.id !== a.id).map(x => [x.id, x.name])]),
      amoureuxNom: (a.isOwner || gm) && a.system.amoureux ? game.actors.get(a.system.amoureux)?.name ?? "" : "",
      prime: prime ? game.actors.get(prime)?.name ?? "" : "",
      notesEnrichies: await enrichir(a.system.notes, a)
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
    this.document.items.get(cible.dataset.itemId)?.sheet.render({ force: true });
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
    position: { width: 560, height: 640 },
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
    const enrichis = {};
    for (const champ of ["description", "victoire", "regle"]) if (champ in i.system) enrichis[champ] = await enrichir(i.system[champ], i);
    return { ...contexte, objet: i, system: i.system, editable: this.isEditable, gm: game.user.isGM, enrichis, effets: choixEffets(i.system.effet) };
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
