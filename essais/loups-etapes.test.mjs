// La Table de jeu du MJ HUMAIN, sans narrateur IA : l'étape suivante (logique pure etapeSuivante, avec mutations), la
// préparation de la partie (joueurs cochés, joueurs IA par le point d'enregistrement du MJ IA, composition auto ou
// choisie) et des parties COMPLÈTES menées seulement par les actions de la Table (scripts/actions-mj.mjs) et l'API du
// système, sans aucun outil du MJ IA : 3 humains simulés et 4 joueurs IA. À chaque étape : positions des jetons, lumière,
// statuts, rien de marqué sur un loup caché, et l'étape proposée reste cohérente jusqu'à la victoire, puis « Rejouer ».
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  installerFoundry, ajouterScene, simulerJoueurs, calme, emissions, journalHooks, erreurs, erreursHooks
} from "./doublures/foundry-loups.mjs";
import { PLAN_VILLAGE, PLATEAU_VILLAGE, PLACE, BATIMENTS_CARTE } from "../modules/lakour-veillees/contenu/village.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const L0 = await import("../systems/lakour-loups/logique/index.mjs");
const { creerHasard, choisir, melanger } = L0;
const NEUTRE = "modules/lakour-veillees/assets/jetons/villageois.svg";
const CIMETIERE = BATIMENTS_CARTE.find(b => b.nom === "Cimetière");

// ================================================================== étape suivante (logique pure)
const role = (cle, extra = {}) => ({ cle, nom: cle, camp: "village", effet: "", nuit: { actif: false, ordre: 50, cibles: 1 }, usages: { max: 0, restant: 0 }, ...extra });
const R = {
  loup: role("loup-de-brumecombe", { camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 } }),
  garde: role("garde-du-pont", { nom: "Garde du pont", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1 } }),
  juge: role("juge-de-paix", { effet: "annuler-vote", usages: { max: 1, restant: 1 } }),
  braco: role("braconniere", { effet: "emporter" }),
  villageois: role("villageois")
};
const v = (id, r, extra = {}) => ({ id, nom: `N-${id}`, vivant: true, revele: false, camp: R[r].camp, maison: `Maison ${id.slice(1)}`, role: structuredClone(R[r]), ...extra });
const village = () => [v("a1", "loup"), v("a2", "loup"), v("a3", "garde"), v("a4", "juge"), v("a5", "braco"), v("a6", "villageois"), v("a7", "villageois")];

// Un état et ses secrets, comme chez le MJ actif (la logique sépare le public du secret).
function partie(L, modif = e => e) {
  const e = L.etatInitial();
  e.partie = "p1";
  const etat = modif(e) ?? e;
  return L.separerEtat(etat);
}

