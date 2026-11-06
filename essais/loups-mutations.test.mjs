// Essais par mutation de la logique de lakour-loups : chaque règle importante est cassée à son tour, dans une
// copie de la logique, et la batterie de vérifications ci-dessous doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const R = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } },
  affame: { cle: "loup-affame", nom: "Affamé", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 45, tantQueMeuteEntiere: true } },
  sourcier: { cle: "sourcier", nom: "Sourcier", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 62, cibles: 2, uneNuitSurDeux: true } },
  lectrice: { cle: "liseuse-de-cendres", nom: "Liseuse", camp: "village", effet: "voir-role", nuit: { actif: true, ordre: 60 } },
  pecheur: { cle: "pecheur-de-nuit", nom: "Pêcheur", camp: "village", effet: "tuer", nuit: { actif: true, ordre: 48 } },
  louve: { cle: "louve-mere", nom: "Louve", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41 } },
  deguise: { cle: "loup-deguise", nom: "Déguisé", camp: "meute", effet: "", nuit: { actif: true, ordre: 40 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false } },
  garde: { cle: "garde-du-pont", nom: "Garde", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20 } },
  veilleuse: { cle: "veilleuse-de-lanterne", nom: "Veilleuse", camp: "village", effet: "eclairer", nuit: { actif: true, ordre: 30 } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 35 } },
  herboriste: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 60 } },
  sonneur: { cle: "sonneur", nom: "Sonneur", camp: "village", effet: "vote-double", nuit: { actif: true, ordre: 70 }, usages: { max: 1, restant: 0 } },
  entremetteuse: { cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour", nuit: { actif: true, ordre: 10, premiereNuitSeulement: true } },
  braconniere: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: { actif: false } },
  revenant: { cle: "revenant", nom: "Revenant", camp: "solitaire", effet: "", nuit: { actif: false } },
  chasseur: { cle: "chasseur-de-primes", nom: "Chasseur", camp: "solitaire", effet: "", nuit: { actif: false } },
  pyromane: { cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", nuit: { actif: true, ordre: 80, soiMeme: true } },
  ermite: { cle: "ermite", nom: "Ermite", camp: "village", effet: "voir-actif", nuit: { actif: true, ordre: 70, cibles: 0 } },
  messager: { cle: "messager", nom: "Messager", camp: "village", effet: "messager", nuit: { actif: true, ordre: 10, cibles: 2 } },
  hurleur: { cle: "loup-hurleur", nom: "Hurleur", camp: "meute", effet: "silence", nuit: { actif: true, ordre: 43 } },
  enfant: { cle: "enfant-de-la-brume", nom: "Enfant", camp: "village", effet: "epier", nuit: { actif: true, ordre: 39, soiMeme: true } }
};
const v = (id, role, extra = {}) => ({ id, nom: id, vivant: true, camp: R[role].camp, maison: `M-${id}`, amoureux: "", protections: 0, role: structuredClone(R[role]), ...extra });
const base = () => [v("l1", "loup"), v("l2", "loup"), v("g", "garde"), v("vl", "veilleuse"), v("h", "herboriste"), v("li", "liseuse"), v("x", "villageois"), v("y", "villageois")];
const meute = cible => ({ acteurId: "l2", roleCle: "meute", cibles: [cible] });

