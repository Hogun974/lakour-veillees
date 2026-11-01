// Essai d'INTÉGRATION des « Veillées de Brumecombe » : le système lakour-loups (API réelle, socket réel), le vrai contenu
// de lakour-veillees (rôles, métiers, bâtiments, compositions.json) et les OUTILS du MJ IA (loups_*), sur la doublure de
// Foundry (essais/doublures/foundry-loups.mjs) avec des joueurs simulés. Des parties complètes, jusqu'à la victoire :
// nuits (dont le mot du Messager), aube (bâtiments qui parlent), pouvoirs de jour (métiers, Conteuse, bâtiments, par la
// Table de jeu des joueurs et par loups_jour), vote (ruban de la Tisserande, Juge de paix qui fait revoter), Puits,
// vote de la Chapelle. À chaque pas : rien de secret dans l'état public ni dans ce que le socket diffuse.
// Avec des COMPAGNONS IA (villageois sans joueur, joués par le cerveau du MJ IA, ici en repli sans IA) : 3 humains simulés et
// des compagnons, jusqu'à la victoire ; les compagnons choisissent la nuit (résolveur du système, sans socket), parlent au
// débat et votent ; à chaque nuit, ce qu'on enverrait au modèle d'un compagnon ne contient aucun secret qu'il ignore.
// Le PLATEAU suit : après chaque outil du narrateur, chaque villageois a un jeton verrouillé sur la scène du village, à sa
// place pour la phase (devant sa maison la nuit et à l'aube, en cercle sur la place pour le vote, au cimetière s'il est
// mort), la lumière est celle de la phase, l'image reste neutre tant que le rôle n'est pas révélé, crâne et silence suivent.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  installerFoundry, simulerJoueurs, calme, erreurs, envoyerAuMJ, journalHooks, emissions, messages, reglages, CONTENU, ajouterScene, erreursHooks
} from "./doublures/foundry-loups.mjs";
import { PLAN_VILLAGE, PLATEAU_VILLAGE, PLACE, BATIMENTS_CARTE } from "../modules/lakour-veillees/contenu/village.mjs";

installerFoundry({ contenu: true });
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const { creerHasard, choisir, melanger, verifierVictoire, CAUSES_SECRETES, POUVOIRS_JOUR, effetsDeLaNuit, surLAutreRive } = await import("../systems/lakour-loups/logique/index.mjs");
const { OUTILS } = await import("../modules/lakour-mj-ia/scripts/outils.js");
const { Compagnons, reinitialiserPrive, privesDe } = await import("../modules/lakour-mj-ia/scripts/compagnons-jeu.js");
const { contexteCompagnon, texteBrut } = await import("../modules/lakour-mj-ia/scripts/compagnons.js");
const plateau = await import("../systems/lakour-loups/scripts/plateau.mjs");
const { versCases, lumiereDePhase } = await import("../systems/lakour-loups/logique/index.mjs");
const NEUTRE = "modules/lakour-veillees/assets/jetons/villageois.svg";
const CIMETIERE = BATIMENTS_CARTE.find(b => b.nom === "Cimetière");
let sceneVillage = null;
const outil = nom => OUTILS.find(o => o.nom === nom);

const ROLES = Object.fromEntries(CONTENU.roles.map(r => [r.system.cle, r]));
const CLES_A_TIRET = [...CONTENU.roles, ...CONTENU.metiers, ...CONTENU.batiments].map(d => d.system.cle).filter(c => c.includes("-"));
const IDS_CONTENU = [...CONTENU.roles, ...CONTENU.metiers, ...CONTENU.batiments].map(d => d._id);

// ------------------------------------------------------------------ mise en place d'un monde
let joueursSimules = null;
let compagnons = null;           // les cerveaux des compagnons (repli sans IA : pas de fournisseur)
let votesDesCompagnons = [];     // { numero, votant, cible } : ce que chaque compagnon a voté
function monde(n, graine, { simules = true } = {}) {
  installerFoundry({ joueurs: n, contenu: true });
  enregistrerReglages(() => {});
  game.settings.register("lakour-mj-ia", "personnalites", { default: [{ id: "conteuse", nomAffiche: "La Conteuse" }] });
  game.settings.register("lakour-mj-ia", "personnaliteActive", { default: "conteuse" });
  game.lakourLoups = api;          // ce que fait le hook « ready » du système
  ecouterSocket();
  // Le plateau : la scène du village, la mise en scène branchée sur les hooks du système (sans délai pour l'essai).
  plateau.oublierPlateau();
  plateau.brancherPlateau();
  api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
  api.plateau.configurer({ jetonNeutre: NEUTRE });
  sceneVillage = ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
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
  const creer = ChatMessage.implementation.create;
  ChatMessage.implementation.create = async m => { verifierMessage(m); return creer(m); };
  joueursSimules = simules ? simulerJoueurs({ graine: `${graine}-joueurs` }) : null;
  return joueursSimules;
}

const roleDe = a => a?.items.find(i => i.type === "role") ?? null;
const metierDe = a => a?.items.find(i => i.type === "metier") ?? null;
const villageois = () => game.actors.filter(a => a.type === "villageois");
const vivantsIds = () => new Set(villageois().filter(a => a.system.vivant).map(a => a.id));
// Ce que lit un joueur : sans balises, et un lien @UUID[…]{nom} réduit à son nom, comme Foundry l'affiche (un lien sans nom
// garde son uuid brut, que verifierTexte refuse).
const sansHTML = s => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1");
const secretsEmis = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret");

