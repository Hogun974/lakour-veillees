# Plan — troisième monde : un jeu de loup-garou mené par le MJ IA

Demande de Jordan (31/10/2026) : un monde Foundry pour jouer au loup-garou, avec village, bâtiments et métiers, comme dans
sa boîte des *Loups-Garous de Thiercelieux* et ses extensions.

## Ce qu'on fait, et ce qu'on ne fait pas

On **ne reproduit pas** *Les Loups-Garous de Thiercelieux* : ni ses cartes, ni ses illustrations, ni ses textes, ni la liste
précise de ses rôles, bâtiments et métiers d'extension. C'est le contenu d'un jeu édité, même pour un usage privé.

On crée **un jeu original de la même famille**, celle des jeux de déduction sociale nés du jeu de société traditionnel
« Mafia / Loup-garou » : un village, des innocents, des loups cachés, des nuits où ils frappent et des jours où le village vote.
Ce sont des mécanismes de genre, libres. Nos rôles, nos bâtiments, nos métiers, nos textes et nos images sont à nous.
Jordan garde sa boîte pour jouer autour d'une table ; dans Foundry, il joue à notre jeu.

Nom de travail : **« Les Veillées de Brumecombe »**, un village de vallée isolé par la brume d'automne.

## Le jeu

- **De 6 à 18 joueurs**, à distance (Foundry). Le **MJ IA est le narrateur** : il annonce la nuit et le jour, réveille les
  rôles en secret, raconte les morts au matin, anime le débat et dépouille les votes. Personne ne doit sacrifier sa place
  de joueur pour être meneur.
- **Les camps** : le Village (gagne quand plus aucun loup ne vit), la Meute (gagne quand elle est aussi nombreuse que le
  village), et des solitaires avec leurs propres conditions de victoire.
- **Le cycle** : la nuit, les rôles agissent en secret (messages privés, fenêtre de choix) ; à l'aube, le narrateur révèle ;
  le jour, débat minuté puis vote public ; l'exécuté révèle son rôle (réglable).
- **Les rôles** : une trentaine, tous originaux. Exemples de notre cru, à affiner :
  - *la Veilleuse de lanterne* : chaque nuit, elle éclaire une maison ; si un loup y entre, il est démasqué à l'aube ;
  - *le Sonneur* : une fois par partie, il fait sonner la cloche, et le vote du jour est double ;
  - *l'Herboriste* : un remède (sauver la victime de la nuit) et un poison (tuer), une fois chacun ;
  - *le Colporteur* : il échange en secret son rôle avec celui d'un autre joueur, une fois ;
  - *le Loup affamé* : il tue seul une seconde fois, une nuit sur deux ;
  - *le Revenant*, solitaire : il gagne s'il est exécuté par le village.
- **Les bâtiments** (notre « village ») : chaque partie tire 4 à 6 lieux qui changent les règles. Exemples :
  - *la Chapelle* : protège un joueur par nuit ;
  - *le Moulin* : révèle au meunier le nombre de loups encore vivants ;
  - *la Taverne* : les joueurs qui y dorment se protègent mutuellement, mais un loup peut s'y cacher ;
  - *le Gibet* : le vote du jour exige la majorité absolue ;
  - *le Puits* : un mort par partie peut transmettre un dernier mot.
- **Les métiers** : chaque villageois a, en plus de son rôle, un métier public avec un petit pouvoir de jour (forgeron,
  meunière, garde, curé, chasseresse…). C'est ce qui donne de la vie au débat, sans en livrer le camp.
- **Variantes** : nombre de loups, révélation des rôles à la mort, temps de débat, rôles autorisés, ambiance (gothique
  sérieux ou comique).

## Dans Foundry

Il n'existe pas de système Foundry libre pour ce genre de jeu. On écrit donc **un petit système de jeu** (`lakour-loups`),
plus **un module de contenu** (`lakour-veillees`), comme pour les deux autres mondes :

- **Système `lakour-loups`** :
  - acteurs « villageois » (joueur, rôle secret, métier public, vivant ou mort, votes) ;
  - objets « rôle », « métier », « bâtiment » ;
  - une **table de jeu** (fenêtre) : cycle nuit/jour, minuteur, vote cliquable, révélations ;
  - les choix de nuit des joueurs se font dans une fenêtre privée, et seul le MJ (humain ou IA) les voit.
- **Module de contenu `lakour-veillees`**, selon le même contrat que lakour-40k et lakour-warcraft (`lakour-mj-ia/scripts/contenus.js`) :
  - rôles, métiers, bâtiments et leurs textes ;
  - la carte du village de Brumecombe (une maison par joueur, place, bâtiments), avec son plan pour le placement ;
  - les jetons (game-icons, CC BY) et `figurants.json` (villageois anonymes) ;
  - un guide du joueur et un guide du MJ ;
  - des tables : noms de villageois, rumeurs, présages, morts mystérieuses ;
  - des compositions de partie toutes prêtes, de 6 à 18 joueurs.
- **MJ IA** : un adaptateur `lakour-loups` (comme `impmal` et `dnd5e`) et des outils propres :
  - distribuer les rôles en secret ;
  - mener la nuit (réveiller chaque rôle par message privé et attendre son choix) ;
  - révéler l'aube ;
  - ouvrir et clore le vote ;
  - tenir la chronique de la partie.

## Ce qui vient des deux autres mondes (règle de parité)

