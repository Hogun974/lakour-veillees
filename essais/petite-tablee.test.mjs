// La Petite tablée (système lakour-loups 0.11.0, logique/tablee.mjs) : le mode pour peu d'humains (1 à 4) et des compagnons IA
// (2 à 8). Logique pure (contraintes du partage, tirage contraint, sort qui tranche, glas d'office), puis l'API sur la doublure
// de Foundry (nouvellePartie niveau « petite-tablee », distribuer, réglage monde qui se souvient, composition prête, MJ IA par
// api.logique.composer, annonce publique sans nom, clôture d'un vote à égalité, départage du Bailli complété par le sort), et des
// mutations : chaque règle cassée est attrapée.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, calme, messages, reglages, emissions, FR } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 4, contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const EQ = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));
const decrire = cle => ({ camp: EQ.roles[cle]?.camp ?? "village", information: Boolean(EQ.roles[cle]?.information) });

let L, api, enregistrerReglages, ecouterSocket;
async function charger(racine = SYSTEME) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [l, a, r, s] = await Promise.all([m("logique/index.mjs"), m("scripts/api.mjs"), m("scripts/reglages.mjs"), m("scripts/socket.mjs")]);
  L = l; ({ api } = a); ({ enregistrerReglages } = r); ({ ecouterSocket } = s);
}
await charger();

const villageois = () => game.actors.filter(a => a.type === "villageois");
const campDe = a => secretDuMJ.camp(a);
const cleDe = a => secretDuMJ.role(a)?.system.cle ?? "";
const humainsEtCompagnons = () => ({ humains: villageois().filter(a => a.system.joueur), compagnons: villageois().filter(a => a.system.compagnon && !a.system.joueur) });
// Les places d'une partie distribuée, telles que contraintesTablee les lit.
const placesDe = () => villageois().map(a => ({ humain: Boolean(a.system.joueur), role: { camp: campDe(a), information: Boolean(EQ.roles[cleDe(a)]?.information) } }));

// ------------------------------------------------------------------ logique pure
test("contraintesTablee : garanti — jamais tous loups, ni (à trois) tous du même camp ; favorisé seulement si la règle est tirée — l'ombre des deux côtés (dès trois humains), la lanterne chez un humain", () => {
  const p = (humain, camp, information = false) => ({ humain, role: { camp, information } });
  const V = c => p(false, c), H = c => p(true, c);
  const TOUT = { ombre: true, lanterne: true };
  // Garanti (règles favorisées non tirées : par défaut).
  assert.deepEqual(L.contraintesTablee([H("meute"), H("meute"), V("village"), V("village")]), ["humains-tous-loups"]);
  assert.deepEqual(L.contraintesTablee([H("village"), H("village"), H("village"), V("meute"), V("solitaire")]), ["humains-meme-camp"]);
  assert.deepEqual(L.contraintesTablee([H("meute"), H("solitaire"), H("solitaire"), V("village"), V("village")]), ["humains-meme-camp"]);
  // Sans règle favorisée : deux humains du Village, l'ombre toute chez les compagnons, la lanterne chez un compagnon — tout est permis.
  assert.deepEqual(L.contraintesTablee([H("village"), H("village"), V("meute"), V("solitaire"), p(false, "village", true)]), []);
  assert.deepEqual(L.contraintesTablee([H("village"), H("village"), H("village"), V("meute"), V("solitaire"), p(false, "village", true)]), ["humains-meme-camp"]);
  // Règles favorisées tirées : la lanterne chez un humain du Village ; l'ombre des deux côtés, à trois humains ou plus seulement.
  assert.deepEqual(L.contraintesTablee([H("meute"), p(true, "village"), V("village"), p(false, "village", true)], TOUT), ["lanterne-sans-humain"]);
  assert.deepEqual(L.contraintesTablee([H("village"), H("village"), H("village"), V("meute"), V("solitaire")], TOUT), ["humains-meme-camp", "ombre-sans-humain", "lanterne-sans-humain"].filter(x => x !== "lanterne-sans-humain"));
  assert.deepEqual(L.contraintesTablee([H("meute"), H("solitaire"), H("village"), V("village"), V("village")], TOUT), ["ombre-sans-compagnon"]);
  // À deux humains, jamais de règle de côté, même tirée : deux villageois humains, l'ombre chez les compagnons, c'est permis.
  assert.deepEqual(L.contraintesTablee([p(true, "village", true), H("village"), V("meute"), V("solitaire")], TOUT), []);
  assert.deepEqual(L.contraintesTablee([H("meute"), p(true, "village", true), V("solitaire"), V("village"), p(false, "village", true)], TOUT), []);
  // Un seul rôle de l'ombre (4 ou 5 places) : aucune règle de côté ; un seul humain : jamais « tous du même camp ».
  assert.deepEqual(L.contraintesTablee([H("village"), p(true, "village", true), V("meute"), V("village")], TOUT), []);
  assert.deepEqual(L.contraintesTablee([p(true, "village", true), V("meute"), V("village"), V("village")], TOUT), []);
  assert.deepEqual(L.contraintesTablee([H("meute"), V("village"), V("village"), V("village", true)], TOUT), []);
  // Aucun humain (une table de compagnons seuls) : rien à contraindre.
  assert.deepEqual(L.contraintesTablee([V("meute"), V("village"), V("village", true)], TOUT), []);
  // Les règles favorisées se tirent en secret : jamais l'ombre à moins de trois humains ; parfois l'une, parfois l'autre.
  const tirees = Array.from({ length: 300 }, (_, i) => L.reglesTablee({ humains: 3, hasard: L.creerHasard(`r${i}`) }));
  assert.ok(tirees.some(r => r.ombre) && tirees.some(r => !r.ombre) && tirees.some(r => r.lanterne) && tirees.some(r => !r.lanterne));
  assert.ok(Array.from({ length: 100 }, (_, i) => L.reglesTablee({ humains: 2, hasard: L.creerHasard(`d${i}`) })).every(r => !r.ombre), "deux humains : jamais l'ombre des deux côtés");
});

