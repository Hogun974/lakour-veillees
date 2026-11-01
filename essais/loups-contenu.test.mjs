// Le système lakour-loups face aux VRAIS rôles et compositions du module lakour-veillees : clés d'effet connues,
// réveil de la meute groupé par camp, et parties simulées à la façon du MJ IA (chaque loup note le choix de la meute,
// les passes sont notées avec des cibles vides, nombre = nuit.cibles).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as L from "../systems/lakour-loups/logique/index.mjs";

const CONTENU = fileURLToPath(new URL("../modules/lakour-veillees/", import.meta.url));
const present = existsSync(join(CONTENU, "src/roles")) && existsSync(join(CONTENU, "assets/compositions.json"));
const ROLES = present ? Object.fromEntries(readdirSync(join(CONTENU, "src/roles")).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(join(CONTENU, "src/roles", f), "utf8"))).map(r => [r.system.cle, { ...r.system, nom: r.name }])) : {};
const COMPOSITIONS = present ? JSON.parse(readFileSync(join(CONTENU, "assets/compositions.json"), "utf8")) : {};
const options = { skip: present ? false : "module lakour-veillees absent" };

const v = (id, cle, extra = {}) => ({ id, nom: id, vivant: true, camp: ROLES[cle].camp, maison: `Maison ${id}`, amoureux: "", silence: false,
  protections: 0, role: structuredClone(ROLES[cle]), ...extra });

test("contenu : chaque rôle a une clé d'effet connue du système (ou aucune)", options, () => {
  assert.ok(Object.keys(ROLES).length >= 20);
  for (const [cle, r] of Object.entries(ROLES)) {
    assert.ok(r.effet === "" || L.EFFETS.includes(r.effet), `${cle} : effet « ${r.effet} »`);
    assert.ok(L.CAMPS.includes(r.camp), cle);
  }
});

test("contenu : la meute se réveille ensemble à 40, puis chaque loup à pouvoir propre seul (41 à 44)", options, () => {
  const vs = ["loup-de-brumecombe", "loup-deguise", "louve-mere", "loup-affame", "loup-hurleur", "loup-flaireur", "liseuse-de-cendres", "garde-du-pont"]
    .map((cle, i) => v(`a${i}`, cle));
  vs.push(v("mordu", "veilleuse-de-lanterne", { camp: "meute" }));
  const o = L.ordreDeNuit(vs, 2);
  const meute = o.find(e => e.roleCle === "meute");
  assert.equal(meute.ordre, 40);
  assert.deepEqual(meute.acteurIds.sort(), ["a0", "a1", "a2", "a3", "a4", "a5", "mordu"].sort());
  const apres = o.slice(o.indexOf(meute) + 1).map(e => e.roleCle);
  assert.deepEqual(apres.slice(0, 4), ["louve-mere", "loup-affame", "loup-hurleur", "loup-flaireur"]);
  assert.ok(!o.some(e => e.roleCle === "loup-de-brumecombe" || e.roleCle === "loup-deguise"), "pas de réveil à part à 40");
  assert.ok(o.some(e => e.roleCle === "veilleuse-de-lanterne" && e.acteurIds.includes("mordu")), "le mordu garde son pouvoir");
  assert.ok(!L.ordreDeNuit(vs, 1).some(e => e.roleCle === "loup-affame"), "affamé : nuits paires seulement");
});

test("contenu : Herboriste, Pyromane, Ermite, Chasseur de primes tels que décrits", options, () => {
  assert.equal(ROLES.herboriste.effet, "remede");
  const vs = [v("l", "loup-de-brumecombe"), v("h", "herboriste"), v("p", "pyromane"), v("e", "ermite"), v("c", "chasseur-de-primes"), v("x", "villageois"), v("y", "villageois")];
  const r = L.resoudreNuit({ villageois: vs, tour: 1, primes: { c: "y" }, hasard: () => 0, asperges: [], actions: [
    { acteurId: "l", roleCle: "meute", cibles: ["x"] }, { acteurId: "h", roleCle: "herboriste", cibles: ["y"] },
    { acteurId: "p", roleCle: "pyromane", cibles: ["x"] }, { acteurId: "e", roleCle: "ermite", cibles: [] }] });
  assert.deepEqual(r.deces, [{ acteurId: "x", cause: "meute" }, { acteurId: "y", cause: "poison" }]);
  assert.ok(r.messages.some(m => m.destinataire === "e"));
  assert.ok(r.messages.some(m => m.destinataire === "c" && m.donnees.nom === "y"));
  const feu = L.resoudreNuit({ villageois: vs, tour: 2, asperges: ["x", "y"], actions: [{ acteurId: "p", roleCle: "pyromane", cibles: ["p"] }] });
  assert.deepEqual(feu.morts.sort(), ["x", "y"]);
});

