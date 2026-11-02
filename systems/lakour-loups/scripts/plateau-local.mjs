// Agir par la carte, dans le navigateur du joueur. Tout ce qui est ici est LOCAL : la mise en surbrillance des candidats,
// la sélection en cours, son propre vote, les bulles du dépouillement. Aucun document ni réglage du monde n'est modifié ;
// seul le choix validé part au MJ actif, par le socket du système (destinataire : le MJ actif seul ; l'émetteur est
// vérifié par le serveur, voir canal.mjs) — exactement comme depuis les fenêtres, qui restent là en secours.
//
// Trois modes, du plus prioritaire au moins :
// - demande de nuit (reçue du MJ) : les jetons candidats s'allument chez ce joueur seul ; un clic sélectionne (plusieurs
//   cibles : plusieurs clics), « Valider » ou « Passer » dans le bandeau ;
// - pouvoir de jour (bouton du bandeau) : clic sur la ou les cibles, puis « Confirmer » ;
// - vote ouvert : un vivant clique sur le jeton de celui qu'il accuse ; il peut changer d'avis, ou s'abstenir.
// Un mort n'agit plus : aucun clic n'est accepté, le bandeau lui dit qu'il observe.
import { ID } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { t, lireEtat, monVillageois, metierDe } from "./donnees.mjs";
import { envoyerReponse, envoyerVote, envoyerJour } from "./api.mjs";
import { monVote } from "./prive.mjs";
import { ouvrirChoix, fermerChoix } from "./apps/choix.mjs";

const local = {
  demande: null,        // la demande de nuit en cours (du MJ, à ce joueur seul)
  selection: null,      // sa sélection (logique/selection.mjs)
  pouvoir: null,        // le pouvoir de jour en préparation : { pouvoir, nom, acteurId, texte }
  bulles: null,         // { acteurId: voix } du dernier dépouillement, montré quelques secondes
  bullesJusqua: 0,
  annonce: "",          // message bref du bandeau (« Nouvelle partie ! »)
  annonceJusqua: 0
};
const ecouteurs = new Set();
let minuterieBulles = null;

export const DUREE_BULLES = 8000;
export const DUREE_ANNONCE = 10000;

// Les vues (bandeau, jetons) s'abonnent pour se redessiner quand l'état local change.
export function surChangement(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); }
function changer() { for (const fn of ecouteurs) { try { fn(); } catch (e) { console.warn(`${ID} | plateau local`, e); } } }

// Le joueur agit-il par la carte ? (réglage client, carte prête, son jeton sur la scène affichée)
export function plateauInteractif(ids = []) {
  let voulu = true;
  try { voulu = game.settings.get(ID, "plateauInteractif") !== false; } catch { /* réglage absent */ }
  if (!voulu) return false;
  const c = globalThis.canvas;
  if (!c?.ready || !c.tokens) return false;
  const surLaCarte = id => c.tokens.placeables.some(tk => tk.actor?.id === id);
  return ids.length ? ids.some(surLaCarte) : true;
}

const moiVivant = () => Boolean(monVillageois()?.system.vivant);

// ------------------------------------------------------------------ demandes de nuit
// Une demande arrive du MJ : sur la carte si possible (et pas un mot à écrire), sinon dans la fenêtre de choix.
export function recevoirDemande(demande) {
  if (demande.mode === "texte" || !plateauInteractif(demande.candidats.map(c => c.id))) {
    ouvrirChoix(demande);
    return "fenetre";
  }
  local.demande = demande;
  local.selection = L.nouvelleSelection({ id: demande.id, mode: "nuit", candidats: demande.candidats.map(c => c.id), nombre: demande.nombre });
  local.pouvoir = null;
  ui.notifications?.info(t("LAKOUR_LOUPS.Plateau.ChoisisSurLaCarte"));
  changer();
  return "plateau";
}

// Le MJ annule (délai écoulé) ou la fenêtre de secours a répondu : la carte s'éteint.
export function oublierDemande(id) {
  if (!local.demande || (id && local.demande.id !== id)) return false;
  local.demande = null;
  local.selection = null;
  changer();
  return true;
}

// ------------------------------------------------------------------ pouvoirs de jour
// Prépare un pouvoir de jour depuis le bandeau. Sans cible : on demande seulement confirmation ; un mot à écrire : boîte
// de dialogue ; sinon les candidats s'allument et l'on clique.
export async function commencerPouvoir(pouvoir) {
  const moi = monVillageois();
  const acteurId = pouvoir === "chapelle" ? "" : moi?.id ?? "";
  const p = game.lakourLoups.pouvoirsDeJour(acteurId).find(x => x.pouvoir === pouvoir);
  if (!p) return false;
  if (!p.possible) { ui.notifications?.warn(p.raisonTexte); return false; }
  if (p.texte) {
    const texte = await foundry.applications.api.DialogV2.prompt({
      window: { title: p.nom },
      content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Jour.InviteTexte"))}</p><input type="text" name="texte" maxlength="120" autofocus>`,
      ok: { callback: (ev, bouton) => bouton.form.elements.texte.value }
    }).catch(() => "");
    if (texte?.trim()) envoyerJour({ acteurId, pouvoir, cibles: [], texte: texte.trim() });
    return true;
  }
  const invite = (p.source === "metier" ? metierDe(moi)?.system.jour.invite : "") || t("LAKOUR_LOUPS.Jour.InviteCible", { nom: p.nom });
  local.pouvoir = { pouvoir, nom: p.nom, acteurId, invite };
  local.selection = L.nouvelleSelection({ id: `jour-${pouvoir}`, mode: "jour", candidats: p.candidats.map(c => c.id), nombre: p.cibles });
  changer();
  return true;
}