test("distribuerTablee : un tirage qui satisfait les contraintes, reproductible, métiers et maisons mélangés ; à défaut, le moins mauvais", () => {
  const roles = ["loup-de-brumecombe", "liseuse-de-cendres", "garde-du-pont", "colporteur", "herboriste", "sonneur", "villageois"];
  const joueurs = ["u1", "u2", "u3", "c0", "c1", "c2", "c3"];
  for (let g = 0; g < 200; g++) {
    const r = L.distribuerTablee({ roles, metiers: ["m1", "m2", "m3", "m4", "m5", "m6", "m7"], joueurs, maisons: joueurs.map((_, i) => `Maison ${i + 1}`), humains: new Set(["u1", "u2", "u3"]), decrire, graine: `t${g}` });
    assert.deepEqual(r.manques, [], `graine ${g}`);
    const places = r.tirage.map(x => ({ humain: x.joueur.startsWith("u"), role: decrire(x.role) }));
    assert.deepEqual(L.contraintesTablee(places, r.regles), []);
    assert.deepEqual(L.contraintesTablee(places), [], "les règles garanties, toujours");
    assert.deepEqual(r.tirage.map(x => x.joueur), joueurs, "dans l'ordre des joueurs");
    assert.equal(new Set(r.tirage.map(x => x.metier)).size, 7);
    assert.equal(new Set(r.tirage.map(x => x.maison)).size, 7);
    assert.deepEqual([...r.tirage.map(x => x.role)].sort(), [...roles].sort(), "les mêmes rôles");
  }
  const a = L.distribuerTablee({ roles, joueurs, humains: new Set(["u1", "u2", "u3"]), decrire, graine: "même" });
  const b = L.distribuerTablee({ roles, joueurs, humains: new Set(["u1", "u2", "u3"]), decrire, graine: "même" });
  assert.deepEqual(a, b, "même graine, même tirage");
  // Deux humains, deux compagnons, un seul rôle de l'ombre : la lanterne va chez un humain du Village, le loup où il veut.
  const petit = L.distribuerTablee({ roles: ["loup-de-brumecombe", "liseuse-de-cendres", "garde-du-pont", "villageois"], joueurs: ["u1", "u2", "c0", "c1"], humains: new Set(["u1", "u2"]), decrire, graine: "4" });
  assert.deepEqual(petit.manques, []);
  assert.ok(!petit.tirage.filter(x => x.joueur.startsWith("u")).every(x => decrire(x.role).camp === "meute"));
  // Favorisé, pas garanti : sur beaucoup de tirages, il arrive que les deux humains soient du Village, que la lanterne aille à un
  // compagnon, et (à trois humains) que l'ombre soit toute d'un côté ; rien n'est donc certain pour un humain.
  const parts = (h, graines = 300) => {
    const j = [...Array(h).keys()].map(i => `u${i}`).concat(["c0", "c1", "c2", "c3"]);
    const hum = new Set(j.filter(x => x.startsWith("u")));
    const rs = Array.from({ length: graines }, (_, i) => L.distribuerTablee({ roles: roles.slice(0, j.length), joueurs: j, humains: hum, decrire, graine: `p${h}-${i}` }));
    const vue = r => r.tirage.map(x => ({ humain: x.joueur.startsWith("u"), ...decrire(x.role) }));
    return {
      tousVillage: rs.filter(r => vue(r).filter(p => p.humain).every(p => p.camp === "village")).length / graines,
      lanterneIA: rs.filter(r => { const v = vue(r); return v.some(p => p.humain && p.camp === "village") && !v.some(p => p.humain && p.camp === "village" && p.information); }).length / graines,
      ombreUnCote: rs.filter(r => { const v = vue(r); return !v.some(p => p.humain && L.estOmbre(p.camp)) || !v.some(p => !p.humain && L.estOmbre(p.camp)); }).length / graines
    };
  };
  const deux = parts(2), trois = parts(3);
  assert.ok(deux.tousVillage > 0.3, `à deux humains, tous deux du Village arrive (${deux.tousVillage})`);
  assert.ok(deux.lanterneIA > 0.1, `la lanterne chez un compagnon arrive (${deux.lanterneIA})`);
  assert.ok(trois.ombreUnCote > 0.03, `à trois humains, l'ombre d'un seul côté arrive (${trois.ombreUnCote})`);
  assert.equal(parts(3).tousVillage, 0, "à trois humains, jamais tous du Village (garanti)");
  // Impossible (deux humains seuls, deux loups) : le tirage rend le moins mauvais et dit ce qui manque.
  const impossible = L.distribuerTablee({ roles: ["loup-de-brumecombe", "loup-de-brumecombe"], joueurs: ["u1", "u2"], humains: new Set(["u1", "u2"]), decrire, graine: "x", essais: 30 });
  assert.deepEqual(impossible.manques, ["humains-tous-loups"]);
  assert.equal(impossible.tirage.length, 2);
});

test("sortTranche, glasTablee, nombreDeLoupsTablee, verifierTablee : le barème public du mode", () => {
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11, 12].map(L.nombreDeLoupsTablee), [1, 1, 1, 1, 2, 2, 2, 3, 3]);
  assert.deepEqual([4, 5, 6, 7, 8, 10, 12].map(L.ombresTablee), [1, 1, 2, 2, 2, 2, 4]);
  assert.deepEqual([6, 7, 8, 12].map(L.nuitBlancheTablee), [false, false, true, true]);
  assert.deepEqual([6, 7, 8, 12].map(L.pariteStricteTablee), [false, false, true, true]);
  // La meute doit être plus nombreuse (strict) : à deux loups contre deux, rien ; à deux contre un, la meute.
  const v = (id, camp, vivant = true) => ({ id, vivant, camp, amoureux: "", role: { cle: camp === "meute" ? "loup-de-brumecombe" : "villageois" } });
  const deuxContreDeux = [v("a", "meute"), v("b", "meute"), v("c", "village"), v("d", "village"), v("e", "village", false)];
  assert.equal(L.verifierVictoire({ villageois: deuxContreDeux, strict: true }), "");
  assert.equal(L.verifierVictoire({ villageois: deuxContreDeux }), "meute");
  assert.equal(L.verifierVictoire({ villageois: deuxContreDeux.slice(0, 3), strict: true }), "meute");
  assert.equal(L.verifierVictoire({ villageois: deuxContreDeux, strict: true, glas: true }), "meute", "au glas, un loup vivant suffit");
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11, 12].map(L.glasTablee), [3, 3, 3, 4, 4, 5, 5, 6, 6]);
  const h = L.creerHasard("sort");
  const tires = L.sortTranche({ candidats: ["a", "b", "c"], places: 2, hasard: h });
  assert.equal(tires.length, 2);
  assert.ok(tires.every(x => ["a", "b", "c"].includes(x)) && tires[0] !== tires[1]);
  assert.deepEqual(L.sortTranche({ candidats: ["a", "a"], places: 3, hasard: h }), ["a"]);
  assert.deepEqual(L.sortTranche({ candidats: [], places: 1 }), []);
  assert.deepEqual(L.verifierTablee({ humains: 2, compagnons: 4 }), { ok: true, raison: "" });
  assert.deepEqual(L.verifierTablee({ humains: 5, compagnons: 4 }), { ok: false, raison: "humains" });
  assert.deepEqual(L.verifierTablee({ humains: 3, compagnons: 1 }), { ok: false, raison: "compagnons" });
  assert.deepEqual(L.verifierTablee({ humains: 4, compagnons: 9 }), { ok: false, raison: "places" });
  assert.equal(L.NIVEAUX.at(-1), L.NIVEAU_PETITE_TABLEE);
});

