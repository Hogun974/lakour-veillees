// Le lot 3 dans l'API du système (game.lakourLoups), sur la doublure de Foundry, et ce que voit chacun : les Gens de passage
// (accueillis à l'aube ou au débat ; rôle public, camp SECRET : ni réglage monde, ni chat, ni hook, ni message à d'autres que
// la meute et lui), le départ (par le socket, pour soi ; sans mourir ; demandes closes, jeton retiré, victoire vérifiée) et
// l'exil (vote), le Banc des accusés (accusations par le socket, jugements un par un, verdict annoncé), le Glas du deuil
// (annonce vague, pouvoirs au carnet des seuls loups, vision de nuit, voix sans visage) et la Nuit de la Saint-Martin
// (autel secret, une nuit, un vote, la fin). Chaque vérification est rejouée sur des copies mutées du système (une règle
// cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, journalHooks, reglages, envoyerAuMJ, calme, messages, ajouterScene, FR } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, local, table, MJ] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"),
    m("scripts/reglages.mjs"), m("logique/index.mjs"), m("scripts/plateau-local.mjs"), m("scripts/apps/table.mjs"), m("scripts/actions-mj.mjs")]);
  return { api: api.api, socket, reglages: reglagesM, L, local, table, MJ };
}

// Sept joueurs dans le monde : six à la table, le septième arrive en cours de partie.
async function monde(M, { banc = false, deuil = false, passage = true } = {}) {
  installerFoundry({ joueurs: 7 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  M.local.remettreAZero();
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 2);
  await game.settings.set("lakour-loups", "bailli", false);
  await game.settings.set("lakour-loups", "masques", false);
  await game.settings.set("lakour-loups", "banc", banc);
  await game.settings.set("lakour-loups", "glasDuDeuil", deuil);
  await game.settings.set("lakour-loups", "gensDePassage", passage);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-camp", nuit: { actif: true, ordre: 60 } }),
    colporteur: role("Colporteur", { cle: "colporteur", effet: "echanger", nuit: { actif: true, ordre: 30, cibles: 2 }, usages: { max: 1, restant: 1 } }),
    garde: role("Garde du pont", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }),
    remouleur: role("Rémouleur", { cle: "remouleur", usages: { max: 1, restant: 1 } }),
    ours: role("Montreur d'ours", { cle: "montreur-d-ours", usages: { max: 1, restant: 1 } }),
    pelerine: role("Pèlerine", { cle: "pelerine", usages: { max: 1, restant: 1 } })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const avecRole = cle => villageois().filter(a => roleDe(a)?.system.cle === cle);
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6"];
async function partie(M, U, roles = ["loup", "liseuse", "villageois", "villageois", "villageois", "villageois"]) {
  await M.api.distribuer({ roles: roles.map(r => U[r]), joueurs: JOUEURS, graine: "lot3", composition: "essai", batiments: [] });
}
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
const hooks = nom => journalHooks.filter(h => h.nom === nom);
const hooksPublics = (nom, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "hook" && e.nom === nom);
const avecHasard = async (valeur, fn) => {
  const avant = Math.random;
  Math.random = () => valeur;
  try { return await fn(); } finally { Math.random = avant; }
};
async function rejeter(promesse, attendu) {
  await assert.rejects(promesse, e => e.message === attendu || (assert.equal(e.message, attendu), false));
}

const VERIFICATIONS = {
  async "Gens de passage : accueilli à l'aube ou au débat ; rôle public, camp secret"(M) {
    const U = await monde(M);
    await partie(M, U);
    await rejeter(M.api.accueillir({ userId: "u7" }), FR.LAKOUR_LOUPS.Passage.Refus.phase);
    await M.api.changerPhase("nuit");
    await rejeter(M.api.accueillir({ userId: "u7" }), FR.LAKOUR_LOUPS.Passage.Refus.phase);
    await M.api.changerPhase("jour");
    const [loup] = avecRole("loup-de-brumecombe");
    const depuis = emissions.length, chat = messages.length;
    const r = await avecHasard(0, () => M.api.accueillir({ userId: "u7", cle: "pelerine" }));
    await calme();
    const x = game.actors.get(r.acteurId);
    assert.equal(r.cle, "pelerine");
    assert.equal(x.system.joueur, "u7");
    assert.equal(x.system.vivant, true);
    assert.equal(secretDuMJ.camp(x), "meute", "la meute manquait (hasard 0)");
    assert.equal(roleDe(x).system.cle, "pelerine");
    assert.ok(x.system.maison && !villageois().some(a => a.id !== x.id && a.system.maison === x.system.maison), "une maison libre");
    // Public : le rôle et le tour, jamais le camp.
    assert.deepEqual(publicBrut().passage.gens[x.id], { cle: "pelerine", tour: 1 });
    const pub = JSON.stringify({ ...publicBrut(), passage: null });
    assert.ok(!pub.includes(FR.LAKOUR_LOUPS.Camps.meute) && !JSON.stringify(publicBrut().passage).includes("meute"), "camp dans l'état public");
    assert.ok(!publicBrut().historique.some(h => h.texte.includes(FR.LAKOUR_LOUPS.Camps.meute)), "camp au journal public");
    assert.ok(messages.slice(chat).some(m => m.content.includes(x.name) && m.content.includes("Pèlerine")), "annoncé au chat");
    assert.ok(!messages.slice(chat).some(m => m.content.includes(FR.LAKOUR_LOUPS.Camps.meute)), "camp au chat");
    const h = hooksPublics("lakourLoups.passage", depuis);
    assert.deepEqual(h.map(e => e.args), [[{ acteurId: x.id, cle: "pelerine", comment: "arrivee" }]]);
    // Les secrets : sa carte (à lui), la meute prévenue (au loup) ; à personne d'autre.
    for (const e of emissions.slice(depuis).filter(e => e.type === "secret")) {
      assert.ok(e.recipients?.length === 1 && ["u7", loup.system.joueur].includes(e.recipients[0]), `secret livré à ${e.recipients}`);
    }
    assert.ok(emissions.slice(depuis).some(e => e.type === "secret" && e.recipients[0] === loup.system.joueur && e.entree.texte.includes(x.name)), "la meute l'apprend");
    assert.ok(emissions.slice(depuis).some(e => e.type === "secret" && e.recipients[0] === "u7"), "sa carte");
    assert.ok(M.api.etat().journalSecret.some(j => j.texte.includes(x.name) && j.texte.includes(FR.LAKOUR_LOUPS.Camps.meute)), "le MJ le sait");
    // La Table d'un autre joueur : le rôle de passage, sans camp.
    commeJoueur("u2");
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    const fiche = ctx.vivants.find(f => f.id === x.id);
    assert.equal(fiche.passage, "Pèlerine");
    assert.equal(fiche.campCle, "");
    commeMJ();
    await rejeter(M.api.accueillir({ userId: "u7" }), FR.LAKOUR_LOUPS.Passage.Refus.present.replace("{nom}", x.name));
    // Le vote d'exécution change la phase : on n'entre pas pendant un vote.
    await M.api.ouvrirVote({ duree: 0 });
    await rejeter(M.api.accueillir({ userId: "u7" }), FR.LAKOUR_LOUPS.Passage.Refus.phase);
  },
  async "Gens de passage : sans le réglage, personne n'entre ; le camp tiré suit l'équilibre"(M) {
    const U = await monde(M, { passage: false });
    await partie(M, U);
    await M.api.changerPhase("jour");
    await rejeter(M.api.accueillir({ userId: "u7" }), FR.LAKOUR_LOUPS.Passage.Refus.inactif);
    // Sans le Glas du deuil (réglage faux) : une exécution ne sonne rien.
    await M.api.eliminer(avecRole("villageois")[0].id, { cause: "vote" });
    assert.deepEqual(publicBrut().deuil, { actif: false, compte: 0 });
    const V = await monde(M);
    await partie(M, V);
    await M.api.changerPhase("jour");
    const r = await avecHasard(0.5, () => M.api.accueillir({ userId: "u7" }));
    assert.equal(secretDuMJ.camp(game.actors.get(r.acteurId)), "meute", "la meute manque : 70 %");
    assert.ok(M.L.ROLES_DE_PASSAGE.includes(r.cle));
  },
  async "Départ : par le socket, pour soi ; sans mourir ; voix retirée, demande close, jeton retiré"(M) {
    const U = await monde(M);
    await partie(M, U);
    const scene = ajouterScene();
    game.scenes.set(scene.id, scene);
    const [liseuse] = avecRole("liseuse-de-cendres");
    const [a, b] = avecRole("villageois");
    await scene.createEmbeddedDocuments("Token", [{ actorId: liseuse.id }, { actorId: a.id }]);
    await M.api.changerPhase("nuit");
    const reveil = M.api.reveiller("liseuse-de-cendres", { delai: 60000 });
    await calme();
    assert.ok(emissions.some(e => e.type === "demande" && e.destinataire === liseuse.system.joueur));
    // Un autre joueur ne fait pas partir la Liseuse.
    envoyerAuMJ(CANAL, { type: "depart", acteurId: liseuse.id, userId: a.system.joueur }, { emetteur: a.system.joueur });
    await calme();
    assert.equal(liseuse.system.vivant, true, "pas pour un autre");
    const depuis = emissions.length, chat = messages.length;
    envoyerAuMJ(CANAL, { type: "depart", acteurId: liseuse.id, userId: liseuse.system.joueur }, { emetteur: liseuse.system.joueur });
    await calme();
    // Sa demande est close aussitôt (sans attendre le délai des choix).
    assert.ok(emissions.slice(depuis).some(e => e.type === "annuler" && e.recipients?.[0] === liseuse.system.joueur), "sa demande close");
    await reveil;
    assert.equal(liseuse.system.vivant, false);
    assert.equal(liseuse.system.revele, false, "rôle tu");
    assert.deepEqual(publicBrut().partis.map(p => [p.acteurId, p.comment]), [[liseuse.id, "depart"]]);
    assert.ok(!publicBrut().morts.some(m => m.acteurId === liseuse.id), "pas un mort");
    assert.ok(emissions.slice(depuis).some(e => e.type === "annuler" && e.recipients?.[0] === liseuse.system.joueur), "sa demande close");
    assert.ok(![...scene.tokens.values()].some(t => t.actorId === liseuse.id), "son jeton retiré");
    assert.ok([...scene.tokens.values()].some(t => t.actorId === a.id));
    assert.ok(messages.slice(chat).some(m => m.content.includes(FR.LAKOUR_LOUPS.Passage.Depart.replace("{nom}", liseuse.name))));
    assert.ok(!messages.slice(chat).some(m => m.content.includes("Liseuse")), "rôle tu au chat");
    assert.deepEqual(hooksPublics("lakourLoups.depart", depuis).map(e => e.args), [[{ acteurId: liseuse.id, comment: "depart" }]]);
    // Au vote : sa voix part avec lui.
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[a, b]]);
    assert.ok(a.id in M.api.etat().vote.votes);
    envoyerAuMJ(CANAL, { type: "depart", acteurId: a.id, userId: a.system.joueur }, { emetteur: a.system.joueur });
    await calme();
    assert.ok(!(a.id in M.api.etat().vote.votes), "sa voix retirée");
  },
  async "Départ : la victoire est vérifiée (le dernier loup part)"(M) {
    const U = await monde(M);
    await partie(M, U);
    await M.api.changerPhase("jour");
    const [loup] = avecRole("loup-de-brumecombe");
    await M.api.partir(loup.id);
    assert.equal(publicBrut().vainqueur, "village");
    assert.equal(publicBrut().phase, "fin");
    await rejeter(M.api.partir(avecRole("villageois")[0].id), FR.LAKOUR_LOUPS.Passage.Refus.fin);
  },
  async "Exil : le vote vise les gens de passage ; l'élu part, son camp tu"(M) {
    const U = await monde(M);
    await partie(M, U);
    await M.api.changerPhase("jour");
    await rejeter(M.api.ouvrirVote({ objet: "exil" }), FR.LAKOUR_LOUPS.Passage.Refus.exil);
    const r = await avecHasard(0, () => M.api.accueillir({ userId: "u7", cle: "remouleur" }));
    const x = game.actors.get(r.acteurId);
    let ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.passage.exil, true, "le MJ peut ouvrir l'exil");
    const v = await M.api.ouvrirVote({ objet: "exil", duree: 0 });
    assert.deepEqual(v.candidats, [x.id]);
    const chat = messages.length;
    await voter(avecRole("villageois").map(a => [a, x]));
    const res = await M.api.cloreVote();
    assert.equal(res.elu, x.id);
    assert.equal(x.system.vivant, false);
    assert.deepEqual(publicBrut().partis.map(p => [p.acteurId, p.comment]), [[x.id, "exil"]]);
    assert.ok(!publicBrut().morts.some(m => m.acteurId === x.id));
    assert.ok(messages.slice(chat).some(m => m.content.includes(FR.LAKOUR_LOUPS.Passage.Exil.replace("{nom}", x.name))));
    assert.ok(!messages.slice(chat).some(m => m.content.includes(FR.LAKOUR_LOUPS.Camps.meute)), "camp tu");
    ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.morts.find(f => f.id === x.id).parti, FR.LAKOUR_LOUPS.Passage.Exile.replace("{tour}", String(publicBrut().tour)));
    assert.equal(await M.api.partir(x.id, { comment: "exil" }), false, "déjà parti : sans effet");
    // Un autre gens de passage part pendant son propre vote d'exil : le vote se clôt, sans élu.
    await M.api.changerPhase("jour");
    const y = game.actors.get((await avecHasard(0.9, () => M.api.accueillir({ nom: "Voyageuse" }))).acteurId);
    await M.api.ouvrirVote({ objet: "exil", duree: 0 });
    await voter(avecRole("villageois").map(a => [a, y]));
    const avantDepart = emissions.length, chatDepart = messages.length;
    assert.equal(await M.api.partir(y.id), true);
    await calme();
    assert.equal(publicBrut().vote.ouvert, false);
    assert.deepEqual(publicBrut().vote.resultat.elus, []);
    assert.equal(publicBrut().vote.resultat.depart, y.id);
    assert.deepEqual(publicBrut().partis.map(p => [p.acteurId, p.comment]).at(-1), [y.id, "depart"]);
    assert.ok(messages.slice(chatDepart).some(m => m.content.includes(FR.LAKOUR_LOUPS.Passage.VoteSansObjet.replace("{nom}", y.name))));
    assert.deepEqual(hooksPublics("lakourLoups.voteClos", avantDepart).map(e => e.args[0].depart), [y.id]);
    // Rejouer : les partis ne sont pas redistribués.
    await M.api.nouvellePartie({ memesJoueurs: true });
    assert.ok(!villageois().some(a => a.system.joueur === "u7"), "le joueur parti ne rejoue pas");
    assert.ok(!game.actors.get(x.id) && !game.actors.get(y.id), "leurs villageois quittent le village");
    assert.equal(villageois().length, 6);
  },
  async "Banc : accuser par le socket ; juger un par un ; le verdict annoncé"(M) {
    const U = await monde(M, { banc: true });
    await partie(M, U);
    await M.api.changerPhase("jour");
    const [a, b, c, d] = avecRole("villageois");
    const accuse = (par, contre) => envoyerAuMJ(CANAL, { type: "accusation", acteurId: par.id, contre: contre.id, userId: par.system.joueur }, { emetteur: par.system.joueur });
    const chat = messages.length, depuis = emissions.length;
    accuse(a, b);
    await calme();
    assert.deepEqual(publicBrut().banc.accusations, [{ par: a.id, contre: b.id }]);
    assert.ok(publicBrut().registre.some(x => x.type === "accusation" && x.acteurId === a.id && x.contre === b.id));
    assert.ok(messages.slice(chat).some(m => m.content.includes(a.name) && m.content.includes(b.name)), "annoncée au chat");
    assert.deepEqual(hooksPublics("lakourLoups.accusation", depuis).map(e => e.args), [[{ par: a.id, contre: b.id }]]);
    accuse(a, c);
    await calme();
    assert.equal(publicBrut().banc.accusations.length, 1, "une par jour");
    assert.ok(emissions.some(e => e.type === "avis" && e.recipients?.[0] === a.system.joueur && e.texte === FR.LAKOUR_LOUPS.Banc.Refus.deja));
    envoyerAuMJ(CANAL, { type: "accusation", acteurId: c.id, contre: d.id, userId: a.system.joueur }, { emetteur: a.system.joueur });
    await calme();
    assert.equal(publicBrut().banc.accusations.length, 1, "pas au nom d'un autre");
    accuse(c, d);
    await calme();
    // La Table d'un joueur : le banc, et sa propre accusation déjà faite.
    commeJoueur(a.system.joueur);
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.banc.accusations.length, 2);
    assert.equal(ctx.accusation.ok, false);
    commeMJ();
    assert.equal(M.api.etapeSuivante().cle, "juger");
    let v = await M.api.ouvrirVote({ duree: 0 });
    assert.deepEqual(v.candidats, [b.id]);
    await voter([[a, b], [c, b]]);
    let r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [], "2 sur 6 : acquitté");
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Banc.Acquitte.replace("{nom}", b.name).replace("{pour}", "2").replace("{total}", "6"))));
    v = await M.api.ouvrirVote({ duree: 0 });
    assert.deepEqual(v.candidats, [d.id], "le suivant");
    await voter([[a, d], [b, d], [c, d]]);
    r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [d.id]);
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Banc.Condamne.replace("{nom}", d.name).replace("{pour}", "3").replace("{total}", "6"))));
    await M.api.eliminer(d.id, { cause: "vote" });
    await rejeter(M.api.ouvrirVote({ duree: 0 }), FR.LAKOUR_LOUPS.Banc.Refus.personne);
  },
  async "Glas du deuil : annonce vague, pouvoirs au carnet des seuls loups ; vision de nuit ; voix sans visage"(M) {
    const U = await monde(M, { deuil: true });
    await partie(M, U);
    await M.api.changerPhase("jour");
    const [loup] = avecRole("loup-de-brumecombe");
    const [a, b, c] = avecRole("villageois");
    const [liseuse] = avecRole("liseuse-de-cendres");
    const depuis = emissions.length;
    await M.api.eliminer(a.id, { cause: "vote" });
    await calme();
    assert.deepEqual(publicBrut().deuil, { actif: true, compte: 1 });
    assert.deepEqual(publicBrut().pouvoirsDeuil, { visions: 0, voix: false, linceul: 0, cible: null }, "le pouvoir reste secret");
    assert.equal(M.api.pouvoirsDuDeuil().visions, 1);
    assert.ok(messages.some(m => m.content.includes("Le glas du deuil sonne pour la 1re fois sur Brumecombe.")));
    assert.deepEqual(hooksPublics("lakourLoups.deuil", depuis).map(e => e.args), [[{ compte: 1 }]]);
    const secrets = emissions.slice(depuis).filter(e => e.type === "secret");
    assert.deepEqual(secrets.map(e => e.recipients), [[loup.system.joueur]], "au loup seul");
    assert.equal(secrets[0].entree.texte, FR.LAKOUR_LOUPS.Deuil.Pouvoir1);
    // Une nuit sans la vision ne la consomme pas.
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    assert.equal(M.api.pouvoirsDuDeuil().visions, 1, "la vision n'a pas servi");
    await M.api.changerPhase("jour");
    // La nuit : la vision réveille la meute, le loup désigne, il apprend le camp à l'aube.
    await M.api.changerPhase("nuit");
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "deuil"));
    const reveil = M.api.reveiller("deuil", { delai: 60000 });
    await calme();
    const demande = emissions.findLast(e => e.type === "demande" && e.destinataire === loup.system.joueur);
    assert.ok(demande, "la meute réveillée");
    envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: [liseuse.id], userId: loup.system.joueur }, { emetteur: loup.system.joueur });
    await calme();
    await reveil;
    const avant = emissions.length;
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await calme();
    assert.ok(emissions.slice(avant).some(e => e.type === "secret" && e.recipients[0] === loup.system.joueur && e.entree.texte.includes(liseuse.name)), "la vision");
    assert.equal(M.api.pouvoirsDuDeuil().visions, 0, "la vision servie");
    // Le second glas : la voix sans visage au vote d'exécution.
    await M.api.changerPhase("jour");
    await M.api.eliminer(b.id, { cause: "vote" });
    assert.equal(M.api.pouvoirsDuDeuil().voix, true);
    const depuisVoix = emissions.length;
    const vote = await M.api.ouvrirVote({ duree: 0 });
    await calme();
    // La meute (le loup seul) est consultée en secret ; personne d'autre.
    const demandes = emissions.slice(depuisVoix).filter(e => e.type === "demande");
    assert.deepEqual(demandes.map(e => [e.recipients?.[0], e.objet]), [[loup.system.joueur, "deuil-voix"]]);
    assert.deepEqual(demandes[0].candidats.map(x => x.id).sort(), vote.candidats.filter(id => id !== loup.id).sort(), "les candidats du vote (pas lui-même)");
    // Le loup vote pour c, mais place la voix sans visage sur la Liseuse : rien ne relie les deux.
    envoyerAuMJ(CANAL, { type: "reponse", id: demandes[0].id, cibles: [liseuse.id], userId: loup.system.joueur }, { emetteur: loup.system.joueur });
    await voter([[loup, c], [c, liseuse], [liseuse, c]]);
    const r = await avecHasard(0, () => M.api.cloreVote());
    assert.equal(r.deuil, liseuse.id, "le choix secret");
    assert.deepEqual(r.elus, [], "2 contre 2");
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.Deuil.Voix.replace("{nom}", liseuse.name))));
    assert.ok(!JSON.stringify(publicBrut()).includes("deuil-voix"));
    // Un loup exécuté ne fait pas sonner le glas.
    await M.api.eliminer(loup.id, { cause: "vote" });
    assert.equal(publicBrut().deuil.compte, 2);
  },
  async "Saint-Martin : l'autel secret ; une nuit, un vote, la fin"(M) {
    const U = await monde(M, { banc: true, deuil: true });
    await game.settings.set("lakour-loups", "almanach", true);
    const depuis = emissions.length;
    const r = await M.api.nouvellePartie({ joueurs: JOUEURS, compagnons: [], format: "saint-martin", graine: "martin" });
    assert.equal(r.composition.autel.length, 3);
    assert.equal(r.composition.roles.length, 6);
    assert.equal(publicBrut().format, "saint-martin");
    assert.deepEqual(publicBrut().autel, [], "l'autel n'est pas public");
    assert.deepEqual(M.api.autel().map(x => x.cle), r.composition.autel);
    assert.ok(!JSON.stringify(hooksPublics("lakourLoups.nouvellePartie", depuis)).includes("autel"));
    assert.ok(messages.some(m => m.content.includes(FR.LAKOUR_LOUPS.SaintMartin.Annonce.replace("{n}", "3"))));
    assert.deepEqual([publicBrut().banc.actif, publicBrut().deuil.actif, publicBrut().presage.actif, publicBrut().bailli.actif], [false, false, false, false]);
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    assert.equal(await M.api.verifierVictoire(), "", "rien avant le vote");
    await M.api.ouvrirVote({ duree: 0 });
    await M.api.cloreVote();
    const g = await M.api.verifierVictoire();
    const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute");
    assert.equal(g, loups.length ? "meute" : "village");
    assert.equal(publicBrut().phase, "fin");
    // Sans vote, la seconde nuit ne tombe pas : la partie finit.
    await M.api.nouvellePartie({ joueurs: JOUEURS, compagnons: [], format: "saint-martin", graine: "martin" });
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    assert.equal(publicBrut().phase, "fin");
    assert.ok(publicBrut().vainqueur);
    // « Rejouer » (mêmes joueurs) : encore une Saint-Martin ; la préparation ordinaire de la Table : une partie ordinaire.
    const rejoue = await M.api.nouvellePartie({ memesJoueurs: true });
    assert.equal(publicBrut().format, "saint-martin");
    assert.equal(rejoue.composition.autel?.length, 3);
    await M.MJ.distribuer({ ...M.MJ.nouvellePreparation(), coches: JOUEURS });
    assert.equal(publicBrut().format, "");
    assert.deepEqual(M.api.autel(), []);
  }
};

