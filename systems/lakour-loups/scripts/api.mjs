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
// Les rôles du Village du Pacte (logique/pacte.mjs, étape 3a) : la grâce de l'Innocent, la sagesse perdue avec l'Aïeul, l'égalité
// du Souffre-douleur et sa liste de votants, la plume de la Pie, les oies de la Gardeuse, le second vote du Greffier sont PUBLICS
// (état public, chat, Registre, hook lakourLoups.pacte : { quoi, acteurId? }) ; la vie perdue de l'Aïeul, le flair perdu du Furet,
// les loups contaminés par le Vieux Sergent et le signe du Greffier restent des secrets du MJ (etat.pacteSecret) ; les Lavandières
// et les Bûcherons se reconnaissent au carnet (noterAction) et se parlent la nuit dans leur salon (salons.mjs, « fratrie »).
// Les ambigus, les solitaires du livre et le Loup pâle (logique/ambigus.mjs, étape 3b) : les cartes du Bateleur, le jour qui
// commence la veillée du Feu follet, le partage du village pour l'Illuminé et le dévouement de la Chambrière sont PUBLICS (état
// public, chat, Registre, hook lakourLoups.pacte) ; les cartes du centre du Chapardeur, la carte que joue le Bateleur cette nuit,
// le camp choisi par le Mâtin, le modèle de l'Enfant des bois et les charmés du Joueur de vielle restent des secrets du MJ
// (etat.ambigusSecret, carnets des seuls concernés). Leurs choix s'appliquent dès qu'ils sont notés (noterAction) : la nuit suit.
// La variante « Le Village » (logique/personnalites.mjs, étape 4) : tout y est PUBLIC — qui tient quel bâtiment (etat.tenures,
// annoncé à la distribution), les Chemineaux, les pouvoirs des personnalités (chat, Registre « village », hook lakourLoups.village :
// { quoi, acteurId?, ids?, cle? }), le vote du Cabaretier, la grâce du Hobereau, les logements du Prévôt, les bâtiments brûlés ;
// seuls restent secrets ce que le Prieur lit sur une carte et ce qu'entrevoit la Fournière (leur carnet), et qui est l'Incendiaire.
// La Gazette de la lune (logique/gazette.mjs, étape 9) : les traits visibles des personnages, les cartes lues, les absents du jour, les
// privés de vote, le Crieur public, l'Exécuteur et les séances de Spiritisme sont PUBLICS (état public, chat, Registre « gazette », hook
// lakourLoups.gazette : { quoi, cle?, acteurId?, ids? }) ; restent secrets l'ordre du paquet, les cartes en main du Crieur (son carnet),
// les pouvoirs échangés du Jour des sots (le carnet des deux), l'allié secret du Méchant Benêt (son carnet), le rôle des condamnés sous
// l'Exécuteur (son carnet) et ce qu'a lu la Liseuse de cendres (etat.gazetteSecret).
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
  clesDesBatiments, libellePhase, libelleCamp, libelleCause, libelleRepere, libelleVainqueur, maisonNumerotee
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
// Le rôle SEUL (sansCamp : true ; la variante Double visage, plus tard) : l'objet de rôle entre au document, rien n'est écrit à
// son camp public (system.camp reste ""). L'objet porte le camp que les règles donnent à ce rôle — su de tous dès qu'on nomme le
// rôle —, jamais le camp actuel du villageois. role : les données d'objet à montrer (le visage montré d'un Double visage) au lieu
// du rôle de sa fiche.
async function revelerPubliquement(acteurId, { marquer = true, fin = false, mort = false, campPublie = "", sansCamp = false, role = null } = {}) {
  const a = game.actors.get(acteurId);
  if (!a) return false;
  const f = lireEtat().fiches[acteurId];
  const objet = role ? L.objetDeRole({ role }) : f ? L.objetDeRole(f) : null;
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
  if (camp && !sansCamp && a.system.camp !== camp) maj["system.camp"] = camp;
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
    metier: metier?.name ?? "", maison: libelleRepere(acteur.system.maison), maisonEtiquette: !maisonNumerotee(acteur.system.maison),
    meute: meute.join(", "), prime
  });
  return envoyerSecret(acteur.id, { html: contenu, titre: t("LAKOUR_LOUPS.Carnet.TitreRole", { role: role.name }) });
}

