// Pouvoirs de JOUR (métiers, Juge de paix, Conteuse, bâtiments) et effets du jour sur la nuit suivante. Logique pure.
//
// Un pouvoir de jour se désigne par sa CLÉ : celle du métier (« forgeron »), du rôle (« juge-de-paix », « conteuse »)
// ou du bâtiment (« taverne », « forge », « grange », « puits », « chapelle »).
//
// verifierPouvoir({ villageois, etat, acteurId, pouvoir, cibles, texte, batiments }) -> { ok, raison, def, candidats }
// appliquerPouvoir({ ...les mêmes, hasard, maintenant }) -> { ok, raison, etat, annonces, prives, changements, rouvrirVote }
//   annonces : [msg] publiques (tout le village) ; prives : [msg] pour un joueur ; msg = { destinataire, cle, texte, donnees }
//   changements : [{ type: "usage", acteurId, objet: "metier" | "role" } | { type: "revele", acteurId }
//                  | { type: "silence", acteurId, valeur }] que Foundry applique aux documents.
//   Le Village (personnalites.mjs) : + morts ([{ acteurId, cause }] : le rasoir du Perruquier, que Foundry applique), village
//   ({ quoi, acteurId, ids } : l'entrée du Registre).
//   villageois « à plat » : { id, nom, vivant, revele, camp, maison, silence, role: { cle, usages }, metier: { cle, usages } }
//   batiments : clés des bâtiments en jeu (etat.batimentsCles).
//
// Les effets posés de jour vivent dans etat.jour.effets : [{ type, acteurId, cible, nuit }] et valent pour la nuit n° `nuit`
// (la nuit qui suit ce jour). effetsDeLaNuit(etat, tour) les regroupe pour resoudreNuit().

import { CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { EFFET_SPIRITISME, raisonDeLaRevocation, nommerLeCrieur, normaliserGazette } from "./gazette.mjs";
import { voteExecutionDuJour } from "./bailli.mjs";
import { choisir } from "./hasard.mjs";
import { normaliserEtat, ouvrirVote } from "./etat.mjs";
import { numeroDeMaison, surLAutreRive } from "./distribution.mjs";
import { marquerAnnule } from "./registre.mjs";
import { presageDeLaNuit } from "./almanach.mjs";
import { etoilesDeLaNuit } from "./calendrier.mjs";
import { linceulDeLaNuit } from "./deuil.mjs";
import { aveuglePar, masqueDuCarnaval, presentDeLaNuit, neigeDuJour } from "./fetes.mjs";
import { campInverse } from "./somnambule.mjs";
import { nuitBlancheTablee } from "./tablee.mjs";
import { elider, remplir } from "./grammaire.mjs";
import { roleEmprunte, normaliserAmbigusSecret, candidatsDuCharme, CLE_CHARMES, EFFET_CHAPARDEUR, EFFET_BATELEUR, EFFET_MATIN, EFFET_VIELLE,
  EFFET_LOUP_PALE } from "./ambigus.mjs";
import { vendangesActives, proiesDesVendanges, gardeDesVendanges, CLE_MUR, CLE_TROMPERIE } from "./variantes.mjs";
import { rendreLaPlume, sagesseEstPerdue, pouvoirPerdu, furetAveugle, candidatsDeLaPlume, normaliserPacte, normaliserPacteSecret,
  EFFET_FURET, EFFET_PIE, CLE_GREFFIER } from "./pacte.mjs";
import { occupant, raisonDuPouvoir, marquerEpuise, retablir, batimentDe, estChemineau, cabaretierImmunise, candidatsDuVillageois,
  candidatsDuRemegeux, candidatsDeLIncendiaire, normaliserVillage, EFFET_INCENDIAIRE, CIBLES_DU_REGENT } from "./personnalites.mjs";

export const MATIN = ["aube", "jour"];             // « au matin », « au début d'un débat »
export const JOURNEE = ["aube", "jour", "vote"];   // « pendant le jour »

export const LITS_DE_LA_TAVERNE = 3;
export const PLACES_DE_LA_GRANGE = 2;
export const DUREE_CONTEUSE = 120000;   // ms
export const PAROLE_APPEL = 30;         // s par joueur
export const MOTS_DU_PUITS = 10;
export const LONGUEUR_MESSAGE = 200;    // caractères d'un mot porté par le Messager

// source : d'où vient le pouvoir ; cibles : joueurs à désigner ; soiMeme : peut se désigner ; phases : quand ;
// apresNuit : seulement le jour qui suit une nuit résolue ; narrateur : décidé par le village, appliqué par le MJ ;
// texte : demande un texte ; mort : réservé aux morts ; revele : le rôle est révélé en l'utilisant ; usageDiffere : l'usage n'est
// pas pris quand le pouvoir est annoncé, mais quand il sert (le Greffier bègue : à l'ouverture du second vote).
// source « tenure » (Le Pacte, étape 4, personnalites.mjs) : le pouvoir d'un bâtiment de la variante « Le Village », qui appartient à
// son occupant ACTUEL (occupant, tenures du socle) ; unique : une fois (l'usage rangé dans etat.village.epuises, avec l'occupant qui
// l'a pris) ; ciblesMin : il peut en désigner moins que cibles (le Régent : un ou deux).
export const POUVOIRS_JOUR = {
  forgeron: { source: "metier", cibles: 1, soiMeme: true, phases: JOURNEE },
  meuniere: { source: "metier", cibles: 0, phases: MATIN },
  garde: { source: "metier", cibles: 1, soiMeme: false, phases: JOURNEE },
  cure: { source: "metier", cibles: 1, soiMeme: true, phases: JOURNEE },
  chasseresse: { source: "metier", cibles: 1, soiMeme: false, phases: MATIN, apresNuit: true },
  aubergiste: { source: "metier", cibles: 1, soiMeme: true, phases: JOURNEE },
  apothicaire: { source: "metier", cibles: 1, soiMeme: true, phases: MATIN },
  "colporteur-de-nouvelles": { source: "metier", cibles: 0, phases: MATIN, apresNuit: true },
  tisserande: { source: "metier", cibles: 1, soiMeme: true, phases: JOURNEE },
  passeur: { source: "metier", cibles: 1, soiMeme: true, phases: JOURNEE },
  tanneur: { source: "metier", cibles: 1, phases: MATIN, apresNuit: true },
  "maitresse-d-ecole": { source: "metier", cibles: 1, soiMeme: true, phases: MATIN },
  ramoneuse: { source: "metier", cibles: 1, soiMeme: true, phases: MATIN, apresNuit: true },
  eclusiere: { source: "metier", cibles: 0, phases: JOURNEE },
  "juge-de-paix": { source: "role", cibles: 0, phases: ["vote"], revele: true },
  conteuse: { source: "role", cibles: 1, soiMeme: false, phases: MATIN },
  // Le Sonneur sonne la cloche, une fois : le vote d'exécution ouvert (ou, pendant le débat, le prochain) désignera deux condamnés.
  sonneur: { source: "role", cibles: 0, phases: JOURNEE, revele: true },
  // Les Gens de passage (passage.mjs) : un pouvoir fort, une fois, de jour.
  remouleur: { source: "role", cibles: 1, soiMeme: true, phases: JOURNEE },
  "montreur-d-ours": { source: "role", cibles: 1, soiMeme: true, phases: JOURNEE },
  pelerine: { source: "role", cibles: 1, soiMeme: false, phases: JOURNEE },
  // Le Greffier bègue (Pacte, étape 3a) : une fois par partie, pendant un vote d'exécution ou juste après qu'il a désigné un condamné,
  // un signe secret au narrateur : un second vote d'exécution, sans débat, dès que les condamnés sont tombés. Il ne se révèle pas.
  [CLE_GREFFIER]: { source: "role", cibles: 0, phases: ["vote"], usageDiffere: true },
  // Le Village (personnalites.mjs) : le Prieur (une carte montrée en secret), le Remégeux (un pouvoir unique rendu), le Régent
  // (jusqu'à deux privés de vote, chaque jour, avant le vote), le Perruquier (son rasoir). Le Hobereau, le Prévôt et les Métayers
  // agissent par des demandes (api.mjs), le Cabaretier et la Fournière d'eux-mêmes.
  prieure: { source: "tenure", cibles: 1, soiMeme: false, phases: JOURNEE, unique: true },
  masure: { source: "tenure", cibles: 1, soiMeme: false, phases: JOURNEE, unique: true },
  ecole: { source: "tenure", cibles: CIBLES_DU_REGENT, ciblesMin: 1, soiMeme: false, phases: ["jour"] },
  echoppe: { source: "tenure", cibles: 1, soiMeme: false, phases: JOURNEE, unique: true },
  // Le Crieur public (Le Pacte, étape 9, gazette.mjs) : le Bailli peut le révoquer, après son annonce et avant le vote, et en nommer un
  // autre (source « charge » : le pouvoir de la charge de Bailli tant qu'il y a un Crieur).
  "crieur-public": { source: "charge", cibles: 1, soiMeme: false, phases: MATIN },
  taverne: { source: "batiment", cibles: 0, phases: JOURNEE },
  forge: { source: "batiment", cibles: 0, phases: JOURNEE },
  grange: { source: "batiment", cibles: 0, phases: JOURNEE },
  puits: { source: "batiment", cibles: 0, phases: JOURNEE, texte: true, mort: true },
  chapelle: { source: "batiment", cibles: 1, phases: ["jour", "vote"], narrateur: true }
};
// Bâtiments dont un joueur peut se servir lui-même (la Chapelle, c'est le village qui désigne).
export const BATIMENTS_DES_JOUEURS = ["taverne", "forge", "grange", "puits"];

const msg = (destinataire, cle, texte, donnees = {}) => ({ destinataire, cle: `LAKOUR_LOUPS.Jour.${cle}`, texte, donnees });
const vivant = v => Boolean(v) && v.vivant !== false;

// ------------------------------------------------------------------ ce que possède un villageois
// etat : pour les bâtiments tenus de la variante « Le Village » (l'occupant actuel en a le pouvoir).
export function pouvoirsPossedes(acteur, batiments = [], etat = null) {
  const liste = [];
  if (!acteur) return liste;
  const m = acteur.metier?.cle;
  if (POUVOIRS_JOUR[m]?.source === "metier") liste.push(m);
  const r = acteur.role?.cle;
  if (POUVOIRS_JOUR[r]?.source === "role") liste.push(r);
  for (const b of BATIMENTS_DES_JOUEURS) if (batiments.includes(b)) liste.push(b);
  if (etat) for (const [cle, def] of Object.entries(POUVOIRS_JOUR)) if (def.source === "tenure" && occupant(etat, cle) === acteur.id) liste.push(cle);
  // Le Bailli en charge, quand un Crieur public est nommé : il peut le révoquer.
  const crieur = etat ? normaliserGazette(etat.gazette).crieur : null;
  if (crieur?.actif && crieur.acteurId && etat.bailli?.actif && etat.bailli.acteurId === acteur.id) liste.push("crieur-public");
  return liste;
}
const ciblesMin = def => def.ciblesMin ?? def.cibles;

const effetsPour = (etat, type, nuit) => etat.jour.effets.filter(x => x.type === type && x.nuit === nuit);
const dormeursTaverne = (etat, nuit) => [...new Set([...effetsPour(etat, "taverne", nuit), ...effetsPour(etat, "gite", nuit)].map(x => x.cible))];
const mortsDeLaNuit = (etat, villageois) => villageois.filter(v => !vivant(v)
  && etat.morts.some(m => m.acteurId === v.id && m.tour === etat.tour && (m.phase === "nuit" || m.phase === "aube"))).map(v => v.id);

export function candidatsDuPouvoir({ villageois = [], etat: e, acteurId = "", pouvoir }) {
  const etat = normaliserEtat(e);
  const def = POUVOIRS_JOUR[pouvoir];
  if (!def || !def.cibles) return [];
  const vivants = villageois.filter(vivant);
  switch (pouvoir) {
    case "tanneur": return mortsDeLaNuit(etat, villageois);
    case "apothicaire": return vivants.filter(v => v.silence).map(v => v.id);
    case "chasseresse": return villageois.filter(v => v.id !== acteurId).map(v => v.id);
    case "chapelle": {
      const hier = effetsPour(etat, "asile", etat.tour).filter(x => !x.origine).map(x => x.cible);
      return vivants.filter(v => !hier.includes(v.id)).map(v => v.id);
    }
    // Le Village : ni le Régent ni le Perruquier n'ont prise sur un Chemineau ; le Remégeux, sur ceux dont le pouvoir unique a servi.
    case "ecole":
    case "echoppe": return candidatsDuVillageois(etat, villageois, acteurId, { sansChemineaux: true });
    case "masure": return candidatsDuRemegeux(etat, villageois, acteurId);
    // Le Crieur public : un autre vivant que le Bailli et que le Crieur révoqué.
    case "crieur-public": return vivants.filter(v => v.id !== acteurId && v.id !== normaliserGazette(etat.gazette).crieur.acteurId).map(v => v.id);
    default: return vivants.filter(v => def.soiMeme || v.id !== acteurId).map(v => v.id);
  }
}

// ------------------------------------------------------------------ vérification
const compterMots = t => String(t ?? "").trim().split(/\s+/).filter(Boolean).length;

export function verifierPouvoir({ villageois = [], etat: e, acteurId = "", pouvoir, cibles = [], texte = "", batiments } = {}) {
  const etat = normaliserEtat(e);
  const enJeu = batiments ?? etat.batimentsCles;
  const def = POUVOIRS_JOUR[pouvoir];
  const non = raison => ({ ok: false, raison, def, candidats: [] });
  if (!def) return non("inconnu");
  const acteur = villageois.find(v => v.id === acteurId) ?? null;
  if (def.source === "batiment" && !enJeu.includes(pouvoir)) return non("batiment");
  if (!def.narrateur) {
    if (!acteur || !pouvoirsPossedes(acteur, enJeu, etat).includes(pouvoir)) return non("absent");
  }
  if (!def.phases.includes(etat.phase)) return non("phase");
  if (!def.narrateur) {
    if (def.mort ? vivant(acteur) : !vivant(acteur)) return non(def.mort ? "vivant" : "mort");
    const objet = def.source === "metier" ? acteur.metier : def.source === "role" ? acteur.role : null;
    if (objet && Number(objet.usages?.max) > 0 && Number(objet.usages?.restant) <= 0) return non("usage");
    // Le village a perdu sa sagesse (l'Aïeul, pacte.mjs) : plus aucun métier, plus aucun pouvoir de rôle du Village.
    if (sagesseEstPerdue(etat) && (def.source === "metier" || (def.source === "role" && pouvoirPerdu(true, acteur.role)))) return non("sagesse");
    // Le Village (personnalites.mjs) : le bâtiment entre ses mains, la sagesse du village, le pouvoir unique pas encore servi par lui.
    if (def.source === "tenure") {
      const raison = raisonDuPouvoir(etat, pouvoir, acteurId);
      if (raison) return non(raison);
    }
  }
  if (def.apresNuit && !(etat.tour >= 1 && etat.nuitResolue === etat.tour)) return non("nuit");
  // La neige de la Veillée d'hiver a recouvert les traces : ces pouvoirs du matin attendent un autre jour (l'usage n'est pas pris).
  if (aveuglePar(etat, pouvoir)) return non("neige");

  const nuit = etat.tour + 1;
  const v = etat.vote;
  switch (pouvoir) {
    case "juge-de-paix": {
      const r = v.resultat;
      const parId = new Map(villageois.map(x => [x.id, x]));
      if (v.ouvert || !r || r.objet !== "execution" || r.departage?.enAttente || !r.elus?.length || r.numero !== v.numero || !r.elus.every(id => vivant(parId.get(id)))) return non("vote");
      break;
    }
    case "sonneur":
      // Une cloche par vote : déjà sonnée (ou un vote déjà double) ; au vote, seulement un vote d'exécution ouvert, hors Banc.
      if (etat.voteDoubleDemain || (v.ouvert && v.double)) return non("deja");
      if (etat.phase === "vote" && (!v.ouvert || v.objet !== "execution" || v.banc)) return non("vote");
      break;
    case CLE_GREFFIER: {
      // Un signe par jour (donné, ou le second vote déjà ouvert) ; pendant le vote d'exécution, ou juste après qu'il a désigné un
      // condamné (le dernier vote du jour, clos, départagé).
      if (normaliserPacteSecret(etat.pacteSecret).signal?.tour === etat.tour || normaliserPacte(etat.pacte).secondVote?.tour === etat.tour) return non("deja");
      const r = v.resultat;
      const pendant = v.ouvert && v.objet === "execution";
      const apres = !v.ouvert && r?.objet === "execution" && r.tour === etat.tour && r.numero === v.numero && !r.departage?.enAttente && (r.elus ?? []).length > 0;
      if (!pendant && !apres) return non("secondVote");
      break;
    }
    case "taverne": {
      const lits = dormeursTaverne(etat, nuit);
      if (lits.includes(acteurId)) return non("deja");
      if (lits.length >= LITS_DE_LA_TAVERNE) return non("plein");
      break;
    }
    case "aubergiste":
      if (enJeu.includes("taverne")) {
        const lits = dormeursTaverne(etat, nuit);
        if (cibles[0] && lits.includes(cibles[0])) return non("deja");
        if (lits.length >= LITS_DE_LA_TAVERNE) return non("plein");
      }
      break;
    case "forge":
      if (etat.jour.effets.some(x => x.type === "lame" && !x.origine)) return non("deja");
      break;
    case "grange":
      if (etat.jour.effets.some(x => x.type === "cachette" && x.cible === acteurId)) return non("deja");
      if (effetsPour(etat, "cachette", nuit).length >= PLACES_DE_LA_GRANGE) return non("plein");
      break;
    case "puits":
      if (etat.jour.puits) return non("deja");
      if (!etat.morts.some(m => m.acteurId === acteurId && m.tour === etat.tour)) return non("recent");
      break;
    case "chapelle":
      if (effetsPour(etat, "asile", nuit).some(x => !x.origine)) return non("deja");
      break;
    case "eclusiere":
      if (effetsPour(etat, "ecluse", nuit).length) return non("deja");
      break;
    case "crieur-public": {
      const raison = raisonDeLaRevocation(etat, villageois);
      if (raison) return non(raison);
      if (voteExecutionDuJour(etat) || v.ouvert) return non("apresVote");
      break;
    }
    case "ecole":
      // Le Régent : une fois par jour, avant le vote (au débat).
      if (normaliserVillage(etat.village).regent?.tour === etat.tour) return non("deja");
      break;
  }

  const candidats = candidatsDuPouvoir({ villageois, etat, acteurId, pouvoir });
  const choisis = [...new Set(cibles.filter(Boolean))];
  if (choisis.length > def.cibles || choisis.length < ciblesMin(def) || choisis.some(c => !candidats.includes(c))) return { ...non("cibles"), candidats };
  if (def.texte) {
    const n = compterMots(texte);
    if (!n || n > MOTS_DU_PUITS) return { ...non("texte"), candidats };
  }
  return { ok: true, raison: "", def, candidats };
}

// Les pouvoirs de jour d'un villageois, avec ce qui les rend possibles ou non (pour la Table de jeu et le MJ IA).
// Pour un joueur, les cibles ne sont pas encore choisies : on vérifie tout sauf elles.
export function pouvoirsDe({ villageois = [], etat, acteurId, batiments } = {}) {
  const e = normaliserEtat(etat);
  const enJeu = batiments ?? e.batimentsCles;
  const acteur = villageois.find(v => v.id === acteurId);
  return pouvoirsPossedes(acteur, enJeu, e).map(pouvoir => {
    const def = POUVOIRS_JOUR[pouvoir];
    const candidats = candidatsDuPouvoir({ villageois, etat: e, acteurId, pouvoir });
    const essai = verifierPouvoir({ villageois, etat: e, acteurId, pouvoir, cibles: [], texte: def.texte ? "mot" : "", batiments: enJeu });
    let raison = essai.ok ? "" : essai.raison;
    if (raison === "cibles") raison = candidats.length < ciblesMin(def) ? "personne" : "";
    return { pouvoir, source: def.source, cibles: def.cibles, soiMeme: Boolean(def.soiMeme), texte: Boolean(def.texte), candidats, possible: !raison, raison };
  });
}

// ------------------------------------------------------------------ application
export function appliquerPouvoir({ villageois = [], etat: e, acteurId = "", pouvoir, cibles = [], texte = "", batiments, hasard = Math.random, maintenant = Date.now() } = {}) {
  const verif = verifierPouvoir({ villageois, etat: e, acteurId, pouvoir, cibles, texte, batiments });
  if (!verif.ok) return { ok: false, raison: verif.raison, etat: normaliserEtat(e), annonces: [], prives: [], changements: [], rouvrirVote: false };
  const etat = normaliserEtat(e);
  const def = verif.def;
  const parId = new Map(villageois.map(v => [v.id, v]));
  const nom = id => parId.get(id)?.nom ?? id;
  const qui = nom(acteurId), c = cibles[0], n = nom(c);
  const nuit = etat.tour + 1;
  const sortie = { ok: true, raison: "", etat, annonces: [], prives: [], changements: [], rouvrirVote: false, voteChange: false };
  const annonce = (cle, t, d = {}) => sortie.annonces.push(msg("public", cle, t, d));
  const poser = (type, cible = c ?? acteurId, origine = "") => etat.jour.effets.push({ type, acteurId, cible, nuit, ...(origine ? { origine } : {}) });
  if ((def.source === "metier" || def.source === "role") && !def.usageDiffere) sortie.changements.push({ type: "usage", acteurId, objet: def.source });
  if (def.revele) sortie.changements.push({ type: "revele", acteurId });
  // Le Village : un pouvoir unique de bâtiment est servi, par cet occupant (rangé dans l'état public, pas dans un objet).
  if (def.source === "tenure" && def.unique) marquerEpuise(etat, pouvoir, acteurId);

  switch (pouvoir) {
    case "forgeron":
      poser("verrou");
      annonce("Verrou", `${qui} forge un verrou pour la maison de ${n} : la nuit prochaine, la première attaque de loup contre elle échouera.`, { qui, nom: n });
      break;
    case "meuniere": {
      const loups = villageois.filter(v => vivant(v) && v.camp === "meute").length;
      annonce("Meule", remplir("{qui} interroge la meule : {n} loup(s) (vit|vivent) encore à Brumecombe.", { qui, n: loups }), { qui, n: loups });
      break;
    }
    case "garde":
      poser("surveille");
      annonce("Garde", `${qui} garde ${n} à l'œil : la nuit prochaine, ${n} ne pourra viser aucune autre maison que la sienne.`, { qui, nom: n });
      break;
    case "cure":
      if (!etat.jour.benis.includes(c)) etat.jour.benis.push(c);
      annonce("Benediction", `${qui} bénit ${n} : plus personne ne pourra le réduire au silence, et il parlera le premier au prochain débat.`, { qui, nom: n });
      break;
    case "chasseresse": {
      const sorti = (etat.nuitPrecedente.bilan?.sorties ?? []).includes(c);
      annonce(sorti ? "TracesOui" : "TracesNon", sorti ? `${qui} a suivi les traces de ${n} : ${n} a quitté sa maison cette nuit.`
        : `${qui} a suivi les traces de ${n} : ${n} n'a pas quitté sa maison cette nuit.`, { qui, nom: n });
      break;
    }
    case "aubergiste":
      poser("gite");
      annonce("Gite", `${qui} offre le gîte à ${n} : la nuit prochaine, ${n} dort à la Taverne et sa maison reste vide.`, { qui, nom: n });
      break;
    case "apothicaire":
      sortie.changements.push({ type: "silence", acteurId: c, valeur: false });
      annonce("Voix", `${qui} rend la voix à ${n}, qui peut de nouveau parler au débat.`, { qui, nom: n });
      break;
    case "colporteur-de-nouvelles": {
      const indice = indiceFlou({ bilan: etat.nuitPrecedente.bilan, villageois, hasard });
      annonce("Nouvelle", `${qui} crie la nouvelle du matin : ${indice.texte}`, { qui, indice });
      break;
    }
    case "tisserande":
      if (!etat.jour.rubans.includes(c)) etat.jour.rubans.push(c);
      annonce("Ruban", `${qui} noue un ruban au poignet de ${n} : s'il est le plus désigné d'un vote, il aura une minute de plus pour se défendre.`, { qui, nom: n });
      break;
    case "passeur":
      poser("traversee");
      annonce("Traversee", `${qui} fait traverser la rivière à ${n} : la nuit prochaine, personne ne pourra le visiter, et il ne pourra pas agir.`, { qui, nom: n });
      break;
    case "tanneur": {
      const cause = etat.morts.find(m => m.acteurId === c)?.cause;
      const crocs = cause === "meute" || cause === "epie";
      annonce(crocs ? "CrocsOui" : "CrocsNon", crocs ? `${qui} examine le corps de ${n} : il porte des traces de crocs.`
        : `${qui} examine le corps de ${n} : il ne porte aucune trace de crocs.`, { qui, nom: n });
      break;
    }
    case "ramoneuse": {
      // La suie garde les traces : la maison a-t-elle reçu de la visite (bilan secret de la nuit passée) ? Ni qui, ni pourquoi.
      const visite = (etat.nuitPrecedente.bilan?.visites ?? []).includes(c);
      annonce(visite ? "SuieOui" : "SuieNon", visite ? `${qui} monte sur le toit de ${n} : la suie garde des traces, sa maison a reçu de la visite cette nuit.`
        : `${qui} monte sur le toit de ${n} : la suie est intacte, personne n'est venu chez ${n} cette nuit.`, { qui, nom: n });
      break;
    }
    case "eclusiere":
      poser("ecluse", acteurId);
      annonce("Ecluse", `${qui} ferme l'écluse : la nuit prochaine, l'eau monte sous le Pont et la meute ne pourra chasser aucune maison de l'autre rive.`, { qui });
      break;
    case "maitresse-d-ecole": {
      const vivants = villageois.filter(vivant).sort((a, b) => numeroDeMaison(a.maison) - numeroDeMaison(b.maison) || String(a.nom).localeCompare(String(b.nom)));
      const i = vivants.findIndex(v => v.id === c);
      const ordre = [...vivants.slice(i), ...vivants.slice(0, i)].map(v => v.id);
      etat.jour.appel = { tour: etat.tour, ordre, duree: PAROLE_APPEL, depuis: maintenant };
      const noms = ordre.map(nom).join(", ");
      annonce("Appel", `${qui} fait l'appel : chacun parle ${PAROLE_APPEL} secondes, dans cet ordre : ${noms}.`, { qui, noms, duree: PAROLE_APPEL });
      break;
    }
    case "sonneur":
      // Le vote d'exécution ouvert devient double ; pendant le débat, le prochain (voteDoubleDemain, que ouvrirVote reprend).
      if (etat.vote.ouvert && etat.vote.objet === "execution") {
        etat.vote.double = true;
        sortie.voteChange = true;
        annonce("ClocheVote", `${qui}, le Sonneur, tire la corde : la cloche sonne, et ce vote désignera deux condamnés.`, { qui });
      } else {
        etat.voteDoubleDemain = true;
        annonce("ClocheJour", `${qui}, le Sonneur, tire la corde : la cloche sonne, et le prochain vote désignera deux condamnés.`, { qui });
      }
      break;
    case "juge-de-paix": {
      const ancien = etat.vote;
      // Le Loup déguisé le plus désigné d'un vote annulé n'est pas exécuté : son masque tombe.
      for (const id of masquesQuiTombent({ resultat: ancien.resultat, villageois, annule: true })) sortie.changements.push({ type: "masque", acteurId: id });
      marquerAnnule(etat, ancien.numero);   // le vote annulé reste au Registre du greffier, marqué
      // Le Pacte : la plume noire pèsera au revote ; une égalité annulée ne condamne plus le Souffre-douleur.
      rendreLaPlume(etat, ancien.numero);
      if (etat.pacte.egalite?.numero === ancien.numero) etat.pacte = { ...etat.pacte, egalite: null };
      const x = ouvrirVote(etat, { candidats: ancien.candidats, duree: ancien.duree, double: ancien.double, majoriteAbsolue: ancien.majoriteAbsolue,
        objet: "execution", banc: ancien.banc?.accuse ?? "", maintenant });
      Object.assign(etat, x);
      sortie.rouvrirVote = true;
      annonce("Annule", `${qui}, Juge de paix, annule le vote : personne n'est exécuté, et le village revote aussitôt, sans nouveau débat.`, { qui });
      break;
    }
    case "remouleur":
      // La pierre du Rémouleur : verrou (la première attaque de loup échoue) et lame (la meute qui l'atteint y laisse du sang).
      poser("verrou", c, "passage");
      poser("lame", c, "passage");
      annonce("Remouleur", `${qui} affûte la serrure et le couteau de ${n} : la nuit prochaine, la première attaque de loup contre sa maison échouera.`, { qui, nom: n });
      break;
    case "montreur-d-ours":
      // Le Montreur de marmotte (clé « montreur-d-ours », gardée pour les mondes sauvegardés) : sa marmotte veille sur le seuil, la
      // meute n'y entre pas la nuit prochaine (comme l'asile de la Chapelle).
      poser("asile", c, "passage");
      annonce("Ours", `${qui} installe sa marmotte sur le seuil de ${n} : elle sifflera à la moindre ombre, et la nuit prochaine la meute n'osera pas y entrer.`, { qui, nom: n });
      break;
    case "pelerine": {
      // La Pèlerine prie sur un seuil : elle apprend en secret le camp de ce joueur (tel que le voient les visions).
      const v = parId.get(c);
      const vrai = v?.role?.apparence || v?.camp || "village";
      // Le masque du Carnaval trompe aussi la prière, d'une Pèlerine qui n'est pas de la meute, une fois : puis il tombe.
      const trompe = c === masqueDuCarnaval(etat) && parId.get(acteurId)?.camp !== "meute";
      const camp = trompe ? campInverse(vrai) : vrai;
      if (trompe) etat.secretsDeFete = { ...etat.secretsDeFete, masqueTombe: true };
      annonce("Pelerine", `${qui} prie longuement sur le seuil de ${n}.`, { qui, nom: n });
      sortie.prives.push(msg(acteurId, "PelerinePrive", `Votre prière s'est fait entendre : ${n} est du camp « ${camp} ».`, { nom: n, camp }));
      break;
    }
    case CLE_GREFFIER:
      // Le signe convenu : SECRET (ni annonce, ni révélation ; les secrets du MJ). Le second vote s'ouvre quand les condamnés de ce
      // vote sont tombés (api.mjs, secondVoteDu) ; l'usage n'est pris qu'alors.
      etat.pacteSecret = { ...normaliserPacteSecret(etat.pacteSecret), signal: { tour: etat.tour, numero: etat.vote.numero, par: acteurId } };
      sortie.prives.push(msg(acteurId, "GreffierSigne", "Votre signe est passé : un second vote suivra, sans débat, dès que le condamné sera tombé."));
      sortie.secondVote = true;
      break;
    // ---------------- Le Village (personnalites.mjs) : des pouvoirs PUBLICS, comme leurs bâtiments.
    case "prieure": {
      // Le Prieur : le joueur désigné lui montre sa carte, en secret (la carte qu'il tient : celle que voit la table).
      const role = parId.get(c)?.role?.nom || "?";
      annonce("Confession", `${qui}, le Prieur, fait venir ${n} au prieuré : ${n} lui montre sa carte, en secret.`, { qui, nom: n });
      sortie.prives.push(msg(acteurId, "ConfessionPrive", `${n} vous a montré sa carte : ${role}.`, { nom: n, role }));
      sortie.village = { quoi: "prieur", acteurId, ids: [c] };
      break;
    }
    case "masure": {
      // Le Remégeux rend à ce joueur le pouvoir unique de son bâtiment, déjà servi.
      const cle = batimentDe(etat, c);
      retablir(etat, cle);
      annonce("Remise", `${qui}, le Remégeux, remet d'aplomb ${n} : le pouvoir de son bâtiment lui est rendu, une fois de plus.`, { qui, nom: n });
      sortie.village = { quoi: "remegeux", acteurId, ids: [c] };
      break;
    }
    case "ecole": {
      // Le Régent prive de vote, à ce tour, ceux qu'il a désignés (ils débattent encore).
      const ids = [...new Set(cibles.filter(Boolean))];
      etat.village = { ...normaliserVillage(etat.village), regent: { tour: etat.tour, ids, par: acteurId } };
      const noms = ids.map(nom).join(", ");
      annonce("Regent", `${qui}, le Régent, met au coin ${noms} : ils ne voteront pas aujourd'hui.`, { qui, noms });
      sortie.village = { quoi: "regent", acteurId, ids };
      break;
    }
    case "echoppe": {
      // Le Perruquier tranche une gorge : un loup (camp actuel : un mordu en est un), il est félicité ; sinon, il paie de sa vie.
      const loup = parId.get(c)?.camp === "meute";
      annonce("Rasoir", `${qui}, le Perruquier, ouvre son rasoir sur ${n}.`, { qui, nom: n });
      annonce(loup ? "RasoirLoup" : "RasoirInnocent", loup ? `${n} était un loup : le village félicite ${qui}.`
        : `${n} n'était pas un loup : ${qui} paie sa méprise de sa vie.`, { qui, nom: n });
      sortie.morts = [{ acteurId: c, cause: "rasoir" }, ...(loup ? [] : [{ acteurId, cause: "rasoir" }])];
      sortie.village = { quoi: "perruquier", acteurId, ids: [c], loup };
      break;
    }
    case "crieur-public": {
      const ancien = normaliserGazette(etat.gazette).crieur.acteurId;
      nommerLeCrieur(etat, { acteurId: c, par: acteurId });
      annonce("CrieurRevoque", `${qui}, le Bailli, révoque ${nom(ancien)} : ${n} devient Crieur public.`, { qui, ancien: nom(ancien), nom: n });
      sortie.gazette = { quoi: "crieur", acteurId: c, ancien };
      break;
    }
    case "conteuse":
      // La Conteuse n'est pas nommée : le pouvoir s'annonce sans dire qui le tient.
      etat.jour.conteuse = { tour: etat.tour, cible: c, jusqua: maintenant + DUREE_CONTEUSE };
      annonce("Conteuse", `Une histoire court la veillée : pendant deux minutes, le village ne parle que de ${n}, qui ne peut pas répondre.`, { nom: n });
      break;
    case "taverne":
      poser("taverne", acteurId);
      annonce("Taverne", `${qui} dormira à la Taverne la nuit prochaine.`, { qui });
      break;
    case "forge":
      poser("lame", acteurId);
      annonce("Lame", `${qui} emporte une lame de la Forge.`, { qui });
      break;
    case "grange":
      poser("cachette", acteurId);
      annonce("Cachette", `${qui} se cachera dans la Grange la nuit prochaine.`, { qui });
      break;
    case "puits": {
      const mots = String(texte).trim().split(/\s+/).join(" ");
      etat.jour.puits = { acteurId, texte: mots, tour: etat.tour };
      annonce("DernierMot", `Au fond du Puits, la voix de ${qui} : « ${mots} »`, { qui, texte: mots });
      break;
    }
    case "chapelle":
      poser("asile");
      annonce("Asile", `Le village met ${n} à l'abri de la Chapelle : la meute ne pourra pas l'attaquer la nuit prochaine.`, { nom: n });
      break;
  }
  return sortie;
}

// ------------------------------------------------------------------ le masque du Loup déguisé
// Un loup qui paraît villageois (apparence « village » d'un rôle de la meute : le Loup déguisé) perd son masque s'il est le plus
// désigné d'un vote d'exécution sans être exécuté (égalité non tranchée, majorité manquée, Bailli qui passe ; annule : le vote
// annulé par le Juge de paix, où personne n'est exécuté). Ensuite, les visions disent la vérité sur lui (apparence "").
// resultat : celui d'un vote clos (decompte, elus) ; un départage encore en attente ne décide rien. -> [acteurId]
export const porteUnMasque = v => v?.role?.camp === "meute" && v.role.apparence === "village";
export function masquesQuiTombent({ resultat, villageois = [], annule = false } = {}) {
  if (!resultat || (resultat.objet ?? "execution") !== "execution" || resultat.departage?.enAttente) return [];
  const d = resultat.decompte ?? {};
  const max = Math.max(0, ...Object.values(d));
  if (!max) return [];
  const elus = new Set(annule ? [] : resultat.elus ?? []);
  return villageois.filter(v => vivant(v) && porteUnMasque(v) && d[v.id] === max && !elus.has(v.id)).map(v => v.id);
}

// ------------------------------------------------------------------ effets du jour sur la nuit
export function effetsDeLaNuit(e, tour, { batiments } = {}) {
  const etat = normaliserEtat(e);
  const enJeu = batiments ?? etat.batimentsCles;
  const de = (...types) => [...new Set(etat.jour.effets.filter(x => types.includes(x.type) && x.nuit === tour).map(x => x.cible))];
  return {
    verrous: de("verrou"), surveilles: de("surveille"), asiles: de("asile"), lames: de("lame"),
    horsDAtteinte: de("traversee", "cachette"), taverne: de("taverne", "gite"),
    taverneEnJeu: enJeu.includes("taverne"), benis: [...etat.jour.benis],
    // Le Pont bloqué (après une proie tuée sur l'autre rive) ou l'écluse fermée par l'Éclusière : même effet.
    pontBloque: (enJeu.includes("pont") && Number(etat.pont?.bloqueNuit) === tour) || de("ecluse").length > 0
      || presageDeLaNuit(etat, tour) === "crue",
    // Almanach des brumes : le givre glace toute protection ; la Bonne étoile du narrateur, la première nuit.
    givre: presageDeLaNuit(etat, tour) === "givre",
    etoiles: etoilesDeLaNuit(etat, tour),
    // Le linceul du Glas du deuil : aucune protection ne tient contre la meute cette nuit.
    linceul: linceulDeLaNuit(etat, tour),
    // Les veillées de fête (fetes.mjs ; secrets du MJ) : le présent d'hiver qui veille encore, le porteur du masque du Carnaval.
    present: presentDeLaNuit(etat),
    masque: masqueDuCarnaval(etat)
  };
}

// Les effets qui ne visent jamais deux nuits de suite la même personne (protéger, faire taire).
export const JAMAIS_DEUX_NUITS = ["proteger", "silence"];

// Les loups qui peuvent chasser cette nuit : ni gardés à l'œil, ni hors d'atteinte (Passeur, Grange).
export function loupsQuiChassent(villageois = [], e, tour) {
  const fx = effetsDeLaNuit(e, tour);
  return villageois.filter(v => vivant(v) && v.camp === "meute" && !fx.surveilles.includes(v.id) && !fx.horsDAtteinte.includes(v.id)).map(v => v.id);
}

// Qui ce rôle peut désigner cette nuit, compte tenu des effets du jour. roleCle "meute" (ou un loup qui tue seul) :
// pas les loups, ni ceux hors d'atteinte, ni l'asile de la Chapelle, ni les dormeurs de la Taverne (sauf si un loup
// y dort), ni l'autre rive quand le Pont est bloqué. Un joueur hors d'atteinte n'agit pas ; gardé à l'œil, il ne vise
// que sa propre maison. Le filtre « soi-même » reste celui du rôle (demanderAction).
// roleCle "peste" (peste noire) : les mêmes candidats que la meute (la peste frappe comme elle, rien ne doit la distinguer).
// Jamais deux nuits de suite la même cible (Garde du pont, Gardienne des clés, Loup hurleur) : celle de la nuit d'avant est
// RETIRÉE des candidats (l'aube la refuserait aussi : resolution.mjs). Un loup qui tue seul (le Loup affamé) choisit une AUTRE
// victime que la proie de la meute de cette nuit.
// Le Pacte, étape 3b (ambigus.mjs) : le Chapardeur et le Bateleur choisissent une CARTE, pas un joueur (api.reveiller la leur
// propose) : [] ici ; le Mâtin se désigne lui-même pour rejoindre la meute ; le Joueur de vielle, deux vivants pas encore charmés
// (jamais lui) ; le Loup pâle, un loup vivant (jamais lui) ; les charmés n'ont rien à désigner ; le Bateleur qui joue une carte
// cette nuit choisit selon le rôle de cette carte.
// Le Pacte, étape 4 (personnalites.mjs) : la meute (et tout loup qui chasse, le Loup pâle compris) ne peut pas dévorer le
// Cabaretier immunisé ; l'Incendiaire désigne un bâtiment par son occupant (un Chemineau n'en a pas) ; la plume de la Pie ne se
// pose pas sur un Chemineau.
export function candidatsDeNuit({ villageois = [], etat: e, acteurId = "", roleCle = "", tour } = {}) {
  const etat = normaliserEtat(e);
  const n = tour ?? etat.tour;
  const fx = effetsDeLaNuit(etat, n);
  const parId = new Map(villageois.map(v => [v.id, v]));
  const vivants = villageois.filter(vivant);
  const acteur = parId.get(acteurId);
  const groupe = roleCle === CLE_MEUTE || roleCle === CLE_PESTE;
  const chasse = groupe || (acteur?.camp === "meute" && acteur?.role?.effet === "tuer" && acteur?.role?.cle === roleCle);
  if (!groupe) {
    if (fx.horsDAtteinte.includes(acteurId)) return [];
    if (fx.surveilles.includes(acteurId)) return vivants.some(v => v.id === acteurId) ? [acteurId] : [];
  }
  // Petite tablée (tablee.mjs) : la première nuit est blanche dès qu'il y a deux loups — la meute ne chasse personne.
  if (chasse && roleCle !== CLE_PESTE && etat.petiteTablee && n === 1 && nuitBlancheTablee(etat.places || villageois.length)) return [];
  let ids = vivants.filter(v => !fx.horsDAtteinte.includes(v.id) || v.id === acteurId).map(v => v.id);
  if (chasse) {
    const loupATaverne = fx.taverneEnJeu && fx.taverne.some(id => vivant(parId.get(id)) && parId.get(id).camp === "meute");
    ids = ids.filter(id => parId.get(id).camp !== "meute" && !fx.asiles.includes(id) && (!fx.taverne.includes(id) || loupATaverne)
      && !(fx.pontBloque && surLAutreRive(parId.get(id).maison)));
    if (!groupe) {
      const proies = new Set((etat.nuit?.actions ?? []).filter(a => a.roleCle === CLE_MEUTE).flatMap(a => a.cibles ?? []));
      ids = ids.filter(id => !proies.has(id));
    }
  }
  const cabaretier = cabaretierImmunise(etat);
  if (cabaretier && (chasse || roleCle === CLE_PESTE)) ids = ids.filter(id => id !== cabaretier);
  if (roleCle === CLE_CHARMES || roleCle === CLE_MUR) return [];
  // Les Vendanges (variantes.mjs) : la meute (et tout loup qui chasse) ne dévore qu'un voisin d'un loup ; la seconde désignation de
  // l'Entremetteuse, la première nuit (étape « tromperie ») : n'importe quel vivant.
  const vendanges = vendangesActives(etat);
  if (vendanges && chasse && roleCle !== CLE_PESTE) {
    const permises = new Set(proiesDesVendanges(etat, villageois));
    ids = ids.filter(id => permises.has(id));
  }
  if (roleCle === CLE_TROMPERIE) return vivants.map(v => v.id);
  // La carte jouée par un Bateleur, ou la seconde carte d'un joueur (Double visage, grande complication) : l'étape est la sienne.
  const role = roleEmprunte(etat, acteurId, roleCle, n) ?? (acteur?.seconde?.cle === roleCle ? acteur.seconde : null) ?? acteur?.role;
  if (!groupe && role?.cle === roleCle) {
    // Les Vendanges : le Chapardeur échange sa carte avec celle d'un joueur (pas une carte du centre).
    if (vendanges && role.effet === EFFET_CHAPARDEUR) return ids.filter(id => id !== acteurId);
    if ([EFFET_CHAPARDEUR, EFFET_BATELEUR].includes(role.effet)) return [];
    // Les Vendanges : le Garde du pont ne garde que lui-même ou l'un de ses deux voisins.
    if (vendanges && role.effet === "proteger" && role.cle === "garde-du-pont") {
      const permis = new Set(gardeDesVendanges(etat, villageois, acteurId));
      ids = ids.filter(id => permis.has(id));
    }
    if (role.effet === EFFET_MATIN) return ids.includes(acteurId) ? [acteurId] : [];
    // La Liseuse d'étoiles (gazette.mjs) : se désigner, c'est demander une séance de Spiritisme au matin.
    // Plus de carte Spiritisme dans la main du narrateur : rien à demander (elle est réveillée comme avant, sans rien à désigner).
    if (role.effet === EFFET_SPIRITISME) return vivants.some(v => v.id === acteurId) && normaliserGazette(etat.gazette).spiritisme.restantes.length ? [acteurId] : [];
    if (role.effet === EFFET_VIELLE) ids = candidatsDuCharme(ids, acteurId, normaliserAmbigusSecret(etat.ambigusSecret).charmes);
    if (role.effet === EFFET_LOUP_PALE) ids = ids.filter(id => id !== acteurId && parId.get(id)?.camp === "meute");
    if (role.effet === EFFET_LOUP_PALE && cabaretier) ids = ids.filter(id => id !== cabaretier);   // Le Village : le Cabaretier
    if (role.effet === EFFET_INCENDIAIRE) ids = candidatsDeLIncendiaire(etat, ids);
  }
  if (!groupe && role?.cle === roleCle && JAMAIS_DEUX_NUITS.includes(role.effet)) {
    const hier = (etat.nuitPrecedente?.actions ?? []).find(a => a.acteurId === acteurId && a.roleCle === roleCle)?.cibles?.[0];
    if (hier) ids = ids.filter(id => id !== hier);
  }
  // Le Pacte (pacte.mjs) : le Furet qui a perdu son flair est réveillé comme avant (pour ne pas se trahir), mais il n'a plus rien
  // à désigner ; la plume noire de la Pie ne se pose ni sur elle-même ni sur un rôle exclu (EXCLUS_DE_LA_PLUME).
  if (!groupe && role?.cle === roleCle && role.effet === EFFET_FURET && furetAveugle(etat, acteurId)) return [];
  if (!groupe && role?.cle === roleCle && role.effet === EFFET_PIE) ids = candidatsDeLaPlume(villageois, acteurId, ids).filter(id => !estChemineau(etat, id));
  return ids;
}

// ------------------------------------------------------------------ indices et annonces de l'aube
// Un indice VRAI mais FLOU sur la nuit passée, qui ne nomme personne (Colporteur de nouvelles, Lavoir).
// bilan (resoudreNuit) : { visites: [id], sorties: [id], victime, loup, sauves, attaques }.
export function indiceFlou({ bilan, villageois = [], hasard = Math.random } = {}) {
  if (!bilan) return msg("public", "IndiceRien", "La brume a tout couvert : personne ne sait rien de la nuit.");
  const parId = new Map(villageois.map(v => [v.id, v]));
  const num = id => numeroDeMaison(parId.get(id)?.maison);
  const choix = [];
  const nv = new Set(bilan.visites ?? []).size;
  choix.push(nv === 0 ? msg("public", "IndiceVisites0", "aucune maison n'a reçu de visite cette nuit.")
    : nv === 1 ? msg("public", "IndiceVisites1", "une seule maison a reçu de la visite cette nuit.")
      : msg("public", "IndiceVisites", `${nv} maisons ont reçu de la visite cette nuit.`, { n: nv }));
  const ns = new Set(bilan.sorties ?? []).size;
  choix.push(ns === 0 ? msg("public", "IndiceSorties0", "personne n'a quitté son lit cette nuit.")
    : ns === 1 ? msg("public", "IndiceSorties1", "une seule personne a quitté son lit cette nuit.")
      : msg("public", "IndiceSorties", `${ns} villageois ont quitté leur lit cette nuit.`, { n: ns }));
  if (bilan.loup && num(bilan.loup)) {
    choix.push(num(bilan.loup) % 2 === 0 ? msg("public", "IndicePair", "le loup entré chez la victime dort dans une maison au numéro pair.")
      : msg("public", "IndiceImpair", "le loup entré chez la victime dort dans une maison au numéro impair."));
  }
  if (bilan.loup && bilan.victime && villageois.some(v => surLAutreRive(v.maison))) {
    const meme = surLAutreRive(parId.get(bilan.loup)?.maison) === surLAutreRive(parId.get(bilan.victime)?.maison);
    choix.push(meme ? msg("public", "IndiceMemeRive", "le loup entré chez la victime dort sur la même rive qu'elle.")
      : msg("public", "IndiceAutreRive", "le loup entré chez la victime a traversé le Pont pour la trouver."));
  }
  const nums = [...new Set((bilan.visites ?? []).map(num).filter(Boolean))].sort((a, b) => a - b);
  if (nums.some((x, i) => i && x - nums[i - 1] === 1)) choix.push(msg("public", "IndiceVoisins", "deux maisons voisines ont eu de la visite cette nuit."));
  if (bilan.attaques > 0) {
    choix.push(bilan.sauves > 0 ? msg("public", "IndiceSauve", "quelqu'un a échappé à la mort cette nuit.")
      : msg("public", "IndicePasSauve", "personne n'a échappé à la mort cette nuit."));
  }
  return choisir(choix, hasard);
}

// Ce que les bâtiments disent à l'aube (après les morts) : Moulin, Lavoir, Cimetière.
// villageois : APRÈS la nuit. -> { annonces: [msg], prives: [msg], cimetiere: [id annoncés] }
export function annoncesDeLAube({ villageois = [], etat: e, tour, bilan = null, batiments, revelerALaMort = true, hasard = Math.random } = {}) {
  const etat = normaliserEtat(e);
  const enJeu = batiments ?? etat.batimentsCles;
  const n = tour ?? etat.tour;
  const sortie = { annonces: [], prives: [], cimetiere: [] };
  if (enJeu.includes("moulin")) {
    const loups = villageois.filter(v => vivant(v) && v.camp === "meute").length;
    const meunieres = villageois.filter(v => vivant(v) && v.metier?.cle === "meuniere");
    if (meunieres.length) {
      for (const m of meunieres) sortie.prives.push(msg(m.id, "MoulinPrive", remplir("La meule du Moulin vous souffle qu'il reste {n} loup(s) vivant(s).", { n: loups }), { n: loups }));
    } else if (n % 2 === 0) {
      sortie.annonces.push(msg("public", "MoulinPublic", remplir("Les ailes du Moulin ont compté : {n} loup(s) (vit|vivent) encore à Brumecombe.", { n: loups }), { n: loups }));
    }
  }
  if (enJeu.includes("lavoir") && neigeDuJour(etat, n)) {
    // La neige de la Veillée d'hiver : au lavoir gelé, on ne parle que du froid.
    sortie.annonces.push(msg("public", "LavoirNeige", "Le lavoir est gelé : on n'y parle que de la neige, qui a tout recouvert."));
  } else if (enJeu.includes("lavoir")) {
    const indice = indiceFlou({ bilan, villageois, hasard });
    sortie.annonces.push(msg("public", "Lavoir", `Au lavoir, on raconte ${elider("que", indice.texte)}`, { indice }));
  }
  if (enJeu.includes("cimetiere") && !revelerALaMort) {
    for (const v of villageois.filter(v => !vivant(v) && !v.revele && !etat.cimetiere.includes(v.id))) {
      sortie.annonces.push(msg("public", "Cimetiere", `Les tombes parlent : ${v.nom} était du camp « ${v.camp} ».`, { nom: v.nom, camp: v.camp }));
      sortie.cimetiere.push(v.id);
    }
  }
  return sortie;
}
