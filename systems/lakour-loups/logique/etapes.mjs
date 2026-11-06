// L'étape suivante d'une partie, pour guider le MJ HUMAIN depuis la Table de jeu (le bouton à presser est encadré de
// pointillés, avec une ligne « Prochaine étape : … »). Logique pure, éprouvée en Node (essais/loups-etapes.test.mjs).
//
// etapeSuivante(etatPublic, secretsMJ, contexte) -> { cle, action, donnees, attente, detail }
//   etatPublic : le réglage monde « partie » ; secretsMJ : les secrets du MJ actif (null ailleurs : la nuit se mène
//   alors sans savoir qui a déjà agi) ;
//   contexte : { villageois: [villageois à plat, rôles compris], attente: [roleCle] (réveils en cours : demandes
//   envoyées aux joueurs, sans réponse ; « geste:<acteurId> » : un dernier geste demandé au mourant, derniers-gestes.mjs),
//   ignorer: [cle d'étape écartée par le MJ, ex. « emporter:<id> »] }.
//
// cle : distribuer | nuit | reveiller | attendre | aube | emporter | victoire | debat | bailli | ouvrirVote | juger | cloreVote
//       | departage | succession | executer | chapelle | rejouer
// Le Banc des accusés (banc.mjs) : « juger » (ouvrirVote : le prochain accusé) ; sans accusé, la nuit (detail « bancVide »).
// La Nuit de la Saint-Martin (saintmartin.mjs) : sa fin tombe après son unique vote (verifierVictoire, saintMartin).
// action : le data-action du bouton de la Table qui fait l'étape ("" = rien à presser, on attend les joueurs) ;
// donnees : { phase, role, nom, id, n… } (pour le libellé et pour retrouver le bouton) ;
// detail : { cle, donnees } facultatif (voix manquantes, Juge de paix, Braconnière…).
import { CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { normaliserEtat, fusionnerEtat } from "./etat.mjs";
import { ordreDeNuit } from "./nuit.mjs";
import { verifierVictoire } from "./victoire.mjs";
import { electionAttendue, voteExecutionDuJour } from "./bailli.mjs";
import { glasSonne } from "./calendrier.mjs";
import { visionDuDeuilDue, CLE_DEUIL } from "./deuil.mjs";
import { prochainAccuse } from "./banc.mjs";
import { estSaintMartin, saintMartinFinie } from "./saintmartin.mjs";
import { pariteStricteTablee } from "./tablee.mjs";
import { gestesEnAttente } from "./derniers-gestes.mjs";
import { filtrerVotants, gracieAuVote, sagesseEstPerdue } from "./pacte.mjs";

const etape = (cle, action, donnees = {}, extra = {}) => ({ cle, action, donnees, attente: false, detail: null, ...extra });

// Ceux qui, morts, doivent encore désigner qui ils emportent (rôle à effet « emporter », la Braconnière) : le compte des
// derniers gestes (derniers-gestes.mjs) — un par mort « emporteur », servi par la première mort « emporte » qui le suit ;
// seulement le tour de sa mort.
export function emporteursEnAttente(etat, villageois = [], ignorer = []) {
  return gestesEnAttente(etat, villageois, ignorer).filter(g => g.geste === "emporter").map(g => g.acteurId);
}

// Un vote ouvert : le clore (avec les voix qui manquent encore).
// Les voix qui manquent : celles des vivants (le Dernier souffle d'un mort ne remplace pas une voix vivante) qui ont le droit de
// voter (pacte.mjs : ni un Innocent gracié, ni, le lendemain du Souffre-douleur, qui n'est pas sur sa liste).
function cloture(v, tous, etat) {
  const vivants = tous.filter(x => filtrerVotants(etat, [x.id], v.objet).length);
  const ids = new Set(vivants.map(x => x.id));
  const manquent = Math.max(0, vivants.length - v.exprimes.filter(id => ids.has(id)).length);
  return etape("cloreVote", "cloreVote", { n: manquent, objet: v.objet }, manquent ? { detail: { cle: "voixManquantes", donnees: { n: manquent } } } : {});
}

export function etapeSuivante(etatPublic, secretsMJ = null, { villageois = [], attente = [], ignorer = [] } = {}) {
  const etat = secretsMJ ? fusionnerEtat(etatPublic, secretsMJ) : normaliserEtat(etatPublic);
  const nom = id => villageois.find(v => v.id === id)?.nom ?? "";
  const vivants = villageois.filter(v => v.vivant !== false);
  if (!etat.partie || !villageois.length) return etape("distribuer", "distribuer");
  if (etat.phase === "fin") return etape("rejouer", "rejouer", { vainqueur: etat.vainqueur });

  // Ce qui passe avant tout, hors de la nuit : une Braconnière qui doit emporter quelqu'un, puis la victoire. Elle choisit
  // elle-même (derniers-gestes.mjs) : tant que la question est chez elle, on l'attend — le bouton reste, le MJ peut trancher.
  const apresUneMort = () => {
    const [emporteur] = emporteursEnAttente(etat, villageois, ignorer);
    const demande = Boolean(emporteur) && attente.includes(`geste:${emporteur}`);
    if (emporteur) return etape("emporter", "emporter", { id: emporteur, nom: nom(emporteur) }, { attente: demande, detail: { cle: demande ? "emporterDemande" : "emporter", donnees: { nom: nom(emporteur) } } });
    // Le Glas final (calendrier.mjs) : le jour N fini, la partie s'arrête.
    // En petite tablée, au régime des deux loups, la meute doit être plus nombreuse (même règle que api.pariteStricte).
    const strict = Boolean(etat.petiteTablee) && pariteStricteTablee(etat.places || villageois.filter(v => v.vivant !== false).length);
    if (!etat.vainqueur && verifierVictoire({ villageois, morts: etat.morts, glas: glasSonne(etat), primes: etat.primes ?? {}, peste: etat.peste,
      saintMartin: estSaintMartin(etat) ? saintMartinFinie(etat, villageois) : null, strict })) return etape("victoire", "victoire");
    return null;
  };
  // La Chapelle : un asile pour la nuit qui vient, s'il n'a pas encore été choisi aujourd'hui (l'ours du Montreur n'en est pas un).
  const chapelleDue = () => (etat.batimentsCles ?? []).includes("chapelle")
    && !(etat.jour?.effets ?? []).some(x => x.type === "asile" && !x.origine && x.nuit === etat.tour + 1)
    && !(etat.registre ?? []).some(x => x.type === "vote" && x.objet === "chapelle" && x.tour === etat.tour);
  // Le vote d'exécution du jour : avec le Banc des accusés, le jugement du prochain accusé ; sans accusé, la Chapelle si elle
  // est due, puis la nuit peut tomber.
  const voteDuJour = () => {
    if (!etat.banc?.actif) return etape("ouvrirVote", "ouvrirVote");
    const accuse = prochainAccuse(etat, villageois);
    if (accuse) return etape("juger", "ouvrirVote", { id: accuse, nom: nom(accuse) });
    const vide = { detail: { cle: "bancVide", donnees: {} } };
    return chapelleDue() ? etape("chapelle", "voteChapelle", {}, vide) : etape("nuit", "phase", { phase: "nuit" }, vide);
  };

  switch (etat.phase) {
    case "preparation":
      return etape("nuit", "phase", { phase: "nuit" });
    case "nuit": {
      const tour = Math.max(1, etat.tour);
      if (etat.nuitResolue === tour) return apresUneMort() ?? etape("debat", "phase", { phase: "jour" });
      if (!secretsMJ) return etape("aube", "aube", {}, { detail: { cle: "sansSecrets", donnees: {} } });
      const faits = new Set(etat.nuit.actions.map(a => a.roleCle));
      // Peste noire (secret du MJ) : l'étape « la peste », à la place de la meute ; qui : son porteur, s'il y en a un.
      for (const e of ordreDeNuit(villageois, tour, { peste: etat.peste, deuil: visionDuDeuilDue(etat, villageois), sagessePerdue: sagesseEstPerdue(etat) })) {
        if (faits.has(e.roleCle)) continue;
        const groupe = e.roleCle === CLE_MEUTE || e.roleCle === CLE_PESTE || e.roleCle === CLE_DEUIL;
        const roleNom = groupe ? "" : villageois.find(v => v.id === e.acteurIds[0])?.role?.nom ?? e.roleCle;
        const donnees = { role: e.roleCle, nom: roleNom, meute: e.roleCle === CLE_MEUTE, peste: e.roleCle === CLE_PESTE, qui: e.acteurIds.map(nom).join(", "),
          ...(e.roleCle === CLE_DEUIL ? { deuil: true } : {}) };
        if (attente.includes(e.roleCle)) return etape("attendre", "", donnees, { attente: true });
        return etape("reveiller", "reveiller", donnees);
      }
      return etape("aube", "aube");
    }
    case "aube": {
      if (etat.nuitResolue !== Math.max(1, etat.tour)) return etape("aube", "aube");
      return apresUneMort() ?? etape("debat", "phase", { phase: "jour" });
    }
    case "jour": {
      // L'élection du Bailli se tient au débat, sans changer de phase : ouverte, on la clôt.
      if (etat.vote.ouvert) return cloture(etat.vote, vivants, etat);
      const apres = apresUneMort();
      if (apres) return apres;
      // Le Bailli défunt remet le sceau (au plus le délai des choix) : on l'attend avant d'élire ou de voter.
      const s = etat.bailli?.succession;
      if (s) return etape("succession", "", { nom: nom(s.de) }, { attente: true });
      // Un jour sans Bailli (bailli.mjs) : son élection d'abord, puis le vote d'exécution.
      return electionAttendue({ etat, villageois }).ok ? etape("bailli", "voteBailli") : voteDuJour();
    }
    case "vote": {
      const v = etat.vote;
      if (v.ouvert) return cloture(v, vivants, etat);
      const r = v.resultat;
      // Une égalité que le Bailli tranche : on attend son choix.
      if (r?.departage?.enAttente) return etape("departage", "", { nom: nom(r.departage.par) }, { attente: true });
      if (r && r.numero === v.numero && r.objet === "execution") {
        // L'Innocent gracié par ce vote reste en vie : il n'y a plus rien à exécuter pour lui.
        const condamne = (r.elus ?? []).find(id => villageois.find(x => x.id === id)?.vivant !== false && !gracieAuVote(etat, id, r.numero));
        if (condamne) {
          // Le Juge de paix, vivant, pas encore révélé, avec son usage : il peut encore annuler (le MJ le sait, lui seul).
          const juge = vivants.find(x => x.role?.effet === "annuler-vote" && !x.revele && !(Number(x.role.usages?.max) > 0 && Number(x.role.usages?.restant) <= 0));
          return etape("executer", "executer", { id: condamne, nom: nom(condamne) }, juge ? { detail: { cle: "juge", donnees: { nom: nom(juge.id) } } } : {});
        }
      }
      const apres = apresUneMort();
      if (apres) return apres;
      // Le Bailli vient d'être élu (ou non), ou un vote d'exil : le vote d'exécution du jour suit, s'il n'a pas déjà eu lieu (le
      // Registre le dit) ; après un exil, l'élection du Bailli d'abord, si elle est due.
      if ((r?.objet === "bailli" || r?.objet === "exil") && r.tour === etat.tour && !voteExecutionDuJour(etat)) {
        return electionAttendue({ etat, villageois }).ok ? etape("bailli", "voteBailli") : voteDuJour();
      }
      // Le Banc : un accusé acquitté, le suivant est jugé (tant que personne n'a été exécuté ce jour-là).
      if (r?.banc && r.objet === "execution" && r.tour === etat.tour && prochainAccuse(etat, villageois)) return voteDuJour();
      // La Chapelle, après le vote d'exécution du jour (même suivi d'un exil).
      const voteChapelle = r && r.objet === "chapelle" && r.tour === etat.tour;
      if (chapelleDue() && !voteChapelle && voteExecutionDuJour(etat)) return etape("chapelle", "voteChapelle");
      return etape("nuit", "phase", { phase: "nuit" });
    }
    default:
      return etape("nuit", "phase", { phase: "nuit" });
  }
}

// Les ambiances sonores du MJ IA selon la phase (s'il est actif) : la nuit, et la tension du vote ; "" : silence.
export const AMBIANCES_DE_PHASE = { nuit: "nuit", vote: "tension" };
export const ambianceDePhase = phase => AMBIANCES_DE_PHASE[phase] ?? "";