// L'explication de sa place, remise à la distribution au seul joueur humain (Pacte, étape 5) : pour qui ne connaît pas le jeu, son rôle
// (ce qu'il fait, quand le narrateur l'appelle et ce qu'il lui demandera, comment il gagne), sa seconde carte (Double visage), son métier
// (public : ce qu'il fait, son pouvoir de jour) et sa personnalité (Le Village, publique). Une entrée de son carnet secret, qui s'ouvre
// aussitôt et se relit à tout moment (bouton « Carnet secret » de la Table de jeu, rôle du bandeau). Les textes viennent des objets du
// contenu installé (français ou anglais selon le module) ; les compagnons IA n'en reçoivent pas.
const rythmeDuRole = s => {
  const n = s?.nuit ?? {};
  if (!n.actif) return t("LAKOUR_LOUPS.Explication.Quand.jamais");
  if (s.camp === "meute" && Number(n.ordre) === 40) return t("LAKOUR_LOUPS.Explication.Quand.meute");
  const cle = n.premiereNuitSeulement ? "premiere" : n.uneNuitSurDeux ? "uneSurDeux" : n.nuitsImpaires ? "impaires" : n.tantQueMeuteEntiere ? "tantQue" : "chaque";
  return t(`LAKOUR_LOUPS.Explication.Quand.${cle}`);
};
async function envoyerExplication(acteur) {
  if (!acteur?.system.joueur) return;
  const role = roleDe(acteur);
  if (!role) return;
  const enrichir = h => foundry.applications.ux.TextEditor.implementation.enrichHTML(String(h ?? ""));
  const e = s => echapper(s);
  const etat = lireEtat();
  const camp = campDe(acteur);
  const parties = [`<h3>${e(t("LAKOUR_LOUPS.Explication.Role", { role: role.name }))}</h3>`, await enrichir(role.system.description),
    `<p><strong>${e(t("LAKOUR_LOUPS.Explication.QuandTitre"))}</strong> ${e(rythmeDuRole(role.system))}</p>`];
  if (role.system.nuit?.actif && role.system.nuit.invite && !(role.system.camp === "meute" && Number(role.system.nuit.ordre) === 40)) {
    parties.push(`<p><strong>${e(t("LAKOUR_LOUPS.Explication.Question"))}</strong> « ${e(role.system.nuit.invite)} »</p>`);
  }
  const usages = Number(role.system.usages?.max) || 0;
  if (usages > 0) parties.push(`<p>${e(t("LAKOUR_LOUPS.Explication.Usages", { n: usages }))}</p>`);
  parties.push(`<p><strong>${e(t("LAKOUR_LOUPS.Explication.VictoireTitre"))}</strong></p>`, role.system.victoire ? await enrichir(role.system.victoire)
    : `<p>${e(t(camp === "meute" ? "LAKOUR_LOUPS.Explication.VictoireMeute" : "LAKOUR_LOUPS.Explication.VictoireVillage"))}</p>`);
  // Double visage, grande complication : la seconde carte.
  const seconde = L.normaliserFiche(etat.fiches?.[acteur.id]).seconde;
  if (seconde) parties.push(`<h3>${e(t("LAKOUR_LOUPS.Explication.Seconde", { role: seconde.name }))}</h3>`, await enrichir(seconde.system.description),
    `<p><strong>${e(t("LAKOUR_LOUPS.Explication.QuandTitre"))}</strong> ${e(rythmeDuRole(seconde.system))}</p>`);
  const metier = metierDe(acteur);
  if (metier) {
    parties.push(`<h3>${e(t("LAKOUR_LOUPS.Explication.Metier", { metier: metier.name }))}</h3>`, await enrichir(metier.system.description));
    if (metier.system.jour?.actif) parties.push(`<p><strong>${e(t("LAKOUR_LOUPS.Explication.Jour"))}</strong> « ${e(metier.system.jour.invite)} »</p>`);
  }
  const p = L.villageActif(etat) ? L.personnaliteDe(etat, acteur.id) : "";
  if (p) parties.push(`<h3>${e(t("LAKOUR_LOUPS.Explication.Personnalite", { personnalite: t(`LAKOUR_LOUPS.Village.Personnalites.${p}.Nom`) }))}</h3>`,
    `<p>${e(t(`LAKOUR_LOUPS.Village.Personnalites.${p}.Aide`))}</p>`);
  parties.push(`<p><em>${e(t("LAKOUR_LOUPS.Explication.Relire"))}</em></p>`);
  return envoyerSecret(acteur.id, { html: parties.join(""), titre: t("LAKOUR_LOUPS.Explication.Titre", { role: role.name }) });
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
  if (!v?.ouvert || v.chaine || v.mode === "suite") return;
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
    : t({ chapelle: "LAKOUR_LOUPS.Choix.InviteChapelle", bailli: "LAKOUR_LOUPS.Choix.InviteBailli", exil: "LAKOUR_LOUPS.Passage.InviteExil",
      executeur: "LAKOUR_LOUPS.Gazette.Executeur.InviteVote", chatiment: "LAKOUR_LOUPS.Gazette.Chatiment.InviteVote" }[v.objet]
      ?? (v.mode === "defiance" ? "LAKOUR_LOUPS.Gazette.Defiance.Invite" : "LAKOUR_LOUPS.Choix.InviteVote"), { nom: fiche(v.candidats[0])?.name ?? "" });
  const tache = Promise.all(compagnons.map(async a => {
    // Les Vendanges : le Bailli vote d'abord (les autres compagnons attendent son vote) ; l'amour interdit certains votes.
    if (v.bailliDabord?.acteurId && v.bailliDabord.acteurId !== a.id) await attendreLeBailli(v.numero);
    // Le Jour des sots (Gazette) : un amoureux ne peut voter que contre son amant ; la Grande Défiance : deux amis, jamais soi-même.
    const impose = L.voteImpose(lireEtat(), a.id, villageoisAPlat());
    const permis = candidats.filter(c => !voteInterdit(lireEtat(), a.id, c.id) && (!impose || c.id === impose) && !(v.mode === "defiance" && c.id === a.id));
    const choix = await demanderAuCompagnon({ type: "vote", id: foundry.utils.randomID(), acteurId: a.id, acteurNom: a.name, invite,
      candidats: permis, nombre: v.mode === "defiance" ? L.VOIX_DE_LA_DEFIANCE : 1, delai: ms, objet: v.objet, numero: v.numero, ...(v.mode ? { mode: v.mode } : {}),
      ...(v.banc ? { banc: v.banc.accuse } : {}), ...(a.system.vivant ? {} : { souffle: true }) });
    const maintenant = lireEtat().vote;
    if (maintenant.ouvert && maintenant.numero === v.numero) for (const cible of v.mode === "defiance" ? choix : [choix[0] ?? ""]) await recevoirVote({ votant: a.id, cible, userId: game.user.id });
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
  // Les variantes (logique/variantes.mjs) : la Chaîne des innocents n'a pas de voix ; aux Vendanges, le Bailli vote seul, avant les
  // autres, et deux amants ne votent pas l'un contre l'autre.
  const enCours = lireEtat();
  if (enCours.vote.chaine) { avis(userId, t("LAKOUR_LOUPS.Variantes.Chaine.PasDeVote")); return false; }
  if (L.attendLeBailli(enCours.vote, votant)) { avis(userId, t("LAKOUR_LOUPS.Variantes.Vendanges.AttendreLeBailli")); return false; }
  // La Gazette : à tour de rôle (Influences, Cauchemar), seul celui dont c'est le tour ; le Jour des sots, contre son amant.
  if (enCours.vote.mode === "suite" && (enCours.vote.ordre ?? [])[enCours.vote.rang ?? 0] !== votant) {
    avis(userId, t("LAKOUR_LOUPS.Gazette.Suite.PasTonTour", { nom: nomDe((enCours.vote.ordre ?? [])[enCours.vote.rang ?? 0] ?? "") }));
    return false;
  }
  const impose = L.voteImpose(enCours, votant, villageoisAPlat());
  if (cible && impose && cible !== impose) { avis(userId, t("LAKOUR_LOUPS.Gazette.Sots.VoteImpose", { nom: nomDe(impose) })); return false; }
  if (cible && enCours.vote.mode === "defiance" && cible === votant) { avis(userId, t("LAKOUR_LOUPS.Gazette.Defiance.Soi")); return false; }
  if (cible && voteInterdit(enCours, votant, cible)) { avis(userId, t("LAKOUR_LOUPS.Variantes.Vendanges.Amour")); return false; }
  const r = await modifierEtat(e => L.enregistrerVote(e, { votant, cible: cible || "", votants }));
  if (r.ok) {
    // Chez les autres : seulement QUI a voté, jamais pour qui (le décompte est publié à la clôture).
    annoncer("lakourLoups.vote", [{ votant, cible: cible || "" }], [{ votant }]);
    const mien = r.etat.vote.mode === "defiance" ? [].concat(r.etat.vote.votes[votant] ?? []) : cible || "";
    if (user.id !== game.user.id) emettre({ type: "monVote", partie: r.etat.partie, numero: r.etat.vote.numero, cible: mien }, [user.id]);
    // À tour de rôle : le doigt reste tendu (public), puis au suivant.
    if (r.etat.vote.mode === "suite") {
      await annonceChat(echapper(t(cible ? "LAKOUR_LOUPS.Gazette.Suite.Designe" : "LAKOUR_LOUPS.Gazette.Suite.Passe", { qui: nomDe(votant), nom: nomDe(cible) })));
      avancerLaSuite();
    }
    // Le Village : le Cabaretier immunisé vote à découvert (sur table : seul, avant les autres).
    await publierLeVoteDuCabaretier(votant, cible || "", r.etat.vote.numero);
    // Les Vendanges : le vote du Bailli, à découvert ; les autres peuvent voter.
    await publierLeVoteDuBailli(votant, cible || "", r.etat.vote.numero);
  } else if (r.raison === "temps") avis(userId, t("LAKOUR_LOUPS.Vote.TempsEcoule"));
  else if (r.raison === "defiance") avis(userId, t("LAKOUR_LOUPS.Gazette.Defiance.Deux"));
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
          : `${nom(votant)} → ${[].concat(cible ?? []).map(nom).join(" + ")}`)).join(", ");
      const choix = x.departage?.choix ?? [];
      const issue = x.objet === "bailli"
        ? (x.elus?.length ? t("LAKOUR_LOUPS.Registre.IssueBailli", { noms: x.elus.map(nom).join(", ") }) : t(x.egalite ? "LAKOUR_LOUPS.Registre.Egalite" : "LAKOUR_LOUPS.Registre.Personne"))
        : x.elus?.length ? t("LAKOUR_LOUPS.Registre.Designe", { noms: x.elus.map(nom).join(", ") }) : t(x.egalite ? "LAKOUR_LOUPS.Registre.Egalite" : "LAKOUR_LOUPS.Registre.Personne");
      const tranche = x.departage ? ` ${t(choix.length ? "LAKOUR_LOUPS.Registre.Tranche" : "LAKOUR_LOUPS.Registre.TranchePersonne", { nom: nom(x.departage.par), noms: choix.map(nom).join(", ") })}` : "";
      // Le Banc : le verdict (« pour » sur le total) ; le Glas du deuil : une voix sans visage, jamais d'où elle vient.
      const banc = x.banc ? ` ${t("LAKOUR_LOUPS.Registre.Banc", { nom: nom(x.banc.accuse), pour: x.banc.pour, total: x.banc.total })}` : "";
      const deuil = x.deuil ? ` ${t("LAKOUR_LOUPS.Registre.VoixDeuil", { cible: nom(x.deuil) })}` : "";
      // Le Pacte : la plume noire de la Pie (deux voix sans visage), le Souffre-douleur qui paie l'égalité.
      const plume = x.plume ? ` ${t("LAKOUR_LOUPS.Registre.VoixPlume", { cible: nom(x.plume) })}` : "";
      const bouc = x.souffreDouleur && !x.remplace ? ` ${t("LAKOUR_LOUPS.Registre.SouffreDouleur", { nom: nom(x.souffreDouleur) })}` : "";
      // Les variantes (Pacte, étape 5) : la Chaîne des innocents (qui a assis qui, le dernier debout) ; le Souffre-douleur des Vendanges.
      const chaine = x.chaine ? ` ${t("LAKOUR_LOUPS.Registre.Chaine", { nom: nom(x.chaine.condamne), chaine: (x.chaine.assis ?? [])
        .map(a => `${nom(a.par)} → ${a.hasard ? t("LAKOUR_LOUPS.Registre.ChaineSort", { nom: nom(a.id) }) : nom(a.id)}`).join(", ") || "—" })}` : "";
      const vendanges = x.remplace ? ` ${t("LAKOUR_LOUPS.Variantes.Vendanges.Bouc", { nom: nom(x.souffreDouleur), voisin: nom(x.remplace) })}` : "";
      return t("LAKOUR_LOUPS.Registre.Vote", { tour, objet: t(`LAKOUR_LOUPS.Registre.Objets.${x.objet}`), voix: voix || t("LAKOUR_LOUPS.Registre.AucuneVoix"), issue })
        + tranche + banc + deuil + plume + bouc + chaine + vendanges + (x.annule ? ` ${t("LAKOUR_LOUPS.Registre.Annule")}` : "");
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
    // Le Pacte (logique/pacte.mjs) : grâce, sagesse perdue, votants du Souffre-douleur, plume, oies, second vote.
    case "pacte": return game.i18n.has(`LAKOUR_LOUPS.Registre.Pacte.${x.quoi}`)
      ? t(`LAKOUR_LOUPS.Registre.Pacte.${x.quoi}`, { tour, nom: x.acteurId ? nom(x.acteurId) : "", noms: (x.ids ?? []).map(nom).join(", ") }) : "";
    // Le Village (logique/personnalites.mjs) : distribution, logements, incendies, pouvoirs des personnalités.
    case "village": return game.i18n.has(`LAKOUR_LOUPS.Registre.Village.${x.quoi}`)
      ? t(`LAKOUR_LOUPS.Registre.Village.${x.quoi}`, { tour, nom: x.acteurId ? nom(x.acteurId) : "", noms: (x.ids ?? []).map(nom).join(", "),
        batiment: x.cle && game.i18n.has(`LAKOUR_LOUPS.Batiments.${x.cle}`) ? t(`LAKOUR_LOUPS.Batiments.${x.cle}`) : x.cle ?? "" }) : "";
    // Les variantes (logique/variantes.mjs) : les chandelles d'une meute en désaccord, le Bailli des Vendanges, la chute des envoûtés.
    case "variante": return game.i18n.has(`LAKOUR_LOUPS.Registre.Variante.${x.quoi}`)
      ? t(`LAKOUR_LOUPS.Registre.Variante.${x.quoi}`, { tour, nom: x.acteurId ? nom(x.acteurId) : "", noms: (x.ids ?? []).map(nom).join(", ") || "—" }) : "";
    // La Gazette de la lune (logique/gazette.mjs) : les cartes lues, le Crieur, l'Exécuteur, les séances, les marchés, les privés de vote.
    case "gazette": return game.i18n.has(`LAKOUR_LOUPS.Registre.Gazette.${x.quoi}`)
      ? t(`LAKOUR_LOUPS.Registre.Gazette.${x.quoi}`, { tour, nom: x.acteurId ? nom(x.acteurId) : t("LAKOUR_LOUPS.Narrateur"), noms: (x.ids ?? []).map(nom).join(", "),
        carte: x.cle && L.estCarteDeLaGazette(x.cle) ? t(`LAKOUR_LOUPS.Gazette.Cartes.${x.cle}.Nom`) : x.cle && L.CLES_DES_SEANCES.includes(x.cle) ? t(`LAKOUR_LOUPS.Gazette.Seances.${x.cle}`) : x.cle ?? "",
        reponse: x.reponse === undefined ? "" : t(x.reponse ? "LAKOUR_LOUPS.Gazette.Oui" : "LAKOUR_LOUPS.Gazette.Non") }) : "";
    case "vacance": return t("LAKOUR_LOUPS.Registre.Vacance", { tour, nom: nom(x.acteurId),
      batiments: (x.batiments ?? []).map(c => (game.i18n.has(`LAKOUR_LOUPS.Batiments.${c}`) ? t(`LAKOUR_LOUPS.Batiments.${c}`) : c)).join(", ") });
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
  // Le Village : le pouvoir d'une personnalité (« Le prieuré : confesser »).
  if (def?.source === "tenure") return t(`LAKOUR_LOUPS.Village.Pouvoirs.${pouvoir}`);
  // La Gazette : le pouvoir d'une charge (le Bailli révoque le Crieur public).
  if (def?.source === "charge") return t(`LAKOUR_LOUPS.Gazette.Pouvoirs.${pouvoir}.Nom`);
  const cle = `LAKOUR_LOUPS.Batiments.${pouvoir}`;
  return game.i18n.has(cle) ? t(cle) : pouvoir;
}

// Le bilan de la partie finie, avec le nom du joueur de chacun ("" : un joueur IA) : le récit au chat et les Chroniques.
function lignesDeFin(etat) {
  return L.bilanDePartie({ villageois: villageoisAPlat(), morts: etat.morts, causes: etat.causes, vainqueur: etat.vainqueur, partis: etat.partis,
    allies: L.alliesDeLaMeute(etat) })
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
    // Un candidat est un villageois (son id), ou une option toute faite ({ id, nom, img }) : une carte du centre du Chapardeur,
    // une carte du Bateleur (Le Pacte, étape 3b).
    candidats: candidats.map(id => {
      if (id && typeof id === "object") return { id: String(id.id), nom: String(id.nom ?? id.id), img: String(id.img ?? ""), maison: "" };
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
  if (L.verifierVictoire({ ...L.contexteDesAmbigus(avant), villageois: villageoisAPlat(), morts: avant.morts, primes: avant.primes, peste: avant.peste, strict: pariteStricte(avant) })) return;
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
  suivreLeCrieur();
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
    // Petite tablée : les places laissées vides par le Bailli, le sort les a tranchées.
    if (final.departage.sort?.length) texte += ` ${t("LAKOUR_LOUPS.Tablee.Sort", { noms: final.departage.sort.map(id => game.actors.get(id)?.name ?? id).join(", ") })}`;
    return { etat: L.journaliser(x, texte), resultat: final };
  });
  if (texte) await annonceChat(echapper(texte));
  return r.resultat ?? resultat;
}

// Le masque du Loup déguisé tombe (le plus désigné d'un vote sans être exécuté) : sa fiche perd l'apparence, les visions disent
// désormais la vérité sur lui. Secret : le narrateur le sait (chronique secrète), le loup aussi (carnet) ; personne d'autre.
async function tomberLeMasque(acteurId) {
  const nom = game.actors.get(acteurId)?.name ?? acteurId;
  let tombe = false;
  await modifierEtat(e => {
    const f = e.fiches?.[acteurId];
    if (!f?.role?.system?.apparence) return e;
    tombe = true;
    majFiche(e, acteurId, x => ({ ...x, role: { ...x.role, system: { ...x.role.system, apparence: "" } } }));
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Deguise.MasqueTombe", { nom }));
  });
  if (tombe) await envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Deguise.Carnet") });
}

// Tant que le Bailli n'a pas tranché, ni nouveau vote ni changement de phase.
function exigerSansDepartage() {
  if (L.departageEnAttente(lireEtat())) throw new Error(t("LAKOUR_LOUPS.Bailli.Refus.departage"));
}

// ------------------------------------------------------------------ les derniers gestes (logique/derniers-gestes.mjs)
// Un mourant qui porte un geste (la Braconnière emporte quelqu'un) choisit LUI-MÊME : une demande posthume à son joueur (ou à son
// compagnon IA), les vivants pour candidats, puis le geste appliqué (la cible meurt, cause « emporte »). Sans réponse au délai, ou
// s'il passe, le MJ garde la main (étape « emporter » de la Table, outil du narrateur) ; s'il tranche avant la réponse, la demande
// est close et la réponse tardive ignorée (le geste est fait). Une demande à la fois, une seule par mort ; la nuit, une fois
// toutes ses morts tombées (comme la succession du Bailli). Gardé en mémoire seulement : une page du MJ rechargée ne redemande
// pas, l'étape de la Table reste là.
const gestesEnCours = new Map();   // acteurId -> geste dont la demande est chez le mourant
const gestesDemandes = new Set();  // « partie|geste:acteurId|tour » : déjà demandé (une demande par mort)
let gestes = Promise.resolve();

function suivreGestes() {
  if (mortsDeLaNuit) return gestes;
  gestes = gestes.then(menerGestes).catch(e => console.warn(`${ID} | derniers gestes`, e));
  return gestes;
}

async function menerGestes() {
  for (let i = 0; i < 40; i++) {
    const avant = lireEtat();
    if (!avant.partie || avant.vainqueur || avant.phase === "fin") return;
    const cle = g => `${avant.partie}|${g.geste}:${g.acteurId}|${avant.tour}`;
    const g = L.gestesEnAttente(avant, villageoisAPlat()).find(x => !gestesDemandes.has(cle(x)));
    if (!g) return;
    gestesDemandes.add(cle(g));
    await demanderLeGeste(avant, g);
  }
}

async function demanderLeGeste(avant, { acteurId, geste }) {
  const def = L.GESTES[geste];
  const candidats = L.candidatsDuGeste(villageoisAPlat(), acteurId, { etat: avant, geste });
  if (!candidats.length || !game.actors.get(acteurId)) return;
  gestesEnCours.set(acteurId, geste);
  let choix = [];
  try {
    choix = await demandeLibre({ acteurId, invite: t(`LAKOUR_LOUPS.Gestes.${geste}.Invite`), candidats, nombre: L.nombreDuGeste(geste, candidats), posthume: true, objet: def.objet });
  } finally {
    gestesEnCours.delete(acteurId);
  }
  const nom = id => game.actors.get(id)?.name ?? id;
  // Vérifié puis appliqué sous le verrou de la victoire : une victoire déclarée entre-temps l'arrête, et aucune vérification ne
  // lit le village pendant qu'il change.
  const fait = await sousVerrou(async () => {
    const v = L.verifierGeste({ etat: lireEtat(), villageois: villageoisAPlat(), acteurId, geste, cibles: choix, partie: avant.partie });
    if (!v.ok) {
      // Il passe, ou ne répond pas à temps : au MJ de trancher (ou de dire « personne »). Déjà fait, partie finie ou autre : rien.
      if (v.raison === "personne") await noterPourMJ(t(`LAKOUR_LOUPS.Gestes.${geste}.Personne`, { nom: nom(acteurId) }), { notifier: true });
      return false;
    }
    await noterPourMJ(t(`LAKOUR_LOUPS.Gestes.${geste}.Choisi`, { nom: nom(acteurId), cibles: v.cibles.map(nom).join(", ") }));
    // Le Souffre-douleur : sa liste des votants de demain, publique (pacte.mjs) ; la Braconnière : ses cibles meurent.
    if (geste === "votants") await poserLesVotants(acteurId, v.cibles);
    else for (const id of v.cibles) await api.eliminer(id, { cause: def.cause });
    return true;
  });
  if (fait) await api.verifierVictoire();
}

// Pour les essais et les outils qui doivent attendre que les derniers gestes en cours soient faits (ou rendus au MJ).
export const attendreGestes = () => gestes;

// Le MJ (ou le narrateur) vient de faire le geste à la place du mourant (une mort de sa cause) : la demande encore ouverte chez
// le mourant est close (sa fenêtre aussi) ; un compagnon IA qui répondrait encore serait ignoré (verifierGeste : « fait »).
function fermerGestes(cause) {
  const geste = L.gesteDeLaCause(cause);
  if (!geste) return;
  for (const [id, p] of [...enAttente.entries()]) {
    if (p.demande.posthume && p.demande.objet === L.GESTES[geste].objet && gestesEnCours.get(p.demande.acteurId) === geste) terminer(id, [], true);
  }
}

// ------------------------------------------------------------------ les rôles du Village du Pacte (logique/pacte.mjs)
const nomDe = id => game.actors.get(id)?.name ?? id;

// Le Souffre-douleur (ou le narrateur à sa place, api.designerVotants) désigne ceux qui voteront aux votes d'exécution de demain.
async function poserLesVotants(par, ids) {
  const texte = t("LAKOUR_LOUPS.Pacte.Votants", { nom: nomDe(par), noms: ids.map(nomDe).join(", ") });
  await modifierEtat(e => {
    L.designerVotants(e, { par, ids });
    L.inscrire(e, { type: "pacte", quoi: "votants", acteurId: par, ids: [...ids] });
    return L.journaliser(e, texte);
  });
  await annonceChat(echapper(texte));
  annoncer("lakourLoups.pacte", [{ quoi: "votants", acteurId: par, ids: [...ids] }]);
  await sceller();
}

// L'Innocent condamné par le vote : sa carte se retourne, le village le gracie ; il reste en jeu, sans voix désormais. Bailli, il perd
// la charge, qui ne passe à personne. -> [] (personne n'est mort)
async function gracierLInnocent(acteur) {
  let abolie = false;
  const texte = t("LAKOUR_LOUPS.Pacte.Grace", { nom: acteur.name });
  await modifierEtat(e => {
    const x = L.gracier(e, acteur.id, { numero: e.vote.numero });
    abolie = x.bailli;
    L.inscrire(x.etat, { type: "pacte", quoi: "grace", acteurId: acteur.id });
    if (abolie) L.inscrire(x.etat, { type: "bailli", acteurId: "", comment: "abolie", de: acteur.id });
    return L.journaliser(x.etat, texte);
  });
  await revelerPubliquement(acteur.id);
  await annonceChat(echapper(texte));
  if (abolie) {
    await annonceChat(echapper(t("LAKOUR_LOUPS.Pacte.BailliAboli", { nom: acteur.name })));
    annoncer("lakourLoups.bailli", [{ acteurId: "", comment: "abolie", de: acteur.id }]);
  }
  annoncer("lakourLoups.pacte", [{ quoi: "grace", acteurId: acteur.id }]);
  await suivreSecondVote();
  diffuserVus();
  await sceller();
  return [];
}

// L'Aïeul tombé de la main du village (vote, poison, Braconnière) : Brumecombe perd sa sagesse, annoncé à tous ; avec le réglage
// « innocentSuitAieul », un Innocent déjà gracié tombe avec lui.
async function perdreLaSagesse(acteur, innocents = []) {
  const texte = t("LAKOUR_LOUPS.Pacte.Sagesse", { nom: acteur.name });
  // La perte de la sagesse est publique, et seul l'Aïeul la cause : sa carte se retourne (même sans révélation à la mort).
  if (!acteur.system.revele) await revelerPubliquement(acteur.id, { mort: true });
  await modifierEtat(e => {
    L.perdreLaSagesse(e);
    L.inscrire(e, { type: "pacte", quoi: "sagesse", acteurId: acteur.id });
    return L.journaliser(e, texte);
  });
  await annonceChat(echapper(texte));
  annoncer("lakourLoups.pacte", [{ quoi: "sagesse", acteurId: acteur.id }]);
  for (const id of innocents) await api.eliminer(id, { cause: "sagesse" });
}

// Le second vote du Greffier bègue : dû quand son signe a été fait ce jour-là et que les condamnés du dernier vote d'exécution sont
// tombés (ou graciés) ; pas si la partie est gagnée. Il s'ouvre aussitôt, sans débat ; l'usage du Greffier est pris alors ; ni son
// nom ni son rôle ne sont dits. -> true s'il s'est ouvert
async function suivreSecondVote() {
  const e = lireEtat();
  if (e.vainqueur || !L.secondVoteDu(e, villageoisAPlat())) return false;
  if (L.verifierVictoire({ ...L.contexteDesAmbigus(e), villageois: villageoisAPlat(), morts: e.morts, primes: e.primes, peste: e.peste, strict: pariteStricte(e) })) return false;
  const par = e.pacteSecret.signal.par;
  const texte = t("LAKOUR_LOUPS.Pacte.SecondVote");
  await modifierEtat(x => {
    x.pacte = { ...x.pacte, secondVote: { tour: x.tour, numero: (Number(x.vote.numero) || 0) + 1 } };
    x.pacteSecret = { ...x.pacteSecret, signal: null };
    if (x.fiches?.[par]) majFiche(x, par, f => L.changerUsage(f, -1));
    L.inscrire(x, { type: "pacte", quoi: "second-vote" });
    return L.journaliser(x, texte);
  });
  await annonceChat(echapper(texte));
  annoncer("lakourLoups.pacte", [{ quoi: "second-vote" }]);
  try { await api.ouvrirVote({ duree: e.vote.duree }); } catch (err) { await noterPourMJ(err.message, { notifier: true }); }
  return true;
}

// Les Lavandières, les Bûcherons : à leur réveil, chacun apprend (la première nuit) ou retrouve (une nuit sur deux) les autres
// vivants de sa fratrie, dans son carnet secret ; une fois par nuit. Le salon de nuit « fratrie » (salons.mjs) les laisse se parler.
const fratriesSaluees = new Set();
async function reconnaitreLaFratrie(acteurId) {
  const etat = lireEtat();
  const cle = `${etat.partie}|${etat.tour}|${acteurId}`;
  if (fratriesSaluees.has(cle)) return;
  fratriesSaluees.add(cle);
  const freres = L.freresDe(villageoisAPlat(), acteurId);
  const noms = freres.map(nomDe).join(", ");
  const texte = !freres.length ? t("LAKOUR_LOUPS.Pacte.FratrieSeule")
    : t(etat.tour <= 1 ? "LAKOUR_LOUPS.Pacte.FratrieReconnue" : "LAKOUR_LOUPS.Pacte.FratrieRetrouvee", { noms });
  await envoyerSecret(acteurId, { texte });
}

// ------------------------------------------------------------------ les rôles publics (role.public)
// Un rôle PUBLIC dès la distribution (le Franc-Villageois du livre, les personnalités au jeton « rôle visible ») : sa carte est
// retournée devant tous (revelerPubliquement : l'objet de rôle et le camp DU RÔLE au document, rien d'autre), annoncée au chat.
// Rien des autres ne bouge. Un Somnambule n'est jamais retourné ainsi (il porte un rôle rêvé, pas le sien).
async function revelerLesRolesPublics(ids) {
  const etat = lireEtat();
  for (const id of ids) {
    const role = L.normaliserFiche(etat.fiches?.[id]).role;
    if (!role?.system?.public || etat.somnambules?.[id]) continue;
    await revelerPubliquement(id);
    const nom = game.actors.get(id)?.name ?? id;
    await modifierEtat(e => L.journaliser(e, t("LAKOUR_LOUPS.Public.Annonce", { nom, role: role.name })));
    await annonceChat(echapper(t("LAKOUR_LOUPS.Public.Annonce", { nom, role: role.name })));
  }
}

// ------------------------------------------------------------------ les ambigus, les solitaires du livre, le Loup pâle (logique/ambigus.mjs)
// Ce qu'un choix de nuit change aussitôt (noterAction) : la carte prise par le Chapardeur, la carte jouée par le Bateleur, le camp
// du Mâtin, le modèle de l'Enfant des bois, les charmés du Joueur de vielle. Tout reste secret (fiches, etat.ambigusSecret, carnets).
const nomsDe = ids => ids.map(nomDe).join(", ");
// Un nouveau venu dans la meute : chaque loup vivant l'apprend dans son carnet. -> les noms des loups (pour le sien)
async function presenterALaMeute(acteurId) {
  const loups = tousLesVillageois().filter(a => a.system.vivant && a.id !== acteurId && campDe(a) === "meute");
  for (const l of loups) await envoyerSecret(l.id, { texte: t("LAKOUR_LOUPS.Ambigus.RejointLaMeute", { nom: nomDe(acteurId) }) });
  return loups.map(l => l.name).join(", ");
}

// Le Chapardeur prend la carte n° index du centre (logique/ambigus.mjs, chaparder) : il devient ce rôle (sa fiche, son camp), sa
// carte va au centre. Rien de public : au matin, personne ne le sait.
async function chaparderUneCarte(acteurId, index) {
  const avant = lireEtat();
  const f = L.normaliserFiche(avant.fiches?.[acteurId]);
  const x = L.chaparder(avant.ambigusSecret.centre, index, f.role);
  if (!x?.pris) return false;
  const campAvant = f.camp;
  const pris = L.roleAPlat(x.pris);
  await modifierEtat(e => {
    e.fiches = { ...e.fiches, [acteurId]: { ...L.ficheDuRole(x.pris, { source: x.pris.source ?? "" }), amoureux: f.amoureux } };
    e.ambigusSecret = { ...e.ambigusSecret, centre: x.centre };
    // Un Chasseur de primes pris au centre reçoit sa cible, comme à la distribution.
    if (L.victoireCleDe(pris) === "cible-executee") {
      e.primes = { ...e.primes, ...L.designerPrimes(villageoisAPlat().filter(v => v.vivant).map(v => ({ ...v, role: v.id === acteurId ? pris : null }))) };
    }
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Ambigus.ChapardeurNote", { nom: nomDe(acteurId), role: x.pris.name }));
  });
  const acteur = game.actors.get(acteurId);
  await envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.ChapardeurPris", { role: x.pris.name }) });
  await envoyerRole(acteur);
  if (pris.camp === "meute" && campAvant !== "meute") {
    await envoyerMasques(acteur);
    await envoyerSecretsDeMeute(acteur);
    await presenterALaMeute(acteurId);
  }
  return true;
}

// La carte que le Bateleur joue cette nuit (sa clé) : son rôle, lu au contenu, gardé dans les secrets pour la nuit.
async function jouerUneCarte(acteurId, cle) {
  const carte = L.cartesJouables(lireEtat()).find(c => c.cle === cle);
  if (!carte) return false;
  let role = null;
  try {
    const uuid = (await contenuDisponible()).roles.get(cle);
    const doc = uuid ? await fromUuid(uuid) : null;
    role = doc ? L.roleAPlat(donneesObjet(doc)) : null;
  } catch { role = null; }
  if (!role) return false;
  await modifierEtat(e => {
    e.ambigusSecret = { ...e.ambigusSecret, emprunts: { ...e.ambigusSecret.emprunts, [acteurId]: { cle, tour: e.tour, role } } };
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Ambigus.BateleurNote", { nom: nomDe(acteurId), role: carte.nom }));
  });
  await envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.BateleurJoue", { role: carte.nom }) });
  return true;
}

// Au matin : les cartes jouées cette nuit sont retirées, devant tous ; les emprunts tombent. -> [texte à annoncer]
async function retirerLesCartesJouees(tour) {
  const etat = lireEtat();
  if (!Object.keys(etat.ambigusSecret.emprunts).length) return [];
  const jouees = Object.values(etat.ambigusSecret.emprunts).filter(x => x.tour === tour).map(x => x.cle);
  const noms = etat.ambigus.bateleur.filter(c => jouees.includes(c.cle)).map(c => c.nom);
  await modifierEtat(e => {
    e.ambigus = { ...e.ambigus, bateleur: e.ambigus.bateleur.filter(c => !jouees.includes(c.cle)), retirees: [...new Set([...e.ambigus.retirees, ...jouees])] };
    e.ambigusSecret = { ...e.ambigusSecret, emprunts: {} };
    return e;
  });
  return noms.map(role => t("LAKOUR_LOUPS.Ambigus.CarteRetiree", { role }));
}

// Le Mâtin : désigné lui-même, il rejoint la meute dès cette nuit ; sinon il reste villageois. Définitif.
async function choisirLeCamp(acteurId, meute) {
  await modifierEtat(e => {
    e.ambigusSecret = { ...e.ambigusSecret, matins: { ...e.ambigusSecret.matins, [acteurId]: meute ? "meute" : "village" } };
    return L.journaliserSecret(e, t(meute ? "LAKOUR_LOUPS.Ambigus.MatinMeuteNote" : "LAKOUR_LOUPS.Ambigus.MatinVillageNote", { nom: nomDe(acteurId) }));
  });
  if (!meute) return envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.MatinVillage") });
  await api.changerCamp(acteurId, "meute");
  const loups = await presenterALaMeute(acteurId);
  return envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.MatinMeute", { noms: loups || "—" }) });
}

// L'Enfant des bois et son modèle.
async function choisirLeModele(acteurId, modele) {
  await modifierEtat(e => {
    e.ambigusSecret = { ...e.ambigusSecret, modeles: { ...e.ambigusSecret.modeles, [acteurId]: modele } };
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Ambigus.ModeleNote", { nom: nomDe(acteurId), modele: nomDe(modele) }));
  });
  return envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.Modele", { nom: nomDe(modele) }) });
}
// Le modèle tombé (de n'importe quelle façon) : chaque Enfant des bois qui l'avait choisi rejoint la meute, en secret ; il se
// réveille avec elle dès la nuit suivante.
async function orphelinsDe(mortId) {
  for (const id of L.enfantsOrphelins(lireEtat(), villageoisAPlat(), mortId)) {
    await api.changerCamp(id, "meute");
    await noterPourMJ(t("LAKOUR_LOUPS.Ambigus.OrphelinNote", { nom: nomDe(id), modele: nomDe(mortId) }));
    const loups = await presenterALaMeute(id);
    await envoyerSecret(id, { texte: t("LAKOUR_LOUPS.Ambigus.Orphelin", { nom: nomDe(mortId), noms: loups || "—" }) });
  }
}

// Le Joueur de vielle charme ses deux joueurs de la nuit (ils l'apprendront au réveil des charmés).
async function charmerLesJoueurs(acteurId, cibles) {
  const ids = L.candidatsDuCharme(cibles, acteurId, lireEtat().ambigusSecret.charmes).filter(id => game.actors.get(id)?.system.vivant);
  if (!ids.length) return;
  await modifierEtat(e => L.journaliserSecret(L.charmer(e, ids), t("LAKOUR_LOUPS.Ambigus.CharmeNote", { nom: nomDe(acteurId), noms: nomsDe(ids) })));
  await envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.Charme", { noms: nomsDe(ids) }) });
}
// Les charmés se réveillent ensemble et se reconnaissent : chacun reçoit, une fois par nuit, le nom des autres charmés vivants.
const charmesSalues = new Set();
async function reconnaitreLesCharmes() {
  const etat = lireEtat();
  const ids = L.charmesVivants(villageoisAPlat(), etat.ambigusSecret.charmes);
  for (const id of ids) {
    const cle = `${etat.partie}|${etat.tour}|${id}`;
    if (charmesSalues.has(cle)) continue;
    charmesSalues.add(cle);
    const autres = ids.filter(x => x !== id);
    await envoyerSecret(id, { texte: autres.length ? t("LAKOUR_LOUPS.Ambigus.Charmes", { noms: nomsDe(autres) }) : t("LAKOUR_LOUPS.Ambigus.CharmeSeul") });
  }
}

// Ce que noterAction applique aussitôt pour ces rôles (carte : l'index d'une carte du centre, ou la clé d'une carte du Bateleur).
async function suivreLesAmbigus({ acteurId, role, cle, cibles, carte }) {
  if (cle === L.CLE_CHARMES) return reconnaitreLesCharmes();
  if (!role || role.system.cle !== cle) return undefined;
  const effet = role.system.effet;
  if (effet === L.EFFET_CHAPARDEUR) {
    const etat = lireEtat();
    if (etat.ambigusSecret.chapardes.includes(acteurId) || !etat.ambigusSecret.centre.length) return undefined;
    await modifierEtat(e => { e.ambigusSecret = { ...e.ambigusSecret, chapardes: [...e.ambigusSecret.chapardes, acteurId] }; return e; });
    let index = carte === undefined || carte === null || carte === "" || !Number.isInteger(Number(carte)) ? -1 : Number(carte);
    // Deux cartes de la meute au centre : il est obligé d'en prendre une (au hasard s'il n'a rien choisi).
    if (index < 0 && L.chapardeurOblige(etat.ambigusSecret.centre)) index = Math.floor(Math.random() * etat.ambigusSecret.centre.length);
    if (index < 0) return envoyerSecret(acteurId, { texte: t("LAKOUR_LOUPS.Ambigus.ChapardeurGarde") });
    return chaparderUneCarte(acteurId, index);
  }
  if (effet === L.EFFET_BATELEUR) return carte ? jouerUneCarte(acteurId, String(carte)) : undefined;
  if (effet === L.EFFET_MATIN && !(acteurId in lireEtat().ambigusSecret.matins)) return choisirLeCamp(acteurId, cibles.includes(acteurId));
  if (effet === L.EFFET_ENFANT_DES_BOIS && cibles[0] && cibles[0] !== acteurId) return choisirLeModele(acteurId, cibles[0]);
  if (effet === L.EFFET_VIELLE && cibles.length) return charmerLesJoueurs(acteurId, cibles.slice(0, 2));
  return undefined;
}

// Le Feu follet qui a survécu à la première nuit devient simple villageois (camp du Village) : il le sait, lui seul.
async function eteindreLesFeuxFollets() {
  for (const v of villageoisAPlat().filter(x => x.vivant && x.camp === "solitaire" && L.victoireCleDe(x.role) === L.VICTOIRE_FEU_FOLLET)) {
    await api.changerCamp(v.id, "village");
    await envoyerSecret(v.id, { texte: t("LAKOUR_LOUPS.Ambigus.FeuFolletEteint") });
  }
}

// Le Chasseur de primes dont la prime a échoué (logique/victoire.mjs, primesEchues : sa cible morte autrement que par le vote, ou le
// troisième jour passé sans qu'elle tombe au vote) devient simple villageois (camp du Village) : il le sait, lui seul. Au matin.
async function echoirLesPrimes(tour) {
  const e = lireEtat();
  for (const id of L.primesEchues({ villageois: villageoisAPlat(), morts: e.morts, primes: e.primes, tour })) {
    await api.changerCamp(id, "village");
    await envoyerSecret(id, { texte: t("LAKOUR_LOUPS.Ambigus.PrimeEchue") });
  }
}

// La Chambrière : juste après le décompte d'un vote d'exécution, une demande courte (la carte d'un condamné, ou rien) ; la
// révélation du condamné attend sa réponse (eliminer). Une à la fois : la dernière clôture la remplace.
let devouement = null;   // { partie, numero, chambriere, promesse }
function proposerLeDevouement(resultat) {
  devouement = null;
  if (resultat?.objet !== "execution" || !(resultat.elus ?? []).length || resultat.departage?.enAttente) return;
  const etat = lireEtat();
  const vs = villageoisAPlat();
  const condamnes = resultat.elus.filter(id => vs.find(v => v.id === id)?.vivant
    && !L.graceDue(etat, { acteurId: id, role: roleDe(game.actors.get(id))?.system, cause: "vote" }));
  const chambriere = L.chambriereDisponible(vs, condamnes, { sansPouvoirs: L.sagesseEstPerdue(etat) });
  if (!chambriere) return;
  const delai = Math.min(reglage("delaiChoix") * 1000, L.DELAI_CHAMBRIERE);
  const invite = t("LAKOUR_LOUPS.Ambigus.ChambriereInvite", { noms: nomsDe(condamnes) });
  const promesse = demandeLibre({ acteurId: chambriere, invite, candidats: condamnes, nombre: 1, delai, objet: "chambriere" })
    .then(([c = ""]) => c).catch(() => "");
  devouement = { partie: etat.partie, numero: resultat.numero, chambriere, promesse };
}
// La réponse de la Chambrière pour ce condamné (attendue) : son id si elle prend sa carte, "" sinon.
async function chambrierePour(acteurId) {
  const d = devouement;
  const etat = lireEtat();
  if (!d || d.partie !== etat.partie || d.numero !== etat.vote.resultat?.numero) return "";
  const choix = await d.promesse;
  if (choix !== acteurId || devouement !== d || !game.actors.get(d.chambriere)?.system.vivant) return "";
  devouement = null;
  return d.chambriere;
}
// Elle se dévoile : sa carte de Chambrière retournée devant tous ; elle prend, sans la montrer, celle du condamné (remise à neuf).
async function seDevouer(chambriere, de) {
  const avant = lireEtat();
  const repris = L.normaliserFiche(avant.fiches?.[de]).role;
  if (!repris) return false;
  const role = L.roleAPlat(repris);
  const campAvant = campDe(game.actors.get(chambriere));
  await revelerPubliquement(chambriere);
  const texte = t("LAKOUR_LOUPS.Ambigus.Devouement", { nom: nomDe(chambriere), de: nomDe(de) });
  let bailli = false;
  await modifierEtat(e => {
    const x = L.devouer(e, { chambriere, de });
    bailli = x.bailli;
    e.fiches = { ...e.fiches, [chambriere]: L.ficheDeLaChambriere(L.normaliserFiche(e.fiches?.[chambriere]), repris, { tour: e.tour }) };
    if (e.fioles?.[chambriere]) { e.fioles = { ...e.fioles }; delete e.fioles[chambriere]; }
    // Un Chasseur de primes repris : une cible neuve (pas le condamné).
    if (L.victoireCleDe(role) === "cible-executee") {
      e.primes = { ...e.primes, ...L.designerPrimes(villageoisAPlat().filter(v => v.vivant && v.id !== de).map(v => ({ ...v, role: v.id === chambriere ? role : null }))) };
    }
    L.inscrire(e, { type: "pacte", quoi: "devouement", acteurId: chambriere, ids: [de] });
    if (bailli) L.inscrire(e, { type: "bailli", acteurId: "", comment: "vacance", de: chambriere });
    return L.journaliserSecret(L.journaliser(e, texte), t("LAKOUR_LOUPS.Ambigus.DevouementNote", { nom: nomDe(chambriere), role: repris.name }));
  });
  await annonceChat(echapper(texte));
  if (bailli) {
    await annonceChat(echapper(t("LAKOUR_LOUPS.Ambigus.BailliPerdu", { nom: nomDe(chambriere) })));
    annoncer("lakourLoups.bailli", [{ acteurId: "", comment: "vacance", de: chambriere }]);
  }
  annoncer("lakourLoups.pacte", [{ quoi: "devouement", acteurId: chambriere, ids: [de] }]);
  const acteur = game.actors.get(chambriere);
  await envoyerRole(acteur);
  // Le Joueur de vielle repris : elle apprend qui est déjà charmé.
  if (role.effet === L.EFFET_VIELLE) {
    const charmes = L.charmesVivants(villageoisAPlat(), lireEtat().ambigusSecret.charmes);
    await envoyerSecret(chambriere, { texte: charmes.length ? t("LAKOUR_LOUPS.Ambigus.DejaCharmes", { noms: nomsDe(charmes) }) : t("LAKOUR_LOUPS.Ambigus.PersonneCharme") });
  }
  if (campDe(acteur) === "meute" && campAvant !== "meute") { await envoyerMasques(acteur); await envoyerSecretsDeMeute(acteur); await presenterALaMeute(chambriere); }
  return true;
}

// Les cartes du Bateleur possibles dans ce contenu, hors des cartes au paquet (enJeu : clés) : [{ cle, nom, img }].
async function cartesPossiblesDuBateleur(enJeu = []) {
  const c = await contenuDisponible();
  const descriptions = [];
  for (const [cle, uuid] of c.roles) {
    const doc = await fromUuid(uuid);
    if (!doc) continue;
    descriptions.push({ cle, nom: doc.name, img: doc.img ?? "", camp: doc.system?.camp ?? "village", nuit: doc.system?.nuit ?? {}, effet: doc.system?.effet ?? "",
      groupe: c.equilibre.roles?.[cle]?.groupe, surDemande: c.equilibre.roles?.[cle]?.surDemande });
  }
  const possibles = L.rolesDuBateleur(descriptions, enJeu);
  return descriptions.filter(d => possibles.includes(d.cle)).map(({ cle, nom, img }) => ({ cle, nom, img }));
}

// Les annonces publiques d'un paquet du Pacte (à la distribution) : les cartes du Bateleur, le jour du Feu follet, les deux bords
// de l'Illuminé. Des faits que la table voit ; aucun nom de joueur n'y est lié à un rôle.
function annoncesDesAmbigus(etat) {
  const a = etat.ambigus;
  const textes = [];
  if (a.bateleur.length) textes.push(t("LAKOUR_LOUPS.Ambigus.CartesDuBateleur", { roles: a.bateleur.map(c => c.nom).join(", ") }));
  if (a.commenceParLeJour) textes.push(t("LAKOUR_LOUPS.Ambigus.CommenceParLeJour"));
  if (a.groupes) textes.push(t("LAKOUR_LOUPS.Ambigus.Groupes", { critere: t(`LAKOUR_LOUPS.Ambigus.Critere.${a.groupes.critere}`), a: nomsDe(a.groupes.a), b: nomsDe(a.groupes.b) }));
  return textes;
}

// ------------------------------------------------------------------ la variante « Le Village » (logique/personnalites.mjs)
// Tout y est public : chat, Registre (type « village »), hook lakourLoups.village ({ quoi, acteurId?, ids?, cle? }).
const nomDuBatiment = cle => (game.i18n.has(`LAKOUR_LOUPS.Batiments.${cle}`) ? t(`LAKOUR_LOUPS.Batiments.${cle}`) : cle);
const nomDePersonnalite = p => (p ? t(`LAKOUR_LOUPS.Village.Personnalites.${p}.Nom`) : "");
// Un fait public de la variante : journal, Registre, chat, hook. entree : { quoi, acteurId?, ids?, cle? }.
async function annoncerAuVillage(texte, entree = null) {
  await modifierEtat(e => {
    if (entree) L.inscrire(e, { type: "village", ...entree });
    return L.journaliser(e, texte);
  });
  await annonceChat(echapper(texte));
  if (entree) annoncer("lakourLoups.village", [{ ...entree }]);
}

// La distribution des bâtiments, annoncée à tous : qui tient quoi (sa personnalité), et les Chemineaux.
function texteDuVillage(etat) {
  const lignes = Object.entries(etat.tenures).filter(([cle, id]) => id && L.estDuVillage(cle))
    .map(([cle, id]) => t("LAKOUR_LOUPS.Village.Ligne", { nom: nomDe(id), batiment: nomDuBatiment(cle), personnalite: nomDePersonnalite(L.personnaliteDuBatiment(cle)) }));
  const sans = L.chemineaux(etat, villageoisAPlat()).map(nomDe);
  return [t("LAKOUR_LOUPS.Village.Annonce", { lignes: lignes.join(" ; ") || "—" }),
    sans.length ? t("LAKOUR_LOUPS.Village.Chemineaux", { noms: sans.join(", ") }) : ""].filter(Boolean).join(" ");
}

// Le Hobereau : après un vote d'exécution, chaque condamné (l'un après l'autre) peut le supplier ; il gracie, ou non. Deux demandes
// courtes (DELAI_GRACE) ; l'exécution (eliminer) attend la réponse. Le Hobereau condamné se gracie lui-même s'il le veut.
const gracesEnCours = new Map();   // condamné -> Promise<Boolean> (gracié ?)
const delaiDeGrace = () => Math.min(reglage("delaiChoix") * 1000, L.DELAI_GRACE);
function proposerLaGrace(resultat) {
  gracesEnCours.clear();
  const etat = lireEtat();
  if (!L.villageActif(etat) || !resultat || resultat.objet !== "execution" || resultat.departage?.enAttente || !(resultat.elus ?? []).length) return;
  if (!L.porteur(etat, "manoir", villageoisAPlat())) return;
  let chaine = Promise.resolve();
  for (const condamne of resultat.elus) {
    const p = chaine.then(() => demanderLaGrace({ partie: etat.partie, numero: resultat.numero, condamne })).catch(err => {
      console.warn(`${ID} | grâce du Hobereau`, err);
      return false;
    });
    gracesEnCours.set(condamne, p);
    chaine = p;
  }
}
async function demanderLaGrace({ partie, numero, condamne }) {
  const h = L.porteur(lireEtat(), "manoir", villageoisAPlat());
  if (lireEtat().partie !== partie || !h || !game.actors.get(condamne)?.system.vivant) return false;
  const nomH = nomDe(h), nomC = nomDe(condamne);
  if (h !== condamne) {
    const [supplique] = await demandeLibre({ acteurId: condamne, invite: t("LAKOUR_LOUPS.Village.InviteSupplique", { nom: nomH }), candidats: [h], nombre: 1,
      delai: delaiDeGrace(), objet: "supplique" });
    if (supplique !== h) return false;
    await annoncerAuVillage(t("LAKOUR_LOUPS.Village.Supplique", { nom: nomC, hobereau: nomH }));
  }
  const [choix] = await demandeLibre({ acteurId: h, invite: t(h === condamne ? "LAKOUR_LOUPS.Village.InviteGraceSoi" : "LAKOUR_LOUPS.Village.InviteGrace", { nom: nomC }),
    candidats: [condamne], nombre: 1, delai: delaiDeGrace(), objet: "grace" });
  const avant = lireEtat();
  if (avant.partie !== partie || L.porteur(avant, "manoir", villageoisAPlat()) !== h) return false;
  if (choix !== condamne) {
    if (h !== condamne) await annoncerAuVillage(t("LAKOUR_LOUPS.Village.GraceRefusee", { nom: nomC, hobereau: nomH }));
    return false;
  }
  await modifierEtat(e => L.gracierParLeHobereau(e, { acteurId: condamne, par: h, numero }));
  await annoncerAuVillage(t("LAKOUR_LOUPS.Village.Grace", { nom: nomC, hobereau: nomH }), { quoi: "grace", acteurId: h, ids: [condamne] });
  return true;
}
// Le condamné a-t-il été gracié par le Hobereau ? (eliminer, cause « vote » : attend la réponse, au plus deux fenêtres)
async function graceDuHobereau(acteurId) {
  const p = gracesEnCours.get(acteurId);
  if (!p) return false;
  gracesEnCours.delete(acteurId);
  return Boolean(await p);
}

// Le Cabaretier : son vote, rendu public dès qu'il le pose (sur table, il vote seul, avant les autres) ; puis, s'il a voté contre un
// joueur que le vote désigne, son immunité perdue.
async function publierLeVoteDuCabaretier(votant, cible, numero) {
  if (!cible || L.cabaretierImmunise(lireEtat(), villageoisAPlat()) !== votant || lireEtat().vote.objet !== "execution") return;
  await modifierEtat(e => { e.village = { ...e.village, cabaret: { numero, cible } }; return e; });
  await annoncerAuVillage(t("LAKOUR_LOUPS.Village.VoteCabaret", { nom: nomDe(votant), cible: nomDe(cible) }));
}
async function perdreLImmunite(resultat) {
  const c = L.cabaretierQuiPerd(lireEtat(), resultat);
  if (!c) return;
  await modifierEtat(e => L.marquerEpuise(e, "cabaret", c));
  await annoncerAuVillage(t("LAKOUR_LOUPS.Village.ImmunitePerdue", { nom: nomDe(c), cible: nomDe(resultat.votes[c]) }), { quoi: "cabaret", acteurId: c, ids: [resultat.votes[c]] });
}

// Le dernier Métayer mort : plus de Bailli (la charge est abolie, une succession ouverte se ferme).
async function abolirSansMetayer(mortId, etaitMetayer) {
  const e = lireEtat();
  if (!etaitMetayer || !L.villageActif(e) || !e.bailli.actif || L.metayersDe(e, villageoisAPlat()).length) return;
  const texte = t("LAKOUR_LOUPS.Village.BailliAboli", { nom: nomDe(mortId) });
  await modifierEtat(x => {
    x.bailli = { ...x.bailli, actif: false, acteurId: "", succession: null };
    L.inscrire(x, { type: "bailli", acteurId: "", comment: "metayers", de: mortId });
    return L.journaliser(x, texte);
  });
  const posthume = demandeOuverte("succession");
  if (posthume) terminer(posthume, [], true);
  await annonceChat(echapper(texte));
  annoncer("lakourLoups.bailli", [{ acteurId: "", comment: "abolie", de: mortId }]);
}

// Les bâtiments brûlés par l'Incendiaire, au matin : détruits pour toujours, leur occupant devient Chemineau. -> [texte] (annonces)
async function brulerLesBatiments(incendies = []) {
  const textes = [];
  for (const x of incendies) {
    const texte = t("LAKOUR_LOUPS.Village.Incendie", { batiment: nomDuBatiment(x.batiment), nom: nomDe(x.occupant) });
    await modifierEtat(e => {
      L.detruire(e, [x.batiment]);
      L.inscrire(e, { type: "village", quoi: "incendie", acteurId: x.occupant, cle: x.batiment });
      return e;
    });
    annoncer("lakourLoups.village", [{ quoi: "incendie", acteurId: x.occupant, cle: x.batiment }]);
    textes.push(texte);
    if (x.loup) textes.push(t("LAKOUR_LOUPS.Village.IncendieProie", { nom: nomDe(x.occupant), loup: nomDe(x.loup) }));
  }
  return textes;
}

// Le Prévôt : chaque bâtiment libéré (etat.village.attente), l'un après l'autre, quand toutes les morts de la nuit sont tombées. Il
// choisit un Chemineau vivant (ou passe) ; le Chemineau accepte (ou refuse). Sans Prévôt vivant (ou sans sagesse), sans Chemineau,
// le bâtiment reste vide. Une à la fois, sans bloquer qui l'appelle (comme la succession du Bailli).
let vacances = Promise.resolve();
function suivreVacances() {
  if (mortsDeLaNuit || !L.normaliserVillage(lireEtat().village).attente.length) return vacances;
  vacances = vacances.then(menerVacances).catch(e => console.warn(`${ID} | logements du Prévôt`, e));
  return vacances;
}
// Pour les essais et les outils qui doivent attendre les logements en cours.
export const attendreVacances = () => vacances;
async function menerVacances() {
  for (let i = 0; i < 20; i++) {
    const avant = lireEtat();
    const cle = L.normaliserVillage(avant.village).attente[0];
    if (!cle || !avant.partie || avant.vainqueur || avant.phase === "fin") return;
    const prevot = L.porteur(avant, "prevote", villageoisAPlat());
    const sans = L.chemineaux(avant, villageoisAPlat());
    const batiment = nomDuBatiment(cle), personnalite = nomDePersonnalite(L.personnaliteDuBatiment(cle));
    let choisi = "", accepte = false;
    if (prevot && sans.length && !L.occupant(avant, cle)) {
      [choisi = ""] = await demandeLibre({ acteurId: prevot, invite: t("LAKOUR_LOUPS.Village.InvitePrevot", { batiment, personnalite }), candidats: sans, nombre: 1, objet: "prevot" });
      if (choisi) {
        const [oui] = await demandeLibre({ acteurId: choisi, invite: t("LAKOUR_LOUPS.Village.InviteLogement", { batiment, personnalite, nom: nomDe(prevot) }),
          candidats: [choisi], nombre: 1, objet: "logement" });
        accepte = oui === choisi;
      }
    }
    let fait = false;
    await modifierEtat(e => {
      if (e.partie !== avant.partie) return e;
      const vivants = villageoisAPlat();
      fait = accepte && L.porteur(e, "prevote", vivants) === prevot && L.chemineaux(e, vivants).includes(choisi) && !L.occupant(e, cle)
        && !L.normaliserVillage(e.village).detruits.includes(cle);
      if (fait) L.installer(e, cle, choisi);
      else L.sortirDeLAttente(e, cle);
      return e;
    });
    if (fait) {
      await annoncerAuVillage(t("LAKOUR_LOUPS.Village.Installation", { prevot: nomDe(prevot), nom: nomDe(choisi), batiment, personnalite }),
        { quoi: "installation", acteurId: choisi, cle, ids: [prevot] });
    } else if (choisi) {
      await annoncerAuVillage(t("LAKOUR_LOUPS.Village.Refus", { nom: nomDe(choisi), batiment }), { quoi: "refus", acteurId: choisi, cle });
    } else if (prevot && sans.length) {
      await annoncerAuVillage(t("LAKOUR_LOUPS.Village.Vide", { batiment, prevot: nomDe(prevot) }));
    }
    await sceller();
  }
}

// ------------------------------------------------------------------ les variantes du jeu de soirée (logique/variantes.mjs, Pacte étape 5)
// Les règles de la veillée sont publiques (etat.variantes, annoncées à la distribution) ; leurs secrets (les chandelles soufflées par
// chaque loup, les murmures de la nuit SANS auteur, les envoûtés, le triangle des Vendanges, les cartes de Double visage) vivent dans
// etat.variantesSecret et au carnet des seuls concernés. Hook PUBLIC lakourLoups.variante : { quoi, tour?, ids?, acteurId? }, jamais
// un auteur du mur ni un envoûté.
const variantesDuReglage = () => L.choixDesVariantes(Object.fromEntries(L.CLES_DES_VARIANTES.map(c =>
  [c, lireReglage(L.REGLAGES_DES_VARIANTES[c], c === "doubleVisage" ? "" : false)])));
// Les variantes voulues : celles données (même partiellement : le reste suit les réglages), sinon les réglages.
const variantesVoulues = variantes => (variantes && typeof variantes === "object"
  ? L.choixDesVariantes({ ...variantesDuReglage(), ...variantes }) : variantesDuReglage());
// Le choix explicite du MJ est retenu par les réglages (« Rejouer » le reprend), comme Le Village.
async function retenirLesVariantes(variantes) {
  if (!variantes || typeof variantes !== "object") return;
  const choix = L.choixDesVariantes({ ...variantesDuReglage(), ...variantes });
  for (const c of L.CLES_DES_VARIANTES) {
    if (!(c in variantes)) continue;
    const cle = L.REGLAGES_DES_VARIANTES[c];
    if (lireReglage(cle, c === "doubleVisage" ? "" : false) !== choix[c]) await game.settings.set(ID, cle, choix[c]);
  }
}
const nomDeVariante = c => t(`LAKOUR_LOUPS.Variantes.${c === "doubleVisage" ? "DoubleVisage" : c.charAt(0).toUpperCase() + c.slice(1)}.Nom`);
// Les variantes de la veillée, annoncées à tous (une règle de la veillée, jamais un secret).
function texteDesVariantes(etat) {
  const v = etat.variantes;
  const noms = L.variantesEnJeu(etat).map(c => (c === "doubleVisage" ? `${nomDeVariante(c)} (${t(`LAKOUR_LOUPS.Variantes.DoubleVisage.${v.doubleVisage}`)}${v.allegeanceLoup ? `, ${t("LAKOUR_LOUPS.Variantes.DoubleVisage.AllegeanceLoup")}` : ""})`
    : c === "chandelles" && v.angoissante ? `${nomDeVariante(c)} (${t("LAKOUR_LOUPS.Variantes.Chandelles.Angoissante")})` : nomDeVariante(c)));
  return noms.length ? t("LAKOUR_LOUPS.Variantes.Annonce", { noms: noms.join(", ") }) : "";
}
// Un fait public d'une variante : journal, Registre (« variante »), chat, hook.
async function annoncerUneVariante(texte, entree = null) {
  await modifierEtat(e => {
    if (entree) L.inscrire(e, { type: "variante", ...entree });
    return L.journaliser(e, texte);
  });
  await annonceChat(echapper(texte));
  if (entree) annoncer("lakourLoups.variante", [{ ...entree }]);
}
// Le nom d'une carte (Double visage), dans la langue du monde.
async function nomsDesCartes() {
  try { const c = await contenuDisponible(); return cle => c.noms.get(cle) ?? cle; } catch { return cle => cle; }
}

// Double visage : à la distribution, chacun reçoit en secret ses cartes (l'allégeance, ou ses deux cartes) ; petite complication, le
// rôle visible est retourné devant tous (sans camp : revelerPubliquement sansCamp).
async function montrerLesVisages(ids) {
  const etat = lireEtat();
  const mode = L.doubleVisage(etat);
  if (!mode) return;
  const nom = await nomsDesCartes();
  for (const id of ids) {
    const f = L.normaliserFiche(etat.fiches?.[id]);
    const cartes = etat.variantesSecret.cartes[id] ?? [];
    await envoyerSecret(id, { texte: mode === "grande"
      ? t("LAKOUR_LOUPS.Variantes.DoubleVisage.CarnetGrande", { cartes: cartes.map(nom).join(", "), camp: libelleCamp(f.camp) })
      : t("LAKOUR_LOUPS.Variantes.DoubleVisage.CarnetPetite", { allegeance: nom(f.camp === "meute" ? L.CARTE_LOUP : L.CARTE_VILLAGEOIS), camp: libelleCamp(f.camp) }) });
    if (mode !== "petite" || !f.role) continue;
    await revelerPubliquement(id, { sansCamp: true });
    const texte = t("LAKOUR_LOUPS.Variantes.DoubleVisage.Visible", { nom: nomDe(id), role: f.role.name });
    await modifierEtat(e => L.journaliser(e, texte));
    await annonceChat(echapper(texte));
  }
}

// La Chaîne des innocents : menée par le système, une désignation après l'autre (demande courte au désignateur ; sans réponse, le
// sort désigne à sa place), chacune annoncée ; cloreVote attend qu'elle soit finie.
let chaineEnCours = Promise.resolve();
function lancerLaChaine(numero) {
  const tache = (async () => {
    for (let i = 0; i < 200; i++) {
      const etat = lireEtat();
      const c = L.chaineEnCours(etat);
      if (!c || c.numero !== numero || c.condamne || !etat.vote.ouvert || etat.vote.numero !== numero) break;
      const candidats = L.candidatsDeLaChaine(c);
      if (!candidats.length) break;
      const par = c.designateur;
      const [choix = ""] = game.actors.get(par)?.system.vivant
        ? await demandeLibre({ acteurId: par, invite: t("LAKOUR_LOUPS.Variantes.Chaine.Invite"), candidats, nombre: 1, objet: "chaine" }) : [];
      const hasard = !candidats.includes(choix);
      const cible = hasard ? candidats[Math.floor(Math.random() * candidats.length)] : choix;
      let r = null;
      await modifierEtat(e => { r = L.designerDansLaChaine(e, { par, cible, hasard }); return e; });
      if (!r?.ok) break;
      const texte = t(hasard ? "LAKOUR_LOUPS.Variantes.Chaine.Sort" : "LAKOUR_LOUPS.Variantes.Chaine.Assis", { qui: nomDe(par), nom: nomDe(cible) });
      await modifierEtat(e => L.journaliser(e, texte));
      await annonceChat(echapper(texte));
      annoncer("lakourLoups.variante", [{ quoi: "chaine", acteurId: cible, ids: [par] }]);
      if (r.condamne) {
        const fin = t("LAKOUR_LOUPS.Variantes.Chaine.Debout", { nom: nomDe(r.condamne) });
        await modifierEtat(e => L.journaliser(e, fin));
        await annonceChat(echapper(fin));
        break;
      }
    }
  })().catch(e => console.warn(`${ID} | chaîne des innocents`, e));
  chaineEnCours = chaineEnCours.then(() => tache);
  return tache;
}

// Les Vendanges : le Bailli vote seul, avant les autres ; son vote est public. Les compagnons attendent qu'il ait voté (au plus le
// délai de son vote) : attendreLeBailli(numero).
const bailliAttendu = new Map();   // numero du vote -> { promesse, resoudre }
function attendreLeBailli(numero) {
  return bailliAttendu.get(numero)?.promesse ?? Promise.resolve();
}
function poserLAttenteDuBailli(vote) {
  const b = vote?.bailliDabord;
  if (!b?.acteurId) return;
  let resoudre;
  const promesse = new Promise(r => { resoudre = r; });
  const minuterie = setTimeout(() => resoudre(), Math.max(0, Number(b.jusqua) - Date.now()));
  bailliAttendu.set(vote.numero, { promesse, resoudre: () => { clearTimeout(minuterie); resoudre(); } });
}
async function publierLeVoteDuBailli(votant, cible, numero) {
  const v = lireEtat().vote;
  if (!v.bailliDabord || v.bailliDabord.acteurId !== votant || v.numero !== numero) return;
  if (v.bailliVote !== undefined) return;
  await modifierEtat(e => { e.vote = { ...e.vote, bailliVote: cible || "" }; return e; });
  bailliAttendu.get(numero)?.resoudre();
  const texte = cible ? t("LAKOUR_LOUPS.Variantes.Vendanges.BailliVote", { nom: nomDe(votant), cible: nomDe(cible) })
    : t("LAKOUR_LOUPS.Variantes.Vendanges.BailliPasse", { nom: nomDe(votant) });
  await annoncerUneVariante(texte, { quoi: "bailli", acteurId: votant, ids: cible ? [cible] : [] });
}
// Les amoureux de chacun (fiches) : les votes interdits par l'amour aux Vendanges.
const amoureuxDeTous = etat => Object.fromEntries(Object.entries(etat.fiches ?? {}).map(([id, f]) => [id, L.normaliserFiche(f).amoureux]));
const voteInterdit = (etat, votant, cible) => L.vendangesActives(etat)
  && L.voteInterditParLAmour({ triangle: L.triangleDe(etat), amoureux: amoureuxDeTous(etat), votant, cible });

// L'Envoûtement : les envoûtés de la nuit perdent tout pouvoir (leur fiche garde la carte, sans pouvoir ; la seconde carte s'en va).
async function envouterLesProies(ids, tour) {
  if (!ids.length) return;
  await modifierEtat(e => {
    L.envouter(e, ids, tour);
    for (const id of ids) majFiche(e, id, f => { const { seconde, ...reste } = f; return { ...reste, role: L.roleEnvoute(f.role) }; });
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Variantes.Envoutement.Journal", { noms: ids.map(nomDe).join(", ") }));
  });
}
// Une envoûtée condamnée par le village : toutes celles d'avant elle tombent avec elle (cause publique « envoute »).
async function chuteDesEnvoutes(acteurId) {
  const avant = L.envoutesPrecedents(lireEtat(), acteurId).filter(id => game.actors.get(id)?.system.vivant);
  if (!avant.length) return [];
  await annoncerUneVariante(t("LAKOUR_LOUPS.Variantes.Envoutement.Chute", { nom: nomDe(acteurId), noms: avant.map(nomDe).join(", ") }),
    { quoi: "envoutement", acteurId, ids: avant });
  const morts = [];
  for (const id of avant) morts.push(...await api.eliminer(id, { cause: L.CAUSES.envoute }));
  return morts;
}

// Le Mur des murmures : chaque vivant écrit (ou passe), en même temps, dans une fenêtre à lui ; les phrases entrent au secret sans
// leur auteur. L'étape est notée sans acteur (etapes.mjs la sait faite).
async function reveillerLeMur(entree, { delai }) {
  reveilsEnCours.add(L.CLE_MUR);
  Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_MUR, enCours: true });
  try {
    await Promise.all(entree.acteurIds.map(async id => {
      const texte = await api.demanderTexte({ acteurId: id, invite: t("LAKOUR_LOUPS.Variantes.Mur.Invite"), delai, max: L.LONGUEUR_MURMURE });
      if (texte) await modifierEtat(e => L.graverUnMurmure(e, texte));
    }));
    await modifierEtat(e => L.ajouterAction(e, { acteurId: "", roleCle: L.CLE_MUR, cibles: [] }));
  } finally {
    reveilsEnCours.delete(L.CLE_MUR);
    Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_MUR, enCours: false });
  }
  return { roleCle: L.CLE_MUR, acteurIds: [...entree.acteurIds], cibles: [], texte: "" };
}