test("cloreVote : en petite tablée, une égalité en tête sans Bailli est tranchée par le sort ; avec un Bailli, il tranche et le sort complète s'il passe", () => {
  const base = L.ouvrirVote({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, petiteTablee: true, bailli: L.bailliInitial(false) }, { candidats: ["a", "b", "c", "d"] });
  let e = base;
  for (const [votant, cible] of [["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"]]) ({ etat: e } = L.enregistrerVote(e, { votant, cible }));
  const c = L.cloreVote(e, { votants: ["a", "b", "c", "d"], hasard: L.creerHasard("égalité") });
  assert.equal(c.resultat.egalite, true);
  assert.equal(c.resultat.elus.length, 1, "le sort a désigné un condamné");
  assert.deepEqual(c.resultat.sort, c.resultat.elus);
  assert.ok(["a", "b", "c", "d"].includes(c.resultat.elu));
  assert.equal(c.resultat.departage, null);
  // Hors petite tablée : personne.
  const ordinaire = L.cloreVote({ ...e, petiteTablee: false }, { votants: ["a", "b", "c", "d"] });
  assert.deepEqual(ordinaire.resultat.elus, []);
  assert.equal(ordinaire.resultat.sort, undefined);
  // Un vote de la Chapelle ou du Bailli n'est pas tranché par le sort.
  let ch = L.ouvrirVote({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, petiteTablee: true, bailli: L.bailliInitial(false) }, { candidats: ["a", "b"], objet: "chapelle" });
  for (const [votant, cible] of [["a", "b"], ["b", "a"]]) ({ etat: ch } = L.enregistrerVote(ch, { votant, cible }));
  assert.deepEqual(L.cloreVote(ch, { votants: ["a", "b"] }).resultat.elus, []);
  // Avec un Bailli en charge (a) : le départage lui revient ; s'il passe, le sort tranche parmi les ex æquo.
  let b = L.ouvrirVote({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, petiteTablee: true, bailli: { ...L.bailliInitial(true), acteurId: "a", depuis: 1 } }, { candidats: ["a", "b", "c", "d"] });
  for (const [votant, cible] of [["a", "c"], ["b", "c"], ["c", "d"], ["d", "d"], ["e", "d"]]) ({ etat: b } = L.enregistrerVote(b, { votant, cible }));
  const r = L.cloreVote(b, { votants: ["a", "b", "c", "d", "e"] });
  assert.ok(r.resultat.departage?.enAttente, "le Bailli tranche");
  assert.equal(r.resultat.sort, undefined);
  const passe = L.trancherVote(r.etat, [], { vivants: ["a", "b", "c", "d", "e"], hasard: L.creerHasard("passe") });
  assert.equal(passe.vote.resultat.elus.length, 1, "le sort complète");
  assert.ok(["c", "d"].includes(passe.vote.resultat.elu));
  assert.deepEqual(passe.vote.resultat.departage.sort, passe.vote.resultat.elus);
  const tranche = L.trancherVote(r.etat, ["d"], { vivants: ["a", "b", "c", "d", "e"] });
  assert.deepEqual(tranche.vote.resultat.elus, ["d"]);
  assert.equal(tranche.vote.resultat.departage.sort, undefined);
  // Hors petite tablée, s'il passe : personne.
  const sans = L.trancherVote({ ...r.etat, petiteTablee: false }, [], { vivants: ["a", "b", "c", "d", "e"] });
  assert.deepEqual(sans.vote.resultat.elus, []);
  // L'état public porte le mode (une règle), jamais rien d'autre de neuf.
  assert.equal(L.etatPublic({ ...L.etatInitial(), petiteTablee: true }).petiteTablee, true);
});

// ------------------------------------------------------------------ l'API sur la doublure
function monde({ joueurs = 3, compagnons = 4 } = {}) {
  installerFoundry({ joueurs, contenu: true });
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  api.resolveurs.compagnon = d => (d.mode === "texte" ? "Rien." : [d.candidats.find(c => c.id !== d.acteurId)?.id].filter(Boolean));
  return { humains: Array.from({ length: joueurs }, (_, i) => `u${i + 1}`), ia: Array.from({ length: compagnons }, (_, i) => `IA ${i + 1}`) };
}
async function creerCompagnons(noms) {
  const ids = [];
  for (const nom of noms) ids.push((await Actor.implementation.create({ name: nom, type: "villageois", system: { joueur: "", compagnon: true } })).id);
  return ids;
}
const annoncesChat = () => messages.map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&apos;/g, "'"));

