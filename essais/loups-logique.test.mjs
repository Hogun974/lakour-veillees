// Logique pure du système lakour-loups (« Les Veillées de Brumecombe ») : votes, ordre de nuit, résolution,
// victoire, distribution, état de partie.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../systems/lakour-loups/logique/index.mjs";

// Petit catalogue de rôles d'essai (les vrais viennent du module lakour-veillees).
const R = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } },
  affame: { cle: "loup-affame", nom: "Loup affamé", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 45, uneNuitSurDeux: true } },
  louve: { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41 }, usages: { max: 1, restant: 1 } },
  hurleur: { cle: "loup-hurleur", nom: "Loup hurleur", camp: "meute", effet: "silence", nuit: { actif: true, ordre: 42 } },
  deguise: { cle: "loup-deguise", nom: "Loup déguisé", camp: "meute", effet: "", nuit: { actif: true, ordre: 40 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false } },
  veilleuse: { cle: "veilleuse-de-lanterne", nom: "Veilleuse", camp: "village", effet: "eclairer", nuit: { actif: true, ordre: 30 } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 35 } },
  herboriste: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 60 }, usages: { max: 2, restant: 2 } },
  garde: { cle: "garde-du-pont", nom: "Garde", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20 } },
  sonneur: { cle: "sonneur", nom: "Sonneur", camp: "village", effet: "vote-double", nuit: { actif: true, ordre: 70 }, usages: { max: 1, restant: 1 } },
  fossoyeur: { cle: "fossoyeur", nom: "Fossoyeur", camp: "village", effet: "voir-role-mort", nuit: { actif: true, ordre: 75 } },
  braconniere: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: { actif: false } },
  entremetteuse: { cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour", nuit: { actif: true, ordre: 10, premiereNuitSeulement: true, cibles: 2 } },
  colporteur: { cle: "colporteur", nom: "Colporteur", camp: "solitaire", effet: "echanger-role", nuit: { actif: true, ordre: 15 }, usages: { max: 1, restant: 1 } },
  revenant: { cle: "revenant", nom: "Revenant", camp: "solitaire", effet: "", nuit: { actif: false } },
  chasseur: { cle: "chasseur-de-primes", nom: "Chasseur de primes", camp: "solitaire", effet: "", nuit: { actif: false } },
  pyromane: { cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", nuit: { actif: true, ordre: 80 } },
  enfant: { cle: "enfant-de-la-brume", nom: "Enfant", camp: "village", effet: "epier", nuit: { actif: true, ordre: 41 } },
  ermite: { cle: "ermite", nom: "Ermite", camp: "village", effet: "voir-actif", nuit: { actif: true, ordre: 90 } },
  messager: { cle: "messager", nom: "Messager", camp: "village", effet: "messager", nuit: { actif: true, ordre: 50 } }
};
const v = (id, role, extra = {}) => ({ id, nom: id, vivant: true, camp: R[role].camp, maison: `Maison ${id}`, amoureux: "", silence: false, protections: 0, role: structuredClone(R[role]), ...extra });

// ---------------------------------------------------------------- hasard
test("hasard : même graine, même suite ; graines différentes, suites différentes", () => {
  const a = L.creerHasard("brume"), b = L.creerHasard("brume"), c = L.creerHasard("lune");
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every(x => x >= 0 && x < 1));
  assert.equal(L.creerHasard(), Math.random);
});

test("mélange : permutation complète, sans toucher à l'original", () => {
  const t = [1, 2, 3, 4, 5, 6, 7, 8];
  const m = L.melanger(t, L.creerHasard(7));
  assert.deepEqual(t, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...m].sort((a, b) => a - b), t);
  assert.notDeepEqual(m, t);
});

// ---------------------------------------------------------------- votes
test("votes : majorité simple", () => {
  const r = L.decompterVotes({ votes: { a: "x", b: "x", c: "y" } });
  assert.deepEqual(r.decompte, { x: 2, y: 1 });
  assert.equal(r.elu, "x");
});

test("votes : égalité en tête -> personne", () => {
  const r = L.decompterVotes({ votes: { a: "x", b: "y" } });
  assert.equal(r.elu, null);
  assert.equal(r.egalite, true);
  assert.deepEqual(r.elus, []);
});

test("votes : abstention, votant non admis, cible hors candidats ne comptent pas", () => {
  const r = L.decompterVotes({ votes: { a: "x", b: "", mort: "y", c: "z", d: "y" }, votants: ["a", "b", "c", "d"], candidats: ["x", "y"] });
  assert.deepEqual(r.decompte, { x: 1, y: 1 });
  assert.equal(r.elu, null);
  assert.deepEqual(Object.keys(r.votes).sort(), ["a", "d"]);
});

test("votes : aucun vote -> personne", () => {
  assert.equal(L.decompterVotes({ votes: {} }).elu, null);
});