// ------------------------------------------------------------------ bâtiments et métiers d'une partie (Pacte, étape 5)
// Les bâtiments du village : réglage « batimentsDuVillage » — "hasard" (par défaut : ceux de la composition), "aucun" (une partie simple,
// sans bâtiment : rien n'en dépend, les repères de la carte restent inertes) ou "choisis" (réglage « batimentsChoisis » : [cle]). Les métiers :
// réglage « metiersEnJeu » (vrai par défaut). Une composition -> la même, bâtiments selon le réglage.
const MODES_BATIMENTS = ["hasard", "aucun", "choisis"];
function batimentsDuReglage(compo) {
  const mode = lireReglage("batimentsDuVillage", "hasard");
  if (!compo || mode === "hasard" || !MODES_BATIMENTS.includes(mode)) return compo;
  return { ...compo, batiments: mode === "aucun" ? [] : [...new Set((lireReglage("batimentsChoisis", []) ?? []).map(String))] };
}
// batiments : "hasard" | "aucun" | [cle] (choisis) ; metiers : Boolean. Un choix donné est retenu par les réglages.
async function retenirBatimentsEtMetiers({ batiments, metiers } = {}) {
  if (Array.isArray(batiments)) {
    await game.settings.set(ID, "batimentsChoisis", [...new Set(batiments.map(String))]);
    if (lireReglage("batimentsDuVillage", "hasard") !== "choisis") await game.settings.set(ID, "batimentsDuVillage", "choisis");
  } else if (MODES_BATIMENTS.includes(batiments) && lireReglage("batimentsDuVillage", "hasard") !== batiments) {
    await game.settings.set(ID, "batimentsDuVillage", batiments);
  }
  if (typeof metiers === "boolean" && lireReglage("metiersEnJeu", true) !== metiers) await game.settings.set(ID, "metiersEnJeu", metiers);
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
  if (source === "tenure") return t(`LAKOUR_LOUPS.Village.Personnalites.${L.personnaliteDuBatiment(pouvoir)}.Aide`);
  if (source === "charge") return t(`LAKOUR_LOUPS.Gazette.Pouvoirs.${pouvoir}.Aide`);
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
  chaineEnCours = Promise.resolve();
  succession = Promise.resolve();
  mortsDeLaNuit = false;
  departageEnCours = null;
  gestes = Promise.resolve();
  gestesDemandes.clear();
  devouement = null;
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

// Les noms du rôle simple de chaque camp dans ce monde (la Liseuse de cendres les lit derrière une apparence : le Loup déguisé
// paraît « Villageois ») : ceux du contenu installé ; à défaut, ceux de la logique (NOMS_APPARENTS).
async function nomsApparents(contenu = null) {
  try {
    const c = contenu ?? await contenuDisponible();
    return Object.fromEntries([["village", c.noms.get("villageois")], ["meute", c.noms.get("loup-de-brumecombe")]].filter(([, n]) => n));
  } catch { return {}; }
}

const lireReglage = (cle, defaut) => { try { return game.settings.get(ID, cle) ?? defaut; } catch { return defaut; } };

// ------------------------------------------------------------------ la Petite tablée (logique/tablee.mjs)
// La parité stricte (la meute doit être plus nombreuse) : en petite tablée, au régime des deux loups (8 places et plus).
const pariteStricte = e => Boolean(e?.petiteTablee) && L.pariteStricteTablee(e.places || villageoisAPlat().length);
// Une composition prête du contenu est-elle de la Petite tablée (son niveau) ?
async function compositionDeTablee(composition) {
  if (!composition || composition === "generee" || composition === "choisie") return false;
  try { return (await contenuDisponible()).compositions[composition]?.niveau === L.NIVEAU_PETITE_TABLEE; } catch { return false; }
}
// Le tirage contraint d'une petite tablée (distribuerTablee) : chaque rôle décrit par son camp et s'il informe (équilibre du
// contenu), les loups d'une peste noire comptés comme de simples villageois. humains : les places des joueurs humains.
async function tirageDeTablee({ roles, metiers, places, maisons, graine, cache, peste, humains }) {
  let equilibre = { roles: {} };
  try { ({ equilibre } = await contenuDisponible()); } catch { /* sans équilibre : le camp des documents suffit */ }
  const decrire = uuid => {
    const s = cache.get(uuid)?.system ?? {};
    const camp = peste && s.camp === "meute" ? "village" : s.camp || "village";
    return { camp, information: Boolean(equilibre.roles?.[s.cle]?.information) };
  };
  const r = L.distribuerTablee({ roles, metiers, joueurs: places, maisons, humains: new Set(humains), decrire, graine });
  if (r.manques.length) console.warn(`${ID} | petite tablée : partage des camps impossible avec ces rôles (${r.manques.length} règle(s))`);
  return r;
}
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

// ------------------------------------------------------------------ la victoire, une vérification à la fois
// sousVerrou(fn) : fn ne court qu'après les précédentes (la victoire vérifiée, un dernier geste appliqué) ; une erreur ne bloque
// pas les suivantes.
let verrou = Promise.resolve();
function sousVerrou(fn) {
  const suite = verrou.then(fn);
  verrou = suite.catch(() => {});
  return suite;
}

// La vérification elle-même (api.verifierVictoire la passe sous le verrou).
const victoire = {
  async verifier({ finDuJour = false } = {}) {
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
    // Petite tablée, régime des deux loups : la meute doit être plus nombreuse que les autres (strict).
    const g = L.verifierVictoire({ ...L.contexteDesAmbigus(e), ...L.contexteDesVariantes(e), villageois: villageoisAPlat(), glas, morts: e.morts, primes: e.primes, peste: e.peste, saintMartin, strict: pariteStricte(e) });
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
      await finDeLaGazette(etat, g);
      diffuserVus();
      await sceller();
    }
    return g;
  }
};

// ------------------------------------------------------------------ la Gazette de la lune (logique/gazette.mjs, Le Pacte, étape 9)
// Les traits visibles (publics) sont tirés à la distribution. La Gazette, le Crieur public, l'Exécuteur et le Spiritisme vivent dans
// etat.gazette (public) et etat.gazetteSecret (MJ). Ce qui attend une réponse au matin (la séance de Spiritisme, l'annonce du Crieur, le
// Châtiment) court sans bloquer l'aube (suivreLeMatin) ; la Table l'attend (réveil « gazette » en cours).
const gazetteDuReglage = () => ({ actif: Boolean(lireReglage("gazette", false)), rythme: Number(lireReglage("gazetteRythme", 1)) || 1,
  choix: Boolean(lireReglage("gazetteChoix", false)), crieur: Boolean(lireReglage("crieurPublic", false)),
  cartesDuCrieur: Number(lireReglage("cartesDuCrieur", L.CARTES_DU_CRIEUR)), permanentes: [...(lireReglage("gazettePermanentes", []) ?? [])] });
const nomDeCarte = cle => t(`LAKOUR_LOUPS.Gazette.Cartes.${cle}.Nom`);
const effetDeCarte = cle => t(`LAKOUR_LOUPS.Gazette.Cartes.${cle}.Effet`);
const nomDeSeance = cle => t(`LAKOUR_LOUPS.Gazette.Seances.${cle}`);
const texteDeQuestion = q => t(`LAKOUR_LOUPS.Gazette.Questions.${q}`);
const delaiDesChoix = () => reglage("delaiChoix") * 1000;
let matinee = Promise.resolve();
function suivreLeMatin(fn) {
  matinee = matinee.then(async () => {
    reveilsEnCours.add("gazette");
    Hooks.callAll("lakourLoups.reveil", { roleCle: "gazette", enCours: true });
    try { await fn(); } finally {
      reveilsEnCours.delete("gazette");
      Hooks.callAll("lakourLoups.reveil", { roleCle: "gazette", enCours: false });
    }
  }).catch(e => console.warn(`${ID} | gazette`, e));
  return matinee;
}
// Ce qui court encore pour la Gazette (le matin, le Crieur, le vote à tour de rôle) : pour les essais et le MJ IA.
export async function attendreGazette() {
  let avant;
  do { avant = [matinee, charge, influencesEnCours]; await Promise.all(avant); } while (avant[0] !== matinee || avant[1] !== charge || avant[2] !== influencesEnCours);
}
async function annoncerGazette(texte, entree = null) {
  await modifierEtat(e => L.journaliser(e, texte));
  // Marquée « gazette » : une carte cite des rôles en général (« la Liseuse de cendres a-t-elle… »), comme sur table ;
  // elle ne doit jamais accoler un rôle au nom de celui qui le tient en secret (essais : partie-loups.mjs, verifierMessage).
  await annonceChat(`<span class="loups-gazette"></span>${echapper(texte)}`);
  if (entree) annoncer("lakourLoups.gazette", [{ ...entree }]);
}
// Les traits d'un personnage, en clair (« femme, jeune (24 ans), lunettes, habite le bourg »).
function texteDesTraits(tr) {
  const x = L.normaliserTrait(tr);
  return [t(`LAKOUR_LOUPS.Traits.Genre.${x.genre}`), t(`LAKOUR_LOUPS.Traits.Age.${x.age}`, { ans: x.ans }),
    ...L.TRAITS_OUI_NON.filter(c => x[c]).map(c => t(`LAKOUR_LOUPS.Traits.${c}`)), t(x.bourg ? "LAKOUR_LOUPS.Traits.Bourg" : "LAKOUR_LOUPS.Traits.Ecart")].join(", ");
}
// Un trait posé à la main sur l'acteur (drapeau « traits » du système : un portrait, un genre choisi) est respecté.
const traitsImposes = acteur => { const x = acteur?.flags?.[ID]?.traits; return x && typeof x === "object" ? x : null; };

// Une carte posée (lue au matin par le dernier éliminé, par le Crieur, par le narrateur) : ses événements, son annonce, ses gestes.
async function poserUneCarte(cle, { lecteur = "", source = "gazette" } = {}) {
  let r = { annonces: [], prives: [], gestes: [] };
  await modifierEtat(e => { r = L.poserLaCarte(e, cle, { villageois: villageoisAPlat(), lecteur, source }); return e; });
  const qui = lecteur ? nomDe(lecteur) : t("LAKOUR_LOUPS.Narrateur");
  await annoncerGazette(t(source === "crieur" ? "LAKOUR_LOUPS.Gazette.LueParLeCrieur" : source === "debut" ? "LAKOUR_LOUPS.Gazette.PoseeDesLeDebut" : "LAKOUR_LOUPS.Gazette.Lue",
    { lecteur: qui, nom: nomDeCarte(cle), effet: effetDeCarte(cle) }), { quoi: "carte", cle, acteurId: lecteur, source });
  for (const m of r.annonces) await annoncerGazette(texteMessage(m));
  for (const m of r.prives) await envoyerSecret(m.destinataire, { texte: texteMessage(m), titre: nomDeCarte(cle) });
  for (const g of r.gestes) await suivreLeGeste(g);
  return cle;
}
async function suivreLeGeste(g) {
  if (g.type === "silence") { for (const id of g.ids) await game.actors.get(id)?.update({ "system.silence": true }); return; }
  if (g.type === "bailli") { annoncer("lakourLoups.bailli", [{ acteurId: "", comment: "destitue" }]); return; }
  if (g.type === "revenir") { await revenirParmiLesVivants(g.acteurId); return; }
  if (g.type === "chatiment") { suivreLeMatin(() => menerLeChatiment(g.par)); return; }
  if (g.type === "election-executeur" || g.type === "cauchemar") {
    if (lireEtat().vote.ouvert || lireEtat().vainqueur) return;
    try { await api.ouvrirVote(g.type === "cauchemar" ? {} : { objet: "executeur" }); } catch (e) { await noterPourMJ(e.message, { notifier: true }); }
  }
}

