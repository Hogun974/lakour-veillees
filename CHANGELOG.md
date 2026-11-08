# Changements

Deux numéros de version avancent ensemble : celui du **système** `lakour-loups` et celui du **module de contenu**
`lakour-veillees`. Chaque publication GitHub (étiquette `v<version du système>`) emporte les deux, plus le monde vierge.
Le moteur commun `lakour-mj-ia` a son propre journal dans [son dépôt](https://github.com/Hogun974/lakour-mj-ia).

## Système 0.13.1 · Contenu 0.16.0 — 7 novembre 2026

Le chantier **« Le Pacte »** (6 et 7 novembre). Cette section regroupe aussi les numéros intermédiaires système 0.12.0, 0.12.1
et 0.13.0, contenu 0.15.0 et 0.15.1. Moteur MJ IA 0.43.0 à 0.44.1.

- **Fuites par déduction** (relecture adverse, 8 novembre) : l'Enfouissement cache toute mort « de la nuit » ; le Méchant Benêt
  choisit parmi tous les vivants (un loup désigné : rien) ; le Spectre attend le geste du Toucher mortel ; la Somnambule parle
  chaque matin, Liseuse en jeu ou non ; la Revenue ne ramène jamais un mort qui a tout vu ; la même pause avant chaque révélation
  d'un condamné, Chambrière en jeu ou non ; le jour, aucune activité masquée ni tintement pour un choix secret ; le Spirite par
  défaut tiré au sort ; l'appel des charmés au chat quand la Table mène la nuit ; les oies cacardent sans nom (la Gardeuse le sait
  à son carnet) ; sous l'Exécuteur, le Glas du deuil se tait et l'Aïeul exécuté ne retourne pas sa carte. Le métier « Colporteur
  de nouvelles » devient « Newsmonger » en anglais ; le bouton « Activer l'audio » garde la vidéo d'un monde qui l'a.
