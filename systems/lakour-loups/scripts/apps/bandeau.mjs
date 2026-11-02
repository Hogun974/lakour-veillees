// Le bandeau d'action, en haut de l'écran de chaque joueur (et du MJ) : la phase, le tour et le minuteur, « Mon rôle »
// (le carnet secret), et l'action du moment — « Choisis ta cible » (nuit), « Vote » (clic sur un jeton), un pouvoir de
// jour du rôle ou du métier (« Utiliser : Forgeron », grisé quand ce n'est pas le moment), ou, pour un mort, « Tu es mort :
// tu observes ». Pendant le vote : « Voter » (la liste) et le temps restant ; le MJ y ouvre et y clôt le vote. Il remplace les fenêtres, qui restent
// disponibles en secours (« Liste », Table de jeu). Ce qu'il montre de secret (sa sélection, son vote, son rôle) ne
// vient que de ce navigateur : rien n'en sort, sinon le choix validé, au seul MJ actif.
// Le jour, un vivant y trouve aussi « C'est la peste noire ! » (le cri de la variante Peste noire, logique/peste.mjs) : il
// n'apprend rien avant de crier (le bouton est là dans toutes les parties), seul le MJ actif tranche.
// Un mort qui garde son Dernier souffle le lit dans son statut, et vote comme un vivant (vote d'exécution, une fois).
// Le Bailli (public) y paraît : « Bailli : X » (« Tu es le Bailli : ta voix compte double » pour lui) ; le MJ y ouvre son élection.
// Avec la voix intégrée de Foundry (A/V) et les salons vocaux, il montre aussi le salon du joueur (« 🔇 La nuit, silence »,
// « 🐺 Tanière : tu parles aux loups », « 👻 Tu parles aux morts », « 🔇 Réduit au silence ») : sa ligne, reçue du MJ actif.
import { ID } from "../../logique/constantes.mjs";
import * as L from "../../logique/index.mjs";
import { t, lireEtat, monVillageois, libellePhase, libelleVainqueur } from "../donnees.mjs";
import { monVote } from "../prive.mjs";
import { salonAffiche } from "../salons.mjs";
import * as local from "../plateau-local.mjs";
import { ouvrirCarnet } from "./carnet.mjs";
import { ouvrirTable, cloreLeVote, crierALaPeste } from "./table.mjs";
import { fenetreVote } from "./vote.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const nomDe = id => game.actors.get(id)?.name ?? "";
const ICONES = { preparation: "fa-scroll", nuit: "fa-moon", aube: "fa-cloud-sun", jour: "fa-sun", vote: "fa-scale-balanced", fin: "fa-crown" };
const ICONES_POUVOIR = { role: "fa-mask", metier: "fa-hammer", batiment: "fa-landmark" };

// L'élection du Bailli est-elle due (le MJ l'ouvre avant le vote d'exécution) ?
function electionDue() {
  try { return Boolean(game.lakourLoups.bailli().election.ok); } catch { return false; }
}

// Mes pouvoirs de jour : rôle et métier toujours montrés (grisés, avec la raison, quand ce n'est pas le moment ou qu'ils
// ont servi) ; les autres (bâtiments, Puits) seulement quand ils peuvent servir.
function mesPouvoirs(moi) {
  try {
    return game.lakourLoups.pouvoirsDeJour(moi.id)
      .filter(p => p.possible || (["role", "metier"].includes(p.source) && !["absent", "inconnu", "mort"].includes(p.raison)))
      .map(p => {
        const raison = p.possible ? "" : p.raisonTexte;
        // L'infobulle dit ce que fait le pouvoir (sans aller chercher le rôle dans le compendium), et pourquoi il est grisé.
        const aide = [raison && `⛔ ${raison}`, p.description].filter(Boolean).join(" — ");
        return { pouvoir: p.pouvoir, libelle: t("LAKOUR_LOUPS.Bandeau.Utiliser", { nom: p.nom }), icone: ICONES_POUVOIR[p.source] ?? "fa-hand-sparkles",
          possible: p.possible, raison, aide };
      });
  } catch { return []; }
}

