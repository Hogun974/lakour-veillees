# Publication — liste de contrôle

Ce qu'il reste à faire, dans l'ordre, pour passer le dépôt en public et rendre le jeu installable depuis Foundry. Tout ce qui
est automatisé l'est par `.github/workflows/release.yml` et `outils/empaqueter-paquets.mjs` ; le reste est à la main.

## 1. Avant le passage en public

- [x] **Licence** (décidé par Jordan le 5 novembre 2026) : code MIT, textes et images CC BY-NC-SA 4.0. `LICENSE` (MIT,
      « Copyright (c) 2026 Hogun974 ») et `LICENCE-CONTENU.md` (détail par dossier, attribution « LaKour — Hogun974 »,
      tiers) à la racine ; `TODO` retiré des deux README ; licence rappelée dans `modules/lakour-veillees/CREDITS.md` ;
      champ `license` de `system.json` et `module.json` à `"LICENSE"` (hérité par `lakour-veillees-en`), et
      `outils/empaqueter-paquets.mjs` copie les deux fichiers dans chaque archive ; les archives du monde ne les contiendront qu'une fois le sous-module `modules/lakour-mj-ia` mis à jour (`outils/empaqueter-monde.mjs` les copie désormais), et l'étape « Licences dans chaque archive » du workflow refuse la release sans eux. CC BY 3.0
      (game-icons) toujours citée.
- [x] **Tutoriels** « de zéro à la première veillée » : `TUTORIEL.md` (français) et `TUTORIAL.md` (anglais) à la racine
      (prérequis, installation par les manifestes et par le monde vierge, version anglaise, un compte et un mot de passe par
      joueur, clé de secours du coffre, salons vocaux et nuit, MJ IA, compagnons et pilote automatique, déroulé, réglages,
      dépannage), liés en tête des deux README et renvoyant au tutoriel du moteur (`lakour-mj-ia`, branche `principale`).
