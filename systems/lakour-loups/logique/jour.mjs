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
//   villageois « à plat » : { id, nom, vivant, revele, camp, maison, silence, role: { cle, usages }, metier: { cle, usages } }
//   batiments : clés des bâtiments en jeu (etat.batimentsCles).
//
// Les effets posés de jour vivent dans etat.jour.effets : [{ type, acteurId, cible, nuit }] et valent pour la nuit n° `nuit`
// (la nuit qui suit ce jour). effetsDeLaNuit(etat, tour) les regroupe pour resoudreNuit().

import { CLE_MEUTE, CLE_PESTE } from "./constantes.mjs";
import { choisir } from "./hasard.mjs";
import { normaliserEtat, ouvrirVote } from "./etat.mjs";
import { numeroDeMaison, surLAutreRive } from "./distribution.mjs";

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
// texte : demande un texte ; mort : réservé aux morts ; revele : le rôle est révélé en l'utilisant.
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
export function pouvoirsPossedes(acteur, batiments = []) {
  const liste = [];
  if (!acteur) return liste;
  const m = acteur.metier?.cle;
  if (POUVOIRS_JOUR[m]?.source === "metier") liste.push(m);
  const r = acteur.role?.cle;
  if (POUVOIRS_JOUR[r]?.source === "role") liste.push(r);
  for (const b of BATIMENTS_DES_JOUEURS) if (batiments.includes(b)) liste.push(b);
  return liste;
}

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
      const hier = effetsPour(etat, "asile", etat.tour).map(x => x.cible);
      return vivants.filter(v => !hier.includes(v.id)).map(v => v.id);
    }
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
    if (!acteur || !pouvoirsPossedes(acteur, enJeu).includes(pouvoir)) return non("absent");
  }
  if (!def.phases.includes(etat.phase)) return non("phase");
  if (!def.narrateur) {
    if (def.mort ? vivant(acteur) : !vivant(acteur)) return non(def.mort ? "vivant" : "mort");
    const objet = def.source === "metier" ? acteur.metier : def.source === "role" ? acteur.role : null;
    if (objet && Number(objet.usages?.max) > 0 && Number(objet.usages?.restant) <= 0) return non("usage");
  }
  if (def.apresNuit && !(etat.tour >= 1 && etat.nuitResolue === etat.tour)) return non("nuit");

  const nuit = etat.tour + 1;
  const v = etat.vote;
  switch (pouvoir) {
    case "juge-de-paix": {
      const r = v.resultat;
      const parId = new Map(villageois.map(x => [x.id, x]));
      if (v.ouvert || !r || r.objet !== "execution" || !r.elus?.length || r.numero !== v.numero || !r.elus.every(id => vivant(parId.get(id)))) return non("vote");
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
      if (etat.jour.effets.some(x => x.type === "lame")) return non("deja");
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
      if (effetsPour(etat, "asile", nuit).length) return non("deja");
      break;
    case "eclusiere":
      if (effetsPour(etat, "ecluse", nuit).length) return non("deja");
      break;
  }

  const candidats = candidatsDuPouvoir({ villageois, etat, acteurId, pouvoir });
  const choisis = [...new Set(cibles.filter(Boolean))];
  if (choisis.length !== def.cibles || choisis.some(c => !candidats.includes(c))) return { ...non("cibles"), candidats };
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
  return pouvoirsPossedes(acteur, enJeu).map(pouvoir => {
    const def = POUVOIRS_JOUR[pouvoir];
    const candidats = candidatsDuPouvoir({ villageois, etat: e, acteurId, pouvoir });
    const essai = verifierPouvoir({ villageois, etat: e, acteurId, pouvoir, cibles: [], texte: def.texte ? "mot" : "", batiments: enJeu });
    let raison = essai.ok ? "" : essai.raison;
    if (raison === "cibles") raison = candidats.length < def.cibles ? "personne" : "";
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
  const sortie = { ok: true, raison: "", etat, annonces: [], prives: [], changements: [], rouvrirVote: false };
  const annonce = (cle, t, d = {}) => sortie.annonces.push(msg("public", cle, t, d));
  const poser = (type, cible = c ?? acteurId) => etat.jour.effets.push({ type, acteurId, cible, nuit });
  if (def.source === "metier" || def.source === "role") sortie.changements.push({ type: "usage", acteurId, objet: def.source });
  if (def.revele) sortie.changements.push({ type: "revele", acteurId });

  switch (pouvoir) {
    case "forgeron":
      poser("verrou");
      annonce("Verrou", `${qui} forge un verrou pour la maison de ${n} : la nuit prochaine, la première attaque de loup contre elle échouera.`, { qui, nom: n });
      break;
    case "meuniere": {
      const loups = villageois.filter(v => vivant(v) && v.camp === "meute").length;
      annonce("Meule", `${qui} interroge la meule : ${loups} loup(s) vivent encore à Brumecombe.`, { qui, n: loups });
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
    case "juge-de-paix": {
      const ancien = etat.vote;
      const x = ouvrirVote(etat, { candidats: ancien.candidats, duree: ancien.duree, double: ancien.double, majoriteAbsolue: ancien.majoriteAbsolue,
        objet: "execution", maintenant });
      Object.assign(etat, x);
      sortie.rouvrirVote = true;
      annonce("Annule", `${qui}, Juge de paix, annule le vote : personne n'est exécuté, et le village revote aussitôt, sans nouveau débat.`, { qui });
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
  };
}

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
  let ids = vivants.filter(v => !fx.horsDAtteinte.includes(v.id) || v.id === acteurId).map(v => v.id);
  if (chasse) {
    const loupATaverne = fx.taverneEnJeu && fx.taverne.some(id => vivant(parId.get(id)) && parId.get(id).camp === "meute");
    ids = ids.filter(id => parId.get(id).camp !== "meute" && !fx.asiles.includes(id) && (!fx.taverne.includes(id) || loupATaverne)
      && !(fx.pontBloque && surLAutreRive(parId.get(id).maison)));
  }
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
      for (const m of meunieres) sortie.prives.push(msg(m.id, "MoulinPrive", `La meule du Moulin vous souffle qu'il reste ${loups} loup(s) vivant(s).`, { n: loups }));
    } else if (n % 2 === 0) {
      sortie.annonces.push(msg("public", "MoulinPublic", `Les ailes du Moulin ont compté : ${loups} loup(s) vivent encore à Brumecombe.`, { n: loups }));
    }
  }
  if (enJeu.includes("lavoir")) {
    const indice = indiceFlou({ bilan, villageois, hasard });
    sortie.annonces.push(msg("public", "Lavoir", `Au lavoir, on raconte que ${indice.texte}`, { indice }));
  }
  if (enJeu.includes("cimetiere") && !revelerALaMort) {
    for (const v of villageois.filter(v => !vivant(v) && !v.revele && !etat.cimetiere.includes(v.id))) {
      sortie.annonces.push(msg("public", "Cimetiere", `Les tombes parlent : ${v.nom} était du camp « ${v.camp} ».`, { nom: v.nom, camp: v.camp }));
      sortie.cimetiere.push(v.id);
    }
  }
  return sortie;
}
