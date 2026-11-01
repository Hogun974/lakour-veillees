// La Table de jeu : phase, tour, minuteur, villageois (vivants, morts, rôles révélés, métiers), bâtiments en jeu,
// pouvoirs de jour du joueur (métier, Juge de paix, Conteuse, bâtiments), effets du jour, carnet secret,
// et pendant un vote : boutons de vote pour les vivants ; décompte visible après clôture.
// Le MJ y trouve aussi ses commandes : phases, aube, vote, vote de la Chapelle, éliminer, révéler, victoire, chronique.
// Un joueur ne lit que l'état public : qui a voté (pas pour qui), son propre vote venant de son navigateur (prive.mjs).
import { ID, PHASES } from "../../logique/constantes.mjs";
import {
  t, lireEtat, tousLesVillageois, monVillageois, roleDe, metierDe, roleVisible, libellePhase, libelleCamp, libelleCause, libelleVainqueur
} from "../donnees.mjs";
import { envoyerVote, envoyerJour } from "../api.mjs";
import { estMJActif } from "../canal.mjs";
import { secretsPerdus } from "../secrets.mjs";
import { monVote, mesSecrets } from "../prive.mjs";
import { ouvrirChoixLocal } from "./choix.mjs";
import { ouvrirCarnet } from "./carnet.mjs";
import * as MJ from "../actions-mj.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const api = () => game.lakourLoups;
const nomDe = id => game.actors.get(id)?.name ?? id;
const TYPES_EFFETS = ["verrou", "surveille", "gite", "traversee", "taverne", "lame", "cachette", "asile"];

async function tenter(fn) {
  try { return await fn(); } catch (e) { ui.notifications.error(e.message); console.error(e); }
}

