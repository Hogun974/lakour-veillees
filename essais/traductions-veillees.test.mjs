// lakour-veillees : chaque clé de traduction utilisée dans son code existe en français ET en anglais, et les deux
// fichiers ont les mêmes clés (contrôle commun : modules/lakour-mj-ia/outils/contrat-contenu.mjs). Nouveau : l'archive
// (foundry-modules@bc94625) ne l'éprouvait que pour lakour-mj-ia et lakour-40k.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { ecartsTraductions } from "../modules/lakour-mj-ia/outils/contrat-contenu.mjs";

test("lakour-veillees : traductions complètes et cohérentes", () => {
  const e = ecartsTraductions("modules/lakour-veillees", "LAKOURVEIL");
  assert.deepEqual(e.francaisSeul, [], "clés françaises absentes de l'anglais");
  assert.deepEqual(e.anglaisSeul, [], "clés anglaises absentes du français");
  assert.deepEqual(e.manquantes, []);
});
