// Salons vocaux des Veillées dans Foundry (doublure : essais/doublures/foundry-loups.mjs) : le MJ actif calcule la matrice et
// envoie à chaque joueur SA ligne, à lui seul, par le socket du système ; le hook lakourLoups.audibilite à chaque changement
// (phase, mort, silence, distribution, nouvelle partie, réglage), sans secret ; l'API audibilite / audibiliteActeur, complète
// chez le MJ et prudente ailleurs ; la voix de Foundry dans le navigateur d'un joueur (flux des autres coupés localement,
// micro coupé, rien de persistant, tout rendu à la fin), le bandeau ; et des parties complètes simulées (joueurs simulés,
// compagnons IA, loups spéciaux, mordu) où la ligne de chaque joueur est vérifiée à chaque étape contre un oracle écrit
// d'après le tableau.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  installerFoundry, simulerJoueurs, calme, erreurs, emissions, journalHooks, erreursHooks, ajouterScene
} from "./doublures/foundry-loups.mjs";
import { PLAN_VILLAGE } from "../modules/lakour-veillees/contenu/village.mjs";

installerFoundry({ contenu: true });
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const socket = await import("../systems/lakour-loups/scripts/socket.mjs");
const salons = await import("../systems/lakour-loups/scripts/salons.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const plateau = await import("../systems/lakour-loups/scripts/plateau.mjs");
const local = await import("../systems/lakour-loups/scripts/plateau-local.mjs");
const bandeau = await import("../systems/lakour-loups/scripts/apps/bandeau.mjs");
const MJ = await import("../systems/lakour-loups/scripts/actions-mj.mjs");
const { creerHasard, melanger, choisir } = await import("../systems/lakour-loups/logique/index.mjs");
const ID = "lakour-loups";
const NEUTRE = "modules/lakour-veillees/assets/jetons/villageois.svg";

// ------------------------------------------------------------------ mise en place
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const acteurDe = u => villageois().find(a => a.system.joueur === u) ?? null;
const estLoup = a => secretDuMJ.camp(a) === "meute";
const joueursHumains = () => game.users.filter(u => !u.isGM).map(u => u.id);
const lignesEmises = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "salon");
const derniereLigne = u => lignesEmises().filter(e => e.recipients?.[0] === u).at(-1) ?? null;
const hooksAudibilite = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "hook" && e.nom === "lakourLoups.audibilite");
const tri = l => [...(l ?? [])].sort();

async function monde({ joueurs = 6, graine = "salons", ia = 2, simules = false, roles = null } = {}) {
  installerFoundry({ joueurs, contenu: true });
  enregistrerReglages(() => {});
  socket.ecouterSocket();
  game.lakourLoups = api;
  api.compagnons = null;
  salons.brancherSalons();
  plateau.oublierPlateau();
  plateau.brancherPlateau();
  api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
  api.plateau.configurer({ jetonNeutre: NEUTRE });
  local.remettreAZero();
  ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
  const h = creerHasard(`${graine}-ia`);
  api.resolveurs.compagnon = async d => (d.mode === "texte" ? "Méfiez-vous du moulin." : melanger(d.candidats.map(c => c.id), h).slice(0, d.nombre));
  const simulation = simules ? simulerJoueurs({ graine: `${graine}-joueurs`, fraude: false }) : null;
  for (const nom of ["Ysoline", "Barnabé", "Gaspard"].slice(0, ia)) {
    await Actor.implementation.create({ name: nom, type: "villageois", system: { joueur: "", compagnon: true }, ownership: { default: 1 } });
  }
  const prep = MJ.nouvellePreparation();
  prep.mode = "manuel";
  prep.roles = roles ?? { "loup-de-brumecombe": 1, "louve-mere": 1, "loup-hurleur": 1, "veilleuse-de-lanterne": 1, herboriste: 1, "garde-du-pont": 1 };
  await MJ.distribuer(prep);
  await api.plateau.attendre();
  await calme();
  return simulation;
}

