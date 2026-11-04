// Constructeurs communs du module lakour-veillees (système lakour-loups, Foundry v14) : identifiants stables,
// texte -> HTML, objets « role », « metier », « batiment », acteurs « villageois », journaux et tables.
// Formes des données : docs/loups-contrat.md (§1 et §2). Utilisés par outils/fabriquer-veillees.mjs.
import { createHash } from "node:crypto";

export const MODULE = "lakour-veillees";
export const SYSTEME = "lakour-loups";
export const STATS = { coreVersion: "14.369", systemId: SYSTEME, systemVersion: "0.1.0" };

// Camps et clés d'effet du contrat (§1 et §4) : toute autre valeur est une erreur de fabrication.
export const CAMPS = ["village", "meute", "solitaire"];
export const EFFETS = [
  "tuer", "proteger", "voir-camp", "voir-role-mort", "eclairer", "silence", "vote-double", "annuler-vote",
  "remede", "poison", "lien-amour", "echanger-role", "mordre", "emporter", "asperger", "embraser",
  "epier", "messager", "voir-actif"
];
// Extensions du système lakour-loups (systems/lakour-loups/scripts/modeles.mjs, logique/constantes.mjs) :
// role.apparence = camp vu par une vision « voir-camp » ("" = camp réel) ; role.victoireCle = victoire d'un solitaire.
export const APPARENCES = ["", "village", "meute"];
export const VICTOIRES = ["", "execute", "dernier-survivant", "cible-executee"];

// La meute se réveille ensemble à cet ordre (contrat §1, nuit.ordre).
export const ORDRE_MEUTE = 40;

// Identifiant Foundry stable (16 caractères alphanumériques) dérivé de la clé.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function identifiant(cle) {
  const octets = createHash("sha256").update(`${MODULE}:${cle}`).digest();
  return Array.from(octets.subarray(0, 16), o => ALPHABET[o % ALPHABET.length]).join("");
}

// Chemins des jetons (écrits par outils/fabriquer-jetons-veillees.mjs).
export const DOSSIER_JETONS = `modules/${MODULE}/assets/jetons`;
export const cheminJeton = cle => `${DOSSIER_JETONS}/${cle}.svg`;
export const cheminJeton3d = cle => `${DOSSIER_JETONS}/3d/${cle}.svg`;
export const cleJetonMetier = cle => `metier-${cle}`;
export const cleJetonBatiment = cle => `batiment-${cle}`;

// Texte -> HTML : paragraphes séparés par une ligne vide, **gras**, *italique*, listes « - », titres « # », encadrés « > ».
export function html(texte = "") {
  const enLigne = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  return String(texte).trim().split(/\n\s*\n/).filter(Boolean).map(bloc => {
    const lignes = bloc.trim().split("\n");
    if (lignes.every(l => /^\s*-\s+/.test(l))) return `<ul>${lignes.map(l => `<li>${enLigne(l.replace(/^\s*-\s+/, ""))}</li>`).join("")}</ul>`;
    // Encadré « > … » (chaque ligne du bloc) : une citation, pour les paroles d'anciens du livre de Brumecombe.
    if (lignes.every(l => /^\s*>\s?/.test(l))) return `<blockquote><p>${lignes.map(l => enLigne(l.replace(/^\s*>\s?/, ""))).join("<br>")}</p></blockquote>`;
    const titre = /^(#{1,3})\s+(.*)$/.exec(bloc.trim());
    if (titre && lignes.length === 1) return `<h${titre[1].length + 1}>${enLigne(titre[2])}</h${titre[1].length + 1}>`;
    return `<p>${lignes.map(enLigne).join("<br>")}</p>`;
  }).join("");
}

const verifierEffet = (cle, effet) => {
  if (effet && !EFFETS.includes(effet)) throw new Error(`${cle} : clé d'effet « ${effet} » inconnue du contrat`);
};
const usagesDe = max => ({ max, restant: max });

// ---------- Objet « role »
// nuit : { ordre, cibles, soiMeme, premiereNuitSeulement, uneNuitSurDeux, invite } (absent = n'agit pas la nuit).
export function role({ cle, nom, camp, pouvoir, victoire = "", victoireCle = "", apparence = "", nuit = null, usages = 0, effet = "", resume }) {
  if (!CAMPS.includes(camp)) throw new Error(`${cle} : camp « ${camp} » inconnu`);
  if (!APPARENCES.includes(apparence)) throw new Error(`${cle} : apparence « ${apparence} » inconnue`);
  if (!VICTOIRES.includes(victoireCle)) throw new Error(`${cle} : clé de victoire « ${victoireCle} » inconnue`);
  if (victoireCle && camp !== "solitaire") throw new Error(`${cle} : une clé de victoire est réservée aux solitaires`);
  verifierEffet(cle, effet);
  if (camp === "solitaire" && !victoire) throw new Error(`${cle} : un solitaire doit avoir sa condition de victoire`);
  if (nuit && !nuit.invite) throw new Error(`${cle} : un rôle de nuit doit poser une question (invite)`);
  const _id = identifiant(`roles:${cle}`);
  return {
    __pack: "roles", __cle: `roles:${cle}`, __resume: resume,
    _id, _key: `!items!${_id}`, name: nom, type: "role", img: cheminJeton(cle),
    system: {
      cle, camp, description: html(pouvoir), victoire: victoire ? html(victoire) : "",
      nuit: {
        actif: Boolean(nuit), ordre: nuit?.ordre ?? 50,
        premiereNuitSeulement: nuit?.premiereNuitSeulement ?? false, uneNuitSurDeux: nuit?.uneNuitSurDeux ?? false,
        cibles: nuit ? (nuit.cibles ?? 1) : 0, soiMeme: nuit?.soiMeme ?? false, invite: nuit?.invite ?? ""
      },
      usages: usagesDe(usages), effet, apparence, victoireCle
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE]: { cle } }, _stats: STATS
  };
}

