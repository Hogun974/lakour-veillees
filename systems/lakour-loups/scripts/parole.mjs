// Qui peut écrire au chat (logique/parole.mjs) : un mort ne parle plus aux vivants, un villageois réduit au silence se tait
// pendant le débat et le vote du jour, et pendant une partie aucun chuchotement de joueur ne devient un message de chat. Le MJ
// n'est jamais bloqué.
//
// Foundry v14 livre TOUT message de chat à tous les navigateurs, chuchotements compris (contrat §6) : un chuchotement se lit
// dans la console de n'importe qui. Ce qui ne doit être lu que de quelques-uns passe donc par un RELAIS du MJ actif (0.9.0) :
// - dans le navigateur de l'auteur, preCreateChatMessage refuse le message (aucun document n'est créé) et, s'il relève du
//   canal des morts (un mort, réglage monde « canalDesMorts ») ou d'un mot au seul MJ, l'envoie au MJ actif par le socket
//   (« paroleEnvoi », à lui seul) et l'affiche chez lui-même ;
// - le MJ actif vérifie l'auteur (l'émetteur donné par le serveur), puis le livre (« parole », { recipients }) aux seuls morts et
//   MJ (canal des morts), ou aux seuls MJ ; chaque destinataire l'affiche dans son chat, LOCALEMENT (aucun document) ;
// - un chuchotement de joueur à joueur pendant une partie est refusé ;
// - en garde, chez le MJ actif : createChatMessage retire un message qui serait passé outre (navigateur modifié) et prévient
//   son auteur (le message a pu être lu entre-temps : la garde ne rattrape pas une triche, elle la rend visible).
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif, emettre, versMJ } from "./canal.mjs";
import { t, lirePublic, tousLesVillageois, monVillageois } from "./donnees.mjs";

const reglageOuDefaut = (cle, defaut) => { try { return game.settings.get(ID, cle); } catch { return defaut; } };
const echapper = s => foundry.utils.escapeHTML(String(s ?? ""));

// Une partie en cours : distribuée, pas encore finie.
function enPartie() {
  const pub = lirePublic();
  return Boolean(pub.partie) && pub.phase !== "fin";
}

// Les éléments de la décision pour un auteur et une liste de destinataires chuchotés.
export function entreeParole(user, chuchote = []) {
  const moi = user ? monVillageois(user) : null;
  const villageois = tousLesVillageois();
  const joueursDe = filtre => villageois.filter(filtre).map(a => a.system.joueur).filter(Boolean);
  const pub = lirePublic();
  // Un parti (départ, exil) n'est pas un mort : il quitte la veillée, il ne rejoint pas le canal des morts.
  const partis = new Set((pub.partis ?? []).map(p => p.acteurId));
  // Le Dernier souffle : qui le garde encore (un mort qui vote encore ne lit pas ceux qui voient tout).
  const souffle = a => L.aSonSouffle(pub, { id: a.id, vivant: false });
  return {
    mj: Boolean(user?.isGM), moiId: String(user?.id ?? ""),
    moi: moi ? { vivant: Boolean(moi.system.vivant) || partis.has(moi.id), silence: Boolean(moi.system.silence), souffle: !moi.system.vivant && souffle(moi) } : null,
    phase: pub.phase,
    chuchote: [...(chuchote ?? [])].map(u => (typeof u === "string" ? u : u?.id)).filter(Boolean),
    mjs: game.users.filter(u => u.isGM).map(u => u.id),
    morts: joueursDe(a => !a.system.vivant && !partis.has(a.id)),
    souffles: joueursDe(a => !a.system.vivant && !partis.has(a.id) && souffle(a)),
    mortsVoientTout: Boolean(reglageOuDefaut("mortsVoientTout", true)),
    canalDesMorts: Boolean(reglageOuDefaut("canalDesMorts", true)),
    enPartie: Boolean(pub.partie) && pub.phase !== "fin"
  };
}

const texteRefus = raison => t({ silence: "LAKOUR_LOUPS.Parole.Silence", chuchotement: "LAKOUR_LOUPS.Parole.Chuchotement" }[raison] ?? "LAKOUR_LOUPS.Parole.Mort");

// ------------------------------------------------------------------ affichage local (aucun document)
// Un message relayé, dans le chat de CE navigateur seulement : un message de chat jamais enregistré (ChatLog#postOne), à défaut
// une notification. Rien n'atteint le serveur.
export async function afficherParole({ nom = "", texte = "", canal = "morts" } = {}) {
  const contenu = `<div class="lakour-loups parole-relayee ${canal === "mj" ? "au-mj" : "morts"}"><em>${echapper(t(canal === "mj" ? "LAKOUR_LOUPS.Parole.TitreMJ" : "LAKOUR_LOUPS.Parole.TitreMorts"))}</em>`
    + ` <strong>${echapper(nom)}</strong> : ${echapper(texte)}</div>`;
  try {
    const Classe = globalThis.ChatMessage?.implementation;
    if (Classe && typeof globalThis.ui?.chat?.postOne === "function") {
      const message = new Classe({ content: contenu, speaker: { alias: nom }, author: game.user.id, flags: { [ID]: { canal, local: true } } });
      await globalThis.ui.chat.postOne(message, { notify: true });
      return true;
    }
  } catch (e) { console.warn(`${ID} | message relayé`, e); }
  globalThis.ui?.notifications?.info?.(`${nom} : ${texte}`);
  return false;
}