// La ligne attendue d'un joueur, écrite d'après le tableau (voix-et-ecoute.md §3), sans passer par logique/salons.mjs.
function ligneAttendue(userId) {
  const phase = api.etat().phase;
  const libre = !game.settings.get(ID, "salonsAutomatiques") || ["preparation", "fin"].includes(phase);
  const mvt = game.settings.get(ID, "mortsVoientTout");
  const qui = u => {
    if (game.users.get(u).isGM) return { mj: true };
    const a = acteurDe(u);
    return a ? { vivant: a.system.vivant, silence: a.system.silence, loup: estLoup(a) } : { vivant: false, spectateur: true };
  };
  const parle = s => s.mj || libre || !s.vivant || (phase === "nuit" ? s.loup && !s.silence : !(s.silence && ["jour", "vote"].includes(phase)));
  const entendDe = (a, l) => a.mj || l.mj || libre || (l.vivant ? (phase === "nuit" ? (a.vivant ? a.loup : mvt && !a.spectateur) : true) : !a.vivant);
  const moi = qui(userId);
  const autres = game.users.map(u => u.id).filter(id => id !== userId);
  return {
    phase,
    peutParler: parle(moi),
    entend: tri(autres.filter(o => parle(qui(o)) && entendDe(moi, qui(o)))),
    auditeurs: parle(moi) ? tri(autres.filter(o => entendDe(qui(o), moi))) : [],
    tanière: !libre && phase === "nuit" && moi.vivant && moi.loup && !moi.silence
  };
}

function verifierLignes(ou) {
  const phase = api.etat().phase;
  const loupsVivants = villageois().filter(a => a.system.vivant && estLoup(a));
  for (const u of joueursHumains()) {
    const m = derniereLigne(u);
    assert.ok(m, `${ou} : ${u} n'a pas reçu sa ligne`);
    assert.deepEqual(m.recipients, [u], `${ou} : ligne de ${u} livrée à d'autres`);
    const l = m.ligne, a = ligneAttendue(u);
    assert.equal(l.phase, phase, `${ou} : ligne de ${u} en retard`);
    assert.deepEqual([l.peutParler, tri(l.entend), tri(l.auditeurs)], [a.peutParler, a.entend, a.auditeurs], `${ou} : ligne de ${u} (${l.salon})`);
    assert.equal(l.salon === "taniere", a.tanière, `${ou} : tanière de ${u}`);
    if (a.tanière) assert.deepEqual(tri(l.loups), tri(loupsVivants.map(x => x.id)), `${ou} : ${u} connaît la meute`);
    else assert.equal("loups" in l, false, `${ou} : la meute dans la ligne de ${u}`);
    // Le secret : la nuit, un vivant qui n'est pas loup ne reçoit aucun identifiant de loup.
    const moi = acteurDe(u);
    if (phase === "nuit" && moi?.system.vivant && !estLoup(moi)) {
      const texte = JSON.stringify(m);
      for (const loup of loupsVivants) {
        assert.ok(!texte.includes(`"${loup.id}"`), `${ou} : l'acteur d'un loup dans la ligne de ${u}`);
        if (loup.system.joueur) assert.ok(!texte.includes(`"${loup.system.joueur}"`), `${ou} : le joueur d'un loup dans la ligne de ${u}`);
      }
    }
    // L'API chez le MJ actif dit la même chose.
    const r = api.audibilite(u);
    assert.deepEqual(Object.keys(r).sort(), ["acteursAuditeurs", "auditeurs", "peutParler"]);
    assert.deepEqual([r.peutParler, tri(r.auditeurs)], [a.peutParler, a.auditeurs], `${ou} : audibilite(${u})`);
    assert.ok(Array.isArray(r.acteursAuditeurs) && r.acteursAuditeurs.every(id => game.actors.get(id)), `${ou} : compagnons qui entendent ${u}`);
  }
  // Les messages de ligne : toujours à un seul destinataire, jamais au MJ.
  for (const e of lignesEmises()) assert.ok(e.recipients?.length === 1 && e.recipients[0] !== "mj");
}

