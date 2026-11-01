// API publique : game.lakourLoups (contrat §1). Les fonctions qui écrivent ne marchent que chez le MJ actif.
//
// Secrets (voir secrets.mjs) : l'état complet n'existe que chez le MJ actif ; le réglage monde ne reçoit que l'état
// public (separerEtat). Ce qu'un joueur doit savoir en secret lui est envoyé par le socket, à lui seul : choix de nuit
// (« demande »), carnet secret (« secret » / « carnet » : son rôle, ce qu'il apprend la nuit, les mots du Messager),
// accusé de son vote (« monVote »), refus (« avis »). Rien de secret ne passe par le chat (un chuchotement de Foundry
// est livré à tous les navigateurs).
//
// Compagnons IA (system.compagnon, sans joueur) : ils n'ont pas de navigateur. Leurs demandes (choix de nuit, mot du Messager,
// vote) ne passent pas par le socket : elles vont au résolveur fourni par le MJ IA (api.resolveurs.compagnon), appelé ici
// même, chez le MJ actif. Leur carnet secret reste chez le MJ (secrets) et nourrit leur cerveau. Sans résolveur, s'il échoue
// ou s'il tarde au-delà du délai, le compagnon passe : la partie n'attend jamais.
import { ID, CLE_MEUTE, EFFETS, EFFETS_AUTOMATISES, EFFETS_NARRATEUR, causePublique } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif, emettre, annoncer } from "./canal.mjs";
import { reglage } from "./reglages.mjs";
import { garderSecrets, secretsMJ } from "./secrets.mjs";
import { noterMonVote } from "./prive.mjs";
import {
  t, tousLesVillageois, roleDe, metierDe, villageoisAPlat, lireEtat, lirePublic, monVillageois, clesDesBatiments,
  libellePhase, libelleCamp, libelleCause, libelleVainqueur
} from "./donnees.mjs";
import { ouvrirChoix, fermerChoix } from "./apps/choix.mjs";
import { audibilite, audibiliteActeur } from "./salons.mjs";
import { ouvrirTable } from "./apps/table.mjs";
import {
  planifierMiseEnScene, attendreMiseEnScene, mettreEnScene, configurerPlateau, reglerDelais, sceneDuVillage, voulu, imageNeutre, imageDuJeton
} from "./plateau.mjs";

const NIVEAUX = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

function exigerMJ() {
  if (!estMJActif()) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasMJ"));
}

function acteurOuErreur(id) {
  const a = game.actors.get(id);
  if (!a || a.type !== "villageois") throw new Error(t("LAKOUR_LOUPS.Erreurs.VillageoisInconnu", { id: String(id) }));
  return a;
}

// Durée du vote : en millisecondes ; une valeur sous 1000 est comprise en secondes (on n'ouvre pas un vote de 120 ms).
const enMs = d => {
  const n = Number(d) || 0;
  return n > 0 && n < 1000 ? n * 1000 : n;
};

// ------------------------------------------------------------------ écriture de l'état, une modification à la fois
// fn reçoit l'état COMPLET ; le public part dans le réglage monde, les secrets restent chez le MJ.
let file = Promise.resolve();
function modifierEtat(fn) {
  const suite = file.then(async () => {
    const r = await fn(lireEtat());
    const etat = r?.etat ?? r;
    const { public: pub, secret } = L.separerEtat(etat);
    await garderSecrets(secret);
    await game.settings.set(ID, "partie", pub);
    return r;
  });
  file = suite.catch(() => {});
  return suite;
}

// ------------------------------------------------------------------ messages
const alias = () => t("LAKOUR_LOUPS.Narrateur");

async function annonceChat(contenu) {
  if (!reglage("annoncesEnChat")) return null;
  return ChatMessage.implementation.create({ content: `<div class="lakour-loups annonce">${contenu}</div>`, speaker: { alias: alias() } });
}

const echapper = s => foundry.utils.escapeHTML(String(s ?? ""));

// Un message de la logique ({ cle, texte, donnees }) dans la langue du monde. Une donnée peut être elle-même un
// message (l'indice du Lavoir) ; un camp est traduit.
function texteMessage(m) {
  const donnees = {};
  for (const [k, v] of Object.entries(m.donnees ?? {})) donnees[k] = v && typeof v === "object" && "cle" in v ? texteMessage(v) : v;
  if (donnees.camp) donnees.camp = libelleCamp(donnees.camp);
  return game.i18n.has(m.cle) ? t(m.cle, donnees) : m.texte;
}

// Une note pour le seul MJ actif : chronique secrète (Table de jeu) et notification.
async function noterPourMJ(texte, { notifier = false } = {}) {
  await modifierEtat(e => L.journaliserSecret(e, texte));
  if (notifier) ui.notifications?.info(texte);
}

// ------------------------------------------------------------------ carnet secret
// Un message secret pour le joueur d'un acteur : gardé par le MJ (pour le renvoyer si le joueur recharge ou se connecte
// plus tard) et envoyé à ce seul joueur. { texte } est échappé à l'affichage ; { html } vient du système (carte de rôle).
async function envoyerSecret(acteurId, { texte = "", html = "", titre = "" } = {}) {
  const acteur = acteurOuErreur(acteurId);
  const entree = { id: foundry.utils.randomID(), acteurId, titre: String(titre), quand: Date.now() };
  if (html) entree.html = String(html);
  else entree.texte = String(texte);
  const etat = await modifierEtat(e => L.journaliserSecret(L.ajouterAuCarnet(e, acteurId, entree),
    t("LAKOUR_LOUPS.Carnet.Envoye", { nom: acteur.name, texte: titre || String(texte).slice(0, 160) })));
  const complet = etat.carnets[acteurId].at(-1);
  const userId = acteur.system.joueur;
  if (userId) emettre({ type: "secret", partie: etat.partie, entree: complet }, [userId]);
  Hooks.callAll("lakourLoups.secret", complet);
  return complet;
}

// Tout le carnet d'un joueur (ses acteurs), sa prime et son vote en cours : à sa connexion, ou s'il recharge.
export function envoyerCarnet(userId) {
  if (!estMJActif() || !userId) return false;
  const etat = lireEtat();
  for (const a of tousLesVillageois().filter(a => a.system.joueur === userId)) {
    emettre({ type: "carnet", partie: etat.partie, acteurId: a.id, entrees: etat.carnets[a.id] ?? [], prime: etat.primes[a.id] ?? "",
      vote: { numero: etat.vote.numero, cible: etat.vote.ouvert ? etat.vote.votes[a.id] ?? "" : "" } }, [userId]);
  }
  return true;
}

function avis(userId, texte) {
  if (!userId) return;
  if (userId === game.user.id) ui.notifications?.warn(texte);
  else emettre({ type: "avis", texte }, [userId]);
}

// Carte de rôle envoyée en secret au joueur (carnet).
async function envoyerRole(acteur) {
  const role = roleDe(acteur), metier = metierDe(acteur);
  if ((!acteur?.system.joueur && !estCompagnon(acteur)) || !role) return;
  const etat = lireEtat();
  const meute = role.system.camp === "meute" || acteur.system.camp === "meute"
    ? tousLesVillageois().filter(a => a.id !== acteur.id && a.system.camp === "meute").map(a => a.name) : [];
  const prime = etat.primes?.[acteur.id] ? game.actors.get(etat.primes[acteur.id])?.name : "";
  const contenu = await foundry.applications.handlebars.renderTemplate(`systems/${ID}/templates/carte-role.hbs`, {
    acteur: acteur.name, role: role.name, img: role.img, camp: libelleCamp(acteur.system.camp),
    description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(role.system.description),
    victoire: role.system.victoire ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(role.system.victoire) : "",
    metier: metier?.name ?? "", maison: acteur.system.maison, meute: meute.join(", "), prime
  });
  return envoyerSecret(acteur.id, { html: contenu, titre: t("LAKOUR_LOUPS.Carnet.TitreRole", { role: role.name }) });
}

function donneesObjet(doc) {
  const d = game.items.fromCompendium(doc, { clearFolder: true, keepId: false });
  delete d._id;
  return d;
}

