// Le carnet secret d'un joueur : son rôle, ce qu'il apprend la nuit, les mots que lui porte le Messager. Tout y arrive
// du MJ actif par le socket, adressé à ce seul joueur (jamais par le chat, que Foundry livre à tous les navigateurs).
import { ID } from "../../logique/constantes.mjs";
import { mesSecrets } from "../prive.mjs";
import { t } from "../donnees.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CarnetSecret extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-carnet`,
    classes: [ID, "loups-fenetre", "loups-carnet"],
    window: { title: "LAKOUR_LOUPS.Carnet.Titre", icon: "fa-solid fa-envelope-open-text", resizable: true },
    position: { width: 460, height: 560 }
  };

  static PARTS = { corps: { template: `systems/${ID}/templates/carnet.hbs`, scrollable: [".loups-carnet-liste"] } };

  async _prepareContext() {
    const echapper = s => foundry.utils.escapeHTML(String(s ?? ""));
    const s = mesSecrets();
    const prime = s.prime ? game.actors.get(s.prime)?.name ?? "" : "";
    return {
      prime,
      entrees: [...s.entrees].reverse().map(e => ({
        titre: e.titre ?? "", tour: e.tour ?? "", contenu: e.html ? e.html : `<p>${echapper(e.texte)}</p>`
      })),
      vide: !s.entrees.length, aide: t("LAKOUR_LOUPS.Carnet.Aide")
    };
  }
}

let carnet = null;
export function carnetSecret() {
  carnet ??= new CarnetSecret();
  return carnet;
}
export function ouvrirCarnet() {
  return carnetSecret().render({ force: true });
}