export class TableDeJeu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-table`,
    classes: [ID, "loups-fenetre", "loups-table"],
    window: { title: "LAKOUR_LOUPS.Table.Titre", icon: "fa-solid fa-fire-flame-curved", resizable: true },
    position: { width: 920, height: 720 },
    actions: {
      voter: TableDeJeu.#voter, abstenir: TableDeJeu.#abstenir, fiche: TableDeJeu.#fiche, batiment: TableDeJeu.#batiment,
      phase: TableDeJeu.#phase, aube: TableDeJeu.#aube, ouvrirVote: TableDeJeu.#ouvrirVote, cloreVote: TableDeJeu.#cloreVote,
      voteChapelle: TableDeJeu.#voteChapelle, pouvoir: TableDeJeu.#pouvoir, carnet: () => ouvrirCarnet(),
      eliminer: TableDeJeu.#eliminer, reveler: TableDeJeu.#reveler, victoire: TableDeJeu.#victoire, rejouer: TableDeJeu.#rejouer,
      miseEnScene: () => tenter(() => api().plateau.mettreEnScene({ activer: true })),
      distribuer: TableDeJeu.#distribuer, reveiller: TableDeJeu.#reveiller, reveillerTout: TableDeJeu.#reveillerTout,
      executer: TableDeJeu.#executer, emporter: TableDeJeu.#emporter, emporterPersonne: TableDeJeu.#emporterPersonne,
      prepCocher: TableDeJeu.#prepCocher, prepIA: TableDeJeu.#prepIA, prepRetirerIA: TableDeJeu.#prepRetirerIA,
      prepMode: TableDeJeu.#prepMode, prepRole: TableDeJeu.#prepRole
    }
  };

  // Le MJ humain : sa préparation de partie (locale à sa Table) et les étapes qu'il a écartées.
  preparation = MJ.nouvellePreparation();
  ignorer = new Set();
  #contenu = null;

  static PARTS = { table: { template: `systems/${ID}/templates/table.hbs`, scrollable: [".loups-colonne"] } };

  async _prepareContext() {
    const etat = lireEtat();
    const gm = game.user.isGM;
    const mjActif = estMJActif();
    const moi = monVillageois();
    const v = etat.vote;
    const fin = etat.phase === "fin";
    const resultat = !v.ouvert ? v.resultat : null;
    const monChoix = !moi ? "" : mjActif ? v.votes[moi.id] ?? "" : monVote(v.numero);

    const fiche = a => {
      const role = roleDe(a), metier = metierDe(a);
      const voitRole = fin || roleVisible(a);
      const mort = etat.morts.find(m => m.acteurId === a.id);
      return {
        id: a.id, nom: a.name, img: a.img, vivant: a.system.vivant, maison: a.system.maison,
        metier: metier?.name ?? "", metierImg: metier?.img ?? "",
        voitRole, roleNom: voitRole ? role?.name ?? "" : "", roleImg: voitRole ? role?.img ?? "" : "",
        camp: voitRole ? libelleCamp(a.system.camp) : "", campCle: voitRole ? a.system.camp : "",
        revele: a.system.revele, silence: a.system.silence, moi: a.id === moi?.id,
        benit: etat.jour.benis.includes(a.id), ruban: etat.jour.rubans.includes(a.id),
        joueur: game.users.get(a.system.joueur)?.name ?? "",
        cause: mort ? libelleCause(mort.cause) : "", tourMort: mort?.tour ?? "",
        candidat: v.ouvert && v.candidats.includes(a.id),
        aVote: v.ouvert && v.exprimes.includes(a.id),
        monChoix: v.ouvert && monChoix === a.id,
        voix: resultat ? resultat.decompte?.[a.id] ?? 0 : null, montreVoix: Boolean(resultat),
        elu: Boolean(resultat?.elus?.includes(a.id)),
        amoureux: gm && a.system.amoureux ? game.actors.get(a.system.amoureux)?.name ?? "" : "",
        protections: gm ? a.system.protections : 0
      };
    };
    const tous = tousLesVillageois().sort((a, b) => a.system.maison.localeCompare(b.system.maison, "fr", { numeric: true }) || a.name.localeCompare(b.name));
    const vivants = tous.filter(a => a.system.vivant).map(fiche);
    const morts = tous.filter(a => !a.system.vivant).map(fiche);

    const batiments = etat.batiments.map(uuid => {
      const d = fromUuidSync(uuid);
      return { uuid, nom: d?.name ?? uuid, img: d?.img ?? "icons/svg/house.svg", repere: d?.system?.repere ?? "" };
    });

    let lignes = [];
    if (resultat) {
      lignes = Object.entries(resultat.decompte ?? {}).sort((a, b) => b[1] - a[1])
        .map(([id, voix]) => ({ nom: nomDe(id), voix, elu: resultat.elus?.includes(id) }));
    }

    // Effets du jour pour la nuit qui vient (tous publics : ils ont été annoncés).
    const prochaine = etat.phase === "nuit" ? etat.tour : etat.tour + 1;
    const effets = TYPES_EFFETS.map(type => ({
      libelle: t(`LAKOUR_LOUPS.Table.Effets.${type}`),
      noms: [...new Set(etat.jour.effets.filter(x => x.type === type && x.nuit === prochaine).map(x => nomDe(x.cible)))].join(", ")
    })).filter(x => x.noms);
    const conteuse = etat.jour.conteuse?.tour === etat.tour && etat.jour.conteuse.jusqua > Date.now() ? nomDe(etat.jour.conteuse.cible) : "";
    const appel = etat.jour.appel?.tour === etat.tour ? etat.jour.appel.ordre.map(nomDe).join(", ") : "";

    // Mes pouvoirs de jour (et, pour le MJ, la Chapelle).
    let pouvoirs = [];
    try {
      pouvoirs = [...(moi ? api().pouvoirsDeJour(moi.id) : []), ...(gm ? api().pouvoirsDeJour("") : [])]
        .map(p => ({ pouvoir: p.pouvoir, nom: p.nom, description: p.description, possible: p.possible, raison: p.raisonTexte }));
    } catch { /* API pas encore prête */ }

    let nuit = null;
    if (gm && etat.phase === "nuit") {
      nuit = {
        ordre: tenterSync(() => api().ordreDeNuit(), []).map(e => ({
          roleCle: e.roleCle, noms: e.acteurIds.map(nomDe).join(", "),
          fait: etat.nuit.actions.some(x => x.roleCle === e.roleCle),
          enCours: (api().reveilsEnCours?.() ?? []).includes(e.roleCle)
        })),
        actions: etat.nuit.actions.map(x => ({
          qui: nomDe(x.acteurId), roleCle: x.roleCle, effet: x.effet ?? "",
          cibles: x.cibles.map(nomDe).join(", ") || "—"
        }))
      };
    }

    const chronique = gm
      ? [...etat.historique.map(h => ({ ...h, secret: false })), ...etat.journalSecret.map(h => ({ ...h, secret: true }))].slice(-30).reverse()
      : [];

    // L'étape suivante (MJ humain) : une ligne, et le bouton à presser encadré de pointillés (_onRender).
    let etape = null;
    if (gm && mjActif) {
      try {
        const e = api().etapeSuivante({ ignorer: [...this.ignorer] });
        const donnees = { ...e.donnees, nom: e.donnees.meute ? t("LAKOUR_LOUPS.Etapes.LaMeute") : e.donnees.nom ?? "" };
        etape = { ...e, texte: t(`LAKOUR_LOUPS.Etapes.${e.cle}`, donnees),
          detail: e.detail ? t(`LAKOUR_LOUPS.Etapes.Detail.${e.detail.cle}`, e.detail.donnees) : "" };
      } catch { etape = null; }
    }
    this._etape = etape;

    // Préparer la partie (MJ, avant la première nuit ou après la fin).
    let preparation = null;
    if (gm && (!etat.partie || ["preparation", "fin"].includes(etat.phase))) {
      this.#contenu ??= await api().contenu().catch(() => null);
      const p = this.preparation;
      const coches = new Set(MJ.joueursCoches(p));
      const ia = MJ.compagnonsDuVillage();
      const total = coches.size + ia.length;
      const contenu = this.#contenu;
      const roles = MJ.rolesManuels(p, total);
      const eq = contenu ? MJ.equilibreDesRoles(roles, contenu.equilibre) : null;
      preparation = {
        joueurs: MJ.joueursConnectes().map(u => ({ id: u.id, nom: u.name, coche: coches.has(u.id) })),
        ia: { disponible: MJ.iaDisponible(), n: ia.length, noms: ia.map(a => a.name).join(", ") },
        total, auto: p.mode === "auto", manuel: p.mode === "manuel",
        niveaux: (contenu?.niveaux ?? ["debutants", "classique", "chaos"]).map(n => ({ cle: n, libelle: t(`LAKOUR_LOUPS.Preparation.Niveaux.${n}`), choisi: n === p.niveau })),
        roles: (contenu?.roles ?? []).map(r => ({ ...r, n: p.roles[r.cle] ?? 0, campLibelle: libelleCamp(r.camp) })),
        choisis: Object.values(p.roles).reduce((a, b) => a + b, 0),
        equilibre: eq && p.mode === "manuel" ? { ...eq, texte: t(`LAKOUR_LOUPS.Preparation.Equilibre.${eq.verdict}`, { somme: eq.somme >= 0 ? `+${eq.somme}` : String(eq.somme) }),
          loupsTexte: t("LAKOUR_LOUPS.Preparation.Loups", { n: eq.loups, conseil: eq.loupsConseilles }) } : null,
        trop: p.mode === "manuel" && Object.values(p.roles).reduce((a, b) => a + b, 0) > total,
        peutDistribuer: total >= 1
      };
    }

    return {
      gm, phase: etat.phase, phaseLibelle: libellePhase(etat.phase), tour: etat.tour, fini: fin,
      composition: etat.composition, vainqueur: libelleVainqueur(etat.vainqueur),
      estNuit: etat.phase === "nuit" || etat.phase === "aube",
      phases: PHASES.map(p => ({ cle: p, libelle: libellePhase(p), active: p === etat.phase })),
      vivants, morts, batiments, effets, conteuse, appel, pouvoirs,
      chapelle: gm && (etat.batimentsCles ?? []).includes("chapelle"),
      secretsPerdus: mjActif && secretsPerdus(etat),
      carnet: Boolean(moi), carnetNombre: mesSecrets().entrees.length,
      moi: moi ? { nom: moi.name, vivant: moi.system.vivant, silence: moi.system.silence } : null,
      vote: {
        ouvert: v.ouvert, double: v.double, majoriteAbsolue: v.majoriteAbsolue, chapelle: v.objet === "chapelle",
        exprimes: v.exprimes.length, votants: vivants.length,
        peutVoter: Boolean(v.ouvert && moi?.system.vivant), minuteur: Boolean(v.finit),
        resultat: resultat ? { lignes, egalite: resultat.egalite, personne: !resultat.elus?.length,
          elus: (resultat.elus ?? []).map(nomDe).join(", "),
          condamnes: resultat.objet === "execution" && resultat.numero === v.numero
            ? (resultat.elus ?? []).filter(id => game.actors.get(id)?.system.vivant).map(id => ({ id, nom: nomDe(id) })) : [] } : null
      },
      historique: chronique,
      etape, preparation, nuit,
      emporteur: etape?.cle === "emporter" ? { id: etape.donnees.id, nom: etape.donnees.nom } : null,
      reveils: gm ? api().reveilsEnCours?.() ?? [] : []
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const e = this._etape;
    if (e?.action) {
      const d = e.donnees ?? {};
      const filtre = e.action === "phase" ? `[data-phase="${d.phase}"]` : e.action === "reveiller" ? `[data-role="${d.role}"]`
        : ["executer", "emporter"].includes(e.action) ? `[data-id="${d.id}"]` : "";
      this.element.querySelector(`button[data-action="${e.action}"]${filtre}`)?.classList.add("loups-etape");
    }
    this.element.querySelector("select[name=prepNiveau]")?.addEventListener("change", ev => {
      this.preparation.niveau = ev.currentTarget.value;
      this.render();
    });
    clearInterval(this._minuterie);
    const zone = this.element.querySelector(".loups-minuteur");
    if (!zone) return;
    const tic = () => {
      const finit = lireEtat().vote.finit;
      if (!finit || !lireEtat().vote.ouvert) { zone.textContent = ""; return; }
      const reste = Math.max(0, Math.ceil((finit - Date.now()) / 1000));
      zone.textContent = reste ? `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}` : t("LAKOUR_LOUPS.Vote.TempsEcouleCourt");
      zone.classList.toggle("urgent", reste > 0 && reste <= 15);
    };
    tic();
    this._minuterie = setInterval(tic, 1000);
  }

  async _onClose(options) {
    clearInterval(this._minuterie);
    return super._onClose(options);
  }

  static #voter(event, cible) { envoyerVote(cible.dataset.id); }
  static #abstenir() { envoyerVote(""); }
  static #fiche(event, cible) { game.actors.get(cible.dataset.id)?.sheet.render({ force: true }); }
  static async #batiment(event, cible) { (await fromUuid(cible.dataset.uuid))?.sheet.render({ force: true }); }
  static #phase(event, cible) { return tenter(() => api().changerPhase(cible.dataset.phase)); }
  static #aube() {
    return tenter(async () => {
      if (lireEtat().phase === "nuit") await api().changerPhase("aube");
      const r = await api().resoudreNuit({ chuchoter: true });
      const noms = r.morts.map(nomDe).join(", ");
      ui.notifications.info(noms ? t("LAKOUR_LOUPS.Table.AubeMorts", { noms }) : t("LAKOUR_LOUPS.Table.AubeCalme"));
      await api().verifierVictoire();
    });
  }
  static #ouvrirVote() { return tenter(() => api().ouvrirVote({})); }
  static #voteChapelle() { return tenter(() => api().ouvrirVote({ objet: "chapelle" })); }
  static #cloreVote() { return cloreLeVote(); }
  // Un pouvoir de jour : on choisit la cible (ou on écrit le dernier mot) ici, puis le MJ actif applique.
  static async #pouvoir(event, cible) {
    const pouvoir = cible.dataset.pouvoir;
    const moi = monVillageois();
    const acteurId = pouvoir === "chapelle" ? "" : moi?.id ?? "";
    const p = api().pouvoirsDeJour(acteurId).find(x => x.pouvoir === pouvoir);
    if (!p) return;
    if (!p.possible) return ui.notifications.warn(p.raisonTexte);
    const envoyer = (cibles = [], texte = "") => envoyerJour({ acteurId, pouvoir, cibles, texte });
    if (p.texte) {
      const texte = await foundry.applications.api.DialogV2.prompt({
        window: { title: p.nom },
        content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Jour.InviteTexte"))}</p><input type="text" name="texte" maxlength="120" autofocus>`,
        ok: { callback: (ev, bouton) => bouton.form.elements.texte.value }
      }).catch(() => "");
      if (texte?.trim()) envoyer([], texte.trim());
    } else if (p.cibles) {
      const invite = (p.source === "metier" ? metierDe(moi)?.system.jour.invite : "") || t("LAKOUR_LOUPS.Jour.InviteCible", { nom: p.nom });
      ouvrirChoixLocal({
        acteurNom: p.nom, invite, nombre: p.cibles,
        candidats: p.candidats.map(c => ({ id: c.id, nom: c.nom, img: game.actors.get(c.id)?.img ?? "", maison: game.actors.get(c.id)?.system.maison ?? "" }))
      }, cibles => { if (cibles.length) envoyer(cibles); });
    } else {
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: p.nom }, content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Jour.Confirmer", { nom: p.nom }))}</p>` });
      if (ok) envoyer();
    }
  }
  static async #eliminer(event, cible) {
    const a = game.actors.get(cible.dataset.id);
    if (!a) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "LAKOUR_LOUPS.Table.Eliminer" }, content: `<p>${t("LAKOUR_LOUPS.Table.EliminerQuestion", { nom: foundry.utils.escapeHTML(a.name) })}</p>`
    });
    if (ok) await tenter(async () => { await api().eliminer(a.id, { cause: "narrateur" }); await api().verifierVictoire(); });
  }
  static #reveler(event, cible) {
    const a = game.actors.get(cible.dataset.id);
    return tenter(() => a?.update({ "system.revele": !a.system.revele }));
  }
  // Rejouer avec les mêmes joueurs (et le même nombre de compagnons IA) : nouvelle partie, nouvelle distribution.
  static async #rejouer() {
    const enCours = !["preparation", "fin"].includes(lireEtat().phase);
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "LAKOUR_LOUPS.Table.Rejouer" },
      content: `<p>${t(enCours ? "LAKOUR_LOUPS.Table.RejouerEnCours" : "LAKOUR_LOUPS.Table.RejouerQuestion")}</p>`
    });
    if (!ok) return;
    return tenter(async () => {
      const r = await api().nouvellePartie({ memesJoueurs: true });
      ui.notifications.info(t("LAKOUR_LOUPS.Table.Rejoue", { n: r.joueurs.length + r.compagnons.length, composition: r.composition.libelle }));
    });
  }
  // ---------------- préparation (MJ humain)
  static #prepCocher(event, cible) { MJ.cocher(this.preparation, cible.dataset.id); this.render(); }
  static #prepIA() { return tenter(async () => { await MJ.ajouterIA(1); this.render(); }); }
  static #prepRetirerIA() { return tenter(async () => { await MJ.retirerIA(); this.render(); }); }
  static #prepMode(event, cible) { this.preparation.mode = cible.dataset.mode === "manuel" ? "manuel" : "auto"; this.render(); }
  static #prepRole(event, cible) { MJ.changerRole(this.preparation, cible.dataset.cle, Number(cible.dataset.delta)); this.render(); }
  static async #distribuer() {
    const enCours = !["preparation", "fin"].includes(lireEtat().phase) && lireEtat().partie;
    if (enCours) {
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "LAKOUR_LOUPS.Preparation.Distribuer" },
        content: `<p>${t("LAKOUR_LOUPS.Table.RejouerEnCours")}</p>` });
      if (!ok) return;
    }
    return tenter(async () => {
      const r = await MJ.distribuer(this.preparation);
      this.ignorer.clear();
      ui.notifications.info(t("LAKOUR_LOUPS.Table.Rejoue", { n: r.joueurs.length + r.compagnons.length, composition: r.composition.libelle }));
      this.render();
    });
  }
  // ---------------- la nuit, rôle par rôle
  static #reveiller(event, cible) {
    const role = cible.dataset.role;
    this.render();
    return tenter(async () => { await api().reveiller(role); this.render(); });
  }
  static #reveillerTout() { return tenter(async () => { await MJ.reveillerTout(); this.render(); }); }
  // ---------------- exécution, Braconnière
  static async #executer(event, cible) {
    const a = game.actors.get(cible.dataset.id);
    if (!a) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "LAKOUR_LOUPS.Table.Executer" }, content: `<p>${t("LAKOUR_LOUPS.Table.ExecuterQuestion", { noms: foundry.utils.escapeHTML(a.name) })}</p>`
    });
    if (ok) await tenter(() => MJ.executer(a.id));
  }
  static async #emporter(event, cible) {
    const emporteur = game.actors.get(cible.dataset.id);
    const vivants = tousLesVillageois().filter(a => a.system.vivant);
    const options = vivants.map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: "LAKOUR_LOUPS.Etapes.emporter" },
      content: `<p>${t("LAKOUR_LOUPS.Etapes.Detail.emporter", { nom: foundry.utils.escapeHTML(emporteur?.name ?? "") })}</p><select name="cible">${options}</select>`,
      ok: { callback: (ev, bouton) => bouton.form.elements.cible.value }
    }).catch(() => "");
    if (id) await tenter(() => MJ.emporter(id));
  }
  static #emporterPersonne(event, cible) { this.ignorer.add(`emporter:${cible.dataset.id}`); this.render(); }
  static #victoire() {
    return tenter(async () => {
      const g = await api().verifierVictoire();
      ui.notifications.info(g ? libelleVainqueur(g) : t("LAKOUR_LOUPS.Table.PasEncore"));
    });
  }
}

