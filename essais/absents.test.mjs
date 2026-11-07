// Un joueur humain ABSENT (hors ligne) n'est pas de la partie que prépare le MJ IA (vu en vraie partie : « 10 joueurs IA, Hogun974 est
// absent », et pourtant son personnage au village, que la Gazette a envoyé au village voisin). Côté système (API, sur la doublure de
// Foundry) : le villageois d'un joueur humain qui n'est pas de la distribution quitte le village (sans carte, il y restait un vivant :
// candidat, proie, compté à la victoire) ; un MJ humain qui distribue depuis la Table n'y voit rien changer. Côté MJ IA (ses outils
// loups_*, le vrai système) : loups_distribuer et loups_rejouer laissent l'absent de côté et le disent au narrateur ; nommé, il est
// gardé. La règle du système est rejouée sur une copie mutée (la garde retirée).  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde } from "./doublures/foundry-loups.mjs";
import { api as apiDuMonde, outil, monde, villageois as villageoisDuMonde } from "./outils/partie-loups.mjs";

const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6"];

// ------------------------------------------------------------------ le système seul (API), d'origine ou muté
async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs")]);
  return { api: api.api, socket, reglages: reglagesM };
}
async function mondeSeul(M) {
  installerFoundry({ joueurs: 6, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 1);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const deU = id => villageois().find(a => a.system.joueur === id);

const VERIFICATIONS = {
  async "distribuer sans un joueur humain : son villageois quitte le village (ni carte, ni vivant, ni candidat)"(M) {
    const U = await mondeSeul(M);
    await M.api.distribuer({ roles: [U.loup, ...Array(5).fill(U.villageois)], metiers: [], joueurs: JOUEURS, graine: "absent", batiments: [] });
    assert.ok(deU("u6"), "u6 a son villageois");
    await M.api.distribuer({ roles: [U.loup, ...Array(4).fill(U.villageois)], metiers: [], joueurs: JOUEURS.slice(0, 5), compagnons: ["Ysaline"],
      graine: "absent-2", batiments: [] });
    assert.equal(deU("u6"), undefined, "le villageois de l'absent a quitté le village");
    assert.equal(villageois().length, 6, "cinq joueurs et un compagnon, personne d'autre");
    assert.equal(Object.keys(M.api.etat().fiches).length, 6);
    assert.ok(villageois().every(a => M.api.etat().fiches[a.id]), "chaque villageois a sa carte");
  },

  async "la Table du MJ humain (nouvellePartie) : mêmes joueurs, tous gardés ; joueurs cochés, les autres quittent le village (comme avant)"(M) {
    const U = await mondeSeul(M);
    await M.api.distribuer({ roles: [U.loup, ...Array(5).fill(U.villageois)], metiers: [], joueurs: JOUEURS, graine: "table", batiments: [] });
    game.users.get("u6").active = false;
    const r = await M.api.nouvellePartie({ memesJoueurs: true, roles: ["loup-de-brumecombe", "villageois", "villageois", "villageois", "villageois", "villageois"] });
    assert.equal(r.joueurs.length, 6, "« Rejouer » de la Table : les mêmes joueurs, comme avant");
    const c = await M.api.nouvellePartie({ memesJoueurs: false, joueurs: JOUEURS.slice(0, 5), compagnons: [],
      roles: ["loup-de-brumecombe", "villageois", "villageois", "villageois", "villageois"] });
    assert.equal(c.joueurs.length, 5);
    assert.equal(deU("u6"), undefined);
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "    for (const a of tousLesVillageois().filter(x => x.system.joueur && !x.system.compagnon && !joueurs.includes(x.system.joueur))) await a.delete();\n", "",
    "distribuer : le villageois d'un absent quitte le village"]
];
const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-absents-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, () => apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}
async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
  }
  return liste;
}

test("absents (système) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

test("absents (système) : chaque règle cassée est détectée", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});

// ------------------------------------------------------------------ les outils du MJ IA, avec le vrai système
const fiches = () => apiDuMonde.etat().fiches ?? {};
const deLui = id => villageoisDuMonde().find(a => a.system.joueur === id);

test("loups_distribuer (MJ IA) : le joueur hors ligne n'a ni carte ni villageois, et le narrateur le sait ; nommé, il a sa carte", async () => {
  monde(6, "absent");
  assert.ok(!(await outil("loups_distribuer").executer({ joueurs: [], niveau: "classique" })).erreur);
  const nom = game.users.get("u6").name;
  game.users.get("u6").active = false;
  const r = await outil("loups_distribuer").executer({ joueurs: [], niveau: "classique", compagnons: 1 });
  assert.ok(!r.erreur, r.contenu);
  assert.equal(deLui("u6"), undefined, "son villageois a quitté le village");
  assert.equal(villageoisDuMonde().length, 6, "cinq joueurs connectés et un compagnon");
  assert.ok(villageoisDuMonde().every(a => fiches()[a.id]), "personne sans carte au village");
  assert.match(r.contenu, new RegExp(`Laissé de côté, car absent \\(hors ligne\\) : ${nom}`));
  assert.ok(!r.contenu.split("\n").some(l => l.startsWith("- ") && l.includes(nom)), "pas dans la distribution secrète");
  // Nommé par le narrateur : il a sa carte, et la sortie dit qu'il est hors ligne.
  const noms = JOUEURS.map(id => game.users.get(id).name);
  const g = await outil("loups_distribuer").executer({ joueurs: noms, niveau: "classique" });
  assert.ok(!g.erreur, g.contenu);
  assert.ok(fiches()[deLui("u6")?.id], "nommé, il a sa carte");
  assert.match(g.contenu, new RegExp(`Hors ligne mais inclus à ta demande : ${nom}`));
});

test("loups_rejouer (MJ IA) : les mêmes joueurs, sans celui qui est parti hors ligne ; nommé, il rejoue", async () => {
  monde(6, "rejouer");
  assert.ok(!(await outil("loups_distribuer").executer({ joueurs: [], niveau: "classique", compagnons: 2 })).erreur);
  const nom = game.users.get("u6").name;
  game.users.get("u6").active = false;
  const r = await outil("loups_rejouer").executer({ niveau: "", roles: [], composition: "" });
  assert.ok(!r.erreur, r.contenu);
  assert.equal(deLui("u6"), undefined, "son villageois a quitté le village");
  assert.equal(Object.keys(fiches()).length, 7, "cinq joueurs et les deux mêmes compagnons");
  assert.equal(villageoisDuMonde().filter(a => a.system.compagnon).length, 2);
  assert.match(r.contenu, new RegExp(`Laissé de côté, car absent \\(hors ligne\\) : ${nom}`));
  // Revenu à la table du village (mais encore hors ligne), le narrateur le garde : il rejoue.
  await outil("loups_distribuer").executer({ joueurs: JOUEURS.map(id => game.users.get(id).name), niveau: "classique" });
  const g = await outil("loups_rejouer").executer({ joueurs: [nom], niveau: "", roles: [], composition: "" });
  assert.ok(!g.erreur, g.contenu);
  assert.ok(fiches()[deLui("u6")?.id], "gardé, il a sa carte");
  assert.match(g.contenu, new RegExp(`Hors ligne mais inclus à ta demande : ${nom}`));
});