// La Revenue d'entre les vivants : la dernière victime de la meute revient, simple Villageois (public : la carte l'a dit).
async function revenirParmiLesVivants(acteurId) {
  const a = game.actors.get(acteurId);
  if (!a || a.system.vivant) return;
  let villageois = null;
  try { villageois = (await contenuDisponible()).roles.get(L.CLE_VILLAGEOIS) ?? null; } catch { villageois = null; }
  const anciens = a.items.filter(i => i.type === "role").map(i => i.id);
  if (anciens.length) await a.deleteEmbeddedDocuments("Item", anciens);
  await a.update({ "system.vivant": true, "system.revele": false, "system.camp": "" });
  try { if (a.statuses?.has("dead")) await a.toggleStatusEffect("dead", { active: false }); } catch { /* sans jeton */ }
  await modifierEtat(e => {
    e.morts = e.morts.filter(m => m.acteurId !== acteurId);
    e.cimetiere = e.cimetiere.filter(id => id !== acteurId);
    if (e.causes) delete e.causes[acteurId];
    L.inscrire(e, { type: "gazette", quoi: "revenante", acteurId });
    return e;
  });
  await api.donnerRole(acteurId, villageois ?? roleParDefaut());   // la fiche prend le camp du rôle : le Village
  await revelerPubliquement(acteurId);
  await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Revenante", { nom: a.name }), { quoi: "revenante", acteurId });
  planifierMiseEnScene();
  diffuserVus();
}

// Le Châtiment : le dernier éliminé désigne un vivant (au délai, le sort) ; le village témoigne pour lui (vote « chatiment ») ; s'il
// tarde, l'accusé lance un appel.
async function menerLeChatiment(par) {
  const vivants = vivantsIds();
  if (!vivants.length) return;
  const [choix = ""] = await demandeLibre({ acteurId: par, invite: t("LAKOUR_LOUPS.Gazette.Chatiment.Invite"), candidats: vivants, posthume: true, objet: "chatiment" });
  const accuse = vivants.includes(choix) ? choix : L.choisir(vivants) ?? "";
  if (!accuse || lireEtat().vainqueur) return;
  await annoncerGazette(t(choix ? "LAKOUR_LOUPS.Gazette.Chatiment.Designe" : "LAKOUR_LOUPS.Gazette.Chatiment.Sort", { qui: nomDe(par), nom: nomDe(accuse) }),
    { quoi: "chatiment", acteurId: accuse });
  try { await api.ouvrirVote({ objet: "chatiment", candidats: [accuse] }); } catch (e) { await noterPourMJ(e.message, { notifier: true }); return; }
  const numero = lireEtat().vote.numero;
  const [appel] = await demandeLibre({ acteurId: accuse, invite: t("LAKOUR_LOUPS.Gazette.Chatiment.InviteAppel"), candidats: [accuse],
    delai: Math.min(delaiDesChoix(), 30000), objet: "appel" });
  if (appel === accuse && lireEtat().vote.ouvert && lireEtat().vote.numero === numero) await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Chatiment.Appel", { nom: nomDe(accuse) }));
}

// Le vote à tour de rôle (les Influences, le Cauchemar) : à chacun son tour, dans l'ordre du cercle vers la gauche ; un compagnon vote
// par son cerveau ; au délai des choix, le tour passe ; le dernier passé, le vote se clôt.
let suiteDuVote = null;
function avancerLaSuite() {
  clearTimeout(suiteDuVote?.minuterie);
  const v = lireEtat().vote;
  if (!v.ouvert || v.mode !== "suite") return;
  const id = (v.ordre ?? [])[v.rang ?? 0];
  if (!id) {
    if (v.ordre?.length) api.cloreVote().catch(e => noterPourMJ(e.message, { notifier: true }));
    return;
  }
  const { numero, rang } = v;
  annonceChat(echapper(t(v.cauchemar ? "LAKOUR_LOUPS.Gazette.Suite.ACauchemar" : "LAKOUR_LOUPS.Gazette.Suite.AToi", { nom: nomDe(id) })));
  const a = game.actors.get(id);
  if (estCompagnon(a)) {
    const candidats = v.candidats.filter(c => c !== id).map(c => ({ id: c, nom: nomDe(c), img: game.actors.get(c)?.img ?? "", maison: game.actors.get(c)?.system.maison ?? "" }));
    demanderAuCompagnon({ type: "vote", id: foundry.utils.randomID(), acteurId: id, acteurNom: a.name, invite: t(v.cauchemar ? "LAKOUR_LOUPS.Gazette.Suite.InviteCauchemar" : "LAKOUR_LOUPS.Choix.InviteVote"),
      candidats, nombre: 1, delai: delaiDesChoix(), objet: "execution", numero, mode: "suite" })
      .then(([c = ""]) => { const w = lireEtat().vote; if (w.ouvert && w.numero === numero && w.rang === rang) return recevoirVote({ votant: id, cible: c, userId: game.user.id }); })
      .catch(e => console.warn(`${ID} | vote à tour de rôle`, e));
  }
  suiteDuVote = { numero, minuterie: setTimeout(async () => {
    const w = lireEtat().vote;
    if (!w.ouvert || w.numero !== numero || w.rang !== rang) return;
    await modifierEtat(e => { e.vote.votes[id] = ""; e.vote.rang = rang + 1; e.vote.exprimes = Object.keys(e.vote.votes); return e; });
    await annonceChat(echapper(t("LAKOUR_LOUPS.Gazette.Suite.Passe", { qui: nomDe(id) })));
    avancerLaSuite();
  }, delaiDesChoix()) };
}
// Les Influences : le dernier éliminé choisit le premier votant (au délai, le sort), puis chacun à sa gauche.
let influencesEnCours = Promise.resolve();
function lancerLesInfluences(numero) {
  influencesEnCours = (async () => {
    const e = lireEtat();
    const admis = L.filtrerVotants(e, vivantsIds(), "execution");
    const par = L.dernierElimine(e);
    const [choix = ""] = par ? await demandeLibre({ acteurId: par, invite: t("LAKOUR_LOUPS.Gazette.Influences.Invite"), candidats: admis, posthume: true, objet: "influences" }) : [];
    const premier = admis.includes(choix) ? choix : L.choisir(admis) ?? "";
    if (!lireEtat().vote.ouvert || lireEtat().vote.numero !== numero) return;
    await modifierEtat(x => { x.vote.ordre = L.ordreAGauche(x, villageoisAPlat(), premier, admis); x.vote.rang = 0; return x; });
    await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Influences.Premier", { qui: par ? nomDe(par) : t("LAKOUR_LOUPS.Narrateur"), nom: nomDe(premier) }));
    avancerLaSuite();
  })().catch(e => console.warn(`${ID} | influences`, e));
  return influencesEnCours;
}

// Le Crieur public : le Bailli le nomme (jamais lui-même), le garde ou le change, ou le Crieur élu Bailli transmet sa charge ; au délai,
// le sort désigne (ou, pour un nouveau Bailli, il garde le Crieur en place). Une demande à la fois.
let charge = Promise.resolve();
function suivreLeCrieur() {
  charge = charge.then(menerLeCrieur).catch(e => console.warn(`${ID} | Crieur public`, e));
  return charge;
}
async function menerLeCrieur() {
  for (let i = 0; i < 3; i++) {
    const avant = lireEtat();
    const a = L.attenteDuCrieur(avant, villageoisAPlat());
    if (!a) return;
    const [choix = ""] = await demandeLibre({ acteurId: a.par, invite: t(`LAKOUR_LOUPS.Gazette.Crieur.Invite.${a.quoi}`, { nom: nomDe(a.actuel) }),
      candidats: a.candidats, objet: `crieur-${a.quoi}` });
    const maintenant = lireEtat();
    if (maintenant.partie !== avant.partie || maintenant.bailli.acteurId !== a.bailli || !maintenant.gazette.crieur.actif) return;
    const elu = a.candidats.includes(choix) ? choix : a.quoi === "garder" ? a.actuel : L.choisir(a.candidats) ?? "";
    if (!elu) return;
    await modifierEtat(e => { L.nommerLeCrieur(e, { acteurId: elu, par: a.par }); return e; });
    const cle = a.quoi === "garder" && elu === a.actuel ? "Garde" : choix ? (a.quoi === "transmettre" ? "Transmis" : "Nomme") : "Sort";
    await annoncerGazette(t(`LAKOUR_LOUPS.Gazette.Crieur.${cle}`, { qui: nomDe(a.par), nom: nomDe(elu), ancien: nomDe(a.actuel) }), { quoi: "crieur", acteurId: elu });
    if (elu !== a.actuel) await envoyerLaMainDuCrieur(elu);
  }
}
// Les cartes de la charge, au carnet du (nouveau) Crieur : secrètes.
async function envoyerLaMainDuCrieur(acteurId) {
  const main = L.normaliserGazetteSecret(lireEtat().gazetteSecret).main;
  if (!acteurId || !game.actors.get(acteurId)) return;
  await envoyerSecret(acteurId, { titre: t("LAKOUR_LOUPS.Gazette.Crieur.Titre"),
    texte: main.length ? t("LAKOUR_LOUPS.Gazette.Crieur.Main", { cartes: main.map(c => `${nomDeCarte(c)} (${effetDeCarte(c)})`).join(" ; ") }) : t("LAKOUR_LOUPS.Gazette.Crieur.MainVide") });
}
// Le matin : le Crieur a-t-il une annonce ? Une carte lue s'applique aussitôt ; ne rien choisir, c'est se taire.
async function annonceDuCrieur() {
  const avant = lireEtat();
  if (!L.annonceDuCrieurDue(avant, villageoisAPlat())) return;
  const crieur = avant.gazette.crieur.acteurId;
  await modifierEtat(e => { const g = L.normaliserGazette(e.gazette); g.crieur.annonce = e.tour; e.gazette = g; return e; });
  const main = L.normaliserGazetteSecret(lireEtat().gazetteSecret).main;
  const [carte = ""] = await demandeLibre({ acteurId: crieur, invite: t("LAKOUR_LOUPS.Gazette.Crieur.InviteAnnonce"),
    candidats: main.map(c => ({ id: c, nom: `${nomDeCarte(c)} — ${effetDeCarte(c)}`, img: "" })), objet: "crieur-annonce" });
  if (!main.includes(carte) || lireEtat().vainqueur) { await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Crieur.Rien", { nom: nomDe(crieur) })); return; }
  await modifierEtat(e => {
    const s = L.normaliserGazetteSecret(e.gazetteSecret);
    s.main = s.main.filter(c => c !== carte);
    e.gazetteSecret = s;
    const g = L.normaliserGazette(e.gazette);
    g.crieur.cartes = s.main.length;
    e.gazette = g;
    return e;
  });
  await poserUneCarte(carte, { lecteur: crieur, source: "crieur" });
}

// Le Spiritisme : la Liseuse d'étoiles a dit oui cette nuit ; au matin, la carte (ses 4 questions), la question qu'elle choisit, le
// Spirite qu'elle désigne, ceux qu'il désigne, et la réponse de l'esprit du premier mort (calculée par le système, jamais un mensonge).
async function seanceDeSpiritisme() {
  const e = lireEtat();
  const s = L.seanceDuMatin(e);
  if (!s || e.vainqueur) return;
  await modifierEtat(x => { x.gazetteSecret = { ...L.normaliserGazetteSecret(x.gazetteSecret), seance: null }; return x; });
  const liseuse = game.actors.get(s.par);
  const mort = L.premierMort(e);
  const restantes = L.normaliserGazette(e.gazette).spiritisme.restantes;
  if (!liseuse?.system.vivant || !restantes.length) return;
  if (!mort) { await envoyerSecret(s.par, { texte: t("LAKOUR_LOUPS.Gazette.Spiritisme.SansMort") }); return; }
  const carte = L.choisir(restantes);
  const questions = L.SEANCES[carte];
  await modifierEtat(x => { const g = L.normaliserGazette(x.gazette); g.spiritisme.restantes = g.spiritisme.restantes.filter(c => c !== carte); x.gazette = g; return x; });
  await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Spiritisme.Carte", { nom: nomDeSeance(carte), mort: nomDe(mort),
    questions: questions.map((q, i) => `${i + 1}. « ${texteDeQuestion(q)} »`).join(" ") }), { quoi: "seance", cle: carte });
  const [q = ""] = await demandeLibre({ acteurId: s.par, invite: t("LAKOUR_LOUPS.Gazette.Spiritisme.InviteQuestion"),
    candidats: questions.map((x, i) => ({ id: x, nom: `${i + 1}. ${texteDeQuestion(x)}`, img: "" })), objet: "seance-question" });
  const question = questions.includes(q) ? q : L.choisir(questions);
  const vivants = vivantsIds();
  // Le Spirite pose la question à voix haute : un absent du jour (Petit Commis parti, danseurs, chasseurs, cueilleuses) ne
  // participe pas aux débats, il ne peut pas l'être (choix tranché le 7 nov. : le livre ne dit rien) ; il reste désignable.
  const absents = new Set(L.absentsDuJour(lireEtat()));
  const presents = vivants.filter(id => !absents.has(id));
  const [sp = ""] = await demandeLibre({ acteurId: s.par, invite: t("LAKOUR_LOUPS.Gazette.Spiritisme.InviteSpirite"), candidats: presents, objet: "seance-spirite" });
  const spirite = presents.includes(sp) ? sp : presents.includes(s.par) ? s.par : (presents[0] ?? s.par);
  const n = L.DESIGNATIONS_DES_QUESTIONS[question] ?? 0;
  let designes = [];
  if (n) {
    const choix = await demandeLibre({ acteurId: spirite, invite: t("LAKOUR_LOUPS.Gazette.Spiritisme.InviteDesigner", { n, question: texteDeQuestion(question) }),
      candidats: vivants, nombre: n, objet: "seance-designer" });
    designes = [...new Set(choix.filter(id => vivants.includes(id)))].slice(0, n);
    for (const id of L.melanger(vivants.filter(id => !designes.includes(id)))) if (designes.length < n) designes.push(id);
  }
  const reponse = L.reponseDeLEsprit({ question, etat: lireEtat(), villageois: villageoisAPlat(), spirite, designes });
  const humain = Boolean(game.actors.get(mort)?.system.joueur);
  await modifierEtat(x => {
    const g = L.normaliserGazette(x.gazette);
    g.spiritisme.derniere = { tour: x.tour, carte, question, spirite, designes, reponse, mort };
    x.gazette = g;
    L.inscrire(x, { type: "gazette", quoi: "reponse", cle: carte, acteurId: spirite, ids: designes, reponse });
    return x;
  });
  await annoncerGazette(t(humain ? "LAKOUR_LOUPS.Gazette.Spiritisme.ReponseHumain" : "LAKOUR_LOUPS.Gazette.Spiritisme.Reponse", { spirite: nomDe(spirite), mort: nomDe(mort),
    question: texteDeQuestion(question), designes: designes.length ? t("LAKOUR_LOUPS.Gazette.Spiritisme.Designes", { noms: nomsDe(designes) }) : "",
    reponse: t(reponse ? "LAKOUR_LOUPS.Gazette.Oui" : "LAKOUR_LOUPS.Gazette.Non") }), { quoi: "reponse", acteurId: spirite, ids: designes });
}

// Le matin, après les morts de la nuit : la fin du tour précédent (les pouvoirs des sots rendus, la variante d'un jour levée), le
// Somnambule, le retour du Petit Commis, la carte du jour ; puis, sans bloquer l'aube, la séance de Spiritisme et l'annonce du Crieur.
async function matinDeLaGazette() {
  const avant = lireEtat();
  if (avant.vainqueur || avant.phase === "fin") return;
  let fin = { rendus: [], variante: "" };
  await modifierEtat(e => { fin = L.finDuTourDeLaGazette(e, e.tour); return e; });
  for (const id of fin.rendus) await envoyerSecret(id, { texte: t("LAKOUR_LOUPS.Gazette.Sots.Rendu") });
  if (fin.variante) await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Variante.Levee", { nom: nomDeVariante(fin.variante) }));
  const e = lireEtat();
  if (L.cartePosee(e, "somnambule") && villageoisAPlat().some(v => v.role?.cle === "liseuse-de-cendres")) {
    const noms = await nomsApparents();
    const lus = L.rolesLusParLaLiseuse(e.nuitPrecedente.actions, villageoisAPlat(), v => L.roleApparent(v, noms).nom);
    await annoncerGazette(lus.length ? t("LAKOUR_LOUPS.Gazette.Somnambule.Matin", { roles: lus.join(", ") }) : t("LAKOUR_LOUPS.Gazette.Somnambule.Rien"));
  }
  const commis = L.normaliserGazette(e.gazette).commis;
  if (commis && commis.retour === e.tour && game.actors.get(commis.acteurId)?.system.vivant) {
    await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Commis.Retour", { nom: nomDe(commis.acteurId), n: L.POIDS_DU_COMMIS }));
  }
  if (L.tirageDu(lireEtat())) {
    let cle = "";
    await modifierEtat(x => { cle = L.prendreLaCarte(x); return x; });
    if (cle) await poserUneCarte(cle, { lecteur: L.dernierElimine(lireEtat()), source: "gazette" });
    else await annoncerGazette(t("LAKOUR_LOUPS.Gazette.PaquetVide"));
  }
  suivreLeMatin(async () => { await seanceDeSpiritisme(); await annonceDuCrieur(); });
}

// À la mort d'un condamné du vote : Pile ou face, le Marché avec le Malin (juste après le verdict). -> true s'il est épargné
async function verdictDeLaGazette(acteurId) {
  const e = lireEtat();
  if (L.carteDuJour(e, "pile-ou-face")) {
    const pile = Math.random() < 0.5;
    await annoncerGazette(t(pile ? "LAKOUR_LOUPS.Gazette.PileOuFace.Pile" : "LAKOUR_LOUPS.Gazette.PileOuFace.Face", { nom: nomDe(acteurId) }),
      { quoi: pile ? "pile" : "face", acteurId });
    if (pile) return true;
  }
  if (L.carteDuJour(e, "marche-du-malin")) {
    const [oui] = await demandeLibre({ acteurId, invite: t("LAKOUR_LOUPS.Gazette.Marche.Invite"), candidats: [acteurId], delai: Math.min(delaiDesChoix(), 30000), objet: "marche" });
    if (oui === acteurId && game.actors.get(acteurId)?.system.vivant) {
      await modifierEtat(x => { const g = L.normaliserGazette(x.gazette); g.marches.push({ acteurId, tour: x.tour }); x.gazette = g; L.inscrire(x, { type: "gazette", quoi: "marche", acteurId }); return x; });
      await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Marche.Accepte", { nom: nomDe(acteurId) }), { quoi: "marche", acteurId });
      return true;
    }
  }
  return false;
}
// Après une mort : l'Exécuteur, le Crieur ; après un vote, le Dépit et l'Enthousiasme (revote aussitôt, sans débat).
async function apresUneMortDeLaGazette(acteurId, cause, { executeur = "", cache = "" } = {}) {
  const e = lireEtat();
  const g = L.normaliserGazette(e.gazette);
  // L'Exécuteur seul apprend le rôle du condamné (son carnet) ; mort, il désigne son successeur.
  const role = L.normaliserFiche(e.fiches?.[acteurId]).role;
  if (cache === "executeur" && executeur && executeur !== acteurId && role) await envoyerSecret(executeur, { texte: t("LAKOUR_LOUPS.Gazette.Executeur.Carnet", { nom: nomDe(acteurId), role: role.name }) });
  if (g.executeur.actif && g.executeur.acteurId === acteurId) await successionDeLExecuteur(acteurId, cache === "executeur" ? role?.name ?? "" : "");
  if (g.crieur.actif && g.crieur.acteurId === acteurId) suivreLeCrieur();
  if (cause !== "vote") return;
  const consommees = ["depit", "enthousiasme"].filter(c => L.cartePosee(e, c));
  if (!consommees.length) return;
  const loup = L.normaliserFiche(e.fiches?.[acteurId]).camp === "meute";
  const due = (!loup && consommees.includes("depit")) ? "depit" : (loup && consommees.includes("enthousiasme")) ? "enthousiasme" : "";
  await modifierEtat(x => { for (const c of consommees) L.consommerLaCarte(x, c); return x; });
  if (!due) return;
  const apres = lireEtat();
  if (apres.vainqueur || L.verifierVictoire({ ...L.contexteDesAmbigus(apres), ...L.contexteDesVariantes(apres), villageois: villageoisAPlat(), morts: apres.morts,
    primes: apres.primes, peste: apres.peste, strict: pariteStricte(apres) })) return;
  await annoncerGazette(t(`LAKOUR_LOUPS.Gazette.Revote.${due}`, { nom: nomDe(acteurId) }), { quoi: due, acteurId });
  if (lireEtat().vote.ouvert) return;
  try { await api.ouvrirVote({ duree: e.vote.duree }); } catch (err) { await noterPourMJ(err.message, { notifier: true }); }
}
async function successionDeLExecuteur(de, roleCache = "") {
  const vivants = vivantsIds();
  await modifierEtat(x => { const g = L.normaliserGazette(x.gazette); g.executeur = { ...g.executeur, acteurId: "", succession: { de, tour: x.tour } }; x.gazette = g; return x; });
  const [choix = ""] = vivants.length ? await demandeLibre({ acteurId: de, invite: t("LAKOUR_LOUPS.Gazette.Executeur.InviteSuccession"), candidats: vivants, posthume: true, objet: "executeur" }) : [];
  const elu = vivants.includes(choix) ? choix : L.choisir(vivants) ?? "";
  await modifierEtat(x => {
    const g = L.normaliserGazette(x.gazette);
    g.executeur = { ...g.executeur, acteurId: elu, attendu: !elu, succession: null };
    x.gazette = g;
    if (elu) L.inscrire(x, { type: "gazette", quoi: "executeur", acteurId: elu });
    return x;
  });
  if (!elu) return;
  await annoncerGazette(t(choix ? "LAKOUR_LOUPS.Gazette.Executeur.Successeur" : "LAKOUR_LOUPS.Gazette.Executeur.SuccesseurSort", { de: nomDe(de), nom: nomDe(elu) }),
    { quoi: "executeur", acteurId: elu });
  if (roleCache) await envoyerSecret(elu, { texte: t("LAKOUR_LOUPS.Gazette.Executeur.Carnet", { nom: nomDe(de), role: roleCache }) });
}

// La nuit : les villageois tels que la nuit les voit (la Nuit des sots change les camps, le Jour des sots suspend les amours).
function villageoisDeLaNuit(etat = lireEtat(), tour = Math.max(1, etat.tour)) {
  const vs = villageoisAPlat();
  return L.carteDeLaNuit(etat, "nuit-des-sots", tour) || L.carteDeLaNuit(etat, "jour-des-sots", tour)
    ? L.preparerLaNuit(etat, { villageois: vs, actions: [], tour }).villageois : vs;
}
// Une étape de nuit de la Gazette (le Toucher mortel, la Crue, le Spectre, le Méchant Benêt, les loups devenus liseuses).
async function reveillerPourLaGazette(entree, { delai }) {
  const etat = lireEtat();
  const roleCle = entree.roleCle;
  const proie = L.proieDeLaMeute(etat.nuit.actions);
  const candidatsMeute = api.candidatsDeNuit({ acteurId: entree.acteurIds[0], roleCle: CLE_MEUTE });
  const candidats = L.candidatsDeLEtape(etat, { roleCle, villageois: villageoisAPlat(), candidatsMeute });
  const invite = t(`LAKOUR_LOUPS.Gazette.Etapes.Invite.${roleCle}`, { nom: nomDe(proie) });
  reveilsEnCours.add(roleCle);
  Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: true });
  let cibles = [];
  try {
    if (roleCle === L.CLE_SOTS_VOYANCE) {
      for (const id of entree.acteurIds) {
        const c = await api.demanderAction({ acteurId: id, invite, candidats: candidats.filter(x => x !== id), nombre: 1, delai, soiMeme: false });
        await api.noterAction({ acteurId: id, roleCle, cibles: c, effet: "voir-role" });
      }
      return { roleCle, acteurIds: [...entree.acteurIds], cibles: [], texte: "" };
    }
    if (candidats.length) {
      cibles = [L.CLE_TOUCHER, L.CLE_CRUE].includes(roleCle) ? await api.demanderActionMeute({ invite, candidats, delai })
        : await demandeLibre({ acteurId: entree.acteurIds[0], invite, candidats, delai, posthume: roleCle === L.CLE_BENET, objet: roleCle });
    }
    await api.noterAction({ acteurId: entree.acteurIds[0], roleCle, cibles });
  } finally {
    reveilsEnCours.delete(roleCle);
    Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: false });
  }
  return { roleCle, acteurIds: [...entree.acteurIds], cibles, texte: "" };
}
// Le Méchant Benêt : le joueur désigné devient l'allié secret de la meute (il voit les loups ; eux ne le savent pas).
async function benetDesigne(par, cible) {
  if (!cible || !game.actors.get(cible)?.system.vivant) return;
  const loups = tousLesVillageois().filter(a => a.system.vivant && campDe(a) === "meute").map(a => a.name);
  await modifierEtat(e => {
    const s = L.normaliserGazetteSecret(e.gazetteSecret);
    s.allies = [...new Set([...s.allies, cible])];
    e.gazetteSecret = s;
    return L.journaliserSecret(e, t("LAKOUR_LOUPS.Gazette.Benet.Note", { qui: nomDe(par), nom: nomDe(cible) }));
  });
  await envoyerSecret(cible, { titre: nomDeCarte("mechant-benet"), texte: t("LAKOUR_LOUPS.Gazette.Benet.Carnet", { noms: loups.join(", ") || "—" }) });
}
// Après la résolution : le Retour de flamme (un simple Villageois devient loup ; sinon le premier loup à gauche de la proie foudroyé),
// le Spectre (la proie devient loup, l'ancien loup désigné meurt avec la carte de la proie). -> les morts à faire tomber
async function suiteDeLaNuitDeLaGazette(prep) {
  const morts = [];
  const loupSimple = async () => { try { return (await contenuDisponible()).roles.get("loup-de-brumecombe") ?? null; } catch { return null; } };
  if (prep.retour) {
    const v = villageoisAPlat().find(x => x.id === prep.retour.victime);
    if (v?.vivant && v.role?.cle === L.CLE_VILLAGEOIS) {
      const uuid = await loupSimple();
      await api.donnerRole(v.id, uuid ?? { name: "Loup de Brumecombe", type: "role", img: "icons/svg/mystery-man.svg", system: { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: L.ORDRE_MEUTE, cibles: 1 } } });
      await api.changerCamp(v.id, "meute");
      await envoyerSecret(v.id, { titre: nomDeCarte("retour-de-flamme"), texte: t("LAKOUR_LOUPS.Gazette.Retour.Loup") });
      await presenterALaMeute(v.id);
      await noterPourMJ(t("LAKOUR_LOUPS.Gazette.Retour.NoteLoup", { nom: v.nom }));
    } else if (v?.vivant) {
      const loup = L.premierAGauche(lireEtat(), villageoisAPlat(), v.id, x => x.camp === "meute");
      if (loup) morts.push({ acteurId: loup, cause: "foudre" });
      await noterPourMJ(t("LAKOUR_LOUPS.Gazette.Retour.NoteFoudre", { nom: v.nom, loup: nomDe(loup) }));
    }
  }
  if (prep.spectre) {
    const { victime, loup } = prep.spectre;
    await modifierEtat(e => L.consommerLaCarte(e, "spectre"));
    if (game.actors.get(victime)?.system.vivant && game.actors.get(loup)?.system.vivant) {
      await api.echangerRoles(victime, loup);
      await envoyerSecret(victime, { titre: nomDeCarte("spectre"), texte: t("LAKOUR_LOUPS.Gazette.Spectre.Carnet", { nom: nomDe(loup) }) });
      await presenterALaMeute(victime);
      await noterPourMJ(t("LAKOUR_LOUPS.Gazette.Spectre.Note", { nom: nomDe(victime), loup: nomDe(loup) }));
      morts.push({ acteurId: loup, cause: "spectre" });
    }
  }
  return morts;
}

