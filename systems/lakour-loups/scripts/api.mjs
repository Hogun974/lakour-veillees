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
//
// La composition n'est JAMAIS annoncée aux joueurs : ni rôles en jeu, ni nombre de loups, ni libellé de composition (la clé
// de composition est un secret du MJ, le hook public de nouvelle partie n'en dit rien). Le MJ la voit (Table de jeu).
// Peste noire (logique/peste.mjs) : le drapeau etat.peste est un secret du MJ ; l'étape « la peste » remplace la meute
// (reveiller("peste")), le cri « C'est la peste noire ! » passe par crierPeste (socket « peste » pour un joueur).
// Le Bailli (logique/bailli.mjs) est PUBLIC : son élection est un vote (objet "bailli"), sa voix double et son départage se
// règlent à la clôture, sa succession par une demande posthume. Le Registre du greffier (logique/registre.mjs) vit dans l'état
// public ; un joueur y fait inscrire une déclaration par le socket (« declaration »). Les Masques de veillée
// (logique/masques.mjs) sont un secret de la meute : dans les secrets du MJ et au carnet de chaque loup, nulle part ailleurs.
// Les Gens de passage (logique/passage.mjs) : leur rôle est PUBLIC, leur camp un secret (les secrets du MJ, comme tout camp) ; un
// départ (socket « depart », pour soi) ou un exil voté les fait quitter la veillée sans mourir. Le Banc des accusés (logique/banc.mjs) :
// un joueur accuse par le socket (« accusation »). Le Glas du deuil (logique/deuil.mjs) : le compte est public, les pouvoirs de
// la meute un secret (secrets du MJ, carnets des loups). La Nuit de la Saint-Martin (logique/saintmartin.mjs) : l'autel est un
// secret du MJ. Les Veillées de fête (logique/fetes.mjs, 0.10.0) : la fête en jeu, la neige et le défilé sont publics ; le masque,
// le présent et les promis vivent dans les secrets du MJ (etat.secretsDeFete) et au carnet des seuls concernés.
//
// Les FICHES (0.9.0, logique/fiches.mjs) : le rôle, le camp, l'amoureux et les protections de chaque villageois vivent dans les
// secrets du MJ actif (etat.fiches), jamais dans les documents que Foundry livre à tous. Chaque joueur reçoit SA fiche par le
// socket (« fiche », à lui seul) à chaque changement qui le regarde (rôle, usages restants, camp, amoureux) ; un mort qui voit tout
// reçoit les rôles des autres (« vus »). L'objet `role` n'entre au document qu'à la révélation publique (revelerPubliquement : mort
// révélée, Juge de paix, fin de partie). Un joueur n'est plus propriétaire de son villageois (OBSERVER : il voit sa fiche, il ne la
// modifie pas ; scripts/garde.mjs refuse en plus toute modification d'un joueur). Le coffre (coffre.mjs) ne scelle qu'aux
// moments publics (sceller() après une phase, une aube, un vote, une mort…) et au battement.
import { ID, CLE_MEUTE, CLE_PESTE, EFFETS, EFFETS_AUTOMATISES, EFFETS_NARRATEUR, causePublique } from "../logique/constantes.mjs";
import * as L from "../logique/index.mjs";
import { estMJActif, emettre, annoncer } from "./canal.mjs";
import { reglage } from "./reglages.mjs";
import { garderSecrets, secretsMJ } from "./secrets.mjs";
import { sceller, coffreDisponible, exigerSecretsAJour, ecritureBloquee, changementDePartie, suivreEcritures } from "./coffre.mjs";
import { noterMonVote } from "./prive.mjs";
import {
  t, texteBrut, tousLesVillageois, roleDe, roleRevele, campDe, amoureuxDe, metierDe, aPlat, villageoisAPlat, lireEtat, lirePublic, monVillageois,
  clesDesBatiments, libellePhase, libelleCamp, libelleCause, libelleVainqueur
} from "./donnees.mjs";
import { ouvrirChoix, fermerChoix } from "./apps/choix.mjs";
import { audibilite, audibiliteActeur, rafraichirSalons } from "./salons.mjs";
import { ouvrirTable } from "./apps/table.mjs";
import { consignerVeillee, listeDuRecit } from "./chroniques.mjs";
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
// fn reçoit l'état COMPLET ; le public part dans le réglage monde, les secrets restent chez le MJ. Le réglage monde n'est écrit que
// s'il change : un choix de nuit (secret) ne doit pas faire battre, chez tous, le réglage public. Chaque fiche qui change part à
// son seul joueur ; les morts qui voient tout reçoivent ce qui a changé pour eux.
// Garde (relecture 7) : tant que le MJ actif n'a pas les secrets à jour de la partie en cours (coffre.mjs, ecritureBloquee), rien ne
// s'écrit : il rangerait sinon des secrets vides sous le nom de la partie. sansSecrets : les écritures qui commencent une partie,
// la vident ou la migrent (distribuer, remettreAZero, migrer).
// Relecture 8 : seul le MJ actif écrit, vérifié DANS la file, avant et après fn : un MJ qui perd la main au milieu d'un geste
// (passation : ses secrets scellés puis oubliés, coffre.mjs) n'écrit plus rien, ni l'état public ni des secrets vides. Une écriture
// qui commence une autre partie oublie les parts attendues de l'ancienne (coffre.mjs, changementDePartie).
let file = Promise.resolve();
suivreEcritures(() => file);
function modifierEtat(fn, { sansSecrets = false } = {}) {
  const suite = file.then(async () => {
    exigerMJ();
    if (!sansSecrets) exigerSecretsAJour(t("LAKOUR_LOUPS.Erreurs.SecretsAbsents"));
    const avant = lireEtat();
    const partieAvant = avant.partie;
    const copieAvant = JSON.parse(JSON.stringify(avant.fiches ?? {}));
    const r = await fn(avant);
    exigerMJ();
    const etat = r?.etat ?? r;
    const { public: pub, secret } = L.separerEtat(etat);
    if (sansSecrets) changementDePartie(secret.partie ?? "");
    // Une autre partie : chaque fiche part à son joueur (son navigateur a vidé les siennes au changement de partie).
    const fichesAvant = secret.partie === partieAvant ? copieAvant : {};
    await garderSecrets(secret);
    let brut = null;
    try { brut = game.settings.get(ID, "partie"); } catch { brut = null; }
    if (!L.egaux(pub, brut)) await game.settings.set(ID, "partie", pub);
    suivreLesFiches(fichesAvant, secret.fiches ?? {}, secret.partie);
    return r;
  });
  file = suite.catch(() => {});
  return suite;
}

// ------------------------------------------------------------------ les fiches secrètes (logique/fiches.mjs)
// Une fiche changée : à son joueur (sa projection seulement : ni ses protections, ni rien des autres) ; les salons suivent un camp
// changé ; les morts qui voient tout, leur vue ; la Table et les fiches du MJ se redessinent (hook local).
function suivreLesFiches(avant, apres, partie) {
  if (!estMJActif()) return;
  let camps = false;
  for (const id of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    if (L.egaux(avant[id], apres[id])) continue;
    if ((avant[id]?.camp ?? "") !== (apres[id]?.camp ?? "")) camps = true;
    if (!L.egaux(L.ficheDuJoueur(avant[id]), L.ficheDuJoueur(apres[id]))) envoyerFiche(id, { partie, fiche: apres[id] });
  }
  if (camps) { try { rafraichirSalons(); } catch (e) { console.warn(`${ID} | salons`, e); } }
  diffuserVus();
  Hooks.callAll("lakourLoups.fiches");
}

// La fiche d'un villageois, à son seul joueur (un compagnon IA n'a pas de navigateur : le MJ IA la lit chez le MJ actif).
function envoyerFiche(acteurId, { partie = lireEtat().partie, fiche = lireEtat().fiches[acteurId] } = {}) {
  const userId = game.actors.get(acteurId)?.system.joueur;
  if (!estMJActif() || !userId) return false;
  emettre({ type: "fiche", partie, acteurId, fiche: L.ficheDuJoueur(fiche) }, [userId]);
  return true;
}

// Un mort qui voit tout (réglage « mortsVoientTout ») reçoit le rôle et le camp des autres, à lui seul : tant qu'il garde son
// Dernier souffle, rien ; un parti (départ, exil) n'est pas un mort. -> { acteurId: vue } ({} : rien à voir)
function vusPour(userId, etat, villageois) {
  const moi = villageois.find(a => a.system.joueur === userId);
  let tout = true;
  try { tout = Boolean(game.settings.get(ID, "mortsVoientTout")); } catch { tout = true; }
  if (!etat.partie || !moi || moi.system.vivant || !tout || L.estParti(etat, moi.id) || L.aSonSouffle(etat, { id: moi.id, vivant: false })) return {};
  return Object.fromEntries(Object.entries(etat.fiches ?? {}).filter(([id]) => id !== moi.id).map(([id, f]) => [id, L.vueDesMorts(f)]));
}
const vusEnvoyes = new Map();   // userId -> ce qui lui a été envoyé (JSON)
function diffuserVus({ forcer = false, seul = "" } = {}) {
  if (!estMJActif()) return;
  const etat = lireEtat();
  const villageois = tousLesVillageois();
  for (const u of game.users.filter(x => !x.isGM && (!seul || x.id === seul))) {
    const vus = vusPour(u.id, etat, villageois);
    const json = JSON.stringify([etat.partie, vus]);
    const deja = vusEnvoyes.get(u.id) ?? JSON.stringify([etat.partie, {}]);
    if (!forcer && deja === json) continue;
    vusEnvoyes.set(u.id, json);
    emettre({ type: "vus", partie: etat.partie, vus }, [u.id]);
  }
}

// La révélation PUBLIQUE d'un rôle : l'objet `role` entre au document, avec un camp public. marquer : system.revele (pas à la fin :
// la fin montre tout sans « révéler »). Le camp publié (relecture 7) :
// - de son vivant (Juge de paix, case « Révélé » du MJ) : le camp du RÔLE, jamais le camp actuel (une morsure, un échange restent
//   secrets) ; et un rôle déjà publié n'est pas remplacé (un échange du Colporteur avec un révélé ne se lit pas sur son document) ;
// - campPublie : ce que l'annonce dit déjà (la lanterne démasque un loup : « meute ») ;
// - à sa mort (mort : true, réglage « revelerALaMort ») et à la fin (fin : true) : le vrai rôle et le camp actuel ; à la fin,
//   l'amoureux aussi (le récit de fin le dit déjà).
async function revelerPubliquement(acteurId, { marquer = true, fin = false, mort = false, campPublie = "" } = {}) {
  const a = game.actors.get(acteurId);
  if (!a) return false;
  const f = lireEtat().fiches[acteurId];
  const objet = f ? L.objetDeRole(f) : null;
  const toutDire = fin || mort;
  if (objet) {
    const deja = a.items.filter(i => i.type === "role");
    if (!deja.length || (toutDire && !(deja.length === 1 && deja[0].system?.cle === objet.system.cle))) {
      if (deja.length) await a.deleteEmbeddedDocuments("Item", deja.map(i => i.id));
      await a.createEmbeddedDocuments("Item", [objet]);
    }
  }
  const publie = a.items.find(i => i.type === "role");
  const camp = toutDire ? f?.camp : campPublie || a.system.camp || publie?.system?.camp || objet?.system.camp;
  const maj = {};
  if (marquer && !a.system.revele) maj["system.revele"] = true;
  if (camp && a.system.camp !== camp) maj["system.camp"] = camp;
  if (fin && f && (a.system.amoureux ?? "") !== f.amoureux) maj["system.amoureux"] = f.amoureux;
  if (Object.keys(maj).length) await a.update(maj);
  return true;
}

// Les données d'une fiche neuve d'après un document de rôle (compendium ou monde) ou des données d'objet.
function ficheDepuis(donneesRole, { camp, source = "" } = {}) {
  return L.ficheDuRole(donneesRole, { camp, source });
}

