// Essais par mutation des pouvoirs de jour, des effets du jour sur la nuit, du Messager et de la séparation public / secret :
// chaque règle est cassée à son tour dans une copie de la logique, et la batterie ci-dessous doit alors échouer.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const ROLE = {
  loup: { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40, cibles: 1 }, usages: { max: 0, restant: 0 } },
  affame: { cle: "loup-affame", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 42, cibles: 1 }, usages: { max: 0, restant: 0 } },
  hurleur: { cle: "loup-hurleur", camp: "meute", effet: "silence", nuit: { actif: true, ordre: 43, cibles: 1 }, usages: { max: 0, restant: 0 } },
  garde: { cle: "garde-du-pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1, soiMeme: true }, usages: { max: 0, restant: 0 } },
  liseuse: { cle: "liseuse-de-cendres", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 60, cibles: 1 }, usages: { max: 0, restant: 0 } },
  pyromane: { cle: "pyromane", camp: "solitaire", effet: "asperger", nuit: { actif: true, ordre: 55, cibles: 1, soiMeme: true }, usages: { max: 0, restant: 0 } },
  messager: { cle: "messager", camp: "village", effet: "messager", nuit: { actif: true, ordre: 10, cibles: 2, soiMeme: true }, usages: { max: 0, restant: 0 } },
  juge: { cle: "juge-de-paix", camp: "village", effet: "annuler-vote", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  villageois: { cle: "villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
const v = (id, role, n, metier = "", extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${n}`, silence: false,
  amoureux: "", protections: 0, role: structuredClone(ROLE[role]), metier: metier ? { cle: metier, usages: { max: 1, restant: 1 } } : null, ...extra });
const base = () => [v("l1", "loup", 1, "meuniere"), v("l2", "loup", 2, "tisserande"), v("g", "garde", 3, "forgeron"), v("li", "liseuse", 4, "garde"),
  v("x", "villageois", 5, "aubergiste"), v("y", "villageois", 6, "passeur"), v("j", "juge", 7, "chasseresse"), v("t", "villageois", 8, "tanneur"),
  v("m", "villageois", 9, "maitresse-d-ecole"), v("ap", "villageois", 10, "apothicaire"), v("af", "affame", 11), v("p", "pyromane", 12),
  v("me", "messager", 13), v("hu", "hurleur", 14)];
const BATIMENTS = ["chapelle", "moulin", "taverne", "puits", "forge", "cimetiere", "pont", "lavoir", "grange"];
const jour = (L, extra = {}) => ({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1, batimentsCles: BATIMENTS, ...extra });
const agir = (L, vs, etat, a, p, c = [], texte = "") => L.appliquerPouvoir({ villageois: vs, etat, acteurId: a, pouvoir: p, cibles: c, texte, hasard: () => 0, maintenant: 1000 });
const raison = (L, vs, etat, a, p, c = [], texte = "") => L.verifierPouvoir({ villageois: vs, etat, acteurId: a, pouvoir: p, cibles: c, texte }).raison;
const nuit = (L, vs, etat, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: etat.tour + 1, hasard: () => 0, jour: L.effetsDeLaNuit(etat, etat.tour + 1), ...extra });
const meute = c => ({ acteurId: "l1", roleCle: "meute", cibles: [c] });
const mort = (vs, id) => vs.map(x => (x.id === id ? { ...x, vivant: false } : x));

const VERIFICATIONS = {
  "au matin, après une nuit": L => assert.equal(raison(L, base(), jour(L, { nuitResolue: 0 }), "j", "chasseresse", ["x"]), "nuit"),
  "pas la nuit": L => assert.equal(raison(L, base(), jour(L, { phase: "nuit" }), "g", "forgeron", ["x"]), "phase"),
  "un usage": L => assert.equal(raison(L, base().map(x => x.id === "g" ? { ...x, metier: { cle: "forgeron", usages: { max: 1, restant: 0 } } } : x), jour(L), "g", "forgeron", ["x"]), "usage"),
  "trois lits à la Taverne": L => {
    let e = jour(L);
    for (const a of ["x", "y", "t"]) e = agir(L, base(), e, a, "taverne").etat;
    assert.equal(raison(L, base(), e, "m", "taverne"), "plein");
  },
  "une lame par partie": L => assert.equal(raison(L, base(), agir(L, base(), jour(L), "x", "forge").etat, "y", "forge"), "deja"),
  "la Grange une fois par joueur": L => assert.equal(raison(L, base(), { ...agir(L, base(), jour(L), "x", "grange").etat, tour: 3 }, "x", "grange"), "deja"),
  "dix mots au Puits": L => {
    const vs = mort(base(), "x");
    const e = L.ajouterMort(jour(L), { acteurId: "x", cause: "vote" });
    assert.equal(raison(L, vs, e, "x", "puits", [], "a b c d e f g h i j k"), "texte");
  },
  "le Puits pour un mort récent": L => {
    const vs = mort(base(), "x");
    const e = L.ajouterMort(jour(L), { acteurId: "x", cause: "vote" });
    assert.equal(raison(L, vs, { ...e, tour: 2 }, "x", "puits", [], "trop tard"), "recent");
  },
  "le Juge avant l'exécution": L => {
    const clos = L.cloreVote(L.enregistrerVote(L.ouvrirVote(jour(L), { candidats: ["x"] }), { votant: "a", cible: "x" }).etat).etat;
    assert.equal(raison(L, base(), clos, "j", "juge-de-paix"), "");
    assert.equal(raison(L, mort(base(), "x"), clos, "j", "juge-de-paix"), "vote");
  },
  "le Juge fait revoter": L => {
    const clos = L.cloreVote(L.enregistrerVote(L.ouvrirVote(jour(L), { candidats: ["x"] }), { votant: "a", cible: "x" }).etat).etat;
    const r = agir(L, base(), clos, "j", "juge-de-paix");
    assert.equal(r.etat.vote.ouvert, true);
    assert.ok(r.changements.some(c => c.type === "revele"));
  },
  "Chapelle : jamais deux nuits de suite": L => {
    const e = agir(L, base(), jour(L), "", "chapelle", ["x"]).etat;
    assert.ok(!L.candidatsDuPouvoir({ villageois: base(), etat: { ...e, tour: 2 }, pouvoir: "chapelle" }).includes("x"));
  },
  "Chapelle : la meute n'y entre pas": L => assert.deepEqual(nuit(L, base(), agir(L, base(), jour(L), "", "chapelle", ["x"]).etat, [meute("x")]).morts, []),
  "Tanneur : les crocs selon la vraie cause": L => {
    const vs = mort(base(), "x");
    const e = L.ajouterMort(jour(L, { phase: "aube" }), { acteurId: "x", cause: "poison" });
    e.morts[0].phase = "aube";
    assert.match(agir(L, vs, e, "t", "tanneur", ["x"]).annonces[0].texte, /aucune trace/);
  },
  "Ramoneuse : les visites de la nuit": L => {
    const vs = [...base(), v("ra", "villageois", 15, "ramoneuse")];
    const e = { ...jour(L, { phase: "aube" }), nuitPrecedente: { actions: [], bilan: { sorties: ["x"], visites: ["g"] } } };
    assert.match(agir(L, vs, e, "ra", "ramoneuse", ["x"]).annonces[0].texte, /personne n.est venu/);
    assert.match(agir(L, vs, e, "ra", "ramoneuse", ["g"]).annonces[0].texte, /reçu de la visite/);
  },
  "Éclusière : la meute ne traverse pas": L => {
    const vs = [...base(), v("ec", "villageois", 16, "eclusiere")];
    const e = agir(L, vs, jour(L, { batimentsCles: [] }), "ec", "eclusiere").etat;
    assert.ok(!L.candidatsDeNuit({ villageois: vs, etat: e, roleCle: "meute", tour: 2 }).includes("me"));
    assert.deepEqual(nuit(L, vs, e, [meute("me")]).morts, []);
  },
  "Éclusière : une écluse par nuit": L => {
    const vs = [...base(), v("ec", "villageois", 16, "eclusiere")];
    assert.equal(raison(L, vs, agir(L, vs, jour(L), "ec", "eclusiere").etat, "ec", "eclusiere"), "deja");
  },
  "Chasseresse : le bilan de la nuit": L => {
    const e = { ...jour(L, { phase: "aube" }), nuitPrecedente: { actions: [], bilan: { sorties: ["li"], visites: [] } } };
    assert.match(agir(L, base(), e, "j", "chasseresse", ["x"]).annonces[0].texte, /n'a pas quitté/);
  },
  "Meunière : les loups VIVANTS": L => assert.match(agir(L, mort(base(), "l2"), jour(L), "l1", "meuniere").annonces[0].texte, /: 3 loup/),
  "Apothicaire : seulement un joueur réduit au silence": L => assert.deepEqual(L.candidatsDuPouvoir({ villageois: base(), etat: jour(L), acteurId: "ap", pouvoir: "apothicaire" }), []),
  "Maîtresse d'école : l'appel part du joueur choisi": L => assert.equal(agir(L, base(), jour(L), "m", "maitresse-d-ecole", ["x"]).etat.jour.appel.ordre[0], "x"),
  "Garde du guet : candidats de nuit": L => assert.deepEqual(L.candidatsDeNuit({ villageois: base(), etat: agir(L, base(), jour(L), "li", "garde", ["g"]).etat, acteurId: "g", roleCle: "garde-du-pont", tour: 2 }), ["g"]),
  "Garde du guet : action refusée la nuit": L => assert.deepEqual(nuit(L, base(), agir(L, base(), jour(L), "li", "garde", ["g"]).etat, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")]).morts, ["x"]),
  "Garde du guet : la meute chasse sans lui": L => {
    let e = agir(L, base(), jour(L), "li", "garde", ["l1"]).etat;
    e.jour.effets.push({ type: "surveille", acteurId: "z", cible: "l2", nuit: 2 });
    e.jour.effets.push({ type: "surveille", acteurId: "z", cible: "af", nuit: 2 });
    e.jour.effets.push({ type: "surveille", acteurId: "z", cible: "hu", nuit: 2 });
    assert.deepEqual(nuit(L, base(), e, [meute("x")]).morts, []);
  },
  "Pont : candidats de la meute": L => {
    const e = L.cloreNuit({ ...jour(L), phase: "nuit" }, { pontFranchi: true });
    assert.ok(!L.candidatsDeNuit({ villageois: base(), etat: e, roleCle: "meute", tour: 2 }).includes("me"));
  },
  "Pont : la meute ne traverse pas": L => assert.deepEqual(nuit(L, base(), L.cloreNuit({ ...jour(L), phase: "nuit" }, { pontFranchi: true }), [meute("me")]).morts, []),
  "Pont : franchi après une mort sur l'autre rive": L => {
    assert.equal(L.resoudreNuit({ villageois: base(), actions: [meute("me")] }).pontFranchi, true);
    assert.equal(L.resoudreNuit({ villageois: base(), actions: [meute("x")] }).pontFranchi, false);
  },
  "Moulin : un matin sur deux sans Meunière": L => assert.deepEqual(L.annoncesDeLAube({ villageois: mort(base(), "l1"), etat: jour(L), tour: 1, batiments: ["moulin"] }).annonces, []),
  "Cimetière : seulement sans révélation": L => assert.deepEqual(L.annoncesDeLAube({ villageois: mort(base(), "x"), etat: jour(L), tour: 1, batiments: ["cimetiere"], revelerALaMort: true }).annonces, []),
  "verrou : la première attaque seulement": L => {
    const e = agir(L, base(), jour(L), "g", "forgeron", ["x"]).etat;
    assert.deepEqual(nuit(L, base(), e, [meute("x"), { acteurId: "af", roleCle: "loup-affame", cibles: ["x"] }]).morts, ["x"]);
    assert.deepEqual(nuit(L, base(), e, [meute("x")]).morts, []);
  },
  "Taverne : un loup y dort, la meute y tue sans protection": L => {
    let e = agir(L, base(), jour(L), "x", "taverne").etat;
    e = agir(L, base(), e, "l2", "taverne").etat;
    assert.deepEqual(nuit(L, base(), e, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")]).morts, ["x"]);
  },
  "Taverne : sans loup, la meute n'y tue pas": L => assert.deepEqual(nuit(L, base(), agir(L, base(), jour(L), "x", "taverne").etat, [meute("x")]).morts, []),
  "hors d'atteinte : il n'agit pas": L => {
    const e = agir(L, base(), jour(L), "y", "passeur", ["g"]).etat;
    assert.deepEqual(nuit(L, base(), e, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, meute("x")]).morts, ["x"]);
  },
  "hors d'atteinte : personne ne le visite": L => {
    const e = agir(L, base(), jour(L), "y", "passeur", ["x"]).etat;
    assert.deepEqual(nuit(L, base(), e, [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["x"] }]).messages.filter(m => m.cle.endsWith("VoirCamp")), []);
  },
  "hors d'atteinte : le feu d'une maison vide": L => {
    const e = agir(L, base(), jour(L), "y", "passeur", ["x"]).etat;
    assert.deepEqual(nuit(L, base(), e, [{ acteurId: "p", roleCle: "pyromane", cibles: ["p"] }], { asperges: ["x"] }).morts, []);
  },
  "Curé : le béni n'est pas réduit au silence": L => {
    const vs = base().map(a => (a.id === "x" ? { ...a, metier: { cle: "cure", usages: { max: 1, restant: 1 } } } : a));
    const e = agir(L, vs, jour(L), "x", "cure", ["y"]).etat;
    assert.ok(!nuit(L, vs, e, [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["y"] }]).changements.some(c => c.type === "silence"));
    assert.ok(nuit(L, vs, jour(L), [{ acteurId: "hu", roleCle: "loup-hurleur", cibles: ["y"] }]).changements.some(c => c.type === "silence"));
  },
  "Forge : pas de sang à travers un asile": L => {
    let e = agir(L, base(), jour(L), "x", "forge").etat;
    e = agir(L, base(), e, "", "chapelle", ["x"]).etat;
    assert.deepEqual(nuit(L, base(), e, [meute("x")]).annonces, []);
    assert.equal(nuit(L, base(), agir(L, base(), jour(L), "x", "forge").etat, [meute("x")]).annonces.length, 1);
  },
  "Messager : au destinataire, sans balises": L => {
    const r = L.resoudreNuit({ villageois: base(), actions: [{ acteurId: "me", roleCle: "messager", cibles: ["x", "y"], texte: "<i>Psst</i>" }] });
    assert.deepEqual(r.messages.filter(m => m.cle.endsWith("MessageRecu")).map(m => [m.destinataire, m.donnees.texte]), [["y", "Psst"]]);
  },
  "bilan : la meute qui chasse sort": L => assert.ok(L.resoudreNuit({ villageois: base(), actions: [meute("x")], hasard: () => 0 }).bilan.sorties.includes("l2")),
  "Tisserande : le ruban prolonge, une fois": L => {
    let e = agir(L, base(), jour(L), "l2", "tisserande", ["x"]).etat;
    e = L.enregistrerVote(L.ouvrirVote(e, { candidats: ["x"] }), { votant: "a", cible: "x" }).etat;
    const c = L.cloreVote(e, { maintenant: 0 });
    assert.equal(c.prolonge, "x");
    assert.equal(L.cloreVote(c.etat).resultat.elu, "x");
  },
  "public : ni votes en cours, ni QUI a voté pour qui": L => {
    const e = L.enregistrerVote(L.ouvrirVote(jour(L), { candidats: ["x"] }), { votant: "a", cible: "x" }).etat;
    const pub = L.etatPublic(e);
    assert.deepEqual(pub.vote.votes, {});
    assert.deepEqual(pub.vote.exprimes, ["a"]);
  },
  "public : la vraie cause d'une mort de nuit est cachée": L => assert.equal(L.etatPublic(L.ajouterMort(jour(L), { acteurId: "x", cause: "poison" })).morts[0].cause, "nuit"),
  "public : la nuit précédente est cachée": L => assert.deepEqual(L.etatPublic(L.cloreNuit(L.ajouterAction(jour(L), { acteurId: "g", roleCle: "g", cibles: ["x"] }), { bilan: { sorties: ["g"] } })).nuitPrecedente, { actions: [], bilan: null }),
  "secrets d'une autre partie ignorés": L => {
    const { public: pub, secret } = L.separerEtat(L.ajouterAction(jour(L), { acteurId: "g", roleCle: "g", cibles: ["x"] }));
    assert.equal(L.fusionnerEtat(pub, secret).nuit.actions.length, 1);
    assert.equal(L.fusionnerEtat({ ...pub, partie: "autre" }, secret).nuit.actions.length, 0);
  },
  "le vote de la Chapelle ne prend pas la cloche": L => {
    const e = L.ouvrirVote({ ...jour(L), voteDoubleDemain: true }, { candidats: [], objet: "chapelle" });
    assert.equal(e.vote.double, false);
    assert.equal(e.voteDoubleDemain, true);
  },
  "un tiers des maisons sur l'autre rive": L => assert.equal(L.maisonsDuVillage(9).filter(L.surLAutreRive).length, 3)
};

const MUTATIONS = [
  ["jour.mjs", "if (def.apresNuit && !(etat.tour >= 1 && etat.nuitResolue === etat.tour)) return non(\"nuit\");", "", "au matin après une nuit"],
  ["jour.mjs", "if (!def.phases.includes(etat.phase)) return non(\"phase\");", "", "moments du jour"],
  ["jour.mjs", "Number(objet.usages?.restant) <= 0) return non(\"usage\");", "Number(objet.usages?.restant) < 0) return non(\"usage\");", "usages"],
  ["jour.mjs", "if (lits.length >= LITS_DE_LA_TAVERNE) return non(\"plein\");", "", "trois lits"],
  ["jour.mjs", "if (etat.jour.effets.some(x => x.type === \"lame\")) return non(\"deja\");", "", "une lame par partie"],
  ["jour.mjs", "if (etat.jour.effets.some(x => x.type === \"cachette\" && x.cible === acteurId)) return non(\"deja\");", "", "Grange une fois par joueur"],
  ["jour.mjs", "if (!n || n > MOTS_DU_PUITS) return { ...non(\"texte\"), candidats };", "", "dix mots"],
  ["jour.mjs", "if (!etat.morts.some(m => m.acteurId === acteurId && m.tour === etat.tour)) return non(\"recent\");", "", "mort récent"],
  ["jour.mjs", " || !r.elus.every(id => vivant(parId.get(id)))", "", "Juge avant l'exécution"],
  ["jour.mjs", "sortie.rouvrirVote = true;", "sortie.rouvrirVote = true; Object.assign(etat, { vote: { ...etat.vote, ouvert: false } });", "Juge : revote"],
  ["jour.mjs", "return vivants.filter(v => !hier.includes(v.id)).map(v => v.id);", "return vivants.map(v => v.id);", "Chapelle pas deux nuits de suite"],
  ["jour.mjs", "const crocs = cause === \"meute\" || cause === \"epie\";", "const crocs = true;", "Tanneur"],
  ["jour.mjs", "const sorti = (etat.nuitPrecedente.bilan?.sorties ?? []).includes(c);", "const sorti = true;", "Chasseresse"],
  ["jour.mjs", "const visite = (etat.nuitPrecedente.bilan?.visites ?? []).includes(c);", "const visite = (etat.nuitPrecedente.bilan?.sorties ?? []).includes(c);", "Ramoneuse : visites, pas sorties"],
  ["jour.mjs", " || de(\"ecluse\").length > 0", "", "Éclusière : la meute ne traverse pas"],
  ["jour.mjs", "if (effetsPour(etat, \"ecluse\", nuit).length) return non(\"deja\");", "", "Éclusière : une écluse par nuit"],
  ["jour.mjs", "const loups = villageois.filter(v => vivant(v) && v.camp === \"meute\").length;", "const loups = villageois.filter(v => v.camp === \"meute\").length;", "Meunière"],
  ["jour.mjs", "case \"apothicaire\": return vivants.filter(v => v.silence).map(v => v.id);", "case \"apothicaire\": return vivants.map(v => v.id);", "Apothicaire"],
  ["jour.mjs", "const ordre = [...vivants.slice(i), ...vivants.slice(0, i)].map(v => v.id);", "const ordre = vivants.map(v => v.id);", "Maîtresse d'école"],
  ["jour.mjs", "if (fx.surveilles.includes(acteurId)) return vivants.some(v => v.id === acteurId) ? [acteurId] : [];", "", "Garde : candidats"],
  ["jour.mjs", "&& !(fx.pontBloque && surLAutreRive(parId.get(id).maison))", "", "Pont : candidats"],
  ["jour.mjs", "} else if (n % 2 === 0) {", "} else {", "Moulin un matin sur deux"],
  ["jour.mjs", "if (enJeu.includes(\"cimetiere\") && !revelerALaMort) {", "if (enJeu.includes(\"cimetiere\")) {", "Cimetière"],
  ["resolution.mjs", "if (verrous.has(cible) && !verrousServis.has(cible) && !sansProtection(cible)) {", "if (verrous.has(cible) && !sansProtection(cible)) {", "verrou : la première attaque"],
  ["resolution.mjs", "    if (asiles.has(cible)) return \"asile\";", "", "asile de la Chapelle"],
  ["resolution.mjs", "const loupATaverne = Boolean(jour.taverneEnJeu) && [...taverne].some(", "const loupATaverne = false && [...taverne].some(", "loup à la Taverne"],
  ["resolution.mjs", "if (proteges.has(x.cible) && !x.traverse && !(x.meute && sansProtection(x.cible))) {", "if (proteges.has(x.cible) && !x.traverse) {", "Taverne sans protection"],
  ["resolution.mjs", "if (taverne.has(cible) && !loupATaverne) return \"taverne\";", "", "Taverne sans loup"],
  ["resolution.mjs", "} else if (hors.has(a.acteurId)) {", "} else if (false) {", "hors d'atteinte n'agit pas"],
  ["resolution.mjs", "const absent = cibles.find(c => hors.has(c) && c !== a.acteurId && vivant(c));", "const absent = null;", "hors d'atteinte : visites"],
  ["resolution.mjs", "    if (hors.has(x.cible)) {", "    if (false) {", "hors d'atteinte : feu"],
  ["resolution.mjs", "} else if (surveilles.has(a.acteurId) && cibles.some(", "} else if (false && cibles.some(", "gardé à l'œil"],
  ["resolution.mjs", "const peutChasser = vivantsMeute.filter(id => !hors.has(id) && !surveilles.has(id));", "const peutChasser = vivantsMeute;", "la meute chasse sans lui"],
  ["resolution.mjs", "    if (benis.has(c)) {", "    if (false) {", "béni"],
  ["resolution.mjs", "if (victimeMeute && lames.has(victimeMeute) && !bloquees.has(victimeMeute)) {", "if (victimeMeute && lames.has(victimeMeute)) {", "lame à travers l'asile"],
  ["resolution.mjs", "sortie.messages.push(msg(destinataire, \"MessageRecu\"", "sortie.messages.push(msg(expediteur, \"MessageRecu\"", "Messager : destinataire"],
  ["resolution.mjs", ".replace(/<[^>]*>/g, \"\")", "", "Messager : sans balises"],
  ["resolution.mjs", "const loin = chasse && jour.pontBloque && cibles.find(", "const loin = false && cibles.find(", "Pont : la meute ne traverse pas"],
  ["resolution.mjs", "    && surLAutreRive(parId.get(victimeMeute)?.maison));", ");", "Pont franchi"],
  ["resolution.mjs", "for (const id of peutChasser) sorties.add(id);", "", "bilan : sorties de la meute"],
  ["etat.mjs", "const porteur = max > 0 ? etat.jour.rubans.find(id => r.decompte[id] === max) : null;", "const porteur = null;", "ruban"],
  ["etat.mjs", "etat.jour.rubans = etat.jour.rubans.filter(id => id !== porteur);", "", "ruban dénoué"],
  ["etat.mjs", "pub.vote.votes = {};", "", "votes cachés"],
  ["etat.mjs", "pub.vote.exprimes = etat.vote.ouvert ? Object.keys(etat.vote.votes) : [];", "pub.vote.exprimes = etat.vote.ouvert ? Object.values(etat.vote.votes) : [];", "qui a voté, pas pour qui"],
  ["etat.mjs", "const visible = causePublique(m.cause);", "const visible = m.cause;", "causes cachées"],
  ["etat.mjs", "pub.nuitPrecedente = base.nuitPrecedente;", "", "nuit précédente cachée"],
  ["etat.mjs", "(secret.partie ?? \"\") !== etat.partie", "false", "secrets d'une autre partie"],
  ["etat.mjs", "double: execution ? (double ?? Boolean(etat.voteDoubleDemain)) : false,", "double: double ?? Boolean(etat.voteDoubleDemain),", "Chapelle sans cloche"],
  ["distribution.mjs", "const autreRive = total >= 4 ? Math.min(6, Math.round(total / 3)) : 0;", "const autreRive = 0;", "autre rive"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-jour-mutant-"));
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

test("mutations des pouvoirs de jour : la logique d'origine passe toute la batterie", async () => {
  const L = await import("../systems/lakour-loups/logique/index.mjs");
  assert.deepEqual(echecs(L), []);
});

for (const [fichier, avant, apres, regle] of MUTATIONS) {
  test(`mutation « ${regle} » (${fichier}) : détectée`, async () => {
    const L = await chargerMutant(fichier, avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}
