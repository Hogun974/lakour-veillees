// Pouvoirs de JOUR des « Veillées de Brumecombe » (logique pure, systems/lakour-loups/logique/jour.mjs) et leurs effets sur
// la nuit suivante (resolution.mjs) : les 14 métiers, le Juge de paix, la Conteuse, le Messager (de nuit), les bâtiments
// (Chapelle, Moulin, Taverne, Puits, Forge, Cimetière, Pont, Lavoir, Grange). Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../systems/lakour-loups/logique/index.mjs";

// Villageois « à plat » : maison n° = rang, métier et rôle par clé.
const ROLE = {
  loup: { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 }, usages: { max: 0, restant: 0 } },
  affame: { cle: "loup-affame", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 42, cibles: 1 }, usages: { max: 0, restant: 0 } },
  hurleur: { cle: "loup-hurleur", camp: "meute", effet: "silence", nuit: { actif: true, ordre: 43, cibles: 1 }, usages: { max: 0, restant: 0 } },
  garde: { cle: "garde-du-pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1, soiMeme: true }, usages: { max: 0, restant: 0 } },
  liseuse: { cle: "liseuse-de-cendres", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 60, cibles: 1 }, usages: { max: 0, restant: 0 } },
  herboriste: { cle: "herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 1, soiMeme: true }, usages: { max: 2, restant: 2 } },
  pyromane: { cle: "pyromane", camp: "solitaire", effet: "asperger", nuit: { actif: true, ordre: 55, cibles: 1, soiMeme: true }, usages: { max: 0, restant: 0 } },
  messager: { cle: "messager", camp: "village", effet: "messager", nuit: { actif: true, ordre: 10, cibles: 2, soiMeme: true }, usages: { max: 0, restant: 0 } },
  juge: { cle: "juge-de-paix", camp: "village", effet: "annuler-vote", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  conteuse: { cle: "conteuse", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  villageois: { cle: "villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
let rang = 0;
const v = (id, role = "villageois", { metier = "", maison, ...extra } = {}) => ({
  id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: maison ?? `Maison ${++rang}`, silence: false, amoureux: "", protections: 0,
  role: structuredClone(ROLE[role]), metier: metier ? { cle: metier, usages: { max: 1, restant: 1 } } : null, ...extra
});
function village() {
  rang = 0;
  return [v("l1", "loup", { metier: "meuniere" }), v("l2", "loup", { metier: "tisserande" }), v("g", "garde", { metier: "forgeron" }),
    v("li", "liseuse", { metier: "garde" }), v("h", "herboriste", { metier: "cure" }), v("x", "villageois", { metier: "aubergiste" }),
    v("y", "villageois", { metier: "passeur" }), v("j", "juge", { metier: "chasseresse" }), v("c", "conteuse", { metier: "apothicaire" }),
    v("t", "villageois", { metier: "tanneur" }), v("m", "villageois", { metier: "maitresse-d-ecole" }), v("k", "villageois", { metier: "colporteur-de-nouvelles" })];
}
const etatDuJour = (extra = {}) => ({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1,
  batimentsCles: ["chapelle", "moulin", "taverne", "puits", "forge", "cimetiere", "pont", "lavoir", "grange"], ...extra });
const agir = (vs, etat, acteurId, pouvoir, cibles = [], texte = "") => L.appliquerPouvoir({ villageois: vs, etat, acteurId, pouvoir, cibles, texte, hasard: () => 0, maintenant: 1000 });
const nuitApres = (vs, etat, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: etat.tour + 1, hasard: () => 0,
  jour: L.effetsDeLaNuit(etat, etat.tour + 1), ...extra });
const meute = cible => ({ acteurId: "l1", roleCle: "meute", cibles: [cible] });

// ------------------------------------------------------------------ ce que chacun possède, et quand
test("pouvoirs possédés : métier, rôle de jour (Juge de paix, Conteuse), bâtiments des joueurs en jeu ; la Chapelle est au village", () => {
  const vs = village();
  assert.deepEqual(L.pouvoirsPossedes(vs.find(x => x.id === "j"), ["taverne", "chapelle"]), ["chasseresse", "juge-de-paix", "taverne"]);
  assert.deepEqual(L.pouvoirsPossedes(vs.find(x => x.id === "x"), []), ["aubergiste"]);
  assert.equal(Object.keys(L.POUVOIRS_JOUR).length, 24, "14 métiers, 5 rôles (Juge de paix, Conteuse, 3 gens de passage), 5 bâtiments");
});

test("moments : jamais la nuit ni avant la partie ; « au matin » seulement après une nuit résolue ; un usage ; pas les morts", () => {
  const vs = village();
  const ok = (etat, a, p, c) => L.verifierPouvoir({ villageois: vs, etat, acteurId: a, pouvoir: p, cibles: c }).raison;
  assert.equal(ok(etatDuJour({ phase: "nuit" }), "g", "forgeron", ["x"]), "phase");
  assert.equal(ok(etatDuJour({ phase: "preparation" }), "g", "forgeron", ["x"]), "phase");
  assert.equal(ok(etatDuJour({ phase: "vote" }), "g", "forgeron", ["x"]), "", "pendant le jour : jusqu'à la nuit");
  assert.equal(ok(etatDuJour({ phase: "vote" }), "j", "chasseresse", ["x"]), "phase", "au matin : pas pendant le vote");
  assert.equal(ok(etatDuJour({ nuitResolue: 0 }), "j", "chasseresse", ["x"]), "nuit");
  assert.equal(ok(etatDuJour(), "x", "forgeron", ["x"]), "absent", "pas son métier");
  assert.equal(ok(etatDuJour(), "g", "forgeron", ["inconnu"]), "cibles");
  assert.equal(ok(etatDuJour(), "g", "taverne", []), "", "un bâtiment en jeu");
  assert.equal(ok(etatDuJour({ batimentsCles: [] }), "g", "taverne", []), "batiment");
  const use = vs.map(x => x.id === "g" ? { ...x, metier: { cle: "forgeron", usages: { max: 1, restant: 0 } } } : x);
  assert.equal(L.verifierPouvoir({ villageois: use, etat: etatDuJour(), acteurId: "g", pouvoir: "forgeron", cibles: ["x"] }).raison, "usage");
  const mort = vs.map(x => x.id === "g" ? { ...x, vivant: false } : x);
  assert.equal(L.verifierPouvoir({ villageois: mort, etat: etatDuJour(), acteurId: "g", pouvoir: "forgeron", cibles: ["x"] }).raison, "mort");
  const r = agir(vs, etatDuJour(), "g", "forgeron", ["x"]);
  assert.deepEqual(r.changements, [{ type: "usage", acteurId: "g", objet: "metier" }], "l'usage du métier est consommé");
  assert.equal(L.appliquerPouvoir({ villageois: vs, etat: etatDuJour({ phase: "nuit" }), acteurId: "g", pouvoir: "forgeron", cibles: ["x"] }).ok, false);
});

test("pouvoirsDe : la liste d'un joueur avec ce qui manque, sans exiger les cibles", () => {
  const vs = village();
  const liste = L.pouvoirsDe({ villageois: vs, etat: etatDuJour(), acteurId: "c" });
  assert.deepEqual(liste.map(p => [p.pouvoir, p.possible, p.raison]), [["apothicaire", false, "personne"], ["conteuse", true, ""],
    ["taverne", true, ""], ["forge", true, ""], ["grange", true, ""], ["puits", false, "vivant"]]);
});

// ------------------------------------------------------------------ les métiers
test("Forgeron : un verrou public ; la nuit suivante, la PREMIÈRE attaque de loup échoue, pas la seconde ; le poison passe", () => {
  const vs = [...village(), v("af", "affame")];
  const r = agir(vs, etatDuJour(), "g", "forgeron", ["x"]);
  assert.match(r.annonces[0].texte, /Nom-g forge un verrou pour la maison de Nom-x/);
  assert.deepEqual(r.etat.jour.effets, [{ type: "verrou", acteurId: "g", cible: "x", nuit: 2 }]);
  const une = nuitApres(vs, r.etat, [meute("x")]);
  assert.deepEqual(une.morts, [], "la meute se brise sur le verrou");
  assert.ok(une.sauves.some(s => s.par === "verrou"));
  const deux = nuitApres(vs, r.etat, [meute("x"), { acteurId: "af", roleCle: "loup-affame", cibles: ["x"] }]);
  assert.deepEqual(deux.morts, ["x"], "la seconde attaque passe");
  const poison = nuitApres(vs, r.etat, [{ acteurId: "h", roleCle: "herboriste", cibles: ["x"] }]);
  assert.deepEqual(poison.morts, ["x"]);
  assert.deepEqual(nuitApres(vs, { ...r.etat, tour: 2 }, [meute("x")]).morts, ["x"], "seulement la nuit suivante");
});

test("Meunière : annonce le nombre de loups vivants (mordus compris)", () => {
  const vs = village().map(x => x.id === "y" ? { ...x, camp: "meute" } : x.id === "l2" ? { ...x, vivant: false } : x);
  assert.match(agir(vs, etatDuJour(), "l1", "meuniere").annonces[0].texte, /: 2 loups vivent encore/);
});

test("Garde du guet : la nuit suivante, le gardé ne vise que sa maison ; gardé, un loup ne chasse pas (la meute chasse sans lui)", () => {
  const vs = village();
  const r = agir(vs, etatDuJour(), "li", "garde", ["g"]);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour(), acteurId: "li", pouvoir: "garde", cibles: ["li"] }).raison, "cibles", "pas soi-même");
  assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: r.etat, acteurId: "g", roleCle: "garde-du-pont", tour: 2 }), ["g"]);
  const n = nuitApres(vs, r.etat, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")]);
  assert.deepEqual(n.morts, ["x"], "sa garde n'a pas eu lieu");
  assert.ok(n.messages.some(m => m.destinataire === "g" && m.cle.endsWith("Surveille")));
  assert.deepEqual(nuitApres(vs, r.etat, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["g"] }, meute("g")]).morts, [], "sa propre maison, oui");
  // Un loup gardé : la meute chasse sans lui (il n'entre pas), seul loup libre l2.
  const sur = agir(vs, etatDuJour(), "li", "garde", ["l1"]);
  assert.deepEqual(L.loupsQuiChassent(vs, sur.etat, 2), ["l2"]);
  const lanterne = { ...v("vl", "liseuse"), role: { cle: "veilleuse", camp: "village", effet: "eclairer", nuit: { actif: true, cibles: 1 }, usages: { max: 0, restant: 0 } } };
  const nl = nuitApres([...vs, lanterne], sur.etat, [meute("x"), { acteurId: "vl", roleCle: "veilleuse", cibles: ["x"] }]);
  assert.deepEqual(nl.revelations.map(x => x.acteurId), ["l2"], "le loup gardé n'est jamais celui qui entre");
  const deux = agir(vs, etatDuJour({ jour: { ...L.jourInitial(), effets: [{ type: "surveille", acteurId: "z", cible: "l2", nuit: 2 }] } }), "li", "garde", ["l1"]);
  const vide = nuitApres(vs, deux.etat, [meute("x")]);
  assert.deepEqual(vide.morts, [], "tous les loups gardés : pas de chasse");
});