test("nouvellePartie({ niveau: petite-tablee }) : composition du mode, tirage contraint, glas d'office, état public et annonce sans nom, réglage qui se souvient", async () => {
  const { humains, ia } = monde({ joueurs: 3, compagnons: 4 });
  const ids = await creerCompagnons(ia);
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), false);
  const r = await api.nouvellePartie({ memesJoueurs: false, joueurs: humains, compagnons: ids, graine: "tablée", niveau: "petite-tablee" });
  await calme();
  assert.equal(r.composition.niveau, "petite-tablee");
  assert.match(r.composition.libelle, /^Petite tablée — /);
  assert.equal(r.tablee, true);
  assert.equal(r.glas, L.glasTablee(7));
  const e = api.etat();
  assert.equal(e.petiteTablee, true);
  assert.equal(e.glas, 4, "le glas final posé d'office (7 places : jour 4)");
  assert.equal(villageois().filter(a => campDe(a) === "meute").length, L.nombreDeLoupsTablee(7));
  assert.deepEqual(L.contraintesTablee(placesDe()), [], "le tirage respecte le partage");
  const { humains: h, compagnons: c } = humainsEtCompagnons();
  assert.ok(h.some(a => campDe(a) !== "village") && h.some(a => campDe(a) === "village"), "les humains ne sont pas tous du même camp");
  assert.ok(c.length === 4, "quatre compagnons");
  // Public : le mode, le glas ; l'annonce ne nomme personne ; la composition reste secrète.
  const pub = reglages.get("lakour-loups.partie").valeur;
  assert.equal(pub.petiteTablee, true);
  assert.equal(pub.composition, "");
  const annonce = annoncesChat().find(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Nom));
  assert.ok(annonce, "la petite tablée s'annonce au chat");
  assert.match(annonce, /3 joueur\(s\) et 4 compagnon\(s\) IA/);
  assert.match(annonce, /jour 4/);
  for (const a of villageois()) assert.ok(!annonce.includes(a.name), `l'annonce nomme ${a.name}`);
  assert.ok(!emissions.some(x => x.type === "hook" && x.nom === "lakourLoups.nouvellePartie" && "composition" in (x.args?.[0] ?? {})));
  // Le réglage se souvient ; la Table (préparation) le pré-sélectionne ; « Rejouer » sans niveau refait une petite tablée.
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true);
  const { nouvellePreparation } = await import("../systems/lakour-loups/scripts/actions-mj.mjs");
  assert.equal(nouvellePreparation().niveau, "petite-tablee");
  const encore = await api.nouvellePartie({ memesJoueurs: true, graine: "encore" });
  await calme();
  assert.equal(encore.composition.niveau, "petite-tablee");
  assert.equal(api.etat().petiteTablee, true);
  // Un niveau classique choisi : le réglage s'en souvient aussi (plus de petite tablée), ni glas ni mode.
  const classique = await api.nouvellePartie({ memesJoueurs: true, graine: "classique", niveau: "classique" });
  await calme();
  assert.equal(classique.composition.niveau, "classique");
  assert.equal(api.etat().petiteTablee, false);
  assert.equal(api.etat().glas, 0);
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), false);
  // Le réglage décoché prime : après une petite tablée, « Rejouer » sans niveau retombe sur le classique et ne recoche pas le réglage.
  await api.nouvellePartie({ memesJoueurs: true, graine: "tablée-bis", niveau: "petite-tablee" });
  await calme();
  await game.settings.set("lakour-loups", "petiteTablee", false);
  const rejouee = await api.nouvellePartie({ memesJoueurs: true, graine: "rejouer-decoche" });
  await calme();
  assert.equal(rejouee.composition.niveau, "classique", "réglage décoché : plus de petite tablée au Rejouer");
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), false, "le réglage n'est pas recoché");
  assert.equal(nouvellePreparation().niveau, "classique");
});

test("le MJ IA : api.logique.composer suit le réglage ; une composition prête « petite-tablee-n » choisit le mode d'elle-même ; distribuer({ tablee })", async () => {
  const { humains, ia } = monde({ joueurs: 2, compagnons: 4 });
  const ids = await creerCompagnons(ia);
  const contenu = await api.contenu();
  assert.ok(contenu.niveaux.includes("petite-tablee"));
  assert.ok(contenu.compositions.some(c => c.cle === "petite-tablee-06" && c.niveau === "petite-tablee"));
  // Sans réglage : composer suit le niveau demandé.
  assert.equal(api.logique.composer(8, contenu.equilibre, { niveau: "classique", graine: "a" }).niveau, "classique");
  await game.settings.set("lakour-loups", "petiteTablee", true);
  assert.equal(api.logique.composer(8, contenu.equilibre, { niveau: "classique", graine: "a" }).niveau, "petite-tablee", "le réglage l'emporte (12 places au plus)");
  assert.equal(api.logique.composer(14, contenu.equilibre, { niveau: "classique", graine: "a" }).niveau, "classique", "au-delà de 12 places, jamais");
  assert.equal(api.logique.composer(8, contenu.equilibre, { niveau: "classique", graine: "a", peste: true }).niveau, "classique", "une peste noire voulue reste ce qu'elle est");
  await game.settings.set("lakour-loups", "petiteTablee", false);
  // Une composition prête de petite tablée (mode « composition » du MJ IA) : le mode suit, et le réglage s'en souvient.
  const prete = await api.nouvellePartie({ memesJoueurs: false, joueurs: humains, compagnons: ids, graine: "prête", composition: "petite-tablee-06", niveau: "classique" });
  await calme();
  assert.equal(api.etat().petiteTablee, true, "la composition prête fait une petite tablée");
  assert.equal(api.etat().glas, 3);
  assert.equal(prete.composition.cle, "petite-tablee-06");
  assert.deepEqual(L.contraintesTablee(placesDe()), []);
  const { humains: h } = humainsEtCompagnons();
  assert.ok(!h.every(a => campDe(a) === "meute"), "à deux humains, jamais deux loups");
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true, "une composition prête de petite tablée est un choix : le réglage s'en souvient");
  await game.settings.set("lakour-loups", "petiteTablee", false);
  // distribuer({ tablee: true }) à la main, avec les rôles d'une composition classique : le partage vaut quand même.
  const uuidDe = cle => game.packs.get("lakour-veillees.roles").documents.find(d => d.system.cle === cle)?.uuid;
  const uuids = ["loup-de-brumecombe", "loup-de-brumecombe", "liseuse-de-cendres", "garde-du-pont", "villageois", "villageois"].map(uuidDe);
  assert.ok(uuids.every(Boolean));
  await api.distribuer({ roles: uuids, joueurs: humains, compagnons: ids, graine: "main", tablee: true });
  await calme();
  assert.equal(api.etat().petiteTablee, true);
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true, "un choix explicite est retenu");
  assert.deepEqual(L.contraintesTablee(placesDe()), []);
  // Une Nuit de la Saint-Martin n'est jamais une petite tablée, même avec le réglage — qu'elle ne touche pas ; son étiquette n'est pas
  // « petite-tablee » ; « Rejouer » ensuite refait une petite tablée.
  const sm = await api.nouvellePartie({ memesJoueurs: true, graine: "sm", format: "saint-martin" });
  await calme();
  assert.equal(sm.tablee, false);
  assert.equal(api.etat().petiteTablee, false);
  assert.notEqual(sm.composition.niveau, "petite-tablee");
  assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true, "la Saint-Martin ne touche pas au réglage");
  const apres = await api.nouvellePartie({ memesJoueurs: true, graine: "apres-sm", format: "" });   // (sans format : « Rejouer » rejoue une Saint-Martin)
  await calme();
  assert.equal(apres.composition.niveau, "petite-tablee");
  assert.equal(apres.tablee, true);
  // Un glas donné est gardé ; 0 veut dire « posé d'office ».
  const g7 = await api.nouvellePartie({ memesJoueurs: true, graine: "g7", niveau: "petite-tablee", glas: 7 });
  await calme();
  assert.equal(g7.glas, 7);
  const g0 = await api.nouvellePartie({ memesJoueurs: true, graine: "g0", niveau: "petite-tablee", glas: 0 });
  await calme();
  assert.equal(g0.glas, L.glasTablee(6));
  // Plus de 12 places : la composition retombe sur le niveau classique, sans le mode.
  const grande = monde({ joueurs: 4, compagnons: 9 });
  const treize = await api.nouvellePartie({ memesJoueurs: false, joueurs: grande.humains, compagnons: await creerCompagnons(grande.ia), graine: "13", niveau: "petite-tablee" });
  await calme();
  assert.equal(treize.composition.niveau, "classique");
  assert.equal(api.etat().petiteTablee, false);
  // Un seul humain : aucune règle de côté (il peut être du Village ou de l'ombre), et l'annonce ne dit que ce qui vaut.
  const camps = new Set();
  for (let i = 0; i < 16; i++) {
    const solo = monde({ joueurs: 1, compagnons: 5 });
    await api.nouvellePartie({ memesJoueurs: false, joueurs: solo.humains, compagnons: await creerCompagnons(solo.ia), graine: `solo${i}`, niveau: "petite-tablee" });
    await calme();
    camps.add(campDe(villageois().find(a => a.system.joueur)) === "village" ? "village" : "ombre");
    const annonce = annoncesChat().find(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Nom));
    assert.ok(annonce.includes(FR.LAKOUR_LOUPS.Tablee.RegleTirage) && !annonce.includes(FR.LAKOUR_LOUPS.Tablee.RegleLoups) && !annonce.includes(FR.LAKOUR_LOUPS.Tablee.RegleCamps), annonce);
  }
  assert.deepEqual([...camps].sort(), ["ombre", "village"], "un humain seul : tantôt du Village, tantôt de l'ombre");
  // Deux humains : l'annonce dit « jamais tous loups » et la lanterne favorisée, sans la règle des camps ni l'ombre des deux côtés.
  const duo = monde({ joueurs: 2, compagnons: 4 });
  await api.nouvellePartie({ memesJoueurs: false, joueurs: duo.humains, compagnons: await creerCompagnons(duo.ia), graine: "duo", niveau: "petite-tablee" });
  await calme();
  const annonceDuo = annoncesChat().find(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Nom));
  assert.ok(annonceDuo.includes(FR.LAKOUR_LOUPS.Tablee.RegleLoups) && annonceDuo.includes(FR.LAKOUR_LOUPS.Tablee.RegleTirage) && !annonceDuo.includes(FR.LAKOUR_LOUPS.Tablee.RegleCamps) && !annonceDuo.includes("deux côtés"), annonceDuo);
});

