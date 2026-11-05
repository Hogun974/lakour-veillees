// Le coffre des secrets des Veillées : le coffre du MJ IA (module lakour-mj-ia, toujours actif dans ce monde ; scripts/coffre.js
// et coffre-logique.js), par son API game.modules.get("lakour-mj-ia").api.coffre. Rien n'est dupliqué ici : la clé (AES-GCM
// 256 bits), ses parts (Shamir, seuil à la MAJORITÉ des comptes joueurs ; aux Veillées, monde à rôles secrets, le moteur n'en
// confie AUCUNE aux joueurs : seuls la clé de secours du MJ et un autre MJ connecté la rendent), leur accusé de réception, leur rangement par
// [monde][userId][id de clé] chez chaque joueur, l'empreinte SHA-256 publiée au trousseau, le renouvellement transactionnel, le
// passage de clé entre MJ et la clé de secours sont ceux du moteur (docs/loups-contrat.md §6).
//
// - Ranger (MJ actif) : les secrets de la partie (secrets.mjs) sont scellés avec la clé en vigueur du moteur dans le réglage
//   monde « coffre » ({ partie, chiffre, id, iv, donnees } : livré à tous, illisible sans la clé). PAS à chaque garde des
//   secrets : une écriture du réglage pendant la nuit, à chaque choix, trahirait le rythme des réveils (combien de rôles
//   agissent, quand la meute a choisi). On scelle aux moments PUBLICS (changement de phase, aube résolue, vote clos, mort,
//   arrivée, départ, distribution, victoire), à intervalle fixe pendant une partie (battement : toujours, même sans
//   changement, avec un vecteur neuf : rien ne dit si quelque chose a bougé) et avant un rechargement prévu (beforeunload, au
//   mieux). Entre deux, tout reste dans la mémoire du MJ et dans son navigateur (secrets.mjs) : rien n'est perdu pour lui.
// - Retrouver (MJ actif sans les secrets : autre navigateur, autre MJ) : le moteur ouvre le coffre s'il a la clé, sinon il en
//   demande la clé aux autres MJ connectés (aux Veillées, aucune part n'est chez les joueurs ; la clé de secours la rend) ; le hook « lakour-mj-ia.coffreRouvert » relance l'ouverture.
//   Tant qu'il attend, ce navigateur ne rescelle rien : le coffre d'une partie n'est jamais écrasé par des secrets incomplets.
// - Renouvellement du moteur (un compte créé, supprimé, qui change de rôle) : avant que la nouvelle clé n'entre en vigueur, le
//   moteur appelle siRenouvele : le coffre est rescellé avec elle.
// - Sans le moteur (module coupé), aucune partie ne se distribue (api.distribuer : erreur claire, LAKOUR_LOUPS.Erreurs.SansCoffre).
// - Migration (parties commencées avant 0.9.0) : l'ancien coffre ({ partie, iv, donnees }, logique/coffre.mjs) s'ouvre avec
//   l'ancienne clé du MÊME navigateur du MJ (réglage client « cleCoffre »), puis il est rescellé avec le coffre du moteur et
//   l'ancienne clé effacée. Les anciennes parts (seuil 2, rendues à n'importe quel MJ) ne servent plus : chaque joueur les efface.
// - Révision (relecture 7) : l'enveloppe du coffre porte en clair sa révision (rev, croissante) ; les secrets de ce navigateur
//   gardent la révision et le vecteur (ivCoffre) du dernier coffre qu'ils ont scellé ou ouvert (secrets.mjs, revCoffre). Ils sont
//   « à jour » si c'est ce coffre-là (même vecteur), ou s'ils sont au moins aussi récents (revCoffre >= rev). On ne scelle que des
//   secrets à jour : un MJ redevenu actif avec des secrets périmés ne peut plus écraser le coffre récent d'un autre MJ ; il le
//   rouvre. Un MJ actif rechargé (F5) retrouve ses secrets ET leur révision : il rescelle comme avant.
// - Garde (relecture 7) : tant que les secrets de la partie en cours ne sont pas à jour chez le MJ actif (autre navigateur, autre
//   MJ devenu actif, parts attendues), RIEN de la partie ne s'écrit (api.mjs, modifierEtat ; verifierVictoire ne déclare rien) :
//   jamais de secrets vides rangés sous le nom de la partie, jamais une fausse victoire. Le coffre est cherché aussitôt.
// - Changement de MJ actif (userConnected, MJ compris) : celui qui prend la main relit son navigateur et, s'il n'est pas à jour,
//   cherche le coffre (clé du moteur : passage de clé d'un autre MJ connecté, ou clé de secours réimportée) ; celui qui la perd scelle
//   aussitôt (passation) puis vide sa mémoire.
// - Relecture 8 : « à jour » = le même coffre (même vecteur) ou une révision STRICTEMENT plus récente (deux scellements calculés
//   depuis la même révision, passation et premier scellement du nouveau MJ, portent le même rev : le perdant n'est pas à jour) ; le
//   coffre est relu juste avant d'écrire (changé entre-temps : on n'écrit pas, on le rouvre). Une nouvelle partie (distribution,
//   remise à zéro) oublie les parts attendues de l'ancienne ; un secret rouvert qui n'est pas de la partie publique est refusé. La
//   passation attend la fin des écritures en cours (api.mjs : elles s'arrêtent d'elles-mêmes, ce navigateur n'étant plus MJ actif).
//   Après un scellement avec le moteur, l'ancienne clé (cleCoffre, avant 0.9.0) de ce navigateur est effacée.
import { ID } from "../logique/constantes.mjs";
import { estAncien, ouvrirAncien } from "../logique/coffre.mjs";
import { estMJActif } from "./canal.mjs";
import { garderSecrets, secretsMJ, oublierSecrets, noterRevision } from "./secrets.mjs";

