// Essais par mutation de la logique du lot 3 (logique pure) : les Gens de passage (arrivée, camp secret tiré, rôle public,
// départ et exil sans mort), le Banc des accusés (une accusation par jour, jugements un par un, la moitié des voix), le Glas
// du deuil (pouvoirs croissants de la meute : vision, voix sans visage, linceul ; leur secret) et la Nuit de la Saint-Martin
// (composition à l'autel secret, une nuit, un vote, la fin). Chaque règle est cassée à son tour dans une copie de la logique,
// et la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const ROLE = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 }, usages: { max: 0, restant: 0 } },
  garde: { cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1 }, usages: { max: 0, restant: 0 } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse de cendres", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 60, cibles: 1 }, usages: { max: 0, restant: 0 } },
  revenant: { cle: "revenant", nom: "Revenant", camp: "solitaire", effet: "", victoireCle: "execute", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } },
  remouleur: { cle: "remouleur", nom: "Rémouleur", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  ours: { cle: "montreur-d-ours", nom: "Montreur d'ours", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  pelerine: { cle: "pelerine", nom: "Pèlerine", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
const v = (id, role, extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${id.length}`, silence: false,
  amoureux: "", protections: 0, role: structuredClone(ROLE[role]), metier: null, ...extra });
const village = () => [v("l", "loup"), v("g", "garde"), v("li", "liseuse"), v("a", "villageois"), v("b", "villageois"), v("c", "villageois")];
const mort = (vs, id) => vs.map(x => (x.id === id ? { ...x, vivant: false } : x));
const jour = (L, extra = {}) => ({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1, ...extra });
const avecBanc = (L, extra = {}) => ({ ...jour(L, extra), banc: L.bancInitial(true) });
const avecPassage = (L, extra = {}) => ({ ...jour(L, extra), passage: L.passageInitial(true) });
const avecDeuil = (L, extra = {}) => ({ ...jour(L, extra), deuil: L.deuilInitial(true) });
const nuit = (L, vs, etat, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: etat.tour + 1, hasard: () => 0, jour: L.effetsDeLaNuit(etat, etat.tour + 1), ...extra });
const meute = c => ({ acteurId: "l", roleCle: "meute", cibles: [c] });
const voter = (L, e, votes) => Object.entries(votes).reduce((x, [votant, cible]) => L.enregistrerVote(x, { votant, cible }).etat, e);

const VERIFICATIONS = {
  // ------------------------------------------------------------ les Gens de passage
  "passage : l'arrivée, à l'aube ou au débat, hors vote, partie en cours, avec le réglage": L => {
    assert.deepEqual(L.verifierArrivee(avecPassage(L)), { ok: true, raison: "" });
    assert.equal(L.verifierArrivee(avecPassage(L, { phase: "aube" })).ok, true);
    assert.equal(L.verifierArrivee(jour(L)).raison, "inactif");
    assert.equal(L.verifierArrivee(avecPassage(L, { phase: "nuit" })).raison, "phase");
    assert.equal(L.verifierArrivee(avecPassage(L, { phase: "fin", vainqueur: "village" })).raison, "fin");
    assert.equal(L.verifierArrivee(avecPassage(L, { partie: "" })).raison, "fin");
    assert.equal(L.verifierArrivee(L.ouvrirVote(avecPassage(L), { candidats: ["a"], objet: "chapelle" })).raison, "phase", "le vote change la phase");
    assert.equal(L.verifierArrivee({ ...avecPassage(L), vote: { ...L.etatInitial().vote, ouvert: true } }).raison, "vote");
  },
  "passage : le camp secret, tiré pour l'équilibre ; jamais la meute en peste noire": L => {
    const vs = village();   // 6 vivants, 1 loup : la meute manque à 7
    assert.equal(L.campDePassage({ villageois: vs, hasard: () => 0.5 }), "meute", "la meute manque : 70 %");
    assert.equal(L.campDePassage({ villageois: vs, hasard: () => 0.8 }), "village");
    const forte = [...vs, v("l2", "loup"), v("l3", "loup")];
    assert.equal(L.campDePassage({ villageois: forte, hasard: () => 0.5 }), "village", "la meute au complet : 15 %");
    assert.equal(L.campDePassage({ villageois: forte, hasard: () => 0.1 }), "meute");
    assert.equal(L.campDePassage({ villageois: vs, peste: true, hasard: () => 0 }), "village");
    assert.equal(L.campDePassage({ villageois: mort(forte, "l2").map(x => (x.id === "l3" ? { ...x, vivant: false } : x)), hasard: () => 0.5 }), "meute", "les morts ne comptent pas");
  },
  "passage : le rôle de passage, du contenu, pas encore venu si possible": L => {
    const tous = ["remouleur", "montreur-d-ours", "pelerine", "villageois"];
    assert.ok(L.ROLES_DE_PASSAGE.includes(L.roleDePassage({ etat: avecPassage(L), disponibles: tous, hasard: () => 0.99 })));
    let e = L.accueillir(avecPassage(L), { acteurId: "x", cle: "remouleur" });
    e = L.accueillir(e, { acteurId: "y", cle: "pelerine" });
    for (const h of [0, 0.5, 0.99]) assert.equal(L.roleDePassage({ etat: e, disponibles: tous, hasard: () => h }), "montreur-d-ours");
    assert.equal(L.roleDePassage({ etat: avecPassage(L), disponibles: ["pelerine", "villageois"], hasard: () => 0 }), "pelerine");
    assert.equal(L.roleDePassage({ etat: avecPassage(L), disponibles: ["villageois"] }), "");
  },
  "passage : l'arrivée est publique (rôle, tour), jamais le camp": L => {
    const e = L.accueillir(avecPassage(L, { tour: 2 }), { acteurId: "x", cle: "pelerine" });
    assert.deepEqual(e.passage.gens.x, { cle: "pelerine", tour: 2 });
    assert.deepEqual(L.extraitDuRegistre(e.registre).map(x => [x.type, x.acteurId, x.comment, x.cle]), [["passage", "x", "arrivee", "pelerine"]]);
    const { public: pub } = L.separerEtat(e);
    assert.deepEqual(pub.passage.gens.x, { cle: "pelerine", tour: 2 });
    assert.ok(!JSON.stringify(pub.passage).includes("camp"));
  },
  "passage : partir sans mourir (voix retirée, candidat retiré, Bailli vacant), une fois": L => {
    let e = L.ouvrirVote({ ...avecPassage(L), bailli: { ...L.bailliInitial(true), acteurId: "x" } }, { candidats: ["x", "a"] });
    e = voter(L, e, { x: "a", b: "a" });
    e = L.partir(e, { acteurId: "x", comment: "depart" });
    assert.deepEqual(e.partis.map(p => [p.acteurId, p.comment, p.tour]), [["x", "depart", 1]]);
    assert.deepEqual(e.morts, []);
    assert.ok(!("x" in e.vote.votes));
    assert.deepEqual(e.vote.exprimes, ["b"]);
    assert.deepEqual(e.vote.candidats, ["a"]);
    assert.equal(e.bailli.acteurId, "");
    assert.ok(L.extraitDuRegistre(e.registre).some(x => x.type === "bailli" && x.comment === "vacance"));
    assert.ok(L.estParti(e, "x"));
    const encore = L.partir(e, { acteurId: "x", comment: "exil" });
    assert.equal(encore.partis.length, 1, "on ne part qu'une fois");
    assert.equal(L.partir(L.ajouterMort(jour(L), { acteurId: "a", cause: "vote" }), { acteurId: "a" }).partis.length, 0, "un mort ne part plus");
  },
  "passage : partir pendant son propre vote — ses bulletins retirés ; seul candidat, le vote se clôt sans élu": L => {
    // L'accusé du Banc part pendant son jugement.
    let e = L.noterJugement(L.ouvrirVote(avecBanc(L), { candidats: ["b"], banc: "b" }), "b");
    e = voter(L, e, { a: "b", c: "b", g: "b" });
    e = L.partir(e, { acteurId: "b" });
    assert.equal(e.vote.ouvert, false);
    assert.deepEqual([e.vote.resultat.elus, e.vote.resultat.depart, e.vote.resultat.banc?.accuse], [[], "b", "b"]);
    assert.deepEqual(e.vote.votes, {});
    // Le seul gens de passage d'un exil.
    let x = L.ouvrirVote(L.accueillir(avecPassage(L), { acteurId: "g2", cle: "pelerine" }), { candidats: ["g2"], objet: "exil" });
    x = L.partir(voter(L, x, { a: "g2" }), { acteurId: "g2" });
    assert.deepEqual([x.vote.ouvert, x.vote.resultat.elus, x.vote.resultat.objet], [false, [], "exil"]);
    // Un candidat parmi d'autres : le vote continue, les bulletins pour lui sont blancs.
    let y = L.ouvrirVote(jour(L), { candidats: ["a", "b", "c"] });
    y = L.partir(voter(L, y, { g: "a", li: "a", l: "b" }), { acteurId: "a" });
    assert.equal(y.vote.ouvert, true);
    assert.deepEqual(y.vote.candidats, ["b", "c"]);
    assert.deepEqual(y.vote.votes, { l: "b" });
    assert.deepEqual(y.vote.exprimes, ["l"]);
  },
  "passage : l'exil vise les gens de passage encore là ; le parti n'a pas de Dernier souffle, ne gagne ni ne perd": L => {
    let e = L.accueillir(L.accueillir(avecPassage(L), { acteurId: "x", cle: "remouleur" }), { acteurId: "y", cle: "pelerine" });
    const vs = [...village(), v("x", "remouleur"), v("y", "pelerine")];
    assert.deepEqual(L.candidatsExil(e, vs).sort(), ["x", "y"]);
    e = L.partir(e, { acteurId: "y", comment: "exil" });
    assert.deepEqual(L.candidatsExil(e, mort(vs, "y")), ["x"]);
    assert.deepEqual(L.candidatsExil(e, mort(vs, "x")), []);
    const souffle = { ...e, souffle: L.souffleInitial(true) };
    assert.equal(L.aSonSouffle(souffle, { id: "y", vivant: false }), false, "parti : pas de souffle");
    assert.equal(L.aSonSouffle(souffle, { id: "a", vivant: false }), true);
    const bilan = L.bilanDePartie({ villageois: mort([...village(), v("y", "pelerine")], "y"), morts: [], vainqueur: "village", partis: e.partis });
    const y = bilan.find(l => l.id === "y");
    assert.equal(y.gagnant, false);
    assert.equal(y.mort, null);
    assert.deepEqual(y.parti, { tour: 1, comment: "exil" });
    assert.equal(bilan.find(l => l.id === "a").gagnant, true);
  },
  // ------------------------------------------------------------ les pouvoirs de passage
  "passage : Rémouleur (verrou), Montreur d'ours (asile), une fois, publics": L => {
    for (const [role, pouvoir] of [["remouleur", "remouleur"], ["ours", "montreur-d-ours"]]) {
      const vs = [...village(), v("x", role)];
      const etat = jour(L);
      const r = L.appliquerPouvoir({ villageois: vs, etat, acteurId: "x", pouvoir, cibles: ["a"] });
      assert.ok(r.ok, pouvoir);
      assert.equal(r.annonces.length, 1);
      assert.ok(r.changements.some(c => c.type === "usage" && c.objet === "role"));
      const n = nuit(L, vs, r.etat, [meute("a")]);
      assert.ok(!n.morts.includes("a"), `${pouvoir} : la meute est arrêtée`);
      const sans = nuit(L, vs, etat, [meute("a")]);
      assert.ok(sans.morts.includes("a"), "sans le pouvoir, elle tue");
      const use = vs.map(x => (x.id === "x" ? { ...x, role: { ...x.role, usages: { max: 1, restant: 0 } } } : x));
      assert.equal(L.verifierPouvoir({ villageois: use, etat, acteurId: "x", pouvoir, cibles: ["a"] }).ok, false, "une fois");
    }
  },
  "passage : l'ours n'est pas l'asile de la Chapelle, ni la lame du Rémouleur celle de la Forge": L => {
    const vs = [...village(), v("x", "ours"), v("y", "remouleur")];
    let e = { ...jour(L), batimentsCles: ["chapelle", "forge"] };
    e = L.appliquerPouvoir({ villageois: vs, etat: e, acteurId: "x", pouvoir: "montreur-d-ours", cibles: ["a"], batiments: e.batimentsCles }).etat;
    e = L.appliquerPouvoir({ villageois: vs, etat: e, acteurId: "y", pouvoir: "remouleur", cibles: ["b"], batiments: e.batimentsCles }).etat;
    assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, pouvoir: "chapelle", cibles: ["c"], batiments: e.batimentsCles }).raison, "", "la Chapelle reste possible");
    assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: "g", pouvoir: "forge", batiments: e.batimentsCles }).raison, "", "la Forge aussi");
    const demain = { ...e, tour: 2, phase: "jour" };
    assert.ok(L.candidatsDuPouvoir({ villageois: vs, etat: demain, pouvoir: "chapelle" }).includes("a"), "l'ours d'hier n'empêche pas la Chapelle");
    const etape = x => L.etapeSuivante(L.separerEtat(x).public, L.separerEtat(x).secret, { villageois: vs });
    const vote = L.cloreVote(L.ouvrirVote(e, { candidats: ["a", "b"] }), { votants: [] }).etat;
    assert.equal(etape(vote).cle, "chapelle", "le MJ propose encore la Chapelle");
  },
  "passage : la Pèlerine apprend en secret le vrai camp ; l'annonce publique le tait": L => {
    const vs = [...village(), v("x", "pelerine"), v("y", "remouleur", { camp: "meute" })];
    const r = L.appliquerPouvoir({ villageois: vs, etat: jour(L), acteurId: "x", pouvoir: "pelerine", cibles: ["y"] });
    assert.ok(r.ok);
    assert.deepEqual(r.prives.map(p => [p.destinataire, p.donnees.camp]), [["x", "meute"]]);
    assert.ok(!JSON.stringify(r.annonces).includes("meute"));
    assert.equal(L.verifierPouvoir({ villageois: vs, etat: jour(L), acteurId: "x", pouvoir: "pelerine", cibles: ["x"] }).ok, false, "pas soi-même");
  },
  // ------------------------------------------------------------ le Banc des accusés
  "banc : une accusation par jour, un accusé une fois par jour, pendant le débat": L => {
    const vs = village();
    const ok = (e, par, contre) => L.verifierAccusation({ villageois: vs, etat: e, par, contre }).raison;
    let e = avecBanc(L);
    assert.equal(ok(jour(L), "a", "b"), "inactif");
    assert.equal(ok(avecBanc(L, { phase: "nuit" }), "a", "b"), "phase");
    assert.equal(ok(e, "zz", "b"), "absent");
    assert.equal(ok(e, "a", "a"), "cible");
    assert.equal(ok(e, "a", "zz"), "cible");
    assert.equal(L.verifierAccusation({ villageois: mort(vs, "a"), etat: e, par: "a", contre: "b" }).raison, "mort");
    assert.equal(L.verifierAccusation({ villageois: mort(vs, "b"), etat: e, par: "a", contre: "b" }).raison, "cible");
    assert.equal(L.verifierAccusation({ villageois: vs.map(x => (x.id === "a" ? { ...x, silence: true } : x)), etat: e, par: "a", contre: "b" }).raison, "silence");
    e = L.accuser({ villageois: vs, etat: e, par: "a", contre: "b" }).etat;
    assert.deepEqual(e.banc.accusations, [{ par: "a", contre: "b" }]);
    assert.equal(ok(e, "a", "c"), "deja");
    assert.equal(ok(e, "c", "b"), "accuse");
    assert.equal(ok(e, "c", "a"), "");
    assert.equal(L.accuser({ villageois: vs, etat: e, par: "a", contre: "c" }).ok, false);
    assert.equal(ok({ ...e, tour: 2 }, "a", "b"), "", "un nouveau jour, un nouveau banc");
  },
  "banc : les accusés jugés un par un, dans l'ordre ; plus personne après une exécution": L => {
    const vs = village();
    let e = avecBanc(L);
    for (const [par, contre] of [["a", "b"], ["b", "l"], ["c", "g"]]) e = L.accuser({ villageois: vs, etat: e, par, contre }).etat;
    assert.equal(L.prochainAccuse(e, vs), "b");
    e = L.noterJugement(e, "b");
    assert.equal(L.prochainAccuse(e, vs), "l");
    assert.equal(L.prochainAccuse(e, mort(vs, "l")), "g", "un mort n'est plus jugé");
    assert.equal(L.prochainAccuse(L.ajouterMort(e, { acteurId: "b", cause: "vote" }), vs), "", "une exécution par jour");
    assert.equal(L.prochainAccuse(L.ajouterMort(e, { acteurId: "a", cause: "meute" }), vs), "l", "une mort de la nuit n'arrête rien");
    assert.equal(L.prochainAccuse({ ...e, tour: 2 }, vs), "", "le banc d'hier");
    assert.equal(L.prochainAccuse({ ...e, banc: { ...e.banc, actif: false } }, vs), "");
  },
  "banc : un jugement, un seul candidat, sans cloche ; condamné à la moitié des voix des vivants": L => {
    const vivants = ["l", "g", "li", "a", "b", "c"];
    const juger = (votes, extra = {}) => {
      let e = L.ouvrirVote({ ...avecBanc(L), voteDoubleDemain: true, ...extra }, { candidats: vivants, banc: "b", majoriteAbsolue: extra.gibet });
      e = voter(L, e, votes);
      return { ouvert: e.vote, c: L.cloreVote(e, { votants: vivants }) };
    };
    const { ouvert, c } = juger({ l: "b", g: "b", a: "b" });
    assert.deepEqual(ouvert.candidats, ["b"]);
    assert.deepEqual(ouvert.banc, { accuse: "b" });
    assert.equal(ouvert.double, false, "la cloche n'y change rien");
    assert.deepEqual(c.resultat.elus, ["b"], "3 sur 6 : la moitié");
    assert.deepEqual(c.resultat.banc, { accuse: "b", pour: 3, total: 6 });
    assert.deepEqual(c.etat.registre.at(-1).banc, { accuse: "b", pour: 3, total: 6 });
    assert.deepEqual(juger({ l: "b", g: "b" }).c.resultat.elus, [], "2 sur 6 : acquitté");
    assert.equal(juger({ l: "b", g: "b" }).c.resultat.egalite, false);
    assert.deepEqual(juger({ l: "b", g: "b", a: "b" }, { gibet: true }).c.resultat.elus, [], "le Gibet : plus de la moitié");
    assert.deepEqual(juger({ l: "b", g: "b", a: "b", c: "b" }, { gibet: true }).c.resultat.elus, ["b"]);
    // Le Bailli : sa voix compte double, au total aussi ; pas de départage.
    const bailli = juger({ l: "b", g: "b", a: "b" }, { bailli: { ...L.bailliInitial(true), acteurId: "c" } }).c.resultat;
    assert.deepEqual([bailli.banc.pour, bailli.banc.total, bailli.elus], [3, 7, []]);
    assert.equal(bailli.departage, null);
    assert.deepEqual(L.verdictDuBanc({ accuse: "b", votes: { l: "b", z: "b" }, vivants: ["l", "g", "a", "c"] }), { pour: 2, total: 4, condamne: true }, "un souffle compte pour, pas au total");
    // Au dépouillement : le mort qui souffle compte parmi les « pour », pas au total des vivants.
    let s = voter(L, L.ouvrirVote({ ...avecBanc(L), souffle: L.souffleInitial(true) }, { candidats: ["b"], banc: "b" }), { l: "b", g: "b", z: "b" });
    s = L.cloreVote(s, { votants: [...vivants, "z"], souffles: ["z"] });
    assert.deepEqual([s.resultat.banc.pour, s.resultat.banc.total, s.resultat.elus], [3, 6, ["b"]]);
  },
  "banc : le Juge de paix rejuge le même accusé": L => {
    const vs = [...village(), v("j", "villageois", { role: { ...ROLE.villageois, cle: "juge-de-paix", nom: "Juge de paix", usages: { max: 1, restant: 1 } } })];
    let e = L.ouvrirVote(avecBanc(L), { candidats: ["b"], banc: "b" });
    e = voter(L, e, { l: "b", g: "b", a: "b", c: "b" });
    e = L.cloreVote(e, { votants: vs.map(x => x.id) }).etat;
    const r = L.appliquerPouvoir({ villageois: vs, etat: e, acteurId: "j", pouvoir: "juge-de-paix" });
    assert.ok(r.ok, r.raison);
    assert.deepEqual(r.etat.vote.banc, { accuse: "b" });
    assert.deepEqual(r.etat.vote.candidats, ["b"]);
  },
  // ------------------------------------------------------------ le Glas du deuil
  "deuil : un innocent exécuté fait sonner le glas ; vision, voix, linceul, puis rien": L => {
    let e = avecDeuil(L);
    assert.equal(L.sonnerDeuil(jour(L), { camp: "village" }).sonne, false, "sans la variante");
    assert.equal(L.sonnerDeuil(e, { camp: "meute" }).sonne, false, "un loup exécuté");
    let r = L.sonnerDeuil(e, { camp: "solitaire" });
    assert.deepEqual([r.sonne, r.compte, r.etat.pouvoirsDeuil.visions], [true, 1, 1]);
    r = L.sonnerDeuil(r.etat, { camp: "village" });
    assert.deepEqual([r.compte, r.etat.pouvoirsDeuil.voix], [2, true]);
    r = L.sonnerDeuil(r.etat, { camp: "village" });
    assert.deepEqual([r.compte, r.etat.pouvoirsDeuil.linceul], [3, 2], "le linceul : la nuit qui suit");
    assert.equal(L.sonnerDeuil({ ...r.etat, deuil: { actif: true, compte: 2 }, phase: "nuit" }, { camp: "village" }).etat.pouvoirsDeuil.linceul, 1, "la nuit même");
    r = L.sonnerDeuil({ ...r.etat, tour: 3 }, { camp: "village" });
    assert.deepEqual([r.compte, r.etat.pouvoirsDeuil.visions, r.etat.pouvoirsDeuil.voix, r.etat.pouvoirsDeuil.linceul], [4, 1, true, 2], "au-delà, rien de plus");
  },
  "deuil : public le compte, secret le pouvoir": L => {
    const e = L.sonnerDeuil(L.sonnerDeuil(avecDeuil(L), { camp: "village" }).etat, { camp: "village" }).etat;
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.deuil, { actif: true, compte: 2 });
    assert.deepEqual(pub.pouvoirsDeuil, L.pouvoirsDeuilInitiaux());
    assert.deepEqual(L.fusionnerEtat(pub, secret).pouvoirsDeuil, { visions: 1, voix: true, linceul: 0, cible: null });
    // Le choix secret de la voix reste secret lui aussi.
    const choisi = L.choisirVoixDuDeuil(e, { numero: 3, cible: "a" });
    assert.equal(L.separerEtat(choisi).public.pouvoirsDeuil.cible, null);
    assert.deepEqual(L.fusionnerEtat(L.separerEtat(choisi).public, L.separerEtat(choisi).secret).pouvoirsDeuil.cible, { numero: 3, cible: "a" });
  },
  "deuil : la vision réveille la meute, et chaque loup apprend le camp": L => {
    const vs = [...village(), v("l2", "loup")];
    const e = { ...avecDeuil(L), pouvoirsDeuil: { visions: 1, voix: false, linceul: 0 } };
    assert.equal(L.visionDuDeuilDue(e, vs), true);
    assert.equal(L.visionDuDeuilDue(avecDeuil(L), vs), false);
    assert.equal(L.visionDuDeuilDue(e, mort(mort(vs, "l"), "l2")), false, "plus de meute");
    const ordre = L.ordreDeNuit(vs, 2, { deuil: true });
    const etape = ordre.find(x => x.roleCle === L.CLE_DEUIL);
    assert.deepEqual(etape?.acteurIds.sort(), ["l", "l2"]);
    assert.ok(!L.ordreDeNuit(vs, 2).some(x => x.roleCle === L.CLE_DEUIL));
    const n = nuit(L, vs, e, [{ acteurId: "l", roleCle: L.CLE_DEUIL, effet: "deuil", cibles: ["li"] }]);
    for (const loup of ["l", "l2"]) assert.ok(n.messages.some(m => m.destinataire === loup && m.cle.endsWith("VisionDeuil") && m.donnees.camp === "village"), loup);
    assert.ok(!n.messages.some(m => m.destinataire === "li"));
    assert.equal(n.deuil, "li", "la vision délivrée est notée");
    assert.equal(nuit(L, vs, e, []).deuil, "", "pas de vision : rien à consommer");
    const action = [{ acteurId: "l", roleCle: L.CLE_DEUIL, effet: "deuil", cibles: ["li"] }];
    for (const jour of [{ surveilles: ["l"] }, { horsDAtteinte: ["l"] }, { horsDAtteinte: ["li"] }]) {
      const r = L.resoudreNuit({ villageois: vs, actions: action, tour: 2, hasard: () => 0, jour });
      assert.equal(r.messages.filter(m => m.cle.endsWith("VisionDeuil")).length, 2, JSON.stringify(jour));
      assert.equal(r.deuil, "li");
    }
    const lMort = L.resoudreNuit({ villageois: mort(vs, "l"), actions: action, tour: 2, hasard: () => 0, jour: {} });
    assert.ok(lMort.messages.some(m => m.destinataire === "l2" && m.cle.endsWith("VisionDeuil")), "le loup noté mort : la meute voit quand même");
    assert.equal(L.resoudreNuit({ villageois: mort(mort(vs, "l"), "l2"), actions: action, tour: 2, hasard: () => 0, jour: {} }).deuil, "", "plus de meute : rien de délivré");
  },
  "deuil : la voix sans visage va au choix secret de la meute (sinon au hasard), jamais aux bulletins": L => {
    const e = { ...avecDeuil(L), pouvoirsDeuil: { visions: 0, voix: true, linceul: 0, cible: null } };
    let x = L.ouvrirVote(e, { candidats: ["a", "b", "c"] });
    const n = x.vote.numero;
    // Sans choix : un candidat au hasard, quels que soient les bulletins des loups.
    assert.equal(L.voixDuDeuil({ etat: x, candidats: ["a", "b", "c"], hasard: () => 0 }), "a");
    assert.equal(L.voixDuDeuil({ etat: x, candidats: ["a", "b", "c"], hasard: () => 0.99 }), "c");
    assert.equal(L.voixDuDeuil({ etat: L.choisirVoixDuDeuil(x, { numero: n, cible: "b" }), candidats: ["a", "b", "c"], hasard: () => 0 }), "b", "le choix de la meute");
    assert.equal(L.voixDuDeuil({ etat: L.choisirVoixDuDeuil(x, { numero: n - 1, cible: "b" }), candidats: ["a", "b", "c"], hasard: () => 0 }), "a", "un choix d'un autre vote");
    assert.equal(L.voixDuDeuil({ etat: L.choisirVoixDuDeuil(x, { numero: n, cible: "z" }), candidats: ["a", "b", "c"], hasard: () => 0 }), "a", "pas un candidat");
    assert.equal(L.voixDuDeuil({ etat: L.ouvrirVote(avecDeuil(L), { candidats: ["a"] }), candidats: ["a"] }), "", "sans le 2e glas");
    assert.equal(L.voixDuDeuil({ etat: L.ouvrirVote(e, { candidats: ["a"], objet: "chapelle" }), candidats: ["a"], hasard: () => 0 }), "", "au vote d'exécution seulement");
    // Le loup seul à voter pour c n'est pas trahi : la voix suit le choix secret (a), pas son bulletin.
    x = L.choisirVoixDuDeuil(voter(L, x, { l: "c", g: "b", li: "a", b: "a" }), { numero: n, cible: "a" });
    const c = L.cloreVote(x, { votants: ["l", "g", "li", "a", "b", "c"], hasard: () => 0.99 });
    assert.equal(c.resultat.deuil, "a");
    assert.deepEqual(c.resultat.elus, ["a"], "3 contre 1 et 1");
    assert.equal(c.resultat.decompte.a, 3);
    assert.ok(!Object.keys(c.resultat.votes).some(k => k.startsWith("~")), "la voix n'a pas de votant");
    assert.equal(c.etat.pouvoirsDeuil.cible, null, "le choix sert une fois");
    // Les loups abstenus : la voix tombe quand même (elle ne blanchit personne).
    const y = L.cloreVote(voter(L, L.ouvrirVote(e, { candidats: ["a", "b"] }), { g: "b" }), { votants: ["l", "g"], hasard: () => 0 });
    assert.equal(y.resultat.deuil, "a");
  },
  "deuil : le linceul, cette nuit-là, aucune protection ne tient": L => {
    const vs = village();
    const garde = { acteurId: "g", roleCle: "garde-du-pont", cibles: ["a"] };
    const e = { ...avecDeuil(L), pouvoirsDeuil: { visions: 0, voix: false, linceul: 2 } };
    assert.ok(!nuit(L, vs, avecDeuil(L), [garde, meute("a")]).morts.includes("a"), "sans linceul, la garde sauve");
    assert.ok(nuit(L, vs, e, [garde, meute("a")]).morts.includes("a"), "linceul : la garde ne tient pas");
    // Ni porte : le verrou du Rémouleur ne tient pas non plus.
    const avecX = [...vs, v("x", "remouleur")];
    const verrou = L.appliquerPouvoir({ villageois: avecX, etat: e, acteurId: "x", pouvoir: "remouleur", cibles: ["a"] }).etat;
    assert.ok(nuit(L, avecX, verrou, [meute("a")]).morts.includes("a"), "linceul : le verrou ne tient pas");
    assert.ok(!nuit(L, avecX, L.appliquerPouvoir({ villageois: avecX, etat: avecDeuil(L), acteurId: "x", pouvoir: "remouleur", cibles: ["a"] }).etat, [meute("a")]).morts.includes("a"));
    const louve = { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41, cibles: 1 }, usages: { max: 0, restant: 0 } };
    // La morsure passe la garde du Garde du pont (Pacte, étape 2) ; la porte de la Gardienne des clés l'arrête, sauf sous le linceul.
    const gardienne = { ...v("gc", "garde"), role: { ...ROLE.garde, cle: "gardienne-des-cles", nom: "Gardienne des clés" } };
    const avecLouve = [...vs, { ...v("lm", "loup"), role: louve }, gardienne];
    const mordre = [{ acteurId: "gc", roleCle: "gardienne-des-cles", cibles: ["a"] }, { acteurId: "lm", roleCle: "louve-mere", cibles: ["a"] }, meute("a")];
    assert.ok(!nuit(L, avecLouve, avecDeuil(L), mordre).changements.some(c => c.type === "camp"), "sans linceul : la porte repousse la morsure");
    assert.ok(nuit(L, avecLouve, e, mordre).changements.some(c => c.type === "camp" && c.acteurId === "a"), "linceul : mordu malgré la porte");
    assert.ok(nuit(L, avecLouve, avecDeuil(L), [garde, { acteurId: "lm", roleCle: "louve-mere", cibles: ["a"] }, meute("a")]).changements
      .some(c => c.type === "camp" && c.acteurId === "a"), "la garde n'arrête pas l'infection");
    assert.equal(L.linceulDeLaNuit(e, 2), true);
    assert.equal(L.linceulDeLaNuit(e, 3), false);
    assert.equal(L.effetsDeLaNuit(e, 2).linceul, true);
  },
  // ------------------------------------------------------------ la Nuit de la Saint-Martin
  "saint-martin : trois rôles de plus, cachés sous l'autel ; le socle et les loups ; reproductible": L => {
    const dispo = ["loup-de-brumecombe", "liseuse-de-cendres", "colporteur", "garde-du-pont", "fossoyeur", "revenant", "villageois"];
    for (const n of [4, 6, 8]) {
      const c = L.composerSaintMartin(n, { disponibles: dispo, graine: "x" });
      assert.equal(c.joueurs.length, n);
      assert.equal(c.autel.length, L.AUTEL);
      const tous = [...c.joueurs, ...c.autel];
      assert.equal(tous.filter(r => r === "loup-de-brumecombe").length, L.loupsSaintMartin(n) + 1, `${n} joueurs`);
      for (const r of ["liseuse-de-cendres", "colporteur", "villageois"]) assert.ok(tous.includes(r), r);
      assert.deepEqual(L.composerSaintMartin(n, { disponibles: dispo, graine: "x" }), c);
    }
    assert.equal(L.loupsSaintMartin(6), 1);
    assert.equal(L.loupsSaintMartin(7), 2);
  },
  "saint-martin : la fin après l'unique vote": L => {
    const vs = [...village(), v("r", "revenant")];
    const morts = ids => ids.map(acteurId => ({ acteurId, cause: "vote", tour: 1 }));
    const vic = (vsx, ids) => L.victoireSaintMartin({ villageois: vsx, morts: morts(ids) });
    assert.equal(vic(mort(vs, "l"), ["l"]), "village");
    assert.equal(vic(mort(vs, "r"), ["r"]), "r");
    assert.equal(vic(mort(vs, "a"), ["a"]), "meute");
    assert.equal(vic(vs, []), "meute");
    const sansLoup = vs.filter(x => x.id !== "l");
    assert.equal(vic(mort(sansLoup, "a"), ["a"]), L.VAINQUEUR_BRUME);
    assert.equal(vic(sansLoup, []), "village");
    assert.equal(L.victoireSaintMartin({ villageois: mort(sansLoup, "a"), morts: [{ acteurId: "a", cause: "pyromane", tour: 1 }] }), "village", "une mort de la nuit : pas la brume");
    assert.equal(L.victoireSaintMartin({ villageois: mort(vs, "a"), morts: [{ acteurId: "a", cause: "meute", tour: 1 }] }), "meute", "une mort de la nuit n'est pas une exécution");
    // Avant le vote, rien ne tombe ; la partie ordinaire n'y est pas soumise.
    const fort = [v("l", "loup"), v("l2", "loup"), v("a", "villageois")];
    assert.equal(L.verifierVictoire({ villageois: fort, saintMartin: false }), "");
    assert.equal(L.verifierVictoire({ villageois: fort }), "meute");
    assert.equal(L.verifierVictoire({ villageois: fort, saintMartin: true }), "meute");
  },
  "saint-martin : l'autel est secret, le format public ; la fin tombe après le vote et ses exécutions": L => {
    const e = { ...jour(L), format: L.FORMAT_SAINT_MARTIN, autel: ["revenant", "fossoyeur", "villageois"] };
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.autel, []);
    assert.equal(pub.format, L.FORMAT_SAINT_MARTIN);
    assert.deepEqual(L.fusionnerEtat(pub, secret).autel, e.autel);
    const vs = village();
    assert.equal(L.saintMartinFinie(e, vs), false, "pas de vote");
    let x = voter(L, L.ouvrirVote(e, { candidats: ["a", "l"] }), { l: "a", g: "a" });
    assert.equal(L.saintMartinFinie(x, vs), false, "vote ouvert");
    x = L.cloreVote(x, { votants: vs.map(y => y.id) }).etat;
    assert.equal(L.saintMartinFinie(x, vs), false, "l'exécuté vit encore");
    assert.equal(L.saintMartinFinie(x, mort(vs, "a")), true);
    assert.equal(L.saintMartinFinie({ ...x, format: "" }, mort(vs, "a")), false);
    const chapelle = L.cloreVote(L.ouvrirVote(e, { candidats: ["a"], objet: "chapelle" }), { votants: [] }).etat;
    assert.equal(L.saintMartinFinie(chapelle, vs), false, "un vote d'exécution seulement");
  },
  // ------------------------------------------------------------ les étapes du MJ humain
  "étapes : juger les accusés un par un ; sans accusé, la nuit": L => {
    const vs = village();
    const etape = e => L.etapeSuivante(L.separerEtat(e).public, L.separerEtat(e).secret, { villageois: vs });
    let e = avecBanc(L);
    assert.deepEqual([etape(e).cle, etape(e).action, etape(e).detail?.cle], ["nuit", "phase", "bancVide"]);
    e = L.accuser({ villageois: vs, etat: e, par: "a", contre: "b" }).etat;
    e = L.accuser({ villageois: vs, etat: e, par: "b", contre: "c" }).etat;
    assert.deepEqual([etape(e).cle, etape(e).action, etape(e).donnees.id], ["juger", "ouvrirVote", "b"]);
    e = L.noterJugement(L.ouvrirVote(e, { candidats: ["b"], banc: "b" }), "b");
    e = L.cloreVote(voter(L, e, { a: "b" }), { votants: vs.map(x => x.id) }).etat;
    assert.deepEqual([etape(e).cle, etape(e).donnees.id], ["juger", "c"], "acquitté : le suivant");
    e = L.noterJugement(L.ouvrirVote(e, { candidats: ["c"], banc: "c" }), "c");
    e = L.cloreVote(voter(L, e, { a: "c", b: "c", g: "c" }), { votants: vs.map(x => x.id) }).etat;
    assert.deepEqual([etape(e).cle, etape(e).donnees.id], ["executer", "c"]);
    assert.equal(etape(jour(L)).cle, "ouvrirVote", "sans le Banc : le vote ordinaire");
  },
  "étapes : un exil après l'exécution ne rouvre pas de vote ; avant, l'élection du Bailli puis l'exécution": L => {
    const vs = [...village(), v("x", "pelerine")];
    const etape = x => L.etapeSuivante(L.separerEtat(x).public, L.separerEtat(x).secret, { villageois: vs });
    const exil = x => L.cloreVote(L.ouvrirVote(x, { candidats: ["x"], objet: "exil" }), { votants: [] }).etat;
    const base = { ...L.accueillir(avecPassage(L), { acteurId: "x", cle: "pelerine" }), batimentsCles: [] };
    let e = L.cloreVote(L.ouvrirVote(base, { candidats: ["a", "b"] }), { votants: [] }).etat;
    assert.equal(L.voteExecutionDuJour(e), true);
    e = exil(e);
    assert.equal(L.voteExecutionDuJour(e), true, "le Registre garde l'exécution du jour");
    assert.deepEqual([etape(e).cle, etape(e).action], ["nuit", "phase"]);
    assert.equal(etape({ ...e, batimentsCles: ["chapelle"] }).cle, "chapelle", "puis la Chapelle");
    // Un exil avant l'exécution, sans Bailli : l'élection d'abord, puis le vote d'exécution.
    const sansBailli = exil({ ...base, bailli: L.bailliInitial(true) });
    assert.equal(etape(sansBailli).cle, "bailli");
    assert.equal(L.electionAttendue({ etat: exil(L.cloreVote(L.ouvrirVote({ ...base, bailli: L.bailliInitial(true) }, { candidats: ["a"] }), { votants: [] }).etat), villageois: vs }).raison, "execution", "pas d'élection après l'exécution");
    assert.equal(etape(exil(base)).cle, "ouvrirVote");
    // Le Juge de paix annule : l'exécution n'a pas eu lieu.
    const annule = L.marquerAnnule(L.cloreVote(L.ouvrirVote(base, { candidats: ["a"] }), { votants: [] }).etat, 1);
    assert.equal(L.voteExecutionDuJour(exil(annule)), false);
  },
  "étapes : le Banc sans accusé propose la Chapelle avant la nuit": L => {
    const vs = village();
    const etape = x => L.etapeSuivante(L.separerEtat(x).public, L.separerEtat(x).secret, { villageois: vs });
    const e = { ...avecBanc(L), batimentsCles: ["chapelle"] };
    assert.deepEqual([etape(e).cle, etape(e).action, etape(e).detail?.cle], ["chapelle", "voteChapelle", "bancVide"]);
    const apres = L.cloreVote(L.ouvrirVote(e, { candidats: ["a"], objet: "chapelle" }), { votants: [] }).etat;
    assert.equal(etape(apres).cle, "nuit");
    assert.equal(etape({ ...e, phase: "jour", vote: apres.vote, registre: apres.registre }).cle, "nuit", "la Chapelle choisie aujourd'hui");
  },
  "étapes : la Saint-Martin finit après son vote ; une partie ordinaire continue": L => {
    const vs = village();
    const etape = e => L.etapeSuivante(L.separerEtat(e).public, L.separerEtat(e).secret, { villageois: vs });
    const sm = { ...jour(L), format: L.FORMAT_SAINT_MARTIN };
    const clos = e => L.cloreVote(L.ouvrirVote(e, { candidats: ["a", "b"] }), { votants: vs.map(x => x.id) }).etat;
    assert.equal(etape(clos(sm)).cle, "victoire");
    assert.equal(etape(clos(jour(L))).cle, "nuit");
    assert.equal(etape(sm).cle, "ouvrirVote", "avant le vote : rien ne finit");
    // Un exil après le vote d'exécution : la Saint-Martin finit quand même.
    const exil = L.cloreVote(L.ouvrirVote(clos(L.accueillir({ ...sm, passage: L.passageInitial(true) }, { acteurId: "b", cle: "pelerine" })), { candidats: ["b"], objet: "exil" }), { votants: [] }).etat;
    assert.equal(L.saintMartinFinie(exil, vs), true);
    assert.equal(etape(exil).cle, "victoire");
  }
};

const MUTATIONS = [
  // les Gens de passage
  ["passage.mjs", "  if (!etat.passage.actif) return non(\"inactif\");\n", "", "arrivée : le réglage"],
  ["passage.mjs", "  if (!PHASES_ARRIVEE.includes(etat.phase)) return non(\"phase\");\n", "", "arrivée : aube ou débat"],
  ["passage.mjs", "  if (etat.vote.ouvert) return non(\"vote\");\n", "", "arrivée : hors vote"],
  ["passage.mjs", "if (!etat.partie || etat.phase === \"fin\" || etat.vainqueur)", "if (etat.phase === \"fin\")", "arrivée : une partie en cours"],
  ["passage.mjs", "  if (peste) return \"village\";\n", "", "camp : jamais la meute en peste noire"],
  ["passage.mjs", "hasard() < (manque ? 0.7 : 0.15)", "hasard() < 0.15", "camp : la meute qui manque"],
  ["passage.mjs", "hasard() < (manque ? 0.7 : 0.15)", "hasard() < (manque ? 0.7 : 0)", "camp : jamais sûr"],
  ["passage.mjs", "const vivants = villageois.filter(v => v.vivant !== false);", "const vivants = villageois;", "camp : les vivants"],
  ["passage.mjs", "choisir(neufs.length ? neufs : possibles, hasard)", "choisir(possibles, hasard)", "rôle : pas encore venu"],
  ["passage.mjs", "const possibles = ROLES_DE_PASSAGE.filter(c => disponibles.includes(c));", "const possibles = ROLES_DE_PASSAGE;", "rôle : du contenu"],
  ["passage.mjs", "  inscrire(etat, { type: \"passage\", acteurId, comment: \"arrivee\", cle });\n", "", "arrivée au Registre"],
  ["passage.mjs", "etat.passage.gens[acteurId] = { cle, tour: etat.tour };", "etat.passage.gens[acteurId] = { cle, tour: etat.tour, camp: \"meute\" };", "arrivée : rien du camp"],
  ["passage.mjs", "    delete etat.vote.votes[acteurId];\n", "", "départ : sa voix retirée"],
  ["passage.mjs", "etat.vote.ouvert ? etat.vote.candidats.filter(id => id !== acteurId) : etat.vote.candidats", "etat.vote.candidats", "départ : candidat retiré"],
  ["passage.mjs", "    for (const [votant, cible] of Object.entries(etat.vote.votes)) if (cible === acteurId) delete etat.vote.votes[votant];\n", "", "départ : les bulletins pour lui"],
  ["passage.mjs", "if (etat.vote.ouvert && (!etat.vote.candidats.length || etat.vote.banc?.accuse === acteurId)) {", "if (false) {", "départ : seul candidat, vote clos"],
  ["jour.mjs", "if (effetsPour(etat, \"asile\", nuit).some(x => !x.origine)) return non(\"deja\");", "if (effetsPour(etat, \"asile\", nuit).length) return non(\"deja\");", "l'ours n'est pas la Chapelle"],
  ["jour.mjs", "x.type === \"lame\" && !x.origine", "x.type === \"lame\"", "la lame du Rémouleur n'est pas la Forge"],
  ["jour.mjs", "effetsPour(etat, \"asile\", etat.tour).filter(x => !x.origine).map(x => x.cible)", "effetsPour(etat, \"asile\", etat.tour).map(x => x.cible)", "l'ours d'hier n'est pas la Chapelle"],
  ["jour.mjs", "      poser(\"asile\", c, \"passage\");", "      poser(\"asile\", c);", "l'ours : son origine"],
  ["etapes.mjs", "x.type === \"asile\" && !x.origine && x.nuit", "x.type === \"asile\" && x.nuit", "étape : l'ours n'est pas la Chapelle"],
  ["etapes.mjs", "return chapelleDue() ? etape(\"chapelle\", \"voteChapelle\", {}, vide) : ", "return ", "étape : Banc vide, la Chapelle"],
  ["etapes.mjs", "        return electionAttendue({ etat, villageois }).ok ? etape(\"bailli\", \"voteBailli\") : voteDuJour();", "        return voteDuJour();", "étape : l'élection après un exil"],
  ["bailli.mjs", "\n  || (etat?.registre ?? []).some(x => x.type === \"vote\" && x.objet === \"execution\" && x.tour === etat?.tour && !x.annule)", "", "exécution du jour : le Registre"],
  ["bailli.mjs", " && x.tour === etat?.tour && !x.annule)", " && x.tour === etat?.tour)", "exécution du jour : pas un vote annulé"],
  ["saintmartin.mjs", "[...(etat.registre ?? [])].reverse().find(x => x.type === \"vote\" && x.objet === \"execution\" && !x.annule)", "etat.vote.resultat", "saint-martin : son vote malgré l'exil"],
  ["deuil.mjs", "if (choix && choix.numero === etat.vote.numero && candidats.includes(choix.cible)) return choix.cible;", "", "voix : le choix secret"],
  ["deuil.mjs", "choix.numero === etat.vote.numero && ", "", "voix : le choix de CE vote"],
  ["deuil.mjs", "return choisir(candidats, hasard) ?? \"\";", "return \"\";", "voix : le hasard sans choix"],
  ["etat.mjs", "  etat.pouvoirsDeuil.cible = null;\n", "", "voix : le choix sert une fois"],
  ["resolution.mjs", "    if ((deLaMeute || duDeuil) && !vivantsMeute.length) continue;", "    if (deLaMeute && !vivantsMeute.length) continue;", "vision : une meute vivante"],
  ["resolution.mjs", "    if (deLaPeste || duDeuil) {", "    if (deLaPeste) {", "vision : ni guet ni éloignement"],
  ["resolution.mjs", "const absent = duDeuil ? null : cibles", "const absent = cibles", "vision : la cible absente"],
  ["resolution.mjs", "if (!deLaMeute && !deLaPeste && !duDeuil && (!acteur", "if (!deLaMeute && !deLaPeste && (!acteur", "vision : le loup noté mort"],
  ["resolution.mjs", "    sortie.deuil = c;\n", "", "vision : délivrée, notée"],
  ["resolution.mjs", "fermees.has(cible) && cible !== surprise && !sansProtection(cible) && !linceul)", "fermees.has(cible) && cible !== surprise && !sansProtection(cible))", "linceul : la morsure"],
  ["passage.mjs", "    etat.bailli.acteurId = \"\";\n", "", "départ : Bailli vacant"],
  ["passage.mjs", "if (estParti(etat, acteurId) || etat.morts.some(m => m.acteurId === acteurId)) return etat;", "if (false) return etat;", "départ : une fois"],
  ["passage.mjs", "  .filter(id => !estParti(etat, id) && ", "  .filter(id => ", "exil : pas les partis"],
  ["souffle.mjs", "!(etat.partis ?? []).some(p => p.acteurId === v.id)", "true", "parti : pas de Dernier souffle"],
  ["victoire.mjs", "gagnant: gagnants.has(v.id) && !p", "gagnant: gagnants.has(v.id)", "parti : ni gagnant"],
  ["victoire.mjs", "mort: v.vivant === false && !p ?", "mort: v.vivant === false ?", "parti : ni mort"],
  ["jour.mjs", "      poser(\"verrou\", c, \"passage\");\n      poser(\"lame\", c, \"passage\");", "      poser(\"lame\", c, \"passage\");", "Rémouleur : le verrou"],
  ["jour.mjs", "      poser(\"asile\", c, \"passage\");\n      annonce(\"Ours\"", "      annonce(\"Ours\"", "Montreur d'ours : l'asile"],
  ["jour.mjs", "const vrai = v?.role?.apparence || v?.camp || \"village\";", "const vrai = v?.role?.camp || \"village\";", "Pèlerine : le vrai camp"],
  ["jour.mjs", "  pelerine: { source: \"role\", cibles: 1, soiMeme: false, phases: JOURNEE },", "  pelerine: { source: \"role\", cibles: 1, soiMeme: true, phases: JOURNEE },", "Pèlerine : pas soi-même"],
  // le Banc des accusés
  ["banc.mjs", "  if (!etat.banc.actif) return non(\"inactif\");\n", "", "banc : la variante"],
  ["banc.mjs", "  if (etat.phase !== \"jour\" || etat.vote.ouvert) return non(\"phase\");\n", "", "banc : pendant le débat"],
  ["banc.mjs", "  if (a.silence) return non(\"silence\");\n", "", "banc : le silence"],
  ["banc.mjs", "  if (a.vivant === false) return non(\"mort\");\n", "", "banc : les morts n'accusent pas"],
  ["banc.mjs", "  if (banc.accusations.some(x => x.par === par)) return non(\"deja\");\n", "", "banc : une accusation par jour"],
  ["banc.mjs", "  if (banc.accusations.some(x => x.contre === contre)) return non(\"accuse\");\n", "", "banc : accusé une fois par jour"],
  ["banc.mjs", "if (!c || c.vivant === false || contre === par)", "if (!c)", "banc : un autre vivant"],
  ["banc.mjs", "const duJour = etat => (etat.banc.tour === etat.tour ? etat.banc :", "const duJour = etat => (true ? etat.banc :", "banc : un banc par jour"],
  ["banc.mjs", "  if (executeAujourdhui) return \"\";\n", "", "banc : une exécution par jour"],
  ["banc.mjs", "find(id => !etat.banc.juges.includes(id) && vivant(id))", "find(id => vivant(id))", "banc : jugé une fois"],
  ["banc.mjs", "find(id => !etat.banc.juges.includes(id) && vivant(id))", "find(id => !etat.banc.juges.includes(id))", "banc : pas les morts"],
  ["banc.mjs", "strict ? pour * 2 > total : pour * 2 >= total", "pour * 2 > total", "banc : la moitié suffit"],
  ["banc.mjs", "strict ? pour * 2 > total : pour * 2 >= total", "pour * 2 >= total", "banc : le Gibet"],
  ["banc.mjs", "const total = vivants.reduce((s, id) => s + p(id), 0);", "const total = vivants.length;", "banc : le Bailli au total"],
  ["etat.mjs", "  if (execution && banc) Object.assign(etat.vote, { banc: { accuse: banc }, double: false });\n", "  if (execution && banc) Object.assign(etat.vote, { banc: { accuse: banc } });\n", "banc : sans cloche"],
  ["etat.mjs", "  if (execution && banc) candidats = [banc];\n", "", "banc : un seul candidat"],
  ["etat.mjs", "const vivants = (votants ?? Object.keys(v.votes)).filter(id => !souffles.includes(id));", "const vivants = votants ?? Object.keys(v.votes);", "banc : les souffles hors du total"],
  ["etat.mjs", "Object.assign(r, { elus: vd.condamne ? [v.banc.accuse] : [],", "Object.assign(r, { elus: [v.banc.accuse],", "banc : le verdict"],
  ["bailli.mjs", "...(r.banc ? { banc: { ...r.banc } } : {})", "...({})", "banc : au Registre"],
  ["jour.mjs", "objet: \"execution\", banc: ancien.banc?.accuse ?? \"\", maintenant", "objet: \"execution\", maintenant", "banc : le Juge de paix rejuge"],
  // le Glas du deuil
  ["deuil.mjs", "if (!etat.deuil.actif || camp === \"meute\")", "if (!etat.deuil.actif)", "deuil : un innocent"],
  ["deuil.mjs", "if (!etat.deuil.actif || camp === \"meute\")", "if (camp === \"meute\")", "deuil : la variante"],
  ["deuil.mjs", "  if (n === 1) p.visions += 1;\n", "", "deuil : la vision"],
  ["deuil.mjs", "  if (n === 2) p.voix = true;\n", "", "deuil : la voix"],
  ["deuil.mjs", "etat.phase === \"nuit\" ? etat.tour : etat.tour + 1", "etat.tour + 1", "deuil : le linceul de la nuit même"],
  ["deuil.mjs", "  if (n === 3) p.linceul", "  if (n >= 3) p.linceul", "deuil : un seul linceul"],
  ["deuil.mjs", " || (etat?.vote?.objet ?? \"execution\") !== \"execution\"", "", "deuil : exécution seulement"],
  ["deuil.mjs", "  && villageois.some(v => v.vivant !== false && v.camp === \"meute\");", ";", "deuil : une meute vivante"],
  ["deuil.mjs", "=== nuit && nuit > 0", "> 0", "deuil : le linceul, une nuit"],
  ["etat.mjs", "  delete r.votes[VOIX_DU_DEUIL];\n", "", "deuil : une voix sans votant"],
  ["etat.mjs", "const votes = deuil ? { ...v.votes, [VOIX_DU_DEUIL]: deuil } : v.votes;", "const votes = v.votes;", "deuil : la voix comptée"],
  ["etat.mjs", "\"pouvoirsDeuil\", \"autel\", \"carnets\"", "\"autel\", \"carnets\"", "deuil : pouvoirs secrets"],
  ["nuit.mjs", "    if (meute.length && deuil) etapes.set(CLE_DEUIL,", "    if (meute.length) etapes.set(CLE_DEUIL,", "deuil : réveil dû"],
  ["resolution.mjs", "    if (linceul) return \"\";\n", "", "deuil : linceul (portes)"],
  ["resolution.mjs", "    if (linceul && x.meute && !x.peste) { frapper(x); continue; }\n", "", "deuil : linceul (garde)"],
  ["resolution.mjs", "    for (const loup of vivantsMeute) {\n      sortie.messages.push(msg(loup, \"VisionDeuil\"", "    for (const loup of [a.acteurId]) {\n      sortie.messages.push(msg(loup, \"VisionDeuil\"", "deuil : la vision à toute la meute"],
  ["jour.mjs", "    linceul: linceulDeLaNuit(etat, tour)", "    linceul: false", "deuil : le linceul de la nuit"],
  // la Nuit de la Saint-Martin
  ["saintmartin.mjs", "export const loupsSaintMartin = n => (n >= 7 ? 2 : 1);", "export const loupsSaintMartin = () => 1;", "saint-martin : deux loups à 7"],
  ["saintmartin.mjs", "  for (const c of SOCLE) if (permis(c) && roles.length < total) roles.push(c);\n", "", "saint-martin : le socle"],
  ["saintmartin.mjs", "if (roles.length < total - 1) roles.push(c);", "if (roles.length < total) roles.push(c);", "saint-martin : un villageois"],
  ["saintmartin.mjs", "return { joueurs: tires.slice(0, n), autel: tires.slice(n) };", "return { joueurs: tires.slice(0, n), autel: tires.slice(n, n + 1) };", "saint-martin : l'autel"],
  ["saintmartin.mjs", "  if (executes.some(v => v.camp === \"meute\")) return \"village\";\n", "", "saint-martin : un loup exécuté"],
  ["saintmartin.mjs", "  if (revenant) return revenant.id;\n", "", "saint-martin : le Revenant"],
  ["saintmartin.mjs", "return executes.length ? VAINQUEUR_BRUME : \"village\";", "return \"village\";", "saint-martin : la brume"],
  ["saintmartin.mjs", "morts.filter(m => m.cause === \"vote\")", "morts", "saint-martin : exécutés seulement"],
  ["saintmartin.mjs", "x.type === \"vote\" && x.objet === \"execution\" && !x.annule", "x.type === \"vote\" && !x.annule", "saint-martin : vote d'exécution"],
  ["saintmartin.mjs", "  return (r.elus ?? []).every(id => villageois.find(v => v.id === id)?.vivant === false);\n}", "  return true;\n}", "saint-martin : après les exécutions"],
  ["victoire.mjs", "if (saintMartin !== null) return saintMartin ? victoireSaintMartin({ villageois, morts }) : \"\";", "if (saintMartin) return victoireSaintMartin({ villageois, morts });", "saint-martin : rien avant le vote"],
  ["etat.mjs", "\"pouvoirsDeuil\", \"autel\", \"carnets\"", "\"pouvoirsDeuil\", \"carnets\"", "saint-martin : l'autel secret"],
  // les étapes
  ["etapes.mjs", "\n      saintMartin: estSaintMartin(etat) ? saintMartinFinie(etat, villageois) : null, ", "", "étape : la fin de la Saint-Martin"],
  ["etapes.mjs", "    if (!etat.banc?.actif) return etape(\"ouvrirVote\", \"ouvrirVote\");\n", "", "étape : sans le Banc"],
  ["etapes.mjs", "    if (accuse) return etape(\"juger\", \"ouvrirVote\", { id: accuse, nom: nom(accuse) });\n", "", "étape : juger"],
  ["etapes.mjs", "      if (r?.banc && r.objet === \"execution\" && r.tour === etat.tour && prochainAccuse(etat, villageois)) return voteDuJour();\n", "", "étape : l'accusé suivant"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-lot3-mutant-"));
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

test("lot 3 (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("lot 3 (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("les rôles de passage du contenu sont ceux du système, sans nuit, d'un usage", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  const { ROLES } = await import("../modules/lakour-veillees/contenu/roles.mjs");
  const passage = ROLES.filter(r => L.ROLES_DE_PASSAGE.includes(r.system.cle)).map(r => r.system);
  assert.deepEqual(passage.map(r => r.cle).sort(), [...L.ROLES_DE_PASSAGE].sort());
  for (const r of passage) {
    assert.ok(!r.nuit?.actif, `${r.cle} : pas de nuit`);
    assert.equal(r.usages?.max, 1, `${r.cle} : un usage`);
    assert.equal(r.camp, "village", `${r.cle} : le camp public du rôle (le vrai est sur le villageois)`);
    assert.equal(L.POUVOIRS_JOUR[r.cle]?.source, "role", `${r.cle} : un pouvoir de jour`);
  }
});
