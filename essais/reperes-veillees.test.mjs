// Les repères de la carte (« Maison N », les dix bâtiments) restent des CLÉS françaises dans les deux modules (lakour-veillees et
// lakour-veillees-en : le plateau et le MJ IA les lisent par nom) ; seul leur AFFICHAGE est traduit (logique/reperes.mjs,
// lang/<langue>.json : LAKOUR_LOUPS.Reperes.*) — fiche du villageois, fiche du bâtiment, infobulle du jeton, Table, vote, choix
// de cible, carte de rôle. Sans Foundry.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPERES, repereDe, libelleDeRepere } from "../systems/lakour-loups/logique/reperes.mjs";
import { maisonsDuVillage } from "../systems/lakour-loups/logique/distribution.mjs";
import { BATIMENTS } from "../modules/lakour-veillees/contenu/batiments.mjs";

const SYSTEME = new URL("../systems/lakour-loups/", import.meta.url);
const langue = l => JSON.parse(readFileSync(new URL(`lang/${l}.json`, SYSTEME), "utf8"));
// Un game.i18n minimal sur un fichier de langue : format (avec { n }) ou localize ; une clé inconnue est rendue telle quelle.
const traducteur = dictionnaire => (cle, donnees) => {
  const v = cle.split(".").reduce((o, k) => o?.[k], dictionnaire);
  return typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, k) => donnees?.[k] ?? `{${k}}`) : cle;
};
const fr = traducteur(langue("fr")), en = traducteur(langue("en"));

test("repereDe : « Maison N » et les dix bâtiments, accents et casse tolérés ; tout autre nom n'est pas un repère", () => {
  assert.deepEqual(repereDe("Maison 7"), { cle: "maison", n: 7 });
  assert.deepEqual(repereDe("maison  18"), { cle: "maison", n: 18 });
  assert.deepEqual(repereDe("Chapelle"), { cle: "chapelle" });
  assert.deepEqual(repereDe("Cimetière"), { cle: "cimetiere" });
  assert.deepEqual(repereDe("CIMETIERE"), { cle: "cimetiere" });
  for (const nom of ["Chez Mathurin", "Maison", "Maison sept", "", null, undefined, "La Chapelle"]) assert.equal(repereDe(nom), null, String(nom));
  // Les dix repères sont exactement ceux des bâtiments du contenu, et toutes les maisons du village sont reconnues.
  assert.deepEqual([...REPERES].sort(), BATIMENTS.map(b => repereDe(b.system.repere)?.cle).sort());
  for (const m of maisonsDuVillage(18)) assert.equal(repereDe(m)?.cle, "maison", m);
});

test("libelleDeRepere : anglais dans lakour-veillees-en (House 7, Chapel…), français inchangé, nom libre tel quel", () => {
  assert.equal(libelleDeRepere("Maison 7", en), "House 7");
  assert.equal(libelleDeRepere("Maison 18", en), "House 18");
  assert.equal(libelleDeRepere("Chapelle", en), "Chapel");
  assert.equal(libelleDeRepere("Cimetière", en), "Graveyard");
  assert.equal(libelleDeRepere("Gibet", en), "Gallows");
  assert.equal(libelleDeRepere("Maison 7", fr), "Maison 7");
  assert.equal(libelleDeRepere("Cimetière", fr), "Cimetière");
  for (const nom of ["Chez Mathurin", "Maison sept"]) { assert.equal(libelleDeRepere(nom, en), nom); assert.equal(libelleDeRepere(nom, fr), nom); }
  assert.equal(libelleDeRepere("", en), "");
  assert.equal(libelleDeRepere(undefined, en), "");
  // Sans traduction disponible (clé absente du fichier de langue, traducteur absent) : la clé reste lisible.
  assert.equal(libelleDeRepere("Maison 7", () => "LAKOUR_LOUPS.Reperes.maison"), "Maison 7");
  assert.equal(libelleDeRepere("Chapelle"), "Chapelle");
  // Les libellés anglais des bâtiments suivent le dictionnaire du module (contenu/en/batiments.json : « The Chapel »…).
  const dictionnaire = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/contenu/en/batiments.json", import.meta.url), "utf8"));
  for (const b of BATIMENTS) {
    const nomAnglais = Object.values(dictionnaire).find(e => e._nom === b.name)?.name?.en;
    assert.equal(`The ${libelleDeRepere(b.system.repere, en)}`, nomAnglais, b.system.repere);
  }
});