// ------------------------------------------------------------------ socket, hook, API
test("salons : chaque joueur reçoit SA ligne, le hook suit chaque changement, sans secret", async () => {
  await monde();
  const humains = joueursHumains();
  verifierLignes("préparatifs");
  for (const u of humains) assert.equal(derniereLigne(u).ligne.salon, "libre");
  assert.ok(hooksAudibilite().some(e => e.args[0].phase === "preparation"), "hook à la distribution");
  for (const e of hooksAudibilite()) assert.deepEqual(e.args, [{ phase: e.args[0].phase }], "le hook ne porte que la phase");

  // La nuit : la tanière pour les loups, le silence pour les autres.
  let n = emissions.length;
  await api.changerPhase("nuit");
  verifierLignes("nuit 1");
  assert.deepEqual(hooksAudibilite(n).map(e => e.args), [[{ phase: "nuit" }]], "hook à la phase");
  const loups = villageois().filter(estLoup);
  assert.deepEqual(tri(loups.map(a => roleDe(a).system.cle)), ["loup-de-brumecombe", "loup-hurleur", "louve-mere"]);
  const nonLoup = humains.find(u => !estLoup(acteurDe(u)));
  assert.deepEqual(derniereLigne(nonLoup).ligne, { phase: "nuit", salon: "nuit", peutParler: false, auditeurs: [], entend: ["mj"] });

  // Un compagnon IA (sans utilisateur) : audibiliteActeur.
  for (const c of villageois().filter(a => a.system.compagnon)) {
    const r = api.audibiliteActeur(c.id);
    assert.deepEqual(Object.keys(r).sort(), ["acteursAuditeurs", "auditeurs", "peutParler"]);
    assert.equal(r.peutParler, estLoup(c), c.name);
    if (estLoup(c)) {
      assert.deepEqual(tri(r.acteursAuditeurs), tri(loups.filter(l => l.id !== c.id).map(l => l.id)));
      assert.deepEqual(tri(r.auditeurs), tri(["mj", ...loups.map(l => l.system.joueur).filter(Boolean)]));
    } else assert.deepEqual([r.auditeurs, r.acteursAuditeurs], [[], []]);
  }

  // Un villageois mordu rejoint la meute : sa ligne change, celle des loups aussi ; le hook ne part que chez le MJ.
  const mordu = humains.map(acteurDe).find(a => !estLoup(a));
  n = emissions.length;
  const j = journalHooks.length;
  await api.changerCamp(mordu.id, "meute");
  verifierLignes("mordu");
  assert.equal(derniereLigne(mordu.system.joueur).ligne.salon, "taniere");
  assert.deepEqual(hooksAudibilite(n), [], "la morsure n'est pas annoncée à tous");
  assert.ok(journalHooks.slice(j).some(x => x.nom === "lakourLoups.audibilite"), "hook chez le MJ");
  assert.ok(lignesEmises(n).every(e => estLoup(acteurDe(e.recipients[0]))), "seuls les loups reçoivent une ligne nouvelle");

  // Une mort : le mort parle aux morts ; avec « les morts voient tout », il entend la tanière.
  const victime = humains.map(acteurDe).find(a => !estLoup(a) && a.id !== mordu.id);
  n = emissions.length;
  await api.eliminer(victime.id, { cause: "meute" });
  verifierLignes("mort");
  assert.equal(derniereLigne(victime.system.joueur).ligne.salon, "morts");
  assert.ok(hooksAudibilite(n).length >= 1, "hook à la mort");
  await game.settings.set(ID, "mortsVoientTout", false);
  verifierLignes("sans les morts voient tout");
  assert.ok(!derniereLigne(victime.system.joueur).ligne.entend.some(u => estLoup(acteurDe(u))));
  await game.settings.set(ID, "mortsVoientTout", true);
  verifierLignes("les morts voient tout");
  assert.ok(derniereLigne(victime.system.joueur).ligne.entend.some(u => estLoup(acteurDe(u))));

  // Le jour, le silence.
  for (const p of ["aube", "jour"]) await api.changerPhase(p);
  verifierLignes("jour");
  const muet = humains.map(acteurDe).find(a => a.system.vivant && !estLoup(a));
  n = emissions.length;
  await api.reduireAuSilence(muet.id);
  verifierLignes("silence");
  assert.equal(derniereLigne(muet.system.joueur).ligne.salon, "silence");
  assert.ok(hooksAudibilite(n).length >= 1, "hook au silence");
  await api.ouvrirVote({ duree: 0 });
  verifierLignes("vote");
  assert.equal(derniereLigne(muet.system.joueur).ligne.peutParler, false, "muet pendant le vote");

  // Le réglage : coupé, tout le monde parle ; rétabli.
  n = emissions.length;
  await game.settings.set(ID, "salonsAutomatiques", false);
  verifierLignes("salons coupés");
  assert.ok(hooksAudibilite(n).length >= 1, "hook au réglage");
  await game.settings.set(ID, "salonsAutomatiques", true);
  verifierLignes("salons rétablis");

  // Un joueur qui recharge (« bonjour ») ou se reconnecte reçoit sa ligne ; une ligne d'un non-MJ est refusée.
  n = emissions.length;
  socket.traiterMessage({ type: "bonjour", userId: "u3" }, "u3");
  assert.deepEqual(lignesEmises(n).map(e => e.recipients), [["u3"]]);
  n = emissions.length;
  Hooks.callAll("userConnected", game.users.get("u4"), true);
  assert.deepEqual(lignesEmises(n).map(e => e.recipients), [["u4"]]);
  game.user = game.users.get("u2");
  assert.equal(socket.traiterMessage({ type: "salon", partie: "x", ligne: { salon: "libre", peutParler: true, auditeurs: [], entend: [] } }, "u5"), false);
  game.user = game.users.get("mj");

  // La fin : tout le monde parle. Une nouvelle partie : hook, lignes des préparatifs.
  await api.changerPhase("fin");
  verifierLignes("fin");
  n = emissions.length;
  await api.nouvellePartie();
  await api.plateau.attendre();
  verifierLignes("nouvelle partie");
  assert.ok(hooksAudibilite(n).length >= 1, "hook à la nouvelle partie");
  assert.deepEqual(erreurs(), []);
  assert.deepEqual(erreursHooks, []);
});

