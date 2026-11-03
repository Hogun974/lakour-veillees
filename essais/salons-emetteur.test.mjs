// Salons vocaux, côté ÉMETTEUR (scripts/salons.mjs, « côté émetteur ») : le navigateur d'un joueur n'envoie sa voix (son et
// image) qu'aux pairs de ligne.auditeurs ; vers les autres, chaque RTCRtpSender porte null. Doublure de la voix de Foundry
// (SimplePeerAVClient : client.peers, pair._pc = RTCPeerConnection, émetteurs RTCRtpSender dont replaceTrack est asynchrone)
// et un « réseau » qui note toute piste portée vers un pair interdit pendant que la connexion est établie. Vérifié : un pair
// non autorisé ne reçoit jamais de piste ; les autorisés oui ; recalcul à chaque phase, morsure, mort, changement de micro,
// piste ajoutée, renégociation, pair (re)connecté, ligne en retard ; repli (micro et caméra coupés à la source) quand
// l'émetteur ne peut pas être trié ; tout rendu à la fin. Puis le même scénario sur des copies mutées : chaque mutation
// doit échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, erreursHooks } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6"];
const vider = () => new Promise(r => setImmediate(r));   // replaceTrack résolu, enveloppes comprises

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, salons, reglages] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/salons.mjs"), m("scripts/reglages.mjs")]);
  return { api: api.api, socket, salons, reglages };
}

async function chargerMutant(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-emetteur-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, "scripts/salons.mjs");
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------ la doublure WebRTC
let numero = 0;
const piste = kind => ({ kind, id: `${kind}-${++numero}`, enabled: true });

// Le réseau : interdits = les pairs qui ne doivent rien recevoir de ce navigateur (fixé par l'essai) ; chaque piste portée
// vers l'un d'eux, connexion établie, est une fuite.
function creerReseau() {
  const reseau = { interdits: new Set(), fuites: [] };
  reseau.verifier = (pc, quand) => {
    if (pc.connectionState !== "connected" || !reseau.interdits.has(pc.userId)) return;
    for (const s of pc.emetteurs) if (s.track) reseau.fuites.push(`${quand} : ${s.track.kind} vers ${pc.userId}`);
  };
  return reseau;
}

class FauxEmetteur {   // RTCRtpSender
  constructor(pc, track) { this.pc = pc; this.track = track; }
  replaceTrack(track) {
    if (this.pc.refuser && track === null) return Promise.reject(new Error("InvalidModificationError"));
    // Comme dans un navigateur : la piste change quand la promesse est résolue.
    return Promise.resolve().then(() => { this.track = track ?? null; this.pc.reseau.verifier(this.pc, "replaceTrack"); });
  }
}

class FausseConnexion {   // RTCPeerConnection
  constructor(userId, reseau) {
    Object.assign(this, { userId, reseau, emetteurs: [], signalingState: "stable", connectionState: "new", ecouteurs: new Map(), refuser: false });
  }
  getSenders() { return [...this.emetteurs]; }
  // Une piste ajoutée ne part qu'après renégociation (offre, réponse) : pas de vérification ici, mais à la fin de l'étape.
  addTrack(track) { const s = new FauxEmetteur(this, track); this.emetteurs.push(s); return s; }
  removeTrack(s) { s.track = null; }
  addEventListener(nom, f) { if (!this.ecouteurs.has(nom)) this.ecouteurs.set(nom, new Set()); this.ecouteurs.get(nom).add(f); }
  removeEventListener(nom, f) { this.ecouteurs.get(nom)?.delete(f); }
  declencher(nom) { for (const f of this.ecouteurs.get(nom) ?? []) f({ type: nom }); }
  connecter() { this.connectionState = "connected"; this.reseau.verifier(this, "connexion"); }
  recoit() { return this.connectionState === "connected" ? this.emetteurs.filter(s => s.track).map(s => s.track.kind).sort() : []; }
}

