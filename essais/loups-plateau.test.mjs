// Le plateau des Veillées : la mise en scène (logique pure : places du cercle, seuils, cimetière, lumière, images), le
// plateau verrouillé et sa mise en scène automatique chez le MJ actif (doublure de Foundry : scène du village, jetons,
// déplacements), les actions au clic chez un joueur (sélection LOCALE, seul le choix validé part au MJ actif), la parole
// des morts et des réduits au silence, et la nouvelle partie avec les mêmes joueurs.
// Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois) : elle doit alors échouer.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, ajouterScene, creerObjetMonde, emissions, reglages, envoyerAuMJ, calme, erreursHooks, journalHooks } from "./doublures/foundry-loups.mjs";
import { PLAN_VILLAGE, PLATEAU_VILLAGE, MAISONS, PLACE, BATIMENTS_CARTE } from "../modules/lakour-veillees/contenu/village.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const NEUTRE = "modules/lakour-veillees/assets/jetons/villageois.svg";
const CIMETIERE = BATIMENTS_CARTE.find(b => b.nom === "Cimetière");

// Les modules du système depuis une racine (l'original, ou une copie mutée).
async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, plateau, local, parole, reglagesM, L, bandeau, infobulle] = await Promise.all([
    m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/plateau.mjs"), m("scripts/plateau-local.mjs"), m("scripts/parole.mjs"),
    m("scripts/reglages.mjs"), m("logique/index.mjs"), m("scripts/apps/bandeau.mjs"), m("scripts/infobulle.mjs")
  ]);
  return { api: api.api, socket, plateau, local, parole, reglages: reglagesM, L, bandeau, infobulle };
}

// ------------------------------------------------------------------ mise en place d'un monde
function monde(M, { contenu = false, joueurs = 6 } = {}) {
  installerFoundry({ joueurs, contenu });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.plateau.oublierPlateau();
  M.plateau.brancherPlateau();
  M.api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
  M.api.plateau.configurer({ jetonNeutre: NEUTRE });
  M.local.remettreAZero();
  delete globalThis.canvas;
  ajouterScene({ nom: "Prologue", active: true });                       // une autre scène est active au départ
  const scene = ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
  const objet = (nom, type, system, img) => {
    const uuid = creerObjetMonde(nom, type, system);
    game.items.get(uuid.split(".")[1]).img = img;
    return uuid;
  };
  const U = {
    loup: objet("Loup de Brumecombe", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }, "jetons/loup.svg"),
    hurleur: objet("Loup hurleur", "role", { cle: "loup-hurleur", camp: "meute", effet: "silence", nuit: { actif: true, ordre: 43 } }, "jetons/hurleur.svg"),
    garde: objet("Garde du pont", "role", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }, "jetons/garde.svg"),
    messager: objet("Messager", "role", { cle: "messager", effet: "messager", nuit: { actif: true, ordre: 10, cibles: 2 } }, "jetons/messager.svg"),
    villageois: objet("Villageois", "role", { cle: "villageois" }, NEUTRE),
    forgeron: objet("Forgeron", "metier", { cle: "forgeron", jour: { actif: true, invite: "Quelle maison verrouiller ?", cibles: 1 }, usages: { max: 1, restant: 1 } }, "jetons/forgeron.svg"),
    meuniere: objet("Meunière", "metier", { cle: "meuniere", jour: { actif: true, invite: "", cibles: 0 }, usages: { max: 1, restant: 1 } }, "jetons/meuniere.svg")
  };
  return { scene, U };
}

const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const acteurDe = cle => villageois().find(a => roleDe(a)?.system.cle === cle);
const jetonsDe = (scene, a) => scene.tokens.filter(t => t.actorId === a.id);
const centre = (M, t) => M.L.versCases(t, { size: 100, sceneX: 0, sceneY: 0 });
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };

async function distribuer(M, U, { compagnons = ["Ysoline", "Barnabé"] } = {}) {
  M.api.resolveurs.compagnon = async () => [];
  const r = await M.api.distribuer({ roles: [U.loup, U.hurleur, U.garde, U.messager, U.villageois, U.villageois, U.villageois, U.villageois],
    metiers: [U.forgeron, U.meuniere], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], compagnons, graine: "plateau", composition: "essai" });
  await M.api.plateau.attendre();
  return r;
}

// Le canevas d'un joueur : les jetons de la scène affichée (assez pour que le plateau sache qu'on peut agir sur la carte).
function canevasDe(scene) {
  globalThis.canvas = { ready: true, tokens: { placeables: scene.tokens.contents.map(t => ({ actor: t.actor, document: t })) } };
}

// Aucun jeton de loup non révélé ne trahit son camp : image neutre, même apparence que les autres, pas d'autre statut.
function aucunLoupMarque(M, scene, phase) {
  for (const a of villageois()) {
    const [t] = jetonsDe(scene, a);
    if (a.system.revele || phase === "fin") continue;
    assert.equal(t.texture.src, NEUTRE, `${a.name} (${roleDe(a).system.cle}) : image ${t.texture.src} avant révélation`);
    const permis = new Set(["dead", "silence"]);
    for (const s of a.statuses) assert.ok(permis.has(s), `${a.name} : statut ${s}`);
    assert.equal(t.alpha, a.system.vivant ? 1 : 0.6);
  }
}

// Les places d'une phase : chez soi (nuit, aube), en cercle sur la place (jour, vote, fin), au cimetière (morts).
function verifierPlaces(M, scene, phase) {
  const vivants = villageois().filter(a => a.system.vivant);
  for (const a of villageois()) {
    const t = jetonsDe(scene, a);
    assert.equal(t.length, 1, `${a.name} : un jeton et un seul`);
    assert.equal(t[0].locked, true, `${a.name} : jeton verrouillé`);
  }
  for (const a of villageois().filter(x => !x.system.vivant)) {
    const c = centre(M, jetonsDe(scene, a)[0]);
    assert.ok(c.x > CIMETIERE.x && c.x < CIMETIERE.x + CIMETIERE.l && c.y > CIMETIERE.y && c.y < CIMETIERE.y + CIMETIERE.h, `${a.name}, mort, au cimetière (${c.x}, ${c.y})`);
  }
  const points = vivants.map(a => centre(M, jetonsDe(scene, a)[0]));
  if (["jour", "vote", "fin"].includes(phase)) {
    for (const p of points) assert.ok(p.x - 0.5 >= PLACE.x && p.x + 0.5 <= PLACE.x + PLACE.l && p.y - 0.5 >= PLACE.y && p.y + 0.5 <= PLACE.y + PLACE.h, `sur la place (${p.x}, ${p.y})`);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= 1 - 1e-6, "deux jetons du cercle se chevauchent");
    }
    // Un cercle : tous à la même distance du centre.
    const d = points.map(p => Math.hypot(p.x - PLATEAU_VILLAGE.cercle.x, p.y - PLATEAU_VILLAGE.cercle.y));
    assert.ok(Math.max(...d) - Math.min(...d) < 0.01, "en cercle");
  } else {
    for (const a of vivants) assert.deepEqual(centre(M, jetonsDe(scene, a)[0]), PLATEAU_VILLAGE.seuils[a.system.maison], `${a.name} devant ${a.system.maison}`);
  }
  assert.equal(scene.environment.darknessLevel, M.L.lumiereDePhase(phase), `lumière de la phase ${phase}`);
  aucunLoupMarque(M, scene, phase);
}