// ------------------------------------------------------------------ invariants
// Aucun chuchotement : Foundry livre chaque message de chat, chuchotements compris, à TOUS les navigateurs ; le secret
// passe par le carnet (socket adressé). Aucun rôle secret dans un message public : un nom de rôle n'y paraît qu'à côté du
// nom d'un villageois révélé qui l'a. Seule exception : le récit de fin, une fois la partie finie (toutes les cartes se retournent).
function verifierMessage(m) {
  const texte = sansHTML(m.content);
  verifierTexte(texte, "chat");
  assert.ok(!m.whisper?.length, `chuchotement (livré à tous les navigateurs) : ${texte}`);
  if (/loups-recit/.test(m.content)) {
    assert.equal(game.lakourLoups.etat().phase, "fin", `récit de fin avant la fin : ${texte}`);
    return;
  }
  for (const a of villageois()) {
    const r = roleDe(a);
    if (!r || a.system.revele || !texte.includes(r.name)) continue;
    const justifie = villageois().some(b => b.system.revele && roleDe(b)?.name === r.name && texte.includes(b.name));
    assert.ok(justifie, `rôle secret « ${r.name} » (${a.name}) dans un message public : ${texte}`);
  }
}

// Ni undefined, ni [object Object], ni NaN, ni gabarit non rempli, ni identifiant brut (id d'acteur, d'objet, uuid, clé de rôle).
function verifierTexte(texte, ou) {
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
function verifierSecrets(ou) {
  const pub = reglages.get("lakour-loups.partie").valeur;
  assert.deepEqual([pub.nuit.actions, pub.nuitPrecedente.actions, pub.nuitPrecedente.bilan, pub.primes, pub.fioles, pub.asperges, pub.vote.votes,
    pub.carnets, pub.journalSecret, pub.causes], [[], [], null, {}, {}, [], {}, {}, [], {}], `${ou} : secret dans l'état public`);
  for (const m of pub.morts) assert.ok(!CAUSES_SECRETES.includes(m.cause), `${ou} : vraie cause « ${m.cause} » dans l'état public`);
  assert.equal(reglages.get("lakour-loups.secrets").conf.scope, "client");
  assert.equal(reglages.get("lakour-loups.carnet").conf.scope, "client");
  for (const e of emissions.slice(controle)) {
    if (e.type === "hook") {
      assert.equal(e.recipients, null, e.nom);
      const etat = e.args?.[1];
      if (etat?.nuit) {
        assert.deepEqual([etat.nuit.actions, etat.nuitPrecedente.actions, etat.primes, etat.fioles, etat.asperges, etat.vote.votes, etat.carnets],
          [[], [], {}, {}, [], {}, {}], `${ou} : ${e.nom} diffuse un secret`);
      }
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
async function verifierPlateau(ou) {
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
    assert.equal(t[0].texture.src, revele ? roleDe(a).img : NEUTRE, `${ou} : image de ${a.name} (${roleDe(a).system.cle}, révélé : ${revele})`);
  }
  for (let i = 0; i < cercle.length; i++) for (let j = i + 1; j < cercle.length; j++) {
    assert.ok(Math.hypot(cercle[i].x - cercle[j].x, cercle[i].y - cercle[j].y) >= 1 - 1e-6, `${ou} : deux jetons du cercle se chevauchent`);
  }
  assert.deepEqual(erreursHooks, [], `${ou} : erreur dans un écouteur de hook`);
}

function verifierVillageois(usages) {
  for (const a of villageois()) {
    assert.equal(a.items.filter(i => i.type === "role").length, 1, `${a.name} : un seul rôle`);
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
// une fiole vide de l'Herboriste ne compte pas, l'usage lui est rendu).
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
  const meute = vivants.filter(a => a.system.camp === "meute");
  if (e.vainqueur === "village") {
    assert.equal(meute.length, 0, "le village gagne : plus aucun loup vivant");
    assert.ok(!vivants.some(a => ROLES[roleDe(a).system.cle]?.system.victoireCle === "dernier-survivant"), "ni pyromane vivant");
  } else if (e.vainqueur === "meute") {
    assert.ok(meute.length > 0 && meute.length >= vivants.length - meute.length, "la meute gagne : au moins autant de loups que d'autres");
  } else {
    assert.ok(game.actors.get(e.vainqueur), "solitaire ou amoureux vainqueur");
  }
  // Le vainqueur est celui que dicte la règle sur l'état final.
  const aPlat = villageois().map(a => ({ id: a.id, vivant: a.system.vivant, camp: a.system.camp, amoureux: a.system.amoureux,
    role: { cle: roleDe(a).system.cle, victoireCle: roleDe(a).system.victoireCle } }));
  assert.equal(verifierVictoire({ villageois: aPlat, morts: e.morts, primes: e.primes }), e.vainqueur);
}

// Ce que les parties ont réellement exercé, toutes ensemble (vérifié dans le bilan).
const couverture = new Map();
const couvert = (nom, n = 1) => { if (n) couverture.set(nom, (couverture.get(nom) ?? 0) + n); };

// Ce qu'on enverrait au modèle d'un compagnon (prompt système et message) : aucun rôle secret d'un autre (son nom à côté de
// celui de son rôle), aucune ligne de la chronique secrète du MJ, aucun mot du Messager qu'il n'a ni écrit ni reçu. Est permis
// ce que son joueur saurait : son carnet, sa fiche, le chat public, les annonces publiques, les rôles révélés.
function verifierSavoirDesCompagnons(ou) {
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
async function jouerPartie({ n, niveau, graine, nbCompagnons = 0 }) {
  const joueurs = monde(n, graine);
  // Une graine sur cinq sans révélation à la mort : le Cimetière parle alors.
  if (graine === "cendres") await game.settings.set("lakour-loups", "revelerALaMort", false);
  const hasardOrigine = Math.random;
  Math.random = creerHasard(`${graine}-monde`);    // distribution, primes, épier, nouvelles : reproductibles
  const h = creerHasard(`${graine}-mj`);
  const usages = new Map();
  const fioles = { poison: 0, remede: 0 };
  const textes = [];
  const appeler = async (nom, args) => {
    const r = await outil(nom).executer(args);
    textes.push(`${nom} ${JSON.stringify(args)}\n${r.contenu}`);
    if (process.env.TRACE_LOUPS) console.log(`${textes.at(-1)}\n`);
    assert.ok(!r.erreur, `${nom} en erreur : ${r.contenu}`);
    verifierTexte(r.contenu, nom);
    verifierSecrets(nom);
    await verifierPlateau(nom);
    return r.contenu;
  };
  // Le narrateur élimine (emporté dans la tombe, puis désignés du vote) ; renvoie le texte s'il annonce la victoire.
  const eliminer = async (nom, cause) => {
    const t = await appeler("loups_eliminer", { villageois: nom, cause, reveler: true });
    await calme();   // un mort peut confier un dernier mot au Puits
    if (/VICTOIRE/.test(t)) return t;
    const emporte = /(.+?) peut emporter quelqu'un/.exec(t);
    if (emporte) return emporter([emporte[1].split(" et ").at(-1)]);
    return "";
  };
  const emporter = async noms => {
    for (const nom of noms) {
      const cible = choisir(villageois().filter(a => a.system.vivant).map(a => a.name), h);
      if (!cible) return "";
      const t = await eliminer(cible, "emporte");
      if (t) return t;
    }
    return "";
  };
  // Le narrateur applique, de temps en temps, un pouvoir de jour annoncé à voix haute (loups_jour).
  const pouvoirDuNarrateur = async () => {
    if (h() < 0.3) verifierTexte(await appeler("loups_jour", { action: "lister", villageois: "", pouvoir: "", cibles: [], texte: "" }), "loups_jour");
    const possibles = villageois().filter(a => a.system.vivant && a.system.joueur)
      .flatMap(a => api.pouvoirsDeJour(a.id).filter(p => p.possible && !["juge-de-paix", "puits"].includes(p.pouvoir)).map(p => ({ a, p })));
    if (!possibles.length || h() > 0.6) return;
    const { a, p } = choisir(possibles, h);
    const cibles = melanger(p.candidats, h).slice(0, p.cibles).map(c => c.nom);
    await appeler("loups_jour", { action: "utiliser", villageois: a.name, pouvoir: p.nom, cibles, texte: "" });
  };
  // Le vote d'exécution : ruban de la Tisserande (prolongation) et Juge de paix (revote) compris.
  const voterLeJour = async () => {
    await appeler("loups_vote", { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
    let clos = "";
    for (let essai = 0; ; essai++) {
      assert.ok(essai < 8, "le vote ne se termine pas");
      await calme();
      clos = await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
      if (/porte le ruban de la Tisserande/.test(clos)) {
        couvert("ruban (prolongation)");
        assert.equal(api.etat().vote.ouvert, true, "le vote reste ouvert pendant la défense");
        continue;
      }
      await calme();   // le Juge de paix peut annuler, juste après le dépouillement
      if (api.etat().vote.ouvert) {
        couvert("juge (revote)");
        const juge = villageois().find(a => roleDe(a).system.cle === "juge-de-paix");
        assert.ok(juge.system.revele, "le Juge de paix se révèle en annulant");
        assert.equal(roleDe(juge).system.usages.restant, 0, "une fois par partie");
        continue;
      }
      return clos;
    }
  };
  try {
    // Sans composition nommée : composition générée, équilibrée pour ce nombre de joueurs (compagnons IA compris).
    const total = n + nbCompagnons;
    const depart = await appeler("loups_distribuer", { joueurs: [], composition: "", niveau, ...(nbCompagnons ? { compagnons: nbCompagnons } : {}) });
    assert.match(depart, new RegExp(`composition « générée, [^»]+ » \\(${total} joueurs${nbCompagnons ? `, dont ${nbCompagnons} compagnons IA` : ""}\\)`));
    assert.match(depart, /À annoncer à tous \(sans dire qui\) : Meute : /);
    assert.equal(villageois().length, total);
    assert.equal(villageois().filter(a => a.system.compagnon && !a.system.joueur).length, nbCompagnons, "compagnons sans joueur");
    assert.equal(api.etat().composition, "generee");
    // Composition générée : bon nombre de loups, équilibre des poids proche de zéro.
    const equilibre = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));
    const distribues = villageois().map(a => roleDe(a).system.cle);
    assert.equal(distribues.filter(c => equilibre.roles[c].camp === "meute").length, api.logique.nombreDeLoups(total));
    assert.ok(Math.abs(distribues.reduce((s, c) => s + equilibre.roles[c].poids, 0)) <= 3, `déséquilibrée : ${distribues.join(", ")}`);
    // Les rôles et les primes partent au carnet de chaque joueur, à lui seul.
    for (const a of villageois().filter(x => x.system.joueur)) assert.ok(secretsEmis().some(e => e.recipients[0] === a.system.joueur && e.entree.html?.includes(roleDe(a).name)), `${a.name} sans carte de rôle`);
    // Un compagnon reçoit la sienne dans son carnet, gardé chez le MJ : rien ne part par le socket, ni son nom de joueur (aucun).
    for (const a of villageois().filter(x => x.system.compagnon)) {
      assert.ok(api.carnet(a.id).some(e => e.html?.includes(roleDe(a).name)), `compagnon ${a.name} sans carte de rôle`);
      assert.ok(a.flags["lakour-mj-ia"]?.compagnon?.temperament, `compagnon ${a.name} sans personnalité`);
    }
    assert.ok(!emissions.some(e => e.recipients?.includes("")), "un message de socket adressé à un compagnon");
    verifierVillageois(usages);
    let fin = "";
    let tour = 0;
    while (!fin) {
      tour += 1;
      assert.ok(tour <= 30, `plus de 30 tours sans victoire\n${textes.slice(-6).join("\n\n")}`);
      // --- nuit
      const avantNuit = vivantsIds();
      const avant = new Map(villageois().map(a => [a.id, { cle: roleDe(a).system.cle, camp: a.system.camp }]));
      const fx = effetsDeLaNuit(api.etat(), api.etat().tour + 1);
      const nbDemandes = emissions.length;
      const carnetsAvant = new Map(villageois().filter(a => a.system.compagnon).map(a => [a.id, api.carnet(a.id).length]));
      const nuit = await appeler("loups_nuit", { delai_secondes: 20 });
      const etatNuit = api.etat();
      if (nbCompagnons) {
        verifierSavoirDesCompagnons(`nuit ${tour}`);
        couvert("compagnons : choix de nuit", etatNuit.nuitPrecedente.actions.filter(x => game.actors.get(x.acteurId)?.system.compagnon && x.cibles.length).length);
      }
      const actions = etatNuit.nuitPrecedente.actions;
      const proies = actions.filter(x => x.roleCle === "meute" || ROLES[x.roleCle]?.system.camp === "meute" && ROLES[x.roleCle].system.effet === "tuer").flatMap(x => x.cibles);
      for (const d of emissions.slice(nbDemandes).filter(e => e.type === "demande")) {
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
        const { cle, camp } = avant.get(d.acteurId);
        // L'invite propre à un rôle ne va qu'à ce rôle (ou, pour l'invite de chasse de la meute, à un loup).
        for (const r of CONTENU.roles.filter(r => r.system.nuit.invite && d.invite.endsWith(r.system.nuit.invite))) {
          const chasse = r.system.camp === "meute" && r.system.nuit.ordre === 40;
          assert.ok(r.system.cle === cle || (chasse && camp === "meute"), `invite « ${d.invite} » montrée à ${d.acteurNom} (${cle})`);
        }
        const effet = ROLES[cle]?.system.effet;
        // Seulement pour son propre réveil : un Fossoyeur mordu chasse aussi avec la meute, parmi les vivants.
        const sonInvite = ROLES[cle]?.system.nuit.invite;
        if (effet === "voir-role-mort" && sonInvite && d.invite.endsWith(sonInvite)) {
          assert.ok(d.candidats.every(c => !avantNuit.has(c.id)), "le Fossoyeur n'interroge que des tombes");
        }
        if (effet === "mordre" && d.invite === ROLES[cle].system.nuit.invite) assert.ok(d.candidats.every(c => proies.includes(c.id)), "la Louve mère ne mord que la proie");
        if (effet === "remede" && proies.length && d.invite.endsWith(ROLES[cle].system.nuit.invite)) assert.match(d.invite, /la meute a attaqué/, "l'Herboriste apprend qui a été attaqué");
        // Gardé à l'œil : il ne vise que sa maison (une tombe n'est pas une maison : le Fossoyeur interroge les morts).
        if (fx.surveilles.includes(d.acteurId) && camp !== "meute") assert.ok(d.candidats.every(c => c.id === d.acteurId || !avantNuit.has(c.id)), `${d.acteurNom}, gardé à l'œil, vise une autre maison`);
        // Le choix noté est celui du joueur : la réponse forgée par un autre (un mort) a été ignorée.
        if (camp !== "meute") {
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
        if (m.cause !== "chagrin") assert.ok(!fx.horsDAtteinte.includes(m.acteurId), `${game.actors.get(m.acteurId).name}, hors d'atteinte, meurt (${m.cause})`);
        if (m.cause === "meute") {
          assert.ok(!fx.asiles.includes(m.acteurId), "la meute tue à la Chapelle");
          const loupATaverne = fx.taverneEnJeu && fx.taverne.some(id => avant.get(id)?.camp === "meute");
          assert.ok(!fx.taverne.includes(m.acteurId) || loupATaverne, "la meute tue à la Taverne sans loup parmi les dormeurs");
        }
      }
      couvert("verrou (attaque arrêtée)", fx.verrous.length && /verrou du Forgeron a tenu/.test(nuit) ? 1 : 0);
      couvert("hors d'atteinte (nuit)", fx.horsDAtteinte.length);
      couvert("mot du Messager remis", secretsEmis(nbDemandes).filter(e => /Le Messager vous remet un mot/.test(e.entree.texte)).length);
      fioles.poison += (nuit.match(/a versé son poison/g) ?? []).length;
      fioles.remede += (nuit.match(/sauvé par un remède/g) ?? []).length;
      assert.ok(fioles.poison <= 1 && fioles.remede <= 1, `une fiole de chaque par partie : ${JSON.stringify(fioles)}`);
      // Une fiole vide est annoncée au joueur (socket) ou au compagnon (son carnet, gardé chez le MJ).
      const notesCompagnons = villageois().filter(a => a.system.compagnon).flatMap(a => api.carnet(a.id).slice(carnetsAvant.get(a.id) ?? 0).map(e => e.texte ?? ""));
      compterUsages(actions, usages, [...secretsEmis(nbDemandes).map(e => e.entree.texte), ...notesCompagnons].filter(t => /fiole de \S+ est vide/.test(t ?? "")).length);
      verifierVillageois(usages);
      if (/VICTOIRE/.test(nuit)) { fin = nuit; break; }
      const attente = /^En attente : (.+)\.$/m.exec(nuit);
      if (attente) {
        fin = await emporter(attente[1].split(" ; ").map(x => x.split(" doit désigner")[0]));
        if (fin) break;
      }
      // --- jour : les joueurs usent de leurs pouvoirs (Table de jeu -> socket, à l'aube), puis le narrateur (loups_jour)
      await calme();
      // --- débat : les compagnons vivants (et non réduits au silence) prennent la parole
      if (nbCompagnons) {
        const dits = await compagnons.debattre({ max: 3 });
        couvert("compagnons : répliques au débat", dits.length);
        for (const d of dits) assert.ok(game.actors.get(d.acteurId).system.vivant && !game.actors.get(d.acteurId).system.silence, "un mort ou un muet parle");
      }
      await pouvoirDuNarrateur();
      verifierSecrets("pouvoirs de jour");
      verifierVillageois(usages);
      // --- vote
      const avantVote = vivantsIds();
      const clos = await voterLeJour();
      const resultat = api.etat().vote.resultat;
      // Le compte des voix : votants vivants, bulletins des joueurs simulés pour CE vote, morts et fraudes refusés.
      const bulletins = new Map(joueurs.journal.bulletins.filter(b => b.numero === resultat.numero && b.cible).map(b => [b.votant, b.cible]));
      // Les compagnons votent par leur cerveau (résolveur), au même vote que les humains.
      for (const v of votesDesCompagnons.filter(v => v.numero === resultat.numero && v.cible)) bulletins.set(v.votant, v.cible);
      couvert("compagnons : voix", votesDesCompagnons.filter(v => v.numero === resultat.numero && v.cible).length);
      assert.deepEqual(resultat.votes, Object.fromEntries(bulletins), "voix enregistrées = bulletins des vivants");
      for (const votant of Object.keys(resultat.votes)) assert.ok(avantVote.has(votant), "un mort a voté");
      const attendu = {};
      for (const c of bulletins.values()) attendu[c] = (attendu[c] ?? 0) + 1;
      assert.deepEqual(resultat.decompte, attendu, "décompte");
      const max = Math.max(0, ...Object.values(attendu));
      for (const elu of resultat.elus) assert.ok(api.etat().vote.majoriteAbsolue || resultat.decompte[elu] === max, "l'élu a le plus de voix");
      for (const [id, nb] of Object.entries(resultat.decompte)) assert.ok(clos.includes(`${game.actors.get(id).name} : ${nb}`), `décompte annoncé : ${clos}`);
      if (!resultat.elus.length) {
        const raison = !Object.keys(resultat.decompte).length ? /Aucun vote :/ : resultat.egalite ? /Égalité :/
          : api.etat().vote.majoriteAbsolue ? /Pas de majorité absolue/ : /personne n'est désigné/;
        assert.match(clos, raison, "raison annoncée quand personne n'est désigné");
      }
      const designes = /Désignés? : (.+) \(loups_eliminer pour chacun\)/.exec(clos)?.[1].split(" et ") ?? [];
      assert.deepEqual(designes, resultat.elus.map(id => game.actors.get(id).name));
      for (const nom of designes) {
        fin = await eliminer(nom, "vote");
        if (fin) break;
      }
      if (fin) break;
      // --- le village choisit qui dormira à la Chapelle
      if (api.etat().batimentsCles.includes("chapelle")) {
        await appeler("loups_vote", { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "chapelle" });
        await calme();
        await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "chapelle" });
        const elu = api.etat().vote.resultat.elu;
        if (elu) {
          assert.ok(api.etat().jour.effets.some(x => x.type === "asile" && x.cible === elu && x.nuit === api.etat().tour + 1), "l'élu dort à la Chapelle");
          couvert("chapelle (vote)");
        }
      }
    }
    verifierVictoireFinale(fin);
    verifierVillageois(usages);
    verifierSecrets("fin");
    if (nbCompagnons) verifierSavoirDesCompagnons("fin");
    assert.deepEqual(erreurs(), [], "aucune erreur dans les messages de socket");
    // Ce que la partie a exercé.
    for (const h of journalHooks.filter(h => h.nom === "lakourLoups.jour")) couvert(h.args[0].pouvoir);
    const chat = messages.map(m => sansHTML(m.content)).join("\n");
    couvert("Moulin (public)", (chat.match(/Les ailes du Moulin ont compté/g) ?? []).length);
    couvert("Moulin (Meunière)", secretsEmis().filter(e => /La meule du Moulin vous souffle/.test(e.entree.texte)).length);
    couvert("Lavoir", (chat.match(/Au lavoir, on raconte/g) ?? []).length);
    couvert("Cimetière", (chat.match(/Les tombes parlent/g) ?? []).length);
    couvert("Forge (sang de bête)", (chat.match(/Du sang de bête sur le seuil/g) ?? []).length);
    couvert("Taverne (meute repoussée)", api.etat().journalSecret.filter(x => /pas osé tuer .* à la Taverne/.test(x.texte)).length);
    couvert("Chapelle (meute repoussée)", api.etat().journalSecret.filter(x => /pas pu entrer à la Chapelle/.test(x.texte)).length);
    const v = game.actors.get(api.etat().vainqueur);
    const camp = !v ? api.etat().vainqueur : v.system.amoureux && game.actors.get(v.system.amoureux)?.system.vivant ? "amoureux" : roleDe(v).system.cle;
    return { vainqueur: api.etat().vainqueur, tours: tour, camp };
  } catch (e) {
    throw new Error(`${niveau}, ${n} joueurs${nbCompagnons ? ` et ${nbCompagnons} compagnons` : ""}, graine « ${graine} » : ${e.message}\n--- derniers échanges :\n${textes.slice(-4).join("\n\n")}`, { cause: e });
  } finally {
    Math.random = hasardOrigine;
  }
}

// ------------------------------------------------------------------ les parties
const TAILLES = [6, 8, 10, 13, 15, 18];
const NIVEAUX = ["debutants", "classique", "chaos"];
const GRAINES = ["brume", "lanterne", "cendres", "moulin", "chapelle"];
const bilan = [];

for (const niveau of NIVEAUX) {
  test(`parties complètes, niveau ${niveau} : ${TAILLES.join(", ")} joueurs × ${GRAINES.length} graines, jusqu'à la victoire`, async () => {
    for (const n of TAILLES) for (const graine of GRAINES) bilan.push({ niveau, n, graine, ...await jouerPartie({ n, niveau, graine }) });
  });
}

// 3 humains simulés et des compagnons IA (repli sans IA), jusqu'à la victoire.
const COMPAGNONS = [3, 6, 11];
const bilanCompagnons = [];
test(`parties complètes avec 3 humains et des compagnons IA (${COMPAGNONS.join(", ")}) × ${NIVEAUX.length} niveaux × ${GRAINES.length} graines`, async () => {
  for (const niveau of NIVEAUX) for (const nbCompagnons of COMPAGNONS) for (const graine of GRAINES) {
    bilanCompagnons.push({ niveau, nbCompagnons, graine, ...await jouerPartie({ n: 3, niveau, graine: `${graine}-c${nbCompagnons}`, nbCompagnons }) });
  }
  const parCamp = {};
  for (const b of bilanCompagnons) parCamp[b.camp] = (parCamp[b.camp] ?? 0) + 1;
  console.log(`Avec compagnons : ${bilanCompagnons.length} parties ; vainqueurs ${JSON.stringify(parCamp)}`);
  for (const effet of ["compagnons : choix de nuit", "compagnons : répliques au débat", "compagnons : voix"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé : ${effet}`);
  }
  // Reproductible : même graine, même partie, compagnons compris.
  const encore = await jouerPartie({ n: 3, niveau: "classique", graine: "brume-c6", nbCompagnons: 6 });
  const premiere = bilanCompagnons.find(b => b.niveau === "classique" && b.nbCompagnons === 6 && b.graine === "brume");
  assert.deepEqual({ vainqueur: encore.camp, tours: encore.tours }, { vainqueur: premiere.camp, tours: premiere.tours });
});

test("bilan des parties (reproductibles : même graine, même partie) ; chaque pouvoir de jour et chaque bâtiment a servi", async () => {
  assert.equal(bilan.length, TAILLES.length * NIVEAUX.length * GRAINES.length);
  const parCamp = {};
  for (const b of bilan) parCamp[b.camp] = (parCamp[b.camp] ?? 0) + 1;
  const moyenne = (bilan.reduce((s, b) => s + b.tours, 0) / bilan.length).toFixed(1);
  if (process.env.TRACE_LOUPS) for (const b of bilan) console.log(JSON.stringify(b));
  console.log(`Bilan : ${bilan.length} parties ; vainqueurs ${JSON.stringify(parCamp)} ; ${moyenne} tours en moyenne`);
  for (const niveau of NIVEAUX) {
    const l = bilan.filter(b => b.niveau === niveau);
    const c = {};
    for (const b of l) c[b.camp] = (c[b.camp] ?? 0) + 1;
    console.log(`  ${niveau} : ${JSON.stringify(c)} ; ${(l.reduce((s, b) => s + b.tours, 0) / l.length).toFixed(1)} tours`);
  }
  console.log(`  couverture : ${JSON.stringify(Object.fromEntries([...couverture].sort()))}`);
  // Les parties simulées exercent vraiment les métiers de jour, les rôles de jour et les bâtiments.
  for (const pouvoir of Object.keys(POUVOIRS_JOUR)) assert.ok(couverture.get(pouvoir) > 0, `pouvoir de jour jamais utilisé : ${pouvoir}`);
  for (const effet of ["mot du Messager remis", "ruban (prolongation)", "juge (revote)", "chapelle (vote)", "hors d'atteinte (nuit)", "Moulin (public)",
    "Moulin (Meunière)", "Lavoir", "Cimetière", "Forge (sang de bête)", "Pont (meute bloquée)", "verrou (attaque arrêtée)"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé dans les parties simulées : ${effet}`);
  }
  const encore = await jouerPartie({ n: 10, niveau: "chaos", graine: "brume" });
  const premiere = bilan.find(b => b.niveau === "chaos" && b.n === 10 && b.graine === "brume");
  assert.deepEqual({ vainqueur: encore.camp, tours: encore.tours }, { vainqueur: premiere.camp, tours: premiere.tours });
});

// ------------------------------------------------------------------ bogues trouvés par l'intégration (essais ciblés)
const acteurDuRole = cle => villageois().find(a => roleDe(a)?.system.cle === cle);
async function preparer(n, composition, graine = "cible") {
  monde(n, graine);
  const r = await outil("loups_distribuer").executer({ joueurs: [], composition, niveau: "" });
  assert.ok(!r.erreur, r.contenu);
  return r.contenu;
}
const demandesDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id);

test("loups_distribuer, 18 joueurs : un métier pour chacun (12 métiers), rôles et bâtiments nommés, pas de clés", async () => {
  const texte = await preparer(18, "classique-18");
  for (const a of villageois()) assert.equal(a.items.filter(i => i.type === "metier").length, 1, `${a.name} sans métier`);
  verifierTexte(texte, "loups_distribuer");
  assert.match(texte, /: Loup de Brumecombe/);
  assert.match(texte, /Bâtiments en jeu : La Chapelle, Le Moulin, La Taverne, Le Puits, Le Cimetière, Le Gibet\./);
  assert.deepEqual(api.etat().batimentsCles, ["chapelle", "moulin", "taverne", "puits", "cimetiere", "gibet"]);
});

test("loups_nuit : la meute chasse avec l'invite des loups, même si la Louve mère est la première de la meute ; la Louve ne mord que la proie", async () => {
  await preparer(9, "chaos-09");
  const premier = api.ordreDeNuit().find(e => e.roleCle === "meute").acteurIds[0];
  const louve = acteurDuRole("louve-mere");
  if (louve.id !== premier) await api.echangerRoles(premier, louve.id);   // entre deux loups : les camps ne bougent pas
  assert.equal(roleDe(game.actors.get(premier)).system.cle, "louve-mere");
  const loups = villageois().filter(a => a.system.camp === "meute");
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const meute = api.etat().nuitPrecedente.actions.find(x => x.roleCle === "meute");
  for (const l of loups) {
    const [chasse] = demandesDe(l, depuis);
    assert.equal(chasse.invite, ROLES["loup-de-brumecombe"].system.nuit.invite, `${l.name} (${roleDe(l).system.cle})`);
  }
  const [, morsure] = demandesDe(game.actors.get(premier), depuis);
  assert.equal(morsure.invite, ROLES["louve-mere"].system.nuit.invite);
  assert.deepEqual(morsure.candidats.map(c => c.id), meute.cibles);
});

test("loups_nuit : l'Herboriste apprend qui la meute a attaqué", async () => {
  await preparer(7, "debutants-07");
  const herboriste = acteurDuRole("herboriste");
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const proie = api.etat().nuitPrecedente.actions.find(x => x.roleCle === "meute").cibles[0];
  const [d] = demandesDe(herboriste, depuis);
  assert.ok(d.invite.startsWith(`Cette nuit, la meute a attaqué ${game.actors.get(proie).name}. `), d.invite);
  assert.ok(d.invite.endsWith(ROLES.herboriste.system.nuit.invite));
});

test("loups_nuit : le Fossoyeur interroge les tombes (les morts), pas les vivants ; il l'apprend dans son carnet secret", async () => {
  await preparer(15, "debutants-15");
  const fossoyeur = acteurDuRole("fossoyeur");
  const mort = villageois().find(a => a.id !== fossoyeur.id && a.system.camp !== "meute");
  await api.eliminer(mort.id, { cause: "narrateur", reveler: false });
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const [d] = demandesDe(fossoyeur, depuis);
  assert.deepEqual(d.candidats.map(c => c.id), [mort.id]);
  const appris = secretsEmis(depuis).find(e => e.recipients[0] === fossoyeur.system.joueur && /était :/.test(e.entree.texte));
  assert.ok(appris?.entree.texte.includes(`${mort.name} était : ${roleDe(mort).name}`), "il apprend le rôle du mort");
  assert.ok(!messages.some(m => m.whisper?.length), "rien au chat");
});

test("loups_nuit : le Messager fait écrire l'expéditeur, le destinataire seul reçoit le mot ; rien ne fuit", async () => {
  await preparer(10, "chaos-10");
  // Un Messager à coup sûr : celui de la composition, sinon le premier villageois sans pouvoir de nuit le devient.
  let messager = acteurDuRole("messager");
  if (!messager) {
    messager = villageois().find(a => a.system.camp === "village" && !roleDe(a).system.nuit.actif);
    await messager.deleteEmbeddedDocuments("Item", [roleDe(messager).id]);
    await messager.createEmbeddedDocuments("Item", [{ ...structuredClone(ROLES.messager), _id: undefined }]);
  }
  let depuis = 0;
  for (let nuit = 0; nuit < 4; nuit++) {
    depuis = emissions.length;
    await outil("loups_nuit").executer({ delai_secondes: 20 });
    if (api.etat().vainqueur) break;
    const porte = api.etat().nuitPrecedente.actions.find(x => x.acteurId === messager.id && x.texte);
    if (!porte || !messager.system.vivant) continue;
    const [exp, dest] = porte.cibles;
    const demande = emissions.slice(depuis).find(e => e.type === "demande" && e.mode === "texte");
    assert.deepEqual(demande.recipients, [game.actors.get(exp).system.joueur], "seul l'expéditeur écrit");
    const mot = secretsEmis(depuis).find(e => e.entree.texte.includes(porte.texte));
    assert.deepEqual(mot.recipients, [game.actors.get(dest).system.joueur], "seul le destinataire lit");
    assert.ok(!JSON.stringify(reglages.get("lakour-loups.partie").valeur).includes(porte.texte), "le mot n'est pas dans l'état public");
    assert.ok(!emissions.filter(e => e.type === "hook").some(e => JSON.stringify(e.args).includes(porte.texte)), "ni dans ce qui est diffusé");
    verifierSecrets("messager");
    await calme();   // les joueurs simulés finissent de réagir à l'aube avant l'essai suivant (identifiants réutilisés)
    return;
  }
  assert.fail("le Messager n'a porté aucun mot en quatre nuits");
});

test("loups_vote sous le Gibet : sans majorité absolue, le texte le dit (ni « égalité » ni « aucun vote »)", async () => {
  await calme();   // rien de l'essai précédent ne doit arriver dans ce monde-ci
  monde(12, "gibet", { simules: false });
  await outil("loups_distribuer").executer({ joueurs: [], composition: "classique-12", niveau: "" });
  await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false });
  assert.equal(api.etat().vote.majoriteAbsolue, true);
  const [a, b, ...autres] = villageois();
  for (const x of autres.slice(0, 4)) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: a.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  for (const x of autres.slice(4, 6)) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: b.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  assert.deepEqual(reglages.get("lakour-loups.partie").valeur.vote.votes, {}, "les voix restent secrètes jusqu'à la clôture");
  assert.equal(reglages.get("lakour-loups.partie").valeur.vote.exprimes.length, 6, "on sait seulement qui a voté");
  const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false });
  assert.match(clos.contenu, new RegExp(`${a.name} : 4, ${b.name} : 2\\. Pas de majorité absolue \\(le Gibet l'exige\\) : personne n'est désigné\\.`));
});