test("votes : vote double -> deux désignés ; égalité qui déborde -> place vide", () => {
  const r = L.decompterVotes({ votes: { a: "x", b: "x", c: "x", d: "y", e: "y", f: "z" }, double: true });
  assert.deepEqual(r.elus, ["x", "y"]);
  assert.equal(r.elu, "x");
  const r2 = L.decompterVotes({ votes: { a: "x", b: "x", c: "y", d: "z" }, double: true });
  assert.deepEqual(r2.elus, ["x"], "égalité pour la 2e place : personne");
  const r3 = L.decompterVotes({ votes: { a: "x", b: "y", c: "z" }, double: true });
  assert.deepEqual(r3.elus, []);
  const r4 = L.decompterVotes({ votes: { a: "x", b: "y" }, double: true });
  assert.deepEqual(r4.elus, ["x", "y"], "deux à égalité en tête : les deux places sont prises");
  assert.equal(L.decompterVotes({ votes: { a: "x", b: "x", c: "y" } }).elus.length, 1, "sans vote double : un seul");
});

test("votes : poids d'une voix (voix double)", () => {
  const r = L.decompterVotes({ votes: { maire: "x", b: "y" }, poids: { maire: 2 } });
  assert.equal(r.decompte.x, 2);
  assert.equal(r.elu, "x");
});

test("votes : majorité absolue (le Gibet)", () => {
  const votants = ["a", "b", "c", "d", "e"];
  assert.equal(L.decompterVotes({ votes: { a: "x", b: "x", c: "y" }, votants, majoriteAbsolue: true }).elu, null);
  assert.equal(L.decompterVotes({ votes: { a: "x", b: "x", c: "x" }, votants, majoriteAbsolue: true }).elu, "x");
});

test("meute : majorité, égalité -> premier choisi dans le temps", () => {
  assert.equal(L.majoriteMeute([{ votant: "l1", cible: "a", quand: 1 }, { votant: "l2", cible: "b", quand: 2 }, { votant: "l3", cible: "b", quand: 3 }]), "b");
  assert.equal(L.majoriteMeute([{ votant: "l1", cible: "a", quand: 5 }, { votant: "l2", cible: "b", quand: 2 }]), "b");
  assert.equal(L.majoriteMeute([{ votant: "l1", cible: "", quand: 1 }]), null);
  assert.equal(L.majoriteMeute([]), null);
});

// ---------------------------------------------------------------- ordre de nuit
test("ordre de nuit : meute groupée à 40, ordre croissant, morts exclus", () => {
  const vs = [v("l1", "loup"), v("l2", "loup"), v("g", "garde"), v("vl", "veilleuse"), v("h", "herboriste"), v("x", "villageois"), v("mort", "liseuse", { vivant: false })];
  const o = L.ordreDeNuit(vs, 2);
  assert.deepEqual(o.map(e => e.roleCle), ["garde-du-pont", "veilleuse-de-lanterne", "meute", "herboriste"]);
  assert.deepEqual(o.find(e => e.roleCle === "meute").acteurIds, ["l1", "l2"]);
  assert.equal(o.find(e => e.roleCle === "meute").ordre, 40);
});

test("ordre de nuit : mordus dans la meute, loups spéciaux réveillés en plus", () => {
  const vs = [v("l1", "loup"), v("hur", "hurleur"), v("mordu", "liseuse", { camp: "meute" })];
  const o = L.ordreDeNuit(vs, 1);
  assert.deepEqual(o.find(e => e.roleCle === "meute").acteurIds, ["l1", "hur", "mordu"]);
  assert.ok(o.some(e => e.roleCle === "loup-hurleur"));
  assert.ok(o.some(e => e.roleCle === "liseuse-de-cendres"), "le mordu garde son pouvoir");
});

test("ordre de nuit : premiereNuitSeulement et uneNuitSurDeux (nuits paires)", () => {
  const vs = [v("e", "entremetteuse"), v("a", "affame"), v("l", "loup")];
  const cles = t => L.ordreDeNuit(vs, t).map(e => e.roleCle);
  assert.ok(cles(1).includes("entremetteuse"));
  assert.ok(!cles(2).includes("entremetteuse"));
  assert.ok(!cles(1).includes("loup-affame"));
  assert.ok(cles(2).includes("loup-affame"));
  assert.ok(!cles(3).includes("loup-affame"));
  assert.ok(cles(4).includes("loup-affame"));
});

test("ordre de nuit : usages épuisés, rôles inactifs", () => {
  const s = v("s", "sonneur");
  assert.ok(L.ordreDeNuit([s], 1).some(e => e.roleCle === "sonneur"));
  s.role.usages.restant = 0;
  assert.ok(!L.ordreDeNuit([s], 1).some(e => e.roleCle === "sonneur"));
  assert.deepEqual(L.ordreDeNuit([v("b", "braconniere"), v("x", "villageois")], 1), []);
  const illimite = v("g", "garde", {}); illimite.role.usages = { max: 0, restant: 0 };
  assert.equal(L.ordreDeNuit([illimite], 1).length, 1, "max 0 = illimité");
});

