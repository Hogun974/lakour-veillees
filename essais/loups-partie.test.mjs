// Parties complètes simulées de bout en bout sur la logique pure de lakour-loups : distribution, nuits, aubes,
// votes, jusqu'à la victoire.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../systems/lakour-loups/logique/index.mjs";

const ROLES = {
  loup: { cle: "loup-de-brumecombe", nom: "Loup", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } },
  affame: { cle: "loup-affame", nom: "Loup affamé", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 45, uneNuitSurDeux: true } },
  louve: { cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", nuit: { actif: true, ordre: 41 }, usages: { max: 1, restant: 1 } },
  villageois: { cle: "villageois", nom: "Villageois", camp: "village", effet: "", nuit: { actif: false } },
  veilleuse: { cle: "veilleuse-de-lanterne", nom: "Veilleuse", camp: "village", effet: "eclairer", nuit: { actif: true, ordre: 30 } },
  liseuse: { cle: "liseuse-de-cendres", nom: "Liseuse", camp: "village", effet: "voir-camp", nuit: { actif: true, ordre: 35 } },
  herboriste: { cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", nuit: { actif: true, ordre: 60 }, usages: { max: 2, restant: 2 } },
  garde: { cle: "garde-du-pont", nom: "Garde", camp: "village", effet: "proteger", nuit: { actif: true, ordre: 20 } },
  entremetteuse: { cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour", nuit: { actif: true, ordre: 10, premiereNuitSeulement: true, cibles: 2 } },
  revenant: { cle: "revenant", nom: "Revenant", camp: "solitaire", effet: "", nuit: { actif: false } },
  pyromane: { cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", nuit: { actif: true, ordre: 80 } }
};

const COMPOSITIONS = {
  debutants: ["loup", "loup", "garde", "liseuse", "villageois", "villageois"],
  classique: ["loup", "loup", "affame", "veilleuse", "liseuse", "herboriste", "garde", "villageois", "villageois", "villageois"],
  chaos: ["loup", "loup", "louve", "affame", "veilleuse", "liseuse", "herboriste", "garde", "entremetteuse", "revenant", "pyromane", "villageois", "villageois", "villageois"]
};

// Moteur d'essai : il joue le rôle du narrateur et des joueurs, avec des stratégies simples et reproductibles.
function jouerPartie(graine, composition) {
  const h = L.creerHasard(graine);
  const joueurs = composition.map((_, i) => `u${i + 1}`);
  const tirage = L.distribuer({ roles: composition, metiers: [], joueurs, maisons: joueurs.map((_, i) => `Maison ${i + 1}`), hasard: h });
  let vs = tirage.map((t, i) => ({ id: `a${i + 1}`, nom: `V${i + 1}`, joueur: t.joueur, vivant: true, camp: ROLES[t.role].camp, maison: t.maison,
    amoureux: "", silence: false, protections: 0, role: structuredClone(ROLES[t.role]) }));
  let etat = L.etatInitial();
  etat.primes = L.designerPrimes(vs, h);
  const connus = new Set();   // loups connus du village (révélés, ou vus par la Liseuse)
  const journal = [];
  const vivants = () => vs.filter(v => v.vivant);
  const par = id => vs.find(v => v.id === id);
  const autreVivant = (moi, filtre = () => true) => L.choisir(vivants().filter(v => v.id !== moi && filtre(v)).map(v => v.id), h);
  const verifier = () => {
    const g = L.verifierVictoire({ villageois: vs, morts: etat.morts, primes: etat.primes });
    if (g) etat = L.declarerVainqueur(etat, g);
    return g;
  };

  for (let garde = 0; garde < 40 && !etat.vainqueur; garde++) {
    // ---- Nuit
    etat = L.passerPhase(etat, "nuit");
    let victimeMeute = null;
    for (const etape of L.ordreDeNuit(vs, etat.tour)) {
      for (const id of etape.roleCle === "meute" ? [etape.acteurIds[0]] : etape.acteurIds) {
        const v = par(id);
        assert.ok(v.vivant, `un mort (${id}) est réveillé`);
        let cibles = [], effet;
        if (etape.roleCle === "meute") { victimeMeute = autreVivant(id, x => x.camp !== "meute"); cibles = [victimeMeute]; }
        else switch (v.role.effet) {
          case "proteger": cibles = [autreVivant(id)]; break;
          case "eclairer": cibles = [autreVivant(id)]; break;
          case "voir-camp": cibles = [autreVivant(id, x => !connus.has(x.id))]; break;
          case "tuer": cibles = [autreVivant(id, x => x.camp !== "meute")]; break;
          case "mordre": cibles = h() < 0.5 ? [victimeMeute] : []; break;
          case "remede": if (victimeMeute && h() < 0.5) cibles = [victimeMeute]; else if (h() < 0.2) { cibles = [autreVivant(id)]; effet = "poison"; } break;
          case "lien-amour": cibles = [autreVivant(id), autreVivant(id)]; break;
          case "asperger": if (etat.asperges.length >= Math.min(2, vivants().length - 1)) effet = "embraser"; else cibles = [autreVivant(id)]; break;
        }
        cibles = cibles.filter(Boolean);
        if (!cibles.length && !effet && v.role.effet !== "mordre" && etape.roleCle !== "meute") continue;   // il passe
        etat = L.ajouterAction(etat, { acteurId: id, roleCle: etape.roleCle, cibles, effet }, etat.nuit.actions.length);
        if (Number(v.role.usages?.max) > 0 && etape.roleCle !== "meute") v.role.usages.restant -= 1;
      }
    }
    // ---- Aube
    etat = L.passerPhase(etat, "aube");
    const r = L.resoudreNuit({ villageois: vs, actions: etat.nuit.actions, tour: etat.tour, asperges: etat.asperges,
      precedentes: etat.nuitPrecedente.actions, hasard: h });
    for (const d of r.deces) {
      assert.ok(par(d.acteurId).vivant, "on ne meurt qu'une fois");
      etat = L.ajouterMort(etat, d);
    }
    vs = L.appliquerResolution(vs, r);
    etat = L.cloreNuit(etat, { asperges: r.asperges });
    if (r.voteDouble) etat.voteDoubleDemain = true;
    for (const rev of r.revelations) connus.add(rev.acteurId);
    for (const m of r.messages) if (m.cle.endsWith("VoirCamp") && m.donnees.camp === "meute") {
      const vise = vs.find(v => v.nom === m.donnees.nom); if (vise) connus.add(vise.id);
    }
    journal.push(`nuit ${etat.tour} : ${r.morts.map(id => par(id).nom).join(", ") || "personne"}`);
    if (verifier()) break;

    // ---- Jour et vote
    etat = L.passerPhase(etat, "jour");
    const candidats = vivants().map(v => v.id);
    etat = L.ouvrirVote(etat, { candidats, maintenant: 0 });
    for (const v of vivants()) {
      const loupConnu = [...connus].find(id => par(id).vivant && id !== v.id);
      const cible = v.camp === "meute" ? autreVivant(v.id, x => x.camp !== "meute") : (loupConnu ?? autreVivant(v.id));
      const res = L.enregistrerVote(etat, { votant: v.id, cible, votants: candidats, maintenant: 1 });
      assert.ok(res.ok, res.raison);
      etat = res.etat;
    }
    const clos = L.cloreVote(etat, { votants: candidats });
    etat = clos.etat;
    for (const elu of clos.resultat.elus) {
      for (const [i, id] of L.cascadeAmour(vs, elu).entries()) {
        if (!par(id).vivant) continue;
        etat = L.ajouterMort(etat, { acteurId: id, cause: i === 0 ? "vote" : "chagrin" });
        vs = vs.map(v => (v.id === id ? { ...v, vivant: false } : v));
      }
    }
    journal.push(`jour ${etat.tour} : ${clos.resultat.elus.map(id => par(id).nom).join(", ") || "personne"}`);
    vs = vs.map(v => ({ ...v, silence: false }));
    if (verifier()) break;
  }
  return { etat, vs, journal };
}

test("partie scénarisée (6 joueurs) : protection, lanterne, exécution, égalité, victoire du village", () => {
  const R = ROLES;
  const mk = (id, role) => ({ id, nom: id, vivant: true, camp: R[role].camp, maison: `Maison ${id}`, amoureux: "", silence: false, protections: 0, role: structuredClone(R[role]) });
  let vs = [mk("l1", "loup"), mk("l2", "loup"), mk("g", "garde"), mk("vl", "veilleuse"), mk("x", "villageois"), mk("y", "villageois")];
  let etat = L.etatInitial();
  const nuit = actions => {
    etat = L.passerPhase(etat, "nuit");
    for (const a of actions) etat = L.ajouterAction(etat, a);
    etat = L.passerPhase(etat, "aube");
    const r = L.resoudreNuit({ villageois: vs, actions: etat.nuit.actions, tour: etat.tour, precedentes: etat.nuitPrecedente.actions });
    for (const d of r.deces) etat = L.ajouterMort(etat, d);
    vs = L.appliquerResolution(vs, r);
    etat = L.cloreNuit(etat, { asperges: r.asperges });
    return r;
  };
  const vote = votes => {
    etat = L.passerPhase(etat, "jour");
    const candidats = vs.filter(v => v.vivant).map(v => v.id);
    etat = L.ouvrirVote(etat, { candidats });
    for (const [votant, cible] of Object.entries(votes)) etat = L.enregistrerVote(etat, { votant, cible, votants: candidats }).etat;
    const c = L.cloreVote(etat, { votants: candidats });
    etat = c.etat;
    if (c.resultat.elu) { etat = L.ajouterMort(etat, { acteurId: c.resultat.elu, cause: "vote" }); vs = vs.map(v => (v.id === c.resultat.elu ? { ...v, vivant: false } : v)); }
    return c.resultat;
  };
  const gagnant = () => L.verifierVictoire({ villageois: vs, morts: etat.morts });

  assert.deepEqual(L.ordreDeNuit(vs, 1).map(e => e.roleCle), ["garde-du-pont", "veilleuse-de-lanterne", "meute"]);
  let r = nuit([{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["x"] }, { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["x"] },
    { acteurId: "l1", roleCle: "meute", cibles: ["x"] }]);
  assert.deepEqual(r.morts, []);
  assert.deepEqual(r.revelations.map(x => x.acteurId), ["l1"]);
  assert.equal(gagnant(), "");
  assert.equal(vote({ g: "l1", vl: "l1", x: "l1", y: "l1", l1: "y", l2: "y" }).elu, "l1");
  assert.equal(gagnant(), "");

  r = nuit([{ acteurId: "g", roleCle: "garde-du-pont", cibles: ["vl"] }, { acteurId: "vl", roleCle: "veilleuse-de-lanterne", cibles: ["y"] },
    { acteurId: "l2", roleCle: "meute", cibles: ["g"] }]);
  assert.deepEqual(r.morts, ["g"]);
  assert.deepEqual(r.revelations, []);
  assert.equal(etat.tour, 2);
  const egal = vote({ vl: "l2", x: "l2", y: "x", l2: "x" });
  assert.equal(egal.elu, null, "égalité : personne");
  assert.equal(gagnant(), "");

  r = nuit([{ acteurId: "l2", roleCle: "meute", cibles: ["x"] }]);
  assert.deepEqual(r.morts, ["x"]);
  assert.equal(gagnant(), "", "un loup contre deux villageois : la partie continue");
  assert.equal(vote({ vl: "l2", y: "l2", l2: "y" }).elu, "l2");
  assert.equal(gagnant(), "village");
  etat = L.declarerVainqueur(etat, gagnant());
  assert.equal(etat.phase, "fin");
  assert.deepEqual(etat.morts.map(m => `${m.acteurId}:${m.cause}:${m.tour}`), ["l1:vote:1", "g:meute:2", "x:meute:3", "l2:vote:3"]);
});

test("partie scénarisée : la meute gagne quand elle égale le village", () => {
  const mk = (id, role) => ({ id, nom: id, vivant: true, camp: ROLES[role].camp, maison: "", amoureux: "", silence: false, protections: 0, role: structuredClone(ROLES[role]) });
  let vs = [mk("l1", "loup"), mk("a", "villageois"), mk("b", "villageois")];
  const r = L.resoudreNuit({ villageois: vs, actions: [{ acteurId: "l1", roleCle: "meute", cibles: ["a"] }] });
  vs = L.appliquerResolution(vs, r);
  assert.equal(L.verifierVictoire({ villageois: vs }), "meute");
});

for (const [nomCompo, compo] of Object.entries(COMPOSITIONS)) {
  test(`parties aléatoires « ${nomCompo} » (${compo.length} joueurs) : toujours une fin, cohérente avec les survivants`, () => {
    const gagnants = {};
    for (let graine = 1; graine <= 60; graine++) {
      const { etat, vs, journal } = jouerPartie(`${nomCompo}-${graine}`, compo);
      assert.ok(etat.vainqueur || vs.every(v => !v.vivant), `partie ${graine} sans fin : ${journal.join(" / ")}`);
      assert.equal(etat.phase, etat.vainqueur ? "fin" : etat.phase);
      const vivants = vs.filter(v => v.vivant);
      const meute = vivants.filter(v => v.camp === "meute").length;
      if (etat.vainqueur === "village") assert.equal(meute, 0);
      if (etat.vainqueur === "meute") assert.ok(meute > 0 && meute >= vivants.length - meute);
      assert.equal(new Set(etat.morts.map(m => m.acteurId)).size, etat.morts.length, "chaque mort une seule fois");
      assert.equal(etat.morts.length, vs.filter(v => !v.vivant).length);
      const k = ["village", "meute"].includes(etat.vainqueur) ? etat.vainqueur : "solitaire/amoureux";
      gagnants[k] = (gagnants[k] ?? 0) + 1;
    }
    assert.ok(gagnants.village > 0, `le village gagne parfois : ${JSON.stringify(gagnants)}`);
    assert.ok(gagnants.meute > 0, `la meute gagne parfois : ${JSON.stringify(gagnants)}`);
  });
}

test("parties aléatoires : même graine, même partie", () => {
  const a = jouerPartie("brume-7", COMPOSITIONS.classique);
  const b = jouerPartie("brume-7", COMPOSITIONS.classique);
  assert.deepEqual(a.journal, b.journal);
  assert.equal(a.etat.vainqueur, b.etat.vainqueur);
});