test("Curé : le béni ne peut plus être réduit au silence (hurlement, lame de la Forge)", () => {
  const vs = [...village(), v("hu", "hurleur")];
  const r = agir(vs, etatDuJour(), "h", "cure", ["x"]);
  assert.match(r.annonces[0].texte, /bénit Nom-x/);
  const n = nuitApres(vs, r.etat, [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["x"] }]);
  assert.ok(!n.changements.some(c => c.type === "silence"));
  assert.ok(n.messages.some(m => m.destinataire === "hu" && m.cle.endsWith("SilenceBeni")));
  const sans = nuitApres(vs, etatDuJour(), [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["x"] }]);
  assert.ok(sans.changements.some(c => c.type === "silence" && c.acteurId === "x"));
});

test("Chasseresse : dit au village si le joueur a quitté sa maison la nuit passée (bilan secret de la nuit)", () => {
  const vs = village();
  const nuit = L.resoudreNuit({ villageois: vs, actions: [meute("x"), { acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["g"] }], hasard: () => 0 });
  assert.deepEqual(nuit.bilan.sorties.sort(), ["l1", "l2", "li"]);
  const etat = L.cloreNuit({ ...etatDuJour(), phase: "nuit" }, { bilan: nuit.bilan });
  etat.phase = "aube";
  assert.match(agir(vs, etat, "j", "chasseresse", ["li"]).annonces[0].texte, /Nom-li a quitté sa maison/);
  assert.match(agir(vs, etat, "j", "chasseresse", ["h"]).annonces[0].texte, /Nom-h n'a pas quitté sa maison/);
  assert.match(agir(vs, etat, "j", "chasseresse", ["l2"]).annonces[0].texte, /a quitté sa maison/, "un loup qui chasse sort");
});

test("Aubergiste et Taverne : la meute n'y tue pas… sauf si un loup y dort, alors sans protection ; trois lits", () => {
  const vs = village();
  const gite = agir(vs, etatDuJour(), "x", "aubergiste", ["h"]);
  assert.deepEqual(nuitApres(vs, gite.etat, [meute("h")]).morts, [], "la meute trouve sa maison vide");
  assert.deepEqual(nuitApres(vs, gite.etat, [{ acteurId: "h", roleCle: "herboriste", cibles: ["h"], effet: "poison" }, { acteurId: "x", roleCle: "x", effet: "poison", cibles: ["h"] }]).morts, ["h"], "le poison l'atteint");
  // Un loup dort aussi à la Taverne : la meute y tue, et la protection du Garde ne joue pas.
  const loup = agir(vs, gite.etat, "l2", "taverne");
  const n = nuitApres(vs, loup.etat, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["h"] }, meute("h")]);
  assert.deepEqual(n.morts, ["h"]);
  assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: gite.etat, roleCle: "meute", tour: 2 }).includes("h"), false, "pas de proie à la Taverne sans loup");
  assert.ok(L.candidatsDeNuit({ villageois: vs, etat: loup.etat, roleCle: "meute", tour: 2 }).includes("h"));
  // Trois lits, hôte compris ; pas deux fois.
  let e = gite.etat;
  e = agir(vs, e, "y", "taverne").etat;
  e = agir(vs, e, "t", "taverne").etat;
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "m", pouvoir: "taverne" }).raison, "plein");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: gite.etat, acteurId: "h", pouvoir: "taverne" }).raison, "deja");
  // Sans Taverne en jeu, le gîte protège toujours de la meute.
  const sans = agir(vs, etatDuJour({ batimentsCles: [] }), "x", "aubergiste", ["h"]);
  assert.deepEqual(nuitApres(vs, { ...sans.etat, batimentsCles: [] }, [meute("h")]).morts, []);
});