test("vote : en petite tablée, l'égalité d'un vote d'exécution est tranchée par le sort et annoncée ; l'exécution suit ; le glas finit la veillée", async () => {
  const { humains, ia } = monde({ joueurs: 2, compagnons: 2 });
  const ids = await creerCompagnons(ia);
  await game.settings.set("lakour-loups", "bailli", false);
  await api.nouvellePartie({ memesJoueurs: false, joueurs: humains, compagnons: ids, graine: "sort", niveau: "petite-tablee" });
  await calme();
  await api.changerPhase("nuit");
  await api.changerPhase("jour");
  const vivants = villageois().filter(a => a.system.vivant);
  const [a, b] = vivants;
  await api.ouvrirVote({ duree: 0 });
  await calme();   // les compagnons votent par leur résolveur (le premier autre candidat)
  // Deux voix contre a, deux contre b (les compagnons ont voté pour le premier candidat qui n'est pas eux : on force l'égalité).
  const { envoyerAuMJ } = await import("./doublures/foundry-loups.mjs");
  const CANAL = "system.lakour-loups";
  for (const v of vivants.filter(x => x.system.joueur)) envoyerAuMJ(CANAL, { type: "vote", votant: v.id, cible: v.id === a.id ? b.id : a.id, userId: v.system.joueur }, { emetteur: v.system.joueur });
  await calme();
  const r = await api.cloreVote();
  if (r.egalite) {
    assert.equal(r.elus.length, 1, "le sort a désigné quelqu'un");
    assert.deepEqual(r.sort, r.elus);
    assert.ok(annoncesChat().some(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Sort.split("{")[0].trim())), "le sort annoncé");
    assert.ok(api.registre().some(x => x.type === "vote" && x.elus.length === 1), "au Registre, avec son condamné");
  } else assert.ok(r.elus.length >= 1, "un condamné dans tous les cas (pas de jour sans verdict)");
  await api.eliminer(r.elu, { cause: "vote" });
  assert.equal(game.actors.get(r.elu).system.vivant, false);
  // Le glas final (jour 3 à 4 places) finit la veillée au soir du jour 3, si personne n'a gagné avant.
  for (let jour = 2; jour <= 3 && !api.etat().vainqueur; jour++) { await api.changerPhase("nuit"); await api.changerPhase("jour"); }
  if (!api.etat().vainqueur) { await api.changerPhase("nuit"); assert.ok(api.etat().vainqueur, "le glas a sonné"); }
});

