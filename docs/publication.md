# Publication — liste de contrôle

Ce qu'il reste à faire, dans l'ordre, pour passer le dépôt en public et rendre le jeu installable depuis Foundry. Tout ce qui
est automatisé l'est par `.github/workflows/release.yml` et `outils/empaqueter-paquets.mjs` ; le reste est à la main.

## 1. Avant le passage en public

- [ ] **Licence** : choisir (proposition : code MIT ; textes et images CC BY-NC-SA 4.0), créer `LICENSE` (et, si deux
      licences, `LICENSE-CONTENU` ou une section claire), retirer le `TODO` du README (français et anglais), rappeler la
      licence dans `modules/lakour-veillees/CREDITS.md`, et mettre à jour le champ `license` des deux manifestes (il pointe
      pour l'instant sur `README.md#licence`). Vérifier que CC BY 3.0 (game-icons) reste citée.
- [ ] **Captures** : déposer les PNG listés dans `docs/captures/LISEZ-MOI.md` (au moins `village`, `table-de-jeu`, `vote`,
      `carte-de-role`, `chroniques` : ce sont celles du bandeau du README et des `media` des manifestes).
- [ ] **Relire le dépôt pour les fuites** : aucune adresse interne, aucun nom de machine, aucune clé, aucun vrai nom de
      joueur dans les essais, les docs (`docs/loups-contrat.md`, `docs/plan-loup-garou.md`), les commentaires et l'historique
      git. `git log -p | grep -i -E "172\.|192\.168|\.local|mot de passe|clé" ` pour un premier passage. Les documents
      mentionnent « LaKour », « Jordan » : à garder ou non, au choix.
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
- Une version anglaise des textes du contenu (rôles, guides) est annoncée dans le README : la planifier ou retirer la
  promesse.
- Les captures vieillissent : les refaire quand l'interface change.
