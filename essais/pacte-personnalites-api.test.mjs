// Le Pacte, étape 4 : la variante « Le Village » dans l'API du système (game.lakourLoups), sur la doublure de Foundry. La distribution
// (les bâtiments confiés et les Chemineaux annoncés, publics ; le narrateur change la proposition) ; le Prieur (la carte au seul
// carnet du Prieur, une fois) ; le Régent (ses privés et lui-même ne votent pas) ; le Perruquier (sa méprise lui coûte la vie) ; le
// Cabaretier (ni proie ni candidat, son vote public, l'immunité perdue) ; le Hobereau (la supplique, la grâce : pas d'exécution, carte
// cachée) ; le Prévôt (il loge un Chemineau, qui accepte ou refuse ; le pouvoir rétabli) ; les Métayers (le Bailli le deuxième jour, par
// eux et parmi eux ; la succession ; le dernier mort, plus de Bailli) ; la Fournière (un loup entrevu, à son seul carnet) ;
// l'Incendiaire (la maison de la proie brûle : pas de victime, le loup à droite carbonisé, l'occupant Chemineau). Chaque vérification est
// rejouée sur des copies mutées du système (une règle cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, envoyerAuMJ, calme, messages } from "./doublures/foundry-loups.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, attendreVacances: api.attendreVacances, socket, reglages: reglagesM, L, racine };
}

async function monde(M) {
  installerFoundry({ joueurs: 7, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 1);
  await game.settings.set("lakour-loups", "masques", false);
  await game.settings.set("lakour-loups", "bailli", false);
  await game.settings.set("lakour-loups", "dernierSouffle", false);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    incendiaire: role("Incendiaire", { cle: "incendiaire", effet: "incendier", usages: { max: 1, restant: 1 },
      nuit: { actif: true, ordre: 19, cibles: 1, soiMeme: true, invite: "Quel bâtiment livres-tu aux flammes ?" } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const de = c => villageois().find(a => cle(a) === c);
const tous = c => villageois().filter(a => cle(a) === c);
const cinq = U => [U.villageois, U.villageois, U.villageois, U.villageois, U.villageois];
async function partie(M, roles, { village = true, graine = "le-village" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine, composition: "essai", batiments: [], village });
}
// Le village imposé pour l'essai, par l'outil du narrateur (api.installer) : tous les bâtiments vidés, puis { cle: acteur }.
async function loger(M, plan) {
  for (const b of M.api.village().batiments) if (b.acteurId) await M.api.installer(b.cle, "");
  for (const [c, a] of Object.entries(plan)) await M.api.installer(c, a.id);
}
// Le cercle des places, imposé pour l'essai (il est public : l'état du réglage monde « partie »).
async function asseoir(ordre) {
  const pub = game.settings.get("lakour-loups", "partie");
  await game.settings.set("lakour-loups", "partie", { ...pub, cercle: ordre.map(a => a.id) });
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandeDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id).at(-1);
const repondre = (demande, ids) => envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: ids, userId: demande.destinataire }, { emetteur: demande.destinataire });
async function repondreA(acteur, ids, k, message) {
  await attendre(() => demandeDe(acteur, k), message);
  const d = demandeDe(acteur, k);
  repondre(d, ids);
  return d;
}
const carnetDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "");
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;/g, "'")).join("\n");
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
async function nuitCalme(M, actions = []) {
  await M.api.changerPhase("nuit");
  for (const a of actions) await M.api.noterAction(a);
  await M.api.changerPhase("aube");
  const r = await M.api.resoudreNuit({ chuchoter: true });
  await M.api.changerPhase("jour");
  return r;
}

