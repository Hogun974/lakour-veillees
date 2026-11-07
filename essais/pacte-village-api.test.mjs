// Le Pacte, étape 3a : les rôles du Village du jeu de soirée dans l'API du système (game.lakourLoups), sur la doublure de Foundry.
// Le Franc-Villageois retourné dès la distribution ; l'Aïeul qui survit en secret puis, empoisonné, emporte la sagesse du village ;
// l'Innocent gracié au vote (carte retournée, sans voix, la charge de Bailli abolie), qui suit l'Aïeul si le réglage le veut ; le
// Souffre-douleur qui paie l'égalité, puis désigne en mourant ceux qui voteront le lendemain ; les Lavandières qui se reconnaissent
// (carnet, salon de nuit) ; le Furet qui perd son flair ; les oies de la Gardeuse au matin ; le Vieux Sergent et sa vieille épée ; la
// plume noire de la Pie ; le signe secret du Greffier bègue et son second vote. Chaque vérification est rejouée sur des copies
// mutées du système (une règle cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, envoyerAuMJ, calme, messages, FR } from "./doublures/foundry-loups.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"];
const P = FR.LAKOUR_LOUPS.Pacte;

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
    herboriste: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 },
      nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true, invite: "Désigne la victime pour la sauver, quelqu'un d'autre pour l'empoisonner." } }),
    sonneur: role("Sonneur", { cle: "sonneur", effet: "vote-double", usages: { max: 1, restant: 1 } }),
    franc: role("Franc-Villageois", { cle: "franc-villageois", public: true }),
    aieul: role("Aïeul", { cle: "aieul", effet: "resister" }),
    sd: role("Souffre-douleur", { cle: "souffre-douleur", effet: "egalite" }),
    innocent: role("Innocent", { cle: "innocent", effet: "grace" }),
    lavandiere: role("Lavandière", { cle: "lavandiere", effet: "fratrie", nuit: { actif: true, ordre: 11, cibles: 0, nuitsImpaires: true, invite: "Les Lavandières se retrouvent." } }),
    furet: role("Furet", { cle: "furet", effet: "flairer", nuit: { actif: true, ordre: 7, cibles: 1, invite: "Quelle maison flaires-tu ?" } }),
    oies: role("Gardeuse d'oies", { cle: "gardeuse-d-oies", effet: "cacarder" }),
    greffier: role("Greffier bègue", { cle: "greffier-begue", effet: "second-vote", usages: { max: 1, restant: 1 } }),
    sergent: role("Vieux Sergent", { cle: "vieux-sergent", effet: "contaminer" }),
    pie: role("Pie", { cle: "pie", effet: "plume", nuit: { actif: true, ordre: 46, cibles: 1, invite: "Sur quel seuil poses-tu ta plume ?" } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const de = c => villageois().find(a => cle(a) === c);
const tous = c => villageois().filter(a => cle(a) === c);
async function partie(M, roles) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine: "pacte-village", composition: "essai", batiments: [] });
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
const repondre = (demande, cibles) => envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: cibles.map(a => a.id), userId: demande.destinataire },
  { emetteur: demande.destinataire });
const carnetDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "");
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;/g, "'")).join("\n");
const usages = a => roleDe(a)?.system.usages.restant;
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
  async "Franc-Villageois : sa carte retournée devant tous dès la distribution"(M) {
    const U = await monde(M);
    const n = messages.length;
    await partie(M, [U.loup, U.franc, U.villageois, U.villageois, U.villageois, U.villageois]);
    const franc = de("franc-villageois");
    assert.equal(franc.system.revele, true);
    assert.ok(franc.items.some(i => i.type === "role" && i.system.cle === "franc-villageois"));
    assert.match(chat(n), new RegExp(`${franc.name} tient un rôle connu de tous`));
  },

  async "Aïeul : il survit en secret à la meute ; empoisonné, Brumecombe perd sa sagesse"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.aieul, U.herboriste, U.sonneur, U.villageois, U.villageois]);
    const [loup, aieul, herbo, sonneur] = ["loup-de-brumecombe", "aieul", "herboriste", "sonneur"].map(de);
    const r1 = await nuitCalme(M, [{ acteurId: loup.id, roleCle: "meute", cibles: [aieul.id] }]);
    assert.deepEqual(r1.morts, []);
    assert.ok(aieul.system.vivant && !aieul.system.revele, "vivant, carte cachée");
    assert.deepEqual(M.api.etat().pacteSecret.aieux, [aieul.id]);
    assert.ok(!M.api.pacte().sagessePerdue);
    const n = messages.length;
    await nuitCalme(M, [{ acteurId: herbo.id, roleCle: "herboriste", cibles: [aieul.id] }]);
    assert.equal(aieul.system.vivant, false);
    assert.match(chat(n), new RegExp(`${aieul.name}, l'Aïeul, est tombée? de la main du village`));
    assert.ok(M.api.pacte().sagessePerdue > 0);
    assert.equal(M.api.pouvoirsDeJour(sonneur.id).find(p => p.pouvoir === "sonneur")?.raison, "sagesse");
    await M.api.changerPhase("nuit");
    assert.deepEqual(M.api.ordreDeNuit().map(e => e.roleCle), ["meute"], "plus aucun rôle du Village n'est réveillé");
  },

  async "Innocent : gracié au vote, carte retournée, sans voix ensuite ; Bailli, la charge abolie"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "bailli", true);
    await partie(M, [U.loup, U.innocent, U.villageois, U.villageois, U.villageois, U.villageois]);
    const innocent = de("innocent");
    const [x, y] = tous("villageois");
    await M.api.changerPhase("jour");
    await M.api.nommerBailli(innocent.id);
    await M.api.ouvrirVote({ duree: 0 });
    await voter(villageois().filter(a => a.id !== innocent.id).map(a => [a, innocent]));
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [innocent.id]);
    const n = messages.length;
    assert.deepEqual(await M.api.eliminer(innocent.id, { cause: "vote" }), []);
    assert.ok(innocent.system.vivant && innocent.system.revele, "vivant, carte retournée");
    assert.match(chat(n), new RegExp(`${innocent.name} est l'Innocent`));
    assert.equal(M.api.bailli().actif, false, "plus de Bailli");
    assert.notEqual(M.api.etapeSuivante().cle, "executer");
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[innocent, x], [y, x]]);
    const e = M.api.etat().vote;
    assert.ok(!(innocent.id in e.votes) && e.votes[y.id] === x.id, "sa voix est refusée");
  },

  async "Innocent : avec le réglage, un Innocent gracié tombe avec l'Aïeul exécuté"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "innocentSuitAieul", true);
    await partie(M, [U.loup, U.aieul, U.innocent, U.villageois, U.villageois, U.villageois]);
    const [aieul, innocent] = ["aieul", "innocent"].map(de);
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await M.api.cloreVote();
    await M.api.eliminer(innocent.id, { cause: "vote" });
    assert.ok(innocent.system.vivant, "gracié");
    await M.api.eliminer(aieul.id, { cause: "vote" });
    assert.equal(innocent.system.vivant, false, "il suit l'Aïeul");
    assert.equal(M.api.etat().morts.find(m => m.acteurId === innocent.id)?.cause, "sagesse");
  },

  async "Souffre-douleur : l'égalité le condamne ; en mourant, il désigne les votants du lendemain"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.sd, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, sd] = ["loup-de-brumecombe", "souffre-douleur"].map(de);
    const [x, y, z, w] = tous("villageois");
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[loup, x], [z, y]]);
    let n = messages.length;
    const r = await M.api.cloreVote();
    assert.deepEqual([r.elus, r.souffreDouleur], [[sd.id], sd.id]);
    assert.match(chat(n), new RegExp(`c'est ${sd.name} qui paie pour les ex æquo`));
    const k = emissions.length;
    await M.api.eliminer(sd.id, { cause: "vote" });
    await attendre(() => demandeDe(sd, k), "la demande posthume du Souffre-douleur");
    const d = demandeDe(sd, k);
    assert.equal(d.objet, "votants");
    assert.ok(d.posthume && d.nombre >= 2, "plusieurs votants possibles");
    n = messages.length;
    repondre(d, [x, w]);
    await M.attendreGestes();
    assert.deepEqual(M.api.pacte().votants?.ids, [x.id, w.id]);
    assert.match(chat(n), new RegExp(`a désigné ceux qui voteront demain : ${x.name}, ${w.name}`));
    await nuitCalme(M);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[y, loup], [x, loup], [loup, x]]);
    assert.deepEqual(Object.keys(M.api.etat().vote.votes), [x.id], "seuls ceux de sa liste votent");
  },

  async "Lavandières : réveillées ensemble, chacune apprend le nom de l'autre ; elles se parlent la nuit"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.lavandiere, U.lavandiere, U.villageois, U.villageois, U.villageois]);
    const [l1, l2] = tous("lavandiere");
    await M.api.changerPhase("nuit");
    const entree = M.api.ordreDeNuit().find(e => e.roleCle === "lavandiere");
    assert.deepEqual([...entree.acteurIds].sort(), [l1.id, l2.id].sort());
    const n = emissions.length;
    await M.api.reveiller("lavandiere", { delai: 1000 });
    assert.ok(carnetDe(l1, n).some(t => t.includes(l2.name) && /ouvrez les yeux/.test(t)), "la première apprend la seconde");
    assert.ok(carnetDe(l2, n).some(t => t.includes(l1.name)), "et réciproquement");
    assert.ok(M.api.audibiliteActeur(l1.id).acteursAuditeurs.includes(l2.id), "leur salon de nuit");
    assert.ok(!M.api.audibiliteActeur(l1.id).acteursAuditeurs.includes(tous("villageois")[0].id));
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    assert.ok(!M.api.ordreDeNuit().some(e => e.roleCle === "lavandiere"), "pas la deuxième nuit");
  },

  async "Furet : « non » lui coûte son flair ; il est réveillé encore, sans rien à désigner"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.furet, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, furet] = ["loup-de-brumecombe", "furet"].map(de);
    const [a, b, c, d] = tous("villageois");
    await asseoir([loup, a, b, c, d, furet]);
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: furet.id, roleCle: "furet", cibles: [c.id] });
    await M.api.changerPhase("aube");
    const n = emissions.length;
    await M.api.resoudreNuit({ chuchoter: true });
    assert.ok(carnetDe(furet, n).some(t => /Aucun loup parmi/.test(t) && t.includes(b.name) && t.includes(d.name)));
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "furet"), "toujours réveillé");
    assert.deepEqual(M.api.candidatsDeNuit({ acteurId: furet.id, roleCle: "furet" }), [], "plus rien à désigner");
  },

  async "Gardeuse d'oies : un loup voisin, ses oies cacardent au matin, devant tous"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.oies, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, oies] = ["loup-de-brumecombe", "gardeuse-d-oies"].map(de);
    const [a, b, c, d] = tous("villageois");
    await asseoir([a, oies, loup, b, c, d]);
    let n = messages.length;
    await nuitCalme(M);
    assert.match(chat(n), new RegExp(`Les oies de ${oies.name} cacardent`));
    await asseoir([a, oies, b, loup, c, d]);
    n = messages.length;
    await nuitCalme(M);
    assert.doesNotMatch(chat(n), /cacardent/, "loin des loups, rien");
  },

  async "Vieux Sergent : dévoré, sa vieille épée tue le premier loup à sa gauche la nuit suivante"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, U.sergent, U.villageois, U.villageois, U.villageois]);
    const [l1, l2] = tous("loup-de-brumecombe");
    const sergent = de("vieux-sergent");
    const [a, b, c] = tous("villageois");
    await asseoir([a, l1, b, sergent, c, l2]);
    await nuitCalme(M, [{ acteurId: l2.id, roleCle: "meute", cibles: [sergent.id] }]);
    assert.equal(sergent.system.vivant, false);
    assert.ok(l1.system.vivant, "pas encore");
    const n = messages.length;
    const r = await nuitCalme(M);
    assert.deepEqual(r.morts, [l1.id], "le premier loup à sa gauche (b, puis l1)");
    assert.equal(M.api.etat().morts.find(m => m.acteurId === l1.id)?.cause, "contamine");
    assert.match(chat(n), /victime de la vieille épée/);
  },

  async "Pie : la plume annoncée au matin sans la nommer ; deux voix de plus au vote du jour"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.pie, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, pie] = ["loup-de-brumecombe", "pie"].map(de);
    const [x, y, z] = tous("villageois");
    const n = messages.length;
    await nuitCalme(M, [{ acteurId: pie.id, roleCle: "pie", cibles: [x.id] }]);
    const ligne = chat(n).split("\n").find(l => /plume noire désigne/.test(l));
    assert.ok(ligne?.includes(x.name) && !ligne.includes(pie.name), ligne);
    await M.api.ouvrirVote({ duree: 0 });
    await voter([[loup, y]]);
    const r = await M.api.cloreVote();
    assert.deepEqual([r.decompte[x.id], r.elus, r.plume], [2, [x.id], x.id]);
    assert.ok(!(r.votes ?? {})["~plume"]);
    void z;
  },

  async "Greffier bègue : son signe reste secret ; le second vote s'ouvre dès que le condamné est tombé"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.greffier, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [loup, greffier] = ["loup-de-brumecombe", "greffier-begue"].map(de);
    const [x, y] = tous("villageois");
    await M.api.changerPhase("jour");
    await M.api.ouvrirVote({ duree: 0 });
    const n = messages.length, k = emissions.length;
    await M.api.agirDeJour({ acteurId: greffier.id, pouvoir: "greffier-begue" });
    assert.ok(!chat(n).includes(greffier.name), "rien au chat");
    assert.ok(!emissions.slice(k).some(e => e.type === "hook" && e.nom === "lakourLoups.jour"), "aucun hook public");
    await voter([[loup, x], [y, x]]);
    const r = await M.api.cloreVote();
    assert.deepEqual(r.elus, [x.id]);
    assert.equal(usages(greffier), 1, "pas encore servi");
    await M.api.eliminer(x.id, { cause: "vote" });
    const v = M.api.etat().vote;
    assert.ok(v.ouvert && v.numero === r.numero + 1, "le second vote est ouvert");
    assert.match(chat(n), /Un second vote d'exécution s'ouvre aussitôt/);
    assert.equal(usages(greffier), 0);
    assert.equal(M.api.pouvoirsDeJour(greffier.id).find(p => p.pouvoir === "greffier-begue")?.possible, false);
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    if (L.graceDue(lireEtat(), { acteurId, role: roleDe(acteur)?.system, cause })) return gracierLInnocent(acteur);\n", "", "Innocent : la grâce"],
  ["scripts/api.mjs", "  await revelerPubliquement(acteur.id);\n  await annonceChat(echapper(texte));\n  if (abolie) {", "  await annonceChat(echapper(texte));\n  if (abolie) {", "Innocent : la carte retournée"],
  ["scripts/api.mjs", "    if (sagesse.perdue) await perdreLaSagesse(acteur, sagesse.innocents);\n", "", "Aïeul : la sagesse perdue"],
  ["scripts/api.mjs", "      e.pacte = L.pacteInitial({ innocentSuit: lireReglage(\"innocentSuitAieul\", false) });\n", "", "Innocent : le réglage pris à la distribution"],
  ["scripts/api.mjs", "aieux: [...r.aieux], ", "aieux: [], ", "Aïeul : sa vie gardée en secret"],
  ["scripts/api.mjs", "        souffreDouleur: vendanges ? \"\" : bouc,", "        souffreDouleur: \"\",", "Souffre-douleur : à la clôture"],
  ["scripts/api.mjs", "    if (geste === \"votants\") await poserLesVotants(acteurId, v.cibles);", "    if (geste === \"votants\") void 0;", "Souffre-douleur : sa liste"],
  ["scripts/api.mjs", "    if (role?.system.effet === L.EFFET_FRATRIE && role.system.cle === cle) await reconnaitreLaFratrie(acteurId);\n", "", "fratries : se reconnaître"],
  ["scripts/salons.mjs", "      fratrie: v.vivant ? L.fratrieDeLaNuit(v.role, Math.max(1, Number(etat.tour) || 0), L.seReveille, { sansPouvoirs }) : \"\",", "      fratrie: \"\",", "fratries : leur salon"],
  ["scripts/api.mjs", "furets: [...r.furets],", "furets: [],", "Furet : le flair perdu gardé"],
  ["scripts/api.mjs", "    annonces.unshift(...annoncesDuPacte);   // les oies et la plume, juste après les morts\n", "", "oies et plume : annoncées"],
  ["scripts/api.mjs", ", ...r.contaminations.map(c => ({ acteurId: c.loup, nuit: tour + 1 }))", "", "Sergent : le loup contaminé"],
  ["scripts/api.mjs", "contamines: L.contaminesDeLaNuit(avant, tour),", "contamines: [],", "Sergent : mort la nuit suivante"],
  ["scripts/api.mjs", "      L.poserLaPlume(e, plume);\n", "", "Pie : la plume posée au matin"],
  ["scripts/api.mjs", "      Hooks.callAll(\"lakourLoups.jour\", { acteurId, pouvoir, cibles, annonces });", "      annoncer(\"lakourLoups.jour\", [{ acteurId, pouvoir, cibles, annonces }]);", "Greffier : son signe reste secret"],
  ["scripts/api.mjs", "    if (cause === \"vote\") await suivreSecondVote();\n", "", "Greffier : le second vote après l'exécution"],
  ["scripts/api.mjs", "    if (x.fiches?.[par]) majFiche(x, par, f => L.changerUsage(f, -1));\n", "", "Greffier : l'usage pris"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-village-api-"));
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

test("Pacte, étape 3a (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 3a (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