test("Apothicaire : rend la voix à un joueur réduit au silence, et seulement à lui", () => {
  const vs = village().map(x => x.id === "y" ? { ...x, silence: true } : x);
  assert.deepEqual(L.candidatsDuPouvoir({ villageois: vs, etat: etatDuJour(), acteurId: "c", pouvoir: "apothicaire" }), ["y"]);
  const r = agir(vs, etatDuJour(), "c", "apothicaire", ["y"]);
  assert.deepEqual(r.changements.at(-1), { type: "silence", acteurId: "y", valeur: false });
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour(), acteurId: "c", pouvoir: "apothicaire", cibles: ["x"] }).raison, "cibles");
});

test("Colporteur de nouvelles et Lavoir : un indice vrai, flou, qui ne nomme personne", () => {
  const vs = village();
  const nuit = L.resoudreNuit({ villageois: vs, actions: [meute("x"), { acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["y"] }], hasard: () => 0.5 });
  for (let i = 0; i < 20; i++) {
    const indice = L.indiceFlou({ bilan: nuit.bilan, villageois: vs, hasard: () => i / 20 });
    for (const x of vs) assert.ok(!indice.texte.includes(x.nom), `${indice.texte} nomme ${x.nom}`);
    if (indice.cle.endsWith("IndiceVisites")) assert.equal(indice.donnees.n, 2);
    if (indice.cle.endsWith("IndiceSorties")) assert.equal(indice.donnees.n, 3);
    if (indice.cle.endsWith("IndicePair") || indice.cle.endsWith("IndiceImpair")) {
      const loup = vs.find(x => x.id === nuit.bilan.loup);
      assert.equal(indice.cle.endsWith("IndicePair"), L.numeroDeMaison(loup.maison) % 2 === 0, "parité vraie");
    }
  }
  assert.match(L.indiceFlou({ bilan: null }).cle, /IndiceRien/);
  const etat = L.cloreNuit({ ...etatDuJour(), phase: "nuit" }, { bilan: nuit.bilan });
  etat.phase = "aube";
  assert.match(agir(vs, etat, "k", "colporteur-de-nouvelles").annonces[0].texte, /crie la nouvelle du matin : /);
});

