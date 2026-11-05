// Le coffre des secrets des Veillées (0.9.0) : celui du MJ IA (modules/lakour-mj-ia/scripts/coffre.js), par son API.
// - Les secrets (rôles et camps compris) sont scellés avec la clé en vigueur du moteur dans le réglage monde « coffre » ; le clair
//   n'est nulle part dans le monde.
// - Le coffre ne bat PAS au rythme de la nuit : aucun choix de nuit n'écrit ni le coffre ni l'état public ; il est scellé aux
//   moments publics (phase, aube, distribution) et au battement, à intervalle fixe, même sans changement.
// - Aucune part n'est confiée aux joueurs (rôles secrets : deux loups alliés réuniraient leurs parts). Un autre navigateur du MJ
//   rouvre le coffre avec la clé de secours ; les joueurs n'ont rien à rendre ; tant qu'il attend, le coffre n'est jamais écrasé.
// - Un renouvellement de la clé du moteur rescelle le coffre avant que la nouvelle clé n'entre en vigueur (par sa clé de secours,
//   jamais par des accusés de joueurs).
// - Une partie d'avant 0.9.0 : l'ancien coffre s'ouvre avec l'ancienne clé de ce navigateur, puis il est rescellé avec le moteur.
// - Sans le moteur, aucune partie ne se distribue.
// - Relecture 8 : une nouvelle partie pendant l'attente des parts s'écrit, et l'ancien coffre ne la remplace jamais ; à révision
//   égale, un autre contenu n'est pas « à jour » ; un coffre changé pendant le scellement n'est pas écrasé ; un MJ qui perd la main au
//   milieu d'un geste n'écrit rien ; des secrets sans leurs fiches ne passent jamais pour à jour ; l'ancienne clé est effacée.
// Chaque vérification est rejouée sur des copies mutées du système.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, reglages, calme, CoffreMoteur, Collection, apiCoffreMoteur } from "./doublures/foundry-loups.mjs";

// Deux MJ (« mj », ce navigateur, et « mj2 ») ; le MJ actif devient réglable.
function deuxMJ() {
  const users = new Collection([...game.users.entries()]);
  users.set("mj2", { id: "mj2", name: "Autre MJ", isGM: true, active: true });
  let actif = "mj";
  Object.defineProperty(users, "activeGM", { get: () => users.get(actif) ?? null, configurable: true });
  users.choisirActif = id => { actif = id; };
  game.users = users;
  game.user = users.get("mj");
}

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, reglagesM, socket, secrets, coffre, donnees, logique] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"),
    m("scripts/socket.mjs"), m("scripts/secrets.mjs"), m("scripts/coffre.mjs"), m("scripts/donnees.mjs"), m("logique/coffre.mjs")]);
  return { api: api.api, reglages: reglagesM, socket, secrets, coffre, donnees, C: logique };
}

const valeur = cle => structuredClone(reglages.get(`${ID}.${cle}`).valeur);
const trousseau = () => structuredClone(reglages.get("lakour-mj-ia.trousseau").valeur);
const attendre = (ms = 5) => new Promise(r => setTimeout(r, ms));
// Attendre qu'une chose arrive (déchiffrement WebCrypto, minuterie du système : durées variables sous charge) plutôt qu'un délai
// fixe. La garde ne sert qu'à ne pas pendre : la condition jamais remplie, l'assertion qui suit échoue avec son propre message.
async function jusqua(condition, garde = 2000) {
  const fin = Date.now() + garde;
  while (!condition() && Date.now() < fin) await attendre(2);
}
// Les parts que le moteur a données à chaque joueur (la dernière, par id de clé).
const partsDonnees = id => Object.fromEntries(emissions.filter(e => e.type === "coffre.part" && e.id === id).map(e => [e.recipients[0], { id: e.id, x: e.x, y: e.y, seuil: e.seuil }]));

async function distribuer(M, graine = "coffre") {
  const role = cle => creerObjetMonde(cle, "role", { cle, ...(cle === "loup" ? { camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } } : {}) });
  const metier = creerObjetMonde("Forgeron", "metier", { cle: "forgeron" });
  await M.api.distribuer({ roles: [role("loup"), role("villageois"), role("villageois"), role("villageois")], metiers: [metier, metier, metier, metier],
    joueurs: ["u1", "u2", "u3", "u4"], graine, composition: "compo-tres-secrete", batiments: [] });
  await M.api.changerPhase("jour");
  await M.coffre.rangement();
  await calme();
  return M.api.etat().partie;
}

