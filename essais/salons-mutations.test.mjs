// Salons vocaux : essais par mutation du côté Foundry (scripts/salons.mjs, socket.mjs). Un scénario court sur la doublure
// (distribution, nuit, morsure, voix de Foundry chez un joueur, victoire) est rejoué sur des copies du système où une règle
// est cassée à la fois : ligne sans destinataire, hook bavard, MJ coupé, micro rouvert, voyant allumé, état non rendu…
// Chaque copie mutée doit échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, journalHooks } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, salons, reglages] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/salons.mjs"), m("scripts/reglages.mjs")]);
  return { api: api.api, socket, salons, reglages };
}

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-salons-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

// La voix de Foundry, en doublure : pistes des flux distants, <video>, voyants, diffusion du micro.
function fausseVoix() {
  const pistes = new Map(), videos = new Map(), voyants = new Map(), diffusions = [];
  const pistesDe = id => { if (!pistes.has(id)) pistes.set(id, [{ enabled: true }, { enabled: true }]); return pistes.get(id); };
  class Client { getMediaStreamForUser(id) { return { getTracks: () => pistesDe(id) }; } toggleBroadcast(oui) { diffusions.push(oui); } }
  class Maitre { constructor() { this.mode = 3; this.client = new Client(); this.settings = { client: { voice: { mode: "always" } } }; } broadcast(i) { this.broadcasting = i; this.client.toggleBroadcast(i); return i; } }
  class Cameras {
    getUserVideoElement(id) { if (!videos.has(id)) videos.set(id, { muted: false, dataset: {} }); return videos.get(id); }
    getUserCameraView() { return null; }
    setUserIsSpeaking(id, parle) { voyants.set(id, parle); }
  }
  game.webrtc = new Maitre();
  ui.webrtc = new Cameras();
  return { pistesDe, videos, voyants, diffusions, entendu: id => pistesDe(id).every(p => p.enabled) };
}

// Le scénario : chaque vérification lève une erreur si la règle n'est pas respectée.
async function scenario(M) {
  installerFoundry({ joueurs: 6 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.salons.brancherSalons();
  const loup = creerObjetMonde("Loup", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } });
  const vil = creerObjetMonde("Villageois", "role", { cle: "villageois" });
  await M.api.distribuer({ roles: [loup, loup, vil, vil, vil, vil], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "mutants" });
  const acteurDe = u => game.actors.find(a => a.system.joueur === u);
  const loups = ["u1", "u2", "u3", "u4", "u5", "u6"].filter(u => secretDuMJ.camp(acteurDe(u)) === "meute");
  const autres = ["u1", "u2", "u3", "u4", "u5", "u6"].filter(u => !loups.includes(u));
  const ligne = u => emissions.filter(e => e.type === "salon" && e.recipients?.includes(u)).at(-1);
  const hooks = depuis => emissions.slice(depuis).filter(e => e.type === "hook" && e.nom === "lakourLoups.audibilite");

  let n = emissions.length;
  await M.api.changerPhase("nuit");
  assert.ok(emissions.filter(e => e.type === "salon").every(e => e.recipients?.length === 1), "ligne sans destinataire unique");
  assert.deepEqual(hooks(n).map(e => e.args), [[{ phase: "nuit" }]], "hook de phase, sans secret");
  for (const u of autres) {
    const texte = JSON.stringify(ligne(u));
    for (const l of loups) assert.ok(!texte.includes(`"${l}"`) && !texte.includes(`"${acteurDe(l).id}"`), "un loup dans la ligne d'un non-loup");
  }
  assert.equal(ligne(loups[0]).ligne.salon, "taniere");
  assert.deepEqual(M.api.audibilite(loups[0]).auditeurs.sort(), ["mj", loups[1]].sort(), "audibilite chez le MJ");

  // Morsure : la ligne du mordu change, rien n'est annoncé à tous, le hook part chez le MJ.
  const mordu = autres[0];
  n = emissions.length;
  const j = journalHooks.length;
  await M.api.changerCamp(acteurDe(mordu).id, "meute");
  assert.equal(ligne(mordu).ligne.salon, "taniere", "le mordu à la tanière");
  assert.deepEqual(hooks(n), [], "la morsure annoncée à tous");
  assert.ok(journalHooks.slice(j).some(x => x.nom === "lakourLoups.audibilite"), "hook chez le MJ");

  // Le rechargement d'un joueur (« bonjour ») : sa ligne.
  n = emissions.length;
  M.socket.traiterMessage({ type: "bonjour", userId: autres[1] }, autres[1]);
  assert.ok(emissions.slice(n).some(e => e.type === "salon" && e.recipients[0] === autres[1]), "bonjour : pas de ligne");

  // Chez un non-loup : prudence, voix coupée, micro coupé, voyant éteint.
  const v = fausseVoix();
  const moi = autres[1];
  try {
    game.user = game.users.get(moi);
    M.socket.traiterMessage(ligne(moi), "mj");
    assert.equal(M.api.audibilite(loups[0]).peutParler, false, "un joueur devine un loup");
    for (const u of ["u1", "u2", "u3", "u4", "u5", "u6"].filter(x => x !== moi)) assert.equal(v.entendu(u), false, `${u} entendu la nuit`);
    assert.equal(v.entendu("mj"), true, "le MJ coupé");
    game.webrtc.broadcast(true);
    assert.equal(v.diffusions.at(-1), false, "le micro se rouvre la nuit");
    assert.equal(game.webrtc.broadcasting, false, "il paraît parler la nuit (voyant chez les autres)");
    ui.webrtc.setUserIsSpeaking(loups[0], true);
    assert.equal(v.voyants.get(loups[0]), false, "le voyant d'un loup s'allume");
    // Le MJ n'est jamais coupé.
    game.user = game.users.get("mj");
    M.salons.appliquerVoix();
    assert.equal(v.entendu(loups[0]), true, "le MJ n'entend pas un loup");
    game.user = game.users.get(moi);
    M.socket.traiterMessage(ligne(moi), "mj");
    // La victoire (phase « fin ») : tout est rendu.
    game.user = game.users.get("mj");
    for (const u of autres.filter(x => x !== mordu && x !== moi)) await M.api.eliminer(acteurDe(u).id, { cause: "meute" });
    await M.api.verifierVictoire();
    assert.equal(M.api.etat().phase, "fin");
    assert.equal(ligne(moi).ligne.phase, "fin", "pas de ligne à la victoire");
    game.user = game.users.get(moi);
    M.socket.traiterMessage(ligne(moi), "mj");
    assert.ok(["u1", "u2", "u3", "u4", "u5", "u6"].filter(x => x !== moi).every(u => v.entendu(u)), "flux non rendus à la fin");
    assert.equal(v.diffusions.at(-1), true, "micro non rouvert (mode « toujours »)");
    assert.equal(Object.hasOwn(game.webrtc, "broadcast") || Object.hasOwn(game.webrtc.client, "toggleBroadcast"), false, "A/V non rendu tel quel");
    assert.equal(Object.hasOwn(ui.webrtc, "setUserIsSpeaking"), false, "voyants non rendus");
  } finally {
    game.user = game.users.get("mj");
    try { M.salons.rendreTout(); } catch { /* copie mutée */ }
    delete game.webrtc; delete ui.webrtc;
  }
}