// ------------------------------------------------------------------ la batterie
const VERIFICATIONS = {
  // ---------------- logique pure
  "cercle : 4 à 18 joueurs sur la place, sans chevauchement ni obstacle": M => {
    const p = M.L.lirePlateau(PLAN_VILLAGE);
    for (let n = 4; n <= 18; n++) {
      const places = M.L.placesEnCercle(p, n);
      assert.equal(places.length, n);
      assert.deepEqual(M.L.defautsDuCercle(p, places), [], `${n} joueurs`);
      for (const c of places) {
        assert.ok(c.x - 0.5 >= PLACE.x && c.x + 0.5 <= PLACE.x + PLACE.l && c.y - 0.5 >= PLACE.y && c.y + 0.5 <= PLACE.y + PLACE.h, `${n} : hors de la place`);
        for (const o of BATIMENTS_CARTE.filter(b => ["Gibet", "Puits"].includes(b.nom))) {
          assert.ok(!(c.x - 0.5 < o.x + o.l && o.x < c.x + 0.5 && c.y - 0.5 < o.y + o.h && o.y < c.y + 0.5), `${n} : sur ${o.nom}`);
        }
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(places[i].x - places[j].x, places[i].y - places[j].y) >= 1 - 1e-9, `${n} : chevauchement`);
      const d = places.map(c => Math.hypot(c.x - p.cercle.x, c.y - p.cercle.y));
      assert.ok(Math.max(...d) - Math.min(...d) < 0.01, `${n} : régulier`);
      // Régulier : voisins à égale distance.
      const voisins = places.map((c, i) => Math.hypot(c.x - places[(i + 1) % n].x, c.y - places[(i + 1) % n].y));
      assert.ok(Math.max(...voisins) - Math.min(...voisins) < 0.01, `${n} : écarts réguliers`);
    }
    assert.deepEqual(M.L.defautsDuCercle(p, [{ x: 15, y: 12 }]).length > 0, true, "un jeton sur le Gibet est un défaut");
  },
  "maisons : chaque seuil devant sa maison, sur la carte, libre ; la nuit chacun chez soi": M => {
    const p = M.L.lirePlateau(PLAN_VILLAGE);
    for (const m of MAISONS) {
      const s = M.L.seuilDe(p, m.nom);
      assert.ok(s && s.x > m.x && s.x < m.x + m.l && s.y === m.y + m.h + 0.5, `${m.nom} : seuil sous la porte`);
      for (const e of PLAN_VILLAGE.elements) assert.ok(!(s.x - 0.5 < e.x + e.l && e.x < s.x + 0.5 && s.y - 0.5 < e.y + e.h && e.y < s.y + 0.5), `${m.nom} : seuil sur ${e.nom}`);
    }
    const v = MAISONS.slice(0, 8).map((m, i) => ({ id: `v${i}`, nom: `V${i}`, maison: m.nom, vivant: true }));
    for (const phase of ["preparation", "nuit", "aube"]) {
      const s = M.L.miseEnScene({ plateau: p, phase, villageois: v });
      for (const j of s.jetons) assert.deepEqual({ x: j.x, y: j.y }, M.L.seuilDe(p, v.find(x => x.id === j.id).maison), phase);
      assert.ok(s.jetons.every(j => j.ou === "maison"));
    }
    // Deux dormeurs d'une même maison ne se superposent pas.
    const deux = M.L.miseEnScene({ plateau: p, phase: "nuit", villageois: [{ id: "a", maison: "Maison 1" }, { id: "b", maison: "Maison 1" }] }).jetons;
    assert.notDeepEqual([deux[0].x, deux[0].y], [deux[1].x, deux[1].y]);
  },
  "cimetière : les morts y sont rangés dans l'ordre des morts, sans se superposer": M => {
    const p = M.L.lirePlateau(PLAN_VILLAGE);
    const v = MAISONS.slice(0, 18).map((m, i) => ({ id: `v${i}`, nom: `V${i}`, maison: m.nom, vivant: i % 3 !== 0 }));
    const morts = v.filter(x => !x.vivant).reverse().map((x, i) => ({ acteurId: x.id, tour: i + 1 }));
    for (const phase of ["nuit", "jour", "vote"]) {
      const s = M.L.miseEnScene({ plateau: p, phase, villageois: v, morts });
      const auCimetiere = s.jetons.filter(j => j.mort);
      assert.equal(auCimetiere.length, 6);
      for (const j of auCimetiere) {
        assert.equal(j.ou, "cimetiere");
        assert.ok(j.x > CIMETIERE.x && j.x < CIMETIERE.x + CIMETIERE.l && j.y > CIMETIERE.y && j.y < CIMETIERE.y + CIMETIERE.h);
      }
      assert.equal(new Set(auCimetiere.map(j => `${j.x}:${j.y}`)).size, 6);
      // Le premier mort a la première place.
      const premier = s.jetons.find(j => j.id === morts[0].acteurId);
      assert.deepEqual({ x: premier.x, y: premier.y }, M.L.placeAuCimetiere(p, 0));
      assert.ok(s.jetons.filter(j => !j.mort).every(j => j.ou === (phase === "nuit" ? "maison" : "cercle")));
    }
  },
  "lumière : la nuit s'assombrit, l'aube s'éclaircit, le jour est clair": M => {
    assert.ok(M.L.lumiereDePhase("nuit") >= 0.8);
    assert.ok(M.L.lumiereDePhase("aube") < M.L.lumiereDePhase("nuit") && M.L.lumiereDePhase("aube") > M.L.lumiereDePhase("jour"));
    assert.equal(M.L.lumiereDePhase("jour"), 0);
    assert.equal(M.L.lumiereDePhase("preparation"), 0, "une nouvelle partie commence au jour");
    assert.ok(M.L.lumiereDePhase("vote") < 0.5);
  },
  "images : neutre tant que caché, rôle une fois révélé, tous à la fin": M => {
    assert.equal(M.L.imageDuJeton({ revele: false }, "nuit"), "neutre");
    assert.equal(M.L.imageDuJeton({ revele: false }, "vote"), "neutre");
    assert.equal(M.L.imageDuJeton({ revele: true }, "nuit"), "role");
    assert.equal(M.L.imageDuJeton({ revele: false }, "fin"), "role");
  },
  "sélection : un clic remplace, plusieurs clics s'ajoutent sans dépasser, un non-candidat est ignoré": M => {
    let s = M.L.nouvelleSelection({ id: "d", candidats: ["a", "b", "c"], nombre: 1 });
    assert.equal(M.L.pretAValider(s), false);
    s = M.L.basculer(s, "a"); s = M.L.basculer(s, "b");
    assert.deepEqual(s.choisis, ["b"]);
    s = M.L.basculer(s, "z");
    assert.deepEqual(s.choisis, ["b"]);
    let d = M.L.nouvelleSelection({ id: "d", candidats: ["a", "b", "c"], nombre: 2 });
    for (const id of ["a", "b", "c"]) d = M.L.basculer(d, id);
    assert.deepEqual(d.choisis, ["a", "b"]);
    d = M.L.basculer(d, "a");
    assert.deepEqual(d.choisis, ["b"]);
    assert.equal(M.L.pretAValider(d), true);
  },
  "verrou (logique) : un joueur ne touche ni place ni image d'un villageois ; le MJ si": M => {
    assert.equal(M.L.modificationPermise({ mj: false, villageois: true, changements: { x: 10 } }), false);
    assert.equal(M.L.modificationPermise({ mj: false, villageois: true, changements: { "texture.src": "loup.svg" } }), false);
    assert.equal(M.L.modificationPermise({ mj: false, villageois: true, changements: { locked: false } }), false);
    assert.equal(M.L.modificationPermise({ mj: true, villageois: true, changements: { x: 10 } }), true);
    assert.equal(M.L.modificationPermise({ mj: false, villageois: false, changements: { x: 10 } }), true, "un figurant n'est pas concerné");
  },
  "parole (logique) : mort relayé aux morts, vivant accepté, silence en journée seulement, aucun chuchotement entre joueurs, MJ jamais bloqué": M => {
    const base = { mjs: ["mj"], morts: ["u5", "u6"], canalDesMorts: true };
    const mort = { vivant: false, silence: false }, vivant = { vivant: true, silence: false }, muet = { vivant: true, silence: true };
    assert.deepEqual(M.L.decisionParole({ ...base, moi: vivant, phase: "jour" }), { ok: true });
    assert.deepEqual(M.L.decisionParole({ ...base, moi: mort, phase: "jour", canalDesMorts: false }), { ok: false, raison: "mort" });
    // Le canal des morts : jamais un message de chat (un chuchotement serait livré à tous) ; le relais du MJ actif.
    assert.deepEqual(M.L.decisionParole({ ...base, moi: mort, phase: "nuit" }), { ok: false, relais: "morts" });
    assert.deepEqual(M.L.decisionParole({ ...base, moi: mort, phase: "nuit", chuchote: ["u5"] }), { ok: false, relais: "morts" });
    assert.deepEqual(M.L.destinatairesDuRelais({ ...base, canal: "morts", auteur: "u6", moi: mort }).sort(), ["mj", "u5"], "morts et MJ seulement, jamais l'auteur");
    assert.equal(M.L.destinatairesDuRelais({ ...base, canal: "morts", auteur: "u1", moi: vivant }), null, "un vivant n'écrit pas aux morts");
    assert.equal(M.L.destinatairesDuRelais({ ...base, canal: "morts", auteur: "u6", moi: mort, canalDesMorts: false }), null);
    assert.deepEqual(M.L.destinatairesDuRelais({ ...base, canal: "mj", auteur: "u1", moi: vivant }), ["mj"]);
    assert.deepEqual(M.L.decisionParole({ ...base, moi: mort, phase: "jour", chuchote: ["u1"], canalDesMorts: false }), { ok: false, raison: "mort" }, "un mort ne chuchote pas aux vivants");
    assert.deepEqual(M.L.decisionParole({ ...base, moi: mort, phase: "jour", chuchote: ["mj"], canalDesMorts: false }), { ok: false, relais: "mj" }, "un mort écrit au MJ, relayé");
    for (const phase of ["jour", "vote"]) assert.deepEqual(M.L.decisionParole({ ...base, moi: muet, phase }), { ok: false, raison: "silence" });
    for (const phase of ["nuit", "aube", "preparation"]) assert.deepEqual(M.L.decisionParole({ ...base, moi: muet, phase }), { ok: true }, `silence la ${phase}`);
    assert.deepEqual(M.L.decisionParole({ ...base, moi: muet, phase: "jour", chuchote: ["mj"] }), { ok: false, relais: "mj" });
    // Pendant une partie, aucun chuchotement de joueur : au MJ, relayé ; à un autre joueur, refusé (spectateur compris).
    assert.deepEqual(M.L.decisionParole({ ...base, moi: vivant, phase: "jour", chuchote: ["u2"] }), { ok: false, raison: "chuchotement" });
    assert.deepEqual(M.L.decisionParole({ ...base, moi: null, phase: "nuit", chuchote: ["u2"] }), { ok: false, raison: "chuchotement" });
    assert.deepEqual(M.L.decisionParole({ ...base, moi: vivant, phase: "nuit", chuchote: ["mj"] }), { ok: false, relais: "mj" });
    assert.deepEqual(M.L.decisionParole({ ...base, moi: null, phase: "nuit" }), { ok: true }, "un spectateur parle à tous");
    // Hors partie (rien de distribué, ou partie finie) : le chat est libre.
    for (const moi of [mort, muet, vivant]) assert.deepEqual(M.L.decisionParole({ ...base, moi, phase: "jour", chuchote: ["u2"], enPartie: false }), { ok: true });
    for (const moi of [mort, muet, vivant]) assert.deepEqual(M.L.decisionParole({ ...base, mj: true, moi, phase: "vote", chuchote: ["u2"] }), { ok: true }, "MJ jamais bloqué");
    assert.equal(M.L.messageARetirer({ ...base, moi: mort, phase: "jour", chuchote: ["mj", "u5", "u6"] }), true, "un chuchotement aux morts passé outre est retiré");
    assert.equal(M.L.messageARetirer({ ...base, moi: mort, phase: "jour" }), true);
    assert.equal(M.L.messageARetirer({ ...base, moi: vivant, phase: "jour" }), false);
    assert.equal(M.L.texteDuRelais(`<b>Bou</b>  ${"x".repeat(2000)}`).length, M.L.LONGUEUR_RELAIS);
  },

  // ---------------- le plateau chez le MJ actif (doublure)
  "distribution : un jeton par villageois (compagnons compris), verrouillé, neutre, devant sa maison, scène du village active": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    assert.equal(villageois().length, 8);
    assert.equal(scene.tokens.size, 8);
    assert.ok(scene.active, "la scène du village est activée");
    for (const t of scene.tokens.contents) assert.equal(t.texture.src, NEUTRE);
    verifierPlaces(M, scene, "preparation");
    assert.deepEqual(erreursHooks, []);
  },
  "phases : nuit chez soi et sombre ; vote en cercle ; mort marqué puis au cimetière ; révélé avec l'image de son rôle ; fin": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    await M.api.changerPhase("nuit");
    await M.api.plateau.attendre();
    verifierPlaces(M, scene, "nuit");
    await M.api.changerPhase("aube");
    const victime = acteurDe("garde-du-pont");
    await M.api.eliminer(victime.id, { cause: "meute", reveler: false });
    await M.api.plateau.attendre();
    verifierPlaces(M, scene, "aube");
    assert.ok(victime.statuses.has("dead"), "le mort porte le crâne");
    assert.equal(jetonsDe(scene, victime)[0].alpha, 0.6, "le mort est grisé");
    assert.equal(jetonsDe(scene, victime)[0].texture.src, NEUTRE, "mort sans révélation : rôle caché");
    // Le mort est d'abord marqué sur place, puis marche au cimetière.
    const mvt = scene.journal.mouvements.filter(m => m.id === jetonsDe(scene, victime)[0].id).at(-1);
    assert.equal(mvt.action, "walk");
    assert.equal(mvt.constrainOptions.ignoreWalls, true, "la marche ne s'arrête pas aux murs du bord");
    await M.api.changerPhase("vote");
    await M.api.plateau.attendre();
    verifierPlaces(M, scene, "vote");
    const loup = acteurDe("loup-de-brumecombe");
    await M.api.eliminer(loup.id, { cause: "vote", reveler: true });
    await M.api.plateau.attendre();
    verifierPlaces(M, scene, "vote");
    assert.equal(jetonsDe(scene, loup)[0].texture.src, "jetons/loup.svg", "révélé : l'image de son rôle");
    const hurleur = acteurDe("loup-hurleur");
    assert.equal(jetonsDe(scene, hurleur)[0].texture.src, NEUTRE, "l'autre loup reste caché");
    // Un mort déclaré à la main (fiche, Table de jeu) : le crâne vient aussi.
    const autre = acteurDe("messager");
    await autre.update({ "system.vivant": false });
    await M.api.plateau.attendre();
    assert.ok(autre.statuses.has("dead"), "le crâne suit l'état du villageois");
    // Le dernier loup tombe : la victoire du village passe en « fin », et tous les rôles se révèlent.
    await M.api.eliminer(hurleur.id, { cause: "vote" });
    assert.equal(await M.api.verifierVictoire(), "village");
    await M.api.plateau.attendre();
    verifierPlaces(M, scene, "fin");
    for (const a of villageois()) assert.equal(jetonsDe(scene, a)[0].texture.src, roleDe(a).img, `${a.name} : révélé à la fin`);
    // Toutes les mises en scène sont faites par le MJ, par des déplacements marchés.
    assert.ok(scene.journal.mouvements.length > 0 && scene.journal.mouvements.every(m => m.action === "walk"));
    assert.deepEqual(erreursHooks, []);
  },
  "silence : une icône publique, retirée à la nuit": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    const cible = acteurDe("villageois");
    await M.api.reduireAuSilence(cible.id);
    await M.api.plateau.attendre();
    assert.ok(cible.statuses.has("silence"));
    await M.api.changerPhase("nuit");
    await M.api.plateau.attendre();
    assert.ok(!cible.statuses.has("silence"));
    assert.equal(scene.tokens.size, 8);
  },
  "verrou : un joueur ne déplace pas son jeton (ni ne le déverrouille), le MJ si": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    const moi = villageois().find(a => a.system.joueur === "u1");
    const [t] = jetonsDe(scene, moi);
    const avant = { x: t.x, y: t.y };
    commeJoueur("u1");
    await scene.updateEmbeddedDocuments("Token", [{ _id: t.id, x: avant.x + 300, y: avant.y }]);
    await scene.updateEmbeddedDocuments("Token", [{ _id: t.id, locked: false }]);
    await scene.updateEmbeddedDocuments("Token", [{ _id: t.id, "texture.src": "jetons/loup.svg" }]);
    await scene.moveTokens({ [t.id]: { destination: { x: 0, y: 0 } } });
    assert.deepEqual({ x: t.x, y: t.y }, avant, "le joueur n'a pas bougé son jeton");
    assert.equal(t.locked, true);
    assert.equal(t.texture.src, NEUTRE);
    commeMJ();
    await scene.moveTokens({ [t.id]: { destination: { x: 100, y: 100 } } });
    assert.deepEqual({ x: t.x, y: t.y }, { x: 100, y: 100 }, "le MJ peut");
    await M.api.plateau.mettreEnScene();
    assert.deepEqual({ x: t.x, y: t.y }, avant, "la mise en scène le remet à sa place");
  },
  "choix de nuit au clic : sélection locale, rien n'est écrit, la validation part au MJ seul": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    await M.api.changerPhase("nuit");
    await M.api.plateau.attendre();
    const garde = acteurDe("garde-du-pont"), joueur = garde.system.joueur;
    const candidats = villageois().filter(a => a.id !== garde.id).slice(0, 4).map(a => a.id);
    const n = emissions.length;
    const choix = M.api.demanderAction({ acteurId: garde.id, candidats, nombre: 1, delai: 3000 });
    const demande = emissions.slice(n).find(e => e.type === "demande");
    assert.deepEqual(demande.recipients, [joueur]);
    // Chez le joueur.
    commeJoueur(joueur);
    canevasDe(scene);
    const { recipients, canal, ...message } = demande;
    M.socket.traiterMessage(message, "mj");
    assert.equal(M.local.modeActif(), "nuit");
    const partie = JSON.stringify(reglages.get("lakour-loups.partie").valeur);
    const majs = scene.journal.majs.length, nEmis = emissions.length;
    assert.equal(M.local.decorDe(candidats[0]).candidat, true, "candidat allumé");
    assert.equal(M.local.decorDe(garde.id).candidat, false, "un non-candidat reste éteint");
    assert.equal(M.local.cliquer(garde.id), false, "un clic hors des candidats ne sert pas");
    assert.equal(M.local.cliquer(candidats[0]), true);
    assert.equal(M.local.cliquer(candidats[1]), true);
    assert.equal(M.local.decorDe(candidats[1]).choisi, true, "sélection visible");
    assert.equal(M.local.decorDe(candidats[0]).choisi, false, "une seule cible : le second clic remplace");
    assert.equal(emissions.length, nEmis, "rien n'est envoyé pendant la sélection");
    assert.equal(scene.journal.majs.length, majs, "aucun document modifié");
    assert.equal(JSON.stringify(reglages.get("lakour-loups.partie").valeur), partie, "aucun réglage monde modifié");
    const ctx = M.bandeau.contexteBandeau();
    assert.ok(ctx.boutons.some(b => b.action === "bandeauValider") && ctx.boutons.some(b => b.action === "bandeauPasser"));
    assert.equal(M.local.valider(), true);
    const reponse = emissions.slice(nEmis);
    assert.equal(reponse.length, 1);
    assert.equal(reponse[0].type, "reponse");
    assert.deepEqual(reponse[0].recipients, ["mj"], "au MJ actif seul");
    assert.deepEqual(reponse[0].cibles, [candidats[1]]);
    assert.equal(M.local.modeActif(), "", "la carte s'éteint");
    // Le MJ reçoit (émetteur vérifié par le serveur).
    commeMJ();
    delete globalThis.canvas;
    const { recipients: r2, canal: c2, ...rep } = reponse[0];
    envoyerAuMJ(CANAL, rep, { emetteur: joueur });
    await calme();
    assert.deepEqual(await choix, [candidats[1]]);
  },
  "plusieurs cibles au clic (Messager) ; « Passer » rend un choix vide": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    await M.api.changerPhase("nuit");
    const messager = acteurDe("messager"), joueur = messager.system.joueur;
    const ids = villageois().map(a => a.id).filter(id => id !== messager.id);
    const n = emissions.length;
    M.api.demanderAction({ acteurId: messager.id, candidats: ids, nombre: 2, delai: 3000 });
    const { recipients, canal, ...demande } = emissions.slice(n).find(e => e.type === "demande");
    commeJoueur(joueur);
    canevasDe(scene);
    M.socket.traiterMessage(demande, "mj");
    for (const id of ids.slice(0, 3)) M.local.cliquer(id);
    assert.deepEqual(M.local.etatLocal().selection.choisis, ids.slice(0, 2), "pas plus que le nombre demandé");
    const m = emissions.length;
    M.local.valider();
    assert.deepEqual(emissions.slice(m).map(e => [e.type, e.cibles, e.recipients]), [["reponse", ids.slice(0, 2), ["mj"]]]);
    commeMJ();
    { const { recipients: r0, canal: c0, ...rep0 } = emissions[m]; envoyerAuMJ(CANAL, rep0, { emetteur: joueur }); await calme(); }
    const n2 = emissions.length;
    M.api.demanderAction({ acteurId: messager.id, candidats: ids, nombre: 1, delai: 3000 });
    const { recipients: r, canal: c, ...d2 } = emissions.slice(n2).find(e => e.type === "demande");
    commeJoueur(joueur);
    M.socket.traiterMessage(d2, "mj");
    M.local.cliquer(ids[0]);
    const m2 = emissions.length;
    M.local.passer();
    assert.deepEqual(emissions.slice(m2).map(e => [e.type, e.cibles, e.recipients]), [["reponse", [], ["mj"]]]);
    commeMJ();
    { const { recipients: r0, canal: c0, ...rep0 } = emissions[m2]; envoyerAuMJ(CANAL, rep0, { emetteur: joueur }); await calme(); }
  },
  "vote au clic : on accuse, on change d'avis, on s'abstient ; un mort ne vote ni n'agit": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    const mort = villageois().find(a => a.system.joueur === "u6");
    await M.api.eliminer(mort.id, { cause: "narrateur" });
    await M.api.changerPhase("vote");
    await M.api.ouvrirVote({});
    await M.api.plateau.attendre();
    const vivant = villageois().find(a => a.system.joueur === "u1");
    const [x, y] = villageois().filter(a => a.system.vivant && a.id !== vivant.id).map(a => a.id);
    commeJoueur("u1");
    canevasDe(scene);
    assert.equal(M.local.modeActif(), "vote");
    const n = emissions.length;
    assert.equal(M.local.cliquer(mort.id), false, "un mort n'est pas candidat");
    assert.equal(M.local.cliquer(x), true);
    assert.equal(M.local.decorDe(x).monVote, true, "son choix, chez lui");
    assert.equal(M.local.cliquer(y), true);
    assert.equal(M.local.decorDe(x).monVote, false);
    assert.equal(M.local.decorDe(y).monVote, true, "il change d'avis");
    M.local.abstenir();
    const votes = emissions.slice(n);
    assert.deepEqual(votes.map(e => [e.type, e.cible, e.recipients]), [["vote", x, ["mj"]], ["vote", y, ["mj"]], ["vote", "", ["mj"]]]);
    assert.equal(scene.journal.majs.filter(m => m.user === "u1").length, 0, "aucun document modifié par le joueur");
    // Un mort : aucun clic accepté, rien n'est envoyé ; le bandeau le lui dit.
    commeJoueur("u6");
    const m = emissions.length;
    assert.equal(M.local.modeActif(), "");
    assert.equal(M.local.accepteClic(x), false);
    assert.equal(M.local.cliquer(x), false);
    assert.equal(M.local.abstenir(), false);
    assert.equal(emissions.length, m);
    assert.equal(M.bandeau.contexteBandeau().statut?.cle, "mort");
    // Et s'il passait outre (socket forgé), le MJ refuse.
    commeMJ();
    delete globalThis.canvas;
    envoyerAuMJ(CANAL, { type: "vote", votant: mort.id, cible: x, userId: "u6" }, { emetteur: "u6" });
    await calme();
    assert.ok(!M.api.etat().vote.exprimes.includes(mort.id), "un mort ne vote pas");
    // La clôture : les voix publiques en bulles au-dessus des jetons, chez chacun.
    envoyerAuMJ(CANAL, { type: "vote", votant: vivant.id, cible: x, userId: "u1" }, { emetteur: "u1" });
    await calme();
    const r = await M.api.cloreVote();
    M.local.montrerBulles(r.decompte);
    assert.equal(M.local.decorDe(x).bulle, 1);
  },
  "un mort n'est plus réveillé la nuit, ni n'use d'un pouvoir de jour": async M => {
    const { U } = monde(M);
    await distribuer(M, U);
    const garde = acteurDe("garde-du-pont");
    await M.api.eliminer(garde.id, { cause: "narrateur" });
    await M.api.changerPhase("nuit");
    const n = emissions.length;
    assert.deepEqual(await M.api.demanderAction({ acteurId: garde.id, nombre: 1, delai: 1000 }), []);
    assert.equal(await M.api.demanderTexte({ acteurId: garde.id, delai: 1000 }), "");
    assert.equal(emissions.slice(n).filter(e => e.type === "demande").length, 0, "aucune demande à un mort");
    // Un compagnon IA mort non plus : son résolveur n'est pas appelé.
    const compagnon = villageois().find(a => a.system.compagnon);
    await M.api.eliminer(compagnon.id, { cause: "narrateur" });
    let appele = false;
    M.api.resolveurs.compagnon = async () => { appele = true; return [garde.id]; };
    assert.deepEqual(await M.api.demanderAction({ acteurId: compagnon.id, nombre: 1, delai: 1000 }), []);
    assert.equal(appele, false);
    await M.api.changerPhase("jour");
    const forgeron = villageois().find(a => a.items.find(i => i.type === "metier")?.system.cle === "forgeron" && a.system.vivant && a.system.joueur);
    await M.api.eliminer(forgeron.id, { cause: "narrateur" });
    await assert.rejects(() => M.api.agirDeJour({ acteurId: forgeron.id, pouvoir: "forgeron", cibles: [forgeron.id] }));
  },
  "parole (Foundry) : message d'un mort refusé ou rendu aux morts, vivant accepté, muet bloqué de jour, MJ jamais, garde du MJ": async M => {
    const { U } = monde(M);
    await distribuer(M, U);
    const avis = [];
    ui.notifications.warn = t => avis.push(t);
    const mort = villageois().find(a => a.system.joueur === "u6");
    const muet = villageois().find(a => a.system.joueur === "u5");
    await M.api.eliminer(mort.id, { cause: "narrateur" });
    // Un second mort (hors meute, pour que la partie continue) : le canal des morts a un destinataire.
    const second = villageois().find(a => a.system.vivant && a.system.joueur && !["u1", "u5", "u6"].includes(a.system.joueur) && secretDuMJ.camp(a) !== "meute");
    await M.api.eliminer(second.id, { cause: "narrateur" });
    await M.api.reduireAuSilence(muet.id);
    const message = (whisper = [], content = "Je sais qui c'est.") => ({ whisper, content, maj: null, updateSource(c) { this.maj = c; if (c.whisper) this.whisper = c.whisper; } });
    // Ce qu'affiche chaque navigateur (localement, aucun document) : ui.chat.postOne d'un message jamais créé.
    const affiches = [];
    ui.chat = { postOne: m => { affiches.push({ chez: game.user.id, contenu: m.content }); } };
    globalThis.ChatMessage.implementation = Object.assign(class { constructor(d) { Object.assign(this, d); } }, { create: globalThis.ChatMessage.implementation.create });
    await M.api.changerPhase("jour");
    commeJoueur("u1");
    assert.equal(M.parole.avantMessage(message(), {}, {}, "u1"), undefined, "un vivant parle");
    commeJoueur("u6");
    const n = emissions.length;
    assert.equal(M.parole.avantMessage(message([], "CANARI-DES-MORTS"), {}, {}, "u6"), false, "un mort : aucun message de chat (relayé)");
    const envoi = emissions.slice(n).find(e => e.type === "paroleEnvoi");
    assert.deepEqual(envoi?.recipients, ["mj"], "au MJ actif seul");
    assert.ok(affiches.some(a => a.chez === "u6" && a.contenu.includes("CANARI-DES-MORTS")), "affiché chez son auteur");
    // Le MJ actif relaie : aux seuls morts (et MJ), jamais à un vivant, jamais par le chat.
    commeMJ();
    const m0 = emissions.length;
    assert.equal(M.socket.traiterMessage({ type: "paroleEnvoi", texte: "CANARI-DES-MORTS", canal: "morts", userId: "u6" }, "u6"), true);
    const relais = emissions.slice(m0).filter(e => e.type === "parole");
    assert.equal(relais.length, 1);
    const morts = villageois().filter(a => !a.system.vivant).map(a => a.system.joueur).filter(u => u !== "u6");
    assert.deepEqual([...relais[0].recipients].sort(), morts.sort(), "aux seuls autres morts");
    assert.ok(affiches.some(a => a.chez === "mj" && a.contenu.includes("CANARI-DES-MORTS")), "le MJ le lit");
    // Un vivant qui se fait passer pour le canal des morts : refusé (l'émetteur du serveur fait foi).
    assert.equal(M.socket.traiterMessage({ type: "paroleEnvoi", texte: "triche", canal: "morts", userId: "u1" }, "u1"), false);
    assert.equal(M.socket.traiterMessage({ type: "paroleEnvoi", texte: "triche", canal: "morts", userId: "u6" }, "u1"), false);
    assert.equal(M.socket.traiterMessage({ type: "paroleEnvoi", texte: "triche", canal: "morts", userId: "u6" }), false, "sans émetteur donné par le serveur : rien");
    // L'émetteur du serveur suffit (la déclaration userId n'est jamais ce qui compte) : relayé au nom de u6.
    const mSansDeclaration = emissions.length;
    assert.equal(M.socket.traiterMessage({ type: "paroleEnvoi", texte: "CANARI-SANS-DECLARATION", canal: "morts" }, "u6"), true, "relayé d'après l'émetteur");
    assert.equal(emissions.slice(mSansDeclaration).filter(e => e.type === "parole").length, 1);
    // Chez un destinataire : le mot relayé ne vient que du MJ actif.
    commeJoueur(morts[0] ?? "u6");
    assert.equal(M.socket.traiterMessage({ type: "parole", canal: "morts", nom: "x", texte: "faux" }, "u1"), false, "d'un joueur : refusé");
    game.users.set("assist", { id: "assist", name: "Assistant", isGM: true, active: true });
    assert.equal(M.socket.traiterMessage({ type: "parole", canal: "morts", nom: "x", texte: "faux" }, "assist"), false, "d'un MJ qui n'est pas l'actif : refusé");
    game.users.delete("assist");
    commeJoueur("u6");
    await game.settings.set("lakour-loups", "canalDesMorts", false);
    assert.equal(M.parole.avantMessage(message(), {}, {}, "u6"), false, "sans canal : refusé");
    assert.ok(avis.length >= 1, "un avis dit pourquoi");
    const m1 = emissions.length;
    assert.equal(M.parole.avantMessage(message(["mj"]), {}, {}, "u6"), false, "au MJ : relayé, pas chuchoté");
    assert.deepEqual(emissions.slice(m1).find(e => e.type === "paroleEnvoi")?.recipients, ["mj"]);
    // Un chuchotement de joueur à joueur, pendant la partie : refusé.
    commeJoueur("u1");
    const m2 = emissions.length;
    assert.equal(M.parole.avantMessage(message(["u2"]), {}, {}, "u1"), false, "joueur à joueur : refusé");
    assert.equal(emissions.slice(m2).filter(e => e.type === "paroleEnvoi").length, 0);
    commeJoueur("u5");
    assert.equal(M.parole.avantMessage(message(), {}, {}, "u5"), false, "réduit au silence pendant le débat");
    commeMJ();
    await M.api.changerPhase("vote");
    commeJoueur("u5");
    assert.equal(M.parole.avantMessage(message(), {}, {}, "u5"), false, "et pendant le vote");
    commeMJ();
    assert.equal(M.parole.avantMessage(message(), {}, {}, "mj"), undefined, "le MJ n'est jamais bloqué");
    // La garde du MJ actif : un message public d'un mort, passé outre, est retiré ; celui d'un vivant reste.
    let retire = 0;
    const envoye = (auteur, whisper = []) => ({ author: game.users.get(auteur), whisper, async delete() { retire++; } });
    assert.equal(await M.parole.gardeMessage(envoye("u6")), true);
    assert.equal(await M.parole.gardeMessage(envoye("u1")), false);
    assert.equal(await M.parole.gardeMessage(envoye("mj")), false);
    assert.equal(retire, 1);
    assert.ok(emissions.some(e => e.type === "avis" && e.recipients?.[0] === "u6"), "l'auteur est prévenu, lui seul");
    // La nuit, le muet parle de nouveau (son silence ne vaut que pour le débat et le vote du jour).
    await game.settings.set("lakour-loups", "canalDesMorts", true);
    await M.api.changerPhase("nuit");
    await muet.update({ "system.silence": true });
    commeJoueur("u5");
    assert.equal(M.parole.avantMessage(message(), {}, {}, "u5"), undefined);
    commeMJ();
    delete ui.chat;
  },
  "bandeau : phase, tour, minuteur, « Mon rôle », action du moment, pouvoir de jour, mort et silence": async M => {
    const { scene, U } = monde(M);
    await distribuer(M, U);
    await M.api.changerPhase("nuit");
    // La nuit, aucun pouvoir de jour ne sert : ceux du rôle et du métier restent visibles, grisés, avec la raison.
    let grises = 0;
    for (const a of villageois().filter(x => x.system.joueur)) {
      commeJoueur(a.system.joueur);
      canevasDe(scene);
      const possedes = M.api.pouvoirsDeJour(a.id).filter(p => ["role", "metier"].includes(p.source)).map(p => p.pouvoir);
      const montres = M.bandeau.contexteBandeau().pouvoirs;
      assert.deepEqual(montres.filter(p => possedes.includes(p.pouvoir)).map(p => p.pouvoir), possedes, `${a.name} : rôle et métier montrés`);
      for (const p of montres.filter(x => !x.possible)) { assert.ok(p.raison, `${a.name} : raison du grisé`); grises++; }
      // L'infobulle dit ce que fait le pouvoir : la règle de la carte, sans ouvrir le compendium.
      for (const p of montres.filter(x => possedes.includes(x.pouvoir))) {
        const objet = a.items.find(i => i.type === M.api.pouvoirsDeJour(a.id).find(x => x.pouvoir === p.pouvoir).source);
        objet.system.description = `<p>Une ambiance.</p><p><strong>Règle</strong> de ${objet.name} &amp; co.</p>`;
        const aide = M.bandeau.contexteBandeau().pouvoirs.find(x => x.pouvoir === p.pouvoir).aide;
        assert.ok(aide.endsWith(`Une ambiance. Règle de ${objet.name} & co.`), `${a.name} : l'infobulle de ${p.pouvoir} reprend sa description, en texte`);
      }
      commeMJ();
      delete globalThis.canvas;
    }
    assert.ok(grises > 0, "au moins un pouvoir grisé la nuit");
    await M.api.changerPhase("jour");
    commeJoueur("u1");
    canevasDe(scene);
    let ctx = M.bandeau.contexteBandeau();
    assert.equal(ctx.phase, "jour");
    assert.equal(ctx.tour, 1);
    assert.equal(ctx.monRole, true);
    const moi = villageois().find(a => a.system.joueur === "u1");
    const metier = moi.items.find(i => i.type === "metier").system.cle;
    if (metier === "forgeron") {
      assert.ok(ctx.pouvoirs.some(p => p.pouvoir === "forgeron" && /Utiliser : Forgeron/.test(p.libelle)));
      await M.local.commencerPouvoir("forgeron");
      assert.equal(M.local.modeActif(), "jour");
      const cible = villageois().find(a => a.id !== moi.id).id;
      const n = emissions.length;
      M.local.cliquer(cible);
      assert.equal(emissions.length, n, "la cible est choisie chez soi");
      M.local.valider();
      assert.deepEqual(emissions.slice(n).map(e => [e.type, e.pouvoir, e.cibles, e.recipients]), [["jour", "forgeron", [cible], ["mj"]]]);
    }
    // Rôle et métier : leurs pouvoirs de jour sont toujours là, actifs ou grisés avec la raison.
    for (const p of ctx.pouvoirs) {
      assert.ok(p.icone && typeof p.possible === "boolean", `pouvoir ${p.pouvoir} : icône et état`);
      assert.ok(p.possible || p.raison, `pouvoir ${p.pouvoir} grisé : la raison est donnée`);
    }
    const possedes = M.api.pouvoirsDeJour(moi.id).filter(p => ["role", "metier"].includes(p.source));
    assert.deepEqual(ctx.pouvoirs.map(p => p.pouvoir).filter(x => possedes.some(p => p.pouvoir === x)), possedes.map(p => p.pouvoir),
      "chaque pouvoir de rôle ou de métier a son bouton");
    commeMJ();
    delete globalThis.canvas;
    assert.ok(M.bandeau.contexteBandeau().boutons.some(b => b.action === "bandeauOuvrirVote"), "le MJ ouvre le vote depuis le bandeau");
    await M.api.ouvrirVote({ duree: 90 });
    const mj = M.bandeau.contexteBandeau();
    assert.ok(mj.boutons.some(b => b.action === "bandeauCloreVote") && mj.finit > Date.now(), "le MJ clôt le vote et voit le temps");
    assert.match(mj.detail, /\//, "le MJ voit le décompte des voix");
    commeJoueur("u1");
    canevasDe(scene);
    ctx = M.bandeau.contexteBandeau();
    assert.ok(ctx.finit > Date.now(), "le minuteur du vote");
    assert.match(ctx.consigne, /Vote/);
    assert.ok(ctx.boutons.some(b => b.action === "bandeauVoter") && ctx.boutons.some(b => b.action === "bandeauAbstenir"), "Voter et s'abstenir");
    assert.ok(!ctx.boutons.some(b => b.action === "bandeauCloreVote"), "un joueur ne clôt pas le vote");
    for (const b of [...ctx.boutons, ...mj.boutons]) assert.ok(b.aide && !b.aide.startsWith("LAKOUR_LOUPS"), `infobulle du bouton ${b.action}`);
    commeMJ();
    await M.api.reduireAuSilence(moi.id);
    commeJoueur("u1");
    assert.equal(M.bandeau.contexteBandeau().statut?.cle, "silence");
    commeMJ();
  },
  "infobulle : nom, métier, état ; rôle seulement s'il est révélé (ou le sien)": async M => {
    const { U } = monde(M);
    await distribuer(M, U);
    const loup = acteurDe("loup-de-brumecombe");
    commeJoueur(villageois().find(a => a.id !== loup.id && a.system.joueur && secretDuMJ.camp(roleDe(a)) !== "meute").system.joueur);
    let c = M.infobulle.contenuInfobulle(loup);
    assert.equal(c.nom, loup.name);
    assert.equal(c.role, "", "rôle caché");
    commeMJ();
    await M.api.eliminer(loup.id, { cause: "vote", reveler: true });
    commeJoueur("u1");
    c = M.infobulle.contenuInfobulle(loup);
    assert.match(c.role, /Loup de Brumecombe/);
    assert.ok(c.etats.some(e => e.cle === "mort"));
    commeMJ();
  },
  "nouvelle partie : mêmes joueurs et compagnons, tout remis à zéro, aucun secret ne survit, jetons replacés, autre composition": async M => {
    installerFoundry({ joueurs: 4, contenu: true });
    M.reglages.enregistrerReglages(() => {});
    M.socket.ecouterSocket();
    game.lakourLoups = M.api;
    M.plateau.oublierPlateau();
    M.plateau.brancherPlateau();
    M.api.plateau.reglerDelais({ regroupement: 0, marque: 0, animation: 0, lumiere: 0 });
    M.api.plateau.configurer({ jetonNeutre: NEUTRE });
    const scene = ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE, active: true });
    M.api.resolveurs.compagnon = async () => [];
    // Une première partie (4 humains, 3 compagnons), jouée un peu, puis finie.
    const premiere = await M.api.distribuer({
      roles: [...(await game.packs.get("lakour-veillees.roles").getIndex({ fields: ["system.cle"] })).values()].filter(e => ["loup-de-brumecombe", "villageois", "veilleuse-de-lanterne", "herboriste", "garde-du-pont"].includes(e.system.cle)).map(e => e.uuid).concat([]),
      metiers: [...(await game.packs.get("lakour-veillees.metiers").getIndex()).values()].map(e => e.uuid),
      joueurs: ["u1", "u2", "u3", "u4"], compagnons: ["Ysoline", "Barnabé", "Gaspard"], graine: "premiere", composition: "essai"
    });
    await M.api.plateau.attendre();
    const anciens = { ids: villageois().map(a => a.id).sort(), compagnons: villageois().filter(a => a.system.compagnon).map(a => [a.id, a.name]).sort(),
      roles: villageois().map(a => roleDe(a).system.cle).sort(), partie: M.api.etat().partie };
    await M.api.changerPhase("nuit");
    const [a1, a2] = villageois();
    await M.api.noterAction({ acteurId: a1.id, cibles: [a2.id] });
    await M.api.envoyerSecret(a2.id, "SECRET-DE-L-ANCIENNE-PARTIE");
    await M.api.changerPhase("aube");
    await M.api.eliminer(a2.id, { cause: "meute" });
    await M.api.reduireAuSilence(villageois()[2].id);
    await M.api.changerPhase("vote");
    await M.api.ouvrirVote({});
    await M.api.changerPhase("nuit");
    let clos = false;
    const enSuspens = M.api.demanderAction({ acteurId: villageois().find(a => a.system.vivant && a.system.joueur).id, nombre: 1, delai: 3000 });
    enSuspens.then(() => { clos = true; });
    const nHooks = journalHooks.length, nEmis = emissions.length;
    // Rejouer.
    const r = await M.api.nouvellePartie({ graine: "seconde" });
    await M.api.plateau.attendre();
    assert.equal(clos, true, "la demande de l'ancienne partie est close");
    assert.deepEqual(await enSuspens, []);
    assert.ok(emissions.slice(nEmis).some(e => e.type === "annuler"), "chez son joueur");
    assert.deepEqual(r.joueurs.map(j => j.userId).sort(), ["u1", "u2", "u3", "u4"], "les mêmes joueurs");
    assert.equal(r.compagnons.length, 3, "le même nombre de compagnons");
    assert.deepEqual(villageois().filter(a => a.system.compagnon).map(a => [a.id, a.name]).sort(), anciens.compagnons, "les mêmes compagnons, mêmes noms");
    assert.deepEqual(villageois().map(a => a.id).sort(), anciens.ids, "les villageois sont recyclés");
    const e = M.api.etat();
    assert.notEqual(e.partie, anciens.partie);
    assert.equal(e.phase, "preparation");
    assert.equal(e.tour, 0);
    assert.deepEqual([e.morts, e.nuit.actions, e.nuitPrecedente.actions, e.cimetiere, e.vote.ouvert], [[], [], [], [], false]);
    for (const a of villageois()) {
      assert.equal(a.system.vivant, true);
      assert.equal(a.system.revele, false);
      assert.equal(a.system.silence, false);
      // Le rôle neuf : dans les secrets du MJ ; l'objet révélé de l'ancienne partie a quitté le document.
      assert.equal(a.items.filter(i => i.type === "role").length, 0);
      assert.ok(secretDuMJ.role(a), `${a.name} : un rôle (secrets du MJ)`);
      assert.equal(a.system.camp, "");
      assert.equal(a.items.filter(i => i.type === "metier").length, 1);
      assert.ok(!a.statuses.has("dead") && !a.statuses.has("silence"));
    }
    const tout = JSON.stringify([reglages.get("lakour-loups.partie").valeur, reglages.get("lakour-loups.secrets").valeur]);
    assert.ok(!tout.includes("SECRET-DE-L-ANCIENNE-PARTIE"), "aucun secret de l'ancienne partie ne survit");
    assert.ok(!e.historique.some(h => /Mort|vote/i.test(h.texte) && h.tour > 0), "l'ancienne chronique est effacée");
    verifierPlaces(M, scene, "preparation");
    assert.equal(scene.tokens.size, 7);
    for (const t of scene.tokens.contents) assert.equal(t.alpha, 1);
    // Une composition équilibrée générée, différente de la précédente.
    assert.equal(r.composition.cle, "generee");
    assert.equal(r.composition.roles.length, 7);
    assert.notDeepEqual([...r.composition.roles].sort(), anciens.roles, "une autre composition");
    assert.deepEqual(villageois().map(a => roleDe(a).system.cle).sort(), [...r.composition.roles].sort());
    // Le hook : chez tous, sans qui-a-quoi.
    const h = emissions.slice(nEmis).find(x => x.type === "hook" && x.nom === "lakourLoups.nouvellePartie");
    assert.ok(h, "hook diffusé");
    // La composition n'est jamais annoncée aux joueurs.
    assert.deepEqual(Object.keys(h.args[0]).sort(), ["compagnons", "joueurs", "partie"]);
    assert.equal(h.args[0].joueurs, 4);
    assert.ok(!JSON.stringify(h.args).includes("acteurId"));
    assert.ok(journalHooks.slice(nHooks).some(x => x.nom === "lakourLoups.nouvellePartie"));
    // Rejouer encore, même graine : l'historique fait varier la composition.
    const rBis = await M.api.nouvellePartie({ graine: "seconde" });
    assert.notDeepEqual([...rBis.composition.roles].sort(), [...r.composition.roles].sort(), "l'historique fait varier la composition");
    // Une composition donnée (liste de rôles) est respectée.
    const r2 = await M.api.nouvellePartie({ roles: ["loup-de-brumecombe", "loup-de-brumecombe", "Herboriste"] });
    assert.deepEqual([...r2.composition.roles].sort(), ["herboriste", "loup-de-brumecombe", "loup-de-brumecombe", "villageois", "villageois", "villageois", "villageois"]);
    assert.deepEqual(erreursHooks, []);
  }
};

