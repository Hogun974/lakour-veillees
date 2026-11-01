// L'étape suivante d'une partie, pour guider le MJ HUMAIN depuis la Table de jeu (le bouton à presser est encadré de
// pointillés, avec une ligne « Prochaine étape : … »). Logique pure, éprouvée en Node (essais/loups-etapes.test.mjs).
//
// etapeSuivante(etatPublic, secretsMJ, contexte) -> { cle, action, donnees, attente, detail }
//   etatPublic : le réglage monde « partie » ; secretsMJ : les secrets du MJ actif (null ailleurs : la nuit se mène
//   alors sans savoir qui a déjà agi) ;
//   contexte : { villageois: [villageois à plat, rôles compris], attente: [roleCle] (réveils en cours : demandes
//   envoyées aux joueurs, sans réponse), ignorer: [cle d'étape écartée par le MJ, ex. « emporter:<id> »] }.
//
// cle : distribuer | nuit | reveiller | attendre | aube | emporter | victoire | debat | ouvrirVote | cloreVote | executer
//       | chapelle | rejouer
// action : le data-action du bouton de la Table qui fait l'étape ("" = rien à presser, on attend les joueurs) ;
// donnees : { phase, role, nom, id, n… } (pour le libellé et pour retrouver le bouton) ;
// detail : { cle, donnees } facultatif (voix manquantes, Juge de paix, Braconnière…).
import { CLE_MEUTE } from "./constantes.mjs";
import { normaliserEtat, fusionnerEtat } from "./etat.mjs";
import { ordreDeNuit } from "./nuit.mjs";
import { verifierVictoire } from "./victoire.mjs";

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
    if (!etat.vainqueur && verifierVictoire({ villageois, morts: etat.morts, primes: etat.primes ?? {} })) return etape("victoire", "victoire");
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
      for (const e of ordreDeNuit(villageois, tour)) {
        if (faits.has(e.roleCle)) continue;
        const roleNom = e.roleCle === CLE_MEUTE ? "" : villageois.find(v => v.id === e.acteurIds[0])?.role?.nom ?? e.roleCle;
        const donnees = { role: e.roleCle, nom: roleNom, meute: e.roleCle === CLE_MEUTE, qui: e.acteurIds.map(nom).join(", ") };
        if (attente.includes(e.roleCle)) return etape("attendre", "", donnees, { attente: true });
        return etape("reveiller", "reveiller", donnees);
      }
      return etape("aube", "aube");
    }
    case "aube": {
      if (etat.nuitResolue !== Math.max(1, etat.tour)) return etape("aube", "aube");
      return apresUneMort() ?? etape("debat", "phase", { phase: "jour" });
    }
    case "jour":
      return apresUneMort() ?? etape("ouvrirVote", "ouvrirVote");
    case "vote": {
      const v = etat.vote;
      if (v.ouvert) {
        const manquent = Math.max(0, vivants.length - v.exprimes.length);
        return etape("cloreVote", "cloreVote", { n: manquent, objet: v.objet },
          manquent ? { detail: { cle: "voixManquantes", donnees: { n: manquent } } } : {});
      }
      const r = v.resultat;
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