// ---------- Objet « metier » (public, pouvoir de jour)
export function metier({ cle, nom, pouvoir, jour = null, usages = 0, effet = "", resume }) {
  verifierEffet(cle, effet);
  if (jour && !jour.invite) throw new Error(`${cle} : un métier actif doit poser une question (invite)`);
  const _id = identifiant(`metiers:${cle}`);
  return {
    __pack: "metiers", __cle: `metiers:${cle}`, __resume: resume,
    _id, _key: `!items!${_id}`, name: nom, type: "metier", img: cheminJeton(cleJetonMetier(cle)),
    system: {
      cle, description: html(pouvoir),
      jour: { actif: Boolean(jour), invite: jour?.invite ?? "", cibles: jour ? (jour.cibles ?? 1) : 0 },
      usages: usagesDe(usages), effet
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE]: { cle } }, _stats: STATS
  };
}

// ---------- Objet « batiment » (repere = nom exact de l'élément de la carte du village)
export function batiment({ cle, nom, description, regle, repere, effet = "", resume }) {
  verifierEffet(cle, effet);
  if (!repere) throw new Error(`${cle} : un bâtiment doit avoir son repère sur la carte`);
  const _id = identifiant(`batiments:${cle}`);
  return {
    __pack: "batiments", __cle: `batiments:${cle}`, __resume: resume,
    _id, _key: `!items!${_id}`, name: nom, type: "batiment", img: cheminJeton(cleJetonBatiment(cle)),
    system: { cle, description: html(description), regle: html(regle), repere, effet },
    effects: [], folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE]: { cle } }, _stats: STATS
  };
}

// ---------- Acteur « villageois » (figurant nommé, non joué)
export function villageois({ cle, nom, jeton, maison = "", notes = "" }) {
  const _id = identifiant(`villageois:${cle}`);
  const image = cheminJeton(jeton);
  return {
    __pack: "villageois", __cle: `villageois:${cle}`,
    _id, _key: `!actors!${_id}`, name: nom, type: "villageois", img: image,
    system: { joueur: "", vivant: true, revele: false, camp: "village", maison, amoureux: "", silence: false, protections: 0, notes: html(notes) },
    items: [], effects: [],
    prototypeToken: {
      name: nom, actorLink: false, disposition: 0, displayName: 20, displayBars: 0, width: 1, height: 1,
      texture: { src: image, fit: "contain", scaleX: 1, scaleY: 1 }, bar1: { attribute: null }, bar2: { attribute: null }
    },
    folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE]: { cle, jeton } }, _stats: STATS
  };
}

// ---------- Journaux
// Une page { titre, texte } est une page de texte ; { titre, image, legende? } une page d'image (l'illustration d'une veillée de fête).

export function journal({ cle, nom, pages, visible = true }) {
  const _id = identifiant(`journaux:${cle}`);
  return {
    __pack: "journaux", __cle: `journaux:${cle}`,
    _id, _key: `!journal!${_id}`, name: nom, folder: null, sort: 0, categories: [],
    ownership: { default: visible ? 2 : 0 }, flags: { [MODULE]: { cle, visible } }, _stats: STATS,
    pages: pages.map((p, i) => {
      const pid = identifiant(`journaux:${cle}:${i}`);
      if (p.image) {
        return {
          _id: pid, _key: `!journal.pages!${_id}.${pid}`, name: p.titre, type: "image", sort: (i + 1) * 100,
          title: { show: false, level: 1 }, src: p.image, image: { caption: p.legende ?? "" }, ownership: { default: -1 }, flags: {}
        };
      }
      return {
        _id: pid, _key: `!journal.pages!${_id}.${pid}`, name: p.titre, type: "text", sort: (i + 1) * 100,
        title: { show: true, level: 1 }, text: { content: html(p.texte), format: 1 }, ownership: { default: -1 }, flags: {}
      };
    })
  };
}

// ---------- Tables aléatoires : une ligne par résultat, tirées à 1dN.

export function table({ cle, nom, description = "", resultats }) {
  const _id = identifiant(`tables:${cle}`);
  return {
    __pack: "tables", __cle: `tables:${cle}`,
    _id, _key: `!tables!${_id}`, name: nom, img: "icons/svg/d20-black.svg", description: html(description),
    formula: `1d${resultats.length}`, replacement: true, displayRoll: true, folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE]: { cle } }, _stats: STATS,
    results: resultats.map((texte, i) => {
      const rid = identifiant(`tables:${cle}:${i}`);
      return {
        _id: rid, _key: `!tables.results!${_id}.${rid}`, type: "text", name: "", description: html(texte),
        range: [i + 1, i + 1], weight: 1, drawn: false, img: null, flags: {}
      };
    })
  };
}
