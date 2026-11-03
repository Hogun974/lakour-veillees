// Essais par mutation de la logique du lot 2 (logique pure) : le Dernier souffle des morts (une voix, une fois, au vote
// d'exécution), l'Almanach des brumes (tirage sans redite, chaque présage réellement appliqué), le Somnambule (rêve d'un rôle
// absent, visions fausses mais plausibles, vrai rôle secret), la Rosière (exécutée : le Village perd), les Saints du calendrier
// (Glas final, Bonne étoile secrète). Chaque règle est cassée à son tour dans une copie de la logique, et la batterie doit
// alors échouer.  Lancer : npm run essais
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
  sourcier: { cle: "sourcier", nom: "Sourcier", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 62, cibles: 2 }, usages: { max: 0, restant: 0 } },
  fossoyeur: { cle: "fossoyeur", nom: "Fossoyeur", camp: "village", effet: "voir-role-mort", nuit: { actif: true, ordre: 90, cibles: 1 }, usages: { max: 0, restant: 0 } },
  rosiere: { cle: "rosiere", nom: "Rosière", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } },
  pyromane: { cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", victoireCle: "dernier-survivant", nuit: { actif: true, ordre: 55, cibles: 1 }, usages: { max: 0, restant: 0 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false, cibles: 0 }, usages: { max: 0, restant: 0 } }
};
const v = (id, role, extra = {}) => ({ id, nom: `Nom-${id}`, vivant: true, revele: false, camp: ROLE[role].camp, maison: `Maison ${id.length}`, silence: false,
  amoureux: "", protections: 0, role: structuredClone(ROLE[role]), metier: null, ...extra });
const village = () => [v("l", "loup"), v("g", "garde"), v("li", "liseuse"), v("so", "sourcier"), v("fo", "fossoyeur"), v("a", "villageois"), v("b", "villageois")];
const mort = (vs, id) => vs.map(x => (x.id === id ? { ...x, vivant: false } : x));
const jour = (L, extra = {}) => ({ ...L.etatInitial(), partie: "p", phase: "jour", tour: 1, nuitResolue: 1, ...extra });
const avecSouffle = L => ({ ...jour(L), souffle: L.souffleInitial(true) });
const avecPresage = (L, cle, tour = 1, extra = {}) => ({ ...jour(L, extra), presage: { actif: true, cle, tour } });
const nuit = (L, vs, etat, actions, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour: etat.tour + 1, hasard: () => 0, jour: L.effetsDeLaNuit(etat, etat.tour + 1), ...extra });
const meute = c => ({ acteurId: "l", roleCle: "meute", cibles: [c] });
const texteA = (r, id) => r.messages.filter(m => m.destinataire === id).map(m => m.texte).join(" | ");

