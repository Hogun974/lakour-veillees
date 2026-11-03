// Socket « system.lakour-loups ». Chaque message a ses destinataires (recipients, voir canal.mjs) ; l'auteur est
// l'identifiant donné par le serveur, pas ce que le message prétend.
//   MJ -> un joueur : { type: "demande", id, destinataire, acteurId, invite, candidats, nombre, delai, finit, mode? ("texte"), max?,
//                       posthume? (demande faite à un mort : le porteur de la peste noire) }
//                     { type: "annuler", id }
//                     { type: "secret", partie, entree }          une entrée de son carnet secret
//                     { type: "carnet", partie, acteurId, entrees, prime, vote }   tout son carnet (connexion, rechargement)
//                     { type: "monVote", partie, numero, cible }  accusé de son vote
//                     { type: "avis", texte }                     refus (pouvoir de jour impossible, vote hors délai)
//                     { type: "salon", partie, ligne }            sa ligne des salons vocaux (scripts/salons.mjs) : { phase,
//                                                                 salon, peutParler, auditeurs, entend, loups? (un loup, la nuit) }
//                     { type: "fiche", partie, acteurId, fiche }  SA fiche secrète (0.9.0) : { camp, amoureux, role } (null : retirée)
//                     { type: "vus", partie, vus }                mort qui voit tout : { acteurId: { camp, role } } des autres ({} : rien)
//                     { type: "parole", canal, de, nom, texte, quand }   un mot relayé (canal des morts, ou au MJ) : affiché localement
//   (les parts de la clé du coffre passent par le canal du MJ IA, « module.lakour-mj-ia » : scripts/coffre.mjs)
//   joueur -> MJ actif : { type: "reponse", id, cibles, texte, userId }
//                        { type: "paroleEnvoi", texte, canal, userId }   un mot à relayer (canal "morts" ou "mj" : scripts/parole.mjs)
//                        { type: "vote", votant, cible, userId }
//                        { type: "jour", acteurId, pouvoir, cibles, texte, userId }
//                        { type: "bonjour", userId }             « renvoie-moi mon carnet » (et ma ligne des salons)
//                        { type: "peste", acteurId, userId }     « C'est la peste noire ! » (le MJ actif seul tranche)
//                        { type: "declaration", acteurId, texte, userId }   une déclaration au Registre du greffier (pour soi)
//                        { type: "accusation", acteurId, contre, userId }   une accusation au Banc des accusés (pour soi)
//                        { type: "depart", acteurId, userId }    « je dois partir » : il quitte la veillée sans mourir (pour soi)
//   MJ -> tous : { type: "hook", nom, args }  (arguments publics seulement)
import { CANAL } from "../logique/constantes.mjs";
import { estMJActif, auteur, vientDUnMJ } from "./canal.mjs";
import { recevoirReponse, recevoirVote, recevoirJour, recevoirCri, recevoirDeclaration, recevoirAccusation, recevoirDepart, envoyerCarnet } from "./api.mjs";
import { recevoirSecret, recevoirCarnet, noterMonVote, recevoirFiche, recevoirVus } from "./prive.mjs";
import { relayer, afficherParole } from "./parole.mjs";
import { fermerChoix } from "./apps/choix.mjs";
import { recevoirDemande, oublierDemande } from "./plateau-local.mjs";
import { ouvrirCarnet } from "./apps/carnet.mjs";
import { recevoirLigne, envoyerLigne } from "./salons.mjs";
import { signaler } from "./signal.mjs";

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
    case "peste": return estMJActif() && recevoirCri(pourMoi);
    case "declaration": return estMJActif() && recevoirDeclaration(pourMoi);
    case "accusation": return estMJActif() && recevoirAccusation(pourMoi);
    case "depart": return estMJActif() && recevoirDepart(pourMoi);
    // Le relais ne se fie qu'à l'émetteur donné par le serveur.
    case "paroleEnvoi": return estMJActif() && Boolean(emetteur) && relayer(pourMoi);
    case "bonjour":
      if (!estMJActif()) return false;
      envoyerLigne(qui);
      return envoyerCarnet(qui);
  }
  // Le reste ne vient que d'un MJ.
  if (!vientDUnMJ(message, emetteur)) return false;
  switch (message.type) {
    case "demande":
      // Sur la carte (jetons candidats allumés chez ce joueur seul), sinon dans la fenêtre de choix.
      if (message.destinataire !== game.user.id) return true;
      recevoirDemande(message);
      signaler(game.i18n.localize("LAKOUR_LOUPS.Signal.Choix"));
      return true;
    case "annuler": fermerChoix(message.id); oublierDemande(message.id); return true;
    case "secret":
      recevoirSecret(message);
      ui.notifications?.info(game.i18n.localize("LAKOUR_LOUPS.Carnet.Nouveau"));
      ouvrirCarnet();
      return true;
    case "carnet": recevoirCarnet(message); return true;
    case "monVote": noterMonVote(message); return true;
    case "avis": ui.notifications?.warn(String(message.texte ?? "")); return true;
    case "salon": return recevoirLigne(message);
    // Sa fiche, la vue d'un mort et les mots relayés ne viennent que du MJ ACTIF (pas d'un autre MJ, qui n'a pas les secrets).
    case "fiche": return deMJActif(emetteur) && recevoirFiche(message);
    case "vus": return deMJActif(emetteur) && recevoirVus(message);
    case "parole":
      if (!deMJActif(emetteur)) return false;
      afficherParole(message);
      return true;
    case "hook":
      if (typeof message.nom === "string" && message.nom.startsWith("lakourLoups.")) Hooks.callAll(message.nom, ...(message.args ?? []));
      return true;
  }
  return false;
}

// L'émetteur est-il le MJ actif ? (sans émetteur, serveur ancien : le filtre vientDUnMJ a déjà parlé)
function deMJActif(emetteur) {
  return !emetteur || emetteur === game.users.activeGM?.id;
}

export function ecouterSocket() {
  game.socket.on(CANAL, (message, emetteur) => traiterMessage(message, emetteur));
}
