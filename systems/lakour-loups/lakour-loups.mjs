// Système « Les Veillées de Brumecombe » (lakour-loups) — point d'entrée.
// Contrat commun avec le module de contenu lakour-veillees et le MJ IA : docs/loups-contrat.md.
import { ID } from "./logique/constantes.mjs";
import { ModeleVillageois, ModeleRole, ModeleMetier, ModeleBatiment, ActeurLoups } from "./scripts/modeles.mjs";
import { enregistrerReglages } from "./scripts/reglages.mjs";
import { api, envoyerCarnet } from "./scripts/api.mjs";
import { ecouterSocket } from "./scripts/socket.mjs";
import { lireEtat, lirePublic, monVillageois, t } from "./scripts/donnees.mjs";
import { estMJActif, versMJ } from "./scripts/canal.mjs";
import { secretsPerdus } from "./scripts/secrets.mjs";
import { chargerPrive, mesSecrets } from "./scripts/prive.mjs";
import { carnetSecret } from "./scripts/apps/carnet.mjs";
import { tableDeJeu, ouvrirTable, cloreLeVote } from "./scripts/apps/table.mjs";
import { surveillerFinDuVote } from "./scripts/fin-du-vote.mjs";
import { signaler } from "./scripts/signal.mjs";
import { fenetreVote } from "./scripts/apps/vote.mjs";
import { FicheVillageois, FicheRole, FicheMetier, FicheBatiment } from "./scripts/apps/fiches.mjs";
import { brancherPlateau } from "./scripts/plateau.mjs";
import * as plateauLocal from "./scripts/plateau-local.mjs";
import { classeJetonLoups, rafraichirJetons, animerHalos } from "./scripts/jeton.mjs";
import { bandeauAction, rafraichirBandeau } from "./scripts/apps/bandeau.mjs";
import { surReponse } from "./scripts/apps/choix.mjs";
import { brancherParole } from "./scripts/parole.mjs";
import { brancherInfobulle } from "./scripts/infobulle.mjs";
import { brancherSalons, rafraichirSalons } from "./scripts/salons.mjs";
import { brancherImmersion } from "./scripts/immersion.mjs";

// ------------------------------------------------------------------ rafraîchissement des fenêtres
let voteEtaitOuvert = false;
function quandEtatChange() {
  if (!game.ready) return;
  const etat = lireEtat();
  // Une nouvelle partie : le carnet secret de ce navigateur repart de zéro.
  if (!game.user.isGM && etat.partie !== mesSecrets().partie) chargerPrive(etat.partie);
  const table = tableDeJeu();
  if (table.rendered) table.render();
  const vote = fenetreVote();
  const moi = monVillageois();
  if (etat.vote.ouvert) {
    // Le vote s'ouvre : chaque vivant l'entend (tintement chez lui seul), même s'il regarde ailleurs.
    if (!voteEtaitOuvert && moi?.system.vivant) signaler(t("LAKOUR_LOUPS.Signal.Vote"));
    // Le vote s'ouvre : chaque joueur vivant vote sur la carte (bandeau, clic sur un jeton) ; sans carte, ou s'il l'a
    // choisi (réglage « plateauInteractif »), il voit la fenêtre de vote et la Table de jeu.
    if (!voteEtaitOuvert && moi?.system.vivant && !plateauLocal.plateauInteractif([moi.id])) {
      vote.render({ force: true });
      if (!table.rendered) ouvrirTable();
    } else if (vote.rendered) vote.render();
  } else if (vote.rendered) vote.close();
  voteEtaitOuvert = etat.vote.ouvert;
  // Chez le MJ actif, le vote à minuteur se clôt de lui-même à zéro.
  surveillerFinDuVote(cloreLeVote);
  for (const appli of foundry.applications.instances.values()) {
    if (appli instanceof FicheVillageois && appli.rendered) appli.render();
  }
  rafraichirPlateauLocal();
}

// Le bandeau et les surimpressions des jetons suivent l'état (public, et local au joueur).
function rafraichirPlateauLocal() {
  if (!game.ready) return;
  rafraichirBandeau();
  rafraichirJetons();
}

// Ce que le MJ a envoyé à ce seul navigateur (carnet, prime, accusé de vote) : on rafraîchit ce qui l'affiche.
Hooks.on("lakourLoups.prive", () => {
  if (!game.ready) return;
  rafraichirPlateauLocal();
  if (carnetSecret().rendered) carnetSecret().render();
  if (tableDeJeu().rendered) tableDeJeu().render();
  if (fenetreVote().rendered) fenetreVote().render();
  for (const appli of foundry.applications.instances.values()) {
    if (appli instanceof FicheVillageois && appli.rendered) appli.render();
  }
});