async function partie(M, options = {}) {
  installerFoundry({ joueurs: 4, ...options });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  Hooks.on("lakour-mj-ia.coffreRouvert", () => M.coffre.surCoffreRouvert());
  return distribuer(M);
}

// Le MJ ouvre la partie dans un autre navigateur : ni secrets, ni clé du moteur dans ce navigateur-là.
function autreNavigateur(M) {
  M.secrets.oublierSecrets();
  M.coffre.oublierCoffre();
  CoffreMoteur.oublierCoffre();
  reglages.get(`${ID}.secrets`).valeur = {};
  reglages.get("lakour-mj-ia.cleCarnet").valeur = {};
}

// L'ancien coffre (avant 0.9.0) : AES-GCM avec la clé { partie, k } (k hexadécimal, 256 bits).
async function ancienCoffre(secret, partie) {
  const octets = crypto.getRandomValues(new Uint8Array(32));
  const k = Array.from(octets, o => o.toString(16).padStart(2, "0")).join("").replace(/^0+/, "") || "1";
  const brut = new Uint8Array(32);
  let n = BigInt(`0x${k}`);
  for (let i = 31; i >= 0; i--) { brut[i] = Number(n & 0xffn); n >>= 8n; }
  const cle = await crypto.subtle.importKey("raw", brut, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, new TextEncoder().encode(JSON.stringify(secret)));
  const b64 = o => btoa(String.fromCharCode(...new Uint8Array(o)));
  return { coffre: { partie, iv: b64(iv), donnees: b64(chiffre) }, cle: { partie, k } };
}