test("Tisserande : le plus désigné qui porte le ruban gagne une minute, le vote reste ouvert ; le ruban ne sert qu'une fois", () => {
  const vs = village();
  let e = agir(vs, etatDuJour(), "l2", "tisserande", ["x"]).etat;
  e = L.ouvrirVote(e, { candidats: ["x", "y"], maintenant: 0 });
  for (const [votant, cible] of [["a", "x"], ["b", "x"], ["c", "y"]]) e = L.enregistrerVote(e, { votant, cible, maintenant: 0 }).etat;
  const c1 = L.cloreVote(e, { maintenant: 5000 });
  assert.equal(c1.prolonge, "x");
  assert.equal(c1.resultat, null);
  assert.equal(c1.etat.vote.ouvert, true);
  assert.equal(c1.etat.vote.finit, 65000, "une minute de défense");
  assert.deepEqual(c1.etat.jour.rubans, []);
  const c2 = L.cloreVote(c1.etat, { maintenant: 70000 });
  assert.equal(c2.resultat.elu, "x", "après sa défense, le dépouillement");
  // Un ruban sur quelqu'un qui n'est pas en tête ne change rien ; ni sur un vote de la Chapelle.
  let f = agir(vs, etatDuJour(), "l2", "tisserande", ["y"]).etat;
  f = L.ouvrirVote(f, { candidats: ["x", "y"] });
  f = L.enregistrerVote(f, { votant: "a", cible: "x" }).etat;
  assert.equal(L.cloreVote(f).resultat.elu, "x");
  let g = agir(vs, etatDuJour(), "l2", "tisserande", ["x"]).etat;
  g = L.ouvrirVote(g, { candidats: ["x"], objet: "chapelle" });
  g = L.enregistrerVote(g, { votant: "a", cible: "x" }).etat;
  assert.equal(L.cloreVote(g).resultat.elu, "x");
});

