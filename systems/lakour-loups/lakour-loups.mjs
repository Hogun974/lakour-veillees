// Système « Les Veillées de Brumecombe » (lakour-loups) — point d'entrée.
// Contrat commun avec le module de contenu lakour-veillees et le MJ IA : docs/loups-contrat.md.
import { ID } from "./logique/constantes.mjs";
import { ModeleVillageois, ModeleRole, ModeleMetier, ModeleBatiment, ActeurLoups } from "./scripts/modeles.mjs";
import { enregistrerReglages } from "./scripts/reglages.mjs";
import { api, envoyerCarnet } from "./scripts/api.mjs";
import { ecouterSocket } from "./scripts/socket.mjs";
import { lireEtat, lirePublic, monVillageois, t } from "./scripts/donnees.mjs";
import { estMJActif, versMJ } from "./scripts/canal.mjs";
import { secretsPerdus, migrerSecretsAnciens, garderSecrets } from "./scripts/secrets.mjs";
import {
  chercherSecrets, enAttenteDeParts, battre, surCoffreRouvert, oublierAnciennePart, coffreDisponible, secretsAJour, ecritureBloquee,
  devenirMJActif, perdreLaMain, surSecretsRetrouves
} from "./scripts/coffre.mjs";
import { brancherGarde } from "./scripts/garde.mjs";
import { chargerPrive, mesSecrets } from "./scripts/prive.mjs";
import { carnetSecret } from "./scripts/apps/carnet.mjs";
import { tableDeJeu, ouvrirTable, cloreLeVote } from "./scripts/apps/table.mjs";
import { surveillerFinDuVote } from "./scripts/fin-du-vote.mjs";
import { repartirAuLancement } from "./scripts/lancement.mjs";
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
import { brancherActivite, brancherCrochetsActivite, verifierActivite } from "./scripts/activite.mjs";

// ------------------------------------------------------------------ rafraîchissement des fenêtres
// Une fiche où l'on écrit (notes ouvertes dans l'éditeur, champ actif) n'est pas redessinée : le texte en cours serait perdu.
const enSaisie = appli => Boolean(appli.element?.querySelector?.("prose-mirror[open]") || appli.element?.contains?.(document.activeElement));
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
    // Un mort qui garde son Dernier souffle vote encore (vote d'exécution).
    const votant = Boolean(moi?.system.vivant) || Boolean(moi && api.peutSouffler(moi.id).ok);
    if (!voteEtaitOuvert && votant) signaler(t("LAKOUR_LOUPS.Signal.Vote"));
    // Le vote s'ouvre : chaque joueur vivant vote sur la carte (bandeau, clic sur un jeton) ; sans carte, ou s'il l'a
    // choisi (réglage « plateauInteractif »), il voit la fenêtre de vote et la Table de jeu.
    if (!voteEtaitOuvert && votant && !plateauLocal.plateauInteractif([moi.id])) {
      vote.render({ force: true });
      if (!table.rendered) ouvrirTable();
    } else if (vote.rendered) vote.render();
  } else if (vote.rendered) vote.close();
  voteEtaitOuvert = etat.vote.ouvert;
  // Chez le MJ actif, le vote à minuteur se clôt de lui-même à zéro.
  surveillerFinDuVote(cloreLeVote);
  for (const appli of foundry.applications.instances.values()) {
    if (appli instanceof FicheVillageois && appli.rendered && !enSaisie(appli)) appli.render();
  }
  rafraichirPlateauLocal();
}

// Le bandeau et les surimpressions des jetons suivent l'état (public, et local au joueur).
function rafraichirPlateauLocal() {
  if (!game.ready) return;
  verifierActivite();   // une demande de nuit, un pouvoir de jour en préparation : curseur et voyant masqués (scripts/activite.mjs)
  rafraichirBandeau();
  rafraichirJetons();
}

