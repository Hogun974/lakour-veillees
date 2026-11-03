// La variante « Peste noire » dans la logique pure de lakour-loups (logique/peste.mjs et ses branchements) : composition sans
// meute, rareté (tirage à graine), drapeau secret jamais public, nuits (narrateur puis porteur, protections comme contre la
// meute, aucun loup qui entre), cri juste ou faux, victoires (cri, extinction), composition jamais dans l'état public.
// Chaque règle est cassée à son tour dans une copie de la logique : la batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));
const EQUILIBRE = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));

const R = {
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false } },
  garde: { cle: "garde-du-pont", nom: "Garde", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20 } },
  veilleuse: { cle: "veilleuse-de-lanterne", nom: "Veilleuse", camp: "village", effet: "eclairer", nuit: { actif: true, ordre: 30 } },
  herboriste: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 60 } },
  ermite: { cle: "ermite", nom: "Ermite", camp: "village", effet: "voir-actif", nuit: { actif: true, ordre: 70, cibles: 0 } },
  pyromane: { cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", victoireCle: "dernier-survivant", nuit: { actif: true, ordre: 80, soiMeme: true } },
  revenant: { cle: "revenant", nom: "Revenant", camp: "solitaire", effet: "", nuit: { actif: false } },
  loup: { cle: "loup-de-brumecombe", nom: "Loup", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }
};
const v = (id, role, extra = {}) => ({ id, nom: id, vivant: true, camp: R[role].camp, maison: `Maison ${extra.n ?? 1}`, amoureux: "", protections: 0,
  silence: false, role: structuredClone(R[role]), ...extra });
// Le village d'une peste : p (le porteur, mort), une garde, une veilleuse, une herboriste, un ermite, x et y (sur l'autre rive).
const village = () => [v("p", "garde", { vivant: false, n: 2 }), v("g", "garde", { n: 3 }), v("vl", "veilleuse", { n: 4 }), v("h", "herboriste", { n: 5 }),
  v("e", "ermite", { n: 6 }), v("x", "villageois", { n: 7 }), v("y", "villageois", { n: 13 })];
const peste = (cible, acteurId = "p") => ({ acteurId, roleCle: "peste", cibles: [cible] });
const PESTE = { active: true, porteur: "p", victimes: ["p"], decouverte: false, crieur: "" };
const nuit = (L, actions, extra = {}) => L.resoudreNuit({ villageois: village(), actions, tour: 2, hasard: () => 0.5, ...extra });

// Un état complet de partie de peste, au jour 2.
function partie(L, phase = "jour", p = PESTE) {
  const e = L.etatInitial();
  return { ...e, partie: "p1", phase, tour: 2, composition: "classique-8", peste: structuredClone(p), batimentsCles: [],
    morts: [{ acteurId: "p", tour: 1, phase: "aube", cause: "peste" }] };
}