// Partie menée comme le MJ IA : ordreDeNuit, un choix par étape (nombre = nuit.cibles), noté pour chaque acteur.
function jouer(compo, graine) {
  const h = L.creerHasard(graine);
  const joueurs = compo.roles.map((_, i) => `u${i}`);
  let vs = L.distribuer({ roles: compo.roles, joueurs, maisons: joueurs.map((_, i) => `Maison ${i + 1}`), hasard: h })
    .map((t, i) => v(`a${i}`, t.role));
  let etat = L.etatInitial();
  etat.primes = L.designerPrimes(vs, h);
  const vivants = () => vs.filter(x => x.vivant).map(x => x.id);
  for (let n = 0; n < 40; n++) {
    etat = L.passerPhase(etat, "nuit");
    for (const etape of L.ordreDeNuit(vs, etat.tour)) {
      const premier = vs.find(x => x.id === etape.acteurIds[0]);
      const nombre = etape.roleCle === "meute" ? 1 : Number(premier.role.nuit.cibles);
      let candidats = vivants();
      if (etape.roleCle === "meute") candidats = candidats.filter(id => !etape.acteurIds.includes(id));
      else if (!premier.role.nuit.soiMeme) candidats = candidats.filter(id => id !== premier.id);
      const cibles = h() < 0.15 ? [] : L.melanger(candidats, h).slice(0, nombre);
      for (const acteurId of etape.acteurIds) {
        etat = L.ajouterAction(etat, { acteurId, roleCle: etape.roleCle, cibles }, etat.nuit.actions.length);
        const r = vs.find(x => x.id === acteurId).role;
        if (etape.roleCle !== "meute" && r.usages.max > 0 && (cibles.length || nombre === 0)) r.usages.restant -= 1;
      }
    }
    const r = L.resoudreNuit({ villageois: vs, actions: etat.nuit.actions, tour: etat.tour, asperges: etat.asperges,
      precedentes: etat.nuitPrecedente.actions, primes: etat.primes, hasard: h });
    for (const d of r.deces) etat = L.ajouterMort(etat, d);
    vs = L.appliquerResolution(vs, r);
    etat = L.cloreNuit(etat, { asperges: r.asperges });
    let g = L.verifierVictoire({ villageois: vs, morts: etat.morts, primes: etat.primes });
    if (g) return { g, etat, vs };
    etat = L.ouvrirVote(etat, { candidats: vivants(), maintenant: 0 });
    for (const id of vivants()) etat = L.enregistrerVote(etat, { votant: id, cible: L.choisir(vivants().filter(x => x !== id), h), votants: vivants(), maintenant: 0 }).etat;
    const clos = L.cloreVote(etat, { votants: vivants() });
    etat = clos.etat;
    for (const elu of clos.resultat.elus) {
      for (const [i, id] of L.cascadeAmour(vs, elu).entries()) {
        etat = L.ajouterMort(etat, { acteurId: id, cause: i ? "chagrin" : "vote" });
        vs = vs.map(x => (x.id === id ? { ...x, vivant: false } : x));
      }
    }
    g = L.verifierVictoire({ villageois: vs, morts: etat.morts, primes: etat.primes });
    if (g) return { g, etat, vs };
  }
  return { g: "", etat, vs };
}

test("contenu : toutes les compositions se jouent jusqu'au bout (parties simulées)", options, () => {
  const sansFin = [];
  for (const [cle, compo] of Object.entries(COMPOSITIONS)) {
    for (const r of compo.roles) assert.ok(ROLES[r], `${cle} : rôle inconnu ${r}`);
    for (let graine = 0; graine < 8; graine++) {
      const { g, etat, vs } = jouer(compo, `${cle}-${graine}`);
      if (!g && vs.some(x => x.vivant)) sansFin.push(`${cle}#${graine}`);
      assert.equal(new Set(etat.morts.map(m => m.acteurId)).size, etat.morts.length, `${cle}#${graine} : mort en double`);
    }
  }
  assert.deepEqual(sansFin, []);
});