// Clore le vote (Table de jeu ou bandeau du MJ) : le résultat, puis, après confirmation, l'exécution des élus.
export function cloreLeVote() {
  return tenter(async () => {
    const r = await api().cloreVote();
    if (r.prolonge) return ui.notifications.info(t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: nomDe(r.prolonge) }));
    if (r.objet === "chapelle") return ui.notifications.info(r.elu ? t("LAKOUR_LOUPS.Table.AsileDonne", { nom: nomDe(r.elu) }) : t("LAKOUR_LOUPS.Journal.VoteNul"));
    if (!r.elus.length) return ui.notifications.info(t("LAKOUR_LOUPS.Journal.VoteNul"));
    const noms = r.elus.map(nomDe).join(", ");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "LAKOUR_LOUPS.Table.Executer" }, content: `<p>${t("LAKOUR_LOUPS.Table.ExecuterQuestion", { noms: foundry.utils.escapeHTML(noms) })}</p>`
    });
    if (!ok) return;
    // Le Juge de paix a pu annuler ce vote pendant que la question était posée : on n'exécute que ce vote-ci.
    const e = lireEtat();
    if (e.vote.ouvert || e.vote.resultat?.numero !== r.numero) return ui.notifications.info(t("LAKOUR_LOUPS.Table.VoteAnnule"));
    for (const id of r.elus) await api().eliminer(id, { cause: "vote" });
    await api().verifierVictoire();
  });
}

function tenterSync(fn, defaut) {
  try { return fn(); } catch { return defaut; }
}

let table = null;
export function tableDeJeu() {
  table ??= new TableDeJeu();
  return table;
}
export function ouvrirTable() {
  return tableDeJeu().render({ force: true });
}