test("loups_eliminer : la Braconnière condamnée par le vote — le narrateur est prévenu qu'elle peut emporter quelqu'un", async () => {
  await preparer(10, "debutants-10");
  const braconniere = acteurDuRole("braconniere");
  const r = await outil("loups_eliminer").executer({ villageois: braconniere.name, cause: "vote", reveler: true });
  assert.match(r.contenu, new RegExp(`${braconniere.name} peut emporter quelqu'un dans la tombe : demande-lui qui, puis loups_eliminer \\(cause emporte\\)\\.`));
  const emporte = villageois().find(a => a.system.vivant);
  const r2 = await outil("loups_eliminer").executer({ villageois: emporte.name, cause: "emporte", reveler: true });
  assert.doesNotMatch(r2.contenu, /peut emporter/);
});

test("loups_effet : protéger, faire taire, changer de camp, échanger les rôles (cartes remises aux deux seuls joueurs)", async () => {
  await preparer(8, "classique-08");
  const [a, b] = villageois();
  const ra = roleDe(a).name, rb = roleDe(b).name;
  const effet = async (nom, cibles, camp = "") => {
    const r = await outil("loups_effet").executer({ effet: nom, cibles, camp });
    assert.ok(!r.erreur, r.contenu);
    verifierTexte(r.contenu, "loups_effet");
    return r.contenu;
  };
  assert.match(await effet("proteger", [a.name]), new RegExp(`« proteger » appliqué à ${a.name}`));
  assert.equal(a.system.protections, 1);
  await effet("silence", [b.name]);
  assert.equal(b.system.silence, true);
  await effet("changer_camp", [a.name], "solitaire");
  assert.equal(a.system.camp, "solitaire");
  const depuis = emissions.length;
  assert.match(await effet("echanger_roles", [a.name, b.name]), new RegExp(`appliqué à ${a.name} et ${b.name}`));
  assert.deepEqual([roleDe(a).name, roleDe(b).name], [rb, ra]);
  const cartes = secretsEmis(depuis).filter(e => e.entree.html?.startsWith("<carte"));
  assert.deepEqual(cartes.map(e => e.recipients), [[a.system.joueur], [b.system.joueur]]);
  assert.ok((await outil("loups_effet").executer({ effet: "proteger", cibles: ["Personne"], camp: "" })).erreur);
});