test("Passeur et Grange : hors d'atteinte — ni visite, ni meute, ni poison, ni feu ; il n'agit pas, et ne se réveille pas", () => {
  const vs = [...village(), v("p", "pyromane")];
  const r = agir(vs, etatDuJour(), "y", "passeur", ["li"]);
  const n = nuitApres(vs, r.etat, [meute("li"), { acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["l1"] }, { acteurId: "g", roleCle: "garde-du-pont", cibles: ["li"] }]);
  assert.deepEqual(n.morts, []);
  assert.ok(!n.messages.some(m => m.destinataire === "li" && m.cle.endsWith("VoirCamp")), "il n'a pas pu lire les cendres");
  assert.ok(n.messages.some(m => m.destinataire === "li" && m.cle.endsWith("Empeche")));
  assert.ok(n.messages.some(m => m.destinataire === "g" && m.cle.endsWith("PersonneChez")));
  assert.deepEqual(L.candidatsDeNuit({ villageois: vs, etat: r.etat, acteurId: "li", roleCle: "liseuse-de-cendres", tour: 2 }), []);
  assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: r.etat, acteurId: "g", roleCle: "garde-du-pont", tour: 2 }).includes("li"));
  const feu = nuitApres(vs, r.etat, [{ acteurId: "p", roleCle: "pyromane", cibles: ["p"] }], { asperges: ["li", "x"] });
  assert.deepEqual(feu.morts, ["x"], "sa maison brûle vide");
  // La Grange : une fois par joueur, deux places par nuit.
  let e = agir(vs, etatDuJour(), "x", "grange").etat;
  e = agir(vs, e, "t", "grange").etat;
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "m", pouvoir: "grange" }).raison, "plein");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: { ...e, tour: 3 }, acteurId: "x", pouvoir: "grange" }).raison, "deja", "une fois par partie et par joueur");
  assert.deepEqual(nuitApres(vs, e, [meute("x")]).morts, []);
});

test("Tanneur : seulement les morts de la nuit ; traces de crocs pour la meute (vraie cause, gardée secrète), pas pour le poison", () => {
  const vs = village().map(x => ["x", "y", "t"].includes(x.id) && x.id !== "t" ? { ...x, vivant: false } : x);
  let e = etatDuJour({ phase: "aube" });
  e = L.ajouterMort({ ...e, phase: "aube" }, { acteurId: "x", cause: "meute" });
  e = L.ajouterMort(e, { acteurId: "y", cause: "poison" });
  e.morts[1].tour = 0;   // y : mort une nuit plus tôt
  assert.deepEqual(L.candidatsDuPouvoir({ villageois: vs, etat: e, acteurId: "t", pouvoir: "tanneur" }), ["x"]);
  assert.match(agir(vs, e, "t", "tanneur", ["x"]).annonces[0].texte, /traces de crocs/);
  e.morts[1].tour = 1;
  assert.match(agir(vs, e, "t", "tanneur", ["y"]).annonces[0].texte, /aucune trace de crocs/);
  assert.equal(L.etatPublic(e).morts[0].cause, "nuit", "le public ne sait pas que c'était la meute");
});

test("Maîtresse d'école : l'appel commence par le joueur choisi, puis l'ordre des maisons ; les morts ne parlent pas", () => {
  const vs = village().map(x => x.id === "h" ? { ...x, vivant: false } : x);
  const r = agir(vs, etatDuJour(), "m", "maitresse-d-ecole", ["x"]);
  assert.deepEqual(r.etat.jour.appel.ordre, ["x", "y", "j", "c", "t", "m", "k", "l1", "l2", "g", "li"]);
  assert.match(r.annonces[0].texte, /chacun parle 30 secondes, dans cet ordre : Nom-x, Nom-y/);
});