// ------------------------------------------------------------------ init
Hooks.once("init", () => {
  CONFIG.Actor.documentClass = ActeurLoups;
  CONFIG.Actor.dataModels.villageois = ModeleVillageois;
  CONFIG.Item.dataModels.role = ModeleRole;
  CONFIG.Item.dataModels.metier = ModeleMetier;
  CONFIG.Item.dataModels.batiment = ModeleBatiment;
  CONFIG.Actor.trackableAttributes = { villageois: { bar: [], value: [] } };
  // Le jeton des villageois : clic au plateau, surimpressions locales, ni HUD ni glisser pour les joueurs (scripts/jeton.mjs).
  CONFIG.Token.objectClass = classeJetonLoups(CONFIG.Token.objectClass);

  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet(ID, FicheVillageois, { types: ["villageois"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Villageois" });
  Items.registerSheet(ID, FicheRole, { types: ["role"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Role" });
  Items.registerSheet(ID, FicheMetier, { types: ["metier"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Metier" });
  Items.registerSheet(ID, FicheBatiment, { types: ["batiment"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Batiment" });

  enregistrerReglages(quandEtatChange);
  brancherPlateau();
  brancherParole();
  brancherInfobulle();
  brancherSalons();
  brancherImmersion();   // brume, lueurs, tremblement (v14), chez chaque client
  foundry.applications.handlebars.loadTemplates([`systems/${ID}/templates/carte-role.hbs`]);
});

// ------------------------------------------------------------------ prêt : API, socket
Hooks.once("setup", () => {
  game.lakourLoups = api;
});

Hooks.once("ready", () => {
  game.lakourLoups = api;
  ecouterSocket();
  // Secrets : le joueur relit son carnet (localStorage) et demande au MJ actif de le compléter ; le MJ actif vérifie
  // qu'il a bien les secrets de la partie en cours (ils ne vivent que dans SON navigateur).
  chargerPrive(lirePublic().partie);
  if (!game.user.isGM) versMJ({ type: "bonjour" });
  else if (estMJActif() && secretsPerdus(lirePublic())) ui.notifications.warn(t("LAKOUR_LOUPS.Table.SecretsPerdus"), { permanent: true });
  voteEtaitOuvert = false;
  // Le plateau local : la fenêtre de secours qui répond éteint la carte ; tout changement local redessine bandeau et jetons.
  surReponse(id => plateauLocal.oublierDemande(id));
  plateauLocal.surChangement(rafraichirPlateauLocal);
  bandeauAction().render({ force: true });
  quandEtatChange();
  // Les salons vocaux : le MJ actif calcule la matrice et envoie à chacun sa ligne (les joueurs la demandent par « bonjour »).
  if (estMJActif()) rafraichirSalons({ forcer: true });
  Hooks.callAll("lakourLoups.pret", api);
});

// Le canevas est prêt (ou change de scène) : le bandeau sait si l'on agit par la carte ; les halos respirent.
Hooks.on("canvasReady", () => {
  animerHalos();
  rafraichirPlateauLocal();
});

// Ma ligne des salons vocaux a changé (ce que la voix de Foundry me laisse dire et entendre) : le bandeau l'affiche.
Hooks.on("lakourLoups.salon", () => rafraichirPlateauLocal());

// Le dépouillement : les voix publiques en bulles au-dessus des jetons, quelques secondes.
Hooks.on("lakourLoups.voteClos", resultat => {
  if (resultat?.decompte) plateauLocal.montrerBulles(resultat.decompte);
});

// Une nouvelle partie : tout ce qui était local s'efface, le bandeau l'annonce.
Hooks.on("lakourLoups.nouvellePartie", () => {
  plateauLocal.remettreAZero();
  plateauLocal.annoncer(game.i18n.localize("LAKOUR_LOUPS.Bandeau.NouvellePartie"));
});

// Un joueur qui se connecte en cours de partie reçoit son carnet secret du MJ actif.
Hooks.on("userConnected", (user, connecte) => {
  if (connecte && !user.isGM && estMJActif()) envoyerCarnet(user.id);
});

// Un villageois créé à la main : jeton lié, neutre.
Hooks.on("preCreateActor", (acteur, donnees) => {
  if (acteur.type !== "villageois") return;
  acteur.updateSource({ "prototypeToken.actorLink": true, "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.NEUTRAL });
});

// Les fiches de villageois suivent les changements de leurs objets (rôle échangé, usages).
for (const evenement of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(evenement, item => {
    if (item.parent?.type === "villageois" && tableDeJeu().rendered) tableDeJeu().render();
  });
}
Hooks.on("updateActor", acteur => {
  if (acteur.type !== "villageois") return;
  if (tableDeJeu().rendered) tableDeJeu().render();
  rafraichirPlateauLocal();
});

// ------------------------------------------------------------------ bouton de la Table de jeu (calque Jetons)
Hooks.on("getSceneControlButtons", controles => {
  const jetons = controles.tokens ?? controles.token;
  if (!jetons?.tools) return;
  jetons.tools.lakourLoupsTable = {
    name: "lakourLoupsTable",
    title: "LAKOUR_LOUPS.Table.Titre",
    icon: "fa-solid fa-fire-flame-curved",
    order: Object.keys(jetons.tools).length,
    button: true,
    visible: true,
    onChange: () => ouvrirTable()
  };
});

// La Table du MJ suit les réveils de la nuit, l'arrivée du point des compagnons IA (MJ IA) et les joueurs IA ajoutés ou retirés.
for (const evenement of ["lakourLoups.reveil", "lakourLoups.compagnons", "createActor", "deleteActor"]) {
  Hooks.on(evenement, () => {
    if (game.ready && tableDeJeu().rendered) tableDeJeu().render();
    if (game.ready && game.user.isGM) rafraichirBandeau();
  });
}
