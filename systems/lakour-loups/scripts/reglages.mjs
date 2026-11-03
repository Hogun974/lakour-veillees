// Réglages du système.
import { ID, CHANCE_PESTE } from "../logique/constantes.mjs";
import { etatInitial } from "../logique/etat.mjs";
import { oublierSecrets } from "./secrets.mjs";
import { oublierPrive } from "./prive.mjs";
import { oublierSalons, quandReglageSalons } from "./salons.mjs";
import { oublierCoffre, surCoffreChange } from "./coffre.mjs";

export function enregistrerReglages(quandEtatChange) {
  oublierSecrets();
  oublierCoffre();
  oublierPrive();
  oublierSalons();
  // L'état de la partie (contrat §1). Écrit seulement par le MJ actif.
  game.settings.register(ID, "partie", {
    scope: "world", config: false, type: Object, default: etatInitial(),
    onChange: valeur => quandEtatChange?.(valeur)
  });
  // Les secrets de la partie chez le MJ actif, et le carnet secret d'un joueur : portée « client », donc rangés dans
  // le navigateur (localStorage) et jamais envoyés au serveur ni aux autres joueurs (voir secrets.mjs et prive.mjs).
  // Un loup-garou ne se reprend pas : à chaque lancement du monde, la partie repart de zéro (lancement.mjs). Le dernier
  // lancement traité (game.world.lastPlayed) évite d'effacer une partie quand le MJ recharge simplement la page.
  game.settings.register(ID, "repartirAZero", {
    name: "LAKOUR_LOUPS.Reglages.RepartirAZero.Nom", hint: "LAKOUR_LOUPS.Reglages.RepartirAZero.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "lancementTraite", { scope: "world", config: false, type: String, default: "" });
  // Rangés par [monde][userId] (0.9.0) : « secrets » n'est lu que par un MJ, pour lui-même ; « carnet » par son seul joueur.
  game.settings.register(ID, "secrets", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "carnet", { scope: "client", config: false, type: Object, default: {} });
  // Le coffre des secrets (coffre.mjs) : chiffré avec la clé du coffre du MJ IA, livré à tous, illisible sans elle ; écrit
  // seulement aux moments publics et à intervalle fixe (jamais au rythme des choix de nuit).
  // Un coffre plus récent que les secrets du MJ actif (scellé par un autre MJ) : il le rouvre (coffre.mjs, surCoffreChange).
  game.settings.register(ID, "coffre", { scope: "world", config: false, type: Object, default: {}, onChange: () => surCoffreChange() });
  // Avant 0.9.0 : l'ancienne clé du MJ (relue une fois pour la migration d'une partie en cours, puis effacée) et l'ancienne part
  // d'un joueur (effacée : elle ne sert plus).
  game.settings.register(ID, "cleCoffre", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "partCoffre", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(ID, "revelerALaMort", {
    name: "LAKOUR_LOUPS.Reglages.RevelerALaMort.Nom", hint: "LAKOUR_LOUPS.Reglages.RevelerALaMort.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "mortsVoientTout", {
    name: "LAKOUR_LOUPS.Reglages.MortsVoientTout.Nom", hint: "LAKOUR_LOUPS.Reglages.MortsVoientTout.Aide",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => { quandEtatChange?.(); quandReglageSalons(); }
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
  // Les morts parlent entre eux (et au MJ) : leurs messages deviennent des chuchotements aux seuls morts (scripts/parole.mjs).
  game.settings.register(ID, "canalDesMorts", {
    name: "LAKOUR_LOUPS.Reglages.CanalDesMorts.Nom", hint: "LAKOUR_LOUPS.Reglages.CanalDesMorts.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  // Salons vocaux (voix intégrée de Foundry, A/V) : la nuit, seuls les loups se parlent ; les morts ne parlent qu'aux morts ;
  // un réduit au silence se tait pendant le débat et le vote (scripts/salons.mjs). Décoché : tout le monde parle à tout le monde.
  game.settings.register(ID, "salonsAutomatiques", {
    name: "LAKOUR_LOUPS.Reglages.SalonsAutomatiques.Nom", hint: "LAKOUR_LOUPS.Reglages.SalonsAutomatiques.Aide",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => quandReglageSalons()
  });
  // Agir par la carte (bandeau et clics sur les jetons) ; sinon, les fenêtres de choix et de vote s'ouvrent comme avant.
  game.settings.register(ID, "plateauInteractif", {
    name: "LAKOUR_LOUPS.Reglages.PlateauInteractif.Nom", hint: "LAKOUR_LOUPS.Reglages.PlateauInteractif.Aide",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => quandEtatChange?.()
  });
  // Le tintement (et le titre qui clignote) quand un choix secret ou un vote attend ce joueur (scripts/signal.mjs).
  game.settings.register(ID, "signalTour", {
    name: "LAKOUR_LOUPS.Reglages.SignalTour.Nom", hint: "LAKOUR_LOUPS.Reglages.SignalTour.Aide",
    scope: "client", config: true, type: Boolean, default: true
  });
  // Rôles et bâtiments des dernières parties (jamais qui avait quoi), pour varier les compositions (nouvellePartie).
  game.settings.register(ID, "historique", { scope: "world", config: false, type: Array, default: [] });
  // La chance qu'une partie composée d'elle-même devienne une peste noire (logique/peste.mjs) : CHANCE_PESTE (1 sur 30),
  // sans réglage visible (la fréquence n'est dite nulle part). Les essais la mettent à 0 pour des parties reproductibles.
  game.settings.register(ID, "chancePeste", { scope: "world", config: false, type: Number, default: CHANCE_PESTE });
  // Les veillées finies, racontées dans le journal des Chroniques (scripts/chroniques.mjs) : les 50 dernières.
  game.settings.register(ID, "chroniques", { scope: "world", config: false, type: Array, default: [] });
  // Le Bailli (logique/bailli.mjs) : élu le premier jour, voix double, il tranche les égalités et désigne son successeur. Oui par
  // défaut : une règle publique, sans secret, qui donne du poids au premier débat et règle les égalités sans revote ; sans
  // narrateur qui l'organise (MJ IA), la charge reste simplement vacante. Lu à la distribution (etat.bailli.actif).
  game.settings.register(ID, "bailli", {
    name: "LAKOUR_LOUPS.Reglages.Bailli.Nom", hint: "LAKOUR_LOUPS.Reglages.Bailli.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  // Les Masques de veillée (logique/masques.mjs) : deux ou trois rôles du Village absents, remis en secret à la meute. Oui par
  // défaut : la meute, qui doit mentir sans filet face aux rôles d'information, y gagne un alibi sûr ; rien n'en paraît au village.
  game.settings.register(ID, "masques", {
    name: "LAKOUR_LOUPS.Reglages.Masques.Nom", hint: "LAKOUR_LOUPS.Reglages.Masques.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  // Le Dernier souffle (logique/souffle.mjs) : chaque mort garde une voix, pour un vote d'exécution. Oui par défaut : un mort reste
  // dans la veillée jusqu'au bout, et sa voix unique est publique au dépouillement (le Registre la garde).
  game.settings.register(ID, "dernierSouffle", {
    name: "LAKOUR_LOUPS.Reglages.DernierSouffle.Nom", hint: "LAKOUR_LOUPS.Reglages.DernierSouffle.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  // L'Almanach des brumes (logique/almanach.mjs) : un présage tiré à chaque aube change la règle du jour. Non par défaut : une
  // variante, pour les tables qui connaissent déjà le jeu.
  game.settings.register(ID, "almanach", {
    name: "LAKOUR_LOUPS.Reglages.Almanach.Nom", hint: "LAKOUR_LOUPS.Reglages.Almanach.Aide",
    scope: "world", config: true, type: Boolean, default: false
  });
  // Les Gens de passage (logique/passage.mjs) : un joueur qui arrive en cours de partie entre avec un rôle public et un camp
  // secret. Oui par défaut : sans lui, un retardataire attend la partie suivante.
  game.settings.register(ID, "gensDePassage", {
    name: "LAKOUR_LOUPS.Reglages.GensDePassage.Nom", hint: "LAKOUR_LOUPS.Reglages.GensDePassage.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
  // Le Banc des accusés (logique/banc.mjs, variante) : accusations, puis jugements un par un. Non par défaut.
  game.settings.register(ID, "banc", {
    name: "LAKOUR_LOUPS.Reglages.Banc.Nom", hint: "LAKOUR_LOUPS.Reglages.Banc.Aide",
    scope: "world", config: true, type: Boolean, default: false
  });
  // Le Glas du deuil (logique/deuil.mjs, variante) : chaque innocent exécuté renforce la meute. Non par défaut.
  game.settings.register(ID, "glasDuDeuil", {
    name: "LAKOUR_LOUPS.Reglages.GlasDuDeuil.Nom", hint: "LAKOUR_LOUPS.Reglages.GlasDuDeuil.Aide",
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(ID, "annoncesEnChat", {
    name: "LAKOUR_LOUPS.Reglages.AnnoncesEnChat.Nom", hint: "LAKOUR_LOUPS.Reglages.AnnoncesEnChat.Aide",
    scope: "world", config: true, type: Boolean, default: true
  });
}

export const reglage = cle => game.settings.get(ID, cle);
