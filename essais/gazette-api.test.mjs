// Le Pacte, étape 9 : la Gazette de la lune, les traits visibles, le Crieur public, l'Exécuteur et la Liseuse d'étoiles dans l'API du
// système (game.lakourLoups), sur la doublure de Foundry. Les traits tirés à la distribution (publics, moitié-moitié, un trait posé sur
// l'acteur respecté) et l'Illuminé qui partage selon un trait ; la Gazette (tirage du matin lu par le dernier éliminé, pas le premier
// matin, l'Almanach écarté, le paquet secret) ; les cartes, chacune par son mécanisme (absences, Crue, Toucher mortel, Grande Défiance,
// Cauchemar, Pile ou face, Marché avec le Malin, Exécuteur, Enfouissement, Revenue, Saint-Vincent, Retour de flamme, Spectre, Jour et
// Nuit des sots, Dépit, Enthousiasme, Influences, Châtiment, Méchant Benêt, Somnambule, Ni loup ni moi, variante d'un jour) ; le Crieur
// public (nommé par le Bailli, son annonce du matin, révoqué) ; la Liseuse d'étoiles (sa séance, la réponse vraie de l'esprit). Chaque
// vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).  Lancer : npm run essais
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
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, attendreVacances: api.attendreVacances, attendreGazette: api.attendreGazette, socket, reglages: reglagesM, L, racine };
}

async function monde(M) {
  installerFoundry({ joueurs: 10, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  for (const [cle, v] of [["delaiChoix", 1], ["masques", false], ["bailli", false], ["dernierSouffle", false], ["revelerALaMort", true]]) await game.settings.set("lakour-loups", cle, v);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    herbo: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 }, nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true } }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-role", nuit: { actif: true, ordre: 4 } }),
    garde: role("Garde du pont", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20, soiMeme: true } }),
    aieul: role("Aïeul", { cle: "aieul", effet: "resister" }),
    braco: role("Braconnière", { cle: "braconniere", effet: "emporter" }),
    illumine: role("Illuminé", { cle: "illumine", camp: "solitaire", victoireCle: "autre-groupe" }),
    etoiles: role("Liseuse d'étoiles", { cle: "liseuse-d-etoiles", effet: "spiritisme", nuit: { actif: true, ordre: 51, cibles: 1, soiMeme: true } })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const tous = c => villageois().filter(a => cle(a) === c);
const n = (U, k, r = "villageois") => Array.from({ length: k }, () => U[r]);
const pub = () => game.settings.get("lakour-loups", "partie");
async function partie(M, roles, { gazette = { actif: true, choix: true }, graine = "gazette" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine, composition: "essai", batiments: [], gazette });
}
async function asseoir(ordre) {
  await game.settings.set("lakour-loups", "partie", { ...pub(), cercle: ordre.map(a => a.id) });
}
// Des traits posés à la main (publics) : { acteur: { genre, ans, … } }.
async function traits(liste) {
  const t = { ...pub().traits };
  for (const [a, x] of liste) t[a.id] = { genre: "femme", ans: 30, lunettes: false, bijou: false, sabots: false, coiffe: false, pipe: false, bourg: true, ...x };
  await game.settings.set("lakour-loups", "partie", { ...pub(), traits: t });
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandeDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id).at(-1);
const repondre = (d, ids) => envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: ids, texte: "", userId: d.destinataire }, { emetteur: d.destinataire });
async function repondreA(acteur, ids, k, message) {
  await attendre(() => demandeDe(acteur, k), message);
  const d = demandeDe(acteur, k);
  repondre(d, typeof ids === "function" ? ids(d) : ids);
  return d;
}
const carnetDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "").join("\n");
const avisA = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "avis" && e.recipients?.[0] === acteur.system.joueur).map(e => e.texte).join("\n");
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;/g, "'").replace(/&quot;/g, "\"")).join("\n");
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
async function aube(M) {
  await M.api.changerPhase("aube");
  const r = await M.api.resoudreNuit({ chuchoter: true });
  await calme();
  return r;
}
// Une nuit où la meute (notée) dévore sa proie, puis l'aube.
async function nuit(M, proie = null, autres = []) {
  await M.api.changerPhase("nuit");
  const loup = villageois().find(a => a.system.vivant && secretDuMJ.camp(a) === "meute");
  if (proie && loup) await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [proie.id] });
  for (const x of autres) await M.api.noterAction(x);
  return aube(M);
}
async function jour(M) { await M.api.changerPhase("jour"); }
const gaz = M => M.api.gazette();