test("contenu : Loup des roseaux, Louvetier, Pêcheur de nuit et Dame du gué tels que décrits, avec les seuls effets déjà automatisés", options, () => {
  for (const cle of ["loup-des-roseaux", "louvetier", "pecheur-de-nuit", "dame-du-gue"]) assert.ok(L.EFFETS_AUTOMATISES.includes(ROLES[cle].effet), cle);
  const vs = [v("l", "loup-de-brumecombe"), v("r", "loup-des-roseaux"), v("lv", "louvetier"), v("pe", "pecheur-de-nuit"), v("d", "dame-du-gue"),
    v("li", "liseuse-de-cendres"), v("so", "sourcier"), v("ve", "veilleuse-de-lanterne"), v("g", "garde-du-pont"), v("x", "villageois"), v("y", "villageois")];
  const nuit = (actions, tour = 1, extra = {}) => L.resoudreNuit({ villageois: vs, actions, tour, hasard: () => 0, ...extra });
  const dit = (r, qui) => r.messages.filter(m => m.destinataire === qui).map(m => m.cle.split(".").pop());

  // Réveils : le Loup des roseaux chasse avec la meute puis guette seul ; la Dame du gué les nuits paires ; le Pêcheur tant qu'il a son harpon.
  const reveil = tour => L.ordreDeNuit(vs, tour).map(e => e.roleCle);
  assert.ok(L.ordreDeNuit(vs, 1).find(e => e.roleCle === "meute").acteurIds.includes("r"));
  assert.ok(reveil(1).indexOf("loup-des-roseaux") > reveil(1).indexOf("meute"));
  assert.ok(reveil(1).includes("pecheur-de-nuit") && !reveil(1).includes("dame-du-gue") && reveil(2).includes("dame-du-gue"));
  const harponUse = vs.map(x => (x.id === "pe" ? { ...x, role: { ...x.role, usages: { max: 1, restant: 0 } } } : x));
  assert.ok(!L.ordreDeNuit(harponUse, 3).some(e => e.roleCle === "pecheur-de-nuit"), "un seul harpon");

  // Loup des roseaux : a-t-il agi ? Sans dire quoi. Il rôde au seuil : la lanterne le démasque.
  assert.deepEqual(dit(nuit([{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["x"] }, { acteurId: "r", roleCle: "loup-des-roseaux", cibles: ["li"] }]), "r"), ["ActifOui"]);
  const guet = nuit([{ acteurId: "r", roleCle: "loup-des-roseaux", cibles: ["y"] }, { acteurId: "ve", roleCle: "veilleuse-de-lanterne", cibles: ["y"] }]);
  assert.deepEqual(dit(guet, "r"), ["ActifNon"]);
  assert.deepEqual(guet.revelations.map(x => x.acteurId), ["r"]);

  // Louvetier : il voit juste, mais toute vision le voit de la meute.
  const vision = nuit([{ acteurId: "li", roleCle: "liseuse-de-cendres", cibles: ["lv"] }, { acteurId: "lv", roleCle: "louvetier", cibles: ["x"] },
    { acteurId: "so", roleCle: "sourcier", cibles: ["lv", "l"] }], 2);
  assert.equal(vision.messages.find(m => m.destinataire === "li").donnees.camp, "meute");
  assert.equal(vision.messages.find(m => m.destinataire === "lv").donnees.camp, "village");
  assert.deepEqual(dit(vision, "so"), ["MemeCamp"]);
  assert.equal(nuit([{ acteurId: "lv", roleCle: "louvetier", cibles: ["r"] }]).messages.find(m => m.destinataire === "lv").donnees.camp, "meute");

  // Pêcheur de nuit : sa cible meurt (pas de crocs), sauf protection ; le verrou du Forgeron n'arrête que les loups ; il atteint la Dame du gué.
  assert.deepEqual(nuit([{ acteurId: "pe", roleCle: "pecheur-de-nuit", cibles: ["y"] }]).deces, [{ acteurId: "y", cause: "nuit" }]);
  assert.deepEqual(nuit([{ acteurId: "pe", roleCle: "pecheur-de-nuit", cibles: ["y"] }, { acteurId: "g", roleCle: "garde-du-pont", cibles: ["y"] }]).morts, []);
  assert.deepEqual(nuit([{ acteurId: "pe", roleCle: "pecheur-de-nuit", cibles: ["y"] }], 1, { jour: { verrous: ["y"] } }).morts, ["y"]);
  assert.deepEqual(nuit([{ acteurId: "pe", roleCle: "pecheur-de-nuit", cibles: ["d"] }]).morts, ["d"]);

  // Dame du gué : noyade comme le harpon ; la meute ne peut pas la tuer ; elle gagne seule, dernière avec un non-loup.
  assert.deepEqual(nuit([{ acteurId: "d", roleCle: "dame-du-gue", cibles: ["x"] }], 2).deces, [{ acteurId: "x", cause: "nuit" }]);
  const bredouille = nuit([{ acteurId: "l", roleCle: "meute", cibles: ["d"] }], 2);
  assert.deepEqual(bredouille.morts, []);
  assert.ok(bredouille.sauves.some(s => s.acteurId === "d" && s.par === "immunite"));
  const fin = vivants => vs.map(x => ({ ...x, vivant: vivants.includes(x.id) }));
  assert.equal(L.verifierVictoire({ villageois: fin(["d", "x"]) }), "d");
  assert.equal(L.verifierVictoire({ villageois: fin(["d", "l"]) }), "meute", "dernière avec un loup : la meute l'emporte");
  assert.equal(L.verifierVictoire({ villageois: fin(["d", "x", "y"]) }), "", "le village n'a pas gagné tant qu'elle vit");
});
