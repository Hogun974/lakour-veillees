// Mise à jour d'un journal déjà installé dans un monde, sans Foundry (essais/mise-a-jour-journaux.test.mjs). Fichier commun
// aux modules de contenu LaKour (lakour-fenoir, lakour-veillees, lakour-warcraft, lakour-40k) : le garder identique partout.
// Un journal déjà importé n'est jamais remplacé en bloc ; ses pages sont rapprochées de celles du compendium par leur clé
// (flags.<ID>.cle) quand elles en ont une, sinon par leur identifiant (les épingles des cartes visent les pages par leur id).
// - une page du compendium absente du journal est ajoutée (avec son identifiant s'il est libre) ;
// - une page que personne n'a retouchée reprend le texte, le nom et le rang du compendium ;
// - une page retouchée à la main reste telle quelle, et son nom est rapporté au MJ ;
// - une page ajoutée ou réécrite par le MJ IA (flags.lakour-mj-ia.ajoutee, .historique) n'est jamais touchée ;
// - une page du module qui n'est plus au compendium est retirée si personne ne l'a retouchée ;
// - une page ajoutée par le MJ (sans marque du module) n'est pas regardée.
// « Retouchée » : son texte ne correspond plus à l'empreinte posée à l'import (flags.<ID>.empreinte) ; pour une page importée
// avant les empreintes, sa date de modification suit de plus de MARGE_CREATION_MS sa date de création (à la création, le serveur
// Foundry pose la date de modification quelques millisecondes après celle de création : 1 à 59 ms relevés sur LaKour).

// Empreinte courte d'un texte (FNV-1a 32 bits) : de quoi reconnaître un texte inchangé, rien de plus.
export function empreinte(texte = "") {
  let h = 0x811c9dc5;
  for (const c of String(texte)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const texteDe = page => page.text?.content ?? "";
export const MARGE_CREATION_MS = 5000;

export function pageIntacte(id, page) {
  const e = page.flags?.[id]?.empreinte;
  if (e) return e === empreinte(texteDe(page));
  const s = page._stats ?? {};
  return s.createdTime != null && s.modifiedTime != null && s.modifiedTime - s.createdTime <= MARGE_CREATION_MS;
}

export function pageDuMjIa(page) {
  const f = page.flags?.["lakour-mj-ia"];
  return Boolean(f?.ajoutee || f?.historique?.length);
}

// Pages d'un journal neuf, prêtes à créer : chacune reçoit son empreinte.
export function avecEmpreintes(id, pages = []) {
  return pages.map(p => ({ ...p, flags: { ...p.flags, [id]: { ...p.flags?.[id], empreinte: empreinte(texteDe(p)) } } }));
}

// actuelles : pages du journal du monde ; modeles : pages du compendium (objets simples, toObject()).
// Rend { creer, maj, supprimer, gardees } : données des pages à créer, changements (avec _id) des pages à mettre à jour,
// identifiants des pages à retirer, noms des pages retouchées laissées telles quelles.
export function planMiseAJour(id, actuelles = [], modeles = []) {
  const parCle = new Map(), parId = new Map();
  for (const p of actuelles) {
    const cle = p.flags?.[id]?.cle;
    if (cle && !parCle.has(cle)) parCle.set(cle, p);
    parId.set(p._id, p);
  }
  // Une page sans clé se retrouve par son identifiant ; une page à clé aussi, si la page de même identifiant n'a pas de clé
  // à elle (journal importé avant que les pages aient des clés).
  const correspondante = (m, cle) => {
    if (!cle) return parId.get(m._id);
    const memeId = parId.get(m._id);
    return parCle.get(cle) ?? (memeId && !memeId.flags?.[id]?.cle ? memeId : undefined);
  };
  const vues = new Set();
  const creer = [], maj = [], supprimer = [], gardees = [];
  for (const m of modeles) {
    const cle = m.flags?.[id]?.cle;
    const p = correspondante(m, cle);
    if (!p) {
      const { _stats, ...donnees } = structuredClone(m);
      if (parId.has(donnees._id)) delete donnees._id;
      creer.push(avecEmpreintes(id, [donnees])[0]);
      continue;
    }
    vues.add(p._id);
    if (pageDuMjIa(p)) continue;
    const contenu = m.text?.content;
    if (!pageIntacte(id, p)) {
      if (contenu !== undefined && contenu !== p.text?.content) gardees.push(p.name);
      continue;
    }
    const changements = {};
    if (contenu !== undefined && contenu !== p.text?.content) changements["text.content"] = contenu;
    if (m.name !== p.name) changements.name = m.name;
    if (m.sort !== p.sort) changements.sort = m.sort;
    if (cle && p.flags?.[id]?.cle !== cle) changements[`flags.${id}.cle`] = cle;
    const e = empreinte(contenu ?? texteDe(p));
    if (p.flags?.[id]?.empreinte !== e) changements[`flags.${id}.empreinte`] = e;
    if (Object.keys(changements).length) maj.push({ _id: p._id, ...changements });
  }
  for (const p of actuelles) {
    if (vues.has(p._id) || pageDuMjIa(p)) continue;
    const duModule = p.flags?.[id]?.cle || p.flags?.[id]?.empreinte;
    if (duModule && pageIntacte(id, p)) supprimer.push(p._id);
  }
  return { creer, maj, supprimer, gardees };
}