test("loups_jour : lister puis utiliser un métier ; refus clair hors du moment ; le Juge de paix fait revoter et loups_eliminer attend", async () => {
  monde(8, "jour", { simules: false });
  await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: ["Loup de Brumecombe", "Loup de Brumecombe", "Juge de paix", "Liseuse de cendres"], batiments: ["chapelle", "taverne", "forge"], inclure: [], exclure: [], composition: "" });
  const forgeron = villageois().find(a => metierDe(a).system.cle === "forgeron");
  const juge = acteurDuRole("juge-de-paix");
  assert.match((await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "Forgeron", cibles: [forgeron.name], texte: "" })).contenu,
    /refusé — Ce n'est pas le moment/);
  await api.changerPhase("jour");
  const liste = await outil("loups_jour").executer({ action: "lister", villageois: "", pouvoir: "", cibles: [], texte: "" });
  verifierTexte(liste.contenu, "loups_jour");
  assert.match(liste.contenu, new RegExp(`${forgeron.name} : Forgeron — désigne 1`));
  assert.match(liste.contenu, /Le village : La Chapelle/);
  const r = await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "forgeron", cibles: [juge.name], texte: "" });
  assert.ok(!r.erreur, r.contenu);
  assert.match(r.contenu, new RegExp(`forge un verrou pour la maison de ${juge.name}`));
  assert.equal(metierDe(forgeron).system.usages.restant, 0);
  assert.ok((await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "Forgeron", cibles: [juge.name], texte: "" })).erreur, "une fois par partie");
  // Le vote : le Juge de paix annule juste après le dépouillement.
  await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false });
  const cible = villageois().find(a => a.id !== juge.id);
  for (const x of villageois()) await envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: cible.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false });
  assert.match(clos.contenu, /Juge de paix/, "le narrateur est prévenu");
  const annule = await outil("loups_jour").executer({ action: "utiliser", villageois: juge.name, pouvoir: "Juge de paix", cibles: [], texte: "" });
  assert.ok(!annule.erreur, annule.contenu);
  assert.equal(api.etat().vote.ouvert, true, "le village revote");
  assert.equal(juge.system.revele, true);
  assert.ok((await outil("loups_eliminer").executer({ villageois: cible.name, cause: "vote", reveler: true })).erreur, "pas d'exécution pendant le revote");
  assert.equal(cible.system.vivant, true);
  verifierSecrets("loups_jour");
});