// ------------------------------------------------------------------ les rôles de jour
test("Juge de paix : seulement juste après le dépouillement, avant l'exécution ; il se révèle, le village revote", () => {
  const vs = village();
  let e = L.ouvrirVote(etatDuJour(), { candidats: ["x", "y"], duree: 30000, maintenant: 0 });
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "j", pouvoir: "juge-de-paix" }).raison, "vote", "pas pendant le vote");
  e = L.enregistrerVote(e, { votant: "a", cible: "x", maintenant: 0 }).etat;
  const clos = L.cloreVote(e).etat;
  const r = agir(vs, clos, "j", "juge-de-paix");
  assert.ok(r.ok);
  assert.ok(r.rouvrirVote);
  assert.deepEqual(r.changements, [{ type: "usage", acteurId: "j", objet: "role" }, { type: "revele", acteurId: "j" }]);
  assert.equal(r.etat.vote.ouvert, true);
  assert.deepEqual(r.etat.vote.candidats, ["x", "y"]);
  assert.equal(r.etat.vote.numero, clos.vote.numero + 1);
  assert.deepEqual(r.etat.vote.votes, {}, "on revote de zéro");
  assert.equal(r.etat.vote.finit, 31000, "même durée");
  assert.match(r.annonces[0].texte, /Nom-j, Juge de paix, annule le vote/);
  const execute = vs.map(x => x.id === "x" ? { ...x, vivant: false } : x);
  assert.equal(L.verifierPouvoir({ villageois: execute, etat: clos, acteurId: "j", pouvoir: "juge-de-paix" }).raison, "vote", "trop tard : exécuté");
  const vide = L.cloreVote(L.ouvrirVote(etatDuJour(), { candidats: ["x"] })).etat;
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: vide, acteurId: "j", pouvoir: "juge-de-paix" }).raison, "vote", "personne à sauver");
  const chapelle = L.cloreVote(L.enregistrerVote(L.ouvrirVote(etatDuJour(), { candidats: ["x"], objet: "chapelle" }), { votant: "a", cible: "x" }).etat).etat;
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: chapelle, acteurId: "j", pouvoir: "juge-de-paix" }).raison, "vote", "pas le vote de la Chapelle");
});

test("Conteuse : deux minutes sur un joueur, annoncées sans nommer la Conteuse ni son rôle", () => {
  const vs = village();
  const r = agir(vs, etatDuJour(), "c", "conteuse", ["l1"]);
  assert.deepEqual(r.etat.jour.conteuse, { tour: 1, cible: "l1", jusqua: 121000 });
  assert.doesNotMatch(r.annonces[0].texte, /Nom-c|Conteuse/);
  assert.match(r.annonces[0].texte, /ne parle que de Nom-l1, qui ne peut pas répondre/);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour(), acteurId: "c", pouvoir: "conteuse", cibles: ["c"] }).raison, "cibles");
  assert.equal(L.passerPhase(r.etat, "nuit").jour.conteuse, null);
});

test("Messager : le mot écrit par l'expéditeur va au seul destinataire, sans balises ; un mot vide ne porte rien", () => {
  const vs = [...village(), v("me", "messager")];
  const n = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "me", roleCle: "messager", cibles: ["x", "y"], texte: "  <b>Méfie-toi</b>   du moulin  " }] });
  const pour = id => n.messages.filter(m => m.destinataire === id);
  assert.deepEqual(pour("y").map(m => m.texte), ["Le Messager vous remet un mot de Nom-x : « Méfie-toi du moulin »"]);
  assert.deepEqual(pour("x"), [], "l'expéditeur ne reçoit rien de plus");
  assert.match(pour("me")[0].texte, /remis le mot de Nom-x à Nom-y/);
  assert.equal(L.nettoyerMot("a".repeat(500)).length, 200);
  assert.ok(L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "me", roleCle: "messager", cibles: ["x", "y"] }] }).messages.some(m => m.cle.endsWith("MessagerVide")));
  assert.deepEqual(L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "me", roleCle: "messager", cibles: ["x", "x"], texte: "ok" }] }).messages, []);
});

// ------------------------------------------------------------------ les bâtiments
test("Chapelle : une fois par jour, jamais deux nuits de suite ; la meute n'y entre pas, le poison et le feu passent", () => {
  const vs = [...village(), v("p", "pyromane")];
  const r = agir(vs, etatDuJour(), "", "chapelle", ["x"]);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: r.etat, pouvoir: "chapelle", cibles: ["y"] }).raison, "deja");
  assert.deepEqual(nuitApres(vs, r.etat, [meute("x")]).morts, []);
  assert.deepEqual(nuitApres(vs, r.etat, [{ acteurId: "p", roleCle: "pyromane", cibles: ["p"] }], { asperges: ["x"] }).morts, ["x"]);
  assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: r.etat, roleCle: "meute", tour: 2 }).includes("x"));
  const lendemain = { ...r.etat, tour: 2, nuitResolue: 2 };
  assert.ok(!L.candidatsDuPouvoir({ villageois: vs, etat: lendemain, pouvoir: "chapelle" }).includes("x"), "pas deux nuits de suite");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: lendemain, pouvoir: "chapelle", cibles: ["y"] }).ok, true);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour({ phase: "aube" }), pouvoir: "chapelle", cibles: ["y"] }).raison, "phase", "après le vote, pas à l'aube");
});