const VERIFICATIONS = {
  async "distribution : les bâtiments confiés devant tous, les Chemineaux annoncés ; le narrateur change la proposition avant la nuit"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)], { village: false });
    assert.equal(M.api.village().actif, false, "sans la variante (réglage par défaut)");
    assert.deepEqual(game.settings.get("lakour-loups", "partie").tenures, {});
    const n = messages.length;
    await partie(M, [U.loup, ...cinq(U)]);
    const v = M.api.village();
    assert.equal(v.actif, true);
    assert.equal(v.batiments.filter(b => b.acteurId).length, 5, "cinq bâtiments pour six places");
    assert.equal(v.chemineaux.length, 1, "un Chemineau");
    assert.equal(Object.values(game.settings.get("lakour-loups", "partie").tenures).filter(Boolean).length, 5, "qui tient quoi est public");
    assert.match(chat(n), /Le Village : .+ tient /);
    assert.match(chat(n), /Chemineaux : /);
    assert.ok(M.api.registre().some(x => x.type === "village" && x.quoi === "distribution"));
    const chemineau = game.actors.get(v.chemineaux[0].acteurId);
    const prieur = game.actors.get(v.batiments.find(b => b.cle === "prieure").acteurId);
    const k = messages.length;
    await M.api.installer("prieure", chemineau.id);
    assert.equal(M.api.personnalite(chemineau.id).personnalite, "prieur");
    assert.equal(M.api.personnalite(prieur.id).personnalite, "chemineau", "l'ancien Prieur n'a plus de toit");
    assert.match(chat(k), /Changement au village : .+ tient désormais Le Prieuré \(Prieur\)/);
    // Un joueur qui tenait déjà un bâtiment l'échange avec l'occupant de celui qu'il reçoit.
    const cabaretier = game.actors.get(M.api.village().batiments.find(b => b.cle === "cabaret").acteurId);
    await M.api.installer("cabaret", chemineau.id);
    assert.equal(M.api.personnalite(chemineau.id).personnalite, "cabaretier");
    assert.equal(M.api.personnalite(cabaretier.id).personnalite, "prieur", "un échange");
  },

  async "Prieur : la carte montrée au seul carnet du Prieur, l'annonce à tous ; une fois"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [p, x] = tous("villageois");
    await loger(M, { prieure: p, "metairie-1": x });
    await M.api.changerPhase("jour");
    const k = emissions.length, n = messages.length;
    await M.api.agirDeJour({ acteurId: p.id, pouvoir: "prieure", cibles: [loup.id] });
    assert.ok(carnetDe(p, k).some(t => t.includes(`${loup.name} vous a montré sa carte : Loup de Brumecombe`)), "au carnet du Prieur");
    assert.deepEqual(carnetDe(x, k), [], "personne d'autre");
    assert.match(chat(n), /le Prieur, fait venir/);
    assert.doesNotMatch(chat(n), /Loup de Brumecombe/, "la carte reste secrète");
    assert.ok(M.api.registre().some(x => x.type === "village" && x.quoi === "prieur"));
    await assert.rejects(M.api.agirDeJour({ acteurId: p.id, pouvoir: "prieure", cibles: [x.id] }), /déjà servi/);
  },

  async "Régent : ses privés de vote et lui-même ne votent pas ce jour-là"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [r, x, y] = tous("villageois");
    await loger(M, { ecole: r, prieure: x, "metairie-1": y });
    await M.api.changerPhase("jour");
    const n = messages.length;
    await M.api.agirDeJour({ acteurId: r.id, pouvoir: "ecole", cibles: [x.id] });
    assert.match(chat(n), /le Régent, met au coin/);
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().map(a => [a, loup]));
    const res = await M.api.cloreVote();
    assert.ok(!(r.id in res.votes) && !(x.id in res.votes), "ni le Régent ni son privé");
    assert.ok(y.id in res.votes);
  },

  async "Perruquier : un innocent rasé, le Perruquier tombe aussi ; un loup rasé, il est félicité"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    let [pe, x] = tous("villageois");
    await loger(M, { echoppe: pe, prieure: x });
    await M.api.changerPhase("jour");
    const n = messages.length;
    await M.api.agirDeJour({ acteurId: pe.id, pouvoir: "echoppe", cibles: [x.id] });
    assert.equal(x.system.vivant, false);
    assert.equal(pe.system.vivant, false, "sa méprise lui coûte la vie");
    assert.equal(M.api.etat().morts.find(m => m.acteurId === x.id).cause, "rasoir");
    assert.match(chat(n), /n'était pas un loup/);
    await partie(M, [U.loup, ...cinq(U)], { graine: "le-village-2" });
    const loup = de("loup-de-brumecombe");
    [pe] = tous("villageois");
    await loger(M, { echoppe: pe, prieure: loup });
    await M.api.changerPhase("jour");
    await M.api.agirDeJour({ acteurId: pe.id, pouvoir: "echoppe", cibles: [loup.id] });
    assert.equal(loup.system.vivant, false);
    assert.equal(pe.system.vivant, true, "félicité");
  },

  async "Cabaretier : la meute repart bredouille, il n'est pas candidat ; son vote public contre le condamné lui coûte l'immunité"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [c, x] = tous("villageois");
    await loger(M, { cabaret: c, prieure: x });
    const r1 = await nuitCalme(M, [{ acteurId: loup.id, roleCle: "meute", cibles: [c.id] }]);
    assert.deepEqual(r1.morts, [], "la meute ne peut pas le dévorer");
    const vote = await M.api.ouvrirVote({ duree: 0 });
    assert.ok(!vote.candidats.includes(c.id), "pas candidat");
    const n = messages.length;
    await voter([[c, x]]);
    assert.match(chat(n), new RegExp(`${c.name}, le Cabaretier, vote à découvert contre ${x.name}`));
    await voter(villageois().filter(a => a.id !== c.id).map(a => [a, x]));
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [x.id]);
    assert.match(chat(n), /perd son immunité/);
    assert.equal(M.api.etat().village.epuises.cabaret, c.id);
  },

  async "Hobereau : le condamné le supplie, il le gracie — pas d'exécution, carte cachée ; une fois"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [h, x, y] = tous("villageois");
    await loger(M, { manoir: h, prieure: x, "metairie-1": y });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().map(a => [a, x]));
    const k = emissions.length, n = messages.length;
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [x.id]);
    const supplique = await repondreA(x, [h.id], k, "la supplique du condamné");
    assert.deepEqual(supplique.candidats.map(c => c.id), [h.id]);
    await repondreA(h, [x.id], k, "la grâce demandée au Hobereau");
    assert.deepEqual(await M.api.eliminer(x.id, { cause: "vote" }), [], "gracié");
    assert.ok(x.system.vivant && !x.system.revele, "vivant, carte cachée");
    assert.match(chat(n), /le Hobereau, gracie/);
    assert.notEqual(M.api.etapeSuivante().cle, "executer");
    // Une fois : le lendemain, plus de supplique.
    await nuitCalme(M);
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().filter(a => a.system.vivant).map(a => [a, y]));
    const k2 = emissions.length;
    await M.api.cloreVote();
    await M.api.eliminer(y.id, { cause: "vote" });
    assert.equal(y.system.vivant, false);
    assert.equal(demandeDe(y, k2), undefined, "son pouvoir a servi");
    void loup;
  },

  async "Prévôt : un bâtiment libéré, il loge un Chemineau qui accepte (le pouvoir rétabli) ; un refus le laisse vide"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [pv, p, x, y] = tous("villageois");
    await loger(M, { prevote: pv, prieure: p });
    await M.api.changerPhase("jour");
    await M.api.agirDeJour({ acteurId: p.id, pouvoir: "prieure", cibles: [loup.id] });
    const k = emissions.length, n = messages.length;
    await M.api.eliminer(p.id, { cause: "narrateur" });
    const d = await repondreA(pv, [x.id], k, "la demande au Prévôt");
    assert.ok(d.candidats.some(c => c.id === x.id) && !d.candidats.some(c => c.id === pv.id), "des Chemineaux");
    await repondreA(x, [x.id], k, "le logement offert au Chemineau");
    await M.attendreVacances();
    assert.equal(M.api.personnalite(x.id).personnalite, "prieur");
    assert.equal(M.api.pouvoirsDeJour(x.id).find(q => q.pouvoir === "prieure")?.possible, true, "son pouvoir, entier");
    assert.match(chat(n), /le Prévôt, loge/);
    const k2 = emissions.length, n2 = messages.length;
    await M.api.eliminer(x.id, { cause: "narrateur" });
    await repondreA(pv, [y.id], k2, "la seconde demande au Prévôt");
    await repondreA(y, [], k2, "le logement refusé");
    await M.attendreVacances();
    assert.equal(M.api.personnalite(y.id).personnalite, "chemineau");
    assert.match(chat(n2), /refuse Le Prieuré/);
  },

  async "Métayers : le Bailli le deuxième jour, par eux et parmi eux ; la succession parmi eux ; le dernier mort, plus de Bailli"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, ...cinq(U)]);
    const [f, g, autre] = tous("villageois");
    await loger(M, { "metairie-1": f, "metairie-2": g, prieure: autre });
    assert.equal(M.api.etat().bailli.actif, true);
    await M.api.changerPhase("jour");
    assert.equal(M.api.bailli().election.raison, "jourDeux");
    await nuitCalme(M);
    assert.equal(M.api.bailli().election.raison, "jourDeux", "le premier jour, pas encore");
    await nuitCalme(M);
    assert.equal(M.api.bailli().election.ok, true, "le deuxième jour");
    const vote = await M.api.ouvrirVote({ objet: "bailli", duree: 0 });
    assert.deepEqual([...vote.candidats].sort(), [f.id, g.id].sort(), "parmi eux");
    await voter([[autre, g], [f, f], [g, f]]);
    const r = await M.api.cloreVote();
    assert.equal(r.bailli, f.id);
    assert.ok(!(autre.id in r.votes), "par eux seuls");
    // (La succession ne demande rien s'il reste moins d'une seconde du délai des choix.)
    await game.settings.set("lakour-loups", "delaiChoix", 3);
    const k = emissions.length;
    await M.api.eliminer(f.id, { cause: "narrateur" });
    const d = await repondreA(f, [g.id], k, "la succession");
    assert.deepEqual(d.candidats.map(c => c.id), [g.id], "parmi les Métayers vivants");
    await attendre(() => M.api.bailli().acteurId === g.id, "le sceau remis");
    const n = messages.length;
    await M.api.eliminer(g.id, { cause: "narrateur" });
    assert.equal(M.api.etat().bailli.actif, false, "plus de Bailli");
    assert.match(chat(n), /dernier Métayer/);
  },

  async "Fournière : au matin, un loup entrevu, à son seul carnet ; certaines nuits, rien"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...cinq(U)]);
    const loup = de("loup-de-brumecombe");
    const [fo, x] = tous("villageois");
    await loger(M, { fournil: fo, prieure: x });
    const hasard = Math.random;
    let k = emissions.length;
    try { Math.random = () => 0; await nuitCalme(M); } finally { Math.random = hasard; }
    assert.ok(carnetDe(fo, k).some(t => t.includes(`${loup.name} qui rentre chez lui`)), "elle l'a entrevu");
    assert.deepEqual(carnetDe(x, k), []);
    k = emissions.length;
    try { Math.random = () => 0.99; await nuitCalme(M); } finally { Math.random = hasard; }
    assert.ok(!carnetDe(fo, k).some(t => /qui rentre chez lui/.test(t)), "rien");
  },

  async "Incendiaire : la maison de la proie brûle — pas de victime, le loup à droite carbonisé, l'occupant devient Chemineau"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, U.incendiaire, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loupA, loupB] = tous("loup-de-brumecombe");
    const inc = de("incendiaire");
    const [proie, v1, v2, v3] = tous("villageois");
    await asseoir([loupA, proie, loupB, inc, v1, v2, v3]);
    await loger(M, { prieure: proie, ecole: v1 });
    await M.api.changerPhase("nuit");
    const cand = M.api.candidatsDeNuit({ acteurId: inc.id, roleCle: "incendiaire" });
    assert.deepEqual([...cand].sort(), [proie.id, v1.id].sort(), "des occupants, pas des Chemineaux");
    await M.api.noterAction({ acteurId: loupA.id, roleCle: "meute", cibles: [proie.id] });
    await M.api.noterAction({ acteurId: inc.id, roleCle: "incendiaire", cibles: [proie.id] });
    await M.api.changerPhase("aube");
    const n = messages.length;
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [loupB.id], "le premier loup à la droite de la proie");
    assert.ok(proie.system.vivant && loupA.system.vivant);
    assert.equal(game.settings.get("lakour-loups", "partie").morts.find(m => m.acteurId === loupB.id)?.cause, "incendie", "une cause publique");
    assert.equal(M.api.personnalite(proie.id).personnalite, "chemineau");
    assert.deepEqual(M.api.etat().village.detruits, ["prieure"]);
    assert.ok(!("prieure" in M.api.etat().tenures), "détruit pour toujours");
    assert.match(chat(n), /Le Prieuré a brûlé/);
    assert.match(chat(n), /Les flammes ont surpris la meute/);
    assert.equal(roleDe(inc).system.usages.restant, 0, "une fois");
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    assert.ok(!M.api.ordreDeNuit().some(e => e.roleCle === "incendiaire"), "plus de réveil");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "      e.tenures = { ...tenuresDuVillage };", "      e.tenures = {};", "distribution : les bâtiments confiés"],
  ["scripts/api.mjs", "    if (enVillage) await annoncerAuVillage(texteDuVillage(lireEtat()), { quoi: \"distribution\", ids: Object.values(lireEtat().tenures).filter(Boolean) });\n", "", "distribution : annoncée"],
  ["scripts/api.mjs", "      if (sien && sien !== cle) L.installer(e, sien, ancien || null);\n", "", "changement : un échange"],
  ["scripts/api.mjs", "      if (x.village) L.inscrire(etat, { type: \"village\", ...x.village });\n", "", "Registre : les pouvoirs des personnalités"],
  ["scripts/api.mjs", "      for (const m of r.morts) await api.eliminer(m.acteurId, { cause: m.cause });\n", "", "Perruquier : le rasoir"],
  ["scripts/api.mjs", "    ids = L.candidatsDuVillage(lireEtat(), ids, objet);\n", "", "Cabaretier : pas candidat"],
  ["scripts/api.mjs", "      immunises: L.immunisesDeLaNuit(avant, villageoisAPlat()), ", "      immunises: [], ", "Cabaretier : la nuit"],
  ["scripts/api.mjs", "    await publierLeVoteDuCabaretier(votant, cible || \"\", r.etat.vote.numero);\n", "", "Cabaretier : le vote public"],
  ["scripts/api.mjs", "    await perdreLImmunite(resultat);\n", "", "Cabaretier : l'immunité perdue"],
  ["scripts/api.mjs", "    proposerLaGrace(resultat);\n", "", "Hobereau : la supplique"],
  ["scripts/api.mjs", "    if (cause === \"vote\" && await graceDuHobereau(acteurId)) {", "    if (false) {", "Hobereau : la grâce"],
  ["scripts/api.mjs", "    suivreVacances();   // Le Village : ses bâtiments libérés attendent le Prévôt\n", "", "Prévôt : après une mort"],
  ["scripts/api.mjs", "      if (fait) L.installer(e, cle, choisi);", "      if (false) L.installer(e, cle, choisi);", "Prévôt : le logement"],
  ["scripts/api.mjs", "        accepte = oui === choisi;", "        accepte = true;", "Prévôt : le Chemineau peut refuser"],
  ["scripts/api.mjs", "    if (objet === \"bailli\" && L.villageActif(lireEtat())) ids = ids.filter(id => L.candidatsElection(lireEtat(), villageoisAPlat()).includes(id));\n", "", "Métayers : parmi eux"],
  ["scripts/api.mjs", "    await abolirSansMetayer(acteurId, etaitMetayer);\n", "", "Métayers : le dernier mort"],
  ["scripts/api.mjs", "      if (game.actors.get(x.acteurId)?.system.vivant) messages.push(", "      if (false) messages.push(", "Fournière : au carnet"],
  ["scripts/api.mjs", "    const incendies = await brulerLesBatiments(r.incendies ?? []);", "    const incendies = [];", "Incendiaire : le bâtiment brûlé"],
  ["scripts/api.mjs", "      batimentsTenus: Object.fromEntries(", "      batimentsTenus: {}, _rien: Object.fromEntries(", "Incendiaire : les bâtiments de la nuit"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-personnalites-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally {
      game.user = game.users.get("mj");
      await calme().catch(() => {});
      await M.attendreGestes().catch(() => {});
      await M.attendreVacances().catch(() => {});
    }
  }
  return liste;
}

test("Pacte, étape 4 (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 4 (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
