// Essais par mutation de la logique des VEILLÉES DE FÊTE (logique/fetes.mjs, et ce qu'elles touchent dans resolution.mjs, jour.mjs,
// etat.mjs) : la veillée que propose chaque fête du calendrier, les tirages secrets (présent, masque, promis), le défilé du Carnaval,
// le présent qui fait échouer le premier coup mortel, le masque qui retourne les visions, la neige qui aveugle les traces, le murmure
// des âmes ; et le secret (rien de tout cela dans l'état public). Chaque règle est cassée à son tour dans une copie de la logique,
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
  deguise: { cle: "loup-deguise", nom: "Loup déguisé", camp: "meute", effet: "tuer", apparence: "village", nuit: { actif: true, ordre: 40, cibles: 1 }, usages: { max: 0, restant: 0 } },
  garde: { cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20, cibles: 1 }, usages: { max: 0, restant: 0 } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse de cendres", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 60, cibles: 1 }, usages: { max: 0, restant: 0 } },
  sourcier: { cle: "sourcier", nom: "Sourcier", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 62, cibles: 2 }, usages: { max: 0, restant: 0 } },
  herboriste: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 45, cibles: 1 }, usages: { max: 2, restant: 2 } },
  flaireur: { cle: "loup-flaireur", nom: "Loup flaireur", camp: "meute", effet: "voir-camp", nuit: { actif: true, ordre: 45, cibles: 1 }, usages: { max: 0, restant: 0 } },
  louvetier: { cle: "louvetier", nom: "Louvetier", camp: "village", effet: "voir-camp", apparence: "meute", nuit: { actif: true, ordre: 61, cibles: 1 }, usages: { max: 0, restant: 0 } },
  pelerine: { cle: "pelerine", nom: "Pèlerine", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 1, restant: 1 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
const v = (id, role, extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${id.length}`, silence: false,
  amoureux: "", protections: 0, role: structuredClone(ROLE[role]), metier: null, ...extra });
const village = () => [v("l", "loup"), v("g", "garde"), v("li", "liseuse"), v("so", "sourcier"), v("a", "villageois"), v("b", "villageois")];
const avecFete = (L, cle, extra = {}) => ({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1, fete: L.feteInitiale(cle), ...extra });
const nuit = (L, vs, etat, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: etat.tour + 1, hasard: () => 0, jour: L.effetsDeLaNuit(etat, etat.tour + 1), ...extra });
const meute = c => ({ acteurId: "l", roleCle: "meute", cibles: [c] });
const suite = (...valeurs) => { let i = 0; return () => valeurs[i++ % valeurs.length]; };

const VERIFICATIONS = {
  "fêtes : la veillée que propose chaque fête du calendrier ; clés ; états initiaux": L => {
    assert.deepEqual(L.CLES_DE_FETE, ["nuit-des-ames", "veillee-d-hiver", "carnaval-des-masques", "fete-des-promis"]);
    assert.equal(L.veilleeDuCalendrier("halloween"), "nuit-des-ames");
    assert.equal(L.veilleeDuCalendrier("noel"), "veillee-d-hiver");
    assert.equal(L.veilleeDuCalendrier("carnaval"), "carnaval-des-masques");
    assert.equal(L.veilleeDuCalendrier("saint-valentin"), "fete-des-promis");
    assert.equal(L.veilleeDuCalendrier("paques"), "", "Pâques n'a pas de veillée");
    assert.equal(L.veilleeDuCalendrier(""), "");
    assert.equal(L.cleDeFete("inconnue"), "");
    assert.deepEqual(L.etatInitial().fete, { cle: "", neige: 0, defile: "", defileNom: "" });
    assert.deepEqual(L.normaliserEtat({ fete: { cle: "nuit-des-ames", neige: "3" } }).fete, { cle: "nuit-des-ames", neige: 3, defile: "", defileNom: "" });
    assert.equal(L.estFete(avecFete(L, "veillee-d-hiver"), "veillee-d-hiver"), true);
    assert.equal(L.estFete(avecFete(L, ""), ""), false);
  },
  "fêtes : les secrets hors de l'état public, rendus par la fusion ; la fête et sa neige publiques": L => {
    const e = avecFete(L, "carnaval-des-masques", { fete: { cle: "carnaval-des-masques", neige: 0, defile: "herboriste", defileNom: "Herboriste" },
      secretsDeFete: { masque: "a", masqueTombe: true, present: "b", presentOuvert: true, promis: ["g", "li"] } });
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.secretsDeFete, L.secretsDeFeteInitiaux(), "rien de secret dans l'état public");
    assert.equal(JSON.stringify(pub).includes("\"masque\":\"a\""), false);
    assert.deepEqual(pub.fete, { cle: "carnaval-des-masques", neige: 0, defile: "herboriste", defileNom: "Herboriste" }, "la fête et le défilé sont publics");
    assert.deepEqual(secret.secretsDeFete, { masque: "a", masqueTombe: true, present: "b", presentOuvert: true, promis: ["g", "li"] });
    assert.deepEqual(L.fusionnerEtat(pub, secret).secretsDeFete, secret.secretsDeFete, "le MJ les retrouve");
  },
  "tirages : le présent (hiver), le masque (Carnaval), deux promis du Village (jamais la meute), rien ailleurs": L => {
    const joueurs = [{ id: "l", camp: "meute" }, { id: "a", camp: "village" }, { id: "b", camp: "village" }, { id: "s", camp: "solitaire" }];
    assert.deepEqual(L.tirerSecretsDeFete("veillee-d-hiver", { joueurs, hasard: () => 0 }), { masque: "", masqueTombe: false, present: "l", presentOuvert: false, promis: [] }, "tous camps");
    assert.deepEqual(L.tirerSecretsDeFete("carnaval-des-masques", { joueurs, hasard: () => 0.99 }), { masque: "s", masqueTombe: false, present: "", presentOuvert: false, promis: [] });
    for (const h of [0, 0.3, 0.6, 0.99]) {
      const p = L.tirerSecretsDeFete("fete-des-promis", { joueurs, hasard: () => h }).promis;
      assert.deepEqual([...p].sort(), ["a", "b"], "deux du Village, ni loup ni solitaire");
    }
    assert.deepEqual(L.tirerSecretsDeFete("fete-des-promis", { joueurs: joueurs.slice(0, 2) }).promis, [], "un seul du Village : pas de promis");
    assert.deepEqual(L.tirerSecretsDeFete("nuit-des-ames", { joueurs }), L.secretsDeFeteInitiaux());
    assert.deepEqual(L.tirerSecretsDeFete("", { joueurs }), L.secretsDeFeteInitiaux());
  },
  "défilé : un Masque de veillée de la meute si elle en a deux ou plus (jamais le dernier), sinon un rôle du Village absent ; jamais un rôle en jeu": L => {
    const roles = [{ cle: "herboriste", camp: "village" }, { cle: "sourcier", camp: "village" }, { cle: "villageois", camp: "village" },
      { cle: "somnambule", camp: "village" }, { cle: "rosiere", camp: "village" }, { cle: "remouleur", camp: "village", surDemande: true },
      { cle: "loup-de-brumecombe", camp: "meute" }, { cle: "pyromane", camp: "solitaire" }, { cle: "liseuse-de-cendres", camp: "village" }];
    for (const h of [0, 0.99]) assert.ok(["fossoyeur", "sourcier"].includes(L.choisirDefile({ masques: ["sourcier", "fossoyeur"], roles, enJeu: [], hasard: () => h })), "un de ses deux masques");
    assert.equal(L.choisirDefile({ masques: ["sourcier", "fossoyeur", "messager"], roles, enJeu: [], hasard: () => 0 }), "fossoyeur");
    for (const h of [0, 0.5, 0.99]) {
      assert.equal(L.choisirDefile({ masques: ["sourcier"], roles, enJeu: ["liseuse-de-cendres"], hasard: () => h }), "herboriste",
        "un seul masque : il ne défile pas (la meute garde un alibi)");
      assert.equal(L.choisirDefile({ masques: [], roles, enJeu: ["liseuse-de-cendres", "sourcier"], hasard: () => h }), "herboriste",
        "le seul absent permis (ni villageois, ni Somnambule, ni Rosière, ni sur demande, ni meute, ni solitaire)");
    }
    assert.equal(L.choisirDefile({ masques: [], roles, enJeu: ["herboriste", "sourcier", "liseuse-de-cendres"] }), "", "aucun absent : pas de défilé");
    assert.equal(L.choisirDefile({ masques: ["herboriste"], roles, enJeu: ["sourcier", "liseuse-de-cendres"] }), "", "le dernier masque ne défile pas");
  },
  "présent : le premier coup mortel de la nuit échoue, une fois ; le porteur l'apprend ; ni s'il est déjà sauvé, ni contre le linceul": L => {
    const e = avecFete(L, "veillee-d-hiver", { secretsDeFete: { present: "a" } });
    assert.equal(L.effetsDeLaNuit(e, 2).present, "a");
    const r = nuit(L, village(), e, [meute("a")]);
    assert.deepEqual(r.morts, [], "le coup de la meute a échoué");
    assert.equal(r.presentOuvert, true);
    assert.ok(r.sauves.some(s => s.acteurId === "a" && s.par === "present"));
    assert.ok(r.messages.some(m => m.destinataire === "a" && m.cle.endsWith("PresentOuvert")), "le porteur l'apprend");
    assert.ok(!r.messages.some(m => m.destinataire !== "a" && m.destinataire !== "mj" && m.cle.includes("Present")), "personne d'autre");
    const deux = nuit(L, village(), e, [meute("a"), { acteurId: "x", roleCle: "poison", effet: "poison", cibles: ["a"] }],
      { villageois: [...village(), v("x", "herboriste")] });
    assert.deepEqual(deux.morts, ["a"], "une seule fois par nuit : le second coup tue");
    const protege = nuit(L, village(), e, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["a"] }, meute("a")]);
    assert.equal(protege.presentOuvert, false, "déjà sauvé par la Garde : le présent reste fermé");
    const ouvert = avecFete(L, "veillee-d-hiver", { secretsDeFete: { present: "a", presentOuvert: true } });
    assert.equal(L.effetsDeLaNuit(ouvert, 2).present, "", "déjà ouvert");
    assert.deepEqual(nuit(L, village(), ouvert, [meute("a")]).morts, ["a"]);
    const linceul = nuit(L, village(), e, [meute("a")], { jour: { ...L.effetsDeLaNuit(e, 2), linceul: true } });
    assert.deepEqual(linceul.morts, ["a"], "le linceul du deuil passe le présent");
    assert.equal(L.effetsDeLaNuit(avecFete(L, "nuit-des-ames", { secretsDeFete: { present: "a" } }), 2).present, "", "hors Veillée d'hiver : rien");
  },
  "présent : il arrête aussi le poison et le feu, pas le chagrin": L => {
    const e = avecFete(L, "veillee-d-hiver", { secretsDeFete: { present: "a" } });
    const vs = [...village(), v("x", "herboriste")];
    assert.deepEqual(nuit(L, vs, e, [{ acteurId: "x", roleCle: "poison", effet: "poison", cibles: ["a"] }], { villageois: vs }).morts, []);
    const amants = village().map(x => (x.id === "a" ? { ...x, amoureux: "b" } : x.id === "b" ? { ...x, amoureux: "a" } : x));
    assert.deepEqual(nuit(L, amants, e, [meute("b")], { villageois: amants }).morts, ["b", "a"], "le chagrin de l'amant passe");
  },
  "masque : la première vision du Village le voit du camp opposé, puis il tombe ; jamais un regard de la meute ; seulement au Carnaval": L => {
    const e = avecFete(L, "carnaval-des-masques", { secretsDeFete: { masque: "a" } });
    assert.equal(L.effetsDeLaNuit(e, 2).masque, "a");
    assert.equal(L.masqueDuCarnaval(e), "a");
    assert.equal(L.masqueDuCarnaval(avecFete(L, "veillee-d-hiver", { secretsDeFete: { masque: "a" } })), "", "hors Carnaval : rien");
    assert.equal(L.masqueDuCarnaval(avecFete(L, "carnaval-des-masques", { secretsDeFete: { masque: "a", masqueTombe: true } })), "", "tombé : plus rien");
    const vs = [...village(), v("f", "flaireur"), v("t", "louvetier"), v("d", "deguise")];
    const vision = (etat, cibles, role = "li", cle = "liseuse-de-cendres") => nuit(L, vs, etat, [{ acteurId: role, roleCle: cle, cibles }], { villageois: vs });
    const lu = r => r.messages.find(m => m.destinataire !== "mj")?.donnees.camp;
    const r1 = vision(e, ["a"]);
    assert.equal(lu(r1), "meute", "un homme du Village masqué paraît loup");
    assert.equal(r1.masqueTombe, true, "puis le masque tombe");
    assert.ok(r1.messages.some(m => m.destinataire === "mj" && m.cle.endsWith("MasqueTombe")), "le narrateur le sait");
    const deux = nuit(L, vs, e, [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["a"] }, { acteurId: "so", roleCle: "sourcier", cibles: ["a", "b"] }], { villageois: vs });
    assert.equal(deux.messages.find(m => m.destinataire === "so").cle.endsWith(".MemeCamp"), true, "une seule vision trompée : la suivante voit juste");
    assert.equal(lu(vision(avecFete(L, "carnaval-des-masques"), ["a"])), "village");
    assert.equal(vision(e, ["a", "l"], "so", "sourcier").messages.find(m => m.destinataire === "so").cle.endsWith(".MemeCamp"), true, "le Sourcier le voit du camp du loup");
    assert.equal(lu(vision(avecFete(L, "carnaval-des-masques", { secretsDeFete: { masque: "l" } }), ["l"])), "village", "un loup masqué paraît du Village");
    assert.equal(lu(vision(avecFete(L, "carnaval-des-masques", { secretsDeFete: { masque: "d" } }), ["d"])), "meute", "le Loup déguisé masqué paraît loup");
    assert.equal(lu(vision(avecFete(L, "carnaval-des-masques", { secretsDeFete: { masque: "t" } }), ["t"])), "village", "le Louvetier masqué paraît du Village");
    const flair = vision(e, ["a"], "f", "loup-flaireur");
    assert.equal(lu(flair), "village", "le Loup flaireur (la meute) n'est pas trompé");
    assert.equal(flair.masqueTombe, false, "et le masque reste");
    const mordue = vs.map(x => (x.id === "li" ? { ...x, camp: "meute" } : x));
    assert.equal(nuit(L, mordue, e, [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["a"] }], { villageois: mordue }).messages.find(m => m.destinataire === "li").donnees.camp,
      "village", "une Liseuse mordue lit pour la meute : pas trompée");
    const deuil = nuit(L, vs, e, [{ acteurId: "l", roleCle: "deuil", effet: "deuil", cibles: ["a"] }], { villageois: vs });
    assert.equal(deuil.messages.find(m => m.cle.endsWith("VisionDeuil")).donnees.camp, "village", "la vision du Glas (la meute) n'est pas trompée");
    const vp = [...village(), v("p", "pelerine")];
    const pel = L.appliquerPouvoir({ villageois: vp, etat: e, acteurId: "p", pouvoir: "pelerine", cibles: ["a"] });
    assert.equal(pel.prives[0].donnees.camp, "meute", "la prière de la Pèlerine est trompée");
    assert.equal(pel.etat.secretsDeFete.masqueTombe, true, "et le masque tombe");
    const pelLoup = L.appliquerPouvoir({ villageois: vp.map(x => (x.id === "p" ? { ...x, camp: "meute" } : x)), etat: e, acteurId: "p", pouvoir: "pelerine", cibles: ["a"] });
    assert.equal(pelLoup.prives[0].donnees.camp, "village", "une Pèlerine de la meute n'est pas trompée");
    assert.equal(L.apparenceMasquee(v("a", "villageois"), "a"), "meute");
    assert.equal(L.apparenceMasquee(v("a", "villageois"), "a", { camp: "meute" }), "village", "un regard de la meute");
    assert.equal(L.apparenceMasquee(v("d", "deguise"), "d"), "meute", "le Loup déguisé masqué paraît loup");
  },
  "neige : tirée en hiver seulement ; ce jour-là, Chasseresse, Ramoneuse, Tanneur et Colporteur attendent ; le Lavoir gèle": L => {
    const e = avecFete(L, "veillee-d-hiver");
    assert.equal(L.tirerNeige(e, () => 0.33), true);
    assert.equal(L.tirerNeige(e, () => 0.34), false, "une chance sur trois");
    assert.equal(L.tirerNeige({ ...e, tour: 2, fete: { ...e.fete, neige: 1 } }, () => 0), false, "jamais deux aubes de suite");
    assert.equal(L.tirerNeige({ ...e, tour: 3, fete: { ...e.fete, neige: 1 } }, () => 0), true, "un jour sans neige, puis de nouveau");
    assert.equal(L.tirerNeige(avecFete(L, "nuit-des-ames"), () => 0), false);
    const neige = { ...e, fete: { ...e.fete, neige: 1 } };
    assert.equal(L.neigeDuJour(neige), true);
    assert.equal(L.neigeDuJour({ ...neige, tour: 2 }), false, "le lendemain, plus de neige");
    const vs = [v("l", "loup"), { ...v("c", "villageois"), metier: { cle: "chasseresse", usages: { max: 0, restant: 0 } } },
      { ...v("r", "villageois"), metier: { cle: "ramoneuse", usages: { max: 0, restant: 0 } } }, { ...v("n", "villageois"), metier: { cle: "colporteur-de-nouvelles", usages: { max: 0, restant: 0 } } }];
    for (const [id, pouvoir, cibles] of [["c", "chasseresse", ["l"]], ["r", "ramoneuse", ["l"]], ["n", "colporteur-de-nouvelles", []]]) {
      assert.equal(L.verifierPouvoir({ villageois: vs, etat: neige, acteurId: id, pouvoir, cibles }).raison, "neige", pouvoir);
      assert.equal(L.verifierPouvoir({ villageois: vs, etat: e, acteurId: id, pouvoir, cibles }).ok, true, `${pouvoir} sans neige`);
    }
    assert.equal(L.pouvoirsDe({ villageois: vs, etat: neige, acteurId: "c" })[0].raison, "neige", "la Table le montre");
    const lavoir = L.annoncesDeLAube({ villageois: vs, etat: neige, tour: 1, bilan: { visites: ["l"], sorties: [], victime: "", loup: "", sauves: 0, attaques: 0 }, batiments: ["lavoir"] });
    assert.deepEqual(lavoir.annonces.map(m => m.cle), ["LAKOUR_LOUPS.Jour.LavoirNeige"]);
    assert.ok(L.annoncesDeLAube({ villageois: vs, etat: e, tour: 1, bilan: null, batiments: ["lavoir"] }).annonces[0].cle.endsWith(".Lavoir"));
  },
  "murmure : l'âme du premier mort, un receveur et une paire de vivants distincts, le verdict des visions, les loups vivants": L => {
    const vs = village().map(x => (x.id === "b" ? { ...x, vivant: false } : x));
    const m = L.murmureDesAmes({ villageois: vs, deces: [{ acteurId: "b", cause: "meute" }], hasard: () => 0 });
    assert.equal(m.ame, "b");
    assert.equal(m.receveur, "l");
    assert.ok(![m.a, m.b].includes(m.receveur) && m.a !== m.b && ![m.a, m.b].includes("b"), "trois vivants distincts");
    for (let g = 0; g < 40; g++) {
      const x = L.murmureDesAmes({ villageois: vs.slice(0, 4), deces: [{ acteurId: "b", cause: "meute" }], hasard: L.creerHasard(`ame${g}`) });
      assert.equal(new Set([x.receveur, x.a, x.b]).size, 3, "jamais le receveur dans la paire");
    }
    assert.deepEqual(m.loups, ["l"]);
    const verdict = (a, b) => L.murmureDesAmes({ villageois: [v("r", "villageois"), v(a, a === "l" || a === "d" ? (a === "d" ? "deguise" : "loup") : "villageois"), v(b, "villageois")],
      deces: [{ acteurId: "z", cause: "meute" }], hasard: suite(0, 0.9, 0) }).meme;
    assert.equal(verdict("l", "x"), false, "un loup et un homme du Village");
    assert.equal(verdict("y", "x"), true);
    assert.equal(verdict("d", "x"), true, "le Loup déguisé passe pour un homme du Village");
    assert.equal(L.murmureDesAmes({ villageois: vs, deces: [{ acteurId: "b", cause: "chagrin" }, { acteurId: "c", cause: "meute" }] }).ame, "c", "pas l'âme d'un chagrin s'il y a un autre mort");
    assert.equal(L.murmureDesAmes({ villageois: vs, deces: [] }), null, "nuit calme : rien");
    assert.equal(L.murmureDesAmes({ villageois: vs.slice(0, 2), deces: [{ acteurId: "b", cause: "meute" }] }), null, "moins de trois vivants");
    const msgs = L.messagesDuMurmure(m, id => `Nom-${id}`);
    assert.deepEqual(msgs.map(x => x.destinataire), ["l", "l", "mj"], "au receveur, à chaque loup, au MJ");
    assert.deepEqual(msgs[1].donnees, { nom: "Nom-l" }, "la porte : le nom du receveur, rien d'autre");
    const masqueLoup = L.murmureDesAmes({ villageois: [v("l", "loup"), v("a", "villageois"), v("b", "villageois")], deces: [{ acteurId: "z", cause: "meute" }],
      masque: "a", hasard: suite(0, 0.9, 0) });
    assert.equal(masqueLoup.receveur, "l");
    assert.equal(masqueLoup.meme, true, "un receveur loup n'est pas trompé par le masque");
    const masqueVillage = L.murmureDesAmes({ villageois: [v("r", "villageois"), v("a", "villageois"), v("b", "villageois")], deces: [{ acteurId: "z", cause: "meute" }],
      masque: "a", hasard: suite(0, 0.9, 0) });
    assert.equal(masqueVillage.meme, false, "un receveur du Village l'est");
    assert.match(msgs[0].texte, /L'âme de Nom-b/);
    assert.match(msgs[1].texte, /frappé à la porte de Nom-l/);
    assert.ok(!msgs[1].texte.includes(msgs[0].donnees.a), "la meute n'apprend pas ce qu'elle a murmuré");
    const autre = { ...m, receveur: "a", loups: ["l", "x"] };
    assert.deepEqual(L.messagesDuMurmure(autre).map(x => x.destinataire), ["a", "l", "x", "mj"]);
  }
};

// Chaque règle cassée, une à la fois : [fichier, avant, après, règle].
const MUTATIONS = [
  ["fetes.mjs", "[FETE_DES_PROMIS]: { fete: \"saint-valentin\" }", "[FETE_DES_PROMIS]: { fete: \"paques\" }", "la fête des promis à la Saint-Valentin"],
  ["fetes.mjs", "export const cleDeFete = cle => (CLES_DE_FETE.includes(cle) ? cle : \"\");", "export const cleDeFete = cle => String(cle ?? \"\");", "clés de fête connues"],
  ["fetes.mjs", "  if (cle === VEILLEE_D_HIVER) s.present = choisir(ids, hasard) ?? \"\";\n", "", "le présent tiré"],
  ["fetes.mjs", "  if (cle === CARNAVAL_DES_MASQUES) s.masque = choisir(ids, hasard) ?? \"\";\n", "", "le masque tiré"],
  ["fetes.mjs", "joueurs.filter(j => j.id && j.camp === \"village\")", "joueurs.filter(j => j.id)", "promis du Village"],
  ["fetes.mjs", "if (village.length >= 2) s.promis = village.slice(0, 2);", "s.promis = village.slice(0, 2);", "deux promis ou aucun"],
  ["fetes.mjs", "  if (siens.length >= 2) return choisir(siens, hasard) ?? \"\";", "", "le défilé montre un masque de la meute"],
  ["fetes.mjs", "  if (siens.length >= 2) return", "  if (siens.length >= 1) return", "le défilé : jamais le dernier masque"],
  ["fetes.mjs", " && !siens.includes(r.cle)).map(r => r.cle))].sort();", ").map(r => r.cle))].sort();", "le défilé : pas le masque gardé"],
  ["fetes.mjs", " && !enJeu.includes(r.cle) && !siens", " && !siens", "défilé : un rôle absent"],
  ["fetes.mjs", " && !r.surDemande && !enJeu", " && !enJeu", "défilé : pas un rôle sur demande"],
  ["fetes.mjs", "return masqueTrompe(v, masque, observateur) ? campInverse(a) : a;", "return a;", "le masque retourne le murmure"],
  ["fetes.mjs", " && observateur?.camp !== \"meute\");", ");", "le masque ne trompe pas la meute (murmure)"],
  ["fetes.mjs", "  return s.masqueTombe ? \"\" : s.masque;", "  return s.masque;", "le masque tombé"],
  ["fetes.mjs", "  && !(Number(etat.tour) > 1 && normaliserFete(etat.fete).neige === Number(etat.tour) - 1) && hasard()", "  && hasard()", "la neige : jamais deux aubes de suite"],
  ["fetes.mjs", "    ...m.loups.map(id => msg(id, \"Porte\", `Cette nuit, une âme a frappé à la porte de ${d.nom}.`, { nom: d.nom })),",
    "    ...m.loups.map(id => msg(id, \"Porte\", `Cette nuit, une âme a frappé à la porte de ${d.nom}.`, d)),", "la porte : le nom seul"],
  ["fetes.mjs", "apparenceMasquee(a, masque, receveur) === apparenceMasquee(b, masque, receveur)", "apparenceMasquee(a, masque) === apparenceMasquee(b, masque)", "le receveur loup pas trompé"],
  ["fetes.mjs", "  return s.present && !s.presentOuvert ? s.present : \"\";", "  return s.present;", "le présent ne s'ouvre qu'une fois"],
  ["fetes.mjs", "  if (!estFete(etat, VEILLEE_D_HIVER)) return \"\";\n  const s =", "  const s =", "le présent : en hiver seulement"],
  ["fetes.mjs", "  if (!estFete(etat, CARNAVAL_DES_MASQUES)) return \"\";\n  const s = normaliserSecretsDeFete(etat?.secretsDeFete);\n  return s.masqueTombe", "  const s = normaliserSecretsDeFete(etat?.secretsDeFete);\n  return s.masqueTombe", "le masque : au Carnaval seulement"],
  ["fetes.mjs", "&& normaliserFete(etat.fete).neige === Number(tour);", "&& normaliserFete(etat.fete).neige > 0;", "la neige : ce jour-là seulement"],
  ["fetes.mjs", "export const tirerNeige = (etat, hasard = Math.random) => estFete(etat, VEILLEE_D_HIVER)\n", "export const tirerNeige = (etat, hasard = Math.random) => true\n", "la neige : en hiver seulement"],
  ["fetes.mjs", "export const CHANCE_NEIGE = 1 / 3;", "export const CHANCE_NEIGE = 1 / 2;", "la neige : une chance sur trois"],
  ["fetes.mjs", "\"tanneur\", \"colporteur-de-nouvelles\"]", "\"tanneur\"]", "la neige aveugle le Colporteur"],
  ["fetes.mjs", "  const ame = (deces.find(d => d.cause !== \"chagrin\") ?? deces[0])?.acteurId;", "  const ame = deces[0]?.acteurId;", "l'âme : pas celle d'un chagrin"],
  ["fetes.mjs", "  if (vivants.length < 3) return null;\n", "", "le murmure : trois vivants"],
  ["fetes.mjs", "melanger(vivants.filter(v => v.id !== receveur.id), hasard)", "melanger(vivants, hasard)", "le murmure : pas sur soi"],
  ["fetes.mjs", "const meme = apparenceMasquee(a, masque, receveur) === apparenceMasquee(b, masque, receveur);", "const meme = a.camp === b.camp;", "le murmure : le camp des visions"],
  ["fetes.mjs", "    ...m.loups.map(id => msg(id, \"Porte\"", "    ...[].map(id => msg(id, \"Porte\"", "la meute entend la porte"],
  ["fetes.mjs", "  const loups = vivants.filter(v => v.camp === \"meute\").map(v => v.id);", "  const loups = vivants.map(v => v.id);", "la porte : aux loups seuls"],
  ["resolution.mjs", "    if (jour.present && x.cible === jour.present && !sortie.presentOuvert) {", "    if (false) {", "le présent sauve"],
  ["resolution.mjs", "jour.present && x.cible === jour.present && !sortie.presentOuvert", "jour.present && x.cible === jour.present", "un présent par nuit"],
  ["resolution.mjs", "msg(x.cible, \"PresentOuvert\"", "msg(\"mj\", \"PresentOuvert\"", "le porteur l'apprend"],
  ["resolution.mjs", "    if (!id || id !== jour.masque || sortie.masqueTombe || parId.get(par)?.camp === \"meute\") return a;", "    return a;", "le masque trompe les visions"],
  ["resolution.mjs", " || parId.get(par)?.camp === \"meute\") return a;", ") return a;", "le masque ne trompe pas la meute"],
  ["resolution.mjs", " || sortie.masqueTombe || ", " || ", "le masque ne trompe qu'une vision"],
  ["resolution.mjs", "    sortie.masqueTombe = true;\n", "", "le masque tombé, rendu à l'API"],
  ["resolution.mjs", "    const camp = apparenceDe(parId.get(c));   // un regard de la meute", "    const camp = vu(c, \"\");   // un regard de la meute", "la vision du Glas n'est pas trompée"],
  ["jour.mjs", "  if (aveuglePar(etat, pouvoir)) return non(\"neige\");\n", "", "la neige aveugle les traces"],
  ["jour.mjs", "const camp = trompe ? campInverse(vrai) : vrai;", "const camp = vrai;", "la Pèlerine trompée par le masque"],
  ["jour.mjs", " && parId.get(acteurId)?.camp !== \"meute\";", ";", "une Pèlerine de la meute pas trompée"],
  ["jour.mjs", "      if (trompe) etat.secretsDeFete = { ...etat.secretsDeFete, masqueTombe: true };\n", "", "la prière fait tomber le masque"],
  ["jour.mjs", "    present: presentDeLaNuit(etat),", "    present: \"\",", "le présent veille la nuit"],
  ["jour.mjs", "    masque: masqueDuCarnaval(etat)\n", "    masque: \"\"\n", "le masque, la nuit"],
  ["jour.mjs", "  if (enJeu.includes(\"lavoir\") && neigeDuJour(etat, n)) {", "  if (false) {", "le Lavoir gelé"],
  ["etat.mjs", "\"secretsIncomplets\", \"secretsDeFete\"]) pub[cle]", "\"secretsIncomplets\"]) pub[cle]", "les secrets de fête hors de l'état public"],
  ["etat.mjs", "  if (s.secretsDeFete) etat.secretsDeFete = normaliserSecretsDeFete(s.secretsDeFete);\n", "", "les secrets de fête rendus au MJ"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fetes-mutant-"));
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

test("veillées de fête (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("veillées de fête (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("les veillées du système sont celles que décline le contenu (même clé, même fête du calendrier)", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  const { FETES_VEILLEES } = await import("../modules/lakour-veillees/scripts/fetes.js");
  assert.deepEqual(FETES_VEILLEES.map(f => [f.id, f.fete]), L.CLES_DE_FETE.map(c => [c, L.VEILLEES_DE_FETE[c].fete]));
  const { IDS_FETES } = await import("../modules/lakour-mj-ia/scripts/fetes-logique.js");
  for (const c of L.CLES_DE_FETE) assert.ok(IDS_FETES.includes(L.VEILLEES_DE_FETE[c].fete), `${c} : une fête du calendrier du moteur`);
});
