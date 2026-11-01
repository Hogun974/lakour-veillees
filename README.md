# lakour-veillees — Les Veillées de Brumecombe

Jeu original de déduction sociale de la famille du loup-garou : système Foundry `lakour-loups` (règles, table, votes, secrets) et module de contenu `lakour-veillees` (rôles, métiers, bâtiments, guides, compositions de 6 à 18 joueurs, carte du village).

Le moteur commun (module MJ IA, validateur Foundry, aides des jetons, contrat des modules de contenu) est le dépôt
`lakour-mj-ia`, monté ici en **sous-module** à `modules/lakour-mj-ia`. Historique antérieur : archive
`foundry-modules@bc94625`.

## Contenu

```
systems/lakour-loups/         le système Foundry (logique/ pure, éprouvée en Node)
modules/lakour-veillees/      le module de contenu (contenu/*.mjs = source de vérité, src/ et assets/ générés)
modules/lakour-mj-ia/         sous-module : le moteur commun (ne pas modifier ici, voir plus bas)
outils/                       fabricants propres à ce monde
essais/                       essais node de ce monde (aucun réseau, aucun coût)
docs/                         formes des données et contrats de ce monde
```

## Cloner

```bash
git clone --recurse-submodules <url>/lakour-veillees.git
# déjà cloné sans le sous-module :
git submodule update --init
npm install                  # @foundryvtt/foundryvtt-cli (versions épinglées)
```

## Fabriquer, éprouver, valider

```bash
npm run fabriquer-jetons-veillees        # jetons SVG (plat et relief), index, figurants.json, CREDITS.md
npm run fabriquer-veillees        # vérifie le contenu, écrit src/ puis compile packs/ (hors git)
npm run essais               # essais de ce monde, avec le moteur du sous-module
npm run contrat              # contrat commun des modules de contenu (figurants, index, plans)
npm run valider -- <dossier de Foundry v14 contenant common/>   # schémas Foundry, 0 erreur attendue
```

Une icône game-icons pas encore copiée : `npm run fabriquer-jetons-veillees -- --source <icons-master>` ; elle est copiée dans
`modules/lakour-mj-ia/outils/game-icons/`, donc à verser dans le dépôt `lakour-mj-ia`.

## Règle de parité

Une amélioration du moteur sert aux **trois** mondes. Rien de propre à Les Veillées de Brumecombe ne va dans `lakour-mj-ia`, et rien du
moteur ne se corrige ici : on corrige dans `lakour-mj-ia` (avec ses essais), puis chaque monde met à jour son
sous-module et relance `npm run essais`.

## Mettre à jour le sous-module

```bash
git submodule update --remote modules/lakour-mj-ia   # dernier commit du moteur
npm run essais
git add modules/lakour-mj-ia && git commit -m "Moteur MJ IA à jour"
```

## Déploiement sur le serveur

Envoyer `systems/lakour-loups/` dans `Data/systems/lakour-loups` et `modules/lakour-veillees/` dans `Data/modules/lakour-veillees` (sans `contenu/` si l'on veut alléger : il ne sert qu'aux fabricants), après `npm run fabriquer-veillees`
pour que `packs/` soit à jour. Le module MJ IA s'envoie depuis `modules/lakour-mj-ia` sans `essais/`, `outils/`,
`docs/`, `package*.json`, `README.md` ni `.git`.