// ------------------------------------------------------------------ chez l'auteur
// preCreateChatMessage, dans le navigateur de l'auteur. -> false pour refuser (le relais, s'il y a lieu, est parti).
let canalAnnonce = false;
export function avantMessage(message, donnees, options, userId) {
  if (userId && userId !== game.user.id) return undefined;
  if (message?.flags?.[ID]?.local) return undefined;
  const d = L.decisionParole(entreeParole(game.user, message.whisper ?? donnees?.whisper ?? []));
  if (d.ok) return undefined;
  // Un jet « pour soi » : affiché ici seulement, sans document (le message préparé, jamais enregistré).
  if (d.local) {
    afficherLocalement(message);
    return false;
  }
  if (d.relais) {
    // Un jet de dés « MJ seul » ou « aveugle » : sa formule et son résultat partent au MJ (le contenu seul n'en dirait rien) ; un
    // jet aveugle n'est pas montré à son auteur.
    const jets = (message.rolls ?? donnees?.rolls ?? []).map(r => ({ formule: r?.formula ?? r?.formule, total: r?.total }));
    const resume = L.resumeDesJets(jets, message.flavor ?? donnees?.flavor ?? "");
    const texte = resume || L.texteDuRelais(message.content ?? donnees?.content ?? "");
    if (texte) envoyerParole(texte, d.relais, { aveugle: Boolean(resume && (message.blind ?? donnees?.blind)) });
    if (d.relais === "morts" && !canalAnnonce) { canalAnnonce = true; ui.notifications?.info(t("LAKOUR_LOUPS.Parole.CanalDesMorts")); }
    return false;
  }
  ui.notifications?.warn(texteRefus(d.raison));
  return false;
}

// Un message préparé (pas encore créé : preCreateChatMessage) affiché dans le chat de ce seul navigateur ; à défaut, une notification.
function afficherLocalement(message) {
  try {
    if (typeof globalThis.ui?.chat?.postOne === "function") { globalThis.ui.chat.postOne(message, { notify: false }); return true; }
  } catch (e) { console.warn(`${ID} | message local`, e); }
  const jets = (message.rolls ?? []).map(r => `${r?.formula ?? "?"} → ${r?.total ?? "?"}`).join(" ; ");
  globalThis.ui?.notifications?.info?.(jets || L.texteDuRelais(message.content ?? ""));
  return false;
}

// Un mot relayé : au MJ actif (qui le livre), et affiché ici (un jet aveugle : seulement qu'il est parti).
export function envoyerParole(texte, canal, { aveugle = false } = {}) {
  const propre = L.texteDuRelais(texte);
  if (!propre || !L.CANAUX_DE_RELAIS.includes(canal)) return false;
  const nom = monVillageois()?.name ?? game.user.name;
  afficherParole({ nom, texte: aveugle ? t("LAKOUR_LOUPS.Parole.JetAveugle") : propre, canal });
  if (estMJActif()) return relayer({ texte: propre, canal, userId: game.user.id });
  if (!versMJ({ type: "paroleEnvoi", texte: propre, canal })) ui.notifications?.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  return true;
}

// ------------------------------------------------------------------ chez le MJ actif : le relais
// Un mot reçu (userId : l'auteur donné par le serveur) : vérifié, puis livré à ses seuls destinataires.
export function relayer({ texte, canal, userId }) {
  if (!estMJActif()) return false;
  const auteur = game.users.get(userId);
  if (!auteur || auteur.isGM && userId !== game.user.id) return false;
  const e = entreeParole(auteur, []);
  const destinataires = L.destinatairesDuRelais({ canal, auteur: userId, moi: e.moi, mjs: e.mjs, morts: e.morts, souffles: e.souffles,
    mortsVoientTout: e.mortsVoientTout, canalDesMorts: e.canalDesMorts, enPartie: e.enPartie });
  const propre = L.texteDuRelais(texte);
  if (!destinataires || !propre) return false;
  const nom = monVillageois(auteur)?.name ?? auteur.name;
  const message = { type: "parole", canal, de: userId, nom, texte: propre, quand: Date.now() };
  emettre(message, destinataires);
  if (userId !== game.user.id && destinataires.includes(game.user.id)) afficherParole(message);
  return true;
}

// ------------------------------------------------------------------ garde du MJ actif
// createChatMessage, chez le MJ actif : la garde. -> true si le message a été retiré.
export async function gardeMessage(message) {
  if (!estMJActif() || !enPartie()) return false;
  const auteur = message.author ?? game.users.get(message.user?.id ?? message.user);
  if (!auteur || auteur.isGM) return false;
  const entree = entreeParole(auteur, message.whisper ?? []);
  if (!L.messageARetirer(entree)) return false;
  const d = L.decisionParole(entree);
  try { await message.delete(); } catch (e) { console.warn(`${ID} | message à retirer`, e); }
  if (auteur.id !== game.user.id) emettre({ type: "avis", texte: texteRefus(d.raison ?? (d.relais === "mj" ? "chuchotement" : "mort")) }, [auteur.id]);
  return true;
}

export function brancherParole() {
  Hooks.on("preCreateChatMessage", avantMessage);
  Hooks.on("createChatMessage", message => { gardeMessage(message); });
}