test("ordre de nuit : un rôle à plusieurs exemplaires est réveillé ensemble", () => {
  const o = L.ordreDeNuit([v("g1", "garde"), v("g2", "garde")], 1);
  assert.deepEqual(o, [{ roleCle: "garde-du-pont", acteurIds: ["g1", "g2"], ordre: 20, invite: "", cibles: 1, soiMeme: false }]);
});

// ---------------------------------------------------------------- résolution
const village = () => [v("l1", "loup"), v("l2", "loup"), v("g", "garde"), v("vl", "veilleuse"), v("h", "herboriste"), v("li", "liseuse"), v("x", "villageois"), v("y", "villageois")];

test("nuit : la meute tue sa victime", () => {
  const r = L.resoudreNuit({ villageois: village(), actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }] });
  assert.deepEqual(r.morts, ["x"]);
  assert.deepEqual(r.deces, [{ acteurId: "x", cause: "meute" }]);
});

test("nuit : protection du garde sauve ; jamais deux nuits de suite la même cible", () => {
  const actions = [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, { acteurId: "l1", roleCle: "meute", cibles: ["x"] }];
  assert.deepEqual(L.resoudreNuit({ villageois: village(), actions }).morts, []);
  const r = L.resoudreNuit({ villageois: village(), actions, precedentes: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }] });
  assert.deepEqual(r.morts, ["x"]);
  assert.ok(r.messages.some(m => m.destinataire === "g" && /deux nuits/.test(m.texte)));
});

test("nuit : protections posées par l'API (champ protections) sauvent aussi", () => {
  const vs = village(); vs.find(x => x.id === "x").protections = 1;
  assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }] }).morts, []);
});

test("nuit : remède sauve, poison tue même un protégé", () => {
  const r = L.resoudreNuit({ villageois: village(), actions: [
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] },
    { acteurId: "h", roleCle: "herboriste", cibles: ["x"] }] });
  assert.deepEqual(r.morts, []);
  assert.deepEqual(r.sauves, [{ acteurId: "x", par: "remede" }]);
  const r2 = L.resoudreNuit({ villageois: village(), actions: [
    { acteurId: "g", roleCle: "garde-du-pont", cibles: ["y"] },
    { acteurId: "h", roleCle: "herboriste", cibles: ["y"], effet: "poison" }] });
  assert.deepEqual(r2.deces, [{ acteurId: "y", cause: "poison" }]);
});

test("nuit : éclairer démasque le loup qui entre, et seulement lui", () => {
  const r = L.resoudreNuit({ villageois: village(), actions: [
    { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] },
    { acteurId: "l2", roleCle: "meute", cibles: ["x"] }] });
  assert.deepEqual(r.revelations, [{ acteurId: "l2", type: "eclairer", public: true, maison: "Maison x" }]);
  assert.ok(r.messages.some(m => m.destinataire === "vl" && /l2/.test(m.texte)));
  const r2 = L.resoudreNuit({ villageois: village(), actions: [
    { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["y"] },
    { acteurId: "l2", roleCle: "meute", cibles: ["x"] }] });
  assert.deepEqual(r2.revelations, []);
  assert.ok(r2.messages.some(m => m.destinataire === "vl" && m.cle.endsWith("EclairerNon")));
});

test("nuit : éclairer vaut pour toute la maison (deux dormeurs à la Taverne)", () => {
  const vs = village(); vs.find(x => x.id === "x").maison = "Taverne"; vs.find(x => x.id === "y").maison = "Taverne";
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["y"] },
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] }] });
  assert.equal(r.revelations[0]?.acteurId, "l1");
});

test("nuit : voir-camp, et le loup déguisé paraît villageois", () => {
  const vs = [...village(), v("d", "deguise")];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["l1"] }] });
  assert.equal(r.messages.find(m => m.destinataire === "li").donnees.camp, "meute");
  const r2 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["d"] }] });
  assert.equal(r2.messages.find(m => m.destinataire === "li").donnees.camp, "village");
  assert.equal(L.apparenceDe({ camp: "meute", role: { cle: "x", apparence: "village" } }), "village");
});

test("nuit : mordre au lieu de tuer -> la victime rejoint la meute", () => {
  const vs = [...village(), v("lm", "louve")];
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] },
    { acteurId: "lm", roleCle: "louve-mere", cibles: ["x"] }] });
  assert.deepEqual(r.morts, []);
  assert.deepEqual(r.changements, [{ type: "camp", acteurId: "x", camp: "meute" }]);
  assert.ok(r.messages.some(m => m.destinataire === "x" && m.cle.endsWith("Mordu")));
  const apres = L.appliquerResolution(vs, r);
  assert.equal(apres.find(x => x.id === "x").camp, "meute");
  const passe = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "lm", roleCle: "louve-mere", cibles: [] }] });
  assert.deepEqual(passe.morts, ["x"], "la Louve qui passe ne mord pas");
});