const VERIFS_ETAPES = {
  "sans partie : distribuer ; préparatifs : la nuit": L => {
    assert.equal(L.etapeSuivante(L.etatInitial(), null, { villageois: [] }).cle, "distribuer");
    const { public: p, secret: s } = partie(L);
    const e = L.etapeSuivante(p, s, { villageois: village() });
    assert.deepEqual([e.cle, e.action, e.donnees.phase], ["nuit", "phase", "nuit"]);
  },
  "nuit : chaque rôle dans l'ordre, la meute ensemble ; en attente d'une réponse ; puis l'aube": L => {
    const vil = village();
    let x = partie(L, e => { e.phase = "nuit"; e.tour = 1; });
    let e = L.etapeSuivante(x.public, x.secret, { villageois: vil });
    assert.deepEqual([e.cle, e.action, e.donnees.role], ["reveiller", "reveiller", "garde-du-pont"]);
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: vil, attente: ["garde-du-pont"] }).cle, "attendre");
    x = partie(L, e => { e.phase = "nuit"; e.tour = 1; e.nuit.actions = [{ acteurId: "a3", roleCle: "garde-du-pont", cibles: ["a6"] }]; });
    e = L.etapeSuivante(x.public, x.secret, { villageois: vil });
    assert.deepEqual([e.cle, e.donnees.role, e.donnees.meute], ["reveiller", "meute", true]);
    x = partie(L, e => { e.phase = "nuit"; e.tour = 1; e.nuit.actions = [{ acteurId: "a3", roleCle: "garde-du-pont", cibles: [] }, { acteurId: "a1", roleCle: "meute", cibles: ["a6"] }]; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: vil }).cle, "aube");
    // Sans les secrets (un autre navigateur), on ne sait pas qui a agi : on propose l'aube.
    assert.equal(L.etapeSuivante(x.public, null, { villageois: vil }).cle, "aube");
    // Un mort n'est pas réveillé.
    const sansGarde = vil.map(w => (w.id === "a3" ? { ...w, vivant: false } : w));
    x = partie(L, e => { e.phase = "nuit"; e.tour = 1; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: sansGarde }).donnees.role, "meute");
  },
  "aube : résoudre, puis la Braconnière emporte, puis la victoire, puis le débat": L => {
    const vil = village();
    let x = partie(L, e => { e.phase = "aube"; e.tour = 1; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: vil }).cle, "aube");
    x = partie(L, e => { e.phase = "aube"; e.tour = 1; e.nuitResolue = 1; });
    assert.deepEqual([L.etapeSuivante(x.public, x.secret, { villageois: vil }).cle, L.etapeSuivante(x.public, x.secret, { villageois: vil }).donnees.phase], ["debat", "jour"]);
    const mortBraco = vil.map(w => (w.id === "a5" ? { ...w, vivant: false } : w));
    x = partie(L, e => { e.phase = "aube"; e.tour = 1; e.nuitResolue = 1; e.morts = [{ acteurId: "a5", tour: 1, phase: "aube", cause: "meute" }]; });
    let e = L.etapeSuivante(x.public, x.secret, { villageois: mortBraco });
    assert.deepEqual([e.cle, e.action, e.donnees.id], ["emporter", "emporter", "a5"]);
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: mortBraco, ignorer: ["emporter:a5"] }).cle, "debat", "le MJ peut dire « personne »");
    const emporte = mortBraco.map(w => (w.id === "a6" ? { ...w, vivant: false } : w));
    x = partie(L, e => { e.phase = "aube"; e.tour = 1; e.nuitResolue = 1; e.morts = [{ acteurId: "a5", tour: 1, cause: "meute" }, { acteurId: "a6", tour: 1, cause: "emporte" }]; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: emporte }).cle, "debat", "une fois emporté, on passe");
    // La meute à égalité : victoire à vérifier.
    const deux = [v("a1", "loup"), v("a6", "villageois"), v("a7", "villageois", { vivant: false })];
    x = partie(L, e => { e.phase = "aube"; e.tour = 2; e.nuitResolue = 2; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: deux }).cle, "victoire");
  },
  "jour : ouvrir le vote ; vote ouvert : clore, avec les voix qui manquent": L => {
    const vil = village();
    let x = partie(L, e => { e.phase = "jour"; e.tour = 1; e.nuitResolue = 1; });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: vil }).cle, "ouvrirVote");
    x = partie(L, e => { const o = L.ouvrirVote(e, { candidats: vil.map(w => w.id) }); o.tour = 1; o.vote.votes = { a1: "a6", a2: "a6" }; return o; });
    const e = L.etapeSuivante(x.public, x.secret, { villageois: vil });
    assert.deepEqual([e.cle, e.action, e.donnees.n, e.detail?.cle], ["cloreVote", "cloreVote", 5, "voixManquantes"]);
  },
  "vote clos : éliminer le désigné (le Juge peut encore annuler), puis la Chapelle, puis la nuit": L => {
    const vil = village();
    const clos = (modif = () => {}) => partie(L, e => {
      let o = L.ouvrirVote(e, { candidats: vil.map(w => w.id) });
      o.tour = 1; o.vote.votes = { a1: "a6", a2: "a6", a3: "a6" };
      o = L.cloreVote(o, { votants: vil.map(w => w.id) }).etat;
      o.batimentsCles = ["chapelle"];
      modif(o);
      return o;
    });
    let x = clos();
    let e = L.etapeSuivante(x.public, x.secret, { villageois: vil });
    assert.deepEqual([e.cle, e.action, e.donnees.id, e.detail?.cle], ["executer", "executer", "a6", "juge"]);
    const jugeRevele = vil.map(w => (w.id === "a4" ? { ...w, revele: true } : w));
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: jugeRevele }).detail, null, "un Juge révélé n'annule plus");
    const execute = vil.map(w => (w.id === "a6" ? { ...w, vivant: false } : w));
    x = clos(o => { o.morts.push({ acteurId: "a6", tour: 1, phase: "vote", cause: "vote" }); });
    assert.equal(L.etapeSuivante(x.public, x.secret, { villageois: execute }).cle, "chapelle");
    x = clos(o => { o.morts.push({ acteurId: "a6", tour: 1, cause: "vote" }); o.jour.effets.push({ type: "asile", cible: "a7", nuit: 2 }); });
    assert.deepEqual([L.etapeSuivante(x.public, x.secret, { villageois: execute }).cle, L.etapeSuivante(x.public, x.secret, { villageois: execute }).donnees.phase], ["nuit", "nuit"]);
  },
  "fin : rejouer": L => {
    const x = partie(L, e => { e.phase = "fin"; e.vainqueur = "village"; });
    assert.deepEqual([L.etapeSuivante(x.public, x.secret, { villageois: village() }).cle, L.etapeSuivante(x.public, x.secret, { villageois: village() }).action], ["rejouer", "rejouer"]);
  },
  "ambiances : la nuit, la tension du vote, rien sinon": L => {
    assert.equal(L.ambianceDePhase("nuit"), "nuit");
    assert.equal(L.ambianceDePhase("vote"), "tension");
    for (const p of ["preparation", "aube", "jour", "fin"]) assert.equal(L.ambianceDePhase(p), "");
  }
};

