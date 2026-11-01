// Réglages du système.
import { ID } from "../logique/constantes.mjs";
import { etatInitial } from "../logique/etat.mjs";
import { oublierSecrets } from "./secrets.mjs";
import { oublierPrive } from "./prive.mjs";

export function enregistrerReglages(quandEtatChange) {
  oublierSecrets();
  oublierPrive();
  // L'état de la partie (contrat §1). Écrit seulement par le MJ actif.
  game.settings.register(ID, "partie", {
    scope: "world", config: false, type: Object, default: etatInitial(),
    onChange: valeur => quandEtatChange?.(valeur)
  });
  // Les secrets de la partie chez le MJ actif, et le carnet secret d'un joueur : portée « client », donc rangés dans
  // le navigateur (localStorage) et jamais envoyés au serveur ni aux autres joueurs (voir secrets.mjs et prive.mjs).
  game.settings.register(ID, "secrets", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "carnet", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "revelerALaMort", {
    name: "LAKOUR_LOUPS.Reglages.RevelerALaMort.Nom", hint: "LAKOUR_LOUPS.Reglages.RevelerALaMort.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "mortsVoientTout", {
    name: "LAKOUR_LOUPS.Reglages.MortsVoientTout.Nom", hint: "LAKOUR_LOUPS.Reglages.MortsVoientTout.Aide",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => quandEtatChange?.()
  });
  game.settings.register(ID, "delaiChoix", {
    name: "LAKOUR_LOUPS.Reglages.DelaiChoix.Nom", hint: "LAKOUR_LOUPS.Reglages.DelaiChoix.Aide",
    scope: "world", config: true, type: Number, default: 90, range: { min: 10, max: 600, step: 5 }
  });
  game.settings.register(ID, "dureeVote", {
    name: "LAKOUR_LOUPS.Reglages.DureeVote.Nom", hint: "LAKOUR_LOUPS.Reglages.DureeVote.Aide",
    scope: "world", config: true, type: Number, default: 120, range: { min: 0, max: 900, step: 15 }
  });
  game.settings.register(ID, "chanceEpier", {
    name: "LAKOUR_LOUPS.Reglages.ChanceEpier.Nom", hint: "LAKOUR_LOUPS.Reglages.ChanceEpier.Aide",
    scope: "world", config: true, type: Number, default: 0.33, range: { min: 0, max: 1, step: 0.01 }
  });
  game.settings.register(ID, "annoncesEnChat", {
    name: "LAKOUR_LOUPS.Reglages.AnnoncesEnChat.Nom", hint: "LAKOUR_LOUPS.Reglages.AnnoncesEnChat.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
}

export const reglage = cle => game.settings.get(ID, cle);
