// Fenêtre de vote : s'ouvre chez chaque joueur vivant quand le vote est ouvert, se ferme à la clôture.
// Objet : l'exécution, l'asile de la Chapelle ou l'élection du Bailli. On peut changer d'avis tant que le vote est ouvert ; les voix restent secrètes jusqu'à la clôture : l'état public ne dit que
// QUI a voté (vote.exprimes) ; son propre choix, le joueur le tient de lui-même et de l'accusé du MJ (prive.mjs).
import { ID } from "../../logique/constantes.mjs";
import * as L from "../../logique/index.mjs";
import { lireEtat, monVillageois, metierDe, t } from "../donnees.mjs";
import { envoyerVote } from "../api.mjs";
import { monVote } from "../prive.mjs";
import { ouvrirTable } from "./table.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FenetreVote extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-vote`,
    classes: [ID, "loups-fenetre", "loups-vote"],
    window: { title: "LAKOUR_LOUPS.Vote.Titre", icon: "fa-solid fa-scale-balanced" },
    position: { width: 560, height: "auto" },
    actions: { voter: FenetreVote.#voter, abstenir: FenetreVote.#abstenir, table: () => ouvrirTable() }
  };

  static PARTS = { corps: { template: `systems/${ID}/templates/vote.hbs` } };

  async _prepareContext() {
    const etat = lireEtat();
    const v = etat.vote;
    const moi = monVillageois();
    const monChoix = !moi ? "" : game.user.isGM ? v.votes[moi.id] ?? "" : monVote(v.numero);
    const vivants = game.actors.filter(a => a.type === "villageois" && a.system.vivant);
    return {
      ouvert: v.ouvert, double: v.double, majoriteAbsolue: v.majoriteAbsolue, chapelle: v.objet === "chapelle", bailli: v.objet === "bailli",
      // Le Bailli vote : sa voix compte double au vote d'exécution (public).
      voixDouble: v.objet === "execution" && Boolean(moi) && etat.bailli?.actif && etat.bailli.acteurId === moi.id
        && Boolean(L.poidsDesVoix(etat)[moi.id]),
      // Un mort vote encore de son Dernier souffle (vote d'exécution) ; jour de foire : à main levée, les voix sont publiques.
      peutVoter: Boolean(v.ouvert && moi && (moi.system.vivant || L.peutSouffler(etat, { id: moi.id, vivant: false }))),
      souffle: Boolean(moi && !moi.system.vivant && v.ouvert), mainLevee: Boolean(v.mainLevee),
      moi: moi?.name ?? "",
      aVote: Boolean(monChoix),
      // Les vivants qui ont voté ; les souffles des morts, à part.
      exprimes: v.exprimes.filter(id => vivants.some(a => a.id === id)).length, votants: vivants.length,
      souffles: v.exprimes.filter(id => !vivants.some(a => a.id === id)).length,
      candidats: v.candidats.map(id => game.actors.get(id)).filter(Boolean).map(a => ({
        id: a.id, nom: a.name, img: a.img, maison: a.system.maison, metier: metierDe(a)?.name ?? "",
        choisi: a.id === monChoix, moi: a.id === moi?.id
      })),
      monChoixNom: monChoix ? game.actors.get(monChoix)?.name ?? "" : t("LAKOUR_LOUPS.Vote.Personne")
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    clearInterval(this._minuterie);
    const zone = this.element.querySelector(".loups-minuteur");
    const tic = () => {
      const finit = lireEtat().vote.finit;
      if (!zone) return;
      if (!finit) { zone.textContent = "—"; return; }
      const reste = Math.max(0, Math.ceil((finit - Date.now()) / 1000));
      zone.textContent = reste ? `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}` : t("LAKOUR_LOUPS.Vote.TempsEcouleCourt");
      zone.classList.toggle("urgent", reste > 0 && reste <= 15);
    };
    tic();
    this._minuterie = setInterval(tic, 1000);
  }

  async _onClose(options) {
    clearInterval(this._minuterie);
    return super._onClose(options);
  }

  static #voter(event, cible) {
    envoyerVote(cible.dataset.id);
  }

  static #abstenir() {
    envoyerVote("");
  }
}

let fenetre = null;
export function fenetreVote() {
  fenetre ??= new FenetreVote();
  return fenetre;
}