// La voix de Foundry dans le navigateur de game.user. pairs : false = un client sans `peers` (autre client A/V) ;
// sansConnexion : des pairs dont la connexion est illisible.
function fausseVoix({ pairs = true, sansConnexion = false } = {}) {
  const moi = game.user.id;
  const reseau = creerReseau();
  const local = { micro: piste("audio"), camera: piste("video") };
  const localStream = { getTracks: () => [local.micro, local.camera] };
  const distantes = new Map();
  const diffusions = [], videos = [], notes = [];
  const carte = new Map();   // pc -> Map(piste locale -> émetteur), comme SimplePeer._senderMap
  class Client {
    constructor() { if (pairs) this.peers = new Map(); this.localStream = localStream; }
    getMediaStreamForUser(id) {
      if (id === moi) return localStream;
      if (!distantes.has(id)) distantes.set(id, [piste("audio"), piste("video")]);
      return { getTracks: () => distantes.get(id) };
    }
    toggleBroadcast(oui) { diffusions.push(oui); local.micro.enabled = oui; }
    toggleVideo(oui) { videos.push(oui); local.camera.enabled = oui; }
    // Un pair : SimplePeer crée la connexion et y ajoute le flux local AVANT que Foundry ne le range dans peers.
    connecter(userId, { etablir = true } = {}) {
      const pc = new FausseConnexion(userId, reseau);
      carte.set(pc, new Map([[local.micro, pc.addTrack(local.micro)], [local.camera, pc.addTrack(local.camera)]]));
      const pair = sansConnexion ? { destroy() {} } : { _pc: pc };
      this.peers?.set(userId, pair);
      if (etablir) pc.connecter();
      return pc;
    }
    // Autre micro : SimplePeer#replaceTrack(ancienne, nouvelle) -> l'émetteur de l'ancienne piste.
    changerMicro() {
      const ancienne = local.micro;
      local.micro = piste("audio");
      for (const [pc, m] of carte) { const s = m.get(ancienne); m.delete(ancienne); m.set(local.micro, s); s.replaceTrack(local.micro); void pc; }
      return local.micro;
    }
  }
  class Maitre {
    constructor() { this.mode = 3; this.client = new Client(); this.settings = { client: { voice: { mode: "always" } } }; }
    broadcast(i) { this.broadcasting = i; this.client.toggleBroadcast(i); return i; }
  }
  game.webrtc = new Maitre();
  ui.webrtc = {
    getUserVideoElement() { return { muted: false, dataset: {} }; },
    getUserCameraView() { return null; },
    setUserIsSpeaking() {}
  };
  ui.notifications = { info() {}, error() {}, warn: t => { notes.push(t); } };
  const connexions = new Map();
  for (const u of ["mj", ...JOUEURS].filter(x => x !== moi)) connexions.set(u, game.webrtc.client.connecter(u));
  return { reseau, local, connexions, diffusions, videos, notes, client: game.webrtc.client, carte };
}

// ------------------------------------------------------------------ le monde
async function monde(M) {
  installerFoundry({ joueurs: 6 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.salons.oublierSalons();
  M.salons.brancherSalons();
  const loup = creerObjetMonde("Loup", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } });
  const vil = creerObjetMonde("Villageois", "role", { cle: "villageois" });
  await M.api.distribuer({ roles: [loup, loup, vil, vil, vil, vil], joueurs: JOUEURS, graine: "emetteur" });
  const acteurDe = u => game.actors.find(a => a.system.joueur === u);
  const loups = JOUEURS.filter(u => secretDuMJ.camp(acteurDe(u)) === "meute");
  const autres = JOUEURS.filter(u => !loups.includes(u));
  return { acteurDe, loups, autres };
}

const derniereLigne = u => emissions.filter(e => e.type === "salon" && e.recipients?.includes(u)).at(-1);

// Le navigateur de `moi` reçoit sa dernière ligne ; les actions du MJ se font chez le MJ (dans la doublure, l'état du
// module est partagé : chez le MJ tout est rendu, on ne surveille donc pas le réseau pendant ce temps).
function navigateur(M, moi, v) {
  const chezMoi = async () => {
    game.user = game.users.get(moi);
    M.socket.traiterMessage(derniereLigne(moi), "mj");
    await vider();
  };
  return {
    chezMoi,
    async mj(f) {
      v.reseau.interdits = new Set();
      game.user = game.users.get("mj");
      try { await f(); } finally { await chezMoi(); }
    },
    // Ce que chaque pair reçoit, et la surveillance fixée : qui ne doit rien recevoir.
    attendre(autorises, message) {
      const tous = ["mj", ...JOUEURS].filter(u => u !== moi);
      v.reseau.interdits = new Set(tous.filter(u => !autorises.includes(u)));
      for (const u of tous) {
        const recu = v.connexions.get(u).recoit();
        if (autorises.includes(u)) assert.deepEqual(recu, ["audio", "video"], `${message} : ${u} doit m'entendre et me voir`);
        else assert.deepEqual(recu, [], `${message} : ${u} ne doit rien recevoir`);
      }
    }
  };
}

