# Changements

Deux numéros de version avancent ensemble : celui du **système** `lakour-loups` et celui du **module de contenu**
`lakour-veillees`. Chaque publication GitHub (étiquette `v<version du système>`) emporte les deux, plus le monde vierge.
Le moteur commun `lakour-mj-ia` a son propre journal dans [son dépôt](https://github.com/Hogun974/lakour-mj-ia).

## Non publié

- Sécurité (revue) : la nuit, et pendant un choix secret, le navigateur d'un joueur ne diffuse plus son activité Foundry
  (curseur, ping, règle, cibles, déplacements prévus, voyant « parle » : `scripts/activite.mjs`, lu dans le client et le
  serveur v14) ; un loup et un villageois envoient les mêmes messages du soir au matin (`essais/activite-nuit.test.mjs`). Un
  spectateur n'entend plus la tanière ; un message de socket sans émetteur est refusé ; le carnet nettoie son HTML
  (`cleanHTML`) ; les notes d'un villageois ne gardent plus de bloc secret. README : ce que la console montre vraiment
  (chuchotements, clé du coffre, MJ assistant, mot de passe du Gamemaster). `.gitignore` : `.env`, clés de secours.

## Système 0.11.1 · Contenu 0.14.0 — 4 novembre 2026

- **Contenu 0.14.0 — Le livre de Brumecombe** : un journal d'univers lisible des joueurs, installé dans le monde avec les
  guides, douze pages à lire avant la première veillée : la vallée et sa brume, une histoire du village, les dix-huit maisons
  et leurs métiers, la foi et les superstitions, la Meute dans les contes, la Veillée comme coutume, l'année de Brumecombe,
  des visages, dix rumeurs, le parler local et le récit d'une première veillée. Liens vers les rôles, métiers et bâtiments ;
  encadrés « paroles d'anciens » (`html()` accepte les blocs « > »). Version anglaise « The Book of Brumecombe ».
- Préparation de la publication : manifestes étoffés (`url`, `manifest`, `download`, `readme`, `bugs`, `changelog`,
  `license`, `media`, dépendance déclarée au module MJ IA), README en français et en anglais, script d'empaquetage
  `outils/empaqueter-paquets.mjs`, workflow de publication sur étiquette `v*`, liste de contrôle `docs/publication.md`.

## Système 0.11.1 · Contenu 0.13.1 — 3 novembre 2026

- Contre-relecture de la Petite tablée : annonces, règles de tirage et équilibre mesurés à nouveau.

## Système 0.11.0 · Contenu 0.13.0 — 3 novembre 2026

- **Petite tablée** : le mode pour 1 à 4 humains complétés par 2 à 8 compagnons IA, de 4 à 12 places. Meute courte, régime
  des deux loups (première nuit blanche, la meute doit être plus nombreuse pour gagner), humains jamais tous loups ni tous du
  même camp, penchants favorisés tirés en secret (une lanterne chez un humain, l'ombre des deux côtés), le sort tranche les
  égalités, glas final posé d'office ; les compagnons parlent d'abord aux humains.
- Contenu : compositions prêtes « Petite tablée — 4 à 12 places », page du guide du joueur, section du guide du narrateur,
  ligne des Variantes. Moteur MJ IA 0.39.0.

## Système 0.10.2 — 3 novembre 2026

- Annonces de mort neutres : une mort de nuit est annoncée de la même façon quelle qu'en soit la cause.

## Système 0.10.1 — 3 novembre 2026

- Le MJ est averti quand la clé du coffre manque à son navigateur (reprise depuis un autre navigateur, clé de secours).

## Système 0.10.0 · Contenu 0.12.0 — 3 novembre 2026

- **Veillées de fête** : une variante de saison par fête du calendrier, au choix du narrateur à la distribution (la date la
  propose, jamais ne l'impose) : **Nuit des âmes**, **Veillée d'hiver**, **Carnaval des masques**, **Fête des promis**.
- Contenu : un journal illustré par veillée (illustrations générées localement), page « Les veillées de fête » dans les deux
  guides, déclinaison des fêtes auprès du moteur. Moteur MJ IA 0.37.0.

## Système 0.9.0 · Contenu 0.11.0 — 3 novembre 2026

- **Plus aucun secret dans les documents** : rôles, camps, amoureux et protections quittent les fiches ; chaque joueur reçoit
  sa fiche par le socket, à lui seul ; carnet et vue de mort rangés par monde et par compte ; chuchotements de joueur refusés
  pendant une partie, canal des morts relayé par le MJ ; jets de dés privés sans message de chat ; migration des parties en
  cours. Coffre scellé avec la clé du moteur (parts de Shamir à seuil majoritaire, clé de secours, révision du coffre,
  passation au changement de MJ actif). Essai de non-fuite sur des parties complètes.
- Illustration de l'écran d'accueil du monde. Moteur MJ IA 0.35.0 (fil de l'IA chiffré, voix privées par socket).

## Système 0.8.0 · Contenu 0.10.0 — 2 novembre 2026

- **Gens de passage** (Rémouleur, Montreur d'ours, Pèlerine) pour un joueur qui arrive en cours de partie ; quitter la veillée
  sans mourir ; vote d'exil.
- **Banc des accusés**, **Glas du deuil**, **Nuit de la Saint-Martin** (format court). Moteur MJ IA 0.32.0.

## Système 0.7.0 · Contenu 0.9.0 — 2 novembre 2026

- **Dernier souffle** (chaque mort garde une voix), **Almanach des brumes** (un présage par aube), rôles sur demande
  **Somnambule** et **Rosière**, **Glas final** et **Bonne étoile** (Saints du calendrier). Moteur MJ IA 0.31.0.

## Système 0.6.0 · Contenu 0.8.0 — 2 novembre 2026

- **Le Bailli** (élu le premier jour, voix double, départage, succession), **le Registre du greffier** (votes voix par voix,
  morts, déclarations), **les Masques de veillée** (rôles absents remis en secret à la meute). Moteur MJ IA 0.29.0.

## Système 0.5.0 · Contenu 0.7.0 — 2 novembre 2026

- Coffre chiffré des secrets, reprise depuis un autre navigateur ; rôle **Herboriste** (remède et poison).
- **Peste noire** (variante rare sans loups, cri « C'est la peste noire ! »), composition secrète, village vierge sans IA.
- Le village repart de zéro à chaque lancement du monde ; installateur tolérant au réglage de style absent.

## Contenu 0.6.0 — 2 novembre 2026

- Nouveaux visages de la veillée : quatre rôles (Loup des roseaux, Louvetier, Pêcheur de nuit, Dame du gué) et deux métiers
  (Ramoneuse, Éclusière).

## Contenu 0.5.0 — 2 novembre 2026

- Brumecombe épinglé : chaque bâtiment de la carte renvoie à sa page de règles ; journaux qui gardent leur identifiant.
- Fiches et carte de rôle à la manière des systèmes récents ; immersion Foundry v14 (brume nocturne, lueurs de l'aube,
  tremblement à une mort, envolée de la victoire) ; sons d'ambiance natifs dans la scène du village.

## Système 0.4.0 · Contenu 0.4.0 — 1er novembre 2026

- **Salons vocaux** automatiques avec la voix intégrée de Foundry : la nuit, silence (les loups entre eux) ; les morts entre
  eux ; les réduits au silence muets. Moteur MJ IA 0.28.0.
- Signal « à toi » (tintement, titre qui clignote) ; Chroniques de Brumecombe (palmarès et histoire des veillées) ; vote clos
  de lui-même à la fin du minuteur ; récit de fin de partie ; bandeau de la veillée (Voter, ouvrir et clore le vote, temps
  restant, rôle et métier) ; infobulles ; Ordre de nuit et bouton Réveiller de la Table de jeu.

## Système 0.3.0 · Contenu 0.3.0 — 1er novembre 2026

- **Plateau interactif** : jetons neutres posés et mis en scène à chaque phase, vote et choix de nuit au clic ; **MJ humain
  guidé** par la Table de jeu ; **joueurs IA** (compagnons) avec ou sans séance du MJ IA.

## Système 0.2.1 · Contenu 0.2.1 — 1er novembre 2026

- Première version dans ce dépôt : système `lakour-loups` (acteurs villageois, objets rôle, métier et bâtiment, Table de jeu,
  cycle nuit/aube/jour/vote, votes, secrets), module de contenu `lakour-veillees` (rôles, métiers, bâtiments, carte du
  village, guides, tables, compositions de 6 à 18 joueurs, jetons) et moteur MJ IA en sous-module. Historique antérieur :
  archive `foundry-modules`.
