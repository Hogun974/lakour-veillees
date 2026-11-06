// Le lot « Bailli, Registre du greffier, Masques de veillée » dans l'API du système (game.lakourLoups) et ce que voit chacun,
// sur la doublure de Foundry : l'élection (vote dédié, étape du MJ humain, réglage), la voix double, le départage demandé au
// seul Bailli (joueur par le socket, compagnon IA par son résolveur), la succession à sa mort (demande posthume, après toutes
// les morts de la nuit ; vacance sans réponse) ; le Registre (votes clos voix par voix, morts avec leur cause publique,
// déclarations par le socket pour soi seulement, refus expliqués au seul auteur) ; les Masques (au carnet de chaque loup et de lui
// seul, des rôles du Village absents, jamais publics ; ni en peste noire, ni réglage coupé ; au mordu) ; le bandeau, la Table,
// l'infobulle et le sceau du jeton. Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).
// Lancer : npm run essais
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
const B = FR.LAKOUR_LOUPS.Bailli;
const R = FR.LAKOUR_LOUPS.Registre;

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, bandeau, local, table, infobulle, MJ, coffre] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"),
    m("scripts/reglages.mjs"), m("logique/index.mjs"), m("scripts/apps/bandeau.mjs"), m("scripts/plateau-local.mjs"), m("scripts/apps/table.mjs"),
    m("scripts/infobulle.mjs"), m("scripts/actions-mj.mjs"), m("scripts/coffre.mjs")]);
  return { api: api.api, socket, reglages: reglagesM, L, bandeau, local, table, infobulle, MJ, coffre, racine };
}

// La page du MJ rechargée (F5) : une nouvelle instance des modules (mémoire vide), mêmes réglages et documents du monde ; elle
// écoute le socket, et l'ancienne page ne répond plus (sa demande reste sans suite, comme un onglet fermé).
const dossiersARetirer = [];
async function recharger(M) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-bailli-recharge-"));
  dossiersARetirer.push(dossier);
  cpSync(join(M.racine, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(M.racine, "scripts"), join(dossier, "scripts"), { recursive: true });
  const M2 = await charger(dossier);
  M2.socket.ecouterSocket();
  game.lakourLoups = M2.api;
  return M2;
}
const sansFin = p => { p.catch(() => {}); return p; };