// Ce que le MJ a envoyé à ce seul navigateur (carnet, fiche, prime, accusé de vote) : on rafraîchit ce qui l'affiche. Chez le MJ
// actif, une fiche secrète changée (lakourLoups.fiches, local) fait de même, et l'attente des secrets qui commence ou finit
// (lakourLoups.secrets, local : l'alerte de la Table).
for (const crochet of ["lakourLoups.prive", "lakourLoups.fiches", "lakourLoups.secrets"]) Hooks.on(crochet, () => {
  if (!game.ready) return;
  rafraichirPlateauLocal();
  if (carnetSecret().rendered) carnetSecret().render();
  if (tableDeJeu().rendered) tableDeJeu().render();
  if (fenetreVote().rendered) fenetreVote().render();
  for (const appli of foundry.applications.instances.values()) {
    if (appli instanceof FicheVillageois && appli.rendered && !enSaisie(appli)) appli.render();
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
  brancherGarde();   // aucun joueur ne modifie un villageois ni ses objets (défense en profondeur : il n'en est qu'observateur)
  brancherInfobulle();
  brancherSalons();
  brancherImmersion();   // brume, lueurs, tremblement (v14), chez chaque client
  foundry.applications.handlebars.loadTemplates([`systems/${ID}/templates/carte-role.hbs`]);
  // {{loupsT "CLE" n=… nom=…}} : comme {{localize}} avec des données, mais avec l'élision et l'accord de t() (donnees.mjs).
  Handlebars.registerHelper("loupsT", (cle, options) => t(cle, { ...(options?.hash ?? {}) }));
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
  if (!game.user.isGM) {
    // Curseur, ping, règle, cibles, voyant « parle » : rien ne part la nuit, ni pendant un choix secret (scripts/activite.mjs).
    brancherCrochetsActivite();
    brancherActivite();
    versMJ({ type: "bonjour" });
    oublierAnciennePart();   // la part de l'ancien coffre (avant 0.9.0) ne sert plus
  } else if (estMJActif()) {
    // Le coffre est celui du MJ IA : il se branche à son propre « ready » (après celui du système).
    const quandCoffre = fn => (coffreDisponible() ? fn() : Hooks.once("lakour-mj-ia.pret", () => fn()));
    // Un nouveau lancement du monde remet le village à zéro ; sinon (simple rechargement), la partie en cours reste et l'on
    // vérifie que ce navigateur a bien ses secrets : sinon, on les reprend (anciens secrets de ce navigateur, coffre).
    repartirAuLancement(api).then(async remis => {
      const pub = lirePublic();
      if (!remis) {
        // Une partie commencée avant 0.9.0 : ses secrets rangés à l'ancienne dans ce navigateur, puis les fiches des documents.
        const anciens = await migrerSecretsAnciens(pub.partie);
        if (anciens && secretsPerdus(pub)) await garderSecrets(anciens);
        // Pas de secrets, ou plus vieux que le coffre (un autre MJ a scellé depuis) : on rouvre le coffre.
        if (pub.partie && pub.phase !== "fin" && !secretsAJour(pub.partie)) await quandCoffreAsync(quandCoffre, () => chercherSecrets(pub.partie, secretsRetrouves));
        const m = await api.migrer();
        if (m.fiches || m.documents) ui.notifications.info(t("LAKOUR_LOUPS.Table.Migration", { n: m.fiches }));
        // Ce qui attendait le Bailli (départage d'une égalité, succession) n'était qu'en mémoire : la page rechargée le reprend.
        api.reprendre();
      }
      if (remis || (!secretsPerdus(lirePublic()) && !ecritureBloquee())) return;
      if (!enAttenteDeParts()) {
        ui.notifications.warn(t("LAKOUR_LOUPS.Table.SecretsPerdus"), { permanent: true });
        return;
      }
      setTimeout(() => {
        if (enAttenteDeParts()) ui.notifications.warn(t("LAKOUR_LOUPS.Table.SecretsEnAttente"), { permanent: true });
      }, 15000);
    }).catch(e => console.error(`${ID} | village remis à zéro`, e));
  }
  if (game.user.isGM) {
    // Le coffre ne bat qu'au rythme public : à chaque moment public (api.mjs) et une fois par minute pendant une partie, chez le MJ
    // actif (vérifié à chaque battement : un autre MJ qui le devient prend le relais).
    battre();
    surSecretsRetrouves(secretsRetrouves);
    Hooks.on("lakour-mj-ia.coffreRouvert", () => { surCoffreRouvert().catch(e => console.warn(`${ID} | coffre`, e)); });
    // Le MJ actif change (un MJ se connecte ou part) : celui qui prend la main relit son navigateur et rouvre le coffre s'il n'est pas
    // à jour ; celui qui la perd scelle une dernière fois puis oublie ses secrets (ils seraient périmés à son retour).
    let etaisActif = estMJActif();
    Hooks.on("userConnected", () => {
      const actif = estMJActif();
      if (actif && !etaisActif) {
        devenirMJActif(secretsRetrouves).then(aJour => {
          if (!aJour) ui.notifications.warn(t(enAttenteDeParts() ? "LAKOUR_LOUPS.Table.SecretsEnAttente" : "LAKOUR_LOUPS.Table.SecretsPerdus"));
          quandEtatChange();
          rafraichirSalons({ forcer: true });
        }).catch(e => console.warn(`${ID} | coffre`, e));
      } else if (!actif && etaisActif) perdreLaMain().catch(e => console.warn(`${ID} | coffre`, e));
      etaisActif = actif;
    });
  }
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

// Attendre le coffre du MJ IA (au plus quelques secondes : sans lui, on n'attend pas pour rien).
function quandCoffreAsync(quandCoffre, fn) {
  return new Promise(resolve => {
    const minuterie = setTimeout(() => resolve(false), 10000);
    quandCoffre(async () => { clearTimeout(minuterie); try { resolve(await fn()); } catch (e) { console.warn(`${ID} | coffre`, e); resolve(false); } });
  });
}

// Les secrets de la partie, repris du coffre : la Table, les fiches et les salons vocaux les retrouvent.
function secretsRetrouves() {
  ui.notifications.info(t("LAKOUR_LOUPS.Table.SecretsRetrouves"));
  quandEtatChange();
  rafraichirSalons({ forcer: true });
}

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