// La fin : les alliés secrets de la meute (le Méchant Benêt) gagnent avec elle ; un marché avec le Malin perdu exclut de la partie suivante.
async function finDeLaGazette(etat, vainqueur) {
  const allies = L.alliesDeLaMeute(etat).filter(id => game.actors.get(id));
  if (allies.length) await annonceChat(echapper(t(vainqueur === "meute" ? "LAKOUR_LOUPS.Gazette.Benet.Gagne" : "LAKOUR_LOUPS.Gazette.Benet.Perd", { noms: nomsDe(allies) })));
  const perdus = L.marchesPerdus(etat, { vainqueur, campDe: id => L.normaliserFiche(etat.fiches?.[id]).camp });
  if (!perdus.length) return;
  await annonceChat(echapper(t("LAKOUR_LOUPS.Gazette.Marche.Exclus", { noms: nomsDe(perdus) })));
  const exclus = perdus.map(id => game.actors.get(id)).filter(Boolean).map(a => a.system.joueur || a.id);
  await game.settings.set(ID, "exclusDuMalin", exclus);
}

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

  // La logique pure, pour les autres modules (MJ IA). Son `composer` suit le réglage « petiteTablee » (0.11.0) : tant que le monde
  // se souvient d'une Petite tablée, une composition générée de 12 places au plus est une petite tablée, quel que soit le
  // niveau demandé (le MJ IA, qui ne connaît que les trois niveaux, suit ainsi le choix du MJ ; nouvellePartie l'écrit).
  // Il suit aussi le réglage « batimentsDuVillage » (Pacte, étape 5) : « aucun », la composition n'a pas de bâtiment ; « choisis », ceux
  // du réglage « batimentsChoisis ». Et les variantes des réglages (Pacte, étape 6) : la cible du générateur tient compte de leur
  // ajustement mesuré (equilibre.ajustements, cibleDe), sauf variantes données.
  logique: { ...L, composer: (n, equilibre, options = {}) => batimentsDuReglage(L.composer(n, equilibre,
    lireReglage("petiteTablee", false) && n <= L.TABLEE.placesMax && !options?.peste ? { ...options, niveau: L.NIVEAU_PETITE_TABLEE }
      : { variantes: variantesDuReglage(), ...options })) },
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
  // tablee (0.11.0, logique/tablee.mjs) : la Petite tablée — true, false, ou non précisée : une composition prête de ce niveau
  // (« petite-tablee-07 ») la choisit, sinon le réglage monde « petiteTablee » (qui se souvient du dernier choix explicite). Le
  // tirage des rôles est alors contraint (distribuerTablee : l'ombre des deux côtés de la table, une lanterne chez un humain…),
  // le Glas final posé d'office (glasTablee) s'il n'est pas donné, et etat.petiteTablee (public) l'annonce. Jamais dans une
  // Nuit de la Saint-Martin.
  // village (Le Pacte, étape 4, logique/personnalites.mjs) : la variante « Le Village » — true, false, ou non précisée : le réglage
  // monde « leVillage » (nouvellePartie y retient le dernier choix explicite du MJ). Des bâtiments confiés publiquement à des joueurs
  // (proposerLeVillage, au hasard de la graine ; le narrateur les change avant la première nuit : api.installer), annoncés ; les
  // autres sont des Chemineaux. Jamais dans une Nuit de la Saint-Martin ni à la petite tablée.
  // variantes (Le Pacte, étape 5, logique/variantes.mjs) : { chandelles, angoissante, chaine, mur, doubleVisage: "" | "petite" | "grande",
  // vendanges, envoutement } — les champs non précisés suivent leurs réglages monde ; filtrées par variantesPermises (ni Saint-Martin ;
  // ni Double visage, ni Vendanges, ni Envoûtement à la petite tablée ou dans une peste noire ; Double visage de 7 à 18 places).
  // Double visage : les rôles donnés sont les cartes VISIBLES (paquetDoubleVisage) ; petite complication, chacun reçoit en plus une
  // allégeance secrète (son camp) et son rôle est retourné devant tous ; grande complication, les cartes visibles et les allégeances
  // sont mêlées, deux par joueur (lireDeuxCartes : la principale, la seconde, le camp). Les Vendanges : pas de centre pour le
  // Chapardeur ; l'Herboriste et le Joueur de vielle ajustés (roleDesVendanges). La Chaîne des innocents : pas de Banc des accusés.
  // gazette (Le Pacte, étape 9, logique/gazette.mjs) : { actif, rythme, choix, permanentes: [cle], crieur, cartesDuCrieur: n | [cle] } — les
  // champs non précisés suivent leurs réglages monde ; ni dans une Nuit de la Saint-Martin, ni à la petite tablée ; la Gazette écarte
  // l'Almanach des brumes. Chacun reçoit ses traits visibles (publics : etat.traits) ; l'Illuminé partage le village selon le réglage
  // « partageIllumine » (la rive, le genre, l'âge, les lunettes).
  async distribuer({ roles = [], metiers = [], joueurs = [], compagnons = [], maisons = [], graine, composition = "", batiments = [], peste = false, glas = 0,
    format = "", autel = [], fete, tablee, village, variantes, gazette } = {}) {
    exigerMJ();
    const cleFete = format === L.FORMAT_SAINT_MARTIN ? "" : feteVoulue(fete, lireEtat().fete?.cle);
    // Une Nuit de la Saint-Martin n'est jamais une petite tablée, et ne touche pas au réglage (il se souvient du dernier choix ordinaire).
    const court = format === L.FORMAT_SAINT_MARTIN;
    const tableeVoulue = court ? undefined : tablee ?? (await compositionDeTablee(composition) ? true : undefined);
    const enTablee = !court && (tableeVoulue ?? Boolean(lireReglage("petiteTablee", false)));
    if (tableeVoulue !== undefined && tableeVoulue !== Boolean(lireReglage("petiteTablee", false))) await game.settings.set(ID, "petiteTablee", tableeVoulue);
    const enVillage = !court && !enTablee && (typeof village === "boolean" ? village : Boolean(lireReglage("leVillage", false)));
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
    // Une partie neuve : les derniers gestes déjà demandés sont ceux d'une autre partie.
    gestesDemandes.clear();
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
    // Les compagnons tiennent des places comme les joueurs (mêmes tirages de rôle, de métier et de maison). Petite tablée : le
    // tirage des rôles est contraint (humains et compagnons se partagent l'ombre, une lanterne chez un humain du Village).
    const places = [...joueurs, ...nomsCompagnons.map((_, i) => `${PLACE_COMPAGNON}${i}`)];
    const lesMaisons = maisons.length ? maisons : L.maisonsDuVillage(places.length);
    // Le Chapardeur (logique/ambigus.mjs) : deux cartes Villageois de plus au paquet (sauf si elles y sont déjà : n + 2 cartes) ;
    // les deux cartes non distribuées restent au centre, face cachée (secret du MJ). Jamais à la petite tablée ni à la Saint-Martin.
    const clesDuPaquet = () => roles.map(u => cache.get(u)?.system?.cle ?? "villageois");
    // Les variantes (logique/variantes.mjs) : celles que cette veillée peut avoir.
    const choixVariantes = L.variantesPermises(variantesVoulues(variantes), { saintMartin: court, tablee: enTablee, peste, places: places.length });
    // Les Vendanges : le Chapardeur échange avec un joueur, sans centre.
    const avecCentre = !enTablee && format !== L.FORMAT_SAINT_MARTIN && !choixVariantes.vendanges && L.paquetDuChapardeur(clesDuPaquet());
    if (avecCentre) {
      const manque = L.cartesAAjouter(clesDuPaquet(), places.length).length;
      if (manque) {
        let villageois = roles.find(u => cache.get(u)?.system?.cle === L.CLE_VILLAGEOIS) ?? null;
        if (!villageois) { try { villageois = (await contenuDisponible()).roles.get(L.CLE_VILLAGEOIS) ?? null; } catch { villageois = null; } }
        if (villageois && !cache.has(villageois)) { const d = await fromUuid(villageois); if (d) cache.set(villageois, d); else villageois = null; }
        roles = [...roles, ...Array.from({ length: manque }, () => villageois)];
      }
    }
    const tirage = enTablee ? (await tirageDeTablee({ roles, metiers, places, maisons: lesMaisons, graine, cache, peste, humains: joueurs })).tirage
      : L.distribuer({ roles, metiers, joueurs: places, maisons: lesMaisons, graine });
    if (enTablee && !glas) glas = L.glasTablee(places.length);
    // Double visage : les cartes secrètes de chaque place (dans l'ordre du tirage) — l'allégeance (petite complication), ou deux cartes
    // mêlées avec les allégeances (grande : la carte principale remplace le rôle tiré, la seconde va à la fiche).
    const visages = [];
    if (choixVariantes.doubleVisage) {
      const hasardDesVisages = L.creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `visages|${graine}`);
      const rolesDuContenu = (await contenuDisponible()).roles;
      const uuidDe = async cle => {
        const u = rolesDuContenu.get(cle);
        if (u && !cache.has(u)) { const d = await fromUuid(u); if (d) cache.set(u, d); }
        return cache.has(u) ? u : "";
      };
      if (choixVariantes.doubleVisage === "petite") {
        const camps = L.allegeances(tirage.length, hasardDesVisages, choixVariantes.allegeanceLoup);
        tirage.forEach((att, i) => visages.push({ camp: camps[i], cartes: [camps[i] === "meute" ? L.CARTE_LOUP : L.CARTE_VILLAGEOIS], seconde: "" }));
      } else {
        const paires = L.cartesDeLaGrande(tirage.map(att => cache.get(att.role)?.system?.cle ?? L.CARTE_VILLAGEOIS), hasardDesVisages, choixVariantes.allegeanceLoup);
        for (const [i, att] of tirage.entries()) {
          const x = L.lireDeuxCartes(paires[i]);
          const principale = await uuidDe(x.principale);
          if (principale) att.role = principale;
          visages.push({ camp: x.camp, cartes: paires[i], seconde: x.seconde ? await uuidDe(x.seconde) : "" });
        }
      }
    }
    // Les cartes du centre : celles du paquet que le tirage n'a pas données (données d'objet, avec leur source).
    const restants = [...roles];
    for (const att of tirage) { const i = restants.indexOf(att.role); if (i >= 0) restants.splice(i, 1); }
    const centre = avecCentre ? restants.map(u => {
      const doc = u ? cache.get(u) : null;
      return doc && !(peste && doc.system?.camp === "meute") ? { ...donneesObjet(doc), source: doc.uuid ?? "" } : roleParDefaut();
    }) : [];
    // Le paquet entier (distribué et centre) : le Bateleur, le Feu follet et l'Illuminé y jouent leur règle de mise en place.
    const paquet = format === L.FORMAT_SAINT_MARTIN ? [] : clesDuPaquet().filter((c, i) => !(peste && cache.get(roles[i])?.system?.camp === "meute"));
    // Les trois cartes du Bateleur, face visible : au hasard parmi les rôles à pouvoir de nuit qui ne sont pas au paquet.
    let bateleur = [];
    if (paquet.includes(L.CLE_BATELEUR) && !enTablee) {
      try {
        const possibles = await cartesPossiblesDuBateleur(paquet);
        bateleur = L.tirerCartesDuBateleur({ possibles: possibles.map(p => p.cle), graine }).map(cle => possibles.find(p => p.cle === cle));
      } catch (err) { console.warn(`${ID} | cartes du Bateleur`, err); }
    }
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
      // Les Vendanges : l'Herboriste n'a qu'une fiole, le Joueur de vielle charme un joueur à la fois.
      if (choixVariantes.vendanges) roleData = L.roleDesVendanges(roleData);
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
      // Double visage : le camp de l'allégeance ; la seconde carte de la grande complication (ajustée aux Vendanges, comme la première).
      const visage = visages[sortie.length];
      if (visage) {
        fiches[acteur.id] = { ...fiches[acteur.id], camp: visage.camp };
        if (visage.seconde && cache.get(visage.seconde)) {
          const seconde = choixVariantes.vendanges ? L.roleDesVendanges(donneesObjet(cache.get(visage.seconde))) : donneesObjet(cache.get(visage.seconde));
          fiches[acteur.id] = L.normaliserFiche({ ...fiches[acteur.id], seconde: { ...seconde, source: visage.seconde } });
        }
      }
      if (reve) somnambules[acteur.id] = reve;
      sortie.push({ acteurId: acteur.id, userId: compagnon ? "" : att.joueur, compagnon, roleCle: roleData.system?.cle ?? "" });
    }
    for (const a of anciensCompagnons) {
      if (typeof api.compagnons?.retirer === "function") { try { await api.compagnons.retirer(a.id); } catch { /* repli */ } }
      if (game.actors.get(a.id)) await a.delete();
    }
    // Les villageois en jeu vus avec leurs fiches NEUVES (les secrets du MJ ne les ont pas encore).
    const enJeu = tousLesVillageois().filter(a => sortie.some(s => s.acteurId === a.id)).map(a => aPlat(a, fiches));
    // Les traits visibles des personnages (publics), tirés à la distribution ; un trait posé sur l'acteur (drapeau « traits ») est respecté.
    const hasardDeLaGazette = L.creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `gazette|${graine}`);
    const traits = L.tirerTraits(enJeu, { hasard: hasardDeLaGazette,
      imposes: Object.fromEntries(enJeu.map(v => [v.id, traitsImposes(game.actors.get(v.id))]).filter(([, x]) => x)) });
    // La Gazette de la lune et le Crieur public : jamais dans une Nuit de la Saint-Martin, ni à la petite tablée.
    const voulue = { ...gazetteDuReglage(), ...(gazette && typeof gazette === "object" ? gazette : {}) };
    const enGazette = !court && !enTablee && Boolean(voulue.actif);
    const avecCrieur = !court && !enTablee && Boolean(voulue.crieur);
    const permanentes = enGazette ? [...new Set((voulue.permanentes ?? []).filter(c => L.CARTES_PERMANENTES.includes(c)))] : [];
    const mainDuCrieur = avecCrieur ? L.cartesPourLeCrieur({ n: typeof voulue.cartesDuCrieur === "number" ? voulue.cartesDuCrieur : L.CARTES_DU_CRIEUR,
      choisies: Array.isArray(voulue.cartesDuCrieur) ? voulue.cartesDuCrieur : lireReglage("cartesDuCrieurChoisies", []) ?? [], hasard: hasardDeLaGazette, sans: permanentes }) : [];
    const paquetDeLaGazette = enGazette ? L.preparerLePaquet({ hasard: hasardDeLaGazette, sans: [...mainDuCrieur, ...permanentes] }) : [];
    // Le Village : les bâtiments proposés pour cette table, confiés au hasard (public).
    const tenuresDuVillage = enVillage ? L.distribuerLeVillage(L.ordreDesPlaces(enJeu), { graine }) : {};
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
      // Le Village : sans métairie distribuée, pas de Métayer pour désigner le Bailli, donc pas de Bailli.
      if (enVillage && !Object.keys(tenuresDuVillage).some(L.estMetairie)) e.bailli = L.bailliInitial(false);
      e.souffle = L.souffleInitial(lireReglage("dernierSouffle", true));
      e.presage = L.presageInitial(!court && lireReglage("almanach", false));
      // L'Almanach des brumes ou la Gazette de la lune : jamais les deux.
      if (enGazette) e.presage = L.presageInitial(false);
      e.passage = L.passageInitial(lireReglage("gensDePassage", true));
      // La Chaîne des innocents remplace le vote : pas de Banc des accusés avec elle.
      e.banc = L.bancInitial(!court && lireReglage("banc", false) && !choixVariantes.chaine);
      e.deuil = L.deuilInitial(!court && lireReglage("glasDuDeuil", false));
      e.glas = L.normaliserGlas(glas);
      e.fete = L.feteInitiale(cleFete);
      e.somnambules = somnambules;
      e.petiteTablee = enTablee;
      e.places = sortie.length;
      // L'ordre des places autour de la table (logique/cercle.mjs) : celui des maisons, fixé pour toute la partie.
      e.cercle = L.ordreDesPlaces(enJeu);
      // Le Pacte (logique/pacte.mjs) : le réglage « L'Innocent suit l'Aïeul », pris pour toute la partie.
      e.pacte = L.pacteInitial({ innocentSuit: lireReglage("innocentSuitAieul", false) });
      // Le Pacte, étape 3b (logique/ambigus.mjs) : les cartes du Bateleur (publiques), le jour du Feu follet, le partage du village
      // pour l'Illuminé (public) ; les cartes du centre du Chapardeur (secret).
      e.ambigus = { ...L.ambigusInitial(), bateleur, commenceParLeJour: L.commenceParLeJour(paquet),
        groupes: paquet.includes(L.CLE_ILLUMINE) ? L.partagerLeVillage(enJeu.map(v => ({ ...v, traits: traits[v.id] })),
          L.criteresDuPartage(lireReglage("partageIllumine", "rive"))) : null };
      e.ambigusSecret = { ...L.ambigusSecretInitial(), centre };
      // Le Pacte, étape 4 (logique/personnalites.mjs) : la variante « Le Village », ses bâtiments tenus (publics).
      e.village = L.villageInitial(enVillage);
      e.tenures = { ...tenuresDuVillage };
      // Le Pacte, étape 5 (logique/variantes.mjs) : les variantes de la veillée (publiques) ; les cartes secrètes de Double visage.
      e.variantes = L.variantesInitiales(choixVariantes);
      e.variantesSecret = { ...L.variantesSecretInitial(), cartes: Object.fromEntries(sortie.map((s, i) => [s.acteurId, visages[i]?.cartes ?? []]).filter(([, c]) => c.length)) };
      // Le Pacte, étape 9 (logique/gazette.mjs) : les traits (publics) ; la Gazette (le paquet, secret), le Crieur public (ses cartes, secrètes).
      e.traits = traits;
      e.gazette = { ...L.gazetteInitiale({ actif: enGazette, rythme: voulue.rythme, choix: voulue.choix, crieur: avecCrieur }), restantes: paquetDeLaGazette.length };
      e.gazette.crieur.cartes = mainDuCrieur.length;
      e.gazetteSecret = { ...L.gazetteSecretInitial(), paquet: paquetDeLaGazette, main: mainDuCrieur };
      return L.journaliser(e, t("LAKOUR_LOUPS.Journal.Distribution", { n: sortie.length }));
    }, { sansSecrets: true });   // une partie neuve : elle ne doit rien aux secrets d'avant
    for (const s of sortie) await envoyerRole(game.actors.get(s.acteurId));
    // Les rôles PUBLICS dès la distribution (role.public) : retournés face visible, devant tous.
    await revelerLesRolesPublics(sortie.map(s => s.acteurId));
    // Les variantes de la veillée, devant tous ; Double visage : les cartes secrètes au carnet, les rôles visibles retournés.
    const variantesAnnoncees = texteDesVariantes(lireEtat());
    if (variantesAnnoncees) await annoncerUneVariante(variantesAnnoncees, { quoi: "distribution", ids: [] });
    await montrerLesVisages(sortie.map(s => s.acteurId));
    // L'explication de sa place, à chaque joueur humain (son rôle, son métier, sa personnalité), dans son seul carnet.
    for (const s of sortie) await envoyerExplication(game.actors.get(s.acteurId));
    // Les traits visibles de chacun, devant tous ; la Gazette, ses cartes posées dès le début, le Crieur public.
    await annonceChat(echapper(t("LAKOUR_LOUPS.Traits.Annonce", { liste: sortie.map(s => `${nomDe(s.acteurId)} (${texteDesTraits(traits[s.acteurId])})`).join(" ; ") })));
    if (enGazette) await annoncerGazette(t(voulue.choix ? "LAKOUR_LOUPS.Gazette.AnnonceChoix" : "LAKOUR_LOUPS.Gazette.Annonce", { n: L.normaliserGazette(lireEtat().gazette).rythme }),
      { quoi: "distribution" });
    for (const cle of permanentes) await poserUneCarte(cle, { source: "debut" });
    if (avecCrieur) await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Crieur.Annonce", { n: mainDuCrieur.length }), { quoi: "crieur-distribution" });
    // Le Village : les bâtiments confiés, devant tous (jetons « rôle visible »), et les Chemineaux.
    if (enVillage) await annoncerAuVillage(texteDuVillage(lireEtat()), { quoi: "distribution", ids: Object.values(lireEtat().tenures).filter(Boolean) });
    // Le Pacte, étape 3b : ce que la table voit de la mise en place (cartes du Bateleur, jour du Feu follet, bords de l'Illuminé).
    for (const texte of annoncesDesAmbigus(etat)) {
      await modifierEtat(e => L.journaliser(e, texte));
      await annonceChat(echapper(texte));
    }
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
    // La Petite tablée s'annonce (sa règle est publique : des nombres, jamais un nom), exactement ce qui vaut pour cette table ;
    // puis le Glas final.
    if (enTablee) {
      const h = joueurs.length;
      const morceaux = [t("LAKOUR_LOUPS.Tablee.AnnonceTete", { humains: h, compagnons: nomsCompagnons.length }),
        h >= 2 ? t("LAKOUR_LOUPS.Tablee.RegleLoups") : "", h >= 3 ? t("LAKOUR_LOUPS.Tablee.RegleCamps") : "",
        h >= 1 ? t(h >= 3 ? "LAKOUR_LOUPS.Tablee.RegleTirageOmbre" : "LAKOUR_LOUPS.Tablee.RegleTirage") : "",
        t("LAKOUR_LOUPS.Tablee.RegleRythme", { n: etat.glas }), L.nuitBlancheTablee(etat.places) ? t("LAKOUR_LOUPS.Tablee.NuitBlanche") : ""];
      await annonceChat(echapper(morceaux.filter(Boolean).join(" ")));
    }
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
  // village (Le Pacte, étape 4) : la variante « Le Village » (true, false ; non précisée : le réglage « leVillage ») ; le générateur peut
  // alors tirer ses rôles (l'Incendiaire). Une composition choisie qui contient l'Incendiaire la demande d'office (sans elle, il
  // n'aurait rien à brûler). Le résumé la porte (publique, comme son annonce).
  // niveau « le-pacte » (Le Pacte, étape 5) : seulement les rôles du jeu de soirée (composition.mjs, ROLES_DU_LIVRE), sans nos
  // bâtiments communaux ni nos métiers.
  // variantes (Le Pacte, étape 5, logique/variantes.mjs) : { chandelles, angoissante, chaine, mur, doubleVisage, vendanges, envoutement }
  // — un choix explicite est retenu par les réglages monde (comme Le Village) ; le reste suit les réglages. Double visage fait sa propre
  // composition (paquetDoubleVisage : les cartes visibles ; aucun bâtiment) ; les Vendanges ajoutent un loup (le générateur, ou un
  // Villageois d'une composition prête remplacé ; jamais aux rôles choisis à la main) ; Double visage, Vendanges et Envoûtement
  // empêchent le tirage d'une peste noire (une peste choisie les écarte). Le résumé les porte (publiques, comme leur annonce).
  // gazette (Le Pacte, étape 9) : comme distribuer ; un choix explicite (actif, crieur) est retenu par les réglages. Qui a perdu un marché
  // avec le Malin à la partie précédente (réglage « exclusDuMalin ») n'est pas de celle-ci.
  async nouvellePartie({ memesJoueurs = true, joueurs = null, compagnons: ia = null, composition = "", roles = [], niveau = "", graine, peste, glas = 0,
    format, fete, village, variantes, batiments: batimentsVoulus, metiers: metiersVoulus, gazette } = {}) {
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
    const humainsVoulus = Array.isArray(joueurs) ? [...new Set(joueurs.filter(id => game.users.get(id) && !game.users.get(id).isGM))]
      : memesJoueurs ? [...new Set(anciens.map(a => a.system.joueur).filter(id => id && game.users.get(id)))]
        : game.users.filter(u => u.active && !u.isGM).map(u => u.id);
    const compagnonsVoulus = Array.isArray(ia) ? ia.filter(id => estCompagnon(game.actors.get(id))) : anciens.filter(estCompagnon).map(a => a.id);
    // Le Marché avec le Malin (Gazette) : les perdants de la partie précédente en sont exclus, une fois.
    const exclus = new Set(lireReglage("exclusDuMalin", []) ?? []);
    if (exclus.size) {
      await game.settings.set(ID, "exclusDuMalin", []);
      const noms = [...humainsVoulus.filter(id => exclus.has(id)).map(id => game.users.get(id)?.name ?? id), ...compagnonsVoulus.filter(id => exclus.has(id)).map(nomDe)];
      if (noms.length) await annonceChat(echapper(t("LAKOUR_LOUPS.Gazette.Marche.Absents", { noms: noms.join(", ") })));
    }
    const humains = humainsVoulus.filter(id => !exclus.has(id));
    const compagnons = compagnonsVoulus.filter(id => !exclus.has(id));
    memesJoueurs = memesJoueurs && !Array.isArray(joueurs);
    const total = humains.length + compagnons.length;
    if (!total) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeJoueurs"));
    const contenu = await contenuDisponible();
    const precedents = anciens.map(a => L.normaliserFiche(avant.fiches?.[a.id]).role?.system.cle ?? roleRevele(a)?.system?.cle).filter(Boolean);
    const historique = [...historiqueDesParties(), ...(precedents.length ? [{ roles: precedents, batiments: avant.batimentsCles ?? [], quand: Date.now() }] : [])];
    // Le niveau : celui demandé ; sinon la Petite tablée si le réglage s'en souvient ; sinon celui de la partie précédente.
    const niveauPrecedent = [...historique].reverse().find(h => h.niveau)?.niveau ?? contenu.compositions[avant.composition]?.niveau ?? "classique";
    // Le réglage (dernier choix explicite) prime : décoché, un « Rejouer » après une petite tablée retombe sur le niveau classique.
    const tableeVoulueParReglage = lireReglage("petiteTablee", false);
    let niv = L.NIVEAUX.includes(niveau) ? niveau
      : tableeVoulueParReglage && total <= L.TABLEE.placesMax ? L.NIVEAU_PETITE_TABLEE
        : niveauPrecedent === L.NIVEAU_PETITE_TABLEE && !tableeVoulueParReglage ? "classique" : niveauPrecedent;
    // Une petite tablée compte 12 places au plus : au-delà, la composition retombe sur le niveau classique (un avis au MJ).
    if (niv === L.NIVEAU_PETITE_TABLEE && (total > L.TABLEE.placesMax || format === L.FORMAT_SAINT_MARTIN)) {
      if (total > L.TABLEE.placesMax) ui.notifications?.warn(t("LAKOUR_LOUPS.Tablee.Avis.places"));
      niv = "classique";
    }
    const equilibreOk = Object.keys(contenu.equilibre.roles ?? {}).length > 0 && total >= 4;
    const court = format === L.FORMAT_SAINT_MARTIN;
    // Le Village : jamais dans une Nuit de la Saint-Martin ni à la petite tablée. Le choix explicite du MJ est retenu par le réglage
    // (comme la Petite tablée) : « Rejouer » le reprend.
    if (typeof village === "boolean" && village !== Boolean(lireReglage("leVillage", false))) await game.settings.set(ID, "leVillage", village);
    let enVillage = !court && niv !== L.NIVEAU_PETITE_TABLEE && (typeof village === "boolean" ? village : Boolean(lireReglage("leVillage", false)));
    // Les variantes du jeu de soirée (logique/variantes.mjs) : le choix explicite est retenu par les réglages.
    await retenirLesVariantes(variantes);
    // La Gazette et le Crieur public (étape 9) : le choix explicite est retenu par les réglages.
    if (gazette && typeof gazette === "object") for (const [cle, reglageCle] of [["actif", "gazette"], ["crieur", "crieurPublic"]]) {
      if (typeof gazette[cle] === "boolean" && gazette[cle] !== Boolean(lireReglage(reglageCle, false))) await game.settings.set(ID, reglageCle, gazette[cle]);
    }
    // Les bâtiments et les métiers (Pacte, étape 5) : le choix explicite est retenu par les réglages.
    await retenirBatimentsEtMetiers({ batiments: batimentsVoulus, metiers: metiersVoulus });
    let choixVariantes = L.variantesPermises(variantesVoulues(variantes), { saintMartin: court, tablee: niv === L.NIVEAU_PETITE_TABLEE, places: total });
    const loupsEnPlus = choixVariantes.vendanges ? L.LOUPS_DES_VENDANGES : 0;
    const genere = inclure => L.composer(total, contenu.equilibre, { niveau: niv, inclure, historique, graine, village: enVillage, loupsEnPlus, variantes: choixVariantes });
    let compo;
    // La peste noire : choisie (true), refusée (false), ou tirée au sort quand la composition se génère d'elle-même.
    const genereeSeule = !court && !roles.length && !(composition && contenu.compositions[composition]) && equilibreOk;
    const enPeste = !court && (peste === true || (peste === undefined && genereeSeule && !L.sansPeste(choixVariantes) && L.tirerPeste({ graine, chance: api.chancePeste() })));
    if (enPeste) choixVariantes = L.variantesPermises(choixVariantes, { peste: true });
    if (court) {
      const sm = L.composerSaintMartin(total, { disponibles: [...contenu.roles.keys()], graine });
      compo = { cle: L.FORMAT_SAINT_MARTIN, libelle: t("LAKOUR_LOUPS.SaintMartin.Titre"), niveau: niv, roles: sm.joueurs, batiments: [], autel: sm.autel };
    } else if (choixVariantes.doubleVisage) {
      // Double visage : ses cartes visibles (les allégeances, ou le mélange de la grande complication, se tirent à la distribution).
      compo = { cle: "double-visage", libelle: t("LAKOUR_LOUPS.Variantes.DoubleVisage.Composition", { mode: t(`LAKOUR_LOUPS.Variantes.DoubleVisage.${choixVariantes.doubleVisage}`), n: total }),
        niveau: niv, roles: L.paquetDoubleVisage(total), batiments: [] };
    } else if (roles.length) {
      const cles = roles.map(r => cleDeRole(r, contenu));
      if (cles.some(c => !c)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: roles.filter((_, i) => !cles[i]).join(", ") }));
      const bat = equilibreOk ? genere(cles.filter(c => c !== "villageois" && c !== "loup-de-brumecombe")).batiments : avant.batimentsCles ?? [];
      compo = { cle: "choisie", libelle: t("LAKOUR_LOUPS.NouvellePartie.Choisie"), niveau: niv, roles: enPeste ? L.sansMeute(cles, contenu.equilibre) : cles, batiments: bat };
    } else if (composition && contenu.compositions[composition]) {
      const c = contenu.compositions[composition];
      compo = { cle: composition, libelle: c.libelle ?? composition, niveau: c.niveau ?? niv, roles: enPeste ? L.sansMeute(c.roles, contenu.equilibre) : [...c.roles], batiments: [...(c.batiments ?? [])] };
    } else if (equilibreOk) {
      const g = L.composer(total, contenu.equilibre, { niveau: niv, historique, graine, peste: enPeste, village: enVillage, loupsEnPlus, variantes: choixVariantes });
      compo = { cle: "generee", libelle: t("LAKOUR_LOUPS.NouvellePartie.Generee", { verdict: g.verdict }), niveau: niv, roles: g.roles, batiments: g.batiments, somme: g.somme, verdict: g.verdict };
    } else {
      compo = { cle: avant.composition || "reprise", libelle: t("LAKOUR_LOUPS.NouvellePartie.Reprise"), niveau: niv, roles: precedents, batiments: avant.batimentsCles ?? [] };
    }
    // Les Vendanges : un loup de plus qu'une composition prête (un Villageois remplacé ; le générateur l'a déjà fait).
    if (loupsEnPlus && !court && contenu.compositions[compo.cle]) {
      const i = compo.roles.indexOf(L.CLE_VILLAGEOIS);
      if (i >= 0) compo.roles = compo.roles.map((c, k) => (k === i ? "loup-de-brumecombe" : c));
    }
    // Le Chapardeur (logique/ambigus.mjs) : le paquet compte deux cartes de plus, qui resteront au centre (jamais à la petite tablée).
    const avecCentre = !court && niv !== L.NIVEAU_PETITE_TABLEE && compo.niveau !== L.NIVEAU_PETITE_TABLEE
      && L.paquetDuChapardeur(compo.roles.slice(0, total + L.CARTES_DU_CENTRE));
    const cartes = total + (avecCentre ? L.CARTES_DU_CENTRE : 0);
    const cles = compo.roles.slice(0, cartes);
    while (cles.length < cartes) cles.push("villageois");
    compo.roles = cles;
    if (enPeste) compo.libelle = `${compo.libelle} — ${t("LAKOUR_LOUPS.NouvellePartie.Peste")}`;
    // La Petite tablée : le niveau choisi, ou une composition prête de ce niveau (jamais une Nuit de la Saint-Martin).
    const tablee = !court && (niv === L.NIVEAU_PETITE_TABLEE || compo.niveau === L.NIVEAU_PETITE_TABLEE);
    if (tablee && !compo.libelle.includes(t("LAKOUR_LOUPS.Tablee.Nom"))) compo.libelle = `${t("LAKOUR_LOUPS.Tablee.Nom")} — ${compo.libelle}`;
    // L'Incendiaire au paquet demande Le Village (hors petite tablée et Saint-Martin, où il ne peut pas venir).
    if (!court && !tablee && cles.includes(L.CLE_INCENDIAIRE)) enVillage = true;
    if (tablee) enVillage = false;
    const uuidsRoles = cles.map(c => contenu.roles.get(c));
    if (uuidsRoles.some(u => !u)) throw new Error(t("LAKOUR_LOUPS.Erreurs.RolesInconnus", { roles: cles.filter((_, i) => !uuidsRoles[i]).join(", ") }));
    // Le Pacte (étape 5) : le jeu de soirée n'a pas nos métiers.
    // Le Pacte (étape 5) : le jeu de soirée n'a pas nos métiers ; ailleurs, le réglage « metiersEnJeu » (une partie sans métiers).
    const avecMetiers = lireReglage("metiersEnJeu", true) !== false && compo.niveau !== L.NIVEAU_LE_PACTE;
    const metiers = contenu.metiers.length && avecMetiers ? Array.from({ length: total }, (_, i) => contenu.metiers[i % contenu.metiers.length]) : [];
    // Les bâtiments du village (étape 5) : « aucun » (une partie simple, avec les seuls personnages), « hasard » (ceux de la composition),
    // « choisis » (ceux du MJ, réglage « batimentsChoisis ») ; jamais dans une Nuit de la Saint-Martin.
    if (!court) compo.batiments = batimentsDuReglage({ batiments: compo.batiments }).batiments;
    compo.batiments = compo.batiments.filter(c => contenu.batiments.has(c));
    const batiments = compo.batiments.map(c => contenu.batiments.get(c));
    // Une partie abandonnée : ses demandes de nuit se ferment ; les villageois de joueurs qui ne rejouent pas quittent le village.
    annulerDemandes();
    if (!memesJoueurs) for (const a of anciens.filter(x => x.system.joueur && !humains.includes(x.system.joueur))) await a.delete();
    const sortie = await api.distribuer({ roles: uuidsRoles, metiers, joueurs: humains, compagnons, maisons: L.maisonsDuVillage(total),
      graine, composition: compo.cle, batiments, peste: enPeste, glas, variantes: choixVariantes, ...(gazette && typeof gazette === "object" ? { gazette } : {}),
      ...(court ? { format: L.FORMAT_SAINT_MARTIN, autel: compo.autel } : { tablee, village: enVillage }),
      ...(typeof fete === "string" ? { fete } : {}) });
    // La composition n'entre au réglage monde « historique » (livré à tous) qu'à la fin de la partie : en attendant, le MJ la garde.
    await modifierEtat(e => { e.aConsigner = { roles: [...cles], batiments: [...compo.batiments], niveau: compo.niveau, composition: compo.cle, quand: Date.now() }; return e; });
    const partie = lireEtat().partie;
    const resume = {
      partie, fete: lireEtat().fete.cle, tablee: lireEtat().petiteTablee, glas: lireEtat().glas, village: lireEtat().village.actif,
      gazette: { actif: lireEtat().gazette.actif, crieur: lireEtat().gazette.crieur.actif },
      variantes: L.choixDesVariantes(lireEtat().variantes),
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
    const entree = L.ordreDeNuit(villageoisAPlat(), tour, { peste: etat.peste, deuil: L.visionDuDeuilDue(etat, villageoisAPlat()), sagessePerdue: L.sagesseEstPerdue(etat),
      ...L.nuitDesAmbigus(etat, tour), ...L.nuitDesVariantes(etat, tour), gazette: L.nuitDeLaGazette(etat, tour, villageoisAPlat()) }).find(e => e.roleCle === roleCle);
    if (!entree) throw new Error(t("LAKOUR_LOUPS.Erreurs.PersonneAReveiller", { role: String(roleCle) }));
    const ms = Number(delai) > 0 ? Number(delai) : reglage("delaiChoix") * 1000;
    if (roleCle === CLE_PESTE) return reveillerLaPeste(entree, { delai: ms, cible });
    if (roleCle === L.CLE_DEUIL) return reveillerLeDeuil(entree, { delai: ms });
    // Le Pacte, étape 3b : les charmés (sans choix) ; le Chapardeur et le Bateleur, qui choisissent une CARTE.
    if (roleCle === L.CLE_CHARMES) return reveillerLesCharmes(entree);
    // Le Pacte, étape 5 : le Mur des murmures (tous les vivants écrivent, ou passent).
    if (roleCle === L.CLE_MUR) return reveillerLeMur(entree, { delai: ms });
    // Le Pacte, étape 9 : les étapes de la Gazette (le Toucher mortel, la Crue, le Spectre, le Méchant Benêt, la Nuit des sots).
    if (L.ETAPES_DE_LA_GAZETTE.includes(roleCle)) return reveillerPourLaGazette(entree, { delai: ms });
    const premier = entree.emprunt ? null : roleDe(game.actors.get(entree.acteurIds[0]));
    // Les Vendanges : le Chapardeur échange avec un JOUEUR (pas une carte du centre) ; il se réveille comme les autres.
    if ([L.EFFET_CHAPARDEUR, L.EFFET_BATELEUR].includes(premier?.system.effet) && !(L.vendangesActives(etat) && premier.system.effet === L.EFFET_CHAPARDEUR)) {
      return reveillerPourUneCarte(entree, premier, { delai: ms });
    }
    const acteurs = entree.acteurIds.map(id => game.actors.get(id));
    const roles = acteurs.map(a => roleDe(a));
    const meute = roleCle === CLE_MEUTE;
    // La carte que joue le Bateleur cette nuit : son étape se mène avec le rôle de la carte (invite, effet, cibles, « soi-même »).
    // Double visage (grande complication) : la seconde carte du joueur, de même (sa fiche).
    const seconde = entree.seconde ? L.normaliserFiche(etat.fiches?.[entree.acteurIds[0]]).seconde : null;
    const emprunt = seconde ? { ...seconde.system, nom: seconde.name } : entree.emprunt ? L.empruntsDeLaNuit(etat, tour)[entree.acteurIds[0]] : null;
    const role = emprunt ? { name: emprunt.nom, system: emprunt } : meute ? roles.find(r => r?.system.camp === "meute" && Number(r.system.nuit.ordre) === 40) : roles[0];
    const effet = meute ? "tuer" : role?.system.effet ?? "";
    const base = api.candidatsDeNuit({ acteurId: entree.acteurIds[0], roleCle });
    // Les proies de la nuit (pour la Louve mère et l'Herboriste) : l'Enfant de la brume surprise à la place de la proie de la
    // meute ; un mordu n'est pas une victime, l'Herboriste ne l'apprend pas (logique/resolution.mjs, proiesDeLaNuit).
    const { proies, mordus } = L.proiesDeLaNuit({ villageois: villageoisAPlat(), actions: etat.nuit.actions });
    const aSauver = proies.filter(id => !mordus.includes(id));
    // Les candidats d'un porteur, selon SES contraintes (gardé à l'œil, hors d'atteinte…) et l'effet du rôle.
    const candidatsPour = sa => {
      if (effet === "voir-role-mort") return sa.length ? tousLesVillageois().filter(a => !a.system.vivant).map(a => a.id) : [];
      // La Louve mère ne mord pas un loup (la proie du Loup pâle en est un).
      return effet === "mordre" ? sa.filter(id => proies.includes(id) && campDe(game.actors.get(id)) !== "meute") : sa;
    };
    const candidats = candidatsPour(base);
    let invite = role?.system.nuit.invite || (meute ? "" : t("LAKOUR_LOUPS.Choix.InviteParDefaut"));
    // Les Vendanges : la seconde désignation de l'Entremetteuse.
    if (roleCle === L.CLE_TROMPERIE) invite = t("LAKOUR_LOUPS.Variantes.Vendanges.InviteTromperie");
    if (effet === "remede" && aSauver.length) invite = `${t("LAKOUR_LOUPS.Nuit.ProiesDeLaMeute", { noms: aSauver.map(id => game.actors.get(id)?.name ?? "").join(", ") })} ${invite}`;
    reveilsEnCours.add(roleCle);
    Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: true });
    let cibles = [], texte = "";
    try {
      const enGroupe = meute || (role?.system.camp === "meute" && acteurs.length > 1);
      if (!candidats.length && Number(entree.cibles) > 0) cibles = [];
      else if (enGroupe) cibles = await api.demanderActionMeute({ invite, candidats, delai: ms });
      else cibles = await api.demanderAction({ acteurId: entree.acteurIds[0], invite, candidats, nombre: entree.cibles, delai: ms,
        ...(emprunt ? { soiMeme: Boolean(emprunt.nuit?.soiMeme) } : {}) });
      if (effet === "messager" && cibles.length === 2 && cibles[0] !== cibles[1]) {
        texte = await api.demanderTexte({ acteurId: cibles[0], delai: ms,
          invite: t("LAKOUR_LOUPS.Nuit.InviteMessager", { nom: game.actors.get(cibles[1])?.name ?? "" }) });
      }
      await api.noterAction({ acteurId: entree.acteurIds[0], roleCle, cibles, ...(texte ? { texte } : {}), ...(emprunt ? { effet: emprunt.effet } : {}) });
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
  // attente : les réveils en cours, et les derniers gestes demandés au mourant (« geste:<acteurId> »).
  etapeSuivante({ ignorer = [] } = {}) {
    return L.etapeSuivante(lirePublic(), estMJActif() ? secretsMJ() : null,
      { villageois: villageoisAPlat(), attente: [...reveilsEnCours, ...[...gestesEnCours.keys()].map(id => `geste:${id}`)], ignorer });
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
    return L.ordreDeNuit(villageoisAPlat(), Math.max(1, etat.tour), { peste: etat.peste, deuil: L.visionDuDeuilDue(etat, villageoisAPlat()),
      sagessePerdue: L.sagesseEstPerdue(etat), ...L.nuitDesAmbigus(etat, Math.max(1, etat.tour)), ...L.nuitDesVariantes(etat, Math.max(1, etat.tour)),
      gazette: L.nuitDeLaGazette(etat, Math.max(1, etat.tour), villageoisAPlat()) });
  },

  // Qui ce rôle (ou la meute) peut désigner cette nuit, compte tenu des effets du jour (Passeur, Grange, Garde du guet,
  // Chapelle, Taverne, Pont). Le narrateur le passe à demanderAction.
  // Les proies de la nuit en cours (MJ actif ; SECRET) : celles que la Louve mère peut mordre et que l'Herboriste apprend
  // (logique/resolution.mjs, proiesDeLaNuit : l'Enfant de la brume surprise à la place de la proie de la meute ; un mordu n'est
  // pas une victime). -> { proies: [acteurId], mordus: [acteurId], aSauver: [acteurId] }
  proiesDeLaNuit() {
    exigerMJ();
    const x = L.proiesDeLaNuit({ villageois: villageoisAPlat(), actions: lireEtat().nuit.actions });
    return { ...x, aSauver: x.proies.filter(id => !x.mordus.includes(id)) };
  },

  // La Gazette : la nuit des sots change qui chasse et qui est chassé ; les danseurs, les chasseurs de la Battue, le Petit Commis ne
  // peuvent pas être dévorés.
  candidatsDeNuit({ acteurId = "", roleCle = "" } = {}) {
    const etat = lireEtat();
    const tour = Math.max(1, etat.tour);
    const vs = villageoisDeLaNuit(etat, tour);
    const ids = L.candidatsDeNuit({ villageois: vs, etat, acteurId, roleCle, tour });
    const chasse = roleCle === CLE_MEUTE || vs.find(v => v.id === acteurId)?.camp === "meute";
    const intouchables = chasse ? L.intouchablesDeLaNuit(etat, tour) : [];
    return intouchables.length ? ids.filter(id => !intouchables.includes(id)) : ids;
  },

  // objet (facultatif) : ce que la demande décide, pour le cerveau d'un compagnon ("deuil-vision", "deuil-voix" : le Glas du deuil).
  // soiMeme (facultatif) : le « soi-même » d'une carte jouée par le Bateleur, à la place de celui de son rôle.
  demanderAction({ acteurId, invite = "", candidats, nombre = 1, delai, objet = "", soiMeme: soiMemeVoulu } = {}) {
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
    const soiMeme = soiMemeVoulu ?? Boolean(roleDe(acteur)?.system.nuit.soiMeme);
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
    // La Gazette : la Nuit des sots (la Braconnière, l'Herboriste et la Liseuse de cendres chassent, les loups non), les danseurs et les
    // chasseurs de la Battue (un loup parti ne chasse pas).
    const vs = villageoisDeLaNuit(etat);
    const tousLesLoups = tousLesVillageois().filter(a => a.system.vivant && vs.find(v => v.id === a.id)?.camp === "meute");
    // Seuls chassent les loups libres cette nuit (ni gardés à l'œil, ni hors d'atteinte).
    const partis = L.chasseursDeLaGazette(etat, Math.max(1, etat.tour), villageoisAPlat());
    const libres = L.loupsQuiChassent(vs, etat, Math.max(1, etat.tour)).filter(id => !partis || partis.includes(id));
    const loups = tousLesLoups.filter(l => libres.includes(l.id));
    // On ne chasse pas les siens : les loups vivants sont retirés des candidats.
    const intouchables = L.intouchablesDeLaNuit(etat, Math.max(1, etat.tour));
    const cand = (candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id)).filter(id => !tousLesLoups.some(l => l.id === id) && !intouchables.includes(id));
    const choix = await Promise.all(loups.map(async l => {
      const c = await api.demanderAction({ acteurId: l.id, invite: invite || t("LAKOUR_LOUPS.Choix.InviteMeute"), candidats: cand, nombre: 1, delai });
      return { votant: l.id, cible: c[0] ?? "", quand: Date.now() };
    }));
    // La Veillée aux chandelles, version angoissante (logique/variantes.mjs) : chaque loup souffle une chandelle ; plus d'une s'éteint,
    // la meute n'a pas de victime (le village le verra au matin).
    if (L.chandellesAngoissantes(etat)) {
      const { ids, cible } = L.chandellesSoufflees(choix);
      await modifierEtat(e => L.noterLesSouffles(e, { tour: Math.max(1, e.tour), ids }));
      return cible ? [cible] : [];
    }
    const cible = L.majoriteMeute(choix);
    return cible ? [cible] : [];
  },

  // carte (Le Pacte, étape 3b) : la carte choisie par le Chapardeur (index au centre) ou par le Bateleur (clé de la carte).
  async noterAction({ acteurId, roleCle, cibles = [], effet, texte, carte } = {}) {
    exigerMJ();
    const acteur = game.actors.get(acteurId);
    const role = roleDe(acteur);
    const cle = roleCle ?? role?.system.cle ?? "";
    // La carte que joue le Bateleur cette nuit : son action porte l'effet de la carte (même notée sans lui).
    if (!effet && cle !== role?.system.cle) effet = L.roleEmprunte(lireEtat(), acteurId, cle, Math.max(1, lireEtat().tour))?.effet || undefined;
    // Double visage (grande complication) : la seconde carte du joueur.
    const seconde = L.normaliserFiche(lireEtat().fiches?.[acteurId]).seconde;
    const deLaSeconde = Boolean(seconde && seconde.system.cle === cle && cle !== role?.system.cle);
    if (!effet && deLaSeconde) effet = seconde.system.effet || undefined;
    // Les Vendanges : le Chapardeur échange sa carte avec celle du joueur désigné, au matin (chacun vérifie alors la sienne).
    const vendanges = L.vendangesActives(lireEtat());
    if (vendanges && role?.system.effet === L.EFFET_CHAPARDEUR && role.system.cle === cle) effet = "echanger-role";
    // Un usage n'est consommé que si le pouvoir sert (une cible, ou un rôle sans cible) : passer ne coûte rien. L'usage vit
    // dans la fiche secrète (le document le trahirait, en pleine nuit) ; seul son joueur l'apprend, par sa fiche. L'Herboriste
    // peut verser ses deux fioles la même nuit : un usage par cible (l'aube rend ceux d'une fiole restée bouchée).
    const utilise = cibles.length > 0 || Number(role?.system.nuit.cibles) === 0;
    const fois = role?.system.effet === "remede" ? Math.max(1, Math.min(2, cibles.length)) : 1;
    // L'Enfant de la brume qui épie : la meute la surprend-elle ? Tiré maintenant, pour que l'Herboriste apprenne la vraie proie.
    // (Aux Vendanges, elle épie l'Herboriste : rien à craindre de la meute.)
    const epie = role?.system.effet === "epier" && role.system.cle === cle && cibles.length > 0 && !vendanges;
    const surprise = epie ? Math.random() < Number(reglage("chanceEpier") ?? L.RISQUE_ENFANT) : undefined;
    const etat = await modifierEtat(e => {
      const x = L.ajouterAction(e, { acteurId, roleCle: cle, cibles, effet, texte, surprise });
      if (utilise && cle !== CLE_MEUTE && role && role.system.cle === cle && role.system.usages.max > 0) majFiche(x, acteurId, f => L.changerUsage(f, -fois));
      // La seconde carte compte ses usages à part.
      if (utilise && deLaSeconde && seconde.system.usages.max > 0) {
        majFiche(x, acteurId, f => ({ ...f, seconde: { ...f.seconde, system: { ...f.seconde.system,
          usages: { ...f.seconde.system.usages, restant: Math.max(0, f.seconde.system.usages.restant - 1) } } } }));
      }
      return x;
    });
    // Les Lavandières, les Bûcherons : réveillés ensemble, ils se reconnaissent (ou se retrouvent).
    if (role?.system.effet === L.EFFET_FRATRIE && role.system.cle === cle) await reconnaitreLaFratrie(acteurId);
    // La Liseuse d'étoiles qui se désigne : une séance de Spiritisme au matin (secret jusque-là). Le Méchant Benêt : l'allié de la meute.
    if (role?.system.effet === L.EFFET_SPIRITISME && role.system.cle === cle && cibles.includes(acteurId)) {
      await modifierEtat(e => { e.gazetteSecret = { ...L.normaliserGazetteSecret(e.gazetteSecret), seance: { tour: Math.max(1, e.tour), par: acteurId } }; return e; });
    }
    if (cle === L.CLE_BENET && cibles[0]) await benetDesigne(acteurId, cibles[0]);
    // Les ambigus et le Joueur de vielle : leur choix s'applique aussitôt (la carte prise, la carte jouée, le camp, le modèle, les
    // charmés ; les charmés qui se reconnaissent).
    if (!(vendanges && effet === "echanger-role")) await suivreLesAmbigus({ acteurId, role, cle, cibles, carte });
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
    // La Gazette (logique/gazette.mjs) : les actions et les villageois de la nuit transformés (le Toucher mortel, le Retour de flamme, le
    // Spectre, la Crue, la Nuit des sots, les amours suspendues du Jour des sots) ; les intouchables.
    const vsAvant = villageoisAPlat();
    const prep = L.preparerLaNuit(avant, { villageois: vsAvant, actions: avant.nuit.actions, tour });
    const r = L.resoudreNuit({
      villageois: prep.villageois, actions: prep.actions, tour, asperges: avant.asperges,
      precedentes: avant.nuitPrecedente.actions, primes: avant.primes, fioles: avant.fioles, chanceEpier: reglage("chanceEpier"),
      jour: L.effetsDeLaNuit(avant, tour, { batiments: cles }), somnambules, rolesFactices,
      // Le Pacte : le cercle (Furet, Vieux Sergent), les vies perdues des Aïeux, le flair perdu des Furets, les loups contaminés qui
      // meurent cette nuit, la sagesse du village.
      cercle: avant.cercle, aieux: avant.pacteSecret.aieux, furets: avant.pacteSecret.furets, contamines: L.contaminesDeLaNuit(avant, tour),
      sagessePerdue: L.sagesseEstPerdue(avant),
      // Le Pacte, étape 3b : la carte jouée cette nuit par un Bateleur se résout avec son rôle.
      emprunts: L.empruntsDeLaNuit(avant, tour),
      // Le Village (logique/personnalites.mjs) : le Cabaretier immunisé, les Chemineaux, le bâtiment de chacun (l'Incendiaire).
      immunises: L.immunisesDeLaNuit(avant, villageoisAPlat()), chemineaux: L.chemineaux(avant, villageoisAPlat()),
      // La Gazette : les danseurs, les chasseurs de la Battue, le Petit Commis ne peuvent pas être dévorés cette nuit.
      ...(prep.immunises.length ? { immunises: [...L.immunisesDeLaNuit(avant, villageoisAPlat()), ...prep.immunises] } : {}),
      batimentsTenus: Object.fromEntries(villageoisAPlat().map(v => [v.id, L.batimentDe(avant, v.id)]).filter(([, cle]) => cle)),
      // Les variantes (logique/variantes.mjs) : les pouvoirs éméchés des Vendanges et leur triangle, l'Envoûtement, ce que la Liseuse lit
      // de Double visage (les cartes secrètes).
      vendanges: L.vendangesActives(avant), triangle: L.triangleDe(avant), envoutement: L.envoutementActif(avant),
      visages: L.doubleVisage(avant) ? L.visagesPourLaLiseuse(avant, await nomsDesCartes()) : {},
      nomsApparents: avant.nuit.actions.some(a => roleDe(game.actors.get(a.acteurId))?.system.effet === "voir-role") ? await nomsApparents(contenu) : {}
    });
    // Une fiole déjà vide n'a rien versé : l'usage décompté par noterAction est rendu, AVANT les échanges de rôles de la nuit
    // (sinon il irait au rôle reçu par échange, ex. un Colporteur qui pourrait échanger une seconde fois).
    // L'Herboriste qui verse ses deux fioles la même nuit : noterAction a pris un usage par cible ; ce qui reste, c'est le nombre
    // de fioles encore pleines (r.fioles, avant l'échange de rôles de la nuit), pour qu'un usage pris en trop ne soit jamais rendu deux fois.
    if (r.fiolesVides.length) await modifierEtat(e => {
      const echanges = r.changements.filter(c => c.type === "echange");
      const avantEchange = id => { const c = echanges.find(x => x.a === id || x.b === id); return r.fioles[c ? (c.a === id ? c.b : c.a) : id] ?? {}; };
      for (const id of new Set(r.fiolesVides)) majFiche(e, id, f => {
        const u = f.role?.system.usages;
        if (!(u?.max > 0)) return f;
        const versees = ["remede", "poison"].filter(k => avantEchange(id)[k]).length;
        return { ...f, role: { ...f.role, system: { ...f.role.system, usages: { ...u, restant: Math.max(0, u.max - versees) } } } };
      });
      return e;
    });
    for (const c of r.changements) {
      if (c.type === "camp") await api.changerCamp(c.acteurId, c.camp);
      // Les Vendanges : la fiole qui rend Villageois simple ; le triangle de l'Entremetteuse (le trompé aime le trompeur, qui aime
      // désormais le nouvel amant : la fiche ne garde qu'un amoureux, le triangle le reste).
      else if (c.type === "villageois") {
        let villageois = null;
        try { villageois = (await contenuDisponible()).roles.get(L.CLE_VILLAGEOIS) ?? null; } catch { villageois = null; }
        await api.donnerRole(c.acteurId, villageois ?? roleParDefaut());
        await api.changerCamp(c.acteurId, "village");
      } else if (c.type === "triangle") {
        await modifierEtat(e => {
          e.variantesSecret = { ...L.normaliserVariantesSecret(e.variantesSecret), triangle: { trompeur: c.trompeur, trompe: c.trompe, amant: c.amant } };
          majFiche(e, c.trompeur, f => ({ ...f, amoureux: c.amant }));
          majFiche(e, c.amant, f => ({ ...f, amoureux: c.trompeur }));
          majFiche(e, c.trompe, f => ({ ...f, amoureux: c.trompeur }));
          return L.journaliserSecret(e, t("LAKOUR_LOUPS.Variantes.Vendanges.Triangle", { qui: nomDe(c.trompeur), nom: nomDe(c.amant), trompe: nomDe(c.trompe) }));
        });
      }
      else if (c.type === "amour") {
        await modifierEtat(e => majFiche(majFiche(e, c.a, f => ({ ...f, amoureux: c.b })), c.b, f => ({ ...f, amoureux: c.a })));
      } else if (c.type === "silence") await api.reduireAuSilence(c.acteurId);
      else if (c.type === "echange") await api.echangerRoles(c.a, c.b);
    }
    // La Fournière (Le Village) entrouvre les yeux quand la meute se rendort : ce qu'elle entrevoit (les loups du début de la nuit)
    // lui est écrit au carnet, si elle voit le matin.
    const apercus = L.apercusDeLaFourniere({ etat: avant, villageois: villageoisAPlat(), chance: Number(lireReglage("chanceFourniere", L.CHANCE_FOURNIERE)) });
    // L'Envoûtement : les proies de la meute perdent leurs pouvoirs, en secret (leur carnet le leur dit : messages).
    await envouterLesProies(r.envoutes ?? [], tour);
    // Le Bailli tombé cette nuit ne remet le sceau qu'une fois toutes les morts de la nuit tombées (fin de resoudreNuit).
    mortsDeLaNuit = true;
    try {
      for (const d of r.deces) await api.eliminer(d.acteurId, { cause: d.cause });
      // La Gazette : le loup foudroyé du Retour de flamme, l'ancien loup désigné par le Spectre.
      for (const d of await suiteDeLaNuitDeLaGazette(prep)) await api.eliminer(d.acteurId, { cause: d.cause });
    } finally { mortsDeLaNuit = false; }
    // Ce qu'a lu la Liseuse de cendres (le Spiritisme le demande) : une carte de loup, une fois au moins.
    if (L.liseuseAVuUnLoup(avant.nuit.actions, vsAvant, v => L.roleApparent(v).camp)) {
      await modifierEtat(e => { e.gazetteSecret = { ...L.normaliserGazetteSecret(e.gazetteSecret), vuUnLoup: true }; return e; });
    }
    // La lanterne démasque un loup : l'annonce le dit déjà, le document montre « meute » (rien d'autre de son vivant).
    for (const rev of r.revelations) await revelerPubliquement(rev.acteurId, rev.type === "eclairer" ? { campPublie: "meute" } : {});
    await modifierEtat(e => {
      for (const id of Object.keys(e.fiches ?? {})) if (e.fiches[id]?.protections) majFiche(e, id, f => ({ ...f, protections: 0 }));
      return e;
    });

    // Les veillées de fête : la neige d'hiver tombe (ou non) avant que les bâtiments parlent ; l'âme du premier mort de la Nuit des
    // âmes murmure à un vivant (et la meute entend à quelle porte).
    // Le Pacte : ce que la nuit a changé dans les secrets (vies des Aïeux, flair des Furets, loups contaminés pour la nuit prochaine),
    // la plume noire de la Pie (publique au matin si sa cible vit), puis les oies de la Gardeuse, juste après les morts.
    const plume = r.plume && game.actors.get(r.plume)?.system.vivant ? r.plume : "";
    await modifierEtat(e => {
      e.pacteSecret = { ...e.pacteSecret, aieux: [...r.aieux], furets: [...r.furets],
        contamines: [...e.pacteSecret.contamines.filter(c => c.nuit > tour), ...r.contaminations.map(c => ({ acteurId: c.loup, nuit: tour + 1 }))] };
      L.poserLaPlume(e, plume);
      if (plume) L.inscrire(e, { type: "pacte", quoi: "plume", acteurId: plume });
      return e;
    });
    // Le Pacte, étape 3b : les cartes jouées par le Bateleur sont retirées, devant tous ; le Feu follet qui a passé la première nuit
    // devient simple villageois.
    const cartesRetirees = await retirerLesCartesJouees(tour);
    if (tour === 1) await eteindreLesFeuxFollets();
    // Le Pacte, étape 6b : le Chasseur de primes dont la cible est morte autrement, ou dont le délai est passé, devient simple villageois.
    await echoirLesPrimes(tour);
    // Le Village : les bâtiments brûlés par l'Incendiaire tombent en cendres (leur occupant devient Chemineau).
    const incendies = await brulerLesBatiments(r.incendies ?? []);
    const oies = L.oiesQuiCacardent(lireEtat(), villageoisAPlat());
    if (oies.length) await modifierEtat(e => { for (const id of oies) L.inscrire(e, { type: "pacte", quoi: "oies", acteurId: id }); return e; });
    // Les variantes : les chandelles d'une meute en désaccord (angoissante), puis le Mur des murmures, lu au matin, sans auteur.
    let chandelles = [], mur = null;
    await modifierEtat(e => {
      chandelles = L.chandellesDuMatin(e, tour);
      if (chandelles.length) L.inscrire(e, { type: "variante", quoi: "chandelles", ids: chandelles });
      if (L.murActif(e)) mur = L.lireLeMur(e, tour);
      return e;
    });
    const annoncesDesVariantes = [...(chandelles.length ? [t("LAKOUR_LOUPS.Variantes.Chandelles.Ratees", { noms: chandelles.map(nomDe).join(", ") })] : []),
      ...(mur ? [mur.length ? t("LAKOUR_LOUPS.Variantes.Mur.Matin", { textes: mur.map(x => `« ${x} »`).join(" — ") }) : t("LAKOUR_LOUPS.Variantes.Mur.Muet")] : [])];
    const annoncesDuPacte = [...incendies, ...oies.map(id => t("LAKOUR_LOUPS.Pacte.Oies", { nom: nomDe(id) })), ...(plume ? [t("LAKOUR_LOUPS.Pacte.PlumeMatin", { nom: nomDe(plume) })] : []),
      ...cartesRetirees, ...annoncesDesVariantes];
    const neige = await faireNeiger();
    const nomActeur = id => game.actors.get(id)?.name ?? id;
    const murmure = L.estFete(avant, L.NUIT_DES_AMES)
      ? L.messagesDuMurmure(L.murmureDesAmes({ villageois: villageoisAPlat(), deces: r.deces, masque: L.masqueDuCarnaval(avant) }), nomActeur) : [];
    // Les bâtiments parlent à l'aube, sur l'état d'après la nuit.
    const aube = L.annoncesDeLAube({ villageois: villageoisAPlat(), etat: lireEtat(), tour, bilan: r.bilan, batiments: cles,
      revelerALaMort: reglage("revelerALaMort") });
    const messages = [...r.messages.filter(m => m.destinataire !== "mj"), ...aube.prives, ...murmure.filter(m => m.destinataire !== "mj")]
      .map(m => ({ acteurId: m.destinataire, texte: texteMessage(m) }));
    for (const x of apercus) {
      if (game.actors.get(x.acteurId)?.system.vivant) messages.push({ acteurId: x.acteurId, texte: t("LAKOUR_LOUPS.Village.Fourniere", { nom: nomDe(x.loup) }) });
    }
    const annonces = [...(neige ? [neige] : []), ...[...r.annonces, ...aube.annonces].map(texteMessage)];
    annonces.unshift(...annoncesDuPacte);   // les oies et la plume, juste après les morts
    const narration = [
      ...prep.messages.map(texteMessage),
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
    for (const id of oies) annoncer("lakourLoups.pacte", [{ quoi: "oies", acteurId: id }]);
    if (plume) annoncer("lakourLoups.pacte", [{ quoi: "plume", acteurId: plume }]);
    if (chandelles.length) annoncer("lakourLoups.variante", [{ quoi: "chandelles", tour, ids: [...chandelles] }]);
    if (mur) annoncer("lakourLoups.variante", [{ quoi: "mur", tour }]);
    annoncer("lakourLoups.aube", [{ tour, morts: r.morts, annonces }]);
    suivreGestes();
    suivreSuccession();
    suivreVacances();
    const presage = await tirerLePresage(r.bilan);
    // La Gazette de la lune : la fin du tour d'avant, le Somnambule, la carte du jour ; puis la séance de Spiritisme et le Crieur.
    await matinDeLaGazette();
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
    // La Gazette (logique/gazette.mjs) : la Crue (pas de vote ce jour) ; l'Exécuteur s'élit quand la carte l'attend ; le Châtiment juge
    // son seul accusé.
    if (objet === "execution" && L.voteEmpeche(lireEtat())) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.inondation"));
    if (objet === "executeur" && !L.electionExecuteurDue(lireEtat(), villageoisAPlat())) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.executeur"));
    if (objet === "chatiment" && !candidats?.length) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.chatiment"));
    let ids = candidats ?? tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);
    // Le Village (logique/personnalites.mjs) : le Cabaretier immunisé n'est jamais candidat d'un vote d'exécution ; le Bailli se
    // désigne parmi les Métayers vivants.
    ids = L.candidatsDuVillage(lireEtat(), ids, objet);
    // La Gazette : les protégés du jour (danseurs, cueilleuses, vétérans, chasseurs) ne sont pas candidats.
    ids = L.candidatsDeLaGazette(lireEtat(), ids, objet);
    if (objet === "bailli" && L.villageActif(lireEtat())) ids = ids.filter(id => L.candidatsElection(lireEtat(), villageoisAPlat()).includes(id));
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
    // La Chaîne des innocents (logique/variantes.mjs) : le vote d'exécution se fait par la chaîne (sans minuteur : elle va à son pas).
    const enChaine = objet === "execution" && !banc && L.chaineActive(lireEtat());
    // La Gazette : la Grande Défiance (deux voix chacun), le Cauchemar (à tour de rôle, du voisin de gauche du dernier éliminé ; le ou les
    // plus cités), les Influences (à tour de rôle, du joueur que choisit le dernier éliminé) ; sans minuteur, à son pas.
    const g = lireEtat();
    const libre = objet === "execution" && !banc && !enChaine;
    const defiance = libre && L.carteDuJour(g, "grande-defiance");
    const cauchemar = libre && !defiance && L.carteDuJour(g, "cauchemar");
    const influences = libre && !defiance && !cauchemar && L.cartePosee(g, "influences");
    const enSuite = cauchemar || influences;
    const ms = enChaine || enSuite ? 0 : duree === undefined ? reglage("dureeVote") * 1000 : enMs(duree);
    const gibet = majoriteAbsolue ?? clesDesBatiments().includes("gibet");
    // Les Vendanges : le Bailli en charge vote seul, avant les autres (au plus le délai des choix).
    const bailliDesVendanges = libre && !defiance && !enSuite && L.vendangesActives(lireEtat())
      ? L.bailliEnCharge(lireEtat(), L.filtrerVotants(lireEtat(), vivantsIds(), "execution")) : "";
    const etat = await modifierEtat(e => {
      const x = L.ouvrirVote(e, { candidats: ids, duree: ms, double, majoriteAbsolue: gibet, objet, banc,
        mode: defiance ? "defiance" : enSuite ? "suite" : "", cauchemar,
        ordre: cauchemar ? L.ordreAGauche(e, villageoisAPlat(), L.premierDuCauchemar(e, villageoisAPlat()), L.filtrerVotants(e, vivantsIds(), "execution")) : [] });
      if (influences) L.consommerLaCarte(x, "influences");
      if (enChaine) {
        x.vote = { ...x.vote, chaine: true };
        L.ouvrirLaChaine(x, { debout: ids, premier: L.premierDeLaChaine(x, villageoisAPlat(), ids) });
      }
      if (bailliDesVendanges) x.vote = { ...x.vote, bailliDabord: { acteurId: bailliDesVendanges, jusqua: Date.now() + reglage("delaiChoix") * 1000 } };
      if (banc) L.noterJugement(x, banc);
      if (x.village.cabaret) x.village = { ...x.village, cabaret: null };   // le vote public du Cabaretier : celui du vote ouvert
      return L.journaliser(x, banc ? t("LAKOUR_LOUPS.Banc.Jugement", { nom: game.actors.get(banc)?.name ?? "" })
        : t({ chapelle: "LAKOUR_LOUPS.Journal.VoteChapelle", bailli: "LAKOUR_LOUPS.Journal.VoteBailli", exil: "LAKOUR_LOUPS.Passage.VoteExil",
          executeur: "LAKOUR_LOUPS.Gazette.Executeur.Journal", chatiment: "LAKOUR_LOUPS.Gazette.Chatiment.Journal" }[objet] ?? "LAKOUR_LOUPS.Journal.VoteOuvert"));
    });
    if (!L.VOTES_SANS_PHASE.includes(etat.vote.objet)) annoncer("lakourLoups.phase", ["vote", etat], ["vote", L.etatPublic(etat)]);
    annoncer("lakourLoups.voteOuvert", [{ objet: etat.vote.objet, numero: etat.vote.numero }]);
    if (enChaine) {
      // La chaîne s'annonce : qui commence, et pourquoi (le voisin de gauche du dernier éliminé).
      const c = L.chaineEnCours(etat);
      const texte = c?.condamne ? t("LAKOUR_LOUPS.Variantes.Chaine.Debout", { nom: nomDe(c.condamne) }) : t("LAKOUR_LOUPS.Variantes.Chaine.Ouverture", { nom: nomDe(c?.designateur ?? "") });
      await modifierEtat(e => L.journaliser(e, texte));
      await annonceChat(echapper(texte));
      lancerLaChaine(etat.vote.numero);
      return foundry.utils.deepClone(L.etatPublic(lireEtat()).vote);
    }
    // La Gazette : l'annonce du vote qui change ; à tour de rôle, le premier est appelé (les Influences : le dernier éliminé le choisit).
    if (defiance) await annonceChat(echapper(t("LAKOUR_LOUPS.Gazette.Defiance.Ouverture")));
    if (etat.vote.objet === "executeur") await annonceChat(echapper(t("LAKOUR_LOUPS.Gazette.Executeur.Ouverture")));
    if (enSuite) {
      await annonceChat(echapper(t(cauchemar ? "LAKOUR_LOUPS.Gazette.Suite.OuvertureCauchemar" : "LAKOUR_LOUPS.Gazette.Suite.OuvertureInfluences")));
      if (cauchemar) avancerLaSuite(); else lancerLesInfluences(etat.vote.numero);
      demanderVoixDuDeuil(etat);
      return foundry.utils.deepClone(L.etatPublic(lireEtat()).vote);
    }
    if (bailliDesVendanges) {
      poserLAttenteDuBailli(etat.vote);
      await annonceChat(echapper(t("LAKOUR_LOUPS.Variantes.Vendanges.BailliDabord", { nom: nomDe(bailliDesVendanges) })));
    }
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
    await influencesEnCours;   // la Gazette : le premier votant des Influences, encore à choisir
    clearTimeout(suiteDuVote?.minuterie);
    await votesCompagnons;   // les voix des compagnons encore en réflexion
    await voixDuDeuil;       // le choix secret de la meute pour la voix du deuil
    if (lireEtat().vote.chaine) await chaineEnCours;   // la Chaîne des innocents, jusqu'au dernier debout
    // Le sceau d'un Bailli défunt, s'il est en train d'être remis (au plus le reste du délai des choix) : le MJ le sait.
    const sceau = lireEtat().bailli.succession;
    if (sceau) ui.notifications?.info(t("LAKOUR_LOUPS.Bailli.SceauAttend", { nom: game.actors.get(sceau.de)?.name ?? "" }));
    await suivreSuccession();
    // Les votants : les vivants qui ont le droit de voter (pacte.mjs : ni un Innocent gracié, ni, le lendemain du Souffre-douleur,
    // qui n'est pas sur sa liste).
    const votants = L.filtrerVotants(lireEtat(), tousLesVillageois().filter(a => a.system.vivant).map(a => a.id));
    const nom = id => game.actors.get(id)?.name ?? id;
    const r = await modifierEtat(e => {
      // Déjà clos (minuteur écoulé, ou clos ailleurs entre-temps) : on ne recompte pas un vote fermé.
      if (!e?.vote?.ouvert) throw new Error(t("LAKOUR_LOUPS.Erreurs.PasDeVote"));
      // La Chaîne des innocents : pas de voix, le dernier debout est condamné.
      if (e.vote.chaine) {
        const c = L.cloreLaChaine(e);
        L.inscrire(c.etat, L.entreeDeVote(c.resultat));
        const noms = c.resultat.elus.map(nom).join(", ");
        return { etat: L.journaliser(c.etat, noms ? t("LAKOUR_LOUPS.Journal.VoteClos", { noms, n: c.resultat.elus.length }) : t("LAKOUR_LOUPS.Journal.VoteNul")), resultat: c.resultat };
      }
      // Les morts qui soufflent à ce vote comptent parmi les votants (le Gibet ne compte qu'eux) ; leur souffle est rendu.
      const souffles = e.vote.objet === "execution" ? L.souffleurs({ etat: e, villageois: villageoisAPlat() }) : [];
      // La voix du deuil va au choix secret de la meute pour ce vote (sinon au hasard) : jamais aux bulletins.
      // Le Souffre-douleur paie une égalité (pacte.mjs) : celui qui vit encore et a son pouvoir.
      // Les Vendanges : le Souffre-douleur ne paie plus l'égalité, il meurt à la place d'un de ses deux voisins condamné.
      const vendanges = L.vendangesActives(e);
      const bouc = L.souffreDouleur(e, villageoisAPlat());
      const sesVoisins = bouc ? L.voisins(e, villageoisAPlat(), bouc) : { gauche: "", droite: "" };
      const c = L.cloreVote(e, { votants: L.filtrerVotants(e, [...votants, ...souffles.filter(id => id in e.vote.votes)]), souffles, poids: L.poidsDeLaGazette(e),
        souffreDouleur: vendanges ? "" : bouc, ...(vendanges && bouc ? { boucDesVendanges: bouc, voisinsDuBouc: [sesVoisins.gauche, sesVoisins.droite].filter(Boolean) } : {}) });
      if (c.prolonge) {
        return { etat: L.journaliser(c.etat, t("LAKOUR_LOUPS.Jour.RubanDefense", { nom: nom(c.prolonge) })), prolonge: c.prolonge };
      }
      if (c.resultat.objet === "bailli") {
        const x = L.elireBailli(c.etat, c.resultat, { villageois: villageoisAPlat() });
        const annonce = x.elu ? t(x.sort ? "LAKOUR_LOUPS.Bailli.EluSort" : "LAKOUR_LOUPS.Bailli.Elu", { nom: nom(x.elu) }) : t("LAKOUR_LOUPS.Bailli.Personne");
        return { etat: L.journaliser(x.etat, annonce), resultat: { ...x.etat.vote.resultat, bailli: x.elu, sort: x.sort }, annonce };
      }
      // La Gazette : l'Exécuteur élu (égalité : le sort) ; le Châtiment (assez de soutiens ?) ; la Grande Défiance, le Cauchemar.
      if (c.resultat.objet === "executeur") {
        const x = L.elireExecuteur(c.etat, c.resultat, { villageois: villageoisAPlat() });
        const annonce = x.elu ? t(x.sort ? "LAKOUR_LOUPS.Gazette.Executeur.EluSort" : "LAKOUR_LOUPS.Gazette.Executeur.Elu", { nom: nom(x.elu) }) : t("LAKOUR_LOUPS.Gazette.Executeur.Personne");
        return { etat: L.journaliser(c.etat, annonce), resultat: { ...c.etat.vote.resultat, executeur: x.elu, sort: x.sort }, annonce };
      }
      if (c.resultat.objet === "chatiment" || c.resultat.mode === "defiance" || c.resultat.cauchemar) {
        const accuse = c.etat.vote.candidats[0] ?? "";
        const annonce = c.resultat.objet === "chatiment"
          ? t(c.resultat.elus.length ? "LAKOUR_LOUPS.Gazette.Chatiment.Condamne" : "LAKOUR_LOUPS.Gazette.Chatiment.Epargne", { nom: nom(accuse), n: c.resultat.soutiens ?? 0 })
          : c.resultat.elus.length ? t(c.resultat.cauchemar ? "LAKOUR_LOUPS.Gazette.Suite.Cites" : "LAKOUR_LOUPS.Gazette.Defiance.SansVoix", { noms: c.resultat.elus.map(nom).join(", ") })
            : t(c.resultat.cauchemar ? "LAKOUR_LOUPS.Journal.VoteNul" : "LAKOUR_LOUPS.Gazette.Defiance.Personne");
        return { etat: L.journaliser(c.etat, annonce), resultat: c.resultat, annonce };
      }
      // La voix du Bailli a tranché d'elle-même (il avait voté pour l'un des ex aequo) : dit au village.
      const d = c.resultat.departage;
      const auto = d?.auto?.length ? t("LAKOUR_LOUPS.Bailli.TrancheVoix", { nom: nom(d.par), noms: d.auto.map(nom).join(", ") }) : "";
      if (d?.enAttente) {
        const annonce = [auto, t("LAKOUR_LOUPS.Bailli.Departage", { nom: nom(d.par), noms: d.candidats.map(nom).join(", ") })].filter(Boolean).join(" ");
        return { etat: L.journaliser(c.etat, annonce), resultat: c.resultat, annonce };
      }
      const noms = c.resultat.elus.map(nom).join(", ");
      // Le Banc : le verdict est dit (« pour » sur le total) ; la voix du deuil : « une voix sans visage » rejoint son candidat ;
      // la Petite tablée : le sort a tranché l'égalité.
      const b = c.resultat.banc;
      const annonce = [auto, b ? t(c.resultat.elus.length ? "LAKOUR_LOUPS.Banc.Condamne" : "LAKOUR_LOUPS.Banc.Acquitte", { nom: nom(b.accuse), pour: b.pour, total: b.total }) : "",
        c.resultat.deuil ? t("LAKOUR_LOUPS.Deuil.Voix", { nom: nom(c.resultat.deuil) }) : "",
        c.resultat.plume ? t("LAKOUR_LOUPS.Pacte.PlumeVoix", { nom: nom(c.resultat.plume) }) : "",
        c.resultat.souffreDouleur && !c.resultat.remplace ? t("LAKOUR_LOUPS.Pacte.Egalite", { nom: nom(c.resultat.souffreDouleur) }) : "",
        c.resultat.remplace ? t("LAKOUR_LOUPS.Variantes.Vendanges.Bouc", { nom: nom(c.resultat.souffreDouleur), voisin: nom(c.resultat.remplace) }) : "",
        c.resultat.sort?.length ? t("LAKOUR_LOUPS.Tablee.Sort", { noms: c.resultat.sort.map(nom).join(", ") }) : ""].filter(Boolean).join(" ");
      let x = L.journaliser(c.etat, noms ? t("LAKOUR_LOUPS.Journal.VoteClos", { noms, n: c.resultat.elus.length }) : t("LAKOUR_LOUPS.Journal.VoteNul"));
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
    // Le Loup déguisé le plus désigné sans être condamné perd son masque (logique/jour.mjs, masquesQuiTombent).
    for (const id of L.masquesQuiTombent({ resultat, villageois: villageoisAPlat() })) await tomberLeMasque(id);
    // Le Village : le Cabaretier qui a voté contre un condamné perd son immunité ; le Hobereau peut gracier (les condamnés le
    // supplient, l'exécution attend sa réponse).
    await perdreLImmunite(resultat);
    proposerLaGrace(resultat);
    // La Chambrière : la demande part aussitôt (une fenêtre courte) ; l'exécution (eliminer) attend sa réponse.
    proposerLeDevouement(resultat);
    if (resultat.objet === "bailli") {
      annoncer("lakourLoups.bailli", [{ acteurId: resultat.bailli, comment: resultat.bailli ? (resultat.sort ? "sort" : "election") : "vacance" }]);
      suivreLeCrieur();
    }
    if (resultat.objet === "executeur" && resultat.executeur) annoncer("lakourLoups.gazette", [{ quoi: "executeur", acteurId: resultat.executeur }]);
    // Le Châtiment : sans assez de soutiens, l'accusé tombe aussitôt.
    if (resultat.objet === "chatiment" && resultat.elu && game.actors.get(resultat.elu)?.system.vivant) {
      await api.eliminer(resultat.elu, { cause: "chatiment" });
      await api.verifierVictoire();
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
    // Le Village : le Hobereau a gracié ce condamné (à sa demande) — il n'est pas éliminé, sa carte reste cachée.
    if (cause === "vote" && await graceDuHobereau(acteurId)) {
      await suivreSecondVote();
      await sceller();
      return [];
    }
    // La Gazette : Pile ou face, le Marché avec le Malin (juste après le verdict) : épargné, il ne meurt pas.
    if (cause === "vote" && await verdictDeLaGazette(acteurId)) {
      await suivreSecondVote();
      await sceller();
      return [];
    }
    // L'Innocent condamné par le vote n'en meurt pas : il est gracié (logique/pacte.mjs).
    if (L.graceDue(lireEtat(), { acteurId, role: roleDe(acteur)?.system, cause })) return gracierLInnocent(acteur);
    // La Chambrière (logique/ambigus.mjs) : condamné par le vote, avant que sa carte soit retournée, elle peut la prendre ; la
    // révélation attend sa réponse. Prise, la carte n'est pas montrée.
    const chambriere = cause === "vote" ? await chambrierePour(acteurId) : "";
    if (!acteur.system.vivant) return [];
    // Un Somnambule meurt : on le découvre Somnambule (son vrai rôle remplace le rôle rêvé, avant toute révélation).
    await devoilerSomnambule(acteurId);
    // La Gazette : l'Enfouissement (une victime de la meute n'est jamais révélée), l'Exécuteur (seul lui apprend le rôle d'un condamné).
    const cacheParLaGazette = L.roleCacheParLaGazette(lireEtat(), { cause, villageois: villageoisAPlat() });
    const executeur = cacheParLaGazette === "executeur" ? L.executeurEnCharge(lireEtat(), villageoisAPlat()) : "";
    // (reveler retrouve ensuite la valeur demandée : un amant qui suit dans la mort n'est pas caché pour autant.)
    const revelerDemande = reveler;
    if (cacheParLaGazette) reveler = false;
    const montrer = chambriere ? false : reveler ?? reglage("revelerALaMort");
    reveler = revelerDemande;
    const visible = causePublique(cause);
    // Le rôle ne rejoint le document qu'au moment où il devient public (mort révélée).
    if (montrer) await revelerPubliquement(acteurId, { marquer: false, mort: true });
    // Le Village : un Métayer qui meurt (le dernier ? la charge de Bailli tombe avec lui).
    const etaitMetayer = L.estMetairie(L.batimentDe(lireEtat(), acteurId));
    await acteur.update({ "system.vivant": false, ...(montrer ? { "system.revele": true } : {}) });
    await modifierEtat(e => L.journaliser(L.ajouterMort(e, { acteurId, cause }), t("LAKOUR_LOUPS.Journal.Mort", { nom: acteur.name, cause: libelleCause(visible) })));
    await abolirSansMetayer(acteurId, etaitMetayer);
    // Un geste fait par le MJ (Braconnière : il emporte à sa place) : la demande au mourant se ferme (logique/derniers-gestes.mjs).
    fermerGestes(cause);
    // La Chambrière se dévoile et prend sa carte : rien de ce que sa mort aurait déclenché par sa carte ne joue (geste, sagesse).
    if (chambriere) await seDevouer(chambriere, acteurId);
    const reprise = L.carteReprise(lireEtat(), acteurId);
    try { await acteur.toggleStatusEffect("dead", { active: true, overlay: true }); } catch { /* sans jeton */ }
    const role = roleDe(acteur);
    const infos = { acteurId, revele: montrer, roleCle: montrer ? (role?.system.cle ?? "") : "" };
    annoncer("lakourLoups.elimination", [{ ...infos, cause }], [{ ...infos, cause: visible }]);
    await annonceChat(montrer && role
      ? t("LAKOUR_LOUPS.Messages.MortRevele", { nom: echapper(acteur.name), role: echapper(role.name), cause: echapper(libelleCause(visible)) })
      : t("LAKOUR_LOUPS.Messages.Mort", { nom: echapper(acteur.name), cause: echapper(libelleCause(visible)) }));
    // Les variantes : Double visage (grande complication), la seconde carte se retourne aussi ; la Veillée aux chandelles, la sienne
    // s'éteint (adaptation en ligne : la chandelle de sa carte, à la Table de jeu).
    const seconde = L.normaliserFiche(lireEtat().fiches?.[acteurId]).seconde;
    if (montrer && seconde) await annonceChat(echapper(t("LAKOUR_LOUPS.Variantes.DoubleVisage.Seconde", { nom: acteur.name, role: seconde.name })));
    if (L.chandellesActives(lireEtat())) await annonceChat(echapper(t("LAKOUR_LOUPS.Variantes.Chandelles.Eteinte", { nom: acteur.name })));
    // L'Aïeul tombé de la main du village : Brumecombe perd sa sagesse (avant tout dernier geste ou chagrin qui suivrait). Sa carte, ou sa
    // seconde carte (Double visage).
    const carteAieul = [role?.system, seconde?.system].find(s => s?.effet === L.EFFET_AIEUL) ?? role?.system;
    const sagesse = reprise ? { perdue: false } : L.sagesseALaMort(lireEtat(), { role: carteAieul, cause, villageois: villageoisAPlat() });
    if (sagesse.perdue) await perdreLaSagesse(acteur, sagesse.innocents);
    const carteEmporter = [role?.system, seconde?.system].find(s => s?.effet === "emporter");
    if (!reprise && carteEmporter && cause !== "emporte" && !L.pouvoirPerdu(L.sagesseEstPerdue(lireEtat()), carteEmporter)) {
      await noterPourMJ(t("LAKOUR_LOUPS.Messages.Emporter", { nom: acteur.name }), { notifier: true });
    }
    // Le Glas du deuil (variante) : un innocent exécuté par le vote fait sonner le glas.
    if (cause === "vote") await sonnerLeDeuil(acteur);
    // L'Enfant des bois dont c'était le modèle rejoint la meute (logique/ambigus.mjs).
    await orphelinsDe(acteurId);
    const morts = [acteurId];
    // Les Vendanges : le trompé n'entraîne personne ; le trompeur et le nouvel amant entraînent les deux autres.
    const triangle = L.triangleDe(lireEtat());
    const lieId = triangle?.trompe === acteurId ? "" : amoureuxDe(acteur);
    // Le Jour des sots (Gazette) : si l'un des amants meurt ce tour, l'autre survit.
    const lie = lieId && !L.amoursSuspendues(lireEtat()) ? game.actors.get(lieId) : null;
    if (lie?.system.vivant) morts.push(...await api.eliminer(lie.id, { cause: "chagrin", reveler }));
    for (const id of L.suiteDuTriangle(triangle, acteurId)) if (game.actors.get(id)?.system.vivant) morts.push(...await api.eliminer(id, { cause: "chagrin", reveler }));
    // L'Envoûtement : une envoûtée condamnée par le village entraîne toutes les envoûtées d'avant elle.
    if (cause === "vote" && L.envoutementActif(lireEtat())) morts.push(...await chuteDesEnvoutes(acteurId));
    // Le Greffier bègue a fait son signe : le second vote s'ouvre dès que les condamnés sont tombés.
    if (cause === "vote") await suivreSecondVote();
    // La Gazette : l'Exécuteur apprend la carte (ou, mort, désigne son successeur) ; le Crieur mort ; le Dépit, l'Enthousiasme.
    await apresUneMortDeLaGazette(acteurId, cause, { executeur, cache: cacheParLaGazette });
    // Le Bailli mort remet le sceau, le mourant qui porte un geste le fait (sans attendre ici : les demandes courent pendant que
    // la partie continue).
    suivreVacances();   // Le Village : ses bâtiments libérés attendent le Prévôt
    suivreGestes();
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
  // Une vérification à la fois, et jamais pendant qu'un dernier geste s'applique (sousVerrou) : deux vérifications lancées
  // ensemble (le narrateur, et le geste d'une Braconnière qui vient de répondre) déclareraient deux fois la victoire, ou une
  // victoire lue sur un village qui change sous elle.
  async verifierVictoire({ finDuJour = false } = {}) {
    exigerMJ();
    return sousVerrou(() => victoire.verifier({ finDuJour }));
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
    // L'Envoûtement : un envoûté a perdu tous ses pouvoirs, de jour aussi (seul lui le sait : le refus ne va qu'à lui).
    if (acteurId && L.envoutesDe(avant).includes(acteurId)) throw new Error(t("LAKOUR_LOUPS.Variantes.Envoutement.Refus"));
    let annonces = [];
    const r = await modifierEtat(e => {
      const x = L.appliquerPouvoir({ villageois, etat: e, acteurId, pouvoir, cibles, texte, batiments: cles });
      if (!x.ok) throw new Error(libelleRefus(x.raison, L.POUVOIRS_JOUR[pouvoir]));
      annonces = x.annonces.map(texteMessage);
      let etat = x.etat;
      // Le Village : le pouvoir public d'une personnalité entre au Registre.
      if (x.village) L.inscrire(etat, { type: "village", ...x.village });
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
      else if (c.type === "masque") await tomberLeMasque(c.acteurId);
    }
    for (const a of annonces) await annonceChat(echapper(a));
    for (const p of r.prives) await envoyerSecret(p.destinataire, { texte: texteMessage(p) });
    // La cloche du Sonneur pendant le vote : le vote ouvert devient double (tous les navigateurs le voient).
    if (r.voteChange && !r.rouvrirVote) annoncer("lakourLoups.phase", ["vote", lireEtat()], ["vote", L.etatPublic(lireEtat())]);
    if (r.rouvrirVote) {
      annoncer("lakourLoups.phase", ["vote", r.etat], ["vote", L.etatPublic(r.etat)]);
      annoncer("lakourLoups.voteOuvert", [{ objet: r.etat.vote.objet, numero: r.etat.vote.numero }]);
      faireVoterLesCompagnons(r.etat);
      demanderVoixDuDeuil(r.etat);
    }
    // La Conteuse n'est pas nommée chez les autres.
    const publicInfos = { pouvoir, annonces, ...(L.POUVOIRS_JOUR[pouvoir].source === "role" && pouvoir !== "juge-de-paix" ? {} : { acteurId }) };
    // Le signe du Greffier bègue est SECRET : rien n'en sort chez les joueurs (le MJ le lit dans sa chronique) ; le second vote
    // s'ouvre aussitôt si les condamnés sont déjà tombés.
    if (pouvoir === L.CLE_GREFFIER) {
      Hooks.callAll("lakourLoups.jour", { acteurId, pouvoir, cibles, annonces });
      await modifierEtat(e => L.journaliserSecret(e, t("LAKOUR_LOUPS.Pacte.GreffierNote", { nom: nomDe(acteurId) })));
      await suivreSecondVote();
      await sceller();
      return { pouvoir, annonces };
    }
    annoncer("lakourLoups.jour", [{ acteurId, pouvoir, cibles, annonces }], [publicInfos]);
    if (r.village) annoncer("lakourLoups.village", [{ ...r.village }]);
    // La Gazette : le Crieur révoqué, le nouveau reçoit les cartes de la charge (à son carnet).
    if (r.gazette?.quoi === "crieur") {
      await envoyerLaMainDuCrieur(r.gazette.acteurId);
      annoncer("lakourLoups.gazette", [{ quoi: "crieur", acteurId: r.gazette.acteurId }]);
    }
    // Le rasoir du Perruquier : sa victime tombe (cause « rasoir »), puis lui-même s'il s'est trompé ; la victoire est vérifiée.
    if (r.morts?.length) {
      for (const m of r.morts) await api.eliminer(m.acteurId, { cause: m.cause });
      await api.verifierVictoire();
    }
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
    suivreLeCrieur();
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
    const camp = L.campDePassage({ villageois: villageoisAPlat().filter(x => x.vivant !== false), peste: L.estPeste(avant), niveau: avant.aConsigner?.niveau ?? "" });
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
      // Ses traits visibles (gazette.mjs), équilibrés avec ceux du village.
      e.traits = { ...e.traits, ...L.tirerTraits([{ id: acteur.id, maison }], { imposes: traitsImposes(acteur) ? { [acteur.id]: traitsImposes(acteur) } : {}, deja: e.traits }) };
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

  // ---------------------------------------------------------------- les rôles du Village du Pacte (logique/pacte.mjs)
  // Ce qui en est public (tous) : { innocentSuit, sagessePerdue, gracies, egalite, votants, plume, secondVote }.
  pacte() {
    return foundry.utils.deepClone(L.normaliserPacte(lirePublic().pacte));
  },
  // Le narrateur dicte la liste du Souffre-douleur mort d'une égalité (à sa place, ou sous sa dictée) : ceux qui voteront aux votes
  // d'exécution de demain (des vivants, un au moins). Ferme sa demande posthume encore ouverte. par : le Souffre-douleur
  // (par défaut, celui de la dernière égalité). -> la liste retenue
  async designerVotants(acteurIds = [], { par = "" } = {}) {
    exigerMJ();
    const de = par || L.normaliserPacte(lireEtat().pacte).egalite?.acteurId || "";
    const ids = L.candidatsDuGeste(villageoisAPlat(), de, { etat: lireEtat(), geste: "votants" }).filter(id => acteurIds.includes(id));
    if (!de || !ids.length) throw new Error(t("LAKOUR_LOUPS.Erreurs.Votants"));
    for (const [id, p] of [...enAttente.entries()]) if (p.demande.posthume && p.demande.objet === "votants") terminer(id, [], true);
    await poserLesVotants(de, ids);
    return ids;
  },

  // ---------------------------------------------------------------- le Pacte, étape 3b : ambigus, solitaires du livre, Loup pâle
  // Ce que la table voit (tous, d'après l'état public) : les cartes du Bateleur encore face visible et celles déjà jouées, le jour
  // qui commence la veillée (Feu follet), les deux groupes annoncés pour l'Illuminé, les dévouements de la Chambrière.
  // -> { bateleur: [{ cle, nom, img }], retirees: [cle], commenceParLeJour, groupes: null | { critere, a: [{ id, nom }], b }, devouements }
  ambigus() {
    const a = L.normaliserAmbigus(lirePublic().ambigus);
    const noms = ids => ids.map(id => ({ id, nom: nomDe(id) }));
    return foundry.utils.deepClone({ ...a, groupes: a.groupes ? { critere: a.groupes.critere, a: noms(a.groupes.a), b: noms(a.groupes.b) } : null });
  },
  // Les secrets des ambigus (MJ actif ; SECRET) : les cartes du centre (noms), les modèles, les Mâtins, les charmés, les cartes jouées.
  ambigusSecrets() {
    exigerMJ();
    const s = L.normaliserAmbigusSecret(lireEtat().ambigusSecret);
    return foundry.utils.deepClone({ centre: s.centre.map(r => ({ cle: r.system?.cle ?? "", nom: r.name ?? "" })), modeles: s.modeles, matins: s.matins,
      charmes: s.charmes, emprunts: Object.fromEntries(Object.entries(s.emprunts).map(([id, e]) => [id, { cle: e.cle, tour: e.tour }])) });
  },
  // Le narrateur choisit lui-même les trois cartes du Bateleur (clés de rôles permis : à pouvoir de nuit, hors meute, pas au paquet),
  // avant la première nuit. Annoncé à tous. -> les cartes posées
  async cartesDuBateleur(cles = []) {
    exigerMJ();
    const etat = lireEtat();
    if (!etat.partie || etat.tour >= 1) throw new Error(t("LAKOUR_LOUPS.Ambigus.Refus.tard"));
    const paquet = [...Object.values(etat.fiches ?? {}).map(f => L.normaliserFiche(f).role?.system.cle).filter(Boolean),
      ...etat.ambigusSecret.centre.map(r => r.system?.cle).filter(Boolean)];
    const possibles = await cartesPossiblesDuBateleur(paquet);
    const voulues = [...new Set(cles)].map(c => possibles.find(p => p.cle === c));
    if (!voulues.length || voulues.length > L.CARTES_DU_BATELEUR || voulues.some(c => !c)) throw new Error(t("LAKOUR_LOUPS.Ambigus.Refus.cartes", { n: L.CARTES_DU_BATELEUR }));
    const texte = t("LAKOUR_LOUPS.Ambigus.CartesDuBateleur", { roles: voulues.map(c => c.nom).join(", ") });
    await modifierEtat(e => { e.ambigus = { ...e.ambigus, bateleur: voulues, retirees: [] }; return L.journaliser(e, texte); });
    await annonceChat(echapper(texte));
    await sceller();
    return foundry.utils.deepClone(voulues);
  },

  // ---------------------------------------------------------------- le socle du Pacte : cercle, gestes, tenures, événements
  // L'ordre des places autour de la table (logique/cercle.mjs ; public, tous les navigateurs) : [{ acteurId, nom, vivant }].
  cercle() {
    const villageois = villageoisAPlat();
    return L.cercleDe(lirePublic(), villageois).map(id => ({ acteurId: id, nom: game.actors.get(id)?.name ?? id,
      vivant: villageois.find(v => v.id === id)?.vivant !== false }));
  },
  // Les voisins d'une place (public) : { gauche, droite } (acteurId, "" si personne) ; vivantsSeulement : les morts sautés.
  voisins(acteurId, { vivantsSeulement = true } = {}) {
    return L.voisins(lirePublic(), villageoisAPlat(), acteurId, { vivantsSeulement });
  },
  // Les derniers gestes qui attendent leur mourant (MJ actif : le geste dit son rôle) : [{ acteurId, nom, geste, demande }]
  // (demande : la question est en ce moment chez lui).
  derniersGestes() {
    exigerMJ();
    return L.gestesEnAttente(lireEtat(), villageoisAPlat()).map(g => ({ ...g, nom: game.actors.get(g.acteurId)?.name ?? g.acteurId,
      demande: gestesEnCours.get(g.acteurId) === g.geste }));
  },
  // Les bâtiments tenus (logique/tenures.mjs ; public) : [{ cle, acteurId (null : vacant), nom }].
  tenures() {
    return Object.entries(lirePublic().tenures).map(([cle, acteurId]) => ({ cle, acteurId, nom: acteurId ? game.actors.get(acteurId)?.name ?? acteurId : "" }));
  },
  // Confie un bâtiment à un vivant (acteurId "" ou null : le bâtiment devient vacant). MJ actif ; public (Registre non touché :
  // la réattribution par le Prévôt viendra avec lui). -> les tenures
  async tenir(cle, acteurId = null) {
    exigerMJ();
    if (!cle) throw new Error(t("LAKOUR_LOUPS.Tenures.Refus.cle"));
    if (acteurId) {
      const a = acteurOuErreur(acteurId);
      if (!a.system.vivant) throw new Error(t("LAKOUR_LOUPS.Tenures.Refus.mort", { nom: a.name }));
    }
    await modifierEtat(e => (acteurId ? L.tenir(e, cle, acteurId) : L.liberer(e, cle)));
    await sceller();
    return api.tenures();
  },

  // ---------------------------------------------------------------- le Pacte, étape 4 : la variante « Le Village » (public)
  // -> { actif, batiments: [{ cle, nom, personnalite, titre, aide, pouvoir: "permanent" | "unique", acteurId, occupant, disponible }],
  //      detruits: [{ cle, nom }], chemineaux: [{ acteurId, nom }], regent: null | { tour, ids, noms, par }, graces, cabaret }
  // disponible : le pouvoir est entre les mains de son occupant (ni servi, ni perdu, ni éteint avec la sagesse).
  village() {
    const e = lirePublic();
    const v = L.normaliserVillage(e.village);
    const villageois = villageoisAPlat();
    const cles = Object.keys(L.BATIMENTS_DU_VILLAGE).filter(cle => cle in e.tenures);
    return foundry.utils.deepClone({
      actif: v.actif,
      batiments: cles.map(cle => {
        const id = L.occupant(e, cle);
        const p = L.personnaliteDuBatiment(cle);
        return { cle, nom: nomDuBatiment(cle), personnalite: p, titre: nomDePersonnalite(p), aide: t(`LAKOUR_LOUPS.Village.Personnalites.${p}.Aide`),
          pouvoir: L.BATIMENTS_DU_VILLAGE[cle].pouvoir, acteurId: id, occupant: id ? nomDe(id) : "", disponible: Boolean(id) && L.pouvoirIntact(e, cle, id) };
      }),
      detruits: v.detruits.map(cle => ({ cle, nom: nomDuBatiment(cle) })),
      chemineaux: L.chemineaux(e, villageois).map(id => ({ acteurId: id, nom: nomDe(id) })),
      regent: v.regent ? { ...v.regent, noms: nomsDe(v.regent.ids) } : null, graces: v.graces, cabaret: v.cabaret
    });
  },
  // La personnalité d'un villageois (public) : { cle (bâtiment, "" pour un Chemineau), personnalite, titre, aide } ; null hors de la variante.
  personnalite(acteurId) {
    const e = lirePublic();
    const p = L.personnaliteDe(e, acteurId);
    if (!p) return null;
    return { cle: L.batimentDe(e, acteurId), personnalite: p, titre: nomDePersonnalite(p), aide: t(`LAKOUR_LOUPS.Village.Personnalites.${p}.Aide`),
      batiment: L.batimentDe(e, acteurId) ? nomDuBatiment(L.batimentDe(e, acteurId)) : "" };
  },
  // Le narrateur confie un bâtiment du village à un vivant (avant la première nuit : changer la proposition ; ensuite : une correction).
  // Celui qui le reçoit rend le sien (s'il en tenait un) à l'ancien occupant : un échange ; acteurId "" : le bâtiment devient vacant
  // (et son occupant, Chemineau). Le pouvoir est rétabli pour le nouvel occupant. Annoncé à tous. -> api.village()
  async installer(cle, acteurId = "") {
    exigerMJ();
    const avant = lireEtat();
    if (!L.villageActif(avant) || !L.estDuVillage(cle)) throw new Error(t("LAKOUR_LOUPS.Tenures.Refus.village"));
    if (L.normaliserVillage(avant.village).detruits.includes(cle)) throw new Error(t("LAKOUR_LOUPS.Tenures.Refus.detruit"));
    if (acteurId) {
      const a = acteurOuErreur(acteurId);
      if (!a.system.vivant) throw new Error(t("LAKOUR_LOUPS.Tenures.Refus.mort", { nom: a.name }));
    }
    const ancien = L.occupant(avant, cle);
    const sien = acteurId ? L.batimentDe(avant, acteurId) : "";
    if (ancien === (acteurId || "")) return api.village();
    await modifierEtat(e => {
      L.installer(e, cle, acteurId || null);
      if (sien && sien !== cle) L.installer(e, sien, ancien || null);
      L.inscrire(e, { type: "village", quoi: "changement", acteurId: acteurId || ancien, cle });
      return e;
    });
    const texte = acteurId
      ? t("LAKOUR_LOUPS.Village.Change", { nom: nomDe(acteurId), batiment: nomDuBatiment(cle), personnalite: nomDePersonnalite(L.personnaliteDuBatiment(cle)) })
      : t("LAKOUR_LOUPS.Village.Libere", { nom: nomDe(ancien), batiment: nomDuBatiment(cle) });
    await annoncerAuVillage(texte);
    annoncer("lakourLoups.village", [{ quoi: "changement", acteurId: acteurId || ancien, cle }]);
    await sceller();
    return api.village();
  },
  // ---------------------------------------------------------------- la Gazette de la lune (logique/gazette.mjs, Le Pacte, étape 9)
  // Le public de la Gazette (tous) : { actif, rythme, choix, restantes, tirees: [{ cle, tour, lecteur, source, nom, effet }], cartes en jeu
  // (actives : [{ cle, nom, effet }]), conduite (les cartes de conduite du jour), absents, proteges, prives, crieur: { acteurId, nom, cartes },
  // executeur: { acteurId, nom, attendu }, spiritisme: { restantes, derniere }, variante: { cle, carte, appliquee } | null }.
  gazette() {
    const e = lirePublic();
    const g = L.normaliserGazette(e.gazette);
    const carte = cle => ({ cle, nom: nomDeCarte(cle), effet: effetDeCarte(cle) });
    const enCours = [...new Set(L.evenementsEnCours(e).filter(ev => ev.source === "gazette").map(ev => ev.cle))].map(carte);
    return { actif: g.actif, rythme: g.rythme, choix: g.choix, restantes: g.restantes, tirees: g.tirees.map(x => ({ ...x, ...carte(x.cle) })), enCours,
      conduite: L.conduiteDuJour(e), absents: L.absentsDuJour(e), proteges: L.protegesDuJour(e), prives: L.privesDuJour(e),
      crieur: { ...g.crieur, nom: g.crieur.acteurId ? nomDe(g.crieur.acteurId) : "" },
      executeur: { ...g.executeur, nom: g.executeur.acteurId ? nomDe(g.executeur.acteurId) : "" },
      spiritisme: foundry.utils.deepClone(g.spiritisme), variante: g.variante, commis: g.commis, marches: g.marches.map(m => m.acteurId) };
  },
  // Les secrets de la Gazette (MJ actif) : { paquet: [cle] (le dessus en tête), main: [cle] (les cartes du Crieur), sots, allies, vuUnLoup, seance }.
  gazetteSecrets() {
    exigerMJ();
    return foundry.utils.deepClone(L.normaliserGazetteSecret(lireEtat().gazetteSecret));
  },
  // Les traits visibles (publics) : de ce villageois, ou de tous { acteurId: trait } ; texte : la ligne lisible.
  traits(acteurId = "") {
    const e = lirePublic();
    if (acteurId) { const x = L.traitsDe(e, acteurId); return x ? { ...x, texte: texteDesTraits(x) } : null; }
    return Object.fromEntries(Object.entries(L.normaliserTraits(e.traits)).map(([id, x]) => [id, { ...x, texte: texteDesTraits(x) }]));
  },
  // Le narrateur lit une carte (le mode « le narrateur choisit ses cartes », ou une carte de plus) : du paquet si elle y est, sinon hors
  // paquet ; lecteur : le dernier éliminé par défaut. -> la clé
  async lireUneCarte(cle, { lecteur } = {}) {
    exigerMJ();
    if (!L.estCarteDeLaGazette(cle)) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.carte", { cle: String(cle) }));
    const e = lireEtat();
    if (!e.partie || e.vainqueur || !["aube", "jour"].includes(e.phase)) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.moment"));
    await modifierEtat(x => { L.prendreLaCarte(x, cle); return x; });
    await poserUneCarte(cle, { lecteur: lecteur ?? L.dernierElimine(e), source: "narrateur" });
    await sceller();
    return cle;
  },
  // Le narrateur retire le vote d'un contrevenant ce tour (Lune noire, Bonnes manières, Ni loup ni moi). pourquoi : un mot interdit, ou "".
  async priverDeVote(acteurId, { pourquoi = "" } = {}) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    const e = lireEtat();
    const cartes = L.conduiteDuJour(e);
    if (!cartes.length) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.conduite"));
    if (L.privesDuJour(e).includes(acteurId)) return false;
    await modifierEtat(x => {
      const g = L.normaliserGazette(x.gazette);
      g.prives.push({ tour: x.tour, acteurId, cle: cartes[0] });
      x.gazette = g;
      L.inscrire(x, { type: "gazette", quoi: "prive", acteurId });
      return x;
    });
    await annoncerGazette(t(pourquoi ? "LAKOUR_LOUPS.Gazette.Conduite.Mot" : "LAKOUR_LOUPS.Gazette.Conduite.Prive", { nom: a.name, mot: pourquoi }), { quoi: "prive", acteurId });
    // Sa voix déjà donnée ne compte plus.
    if (lireEtat().vote.ouvert && lireEtat().vote.votes[acteurId] !== undefined) await modifierEtat(x => { delete x.vote.votes[acteurId]; x.vote.exprimes = Object.keys(x.vote.votes); return x; });
    await sceller();
    return true;
  },
  // Ni loup ni moi : un mot dit au chat (ou à l'oral, rapporté par le MJ IA) ; un mot défendu retire le vote de son auteur ce tour. -> le mot, ou ""
  async releverLaParole(acteurId, texte = "") {
    exigerMJ();
    const e = lireEtat();
    if (!L.carteDuJour(e, "ni-loup-ni-moi") || !game.actors.get(acteurId)?.system.vivant || L.privesDuJour(e).includes(acteurId)) return "";
    const mot = L.motInterdit(texte, game.i18n?.lang === "en" ? "en" : "fr");
    if (mot) await api.priverDeVote(acteurId, { pourquoi: mot });
    return mot;
  },
  // Le narrateur applique ce tour la variante que propose la carte (Dimanche de soleil, Fin des vendanges, Lundi gris). -> la clé de la variante
  async appliquerLaVarianteDuJour() {
    exigerMJ();
    let r = { ok: false, cle: "" };
    await modifierEtat(e => { r = L.appliquerLaVarianteDuJour(e); return e; });
    if (!r.ok) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.variante"));
    await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Variante.Appliquee", { nom: nomDeVariante(r.cle) }), { quoi: "variante", cle: r.cle });
    await sceller();
    return r.cle;
  },
  // Le narrateur confie au Crieur public ses cartes (avant la première nuit ; jamais de Spiritisme) : elles quittent le paquet. -> la main
  async cartesDuCrieur(cles = []) {
    exigerMJ();
    const e = lireEtat();
    if (!e.gazette.crieur.actif) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.crieur"));
    if (e.phase !== "preparation" || e.tour > 0) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.avant"));
    const main = [...new Set(cles.filter(L.estCarteDeLaGazette))];
    await modifierEtat(x => {
      const s = L.normaliserGazetteSecret(x.gazetteSecret);
      const rendues = s.main.filter(c => !main.includes(c));
      s.main = main;
      if (x.gazette.actif) s.paquet = L.melanger([...s.paquet.filter(c => !main.includes(c)), ...rendues]);
      x.gazetteSecret = s;
      x.gazette = { ...L.normaliserGazette(x.gazette), restantes: s.paquet.length };
      x.gazette.crieur.cartes = main.length;
      return L.journaliserSecret(x, t("LAKOUR_LOUPS.Gazette.Crieur.NoteMain", { cartes: main.map(nomDeCarte).join(", ") || "—" }));
    });
    await sceller();
    return main;
  },
  // Le narrateur nomme le Crieur public (une correction, ou un Bailli qui le dit à voix haute) : un vivant, jamais le Bailli.
  async nommerCrieur(acteurId) {
    exigerMJ();
    const a = acteurOuErreur(acteurId);
    const e = lireEtat();
    if (!e.gazette.crieur.actif || !a.system.vivant || e.bailli.acteurId === acteurId) throw new Error(t("LAKOUR_LOUPS.Gazette.Refus.nommer", { nom: a.name }));
    const ancien = e.gazette.crieur.acteurId;
    await modifierEtat(x => { L.nommerLeCrieur(x, { acteurId, par: x.bailli.acteurId }); return x; });
    await annoncerGazette(t("LAKOUR_LOUPS.Gazette.Crieur.NommeParLeNarrateur", { nom: a.name }), { quoi: "crieur", acteurId });
    if (ancien !== acteurId) await envoyerLaMainDuCrieur(acteurId);
    await sceller();
    return acteurId;
  },
  // Ce qui court encore pour la Gazette (le matin, le Crieur, les Influences).
  attendreGazette: () => attendreGazette(),

  // Les événements en cours ou à venir (logique/evenements.mjs ; public), le présage de l'Almanach compris :
  // [{ cle, type, quand, tire, debut, fin, source?, actif }] (actif : il vaut à ce tour, à cette phase).
  evenements() {
    const e = lirePublic();
    return L.evenementsEnCours(e).map(ev => ({ ...ev, actif: L.evenementVaut(ev, e.tour, e.phase) }));
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
  // roleSeul : le rôle sans son camp public (revelerPubliquement, sansCamp ; la variante Double visage, plus tard).
  async reveler(acteurId, { roleSeul = false } = {}) {
    exigerMJ();
    acteurOuErreur(acteurId);
    await revelerPubliquement(acteurId, { sansCamp: Boolean(roleSeul) });
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

// Le Pacte, étape 3b : les charmés du Joueur de vielle se réveillent ensemble (reveiller("charmes")) ; chacun apprend les autres
// (noterAction, logique/ambigus.mjs). Rien à choisir.
async function reveillerLesCharmes(entree) {
  reveilsEnCours.add(L.CLE_CHARMES);
  Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_CHARMES, enCours: true });
  try {
    await api.noterAction({ acteurId: entree.acteurIds[0], roleCle: L.CLE_CHARMES, cibles: [] });
  } finally {
    reveilsEnCours.delete(L.CLE_CHARMES);
    Hooks.callAll("lakourLoups.reveil", { roleCle: L.CLE_CHARMES, enCours: false });
  }
  return { roleCle: L.CLE_CHARMES, acteurIds: [...entree.acteurIds], cibles: [], texte: "" };
}

// Le Chapardeur (les deux cartes du centre) et le Bateleur (ses cartes face visible) choisissent une CARTE : la fenêtre de choix
// les leur montre (options { id, nom, img }) ; la réponse est notée avec la carte (noterAction : { carte }). Le Chapardeur dont les
// deux cartes sont de la meute doit en prendre une (sans réponse : au hasard). -> { roleCle, acteurIds, cibles: [], carte }
async function reveillerPourUneCarte(entree, role, { delai }) {
  const acteurId = entree.acteurIds[0];
  const roleCle = entree.roleCle;
  const etat = lireEtat();
  const chapardeur = role.system.effet === L.EFFET_CHAPARDEUR;
  const options = chapardeur
    ? (etat.ambigusSecret.chapardes.includes(acteurId) ? [] : etat.ambigusSecret.centre.map((r, i) => ({ id: `centre-${i}`, nom: r.name, img: r.img ?? "" })))
    : L.cartesJouables(etat).map(c => ({ id: c.cle, nom: c.nom, img: c.img }));
  const invite = chapardeur ? t(L.chapardeurOblige(etat.ambigusSecret.centre) ? "LAKOUR_LOUPS.Ambigus.ChapardeurOblige" : "LAKOUR_LOUPS.Ambigus.ChapardeurInvite")
    : role.system.nuit.invite || t("LAKOUR_LOUPS.Choix.InviteParDefaut");
  reveilsEnCours.add(roleCle);
  Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: true });
  let carte = "";
  try {
    const [choix = ""] = options.length ? await demandeLibre({ acteurId, invite, candidats: options, nombre: 1, delai, objet: roleCle }) : [];
    carte = chapardeur ? (choix ? Number(choix.slice("centre-".length)) : "") : choix;
    await api.noterAction({ acteurId, roleCle, cibles: [], carte });
  } finally {
    reveilsEnCours.delete(roleCle);
    Hooks.callAll("lakourLoups.reveil", { roleCle, enCours: false });
  }
  return { roleCle, acteurIds: [...entree.acteurIds], cibles: [], texte: "", carte };
}
