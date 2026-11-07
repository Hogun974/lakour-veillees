// Une PARTIE SIMULÉE des « Veillées de Brumecombe », réutilisable : le système lakour-loups (API réelle, socket réel), le vrai contenu
// de lakour-veillees (rôles, métiers, bâtiments, compositions.json, equilibre.json) et les OUTILS du MJ IA (loups_*), sur la doublure
// de Foundry (essais/doublures/foundry-loups.mjs) avec des joueurs simulés, jusqu'à la victoire.
// Sortie de l'essai d'intégration (essais/integration-loups.test.mjs, Le Pacte, étape 6) : il s'en sert tel quel (mêmes graines, mêmes
// parties, mêmes vérifications) ; le simulateur (essais/outils/simuler-veillees.mjs) et la calibration (essais/outils/calibrer-poids.mjs)
// le jouent sans vérification (verifier: false) et avec des joueurs plus ou moins adroits (adresse, essais/outils/politiques.mjs par
// la doublure).
//
//   const r = await jouerPartie({ n, niveau, graine, … })
//   -> { vainqueur, camp, gagnants: [{ cle, camp }], tours, n, niveau, roles: [cle distribuées, triées], batiments: [cle], variantes,
//        village, gazette, adresse }
//
// Options de jouerPartie :
// - n, niveau, graine : comme l'essai d'intégration (loups_distribuer, composition générée du niveau) ; nbCompagnons, fete, tablee,
//   composition (clé d'une composition prête) : idem ;
// - verifier (vrai par défaut) : les invariants de l'essai d'intégration (aucun secret qui fuit, plateau, textes, usages, compte des
//   voix…) ; faux : ni plateau, ni vérification (trois à quatre fois plus vite), seules les erreurs des outils arrêtent la partie ;
// - adresse (null par défaut : les joueurs simulés de toujours, au hasard) : de 0 à 1, les joueurs simulés suivent les politiques par
//   rôle (essais/outils/politiques.mjs) et usent de ce qu'ils savent à proportion ;
// - reglages : { cle: valeur } — des réglages du système posés avant la distribution (chanceEpier, chanceFourniere…) ;
// - par la voie de api.nouvellePartie (au lieu de loups_distribuer), dès qu'une de ces options est donnée : roles (la composition
//   exacte, complétée de villageois), batiments ("aucun", "hasard" ou [cle]), metiers (booléen), village (la variante « Le Village »),
//   variantes ({ chandelles, angoissante, chaine, mur, doubleVisage, allegeanceLoup, vendanges, envoutement }), gazette (booléen : la
//   Gazette de la lune).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  installerFoundry, simulerJoueurs, calme, erreurs, journalHooks, emissions, messages, reglages, CONTENU, ajouterScene, erreursHooks, FR
} from "../doublures/foundry-loups.mjs";
import { PLAN_VILLAGE, PLATEAU_VILLAGE, PLACE, BATIMENTS_CARTE } from "../../modules/lakour-veillees/contenu/village.mjs";