// Une fiche modifiée dans l'état (fn reçoit la fiche normalisée et la rend) : rien si l'acteur n'a pas de fiche.
function majFiche(e, acteurId, fn) {
  const f = e.fiches?.[acteurId];
  if (!f) return e;
  e.fiches = { ...e.fiches, [acteurId]: fn(L.normaliserFiche(f)) };
  return e;
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
    envoyerFiche(a.id, { partie: etat.partie, fiche: etat.fiches[a.id] });
  }
  diffuserVus({ forcer: true, seul: userId });
  // Sa part de la clé du coffre : le coffre du MJ IA la lui donne lui-même (« coffre.bonjour » de son navigateur).
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
  const camp = campDe(acteur);
  const meute = role.system.camp === "meute" || camp === "meute"
    ? tousLesVillageois().filter(a => a.id !== acteur.id && campDe(a) === "meute").map(a => a.name) : [];
  const prime = etat.primes?.[acteur.id] ? game.actors.get(etat.primes[acteur.id])?.name : "";
  const contenu = await foundry.applications.handlebars.renderTemplate(`systems/${ID}/templates/carte-role.hbs`, {
    acteur: acteur.name, role: role.name, img: role.img, camp: libelleCamp(camp),
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
  // Les compagnons vivants, et à un vote d'exécution, les compagnons morts qui ont encore leur Dernier souffle (souffle: true).
  const admis = L.votantsAdmis({ etat, villageois: villageoisAPlat() });
  const compagnons = tousLesVillageois().filter(a => admis.includes(a.id) && estCompagnon(a));
  if (!compagnons.length) return;
  const fiche = id => game.actors.get(id);
  const candidats = v.candidats.map(id => ({ id, nom: fiche(id)?.name ?? id, img: fiche(id)?.img ?? "", maison: fiche(id)?.system.maison ?? "" }));
  const max = reglage("delaiChoix") * 1000;
  const ms = v.duree > 0 ? Math.min(v.duree, max) : max;
  // Un jugement du Banc : voter pour l'accusé le condamne, ne rien choisir l'acquitte (banc : l'accusé).
  const invite = v.banc ? t("LAKOUR_LOUPS.Banc.Invite", { nom: fiche(v.banc.accuse)?.name ?? "" })
    : t({ chapelle: "LAKOUR_LOUPS.Choix.InviteChapelle", bailli: "LAKOUR_LOUPS.Choix.InviteBailli", exil: "LAKOUR_LOUPS.Passage.InviteExil" }[v.objet] ?? "LAKOUR_LOUPS.Choix.InviteVote");
  const tache = Promise.all(compagnons.map(async a => {
    const [cible = ""] = await demanderAuCompagnon({ type: "vote", id: foundry.utils.randomID(), acteurId: a.id, acteurNom: a.name, invite,
      candidats, nombre: 1, delai: ms, objet: v.objet, numero: v.numero, ...(v.banc ? { banc: v.banc.accuse } : {}), ...(a.system.vivant ? {} : { souffle: true }) });
    const maintenant = lireEtat().vote;
    if (maintenant.ouvert && maintenant.numero === v.numero) await recevoirVote({ votant: a.id, cible, userId: game.user.id });
  }));
  votesCompagnons = votesCompagnons.then(() => tache).catch(e => console.warn(`${ID} | votes des compagnons`, e));
}

// ------------------------------------------------------------------ le Glas du deuil : la meute choisit en secret
// Une demande à TOUTE la meute vivante (pas seulement aux loups qui chassent : ni la vision ni la voix ne sortent de la maison),
// à la majorité (majoriteMeute) ; candidats : les ids proposés (des loups compris : la meute peut brouiller les pistes).
// objet : "deuil-vision" | "deuil-voix" (pour le cerveau d'un compagnon). -> [cible] ou []
async function demanderALaMeute({ invite, candidats, delai, objet }) {
  const loups = tousLesVillageois().filter(a => a.system.vivant && campDe(a) === "meute");
  if (!loups.length || !candidats.length) return [];
  const choix = await Promise.all(loups.map(async l => {
    const c = await api.demanderAction({ acteurId: l.id, invite, candidats, nombre: 1, delai, objet });
    return { votant: l.id, cible: c[0] ?? "", quand: Date.now() };
  }));
  const cible = L.majoriteMeute(choix);
  return cible ? [cible] : [];
}

// La voix sans visage d'un vote d'exécution (2e glas) : la meute la place en secret, pendant le vote ; sans réponse, un candidat
// au hasard (à la clôture). Rien ne la relie aux bulletins. cloreVote attend ce choix (au plus le délai des choix).
let voixDuDeuil = Promise.resolve();
function demanderVoixDuDeuil(etat) {
  const v = etat?.vote;
  if (!v?.ouvert || v.objet !== "execution" || !lireEtat().pouvoirsDeuil?.voix) return;
  const max = reglage("delaiChoix") * 1000;
  const delai = v.duree > 0 ? Math.min(v.duree, max) : max;
  const tache = demanderALaMeute({ invite: t("LAKOUR_LOUPS.Deuil.InviteVoix"), candidats: [...v.candidats], delai, objet: "deuil-voix" })
    .then(async ([cible = ""]) => {
      const maintenant = lireEtat().vote;
      if (cible && maintenant.ouvert && maintenant.numero === v.numero) {
        await modifierEtat(e => L.journaliserSecret(L.choisirVoixDuDeuil(e, { numero: v.numero, cible }),
          t("LAKOUR_LOUPS.Deuil.VoixChoisie", { nom: game.actors.get(cible)?.name ?? cible })));
      }
    });
  voixDuDeuil = voixDuDeuil.then(() => tache).catch(e => console.warn(`${ID} | voix du deuil`, e));
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
  // Un mort ne répond plus, sauf à une demande faite à un mort (le porteur de la peste noire).
  if (game.actors.get(p.demande.acteurId)?.system.vivant === false && !p.demande.posthume) return terminer(id, [], false, "");
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
  // Sans les secrets à jour, rien ne s'enregistre (le joueur est prévenu ; le coffre est cherché).
  if (ecritureBloquee()) {
    try { exigerSecretsAJour(t("LAKOUR_LOUPS.Erreurs.SecretsAbsents")); } catch (e) { avis(userId, e.message); }
    return false;
  }
  const acteur = game.actors.get(votant), user = game.users.get(userId);
  // Un mort ne vote plus, sauf de son Dernier souffle à un vote d'exécution (logique/souffle.mjs).
  const votants = L.votantsAdmis({ etat: lireEtat(), villageois: villageoisAPlat() });
  if (!acteur || !user || !votants.includes(votant)) return false;
  if (!user.isGM && acteur.system.joueur !== userId) return false;
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
  if (!moi.system.vivant && !L.peutSouffler(lirePublic(), { id: moi.id, vivant: false })) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.MortNeVotePas"));
  const message = { type: "vote", votant: moi.id, cible: cible ?? "", userId: game.user.id };
  if (estMJActif()) return recevoirVote(message);
  const pub = lirePublic();
  noterMonVote({ partie: pub.partie, numero: pub.vote.numero, cible: cible ?? "" });   // affichage immédiat, confirmé par le MJ
  const mj = game.users.activeGM;
  if (mj) emettre(message, [mj.id]);
}

// ------------------------------------------------------------------ le cri « C'est la peste noire ! »
// Un joueur crie depuis son bandeau ou sa Table : le message part au MJ actif seul, qui tranche (lui seul sait).
export async function recevoirCri({ acteurId, userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(acteurId), user = game.users.get(userId);
  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;
  try {
    await api.crierPeste(acteurId);
    return true;
  } catch (e) {
    avis(userId, e.message);
    return false;
  }
}

export function envoyerCri(acteurId) {
  const message = { type: "peste", acteurId, userId: game.user.id };
  if (estMJActif()) return recevoirCri(message);
  const mj = game.users.activeGM;
  if (!mj) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  emettre(message, [mj.id]);
}

// ------------------------------------------------------------------ déclarations au Registre du greffier
// Un joueur fait inscrire une déclaration pour son villageois (Table de jeu) : le message part au MJ actif seul, qui vérifie.
export async function recevoirDeclaration({ acteurId, texte, userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(acteurId), user = game.users.get(userId);
  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;
  try {
    await api.declarer(acteurId, texte);
    return true;
  } catch (e) {
    avis(userId, e.message);
    return false;
  }
}

export function envoyerDeclaration(texte, acteurId = monVillageois()?.id) {
  if (!acteurId) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeVillageois"));
  const message = { type: "declaration", acteurId, texte: String(texte ?? ""), userId: game.user.id };
  if (estMJActif()) return recevoirDeclaration(message);
  const mj = game.users.activeGM;
  if (!mj) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  emettre(message, [mj.id]);
}

// ------------------------------------------------------------------ le Banc des accusés et les départs (socket)
// Un joueur accuse (pour son villageois) ou quitte la veillée (pour lui-même) : le message part au MJ actif seul, qui vérifie.
export async function recevoirAccusation({ acteurId, contre, userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(acteurId), user = game.users.get(userId);
  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;
  try {
    await api.accuser(acteurId, String(contre ?? ""));
    return true;
  } catch (e) {
    avis(userId, e.message);
    return false;
  }
}

export function envoyerAccusation(contre, acteurId = monVillageois()?.id) {
  if (!acteurId) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeVillageois"));
  const message = { type: "accusation", acteurId, contre: String(contre ?? ""), userId: game.user.id };
  if (estMJActif()) return recevoirAccusation(message);
  const mj = game.users.activeGM;
  if (!mj) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  emettre(message, [mj.id]);
}

export async function recevoirDepart({ acteurId, userId }) {
  if (!estMJActif()) return false;
  const acteur = game.actors.get(acteurId), user = game.users.get(userId);
  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;
  try {
    await api.partir(acteurId, { comment: "depart" });
    return true;
  } catch (e) {
    avis(userId, e.message);
    return false;
  }
}

export function envoyerDepart(acteurId = monVillageois()?.id) {
  if (!acteurId) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeVillageois"));
  const message = { type: "depart", acteurId, userId: game.user.id };
  if (estMJActif()) return recevoirDepart(message);
  const mj = game.users.activeGM;
  if (!mj) return ui.notifications.warn(t("LAKOUR_LOUPS.Erreurs.PasDeMJ"));
  emettre(message, [mj.id]);
}

// Peut-il accuser maintenant ? D'après l'état PUBLIC : { ok, raison, raisonTexte } (contre : "" pour la seule permission).
export function peutAccuser(acteurId, contre = "") {
  const villageois = villageoisAPlat();
  const v = L.verifierAccusation({ villageois, etat: lirePublic(), par: acteurId, contre: contre || villageois.find(x => x.id !== acteurId && x.vivant)?.id || "" });
  const ok = v.ok || (!contre && ["cible", "accuse"].includes(v.raison));
  return { ok, raison: ok ? "" : v.raison, raisonTexte: ok ? "" : t(`LAKOUR_LOUPS.Banc.Refus.${v.raison}`) };
}

// Peut-il déclarer maintenant ? D'après l'état PUBLIC (le même partout) : { ok, raison, raisonTexte }.
export function peutDeclarer(acteurId) {
  const v = L.verifierDeclaration({ villageois: villageoisAPlat(), etat: lirePublic(), acteurId, texte: "…" });
  return { ok: v.ok, raison: v.raison, raisonTexte: v.ok ? "" : t(`LAKOUR_LOUPS.Registre.Refus.${v.raison}`, { n: L.DECLARATIONS_PAR_JOUR }) };
}

// Une ligne du Registre, dans la langue du monde (Table de jeu, contexte du narrateur et des compagnons IA).
export function ligneDuRegistre(x) {
  const nom = id => game.actors.get(id)?.name ?? id;
  const tour = x.tour ?? 0;
  switch (x.type) {
    case "vote": {
      const voix = Object.entries(x.votes ?? {}).map(([votant, cible]) => (Number(x.poids?.[votant]) > 1
        ? t("LAKOUR_LOUPS.Registre.VoixDouble", { qui: nom(votant), cible: nom(cible) })
        : (x.souffles ?? []).includes(votant) ? t("LAKOUR_LOUPS.Registre.VoixSouffle", { qui: nom(votant), cible: nom(cible) })
          : `${nom(votant)} → ${nom(cible)}`)).join(", ");
      const choix = x.departage?.choix ?? [];
      const issue = x.objet === "bailli"
        ? (x.elus?.length ? t("LAKOUR_LOUPS.Registre.IssueBailli", { noms: x.elus.map(nom).join(", ") }) : t(x.egalite ? "LAKOUR_LOUPS.Registre.Egalite" : "LAKOUR_LOUPS.Registre.Personne"))
        : x.elus?.length ? t("LAKOUR_LOUPS.Registre.Designe", { noms: x.elus.map(nom).join(", ") }) : t(x.egalite ? "LAKOUR_LOUPS.Registre.Egalite" : "LAKOUR_LOUPS.Registre.Personne");
      const tranche = x.departage ? ` ${t(choix.length ? "LAKOUR_LOUPS.Registre.Tranche" : "LAKOUR_LOUPS.Registre.TranchePersonne", { nom: nom(x.departage.par), noms: choix.map(nom).join(", ") })}` : "";
      // Le Banc : le verdict (« pour » sur le total) ; le Glas du deuil : une voix sans visage, jamais d'où elle vient.
      const banc = x.banc ? ` ${t("LAKOUR_LOUPS.Registre.Banc", { nom: nom(x.banc.accuse), pour: x.banc.pour, total: x.banc.total })}` : "";
      const deuil = x.deuil ? ` ${t("LAKOUR_LOUPS.Registre.VoixDeuil", { cible: nom(x.deuil) })}` : "";
      return t("LAKOUR_LOUPS.Registre.Vote", { tour, objet: t(`LAKOUR_LOUPS.Registre.Objets.${x.objet}`), voix: voix || t("LAKOUR_LOUPS.Registre.AucuneVoix"), issue })
        + tranche + banc + deuil + (x.annule ? ` ${t("LAKOUR_LOUPS.Registre.Annule")}` : "");
    }
    case "passage": return t(`LAKOUR_LOUPS.Registre.Passage.${x.comment === "arrivee" ? "arrivee" : x.comment === "exil" ? "exil" : "depart"}`,
      { tour, nom: nom(x.acteurId), role: x.cle ? nomDeRole(x.cle) : "" });
    case "accusation": return t("LAKOUR_LOUPS.Registre.Accusation", { tour, nom: nom(x.acteurId), contre: nom(x.contre) });
    case "deuil": return t("LAKOUR_LOUPS.Registre.Deuil", { tour, n: x.compte });
    case "fete": return t(`LAKOUR_LOUPS.Registre.Fete.${["neige", "defile"].includes(x.quoi) ? x.quoi : "ouverture"}`,
      { tour, fete: L.cleDeFete(x.cle) ? nomDeFete(x.cle) : "", role: x.nom || (x.role ? nomDeRole(x.role) : "") });
    case "mort": return t("LAKOUR_LOUPS.Registre.Mort", { tour, nom: nom(x.acteurId), cause: libelleCause(x.cause) });
    case "bailli": return t(`LAKOUR_LOUPS.Registre.Bailli.${x.comment}`, { tour, nom: nom(x.acteurId), de: x.de ? nom(x.de) : "" });
    case "declaration": return t("LAKOUR_LOUPS.Registre.Declaration", { tour, nom: nom(x.acteurId), texte: x.texte });
    default: return "";
  }
}

// Peut-il crier maintenant ? D'après l'état PUBLIC seulement (le même dans chaque navigateur) : { ok, raison, raisonTexte }.
export function peutCrier(acteurId) {
  const v = L.verifierCri({ villageois: villageoisAPlat(), etat: lirePublic(), acteurId });
  return { ...v, raisonTexte: v.ok ? "" : t(`LAKOUR_LOUPS.Peste.Refus.${v.raison}`) };
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

// Le bilan de la partie finie, avec le nom du joueur de chacun ("" : un joueur IA) : le récit au chat et les Chroniques.
function lignesDeFin(etat) {
  return L.bilanDePartie({ villageois: villageoisAPlat(), morts: etat.morts, causes: etat.causes, vainqueur: etat.vainqueur, partis: etat.partis })
    .map(({ id, ...l }) => ({ ...l, joueur: game.users.get(game.actors.get(id)?.system.joueur)?.name ?? "" }));
}

// Le récit de fin, posté au chat à la victoire : les cartes se retournent (rôle, camp, métier, vraie cause de chaque mort),
// les vainqueurs marqués d'une coupe. Joueur humain ou joueur IA, pour qu'on sache qui était qui autour de la table ; puis
// le lien vers les Chroniques, où la veillée vient d'entrer.
function recitDeFin(etat, lignes, chroniques = null) {
  const lien = chroniques ? `<p>${t("LAKOUR_LOUPS.Chroniques.Lien", { lien: `@UUID[${chroniques.uuid}]{${echapper(chroniques.name)}}` })}</p>` : "";
  // La peste noire se dévoile enfin.
  const peste = L.estPeste(etat) ? `<p><strong>${t("LAKOUR_LOUPS.Peste.Recit")}</strong></p>` : "";
  return `<h3>${t("LAKOUR_LOUPS.Recit.Titre")}</h3>${peste}<p>${t("LAKOUR_LOUPS.Recit.Resume", { n: lignes.length, tours: etat.tour })}</p>${recitDeLaFete(etat)}${listeDuRecit(lignes)}${lien}`;
}

// Une demande hors du réveil des rôles, par le même mécanisme (fenêtre ou carte chez son seul joueur, résolveur pour un
// compagnon IA) : sans filtre « soi-même » (le Bailli peut se désigner pour trancher) ; la réponse d'un mort n'est acceptée que
// pour une demande posthume (recevoirReponse). objet : "succession" | "departage" (pour le cerveau d'un
// compagnon) ; absent pour le porteur de la peste.
function demandeLibre({ acteurId, invite, candidats, nombre = 1, delai, posthume = false, objet = "" }) {
  const acteur = acteurOuErreur(acteurId);
  const compagnon = estCompagnon(acteur);
  const user = compagnon ? null : game.users.get(acteur.system.joueur);
  if (!compagnon && !user?.active) return Promise.resolve([]);
  const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;
  const demande = {
    type: "demande", id: foundry.utils.randomID(), destinataire: user?.id ?? "", acteurId, acteurNom: acteur.name, invite,
    ...(posthume ? { posthume: true } : {}), ...(objet ? { objet } : {}),
    candidats: candidats.map(id => {
      const a = game.actors.get(id);
      return { id, nom: a?.name ?? id, img: a?.img ?? "", maison: a?.system.maison ?? "" };
    }),
    nombre: Math.max(1, Number(nombre) || 1), delai: ms, finit: Date.now() + ms
  };
  return compagnon ? demanderAuCompagnon(demande) : ouvrirDemande(demande, user);
}

// Une demande de nuit faite à un MORT : le porteur de la peste noire désigne sa prochaine victime (joueur ou compagnon IA).
function demanderAuPorteur({ acteurId, invite, candidats, delai }) {
  return demandeLibre({ acteurId, invite, candidats, nombre: 1, delai, posthume: true });
}

// ------------------------------------------------------------------ le Bailli (logique/bailli.mjs)
// Ce qui attend le Bailli ne vit pas qu'en mémoire : la succession et le départage en attente sont dans l'état public ; une page
// du MJ rechargée les reprend (api.reprendre, appelée au « ready » du MJ actif).
let succession = Promise.resolve();
let mortsDeLaNuit = false;   // resoudreNuit : la succession attend que toutes les morts de la nuit soient tombées
let departageEnCours = null; // le départage demandé au Bailli (une seule fois à la fois) : la promesse du résultat final

// La demande encore ouverte chez un joueur pour cet objet ("departage", "succession") : son id, ou "".
const demandeOuverte = objet => [...enAttente.entries()].find(([, p]) => p.demande.objet === objet)?.[0] ?? "";
const vivantsIds = () => tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);

// Le Bailli défunt remet le sceau (une succession ouverte par sa mort, ajouterMort) : une demande posthume à son joueur (ou à
// son compagnon IA), puis l'annonce. Une à la fois, sans bloquer qui l'appelle (cloreVote l'attend) ; rien si la partie a changé
// entre-temps, ni si elle est déjà gagnée.
function suivreSuccession() {
  if (mortsDeLaNuit || !lireEtat().bailli.succession) return succession;
  succession = succession.then(menerSuccession).catch(e => console.warn(`${ID} | succession du Bailli`, e));
  return succession;
}

// Le défunt n'a que le reste du délai des choix, compté depuis sa mort : une succession plus vieille (page du MJ rechargée
// longtemps après) devient vacante sans rien demander.
async function menerSuccession() {
  const avant = lireEtat();
  const s = avant.bailli.succession;
  if (!s || avant.vainqueur) return;
  if (L.verifierVictoire({ villageois: villageoisAPlat(), morts: avant.morts, primes: avant.primes, peste: avant.peste })) return;
  const candidats = L.candidatsSuccession(avant, villageoisAPlat());
  const reste = L.resteDeSuccession(avant, reglage("delaiChoix") * 1000);
  const de = game.actors.get(s.de)?.name ?? s.de;
  const choix = candidats.length && reste >= 1000
    ? await demandeLibre({ acteurId: s.de, invite: t("LAKOUR_LOUPS.Bailli.InviteSuccession"), candidats, nombre: 1, delai: reste, posthume: true, objet: "succession" })
    : [];
  let annonce = "";
  const r = await modifierEtat(e => {
    if (e.partie !== avant.partie || e.bailli.succession?.de !== s.de) return { etat: e, comment: "" };
    const x = L.nommerSuccesseur(e, { successeur: choix[0] ?? "", villageois: villageoisAPlat() });
    annonce = x.comment === "succession" ? t("LAKOUR_LOUPS.Bailli.Succession", { de, nom: game.actors.get(x.acteurId)?.name ?? "" })
      : t("LAKOUR_LOUPS.Bailli.Vacance", { de });
    return { ...x, etat: L.journaliser(x.etat, annonce) };
  });
  if (!r.comment) return;
  await annonceChat(echapper(annonce));
  annoncer("lakourLoups.bailli", [{ acteurId: r.acteurId, comment: r.comment, de: s.de }]);
}

// Une égalité au vote d'exécution (resultat.departage en attente) : le Bailli choisit parmi les ex aequo ; sans réponse, personne
// pour la place. Une seule demande à la fois (cloreVote, ou la reprise après un rechargement). -> le résultat final
function departageEnAttente(resultat) {
  departageEnCours ??= departager(resultat).finally(() => { departageEnCours = null; });
  return departageEnCours;
}

async function departager(resultat) {
  const d = resultat.departage;
  const choix = await demandeLibre({ acteurId: d.par, invite: t("LAKOUR_LOUPS.Bailli.InviteDepartage", { n: d.places }), candidats: d.candidats,
    nombre: d.places, objet: "departage" });
  return appliquerDepartage(resultat, choix);
}

// Le choix du Bailli (ou du narrateur à sa place, api.trancher) appliqué au vote. Un vote touché entre-temps (rouvert, déjà
// tranché) entre quand même au Registre, sans condamné : personne ne sera exécuté pour lui. Une autre partie n'est pas touchée.
async function appliquerDepartage(resultat, choix) {
  const d = resultat.departage;
  const partie = lireEtat().partie;
  const bailli = game.actors.get(d.par)?.name ?? d.par;
  let texte = "";
  const r = await modifierEtat(e => {
    const v = e.vote;
    if (e.partie !== partie) return { etat: e, resultat };
    if (v.ouvert || v.numero !== resultat.numero || !v.resultat?.departage?.enAttente) {
      if (!e.registre.some(x => x.type === "vote" && x.numero === resultat.numero)) {
        L.inscrire(e, L.entreeDeVote({ ...resultat, departage: { par: d.par, choix: [] } }));
      }
      return { etat: e, resultat: v.resultat?.numero === resultat.numero ? v.resultat : resultat };
    }
    const x = L.trancherVote(e, choix, { vivants: vivantsIds() });
    const final = x.vote.resultat;
    texte = final.departage.choix.length
      ? t("LAKOUR_LOUPS.Bailli.Tranche", { nom: bailli, noms: final.departage.choix.map(id => game.actors.get(id)?.name ?? id).join(", ") })
      : t("LAKOUR_LOUPS.Bailli.TranchePersonne", { nom: bailli });
    return { etat: L.journaliser(x, texte), resultat: final };
  });
  if (texte) await annonceChat(echapper(texte));
  return r.resultat ?? resultat;
}

// Tant que le Bailli n'a pas tranché, ni nouveau vote ni changement de phase.
function exigerSansDepartage() {
  if (L.departageEnAttente(lireEtat())) throw new Error(t("LAKOUR_LOUPS.Bailli.Refus.departage"));
}

// ------------------------------------------------------------------ le Glas du deuil (logique/deuil.mjs)
// Un exécuté par le vote : innocent (hors meute), le glas sonne — public et vague (chat, Registre, hook lakourLoups.deuil :
// { compte } seulement) ; chaque loup vivant apprend en secret, dans son carnet, le pouvoir que la meute vient de gagner.
async function sonnerLeDeuil(acteur) {
  let r = null;
  await modifierEtat(e => {
    r = L.sonnerDeuil(e, { camp: L.normaliserFiche(e.fiches?.[acteur.id]).camp });
    if (!r.sonne) return r.etat;
    L.inscrire(r.etat, { type: "deuil", compte: r.compte });
    return L.journaliser(r.etat, t("LAKOUR_LOUPS.Deuil.Sonne", { n: r.compte }));
  });
  if (!r?.sonne) return;
  await annonceChat(echapper(t("LAKOUR_LOUPS.Deuil.Sonne", { n: r.compte })));
  annoncer("lakourLoups.deuil", [{ compte: r.compte }]);
  if (r.compte > 3) return;
  for (const loup of tousLesVillageois().filter(a => a.system.vivant && campDe(a) === "meute")) {
    await envoyerSecret(loup.id, { texte: t(["", "LAKOUR_LOUPS.Deuil.Pouvoir1", "LAKOUR_LOUPS.Deuil.Pouvoir2", "LAKOUR_LOUPS.Deuil.Pouvoir3"][r.compte]), titre: t("LAKOUR_LOUPS.Deuil.Titre") });
  }
}

// ------------------------------------------------------------------ l'historique des compositions
// La composition de la partie finie (ou abandonnée : nouvelle distribution, village remis à zéro) entre enfin au réglage monde
// « historique », pour varier la suivante. Pas avant : livré à tous les navigateurs, il trahirait les rôles en jeu.
async function consignerComposition() {
  const c = lireEtat().aConsigner;
  if (!c) return;
  try { await game.settings.set(ID, "historique", [...lireReglage("historique", []), c].slice(-10)); } catch { /* réglage absent */ }
  await modifierEtat(e => { e.aConsigner = null; return e; });
}

// ------------------------------------------------------------------ le Somnambule (logique/somnambule.mjs)
// Son vrai rôle remplace le rôle rêvé (à sa mort, et pour tous à la fin) ; le MJ le note. -> true s'il rêvait encore
async function devoilerSomnambule(acteurId) {
  const s = lireEtat().somnambules?.[acteurId];
  if (!s || s.devoile) return false;
  const acteur = game.actors.get(acteurId);
  const doc = s.vrai ? await fromUuid(s.vrai) : null;
  await modifierEtat(e => {
    // Sa fiche porte désormais son vrai rôle (dans les secrets ; le document ne l'apprendra qu'à la révélation publique).
    if (doc) majFiche(e, acteurId, f => ({ ...f, role: L.normaliserRole({ ...donneesObjet(doc), source: doc.uuid ?? "" }) }));
    e.somnambules = { ...e.somnambules, [acteurId]: { ...e.somnambules[acteurId], devoile: true } };
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Somnambule.Devoile", { nom: acteur?.name ?? acteurId }));
  });
  return true;
}

// ------------------------------------------------------------------ Almanach des brumes (logique/almanach.mjs)
// À l'aube (après les morts de la nuit), le présage du jour : tiré, appliqué (silences levés par le vent du nord), annoncé au
// chat et au journal public ; hook public lakourLoups.presage ({ cle, tour }). Rien sans l'Almanach, ni une partie finie.
// -> la clé du présage, ou ""
async function tirerLePresage(bilan) {
  const avant = lireEtat();
  if (!avant.presage.actif || avant.vainqueur || avant.phase === "fin") return "";
  const cle = L.tirerPresage(avant);
  let annonces = [];
  const r = await modifierEtat(e => {
    const x = L.appliquerPresage(e, { cle, villageois: villageoisAPlat(), bilan });
    annonces = x.annonces.map(m => (m.cle.endsWith(".Annonce") ? t("LAKOUR_LOUPS.Almanach.Annonce", {
      nom: t(`LAKOUR_LOUPS.Almanach.Presages.${cle}.Nom`), effet: t(`LAKOUR_LOUPS.Almanach.Presages.${cle}.Effet`) }) : texteMessage(m)));
    let etat = x.etat;
    for (const a of annonces) etat = L.journaliser(etat, a);
    return { ...x, etat };
  });
  for (const c of r.changements) if (c.type === "silence") await game.actors.get(c.acteurId)?.update({ "system.silence": Boolean(c.valeur) });
  for (const a of annonces) await annonceChat(echapper(a));
  annoncer("lakourLoups.presage", [{ cle, tour: r.etat.tour }]);
  return cle;
}

// ------------------------------------------------------------------ Masques de veillée (logique/masques.mjs)
// Le nom d'un rôle d'après sa clé, sans attendre : objets du monde, puis index des compendiums déjà lus (contenuDisponible).
function nomDeRole(cle) {
  const monde = (game.items?.contents ?? [...(game.items?.values?.() ?? [])]).find(i => i.type === "role" && i.system?.cle === cle);
  if (monde) return monde.name;
  for (const pack of game.packs?.contents ?? []) {
    const index = pack.index ? [...(typeof pack.index.values === "function" ? pack.index.values() : pack.index)] : [];
    const e = index.find(x => x.type === "role" && x.system?.cle === cle);
    if (e) return e.name;
  }
  return cle;
}

// Les masques de la meute, remis au carnet secret d'un loup (joueur ou compagnon IA) : le nom de chaque rôle et ce qu'il fait,
// pour mentir juste. contenu : contenuDisponible() déjà lu.
async function envoyerMasques(acteur, cles = lireEtat().masques, contenu = null) {
  if (!cles?.length || !acteur || (!acteur.system.joueur && !estCompagnon(acteur))) return null;
  const c = contenu ?? await contenuDisponible();
  const lignes = [];
  for (const cle of cles) {
    const uuid = c.roles.get(cle);
    const doc = uuid ? await fromUuid(uuid) : null;
    const description = texteBrut(doc?.system?.description);
    const court = description.length > 180 ? `${description.slice(0, 179)}…` : description;
    lignes.push(`• ${doc?.name ?? c.noms.get(cle) ?? cle}${court ? ` — ${court}` : ""}`);
  }
  // En texte, comme tout message secret (seule la carte de rôle est en HTML) : le carnet l'échappe à l'affichage.
  const texte = [t("LAKOUR_LOUPS.Masques.Intro"), ...lignes, t("LAKOUR_LOUPS.Masques.Conseil")].join("\n");
  return envoyerSecret(acteur.id, { texte, titre: t("LAKOUR_LOUPS.Masques.Titre") });
}

// ------------------------------------------------------------------ Veillées de fête (logique/fetes.mjs)
// La veillée que propose la fête du calendrier du moteur (lakour-mj-ia, api.fetes.active) dans CE navigateur ("" : aucune).
export function veilleeDuCalendrier() {
  try { return L.veilleeDuCalendrier(game.modules?.get?.("lakour-mj-ia")?.api?.fetes?.active?.()?.fete ?? ""); } catch { return ""; }
}

// La veillée de fête d'une partie qui commence. fete : une clé ("" : aucune), choisie par le MJ (Table, outil) ; non précisée :
// le réglage monde « veilleeDeFete » — une veillée nommée, « date » (celle que propose le calendrier ce jour-là), ou "" : aucune
// d'office, sinon celle de la partie précédente (« Rejouer » la garde, comme le format). La date ne l'impose jamais d'elle-même.
function feteVoulue(fete, precedente = "") {
  if (typeof fete === "string") return L.cleDeFete(fete);
  const r = lireReglage("veilleeDeFete", "");
  if (r === "date") return veilleeDuCalendrier();
  return L.cleDeFete(r) || L.cleDeFete(precedente);
}
const nomDeFete = cle => (cle ? t(`LAKOUR_LOUPS.Fetes.${cle}.Nom`) : "");

// La veillée de fête qui s'ouvre (après la distribution et les Masques de veillée) : les tirages secrets (masque, présent, promis)
// dans les secrets du MJ ; chacun des concernés prévenu à lui seul (carnet) ; la meute apprend les promis ; la fête annoncée à tous
// (chat, Registre), et le défilé du Carnaval. sortie : celle de distribuer.
async function ouvrirLaFete(cle, { sortie, graine }) {
  if (!cle) return;
  const hasard = L.creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `fete|${graine}`);
  const acteurs = sortie.map(s => game.actors.get(s.acteurId)).filter(Boolean);
  const secrets = L.tirerSecretsDeFete(cle, { joueurs: acteurs.map(a => ({ id: a.id, camp: campDe(a) })), hasard });
  let defile = "", defileNom = "";
  if (cle === L.CARNAVAL_DES_MASQUES) {
    const c = await contenuDisponible();
    const distribues = sortie.map(s => s.roleCle);
    defile = L.choisirDefile({ masques: lireEtat().masques, enJeu: distribues, hasard,
      roles: [...c.camps].map(([r, camp]) => ({ cle: r, camp, surDemande: Boolean(c.equilibre.roles?.[r]?.surDemande) })) });
    defileNom = defile ? c.noms.get(defile) ?? nomDeRole(defile) : "";
  }
  const nom = id => game.actors.get(id)?.name ?? id;
  // La Fête des promis sans promis (moins de deux joueurs du Village) : l'annonce ne promet rien.
  const sansPromis = cle === L.FETE_DES_PROMIS && secrets.promis.length < 2;
  const annonces = [t(`LAKOUR_LOUPS.Fetes.${cle}.${sansPromis ? "AnnonceSans" : "Annonce"}`), ...(defile ? [t("LAKOUR_LOUPS.Fetes.carnaval-des-masques.Defile", { role: defileNom })] : [])];
  const pourMJ = [secrets.masque ? t("LAKOUR_LOUPS.Fetes.Journal.Masque", { nom: nom(secrets.masque) }) : "",
    secrets.present ? t("LAKOUR_LOUPS.Fetes.Journal.Present", { nom: nom(secrets.present) }) : "",
    secrets.promis.length === 2 ? t("LAKOUR_LOUPS.Fetes.Journal.Promis", { a: nom(secrets.promis[0]), b: nom(secrets.promis[1]) }) : ""].filter(Boolean);
  await modifierEtat(e => {
    e.fete = { ...L.normaliserFete(e.fete), defile, defileNom };   // la clé : posée à la distribution
    e.secretsDeFete = secrets;
    L.inscrire(e, { type: "fete", quoi: "ouverture", cle });
    if (defile) L.inscrire(e, { type: "fete", quoi: "defile", cle, role: defile, nom: defileNom });
    let x = e;
    for (const texte of pourMJ) x = L.journaliserSecret(x, texte);
    for (const texte of annonces) x = L.journaliser(x, texte);
    return x;
  });
  for (const texte of annonces) await annonceChat(echapper(texte));
  annoncer("lakourLoups.fete", [{ cle, quoi: "ouverture", tour: lireEtat().tour }]);
  // Les secrets, au carnet des seuls concernés (un compagnon IA : son carnet, chez le MJ).
  const prevenir = (id, texte) => {
    const a = game.actors.get(id);
    return a && (a.system.joueur || estCompagnon(a)) ? envoyerSecret(id, { texte, titre: nomDeFete(cle) }) : null;
  };
  // Le porteur du masque apprend le camp que le masque montrera à la première vision du Village (son apparence retournée : un Loup
  // déguisé masqué paraît loup, un Louvetier masqué paraît du Village).
  if (secrets.masque) {
    const vu = L.apparenceMasquee(villageoisAPlat().find(v => v.id === secrets.masque), secrets.masque);
    await prevenir(secrets.masque, t("LAKOUR_LOUPS.Fetes.carnaval-des-masques.Carnet", { camp: libelleCamp(vu) }));
  }
  if (secrets.present) await prevenir(secrets.present, t("LAKOUR_LOUPS.Fetes.veillee-d-hiver.Carnet"));
  if (secrets.promis.length === 2) {
    const [a, b] = secrets.promis;
    await prevenir(a, t("LAKOUR_LOUPS.Fetes.fete-des-promis.Carnet", { nom: nom(b) }));
    await prevenir(b, t("LAKOUR_LOUPS.Fetes.fete-des-promis.Carnet", { nom: nom(a) }));
    for (const loup of tousLesVillageois().filter(x => x.system.vivant && campDe(x) === "meute")) {
      await prevenir(loup.id, t("LAKOUR_LOUPS.Fetes.fete-des-promis.Meute", { a: nom(a), b: nom(b) }));
    }
  }
}

// Un nouveau loup (mordu, échange de rôles, gens de passage de la meute) apprend ce que la meute sait de la veillée : les promis.
async function envoyerSecretsDeMeute(acteur) {
  const etat = lireEtat();
  const s = L.normaliserSecretsDeFete(etat.secretsDeFete);
  if (!acteur || !L.estFete(etat, L.FETE_DES_PROMIS) || s.promis.length !== 2 || (!acteur.system.joueur && !estCompagnon(acteur))) return null;
  const nom = id => game.actors.get(id)?.name ?? id;
  return envoyerSecret(acteur.id, { texte: t("LAKOUR_LOUPS.Fetes.fete-des-promis.Meute", { a: nom(s.promis[0]), b: nom(s.promis[1]) }),
    titre: nomDeFete(L.FETE_DES_PROMIS) });
}

// À l'aube de la Veillée d'hiver, la neige tombe-t-elle ? (avant que les bâtiments parlent : le Lavoir se tait sous la neige)
// -> le texte de l'annonce, ou ""
async function faireNeiger() {
  const avant = lireEtat();
  if (!L.tirerNeige(avant)) return "";
  const texte = t("LAKOUR_LOUPS.Fetes.veillee-d-hiver.Neige");
  await modifierEtat(e => {
    e.fete = { ...L.normaliserFete(e.fete), neige: e.tour };
    L.inscrire(e, { type: "fete", quoi: "neige", cle: L.VEILLEE_D_HIVER });
    return e;
  });
  annoncer("lakourLoups.fete", [{ cle: L.VEILLEE_D_HIVER, quoi: "neige", tour: avant.tour }]);
  return texte;
}

// Ce que les veillées de fête dévoilent au récit de fin (tout devient public) : le masque, le présent, les promis.
function recitDeLaFete(etat) {
  const cle = L.feteEnJeu(etat);
  if (!cle) return "";
  const s = L.normaliserSecretsDeFete(etat.secretsDeFete);
  const nom = id => echapper(game.actors.get(id)?.name ?? id);
  const lignes = [s.masque ? t("LAKOUR_LOUPS.Fetes.Recit.Masque", { nom: nom(s.masque) }) : "",
    s.present ? t(s.presentOuvert ? "LAKOUR_LOUPS.Fetes.Recit.PresentOuvert" : "LAKOUR_LOUPS.Fetes.Recit.Present", { nom: nom(s.present) }) : "",
    s.promis.length === 2 ? t("LAKOUR_LOUPS.Fetes.Recit.Promis", { a: nom(s.promis[0]), b: nom(s.promis[1]) }) : ""].filter(Boolean);
  return `<p><strong>${echapper(nomDeFete(cle))}</strong>${lignes.length ? ` — ${lignes.join(" ")}` : ""}</p>`;
}

// Ce que fait un pouvoir de jour : la description de l'objet rôle, métier ou bâtiment, en texte brut (infobulles).
function descriptionDuPouvoir(pouvoir, acteur) {
  const source = L.POUVOIRS_JOUR[pouvoir]?.source;
  const objet = source === "metier" ? metierDe(acteur) : source === "role" ? roleDe(acteur)
    : (lirePublic().batiments ?? []).map(u => { try { return fromUuidSync(u); } catch { return null; } }).find(d => d?.system?.cle === pouvoir);
  return texteBrut(objet?.system?.description);
}

// ------------------------------------------------------------------ nouvelle partie
// Les demandes de nuit encore ouvertes (une partie abandonnée) : closes, chacune chez son joueur.
function annulerDemandes() {
  for (const id of [...enAttente.keys()]) terminer(id, [], true);
  votesCompagnons = Promise.resolve();
  voixDuDeuil = Promise.resolve();
  succession = Promise.resolve();
  mortsDeLaNuit = false;
  departageEnCours = null;
}

// Le contenu disponible : rôles, métiers et bâtiments (compendiums d'objets, puis objets du monde) par clé, et, du module
// qui fournit les rôles, son équilibre (assets/equilibre.json) et ses compositions prêtes (assets/compositions.json).
async function contenuDisponible() {
  const roles = new Map(), batiments = new Map(), metiers = new Map(), noms = new Map(), campsDesDocs = new Map();
  let paquet = "";
  const ranger = (e, origine = "") => {
    const cle = e.system?.cle;
    if (!cle || !e.uuid) return;
    if (e.type === "role" && !roles.has(cle)) { roles.set(cle, e.uuid); noms.set(cle, e.name); campsDesDocs.set(cle, e.system?.camp ?? ""); paquet ||= origine; }
    else if (e.type === "metier" && !metiers.has(cle)) metiers.set(cle, e.uuid);
    else if (e.type === "batiment" && !batiments.has(cle)) batiments.set(cle, e.uuid);
  };
  for (const pack of game.packs?.contents ?? []) {
    if (pack.documentName !== "Item" || typeof pack.getIndex !== "function") continue;
    const index = await pack.getIndex({ fields: ["system.cle", "system.camp"] });
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
  // Le camp de chaque rôle : celui de l'équilibre du contenu, sinon celui du document.
  const camps = new Map([...roles.keys()].map(cle => [cle, equilibre?.roles?.[cle]?.camp || campsDesDocs.get(cle) || "village"]));
  return { roles, metiers: [...metiers.values()], batiments, noms, camps, equilibre: equilibre ?? { roles: {}, batiments: {} }, compositions: compositions ?? {} };
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
  // peste : une partie de peste noire (logique/peste.mjs) : aucun rôle de la meute (chacun devient un simple villageois) ; le
  // drapeau reste un secret du MJ.
  // Le Somnambule (logique/somnambule.mjs) reçoit l'objet du rôle qu'il croit tenir ; son vrai rôle reste dans les secrets du MJ.
  // glas : le Glas final du narrateur (jour N, 0 : jamais ; public). Le Dernier souffle et l'Almanach suivent leurs réglages.
  // format : "" ou "saint-martin" (la Nuit de la Saint-Martin, logique/saintmartin.mjs ; autel : les rôles sous l'autel, secret).
  // fete : la veillée de fête (logique/fetes.mjs) — une clé, "" (aucune) ; non précisée : feteVoulue (réglage « veilleeDeFete »,
  // sinon celle de la partie précédente). Jamais dans une Nuit de la Saint-Martin.
  async distribuer({ roles = [], metiers = [], joueurs = [], compagnons = [], maisons = [], graine, composition = "", batiments = [], peste = false, glas = 0,
    format = "", autel = [], fete } = {}) {
    exigerMJ();
    const cleFete = format === L.FORMAT_SAINT_MARTIN ? "" : feteVoulue(fete, lireEtat().fete?.cle);
    // Les secrets de la partie se scellent avec le coffre du MJ IA : sans lui, ils ne survivraient pas à ce navigateur.
    if (!coffreDisponible()) throw new Error(t("LAKOUR_LOUPS.Erreurs.SansCoffre"));
    const estPlaceCompagnon = id => { const a = game.actors.get(id); return a?.type === "villageois" && estCompagnon(a); };
    const placesIA = compagnons.map(n => {
      const id = typeof n === "object" ? n?.acteurId ?? "" : String(n ?? "");
      if (id && estPlaceCompagnon(id)) return { acteurId: id, nom: game.actors.get(id).name };
      return { acteurId: "", nom: String(typeof n === "object" ? n?.nom ?? "" : n ?? "").trim() };
    }).filter(c => c.acteurId || c.nom);
    const nomsCompagnons = placesIA.map(c => c.nom);
    if (!joueurs.length && !nomsCompagnons.length) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeJoueurs"));
    await consignerComposition();   // la partie précédente, abandonnée
    const cache = new Map();
    for (const uuid of [...roles, ...metiers]) {
      if (cache.has(uuid)) continue;
      const doc = await fromUuid(uuid);
      if (!doc || doc.documentName !== "Item") throw new Error(t("LAKOUR_LOUPS.Erreurs.Introuvable", { uuid }));
      cache.set(uuid, doc);
    }
    // Peste noire : ni Meunière ni Moulin, qui compteraient « 0 loup » (logique/peste.mjs, HORS_PESTE).
    if (peste) {
      metiers = L.metiersSansIndice(metiers.map(uuid => ({ uuid, cle: cache.get(uuid)?.system?.cle ?? "" })));
      const gardes = [];
      for (const uuid of batiments) if (!L.HORS_PESTE.batiments.includes((await fromUuid(uuid))?.system?.cle)) gardes.push(uuid);
      batiments = gardes;
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
    // Les rôles tirés (pour rêver un rôle absent) et les Somnambules de la partie : { acteurId: { croit, vrai } }.
    const rolesTires = tirage.map(att => cache.get(att.role)?.system?.cle).filter(Boolean);
    const somnambules = {};
    // Les fiches SECRÈTES de la partie (rôle, camp) : dans les secrets du MJ, jamais sur les documents.
    const fiches = {};
    let contenuDesReves = null;
    for (const att of tirage) {
      const indexCompagnon = att.joueur.startsWith(PLACE_COMPAGNON) ? Number(att.joueur.slice(PLACE_COMPAGNON.length)) : -1;
      const compagnon = indexCompagnon >= 0;
      const user = compagnon ? null : game.users.get(att.joueur);
      const sansLoup = peste && cache.get(att.role)?.system?.camp === "meute";
      let roleData = att.role && !sansLoup ? donneesObjet(cache.get(att.role)) : roleParDefaut();
      let source = att.role && !sansLoup ? cache.get(att.role)?.uuid ?? "" : "";
      // Le Somnambule porte le rôle qu'il rêve (de préférence absent de la partie).
      let reve = null;
      if (roleData.system?.cle === L.CLE_SOMNAMBULE) {
        contenuDesReves ??= await contenuDisponible();
        const croit = L.choisirReve({ disponibles: [...contenuDesReves.roles.keys()], enJeu: [...rolesTires, ...Object.values(somnambules).map(x => x.croit)],
          hasard: L.creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `reve|${graine}|${sortie.length}`) });
        const doc = croit ? await fromUuid(contenuDesReves.roles.get(croit)) : null;
        if (doc) { reve = { croit, vrai: att.role }; roleData = donneesObjet(doc); source = doc.uuid ?? ""; }
      }
      const metierData = att.metier ? donneesObjet(cache.get(att.metier)) : null;
      // Le document : le public seulement (ni rôle, ni camp, ni amoureux) ; le joueur l'observe, il ne le possède pas.
      const system = { joueur: compagnon ? "" : att.joueur, compagnon, vivant: true, revele: false, camp: "",
        maison: att.maison, amoureux: "", silence: false, protections: 0 };
      const ownership = compagnon ? { default: NIVEAUX().LIMITED } : { default: NIVEAUX().LIMITED, [att.joueur]: NIVEAUX().OBSERVER };
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
      if (metierData) await acteur.createEmbeddedDocuments("Item", [metierData]);
      fiches[acteur.id] = ficheDepuis(roleData, { source });
      if (reve) somnambules[acteur.id] = reve;
      sortie.push({ acteurId: acteur.id, userId: compagnon ? "" : att.joueur, compagnon, roleCle: roleData.system?.cle ?? "" });
    }
    for (const a of anciensCompagnons) {
      if (typeof api.compagnons?.retirer === "function") { try { await api.compagnons.retirer(a.id); } catch { /* repli */ } }
      if (game.actors.get(a.id)) await a.delete();
    }
    // Les villageois en jeu vus avec leurs fiches NEUVES (les secrets du MJ ne les ont pas encore).
    const enJeu = tousLesVillageois().filter(a => sortie.some(s => s.acteurId === a.id)).map(a => aPlat(a, fiches));
    const etat = await modifierEtat(() => {
      const e = L.etatInitial();
      e.partie = foundry.utils.randomID();
      e.fiches = fiches;
      e.composition = composition;
      e.batiments = [...batiments];
      e.batimentsCles = batimentsCles;
      e.primes = L.designerPrimes(enJeu);
      if (peste) e.peste = L.pesteInitiale();
      // La Nuit de la Saint-Martin : une seule nuit, un seul vote — ni Bailli, ni Almanach, ni Banc (d'autres votes, d'autres jours).
      const court = format === L.FORMAT_SAINT_MARTIN;
      e.format = court ? L.FORMAT_SAINT_MARTIN : "";
      e.autel = court ? [...autel] : [];
      e.bailli = L.bailliInitial(!court && lireReglage("bailli", true));
      e.souffle = L.souffleInitial(lireReglage("dernierSouffle", true));
      e.presage = L.presageInitial(!court && lireReglage("almanach", false));
      e.passage = L.passageInitial(lireReglage("gensDePassage", true));
      e.banc = L.bancInitial(!court && lireReglage("banc", false));
      e.deuil = L.deuilInitial(!court && lireReglage("glasDuDeuil", false));
      e.glas = L.normaliserGlas(glas);
      e.fete = L.feteInitiale(cleFete);
      e.somnambules = somnambules;
      return L.journaliser(e, t("LAKOUR_LOUPS.Journal.Distribution", { n: sortie.length }));
    }, { sansSecrets: true });   // une partie neuve : elle ne doit rien aux secrets d'avant
    for (const s of sortie) await envoyerRole(game.actors.get(s.acteurId));
    // Les Masques de veillée : la meute (jamais une peste noire) reçoit en secret des rôles du Village absents de la partie.
    const loups = sortie.map(s => game.actors.get(s.acteurId)).filter(a => a && campDe(a) === "meute");
    if (!peste && loups.length && lireReglage("masques", true)) {
      const contenu = await contenuDisponible();
      const masques = L.choisirMasques({ roles: [...contenu.camps].map(([cle, camp]) => ({ cle, camp, surDemande: Boolean(contenu.equilibre.roles?.[cle]?.surDemande) })),
        enJeu: sortie.map(s => s.roleCle),
        loups: loups.length, graine });
      if (masques.length) {
        await modifierEtat(e => {
          e.masques = masques;
          return L.journaliserSecret(e, t("LAKOUR_LOUPS.Masques.Journal", { roles: masques.map(c => contenu.noms.get(c) ?? c).join(", ") }));
        });
        for (const a of loups) await envoyerMasques(a, masques, contenu);
      }
    }
    // La veillée de fête : ses tirages secrets, son annonce, le défilé du Carnaval (après les Masques : il en montre un).
    await ouvrirLaFete(cleFete, { sortie, graine });
    annoncer("lakourLoups.phase", ["preparation", etat], ["preparation", L.etatPublic(etat)]);
    if (etat.glas) await annonceChat(echapper(t("LAKOUR_LOUPS.Calendrier.GlasAnnonce", { n: etat.glas })));
    await sceller();
    return sortie;
  },

  async changerPhase(phase) {
    exigerMJ();
    if (!L.PHASES.includes(phase)) throw new Error(t("LAKOUR_LOUPS.Erreurs.PhaseInconnue", { phase: String(phase) }));
    exigerSansDepartage();
    // Le Glas final : le jour N fini, la nuit ne tombe plus, la partie s'arrête (règle de calendrier.mjs).
    if (phase === "nuit") {
      const e = lireEtat();
      if (e.glas && e.tour >= e.glas && !e.vainqueur && await api.verifierVictoire({ finDuJour: true })) return foundry.utils.deepClone(lireEtat());
      // La Nuit de la Saint-Martin n'a qu'une nuit : la seconde ne tombe pas, la partie finit (même sans vote).
      if (L.estSaintMartin(e) && e.tour >= 1 && !e.vainqueur && await api.verifierVictoire({ finDuJour: true })) return foundry.utils.deepClone(lireEtat());
    }
    if (phase === "nuit") {
      for (const a of tousLesVillageois().filter(a => a.system.silence)) await a.update({ "system.silence": false });
    }
    const etat = await modifierEtat(e => {
      // Les protections de la nuit (secrètes) tombent au jour.
      if (phase === "jour") for (const id of Object.keys(e.fiches ?? {})) majFiche(e, id, f => ({ ...f, protections: 0 }));
      const x = L.passerPhase(e, phase);
      return L.journaliser(x, t("LAKOUR_LOUPS.Journal.Phase", { phase: libellePhase(phase), tour: x.tour }));
    });
    annoncer("lakourLoups.phase", [phase, etat], [phase, L.etatPublic(etat)]);
    await sceller();
    return foundry.utils.deepClone(etat);
  },

  // Une nouvelle partie avec les MÊMES participants : mêmes humains (memesJoueurs, sinon les joueurs connectés), même
  // nombre de compagnons IA (mêmes villageois, mêmes noms). Tout est remis à zéro (état public et secrets, vivants, non
  // révélés, sans silence, rôles et métiers retirés puis redistribués), le plateau est remis en place (jetons neutres
  // devant les maisons, lumière de jour, scène du village active). Composition : roles (clés ou noms) si donnés, sinon
  // la composition prête nommée, sinon une composition équilibrée générée (niveau, historique pour varier), et à
  // défaut d'équilibre, les rôles de la partie précédente rebattus.
  // -> { partie, joueurs: [{ userId, nom, acteurId }], compagnons: [{ nom, acteurId }],
  //      composition: { cle, libelle, niveau, roles: [cle], batiments: [cle], somme?, verdict?, peste } }
  // Hook lakourLoups.nouvellePartie : chez le MJ ce résumé ; chez tous { partie, joueurs: n, compagnons: n } (jamais la
  // composition : elle n'est pas annoncée aux joueurs).
  // joueurs : [userId] (au lieu des mêmes, ou des connectés) ; compagnons : [acteurId] des villageois compagnons à garder
  // (par défaut : tous ceux du village, mêmes noms).
  // peste : true (le MJ la choisit : rôles de la meute retirés), false (jamais) ; non précisé, une composition générée devient
  // une peste noire avec la chance CHANCE_PESTE (tirerPeste, reproductible avec la graine).
  // glas : le Glas final du narrateur (jour N ; 0 : jamais).
  // format : "saint-martin" (la Nuit de la Saint-Martin, logique/saintmartin.mjs) : composition à part (trois rôles sous l'autel,
  // secret du MJ), jamais de peste noire, aucun bâtiment ; le résumé du MJ porte autel. Non précisé : celui de la partie
  // précédente (« Rejouer » après une Saint-Martin en rejoue une) ; "" : une partie ordinaire.
  // Les partis de la partie précédente (départ, exil : etat.partis) ne sont pas repris : leurs villageois quittent le village.
  // fete : la veillée de fête (logique/fetes.mjs ; "" : aucune) ; non précisée : le réglage « veilleeDeFete », sinon celle de la
  // partie précédente (distribuer). Le résumé la porte (publique, comme son annonce).
  async nouvellePartie({ memesJoueurs = true, joueurs = null, compagnons: ia = null, composition = "", roles = [], niveau = "", graine, peste, glas = 0,
    format, fete } = {}) {
    exigerMJ();
    await consignerComposition();
    const avant = lireEtat();
    format = format === undefined ? (L.estSaintMartin(avant) ? L.FORMAT_SAINT_MARTIN : "") : format;
    const partis = new Set((avant.partis ?? []).map(p => p.acteurId));
    const anciens = tousLesVillageois().filter(a => !partis.has(a.id));
    for (const a of tousLesVillageois().filter(x => partis.has(x.id))) {
      if (estCompagnon(a) && typeof api.compagnons?.retirer === "function") { try { await api.compagnons.retirer(a.id); } catch { /* repli */ } }
      if (game.actors.get(a.id)) await a.delete();
    }
    const humains = Array.isArray(joueurs) ? [...new Set(joueurs.filter(id => game.users.get(id) && !game.users.get(id).isGM))]
      : memesJoueurs ? [...new Set(anciens.map(a => a.system.joueur).filter(id => id && game.users.get(id)))]
        : game.users.filter(u => u.active && !u.isGM).map(u => u.id);
    const compagnons = Array.isArray(ia) ? ia.filter(id => estCompagnon(game.actors.get(id))) : anciens.filter(estCompagnon).map(a => a.id);
    memesJoueurs = memesJoueurs && !Array.isArray(joueurs);
    const total = humains.length + compagnons.length;
    if (!total) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeJoueurs"));
    const contenu = await contenuDisponible();
    const precedents = anciens.map(a => L.normaliserFiche(avant.fiches?.[a.id]).role?.system.cle ?? roleRevele(a)?.system?.cle).filter(Boolean);
    const historique = [...historiqueDesParties(), ...(precedents.length ? [{ roles: precedents, batiments: avant.batimentsCles ?? [], quand: Date.now() }] : [])];
    const niveauPrecedent = [...historique].reverse().find(h => h.niveau)?.niveau ?? contenu.compositions[avant.composition]?.niveau ?? "classique";
    const niv = L.NIVEAUX.includes(niveau) ? niveau : niveauPrecedent;
    const equilibreOk = Object.keys(contenu.equilibre.roles ?? {}).length > 0 && total >= 4;
    const genere = inclure => L.composer(total, contenu.equilibre, { niveau: niv, inclure, historique, graine });
    let compo;
    const court = format === L.FORMAT_SAINT_MARTIN;
    // La peste noire : choisie (true), refusée (false), ou tirée au sort quand la composition se génère d'elle-même.
    const genereeSeule = !court && !roles.length && !(composition && contenu.compositions[composition]) && equilibreOk;
    const enPeste = !court && (peste === true || (peste === undefined && genereeSeule && L.tirerPeste({ graine, chance: api.chancePeste() })));
    if (court) {
      const sm = L.composerSaintMartin(total, { disponibles: [...contenu.roles.keys()], graine });
      compo = { cle: L.FORMAT_SAINT_MARTIN, libelle: t("LAKOUR_LOUPS.SaintMartin.Titre"), niveau: niv, roles: sm.joueurs, batiments: [], autel: sm.autel };
    } else if (roles.length) {
      const cles = roles.map(r => cleDeRole(r, contenu));
      if (cles.some(c => !c)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: roles.filter((_, i) => !cles[i]).join(", ") }));
      const bat = equilibreOk ? genere(cles.filter(c => c !== "villageois" && c !== "loup-de-brumecombe")).batiments : avant.batimentsCles ?? [];
      compo = { cle: "choisie", libelle: t("LAKOUR_LOUPS.NouvellePartie.Choisie"), niveau: niv, roles: enPeste ? L.sansMeute(cles, contenu.equilibre) : cles, batiments: bat };
    } else if (composition && contenu.compositions[composition]) {
      const c = contenu.compositions[composition];
      compo = { cle: composition, libelle: c.libelle ?? composition, niveau: c.niveau ?? niv, roles: enPeste ? L.sansMeute(c.roles, contenu.equilibre) : [...c.roles], batiments: [...(c.batiments ?? [])] };
    } else if (equilibreOk) {
      const g = L.composer(total, contenu.equilibre, { niveau: niv, historique, graine, peste: enPeste });
      compo = { cle: "generee", libelle: t("LAKOUR_LOUPS.NouvellePartie.Generee", { verdict: g.verdict }), niveau: niv, roles: g.roles, batiments: g.batiments, somme: g.somme, verdict: g.verdict };
    } else {
      compo = { cle: avant.composition || "reprise", libelle: t("LAKOUR_LOUPS.NouvellePartie.Reprise"), niveau: niv, roles: precedents, batiments: avant.batimentsCles ?? [] };
    }
    const cles = compo.roles.slice(0, total);
    while (cles.length < total) cles.push("villageois");
    compo.roles = cles;
    if (enPeste) compo.libelle = `${compo.libelle} — ${t("LAKOUR_LOUPS.NouvellePartie.Peste")}`;
    const uuidsRoles = cles.map(c => contenu.roles.get(c));
    if (uuidsRoles.some(u => !u)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: cles.filter((_, i) => !uuidsRoles[i]).join(", ") }));
    const metiers = contenu.metiers.length ? Array.from({ length: total }, (_, i) => contenu.metiers[i % contenu.metiers.length]) : [];
    compo.batiments = compo.batiments.filter(c => contenu.batiments.has(c));
    const batiments = compo.batiments.map(c => contenu.batiments.get(c));
    // Une partie abandonnée : ses demandes de nuit se ferment ; les villageois de joueurs qui ne rejouent pas quittent le village.
    annulerDemandes();
    if (!memesJoueurs) for (const a of anciens.filter(x => x.system.joueur && !humains.includes(x.system.joueur))) await a.delete();
    const sortie = await api.distribuer({ roles: uuidsRoles, metiers, joueurs: humains, compagnons, maisons: L.maisonsDuVillage(total),
      graine, composition: compo.cle, batiments, peste: enPeste, glas, ...(court ? { format: L.FORMAT_SAINT_MARTIN, autel: compo.autel } : {}),
      ...(typeof fete === "string" ? { fete } : {}) });
    // La composition n'entre au réglage monde « historique » (livré à tous) qu'à la fin de la partie : en attendant, le MJ la garde.
    await modifierEtat(e => { e.aConsigner = { roles: [...cles], batiments: [...compo.batiments], niveau: compo.niveau, composition: compo.cle, quand: Date.now() }; return e; });
    const partie = lireEtat().partie;
    const resume = {
      partie, fete: lireEtat().fete.cle,
      joueurs: sortie.filter(x => !x.compagnon).map(x => ({ userId: x.userId, nom: game.users.get(x.userId)?.name ?? "", acteurId: x.acteurId })),
      compagnons: sortie.filter(x => x.compagnon).map(x => ({ nom: game.actors.get(x.acteurId)?.name ?? "", acteurId: x.acteurId })),
      composition: { cle: compo.cle, libelle: compo.libelle, niveau: compo.niveau, roles: [...cles], batiments: [...compo.batiments],
        ...(compo.somme !== undefined ? { somme: compo.somme, verdict: compo.verdict } : {}), peste: enPeste, ...(court ? { autel: [...compo.autel] } : {}) }
    };
    // Chez les joueurs : rien de la composition (ni rôles, ni libellé, ni peste).
    annoncer("lakourLoups.nouvellePartie", [foundry.utils.deepClone(resume)],
      [{ partie, joueurs: resume.joueurs.length, compagnons: resume.compagnons.length }]);
    await annonceChat(echapper(t("LAKOUR_LOUPS.NouvellePartie.Annonce", { n: total })));
    if (court) await annonceChat(echapper(t("LAKOUR_LOUPS.SaintMartin.Annonce", { n: L.AUTEL })));
    return resume;
  },

  // Le village vierge (lancement du monde) : aucune partie en cours, plus de rôles ni de métiers sur les villageois des
  // joueurs (ils restent, liés à leurs joueurs, prêts pour la distribution), tous vivants, le chat vidé, les demandes de nuit
  // closes, les secrets du MJ effacés. Les compagnons IA quittent le village (leurs villageois et leurs jetons sont retirés,
  // par le MJ IA s'il est là : api.compagnons.retirer). Chacun retrouve le jeton de base : l'image neutre (style plat ou
  // relief, configurerPlateau), sur son prototype et sur ses jetons posés, sans crâne ni silence. Les Chroniques, le palmarès
  // et l'historique des compositions restent.
  async remettreAZero() {
    exigerMJ();
    await consignerComposition();
    annulerDemandes();
    const scenes = () => game.scenes?.contents ?? [...(game.scenes?.values?.() ?? [])];
    const jetonsDe = (scene, acteurId) => (scene.tokens?.contents ?? [...(scene.tokens?.values?.() ?? [])]).filter(t => t.actorId === acteurId);
    for (const a of tousLesVillageois().filter(estCompagnon)) {
      for (const scene of scenes()) {
        const ids = jetonsDe(scene, a.id).map(t => t.id);
        if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
      }
      if (typeof api.compagnons?.retirer === "function") { try { await api.compagnons.retirer(a.id); } catch { /* repli */ } }
      if (game.actors.get(a.id)) await a.delete();
    }
    const neutre = imageNeutre();
    for (const a of tousLesVillageois()) {
      const objets = a.items.filter(i => i.type === "role" || i.type === "metier").map(i => i.id);
      if (objets.length) await a.deleteEmbeddedDocuments("Item", objets);
      await a.update({ "system.vivant": true, "system.revele": false, "system.camp": "", "system.amoureux": "",
        "system.silence": false, "system.protections": 0, "prototypeToken.texture.src": neutre });
      for (const statut of ["dead", "silence"]) {
        try { if (a.statuses?.has(statut)) await a.toggleStatusEffect(statut, { active: false }); } catch { /* sans jeton */ }
      }
      for (const scene of scenes()) {
        const majs = jetonsDe(scene, a.id).filter(t => t.texture?.src !== neutre).map(t => ({ _id: t.id, "texture.src": neutre }));
        if (majs.length) await scene.updateEmbeddedDocuments("Token", majs, { lakourLoups: true });
      }
    }
    if (game.messages?.size) await ChatMessage.implementation.deleteDocuments([], { deleteAll: true });
    const etat = await modifierEtat(() => L.etatInitial(), { sansSecrets: true });
    annoncer("lakourLoups.phase", ["preparation", etat], ["preparation", L.etatPublic(etat)]);
    await sceller();   // plus de partie : le coffre est vidé
    return foundry.utils.deepClone(L.etatPublic(etat));
  },

  // Réveille un rôle de la nuit (ou la meute) comme le ferait le narrateur : candidats du système (effets du jour compris),
  // demande secrète au joueur (ou au compagnon IA), mot du Messager, puis note l'action. Pour la Table de jeu du MJ humain.
  // -> { roleCle, acteurIds, cibles, texte }
  // La peste (roleCle "peste", peste noire) : son porteur choisit en secret (au délai, ou s'il passe : le hasard) ; sans
  // porteur, cible (acteurId, le choix du narrateur) ou, à défaut, le hasard. -> { …, hasard: Boolean }
  async reveiller(roleCle, { delai, cible = "" } = {}) {
    exigerMJ();
    const etat = lireEtat();
    const tour = Math.max(1, etat.tour);
    const entree = L.ordreDeNuit(villageoisAPlat(), tour, { peste: etat.peste, deuil: L.visionDuDeuilDue(etat, villageoisAPlat()) }).find(e => e.roleCle === roleCle);
    if (!entree) throw new Error(t("LAKOUR_LOUPS.Erreurs.PersonneAReveiller", { role: String(roleCle) }));
    const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;
    if (roleCle === CLE_PESTE) return reveillerLaPeste(entree, { delai: ms, cible });
    if (roleCle === L.CLE_DEUIL) return reveillerLeDeuil(entree, { delai: ms });
    const acteurs = entree.acteurIds.map(id => game.actors.get(id));
    const roles = acteurs.map(a => roleDe(a));
    const meute = roleCle === CLE_MEUTE;
    const role = meute ? roles.find(r => r?.system.camp === "meute" && Number(r.system.nuit.ordre) === 40) : roles[0];
    const effet = meute ? "tuer" : role?.system.effet ?? "";
    const base = api.candidatsDeNuit({ acteurId: entree.acteurIds[0], roleCle });
    // Les proies de la meute cette nuit (pour la Louve mère et l'Herboriste).
    const rolesParCle = new Map(villageoisAPlat().filter(v => v.role).map(v => [v.role.cle, v.role]));
    const proies = etat.nuit.actions.filter(a => a.roleCle === CLE_MEUTE || a.roleCle === CLE_PESTE
      || (rolesParCle.get(a.roleCle)?.camp === "meute" && rolesParCle.get(a.roleCle)?.effet === "tuer")).flatMap(a => a.cibles);
    // Les candidats d'un porteur, selon SES contraintes (gardé à l'œil, hors d'atteinte…) et l'effet du rôle.
    const candidatsPour = sa => {
      if (effet === "voir-role-mort") return sa.length ? tousLesVillageois().filter(a => !a.system.vivant).map(a => a.id) : [];
      return effet === "mordre" ? sa.filter(id => proies.includes(id)) : sa;
    };
    const candidats = candidatsPour(base);
    let invite = role?.system.nuit.invite || (meute ? "" : t("LAKOUR_LOUPS.Choix.InviteParDefaut"));
    if (effet === "remede" && proies.length) invite = `${t("LAKOUR_LOUPS.Nuit.ProiesDeLaMeute", { noms: proies.map(id => game.actors.get(id)?.name ?? "").join(", ") })} ${invite}`;
    reveilsEnCours.add(roleCle);
    Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: true });
    let cibles = [], texte = "";
    try {
      const enGroupe = meute || (role?.system.camp === "meute" && acteurs.length > 1);
      if (!candidats.length && Number(entree.cibles) > 0) cibles = [];
      else if (enGroupe) cibles = await api.demanderActionMeute({ invite, candidats, delai: ms });
      else cibles = await api.demanderAction({ acteurId: entree.acteurIds[0], invite, candidats, nombre: entree.cibles, delai: ms });
      if (effet === "messager" && cibles.length === 2 && cibles[0] !== cibles[1]) {
        texte = await api.demanderTexte({ acteurId: cibles[0], delai: ms,
          invite: t("LAKOUR_LOUPS.Nuit.InviteMessager", { nom: game.actors.get(cibles[1])?.name ?? "" }) });
      }
      await api.noterAction({ acteurId: entree.acteurIds[0], roleCle, cibles, ...(texte ? { texte } : {}) });
      // Deux porteurs d'un même rôle hors meute (un Somnambule qui rêve un rôle déjà en jeu) : chacun choisit, à son tour.
      if (!enGroupe) {
        for (const autre of entree.acteurIds.slice(1)) {
          const siens = candidatsPour(api.candidatsDeNuit({ acteurId: autre, roleCle }));
          if (!siens.length && Number(entree.cibles) > 0) continue;
          const choix = await api.demanderAction({ acteurId: autre, invite, candidats: siens, nombre: entree.cibles, delai: ms });
          await api.noterAction({ acteurId: autre, roleCle, cibles: choix });
        }
      }
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
    const etat = lireEtat();
    return L.ordreDeNuit(villageoisAPlat(), Math.max(1, etat.tour), { peste: etat.peste, deuil: L.visionDuDeuilDue(etat, villageoisAPlat()) });
  },

  // Qui ce rôle (ou la meute) peut désigner cette nuit, compte tenu des effets du jour (Passeur, Grange, Garde du guet,
  // Chapelle, Taverne, Pont). Le narrateur le passe à demanderAction.
  candidatsDeNuit({ acteurId = "", roleCle = "" } = {}) {
    const etat = lireEtat();
    return L.candidatsDeNuit({ villageois: villageoisAPlat(), etat, acteurId, roleCle, tour: Math.max(1, etat.tour) });
  },

  // objet (facultatif) : ce que la demande décide, pour le cerveau d'un compagnon ("deuil-vision", "deuil-voix" : le Glas du deuil).
  demanderAction({ acteurId, invite = "", candidats, nombre = 1, delai, objet = "" } = {}) {
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
      nombre: Math.max(1, Number(nombre) || 1), delai: ms, finit: Date.now() + ms, ...(objet ? { objet } : {})
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
    const tousLesLoups = tousLesVillageois().filter(a => a.system.vivant && campDe(a) === "meute");
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
    // Un usage n'est consommé que si le pouvoir sert (une cible, ou un rôle sans cible) : passer ne coûte rien. L'usage vit
    // dans la fiche secrète (le document le trahirait, en pleine nuit) ; seul son joueur l'apprend, par sa fiche.
    const utilise = cibles.length > 0 || Number(role?.system.nuit.cibles) === 0;
    const etat = await modifierEtat(e => {
      const x = L.ajouterAction(e, { acteurId, roleCle: cle, cibles, effet, texte });
      if (utilise && cle !== CLE_MEUTE && role && role.system.cle === cle && role.system.usages.max > 0) majFiche(x, acteurId, f => L.changerUsage(f, -1));
      return x;
    });
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
    // Les Somnambules rêvent leurs visions : de faux rôles, pris parmi ceux du contenu.
    const somnambules = L.reveurs(avant.somnambules);
    const contenu = somnambules.length ? await contenuDisponible() : null;
    const rolesFactices = contenu ? L.nomsFactices([...contenu.roles.keys()].map(cle => ({ cle, nom: contenu.noms.get(cle), camp: contenu.camps.get(cle) }))) : [];
    const r = L.resoudreNuit({
      villageois: villageoisAPlat(), actions: avant.nuit.actions, tour, asperges: avant.asperges,
      precedentes: avant.nuitPrecedente.actions, primes: avant.primes, fioles: avant.fioles, chanceEpier: reglage("chanceEpier"),
      jour: L.effetsDeLaNuit(avant, tour, { batiments: cles }), somnambules, rolesFactices
    });
    // Une fiole déjà vide n'a rien versé : l'usage décompté par noterAction est rendu, AVANT les échanges de rôles de la nuit
    // (sinon il irait au rôle reçu par échange, ex. un Colporteur qui pourrait échanger une seconde fois).
    if (r.fiolesVides.length) await modifierEtat(e => {
      for (const id of r.fiolesVides) majFiche(e, id, f => L.changerUsage(f, +1));
      return e;
    });
    for (const c of r.changements) {
      if (c.type === "camp") await api.changerCamp(c.acteurId, c.camp);
      else if (c.type === "amour") {
        await modifierEtat(e => majFiche(majFiche(e, c.a, f => ({ ...f, amoureux: c.b })), c.b, f => ({ ...f, amoureux: c.a })));
      } else if (c.type === "silence") await api.reduireAuSilence(c.acteurId);
      else if (c.type === "echange") await api.echangerRoles(c.a, c.b);
    }
    // Le Bailli tombé cette nuit ne remet le sceau qu'une fois toutes les morts de la nuit tombées (fin de resoudreNuit).
    mortsDeLaNuit = true;
    try { for (const d of r.deces) await api.eliminer(d.acteurId, { cause: d.cause }); } finally { mortsDeLaNuit = false; }
    // La lanterne démasque un loup : l'annonce le dit déjà, le document montre « meute » (rien d'autre de son vivant).
    for (const rev of r.revelations) await revelerPubliquement(rev.acteurId, rev.type === "eclairer" ? { campPublie: "meute" } : {});
    await modifierEtat(e => {
      for (const id of Object.keys(e.fiches ?? {})) if (e.fiches[id]?.protections) majFiche(e, id, f => ({ ...f, protections: 0 }));
      return e;
    });

    // Les veillées de fête : la neige d'hiver tombe (ou non) avant que les bâtiments parlent ; l'âme du premier mort de la Nuit des
    // âmes murmure à un vivant (et la meute entend à quelle porte).
    const neige = await faireNeiger();
    const nomActeur = id => game.actors.get(id)?.name ?? id;
    const murmure = L.estFete(avant, L.NUIT_DES_AMES)
      ? L.messagesDuMurmure(L.murmureDesAmes({ villageois: villageoisAPlat(), deces: r.deces, masque: L.masqueDuCarnaval(avant) }), nomActeur) : [];
    // Les bâtiments parlent à l'aube, sur l'état d'après la nuit.
    const aube = L.annoncesDeLAube({ villageois: villageoisAPlat(), etat: lireEtat(), tour, bilan: r.bilan, batiments: cles,
      revelerALaMort: reglage("revelerALaMort") });
    const messages = [...r.messages.filter(m => m.destinataire !== "mj"), ...aube.prives, ...murmure.filter(m => m.destinataire !== "mj")]
      .map(m => ({ acteurId: m.destinataire, texte: texteMessage(m) }));
    const annonces = [...(neige ? [neige] : []), ...[...r.annonces, ...aube.annonces].map(texteMessage)];
    const narration = [
      ...r.messages.filter(m => m.destinataire === "mj").map(texteMessage),
      ...murmure.filter(m => m.destinataire === "mj").map(texteMessage),
      ...r.narrateur.map(n => t("LAKOUR_LOUPS.Nuit.ANarrer", {
        qui: game.actors.get(n.acteurId)?.name ?? n.acteurId, effet: n.effet || "—",
        cibles: n.cibles.map(id => game.actors.get(id)?.name ?? id).join(", ") || "—"
      })),
      ...r.enAttente.map(x => t("LAKOUR_LOUPS.Messages.Emporter", { nom: game.actors.get(x.acteurId)?.name ?? x.acteurId }))
    ];
    for (const texte of annonces) await annonceChat(echapper(texte));
    if (envoyer) for (const m of messages) await envoyerSecret(m.acteurId, { texte: m.texte });

    const noms = r.morts.map(id => game.actors.get(id)?.name ?? id).join(", ");
    // Peste noire : la dernière victime morte de la peste devient le porteur ; elle l'apprend dans son carnet secret.
    const porteur = r.deces.filter(d => d.cause === "peste").at(-1)?.acteurId ?? "";
    if (porteur) narration.push(t("LAKOUR_LOUPS.Peste.Porteur", { nom: game.actors.get(porteur)?.name ?? porteur }));
    await modifierEtat(e => {
      let x = L.suivrePeste(L.cloreNuit(e, { asperges: r.asperges, fioles: r.fioles, bilan: r.bilan, pontFranchi: r.pontFranchi && cles.includes("pont") }), r.deces);
      if (r.voteDouble) x.voteDoubleDemain = true;
      // Le Glas du deuil : la vision a servi (une cible désignée) ; le linceul de cette nuit est tombé.
      if (r.deuil) x.pouvoirsDeuil.visions = Math.max(0, x.pouvoirsDeuil.visions - 1);
      if (L.linceulDeLaNuit(x, tour)) x.pouvoirsDeuil.linceul = 0;
      // Le présent de la Veillée d'hiver ne s'ouvre qu'une fois.
      if (r.presentOuvert) x.secretsDeFete = { ...L.normaliserSecretsDeFete(x.secretsDeFete), presentOuvert: true };
      // Le masque du Carnaval a trompé une vision : il tombe.
      if (r.masqueTombe) x.secretsDeFete = { ...L.normaliserSecretsDeFete(x.secretsDeFete), masqueTombe: true };
      x.cimetiere = [...new Set([...x.cimetiere, ...aube.cimetiere])];
      for (const texte of narration) x = L.journaliserSecret(x, texte);
      for (const texte of annonces) x = L.journaliser(x, texte);
      return L.journaliser(x, noms ? t("LAKOUR_LOUPS.Journal.Aube", { tour: x.tour, noms }) : t("LAKOUR_LOUPS.Journal.AubeCalme", { tour: x.tour }));
    });
    if (porteur && (game.actors.get(porteur)?.system.joueur || estCompagnon(game.actors.get(porteur)))) {
      await envoyerSecret(porteur, { texte: t("LAKOUR_LOUPS.Peste.CarnetPorteur") });
    }
    annoncer("lakourLoups.aube", [{ tour, morts: r.morts, annonces }]);
    suivreSuccession();
    const presage = await tirerLePresage(r.bilan);
    await sceller();   // la nuit est finie : ses choix entrent au coffre
    return {
      presage, neige: Boolean(neige),
      morts: r.morts, revelations: r.revelations,
      messages, narration, annonces,
      deces: r.deces, sauves: r.sauves, changements: r.changements, enAttente: r.enAttente, narrateur: r.narrateur, voteDouble: r.voteDouble,
      fiolesVides: r.fiolesVides, bilan: r.bilan
    };
  },

  // objet : "execution" (par défaut), "chapelle" (le village choisit à main levée qui dormira à la Chapelle) ou "bailli"
  // (l'élection du Bailli, au débat, sans changer de phase : erreur claire si elle n'est pas due, ex. un Bailli vivant, déjà
  // une élection aujourd'hui, ou après le vote d'exécution). Refusé tant que le Bailli n'a pas tranché une égalité.
  // Hook public lakourLoups.voteOuvert ({ objet, numero }) ; lakourLoups.phase ("vote") sauf pour l'élection du Bailli.
  async ouvrirVote({ candidats, duree, double, majoriteAbsolue, objet = "execution" } = {}) {
    exigerMJ();
    exigerSansDepartage();
    if (objet === "bailli") {
      const p = L.electionAttendue({ etat: lireEtat(), villageois: villageoisAPlat() });
      if (!p.ok) throw new Error(t(`LAKOUR_LOUPS.Bailli.Refus.${p.raison}`));
    }
    let ids = candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
    // Le Banc des accusés (variante) : un vote d'exécution juge le prochain accusé, et lui seul ; sans accusé, pas de vote.
    let banc = "";
    if (objet === "execution" && lireEtat().banc.actif) {
      banc = L.prochainAccuse(lireEtat(), villageoisAPlat());
      if (!banc) throw new Error(t("LAKOUR_LOUPS.Banc.Refus.personne"));
      ids = [banc];
    }
    // L'exil : les gens de passage encore là.
    if (objet === "exil") {
      ids = L.candidatsExil(lireEtat(), villageoisAPlat());
      if (!ids.length) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.exil"));
    }
    // La Chapelle n'abrite jamais deux nuits de suite le même joueur : il n'est pas candidat.
    if (objet === "chapelle") {
      const permis = L.candidatsDuPouvoir({ villageois: villageoisAPlat(), etat: lireEtat(), pouvoir: "chapelle" });
      ids = ids.filter(id => permis.includes(id));
    }
    const ms = duree === undefined ? reglage("dureeVote") * 1000 : enMs(duree);
    const gibet = majoriteAbsolue ?? clesDesBatiments().includes("gibet");
    const etat = await modifierEtat(e => {
      const x = L.ouvrirVote(e, { candidats: ids, duree: ms, double, majoriteAbsolue: gibet, objet, banc });
      if (banc) L.noterJugement(x, banc);
      return L.journaliser(x, banc ? t("LAKOUR_LOUPS.Banc.Jugement", { nom: game.actors.get(banc)?.name ?? "" })
        : t({ chapelle: "LAKOUR_LOUPS.Journal.VoteChapelle", bailli: "LAKOUR_LOUPS.Journal.VoteBailli", exil: "LAKOUR_LOUPS.Passage.VoteExil" }[objet] ?? "LAKOUR_LOUPS.Journal.VoteOuvert"));
    });
    if (etat.vote.objet !== "bailli") annoncer("lakourLoups.phase", ["vote", etat], ["vote", L.etatPublic(etat)]);
    annoncer("lakourLoups.voteOuvert", [{ objet: etat.vote.objet, numero: etat.vote.numero }]);
    faireVoterLesCompagnons(etat);
    demanderVoixDuDeuil(etat);
    return foundry.utils.deepClone(L.etatPublic(etat).vote);
  },

  // -> { decompte, elu, elus, votes, egalite, objet, numero, tour } ; ou { prolonge: acteurId } si le plus désigné porte
  // le ruban de la Tisserande (le vote reste ouvert une minute de plus : clore de nouveau ensuite).
  // Un vote de la Chapelle met l'élu à l'abri pour la nuit suivante. Le Bailli (logique/bailli.mjs) : sa voix compte double à un
  // vote d'exécution ; une égalité qui laisse une place vide, il la tranche (demande à son joueur, ou à son compagnon IA : la
  // clôture attend son choix, au plus le délai des choix) -> + { departage: { par, candidats, places, choix } } ; un vote
  // "bailli" installe l'élu (égalité : le sort) -> + { bailli: acteurId | "", sort: Boolean }.
  async cloreVote() {
    exigerMJ();
    await votesCompagnons;   // les voix des compagnons encore en réflexion
    await voixDuDeuil;       // le choix secret de la meute pour la voix du deuil
    // Le sceau d'un Bailli défunt, s'il est en train d'être remis (au plus le reste du délai des choix) : le MJ le sait.
    const sceau = lireEtat().bailli.succession;
    if (sceau) ui.notifications?.info(t("LAKOUR_LOUPS.Bailli.SceauAttend", { nom: game.actors.get(sceau.de)?.name ?? "" }));
    await suivreSuccession();
    const votants = tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
    const nom = id => game.actors.get(id)?.name ?? id;
    const r = await modifierEtat(e => {
      // Déjà clos (minuteur écoulé, ou clos ailleurs entre-temps) : on ne recompte pas un vote fermé.
      if (!e?.vote?.ouvert) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeVote"));
      // Les morts qui soufflent à ce vote comptent parmi les votants (le Gibet ne compte qu'eux) ; leur souffle est rendu.
      const souffles = e.vote.objet === "execution" ? L.souffleurs({ etat: e, villageois: villageoisAPlat() }) : [];
      // La voix du deuil va au choix secret de la meute pour ce vote (sinon au hasard) : jamais aux bulletins.
      const c = L.cloreVote(e, { votants: [...votants, ...souffles.filter(id => id in e.vote.votes)], souffles });
      if (c.prolonge) {
        return { etat: L.journaliser(c.etat, t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: nom(c.prolonge) })), prolonge: c.prolonge };
      }
      if (c.resultat.objet === "bailli") {
        const x = L.elireBailli(c.etat, c.resultat, { villageois: villageoisAPlat() });
        const annonce = x.elu ? t(x.sort ? "LAKOUR_LOUPS.Bailli.EluSort" : "LAKOUR_LOUPS.Bailli.Elu", { nom: nom(x.elu) }) : t("LAKOUR_LOUPS.Bailli.Personne");
        return { etat: L.journaliser(x.etat, annonce), resultat: { ...x.etat.vote.resultat, bailli: x.elu, sort: x.sort }, annonce };
      }
      if (c.resultat.departage) {
        const annonce = t("LAKOUR_LOUPS.Bailli.Departage", { nom: nom(c.resultat.departage.par), noms: c.resultat.departage.candidats.map(nom).join(", ") });
        return { etat: L.journaliser(c.etat, annonce), resultat: c.resultat, annonce };
      }
      const noms = c.resultat.elus.map(nom).join(", ");
      // Le Banc : le verdict est dit (« pour » sur le total) ; la voix du deuil : « une voix sans visage » rejoint son candidat.
      const b = c.resultat.banc;
      const annonce = [b ? t(c.resultat.elus.length ? "LAKOUR_LOUPS.Banc.Condamne" : "LAKOUR_LOUPS.Banc.Acquitte", { nom: nom(b.accuse), pour: b.pour, total: b.total }) : "",
        c.resultat.deuil ? t("LAKOUR_LOUPS.Deuil.Voix", { nom: nom(c.resultat.deuil) }) : ""].filter(Boolean).join(" ");
      let x = L.journaliser(c.etat, noms ? t("LAKOUR_LOUPS.Journal.VoteClos", { noms }) : t("LAKOUR_LOUPS.Journal.VoteNul"));
      if (annonce) x = L.journaliser(x, annonce);
      return { etat: x, resultat: c.resultat, ...(annonce ? { annonce } : {}) };
    });
    if (r.prolonge) {
      await annonceChat(echapper(t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: game.actors.get(r.prolonge)?.name ?? "" })));
      annoncer("lakourLoups.phase", ["vote", r.etat], ["vote", L.etatPublic(r.etat)]);
      return { prolonge: r.prolonge, decompte: {}, elu: null, elus: [], votes: {}, egalite: false };
    }
    if (r.annonce) await annonceChat(echapper(r.annonce));
    let resultat = r.resultat;
    if (resultat.departage?.enAttente) resultat = await departageEnAttente(resultat);
    if (resultat.objet === "bailli") {
      annoncer("lakourLoups.bailli", [{ acteurId: resultat.bailli, comment: resultat.bailli ? (resultat.sort ? "sort" : "election") : "vacance" }]);
    }
    annoncer("lakourLoups.voteClos", [resultat]);
    // L'exil d'un gens de passage : l'élu quitte la veillée, sans mourir, son camp tu.
    if (resultat.objet === "exil" && resultat.elu && game.actors.get(resultat.elu)?.system.vivant && !L.estParti(lireEtat(), resultat.elu)) {
      await api.partir(resultat.elu, { comment: "exil" });
    }
    if (resultat.objet === "chapelle" && resultat.elu) {
      try { await api.agirDeJour({ pouvoir: "chapelle", cibles: [resultat.elu] }); }
      catch (e) { await noterPourMJ(e.message, { notifier: true }); }
    }
    diffuserVus();   // un souffle rendu : ce mort voit maintenant tout
    await sceller();
    return foundry.utils.deepClone(resultat);
  },

  async eliminer(acteurId, { cause = "narrateur", reveler } = {}) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    if (!acteur.system.vivant) return [];
    // Un Somnambule meurt : on le découvre Somnambule (son vrai rôle remplace le rôle rêvé, avant toute révélation).
    await devoilerSomnambule(acteurId);
    const montrer = reveler ?? reglage("revelerALaMort");
    const visible = causePublique(cause);
    // Le rôle ne rejoint le document qu'au moment où il devient public (mort révélée).
    if (montrer) await revelerPubliquement(acteurId, { marquer: false, mort: true });
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
    // Le Glas du deuil (variante) : un innocent exécuté par le vote fait sonner le glas.
    if (cause === "vote") await sonnerLeDeuil(acteur);
    const morts = [acteurId];
    const lieId = amoureuxDe(acteur);
    const lie = lieId ? game.actors.get(lieId) : null;
    if (lie?.system.vivant) morts.push(...await api.eliminer(lie.id, { cause: "chagrin", reveler }));
    // Le Bailli mort remet le sceau (sans attendre ici : la demande court pendant que la partie continue).
    suivreSuccession();
    diffuserVus();   // ce mort voit peut-être tout, désormais
    await sceller();
    return morts;
  },

  // Une protection de la nuit : dans la fiche SECRÈTE (le document la montrerait à tous, en pleine nuit). -> le nombre
  async proteger(acteurId) {
    exigerMJ();
    acteurOuErreur(acteurId);
    const etat = await modifierEtat(e => majFiche(e, acteurId, f => ({ ...f, protections: f.protections + 1 })));
    return L.normaliserFiche(etat.fiches?.[acteurId]).protections;
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
    const avant = campDe(a);
    // Le camp vit dans la fiche secrète.
    await modifierEtat(e => {
      if (!e.fiches?.[acteurId]) e.fiches = { ...e.fiches, [acteurId]: L.normaliserFiche({ camp }) };
      return majFiche(e, acteurId, f => ({ ...f, camp }));
    });
    // Rien au document, même pour un rôle révélé (relecture 7) : une morsure, un camp changé restent secrets jusqu'à sa mort.
    // Un villageois qui rejoint la meute (morsure) reçoit ses Masques de veillée.
    if (camp === "meute" && avant !== "meute") { await envoyerMasques(a); await envoyerSecretsDeMeute(a); }
    return camp;
  },

  async echangerRoles(a, b) {
    exigerMJ();
    const A = acteurOuErreur(a), B = acteurOuErreur(b);
    const ra = roleDe(A), rb = roleDe(B);
    if (!ra || !rb) throw new Error(t("LAKOUR_LOUPS.Erreurs.SansRole"));
    const da = ra.toObject(), db = rb.toObject();
    // Les rôles s'échangent dans les fiches secrètes (chacun prend le camp du rôle reçu) ; les fioles déjà vidées de
    // l'Herboriste suivent son rôle.
    await modifierEtat(e => {
      const [fa, fb] = L.echangerFiches(e.fiches?.[a], e.fiches?.[b]);
      e.fiches = { ...e.fiches, [a]: fa, [b]: fb };
      const f = e.fioles ?? {};
      [f[a], f[b]] = [f[b], f[a]];
      for (const id of [a, b]) if (!f[id]) delete f[id];
      e.fioles = f;
      // Le rêve du Somnambule suit l'objet du rôle rêvé : celui qui le reçoit devient le Somnambule.
      const s = e.somnambules ?? {};
      [s[a], s[b]] = [s[b], s[a]];
      for (const id of [a, b]) if (!s[id]) delete s[id];
      e.somnambules = s;
      return e;
    });
    await envoyerRole(A);
    await envoyerRole(B);
    // Celui qui devient loup par l'échange reçoit les Masques de veillée de sa nouvelle meute.
    if (db.system.camp === "meute" && da.system.camp !== "meute") { await envoyerMasques(A); await envoyerSecretsDeMeute(A); }
    if (da.system.camp === "meute" && db.system.camp !== "meute") { await envoyerMasques(B); await envoyerSecretsDeMeute(B); }
    return true;
  },

  // finDuJour : la nuit allait tomber (changerPhase) — le Glas final sonne alors dès le jour N, même sans vote ce jour-là.
  async verifierVictoire({ finDuJour = false } = {}) {
    exigerMJ();
    // Sans les secrets à jour, aucun rôle n'est connu ici : jamais de victoire déclarée sur du vide (le coffre est cherché).
    if (ecritureBloquee()) {
      try { exigerSecretsAJour(t("LAKOUR_LOUPS.Erreurs.SecretsAbsents")); } catch (err) { ui.notifications?.warn(err.message); }
      return "";
    }
    const e = lireEtat();
    const glas = L.glasSonne(e) || (finDuJour && e.glas > 0 && e.tour >= e.glas && !e.vainqueur);
    // La Nuit de la Saint-Martin : rien ne tombe avant son unique vote (et ses exécutions), ou avant que la seconde nuit tombe.
    const saintMartin = L.estSaintMartin(e) ? (L.saintMartinFinie(e, villageoisAPlat()) || (finDuJour && e.tour >= 1)) : null;
    const g = L.verifierVictoire({ villageois: villageoisAPlat(), glas, morts: e.morts, primes: e.primes, peste: e.peste, saintMartin });
    if (g && e.vainqueur !== g) {
      // Les cartes se retournent : chaque Somnambule est découvert avant le récit et les jetons de la fin.
      for (const id of L.reveurs(e.somnambules)) await devoilerSomnambule(id);
      await consignerComposition();
      const libelle = libelleVainqueur(g, e);
      const etat = await modifierEtat(x => L.journaliser(L.declarerVainqueur(x, g), libelle));
      // Les cartes se retournent pour de bon : chaque rôle, camp et lien d'amour entre aux documents (public, enfin).
      for (const id of Object.keys(etat.fiches ?? {})) if (game.actors.get(id)) await revelerPubliquement(id, { marquer: false, fin: true });
      // La partie est finie : l'état public dévoile maintenant la peste noire, s'il y en avait une.
      annoncer("lakourLoups.victoire", [g, etat], [g, L.etatPublic(etat)]);
      await annonceChat(`<strong>${echapper(libelle)}</strong>`);
      // La partie est finie : le récit retourne toutes les cartes (le plateau montre déjà chaque rôle sur son jeton), et
      // la veillée entre dans les Chroniques de Brumecombe (un échec n'empêche pas le récit).
      const lignes = lignesDeFin(etat);
      const chroniques = await consignerVeillee({ quand: Date.now(), tours: etat.tour, vainqueur: libelle, lignes, ...(L.estPeste(etat) ? { peste: true } : {}) })
        .catch(e => { console.warn(`${ID} | chroniques`, e); return null; });
      await annonceChat(recitDeFin(etat, lignes, chroniques));
      diffuserVus();
      await sceller();
    }
    return g;
  },

  // ---------------------------------------------------------------- pouvoirs de jour
  // Les pouvoirs de jour d'un villageois : [{ pouvoir, nom, description, source, cibles, texte, possible, raison, candidats: [{ id, nom }] }].
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
    return liste.map(p => ({ ...p, nom: nomDuPouvoir(p.pouvoir, acteur), description: descriptionDuPouvoir(p.pouvoir, acteur), raisonTexte: p.raison ? libelleRefus(p.raison, L.POUVOIRS_JOUR[p.pouvoir]) : "",
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
      if (c.type === "usage" && c.objet === "role") {
        // L'usage d'un rôle est secret (sa fiche) ; celui d'un métier est public (son objet).
        await modifierEtat(e => majFiche(e, c.acteurId, f => L.changerUsage(f, -1)));
      } else if (c.type === "usage") {
        const objet = metierDe(cible);
        const u = objet?.system.usages;
        if (u?.max > 0) await objet.update({ "system.usages.restant": Math.max(0, u.restant - 1) });
      } else if (c.type === "revele") await revelerPubliquement(c.acteurId);
      else if (c.type === "silence") await cible?.update({ "system.silence": Boolean(c.valeur) });
    }
    for (const a of annonces) await annonceChat(echapper(a));
    for (const p of r.prives) await envoyerSecret(p.destinataire, { texte: texteMessage(p) });
    if (r.rouvrirVote) {
      annoncer("lakourLoups.phase", ["vote", r.etat], ["vote", L.etatPublic(r.etat)]);
      annoncer("lakourLoups.voteOuvert", [{ objet: r.etat.vote.objet, numero: r.etat.vote.numero }]);
      faireVoterLesCompagnons(r.etat);
      demanderVoixDuDeuil(r.etat);
    }
    // La Conteuse n'est pas nommée chez les autres.
    const publicInfos = { pouvoir, annonces, ...(L.POUVOIRS_JOUR[pouvoir].source === "role" && pouvoir !== "juge-de-paix" ? {} : { acteurId }) };
    annoncer("lakourLoups.jour", [{ acteurId, pouvoir, cibles, annonces }], [publicInfos]);
    await sceller();
    return { pouvoir, annonces };
  },

  // ---------------------------------------------------------------- peste noire : le cri
  // « C'est la peste noire ! » (un villageois vivant, pendant le jour ; le joueur depuis son bandeau ou sa Table, le narrateur
  // pour celui qui le dit à voix haute). Juste : la partie s'arrête, le village gagne. Faux : le crieur est pendu pour avoir
  // semé la panique (cause publique « panique »). Erreur claire si le cri n'est pas permis. -> { juste, annonces, vainqueur }
  async crierPeste(acteurId) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    const villageois = villageoisAPlat();
    const essai = L.verifierCri({ villageois, etat: lireEtat(), acteurId });
    if (!essai.ok) throw new Error(t(`LAKOUR_LOUPS.Peste.Refus.${essai.raison}`));
    let annonces = [];
    const r = await modifierEtat(e => {
      const x = L.crierPeste({ villageois, etat: e, acteurId });
      if (!x.ok) throw new Error(t(`LAKOUR_LOUPS.Peste.Refus.${x.raison}`));
      annonces = x.annonces.map(texteMessage);
      let etat = L.journaliserSecret(x.etat, t("LAKOUR_LOUPS.Peste.Journal", { nom: acteur.name }));
      for (const a of annonces) etat = L.journaliser(etat, a);
      return { ...x, etat };
    });
    for (const a of annonces) await annonceChat(echapper(a));
    // Après le verdict seulement (public : le crieur meurt, ou la partie s'achève).
    annoncer("lakourLoups.cri", [{ acteurId, juste: r.juste }]);
    if (r.mort) await api.eliminer(r.mort, { cause: "panique" });
    const vainqueur = await api.verifierVictoire();
    return { juste: r.juste, annonces, vainqueur };
  },

  // La chance qu'une partie composée d'elle-même soit une peste noire (réglage caché « chancePeste », CHANCE_PESTE par défaut).
  chancePeste() {
    const c = Number(lireReglage("chancePeste", L.CHANCE_PESTE));
    return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : L.CHANCE_PESTE;
  },

  // Le cri est-il permis maintenant ? (tous les navigateurs, d'après l'état public) -> { ok, raison, raisonTexte }
  peutCrier(acteurId) {
    return peutCrier(acteurId);
  },

  // ---------------------------------------------------------------- le Bailli (public, tous les navigateurs)
  // -> { actif, acteurId ("" : vacant), nom, depuis, succession: null | { de, nom, tour }, election: { ok, raison } (due maintenant ?),
  //      possible: { ok, raison, raisonTexte } (le vote du Bailli peut-il s'ouvrir ?) }
  bailli() {
    const e = lirePublic();
    const villageois = villageoisAPlat();
    const id = L.bailliEnCharge(e, villageois.filter(v => v.vivant).map(v => v.id));
    const possible = L.electionPossible({ etat: e, villageois });
    return {
      actif: e.bailli.actif, acteurId: id, nom: id ? game.actors.get(id)?.name ?? "" : "", depuis: e.bailli.depuis,
      succession: e.bailli.succession ? { ...e.bailli.succession, nom: game.actors.get(e.bailli.succession.de)?.name ?? "" } : null,
      election: L.electionAttendue({ etat: e, villageois }),
      possible: { ...possible, raisonTexte: possible.ok ? "" : t(`LAKOUR_LOUPS.Bailli.Refus.${possible.raison}`) }
    };
  },

  // Le narrateur nomme le Bailli (un vivant) : une correction, ou un joueur qui l'annonce à voix haute. Clôt une succession en cours.
  async nommerBailli(acteurId) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    let annonce = "";
    await modifierEtat(e => {
      const x = L.nommerBailli(e, acteurId, { villageois: villageoisAPlat() });
      if (!x.ok) throw new Error(t("LAKOUR_LOUPS.Bailli.Refus.nomme", { nom: a.name }));
      annonce = t("LAKOUR_LOUPS.Bailli.Nomme", { nom: a.name });
      return L.journaliser(x.etat, annonce);
    });
    // La fenêtre posthume encore ouverte chez le défunt se ferme : le sceau est remis.
    const posthume = demandeOuverte("succession");
    if (posthume) terminer(posthume, [], true);
    await annonceChat(echapper(annonce));
    annoncer("lakourLoups.bailli", [{ acteurId, comment: "nomme" }]);
    return acteurId;
  },

  // Le narrateur tranche à la place du Bailli (absent, ou page du MJ rechargée pendant qu'il tranchait) : cibles parmi les ex
  // aequo ([] : personne). La fenêtre encore ouverte chez le Bailli se ferme. Erreur claire sans égalité en attente.
  // -> le résultat final du vote (comme cloreVote)
  async trancher(cibles = []) {
    exigerMJ();
    const r = lireEtat().vote.resultat;
    if (!L.departageEnAttente(lireEtat())) throw new Error(t("LAKOUR_LOUPS.Bailli.Refus.pasDeDepartage"));
    const ids = (Array.isArray(cibles) ? cibles : [cibles]).filter(Boolean);
    const id = demandeOuverte("departage");
    if (id && departageEnCours) {
      const enCours = departageEnCours;
      terminer(id, ids, true);
      return foundry.utils.deepClone(await enCours);
    }
    const final = await appliquerDepartage(r, ids);
    annoncer("lakourLoups.voteClos", [final]);
    return foundry.utils.deepClone(final);
  },

  // Au chargement de la page du MJ actif (lakour-loups.mjs, « ready ») : ce qui attendait le Bailli reprend — le départage d'une
  // égalité (la demande repart chez lui) et la succession d'un Bailli défunt (sa demande repart avec le reste du délai, ou la
  // charge devient vacante s'il est passé). -> { departage: Boolean, succession: Boolean }
  reprendre() {
    exigerMJ();
    const e = lireEtat();
    const departage = L.departageEnAttente(e);
    if (departage && !departageEnCours) {
      departageEnAttente(e.vote.resultat).then(final => annoncer("lakourLoups.voteClos", [final]))
        .catch(err => console.warn(`${ID} | départage repris`, err));
    }
    suivreSuccession();
    return { departage, succession: Boolean(e.bailli.succession) };
  },

  // ---------------------------------------------------------------- les Gens de passage, les départs, l'exil (logique/passage.mjs)
  // Accueille un joueur arrivé en cours de partie (à l'aube ou au débat, hors vote) : un rôle de passage PUBLIC (cle : l'un de
  // L.ROLES_DE_PASSAGE ; à défaut, tiré), un camp SECRET tiré pour ne pas déséquilibrer (jamais la meute dans une peste noire).
  // Qui : userId (un joueur humain sans villageois en jeu), acteurId (un villageois compagnon IA, ex. créé par le MJ IA :
  // api.compagnons.creer) ou nom (un compagnon IA créé ici). Il reçoit sa carte de rôle (et, loup, ses Masques ; la meute
  // apprend son nom en secret). Public : chat, Registre, hook lakourLoups.passage ({ acteurId, cle, comment: "arrivee" }).
  // -> { acteurId, nom, cle }
  async accueillir({ userId = "", acteurId = "", nom = "", cle = "" } = {}) {
    exigerMJ();
    const avant = lireEtat();
    const v = L.verifierArrivee(avant);
    if (!v.ok) throw new Error(t(`LAKOUR_LOUPS.Passage.Refus.${v.raison}`));
    const user = userId ? game.users.get(userId) : null;
    if (userId && (!user || user.isGM)) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.joueur"));
    const deja = user ? tousLesVillageois().find(a => a.system.joueur === userId) : acteurId ? acteurOuErreur(acteurId) : null;
    // Un villageois qui a déjà un rôle est de la partie (vivant, mort ou parti) : on ne revient pas en gens de passage.
    if (deja && (avant.fiches?.[deja.id] || roleRevele(deja))) {
      throw new Error(t("LAKOUR_LOUPS.Passage.Refus.present", { nom: deja.name }));
    }
    if (!user && !deja && !String(nom).trim()) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.joueur"));
    const contenu = await contenuDisponible();
    const disponibles = [...contenu.roles.keys()];
    const choisie = L.ROLES_DE_PASSAGE.includes(cle) && disponibles.includes(cle) ? cle : L.roleDePassage({ etat: avant, disponibles });
    if (!choisie) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.contenu"));
    const doc = await fromUuid(contenu.roles.get(choisie));
    if (!doc) throw new Error(t("LAKOUR_LOUPS.Erreurs.Introuvable", { uuid: contenu.roles.get(choisie) }));
    const camp = L.campDePassage({ villageois: villageoisAPlat().filter(x => x.vivant !== false), peste: L.estPeste(avant) });
    // Une maison libre du village agrandi.
    const prises = new Set(tousLesVillageois().map(a => a.system.maison).filter(Boolean));
    const maison = L.maisonsDuVillage(prises.size + 1).find(m => !prises.has(m)) ?? `Maison ${prises.size + 1}`;
    const compagnon = !user;
    // Le camp tiré est SECRET : dans la fiche du MJ, jamais sur le document (le rôle de passage, lui, est public par l'état).
    const system = { joueur: user ? userId : "", compagnon, vivant: true, revele: false, camp: "", maison, amoureux: "", silence: false, protections: 0 };
    const ownership = user ? { default: NIVEAUX().LIMITED, [userId]: NIVEAUX().OBSERVER } : { default: NIVEAUX().LIMITED };
    let acteur = deja;
    if (acteur) {
      const anciens = acteur.items.filter(i => i.type === "role" || i.type === "metier").map(i => i.id);
      if (anciens.length) await acteur.deleteEmbeddedDocuments("Item", anciens);
      await acteur.update({ system, ownership });
    } else {
      const n = user?.name ?? String(nom).trim();
      acteur = await Actor.implementation.create({ name: n, type: "villageois", system, ownership,
        prototypeToken: { name: n, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL } });
    }
    const roleNom = doc.name;
    const fiche = ficheDepuis(donneesObjet(doc), { camp, source: doc.uuid ?? "" });
    await modifierEtat(e => {
      e.fiches = { ...e.fiches, [acteur.id]: fiche };
      const x = L.accueillir(e, { acteurId: acteur.id, cle: choisie });
      return L.journaliserSecret(L.journaliser(x, t("LAKOUR_LOUPS.Passage.Annonce", { nom: acteur.name, role: roleNom })),
        t("LAKOUR_LOUPS.Passage.CampSecret", { nom: acteur.name, camp: libelleCamp(camp) }));
    });
    await envoyerRole(acteur);
    if (camp === "meute") {
      await envoyerMasques(acteur, lireEtat().masques, contenu);
      await envoyerSecretsDeMeute(acteur);
      for (const loup of tousLesVillageois().filter(a => a.id !== acteur.id && a.system.vivant && campDe(a) === "meute")) {
        await envoyerSecret(loup.id, { texte: t("LAKOUR_LOUPS.Passage.NouveauLoup", { nom: acteur.name }), titre: t("LAKOUR_LOUPS.Passage.Titre") });
      }
    }
    await annonceChat(t("LAKOUR_LOUPS.Passage.AnnonceChat", { nom: echapper(acteur.name), role: echapper(roleNom) }));
    annoncer("lakourLoups.passage", [{ acteurId: acteur.id, cle: choisie, comment: "arrivee" }]);
    planifierMiseEnScene();
    await sceller();
    return { acteurId: acteur.id, nom: acteur.name, cle: choisie };
  },

  // Un villageois quitte la veillée sans mourir (comment : "depart" — le joueur doit partir — ou "exil" — le vote d'exil) :
  // ni mort, ni rôle révélé, ni camp annoncé ; sa voix en cours retirée, ses demandes closes, son jeton retiré du plateau ; le
  // Bailli laisse la charge vacante. La victoire est vérifiée comme après une mort. Public : chat, Registre, hook
  // lakourLoups.depart ({ acteurId, comment }). Les bulletins qui le désignaient sont retirés ; seul candidat du vote ouvert
  // (l'accusé du Banc, le seul gens de passage d'un exil), le vote se clôt sans élu (resultat.depart ; hook lakourLoups.voteClos).
  // Déjà parti : sans effet (-> false). -> true
  async partir(acteurId, { comment = "depart" } = {}) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    const avant = lireEtat();
    if (!avant.partie || avant.phase === "fin" || avant.vainqueur) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.fin"));
    if (L.estParti(avant, acteurId)) return false;
    if (!acteur.system.vivant) throw new Error(t("LAKOUR_LOUPS.Passage.Refus.absent", { nom: acteur.name }));
    const sorte = comment === "exil" ? "exil" : "depart";
    const bailli = avant.bailli?.acteurId === acteurId;
    const apres = await modifierEtat(e => L.journaliser(L.partir(e, { acteurId, comment: sorte }), t(`LAKOUR_LOUPS.Passage.${sorte === "exil" ? "Exil" : "Depart"}`, { nom: acteur.name })));
    const clos = avant.vote.ouvert && !apres.vote.ouvert ? apres.vote.resultat : null;
    await acteur.update({ "system.vivant": false });
    for (const [id, p] of [...enAttente.entries()]) if (p.demande.acteurId === acteurId) terminer(id, [], true);
    for (const scene of game.scenes?.contents ?? [...(game.scenes?.values?.() ?? [])]) {
      const ids = (scene.tokens?.contents ?? [...(scene.tokens?.values?.() ?? [])]).filter(x => x.actorId === acteurId).map(x => x.id);
      if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
    }
    await annonceChat(echapper(t(`LAKOUR_LOUPS.Passage.${sorte === "exil" ? "Exil" : "Depart"}`, { nom: acteur.name })));
    annoncer("lakourLoups.depart", [{ acteurId, comment: sorte }]);
    if (bailli) annoncer("lakourLoups.bailli", [{ acteurId: "", comment: "vacance", de: acteurId }]);
    if (clos) {
      await annonceChat(echapper(t("LAKOUR_LOUPS.Passage.VoteSansObjet", { nom: acteur.name })));
      annoncer("lakourLoups.voteClos", [foundry.utils.deepClone(clos)]);
    }
    planifierMiseEnScene();
    await api.verifierVictoire();
    await sceller();
    return true;
  },

  // Les gens de passage de la partie (public) : [{ acteurId, nom, cle, role, tour, parti }].
  gensDePassage() {
    const e = lirePublic();
    return Object.entries(e.passage.gens).map(([acteurId, g]) => ({ acteurId, nom: game.actors.get(acteurId)?.name ?? acteurId, cle: g.cle,
      role: nomDeRole(g.cle), tour: g.tour, parti: L.estParti(e, acteurId) }));
  },
  // Peut-on accueillir un gens de passage maintenant ? -> { ok, raison, raisonTexte }
  peutAccueillir() {
    const v = L.verifierArrivee(lirePublic());
    return { ...v, raisonTexte: v.ok ? "" : t(`LAKOUR_LOUPS.Passage.Refus.${v.raison}`) };
  },

  // ---------------------------------------------------------------- le Banc des accusés (logique/banc.mjs, public)
  // par accuse contre (un vivant, une fois par jour ; chacun n'est accusé qu'une fois par jour) : le joueur par le socket, le
  // narrateur pour un compagnon ou un joueur qui le dit à voix haute. Erreur claire si c'est refusé. Public : chat, Registre,
  // hook lakourLoups.accusation ({ par, contre }). -> { par, contre }
  async accuser(par, contre) {
    exigerMJ();
    const a = acteurOuErreur(par);
    const c = game.actors.get(contre);
    const essai = L.verifierAccusation({ villageois: villageoisAPlat(), etat: lireEtat(), par, contre });
    if (!essai.ok) throw new Error(t(`LAKOUR_LOUPS.Banc.Refus.${essai.raison}`));
    await modifierEtat(e => {
      const x = L.accuser({ villageois: villageoisAPlat(), etat: e, par, contre });
      if (!x.ok) throw new Error(t(`LAKOUR_LOUPS.Banc.Refus.${x.raison}`));
      L.inscrire(x.etat, { type: "accusation", acteurId: par, contre });
      return L.journaliser(x.etat, t("LAKOUR_LOUPS.Banc.Accuse", { nom: a.name, contre: c?.name ?? contre }));
    });
    await annonceChat(t("LAKOUR_LOUPS.Banc.Annonce", { nom: echapper(a.name), contre: echapper(c?.name ?? contre) }));
    annoncer("lakourLoups.accusation", [{ par, contre }]);
    return { par, contre };
  },
  peutAccuser(acteurId, contre = "") {
    return peutAccuser(acteurId, contre);
  },
  // Le banc du jour (public) : { actif, accusations: [{ par, parNom, contre, contreNom, juge }], prochain, prochainNom }.
  banc() {
    const e = lirePublic();
    const nom = id => game.actors.get(id)?.name ?? id;
    const duJour = e.banc.tour === e.tour ? e.banc : { accusations: [], juges: [] };
    const prochain = L.prochainAccuse(e, villageoisAPlat());
    return { actif: e.banc.actif, accusations: duJour.accusations.map(x => ({ ...x, parNom: nom(x.par), contreNom: nom(x.contre), juge: duJour.juges.includes(x.contre) })),
      prochain, prochainNom: prochain ? nom(prochain) : "" };
  },

  // ---------------------------------------------------------------- le Glas du deuil (public : le compte seul)
  // -> { actif, compte } ; les pouvoirs de la meute restent au MJ (pouvoirsDuDeuil, MJ actif seulement).
  deuil() {
    return { ...lirePublic().deuil };
  },
  pouvoirsDuDeuil() {
    exigerMJ();
    return { ...lireEtat().pouvoirsDeuil };
  },

  // ---------------------------------------------------------------- la Nuit de la Saint-Martin
  // Les rôles sous l'autel de la Chapelle (SECRET : MJ actif seulement) : [{ cle, nom }].
  autel() {
    exigerMJ();
    return lireEtat().autel.map(cle => ({ cle, nom: nomDeRole(cle) }));
  },

  // ---------------------------------------------------------------- le Registre du greffier (public, tous les navigateurs)
  // -> [{ type: "vote" | "mort" | "bailli" | "declaration", tour, phase, quand, …, ligne }] (ligne : l'entrée lisible, langue du
  //    monde ; une déclaration garde son texte dans « texte ») ; max : les dernières seulement ; depuis : à partir de ce tour.
  registre({ max = 0, depuis = 0 } = {}) {
    return L.extraitDuRegistre(foundry.utils.deepClone(lirePublic().registre), { max, depuis }).map(x => ({ ...x, ligne: ligneDuRegistre(x) }));
  },
  // Les mêmes lignes, en texte seul (le contexte du narrateur et des compagnons IA). Par défaut les 30 dernières.
  registreTexte({ max = 30, depuis = 0 } = {}) {
    return api.registre({ max, depuis }).map(x => x.ligne).filter(Boolean);
  },
  // Inscrit une déclaration d'un villageois vivant (MJ actif : son joueur la lui envoie par le socket ; le MJ IA, pour un
  // compagnon ou un joueur qui la dicte). Erreur claire si elle n'est pas permise. Annoncée au chat. -> l'entrée inscrite
  async declarer(acteurId, texte) {
    exigerMJ();
    const acteur = acteurOuErreur(acteurId);
    const essai = L.verifierDeclaration({ villageois: villageoisAPlat(), etat: lireEtat(), acteurId, texte });
    if (!essai.ok) throw new Error(t(`LAKOUR_LOUPS.Registre.Refus.${essai.raison}`, { n: L.DECLARATIONS_PAR_JOUR }));
    const etat = await modifierEtat(e => {
      const x = L.declarer({ villageois: villageoisAPlat(), etat: e, acteurId, texte });
      if (!x.ok) throw new Error(t(`LAKOUR_LOUPS.Registre.Refus.${x.raison}`, { n: L.DECLARATIONS_PAR_JOUR }));
      return x.etat;
    });
    const entree = foundry.utils.deepClone(etat.registre.at(-1));
    await annonceChat(t("LAKOUR_LOUPS.Registre.Annonce", { nom: echapper(acteur.name), texte: echapper(entree.texte) }));
    annoncer("lakourLoups.registre", [entree]);
    return entree;
  },
  peutDeclarer(acteurId) {
    return peutDeclarer(acteurId);
  },

  // ---------------------------------------------------------------- Masques de veillée (SECRET : MJ actif seulement)
  // -> [{ cle, nom }] : les rôles que la meute peut prétendre être (le narrateur ne les cite jamais).
  masques() {
    exigerMJ();
    return lireEtat().masques.map(cle => ({ cle, nom: nomDeRole(cle) }));
  },

  // ---------------------------------------------------------------- le Somnambule (SECRET : MJ actif seulement)
  // -> [{ acteurId, nom, croit, croitNom, devoile }] : qui rêve quel rôle (le narrateur ne le dit jamais avant sa mort).
  somnambules() {
    exigerMJ();
    return Object.entries(lireEtat().somnambules).map(([acteurId, s]) => ({ acteurId, nom: game.actors.get(acteurId)?.name ?? acteurId,
      croit: s.croit, croitNom: nomDeRole(s.croit), devoile: Boolean(s.devoile) }));
  },

  // ---------------------------------------------------------------- le Dernier souffle et l'Almanach (publics, tous les navigateurs)
  // Ce villageois mort peut-il voter maintenant, de son Dernier souffle ? -> { ok, aSonSouffle }
  peutSouffler(acteurId) {
    const e = lirePublic(), a = game.actors.get(acteurId);
    const v = { id: acteurId, vivant: a?.system.vivant !== false };
    return { ok: L.peutSouffler(e, v), aSonSouffle: L.aSonSouffle(e, v) };
  },
  // Le présage du jour (Almanach des brumes) : { actif, cle, tour, nom, effet } ; cle "" sans présage aujourd'hui.
  presage() {
    const e = lirePublic();
    const cle = L.presageDuJour(e) || L.presageDeLaNuit(e, e.phase === "nuit" ? e.tour : e.tour + 1);
    return { actif: e.presage.actif, cle, tour: e.presage.tour,
      nom: cle ? t(`LAKOUR_LOUPS.Almanach.Presages.${cle}.Nom`) : "", effet: cle ? t(`LAKOUR_LOUPS.Almanach.Presages.${cle}.Effet`) : "" };
  },

  // ---------------------------------------------------------------- les Veillées de fête (logique/fetes.mjs)
  // La veillée de fête en jeu, d'après l'état PUBLIC (tous) : { cle ("" : aucune), nom, aide, fete (la fête du calendrier),
  // neige (ce matin), defile: { cle, nom } | null (le masque du défilé) }.
  fete() {
    const e = lirePublic();
    const f = L.normaliserFete(e.fete);
    return { cle: f.cle, nom: nomDeFete(f.cle), aide: f.cle ? t(`LAKOUR_LOUPS.Fetes.${f.cle}.Aide`) : "", fete: L.VEILLEES_DE_FETE[f.cle]?.fete ?? "",
      neige: L.neigeDuJour(e), defile: f.defile ? { cle: f.defile, nom: f.defileNom || nomDeRole(f.defile) } : null };
  },
  // Ses secrets (MJ actif ; SECRET) : { masque, masqueTombe, present, presentOuvert, promis } avec les noms.
  secretsDeFete() {
    exigerMJ();
    const s = L.normaliserSecretsDeFete(lireEtat().secretsDeFete);
    const qui = id => (id ? { id, nom: game.actors.get(id)?.name ?? id } : null);
    return { masque: qui(s.masque), masqueTombe: s.masqueTombe, present: qui(s.present), presentOuvert: s.presentOuvert, promis: s.promis.map(qui) };
  },
  // Les veillées que l'on peut choisir à la préparation, et celle que la Table propose (pré-sélectionnée) : le réglage
  // « veilleeDeFete » s'il en nomme une, sinon celle de la fête du calendrier (moteur) ce jour-là. Jamais imposée.
  // -> { proposee: cle | "", calendrier: cle | "", veillees: [{ cle, nom, aide, fete }] }
  veilleesDeFete() {
    const r = lireReglage("veilleeDeFete", "");
    const calendrier = veilleeDuCalendrier();
    return { proposee: L.cleDeFete(r) || calendrier, calendrier,
      veillees: L.CLES_DE_FETE.map(cle => ({ cle, nom: nomDeFete(cle), aide: t(`LAKOUR_LOUPS.Fetes.${cle}.Aide`), fete: L.VEILLEES_DE_FETE[cle].fete })) };
  },

  // ---------------------------------------------------------------- les Saints du calendrier (MJ actif)
  // La Bonne étoile : le narrateur protège en secret ce villageois la PREMIÈRE nuit ("" : personne), avant qu'elle soit résolue.
  async bonneEtoile(acteurId = "") {
    exigerMJ();
    const e = lireEtat();
    if (e.tour > 1 || e.nuitResolue >= 1) throw new Error(t("LAKOUR_LOUPS.Calendrier.Refus.etoile"));
    const a = acteurId ? acteurOuErreur(acteurId) : null;
    await modifierEtat(x => {
      x.bonneEtoile = acteurId;
      return L.journaliserSecret(x, a ? t("LAKOUR_LOUPS.Calendrier.Etoile", { nom: a.name }) : t("LAKOUR_LOUPS.Calendrier.EtoileAucune"));
    });
    return acteurId;
  },
  // Le Glas final : la partie s'arrête au soir du jour n (0 : jamais) ; annoncé à tout le village. -> n
  async glasFinal(n = 0) {
    exigerMJ();
    const glas = L.normaliserGlas(n);
    const texte = glas ? t("LAKOUR_LOUPS.Calendrier.GlasAnnonce", { n: glas }) : t("LAKOUR_LOUPS.Calendrier.GlasLeve");
    await modifierEtat(x => { x.glas = glas; return L.journaliser(x, texte); });
    await annonceChat(echapper(texte));
    return glas;
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

  // ---------------------------------------------------------------- fiches secrètes (0.9.0, logique/fiches.mjs)
  // Le rôle d'un villageois (acteur ou id) tel que CE navigateur le connaît : chez le MJ actif, celui de ses secrets (forme d'un
  // objet : name, img, system) ; ailleurs, le sien ou un rôle révélé ; null sinon. Le MJ IA lit les rôles par ici.
  roleDe(acteur) {
    return roleDe(typeof acteur === "string" ? game.actors.get(acteur) : acteur);
  },
  // Son camp, de même ("" : inconnu de ce navigateur).
  campDe(acteur) {
    return campDe(typeof acteur === "string" ? game.actors.get(acteur) : acteur);
  },
  // Les écritures de la partie sont-elles bloquées ici (MJ actif sans les secrets à jour, parts attendues : coffre.mjs) ? Le MJ IA
  // (pilote, narrateur, compagnons) se met alors en pause : ses appels échoueraient, et coûteraient.
  ecritureBloquee() {
    return estMJActif() && ecritureBloquee();
  },
  // Toute sa fiche (MJ actif seulement) : { camp, amoureux, protections, role } ou null.
  fiche(acteurId) {
    exigerMJ();
    const f = lireEtat().fiches?.[acteurId];
    return f ? L.normaliserFiche(f) : null;
  },
  // Le MJ règle une fiche à la main (fiche du villageois) : camp, amoureux, protections.
  async reglerFiche(acteurId, { camp, amoureux, protections } = {}) {
    exigerMJ();
    acteurOuErreur(acteurId);
    if (camp !== undefined && camp !== campDe(game.actors.get(acteurId))) await api.changerCamp(acteurId, camp);
    await modifierEtat(e => {
      if (!e.fiches?.[acteurId]) e.fiches = { ...e.fiches, [acteurId]: L.normaliserFiche({}) };
      return majFiche(e, acteurId, f => ({ ...f, ...(amoureux !== undefined ? { amoureux: String(amoureux ?? "") } : {}),
        ...(protections !== undefined ? { protections: Math.max(0, Number(protections) || 0) } : {}) }));
    });
    return api.fiche(acteurId);
  },
  // Le MJ donne un rôle (uuid d'un objet de rôle, ou données d'objet ; null : retiré) : dans la fiche, avec le camp du rôle ; la
  // carte de rôle part au joueur. -> la fiche
  async donnerRole(acteurId, role) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    const doc = typeof role === "string" ? await fromUuid(role) : null;
    if (typeof role === "string" && (!doc || doc.type !== "role")) throw new Error(t("LAKOUR_LOUPS.Erreurs.Introuvable", { uuid: role }));
    const donnees = doc ? donneesObjet(doc) : role ?? null;
    await modifierEtat(e => {
      const avant = L.normaliserFiche(e.fiches?.[acteurId]);
      const neuve = donnees ? ficheDepuis(donnees, { source: doc?.uuid ?? "" }) : L.normaliserFiche({});
      e.fiches = { ...e.fiches, [acteurId]: { ...neuve, amoureux: avant.amoureux, protections: avant.protections, ...(donnees ? {} : { role: null }) } };
      return e;
    });
    if (donnees && (a.system.joueur || estCompagnon(a))) await envoyerRole(a);
    if (a.system.revele) await revelerPubliquement(acteurId);
    return api.fiche(acteurId);
  },
  // Révèle à tous le rôle de ce villageois (case « Révélé » de la fiche du MJ, narrateur) : l'objet de rôle entre au document.
  async reveler(acteurId) {
    exigerMJ();
    acteurOuErreur(acteurId);
    await revelerPubliquement(acteurId);
    await sceller();
    return true;
  },

  // Les parties commencées avant 0.9.0 (MJ actif, au « ready ») : rôles, camps, amoureux et protections passent des documents aux
  // secrets (fiches), les objets de rôle non révélés quittent les documents, chaque joueur n'est plus qu'observateur de son
  // villageois. Rien si tout est déjà rangé. Sans les secrets de cette partie (autre navigateur), les fiches seules sont reprises
  // (secretsIncomplets : la Table le signale). -> { fiches, documents }
  // Sans perte (relecture 7) : toutes les fiches sont d'abord construites, rangées et scellées ; les documents ne sont touchés
  // qu'ensuite. Interrompue en route, la migration se rejoue : une fiche déjà rangée l'emporte sur ce qui reste au document.
  async migrer() {
    exigerMJ();
    const pub = lirePublic();
    const enJeu = Boolean(pub.partie) && pub.phase !== "fin";
    const tous = tousLesVillageois();
    const ancienne = enJeu && tous.some(a => !a.system.revele && (roleRevele(a) || a.system.camp));
    // 1. Les fiches, d'après les documents (rien n'est encore écrit).
    const fiches = {};
    if (ancienne) {
      for (const a of tous) {
        const r = roleRevele(a);
        if (!r) continue;
        fiches[a.id] = L.normaliserFiche({ camp: a.system.camp || r.system?.camp, amoureux: a.system.amoureux, protections: a.system.protections,
          role: { name: r.name, img: r.img, system: foundry.utils.deepClone(r.system), source: "" } });
      }
    }
    // 2. Rangées (secrets du MJ, une fiche déjà là l'emporte) et scellées au coffre.
    if (Object.keys(fiches).length) {
      const avec = (secretsMJ()?.partie ?? "") === pub.partie;
      await modifierEtat(e => {
        e.fiches = { ...fiches, ...(e.fiches ?? {}) };
        if (!avec) e.secretsIncomplets = true;
        return e;
      }, { sansSecrets: true });
      await sceller();
    }
    // 3. Seulement ensuite, les documents : plus de rôle caché, de camp, d'amoureux ni de protections ; le joueur observateur.
    let documents = 0;
    for (const a of tous) {
      const maj = {};
      const joueur = a.system.joueur;
      if (joueur && a.ownership?.[joueur] === NIVEAUX().OWNER) maj[`ownership.${joueur}`] = NIVEAUX().OBSERVER;
      if (ancienne) {
        const r = roleRevele(a);
        if (r && !a.system.revele) await a.deleteEmbeddedDocuments("Item", [r.id]);
        if (!a.system.revele && a.system.camp) maj["system.camp"] = "";
        if (a.system.amoureux) maj["system.amoureux"] = "";
        if (a.system.protections) maj["system.protections"] = 0;
      }
      if (Object.keys(maj).length) { await a.update(maj); documents++; }
    }
    return { fiches: Object.keys(fiches).length, documents };
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

// La vision du Glas du deuil (reveiller("deuil")) : les loups libres désignent un joueur à la majorité ; chacun apprendra son camp
// à l'aube (resolution.mjs). La vision n'est consommée que si elle a servi (resoudreNuit).
async function reveillerLeDeuil(entree, { delai }) {
  reveilsEnCours.add(L.CLE_DEUIL);
  Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_DEUIL, enCours: true });
  let cibles = [];
  try {
    const candidats = tousLesVillageois().filter(a => a.system.vivant && campDe(a) !== "meute").map(a => a.id);
    cibles = await demanderALaMeute({ invite: t("LAKOUR_LOUPS.Deuil.Invite"), candidats, delai, objet: "deuil-vision" });
    await api.noterAction({ acteurId: entree.acteurIds[0], roleCle: L.CLE_DEUIL, cibles, effet: "deuil" });
  } finally {
    reveilsEnCours.delete(L.CLE_DEUIL);
    Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_DEUIL, enCours: false });
  }
  return { roleCle: L.CLE_DEUIL, acteurIds: [...entree.acteurIds], cibles, texte: "" };
}