test("salons : chez un joueur, la réponse est prudente et ne sait que ce qu'il sait", async () => {
  await monde({ graine: "prudence" });
  await api.changerPhase("nuit");
  const humains = joueursHumains();
  const loupHumain = humains.find(u => estLoup(acteurDe(u)));
  const autreLoup = villageois().find(a => estLoup(a) && a.system.joueur && a.system.joueur !== loupHumain);
  const villageoisHumain = humains.find(u => !estLoup(acteurDe(u)));
  const recevoir = u => { game.user = game.users.get(u); socket.traiterMessage(derniereLigne(u), "mj"); };
  try {
    // Un non-loup : sa propre ligne ; pour un loup, il ne sait rien (personne ne parle la nuit, de son point de vue).
    recevoir(villageoisHumain);
    assert.deepEqual(api.audibilite(villageoisHumain), { peutParler: false, auditeurs: [] });
    assert.equal(api.audibilite(loupHumain).peutParler, false, "un non-loup ne devine pas un loup");
    assert.equal(api.audibiliteActeur(acteurDe(loupHumain).id).peutParler, false);
    // Un loup : sa ligne, et la meute qu'il connaît.
    recevoir(loupHumain);
    const r = api.audibilite(loupHumain);
    assert.equal(r.peutParler, true);
    assert.ok(r.auditeurs.includes("mj"));
    if (autreLoup) {
      assert.ok(r.auditeurs.includes(autreLoup.system.joueur));
      assert.equal(api.audibilite(autreLoup.system.joueur).peutParler, true, "un loup sait qu'un autre loup parle");
    }
    // Hors du MJ actif, rien n'est calculé ni envoyé.
    const n = emissions.length;
    assert.equal(salons.rafraichirSalons(), null);
    assert.equal(salons.envoyerLigne("u1"), false);
    assert.equal(emissions.length, n);
  } finally { game.user = game.users.get("mj"); }
});

