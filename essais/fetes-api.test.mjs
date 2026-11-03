// Les VEILLÉES DE FÊTE dans l'API du système (game.lakourLoups), sur la doublure de Foundry, et ce que voit chacun : le choix à la
// distribution (paramètre, réglage « veilleeDeFete », fête du calendrier du moteur, partie précédente ; jamais en Saint-Martin), la
// Table qui PROPOSE la veillée du calendrier sans l'imposer, l'ouverture (annoncée à tous ; secrets au MJ et au carnet des seuls
// concernés), la Nuit des âmes (murmure au receveur, porte aux loups), la Veillée d'hiver (présent, neige), le Carnaval (masque,
// défilé), la Fête des promis (promis, meute), le Registre et le récit de fin. Chaque vérification est rejouée sur des copies mutées
// du système (une règle cassée à la fois).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, journalHooks, reglages, calme, messages } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, local, table, MJ] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"),
    m("scripts/reglages.mjs"), m("logique/index.mjs"), m("scripts/plateau-local.mjs"), m("scripts/apps/table.mjs"), m("scripts/actions-mj.mjs")]);
  return { api: api.api, socket, reglages: reglagesM, L, local, table, MJ };
}

// Six joueurs ; le calendrier du moteur (api.fetes.active) rend la fête voulue (null : aucune).
async function monde(M, { calendrier = null, masques = false, passage = false } = {}) {
  installerFoundry({ joueurs: 6 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  M.local.remettreAZero();
  delete globalThis.canvas;
  game.settings.register("core", "rtcWorldSettings", { scope: "world", default: { mode: 0 } });   // la voix (préparation de la Table)
  for (const u of game.users.contents) u.can ??= () => true;
  game.modules.get("lakour-mj-ia").api.fetes = { active: () => (calendrier ? { id: "x", fete: calendrier } : null) };
  await game.settings.set("lakour-loups", "delaiChoix", 2);
  await game.settings.set("lakour-loups", "bailli", false);
  await game.settings.set("lakour-loups", "masques", masques);
  await game.settings.set("lakour-loups", "gensDePassage", passage);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    liseuse: role("Liseuse de cendres", { cle: "liseuse-de-cendres", effet: "voir-camp", nuit: { actif: true, ordre: 60 } }),
    herboriste: role("Herboriste", { cle: "herboriste", effet: "remede", nuit: { actif: true, ordre: 45 }, usages: { max: 2, restant: 2 } }),
    sourcier: role("Sourcier", { cle: "sourcier", effet: "voir-camp", nuit: { actif: true, ordre: 62, cibles: 2 } }),
    // des rôles du Village absents de la partie, plus nombreux que les Masques de veillée (le défilé doit choisir parmi ceux-ci)
    ...Object.fromEntries(["fossoyeur", "veilleuse-de-lanterne", "garde-du-pont", "messager"].map(cle => [cle, role(cle, { cle })])),
    deguise: role("Loup déguisé", { cle: "loup-deguise", camp: "meute", effet: "tuer", apparence: "village", nuit: { actif: true, ordre: 40 } }),
    // les Gens de passage (rôles « sur demande », jamais au défilé)
    ...Object.fromEntries(["remouleur", "montreur-d-ours", "pelerine"].map(cle => [cle, role(cle, { cle, usages: { max: 1, restant: 1 } })])),
    chasseresse: creerObjetMonde("Chasseresse", "metier", { cle: "chasseresse", jour: { actif: true, invite: "Quelles traces suivre ?", cibles: 1 } })
  };
}
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6"];
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const avecRole = cle => villageois().filter(a => roleDe(a)?.system.cle === cle);
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
const ROLES = ["loup", "liseuse", "villageois", "villageois", "villageois", "villageois"];
async function partie(M, U, { fete, graine = "fetes", roles = ROLES, format = "", metiers = [] } = {}) {
  await M.api.distribuer({ roles: roles.map(r => U[r]), metiers: metiers.map(m => U[m]), joueurs: JOUEURS, graine, composition: "essai", batiments: [], format,
    ...(fete === undefined ? {} : { fete }) });
  await calme();
}
// Les entrées de carnet envoyées (socket), par destinataire.
const carnets = (depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret");
const pourQui = (depuis, motif) => carnets(depuis).filter(e => motif.test(e.entree.texte ?? "")).map(e => e.recipients.join(","));
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ")).join("\n");
const avecHasard = async (valeur, fn) => {
  const avant = Math.random;
  Math.random = typeof valeur === "function" ? valeur : () => valeur;
  try { return await fn(); } finally { Math.random = avant; }
};
const nuitOu = async (M, loupVise) => {
  await M.api.changerPhase("nuit");
  if (loupVise) await M.api.noterAction({ acteurId: avecRole("loup-de-brumecombe")[0].id, roleCle: "meute", cibles: [loupVise] });
};

const VERIFICATIONS = {
  async "choix : le paramètre, puis le réglage (nommée, date du calendrier), sinon la partie précédente ; jamais en Saint-Martin"(M) {
    const U = await monde(M, { calendrier: "halloween" });
    assert.equal(game.settings.get("lakour-loups", "veilleeDeFete"), "", "aucune d'office par défaut");
    await partie(M, U);
    assert.equal(M.api.etat().fete.cle, "", "ni le calendrier ni le défaut ne l'imposent");
    await partie(M, U, { fete: "nuit-des-ames" });
    assert.equal(M.api.etat().fete.cle, "nuit-des-ames");
    assert.equal(publicBrut().fete.cle, "nuit-des-ames", "publique");
    await partie(M, U);
    assert.equal(M.api.etat().fete.cle, "nuit-des-ames", "rejouée : la veillée de la partie précédente");
    await partie(M, U, { fete: "" });
    assert.equal(M.api.etat().fete.cle, "", "« aucune » choisie");
    await game.settings.set("lakour-loups", "veilleeDeFete", "fete-des-promis");
    await partie(M, U);
    assert.equal(M.api.etat().fete.cle, "fete-des-promis", "le réglage nomme une veillée");
    await game.settings.set("lakour-loups", "veilleeDeFete", "date");
    await partie(M, U);
    assert.equal(M.api.etat().fete.cle, "nuit-des-ames", "le réglage « date » : celle du calendrier");
    game.modules.get("lakour-mj-ia").api.fetes = { active: () => ({ fete: "paques" }) };
    await partie(M, U);
    assert.equal(M.api.etat().fete.cle, "", "Pâques n'a pas de veillée");
    await partie(M, U, { fete: "veillee-d-hiver", format: "saint-martin" });
    assert.equal(M.api.etat().fete.cle, "", "jamais dans une Nuit de la Saint-Martin");
  },
  async "Table : la veillée du calendrier pré-sélectionnée, le MJ décide (aucune, une autre) ; « Distribuer » la transmet"(M) {
    const U = await monde(M, { calendrier: "noel" });
    void U;
    assert.equal(M.MJ.nouvellePreparation().fete, null, "rien de choisi encore");
    assert.equal(M.MJ.veilleeProposee(), "veillee-d-hiver");
    assert.deepEqual(M.api.veilleesDeFete().veillees.map(v => v.cle), M.L.CLES_DE_FETE);
    const t = new M.table.TableDeJeu();
    let ctx = await t._prepareContext();
    assert.equal(ctx.preparation.fetes.options.find(o => o.choisie)?.cle, "veillee-d-hiver", "pré-sélectionnée");
    assert.match(ctx.preparation.fetes.options.find(o => o.cle === "veillee-d-hiver").nom, /proposée par le calendrier/);
    t.preparation.fete = "";
    ctx = await t._prepareContext();
    assert.equal(ctx.preparation.fetes.options.find(o => o.choisie)?.cle, "", "le MJ a choisi « aucune » : elle le reste");
    await M.MJ.distribuer(t.preparation);
    assert.equal(M.api.etat().fete.cle, "");
    t.preparation.fete = "carnaval-des-masques";
    await M.MJ.distribuer(t.preparation);
    assert.equal(M.api.etat().fete.cle, "carnaval-des-masques", "une autre, hors saison");
    const p = M.MJ.nouvellePreparation();
    await M.MJ.distribuer(p);
    assert.equal(M.api.etat().fete.cle, "veillee-d-hiver", "une préparation neuve prend la proposée");
    await game.settings.set("lakour-loups", "veilleeDeFete", "nuit-des-ames");
    assert.equal(M.api.veilleesDeFete().proposee, "nuit-des-ames", "le réglage nommé passe devant le calendrier");
  },
  async "ouverture : annoncée à tous (chat, Registre, hook) ; le présent au MJ et au carnet du seul porteur"(M) {
    const U = await monde(M);
    const e0 = emissions.length, m0 = messages.length;
    await partie(M, U, { fete: "veillee-d-hiver" });
    assert.match(chat(m0), /C'est la Veillée d'hiver/);
    assert.ok(M.api.registreTexte().some(l => /la veillée de fête commence : La Veillée d'hiver/.test(l)), "au Registre");
    assert.ok(emissions.slice(e0).some(e => e.type === "hook" && e.nom === "lakourLoups.fete" && e.args[0].quoi === "ouverture" && !e.recipients));
    const s = M.api.secretsDeFete();
    assert.ok(s.present?.id, "un porteur tiré");
    assert.deepEqual(pourQui(e0, /La Dame aux grelots a laissé un présent sur ton seuil/), [game.actors.get(s.present.id).system.joueur], "à lui seul");
    assert.deepEqual(publicBrut().secretsDeFete, M.L.secretsDeFeteInitiaux(), "rien dans l'état public");
    assert.ok(!JSON.stringify(publicBrut().fete).includes(s.present.id), "la veillée publique ne nomme pas le porteur");
    for (const x of publicBrut().registre.filter(x => x.type === "fete")) assert.ok(!JSON.stringify(x).includes(s.present.id), "ni le Registre");
    assert.ok(!JSON.stringify(publicBrut().historique).includes(s.present.nom), "ni le journal public");
    assert.ok(M.api.etat().journalSecret.some(x => x.texte.includes(`le présent de la Dame aux grelots va à ${s.present.nom}`)), "le MJ le lit dans sa chronique secrète");
  },
  async "Veillée d'hiver : le présent fait échouer le premier coup mortel, une fois ; le porteur l'apprend"(M) {
    const U = await monde(M);
    await partie(M, U, { fete: "veillee-d-hiver", graine: "present" });
    let porteur = M.api.secretsDeFete().present.id;
    if (avecRole("loup-de-brumecombe")[0].id === porteur) { await partie(M, U, { fete: "veillee-d-hiver", graine: "present-2" }); porteur = M.api.secretsDeFete().present.id; }
    assert.notEqual(avecRole("loup-de-brumecombe")[0].id, porteur);
    const e0 = emissions.length;
    await nuitOu(M, porteur);
    await M.api.changerPhase("aube");
    const r = await avecHasard(0.9, () => M.api.resoudreNuit({ chuchoter: true }));
    assert.deepEqual(r.morts, [], "la meute a échoué");
    assert.equal(game.actors.get(porteur).system.vivant, true);
    assert.deepEqual(pourQui(e0, /Votre présent s'est ouvert/), [game.actors.get(porteur).system.joueur]);
    assert.equal(M.api.secretsDeFete().presentOuvert, true);
    assert.ok(r.narration.some(x => /Le présent de .* s'est ouvert/.test(x)), "le narrateur le sait");
    await M.api.changerPhase("jour");
    await nuitOu(M, porteur);
    await M.api.changerPhase("aube");
    const r2 = await avecHasard(0.9, () => M.api.resoudreNuit({ chuchoter: true }));
    assert.deepEqual(r2.morts, [porteur], "une seule fois");
  },
  async "Veillée d'hiver : la neige tombe (une chance sur trois, jamais deux aubes de suite), s'annonce à tous, au Registre ; les traces attendent"(M) {
    const U = await monde(M);
    await partie(M, U, { fete: "veillee-d-hiver", metiers: JOUEURS.map(() => "chasseresse") });
    const chasseresse = avecRole("villageois")[0], proie = avecRole("loup-de-brumecombe")[0];
    await nuitOu(M, "");
    await M.api.changerPhase("aube");
    const m0 = messages.length, e0 = emissions.length;
    const r = await avecHasard(0.2, () => M.api.resoudreNuit({ chuchoter: true }));
    assert.equal(r.neige, true);
    assert.match(chat(m0), /La neige est tombée cette nuit/);
    assert.equal(M.api.fete().neige, true);
    assert.equal(publicBrut().fete.neige, publicBrut().tour, "publique");
    assert.ok(M.api.registreTexte().some(l => /la neige est tombée/.test(l)));
    assert.ok(emissions.slice(e0).some(e => e.type === "hook" && e.nom === "lakourLoups.fete" && e.args[0].quoi === "neige"));
    assert.ok(M.api.etat().historique.some(x => /La neige est tombée/.test(x.texte)), "au journal public");
    const p = M.api.pouvoirsDeJour(chasseresse.id).find(x => x.pouvoir === "chasseresse");
    assert.equal(p.raison, "neige", "la Table grise la Chasseresse");
    assert.match(p.raisonTexte, /La neige a recouvert les traces/);
    await assert.rejects(M.api.agirDeJour({ acteurId: chasseresse.id, pouvoir: "chasseresse", cibles: [proie.id] }), /La neige a recouvert les traces/);
    await M.api.changerPhase("jour");
    await nuitOu(M, "");
    await M.api.changerPhase("aube");
    const r2 = await avecHasard(0, () => M.api.resoudreNuit({ chuchoter: true }));
    assert.equal(r2.neige, false, "jamais deux aubes de suite, même au hasard le plus froid");
    assert.equal(M.api.fete().neige, false, "le lendemain sans neige");
    const m1 = messages.length;
    await M.api.agirDeJour({ acteurId: chasseresse.id, pouvoir: "chasseresse", cibles: [proie.id] });
    assert.match(chat(m1), /a suivi les traces de/, "les traces se lisent de nouveau");
  },
  async "Nuit des âmes : le murmure au seul receveur, la porte aux seuls loups, le tout au narrateur ; rien après une nuit calme"(M) {
    const U = await monde(M);
    await partie(M, U, { fete: "nuit-des-ames" });
    const loup = avecRole("loup-de-brumecombe")[0];
    const proie = avecRole("villageois")[0];
    await nuitOu(M, proie.id);
    await M.api.changerPhase("aube");
    const e0 = emissions.length;
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts, [proie.id]);
    const murmures = carnets(e0).filter(e => /L'âme de .* s'est assise au pied de votre lit/.test(e.entree.texte ?? ""));
    assert.equal(murmures.length, 1, "un murmure");
    assert.match(murmures[0].entree.texte, new RegExp(`L'âme de ${proie.name}`));
    const portes = carnets(e0).filter(e => /une âme a frappé à la porte de/.test(e.entree.texte ?? ""));
    assert.deepEqual(portes.map(e => e.recipients[0]), [loup.system.joueur], "aux loups seuls");
    assert.ok(r.narration.some(x => /Nuit des âmes : l'âme de/.test(x)));
    assert.ok(r.messages.some(m => /s'est assise au pied de votre lit/.test(m.texte)), "rendu au MJ IA comme tout message secret");
    await M.api.changerPhase("jour");
    await nuitOu(M, "");
    await M.api.changerPhase("aube");
    const e1 = emissions.length;
    await M.api.resoudreNuit({ chuchoter: true });
    assert.equal(carnets(e1).filter(e => /âme/.test(e.entree.texte ?? "")).length, 0, "nuit calme : aucune âme");
  },
  async "Carnaval : le masque au carnet du seul porteur ; la Liseuse le voit du camp opposé ; le défilé montre un masque de la meute"(M) {
    const U = await monde(M, { masques: true });
    let masque = null, bonne = "";
    for (const g of ["carnaval", "carnaval-2", "carnaval-3", "carnaval-4", "carnaval-5", "carnaval-6"]) {
      const e0 = emissions.length, m0 = messages.length;
      await partie(M, U, { fete: "carnaval-des-masques", graine: g });
      masque = M.api.secretsDeFete().masque;
      assert.deepEqual(pourQui(e0, /le masque s'est posé sur ton visage/), [game.actors.get(masque.id).system.joueur], "à lui seul");
      const defile = M.api.fete().defile;
      assert.ok(defile?.nom, "un masque au défilé");
      assert.ok(M.api.etat().masques.includes(defile.cle), "l'un des Masques de veillée de la meute");
      assert.match(chat(m0), new RegExp(`le masque de ${defile.nom} : personne au village ne le porte`));
      assert.ok(M.api.registreTexte().some(l => l.includes(`le masque de ${defile.nom}`)));
      if (!["liseuse-de-cendres", "loup-de-brumecombe"].includes(roleDe(game.actors.get(masque.id)).system.cle)) bonne ||= g;
    }
    // Une partie où le masqué est un homme du Village que la Liseuse peut lire.
    await partie(M, U, { fete: "carnaval-des-masques", graine: bonne });
    masque = M.api.secretsDeFete().masque;
    const liseuse = avecRole("liseuse-de-cendres")[0];
    await nuitOu(M, "");
    await M.api.noterAction({ acteurId: liseuse.id, roleCle: "liseuse-de-cendres", cibles: [masque.id] });
    await M.api.changerPhase("aube");
    const e0 = emissions.length;
    await M.api.resoudreNuit({ chuchoter: true });
    const vision = carnets(e0).find(e => e.recipients[0] === liseuse.system.joueur && /Les cendres parlent/.test(e.entree.texte));
    assert.match(vision.entree.texte, /camp « Meute »|camp « meute »/i, "un homme du Village masqué paraît loup");
    assert.equal(M.api.secretsDeFete().masqueTombe, true, "puis le masque tombe");
    assert.ok(M.api.etat().journalSecret.some(x => /Le masque du Carnaval de .* a trompé une vision/.test(x.texte)), "le narrateur le sait");
    await M.api.changerPhase("jour");
    await nuitOu(M, "");
    await M.api.noterAction({ acteurId: liseuse.id, roleCle: "liseuse-de-cendres", cibles: [masque.id] });
    await M.api.changerPhase("aube");
    const e1 = emissions.length;
    await M.api.resoudreNuit({ chuchoter: true });
    assert.match(carnets(e1).find(e => e.recipients[0] === liseuse.system.joueur && /Les cendres parlent/.test(e.entree.texte)).entree.texte,
      /camp « Village »|camp « village »/i, "tombé : la vision suivante voit juste");
  },
  async "Carnaval : le carnet du porteur dit le camp que le masque montrera (Loup déguisé masqué : la meute)"(M) {
    const U = await monde(M);
    for (const g of ["deguise-1", "deguise-2", "deguise-3", "deguise-4", "deguise-5", "deguise-6", "deguise-7", "deguise-8", "deguise-9", "deguise-10", "deguise-11", "deguise-12"]) {
      const e0 = emissions.length;
      await partie(M, U, { fete: "carnaval-des-masques", graine: g, roles: ["deguise", "liseuse", "villageois", "villageois", "villageois", "villageois"] });
      const masque = game.actors.get(M.api.secretsDeFete().masque.id);
      const carnet = carnets(e0).find(e => /le masque s'est posé sur ton visage/.test(e.entree.texte ?? ""));
      const attendu = roleDe(masque).system.cle === "loup-deguise" ? /du camp « Meute »/i : /du camp « Meute »/i;
      assert.match(carnet.entree.texte, attendu, "un homme du Village ou un Loup déguisé masqués paraissent loups");
      if (roleDe(masque).system.cle === "loup-deguise") return;
    }
    assert.fail("aucune graine ne masque le Loup déguisé");
  },
  async "Fête des promis : chacun apprend l'autre, la meute apprend les deux ; personne d'autre"(M) {
    const U = await monde(M);
    const e0 = emissions.length;
    await partie(M, U, { fete: "fete-des-promis" });
    const [a, b] = M.api.secretsDeFete().promis;
    assert.ok(a && b && a.id !== b.id);
    for (const p of [a, b]) assert.equal(secretDuMJ.camp(game.actors.get(p.id)), "village", "du Village");
    const joueur = id => game.actors.get(id).system.joueur;
    assert.deepEqual(pourQui(e0, new RegExp(`ton cœur s'est lié à celui de ${b.nom}`)), [joueur(a.id)]);
    assert.deepEqual(pourQui(e0, new RegExp(`ton cœur s'est lié à celui de ${a.nom}`)), [joueur(b.id)]);
    assert.deepEqual(pourQui(e0, /Les promis de la fête s'affichent/), [avecRole("loup-de-brumecombe")[0].system.joueur], "la meute seule");
    // Un mordu rejoint la meute : il apprend les promis, à lui seul.
    const mordu = avecRole("villageois").find(x => ![a.id, b.id].includes(x.id));
    const e1 = emissions.length;
    await M.api.changerCamp(mordu.id, "meute");
    assert.deepEqual(pourQui(e1, /Les promis de la fête s'affichent/), [mordu.system.joueur], "le mordu apprend les promis");
  },
  async "Fête des promis : un gens de passage de la meute apprend les promis ; sans promis, l'annonce ne promet rien"(M) {
    const U = await monde(M, { passage: true });
    await partie(M, U, { fete: "fete-des-promis" });
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    await M.api.resoudreNuit({ chuchoter: true });
    const r = await avecHasard(0, () => M.api.accueillir({ nom: "Passant", cle: "remouleur" }));
    assert.equal(secretDuMJ.camp(game.actors.get(r.acteurId)), "meute", "un loup de passage");
    assert.ok(M.api.carnet(r.acteurId).some(x => /Les promis de la fête s'affichent/.test(x.texte ?? "")), "il apprend les promis");
    const m0 = messages.length;
    await partie(M, U, { fete: "fete-des-promis", roles: ["loup", "loup", "loup", "loup", "loup", "liseuse"] });
    assert.deepEqual(M.api.secretsDeFete().promis, [], "un seul joueur du Village : pas de promis");
    assert.doesNotMatch(chat(m0), /deux cœurs du Village se sont trouvés/, "pas d'annonce qui ment");
    assert.match(chat(m0), /aucun cœur du Village ne s'est trouvé/);
  },
  async "récit de fin et Registre : les secrets de la fête se dévoilent à la fin, pas avant"(M) {
    const U = await monde(M);
    await partie(M, U, { fete: "veillee-d-hiver" });
    const s = M.api.secretsDeFete();
    const m0 = messages.length;
    assert.ok(!chat(0).includes("était pour"), "rien avant la fin");
    await M.api.eliminer(avecRole("loup-de-brumecombe")[0].id, { cause: "vote" });
    await M.api.verifierVictoire();
    assert.match(chat(m0), new RegExp(`Le présent de la Dame aux grelots était pour ${s.present.nom}`));
  }
};

// Chaque règle cassée, une à la fois : [fichier, avant, après, règle].
const MUTATIONS = [
  ["scripts/api.mjs", "      e.fete = L.feteInitiale(cleFete);", "      e.fete = L.feteInitiale(\"\");", "la veillée choisie"],
  ["scripts/api.mjs", "  if (r === \"date\") return veilleeDuCalendrier();", "  if (r === \"date\") return \"\";", "le réglage « date »"],
  ["scripts/api.mjs", "  return L.cleDeFete(r) || L.cleDeFete(precedente);", "  return L.cleDeFete(r);", "rejouer garde la veillée"],
  ["scripts/api.mjs", "  return L.cleDeFete(r) || L.cleDeFete(precedente);", "  return L.cleDeFete(r) || L.cleDeFete(precedente) || veilleeDuCalendrier();", "la date ne l'impose pas"],
  ["scripts/api.mjs", "    const cleFete = format === L.FORMAT_SAINT_MARTIN ? \"\" : feteVoulue(", "    const cleFete = feteVoulue(", "jamais en Saint-Martin"],
  ["scripts/api.mjs", "    await ouvrirLaFete(cleFete, { sortie, graine });", "    void cleFete;", "la veillée s'ouvre"],
  ["scripts/api.mjs", "    e.secretsDeFete = secrets;\n", "", "les secrets de fête gardés"],
  ["scripts/api.mjs", "  for (const texte of annonces) await annonceChat(echapper(texte));\n  annoncer(\"lakourLoups.fete\"", "  annoncer(\"lakourLoups.fete\"", "la veillée annoncée"],
  ["scripts/api.mjs", "  annoncer(\"lakourLoups.fete\", [{ cle, quoi: \"ouverture\"", "  void ([{ cle, quoi: \"ouverture\"", "hook public d'ouverture"],
  ["scripts/api.mjs", "    L.inscrire(e, { type: \"fete\", quoi: \"ouverture\", cle });\n", "", "au Registre"],
  ["scripts/api.mjs", "    for (const texte of pourMJ) x = L.journaliserSecret(x, texte);\n", "", "le MJ lit les secrets de fête"],
  ["scripts/api.mjs", "return a && (a.system.joueur || estCompagnon(a)) ? envoyerSecret(id, { texte, titre: nomDeFete(cle) }) : null;", "return null;", "les concernés prévenus"],
  ["scripts/api.mjs", "    for (const loup of tousLesVillageois().filter(x => x.system.vivant && campDe(x) === \"meute\")) {", "    for (const loup of tousLesVillageois().filter(x => x.system.vivant)) {", "les promis : à la meute seule"],
  ["scripts/api.mjs", "    await prevenir(b, t(\"LAKOUR_LOUPS.Fetes.fete-des-promis.Carnet\", { nom: nom(a) }));\n", "", "chaque promis apprend l'autre"],
  ["scripts/api.mjs", "...(defile ? [t(\"LAKOUR_LOUPS.Fetes.carnaval-des-masques.Defile\", { role: defileNom })] : [])", "...[]", "le défilé annoncé"],
  ["scripts/api.mjs", "    defile = L.choisirDefile({ masques: lireEtat().masques,", "    defile = L.choisirDefile({ masques: [],", "le défilé : un masque de la meute"],
  ["scripts/api.mjs", "    const neige = await faireNeiger();", "    const neige = \"\";", "la neige tombe"],
  ["scripts/api.mjs", "    e.fete = { ...L.normaliserFete(e.fete), neige: e.tour };\n", "", "la neige publique"],
  ["scripts/api.mjs", "    L.inscrire(e, { type: \"fete\", quoi: \"neige\", cle: L.VEILLEE_D_HIVER });\n", "", "la neige au Registre"],
  ["scripts/api.mjs", "const annonces = [...(neige ? [neige] : []), ...", "const annonces = [...", "la neige annoncée"],
  ["scripts/api.mjs", "      if (r.presentOuvert) x.secretsDeFete =", "      if (false) x.secretsDeFete =", "le présent ne s'ouvre qu'une fois"],
  ["scripts/api.mjs", "    const murmure = L.estFete(avant, L.NUIT_DES_AMES)", "    const murmure = false", "le murmure des âmes"],
  ["scripts/api.mjs", "...aube.prives, ...murmure.filter(m => m.destinataire !== \"mj\")]", "...aube.prives]", "le murmure remis"],
  ["scripts/api.mjs", "      ...murmure.filter(m => m.destinataire === \"mj\").map(texteMessage),\n", "", "le murmure au narrateur"],
  ["scripts/api.mjs", "      neige: L.neigeDuJour(e), defile:", "      neige: false, defile:", "la neige sur la Table"],
  ["scripts/api.mjs", "</p>${recitDeLaFete(etat)}${listeDuRecit(lignes)}", "</p>${listeDuRecit(lignes)}", "le récit de fin dévoile la fête"],
  ["scripts/api.mjs", "    return { proposee: L.cleDeFete(r) || calendrier, calendrier,", "    return { proposee: L.cleDeFete(r), calendrier,", "la Table propose la veillée du calendrier"],
  ["scripts/api.mjs", "    case \"fete\": return t(", "    case \"fete-\": return t(", "le Registre lit la fête"],
  ["scripts/actions-mj.mjs", "    fete: prep.fete ?? veilleeProposee() });", "  });", "« Distribuer » transmet la veillée"],
  ["scripts/actions-mj.mjs", "nouvellePreparation = () => ({ coches: null, mode: \"auto\", niveau: niveauParDefaut(), roles: {}, peste: false, format: \"\", fete: null });",
    "nouvellePreparation = () => ({ coches: null, mode: \"auto\", niveau: niveauParDefaut(), roles: {}, peste: false, format: \"\", fete: \"\" });", "la préparation neuve propose"],
  ["scripts/apps/table.mjs", "  if (p.fete === null) p.fete = v.proposee;\n", "", "la Table pré-sélectionne"],
  ["scripts/apps/table.mjs", "  if (p.fete === null) p.fete = v.proposee;", "  p.fete = v.proposee;", "le choix du MJ respecté"],
  ["scripts/api.mjs", "    if (camp === \"meute\" && avant !== \"meute\") { await envoyerMasques(a); await envoyerSecretsDeMeute(a); }", "    if (camp === \"meute\" && avant !== \"meute\") { await envoyerMasques(a); }", "le mordu apprend les promis"],
  ["scripts/api.mjs", "      await envoyerSecretsDeMeute(acteur);\n", "", "le loup de passage apprend les promis"],
  ["scripts/api.mjs", "  const sansPromis = cle === L.FETE_DES_PROMIS && secrets.promis.length < 2;", "  const sansPromis = false;", "pas d'annonce qui ment"],
  ["scripts/api.mjs", "    await prevenir(secrets.masque, t(\"LAKOUR_LOUPS.Fetes.carnaval-des-masques.Carnet\", { camp: libelleCamp(vu) }));",
    "    await prevenir(secrets.masque, t(\"LAKOUR_LOUPS.Fetes.carnaval-des-masques.Carnet\", { camp: libelleCamp(campDe(game.actors.get(secrets.masque)) === \"meute\" ? \"village\" : \"meute\") }));", "le carnet du masque : le camp vraiment vu"],
  ["scripts/api.mjs", "      if (r.masqueTombe) x.secretsDeFete =", "      if (false) x.secretsDeFete =", "le masque tombe"],
  ["logique/jour.mjs", "  if (aveuglePar(etat, pouvoir)) return non(\"neige\");\n", "", "la neige aveugle la Chasseresse"],
  ["scripts/reglages.mjs", "scope: \"world\", config: true, type: String, default: \"\",", "scope: \"world\", config: true, type: String, default: \"date\",", "aucune d'office"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fetes-api-"));
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
    finally { game.user = game.users.get("mj"); await calme().catch(() => {}); }
  }
  return liste;
}

test("veillées de fête (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("veillées de fête (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("veillées de fête : le module les décline auprès du moteur (ids, fêtes, décor et liens valides ; le journal du monde d'abord)", async () => {
  const { normaliserDeclinaison } = await import("../modules/lakour-mj-ia/scripts/fetes-logique.js");
  const { declinaisonsDeFete, enregistrerFetes } = await import("../modules/lakour-veillees/scripts/main.js");
  const { FETES_VEILLEES } = await import("../modules/lakour-veillees/scripts/fetes.js");
  const monde = [{ uuid: "JournalEntry.mondeNuitAmes001", getFlag: (m, c) => (m === "lakour-veillees" && c === "cle" ? "fete-nuit-des-ames" : undefined) }];
  const d = declinaisonsDeFete(monde);
  const deja = [];
  for (const x of d) deja.push(normaliserDeclinaison(x, deja));   // le moteur les accepte toutes, une par fête
  assert.deepEqual(deja.map(x => x.fete), ["halloween", "noel", "carnaval", "saint-valentin"]);
  assert.deepEqual(deja[0].contenu, [{ uuid: "JournalEntry.mondeNuitAmes001", nom: "Veillée de fête — La Nuit des âmes" }], "le journal installé");
  assert.deepEqual(deja[1].contenu, [{ uuid: `Compendium.lakour-veillees.journaux.JournalEntry.${FETES_VEILLEES[1].journal.id}`, nom: FETES_VEILLEES[1].journal.nom }], "à défaut, le compendium");
  for (const x of deja) {
    assert.equal(x.description, FETES_VEILLEES.find(f => f.id === x.id).description, "description entière (600 au plus)");
    assert.equal(x.consigne, FETES_VEILLEES.find(f => f.id === x.id).consigne, "consigne entière (300 au plus)");
    assert.ok(x.decor.ornements.length >= 1);
  }
  // Au crochet du moteur : chacune passe par api.fetes.enregistrer, dans le monde des Veillées seulement.
  const recues = [];
  const point = { fetes: { enregistrer: def => { recues.push(normaliserDeclinaison(def, recues)); return def; } } };
  game.system.id = "lakour-loups";
  game.journal = { find: () => null };
  assert.equal(enregistrerFetes(point), 4);
  assert.deepEqual(recues.map(x => x.id), FETES_VEILLEES.map(f => f.id));
  game.system.id = "dnd5e";
  assert.equal(enregistrerFetes(point), 0, "hors des Veillées : rien");
  game.system.id = "lakour-loups";
  assert.match(readFileSync(new URL("../modules/lakour-veillees/scripts/main.js", import.meta.url), "utf8"), /Hooks\.once\("lakour-mj-ia\.pret", api => enregistrerFetes\(api\)\);/);
});
