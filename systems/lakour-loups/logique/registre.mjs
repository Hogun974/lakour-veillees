// Le Registre du greffier : la mémoire PUBLIQUE de la veillée, tenue dans l'état public (etat.registre). Logique pure.
//
// N'y entre que ce qui est déjà public :
// - le dépouillement de chaque vote CLOS (qui a voté pour qui, la voix double du Bailli, le départage) — jamais un vote en
//   cours, ni un vote prolongé par le ruban avant sa vraie clôture ; un vote annulé par le Juge de paix y reste, marqué ;
// - chaque mort et sa cause PUBLIQUE (causePublique : jamais la vraie cause d'une mort de nuit) ;
// - l'élection, la succession et la vacance du Bailli ;
// - les DÉCLARATIONS que les vivants y font inscrire pendant le jour (« je me dis Liseuse de cendres, j'ai lu X ») : une ligne,
//   sans balises, LONGUEUR_DECLARATION caractères au plus, DECLARATIONS_PAR_JOUR par villageois et par jour ; pas pour un mort,
//   ni pour un réduit au silence pendant le débat et le vote (il se tait). Ce n'est qu'une parole : le greffier ne vérifie rien.
//
// etat.registre : [{ type, tour, phase, quand, … }]
//   vote : { numero, objet, votes: { votant: cible }, decompte, elus, egalite, poids: { bailli: 2 }, departage: null | { par, choix }, annule? }
//   mort : { acteurId, cause }                       bailli : { acteurId ("" : vacance), comment, de? }
//   declaration : { acteurId, texte }          passage : { acteurId, comment: "arrivee" | "depart" | "exil", cle? }
//   accusation : { par, contre } (Banc des accusés)  deuil : { compte } (le Glas du deuil sonne)
import { causePublique } from "./constantes.mjs";
import { PHASES_DU_SILENCE } from "./parole.mjs";
import { presageDuJour } from "./almanach.mjs";

export const LONGUEUR_DECLARATION = 160;
export const DECLARATIONS_PAR_JOUR = 3;
export const TAILLE_DU_REGISTRE = 300;
export const PHASES_DECLARATION = ["aube", "jour", "vote"];
export const TYPES_DU_REGISTRE = ["vote", "mort", "bailli", "declaration", "passage", "accusation", "deuil"];

// Inscrit une entrée (etat déjà normalisé, modifié sur place). Une mort n'y entre qu'avec sa cause publique.
export function inscrire(etat, entree, quand = Date.now()) {
  if (!Array.isArray(etat.registre)) etat.registre = [];
  const e = { ...JSON.parse(JSON.stringify(entree)), tour: etat.tour, phase: etat.phase, quand };
  if (e.type === "mort") e.cause = causePublique(e.cause);
  etat.registre.push(e);
  if (etat.registre.length > TAILLE_DU_REGISTRE) etat.registre = etat.registre.slice(-TAILLE_DU_REGISTRE);
  return etat;
}

// Une déclaration propre : une ligne, sans balises, coupée à la longueur permise.
export const nettoyerDeclaration = texte => String(texte ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_DECLARATION);

// Peut-il faire inscrire cette déclaration ? -> { ok, raison: "" | "absent" | "fin" | "mort" | "phase" | "silence" | "brouillard"
//   (le brouillard de l'Almanach des brumes) | "texte" | "trop", texte }
export function verifierDeclaration({ villageois = [], etat, acteurId = "", texte = "" } = {}) {
  const propre = nettoyerDeclaration(texte);
  const non = raison => ({ ok: false, raison, texte: propre });
  const v = villageois.find(x => x.id === acteurId);
  if (!v) return non("absent");
  if (etat?.phase === "fin" || etat?.vainqueur) return non("fin");
  if (v.vivant === false) return non("mort");
  if (!PHASES_DECLARATION.includes(etat?.phase)) return non("phase");
  if (v.silence && PHASES_DU_SILENCE.includes(etat.phase)) return non("silence");
  if (presageDuJour(etat) === "brouillard") return non("brouillard");
  if (!propre) return non("texte");
  const deja = (etat.registre ?? []).filter(x => x.type === "declaration" && x.acteurId === acteurId && x.tour === etat.tour).length;
  if (deja >= DECLARATIONS_PAR_JOUR) return non("trop");
  return { ok: true, raison: "", texte: propre };
}

// La déclaration, inscrite. -> { ok, raison, etat }
export function declarer({ villageois = [], etat, acteurId, texte, quand = Date.now() } = {}) {
  const v = verifierDeclaration({ villageois, etat, acteurId, texte });
  if (!v.ok) return { ok: false, raison: v.raison, etat };
  return { ok: true, raison: "", etat: inscrire(etat, { type: "declaration", acteurId, texte: v.texte }, quand) };
}

// Le vote annulé par le Juge de paix reste au Registre, marqué.
export function marquerAnnule(etat, numero) {
  for (const x of etat.registre ?? []) if (x.type === "vote" && x.numero === numero) x.annule = true;
  return etat;
}

// Les dernières entrées (max), dans l'ordre ; depuis : seulement à partir de ce tour.
export function extraitDuRegistre(registre = [], { max = 0, depuis = 0 } = {}) {
  const liste = registre.filter(x => (Number(x.tour) || 0) >= depuis);
  return max > 0 ? liste.slice(-max) : liste;
}