// ------------------------------------------------------------------ mutations
// [fichier (relatif au système), avant, après, règle]
const MUTATIONS = [
  ["scripts/api.mjs", "description: descriptionDuPouvoir(p.pouvoir, acteur), ", "", "description du pouvoir dans l'infobulle"],
  ["scripts/apps/bandeau.mjs", "bouton(\"bandeauVoter\", t(\"LAKOUR_LOUPS.Bandeau.Voter\"), \"fa-check-to-slot\", { principal: !monChoix });", "", "bouton Voter du bandeau"],
  ["scripts/apps/bandeau.mjs", "if (gm && v.ouvert) bouton(", "if (false) bouton(", "le MJ clôt le vote depuis le bandeau"],
  ["scripts/apps/bandeau.mjs", ".filter(p => p.possible || ([\"role\", \"metier\"].includes(p.source) && ![\"absent\", \"inconnu\", \"mort\"].includes(p.raison)))", ".filter(p => p.possible)", "rôle et métier grisés, pas cachés"],
  ["logique/plateau.mjs", "const cercle = PHASES_DU_CERCLE.includes(phase);", "const cercle = false;", "cercle sur la place"],
  ["logique/plateau.mjs", "const rayons = [voulu, ...[c.rayon, c.rayonMin, (c.rayon + c.rayonMin) / 2].filter(r => r !== voulu)];", "const rayons = [c.rayon * 1.6];", "cercle dans la place"],
  ["logique/plateau.mjs", "if (!d) return places;", "return disposer(c, total, c.rayonMin * 0.4, 0);", "cercle sans chevauchement"],
  ["logique/plateau.mjs", "nuit: 0.85", "nuit: 0", "nuit sombre"],
  ["logique/plateau.mjs", "if (v.vivant === false) {", "if (false) {", "morts au cimetière"],
  ["logique/plateau.mjs", "(v?.revele || phase === \"fin\" ? \"role\" : \"neutre\")", "\"role\"", "image neutre avant révélation"],
  ["logique/plateau.mjs", "if (mj || !villageois) return true;", "return true;", "verrou des jetons"],
  ["logique/plateau.mjs", "return { x: s.x + n, y: s.y };", "return { x: s.x, y: s.y + 3 };", "devant sa maison"],
  ["logique/selection.mjs", "else if (choisis.length < sel.nombre) choisis.push(acteurId);", "else choisis.push(acteurId);", "nombre de cibles"],
  ["logique/selection.mjs", "if (!estCandidat(sel, acteurId) || sel.nombre === 0) return sel;", "if (sel.nombre === 0) return sel;", "candidats seulement"],
  ["logique/parole.mjs", "if (moi && moi.vivant === false) {", "if (false) {", "un mort se tait"],
  ["logique/parole.mjs", "if (moi?.silence && PHASES_DU_SILENCE.includes(phase)) {", "if (moi?.silence) {", "silence en journée seulement"],
  ["logique/parole.mjs", "if (mj || !enPartie) return { ok: true };", "if (!enPartie) return { ok: true };", "MJ jamais bloqué"],
  ["logique/parole.mjs", "if (chuchote.length) return auMJ ? { ok: false, relais: \"mj\" } : { ok: false, raison: \"chuchotement\" };", "", "aucun chuchotement pendant la partie"],
  ["logique/parole.mjs", "const liste = canal === \"morts\" ? [...mjs, ...morts.filter(memeCanal)] : [...mjs];", "const liste = canal === \"morts\" ? [...mjs, ...morts.filter(memeCanal), auteur] : [...mjs, ...morts];", "relais aux seuls destinataires"],
  ["logique/parole.mjs", "if (canal === \"morts\" && !(canalDesMorts && moi && moi.vivant === false)) return null;", "", "seul un mort écrit aux morts"],
  ["scripts/plateau.mjs", "if (t.texture?.src !== v.src) m[\"texture.src\"] = v.src;", "", "image du rôle à la révélation"],
  ["scripts/plateau.mjs", "if (a.has(\"dead\") !== mort) await acteur.toggleStatusEffect(\"dead\", { active: mort, overlay: true });", "", "crâne d'un mort"],
  ["scripts/plateau.mjs", "if (a.has(\"silence\") !== silence) await acteur.toggleStatusEffect(\"silence\", { active: silence });", "", "icône du silence"],
  ["scripts/plateau.mjs", "if (activer && !scene.active && typeof scene.activate === \"function\") await scene.activate();", "", "scène du village activée"],
  ["scripts/plateau.mjs", "await scene.update({ \"environment.darknessLevel\": cible.obscurite }, { animateDarkness: delais.lumiere });", "", "lumière de la phase"],
  ["scripts/plateau.mjs", "if (nouveaux.length) await scene.createEmbeddedDocuments(\"Token\", nouveaux);", "", "jetons posés"],
  ["scripts/plateau.mjs", "    planifierMiseEnScene({ activer: true });\n    ambiancePourPhase(phase);", "    ambiancePourPhase(phase);", "mise en scène à chaque phase"],
  // (0.9.0 : « révélés à la victoire » ne se casse plus en retirant le hook de victoire du plateau : à la victoire, les rôles
  // entrent aux documents — api.mjs, revelerPubliquement — et chaque mise à jour d'un villageois remet déjà la scène en ordre.)
  ["scripts/plateau.mjs", "...(j.mort ? APPARENCE.mort : APPARENCE.vivant)", "...APPARENCE.vivant", "mort grisé"],
  ["scripts/plateau.mjs", "constrainOptions: { ignoreWalls: true, ignoreCost: true }", "constrainOptions: {}", "marche à travers les murs"],
  ["scripts/plateau-local.mjs", "if (v.ouvert && moiVivant()) return \"vote\";", "if (v.ouvert) return \"vote\";", "un mort ne vote pas"],
  ["scripts/plateau-local.mjs", "envoyerReponse(id, [...local.selection.choisis]);", "envoyerReponse(id, []);", "validation du choix"],
  ["scripts/plateau-local.mjs", "local.selection = L.basculer(local.selection, acteurId);", "envoyerReponse(local.demande.id, [acteurId]);", "sélection locale"],
  ["scripts/plateau-local.mjs", "  if (demande.mode === \"texte\" || !plateauInteractif(demande.candidats.map(c => c.id))) {", "  if (true) {", "choix sur la carte"],
  ["scripts/plateau-local.mjs", "    case \"vote\": return lireEtat().vote.candidats.includes(acteurId);", "    case \"vote\": return true;", "candidats du vote"],
  ["scripts/api.mjs", "    if (!acteur.system.vivant) return Promise.resolve([]);", "", "un mort n'est pas réveillé"],
  ["scripts/api.mjs", ": anciens.filter(estCompagnon).map(a => a.id);", ": [];", "rejouer avec les compagnons"],
  ["scripts/api.mjs", "    annulerDemandes();\n", "", "rejouer : demandes closes"],
  ["scripts/api.mjs", "const historique = [...historiqueDesParties(), ...(precedents.length ? [{ roles: precedents, batiments: avant.batimentsCles ?? [], quand: Date.now() }] : [])];", "const historique = [];", "rejouer : autre composition"],
  ["scripts/parole.mjs", "try { await message.delete(); }", "try { void message; }", "garde du MJ"],
  ["scripts/parole.mjs", "    if (texte) envoyerParole(texte, d.relais, { aveugle: Boolean(resume && (message.blind ?? donnees?.blind)) });\n", "", "canal des morts relayé"],
  ["scripts/parole.mjs", "  emettre(message, destinataires);", "  emettre(message);", "relais avec destinataires"],
  ["scripts/socket.mjs", "    case \"paroleEnvoi\": return estMJActif() && Boolean(emetteur) && relayer(pourMoi);", "    case \"paroleEnvoi\": return estMJActif() && relayer({ ...message, userId: message.userId });", "relais : l'émetteur fait foi"],
  ["scripts/socket.mjs", "      if (!deMJActif(emetteur)) return false;\n      afficherParole(message);", "      afficherParole(message);", "mot relayé du seul MJ actif"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-plateau-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { commeMJ(); delete globalThis.canvas; }
  }
  return liste;
}

test("plateau : le système d'origine passe toute la batterie", async () => {
  const M = await charger(SYSTEME);
  const e = await echecs(M);
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("plateau : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    const M = await chargerMutant(fichier, avant, apres);
    if (!(await echecs(M)).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