test("nuit : une morsure sur un protégé échoue", () => {
  const vs = [...village(), v("lm", "louve")];
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] },
    { acteurId: "lm", roleCle: "louve-mere", cibles: ["x"] }] });
  assert.deepEqual(r.changements, []);
});

test("nuit : lien d'amour, puis chagrin en cascade", () => {
  const vs = [...village(), v("e", "entremetteuse")];
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "e", roleCle: "entremetteuse", cibles: ["x", "l2"] },
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] }] });
  assert.deepEqual(r.deces, [{ acteurId: "x", cause: "meute" }, { acteurId: "l2", cause: "chagrin" }]);
  assert.deepEqual(r.changements[0], { type: "amour", a: "x", b: "l2" });
});

test("nuit : cascade d'amour hors nuit", () => {
  const vs = [v("a", "villageois", { amoureux: "b" }), v("b", "villageois", { amoureux: "a" }), v("c", "villageois")];
  assert.deepEqual(L.cascadeAmour(vs, "a"), ["a", "b"]);
  assert.deepEqual(L.cascadeAmour(vs, "c"), ["c"]);
});

test("nuit : la braconnière morte emporte quelqu'un (choix demandé au narrateur)", () => {
  const vs = [...village(), v("b", "braconniere")];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["b"] }] });
  assert.deepEqual(r.enAttente, [{ acteurId: "b", effet: "emporter" }]);
});

test("nuit : pyromane asperge d'une nuit à l'autre, puis embrase", () => {
  const vs = [...village(), v("p", "pyromane")];
  const n1 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "p", roleCle: "pyromane", cibles: ["x"] }] });
  assert.deepEqual(n1.asperges, ["x"]);
  assert.deepEqual(n1.morts, []);
  const n2 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "p", roleCle: "pyromane", cibles: ["y"] }], asperges: n1.asperges });
  assert.deepEqual(n2.asperges.sort(), ["x", "y"]);
  const n3 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "p", roleCle: "pyromane", cibles: [], effet: "embraser" }], asperges: n2.asperges });
  assert.deepEqual(n3.deces.map(d => d.cause), ["feu", "feu"]);
  assert.deepEqual(n3.morts.sort(), ["x", "y"]);
  assert.deepEqual(n3.asperges, []);
});

test("nuit : silence, échange de rôle, cloche", () => {
  const vs = [...village(), v("hu", "hurleur"), v("c", "colporteur"), v("s", "sonneur")];
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "hu", roleCle: "loup-hurleur", cibles: ["x"] },
    { acteurId: "c", roleCle: "colporteur", cibles: ["vl"] },
    { acteurId: "s", roleCle: "sonneur", cibles: [], effet: "vote-double" }] });
  assert.ok(r.changements.some(c => c.type === "silence" && c.acteurId === "x"));
  assert.ok(r.changements.some(c => c.type === "echange" && c.a === "c" && c.b === "vl"));
  assert.equal(r.voteDouble, true);
  const apres = L.appliquerResolution(vs, r);
  assert.equal(apres.find(x => x.id === "c").role.cle, "veilleuse-de-lanterne");
  assert.equal(apres.find(x => x.id === "c").camp, "village");
  assert.equal(apres.find(x => x.id === "vl").camp, "solitaire");
  assert.equal(apres.find(x => x.id === "x").silence, true);
});

test("nuit : fossoyeur lit le rôle d'un mort, pas d'un vivant", () => {
  const vs = [...village(), v("f", "fossoyeur"), v("m", "veilleuse", { vivant: false })];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "f", roleCle: "fossoyeur", cibles: ["m"] }] });
  assert.equal(r.messages[0].donnees.role, "Veilleuse");
  const r2 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "f", roleCle: "fossoyeur", cibles: ["x"] }] });
  assert.ok(r2.messages[0].cle.endsWith("PasMort"));
});

test("nuit : épier — repéré, l'enfant devient la victime ; sinon il reconnaît un loup", () => {
  const vs = [...village(), v("en", "enfant")];
  const actions = [{ acteurId: "en", roleCle: "enfant-de-la-brume", cibles: ["en"] }, { acteurId: "l1", roleCle: "meute", cibles: ["x"] }];
  const repere = L.resoudreNuit({ villageois: vs, actions, hasard: () => 0, chanceEpier: 0.5 });
  assert.deepEqual(repere.morts, ["en"]);
  const cache = L.resoudreNuit({ villageois: vs, actions, hasard: () => 0.9, chanceEpier: 0.5 });
  assert.deepEqual(cache.morts, ["x"]);
  assert.equal(cache.messages.find(m => m.destinataire === "en").donnees.nom, "x", "il entend la proie, pas le nom des loups");
  const passe = L.resoudreNuit({ villageois: vs, actions: [{ ...actions[0], cibles: [] }, actions[1]], hasard: () => 0, chanceEpier: 1 });
  assert.deepEqual(passe.morts, ["x"], "l'enfant qui passe ne risque rien");
});

