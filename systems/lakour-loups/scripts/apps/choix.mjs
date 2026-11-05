// Fenêtre de choix : s'ouvre chez le seul joueur concerné. Invite, candidats, « Valider », « Passer ».
// Fermer la fenêtre ou laisser filer le délai revient à passer.
// - demande de nuit (du MJ, par socket) : la réponse repart au MJ actif seul ;
// - demande.mode === "texte" : une phrase à écrire (le mot que portera le Messager) ;
// - ouvrirChoixLocal(demande, rappel) : un choix fait chez soi (cible d'un pouvoir de jour), rendu à `rappel`.
// - ouvrirChoix(demande, { secours: true }) : la même demande, alors qu'elle est déjà sur la carte (plateau-local.mjs) ;
//   fermer cette fenêtre-là ne passe pas : on peut encore choisir sur la carte.
import { ID } from "../../logique/constantes.mjs";
import { libelleRepere } from "../donnees.mjs";
import { envoyerReponse } from "../api.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const ouvertes = new Map();
// Prévenu quand une fenêtre a répondu à une demande (la carte s'éteint alors : plateau-local.mjs).
let quandRepondu = null;
export function surReponse(fn) { quandRepondu = typeof fn === "function" ? fn : null; }
// Toutes les fenêtres de choix ouvertes (demandes et choix locaux) : un choix secret est en cours (scripts/activite.mjs).
const enCours = new Set();
const ecouteursEnCours = new Set();
export const choixEnCours = () => enCours.size > 0;
export function surChoixEnCours(fn) { ecouteursEnCours.add(fn); return () => ecouteursEnCours.delete(fn); }
function suivre(f, ouverte) {
  const avant = enCours.size > 0;
  if (ouverte) enCours.add(f);
  else enCours.delete(f);
  if (avant === enCours.size > 0) return;
  for (const fn of ecouteursEnCours) { try { fn(enCours.size > 0); } catch (e) { console.warn(`${ID} | choix`, e); } }
}

export class FenetreChoix extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(demande, options = {}) {
    super({ ...options, id: `${ID}-choix-${demande.id}` });
    this.demande = demande;
    this.rappel = typeof options.rappel === "function" ? options.rappel : null;
    this.secours = Boolean(options.secours);
    this.selection = new Set();
    this.repondu = false;
    this.annulee = false;
  }

  static DEFAULT_OPTIONS = {
    classes: [ID, "loups-fenetre", "loups-choix"],
    tag: "form",
    window: { title: "LAKOUR_LOUPS.Choix.Titre", icon: "fa-solid fa-moon" },
    position: { width: 480, height: "auto" },
    form: { handler: FenetreChoix.#valider, closeOnSubmit: true },
    actions: { basculer: FenetreChoix.#basculer, passer: FenetreChoix.#passer }
  };

  static PARTS = { corps: { template: `systems/${ID}/templates/choix.hbs` } };

  async _prepareContext() {
    const d = this.demande;
    const texte = d.mode === "texte";
    return {
      acteurNom: d.acteurNom, invite: d.invite, nombre: d.nombre, plusieurs: d.nombre > 1, texte, max: d.max ?? 200,
      // La maison du candidat vient de la demande (clé « Maison 7 ») : affichée dans la langue de ce navigateur.
      candidats: d.candidats.map(c => ({ ...c, maison: libelleRepere(c.maison), choisi: this.selection.has(c.id) })),
      choisis: this.selection.size, peutValider: texte || this.selection.size > 0, minuteur: Boolean(d.finit)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    clearInterval(this._minuterie);
    if (!this.demande.finit) return;
    const zone = this.element.querySelector(".loups-minuteur");
    const tic = () => {
      const reste = Math.max(0, Math.ceil((this.demande.finit - Date.now()) / 1000));
      if (zone) zone.textContent = `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`;
      if (reste <= 0) this.close();
    };
    tic();
    this._minuterie = setInterval(tic, 1000);
  }

  async _onClose(options) {
    clearInterval(this._minuterie);
    if (ouvertes.get(this.demande.id) === this) ouvertes.delete(this.demande.id);
    suivre(this, false);
    if (!this.repondu && !this.annulee && !this.secours) this.#repondre([], "");
    return super._onClose(options);
  }

  #repondre(cibles, texte) {
    if (this.repondu) return;
    this.repondu = true;
    if (this.rappel) this.rappel(cibles, texte);
    else {
      envoyerReponse(this.demande.id, cibles, texte);
      quandRepondu?.(this.demande.id);
    }
  }

  static #basculer(event, cible) {
    const id = cible.dataset.id;
    if (this.selection.has(id)) this.selection.delete(id);
    else {
      if (this.demande.nombre === 1) this.selection.clear();
      if (this.selection.size < this.demande.nombre) this.selection.add(id);
    }
    this.render();
  }

  static async #valider(event, form, donnees) {
    const texte = String(donnees?.object?.texte ?? form?.querySelector?.("textarea")?.value ?? "");
    this.#repondre([...this.selection], texte);
  }

  static async #passer() {
    this.#repondre([], "");
    await this.close();
  }
}

export function ouvrirChoix(demande, { secours = false } = {}) {
  const deja = ouvertes.get(demande.id);
  if (deja) { deja.annulee = true; deja.close(); }
  const f = new FenetreChoix(demande, { secours });
  ouvertes.set(demande.id, f);
  suivre(f, true);
  f.render({ force: true });
  return f;
}

// Un choix fait chez soi, sans socket (cible d'un pouvoir de jour) : rappel(cibles, texte), cibles [] si on passe.
export function ouvrirChoixLocal(demande, rappel) {
  const f = new FenetreChoix({ id: foundry.utils.randomID(), candidats: [], nombre: 1, ...demande }, { rappel });
  suivre(f, true);
  f.render({ force: true });
  return f;
}

export function fermerChoix(id) {
  const f = ouvertes.get(id);
  if (!f) return;
  f.annulee = true;
  f.close();
}