// La batterie : chaque vérification lève une erreur si la règle n'est pas respectée.
const VERIFICATIONS = {
  "majorité simple": L => assert.equal(L.decompterVotes({ votes: { a: "x", b: "x", c: "y" } }).elu, "x"),
  "égalité -> personne": L => assert.equal(L.decompterVotes({ votes: { a: "x", b: "y" } }).elu, null),
  "vote double": L => assert.deepEqual(L.decompterVotes({ votes: { a: "x", b: "x", c: "x", d: "y", e: "y", f: "z" }, double: true }).elus, ["x", "y"]),
  "seuls les votants admis": L => assert.equal(L.decompterVotes({ votes: { a: "x", m1: "y", m2: "y" }, votants: ["a"] }).elu, "x"),
  "majorité absolue": L => assert.equal(L.decompterVotes({ votes: { a: "x", b: "x" }, votants: ["a", "b", "c", "d", "e"], majoriteAbsolue: true }).elu, null),
  "meute : égalité -> premier choisi": L => assert.equal(L.majoriteMeute([{ cible: "a", quand: 5 }, { cible: "b", quand: 2 }]), "b"),
  "ordre de nuit et meute groupée": L => {
    const o = L.ordreDeNuit([v("l1", "loup"), v("h", "herboriste"), v("g", "garde"), v("m", "liseuse", { camp: "meute" })], 2);
    assert.deepEqual(o.map(e => e.roleCle), ["garde-du-pont", "liseuse-de-cendres", "meute", "herboriste"]);
    assert.deepEqual(o[2].acteurIds, ["l1", "m"]);
  },
  "première nuit seulement": L => {
    assert.ok(L.ordreDeNuit([v("e", "entremetteuse")], 1).length === 1);
    assert.ok(L.ordreDeNuit([v("e", "entremetteuse")], 2).length === 0);
  },
  "une nuit sur deux": L => {
    const cles = t => L.ordreDeNuit([v("a", "sourcier")], t).map(e => e.roleCle);
    assert.ok(!cles(1).includes("sourcier"));
    assert.ok(cles(2).includes("sourcier"));
  },
  "affamé : chaque nuit tant que la meute est entière": L => {
    const cles = (vs, t) => L.ordreDeNuit(vs, t).map(e => e.roleCle);
    assert.ok(cles([v("a", "affame"), v("l", "loup")], 1).includes("loup-affame"));
    assert.ok(!cles([v("a", "affame"), v("l", "loup", { vivant: false })], 2).includes("loup-affame"));
    assert.ok(!cles([v("a", "affame"), v("m", "villageois", { camp: "meute", vivant: false })], 2).includes("loup-affame"), "un mordu mort compte");
  },
  "affamé rassasié : son action ne tue plus": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("a", "affame"), v("lm", "loup", { vivant: false })],
    actions: [{ acteurId: "a", roleCle: "loup-affame", cibles: ["y"] }] }).morts, []),
  "un loup seul ne tue pas un loup": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("a", "affame")],
    actions: [{ acteurId: "a", roleCle: "loup-affame", cibles: ["l1"] }] }).morts, []),
  "la garde n'arrête que la meute": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("pe", "pecheur")],
    actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, { acteurId: "pe", roleCle: "pecheur-de-nuit", cibles: ["x"] }] }).morts, ["x"]),
  "l'infection passe la garde": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("lm", "louve")],
    actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x"), { acteurId: "lm", roleCle: "louve-mere", cibles: ["x"] }] }).changements,
    [{ type: "camp", acteurId: "x", camp: "meute" }]),
  "un mordu n'est pas une victime": L => assert.equal(L.resoudreNuit({ villageois: [...base(), v("lm", "louve")],
    actions: [meute("x"), { acteurId: "lm", roleCle: "louve-mere", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["x"] }] }).fioles.h?.remede, undefined),
  "deux fioles la même nuit": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [meute("x"), { acteurId: "h", roleCle: "herboriste", cibles: ["x", "y"] }] }).morts, ["y"]),
  "l'enfant apprend le nom des loups": L => assert.equal(L.resoudreNuit({ villageois: [...base(), v("en", "enfant")], hasard: () => 0.9, chanceEpier: 0.5,
    actions: [{ acteurId: "en", roleCle: "enfant-de-la-brume", cibles: ["en"] }, meute("x")] }).messages.find(m => m.destinataire === "en")?.donnees.noms, "l1, l2"),
  "l'enfant surprise : ni garde": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("en", "enfant")],
    actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["en"] }, { acteurId: "en", roleCle: "enfant-de-la-brume", cibles: ["en"], surprise: true }, meute("x")] }).morts, ["en"]),
  "la surprise tirée à l'avance": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("en", "enfant")], hasard: () => 0, chanceEpier: 1,
    actions: [{ acteurId: "en", roleCle: "enfant-de-la-brume", cibles: ["en"], surprise: false }, meute("x")] }).morts, ["x"]),
  "la Liseuse lit le rôle, le déguisé en Villageois": L => {
    const lire = c => L.resoudreNuit({ villageois: [...base(), v("lc", "lectrice"), v("d", "deguise", { role: { ...structuredClone(R.deguise), apparence: "village" } })],
      actions: [{ acteurId: "lc", roleCle: "liseuse-de-cendres", cibles: [c] }] }).messages[0].donnees;
    assert.deepEqual(lire("x"), { nom: "x", role: "Villageois", camp: "village" });
    assert.deepEqual(lire("l1"), { nom: "l1", role: "Loup", camp: "meute" });
    assert.deepEqual(lire("d"), { nom: "d", role: "Villageois", camp: "village" });
  },
  "usages épuisés": L => assert.equal(L.ordreDeNuit([v("s", "sonneur")], 1).length, 0),
  "les morts ne sont pas réveillés": L => assert.deepEqual(L.ordreDeNuit([v("g", "garde", { vivant: false }), v("l", "loup", { vivant: false })], 1), []),
  "la meute tue": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [meute("x")] }).morts, ["x"]),
  "la protection sauve": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")] }).morts, []),
  "pas deux protections de suite": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")],
    precedentes: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }] }).morts, ["x"]),
  "protections posées par l'API": L => {
    const vs = base(); vs[6].protections = 1;
    assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [meute("x")] }).morts, []);
  },
  "le remède sauve": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [meute("x"), { acteurId: "h", roleCle: "herboriste", cibles: ["x"] }] }).morts, []),
  "le poison passe la protection": L => {
    const vs = base(); vs[7].protections = 1;
    assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "h", roleCle: "herboriste", cibles: ["y"], effet: "poison" }] }).morts, ["y"]);
  },
  "la lanterne démasque": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] }, meute("x")] })
    .revelations.map(r => r.acteurId), ["l2"]),
  "la lanterne ne ment pas": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["y"] }, meute("x")] }).revelations, []),
  "mordre au lieu de tuer": L => {
    const r = L.resoudreNuit({ villageois: [...base(), v("lm", "louve")], actions: [meute("x"), { acteurId: "lm", roleCle: "louve-mere", cibles: ["x"] }] });
    assert.deepEqual(r.morts, []);
    assert.deepEqual(r.changements, [{ type: "camp", acteurId: "x", camp: "meute" }]);
  },
  "chagrin en cascade": L => {
    const vs = base(); vs[6].amoureux = "y"; vs[7].amoureux = "x";
    assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [meute("x")] }).morts, ["x", "y"]);
  },
  "embraser": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("p", "pyromane")], actions: [{ acteurId: "p", roleCle: "pyromane", cibles: [], effet: "embraser" }],
    asperges: ["x", "y"] }).morts.sort(), ["x", "y"]),
  "asperger d'une nuit à l'autre": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("p", "pyromane")], actions: [{ acteurId: "p", roleCle: "pyromane", cibles: ["y"] }],
    asperges: ["x"] }).asperges.sort(), ["x", "y"]),
  "emporter à sa mort": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("b", "braconniere")], actions: [meute("b")] }).enAttente, [{ acteurId: "b", effet: "emporter" }]),
  "un mort n'agit plus": L => {
    const vs = base(); vs[2].vivant = false;
    assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")] }).morts, ["x"]);
  },
  "le loup déguisé paraît villageois": L => assert.equal(L.resoudreNuit({ villageois: [...base(), v("d", "deguise")],
    actions: [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["d"] }] }).messages[0].donnees.camp, "village"),
  "protections remises à 0": L => assert.ok(L.appliquerResolution([v("a", "villageois", { protections: 2 })], { morts: [] }).every(x => x.protections === 0)),
  "victoire du village": L => assert.equal(L.verifierVictoire({ villageois: [v("l", "loup", { vivant: false }), v("a", "villageois")] }), "village"),
  "le pyromane vivant bloque le village": L => assert.equal(L.verifierVictoire({ villageois: [v("l", "loup", { vivant: false }), v("a", "villageois"), v("b", "villageois"), v("p", "pyromane")] }), ""),
  "le pyromane gagne avec un seul non-loup": L => assert.equal(L.verifierVictoire({ villageois: [v("a", "villageois"), v("p", "pyromane")] }), "p"),
  "la meute n'a qu'une victime": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [
    { acteurId: "l1", roleCle: "meute", cibles: ["x"], quand: 1 }, { acteurId: "l2", roleCle: "meute", cibles: ["y"], quand: 2 }] }).morts, ["x"]),
  "un seul loup entre chez la victime": L => assert.equal(L.resoudreNuit({ villageois: base(), actions: [
    { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] }, { acteurId: "l1", roleCle: "meute", cibles: ["x"] }, meute("x")] }).revelations.length, 1),
  "passer ne fait rien": L => assert.equal(L.resoudreNuit({ villageois: [...base(), v("s", "sonneur")], actions: [{ acteurId: "s", roleCle: "sonneur", cibles: [] }] }).voteDouble, false),
  "herboriste : poison sur un autre": L => assert.deepEqual(L.resoudreNuit({ villageois: base(), actions: [meute("x"), { acteurId: "h", roleCle: "herboriste", cibles: ["y"] }] }).morts, ["x", "y"]),
  "pyromane : se désigner embrase": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("p", "pyromane")], asperges: ["x"],
    actions: [{ acteurId: "p", roleCle: "pyromane", cibles: ["p"] }] }).morts, ["x"]),
  "le feu passe les protections": L => {
    const vs = [...base(), v("p", "pyromane")]; vs[6].protections = 1;
    assert.deepEqual(L.resoudreNuit({ villageois: vs, asperges: ["x"], actions: [{ acteurId: "p", roleCle: "pyromane", cibles: [], effet: "embraser" }] }).morts, ["x"]);
  },
  "la meute ne tue pas le pyromane": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("p", "pyromane")], actions: [meute("p")] }).morts, []),
  "un rôle sans cible agit d'office": L => assert.ok(L.resoudreNuit({ villageois: [...base(), v("e", "ermite")], tour: 1, actions: [] }).messages.some(m => m.destinataire === "e")),
  "le chasseur apprend sa cible": L => {
    const c = v("c", "chasseur"); c.role.nuit = { actif: true, ordre: 6, cibles: 0, premiereNuitSeulement: true };
    assert.equal(L.resoudreNuit({ villageois: [...base(), c], tour: 1, primes: { c: "x" }, actions: [] }).messages.find(m => m.destinataire === "c")?.donnees.nom, "x");
  },
  "sourcier : même camp ou non": L => assert.ok(L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["l1", "x"] }] })
    .messages[0].cle.endsWith("PasMemeCamp")),
  "pas deux silences de suite": L => {
    const a = [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["x"] }];
    assert.equal(L.resoudreNuit({ villageois: [...base(), v("hu", "hurleur")], actions: a, precedentes: a }).changements.length, 0);
  },
  "l'enfant qui passe ne risque rien": L => assert.deepEqual(L.resoudreNuit({ villageois: [...base(), v("en", "enfant")], hasard: () => 0, chanceEpier: 1,
    actions: [{ acteurId: "en", roleCle: "enfant-de-la-brume", cibles: [] }, meute("x")] }).morts, ["x"]),
  "victoire de la meute à égalité": L => assert.equal(L.verifierVictoire({ villageois: [v("l", "loup"), v("a", "villageois")] }), "meute"),
  "revenant exécuté": L => assert.equal(L.verifierVictoire({ villageois: [v("r", "revenant", { vivant: false }), v("l", "loup"), v("a", "villageois"), v("b", "villageois")],
    morts: [{ acteurId: "r", cause: "vote", tour: 3 }] }), "r"),
  "revenant exécuté trop tôt ne gagne pas": L => assert.equal(L.verifierVictoire({ villageois: [v("r", "revenant", { vivant: false }), v("l", "loup"), v("a", "villageois"), v("b", "villageois")],
    morts: [{ acteurId: "r", cause: "vote", tour: 2 }] }), ""),
  "revenant tué la nuit ne gagne pas": L => assert.equal(L.verifierVictoire({ villageois: [v("r", "revenant", { vivant: false }), v("l", "loup"), v("a", "villageois"), v("b", "villageois")],
    morts: [{ acteurId: "r", cause: "meute" }] }), ""),
  "amants de camps différents : jamais gagnants avec leur camp": L => {
    const vs = [v("l", "loup", { amoureux: "a" }), v("a", "villageois", { amoureux: "l", vivant: false }), v("l2", "loup"), v("b", "villageois", { vivant: false })];
    const gagnants = L.bilanDePartie({ villageois: vs, vainqueur: "meute" }).filter(x => x.gagnant).map(x => x.id);
    assert.deepEqual(gagnants, ["l2"]);
    const memes = [v("l", "loup", { amoureux: "l2" }), v("l2", "loup", { amoureux: "l" }), v("a", "villageois", { vivant: false })];
    assert.deepEqual(L.bilanDePartie({ villageois: memes, vainqueur: "meute" }).filter(x => x.gagnant).map(x => x.id).sort(), ["l", "l2"]);
  },
  "amoureux derniers vivants": L => assert.equal(L.verifierVictoire({ villageois: [v("l", "loup", { amoureux: "a" }), v("a", "villageois", { amoureux: "l" })] }), "l"),
  "chasseur de primes": L => assert.equal(L.verifierVictoire({ villageois: [v("c", "chasseur"), v("l", "loup"), v("a", "villageois", { vivant: false }), v("b", "villageois"), v("d", "villageois")],
    morts: [{ acteurId: "a", cause: "vote", tour: 2 }], primes: { c: "a" } }), "c"),
  "chasseur de primes : cible tuée la nuit ou exécutée trop tard": L => {
    const vs = [v("c", "chasseur"), v("l", "loup"), v("a", "villageois", { vivant: false }), v("b", "villageois"), v("d", "villageois")];
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "a", cause: "meute", tour: 1 }], primes: { c: "a" } }), "");
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "a", cause: "vote", tour: 3 }], primes: { c: "a" } }), "");
    assert.deepEqual(L.primesEchues({ villageois: vs, morts: [], primes: { c: "a" }, tour: 3 }), ["c"]);
    assert.deepEqual(L.primesEchues({ villageois: vs, morts: [], primes: { c: "a" }, tour: 2 }), []);
  },
  "distribution reproductible et mélangée": L => {
    const roles = ["a", "b", "c", "d", "e", "f"], joueurs = ["1", "2", "3", "4", "5", "6"];
    assert.deepEqual(L.distribuer({ roles, joueurs, graine: 3 }), L.distribuer({ roles, joueurs, graine: 3 }));
    const tirages = new Set(Array.from({ length: 10 }, (_, g) => L.distribuer({ roles, joueurs, graine: g }).map(t => t.role).join()));
    assert.ok(tirages.size > 1);
  },
  "hasard à graine": L => {
    assert.notEqual(L.creerHasard(5), Math.random);
    assert.equal(L.creerHasard(5)(), L.creerHasard(5)());
  },
  "tour + 1 à la nuit": L => assert.equal(L.passerPhase(L.passerPhase(L.etatInitial(), "nuit"), "nuit").tour, 2),
  "minuteur du vote": L => assert.equal(L.enregistrerVote(L.ouvrirVote(L.etatInitial(), { candidats: ["x"], duree: 10, maintenant: 0 }),
    { votant: "a", cible: "x", maintenant: 50 }).ok, false),
  "quitter le vote le ferme": L => assert.equal(L.passerPhase(L.ouvrirVote(L.etatInitial(), {}), "nuit").vote.ouvert, false),
  "la cloche rend le vote double": L => assert.equal(L.ouvrirVote({ ...L.etatInitial(), voteDoubleDemain: true }, {}).vote.double, true),
  "état public sans secrets": L => {
    const e = { ...L.ajouterAction(L.etatInitial(), { acteurId: "a", roleCle: "meute", cibles: ["b"] }), primes: { c: "b" } };
    assert.deepEqual(L.etatPublic(e).nuit.actions, []);
    assert.deepEqual(L.etatPublic(e).primes, {});
  },
  "palmarès des Chroniques": L => {
    const l = (joueur, gagnant, vivant = false) => ({ joueur, gagnant, vivant, camp: "village" });
    const p = L.palmares([{ lignes: [l("A", true), l("B", false, true), l("", true)] }, { lignes: [l("A", false), l("C", true)] }]);
    assert.deepEqual(p.map(x => [x.joueur, x.parties, x.victoires, x.survies]), [["C", 1, 1, 0], ["A", 2, 1, 0], ["B", 1, 0, 1]]);
  }
};