installerFoundry({ contenu: true });
export const { api, attendreGestes } = await import("../../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../../systems/lakour-loups/scripts/reglages.mjs");
const L = await import("../../systems/lakour-loups/logique/index.mjs");
const { creerHasard, choisir, melanger, verifierVictoire, CAUSES_SECRETES, effetsDeLaNuit, surLAutreRive, voteExecutionDuJour, versCases, lumiereDePhase } = L;
export const { OUTILS } = await import("../../modules/lakour-mj-ia/scripts/outils.js");
const { Compagnons, reinitialiserPrive, privesDe } = await import("../../modules/lakour-mj-ia/scripts/compagnons-jeu.js");
const { contexteCompagnon, texteBrut } = await import("../../modules/lakour-mj-ia/scripts/compagnons.js");
const plateau = await import("../../systems/lakour-loups/scripts/plateau.mjs");
const NEUTRE = "modules/lakour-veillees/assets/jetons/villageois.svg";
const CIMETIERE = BATIMENTS_CARTE.find(b => b.nom === "Cimetière");
let sceneVillage = null;
export const outil = nom => OUTILS.find(o => o.nom === nom);
// Lu une fois, au chargement (et non à chaque partie, plus de 600 fois) : un « npm run fabriquer-veillees » lancé pendant la suite
// récrit ce fichier sur place, et une lecture tombée au milieu donnait un JSON tronqué (JSON.parse en échec).
export const EQUILIBRE = JSON.parse(readFileSync(new URL("../../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));

export const ROLES = Object.fromEntries(CONTENU.roles.map(r => [r.system.cle, r]));
const CLES_A_TIRET = [...CONTENU.roles, ...CONTENU.metiers, ...CONTENU.batiments].map(d => d.system.cle).filter(c => c.includes("-"));
const IDS_CONTENU = [...CONTENU.roles, ...CONTENU.metiers, ...CONTENU.batiments].map(d => d._id);

// ------------------------------------------------------------------ horloge simulée
// Le système départage à l'heure : la proie de la meute à égalité est celle du loup qui a choisi le PREMIER (quand : Date.now(),
// logique/votes.mjs majoriteMeute), l'historique des parties est trié par date… Avec l'horloge réelle, deux réponses tombent dans
// la même milliseconde ou non selon la charge de la machine : la même graine ne donnait pas toujours la même partie (vainqueurs
// différents d'une suite à l'autre, reproductibilité et fourchettes d'équilibre parfois en échec sous charge). Ici Date.now avance
// d'une milliseconde à chaque lecture (l'ordre des événements est gardé, jamais deux fois la même heure), et repart du même instant
// à chaque monde : une graine, une partie.
const DEBUT_HORLOGE = Date.now();
let instant = DEBUT_HORLOGE;
Date.now = () => ++instant;

// ------------------------------------------------------------------ mise en place d'un monde
export let joueursSimules = null;
export let compagnons = null;           // les cerveaux des compagnons (repli sans IA : pas de fournisseur)
let votesDesCompagnons = [];            // { numero, votant, cible } : ce que chaque compagnon a voté
let verification = true;                // les invariants de ce monde (monde(..., { verifier }))
// Ce que le système avale : ce qui court sans bloquer la partie (le matin de la Gazette et sa séance de Spiritisme, le Crieur, la
// succession du Bailli, les derniers gestes…) intercepte ses erreurs (console.warn « lakour-loups | … ») pour ne pas figer la table.
// Une séance interrompue (par une fuite que verifierMessage refuse, ou un défaut du système) passait ainsi inaperçue : la partie
// prenait un autre chemin, et la couverture du bilan pouvait en dépendre. Relevé ici, refusé à la fin de chaque partie vérifiée.
let erreursAvalees = [];
const avertir = console.warn;
console.warn = (...args) => {
  if (/^lakour-loups \| /.test(String(args[0])) && args.some(x => x instanceof Error)) erreursAvalees.push(`${args[0]} : ${args.find(x => x instanceof Error).message}`);
  return avertir(...args);
};
// simules : des joueurs simulés (faux : personne ne répond) ; verifier : invariants et plateau (faux : ni l'un ni l'autre) ;
// adresse : celle des joueurs simulés (null : les joueurs au hasard de toujours).
export function monde(n, graine, { simules = true, verifier = true, adresse = null } = {}) {
  instant = DEBUT_HORLOGE;
  verification = verifier;
  erreursAvalees = [];
  installerFoundry({ joueurs: n, contenu: true, rapide: !verifier });
  enregistrerReglages(() => {});
  game.settings.register("lakour-mj-ia", "personnalites", { default: [{ id: "conteuse", nomAffiche: "La Conteuse" }] });
  game.settings.register("lakour-mj-ia", "personnaliteActive", { default: "conteuse" });
  game.lakourLoups = api;          // ce que fait le hook « ready » du système
  ecouterSocket();
  // Le plateau : la scène du village, la mise en scène branchée sur les hooks du système (sans délai pour l'essai). Sans vérification,
  // pas de plateau : la mise en scène ne change rien à la partie.
  plateau.oublierPlateau();
  if (verifier) {
    plateau.brancherPlateau();
    api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
    api.plateau.configurer({ jetonNeutre: NEUTRE });
    sceneVillage = ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
  } else sceneVillage = null;
  // Ce que fait le MJ IA au « ready » : le cerveau des compagnons répond aux demandes du système.
  reinitialiserPrive();
  game.messages = { get contents() { return messages; } };
  compagnons = new Compagnons({ graine: `${graine}-compagnons` });
  votesDesCompagnons = [];
  api.resolveurs.compagnon = async demande => {
    const r = await compagnons.resoudreLoups(demande);
    if (demande.type === "vote") votesDesCompagnons.push({ numero: demande.numero, votant: demande.acteurId, cible: r[0] ?? "" });
    return r;
  };
  controle = 0;
  // Chaque message de chat est vérifié à sa création, sur l'état du monde à cet instant.
  if (verifier) {
    const creer = ChatMessage.implementation.create;
    ChatMessage.implementation.create = async m => { verifierMessage(m); return creer(m); };
  }
  joueursSimules = simules ? simulerJoueurs({ graine: `${graine}-joueurs`, ...(adresse === null || adresse === undefined ? {} : { adresse }) }) : null;
  return joueursSimules;
}

export const roleDe = a => secretDuMJ.role(a);
export const metierDe = a => a?.items.find(i => i.type === "metier") ?? null;
export const villageois = () => game.actors.filter(a => a.type === "villageois");
export const vivantsIds = () => new Set(villageois().filter(a => a.system.vivant).map(a => a.id));
// Ce que lit un joueur : sans balises, et un lien @UUID[…]{nom} réduit à son nom, comme Foundry l'affiche (un lien sans nom
// garde son uuid brut, que verifierTexte refuse).
export const sansHTML = s => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1");
export const secretsEmis = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret");

// ------------------------------------------------------------------ invariants
// Aucun chuchotement : Foundry livre chaque message de chat, chuchotements compris, à TOUS les navigateurs ; le secret
// passe par le carnet (socket adressé). Aucun rôle secret dans un message public : un nom de rôle n'y paraît qu'à côté du
// nom d'un villageois révélé qui l'a. Seule exception : le récit de fin, une fois la partie finie (toutes les cartes se retournent).
const nomEntier = nom => new RegExp(`(?<![\\p{L}-])${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}-])`, "u");
export function verifierMessage(m) {
  const texte = sansHTML(m.content);
  verifierTexte(texte, "chat");
  assert.ok(!m.whisper?.length, `chuchotement (livré à tous les navigateurs) : ${texte}`);
  if (/loups-recit/.test(m.content)) {
    assert.equal(game.lakourLoups.etat().phase, "fin", `récit de fin avant la fin : ${texte}`);
    return;
  }
  // Une carte de la Gazette cite des rôles en général, comme sur table (questions de Spiritisme, Jour des sots…) : seul est
  // refusé un rôle secret accolé au nom de celui qui le tient (« la Liseuse d'étoiles Joueur 2 »).
  if (/loups-gazette/.test(m.content)) {
    for (const a of villageois()) {
      const r = roleDe(a);
      if (!r || a.system.revele) continue;
      assert.ok(!texte.includes(`${r.name} ${a.name}`) && !texte.includes(`${a.name}, ${r.name}`), `rôle secret « ${r.name} » accolé à ${a.name} dans la Gazette : ${texte}`);
    }
    return;
  }
  for (const a of villageois()) {
    const r = roleDe(a);
    // Un nom de rôle entier (« Villageois » n'est pas dans « Franc-Villageois »).
    if (!r || a.system.revele || !nomEntier(r.name).test(texte)) continue;
    const justifie = villageois().some(b => b.system.revele && roleDe(b)?.name === r.name && texte.includes(b.name));
    assert.ok(justifie, `rôle secret « ${r.name} » (${a.name}) dans un message public : ${texte}`);
  }
}

// Ni undefined, ni [object Object], ni NaN, ni gabarit non rempli, ni identifiant brut (id d'acteur, d'objet, uuid, clé de rôle).
export function verifierTexte(texte, ou) {
  const s = String(texte);
  for (const motif of [/undefined/, /\[object Object\]/, /\bNaN\b/, /\{\w+\}/, /\bid\d{13}\b/, /\b(?:Compendium|Actor|Item)\.[A-Za-z0-9]{8,}/]) {
    assert.doesNotMatch(s, motif, `${ou} : ${s}`);
  }
  for (const id of IDS_CONTENU) assert.ok(!s.includes(id), `${ou} : id brut ${id} dans ${s}`);
  for (const id of game.actors.map(a => a.id)) assert.ok(!s.includes(id), `${ou} : id d'acteur brut ${id} dans ${s}`);
  for (const cle of CLES_A_TIRET) assert.doesNotMatch(s, new RegExp(`(^|[^\\w-])${cle}($|[^\\w-])`), `${ou} : clé brute « ${cle} » au lieu d'un nom : ${s}`);
}

// Les secrets : ni dans le réglage monde (livré à tous), ni dans ce que le socket diffuse ; chaque message privé n'a
// qu'un destinataire, le bon ; les secrets du MJ sont rangés dans un réglage « client » (jamais envoyé au serveur).
let controle = 0;
export function verifierSecrets(ou) {
  const pub = reglages.get("lakour-loups.partie").valeur;
  // Un vote à main levée (la foire de l'Almanach ; le vote à tour de rôle de la Gazette : le Cauchemar, les Influences) : ses voix sont
  // publiques pendant le vote (logique/etat.mjs, etatPublic ; même règle que essais/non-fuite.test.mjs) : on ne les y cherche pas.
  const votesSecrets = v => (v?.ouvert && v.mainLevee ? {} : v?.votes);
  assert.deepEqual([pub.nuit.actions, pub.nuitPrecedente.actions, pub.nuitPrecedente.bilan, pub.primes, pub.fioles, pub.asperges, votesSecrets(pub.vote),
    pub.carnets, pub.journalSecret, pub.causes], [[], [], null, {}, {}, [], {}, {}, [], {}], `${ou} : secret dans l'état public`);
  for (const m of pub.morts) assert.ok(!CAUSES_SECRETES.includes(m.cause), `${ou} : vraie cause « ${m.cause} » dans l'état public`);
  // La composition n'est jamais annoncée : ni sa clé dans l'état public ; la peste noire n'y existe pas avant la fin (pas même la clé).
  assert.equal(pub.composition, "", `${ou} : composition dans l'état public`);
  assert.ok(!("peste" in pub) || pub.phase === "fin", `${ou} : la peste noire dans l'état public avant la fin`);
  assert.equal(reglages.get("lakour-loups.secrets").conf.scope, "client");
  assert.equal(reglages.get("lakour-loups.carnet").conf.scope, "client");
  for (const e of emissions.slice(controle)) {
    if (e.type === "hook") {
      assert.equal(e.recipients, null, e.nom);
      const etat = e.args?.[1];
      if (etat?.nuit) {
        assert.deepEqual([etat.nuit.actions, etat.nuitPrecedente.actions, etat.primes, etat.fioles, etat.asperges, votesSecrets(etat.vote), etat.carnets],
          [[], [], {}, {}, [], {}, {}], `${ou} : ${e.nom} diffuse un secret`);
        assert.equal(etat.composition, "", `${ou} : ${e.nom} diffuse la composition`);
        assert.ok(!("peste" in etat) || etat.phase === "fin", `${ou} : ${e.nom} diffuse la peste noire avant la fin`);
      }
      if (e.nom === "lakourLoups.nouvellePartie") assert.ok(!("composition" in e.args[0]), `${ou} : composition annoncée aux joueurs`);
      if (e.nom === "lakourLoups.vote") assert.deepEqual(Object.keys(e.args[0]), ["votant"], "un vote en cours diffusé avec son choix");
      if (e.nom === "lakourLoups.elimination") {
        assert.ok(!CAUSES_SECRETES.includes(e.args[0].cause), "vraie cause d'une mort de nuit diffusée");
        if (!e.args[0].revele) assert.equal(e.args[0].roleCle, "", "rôle d'un mort non révélé diffusé");
      }
    } else {
      assert.ok(Array.isArray(e.recipients) && e.recipients.length === 1, `${ou} : « ${e.type} » sans destinataire unique`);
      if (e.type === "demande" || e.type === "annuler") assert.notEqual(e.recipients[0], "mj");
      if (e.type === "demande") assert.deepEqual(e.recipients, [e.destinataire]);
      if (e.type === "secret") assert.deepEqual(e.recipients, [game.actors.get(e.entree.acteurId).system.joueur], "carnet remis au mauvais joueur");
    }
  }
  controle = emissions.length;
  if (joueursSimules) assert.deepEqual(joueursSimules.journal.fuites, [], `${ou} : message privé diffusé à tous`);
}

// La scène du village après chaque outil : places de la phase, lumière, images, statuts publics.
export async function verifierPlateau(ou) {
  await api.plateau.attendre();
  const e = api.etat();
  if (!e.partie) return;
  assert.ok(sceneVillage.active, `${ou} : la scène du village est active`);
  assert.equal(sceneVillage.environment.darknessLevel, lumiereDePhase(e.phase), `${ou} : lumière de la phase ${e.phase}`);
  const g = { size: 100, sceneX: 0, sceneY: 0 };
  const cercle = [];
  for (const a of villageois()) {
    const t = sceneVillage.tokens.filter(x => x.actorId === a.id);
    assert.equal(t.length, 1, `${ou} : ${a.name} a un jeton et un seul`);
    assert.equal(t[0].locked, true, `${ou} : jeton verrouillé`);
    const c = versCases(t[0], g);
    if (!a.system.vivant) {
      assert.ok(c.x > CIMETIERE.x && c.x < CIMETIERE.x + CIMETIERE.l && c.y > CIMETIERE.y && c.y < CIMETIERE.y + CIMETIERE.h, `${ou} : ${a.name}, mort, au cimetière`);
      assert.ok(a.statuses.has("dead"), `${ou} : ${a.name}, mort, porte le crâne`);
    } else if (["jour", "vote", "fin"].includes(e.phase)) {
      assert.ok(c.x - 0.5 >= PLACE.x && c.x + 0.5 <= PLACE.x + PLACE.l && c.y - 0.5 >= PLACE.y && c.y + 0.5 <= PLACE.y + PLACE.h, `${ou} : ${a.name} sur la place`);
      cercle.push(c);
    } else assert.deepEqual(c, PLATEAU_VILLAGE.seuils[a.system.maison], `${ou} : ${a.name} devant ${a.system.maison}`);
    assert.equal(a.statuses.has("silence"), Boolean(a.system.vivant && a.system.silence), `${ou} : silence de ${a.name}`);
    const revele = a.system.revele || e.phase === "fin";
    // En cours de partie, l'image est celle du rôle révélé au village (l'objet du document) : un loup démasqué par la lanterne, puis
    // échangé en secret par le Colporteur, garde l'image de ce qu'on a vu ; à la fin, le vrai rôle.
    const vu = e.phase === "fin" ? roleDe(a) : a.items.find(i => i.type === "role") ?? roleDe(a);
    assert.equal(t[0].texture.src, revele ? vu.img : NEUTRE, `${ou} : image de ${a.name} (${roleDe(a).system.cle}, révélé : ${revele})`);
  }
  for (let i = 0; i < cercle.length; i++) for (let j = i + 1; j < cercle.length; j++) {
    assert.ok(Math.hypot(cercle[i].x - cercle[j].x, cercle[i].y - cercle[j].y) >= 1 - 1e-6, `${ou} : deux jetons du cercle se chevauchent`);
  }
  assert.deepEqual(erreursHooks, [], `${ou} : erreur dans un écouteur de hook`);
}

export function verifierVillageois(usages) {
  for (const a of villageois()) {
    // Le rôle vit dans les secrets du MJ ; le document n'a son objet de rôle qu'une fois révélé à tous (ou la partie finie).
    assert.ok(secretDuMJ.role(a), `${a.name} : un rôle, dans les secrets du MJ`);
    const publie = a.system.revele || api.etat().phase === "fin";
    assert.equal(a.items.filter(i => i.type === "role").length, publie ? 1 : 0, `${a.name} : objet de rôle au document seulement révélé`);
    if (!publie) assert.equal(a.system.camp, "", `${a.name} : aucun camp au document avant la révélation`);
    assert.equal(a.items.filter(i => i.type === "metier").length, 1, `${a.name} : un seul métier`);
  }
  for (const a of villageois()) {
    for (const o of [roleDe(a), metierDe(a)]) {
      const u = o.system.usages;
      assert.ok(u.restant >= 0 && u.restant <= u.max, `${a.name} : usages de ${o.name} ${u.restant}/${u.max}`);
    }
  }
  for (const [cle, n] of usages) assert.ok(n <= ROLES[cle].system.usages.max, `${cle} : ${n} usages pour ${ROLES[cle].system.usages.max} permis`);
}

// Usages réellement consommés pendant la nuit (un pouvoir sert : une cible, ou un rôle sans cible qui se réveille ;
// une fiole vide de l'Herboriste, ou restée bouchée, ne compte pas, l'usage lui est rendu).
function compterUsages(actions, usages, fiolesVides = 0) {
  for (const x of actions) {
    const r = ROLES[x.roleCle];
    if (!r || r.system.usages.max <= 0) continue;
    if (x.cibles.length || r.system.nuit.cibles === 0) usages.set(x.roleCle, (usages.get(x.roleCle) ?? 0) + 1);
  }
  if (fiolesVides) usages.set("herboriste", usages.get("herboriste") - fiolesVides);
}

function verifierVictoireFinale(texte) {
  const e = api.etat();
  assert.equal(e.phase, "fin", "phase finale « fin »");
  assert.ok(e.vainqueur, "un vainqueur");
  assert.equal(journalHooks.filter(h => h.nom === "lakourLoups.victoire").length, 1, "une seule victoire");
  const nomVainqueur = e.vainqueur === "village" || e.vainqueur === "meute" ? e.vainqueur : game.actors.get(e.vainqueur)?.name;
  assert.match(texte, new RegExp(`VICTOIRE : ${nomVainqueur}`));
  const vivants = villageois().filter(a => a.system.vivant);
  const meute = vivants.filter(a => secretDuMJ.camp(a) === "meute");
  if (e.vainqueur === "village") {
    assert.equal(meute.length, 0, "le village gagne : plus aucun loup vivant");
    assert.ok(!vivants.some(a => ROLES[roleDe(a).system.cle]?.system.victoireCle === "dernier-survivant"), "ni pyromane vivant");
  } else if (e.vainqueur === "meute") {
    // La meute gagne à parité, ou au Glas final (petite tablée : posé d'office) si un loup vit encore.
    const strict = e.petiteTablee && api.logique.pariteStricteTablee(villageois().length);
    const parite = strict ? meute.length > vivants.length - meute.length : meute.length >= vivants.length - meute.length;
    assert.ok(meute.length > 0 && (parite || glasAFini(e)), "la meute gagne : au moins autant de loups que d'autres (plus nombreuse en petite tablée), ou le glas a sonné");
    couvert("tablée : le glas sonne", e.petiteTablee && meute.length < vivants.length - meute.length ? 1 : 0);
  } else {
    assert.ok(game.actors.get(e.vainqueur), "solitaire ou amoureux vainqueur");
  }
  // Le vainqueur est celui que dicte la règle sur l'état final.
  const aPlat = villageois().map(a => ({ id: a.id, vivant: a.system.vivant, camp: secretDuMJ.camp(a), amoureux: secretDuMJ.amoureux(a),
    role: { cle: roleDe(a).system.cle, victoireCle: roleDe(a).system.victoireCle } }));
  // (Le Pacte, étape 3b : les charmés du Joueur de vielle et les deux bords de l'Illuminé comptent aussi.)
  assert.equal(verifierVictoire({ villageois: aPlat, morts: e.morts, primes: e.primes, glas: glasAFini(e), strict: e.petiteTablee && api.logique.pariteStricteTablee(villageois().length),
    ...api.logique.contexteDesAmbigus(e) }), e.vainqueur);
}

// Le Glas final a-t-il fini la partie (phase « fin » comprise : glasSonne ne regarde qu'une partie en cours) ?
const glasAFini = e => e.glas > 0 && (e.tour > e.glas || (e.tour === e.glas && voteExecutionDuJour(e)));

// Ce que les parties ont réellement exercé, toutes ensemble (vérifié dans le bilan de l'essai d'intégration).
export const couverture = new Map();
export const couvert = (nom, n = 1) => { if (n) couverture.set(nom, (couverture.get(nom) ?? 0) + n); };

// Ce qu'on enverrait au modèle d'un compagnon (prompt système et message) : aucun rôle secret d'un autre (son nom à côté de
// celui de son rôle), aucune ligne de la chronique secrète du MJ, aucun mot du Messager qu'il n'a ni écrit ni reçu. Est permis
// ce que son joueur saurait : son carnet, sa fiche, le chat public, les annonces publiques, les rôles révélés.
export function verifierSavoirDesCompagnons(ou) {
  const etat = api.etat();
  const publics = [...messages.map(m => texteBrut(m.content)), ...etat.historique.map(h => h.texte),
    ...villageois().filter(a => a.system.revele).map(a => roleDe(a).name)].join("\n");
  for (const a of villageois().filter(x => x.system.compagnon)) {
    const { systeme, texte } = contexteCompagnon(compagnons.vue(a));
    const envoye = `${systeme}\n${texte}`;
    const role = roleDe(a), metier = metierDe(a);
    // Ses propres choix (ce qu'on lui a demandé à lui, et ce qu'il a répondu) font aussi partie de ce qu'il sait.
    const permis = [publics, ...api.carnet(a.id).map(e => texteBrut(e.html ?? e.texte)), ...privesDe(a.id), role.name, texteBrut(role.system.description),
      texteBrut(role.system.victoire), texteBrut(metier?.system.description)].join("\n");
    // Les métiers sont publics (« Colporteur de nouvelles » n'est pas le rôle « Colporteur ») : on les retire avant de chercher.
    const metiers = [...new Set(villageois().map(x => metierDe(x)?.name).filter(Boolean))].sort((x, y) => y.length - x.length);
    const morceaux = envoye.split(/\n| ; /).map(m => metiers.reduce((t, nom) => t.split(nom).join("·"), m));
    for (const b of villageois().filter(x => x.id !== a.id && !x.system.revele)) {
      const nomRole = roleDe(b).name;
      if (permis.includes(nomRole)) continue;
      const fuite = morceaux.find(m => m.includes(b.name) && m.includes(nomRole));
      assert.ok(!fuite, `${ou} : le compagnon ${a.name} (${role.name}) voit le rôle secret de ${b.name} (${nomRole}) : ${fuite}`);
    }
    for (const x of etat.journalSecret.filter(x => x.texte.length > 24 && !permis.includes(x.texte))) {
      assert.ok(!envoye.includes(x.texte), `${ou} : le compagnon ${a.name} voit la chronique secrète : ${x.texte}`);
    }
    for (const x of [...etat.nuit.actions, ...etat.nuitPrecedente.actions].filter(x => x.texte && !permis.includes(x.texte))) {
      assert.ok(!envoye.includes(x.texte), `${ou} : le compagnon ${a.name} voit un mot du Messager qui ne lui est pas destiné`);
    }
    if (!a.system.vivant) assert.equal(compagnons.vue(a).peutParler, false, "un compagnon mort se tait");
  }
}

// ------------------------------------------------------------------ une partie, menée par les outils du MJ IA
// Les derniers gestes en cours (logique/derniers-gestes.mjs : la Braconnière qui choisit sa cible) faits, et leur mise en scène.
export async function gestesFaits() {
  for (let i = 0; i < 20; i++) {
    await calme();
    const g = attendreGestes();
    await g;
    await calme();
    if (g === attendreGestes()) break;
  }
  if (verification) await api.plateau.attendre();
}
// Le texte d'une victoire tombée du geste d'une Braconnière (le système l'a déclarée), comme le dirait le narrateur.
export function victoireDuGeste() {
  const v = api.etat().vainqueur;
  return `VICTOIRE : ${v === "village" || v === "meute" ? v : game.actors.get(v)?.name ?? v} (dernier geste d'une Braconnière).`;
}

// Les gagnants d'une partie finie : le rôle de départ et le camp final de chacun (bilanDePartie du système).
function gagnantsDeLaPartie(depart) {
  const e = api.etat();
  const aPlat = villageois().map(a => ({ id: a.id, vivant: a.system.vivant, camp: secretDuMJ.camp(a), amoureux: secretDuMJ.amoureux(a),
    role: { cle: roleDe(a).system.cle, victoireCle: roleDe(a).system.victoireCle } }));
  return L.bilanDePartie({ villageois: aPlat, morts: e.morts, vainqueur: e.vainqueur, partis: e.partis ?? [], allies: L.alliesDeLaMeute(e) })
    .filter(l => l.gagnant).map(l => ({ cle: depart.get(l.id) ?? "", camp: aPlat.find(a => a.id === l.id)?.camp ?? "" }));
}

// fete : une veillée de fête (0.10.0), choisie par le réglage « veilleeDeFete » (le MJ IA distribue sans la choisir lui-même).
// tablee : la Petite tablée (0.11.0) : le réglage monde « petiteTablee » est coché (comme le fait la Table du MJ), et le narrateur
// distribue au niveau « petite-tablee » ; le tirage contraint, le glas d'office et le sort qui tranche sont vérifiés en chemin.
// composition : une composition prête du contenu (clé), au lieu de la composition générée.
export async function jouerPartie({ n, niveau, graine, nbCompagnons = 0, fete = "", tablee = false, composition = "", verifier = true, adresse = null,
  roles, batiments, metiers, village, variantes, gazette, reglages: reglagesVoulus = {} } = {}) {
  const joueurs = monde(n, graine, { verifier, adresse });
  // Des réglages du système pour cette partie (le simulateur : chanceEpier, chanceFourniere…).
  for (const [cle, valeur] of Object.entries(reglagesVoulus ?? {})) await game.settings.set("lakour-loups", cle, valeur);
  const parNouvellePartie = [roles, batiments, metiers, village, variantes, gazette].some(x => x !== undefined);
  if (fete) await game.settings.set("lakour-loups", "veilleeDeFete", fete);
  if (tablee) await game.settings.set("lakour-loups", "petiteTablee", true);
  // Une graine sur cinq sans révélation à la mort, avec ou sans compagnons : le Cimetière parle alors (s'il est tiré).
  if (graine.split("-")[0] === "cendres") await game.settings.set("lakour-loups", "revelerALaMort", false);
  const hasardOrigine = Math.random;
  Math.random = creerHasard(`${graine}-monde`);    // distribution, primes, épier, nouvelles : reproductibles
  const h = creerHasard(`${graine}-mj`);
  const usages = new Map();
  const fioles = { poison: 0, remede: 0 };
  const textes = [];
  const appeler = async (nom, args) => {
    // (Sans vérification, une erreur levée par un outil devient un refus : « pas de vote » est attendu, le reste arrête la partie.)
    const r = verifier ? await outil(nom).executer(args) : await outil(nom).executer(args).catch(e => ({ erreur: true, contenu: e.message }));
    // Une Braconnière tombée choisit elle-même qui elle emporte (derniers gestes du système) : son choix est fait avant qu'on
    // regarde le village.
    await gestesFaits();
    textes.push(`${nom} ${JSON.stringify(args)}\n${r.contenu}`);
    if (process.env.TRACE_LOUPS) console.log(`${textes.at(-1)}\n`);
    // (Sans vérification : un jour sans vote — la Crue de la Gazette — n'est pas une erreur.)
    if (!verifier && r.erreur && /pas de vote/i.test(r.contenu)) return "";
    assert.ok(!r.erreur, `${nom} en erreur : ${r.contenu}`);
    if (verifier) {
      verifierTexte(r.contenu, nom);
      verifierSecrets(nom);
      await verifierPlateau(nom);
    }
    return r.contenu;
  };
  // Le narrateur élimine (emporté dans la tombe, puis désignés du vote) ; renvoie le texte s'il annonce la victoire.
  const eliminer = async (nom, cause) => {
    const t = await appeler("loups_eliminer", { villageois: nom, cause, reveler: true });
    await calme();   // un mort peut confier un dernier mot au Puits
    if (/VICTOIRE/.test(t)) return t;
    // Le moteur 27e7559 (Le Pacte) : « X choisit lui-même qui il emporte » (une demande lui est faite) ou « X n'a pas désigné qui il
    // emporte » ; un moteur plus ancien : « X peut emporter quelqu'un ».
    if (/peut emporter quelqu'un|qui il emporte dans la tombe|n'a pas désigné qui il emporte/.test(t)) return emporter();
    return "";
  };
  // La Braconnière désigne elle-même sa cible (demande posthume du système, déjà faite : appeler l'attend). Le narrateur n'emporte
  // personne à sa place (le moteur le lui interdit) : seulement, si elle n'a rien désigné (geste encore en attente), la simulation
  // fait comme si elle le disait tout haut, et le narrateur l'applique (loups_eliminer, cause « emporte »). Une victoire tombée de son
  // geste se lit dans l'état.
  const emporter = async () => {
    await gestesFaits();
    if (api.etat().vainqueur) return victoireDuGeste();
    const enAttente = api.derniersGestes().filter(g => g.geste === "emporter");
    if (!enAttente.length) couvert("Braconnière : elle choisit elle-même");
    for (const g of enAttente) {
      if (!game.actors.get(g.acteurId)) continue;
      couvert("Braconnière : dit tout haut, le narrateur l'applique");
      const cible = choisir(villageois().filter(a => a.system.vivant).map(a => a.name), h);
      if (!cible) return "";
      const t = await eliminer(cible, "emporte");
      if (t) return t;
    }
    return "";
  };
  // Le narrateur applique, de temps en temps, un pouvoir de jour annoncé à voix haute (loups_jour). Avec des joueurs adroits (adresse),
  // chacun use de ses pouvoirs selon sa politique : le narrateur n'en joue aucun au hasard à leur place.
  const pouvoirDuNarrateur = async () => {
    if (adresse !== null && adresse !== undefined) return;
    if (h() < 0.3) {
      const liste = await appeler("loups_jour", { action: "lister", villageois: "", pouvoir: "", cibles: [], texte: "" });
      if (verifier) verifierTexte(liste, "loups_jour");
    }
    const possibles = villageois().filter(a => a.system.vivant && a.system.joueur)
      .flatMap(a => api.pouvoirsDeJour(a.id).filter(p => p.possible && !["juge-de-paix", "puits"].includes(p.pouvoir)).map(p => ({ a, p })));
    if (!possibles.length || h() > 0.6) return;
    const { a, p } = choisir(possibles, h);
    const cibles = melanger(p.candidats, h).slice(0, p.cibles).map(c => c.nom);
    // Un refus qui tient à la cible choisie (l'Aubergiste loge quelqu'un qui dort déjà à la Taverne) est un refus légitime, pas une erreur.
    const r = await outil("loups_jour").executer({ action: "utiliser", villageois: a.name, pouvoir: p.nom, cibles, texte: "" });
    if (r.erreur && /déjà fait/.test(r.contenu)) { couvert("pouvoir de jour refusé (cible déjà servie)"); return; }
    textes.push(`loups_jour ${JSON.stringify({ villageois: a.name, pouvoir: p.nom, cibles })}
${r.contenu}`);
    assert.ok(!r.erreur, `loups_jour en erreur : ${r.contenu}`);
    if (verifier) {
      verifierTexte(r.contenu, "loups_jour");
      verifierSecrets("loups_jour");
      await verifierPlateau("loups_jour");
    }
  };
  // Le vote d'exécution : ruban de la Tisserande (prolongation) et Juge de paix (revote) compris.
  const voterLeJour = async () => {
    // Un vote déjà ouvert de lui-même (au matin : le Cauchemar, le Châtiment, l'élection de l'Exécuteur ; après une exécution : le
    // second vote du Greffier bègue, le Dépit, l'Enthousiasme) : loups_vote ne rouvre jamais un vote ouvert (moteur 27e7559) ; on le
    // laisse aller à son terme, puis on le clôt.
    if (api.etat().vote.ouvert) couvert("vote ouvert de lui-même");
    // (Sans vérification : un jour sans vote — la Crue de la Gazette — se passe de vote.)
    else if (!verifier) {
      // (Un moteur d'avant 27e7559 levait l'erreur du système au lieu de la rendre : rattrapée, au cas où.)
      let r;
      try { r = await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" }); }
      catch (e) { r = { erreur: true, contenu: e.message }; }
      await gestesFaits();
      if (r.erreur && /pas de vote/i.test(r.contenu)) return "";
      assert.ok(!r.erreur, `loups_vote en erreur : ${r.contenu}`);
    } else await appeler("loups_vote", { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
    let clos = "";
    for (let essai = 0; ; essai++) {
      assert.ok(essai < 8, "le vote ne se termine pas");
      await calme();
      clos = await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
      if (/porte le ruban de la Tisserande/.test(clos)) {
        couvert("ruban (prolongation)");
        if (verifier) assert.equal(api.etat().vote.ouvert, true, "le vote reste ouvert pendant la défense");
        continue;
      }
      await calme();   // le Juge de paix peut annuler, juste après le dépouillement
      if (api.etat().vote.ouvert) {
        couvert("juge (revote)");
        if (verifier) {
          const juge = villageois().find(a => roleDe(a).system.cle === "juge-de-paix");
          assert.ok(juge.system.revele, "le Juge de paix se révèle en annulant");
          assert.equal(roleDe(juge).system.usages.restant, 0, "une fois par partie");
        }
        continue;
      }
      return clos;
    }
  };
  try {
    const total = n + nbCompagnons;
    if (parNouvellePartie) {
      // La voie de la Table de jeu (api.nouvellePartie) : la composition exacte, les bâtiments, les métiers et les variantes voulus.
      const avecVillage = village ?? false;
      await api.nouvellePartie({ memesJoueurs: false, joueurs: game.users.filter(u => !u.isGM).map(u => u.id), niveau, graine: `${graine}-distribution`,
        ...(roles ? { roles: [...roles, ...Array(Math.max(0, total - roles.length)).fill("villageois")] } : {}),
        ...(batiments !== undefined ? { batiments } : {}), ...(metiers !== undefined ? { metiers } : {}), village: avecVillage,
        variantes: { chandelles: false, angoissante: false, chaine: false, mur: false, doubleVisage: "", allegeanceLoup: false, vendanges: false, envoutement: false, ...(variantes ?? {}) },
        gazette: { actif: Boolean(gazette), crieur: false }, peste: false });
      await gestesFaits();
    } else {
      // Sans composition nommée : composition générée, équilibrée pour ce nombre de joueurs (compagnons IA compris).
      const depart = await appeler("loups_distribuer", { joueurs: [], composition, niveau, ...(nbCompagnons ? { compagnons: nbCompagnons } : {}) });
      if (verifier) {
        assert.match(depart, new RegExp(`composition « ${composition ? "[^»]+" : "générée, [^»]+"} » \\(${total} joueurs${nbCompagnons ? `, dont ${nbCompagnons} compagnons IA` : ""}\\)`));
        // La composition, pour le narrateur seul : elle ne s'annonce plus aux joueurs.
        assert.match(depart, /Composition, pour toi seul \(ne l'annonce JAMAIS, ni le nombre de loups\) : Meute : /);
        assert.doesNotMatch(depart, /PESTE NOIRE/, "une partie ordinaire ne parle pas de peste au narrateur");
      }
    }
    if (verifier) {
      assert.equal(villageois().length, total);
      assert.equal(villageois().filter(a => a.system.compagnon && !a.system.joueur).length, nbCompagnons, "compagnons sans joueur");
      assert.equal(api.etat().composition, composition || "generee");
      assert.equal(api.etat().fete.cle, fete, "la veillée de fête du réglage (aucune d'office)");
    }
    if (fete) {
      const s = api.etat().secretsDeFete;
      couvert("fête : défilé", api.etat().fete.defile ? 1 : 0);
      couvert("fête : promis", s.promis.length === 2 ? 1 : 0);
      couvert("fête : masque", s.masque ? 1 : 0);
      couvert("fête : présent", s.present ? 1 : 0);
    }
    const roleDeDepart = new Map(villageois().map(a => [a.id, roleDe(a).system.cle]));
    if (verifier) {
      // Composition générée : bon nombre de loups, équilibre des poids proche de zéro (de sa cible, en petite tablée).
      const equilibre = EQUILIBRE;
      // Le Chapardeur (Le Pacte, étape 3b) : deux cartes Villageois de plus au paquet, les deux non distribuées au centre ; on compte
      // la composition entière (distribuée et centre), sans ces deux cartes ajoutées.
      const centre = api.etat().ambigusSecret.centre.map(r => r.system.cle);
      const distribues = [...villageois().map(a => roleDe(a).system.cle), ...centre];
      if (centre.length) for (let i = 0; i < 2; i++) distribues.splice(distribues.lastIndexOf("villageois"), 1);
      assert.equal(distribues.filter(c => equilibre.roles[c].camp === "meute").length, tablee ? api.logique.nombreDeLoupsTablee(total) : api.logique.nombreDeLoups(total, niveau));
      assert.ok(Math.abs(distribues.reduce((s, c) => s + equilibre.roles[c].poids, 0) - api.logique.cibleDe(total, tablee ? "petite-tablee" : niveau, equilibre)) <= 3, `déséquilibrée : ${distribues.join(", ")}`);
      // La Petite tablée : publique, glas d'office, tirage contraint (le partage des camps), annonce sans nom.
      assert.equal(api.etat().petiteTablee, tablee);
      assert.equal(reglages.get("lakour-loups.partie").valeur.petiteTablee, tablee);
      if (tablee) {
        assert.equal(api.etat().glas, api.logique.glasTablee(total), "le glas final d'office");
        const places = villageois().map(a => ({ humain: Boolean(a.system.joueur), role: { camp: secretDuMJ.camp(a), information: Boolean(equilibre.roles[roleDe(a).system.cle]?.information) } }));
        assert.deepEqual(api.logique.contraintesTablee(places), [], `le partage des camps : ${villageois().map(a => `${a.name} ${roleDe(a).system.cle}`).join(", ")}`);
        const annonce = messages.map(m => sansHTML(m.content)).find(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Nom));
        assert.ok(annonce, "la petite tablée annoncée");
        for (const a of villageois()) assert.ok(!annonce.includes(a.name), `l'annonce nomme ${a.name}`);
        couvert("tablée : humain de l'ombre", places.filter(p => p.humain && p.role.camp !== "village").length);
      } else assert.equal(api.etat().glas, 0);
      // Les rôles et les primes partent au carnet de chaque joueur, à lui seul.
      for (const a of villageois().filter(x => x.system.joueur)) assert.ok(secretsEmis().some(e => e.recipients[0] === a.system.joueur && e.entree.html?.includes(roleDe(a).name)), `${a.name} sans carte de rôle`);
      // Un compagnon reçoit la sienne dans son carnet, gardé chez le MJ : rien ne part par le socket, ni son nom de joueur (aucun).
      for (const a of villageois().filter(x => x.system.compagnon)) {
        assert.ok(api.carnet(a.id).some(e => e.html?.includes(roleDe(a).name)), `compagnon ${a.name} sans carte de rôle`);
        assert.ok(a.flags["lakour-mj-ia"]?.compagnon?.temperament, `compagnon ${a.name} sans personnalité`);
      }
      assert.ok(!emissions.some(e => e.recipients?.includes("")), "un message de socket adressé à un compagnon");
      verifierVillageois(usages);
    }
    let fin = "";
    let tour = 0;
    while (!fin) {
      // (Sans vérification : une victoire déclarée par le système hors des textes du narrateur, un dernier geste par exemple.)
      if (!verifier && api.etat().vainqueur) { fin = victoireDuGeste(); break; }
      tour += 1;
      assert.ok(tour <= 30, `plus de 30 tours sans victoire\n${textes.slice(-6).join("\n\n")}`);
      // --- nuit
      const avantNuit = vivantsIds();
      const avant = new Map(villageois().map(a => [a.id, { cle: roleDe(a).system.cle, camp: secretDuMJ.camp(a) }]));
      const centreAvant = verifier ? (api.etat().ambigusSecret?.centre ?? []).map(r => r.system?.cle) : [];
      const fx = verifier ? effetsDeLaNuit(api.etat(), api.etat().tour + 1) : null;
      const nbDemandes = emissions.length;
      const carnetsAvant = new Map(villageois().filter(a => a.system.compagnon).map(a => [a.id, api.carnet(a.id).length]));
      const tourAvant = api.etat().tour;
      const nuit = await appeler("loups_nuit", { delai_secondes: 20 });
      // Le Glas final (petite tablée : posé d'office) : la nuit ne tombe pas, la partie s'arrête au soir — rien de la nuit à vérifier.
      if (/VICTOIRE/.test(nuit) && api.etat().tour === tourAvant) { couvert("tablée : le glas sonne"); fin = nuit; break; }
      const etatNuit = api.etat();
      if (nbCompagnons) {
        if (verifier) verifierSavoirDesCompagnons(`nuit ${tour}`);
        couvert("compagnons : choix de nuit", etatNuit.nuitPrecedente.actions.filter(x => game.actors.get(x.acteurId)?.system.compagnon && x.cibles.length).length);
      }
      const actions = etatNuit.nuitPrecedente.actions;
      if (verifier) {
        // Les proies de la nuit (logique/resolution.mjs, proiesDeLaNuit ; le MJ IA les lit au système depuis le moteur 27e7559) : celle de
        // la meute — ou, si l'Enfant de la brume a été surprise en épiant (action « surprise », tirée quand elle est notée), l'Enfant à sa
        // place : c'est elle que la meute dévore —, et les victimes des loups qui tuent seuls. La Louve mère ne mord qu'une proie ; un
        // mordu n'est pas une victime (rien à sauver) : l'Herboriste n'apprend que les autres.
        const propre = x => avant.get(x.acteurId)?.cle === x.roleCle;
        const surprise = actions.find(x => x.surprise === true && ROLES[x.roleCle]?.system.effet === "epier" && propre(x));
        const proies = [...(surprise ? [surprise.acteurId] : actions.filter(x => x.roleCle === "meute").flatMap(x => x.cibles)),
          ...actions.filter(x => ROLES[x.roleCle]?.system.camp === "meute" && ROLES[x.roleCle].system.effet === "tuer").flatMap(x => x.cibles)];
        const mordus = actions.filter(x => ROLES[x.roleCle]?.system.effet === "mordre" && propre(x)).map(x => x.cibles?.[0]).filter(Boolean);
        const aSauver = proies.filter(id => !mordus.includes(id));
        // La séance de Spiritisme (Gazette, Le Pacte, étape 9 ; api.mjs, seanceDeSpiritisme) se tient au MATIN, après les morts de la
        // nuit : ses demandes (objet « seance-… ») ne sont pas des réveils de nuit. Les effets du jour sur la nuit (hors d'atteinte :
        // cachette, traversée ; gardé à l'œil) ne valent que pour la nuit : au matin, comme sur table, la Liseuse d'étoiles choisit son
        // Spirite parmi TOUS les vivants, et le Spirite désigne qui il veut parmi eux. Les contrôles de nuit ci-dessous ne s'y
        // appliquent donc pas (ils les prenaient pour des réveils et refusaient un Spirite caché la nuit) ; elles ont les leurs.
        const deSeance = e => String(e.objet ?? "").startsWith("seance-");
        const vivantsAuMatin = vivantsIds();
        for (const d of emissions.slice(nbDemandes).filter(e => e.type === "demande" && deSeance(e))) {
          couvert("Spiritisme : séance");
          assert.ok(vivantsAuMatin.has(d.acteurId), `séance de Spiritisme : un mort (${d.acteurNom}) est interrogé`);
          if (d.objet === "seance-question") assert.ok(d.candidats.every(c => !game.actors.get(c.id)), "séance : la Liseuse choisit une question, pas un joueur");
          else assert.ok(d.candidats.length && d.candidats.every(c => vivantsAuMatin.has(c.id)), `séance : ${d.acteurNom} désigne parmi les vivants (${d.objet})`);
          // Le Spirite se choisit parmi les vivants présents : un absent du jour de la Gazette ne débat pas (api.mjs, seanceDeSpiritisme).
          if (d.objet === "seance-spirite") {
            const absents = new Set(game.lakourLoups.logique.absentsDuJour(game.lakourLoups.etat()));
            assert.deepEqual(new Set(d.candidats.map(c => c.id)), new Set([...vivantsAuMatin].filter(id => !absents.has(id))), "séance : le Spirite se choisit parmi les vivants présents");
          }
        }
        // Le Chapardeur et le Bateleur choisissent une CARTE (options : « centre-<i> », ou la clé d'une carte face visible), pas un
        // joueur : la carte n'est pas une cible (l'action est notée sans cible) ; le Chapardeur prend ce rôle, le Bateleur joue ce rôle
        // cette nuit, à son ordre, avec son invite (le MJ IA les réveille par api.reveiller depuis le moteur 27e7559). -> acteurId : clé
        const parCarte = d => ["chapardeur", "bateleur"].includes(d.objet) && d.candidats.every(c => !game.actors.get(c.id));
        const cartes = new Map();
        for (const d of emissions.slice(nbDemandes).filter(e => e.type === "demande" && parCarte(e))) {
          const choix = joueurs.journal.reponses.find(r => r.id === d.id)?.cibles?.[0];
          const noted = actions.find(x => x.acteurId === d.acteurId && x.roleCle === d.objet);
          assert.ok(noted && !noted.cibles.length, `${d.acteurNom} (${d.objet}) : le choix d'une carte noté sans cible`);
          if (!choix) continue;
          assert.ok(d.candidats.some(c => c.id === choix), `${d.acteurNom} (${d.objet}) : une carte qui ne lui était pas offerte`);
          const cle = d.objet === "chapardeur" ? centreAvant[Number(String(choix).slice("centre-".length))] : choix;
          cartes.set(d.acteurId, cle);
          couvert(`${d.objet} : une carte choisie`);
          if (d.objet === "bateleur") assert.ok(api.ambigus().retirees.includes(cle), `la carte jouée par le Bateleur (${cle}) n'est pas retirée au matin`);
          else if (game.actors.get(d.acteurId)?.system.vivant) couvert("chapardeur : il tient la carte prise", roleDe(game.actors.get(d.acteurId))?.system.cle === cle ? 1 : 0);
        }
        // (Hors la demande posthume d'une Braconnière tombée cette nuit : elle choisit parmi tous les vivants.)
        for (const d of emissions.slice(nbDemandes).filter(e => e.type === "demande" && !(e.posthume && e.objet === "emporter") && !deSeance(e) && !parCarte(e))) {
          assert.ok(avantNuit.has(d.acteurId), `un mort (${d.acteurNom}) est réveillé la nuit`);
          assert.ok(!fx.horsDAtteinte.includes(d.acteurId) || d.mode === "texte", `${d.acteurNom}, hors d'atteinte, est réveillé`);
          for (const c of d.candidats.filter(c => avantNuit.has(c.id))) assert.ok(!fx.horsDAtteinte.includes(c.id), `${d.acteurNom} peut viser ${c.nom}, hors d'atteinte`);
          if (d.mode === "texte") {
            // Le mot du Messager : l'expéditeur choisi par le Messager écrit, le Messager le porte.
            const porte = actions.find(x => ROLES[x.roleCle]?.system.effet === "messager" && x.cibles[0] === d.acteurId);
            assert.ok(porte, "un mot demandé sans Messager");
            const ecrit = joueurs.journal.textes.find(t => t.id === d.id);
            assert.equal(porte.texte ?? "", ecrit.texte, "le mot porté est celui écrit");
            continue;
          }
          // Son réveil : celui de son rôle, ou celui de la carte qu'il a prise (Chapardeur) ou qu'il joue cette nuit (Bateleur).
          const carte = cartes.get(d.acteurId);
          const parSaCarte = Boolean(carte && ROLES[carte]?.system.nuit.invite && d.invite.endsWith(ROLES[carte].system.nuit.invite));
          const { camp } = avant.get(d.acteurId);
          const cle = parSaCarte ? carte : avant.get(d.acteurId).cle;
          if (parSaCarte) couvert("carte jouée ou prise : son réveil");
          // L'invite propre à un rôle ne va qu'à ce rôle (ou, pour l'invite de chasse de la meute, à un loup — le Mâtin qui choisit la
          // meute en début de nuit chasse avec elle dès cette nuit : son camp d'après la nuit).
          const loupCetteNuit = camp === "meute" || secretDuMJ.camp(game.actors.get(d.acteurId)) === "meute";
          for (const r of CONTENU.roles.filter(r => r.system.nuit.invite && d.invite.endsWith(r.system.nuit.invite))) {
            const chasse = r.system.camp === "meute" && r.system.nuit.ordre === 40;
            assert.ok(r.system.cle === cle || (chasse && loupCetteNuit), `invite « ${d.invite} » montrée à ${d.acteurNom} (${cle})`);
          }
          const effet = ROLES[cle]?.system.effet;
          // Seulement pour son propre réveil : un Fossoyeur mordu chasse aussi avec la meute, parmi les vivants.
          const sonInvite = ROLES[cle]?.system.nuit.invite;
          if (effet === "voir-role-mort" && sonInvite && d.invite.endsWith(sonInvite)) {
            assert.ok(d.candidats.every(c => !avantNuit.has(c.id)), "le Fossoyeur n'interroge que des tombes");
          }
          if (effet === "mordre" && d.invite === ROLES[cle].system.nuit.invite) assert.ok(d.candidats.every(c => proies.includes(c.id)), "la Louve mère ne mord que la proie");
          if (effet === "remede" && aSauver.length && d.invite.endsWith(ROLES[cle].system.nuit.invite)) assert.match(d.invite, /la meute a attaqué/, "l'Herboriste apprend qui a été attaqué");
          // Gardé à l'œil : il ne vise que sa maison (une tombe n'est pas une maison : le Fossoyeur interroge les morts).
          if (fx.surveilles.includes(d.acteurId) && camp !== "meute") assert.ok(d.candidats.every(c => c.id === d.acteurId || !avantNuit.has(c.id)), `${d.acteurNom}, gardé à l'œil, vise une autre maison`);
          // Le choix noté est celui du joueur : la réponse forgée par un autre (un mort) a été ignorée.
          if (camp !== "meute" && !d.invite.endsWith(ROLES["loup-de-brumecombe"].system.nuit.invite)) {
            const reponse = joueurs.journal.reponses.find(r => r.id === d.id);
            const noted = actions.find(x => x.acteurId === d.acteurId && x.roleCle === cle);
            assert.deepEqual(noted?.cibles, reponse.cibles, `choix de ${d.acteurNom} (${cle})`);
          }
        }
        for (const x of actions) assert.ok(avantNuit.has(x.acteurId), `un mort agit la nuit : ${x.roleCle}`);
        // Le Pont : la nuit qui suit une mort sur l'autre rive, la meute ne peut pas y chasser.
        if (fx.pontBloque) {
          couvert("Pont (meute bloquée)");
          for (const d of emissions.slice(nbDemandes).filter(e => e.type === "demande" && e.invite === ROLES["loup-de-brumecombe"].system.nuit.invite)) {
            assert.ok(d.candidats.every(c => !surLAutreRive(game.actors.get(c.id).system.maison)), "la meute traverse le Pont bloqué");
          }
          const proie = actions.find(x => x.roleCle === "meute")?.cibles[0];
          assert.ok(!proie || !surLAutreRive(game.actors.get(proie).system.maison), "proie sur l'autre rive malgré le Pont");
        }
        // Les effets du jour ont tenu cette nuit.
        const mortsDeLaNuit = etatNuit.morts.filter(m => m.tour === etatNuit.tour && avantNuit.has(m.acteurId));
        for (const m of mortsDeLaNuit) {
          // (Le loup blessé par la vieille épée du Vieux Sergent meurt où qu'il dorme : rien ne l'en protège.)
          if (!["chagrin", "emporte", "contamine"].includes(m.cause)) assert.ok(!fx.horsDAtteinte.includes(m.acteurId), `${game.actors.get(m.acteurId).name}, hors d'atteinte, meurt (${m.cause})`);
          if (m.cause === "meute") {
            assert.ok(!fx.asiles.includes(m.acteurId), "la meute tue à la Chapelle");
            const loupATaverne = fx.taverneEnJeu && fx.taverne.some(id => avant.get(id)?.camp === "meute");
            assert.ok(!fx.taverne.includes(m.acteurId) || loupATaverne, "la meute tue à la Taverne sans loup parmi les dormeurs");
          }
        }
        couvert("verrou (attaque arrêtée)", fx.verrous.length && /verrou du Forgeron a tenu/.test(nuit) ? 1 : 0);
        couvert("hors d'atteinte (nuit)", fx.horsDAtteinte.length);
      }
      couvert("fête : neige", /La neige est tombée cette nuit/.test(nuit) ? 1 : 0);
      couvert("fête : présent ouvert", /Le présent de .* s'est ouvert/.test(nuit) ? 1 : 0);
      couvert("fête : murmure des âmes", /Nuit des âmes : l'âme de/.test(nuit) ? 1 : 0);
      couvert("mot du Messager remis", secretsEmis(nbDemandes).filter(e => /Le Messager vous remet un mot/.test(e.entree.texte)).length);
      if (verifier) {
        fioles.poison += (nuit.match(/a versé son poison/g) ?? []).length;
        fioles.remede += (nuit.match(/sauvé par un remède/g) ?? []).length;
        assert.ok(fioles.poison <= 1 && fioles.remede <= 1, `une fiole de chaque par partie : ${JSON.stringify(fioles)}`);
        // Une fiole vide est annoncée au joueur (socket) ou au compagnon (son carnet, gardé chez le MJ) ; de même les fioles restées
        // bouchées (le remède versé à qui n'était pas en danger, l'Enfant surprise à la place de la proie annoncée : l'usage est rendu).
        const notesCompagnons = villageois().filter(a => a.system.compagnon).flatMap(a => api.carnet(a.id).slice(carnetsAvant.get(a.id) ?? 0).map(e => e.texte ?? ""));
        compterUsages(actions, usages, [...secretsEmis(nbDemandes).map(e => e.entree.texte), ...notesCompagnons].filter(t => /fiole de \S+ est vide|fioles restent bouchées/.test(t ?? "")).length);
        verifierVillageois(usages);
      }
      if (/VICTOIRE/.test(nuit)) { fin = nuit; break; }
      if (/^En attente : /m.test(nuit)) {
        fin = await emporter();
        if (fin) break;
      }
      // --- jour : les joueurs usent de leurs pouvoirs (Table de jeu -> socket, à l'aube), puis le narrateur (loups_jour)
      await calme();
      // --- débat : les compagnons vivants (et non réduits au silence) prennent la parole
      if (nbCompagnons) {
        const dits = await compagnons.debattre({ max: 3 });
        couvert("compagnons : répliques au débat", dits.length);
        if (verifier) for (const d of dits) assert.ok(game.actors.get(d.acteurId).system.vivant && !game.actors.get(d.acteurId).system.silence, "un mort ou un muet parle");
      }
      await pouvoirDuNarrateur();
      if (verifier) {
        verifierSecrets("pouvoirs de jour");
        verifierVillageois(usages);
      }
      // --- vote
      const avantVote = vivantsIds();
      const clos = await voterLeJour();
      const resultat = api.etat().vote.resultat ?? {};
      if (verifier) {
        // Le compte des voix : votants vivants, bulletins des joueurs simulés pour CE vote, morts et fraudes refusés.
        // Le Pacte : ni un Innocent gracié, ni, le lendemain du Souffre-douleur, qui n'est pas sur sa liste.
        const bulletins = new Map(joueurs.journal.bulletins.filter(b => b.numero === resultat.numero && b.cible && !api.logique.priveDeVote(api.etat(), b.votant, "execution"))
          .map(b => [b.votant, b.cible]));
        // Les compagnons votent par leur cerveau (résolveur), au même vote que les humains.
        for (const v of votesDesCompagnons.filter(v => v.numero === resultat.numero && v.cible)) bulletins.set(v.votant, v.cible);
        couvert("compagnons : voix", votesDesCompagnons.filter(v => v.numero === resultat.numero && v.cible).length);
        assert.deepEqual(resultat.votes, Object.fromEntries(bulletins), "voix enregistrées = bulletins des vivants");
        for (const votant of Object.keys(resultat.votes)) assert.ok(avantVote.has(votant), "un mort a voté");
        const attendu = {};
        for (const c of bulletins.values()) attendu[c] = (attendu[c] ?? 0) + 1;
        // La plume noire de la Pie (Pacte) : deux voix sans votant contre sa cible.
        if (resultat.plume) { attendu[resultat.plume] = (attendu[resultat.plume] ?? 0) + 2; couvert("plume noire de la Pie"); }
        assert.deepEqual(resultat.decompte, attendu, "décompte");
        const max = Math.max(0, ...Object.values(attendu));
        // La cloche du Sonneur (vote double) : les deux premiers scores ; sinon, le plus de voix.
        const second = Math.max(0, ...Object.values(attendu).filter(n => n < max));
        // Le Souffre-douleur (Pacte) paie l'égalité : il est désigné sans avoir le plus de voix.
        for (const elu of resultat.elus) assert.ok(api.etat().vote.majoriteAbsolue || resultat.decompte[elu] === max || elu === resultat.souffreDouleur
          || (api.etat().vote.double && resultat.decompte[elu] === second), "l'élu a le plus de voix");
        if (api.etat().vote.double) couvert("cloche du Sonneur (vote double)");
        for (const [id, nb] of Object.entries(resultat.decompte)) assert.ok(clos.includes(`${game.actors.get(id).name} : ${nb}`), `décompte annoncé : ${clos}`);
        // Petite tablée : pas de jour sans verdict — une voix au moins, un condamné au moins (le sort tranche les égalités).
        if (tablee && Object.keys(resultat.decompte).length) assert.ok(resultat.elus.length >= 1, `petite tablée : égalité sans verdict : ${clos}`);
        if (!resultat.elus.length) {
          const raison = !Object.keys(resultat.decompte).length ? /Aucun vote :/ : resultat.egalite ? /Égalité :/
            : api.etat().vote.majoriteAbsolue ? /Pas de majorité absolue/ : /personne n'est désigné/;
          assert.match(clos, raison, "raison annoncée quand personne n'est désigné");
        }
      }
      if (tablee) couvert("tablée : le sort tranche", (resultat.sort?.length ?? 0) + (resultat.departage?.sort?.length ?? 0));
      const designes = /Désignés? : (.+) \(loups_eliminer pour chacun\)/.exec(clos)?.[1].split(" et ") ?? [];
      if (verifier) assert.deepEqual(designes, resultat.elus.map(id => game.actors.get(id).name));
      for (const nom of designes) {
        fin = await eliminer(nom, "vote");
        if (fin) break;
      }
      // Un second vote ouvert de lui-même après l'exécution (le signe du Greffier bègue, le Dépit, l'Enthousiasme de la Gazette) :
      // loups_nuit refuse tant qu'il est ouvert (moteur 27e7559). On le clôt et on exécute avant la nuit.
      for (let second = 0; !fin && api.etat().vote.ouvert && !api.etat().vainqueur; second++) {
        assert.ok(second < 4, "les seconds votes ne finissent pas");
        couvert("second vote (ouvert de lui-même)");
        const clos2 = await voterLeJour();
        for (const nom of /Désignés? : (.+) \(loups_eliminer pour chacun\)/.exec(clos2)?.[1].split(" et ") ?? []) {
          fin = await eliminer(nom, "vote");
          if (fin) break;
        }
      }
      // Une victoire tombée d'un dernier geste ou d'une grâce sans texte (le système l'a déclarée).
      if (!fin && !verifier && api.etat().vainqueur) fin = victoireDuGeste();
      if (fin) break;
      // --- le village choisit qui dormira à la Chapelle
      if (api.etat().batimentsCles.includes("chapelle")) {
        await appeler("loups_vote", { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "chapelle" });
        await calme();
        await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "chapelle" });
        const elu = api.etat().vote.resultat.elu;
        if (elu) {
          if (verifier) assert.ok(api.etat().jour.effets.some(x => x.type === "asile" && x.cible === elu && x.nuit === api.etat().tour + 1), "l'élu dort à la Chapelle");
          couvert("chapelle (vote)");
        }
      }
    }
    if (verifier) {
      verifierVictoireFinale(fin);
      verifierVillageois(usages);
      verifierSecrets("fin");
      if (nbCompagnons) verifierSavoirDesCompagnons("fin");
      assert.deepEqual(erreurs(), [], "aucune erreur dans les messages de socket");
      await api.attendreGazette();
      assert.deepEqual(erreursAvalees, [], "aucune erreur avalée par le système (séance de Spiritisme, Crieur, succession…)");
    }
    // Ce que la partie a exercé.
    for (const x of journalHooks.filter(x => x.nom === "lakourLoups.jour")) couvert(x.args[0].pouvoir);
    const chat = messages.map(m => sansHTML(m.content)).join("\n");
    couvert("Moulin (public)", (chat.match(/Les ailes du Moulin ont compté/g) ?? []).length);
    couvert("Moulin (Meunière)", secretsEmis().filter(e => /La meule du Moulin vous souffle/.test(e.entree.texte)).length);
    couvert("Lavoir", (chat.match(/Au lavoir, on raconte/g) ?? []).length);
    couvert("Cimetière", (chat.match(/Les tombes parlent/g) ?? []).length);
    couvert("Forge (sang de bête)", (chat.match(/Du sang de bête sur le seuil/g) ?? []).length);
    couvert("Taverne (meute repoussée)", api.etat().journalSecret.filter(x => /pas osé tuer .* à la Taverne/.test(x.texte)).length);
    couvert("Chapelle (meute repoussée)", api.etat().journalSecret.filter(x => /pas pu entrer à la Chapelle/.test(x.texte)).length);
    const e = api.etat();
    const v = game.actors.get(e.vainqueur);
    const camp = !v ? e.vainqueur : secretDuMJ.amoureux(v) && game.actors.get(secretDuMJ.amoureux(v))?.system.vivant ? "amoureux" : roleDe(v).system.cle;
    return { vainqueur: e.vainqueur, tours: tour, camp, gagnants: gagnantsDeLaPartie(roleDeDepart), n: total, niveau: tablee ? "petite-tablee" : niveau,
      roles: [...roleDeDepart.values()].sort(), batiments: [...(e.batimentsCles ?? [])], variantes: L.choixDesVariantes(e.variantes),
      village: Boolean(e.village?.actif), gazette: Boolean(e.gazette?.actif), adresse };
  } catch (err) {
    throw new Error(`${niveau}, ${n} joueurs${nbCompagnons ? ` et ${nbCompagnons} compagnons` : ""}, graine « ${graine} » : ${err.message}\n--- derniers échanges :\n${textes.slice(-4).join("\n\n")}`, { cause: err });
  } finally {
    Math.random = hasardOrigine;
  }
}