export const MODULE_COFFRE = "lakour-mj-ia";
// Le battement : un scellement par minute pendant une partie, chez le MJ actif.
export const BATTEMENT = 60000;

let file = Promise.resolve();
let attendue = "";           // la partie dont ce MJ attend les parts (moteur)
let retrouves = null;        // rappel quand les secrets sont retrouvés
let rappelParDefaut = null;  // le rappel de lakour-loups.mjs (Table, fiches et salons à redessiner)
let minuterie = null;
let rappelsPoses = null;     // l'API du moteur où les rappels (renouvellement, clé revenue) sont posés : une fois par API
let ecrituresEnCours = () => Promise.resolve();   // la file des écritures de la partie (api.mjs)
let avertiSansCle = "";      // la partie pour laquelle le MJ a été averti que la clé du moteur manque
const t = cle => globalThis.game?.i18n?.localize?.(cle) ?? cle;

const lire = nom => { try { return game.settings.get(ID, nom) ?? {}; } catch { return {}; } };
const objet = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const publicEtat = () => { try { return game.settings.get(ID, "partie") ?? {}; } catch { return {}; } };
const partiePublique = () => publicEtat().partie ?? "";
const phasePublique = () => publicEtat().phase ?? "";
const revDe = coffre => (Number.isFinite(Number(coffre?.rev)) && coffre?.rev !== undefined ? Number(coffre.rev) : null);

// Le coffre du moteur, s'il est là : { sceller, scellerAvec, ouvrirScelle, siRenouvele, siDisponible, etat, … }.
export function coffreDuMoteur() {
  const c = game.modules?.get?.(MODULE_COFFRE)?.api?.coffre;
  return c && typeof c.sceller === "function" && typeof c.ouvrirScelle === "function" ? c : null;
}
export const coffreDisponible = () => Boolean(coffreDuMoteur());

export function oublierCoffre() {
  file = Promise.resolve();
  attendue = "";
  retrouves = null;
  avertiSansCle = "";
  if (minuterie) clearInterval(minuterie);
  minuterie = null;
}
export const surSecretsRetrouves = fn => { rappelParDefaut = fn; };
// api.mjs donne sa file d'écritures : la passation l'attend.
export const suivreEcritures = fn => { ecrituresEnCours = fn; };
// Hook local : l'attente des secrets commence ou finit (la Table, le MJ IA : pilote et narrateur se mettent en pause).
// (Sans rien calculer ici : relire les secrets rechargerait la mémoire que perdreLaMain vient de vider.)
const signaler = () => { try { Hooks.callAll("lakourLoups.secrets"); } catch { /* sans Hooks */ } };