test("nuit : l'ermite voit qui est sorti", () => {
  const vs = [...village(), v("er", "ermite")];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "er", roleCle: "ermite", cibles: ["g"] }, { acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }] });
  assert.ok(r.messages.find(m => m.destinataire === "er").cle.endsWith("ActifOui"));
  const r2 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "er", roleCle: "ermite", cibles: ["y"] }] });
  assert.ok(r2.messages.find(m => m.destinataire === "er").cle.endsWith("ActifNon"));
});

test("nuit : actions des morts ignorées ; le Messager sans mot écrit ne porte rien", () => {
  const vs = [...village(), v("me", "messager")];
  vs.find(x => x.id === "g").vivant = false;
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] },
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] },
    { acteurId: "me", roleCle: "messager", cibles: ["y", "li"] }] });
  assert.deepEqual(r.morts, ["x"]);
  assert.deepEqual(r.narrateur, [], "le Messager est automatisé");
  assert.ok(r.messages.some(m => m.destinataire === "me" && m.cle.endsWith("MessagerVide")));
  assert.ok(!r.messages.some(m => m.destinataire === "li"), "rien pour le destinataire");
});

test("nuit : un mort ne meurt pas deux fois ; une meute morte ne tue pas", () => {
  const vs = village();
  const r = L.resoudreNuit({ villageois: vs, actions: [
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["x"], effet: "poison" }] });
  assert.deepEqual(r.morts, ["x"]);
  const sansLoups = vs.map(x => (x.camp === "meute" ? { ...x, vivant: false } : x));
  assert.deepEqual(L.resoudreNuit({ villageois: sansLoups, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }] }).morts, []);
});

test("appliquerResolution : morts, protections remises à 0", () => {
  const vs = village(); vs[2].protections = 1;
  const apres = L.appliquerResolution(vs, { morts: ["x"], changements: [] });
  assert.equal(apres.find(a => a.id === "x").vivant, false);
  assert.ok(apres.every(a => a.protections === 0));
  assert.equal(vs[2].protections, 1, "l'original n'est pas touché");
});

test("nuit : chaque loup note le choix de la meute -> une seule victime, un seul loup démasqué", () => {
  const r = L.resoudreNuit({ villageois: village(), hasard: () => 0, actions: [
    { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] },
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "l2", roleCle: "meute", cibles: ["x"] }] });
  assert.deepEqual(r.morts, ["x"]);
  assert.equal(r.revelations.length, 1);
  const desaccord = L.resoudreNuit({ villageois: village(), actions: [
    { acteurId: "l1", roleCle: "meute", cibles: ["y"], quand: 2 }, { acteurId: "l2", roleCle: "meute", cibles: ["x"], quand: 1 }] });
  assert.deepEqual(desaccord.morts, ["x"], "une seule victime : le premier choix à égalité");
});

test("nuit : une action sans cible est un « je passe »", () => {
  const r = L.resoudreNuit({ villageois: village(), actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: [] }, { acteurId: "l1", roleCle: "meute", cibles: [] }] });
  assert.deepEqual(r.morts, []);
  assert.deepEqual(r.narrateur, []);
});

test("nuit : Herboriste (effet remede) — sur la victime, remède ; sur un autre, poison ; sur soi hors danger, rien", () => {
  const vs = village();
  const sauve = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["x"] }] });
  assert.deepEqual(sauve.morts, []);
  const poison = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["y"] }] });
  assert.deepEqual(poison.deces, [{ acteurId: "x", cause: "meute" }, { acteurId: "y", cause: "poison" }]);
  assert.ok(poison.messages.some(m => m.destinataire === "mj" && m.cle.endsWith("Poison")));
  const soi = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["h"] }] });
  assert.deepEqual(soi.morts, ["x"]);
  const soiVictime = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["h"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["h"] }] });
  assert.deepEqual(soiVictime.morts, [], "il peut se sauver lui-même");
});