// L'étape « la peste » (reveiller("peste")) : le porteur choisit en secret (sans réponse : le hasard) ; sans porteur, le choix
// du narrateur (cible) ou le hasard. La victime est notée comme une action de nuit (roleCle "peste").
async function reveillerLaPeste(entree, { delai, cible = "" }) {
  const candidats = api.candidatsDeNuit({ roleCle: CLE_PESTE });
  const porteur = entree.acteurIds[0] ?? "";
  reveilsEnCours.add(CLE_PESTE);
  Hooks.callAll("lakourLoups.reveil", { roleCle: CLE_PESTE, enCours: true });
  let cibles = [], hasard = false;
  try {
    if (candidats.length) {
      if (porteur) cibles = await demanderAuPorteur({ acteurId: porteur, invite: t("LAKOUR_LOUPS.Peste.InvitePorteur"), candidats, delai });
      else if (candidats.includes(cible)) cibles = [cible];
      if (!cibles.length) {
        cibles = [L.choisir(candidats)];
        hasard = true;
      }
      const nom = game.actors.get(cibles[0])?.name ?? cibles[0];
      await noterPourMJ(t(hasard ? "LAKOUR_LOUPS.Peste.Hasard" : "LAKOUR_LOUPS.Peste.Choisie", { nom }));
    }
    await api.noterAction({ acteurId: porteur, roleCle: CLE_PESTE, cibles });
  } finally {
    reveilsEnCours.delete(CLE_PESTE);
    Hooks.callAll("lakourLoups.reveil", { roleCle: CLE_PESTE, enCours: false });
  }
  return { roleCle: CLE_PESTE, acteurIds: [...entree.acteurIds], cibles, texte: "", hasard };
}
