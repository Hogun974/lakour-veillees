// La Table de jeu : phase, tour, minuteur, villageois (vivants, morts, rôles révélés, métiers), bâtiments en jeu,
// pouvoirs de jour du joueur (métier, Juge de paix, Conteuse, bâtiments), effets du jour, carnet secret,
// et pendant un vote : boutons de vote pour les vivants ; décompte visible après clôture.
// Le MJ y trouve aussi ses commandes : phases, aube, vote, vote de la Chapelle, éliminer, révéler, victoire, chronique.
// Un joueur ne lit que l'état public : qui a voté (pas pour qui), son propre vote venant de son navigateur (prive.mjs).
// La composition n'y paraît que chez le MJ (avec, s'il y a lieu, la marque « Peste noire » : un secret) ; le jour, chacun peut
// y crier « C'est la peste noire ! » (le MJ, pour un villageois qui le dit à voix haute).
// Le Bailli (public) : son nom en tête, son sceau sur sa carte, l'élection pour le MJ (« Élire le Bailli »), le départage.
// Le Registre du greffier (public) : chaque vote clos, voix par voix, les morts et leur cause publique, le Bailli, et les
// déclarations qu'un vivant y fait inscrire pendant le jour (champ « Déclarer au Registre »).
// Les Gens de passage : leur rôle public sur leur carte (jamais leur camp) ; « Quitter la veillée » pour soi ; le MJ accueille un
// arrivant, ouvre un vote d'exil, fait partir un joueur. Le Banc des accusés : les accusations du jour, et la mienne. Le Glas du
// deuil : son compte (public). La Nuit de la Saint-Martin : sa marque, et sa case à la préparation.
import { ID, PHASES } from "../../logique/constantes.mjs";
import * as L from "../../logique/index.mjs";
import { LONGUEUR_DECLARATION as LONGUEUR } from "../../logique/registre.mjs";
import { diagnosticVoix } from "../../logique/salons.mjs";
import {
  t, lireEtat, tousLesVillageois, monVillageois, roleDe, campDe, amoureuxDe, protectionsDe, metierDe, roleVisible, libellePhase, libelleCamp, libelleCause, libelleRepere,
  libelleVainqueur, villageoisAPlat
} from "../donnees.mjs";
import { envoyerVote, envoyerJour, envoyerCri, envoyerDeclaration, envoyerAccusation, envoyerDepart } from "../api.mjs";
import { estMJActif } from "../canal.mjs";
import { secretsPerdus } from "../secrets.mjs";
import { ecritureBloquee } from "../coffre.mjs";
import { monVote, mesSecrets } from "../prive.mjs";
import { ouvrirChoixLocal } from "./choix.mjs";
import { ouvrirCarnet } from "./carnet.mjs";
import * as MJ from "../actions-mj.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const api = () => game.lakourLoups;
const nomDe = id => game.actors.get(id)?.name ?? id;
const TYPES_EFFETS = ["verrou", "surveille", "gite", "traversee", "taverne", "lame", "cachette", "asile", "ecluse"];
const ICONES_REGISTRE = { vote: "fa-scale-balanced", mort: "fa-cross", bailli: "fa-stamp", declaration: "fa-feather-pointed",
  passage: "fa-person-walking-luggage", accusation: "fa-hand-point-right", deuil: "fa-bell", fete: "fa-star" };

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
      voteChapelle: TableDeJeu.#voteChapelle, voteBailli: TableDeJeu.#voteBailli, declarer: TableDeJeu.#declarer,
      trancher: TableDeJeu.#trancher, nommerBailli: TableDeJeu.#nommerBailli, bonneEtoile: TableDeJeu.#bonneEtoile, glasFinal: TableDeJeu.#glasFinal,
      pouvoir: TableDeJeu.#pouvoir, carnet: () => ouvrirCarnet(),
      eliminer: TableDeJeu.#eliminer, reveler: TableDeJeu.#reveler, victoire: TableDeJeu.#victoire, rejouer: TableDeJeu.#rejouer,
      miseEnScene: () => tenter(() => api().plateau.mettreEnScene({ activer: true })),
      distribuer: TableDeJeu.#distribuer, reveiller: TableDeJeu.#reveiller, reveillerTout: TableDeJeu.#reveillerTout,
      executer: TableDeJeu.#executer, emporter: TableDeJeu.#emporter, emporterPersonne: TableDeJeu.#emporterPersonne,
      prepCocher: TableDeJeu.#prepCocher, prepIA: TableDeJeu.#prepIA, prepRetirerIA: TableDeJeu.#prepRetirerIA,
      prepMode: TableDeJeu.#prepMode, prepRole: TableDeJeu.#prepRole, prepPeste: TableDeJeu.#prepPeste,
      crier: (event, cible) => crierALaPeste(cible.dataset.id),
      accuser: TableDeJeu.#accuser, quitter: TableDeJeu.#quitter, faireQuitter: TableDeJeu.#faireQuitter,
      accueillir: TableDeJeu.#accueillir, voteExil: TableDeJeu.#voteExil, prepSaintMartin: TableDeJeu.#prepSaintMartin,
      voixActiver: TableDeJeu.#voixActiver, voixMicro: TableDeJeu.#voixMicro
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
    // Le Bailli (public) : celui en charge, vivant ; l'élection, si elle peut s'ouvrir.
    const bailli = tenterSync(() => api().bailli(), null);
    const bailliId = bailli?.acteurId ?? "";

    // Le poids des voix d'aujourd'hui (Bailli : double, sauf le jour du sceau fêlé) : pour le décompte à main levée et la pastille.
    const pesees = L.poidsDesVoix(etat, tousLesVillageois().filter(a => a.system.vivant).map(a => a.id));
    // Les gens de passage (rôle public, jamais le camp) et les partis (départ, exil : ni morts ni révélés).
    const gens = tenterSync(() => api().gensDePassage(), []);
    const partis = etat.partis ?? [];
    const fiche = a => {
      const role = roleDe(a), metier = metierDe(a);
      const voitRole = fin || roleVisible(a);
      const mort = etat.morts.find(m => m.acteurId === a.id);
      const parti = partis.find(p => p.acteurId === a.id);
      return {
        passage: gens.find(g => g.acteurId === a.id)?.role ?? "",
        parti: parti ? t(parti.comment === "exil" ? "LAKOUR_LOUPS.Passage.Exile" : "LAKOUR_LOUPS.Passage.Parti", { tour: parti.tour }) : "",
        faireQuitter: gm && a.system.vivant && Boolean(etat.partie) && !fin,
        id: a.id, nom: a.name, img: a.img, vivant: a.system.vivant, maison: libelleRepere(a.system.maison),
        metier: metier?.name ?? "", metierImg: metier?.img ?? "",
        voitRole, roleNom: voitRole ? role?.name ?? "" : "", roleImg: voitRole ? role?.img ?? "" : "",
        camp: voitRole ? libelleCamp(campDe(a)) : "", campCle: voitRole ? campDe(a) : "",
        revele: a.system.revele, silence: a.system.silence, moi: a.id === moi?.id,
        benit: etat.jour.benis.includes(a.id), ruban: etat.jour.rubans.includes(a.id), bailli: Boolean(bailliId) && a.id === bailliId,
        // Le MJ seul sait qui rêve son rôle (secret : l'objet porté est le rôle rêvé).
        somnambule: gm && Boolean(etat.somnambules?.[a.id]) && !etat.somnambules[a.id].devoile,
        souffle: !a.system.vivant && Boolean(etat.souffle?.actif) && !etat.souffle.utilises.includes(a.id),
        joueur: game.users.get(a.system.joueur)?.name ?? "",
        cause: mort ? libelleCause(mort.cause) : "", tourMort: mort?.tour ?? "",
        candidat: v.ouvert && v.candidats.includes(a.id),
        aVote: v.ouvert && v.exprimes.includes(a.id),
        monChoix: v.ouvert && monChoix === a.id,
        // Jour de foire (Almanach) : à main levée, les voix se comptent pendant le vote.
        voix: resultat ? resultat.decompte?.[a.id] ?? 0
          : v.mainLevee ? Object.entries(v.votes ?? {}).filter(([, c]) => c === a.id).reduce((s, [votant]) => s + (pesees[votant] ?? 1), 0) : null,
        montreVoix: Boolean(resultat) || Boolean(v.ouvert && v.mainLevee),
        elu: Boolean(resultat?.elus?.includes(a.id)),
        amoureux: gm && amoureuxDe(a) ? game.actors.get(amoureuxDe(a))?.name ?? "" : "",
        protections: gm ? protectionsDe(a) : 0,
        // Le MJ crie pour un villageois qui le dit à voix haute.
        crier: gm && a.system.vivant && Boolean(tenterSync(() => api().peutCrier(a.id).ok, false))
      };
    };
    const tous = tousLesVillageois().sort((a, b) => a.system.maison.localeCompare(b.system.maison, "fr", { numeric: true }) || a.name.localeCompare(b.name));
    const vivants = tous.filter(a => a.system.vivant).map(fiche);
    const morts = tous.filter(a => !a.system.vivant).map(fiche);

    const batiments = etat.batiments.map(uuid => {
      const d = fromUuidSync(uuid);
      return { uuid, nom: d?.name ?? uuid, img: d?.img ?? "icons/svg/house.svg", repere: libelleRepere(d?.system?.repere ?? "") };
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
        const donnees = { ...e.donnees, nom: e.donnees.meute ? t("LAKOUR_LOUPS.Etapes.LaMeute") : e.donnees.peste ? t("LAKOUR_LOUPS.Etapes.LaPeste") : e.donnees.deuil ? t("LAKOUR_LOUPS.Etapes.LeDeuil") : e.donnees.nom ?? "" };
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
        peutDistribuer: total >= 1,
        peste: Boolean(p.peste),
        saintMartin: p.format === L.FORMAT_SAINT_MARTIN,
        fetes: veilleesAPreparer(p),
        // La Petite tablée (0.11.0) : un rappel de ses règles, et un avis si la table sort de ses clous (1 à 4 humains, 2 à 8 IA).
        tablee: p.niveau === L.NIVEAU_PETITE_TABLEE ? (() => {
          const v = L.verifierTablee({ humains: coches.size, compagnons: ia.length });
          return { aide: t("LAKOUR_LOUPS.Tablee.PreparationAide", { n: L.glasTablee(total) }), avis: v.ok ? "" : t(`LAKOUR_LOUPS.Tablee.Avis.${v.raison}`) };
        })() : null,
        voix: voixDuMonde()
      };
    }

    // Le cri de la peste noire pour mon villageois (vivant, le jour). La composition et la peste noire : au MJ seul (un
    // joueur n'a ni l'une ni l'autre dans son état public).
    const cri = moi ? tenterSync(() => api().peutCrier(moi.id), null) : null;
    // Le Registre du greffier (les plus récentes d'abord) et ma déclaration possible.
    const registre = tenterSync(() => api().registre({ max: 80 }), []).reverse()
      .map(x => ({ type: x.type, icone: ICONES_REGISTRE[x.type] ?? "fa-feather", texte: x.ligne, annule: Boolean(x.annule), tour: x.tour }));
    const declaration = moi ? tenterSync(() => api().peutDeclarer(moi.id), null) : null;
    // Le Banc des accusés (public) : les accusations du jour ; la mienne, si je peux encore accuser (un vivant pas encore accusé).
    const banc = etat.banc?.actif ? tenterSync(() => api().banc(), null) : null;
    let accusation = null;
    if (banc && moi) {
      const p = tenterSync(() => api().peutAccuser(moi.id), null);
      const deja = new Set(banc.accusations.map(x => x.contre));
      accusation = p ? { ok: p.ok, raison: p.raisonTexte,
        cibles: tousLesVillageois().filter(a => a.system.vivant && a.id !== moi.id && !deja.has(a.id)).map(a => ({ id: a.id, nom: a.name })) } : null;
    }
    // Les Gens de passage (MJ) : accueillir un arrivant (un joueur connecté sans villageois en jeu, ou un joueur IA) ; l'exil.
    const passage = gm && etat.passage?.actif && etat.partie && !fin ? {
      accueil: tenterSync(() => api().peutAccueillir(), { ok: false, raisonTexte: "" }),
      exil: !v.ouvert && etat.phase === "jour" && L.candidatsExil(etat, villageoisAPlat()).length > 0
    } : null;
    // Le départage du Bailli : en attente, le MJ peut trancher à sa place (un bouton par ex aequo, ou « personne »).
    const departage = resultat?.departage ? { nom: nomDe(resultat.departage.par), enAttente: Boolean(resultat.departage.enAttente),
      choix: (resultat.departage.choix ?? []).map(nomDe).join(", "),
      candidats: gm && resultat.departage.enAttente ? resultat.departage.candidats.map(id => ({ id, nom: nomDe(id) })) : [] } : null;

    // L'Almanach des brumes (présage du jour, public), le Glas final (public), la Bonne étoile (MJ, secret, avant la 1re aube).
    const presage = tenterSync(() => api().presage(), null);
    const saints = gm ? { etoileOuverte: Boolean(etat.partie) && etat.tour <= 1 && etat.nuitResolue < 1, etoile: etat.bonneEtoile ? nomDe(etat.bonneEtoile) : "",
      vivants: tousLesVillageois().filter(a => a.system.vivant).map(a => ({ id: a.id, nom: a.name, choisi: a.id === etat.bonneEtoile })) } : null;
    // La veillée de fête (publique : son nom, la neige du matin, le masque du défilé) ; ses secrets au MJ actif seul.
    const fete = etat.partie ? feteDeLaTable(mjActif) : null;
    // L'élection quand elle est due (une par jour, avant le vote d'exécution) ; nommer le Bailli à la main quand la charge est vide.
    // secretsPerdus : secrets absents ou plus vieux que le coffre ou parts attendues : rien de la partie ne s'écrit (coffre.mjs).
    return {
      presage: presage?.cle ? presage : null, glas: etat.glas, saints, fete,
      gm, phase: etat.phase, phaseLibelle: libellePhase(etat.phase), tour: etat.tour, fini: fin,
      composition: gm ? etat.composition : "", peste: gm && Boolean(etat.peste?.active), tablee: Boolean(etat.petiteTablee),
      deuil: etat.deuil?.actif ? { compte: etat.deuil.compte } : null, saintMartin: L.estSaintMartin(etat),
      banc, accusation, passage, quitter: Boolean(moi?.system.vivant && etat.partie && !fin),
      vainqueur: libelleVainqueur(etat.vainqueur, etat), crier: Boolean(cri?.ok), moiId: moi?.id ?? "",
      estNuit: etat.phase === "nuit" || etat.phase === "aube",
      phases: PHASES.map(p => ({ cle: p, libelle: libellePhase(p), active: p === etat.phase })),
      vivants, morts, batiments, effets, conteuse, appel, pouvoirs,
      chapelle: gm && (etat.batimentsCles ?? []).includes("chapelle"),
      bailli: bailli?.actif ? { nom: bailli.nom, vacant: !bailliId, succession: bailli.succession?.nom ?? "", moi: Boolean(bailliId) && bailliId === moi?.id } : null,
      voteBailli: gm && Boolean(bailli?.election?.ok),
      nommerBailli: gm && Boolean(bailli?.actif) && !bailliId && !fin && Boolean(etat.partie),
      registre, declaration: declaration ? { ok: declaration.ok, raison: declaration.raisonTexte, max: LONGUEUR } : null,
      secretsPerdus: mjActif && (secretsPerdus(etat) || ecritureBloquee()),
      carnet: Boolean(moi), carnetNombre: mesSecrets().entrees.length,
      moi: moi ? { nom: moi.name, vivant: moi.system.vivant, silence: moi.system.silence } : null,
      vote: {
        ouvert: v.ouvert, double: v.double, majoriteAbsolue: v.majoriteAbsolue, chapelle: v.objet === "chapelle", bailli: v.objet === "bailli",
        exil: v.objet === "exil", banc: v.banc ? nomDe(v.banc.accuse) : "",
        voixDouble: v.objet === "execution" && bailliId && pesees[bailliId] > 1 ? nomDe(bailliId) : "",
        exprimes: v.exprimes.filter(id => vivants.some(x => x.id === id)).length, votants: vivants.length,
        souffles: v.exprimes.filter(id => !vivants.some(x => x.id === id)).length,
        peutVoter: Boolean(v.ouvert && moi && (moi.system.vivant || tenterSync(() => api().peutSouffler(moi.id).ok, false))), minuteur: Boolean(v.finit),
        souffle: Boolean(v.ouvert && moi && !moi.system.vivant), mainLevee: Boolean(v.mainLevee),
        resultat: resultat ? { lignes, egalite: resultat.egalite, personne: !resultat.elus?.length, bailli: resultat.objet === "bailli", sort: Boolean(resultat.sort), departage,
          banc: resultat.banc ? { nom: nomDe(resultat.banc.accuse), pour: resultat.banc.pour, total: resultat.banc.total, condamne: Boolean(resultat.elus?.length) } : null,
          deuil: resultat.deuil ? nomDe(resultat.deuil) : "", exil: resultat.objet === "exil",
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
    this.element.querySelector("select[name=prepFete]")?.addEventListener("change", ev => {
      this.preparation.fete = L.cleDeFete(ev.currentTarget.value);
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
  static #voteBailli() { return tenter(() => api().ouvrirVote({ objet: "bailli" })); }
  // Les Saints du calendrier : la Bonne étoile (choix dans la liste) et le Glas final (jour N, 0 : jamais).
  static #bonneEtoile() {
    const id = this.element.querySelector("select[name=bonneEtoile]")?.value ?? "";
    return tenter(() => api().bonneEtoile(id));
  }
  static #glasFinal() {
    const n = Number(this.element.querySelector("input[name=glasFinal]")?.value) || 0;
    return tenter(() => api().glasFinal(n));
  }
  // Le MJ tranche à la place du Bailli (data-id : l'ex aequo désigné ; vide : personne).
  static #trancher(event, cible) { return tenter(() => api().trancher(cible.dataset.id ? [cible.dataset.id] : [])); }
  // Le MJ remet le sceau à un vivant de son choix (charge vacante, ou succession qui traîne).
  static async #nommerBailli() {
    const options = tousLesVillageois().filter(a => a.system.vivant).map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: "LAKOUR_LOUPS.Table.NommerBailli" },
      content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Bailli.InviteNommer"))}</p><select name="cible">${options}</select>`,
      ok: { callback: (ev, bouton) => bouton.form.elements.cible.value }
    }).catch(() => "");
    if (id) await tenter(() => api().nommerBailli(id));
  }
  // Une déclaration au Registre du greffier : le texte du champ part au MJ actif, qui l'inscrit (ou dit pourquoi non).
  static async #declarer() {
    const champ = this.element.querySelector("input[name=declaration]");
    const texte = champ?.value?.trim();
    if (!texte) return;
    await tenter(() => envoyerDeclaration(texte));
    champ.value = "";
  }
  static #cloreVote() { return cloreLeVote(); }
  // ---------------- le Banc des accusés, les Gens de passage, les départs
  static async #accuser() {
    const contre = this.element.querySelector("select[name=accuse]")?.value ?? "";
    if (contre) await tenter(() => envoyerAccusation(contre));
  }
  static async #quitter() {
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "LAKOUR_LOUPS.Passage.Quitter" },
      content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Passage.QuitterQuestion"))}</p>` });
    if (ok) await tenter(() => envoyerDepart());
  }
  static async #faireQuitter(event, cible) {
    const a = game.actors.get(cible.dataset.id);
    if (!a) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "LAKOUR_LOUPS.Passage.FaireQuitter" },
      content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Passage.FaireQuitterQuestion", { nom: a.name }))}</p>` });
    if (ok) await tenter(() => api().partir(a.id, { comment: "depart" }));
  }
  // Accueillir un gens de passage : un joueur connecté sans villageois en jeu, ou un joueur IA (module MJ IA).
  static async #accueillir() {
    const enJeu = new Set(tousLesVillageois().filter(a => roleDe(a) || !a.system.vivant).map(a => a.system.joueur).filter(Boolean));
    const joueurs = MJ.joueursConnectes().filter(u => !enJeu.has(u.id));
    const options = [...joueurs.map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`),
      ...(MJ.iaDisponible() ? [`<option value="ia">${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Passage.UnIA"))}</option>`] : [])].join("");
    if (!options) return ui.notifications.warn(t("LAKOUR_LOUPS.Passage.Refus.joueur"));
    const choix = await foundry.applications.api.DialogV2.prompt({
      window: { title: "LAKOUR_LOUPS.Passage.Accueillir" },
      content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Passage.InviteAccueil"))}</p><select name="qui">${options}</select>`,
      ok: { callback: (ev, bouton) => bouton.form.elements.qui.value }
    }).catch(() => "");
    if (!choix) return;
    await tenter(async () => {
      const r = choix === "ia" ? await api().accueillir({ acteurId: (await api().compagnons.creer(1))[0] }) : await api().accueillir({ userId: choix });
      ui.notifications.info(t("LAKOUR_LOUPS.Passage.Accueilli", { nom: r.nom }));
    });
  }
  static #voteExil() { return tenter(() => api().ouvrirVote({ objet: "exil" })); }
  static #prepSaintMartin() {
    this.preparation.format = this.preparation.format === L.FORMAT_SAINT_MARTIN ? "" : L.FORMAT_SAINT_MARTIN;
    this.render();
  }
  static async #voixActiver() { await activerVoix(); this.render(); }
  static async #voixMicro() { await donnerMicro(); this.render(); }
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
  static #prepPeste() { this.preparation.peste = !this.preparation.peste; this.render(); }
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
    return tenter(async () => {
      // La peste sans porteur (première nuit) : le MJ choisit sa victime, ou laisse le hasard.
      let options = {};
      if (role === "peste" && !pesteAUnPorteur()) {
        const choix = await choisirVictimeDeLaPeste();
        if (choix === null) return;
        options = { cible: choix };
      }
      this.render();
      await api().reveiller(role, options);
      this.render();
    });
  }
  static #reveillerTout() { return tenter(async () => { await MJ.reveillerTout({ choisirPeste: choisirVictimeDeLaPeste }); this.render(); }); }
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
      ui.notifications.info(g ? libelleVainqueur(g, lireEtat()) : t("LAKOUR_LOUPS.Table.PasEncore"));
    });
  }
}

