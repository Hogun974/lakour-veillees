// Le Pacte, étape 3b : les ambigus, les solitaires du livre et le Loup pâle dans l'API du système (game.lakourLoups), sur la doublure
// de Foundry. Le Chapardeur (deux cartes au centre, en secret ; la carte prise, son nouveau rôle) ; le Bateleur (trois cartes annoncées,
// la carte jouée qui le réveille et protège, retirée au matin devant tous) ; le Mâtin (il rejoint la meute dès la première nuit, les
// loups l'apprennent) ; l'Enfant des bois (son modèle tombé, il passe à la meute) ; la Chambrière (la demande au décompte ; dévouée,
// le condamné tombe sans que sa carte soit montrée, elle prend son rôle remis à neuf ; Bailli, elle perd la charge ; amoureuse, rien) ;
// le Feu follet (le jour d'abord, annoncé ; éliminé au premier vote, il gagne ; sinon, villageois au matin) ; le Joueur de vielle (ses
// charmés se reconnaissent ; tous charmés, il gagne) ; l'Illuminé (les deux bords annoncés) ; le Loup pâle (une nuit sur deux, un loup
// dévoré). Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).  Lancer : npm run essais
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
  return { api: api.api, attendreGestes: api.attendreGestes, socket, reglages: reglagesM, L, racine };
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
    louve: role("Louve mère", { cle: "louve-mere", camp: "meute", effet: "mordre", usages: { max: 1, restant: 1 }, nuit: { actif: true, ordre: 41, cibles: 1, invite: "Infecter ?" } }),
    herboriste: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 },
      nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true, invite: "Désigne la victime pour la sauver, quelqu'un d'autre pour l'empoisonner." } }),
    chapardeur: role("Chapardeur", { cle: "chapardeur", effet: "chaparder", nuit: { actif: true, ordre: 1, cibles: 1, premiereNuitSeulement: true, invite: "Quelle carte prends-tu ?" } }),
    bateleur: role("Bateleur", { cle: "bateleur", effet: "emprunter", nuit: { actif: true, ordre: 2, cibles: 1, invite: "Quelle carte joues-tu cette nuit ?" } }),
    matin: role("Mâtin", { cle: "matin", effet: "choisir-camp", nuit: { actif: true, ordre: 38, cibles: 1, soiMeme: true, premiereNuitSeulement: true, invite: "Désigne-toi pour la meute." } }),
    enfant: role("Enfant des bois", { cle: "enfant-des-bois", effet: "modele", nuit: { actif: true, ordre: 13, cibles: 1, premiereNuitSeulement: true, invite: "Ton modèle ?" } }),
    chambriere: role("Chambrière", { cle: "chambriere", effet: "devouement" }),
    feu: role("Feu follet", { cle: "feu-follet", camp: "solitaire", victoireCle: "premier-tour", victoire: "<p>Éliminé au premier tour.</p>" }),
    vielle: role("Joueur de vielle", { cle: "joueur-de-vielle", camp: "solitaire", effet: "charmer", victoireCle: "tous-charmes", victoire: "<p>Tous charmés.</p>",
      nuit: { actif: true, ordre: 80, cibles: 2, invite: "Sous quelles fenêtres ?" } }),
    illumine: role("Illuminé", { cle: "illumine", camp: "solitaire", victoireCle: "autre-groupe", victoire: "<p>L'autre groupe éliminé.</p>" }),
    pale: role("Loup pâle", { cle: "loup-pale", camp: "meute", effet: "trahir", victoireCle: "seul-survivant", victoire: "<p>Le dernier vivant.</p>",
      nuit: { actif: true, ordre: 41, cibles: 1, uneNuitSurDeux: true, invite: "Quel loup dévores-tu ?" } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const campDe = a => secretDuMJ.camp(a);
const cle = a => roleDe(a)?.system.cle;
const de = c => villageois().find(a => cle(a) === c);
const tous = c => villageois().filter(a => cle(a) === c);
async function partie(M, roles, { joueurs = roles.length, graine = "pacte-ambigus" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, joueurs), graine, composition: "essai", batiments: [] });
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
// Un réveil (ou toute promesse qui attend une demande) : on attend la demande de cet acteur, on y répond, puis on attend la fin.
async function repondreA(promesse, acteur, ids, k) {
  await attendre(() => demandeDe(acteur, k), `la demande à ${acteur.name}`);
  const d = demandeDe(acteur, k);
  repondre(d, ids);
  await promesse;
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
  async "Chapardeur : deux cartes Villageois de plus, les deux non distribuées au centre en secret ; il en prend une et devient ce rôle"(M) {
    const U = await monde(M);
    // Une graine où le Chapardeur est distribué (le paquet compte deux cartes de plus : deux finissent au centre).
    for (let g = 0; g < 40 && !de("chapardeur"); g++) await partie(M, [U.loup, U.chapardeur, U.herboriste, U.villageois, U.villageois, U.villageois], { graine: `centre-${g}` });
    const chap = de("chapardeur");
    assert.ok(chap, "un Chapardeur distribué");
    const centre = M.api.etat().ambigusSecret.centre;
    assert.equal(centre.length, 2, "deux cartes au centre");
    assert.equal(villageois().length, 6);
    assert.deepEqual(game.settings.get("lakour-loups", "partie").ambigusSecret?.centre ?? [], [], "le centre est un secret");
    await M.api.changerPhase("nuit");
    assert.equal(M.api.ordreDeNuit()[0]?.roleCle, "chapardeur", "le tout premier réveil");
    const k = emissions.length;
    const d = await repondreA(M.api.reveiller("chapardeur", { delai: 2000 }), chap, ["centre-1"], k);
    assert.deepEqual(d.candidats.map(c => c.id), ["centre-0", "centre-1"]);
    assert.equal(cle(chap), centre[1].system.cle, "il tient la carte prise");
    assert.deepEqual(M.api.etat().ambigusSecret.centre.map(r => r.system.cle), [centre[0].system.cle, "chapardeur"], "sa carte au centre");
    assert.ok(carnetDe(chap, k).some(t => /tu es désormais/.test(t)), "il le sait");
  },

  async "Bateleur : trois cartes face visible, annoncées ; la carte jouée le réveille à son ordre et se joue avec son rôle ; retirée au matin"(M) {
    const U = await monde(M);
    const n = messages.length;
    await partie(M, [U.loup, U.louve, U.bateleur, U.villageois, U.villageois, U.villageois, U.villageois]);
    assert.equal(M.api.ambigus().bateleur.length, 3, "trois cartes");
    assert.match(chat(n), /Trois cartes sont posées face visible/);
    await M.api.cartesDuBateleur(["gardienne-des-cles", "garde-du-pont"]);
    assert.deepEqual(M.api.ambigus().bateleur.map(c => c.cle), ["gardienne-des-cles", "garde-du-pont"]);
    const [bat, loup, louve] = [de("bateleur"), de("loup-de-brumecombe"), de("louve-mere")];
    const [x] = tous("villageois");
    await M.api.changerPhase("nuit");
    let k = emissions.length;
    await repondreA(M.api.reveiller("bateleur", { delai: 2000 }), bat, ["gardienne-des-cles"], k);
    const etape = M.api.ordreDeNuit().find(e => e.roleCle === "gardienne-des-cles");
    assert.deepEqual(etape?.acteurIds, [bat.id], "réveillé pour la carte");
    k = emissions.length;
    await repondreA(M.api.reveiller("gardienne-des-cles", { delai: 2000 }), bat, [x.id], k);
    // La meute choisit x, la Louve le mord : la porte fermée par la clé (pas une simple garde) arrête même la morsure.
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [x.id] });
    await M.api.noterAction({ acteurId: louve.id, roleCle: "louve-mere", cibles: [x.id] });
    await M.api.changerPhase("aube");
    const m = messages.length;
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [], "la clé empruntée a tenu");
    assert.equal(campDe(x), "village", "ni mort ni mordu");
    assert.match(chat(m), /La carte « Gardienne des clés » du Bateleur a servi/);
    assert.deepEqual([M.api.ambigus().bateleur.map(c => c.cle), M.api.ambigus().retirees], [["garde-du-pont"], ["gardienne-des-cles"]]);
  },

  async "Mâtin : il se désigne et chasse avec la meute dès la première nuit ; les loups l'apprennent"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.matin, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, matin] = [de("loup-de-brumecombe"), de("matin")];
    await M.api.changerPhase("nuit");
    const k = emissions.length;
    await repondreA(M.api.reveiller("matin", { delai: 2000 }), matin, [matin.id], k);
    assert.equal(campDe(matin), "meute");
    assert.ok(M.api.ordreDeNuit().find(e => e.roleCle === "meute").acteurIds.includes(matin.id), "avec la meute dès cette nuit");
    assert.ok(carnetDe(loup, k).some(t => t.includes(matin.name)), "le loup l'apprend");
  },

  async "Enfant des bois : son modèle tombé (même au vote), il rejoint la meute en secret"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.enfant, U.villageois, U.villageois, U.villageois, U.villageois]);
    const enfant = de("enfant-des-bois");
    const [x] = tous("villageois");
    await M.api.changerPhase("nuit");
    const k = emissions.length;
    await M.api.noterAction({ acteurId: enfant.id, roleCle: "enfant-des-bois", cibles: [x.id] });
    assert.ok(carnetDe(enfant, k).some(t => t.includes(x.name)));
    assert.equal(campDe(enfant), "village");
    await M.api.eliminer(x.id, { cause: "vote" });
    assert.equal(campDe(enfant), "meute", "orphelin : loup");
    assert.ok(!enfant.system.revele && !enfant.system.camp, "en secret");
  },

  async "Chambrière : la demande au décompte ; dévouée, le condamné tombe sans montrer sa carte, elle prend son rôle remis à neuf"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.chambriere, U.herboriste, U.villageois, U.villageois, U.villageois]);
    const [loup, ch, herbo] = [de("loup-de-brumecombe"), de("chambriere"), de("herboriste")];
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(ch.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().filter(a => a.id !== herbo.id).map(a => [a, herbo]));
    const k = emissions.length;
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [herbo.id]);
    await attendre(() => demandeDe(ch, k), "la demande à la Chambrière");
    const d = demandeDe(ch, k);
    assert.deepEqual([d.objet, d.candidats.map(c => c.id)], ["chambriere", [herbo.id]]);
    const n = messages.length;
    repondre(d, [herbo.id]);
    await M.api.eliminer(herbo.id, { cause: "vote" });
    assert.equal(herbo.system.vivant, false);
    assert.ok(!herbo.system.revele && !herbo.items.some(i => i.type === "role"), "la carte du condamné n'est pas montrée");
    assert.ok(ch.system.revele && ch.items.some(i => i.type === "role" && i.system.cle === "chambriere"), "sa carte de Chambrière retournée");
    assert.equal(cle(ch), "herboriste");
    assert.equal(roleDe(ch).system.usages.restant, 2, "remis à neuf");
    assert.match(chat(n), new RegExp(`${ch.name} se dévoile : c'était la Chambrière`));
    assert.equal(M.api.bailli().acteurId, "", "la charge perdue");
    assert.deepEqual(M.api.ambigus().devouements.map(x => [x.acteurId, x.de]), [[ch.id, herbo.id]]);
    void loup;
  },

  async "Chambrière : amoureuse, rien ne lui est demandé"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.chambriere, U.villageois, U.villageois, U.villageois, U.villageois]);
    const ch = de("chambriere");
    const [x, y] = tous("villageois");
    await M.api.reglerFiche(ch.id, { amoureux: y.id });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().filter(a => a.id !== x.id).map(a => [a, x]));
    const k = emissions.length;
    await M.api.cloreVote();
    await M.api.eliminer(x.id, { cause: "vote" });
    assert.ok(!demandeDe(ch, k), "aucune demande");
    assert.equal(cle(ch), "chambriere");
  },

  async "Feu follet : la veillée commence par un jour, annoncé ; éliminé au premier vote, il gagne seul"(M) {
    const U = await monde(M);
    const n = messages.length;
    await partie(M, [U.loup, U.feu, U.villageois, U.villageois, U.villageois, U.villageois]);
    const feu = de("feu-follet");
    assert.equal(M.api.ambigus().commenceParLeJour, true);
    assert.match(chat(n), /Cette veillée commence par un jour/);
    assert.equal(M.api.etapeSuivante().cle, "debat");
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().filter(a => a.id !== feu.id).map(a => [a, feu]));
    await M.api.cloreVote();
    await M.api.eliminer(feu.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), feu.id);
  },

  async "Feu follet : passé la première nuit, il devient simple villageois (il le sait, lui seul)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.feu, U.villageois, U.villageois, U.villageois, U.villageois]);
    const feu = de("feu-follet");
    const [x] = tous("villageois");
    const k = emissions.length;
    await nuitCalme(M, [{ acteurId: de("loup-de-brumecombe").id, roleCle: "meute", cibles: [x.id] }]);
    assert.equal(campDe(feu), "village");
    assert.ok(carnetDe(feu, k).some(t => /ta flamme s'éteint/.test(t)));
    assert.equal(await M.api.verifierVictoire(), "");
  },

  async "Joueur de vielle : ses charmés se reconnaissent ; tous les autres charmés, il gagne seul"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.vielle, U.villageois, U.villageois, U.villageois]);
    const [loup, vielle] = [de("loup-de-brumecombe"), de("joueur-de-vielle")];
    const [x, y, z] = tous("villageois");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: vielle.id, roleCle: "joueur-de-vielle", cibles: [x.id, y.id] });
    const etape = M.api.ordreDeNuit().find(e => e.roleCle === "charmes");
    assert.deepEqual([...(etape?.acteurIds ?? [])].sort(), [x.id, y.id].sort(), "les charmés se réveillent ensemble");
    const k = emissions.length;
    await M.api.reveiller("charmes", { delai: 1000 });
    assert.ok(carnetDe(x, k).some(t => /Un air de vielle vous a charmés/.test(t) && t.includes(y.name)));
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    assert.equal(await M.api.verifierVictoire(), "");
    await nuitCalme(M, [{ acteurId: vielle.id, roleCle: "joueur-de-vielle", cibles: [loup.id, z.id] }]);
    assert.equal(await M.api.verifierVictoire(), vielle.id);
  },

  async "Illuminé : les deux bords du village annoncés à tous ; tout l'autre bord éliminé, il gagne"(M) {
    const U = await monde(M);
    const n = messages.length;
    await partie(M, [U.loup, U.illumine, U.villageois, U.villageois, U.villageois, U.villageois]);
    const ill = de("illumine");
    const g = M.api.ambigus().groupes;
    assert.ok(g?.a.length && g?.b.length, "deux bords");
    assert.match(chat(n), /Le village se partage en deux bords/);
    const autre = (g.a.some(x => x.id === ill.id) ? g.b : g.a).map(x => x.id);
    for (const id of autre) await M.api.eliminer(id, { cause: "narrateur" });
    assert.equal(await M.api.verifierVictoire(), ill.id);
  },

  async "Loup pâle : pas la première nuit ; la deuxième, il dévore un loup (on ne lui propose que des loups)"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, U.pale, U.villageois, U.villageois, U.villageois, U.villageois]);
    const pale = de("loup-pale");
    const [l1] = tous("loup-de-brumecombe");
    await nuitCalme(M);
    assert.ok(!M.api.etat().nuitPrecedente.actions.some(a => a.roleCle === "loup-pale"));
    await M.api.changerPhase("nuit");
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "loup-pale"), "la deuxième nuit");
    const k = emissions.length;
    const d = await repondreA(M.api.reveiller("loup-pale", { delai: 2000 }), pale, [l1.id], k);
    assert.deepEqual(d.candidats.map(c => c.id).sort(), tous("loup-de-brumecombe").map(a => a.id).sort());
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [l1.id]);
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    if (!(vendanges && effet === \"echanger-role\")) await suivreLesAmbigus({ acteurId, role, cle, cibles, carte });\n", "", "ambigus : leur choix appliqué"],
  ["scripts/api.mjs", "    const centre = avecCentre ? restants.map(", "    const centre = false ? restants.map(", "Chapardeur : le centre"],
  ["scripts/api.mjs", "    carte = chapardeur ? (choix ? Number(choix.slice(\"centre-\".length)) : \"\") : choix;", "    carte = \"\";", "Chapardeur et Bateleur : la carte choisie"],
  ["scripts/api.mjs", "    e.fiches = { ...e.fiches, [acteurId]: { ...L.ficheDuRole(x.pris, { source: x.pris.source ?? \"\" }), amoureux: f.amoureux } };\n", "", "Chapardeur : son nouveau rôle"],
  ["scripts/api.mjs", "    e.ambigusSecret = { ...e.ambigusSecret, emprunts: { ...e.ambigusSecret.emprunts, [acteurId]: { cle, tour: e.tour, role } } };\n", "", "Bateleur : la carte jouée"],
  ["scripts/api.mjs", "      emprunts: L.empruntsDeLaNuit(avant, tour),\n", "", "Bateleur : résolue avec la carte"],
  ["scripts/api.mjs", "    const cartesRetirees = await retirerLesCartesJouees(tour);", "    const cartesRetirees = [];", "Bateleur : la carte retirée au matin"],
  ["scripts/api.mjs", "    if (paquet.includes(L.CLE_BATELEUR) && !enTablee) {", "    if (false) {", "Bateleur : ses cartes à la distribution"],
  ["scripts/api.mjs", "  if (!meute) return envoyerSecret(acteurId, { texte: t(\"LAKOUR_LOUPS.Ambigus.MatinVillage\") });\n  await api.changerCamp(acteurId, \"meute\");\n",
    "  if (!meute) return envoyerSecret(acteurId, { texte: t(\"LAKOUR_LOUPS.Ambigus.MatinVillage\") });\n", "Mâtin : la meute"],
  ["scripts/api.mjs", "  for (const l of loups) await envoyerSecret(l.id, { texte: t(\"LAKOUR_LOUPS.Ambigus.RejointLaMeute\", { nom: nomDe(acteurId) }) });\n", "", "Mâtin : les loups l'apprennent"],
  ["scripts/api.mjs", "    await orphelinsDe(acteurId);\n", "", "Enfant des bois : orphelin"],
  ["scripts/api.mjs", "    proposerLeDevouement(resultat);\n", "", "Chambrière : la demande"],
  ["scripts/api.mjs", "    const montrer = chambriere ? false : reveler ?? reglage(\"revelerALaMort\");", "    const montrer = reveler ?? reglage(\"revelerALaMort\");", "Chambrière : la carte du condamné cachée"],
  ["scripts/api.mjs", "    if (chambriere) await seDevouer(chambriere, acteurId);\n", "", "Chambrière : le dévouement"],
  ["scripts/api.mjs", "  await revelerPubliquement(chambriere);\n  const texte = t(\"LAKOUR_LOUPS.Ambigus.Devouement\"", "  const texte = t(\"LAKOUR_LOUPS.Ambigus.Devouement\"", "Chambrière : sa carte retournée"],
  ["scripts/api.mjs", "    e.fiches = { ...e.fiches, [chambriere]: L.ficheDeLaChambriere(", "    e.fiches = { ...e.fiches, [chambriere + \"~\"]: L.ficheDeLaChambriere(", "Chambrière : le rôle repris"],
  ["scripts/api.mjs", "  const chambriere = L.chambriereDisponible(vs, condamnes, { sansPouvoirs: L.sagesseEstPerdue(etat) });",
    "  const chambriere = vs.find(v => v.vivant && v.role?.effet === L.EFFET_CHAMBRIERE)?.id ?? \"\";", "Chambrière : amoureuse, rien"],
  ["scripts/api.mjs", "commenceParLeJour: L.commenceParLeJour(paquet),", "commenceParLeJour: false,", "Feu follet : le jour d'abord"],
  ["scripts/api.mjs", "    if (tour === 1) await eteindreLesFeuxFollets();\n", "", "Feu follet : villageois au matin"],
  ["scripts/api.mjs", "  for (const id of ids) {\n    const cle = `${etat.partie}|${etat.tour}|${id}`;\n    if (charmesSalues.has(cle)) continue;",
    "  for (const id of []) {\n    const cle = `${etat.partie}|${etat.tour}|${id}`;\n    if (charmesSalues.has(cle)) continue;", "Vielle : les charmés se reconnaissent"],
  ["scripts/api.mjs", "  await modifierEtat(e => L.journaliserSecret(L.charmer(e, ids),", "  await modifierEtat(e => L.journaliserSecret(e,", "Vielle : le charme"],
  ["scripts/api.mjs", "    const g = L.verifierVictoire({ ...L.contexteDesAmbigus(e), ...L.contexteDesVariantes(e), villageois: villageoisAPlat(), glas,", "    const g = L.verifierVictoire({ ...L.contexteDesVariantes(e), villageois: villageoisAPlat(), glas,",
    "victoire : vielle et Illuminé"],
  ["scripts/api.mjs", "        groupes: paquet.includes(L.CLE_ILLUMINE) ? L.partagerLeVillage(enJeu) : null };", "        groupes: null };", "Illuminé : les deux bords"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-ambigus-api-"));
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
    finally { game.user = game.users.get("mj"); await calme().catch(() => {}); await M.attendreGestes().catch(() => {}); }
  }
  return liste;
}

test("Pacte, étape 3b (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 3b (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