// ------------------------------------------------------------------ la voix de Foundry dans un navigateur
function fausseVoix({ mode = 3, voix = "always" } = {}) {
  const pistes = new Map(), videos = new Map(), voyants = new Map(), diffusions = [];
  const pistesDe = id => { if (!pistes.has(id)) pistes.set(id, [{ kind: "audio", enabled: true }, { kind: "video", enabled: true }]); return pistes.get(id); };
  class Client {
    // Aucun pair connecté : rien à trier côté émetteur (essais/salons-emetteur.test.mjs), seule la coupure locale joue ici.
    peers = new Map();
    getMediaStreamForUser(id) { return { getTracks: () => pistesDe(id) }; }
    toggleBroadcast(oui) { this.diffuse = oui; diffusions.push(oui); }
  }
  class Maitre {
    constructor() { this.mode = mode; this.client = new Client(); this.settings = { client: { voice: { mode: voix } } }; this.broadcasting = false; }
    broadcast(intention) { this.broadcasting = intention; this.client.toggleBroadcast(intention); return intention; }
  }
  game.webrtc = new Maitre();
  class Cameras {
    getUserVideoElement(id) { if (!videos.has(id)) videos.set(id, { muted: false, dataset: {} }); return videos.get(id); }
    getUserCameraView() { return { classList: { toggle() {} } }; }
    setUserIsSpeaking(id, parle) { voyants.set(id, parle); }
  }
  ui.webrtc = new Cameras();
  return { pistesDe, videos, voyants, diffusions };
}
const entendu = (v, id) => v.pistesDe(id).every(p => p.enabled);