test("Forge : une lame par partie ; la meute qui atteint son porteur y laisse du sang, un loup est réduit au silence ; pas à travers un asile", () => {
  const vs = village();
  const r = agir(vs, etatDuJour(), "x", "forge");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: { ...r.etat, tour: 4 }, acteurId: "y", pouvoir: "forge" }).raison, "deja");
  const n = nuitApres(vs, r.etat, [meute("x")]);
  assert.deepEqual(n.morts, ["x"], "la lame ne protège pas");
  assert.deepEqual(n.annonces.map(a => a.texte), ["Du sang de bête sur le seuil."]);
  const blesse = n.changements.find(c => c.type === "silence").acteurId;
  assert.ok(["l1", "l2"].includes(blesse));
  assert.deepEqual(nuitApres(vs, r.etat, [meute("y")]).annonces, [], "la meute est allée ailleurs");
  const abri = agir(vs, r.etat, "", "chapelle", ["x"]);
  assert.deepEqual(nuitApres(vs, abri.etat, [meute("x")]).annonces, [], "la meute n'a pas pu entrer");
});

test("Puits : un mort de ce tour, une fois par partie, dix mots au plus", () => {
  const vs = village().map(x => x.id === "y" ? { ...x, vivant: false } : x);
  const e = L.ajouterMort(etatDuJour(), { acteurId: "y", cause: "vote" });
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "y", pouvoir: "puits", texte: "un deux trois quatre cinq six sept huit neuf dix onze" }).raison, "texte");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "y", pouvoir: "puits", texte: "   " }).raison, "texte");
  const r = agir(vs, e, "y", "puits", [], "Le loup   dort près du moulin");
  assert.match(r.annonces[0].texte, /la voix de Nom-y : « Le loup dort près du moulin »/);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: r.etat, acteurId: "y", pouvoir: "puits", texte: "encore" }).raison, "deja");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: { ...e, tour: 2 }, acteurId: "y", pouvoir: "puits", texte: "trop tard" }).raison, "recent");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "x", pouvoir: "puits", texte: "vivant" }).raison, "vivant");
});

test("Moulin, Lavoir, Cimetière à l'aube : la Meunière vivante apprend en secret, sinon un matin sur deux pour tous ; le Cimetière sans révélation", () => {
  const vs = village();
  const e = etatDuJour();
  const avec = L.annoncesDeLAube({ villageois: vs, etat: e, tour: 1, bilan: null, batiments: ["moulin"] });
  assert.deepEqual(avec.prives.map(m => [m.destinataire, m.donnees.n]), [["l1", 2]]);
  assert.deepEqual(avec.annonces, []);
  const sans = vs.map(x => x.id === "l1" ? { ...x, vivant: false } : x);
  assert.deepEqual(L.annoncesDeLAube({ villageois: sans, etat: e, tour: 1, batiments: ["moulin"] }).annonces, [], "matin impair");
  assert.match(L.annoncesDeLAube({ villageois: sans, etat: e, tour: 2, batiments: ["moulin"] }).annonces[0].texte, /: 1 loup vit encore à Brumecombe/);
  assert.match(L.annoncesDeLAube({ villageois: vs, etat: e, tour: 1, bilan: null, batiments: ["lavoir"] }).annonces[0].texte, /^Au lavoir, on raconte que /);
  const morts = vs.map(x => x.id === "l2" ? { ...x, vivant: false } : x.id === "x" ? { ...x, vivant: false, revele: true } : x);
  const cim = L.annoncesDeLAube({ villageois: morts, etat: e, tour: 1, batiments: ["cimetiere"], revelerALaMort: false });
  assert.deepEqual(cim.cimetiere, ["l2"], "le révélé n'est pas annoncé");
  assert.match(cim.annonces[0].texte, /Nom-l2 était du camp « meute »/);
  assert.deepEqual(L.annoncesDeLAube({ villageois: morts, etat: { ...e, cimetiere: ["l2"] }, tour: 2, batiments: ["cimetiere"], revelerALaMort: false }).annonces, [], "une seule fois");
  assert.deepEqual(L.annoncesDeLAube({ villageois: morts, etat: e, tour: 1, batiments: ["cimetiere"], revelerALaMort: true }).annonces, [], "sans effet si révélés");
});

test("Pont : un tiers des maisons sur l'autre rive ; après une proie tuée là-bas, la meute ne traverse pas la nuit suivante", () => {
  assert.deepEqual(L.maisonsDuVillage(6), ["Maison 1", "Maison 2", "Maison 3", "Maison 4", "Maison 13", "Maison 14"]);
  assert.equal(L.maisonsDuVillage(18).filter(L.surLAutreRive).length, 6);
  assert.equal(L.maisonsDuVillage(12).filter(L.surLAutreRive).length, 4);
  const vs = village().map(x => x.id === "x" ? { ...x, maison: "Maison 13" } : x.id === "y" ? { ...x, maison: "Maison 14" } : x);
  const tue = L.resoudreNuit({ villageois: vs, actions: [meute("x")], hasard: () => 0 });
  assert.equal(tue.pontFranchi, true);
  assert.equal(L.resoudreNuit({ villageois: vs, actions: [meute("g")] }).pontFranchi, false);
  const etat = L.cloreNuit({ ...etatDuJour(), phase: "nuit" }, { pontFranchi: true });
  assert.equal(etat.pont.bloqueNuit, 2);
  assert.ok(!L.candidatsDeNuit({ villageois: vs, etat, roleCle: "meute", tour: 2 }).includes("y"));
  assert.deepEqual(nuitApres(vs, etat, [meute("y")]).morts, [], "la proie de l'autre rive est hors de portée");
  assert.deepEqual(nuitApres(vs, { ...etat, batimentsCles: [] }, [meute("y")]).morts, ["y"], "sans Pont en jeu, rien ne change");
  assert.deepEqual(nuitApres(vs, etat, [meute("g")]).morts, ["g"], "la place reste ouverte");
});

