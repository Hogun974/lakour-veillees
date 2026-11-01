// Le canal socket « system.lakour-loups ».
//
// Ce que fait le serveur de Foundry v14 (server/dist/server/sockets.mjs, handleCustomSocket) :
// - game.socket.emit(CANAL, message, { recipients: [userIds] }) ne livre le message qu'aux navigateurs de ces
//   utilisateurs ; sans « recipients », il part chez TOUS les autres navigateurs. Toute demande privée (choix de nuit,
//   carnet secret, accusé de vote) a donc des destinataires ; une réponse de joueur ne part que vers le MJ actif ;
// - le récepteur reçoit (message, idDeLEmetteur) : l'identifiant est ajouté par le serveur d'après la session, un joueur
//   ne peut pas le falsifier. C'est lui qui fait foi ; message.userId n'est qu'une déclaration, rejetée si elle le
//   contredit (sans cet identifiant, sur un serveur plus ancien, on se rabat sur message.userId).
import { CANAL } from "../logique/constantes.mjs";

export const estMJActif = () => Boolean(game.users.activeGM) && game.users.activeGM.id === game.user.id;

// Envoie un message : à ces utilisateurs seulement (le navigateur courant est retiré : le serveur ne renvoie rien à
// l'émetteur), ou à tous si destinataires est null (seulement pour ce qui est public : les hooks).
export function emettre(message, destinataires = null) {
  if (destinataires === null) return game.socket.emit(CANAL, message);
  const ids = [...new Set(destinataires.filter(Boolean))].filter(id => id !== game.user.id);
  if (ids.length) game.socket.emit(CANAL, message, { recipients: ids });
}

// Un joueur écrit au MJ actif, et à lui seul.
export function versMJ(message) {
  const mj = game.users.activeGM;
  if (!mj) return false;
  emettre({ ...message, userId: game.user.id }, [mj.id]);
  return true;
}

// L'auteur réel d'un message reçu : l'identifiant donné par le serveur ; null si le message ment sur son auteur.
export function auteur(message, emetteur) {
  if (emetteur && message?.userId && message.userId !== emetteur) return null;
  return emetteur || message?.userId || null;
}
export const vientDUnMJ = (message, emetteur) => {
  const qui = auteur(message, emetteur);
  return qui === null ? false : (!qui || Boolean(game.users.get(qui)?.isGM));
};

// Appelle le hook ici, et le fait appeler chez tous les autres avec des arguments PUBLICS (jamais un choix de nuit,
// une prime, une fiole, un vote en cours ni la vraie cause d'une mort de nuit).
export function annoncer(nom, argsIci, argsPublics = argsIci) {
  Hooks.callAll(nom, ...argsIci);
  emettre({ type: "hook", nom, args: argsPublics });
}
