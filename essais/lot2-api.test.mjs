// Le lot 2 dans l'API du système (game.lakourLoups), sur la doublure de Foundry, et ce que voit chacun : le Dernier souffle
// (un mort vote une fois, par le socket, au vote d'exécution seulement ; bandeau et plateau), l'Almanach des brumes (présage tiré
// à l'aube, annoncé, appliqué : silences levés, vote à main levée public), le Somnambule (il porte le rôle rêvé, reçoit sa carte,
// voit faux ; dévoilé à sa mort ; RIEN de lui dans l'état public, les hooks, le chat ni les messages à d'autres), la Rosière
// (exécutée : la meute gagne), le Glas final (annoncé ; la nuit ne tombe plus) et la Bonne étoile (secrète, première nuit).
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, reglages, envoyerAuMJ, calme, messages, FR } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, bandeau, local, table, donnees, vote] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"),
    m("scripts/reglages.mjs"), m("logique/index.mjs"), m("scripts/apps/bandeau.mjs"), m("scripts/plateau-local.mjs"), m("scripts/apps/table.mjs"),
    m("scripts/donnees.mjs"), m("scripts/apps/vote.mjs")]);
  return { api: api.api, socket, reglages: reglagesM, L, bandeau, local, table, donnees, vote };
}

async function monde(M, { souffle = true, almanach = false } = {}) {
  installerFoundry({ joueurs: 6, dernierSouffle: souffle });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  M.local.remettreAZero();
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 2);
  await game.settings.set("lakour-loups", "bailli", false);
  await game.settings.set("lakour-loups", "almanach", almanach);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-camp", nuit: { actif: true, ordre: 60, invite: "Dans quelles cendres ?" } }),
    fossoyeur: role("Fossoyeur", { cle: "fossoyeur", effet: "voir-role-mort", nuit: { actif: true, ordre: 90 } }),
    sourcier: role("Sourcier", { cle: "sourcier", effet: "voir-camp", nuit: { actif: true, ordre: 62, cibles: 2 } }),
    somnambule: role("Somnambule", { cle: "somnambule" }),
    rosiere: role("Rosière", { cle: "rosiere" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6"];
async function partie(M, roles, extra = {}) {
  await M.api.distribuer({ roles, joueurs: JOUEURS, graine: "lot2", composition: "essai", batiments: [], ...extra });
}
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
// Rien du Somnambule ni de la Bonne étoile hors des secrets du MJ : réglage monde, hooks, chat, messages à d'autres que lui.
function secretsTenus({ somnambule = null, etoile = "" } = {}, depuis = 0) {
  // L'état public a la clé, toujours vide (comme dans toute partie) : rien d'autre ne nomme le Somnambule.
  const { somnambules, ...reste } = publicBrut();
  assert.deepEqual(somnambules, {});
  const pub = JSON.stringify(reste);
  assert.doesNotMatch(pub, /somnambule/i, "Somnambule dans l'état public");
  if (etoile) assert.ok(!pub.includes(`"bonneEtoile":"${etoile}"`), "Bonne étoile publique");
  for (const e of emissions.slice(depuis)) {
    const texte = JSON.stringify(e).replaceAll('"somnambules":{}', "");   // la clé vide de l'état public
    if (!/somnambule/i.test(texte)) continue;
    assert.ok(somnambule && e.recipients?.length === 1 && e.recipients[0] === somnambule.system.joueur, `${e.type} : ${texte.slice(0, 160)}`);
  }
  assert.ok(!messages.some(m => /somnambule/i.test(m.content)), "Somnambule au chat");
}

const VERIFICATIONS = {
  async "Dernier souffle : un mort vote une fois, au vote d'exécution ; bandeau et plateau le lui offrent"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [x, y, z] = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    await M.api.changerPhase("jour");
    await M.api.eliminer(x.id, { cause: "narrateur" });
    commeJoueur(x.system.joueur);
    assert.equal(M.bandeau.contexteBandeau().statut.texte, FR.LAKOUR_LOUPS.Souffle.Bandeau);
    commeMJ();
    await M.api.ouvrirVote({ duree: 0 });
    commeJoueur(x.system.joueur);
    assert.equal(M.local.etatLocal().mode, "vote", "le plateau le laisse voter");
    commeMJ();
    await voter([[x, loup], [y, loup]]);
    assert.ok(publicBrut().vote.exprimes.includes(x.id), "sa voix est reçue");
    const r = await M.api.cloreVote();
    assert.equal(r.decompte[loup.id], 2);
    assert.deepEqual(r.souffles, [x.id]);
    assert.ok(M.api.registreTexte().some(l => l.includes(FR.LAKOUR_LOUPS.Registre.VoixSouffle.replace("{qui}", x.name).replace("{cible}", loup.name))));
    // Une seule fois.
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, z]]);
    assert.ok(!publicBrut().vote.exprimes.includes(x.id), "plus de souffle");
    commeJoueur(x.system.joueur);
    assert.equal(M.local.etatLocal().mode, "", "plus de vote pour lui");
    assert.equal(M.bandeau.contexteBandeau().statut.texte, FR.LAKOUR_LOUPS.Bandeau.Mort);
    commeMJ();
    await M.api.cloreVote();
    // Un autre mort, pas à la Chapelle (vote d'asile) ni sans le réglage.
    await M.api.eliminer(y.id, { cause: "narrateur" });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0, objet: "chapelle" });
    await voter([[y, z]]);
    assert.ok(!publicBrut().vote.exprimes.includes(y.id), "pas à la Chapelle");
  },

  async "Dernier souffle coupé : un mort ne vote plus"(M) {
    const U = await monde(M, { souffle: false });
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [x, y] = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
    await M.api.eliminer(x.id, { cause: "narrateur" });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, y]]);
    assert.deepEqual(publicBrut().vote.exprimes, []);
  },

  async "Almanach : un présage à l'aube, annoncé à tous, appliqué (le vent du nord lève les silences)"(M) {
    const U = await monde(M, { almanach: true });
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const muet = villageois().find(a => secretDuMJ.camp(a) !== "meute");
    await M.api.changerPhase("nuit");
    await M.api.reduireAuSilence(muet.id);
    await M.api.changerPhase("aube");
    const n = emissions.length;
    const hasard = Math.random;
    Math.random = () => 0.85;   // le neuvième des dix présages : le vent du nord
    let r;
    try { r = await M.api.resoudreNuit({ chuchoter: true }); } finally { Math.random = hasard; }
    assert.equal(r.presage, "vent-du-nord");
    assert.deepEqual(publicBrut().presage, { actif: true, cle: "vent-du-nord", tour: 1 });
    assert.equal(muet.system.silence, false, "le silence est levé");
    const nom = FR.LAKOUR_LOUPS.Almanach.Presages["vent-du-nord"].Nom;
    assert.ok(messages.some(m => m.content.includes(nom)), "annoncé au chat");
    const hook = emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.presage");
    assert.deepEqual([hook.args[0], hook.recipients], [{ cle: "vent-du-nord", tour: 1 }, null]);
    assert.equal(M.api.presage().nom, nom);
    // Sans la variante : aucun présage.
    const V = await monde(M);
    await partie(M, [V.loup, V.villageois, V.villageois, V.villageois, V.villageois, V.villageois]);
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    assert.equal((await M.api.resoudreNuit({ chuchoter: true })).presage, "");
  },

  async "Almanach, jour de foire : les voix sont publiques pendant le vote, la Table les compte"(M) {
    const U = await monde(M, { almanach: true });
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [x, y] = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
    await M.api.changerPhase("jour");
    await game.settings.set("lakour-loups", "partie", { ...publicBrut(), presage: { actif: true, cle: "foire", tour: publicBrut().tour } });
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, y]]);
    assert.deepEqual(publicBrut().vote.votes, { [x.id]: y.id });
    commeJoueur("u6");
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.vivants.find(c => c.id === y.id).voix, 1);
    assert.equal(ctx.vote.mainLevee, true);
  },

  async "Somnambule : il porte le rôle rêvé, reçoit sa carte, voit faux ; dévoilé à sa mort ; rien ne fuit"(M) {
    const U = await monde(M);
    const n0 = emissions.length;
    await partie(M, [U.loup, U.somnambule, U.fossoyeur, U.sourcier, U.villageois, U.villageois]);
    const [s] = M.api.somnambules();
    assert.equal(s.croit, "liseuse-de-cendres", "le seul rôle rêvable absent");
    const somn = game.actors.get(s.acteurId);
    assert.equal(roleDe(somn).system.cle, "liseuse-de-cendres", "il porte le rôle rêvé (rien ne le trahit dans la console)");
    const carte = emissions.slice(n0).find(e => e.type === "secret" && e.recipients?.[0] === somn.system.joueur);
    assert.match(carte.entree.html, /Liseuse de cendres/);
    secretsTenus({ somnambule: somn }, n0);
    // La nuit : il lit le loup… « du Village ».
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: somn.id, roleCle: "liseuse-de-cendres", cibles: [loup.id] });
    await M.api.changerPhase("aube");
    const n = emissions.length;
    await M.api.resoudreNuit({ chuchoter: true });
    const vision = emissions.slice(n).find(e => e.type === "secret" && e.recipients?.[0] === somn.system.joueur);
    assert.match(vision.entree.texte, /« Village »/);
    secretsTenus({ somnambule: somn }, n0);
    // Commandé par la Table du MJ, il porte une marque ; chez un joueur, rien.
    assert.equal((await new M.table.TableDeJeu()._prepareContext()).vivants.find(c => c.id === somn.id).somnambule, true);
    commeJoueur("u6");
    assert.equal((await new M.table.TableDeJeu()._prepareContext()).vivants.find(c => c.id === somn.id).somnambule, false);
    commeMJ();
    // À sa mort : révélé Somnambule.
    const m = emissions.length;
    await M.api.eliminer(somn.id, { cause: "vote" });
    assert.equal(roleDe(somn).system.cle, "somnambule");
    assert.equal(emissions.slice(m).find(e => e.type === "hook" && e.nom === "lakourLoups.elimination").args[0].roleCle, "somnambule");
    assert.equal(M.api.somnambules()[0].devoile, true);
  },

  async "Somnambule : à la fin de la partie, chacun est découvert ; le Colporteur qui prend le rêve devient le Somnambule"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.somnambule, U.villageois, U.villageois, U.villageois, U.villageois]);
    const somn = game.actors.get(M.api.somnambules()[0].acteurId);
    const autre = villageois().find(a => a.id !== somn.id && secretDuMJ.camp(a) !== "meute");
    await M.api.echangerRoles(somn.id, autre.id);
    assert.deepEqual(M.api.somnambules().map(s => s.acteurId), [autre.id], "le rêve suit l'objet");
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    await M.api.eliminer(loup.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "village");
    assert.equal(roleDe(autre).system.cle, "somnambule", "découvert à la fin");
  },

  async "Rosière : exécutée par le vote, la meute gagne"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.rosiere, U.villageois, U.villageois, U.villageois, U.villageois]);
    const rosiere = villageois().find(a => roleDe(a).system.cle === "rosiere");
    await M.api.eliminer(rosiere.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "meute");
    assert.equal(publicBrut().phase, "fin");
  },

  async "Glas final : annoncé ; au soir du jour N, la nuit ne tombe plus et la meute l'emporte"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois], { glas: 1 });
    assert.equal(publicBrut().glas, 1);
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Calendrier.GlasAnnonce.replace("{n}", "1"))));
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await M.api.cloreVote();
    assert.equal(M.api.etapeSuivante().cle, "victoire");
    assert.equal(await M.api.verifierVictoire(), "meute", "après le vote du jour N");
    assert.deepEqual([publicBrut().phase, publicBrut().vainqueur], ["fin", "meute"]);
    // Posé en cours de partie, et annoncé ; le jour N sans vote : la nuit ne tombe plus.
    const V = await monde(M);
    await partie(M, [V.loup, V.villageois, V.villageois, V.villageois, V.villageois, V.villageois]);
    assert.equal(await M.api.glasFinal(3), 3);
    assert.equal(publicBrut().glas, 3);
    await M.api.glasFinal(1);
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    assert.deepEqual([publicBrut().phase, publicBrut().vainqueur, publicBrut().tour], ["fin", "meute", 1]);
  },

  async "Bonne étoile : secrète, la première nuit seulement ; la meute la manque"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const debutant = villageois().find(a => secretDuMJ.camp(a) !== "meute");
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    const n = emissions.length;
    await M.api.bonneEtoile(debutant.id);
    secretsTenus({ etoile: debutant.id }, n);
    assert.equal(M.api.etat().bonneEtoile, debutant.id, "le MJ la garde");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [debutant.id] });
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, []);
    assert.equal(debutant.system.vivant, true);
    await assert.rejects(() => M.api.bonneEtoile(debutant.id), e => e.message === FR.LAKOUR_LOUPS.Calendrier.Refus.etoile);
  },

  async "souffle et « les morts voient tout » : il ne voit pas les loups tant qu'il garde sa voix ; les voix vivantes comptées à part"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [x, y] = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    await M.api.changerPhase("jour");
    await M.api.eliminer(x.id, { cause: "narrateur", reveler: false });
    commeJoueur(x.system.joueur);
    assert.equal(M.donnees.roleVisible(loup), false, "il garde son souffle : rien");
    commeMJ();
    // La nuit, la tanière : il ne l'entend pas (un mort qui a rendu son souffle, si).
    await M.api.changerPhase("nuit");
    assert.ok(!M.api.audibilite(loup.system.joueur).auditeurs.includes(x.system.joueur), "pas la tanière");
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loup], [y, loup]]);
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.deepEqual([ctx.vote.exprimes, ctx.vote.souffles], [1, 1], "un vivant a voté, un mort a soufflé");
    assert.equal(M.api.etapeSuivante().donnees.n, 4, "quatre vivants manquent encore");
    await M.api.cloreVote();
    commeJoueur(x.system.joueur);
    assert.equal(M.donnees.roleVisible(loup), true, "son souffle rendu, il voit tout");
  },

  async "la composition de la partie en cours n'entre au réglage monde « historique » qu'à la fin"(M) {
    const U = await monde(M);
    await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, roles: ["loup-de-brumecombe", "rosiere", "villageois", "villageois", "villageois", "villageois"], peste: false });
    assert.deepEqual(reglages.get("lakour-loups.historique").valeur, [], "rien de la partie en cours");
    assert.ok(!JSON.stringify(publicBrut()).includes("rosiere"));
    const loup = villageois().find(a => secretDuMJ.camp(a) === "meute");
    await M.api.eliminer(loup.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "village");
    assert.ok(reglages.get("lakour-loups.historique").valeur.at(-1).roles.includes("rosiere"), "versée à la fin");
    void U;
  },

  async "Fossoyeur rêvé : un faux rôle, jamais un loup ni « Somnambule »"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.somnambule, U.liseuse, U.sourcier, U.villageois, U.villageois]);
    const somn = game.actors.get(M.api.somnambules()[0].acteurId);
    assert.equal(M.api.somnambules()[0].croit, "fossoyeur");
    const mortVillageois = villageois().find(a => roleDe(a).system.cle === "villageois");
    await M.api.eliminer(mortVillageois.id, { cause: "narrateur", reveler: false });
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: somn.id, roleCle: "fossoyeur", cibles: [mortVillageois.id] });
    await M.api.changerPhase("aube");
    const n = emissions.length;
    const hasard = Math.random;
    Math.random = () => 0;   // le premier rôle permis
    try { await M.api.resoudreNuit({ chuchoter: true }); } finally { Math.random = hasard; }
    const lu = emissions.slice(n).find(e => e.type === "secret" && e.recipients?.[0] === somn.system.joueur)?.entree.texte ?? "";
    assert.match(lu, /était : /);
    assert.doesNotMatch(lu, /Loup|Somnambule|était : Villageois/, lu);
  },

  async "deux porteurs d'un même rôle : chacun selon SES contraintes (hors d'atteinte : pas réveillé)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.somnambule, U.liseuse, U.fossoyeur, U.sourcier, U.villageois]);
    const cle = M.api.somnambules()[0].croit;
    const vil = villageois().find(a => roleDe(a).system.cle === "villageois");
    await M.api.eliminer(vil.id, { cause: "narrateur", reveler: false });
    await M.api.changerPhase("nuit");
    const [premier, second] = M.api.ordreDeNuit().find(e => e.roleCle === cle).acteurIds;
    assert.ok(second, "deux porteurs");
    const e = publicBrut();
    await game.settings.set("lakour-loups", "partie", { ...e, jour: { ...e.jour, effets: [...e.jour.effets, { type: "traversee", acteurId: premier, cible: second, nuit: e.tour }] } });
    const n = emissions.length;
    await M.api.reveiller(cle, { delai: 50 });
    assert.ok(emissions.slice(n).some(x => x.type === "demande" && x.acteurId === premier), "le premier choisit");
    assert.ok(!emissions.slice(n).some(x => x.type === "demande" && x.acteurId === second), "le second, hors d'atteinte, n'agit pas");
  },

  async "sceau fêlé : ni pastille « voix double » ; le décompte à main levée suit les poids"(M) {
    const U = await monde(M, { almanach: true });
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [b, x] = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(b.id);
    const tour = publicBrut().tour;
    await game.settings.set("lakour-loups", "partie", { ...publicBrut(), presage: { actif: true, cle: "foire", tour } });
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[b, x]]);
    let ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.vivants.find(c => c.id === x.id).voix, 2, "main levée : la voix double du Bailli");
    assert.ok(ctx.vote.voixDouble);
    await M.api.cloreVote();
    await M.api.changerPhase("jour");
    await game.settings.set("lakour-loups", "partie", { ...publicBrut(), presage: { actif: true, cle: "sceau-brise", tour } });
    await M.api.ouvrirVote({ duree: 0 });
    ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.vote.voixDouble, "", "pas de pastille");
    commeJoueur(b.system.joueur);
    assert.equal((await new M.vote.FenetreVote()._prepareContext()).voixDouble, false);
    assert.equal(M.bandeau.contexteBandeau().bailli.texte, FR.LAKOUR_LOUPS.Bailli.TuEsSceau);
  }
};