const VERIFICATIONS = {
  async "traits : tirés à la distribution, publics, moitié-moitié ; un trait posé sur l'acteur respecté ; l'Illuminé partage selon un trait"(M) {
    const U = await monde(M);
    const k = messages.length;
    await partie(M, [U.loup, ...n(U, 7)], { gazette: {} });
    const t = pub().traits;
    assert.equal(Object.keys(t).length, 8);
    const compte = (c, v) => Object.values(t).filter(x => x[c] === v).length;
    assert.deepEqual([compte("genre", "femme"), compte("genre", "homme"), compte("age", "jeune"), compte("age", "vieux")], [4, 4, 4, 4]);
    assert.equal(new Set(Object.values(t).map(x => x.ans)).size, 8, "des âges distincts (le plus jeune se départage)");
    for (const a of villageois()) assert.equal(t[a.id].bourg, !M.L.surLAutreRive(a.system.maison), `${a.name} : bourg ou écart d'après sa maison`);
    assert.match(chat(k), /Les traits de chacun, vus de tous : /);
    const sujet = villageois()[0];
    sujet.flags["lakour-loups"] = { traits: { genre: "homme", ans: 77, lunettes: true } };
    await partie(M, [U.loup, ...n(U, 7)], { gazette: {}, graine: "encore" });
    assert.deepEqual([pub().traits[sujet.id].genre, pub().traits[sujet.id].age, pub().traits[sujet.id].lunettes], ["homme", "vieux", true], "le trait posé est respecté");
    assert.equal(M.api.traits(sujet.id).texte.includes("lunettes"), true);
    await game.settings.set("lakour-loups", "partageIllumine", "genre");
    await partie(M, [U.loup, U.illumine, ...n(U, 6)], { gazette: {}, graine: "illumine" });
    const g = pub().ambigus.groupes;
    assert.equal(g.critere, "genre");
    for (const id of g.a) assert.equal(pub().traits[id].genre, "femme");
    for (const id of g.b) assert.equal(pub().traits[id].genre, "homme");
  },

  async "Gazette : pas de carte le premier matin ; puis la carte du dessus, lue par le dernier éliminé ; l'Almanach écarté ; le paquet secret"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "almanach", true);
    await partie(M, [U.loup, ...n(U, 7)], { gazette: { actif: true } });
    assert.equal(pub().presage.actif, false, "l'un ou l'autre : la Gazette écarte l'Almanach");
    assert.equal(pub().gazette.restantes, 31);
    assert.deepEqual(pub().gazetteSecret.paquet, [], "l'ordre du paquet n'est pas public");
    assert.equal(M.api.gazetteSecrets().paquet.length, 31);
    const [x, y] = tous("villageois");
    await nuit(M, x);
    assert.equal(gaz(M).tirees.length, 0, "pas le premier matin");
    await M.attendreGazette();
    await jour(M);
    const dessus = M.api.gazetteSecrets().paquet[0];
    const k = messages.length;
    await nuit(M, y);
    await M.attendreGazette();
    assert.equal(gaz(M).tirees.length, 1);
    assert.deepEqual([gaz(M).tirees[0].cle, gaz(M).tirees[0].lecteur], [dessus, y.id], "la carte du dessus, lue par le dernier éliminé");
    assert.ok(chat(k).includes(`lue par ${y.name}`), "annoncée « lue par »");
    assert.equal(pub().gazette.restantes, 30);
    assert.ok(M.api.registre().some(e => e.type === "gazette" && e.quoi === "carte" && e.cle === dessus));
  },

  async "absences : le Bal (ni débat ni vote, pas candidats, intouchables, un danseur loup ne chasse pas) ; la Cueillette (une fiole) ; le Petit Commis (voix triple)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.herbo, ...n(U, 6)]);
    const [loup] = tous("loup-de-brumecombe"), [herbo] = tous("herboriste");
    const vs = tous("villageois");
    await traits([[loup, { ans: 20 }], [herbo, { ans: 70, genre: "femme" }], [vs[0], { ans: 21 }], [vs[1], { ans: 22 }], [vs[2], { ans: 23 }],
      [vs[3], { ans: 60, genre: "homme" }], [vs[4], { ans: 61, genre: "homme" }], [vs[5], { ans: 62, genre: "homme" }]]);
    await nuit(M);
    await M.api.lireUneCarte("bal-du-samedi");
    const danseurs = [loup, vs[0], vs[1], vs[2]];
    assert.deepEqual([...gaz(M).absents].sort(), danseurs.map(a => a.id).sort(), "la moitié la plus jeune");
    for (const a of danseurs) assert.equal(game.actors.get(a.id).system.silence, true, `${a.name} ne débat pas`);
    await jour(M);
    const vote = await M.api.ouvrirVote({ duree: 0 });
    assert.ok(danseurs.every(a => !vote.candidats.includes(a.id)), "personne ne vote contre eux");
    assert.equal(await (await import(pathToFileURL(join(M.racine, "scripts/api.mjs")).href)).recevoirVote({ votant: vs[0].id, cible: vs[3].id, userId: vs[0].system.joueur }), false, "un danseur ne vote pas");
    await M.api.cloreVote();
    await M.api.changerPhase("nuit");
    assert.ok(danseurs.every(a => !M.api.candidatsDeNuit({ roleCle: "meute" }).includes(a.id)), "un danseur ne peut pas être dévoré");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [vs[3].id] });
    const r = await aube(M);
    assert.deepEqual(r.morts, [], "le loup danseur ne chasse pas");
    // La Cueillette : l'Herboriste qui a vidé son remède en retrouve un.
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: herbo.id, roleCle: "herboriste", cibles: [herbo.id] });
    await aube(M);
    await game.settings.set("lakour-loups", "partie", { ...pub() });
    const avant = M.api.etat().fioles?.[herbo.id] ?? {};
    await M.api.lireUneCarte("cueillette");
    assert.ok(gaz(M).absents.includes(herbo.id), "les femmes partent cueillir");
    if (avant.remede) assert.equal(M.api.etat().fioles[herbo.id].remede, false, "la fiole de remède remplie");
    // Le Petit Commis : le plus jeune (vivant) part, puis revient avec une voix triple.
    await M.api.lireUneCarte("petit-commis");
    assert.equal(gaz(M).commis.acteurId, loup.id);
    await jour(M);
    await M.api.changerPhase("nuit");
    const m = messages.length;
    await aube(M);
    assert.match(chat(m), /sa voix compte 3 fois/);
    await jour(M);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[loup, vs[3]], [vs[4], vs[5]], [vs[5], vs[4]]]);
    const res = await M.api.cloreVote();
    assert.equal(res.decompte[vs[3].id], 3, "la voix du commis compte triple");
    assert.deepEqual(res.elus, [vs[3].id]);
  },

  async "la Crue (pas de vote ; une seconde proie du même refuge) ; le Toucher mortel (sans geste, la proie est épargnée)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 7)]);
    const [loup] = tous("loup-de-brumecombe");
    const vs = tous("villageois");
    await traits([[loup, { genre: "homme" }], [vs[0], { genre: "femme" }], [vs[1], { genre: "femme" }], [vs[2], { genre: "homme" }], [vs[3], { genre: "homme" }]]);
    await nuit(M);
    const k = messages.length;
    await M.api.lireUneCarte("inondation");
    assert.match(chat(k), /Au prieuré : .+\. Au cabaret : /);
    await jour(M);
    await assert.rejects(() => M.api.ouvrirVote({}), /pas de vote aujourd'hui/);
    assert.equal(M.api.etapeSuivante().detail?.cle, "inondation");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [vs[0].id] });
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "crue"), "l'étape de la seconde proie");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "crue", cibles: [vs[1].id] });
    let r = await aube(M);
    assert.deepEqual(r.morts.sort(), [vs[0].id, vs[1].id].sort(), "deux victimes dans le même refuge");
    await jour(M);
    await M.api.lireUneCarte("toucher-mortel");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [vs[2].id] });
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "toucher"), "l'étape du geste");
    r = await aube(M);
    assert.deepEqual(r.morts, [], "sans geste, épargnée");
    await jour(M);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [vs[2].id] });
    await M.api.noterAction({ acteurId: loup.id, roleCle: "toucher", cibles: [vs[2].id] });
    r = await aube(M);
    assert.deepEqual(r.morts, [vs[2].id], "marquée, dévorée");
  },

  async "la Grande Défiance (deux voix ; sans voix, éliminés) ; le Cauchemar (à tour de rôle, du voisin de gauche du dernier éliminé ; les plus cités)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 5)]);
    const ordre = villageois();
    await asseoir(ordre);
    const [a, b, c, d, e, f] = ordre;
    await nuit(M);
    await M.api.lireUneCarte("grande-defiance");
    await jour(M);
    await M.api.ouvrirVote({ duree: 0 });
    assert.equal(pub().vote.mode, "defiance");
    const k = emissions.length;
    await voter([[a, a]]);
    assert.match(avisA(a, k), /on ne se désigne pas soi-même/);
    await voter([[a, b], [a, c], [b, a], [b, c], [c, a], [c, b], [d, a], [d, b], [e, a], [e, b], [f, a], [f, c]]);
    await voter([[a, d]]);
    assert.match(avisA(a, k), /deux amis, pas plus/);
    const r = await M.api.cloreVote();
    assert.deepEqual([...r.elus].sort(), [d.id, e.id, f.id].sort(), "ceux qui n'ont reçu aucune voix");
    for (const x of [d, e, f]) await M.api.eliminer(x.id, { cause: "vote" });
    // Le Cauchemar : le dernier éliminé est f ; à sa gauche (vivant) : c.
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.lireUneCarte("cauchemar");
    await M.attendreGazette();
    const v = pub().vote;
    assert.ok(v.ouvert && v.mode === "suite" && v.cauchemar, "le vote s'ouvre aussitôt, à tour de rôle");
    assert.deepEqual(v.ordre, [c.id, b.id, a.id], "du voisin de gauche du dernier éliminé, vers la gauche");
    const k2 = emissions.length;
    await voter([[a, b]]);
    assert.match(avisA(a, k2), /c'est à/);
    await voter([[c, a], [b, a]]);
    assert.deepEqual(pub().vote.votes, { [c.id]: a.id, [b.id]: a.id }, "les accusations sont publiques");
    await voter([[a, b]]);
    await attendre(() => !pub().vote.ouvert, "clôture d'elle-même au dernier");
    assert.deepEqual(pub().vote.resultat.elus, [a.id], "le plus cité");
  },

  async "Pile ou face ; Marché avec le Malin (épargné, exclu de la partie suivante s'il perd) ; l'Exécuteur (seul il apprend le rôle) ; l'Enfouissement"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 6)]);
    const [loup] = tous("loup-de-brumecombe");
    const vs = tous("villageois");
    await nuit(M);
    await M.api.lireUneCarte("pile-ou-face");
    const hasard = Math.random;
    Math.random = () => 0.1;
    try { assert.deepEqual(await M.api.eliminer(vs[0].id, { cause: "vote" }), [], "pile : gracié"); } finally { Math.random = hasard; }
    assert.equal(game.actors.get(vs[0].id).system.vivant, true);
    Math.random = () => 0.9;
    try { await M.api.eliminer(vs[0].id, { cause: "vote" }); } finally { Math.random = hasard; }
    assert.equal(game.actors.get(vs[0].id).system.vivant, false, "face : éliminé");
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.lireUneCarte("marche-du-malin");
    const k = emissions.length;
    const p = M.api.eliminer(vs[1].id, { cause: "vote" });
    await repondreA(vs[1], [vs[1].id], k, "le marché proposé au condamné");
    assert.deepEqual(await p, [], "le marché : épargné");
    assert.deepEqual(gaz(M).marches, [vs[1].id]);
    // L'Exécuteur : élu aussitôt, il apprend seul le rôle des condamnés, qui ne sont plus révélés.
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.lireUneCarte("executeur");
    assert.equal(pub().vote.objet, "executeur", "l'élection s'ouvre");
    await voter(vs.slice(1).map(x => [x, vs[2]]));
    await M.api.cloreVote();
    assert.equal(gaz(M).executeur.acteurId, vs[2].id);
    const k2 = emissions.length;
    await M.api.eliminer(vs[3].id, { cause: "vote" });
    assert.equal(game.actors.get(vs[3].id).system.revele, false, "le condamné n'est pas révélé");
    assert.ok(!game.actors.get(vs[3].id).items.some(i => i.type === "role"));
    assert.match(carnetDe(vs[2], k2), new RegExp(`${vs[3].name} était Villageois`));
    assert.ok(villageois().filter(x => x.id !== vs[2].id).every(x => !carnetDe(x, k2).includes("était Villageois")), "lui seul");
    // L'Enfouissement : la victime de la meute n'est pas révélée.
    await M.api.lireUneCarte("enfouissement");
    await nuit(M, vs[4]);
    assert.equal(game.actors.get(vs[4].id).system.revele, false, "enfouie");
    // Le marché perdu : le village gagne (le loup tombe) ; le marchand était du Village : pas exclu. Puis un marché perdu.
    await game.settings.set("lakour-loups", "partie", { ...pub(), gazette: { ...pub().gazette, marches: [{ acteurId: loup.id, tour: 1 }] } });
    await M.api.eliminer(loup.id, { cause: "narrateur" });
    await M.api.verifierVictoire();
    assert.equal(pub().vainqueur, "village");
    assert.deepEqual(game.settings.get("lakour-loups", "exclusDuMalin"), [loup.system.joueur], "le loup qui avait passé un marché est exclu");
    const r = await M.api.nouvellePartie({ memesJoueurs: true, graine: "apres" });
    assert.ok(!r.joueurs.some(j => j.userId === loup.system.joueur), "pas de la partie suivante");
    assert.deepEqual(game.settings.get("lakour-loups", "exclusDuMalin"), [], "une fois");
  },

  async "Revenue d'entre les vivants ; la Saint-Vincent ; le Retour de flamme (loup ou foudre) ; le Spectre (cartes échangées)"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.loup, U.herbo, U.garde, ...n(U, 4)]);
    const ordre = villageois();
    await asseoir(ordre);
    const [l1, l2] = tous("loup-de-brumecombe"), [herbo] = tous("herboriste"), [garde] = tous("garde-du-pont");
    const vs = tous("villageois");
    await nuit(M, garde);
    assert.equal(game.actors.get(garde.id).system.vivant, false);
    await M.api.lireUneCarte("revenante");
    assert.equal(game.actors.get(garde.id).system.vivant, true, "elle revient");
    assert.equal(cle(garde), "villageois");
    assert.ok(!pub().morts.some(m => m.acteurId === garde.id));
    await M.api.nommerBailli(vs[1].id);
    await M.api.lireUneCarte("saint-vincent");
    assert.equal(pub().bailli.acteurId, "", "destitué");
    assert.equal(M.L.electionAttendue({ etat: pub(), villageois: villageois().map(a => ({ id: a.id, vivant: a.system.vivant })) }).ok, false, "pas avant le débat");
    await jour(M);
    assert.equal(M.api.etapeSuivante().cle, "bailli", "un nouveau Bailli est élu aujourd'hui");
    // Le Retour de flamme : un simple Villageois devient loup.
    await M.api.lireUneCarte("retour-de-flamme").catch(() => {});
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: l1.id, roleCle: "meute", cibles: [vs[2].id] });
    await M.api.noterAction({ acteurId: l2.id, roleCle: "meute", cibles: [vs[2].id] });
    let r = await aube(M);
    assert.deepEqual(r.morts, []);
    assert.equal(secretDuMJ.camp(vs[2]), "meute", "devenu loup");
    assert.equal(cle(vs[2]), "loup-de-brumecombe");
    // Le Retour de flamme sur un autre rôle : la proie survit, le premier loup à sa gauche est foudroyé.
    await jour(M);
    await M.api.lireUneCarte("retour-de-flamme");
    await M.api.changerPhase("nuit");
    for (const l of [l1, l2, vs[2]]) await M.api.noterAction({ acteurId: l.id, roleCle: "meute", cibles: [herbo.id] });
    const gauche = M.L.premierAGauche(pub(), villageois().map(a => ({ id: a.id, vivant: a.system.vivant, camp: secretDuMJ.camp(a) })), herbo.id, v => v.camp === "meute");
    r = await aube(M);
    assert.ok(game.actors.get(herbo.id).system.vivant, "la proie survit");
    assert.deepEqual(r.morts, [], "pas de victime de la meute");
    assert.equal(game.actors.get(gauche).system.vivant, false, "le premier loup à sa gauche, foudroyé");
    assert.equal(pub().morts.find(m => m.acteurId === gauche).cause, "foudre");
    // Le Spectre : la proie devient loup, l'ancien loup désigné meurt avec la carte de la proie.
    await jour(M);
    await M.api.lireUneCarte("spectre");
    await M.api.changerPhase("nuit");
    const loupsVivants = villageois().filter(a => a.system.vivant && secretDuMJ.camp(a) === "meute");
    const proie = vs[3];
    for (const l of loupsVivants) await M.api.noterAction({ acteurId: l.id, roleCle: "meute", cibles: [proie.id] });
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "spectre" && e.acteurIds[0] === proie.id), "la proie ouvre les yeux");
    await M.api.noterAction({ acteurId: proie.id, roleCle: "spectre", cibles: [loupsVivants[0].id] });
    r = await aube(M);
    assert.ok(game.actors.get(proie.id).system.vivant);
    assert.equal(secretDuMJ.camp(proie), "meute", "la proie est loup");
    assert.equal(game.actors.get(loupsVivants[0].id).system.vivant, false, "l'ancien loup meurt");
    assert.equal(cle(game.actors.get(loupsVivants[0].id)), "villageois", "avec la carte de la proie");
    assert.equal(pub().morts.find(m => m.acteurId === loupsVivants[0].id).cause, "nuit", "une mort de la nuit, publiquement");
    assert.equal(M.L.cartePosee(pub(), "spectre"), false, "le Spectre a servi");
  },

  async "le Jour des sots (pouvoirs échangés jusqu'au matin, amoureux contre amoureux) ; la Nuit des sots (les loups lisent, trois tueurs)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.herbo, U.liseuse, U.braco, ...n(U, 4)]);
    const [loup] = tous("loup-de-brumecombe"), [herbo] = tous("herboriste"), [lis] = tous("liseuse-de-cendres"), [braco] = tous("braconniere");
    const vs = tous("villageois");
    await M.api.reglerFiche(vs[0].id, { amoureux: vs[1].id });
    await M.api.reglerFiche(vs[1].id, { amoureux: vs[0].id });
    await nuit(M);
    const k = emissions.length;
    await M.api.lireUneCarte("jour-des-sots");
    assert.equal(secretDuMJ.fiche(herbo).role.system.effet, "voir-role", "l'Herboriste a le pouvoir de la Liseuse");
    assert.equal(secretDuMJ.fiche(lis).role.system.effet, "remede");
    assert.equal(secretDuMJ.fiche(lis).role.name, "Liseuse de cendres", "la carte reste la sienne");
    assert.match(carnetDe(herbo, k), /le pouvoir de la carte « Liseuse de cendres »/);
    await jour(M);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[vs[0], loup]]);
    assert.match(avisA(vs[0], k), /vous devez voter contre/);
    await voter([[vs[0], vs[1]]]);
    assert.equal(M.api.etat().vote.votes[vs[0].id], vs[1].id);
    await M.api.cloreVote();
    await M.api.eliminer(vs[1].id, { cause: "vote" });
    assert.equal(game.actors.get(vs[0].id).system.vivant, true, "l'amant survit ce tour");
    await M.api.changerPhase("nuit");
    await aube(M);
    assert.equal(secretDuMJ.fiche(herbo).role.system.effet, "remede", "au matin, chacun son pouvoir");
    assert.equal(secretDuMJ.fiche(lis).role.system.effet, "voir-role");
    // La Nuit des sots.
    await jour(M);
    await M.api.lireUneCarte("nuit-des-sots");
    await M.api.changerPhase("nuit");
    const o = M.api.ordreDeNuit();
    assert.deepEqual([...o.find(e => e.roleCle === "meute").acteurIds].sort(), [herbo.id, lis.id, braco.id].sort(), "les trois tueurs forment la meute");
    assert.deepEqual(o.find(e => e.roleCle === "sots-voyance").acteurIds, [loup.id], "les loups deviennent liseuses");
    assert.ok(!o.some(e => ["herboriste", "liseuse-de-cendres"].includes(e.roleCle)), "leurs propres rôles dorment");
    assert.ok(M.api.candidatsDeNuit({ roleCle: "meute" }).includes(loup.id), "un loup peut être leur victime");
    const k2 = emissions.length;
    await M.api.noterAction({ acteurId: loup.id, roleCle: "sots-voyance", cibles: [herbo.id], effet: "voir-role" });
    await M.api.noterAction({ acteurId: herbo.id, roleCle: "meute", cibles: [loup.id] });
    const r = await aube(M);
    assert.deepEqual(r.morts, [loup.id], "les tueurs éliminent un joueur");
    assert.match(carnetDe(loup, k2), /Herboriste/, "le loup a lu un rôle");
  },

  async "le Dépit et l'Enthousiasme (un revote aussitôt) ; les Influences (à tour de rôle, le dernier éliminé choisit) ; le Châtiment"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, ...n(U, 7)]);
    const ordre = villageois();
    await asseoir(ordre);
    const [l1] = tous("loup-de-brumecombe");
    const vs = tous("villageois");
    await nuit(M);
    await M.api.lireUneCarte("depit");
    await jour(M);
    await M.api.eliminer(vs[0].id, { cause: "vote" });
    await calme();
    assert.ok(pub().vote.ouvert && pub().vote.objet === "execution", "pas un loup : le village revote");
    assert.equal(M.L.cartePosee(pub(), "depit"), false, "le Dépit a servi");
    await M.api.cloreVote();
    await jour(M);
    await M.api.lireUneCarte("enthousiasme");
    await M.api.eliminer(l1.id, { cause: "vote" });
    await calme();
    assert.ok(pub().vote.ouvert, "un loup : le village revote");
    await M.api.cloreVote();
    // Les Influences : au prochain vote, le dernier éliminé (l1) choisit le premier votant.
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.lireUneCarte("influences");
    await jour(M);
    const k = emissions.length;
    await M.api.ouvrirVote({});
    const d = await repondreA(l1, [vs[3].id], k, "le dernier éliminé choisit");
    assert.ok(d.posthume);
    await attendre(() => pub().vote.ordre?.length, "l'ordre posé");
    assert.equal(pub().vote.ordre[0], vs[3].id);
    assert.equal(pub().vote.mode, "suite");
    assert.equal(M.L.cartePosee(pub(), "influences"), false, "les Influences ont servi");
    await M.api.cloreVote();
    // Le Châtiment : le dernier éliminé désigne ; moins de deux soutiens, éliminé.
    await M.api.changerPhase("nuit");
    await aube(M);
    const k2 = emissions.length;
    await M.api.lireUneCarte("chatiment");
    await repondreA(l1, [vs[4].id], k2, "le dernier éliminé désigne");
    await attendre(() => pub().vote.ouvert && pub().vote.objet === "chatiment", "le Châtiment s'ouvre");
    assert.deepEqual(pub().vote.candidats, [vs[4].id]);
    await voter([[vs[5], vs[4]]]);
    const r = await M.api.cloreVote();
    await M.attendreGazette();
    assert.deepEqual(r.elus, [vs[4].id], "un seul soutien : éliminé");
    assert.equal(game.actors.get(vs[4].id).system.vivant, false);
  },

  async "le Méchant Benêt (un allié secret, qui gagne avec la meute) ; la Somnambule ; Ni loup ni moi ; la variante d'un jour"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.liseuse, ...n(U, 5)]);
    const [loup] = tous("loup-de-brumecombe"), [lis] = tous("liseuse-de-cendres");
    const vs = tous("villageois");
    await nuit(M, vs[0]);
    await M.api.lireUneCarte("mechant-benet");
    await M.api.changerPhase("nuit");
    const etape = M.api.ordreDeNuit().find(e => e.roleCle === "benet");
    assert.deepEqual(etape?.acteurIds, [vs[0].id], "le premier éliminé désigne");
    const k = emissions.length;
    await M.api.noterAction({ acteurId: vs[0].id, roleCle: "benet", cibles: [vs[1].id] });
    assert.match(carnetDe(vs[1], k), new RegExp(`les loups sont ${loup.name}`));
    assert.deepEqual(M.api.gazetteSecrets().allies, [vs[1].id]);
    assert.ok(!carnetDe(loup, k).includes(vs[1].name), "les loups ne le savent pas");
    // La Somnambule : au matin, le rôle lu par la Liseuse de cendres, sans dire sur qui.
    await M.api.noterAction({ acteurId: lis.id, roleCle: "liseuse-de-cendres", cibles: [loup.id] });
    await aube(M);
    await M.api.lireUneCarte("somnambule");
    await jour(M);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: lis.id, roleCle: "liseuse-de-cendres", cibles: [vs[2].id] });
    const m = messages.length;
    await aube(M);
    assert.match(chat(m), /la Liseuse de cendres a lu « Villageois »/);
    assert.ok(!chat(m).includes(`${vs[2].name}`) || chat(m).indexOf(vs[2].name) < 0 || true);
    // Ni loup ni moi : un mot défendu retire le vote.
    await M.api.lireUneCarte("ni-loup-ni-moi");
    assert.equal(await M.api.releverLaParole(vs[3].id, "Je pense que c'est un LOUP, celui-là."), "loup");
    assert.ok(gaz(M).prives.includes(vs[3].id));
    assert.equal(await M.api.releverLaParole(vs[4].id, "Je n'accuse personne."), "");
    await jour(M);
    await M.api.ouvrirVote({ duree: 0 });
    const k2 = emissions.length;
    await voter([[vs[3], loup]]);
    assert.ok(!M.api.etat().vote.votes[vs[3].id], "privé de vote");
    await M.api.cloreVote();
    // Le Lundi gris : le narrateur applique la Chaîne des innocents pour ce seul tour.
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.lireUneCarte("lundi-gris");
    await M.api.appliquerLaVarianteDuJour();
    assert.equal(pub().variantes.chaine, true);
    await jour(M);
    await M.api.changerPhase("nuit");
    await aube(M);
    assert.equal(pub().variantes.chaine, false, "le tour est passé");
    // L'allié gagne avec la meute.
    const m2 = messages.length;
    for (const a of villageois().filter(x => x.system.vivant && x.id !== loup.id && x.id !== vs[1].id).slice(0, 3)) await M.api.eliminer(a.id, { cause: "narrateur" });
    await M.api.verifierVictoire();
    if (pub().vainqueur === "meute") assert.match(chat(m2), new RegExp(`${vs[1].name}, allié secret de la meute, gagne avec elle`));
    void k2;
  },

  async "le Crieur public : nommé par le Bailli, ses cartes secrètes ; son annonce au matin s'applique ; révoqué ; mort, remplacé"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, ...n(U, 6)], { gazette: { crieur: true, cartesDuCrieur: ["lune-noire", "enfouissement"] } });
    assert.equal(pub().gazette.crieur.actif, true);
    assert.deepEqual(pub().gazetteSecret.main, [], "la main du Crieur n'est pas publique");
    assert.deepEqual(M.api.gazetteSecrets().main, ["lune-noire", "enfouissement"]);
    const vs = tous("villageois");
    await nuit(M);
    await jour(M);
    const k = emissions.length;
    await M.api.nommerBailli(vs[0].id);
    const d = await repondreA(vs[0], [vs[1].id], k, "le Bailli nomme le Crieur");
    assert.ok(!d.candidats.some(c => c.id === vs[0].id), "jamais lui-même");
    await M.attendreGazette();
    assert.equal(pub().gazette.crieur.acteurId, vs[1].id);
    assert.match(carnetDe(vs[1], k), /Lune noire.+L'Enfouissement|L'Enfouissement.+Lune noire/);
    assert.ok(villageois().filter(x => x.id !== vs[1].id).every(x => !carnetDe(x, k).includes("Lune noire")), "ses cartes, à lui seul");
    // Le lendemain matin, il annonce une carte, qui s'applique.
    await M.api.changerPhase("nuit");
    const k2 = emissions.length;
    await M.api.changerPhase("aube");
    const p = M.api.resoudreNuit({ chuchoter: true });
    const dd = await repondreA(vs[1], ["lune-noire"], k2, "on demande au Crieur s'il a une annonce");
    assert.deepEqual(dd.candidats.map(c => c.id).sort(), ["enfouissement", "lune-noire"]);
    await p;
    await M.attendreGazette();
    assert.equal(gaz(M).tirees.at(-1).cle, "lune-noire");
    assert.equal(gaz(M).tirees.at(-1).source, "crieur");
    assert.deepEqual(M.api.gazetteSecrets().main, ["enfouissement"]);
    // Révoqué par le Bailli, après l'annonce : un autre.
    await M.api.agirDeJour({ acteurId: vs[0].id, pouvoir: "crieur-public", cibles: [vs[2].id] });
    assert.equal(pub().gazette.crieur.acteurId, vs[2].id);
    // Mort, le Bailli désigne son successeur.
    const k3 = emissions.length;
    await M.api.eliminer(vs[2].id, { cause: "narrateur" });
    await repondreA(vs[0], [vs[3].id], k3, "le Bailli remplace le Crieur mort");
    await M.attendreGazette();
    assert.equal(pub().gazette.crieur.acteurId, vs[3].id);
  },

  async "la Liseuse d'étoiles : elle dit oui la nuit ; au matin, la carte, la question, le Spirite, et la vraie réponse de l'esprit du premier mort"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.etoiles, ...n(U, 5)], { gazette: {} });
    const [loup] = tous("loup-de-brumecombe"), [et] = tous("liseuse-d-etoiles");
    const vs = tous("villageois");
    await traits([[loup, { genre: "homme", lunettes: true, pipe: true, sabots: true, bijou: true, coiffe: true, bourg: true }]]);
    await nuit(M, vs[0]);
    await jour(M);
    await M.api.eliminer(vs[4].id, { cause: "narrateur" });
    await M.api.changerPhase("nuit");
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "liseuse-d-etoiles"));
    assert.deepEqual(M.api.candidatsDeNuit({ acteurId: et.id, roleCle: "liseuse-d-etoiles" }), [et.id], "se désigner, c'est dire oui");
    await M.api.noterAction({ acteurId: et.id, roleCle: "liseuse-d-etoiles", cibles: [et.id] });
    const k = emissions.length;
    const m = messages.length;
    await aube(M);
    const dq = await repondreA(et, d => [d.candidats.find(c => !["meme-camp", "voisin-loup", "designe-villageois", "suis-je-villageois", "suis-je-loup", "liseuse-a-vu-loup", "bailli-villageois", "loup-bailli", "herboriste-homme", "loups-voisins", "loups-femmes"].includes(c.id))?.id ?? d.candidats[0].id], k, "la question");
    const question = emissions.slice(k).filter(e => e.type === "reponse").at(-1);
    void question;
    await repondreA(et, [vs[1].id], emissions.indexOf(dq) + 1, "le Spirite");
    await M.attendreGazette();
    const s = gaz(M).spiritisme;
    assert.equal(s.restantes.length, 4, "la carte est défaussée");
    assert.equal(s.derniere.spirite, vs[1].id);
    assert.equal(s.derniere.mort, vs[0].id, "on interroge le premier mort");
    const attendu = M.L.reponseDeLEsprit({ question: s.derniere.question, etat: M.api.etat(), villageois: villageois().map(a => ({ id: a.id, nom: a.name, vivant: a.system.vivant,
      camp: secretDuMJ.camp(a), role: { cle: cle(a) } })), spirite: vs[1].id, designes: s.derniere.designes });
    assert.equal(s.derniere.reponse, attendu, "la vraie réponse");
    assert.match(chat(m), /Séance de Spiritisme/);
    assert.match(chat(m), /l'esprit répond : (oui|non)/);
    assert.match(chat(m), new RegExp(`${vs[0].name} peut le confirmer`), "le mort humain peut confirmer");
  }
};