const VERIFICATIONS = {
  // ---------------- composition
  "composition de peste : aucun rôle de la meute, autant de rôles que de joueurs, une information": L => {
    // (La Petite tablée, 0.11.0, compte 12 places au plus : ses pestes noires sont composées sur ses tailles.)
    for (const niveau of L.NIVEAUX) for (const n of (niveau === L.NIVEAU_PETITE_TABLEE ? [6, 8, 10, 12] : [6, 8, 10, 13, 15, 18])) {
      const c = L.composer(n, EQUILIBRE, { niveau, graine: `${niveau}-${n}`, peste: true, essais: 200 });
      assert.equal(c.roles.length, n);
      assert.ok(c.roles.every(cle => EQUILIBRE.roles[cle].camp !== "meute"), `${niveau}/${n} : ${c.roles.join(", ")}`);
      assert.equal(c.camps.meute, 0);
      assert.equal(c.peste, true);
      assert.ok(c.roles.some(cle => EQUILIBRE.roles[cle].information), "au moins un rôle d'information");
      assert.ok(c.batiments.length >= 4, "des bâtiments comme d'habitude");
    }
  },
  "composition ordinaire : des loups, pas de peste": L => {
    const c = L.composer(10, EQUILIBRE, { graine: "ordinaire", essais: 200 });
    assert.equal(c.roles.filter(cle => EQUILIBRE.roles[cle].camp === "meute").length, L.nombreDeLoups(10));
    assert.ok(!c.peste);
  },
  "rôles imposés de la meute retirés d'une peste": L => {
    assert.deepEqual(L.sansMeute(["loup-de-brumecombe", "herboriste", "louve-mere"], EQUILIBRE), ["villageois", "herboriste", "villageois"]);
    const c = L.composer(9, EQUILIBRE, { graine: "inclure", inclure: ["loup-affame", "herboriste"], peste: true, essais: 100 });
    assert.ok(!c.roles.includes("loup-affame") && c.roles.includes("herboriste"));
  },
  // ---------------- rareté
  "rareté : environ une partie sur trente, reproductible avec la graine": L => {
    assert.equal(L.CHANCE_PESTE, 1 / 30);
    let n = 0;
    for (let i = 0; i < 6000; i++) if (L.tirerPeste({ graine: `veillee-${i}` })) n++;
    assert.ok(n / 6000 > 1 / 45 && n / 6000 < 1 / 20, `fréquence ${n}/6000`);
    for (const g of ["a", "b", "veillee-7", 42]) assert.equal(L.tirerPeste({ graine: g }), L.tirerPeste({ graine: g }), "même graine, même tirage");
    // À une chance sur deux, un tirage au hasard se trahirait presque à coup sûr sur quarante graines.
    for (let i = 0; i < 40; i++) assert.equal(L.tirerPeste({ graine: `r${i}`, chance: 0.5 }), L.tirerPeste({ graine: `r${i}`, chance: 0.5 }), "même graine, même tirage");
    // Une graine qui tombe sur la peste, et une qui n'y tombe pas : toujours les mêmes.
    const oui = Array.from({ length: 200 }, (_, i) => `g${i}`).find(g => L.tirerPeste({ graine: g }));
    assert.ok(oui && L.tirerPeste({ graine: oui }));
    assert.equal(L.tirerPeste({ graine: "x", chance: 0 }), false);
    assert.equal(L.tirerPeste({ graine: "x", chance: 1 }), true);
  },
  // ---------------- le secret
  "le drapeau et la composition sont des secrets (jamais dans l'état public avant la fin)": L => {
    const { public: pub, secret } = L.separerEtat(partie(L));
    assert.ok(!("peste" in pub), "clé peste dans l'état public");
    assert.equal(pub.composition, "", "composition dans l'état public");
    assert.equal(secret.peste.active, true);
    assert.equal(secret.composition, "classique-8");
    assert.equal(pub.morts[0].cause, "nuit", "la vraie cause « peste » est secrète");
    assert.equal(L.causePublique("peste"), "nuit");
    const complet = L.fusionnerEtat(pub, secret);
    assert.deepEqual([complet.peste, complet.composition, complet.morts[0].cause], [PESTE, "classique-8", "peste"]);
    // Une partie ordinaire : pas de clé non plus (rien ne distingue les deux).
    assert.ok(!("peste" in L.separerEtat({ ...partie(L), peste: null }).public));
    // À la fin, la partie se dévoile.
    assert.equal(L.separerEtat({ ...partie(L), phase: "fin", vainqueur: "peste" }).public.peste.active, true);
  },
  // ---------------- la nuit
  "ordre de nuit : la peste à la place de la meute, avec son porteur": L => {
    const vs = [...village(), v("l", "loup", { n: 8 })];
    const o = L.ordreDeNuit(vs, 2, { peste: PESTE });
    assert.ok(!o.some(e => e.roleCle === "meute"), "pas de meute");
    const p = o.find(e => e.roleCle === "peste");
    assert.deepEqual([p.ordre, p.acteurIds], [40, ["p"]], "le porteur, mort, est réveillé");
    assert.deepEqual(L.ordreDeNuit(vs, 1, { peste: { ...PESTE, porteur: "" } }).find(e => e.roleCle === "peste").acteurIds, [], "sans porteur : le narrateur");
    assert.ok(L.ordreDeNuit(vs, 2).some(e => e.roleCle === "meute"), "partie ordinaire : la meute");
    assert.equal(L.ordreDeNuit(vs, 2, { peste: PESTE }).findIndex(e => e.roleCle === "peste"), o.filter(e => e.ordre < 40).length, "à l'ordre 40");
  },
  "la peste tue (cause secrète « peste »), même portée par un mort ou par le narrateur": L => {
    for (const acteurId of ["p", ""]) {
      const r = nuit(L, [peste("x", acteurId)]);
      assert.deepEqual(r.morts, ["x"]);
      assert.deepEqual(r.deces, [{ acteurId: "x", cause: "peste" }]);
      assert.equal(r.bilan.victime, "x");
      assert.equal(r.bilan.loup, "");
      assert.ok(r.bilan.visites.includes("x"), "la maison a reçu de la visite (Ramoneuse)");
      assert.ok(!r.bilan.sorties.includes("p"), "le porteur ne sort pas");
    }
  },
  "protections comme contre la meute : garde, remède, verrou, asile, Taverne, absence, Pont, immunité": L => {
    assert.deepEqual(nuit(L, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, peste("x")]).morts, [], "garde");
    assert.deepEqual(nuit(L, [peste("x"), { acteurId: "h", roleCle: "herboriste", cibles: ["x"] }]).morts, [], "remède");
    for (const [cle, jour] of [["verrou", { verrous: ["x"] }], ["asile", { asiles: ["x"] }], ["taverne", { taverne: ["x"], taverneEnJeu: true }], ["absence", { horsDAtteinte: ["x"] }]]) {
      const r = nuit(L, [peste("x")], { jour });
      assert.deepEqual(r.morts, [], cle);
    }
    assert.deepEqual(nuit(L, [peste("y")], { jour: { pontBloque: true } }).morts, [], "Pont bloqué : pas l'autre rive");
    const r = L.resoudreNuit({ villageois: [...village(), v("z", "pyromane", { n: 9 })], actions: [peste("z")], tour: 2 });
    assert.deepEqual(r.morts, [], "immunité du tueur solitaire, comme contre la meute");
  },
  "le Pont : une victime de la peste sur l'autre rive le bloque, comme une proie de la meute": L => {
    assert.equal(nuit(L, [peste("y")]).pontFranchi, true);
    assert.equal(nuit(L, [peste("x")]).pontFranchi, false);
  },
  "aucun loup n'entre : la lanterne ne voit rien, l'Ermite ne voit pas le porteur": L => {
    const r = nuit(L, [peste("x"), { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] }]);
    assert.deepEqual(r.revelations, []);
    const e = nuit(L, [peste("x")]).messages.find(m => m.destinataire === "e");
    assert.equal(e?.cle, "LAKOUR_LOUPS.Nuit.ActifPersonne", "personne n'est sorti : le porteur ne compte pas");
  },
  "candidats de la peste : comme ceux de la meute (asile, Taverne, absents, Pont)": L => {
    const e = { ...L.etatInitial(), tour: 2, batimentsCles: ["taverne", "pont"], pont: { bloqueNuit: 2 },
      jour: { ...L.jourInitial(), effets: [{ type: "asile", cible: "g", nuit: 2 }, { type: "taverne", cible: "h", nuit: 2 }, { type: "traversee", cible: "vl", nuit: 2 }] } };
    assert.deepEqual(L.candidatsDeNuit({ villageois: village(), etat: e, acteurId: "p", roleCle: "peste", tour: 2 }).sort(), ["e", "x"]);
  },
  "le porteur : la dernière victime morte de la peste": L => {
    let e = partie(L, "aube");
    e = L.suivrePeste(e, [{ acteurId: "x", cause: "peste" }, { acteurId: "y", cause: "chagrin" }]);
    assert.equal(e.peste.porteur, "x");
    assert.deepEqual(e.peste.victimes, ["p", "x"]);
    e = L.suivrePeste(e, [{ acteurId: "g", cause: "poison" }]);
    assert.equal(e.peste.porteur, "x", "une autre mort ne change pas le porteur");
    assert.equal(L.suivrePeste({ ...partie(L), peste: null }, [{ acteurId: "x", cause: "peste" }]).peste, null);
  },
  // ---------------- le cri
  "le cri : un vivant, le jour, sans silence": L => {
    const vs = village();
    const ok = (phase, id = "x", extra = {}) => L.verifierCri({ villageois: vs.map(x => (x.id === id ? { ...x, ...extra } : x)), etat: partie(L, phase), acteurId: id });
    for (const phase of ["aube", "jour", "vote"]) assert.equal(ok(phase).ok, true, phase);
    assert.equal(ok("nuit").raison, "phase");
    assert.equal(ok("jour", "p").raison, "mort");
    assert.equal(ok("jour", "x", { silence: true }).raison, "silence");
    assert.equal(ok("jour", "inconnu").raison, "absent");
    assert.equal(L.verifierCri({ villageois: vs, etat: { ...partie(L), vainqueur: "peste", phase: "fin" }, acteurId: "x" }).raison, "partie");
  },
  "cri juste : la peste découverte, le vote se ferme, le village gagne": L => {
    const e = { ...partie(L, "vote"), vote: { ...L.etatInitial().vote, ouvert: true } };
    const r = L.crierPeste({ villageois: village(), etat: e, acteurId: "x" });
    assert.deepEqual([r.ok, r.juste, r.mort, r.etat.peste.decouverte, r.etat.peste.crieur, r.etat.vote.ouvert], [true, true, "", true, "x", false]);
    assert.equal(r.annonces[0].cle, "LAKOUR_LOUPS.Peste.CriJuste");
    assert.equal(L.verifierVictoire({ villageois: village(), morts: r.etat.morts, peste: r.etat.peste }), "village");
  },
  "cri faux : le crieur est pendu (partie ordinaire)": L => {
    const r = L.crierPeste({ villageois: village(), etat: { ...partie(L), peste: null }, acteurId: "x" });
    assert.deepEqual([r.ok, r.juste, r.mort], [true, false, "x"]);
    assert.equal(r.annonces[0].cle, "LAKOUR_LOUPS.Peste.CriFaux");
    assert.equal(L.crierPeste({ villageois: village(), etat: partie(L, "nuit"), acteurId: "x" }).ok, false, "pas la nuit");
  },
  // ---------------- les fins
  "victoires de la peste : extinction (un vivant ou aucun), jamais « plus de loup »": L => {
    const vs = village();
    const vivants = ids => vs.map(x => ({ ...x, vivant: ids.includes(x.id) }));
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [], peste: PESTE }), "", "sans loup, le village n'a pas gagné pour autant");
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [] }), "village", "partie ordinaire sans loup : le village");
    assert.equal(L.verifierVictoire({ villageois: vivants(["x", "y"]), morts: [], peste: PESTE }), "");
    assert.equal(L.verifierVictoire({ villageois: vivants(["x"]), morts: [], peste: PESTE }), "peste");
    assert.equal(L.verifierVictoire({ villageois: vivants([]), morts: [], peste: PESTE }), "peste");
    assert.equal(L.verifierVictoire({ villageois: vivants(["x", "y"]), morts: [], peste: { ...PESTE, decouverte: true } }), "village");
    // Le Revenant exécuté gagne quand même.
    const r = [...vs, v("rv", "revenant", { vivant: false })];
    assert.equal(L.verifierVictoire({ villageois: r, morts: [{ acteurId: "rv", cause: "vote" }], peste: PESTE }), "rv");
    // Personne ne gagne avec la peste (récit de fin).
    assert.ok(L.bilanDePartie({ villageois: vs, vainqueur: "peste" }).every(l => !l.gagnant));
  },
  "étapes du MJ humain : « la peste » à réveiller, puis l'aube ; la victoire de la peste": L => {
    const vs = village();
    // La Garde (20) et la Veilleuse (30) ont agi : vient la peste (40).
    const avant = { ...partie(L, "nuit"), nuit: { actions: [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] }] } };
    const { public: pub, secret } = L.separerEtat(avant);
    const e = L.etapeSuivante(pub, secret, { villageois: vs });
    assert.deepEqual([e.cle, e.donnees.role, e.donnees.peste, e.donnees.qui], ["reveiller", "peste", true, "p"]);
    const sansSecrets = L.etapeSuivante(pub, null, { villageois: vs });
    assert.ok(sansSecrets.donnees.role !== "peste", "sans les secrets, rien de la peste");
    const fin = L.separerEtat({ ...partie(L, "jour"), morts: [] });
    const un = vs.map(x => ({ ...x, vivant: x.id === "x" }));
    assert.equal(L.etapeSuivante(fin.public, fin.secret, { villageois: un }).cle, "victoire");
    // Deux vivants sans loup : une peste continue (le vote), une partie ordinaire serait gagnée.
    const deux = vs.map(x => ({ ...x, vivant: ["x", "y"].includes(x.id) }));
    assert.equal(L.etapeSuivante(fin.public, fin.secret, { villageois: deux }).cle, "ouvrirVote");
  }
};