- [x] **Transparence** dans les deux README (en tête et aux Crédits) : code et textes écrits avec l'aide d'une IA (Claude,
      d'Anthropic) et relus par l'auteur ; illustrations générées par IA en local (FLUX.2 klein 9B dans ComfyStudio, comme dit
      `modules/lakour-veillees/CREDITS.md`).
- [x] **Réglages du monde vierge public** : `lakour-mj-ia.budgetSeance` à 10 dollars (`monde/src/settings/`) ;
      autonomie `autonome` et personnalité `voix-de-la-brume` gardées.
- [ ] **Captures** : déposer les PNG listés dans `docs/captures/LISEZ-MOI.md` (au moins `village`, `table-de-jeu`, `vote`,
      `carte-de-role`, `chroniques` : ce sont celles du bandeau du README et des `media` des manifestes), plus celles des
      tutoriels (`preparatifs`, `choix-de-nuit`, `mj-ia`, `tuto-manifeste`, `tuto-comptes`, `tuto-coffre`, `tuto-voix`).
- [ ] **Relire le dépôt pour les fuites** : aucune adresse interne, aucun nom de machine, aucune clé, aucun vrai nom de
      joueur dans les essais, les docs (`docs/loups-contrat.md`, `docs/plan-loup-garou.md`), les commentaires et l'historique
      git. `git log -p | grep -i -E "172\.|192\.168|\.local|mot de passe|clé" ` pour un premier passage. Les documents
      mentionnent « LaKour », « Jordan » : à garder ou non, au choix.
      Fait sur l'arbre de travail (5 novembre 2026) : la recherche des adresses internes, noms de machine, hébergeurs et
      préfixes de clé (hors sous-module) ne trouve que des faux positifs (coordonnées des SVG, octets de
      `assets/fetes/noel.jpg`, un mot composé de `contenu/en/journaux.json`) ; aucun lien vers un dépôt privé dans les
      README. Reste à faire : l'**historique git**, et les noms des autres mondes La Kour (sans lien) dans `docs/` et dans
      les guides du moteur copiés dans `monde/src/journal/`.
- [ ] **Sous-module** : `.gitmodules` pointe sur `../lakour-mj-ia` (URL relative). Sur GitHub, cela résout vers
      `https://github.com/Hogun974/lakour-mj-ia` : ce dépôt doit **exister et être public** (ou le workflow ne pourra pas le
      récupérer : le jeton `GITHUB_TOKEN` n'a accès qu'au dépôt courant). Le commit du sous-module enregistré ici doit avoir
      été poussé sur GitHub.
- [ ] **Le module MJ IA doit être installable** : `system.json` déclare `relationships.requires` vers
      `https://github.com/Hogun974/lakour-mj-ia/releases/latest/download/module.json`. Publier d'abord une version de
      `lakour-mj-ia` (manifeste `module.json` + `lakour-mj-ia.zip` en release), sinon Foundry signalera la dépendance
      introuvable à l'installation du système. Si l'adresse diffère, la corriger dans `system.json` et dans les deux README.
- [ ] **Branche par défaut** : la branche s'appelle `principale`. Les liens des manifestes utilisent `HEAD`
      (`blob/HEAD/README.md`, `raw.githubusercontent.com/…/HEAD/…`) et marchent quel que soit son nom ; rien à renommer,
      sauf préférence.
- [ ] **Description et sujets du dépôt GitHub** : description courte (« Jeu original de déduction sociale de la famille du
      loup-garou, pour Foundry VTT v14 »), sujets `foundry-vtt`, `foundryvtt`, `werewolf`, `social-deduction`, `game-system`,
      `french`. Activer les **issues**. Désactiver le wiki si inutile.
- [ ] `package.json` : ajouter, si l'autre agent ne l'a pas fait, un script `"empaqueter-paquets": "node outils/empaqueter-paquets.mjs"`
      (le workflow appelle le script directement, ce n'est pas bloquant).

## 2. Première publication (release)

Le workflow part à chaque étiquette `v*`. Convention proposée : **l'étiquette porte la version du système** (`v0.11.1`), le
module et le monde suivent avec leurs propres numéros (le script lit chaque manifeste). Les deux `version` des manifestes
restent la seule source : ne pas les modifier à la main dans la release.

- [ ] Vérifier en local, avant de pousser l'étiquette :
      ```bash
      npm ci && npm run essais && npm run fabriquer-veillees && npm run fabriquer-veillees-en
      node outils/empaqueter-paquets.mjs --tag v0.11.1      # écrit dist/ (module anglais lakour-veillees-en compris)
      npm run empaqueter-monde                              # s'il existe : world.json + <monde>.zip dans dist/
      ```
      et ouvrir les archives (`system.json` / `module.json` à la racine, `packs/` présent dans le module, ni `src/` ni `contenu/`).
- [ ] Pousser le dépôt, puis l'étiquette : `git tag v0.11.1 && git push github v0.11.1` (remote `github`).
- [ ] Suivre l'onglet **Actions** : la release doit contenir `system.json`, `lakour-loups.zip`, `module.json`,
      `lakour-veillees.zip`, `lakour-veillees-en.json`, `lakour-veillees-en.zip` (module anglais, engendré par
      `npm run fabriquer-veillees-en`) et, si le script du monde existe, `world.json` et `la-kour-veillees.zip` (identifiant du monde :
      `la-kour-veillees`, dossier `monde/`). Les manifestes
      publiés portent `manifest` = `releases/latest/download/…` et `download` = `releases/download/v0.11.1/…`.
- [ ] **Essai d'installation à blanc** dans un Foundry v14 vide (pas le serveur de jeu) : installer le système par son
      manifeste, les deux modules, créer un monde, activer les modules, installer le contenu, distribuer une partie à 6 avec
      des joueurs IA, jouer une nuit et un vote. Puis essayer le monde vierge par `world.json`.
- [ ] Vérifier la **mise à jour** : avec une version installée, publier une `v0.11.2` de test (ou attendre la prochaine vraie)
      et voir Foundry la proposer.

Un monde publié doit être **vierge** : aucune partie, aucun compte joueur avec mot de passe, aucune chronique, aucun réglage
client, aucune clé. Le script d'empaquetage du monde en est responsable ; le vérifier sur l'archive.

## 3. Passage en public

- [ ] GitHub › Settings › General › Danger zone › **Change visibility › Public** pour `lakour-veillees` ; pareil pour
      `lakour-mj-ia` (ou au minimum ses releases accessibles : un dépôt privé ne sert pas de manifeste public).
- [ ] Vérifier que les adresses `releases/latest/download/system.json` et `module.json` répondent sans connexion (navigation
      privée).
- [ ] Protéger la branche `principale` (relecture avant fusion, pas de force-push) si d'autres contribuent.

## 4. Adresses à donner aux joueurs

À copier dans Foundry (**Installer un système**, **Installer un module**, **Installer un monde**) :

| Quoi | Adresse |
|---|---|
| Système *Les Veillées de Brumecombe* | `https://github.com/Hogun974/lakour-veillees/releases/latest/download/system.json` |
| Module de contenu *La Kour — Les Veillées de Brumecombe* | `https://github.com/Hogun974/lakour-veillees/releases/latest/download/module.json` |
| Module *La Kour – MJ IA* (requis : le coffre des secrets) | `https://github.com/Hogun974/lakour-mj-ia/releases/latest/download/module.json` |
| Monde vierge tout prêt | `https://github.com/Hogun974/lakour-veillees/releases/latest/download/world.json` |
| Le dépôt, le README, les issues | `https://github.com/Hogun974/lakour-veillees` |

Pour un joueur qui rejoint une table déjà installée : seulement l'adresse d'invitation du serveur de jeu et son compte ; rien à
installer.

## 5. Soumission facultative au catalogue foundryvtt.com/packages

Ce que le site exige (vérifié le 4 novembre 2026 sur foundryvtt.com ; à revérifier au moment de soumettre) :

- Être **titulaire d'une licence Foundry VTT active** : la soumission se fait connecté à son compte foundryvtt.com, par le
  **formulaire de soumission de paquet** (lien dans la FAQ de la page Packages). Les **systèmes et les modules passent par une
  relecture manuelle** de l'équipe Foundry avant d'apparaître ; compter quelques jours.
- Pour chaque paquet (le système et chacun des deux modules sont **trois soumissions séparées**) : l'identifiant (`lakour-loups`,
  `lakour-veillees`, `lakour-mj-ia`), le titre, la description, l'adresse du **manifeste** (stable : `releases/latest/download/…`),
  l'adresse du projet (`url`), les versions de compatibilité (`minimum` 14, `verified` 14.369), le ou les auteurs, et des
  **médias** : une image de couverture et des captures (celles des champs `media` des manifestes, qui doivent être
  **publiquement accessibles** : d'où `raw.githubusercontent.com/…/HEAD/docs/captures/…`, à déposer avant).
- Le manifeste doit être **public et joignable sans connexion**, son `download` doit pointer sur une **archive zip de la seule
  version** (pas sur `latest`) : c'est ce que fait le script (`releases/download/v…/…zip`). Les champs `readme`, `bugs`,
  `changelog`, `license` sont facultatifs mais remplis.
- Pour un **système** : le site demande en plus ce que le système fait tourner (ici : un jeu original, pas un système édité ;
  préciser qu'aucun contenu sous droits n'est inclus) et qu'il soit **installable sans autre paquet payant** ; indiquer que le
  module `lakour-mj-ia` est requis et gratuit.
- Une **licence explicite** est attendue dans le dépôt pour un paquet listé (d'où le point 1). Le site a aussi une
  **AI Content Policy** : déclarer honnêtement que les illustrations sont générées par IA (c'est déjà dit dans le README et
  `CREDITS.md`) ; vérifier à la soumission si une case ou une mention est demandée.
- Après acceptation, chaque nouvelle version se déclare sur la page du paquet (formulaire) ou par l'**API de publication**
  (`POST https://foundryvtt.com/_api/packages/release_version/`, en-tête `Authorization: <jeton fvttp_…>` de la page du
  paquet, corps `{ "id", "release": { "version", "manifest" (l'adresse du manifeste DE CETTE version, pas `latest`), "notes",
  "compatibility": { "minimum", "verified" } } }`). Pour que ce soit automatisable plus tard, le workflow pourrait publier
  aussi `system-<version>.json` ; aujourd'hui l'adresse d'une version précise est celle de l'asset de la release
  (`releases/download/v0.11.1/system.json`), qui convient.

Sans cette soumission, le jeu reste installable par ses manifestes : le catalogue n'apporte que la visibilité et la recherche
depuis Foundry.

## 6. Ensuite

- Tenir `CHANGELOG.md` à jour à chaque version (section « Non publié » puis une section par étiquette).
- ~~Une version anglaise des textes du contenu (rôles, guides) est annoncée dans le README : la planifier ou retirer la
  promesse.~~ Fait : module `lakour-veillees-en` et monde `world-en.json`.
- Les captures vieillissent : les refaire quand l'interface change.

## Release à blanc à la main

Avant de poser une étiquette, on peut rejouer toute la release sur GitHub sans rien publier : onglet **Actions** ›
**Publication** › *Run workflow*, sur `principale` (ou une autre branche). Le workflow fabrique, lance les essais, empaquette
et vérifie exactement comme pour une étiquette, avec la version de `systems/lakour-loups/system.json` (comme si l'étiquette
`v<version>` était posée : hors étiquette, la comparaison étiquette/version ne peut pas échouer). Seule différence : la
release GitHub n'est pas créée, le contenu de `dist/` est déposé en artefact du workflow (à télécharger en bas de la page
du run). La release réelle ne part que sur une étiquette `v*` poussée. À côté, le workflow **Essais** lance la suite
à chaque push et pull request vers `principale`, une fois la variable de dépôt `ESSAIS_AUTOMATIQUES` mise à `oui`
(Settings › Secrets and variables › Actions › Variables) : à faire quand le moteur `lakour-mj-ia` est à jour sur GitHub,
sinon la récupération du sous-module échoue à chaque envoi. À la main (Run workflow), il tourne toujours.

## Release à blanc du 4 novembre 2026

Chaque workflow a été rejoué étape par étape (Ubuntu 24.04 sous WSL, **Node 24.22**, npm 10) dans un clone neuf
`git clone --recurse-submodules`, avec un tag local et les variables `GITHUB_REF_NAME` / `GITHUB_REPOSITORY` du runner ;
les archives produites ont été relues (manifeste à la racine, chemins `/`, `packs/` complets, ni `src/`, ni `contenu/`, ni
`essais/`, ni `node_modules`, ni `.git`, CRC vérifiés). Les actions sont passées en versions Node 24
(`actions/checkout@v5`, `actions/setup-node@v5`, `softprops/action-gh-release@v3` : les v4/v2 tournent encore sous
Node 20, en fin de vie sur les runners GitHub).

Constats et corrections :

- **Piège trouvé : les scripts ne s'exécutaient pas sous Linux.** La garde « lancé directement ? » écrite
  ``import.meta.url === `file:///${process.argv[1]…}` `` est toujours fausse sur le runner (`argv[1]` commence déjà par
  `/`, d'où `file:////…`) : le script se termine **sans rien faire et sans erreur**. Corrigé dans `outils/empaqueter-paquets.mjs`
  (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`). Sans cela : aucun `dist/`, puis échec des copies du monde.
- Nouvelle étape de garde : l'étiquette doit être `v<version de systems/lakour-loups/system.json>` (convention ci-dessus) ;
  rien ne le vérifiait. Conséquence à connaître : une version **qui ne change que le contenu** exige quand même un
  nouveau numéro de système (une étiquette ne sert qu'une fois).
- `actions/checkout` reçoit `token: ${{ secrets.SOUS_MODULE_TOKEN || github.token }}`.
- Le monde publié (`world.json`) garde `download` = `releases/latest/download/…` (pas daté de l'étiquette) : il marche,
  mais une ancienne version du monde n'est plus téléchargeable par son manifeste.

- [x] **Bloquant, hors des fichiers touchés ici** (corrigé : la garde compare désormais
      `pathToFileURL(resolve(process.argv[1])).href` à `import.meta.url`) : même garde cassée dans `outils/fabriquer-veillees.mjs` :
      `npm run fabriquer-veillees(-en)` ne fabrique rien sous Linux (pas de `packs/`, pas de module anglais) et
      l'empaquetage échoue. Remplacer la ligne par
      `if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {` (imports `node:path`,
      `node:url`).
- [ ] `lakour-mj-ia` public (ou secret `SOUS_MODULE_TOKEN`) avant de pousser l'étiquette.