// [fichier, texte d'origine, texte muté, règle cassée]
const MUTATIONS = [
  ["votes.mjs", "if (elus.length + groupe.length > places) break;", "", "égalité -> personne"],
  ["votes.mjs", "const places = double ? 2 : 1;", "const places = 1;", "vote double"],
  ["votes.mjs", "if (admisVotants && !admisVotants.has(votant)) continue;", "", "votants admis"],
  ["votes.mjs", "retenus = elus.filter(id => decompte[id] * 2 > total);", "retenus = elus;", "majorité absolue"],
  ["votes.mjs", "(a.quand ?? 0) - (b.quand ?? 0)", "(b.quand ?? 0) - (a.quand ?? 0)", "meute : premier choisi"],
  ["nuit.mjs", "if (n.premiereNuitSeulement && tour !== 1) return false;", "", "première nuit seulement"],
  ["nuit.mjs", "tour % 2 !== 0", "tour % 2 === 0", "une nuit sur deux"],
  ["nuit.mjs", "Number(u.restant) <= 0) return false;", "Number(u.restant) < 0) return false;", "usages"],
  ["nuit.mjs", "vivants.filter(v => v.camp === \"meute\")", "vivants.filter(v => v.role?.camp === \"meute\")", "mordus dans la meute"],
  ["nuit.mjs", "a.ordre - b.ordre", "b.ordre - a.ordre", "ordre croissant"],
  ["nuit.mjs", "const vivants = villageois.filter(v => v.vivant !== false);", "const vivants = villageois;", "morts non réveillés"],
  ["resolution.mjs", "if (precedente(a.acteurId, \"proteger\")?.cibles?.[0] === cible) {", "if (false) {", "pas deux protections de suite"],
  ["resolution.mjs", "} else gardes.add(cible);", "}", "protection"],
  ["resolution.mjs", "(x.meute && gardes.has(x.cible))", "gardes.has(x.cible)", "la garde n'arrête que la meute"],
  ["nuit.mjs", "if (n.tantQueMeuteEntiere && !entiere) return false;", "", "affamé : meute entière"],
  ["nuit.mjs", "!villageois.some(v => v.vivant === false && v.camp === \"meute\")", "!villageois.some(v => v.vivant === false && v.role?.camp === \"meute\")", "affamé : un mordu mort compte"],
  ["resolution.mjs", "a.roleCle === acteur.role.cle && !entiere) {", "a.roleCle === acteur.role.cle && false) {", "affamé rassasié à l'aube"],
  ["resolution.mjs", "if (solo && cibles.some(", "if (false && cibles.some(", "un loup seul ne tue pas un loup"],
  ["resolution.mjs", "else if (fermees.has(cible) &&", "else if ((fermees.has(cible) || gardes.has(cible)) &&", "l'infection passe la garde"],
  ["resolution.mjs", "const victimes = new Set(attaques.map(x => x.cible));", "const victimes = new Set([...attaques.map(x => x.cible), ...parEffet(\"mordre\").map(a => a.cibles[0])]);", "un mordu n'est pas une victime"],
  ["resolution.mjs", "for (const c of a.cibles.slice(0, 2)) {", "for (const c of a.cibles.slice(0, 1)) {", "deux fioles la même nuit"],
  ["resolution.mjs", "const loups = peutChasser.map(nom).join(\", \");", "const loups = \"\";", "l'enfant apprend le nom des loups"],
  ["resolution.mjs", "&& !x.traverse && !x.surprise && ", "&& !x.traverse && ", "l'enfant surprise : ni garde"],
  ["resolution.mjs", "typeof a.surprise === \"boolean\" ? a.surprise : ", "", "la surprise tirée à l'avance"],
  ["resolution.mjs", "if (app && app !== campDuRole) return", "if (false) return", "la Liseuse : apparence"],
  ["resolution.mjs", "return { nom: v.role.nom ?? v.role.cle ?? \"?\", camp: campDuRole };", "return { nom: \"Villageois\", camp: \"village\" };", "la Liseuse lit le rôle"],
  ["resolution.mjs", "const proteges = new Set(villageois.filter(v => Number(v.protections) > 0).map(v => v.id));", "const proteges = new Set();", "protections de l'API"],
  ["resolution.mjs", "if (remedies.has(x.cible)) {", "if (false) {", "remède"],
  ["resolution.mjs", "if ((proteges.has(x.cible) || (x.meute && gardes.has(x.cible))) && !x.traverse && ", "if ((proteges.has(x.cible) || (x.meute && gardes.has(x.cible))) && ", "poison"],
  ["resolution.mjs", "for (const loup of vus) sortie.revelations.push", "for (const loup of []) sortie.revelations.push", "lanterne"],
  ["resolution.mjs", ".filter(e => e.loup !== a.acteurId && memeMaison(e.cible, eclairee))", ".filter(e => e.loup !== a.acteurId)", "lanterne exacte"],
  ["resolution.mjs", "for (let i = attaques.length - 1; i >= 0; i--) if (attaques[i].meute && attaques[i].cible === cible) attaques.splice(i, 1);", "", "mordre au lieu de tuer"],
  ["resolution.mjs", "if (lie) meurt(lie, CAUSES.chagrin);", "", "chagrin"],
  ["resolution.mjs", "for (const id of aspergees) attaques.push({ cible: id, cause: CAUSES.feu, traverse: true });", "", "embraser"],
  ["resolution.mjs", "cause: CAUSES.feu, traverse: true", "cause: CAUSES.feu", "le feu passe les protections"],
  ["resolution.mjs", "if (victimeMeute && loupMeute && !surprise) entrees.push({ loup: loupMeute, cible: victimeMeute });",
    "for (const a of actionsMeute) entrees.push({ loup: a.acteurId, cible: a.cibles[0] });", "un seul loup entre"],
  ["resolution.mjs", "if (victimeMeute) attaques.push(", "for (const a of actionsMeute) attaques.push({ cible: a.cibles[0], cause: CAUSES.meute, meute: true }); if (false) attaques.push(", "une seule victime"],
  ["resolution.mjs", "if (passe) continue;", "", "passer"],
  ["resolution.mjs", "c !== a.acteurId ? \"poison\" : \"\";", "\"\";", "herboriste : poison"],
  ["resolution.mjs", "...parEffet(\"asperger\").filter(a => a.cibles.includes(a.acteurId))", "", "pyromane : se désigner"],
  ["resolution.mjs", "if (x.meute && victoireCleDe(parId.get(x.cible)?.role) === \"dernier-survivant\") {", "if (false) {", "pyromane immunisé"],
  ["resolution.mjs", "if (!toutes.some(a => a.acteurId === v.id && a.roleCle === v.role.cle)) toutes.push(", "if (false) toutes.push(", "rôles sans cible"],
  ["resolution.mjs", "const cible = primes[a.acteurId];", "const cible = \"\";", "prime"],
  ["resolution.mjs", "    if (d) {", "    if (false) {", "sourcier"],
  ["resolution.mjs", "if (precedente(a.acteurId, \"silence\")?.cibles?.[0] === c) {", "if (false) {", "pas deux silences de suite"],
  ["victoire.mjs", "(vivants.length === 1 || (vivants.length === 2 && vivants.find(v => v !== tueurs[0]).camp !== \"meute\"))", "vivants.length === 1", "pyromane avec un non-loup"],
  ["resolution.mjs", "let aspergees = new Set(asperges.filter(id => vivant(id)));", "let aspergees = new Set();", "asperger"],
  ["resolution.mjs", "sortie.enAttente.push(", "void (", "emporter"],
  ["resolution.mjs", "if (!deLaMeute && !deLaPeste && !duDeuil && (!acteur || acteur.vivant === false)) continue;", "if (!deLaMeute && !deLaPeste && !duDeuil && !acteur) continue;", "les morts n'agissent plus"],
  ["resolution.mjs", "if (v.role && v.role.apparence === undefined && v.camp === \"meute\" && /deguis/.test(v.role.cle ?? \"\")) return \"village\";", "", "loup déguisé"],
  ["resolution.mjs", "for (const v of nouveaux) v.protections = 0;", "", "protections remises à 0"],
  ["victoire.mjs", "if (meute === 0 && tueurs.length === 0) return \"village\";", "if (meute === 0) return \"village\";", "pyromane"],
  ["victoire.mjs", "meute >= vivants.length - meute", "meute > vivants.length - meute", "meute à égalité"],
  ["victoire.mjs", "if (cle === \"execute\" && executesTard.has(v.id)) return v.id;", "", "revenant"],
  ["victoire.mjs", "m.cause === \"vote\" && Number(m.tour) >= JOUR_DU_REVENANT", "m.cause === \"vote\"", "revenant exécuté trop tôt ne gagne pas"],
  ["victoire.mjs", "morts.filter(m => m.cause === \"vote\" && Number(m.tour) <= ", "morts.filter(m => Number(m.tour) <= ", "exécuté par le vote seulement"],
  ["victoire.mjs", "if (a.amoureux === b.id && b.amoureux === a.id) {", "if (false) {", "amoureux"],
  ["victoire.mjs", "if (v.camp === vainqueur && !desAmantsMeles(v)) gagnants.add(v.id);", "if (v.camp === vainqueur) gagnants.add(v.id);", "amants mêlés"],
  ["victoire.mjs", "if (cle === \"cible-executee\" && primes[v.id] && executesATemps.has(primes[v.id])) return v.id;", "", "chasseur de primes"],
  ["victoire.mjs", "Number(m.tour) <= JOUR_LIMITE_DE_LA_PRIME", "true", "chasseur de primes : cible tuée la nuit ou exécutée trop tard"],
  ["victoire.mjs", "return Boolean(m) || Number(tour) > JOUR_LIMITE_DE_LA_PRIME;", "return Boolean(m);", "chasseur de primes : cible tuée la nuit ou exécutée trop tard"],
  ["distribution.mjs", "const r = melanger(roles, h);", "const r = [...roles];", "rôles mélangés"],
  ["hasard.mjs", "if (graine === undefined || graine === null || graine === \"\") return Math.random;", "return Math.random;", "graine"],
  ["etat.mjs", "etat.tour += 1;", "", "tour"],
  ["etat.mjs", "if (v.finit && maintenant > v.finit) return { etat, ok: false, raison: \"temps\" };", "", "minuteur"],
  ["etat.mjs", "if (phase !== \"vote\") etat.vote.ouvert = false;", "", "fermeture du vote"],
  ["etat.mjs", "(double ?? Boolean(etat.voteDoubleDemain))", "Boolean(double)", "cloche"],
  ["etat.mjs", "for (const cle of [\"asperges\", \"primes\", ", "for (const cle of [\"asperges\", ", "secrets cachés"],
  ["victoire.mjs", "if (!l.joueur) continue;", "", "palmarès sans joueurs IA"],
  ["victoire.mjs", "b.victoires - a.victoires || b.victoires / b.parties - a.victoires / a.parties", "b.victoires - a.victoires", "palmarès : le meilleur taux"],
  ["victoire.mjs", "if (l.vivant) p.survies++;", "", "palmarès : survies"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-mutant-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === fichier) {
      assert.ok(texte.includes(avant), `mutation introuvable dans ${f} : ${avant}`);
      texte = texte.replace(avant, apres);
    }
    writeFileSync(join(dossier, f), texte);
  }
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

function echecs(L) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { verifier(L); } catch { liste.push(nom); }
  }
  return liste;
}

test("mutations : la logique d'origine passe toute la batterie", async () => {
  const L = await import("../systems/lakour-loups/logique/index.mjs");
  assert.deepEqual(echecs(L), []);
});

for (const [fichier, avant, apres, regle] of MUTATIONS) {
  test(`mutation « ${regle} » (${fichier}) : détectée`, async () => {
    const L = await chargerMutant(fichier, avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}