const MUTATIONS_ETAPES = [
  ["if (attente.includes(e.roleCle)) return etape(\"attendre\", \"\", donnees, { attente: true });", "", "en attente d'une réponse"],
  ["if (faits.has(e.roleCle)) continue;", "", "rôles déjà réveillés"],
  ["if (etat.nuitResolue !== Math.max(1, etat.tour)) return etape(\"aube\", \"aube\");", "", "résoudre l'aube"],
  ["if (emporteur) return etape(", "if (false) return etape(", "Braconnière"],
  ["if (suivis <= avant && !ignorer.includes(`emporter:${m.acteurId}`)) enAttente.push(m.acteurId);", "enAttente.push(m.acteurId);", "Braconnière servie"],
  ["if (!etat.vainqueur && verifierVictoire(", "if (false && verifierVictoire(", "victoire"],
  ["const manquent = Math.max(0, vivants.length - v.exprimes.filter(id => ids.has(id)).length);", "const manquent = 0;", "voix manquantes"],
  ["if (condamne) {", "if (false) {", "exécuter le désigné"],
  ["const juge = vivants.find(x => x.role?.effet === \"annuler-vote\" && !x.revele", "const juge = vivants.find(x => x.role?.effet === \"annuler-vote\"", "Juge révélé"],
  ["if (chapelleDue() && !voteChapelle && voteExecutionDuJour(etat)) return etape(\"chapelle\", \"voteChapelle\");", "", "Chapelle"],
  ["vote: \"tension\"", "vote: \"\"", "tension du vote"],
  ["if (etat.phase === \"fin\") return etape(\"rejouer\", \"rejouer\", { vainqueur: etat.vainqueur });", "", "rejouer"]
];