// Clore le vote (Table de jeu ou bandeau du MJ) : le résultat, puis, après confirmation, l'exécution des élus.
export function cloreLeVote() {
  return tenter(async () => {
    const r = await api().cloreVote();
    if (r.prolonge) return ui.notifications.info(t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: nomDe(r.prolonge) }));
    // L'élection du Bailli : personne n'est exécuté.
    if (r.objet === "bailli") return ui.notifications.info(r.bailli ? t("LAKOUR_LOUPS.Bailli.Elu", { nom: nomDe(r.bailli) }) : t("LAKOUR_LOUPS.Bailli.Personne"));
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

// ---------------- les veillées de fête
// À la préparation : la liste des veillées, celle que le calendrier propose marquée ; la première fois, elle est pré-sélectionnée
// (prep.fete null : rien de choisi encore) ; le MJ décide (« Aucune »). Rien pour une Nuit de la Saint-Martin.
function veilleesAPreparer(p) {
  const v = tenterSync(() => api().veilleesDeFete(), null);
  if (!v) return null;
  if (p.fete === null) p.fete = v.proposee;
  return {
    saintMartin: p.format === L.FORMAT_SAINT_MARTIN,
    options: [{ cle: "", nom: t("LAKOUR_LOUPS.Fetes.Aucune"), choisie: !p.fete },
      ...v.veillees.map(x => ({ cle: x.cle, nom: x.cle === v.calendrier ? `${x.nom} (${t("LAKOUR_LOUPS.Fetes.Proposee")})` : x.nom, choisie: x.cle === p.fete }))],
    aide: p.fete ? v.veillees.find(x => x.cle === p.fete)?.aide ?? "" : t("LAKOUR_LOUPS.Fetes.PreparationAide")
  };
}

// La veillée de fête en jeu : public (nom, aide, neige du matin, masque du défilé) ; ses secrets, au MJ actif seul.
function feteDeLaTable(mjActif) {
  const f = tenterSync(() => api().fete(), null);
  if (!f?.cle) return null;
  const s = mjActif ? tenterSync(() => api().secretsDeFete(), null) : null;
  const secrets = s ? [s.masque ? t(s.masqueTombe ? "LAKOUR_LOUPS.Fetes.Secrets.MasqueTombe" : "LAKOUR_LOUPS.Fetes.Secrets.Masque", { nom: s.masque.nom }) : "",
    s.present ? t(s.presentOuvert ? "LAKOUR_LOUPS.Fetes.Secrets.PresentOuvert" : "LAKOUR_LOUPS.Fetes.Secrets.Present", { nom: s.present.nom }) : "",
    s.promis.length === 2 ? t("LAKOUR_LOUPS.Fetes.Secrets.Promis", { a: s.promis[0].nom, b: s.promis[1].nom }) : ""].filter(Boolean).join(" · ") : "";
  return { nom: f.nom, aide: f.aide, neige: f.neige, defile: f.defile?.nom ?? "", secrets };
}

// ---------------- la peste noire
// Le porteur de la peste (la dernière victime morte de la peste) existe-t-il ? Sinon, le MJ choisit la victime.
const pesteAUnPorteur = () => Boolean(tenterSync(() => api().ordreDeNuit().find(e => e.roleCle === "peste")?.acteurIds.length, 0));

// Le MJ humain choisit la victime de la peste : un villageois, ou « au hasard » (""). null : il renonce.
export async function choisirVictimeDeLaPeste() {
  const candidats = tenterSync(() => api().candidatsDeNuit({ roleCle: "peste" }), []);
  const options = [`<option value="">${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Peste.AuHasard"))}</option>`,
    ...candidats.map(id => `<option value="${id}">${foundry.utils.escapeHTML(nomDe(id))}</option>`)].join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: "LAKOUR_LOUPS.Peste.Partie" },
    content: `<p>${foundry.utils.escapeHTML(t("LAKOUR_LOUPS.Peste.InviteNarrateur"))}</p><select name="cible">${options}</select>`,
    ok: { callback: (ev, bouton) => bouton.form.elements.cible.value }
  }).catch(() => null);
}