const MUTATIONS = [
  // les Gens de passage
  ["scripts/api.mjs", "    if (!v.ok) throw new Error(t(`LAKOUR_LOUPS.Passage.Refus.${v.raison}`));\n    const user = userId", "    const user = userId", "arrivée : vérifiée"],
  ["scripts/api.mjs", "const camp = L.campDePassage({ villageois: villageoisAPlat().filter(x => x.vivant !== false), peste: L.estPeste(avant), niveau: avant.aConsigner?.niveau ?? \"\" });", "const camp = \"village\";", "arrivée : le camp tiré"],
  ["scripts/api.mjs", "    if (camp === \"meute\") {\n      await envoyerMasques(", "    if (false) {\n      await envoyerMasques(", "arrivée : la meute prévenue"],
  ["scripts/api.mjs", "return L.journaliserSecret(L.journaliser(x, t(\"LAKOUR_LOUPS.Passage.Annonce\"", "return L.journaliser(L.journaliser(x, t(\"LAKOUR_LOUPS.Passage.Annonce\"", "arrivée : le camp au MJ seul"],
  ["scripts/api.mjs", "annoncer(\"lakourLoups.passage\", [{ acteurId: acteur.id, cle: choisie, comment: \"arrivee\" }]);", "annoncer(\"lakourLoups.passage\", [{ acteurId: acteur.id, cle: choisie, comment: \"arrivee\", camp }]);", "arrivée : hook sans camp"],
  ["scripts/api.mjs", "    if (deja && (avant.fiches?.[deja.id] || roleRevele(deja))) {", "    if (false) {", "arrivée : une fois"],
  ["scripts/api.mjs", "    await envoyerRole(acteur);\n    if (camp === \"meute\")", "    if (camp === \"meute\")", "arrivée : sa carte"],
  ["scripts/api.mjs", "const maison = L.maisonsDuVillage(prises.size + 1).find(m => !prises.has(m))", "const maison = L.maisonsDuVillage(prises.size + 1).find(() => true)", "arrivée : une maison libre"],
  ["scripts/apps/table.mjs", "        passage: gens.find(g => g.acteurId === a.id)?.role ?? \"\",", "        passage: \"\",", "Table : le rôle de passage"],
  // (0.9.0 : « Table : jamais le camp » ne se casse plus par la Table : le camp d'un gens de passage n'est dans aucun document ni
  // réglage livré au joueur — le non-fuite de essais/non-fuite.test.mjs le vérifie sur tout ce qu'il reçoit.)
  // départ et exil
  ["scripts/api.mjs", "    await acteur.update({ \"system.vivant\": false });\n    for (const [id, p]", "    for (const [id, p]", "départ : il quitte la partie"],
  ["scripts/api.mjs", "    for (const [id, p] of [...enAttente.entries()]) if (p.demande.acteurId === acteurId) terminer(id, [], true);\n", "", "départ : ses demandes closes"],
  ["scripts/api.mjs", ".filter(x => x.actorId === acteurId).map(x => x.id);", ".filter(() => false).map(x => x.id);", "départ : son jeton retiré"],
  ["scripts/api.mjs", "    await api.verifierVictoire();\n    await sceller();\n    return true;\n  },", "    await sceller();\n    return true;\n  },", "départ : la victoire vérifiée"],
  ["scripts/api.mjs", "  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;\n  try {\n    await api.partir(", "  if (!acteur || !user) return false;\n  try {\n    await api.partir(", "départ : pour soi"],
  ["scripts/api.mjs", "    annoncer(\"lakourLoups.depart\", [{ acteurId, comment: sorte }]);\n", "", "départ : hook public"],
  ["scripts/api.mjs", "      await api.partir(resultat.elu, { comment: \"exil\" });\n", "", "exil : l'élu part"],
  ["scripts/api.mjs", "      ids = L.candidatsExil(lireEtat(), villageoisAPlat());\n", "", "exil : les gens de passage"],
  ["scripts/socket.mjs", "    case \"depart\": return estMJActif() && recevoirDepart(pourMoi);\n", "", "départ : le socket"],
  ["scripts/apps/table.mjs", "exil: !v.ouvert && etat.phase === \"jour\" && L.candidatsExil(etat, villageoisAPlat()).length > 0", "exil: false", "Table : l'exil"],
  // le Banc des accusés
  ["scripts/socket.mjs", "    case \"accusation\": return estMJActif() && recevoirAccusation(pourMoi);\n", "", "banc : le socket"],
  ["scripts/api.mjs", "  if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;\n  try {\n    await api.accuser(", "  if (!acteur || !user) return false;\n  try {\n    await api.accuser(", "banc : pour soi"],
  ["scripts/api.mjs", "      L.inscrire(x.etat, { type: \"accusation\", acteurId: par, contre });\n", "", "banc : au Registre"],
  ["scripts/api.mjs", "    annoncer(\"lakourLoups.accusation\", [{ par, contre }]);\n", "", "banc : hook public"],
  ["scripts/api.mjs", "    await annonceChat(t(\"LAKOUR_LOUPS.Banc.Annonce\"", "    void (t(\"LAKOUR_LOUPS.Banc.Annonce\"", "banc : annoncé"],
  ["scripts/api.mjs", "      banc = L.prochainAccuse(lireEtat(), villageoisAPlat());", "      banc = Object.keys(lireEtat().banc.accusations)[0] ? lireEtat().banc.accusations[0].contre : \"\";", "banc : le prochain accusé"],
  ["scripts/api.mjs", "      if (banc) L.noterJugement(x, banc);\n", "", "banc : jugé une fois"],
  ["scripts/api.mjs", "c.resultat.elus.length ? \"LAKOUR_LOUPS.Banc.Condamne\" : \"LAKOUR_LOUPS.Banc.Acquitte\"", "\"LAKOUR_LOUPS.Banc.Condamne\"", "banc : le verdict annoncé"],
  ["scripts/apps/table.mjs", "      accusation = p ? { ok: p.ok,", "      accusation = p ? { ok: true,", "Table : ma permission d'accuser"],
  // le Glas du deuil
  ["scripts/api.mjs", "    if (cause === \"vote\") await sonnerLeDeuil(acteur);\n", "", "deuil : sonné à l'exécution"],
  ["scripts/api.mjs", "  annoncer(\"lakourLoups.deuil\", [{ compte: r.compte }]);", "  annoncer(\"lakourLoups.deuil\", [{ compte: r.compte, pouvoirs: r.etat.pouvoirsDeuil }]);", "deuil : hook vague"],
  ["scripts/api.mjs", "  for (const loup of tousLesVillageois().filter(a => a.system.vivant && campDe(a) === \"meute\")) {\n    await envoyerSecret(loup.id, { texte: t([", "  for (const loup of tousLesVillageois().filter(a => a.system.vivant)) {\n    await envoyerSecret(loup.id, { texte: t([", "deuil : aux loups seuls"],
  ["scripts/api.mjs", "  await annonceChat(echapper(t(\"LAKOUR_LOUPS.Deuil.Sonne\", { n: r.compte })));\n", "", "deuil : annoncé"],
  ["scripts/api.mjs", "      if (r.deuil) x.pouvoirsDeuil.visions = Math.max(0, x.pouvoirsDeuil.visions - 1);\n", "", "deuil : la vision consommée"],
  ["scripts/api.mjs", "      if (r.deuil) x.pouvoirsDeuil.visions", "      if (true) x.pouvoirsDeuil.visions", "deuil : consommée si délivrée"],
  ["scripts/api.mjs", "    demanderVoixDuDeuil(etat);\n    return foundry.utils.deepClone(L.etatPublic(etat).vote);", "    return foundry.utils.deepClone(L.etatPublic(etat).vote);", "voix : demandée à la meute"],
  ["scripts/api.mjs", "L.choisirVoixDuDeuil(e, { numero: v.numero, cible })", "L.choisirVoixDuDeuil(e, { numero: 0, cible })", "voix : le choix de CE vote"],
  ["scripts/api.mjs", "const loups = tousLesVillageois().filter(a => a.system.vivant && campDe(a) === \"meute\");\n  if (!loups.length || !candidats.length) return [];", "const loups = tousLesVillageois().filter(a => a.system.vivant);\n  if (!loups.length || !candidats.length) return [];", "voix : à la meute seule"],
  ["scripts/api.mjs", "finit: Date.now() + ms, ...(objet ? { objet } : {})", "finit: Date.now() + ms", "voix : l'objet de la demande"],
  ["scripts/api.mjs", "    if (L.estParti(avant, acteurId)) return false;\n", "", "départ : déjà parti, sans effet"],
  ["scripts/api.mjs", "    if (clos) {\n", "    if (false) {\n", "départ : le vote clos annoncé"],
  ["scripts/api.mjs", "format = format === undefined ? (L.estSaintMartin(avant) ? L.FORMAT_SAINT_MARTIN : \"\") : format;", "format = format ?? \"\";", "rejouer : le format"],
  ["scripts/api.mjs", "const anciens = tousLesVillageois().filter(a => !partis.has(a.id));", "const anciens = tousLesVillageois();", "rejouer : sans les partis"],
  ["scripts/api.mjs", "    for (const a of tousLesVillageois().filter(x => partis.has(x.id))) {", "    for (const a of []) {", "rejouer : les villageois des partis"],
  ["scripts/actions-mj.mjs", "niveau: prep.niveau, format: \"\",", "niveau: prep.niveau,", "préparation : une partie ordinaire"],
  ["scripts/api.mjs", "    if (roleCle === L.CLE_DEUIL) return reveillerLeDeuil(entree, { delai: ms });\n", "", "deuil : le réveil de la meute"],
  ["scripts/api.mjs", "await api.noterAction({ acteurId: entree.acteurIds[0], roleCle: L.CLE_DEUIL, cibles, effet: \"deuil\" });", "await api.noterAction({ acteurId: entree.acteurIds[0], roleCle: L.CLE_DEUIL, cibles });", "deuil : la vision notée"],
  ["scripts/api.mjs", "cibles = await demanderALaMeute({ invite: t(\"LAKOUR_LOUPS.Deuil.Invite\"), candidats, delai, objet: \"deuil-vision\" });", "cibles = [];", "deuil : la vision demandée"],
  ["scripts/api.mjs", "c.resultat.deuil ? t(\"LAKOUR_LOUPS.Deuil.Voix\", { nom: nom(c.resultat.deuil) }) : \"\"", "\"\"", "deuil : la voix annoncée"],
  ["scripts/api.mjs", "      e.deuil = L.deuilInitial(!court && lireReglage(\"glasDuDeuil\", false));", "      e.deuil = L.deuilInitial(!court);", "deuil : le réglage"],
  // la Nuit de la Saint-Martin
  ["scripts/api.mjs", "      e.autel = court ? [...autel] : [];", "      e.autel = [];", "saint-martin : l'autel gardé"],
  ["scripts/api.mjs", "      e.banc = L.bancInitial(!court && lireReglage(\"banc\", false) && !choixVariantes.chaine);", "      e.banc = L.bancInitial(lireReglage(\"banc\", false) && !choixVariantes.chaine);", "saint-martin : sans Banc"],
  ["scripts/api.mjs", "      e.deuil = L.deuilInitial(!court && lireReglage(\"glasDuDeuil\", false));", "      e.deuil = L.deuilInitial(lireReglage(\"glasDuDeuil\", false));", "saint-martin : sans glas"],
  ["scripts/api.mjs", "      e.presage = L.presageInitial(!court && lireReglage(\"almanach\", false));", "      e.presage = L.presageInitial(lireReglage(\"almanach\", false));", "saint-martin : sans Almanach"],
  ["scripts/api.mjs", "    if (court) await annonceChat(echapper(t(\"LAKOUR_LOUPS.SaintMartin.Annonce\"", "    if (false) await annonceChat(echapper(t(\"LAKOUR_LOUPS.SaintMartin.Annonce\"", "saint-martin : annoncée"],
  ["scripts/api.mjs", "      if (L.estSaintMartin(e) && e.tour >= 1 && !e.vainqueur && await api.verifierVictoire({ finDuJour: true })) return foundry.utils.deepClone(lireEtat());\n", "", "saint-martin : pas de seconde nuit"],
  ["scripts/api.mjs", "const saintMartin = L.estSaintMartin(e) ? (L.saintMartinFinie(e, villageoisAPlat()) || (finDuJour && e.tour >= 1)) : null;", "const saintMartin = null;", "saint-martin : sa fin"],
  ["scripts/api.mjs", "const saintMartin = L.estSaintMartin(e) ? (L.saintMartinFinie(e, villageoisAPlat()) || (finDuJour && e.tour >= 1)) : null;", "const saintMartin = L.estSaintMartin(e) ? true : null;", "saint-martin : rien avant le vote"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-lot3-api-"));
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

test("lot 3 (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("lot 3 (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