test("nuit : Herboriste — une fiole de chaque par partie ; une fiole vide ne verse rien ; les fioles suivent un échange de rôle", () => {
  const vs = village();
  const meute = { acteurId: "l1", roleCle: "meute", cibles: ["x"] }, sur = c => ({ acteurId: "h", roleCle: "herboriste", cibles: [c] });
  const p1 = L.resoudreNuit({ villageois: vs, actions: [sur("y")] });
  assert.deepEqual(p1.deces, [{ acteurId: "y", cause: "poison" }]);
  assert.deepEqual(p1.fioles, { h: { poison: true } });
  const p2 = L.resoudreNuit({ villageois: vs, fioles: p1.fioles, actions: [sur("li")] });
  assert.deepEqual(p2.morts, [], "second poison : la fiole est vide");
  assert.deepEqual(p2.fiolesVides, ["h"]);
  assert.ok(p2.messages.some(m => m.destinataire === "h" && m.cle.endsWith("FioleVidePoison")));
  const r1 = L.resoudreNuit({ villageois: vs, fioles: p1.fioles, actions: [meute, sur("x")] });
  assert.deepEqual(r1.morts, [], "le remède, lui, reste");
  assert.deepEqual(r1.fioles, { h: { poison: true, remede: true } });
  const r2 = L.resoudreNuit({ villageois: vs, fioles: r1.fioles, actions: [meute, sur("x")] });
  assert.deepEqual(r2.morts, ["x"], "second remède : la fiole est vide");
  assert.ok(r2.messages.some(m => m.destinataire === "h" && m.cle.endsWith("FioleVideRemede")));
  const e = L.resoudreNuit({ villageois: [...vs, v("c", "colporteur")], fioles: { h: { poison: true } }, actions: [{ acteurId: "c", roleCle: "colporteur", cibles: ["h"] }] });
  assert.deepEqual(e.fioles, { c: { poison: true } });
  assert.deepEqual(L.etatPublic(L.cloreNuit(L.etatInitial(), { fioles: e.fioles })).fioles, {}, "secret pour les joueurs");
});

test("nuit : Pyromane — se désigner embrase, le feu passe les protections, la meute ne peut pas le tuer", () => {
  const vs = [...village(), v("p", "pyromane")];
  const r = L.resoudreNuit({ villageois: vs, asperges: ["x", "y"], actions: [
    { acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, { acteurId: "p", roleCle: "pyromane", cibles: ["p"] }] });
  assert.deepEqual(r.morts.sort(), ["x", "y"]);
  assert.deepEqual(r.asperges, []);
  const meute = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["p"] }] });
  assert.deepEqual(meute.morts, []);
  assert.equal(meute.sauves[0].par, "immunite");
});

test("nuit : rôles sans cible (Ermite, Chasseur de primes) — leur réveil produit un message, même non noté", () => {
  const ermite = v("er", "ermite"); ermite.role.nuit.cibles = 0;
  const chasseur = v("ch", "chasseur"); chasseur.role.nuit = { actif: true, ordre: 6, cibles: 0, premiereNuitSeulement: true };
  const vs = [...village(), ermite, chasseur];
  const r = L.resoudreNuit({ villageois: vs, tour: 1, primes: { ch: "x" }, hasard: () => 0,
    actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["y"] }] });
  assert.equal(r.messages.find(m => m.destinataire === "er").donnees.nom, "g");
  assert.equal(r.messages.find(m => m.destinataire === "ch").donnees.nom, "x");
  assert.deepEqual(r.narrateur, []);
  const n2 = L.resoudreNuit({ villageois: vs, tour: 2, primes: { ch: "x" }, actions: [] });
  assert.ok(!n2.messages.some(m => m.destinataire === "ch"), "la prime n'est dite que la première nuit");
  const note = L.resoudreNuit({ villageois: vs, tour: 1, primes: { ch: "x" }, actions: [{ acteurId: "er", roleCle: "ermite", cibles: [] }] });
  assert.equal(note.messages.filter(m => m.destinataire === "er").length, 1, "noté ou non : un seul message");
});

test("nuit : Sourcier (voir-camp sur deux cibles) — même camp ou non", () => {
  const vs = [...village(), v("so", "liseuse")];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "so", roleCle: "liseuse-de-cendres", cibles: ["l1", "x"] }] });
  assert.ok(r.messages[0].cle.endsWith("PasMemeCamp"));
  const r2 = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "so", roleCle: "liseuse-de-cendres", cibles: ["y", "x"] }] });
  assert.ok(r2.messages[0].cle.endsWith(".MemeCamp"));
});

test("nuit : le hurleur ne fait pas taire deux nuits de suite la même gorge", () => {
  const vs = [...village(), v("hu", "hurleur")];
  const a = [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["x"] }];
  assert.equal(L.resoudreNuit({ villageois: vs, actions: a }).changements.length, 1);
  assert.equal(L.resoudreNuit({ villageois: vs, actions: a, precedentes: a }).changements.length, 0);
});

// ---------------------------------------------------------------- victoire
test("victoire : village quand plus aucun loup ne vit", () => {
  const vs = village().map(x => (x.camp === "meute" ? { ...x, vivant: false } : x));
  assert.equal(L.verifierVictoire({ villageois: vs }), "village");
});