// Une écriture qui commence une autre partie (distribuer, « Rejouer », remise à zéro : api.mjs, sansSecrets) : les parts attendues
// de l'ancienne ne servent plus (elles bloqueraient la nouvelle, puis rouvriraient l'ancienne par-dessus).
export function changementDePartie(partie) {
  if (!attendue || attendue === partie) return;
  attendue = "";
  retrouves = null;
  avertiSansCle = "";
  signaler();
}

// ------------------------------------------------------------------ à jour ?
// Les secrets de ce navigateur sont-ils ceux de la partie en cours, et pas plus vieux que son coffre ? Une partie sans coffre à son
// nom (neuve) ou un ancien coffre (avant 0.9.0) : oui, s'ils sont de cette partie.
export function secretsAJour(partie = partiePublique()) {
  const s = secretsMJ();
  if (!partie || s?.partie !== partie) return false;
  const coffre = lire("coffre");
  if (coffre.partie !== partie || estAncien(coffre)) return true;
  if (s.ivCoffre && s.ivCoffre === coffre.iv) return true;
  // Pas ce coffre-là : à jour seulement si plus récent (révision notée ici, coffre pas encore écrit) ; à révision égale, un autre
  // contenu (deux scellements depuis la même révision) : pas à jour.
  const rev = revDe(coffre);
  return rev !== null && (Number(s.revCoffre) || 0) > rev;
}

// Écrire la partie est-il interdit ici ? Pendant une partie (distribuée, pas finie) : secrets pas à jour, ou parts attendues.
export function ecritureBloquee() {
  const p = publicEtat();
  if (!p.partie || p.phase === "fin") return false;
  return Boolean(attendue) || !secretsAJour(p.partie);
}

// La garde de toute écriture (api.mjs) : lève une erreur claire et cherche aussitôt le coffre.
export function exigerSecretsAJour(message) {
  if (!ecritureBloquee()) return;
  if (!attendue && estMJActif()) chercherSecrets(partiePublique(), rappelParDefaut).catch(e => console.warn(`${ID} | coffre`, e));
  throw new Error(message);
}

// Les rappels du moteur (renouvellement : rescellement avec la nouvelle clé ; clé revenue : ouvrir ce qui attendait), une fois
// pour toutes (par API publiée du moteur). Appelés DANS la file du moteur : ils n'attendent rien qui passe par elle (scellerAvec est direct).
function brancher() {
  const c = coffreDuMoteur();
  if (!c || rappelsPoses === c) return c;
  rappelsPoses = c;
  c.siRenouvele?.(async cle => {
    const s = secretsMJ();
    const moteur = coffreDuMoteur();
    if (!moteur || !estMJActif() || !s?.partie || s.partie !== partiePublique() || attendue || !secretsAJour(s.partie)) return;
    const coffre = lire("coffre");
    const rev = (coffre.partie === s.partie ? revDe(coffre) ?? 0 : 0) + 1;
    const scelle = await moteur.scellerAvec({ ...s, revCoffre: rev }, cle);
    await noterRevision(s.partie, rev, scelle.iv);
    await game.settings.set(ID, "coffre", { partie: s.partie, rev, ...scelle });
  });
  c.siDisponible?.(() => {
    // Hors de la file du moteur : la suite passe par elle.
    setTimeout(() => { if (attendue) essayer().catch(e => console.warn(`${ID} | coffre`, e)); else sceller().catch(() => null); }, 0);
  });
  return c;
}

// ------------------------------------------------------------------ chez le MJ actif : ranger
// Scelle les secrets maintenant (une écriture à la fois). Rend la promesse de cette écriture.
export function sceller() {
  if (!estMJActif()) return file;
  file = file.then(scellerDansFile).catch(e => console.warn(`${ID} | coffre des secrets non rangé`, e));
  return file;
}
export const rangement = () => file;