// ------------------------------------------------------------------ composition choisie par l'IA ou par les joueurs
test("loups_composer : proposition équilibrée pour les joueurs connectés, annoncée par camps et noms, avec les clés à reprendre", async () => {
  monde(11, "compo");
  const r = await outil("loups_composer").executer({ nombre_joueurs: 0, niveau: "classique", inclure: ["Sonneur"], exclure: ["liseuse-de-cendres"] });
  assert.ok(!r.erreur, r.contenu);
  verifierTexte(r.contenu.split("\nClés")[0], "loups_composer");
  assert.match(r.contenu, /pour 11 joueurs \(classique, (équilibrée|favorable)/);
  assert.match(r.contenu, /Meute : .*Village : .*Sonneur/);
  assert.doesNotMatch(r.contenu.split("\nClés")[0], /Liseuse de cendres/);
  const cles = JSON.parse(/roles = (\[[^\]]*\])/.exec(r.contenu)[1]);
  assert.equal(cles.length, 11);
  assert.equal(villageois().length, 0, "rien n'est distribué");
  assert.match((await outil("loups_composer").executer({ nombre_joueurs: 8, niveau: "classique", inclure: ["Sorcière"], exclure: [] })).contenu, /Rôles inconnus : Sorcière/);
});

test("loups_distribuer mode roles : la liste choisie (noms ou clés), complétée de villageois ; trop de rôles refusés", async () => {
  monde(8, "choisie");
  const r = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: ["Loup de Brumecombe", "loup-de-brumecombe", "Liseuse de cendres", "Herboriste", "sonneur"], batiments: [], inclure: [], exclure: [], composition: "" });
  assert.ok(!r.erreur, r.contenu);
  const cles = villageois().map(a => roleDe(a).system.cle).sort();
  assert.deepEqual(cles, ["herboriste", "liseuse-de-cendres", "loup-de-brumecombe", "loup-de-brumecombe", "sonneur", "villageois", "villageois", "villageois"]);
  assert.equal(api.etat().composition, "choisie");
  assert.ok(api.etat().batiments.length >= 4, "bâtiments tirés selon le niveau");
  monde(6, "trop");
  const trop = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: Array(7).fill("villageois"), batiments: [], inclure: [], exclure: [], composition: "" });
  assert.match(trop.contenu, /7 rôles pour 6 joueurs/);
});

test("loups_distribuer auto : rôles imposés et exclus respectés ; l'historique fait varier la partie suivante", async () => {
  monde(12, "auto");
  await outil("loups_distribuer").executer({ joueurs: [], mode: "auto", niveau: "classique", roles: [], batiments: [], inclure: ["Conteuse"], exclure: ["Garde du pont"], composition: "" });
  const premiere = villageois().map(a => roleDe(a).system.cle);
  assert.ok(premiere.includes("conteuse") && !premiere.includes("garde-du-pont"));
  assert.equal(game.settings.get("lakour-mj-ia", "historiqueLoups").length, 1, "la partie est mémorisée");
  const memoire = game.settings.get("lakour-mj-ia", "historiqueLoups")[0];
  assert.deepEqual([...memoire.roles].sort(), [...premiere].sort());
});