test("victoire : meute quand elle est aussi nombreuse que les autres", () => {
  const vs = [v("l1", "loup"), v("l2", "loup"), v("a", "villageois"), v("b", "villageois"), v("c", "villageois")];
  assert.equal(L.verifierVictoire({ villageois: vs }), "");
  vs[4].vivant = false;
  assert.equal(L.verifierVictoire({ villageois: vs }), "meute");
});

test("victoire : le Revenant exécuté par le vote gagne ; tué la nuit, non", () => {
  const vs = [v("r", "revenant", { vivant: false }), v("l", "loup"), v("a", "villageois"), v("b", "villageois")];
  assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "r", cause: "vote" }] }), "r");
  assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "r", cause: "meute" }] }), "");
});

test("victoire : le chasseur de primes gagne si sa cible est exécutée", () => {
  const vs = [v("ch", "chasseur"), v("l", "loup"), v("a", "villageois", { vivant: false }), v("b", "villageois"), v("c", "villageois")];
  assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "a", cause: "vote" }], primes: { ch: "a" } }), "ch");
  assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "a", cause: "meute" }], primes: { ch: "a" } }), "");
});

test("victoire : deux amoureux derniers vivants gagnent ensemble", () => {
  const vs = [v("l", "loup", { amoureux: "a" }), v("a", "villageois", { amoureux: "l" }), v("b", "villageois", { vivant: false })];
  assert.equal(L.verifierVictoire({ villageois: vs }), "l");
  const memeCamp = [v("a", "villageois", { amoureux: "b" }), v("b", "villageois", { amoureux: "a" }), v("l", "loup", { vivant: false })];
  assert.equal(L.verifierVictoire({ villageois: memeCamp }), "village");
});

test("victoire : pyromane dernier vivant, ou avec un seul non-loup ; vivant, il empêche la victoire du village", () => {
  const vs = [v("p", "pyromane"), v("a", "villageois"), v("b", "villageois"), v("l", "loup", { vivant: false })];
  assert.equal(L.verifierVictoire({ villageois: vs }), "");
  vs[2].vivant = false;
  assert.equal(L.verifierVictoire({ villageois: vs }), "p", "avec un seul autre joueur, pas un loup");
  vs[1].vivant = false;
  assert.equal(L.verifierVictoire({ villageois: vs }), "p");
  assert.equal(L.verifierVictoire({ villageois: [v("p", "pyromane"), v("l", "loup")] }), "meute", "avec un loup : non");
  assert.equal(L.verifierVictoire({ villageois: [v("p", "pyromane", { role: { cle: "x", victoireCle: "dernier-survivant" } })] }), "p");
});

test("victoire : personne en vie -> pas de vainqueur", () => {
  assert.equal(L.verifierVictoire({ villageois: [v("a", "villageois", { vivant: false })] }), "");
});

// ---------------------------------------------------------------- distribution
test("distribution : chacun un rôle, un métier, une maison ; même graine, même tirage", () => {
  const roles = ["loup", "loup", "garde", "liseuse", "villageois", "villageois"];
  const metiers = ["forgeron", "meuniere", "garde", "cure", "chasseresse", "aubergiste"];
  const joueurs = ["u1", "u2", "u3", "u4", "u5", "u6"];
  const maisons = joueurs.map((_, i) => `Maison ${i + 1}`);
  const a = L.distribuer({ roles, metiers, joueurs, maisons, graine: 42 });
  const b = L.distribuer({ roles, metiers, joueurs, maisons, graine: 42 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(x => x.joueur), joueurs);
  assert.deepEqual(a.map(x => x.role).sort(), [...roles].sort());
  assert.deepEqual(a.map(x => x.metier).sort(), [...metiers].sort());
  assert.deepEqual(a.map(x => x.maison).sort(), [...maisons].sort());
  const graines = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(L.distribuer({ roles, joueurs, graine: i }).map(x => x.role))));
  assert.ok(graines.size > 5, "le tirage varie selon la graine");
});

test("distribution : rôles manquants -> null, rôles en trop -> tirés au sort", () => {
  const a = L.distribuer({ roles: ["loup"], joueurs: ["u1", "u2"], graine: 1 });
  assert.equal(a.filter(x => x.role === null).length, 1);
  assert.equal(a.every(x => x.maison === "" && x.metier === null), true);
  const b = L.distribuer({ roles: ["a", "b", "c"], joueurs: ["u1"], graine: 1 });
  assert.equal(b.length, 1);
});

test("distribution : primes des chasseurs, jamais sur eux-mêmes", () => {
  const vs = [v("ch", "chasseur"), v("a", "villageois"), v("b", "villageois"), v("m", "villageois", { vivant: false })];
  for (let g = 0; g < 20; g++) {
    const p = L.designerPrimes(vs, L.creerHasard(g));
    assert.ok(["a", "b"].includes(p.ch));
  }
});