test("voix de Foundry : un joueur n'entend que sa ligne, se tait quand il le faut, tout est rendu à la fin", async () => {
  await monde({ graine: "voix" });
  const ecritures = [];
  const set = game.settings.set;
  game.settings.set = async (id, cle, v) => { ecritures.push(`${id}.${cle}`); return set(id, cle, v); };
  const humains = joueursHumains();
  const moi = humains.find(u => !estLoup(acteurDe(u)));
  const loup = humains.find(u => estLoup(acteurDe(u)));
  const recevoir = () => socket.traiterMessage(derniereLigne(moi), "mj");
  const v = fausseVoix();
  try {
    game.user = game.users.get(moi);
    recevoir();
    assert.ok(humains.every(u => entendu(v, u)) && !salons.microCoupe(), "préparatifs : rien de coupé");
    assert.equal(bandeau.contexteBandeau().salon, null, "préparatifs : bandeau discret");

    // La nuit : il n'entend que le MJ, son micro est coupé (même s'il appuie pour parler), le voyant d'un loup reste éteint.
    game.user = game.users.get("mj");
    await api.changerPhase("nuit");
    game.user = game.users.get(moi);
    recevoir();
    assert.ok(entendu(v, "mj"), "le MJ s'entend toujours");
    for (const u of humains.filter(x => x !== moi)) {
      assert.equal(entendu(v, u), false, `nuit : ${u} coupé`);
      assert.equal(v.videos.get(u)?.muted, true, `nuit : <video> de ${u} muette`);
    }
    assert.equal(salons.microCoupe(), true);
    game.webrtc.broadcast(true);
    assert.equal(v.diffusions.at(-1), false, "appuyer pour parler ne rouvre pas le micro");
    assert.equal(game.webrtc.broadcasting, false, "il ne paraît pas parler chez les autres");
    game.webrtc.client.toggleBroadcast(true);
    assert.equal(v.diffusions.at(-1), false, "« toujours » ne rouvre pas le micro");
    ui.webrtc.setUserIsSpeaking(loup, true);
    assert.equal(v.voyants.get(loup), false, "le voyant d'un loup qui parle reste éteint");
    assert.deepEqual(bandeau.contexteBandeau().salon?.texte, "🔇 La nuit, silence");
    // Les caméras sont rendues à nouveau (nouveau flux) : la coupure tient.
    v.pistesDe(loup).forEach(p => { p.enabled = true; });
    Hooks.callAll("renderCameraViews");
    assert.equal(entendu(v, loup), false, "réappliqué après rendu des caméras");

    // Le jour : il entend les vivants ; les morts restent coupés.
    game.user = game.users.get("mj");
    const victime = humains.map(acteurDe).find(a => a.system.joueur !== moi && !estLoup(a));
    await api.eliminer(victime.id, { cause: "meute" });
    for (const p of ["aube", "jour"]) await api.changerPhase(p);
    game.user = game.users.get(moi);
    recevoir();
    assert.equal(salons.microCoupe(), false, "le jour, il parle");
    assert.equal(v.diffusions.at(-1), true, "mode « toujours » : le micro se rouvre");
    assert.equal(Object.hasOwn(game.webrtc, "broadcast"), false, "AVMaster rendu tel quel");
    assert.equal(Object.hasOwn(game.webrtc.client, "toggleBroadcast"), false, "AVClient rendu tel quel");
    assert.equal(entendu(v, loup), true, "il entend les vivants");
    assert.equal(v.videos.get(loup).muted, false);
    assert.equal(entendu(v, victime.system.joueur), false, "le mort reste coupé");
    assert.equal(bandeau.contexteBandeau().salon, null, "le jour, un vivant : bandeau discret");

    // Réduit au silence : bandeau « Réduit au silence », micro coupé.
    game.user = game.users.get("mj");
    await api.reduireAuSilence(acteurDe(moi).id);
    game.user = game.users.get(moi);
    recevoir();
    assert.equal(salons.microCoupe(), true);
    const ctx = bandeau.contexteBandeau();
    assert.equal(ctx.salon?.texte, "🔇 Réduit au silence");
    assert.equal(ctx.statut, null, "pas deux fois « Réduit au silence »");

    // Le MJ, lui, n'est jamais coupé.
    game.user = game.users.get("mj");
    salons.appliquerVoix();
    assert.equal(salons.microCoupe(), false);
    assert.ok(humains.every(u => entendu(v, u)), "le MJ entend tout");
    game.user = game.users.get(moi);
    recevoir();

    // La fin : tout est rendu.
    game.user = game.users.get("mj");
    await api.changerPhase("fin");
    game.user = game.users.get(moi);
    recevoir();
    assert.ok(humains.every(u => entendu(v, u)), "fin : tous rendus");
    assert.ok([...v.videos.values()].every(x => !x.muted && !x.dataset.lakourCoupe), "fin : <video> rendues");
    assert.equal(salons.microCoupe(), false);
    assert.equal(Object.hasOwn(ui.webrtc, "setUserIsSpeaking"), false, "voyants rendus");
    assert.deepEqual(salons.fluxCoupes(), []);
    assert.deepEqual(ecritures.filter(e => e.startsWith("core.")), [], "aucun réglage A/V persistant écrit");
  } finally {
    game.settings.set = set;
    game.user = game.users.get("mj");
    salons.rendreTout();
    delete game.webrtc; delete ui.webrtc;
  }
});

test("voix de Foundry : un loup la nuit, un mort, et sans A/V rien ne casse", async () => {
  await monde({ graine: "taniere" });
  const humains = joueursHumains();
  const loup = humains.find(u => estLoup(acteurDe(u)));
  await api.changerPhase("nuit");
  const v = fausseVoix();
  try {
    game.user = game.users.get(loup);
    socket.traiterMessage(derniereLigne(loup), "mj");
    assert.equal(salons.microCoupe(), false, "un loup parle la nuit");
    for (const u of humains.filter(x => x !== loup)) assert.equal(entendu(v, u), estLoup(acteurDe(u)), `tanière : ${u}`);
    assert.equal(bandeau.contexteBandeau().salon?.texte, "🐺 Tanière : tu parles aux loups");
    // Un mort : « Tu parles aux morts ».
    game.user = game.users.get("mj");
    await api.eliminer(acteurDe(loup).id, { cause: "vote" });
    game.user = game.users.get(loup);
    socket.traiterMessage(derniereLigne(loup), "mj");
    assert.equal(bandeau.contexteBandeau().salon?.texte, "👻 Tu parles aux morts");
    // A/V désactivé : rien n'est coupé, le bandeau est discret.
    game.webrtc.mode = 0;
    salons.appliquerVoix();
    assert.ok(humains.every(u => entendu(v, u)));
    assert.equal(salons.microCoupe(), false);
    assert.equal(bandeau.contexteBandeau().salon, null);
    // Sans A/V du tout.
    delete game.webrtc; delete ui.webrtc;
    assert.doesNotThrow(() => salons.appliquerVoix());
    assert.doesNotThrow(() => socket.traiterMessage(derniereLigne(loup), "mj"));
    assert.equal(bandeau.contexteBandeau().salon, null);
  } finally {
    game.user = game.users.get("mj");
    salons.rendreTout();
    delete game.webrtc; delete ui.webrtc;
  }
});

