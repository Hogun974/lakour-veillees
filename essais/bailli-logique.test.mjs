// Essais par mutation de la logique du lot « Bailli, Registre du greffier, Masques de veillée » (logique pure) : la voix double
// du Bailli au seul vote d'exécution, son départage des égalités (places libres, Gibet), l'élection (une par jour, avant le vote
// d'exécution, le sort à l'égalité), la succession à sa mort ; le Registre (votes clos voix par voix, morts avec leur cause
// PUBLIQUE, vote annulé marqué, rien d'un vote ouvert, déclarations des vivants le jour) ; les Masques (rôles du Village absents,
// deux ou trois, secrets) ; les étapes du MJ humain. Chaque règle est cassée à son tour dans une copie de la logique, et la
// batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

const v = (id, extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: "village", maison: "Maison 1", silence: false,
  role: { cle: "villageois", usages: { max: 0, restant: 0 } }, metier: null, ...extra });
const village = () => ["a", "b", "c", "d", "x", "y", "z"].map(id => v(id));
// Un jour de vote, Bailli en charge (b) s'il est actif.
const jour = (L, { bailli = "b", actif = true, ...extra } = {}) => {
  const e = { ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1, ...extra };
  e.bailli = { ...L.bailliInitial(actif), acteurId: bailli, depuis: 1 };
  return e;
};
// Ouvre un vote, enregistre les voix, le clôt (votants : les vivants).
function voter(L, etat, votes, { objet = "execution", double, majoriteAbsolue, votants = ["a", "b", "c", "d", "x", "y", "z"], candidats = votants } = {}) {
  let e = L.ouvrirVote(etat, { candidats, objet, double, majoriteAbsolue });
  for (const [votant, cible] of Object.entries(votes)) e = L.enregistrerVote(e, { votant, cible, votants }).etat;
  return L.cloreVote(e, { votants });
}
const derniere = (etat, type) => [...etat.registre].reverse().find(x => x.type === type);