function roleParDefaut() {
  return {
    name: t("LAKOUR_LOUPS.RoleParDefaut.Nom"), type: "role", img: "icons/svg/mystery-man.svg",
    system: { cle: "villageois", camp: "village", description: `<p>${t("LAKOUR_LOUPS.RoleParDefaut.Description")}</p>` }
  };
}

// ------------------------------------------------------------------ compagnons IA
export const estCompagnon = a => Boolean(a?.system?.compagnon) && !a.system.joueur;
const PLACE_COMPAGNON = "compagnon:";

// Une demande pour un compagnon : le résolveur du MJ IA répond (au plus tard au délai), le système filtre la réponse comme
// celle d'un joueur (candidats admis, nombre de cibles, longueur du mot).
async function demanderAuCompagnon(demande) {
  const fn = api.resolveurs?.compagnon;
  const vide = demande.mode === "texte" ? "" : [];
  if (typeof fn !== "function") return vide;
  let minuterie;
  const delai = new Promise(r => { minuterie = setTimeout(() => r(null), Math.max(1000, Number(demande.delai) || 0)); });
  let reponse = null;
  try {
    reponse = await Promise.race([Promise.resolve().then(() => fn(foundry.utils.deepClone(demande))), delai]);
  } catch (e) {
    console.warn(`${ID} | compagnon ${demande.acteurNom} : il passe`, e);
  } finally {
    clearTimeout(minuterie);
  }
  if (demande.mode === "texte") return L.nettoyerMot(typeof reponse === "string" ? reponse : "", demande.max);
  const admis = new Set(demande.candidats.map(c => c.id));
  const choix = [...new Set(Array.isArray(reponse) ? reponse : [])].filter(c => admis.has(c)).slice(0, demande.nombre);
  if (demande.type === "demande") Hooks.callAll("lakourLoups.action", { acteurId: demande.acteurId, cibles: choix, demande: demande.id });
  return choix;
}

// Le vote ouvert : chaque compagnon vivant vote par son cerveau, en même temps que les joueurs. cloreVote attend leurs voix.
let votesCompagnons = Promise.resolve();
function faireVoterLesCompagnons(etat) {
  const v = etat?.vote;
  if (!v?.ouvert) return;
  const compagnons = tousLesVillageois().filter(a => a.system.vivant && estCompagnon(a));
  if (!compagnons.length) return;
  const fiche = id => game.actors.get(id);
  const candidats = v.candidats.map(id => ({ id, nom: fiche(id)?.name ?? id, img: fiche(id)?.img ?? "", maison: fiche(id)?.system.maison ?? "" }));
  const max = reglage("delaiChoix") * 1000;
  const ms = v.duree > 0 ? Math.min(v.duree, max) : max;
  const invite = t(v.objet === "chapelle" ? "LAKOUR_LOUPS.Choix.InviteChapelle" : "LAKOUR_LOUPS.Choix.InviteVote");
  const tache = Promise.all(compagnons.map(async a => {
    const [cible = ""] = await demanderAuCompagnon({ type: "vote", id: foundry.utils.randomID(), acteurId: a.id, acteurNom: a.name, invite,
      candidats, nombre: 1, delai: ms, objet: v.objet, numero: v.numero });
    const maintenant = lireEtat().vote;
    if (maintenant.ouvert && maintenant.numero === v.numero) await recevoirVote({ votant: a.id, cible, userId: game.user.id });
  }));
  votesCompagnons = votesCompagnons.then(() => tache).catch(e => console.warn(`${ID} | votes des compagnons`, e));
}

// ------------------------------------------------------------------ choix secrets (socket)
const enAttente = new Map();   // id de demande -> { resolve, minuterie, demande }

function terminer(id, cibles, expire, texte = "") {
  const p = enAttente.get(id);
  if (!p) return false;
  enAttente.delete(id);
  clearTimeout(p.minuterie);
  if (expire) {
    emettre({ type: "annuler", id }, [p.demande.destinataire]);
    fermerChoix(id);
  }
  if (p.demande.mode === "texte") {
    p.resolve(L.nettoyerMot(texte, p.demande.max));
    return true;
  }
  const admis = new Set(p.demande.candidats.map(c => c.id));
  const choix = [...new Set(cibles ?? [])].filter(c => admis.has(c)).slice(0, p.demande.nombre);
  p.resolve(choix);
  if (!expire) Hooks.callAll("lakourLoups.action", { acteurId: p.demande.acteurId, cibles: choix, demande: p.demande.id });
  return true;
}

// Réponse d'un joueur (reçue par socket, ou directement si le MJ répond à sa propre demande).
export function recevoirReponse({ id, cibles, texte, userId }) {
  const p = enAttente.get(id);
  if (!p || p.demande.destinataire !== userId) return false;
  if (game.actors.get(p.demande.acteurId)?.system.vivant === false) return terminer(id, [], false, "");
  return terminer(id, cibles, false, texte);
}

export function envoyerReponse(id, cibles, texte = "") {
  const message = { type: "reponse", id, cibles, texte, userId: game.user.id };
  if (estMJActif()) return recevoirReponse(message);
  const mj = game.users.activeGM;
  if (mj) emettre(message, [mj.id]);
}

function ouvrirDemande(demande, user) {
  return new Promise(resolve => {
    const minuterie = setTimeout(() => terminer(demande.id, [], true), demande.delai);
    enAttente.set(demande.id, { resolve, minuterie, demande });
    if (user.id === game.user.id) ouvrirChoix(demande);
    else emettre(demande, [user.id]);
  });
}

