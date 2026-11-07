// Le Pacte, étape 5 : le mode « Le Pacte » et les variantes du jeu de soirée dans l'API du système (game.lakourLoups), sur la doublure de
// Foundry. La distribution (variantes annoncées, publiques, retenues par les réglages ; Le Pacte sans bâtiment ni métier, seulement les
// rôles du livre ; les Vendanges et leur loup de plus) ; la Veillée aux chandelles angoissante (des loups en désaccord : pas de victime,
// les chandelles annoncées au matin ; d'accord : la victime, sa chandelle éteinte) ; la Chaîne des innocents (du voisin de gauche du
// dernier éliminé au dernier debout, condamné ; pas de vote pendant ce temps) ; le Mur des murmures (des phrases sans auteur, lues au
// matin) ; Double visage (petite : allégeances secrètes, rôles visibles retournés sans camp ; grande : deux cartes, la seconde à la
// fiche) ; les Vendanges (la fiole unique, le Chapardeur qui échange avec un joueur, le Bailli qui vote d'abord et à découvert, l'amour
// qui interdit un vote, le Souffre-douleur à la place d'un voisin, le triangle de l'Entremetteuse) ; l'Envoûtement (pas de mort, des
// pouvoirs perdus, la chute des envoûtés d'avant, la victoire de la meute). Chaque vérification est rejouée sur des copies mutées du
// système (une règle cassée à la fois). Et, demandés par Jordan : les bâtiments du village (aucun, tirés, choisis) et les métiers (oui,
// non) d'une partie, retenus ; l'explication de sa place (rôle, quand il est appelé, victoire, métier, personnalité) au seul carnet de
// chaque joueur humain, dès la distribution.  Lancer : npm run essais
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
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, attendreVacances: api.attendreVacances, socket, reglages: reglagesM, L, racine };
}

async function monde(M) {
  installerFoundry({ joueurs: 8, contenu: true });
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
    herbo: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 }, nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true } }),
    garde: role("Garde du pont", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20, soiMeme: true } }),
    bouc: role("Souffre-douleur", { cle: "souffre-douleur", effet: "egalite" }),
    chapardeur: role("Chapardeur", { cle: "chapardeur", effet: "chaparder", nuit: { actif: true, ordre: 1, cibles: 1, premiereNuitSeulement: true } }),
    entremetteuse: role("Entremetteuse", { cle: "entremetteuse", effet: "lien-amour", nuit: { actif: true, ordre: 3, cibles: 2, soiMeme: true, premiereNuitSeulement: true } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const de = c => villageois().find(a => cle(a) === c);
const tous = c => villageois().filter(a => cle(a) === c);
const n = (U, k, r = "villageois") => Array.from({ length: k }, () => U[r]);
async function partie(M, roles, { variantes = {}, graine = "variantes" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine, composition: "essai", batiments: [], variantes });
}
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
const repondre = (d, ids, texte = "") => envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: ids, texte, userId: d.destinataire }, { emetteur: d.destinataire });
async function repondreA(acteur, ids, k, message, texte = "") {
  await attendre(() => demandeDe(acteur, k), message);
  const d = demandeDe(acteur, k);
  repondre(d, ids, texte);
  return d;
}
const explicationDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur
  && String(e.entree?.titre ?? "").startsWith("Comment jouer")).map(e => `${e.entree.titre}\n${e.entree.html ?? ""}`).join("\n");
const carnetDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "");
const avisA = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "avis" && e.recipients?.[0] === acteur.system.joueur).map(e => e.texte);
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;/g, "'")).join("\n");
const pub = () => game.settings.get("lakour-loups", "partie");
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