// Le contenu du bandeau, pour l'utilisateur courant (éprouvé hors Foundry dans les essais).
export function contexteBandeau() {
  const etat = lireEtat();
  const moi = monVillageois();
  const gm = game.user.isGM;
  const l = local.etatLocal();
  const v = etat.vote;
  const ctx = {
    gm, phase: etat.phase, phaseLibelle: libellePhase(etat.phase), icone: ICONES[etat.phase] ?? "fa-moon", tour: etat.tour,
    finit: 0, monRole: Boolean(moi), statut: null, consigne: "", detail: "", boutons: [], pouvoirs: [], annonce: local.annonceEnCours(),
    vainqueur: etat.phase === "fin" ? libelleVainqueur(etat.vainqueur, etat) : "",
    salon: salonAffiche(), bailli: null
  };
  // Le Bailli en charge (public).
  const bailliId = etat.bailli?.actif && etat.phase !== "fin" ? etat.bailli.acteurId : "";
  if (bailliId && game.actors.get(bailliId)?.system.vivant) {
    // Le jour du sceau fêlé (Almanach), sa voix ne compte pas double : le bandeau ne le lui promet pas.
    const sceau = L.presageDuJour(etat) === "sceau-brise";
    ctx.bailli = moi?.id === bailliId ? { moi: true, texte: t(sceau ? "LAKOUR_LOUPS.Bailli.TuEsSceau" : "LAKOUR_LOUPS.Bailli.TuEs"), aide: t("LAKOUR_LOUPS.Bailli.Aide") }
      : { moi: false, texte: t("LAKOUR_LOUPS.Bailli.Bandeau", { nom: nomDe(bailliId) }), aide: t("LAKOUR_LOUPS.Bailli.Aide") };
  }
  // Chaque bouton a son infobulle (LAKOUR_LOUPS.Bandeau.Aide.<action>) : ce qu'il fait.
  const bouton = (action, libelle, icone, { principal = false, data = {} } = {}) => ctx.boutons.push({ action, libelle, icone, principal,
    aide: t(`LAKOUR_LOUPS.Bandeau.Aide.${action}`), data: Object.entries(data).map(([k, val]) => ({ k, val })) });
  if (etat.phase === "preparation" && etat.partie && !ctx.annonce) ctx.annonce = t("LAKOUR_LOUPS.Bandeau.NouvellePartie");

  // L'état du joueur : mort, ou réduit au silence.
  // Un mort qui garde son Dernier souffle le sait (il votera une fois encore, à un vote d'exécution).
  const souffle = moi && !moi.system.vivant && L.aSonSouffle(etat, { id: moi.id, vivant: false });
  if (moi && !moi.system.vivant) ctx.statut = { cle: "mort", icone: "fa-skull", texte: t(souffle ? "LAKOUR_LOUPS.Souffle.Bandeau" : "LAKOUR_LOUPS.Bandeau.Mort") };
  else if (moi?.system.silence && ctx.salon?.cle !== "silence") ctx.statut = { cle: "silence", icone: "fa-comment-slash", texte: t("LAKOUR_LOUPS.Bandeau.Silence") };

  if (l.mode === "nuit") {
    ctx.consigne = l.demande.invite || t("LAKOUR_LOUPS.Bandeau.ChoisisTaCible");
    ctx.detail = l.demande.nombre > 1 ? t("LAKOUR_LOUPS.Bandeau.Compte", { n: l.selection.choisis.length, max: l.demande.nombre })
      : l.selection.choisis.map(nomDe).join(", ") || t("LAKOUR_LOUPS.Bandeau.CliqueUnJeton");
    ctx.finit = l.demande.finit ?? 0;
    ctx.urgent = true;
    bouton("bandeauValider", t("LAKOUR_LOUPS.Choix.Valider"), "fa-check", { principal: true });
    bouton("bandeauPasser", t("LAKOUR_LOUPS.Choix.Passer"), "fa-forward");
    bouton("bandeauListe", t("LAKOUR_LOUPS.Bandeau.Liste"), "fa-list");
    ctx.pret = l.pret;
  } else if (l.mode === "jour") {
    ctx.consigne = `${l.pouvoir.nom} : ${l.pouvoir.invite}`;
    ctx.detail = l.selection.nombre > 1 ? t("LAKOUR_LOUPS.Bandeau.Compte", { n: l.selection.choisis.length, max: l.selection.nombre })
      : l.selection.choisis.map(nomDe).join(", ") || t("LAKOUR_LOUPS.Bandeau.CliqueUnJeton");
    bouton("bandeauValider", t("LAKOUR_LOUPS.Bandeau.Confirmer"), "fa-check", { principal: true });
    bouton("bandeauAnnuler", t("LAKOUR_LOUPS.Bandeau.Annuler"), "fa-xmark");
    ctx.pret = l.pret;
  } else if (v.ouvert) {
    ctx.finit = v.finit ?? 0;
    const monChoix = !moi ? "" : gm ? v.votes?.[moi.id] ?? "" : monVote(v.numero);
    ctx.consigne = t({ chapelle: "LAKOUR_LOUPS.Bandeau.VoteChapelle", bailli: "LAKOUR_LOUPS.Bandeau.VoteBailli" }[v.objet] ?? "LAKOUR_LOUPS.Bandeau.Vote");
    // Les vivants qui ont voté ; les souffles des morts, à part.
    const compte = L.compteDesVoix({ etat, villageois: game.actors.filter(a => a.type === "villageois").map(a => ({ id: a.id, vivant: a.system.vivant })) });
    ctx.detail = `${compte.exprimes} / ${compte.attendus} ${t("LAKOUR_LOUPS.Vote.OntVote")}`
      + (compte.souffles ? ` · ${t("LAKOUR_LOUPS.Souffle.Compte", { n: compte.souffles })}` : "");
    if (l.mode === "vote") {
      ctx.detail += ` · ${t("LAKOUR_LOUPS.Vote.VotreVoix")} ${monChoix ? nomDe(monChoix) : t("LAKOUR_LOUPS.Vote.Personne")}`;
      if (!moi.system.vivant) ctx.detail += ` · ${t("LAKOUR_LOUPS.Souffle.Voter")}`;
      // Voter : un clic sur un jeton, ou ce bouton (la liste des candidats).
      bouton("bandeauVoter", t("LAKOUR_LOUPS.Bandeau.Voter"), "fa-check-to-slot", { principal: !monChoix });
      bouton("bandeauAbstenir", t("LAKOUR_LOUPS.Vote.Abstention"), "fa-hand");
    }
    if (moi) ctx.pouvoirs = mesPouvoirs(moi);
    ctx.pret = true;
  } else if (moi?.system.vivant) {
    ctx.pouvoirs = mesPouvoirs(moi);
    ctx.consigne = t(`LAKOUR_LOUPS.Bandeau.Attente.${etat.phase}`);
  } else if (moi) {
    // Un mort : le Puits peut encore lui offrir un dernier mot.
    ctx.pouvoirs = mesPouvoirs(moi);
  } else ctx.consigne = t(`LAKOUR_LOUPS.Bandeau.Attente.${etat.phase}`);
  // Le cri de la peste noire : pour un vivant, pendant le jour, quand rien d'autre n'est en cours sur la carte.
  if (moi && !l.mode) {
    let cri = null;
    try { cri = game.lakourLoups.peutCrier(moi.id); } catch { cri = null; }
    if (cri?.ok) bouton("bandeauPeste", t("LAKOUR_LOUPS.Peste.Crier"), "fa-biohazard");
  }
  if (ctx.vainqueur) ctx.consigne = ctx.vainqueur;
  // Le MJ (sans villageois) : l'étape suivante de la Table de jeu, en rappel (pendant le vote, le décompte des voix).
  if (gm && !moi && !ctx.boutons.length && !v.ouvert) {
    try {
      const e = game.lakourLoups.etapeSuivante();
      const nom = e.donnees.meute ? t("LAKOUR_LOUPS.Etapes.LaMeute") : e.donnees.peste ? t("LAKOUR_LOUPS.Etapes.LaPeste") : e.donnees.nom ?? "";
      ctx.detail = `${t("LAKOUR_LOUPS.Etapes.Prochaine")} ${t(`LAKOUR_LOUPS.Etapes.${e.cle}`, { ...e.donnees, nom })}`;
    } catch { /* API pas encore prête */ }
  }
  // Le MJ ouvre et clôt le vote depuis le bandeau, sans passer par la Table.
  if (gm && v.ouvert) bouton("bandeauCloreVote", t("LAKOUR_LOUPS.Table.CloreVote"), "fa-gavel", { principal: true });
  else if (gm && etat.partie && etat.phase === "jour") {
    // Un jour sans Bailli : son élection d'abord (bouton principal) ; le vote d'exécution reste à portée.
    const election = electionDue();
    if (election) bouton("bandeauVoteBailli", t("LAKOUR_LOUPS.Table.VoteBailli"), "fa-stamp", { principal: true });
    bouton("bandeauOuvrirVote", t("LAKOUR_LOUPS.Table.OuvrirVote"), "fa-scale-balanced", { principal: !election });
  }
  if (gm && ctx.boutons.length && !l.mode) ctx.pret = true;
  return ctx;
}