// ------------------------------------------------------------------ votes reçus
export async function recevoirVote({ votant, cible, userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(votant), user = game.users.get(userId);
  if (!acteur || !user || !acteur.system.vivant) return false;
  if (!user.isGM && acteur.system.joueur !== userId) return false;
  const votants = tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
  const r = await modifierEtat(e => L.enregistrerVote(e, { votant, cible: cible || "", votants }));
  if (r.ok) {
    // Chez les autres : seulement QUI a voté, jamais pour qui (le décompte est publié à la clôture).
    annoncer("lakourLoups.vote", [{ votant, cible: cible || "" }], [{ votant }]);
    if (user.id !== game.user.id) emettre({ type: "monVote", partie: r.etat.partie, numero: r.etat.vote.numero, cible: cible || "" }, [user.id]);
  } else if (r.raison === "temps") avis(userId, t("LAKOUR_LOUPS.Vote.TempsEcoule"));
  return r.ok;
}

export function envoyerVote(cible) {
  const moi = monVillageois();
  if (!moi) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeVillageois"));
  if (!moi.system.vivant) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.MortNeVotePas"));
  const message = { type: "vote", votant: moi.id, cible: cible ?? "", userId: game.user.id };
  if (estMJActif()) return recevoirVote(message);
  const pub = lirePublic();
  noterMonVote({ partie: pub.partie, numero: pub.vote.numero, cible: cible ?? "" });   // affichage immédiat, confirmé par le MJ
  const mj = game.users.activeGM;
  if (mj) emettre(message, [mj.id]);
}

// ------------------------------------------------------------------ pouvoirs de jour reçus
export async function recevoirJour({ acteurId, pouvoir, cibles = [], texte = "", userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(acteurId), user = game.users.get(userId);
  const def = L.POUVOIRS_JOUR[pouvoir];
  if (!user || !def) return false;
  if (def.narrateur ? !user.isGM : (!acteur || (!user.isGM && acteur.system.joueur !== userId))) {
    avis(userId, t("LAKOUR_LOUPS.Jour.Refus.absent"));
    return false;
  }
  try {
    await api.agirDeJour({ acteurId, pouvoir, cibles, texte });
    return true;
  } catch (e) {
    avis(userId, e.message);
    return false;
  }
}

export function envoyerJour({ acteurId, pouvoir, cibles = [], texte = "" }) {
  const message = { type: "jour", acteurId, pouvoir, cibles, texte, userId: game.user.id };
  if (estMJActif()) return recevoirJour(message);
  const mj = game.users.activeGM;
  if (!mj) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  emettre(message, [mj.id]);
}

const libelleRefus = (raison, def) => t(`LAKOUR_LOUPS.Jour.Refus.${raison}`, { n: def?.cibles ?? 0, mots: L.MOTS_DU_PUITS });

function nomDuPouvoir(pouvoir, acteur) {
  const def = L.POUVOIRS_JOUR[pouvoir];
  if (def?.source === "metier") return metierDe(acteur)?.name ?? pouvoir;
  if (def?.source === "role") return roleDe(acteur)?.name ?? pouvoir;
  const cle = `LAKOUR_LOUPS.Batiments.${pouvoir}`;
  return game.i18n.has(cle) ? t(cle) : pouvoir;
}

// ------------------------------------------------------------------ nouvelle partie
// Les demandes de nuit encore ouvertes (une partie abandonnée) : closes, chacune chez son joueur.
function annulerDemandes() {
  for (const id of [...enAttente.keys()]) terminer(id, [], true);
  votesCompagnons = Promise.resolve();
}

// Le contenu disponible : rôles, métiers et bâtiments (compendiums d'objets, puis objets du monde) par clé, et, du module
// qui fournit les rôles, son équilibre (assets/equilibre.json) et ses compositions prêtes (assets/compositions.json).
async function contenuDisponible() {
  const roles = new Map(), batiments = new Map(), metiers = new Map(), noms = new Map();
  let paquet = "";
  const ranger = (e, origine = "") => {
    const cle = e.system?.cle;
    if (!cle || !e.uuid) return;
    if (e.type === "role" && !roles.has(cle)) { roles.set(cle, e.uuid); noms.set(cle, e.name); paquet ||= origine; }
    else if (e.type === "metier" && !metiers.has(cle)) metiers.set(cle, e.uuid);
    else if (e.type === "batiment" && !batiments.has(cle)) batiments.set(cle, e.uuid);
  };
  for (const pack of game.packs?.contents ?? []) {
    if (pack.documentName !== "Item" || typeof pack.getIndex !== "function") continue;
    const index = await pack.getIndex({ fields: ["system.cle"] });
    for (const e of (typeof index.values === "function" ? index.values() : index)) ranger(e, pack.metadata?.packageName ?? "");
  }
  for (const i of game.items?.contents ?? [...(game.items?.values?.() ?? [])]) ranger(i);
  const lire = async fichier => {
    if (!paquet) return null;
    try {
      const r = await fetch(foundry.utils.getRoute(`modules/${paquet}/assets/${fichier}`), { cache: "no-store" });
      return r.ok === false ? null : await r.json();
    } catch { return null; }
  };
  const [equilibre, compositions] = await Promise.all([lire("equilibre.json"), lire("compositions.json")]);
  return { roles, metiers: [...metiers.values()], batiments, noms, equilibre: equilibre ?? { roles: {}, batiments: {} }, compositions: compositions ?? {} };
}

const lireReglage = (cle, defaut) => { try { return game.settings.get(ID, cle) ?? defaut; } catch { return defaut; } };
// L'historique des parties (rôles et bâtiments en jeu, jamais qui avait quoi), pour varier les compositions ; celui du
// MJ IA (lakour-mj-ia.historiqueLoups) s'y ajoute s'il existe.
function historiqueDesParties() {
  let ia = [];
  try { if (game.settings.settings?.has?.("lakour-mj-ia.historiqueLoups")) ia = game.settings.get("lakour-mj-ia", "historiqueLoups") ?? []; } catch { ia = []; }
  return [...ia, ...lireReglage("historique", [])].sort((a, b) => (a.quand ?? 0) - (b.quand ?? 0)).slice(-10);
}

// Une clé de rôle d'après sa clé ou son nom.
function cleDeRole(texte, contenu) {
  const n = String(texte ?? "").trim().toLowerCase();
  if (contenu.roles.has(n)) return n;
  return [...contenu.noms].find(([, nom]) => nom.toLowerCase() === n)?.[0] ?? null;
}

// Les réveils de nuit en cours (demandes envoyées, sans réponse encore) : roleCle.
const reveilsEnCours = new Set();
let pointCompagnons = null;

// ------------------------------------------------------------------ l'API
export const api = {
  // Point d'enregistrement des compagnons IA, déposé par le MJ IA (s'il est actif, même sans séance de narrateur) :
  // { disponible: true, async creer(n) -> [acteurId], async retirer(acteurId) }. La Table de jeu s'en sert pour ajouter
  // ou retirer des joueurs IA ; le hook lakourLoups.compagnons prévient quand il change. null : pas de joueurs IA.
  get compagnons() { return pointCompagnons; },
  set compagnons(point) {
    pointCompagnons = point && typeof point === "object" ? point : null;
    Hooks.callAll("lakourLoups.compagnons", pointCompagnons);
  },

  logique: L,
  // Résolveurs fournis par d'autres modules. compagnon(demande) -> [acteurId] (choix de nuit, vote) ou texte (mode "texte") :
  // le MJ IA y branche le cerveau de ses compagnons. demande : { type: "demande" | "vote", mode?, id, acteurId, acteurNom,
  // invite, candidats: [{ id, nom, img, maison }], nombre, max?, delai, objet?, numero? }.
  resolveurs: { compagnon: null },
  effets: { tous: EFFETS, automatises: EFFETS_AUTOMATISES, narrateur: EFFETS_NARRATEUR },

  etat() {
    return foundry.utils.deepClone(lireEtat());
  },

  villageois() {
    return tousLesVillageois();
  },

  // compagnons : les villageois tenus par des compagnons IA (sans joueur), en plus des joueurs : un nom (un compagnon d'une
  // partie précédente est repris et renommé, sinon un villageois est créé), ou l'id d'un villageois compagnon déjà là
  // (créé par le MJ IA, api.compagnons.creer : il garde son nom), ou { acteurId } / { nom }.
  async distribuer({ roles = [], metiers = [], joueurs = [], compagnons = [], maisons = [], graine, composition = "", batiments = [] } = {}) {
    exigerMJ();
    const estPlaceCompagnon = id => { const a = game.actors.get(id); return a?.type === "villageois" && estCompagnon(a); };
    const placesIA = compagnons.map(n => {
      const id = typeof n === "object" ? n?.acteurId ?? "" : String(n ?? "");
      if (id && estPlaceCompagnon(id)) return { acteurId: id, nom: game.actors.get(id).name };
      return { acteurId: "", nom: String(typeof n === "object" ? n?.nom ?? "" : n ?? "").trim() };
    }).filter(c => c.acteurId || c.nom);
    const nomsCompagnons = placesIA.map(c => c.nom);
    if (!joueurs.length && !nomsCompagnons.length) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeJoueurs"));
    const cache = new Map();
    for (const uuid of [...roles, ...metiers]) {
      if (cache.has(uuid)) continue;
      const doc = await fromUuid(uuid);
      if (!doc || doc.documentName !== "Item") throw new Error(t("LAKOUR_LOUPS.Erreurs.Introuvable", { uuid }));
      cache.set(uuid, doc);
    }
    const batimentsCles = [];
    for (const uuid of batiments) {
      const d = await fromUuid(uuid);
      if (d?.system?.cle) batimentsCles.push(d.system.cle);
    }
    // Les compagnons tiennent des places comme les joueurs (mêmes tirages de rôle, de métier et de maison).
    const places = [...joueurs, ...nomsCompagnons.map((_, i) => `${PLACE_COMPAGNON}${i}`)];
    const lesMaisons = maisons.length ? maisons : L.maisonsDuVillage(places.length);
    const tirage = L.distribuer({ roles, metiers, joueurs: places, maisons: lesMaisons, graine });
    // Les compagnons d'une partie précédente sont repris (renommés) ; ceux qui restent sont retirés du village.
    const reserves = new Set(placesIA.map(c => c.acteurId).filter(Boolean));
    const anciensCompagnons = tousLesVillageois().filter(a => a.system.compagnon && !a.system.joueur && !reserves.has(a.id));
    const sortie = [];
    for (const att of tirage) {
      const indexCompagnon = att.joueur.startsWith(PLACE_COMPAGNON) ? Number(att.joueur.slice(PLACE_COMPAGNON.length)) : -1;
      const compagnon = indexCompagnon >= 0;
      const user = compagnon ? null : game.users.get(att.joueur);
      const roleData = att.role ? donneesObjet(cache.get(att.role)) : roleParDefaut();
      const metierData = att.metier ? donneesObjet(cache.get(att.metier)) : null;
      const system = { joueur: compagnon ? "" : att.joueur, compagnon, vivant: true, revele: false, camp: roleData.system?.camp ?? "village",
        maison: att.maison, amoureux: "", silence: false, protections: 0 };
      const ownership = compagnon ? { default: NIVEAUX().LIMITED } : { default: NIVEAUX().LIMITED, [att.joueur]: NIVEAUX().OWNER };
      const nomCompagnon = compagnon ? nomsCompagnons[indexCompagnon] : "";
      const reserve = compagnon ? placesIA[indexCompagnon].acteurId : "";
      let acteur = compagnon ? (reserve ? game.actors.get(reserve) : anciensCompagnons.shift()) : tousLesVillageois().find(a => a.system.joueur === att.joueur);
      if (acteur && compagnon && acteur.name !== nomCompagnon) await acteur.update({ name: nomCompagnon, "prototypeToken.name": nomCompagnon });
      if (acteur) {
        const anciens = acteur.items.filter(i => i.type === "role" || i.type === "metier").map(i => i.id);
        if (anciens.length) await acteur.deleteEmbeddedDocuments("Item", anciens);
        await acteur.update({ system, ownership });
        try { if (acteur.statuses?.has("dead")) await acteur.toggleStatusEffect("dead", { active: false }); } catch { /* sans jeton */ }
      } else {
        const nom = compagnon ? nomCompagnon : user?.name ?? t("LAKOUR_LOUPS.RoleParDefaut.Nom");
        acteur = await Actor.implementation.create({ name: nom, type: "villageois", system, ownership,
          prototypeToken: { name: nom, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL } });
      }
      await acteur.createEmbeddedDocuments("Item", [roleData, metierData].filter(Boolean));
      sortie.push({ acteurId: acteur.id, userId: compagnon ? "" : att.joueur, compagnon, roleCle: roleData.system?.cle ?? "" });
    }
    for (const a of anciensCompagnons) {
      if (typeof api.compagnons?.retirer === "function") { try { await api.compagnons.retirer(a.id); } catch { /* repli */ } }
      if (game.actors.get(a.id)) await a.delete();
    }
    const enJeu = villageoisAPlat().filter(v => sortie.some(s => s.acteurId === v.id));
    const etat = await modifierEtat(() => {
      const e = L.etatInitial();
      e.partie = foundry.utils.randomID();
      e.composition = composition;
      e.batiments = [...batiments];
      e.batimentsCles = batimentsCles;
      e.primes = L.designerPrimes(enJeu);
      return L.journaliser(e, t("LAKOUR_LOUPS.Journal.Distribution", { n: sortie.length }));
    });
    for (const s of sortie) await envoyerRole(game.actors.get(s.acteurId));
    annoncer("lakourLoups.phase", ["preparation", etat], ["preparation", L.etatPublic(etat)]);
    return sortie;
  },

  async changerPhase(phase) {
    exigerMJ();
    if (!L.PHASES.includes(phase)) throw new Error(t("LAKOUR_LOUPS.Erreurs.PhaseInconnue", { phase: String(phase) }));
    if (phase === "nuit") {
      for (const a of tousLesVillageois().filter(a => a.system.silence)) await a.update({ "system.silence": false });
    }
    if (phase === "jour") {
      for (const a of tousLesVillageois().filter(a => a.system.protections > 0)) await a.update({ "system.protections": 0 });
    }
    const etat = await modifierEtat(e => {
      const x = L.passerPhase(e, phase);
      return L.journaliser(x, t("LAKOUR_LOUPS.Journal.Phase", { phase: libellePhase(phase), tour: x.tour }));
    });
    annoncer("lakourLoups.phase", [phase, etat], [phase, L.etatPublic(etat)]);
    return foundry.utils.deepClone(etat);
  },

  // Une nouvelle partie avec les MÊMES participants : mêmes humains (memesJoueurs, sinon les joueurs connectés), même
  // nombre de compagnons IA (mêmes villageois, mêmes noms). Tout est remis à zéro (état public et secrets, vivants, non
  // révélés, sans silence, rôles et métiers retirés puis redistribués), le plateau est remis en place (jetons neutres
  // devant les maisons, lumière de jour, scène du village active). Composition : roles (clés ou noms) si donnés, sinon
  // la composition prête nommée, sinon une composition équilibrée générée (niveau, historique pour varier), et à
  // défaut d'équilibre, les rôles de la partie précédente rebattus.
  // -> { partie, joueurs: [{ userId, nom, acteurId }], compagnons: [{ nom, acteurId }],
  //      composition: { cle, libelle, niveau, roles: [cle], batiments: [cle], somme?, verdict? } }
  // Hook lakourLoups.nouvellePartie : chez le MJ ce résumé ; chez tous { partie, joueurs: n, compagnons: n, composition: { cle, libelle } }.
  // joueurs : [userId] (au lieu des mêmes, ou des connectés) ; compagnons : [acteurId] des villageois compagnons à garder
  // (par défaut : tous ceux du village, mêmes noms).
  async nouvellePartie({ memesJoueurs = true, joueurs = null, compagnons: ia = null, composition = "", roles = [], niveau = "", graine } = {}) {
    exigerMJ();
    const avant = lireEtat();
    const anciens = tousLesVillageois();
    const humains = Array.isArray(joueurs) ? [...new Set(joueurs.filter(id => game.users.get(id) && !game.users.get(id).isGM))]
      : memesJoueurs ? [...new Set(anciens.map(a => a.system.joueur).filter(id => id && game.users.get(id)))]
        : game.users.filter(u => u.active && !u.isGM).map(u => u.id);
    const compagnons = Array.isArray(ia) ? ia.filter(id => estCompagnon(game.actors.get(id))) : anciens.filter(estCompagnon).map(a => a.id);
    memesJoueurs = memesJoueurs && !Array.isArray(joueurs);
    const total = humains.length + compagnons.length;
    if (!total) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeJoueurs"));
    const contenu = await contenuDisponible();
    const precedents = anciens.map(a => roleDe(a)?.system.cle).filter(Boolean);
    const historique = [...historiqueDesParties(), ...(precedents.length ? [{ roles: precedents, batiments: avant.batimentsCles ?? [], quand: Date.now() }] : [])];
    const niveauPrecedent = [...historique].reverse().find(h => h.niveau)?.niveau ?? contenu.compositions[avant.composition]?.niveau ?? "classique";
    const niv = L.NIVEAUX.includes(niveau) ? niveau : niveauPrecedent;
    const equilibreOk = Object.keys(contenu.equilibre.roles ?? {}).length > 0 && total >= 4;
    const genere = inclure => L.composer(total, contenu.equilibre, { niveau: niv, inclure, historique, graine });
    let compo;
    if (roles.length) {
      const cles = roles.map(r => cleDeRole(r, contenu));
      if (cles.some(c => !c)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: roles.filter((_, i) => !cles[i]).join(", ") }));
      const bat = equilibreOk ? genere(cles.filter(c => c !== "villageois" && c !== "loup-de-brumecombe")).batiments : avant.batimentsCles ?? [];
      compo = { cle: "choisie", libelle: t("LAKOUR_LOUPS.NouvellePartie.Choisie"), niveau: niv, roles: cles, batiments: bat };
    } else if (composition && contenu.compositions[composition]) {
      const c = contenu.compositions[composition];
      compo = { cle: composition, libelle: c.libelle ?? composition, niveau: c.niveau ?? niv, roles: [...c.roles], batiments: [...(c.batiments ?? [])] };
    } else if (equilibreOk) {
      const g = genere([]);
      compo = { cle: "generee", libelle: t("LAKOUR_LOUPS.NouvellePartie.Generee", { verdict: g.verdict }), niveau: niv, roles: g.roles, batiments: g.batiments, somme: g.somme, verdict: g.verdict };
    } else {
      compo = { cle: avant.composition || "reprise", libelle: t("LAKOUR_LOUPS.NouvellePartie.Reprise"), niveau: niv, roles: precedents, batiments: avant.batimentsCles ?? [] };
    }
    const cles = compo.roles.slice(0, total);
    while (cles.length < total) cles.push("villageois");
    compo.roles = cles;
    const uuidsRoles = cles.map(c => contenu.roles.get(c));
    if (uuidsRoles.some(u => !u)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: cles.filter((_, i) => !uuidsRoles[i]).join(", ") }));
    const metiers = contenu.metiers.length ? Array.from({ length: total }, (_, i) => contenu.metiers[i % contenu.metiers.length]) : [];
    compo.batiments = compo.batiments.filter(c => contenu.batiments.has(c));
    const batiments = compo.batiments.map(c => contenu.batiments.get(c));
    // Une partie abandonnée : ses demandes de nuit se ferment ; les villageois de joueurs qui ne rejouent pas quittent le village.
    annulerDemandes();
    if (!memesJoueurs) for (const a of anciens.filter(x => x.system.joueur && !humains.includes(x.system.joueur))) await a.delete();
    const sortie = await api.distribuer({ roles: uuidsRoles, metiers, joueurs: humains, compagnons, maisons: L.maisonsDuVillage(total),
      graine, composition: compo.cle, batiments });
    try {
      await game.settings.set(ID, "historique", [...lireReglage("historique", []), { roles: [...cles], batiments: [...compo.batiments], niveau: compo.niveau, composition: compo.cle, quand: Date.now() }].slice(-10));
    } catch { /* réglage absent */ }
    const partie = lireEtat().partie;
    const resume = {
      partie,
      joueurs: sortie.filter(x => !x.compagnon).map(x => ({ userId: x.userId, nom: game.users.get(x.userId)?.name ?? "", acteurId: x.acteurId })),
      compagnons: sortie.filter(x => x.compagnon).map(x => ({ nom: game.actors.get(x.acteurId)?.name ?? "", acteurId: x.acteurId })),
      composition: { cle: compo.cle, libelle: compo.libelle, niveau: compo.niveau, roles: [...cles], batiments: [...compo.batiments],
        ...(compo.somme !== undefined ? { somme: compo.somme, verdict: compo.verdict } : {}) }
    };
    annoncer("lakourLoups.nouvellePartie", [foundry.utils.deepClone(resume)],
      [{ partie, joueurs: resume.joueurs.length, compagnons: resume.compagnons.length, composition: { cle: compo.cle, libelle: compo.libelle } }]);
    await annonceChat(echapper(t("LAKOUR_LOUPS.NouvellePartie.Annonce", { n: total })));
    return resume;
  },

  // Réveille un rôle de la nuit (ou la meute) comme le ferait le narrateur : candidats du système (effets du jour compris),
  // demande secrète au joueur (ou au compagnon IA), mot du Messager, puis note l'action. Pour la Table de jeu du MJ humain.
  // -> { roleCle, acteurIds, cibles, texte }
  async reveiller(roleCle, { delai } = {}) {
    exigerMJ();
    const etat = lireEtat();
    const tour = Math.max(1, etat.tour);
    const entree = L.ordreDeNuit(villageoisAPlat(), tour).find(e => e.roleCle === roleCle);
    if (!entree) throw new Error(t("LAKOUR_LOUPS.Erreurs.PersonneAReveiller", { role: String(roleCle) }));
    const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;
    const acteurs = entree.acteurIds.map(id => game.actors.get(id));
    const roles = acteurs.map(a => roleDe(a));
    const meute = roleCle === CLE_MEUTE;
    const role = meute ? roles.find(r => r?.system.camp === "meute" && Number(r.system.nuit.ordre) === 40) : roles[0];
    const effet = meute ? "tuer" : role?.system.effet ?? "";
    const base = api.candidatsDeNuit({ acteurId: entree.acteurIds[0], roleCle });
    // Les proies de la meute cette nuit (pour la Louve mère et l'Herboriste).
    const rolesParCle = new Map(villageoisAPlat().filter(v => v.role).map(v => [v.role.cle, v.role]));
    const proies = etat.nuit.actions.filter(a => a.roleCle === CLE_MEUTE
      || (rolesParCle.get(a.roleCle)?.camp === "meute" && rolesParCle.get(a.roleCle)?.effet === "tuer")).flatMap(a => a.cibles);
    let candidats = base;
    let invite = role?.system.nuit.invite || (meute ? "" : t("LAKOUR_LOUPS.Choix.InviteParDefaut"));
    if (effet === "voir-role-mort") candidats = base.length ? tousLesVillageois().filter(a => !a.system.vivant).map(a => a.id) : [];
    if (effet === "mordre") candidats = candidats.filter(id => proies.includes(id));
    if (effet === "remede" && proies.length) invite = `${t("LAKOUR_LOUPS.Nuit.ProiesDeLaMeute", { noms: proies.map(id => game.actors.get(id)?.name ?? "").join(", ") })} ${invite}`;
    reveilsEnCours.add(roleCle);
    Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: true });
    let cibles = [], texte = "";
    try {
      if (!candidats.length && Number(entree.cibles) > 0) cibles = [];
      else if (meute || (role?.system.camp === "meute" && acteurs.length > 1)) cibles = await api.demanderActionMeute({ invite, candidats, delai: ms });
      else cibles = await api.demanderAction({ acteurId: entree.acteurIds[0], invite, candidats, nombre: entree.cibles, delai: ms });
      if (effet === "messager" && cibles.length === 2 && cibles[0] !== cibles[1]) {
        texte = await api.demanderTexte({ acteurId: cibles[0], delai: ms,
          invite: t("LAKOUR_LOUPS.Nuit.InviteMessager", { nom: game.actors.get(cibles[1])?.name ?? "" }) });
      }
      await api.noterAction({ acteurId: entree.acteurIds[0], roleCle, cibles, ...(texte ? { texte } : {}) });
    } finally {
      reveilsEnCours.delete(roleCle);
      Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: false });
    }
    return { roleCle, acteurIds: [...entree.acteurIds], cibles, texte };
  },

  reveilsEnCours() {
    return [...reveilsEnCours];
  },

  // L'étape suivante pour le MJ humain (logique/etapes.mjs) : { cle, action, donnees, attente, detail }.
  // ignorer : étapes écartées par le MJ (« emporter:<id> » quand la Braconnière n'emporte personne).
  etapeSuivante({ ignorer = [] } = {}) {
    return L.etapeSuivante(lirePublic(), estMJActif() ? secretsMJ() : null,
      { villageois: villageoisAPlat(), attente: [...reveilsEnCours], ignorer });
  },

  // Le contenu de la partie (rôles, métiers, bâtiments, équilibre, compositions prêtes), pour la préparation sur la Table.
  // -> { roles: [{ cle, nom, camp, poids, niveau }], niveaux, compositions: [{ cle, libelle, joueurs, niveau }] }
  async contenu() {
    const c = await contenuDisponible();
    const eq = c.equilibre.roles ?? {};
    return {
      roles: [...c.roles.keys()].map(cle => ({ cle, nom: c.noms.get(cle) ?? cle, camp: eq[cle]?.camp ?? "village", poids: eq[cle]?.poids ?? 0, niveau: eq[cle]?.niveau ?? "" }))
        .sort((a, b) => ["meute", "village", "solitaire"].indexOf(a.camp) - ["meute", "village", "solitaire"].indexOf(b.camp) || a.nom.localeCompare(b.nom, "fr")),
      niveaux: [...L.NIVEAUX], equilibre: c.equilibre,
      compositions: Object.entries(c.compositions).map(([cle, x]) => ({ cle, libelle: x.libelle ?? cle, joueurs: x.joueurs, niveau: x.niveau }))
    };
  },

  // Le plateau du village (scripts/plateau.mjs) : mise en scène automatique chez le MJ actif.
  plateau: {
    mettreEnScene: options => mettreEnScene(options),
    planifier: options => planifierMiseEnScene(options),
    attendre: () => attendreMiseEnScene(),
    configurer: options => configurerPlateau(options),
    reglerDelais: d => reglerDelais(d),
    scene: () => sceneDuVillage(),
    voulu: () => voulu(),
    imageNeutre: () => imageNeutre(),
    imageDuJeton: acteur => imageDuJeton(acteur)
  },

  ordreDeNuit() {
    return L.ordreDeNuit(villageoisAPlat(), Math.max(1, lireEtat().tour));
  },

  // Qui ce rôle (ou la meute) peut désigner cette nuit, compte tenu des effets du jour (Passeur, Grange, Garde du guet,
  // Chapelle, Taverne, Pont). Le narrateur le passe à demanderAction.
  candidatsDeNuit({ acteurId = "", roleCle = "" } = {}) {
    const etat = lireEtat();
    return L.candidatsDeNuit({ villageois: villageoisAPlat(), etat, acteurId, roleCle, tour: Math.max(1, etat.tour) });
  },

  demanderAction({ acteurId, invite = "", candidats, nombre = 1, delai } = {}) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    // Un rôle sans cible (nuit.cibles = 0 : Ermite, Chasseur de primes) n'a rien à choisir : pas de fenêtre.
    if (Number(nombre) === 0) return Promise.resolve([]);
    // Un mort n'agit plus (joueur ou compagnon IA) : il n'est pas réveillé.
    if (!acteur.system.vivant) return Promise.resolve([]);
    const compagnon = estCompagnon(acteur);
    const user = compagnon ? null : game.users.get(acteur.system.joueur);
    if (!compagnon && !user?.active) return Promise.resolve([]);
    // Se désigner soi-même seulement si le rôle le permet (nuit.soiMeme).
    const soiMeme = Boolean(roleDe(acteur)?.system.nuit.soiMeme);
    const ids = (candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id)).filter(id => soiMeme || id !== acteurId);
    const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;   // contrat : délai en ms
    const demande = {
      type: "demande", id: foundry.utils.randomID(), destinataire: user?.id ?? "", acteurId, acteurNom: acteur.name,
      invite: invite || t("LAKOUR_LOUPS.Choix.InviteParDefaut"),
      candidats: ids.map(id => {
        const a = game.actors.get(id);
        return { id, nom: a?.name ?? id, img: a?.img ?? "", maison: a?.system.maison ?? "" };
      }),
      nombre: Math.max(1, Number(nombre) || 1), delai: ms, finit: Date.now() + ms
    };
    return compagnon ? demanderAuCompagnon(demande) : ouvrirDemande(demande, user);
  },

  // Une phrase à écrire, dans une fenêtre ouverte chez ce seul joueur (le mot que le Messager portera). "" s'il passe.
  demanderTexte({ acteurId, invite = "", delai, max = L.LONGUEUR_MESSAGE } = {}) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    if (!acteur.system.vivant) return Promise.resolve("");
    const compagnon = estCompagnon(acteur);
    const user = compagnon ? null : game.users.get(acteur.system.joueur);
    if (!compagnon && !user?.active) return Promise.resolve("");
    const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;
    const demande = {
      type: "demande", mode: "texte", id: foundry.utils.randomID(), destinataire: user?.id ?? "", acteurId, acteurNom: acteur.name,
      invite: invite || t("LAKOUR_LOUPS.Choix.InviteTexte"), candidats: [], nombre: 0, max: Math.max(1, Number(max) || L.LONGUEUR_MESSAGE),
      delai: ms, finit: Date.now() + ms
    };
    return compagnon ? demanderAuCompagnon(demande) : ouvrirDemande(demande, user);
  },

  async demanderActionMeute({ invite = "", candidats, delai } = {}) {
    exigerMJ();
    const etat = lireEtat();
    const tousLesLoups = tousLesVillageois().filter(a => a.system.vivant && a.system.camp === "meute");
    // Seuls chassent les loups libres cette nuit (ni gardés à l'œil, ni hors d'atteinte).
    const libres = L.loupsQuiChassent(villageoisAPlat(), etat, Math.max(1, etat.tour));
    const loups = tousLesLoups.filter(l => libres.includes(l.id));
    // On ne chasse pas les siens : les loups vivants sont retirés des candidats.
    const cand = (candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id)).filter(id => !tousLesLoups.some(l => l.id === id));
    const choix = await Promise.all(loups.map(async l => {
      const c = await api.demanderAction({ acteurId: l.id, invite: invite || t("LAKOUR_LOUPS.Choix.InviteMeute"), candidats: cand, nombre: 1, delai });
      return { votant: l.id, cible: c[0] ?? "", quand: Date.now() };
    }));
    const cible = L.majoriteMeute(choix);
    return cible ? [cible] : [];
  },

  async noterAction({ acteurId, roleCle, cibles = [], effet, texte } = {}) {
    exigerMJ();
    const acteur = game.actors.get(acteurId);
    const role = roleDe(acteur);
    const cle = roleCle ?? role?.system.cle ?? "";
    const etat = await modifierEtat(e => L.ajouterAction(e, { acteurId, roleCle: cle, cibles, effet, texte }));
    // Un usage n'est consommé que si le pouvoir sert (une cible, ou un rôle sans cible) : passer ne coûte rien.
    const utilise = cibles.length > 0 || Number(role?.system.nuit.cibles) === 0;
    if (utilise && cle !== CLE_MEUTE && role && role.system.cle === cle && role.system.usages.max > 0) {
      await role.update({ "system.usages.restant": Math.max(0, role.system.usages.restant - 1) });
    }
    return foundry.utils.deepClone(etat.nuit.actions.at(-1));
  },

  // Résout la nuit en cours (contrat §4) : applique ce que le système sait appliquer, puis ce que disent les bâtiments
  // à l'aube (Moulin, Lavoir, Cimetière).
  // messages : [{ acteurId, texte }] à remettre en secret au joueur de cet acteur (le MJ IA les envoie par envoyerSecret) ;
  // narration : [texte] pour le seul narrateur ; annonces : [texte] publiques, déjà postées au chat (réglage annoncesEnChat).
  // Avec { chuchoter: true } (Table de jeu), le système remet lui-même les messages (carnet secret).
  async resoudreNuit({ chuchoter: envoyer = false } = {}) {
    exigerMJ();
    const avant = lireEtat();
    // Une nuit ne se résout qu'une fois (un second appel ne rend rien et ne touche à rien).
    if (avant.nuitResolue === avant.tour && !avant.nuit.actions.length) {
      return { morts: [], revelations: [], messages: [], narration: [], deces: [], sauves: [], changements: [], enAttente: [], narrateur: [],
        voteDouble: false, fiolesVides: [], annonces: [], bilan: null };
    }
    const tour = Math.max(1, avant.tour);
    const cles = clesDesBatiments(avant);
    const r = L.resoudreNuit({
      villageois: villageoisAPlat(), actions: avant.nuit.actions, tour, asperges: avant.asperges,
      precedentes: avant.nuitPrecedente.actions, primes: avant.primes, fioles: avant.fioles, chanceEpier: reglage("chanceEpier"),
      jour: L.effetsDeLaNuit(avant, tour, { batiments: cles })
    });
    // Une fiole déjà vide n'a rien versé : l'usage décompté par noterAction est rendu, AVANT les échanges de rôles de la nuit
    // (sinon il irait au rôle reçu par échange, ex. un Colporteur qui pourrait échanger une seconde fois).
    for (const id of r.fiolesVides) {
      const role = roleDe(game.actors.get(id));
      const u = role?.system.usages;
      if (u?.max > 0) await role.update({ "system.usages.restant": Math.min(u.max, u.restant + 1) });
    }
    for (const c of r.changements) {
      if (c.type === "camp") await api.changerCamp(c.acteurId, c.camp);
      else if (c.type === "amour") {
        await game.actors.get(c.a)?.update({ "system.amoureux": c.b });
        await game.actors.get(c.b)?.update({ "system.amoureux": c.a });
      } else if (c.type === "silence") await api.reduireAuSilence(c.acteurId);
      else if (c.type === "echange") await api.echangerRoles(c.a, c.b);
    }
    for (const d of r.deces) await api.eliminer(d.acteurId, { cause: d.cause });
    for (const rev of r.revelations) await game.actors.get(rev.acteurId)?.update({ "system.revele": true });
    for (const a of tousLesVillageois().filter(a => a.system.protections > 0)) await a.update({ "system.protections": 0 });

    // Les bâtiments parlent à l'aube, sur l'état d'après la nuit.
    const aube = L.annoncesDeLAube({ villageois: villageoisAPlat(), etat: lireEtat(), tour, bilan: r.bilan, batiments: cles,
      revelerALaMort: reglage("revelerALaMort") });
    const messages = [...r.messages.filter(m => m.destinataire !== "mj"), ...aube.prives].map(m => ({ acteurId: m.destinataire, texte: texteMessage(m) }));
    const annonces = [...r.annonces, ...aube.annonces].map(texteMessage);
    const narration = [
      ...r.messages.filter(m => m.destinataire === "mj").map(texteMessage),
      ...r.narrateur.map(n => t("LAKOUR_LOUPS.Nuit.ANarrer", {
        qui: game.actors.get(n.acteurId)?.name ?? n.acteurId, effet: n.effet || "—",
        cibles: n.cibles.map(id => game.actors.get(id)?.name ?? id).join(", ") || "—"
      })),
      ...r.enAttente.map(x => t("LAKOUR_LOUPS.Messages.Emporter", { nom: game.actors.get(x.acteurId)?.name ?? x.acteurId }))
    ];
    for (const texte of annonces) await annonceChat(echapper(texte));
    if (envoyer) for (const m of messages) await envoyerSecret(m.acteurId, { texte: m.texte });

    const noms = r.morts.map(id => game.actors.get(id)?.name ?? id).join(", ");
    await modifierEtat(e => {
      let x = L.cloreNuit(e, { asperges: r.asperges, fioles: r.fioles, bilan: r.bilan, pontFranchi: r.pontFranchi && cles.includes("pont") });
      if (r.voteDouble) x.voteDoubleDemain = true;
      x.cimetiere = [...new Set([...x.cimetiere, ...aube.cimetiere])];
      for (const texte of narration) x = L.journaliserSecret(x, texte);
      for (const texte of annonces) x = L.journaliser(x, texte);
      return L.journaliser(x, noms ? t("LAKOUR_LOUPS.Journal.Aube", { tour: x.tour, noms }) : t("LAKOUR_LOUPS.Journal.AubeCalme", { tour: x.tour }));
    });
    annoncer("lakourLoups.aube", [{ tour, morts: r.morts, annonces }]);
    return {
      morts: r.morts, revelations: r.revelations,
      messages, narration, annonces,
      deces: r.deces, sauves: r.sauves, changements: r.changements, enAttente: r.enAttente, narrateur: r.narrateur, voteDouble: r.voteDouble,
      fiolesVides: r.fiolesVides, bilan: r.bilan
    };
  },

  // objet : "execution" (par défaut) ou "chapelle" (le village choisit à main levée qui dormira à la Chapelle).
  async ouvrirVote({ candidats, duree, double, majoriteAbsolue, objet = "execution" } = {}) {
    exigerMJ();
    let ids = candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
    // La Chapelle n'abrite jamais deux nuits de suite le même joueur : il n'est pas candidat.
    if (objet === "chapelle") {
      const permis = L.candidatsDuPouvoir({ villageois: villageoisAPlat(), etat: lireEtat(), pouvoir: "chapelle" });
      ids = ids.filter(id => permis.includes(id));
    }
    const ms = duree === undefined ? reglage("dureeVote") * 1000 : enMs(duree);
    const gibet = majoriteAbsolue ?? clesDesBatiments().includes("gibet");
    const etat = await modifierEtat(e => L.journaliser(L.ouvrirVote(e, { candidats: ids, duree: ms, double, majoriteAbsolue: gibet, objet }),
      t(objet === "chapelle" ? "LAKOUR_LOUPS.Journal.VoteChapelle" : "LAKOUR_LOUPS.Journal.VoteOuvert")));
    annoncer("lakourLoups.phase", ["vote", etat], ["vote", L.etatPublic(etat)]);
    faireVoterLesCompagnons(etat);
    return foundry.utils.deepClone(L.etatPublic(etat).vote);
  },

  // -> { decompte, elu, elus, votes, egalite, objet, numero, tour } ; ou { prolonge: acteurId } si le plus désigné porte
  // le ruban de la Tisserande (le vote reste ouvert une minute de plus : clore de nouveau ensuite).
  // Un vote de la Chapelle met l'élu à l'abri pour la nuit suivante.
  async cloreVote() {
    exigerMJ();
    await votesCompagnons;   // les voix des compagnons encore en réflexion
    const votants = tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
    const r = await modifierEtat(e => {
      const c = L.cloreVote(e, { votants });
      if (c.prolonge) {
        const nom = game.actors.get(c.prolonge)?.name ?? c.prolonge;
        return { etat: L.journaliser(c.etat, t("LAKOUR_LOUPS.Jour.RubanDefense", { nom })), prolonge: c.prolonge };
      }
      const noms = c.resultat.elus.map(id => game.actors.get(id)?.name ?? id).join(", ");
      return { etat: L.journaliser(c.etat, noms ? t("LAKOUR_LOUPS.Journal.VoteClos", { noms }) : t("LAKOUR_LOUPS.Journal.VoteNul")), resultat: c.resultat };
    });
    if (r.prolonge) {
      await annonceChat(echapper(t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: game.actors.get(r.prolonge)?.name ?? "" })));
      annoncer("lakourLoups.phase", ["vote", r.etat], ["vote", L.etatPublic(r.etat)]);
      return { prolonge: r.prolonge, decompte: {}, elu: null, elus: [], votes: {}, egalite: false };
    }
    annoncer("lakourLoups.voteClos", [r.resultat]);
    if (r.resultat.objet === "chapelle" && r.resultat.elu) {
      try { await api.agirDeJour({ pouvoir: "chapelle", cibles: [r.resultat.elu] }); }
      catch (e) { await noterPourMJ(e.message, { notifier: true }); }
    }
    return foundry.utils.deepClone(r.resultat);
  },

  async eliminer(acteurId, { cause = "narrateur", reveler } = {}) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    if (!acteur.system.vivant) return [];
    const montrer = reveler ?? reglage("revelerALaMort");
    const visible = causePublique(cause);
    await acteur.update({ "system.vivant": false, ...(montrer ? { "system.revele": true } : {}) });
    await modifierEtat(e => L.journaliser(L.ajouterMort(e, { acteurId, cause }), t("LAKOUR_LOUPS.Journal.Mort", { nom: acteur.name, cause: libelleCause(visible) })));
    try { await acteur.toggleStatusEffect("dead", { active: true, overlay: true }); } catch { /* sans jeton */ }
    const role = roleDe(acteur);
    const infos = { acteurId, revele: montrer, roleCle: montrer ? (role?.system.cle ?? "") : "" };
    annoncer("lakourLoups.elimination", [{ ...infos, cause }], [{ ...infos, cause: visible }]);
    await annonceChat(montrer && role
      ? t("LAKOUR_LOUPS.Messages.MortRevele", { nom: echapper(acteur.name), role: echapper(role.name), cause: echapper(libelleCause(visible)) })
      : t("LAKOUR_LOUPS.Messages.Mort", { nom: echapper(acteur.name), cause: echapper(libelleCause(visible)) }));
    if (role?.system.effet === "emporter" && cause !== "emporte") {
      await noterPourMJ(t("LAKOUR_LOUPS.Messages.Emporter", { nom: acteur.name }), { notifier: true });
    }
    const morts = [acteurId];
    const lie = acteur.system.amoureux ? game.actors.get(acteur.system.amoureux) : null;
    if (lie?.system.vivant) morts.push(...await api.eliminer(lie.id, { cause: "chagrin", reveler }));
    return morts;
  },

  async proteger(acteurId) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    await a.update({ "system.protections": a.system.protections + 1 });
    return a.system.protections;
  },

  // Un villageois béni par le Curé ne peut plus être réduit au silence : renvoie false.
  async reduireAuSilence(acteurId) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    if (lireEtat().jour.benis.includes(acteurId)) return false;
    await a.update({ "system.silence": true });
    if (a.system.joueur || estCompagnon(a)) await envoyerSecret(a.id, { texte: t("LAKOUR_LOUPS.Messages.Silence") });
    return true;
  },

  async changerCamp(acteurId, camp) {
    exigerMJ();
    if (!L.CAMPS.includes(camp)) throw new Error(t("LAKOUR_LOUPS.Erreurs.CampInconnu", { camp: String(camp) }));
    const a = acteurOuErreur(acteurId);
    await a.update({ "system.camp": camp });
    return camp;
  },

  async echangerRoles(a, b) {
    exigerMJ();
    const A = acteurOuErreur(a), B = acteurOuErreur(b);
    const ra = roleDe(A), rb = roleDe(B);
    if (!ra || !rb) throw new Error(t("LAKOUR_LOUPS.Erreurs.SansRole"));
    const da = ra.toObject(), db = rb.toObject();
    delete da._id; delete db._id;
    await A.deleteEmbeddedDocuments("Item", [ra.id]);
    await B.deleteEmbeddedDocuments("Item", [rb.id]);
    await A.createEmbeddedDocuments("Item", [db]);
    await B.createEmbeddedDocuments("Item", [da]);
    await A.update({ "system.camp": db.system.camp });
    await B.update({ "system.camp": da.system.camp });
    // Les fioles déjà vidées de l'Herboriste suivent son rôle.
    await modifierEtat(e => {
      const f = e.fioles ?? {};
      [f[a], f[b]] = [f[b], f[a]];
      for (const id of [a, b]) if (!f[id]) delete f[id];
      e.fioles = f;
      return e;
    });
    await envoyerRole(A);
    await envoyerRole(B);
    return true;
  },

  async verifierVictoire() {
    exigerMJ();
    const e = lireEtat();
    const g = L.verifierVictoire({ villageois: villageoisAPlat(), morts: e.morts, primes: e.primes });
    if (g && e.vainqueur !== g) {
      const etat = await modifierEtat(x => L.journaliser(L.declarerVainqueur(x, g), libelleVainqueur(g)));
      annoncer("lakourLoups.victoire", [g, etat], [g, L.etatPublic(etat)]);
      await annonceChat(`<strong>${echapper(libelleVainqueur(g))}</strong>`);
    }
    return g;
  },

  // ---------------------------------------------------------------- pouvoirs de jour
  // Les pouvoirs de jour d'un villageois : [{ pouvoir, nom, source, cibles, texte, possible, raison, candidats: [{ id, nom }] }].
  // Sans acteurId (MJ) : ceux du village, la Chapelle si elle est en jeu.
  pouvoirsDeJour(acteurId = "") {
    const etat = lireEtat();
    const villageois = villageoisAPlat();
    const cles = clesDesBatiments(etat);
    const acteur = acteurId ? game.actors.get(acteurId) : null;
    const liste = acteurId ? L.pouvoirsDe({ villageois, etat, acteurId, batiments: cles }) : [];
    if (!acteurId && cles.includes("chapelle")) {
      const v = L.verifierPouvoir({ villageois, etat, pouvoir: "chapelle", cibles: [], batiments: cles });
      const candidats = L.candidatsDuPouvoir({ villageois, etat, pouvoir: "chapelle" });
      const raison = v.ok || v.raison === "cibles" ? "" : v.raison;
      liste.push({ pouvoir: "chapelle", source: "batiment", cibles: 1, soiMeme: false, texte: false, candidats, possible: !raison, raison });
    }
    return liste.map(p => ({ ...p, nom: nomDuPouvoir(p.pouvoir, acteur), raisonTexte: p.raison ? libelleRefus(p.raison, L.POUVOIRS_JOUR[p.pouvoir]) : "",
      candidats: p.candidats.map(id => ({ id, nom: game.actors.get(id)?.name ?? id })) }));
  },

  // Utiliser un pouvoir de jour (pour le joueur concerné : la Table de jeu l'envoie au MJ ; pour le narrateur : le MJ IA).
  // Lève une erreur claire si c'est impossible. Applique l'effet, consomme l'usage, révèle le Juge, poste les annonces
  // publiques au chat. -> { pouvoir, annonces: [texte] }
  async agirDeJour({ acteurId = "", pouvoir, cibles = [], texte = "" } = {}) {
    exigerMJ();
    const avant = lireEtat();
    const cles = clesDesBatiments(avant);
    const villageois = villageoisAPlat();
    const essai = L.verifierPouvoir({ villageois, etat: avant, acteurId, pouvoir, cibles, texte, batiments: cles });
    if (!essai.ok) throw new Error(libelleRefus(essai.raison, essai.def));
    let annonces = [];
    const r = await modifierEtat(e => {
      const x = L.appliquerPouvoir({ villageois, etat: e, acteurId, pouvoir, cibles, texte, batiments: cles });
      if (!x.ok) throw new Error(libelleRefus(x.raison, L.POUVOIRS_JOUR[pouvoir]));
      annonces = x.annonces.map(texteMessage);
      let etat = x.etat;
      for (const a of annonces) etat = L.journaliser(etat, a);
      return { ...x, etat };
    });
    for (const c of r.changements) {
      const cible = game.actors.get(c.acteurId);
      if (c.type === "usage") {
        const objet = c.objet === "role" ? roleDe(cible) : metierDe(cible);
        const u = objet?.system.usages;
        if (u?.max > 0) await objet.update({ "system.usages.restant": Math.max(0, u.restant - 1) });
      } else if (c.type === "revele") await cible?.update({ "system.revele": true });
      else if (c.type === "silence") await cible?.update({ "system.silence": Boolean(c.valeur) });
    }
    for (const a of annonces) await annonceChat(echapper(a));
    for (const p of r.prives) await envoyerSecret(p.destinataire, { texte: texteMessage(p) });
    if (r.rouvrirVote) {
      annoncer("lakourLoups.phase", ["vote", r.etat], ["vote", L.etatPublic(r.etat)]);
      faireVoterLesCompagnons(r.etat);
    }
    // La Conteuse n'est pas nommée chez les autres.
    const publicInfos = { pouvoir, annonces, ...(L.POUVOIRS_JOUR[pouvoir].source === "role" && pouvoir !== "juge-de-paix" ? {} : { acteurId }) };
    annoncer("lakourLoups.jour", [{ acteurId, pouvoir, cibles, annonces }], [publicInfos]);
    return { pouvoir, annonces };
  },

  // ---------------------------------------------------------------- carnet secret
  // Remet un message secret au joueur de cet acteur (et à lui seul) ; le MJ en garde la trace (chronique secrète).
  envoyerSecret(acteurId, texte) {
    exigerMJ();
    return envoyerSecret(acteurId, typeof texte === "object" ? texte : { texte });
  },
  carnet(acteurId) {
    exigerMJ();
    return foundry.utils.deepClone(lireEtat().carnets[acteurId] ?? []);
  },

  ouvrirTable() {
    return ouvrirTable();
  },

  // ---------------------------------------------------------------- salons vocaux (scripts/salons.mjs, logique/salons.mjs)
  // Qui entend ce locuteur, et peut-il parler, dans la voix intégrée de Foundry (et pour la voix des IA, la transcription).
  // Chez le MJ actif : la matrice complète (camps compris) ; ailleurs, une réponse prudente d'après ce que ce navigateur sait.
  // Hook lakourLoups.audibilite ({ phase }) à chaque changement.
  // -> { peutParler: Boolean, auditeurs: [userId] }
  audibilite(userId) {
    return audibilite(userId);
  },
  // Même question pour un acteur (compagnon IA, sans utilisateur) : -> { peutParler, auditeurs: [userId], acteursAuditeurs: [acteurId] }
  audibiliteActeur(acteurId) {
    return audibiliteActeur(acteurId);
  },

  // Extensions utiles au narrateur et aux essais.
  journaliser(texte) {
    exigerMJ();
    return modifierEtat(e => L.journaliser(e, String(texte)));
  },
  envoyerRole(acteurId) {
    exigerMJ();
    return envoyerRole(acteurOuErreur(acteurId));
  }
};