const sansFuite = v => assert.deepEqual(v.reseau.fuites, [], "une piste est partie vers un pair interdit");

// ------------------------------------------------------------------ le scénario (rejoué sur les copies mutées)
async function scenarioLoup(M) {
  const { acteurDe, loups, autres } = await monde(M);
  const [moi, frere] = loups;
  game.user = game.users.get(moi);
  const v = fausseVoix();
  const N = navigateur(M, moi, v);
  const tous = ["mj", ...JOUEURS].filter(u => u !== moi);
  try {
    await N.chezMoi();
    N.attendre(tous, "préparatifs");
    assert.equal(M.salons.etatEmetteur().autorises, null, "préparatifs : rien à trier");

    // La nuit : la tanière (et le MJ) seulement.
    await N.mj(() => M.api.changerPhase("nuit"));
    N.attendre(["mj", frere], "nuit");
    assert.equal(M.salons.microCoupe(), false, "un loup parle la nuit");
    assert.equal(M.salons.voixRepliee(), false, "émetteur trié : pas de repli");

    // Autre micro (Foundry/SimplePeer remplacent la piste de chaque émetteur) : la nouvelle ne part que vers la tanière.
    const micro = v.client.changerMicro();
    await vider();
    N.attendre(["mj", frere], "nouveau micro");
    assert.equal(v.connexions.get(frere).emetteurs.find(s => s.track?.kind === "audio").track, micro, "le frère a le nouveau micro");

    // Renégociation : une piste ajoutée (partage d'écran, par exemple).
    for (const pc of v.connexions.values()) pc.addTrack(piste("video"));
    await vider();
    for (const u of autres) assert.deepEqual(v.connexions.get(u).recoit(), [], `piste ajoutée : rien vers ${u}`);
    assert.deepEqual(v.connexions.get(frere).recoit(), ["audio", "video", "video"], "piste ajoutée : le frère la reçoit");
    for (const pc of v.connexions.values()) pc.emetteurs.pop();

    // Une piste posée sans replaceTrack (émetteur repris par addTrack) : la renégociation la retrie.
    const pc0 = v.connexions.get(autres[0]);
    v.reseau.interdits.delete(autres[0]);
    pc0.emetteurs[0].track = v.local.micro;
    pc0.declencher("negotiationneeded");
    await vider();
    N.attendre(["mj", frere], "renégociation");

    // Un villageois se reconnecte : la nouvelle connexion est triée avant d'être établie.
    v.client.peers.delete(autres[1]);
    const neuve = v.client.connecter(autres[1], { etablir: false });
    v.connexions.set(autres[1], neuve);
    await vider();
    neuve.connecter();
    N.attendre(["mj", frere], "pair reconnecté");
    Hooks.callAll("userConnected", game.users.get(autres[1]), true);
    await vider();
    N.attendre(["mj", frere], "userConnected");

    // Une morte (les morts voient tout : elle entend la tanière).
    const morte = autres[2];
    await N.mj(() => M.api.eliminer(acteurDe(morte).id, { cause: "meute" }));
    N.attendre(["mj", frere, morte], "une morte entend la tanière");

    // Une morsure : le mordu rejoint la tanière.
    const mordu = autres[0];
    await N.mj(() => M.api.changerCamp(acteurDe(mordu).id, "meute"));
    N.attendre(["mj", frere, morte, mordu], "le mordu à la tanière");

    // Le jour : tout le monde.
    await N.mj(async () => { for (const p of ["aube", "jour"]) await M.api.changerPhase(p); });
    N.attendre(tous, "le jour");
    const ligneDuJour = derniereLigne(moi);

    // Ligne en retard : la nuit est tombée, ma ligne de nuit n'est pas encore là -> le MJ seulement.
    await N.mj(() => M.api.changerPhase("nuit"));
    M.socket.traiterMessage(ligneDuJour, "mj");
    await vider();
    N.attendre(["mj"], "ligne en retard");
    Hooks.callAll("lakourLoups.phase", { phase: "nuit" });
    await vider();
    N.attendre(["mj"], "hook de phase avant la ligne");
    v.reseau.interdits = new Set(autres.filter(u => u !== morte && u !== mordu));   // pendant l'ouverture : les autres
    await N.chezMoi();
    N.attendre(["mj", frere, morte, mordu], "la ligne de nuit arrive");

    // Mon loup meurt : je parle aux morts (et au MJ).
    await N.mj(() => M.api.eliminer(acteurDe(moi).id, { cause: "vote" }));
    N.attendre(["mj", morte], "un loup mort parle aux morts");
    sansFuite(v);

    // La fin : tout est rendu, sans enveloppe.
    v.reseau.interdits = new Set();
    await N.mj(() => M.api.changerPhase("fin"));
    N.attendre(tous, "la fin");
    for (const pc of v.connexions.values()) {
      assert.equal(Object.hasOwn(pc, "addTrack") || Object.hasOwn(pc, "removeTrack"), false, "connexion rendue telle quelle");
      assert.equal(pc.emetteurs.some(s => Object.hasOwn(s, "replaceTrack")), false, "émetteurs rendus tels quels");
      assert.equal([...pc.ecouteurs.values()].every(e => !e.size), true, "écouteurs retirés");
    }
    assert.equal(Object.hasOwn(v.client.peers, "set") || Object.hasOwn(v.client.peers, "delete"), false, "pairs rendus tels quels");
    assert.deepEqual(M.salons.etatEmetteur(), { autorises: null, connexions: 0, repli: false });
    assert.deepEqual(erreursHooks, [], "erreur dans un hook");
  } finally {
    game.user = game.users.get("mj");
    try { M.salons.rendreTout(); } catch { /* copie mutée */ }
    delete game.webrtc; delete ui.webrtc;
  }
}