// passation : le MJ qui perd la main scelle une dernière fois (il n'est plus le MJ actif ; la clé du moteur est la sienne).
async function scellerDansFile({ passation = false } = {}) {
  if (!passation && !estMJActif()) return;
  const s = secretsMJ();
  const partie = s?.partie ?? "";
  const coffre = lire("coffre");
  const pub = partiePublique();
  if (!pub) {
    // Plus de partie (village remis à zéro) : le coffre est vidé.
    if (!passation && (coffre.partie || coffre.donnees)) await game.settings.set(ID, "coffre", {});
    return;
  }
  if (!partie || partie !== pub) return;
  if (attendue === partie) return;   // ses parts sont attendues : surtout ne pas l'écraser
  if (!secretsAJour(partie)) {
    // Des secrets périmés (un autre MJ a scellé depuis) ou jamais ouverts : on n'écrase rien, on rouvre le coffre.
    if (!passation && estMJActif()) await chercherSecrets(partie, rappelParDefaut);
    return;
  }
  const c = brancher();
  if (!c) return;
  const rev = (coffre.partie === partie && !estAncien(coffre) ? revDe(coffre) ?? 0 : 0) + 1;
  const scelle = passation ? await c.scellerEnPartant?.({ ...s, revCoffre: rev }) : await c.sceller({ ...s, revCoffre: rev });
  if (!scelle) {
    // La clé du moteur manque à ce navigateur (parts attendues) : rien n'est écrit, et le MJ le sait une fois par partie.
    if (!passation && avertiSansCle !== partie) {
      avertiSansCle = partie;
      globalThis.ui?.notifications?.warn?.(t("LAKOUR_LOUPS.Erreurs.SansCleCoffre"), { permanent: true });
    }
    return;
  }
  // Relu juste avant d'écrire : changé pendant le scellement (un autre MJ), on n'écrase pas, on le rouvre.
  const maintenant = lire("coffre");
  if (maintenant.iv !== coffre.iv || maintenant.partie !== coffre.partie || revDe(maintenant) !== revDe(coffre)) {
    if (!passation && estMJActif()) await chercherSecrets(partie, rappelParDefaut);
    return;
  }
  // La révision d'abord chez soi (un coffre écrit puis une page fermée ne laissent pas ce navigateur « en retard »).
  await noterRevision(partie, rev, scelle.iv);
  await game.settings.set(ID, "coffre", { partie, rev, ...scelle });
  // Scellé avec le moteur : l'ancienne clé de ce navigateur (avant 0.9.0) ne sert plus.
  if (Object.keys(lire("cleCoffre")).length) { try { await game.settings.set(ID, "cleCoffre", {}); } catch { /* réglage absent */ } }
}

// Le battement (MJ, au « ready ») : pendant une partie, un scellement à intervalle fixe chez le MJ actif ; et avant de quitter la page.
export function battre(ms = BATTEMENT) {
  if (minuterie) clearInterval(minuterie);
  minuterie = setInterval(() => {
    if (estMJActif() && partiePublique() && phasePublique() !== "fin") sceller();
  }, ms);
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => { try { if (estMJActif() && partiePublique()) sceller(); } catch { /* départ */ } });
  }
}

// ------------------------------------------------------------------ changement de MJ actif
// Ce navigateur prend la main : sa mémoire peut dater (il a été actif avant) ; il relit son navigateur et, si ses secrets ne sont
// pas ceux du coffre, il le rouvre. -> true si ses secrets sont à jour.
export async function devenirMJActif(rappel = rappelParDefaut) {
  if (!estMJActif()) return false;
  oublierSecrets();
  const p = publicEtat();
  if (!p.partie || p.phase === "fin" || secretsAJour(p.partie)) return true;
  await chercherSecrets(p.partie, rappel);
  return secretsAJour(p.partie);
}
// Ce navigateur perd la main : il scelle une dernière fois ce qu'il sait, puis oublie (sa mémoire serait périmée au retour).
export async function perdreLaMain() {
  // Les écritures en cours finissent d'abord (elles s'arrêtent sans rien écrire : ce navigateur n'est plus MJ actif).
  await Promise.race([ecrituresEnCours().catch(() => null), new Promise(r => setTimeout(r, 10000))]);
  file = file.then(() => scellerDansFile({ passation: true })).catch(e => console.warn(`${ID} | coffre (passation)`, e));
  await file;
  attendue = "";
  oublierSecrets();
  signaler();
}

// Le coffre a changé (réglage monde) : chez le MJ actif, s'il est plus récent que ses secrets, il le rouvre.
export function surCoffreChange() {
  if (!estMJActif() || attendue) return;
  const p = publicEtat();
  if (!p.partie || p.phase === "fin" || secretsAJour(p.partie)) return;
  chercherSecrets(p.partie, rappelParDefaut).catch(e => console.warn(`${ID} | coffre`, e));
}