// [fichier de logique/, avant, après, règle]
const MUTATIONS = [
  ["constantes.mjs", "export const CAUSES_SECRETES = [\"meute\", \"poison\", \"feu\", \"epie\", \"peste\"];", "export const CAUSES_SECRETES = [\"meute\", \"poison\", \"feu\", \"epie\"];", "cause secrète"],
  ["etat.mjs", "  delete pub.peste;\n", "", "drapeau public"],
  ["etat.mjs", "if (etat.phase === \"fin\" && etat.peste) pub.peste", "if (etat.peste) pub.peste", "dévoilé avant la fin"],
  ["etat.mjs", "\"carnets\", \"causes\", \"composition\",\n", "\"carnets\", \"causes\",\n", "composition publique"],
  ["etat.mjs", "  if (s.peste !== undefined) etat.peste = normaliserPeste(s.peste);\n", "", "secret rendu au MJ"],
  ["composition.mjs", "essais = 1200, peste = false } = {}) {", "essais = 1200, peste: _peste = false } = {}) {\n  const peste = false;", "composition de peste ignorée"],
  ["composition.mjs", "export const sansMeute = (roles, equilibre) => roles.map(cle => (equilibre.roles?.[cle]?.camp === \"meute\" ? BASE_VILLAGE : cle));",
    "export const sansMeute = roles => [...roles];", "rôles imposés de la meute"],
  ["peste.mjs", "return h() < chance;", "return h() < chance * 3;", "rareté"],
  ["peste.mjs", "`peste|${graine}`", "undefined", "tirage reproductible"],
  ["peste.mjs", "    etat.peste.porteur = d.acteurId;\n", "", "porteur"],
  ["peste.mjs", "  if (!JOURNEE.includes(etat.phase)) return non(\"phase\");\n", "", "cri la nuit"],
  ["peste.mjs", "  if (v.vivant === false) return non(\"mort\");\n", "", "cri d'un mort"],
  ["peste.mjs", "  if (v.silence && etat.phase !== \"aube\") return non(\"silence\");\n", "", "cri d'un muet"],
  ["peste.mjs", "    etat.peste.decouverte = true;\n", "", "peste découverte"],
  ["peste.mjs", "  if (estPeste(etat)) {\n    etat.peste.decouverte", "  if (false) {\n    etat.peste.decouverte", "cri toujours faux"],
  ["peste.mjs", "    etat.vote.ouvert = false;\n", "", "vote fermé par le cri"],
  ["nuit.mjs", "  if (peste?.active) {", "  if (false) {", "étape de la peste"],
  ["nuit.mjs", "acteurIds: porteur ? [porteur] : []", "acteurIds: []", "porteur réveillé"],
  ["resolution.mjs", "const deLaPeste = a.roleCle === CLE_PESTE;", "const deLaPeste = false;", "porteur mort qui agit"],
  ["resolution.mjs", "cause: CAUSES.peste, meute: true, peste: true", "cause: CAUSES.peste, meute: false, peste: true", "protections de la meute"],
  ["resolution.mjs", "attaques.push({ cible: victimePeste, cause: CAUSES.peste,", "attaques.push({ cible: victimePeste, cause: CAUSES.nuit,", "cause peste"],
  ["resolution.mjs", " || franchi(victimePeste, CAUSES.peste)", "", "Pont franchi par la peste"],
  ["resolution.mjs", "  if (victimePeste) visites.add(victimePeste);\n", "", "visite de la peste"],
  ["resolution.mjs", "retenues.filter(a => a.cibles.length && a.roleCle !== CLE_PESTE)", "retenues.filter(a => a.cibles.length)", "Ermite et porteur"],
  ["resolution.mjs", "const chasse = deLaMeute || deLaPeste || ", "const chasse = deLaMeute || ", "Pont bloqué pour la peste"],
  ["jour.mjs", "const groupe = roleCle === CLE_MEUTE || roleCle === CLE_PESTE;", "const groupe = roleCle === CLE_MEUTE;", "candidats de la peste"],
  ["victoire.mjs", "    if (peste.decouverte) return \"village\";\n", "", "victoire du cri"],
  ["victoire.mjs", "vivants.length <= 1 ? VAINQUEUR_PESTE", "vivants.length < 1 ? VAINQUEUR_PESTE", "extinction à un vivant"],
  ["victoire.mjs", "  if (peste?.active) {", "  if (false) {", "pas de victoire du village sans cri"],
  ["etapes.mjs", "ordreDeNuit(villageois, tour, { peste: etat.peste, deuil", "ordreDeNuit(villageois, tour, { deuil", "étape de la peste (MJ humain)"],
  ["etapes.mjs", "primes: etat.primes ?? {}, peste: etat.peste,", "primes: etat.primes ?? {},", "victoire de la peste (MJ humain)"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-peste-"));
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
    try { verifier(L); } catch (e) { liste.push(`${nom} : ${e.message}`); }
  }
  return liste;
}

test("peste noire : la logique d'origine passe toute la batterie", async () => {
  const L = await import("../systems/lakour-loups/logique/index.mjs");
  assert.deepEqual(echecs(L), []);
});

for (const [fichier, avant, apres, regle] of MUTATIONS) {
  test(`peste noire, mutation « ${regle} » (${fichier}) : détectée`, async () => {
    const L = await chargerMutant(fichier, avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}