// Le repli : un client A/V qu'on ne peut pas trier coupe micro et caméra à la source, chez le loup, la nuit.
async function scenarioRepli(M, options) {
  const { loups } = await monde(M);
  const moi = loups[0];
  game.user = game.users.get(moi);
  const v = fausseVoix(options);
  const N = navigateur(M, moi, v);
  try {
    await N.chezMoi();
    assert.equal(M.salons.voixRepliee(), false, "préparatifs : pas de repli");
    await N.mj(() => M.api.changerPhase("nuit"));
    assert.equal(M.salons.voixRepliee(), true, "émetteur incontrôlable : repli");
    assert.equal(M.salons.microCoupe(), true, "repli : micro coupé");
    assert.equal(v.local.camera.enabled, false, "repli : caméra éteinte à la source");
    game.webrtc.broadcast(true);
    v.client.toggleVideo(true);
    assert.equal(v.diffusions.at(-1), false, "repli : le micro ne se rouvre pas");
    assert.equal(v.videos.at(-1), false, "repli : la caméra ne se rallume pas");
    assert.equal(v.local.camera.enabled, false);
    assert.equal(v.notes.length, 1, "repli : un message clair, une fois");
    Hooks.callAll("renderCameraViews");
    assert.equal(v.notes.length, 1, "pas de message à chaque rendu");
    // Le jour : tous l'entendent, rien à cacher, tout rendu.
    await N.mj(async () => { for (const p of ["aube", "jour"]) await M.api.changerPhase(p); });
    assert.equal(M.salons.voixRepliee(), false, "le jour : plus de repli");
    assert.equal(M.salons.microCoupe(), false);
    assert.equal(v.local.camera.enabled, true, "caméra rendue");
    assert.equal(v.diffusions.at(-1), true, "micro rendu (mode « toujours »)");
    assert.equal(Object.hasOwn(v.client, "toggleVideo"), false, "toggleVideo rendu tel quel");
    assert.deepEqual(erreursHooks, [], "erreur dans un hook");
  } finally {
    game.user = game.users.get("mj");
    try { M.salons.rendreTout(); } catch { /* copie mutée */ }
    delete game.webrtc; delete ui.webrtc;
  }
}

// Un replaceTrack(null) refusé : repli.
async function scenarioRefus(M) {
  const { loups, autres } = await monde(M);
  const moi = loups[0];
  game.user = game.users.get(moi);
  const v = fausseVoix();
  const N = navigateur(M, moi, v);
  try {
    v.connexions.get(autres[0]).refuser = true;
    await N.mj(() => M.api.changerPhase("nuit"));
    await vider();
    assert.equal(M.salons.voixRepliee(), true, "replaceTrack(null) refusé : repli");
    assert.equal(M.salons.microCoupe(), true);
    assert.equal(v.local.camera.enabled, false);
  } finally {
    game.user = game.users.get("mj");
    try { M.salons.rendreTout(); } catch { /* copie mutée */ }
    delete game.webrtc; delete ui.webrtc;
  }
}

const SYS = await charger(SYSTEME);

