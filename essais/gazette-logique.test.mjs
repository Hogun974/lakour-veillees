// Le Pacte, étape 9 (logique pure, logique/gazette.mjs) : les traits visibles (moitié-moitié, proportions, bourg ou écart, un trait imposé
// respecté), les 31 cartes de la Gazette (sortes, événements immédiats / de nuit / permanents / en attente, le tirage du matin, le paquet),
// leurs effets posés (absences, refuges, Petit Commis, Saint-Vincent, Revenue, Châtiment, Cauchemar, Exécuteur, Jour des sots et ses
// pouvoirs rendus), la nuit (Toucher mortel, Crue, Retour de flamme, Spectre, Nuit des sots, Bal et Battue), les votes (Grande Défiance,
// à tour de rôle vers la gauche, Cauchemar, Châtiment, privés de vote et protégés), le Crieur public (nommer, transmettre, garder ;
// l'annonce du matin), l'Exécuteur, Ni loup ni moi, les 20 questions du Spiritisme (la vraie réponse), le contenu (31 cartes, 5 séances,
// la Liseuse d'étoiles). Chaque règle est cassée à son tour dans une copie de la logique, et la batterie doit alors échouer.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";
import { EQUILIBRE } from "../modules/lakour-veillees/contenu/equilibre.mjs";
import { CARTES_DE_LA_GAZETTE as TEXTES, SEANCES_DE_SPIRITISME } from "../modules/lakour-veillees/contenu/gazette.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));
const FR = JSON.parse(readFileSync(new URL("../systems/lakour-loups/lang/fr.json", import.meta.url), "utf8")).LAKOUR_LOUPS;
const EN = JSON.parse(readFileSync(new URL("../systems/lakour-loups/lang/en.json", import.meta.url), "utf8")).LAKOUR_LOUPS;
const DOC = readFileSync(new URL("../docs/gazette-de-la-lune.md", import.meta.url), "utf8");

const role = (cle, camp = "village", effet = "", nuit = { actif: false }) => ({ cle, nom: cle, camp, effet, nuit, usages: { max: 0, restant: 0 } });
const v = (id, r, extra = {}) => ({ id, nom: id, vivant: true, camp: r.camp, maison: `Maison ${extra.maison ?? 1}`, amoureux: "", role: r, ...extra });
const LOUP = role("loup-de-brumecombe", "meute", "tuer", { actif: true, ordre: 40, cibles: 1 });
const VILL = role("villageois");
// Un village de huit, assis dans l'ordre : a b c d e f g h ; loups : b et e.
function village() {
  const vs = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => v(id, ["b", "e"].includes(id) ? LOUP : VILL, { maison: i + 1 }));
  return vs;
}
function etat(L, extra = {}) {
  const e = L.normaliserEtat({ partie: "p", phase: "aube", tour: 2, cercle: ["a", "b", "c", "d", "e", "f", "g", "h"], ...extra });
  e.traits = { a: tr("femme", 20), b: tr("homme", 22, { lunettes: true }), c: tr("femme", 24), d: tr("homme", 26), e: tr("femme", 60, { pipe: true }),
    f: tr("homme", 62), g: tr("femme", 64), h: tr("homme", 66, { bourg: false }) };
  return e;
}
function tr(genre, ans, x = {}) { return { genre, ans, age: ans >= 50 ? "vieux" : "jeune", lunettes: false, bijou: false, sabots: false, coiffe: false, pipe: false, bourg: true, ...x }; }