const VERIFICATIONS = {
  "voix double du Bailli au vote d'exécution": L => {
    const { resultat } = voter(L, jour(L), { b: "x", a: "y" });
    assert.deepEqual(resultat.elus, ["x"]);
    assert.equal(resultat.decompte.x, 2);
    assert.deepEqual(resultat.poids, { b: 2 });
  },
  "pas de voix double à la Chapelle ni à l'élection": L => {
    for (const objet of ["chapelle", "bailli"]) {
      const { resultat } = voter(L, jour(L), { b: "x", a: "y" }, { objet });
      assert.equal(resultat.egalite, true, objet);
      assert.equal(resultat.departage, null, `${objet} : le Bailli ne tranche que le vote d'exécution`);
    }
  },
  "pas de voix double pour un Bailli mort, ni sans Bailli en jeu": L => {
    assert.deepEqual(L.poidsDesVoix(jour(L), ["a", "c"]), {});
    assert.deepEqual(L.poidsDesVoix(jour(L, { actif: false })), {});
    assert.deepEqual(L.poidsDesVoix(jour(L), ["b"]), { b: 2 });
  },
  "égalité : le Bailli tranche parmi les ex aequo": L => {
    const { etat, resultat } = voter(L, jour(L), { a: "x", c: "y" });
    assert.deepEqual(resultat.elus, []);
    assert.deepEqual(resultat.departage, { par: "b", candidats: ["x", "y"], places: 1, enAttente: true, choix: [] });
    assert.deepEqual(L.trancherVote(etat, ["y"]).vote.resultat.elus, ["y"]);
    assert.deepEqual(L.trancherVote(etat, ["z"]).vote.resultat.elus, [], "seulement parmi les ex aequo");
    assert.deepEqual(L.trancherVote(etat, []).vote.resultat.elus, [], "il passe : personne");
    assert.equal(L.trancherVote(etat, ["x"]).vote.resultat.departage.enAttente, false);
  },
  "le départage ne prend que les places libres (vote double)": L => {
    const { etat, resultat } = voter(L, jour(L), { a: "x", c: "x", d: "x", y: "z", z: "y" }, { double: true });
    assert.deepEqual(resultat.elus, ["x"]);
    assert.deepEqual(resultat.departage.candidats, ["y", "z"]);
    assert.equal(resultat.departage.places, 1);
    assert.deepEqual(L.trancherVote(etat, ["y", "z"]).vote.resultat.elus, ["x", "y"], "une seule place");
    const trois = voter(L, jour(L), { a: "x", c: "x", d: "y", x: "y", y: "z", z: "z" }, { double: true }).resultat;
    assert.equal(trois.departage.places, 2, "deux places libres");
  },
  "sans Bailli, pas de départage": L => {
    assert.equal(voter(L, jour(L, { bailli: "" }), { a: "x", c: "y" }).resultat.departage, null);
    assert.equal(voter(L, jour(L), { a: "x", c: "y" }, { votants: ["a", "c", "d", "x", "y"] }).resultat.departage, null, "Bailli mort");
  },
  "Gibet : départage seulement parmi ceux qui ont la majorité": L => {
    assert.equal(voter(L, jour(L, { bailli: "" }), { a: "x", c: "y" }, { majoriteAbsolue: true }).resultat.departage, null);
    assert.equal(voter(L, jour(L), { a: "x", c: "y" }, { majoriteAbsolue: true }).resultat.departage, null);
  },
  "le Registre : un vote clos, voix par voix, avec la voix double": L => {
    const { etat } = voter(L, jour(L), { b: "x", a: "y" });
    const x = derniere(etat, "vote");
    assert.deepEqual(x.votes, { b: "x", a: "y" });
    assert.deepEqual(x.poids, { b: 2 });
    assert.deepEqual(x.elus, ["x"]);
    assert.equal(x.objet, "execution");
  },
  "le Registre attend le départage du Bailli": L => {
    const { etat } = voter(L, jour(L), { a: "x", c: "y" });
    assert.equal(etat.registre.filter(x => x.type === "vote").length, 0);
    const tranche = L.trancherVote(etat, ["y"]);
    const votes = tranche.registre.filter(x => x.type === "vote");
    assert.equal(votes.length, 1);
    assert.deepEqual(votes[0].departage, { par: "b", choix: ["y"] });
  },
  "le Registre ne garde que la cause publique d'une mort": L => {
    const e = L.ajouterMort({ ...jour(L), phase: "aube" }, { acteurId: "x", cause: "poison" });
    assert.equal(derniere(e, "mort").cause, "nuit");
    assert.ok(!JSON.stringify(L.separerEtat(e).public).includes("poison"));
    assert.equal(derniere(L.ajouterMort(jour(L), { acteurId: "y", cause: "vote" }), "mort").cause, "vote");
  },
  "rien au Registre d'un vote ouvert, ni d'un vote prolongé par le ruban": L => {
    let e = L.ouvrirVote(jour(L), { candidats: ["x", "y"] });
    e = L.enregistrerVote(e, { votant: "a", cible: "x" }).etat;
    assert.equal(e.registre.length, 0);
    e.jour.rubans = ["x"];
    const c = L.cloreVote(e, { votants: ["a", "b", "c"] });
    assert.equal(c.prolonge, "x");
    assert.equal(c.etat.registre.length, 0);
  },
  "le vote annulé par le Juge de paix reste au Registre, marqué": L => {
    const vs = [...village(), v("j", { role: { cle: "juge-de-paix", effet: "annuler-vote", usages: { max: 1, restant: 1 } } })];
    const { etat } = voter(L, { ...jour(L), phase: "vote" }, { a: "x", b: "x" });
    const r = L.appliquerPouvoir({ villageois: vs, etat, acteurId: "j", pouvoir: "juge-de-paix", cibles: [], maintenant: 1000 });
    assert.ok(r.ok);
    assert.equal(derniere(r.etat, "vote").annule, true);
  },
  "le Juge attend que le Bailli ait tranché": L => {
    const vs = [...village(), v("j", { role: { cle: "juge-de-paix", effet: "annuler-vote", usages: { max: 1, restant: 1 } } })];
    const { etat } = voter(L, { ...jour(L), phase: "vote" }, { a: "x", c: "x", d: "x", y: "z", z: "y" }, { double: true });
    assert.equal(L.verifierPouvoir({ villageois: vs, etat, acteurId: "j", pouvoir: "juge-de-paix" }).raison, "vote");
  },
  "déclarations : un vivant, le jour, pas réduit au silence, trois par jour, une ligne sans balises": L => {
    const vs = [...village(), v("m", { vivant: false }), v("s", { silence: true })];
    const ok = (etat, id, texte = "Je me dis Liseuse") => L.verifierDeclaration({ villageois: vs, etat, acteurId: id, texte });
    assert.equal(ok(jour(L), "a").ok, true);
    assert.equal(ok(jour(L), "m").raison, "mort");
    assert.equal(ok({ ...jour(L), phase: "nuit" }, "a").raison, "phase");
    assert.equal(ok(jour(L), "s").raison, "silence");
    assert.equal(ok({ ...jour(L), phase: "aube" }, "s").ok, true, "à l'aube, il parle encore");
    assert.equal(ok(jour(L), "a", "  ").raison, "texte");
    assert.equal(ok(jour(L), "inconnu").raison, "absent");
    let e = jour(L);
    for (let i = 0; i < 3; i++) e = L.declarer({ villageois: vs, etat: e, acteurId: "a", texte: `n° ${i}` }).etat;
    assert.equal(ok(e, "a").raison, "trop");
    assert.equal(ok({ ...e, tour: 2 }, "a").ok, true, "le lendemain");
    const propre = L.declarer({ villageois: vs, etat: jour(L), acteurId: "a", texte: `<b>moi</b>\n${"x".repeat(400)}` }).etat.registre.at(-1);
    assert.equal(propre.type, "declaration");
    assert.ok(!propre.texte.includes("<") && !propre.texte.includes("\n"));
    assert.equal(propre.texte.length, L.LONGUEUR_DECLARATION);
  },
  "élection : l'élu, le sort à l'égalité, la vacance sans voix": L => {
    const vs = village();
    const sans = jour(L, { bailli: "" });
    const elu = voter(L, sans, { a: "c", b: "c", d: "x" }, { objet: "bailli" });
    const x = L.elireBailli(elu.etat, elu.resultat, { villageois: vs });
    assert.equal(x.elu, "c");
    assert.equal(x.etat.bailli.acteurId, "c");
    assert.equal(x.etat.bailli.election, 1);
    assert.equal(derniere(x.etat, "bailli").comment, "election");
    const egal = voter(L, sans, { a: "c", b: "d" }, { objet: "bailli" });
    const s = L.elireBailli(egal.etat, egal.resultat, { villageois: vs, hasard: () => 0.99 });
    assert.equal(s.elu, "d");
    assert.equal(s.sort, true);
    const rien = voter(L, sans, {}, { objet: "bailli" });
    const r = L.elireBailli(rien.etat, rien.resultat, { villageois: vs });
    assert.equal(r.elu, "");
    assert.equal(r.etat.bailli.acteurId, "");
    assert.equal(derniere(r.etat, "bailli").comment, "vacance");
  },
  "une élection par jour, avant le vote d'exécution": L => {
    const vs = village();
    const sans = jour(L, { bailli: "" });
    assert.equal(L.electionAttendue({ etat: sans, villageois: vs }).ok, true);
    assert.equal(L.electionAttendue({ etat: { ...sans, bailli: { ...sans.bailli, election: 1 } }, villageois: vs }).raison, "deja");
    assert.equal(L.electionAttendue({ etat: voter(L, sans, { a: "x" }).etat, villageois: vs }).raison, "execution");
    assert.equal(L.electionAttendue({ etat: jour(L, { bailli: "", actif: false }), villageois: vs }).raison, "inactif");
  },
  "pas d'élection avec un Bailli vivant, ni pendant sa succession": L => {
    const vs = village();
    assert.equal(L.electionPossible({ etat: jour(L), villageois: vs }).raison, "bailli");
    assert.equal(L.electionPossible({ etat: jour(L), villageois: vs.filter(x => x.id !== "b") }).ok, true, "un Bailli mort ne compte plus");
    const e = L.ajouterMort(jour(L), { acteurId: "b", cause: "vote" });
    assert.equal(L.electionPossible({ etat: e, villageois: vs.filter(x => x.id !== "b") }).raison, "succession");
  },
  "la mort du Bailli ouvre la succession": L => {
    const e = L.ajouterMort(jour(L), { acteurId: "b", cause: "vote", quand: 5000 });
    assert.equal(e.bailli.acteurId, "");
    assert.deepEqual(e.bailli.succession, { de: "b", tour: 1, quand: 5000 }, "l'heure de sa mort, pour le délai");
    assert.equal(L.ajouterMort(jour(L), { acteurId: "a", cause: "vote" }).bailli.succession, null, "un autre mort : rien");
  },
  "succession : un vivant choisi par le défunt, sinon vacance": L => {
    const vivants = village().filter(x => x.id !== "b" && x.id !== "z").concat(v("z", { vivant: false }), v("b", { vivant: false }));
    const e = L.ajouterMort(jour(L), { acteurId: "b", cause: "vote" });
    const ok = L.nommerSuccesseur(e, { successeur: "c", villageois: vivants });
    assert.equal(ok.etat.bailli.acteurId, "c");
    assert.equal(ok.etat.bailli.succession, null);
    assert.equal(derniere(ok.etat, "bailli").de, "b");
    assert.equal(L.nommerSuccesseur(e, { successeur: "z", villageois: vivants }).etat.bailli.acteurId, "", "pas un mort");
    const vacant = L.nommerSuccesseur(e, { successeur: "", villageois: vivants });
    assert.equal(vacant.comment, "vacance");
    assert.equal(vacant.etat.bailli.succession, null);
  },
  "masques : seulement des rôles du Village absents, ni le simple villageois": L => {
    const roles = [{ cle: "liseuse", camp: "village" }, { cle: "sourcier", camp: "village" }, { cle: "garde", camp: "village" },
      { cle: "villageois", camp: "village" }, { cle: "pyromane", camp: "solitaire" }, { cle: "loup", camp: "meute" }, { cle: "herboriste", camp: "village" }];
    for (const graine of ["a", "b", "c", "d", "e"]) {
      const m = L.choisirMasques({ roles, enJeu: ["garde", "loup", "villageois"], loups: 2, graine });
      assert.deepEqual([...m].sort(), ["herboriste", "liseuse", "sourcier"], graine);
    }
    assert.deepEqual(L.choisirMasques({ roles, enJeu: ["garde", "liseuse", "sourcier", "herboriste"], loups: 2, graine: "x" }), []);
  },
  "masques : deux pour un loup seul, trois pour une meute, aucun sans loup": L => {
    const roles = ["r1", "r2", "r3", "r4", "r5"].map(cle => ({ cle, camp: "village" }));
    assert.equal(L.choisirMasques({ roles, loups: 1, graine: "x" }).length, 2);
    assert.equal(L.choisirMasques({ roles, loups: 3, graine: "x" }).length, 3);
    assert.equal(L.choisirMasques({ roles, loups: 0, graine: "x" }).length, 0);
    assert.deepEqual(L.choisirMasques({ roles, loups: 2, graine: "x" }), L.choisirMasques({ roles, loups: 2, graine: "x" }), "reproductible");
  },
  "masques : un secret de la meute, jamais dans l'état public": L => {
    const e = { ...jour(L), masques: ["liseuse", "sourcier"] };
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.masques, []);
    assert.ok(!JSON.stringify(pub).includes("liseuse"));
    assert.deepEqual(secret.masques, ["liseuse", "sourcier"]);
    assert.deepEqual(L.fusionnerEtat(pub, secret).masques, ["liseuse", "sourcier"], "rendus au MJ");
  },
  "étapes du MJ humain : élire le Bailli, puis le vote d'exécution ; attendre le départage": L => {
    const vs = [...village(), v("l", { camp: "meute", role: { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", usages: { max: 0, restant: 0 } } })];
    const sans = jour(L, { bailli: "" });
    const etape = e => L.etapeSuivante(e, null, { villageois: vs });
    assert.equal(etape(sans).cle, "bailli");
    assert.equal(etape(sans).action, "voteBailli");
    assert.equal(etape(jour(L)).cle, "ouvrirVote");
    const elu = voter(L, sans, { a: "c" }, { objet: "bailli" });
    const apres = L.elireBailli(elu.etat, elu.resultat, { villageois: vs }).etat;
    assert.equal(etape(apres).cle, "ouvrirVote");
    const egal = voter(L, jour(L), { a: "x", c: "y" }).etat;
    assert.equal(etape(egal).cle, "departage");
    assert.equal(etape(egal).attente, true);
    // Une élection tenue pendant la phase du vote : le vote d'exécution suit.
    const enVote = voter(L, { ...sans, phase: "vote" }, { a: "c" }, { objet: "bailli" });
    assert.equal(etape(L.elireBailli(enVote.etat, enVote.resultat, { villageois: vs }).etat).cle, "ouvrirVote");
    // Au débat : l'élection ouverte se clôt ; la succession d'un Bailli défunt s'attend.
    assert.equal(etape(L.ouvrirVote(sans, { candidats: ["c"], objet: "bailli" })).cle, "cloreVote");
    const deuil = etape(L.ajouterMort(jour(L), { acteurId: "b", cause: "vote" }));
    assert.deepEqual([deuil.cle, deuil.attente], ["succession", true]);
  },
  "l'élection se tient au débat, sans changer de phase": L => {
    assert.equal(L.ouvrirVote(jour(L), { candidats: ["x"], objet: "bailli" }).phase, "jour");
    assert.equal(L.ouvrirVote(jour(L), { candidats: ["x"] }).phase, "vote");
    assert.equal(L.ouvrirVote(jour(L), { candidats: ["x"], objet: "chapelle" }).phase, "vote");
  },
  "le sort : l'élu au résultat public et au Registre": L => {
    const egal = voter(L, jour(L, { bailli: "" }), { a: "c", b: "d" }, { objet: "bailli" });
    const s = L.elireBailli(egal.etat, egal.resultat, { villageois: village(), hasard: () => 0 });
    assert.deepEqual([s.etat.vote.resultat.elus, s.etat.vote.resultat.elu, s.etat.vote.resultat.sort], [["c"], "c", true]);
    assert.deepEqual(derniere(s.etat, "vote").elus, ["c"]);
  },
  "départage : un ex aequo vivant seulement ; la nuit tombée, aucun condamné": L => {
    const { etat } = voter(L, jour(L), { a: "x", c: "y" });
    assert.deepEqual(L.trancherVote(etat, ["y"], { vivants: ["x", "b"] }).vote.resultat.elus, [], "un mort n'est pas condamné");
    assert.deepEqual(L.trancherVote(etat, ["x"], { vivants: ["x", "b"] }).vote.resultat.elus, ["x"]);
    const nuit = L.trancherVote({ ...etat, phase: "nuit" }, ["x"]);
    assert.deepEqual(nuit.vote.resultat.elus, []);
    assert.deepEqual(derniere(nuit, "vote").elus, [], "au Registre, sans condamné");
    assert.equal(L.departageEnAttente(etat), true);
    assert.equal(L.departageEnAttente(L.trancherVote(etat, [])), false);
    assert.equal(L.departageEnAttente({ ...etat, vote: { ...etat.vote, ouvert: true } }), false, "un vote ouvert n'attend rien");
  },
  "succession : le reste du délai, compté depuis la mort": L => {
    const e = { bailli: { succession: { de: "b", tour: 1, quand: 1000 } } };
    assert.equal(L.resteDeSuccession(e, 90000, 31000), 60000);
    assert.equal(L.resteDeSuccession(e, 90000, 200000), 0, "trop tard : vacance");
    assert.equal(L.resteDeSuccession({ bailli: { succession: { de: "b", tour: 1 } } }, 90000, 200000), 0, "sans heure : vacance");
    assert.equal(L.resteDeSuccession({ bailli: { succession: null } }, 90000), 0);
  },
  "le vote du Bailli : ni cloche ni Gibet": L => {
    const e = L.ouvrirVote({ ...jour(L), voteDoubleDemain: true }, { candidats: ["x"], objet: "bailli", double: true, majoriteAbsolue: true });
    assert.equal(e.vote.objet, "bailli");
    assert.equal(e.vote.double, false);
    assert.equal(e.vote.majoriteAbsolue, false);
    assert.equal(e.voteDoubleDemain, true, "la cloche attend le vote d'exécution");
  }
};

const MUTATIONS = [
  ["bailli.mjs", "export const POIDS_DU_BAILLI = 2;", "export const POIDS_DU_BAILLI = 1;", "voix double"],
  ["bailli.mjs", "  if ((etat?.vote?.objet ?? \"execution\") !== \"execution\") return {};\n", "", "voix double : l'exécution seulement"],
  ["bailli.mjs", "return !vivants || vivants.includes(b.acteurId) ? b.acteurId : \"\";", "return b.acteurId;", "Bailli mort"],
  ["bailli.mjs", "if (!b.actif || !b.acteurId) return \"\";", "if (!b.acteurId) return \"\";", "Bailli hors jeu"],
  ["bailli.mjs", "const permis = id => d.candidats.includes(id) && (!vivants || vivants.includes(id));", "const permis = id => (!vivants || vivants.includes(id));", "départage parmi les ex aequo"],
  ["bailli.mjs", " && (!vivants || vivants.includes(id));", ";", "départage : un vivant"],
  ["bailli.mjs", ".filter(permis).slice(0, d.places);", ".filter(permis);", "départage : places libres"],
  ["bailli.mjs", "etat.phase === \"nuit\" ? [] : ", "", "départage : rien la nuit"],
  ["bailli.mjs", "    Object.assign(r, { elus: [elu], elu, sort });\n", "", "le sort au résultat public"],
  ["bailli.mjs", "    if (x) x.elus = [elu];\n", "", "le sort au Registre"],
  ["bailli.mjs", "return Math.max(0, delai - Math.max(0, maintenant - (Number(s.quand) || 0)));", "return delai;", "succession : reste du délai"],
  ["bailli.mjs", "Boolean(!etat?.vote?.ouvert && etat?.vote?.resultat?.departage?.enAttente)", "Boolean(etat?.vote?.resultat?.departage?.enAttente)", "départage en attente"],
  ["etat.mjs", "  if (sujet !== \"bailli\") etat.phase = \"vote\";", "  etat.phase = \"vote\";", "élection sans changer de phase"],
  ["etapes.mjs", "      if (etat.vote.ouvert) return cloture(etat.vote, vivants);\n", "", "étape : clore l'élection du débat"],
  ["etapes.mjs", "      if (s) return etape(\"succession\", \"\", { nom: nom(s.de) }, { attente: true });\n", "", "étape : attendre la succession"],
  ["bailli.mjs", "  inscrire(etat, entreeDeVote(r));\n", "", "Registre après le départage"],
  ["bailli.mjs", "if (!elu && resultat?.egalite) {", "if (false) {", "élection : le sort"],
  ["bailli.mjs", "  else inscrire(etat, { type: \"bailli\", acteurId: \"\", comment: \"vacance\" });\n", "", "élection : vacance au Registre"],
  ["bailli.mjs", "  etat.bailli.election = etat.tour;\n", "", "une élection par jour (noté)"],
  ["bailli.mjs", "if (etat.bailli.election === etat.tour) return { ok: false, raison: \"deja\" };", "", "une élection par jour"],
  ["bailli.mjs", "if (voteExecutionDuJour(etat)) return { ok: false, raison: \"execution\" };", "", "avant le vote d'exécution"],
  ["bailli.mjs", "if (bailliEnCharge(etat, idsVivants(villageois))) return non(\"bailli\");", "", "pas d'élection avec un Bailli"],
  ["bailli.mjs", "if (etat.bailli.succession) return non(\"succession\");", "", "pas d'élection pendant la succession"],
  ["bailli.mjs", "if (!etat.bailli.actif) return non(\"inactif\");", "", "pas d'élection sans Bailli en jeu"],
  ["bailli.mjs", "  etat.bailli.acteurId = \"\";\n  etat.bailli.succession = { de: deId, tour: etat.tour, quand };",
    "  etat.bailli.succession = { de: deId, tour: etat.tour, quand };", "le défunt rend le sceau"],
  ["bailli.mjs", "  etat.bailli.succession = { de: deId, tour: etat.tour, quand };", "  etat.bailli.succession = { de: deId, tour: etat.tour };", "l'heure de sa mort"],
  ["bailli.mjs", "if (successeur && candidatsSuccession(etat, villageois).includes(successeur)) {", "if (successeur) {", "successeur vivant"],
  ["bailli.mjs", "  etat.bailli.succession = null;\n  inscrire(etat, { type: \"bailli\", acteurId: \"\", comment: \"vacance\", de: s.de });",
    "  inscrire(etat, { type: \"bailli\", acteurId: \"\", comment: \"vacance\", de: s.de });", "succession close à la vacance"],
  ["etat.mjs", "    ouvrirSuccession(etat, acteurId, quand);\n", "", "la mort du Bailli"],
  ["etat.mjs", "  if (!resultat.departage) inscrire(etat, entreeDeVote(resultat), maintenant);", "  inscrire(etat, entreeDeVote(resultat), maintenant);", "Registre : attendre le départage"],
  ["etat.mjs", "  if (!resultat.departage) inscrire(etat, entreeDeVote(resultat), maintenant);\n", "", "Registre : votes clos"],
  ["etat.mjs", "\"journalSecret\", \"masques\", \"somnambules\"", "\"journalSecret\", \"somnambules\"", "masques secrets"],
  ["etat.mjs", "for (const cle of [\"asperges\", \"journalSecret\", \"masques\"])", "for (const cle of [\"asperges\", \"journalSecret\"])", "masques rendus au MJ"],
  ["etat.mjs", "departage: bailli && r.departage ?", "departage: r.departage ?", "départage sans Bailli"],
  ["etat.mjs", "const bailli = v.objet === \"execution\" ? bailliEnCharge(etat, votants) : \"\";", "const bailli = bailliEnCharge(etat, votants);", "départage : l'exécution seulement"],
  ["votes.mjs", "!majoriteAbsolue || decompte[id] * 2 > totalDesVoix(admisVotants, valides, poids)", "true", "départage sous le Gibet"],
  ["votes.mjs", "const reste = places - elus.length;", "const reste = 1;", "départage : places restantes"],
  ["registre.mjs", "  if (e.type === \"mort\") e.cause = causePublique(e.cause);\n", "", "cause publique au Registre"],
  ["registre.mjs", "if (deja >= DECLARATIONS_PAR_JOUR) return non(\"trop\");", "", "trois déclarations par jour"],
  ["registre.mjs", "if (v.silence && PHASES_DU_SILENCE.includes(etat.phase)) return non(\"silence\");", "", "réduit au silence"],
  ["registre.mjs", "if (v.vivant === false) return non(\"mort\");", "", "les morts n'écrivent plus"],
  ["registre.mjs", "if (!PHASES_DECLARATION.includes(etat?.phase)) return non(\"phase\");", "", "le jour seulement"],
  ["registre.mjs", "if (!propre) return non(\"texte\");", "", "déclaration vide"],
  ["registre.mjs", ".replace(/<[^>]*>/g, \"\")", "", "déclaration sans balises"],
  ["registre.mjs", ".trim().slice(0, LONGUEUR_DECLARATION)", ".trim()", "déclaration courte"],
  ["registre.mjs", "for (const x of etat.registre ?? []) if (x.type === \"vote\" && x.numero === numero) x.annule = true;", "", "vote annulé marqué"],
  ["jour.mjs", "      marquerAnnule(etat, ancien.numero);", "", "le Juge marque le vote annulé"],
  ["jour.mjs", " || r.departage?.enAttente", "", "le Juge attend le départage"],
  ["masques.mjs", "r.camp === \"village\"", "true", "masques du Village"],
  ["masques.mjs", "!enJeu.includes(r.cle)", "true", "masques absents de la partie"],
  ["masques.mjs", "r.cle !== \"villageois\"", "true", "pas le simple villageois"],
  ["masques.mjs", "(loups >= 2 ? MASQUES_MAX : MASQUES_MIN)", "MASQUES_MAX", "deux masques pour un loup seul"],
  ["masques.mjs", "  if (!(loups > 0)) return [];\n", "", "pas de masques sans loup"],
  ["etapes.mjs", "electionAttendue({ etat, villageois }).ok ? etape(\"bailli\", \"voteBailli\") : etape(\"ouvrirVote\", \"ouvrirVote\");",
    "etape(\"ouvrirVote\", \"ouvrirVote\");", "étape : élire le Bailli"],
  ["etapes.mjs", "if (r?.objet === \"bailli\" && r.tour === etat.tour && !voteExecutionDuJour(etat)) return etape(\"ouvrirVote\", \"ouvrirVote\");", "", "étape : le vote après l'élection"],
  ["etapes.mjs", "if (r?.departage?.enAttente) return etape(\"departage\", \"\", { nom: nom(r.departage.par) }, { attente: true });", "", "étape : attendre le départage"],
  ["etat.mjs", "  const sujet = OBJETS_DE_VOTE.includes(objet) ? objet : \"execution\";", "  const sujet = objet === \"chapelle\" ? objet : \"execution\";", "objet « bailli »"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-bailli-mutant-"));
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

test("Bailli, Registre, Masques (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("Bailli, Registre, Masques (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
