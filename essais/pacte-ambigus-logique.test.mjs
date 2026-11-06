// Le Pacte, étape 3b (logique pure) : les ambigus, les solitaires du livre et le Loup pâle — le Chapardeur (deux cartes de plus au
// paquet, le centre, l'échange, obligé si deux loups), le Bateleur (trois cartes face visible, la carte jouée qui le réveille à son
// ordre et se résout avec son rôle), le Mâtin (se désigner pour la meute), l'Enfant des bois (le modèle tombé, il rejoint la meute),
// la Chambrière (qui peut se dévouer, le rôle remis à neuf, sa première nuit à la nuit suivante, la charge perdue, les gestes du
// condamné qui ne jouent pas), le Feu follet (le jour d'abord, la victoire du premier tour), le Joueur de vielle (deux charmés par
// nuit, leur réveil, la victoire), l'Illuminé (le partage du village, la victoire), le Loup pâle (un loup une nuit sur deux, sa
// victoire de dernier vivant, jamais avec la meute) ; l'état public et secret ; le générateur (n + 2 cartes) et le contenu. Chaque
// règle est cassée à son tour dans une copie de la logique, et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { ROLES_DU_PACTE_3B, AMBIGUS_DU_PACTE, SOLITAIRES_DU_PACTE, ordreDeReveil } from "../modules/lakour-veillees/contenu/guides.mjs";
import { JETONS_ROLES } from "../modules/lakour-veillees/contenu/jetons.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const sansNuit = { actif: false, cibles: 0 };
const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 } },
  affame: { cle: "loup-affame", nom: "Loup affamé", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 42, cibles: 1, tantQueMeuteEntiere: true } },
  louve: { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41, cibles: 1 } },
  pale: { cle: "loup-pale", nom: "Loup pâle", camp: "meute", effet: "trahir", victoireCle: "seul-survivant", nuit: { actif: true, ordre: 41, cibles: 1, uneNuitSurDeux: true } },
  garde: { cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1, soiMeme: true } },
  herbo: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true }, usages: { max: 2, restant: 2 } },
  entremetteuse: { cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour", nuit: { actif: true, ordre: 5, cibles: 2, premiereNuitSeulement: true } },
  braco: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: sansNuit },
  chapardeur: { cle: "chapardeur", nom: "Chapardeur", camp: "village", effet: "chaparder", nuit: { actif: true, ordre: 1, cibles: 1, premiereNuitSeulement: true } },
  bateleur: { cle: "bateleur", nom: "Bateleur", camp: "village", effet: "emprunter", nuit: { actif: true, ordre: 2, cibles: 1 } },
  matin: { cle: "matin", nom: "Mâtin", camp: "village", effet: "choisir-camp", nuit: { actif: true, ordre: 38, cibles: 1, soiMeme: true, premiereNuitSeulement: true } },
  enfant: { cle: "enfant-des-bois", nom: "Enfant des bois", camp: "village", effet: "modele", nuit: { actif: true, ordre: 13, cibles: 1, premiereNuitSeulement: true } },
  chambriere: { cle: "chambriere", nom: "Chambrière", camp: "village", effet: "devouement", nuit: sansNuit },
  feu: { cle: "feu-follet", nom: "Feu follet", camp: "solitaire", victoireCle: "premier-tour", nuit: sansNuit },
  vielle: { cle: "joueur-de-vielle", nom: "Joueur de vielle", camp: "solitaire", effet: "charmer", victoireCle: "tous-charmes", nuit: { actif: true, ordre: 80, cibles: 2 } },
  illumine: { cle: "illumine", nom: "Illuminé", camp: "solitaire", victoireCle: "autre-groupe", nuit: sansNuit },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: sansNuit }
};
const MAISONS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, x: 13, y: 14 };
const v = (id, role = "villageois", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${MAISONS[id] ?? 9}`,
  silence: false, amoureux: "", role: { usages: { max: 0, restant: 0 }, apparence: "", victoireCle: "", ...structuredClone(ROLE[role]) }, ...extra });
const mort = (vs, ...ids) => vs.map(x => (ids.includes(x.id) ? { ...x, vivant: false } : x));
const etatDe = (L, vs, extra = {}) => L.normaliserEtat({ ...L.fixerCercle({ ...L.etatInitial(), partie: "p", phase: "nuit", tour: 1 }, vs), ...extra });
const nuit = (L, vs, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: 1, hasard: () => 0, cercle: L.ordreDesPlaces(vs), ...extra });
const meute = (cible, par = "a") => ({ acteurId: par, roleCle: "meute", cibles: [cible] });
// Une carte du centre (données d'objet).
const carte = role => ({ name: ROLE[role].nom, img: "", system: { usages: { max: 0, restant: 0 }, ...structuredClone(ROLE[role]) } });
const plat = role => ({ usages: { max: 0, restant: 0 }, apparence: "", victoireCle: "", ...structuredClone(ROLE[role]) });

const VERIFICATIONS = {
  // ------------------------------------------------------------ le Chapardeur
  "Chapardeur : deux cartes Villageois de plus au paquet ; obligé si les deux sont des loups ; l'échange remet la carte à neuf": L => {
    assert.deepEqual(L.cartesAAjouter(["chapardeur", "loup-de-brumecombe", "villageois"], 3), ["villageois", "villageois"]);
    assert.deepEqual(L.cartesAAjouter(["chapardeur", "a", "b", "c", "d"], 3), [], "déjà n + 2 cartes");
    assert.deepEqual(L.cartesAAjouter(["loup-de-brumecombe", "villageois"], 2), [], "sans Chapardeur, rien");
    assert.equal(L.chapardeurOblige([carte("loup"), carte("pale")]), true);
    assert.equal(L.chapardeurOblige([carte("loup"), carte("villageois")]), false);
    const herbo = { ...carte("herbo"), system: { ...carte("herbo").system, usages: { max: 2, restant: 0 } } };
    const x = L.chaparder([carte("villageois"), herbo], 1, carte("chapardeur"));
    assert.equal(x.pris.system.cle, "herboriste");
    assert.equal(x.pris.system.usages.restant, 2, "remis à neuf");
    assert.deepEqual(x.centre.map(r => r.system.cle), ["villageois", "chapardeur"], "sa carte va au centre");
    assert.equal(L.chaparder([carte("villageois")], 3, carte("chapardeur")), null);
  },
  "Chapardeur : un réveil d'une seule nuit, en tout premier ; des cartes, pas des joueurs": L => {
    const vs = [v("a", "loup"), v("b", "chapardeur"), v("c", "entremetteuse"), v("d")];
    assert.deepEqual(L.ordreDeNuit(vs, 1).map(e => e.roleCle).slice(0, 2), ["chapardeur", "entremetteuse"]);
    assert.ok(!L.ordreDeNuit(vs, 2).some(e => e.roleCle === "chapardeur"));
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs), acteurId: "b", roleCle: "chapardeur" }), []);
  },
  // ------------------------------------------------------------ le Bateleur
  "Bateleur : ses cartes possibles (pouvoir de nuit, ni loup, ni solitaire, ni groupe, ni première nuit, pas au paquet), trois au hasard": L => {
    const roles = [ROLE.garde, ROLE.herbo, ROLE.loup, ROLE.vielle, ROLE.entremetteuse, ROLE.braco, ROLE.bateleur,
      { cle: "lavandiere", camp: "village", effet: "fratrie", nuit: { actif: true, nuitsImpaires: true }, groupe: 2 },
      { cle: "sourcier", camp: "village", effet: "voir-camp", nuit: { actif: true, uneNuitSurDeux: true } },
      { cle: "liseuse-de-cendres", camp: "village", effet: "voir-role", nuit: { actif: true } },
      { cle: "pie", camp: "village", effet: "plume", nuit: { actif: true } },
      { cle: "veille-unique", camp: "village", effet: "voir-camp", nuit: { actif: true, premiereNuitSeulement: true } }];
    assert.deepEqual(L.rolesDuBateleur(roles, ["herboriste"]).sort(), ["garde-du-pont", "liseuse-de-cendres", "pie"]);
    const a = L.tirerCartesDuBateleur({ possibles: ["garde-du-pont", "liseuse-de-cendres", "pie", "ermite"], graine: "x" });
    assert.equal(a.length, 3);
    assert.deepEqual(L.tirerCartesDuBateleur({ possibles: ["garde-du-pont", "liseuse-de-cendres", "pie", "ermite"], graine: "x" }), a, "reproductible");
  },
  "Bateleur : la carte jouée le réveille à son ordre, avec son rôle ; elle se résout avec ce rôle ; jouée, elle n'est plus jouable": L => {
    const vs = [v("a", "loup"), v("b", "bateleur"), v("c"), v("d")];
    const e = etatDe(L, vs, { ambigus: { bateleur: [{ cle: "garde-du-pont", nom: "Garde du pont" }, { cle: "pie", nom: "Pie" }] },
      ambigusSecret: { emprunts: { b: { cle: "garde-du-pont", tour: 1, role: plat("garde") } } } });
    const ordre = L.ordreDeNuit(vs, 1, L.nuitDesAmbigus(e, 1));
    const g = ordre.find(x => x.roleCle === "garde-du-pont");
    assert.deepEqual([g?.acteurIds, g?.ordre, g?.emprunt], [["b"], 20, true]);
    assert.deepEqual(L.cartesJouables(e).map(c => c.cle), ["pie"], "la carte prise cette nuit");
    assert.ok(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "b", roleCle: "garde-du-pont" }).includes("c"));
    const r = nuit(L, vs, [meute("c"), { acteurId: "b", roleCle: "garde-du-pont", cibles: ["c"] }], { emprunts: L.empruntsDeLaNuit(e, 1) });
    assert.deepEqual(r.morts, [], "la garde empruntée a tenu");
    // La clé de la Gardienne jouée par le Bateleur ferme la porte : même la morsure n'entre pas (une garde ne l'arrêterait pas).
    const avecLouve = [...vs, v("l", "louve")];
    const cle = { b: { ...plat("garde"), cle: "gardienne-des-cles", nom: "Gardienne des clés" } };
    const m = nuit(L, avecLouve, [meute("c"), { acteurId: "l", roleCle: "louve-mere", cibles: ["c"] }, { acteurId: "b", roleCle: "gardienne-des-cles", cibles: ["c"], effet: "proteger" }],
      { emprunts: cle });
    assert.ok(!m.changements.some(c => c.type === "camp"), "la porte fermée arrête la morsure");
    assert.deepEqual(L.ordreDeNuit(vs, 2, L.nuitDesAmbigus(e, 2)).map(x => x.roleCle).includes("garde-du-pont"), false, "une nuit seulement");
  },
  // ------------------------------------------------------------ le Mâtin
  "Mâtin : la première nuit, juste avant la meute ; il se désigne lui-même ; loup, il compte dans la meute": L => {
    const vs = [v("a", "loup"), v("b", "matin"), v("c", "affame"), v("d")];
    const o = L.ordreDeNuit(vs, 1).map(x => x.roleCle);
    assert.ok(o.indexOf("matin") < o.indexOf("meute"));
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs), acteurId: "b", roleCle: "matin" }), ["b"]);
    const loup = vs.map(x => (x.id === "b" ? { ...x, camp: "meute" } : x));
    assert.ok(L.ordreDeNuit(loup, 1).find(x => x.roleCle === "meute").acteurIds.includes("b"));
    assert.equal(L.meuteEntiere(mort(loup, "b")), false, "le Loup affamé perd sa faim");
  },
  // ------------------------------------------------------------ l'Enfant des bois
  "Enfant des bois : son modèle tombé, il rejoint la meute (pas s'il est mort, ni déjà loup)": L => {
    const vs = [v("a", "loup"), v("b", "enfant"), v("c"), v("d")];
    const e = etatDe(L, vs, { ambigusSecret: { modeles: { b: "c" } } });
    assert.deepEqual(L.enfantsOrphelins(e, mort(vs, "c"), "c"), ["b"]);
    assert.deepEqual(L.enfantsOrphelins(e, mort(vs, "d"), "d"), []);
    assert.deepEqual(L.enfantsOrphelins(e, mort(vs, "c", "b"), "c"), [], "mort lui aussi");
    assert.deepEqual(L.enfantsOrphelins(e, mort(vs, "c").map(x => (x.id === "b" ? { ...x, camp: "meute" } : x)), "c"), [], "déjà loup (mordu)");
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs), acteurId: "b", roleCle: "enfant-des-bois" }).includes("c"), true);
  },
  // ------------------------------------------------------------ la Chambrière
  "Chambrière : vivante, pas amoureuse, pas condamnée, avec la sagesse ; le rôle repris remis à neuf, sa première nuit la suivante": L => {
    const vs = [v("a", "loup"), v("b", "chambriere"), v("c", "entremetteuse"), v("d")];
    assert.equal(L.chambriereDisponible(vs, ["c"]), "b");
    assert.equal(L.chambriereDisponible(vs.map(x => (x.id === "b" ? { ...x, amoureux: "d" } : x)), ["c"]), "", "amoureuse");
    assert.equal(L.chambriereDisponible(vs, ["b"]), "", "condamnée elle-même");
    assert.equal(L.chambriereDisponible(vs, ["c"], { sansPouvoirs: true }), "", "la sagesse perdue");
    const f = L.ficheDeLaChambriere({ camp: "village", amoureux: "", role: carte("chambriere") }, carte("entremetteuse"), { tour: 2 });
    assert.deepEqual([f.role.system.cle, f.camp, f.role.system.nuit.debut], ["entremetteuse", "village", 3]);
    assert.equal(L.seReveille(f.role.system, 3), true, "sa première nuit : la nuit qui suit");
    assert.equal(L.seReveille(f.role.system, 1), false);
    const mordue = L.ficheDeLaChambriere({ camp: "meute", amoureux: "", role: carte("chambriere") }, carte("garde"), { tour: 2 });
    assert.equal(mordue.camp, "meute", "infectée, elle le reste");
    const herbo = { ...carte("herbo"), system: { ...carte("herbo").system, usages: { max: 2, restant: 1 } } };
    assert.equal(L.ficheDeLaChambriere({ camp: "village", role: carte("chambriere") }, herbo, { tour: 2 }).role.system.usages.restant, 2, "fioles pleines");
  },
  "Chambrière : le dévouement est public, sa charge de Bailli tombe, son charme aussi ; les gestes du condamné ne jouent pas": L => {
    const vs = [v("a", "loup"), v("b", "chambriere"), v("c", "braco"), v("d")];
    const e = etatDe(L, vs, { phase: "vote", bailli: { actif: true, acteurId: "b" }, ambigusSecret: { charmes: ["b", "d"] } });
    const x = L.devouer(e, { chambriere: "b", de: "c" });
    assert.equal(x.bailli, true);
    assert.equal(x.etat.bailli.acteurId, "");
    assert.deepEqual(x.etat.ambigusSecret.charmes, ["d"]);
    assert.equal(L.carteReprise(x.etat, "c"), true);
    const apres = L.ajouterMort(x.etat, { acteurId: "c", cause: "vote" });
    assert.deepEqual(L.gestesEnAttente(apres, mort(vs, "c")), [], "la Braconnière n'emporte personne");
    const sans = etatDe(L, vs, { phase: "vote" });
    assert.deepEqual(L.gestesEnAttente(L.ajouterMort(sans, { acteurId: "c", cause: "vote" }), mort(vs, "c")).map(g => g.acteurId), ["c"], "sans dévouement, si");
    assert.deepEqual(L.separerEtat(x.etat).public.ambigus.devouements, [{ acteurId: "b", de: "c", tour: 1 }]);
  },
  // ------------------------------------------------------------ le Feu follet
  "Feu follet : la veillée commence par un jour ; éliminé au premier tour, il gagne seul ; après, plus rien": L => {
    assert.equal(L.commenceParLeJour(["feu-follet", "villageois"]), true);
    const vs = [v("a", "loup"), v("b", "feu"), v("c"), v("d"), v("e")];
    const gagne = morts => L.verifierVictoire({ villageois: mort(vs, "b"), morts });
    assert.equal(gagne([{ acteurId: "b", tour: 0, phase: "vote", cause: "vote" }]), "b", "le premier vote");
    assert.equal(gagne([{ acteurId: "b", tour: 1, phase: "aube", cause: "meute" }]), "b", "la meute, la première nuit");
    assert.equal(gagne([{ acteurId: "b", tour: 1, phase: "aube", cause: "poison" }]), "b", "le poison, la première nuit");
    assert.equal(gagne([{ acteurId: "b", tour: 1, phase: "vote", cause: "vote" }]), "", "le vote du jour 1 : trop tard");
    assert.equal(gagne([{ acteurId: "b", tour: 2, phase: "aube", cause: "meute" }]), "", "la deuxième nuit : trop tard");
    assert.equal(gagne([{ acteurId: "b", tour: 1, phase: "aube", cause: "nuit" }]), "", "le harpon ne compte pas");
    assert.equal(gagne([{ acteurId: "b", tour: 1, phase: "jour", cause: "meute" }]), "", "le jour 1 n'est plus le premier tour");
    const e = L.normaliserEtat({ ...L.etatInitial(), partie: "p", ambigus: { commenceParLeJour: true } });
    assert.equal(L.etapeSuivante(L.separerEtat(e).public, null, { villageois: vs }).cle, "debat");
    assert.equal(L.etapeSuivante(L.separerEtat({ ...e, ambigus: {} }).public, null, { villageois: vs }).cle, "nuit");
  },
  // ------------------------------------------------------------ le Joueur de vielle
  "Joueur de vielle : deux nouveaux charmés (jamais lui), puis les charmés ensemble ; mordu, plus rien": L => {
    const vs = [v("a", "loup"), v("b", "vielle"), v("c"), v("d"), v("e")];
    const e = etatDe(L, vs, { ambigusSecret: { charmes: ["c"] } });
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "b", roleCle: "joueur-de-vielle" }).sort(), ["a", "d", "e"]);
    assert.deepEqual(L.charmer(structuredClone(e), ["d", "e"]).ambigusSecret.charmes, ["c", "d", "e"]);
    const o = L.ordreDeNuit(vs, 1, L.nuitDesAmbigus(e, 1));
    const ch = o.find(x => x.roleCle === "charmes");
    assert.deepEqual([ch?.acteurIds, ch?.ordre], [["c"], 81]);
    assert.ok(o.findIndex(x => x.roleCle === "joueur-de-vielle") < o.findIndex(x => x.roleCle === "charmes"));
    assert.deepEqual(nuit(L, vs, [{ acteurId: "c", roleCle: "charmes", cibles: [] }]).narrateur, [], "le réveil des charmés : rien à arbitrer");
    const mordu = vs.map(x => (x.id === "b" ? { ...x, camp: "meute" } : x));
    const o2 = L.ordreDeNuit(mordu, 1, L.nuitDesAmbigus(e, 1)).map(x => x.roleCle);
    assert.ok(!o2.includes("joueur-de-vielle") && !o2.includes("charmes"), "devenu loup simple");
  },
  "Joueur de vielle : il gagne quand tous les autres vivants sont charmés, pas devenu loup ; les morts ne comptent pas": L => {
    const vs = [v("a", "loup"), v("b", "vielle"), v("c"), v("d")];
    assert.equal(L.verifierVictoire({ villageois: vs, charmes: ["a", "c", "d"] }), "b");
    assert.equal(L.verifierVictoire({ villageois: vs, charmes: ["a", "c"] }), "");
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "d"), charmes: ["a", "c"] }), "b", "le dernier non charmé est tombé");
    assert.equal(L.verifierVictoire({ villageois: vs.map(x => (x.id === "b" ? { ...x, camp: "meute" } : x)), charmes: ["a", "c", "d"] }), "meute", "mordu : loup simple");
  },
  // ------------------------------------------------------------ l'Illuminé
  "Illuminé : le village partagé par la rive (la parité à défaut) ; vivant, il gagne quand l'autre groupe est éliminé": L => {
    const vs = [v("a", "loup"), v("b", "illumine"), v("c"), v("x"), v("y")];
    assert.deepEqual(L.partagerLeVillage(vs), { critere: "rive", a: ["a", "b", "c"], b: ["x", "y"] });
    assert.equal(L.partagerLeVillage([v("a"), v("b"), v("c")]).critere, "parite", "pas d'autre rive");
    const groupes = L.partagerLeVillage(vs);
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "x", "y"), groupes }), "b");
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "x"), groupes }), "");
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "x", "y", "b"), groupes }), "meute", "mort, rien");
  },
  // ------------------------------------------------------------ le Loup pâle
  "Loup pâle : une nuit sur deux, après la meute et avant la Louve mère ; il ne vise que les loups ; une attaque de loup": L => {
    const vs = [v("a", "loup"), v("p", "pale"), v("l", "louve"), v("c", "garde"), v("d"), v("e")];
    assert.ok(!L.ordreDeNuit(vs, 1).some(x => x.roleCle === "loup-pale"));
    const o = L.ordreDeNuit(vs, 2).map(x => x.roleCle);
    assert.deepEqual(o.slice(o.indexOf("meute"), o.indexOf("meute") + 3), ["meute", "loup-pale", "louve-mere"]);
    assert.ok(L.ordreDeNuit(vs, 2).find(x => x.roleCle === "meute").acteurIds.includes("p"), "il chasse avec la meute");
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs, { tour: 2 }), acteurId: "p", roleCle: "loup-pale" }).sort(), ["a", "l"]);
    const tue = nuit(L, vs, [{ acteurId: "p", roleCle: "loup-pale", cibles: ["a"] }], { tour: 2 });
    assert.deepEqual(tue.deces, [{ acteurId: "a", cause: "meute" }]);
    assert.deepEqual(nuit(L, vs, [{ acteurId: "p", roleCle: "loup-pale", cibles: ["d"] }], { tour: 2 }).morts, [], "pas un villageois");
    assert.deepEqual(nuit(L, vs, [{ acteurId: "p", roleCle: "loup-pale", cibles: ["a"] }, { acteurId: "c", roleCle: "garde-du-pont", cibles: ["a"] }], { tour: 2 }).morts, [], "la garde");
    assert.deepEqual(L.proiesDeLaNuit({ villageois: vs, actions: [{ acteurId: "p", roleCle: "loup-pale", cibles: ["a"] }] }).proies, ["a"], "l'Herboriste l'apprend");
  },
  "Loup pâle : il gagne seul en dernier vivant ; jamais avec la meute": L => {
    const vs = [v("a", "loup"), v("p", "pale"), v("c"), v("d")];
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "a", "c", "d") }), "p");
    assert.equal(L.verifierVictoire({ villageois: mort(vs, "c") }), "meute");
    const bilan = L.bilanDePartie({ villageois: mort(vs, "c"), vainqueur: "meute" });
    assert.deepEqual(bilan.filter(l => l.gagnant).map(l => l.id), ["a"]);
  },
  // ------------------------------------------------------------ l'état
  "état : les ambigus publics, leurs secrets jamais dans l'état public": L => {
    const e = L.normaliserEtat({ ...L.etatInitial(), partie: "p", ambigus: { bateleur: [{ cle: "pie", nom: "Pie" }], commenceParLeJour: true },
      ambigusSecret: { centre: [carte("loup")], charmes: ["c"], modeles: { b: "c" }, matins: { m: "meute" } } });
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.ambigusSecret, L.ambigusSecretInitial());
    assert.ok(!JSON.stringify(pub).includes("loup-de-brumecombe"));
    assert.deepEqual(pub.ambigus.bateleur, [{ cle: "pie", nom: "Pie", img: "" }]);
    assert.deepEqual(L.fusionnerEtat(pub, secret).ambigusSecret.charmes, ["c"]);
  },
  // ------------------------------------------------------------ le générateur et le contenu
  "générateur : avec le Chapardeur, la composition le signale (deux cartes au centre, ajoutées à la distribution) ; jamais à la petite tablée": L => {
    const eq = { roles: Object.fromEntries(Object.entries(EQUILIBRE).filter(([, r]) => !r.surDemande)), batiments: { puits: { niveau: "debutants" } } };
    const c = L.composer(12, eq, { niveau: "chaos", inclure: ["chapardeur"], graine: "centre", essais: 40 });
    assert.equal(c.roles.length, 12, "ses n rôles");
    assert.equal(c.centre, 2);
    assert.equal(c.somme, L.equilibreDe(c.roles, eq));
    assert.equal(L.composer(12, eq, { niveau: "chaos", exclure: ["chapardeur"], graine: "sans", essais: 40 }).centre, undefined);
    for (let g = 0; g < 10; g++) assert.ok(!L.composer(10, eq, { niveau: "petite-tablee", graine: `t${g}`, essais: 40 }).roles.some(r => ROLES_DU_PACTE_3B.includes(r)));
  },
  "contenu : les neuf rôles, leurs effets, leurs victoires, leurs ordres, leur équilibre et leurs jetons": () => {
    const parCle = Object.fromEntries(ROLES.map(r => [r.system.cle, r]));
    const attendu = { chapardeur: ["village", "chaparder", "", 1], bateleur: ["village", "emprunter", "", 2], matin: ["village", "choisir-camp", "", 38],
      "enfant-des-bois": ["village", "modele", "", 13], chambriere: ["village", "devouement", "", 0], "feu-follet": ["solitaire", "", "premier-tour", 0],
      "joueur-de-vielle": ["solitaire", "charmer", "tous-charmes", 80], illumine: ["solitaire", "", "autre-groupe", 0], "loup-pale": ["meute", "trahir", "seul-survivant", 41] };
    assert.deepEqual(Object.keys(attendu).sort(), [...ROLES_DU_PACTE_3B].sort());
    for (const [cle, [camp, effet, victoire, ordre]] of Object.entries(attendu)) {
      const r = parCle[cle];
      assert.ok(r, cle);
      assert.deepEqual([r.system.camp, r.system.effet, r.system.victoireCle, r.system.nuit.actif ? r.system.nuit.ordre : 0], [camp, effet, victoire, ordre], cle);
      assert.equal(EQUILIBRE[cle]?.camp, camp, `${cle} : équilibre`);
      assert.ok(["classique", "chaos"].includes(EQUILIBRE[cle].niveau), `${cle} : classique ou chaos`);
      assert.ok(JETONS_ROLES[cle], `${cle} : jeton`);
      if (victoire) assert.ok(r.system.victoire, `${cle} : texte de victoire`);
    }
    assert.ok(parCle["loup-pale"].system.nuit.uneNuitSurDeux);
    for (const cle of ["chapardeur", "matin", "enfant-des-bois"]) assert.ok(parCle[cle].system.nuit.premiereNuitSeulement, cle);
    assert.ok(parCle.matin.system.nuit.soiMeme);
    assert.equal(parCle["joueur-de-vielle"].system.nuit.cibles, 2);
    assert.equal(AMBIGUS_DU_PACTE.length + SOLITAIRES_DU_PACTE.length, 8);
    const ordre = ordreDeReveil().map(e => e.o);
    for (const o of [1, 2, 13, 38, 41, 80]) assert.ok(ordre.includes(o), `ordre ${o} au guide`);
    assert.ok(ordre.indexOf(80) < ordre.indexOf(90), "le Fossoyeur reste le dernier");
  }
};

const MUTATIONS = [
  ["ambigus.mjs", "  if (!paquetDuChapardeur(cles)) return [];\n", "", "Chapardeur : seulement avec lui"],
  ["ambigus.mjs", "centre.every(r => (r?.system?.camp ?? r?.camp) === \"meute\")", "centre.some(r => (r?.system?.camp ?? r?.camp) === \"meute\")", "Chapardeur : obligé si DEUX loups"],
  ["ambigus.mjs", "  nouveau[i] = copie(sienne);\n", "", "Chapardeur : sa carte au centre"],
  ["ambigus.mjs", "  if (u && Number(u.max) > 0) r.system.usages = { ...u, restant: Number(u.max) };\n", "", "remis à neuf : les usages"],
  ["ambigus.mjs", "  if (r.system.nuit?.premiereNuitSeulement && debut > 1) r.system.nuit = { ...r.system.nuit, debut };\n", "", "remis à neuf : la première nuit"],
  ["nuit.mjs", "n.premiereNuitSeulement && Number(n.debut) > 1 ? numero - Number(n.debut) + 1 : numero", "numero", "première nuit : celle du porteur"],
  ["ambigus.mjs", "r.camp === \"village\" && r.nuit?.actif && !r.groupe", "r.nuit?.actif && !r.groupe", "Bateleur : jamais de loup"],
  ["ambigus.mjs", "!r.nuit.premiereNuitSeulement && ", "", "Bateleur : pas de première nuit seulement"],
  ["ambigus.mjs", "r?.cle && !pris.has(r.cle)", "r?.cle", "Bateleur : pas au paquet"],
  ["nuit.mjs", "    ajouter(etapes, role, id, { emprunt: true });\n", "", "Bateleur : réveillé pour sa carte"],
  ["resolution.mjs", "    const acteur = emprunt ? { ...porteur, role: emprunt } : porteur;", "    const acteur = porteur;", "Bateleur : résolu avec la carte"],
  ["ambigus.mjs", "...Object.values(normaliserAmbigusSecret(etat?.ambigusSecret).emprunts).map(e => e.cle)", "", "Bateleur : une carte prise n'est plus jouable"],
  ["jour.mjs", "    if (role.effet === EFFET_MATIN) return ids.includes(acteurId) ? [acteurId] : [];\n", "", "Mâtin : se désigner"],
  ["ambigus.mjs", " && m[v.id] === mortId && v.camp !== \"meute\"", " && m[v.id] === mortId", "Enfant des bois : pas déjà loup"],
  ["ambigus.mjs", "return villageois.filter(v => vivant(v) && v.id !== mortId && m[v.id]", "return villageois.filter(v => v.id !== mortId && m[v.id]", "Enfant des bois : vivant"],
  ["ambigus.mjs", " && !v.amoureux && !vises.has(v.id)", " && !vises.has(v.id)", "Chambrière : pas amoureuse"],
  ["ambigus.mjs", "  return { ...sienne, role: neuf, camp: infectee ? \"meute\" : neuf?.system?.camp ?? \"village\", amoureux: \"\" };", "  return { ...sienne, role: neuf, camp: neuf?.system?.camp ?? \"village\", amoureux: \"\" };", "Chambrière : l'infection reste"],
  ["ambigus.mjs", "  if (bailli) etat.bailli = { ...etat.bailli, acteurId: \"\", succession: null };\n", "", "Chambrière : la charge perdue"],
  ["ambigus.mjs", "  s.charmes = s.charmes.filter(id => id !== chambriere);\n", "", "Chambrière : le charme perdu"],
  ["derniers-gestes.mjs", " && !carteReprise(etat, m.acteurId)", "", "Chambrière : les gestes du condamné"],
  ["ambigus.mjs", "  if (!m || !(m.cause in CAUSES_DU_PREMIER_TOUR) || m.tour !== CAUSES_DU_PREMIER_TOUR[m.cause]) return false;", "  if (!m || !(m.cause in CAUSES_DU_PREMIER_TOUR)) return false;", "Feu follet : le premier tour"],
  ["ambigus.mjs", "  return m.cause === \"vote\" || !", "  return true || !", "Feu follet : la nuit, pas le vote du jour 1"],
  ["victoire.mjs", "    if (cle === VICTOIRE_FEU_FOLLET && feuFolletGagne(v, morts)) return v.id;\n", "", "Feu follet : sa victoire"],
  ["etapes.mjs", "normaliserAmbigus(etat.ambigus).commenceParLeJour ? etape(\"debat\", \"phase\", { phase: \"jour\" }) : ", "", "Feu follet : le jour d'abord"],
  ["ambigus.mjs", "export const candidatsDuCharme = (ids = [], vielleId, charmes = []) => ids.filter(id => id !== vielleId && !charmes.includes(id));", "export const candidatsDuCharme = (ids = []) => ids;", "Vielle : de nouveaux charmés"],
  ["nuit.mjs", "    if (role.effet === EFFET_VIELLE && v.camp === \"meute\") continue;\n", "", "Vielle : mordue, loup simple"],
  ["nuit.mjs", "  if (charmesDeLaNuit.length) etapes.set(", "  if (false) etapes.set(", "Vielle : le réveil des charmés"],
  ["resolution.mjs", "    if (a.roleCle === CLE_CHARMES) continue;\n", "", "Vielle : le réveil des charmés, rien à résoudre"],
  ["ambigus.mjs", "if (cle === VICTOIRE_VIELLE && v.camp === \"solitaire\" && ", "if (cle === VICTOIRE_VIELLE && ", "Vielle : pas devenue loup"],
  ["ambigus.mjs", "vivants.every(x => x.id === v.id || charmes.includes(x.id))", "vivants.some(x => x.id !== v.id && charmes.includes(x.id))", "Vielle : TOUS charmés"],
  ["ambigus.mjs", "    if (a.length && b.length) return { critere, a, b };", "    return { critere, a, b };", "Illuminé : deux groupes non vides"],
  ["ambigus.mjs", "if (autre.length && autre.every(id => parId.get(id)?.vivant === false)) return v.id;", "if (autre.length && autre.some(id => parId.get(id)?.vivant === false)) return v.id;", "Illuminé : tout l'autre groupe"],
  ["jour.mjs", "    if (role.effet === EFFET_LOUP_PALE) ids = ids.filter(id => id !== acteurId && parId.get(id)?.camp === \"meute\");\n", "", "Loup pâle : seulement des loups"],
  ["resolution.mjs", "if (c && c !== a.acteurId && parId.get(c)?.camp === \"meute\") attaques.push(", "if (c && c !== a.acteurId) attaques.push(", "Loup pâle : un loup seulement, à l'aube"],
  ["resolution.mjs", "{ cible: c, cause: CAUSES.meute, meute: true, loup: a.acteurId, pale: true }", "{ cible: c, cause: CAUSES.meute, traverse: true, loup: a.acteurId, pale: true }", "Loup pâle : une attaque de loup (la garde)"],
  ["resolution.mjs", "[\"tuer\", EFFET_LOUP_PALE].includes(role(a)?.effet)", "role(a)?.effet === \"tuer\"", "Loup pâle : sa proie apprise"],
  ["ambigus.mjs", "    if (cle === VICTOIRE_LOUP_PALE && vivants.length === 1) return v.id;\n", "", "Loup pâle : dernier vivant"],
  ["victoire.mjs", "    for (const v of villageois) if (pale(v)) gagnants.delete(v.id);\n", "", "Loup pâle : jamais avec la meute"],
  ["etat.mjs", "  pub.ambigusSecret = ambigusSecretInitial();", "", "état : les secrets des ambigus"],
  ["composition.mjs", "...(centre.length ? { centre: CARTES_DU_CENTRE } : {})", "...{}", "générateur : le centre signalé"],
  ["composition.mjs", "  \"chapardeur\", \"bateleur\", \"matin\", \"enfant-des-bois\", \"chambriere\", \"feu-follet\", \"joueur-de-vielle\", \"illumine\", \"loup-pale\"];", "];", "générateur : pas à la petite tablée"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-ambigus-"));
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
    try { verifier(L); } catch (e) { liste.push({ nom, e }); }
  }
  return liste;
}

test("Pacte, étape 3b (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 3b (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
