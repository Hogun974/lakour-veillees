// Le bandeau d'action, en haut de l'écran de chaque joueur (et du MJ) : la phase, le tour et le minuteur, « Mon rôle »
// (le carnet secret), et l'action du moment — « Choisis ta cible » (nuit), « Vote » (clic sur un jeton), un pouvoir de
// jour (« Utiliser : Forgeron »), ou, pour un mort, « Tu es mort : tu observes ». Il remplace les fenêtres, qui restent
// disponibles en secours (« Liste », Table de jeu). Ce qu'il montre de secret (sa sélection, son vote, son rôle) ne
// vient que de ce navigateur : rien n'en sort, sinon le choix validé, au seul MJ actif.
import { ID } from "../../logique/constantes.mjs";
import { t, lireEtat, monVillageois, libellePhase, libelleVainqueur } from "../donnees.mjs";
import { monVote } from "../prive.mjs";
import * as local from "../plateau-local.mjs";
import { ouvrirCarnet } from "./carnet.mjs";
import { ouvrirTable } from "./table.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const nomDe = id => game.actors.get(id)?.name ?? "";
const ICONES = { preparation: "fa-scroll", nuit: "fa-moon", aube: "fa-cloud-sun", jour: "fa-sun", vote: "fa-scale-balanced", fin: "fa-crown" };

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
    vainqueur: etat.phase === "fin" ? libelleVainqueur(etat.vainqueur) : ""
  };
  const bouton = (action, libelle, icone, { principal = false, data = {} } = {}) => ctx.boutons.push({ action, libelle, icone, principal, data: Object.entries(data).map(([k, val]) => ({ k, val })) });
  if (etat.phase === "preparation" && etat.partie && !ctx.annonce) ctx.annonce = t("LAKOUR_LOUPS.Bandeau.NouvellePartie");

  // L'état du joueur : mort, ou réduit au silence.
  if (moi && !moi.system.vivant) ctx.statut = { cle: "mort", icone: "fa-skull", texte: t("LAKOUR_LOUPS.Bandeau.Mort") };
  else if (moi?.system.silence) ctx.statut = { cle: "silence", icone: "fa-comment-slash", texte: t("LAKOUR_LOUPS.Bandeau.Silence") };

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
    ctx.consigne = t(v.objet === "chapelle" ? "LAKOUR_LOUPS.Bandeau.VoteChapelle" : "LAKOUR_LOUPS.Bandeau.Vote");
    ctx.detail = `${v.exprimes.length} / ${game.actors.filter(a => a.type === "villageois" && a.system.vivant).length} ${t("LAKOUR_LOUPS.Vote.OntVote")}`;
    if (l.mode === "vote") {
      ctx.detail += ` · ${t("LAKOUR_LOUPS.Vote.VotreVoix")} ${monChoix ? nomDe(monChoix) : t("LAKOUR_LOUPS.Vote.Personne")}`;
      bouton("bandeauAbstenir", t("LAKOUR_LOUPS.Vote.Abstention"), "fa-hand");
    }
    ctx.pret = true;
  } else if (moi?.system.vivant) {
    // Pouvoirs de jour possibles maintenant.
    try {
      ctx.pouvoirs = game.lakourLoups.pouvoirsDeJour(moi.id).filter(p => p.possible)
        .map(p => ({ pouvoir: p.pouvoir, libelle: t("LAKOUR_LOUPS.Bandeau.Utiliser", { nom: p.nom }) }));
    } catch { ctx.pouvoirs = []; }
    ctx.consigne = t(`LAKOUR_LOUPS.Bandeau.Attente.${etat.phase}`);
  } else if (moi) {
    // Un mort : le Puits peut encore lui offrir un dernier mot.
    try {
      ctx.pouvoirs = game.lakourLoups.pouvoirsDeJour(moi.id).filter(p => p.possible)
        .map(p => ({ pouvoir: p.pouvoir, libelle: t("LAKOUR_LOUPS.Bandeau.Utiliser", { nom: p.nom }) }));
    } catch { ctx.pouvoirs = []; }
  } else ctx.consigne = t(`LAKOUR_LOUPS.Bandeau.Attente.${etat.phase}`);
  if (ctx.vainqueur) ctx.consigne = ctx.vainqueur;
  // Le MJ (sans villageois) : l'étape suivante de la Table de jeu, en rappel.
  if (gm && !moi && !ctx.boutons.length) {
    try {
      const e = game.lakourLoups.etapeSuivante();
      const nom = e.donnees.meute ? t("LAKOUR_LOUPS.Etapes.LaMeute") : e.donnees.nom ?? "";
      ctx.detail = `${t("LAKOUR_LOUPS.Etapes.Prochaine")} ${t(`LAKOUR_LOUPS.Etapes.${e.cle}`, { ...e.donnees, nom })}`;
    } catch { /* API pas encore prête */ }
  }
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
      bandeauPouvoir: (event, cible) => local.commencerPouvoir(cible.dataset.pouvoir),
      bandeauRole: () => ouvrirCarnet(),
      bandeauTable: () => ouvrirTable()
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
      if (!finit) { zone.textContent = ""; zone.hidden = true; return; }
      const reste = Math.max(0, Math.ceil((finit - Date.now()) / 1000));
      zone.hidden = false;
      zone.textContent = `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`;
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