export class BandeauAction extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-bandeau`,
    classes: [ID, "loups-bandeau-jeu"],
    tag: "section",
    window: { frame: false, positioned: false },
    actions: {
      bandeauValider: () => local.valider(),
      bandeauPasser: () => local.passer(),
      bandeauListe: () => local.ouvrirListe(),
      bandeauAbstenir: () => local.abstenir(),
      bandeauAnnuler: () => local.annulerPouvoir(),
      // Grisé (pas le moment, déjà servi) : le clic dit pourquoi, au lieu de ne rien faire.
      bandeauPouvoir: (event, cible) => cible.getAttribute("aria-disabled") === "true" ? ui.notifications.info(cible.dataset.raison) : local.commencerPouvoir(cible.dataset.pouvoir),
      bandeauRole: () => ouvrirCarnet(),
      bandeauTable: () => ouvrirTable(),
      bandeauVoter: () => fenetreVote().render({ force: true }),
      bandeauOuvrirVote: async () => {
        try { await game.lakourLoups.ouvrirVote({}); } catch (e) { ui.notifications.error(e.message); }
      },
      bandeauCloreVote: () => cloreLeVote(),
      bandeauVoteBailli: async () => {
        try { await game.lakourLoups.ouvrirVote({ objet: "bailli" }); } catch (e) { ui.notifications.error(e.message); }
      },
      bandeauPeste: () => crierALaPeste(monVillageois()?.id)
    }
  };

  static PARTS = { bandeau: { template: `systems/${ID}/templates/bandeau.hbs` } };

  async _prepareContext() {
    return contexteBandeau();
  }

  // Au-dessus du canevas, dans l'interface (sinon le corps de la page).
  async _insertElement(element) {
    const hote = document.getElementById("interface") ?? document.body;
    const existant = document.getElementById(element.id);
    if (existant) existant.replaceWith(element);
    else hote.append(element);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    clearInterval(this._minuterie);
    const zone = this.element.querySelector(".lb-minuteur");
    if (!zone) return;
    const tic = () => {
      const finit = Number(zone.dataset.finit) || 0;
      if (!finit) { zone.hidden = true; return; }
      const reste = Math.max(0, Math.ceil((finit - Date.now()) / 1000));
      zone.hidden = false;
      zone.querySelector(".lb-reste").textContent = `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`;
      zone.classList.toggle("urgent", reste > 0 && reste <= 15);
    };
    tic();
    this._minuterie = setInterval(tic, 1000);
  }

  async _onClose(options) {
    clearInterval(this._minuterie);
    return super._onClose(options);
  }
}

let bandeau = null;
export function bandeauAction() {
  bandeau ??= new BandeauAction();
  return bandeau;
}
export function rafraichirBandeau() {
  const b = bandeauAction();
  return b.render({ force: true });
}