test("émetteur : un loup n'envoie sa voix qu'à la tanière, recalculée à chaque changement, rendue à la fin", async () => {
  await scenarioLoup(SYS);
});

test("émetteur : la nuit, un villageois n'envoie rien à personne ; le jour, à tous", async () => {
  const { autres } = await monde(SYS);
  const moi = autres[0];
  game.user = game.users.get(moi);
  const v = fausseVoix();
  const N = navigateur(SYS, moi, v);
  try {
    await N.chezMoi();
    await N.mj(() => SYS.api.changerPhase("nuit"));
    N.attendre([], "nuit d'un villageois");
    assert.equal(SYS.salons.microCoupe(), true);
    assert.equal(SYS.salons.voixRepliee(), false);
    await N.mj(async () => { for (const p of ["aube", "jour"]) await SYS.api.changerPhase(p); });
    N.attendre(["mj", ...JOUEURS].filter(u => u !== moi), "le jour");
    sansFuite(v);
  } finally {
    game.user = game.users.get("mj");
    SYS.salons.rendreTout();
    delete game.webrtc; delete ui.webrtc;
  }
});

test("émetteur : le MJ n'est jamais trié", async () => {
  await monde(SYS);
  game.user = game.users.get("mj");
  const v = fausseVoix();
  try {
    await SYS.api.changerPhase("nuit");
    await vider();
    for (const pc of v.connexions.values()) assert.deepEqual(pc.recoit(), ["audio", "video"]);
    assert.equal(SYS.salons.etatEmetteur().autorises, null);
  } finally {
    SYS.salons.rendreTout();
    delete game.webrtc; delete ui.webrtc;
  }
});

test("émetteur : repli quand le client A/V n'a pas de pairs lisibles", async () => {
  await scenarioRepli(SYS, { pairs: false });
});

test("émetteur : repli quand un pair n'a pas de connexion lisible", async () => {
  await scenarioRepli(SYS, { sansConnexion: true });
});

test("émetteur : repli quand replaceTrack(null) est refusé", async () => {
  await scenarioRefus(SYS);
});

// ------------------------------------------------------------------ mutations
const MUTATIONS = [
  ["envoyer(e, autorise(e.c.userId) ? e.vraie : null);", "envoyer(e, e.vraie);", scenarioLoup, "émetteur trié"],
  ["const voulue = autorise(e.c.userId) ? e.vraie : null;", "const voulue = e.vraie;", scenarioLoup, "nouveau micro trié"],
  ["const s = avant.apply(this, args); trier(s); return s;", "return avant.apply(this, args);", scenarioLoup, "piste ajoutée triée"],
  ["if (!e.attente && piste !== e.envoyee) { e.vraie = piste; e.envoyee = piste; }", "", scenarioLoup, "piste posée hors replaceTrack"],
  ["try { const c = garderConnexion(String(userId), pair); if (!c || !reglerConnexion(c)) appliquerVoix(); }", "try { }", scenarioLoup, "pair connecté trié"],
  ["if (ligne && ligne.phase === phase) return", "if (ligne) return", scenarioLoup, "ligne en retard"],
  ["return new Set(game.users.filter(u => u.isGM).map(u => u.id));", "return null;", scenarioLoup, "prudence sans ligne à jour"],
  ["if (qui === null) { lacherEmetteur(); return true; }", "if (qui === null) return true;", scenarioLoup, "émetteurs rendus"],
  ["return !game.users.some(u => u.id !== game.user.id && u.active !== false && !qui.has(u.id));", "return true;", o => scenarioRepli(o, { pairs: false }), "repli"],
  ["if (!c) { ok = false; continue; }", "if (!c) continue;", o => scenarioRepli(o, { sansConnexion: true }), "pair illisible"],
  ["    e.c.fautive = true;\n", "", scenarioRefus, "refus de couper"],
  ["    couperMicro();\n    couperSource();", "    couperMicro();", o => scenarioRepli(o, { pairs: false }), "caméra coupée au repli"],
  ["if (piste.kind === \"audio\" || !piste.enabled) continue;", "continue;", o => scenarioRepli(o, { pairs: false }), "caméra éteinte"]
];

for (const [avant, apres, scenario, regle] of MUTATIONS) {
  test(`mutation de l'émetteur « ${regle} » : détectée`, async () => {
    const M = await chargerMutant(avant, apres);
    await assert.rejects(() => scenario(M), `la règle « ${regle} » cassée passe inaperçue`);
  });
}