async function logiqueMutee(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-etapes-mutant-"));
  cpSync(join(SYSTEME, "logique"), dossier, { recursive: true });
  const f = join(dossier, "etapes.mjs");
  const texte = readFileSync(f, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable : ${avant}`);
  writeFileSync(f, texte.replace(avant, apres));
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}
const echecsEtapes = L => Object.entries(VERIFS_ETAPES).filter(([, f]) => { try { f(L); return false; } catch { return true; } }).map(([n]) => n);

test("étape suivante : chaque phase et chaque situation donnent l'étape attendue", () => {
  for (const [nom, f] of Object.entries(VERIFS_ETAPES)) assert.doesNotThrow(() => f(L0), nom);
});

test("étape suivante : chaque règle cassée est détectée", async () => {
  const passees = [];
  for (const [avant, apres, regle] of MUTATIONS_ETAPES) if (!echecsEtapes(await logiqueMutee(avant, apres)).length) passees.push(regle);
  assert.deepEqual(passees, []);
});

// ================================================================== la Table du MJ humain, sur la doublure
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const plateau = await import("../systems/lakour-loups/scripts/plateau.mjs");
const local = await import("../systems/lakour-loups/scripts/plateau-local.mjs");
const MJ = await import("../systems/lakour-loups/scripts/actions-mj.mjs");
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);

// Le point d'enregistrement des compagnons, tel que le MJ IA le dépose (doublure : noms tirés d'une liste).
function pointCompagnons() {
  const noms = ["Ysoline", "Barnabé", "Gaspard", "Mahaut", "Eudes", "Clémence", "Anselme", "Perrine"];
  let i = 0;
  const point = {
    disponible: true, crees: [], retires: [],
    async creer(n) {
      const ids = [];
      for (let k = 0; k < n; k++) {
        const a = await Actor.implementation.create({ name: noms[i++ % noms.length], type: "villageois", system: { joueur: "", compagnon: true }, ownership: { default: 1 } });
        ids.push(a.id);
      }
      point.crees.push(...ids);
      return ids;
    },
    async retirer(id) { point.retires.push(id); await game.actors.get(id)?.delete(); }
  };
  return point;
}

function monde({ joueurs = 3, ia = true, graine = "humain" } = {}) {
  installerFoundry({ joueurs, contenu: true });
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  api.compagnons = null;
  plateau.oublierPlateau();
  plateau.brancherPlateau();
  api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
  api.plateau.configurer({ jetonNeutre: NEUTRE });
  local.remettreAZero();
  const scene = ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
  const h = creerHasard(`${graine}-ia`);
  // Le cerveau des compagnons (repli simple) : un candidat au hasard, un mot pour le Messager.
  api.resolveurs.compagnon = async d => (d.mode === "texte" ? "Méfiez-vous du moulin." : melanger(d.candidats.map(c => c.id), h).slice(0, d.nombre));
  if (ia) api.compagnons = pointCompagnons();
  const joueursSimules = simulerJoueurs({ graine: `${graine}-joueurs`, fraude: false });
  return { scene, joueursSimules };
}

// Ce que montre la scène à cette étape : places, lumière, statuts, rien de marqué sur un loup caché, « a voté ».
function verifierScene(scene, ou) {
  const e = api.etat();
  const phase = e.phase;
  const g = { size: 100, sceneX: 0, sceneY: 0 };
  for (const a of villageois()) {
    const t = scene.tokens.filter(x => x.actorId === a.id);
    assert.equal(t.length, 1, `${ou} : ${a.name} a un jeton`);
    const c = L0.versCases(t[0], g);
    assert.equal(t[0].locked, true);
    if (!a.system.vivant) {
      assert.ok(c.x > CIMETIERE.x && c.x < CIMETIERE.x + CIMETIERE.l && c.y > CIMETIERE.y && c.y < CIMETIERE.y + CIMETIERE.h, `${ou} : ${a.name} mort, au cimetière`);
      assert.ok(a.statuses.has("dead"), `${ou} : ${a.name} mort, sans crâne`);
    } else if (["jour", "vote", "fin"].includes(phase)) {
      assert.ok(c.x - 0.5 >= PLACE.x && c.x + 0.5 <= PLACE.x + PLACE.l && c.y - 0.5 >= PLACE.y && c.y + 0.5 <= PLACE.y + PLACE.h, `${ou} : ${a.name} sur la place`);
    } else assert.deepEqual(c, PLATEAU_VILLAGE.seuils[a.system.maison], `${ou} : ${a.name} devant ${a.system.maison}`);
    assert.equal(a.statuses.has("silence"), Boolean(a.system.vivant && a.system.silence), `${ou} : icône du silence de ${a.name}`);
    const revele = a.system.revele || phase === "fin";
    assert.equal(t[0].texture.src, revele ? roleDe(a).img : NEUTRE, `${ou} : image de ${a.name}`);
  }
  assert.equal(scene.environment.darknessLevel, L0.lumiereDePhase(phase), `${ou} : lumière`);
  if (e.vote.ouvert) for (const id of e.vote.exprimes) assert.equal(local.decorDe(id).aVote, true, `${ou} : coche « a voté »`);
}

// Les étapes permises par phase (cohérence de la ligne en pointillés).
const ETAPES_DE_PHASE = {
  preparation: ["nuit", "distribuer"], nuit: ["reveiller", "aube", "debat", "emporter", "victoire"], aube: ["aube", "emporter", "victoire", "debat"],
  jour: ["bailli", "succession", "cloreVote", "ouvrirVote", "emporter", "victoire"], vote: ["cloreVote", "departage", "executer", "emporter", "victoire", "chapelle", "ouvrirVote", "nuit"],
  fin: ["rejouer"]
};
const ACTIONS_DE_LA_TABLE = ["distribuer", "phase", "reveiller", "aube", "voteBailli", "ouvrirVote", "cloreVote", "executer", "emporter", "victoire", "voteChapelle", "rejouer"];

// Une partie menée par la Table, de la préparation à la victoire.
async function partieHumaine(graine) {
  const { scene } = monde({ graine });
  const h = creerHasard(`${graine}-mj`);
  const prep = MJ.nouvellePreparation();
  assert.equal(MJ.iaDisponible(), true);
  await MJ.ajouterIA(2);
  await MJ.ajouterIA(3);
  await MJ.retirerIA();
  assert.equal(MJ.compagnonsDuVillage().length, 4, "4 joueurs IA");
  assert.equal(api.etapeSuivante().cle, "distribuer");
  const r = await MJ.distribuer(prep);
  await api.plateau.attendre();
  assert.equal(r.joueurs.length, 3);
  assert.equal(r.compagnons.length, 4);
  assert.equal(r.composition.cle, "generee");
  assert.ok(scene.active, "la scène du village est active");
  const ignorer = [];
  let fin = false, pas = 0;
  const vues = new Set();
  while (!fin) {
    assert.ok(++pas < 400, "la partie ne finit pas");
    await calme();
    await api.plateau.attendre();
    const e = api.etapeSuivante({ ignorer });
    const phase = api.etat().phase;
    const ou = `${graine}, pas ${pas} (${phase}, tour ${api.etat().tour}) : ${e.cle}`;
    vues.add(e.cle);
    verifierScene(scene, ou);
    assert.ok(ETAPES_DE_PHASE[phase].includes(e.cle), `${ou} : étape incohérente`);
    assert.notEqual(e.cle, "attendre", `${ou} : personne ne devrait être en attente entre deux étapes`);
    if (e.action) assert.ok(ACTIONS_DE_LA_TABLE.includes(e.action), `${ou} : action ${e.action} sans bouton`);
    assert.ok(api.etat().tour <= 30, "plus de 30 tours");
    switch (e.cle) {
      case "rejouer": fin = true; break;
      case "emporter": {
        const vivants = villageois().filter(a => a.system.vivant).map(a => a.id);
        if (h() < 0.25 || !vivants.length) ignorer.push(`emporter:${e.donnees.id}`);
        else await MJ.faireEtape(e, { cible: choisir(vivants, h) });
        break;
      }
      case "reveiller": {
        // Un rôle réveillé : seuls ses joueurs reçoivent une demande (ou son compagnon IA, par le résolveur).
        const n = emissions.length;
        const x = await MJ.faireEtape(e, { delai: 3000 });
        for (const d of emissions.slice(n).filter(m => m.type === "demande")) {
          assert.ok(x.acteurIds.includes(d.acteurId) || d.mode === "texte", `${ou} : demande à un autre que le rôle réveillé`);
          assert.deepEqual(d.recipients, [d.destinataire]);
        }
        break;
      }
      default: await MJ.faireEtape(e, { delai: 3000 });
    }
  }
  assert.equal(api.etat().phase, "fin");
  const vainqueur = api.etat().vainqueur;
  assert.ok(vainqueur);
  for (const c of ["nuit", "reveiller", "aube", "debat", "bailli", "ouvrirVote", "cloreVote", "rejouer"]) assert.ok(vues.has(c), `${graine} : étape jamais vue : ${c}`);
  // Les compagnons ont agi la nuit (résolveur) et voté.
  assert.ok(journalHooks.some(x => x.nom === "lakourLoups.action"), "des choix de nuit");
  // Rejouer : mêmes joueurs, mêmes joueurs IA.
  const avant = villageois().filter(a => a.system.compagnon).map(a => a.id).sort();
  const r2 = await MJ.faireEtape(api.etapeSuivante());
  await api.plateau.attendre();
  assert.equal(r2.joueurs.length, 3);
  assert.deepEqual(villageois().filter(a => a.system.compagnon).map(a => a.id).sort(), avant, "les joueurs IA sont gardés");
  verifierScene(scene, `${graine} : après « Rejouer »`);
  assert.equal(api.etapeSuivante().cle, "nuit");
  assert.deepEqual(erreurs(), []);
  assert.deepEqual(erreursHooks, []);
  return { vainqueur, vues: [...vues], tours: pas };
}

test("Table du MJ humain : parties complètes avec 3 humains et 4 joueurs IA, sans outil du MJ IA, jusqu'à la victoire et « Rejouer »", async () => {
  const bilan = [];
  for (const graine of ["brume", "lanterne", "cendres", "moulin"]) bilan.push(await partieHumaine(graine));
  assert.ok(bilan.every(b => b.vainqueur));
  console.log(`MJ humain : ${bilan.map(b => `${b.vainqueur.length > 10 ? "solitaire" : b.vainqueur} en ${b.tours} étapes`).join(" ; ")}`);
});

test("préparation : sans point des compagnons, pas de « + Joueur IA » ; la distribution marche avec les humains seuls", async () => {
  monde({ joueurs: 5, ia: false });
  assert.equal(MJ.iaDisponible(), false);
  await assert.rejects(() => MJ.ajouterIA(1), /module MJ IA/);
  const gabarit = readFileSync(join(SYSTEME, "templates/table.hbs"), "utf8");
  const bloc = gabarit.slice(gabarit.indexOf("{{#if preparation.ia.disponible}}"), gabarit.indexOf("{{/if}}", gabarit.indexOf("data-action=\"prepIA\"")));
  assert.match(bloc, /data-action="prepIA"/, "le bouton « + Joueur IA » n'est que dans le bloc « ia.disponible »");
  assert.match(gabarit, /\{\{else\}\}\s*<span class="loups-vide loups-grise">\{\{localize "LAKOUR_LOUPS.Preparation.IAAbsente"\}\}/);
  // Un joueur décoché ne joue pas.
  const prep = MJ.nouvellePreparation();
  MJ.cocher(prep, "u5");
  const r = await MJ.distribuer(prep);
  assert.deepEqual(r.joueurs.map(j => j.userId).sort(), ["u1", "u2", "u3", "u4"]);
  assert.equal(r.compagnons.length, 0);
  assert.equal(villageois().length, 4);
  // Composition choisie à la main : l'indicateur d'équilibre, et la liste respectée.
  prep.mode = "manuel";
  MJ.changerRole(prep, "loup-de-brumecombe", 1);
  MJ.changerRole(prep, "herboriste", 1);
  const eq = MJ.equilibreDesRoles(MJ.rolesManuels(prep, 4), (await api.contenu()).equilibre);
  assert.equal(eq.loups, 1);
  assert.ok(["equilibree", "village", "meute"].includes(eq.verdict));
  const r2 = await MJ.distribuer(prep);
  assert.deepEqual([...r2.composition.roles].sort(), ["herboriste", "loup-de-brumecombe", "villageois", "villageois"]);
});

test("point des compagnons : le hook prévient la Table ; « − » retire par le MJ IA", async () => {
  monde({ ia: false });
  const n = journalHooks.length;
  const point = pointCompagnons();
  api.compagnons = point;
  assert.ok(journalHooks.slice(n).some(x => x.nom === "lakourLoups.compagnons"), "hook lakourLoups.compagnons");
  await MJ.ajouterIA(2);
  assert.equal(MJ.compagnonsDuVillage().length, 2);
  await MJ.retirerIA();
  assert.equal(point.retires.length, 1);
  assert.equal(MJ.compagnonsDuVillage().length, 1);
});

test("ambiances : si le MJ IA est actif, « nuit » la nuit et « tension » au vote ; sans lui, rien", async () => {
  monde({ ia: false });
  const { ambiancePourPhase, oublierAmbiance } = await import("../systems/lakour-loups/scripts/ambiance.mjs");
  oublierAmbiance();
  assert.equal(await ambiancePourPhase("nuit"), null, "sans le module MJ IA : rien");
  const pistes = [];
  const playlist = { name: "Ambiances (MJ IA)", sounds: { find: f => pistes.find(f), filter: f => pistes.filter(f) }, getFlag: () => true,
    async createEmbeddedDocuments(t, l) { const s = l.map(d => ({ ...d, id: `s${pistes.length}`, playing: false, getFlag: (m, k) => d.flags[m][k], async update(c) { Object.assign(this, c); } })); pistes.push(...s); return s; } };
  game.modules = new Map([["lakour-mj-ia", { active: true }]]);
  game.playlists = { find: f => [playlist].find(f) };
  const fetchOrigine = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL("../modules/lakour-mj-ia/assets/sons/index.json", import.meta.url), "utf8")) });
  try {
    assert.equal(await ambiancePourPhase("nuit"), "nuit");
    assert.equal(pistes.find(p => p.playing)?.flags["lakour-mj-ia"].ambiance, "nuit");
    assert.equal(await ambiancePourPhase("vote"), "tension");
    assert.deepEqual(pistes.filter(p => p.playing).map(p => p.flags["lakour-mj-ia"].ambiance), ["tension"]);
    assert.equal(await ambiancePourPhase("jour"), "");
    assert.equal(pistes.filter(p => p.playing).length, 0);
  } finally { globalThis.fetch = fetchOrigine; }
});