Tout ce qui sert déjà en 40k et en Warcraft sert aussi ici :
- la voix du narrateur ;
- les personnalités du MJ (un narrateur gothique, un conteur malicieux…) ;
- la mise en place du plateau avant la narration ;
- les cartes à plan et les repères (« devant la chapelle ») ;
- les figurants ;
- la vue 3D ;
- les ambiances sonores (*nuit* et *tension* surtout) ;
- les messages privés, cœur du jeu ;
- la chronique « Précédemment… » ;
- la sauvegarde nocturne (le monde s'ajoute tout seul, le script prend tous les mondes) ;
- la validation Foundry ;
- les essais.

Et inversement, ce qu'on construit ici profitera aux deux autres :
- la **fenêtre de vote** pourra servir aux décisions de groupe en 40k et en Warcraft ;
- les **choix secrets** pourront servir aux trahisons et aux intrigues.

## Étapes

1. Jordan valide l'idée d'un jeu original, son nom, et sa liste de rôles, bâtiments et métiers. Je fais une proposition
   complète à relire.
2. Système `lakour-loups` minimal : acteurs, objets, table de jeu, votes. Essais et validation Foundry.
3. Module `lakour-veillees` : contenu, carte du village, jetons, guides.
4. Adaptateur et outils du MJ IA, mené de bout en bout par l'IA. Essais sur une partie simulée (doublures, sans appel payant).
5. Création du monde sur LaKour, installation, partie d'essai avec Jordan.

## Proposition complète (à relire par Jordan)

Tous ces noms et pouvoirs sont de notre invention ; ceux qui ressemblent à des classiques du genre (voir un rôle, protéger,
tuer la nuit) sont les mécanismes de base de tout jeu de loup-garou.

### La Meute

| Rôle | Pouvoir |
|---|---|
| Loup de Brumecombe | Chaque nuit, avec la meute, choisit une victime. |
| Loup affamé | Une nuit sur deux, tue seul une seconde victime. |
| Loup déguisé | Apparaît comme villageois à toute vision ; perd ce masque s'il est désigné par le vote sans être exécuté. |
| Louve mère | Une fois par partie, au lieu de tuer, mord : la victime rejoint la meute en secret. |
| Loup hurleur | La nuit, peut imposer le silence à un joueur, qui ne pourra pas parler au débat du lendemain. |

### Le Village

| Rôle | Pouvoir |
|---|---|
| Villageois | Aucun pouvoir, une voix. |
| Veilleuse de lanterne | Éclaire une maison chaque nuit : si un loup y entre, il est démasqué à l'aube. |
| Liseuse de cendres | Chaque nuit, apprend le camp d'un joueur (pas son rôle). |
| Herboriste | Un remède (sauve la victime de la nuit) et un poison (tue), une fois chacun. |
| Garde du pont | Protège un joueur par nuit, jamais deux fois de suite le même. |
| Sonneur | Une fois par partie, sonne la cloche : le vote du jour compte double. |
| Fossoyeur | Chaque matin, apprend le rôle exact d'un mort. |
| Braconnière | Si elle meurt, elle emporte un joueur de son choix. |
| Conteuse | Une fois par partie, impose un débat de deux minutes sur un joueur désigné, sans qu'il puisse répondre. |
| Juge de paix | Peut annuler un vote par partie ; le village revote. |
| Enfant de la brume | Peut épier la meute la nuit, mais s'il est repéré (au hasard), il est la victime. |
| Ermite | Voit un joueur qui a agi la nuit (sans savoir lequel de ses actes). |
| Messager | Peut transmettre un message secret entre deux joueurs, une fois par nuit. |

### Les solitaires

| Rôle | Victoire |
|---|---|
| Revenant | Gagne s'il est exécuté par le village. |
| Lien d'amour (désigné par l'Entremetteuse) | Deux amants gagnent ensemble, quel que soit leur camp ; si l'un meurt, l'autre aussi. |
| Entremetteuse | Unit deux amants la première nuit, puis joue avec le village. |
| Colporteur | Échange en secret son rôle avec un autre joueur, une fois ; gagne avec son nouveau camp. |
| Chasseur de primes | Reçoit une cible au début : gagne si elle est exécutée de jour. |
| Pyromane | Asperge une maison par nuit ; une nuit, met le feu à toutes les maisons aspergées ; gagne seul. |

### Bâtiments de Brumecombe (4 à 6 par partie)

Chapelle, Moulin, Taverne, Gibet, Puits, Forge, Cimetière, Pont, Lavoir, Grange : chacun change une règle (protection,
information, vote, dernier mot, objet, etc.), et chacun est un lieu de la carte du village où les jetons se rassemblent.

### Métiers publics (jour)

Forgeron (répare une protection), meunière (connaît la meute restante), garde (empêche une visite), curé (bénit, protège du
silence), chasseresse (piste les allées et venues), aubergiste (sait qui a dormi chez lui), apothicaire, colporteur de
nouvelles, tisserande, passeur, tanneur, maîtresse d'école : un petit pouvoir de jour public, qui anime le débat.

### Compositions prêtes

De 6 joueurs (2 loups, Liseuse, Garde, 2 villageois) à 18 joueurs (5 loups dont un affamé, 8 rôles de village, 2 solitaires,
3 villageois), avec un réglage « débutants », « classique » et « chaos ».
