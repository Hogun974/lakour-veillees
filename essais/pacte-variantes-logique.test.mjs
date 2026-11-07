// Le Pacte, étape 5 (logique pure) : l'ordre d'appel du livre (les ordres de nuit du contenu), le mode « Le Pacte » (le générateur ne
// tire que les rôles du livre, à ±2, sans bâtiment ; ses compositions prêtes), et les variantes du jeu de soirée — leurs exclusions, la
// Veillée aux chandelles (angoissante : plus d'une chandelle, pas de victime), la Chaîne des innocents (du voisin de gauche du dernier
// éliminé au dernier debout), le Mur des murmures (des phrases sans auteur, mêlées), Double visage (paquets, allégeances, deux cartes, la
// Liseuse qui lit les cartes secrètes, la seconde carte qui se réveille et agit), les Vendanges (un loup de plus, la meute chez un voisin
// d'un loup, la Liseuse et ses trois rôles mêlés, l'Enfant qui épie l'Herboriste, la fiole unique et son sort, le triangle de
// l'Entremetteuse, les votes que l'amour interdit, le Souffre-douleur à la place d'un voisin, le Garde et la Braconnière à leurs voisins),
// l'Envoûtement (pas de mort, des envoûtés ; la meute gagne à l'avant-dernier). Chaque règle est cassée à son tour dans une copie de la
// logique, et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { GUIDES, ORDRE_D_APPEL } from "../modules/lakour-veillees/contenu/guides.mjs";
import { compositions } from "../modules/lakour-veillees/contenu/compositions.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));
const EQ = { roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS };

const sansNuit = { actif: false, cibles: 0 };
const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 } },
  affame: { cle: "loup-affame", nom: "Loup affamé", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 44, cibles: 1, tantQueMeuteEntiere: true } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse de cendres", camp: "village", effet: "voir-role", nuit: { actif: true, ordre: 4, cibles: 1 } },
  herbo: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true }, usages: { max: 2, restant: 2 } },
  garde: { cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1, soiMeme: true } },
  enfant: { cle: "enfant-de-la-brume", nom: "Enfant de la brume", camp: "village", effet: "epier", nuit: { actif: true, ordre: 41, cibles: 1, soiMeme: true } },
  entremetteuse: { cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour", nuit: { actif: true, ordre: 3, cibles: 2, soiMeme: true, premiereNuitSeulement: true } },
  chapardeur: { cle: "chapardeur", nom: "Chapardeur", camp: "village", effet: "chaparder", nuit: { actif: true, ordre: 1, cibles: 1, premiereNuitSeulement: true } },
  vielle: { cle: "joueur-de-vielle", nom: "Joueur de vielle", camp: "solitaire", effet: "charmer", nuit: { actif: true, ordre: 80, cibles: 2 } },
  aieul: { cle: "aieul", nom: "Aïeul", camp: "village", effet: "resister", nuit: sansNuit },
  bouc: { cle: "souffre-douleur", nom: "Souffre-douleur", camp: "village", effet: "egalite", nuit: sansNuit },
  braco: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: sansNuit },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: sansNuit }
};
const plat = cle => ({ usages: { max: 0, restant: 0 }, apparence: "", ...structuredClone(ROLE[cle]) });
// Huit places, a à h dans l'ordre des maisons (le cercle).
const MAISONS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
const v = (id, role = "villageois", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${MAISONS[id]}`,
  silence: false, amoureux: "", protections: 0, role: plat(role), ...extra });
const etatDe = (L, vs, extra = {}) => L.normaliserEtat({ ...L.fixerCercle({ ...L.etatInitial(), partie: "p", phase: "nuit", tour: 1 }, vs), ...extra });
const nuit = (L, vs, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: 1, hasard: () => 0, cercle: L.ordreDesPlaces(vs), ...extra });
const meute = (cible, par = "a") => ({ acteurId: par, roleCle: "meute", cibles: [cible] });
const textes = (r, id) => r.messages.filter(m => m.destinataire === id).map(m => m.texte).join(" | ");

const VERIFICATIONS = {
  // ------------------------------------------------------------ l'ordre d'appel du livre
  "ordre d'appel : les rôles du livre dans l'ordre du jeu de soirée, la première nuit et chaque nuit": () => {
    const ordre = Object.fromEntries(ROLES.filter(r => r.system.nuit.actif).map(r => [r.system.cle, r.system.nuit.ordre]));
    const premiere = ["chapardeur", "bateleur", "entremetteuse", "liseuse-de-cendres", "furet", "lavandiere", "bucheron", "enfant-des-bois", "pie", "incendiaire",
      "garde-du-pont", "matin", "loup-de-brumecombe", "enfant-de-la-brume", "louve-mere", "loup-affame", "herboriste", "joueur-de-vielle"];
    const chaque = ["bateleur", "liseuse-de-cendres", "furet", "pie", "incendiaire", "garde-du-pont", "loup-de-brumecombe", "enfant-de-la-brume", "loup-pale", "louve-mere",
      "loup-affame", "herboriste", "joueur-de-vielle"];
    for (const liste of [premiere, chaque]) {
      for (let i = 1; i < liste.length; i++) assert.ok(ordre[liste[i - 1]] < ordre[liste[i]], `${liste[i - 1]} (${ordre[liste[i - 1]]}) avant ${liste[i]} (${ordre[liste[i]]})`);
    }
    assert.equal(ordre["loup-de-brumecombe"], 40, "la meute à 40");
    assert.ok(Math.max(...Object.values(ordre)) === ordre.fossoyeur, "le Fossoyeur reste le dernier");
    assert.ok(ORDRE_D_APPEL.premiere.length >= 20 && ORDRE_D_APPEL.chaque.length >= 15);
    const page = GUIDES.find(j => j.__cle === "journaux:guide-du-narrateur").pages.find(p => p.name === "Mener la nuit")?.text.content ?? "";
    assert.ok(page.includes("ordre d'appel des veillées d'autrefois"), "le guide du narrateur le dit");
  },

  // ------------------------------------------------------------ le mode « Le Pacte »
  "Le Pacte : seulement les rôles du livre, à ±2, sans bâtiment ; l'Incendiaire avec Le Village ; ses compositions prêtes": L => {
    assert.ok(L.NIVEAUX.includes(L.NIVEAU_LE_PACTE));
    assert.equal(L.NIVEAUX.at(-1), L.NIVEAU_PETITE_TABLEE, "la petite tablée reste la dernière");
    for (let n = 6; n <= 18; n++) for (let g = 0; g < 4; g++) {
      const c = L.composer(n, EQ, { niveau: L.NIVEAU_LE_PACTE, graine: `p/${n}/${g}`, essais: 600 });
      assert.ok(c.roles.every(L.estDuLivre), `${n}/${g} : ${c.roles.filter(r => !L.estDuLivre(r))}`);
      assert.ok(Math.abs(c.somme) <= 2, `${n}/${g} : équilibre ${c.somme}`);
      assert.deepEqual(c.batiments, [], "aucun bâtiment communal");
      assert.equal(c.roles.filter(r => EQUILIBRE[r].camp === "meute").length, L.nombreDeLoups(n));
      assert.ok(!c.roles.includes("incendiaire"), "l'Incendiaire seulement avec Le Village");
    }
    for (const cle of ["sourcier", "loup-deguise", "pyromane", "fossoyeur", "colporteur"]) assert.ok(!L.estDuLivre(cle), `${cle} : une création des Veillées`);
    const avec = Array.from({ length: 30 }, (_, g) => L.composer(12, EQ, { niveau: L.NIVEAU_LE_PACTE, graine: `v/${g}`, village: true, essais: 300 }).roles);
    assert.ok(avec.some(r => r.includes("incendiaire")), "l'Incendiaire sort avec Le Village");
    const pretes = Object.entries(compositions()).filter(([, c]) => c.niveau === L.NIVEAU_LE_PACTE);
    assert.equal(pretes.length, 13, "de 6 à 18 joueurs");
    for (const [cle, c] of pretes) {
      assert.ok(c.roles.every(L.estDuLivre), cle);
      assert.deepEqual(c.batiments, [], cle);
    }
  },

  // ------------------------------------------------------------ les exclusions
  "variantes permises : ni à la Saint-Martin ; à la petite tablée ou en peste, ni Double visage, ni Vendanges, ni Envoûtement": L => {
    const toutes = { chandelles: true, angoissante: true, chaine: true, mur: true, doubleVisage: "grande", allegeanceLoup: true, vendanges: true, envoutement: true };
    assert.deepEqual(L.variantesPermises(toutes, { places: 9 }), toutes);
    assert.deepEqual(L.variantesPermises(toutes, { saintMartin: true }), L.choixDesVariantes());
    const tablee = L.variantesPermises(toutes, { tablee: true, places: 8 });
    assert.deepEqual([tablee.doubleVisage, tablee.vendanges, tablee.envoutement, tablee.chandelles, tablee.chaine, tablee.mur], ["", false, false, true, true, true]);
    const peste = L.variantesPermises(toutes, { peste: true, places: 8 });
    assert.deepEqual([peste.doubleVisage, peste.vendanges, peste.envoutement], ["", false, false]);
    assert.equal(L.variantesPermises(toutes, { places: 6 }).doubleVisage, "", "Double visage : 7 joueurs au moins");
    assert.equal(L.variantesPermises(toutes, { places: 19 }).doubleVisage, "", "18 au plus");
    assert.equal(L.choixDesVariantes({ angoissante: true }).angoissante, false, "angoissante : seulement avec les chandelles");
    assert.ok(L.sansPeste({ vendanges: true }) && L.sansPeste({ doubleVisage: "petite" }) && !L.sansPeste({ chandelles: true, mur: true, chaine: true }));
    assert.equal(L.composer(10, EQ, { graine: "vendanges", loupsEnPlus: 1, essais: 300 }).roles.filter(r => EQUILIBRE[r].camp === "meute").length, L.nombreDeLoups(10) + 1,
      "les Vendanges : un loup de plus");
  },

  // ------------------------------------------------------------ la Veillée aux chandelles
  "chandelles : les loups d'accord, une victime ; en désaccord, aucune, et les chandelles éteintes au matin": L => {
    assert.deepEqual(L.chandellesSoufflees([{ cible: "c" }, { cible: "c" }, { cible: "" }]), { ids: ["c"], cible: "c" });
    assert.deepEqual(L.chandellesSoufflees([{ cible: "c" }, { cible: "d" }]), { ids: ["c", "d"], cible: "" });
    const e = L.normaliserEtat({ ...L.etatInitial(), partie: "p", tour: 2, variantes: { chandelles: true, angoissante: true } });
    L.noterLesSouffles(e, { tour: 2, ids: ["c", "d"] });
    assert.deepEqual(L.chandellesDuMatin(e, 2), ["c", "d"]);
    assert.equal(L.normaliserVariantesSecret(e.variantesSecret).souffles, null, "les souffles oubliés");
    assert.deepEqual(L.normaliserVariantes(e.variantes).ratees, [{ tour: 2, ids: ["c", "d"] }], "publiques au matin");
    L.noterLesSouffles(e, { tour: 3, ids: ["c"] });
    assert.deepEqual(L.chandellesDuMatin(e, 3), [], "une seule chandelle : rien à dire");
    assert.deepEqual(L.etatPublic(e).variantesSecret, L.variantesSecretInitial(), "les souffles restent au MJ");
  },

  // ------------------------------------------------------------ la Chaîne des innocents
  "chaîne : du voisin de gauche du dernier éliminé jusqu'au dernier debout, condamné ; chacun à son tour": L => {
    const vs = ["a", "b", "c", "d", "e"].map(id => v(id));
    const e = etatDe(L, vs, { phase: "vote", morts: [{ acteurId: "c", tour: 1, cause: "meute" }] });
    const morts = vs.map(x => (x.id === "c" ? { ...x, vivant: false } : x));
    const debout = ["a", "b", "d", "e"];
    assert.equal(L.premierDeLaChaine(e, morts, debout), "b", "le voisin de gauche du dernier éliminé");
    assert.equal(L.premierDeLaChaine(L.normaliserEtat({ ...e, morts: [] }), morts, debout), "a", "sans mort : la première place");
    assert.equal(L.premierDeLaChaine(L.normaliserEtat({ ...e, morts: [], bailli: { actif: true, acteurId: "d" } }), morts, debout), "d", "sans mort : le Bailli");
    const x = L.ouvrirVote(e, { candidats: debout, objet: "execution" });
    L.ouvrirLaChaine(x, { debout, premier: "b" });
    assert.deepEqual(L.candidatsDeLaChaine(L.chaineEnCours(x)), ["a", "d", "e"], "lui excepté");
    assert.equal(L.designerDansLaChaine(x, { par: "a", cible: "d" }).raison, "tour", "pas son tour");
    assert.equal(L.designerDansLaChaine(x, { par: "b", cible: "b" }).raison, "cible", "pas lui-même");
    assert.ok(L.designerDansLaChaine(x, { par: "b", cible: "d" }).ok);
    assert.deepEqual(L.candidatsDeLaChaine(L.chaineEnCours(x)), ["a", "b", "e"], "assis, il désigne parmi les debout");
    assert.ok(L.designerDansLaChaine(x, { par: "d", cible: "b" }).ok);
    const fin = L.designerDansLaChaine(x, { par: "b", cible: "a", hasard: true });
    assert.equal(fin.condamne, "e", "le dernier debout");
    const c = L.cloreLaChaine(x);
    assert.deepEqual([c.resultat.elu, c.resultat.elus, c.resultat.objet, c.etat.vote.ouvert], ["e", ["e"], "execution", false]);
    assert.deepEqual(c.resultat.chaine.assis.map(s => s.id), ["d", "b", "a"]);
    assert.ok(c.resultat.chaine.assis.at(-1).hasard, "le sort noté");
    assert.equal(L.chaineEnCours(c.etat), null);
    assert.deepEqual(L.entreeDeVote(c.resultat).chaine.condamne, "e", "au Registre");
  },

  // ------------------------------------------------------------ le Mur des murmures
  "mur : tous les vivants à la fin de la nuit ; des phrases sans auteur, nettoyées, mêlées, lues au matin": L => {
    const vs = [v("a", "loup"), v("b"), v("c"), v("d", "villageois", { vivant: false })];
    const etape = L.ordreDeNuit(vs, 2, { mur: true }).at(-1);
    assert.deepEqual([etape.roleCle, etape.acteurIds, etape.ordre, etape.cibles], [L.CLE_MUR, ["a", "b", "c"], L.ORDRE_MUR, 0]);
    assert.ok(!L.ordreDeNuit(vs, 2).some(x => x.roleCle === L.CLE_MUR), "sans la variante, pas de mur");
    const e = L.normaliserEtat({ ...L.etatInitial(), partie: "p", tour: 2, variantes: { mur: true } });
    L.graverUnMurmure(e, "<b>Un</b>   loup  dort ici", () => 0);
    L.graverUnMurmure(e, "x".repeat(300), () => 0.99);
    L.graverUnMurmure(e, "   ", () => 0);
    const secret = L.normaliserVariantesSecret(e.variantesSecret).murmures;
    assert.equal(secret.length, 2, "une phrase vide ne compte pas");
    assert.ok(secret.includes("Un loup dort ici"), "sans balises ni blancs");
    assert.ok(secret.every(m => m.length <= L.LONGUEUR_MURMURE));
    assert.ok(!JSON.stringify(e.variantesSecret).includes("acteurId"), "aucun auteur gardé");
    const lus = L.lireLeMur(e, 2, () => 0.5);
    assert.equal(lus.length, 2);
    assert.deepEqual(L.normaliserVariantes(e.variantes).murmures.textes.sort(), [...secret].sort());
    assert.deepEqual(L.normaliserVariantesSecret(e.variantesSecret).murmures, [], "le mur effacé pour la nuit suivante");
    assert.deepEqual(L.etatPublic(L.graverUnMurmure(e, "secret")).variantesSecret.murmures, [], "la nuit, rien de public");
  },

  // ------------------------------------------------------------ Double visage
  "Double visage : les paquets, les allégeances, deux cartes par joueur (la principale, la seconde, le camp)": L => {
    assert.deepEqual(L.paquetDoubleVisage(7), L.VISAGES);
    assert.deepEqual(L.paquetDoubleVisage(9).filter(c => c === "villageois").length, 2, "jusqu'à deux Villageois");
    assert.equal(L.paquetDoubleVisage(18).length, 18, "deux paquets");
    assert.throws(() => L.paquetDoubleVisage(6), /7 à 18/);
    assert.deepEqual([7, 9, 10, 13, 14, 18].map(L.loupsDoubleVisage), [2, 2, 3, 3, 4, 4]);
    const a = L.allegeances(9, () => 0.3);
    assert.deepEqual([a.length, a.filter(x => x === "meute").length], [9, 2]);
    const g = L.cartesDeLaGrande(L.paquetDoubleVisage(8), () => 0.42);
    assert.equal(g.length, 8);
    assert.equal(g.flat().filter(c => c === L.CARTE_LOUP).length, 2, "les cartes de loup mêlées aux autres");
    assert.deepEqual(L.lireDeuxCartes(["herboriste", "liseuse-de-cendres"]), { principale: "herboriste", seconde: "liseuse-de-cendres", camp: "village" });
    assert.deepEqual(L.lireDeuxCartes(["herboriste", "aieul"]), { principale: "aieul", seconde: "herboriste", camp: "village" }, "le passif d'abord");
    assert.deepEqual(L.lireDeuxCartes(["loup-de-brumecombe", "garde-du-pont"]), { principale: "garde-du-pont", seconde: "", camp: "meute" }, "un loup garde son pouvoir");
    assert.deepEqual(L.lireDeuxCartes(["loup-de-brumecombe", "villageois"]), { principale: "loup-de-brumecombe", seconde: "", camp: "meute" });
    assert.deepEqual(L.lireDeuxCartes(["villageois", "villageois"]), { principale: "villageois", seconde: "", camp: "village" });
    assert.deepEqual(L.lireDeuxCartes(["herboriste", "herboriste"]).seconde, "", "deux fois le même pouvoir : un seul");
  },
  // Le Pacte, étape 6c : le réglage « une allégeance loup de plus » (seulement avec Double visage).
  "Double visage : une allégeance loup de plus, en petite et en grande complication, seulement avec la variante": L => {
    assert.deepEqual([7, 9, 10, 13, 14, 18].map(n => L.loupsDoubleVisage(n, true)), [3, 3, 4, 4, 5, 5]);
    const a = L.allegeances(12, () => 0.3, true);
    assert.deepEqual([a.length, a.filter(x => x === "meute").length], [12, 4]);
    const g = L.cartesDeLaGrande(L.paquetDoubleVisage(16), () => 0.42, true);
    assert.equal(g.flat().filter(c => c === L.CARTE_LOUP).length, 5, "cinq cartes de loup à 16 joueurs");
    assert.equal(g.flat().length, 32, "deux cartes par joueur, toujours");
    assert.equal(L.choixDesVariantes({ doubleVisage: "grande", allegeanceLoup: true }).allegeanceLoup, true);
    assert.equal(L.choixDesVariantes({ allegeanceLoup: true }).allegeanceLoup, false, "sans Double visage, rien");
    assert.equal(L.variantesPermises({ doubleVisage: "petite", allegeanceLoup: true }, { places: 6 }).allegeanceLoup, false, "Double visage écarté, le réglage aussi");
    assert.equal(L.allegeanceLoupEnPlus(L.normaliserEtat({ ...L.etatInitial(), variantes: { doubleVisage: "petite", allegeanceLoup: true } })), true);
    assert.ok(L.CLES_DES_VARIANTES.includes("allegeanceLoup") && L.REGLAGES_DES_VARIANTES.allegeanceLoup === "allegeanceLoupEnPlus");
  },
  "Double visage : la Liseuse lit les cartes secrètes ; la seconde carte se réveille, agit et résiste": L => {
    const fiches = { a: { camp: "meute" }, b: { camp: "village" } };
    const petite = L.normaliserEtat({ ...L.etatInitial(), fiches, variantes: { doubleVisage: "petite" } });
    assert.deepEqual(L.visagesPourLaLiseuse(petite, c => `«${c}»`), { a: { nom: "«loup-de-brumecombe»", camp: "meute" }, b: { nom: "«villageois»", camp: "village" } });
    const grande = L.normaliserEtat({ ...petite, variantes: { doubleVisage: "grande" }, variantesSecret: { cartes: { a: ["herboriste", "loup-de-brumecombe"] } } });
    assert.equal(L.visagesPourLaLiseuse(grande, c => c).a.nom, "herboriste + loup-de-brumecombe");
    assert.deepEqual(L.visagesPourLaLiseuse(L.normaliserEtat({ ...petite, variantes: {} })), {}, "hors de la variante, rien");
    // La Liseuse (c) lit a (un Garde d'allégeance loup) : l'allégeance, pas le rôle visible.
    const vs = [v("a", "garde", { camp: "meute" }), v("b"), v("c", "liseuse"), v("d", "herbo", { seconde: plat("liseuse") })];
    const r = nuit(L, vs, [{ acteurId: "c", roleCle: "liseuse-de-cendres", cibles: ["a"] }], { visages: { a: { nom: "Loup de Brumecombe", camp: "meute" } } });
    assert.match(textes(r, "c"), /« Loup de Brumecombe », du camp « meute »/);
    // La seconde carte (d : Herboriste et Liseuse) : un réveil de plus, à son ordre ; son action se résout avec elle.
    const o = L.ordreDeNuit(vs, 2);
    const liseuses = o.find(x => x.roleCle === "liseuse-de-cendres");
    assert.deepEqual(liseuses.acteurIds.sort(), ["c", "d"]);
    assert.ok(o.some(x => x.roleCle === "herboriste" && x.acteurIds.includes("d")));
    const r2 = nuit(L, vs, [{ acteurId: "d", roleCle: "liseuse-de-cendres", cibles: ["b"] }]);
    assert.match(textes(r2, "d"), /Nom-b est « Villageois »/);
    // Une seconde carte d'Aïeul résiste à la meute.
    const vs3 = [v("a", "loup"), v("b", "garde", { seconde: plat("aieul") }), v("c")];
    const r3 = nuit(L, vs3, [meute("b")]);
    assert.deepEqual([r3.morts, r3.aieux], [[], ["b"]]);
    // Une seconde carte de Braconnière : son geste l'attend.
    const vs4 = [v("a", "loup"), v("b", "garde", { seconde: plat("braco") }), v("c")];
    assert.deepEqual(nuit(L, vs4, [meute("b")]).enAttente, [{ acteurId: "b", effet: "emporter" }]);
    // Un Souffre-douleur en seconde carte paie l'égalité.
    assert.equal(L.souffreDouleur(L.etatInitial(), [v("a", "garde", { seconde: plat("bouc") })]), "a");
  },

  // ------------------------------------------------------------ les Vendanges
  "Vendanges : la meute chez un voisin d'un loup ; le Garde à ses voisins ; le Chapardeur sur un joueur ; la tromperie la première nuit": L => {
    const vs = ["a", "b", "c", "d", "e", "f", "g", "h"].map(id => v(id, id === "a" || id === "e" ? "loup" : id === "c" ? "garde" : id === "g" ? "chapardeur" : "villageois"));
    const e = etatDe(L, vs, { variantes: { vendanges: true } });
    assert.deepEqual(L.proiesDesVendanges(e, vs).sort(), ["b", "d", "f", "h"]);
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: e, roleCle: "meute", tour: 1 }).sort(), ["b", "d", "f", "h"]);
    assert.equal(L.candidatsDeNuit({ villageois: vs, etat: L.normaliserEtat({ ...e, variantes: {} }), roleCle: "meute", tour: 1 }).length, 6, "sans la variante, tous");
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "c", roleCle: "garde-du-pont", tour: 1 }).sort(), ["b", "c", "d"]);
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "g", roleCle: "chapardeur", tour: 1 }).length, 7, "un joueur, pas une carte");
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: L.normaliserEtat({ ...e, variantes: {} }), acteurId: "g", roleCle: "chapardeur", tour: 1 }), []);
    const vs2 = [...vs.slice(0, 7), v("h", "entremetteuse")];
    const o = L.ordreDeNuit(vs2, 1, L.nuitDesVariantes(e, 1)).map(x => x.roleCle);
    assert.equal(o.indexOf(L.CLE_TROMPERIE), o.indexOf("entremetteuse") + 1, "juste après l'Entremetteuse");
    assert.ok(!L.ordreDeNuit(vs2, 1).includes?.(L.CLE_TROMPERIE) && !L.ordreDeNuit(vs2, 1).some(x => x.roleCle === L.CLE_TROMPERIE), "sans la variante, non");
    assert.deepEqual(L.voisinsDeLaBraconniere(e, vs.map(x => (x.id === "d" ? { ...x, vivant: false } : x)), "d").sort(), ["c", "e"]);
    assert.deepEqual(L.candidatsDuGeste(vs.map(x => (x.id === "d" ? { ...x, vivant: false } : x)), "d", { etat: e, geste: "emporter" }).sort(), ["c", "e"]);
    const r = L.roleDesVendanges({ name: "Herboriste", system: { effet: "remede", usages: { max: 2, restant: 2 }, nuit: { cibles: 2 } } });
    assert.deepEqual([r.system.usages.max, r.system.nuit.cibles], [1, 1], "une seule fiole");
    assert.equal(L.roleDesVendanges({ name: "Vielle", system: { effet: "charmer", nuit: { cibles: 2 } } }).system.nuit.cibles, 1, "un charmé à la fois");
  },
  "Vendanges : la Liseuse lit trois rôles mêlés ; l'Enfant épie l'Herboriste ; la fiole et son sort ; le triangle et son chagrin": L => {
    const vs = [v("a", "loup"), v("b", "herbo"), v("c", "liseuse"), v("d", "enfant"), v("e"), v("f", "entremetteuse"), v("g"), v("h")];
    const r = nuit(L, vs, [{ acteurId: "c", roleCle: "liseuse-de-cendres", cibles: ["e"] }], { vendanges: true });
    assert.match(textes(r, "c"), /chez Nom-d, Nom-e, Nom-f, on lit/, "le désigné et ses deux voisins");
    for (const role of ["Enfant de la brume", "Villageois", "Entremetteuse"]) assert.ok(textes(r, "c").includes(`« ${role} »`), role);
    const r2 = nuit(L, vs, [meute("e"), { acteurId: "d", roleCle: "enfant-de-la-brume", cibles: ["d"], surprise: true }, { acteurId: "b", roleCle: "herboriste", cibles: ["e"] }],
      { vendanges: true, hasard: () => 0 });
    assert.match(textes(r2, "d"), /Nom-b déboucher une fiole, pour Nom-e/, "elle voit l'Herboriste");
    assert.ok(!r2.morts.includes("d"), "et ne risque rien");
    // La fiole : le sort (hasard 0 : guéri ; 0.3 : villageois ; 0.6 : loup ; 0.9 : mort).
    const fiole = h => nuit(L, vs, [meute("e"), { acteurId: "b", roleCle: "herboriste", cibles: ["e"] }], { vendanges: true, hasard: () => h });
    assert.deepEqual(fiole(0).morts, [], "guéri");
    assert.ok(fiole(0.3).changements.some(c => c.type === "villageois" && c.acteurId === "e") && !fiole(0.3).morts.length, "guéri, villageois");
    assert.ok(fiole(0.6).changements.some(c => c.type === "camp" && c.acteurId === "e" && c.camp === "meute"), "guéri, loup");
    assert.deepEqual(fiole(0.9).morts, ["e"], "mort");
    const ailleurs = nuit(L, vs, [meute("e"), { acteurId: "b", roleCle: "herboriste", cibles: ["g"] }], { vendanges: true, hasard: () => 0.9 });
    assert.deepEqual(ailleurs.deces.find(d => d.acteurId === "g")?.cause, "poison", "sur un autre que la victime, la fiole tue aussi");
    assert.ok(nuit(L, vs, [meute("e"), { acteurId: "b", roleCle: "herboriste", cibles: ["e"] }], { vendanges: true, fioles: { b: { remede: true } } }).morts.includes("e"), "une fiole vide");
    // Le triangle : f unit g et h, puis désigne g et e.
    const r3 = nuit(L, vs, [{ acteurId: "f", roleCle: "entremetteuse", cibles: ["g", "h"] }, { acteurId: "f", roleCle: L.CLE_TROMPERIE, cibles: ["g", "e"] }], { vendanges: true });
    const t = r3.changements.find(c => c.type === "triangle");
    assert.deepEqual(t && [t.trompeur, t.trompe, t.amant], ["g", "h", "e"]);
    assert.ok(!r3.changements.some(c => c.type === "amour" && c.a === "g" && c.b === "e"), "pas un second lien d'amour ordinaire");
    assert.equal(L.triangleDesVendanges(["g", "h"], ["a", "b"]), null, "ni l'un ni l'autre des amants : rien");
    const triangle = { trompeur: "g", trompe: "h", amant: "e" };
    const vs4 = vs.map(x => ({ ...x, amoureux: { g: "e", e: "g", h: "g" }[x.id] ?? "" }));
    assert.deepEqual(nuit(L, vs4, [meute("h")], { triangle }).morts, ["h"], "le trompé n'entraîne personne");
    assert.deepEqual(nuit(L, vs4, [meute("g")], { triangle }).morts.sort(), ["e", "g", "h"], "le trompeur entraîne les deux autres");
    assert.deepEqual(nuit(L, vs4, [meute("e")], { triangle }).morts.sort(), ["e", "g", "h"], "l'amant aussi");
  },
  "Vendanges : les votes que l'amour interdit ; le Souffre-douleur à la place d'un voisin condamné ; le Bailli d'abord": L => {
    const t = { trompeur: "g", trompe: "h", amant: "e" };
    const interdit = (votant, cible, amoureux = {}) => L.voteInterditParLAmour({ triangle: t, amoureux, votant, cible });
    assert.equal(interdit("h", "g"), true, "le trompé contre le trompeur");
    assert.equal(interdit("g", "h"), false, "le trompeur contre le trompé");
    assert.equal(interdit("g", "e"), true);
    assert.equal(interdit("e", "g"), true);
    assert.equal(L.voteInterditParLAmour({ amoureux: { a: "b", b: "a" }, votant: "a", cible: "b" }), true, "deux amants");
    assert.equal(L.voteInterditParLAmour({ amoureux: { a: "b", b: "a" }, votant: "a", cible: "c" }), false);
    const vs = ["a", "b", "c", "d", "e"].map(id => v(id, id === "c" ? "bouc" : "villageois"));
    const e = L.ouvrirVote(etatDe(L, vs, { phase: "jour", variantes: { vendanges: true } }), { candidats: ["a", "b", "c", "d", "e"], objet: "execution" });
    e.vote.votes = { a: "b", c: "b", d: "b", e: "a" };
    const r = L.cloreVote(e, { votants: ["a", "b", "c", "d", "e"], boucDesVendanges: "c", voisinsDuBouc: ["b", "d"] }).resultat;
    assert.deepEqual([r.elus, r.souffreDouleur, r.remplace], [["c"], "c", "b"]);
    const r2 = L.cloreVote(L.ouvrirVote(etatDe(L, vs, { phase: "jour" }), { candidats: ["a", "e"], objet: "execution" }), { votants: [], boucDesVendanges: "c", voisinsDuBouc: ["b", "d"] });
    assert.equal(r2.resultat.remplace, undefined, "pas un voisin : rien");
    assert.equal(L.attendLeBailli({ bailliDabord: { acteurId: "a", jusqua: 100 }, votes: {} }, "b", 50), true);
    assert.equal(L.attendLeBailli({ bailliDabord: { acteurId: "a", jusqua: 100 }, votes: { a: "c" } }, "b", 50), false, "il a voté");
    assert.equal(L.attendLeBailli({ bailliDabord: { acteurId: "a", jusqua: 100 }, votes: {} }, "b", 150), false, "le délai passé");
    assert.equal(L.attendLeBailli({ bailliDabord: { acteurId: "a", jusqua: 100 }, votes: {} }, "a", 50), false, "lui vote");
  },

  // ------------------------------------------------------------ l'Envoûtement
  "Envoûtement : la proie envoûtée, pas tuée ; les envoûtés d'avant tombent ; la meute gagne à l'avant-dernier": L => {
    const vs = [v("a", "loup"), v("b"), v("c"), v("d")];
    const r = nuit(L, vs, [meute("b")], { envoutement: true });
    assert.deepEqual([r.morts, r.envoutes], [[], ["b"]]);
    assert.match(textes(r, "b"), /envoûté/);
    assert.deepEqual(nuit(L, vs, [meute("b")]).morts, ["b"], "sans la variante, elle meurt");
    assert.deepEqual(nuit(L, vs, [meute("b"), { acteurId: "c", roleCle: "garde-du-pont", cibles: ["b"] }],
      { envoutement: true, villageois: vs.map(x => (x.id === "c" ? { ...x, role: plat("garde") } : x)) }).envoutes, [], "une garde l'en préserve");
    const e = L.normaliserEtat({ ...L.etatInitial(), partie: "p", variantes: { envoutement: true } });
    L.envouter(e, ["b"], 1); L.envouter(e, ["c"], 2); L.envouter(e, ["b"], 3);
    assert.deepEqual(L.envoutesDe(e), ["b", "c"]);
    assert.deepEqual(L.envoutesPrecedents(e, "c"), ["b"]);
    assert.deepEqual(L.envoutesPrecedents(e, "b"), []);
    const role = L.roleEnvoute({ name: "Herboriste", system: { effet: "remede", nuit: { actif: true, ordre: 50 }, usages: { max: 2, restant: 2 } } });
    assert.deepEqual([role.name, role.system.effet, role.system.nuit.actif, role.system.usages.restant], ["Herboriste", "", false, 0]);
    assert.equal(L.verifierVictoire({ villageois: vs, envoutes: ["b", "c"] }), "meute", "un seul villageois libre");
    assert.equal(L.verifierVictoire({ villageois: vs, envoutes: ["b"] }), "", "deux libres : la veillée continue");
    assert.deepEqual(L.contexteDesVariantes(e), { envoutes: ["b", "c"] });
    assert.deepEqual(L.etatPublic(e).variantesSecret.envoutes, [], "les envoûtés restent au MJ");
  }
};

const MUTATIONS = [
  ["composition.mjs", " && (!livre || estDuLivre(cle))", "", "Le Pacte : seulement le livre"],
  ["composition.mjs", "  const batimentsPermis = niveau === NIVEAU_LE_PACTE ? []\n    :", "  const batimentsPermis =", "Le Pacte : sans bâtiment"],
  ["composition.mjs", "nombreDeLoups(n, niveau) + loupsEnPlus", "nombreDeLoups(n, niveau)", "Vendanges : un loup de plus"],
  ["variantes.mjs", "  if (tablee || peste) Object.assign", "  if (false) Object.assign", "exclusions : petite tablée et peste"],
  ["variantes.mjs", "cible: ids.length === 1 ? ids[0] : \"\"", "cible: ids[0] ?? \"\"", "chandelles : plus d'une, pas de victime"],
  ["variantes.mjs", "s.ids.length > 1 ? s.ids : []", "s.ids", "chandelles : au matin, seulement un désaccord"],
  ["variantes.mjs", "    const g = premierAGauche(etat, villageois, dernier,", "    const g = \"\" && premierAGauche(etat, villageois, dernier,", "chaîne : le voisin de gauche"],
  ["variantes.mjs", "  if (par !== c.designateur) return", "  if (false) return", "chaîne : chacun à son tour"],
  ["variantes.mjs", "  if (c.debout.length === 1) c.condamne = c.debout[0];", "", "chaîne : le dernier debout"],
  ["variantes.mjs", "  murmures.splice(Math.floor(hasard() * (murmures.length + 1)), 0, mot);", "  murmures.push(mot);\n  murmures.push(\"acteurId\");", "mur : sans auteur"],
  ["nuit.mjs", "  if (mur && vivants.length)", "  if (false)", "mur : le réveil"],
  ["variantes.mjs", "  if (pouvoirs.length === 2 && PASSIFS_DU_VISAGE.includes(pouvoirs[1])", "  if (false && PASSIFS_DU_VISAGE.includes(pouvoirs[1])", "Double visage : le passif d'abord"],
  ["variantes.mjs", "camp: loup ? \"meute\" : \"village\" };", "camp: \"village\" };", "Double visage : une carte de loup fait un loup"],
  ["variantes.mjs", "+ (enPlus === true ? ALLEGEANCES_LOUP_EN_PLUS : 0)", "", "Double visage : une allégeance loup de plus"],
  ["variantes.mjs", "  allegeanceLoup: Boolean(MODES_DOUBLE_VISAGE.includes(x?.doubleVisage) && x?.allegeanceLoup),", "  allegeanceLoup: Boolean(x?.allegeanceLoup),", "Double visage : le réglage seulement avec la variante"],
  ["resolution.mjs", "  const lire = id => visages[id] ?? roleApparent(parId.get(id), noms);", "  const lire = id => roleApparent(parId.get(id), noms);", "Double visage : la Liseuse lit les cartes secrètes"],
  ["nuit.mjs", "    ajouter(etapes, seconde, v.id, { emprunt: true, seconde: true });", "", "Double visage : la seconde carte se réveille"],
  ["resolution.mjs", "      ?? (porteur && !deLaMeute && porteur.seconde?.cle === a.roleCle", "      ?? (false && porteur.seconde?.cle === a.roleCle", "Double visage : la seconde carte agit"],
  ["resolution.mjs", "const c = carteDeLEffet(parId.get(id), EFFET_AIEUL);", "const c = parId.get(id)?.role?.effet === EFFET_AIEUL ? parId.get(id).role : null;", "Double visage : l'Aïeul en seconde carte"],
  ["jour.mjs", "    ids = ids.filter(id => permises.has(id));\n  }", "  }", "Vendanges : la meute chez un voisin"],
  ["jour.mjs", "    if (vendanges && role.effet === \"proteger\"", "    if (false && role.effet === \"proteger\"", "Vendanges : le Garde à ses voisins"],
  ["derniers-gestes.mjs", "  if (geste === \"emporter\" && etat && vendangesActives(etat))", "  if (false)", "Vendanges : la Braconnière à ses voisins"],
  ["resolution.mjs", "    if (vendanges && !reve.has(a.acteurId)) {", "    if (false) {", "Vendanges : la Liseuse et ses trois rôles"],
  ["resolution.mjs", "  for (const a of vendanges ? [] : parEffet(\"epier\")) {", "  for (const a of parEffet(\"epier\")) {", "Vendanges : l'Enfant ne risque plus rien"],
  ["resolution.mjs", "    if (issue === \"mort\") { attaques.push(", "    if (false) { attaques.push(", "Vendanges : la fiole qui tue"],
  ["resolution.mjs", "    for (const id of suiteDuTriangle(triangle, sortie.morts[i])) meurt(id, CAUSES.chagrin);", "", "Vendanges : le triangle et son chagrin"],
  ["resolution.mjs", "  if (triangle) { amours.set(triangle.trompeur, triangle.amant); amours.set(triangle.amant, triangle.trompeur); amours.delete(triangle.trompe); }", "", "Vendanges : le trompé n'entraîne personne"],
  ["variantes.mjs", "  if (triangle && votant === triangle.trompe && cible === triangle.trompeur) return true;", "", "Vendanges : le trompé ne vote pas contre le trompeur"],
  ["etat.mjs", "    ? resultat.elus.find(id => voisinsDuBouc.includes(id)) ?? \"\" : \"\";", "    ? \"\" : \"\";", "Vendanges : le Souffre-douleur à la place d'un voisin"],
  ["resolution.mjs", "    if (envoutement && x.meute && !x.peste && !x.pale", "    if (false && x.meute && !x.peste && !x.pale", "Envoûtement : pas de mort"],
  ["victoire.mjs", "  if (meuteEnvoute({ villageois, envoutes })) return \"meute\";\n", "", "Envoûtement : la victoire de la meute"],
  ["variantes.mjs", "  return i > 0 ? ids.slice(0, i) : [];", "  return ids.filter(id => id !== acteurId);", "Envoûtement : seulement celles d'avant"],
  ["etat.mjs", "  pub.variantesSecret = variantesSecretInitial();", "", "les secrets des variantes hors de l'état public"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-variantes-"));
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

test("Pacte, étape 5 (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 5 (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