export function annulerPouvoir() {
  if (!local.pouvoir) return false;
  local.pouvoir = null;
  local.selection = null;
  changer();
  return true;
}

// ------------------------------------------------------------------ clics sur les jetons
// Le mode actif : "nuit" | "jour" | "vote" | "".
export function modeActif() {
  if (local.demande) return "nuit";
  if (local.pouvoir) return "jour";
  const v = lireEtat().vote;
  if (v.ouvert && moiVivant()) return "vote";
  return "";
}

// Ce clic sur le jeton de cet acteur est-il pour le plateau ? (sans rien changer)
export function accepteClic(acteurId) {
  if (!acteurId || game.user.isGM && !monVillageois()) return false;
  switch (modeActif()) {
    case "nuit":
    case "jour": return L.estCandidat(local.selection, acteurId);
    case "vote": return lireEtat().vote.candidats.includes(acteurId);
    default: return false;
  }
}

// Un clic sur le jeton d'un villageois. -> true s'il a servi.
export function cliquer(acteurId) {
  if (!accepteClic(acteurId)) return false;
  const mode = modeActif();
  if (mode === "vote") {
    envoyerVote(acteurId);
    changer();
    return true;
  }
  local.selection = L.basculer(local.selection, acteurId);
  changer();
  return true;
}

// « Valider » (nuit) ou « Confirmer » (pouvoir de jour) : seul ce choix part au MJ actif.
export function valider() {
  if (local.demande) {
    if (!L.pretAValider(local.selection)) return false;
    const { id } = local.demande;
    envoyerReponse(id, [...local.selection.choisis]);
    fermerChoix(id);
    oublierDemande(id);
    return true;
  }
  if (local.pouvoir) {
    if (!L.pretAValider(local.selection)) return false;
    const { pouvoir, acteurId } = local.pouvoir;
    envoyerJour({ acteurId, pouvoir, cibles: [...local.selection.choisis] });
    annulerPouvoir();
    return true;
  }
  return false;
}

// « Passer » : la demande de nuit reçoit un choix vide.
export function passer() {
  if (!local.demande) return annulerPouvoir();
  const { id } = local.demande;
  envoyerReponse(id, []);
  fermerChoix(id);
  oublierDemande(id);
  return true;
}

// « S'abstenir » pendant un vote.
export function abstenir() {
  if (modeActif() !== "vote") return false;
  envoyerVote("");
  changer();
  return true;
}

// La fenêtre de secours de la demande en cours (liste des candidats).
export function ouvrirListe() {
  if (!local.demande) return null;
  return ouvrirChoix(local.demande, { secours: true });
}

// ------------------------------------------------------------------ bulles du dépouillement, annonces
export function montrerBulles(decompte = {}) {
  local.bulles = { ...decompte };
  local.bullesJusqua = Date.now() + DUREE_BULLES;
  clearTimeout(minuterieBulles);
  minuterieBulles = setTimeout(() => { local.bulles = null; changer(); }, DUREE_BULLES);
  minuterieBulles?.unref?.();
  changer();
}

export function annoncer(texte) {
  local.annonce = String(texte ?? "");
  local.annonceJusqua = Date.now() + DUREE_ANNONCE;
  setTimeout(() => changer(), DUREE_ANNONCE + 50)?.unref?.();
  changer();
}
export const annonceEnCours = () => (local.annonce && Date.now() < local.annonceJusqua ? local.annonce : "");

// ------------------------------------------------------------------ ce que montre chaque jeton, chez ce joueur
// -> { candidat, choisi, monVote, aVote, bulle, mort }
export function decorDe(acteurId) {
  const etat = lireEtat();
  const v = etat.vote;
  const acteur = game.actors.get(acteurId);
  const mode = modeActif();
  const sel = local.selection;
  const moi = monVillageois();
  const monChoix = !moi ? "" : game.user.isGM ? v.votes?.[moi.id] ?? "" : monVote(v.numero);
  return {
    candidat: (mode === "nuit" || mode === "jour") ? L.estCandidat(sel, acteurId) : mode === "vote" && v.candidats.includes(acteurId),
    choisi: (mode === "nuit" || mode === "jour") && Boolean(sel?.choisis.includes(acteurId)),
    monVote: v.ouvert && Boolean(monChoix) && monChoix === acteurId,
    aVote: v.ouvert && v.exprimes.includes(acteurId),
    bulle: local.bulles && Date.now() < local.bullesJusqua && acteurId in local.bulles ? local.bulles[acteurId] : null,
    mort: acteur ? !acteur.system.vivant : false,
    // Le Bailli (public) : son sceau sur le jeton, chez chacun.
    bailli: Boolean(acteur?.system.vivant) && etat.bailli?.actif === true && etat.bailli.acteurId === acteurId
  };
}

// Ce que le bandeau doit dire de l'action en cours.
export function etatLocal() {
  return {
    mode: modeActif(),
    demande: local.demande ? { id: local.demande.id, invite: local.demande.invite, nombre: local.demande.nombre, finit: local.demande.finit, acteurNom: local.demande.acteurNom } : null,
    pouvoir: local.pouvoir ? { ...local.pouvoir } : null,
    selection: local.selection ? { ...local.selection, choisis: [...local.selection.choisis] } : null,
    pret: L.pretAValider(local.selection)
  };
}

// Une nouvelle partie, une déconnexion : tout s'efface.
export function remettreAZero() {
  local.demande = null; local.selection = null; local.pouvoir = null; local.bulles = null; local.annonce = "";
  changer();
}