// ------------------------------------------------------------------ chez le MJ actif : retrouver
// Ce navigateur n'a pas les secrets de la partie en cours : on les cherche au coffre. -> true si la recherche est lancée (ou
// aboutie) ; false s'il n'y a rien à retrouver.
export async function chercherSecrets(partie, quandRetrouves = null) {
  const coffre = lire("coffre");
  if (!estMJActif() || !partie || coffre.partie !== partie) return false;
  retrouves = quandRetrouves ?? rappelParDefaut;
  if (estAncien(coffre)) return reprendreAncien(coffre);
  if (!brancher()) return false;
  attendue = partie;
  signaler();
  await essayer();
  return true;
}

export const enAttenteDeParts = () => Boolean(attendue);

// Une tentative d'ouverture (le moteur demande les parts s'il n'a pas la clé).
async function essayer() {
  const c = coffreDuMoteur();
  const coffre = lire("coffre");
  // Une autre partie a commencé entre-temps (publique) : l'ancien coffre ne se rouvre plus (reprendre le refuserait aussi).
  if (!attendue || coffre.partie !== attendue || attendue !== partiePublique() || !c) { attendue = ""; signaler(); return false; }
  const { partie: _partie, rev: _rev, ...scelle } = coffre;
  const secret = await c.ouvrirScelle(scelle);
  if (secret?.partie === attendue && attendue === lire("coffre").partie) {
    // Le coffre a pu changer pendant l'ouverture : on reprend celui qu'on vient d'ouvrir, avec sa révision et son vecteur.
    await reprendre(secret, { rev: revDe(coffre) ?? Number(secret.revCoffre) ?? 0, iv: coffre.iv });
    return true;
  }
  return false;
}

// La clé du moteur est revenue (parts, autre MJ, clé de secours) : on rouvre ce qui attendait.
export function surCoffreRouvert() {
  if (attendue) return essayer();
  return Promise.resolve(false);
}

// Les secrets retrouvés : ce que ce navigateur savait déjà de cette partie (fiches migrées d'avant 0.9.0) s'y ajoute ; ils portent
// désormais la révision et le vecteur du coffre ouvert.
async function reprendre(secret, { rev = 0, iv = "" } = {}) {
  // Jamais les secrets d'une autre partie que la partie publique (ils remplaceraient ceux de la partie en cours).
  if (!secret?.partie || secret.partie !== partiePublique()) { attendue = ""; retrouves = null; signaler(); return false; }
  const actuels = secretsMJ();
  const base = actuels?.partie === secret.partie
    ? { ...secret, fiches: { ...objet(actuels.fiches), ...objet(secret.fiches) } } : { ...secret };
  const fusion = { ...base, secretsIncomplets: false, revCoffre: Number(rev) || 0, ivCoffre: iv };
  attendue = "";
  oublierSecrets();   // la mémoire d'avant (périmée) ne doit pas garder une révision plus haute
  await garderSecrets(fusion);
  const rappel = retrouves;
  retrouves = null;
  avertiSansCle = "";
  signaler();
  await rappel?.(fusion);
  return true;
}

// L'ancien coffre (avant 0.9.0) : seulement avec l'ancienne clé de CE navigateur ; puis rescellé avec le moteur.
async function reprendreAncien(coffre) {
  const cle = lire("cleCoffre");
  const secret = cle.partie === coffre.partie ? await ouvrirAncien(coffre, cle) : null;
  if (!secret || !(await reprendre(secret))) return false;
  try { await game.settings.set(ID, "cleCoffre", {}); } catch { /* réglage absent */ }
  await sceller();
  return true;
}

// ------------------------------------------------------------------ chez un joueur
// Les parts de l'ancien coffre (avant 0.9.0) ne servent plus : effacées de ce navigateur.
export async function oublierAnciennePart() {
  if (game.user?.isGM) return false;
  const p = lire("partCoffre");
  if (!Object.keys(p).length) return false;
  try { await game.settings.set(ID, "partCoffre", {}); } catch { /* réglage absent */ }
  return true;
}