// ------------------------------------------------------------------ parties complètes
async function partie(graine) {
  await monde({ graine, simules: true, joueurs: 7, ia: 3,
    roles: { "loup-de-brumecombe": 1, "louve-mere": 1, "loup-hurleur": 1, "veilleuse-de-lanterne": 1, herboriste: 1, "garde-du-pont": 1, "liseuse-de-cendres": 1 } });
  const h = creerHasard(`${graine}-mj`);
  verifierLignes(`${graine} : préparatifs`);
  const ignorer = [];
  let fin = false, pas = 0, mordu = false, phaseAvant = api.etat().phase, marque = emissions.length;
  const phases = new Set();
  while (!fin) {
    assert.ok(++pas < 400, "la partie ne finit pas");
    await calme();
    await api.plateau.attendre();
    const phase = api.etat().phase;
    const ou = `${graine}, pas ${pas} (${phase}, tour ${api.etat().tour})`;
    phases.add(phase);
    verifierLignes(ou);
    if (phase !== phaseAvant) {
      assert.ok(hooksAudibilite(marque).some(e => e.args[0].phase === phase), `${ou} : pas de hook lakourLoups.audibilite`);
      phaseAvant = phase;
    }
    marque = emissions.length;
    if (phase === "nuit") {
      mordu ||= villageois().some(a => a.system.vivant && a.system.joueur && estLoup(a) && roleDe(a).system.camp !== "meute"
        && derniereLigne(a.system.joueur).ligne.salon === "taniere");
    }
    const e = api.etapeSuivante({ ignorer });
    if (e.cle === "rejouer") { fin = true; break; }
    if (e.cle === "emporter") {
      const vivants = villageois().filter(a => a.system.vivant).map(a => a.id);
      if (h() < 0.3 || !vivants.length) ignorer.push(`emporter:${e.donnees.id}`);
      else await MJ.faireEtape(e, { cible: choisir(vivants, h) });
      continue;
    }
    await MJ.faireEtape(e, { delai: 3000 });
  }
  verifierLignes(`${graine} : fin`);
  assert.deepEqual(erreurs(), []);
  assert.deepEqual(erreursHooks, []);
  return { mordu, vainqueur: api.etat().vainqueur, pas, phases };
}

test("parties complètes simulées : la ligne de chaque joueur, à chaque étape, suit le tableau ; le secret tient", async () => {
  const bilan = [];
  for (const graine of ["brume", "lanterne", "cendres", "moulin"]) bilan.push(await partie(graine));
  assert.ok(bilan.every(b => b.vainqueur));
  for (const p of ["preparation", "nuit", "aube", "jour", "vote", "fin"]) assert.ok(bilan.some(b => b.phases.has(p)), `phase jamais vue : ${p}`);
  assert.ok(bilan.some(b => b.mordu), "au moins un villageois mordu a rejoint la tanière");
  console.log(`salons : ${bilan.map(b => `${b.vainqueur.length > 10 ? "solitaire" : b.vainqueur} en ${b.pas} étapes${b.mordu ? " (mordu)" : ""}`).join(" ; ")}`);
});
