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
import { tableDeJeu, ouvrirTable } from "./scripts/apps/table.mjs";
import { fenetreVote } from "./scripts/apps/vote.mjs";
import { FicheVillageois, FicheRole, FicheMetier, FicheBatiment } from "./scripts/apps/fiches.mjs";

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
    // Le vote s'ouvre : chaque joueur vivant voit la fenêtre de vote (et la Table de jeu).
    if (!voteEtaitOuvert && moi?.system.vivant) {
      vote.render({ force: true });
      if (!table.rendered) ouvrirTable();
    } else if (vote.rendered) vote.render();
  } else if (vote.rendered) vote.close();
  voteEtaitOuvert = etat.vote.ouvert;
  for (const appli of foundry.applications.instances.values()) {
    if (appli instanceof FicheVillageois && appli.rendered) appli.render();
  }
}

// Ce que le MJ a envoyé à ce seul navigateur (carnet, prime, accusé de vote) : on rafraîchit ce qui l'affiche.
Hooks.on("lakourLoups.prive", () => {
  if (!game.ready) return;
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

  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet(ID, FicheVillageois, { types: ["villageois"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Villageois" });
  Items.registerSheet(ID, FicheRole, { types: ["role"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Role" });
  Items.registerSheet(ID, FicheMetier, { types: ["metier"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Metier" });
  Items.registerSheet(ID, FicheBatiment, { types: ["batiment"], makeDefault: true, label: "LAKOUR_LOUPS.Fiche.Batiment" });

  enregistrerReglages(quandEtatChange);
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
  quandEtatChange();
  Hooks.callAll("lakourLoups.pret", api);
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
  if (acteur.type === "villageois" && tableDeJeu().rendered) tableDeJeu().render();
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