const VERIFICATIONS = {
  async "scellé avec la clé du moteur : rien en clair dans le monde, l'id du trousseau"(M) {
    const id = await partie(M);
    const coffre = valeur("coffre");
    assert.equal(coffre.partie, id);
    assert.equal(coffre.chiffre, 1, "un objet scellé du moteur");
    assert.equal(coffre.id, trousseau().id, "la clé en vigueur");
    const monde = JSON.stringify([...reglages.entries()].filter(([, r]) => r.conf.scope === "world").map(([k, r]) => [k, r.valeur]));
    assert.ok(!monde.includes("compo-tres-secrete"), "la composition n'est en clair dans aucun réglage monde");
    assert.ok(!JSON.stringify(game.actors.contents.map(a => [a.system, a.items.contents.map(i => i.system)])).includes("\"meute\""), "aucun camp dans les documents");
    // Aucune part aux joueurs, aucun porteur.
    assert.deepEqual(partsDonnees(coffre.id), {});
    assert.deepEqual(emissions.filter(x => x.type === "coffre.part"), [], "aucune part émise");
    assert.deepEqual(trousseau().porteurs ?? [], []);
  },

  async "la nuit, aucun choix n'écrit ni le coffre ni l'état public ; l'aube et le battement scellent"(M) {
    await partie(M);
    await M.api.changerPhase("nuit");
    await M.coffre.rangement();
    const ecrits = [];
    const set = game.settings.set;
    game.settings.set = async (m, c, v) => { ecrits.push(`${m}.${c}`); return set.call(game.settings, m, c, v); };
    try {
      const [a, b, c] = game.actors.contents;
      await M.api.noterAction({ acteurId: a.id, roleCle: "x", cibles: [b.id] });
      await M.api.proteger(c.id);
      await M.api.noterAction({ acteurId: b.id, roleCle: "y", cibles: [c.id] });
      await M.coffre.rangement();
      assert.deepEqual(ecrits.filter(e => !e.endsWith(".secrets")), [], "ni coffre ni état public pendant la nuit");
      await M.api.changerPhase("aube");
      await M.coffre.rangement();
      assert.ok(ecrits.includes(`${ID}.coffre`), "scellé au changement de phase");
      // Le battement : à intervalle fixe, même sans rien de neuf.
      ecrits.length = 0;
      M.coffre.battre(15);
      await jusqua(() => ecrits.filter(e => e === `${ID}.coffre`).length >= 2);
      await M.coffre.rangement();
      assert.ok(ecrits.filter(e => e === `${ID}.coffre`).length >= 2, "le battement scelle à intervalle fixe");
    } finally {
      game.settings.set = set;
      M.coffre.oublierCoffre();
    }
  },

  async "autre navigateur : rien à attendre des joueurs ; la clé de secours rouvre le coffre"(M) {
    const id = await partie(M);
    const avant = structuredClone(M.secrets.secretsMJ());
    const { texte } = await CoffreMoteur.exporterSecours();
    autreNavigateur(M);
    assert.ok(M.secrets.secretsPerdus(M.donnees.lirePublic()));
    emissions.length = 0;
    let rappels = 0;
    assert.equal(await M.coffre.chercherSecrets(id, () => { rappels++; }), true);
    await calme();
    // Un joueur qui « rend » une part forgée ne rouvre rien.
    await CoffreMoteur.recevoirPartRendue({ id: "faux", x: "1", y: "2" }, "u1");
    await attendre();
    assert.equal(rappels, 0, "une part forgée ne rouvre rien");
    assert.equal(M.coffre.enAttenteDeParts(), true);
    assert.equal(await CoffreMoteur.importerSecours(texte), 1);
    await jusqua(() => rappels >= 1);
    await M.coffre.rangement();
    assert.equal(rappels, 1, "la clé de secours rouvre");
    assert.deepEqual(M.secrets.secretsMJ().fiches, avant.fiches, "les rôles reviennent");
    assert.equal(M.secrets.secretsMJ().composition, "compo-tres-secrete");
    assert.equal(M.secrets.secretsPerdus(M.donnees.lirePublic()), false);
    assert.equal(M.coffre.enAttenteDeParts(), false);
  },

  async "en attente des parts : le coffre n'est jamais écrasé"(M) {
    const id = await partie(M);
    const coffre = valeur("coffre");
    const cleMoteur = structuredClone(reglages.get("lakour-mj-ia.cleCarnet").valeur);
    // Le stockage de ce navigateur s'est vidé (secrets, clé du moteur) : il cherche les parts…
    M.secrets.oublierSecrets();
    reglages.get(`${ID}.secrets`).valeur = {};
    CoffreMoteur.oublierCoffre();
    reglages.get("lakour-mj-ia.cleCarnet").valeur = {};
    await M.coffre.chercherSecrets(id);
    assert.equal(M.coffre.enAttenteDeParts(), true);
    // …la clé du moteur revient (un autre MJ la donne) avant que le coffre ne soit rouvert ; des secrets incomplets ici.
    reglages.get("lakour-mj-ia.cleCarnet").valeur = cleMoteur;
    await M.secrets.garderSecrets({ partie: id, composition: "" });
    await M.coffre.sceller();
    // Un moment public : refusé (relecture 7 : rien de la partie ne s'écrit sans les secrets à jour).
    await assert.rejects(() => M.api.changerPhase("nuit"), /secrets à jour/);
    assert.equal(await M.api.verifierVictoire(), "", "aucune victoire déclarée sur du vide");
    await M.coffre.rangement();
    assert.deepEqual(valeur("coffre"), coffre, "des secrets incomplets n'écrasent pas le coffre");
    assert.equal(M.donnees.lirePublic().phase, "jour", "l'état public n'a pas bougé");
  },

  async "un autre navigateur qui a la clé du moteur mais pas encore rouvert le coffre ne l'écrase pas"(M) {
    const id = await partie(M);
    const coffre = valeur("coffre");
    // La clé du moteur est là (passée par un autre MJ, clé de secours) ; les secrets de la partie, pas encore.
    M.secrets.oublierSecrets();
    M.coffre.oublierCoffre();
    reglages.get(`${ID}.secrets`).valeur = {};
    await M.secrets.garderSecrets({ partie: id, composition: "" });
    await M.coffre.sceller();
    await M.coffre.rangement();
    assert.deepEqual(valeur("coffre"), coffre, "le coffre d'une partie que ce navigateur n'a pas ouverte reste intact");
    // Rouvert ici, il peut ensuite le sceller.
    assert.equal(await M.coffre.chercherSecrets(id), true);
    await M.coffre.rangement();
    assert.equal(M.secrets.secretsMJ().composition, "compo-tres-secrete");
  },

  async "renouvellement de la clé du moteur : le coffre est rescellé avant qu'elle n'entre en vigueur"(M) {
    const id = await partie(M);
    const ancienne = valeur("coffre").id;
    await CoffreMoteur.renouveler({ force: true });
    const enCours = trousseau().enCours.id;
    assert.notEqual(enCours, ancienne);
    assert.equal(valeur("coffre").id, ancienne, "l'ancienne clé reste en vigueur tant que les parts ne sont pas accusées");
    // Le coffre tel qu'il est au moment où la nouvelle clé entre en vigueur (trousseau publié) : déjà rescellé avec elle.
    let auPassage = null;
    const set = game.settings.set;
    game.settings.set = async (m, k, v) => {
      if (m === "lakour-mj-ia" && k === "trousseau" && v?.id === enCours && !auPassage) auPassage = valeur("coffre");
      return set.call(game.settings, m, k, v);
    };
    try {
      // Des accusés de joueurs ne la font jamais entrer en vigueur ; sa clé de secours, si.
      for (const u of ["u1", "u2", "u3"]) await CoffreMoteur.recevoirAccuse({ id: enCours }, u);
      assert.equal(trousseau().id, ancienne, "des accusés ne suffisent pas");
      await CoffreMoteur.exporterSecours();
      await jusqua(() => trousseau().id === enCours);
    } finally { game.settings.set = set; }
    assert.equal(trousseau().id, enCours, "la nouvelle clé en vigueur");
    assert.equal(auPassage?.id, enCours, "le coffre rescellé avec elle AVANT qu'elle n'entre en vigueur");
    await jusqua(() => valeur("coffre").id === enCours);
    assert.equal(valeur("coffre").id, enCours);
    assert.equal(valeur("coffre").partie, id);
  },

  async "partie d'avant 0.9.0 : l'ancien coffre s'ouvre avec l'ancienne clé de ce navigateur, puis passe au moteur"(M) {
    const id = await partie(M);
    const secrets = structuredClone(M.secrets.secretsMJ());
    const { coffre, cle } = await ancienCoffre({ ...secrets, fiches: undefined }, id);
    // Le même navigateur du MJ, après la mise à jour : ni secrets rangés à la nouvelle façon, ni coffre neuf ; la clé du moteur, oui.
    M.secrets.oublierSecrets();
    M.coffre.oublierCoffre();
    reglages.get(`${ID}.secrets`).valeur = {};
    reglages.get(`${ID}.coffre`).valeur = coffre;
    reglages.get(`${ID}.cleCoffre`).valeur = cle;
    assert.equal(await M.coffre.chercherSecrets(id), true);
    await M.coffre.rangement();
    assert.equal(M.secrets.secretsMJ().composition, "compo-tres-secrete");
    assert.equal(valeur("coffre").chiffre, 1, "rescellé avec le moteur");
    assert.deepEqual(valeur("cleCoffre"), {}, "l'ancienne clé effacée");
    // Une ancienne clé d'une autre partie n'ouvre rien.
    autreNavigateur(M);
    reglages.get(`${ID}.coffre`).valeur = coffre;
    reglages.get(`${ID}.cleCoffre`).valeur = { ...cle, partie: "autre" };
    assert.equal(await M.coffre.chercherSecrets(id), false);
    assert.equal(await M.C.ouvrirAncien({ ...coffre, partie: "autre" }, { ...cle, partie: "autre" }), null, "un coffre d'une autre partie");
  },

  async "chez un joueur : l'ancienne part est effacée"(M) {
    await partie(M);
    game.user = game.users.get("u1");
    try {
      reglages.get(`${ID}.partCoffre`).valeur = { partie: "p1", x: "ab", y: "cd" };
      assert.equal(await M.coffre.oublierAnciennePart(), true);
      assert.deepEqual(valeur("partCoffre"), {});
    } finally { game.user = game.users.get("mj"); }
  },

  async "sans le moteur, aucune partie ne se distribue"(M) {
    installerFoundry({ joueurs: 4, moteur: false });
    M.reglages.enregistrerReglages(() => {});
    game.lakourLoups = M.api;
    const r = creerObjetMonde("villageois", "role", { cle: "villageois" });
    await assert.rejects(() => M.api.distribuer({ roles: [r, r], joueurs: ["u1", "u2"], graine: "x" }), /MJ IA/);
    assert.equal(game.actors.size, 0, "rien n'est créé");
  },

  async "F5 du MJ actif : ses secrets reviennent de son navigateur, avec leur révision ; il rescelle comme avant"(M) {
    const id = await partie(M);
    const { iv, rev } = valeur("coffre");
    assert.ok(rev >= 1, "l'enveloppe porte sa révision");
    M.secrets.oublierSecrets();
    M.coffre.oublierCoffre();
    assert.equal(M.coffre.secretsAJour(id), true);
    await M.api.changerPhase("nuit");
    await M.coffre.rangement();
    assert.notEqual(valeur("coffre").iv, iv, "rescellé");
    assert.equal(valeur("coffre").rev, rev + 1);
  },

  async "MJ actif sans les secrets (un autre MJ prend la main) : rien ne s'écrit, aucune victoire, le coffre est cherché"(M) {
    const id = await partie(M);
    deuxMJ();
    game.users.choisirActif("mj2");
    game.user = game.users.get("mj2");
    M.secrets.oublierSecrets();
    M.coffre.oublierCoffre();
    const avant = valeur("partie");
    assert.equal(M.coffre.ecritureBloquee(), true);
    await assert.rejects(() => M.api.changerPhase("vote"), /secrets à jour/);
    assert.equal(await M.api.verifierVictoire(), "", "jamais de victoire déclarée sur du vide");
    const loupJoueur = game.actors.find(a => a.system.joueur === "u1");
    assert.equal(await M.socket.traiterMessage({ type: "vote", votant: loupJoueur.id, cible: "", userId: "u1" }, "u1"), false);
    assert.deepEqual(valeur("partie"), avant, "l'état public n'a pas bougé");
    assert.equal(M.secrets.secretsPerdus(M.donnees.lirePublic()), true, "l'alerte reste");
    assert.equal(M.coffre.enAttenteDeParts(), true, "le coffre est cherché (parts, ou clé d'un autre MJ)");
    assert.equal(valeur("coffre").partie, id);
  },

  async "MJ redevenu actif avec des secrets périmés : il n'écrase pas le coffre récent, il le rouvre"(M) {
    const id = await partie(M);
    const c0 = valeur("coffre");
    // Un autre MJ a mené entre-temps (même clé du moteur) : un coffre plus récent.
    const recent = await apiCoffreMoteur().ouvrirScelle((({ partie: _p, rev: _r, ...s }) => s)(c0));
    recent.composition = "compo-RECENTE";
    const scelle = await apiCoffreMoteur().sceller(recent);
    reglages.get(`${ID}.coffre`).valeur = { partie: id, rev: c0.rev + 3, ...scelle };   // (sans onChange : ce navigateur n'a rien vu)
    assert.equal(M.coffre.secretsAJour(id), false, "ses secrets sont plus vieux que le coffre");
    assert.equal(M.api.etat().composition, "", "il ne joue pas sur des secrets périmés");
    assert.equal(M.api.roleDe(game.actors.contents[0].id), null, "ni sur leurs rôles");
    M.coffre.sceller();
    await M.coffre.rangement();
    assert.equal(valeur("coffre").iv, scelle.iv, "le coffre récent n'est pas écrasé");
    assert.equal(M.secrets.secretsMJ().composition, "compo-RECENTE", "il l'a rouvert");
    await M.api.changerPhase("nuit");
    await M.coffre.rangement();
    assert.equal(valeur("coffre").rev, c0.rev + 4, "puis il rescelle par-dessus, à la révision suivante");
    // Un coffre plus récent qui arrive (réglage changé) : rouvert aussitôt.
    const encore = await apiCoffreMoteur().ouvrirScelle((({ partie: _p, rev: _r, ...s }) => s)(valeur("coffre")));
    encore.composition = "compo-ENCORE";
    const s2 = await apiCoffreMoteur().sceller(encore);
    await game.settings.set(ID, "coffre", { partie: id, rev: c0.rev + 9, ...s2 });
    await jusqua(() => M.secrets.secretsMJ()?.composition === "compo-ENCORE");
    await M.coffre.rangement();
    assert.equal(M.secrets.secretsMJ().composition, "compo-ENCORE");
  },

  async "changement de MJ actif : celui qui perd la main scelle et oublie ; celui qui la prend rouvre s'il est en retard"(M) {
    const id = await partie(M);
    deuxMJ();
    const rev = valeur("coffre").rev;
    await M.api.changerPhase("nuit");   // la nuit tombe chez « mj »
    await M.coffre.rangement();
    await M.api.noterAction({ acteurId: game.actors.contents[0].id, roleCle: "x", cibles: [game.actors.contents[1].id] });
    game.users.choisirActif("mj2");
    await M.coffre.perdreLaMain();
    assert.equal(valeur("coffre").rev, rev + 2, "la passation scelle ce qu'il savait (choix de la nuit compris)");
    // Sa mémoire est vidée : il ne garde que ce que son navigateur a rangé (relu, comparé au coffre, en reprenant la main).
    const range = structuredClone(reglages.get(`${ID}.secrets`).valeur);
    reglages.get(`${ID}.secrets`).valeur = {};
    assert.equal(M.secrets.secretsMJ().partie, undefined, "plus rien en mémoire");
    M.secrets.oublierSecrets();
    reglages.get(`${ID}.secrets`).valeur = range;
    const ouvert = await (async () => { game.users.choisirActif("mj"); const r = await apiCoffreMoteur().ouvrirScelle((({ partie: _p, rev: _r, ...s }) => s)(valeur("coffre"))); return r; })();
    assert.equal(ouvert.nuit.actions.length, 1);
    // « mj » reprend la main : à jour (personne n'a scellé depuis), il continue.
    assert.equal(await M.coffre.devenirMJActif(), true);
    assert.equal(M.api.etat().nuit.actions.length, 1);
    assert.equal(M.api.etat().partie, id);
  },

  async "nouvelle partie pendant l'attente des parts : elle s'écrit, et l'ancien coffre ne la remplace pas"(M) {
    const a = await partie(M);
    const cleMoteur = structuredClone(reglages.get("lakour-mj-ia.cleCarnet").valeur);
    autreNavigateur(M);
    await M.coffre.chercherSecrets(a);
    assert.equal(M.coffre.enAttenteDeParts(), true);
    assert.equal(M.api.ecritureBloquee(), true, "le MJ IA le sait (il se met en pause)");
    const n = emissions.length;
    const avis = [];
    ui.notifications.warn = m => avis.push(String(m));
    const b = await distribuer(M, "coffre-B");   // le MJ abandonne la partie : « Rejouer »
    assert.ok(avis.some(m => m.includes("SansCleCoffre") || /clé/.test(m)), "le MJ est averti que la clé manque à ce navigateur");
    assert.notEqual(b, a);
    assert.equal(M.coffre.enAttenteDeParts(), false, "les parts de l'ancienne partie ne sont plus attendues");
    assert.equal(M.api.ecritureBloquee(), false);
    assert.equal(emissions.slice(n).filter(e => e.type === "secret").length, 4, "les cartes de rôle sont parties");
    const fichesB = structuredClone(M.secrets.secretsMJ().fiches);
    reglages.get("lakour-mj-ia.cleCarnet").valeur = cleMoteur;   // la clé revient
    await M.coffre.surCoffreRouvert();
    await M.coffre.rangement();
    assert.equal(M.secrets.secretsMJ().partie, b);
    assert.deepEqual(M.secrets.secretsMJ().fiches, fichesB, "les rôles de la nouvelle partie restent");
  },

  async "un secret rouvert qui n'est pas de la partie publique est refusé"(M) {
    const id = await partie(M);
    const secrets = structuredClone(M.secrets.secretsMJ());
    const { coffre, cle } = await ancienCoffre({ ...secrets, fiches: undefined }, id);
    autreNavigateur(M);
    reglages.get(ID + ".coffre").valeur = coffre;
    reglages.get(ID + ".cleCoffre").valeur = cle;
    // La partie publique est désormais une autre (distribuée ailleurs) : l'ancien coffre de « id » ne la remplace pas.
    reglages.get(ID + ".partie").valeur = { ...valeur("partie"), partie: "une-autre" };
    await M.coffre.chercherSecrets(id);
    assert.notEqual(M.secrets.secretsMJ().partie, id);
    assert.equal(M.coffre.enAttenteDeParts(), false);
  },

  async "même révision, autre contenu : pas à jour ; un coffre changé pendant le scellement n'est pas écrasé"(M) {
    const id = await partie(M);
    const c0 = valeur("coffre");
    const moteur = game.modules.get("lakour-mj-ia").api.coffre;
    const autre = await moteur.sceller({ ...M.secrets.secretsMJ(), composition: "AUTRE" });
    reglages.get(ID + ".coffre").valeur = { partie: id, rev: c0.rev, ...autre };
    assert.equal(M.coffre.secretsAJour(id), false, "deux scellements depuis la même révision : le perdant n'est pas à jour");
    reglages.get(ID + ".coffre").valeur = c0;
    assert.equal(M.coffre.secretsAJour(id), true);
    // Un autre MJ écrit le coffre pendant que ce navigateur scelle : relu avant d'écrire, il n'est pas écrasé ; il est rouvert.
    const sceller = moteur.sceller;
    let intrus = null;
    moteur.sceller = async contenu => {
      const s = await sceller(contenu);
      if (!intrus) {
        intrus = { partie: id, rev: c0.rev + 1, ...(await sceller({ ...contenu, composition: "INTRUS" })) };
        reglages.get(ID + ".coffre").valeur = intrus;
      }
      return s;
    };
    try {
      await M.api.changerPhase("nuit");
      await M.coffre.rangement();
    } finally { moteur.sceller = sceller; }
    assert.equal(valeur("coffre").iv, intrus.iv, "le coffre de l'autre MJ n'est pas écrasé");
    await jusqua(() => M.secrets.secretsMJ()?.composition === "INTRUS");
    await M.coffre.rangement();
    assert.equal(M.secrets.secretsMJ().composition, "INTRUS", "il est rouvert");
  },

  async "MJ qui perd la main au milieu d'un geste : rien n'est écrit ; revenu, il a ses secrets"(M) {
    await partie(M);
    deuxMJ();
    await M.api.changerPhase("nuit");
    await M.coffre.rangement();
    const victime = game.actors.find(a => M.api.campDe(a) !== "meute");
    const avant = valeur("partie");
    const vrai = victime.update.bind(victime);
    victime.update = async d => {
      victime.update = vrai;
      game.users.choisirActif("mj2");
      await M.coffre.perdreLaMain();
      return vrai(d);
    };
    await assert.rejects(() => M.api.eliminer(victime.id, { cause: "sorciere" }));
    assert.deepEqual(valeur("partie").morts, avant.morts, "rien au public après la passation");
    game.users.choisirActif("mj");
    assert.equal(await M.coffre.devenirMJActif(), true);
    assert.equal(Object.keys(M.secrets.secretsMJ().fiches ?? {}).length, 4, "ses secrets sont entiers");
    assert.equal(await M.api.verifierVictoire(), "");
  },

  async "des secrets écrits sans leurs fiches ne passent jamais pour à jour"(M) {
    const id = await partie(M);
    assert.equal(M.coffre.secretsAJour(id), true);
    await M.secrets.garderSecrets({ partie: id, phase: "jour" });
    assert.equal(M.coffre.secretsAJour(id), false);
  },

  async "scellé avec le moteur : l'ancienne clé de ce navigateur (avant 0.9.0) est effacée"(M) {
    await partie(M);
    reglages.get(ID + ".cleCoffre").valeur = { partie: "ancienne", k: "1" };
    await M.api.changerPhase("nuit");
    await M.coffre.rangement();
    assert.deepEqual(valeur("cleCoffre"), {});
  },

  async "remise à zéro : coffre vidé ; nouvelle partie : un nouveau coffre"(M) {
    const id = await partie(M);
    await M.api.remettreAZero();
    await M.coffre.rangement();
    assert.deepEqual(valeur("coffre"), {});
    const id2 = await distribuer(M, "coffre-2");
    assert.notEqual(id2, id);
    assert.equal(valeur("coffre").partie, id2);
  }
};