// « C'est la peste noire ! » : une confirmation (le crieur risque sa vie), puis le cri part au MJ actif.
export async function crierALaPeste(acteurId) {
  const a = game.actors.get(acteurId);
  if (!a) return;
  const moi = monVillageois()?.id === acteurId;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "LAKOUR_LOUPS.Peste.Crier" },
    content: `<p>${foundry.utils.escapeHTML(moi ? t("LAKOUR_LOUPS.Peste.Confirmer") : t("LAKOUR_LOUPS.Peste.ConfirmerPour", { nom: a.name }))}</p>`
  });
  if (ok) await tenter(() => envoyerCri(acteurId));
}

// ---------------- la voix de Foundry (A/V) : prête pour la veillée ? Réparée d'un clic par le MJ.
const AUDIO_SEUL = 1;
function voixDuMonde() {
  const d = diagnosticVoix({
    mode: game.settings.get("core", "rtcWorldSettings")?.mode ?? 0,
    utilisateurs: game.users.map(u => ({ nom: u.name, isGM: u.isGM, diffuse: u.can("BROADCAST_AUDIO") }))
  });
  return { ...d, muets: d.muets.join(", ") };
}
// Mode « Audio seulement » (pas de vidéo aux Veillées) ; Foundry reconnecte la voix chez chacun.
export function activerVoix() {
  return tenter(async () => {
    const monde = foundry.utils.deepClone(game.settings.get("core", "rtcWorldSettings") ?? {});
    await game.settings.set("core", "rtcWorldSettings", { ...monde, mode: AUDIO_SEUL });
    ui.notifications.info(t("LAKOUR_LOUPS.Preparation.Voix.Activee"));
  });
}
// Le droit de diffuser son micro, donné au rôle « Joueur » (par défaut, seuls les joueurs de confiance l'ont).
export function donnerMicro() {
  return tenter(async () => {
    const droits = foundry.utils.deepClone(game.settings.get("core", "permissions") ?? {});
    droits.BROADCAST_AUDIO = [...new Set([...(droits.BROADCAST_AUDIO ?? []), CONST.USER_ROLES.PLAYER])].sort((x, y) => x - y);
    await game.settings.set("core", "permissions", droits);
    ui.notifications.info(t("LAKOUR_LOUPS.Preparation.Voix.MicroDonne"));
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
