// Les bâtiments TENUS : un bâtiment du village confié à un joueur (les personnalités du livre : le Prieur et son prieuré, la
// Fournière et son fournil, les Métayers et leurs métairies…). Logique pure ; le socle seulement, aucun bâtiment ne s'en sert
// encore.
//
// État PUBLIC : etat.tenures = { cleBatiment: acteurId | null } — null : le bâtiment est vacant. Sur table, chaque personnalité
// pose son jeton « rôle visible » devant elle : qui tient quoi se sait de tous, ce n'est jamais un secret.
// À la mort d'un occupant (etat.mjs, ajouterMort), ses bâtiments deviennent vacants et le Registre du greffier l'inscrit
// (registre.mjs, type « vacance » : { acteurId, batiments }) ; plus tard, le Prévôt les réattribuera (tenir). Sur le modèle de la
// succession du Bailli (bailli.mjs, ouvrirSuccession).
// Ces bâtiments-là ne sont pas les dix bâtiments communaux (Chapelle, Forge, Moulin… : etat.batimentsCles, des règles qui
// valent pour tout le village) : ceux-ci ont un tenancier, et leur pouvoir sera le sien.
import { normaliserEtat } from "./etat.mjs";
import { inscrire } from "./registre.mjs";

export const tenuresInitiales = () => ({});

// { cle: acteurId | null } : clés non vides, occupant en texte ("" devient null).
export function normaliserTenures(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return {};
  const sortie = {};
  for (const [cle, id] of Object.entries(t)) {
    if (!cle) continue;
    sortie[cle] = id ? String(id) : null;
  }
  return sortie;
}

// acteurId tient désormais ce bâtiment (il en chasse l'occupant précédent). -> un nouvel état
export function tenir(e, cle, acteurId) {
  const etat = normaliserEtat(e);
  if (!cle) return etat;
  etat.tenures = { ...etat.tenures, [cle]: acteurId ? String(acteurId) : null };
  return etat;
}

// Le bâtiment devient vacant (il reste connu du village). -> un nouvel état
export function liberer(e, cle) {
  return tenir(e, cle, null);
}

// L'occupant du bâtiment : son acteurId, ou null (vacant, ou bâtiment inconnu).
export const tenuPar = (etat, cle) => normaliserTenures(etat?.tenures)[cle] ?? null;

// Les bâtiments que tient ce villageois : [cle], dans l'ordre où ils sont rangés.
export const batimentsDe = (etat, acteurId) => Object.entries(normaliserTenures(etat?.tenures))
  .filter(([, id]) => id && id === String(acteurId)).map(([cle]) => cle);

// Les bâtiments vacants : [cle].
export const vacants = etat => Object.entries(normaliserTenures(etat?.tenures)).filter(([, id]) => !id).map(([cle]) => cle);

// Un occupant meurt : ses bâtiments deviennent vacants, et le Registre l'inscrit (ajouterMort l'appelle). Modifie sur place
// l'état reçu (déjà normalisé), comme ouvrirSuccession. -> l'état
export function libererALaMort(etat, acteurId, quand = Date.now()) {
  const tenus = batimentsDe(etat, acteurId);
  if (!tenus.length) return etat;
  etat.tenures = { ...normaliserTenures(etat.tenures), ...Object.fromEntries(tenus.map(cle => [cle, null])) };
  inscrire(etat, { type: "vacance", acteurId, batiments: tenus }, quand);
  return etat;
}
