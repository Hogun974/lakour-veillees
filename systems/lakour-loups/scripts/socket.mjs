// Socket « system.lakour-loups ». Chaque message a ses destinataires (recipients, voir canal.mjs) ; l'auteur est
// l'identifiant donné par le serveur, pas ce que le message prétend.
//   MJ -> un joueur : { type: "demande", id, destinataire, acteurId, invite, candidats, nombre, delai, finit, mode? ("texte"), max? }
//                     { type: "annuler", id }
//                     { type: "secret", partie, entree }          une entrée de son carnet secret
//                     { type: "carnet", partie, acteurId, entrees, prime, vote }   tout son carnet (connexion, rechargement)
//                     { type: "monVote", partie, numero, cible }  accusé de son vote
//                     { type: "avis", texte }                     refus (pouvoir de jour impossible, vote hors délai)
//   joueur -> MJ actif : { type: "reponse", id, cibles, texte, userId }
//                        { type: "vote", votant, cible, userId }
//                        { type: "jour", acteurId, pouvoir, cibles, texte, userId }
//                        { type: "bonjour", userId }             « renvoie-moi mon carnet »
//   MJ -> tous : { type: "hook", nom, args }  (arguments publics seulement)
import { CANAL } from "../logique/constantes.mjs";
import { estMJActif, auteur, vientDUnMJ } from "./canal.mjs";
import { recevoirReponse, recevoirVote, recevoirJour, envoyerCarnet } from "./api.mjs";
import { recevoirSecret, recevoirCarnet, noterMonVote } from "./prive.mjs";
import { ouvrirChoix, fermerChoix } from "./apps/choix.mjs";
import { ouvrirCarnet } from "./apps/carnet.mjs";

// Traite un message reçu. emetteur : l'identifiant de l'auteur donné par le serveur (second argument du socket).
export function traiterMessage(message, emetteur) {
  if (!message || typeof message.type !== "string") return false;
  const qui = auteur(message, emetteur);
  if (qui === null) return false;   // le message se fait passer pour un autre
  const pourMoi = { ...message, userId: qui };
  switch (message.type) {
    // Adressés au MJ actif.
    case "reponse": return estMJActif() && recevoirReponse(pourMoi);
    case "vote": return estMJActif() && recevoirVote(pourMoi);
    case "jour": return estMJActif() && recevoirJour(pourMoi);
    case "bonjour": return estMJActif() && envoyerCarnet(qui);
  }
  // Le reste ne vient que d'un MJ.
  if (!vientDUnMJ(message, emetteur)) return false;
  switch (message.type) {
    case "demande":
      if (message.destinataire === game.user.id) ouvrirChoix(message);
      return true;
    case "annuler": fermerChoix(message.id); return true;
    case "secret":
      recevoirSecret(message);
      ui.notifications?.info(game.i18n.localize("LAKOUR_LOUPS.Carnet.Nouveau"));
      ouvrirCarnet();
      return true;
    case "carnet": recevoirCarnet(message); return true;
    case "monVote": noterMonVote(message); return true;
    case "avis": ui.notifications?.warn(String(message.texte ?? "")); return true;
    case "hook":
      if (typeof message.nom === "string" && message.nom.startsWith("lakourLoups.")) Hooks.callAll(message.nom, ...(message.args ?? []));
      return true;
  }
  return false;
}

export function ecouterSocket() {
  game.socket.on(CANAL, (message, emetteur) => traiterMessage(message, emetteur));
}