test("salons (Foundry) : le système d'origine passe le scénario", async () => {
  await scenario(await charger(SYSTEME));
});

const MUTATIONS = [
  ["scripts/salons.mjs", "emettre({ type: \"salon\", partie, ligne }, [userId]);", "emettre({ type: \"salon\", partie, ligne });", "ligne à son seul joueur"],
  ["scripts/salons.mjs", "annoncer(\"lakourLoups.audibilite\", [{ phase: pub.phase }]);", "annoncer(\"lakourLoups.audibilite\", [{ phase: pub.phase, lignes }]);", "hook sans secret"],
  ["scripts/salons.mjs", "if (forcer || publique !== derniere.publique) annoncer(", "if (true) annoncer(", "morsure tue"],
  ["scripts/salons.mjs", "else if (globale !== derniere.globale) Hooks.callAll(", "else if (false) Hooks.callAll(", "hook chez le MJ"],
  ["scripts/salons.mjs", "if (ligne && envoyees.get(u.id) !== JSON.stringify(ligne)) emettreLigne(", "if (false) emettreLigne(", "lignes envoyées"],
  ["scripts/salons.mjs", "const libre = Boolean(game.user?.isGM) ||", "const libre =", "le MJ jamais coupé"],
  ["scripts/salons.mjs", "for (const piste of fluxDe(userId)?.getTracks?.() ?? []) piste.enabled = entendre;", "", "flux coupés"],
  ["scripts/salons.mjs", "return avant.call(this, userId, parle && !coupes.has(userId));", "return avant.call(this, userId, parle);", "voyant éteint"],
  ["scripts/salons.mjs", "const r1 = envelopper(w, \"broadcast\", avant => function () { return avant.call(this, false); });", "const r1 = () => {};", "micro coupé"],
  ["scripts/salons.mjs", "w.broadcast(w.settings?.client?.voice?.mode === \"always\");", "w.broadcast(false);", "micro rendu"],
  ["scripts/salons.mjs", "return () => { if (propre) objet[nom] = avant; else delete objet[nom]; };", "return () => {};", "état d'origine rendu"],
  // Système 0.9.0 : deux mutations d'avant ne cassent plus rien, la règle étant tenue deux fois.
  // - « la victoire » (hook lakourLoups.victoire retiré) : à la victoire, les rôles et camps entrent aux documents
  //   (api.mjs, revelerPubliquement), et chaque mise à jour d'un villageois recalcule déjà les lignes (updateActor) ;
  // - « prudence hors du MJ » (audibilite calculée partout comme chez le MJ) : un navigateur de joueur n'a plus aucun camp
  //   (ni dans les documents, ni dans un réglage : secrets.mjs et donnees.mjs ne lisent les secrets que chez le MJ actif),
  //   il ne peut rien deviner, même en calculant tout.
  ["scripts/socket.mjs", "      envoyerLigne(qui);\n", "", "bonjour"],
  ["scripts/socket.mjs", "    case \"salon\": return recevoirLigne(message);\n", "", "ligne reçue"]
];

for (const [fichier, avant, apres, regle] of MUTATIONS) {
  test(`mutation des salons (Foundry) « ${regle} » : détectée`, async () => {
    const M = await chargerMutant(fichier, avant, apres);
    await assert.rejects(() => scenario(M), `la règle « ${regle} » cassée passe inaperçue`);
  });
}