const VERIFICATIONS = {
  // ------------------------------------------------------------ le Dernier souffle
  "souffle : un mort vote, au vote d'exécution seulement": L => {
    const vs = mort(village(), "a");
    assert.ok(L.votantsAdmis({ etat: L.ouvrirVote(avecSouffle(L), { candidats: ["l"] }), villageois: vs }).includes("a"));
    for (const objet of ["chapelle", "bailli"]) assert.ok(!L.votantsAdmis({ etat: L.ouvrirVote(avecSouffle(L), { candidats: ["l"], objet }), villageois: vs }).includes("a"), objet);
    assert.ok(!L.votantsAdmis({ etat: L.ouvrirVote(jour(L), { candidats: ["l"] }), villageois: vs }).includes("a"), "sans le réglage");
  },
  "souffle : rendu au dépouillement, une seule fois ; pas sans avoir voté": L => {
    const vs = mort(village(), "a");
    let e = L.ouvrirVote(avecSouffle(L), { candidats: ["l", "b"] });
    e = L.enregistrerVote(e, { votant: "a", cible: "l", votants: L.votantsAdmis({ etat: e, villageois: vs }) }).etat;
    const c = L.cloreVote(e, { votants: ["l", "g", "li", "so", "fo", "b", "a"], souffles: ["a"] });
    assert.deepEqual(c.resultat.souffles, ["a"]);
    assert.deepEqual(c.etat.souffle.utilises, ["a"]);
    assert.deepEqual(c.etat.registre.at(-1).souffles, ["a"]);
    assert.ok(!L.votantsAdmis({ etat: L.ouvrirVote(c.etat, { candidats: ["l"] }), villageois: vs }).includes("a"), "plus de souffle");
    const sans = L.cloreVote(L.ouvrirVote(avecSouffle(L), { candidats: ["l"] }), { souffles: ["a"] });
    assert.deepEqual(sans.etat.souffle.utilises, [], "il n'a pas voté : il le garde");
    assert.equal(L.peutSouffler(L.ouvrirVote(avecSouffle(L), { candidats: ["l"] }), { id: "a", vivant: false }), true);
    assert.equal(L.peutSouffler(L.ouvrirVote(avecSouffle(L), { candidats: ["l"] }), { id: "b", vivant: true }), false, "un vivant ne souffle pas");
    assert.equal(L.peutSouffler(avecSouffle(L), { id: "a", vivant: false }), false, "pas de vote ouvert");
  },
  // ------------------------------------------------------------ l'Almanach des brumes
  "almanach : jamais deux fois de suite le même ; rien sans la variante": L => {
    for (const cle of L.CLES_PRESAGES) for (const h of [0, 0.3, 0.6, 0.99]) assert.notEqual(L.tirerPresage(avecPresage(L, cle), () => h), cle);
    assert.equal(L.CLES_PRESAGES.length >= 8 && L.CLES_PRESAGES.length <= 12, true);
    const rien = L.appliquerPresage(jour(L), { cle: "glas" });
    assert.equal(rien.cle, "");
    assert.equal(rien.etat.voteDoubleDemain, false);
  },
  "almanach : le présage vaut ce jour-là, la nuit suivante pour givre et crue": L => {
    const e = avecPresage(L, "givre", 2, { tour: 2 });
    assert.equal(L.presageDuJour(e), "givre");
    assert.equal(L.presageDuJour({ ...e, tour: 3 }), "");
    assert.equal(L.presageDeLaNuit(e, 3), "givre");
    assert.equal(L.presageDeLaNuit(e, 2), "");
    assert.equal(L.presageDeLaNuit(avecPresage(L, "foire", 2, { tour: 2 }), 3), "", "un présage de jour ne touche pas la nuit");
  },
  "almanach : givre — aucune protection ni verrou la nuit suivante": L => {
    const e = avecPresage(L, "givre");
    assert.deepEqual(nuit(L, village(), e, [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["a"] }, meute("a")]).morts, ["a"]);
    const verrou = { ...e, jour: { ...e.jour, effets: [{ type: "verrou", acteurId: "x", cible: "a", nuit: 2 }] } };
    assert.deepEqual(nuit(L, village(), verrou, [meute("a")]).morts, ["a"]);
    assert.deepEqual(nuit(L, village(), jour(L), [{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["a"] }, meute("a")]).morts, [], "sans givre, la garde tient");
  },
  "almanach : crue — le Pont coupé la nuit suivante": L => {
    const vs = [...village(), v("rive", "villageois", { maison: "Maison 14" })];
    assert.deepEqual(nuit(L, vs, avecPresage(L, "crue"), [meute("rive")]).morts, []);
    assert.deepEqual(nuit(L, vs, jour(L), [meute("rive")]).morts, ["rive"]);
  },
  "almanach : foire — à main levée, les voix publiques pendant le vote seulement": L => {
    let e = L.ouvrirVote(avecPresage(L, "foire"), { candidats: ["l"] });
    assert.equal(e.vote.mainLevee, true);
    e = L.enregistrerVote(e, { votant: "a", cible: "l" }).etat;
    assert.deepEqual(L.separerEtat(e).public.vote.votes, { a: "l" });
    assert.deepEqual(L.separerEtat(L.enregistrerVote(L.ouvrirVote(jour(L), { candidats: ["l"] }), { votant: "a", cible: "l" }).etat).public.vote.votes, {}, "un jour ordinaire : secrètes");
  },
  "almanach : brouillard — pas de déclaration au Registre": L => {
    assert.equal(L.verifierDeclaration({ villageois: village(), etat: avecPresage(L, "brouillard"), acteurId: "a", texte: "moi" }).raison, "brouillard");
    assert.equal(L.verifierDeclaration({ villageois: village(), etat: jour(L), acteurId: "a", texte: "moi" }).ok, true);
  },
  "almanach : glas — deux condamnés ; lune rousse — majorité absolue ; sceau fêlé — pas de voix double": L => {
    const g = L.appliquerPresage({ ...jour(L), presage: L.presageInitial(true) }, { cle: "glas" });
    assert.equal(L.ouvrirVote(g.etat, { candidats: ["l"] }).vote.double, true);
    assert.equal(L.ouvrirVote({ ...g.etat, tour: 2 }, { candidats: ["l"] }).vote.double, false, "pas reporté au lendemain");
    assert.equal(L.ouvrirVote(g.etat, { candidats: ["l"], objet: "chapelle" }).vote.double, false, "pas à la Chapelle");
    assert.equal(L.ouvrirVote(avecPresage(L, "lune-rousse"), { candidats: ["l"] }).vote.majoriteAbsolue, true);
    const b = { ...avecPresage(L, "sceau-brise"), bailli: { ...L.bailliInitial(true), acteurId: "a" } };
    assert.deepEqual(L.poidsDesVoix(b), {});
    assert.deepEqual(L.poidsDesVoix({ ...b, presage: L.presageInitial(true) }), { a: 2 });
  },
  "almanach : vent du nord — les silences levés ; rumeur — une nouvelle criée": L => {
    const vs = village().map(x => (x.id === "a" ? { ...x, silence: true } : x));
    const vent = L.appliquerPresage({ ...jour(L), presage: L.presageInitial(true) }, { cle: "vent-du-nord", villageois: vs });
    assert.deepEqual(vent.changements, [{ type: "silence", acteurId: "a", valeur: false }]);
    const rumeur = L.appliquerPresage({ ...jour(L), presage: L.presageInitial(true) }, { cle: "rumeur", villageois: vs, bilan: { visites: ["a"], sorties: [] }, hasard: () => 0 });
    assert.equal(rumeur.annonces.length, 2);
    assert.deepEqual(rumeur.etat.presage, { actif: true, cle: "rumeur", tour: 1 });
  },
  // ------------------------------------------------------------ le Somnambule
  "somnambule : il rêve un rôle de vision du contenu, de préférence absent": L => {
    for (const h of [0, 0.5, 0.99]) assert.equal(L.choisirReve({ disponibles: L.REVES, enJeu: ["liseuse-de-cendres", "sourcier"], hasard: () => h }), "fossoyeur");
    assert.equal(L.choisirReve({ disponibles: ["sourcier"], enJeu: [], hasard: () => 0 }), "sourcier", "seulement ce que le contenu a");
    assert.ok(L.REVES.includes(L.choisirReve({ disponibles: L.REVES, enJeu: L.REVES })), "tous en jeu : l'un d'eux quand même");
    assert.deepEqual(L.reveurs({ a: { croit: "fossoyeur" }, b: { croit: "sourcier", devoile: true } }), ["a"]);
  },
  "somnambule : visions fausses mais plausibles (camp inverse, même camp à l'envers, faux rôle d'un mort)": L => {
    const vs = mort(village(), "b");
    const r = nuit(L, vs, jour(L), [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["l"] }, { acteurId: "so", roleCle: "sourcier", cibles: ["a", "g"] },
      { acteurId: "fo", roleCle: "fossoyeur", cibles: ["b"] }], { somnambules: ["li", "so", "fo"], rolesFactices: ["Villageois", "Herboriste"] });
    assert.match(texteA(r, "li"), /« village »/);
    assert.match(texteA(r, "so"), /ne sont pas du même camp/);
    assert.match(texteA(r, "fo"), /était : Herboriste/);
    const vrai = nuit(L, vs, jour(L), [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["a"] }], { somnambules: ["li"] });
    assert.match(texteA(vrai, "li"), /« meute »/, "un villageois rêvé loup");
    const honnete = nuit(L, vs, jour(L), [{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["l"] }, { acteurId: "fo", roleCle: "fossoyeur", cibles: ["b"] }]);
    assert.match(texteA(honnete, "li"), /« meute »/);
    assert.match(texteA(honnete, "fo"), /était : Villageois/);
    // Un mort au rôle déjà révélé se lit tel quel, même en rêve.
    const revele = nuit(L, vs.map(x => (x.id === "b" ? { ...x, revele: true } : x)), jour(L), [{ acteurId: "fo", roleCle: "fossoyeur", cibles: ["b"] }],
      { somnambules: ["fo"], rolesFactices: ["Herboriste"] });
    assert.match(texteA(revele, "fo"), /était : Villageois/);
  },
  "somnambule : jamais mieux qu'une vraie vision (Loup déguisé, Louvetier) ; faux rôles ni loups ni Somnambule": L => {
    const vs = [...village(), v("ld", "loup", { role: { ...ROLE.loup, cle: "loup-deguise", apparence: "village" } }),
      v("lv", "liseuse", { role: { ...ROLE.liseuse, cle: "louvetier", apparence: "meute" } })];
    const lire = (cibles, somnambules) => nuit(L, vs, jour(L), [{ acteurId: cibles.length > 1 ? "so" : "li", roleCle: cibles.length > 1 ? "sourcier" : "liseuse-de-cendres", cibles }],
      { somnambules });
    assert.match(texteA(lire(["ld"], ["li"]), "li"), /« village »/, "le Loup déguisé reste « village » pour le Somnambule");
    assert.match(texteA(lire(["ld"], []), "li"), /« village »/, "comme pour une vraie Liseuse");
    assert.match(texteA(lire(["lv"], ["li"]), "li"), /« meute »/, "le Louvetier reste « meute »");
    assert.match(texteA(lire(["ld", "a"], ["so"]), "so"), /sont du même camp/, "Sourcier rêvé : pas mieux qu'un vrai");
    assert.match(texteA(lire(["ld", "a"], []), "so"), /sont du même camp/);
    assert.match(texteA(lire(["l", "a"], ["so"]), "so"), /sont du même camp/, "à l'envers des vrais camps");
    assert.deepEqual(L.nomsFactices([{ cle: "loup-de-brumecombe", nom: "Loup", camp: "meute" }, { cle: "somnambule", nom: "Somnambule", camp: "village" },
      { cle: "herboriste", nom: "Herboriste", camp: "village" }, { cle: "pyromane", nom: "Pyromane", camp: "solitaire" }]), ["Herboriste", "Pyromane"]);
  },
  "dernier souffle : un mort qui le garde ne voit rien des rôles cachés (salons), ni n'est une voix attendue": L => {
    const table = (souffle, mortsVoientTout = true) => ({ mortsVoientTout, automatique: true, souffleActif: true,
      utilisateurs: [{ id: "mj", mj: true }, { id: "uL", mj: false }, { id: "uS", mj: false }, { id: "uV", mj: false }],
      villageois: [{ id: "L", joueur: "uL", vivant: true, camp: "meute" }, { id: "S", joueur: "uS", vivant: false, camp: "village", souffle },
        { id: "V", joueur: "uV", vivant: false, camp: "village", souffle: false }] });
    const nuitPub = { phase: "nuit" };
    assert.ok(!L.audibilite(nuitPub, {}, "uL", table(true)).auditeurs.includes("uS"), "la tanière : pas pour un mort qui garde son souffle");
    assert.ok(L.audibilite(nuitPub, {}, "uL", table(false)).auditeurs.includes("uS"), "son souffle rendu, il voit tout");
    assert.ok(!L.audibilite(nuitPub, {}, "uV", table(true)).auditeurs.includes("uS"), "les morts qui voient tout ne lui parlent pas");
    assert.ok(L.audibilite(nuitPub, {}, "uV", table(true, false)).auditeurs.includes("uS"), "sans « mortsVoientTout », les morts ensemble");
    const vil = [{ id: "a", vivant: true }, { id: "b", vivant: true }, { id: "m", vivant: false }];
    let e = L.ouvrirVote(avecSouffle(L), { candidats: ["a", "b"] });
    e = L.enregistrerVote(e, { votant: "m", cible: "a" }).etat;
    e = L.enregistrerVote(e, { votant: "a", cible: "b" }).etat;
    assert.deepEqual(L.compteDesVoix({ etat: e, villageois: vil }), { exprimes: 1, attendus: 2, souffles: 1 });
    assert.equal(L.etapeSuivante(L.etatPublic({ ...e, partie: "p" }), null, { villageois: vil }).donnees.n, 1, "b n'a pas voté");
  },
  "la composition en cours reste un secret du MJ jusqu'à la fin": L => {
    const e = { ...jour(L), aConsigner: { roles: ["somnambule", "rosiere"], batiments: [], niveau: "chaos", composition: "x", quand: 1 } };
    const { public: pub, secret } = L.separerEtat(e);
    assert.equal(pub.aConsigner, null);
    assert.ok(!JSON.stringify(pub).includes("rosiere"));
    assert.deepEqual(L.fusionnerEtat(pub, secret).aConsigner, e.aConsigner);
  },
  "somnambule : un secret du MJ ; jamais un masque de la meute": L => {
    const e = { ...jour(L), somnambules: { a: { croit: "fossoyeur", vrai: "Item.x" } }, bonneEtoile: "g" };
    const { public: pub, secret } = L.separerEtat(e);
    assert.deepEqual(pub.somnambules, {});
    assert.equal(pub.bonneEtoile, "");
    assert.ok(!JSON.stringify(pub).includes("fossoyeur"));
    assert.deepEqual(L.fusionnerEtat(pub, secret).somnambules, e.somnambules);
    assert.equal(L.fusionnerEtat(pub, secret).bonneEtoile, "g");
    assert.deepEqual(L.choisirMasques({ roles: [{ cle: "somnambule", camp: "village" }, { cle: "rosiere", camp: "village" }, { cle: "herboriste", camp: "village" }],
      loups: 2, graine: "x" }), ["herboriste"], "ni Somnambule ni Rosière");
    assert.deepEqual(L.choisirMasques({ roles: [{ cle: "nouveau", camp: "village", surDemande: true }, { cle: "herboriste", camp: "village" }], loups: 2, graine: "x" }),
      ["herboriste"], "ni un rôle sur demande");
  },
  // ------------------------------------------------------------ la Rosière
  "rosière : exécutée par le vote, le Village perd ; la nuit, rien": L => {
    const vs = [...mort(village(), "a"), v("r", "rosiere", { vivant: false })];
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "r", cause: "vote" }] }), "meute");
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "r", cause: "nuit" }] }), "");
    assert.equal(L.verifierVictoire({ villageois: vs, morts: [{ acteurId: "r", cause: "vote" }], peste: { active: true } }), "peste");
  },
  // ------------------------------------------------------------ les Saints du calendrier
  "glas final : il sonne le jour N après le vote, ou plus tard": L => {
    assert.equal(L.glasSonne({ ...jour(L), glas: 1 }), false, "le jour N, avant le vote");
    assert.equal(L.glasSonne({ ...jour(L), glas: 1, vote: { ...jour(L).vote, resultat: { objet: "execution", tour: 1, elus: [] } } }), true);
    assert.equal(L.glasSonne({ ...jour(L, { tour: 2 }), glas: 1 }), true);
    assert.equal(L.glasSonne({ ...jour(L, { tour: 5 }), glas: 0 }), false, "sans glas");
    assert.equal(L.glasSonne({ ...jour(L, { tour: 5, phase: "fin" }), glas: 1 }), false);
  },
  "glas final : la meute si un loup vit, sinon le tueur solitaire, sinon le village ; la peste dans une peste noire": L => {
    assert.equal(L.verifierVictoire({ villageois: village() }), "");
    assert.equal(L.verifierVictoire({ villageois: village(), glas: true }), "meute");
    assert.equal(L.verifierVictoire({ villageois: [...mort(village(), "l"), v("p", "pyromane")], glas: true }), "p");
    assert.equal(L.verifierVictoire({ villageois: village().filter(x => x.id !== "l"), peste: { active: true }, glas: true }), "peste");
    const fin = { ...jour(L, { phase: "vote", tour: 1 }), glas: 1, vote: { ...jour(L).vote, numero: 1, resultat: { objet: "execution", tour: 1, numero: 1, elus: [] } } };
    assert.equal(L.etapeSuivante(fin, null, { villageois: village() }).cle, "victoire", "l'étape du MJ humain");
  },
  "bonne étoile : protégé en secret la première nuit seulement ; le givre l'emporte": L => {
    const e = { ...jour(L, { tour: 0 }), bonneEtoile: "a" };
    assert.deepEqual(L.effetsDeLaNuit(e, 1).etoiles, ["a"]);
    assert.deepEqual(L.effetsDeLaNuit(e, 2).etoiles, []);
    assert.deepEqual(L.resoudreNuit({ villageois: village(), actions: [meute("a")], tour: 1, hasard: () => 0, jour: L.effetsDeLaNuit(e, 1) }).morts, []);
    assert.deepEqual(L.resoudreNuit({ villageois: village(), actions: [meute("a")], tour: 1, hasard: () => 0, jour: { ...L.effetsDeLaNuit(e, 1), givre: true } }).morts, ["a"]);
  }
};

