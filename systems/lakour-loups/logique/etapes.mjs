// L'étape suivante d'une partie, pour guider le MJ HUMAIN depuis la Table de jeu (le bouton à presser est encadré de
// pointillés, avec une ligne « Prochaine étape : … »). Logique pure, éprouvée en Node (essais/loups-etapes.test.mjs).
//
// etapeSuivante(etatPublic, secretsMJ, contexte) -> { cle, action, donnees, attente, detail }
//   etatPublic : le réglage monde « partie » ; secretsMJ : les secrets du MJ actif (null ailleurs : la nuit se mène
//   alors sans savoir qui a déjà agi) ;
//   contexte : { villageois: [villageois à plat, rôles compris], attente: [roleCle] (réveils en cours : demandes
//   envoyées aux joueurs, sans réponse), ignorer: [cle d'étape écartée par le MJ, ex. « emporter:<id> »] }.
//
// cle : distribuer | nuit | reveiller | attendre | aube | emporter | victoire | debat | bailli | ouvrirVote | cloreVote
//       | departage | succession | executer | chapelle | rejouer
// action : le data-action du bouton de la Table qui fait l'étape ("" = rien à presser, on attend les joueurs) ;
// donnees : { phase, role, nom, id, n… } (pour le libellé et pour retrouver le bouton) ;
// detail : { cle, donnees } facultatif (voix manquantes, Juge de paix, Braconnière…).
import { CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { normaliserEtat, fusionnerEtat } from "./etat.mjs";
import { ordreDeNuit } from "./nuit.mjs";
import { verifierVictoire } from "./victoire.mjs";
import { electionAttendue, voteExecutionDuJour } from "./bailli.mjs";
import { glasSonne } from "./calendrier.mjs";

const etape = (cle, action, donnees = {}, extra = {}) => ({ cle, action, donnees, attente: false, detail: null, ...extra });

// Ceux qui, morts, doivent encore désigner qui ils emportent (rôle à effet « emporter », la Braconnière) : un par mort
// « emporteur », tant qu'autant de morts « emporte » ne l'ont pas suivi ; seulement le tour de sa mort.
export function emporteursEnAttente(etat, villageois = [], ignorer = []) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const enAttente = [];
  etat.morts.forEach((m, i) => {
    const v = parId.get(m.acteurId);
    if (v?.role?.effet !== "emporter" || m.cause === "emporte" || m.tour !== etat.tour) return;
    const suivis = etat.morts.slice(i + 1).filter(x => x.cause === "emporte").length;
    const avant = enAttente.length;
    if (suivis <= avant && !ignorer.includes(`emporter:${m.acteurId}`)) enAttente.push(m.acteurId);
  });
  return enAttente;
}

// Un vote ouvert : le clore (avec les voix qui manquent encore).
// Les voix qui manquent : celles des vivants (le Dernier souffle d'un mort ne remplace pas une voix vivante).
function cloture(v, vivants) {
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

  // Ce qui passe avant tout, hors de la nuit : une Braconnière qui doit emporter quelqu'un, puis la victoire.
  const apresUneMort = () => {
    const [emporteur] = emporteursEnAttente(etat, villageois, ignorer);
    if (emporteur) return etape("emporter", "emporter", { id: emporteur, nom: nom(emporteur) }, { detail: { cle: "emporter", donnees: { nom: nom(emporteur) } } });
    // Le Glas final (calendrier.mjs) : le jour N fini, la partie s'arrête.
    if (!etat.vainqueur && verifierVictoire({ villageois, morts: etat.morts, glas: glasSonne(etat), primes: etat.primes ?? {}, peste: etat.peste })) return etape("victoire", "victoire");
    return null;
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
      for (const e of ordreDeNuit(villageois, tour, { peste: etat.peste })) {
        if (faits.has(e.roleCle)) continue;
        const groupe = e.roleCle === CLE_MEUTE || e.roleCle === CLE_PESTE;
        const roleNom = groupe ? "" : villageois.find(v => v.id === e.acteurIds[0])?.role?.nom ?? e.roleCle;
        const donnees = { role: e.roleCle, nom: roleNom, meute: e.roleCle === CLE_MEUTE, peste: e.roleCle === CLE_PESTE, qui: e.acteurIds.map(nom).join(", ") };
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
      if (etat.vote.ouvert) return cloture(etat.vote, vivants);
      const apres = apresUneMort();
      if (apres) return apres;
      // Le Bailli défunt remet le sceau (au plus le délai des choix) : on l'attend avant d'élire ou de voter.
      const s = etat.bailli?.succession;
      if (s) return etape("succession", "", { nom: nom(s.de) }, { attente: true });
      // Un jour sans Bailli (bailli.mjs) : son élection d'abord, puis le vote d'exécution.
      return electionAttendue({ etat, villageois }).ok ? etape("bailli", "voteBailli") : etape("ouvrirVote", "ouvrirVote");
    }
    case "vote": {
      const v = etat.vote;
      if (v.ouvert) return cloture(v, vivants);
      const r = v.resultat;
      // Une égalité que le Bailli tranche : on attend son choix.
      if (r?.departage?.enAttente) return etape("departage", "", { nom: nom(r.departage.par) }, { attente: true });
      if (r && r.numero === v.numero && r.objet === "execution") {
        const condamne = (r.elus ?? []).find(id => villageois.find(x => x.id === id)?.vivant !== false);
        if (condamne) {
          // Le Juge de paix, vivant, pas encore révélé, avec son usage : il peut encore annuler (le MJ le sait, lui seul).
          const juge = vivants.find(x => x.role?.effet === "annuler-vote" && !x.revele && !(Number(x.role.usages?.max) > 0 && Number(x.role.usages?.restant) <= 0));
          return etape("executer", "executer", { id: condamne, nom: nom(condamne) }, juge ? { detail: { cle: "juge", donnees: { nom: nom(juge.id) } } } : {});
        }
      }
      const apres = apresUneMort();
      if (apres) return apres;
      // Le Bailli vient d'être élu (ou non) : le vote d'exécution du jour suit.
      if (r?.objet === "bailli" && r.tour === etat.tour && !voteExecutionDuJour(etat)) return etape("ouvrirVote", "ouvrirVote");
      // La Chapelle : un asile pour la nuit qui vient, s'il n'a pas encore été choisi.
      const enJeu = etat.batimentsCles ?? [];
      const asile = (etat.jour?.effets ?? []).some(x => x.type === "asile" && x.nuit === etat.tour + 1);
      const voteChapelle = r && r.objet === "chapelle" && r.tour === etat.tour;
      if (enJeu.includes("chapelle") && !asile && !voteChapelle && r?.objet === "execution") return etape("chapelle", "voteChapelle");
      return etape("nuit", "phase", { phase: "nuit" });
    }
    default:
      return etape("nuit", "phase", { phase: "nuit" });
  }
}

// Les ambiances sonores du MJ IA selon la phase (s'il est actif) : la nuit, et la tension du vote ; "" : silence.
export const AMBIANCES_DE_PHASE = { nuit: "nuit", vote: "tension" };
export const ambianceDePhase = phase => AMBIANCES_DE_PHASE[phase] ?? "";