const VERIFICATIONS = {
  async "bâtiments du village (aucun, choisis, tirés) et métiers (oui, non) : la composition les suit, le réglage s'en souvient"(M) {
    await monde(M);
    const sans = await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, niveau: "classique", graine: "simple", batiments: "aucun", metiers: false });
    assert.deepEqual(sans.composition.batiments, [], "aucun bâtiment");
    assert.deepEqual(M.api.etat().batimentsCles, [], "rien n'en dépend");
    assert.ok(villageois().every(a => !a.items.some(i => i.type === "metier")), "aucun métier");
    assert.deepEqual([game.settings.get("lakour-loups", "batimentsDuVillage"), game.settings.get("lakour-loups", "metiersEnJeu")], ["aucun", false]);
    const contenu = await M.api.contenu();
    assert.deepEqual(M.api.logique.composer(10, contenu.equilibre, { niveau: "classique", graine: "x" }).batiments, [], "le générateur du MJ IA aussi");
    const rejouee = await M.api.nouvellePartie({ memesJoueurs: true, graine: "rejouer" });
    assert.deepEqual(rejouee.composition.batiments, [], "« Rejouer » s'en souvient");
    const choisis = await M.api.nouvellePartie({ memesJoueurs: true, niveau: "classique", graine: "choisis", batiments: ["chapelle", "puits"], metiers: true });
    assert.deepEqual([...choisis.composition.batiments].sort(), ["chapelle", "puits"]);
    assert.ok(villageois().every(a => a.items.some(i => i.type === "metier")), "les métiers reviennent");
    const pretes = await M.api.nouvellePartie({ memesJoueurs: true, composition: "classique-08", batiments: "aucun" });
    assert.deepEqual(pretes.composition.batiments, [], "une composition prête aussi");
    const tires = await M.api.nouvellePartie({ memesJoueurs: true, niveau: "classique", graine: "tires", batiments: "hasard" });
    assert.ok(tires.composition.batiments.length >= 4, "tirés au hasard, comme avant");
  },

  async "explication à la distribution : rôle, quand il est appelé, victoire, métier, personnalité ; au seul carnet de son joueur"(M) {
    await monde(M);
    const k = emissions.length;
    await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, niveau: "classique", graine: "explication", village: true, metiers: true, batiments: "hasard" });
    for (const a of villageois()) {
      const texte = explicationDe(a, k);
      assert.ok(texte.includes(`Comment jouer : ${roleDe(a).name}`), `${a.name} : son explication`);
      assert.ok(texte.includes("Quand le narrateur vous appelle"), `${a.name} : quand il est appelé`);
      assert.ok(texte.includes("Comment vous gagnez"), `${a.name} : comment il gagne`);
      const metier = a.items.find(i => i.type === "metier");
      assert.ok(metier && texte.includes(metier.name), `${a.name} : son métier`);
      const p = M.api.personnalite(a.id);
      if (p?.personnalite && p.personnalite !== "chemineau") assert.ok(texte.includes("Votre personnalité"), `${a.name} : sa personnalité`);
      const autres = emissions.slice(k).filter(e => e.type === "secret" && String(e.entree?.titre ?? "").startsWith("Comment jouer") && e.recipients?.[0] !== a.system.joueur);
      assert.ok(!autres.some(e => e.entree.titre === `Comment jouer : ${roleDe(a).name}` && villageois().filter(b => roleDe(b).name === roleDe(a).name).length === 1),
        `${a.name} : son explication à lui seul`);
    }
    assert.ok(villageois().some(a => M.api.personnalite(a.id)?.personnalite && M.api.personnalite(a.id).personnalite !== "chemineau"), "des personnalités en jeu");
  },

  async "distribution : les variantes annoncées et publiques ; retenues ; Le Pacte (livre seul, sans bâtiment ni métier) ; les Vendanges et leur loup"(M) {
    const U = await monde(M);
    const k = messages.length;
    await partie(M, [U.loup, ...n(U, 5)], { variantes: { chandelles: true, mur: true } });
    const v = pub().variantes;
    assert.deepEqual([v.chandelles, v.mur, v.chaine, v.doubleVisage, v.vendanges], [true, true, false, "", false]);
    assert.match(chat(k), /Variantes de cette veillée : Veillée aux chandelles, Le Mur des murmures\./);
    assert.ok(M.api.registre().some(x => x.type === "variante" && x.quoi === "distribution"));
    await partie(M, [U.loup, ...n(U, 5)]);
    assert.equal(pub().variantes.chandelles, false, "distribuer : les réglages (non par défaut)");
    const r = await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, niveau: "le-pacte", graine: "pacte", variantes: { vendanges: true, envoutement: true } });
    assert.ok(r.composition.roles.every(M.L.estDuLivre), r.composition.roles.join(", "));
    assert.deepEqual(r.composition.batiments, []);
    assert.equal(r.composition.roles.filter(c => M.L.ROLES_DU_LIVRE.includes(c) && ["loup-de-brumecombe", "loup-affame", "louve-mere", "loup-pale"].includes(c)).length,
      M.L.nombreDeLoups(8) + 1, "un loup de plus");
    assert.ok(villageois().every(a => !a.items.some(i => i.type === "metier")), "pas de métier");
    assert.deepEqual([r.variantes.vendanges, r.variantes.envoutement], [true, true]);
    assert.equal(game.settings.get("lakour-loups", "vendanges"), true, "le choix explicite est retenu");
    const r2 = await M.api.nouvellePartie({ memesJoueurs: true, graine: "rejouer" });
    assert.equal(r2.variantes.vendanges, true, "« Rejouer » le reprend");
    const r3 = await M.api.nouvellePartie({ memesJoueurs: true, niveau: "petite-tablee", graine: "tablee", variantes: { vendanges: true, mur: true } });
    assert.deepEqual([r3.variantes.vendanges, r3.variantes.envoutement, r3.variantes.mur], [false, false, true], "ni Vendanges ni Envoûtement à la petite tablée");
  },

  async "chandelles angoissantes : en désaccord, pas de victime et les chandelles annoncées ; d'accord, la victime et sa chandelle"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, ...n(U, 4)], { variantes: { chandelles: true, angoissante: true } });
    const [l1, l2] = tous("loup-de-brumecombe");
    const [a, b, c] = tous("villageois");
    await M.api.changerPhase("nuit");
    let k = emissions.length;
    const p = M.api.reveiller("meute", { delai: 5000 });
    await repondreA(l1, [a.id], k, "loup 1");
    await repondreA(l2, [b.id], k, "loup 2");
    await p;
    const m = messages.length;
    const r = await aube(M);
    assert.deepEqual(r.morts, [], "pas de victime");
    assert.match(chat(m), /les chandelles de .+ se sont éteintes ensemble/);
    assert.ok(chat(m).includes(a.name) && chat(m).includes(b.name));
    assert.deepEqual(pub().variantes.ratees.at(-1).ids.sort(), [a.id, b.id].sort());
    assert.ok(M.api.registre().some(x => x.type === "variante" && x.quoi === "chandelles"));
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    k = emissions.length;
    const p2 = M.api.reveiller("meute", { delai: 5000 });
    await repondreA(l1, [c.id], k, "loup 1");
    await repondreA(l2, [c.id], k, "loup 2");
    await p2;
    const m2 = messages.length;
    const r2 = await aube(M);
    assert.deepEqual(r2.morts, [c.id], "d'accord : la victime");
    assert.match(chat(m2), new RegExp(`La chandelle de ${c.name} s'éteint`));
  },

  async "chaîne des innocents : du voisin de gauche du dernier éliminé au dernier debout ; pas de vote pendant ce temps"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 4)], { variantes: { chaine: true } });
    const ordre = villageois();
    await asseoir(ordre);
    const [a0, a1, a2, a3, a4] = ordre;
    await M.api.changerPhase("nuit");
    await aube(M);
    await M.api.changerPhase("jour");
    await M.api.eliminer(a2.id, { cause: "narrateur" });
    const m = messages.length, k = emissions.length;
    await M.api.ouvrirVote({});
    assert.match(chat(m), new RegExp(`${a1.name}, à la gauche du dernier éliminé`));
    assert.ok(pub().vote.chaine, "le vote est une chaîne (public)");
    await voter([[a3, a4]]);
    assert.ok(avisA(a3, k).some(t => /pas de vote/.test(t)), "pas de vote : la chaîne");
    await repondreA(a1, [a0.id], k, "a1 désigne");
    await repondreA(a0, [a4.id], k, "a0 désigne");
    const d = await repondreA(a4, [a3.id], k, "a4 désigne");
    assert.deepEqual(d.candidats.map(c => c.id).sort(), [a1.id, a3.id].sort(), "parmi les debout, lui assis");
    const r = await M.api.cloreVote();
    assert.deepEqual([r.elu, r.elus], [a1.id, [a1.id]]);
    assert.match(chat(m), new RegExp(`${a1.name} reste seul debout`));
    assert.match(chat(m), new RegExp(`${a1.name} garantit l'innocence de ${a0.name}`));
    const ligne = M.api.registre().filter(x => x.type === "vote").at(-1)?.ligne ?? "";
    assert.match(ligne, /Chaîne des innocents/);
    assert.equal(M.api.etapeSuivante().cle, "executer");
  },

  async "mur des murmures : chaque vivant écrit ou passe ; au matin, les phrases sans auteur"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 4)], { variantes: { mur: true } });
    await M.api.changerPhase("nuit");
    assert.equal(M.api.ordreDeNuit().at(-1).roleCle, "mur");
    const k = emissions.length;
    const p = M.api.reveiller("mur", { delai: 5000 });
    const gens = villageois();
    for (const [i, a] of gens.entries()) await repondreA(a, [], k, `mur ${i}`, i === 4 ? "" : `Phrase ${i} : la brume monte.`);
    await p;
    assert.ok(!M.api.ordreDeNuit().some(e => e.roleCle === "mur" && M.api.etapeSuivante().donnees?.role === "mur"), "l'étape est faite");
    const actions = M.api.etat().nuit.actions;
    assert.ok(actions.some(x => x.roleCle === "mur" && x.acteurId === ""), "notée sans acteur");
    assert.ok(!JSON.stringify(M.api.etat()).match(/Phrase \d : la brume monte\.","acteurId|acteurId":"[^"]+","roleCle":"mur"/), "aucun auteur gardé");
    const m = messages.length;
    await aube(M);
    assert.match(chat(m), /Sur le Mur des murmures, ce matin/);
    const textes = pub().variantes.murmures.textes;
    assert.equal(textes.length, 4, "quatre phrases (un a passé)");
    for (const a of gens) assert.ok(!chat(m).includes(a.name) && textes.every(t => !t.includes(a.name)), `${a.name} jamais nommé`);
  },

  async "Double visage, petite : allégeances secrètes, rôles visibles retournés sans camp ; la meute d'allégeance"(M) {
    await monde(M);
    const m = messages.length;
    const r = await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, graine: "visages", variantes: { doubleVisage: "petite" } });
    assert.equal(r.composition.cle, "double-visage");
    const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute");
    assert.equal(loups.length, 2, "deux allégeances de loup");
    for (const a of villageois()) {
      assert.ok(a.system.revele && a.items.some(i => i.type === "role" && i.system.cle === cle(a)), `${a.name} : rôle visible retourné`);
      assert.equal(a.system.camp, "", `${a.name} : pas de camp public`);
      assert.ok(carnetDe(a).some(t => /Double visage : votre carte d'allégeance/.test(t)), `${a.name} : son allégeance au carnet`);
    }
    assert.match(chat(m), /Double visage : .+ montre son rôle visible/);
    await M.api.changerPhase("nuit");
    assert.deepEqual(M.api.ordreDeNuit().find(e => e.roleCle === "meute").acteurIds.sort(), loups.map(a => a.id).sort());
  },

  async "Double visage, une allégeance loup de plus (Le Pacte, étape 6c) : petite et grande complication, annoncée à tous"(M) {
    await monde(M);
    const m = messages.length;
    await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, graine: "visages", variantes: { doubleVisage: "petite", allegeanceLoup: true } });
    assert.equal(villageois().filter(a => secretDuMJ.camp(a) === "meute").length, 3, "trois allégeances de loup au lieu de deux");
    assert.equal(M.api.etat().variantes.allegeanceLoup, true, "une règle publique de la veillée");
    assert.match(chat(m), /une allégeance loup de plus/);
    assert.equal(game.settings.get("lakour-loups", "allegeanceLoupEnPlus"), true, "le choix retenu par le réglage");
    await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, graine: "visages-g", variantes: { doubleVisage: "grande" } });
    const cartes = M.api.etat().variantesSecret.cartes;
    assert.equal(Object.values(cartes).flat().filter(c => c === M.L.CARTE_LOUP).length, 3, "grande : trois cartes de loup (le réglage retenu)");
    await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, graine: "visages", variantes: { doubleVisage: "petite", allegeanceLoup: false } });
    assert.equal(villageois().filter(a => secretDuMJ.camp(a) === "meute").length, 2, "décoché : le paquet du livre");
  },

  async "Double visage, grande : deux cartes par joueur, la principale au rôle, la seconde à la fiche, le camp du loup"(M) {
    await monde(M);
    let seconde = false;
    for (let g = 0; g < 6 && !seconde; g++) {
      await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS, graine: `grande-${g}`, variantes: { doubleVisage: "grande" } });
      const cartes = M.api.etat().variantesSecret.cartes;
      for (const a of villageois()) {
        const x = M.L.lireDeuxCartes(cartes[a.id]);
        assert.equal(cle(a), x.principale, `${a.name} : sa carte principale`);
        assert.equal(secretDuMJ.camp(a), x.camp, `${a.name} : son camp`);
        assert.equal(secretDuMJ.fiche(a).seconde?.system?.cle ?? "", x.seconde, `${a.name} : sa seconde carte`);
        assert.equal(a.system.revele, false, "rien de retourné");
        if (x.seconde) seconde = true;
      }
    }
    assert.ok(seconde, "au moins un joueur à deux pouvoirs");
  },

  async "Vendanges : fiole unique, Chapardeur qui échange, Bailli d'abord et à découvert, l'amour, le Souffre-douleur à la place d'un voisin"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.loup, U.herbo, U.chapardeur, U.bouc, ...n(U, 3)], { variantes: { vendanges: true } });
    const herbo = de("herboriste"), chap = de("chapardeur"), bouc = de("souffre-douleur");
    assert.deepEqual([roleDe(herbo).system.usages.max, roleDe(herbo).system.nuit.cibles], [1, 1], "l'Herboriste n'a qu'une fiole");
    const [v1, v2, v3] = tous("villageois");
    const [l1, l2] = tous("loup-de-brumecombe");
    await asseoir([l1, v1, bouc, v2, l2, herbo, chap, v3]);
    await M.api.changerPhase("nuit");
    assert.deepEqual(M.api.candidatsDeNuit({ roleCle: "meute" }).sort(), [v1.id, v2.id, herbo.id, v3.id].sort(), "les voisins des loups");
    assert.equal(M.api.candidatsDeNuit({ acteurId: chap.id, roleCle: "chapardeur" }).length, 7, "un joueur, pas une carte");
    await M.api.noterAction({ acteurId: chap.id, roleCle: "chapardeur", cibles: [herbo.id] });
    await aube(M);
    assert.equal(cle(chap), "herboriste", "le Chapardeur a pris la carte de l'Herboriste");
    assert.equal(cle(herbo), "chapardeur");
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(v3.id);
    await M.api.reglerFiche(v1.id, { amoureux: v2.id });
    await M.api.reglerFiche(v2.id, { amoureux: v1.id });
    const m = messages.length, k = emissions.length;
    await M.api.ouvrirVote({});
    assert.match(chat(m), new RegExp(`${v3.name}, le Bailli, vote seul et le premier`));
    await voter([[l1, v2]]);
    assert.ok(avisA(l1, k).some(t => /le Bailli vote d'abord/.test(t)), "les autres attendent le Bailli");
    await voter([[v3, v2]]);
    assert.match(chat(m), new RegExp(`Le Bailli ${v3.name} a voté le premier : contre ${v2.name}`));
    await voter([[v1, v2]]);
    assert.ok(avisA(v1, k).some(t => /l'amour vous interdit/i.test(t) || /amour vous interdit/.test(t)), "deux amants ne votent pas l'un contre l'autre");
    await voter([[l1, v2], [l2, v2], [herbo, v2], [chap, v2]]);
    const r = await M.api.cloreVote();
    assert.deepEqual([r.elus, r.souffreDouleur, r.remplace], [[bouc.id], bouc.id, v2.id], "le Souffre-douleur à la place de son voisin");
    assert.match(chat(m), new RegExp(`${bouc.name}, le Souffre-douleur, meurt à la place de son voisin ${v2.name}`));
  },

  async "Vendanges : le triangle de l'Entremetteuse — le trompé n'entraîne personne, l'amant entraîne les deux autres"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.entremetteuse, ...n(U, 5)], { variantes: { vendanges: true } });
    const ent = de("entremetteuse");
    const [g, h, e, x] = tous("villageois");
    await M.api.changerPhase("nuit");
    assert.ok(M.api.ordreDeNuit().some(s => s.roleCle === "tromperie"), "la tromperie, la première nuit");
    await M.api.noterAction({ acteurId: ent.id, roleCle: "entremetteuse", cibles: [g.id, h.id] });
    await M.api.noterAction({ acteurId: ent.id, roleCle: "tromperie", cibles: [g.id, e.id] });
    await aube(M);
    assert.deepEqual(M.api.etat().variantesSecret.triangle, { trompeur: g.id, trompe: h.id, amant: e.id });
    assert.deepEqual([secretDuMJ.amoureux(g), secretDuMJ.amoureux(e), secretDuMJ.amoureux(h)], [e.id, g.id, g.id]);
    await M.api.changerPhase("jour");
    assert.deepEqual(await M.api.eliminer(h.id, { cause: "narrateur" }), [h.id], "le trompé n'entraîne personne");
    const morts = await M.api.eliminer(e.id, { cause: "narrateur" });
    assert.deepEqual(morts.sort(), [e.id, g.id].sort(), "l'amant entraîne le trompeur");
    assert.ok(x.system.vivant);
  },

  async "envoûtement : pas de mort, les pouvoirs perdus ; une envoûtée condamnée entraîne les précédentes ; la meute gagne"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.herbo, ...n(U, 4)], { variantes: { envoutement: true } });
    const loup = de("loup-de-brumecombe"), herbo = de("herboriste");
    const [a, b, c, d] = tous("villageois");
    await M.api.changerPhase("nuit");
    const k = emissions.length;
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [herbo.id] });
    const r = await aube(M);
    assert.deepEqual(r.morts, [], "l'aube est calme");
    assert.ok(herbo.system.vivant);
    assert.deepEqual([roleDe(herbo).name, roleDe(herbo).system.effet, roleDe(herbo).system.nuit.actif], ["Herboriste", "", false], "plus de pouvoir");
    assert.ok(carnetDe(herbo, k).some(t => /vous êtes envoûté/.test(t)), "elle le sait");
    assert.ok(!carnetDe(a, k).some(t => /envoûté/.test(t)), "personne d'autre");
    assert.deepEqual(M.api.etat().variantesSecret.envoutes.map(e => e.acteurId), [herbo.id]);
    assert.ok(!JSON.stringify(pub()).includes("envoutes\":[{"), "rien de public");
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [a.id] });
    await aube(M);
    assert.equal(await M.api.verifierVictoire(), "", "trois villageois libres : la veillée continue");
    await M.api.changerPhase("jour");
    const m = messages.length;
    const morts = await M.api.eliminer(a.id, { cause: "vote" });
    assert.deepEqual(morts.sort(), [a.id, herbo.id].sort(), "l'envoûtée d'avant tombe avec elle");
    assert.match(chat(m), new RegExp(`${a.name} était envoûté : ${herbo.name} tombent avec lui`));
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [b.id] });
    await aube(M);
    assert.equal(await M.api.verifierVictoire(), "", "deux libres");
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [c.id] });
    await aube(M);
    assert.ok(d.system.vivant);
    assert.equal(await M.api.verifierVictoire(), "meute", "l'avant-dernier villageois envoûté");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    if (!court) compo.batiments = batimentsDuReglage({ batiments: compo.batiments }).batiments;", "", "bâtiments : aucun, ou choisis"],
  ["scripts/api.mjs", "const avecMetiers = lireReglage(\"metiersEnJeu\", true) !== false && ", "const avecMetiers = ", "métiers : non"],
  ["scripts/api.mjs", "  logique: { ...L, composer: (n, equilibre, options = {}) => batimentsDuReglage(L.composer(", "  logique: { ...L, composer: (n, equilibre, options = {}) => ((x) => x)(L.composer(", "bâtiments : le générateur du MJ IA"],
  ["scripts/api.mjs", "    for (const s of sortie) await envoyerExplication(game.actors.get(s.acteurId));", "", "explication : à la distribution"],
  ["scripts/api.mjs", "  if (metier) {\n    parties.push(", "  if (false) {\n    parties.push(", "explication : le métier"],
  ["scripts/api.mjs", "  if (p) parties.push(", "  if (false) parties.push(", "explication : la personnalité"],
  ["scripts/api.mjs", "    `<p><strong>${e(t(\"LAKOUR_LOUPS.Explication.QuandTitre\"))}</strong> ${e(rythmeDuRole(role.system))}</p>`];", "  ];", "explication : quand il est appelé"],
  ["scripts/api.mjs", "    if (L.chandellesAngoissantes(etat)) {", "    if (false) {", "chandelles : chaque loup souffle"],
  ["scripts/api.mjs", "      chandelles = L.chandellesDuMatin(e, tour);", "      chandelles = [];", "chandelles : annoncées au matin"],
  ["scripts/api.mjs", "    if (L.chandellesActives(lireEtat())) await annonceChat(", "    if (false) await annonceChat(", "chandelles : celle d'un mort s'éteint"],
  ["scripts/api.mjs", "      lancerLaChaine(etat.vote.numero);", "", "chaîne : elle se mène"],
  ["scripts/api.mjs", "  if (enCours.vote.chaine) { avis(", "  if (false) { avis(", "chaîne : pas de vote"],
  ["scripts/api.mjs", "      if (texte) await modifierEtat(e => L.graverUnMurmure(e, texte));", "      if (texte) await modifierEtat(e => L.graverUnMurmure(e, `${nomDe(id)} : ${texte}`));", "mur : sans auteur"],
  ["scripts/api.mjs", "      if (L.murActif(e)) mur = L.lireLeMur(e, tour);", "", "mur : lu au matin"],
  ["scripts/api.mjs", "        fiches[acteur.id] = { ...fiches[acteur.id], camp: visage.camp };", "", "Double visage : l'allégeance"],
  ["scripts/api.mjs", "L.allegeances(tirage.length, hasardDesVisages, choixVariantes.allegeanceLoup)", "L.allegeances(tirage.length, hasardDesVisages)", "Double visage : une allégeance loup de plus"],
  ["scripts/api.mjs", "    await revelerPubliquement(id, { sansCamp: true });", "    await revelerPubliquement(id);", "Double visage : le rôle visible sans camp"],
  ["scripts/api.mjs", "          fiches[acteur.id] = L.normaliserFiche({ ...fiches[acteur.id], seconde:", "          if (false) fiches[acteur.id] = L.normaliserFiche({ ...fiches[acteur.id], seconde:", "Double visage : la seconde carte"],
  ["scripts/api.mjs", "      if (choixVariantes.vendanges) roleData = L.roleDesVendanges(roleData);", "", "Vendanges : la fiole unique"],
  ["scripts/api.mjs", "    if (vendanges && role?.system.effet === L.EFFET_CHAPARDEUR && role.system.cle === cle) effet = \"echanger-role\";", "", "Vendanges : le Chapardeur échange"],
  ["scripts/api.mjs", "  if (L.attendLeBailli(enCours.vote, votant)) {", "  if (false) {", "Vendanges : le Bailli d'abord"],
  ["scripts/api.mjs", "    await publierLeVoteDuBailli(votant, cible || \"\", r.etat.vote.numero);", "", "Vendanges : le vote du Bailli à découvert"],
  ["scripts/api.mjs", "  if (cible && voteInterdit(enCours, votant, cible)) {", "  if (false) {", "Vendanges : l'amour interdit un vote"],
  ["scripts/api.mjs", "...(vendanges && bouc ? { boucDesVendanges: bouc,", "...(false ? { boucDesVendanges: bouc,", "Vendanges : le Souffre-douleur à la place d'un voisin"],
  ["scripts/api.mjs", "          majFiche(e, c.amant, f => ({ ...f, amoureux: c.trompeur }));", "", "Vendanges : l'amant du triangle"],
  ["scripts/api.mjs", "    const lieId = triangle?.trompe === acteurId ? \"\" : amoureuxDe(acteur);", "    const lieId = amoureuxDe(acteur);", "Vendanges : le trompé n'entraîne personne"],
  ["scripts/api.mjs", "const loupsEnPlus = choixVariantes.vendanges ? L.LOUPS_DES_VENDANGES : 0;", "const loupsEnPlus = 0;", "Vendanges : un loup de plus"],
  ["scripts/api.mjs", "    await envouterLesProies(r.envoutes ?? [], tour);", "", "Envoûtement : les pouvoirs perdus"],
  ["scripts/api.mjs", "    if (cause === \"vote\" && L.envoutementActif(lireEtat())) morts.push(...await chuteDesEnvoutes(acteurId));", "", "Envoûtement : la chute"],
  ["scripts/api.mjs", "...L.contexteDesAmbigus(e), ...L.contexteDesVariantes(e), villageois", "...L.contexteDesAmbigus(e), villageois", "Envoûtement : la victoire"],
  ["scripts/api.mjs", "lireReglage(\"metiersEnJeu\", true) !== false && compo.niveau !== L.NIVEAU_LE_PACTE;", "lireReglage(\"metiersEnJeu\", true) !== false;", "Le Pacte : sans métier"],
  ["scripts/api.mjs", "    await retenirLesVariantes(variantes);", "", "variantes retenues par les réglages"],
  ["scripts/api.mjs", "      e.variantes = L.variantesInitiales(choixVariantes);", "      e.variantes = L.variantesInitiales();", "variantes recopiées dans l'état"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-variantes-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, () => apres));
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

test("Pacte, étape 5 (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 5 (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
