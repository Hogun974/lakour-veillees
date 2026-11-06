// Les fiches SECRÈTES des villageois : rôle, camp, amoureux, protections. Logique pure (navigateur et Node).
//
// Foundry v14 livre tous les documents à tous les navigateurs (acteurs, objets possédés) : un rôle ou un camp rangé dans un
// document se lit dans la console de n'importe quel joueur. Depuis 0.9.0, ce qui est secret d'un villageois vit donc dans les
// secrets du MJ actif (etat.fiches, voir etat.mjs) ; le document ne garde que le public (nom, maison, vivant, révélé, silence,
// métier). Le rôle n'entre au document (objet `role`, et `system.camp`) qu'à sa révélation publique : mort révélée, Juge de paix,
// fin de partie (scripts/api.mjs, revelerPubliquement).
//
// Une fiche : { camp: "village" | "meute" | "solitaire", amoureux: acteurId | "", protections: n,
//               role: null | { name, img, source (uuid du rôle d'origine, "" sinon), system: { cle, camp, description, victoire,
//                              nuit, usages, effet, apparence, victoireCle } } }
// Ce que reçoit le joueur de ce villageois (et lui seul, par le socket) : ficheDuJoueur (sans les protections : il ne sait pas
// qu'on le protège). Ce que reçoit un mort qui voit tout (« mortsVoientTout ») : vueDesMorts (le rôle et le camp, sans plus).

import { CAMPS } from "./constantes.mjs";

const copie = o => JSON.parse(JSON.stringify(o ?? null));

export const NUIT_PAR_DEFAUT = { actif: false, ordre: 50, premiereNuitSeulement: false, uneNuitSurDeux: false, tantQueMeuteEntiere: false, cibles: 1, soiMeme: false, invite: "" };

// Le rôle d'une fiche, complété (les essais et d'anciens objets n'ont pas tous les champs).
export function normaliserRole(r) {
  if (!r || typeof r !== "object") return null;
  const s = r.system ?? {};
  return {
    name: String(r.name ?? ""), img: String(r.img ?? ""), source: String(r.source ?? ""),
    system: {
      ...copie(s),
      cle: String(s.cle ?? ""), camp: CAMPS.includes(s.camp) ? s.camp : "village",
      description: String(s.description ?? ""), victoire: String(s.victoire ?? ""), effet: String(s.effet ?? ""),
      apparence: String(s.apparence ?? ""), victoireCle: String(s.victoireCle ?? ""),
      nuit: { ...NUIT_PAR_DEFAUT, ...(s.nuit ?? {}) },
      usages: { max: Number(s.usages?.max) || 0, restant: Number(s.usages?.restant) || 0 }
    }
  };
}

export function normaliserFiche(f) {
  const x = f && typeof f === "object" ? f : {};
  const role = normaliserRole(x.role);
  return {
    camp: CAMPS.includes(x.camp) ? x.camp : role?.system.camp ?? "village",
    amoureux: String(x.amoureux ?? ""), protections: Math.max(0, Number(x.protections) || 0), role
  };
}

// Une fiche neuve d'après un rôle (données d'objet : { name, img, system }) ; camp : celui du rôle, sauf mention.
export function ficheDuRole(role, { camp, source = "" } = {}) {
  const r = normaliserRole(role ? { ...role, source: role.source ?? source } : null);
  return normaliserFiche({ role: r, camp: camp ?? r?.system.camp ?? "village" });
}

// Ce que le joueur de ce villageois reçoit (à lui seul) : son rôle, ses usages restants, son camp, son amoureux.
export function ficheDuJoueur(f) {
  if (!f) return null;
  const x = normaliserFiche(f);
  return { camp: x.camp, amoureux: x.amoureux, role: x.role ? copie(x.role) : null };
}

// Ce qu'un mort qui voit tout reçoit d'un autre villageois : son rôle (nom, image, clé, camp du rôle) et son camp.
export function vueDesMorts(f) {
  if (!f) return null;
  const x = normaliserFiche(f);
  return { camp: x.camp, role: x.role ? { name: x.role.name, img: x.role.img, system: { cle: x.role.system.cle, camp: x.role.system.camp } } : null };
}

// Les données de l'objet `role` à créer sur le document à la révélation publique.
export function objetDeRole(f) {
  const r = normaliserRole(f?.role);
  return r ? { name: r.name, type: "role", img: r.img || undefined, system: copie(r.system) } : null;
}

// Usages d'un rôle : delta (−1 : consommé ; +1 : rendu), borné par [0, max]. Sans effet sans usages comptés (max 0).
export function changerUsage(f, delta) {
  const x = normaliserFiche(f);
  const u = x.role?.system.usages;
  if (!u || !(u.max > 0)) return x;
  u.restant = Math.min(u.max, Math.max(0, u.restant + delta));
  return x;
}

// Deux fiches qui échangent leur rôle (le Colporteur) : chacune prend le camp du rôle reçu ; le reste (amoureux, protections)
// reste à sa place.
export function echangerFiches(fa, fb) {
  const a = normaliserFiche(fa), b = normaliserFiche(fb);
  return [
    { ...a, role: b.role, camp: b.role?.system.camp ?? b.camp },
    { ...b, role: a.role, camp: a.role?.system.camp ?? a.camp }
  ];
}

// Égalité profonde (ordre des clés indifférent) : pour ne rien écrire ni envoyer qui n'ait changé.
export function egaux(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => egaux(x, b[i]));
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => egaux(a[k], b[k]));
}
