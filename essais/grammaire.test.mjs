// Élision et accord en nombre des messages du système (systems/lakour-loups/logique/grammaire.mjs), et leur branchement :
// t() (scripts/donnees.mjs), l'assistant {{loupsT}} des gabarits, les replis de la logique, les fichiers de langue.
// Vus en partie réelle : « Au lavoir, on raconte que une seule maison… » et « 7 villageois, 1 tour(s) dans la brume. »
// Lancer : node --test essais/grammaire.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../systems/lakour-loups/logique/index.mjs";
import { remplir, elider } from "../systems/lakour-loups/logique/grammaire.mjs";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const lire = f => readFileSync(join(RACINE, f), "utf8");
const FR = JSON.parse(lire("systems/lakour-loups/lang/fr.json"));
const EN = JSON.parse(lire("systems/lakour-loups/lang/en.json"));
const chemin = (o, c) => c.split(".").reduce((x, k) => x?.[k], o);
const aplatir = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? aplatir(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const variables = gabarit => [...gabarit.matchAll(/\{(\w+)\}/g)].map(m => m[1]);

test("élision : que, de, le, la… devant une donnée qui commence par une voyelle", () => {
  assert.equal(remplir("Au lavoir, on raconte que {indice}", { indice: "une seule maison a reçu de la visite cette nuit." }),
    "Au lavoir, on raconte qu'une seule maison a reçu de la visite cette nuit.");
  assert.equal(remplir("La rumeur court que {indice}", { indice: "aucune maison n'a reçu de visite cette nuit." }),
    "La rumeur court qu'aucune maison n'a reçu de visite cette nuit.");
  assert.equal(remplir("on ne parle que de {nom}, qui ne peut pas répondre.", { nom: "Élise" }), "on ne parle que d'Élise, qui ne peut pas répondre.");
  assert.equal(remplir("Que {x} parte", { x: "il" }), "Qu'il parte");
  assert.equal(remplir("le masque de {role} ; la porte de {nom}", { role: "Ermite", nom: "Bastien" }), "le masque d'Ermite ; la porte de Bastien");
  assert.equal(remplir("jusque {lieu}", { lieu: "au Pont" }), "jusqu'au Pont");
  // Pas d'élision : consonne, h (aspiré ou non, on ne devine pas), mot non élidable, « -le » pronom, anglais.
  assert.equal(remplir("on raconte que {indice}", { indice: "personne n'a quitté son lit" }), "on raconte que personne n'a quitté son lit");
  assert.equal(remplir("la maison de {nom}", { nom: "Hugo" }), "la maison de Hugo");
  assert.equal(remplir("Une voix s'est jointe à {nom}.", { nom: "Anne" }), "Une voix s'est jointe à Anne.");
  assert.equal(remplir("Annonce-le {quand}", { quand: "au matin" }), "Annonce-le au matin");
  assert.equal(remplir("the mask of {role}", { role: "Ermite" }, { langue: "en" }), "the mask of Ermite");
  assert.equal(remplir("they say that {indice}", { indice: "a single house" }, { langue: "en" }), "they say that a single house");
  assert.equal(elider("que", "une seule maison"), "qu'une seule maison");
  assert.equal(elider("que", "la brume a tout couvert"), "que la brume a tout couvert");
});

test("accord : (s), (x|y) suivent le dernier nombre qui les précède ; 0 et 1 au singulier en français, 1 seul en anglais", () => {
  assert.equal(remplir("{n} villageois, {tours} tour(s) dans la brume.", { n: 7, tours: 1 }), "7 villageois, 1 tour dans la brume.");
  assert.equal(remplir("{n} villageois, {tours} tour(s) dans la brume.", { n: 7, tours: 2 }), "7 villageois, 2 tours dans la brume.");
  assert.equal(remplir("{n} loup(s) (vit|vivent) encore", { n: 0 }), "0 loup vit encore");
  assert.equal(remplir("{n} loup(s), {conseil} conseillé(s)", { n: 3, conseil: 1 }), "3 loups, 1 conseillé");
  assert.equal(remplir("{n} (wolf|wolves) still (lives|live)", { n: 1 }, { langue: "en" }), "1 wolf still lives");
  assert.equal(remplir("{n} (wolf|wolves) still (lives|live)", { n: 0 }, { langue: "en" }), "0 wolves still live");
  assert.equal(remplir("{n} (villager|villagers), {tours} round(s)", { n: 5, tours: 1 }, { langue: "en" }), "5 villagers, 1 round");
  assert.equal(remplir("la {n}(re|e) fois", { n: 1 }), "la 1re fois");
  assert.equal(remplir("la {n}(re|e) fois", { n: "3" }), "la 3e fois", "un nombre écrit en texte compte aussi");
  // Sans nombre qui précède : donnees.n ; sans nombre du tout, la marque reste.
  assert.equal(remplir("Le vote est clos : {noms} désigné(s).", { noms: "Anne", n: 1 }), "Le vote est clos : Anne désigné.");
  assert.equal(remplir("Le vote est clos : {noms} désigné(s).", { noms: "Anne, Bastien", n: 2 }), "Le vote est clos : Anne, Bastien désignés.");
  assert.equal(remplir("{noms} désigné(s)", { noms: "Anne" }), "Anne désigné(s)");
  assert.equal(remplir("Maison {n} {absent}", { n: 1 }), "Maison 1 {absent}", "donnée absente : visible, jamais « undefined »");
});

test("langues : chaque gabarit au pluriel, rempli avec 1 puis 2, ne garde aucune marque « (s) » ni « (a|b) »", () => {
  let vus = 0;
  for (const [langue, dico] of [["fr", FR], ["en", EN]]) {
    for (const [cle, gabarit] of aplatir(dico)) {
      if (!/\((s|x|es)\)|\([^()|{}]*\|[^()|{}]*\)/.test(gabarit)) continue;
      vus++;
      for (const n of [1, 2]) {
        const donnees = Object.fromEntries(variables(gabarit).map(k => [k, ["noms", "qui"].includes(k) ? "Anne" : n]));
        const texte = remplir(gabarit, { n, ...donnees }, { langue });
        assert.doesNotMatch(texte, /\((s|x|es)\)|\|/, `${langue} ${cle} (${n}) : ${texte}`);
      }
    }
  }
  assert.ok(vus >= 15, `${vus} gabarits au pluriel`);
  assert.equal(remplir(chemin(FR, "LAKOUR_LOUPS.Recit.Resume"), { n: 7, tours: 1 }), "7 villageois, 1 tour dans la brume. Les cartes se retournent :");
  assert.equal(remplir(chemin(EN, "LAKOUR_LOUPS.Recit.Resume"), { n: 7, tours: 1 }, { langue: "en" }), "7 villagers, 1 round in the mist. The cards turn over:");
  assert.equal(remplir(chemin(EN, "LAKOUR_LOUPS.Jour.MoulinPublic"), { n: 1 }, { langue: "en" }), "The Mill's sails have counted: 1 wolf still lives in Brumecombe.");
  assert.equal(remplir(chemin(FR, "LAKOUR_LOUPS.Deuil.Sonne"), { n: 1 }), "Le glas du deuil sonne pour la 1re fois sur Brumecombe.");
});

test("langues : le Lavoir et la Rumeur, avec chaque indice, s'élident comme il faut", () => {
  const indices = Object.entries(FR.LAKOUR_LOUPS.Jour).filter(([k]) => k.startsWith("Indice")).map(([, v]) => v.replace(/\{n\}/, "2"));
  assert.ok(indices.length >= 10);
  for (const gabarit of [FR.LAKOUR_LOUPS.Jour.Lavoir, FR.LAKOUR_LOUPS.Almanach.Rumeur]) {
    for (const indice of indices) {
      const texte = remplir(gabarit, { indice });
      assert.doesNotMatch(texte, /\bque [aeiouéèêàâîôû]/i, texte);
    }
  }
  assert.match(remplir(FR.LAKOUR_LOUPS.Jour.Lavoir, { indice: FR.LAKOUR_LOUPS.Jour.IndiceVisites1 }), /^Au lavoir, on raconte qu'une seule maison/);
  // Aucun gabarit français ne laisse « que {x} » / « de {x} » à la merci d'une voyelle : remplis d'« Anne », tous s'élident.
  for (const [cle, gabarit] of aplatir(FR)) {
    const texte = remplir(gabarit, Object.fromEntries(variables(gabarit).map(k => [k, "Anne"])));
    assert.doesNotMatch(texte, /(^|[\s«(])(que|de|le|la|ne|se|je|me|te) Anne\b/i, `${cle} : ${texte}`);
  }
});

test("logique : les replis du Lavoir et du Moulin sont élidés et accordés", () => {
  const vs = [{ id: "a", nom: "Anne", maison: "Maison 1", camp: "meute", vivant: true }, { id: "b", nom: "Bastien", maison: "Maison 2", camp: "village", vivant: true }];
  const etat = L.normaliserEtat({ tour: 2 });
  const bilan = { visites: ["b"], sorties: [], victime: null, loup: null, sauves: 0, attaques: 0 };
  const lavoir = L.annoncesDeLAube({ villageois: vs, etat, tour: 2, bilan, batiments: ["lavoir"], hasard: () => 0 }).annonces[0];
  assert.equal(lavoir.texte, "Au lavoir, on raconte qu'une seule maison a reçu de la visite cette nuit.");
  const moulin = L.annoncesDeLAube({ villageois: vs, etat, tour: 2, batiments: ["moulin"] }).annonces[0];
  assert.equal(moulin.texte, "Les ailes du Moulin ont compté : 1 loup vit encore à Brumecombe.");
});

test("t() (scripts/donnees.mjs) remplit avec la grammaire, dans la langue du monde", async () => {
  const avant = globalThis.game;
  try {
    let lang = "fr";
    globalThis.game = { i18n: { get lang() { return lang; }, localize: c => chemin(lang === "fr" ? FR : EN, c) ?? c } };
    const { t } = await import("../systems/lakour-loups/scripts/donnees.mjs");
    assert.equal(t("LAKOUR_LOUPS.Recit.Resume", { n: 7, tours: 1 }), "7 villageois, 1 tour dans la brume. Les cartes se retournent :");
    assert.equal(t("LAKOUR_LOUPS.Jour.Lavoir", { indice: "une seule maison a reçu de la visite cette nuit." }),
      "Au lavoir, on raconte qu'une seule maison a reçu de la visite cette nuit.");
    lang = "en";
    assert.equal(t("LAKOUR_LOUPS.Recit.Resume", { n: 7, tours: 1 }), "7 villagers, 1 round in the mist. The cards turn over:");
    assert.equal(t("LAKOUR_LOUPS.Recit.Resume", { n: 7, tours: 3 }), "7 villagers, 3 rounds in the mist. The cards turn over:");
  } finally { globalThis.game = avant; }
});

test("gabarits .hbs : toute traduction avec données passe par {{loupsT}}, enregistré à l'init", () => {
  const dossier = "systems/lakour-loups/templates";
  for (const f of readdirSync(join(RACINE, dossier)).filter(n => n.endsWith(".hbs"))) {
    assert.doesNotMatch(lire(`${dossier}/${f}`), /\{\{localize ["'][\w.]+["'] \w+=/, `${f} : {{localize … x=…}} contourne l'élision et l'accord`);
  }
  assert.match(lire("systems/lakour-loups/templates/table.hbs"), /\{\{loupsT "LAKOUR_LOUPS\.Souffle\.Compte" n=vote\.souffles\}\}/);
  assert.match(lire("systems/lakour-loups/lakour-loups.mjs"), /Handlebars\.registerHelper\("loupsT", \(cle, options\) => t\(cle,/);
});

test("module de contenu : « 1 carte ou jeton basculé », sans (s)", () => {
  for (const l of ["fr", "en"]) {
    const v = JSON.parse(lire(`modules/lakour-veillees/lang/${l}.json`)).LAKOURVEIL;
    assert.doesNotMatch(v.StyleApplique + v.StyleApplique1, /\(s\)/, l);
    assert.match(v.StyleApplique1, /^1 /, l);
  }
  assert.match(lire("modules/lakour-veillees/scripts/main.js"), /n === 1 \? "LAKOURVEIL\.StyleApplique1" : "LAKOURVEIL\.StyleApplique"/);
});

test("Table de veillée : les boutons du MJ d'une carte sont dans le flux, jamais par-dessus le texte", () => {
  const css = lire("systems/lakour-loups/styles/lakour-loups.css");
  const regle = css.match(/\.lakour-loups \.loups-mj-boutons \{([^}]*)\}/)?.[1] ?? "";
  assert.ok(regle, "règle .loups-mj-boutons introuvable");
  assert.doesNotMatch(regle, /position:\s*absolute/, "posée en absolu, elle recouvre un métier ou un rôle long");
  assert.match(regle, /grid-column:\s*1 \/ -1/, "une rangée pleine largeur en bas de carte");
  const carte = css.match(/\.lakour-loups \.loups-carte \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(carte, /(^|[^-])height:/, "hauteur de carte automatique");
});