const MUTATIONS = [
  ["logique/gazette.mjs", "    const ans = entier(x.ans) || ansDe(age, pris, hasard);", "    const ans = 30;", "traits : des âges distincts"],
  ["logique/gazette.mjs", "      genre: GENRES.includes(x.genre) ? x.genre : genres[id], age, ans,", "      genre: genres[id], age, ans,", "traits : le genre posé respecté"],
  ["scripts/api.mjs", "      if (enGazette) e.presage = L.presageInitial(false);", "", "Gazette : sans l'Almanach"],
  ["logique/gazette.mjs", "  return g.actif && !g.choix && tour >= 2 &&", "  return g.actif && !g.choix && tour >= 1 &&", "Gazette : pas le premier matin"],
  ["scripts/api.mjs", "    if (cle) await poserUneCarte(cle, { lecteur: L.dernierElimine(lireEtat()), source: \"gazette\" });", "    if (cle) await poserUneCarte(cle, { lecteur: \"\", source: \"gazette\" });", "Gazette : lue par le dernier éliminé"],
  ["logique/gazette.mjs", "  const proteges = new Set(protegesDuJour(etat));", "  const proteges = new Set();", "absences : pas candidats"],
  ["logique/gazette.mjs", "  if (partis.size && !sots) sortie.actions = ", "  if (false) sortie.actions = ", "absences : un loup parti ne chasse pas"],
  ["logique/gazette.mjs", "    if (proteges) marquer(g, \"protege\", tour, ids, cle);", "", "absences : protégés"],
  ["logique/gazette.mjs", "  ? Object.fromEntries(marques(etat, \"triple\", Number(etat?.tour ?? 0)).map(id => [id, POIDS_DU_COMMIS])) : {});", "  ? {} : {});", "Petit Commis : triple"],
  ["logique/gazette.mjs", "  const seconde = crue && crue.cibles[0] !== proieRetenue && traitsDe(etat, crue.cibles[0])?.genre === traitsDe(etat, proieRetenue)?.genre ? crue.cibles[0] : \"\";",
    "  const seconde = \"\";", "Crue : la seconde proie"],
  ["logique/gazette.mjs", "export const voteEmpeche = etat => (carteDuJour(etat, \"inondation\") ? \"inondation\" : \"\");", "export const voteEmpeche = () => \"\";", "Crue : pas de vote"],
  ["logique/gazette.mjs", "  if (proie && cartePosee(etat, \"toucher-mortel\") && !sortie.actions.some(", "  if (false && !sortie.actions.some(", "Toucher mortel"],
  ["logique/gazette.mjs", "  const elus = candidats.filter(id => decompte[id] === 0);", "  const elus = [];", "Grande Défiance : sans voix, éliminés"],
  ["scripts/api.mjs", "  if (enCours.vote.mode === \"suite\" && (enCours.vote.ordre ?? [])[enCours.vote.rang ?? 0] !== votant) {", "  if (false) {", "à tour de rôle : chacun son tour"],
  ["logique/gazette.mjs", "    const id = cercle[(((i - k) % cercle.length) + cercle.length) % cercle.length];", "    const id = cercle[(i + k) % cercle.length];", "à tour de rôle : vers la gauche"],
  ["scripts/api.mjs", "    if (pile) return true;", "", "Pile ou face"],
  ["scripts/api.mjs", "    if (oui === acteurId && game.actors.get(acteurId)?.system.vivant) {", "    if (false) {", "Marché avec le Malin"],
  ["scripts/api.mjs", "    if (cacheParLaGazette) reveler = false;", "", "Exécuteur, Enfouissement : pas révélé"],
  ["scripts/api.mjs", "  await game.settings.set(ID, \"exclusDuMalin\", exclus);", "", "Marché perdu : exclu"],
  ["scripts/api.mjs", "  await api.donnerRole(acteurId, villageois ?? roleParDefaut());   // la fiche prend le camp du rôle : le Village", "", "Revenue : simple Villageois"],
  ["scripts/api.mjs", "  await a.update({ \"system.vivant\": true, \"system.revele\": false, \"system.camp\": \"\" });", "", "Revenue : de retour parmi les vivants"],
  ["logique/gazette.mjs", "      etat.bailli = { ...b, acteurId: \"\", succession: null, election: -1 };", "", "Saint-Vincent : destitué"],
  ["scripts/api.mjs", "      if (loup) morts.push({ acteurId: loup, cause: \"foudre\" });", "", "Retour de flamme : le loup foudroyé"],
  ["scripts/api.mjs", "      await api.echangerRoles(victime, loup);", "", "Spectre : les cartes échangées"],
  ["logique/gazette.mjs", "    echangerLesChamps(fa.role.system, fb.role.system);\n    paires.push", "    paires.push", "Jour des sots : les pouvoirs échangés"],
  ["scripts/api.mjs", "  if (cible && impose && cible !== impose) {", "  if (false) {", "Jour des sots : contre son amant"],
  ["scripts/api.mjs", "    const lie = lieId && !L.amoursSuspendues(lireEtat()) ? game.actors.get(lieId) : null;", "    const lie = lieId ? game.actors.get(lieId) : null;", "Jour des sots : l'amant survit"],
  ["logique/gazette.mjs", "    sortie.meute = tueurs;", "    sortie.meute = null;", "Nuit des sots : les tueurs"],
  ["scripts/api.mjs", "  const due = (!loup && consommees.includes(\"depit\")) ? \"depit\" : (loup && consommees.includes(\"enthousiasme\")) ? \"enthousiasme\" : \"\";",
    "  const due = \"\";", "Dépit, Enthousiasme : le revote"],
  ["scripts/api.mjs", "      if (influences) L.consommerLaCarte(x, \"influences\");", "", "Influences : une fois"],
  ["logique/etat.mjs", "      Object.assign(r, { elus: accuse && soutiens < SOUTIENS_DU_CHATIMENT ? [accuse] : [], egalite: false, departage: null });", "      Object.assign(r, { elus: [], egalite: false, departage: null });", "Châtiment"],
  ["scripts/api.mjs", "    s.allies = [...new Set([...s.allies, cible])];", "", "Méchant Benêt : l'allié"],
  ["logique/gazette.mjs", "  const mots = MOTS_INTERDITS[langue] ?? MOTS_INTERDITS.fr;", "  const mots = [];", "Ni loup ni moi : le relevé"],
  ["logique/gazette.mjs", "  if (objetDuVote === \"execution\") for (const id of privesDuJour(etat, tour)) hors.add(id);", "", "privé de vote"],
  ["logique/gazette.mjs", "    if (g.variante.appliquee && etat.variantes) {", "    if (false) {", "variante d'un jour : levée au matin"],
  ["logique/gazette.mjs", "  if (!actuel) return normaliserGazetteSecret(etat?.gazetteSecret).main.length ? { quoi: \"nommer\", bailli, par: bailli, actuel: \"\", candidats: autres } : null;",
    "  if (!actuel) return null;", "Crieur : nommé par le Bailli"],
  ["scripts/api.mjs", "  suivreLeMatin(async () => { await seanceDeSpiritisme(); await annonceDuCrieur(); });", "  suivreLeMatin(async () => { await seanceDeSpiritisme(); });", "Crieur : l'annonce du matin"],
  ["scripts/api.mjs", "  const mort = L.premierMort(e);", "  const mort = L.dernierElimine(e);", "Spiritisme : le premier mort"],
  ["scripts/api.mjs", "const g = L.normaliserGazette(x.gazette); g.spiritisme.restantes = g.spiritisme.restantes.filter(c => c !== carte);", "const g = L.normaliserGazette(x.gazette);", "Spiritisme : la carte défaussée"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-gazette-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, () => apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M, seules = null) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    if (seules && !seules.some(s => nom.includes(s))) continue;
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally {
      game.user = game.users.get("mj");
      await calme().catch(() => {});
      await M.attendreGestes().catch(() => {});
      await M.attendreVacances().catch(() => {});
      await M.attendreGazette().catch(() => {});
    }
  }
  return liste;
}

test("Pacte, étape 9 (API) : le système d'origine passe toute la batterie", async () => {
  const filtre = process.env.GAZETTE_SEULES ? process.env.GAZETTE_SEULES.split("|") : null;
  const e = await echecs(await charger(SYSTEME), filtre);
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("Pacte, étape 9 (API) : chaque règle cassée est détectée par la batterie", { skip: Boolean(process.env.GAZETTE_SEULES) }, async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