const MUTATIONS = [
  ["souffle.mjs", "&& !(etat.souffle.utilises ?? []).includes(v.id)", "", "souffle : une seule fois"],
  ["souffle.mjs", "exprimes: exprimes.filter(id => vivants.has(id)).length", "exprimes: exprimes.length", "souffle : voix vivantes comptées à part"],
  ["etapes.mjs", "v.exprimes.filter(id => ids.has(id)).length", "v.exprimes.length", "étape : voix manquantes des vivants"],
  ["salons.mjs", "  if (salonL === \"taniere\" && !a.vivant && a.souffle) return false;\n", "", "souffle : pas la tanière"],
  ["salons.mjs", "  if (salonL === \"morts\" && mortsVoientTout && Boolean(a.souffle) !== Boolean(l.souffle)) return false;\n", "", "souffle : pas les morts qui voient tout"],
  ["salons.mjs", "if (salonL === \"morts\" && mortsVoientTout && ", "if (salonL === \"morts\" && ", "souffle : morts ensemble sans le réglage"],
  ["masques.mjs", " && r.cle !== CLE_ROSIERE", "", "pas de masque Rosière"],
  ["masques.mjs", " && !r.surDemande", "", "pas de masque sur demande"],
  ["somnambule.mjs", "r.camp !== \"meute\" && ", "", "faux rôle : pas un loup"],
  ["somnambule.mjs", " && r.cle !== CLE_SOMNAMBULE).map(r => r.nom)", ").map(r => r.nom)", "faux rôle : pas Somnambule"],
  ["resolution.mjs", "const lu = reve.has(a.acteurId) && !mort.revele ? ", "const lu = reve.has(a.acteurId) ? ", "fossoyeur rêvé : un mort révélé se lit tel quel"],
  ["etat.mjs", "  if (execution && presageDuJour(etat) === \"glas\") etat.vote.double = true;\n", "", "glas : ce jour-là"],
  ["etat.mjs", "\"bonneEtoile\", \"aConsigner\", \"pouvoirsDeuil\"", "\"bonneEtoile\", \"pouvoirsDeuil\"", "composition en cours secrète"],
  ["etat.mjs", "  if (s.aConsigner !== undefined) etat.aConsigner = s.aConsigner;\n", "", "composition en cours rendue au MJ"],
  ["souffle.mjs", "  if ((etat?.vote?.objet ?? \"execution\") !== \"execution\") return vivants;\n", "", "souffle : vote d'exécution seulement"],
  ["souffle.mjs", "Boolean(etat?.souffle?.actif) && mort(v)", "mort(v)", "souffle : le réglage"],
  ["souffle.mjs", "export const peutSouffler = (etat, v) => Boolean(etat?.vote?.ouvert) && ", "export const peutSouffler = (etat, v) => ", "souffle : un vote ouvert"],
  ["etat.mjs", "const souffle = v.objet === \"execution\" ? souffles.filter(id => id in r.votes) : [];", "const souffle = souffles;", "souffle rendu s'il a voté"],
  ["etat.mjs", "  etat.souffle.utilises = [...new Set([...etat.souffle.utilises, ...souffle])];\n", "", "souffle consommé"],
  ["almanach.mjs", "CLES_PRESAGES.filter(c => c !== avant)", "CLES_PRESAGES", "almanach : pas deux fois de suite"],
  ["almanach.mjs", "  if (!etat.presage.actif || !PRESAGES[cle]) return sortie;", "  if (!PRESAGES[cle]) return sortie;", "almanach : la variante"],
  ["almanach.mjs", "return p.actif && p.cle && p.tour === nuit - 1 && PRESAGES[p.cle].quand === \"nuit\" ? p.cle : \"\";", "return p.actif && p.cle ? p.cle : \"\";", "almanach : la nuit suivante"],
  ["almanach.mjs", "return p.actif && p.cle && p.tour === tour ? p.cle : \"\";", "return p.actif && p.cle ? p.cle : \"\";", "almanach : ce jour-là"],
  ["almanach.mjs", "for (const v of villageois) if (v.vivant !== false && v.silence) sortie.changements.push(", "for (const v of []) sortie.changements.push(", "présage : vent du nord"],
  ["almanach.mjs", "    sortie.annonces.push(msg(\"Rumeur\"", "    void (msg(\"Rumeur\"", "présage : rumeur"],
  ["resolution.mjs", "  if (jour.givre) proteges.clear();\n", "", "présage : givre (protections)"],
  ["resolution.mjs", "new Set(jour.givre ? [] : jour.verrous ?? [])", "new Set(jour.verrous ?? [])", "présage : givre (verrou)"],
  ["jour.mjs", "\n      || presageDeLaNuit(etat, tour) === \"crue\"", "", "présage : crue"],
  ["jour.mjs", "givre: presageDeLaNuit(etat, tour) === \"givre\",", "givre: false,", "présage : givre (nuit)"],
  ["etat.mjs", "  if (etat.vote.ouvert && etat.vote.mainLevee) pub.vote.votes = copie(etat.vote.votes);\n", "", "présage : foire (public)"],
  ["etat.mjs", "if (etat.vote.ouvert && etat.vote.mainLevee)", "if (etat.vote.mainLevee || true)", "foire : seulement ce jour-là"],
  ["etat.mjs", "    mainLevee: presageDuJour(etat) === \"foire\"", "    mainLevee: false", "présage : foire (vote)"],
  ["etat.mjs", " || presageDuJour(etat) === \"lune-rousse\")", ")", "présage : lune rousse"],
  ["registre.mjs", "  if (presageDuJour(etat) === \"brouillard\") return non(\"brouillard\");\n", "", "présage : brouillard"],
  ["bailli.mjs", "  if (presageDuJour(etat) === \"sceau-brise\") return {};\n", "", "présage : sceau fêlé"],
  ["somnambule.mjs", "return choisir(absents.length ? absents : possibles, hasard) ?? \"\";", "return choisir(possibles, hasard) ?? \"\";", "somnambule : un rôle absent"],
  ["somnambule.mjs", "const possibles = REVES.filter(c => disponibles.includes(c));", "const possibles = REVES;", "somnambule : du contenu"],
  ["somnambule.mjs", "filter(([, s]) => s && !s.devoile)", "filter(([, s]) => s)", "somnambule : dévoilé ne rêve plus"],
  ["somnambule.mjs", "(apparence === \"meute\" ? \"village\" : \"meute\")", "apparence", "somnambule : camp inverse"],
  ["somnambule.mjs", "noms.filter(n => n && n !== vrai)", "noms.filter(n => n)", "somnambule : un autre rôle"],
  ["resolution.mjs", "reve.has(a.acteurId) ? parId.get(c)?.camp !== parId.get(d)?.camp : ", "", "somnambule : sourcier à l'envers"],
  ["resolution.mjs", "reve.has(a.acteurId) ? parId.get(c)?.camp !== parId.get(d)?.camp", "reve.has(a.acteurId) ? apparenceDe(parId.get(c)) !== apparenceDe(parId.get(d))", "sourcier rêvé : les vrais camps"],
  ["resolution.mjs", "const camp = reve.has(a.acteurId) ? campInverse(parId.get(c)?.camp) : vu(c, a.acteurId);", "const camp = vu(c, a.acteurId);", "somnambule : liseuse rêvée"],
  ["resolution.mjs", "campInverse(parId.get(c)?.camp)", "campInverse(apparenceDe(parId.get(c)))", "liseuse rêvée : le vrai camp"],
  ["resolution.mjs", "? roleFactice(vrai, rolesFactices, hasard) : vrai;", "? vrai : vrai;", "somnambule : fossoyeur rêvé"],
  ["etat.mjs", "\"masques\", \"somnambules\", \"bonneEtoile\", \"aConsigner\"", "\"masques\", \"aConsigner\"", "somnambule et étoile secrets"],
  ["etat.mjs", "  for (const cle of [\"primes\", \"fioles\", \"carnets\", \"somnambules\"]) if (s[cle]", "  for (const cle of [\"primes\", \"fioles\", \"carnets\"]) if (s[cle]", "somnambules rendus au MJ"],
  ["etat.mjs", "  if (typeof s.bonneEtoile === \"string\") etat.bonneEtoile = s.bonneEtoile;\n", "", "étoile rendue au MJ"],
  ["masques.mjs", " && r.cle !== CLE_SOMNAMBULE", "", "pas de masque Somnambule"],
  ["victoire.mjs", "  if (villageois.some(v => v.role?.cle === CLE_ROSIERE && executes.has(v.id))) return peste?.active ? VAINQUEUR_PESTE : \"meute\";\n", "", "Rosière"],
  ["victoire.mjs", "return peste?.active ? VAINQUEUR_PESTE : \"meute\";", "return \"meute\";", "Rosière en peste noire"],
  ["victoire.mjs", "  if (glas) return meute > 0 ? \"meute\" : tueurs[0]?.id ?? \"village\";\n", "", "glas : la partie s'arrête"],
  ["victoire.mjs", "tueurs[0]?.id ?? \"village\"", "\"village\"", "glas : le tueur solitaire"],
  ["victoire.mjs", "    if (glas) return VAINQUEUR_PESTE;\n", "", "glas : la peste"],
  ["calendrier.mjs", "return etat.tour > n || (etat.tour === n && voteExecutionDuJour(etat));", "return etat.tour >= n;", "glas : après le vote"],
  ["calendrier.mjs", "if (!n || etat?.phase === \"fin\" || etat?.vainqueur) return false;", "if (!n) return false;", "glas : une partie finie"],
  ["calendrier.mjs", "(nuit === 1 && etat?.bonneEtoile ?", "(etat?.bonneEtoile ?", "étoile : la première nuit"],
  ["etapes.mjs", "glas: glasSonne(etat), ", "", "étape : le glas"],
  ["resolution.mjs", "  for (const id of jour.etoiles ?? []) proteges.add(id);\n", "", "étoile : protection"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-lot2-mutant-"));
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

test("lot 2 (logique) : la logique d'origine passe toute la batterie", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  assert.deepEqual(echecs(L).map(x => `${x.nom} : ${x.e.message}`), []);
});

test("lot 2 (logique) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!echecs(await chargerMutant(fichier, avant, apres)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

test("l'Almanach du contenu suit les présages du système, dans le même ordre", async () => {
  const L = await import(pathToFileURL(join(SOURCE, "index.mjs")).href);
  const { ALMANACH } = await import("../modules/lakour-veillees/contenu/tables.mjs");
  assert.deepEqual(ALMANACH.map(([cle]) => cle), L.CLES_PRESAGES);
  const fr = JSON.parse(readFileSync(new URL("../systems/lakour-loups/lang/fr.json", import.meta.url), "utf8")).LAKOUR_LOUPS.Almanach.Presages;
  for (const [cle, nom] of ALMANACH) assert.equal(fr[cle].Nom, nom, cle);
});
