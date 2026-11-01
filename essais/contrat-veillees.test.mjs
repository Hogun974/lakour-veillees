// lakour-veillees respecte le contrat commun des modules de contenu du MJ IA (modules/lakour-mj-ia/outils/contrat-contenu.mjs) :
// figurants.json, index des jetons de joueur, jetons à plat et en relief, plans.json cohérent avec la scène du village.
// Partie Veillées de l'essai transversal « figurants » de essais/parite.test.mjs de l'archive (foundry-modules@bc94625),
// qui ne regardait que lakour-40k et lakour-warcraft : chaque monde a désormais le sien (parité).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierModuleDeContenu } from "../modules/lakour-mj-ia/outils/contrat-contenu.mjs";

test("figurants : lakour-veillees fournit figurants.json et ses index, avec des jetons qui existent (contrat commun)", () => {
  assert.deepEqual(verifierModuleDeContenu("modules/lakour-veillees", { minFigurants: 10, minJoueurs: 8 }), []);
});