test("Ramoneuse : au matin, dit au village si une maison a reçu de la visite la nuit passée (bilan secret), sans dire qui", () => {
  const vs = [...village(), v("ra", "villageois", { metier: "ramoneuse" })];
  const nuit = L.resoudreNuit({ villageois: vs, actions: [meute("x"), { acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["g"] },
    { acteurId: "g", roleCle: "garde-du-pont", cibles: ["g"] }], hasard: () => 0 });
  assert.deepEqual(nuit.bilan.visites.sort(), ["g", "x"], "la proie et la maison lue ; se garder soi-même n'est pas une visite");
  const etat = L.cloreNuit({ ...etatDuJour(), phase: "nuit" }, { bilan: nuit.bilan });
  etat.phase = "aube";
  const oui = agir(vs, etat, "ra", "ramoneuse", ["g"]);
  assert.match(oui.annonces[0].texte, /Nom-ra monte sur le toit de Nom-g : la suie garde des traces/);
  assert.doesNotMatch(oui.annonces[0].texte, /Nom-li|Liseuse/, "ni qui est venu, ni pourquoi");
  assert.match(agir(vs, etat, "ra", "ramoneuse", ["h"]).annonces[0].texte, /personne n'est venu chez Nom-h/);
  assert.deepEqual(oui.changements, [{ type: "usage", acteurId: "ra", objet: "metier" }]);
  assert.equal(L.verifierPouvoir({ villageois: vs, etat, acteurId: "ra", pouvoir: "ramoneuse", cibles: ["ra"] }).raison, "", "sa propre maison");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour({ nuitResolue: 0 }), acteurId: "ra", pouvoir: "ramoneuse", cibles: ["g"] }).raison, "nuit");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: { ...etat, phase: "vote" }, acteurId: "ra", pouvoir: "ramoneuse", cibles: ["g"] }).raison, "phase", "au matin seulement");
});

test("Éclusière : l'écluse fermée, la meute ne chasse aucune maison de l'autre rive la nuit suivante (comme le Pont bloqué) ; une par nuit", () => {
  const vs = [...village(), v("ec", "villageois", { metier: "eclusiere" }), v("af", "affame"), v("z", "villageois", { maison: "Maison 15" })];
  const r = agir(vs, etatDuJour({ batimentsCles: [] }), "ec", "eclusiere");
  assert.match(r.annonces[0].texte, /Nom-ec ferme l'écluse : la nuit prochaine, l'eau monte sous le Pont/);
  assert.deepEqual(r.etat.jour.effets, [{ type: "ecluse", acteurId: "ec", cible: "ec", nuit: 2 }]);
  assert.equal(L.effetsDeLaNuit(r.etat, 2).pontBloque, true, "même sans le Pont en jeu");
  assert.equal(L.effetsDeLaNuit(r.etat, 3).pontBloque, false, "la nuit suivante seulement");
  assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: r.etat, roleCle: "meute", tour: 2 }).includes("z"));
  assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: r.etat, acteurId: "af", roleCle: "loup-affame", tour: 2 }).includes("z"), "ni le Loup affamé");
  assert.deepEqual(nuitApres(vs, r.etat, [meute("z")]).morts, [], "la proie de l'autre rive est hors de portée");
  assert.deepEqual(nuitApres(vs, r.etat, [{ acteurId: "af", roleCle: "loup-affame", cibles: ["z"] }]).morts, []);
  assert.deepEqual(nuitApres(vs, r.etat, [meute("x")]).morts, ["x"], "la place reste ouverte");
  assert.deepEqual(nuitApres(vs, r.etat, [{ acteurId: "h", roleCle: "herboriste", cibles: ["z"] }]).morts, ["z"], "les autres pouvoirs passent");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: r.etat, acteurId: "ec", pouvoir: "eclusiere" }).raison, "deja", "une écluse par nuit");
  assert.equal(L.verifierPouvoir({ villageois: vs, etat: etatDuJour({ phase: "vote" }), acteurId: "ec", pouvoir: "eclusiere" }).raison, "", "pendant le jour, jusqu'à la nuit");
});
