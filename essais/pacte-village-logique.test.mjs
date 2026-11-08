// Le Pacte, étape 3a (logique pure) : les rôles du Village du jeu de soirée — les fratries (Lavandières, Bûcherons : la première
// nuit, puis une sur deux, réveillées ensemble, leur salon), l'Aïeul (une vie de réserve contre la meute, la morsure ; la sagesse
// perdue s'il tombe de la main du village : plus de pouvoir de Village ni de métier), l'Innocent (gracié une fois, sans voix ensuite,
// la charge de Bailli abolie), le Souffre-douleur (il paie l'égalité avant le Bailli et le sort ; sa liste des votants du lendemain),
// le Furet (un trio de voisins ; « non » lui coûte son flair), la Gardeuse d'oies (un loup voisin vivant, ou elle-même mordue), le
// Vieux Sergent (le premier loup vivant à sa gauche, mort la nuit suivante), la Pie (deux voix de plus au premier vote du jour,
// rendues si le Juge annule), le Greffier bègue (son signe, le second vote dû quand les condamnés sont tombés) ; le générateur (les
// groupes entiers ou rien) et le contenu (rôles, ordres, équilibre, guides). Chaque règle est cassée à son tour dans une copie de la
// logique, et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { ROLES_DU_PACTE, ordreDeReveil } from "../modules/lakour-veillees/contenu/guides.mjs";
import { JETONS_ROLES } from "../modules/lakour-veillees/contenu/jetons.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const sansNuit = { actif: false, cibles: 0 };
const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 } },
  deguise: { cle: "loup-deguise", nom: "Loup déguisé", camp: "meute", effet: "tuer", apparence: "village", nuit: { actif: true, ordre: 40, cibles: 1 } },
  louve: { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41, cibles: 1 } },
  herbo: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true } },
  garde: { cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1, soiMeme: true } },
  braco: { cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter", nuit: sansNuit },
  juge: { cle: "juge-de-paix", nom: "Juge de paix", camp: "village", effet: "annuler-vote", nuit: sansNuit, usages: { max: 1, restant: 1 } },
  sonneur: { cle: "sonneur", nom: "Sonneur", camp: "village", effet: "vote-double", nuit: sansNuit, usages: { max: 1, restant: 1 } },
  aieul: { cle: "aieul", nom: "Aïeul", camp: "village", effet: "resister", nuit: sansNuit },
  sd: { cle: "souffre-douleur", nom: "Souffre-douleur", camp: "village", effet: "egalite", nuit: sansNuit },
  innocent: { cle: "innocent", nom: "Innocent", camp: "village", effet: "grace", nuit: sansNuit },
  lav: { cle: "lavandiere", nom: "Lavandière", camp: "village", effet: "fratrie", nuit: { actif: true, ordre: 11, cibles: 0, nuitsImpaires: true } },
  furet: { cle: "furet", nom: "Furet", camp: "village", effet: "flairer", nuit: { actif: true, ordre: 7, cibles: 1 } },
  oies: { cle: "gardeuse-d-oies", nom: "Gardeuse d'oies", camp: "village", effet: "cacarder", nuit: sansNuit },
  greffier: { cle: "greffier-begue", nom: "Greffier bègue", camp: "village", effet: "second-vote", nuit: sansNuit, usages: { max: 1, restant: 1 } },
  sergent: { cle: "vieux-sergent", nom: "Vieux Sergent", camp: "village", effet: "contaminer", nuit: sansNuit },
  pie: { cle: "pie", nom: "Pie", camp: "village", effet: "plume", nuit: { actif: true, ordre: 46, cibles: 1 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: sansNuit }
};
// Six places, a à f dans l'ordre des maisons (le cercle) ; extra : autre rôle, camp, vivant, métier.
const MAISONS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
const v = (id, role = "villageois", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${MAISONS[id]}`,
  silence: false, role: { usages: { max: 0, restant: 0 }, apparence: "", ...structuredClone(ROLE[role]) }, ...extra });
const mort = (vs, ...ids) => vs.map(x => (ids.includes(x.id) ? { ...x, vivant: false } : x));
const etatDe = (L, vs, extra = {}) => L.normaliserEtat({ ...L.fixerCercle({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1 }, vs), ...extra });
const nuit = (L, vs, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: 1, hasard: () => 0, cercle: L.ordreDesPlaces(vs), ...extra });
const meute = (cible, par = "a") => ({ acteurId: par, roleCle: "meute", cibles: [cible] });
// Un vote d'exécution ouvert, avec ces voix.
const voteOuvert = (L, e, votes, extra = {}) => {
  const x = L.ouvrirVote({ ...e, phase: "jour" }, { candidats: [], duree: 0, ...extra });
  x.vote.votes = { ...votes };
  return x;
};

const VERIFICATIONS = {
  // ------------------------------------------------------------ les fratries
  "fratries : la première nuit, puis une nuit sur deux ; réveillées ensemble ; leur fratrie de la nuit": L => {
    assert.deepEqual([1, 2, 3, 4, 5].map(t => L.seReveille(ROLE.lav, t)), [true, false, true, false, true]);
    const vs = [v("a", "loup"), v("b", "lav"), v("c", "lav"), v("d")];
    const e1 = L.ordreDeNuit(vs, 1).find(x => x.roleCle === "lavandiere");
    assert.deepEqual([e1?.acteurIds, e1?.ordre, e1?.cibles], [["b", "c"], 11, 0], "un seul réveil, les deux ensemble");
    assert.ok(!L.ordreDeNuit(vs, 2).some(x => x.roleCle === "lavandiere"));
    assert.equal(L.fratrieDeLaNuit(ROLE.lav, 3, L.seReveille), "lavandiere");
    assert.equal(L.fratrieDeLaNuit(ROLE.lav, 2, L.seReveille), "");
    assert.equal(L.fratrieDeLaNuit(ROLE.furet, 1, L.seReveille), "", "pas une fratrie");
    assert.deepEqual(L.freresDe(vs, "b"), ["c"]);
    assert.deepEqual(L.freresDe(mort(vs, "c"), "b"), [], "les morts ne sont plus des siens");
  },
  "fratries : leur salon la nuit où elles veillent, entre elles seules ; pas les autres nuits": L => {
    const table = fr => ({ villageois: [{ id: "A", joueur: "u1", fratrie: fr }, { id: "B", joueur: "u2", fratrie: fr }, { id: "C", joueur: "u3", fratrie: "" }],
      utilisateurs: [{ id: "u1" }, { id: "u2" }, { id: "u3" }], automatique: true });
    const r = L.audibilite({ phase: "nuit" }, {}, "u1", table("lavandiere"));
    assert.equal(r.salon, "fratrie");
    assert.ok(r.peutParler && r.auditeurs.includes("u2") && !r.auditeurs.includes("u3"), JSON.stringify(r));
    assert.deepEqual(L.ligneDe({ phase: "nuit" }, {}, "u1", table("lavandiere")).freres, ["A", "B"]);
    assert.equal(L.audibilite({ phase: "nuit" }, {}, "u3", table("lavandiere")).salon, "nuit", "les autres se taisent");
    assert.equal(L.audibilite({ phase: "nuit" }, {}, "u1", table("")).salon, "nuit", "une nuit sans réveil : silence");
    assert.equal(L.audibilite({ phase: "jour" }, {}, "u1", table("lavandiere")).salon, "village", "le jour, comme tout le monde");
  },
  // ------------------------------------------------------------ l'Aïeul
  "Aïeul : la première attaque de la meute ne le tue pas (en secret) ; la seconde, si": L => {
    const vs = [v("a", "loup"), v("b", "aieul"), v("c"), v("d"), v("e"), v("f")];
    const r1 = nuit(L, vs, [meute("b")]);
    assert.deepEqual(r1.morts, []);
    assert.deepEqual(r1.aieux, ["b"]);
    assert.ok(r1.messages.some(m => m.destinataire === "mj" && /AieulResiste/.test(m.cle)) && !r1.messages.some(m => m.destinataire === "b"), "seule la chronique du MJ");
    assert.deepEqual(nuit(L, vs, [meute("b")], { aieux: ["b"] }).morts, ["b"]);
    assert.deepEqual(nuit(L, vs, [{ acteurId: "", roleCle: "peste", cibles: ["b"] }]).morts, [], "la peste frappe comme la meute");
  },
  "Aïeul : un remède ou une garde lui laissent sa vie de réserve ; le poison le tue": L => {
    const vs = [v("a", "loup"), v("b", "aieul"), v("c", "herbo"), v("d", "garde"), v("e"), v("f")];
    const soigne = nuit(L, vs, [meute("b"), { acteurId: "c", roleCle: "herboriste", cibles: ["b"] }]);
    assert.deepEqual([soigne.morts, soigne.aieux], [[], []]);
    const garde = nuit(L, vs, [{ acteurId: "d", roleCle: "garde-du-pont", cibles: ["b"] }, meute("b")]);
    assert.deepEqual([garde.morts, garde.aieux], [[], []]);
    assert.deepEqual(nuit(L, vs, [{ acteurId: "c", roleCle: "herboriste", cibles: ["b"] }]).deces, [{ acteurId: "b", cause: "poison" }]);
  },
  "Aïeul : la première morsure de la Louve ne l'infecte pas, elle lui coûte sa vie ; la seconde, si": L => {
    const vs = [v("a", "loup"), v("b", "aieul"), v("c"), v("d"), v("e"), v("g", "louve")];
    const r = nuit(L, vs, [meute("b"), { acteurId: "g", roleCle: "louve-mere", cibles: ["b"] }]);
    assert.deepEqual([r.morts, r.aieux, r.changements.filter(c => c.type === "camp")], [[], ["b"], []]);
    const r2 = nuit(L, vs, [meute("b"), { acteurId: "g", roleCle: "louve-mere", cibles: ["b"] }], { aieux: ["b"] });
    assert.deepEqual(r2.changements.filter(c => c.type === "camp"), [{ type: "camp", acteurId: "b", camp: "meute" }]);
  },
  "sagesse : l'Aïeul tombé de la main du village (vote, poison, Braconnière), pas de la meute ; l'Innocent gracié le suit si on le veut": L => {
    const vs = [v("a", "loup"), v("b", "aieul"), v("i", "innocent")];
    const e = etatDe(L, vs);
    for (const cause of ["vote", "poison", "emporte"]) assert.equal(L.sagesseALaMort(e, { role: ROLE.aieul, cause, villageois: vs }).perdue, true, cause);
    for (const cause of ["meute", "chagrin", "nuit", "narrateur"]) assert.equal(L.sagesseALaMort(e, { role: ROLE.aieul, cause, villageois: vs }).perdue, false, cause);
    assert.equal(L.sagesseALaMort(e, { role: ROLE.villageois, cause: "vote" }).perdue, false, "seulement l'Aïeul");
    const g = L.gracier(L.normaliserEtat(e), "i").etat;
    assert.deepEqual(L.sagesseALaMort(g, { role: ROLE.aieul, cause: "vote", villageois: vs }).innocents, [], "réglage non coché");
    const suit = { ...g, pacte: { ...g.pacte, innocentSuit: true } };
    assert.deepEqual(L.sagesseALaMort(suit, { role: ROLE.aieul, cause: "vote", villageois: vs }).innocents, ["i"]);
    const perdue = L.perdreLaSagesse(L.normaliserEtat(e));
    assert.ok(L.sagesseEstPerdue(perdue));
    assert.equal(L.sagesseALaMort(perdue, { role: ROLE.aieul, cause: "vote" }).perdue, false, "une fois");
    assert.equal(L.separerEtat(perdue).public.pacte.sagessePerdue, 1, "publique");
  },
  "sagesse perdue : plus de réveil, d'action, de pouvoir de jour, de métier ni de dernier geste pour le Village ; la meute garde les siens": L => {
    const forgeron = { cle: "forgeron", usages: { max: 1, restant: 1 } };
    const vs = [v("a", "loup", { metier: forgeron }), v("b", "furet"), v("c", "lav"), v("d", "sonneur", { metier: forgeron }), v("e", "braco"), v("f", "pie")];
    assert.deepEqual(L.ordreDeNuit(vs, 1, { sagessePerdue: true }).map(x => x.roleCle), ["meute"]);
    assert.ok(L.ordreDeNuit(vs, 1).some(x => x.roleCle === "furet"));
    assert.ok(!L.seReveille(ROLE.furet, 1, { sansPouvoirs: true }) && L.seReveille(ROLE.louve, 1, { sansPouvoirs: true }));
    const r = nuit(L, vs, [meute("d"), { acteurId: "f", roleCle: "pie", cibles: ["d"] }], { sagessePerdue: true });
    assert.equal(r.plume, "", "l'action d'un rôle du Village ne vaut plus rien");
    const e = L.perdreLaSagesse(etatDe(L, vs, { phase: "jour", tour: 2, nuitResolue: 2 }));
    const raison = (acteurId, pouvoir) => L.verifierPouvoir({ villageois: vs, etat: e, acteurId, pouvoir, cibles: pouvoir === "forgeron" ? ["b"] : [] }).raison;
    assert.equal(raison("d", "sonneur"), "sagesse");
    assert.equal(raison("d", "forgeron"), "sagesse");
    assert.equal(raison("a", "forgeron"), "sagesse", "un loup qui garderait son métier se trahirait");
    const morte = { ...e, morts: [{ acteurId: "e", tour: 2, phase: "jour", cause: "vote" }] };
    assert.deepEqual(L.gestesEnAttente(morte, mort(vs, "e")), [], "la Braconnière n'emporte plus personne");
    assert.deepEqual(L.gestesEnAttente(etatDe(L, vs, { tour: 2, morts: morte.morts }), mort(vs, "e")).map(g => g.geste), ["emporter"]);
  },
  // ------------------------------------------------------------ l'Innocent
  "Innocent : gracié une fois par le vote (ni la nuit, ni la sagesse perdue) ; il ne vote plus ; Bailli, la charge est abolie": L => {
    const vs = [v("a", "loup"), v("i", "innocent"), v("x"), v("y")];
    const e = etatDe(L, vs, { bailli: { actif: true, acteurId: "i", depuis: 1, succession: null, election: 1 } });
    assert.ok(L.graceDue(e, { acteurId: "i", role: ROLE.innocent, cause: "vote" }));
    assert.ok(!L.graceDue(e, { acteurId: "i", role: ROLE.innocent, cause: "meute" }), "la nuit, il meurt");
    assert.ok(!L.graceDue(e, { acteurId: "x", role: ROLE.villageois, cause: "vote" }));
    assert.ok(!L.graceDue(L.perdreLaSagesse(L.normaliserEtat(e)), { acteurId: "i", role: ROLE.innocent, cause: "vote" }), "sans sagesse, pas de grâce");
    const g = L.gracier(L.normaliserEtat({ ...e, vote: { ...e.vote, numero: 4 } }), "i");
    assert.equal(g.bailli, true);
    assert.deepEqual([g.etat.bailli.actif, g.etat.bailli.acteurId], [false, ""], "plus de Bailli, jamais");
    assert.ok(!L.graceDue(g.etat, { acteurId: "i", role: ROLE.innocent, cause: "vote" }), "une seule fois");
    assert.ok(L.gracieAuVote(g.etat, "i", 4) && !L.gracieAuVote(g.etat, "i", 5));
    assert.deepEqual(L.filtrerVotants(g.etat, ["i", "x"]), ["x"]);
    assert.ok(L.priveDeVote(g.etat, "i") && !L.priveDeVote(g.etat, "x"));
    assert.ok(!L.votantsAdmis({ etat: g.etat, villageois: vs }).includes("i"));
    assert.ok(!L.votantsAdmis({ etat: { ...g.etat, vote: { ...g.etat.vote, objet: "bailli" } }, villageois: vs }).includes("i"), "à aucun vote");
  },
  "Innocent : la Table ne propose pas d'exécuter l'Innocent que ce vote a gracié": L => {
    const vs = [v("a", "loup"), v("i", "innocent"), v("x"), v("y")];
    const r = { objet: "execution", elus: ["i"], elu: "i", numero: 3, tour: 1, decompte: { i: 3 }, votes: {}, departage: null };
    const e = etatDe(L, vs, { phase: "vote", vote: { ouvert: false, numero: 3, objet: "execution", resultat: r } });
    assert.equal(L.etapeSuivante(L.separerEtat(e).public, L.separerEtat(e).secret, { villageois: vs }).cle, "executer");
    const g = L.gracier(L.normaliserEtat(e), "i", { numero: 3 }).etat;
    assert.notEqual(L.etapeSuivante(L.separerEtat(g).public, L.separerEtat(g).secret, { villageois: vs }).cle, "executer");
  },
  // ------------------------------------------------------------ le Souffre-douleur
  "Souffre-douleur : une égalité le condamne, lui, avant le Bailli et le sort": L => {
    const vs = [v("a", "loup"), v("b"), v("s", "sd"), v("x"), v("y"), v("z")];
    const votants = ["a", "b", "s", "x", "y", "z"];
    const e = voteOuvert(L, etatDe(L, vs, { bailli: { actif: true, acteurId: "z", depuis: 1, succession: null, election: 1 } }), { a: "x", b: "y" });
    const c = L.cloreVote(e, { votants, souffreDouleur: L.souffreDouleur(e, vs) });
    assert.deepEqual([c.resultat.elus, c.resultat.souffreDouleur, c.resultat.departage], [["s"], "s", null]);
    assert.deepEqual(c.etat.pacte.egalite, { acteurId: "s", tour: 1, numero: c.resultat.numero });
    assert.deepEqual(L.cloreVote(e, { votants }).resultat.departage?.candidats, ["x", "y"], "sans lui, le Bailli tranche");
    const net = voteOuvert(L, etatDe(L, vs), { a: "x", b: "x", s: "y" });
    assert.deepEqual(L.cloreVote(net, { votants, souffreDouleur: "s" }).resultat.elus, ["x"], "sans égalité, rien");
    const tablee = voteOuvert(L, etatDe(L, vs, { petiteTablee: true }), { a: "x", b: "y" });
    assert.deepEqual(L.cloreVote(tablee, { votants, souffreDouleur: "s", hasard: () => 0 }).resultat.elus, ["s"], "avant le sort");
    assert.equal(L.souffreDouleur(L.perdreLaSagesse(L.normaliserEtat(e)), vs), "", "sans sagesse, plus de Souffre-douleur");
    assert.equal(L.souffreDouleur(e, mort(vs, "s")), "");
  },
  "Souffre-douleur : mort d'une égalité, il désigne les votants du lendemain (aux votes d'exécution seulement)": L => {
    const vs = [v("a", "loup"), v("b"), v("s", "sd"), v("x"), v("y"), v("i", "innocent")];
    let e = L.gracier(etatDe(L, vs, { phase: "vote" }), "i").etat;
    e.pacte = { ...e.pacte, egalite: { acteurId: "s", tour: 1, numero: 1 } };
    e = L.ajouterMort(e, { acteurId: "s", cause: "vote" });
    const vs2 = mort(vs, "s");
    assert.deepEqual(L.gestesEnAttente(e, vs2), [{ acteurId: "s", geste: "votants" }]);
    assert.deepEqual(L.candidatsDuGeste(vs2, "s", { etat: e, geste: "votants" }), ["a", "b", "x", "y"], "les vivants qui votent");
    const ok = L.verifierGeste({ etat: e, villageois: vs2, acteurId: "s", geste: "votants", cibles: ["x", "b", "i"] });
    assert.deepEqual(ok, { ok: true, raison: "", cibles: ["x", "b"] }, "plusieurs à la fois, l'Innocent écarté");
    const fait = L.designerVotants(L.normaliserEtat(e), { par: "s", ids: ok.cibles });
    assert.deepEqual(L.gestesEnAttente(fait, vs2), [], "fait");
    const demain = L.normaliserEtat({ ...fait, tour: 2 });
    assert.deepEqual(L.filtrerVotants(demain, ["a", "b", "x", "y"], "execution"), ["b", "x"]);
    assert.deepEqual(L.filtrerVotants(demain, ["a", "b", "x", "y"], "bailli"), ["a", "b", "x", "y"], "l'élection du Bailli : tous");
    assert.deepEqual(L.filtrerVotants(L.normaliserEtat({ ...fait, tour: 3 }), ["a", "b"], "execution"), ["a", "b"], "le lendemain seulement");
    const ordinaire = L.ajouterMort(etatDe(L, vs, { phase: "vote" }), { acteurId: "s", cause: "vote" });
    assert.deepEqual(L.gestesEnAttente(ordinaire, vs2), [], "exécuté sans égalité : pas de geste");
    const chagrin = L.ajouterMort({ ...etatDe(L, vs, { phase: "vote" }), pacte: { ...e.pacte, votants: null } }, { acteurId: "s", cause: "chagrin" });
    assert.deepEqual(L.gestesEnAttente(chagrin, vs2), [], "mort d'autre chose : pas de geste");
  },
  // ------------------------------------------------------------ le Furet
  "Furet : un joueur et ses deux voisins vivants ; « oui » garde le flair, « non » le lui coûte ; le déguisé y échappe": L => {
    const vs = [v("a"), v("b"), v("c", "loup"), v("d"), v("e"), v("f", "furet")];
    const oui = nuit(L, vs, [{ acteurId: "f", roleCle: "furet", cibles: ["b"] }]);
    assert.ok(oui.messages.some(m => m.destinataire === "f" && /FuretOui/.test(m.cle) && m.donnees.noms.includes("Nom-c")));
    assert.deepEqual(oui.furets, []);
    const non = nuit(L, vs, [{ acteurId: "f", roleCle: "furet", cibles: ["e"] }]);
    assert.ok(non.messages.some(m => m.destinataire === "f" && /FuretNon/.test(m.cle)));
    assert.deepEqual(non.furets, ["f"]);
    assert.ok(nuit(L, mort(vs, "c"), [{ acteurId: "f", roleCle: "furet", cibles: ["b"] }]).furets.includes("f"), "les morts ne comptent pas (le trio saute c)");
    const deguise = vs.map(x => (x.id === "c" ? v("c", "deguise") : x));
    assert.deepEqual(nuit(L, deguise, [{ acteurId: "f", roleCle: "furet", cibles: ["b"] }]).furets, ["f"], "une vision : le masque tient");
    const e = etatDe(L, vs, { phase: "nuit", pacteSecret: { furets: ["f"] } });
    assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: e, acteurId: "f", roleCle: "furet" }), [], "sans flair, rien à désigner");
    assert.ok(L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs, { phase: "nuit" }), acteurId: "f", roleCle: "furet" }).length > 0);
    assert.deepEqual(L.separerEtat(e).public.pacteSecret.furets, [], "un secret du MJ");
  },
  // ------------------------------------------------------------ la Gardeuse d'oies
  "Gardeuse d'oies : un loup parmi ses deux voisins vivants, ou elle-même mordue ; les morts sautés ; rien sans sagesse": L => {
    const vs = [v("a"), v("b", "oies"), v("c", "loup"), v("d"), v("e"), v("f")];
    const e = etatDe(L, vs);
    assert.deepEqual(L.oiesQuiCacardent(e, vs), ["b"]);
    assert.deepEqual(L.oiesQuiCacardent(e, mort(vs, "c")), [], "le loup mort ne compte plus");
    const loin = [v("a"), v("b", "oies"), v("c"), v("d", "loup"), v("e"), v("f")];
    assert.deepEqual(L.oiesQuiCacardent(etatDe(L, loin), loin), [], "trop loin");
    assert.deepEqual(L.oiesQuiCacardent(etatDe(L, loin), mort(loin, "c")), ["b"], "le voisin mort sauté : le loup d'après");
    const mordue = loin.map(x => (x.id === "b" ? { ...x, camp: "meute" } : x));
    assert.deepEqual(L.oiesQuiCacardent(etatDe(L, loin), mordue), ["b"], "mordue, chaque matin");
    const deguise = vs.map(x => (x.id === "c" ? v("c", "deguise") : x));
    assert.deepEqual(L.oiesQuiCacardent(e, deguise), ["b"], "les oies sentent la bête");
    assert.deepEqual(L.oiesQuiCacardent(L.perdreLaSagesse(L.normaliserEtat(e)), vs), []);
  },
  // ------------------------------------------------------------ le Vieux Sergent
  "Vieux Sergent : dévoré, il blesse le premier loup vivant à sa gauche, qui meurt la nuit suivante, protégé ou non": L => {
    const vs = [v("a", "garde"), v("b", "loup"), v("c"), v("d", "sergent"), v("e"), v("f", "loup")];
    const r = nuit(L, vs, [meute("d", "f")]);
    assert.deepEqual(r.contaminations, [{ sergent: "d", loup: "b" }], "à gauche : c (villageois), puis b (loup)");
    const r2 = nuit(L, mort(vs, "d"), [{ acteurId: "a", roleCle: "garde-du-pont", cibles: ["b"] }], { contamines: ["b"] });
    assert.deepEqual(r2.deces, [{ acteurId: "b", cause: "contamine" }]);
    assert.deepEqual(nuit(L, vs, [{ acteurId: "a", roleCle: "garde-du-pont", cibles: ["d"] }, meute("d", "f")]).contaminations, [], "gardé : il vit");
    const herbo = vs.map(x => (x.id === "e" ? v("e", "herbo") : x));
    assert.deepEqual(nuit(L, herbo, [{ acteurId: "e", roleCle: "herboriste", cibles: ["d"] }]).contaminations, [], "empoisonné : rien");
    assert.deepEqual(nuit(L, vs, [meute("d", "f")], { sagessePerdue: true }).contaminations, []);
    assert.equal(L.causePublique("contamine"), "contamine", "annoncée");
  },
  // ------------------------------------------------------------ la Pie
  "Pie : sa plume (jamais sur elle-même) pèse deux voix au premier vote d'exécution du jour ; le Juge l'y laisse pour le revote": L => {
    const vs = [v("a", "loup"), v("b"), v("p", "pie"), v("x"), v("y"), v("j", "juge")];
    assert.equal(nuit(L, vs, [{ acteurId: "p", roleCle: "pie", cibles: ["x"] }]).plume, "x");
    assert.equal(nuit(L, vs, [{ acteurId: "p", roleCle: "pie", cibles: ["p"] }]).plume, "", "pas elle-même");
    assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: etatDe(L, vs, { phase: "nuit" }), acteurId: "p", roleCle: "pie" }).includes("p"));
    const e = L.poserLaPlume(etatDe(L, vs), "x");
    const votants = ["a", "b", "p", "x", "y", "j"];
    const c = L.cloreVote(voteOuvert(L, e, { a: "y", b: "y", p: "x" }), { votants });
    assert.deepEqual([c.resultat.decompte.x, c.resultat.elus, c.resultat.plume], [3, ["x"], "x"]);
    assert.ok(!("~plume" in c.resultat.votes), "une voix sans visage");
    assert.equal(L.cloreVote(voteOuvert(L, c.etat, { a: "y", b: "y", p: "x" }), { votants }).resultat.decompte.x, 1, "une seule fois");
    const juge = L.appliquerPouvoir({ villageois: vs, etat: { ...c.etat, phase: "vote" }, acteurId: "j", pouvoir: "juge-de-paix" });
    assert.ok(juge.ok, juge.raison);
    assert.equal(L.plumeDuVote(juge.etat), "x", "le revote la retrouve");
    assert.equal(L.plumeDuVote({ ...e, tour: 2 }), "", "le jour d'après, plus rien");
  },
  // ------------------------------------------------------------ le Greffier bègue
  "Greffier bègue : pendant le vote ou juste après une condamnation, un signe secret ; le second vote dû quand les condamnés sont tombés": L => {
    const vs = [v("a", "loup"), v("g", "greffier"), v("x"), v("y"), v("z")];
    const ouvert = voteOuvert(L, etatDe(L, vs), {});
    const ok = e => L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "g", pouvoir: "greffier-begue" }).raison;
    assert.equal(ok(ouvert), "", "pendant le vote");
    assert.equal(ok(etatDe(L, vs)), "phase", "pas au débat");
    const clos = L.cloreVote(voteOuvert(L, etatDe(L, vs), { a: "x", y: "x" }), { votants: ["a", "g", "x", "y", "z"] }).etat;
    assert.equal(ok(clos), "", "juste après une condamnation");
    assert.equal(ok(L.cloreVote(voteOuvert(L, etatDe(L, vs), {}), { votants: ["a"] }).etat), "secondVote", "un vote sans condamné");
    const a = L.appliquerPouvoir({ villageois: vs, etat: clos, acteurId: "g", pouvoir: "greffier-begue" });
    assert.deepEqual([a.ok, a.annonces, a.changements], [true, [], []], "secret, et l'usage pris plus tard");
    assert.equal(a.etat.pacteSecret.signal.par, "g");
    assert.deepEqual(L.separerEtat(a.etat).public.pacteSecret.signal, null, "le signe est un secret");
    assert.equal(ok(a.etat), "deja");
    assert.equal(L.secondVoteDu(a.etat, vs), false, "le condamné vit encore");
    assert.equal(L.secondVoteDu(a.etat, mort(vs, "x")), true);
    assert.equal(L.secondVoteDu({ ...a.etat, pacte: { ...a.etat.pacte, secondVote: { tour: 1, numero: 2 } } }, mort(vs, "x")), false, "une fois");
    assert.equal(ok(L.perdreLaSagesse(L.normaliserEtat(ouvert))), "sagesse");
    // Un vote double : le second vote attend que les DEUX condamnés soient tombés.
    const double = L.cloreVote(voteOuvert(L, etatDe(L, vs), { a: "x", z: "x", g: "y" }, { double: true }), { votants: ["a", "g", "x", "y", "z"] }).etat;
    assert.deepEqual(double.vote.resultat.elus, ["x", "y"]);
    const signe = L.appliquerPouvoir({ villageois: vs, etat: double, acteurId: "g", pouvoir: "greffier-begue" }).etat;
    assert.equal(L.secondVoteDu(signe, mort(vs, "x")), false, "y vit encore");
    assert.equal(L.secondVoteDu(signe, mort(vs, "x", "y")), true);
  },
  // ------------------------------------------------------------ le générateur et le contenu
  "générateur : les Lavandières par deux, les Bûcherons par trois, ou pas du tout": L => {
    const eq = { roles: Object.fromEntries(Object.entries(EQUILIBRE).filter(([, r]) => !r.surDemande)), batiments: { puits: { niveau: "debutants" } } };
    for (let g = 0; g < 40; g++) {
      const c = L.composer(14, eq, { niveau: "chaos", graine: `groupe/${g}`, essais: 30 });
      assert.equal(c.roles.length, 14);
      for (const cle of ["lavandiere", "bucheron"]) assert.ok([0, EQUILIBRE[cle].groupe].includes(c.roles.filter(r => r === cle).length), `${cle} : ${c.roles.join(",")}`);
    }
    const voulu = L.composer(12, eq, { niveau: "chaos", inclure: ["bucheron", "lavandiere"], graine: "voulu", essais: 20 });
    assert.deepEqual(["bucheron", "lavandiere"].map(k => voulu.roles.filter(r => r === k).length), [3, 2]);
    // (Plusieurs graines : une seule ne tirait parfois aucun de ces rôles, même permis — Le Pacte, étape 6, poids recalibrés.)
    for (let g = 0; g < 12; g++) assert.ok(!L.composer(10, eq, { niveau: "petite-tablee", graine: `t${g}`, essais: 50 }).roles.some(r => ROLES_DU_PACTE.includes(r)), "pas encore à la petite tablée");
  },
  "contenu : les onze rôles, leurs effets, leurs ordres et leur équilibre": () => {
    const parCle = Object.fromEntries(ROLES.map(r => [r.system.cle, r]));
    const attendu = { "franc-villageois": "", aieul: "resister", "souffre-douleur": "egalite", innocent: "grace", lavandiere: "fratrie", bucheron: "fratrie",
      furet: "flairer", "gardeuse-d-oies": "cacarder", "greffier-begue": "second-vote", "vieux-sergent": "contaminer", pie: "plume" };
    assert.deepEqual(Object.keys(attendu).sort(), [...ROLES_DU_PACTE].sort());
    for (const [cle, effet] of Object.entries(attendu)) {
      const r = parCle[cle];
      assert.ok(r, cle);
      assert.deepEqual([r.system.camp, r.system.effet], ["village", effet], cle);
      assert.equal(EQUILIBRE[cle]?.camp, "village", `${cle} : équilibre`);
      // (Novembre 2026 : le Vieux Sergent dès le niveau Débutants, dès 9 joueurs — docs/equilibre-veillees.md ; les autres, classique ou chaos.)
      if (cle === "vieux-sergent") assert.deepEqual([EQUILIBRE[cle].niveau, EQUILIBRE[cle].joueursMin], ["debutants", 9], cle);
      else assert.ok(["classique", "chaos"].includes(EQUILIBRE[cle].niveau), `${cle} : classique ou chaos`);
      assert.ok(JETONS_ROLES[cle], `${cle} : jeton`);
    }
    assert.equal(parCle["franc-villageois"].system.public, true);
    assert.deepEqual(["furet", "lavandiere", "bucheron", "pie"].map(c => parCle[c].system.nuit.ordre), [7, 11, 12, 14]);
    assert.ok(parCle.lavandiere.system.nuit.nuitsImpaires && parCle.bucheron.system.nuit.nuitsImpaires);
    assert.deepEqual([EQUILIBRE.lavandiere.groupe, EQUILIBRE.bucheron.groupe], [2, 3]);
    assert.equal(parCle["greffier-begue"].system.usages.max, 1);
    const ordre = ordreDeReveil().map(e => e.o);
    for (const o of [7, 11, 12, 14]) assert.ok(ordre.includes(o), `ordre ${o} au guide`);
  }
};

const MUTATIONS = [
  ["nuit.mjs", "  if (n.nuitsImpaires && tour % 2 !== 1) return false;\n", "", "fratries : une nuit sur deux"],
  ["nuit.mjs", "  if (pouvoirPerdu(sansPouvoirs, role)) return false;\n", "", "sagesse : plus de réveil"],
  ["salons.mjs", "  if (PHASES_DE_NUIT.includes(phase) && p.fratrie && !p.loup) return \"fratrie\";\n", "", "fratries : leur salon"],
  ["salons.mjs", "(a.vivant && !a.loup && a.fratrie === l.fratrie)", "(a.vivant && !a.loup)", "fratries : entre elles seules"],
  ["pacte.mjs", "return villageois.filter(v => v.id !== acteurId && vivant(v) && v.role?.cle === moi.role.cle)", "return villageois.filter(v => v.id !== acteurId && v.role?.cle === moi.role.cle)", "fratries : les vivants"],
  ["resolution.mjs", "    if (x.meute && aieulEnVie(x.cible)) {", "    if (false) {", "Aïeul : sa vie de réserve"],
  ["resolution.mjs", " && !sortie.aieux.includes(id);", ";", "Aïeul : une seule"],
  ["resolution.mjs", "    } else if (aieulEnVie(cible) && !linceul) {", "    } else if (false) {", "Aïeul : la morsure"],
  ["pacte.mjs", "|| !CAUSES_SANS_SAGESSE.includes(cause)", "", "sagesse : la main du village"],
  ["pacte.mjs", "p.innocentSuit ? villageois", "true ? villageois", "sagesse : l'Innocent suit sur réglage"],
  ["resolution.mjs", "    if (!deLaMeute && !deLaPeste && !duDeuil && a.roleCle === acteur?.role?.cle && sansPouvoir(acteur.role)) continue;\n", "", "sagesse : les actions du Village"],
  ["jour.mjs", "    if (sagesseEstPerdue(etat) && (def.source === \"metier\" || (def.source === \"role\" && pouvoirPerdu(true, acteur.role)))) return non(\"sagesse\");\n", "", "sagesse : pouvoirs de jour et métiers"],
  ["derniers-gestes.mjs", "some(r => gesteDuRole(r, sans) === geste)", "some(r => gesteDuRole(r) === geste)", "sagesse : derniers gestes"],
  ["pacte.mjs", "role?.effet === EFFET_INNOCENT && !estGracie(etat, acteurId)", "role?.effet === EFFET_INNOCENT", "Innocent : une seule grâce"],
  ["pacte.mjs", "  if (bailli) etat.bailli = { ...etat.bailli, actif: false, acteurId: \"\", succession: null };\n", "", "Innocent : la charge abolie"],
  ["pacte.mjs", "  let admis = ids.filter(id => !gracies.has(id));", "  let admis = ids;", "Innocent : sans voix"],
  ["etapes.mjs", " && !gracieAuVote(etat, id, r.numero)", "", "Innocent : pas d'exécution"],
  ["etat.mjs", "const bouc = v.objet === \"execution\" && !v.banc && r.departage && souffreDouleur", "const bouc = false && souffreDouleur", "Souffre-douleur : il paie l'égalité"],
  ["etat.mjs", "    r.departage = null;   // l'égalité est payée : ni Bailli ni sort\n", "", "Souffre-douleur : avant le sort"],
  ["derniers-gestes.mjs", "m.cause === \"vote\" && normaliserPacte", "normaliserPacte", "Souffre-douleur : mort d'une égalité"],
  ["pacte.mjs", "p.votants && p.votants.tour === Number(etat?.tour)", "p.votants", "Souffre-douleur : le lendemain seulement"],
  ["pacte.mjs", "if (objet === \"execution\" && p.votants", "if (p.votants", "Souffre-douleur : votes d'exécution seulement"],
  ["resolution.mjs", "      sortie.furets.push(a.acteurId);\n", "", "Furet : le flair perdu"],
  ["resolution.mjs", "groupe.some(id => vu(id, a.acteurId) === \"meute\")", "groupe.some(id => parId.get(id)?.camp === \"meute\")", "Furet : une vision"],
  ["jour.mjs", "role.effet === EFFET_FURET && furetAveugle(etat, acteurId)) return [];", "false) return [];", "Furet : sans flair, rien à désigner"],
  ["pacte.mjs", "    if (v.camp === \"meute\") return true;\n", "", "Gardeuse : mordue"],
  ["pacte.mjs", "const { gauche, droite } = voisins(etat, villageois, v.id);", "const { gauche, droite } = voisins(etat, villageois, v.id, { vivantsSeulement: false });", "Gardeuse : les vivants"],
  ["resolution.mjs", "    meurt(id, CAUSES.contamine);\n", "", "Sergent : le contaminé meurt"],
  ["resolution.mjs", "if (s?.role?.effet !== EFFET_SERGENT || sansPouvoir(s.role)) continue;", "if (s?.role?.effet !== EFFET_SERGENT) continue;", "Sergent : sans sagesse"],
  ["resolution.mjs", "premierAGauche(placesDuCercle, apres, d.acteurId, v => v.camp === \"meute\")", "premierAGauche(placesDuCercle, apres, d.acteurId, () => true)", "Sergent : le premier LOUP"],
  ["resolution.mjs", "candidatsDeLaPlume(villageois, a.acteurId, [c]).length", "true", "Pie : pas elle-même"],
  ["etat.mjs", "  if (plumee) pesees[VOIX_DE_LA_PLUME] = POIDS_DE_LA_PLUME;\n", "", "Pie : deux voix"],
  ["pacte.mjs", "p && p.tour === Number(etat?.tour) && !p.servi", "p && p.tour === Number(etat?.tour)", "Pie : une fois"],
  ["jour.mjs", "      rendreLaPlume(etat, ancien.numero);\n", "", "Pie : rendue au revote"],
  ["jour.mjs", "!v.ouvert && r?.objet === \"execution\" && r.tour === etat.tour && r.numero === v.numero && !r.departage?.enAttente && (r.elus ?? []).length > 0", "!v.ouvert", "Greffier : après une condamnation"],
  ["jour.mjs", "if (normaliserPacteSecret(etat.pacteSecret).signal?.tour === etat.tour || ", "if (", "Greffier : un signe"],
  ["jour.mjs", "&& !def.usageDiffere", "", "Greffier : l'usage pris plus tard"],
  ["pacte.mjs", "  return tombes.length > 0 && r.elus.every(", "  return r.elus.some(", "Greffier : les condamnés tombés"],
  ["composition.mjs", "    for (let i = 0; i < k; i++) roles.push(cle);\n    reste -= k;", "    roles.push(cle);\n    reste -= 1;", "générateur : le groupe entier"],
  ["composition.mjs", " && !PACTE_HORS_TABLEE.includes(cle)", "", "générateur : pas encore à la petite tablée"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-pacte-village-"));
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

test("Pacte, étape 3a (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Pacte, étape 3a (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
