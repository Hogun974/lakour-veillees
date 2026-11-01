// Qui peut écrire au chat (logique/parole.mjs) : un mort ne parle plus aux vivants, un villageois réduit au silence se
// tait pendant le débat et le vote du jour. Le MJ n'est jamais bloqué.
// - Dans le navigateur de l'auteur : preCreateChatMessage refuse le message (avec un avis qui dit pourquoi), ou, pour un
//   mort, le change en chuchotement aux seuls morts et au MJ (canal des morts, réglage monde « canalDesMorts »).
// - En garde, chez le MJ actif : createChatMessage retire un message qui serait passé outre (navigateur modifié) et
//   prévient son auteur.
// Limite de Foundry v14 : un chuchotement est livré à tous les navigateurs (contrat §6) ; les vivants ne voient pas le
// canal des morts dans leur chat, mais un curieux peut le lire dans la console.
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif, emettre } from "./canal.mjs";
import { t, lirePublic, tousLesVillageois, monVillageois } from "./donnees.mjs";

const reglageOuDefaut = (cle, defaut) => { try { return game.settings.get(ID, cle); } catch { return defaut; } };

// Les éléments de la décision pour un auteur et une liste de destinataires chuchotés.
export function entreeParole(user, chuchote = []) {
  const moi = user ? monVillageois(user) : null;
  const villageois = tousLesVillageois();
  const joueursDe = filtre => villageois.filter(filtre).map(a => a.system.joueur).filter(Boolean);
  return {
    mj: Boolean(user?.isGM),
    moi: moi ? { vivant: Boolean(moi.system.vivant), silence: Boolean(moi.system.silence) } : null,
    phase: lirePublic().phase,
    chuchote: [...(chuchote ?? [])].map(u => (typeof u === "string" ? u : u?.id)).filter(Boolean),
    mjs: game.users.filter(u => u.isGM).map(u => u.id),
    morts: joueursDe(a => !a.system.vivant),
    canalDesMorts: Boolean(reglageOuDefaut("canalDesMorts", true))
  };
}

const texteRefus = raison => t(raison === "silence" ? "LAKOUR_LOUPS.Parole.Silence" : "LAKOUR_LOUPS.Parole.Mort");

// preCreateChatMessage, dans le navigateur de l'auteur. -> false pour refuser.
let canalAnnonce = false;
export function avantMessage(message, donnees, options, userId) {
  if (userId && userId !== game.user.id) return undefined;
  const d = L.decisionParole(entreeParole(game.user, message.whisper ?? donnees?.whisper ?? []));
  if (!d.ok) {
    ui.notifications?.warn(texteRefus(d.raison));
    return false;
  }
  if (d.chuchoter) {
    message.updateSource({ whisper: d.chuchoter, [`flags.${ID}.canal`]: "morts" });
    if (!canalAnnonce) { canalAnnonce = true; ui.notifications?.info(t("LAKOUR_LOUPS.Parole.CanalDesMorts")); }
  }
  return undefined;
}

// createChatMessage, chez le MJ actif : la garde. -> true si le message a été retiré.
export async function gardeMessage(message) {
  if (!estMJActif()) return false;
  const auteur = message.author ?? game.users.get(message.user?.id ?? message.user);
  if (!auteur || auteur.isGM) return false;
  if (!L.messageARetirer(entreeParole(auteur, message.whisper ?? []))) return false;
  const d = L.decisionParole(entreeParole(auteur, []));
  try { await message.delete(); } catch (e) { console.warn(`${ID} | message à retirer`, e); }
  if (auteur.id !== game.user.id) emettre({ type: "avis", texte: texteRefus(d.raison ?? "mort") }, [auteur.id]);
  return true;
}

export function brancherParole() {
  Hooks.on("preCreateChatMessage", avantMessage);
  Hooks.on("createChatMessage", message => { gardeMessage(message); });
}