const MUTATIONS = [
  ["scripts/coffre.mjs", "    if (!passation && avertiSansCle !== partie) {", "    if (false) {", "averti sans la clé du moteur"],
  ["scripts/coffre.mjs", "  if (attendue === partie) return;   // ses parts sont attendues : surtout ne pas l'écraser\n", "", "coffre jamais écrasé en attente"],
  ["scripts/coffre.mjs", "  if (!secretsAJour(partie)) {\n    // Des secrets périmés", "  if (false) {\n    // Des secrets périmés", "coffre récent jamais écrasé"],
  ["scripts/coffre.mjs", "  return rev !== null && (Number(s.revCoffre) || 0) > rev;", "  return true;", "révision comparée"],
  ["scripts/coffre.mjs", "  await noterRevision(partie, rev, scelle.iv);\n  await game.settings.set(ID, \"coffre\", { partie, rev, ...scelle });", "  await game.settings.set(ID, \"coffre\", { partie, ...scelle });", "révision notée et publiée"],
  ["scripts/coffre.mjs", "  file = file.then(() => scellerDansFile({ passation: true }))", "  file = file.then(() => null)", "passation scellée"],
  ["scripts/coffre.mjs", "  attendue = \"\";\n  oublierSecrets();\n  signaler();\n}", "  attendue = \"\";\n  signaler();\n}", "mémoire oubliée en perdant la main"],
  ["scripts/coffre.mjs", "  chercherSecrets(p.partie, rappelParDefaut).catch(e => console.warn(`${ID} | coffre`, e));\n}", "}", "coffre plus récent rouvert"],
  ["scripts/api.mjs", "    if (!sansSecrets) exigerSecretsAJour(", "    if (false) exigerSecretsAJour(", "rien ne s'écrit sans les secrets"],
  ["scripts/api.mjs", "    if (ecritureBloquee()) {\n      try { exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\")); } catch (err)", "    if (false) {\n      try { exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\")); } catch (err)", "aucune victoire sur du vide"],
  ["scripts/api.mjs", "  if (ecritureBloquee()) {\n    try { exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\")); } catch (e) { avis(userId, e.message); }", "  if (false) {\n    try { exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\")); } catch (e) { avis(userId, e.message); }", "aucun vote enregistré sans les secrets"],
  ["scripts/donnees.mjs", "s.partie === partie && secretsAJour(partie) ? s.fiches ?? {} : {};", "s.partie === partie ? s.fiches ?? {} : {};", "jamais joué sur des secrets périmés"],
  ["scripts/coffre.mjs", "  c.siRenouvele?.(async cle => {", "  void (async cle => {", "rescellé au renouvellement"],
  ["scripts/coffre.mjs", "  const secret = cle.partie === coffre.partie ? await ouvrirAncien(coffre, cle) : null;", "  const secret = null;", "migration de l'ancien coffre"],
  ["scripts/coffre.mjs", "    if (estMJActif() && partiePublique() && phasePublique() !== \"fin\") sceller();", "    void 0;", "battement"],
  ["scripts/coffre.mjs", "    if (!passation && (coffre.partie || coffre.donnees)) await game.settings.set(ID, \"coffre\", {});\n", "", "remise à zéro : coffre vidé"],
  ["scripts/coffre.mjs", "  try { await game.settings.set(ID, \"partCoffre\", {}); } catch { /* réglage absent */ }\n  return true;", "  return true;", "ancienne part effacée"],
  ["scripts/api.mjs", "    return foundry.utils.deepClone(etat.nuit.actions.at(-1));", "    await sceller();\n    return foundry.utils.deepClone(etat.nuit.actions.at(-1));", "pas de scellement aux choix de nuit"],
  ["scripts/api.mjs", "    if (!L.egaux(pub, brut)) await game.settings.set(ID, \"partie\", pub);", "    await game.settings.set(ID, \"partie\", pub);", "état public inchangé la nuit"],
  ["scripts/api.mjs", "    annoncer(\"lakourLoups.phase\", [phase, etat], [phase, L.etatPublic(etat)]);\n    await sceller();", "    annoncer(\"lakourLoups.phase\", [phase, etat], [phase, L.etatPublic(etat)]);", "scellé aux changements de phase"],
  ["scripts/api.mjs", "    if (!coffreDisponible()) throw new Error(t(\"LAKOUR_LOUPS.Erreurs.SansCoffre\"));\n", "", "sans le moteur, pas de partie"],
  ["logique/coffre.mjs", "    return secret?.partie === coffre.partie ? secret : null;", "    return secret;", "ancien coffre d'une autre partie refusé"],
  // Relecture 8. (Le contrôle de la partie publique au début d'essayer() double le refus de reprendre() : défense en profondeur ;
  // les deux contrôles du MJ actif, avant et après fn, se doublent tant qu'aucune fn n'est asynchrone : mutés ensemble.)
  ["scripts/api.mjs", "    if (sansSecrets) changementDePartie(secret.partie ?? \"\");\n", "", "nouvelle partie : parts de l'ancienne oubliées"],
  ["scripts/api.mjs", "    return estMJActif() && ecritureBloquee();", "    return false;", "le MJ IA sait que tout est bloqué"],
  ["scripts/coffre.mjs", "  if (!secret?.partie || secret.partie !== partiePublique()) { attendue = \"\"; retrouves = null; signaler(); return false; }\n", "", "jamais les secrets d'une autre partie"],
  ["scripts/coffre.mjs", "  return rev !== null && (Number(s.revCoffre) || 0) > rev;", "  return rev !== null && (Number(s.revCoffre) || 0) >= rev;", "révision égale : pas à jour"],
  ["scripts/coffre.mjs", "  if (maintenant.iv !== coffre.iv || maintenant.partie !== coffre.partie || revDe(maintenant) !== revDe(coffre)) {", "  if (false) {", "coffre relu avant d'écrire"],
  ["scripts/api.mjs", "    exigerMJ();\n    if (!sansSecrets) exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\"));\n    const avant = lireEtat();\n    const partieAvant = avant.partie;\n    const copieAvant = JSON.parse(JSON.stringify(avant.fiches ?? {}));\n    const r = await fn(avant);\n    exigerMJ();\n",
    "    if (!sansSecrets) exigerSecretsAJour(t(\"LAKOUR_LOUPS.Erreurs.SecretsAbsents\"));\n    const avant = lireEtat();\n    const partieAvant = avant.partie;\n    const copieAvant = JSON.parse(JSON.stringify(avant.fiches ?? {}));\n    const r = await fn(avant);\n", "seul le MJ actif écrit (avant et après fn)"],
  ["scripts/secrets.mjs", " && !(vides(secret) && !vides(avant))) {", ") {", "secrets vides jamais à jour"],
  ["scripts/coffre.mjs", "  if (Object.keys(lire(\"cleCoffre\")).length) { try { await game.settings.set(ID, \"cleCoffre\", {}); } catch { /* réglage absent */ } }\n", "", "ancienne clé effacée"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-coffre-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    M.coffre.oublierCoffre();
  }
  return liste;
}

test("coffre : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("coffre : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