const MUTATIONS = [
  ["scripts/donnees.mjs", " && !aSonSouffle(lirePublic(), { id: moi.id, vivant: false })", "", "souffle : ne voit pas les rôles"],
  ["scripts/salons.mjs", "souffle: L.aSonSouffle(pub, v) }", "souffle: false }", "souffle : salons"],
  ["scripts/apps/table.mjs", "exprimes: v.exprimes.filter(id => vivants.some(x => x.id === id)).length, votants", "exprimes: v.exprimes.length, votants", "Table : voix vivantes"],
  ["scripts/api.mjs", "    await modifierEtat(e => { e.aConsigner = { roles: [...cles],", "    await game.settings.set(ID, \"historique\", [{ roles: [...cles] }]); await modifierEtat(e => { e.aConsigner = { roles: [...cles],", "historique : pas pendant la partie"],
  ["scripts/api.mjs", "      await consignerComposition();\n", "", "historique : versé à la fin"],
  ["scripts/api.mjs", "L.nomsFactices([...contenu.roles.keys()].map(cle => ({ cle, nom: contenu.noms.get(cle), camp: contenu.camps.get(cle) })))", "[...contenu.noms.values()]", "faux rôles filtrés"],
  ["scripts/api.mjs", "const siens = candidatsPour(api.candidatsDeNuit({ acteurId: autre, roleCle }));", "const siens = candidats;", "second porteur : ses contraintes"],
  ["scripts/apps/table.mjs", ".reduce((s, [votant]) => s + (pesees[votant] ?? 1), 0)", ".length", "main levée : les poids"],
  ["scripts/apps/table.mjs", "bailliId && pesees[bailliId] > 1 ? nomDe(bailliId)", "bailliId ? nomDe(bailliId)", "sceau fêlé : pastille de la Table"],
  ["scripts/apps/vote.mjs", "\n        && Boolean(L.poidsDesVoix(etat)[moi.id])", "", "sceau fêlé : fenêtre de vote"],
  ["scripts/apps/bandeau.mjs", "t(sceau ? \"LAKOUR_LOUPS.Bailli.TuEsSceau\" : \"LAKOUR_LOUPS.Bailli.TuEs\")", "t(\"LAKOUR_LOUPS.Bailli.TuEs\")", "sceau fêlé : bandeau"],
  ["scripts/api.mjs", "const votants = L.votantsAdmis({ etat: lireEtat(), villageois: villageoisAPlat() });\n  if (!acteur || !user || !votants.includes(votant)) return false;",
    "const votants = tousLesVillageois().filter(a => a.system.vivant).map(a => a.id);\n  if (!acteur || !user || !votants.includes(votant)) return false;", "souffle : la voix d'un mort reçue"],
  ["scripts/api.mjs", "const c = L.cloreVote(e, { votants: [...votants, ...souffles.filter(id => id in e.vote.votes)], souffles });",
    "const c = L.cloreVote(e, { votants });", "souffle : compté et rendu"],
  ["scripts/api.mjs", "e.souffle = L.souffleInitial(lireReglage(\"dernierSouffle\", true));", "e.souffle = L.souffleInitial(true);", "souffle : le réglage"],
  ["scripts/plateau-local.mjs", "  if (moiSouffle()) return \"vote\";\n", "", "souffle : le plateau"],
  ["scripts/apps/bandeau.mjs", "t(souffle ? \"LAKOUR_LOUPS.Souffle.Bandeau\" : \"LAKOUR_LOUPS.Bandeau.Mort\")", "t(\"LAKOUR_LOUPS.Bandeau.Mort\")", "souffle : le bandeau"],
  ["scripts/api.mjs", "    const presage = await tirerLePresage(r.bilan);", "    const presage = \"\";", "almanach : tiré à l'aube"],
  ["scripts/api.mjs", "e.presage = L.presageInitial(!court && lireReglage(\"almanach\", false));", "e.presage = L.presageInitial(true);", "almanach : le réglage"],
  ["scripts/api.mjs", "  for (const c of r.changements) if (c.type === \"silence\") await game.actors.get(c.acteurId)?.update(", "  for (const c of []) if (c.type === \"silence\") await game.actors.get(c.acteurId)?.update(", "almanach : silences levés"],
  ["scripts/api.mjs", "  annoncer(\"lakourLoups.presage\", [{ cle, tour: r.etat.tour }]);\n", "", "almanach : hook public"],
  ["scripts/api.mjs", "  for (const a of annonces) await annonceChat(echapper(a));\n  annoncer(\"lakourLoups.presage\"", "  annoncer(\"lakourLoups.presage\"", "almanach : annoncé au chat"],
  ["scripts/apps/table.mjs", ": v.mainLevee ? Object.entries(v.votes ?? {}).filter(([, c]) => c === a.id).reduce((s, [votant]) => s + (pesees[votant] ?? 1), 0) : null,", ": null,", "foire : la Table compte"],
  ["scripts/api.mjs", "        if (doc) { reve = { croit, vrai: att.role }; roleData = donneesObjet(doc); source = doc.uuid ?? \"\"; }", "        if (false) { reve = { croit, vrai: att.role }; roleData = donneesObjet(doc); source = doc.uuid ?? \"\"; }", "somnambule : le rôle rêvé"],
  ["scripts/api.mjs", "enJeu: [...rolesTires, ...Object.values(somnambules).map(x => x.croit)],", "enJeu: [],", "somnambule : un rêve absent"],
  ["scripts/api.mjs", "      e.somnambules = somnambules;\n", "", "somnambule : gardé par le MJ"],
  ["scripts/api.mjs", "jour: L.effetsDeLaNuit(avant, tour, { batiments: cles }), somnambules, rolesFactices", "jour: L.effetsDeLaNuit(avant, tour, { batiments: cles }), rolesFactices", "somnambule : il voit faux"],
  ["scripts/api.mjs", "    await devoilerSomnambule(acteurId);\n", "", "somnambule : dévoilé à sa mort"],
  ["scripts/api.mjs", "      for (const id of L.reveurs(e.somnambules)) await devoilerSomnambule(id);\n", "", "somnambule : dévoilé à la fin"],
  ["scripts/api.mjs", "      [s[a], s[b]] = [s[b], s[a]];\n", "", "somnambule : le rêve suit l'échange"],
  ["scripts/api.mjs", "      if (e.glas && e.tour >= e.glas && !e.vainqueur && await api.verifierVictoire({ finDuJour: true })) return foundry.utils.deepClone(lireEtat());\n", "", "glas : la nuit ne tombe plus"],
  ["scripts/api.mjs", "const glas = L.glasSonne(e) || (finDuJour", "const glas = (finDuJour", "glas : vérifié"],
  ["scripts/api.mjs", "      e.glas = L.normaliserGlas(glas);\n", "", "glas : posé à la distribution"],
  ["scripts/api.mjs", "    if (etat.glas) await annonceChat(", "    if (false) await annonceChat(", "glas : annoncé"],
  ["scripts/api.mjs", "    if (e.tour > 1 || e.nuitResolue >= 1) throw new Error(t(\"LAKOUR_LOUPS.Calendrier.Refus.etoile\"));\n", "", "étoile : la première nuit seulement"],
  ["scripts/api.mjs", "      x.bonneEtoile = acteurId;\n", "", "étoile : posée"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-lot2-api-"));
  dossiersARetirer.push(dossier);
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  return charger(dossier);
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { commeMJ(); await calme().catch(() => {}); }
  }
  return liste;
}

test("lot 2 (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("lot 2 (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