test("affichage seulement : les clés restent françaises, et chaque endroit qui montre une maison ou un repère passe par libelleRepere", () => {
  const lire = f => readFileSync(new URL(f, SYSTEME), "utf8");
  // Les clés ne bougent pas : le plateau cherche toujours « Maison N », l'API attribue toujours « Maison N ».
  assert.match(lire("scripts/plateau.mjs"), /\/\^Maison \\d\+\$\//);
  assert.match(lire("scripts/api.mjs"), /`Maison \$\{prises\.size \+ 1\}`/);
  assert.equal(maisonsDuVillage(3).join(), "Maison 1,Maison 2,Maison 3");
  // Les gabarits lisent le libellé, pas la clé ; le champ de saisie du MJ garde la clé.
  const villageois = lire("templates/fiche-villageois.hbs"), batiment = lire("templates/fiche-batiment.hbs");
  assert.ok(villageois.includes("{{maisonLibelle}}") && villageois.includes('name="system.maison" value="{{system.maison}}"'));
  assert.ok(batiment.includes("{{repereLibelle}}") && batiment.includes('name="system.repere" value="{{system.repere}}"'));
  assert.ok(!villageois.includes("<span class=\"loups-pilule-val\">{{system.maison}}</span>"));
  for (const [f, motif] of [
    ["scripts/apps/fiches.mjs", /maisonLibelle: libelleRepere\(s\.maison\)/],
    ["scripts/apps/fiches.mjs", /repereLibelle: libelleRepere\(i\.system\.repere/],
    ["scripts/infobulle.mjs", /maison: libelleRepere\(acteur\.system\.maison\)/],
    ["scripts/apps/table.mjs", /maison: libelleRepere\(a\.system\.maison\)/],
    ["scripts/apps/table.mjs", /repere: libelleRepere\(d\?\.system\?\.repere/],
    ["scripts/apps/vote.mjs", /maison: libelleRepere\(a\.system\.maison\)/],
    ["scripts/apps/choix.mjs", /maison: libelleRepere\(c\.maison\)/],
    ["scripts/api.mjs", /maison: libelleRepere\(acteur\.system\.maison\)/]
  ]) {
    assert.match(lire(f), motif, f);
    assert.match(lire(f), /import \{[^}]*\blibelleRepere\b[^}]*\} from "(\.\.\/|\.\/)donnees\.mjs"/, `${f} : libelleRepere importé de donnees.mjs`);
  }
  // Le module anglais ne traduit pas ces clés (contenu/en/villageois.json : Frère Anselme garde « Chapelle » pour maison).
  const dictionnaireVillageois = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/contenu/en/villageois.json", import.meta.url), "utf8"));
  for (const e of Object.values(dictionnaireVillageois)) for (const chemin of Object.keys(e)) assert.ok(!/^system\.maison$/.test(chemin), `${e._nom} : system.maison extrait`);
});

// Vu en partie réelle : la carte de rôle disait « Maison Maison 4 » (l'étiquette Fiche.Maison, puis le libellé qui la contient
// déjà). Une maison numérotée se nomme seule ; une demeure nommée à la main (« Chapelle ») garde l'étiquette.
test("carte de rôle et fiche : « Maison 4 », jamais « Maison Maison 4 » (ni « House House 4 »)", async () => {
  const { maisonNumerotee } = await import("../systems/lakour-loups/scripts/donnees.mjs");
  assert.equal(maisonNumerotee("Maison 4"), true);
  assert.equal(maisonNumerotee("Chapelle"), false);
  assert.equal(maisonNumerotee(""), false);
  const lire = f => readFileSync(new URL(f, SYSTEME), "utf8");
  // Le rendu de la ligne « maison » de la carte, avec le contexte que l'envoi (api.mjs) lui donne.
  const carte = lire("templates/carte-role.hbs");
  const ligne = carte.split("\n").find(l => l.includes("fa-door-closed"));
  const rendre = (maison, maisonEtiquette, dico) => ligne
    .replace(/\{\{#if maison\}\}([\s\S]*)\{\{\/if\}\}\s*$/, "$1")
    .replace(/\{\{#if maisonEtiquette\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/, (_, oui, non) => (maisonEtiquette ? oui : non))
    .replace(/\{\{localize "([\w.]+)"\}\}/g, (_, c) => c.split(".").reduce((o, k) => o?.[k], dico))
    .replace("{{maison}}", maison).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  for (const [l, traduire] of [["fr", fr], ["en", en]]) {
    const libelle = libelleDeRepere("Maison 4", traduire);
    const texte = rendre(libelle, false, langue(l));
    assert.equal(texte, libelle, `${l} : ${texte}`);
    assert.doesNotMatch(texte, /(Maison|House) (Maison|House)/);
    assert.equal(rendre("Chapelle", true, langue(l)), `${langue(l).LAKOUR_LOUPS.Fiche.Maison} Chapelle`);
  }
  assert.match(lire("scripts/api.mjs"), /maisonEtiquette: !maisonNumerotee\(acteur\.system\.maison\)/);
  // La fiche du villageois : même pilule, même règle.
  assert.match(lire("templates/fiche-villageois.hbs"), /<span class="loups-pilule-cle"><i class="fa-solid fa-door-closed"><\/i>\{\{#if maisonEtiquette\}\} \{\{localize "LAKOUR_LOUPS\.Fiche\.Maison"\}\}\{\{\/if\}\}<\/span>/);
  assert.match(lire("scripts/apps/fiches.mjs"), /maisonEtiquette: !maisonNumerotee\(s\.maison\)/);
  // Ailleurs (Table, vote, choix de nuit, infobulle) : le libellé seul, sans étiquette Fiche.Maison devant.
  for (const f of ["templates/table.hbs", "templates/vote.hbs", "templates/choix.hbs", "scripts/infobulle.mjs"]) {
    assert.doesNotMatch(lire(f), /Fiche\.Maison/, f);
  }
});