// Un monde : six joueurs simulés à la main, des rôles du monde (dont des rôles du Village qui ne seront pas distribués).
async function monde(M, { bailli = true, masques = true, delai = 2 } = {}) {
  installerFoundry({ joueurs: 6 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  M.local.remettreAZero();
  delete globalThis.canvas;
  // Court, pour qu'une demande oubliée ne tienne pas l'essai longtemps ; plus long dans les essais de rechargement, où la
  // copie et l'import des fichiers peuvent prendre plusieurs secondes sur une machine chargée.
  await game.settings.set("lakour-loups", "delaiChoix", delai);
  await game.settings.set("lakour-loups", "bailli", bailli);
  await game.settings.set("lakour-loups", "masques", masques);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    louve: role("Louve mère", { cle: "louve-mere", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41 } }),
    garde: role("Garde du pont", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }),
    pecheur: role("Pêcheur de nuit", { cle: "pecheur-de-nuit", effet: "tuer", description: "<p>Une fois par partie, il harponne un villageois.</p>",
      nuit: { actif: true, ordre: 48 }, usages: { max: 1, restant: 1 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-camp", description: "<p>Elle lit le camp d'un villageois.</p>", nuit: { actif: true, ordre: 60 } }),
    sourcier: role("Sourcier", { cle: "sourcier", effet: "voir-camp", nuit: { actif: true, ordre: 62 } }),
    pyromane: role("Pyromane", { cle: "pyromane", camp: "solitaire", effet: "asperger", victoireCle: "dernier-survivant", nuit: { actif: true, ordre: 55 } }),
    forgeron: creerObjetMonde("Forgeron", "metier", { cle: "forgeron" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
const cle = a => roleDe(a).system.cle;

// Une partie ordinaire : deux loups, un Garde, trois villageois (u1…u6). roles : pour en changer.
async function partie(M, U, roles = [U.loup, U.loup, U.garde, U.villageois, U.villageois, U.villageois], extra = {}) {
  await M.api.distribuer({ roles, metiers: [U.forgeron], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "bailli", composition: "essai", batiments: [], ...extra });
  const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute");
  const autres = villageois().filter(a => secretDuMJ.camp(a) !== "meute");
  return { loups, autres };
}
// Les votes de joueurs, par le socket (l'émetteur fait foi).
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
// Attend une condition (la demande partie, la succession faite) sans dormir.
async function attendre(condition, message) {
  for (let i = 0; i < 3000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandeDe = (acteur, depuis = 0) => emissions.slice(depuis).findLast(e => e.type === "demande" && e.acteurId === acteur.id);
function repondre(demande, cibles, qui = demande.destinataire) {
  envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: cibles.map(a => a.id), userId: qui }, { emetteur: qui });
}
// Élit un Bailli par le vote dédié (tout le monde vote pour lui).
async function elire(M, elu) {
  await M.api.changerPhase("jour");
  await M.api.ouvrirVote({ objet: "bailli", duree: 0 });
  await voter(villageois().filter(a => a.system.vivant).map(a => [a, elu]));
  return M.api.cloreVote();
}
// Rien des Masques ne sort de la meute : réglage monde, hooks, messages du socket adressés à d'autres qu'un loup.
function masquesCaches(noms, depuis = 0) {
  const pub = JSON.stringify(publicBrut());
  for (const nom of noms) assert.ok(!pub.includes(nom), `${nom} dans l'état public`);
  const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute").map(a => a.system.joueur);
  for (const e of emissions.slice(depuis)) {
    const texte = JSON.stringify(e);
    if (!noms.some(n => texte.includes(n))) continue;
    assert.ok(e.recipients?.length === 1 && loups.includes(e.recipients[0]), `${e.type} hors de la meute : ${texte.slice(0, 200)}`);
  }
}

const VERIFICATIONS = {
  async "élection du Bailli : étape proposée, vote dédié, élu installé et annoncé ; pas de second Bailli"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U);
    assert.equal(publicBrut().bailli.actif, true, "le réglage passe dans l'état public");
    await M.api.changerPhase("jour");
    assert.equal(M.api.etapeSuivante().cle, "bailli", "l'étape du MJ humain");
    const n = emissions.length, c = messages.length;
    await M.MJ.faireEtape(M.api.etapeSuivante());
    assert.equal(M.api.etat().vote.objet, "bailli");
    assert.equal(M.api.etat().phase, "jour", "l'élection se tient au débat, sans changer de phase");
    assert.ok(!emissions.slice(n).some(e => e.type === "hook" && e.nom === "lakourLoups.phase"), "ni ambiance ni mise en scène du vote");
    assert.deepEqual(emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.voteOuvert")?.args[0],
      { objet: "bailli", numero: M.api.etat().vote.numero });
    assert.equal(M.api.etapeSuivante().cle, "cloreVote");
    const [elu, autre] = autres;
    await voter([[autres[0], elu], [autres[1], elu], [autres[2], autre]]);
    const r = await M.api.cloreVote();
    assert.deepEqual([r.objet, r.bailli, r.sort], ["bailli", elu.id, false]);
    assert.equal(publicBrut().bailli.acteurId, elu.id, "public");
    assert.equal(M.api.bailli().nom, elu.name);
    const hook = emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.bailli");
    assert.deepEqual(hook.args[0], { acteurId: elu.id, comment: "election" });
    assert.ok(messages.slice(c).some(m => m.content.includes(B.Elu.replace("{nom}", elu.name))));
    assert.equal(M.api.etapeSuivante().cle, "ouvrirVote", "puis le vote d'exécution");
    await assert.rejects(() => M.api.ouvrirVote({ objet: "bailli" }), e => e.message === B.Refus.bailli);
  },

  async "réglage coupé : pas de Bailli, ni étape ni élection ; une peste noire a son Bailli comme les autres"(M) {
    let U = await monde(M, { bailli: false });
    await partie(M, U);
    await M.api.changerPhase("jour");
    assert.equal(publicBrut().bailli.actif, false);
    assert.equal(M.api.etapeSuivante().cle, "ouvrirVote");
    await assert.rejects(() => M.api.ouvrirVote({ objet: "bailli" }), e => e.message === B.Refus.inactif);
    U = await monde(M);
    await partie(M, U, undefined, { peste: true });
    assert.equal(publicBrut().bailli.actif, true, "rien ne distingue une peste");
  },

  async "voix double du Bailli au vote d'exécution, au Registre aussi"(M) {
    const U = await monde(M);
    const { loups, autres } = await partie(M, U);
    const [bailli, x] = autres;
    await elire(M, bailli);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[bailli, loups[0]], [x, loups[1]]]);
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [loups[0].id]);
    assert.equal(r.decompte[loups[0].id], 2);
    const ligne = M.api.registre().at(-1);
    assert.equal(ligne.type, "vote");
    assert.deepEqual(ligne.votes, { [bailli.id]: loups[0].id, [x.id]: loups[1].id });
    assert.ok(ligne.ligne.includes(R.VoixDouble.replace("{qui}", bailli.name).replace("{cible}", loups[0].name)), ligne.ligne);
  },

  async "égalité : le Bailli tranche par une demande à lui seul ; un autre ne répond pas à sa place"(M) {
    const U = await monde(M);
    const { loups, autres } = await partie(M, U);
    const [bailli, x, y] = autres;
    await elire(M, bailli);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    const n = emissions.length;
    const clos = M.api.cloreVote();
    await attendre(() => demandeDe(bailli, n), "la demande au Bailli");
    const d = demandeDe(bailli, n);
    assert.deepEqual(d.recipients, [bailli.system.joueur], "au seul Bailli");
    assert.deepEqual(d.candidats.map(c => c.id).sort(), [loups[0].id, loups[1].id].sort(), "parmi les ex aequo");
    assert.equal(d.objet, "departage");
    assert.equal(publicBrut().vote.resultat.departage.enAttente, true, "le village sait que le Bailli tranche");
    assert.equal(M.api.etapeSuivante().cle, "departage");
    repondre(d, [loups[0]], x.system.joueur);        // x se fait passer pour le Bailli : refusé
    repondre(d, [loups[1]]);
    const r = await clos;
    assert.deepEqual(r.elus, [loups[1].id]);
    assert.deepEqual(r.departage.choix, [loups[1].id]);
    assert.deepEqual(M.api.registre().at(-1).departage, { par: bailli.id, choix: [loups[1].id] });
    assert.ok(messages.some(m => m.content.includes(B.Tranche.replace("{nom}", bailli.name).replace("{noms}", loups[1].name))));
    // Il passe : personne.
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, autres[2]]]);
    const m = emissions.length;
    const clos2 = M.api.cloreVote();
    await attendre(() => demandeDe(bailli, m), "la seconde demande");
    repondre(demandeDe(bailli, m), []);
    assert.deepEqual((await clos2).elus, []);
  },

  async "un compagnon IA Bailli tranche par son résolveur"(M) {
    const U = await monde(M);
    const vues = [];
    M.api.resolveurs.compagnon = d => { vues.push(d); return d.objet === "departage" ? [d.candidats.at(-1).id] : []; };
    await M.api.distribuer({ roles: [U.loup, U.loup, U.garde, U.villageois, U.villageois, U.villageois], joueurs: ["u1", "u2", "u3", "u4", "u5"],
      compagnons: ["Ysaline"], graine: "compagnon", batiments: [] });
    const ia = villageois().find(a => a.system.compagnon);
    const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute");
    const [x, y] = villageois().filter(a => secretDuMJ.camp(a) !== "meute" && a.system.joueur);
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(ia.id);
    assert.equal(publicBrut().bailli.acteurId, ia.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    const r = await M.api.cloreVote();
    const d = vues.find(v => v.objet === "departage");
    assert.ok(d, "le résolveur reçoit la demande de départage");
    assert.equal(d.acteurId, ia.id);
    assert.deepEqual(r.elus, [d.candidats.at(-1).id]);
  },

  async "mort du Bailli : il remet le sceau à un vivant (demande posthume) ; sans réponse, la charge est vacante"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U, [U.loup, U.garde, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [bailli, x, y] = autres;
    await elire(M, bailli);
    let n = emissions.length;
    await M.api.eliminer(bailli.id, { cause: "vote" });
    assert.deepEqual([publicBrut().bailli.succession.de, publicBrut().bailli.succession.tour], [bailli.id, 0], "public : le sceau attend");
    assert.equal(M.api.etapeSuivante().cle, "succession", "on attend le sceau");
    await attendre(() => demandeDe(bailli, n), "la demande posthume");
    const d = demandeDe(bailli, n);
    assert.equal(d.posthume, true);
    assert.equal(d.objet, "succession");
    assert.deepEqual(d.recipients, [bailli.system.joueur]);
    assert.ok(d.candidats.every(c => game.actors.get(c.id).system.vivant) && !d.candidats.some(c => c.id === bailli.id), "des vivants");
    repondre(d, [x]);
    await attendre(() => publicBrut().bailli.acteurId === x.id, "le successeur");
    assert.equal(M.api.registre().at(-1).comment, "succession");
    assert.ok(messages.some(m => m.content.includes(B.Succession.replace("{de}", bailli.name).replace("{nom}", x.name))));
    // Le successeur meurt, et passe : vacance ; le village élira un nouveau Bailli.
    n = emissions.length;
    await M.api.eliminer(x.id, { cause: "vote" });
    await attendre(() => demandeDe(x, n), "la seconde demande posthume");
    repondre(demandeDe(x, n), []);
    await attendre(() => !publicBrut().bailli.succession, "la vacance");
    assert.equal(publicBrut().bailli.acteurId, "");
    assert.equal(M.api.registre().at(-1).comment, "vacance");
    assert.equal(M.api.bailli().possible.ok, true, "une nouvelle élection est permise");
    assert.ok(y.system.vivant);
  },

  async "Bailli tué la nuit : il ne choisit qu'une fois toutes les morts de la nuit tombées"(M) {
    const U = await monde(M);
    await partie(M, U, [U.loup, U.pecheur, U.villageois, U.villageois, U.villageois, U.villageois]);
    const loup = villageois().find(a => cle(a) === "loup-de-brumecombe");
    const pecheur = villageois().find(a => cle(a) === "pecheur-de-nuit");
    const [bailli, victime, ...reste] = villageois().filter(a => cle(a) === "villageois");
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [bailli.id] });
    await M.api.noterAction({ acteurId: pecheur.id, roleCle: "pecheur-de-nuit", cibles: [victime.id] });
    await M.api.changerPhase("aube");
    const n = emissions.length;
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts.sort(), [bailli.id, victime.id].sort());
    await attendre(() => demandeDe(bailli, n), "la demande posthume");
    const d = demandeDe(bailli, n);
    assert.ok(!d.candidats.some(c => c.id === victime.id), "pas un mort de la même nuit");
    repondre(d, [reste[0]]);
    await attendre(() => publicBrut().bailli.acteurId === reste[0].id, "le successeur");
  },

  async "Registre : votes clos, morts avec leur cause publique, rien d'un vote ouvert"(M) {
    const U = await monde(M);
    const { loups, autres } = await partie(M, U);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loups[0].id, roleCle: "meute", cibles: [autres[0].id] });
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    const mort = M.api.registre().find(x => x.type === "mort");
    assert.deepEqual([mort.acteurId, mort.cause], [autres[0].id, "nuit"], "la cause publique");
    assert.ok(publicBrut().registre.every(x => x.type !== "mort" || x.cause === "nuit" || x.cause === "vote"));
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[autres[1], loups[0]]]);
    assert.ok(!M.api.registre().some(x => x.type === "vote" && x.objet === "execution"), "rien pendant le vote");
    commeJoueur("u1");
    assert.ok(!JSON.stringify(M.api.registre()).includes(`"${autres[1].id}":`), "les voix restent secrètes");
    commeMJ();
    await M.api.cloreVote();
    const lignes = M.api.registreTexte();
    assert.ok(lignes.some(l => l.includes(`${autres[1].name} → ${loups[0].name}`)), lignes.join("\n"));
    assert.ok(lignes.some(l => l.includes(autres[0].name) && l.includes(FR.LAKOUR_LOUPS.Causes.nuit)));
  },

  async "déclarations : un vivant, pour lui seul, le jour ; refus expliqués à lui seul ; annoncées à tous"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U);
    const [a, b, c] = autres;
    await M.api.changerPhase("jour");
    const n = emissions.length;
    envoyerAuMJ(CANAL, { type: "declaration", acteurId: a.id, texte: "Je me dis Liseuse de cendres, j'ai lu Mathurin.", userId: a.system.joueur }, { emetteur: a.system.joueur });
    await calme();
    const x = M.api.registre().at(-1);
    assert.deepEqual([x.type, x.acteurId, x.texte], ["declaration", a.id, "Je me dis Liseuse de cendres, j'ai lu Mathurin."]);
    assert.ok(messages.some(m => m.content.includes("Je me dis Liseuse de cendres")), "annoncée au chat");
    const hook = emissions.slice(n).find(e => e.type === "hook" && e.nom === "lakourLoups.registre");
    assert.equal(hook.recipients, null, "publique");
    // Pour un autre : refusée (l'émetteur fait foi).
    envoyerAuMJ(CANAL, { type: "declaration", acteurId: a.id, texte: "Je suis un loup.", userId: b.system.joueur }, { emetteur: b.system.joueur });
    envoyerAuMJ(CANAL, { type: "declaration", acteurId: a.id, texte: "Je suis un loup.", userId: a.system.joueur }, { emetteur: b.system.joueur });
    await calme();
    assert.ok(!M.api.registre().some(e => e.texte === "Je suis un loup."));
    // Réduit au silence pendant le débat : refusée, avec un avis à lui seul.
    await M.api.reduireAuSilence(c.id);
    const m = emissions.length;
    envoyerAuMJ(CANAL, { type: "declaration", acteurId: c.id, texte: "Écoutez-moi !", userId: c.system.joueur }, { emetteur: c.system.joueur });
    await calme();
    const avis = emissions.slice(m).find(e => e.type === "avis");
    assert.deepEqual(avis.recipients, [c.system.joueur]);
    assert.equal(avis.texte, R.Refus.silence);
    // Un mort : non ; la nuit : non.
    await M.api.eliminer(b.id, { cause: "vote" });
    await assert.rejects(() => M.api.declarer(b.id, "Je reviens."), e => e.message === R.Refus.mort);
    await M.api.changerPhase("nuit");
    await assert.rejects(() => M.api.declarer(a.id, "La nuit."), e => e.message === R.Refus.phase);
  },

  async "Masques : au carnet de chaque loup et de lui seul, des rôles du Village absents ; jamais publics"(M) {
    let U = await monde(M);
    let n = emissions.length;
    const { loups } = await partie(M, U);
    assert.deepEqual([...M.api.etat().masques].sort(), ["liseuse-de-cendres", "pecheur-de-nuit", "sourcier"],
      "trois pour une meute de deux : ni rôle en jeu, ni simple villageois, ni solitaire, ni meute");
    const envois = emissions.slice(n).filter(e => e.type === "secret" && e.entree.titre === FR.LAKOUR_LOUPS.Masques.Titre);
    assert.deepEqual(envois.map(e => e.recipients[0]).sort(), loups.map(a => a.system.joueur).sort(), "un par loup, à lui seul");
    assert.ok(envois[0].entree.texte.includes("Liseuse de cendres") && envois[0].entree.texte.includes("lit le camp"), "nom et pouvoir");
    masquesCaches(["Liseuse de cendres", "Sourcier", "liseuse-de-cendres", "Pêcheur de nuit"], n);
    // Les rôles distribués ne sont jamais des masques : ici, il n'en reste qu'un d'absent.
    U = await monde(M);
    n = emissions.length;
    await partie(M, U, [U.loup, U.loup, U.garde, U.liseuse, U.sourcier, U.villageois]);
    assert.deepEqual(M.api.etat().masques, ["pecheur-de-nuit"]);
    masquesCaches(["Pêcheur de nuit", "harponne"], n);
    assert.deepEqual(M.api.masques(), [{ cle: "pecheur-de-nuit", nom: "Pêcheur de nuit" }], "le narrateur les lit");
    commeJoueur("u1");
    assert.deepEqual(M.api.etat().masques, [], "un joueur ne les a pas dans l'état");
    assert.throws(() => M.api.masques(), "ni par l'API");
  },

  async "Masques : ni en peste noire, ni réglage coupé ; un villageois mordu les reçoit"(M) {
    let U = await monde(M);
    await partie(M, U, undefined, { peste: true });
    assert.deepEqual(M.api.etat().masques, []);
    assert.ok(!emissions.some(e => e.type === "secret" && e.entree.titre === FR.LAKOUR_LOUPS.Masques.Titre));
    U = await monde(M, { masques: false });
    await partie(M, U);
    assert.deepEqual(M.api.etat().masques, []);
    U = await monde(M);
    const { autres } = await partie(M, U);
    const n = emissions.length;
    await M.api.changerCamp(autres[0].id, "meute");
    const envoi = emissions.slice(n).find(e => e.type === "secret" && e.entree.titre === FR.LAKOUR_LOUPS.Masques.Titre);
    assert.deepEqual(envoi?.recipients, [autres[0].system.joueur], "le mordu reçoit les masques de sa meute");
  },

  async "bandeau, Table, infobulle et jeton : le Bailli et le Registre, chez chacun"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U);
    const [bailli, x] = autres;
    await M.api.changerPhase("jour");
    assert.ok(M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauVoteBailli" && b.principal), "le MJ élit d'abord");
    await M.api.nommerBailli(bailli.id);
    assert.ok(!M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauVoteBailli"));
    commeJoueur(bailli.system.joueur);
    assert.equal(M.bandeau.contexteBandeau().bailli.moi, true);
    commeJoueur(x.system.joueur);
    assert.equal(M.bandeau.contexteBandeau().bailli.texte, B.Bandeau.replace("{nom}", bailli.name));
    assert.equal(M.local.decorDe(bailli.id).bailli, true, "le sceau sur son jeton");
    assert.equal(M.local.decorDe(x.id).bailli, false);
    assert.ok(M.infobulle.contenuInfobulle(bailli).etats.some(e => e.cle === "bailli"));
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.equal(ctx.bailli.nom, bailli.name);
    assert.ok(ctx.vivants.find(v => v.id === bailli.id).bailli);
    assert.equal(ctx.declaration.ok, true, "il peut déclarer");
    assert.ok(ctx.registre.some(l => l.type === "bailli"));
  },

  async "une élection par jour, avant le vote d'exécution : l'API et le bouton de la Table"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U);
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ objet: "bailli", duree: 0 });
    await M.api.cloreVote();                                     // personne ne vote : vacance
    assert.equal(publicBrut().bailli.acteurId, "");
    await assert.rejects(() => M.api.ouvrirVote({ objet: "bailli" }), e => e.message === B.Refus.deja);
    assert.equal((await new M.table.TableDeJeu()._prepareContext()).voteBailli, false, "pas de second bouton");
    assert.equal((await new M.table.TableDeJeu()._prepareContext()).nommerBailli, true, "le MJ peut nommer à la main");
    assert.equal(M.api.etapeSuivante().cle, "ouvrirVote");
    await M.api.nommerBailli(autres[0].id);
    assert.equal(publicBrut().bailli.acteurId, autres[0].id);
  },

  async "élection à égalité : le sort désigne le Bailli, affiché élu (et non « personne »)"(M) {
    const U = await monde(M);
    const { autres } = await partie(M, U);
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ objet: "bailli", duree: 0 });
    const [a, b, c, d] = villageois();
    await voter([[a, autres[0]], [b, autres[0]], [c, autres[1]], [d, autres[1]]]);
    const r = await M.api.cloreVote();
    assert.equal(r.sort, true);
    assert.deepEqual(r.elus, [r.bailli]);
    assert.deepEqual(publicBrut().vote.resultat.elus, [r.bailli]);
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.deepEqual([ctx.vote.resultat.personne, ctx.vote.resultat.sort], [false, true]);
    assert.equal(ctx.vote.resultat.elus, game.actors.get(r.bailli).name);
  },

  async "pendant le départage : ni nouveau vote ni changement de phase ; le MJ tranche à la place du Bailli, un vivant seulement"(M) {
    const U = await monde(M);
    const { loups, autres } = await partie(M, U);
    const [bailli, x, y] = autres;
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    let n = emissions.length;
    const clos = sansFin(M.api.cloreVote());
    await attendre(() => demandeDe(bailli, n), "la demande au Bailli");
    await assert.rejects(() => M.api.ouvrirVote({ duree: 0 }), e => e.message === B.Refus.departage);
    await assert.rejects(() => M.api.changerPhase("nuit"), e => e.message === B.Refus.departage);
    const ctx = await new M.table.TableDeJeu()._prepareContext();
    assert.deepEqual(ctx.vote.resultat.departage.candidats.map(c => c.id).sort(), [loups[0].id, loups[1].id].sort(), "les boutons du MJ");
    const r = await M.api.trancher([loups[1].id]);
    assert.deepEqual(r.elus, [loups[1].id]);
    assert.deepEqual((await clos).elus, [loups[1].id], "la clôture rend le choix du MJ");
    assert.ok(emissions.slice(n).some(e => e.type === "annuler" && e.recipients?.[0] === bailli.system.joueur), "la fenêtre du Bailli se ferme");
    assert.equal(M.api.registre().filter(e => e.type === "vote" && e.numero === r.numero).length, 1);
    await assert.rejects(() => M.api.trancher([]), e => e.message === B.Refus.pasDeDepartage);
    // Un ex aequo mort entre-temps n'est pas condamné ; la formule reste neutre.
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    n = emissions.length;
    const clos2 = sansFin(M.api.cloreVote());
    await attendre(() => demandeDe(bailli, n), "la seconde demande");
    await M.api.eliminer(loups[0].id, { cause: "narrateur" });
    repondre(demandeDe(bailli, n), [loups[0]]);
    assert.deepEqual((await clos2).elus, []);
    assert.ok(messages.some(m => m.content.includes(B.TranchePersonne.replace("{nom}", bailli.name))));
  },

  async "rechargement de la page du MJ : le départage reprend ; un vote touché entre-temps entre au Registre sans condamné"(M) {
    const U = await monde(M, { delai: 8 });
    const { loups, autres } = await partie(M, U);
    const [bailli, x, y] = autres;
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    const numero = publicBrut().vote.numero;
    let n = emissions.length;
    sansFin(M.api.cloreVote());
    await attendre(() => demandeDe(bailli, n), "la demande au Bailli");
    const premiere = demandeDe(bailli, n);
    const M2 = await recharger(M);
    assert.equal(M2.api.etapeSuivante().cle, "departage");
    n = emissions.length;
    assert.deepEqual(M2.api.reprendre(), { departage: true, succession: false });
    await attendre(() => demandeDe(bailli, n), "la demande reprise");
    repondre(demandeDe(bailli, n), [loups[1]]);
    await attendre(() => !publicBrut().vote.resultat.departage.enAttente, "le choix appliqué");
    assert.deepEqual(publicBrut().vote.resultat.elus, [loups[1].id]);
    assert.ok(M2.api.registre().some(e => e.type === "vote" && e.numero === numero));
    assert.ok(emissions.slice(n).some(e => e.type === "hook" && e.nom === "lakourLoups.voteClos"));
    // L'ancienne page répond enfin (sa demande d'avant le rechargement) : rien ne change, le vote n'entre qu'une fois au Registre.
    repondre(premiere, [loups[0]]);
    await calme();
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(publicBrut().vote.resultat.elus, [loups[1].id]);
    assert.equal(M2.api.registre().filter(e => e.type === "vote" && e.numero === numero).length, 1);
    // Ici l'ancienne page vit encore (deux onglets du MJ) : elle a scellé après la nouvelle ; la nouvelle, en retard sur le coffre,
    // n'écrit plus rien tant qu'elle ne l'a pas rouvert (relecture 7) — dans Foundry, le changement du réglage « coffre » l'y mène.
    if (!M2.coffre.secretsAJour(publicBrut().partie)) await M2.coffre.chercherSecrets(publicBrut().partie);
    await M2.coffre.rangement();
    // Un vote touché pendant que le Bailli tranchait (ici, l'état réécrit) : il entre quand même au Registre, sans condamné.
    await M2.api.changerPhase("jour");
    await M2.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]], [y, loups[1]]]);
    n = emissions.length;
    sansFin(M2.api.cloreVote());
    await attendre(() => demandeDe(bailli, n), "la troisième demande");
    const touche = publicBrut();
    await game.settings.set("lakour-loups", "partie", { ...touche, vote: { ...touche.vote, numero: touche.vote.numero + 1, resultat: null } });
    repondre(demandeDe(bailli, n), [loups[0]]);
    await attendre(() => M2.api.registre().some(e => e.type === "vote" && e.numero === touche.vote.numero), "le vote touché au Registre");
    const entree = M2.api.registre().find(e => e.type === "vote" && e.numero === touche.vote.numero);
    assert.deepEqual([entree.elus, entree.departage.choix], [[], []]);
    assert.equal(loups[0].system.vivant, true);
  },

  async "rechargement : la succession reprend (le reste du délai) ; trop vieille, elle devient vacante ; le MJ peut nommer à la main"(M) {
    const U = await monde(M, { delai: 8 });
    const { autres } = await partie(M, U, [U.loup, U.garde, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [bailli, x, y, z] = autres;
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    let n = emissions.length;
    await M.api.eliminer(bailli.id, { cause: "vote" });
    await attendre(() => demandeDe(bailli, n), "la demande posthume");
    const M2 = await recharger(M);
    // Le rechargement (copie et import des fichiers) peut prendre plusieurs secondes sur une machine chargée : la mort est
    // replacée 300 ms avant la reprise, pour qu'il reste un délai entamé mais suffisant.
    const mort = publicBrut();
    await game.settings.set("lakour-loups", "partie", { ...mort, bailli: { ...mort.bailli, succession: { ...mort.bailli.succession, quand: Date.now() - 300 } } });
    n = emissions.length;
    assert.deepEqual(M2.api.reprendre(), { departage: false, succession: true });
    await attendre(() => demandeDe(bailli, n), "la demande reprise");
    assert.ok(demandeDe(bailli, n).delai < 8000, "seulement le reste du délai");
    repondre(demandeDe(bailli, n), [x]);
    await attendre(() => publicBrut().bailli.acteurId === x.id, "le successeur");
    // Le MJ nomme à la main pendant que le défunt hésite : sa fenêtre se ferme.
    n = emissions.length;
    await M2.api.eliminer(x.id, { cause: "vote" });
    await attendre(() => demandeDe(x, n), "la demande de x");
    await M2.api.nommerBailli(y.id);
    assert.ok(emissions.slice(n).some(e => e.type === "annuler" && e.recipients?.[0] === x.system.joueur), "la fenêtre posthume se ferme");
    await calme();
    assert.equal(publicBrut().bailli.acteurId, y.id);
    // La page rechargée longtemps après sa mort (délai passé) : la charge est vacante d'emblée, sans nouvelle fenêtre.
    n = emissions.length;
    await M2.api.eliminer(y.id, { cause: "vote" });
    await attendre(() => demandeDe(y, n), "la demande de y");
    const vieux = publicBrut();
    await game.settings.set("lakour-loups", "partie", { ...vieux, bailli: { ...vieux.bailli, succession: { ...vieux.bailli.succession, quand: Date.now() - 60000 } } });
    const M3 = await recharger(M2);
    n = emissions.length;
    M3.api.reprendre();
    await attendre(() => !publicBrut().bailli.succession, "la vacance");
    assert.equal(demandeDe(y, n), undefined, "pas de nouvelle fenêtre");
    assert.equal(publicBrut().bailli.acteurId, "");
    assert.ok(z.system.vivant);
  },

  async "clôture pendant une succession : le MJ est prévenu que le sceau attend"(M) {
    const U = await monde(M);
    const { loups, autres } = await partie(M, U, [U.loup, U.garde, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [bailli, x] = autres;
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(bailli.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[x, loups[0]]]);
    const n = emissions.length;
    await M.api.eliminer(bailli.id, { cause: "narrateur" });
    await attendre(() => demandeDe(bailli, n), "la demande posthume");
    const infos = [];
    ui.notifications.info = m => infos.push(m);
    const clos = sansFin(M.api.cloreVote());
    await attendre(() => infos.length, "l'avis au MJ");
    assert.equal(infos[0], B.SceauAttend.replace("{nom}", bailli.name));
    repondre(demandeDe(bailli, n), [x]);
    assert.deepEqual((await clos).elus, [loups[0].id]);
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "e.bailli = L.bailliInitial(!court && lireReglage(\"bailli\", true));", "e.bailli = L.bailliInitial(!court && true);", "réglage du Bailli"],
  ["scripts/api.mjs", "e.bailli = L.bailliInitial(!court && lireReglage(\"bailli\", true));", "e.bailli = L.bailliInitial(false);", "Bailli en jeu"],
  ["scripts/api.mjs", "    if (objet === \"bailli\") {\n      const p = L.electionAttendue", "    if (false) {\n      const p = L.electionAttendue", "élection permise"],
  ["scripts/api.mjs", "      if (c.resultat.objet === \"bailli\") {", "      if (false) {", "l'élu installé"],
  ["scripts/api.mjs", "    if (resultat.departage?.enAttente) resultat = await departageEnAttente(resultat);\n", "", "le Bailli tranche"],
  ["scripts/api.mjs", "nombre: d.places, objet: \"departage\" });", "nombre: d.places });", "départage nommé pour le compagnon"],
  ["scripts/api.mjs", "    suivreSuccession();\n    diffuserVus();", "    diffuserVus();", "succession après une élimination"],
  ["scripts/api.mjs", "    suivreSuccession();\n    return {", "    return {", "succession après la nuit"],
  ["scripts/api.mjs", "    mortsDeLaNuit = true;\n", "", "succession après toutes les morts de la nuit"],
  ["scripts/api.mjs", "const candidats = L.candidatsSuccession(avant, villageoisAPlat());", "const candidats = tousLesVillageois().map(a => a.id);", "successeur vivant"],
  ["scripts/api.mjs", "nombre: 1, delai: reste, posthume: true, objet: \"succession\" })", "nombre: 1, delai: reste, objet: \"succession\" })", "demande posthume"],
  ["scripts/api.mjs", "lireReglage(\"masques\", true)) {", "true) {", "réglage des Masques"],
  ["scripts/api.mjs", "        for (const a of loups) await envoyerMasques(a, masques, contenu);\n", "", "masques remis à la meute"],
  ["scripts/api.mjs", "          e.masques = masques;\n", "", "masques gardés par le MJ"],
  ["scripts/api.mjs", "enJeu: sortie.map(s => s.roleCle),", "enJeu: [],", "masques absents de la partie"],
  ["scripts/api.mjs", "[cle, equilibre?.roles?.[cle]?.camp || campsDesDocs.get(cle) || \"village\"]", "[cle, \"village\"]", "camps des rôles"],
  ["scripts/api.mjs", "    if (camp === \"meute\" && avant !== \"meute\") { await envoyerMasques(a); await envoyerSecretsDeMeute(a); }\n", "", "masques du mordu"],
  ["scripts/api.mjs", "if (!acteur || !user || (!user.isGM && acteur.system.joueur !== userId)) return false;\n  try {\n    await api.declarer",
    "if (!acteur || !user) return false;\n  try {\n    await api.declarer", "on ne déclare que pour soi"],
  ["scripts/api.mjs", "    annoncer(\"lakourLoups.registre\", [entree]);\n", "", "hook du Registre"],
  ["scripts/api.mjs", "(Number(x.poids?.[votant]) > 1", "(false", "voix double au Registre"],
  ["scripts/socket.mjs", "    case \"declaration\": return estMJActif() && recevoirDeclaration(pourMoi);\n", "", "déclaration par le socket"],
  ["scripts/actions-mj.mjs", "    case \"voteBailli\": return api().ouvrirVote({ objet: \"bailli\" });\n", "", "étape de l'élection (Table)"],
  ["scripts/apps/bandeau.mjs", "if (election) bouton(\"bandeauVoteBailli\"", "if (false) bouton(\"bandeauVoteBailli\"", "bandeau : élire le Bailli"],
  ["scripts/apps/bandeau.mjs", "if (bailliId && game.actors.get(bailliId)?.system.vivant) {", "if (false) {", "bandeau : le Bailli"],
  ["scripts/plateau-local.mjs", "bailli: Boolean(acteur?.system.vivant) && etat.bailli?.actif === true && etat.bailli.acteurId === acteurId", "bailli: false", "sceau du jeton"],
  ["scripts/infobulle.mjs", "etats.push({ cle: \"bailli\"", "void ({ cle: \"bailli\"", "infobulle du Bailli"],
  ["scripts/apps/table.mjs", "    const declaration = moi ? tenterSync(() => api().peutDeclarer(moi.id), null) : null;", "    const declaration = null;", "Table : déclarer"],
  ["scripts/apps/table.mjs", "bailli: Boolean(bailliId) && a.id === bailliId,", "bailli: false,", "Table : le sceau sur la carte"],
  ["scripts/api.mjs", "const p = L.electionAttendue({ etat: lireEtat(), villageois: villageoisAPlat() });",
    "const p = L.electionPossible({ etat: lireEtat(), villageois: villageoisAPlat() });", "une élection par jour (API)"],
  ["scripts/apps/table.mjs", "voteBailli: gm && Boolean(bailli?.election?.ok),", "voteBailli: gm && Boolean(bailli?.possible?.ok),", "une élection par jour (bouton)"],
  ["scripts/apps/table.mjs", "nommerBailli: gm && Boolean(bailli?.actif) && !bailliId && !fin && Boolean(etat.partie),", "nommerBailli: false,", "bouton : nommer le Bailli"],
  ["scripts/apps/table.mjs", "candidats: gm && resultat.departage.enAttente ? resultat.departage.candidats.map(id => ({ id, nom: nomDe(id) })) : []", "candidats: []", "boutons : trancher"],
  ["scripts/api.mjs", "    if (!L.VOTES_SANS_PHASE.includes(etat.vote.objet)) annoncer(\"lakourLoups.phase\"", "    annoncer(\"lakourLoups.phase\"", "élection sans ambiance du vote"],
  ["scripts/api.mjs", "    annoncer(\"lakourLoups.voteOuvert\", [{ objet: etat.vote.objet, numero: etat.vote.numero }]);\n", "", "hook du vote ouvert"],
  ["scripts/api.mjs", "PhaseInconnue\", { phase: String(phase) }));\n    exigerSansDepartage();", "PhaseInconnue\", { phase: String(phase) }));", "pas de phase pendant le départage"],
  ["scripts/api.mjs", "    exigerMJ();\n    exigerSansDepartage();\n    if (objet === \"bailli\")", "    exigerMJ();\n    if (objet === \"bailli\")", "pas de vote pendant le départage"],
  ["scripts/api.mjs", "    if (departage && !departageEnCours) {", "    if (false) {", "reprise du départage"],
  ["scripts/api.mjs", "    suivreSuccession();\n    return { departage, succession", "    return { departage, succession", "reprise de la succession"],
  ["scripts/api.mjs", "const choix = candidats.length && reste >= 1000", "const choix = candidats.length", "succession trop vieille : vacance"],
  ["scripts/api.mjs", "      terminer(id, ids, true);\n", "", "le MJ tranche : la demande se clôt"],
  ["scripts/api.mjs", "        L.inscrire(e, L.entreeDeVote({ ...resultat, departage: { par: d.par, choix: [] } }));\n", "", "vote touché : au Registre"],
  ["scripts/api.mjs", "if (!e.registre.some(x => x.type === \"vote\" && x.numero === resultat.numero)) {", "if (true) {", "vote touché : une seule fois"],
  ["scripts/api.mjs", "L.trancherVote(e, choix, { vivants: vivantsIds() })", "L.trancherVote(e, choix)", "départage : un vivant (API)"],
  ["scripts/api.mjs", "    if (posthume) terminer(posthume, [], true);\n", "", "nommer : la fenêtre posthume se ferme"],
  ["scripts/api.mjs", "    if (sceau) ui.notifications?.info(", "    if (false) ui.notifications?.info(", "avis : le sceau attend"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-bailli-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  dossiersARetirer.push(dossier);   // gardé jusqu'à la fin : un rechargement recopie le mutant
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

test("Bailli, Registre, Masques (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Bailli, Registre, Masques (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("au chargement de la page du MJ actif, ce qui attendait le Bailli reprend (api.reprendre)", () => {
  const source = readFileSync(join(SYSTEME, "lakour-loups.mjs"), "utf8");
  assert.match(source, /if \(!remis\) \{[\s\S]*?\n\s+api\.reprendre\(\);/);
});