const VERIFICATIONS = {
  "traits : moitié-moitié (genre, âge), âges distincts, proportions raisonnables, bourg ou écart d'après la maison, un trait imposé respecté"(L) {
    const vs = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, maison: `Maison ${i < 9 ? i + 1 : 13 + i - 9}` }));
    const t = L.tirerTraits(vs, { hasard: L.creerHasard("traits"), imposes: { v0: { genre: "homme", ans: 80 } } });
    const n = (c, x) => Object.values(t).filter(y => y[c] === x).length;
    assert.deepEqual([n("genre", "femme"), n("genre", "homme"), n("age", "jeune"), n("age", "vieux")], [6, 6, 6, 6]);
    assert.equal(new Set(Object.values(t).map(y => y.ans)).size, 12);
    for (const y of Object.values(t)) assert.ok(y.age === "jeune" ? y.ans <= 39 : y.ans >= 50, "l'âge en années suit jeune / vieux");
    assert.deepEqual([t.v0.genre, t.v0.age, t.v0.ans], ["homme", "vieux", 80], "imposé");
    assert.deepEqual(vs.map(x => t[x.id].bourg), vs.map((x, i) => i < 9), "maisons 13 à 18 : des écarts");
    let lunettes = 0;
    for (let g = 0; g < 40; g++) lunettes += Object.values(L.tirerTraits(vs, { hasard: L.creerHasard(`p${g}`) })).filter(y => y.lunettes).length;
    assert.ok(lunettes > 480 * 0.2 && lunettes < 480 * 0.4, `lunettes : environ trois sur dix (${lunettes} / 480)`);
    const arrivant = L.tirerTraits([{ id: "z", maison: "Maison 20" }], { hasard: L.creerHasard("z"), deja: t });
    assert.ok(arrivant.z.ans && !Object.values(t).some(y => y.ans === arrivant.z.ans), "un arrivant : un âge libre");
  },

  "les cartes : 31, leurs sortes et leurs événements ; le contenu (noms et effets fr / en, cahier des charges)"(L) {
    assert.equal(L.CLES_DE_LA_GAZETTE.length, 31);
    assert.deepEqual(L.CARTES_PERMANENTES.sort(), ["enfouissement", "executeur", "somnambule", "toucher-mortel"]);
    assert.deepEqual(L.CARTES_DE_CONDUITE.sort(), ["bonnes-manieres", "lune-noire", "ni-loup-ni-moi"]);
    for (const c of L.CLES_DE_LA_GAZETTE) {
      assert.ok(FR.Gazette.Cartes[c]?.Nom && FR.Gazette.Cartes[c]?.Effet && EN.Gazette.Cartes[c]?.Nom && EN.Gazette.Cartes[c]?.Effet, c);
      assert.ok(DOC.includes(FR.Gazette.Cartes[c].Nom.replace(/^(La|Le|Les|L') ?/, "").split(" ")[0]), `${c} : au cahier des charges`);
    }
    assert.deepEqual(L.definitionsDeLaCarte("bal-du-samedi").map(d => d.quand), ["jour", "nuit"]);
    assert.deepEqual(L.definitionsDeLaCarte("retour-de-flamme"), [{ type: "immediat", quand: "nuit" }]);
    assert.deepEqual(L.definitionsDeLaCarte("depit"), [{ type: "permanent", quand: "jour" }], "en attente jusqu'à ce qu'elle serve");
    assert.deepEqual(L.definitionsDeLaCarte("spectre"), [{ type: "permanent", quand: "nuit" }]);
    assert.equal(L.CLES_DES_SEANCES.length, 5);
    assert.equal(Object.values(L.SEANCES).flat().length, 20);
    for (const q of Object.values(L.SEANCES).flat()) assert.ok(FR.Gazette.Questions[q] && EN.Gazette.Questions[q], q);
    const etoiles = ROLES.find(r => r.system.cle === "liseuse-d-etoiles");
    assert.deepEqual([etoiles.system.camp, etoiles.system.effet, etoiles.system.nuit.ordre, etoiles.system.nuit.soiMeme], ["village", "spiritisme", 51, true]);
    const herbo = ROLES.find(r => r.system.cle === "herboriste"), vielle = ROLES.find(r => r.system.cle === "joueur-de-vielle");
    assert.ok(herbo.system.nuit.ordre < 51 && 51 < vielle.system.nuit.ordre, "l'ordre d'appel du livre : après l'Herboriste, avant le Joueur de vielle");
    assert.ok(EQUILIBRE["liseuse-d-etoiles"] && L.estDuLivre("liseuse-d-etoiles") && L.PACTE_HORS_TABLEE.includes("liseuse-d-etoiles"));
    // Les guides (contenu/gazette.mjs) montrent les mêmes textes que le système.
    assert.deepEqual(TEXTES.map(([c]) => c).sort(), [...L.CLES_DE_LA_GAZETTE].sort());
    for (const [c, nom, texte] of TEXTES) assert.deepEqual([nom, texte], [FR.Gazette.Cartes[c].Nom, FR.Gazette.Cartes[c].Effet], c);
    assert.deepEqual(SEANCES_DE_SPIRITISME.map(([, qs]) => qs), Object.values(L.SEANCES).map(qs => qs.map(q => FR.Gazette.Questions[q])));
  },

  "le tirage : pas le premier matin, un matin sur rythme, pas en mode « choix » ; la carte du dessus ; le paquet sans les cartes du Crieur"(L) {
    const e = etat(L, { gazette: { actif: true, rythme: 2 } });
    assert.equal(L.tirageDu({ ...e, tour: 1 }), false);
    assert.equal(L.tirageDu({ ...e, tour: 2 }), true);
    assert.equal(L.tirageDu({ ...e, tour: 3 }), false);
    assert.equal(L.tirageDu({ ...e, tour: 4 }), true);
    assert.equal(L.tirageDu({ ...e, gazette: { actif: true, choix: true } }), false);
    const paquet = L.preparerLePaquet({ hasard: L.creerHasard("x"), sans: ["depit", "spectre"] });
    assert.equal(paquet.length, 29);
    assert.ok(!paquet.includes("depit"));
    const main = L.cartesPourLeCrieur({ n: 5, hasard: L.creerHasard("y") });
    assert.equal(main.length, 5);
    assert.deepEqual(L.cartesPourLeCrieur({ choisies: ["lune-noire", "seance-1", "x"] }), ["lune-noire"], "jamais de Spiritisme");
    const x = { ...e, gazetteSecret: { paquet: ["cauchemar", "depit"] } };
    assert.equal(L.prendreLaCarte(x), "cauchemar");
    assert.deepEqual(x.gazetteSecret.paquet, ["depit"]);
    assert.equal(x.gazette.restantes, 1);
    assert.deepEqual(L.gazetteOuAlmanach({ gazette: true, almanach: true }), { gazette: true, almanach: false });
  },

  "les absences : Bal (la moitié la plus jeune), Banquet (la plus âgée), Cueillette (les femmes), Battue (les hommes), Petit Commis (le plus jeune)"(L) {
    const vs = village();
    const absents = cle => { const e = etat(L); const r = L.poserLaCarte(e, cle, { villageois: vs }); return { e, r, ids: L.absentsDuJour(e).sort() }; };
    const bal = absents("bal-du-samedi");
    assert.deepEqual(bal.ids, ["a", "b", "c", "d"]);
    assert.deepEqual(L.protegesDuJour(bal.e).sort(), ["a", "b", "c", "d"]);
    assert.deepEqual(L.intouchablesDeLaNuit(bal.e, 3).sort(), ["a", "b", "c", "d"]);
    assert.deepEqual(L.sansChasseDeLaNuit(bal.e, 3).sort(), ["a", "b", "c", "d"]);
    assert.deepEqual(bal.r.gestes, [{ type: "silence", ids: ["a", "b", "c", "d"] }]);
    assert.deepEqual(L.filtrerVotants(bal.e, ["a", "b", "e", "f"], "execution"), ["e", "f"]);
    assert.deepEqual(L.candidatsDeLaGazette(bal.e, ["a", "e", "f"]), ["e", "f"]);
    assert.deepEqual(absents("banquet-des-veterans").ids, ["e", "f", "g", "h"]);
    assert.deepEqual(absents("cueillette").ids, ["a", "c", "e", "g"]);
    assert.deepEqual(absents("battue").ids, ["b", "d", "f", "h"]);
    const commis = absents("petit-commis");
    assert.deepEqual(commis.ids, ["a"]);
    assert.deepEqual(L.protegesDuJour(commis.e), [], "le Commis reste candidat");
    assert.deepEqual(L.intouchablesDeLaNuit(commis.e, 3), ["a"]);
    assert.deepEqual(L.poidsDeLaGazette({ ...commis.e, tour: 3 }), { a: 3 }, "sa voix compte triple le lendemain");
    assert.deepEqual(L.poidsDeLaGazette(commis.e), {});
    // La Cueillette : l'Herboriste remplit une fiole vidée (le remède d'abord).
    const e = etat(L, { fioles: { h: { remede: true, poison: true } }, fiches: { h: { camp: "village", role: { name: "Herboriste", system: { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 0 } } } } } });
    const vh = vs.map(x => (x.id === "h" ? { ...x, role: { ...VILL, cle: "herboriste", effet: "remede" } } : x));
    L.poserLaCarte(e, "cueillette", { villageois: vh });
    assert.deepEqual(e.fioles.h, { remede: false, poison: true });
    assert.equal(e.fiches.h.role.system.usages.restant, 1);
  },

  "la Crue : pas de vote ; une seconde proie du même genre ; sans effet sous six vivants ; le Toucher mortel ; le Retour de flamme ; le Spectre"(L) {
    const vs = village();
    let e = etat(L);
    const r = L.poserLaCarte(e, "inondation", { villageois: vs });
    assert.equal(L.voteEmpeche(e), "inondation");
    assert.ok(r.annonces.some(m => m.cle.endsWith("Refuges")));
    e = { ...e, phase: "nuit", tour: 3 };
    const actions = [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }, { acteurId: "b", roleCle: "crue", cibles: ["c"] }];
    assert.ok(L.nuitDeLaGazette(e, 3, vs, actions).etapes.some(x => x.roleCle === "crue"));
    assert.deepEqual(L.candidatsDeLEtape(e, { roleCle: "crue", villageois: vs, actions, candidatsMeute: ["a", "c", "d", "f"] }), ["c"], "le même refuge");
    let p = L.preparerLaNuit(e, { villageois: vs, actions, tour: 3 });
    assert.equal(p.crue, "c");
    assert.ok(p.actions.some(a => a.roleCle === "crue" && a.effet === "tuer"));
    p = L.preparerLaNuit(e, { villageois: vs, actions: [actions[0], { acteurId: "b", roleCle: "crue", cibles: ["d"] }], tour: 3 });
    assert.equal(p.crue, "", "un homme n'est pas au prieuré");
    const peu = etat(L);
    assert.equal(L.poserLaCarte(peu, "inondation", { villageois: vs.slice(0, 5) }).annonces[0].cle.endsWith("SansEffet"), true);
    assert.equal(L.voteEmpeche(peu), "");
    // Le Toucher mortel.
    const t = etat(L);
    L.poserLaCarte(t, "toucher-mortel", { villageois: vs });
    const tn = { ...t, phase: "nuit", tour: 3 };
    p = L.preparerLaNuit(tn, { villageois: vs, actions: [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }], tour: 3 });
    assert.ok(!p.actions.some(a => a.roleCle === "meute"), "pas touchée : épargnée");
    p = L.preparerLaNuit(tn, { villageois: vs, actions: [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }, { acteurId: "e", roleCle: "toucher", cibles: ["a"] }], tour: 3 });
    assert.ok(p.actions.some(a => a.roleCle === "meute"));
    assert.ok(!p.actions.some(a => a.roleCle === "toucher"), "le geste n'est pas une attaque de plus");
    // Le Retour de flamme : une meute d'accord, la proie ; en désaccord, personne.
    const rf = etat(L);
    L.poserLaCarte(rf, "retour-de-flamme", { villageois: vs });
    const rn = { ...rf, phase: "nuit", tour: 3 };
    p = L.preparerLaNuit(rn, { villageois: vs, actions: [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }, { acteurId: "e", roleCle: "meute", cibles: ["a"] }], tour: 3 });
    assert.deepEqual([p.retour, p.actions.some(a => a.roleCle === "meute")], [{ victime: "a" }, false]);
    p = L.preparerLaNuit(rn, { villageois: vs, actions: [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }, { acteurId: "e", roleCle: "meute", cibles: ["c"] }], tour: 3 });
    assert.equal(p.retour, null, "la meute ne s'accorde pas : aucune victime");
    // Le Spectre : la proie, et l'ancien loup qu'elle désigne (au hasard sinon) ; en attente jusqu'à ce qu'il serve.
    const sp = etat(L);
    L.poserLaCarte(sp, "spectre", { villageois: vs });
    const sn = { ...sp, phase: "nuit", tour: 5 };
    assert.ok(L.cartePosee(sn, "spectre"));
    const acts = [{ acteurId: "b", roleCle: "meute", cibles: ["a"] }];
    assert.deepEqual(L.nuitDeLaGazette(sn, 5, vs, acts).etapes.find(x => x.roleCle === "spectre").acteurIds, ["a"]);
    assert.deepEqual(L.candidatsDeLEtape(sn, { roleCle: "spectre", villageois: vs, actions: acts }), ["b", "e"]);
    p = L.preparerLaNuit(sn, { villageois: vs, actions: [...acts, { acteurId: "a", roleCle: "spectre", cibles: ["e"] }], tour: 5, hasard: () => 0 });
    assert.deepEqual(p.spectre, { victime: "a", loup: "e" });
    assert.ok(!p.actions.some(a => a.roleCle === "meute"));
  },

  "la Nuit des sots (les loups lisent, trois tueurs chassent) ; le Bal la nuit (un loup danseur ne chasse pas) ; le Méchant Benêt (le premier mort)"(L) {
    const vs = village().map(x => (x.id === "c" ? { ...x, role: role("herboriste", "village", "remede") } : x.id === "d" ? { ...x, role: role("braconniere", "village", "emporter") }
      : x.id === "f" ? { ...x, role: role("liseuse-de-cendres", "village", "voir-role", { actif: true, ordre: 4, cibles: 1 }) } : x));
    const e = etat(L);
    L.poserLaCarte(e, "nuit-des-sots", { villageois: vs });
    const n = { ...e, phase: "nuit", tour: 3 };
    const g = L.nuitDeLaGazette(n, 3, vs, []);
    assert.deepEqual(g.meute.sort(), ["c", "d", "f"]);
    assert.deepEqual(g.etapes.find(x => x.roleCle === "sots-voyance").acteurIds.sort(), ["b", "e"]);
    const o = L.ordreDeNuit(vs, 3, { gazette: g });
    assert.deepEqual(o.find(x => x.roleCle === "meute").acteurIds.sort(), ["c", "d", "f"]);
    assert.ok(!o.some(x => x.roleCle === "liseuse-de-cendres"), "son rôle dort cette nuit");
    const p = L.preparerLaNuit(n, { villageois: vs, actions: [{ acteurId: "c", roleCle: "meute", cibles: ["b"] }], tour: 3 });
    assert.deepEqual(p.villageois.filter(x => x.camp === "meute").map(x => x.id).sort(), ["c", "d", "f"]);
    assert.deepEqual(L.chasseursDeLaGazette(n, 3, vs).sort(), ["c", "d", "f"]);
    const r = L.resoudreNuit({ villageois: p.villageois, actions: p.actions, tour: 3 });
    assert.deepEqual(r.morts, ["b"], "un loup tombe sous leurs coups");
    // Le Bal : b (loup, jeune) danse, e (loup, vieux) chasse.
    const bal = etat(L);
    L.poserLaCarte(bal, "bal-du-samedi", { villageois: village() });
    assert.deepEqual(L.chasseursDeLaGazette({ ...bal, phase: "nuit", tour: 3 }, 3, village()), ["e"]);
    const pb = L.preparerLaNuit({ ...bal, phase: "nuit", tour: 3 }, { villageois: village(), actions: [{ acteurId: "b", roleCle: "meute", cibles: ["f"] }], tour: 3 });
    assert.deepEqual(pb.actions, [], "le loup danseur ne chasse pas");
    assert.deepEqual(pb.immunises.sort(), ["a", "b", "c", "d"]);
    // Le Méchant Benêt : le premier mort, en tout début de nuit.
    const mb = etat(L, { morts: [{ acteurId: "g", tour: 1, cause: "meute" }, { acteurId: "h", tour: 2, cause: "vote" }] });
    L.poserLaCarte(mb, "mechant-benet", { villageois: village() });
    const morts = village().map(x => (["g", "h"].includes(x.id) ? { ...x, vivant: false } : x));
    assert.deepEqual(L.nuitDeLaGazette({ ...mb, phase: "nuit", tour: 3 }, 3, morts, []).etapes.find(x => x.roleCle === "benet").acteurIds, ["g"]);
    assert.deepEqual(L.candidatsDeLEtape(mb, { roleCle: "benet", villageois: morts }).sort(), ["a", "b", "c", "d", "e", "f"],
      "tous les vivants, loups compris (ne proposer que les autres lui montrerait la meute en creux)");
  },

  "les votes : Grande Défiance (deux amis, jamais soi ; sans voix, éliminés) ; à tour de rôle vers la gauche ; Cauchemar (les plus cités) ; Châtiment"(L) {
    let e = etat(L, { phase: "jour" });
    e = L.ouvrirVote(e, { candidats: ["a", "b", "c", "d"], mode: "defiance" });
    assert.equal(L.enregistrerVote(e, { votant: "a", cible: "a" }).raison, "soi");
    for (const [x, y] of [["a", "b"], ["a", "c"], ["b", "a"], ["b", "c"], ["c", "a"], ["d", "a"]]) e = L.enregistrerVote(e, { votant: x, cible: y }).etat;
    assert.equal(L.enregistrerVote(e, { votant: "a", cible: "d" }).raison, "defiance");
    e = L.enregistrerVote(e, { votant: "a", cible: "c" }).etat;
    assert.deepEqual(e.vote.votes.a, ["b"], "un second clic retire un ami");
    let r = L.cloreVote(e, { votants: ["a", "b", "c", "d"] }).resultat;
    assert.deepEqual(r.elus.sort(), ["d"]);
    assert.deepEqual(L.decompterDefiance({ votes: { a: ["a", "b", "c", "x"], b: ["c"] }, candidats: ["a", "b", "c"] }).decompte, { a: 0, b: 1, c: 2 }, "jamais soi, deux au plus");
    // À tour de rôle (le Cauchemar) : du voisin de gauche du dernier éliminé (h mort : g), vers la gauche.
    const vs = village().map(x => (x.id === "h" ? { ...x, vivant: false } : x));
    const ec = etat(L, { phase: "aube", morts: [{ acteurId: "h", tour: 1, cause: "vote" }] });
    assert.equal(L.premierDuCauchemar(ec, vs), "g");
    assert.deepEqual(L.ordreAGauche(ec, vs, "c"), ["c", "b", "a", "g", "f", "e", "d"]);
    let x = L.ouvrirVote(ec, { candidats: ["a", "b", "c"], mode: "suite", ordre: ["c", "b", "a"], cauchemar: true });
    assert.equal(x.vote.mainLevee, true, "les accusations sont publiques");
    assert.equal(L.enregistrerVote(x, { votant: "a", cible: "b" }).raison, "tour");
    for (const [y, z] of [["c", "a"], ["b", "c"], ["a", "c"]]) x = L.enregistrerVote(x, { votant: y, cible: z }).etat;
    assert.equal(x.vote.rang, 3);
    r = L.cloreVote(x, { votants: ["a", "b", "c"] }).resultat;
    assert.deepEqual(r.elus, ["c"]);
    assert.deepEqual(L.plusCites({ a: 2, b: 2, c: 1 }), ["a", "b"], "les plus cités, ex æquo compris");
    // Le Châtiment : l'accusé ne vote pas ; moins de deux soutiens, condamné.
    let ch = L.ouvrirVote(etat(L), { candidats: ["a"], objet: "chatiment" });
    assert.equal(ch.phase, "aube", "sans changer de phase");
    assert.deepEqual(L.filtrerVotants(ch, ["a", "b", "c"], "chatiment"), ["b", "c"]);
    ch = L.enregistrerVote(ch, { votant: "b", cible: "a" }).etat;
    assert.deepEqual(L.cloreVote(ch, { votants: ["b", "c"] }).resultat.elus, ["a"]);
    ch = L.enregistrerVote(ch, { votant: "c", cible: "a" }).etat;
    assert.deepEqual(L.cloreVote(ch, { votants: ["b", "c"] }).resultat.elus, [], "deux soutiens : épargné");
  },

  "les effets posés : Saint-Vincent, Revenue (la dernière victime de la meute), Châtiment, Cauchemar, Exécuteur ; le Jour des sots et ses pouvoirs rendus"(L) {
    const vs = village();
    const e = etat(L, { bailli: { actif: true, acteurId: "c", election: 2 } });
    L.poserLaCarte(e, "saint-vincent", { villageois: vs });
    assert.deepEqual([e.bailli.acteurId, e.bailli.election], ["", -1]);
    assert.ok(e.registre.some(x => x.type === "bailli" && x.comment === "destitue" && x.de === "c"));
    const morts = vs.map(x => (["a", "c"].includes(x.id) ? { ...x, vivant: false } : x));
    const r = etat(L, { morts: [{ acteurId: "a", tour: 1, cause: "meute" }, { acteurId: "c", tour: 2, cause: "vote" }] });
    assert.deepEqual(L.poserLaCarte(r, "revenante", { villageois: morts }).gestes, [{ type: "revenir", acteurId: "a" }]);
    assert.deepEqual(L.poserLaCarte(r, "chatiment", { villageois: morts }).gestes, [{ type: "chatiment", par: "c" }], "le dernier éliminé désigne");
    assert.deepEqual(L.poserLaCarte(etat(L), "cauchemar", { villageois: vs }).gestes, [{ type: "cauchemar" }]);
    const ex = etat(L);
    assert.deepEqual(L.poserLaCarte(ex, "executeur", { villageois: vs }).gestes, [{ type: "election-executeur" }]);
    assert.equal(L.electionExecuteurDue(ex, vs), true);
    L.elireExecuteur(ex, { elus: ["d"], decompte: { d: 3 }, numero: 0 }, { villageois: vs });
    assert.equal(L.executeurEnCharge(ex, vs), "d");
    assert.equal(L.electionExecuteurDue(ex, vs), false);
    assert.equal(L.roleCacheParLaGazette(ex, { cause: "vote", villageois: vs }), "executeur");
    assert.equal(L.roleCacheParLaGazette(ex, { cause: "meute", villageois: vs }), "");
    L.poserLaCarte(ex, "enfouissement", { villageois: vs });
    assert.equal(L.roleCacheParLaGazette(ex, { cause: "meute", villageois: vs }), "enfouissement");
    // Toute mort que le village apprend « dans la nuit » : en révéler une trahirait que ce n'était pas la meute.
    for (const cause of ["poison", "feu", "peste", "spectre", "epie", "nuit"]) assert.equal(L.roleCacheParLaGazette(ex, { cause, villageois: vs }), "enfouissement", cause);
    for (const cause of ["chagrin", "emporte", "narrateur"]) assert.equal(L.roleCacheParLaGazette(ex, { cause, villageois: vs }), "", cause);
    // Le Jour des sots : l'Herboriste et la Liseuse échangent effet, réveil, usages ; les fioles suivent ; au matin, tout revient.
    const fiche = (cle, effet, nuit, usages) => ({ camp: "village", role: { name: cle, system: { cle, effet, nuit, usages } } });
    const s = etat(L, { tour: 2, fioles: { c: { remede: true } }, fiches: { c: fiche("herboriste", "remede", { actif: true, ordre: 50 }, { max: 2, restant: 1 }),
      f: fiche("liseuse-de-cendres", "voir-role", { actif: true, ordre: 4 }, { max: 0, restant: 0 }) } });
    const vsots = vs.map(x => (x.id === "c" ? { ...x, role: { cle: "herboriste" } } : x.id === "f" ? { ...x, role: { cle: "liseuse-de-cendres" } } : x));
    L.poserLaCarte(s, "jour-des-sots", { villageois: vsots });
    assert.deepEqual([s.fiches.c.role.system.effet, s.fiches.f.role.system.effet, s.fiches.f.role.system.nuit.ordre], ["voir-role", "remede", 50]);
    assert.equal(s.fiches.f.role.system.cle, "liseuse-de-cendres", "la carte reste la sienne");
    assert.deepEqual(s.fioles.f, { remede: true }, "les fioles déjà vidées suivent le remède");
    s.fioles.f = { remede: true, poison: true };
    s.fiches.f.role.system.usages.restant = 0;
    assert.equal(L.amoursSuspendues({ ...s, phase: "jour" }), true);
    assert.equal(L.amoursSuspendues({ ...s, phase: "nuit", tour: 3 }), true);
    const apres = { ...s, tour: 3 };
    L.finDuTourDeLaGazette(apres, 3);
    assert.deepEqual([apres.fiches.c.role.system.effet, apres.fiches.f.role.system.effet], ["remede", "voir-role"]);
    assert.equal(apres.fiches.c.role.system.usages.restant, 0, "l'usage pris par l'autre est perdu pour de bon");
    assert.deepEqual(apres.fioles.c, { remede: true, poison: true });
    assert.equal(apres.fioles.f, undefined);
  },

  "les privés de vote, la conduite (Ni loup ni moi : le relevé) ; le Jour des sots impose le vote ; la variante d'un jour"(L) {
    const e = etat(L, { phase: "jour" });
    L.poserLaCarte(e, "ni-loup-ni-moi", { villageois: village() });
    assert.deepEqual(L.conduiteDuJour(e), ["ni-loup-ni-moi"]);
    assert.equal(L.motInterdit("C'est sûrement un loup !"), "loup");
    assert.equal(L.motInterdit("Moi, je n'ai rien vu."), "moi");
    assert.equal(L.motInterdit("La louve est passée, emmène-moi."), "moi");
    assert.equal(L.motInterdit("Le louveteau et la moisson."), "", "ni louveteau ni moisson");
    assert.equal(L.motInterdit("I think it's a wolf", "en"), "wolf");
    e.gazette = { ...L.normaliserGazette(e.gazette), prives: [{ tour: 2, acteurId: "a", cle: "ni-loup-ni-moi" }] };
    assert.deepEqual(L.filtrerVotants(e, ["a", "b"], "execution"), ["b"]);
    assert.deepEqual(L.filtrerVotants(e, ["a", "b"], "bailli"), ["a", "b"], "l'élection du Bailli n'est pas touchée");
    const s = etat(L, { phase: "jour" });
    L.poserLaCarte(s, "jour-des-sots", { villageois: village() });
    const vs = village().map(x => (x.id === "a" ? { ...x, amoureux: "c" } : x));
    assert.equal(L.voteImpose(s, "a", vs), "c");
    assert.equal(L.voteImpose(etat(L), "a", vs), "");
    const lg = etat(L, { variantes: { chaine: false } });
    L.poserLaCarte(lg, "lundi-gris", { villageois: village() });
    assert.equal(L.appliquerLaVarianteDuJour(lg).cle, "chaine");
    assert.equal(lg.variantes.chaine, true);
    const lendemain = { ...lg, tour: 3 };
    L.finDuTourDeLaGazette(lendemain, 3);
    assert.equal(lendemain.variantes.chaine, false, "pour ce seul tour");
  },

  "le Crieur public : le Bailli le nomme (jamais lui-même), le transmet s'il est élu, un nouveau Bailli garde ou change ; l'annonce dès le lendemain"(L) {
    const vs = village();
    const e = etat(L, { bailli: { actif: true, acteurId: "c" }, gazette: { crieur: { actif: true } }, gazetteSecret: { main: ["lune-noire"] } });
    let a = L.attenteDuCrieur(e, vs);
    assert.equal(a.quoi, "nommer");
    assert.ok(!a.candidats.includes("c"), "jamais lui-même");
    L.nommerLeCrieur(e, { acteurId: "d", par: "c" });
    assert.equal(L.attenteDuCrieur(e, vs), null);
    assert.equal(L.annonceDuCrieurDue(e, vs), false, "pas le jour de sa nomination");
    assert.equal(L.annonceDuCrieurDue({ ...e, tour: 3 }, vs), true);
    assert.equal(L.raisonDeLaRevocation({ ...e, tour: 3 }, vs), "annonce", "après l'annonce seulement");
    e.bailli = { actif: true, acteurId: "f" };
    a = L.attenteDuCrieur(e, vs);
    assert.deepEqual([a.quoi, a.candidats[0]], ["garder", "d"], "un nouveau Bailli garde ou change");
    e.bailli = { actif: true, acteurId: "d" };
    assert.equal(L.attenteDuCrieur(e, vs).quoi, "transmettre", "élu Bailli, il transmet sa charge");
    const mort = vs.map(x => (x.id === "d" ? { ...x, vivant: false } : x));
    e.bailli = { actif: true, acteurId: "f" };
    e.gazette.crieur.par = "f";
    assert.equal(L.attenteDuCrieur(e, mort).quoi, "nommer", "mort, le Bailli désigne son successeur");
    assert.equal(L.attenteDuCrieur({ ...e, gazetteSecret: { main: [] } }, mort), null, "sans carte, plus de charge à pourvoir");
  },

  "le Spiritisme : les 20 questions, leur vraie réponse (traits, camps, voisins, Bailli, la Liseuse de cendres)"(L) {
    const vs = village().map(x => (x.id === "c" ? { ...x, role: role("herboriste") } : x));
    const e = etat(L, { bailli: { actif: true, acteurId: "b" } });
    const q = (question, spirite = "a", designes = []) => L.reponseDeLEsprit({ question, etat: e, villageois: vs, spirite, designes });
    assert.equal(q("meme-camp", "a", ["b", "e"]), true);
    assert.equal(q("meme-camp", "a", ["a", "b"]), false);
    assert.equal(q("loup-lunettes"), true);
    assert.equal(q("herboriste-homme"), false);
    assert.equal(q("bailli-villageois"), false);
    assert.equal(q("loup-bailli"), true);
    assert.equal(q("loup-homme"), true);
    assert.equal(q("loup-femme"), true);
    assert.equal(q("loups-hommes"), false);
    assert.equal(q("loups-femmes"), false);
    assert.equal(q("voisin-loup", "a", ["a"]), true, "b est à côté de a");
    assert.equal(q("voisin-loup", "a", ["g"]), false);
    assert.equal(q("designe-villageois", "a", ["d"]), true);
    assert.equal(q("suis-je-villageois", "c"), false);
    assert.equal(q("suis-je-loup", "e"), true);
    assert.equal(q("loup-bourg"), true);
    assert.equal(q("loup-pipe"), true);
    assert.equal(q("loups-voisins"), false);
    assert.equal(q("loup-bijou"), false);
    assert.equal(q("loup-sabots"), false);
    assert.equal(q("loup-coiffe"), false);
    assert.equal(q("liseuse-a-vu-loup"), false);
    assert.equal(L.reponseDeLEsprit({ question: "liseuse-a-vu-loup", etat: { ...e, gazetteSecret: { vuUnLoup: true } }, villageois: vs }), true);
    const mortB = vs.map(x => (x.id === "b" ? { ...x, vivant: false } : x));
    assert.equal(L.reponseDeLEsprit({ question: "loups-femmes", etat: e, villageois: mortB }), true, "les loups en vie seulement");
    assert.equal(L.premierMort({ morts: [{ acteurId: "h" }, { acteurId: "g" }] }), "h");
    assert.equal(L.liseuseAVuUnLoup([{ acteurId: "f", roleCle: "liseuse-de-cendres", cibles: ["b"] }],
      village().map(x => (x.id === "f" ? { ...x, role: role("liseuse-de-cendres", "village", "voir-role") } : x))), true);
  },

  "le secret : le paquet, la main du Crieur, les pouvoirs des sots, les alliés hors de l'état public ; les traits et la Gazette publics"(L) {
    const e = etat(L, { gazette: { actif: true }, gazetteSecret: { paquet: ["depit"], main: ["lune-noire"], allies: ["a"], vuUnLoup: true, seance: { tour: 2, par: "c" } } });
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.gazetteSecret, L.gazetteSecretInitial());
    assert.deepEqual(secret.gazetteSecret.paquet, ["depit"]);
    assert.equal(pub.gazette.actif, true);
    assert.ok(pub.traits.a);
    const f = L.fusionnerEtat(pub, secret);
    assert.deepEqual(f.gazetteSecret.main, ["lune-noire"]);
    assert.deepEqual(L.seanceDuMatin(f), { tour: 2, par: "c" });
    // L'allié secret du Méchant Benêt gagne avec la meute (bilan de fin).
    const vs = [{ id: "a", camp: "village", vivant: true }, { id: "b", camp: "meute", vivant: true }, { id: "c", camp: "village", vivant: true }];
    assert.deepEqual(L.bilanDePartie({ villageois: vs, vainqueur: "meute", allies: ["a"] }).filter(l => l.gagnant).map(l => l.id).sort(), ["a", "b"]);
    assert.deepEqual(L.bilanDePartie({ villageois: vs, vainqueur: "village", allies: ["a"] }).filter(l => l.gagnant).map(l => l.id), ["c"]);
  }
};