// ---------------------------------------------------------------- état
test("état : phases, tour à chaque nuit, vote fermé hors de la phase vote", () => {
  let e = L.etatInitial();
  assert.equal(e.phase, "preparation");
  e = L.passerPhase(e, "nuit");
  assert.equal(e.tour, 1);
  e = L.ajouterAction(e, { acteurId: "a", roleCle: "meute", cibles: ["b"] }, 5);
  assert.deepEqual(e.nuit.actions, [{ acteurId: "a", roleCle: "meute", cibles: ["b"], quand: 5 }]);
  e = L.passerPhase(e, "aube");
  assert.equal(e.tour, 1);
  e = L.ouvrirVote(e, { candidats: ["b"] });
  assert.equal(e.phase, "vote");
  e = L.passerPhase(e, "nuit");
  assert.equal(e.tour, 2);
  assert.equal(e.vote.ouvert, false);
  assert.deepEqual(e.nuit.actions, []);
  assert.throws(() => L.passerPhase(e, "sieste"));
});

test("état : vote — enregistrement, refus, minuteur, clôture", () => {
  let e = L.ouvrirVote(L.etatInitial(), { candidats: ["x", "y"], duree: 1000, maintenant: 100 });
  assert.equal(e.vote.finit, 1100);
  const votants = ["a", "b", "c"];
  let r = L.enregistrerVote(e, { votant: "a", cible: "x", votants, maintenant: 200 }); assert.ok(r.ok); e = r.etat;
  r = L.enregistrerVote(e, { votant: "b", cible: "x", votants, maintenant: 300 }); e = r.etat;
  assert.equal(L.enregistrerVote(e, { votant: "mort", cible: "x", votants, maintenant: 300 }).raison, "votant");
  assert.equal(L.enregistrerVote(e, { votant: "c", cible: "z", votants, maintenant: 300 }).raison, "candidat");
  assert.equal(L.enregistrerVote(e, { votant: "c", cible: "y", votants, maintenant: 5000 }).raison, "temps");
  r = L.enregistrerVote(e, { votant: "a", cible: "y", votants, maintenant: 400 }); e = r.etat;   // change d'avis
  const { etat, resultat } = L.cloreVote(e, { votants });
  assert.deepEqual(resultat.decompte, { x: 1, y: 1 });
  assert.equal(resultat.elu, null);
  assert.equal(etat.vote.ouvert, false);
  assert.deepEqual(etat.vote.resultat, resultat);
  assert.equal(L.enregistrerVote(etat, { votant: "c", cible: "x" }).raison, "ferme");
});

test("état : la cloche de la nuit rend le vote suivant double", () => {
  const e = L.ouvrirVote({ ...L.etatInitial(), voteDoubleDemain: true }, { candidats: [] });
  assert.equal(e.vote.double, true);
  assert.equal(e.voteDoubleDemain, false);
});

test("état : morts uniques, vainqueur -> fin, état public sans secrets", () => {
  let e = L.passerPhase(L.etatInitial(), "nuit");
  e = L.ajouterMort(e, { acteurId: "x", cause: "meute" });
  e = L.ajouterMort(e, { acteurId: "x", cause: "vote" });
  assert.deepEqual(e.morts, [{ acteurId: "x", tour: 1, phase: "nuit", cause: "meute" }]);
  e = L.ajouterAction(e, { acteurId: "a", roleCle: "meute", cibles: ["b"] });
  e.primes = { ch: "b" };
  assert.deepEqual(L.etatPublic(e).nuit.actions, []);
  assert.deepEqual(L.etatPublic(e).primes, {});
  e = L.declarerVainqueur(e, "village");
  assert.equal(e.phase, "fin");
  e = L.cloreNuit(L.ajouterAction(e, { acteurId: "g", roleCle: "garde", cibles: ["c"] }), { asperges: ["z"] });
  assert.equal(e.nuitPrecedente.actions.length, 2);
  assert.deepEqual(e.asperges, ["z"]);
  assert.equal(L.journaliser(e, "Il pleut.").historique.at(-1).texte, "Il pleut.");
});

test("constantes : toutes les clés d'effet du contrat, partagées entre automatisées et narrateur", () => {
  assert.deepEqual([...L.EFFETS].sort(), ["annuler-vote", "asperger", "echanger-role", "eclairer", "embraser", "emporter", "epier",
    "lien-amour", "messager", "mordre", "poison", "proteger", "remede", "silence", "tuer", "voir-actif", "voir-camp",
    "voir-role-mort", "vote-double"]);
  assert.deepEqual([...L.EFFETS_NARRATEUR], [], "tous automatisés : le Messager à l'aube, le Juge de paix de jour");
});
