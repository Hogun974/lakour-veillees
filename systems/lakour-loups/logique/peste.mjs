// La variante « Peste noire ». Logique pure.
//
// Une partie rare (CHANCE_PESTE, tirée par tirerPeste avec le générateur à graine), ou choisie par le MJ : AUCUN rôle de la
// meute. À la place de la meute, l'étape « la peste » (CLE_PESTE, ordre 40) frappe chaque nuit une victime :
// - tant qu'aucune victime de la peste n'est morte (première nuit, ou victimes toutes sauvées), le narrateur la choisit (le
//   narrateur IA, ou le MJ humain depuis la Table), ou le hasard ;
// - ensuite, la DERNIÈRE victime morte de la peste (le « porteur ») la désigne en secret, comme une action de nuit ; sans
//   réponse au délai, le hasard choisit.
// La victime meurt comme une proie de la meute : même annonce publique (cause publique « nuit »), mêmes protections (Garde,
// remède, verrou, asile, Taverne, absence, Pont) ; la vraie cause, secrète, est « peste ».
// Le jour, un villageois vivant peut crier « C'est la peste noire ! » (crierPeste) : juste, la partie s'arrête et le village
// gagne ; faux, le crieur est pendu pour avoir semé la panique (cause publique « panique »). Sans découverte, quand il ne
// reste qu'un vivant (ou aucun), la peste l'emporte (vainqueur « peste », voir victoire.mjs).
//
// etat.peste : null (partie ordinaire) ou { active: true, porteur: acteurId | "", victimes: [acteurId], decouverte, crieur }.
// C'est un SECRET (etat.mjs, separerEtat) : ni dans l'état public, ni dans un hook, ni par le socket avant la fin.
import { CHANCE_PESTE, CAUSES } from "./constantes.mjs";
import { creerHasard } from "./hasard.mjs";
import { normaliserEtat } from "./etat.mjs";
import { JOURNEE } from "./jour.mjs";

// Ce qui compte les loups vivants trahirait la peste dès le premier matin (« 0 loup ») : ni Meunière ni Moulin dans une peste.
export const HORS_PESTE = Object.freeze({ metiers: ["meuniere"], batiments: ["moulin"] });

// Les métiers d'une peste : chaque Meunière est remplacée par un autre métier de la liste (dans l'ordre, en boucle).
// metiers : [{ uuid, cle }] -> [uuid] de même longueur.
export function metiersSansIndice(metiers = []) {
  const surs = [...new Set(metiers.filter(m => !HORS_PESTE.metiers.includes(m.cle)).map(m => m.uuid))];
  let k = 0;
  return metiers.map(m => (HORS_PESTE.metiers.includes(m.cle) ? (surs.length ? surs[k++ % surs.length] : "") : m.uuid)).filter(Boolean);
}

export const pesteInitiale = () => ({ active: true, porteur: "", victimes: [], decouverte: false, crieur: "" });

// La partie en cours est-elle une peste noire ? (état COMPLET du MJ ; l'état public n'en sait rien avant la fin)
export const estPeste = e => Boolean(e?.peste?.active);

// Une nouvelle partie qui se compose d'elle-même devient-elle une peste noire ? Reproductible avec une graine (tirage à part
// de celui de la composition : la même graine donne la même composition, peste ou non). hasard : un générateur déjà prêt.
// Une chance nulle (ou certaine) ne tire rien : le hasard des parties n'en est pas décalé.
export function tirerPeste({ graine, hasard, chance = CHANCE_PESTE } = {}) {
  if (!(chance > 0)) return false;
  if (chance >= 1) return true;
  const h = hasard ?? creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `peste|${graine}`);
  return h() < chance;
}

// Les morts de la nuit : la dernière victime de la peste devient le porteur (c'est elle qui choisira la suivante).
// deces : [{ acteurId, cause }] (resoudreNuit).
export function suivrePeste(e, deces = []) {
  const etat = normaliserEtat(e);
  if (!estPeste(etat)) return etat;
  for (const d of deces) {
    if (d.cause !== CAUSES.peste) continue;
    etat.peste.porteur = d.acteurId;
    if (!etat.peste.victimes.includes(d.acteurId)) etat.peste.victimes.push(d.acteurId);
  }
  return etat;
}

// Le cri « C'est la peste noire ! » est-il permis ? Ne dépend QUE de l'état public (le navigateur du joueur le sait aussi) :
// un villageois vivant, pendant le jour (aube, débat, vote), qui n'est pas réduit au silence, partie en cours.
// -> { ok, raison } ; raisons : "partie", "absent", "mort", "phase", "silence".
export function verifierCri({ villageois = [], etat: e, acteurId = "" } = {}) {
  const etat = normaliserEtat(e);
  const non = raison => ({ ok: false, raison });
  if (!etat.partie || etat.vainqueur || etat.phase === "fin") return non("partie");
  const v = villageois.find(x => x.id === acteurId);
  if (!v) return non("absent");
  if (v.vivant === false) return non("mort");
  if (!JOURNEE.includes(etat.phase)) return non("phase");
  if (v.silence && etat.phase !== "aube") return non("silence");
  return { ok: true, raison: "" };
}

const msg = (cle, texte, donnees = {}) => ({ destinataire: "public", cle: `LAKOUR_LOUPS.Peste.${cle}`, texte, donnees });

// Le cri, sur l'état COMPLET (le MJ actif seul sait si c'est la peste).
// -> { ok, raison, etat, juste, annonces: [msg], mort: acteurId | "" }
//   juste : la peste est découverte (etat.peste.decouverte, le vote en cours se ferme) ; verifierVictoire rendra « village » ;
//   faux : mort = le crieur, que le MJ élimine (cause « panique »).
export function crierPeste({ villageois = [], etat: e, acteurId = "" } = {}) {
  const etat = normaliserEtat(e);
  const v = verifierCri({ villageois, etat, acteurId });
  if (!v.ok) return { ok: false, raison: v.raison, etat, juste: false, annonces: [], mort: "" };
  const nom = villageois.find(x => x.id === acteurId)?.nom ?? acteurId;
  if (estPeste(etat)) {
    etat.peste.decouverte = true;
    etat.peste.crieur = acteurId;
    etat.vote.ouvert = false;
    return { ok: true, raison: "", etat, juste: true, mort: "",
      annonces: [msg("CriJuste", `${nom} crie : « C'est la peste noire ! » Le village se tait, puis comprend : il n'y a jamais eu de loups à Brumecombe, seulement la fièvre qui passe de mort en mort. On brûle les draps, on ferme les puits, et la peste recule.`, { nom })] };
  }
  return { ok: true, raison: "", etat, juste: false, mort: acteurId,
    annonces: [msg("CriFaux", `${nom} crie : « C'est la peste noire ! » Mais les morts portent des traces que la fièvre ne laisse pas. Pour avoir semé la panique, le village pend ${nom} sur-le-champ.`, { nom })] };
}