const MUTATIONS = [
  ["gazette.mjs", "    const v = choisir(valeurs.filter(x => compte[x] === min), hasard);", "    const v = choisir(valeurs, hasard);", "traits : moitié-moitié"],
  ["gazette.mjs", "      bourg: typeof x.bourg === \"boolean\" ? x.bourg : habiteLeBourg(v.maison)", "      bourg: true", "traits : bourg ou écart"],
  ["gazette.mjs", "choisir(libres.length ? libres : [a, b], hasard)", "choisir([a, b], hasard)", "traits : des âges distincts"],
  ["gazette.mjs", "  if (c.attente) return [{ type: \"permanent\", quand: c.sorte === \"nuit\" ? \"nuit\" : \"jour\" }];\n", "", "cartes en attente"],
  ["gazette.mjs", "(tour - 2) % g.rythme === 0", "true", "le rythme"],
  ["gazette.mjs", "export const moitieLaPlusJeune = (etat, ids) => parAge(etat, ids).slice(0, Math.max(1, Math.floor(ids.length / 2)));", "export const moitieLaPlusJeune = (etat, ids) => parAge(etat, ids);", "Bal : la moitié"],
  ["gazette.mjs", "      const femmes = duGenre(etat, vivants, \"femme\");\n      absents(femmes);", "      const femmes = vivants;\n      absents(femmes);", "Cueillette : les femmes"],
  ["gazette.mjs", "        etat.fioles = { ...objet(etat.fioles), [h.id]: { ...vides, [fiole]: false } };", "", "Cueillette : la fiole"],
  ["gazette.mjs", "        marquer(g, \"triple\", tour + 1, [commis], cle);", "        marquer(g, \"triple\", tour, [commis], cle);", "Petit Commis : le lendemain"],
  ["gazette.mjs", "  if (c.min && vivants.length < c.min) {", "  if (false) {", "Crue : six vivants"],
  ["gazette.mjs", "  sortie.actions = sortie.actions.filter(a => ![CLE_TOUCHER, CLE_CRUE, CLE_SPECTRE, CLE_BENET].includes(a.roleCle));", "", "le geste n'est pas une attaque"],
  ["gazette.mjs", "    const unanime = proieDeLaMeute(sortie.actions, { unanime: true });", "    const unanime = proieDeLaMeute(sortie.actions);", "Retour de flamme : la meute d'accord"],
  ["gazette.mjs", "    const loup = anciens.includes(choix) ? choix : choisir(anciens, hasard) ?? \"\";", "    const loup = choisir(anciens, hasard) ?? \"\";", "Spectre : le loup désigné"],
  ["gazette.mjs", "    sortie.villageois = villageois.map(v => (v.camp === \"meute\" && vivant(v) ? { ...v, camp: \"village\" } : tueurs.has(v.id) ? { ...v, camp: \"meute\" } : v));",
    "    sortie.villageois = villageois;", "Nuit des sots : les camps d'une nuit"],
  ["gazette.mjs", "    sortie.sansReveil = [...loups, ...tueurs];", "    sortie.sansReveil = [];", "Nuit des sots : leurs rôles dorment"],
  ["gazette.mjs", "    case CLE_BENET: return vivants.map(v => v.id);", "    case CLE_BENET: return vivants.filter(v => v.camp !== \"meute\").map(v => v.id);", "Méchant Benêt : tous les vivants, loups compris"],
  ["gazette.mjs", "export const premierMort = etat => String((etat?.morts ?? [])[0]?.acteurId ?? \"\");", "export const premierMort = etat => String((etat?.morts ?? []).at(-1)?.acteurId ?? \"\");", "le premier mort"],
  ["gazette.mjs", "    const amis = [...new Set([].concat(choix ?? []).filter(id => id && id !== votant && id in decompte))].slice(0, VOIX_DE_LA_DEFIANCE);",
    "    const amis = [...new Set([].concat(choix ?? []).filter(id => id && id in decompte))];", "Défiance : deux amis, pas soi"],
  ["etat.mjs", "    if (suite.length > VOIX_DE_LA_DEFIANCE) return { etat, ok: false, raison: \"defiance\" };", "", "Défiance : pas plus de deux"],
  ["gazette.mjs", "  return max > 0 ? Object.keys(decompte).filter(id => decompte[id] === max).sort() : [];", "  return max > 0 ? [Object.keys(decompte).find(id => decompte[id] === max)] : [];", "Cauchemar : les plus cités, ex æquo compris"],
  ["gazette.mjs", "  if (objetDuVote === \"chatiment\") for (const id of etat?.vote?.candidats ?? []) hors.add(id);", "", "Châtiment : l'accusé ne vote pas"],
  ["gazette.mjs", "  return (dernier && premierAGauche(etat, villageois, dernier))", "  return (dernier && cercleDe(etat, villageois)[0])", "Cauchemar : le voisin de gauche"],
  ["gazette.mjs", "sortie.gestes.push({ type: \"revenir\", acteurId: m.acteurId });", "sortie.gestes.push({ type: \"revenir\", acteurId: etat.morts.at(-1).acteurId });", "Revenue : la victime de la meute"],
  ["gazette.mjs", "    for (const [de, vers, sys] of [[a.id, b.id, fa.role.system], [b.id, a.id, fb.role.system]]) {", "    for (const [de, vers, sys] of []) {", "Jour des sots : les fioles suivent"],
  ["gazette.mjs", "  for (const [a, b] of s.sots.paires) {", "  for (const [a, b] of []) {", "Jour des sots : les pouvoirs rendus"],
  ["gazette.mjs", "  if (actuel && actuel === bailli) return { quoi: \"transmettre\"", "  if (false) return { quoi: \"transmettre\"", "Crieur : transmettre"],
  ["gazette.mjs", "  const autres = villageois.filter(v => vivant(v) && v.id !== bailli).map(v => v.id);", "  const autres = villageois.filter(v => vivant(v)).map(v => v.id);", "Crieur : jamais le Bailli"],
  ["gazette.mjs", "  return c.actif && Boolean(c.acteurId) && vivant(villageois.find(v => v.id === c.acteurId)) && Number(etat?.tour) > c.depuis", "  return c.actif && Boolean(c.acteurId) && vivant(villageois.find(v => v.id === c.acteurId))", "Crieur : dès le lendemain"],
  ["gazette.mjs", "    case \"loups-voisins\": return loups.some(", "    case \"loups-voisins\": return !loups.some(", "Spiritisme : des loups voisins"],
  ["gazette.mjs", "    case \"loups-femmes\": return loups.length > 0 && loups.every(id => trait(id, \"genre\") === \"femme\");", "    case \"loups-femmes\": return loups.some(id => trait(id, \"genre\") === \"femme\");", "Spiritisme : tous des femmes"],
  ["gazette.mjs", "  const loups = villageois.filter(v => vivant(v) && v.camp === \"meute\").map(v => v.id);\n  const trait", "  const loups = villageois.filter(v => v.camp === \"meute\").map(v => v.id);\n  const trait", "Spiritisme : les loups en vie"],
  ["gazette.mjs", "    case \"voisin-loup\": {", "    case \"voisin-loup-x\": {", "Spiritisme : les voisins"],
  ["gazette.mjs", "  return propre.split(/[^\\p{L}'’-]+/u).flatMap(m => m.split(/['’-]/)).find(m => mots.includes(m)) ?? \"\";", "  return mots.find(m => propre.includes(m)) ?? \"\";", "Ni loup ni moi : des mots entiers"],
  ["etat.mjs", "  pub.gazetteSecret = gazetteSecretInitial();", "", "les secrets de la Gazette hors de l'état public"],
  ["pacte.mjs", "  return filtrerVotantsDeLaGazette(etat, filtrerVotantsDuVillage(etat, admis, objet), objet);", "  return filtrerVotantsDuVillage(etat, admis, objet);", "les votants de la Gazette"],
  ["victoire.mjs", "    for (const id of allies) if (parId.has(id)) { if (vainqueur === \"meute\") gagnants.add(id); else gagnants.delete(id); }", "", "l'allié gagne avec la meute"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-gazette-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === fichier) {
      assert.ok(texte.includes(avant), `mutation introuvable dans ${f} : ${avant}`);
      texte = texte.replace(avant, () => apres);
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

test("Pacte, étape 9 (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("Pacte, étape 9 (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
