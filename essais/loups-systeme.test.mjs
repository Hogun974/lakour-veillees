// Fichiers du système lakour-loups : system.json conforme au contrat, langues complètes et cohérentes, gabarits
// présents et bien formés, syntaxe de tous les modules, textes originaux.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as L from "../systems/lakour-loups/logique/index.mjs";

const RACINE = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const fichiers = dossier => readdirSync(dossier).flatMap(n => {
  const c = join(dossier, n);
  return statSync(c).isDirectory() ? fichiers(c) : [c];
});
const tous = fichiers(RACINE);
const lire = f => readFileSync(f, "utf8");
const aplatir = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? aplatir(v, `${p}${k}.`) : [`${p}${k}`]));
const systeme = JSON.parse(lire(join(RACINE, "system.json")));

test("system.json : conforme au contrat", () => {
  assert.equal(systeme.id, "lakour-loups");
  assert.match(systeme.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(systeme.compatibility, { minimum: "14", verified: "14.369" });
  assert.equal(systeme.socket, true);
  assert.deepEqual(systeme.esmodules, ["lakour-loups.mjs"]);
  assert.deepEqual(systeme.languages.map(l => l.lang).sort(), ["en", "fr"]);
  assert.deepEqual(Object.keys(systeme.documentTypes.Actor), ["villageois"]);
  assert.deepEqual(Object.keys(systeme.documentTypes.Item).sort(), ["batiment", "metier", "role"]);
  assert.deepEqual(systeme.grid, { type: 1, distance: 1.5, units: "m" });
  assert.equal(systeme.primaryTokenAttribute, null);
  for (const f of [...systeme.esmodules, ...systeme.styles, ...systeme.languages.map(l => l.path)]) assert.ok(existsSync(join(RACINE, f)), f);
});

test("modèles : les champs du contrat sont tous déclarés", () => {
  const src = lire(join(RACINE, "scripts/modeles.mjs"));
  for (const champ of ["joueur", "vivant", "revele", "camp", "maison", "amoureux", "silence", "protections", "notes",
    "cle", "description", "victoire", "nuit", "actif", "ordre", "premiereNuitSeulement", "uneNuitSurDeux", "cibles", "soiMeme", "invite",
    "usages", "max", "restant", "effet", "jour", "regle", "repere"]) {
    assert.match(src, new RegExp(`\\b${champ}:`), champ);
  }
  const entree = lire(join(RACINE, "lakour-loups.mjs"));
  for (const t of ["villageois", "role", "metier", "batiment"]) assert.match(entree, new RegExp(`dataModels\\.${t} =`));
  assert.match(entree, /registerSheet\(ID, FicheVillageois/);
  assert.match(entree, /getSceneControlButtons/);
  assert.match(entree, /game\.lakourLoups = api/);
  assert.match(lire(join(RACINE, "scripts/reglages.mjs")), /"partie"[\s\S]*"revelerALaMort"/);
});

test("langues : fr et en ont les mêmes clés, et toutes les clés utilisées existent", () => {
  const fr = JSON.parse(lire(join(RACINE, "lang/fr.json")));
  const en = JSON.parse(lire(join(RACINE, "lang/en.json")));
  const cfr = new Set(aplatir(fr)), cen = new Set(aplatir(en));
  assert.deepEqual([...cfr].filter(k => !cen.has(k)), [], "clés françaises absentes de l'anglais");
  assert.deepEqual([...cen].filter(k => !cfr.has(k)), [], "clés anglaises absentes du français");
  const sources = tous.filter(f => /\.(mjs|hbs)$/.test(f));
  const utilisees = new Set(sources.flatMap(f => lire(f).match(/LAKOUR_LOUPS\.[A-Za-z][A-Za-z0-9.-]*[A-Za-z0-9]/g) ?? []));
  const manquantes = [...utilisees].filter(k => !cfr.has(k) && ![...cfr].some(c => c.startsWith(`${k}.`)));
  assert.deepEqual(manquantes, []);
  // Clés construites : messages de la nuit, phases, camps, causes, effets, victoires.
  const nuit = [...lire(join(RACINE, "logique/resolution.mjs")).matchAll(/msg\([^,]+, "(\w+)"/g)].map(m => `LAKOUR_LOUPS.Nuit.${m[1]}`);
  assert.ok(nuit.length > 15);
  for (const k of nuit) assert.ok(cfr.has(k), k);
  for (const p of L.PHASES) assert.ok(cfr.has(`LAKOUR_LOUPS.Phases.${p}`), p);
  for (const c of L.CAMPS) assert.ok(cfr.has(`LAKOUR_LOUPS.Camps.${c}`), c);
  for (const c of Object.values(L.CAUSES)) assert.ok(cfr.has(`LAKOUR_LOUPS.Causes.${c}`), c);
  for (const e of L.EFFETS) assert.ok(cfr.has(`LAKOUR_LOUPS.Effets.${e}`), e);
  for (const v of L.VICTOIRES) assert.ok(cfr.has(`LAKOUR_LOUPS.Victoires.${v || "aucune"}`), v);
  for (const t of ["Actor.villageois", "Item.role", "Item.metier", "Item.batiment"]) assert.ok(cfr.has(`TYPES.${t}`), t);
  // Les variables {x} sont les mêmes dans les deux langues.
  const val = (o, k) => k.split(".").reduce((x, p) => x[p], o);
  for (const k of cfr) {
    const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
    assert.equal(vars(val(en, k)), vars(val(fr, k)), k);
  }
});

test("gabarits : tous ceux cités existent, blocs Handlebars équilibrés", () => {
  const cites = new Set(tous.filter(f => f.endsWith(".mjs")).flatMap(f => [...lire(f).matchAll(/templates\/([\w-]+\.hbs)/g)].map(m => m[1])));
  assert.ok(cites.size >= 8);
  for (const g of cites) assert.ok(existsSync(join(RACINE, "templates", g)), g);
  for (const f of tous.filter(f => f.endsWith(".hbs"))) {
    const pile = [];
    for (const [, signe, nom] of lire(f).matchAll(/\{\{~?([#/])(\w+)/g)) {
      if (signe === "#") pile.push(nom);
      else assert.equal(pile.pop(), nom, `${f} : {{/${nom}}} sans ouverture correspondante`);
    }
    assert.deepEqual(pile, [], `${f} : blocs non fermés`);
    for (const [, action] of lire(f).matchAll(/data-action="(\w+)"/g)) {
      const js = tous.filter(x => x.endsWith(".mjs")).map(lire).join("\n");
      assert.ok(new RegExp(`\\b${action}:`).test(js) || ["editImage"].includes(action), `${f} : action ${action} sans gestionnaire`);
    }
  }
});

test("syntaxe : node --check sur tous les modules du système", () => {
  const modules = tous.filter(f => f.endsWith(".mjs"));
  assert.ok(modules.length >= 15);
  for (const f of modules) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f}\n${r.stderr}`);
  }
});

test("textes originaux : aucune référence au jeu édité", () => {
  for (const f of tous.filter(f => /\.(mjs|hbs|json|css)$/.test(f))) {
    assert.doesNotMatch(lire(f), /thiercelieux/i, f);
  }
});

test("logique pure : aucun appel à Foundry", () => {
  for (const f of tous.filter(f => f.includes(`${join("logique")}`) && f.endsWith(".mjs"))) {
    assert.doesNotMatch(lire(f).replace(/\/\/.*$/gm, ""), /\b(game|foundry|Hooks|CONFIG|ui)\./, f);
  }
});