// ------------------------------------------------------------------ mutations : chaque règle cassée est attrapée
const MUTATIONS = [
  ["scripts/api.mjs", `: niveauPrecedent === L.NIVEAU_PETITE_TABLEE && !tableeVoulueParReglage ? "classique" : niveauPrecedent;`, `: niveauPrecedent;`, "réglage décoché ignoré au Rejouer"],
  ["logique/tablee.mjs", `if (humains.length >= 2 && humains.every(p => camp(p) === "meute")) manques.push("humains-tous-loups");`, "", "deux humains loups"],
  ["logique/tablee.mjs", `if (!humains.some(p => estOmbre(camp(p)))) manques.push("ombre-sans-humain");`, "", "l'ombre favorisée n'est plus appliquée chez les humains"],
  ["logique/tablee.mjs", `if (regles?.lanterne && infos && humainsDuVillage.length && !humainsDuVillage.some(p => p.role?.information)) manques.push("lanterne-sans-humain");`, "", "la lanterne favorisée n'est plus appliquée"],
  ["logique/tablee.mjs", `if (humains.length >= 3 && (humains.every(p => camp(p) === "village") || humains.every(p => estOmbre(camp(p))))) manques.push("humains-meme-camp");`, "", "trois humains du même camp"],
  ["logique/tablee.mjs", `    if (!manques.length) break;`, `    break;`, "le tirage ne rebat pas"],
  ["logique/tablee.mjs", `export const nombreDeLoupsTablee = n => (n <= 7 ? 1 : n <= 10 ? 2 : 3);`, `export const nombreDeLoupsTablee = n => (n <= 8 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5);`, "le barème ordinaire des loups"],
  ["logique/victoire.mjs", `  if (meute > 0 && (strict ? meute > vivants.length - meute : meute >= vivants.length - meute)) return "meute";`, `  if (meute > 0 && meute >= vivants.length - meute) return "meute";`, "la meute gagne à égalité"],
  ["scripts/api.mjs", `peste: e.peste, saintMartin, strict: pariteStricte(e) });`, `peste: e.peste, saintMartin });`, "l'API oublie la parité stricte"],
  ["logique/jour.mjs", `  if (chasse && roleCle !== CLE_PESTE && etat.petiteTablee && n === 1 && nuitBlancheTablee(etat.places || villageois.length)) return [];`, ``, "la première nuit n'est plus blanche"],
  ["logique/tablee.mjs", `export const glasTablee = n => Math.max(3, Math.ceil((Number(n) || 0) / 2));`, `export const glasTablee = () => 0;`, "pas de glas d'office"],
  ["logique/etat.mjs", `  if (etat.petiteTablee && v.objet === "execution" && !v.banc && !resultat.departage && r.departage) {`, `  if (false) {`, "l'égalité n'est plus tranchée par le sort"],
  ["logique/bailli.mjs", `  const sort = etat.petiteTablee && etat.phase !== "nuit" && admis.length < d.places`, `  const sort = false`, "le Bailli qui passe ne laisse plus le sort trancher"],
  ["scripts/api.mjs", `      e.petiteTablee = enTablee;`, `      e.petiteTablee = false;`, "le mode n'est plus public"],
  ["scripts/api.mjs", `    if (enTablee && !glas) glas = L.glasTablee(places.length);`, ``, "le glas n'est plus posé"],
  ["scripts/api.mjs", `    const tirage = enTablee ? (await tirageDeTablee({ roles, metiers, places, maisons: lesMaisons, graine, cache, peste, humains: joueurs })).tirage
      : L.distribuer({ roles, metiers, joueurs: places, maisons: lesMaisons, graine });`, `    const tirage = L.distribuer({ roles, metiers, joueurs: places, maisons: lesMaisons, graine });`, "tirage libre"],
  ["scripts/api.mjs", `    if (tableeVoulue !== undefined && tableeVoulue !== Boolean(lireReglage("petiteTablee", false))) await game.settings.set(ID, "petiteTablee", tableeVoulue);`, ``, "le réglage ne se souvient plus"],
  ["scripts/api.mjs", `      : tableeVoulueParReglage && total <= L.TABLEE.placesMax ? L.NIVEAU_PETITE_TABLEE`,
    `      : false ? L.NIVEAU_PETITE_TABLEE`, "« Rejouer » oublie le mode"],
  ["scripts/api.mjs", `    lireReglage("petiteTablee", false) && n <= L.TABLEE.placesMax && !options?.peste ? { ...options, niveau: L.NIVEAU_PETITE_TABLEE } : options) },`,
    `    options) },`, "api.logique.composer ignore le réglage"],
  ["scripts/api.mjs", `      const morceaux = [t("LAKOUR_LOUPS.Tablee.AnnonceTete", { humains: h, compagnons: nomsCompagnons.length }),`,
    `      const morceaux = [t("LAKOUR_LOUPS.Tablee.AnnonceTete", { humains: h, compagnons: nomsCompagnons.length }) + " " + sortie.filter(s => !s.compagnon && campDe(game.actors.get(s.acteurId)) !== "village").map(s => game.actors.get(s.acteurId).name).join(", "),`,
    "l'annonce nomme les humains de l'ombre"],
  ["scripts/api.mjs", `    const tableeVoulue = court ? undefined : tablee ?? (await compositionDeTablee(composition) ? true : undefined);`,
    `    const tableeVoulue = court ? false : tablee ?? (await compositionDeTablee(composition) ? true : undefined);`, "une Saint-Martin efface le réglage"],
  ["scripts/api.mjs", `      e.places = sortie.length;`, `      e.places = 0;`, "le nombre de places n'est plus dans l'état"],
  ["logique/jour.mjs", `nuitBlancheTablee(etat.places || villageois.length)) return [];`, `nuitBlancheTablee(villageois.length)) return [];`, "la nuit blanche compte les figurants"],
  ["logique/tablee.mjs", `  if (regles?.ombre && humains.length >= 3 && ombres >= 2 && compagnons.length) {`, `  if (humains.length >= 2 && ombres >= 2 && compagnons.length) {`, "l'ombre des deux côtés garantie, dès deux humains"],
  ["logique/tablee.mjs", `  const lanterne = humains >= 1 && hasard() < CHANCE_LANTERNE;`, `  const lanterne = humains >= 1;`, "la lanterne garantie chez un humain"],
  ["logique/tablee.mjs", `  const ombre = humains >= 3 && hasard() < CHANCE_OMBRE;`, `  const ombre = humains >= 3;`, "l'ombre des deux côtés garantie à trois humains"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-tablee-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

// La batterie : sur le vrai code, elle passe ; sur chaque mutant, une vérification au moins échoue.
async function batterie() {
  const echecs = [];
  const verifier = async (nom, fn) => { try { await fn(); } catch (e) { echecs.push(`${nom} : ${e.message}`); } };
  await verifier("barème", () => { assert.equal(L.nombreDeLoupsTablee(6), 1); assert.equal(L.nombreDeLoupsTablee(7), 1); assert.equal(L.nombreDeLoupsTablee(8), 2); assert.equal(L.glasTablee(7), 4); });
  await verifier("parité stricte", () => {
    const v = (id, camp) => ({ id, vivant: true, camp, amoureux: "", role: { cle: camp === "meute" ? "loup-de-brumecombe" : "villageois" } });
    assert.equal(L.verifierVictoire({ villageois: [v("a", "meute"), v("b", "meute"), v("c", "village"), v("d", "village")], strict: true }), "");
  });
  await verifier("nuit blanche", () => {
    const v = Array.from({ length: 9 }, (_, i) => ({ id: `v${i}`, vivant: true, camp: i < 2 ? "meute" : "village", maison: `Maison ${i + 1}`, role: { cle: i < 2 ? "loup-de-brumecombe" : "villageois", effet: i < 2 ? "tuer" : "" } }));
    const e = { ...L.etatInitial(), partie: "p", phase: "nuit", tour: 1, petiteTablee: true };
    assert.deepEqual(L.candidatsDeNuit({ villageois: v, etat: e, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 1 }), [], "nuit blanche à 9 places");
    assert.equal(L.candidatsDeNuit({ villageois: v, etat: e, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 2 }).length, 7, "la deuxième nuit, la meute chasse");
    assert.ok(L.candidatsDeNuit({ villageois: v.slice(0, 7), etat: e, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 1 }).length > 0, "à 7 places (un loup), pas de nuit blanche");
    assert.deepEqual(L.candidatsDeNuit({ villageois: v.slice(0, 8), etat: e, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 1 }), [], "à 8 places (deux loups), nuit blanche");
    assert.ok(L.candidatsDeNuit({ villageois: v, etat: { ...e, petiteTablee: false }, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 1 }).length > 0, "hors petite tablée, la meute chasse");
    // Les places distribuées comptent (etat.places), pas les figurants ni les arrivants : 7 places et deux figurants, un seul loup, la meute chasse.
    assert.ok(L.candidatsDeNuit({ villageois: v, etat: { ...e, places: 7 }, acteurId: "v0", roleCle: L.CLE_MEUTE, tour: 1 }).length > 0, "les figurants ne font pas une nuit blanche");
  });
  await verifier("contraintes", () => {
    const p = (humain, camp, information = false) => ({ humain, role: { camp, information } });
    assert.ok(L.contraintesTablee([p(true, "meute"), p(true, "meute"), p(false, "village"), p(false, "village")]).includes("humains-tous-loups"));
    assert.ok(L.contraintesTablee([p(true, "village"), p(true, "village"), p(true, "village"), p(false, "meute"), p(false, "solitaire")]).includes("humains-meme-camp"));
    const TOUT = { ombre: true, lanterne: true };
    assert.ok(L.contraintesTablee([p(true, "village", true), p(true, "village"), p(true, "village"), p(false, "meute"), p(false, "solitaire")], TOUT).includes("ombre-sans-humain"));
    assert.ok(L.contraintesTablee([p(true, "meute"), p(true, "solitaire"), p(true, "village"), p(false, "village", true), p(false, "village")], TOUT).includes("ombre-sans-compagnon"));
    assert.ok(L.contraintesTablee([p(true, "meute"), p(true, "village"), p(false, "village", true), p(false, "solitaire")], TOUT).includes("lanterne-sans-humain"));
    // Jamais l'ombre des deux côtés à deux humains ; sans règle tirée, ni ombre ni lanterne.
    assert.deepEqual(L.contraintesTablee([p(true, "village", true), p(true, "village"), p(false, "meute"), p(false, "solitaire")], TOUT), []);
    assert.deepEqual(L.contraintesTablee([p(true, "village"), p(true, "village"), p(true, "meute"), p(false, "meute"), p(false, "village", true)]), []);
  });
  await verifier("favorisé, pas garanti", () => {
    const roles = ["loup-de-brumecombe", "liseuse-de-cendres", "garde-du-pont", "colporteur", "herboriste", "sonneur"];
    const j = ["u0", "u1", "c0", "c1", "c2", "c3"], hum = new Set(["u0", "u1"]);
    const rs = Array.from({ length: 200 }, (_, i) => L.distribuerTablee({ roles, joueurs: j, humains: hum, decrire, graine: `f${i}` }));
    const vue = r => r.tirage.map(x => ({ humain: x.joueur.startsWith("u"), ...decrire(x.role) }));
    assert.ok(rs.some(r => vue(r).filter(p => p.humain).every(p => p.camp === "village")), "deux humains du Village : possible");
    assert.ok(rs.some(r => { const v = vue(r); return v.some(p => p.humain && p.camp === "village") && !v.some(p => p.humain && p.camp === "village" && p.information); }), "la lanterne chez un compagnon : possible");
    const j3 = ["u0", "u1", "u2", "c0", "c1", "c2"], hum3 = new Set(["u0", "u1", "u2"]);
    const rs3 = Array.from({ length: 200 }, (_, i) => L.distribuerTablee({ roles, joueurs: j3, humains: hum3, decrire, graine: `g${i}` }));
    assert.ok(rs3.some(r => { const v = vue(r); return !v.some(p => p.humain && L.estOmbre(p.camp)) || !v.some(p => !p.humain && L.estOmbre(p.camp)); }), "à trois humains, l'ombre d'un seul côté : possible");
    assert.ok(rs3.every(r => !vue(r).filter(p => p.humain).every(p => p.camp === "village")), "à trois humains, jamais tous du Village");
  });
  await verifier("tirage", () => {
    const roles = ["loup-de-brumecombe", "liseuse-de-cendres", "garde-du-pont", "colporteur", "herboriste", "sonneur", "villageois"];
    const joueurs = ["u1", "u2", "u3", "c0", "c1", "c2", "c3"];
    for (let g = 0; g < 40; g++) {
      const r = L.distribuerTablee({ roles, joueurs, humains: new Set(["u1", "u2", "u3"]), decrire, graine: `b${g}` });
      assert.deepEqual(L.contraintesTablee(r.tirage.map(x => ({ humain: x.joueur.startsWith("u"), role: decrire(x.role) })), r.regles), []);
    }
  });
  await verifier("sort", () => {
    let e = L.ouvrirVote({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, petiteTablee: true, bailli: L.bailliInitial(false) }, { candidats: ["a", "b", "c", "d"] });
    for (const [votant, cible] of [["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"]]) ({ etat: e } = L.enregistrerVote(e, { votant, cible }));
    assert.equal(L.cloreVote(e, { votants: ["a", "b", "c", "d"] }).resultat.elus.length, 1);
    let b = L.ouvrirVote({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, petiteTablee: true, bailli: { ...L.bailliInitial(true), acteurId: "a", depuis: 1 } }, { candidats: ["a", "b", "c", "d"] });
    for (const [votant, cible] of [["a", "c"], ["b", "c"], ["c", "d"], ["d", "d"], ["e", "d"]]) ({ etat: b } = L.enregistrerVote(b, { votant, cible }));
    const r = L.cloreVote(b, { votants: ["a", "b", "c", "d", "e"] });
    assert.equal(L.trancherVote(r.etat, [], { vivants: ["a", "b", "c", "d", "e"] }).vote.resultat.elus.length, 1);
  });
  await verifier("api", async () => {
    const { humains, ia } = monde({ joueurs: 3, compagnons: 4 });
    const ids = await creerCompagnons(ia);
    await api.nouvellePartie({ memesJoueurs: false, joueurs: humains, compagnons: ids, graine: "batterie", niveau: "petite-tablee" });
    await calme();
    assert.equal(api.etat().petiteTablee, true);
    assert.equal(reglages.get("lakour-loups.partie").valeur.petiteTablee, true);
    assert.equal(api.etat().glas, 4);
    assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true);
    assert.equal(api.etat().places, 7, "les places distribuées, dans l'état public");
    assert.equal(reglages.get("lakour-loups.partie").valeur.places, 7);
    assert.deepEqual(L.contraintesTablee(placesDe()), []);
    const annonce = annoncesChat().find(t => t.includes(FR.LAKOUR_LOUPS.Tablee.Nom));
    assert.ok(annonce.includes(FR.LAKOUR_LOUPS.Tablee.RegleCamps) && annonce.includes(FR.LAKOUR_LOUPS.Tablee.RegleTirageOmbre), "à trois humains, l'annonce dit les trois règles");

    for (const a of villageois()) assert.ok(!annonce.includes(a.name), "l'annonce nomme quelqu'un");
    const c = await api.contenu();
    assert.equal(api.logique.composer(8, c.equilibre, { niveau: "classique", graine: "b" }).niveau, "petite-tablee");
    // Après une partie classique, le réglage coché suffit à « Rejouer » pour refaire une petite tablée.
    await api.nouvellePartie({ memesJoueurs: true, graine: "classique", niveau: "classique" });
    await calme();
    await game.settings.set("lakour-loups", "petiteTablee", true);
    const encore = await api.nouvellePartie({ memesJoueurs: true, graine: "encore" });
    await calme();
    assert.equal(encore.composition.niveau, "petite-tablee");
    // Le réglage décoché prime sur le niveau de la partie précédente : « Rejouer » retombe sur le classique, sans recocher.
    await game.settings.set("lakour-loups", "petiteTablee", false);
    const decochee = await api.nouvellePartie({ memesJoueurs: true, graine: "décochée" });
    await calme();
    assert.equal(decochee.composition.niveau, "classique", "réglage décoché : plus de petite tablée au Rejouer");
    assert.equal(game.settings.get("lakour-loups", "petiteTablee"), false, "le réglage n'est pas recoché");
    // Au régime des deux loups (8 places) : deux loups contre deux autres, la veillée continue (parité stricte), par l'API.
    const grande = monde({ joueurs: 3, compagnons: 5 });
    await api.nouvellePartie({ memesJoueurs: false, joueurs: grande.humains, compagnons: await creerCompagnons(grande.ia), graine: "parité", niveau: "petite-tablee" });
    await calme();
    const loups = villageois().filter(a => campDe(a) === "meute"), autres = villageois().filter(a => campDe(a) !== "meute");
    assert.equal(loups.length, 2);
    for (const a of autres.slice(2)) await api.eliminer(a.id, { cause: "narrateur", reveler: false });
    assert.equal(villageois().filter(a => a.system.vivant).length, 4);
    assert.equal(await api.verifierVictoire(), "", "deux loups contre deux : rien");
    await api.eliminer(autres[1].id, { cause: "narrateur", reveler: false });
    assert.equal(await api.verifierVictoire(), "meute", "deux contre un : la meute");
    // À un seul loup (7 places), la règle ordinaire : un contre un, la meute.
    const petite = monde({ joueurs: 3, compagnons: 4 });
    await api.nouvellePartie({ memesJoueurs: false, joueurs: petite.humains, compagnons: await creerCompagnons(petite.ia), graine: "parité-1", niveau: "petite-tablee" });
    await calme();
    const loup = villageois().find(a => campDe(a) === "meute"), reste = villageois().filter(a => campDe(a) !== "meute");
    for (const a of reste.slice(1)) await api.eliminer(a.id, { cause: "narrateur", reveler: false });
    assert.ok(loup.system.vivant && villageois().filter(a => a.system.vivant).length === 2);
    assert.equal(await api.verifierVictoire(), "meute", "un loup contre un : la meute, comme d'habitude");
    // Une Nuit de la Saint-Martin ne touche pas au réglage.
    await api.nouvellePartie({ memesJoueurs: true, graine: "sm-b", format: "saint-martin" });
    await calme();
    assert.equal(game.settings.get("lakour-loups", "petiteTablee"), true, "la Saint-Martin laisse le réglage");
    await api.nouvellePartie({ memesJoueurs: true, graine: "apres-sm-b", format: "" });
    await calme();
    // Plusieurs graines : le tirage contraint tient à chaque fois.
    for (const graine of ["b1", "b2", "b3", "b4", "b5", "b6"]) {
      await api.nouvellePartie({ memesJoueurs: true, graine, niveau: "petite-tablee" });
      await calme();
      assert.deepEqual(L.contraintesTablee(placesDe()), [], graine);
    }
  });
  return echecs;
}

test("mutations : la batterie passe sur le vrai système et attrape chaque règle cassée", async () => {
  await charger();
  assert.deepEqual(await batterie(), []);
  const passees = [];
  const avertir = console.warn;
  console.warn = () => {};
  try {
    for (const [fichier, avant, apres, regle] of MUTATIONS) {
      await chargerMutant(fichier, avant, apres);
      let echecs;
      try { echecs = await batterie(); } catch (e) { echecs = [e.message]; }
      if (!echecs.length) passees.push(`${regle} (${fichier})`);
    }
  } finally { console.warn = avertir; await charger(); }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