- **Le Pacte** : un niveau qui rejoue, règle pour règle, le jeu de loups-garous de soirée avec ses extensions, sous nos noms et
  avec nos textes (aucun texte ni nom d'un jeu édité). Ses seuls personnages, sans bâtiments communaux ni métiers, de 6 à 18
  joueurs ; proposé d'abord à la préparation ; treize compositions prêtes (`le-pacte-06` à `-18`) ; la **Liseuse de cendres**
  dans toute composition du niveau ; ordre d'appel du jeu de soirée (première nuit, chaque nuit, chaque jour). Nos créations
  restent disponibles en option (rôles choisis à la main, bâtiments choisis).
- **Socle** : le cercle des places (voisins de gauche et de droite), les derniers gestes choisis par le mourant (la Braconnière
  désigne elle-même), les rôles publics dès la distribution, les bâtiments tenus, les charges, les événements.
- **Rôles alignés** sur le jeu de soirée : Loup affamé, Louve mère, Liseuse de cendres, Herboriste (deux fioles la même nuit),
  Braconnière, Enfant de la brume, Garde du pont (contre la meute seulement), Entremetteuse, Bailli (sa voix tranche l'égalité),
  Peste noire ; le montreur des gens de passage devient le **Montreur de marmotte**.
- **Rôles nouveaux** : au Village, Franc-Villageois, Aïeul, Souffre-douleur, Innocent, Lavandières, Bûcherons, Furet, Gardeuse
  d'oies, Greffier bègue, Vieux Sergent, Pie, Incendiaire, Liseuse d'étoiles ; les visages changeants Chapardeur, Bateleur,
  Mâtin, Enfant des bois, Chambrière ; les solitaires Feu follet, Joueur de vielle, Illuminé ; le Loup pâle. Réglage
  « L'Innocent suit l'Aïeul ».
- **Le Village** (variante) : neuf personnalités publiques qui tiennent les bâtiments (Métayers, Prieur, Remégeux, Régent,
  Fournière, Perruquier, Cabaretier, Prévôt, Hobereau), les Chemineaux, l'Incendiaire ; les Métayers désignent le Bailli dès le
  deuxième jour ; encart « Le Village » de la Table pour changer les occupants avant la première nuit.
- **Variantes du jeu de soirée** : Veillée aux chandelles (et angoissante), Chaîne des innocents, Mur des murmures, Double visage
  (petite et grande complication, case « une allégeance loup de plus »), Vendanges, Envoûtement ; peste noire jouable au niveau
  Le Pacte. Exclusions : aucune variante dans une Nuit de la Saint-Martin ; ni Double visage, ni Vendanges, ni Envoûtement à la
  petite tablée ou dans une peste.
- **La Gazette de la lune** : 31 cartes Événement (immédiates, différées, permanentes ; chaque matin, un sur deux ou un sur
  trois ; au choix du narrateur ; permanentes dès le début), le **Crieur public** (charge nommée par le Bailli, 3 cartes en main
  par défaut), l'**Exécuteur**, la **Liseuse d'étoiles** et ses cinq séances de Spiritisme (réponse vraie calculée) ; les
  **traits visibles** des personnages (genre d'après le prénom, âge, lunettes, bijou, coiffe, sabots, pipe, bourg ou écart),
  que les cartes lisent ; l'Illuminé peut partager le village selon un trait. Sans Almanach des brumes.
- **Partie simple** : réglages « Bâtiments du village » (aucun, tirés au hasard, choisis) et « Métiers », pour tous les niveaux.
- **Explication à la distribution** : chaque joueur humain reçoit dans son carnet secret « Comment jouer : son rôle » (ce qu'il
  fait, quand il est appelé, ce qu'on lui demandera, ses usages, comment il gagne, sa seconde carte, son métier, sa
  personnalité).
- **Table de jeu** : préparation en onglets (Joueurs, Composition, Village, Variantes, Gazette et fête), résumé des choix actifs
  et bouton Distribuer toujours visibles ; en-tête qui dit la composition en clair.
- **Équilibre mesuré** : un simulateur de parties complètes (`essais/outils/simuler-veillees.mjs`), des politiques par rôle
  pour les joueurs simulés et les compagnons (`logique/politiques.mjs`), une calibration des poids par régression ; une adresse
  de référence par niveau (débutants 0,5 ; classique et Le Pacte 0,75 ; chaos 1). Débutants : un loup de moins. Revenant :
  gagne exécuté à partir du troisième jour ; Chasseur de primes : sa cible doit tomber au plus tard le deuxième jour. Mesuré, la
  meute gagne 51 % au niveau Le Pacte, 54 % au classique, 51 % au chaos, 52 % aux débutants. Avertissements chiffrés et conseils
  de dosage dans les guides (Chaîne des innocents, Double visage). Détail : `docs/equilibre-veillees.md`.
- **Caméras** : la caméra d'un joueur est remplacée par un loup-garou la nuit (tous les vivants), pour les morts, les partis, les
  spectateurs, les absents du jour de la Gazette et les réduits au silence ; sa piste vidéo est éteinte à la source, d'après
  l'état public seul. Réglages « Caméras remplacées par le loup-garou » et « Image à la place d'une caméra » ; le logo
  (`assets/camera/loup-garou.webp`, FLUX.2 klein 9B dans ComfyStudio) et son repli SVG. Le réglage « Caméras des joueurs
  permises » et le bloc de la console sont au moteur MJ IA (0.44.0).
- **Après les parties en vrai du 7 novembre** : messages accordés au féminin (Métayère, Prieure, Crieuse publique…), le Hobereau
  qui se gracie lui-même ; après la victoire, plus aucune fenêtre ni demande, chaque tâche de fond s'arrête ; le villageois d'un
  joueur humain laissé hors de la distribution quitte le village.
- **MJ IA** (moteur 0.43.0 à 0.44.1) : le narrateur et les compagnons mènent tous les rôles, variantes, cartes et demandes du
  Pacte (outils `loups_gazette` et `loups_pacte`) ; les compagnons sans modèle jouent d'après les politiques du système ; le
  pilote ne compte que les humains connectés de la partie en cours ; le coût de la séance s'affiche en direct et reste compté
  après un rechargement ; le modèle des compagnons se choisit dans une liste ; les joueurs hors ligne sont laissés de côté à la
  composition.
- Guides du joueur, du narrateur et des variantes, aides et interface en français et en anglais ; README et tutoriels mis à jour.

## Système 0.11.3 · Contenu 0.14.2 — 6 novembre 2026

- **Mise à jour des journaux : pages intactes mieux reconnues** (`scripts/mise-a-jour.js`, commun aux quatre modules LaKour) :
  à la création d'une page, le serveur Foundry pose sa date de modification quelques millisecondes après sa date de création
  (1 à 59 ms relevés sur LaKour). Une page importée avant les empreintes passait donc pour retouchée et n'était plus remise à
  jour. Elle compte maintenant comme intacte si elle n'a pas été modifiée plus de 5 secondes après sa création.

## Système 0.11.2 · Contenu 0.14.1 — 5 novembre 2026

- **Mise à jour des mondes déjà installés** (`scripts/mise-a-jour.js`, fichier commun aux modules de contenu LaKour) : un
  journal déjà importé n'est plus remplacé en bloc. Les pages nouvelles du compendium sont ajoutées, les pages que personne
  n'a retouchées reprennent le texte et le rang du compendium (avec leurs identifiants : les épingles des cartes les visent),
  celles que le compendium n'a plus sont retirées ; les pages retouchées à la main restent telles quelles et sont nommées au MJ
  dans le rapport d'installation (avant : les retouches étaient perdues), les pages ajoutées ou réécrites par le MJ IA restent
  protégées. Chaque page importée porte une empreinte de son texte. Un essai lie le numéro de contenu de l'installateur à
  `module.json` (`essais/mise-a-jour-journaux.test.mjs`).

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
