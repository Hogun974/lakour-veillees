# Équilibre des Veillées de Brumecombe

*Le Pacte, étapes 6, 6b et 6c (novembre 2026) ; puis la Liseuse de cendres dans toute composition du niveau Le Pacte (après les
parties en vrai du 7 novembre, section « Le Pacte : la Liseuse de cendres dans toute composition ») ; puis le Vieux Sergent dans la
réserve des débutants et 7 joueurs conseillés à Le Pacte (section « Débutants : le Vieux Sergent ; Le Pacte : 7 joueurs conseillés »). Les poids des rôles et la cible du générateur ne sont plus posés à la main : ils sont
mesurés par simulation. L'étape 6 les a calibrés avec des joueurs simulés parfaits (adresse 1) ; l'étape 6b les recalibre avec une
**adresse par niveau**, celle d'une vraie soirée (débutants 0,5 ; classique et Le Pacte 0,75 ; chaos 1), retouche deux solitaires
(Revenant, Chasseur de primes) et chiffre les variantes du livre que leur règle déséquilibre. L'étape 6c tranche ce que la 6b laissait
« à décider » : un loup de moins aux débutants, un réglage « une allégeance loup de plus » pour Double visage, des joueurs simulés
qui se méfient du Joueur de vielle. Ce document dit comment, avec quelles graines, ce qui a été mesuré avant et après, et comment
remesurer.*

## La méthode

### La partie simulée

`essais/outils/partie-loups.mjs` joue une partie **entière** avec le vrai système `lakour-loups` (API, socket, résolution de la nuit,
votes, derniers gestes, Le Village, variantes, Gazette), le vrai contenu (rôles, métiers, bâtiments, `equilibre.json`) et les
**outils du MJ IA** (`loups_nuit`, `loups_vote`, `loups_eliminer`) sur la doublure de Foundry (`essais/doublures/foundry-loups.mjs`).
C'est la partie de l'essai d'intégration, sortie de `essais/integration-loups.test.mjs` (qui s'en sert tel quel : mêmes graines,
mêmes parties, mêmes vérifications) ; le simulateur la joue avec `verifier: false` (ni plateau ni invariants : trois fois plus vite)
et par la voie de la Table de jeu (`api.nouvellePartie` : composition exacte, bâtiments, métiers, variantes). Chaque partie a sa
graine : même graine, même partie.

### Les joueurs : les politiques par rôle et l'adresse

Les joueurs simulés suivent les **politiques par rôle** du système (`systems/lakour-loups/logique/politiques.mjs`, logique pure,
exposée à `api.logique` : les compagnons IA pourront s'en servir) : pour chaque effet de rôle, chaque geste, chaque pouvoir de jour et
chaque vote, ce que ferait un joueur d'après **ce qu'il sait** — son carnet (visions de la Liseuse et des autres, lanterne, flair du
Furet, Fournière, Prieur, Pèlerine, cible du Chasseur de primes, amour), le chat public (tombes, rasoir, oies), les rôles révélés, le
Registre (qui a voté contre un loup démasqué est presque sûrement du Village), et ce qui s'est **dit au débat** : un villageois
adroit annonce les loups qu'il a découverts (il devient alors la cible de la meute), un loup adroit accuse parfois un innocent (une
annonce démentie par une révélation trahit son auteur).

L'**adresse** (0 à 1) est la probabilité, à chaque décision, d'user de cette information ; sinon le joueur fait comme les joueurs au
hasard d'avant l'étape 6 (qui restent ceux de l'essai d'intégration). Quelques choix :

- la Liseuse et les visions sondent un inconnu, le plus soupçonné d'abord ; la Veilleuse veille là où la meute frappera (un rôle
  utile révélé, ou qui a parlé) ; le Fossoyeur, une tombe dont il ignore le rôle ;
- le Garde (et la Gardienne) protège un rôle utile révélé, ou qui a parlé, sinon un sûr ;
- l'Herboriste sauve la victime (sauf un loup connu) et empoisonne un loup connu, sinon garde son poison ;
- la meute s'accorde sur une proie commune, d'abord un rôle d'information révélé ou qui a parlé ; au vote, elle suit la rumeur du
  village quand elle tombe sur un innocent, sinon sa proie concertée ;
- le village vote contre un loup connu, sinon contre le plus soupçonné, jamais contre un innocent connu ; il s'accorde sur la rumeur du
  jour (le plus accusé au débat, les annonces d'un joueur dont une accusation s'est vérifiée comptant triple) quand elle vaut ses
  soupçons ; les charmés cherchent ensemble le Joueur de vielle parmi les non-charmés, l'accusent au débat, et le village comme la
  meute le visent quand il menace de gagner (étape 6c, plus bas) ; un solitaire découvert est visé (jamais le Revenant) ;
- le Pêcheur de nuit, la Pie, la Braconnière, le Perruquier (rasoir) visent un loup connu (le harpon et le rasoir attendent sinon) ;
- les solitaires votent contre ceux qu'ils veulent voir tomber (la cible du Chasseur de primes, l'autre groupe de l'Illuminé) ;
- le Mâtin rejoint la meute deux fois sur cinq (un goût, pas une adresse) ; le Juge de paix annule si un condamné est un innocent sûr.

Avec des joueurs adroits, le narrateur simulé ne joue plus au hasard les pouvoirs de jour des joueurs à leur place (chacun use des
siens). La référence de la calibration est, depuis l'étape 6b, l'**adresse de chaque niveau** (`ADRESSE_DU_NIVEAU` du simulateur ;
section suivante) ; à l'étape 6, c'était l'adresse 1 pour tous : des joueurs qui se servent de tout ce qu'ils savent, ce qui reste
moins que ce que de vrais joueurs tirent du débat (le simulateur ne lit ni les mines ni les hésitations), mais bien plus qu'une table
de débutants.

### Le simulateur

`essais/outils/simuler-veillees.mjs` joue des cases (niveau × taille × adresse × variante) en fils d'exécution (une doublure par fil ;
16 fils au plus : au-delà, les fils se gênent) et rend des tableaux markdown : victoires par camp (meute, village, solitaires,
amoureux) et durée, par case, par taille, par niveau, variantes contre la partie ordinaire, solitaires (la part des parties qu'ils
gagnent quand ils sont là), attribution par rôle (le village quand le rôle est là, et quand il n'y est pas).

### La calibration

`essais/outils/calibrer-poids.mjs` tire des compositions **variées** (le générateur du système vers des cibles tirées de -12 à +12,
aux quatre niveaux, de 6 à 18 joueurs ; une sur six avec Le Village aux niveaux classique et chaos), les fait jouer (chacune à
l'adresse de son niveau, `--adresse niveau` ; à l'étape 6 : adresse 1), et ajuste une régression logistique :

    P(village | village ou meute gagne) = σ( b(niveau, n) + Σ β_r · nombre_r + β_V · [Le Village] )

(les rôles distribués, sauf les deux références, Villageois et Loup de Brumecombe ; une ordonnée par niveau et par taille, qui compte
aussi les bâtiments : le générateur les tire parmi ceux du niveau, leurs effets ne s'en séparent pas ; un léger rappel vers les anciens
poids pour les rôles rares). Puis :

- **l'échelle** : un rôle du Village (ou solitaire) vaut 1 + β·u, un loup à pouvoir -6 + β·u (le Villageois +1 et le Loup de
  Brumecombe -6 gardent leur poids) ; u est l'échelle qui garde les nouveaux poids au plus près des anciens ;
- **la cible** d'un niveau et d'une taille : la somme des poids qui donne une chance sur deux au village,
  `cible = (n - m) - 6·m - b(niveau, n)·u` (m loups), lissée sur les tailles voisines de même nombre de loups ; puis corrigée par
  des validations (le **second passage**, `--corriger` : dans chaque case, la part p du village mesurée à la cible donne un pas de
  Newton, amorti, `cible - 0,8·u·logit(p)` ; la régression, additive, se trompe aux compositions extrêmes et sur la parité des
  tailles), et bornée à ce que le générateur atteint ;
- **la petite tablée**, dont les compagnons IA jouent sans les politiques (moteur), garde ses compositions : sa cible devient la
  somme moyenne, aux nouveaux poids, des compositions que tiraient les anciens ; elle reste mesurée par l'essai d'intégration.

Les solitaires sont traités à part : leur effet sur la balance village / meute est un poids comme un autre, et la part des parties
qu'ils gagnent est rapportée (visée : 5 à 20 %).

Les **poids sont communs à tous les niveaux** (une seule table : un rôle vaut la même chose partout) ; ce qui sépare les niveaux et
leurs adresses passe par les **ordonnées**, donc par les **cibles** par niveau et par taille. Un rôle d'information pèse moins quand
on s'en sert une fois sur deux : la régression lui donne un poids moyen entre les adresses (pondéré par ses parties), et la cible de
chaque niveau absorbe le reste.

## L'adresse de référence par niveau (étape 6b)

À l'étape 6, calibrés à l'adresse 1, poids et cibles laissaient la meute gagner **80 à 95 %** des parties d'une table d'adresse 0,5
(débutants 86 % à leur adresse, mesure « avant » plus bas). L'étape 6b calibre chaque niveau à l'adresse d'une vraie soirée à ce
niveau (`ADRESSE_DU_NIVEAU`, `essais/outils/simuler-veillees.mjs`) :

| Niveau | Adresse | Pourquoi |
|---|---|---|
| Débutants | 0,5 | on découvre les rôles : on se sert d'une information sur deux |
| Classique | 0,75 | une table qui connaît le jeu, sans le jouer au couteau |
| Le Pacte | 0,75 | le jeu de soirée, joué par une table qui le connaît |
| Chaos | 1 | une table rompue au jeu (le chaos le suppose) |

**Les débutants à 0,5 : la mesure montre une limite, pas une meilleure adresse.** Même le village le plus armé que le générateur
sache faire aux débutants (cible +60 : toutes les places possibles en rôles du niveau ; 80 parties par case, ±11 points) perd :

| Adresse | 8 | 12 | 14 | 16 | 18 |
|---|---|---|---|---|---|
| 0,5 | 63 % | 59 % | 69 % | 84 % | 71 % |
| 0,6 | 48 % | 61 % | 69 % | 75 % | 59 % |
| 0,75 | 44 % | 43 % | 39 % | 50 % | 35 % |

(la part de la meute parmi les parties gagnées par la meute ou le village). Le niveau débutants n'a que cinq rôles à pouvoir (Liseuse de cendres, Fossoyeur, Garde du pont, Herboriste, Braconnière) ; à 0,5,
aucune cible ne ramène la meute à 50 %. Calibrer les débutants à 0,75 tiendrait la promesse du tableau, mais pour une table qui
n'existe pas : une vraie table de débutants trouverait la meute à 75-85 %. L'adresse 0,5 est **gardée** : les cibles des débutants
sont bornées au plafond du générateur (le village le plus armé possible), ce qui rapproche le plus une vraie table de débutants
de l'équilibre (la meute à 70 % au lieu de 86 %). Le levier qui resterait est le barème des loups (`nombreDeLoups`) : avec **un loup
de moins** et le village le plus armé, la meute de débutants à 0,5 retombe à 33 % (8 joueurs), 38 % (10), 51 % (12), 63 % (14), 68 %
(16), 56 % (18) (80 parties par case). **Décidé à l'étape 6c** : les débutants ont un loup de moins (la meute à 52 %, plus bas). À
**six joueurs** (deux loups), le classique et Le Pacte à 0,75 restent au plafond du générateur (la meute vers 60-65 %).

## L'étape 6c (trois décisions prises avec Jordan)

### 1. Débutants : un loup de moins

`nombreDeLoups(n, niveau)` (`logique/composition.mjs`) : le barème (2 loups jusqu'à 8 joueurs, 3 jusqu'à 12, 4 jusqu'à 15, 5 au-delà)
moins `LOUPS_DE_MOINS[niveau]` — **un** aux débutants —, jamais moins d'un loup : 1 loup jusqu'à 8 joueurs, 2 jusqu'à 12, 3 jusqu'à 15,
4 au-delà. Le générateur (`tirer`), donc les compositions prêtes des débutants (tirées par lui à graine fixe), le conseil de la Table de
jeu quand on compose à la main (`equilibreDesRoles(roles, equilibre, niveau)`), le camp des gens de passage (`campDePassage({ niveau })`,
le niveau de la partie en cours), la calibration (`calibrer-poids.mjs` : la cible et le lissage comptent les loups du niveau) et la
vérification de l'essai d'intégration s'en servent. Les autres niveaux, la petite tablée (son propre barème) et les Vendanges (un loup de
plus que le barème du niveau) ne changent pas.

**Les cibles des débutants** : départ des cibles de l'étape 6b plus 7 (un Loup de Brumecombe, -6, devenu Villageois, +1) retouché
d'après le dosage mesuré à l'étape 6b, puis deux seconds passages (`--corriger`, échelle 6,73) d'après deux validations des treize
tailles (graines « 6c-val1 », 150 parties par case, puis « 6c-val2 », 200 parties), bornées à ce que le générateur atteint :

| Débutants | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cible 6b (barème) | +1 | +3 | +4 | -2 | -1 | +0 | +1 | -5 | -4 | -3 | -9 | -8 | -7 |
| Cible 6c (un loup de moins) | **+4** | **+3** | **+3** | **+5** | **+5** | **+5** | **+7** | **+2** | **+3** | **+4** | **-2** | **-1** | **+0** |
| Ce que le générateur atteint | 2 à 8 | 0 à 10 | 1 à 11 | -5 à 5 | -4 à 6 | -3 à 7 | -2 à 8 | -8 à 2 | -7 à 3 | -6 à 4 | -12 à -2 | -11 à -1 | -10 à 0 |
| Meute, « 6c-val1 » | 46 % | 42 % | 39 % | 70 % | 54 % | 55 % | 45 % | 63 % | 55 % | 52 % | 57 % | 57 % | 57 % |
| Meute, « 6c-val2 » | 49 % | 42 % | 39 % | 58 % | 55 % | 44 % | 49 % | 68 % | 60 % | 61 % | 68 % | 53 % | 59 % |

(9 et 13 à 18 joueurs : au plafond, le village le plus armé que le générateur sache faire.)

**Mesure** (adresse 0,5 ; la part de la meute parmi les parties gagnées par la meute ou le village) — avant : l'étape 6b (barème,
graine « 6b-apres ») ; après : graine « 6c-apres », 400 parties par taille paire (±5 points), 150 par taille impaire (±8) :

| Débutants (adresse 0,5) | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | Toutes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Avant (6b) | 75 % | 70 % | 57 % | 77 % | 76 % | 69 % | 64 % | 77 % | 69 % | 75 % | 80 % | 70 % | 70 % | 70 % |
| **Après (6c)** | **48 %** | 45 % | **43 %** | 59 % | **54 %** | 53 % | **45 %** | 63 % | **56 %** | 60 % | **63 %** | 59 % | **53 %** | **52 %** ±2 |

Compositions prêtes des débutants (30 parties chacune, graine « 6c-apres ») : **57 %** (67 % à l'étape 6b ; 390 parties, ±5). Aucune
partie en erreur.

**Dans la fourchette** (50 ± 10) : toutes les tailles sauf **16 joueurs (63 % ±5)** et **13 joueurs (63 % ±8)** ; 15 joueurs (60 %)
y est de justesse. Ces trois tailles sont au plafond du générateur (quatre loups contre douze joueurs du village, dont les cinq rôles à pouvoir
du niveau à 16 ; trois loups et dix places à 13) : un second loup de moins, ou un rôle de plus au niveau débutants, serait le seul levier
restant. Le guide du narrateur le dit (« Préparer la partie », « Réglages de la partie ») : au niveau Débutants, un loup de moins, et ne
pas en retirer un autre soi-même. (Novembre 2026 : le rôle de plus, le Vieux Sergent dès 9 joueurs, section « Débutants : le Vieux
Sergent ; Le Pacte : 7 joueurs conseillés ».)

### 2. Double visage : une allégeance loup de plus

Un réglage monde **« Double visage : une allégeance loup de plus »** (`allegeanceLoupEnPlus` ; clé de variante `allegeanceLoup`,
`logique/variantes.mjs`) et sa case à la préparation de la Table de jeu, visible seulement avec Double visage (aide : quand la cocher).
Il n'a de sens qu'avec la variante (`choixDesVariantes`, `variantesPermises` : sans Double visage, il tombe), entre dans l'état public
avec les autres règles de la veillée (`etat.variantes.allegeanceLoup`) et s'annonce avec elle (« Double visage (petite complication,
une allégeance loup de plus) »). À la distribution, `allegeances(n, hasard, true)` (petite complication) et `cartesDeLaGrande(paquet,
hasard, true)` (grande) mettent une carte d'allégeance loup de plus (`ALLEGEANCES_LOUP_EN_PLUS`, à la place d'une villageoise ;
`loupsDoubleVisage(n, true)`). Essais : `pacte-variantes-logique` (le compte, la grande complication, le réglage seulement avec la
variante, deux mutations) et `pacte-variantes-api` (trois allégeances de loup à 8 joueurs au lieu de deux, l'annonce, le réglage
retenu, la grande complication, décoché : le paquet du livre ; une mutation).

**Mesure** (classique et Le Pacte, adresse 0,75 ; 100 parties par niveau et par taille, 200 par taille, ±7 points ; graine
« variantes » ; le simulateur : `--variantes petite-loup,grande-loup`) — la part de la meute :

| Joueurs | Ordinaire | Petite complication | Petite, une allégeance loup de plus | Grande complication | Grande, une allégeance loup de plus |
|---|---|---|---|---|---|
| 8 | 58 % | **48 %** | 89 % | **51 %** | 70 % |
| 10 | 44 % | **58 %** | 87 % | **46 %** | 79 % |
| 11 | 44 % | **53 %** | 78 % | **44 %** | 67 % |
| 12 | 51 % | **38 %** | 65 % | 37 % | **52 %** |
| 13 | 56 % | 32 % | **52 %** | 28 % | **45 %** |
| 14 | 52 % | **44 %** | 70 % | 40 % | **55 %** |
| 15 | 49 % | 33 % | **65 %** | 41 % | **61 %** |
| 16 | 51 % | 31 % | **50 %** | 28 % | **47 %** |
| 17 | 59 % | 22 % | **49 %** | 22 % | **41 %** |
| 18 | 44 % | 22 % | **36 %** | 20 % | **29 %** |
| 8, 12 et 16 | 53 % | 39 % | 68 % | 39 % | 56 % |
| De 8 à 18 | 51 % | 38 % | 64 % | 36 % | 55 % |

(En gras, le meilleur des deux paquets à chaque taille ; à 15 joueurs, les deux se valent à peu près. 4 parties sur 10 000 sans
vainqueur en 30 tours.) **Le conseil de l'étape 6b ne tient pas** : il avait été tiré de trois tailles (8, 12 et 16). À 10 joueurs, la
carte de plus donne 79 % à la meute en grande complication ; à 14, 70 % en petite (les paquets sautent : 3 allégeances loup jusqu'à 13
joueurs, 4 au-delà, et 13 joueurs n'ont que 3 loups pour 13). **Conseil retenu** (aide de la case, guides du joueur et du narrateur,
fr et en) : **dès 16 joueurs en petite complication, et à 13 ; dès 12 en grande** ; en dessous, le paquet du livre (la carte de plus y
donne sept à neuf parties sur dix à la meute). À 18 joueurs, même avec elle, le village garde l'avantage (36 et 29 %).

### 3. Le Joueur de vielle : des joueurs simulés plus méfiants (sa règle ne change pas)

Il gagnait un tiers des parties où il est (32 %, étape 6b) parce que les joueurs simulés ne s'en méfiaient pas : un charmé ne le
cherchait qu'une fois la moitié du village charmée, chacun de son côté, et ni le village ni la meute ne le visaient. Or un charmé
**sait** qu'il l'est et connaît les autres charmés (son carnet), et tout le village sait qu'un Joueur de vielle joue dès que le
narrateur appelle les charmés, la première nuit (comme à la table : le narrateur appelle chaque rôle de la même voix ; la doublure
l'entend au hook `lakourLoups.reveil` du MJ, `charmesAppeles`). Les politiques (`logique/politiques.mjs`), à adresse > 0 :

- **le savoir** (`savoirDuJoueur`) : `charmes` (les charmés que l'on connaît), `vielle` (les suspects du Joueur de vielle, les plus
  sûrs d'abord : révélé, accusé au débat, puis — pour un charmé — les vivants non charmés qu'on ne sait ni d'un autre rôle ni
  innocents), `vielleConnue` (révélé ou accusé : ce que tous savent), `vielleEnJeu`, `menaceDeLaVielle` (il peut gagner la nuit
  suivante : un charmé le sait au compte près, au plus trois non-charmés en le comptant ; les autres l'estiment à deux charmés par nuit
  d'appel) ;
- **les charmés du Village** votent ensemble (un même suspect, tiré en commun comme la proie de la meute) : sous la menace, avant même
  un loup connu (la meute ne gagne pas en une nuit) ; sans menace, quand il reste trois suspects au plus ou qu'ils ne soupçonnent
  personne d'autre fortement ; au débat, ils l'accusent (une annonce « solitaire », jamais tenue pour un mensonge : on se trompe de
  bonne foi), ce qui fait la rumeur du jour ;
- **le village** qui n'est pas charmé vote contre un accusé de jouer de la vielle sous la menace (après un loup connu) ; sinon
  l'accusation est un soupçon comme un autre ;
- **la meute** le vise sous la même menace, la nuit (avant les rôles utiles) et au vote (la rumeur, si elle le désigne).

Essais (`essais/politiques-veillees.test.mjs`, deux de plus ; le contrat reste vert) : le savoir des charmés en français et en anglais,
l'innocent connu écarté, les charmés qui s'accordent (avant un loup connu sous la menace), l'accusation au débat, le hasard à
l'adresse 0 ; le village qui vote l'accusé sous la menace et le loup annoncé sans elle, le loup connu d'abord, la rumeur qui compte
l'accusation, la meute qui vise l'accusé sous la menace et un utile sans elle, une accusation qui ne fait pas un menteur.

**Mesure** : des compositions du générateur qui l'**incluent** (`--inclure joueur-de-vielle`, chaos et Le Pacte, 10 à 18 joueurs, 60
par niveau et par taille : 1 080 parties, chacune à l'adresse de son niveau ; graine « vielle6c », les mêmes compositions et les mêmes
graines avant et après ; l'« avant » : `politiques.mjs` et la doublure de l'étape 6b) — la part des parties qu'il gagne (±7 points
par taille) :

| Joueurs | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | Chaos | Le Pacte | **Toutes** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Avant (étape 6b) | 26 % | 26 % | 37 % | 28 % | 37 % | 30 % | 32 % | 34 % | 47 % | 31 % | 34 % | **33 %** ±3 |
| Après | 19 % | 24 % | 14 % | 18 % | 22 % | 11 % | 9 % | 9 % | 10 % | 11 % | 19 % | **15 %** ±2 |

Aucune partie en erreur. Dans ces parties, la meute passe de 35 à 43 %, le village de 30 à 39 % : il rend ses victoires aux deux camps.
Un second échantillon (d'autres compositions, mêmes tailles) donne 33 % → 13 % ; aux compositions générées ordinaires (chaos et Le
Pacte, graine « 6c-apres », 200 parties par case), il gagne **15 %** des 325 parties où il est (32 % à l'étape 6b). Il est sous les
20 % : **ni son poids (0) ni son minimum de joueurs (10) ne changent**. (À 11 et 14 joueurs, 24 et 22 % : dans la marge de ±7 d'une
case de 120 parties ; 13 et 15 % dans le second échantillon.)

Le reste ne bouge pas : chaos **51 %**, Le Pacte **48 %** (graine « 6c-apres », 200 parties par case, ±3 ; 51 et 49 % à l'étape 6b) ;
de 42 à 56 % par case. Solitaires dans ces parties : Feu follet 10 %, Joueur de vielle 15 %, Illuminé 7 %, Chasseur de primes 16 %,
Revenant 12 %.

## Le Pacte : la Liseuse de cendres dans toute composition (novembre 2026, après les parties en vrai)

Au jeu de soirée de Jordan, la Voyante est toujours là. Le générateur (`logique/composition.mjs`) met donc la **Liseuse de cendres** dans
**toute** composition tirée du niveau « Le Pacte », dès 6 joueurs, comme il met déjà « au moins un rôle d'information » : `ROLES_DU_NIVEAU`
(`{ "le-pacte": ["liseuse-de-cendres"] }`), inclus avant le dosage des pouvoirs du Village (la somme visée reste la cible : le
générateur arme d'autant moins le reste du village). Les compositions prêtes `le-pacte-06` à `-18`, tirées par le générateur, l'ont
toutes (avant : 7 sur 13). Une Liseuse exclue à la main reste exclue ; une composition choisie à la main et Double visage (son paquet)
n'y passent pas ; avec le **Chapardeur**, la carte peut finir au centre (deux cartes de plus au paquet, la règle du livre) : 4 % des parties
mesurées. Essai : `essais/accords-veillees.test.mjs` (le générateur à toutes les tailles, aux cibles extrêmes, les compositions prêtes ;
exclue, elle reste exclue ; les autres niveaux ne l'imposent pas).

**Recalibrage** (adresse 0,75 ; échelle 6,73) : deux seconds passages (`--corriger`) d'après deux validations des treize tailles
(graines « liseuse-val1 » puis « liseuse-val2 », 200 parties par case), bornés à ce que le générateur atteint :

| Le Pacte | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cible avant (étape 6b) | +1 | +3 | +1 | +2 | +0 | -3 | -5 | -8 | -8 | -10 | -13 | -15 | -15 |
| Meute, « liseuse-val1 » (Liseuse imposée, cibles d'avant) | 63 % | 58 % | 50 % | 42 % | 44 % | 48 % | 46 % | 53 % | 46 % | 51 % | 53 % | 47 % | 43 % |
| Cible après le premier passage | +1 | +3 | +1 | +0 | -1 | -3 | -6 | -7 | -9 | -10 | -12 | -16 | -16 |
| Meute, « liseuse-val2 » | 69 % | 51 % | 49 % | 59 % | 55 % | 50 % | 57 % | 50 % | 47 % | 45 % | 51 % | 56 % | 46 % |
| **Cible retenue** | **+1** | **+3** | **+1** | **+2** | **+0** | **-3** | **-5** | **-7** | **-10** | **-11** | **-12** | **-15** | **-17** |
| Ce que le générateur atteint | -5 à 1 | -4 à 3 | -12 à 9 | -19 à 3 | -27 à 3 | -25 à 3 | -26 à 11 | -32 à 5 | -29 à 8 | -30 à 10 | -36 à 4 | -35 à 6 | -31 à 9 |

(6 joueurs : au plafond, comme avant.) **Mesure** (la part de la meute parmi les parties gagnées par la meute ou le village) — avant :
le générateur sans la contrainte, cibles de l'étape 6b (graine « liseuse », 200 parties par case, ±7 points) ; après : la Liseuse imposée,
cibles retenues (graine « liseuse », 400 parties par case, ±5 ; les 200 premières ont les mêmes graines que l'avant : 52 %) :

| Le Pacte (adresse 0,75) | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | Toutes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Avant (Liseuse dans 53 % des parties) | 62 % | 52 % | 46 % | 48 % | 43 % | 49 % | 42 % | 50 % | 45 % | 51 % | 50 % | 49 % | 43 % | 48 % ±2 |
| **Après** (Liseuse dans 96 %) | **63 %** | 51 % | 52 % | 52 % | **43 %** | 52 % | 48 % | 48 % | 49 % | 54 % | 51 % | 53 % | 51 % | **51 %** ±1 |

Compositions prêtes (30 parties chacune, graine « liseuse », ±18 points par composition) : **49 %** (48 % avant ; 390 parties, ±5).
Solitaires dans ces parties : Feu follet 7 %, Joueur de vielle 19 %, Illuminé 7 %, Loup pâle 0 %. Une partie sur 5 200 sans vainqueur
en 30 tours. **Dans la fourchette** (50 ± 10) à toutes les tailles sauf **six joueurs (63 %)**, au plafond du générateur comme avant
(62 %). Le poids de la Liseuse (+4) ne change pas ; mesurée à l'attribution par rôle, elle vaut au village +12 points quand elle est là
(contre 187 parties sans elle : toutes des compositions avec le Chapardeur, la Liseuse restée au centre).

## Débutants : le Vieux Sergent ; Le Pacte : 7 joueurs conseillés (novembre 2026)

Après l'étape 6c et la Liseuse imposée à Le Pacte, trois cases restaient hors de la fourchette (meute 50 ± 10 %, chaque niveau à son
adresse), toutes au **plafond du générateur** (le village le plus armé qu'il sache faire) : les **débutants à 13 et 16 joueurs** (63 %),
15 joueurs en limite (60 %), et **Le Pacte à 6 joueurs** (63 %). Les règles des rôles ne changent pas.

### Débutants : un sixième rôle du Village, le Vieux Sergent (dès 9 joueurs)

Le niveau n'avait que cinq rôles à pouvoir (Liseuse de cendres, Fossoyeur, Garde du pont, Herboriste, Braconnière) : à 13 joueurs (trois
loups), le plus armé est ces cinq rôles et cinq Villageois (somme +2) ; à 16 (quatre loups), les cinq et sept Villageois (-2). La
Liseuse « toujours présente » n'y change rien (au plafond, elle y est déjà) ; un second loup de moins réglerait 16 mais pas 13 (deux loups
à 13, trois à 16 : un barème en dents de scie). Le levier est un rôle de plus dans la réserve. **Essai** (`--cible 60`, le village le plus
armé, chaque rôle candidat passé au niveau débutants ; mêmes graines « plaf », 200 parties par case, ±7) — la part de la meute :

| Réserve des débutants | 13 joueurs | 16 joueurs |
|---|---|---|
| les cinq rôles (avant) | 68 % | 62 % |
| + Gardeuse d'oies | 54 % | 63 % |
| + Juge de paix | 61 % | 57 % |
| + Veilleuse de lanterne | 46 % | 53 % |
| **+ Vieux Sergent** | **52 %** | **59 %** |
| + Vieux Sergent (graine « plaf2 », 300 parties, ±6 ; 15 joueurs : 48 %) | 55 % | 55 % |
| + Vieux Sergent et Gardeuse d'oies (« plaf2 » ; 15 joueurs : 43 %) | 52 % | 53 % |

**Retenu : le Vieux Sergent** (`equilibre.mjs` : niveau `debutants` au lieu de `classique`). C'est le rôle le plus simple qui soit : il ne
se réveille pas, ne décide rien, et le système résout son épée (dévoré par la meute, il blesse le premier loup vivant à sa gauche, qui
meurt la nuit suivante) ; c'est un rôle du livre (le jeu de soirée), et il suffit seul (la Gardeuse d'oies en plus n'apporte que deux ou
trois points). La Veilleuse ramène plus bas, mais c'est un rôle de nuit de plus à expliquer, à côté de la Liseuse.

**Dès 9 joueurs, et non 8** (`joueursMin` 9 ; avant : 8) : la première validation (graine « sergent-val1 ») a montré qu'à **8 joueurs**,
face au **loup seul** des débutants (jusqu'à 8 joueurs), son épée finit la partie d'un coup : à la cible de 8 (+3), le générateur tirait
toujours Loup, Fossoyeur, Vieux Sergent et cinq Villageois, et la meute n'y gagnait plus que **30 %** (39 à 45 % avant). Son poids (+3,
mesuré surtout face à plusieurs loups) ne le dit pas. Dès 9 joueurs, les débutants ont deux loups. Aux autres niveaux, les tables de 8
joueurs le perdent (parties appariées, graine « huit », 400 parties, ±5 ; dès 8 → dès 9) : classique 53 → 54 %, chaos 44 → 43 %, Le Pacte
51 → 48 % ; rien ne bouge.

**Les cibles des débutants** : deux seconds passages (`--corriger`, échelle 6,73, `--sans-interpoler`) d'après deux validations des
tailles 9 à 18 (graines « sergent-val1 » puis « sergent-val2 », 200 parties par case), les seules dont la réserve change ; 6 à 8 joueurs
gardent les leurs :

| Débutants | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cible 6c | +5 | +5 | +5 | +7 | +2 | +3 | +4 | -2 | -1 | +0 |
| Meute, « sergent-val1 » (Vieux Sergent, cibles 6c) | 59 % | 44 % | 43 % | 40 % | 58 % | 63 % | 54 % | 64 % | 56 % | 56 % |
| Cible après le premier passage | +7 | +4 | +3 | +5 | +4 | +5 | +5 | +0 | +0 | +1 |
| Meute, « sergent-val2 » | 52 % | 50 % | 56 % | 53 % | 52 % | 48 % | 54 % | 53 % | 59 % | 53 % |
| **Cible retenue** | **+7** | **+4** | **+4** | **+6** | **+4** | **+4** | **+6** | **+0** | **+1** | **+2** |
| Ce que le générateur atteint (6c : plafond) | -5 à 7 (5) | -4 à 8 (6) | -3 à 9 (7) | -2 à 10 (8) | -8 à 4 (2) | -7 à 5 (3) | -6 à 6 (4) | -12 à 0 (-2) | -11 à 1 (-1) | -10 à 2 (0) |

(Entre parenthèses, l'ancien plafond. Au nouveau plafond, le village le plus armé : 9, 13, 15, 16, 17 et 18 joueurs — le Vieux Sergent
y suffit. Bornées par le second passage : 14 et 16 joueurs au premier, 16 et 17 au second.)

**Mesure** (adresse 0,5 ; la part de la meute parmi les parties gagnées par la meute ou le village ; graine « sergent », 300 parties par
taille, ±6 ; l'« avant » : le dépôt avant la retouche, mêmes graines) :

| Débutants (adresse 0,5) | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | Toutes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Avant | 45 % | 48 % | 39 % | 54 % | 51 % | 53 % | 52 % | 59 % | **60 %** | 50 % | **62 %** | 57 % | 56 % | 53 % ±2 |
| **Après** | 45 % | 48 % | 39 % | 52 % | 48 % | 50 % | 46 % | **59 %** | 51 % | 49 % | **53 %** | 53 % | 49 % | **49 %** ±2 |

(6 à 8 joueurs : ni la réserve ni la cible ne changent, les mêmes parties. En gras : avant, les cases à 60 % et plus ; après, les deux tailles visées.) Avec cette graine,
l'« avant » de 13 joueurs tombe bas (59 % ; 63 et 68 % aux validations de l'étape 6c, 68 % à l'essai « plaf ») et l'« après » haut :
toutes les mesures de 13 joueurs mises ensemble, **avant 63 %** (« plaf » et « sergent » : 313 parties sur 500, ±4) et **après 55 %**
(« plaf », « plaf2 », « sergent-val2 », « sergent » : 546 sur 1 000, ±3). À 16 joueurs, 62 → **53 %** ; à 14, 60 → 51 % ; à 15, 50 →
49 %. Aucune partie en erreur.

**Dans la fourchette** (50 ± 10) : **toutes les tailles des débutants**, de 39 % (8 joueurs, inchangé) à 59 % (13 joueurs : 55 % toutes
mesures ensemble) ; le niveau entier à 49 % (53 % avant). Compositions prêtes des débutants (30 parties chacune, graine « sergent »,
±18 par composition) : **49 %** (50 % avant ; 390 parties, ±5) ; `debutants-09` à `-18` ont changé (le Vieux Sergent dans toutes sauf
`-11`). Le Vieux Sergent sorti des tables de 8, le générateur tire aussi autrement `classique-08`, `chaos-08` et `le-pacte-08` (mêmes
graines, mêmes cibles) : la meute y gagne 56, 44 et 42 % (100 parties chacune, graine « sergent », ±10).

### Le Pacte à 6 joueurs : 7 joueurs conseillés

À six, Le Pacte met deux loups contre la Liseuse (imposée), l'Herboriste, le Garde du pont et un Villageois (+1, le plafond) ; les autres
rôles du livre demandent 7 ou 8 joueurs. Essais (400 parties par case, ±5) :

| Le Pacte, 6 joueurs | Meute |
|---|---|
| deux loups, le village le plus armé (graine « six ») | 60 % (63 % à la mesure « liseuse ») |
| la Braconnière permise dès 6 joueurs (deux loups, Liseuse, Herboriste, Garde du pont, Braconnière : +2) | 61 % |
| un seul loup, la Liseuse et quatre Villageois (le village le moins armé ; graine « un-loup », 300 parties) | 38 % |

Ni la Braconnière (+1 seulement : la place de Villageois qui restait) ni un loup de moins ne ramènent la case dans la fourchette : deux loups,
c'est 60 % et plus ; un seul, moins de 40 % même face au village le plus nu. Le livre se joue d'ailleurs rarement à six. **Retenu : 7
joueurs conseillés** au niveau Le Pacte (`JOUEURS_CONSEILLES`, `logique/composition.mjs` ; à 7 joueurs, la meute à 51 %). Un conseil, pas
une règle : la composition prête `le-pacte-06` et le générateur à six restent (le village le plus armé possible) ; la préparation de la
Table de jeu affiche un avis sous le niveau quand la table compte moins de 7 joueurs (`LAKOUR_LOUPS.Preparation.Conseil.le-pacte`, fr et
en) ; les guides le disent (guide du narrateur, « Préparer la partie » ; page « Le Pacte » des variantes ; fr et en). La table de six du
**classique** (63 %, graine « six » : même plafond, mêmes rôles) reste elle aussi hors de la fourchette ; la Braconnière dès 6 joueurs l'y
ramenait de justesse (57 %), sans effet à Le Pacte : un écart dans le bruit, pas un levier retenu.

## La calibration de l'étape 6b (graine « cal6b », 12 000 parties, adresse du niveau)

Commande : `node essais/outils/calibrer-poids.mjs --parties 12000 --graine cal6b --adresse niveau --json cal6b.json` (19 minutes sur
16 fils), puis `--depuis cal6b.json --parties 0 --adresse niveau --ecrire` (écrit les poids et le bloc `CIBLES` de
`contenu/equilibre.mjs`). Les règles du Revenant et du Chasseur de primes y étaient retouchées, d'un jour plus douces que les règles
finales (le Revenant gagnant dès le deuxième jour, le Chasseur jusqu'au troisième : plus bas) ; la validation « val1 » avait le
Chasseur final, « val2 » et la mesure « après » les deux règles finales. 12 000 parties jouées jusqu'au bout, dont 11 450 gagnées par
le village ou la meute.

**L'échelle** : 6,7 poids par unité de logit (5,7 à l'étape 6) — un point de poids vaut environ **4 points** de victoire du village
autour de 50 %. Les poids retenus sont les poids mesurés, arrondis ; un rôle vu dans moins de 30 parties (les gens de passage, le
Somnambule, la Rosière : jamais tirés par le générateur) garde son poids.

### Poids des rôles (« Ancien » : l'étape 6, adresse 1)

| Rôle | Camp | Parties | Ancien | Mesuré (± 1 écart-type) | Retenu |
|---|---|---|---|---|---|
| veilleuse-de-lanterne | village | 2415 | +4 | +4.4 ± 0.5 | +4 |
| enfant-de-la-brume | village | 3521 | +4 | +4.3 ± 0.4 | +4 |
| liseuse-de-cendres | village | 8402 | +6 | +4.2 ± 0.4 | +4 |
| louvetier | village | 2014 | +4 | +4.1 ± 0.5 | +4 |
| herboriste | village | 5672 | +4 | +4 ± 0.3 | +4 |
| chapardeur | village | 1560 | +4 | +3.8 ± 0.6 | +4 |
| garde-du-pont | village | 4972 | +3 | +3.6 ± 0.4 | +4 |
| incendiaire | village | 188 | +3 | +3.5 ± 1.4 | +3 |
| juge-de-paix | village | 961 | +2 | +3 ± 0.6 | +3 |
| vieux-sergent | village | 2089 | +3 | +2.9 ± 0.4 | +3 |
| gardeuse-d-oies | village | 2794 | +3 | +2.9 ± 0.4 | +3 |
| gardienne-des-cles | village | 909 | +2 | +2.8 ± 0.7 | +3 |
| furet | village | 1593 | +1 | +2 ± 0.5 | +2 |
| braconniere | village | 3956 | +2 | +1.9 ± 0.4 | +2 |
| greffier-begue | village | 939 | +2 | +1.8 ± 0.7 | +2 |
| ermite | village | 867 | +1 | +1.6 ± 0.7 | +2 |
| bateleur | village | 702 | +1 | +1.4 ± 0.7 | +1 |
| messager | village | 980 | +2 | +1.4 ± 0.6 | +1 |
| feu-follet | solitaire | 2099 | +1 | +1.3 ± 0.5 | +1 |
| liseuse-d-etoiles | village | 1654 | +1 | +1.3 ± 0.5 | +1 |
| souffre-douleur | village | 1207 | +1 | +1.2 ± 0.5 | +1 |
| revenant | solitaire | 580 | -1 | +1.2 ± 0.9 | +1 |
| sourcier | village | 961 | +1 | +1.2 ± 0.6 | +1 |
| franc-villageois | village | 2083 | +3 | +1.1 ± 0.4 | +1 |
| innocent | village | 1608 | +2 | +1.1 ± 0.5 | +1 |
| sonneur | village | 709 | +1 | +1.1 ± 0.7 | +1 |
| lavandiere | village | 359 | +0 | +1 ± 0.5 | +1 |
| conteuse | village | 678 | +1 | +1 ± 0.7 | +1 |
| fossoyeur | village | 3686 | +1 | +0.9 ± 0.5 | +1 |
| aieul | village | 1542 | +2 | +0.8 ± 0.5 | +1 |
| bucheron | village | 227 | +1 | +0.8 ± 0.4 | +1 |
| pecheur-de-nuit | village | 471 | +0 | +0.4 ± 0.8 | +0 |
| entremetteuse | village | 565 | +0 | +0.2 ± 0.8 | +0 |
| pie | village | 714 | +1 | +0.2 ± 0.7 | +0 |
| loup-pale | meute | 2023 | -1 | +0 ± 0.7 | +0 |
| chasseur-de-primes | solitaire | 389 | -2 | -0.3 ± 1.1 | +0 |
| joueur-de-vielle | solitaire | 372 | -2 | -0.5 ± 1.2 | +0 |
| chambriere | village | 608 | -1 | -1.8 ± 0.7 | -2 |
| illumine | solitaire | 376 | -2 | -1.9 ± 1 | -2 |
| matin | village | 207 | -3 | -2.2 ± 1.2 | -2 |
| dame-du-gue | solitaire | 230 | -2 | -2.9 ± 1.4 | -3 |
| colporteur | solitaire | 359 | -2 | -3.4 ± 1 | -3 |
| enfant-des-bois | village | 324 | -4 | -3.9 ± 0.9 | -4 |
| pyromane | solitaire | 231 | -2 | -5.1 ± 1.3 | -5 |
| loup-des-roseaux | meute | 683 | -6 | -5.8 ± 0.8 | -6 |
| loup-flaireur | meute | 1272 | -5 | -7.2 ± 0.6 | -7 |
| loup-hurleur | meute | 787 | -7 | -7.9 ± 0.7 | -8 |
| loup-deguise | meute | 554 | -8 | -8.9 ± 0.8 | -9 |
| louve-mere | meute | 112 | -12 | -12.6 ± 1.5 | -13 |
| loup-affame | meute | 160 | -11 | -14.7 ± 1.3 | -15 |

Ce que l'adresse du niveau change : les rôles d'**information** pèsent moins quand on s'en sert une fois sur deux ou trois sur
quatre — la **Liseuse de cendres** passe de +6 à +4, rejointe par la Veilleuse, l'Enfant de la brume, le Louvetier, l'Herboriste,
le Chapardeur et le **Garde du pont** (+3 → +4 : protéger compte autant que savoir quand on sait mal) ; le **Franc-Villageois** (+3 →
+1), l'Aïeul et l'Innocent (+2 → +1) aussi. Côté meute, le **Loup affamé** (-11 → -15, sur 160 parties seulement : ±1,3) et la
Louve mère (-13) pèsent encore plus ; le **Loup pâle** ne vaut plus rien pour la meute (0). Le **Pyromane** (-2 → -5) coûte cher au
village. Les deux solitaires retouchés pèsent maintenant pour le village (Revenant +1 : il attire les votes loin des loups) ou rien
(Chasseur de primes 0) ; le Joueur de vielle aussi (0 au lieu de -2 : il prend ses victoires aux deux camps).

**Le Village** (la variante) : -2,3 ± 0,6 poids, soit -9 ± 2 points pour le village par rapport à la partie ordinaire (-4 ± 2 à
l'étape 6).

### Cibles par niveau et par taille

Les cibles retenues (en gras), écrites dans `equilibre.mjs` (`CIBLES`) ; entre parenthèses, la cible de la régression (lissée).
Entre les deux : deux **seconds passages** (`--corriger`, d'après une validation à 200 parties par case des tailles paires, graine
« val1 », puis à 150 parties de toutes les tailles, graine « val2 ») et les **bornes** de ce que le générateur atteint : les
débutants partout (le village le plus armé possible), le classique et Le Pacte à six joueurs, Le Pacte à neuf.

| Niveau (adresse) | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| debutants (0,5) | **+1** (+9) | **+3** (+7) | **+4** (+6) | **-2** (+7) | **-1** (+7) | **+0** (+5) | **+1** (+4) | **-5** (+3) | **-4** (+2) | **-3** (+1) | **-9** (-1) | **-8** (-1) | **-7** (-2) |
| classique (0,75) | **+1** (+5) | **+3** (+4) | **-2** (+2) | **+1** (+1) | **+0** (-1) | **-2** (-3) | **-6** (-4) | **-6** (-7) | **-8** (-8) | **-9** (-9) | **-12** (-11) | **-14** (-12) | **-15** (-13) |
| chaos (1) | **+1** (+1) | **+1** (+0) | **-5** (-2) | **-3** (-5) | **-8** (-8) | **-10** (-11) | **-14** (-13) | **-14** (-15) | **-16** (-17) | **-18** (-19) | **-20** (-20) | **-21** (-19) | **-23** (-18) |
| le-pacte (0,75) | **+1** (+5) | **+3** (+3) | **+1** (+1) | **+2** (+1) | **+0** (-1) | **-3** (-3) | **-5** (-6) | **-8** (-8) | **-8** (-9) | **-10** (-10) | **-13** (-15) | **-15** (-16) | **-15** (-17) |

Petite tablée : 4 → +5, 5 → +5, 6 → +2, 7 → +4, 8 → +4, 9 → +1, 10 → +0, 11 → +2, 12 → +4.

### Solitaires

La part des parties qu'un solitaire gagne quand il est distribué (visée : 10 à 20 %), compositions générées, chacune à l'adresse de
son niveau : **avant** (règles et poids de l'étape 6, graine « 6b », 200 parties par case) et **après** (graine « 6b-apres », 400
parties par case) :

| Rôle | Niveaux | Avant : parties | Il gagne | Après : parties | Il gagne |
|---|---|---|---|---|---|
| revenant | classique, chaos | 376 | 26 % | 732 | **17 %** |
| chasseur-de-primes | classique, chaos | 462 | 29 % | 665 | **14 %** |
| joueur-de-vielle | chaos, Le Pacte | 352 | 33 % | 715 | **32 %** |
| illumine | chaos, Le Pacte | 338 | 6 % | 573 | 7 % |
| feu-follet | classique, chaos, Le Pacte | 889 | 10 % | 1761 | 11 % |
| dame-du-gue | chaos | 154 | 16 % | 303 | 11 % |
| pyromane | chaos | 145 | 6 % | 265 | 11 % |

(le Colporteur ne gagne jamais « seul » — il gagne avec son nouveau camp — et le Loup pâle jamais : la meute ou le village
l'emportent avant ; marges : ±4 points sur 400 parties, ±3 sur 700).

- **Revenant** : il ne gagne plus qu'exécuté **à partir du troisième jour** (`JOUR_DU_REVENANT`, `logique/victoire.mjs` : le tour de
  sa mort, 3 au moins ; exécuté plus tôt, il meurt sans gagner). Ses victoires tombaient des premiers votes, quand le village ne sait
  rien : avant, 26 % (un tiers au premier jour) ; à partir du deuxième jour, 17 à 22 % selon l'échantillon (encore au-dessus de 20 %
  dans la validation « val1 ») ; à partir du troisième, **17 %**.
- **Chasseur de primes** : sa cible doit tomber au vote **au plus tard le deuxième jour** (`JOUR_LIMITE_DE_LA_PRIME` ; le jour
  d'ouverture du Feu follet vient en plus) ; sinon, ou si elle meurt autrement, **sa prime échoue** : au matin, le système le fait
  simple villageois (camp du Village) et le lui dit (`primesEchues`, `echoirLesPrimes` dans `api.mjs` ; c'était déjà la règle
  écrite pour une cible morte la nuit, que le système n'appliquait pas). Avant, 29 % (dont un tiers après le troisième jour) ; avec
  le troisième jour pour limite, 20 à 22 % (pas assez) ; avec le deuxième, **14 %**.
- **Joueur de vielle** (règle du livre, inchangée) : il était **déjà** réservé aux tables d'au moins 10 joueurs (`joueursMin` 10,
  niveau chaos) ; son poids passe de -2 à 0 (mesuré : -0,5 ± 1,2). Il reste au-dessus de 20 % (32 %), **à toutes les tailles** (de
  10 à 18 joueurs : un tiers des parties, sans seuil où il retomberait) : ni le minimum de joueurs ni le poids n'y peuvent rien. Ce
  qui le rend fort est la règle (deux charmes par nuit) ou le jeu des charmés simulés (ils le cherchent parmi les non-charmés dès que
  la moitié du village l'est, sans s'accorder sur qui). **Étape 6c** (décidé avec Jordan) : sa règle reste celle du livre, les joueurs
  simulés se méfient de lui (les charmés s'accordent, le village et la meute le visent sous la menace) — il retombe à **15 %**
  (« L'étape 6c », plus bas).

## Les constantes recalibrées (étape 6, adresse 1)

- **`RISQUE_ENFANT`** (l'Enfant de la brume surprise en épiant ; réglage `chanceEpier`) : **gardé à 1/2**. Parties appariées (la même
  composition avec l'Enfant, puis avec un Villageois à sa place ; 300 compositions classique et chaos de 8 à 16 joueurs, adresse 1) :

  | Risque | Village avec elle | Village sans elle | Écart (points) |
  |---|---|---|---|
  | 1/4 | 66 % | 44 % | +22 |
  | 1/2 | 58 % | 45 % | +13 |
  | 3/4 | 50 % | 45 % | +5 |

  À 1/2, l'Enfant vaut un bon rôle d'information (son poids mesuré : +4) ; à 1/4, elle vaudrait une Liseuse.
- **`CHANCE_FOURNIERE`** (la Fournière entrevoit un loup ; réglage caché `chanceFourniere`) : **gardée à 1/3**. 300 compositions avec
  Le Village, la même à chaque valeur : le village gagne 44 % (0), 49 % (1/3), 51 % (2/3) des parties ; Le Village dans son ensemble reste
  à -4 ± 2 points de la partie ordinaire, un écart que 2/3 ne comblerait qu'à moitié.
- Commandes : `node essais/outils/calibrer-poids.mjs --constante chanceEpier --valeurs 0.25,0.5,0.75 --role enfant-de-la-brume --parties
  300 --graine epier` et `--constante chanceFourniere --valeurs 0,0.334,0.667 --variante village --parties 300 --graine fourniere`.

## Les mesures de l'étape 6b (chaque niveau à son adresse)

**Avant** : les poids, les cibles et les règles de l'étape 6 (commit `452fb50`), graine « 6b », 200 parties par case ; **après** : les
poids et les cibles de l'étape 6b, le Revenant et le Chasseur de primes retouchés, graine « 6b-apres », 400 parties par case. Chaque
niveau joue à son adresse (débutants 0,5 ; classique et Le Pacte 0,75 ; chaos 1). La colonne qui compte est entre parenthèses : la
part de la meute parmi les parties que gagne la meute ou le village (visée : 50 % ± 10).

### Compositions générées — par niveau et par taille

| Case | Parties | Avant : meute / village / solitaires (meute parmi meute et village) | Parties | Après | Marge après (95 %) |
|---|---|---|---|---|---|
| Débutants (adresse 0,5) | 1400 | 86 % / 14 % / 0 % (86 %) | 2799 | 70 % / 30 % / 0 % (**70 %**) | ±2 |
| Classique (adresse 0,75) | 1400 | 63 % / 26 % / 11 % (71 %) | 2800 | 51 % / 44 % / 5 % (**54 %**) | ±2 |
| Chaos (adresse 1) | 1400 | 40 % / 42 % / 18 % (49 %) | 2799 | 43 % / 41 % / 16 % (**51 %**) | ±2 |
| Le Pacte (adresse 0,75) | 1400 | 62 % / 32 % / 6 % (66 %) | 2800 | 46 % / 48 % / 6 % (**49 %**) | ±2 |
| 6 joueurs | 800 | 66 % / 35 % / 0 % (66 %) | 1600 | 61 % / 39 % / 0 % (**61 %**) | ±2 |
| 8 joueurs | 800 | 56 % / 38 % / 6 % (59 %) | 1600 | 51 % / 43 % / 6 % (**54 %**) | ±3 |
| 10 joueurs | 800 | 64 % / 28 % / 8 % (70 %) | 1600 | 50 % / 43 % / 7 % (**54 %**) | ±3 |
| 12 joueurs | 800 | 60 % / 27 % / 13 % (69 %) | 1600 | 50 % / 41 % / 9 % (**55 %**) | ±3 |
| 14 joueurs | 800 | 65 % / 25 % / 11 % (73 %) | 1599 | 50 % / 43 % / 7 % (**54 %**) | ±3 |
| 16 joueurs | 800 | 65 % / 25 % / 10 % (72 %) | 1599 | 56 % / 35 % / 9 % (**61 %**) | ±3 |
| 18 joueurs | 800 | 63 % / 23 % / 14 % (74 %) | 1600 | 50 % / 41 % / 10 % (**55 %**) | ±3 |
| **Toutes** | 5600 | 63 % / 29 % / 9 % (69 %) | 11198 | 52 % / 41 % / 7 % (**56 %**) | ±1 |

Par case (niveau × taille), avant → après (±5 points après) :

| Niveau (adresse) | 6 | 8 | 10 | 12 | 14 | 16 | 18 |
|---|---|---|---|---|---|---|---|
| Débutants (0,5) | 76 → **75** | 73 → **57** | 87 → **76** | 85 → **64** | 92 → **69** | 95 → **80** | 93 → **70** |
| Classique (0,75) | 67 → **63** | 58 → **57** | 74 → **47** | 76 → **49** | 77 → **52** | 73 → **54** | 75 → **53** |
| Chaos (1) | 53 → **46** | 41 → **49** | 45 → **49** | 51 → **60** | 49 → **51** | 43 → **58** | 57 → **46** |
| Le Pacte (0,75) | 67 → **60** | 63 → **51** | 68 → **43** | 59 → **46** | 68 → **41** | 72 → **51** | 65 → **48** |

(2 parties en erreur sur 11 200 après : une partie de chaos à 16 joueurs sans vainqueur en 30 tours ; une erreur « Converting circular structure to JSON » dans `loups_eliminer`, débutants à 14 joueurs, qui ne se reproduit pas en rejouant le même fil seul — un aléa de la doublure ; aucune sur 5 600 avant.)

**Dans la fourchette** (50 % ± 10) : toutes les cases du classique, du chaos et de Le Pacte sauf les tables de six joueurs du classique (63 %) et, de justesse, de Le Pacte (60 %) et le chaos à 12 joueurs (60 %). **Hors de la fourchette** : les
débutants (le village le plus armé que sache le générateur ne suffit pas à l'adresse 0,5, voir plus haut ; la meute passe tout de même
de 86 à 70 %) et les tables de six joueurs du classique et de Le Pacte (cibles au plafond du générateur).

### Tailles impaires (après ; 150 parties par case, ±8 points)

| Niveau (adresse) | 7 | 9 | 11 | 13 | 15 | 17 |
|---|---|---|---|---|---|---|
| Débutants (0,5) | 70 % | 77 % | 69 % | 77 % | 75 % | 70 % |
| Classique (0,75) | 53 % | 51 % | 47 % | 51 % | 43 % | 47 % |
| Chaos (1) | 50 % | 44 % | 52 % | 57 % | 46 % | 55 % |
| Le Pacte (0,75) | 47 % | 53 % | 50 % | 51 % | 42 % | 63 % |

### Compositions prêtes (après ; 30 parties chacune, de 6 à 18 joueurs, ±18 points)

Toutes tirées par le générateur (graine « <niveau>-<n> ») : débutants 67 %, classique 49 %, chaos 50 %, Le Pacte 49 % (390 parties par
niveau, ±5). Les plus éloignées de 50 % hors débutants : chaos-16 30 %, classique-13 32 %, classique-10 37 %, classique-18 37 %,
le-pacte-7 67 % (une seule composition par taille, 30 parties : du bruit pour la plupart).

### Aux autres adresses (pour information ; après, 60 parties par case)

Les mêmes poids et cibles, joués à une autre adresse que celle de leur niveau : la part de la meute, toutes tailles paires (420 parties
par case, ±5) :

| Niveau (son adresse) | adresse 0,5 | adresse 0,75 | adresse 1 |
|---|---|---|---|
| Débutants (0,5) | **73 %** | 47 % | 26 % |
| Classique (0,75) | 74 % | **52 %** | 31 % |
| Chaos (1) | 82 % | 69 % | **48 %** |
| Le Pacte (0,75) | 72 % | **48 %** | 30 % |

(en gras : l'adresse du niveau ; 1 partie en erreur sur 5 040.) Une table d'un quart d'adresse au-dessous de la référence de son
niveau laisse la meute à 70-80 % ; un quart au-dessus, le village à 70 %. Aux grandes tables l'écart est le plus fort (un débutant
d'adresse 1 à 18 joueurs : la meute à 5 %).

### Les variantes (étape 6b)

Mesurées contre la partie ordinaire, aux poids et cibles de l'étape 6b (classique et Le Pacte, 8, 12 et 16 joueurs, adresse 0,75,
50 parties par case : 300 par variante, mêmes graines « variantes » ; ±8 points) :

| Variante | Parties | Meute / village / solitaires | Meute parmi meute et village | Écart à l'ordinaire (points) |
|---|---|---|---|---|
| ordinaire | 299 | 49 % / 44 % / 6 % | 53 % | — |
| chandelles | 299 | 49 % / 46 % / 4 % | 52 % | -1 |
| angoissante | 300 | 41 % / 52 % / 6 % | 44 % | -9 |
| chaine | 300 | 77 % / 18 % / 5 % | 81 % | **+28** |
| mur | 300 | 47 % / 48 % / 5 % | 49 % | -4 |
| petite (Double visage) | 300 | 38 % / 60 % / 0 % | 39 % | **-14** |
| grande (Double visage) | 300 | 35 % / 63 % / 0 % | 36 % | **-17** |
| vendanges (ajustement +11) | 300 | 72 % / 27 % / 1 % | 72 % | **+19** |
| envoutement (ajustement -7) | 300 | 35 % / 61 % / 4 % | 36 % | **-17** |
| envoutement (ajustement **-12**) | 300 | 45 % / 52 % / 3 % | 46 % | -7 |
| gazette | 300 | 56 % / 37 % / 7 % | 60 % | +7 |
| village | 300 | 56 % / 39 % / 4 % | 59 % | +6 |

À l'adresse 0,75, les ajustements de l'étape 6 (mesurés à l'adresse 1) ne suffisent plus : l'**Envoûtement** passe de -7 à **-12**
(mesuré : -7 points) ; les **Vendanges** gardent **+11** (+19 points pour la meute ; un ajustement de +16 donnait le même +20 : aux
tailles moyennes et grandes, la cible des Vendanges est déjà au plafond du générateur, qui ne sait pas armer davantage un village
face à un loup de plus). Leur levier serait, comme pour la Chaîne, le nombre de loups : **à décider** (le loup de plus des Vendanges
est la règle du livre). L'angoissante (-9), la Gazette (+7) et Le Village (+6) restent dans la marge (±8).

**Les deux variantes du livre que leur règle déséquilibre** (règles gardées ; un avertissement chiffré et un conseil de dosage dans
les guides du joueur et du narrateur, fr et en) :

- **La Chaîne des innocents** favorise beaucoup la meute. Parties appariées (graine « dosage » : la même composition du générateur,
  ordinaire, avec la Chaîne, puis avec la Chaîne et un ou deux Loups de Brumecombe remplacés par des Villageois ; classique et Le
  Pacte, 100 parties par case, ±6 à ±10 points) — la part de la meute :

| Joueurs | Ordinaire | Chaîne | Chaîne, un loup de moins | Chaîne, deux loups de moins |
|---|---|---|---|---|
| 8 (2 loups) | 54 % | 69 % | 26 % | — |
| 10 (3 loups) | 42 % | 85 % | 53 % | — |
| 12 (3 loups) | 43 % | 84 % | 60 % | 20 % |
| 14 (4 loups) | 47 % | 85 % | 72 % | 42 % |
| 16 (5 loups) | 58 % | 94 % | 80 % | 61 % |
| 8, 12 et 16 | 52 % | 83 % | 55 % | — |

  L'écart (+31 points) grandit avec la table : plus de loups, plus de blanchiments entre eux, et une chaîne plus longue où un
  innocent finit debout. Il ne bouge pas avec la composition (un ajustement de cible de +7 n'y changeait rien à l'étape 6) : le levier
  est le nombre de loups. **Conseil des guides** : de 9 à 12 joueurs, un loup de moins ; dès 13, deux de moins ; à 8 et moins, le
  compte habituel (un seul loup renverserait la partie). En ligne, le narrateur compose alors la veillée à la main (rôles choisis à la
  Table de jeu) : le générateur garde le barème des loups.

- **Double visage** favorise le village. Elle fait sa propre composition (le paquet du livre : ni le générateur ni sa cible
  n'y entrent) ; mesurée contre la partie ordinaire (mêmes graines « variantes », 100 parties par taille), puis avec **une carte
  d'allégeance loup de plus** (mesure faite en changeant le temps d'une course `loupsDoubleVisage`, `logique/variantes.mjs`, de +1 ;
  la règle n'a pas changé) — la part de la meute :

| Joueurs | Ordinaire | Petite complication | Petite, un loup de plus | Grande complication | Grande, un loup de plus |
|---|---|---|---|---|---|
| 8 (2 loups) | 59 % | 51 % | 78 % | 46 % | 77 % |
| 12 (3 loups) | 50 % | 36 % | 69 % | 36 % | 56 % |
| 16 (4 loups) | 48 % | 31 % | 45 % | 25 % | 42 % |
| 8, 12 et 16 | 53 % | 39 % | 64 % | 36 % | 58 % |

  Le village y gagne d'autant plus que la table est grande (chacun a un rôle à pouvoir visible ou deux cartes ; la Liseuse lit les
  allégeances). **Conseil des guides** : dès 14 joueurs, une carte d'allégeance loup de plus ; à 10-13 joueurs, en grande complication
  seulement ; jusqu'à 9 joueurs, le paquet du livre (un loup de plus y donne huit parties sur dix à la meute). **En ligne**, le système
  distribue le paquet du livre et ne sait pas ajouter cette carte : le conseil vaut autour d'une table, et pour le narrateur en ligne,
  l'avertissement seul (prévenir la meute qu'elle part de loin). **Étape 6c** : le réglage « une allégeance loup de plus » existe
  (la case de la préparation) ; remesuré de 8 à 18 joueurs, le conseil devient : dès 16 joueurs en petite complication (et à 13), dès
  12 en grande (« L'étape 6c », plus haut).

## Les mesures de l'étape 6 (adresse 1, pour mémoire)

**Avant** : les poids posés à la main, la cible 0, les compositions prêtes du dernier commit (débutants, classique et chaos composées à
la main) ; **après** : les poids et les cibles calibrés, les compositions prêtes tirées par le générateur. Mêmes joueurs simulés de
part et d'autre (les politiques finales). Graines : « avant » (150 parties par case), « apres » (400 par case à l'adresse 1, 150 à
l'adresse 0,5 et aux tailles impaires). La colonne qui compte est entre parenthèses : la part de la meute parmi les parties que gagne
la meute ou le village (la calibration vise 50 % ; les victoires des solitaires et des amoureux sont à part).

Les joueurs simulés d'avant l'étape 6 (au hasard, ceux de l'essai d'intégration) laissaient la meute gagner 81 parties sur 90
(débutants 27/30, classique 28/30, chaos 26/30) : c'est ce qu'on mesurait jusqu'ici. Avec les politiques à l'adresse 1, les anciens
poids donnaient au contraire un village trop fort aux grandes tables (la meute à 21 % à 18 joueurs) et une meute trop forte aux
petites (68 % à 6 joueurs) : la cible 0 ne valait pour aucune taille.

### Compositions générées, adresse 1 — par niveau et par taille

| Case | Parties | Avant : meute / village / solitaires (meute parmi meute et village) | Parties | Après | Marge après (95 %) |
|---|---|---|---|---|---|
| Débutants | 1050 | 38 % / 62 % / 0 % (38 %) | 2800 | 45 % / 55 % / 0 % (**45 %**) | ±2 |
| Classique | 1050 | 38 % / 54 % / 8 % (41 %) | 2800 | 44 % / 44 % / 12 % (**50 %**) | ±2 |
| Chaos | 1050 | 38 % / 49 % / 13 % (44 %) | 2800 | 40 % / 43 % / 17 % (**48 %**) | ±2 |
| Le Pacte | 1050 | 43 % / 51 % / 5 % (46 %) | 2800 | 44 % / 49 % / 7 % (**47 %**) | ±2 |
| 6 joueurs | 600 | 68 % / 33 % / 0 % (68 %) | 1600 | 49 % / 51 % / 0 % (**49 %**) | ±2 |
| 8 joueurs | 600 | 50 % / 44 % / 6 % (53 %) | 1600 | 43 % / 50 % / 7 % (**47 %**) | ±2 |
| 10 joueurs | 600 | 52 % / 43 % / 5 % (55 %) | 1600 | 43 % / 50 % / 8 % (**46 %**) | ±2 |
| 12 joueurs | 600 | 33 % / 56 % / 11 % (37 %) | 1600 | 42 % / 46 % / 12 % (**48 %**) | ±2 |
| 14 joueurs | 600 | 27 % / 64 % / 9 % (30 %) | 1600 | 44 % / 44 % / 12 % (**50 %**) | ±2 |
| 16 joueurs | 600 | 27 % / 66 % / 7 % (29 %) | 1600 | 43 % / 46 % / 12 % (**48 %**) | ±2 |
| 18 joueurs | 600 | 20 % / 72 % / 8 % (21 %) | 1600 | 38 % / 47 % / 14 % (**45 %**) | ±2 |
| **Toutes** | 4200 | 39 % / 54 % / 7 % (42 %) | 11200 | 43 % / 48 % / 9 % (**48 %**) | ±1 |

Par case (niveau × taille), part de la meute parmi les parties gagnées par la meute ou le village, avant → après (400 parties par case après, ±5 points) :

| Niveau | 6 | 8 | 10 | 12 | 14 | 16 | 18 |
|---|---|---|---|---|---|---|---|
| Débutants | 71 → **46** | 63 → **51** | 47 → **40** | 34 → **49** | 21 → **50** | 23 → **48** | 10 → **33** |
| Classique | 69 → **53** | 49 → **44** | 51 → **50** | 29 → **50** | 31 → **53** | 32 → **50** | 22 → **49** |
| Chaos | 64 → **47** | 47 → **49** | 58 → **46** | 43 → **42** | 35 → **48** | 28 → **48** | 27 → **55** |
| Le Pacte | 66 → **51** | 51 → **42** | 64 → **49** | 44 → **49** | 33 → **49** | 34 → **48** | 29 → **45** |

(1 partie(s) en erreur sur 11201 : plus de 30 tours sans victoire.)

### Compositions générées, adresse 0,5 — par niveau et par taille

| Case | Parties | Avant : meute / village / solitaires (meute parmi meute et village) | Parties | Après | Marge après (95 %) |
|---|---|---|---|---|---|
| Débutants | 1050 | 78 % / 22 % / 0 % (78 %) | 1050 | 86 % / 14 % / 0 % (**86 %**) | ±3 |
| Classique | 1050 | 72 % / 20 % / 8 % (78 %) | 1050 | 73 % / 15 % / 12 % (**83 %**) | ±3 |
| Chaos | 1050 | 67 % / 21 % / 12 % (76 %) | 1050 | 68 % / 17 % / 16 % (**80 %**) | ±3 |
| Le Pacte | 1049 | 75 % / 21 % / 4 % (78 %) | 1050 | 76 % / 18 % / 5 % (**80 %**) | ±3 |
| 6 joueurs | 600 | 87 % / 13 % / 0 % (87 %) | 600 | 79 % / 21 % / 0 % (**79 %**) | ±4 |
| 8 joueurs | 599 | 67 % / 26 % / 7 % (72 %) | 600 | 63 % / 30 % / 7 % (**68 %**) | ±4 |
| 10 joueurs | 600 | 81 % / 14 % / 6 % (85 %) | 600 | 73 % / 18 % / 9 % (**80 %**) | ±4 |
| 12 joueurs | 600 | 67 % / 25 % / 9 % (73 %) | 600 | 71 % / 15 % / 14 % (**82 %**) | ±4 |
| 14 joueurs | 600 | 71 % / 20 % / 9 % (78 %) | 600 | 82 % / 9 % / 9 % (**90 %**) | ±4 |
| 16 joueurs | 600 | 75 % / 21 % / 5 % (78 %) | 600 | 84 % / 9 % / 7 % (**90 %**) | ±4 |
| 18 joueurs | 600 | 63 % / 28 % / 9 % (69 %) | 600 | 78 % / 10 % / 12 % (**89 %**) | ±4 |
| **Toutes** | 4199 | 73 % / 21 % / 6 % (78 %) | 4200 | 76 % / 16 % / 8 % (**82 %**) | ±2 |

Par case (niveau × taille), part de la meute parmi les parties gagnées par la meute ou le village, avant → après (150 parties par case après, ±8 points) :

| Niveau | 6 | 8 | 10 | 12 | 14 | 16 | 18 |
|---|---|---|---|---|---|---|---|
| Débutants | 89 → **79** | 76 → **67** | 83 → **87** | 77 → **83** | 77 → **95** | 78 → **95** | 67 → **93** |
| Classique | 83 → **77** | 73 → **73** | 86 → **82** | 73 → **84** | 80 → **92** | 80 → **92** | 74 → **85** |
| Chaos | 89 → **79** | 65 → **65** | 86 → **76** | 73 → **82** | 75 → **85** | 77 → **84** | 65 → **90** |
| Le Pacte | 87 → **82** | 74 → **65** | 86 → **74** | 69 → **79** | 78 → **87** | 77 → **89** | 70 → **86** |

### Tailles impaires, adresse 1 (après ; 150 parties par case, ±8 points)

| Niveau | 7 | 9 | 11 | 13 | 15 | 17 |
|---|---|---|---|---|---|---|
| Débutants | 47 % | 56 % | 51 % | 59 % | 35 % | 59 % |
| Classique | 52 % | 47 % | 43 % | 46 % | 41 % | 40 % |
| Chaos | 50 % | 49 % | 51 % | 51 % | 54 % | 53 % |
| Le Pacte | 53 % | 51 % | 51 % | 51 % | 51 % | 54 % |

### Compositions prêtes, adresse 1 (30 parties chacune, de 6 à 18 joueurs ; avant : celles du dernier commit)

| Case | Parties | Avant : meute / village / solitaires (meute parmi meute et village) | Parties | Après | Marge après (95 %) |
|---|---|---|---|---|---|
| Débutants | 390 | 25 % / 75 % / 0 % (25 %) | 390 | 46 % / 54 % / 0 % (**46 %**) | ±5 |
| Classique | 390 | 21 % / 61 % / 18 % (25 %) | 390 | 42 % / 48 % / 11 % (**47 %**) | ±5 |
| Chaos | 389 | 43 % / 42 % / 14 % (50 %) | 390 | 41 % / 43 % / 17 % (**49 %**) | ±5 |
| Le Pacte | 390 | 54 % / 45 % / 1 % (55 %) | 390 | 42 % / 49 % / 8 % (**46 %**) | ±5 |
| **Toutes** | 1559 | 36 % / 56 % / 8 % (39 %) | 1560 | 43 % / 48 % / 9 % (**47 %**) | ±2 |

Les plus éloignées de 50 % (sur 30 parties, ±18 points) : debutants-18 23 %, classique-11 25 %, classique-9 71 %, debutants-9 70 %, classique-17 30 %.

**Ce qui reste hors de la fourchette** (au-delà de ±10 points de 50 %, adresse 1) : voir les tableaux ; les débutants aux très grandes
tables (le village l'emporte même avec 5 loups, un Fossoyeur et 12 Villageois : la composition la plus faible que le générateur sache
faire à ce niveau), et des compositions prêtes isolées (30 parties chacune : ±18 points, une seule composition par taille). Le levier
restant pour les grandes tables est le barème des loups (`nombreDeLoups`), à décider.

### Les variantes

Mesurées contre la partie ordinaire (classique et Le Pacte, 8, 12 et 16 joueurs, 50 parties par case : 300 par variante, mêmes
graines ; écart en points de la part de la meute parmi les parties gagnées par la meute ou le village, ±8 points). Avant toute correction, deux écarts étaient des **défauts du
simulateur**, corrigés dans les politiques : la Veillée aux chandelles **angoissante** (-21 points pour la meute : les loups simulés ne
s'accordaient pas sur la chandelle à souffler ; la meute choisit maintenant une proie commune) et la **Chaîne des innocents** (les
joueurs y désignaient celui qu'ils soupçonnaient, alors qu'on y désigne celui dont on garantit l'innocence : corrigé, sans effet
sur l'écart).

Sans ajustement (classique et Le Pacte, 8, 12 et 16 joueurs, 50 parties par case, mêmes graines), la meute regroupée :

| Variante | Parties | Meute / village / solitaires | Meute parmi meute et village | Écart à l'ordinaire (points) |
|---|---|---|---|---|
| ordinaire | 300 | 40 % / 48 % / 12 % | 46 % | — |
| chandelles | 300 | 45 % / 44 % / 11 % | 50 % | +4 |
| angoissante | 300 | 46 % / 44 % / 9 % | 51 % | +5 |
| chaine | 300 | 70 % / 18 % / 12 % | 80 % | +34 |
| mur | 300 | 43 % / 43 % / 14 % | 50 % | +4 |
| petite | 300 | 26 % / 73 % / 1 % | 27 % | -19 |
| grande | 300 | 28 % / 71 % / 1 % | 28 % | -18 |
| vendanges | 300 | 74 % / 21 % / 5 % | 78 % | +32 |
| envoutement | 300 | 15 % / 77 % / 8 % | 16 % | -30 |
| gazette | 299 | 49 % / 41 % / 10 % | 54 % | +8 |
| village | 300 | 48 % / 41 % / 11 % | 54 % | +8 |

Corrigé, parce que franchement déséquilibré (par la composition, sans toucher aux règles du livre : `equilibre.ajustements`, la cible
du générateur augmentée ou baissée quand la variante est choisie) :
- **Les Vendanges** : +32 points pour la meute → ajustement +7 : +19 → ajustement **+11** : **+9** ;
- **L'Envoûtement** : -30 points (le village) → ajustement **-7** : **-6**.

Non corrigé, et pourquoi :
- **La Chaîne des innocents** (+34 points pour la meute ; +35 avec un ajustement de +7, +41 une fois les désignations corrigées) : l'écart
  ne bouge pas avec la composition : les loups s'y blanchissent entre eux et les villageois simulés ne lisent pas qui blanchit qui. À jouer avec un village qui
  observe la chaîne ; une règle serait à décider.
- **Double visage** (petite -19, grande -18 : le village) : la variante fait sa propre composition (le paquet du livre), hors du
  générateur ; pas de levier sans changer la règle.
- **La Gazette** (+8) et **Le Village** (+8) : dans la marge (±8 sur 300 parties) ; chandelles, angoissante, Mur des murmures : +4 à +5.

## L'essai rapide

`essais/veillees-equilibre.test.mjs` (dans `npm run essais`, une à deux minutes sur 8 fils) : 16 parties par case, graine « rapide »,
chaque niveau à son adresse (étape 6b), quatre niveaux × 6, 10, 14 et 18 joueurs, compositions générées. Il échoue si la meute
s'écarte de plus de **20 points** de la mesure longue à un niveau (référence : 50 % aux quatre niveaux depuis l'étape 6c ; débutants
70 % avant), sort de
**30-80 %** à une taille, si une partie finit en erreur, si les solitaires gagnent plus d'une partie sur trois de celles où ils sont
(ou l'un d'eux plus d'une sur deux, sur 20 parties au moins), et vérifie que le simulateur est déterministe. Mesuré à l'écriture
(étape 6c) : débutants 53 %, classique 47 %, chaos 47 %, Le Pacte 44 % ; 6 joueurs 53 %, 10 : 44 %, 14 : 47 %, 18 : 47 % ; solitaires
8 victoires sur 87 parties (étape 6b : débutants 72 %, chaos 41 %, Le Pacte 39 %, 6 joueurs 58 % ; 12 victoires). Remesuré en novembre
2026 (la Liseuse imposée à Le Pacte, le Vieux Sergent aux débutants) : débutants 45 %, classique 47 %, chaos 47 %, Le Pacte 58 % ; 6
joueurs 53 %, 10 : 44 %, 14 : 45 %, 18 : 55 % ; solitaires 8 victoires sur 83 parties. Deux autres essais : `essais/politiques-veillees.test.mjs` (le contrat : chaque effet de rôle,
pouvoir de jour et geste a sa politique ; le savoir lu en français et en anglais ; les choix de l'adresse 1 et de l'adresse 0) et
`essais/calibration-veillees.test.mjs` (la régression retrouve des effets connus ; l'échelle, la cible, l'échantillon). Les compositions
prêtes sont contrôlées par `essais/veillees-compositions.test.mjs` (chacune est celle du générateur, à ±2 de sa cible).

## Limites

- **Ce que le simulateur ne joue pas** : le débat lui-même (mines, hésitations, plaidoiries, contre-annonces), les rôles que l'on
  prétend tenir, la Gazette autrement qu'au hasard (ses demandes au narrateur et aux joueurs se tranchent au hasard), les pouvoirs
  narratifs (Conteuse, Maîtresse d'école : sans effet mécanique ici). Les rôles qui vivent de ce que les joueurs en font (Furet,
  Sourcier, Ermite, Liseuse d'étoiles, Pie, Sonneur) y valent sans doute moins qu'à une vraie table : leurs poids sont des planchers.
- **L'adresse pèse lourd** : une table moins adroite que la référence de son niveau trouvera la meute plus forte que ne le promet la
  cible, une table plus adroite le village (tableau « Aux autres adresses »). L'adresse de chaque niveau (étape 6b) est une
  supposition sur de vraies soirées, pas une mesure : quand on aura des parties en vrai (la Chronique), les comparer aux tableaux et
  ajuster `ADRESSE_DU_NIVEAU` (l'outil recalibre à n'importe quelle adresse : `--adresse niveau` ou un nombre, deux heures de calcul).
- **Les débutants** (étape 6c : un loup de moins ; novembre 2026 : le Vieux Sergent dès 9 joueurs) : la meute à 49 % à leur
  adresse (0,5), de 39 à 59 % par taille ; plusieurs tailles restent au plafond du générateur (9, 13, 15 à 18 joueurs), qui y suffit
  désormais. Une table de débutants plus maladroite que 0,5 y trouvera la meute plus forte. Les tables de six joueurs du classique et de
  Le Pacte restent au plafond (60-65 %) : Le Pacte se conseille dès 7 joueurs (la Table de jeu le dit) ; le classique à six, rien
  n'est décidé.
- **Le Joueur de vielle** : la règle du livre est gardée ; ce sont les joueurs simulés qui se méfient de lui (étape 6c : 33 % → 15 %).
  La méfiance suppose qu'on entende le narrateur appeler les charmés la nuit (comme à la table) : un narrateur, ou un MJ IA, qui
  tairait cette étape laisserait le Joueur de vielle plus fort que mesuré.
- **Une graine, une partie** : les mesures se rejouent à l'identique (mêmes graines, même code). Une règle, une politique ou un poids
  qui change déplace tout : remesurer avant de conclure (commandes plus bas).

## La petite tablée, compagnons branchés sur les politiques (moteur `27e7559`)

Depuis le moteur `27e7559`, les compagnons sans modèle décident par les politiques du système (source « politique », l'adresse de leur
tempérament), disent au débat ce qu'ils savent et usent de leurs pouvoirs de jour (points 1 et 2 ci-dessous : faits). Mesuré au
simulateur (`--tablee` : les sept configurations de l'essai d'intégration, 100 parties chacune, graine « politiques ») ; la fourchette
de l'essai, 30 à 72 % pour la meute, tient partout :

| Configuration | Humains au hasard | Humains d'adresse 0,75 |
|---|---|---|
| 2 humains + 2 IA | 52 % | 61 % |
| 2 humains + 4 IA | 54 % | 59 % |
| 2 humains + 4 IA (petite-tablee-06) | 45 % | 53 % |
| 3 humains + 5 IA | 62 % | 46 % |
| 3 humains + 5 IA (petite-tablee-08) | 66 % | 63 % |
| 3 humains + 7 IA | 39 % | 47 % |
| 4 humains + 8 IA | 64 % | 64 % |

(Marge à 95 % : ±9 à ±10 points ; 55 % pour la meute en tout, humains au hasard ; aucune partie en erreur.) Les cibles de la petite
tablée n'ont pas été recalibrées : à faire si une configuration sort de la fourchette.

    node essais/outils/simuler-veillees.mjs --tablee --parties 100 --graine politiques                 (~80 s, 16 fils)
    node essais/outils/simuler-veillees.mjs --tablee --parties 100 --graine politiques --adresse 0.75

## À brancher dans le moteur (`lakour-mj-ia`, étape 8)

Les politiques sont dans le système (`api.logique` : `savoirDuJoueur`, `politiqueDeNuit`, `politiqueDeVote`, `politiqueDuJour`,
`annoncesDuJoueur`, `annulerLeVote`, `rumeurDuJour`, `proieDuVoteDeLaMeute`) ; le moteur n'a pas été touché. Pour que les compagnons
sans modèle (repli) jouent comme les joueurs simulés :

1. `scripts/compagnons-jeu.js`, `Compagnons.resoudreLoups` (l. 501) — ou `scripts/compagnons.js`, `repliDecision` (l. 416) pour le jeu
   « loups » : quand aucun modèle ne répond, construire le savoir du compagnon avec `api.logique.savoirDuJoueur({ moi, camp, allies, textes:
   carnet (texte ou html sans balises), publics: chat public, villageois: vue publique (rôles révélés), gabarits: game.i18n.translations
   .LAKOUR_LOUPS, nomsDesRoles, nomsDesCamps, roles: contenu.equilibre.roles, registre: etat public, role, groupes: etat.ambigus.groupes,
   voisins })`, puis décider par `politiqueDeNuit` (l'effet du rôle du compagnon ; « tuer » quand l'invite est celle de la chasse de la
   meute ; l'objet de la demande pour les gestes), `politiqueDeVote` (objet du vote ; place : rumeur, proie de la meute) et
   `politiqueDuJour` (pouvoirs de jour possibles). L'adresse : celle du tempérament (par exemple 0,9 réfléchi, 0,5 impulsif).
2. Le débat : `annoncesDuJoueur` donne ce qu'un compagnon dirait tout haut (« X est un loup ») ; à faire entrer dans ses répliques
   (`repliReplique`), et le partage d'annonces entre compagnons (les annonces des humains se lisent dans le chat : à analyser, ou à
   laisser au modèle).
3. `scripts/outils.js`, `loups_vote` (l. 1673) : `api.ouvrirVote` lève une erreur quand la Gazette interdit le vote du jour (« La Crue :
   pas de vote aujourd'hui ») ; l'outil la laisse remonter au lieu de rendre `{ erreur: true }` (le simulateur la rattrape).
4. Une fois les compagnons branchés : mesurer la petite tablée au simulateur (ses cibles, et l'entrée des rôles du jeu de soirée,
   `PACTE_HORS_TABLEE`).
5. Étape 6b : l'adresse d'un compagnon peut suivre le niveau de la veillée (`ADRESSE_DU_NIVEAU`) plutôt que son seul tempérament ;
   et ce que le moteur dit au narrateur et aux compagnons du Revenant (il ne gagne qu'exécuté à partir du troisième jour) et du
   Chasseur de primes (sa prime échoue après le deuxième jour : il devient villageois, au matin) est à revoir avec ces règles.
6. Étape 6c : le choix des variantes du moteur (`variantesDemandees`, `scripts/outils.js`) ne connaît pas encore `allegeanceLoup`
   (la case « une allégeance loup de plus », et son conseil de taille) ; le narrateur IA doit appeler les charmés à voix haute, la
   nuit, comme les autres rôles (la méfiance mesurée envers le Joueur de vielle le suppose) ; un compagnon branché sur les politiques
   passe `charmesAppeles` (les nuits où les charmés ont été appelés) à `savoirDuJoueur`.
7. Novembre 2026 : `api.logique.JOUEURS_CONSEILLES` (Le Pacte : 7 joueurs au moins) ; le MJ IA qui compose une veillée Le Pacte de
   moins de 7 joueurs (`loups_distribuer`) pourrait le dire au narrateur, comme la préparation de la Table de jeu.

## Remesurer

Toutes les mesures se rejouent à l'identique (mêmes graines, même code ; 16 fils, une machine de 32 cœurs logiques). Étape 6b, chaque
niveau à son adresse (`--adresse niveau`) :

    # recalibrer : poids et cibles (régression), puis deux seconds passages des cibles d'après des validations
    node essais/outils/calibrer-poids.mjs --parties 12000 --graine cal6b --adresse niveau --json cal6b.json            (~20 min)
    node essais/outils/calibrer-poids.mjs --depuis cal6b.json --parties 0 --adresse niveau --ecrire
    npm run fabriquer-veillees
    node essais/outils/simuler-veillees.mjs --parties 200 --adresse niveau --graine val1 --json val1.json               (~15 min)
    node essais/outils/calibrer-poids.mjs --corriger val1.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees
    node essais/outils/simuler-veillees.mjs --parties 150 --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine val2 --json val2.json
    node essais/outils/calibrer-poids.mjs --corriger val2.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees && npm run fabriquer-veillees-en
    # avant (au commit 452fb50) / après, compositions générées (un niveau à la fois : une course de 11 200 parties d'un seul tenant a
    # planté une fois, « segmentation fault », vers la 7 000e)
    node essais/outils/simuler-veillees.mjs --parties 200 --adresse niveau --graine 6b --json avant.json                (~13 min)
    node essais/outils/simuler-veillees.mjs --parties 400 --niveaux classique --adresse niveau --graine 6b-apres --json apres-classique.json
    node essais/outils/simuler-veillees.mjs --parties 150 --tailles 7,9,11,13,15,17 --adresse niveau --graine 6b-apres  (~10 min)
    node essais/outils/simuler-veillees.mjs --pretes --parties 30 --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine 6b-apres
    node essais/outils/simuler-veillees.mjs --parties 60 --adresse 0.5,0.75,1 --graine 6b-info                           (les autres adresses)
    # variantes contre la partie ordinaire ; le dosage de la Chaîne (parties appariées)
    node essais/outils/simuler-veillees.mjs --variantes ordinaire,chandelles,angoissante,chaine,mur,petite,grande,vendanges,envoutement,gazette,village       --niveaux classique,le-pacte --tailles 8,12,16 --parties 50 --adresse niveau --graine variantes
    node essais/outils/simuler-veillees.mjs --variantes ordinaire,chaine --loups-de-moins 0,1,2 --niveaux classique,le-pacte       --tailles 8,10,12,14,16 --parties 100 --adresse niveau --graine dosage
    # le maximum du générateur aux débutants (cible +60), à plusieurs adresses : composer(n, …, { cible: 60 }) puis jouerTaches
    # (tableau de « L'adresse de référence par niveau »)

Étape 6c (débutants : un loup de moins ; Double visage : une allégeance loup de plus ; Joueur de vielle : des joueurs méfiants) :

    # les cibles des débutants : deux seconds passages
    node essais/outils/simuler-veillees.mjs --parties 150 --niveaux debutants --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine 6c-val1 --json deb-val1.json
    node essais/outils/calibrer-poids.mjs --corriger deb-val1.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux debutants --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine 6c-val2 --json deb-val2.json
    node essais/outils/calibrer-poids.mjs --corriger deb-val2.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees && npm run fabriquer-veillees-en
    # après : débutants (en deux courses : une course d'un seul tenant a planté, « segmentation fault »), tailles impaires, prêtes
    node essais/outils/simuler-veillees.mjs --parties 400 --niveaux debutants --tailles 6,8,10,12 --adresse niveau --graine 6c-apres   (~3,5 min)
    node essais/outils/simuler-veillees.mjs --parties 400 --niveaux debutants --tailles 14,16,18 --adresse niveau --graine 6c-apres
    node essais/outils/simuler-veillees.mjs --parties 150 --niveaux debutants --tailles 7,9,11,13,15,17 --adresse niveau --graine 6c-apres
    node essais/outils/simuler-veillees.mjs --pretes --parties 30 --niveaux debutants --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine 6c-apres
    # Double visage, avec et sans l'allégeance loup de plus (~7 min chacune)
    node essais/outils/simuler-veillees.mjs --variantes ordinaire,petite,grande,petite-loup,grande-loup --niveaux classique,le-pacte --tailles 8,10,12,14,16 --parties 100 --adresse niveau --graine variantes
    node essais/outils/simuler-veillees.mjs --variantes ordinaire,petite,grande,petite-loup,grande-loup --niveaux classique,le-pacte --tailles 11,13,15,17,18 --parties 100 --adresse niveau --graine variantes
    # le Joueur de vielle (l'« avant » : politiques.mjs et essais/doublures/foundry-loups.mjs de l'étape 6b, commit 0b4f7c9) ; chaos et Le Pacte
    node essais/outils/simuler-veillees.mjs --inclure joueur-de-vielle --niveaux chaos,le-pacte --tailles 10,11,12,13,14,15,16,17,18 --parties 60 --adresse niveau --graine vielle6c   (~2,5 min)
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux chaos,le-pacte --adresse niveau --graine 6c-apres                 (~8 min)

Le Pacte, la Liseuse de cendres dans toute composition (l'« avant » : le générateur sans `ROLES_DU_NIVEAU`) :

    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux le-pacte --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine liseuse --json avant.json   (~5 min)
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux le-pacte --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine liseuse-val1 --json val1.json
    node essais/outils/calibrer-poids.mjs --corriger val1.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux le-pacte --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine liseuse-val2 --json val2.json
    node essais/outils/calibrer-poids.mjs --corriger val2.json --echelle 6.73 --adresse niveau --ecrire
    npm run fabriquer-veillees && npm run fabriquer-veillees-en
    node essais/outils/simuler-veillees.mjs --parties 400 --niveaux le-pacte --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine liseuse --json apres.json   (~10 min)
    node essais/outils/simuler-veillees.mjs --pretes --parties 30 --niveaux le-pacte --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine liseuse

Débutants, le Vieux Sergent ; Le Pacte à 6 joueurs (l'« avant » : le dépôt avant la retouche ; les essais de réserve et de Le Pacte à
six : un petit script hors dépôt, `composer(n, …, { cible: 60 })` sur un `equilibre.json` retouché — `niveau` ou `joueursMin` d'un rôle —,
puis `jouerTaches` du simulateur avec ces rôles ; ne jamais lancer `npm run fabriquer-veillees` pendant une course : la doublure relit
`assets/equilibre.json` à chaque partie) :

    # deux seconds passages des tailles 9 à 18 (celles dont la réserve change), en deux courses chacun
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux debutants --tailles 9,10,11,12 --adresse niveau --graine sergent-val1 --json val1-a.json
    node essais/outils/simuler-veillees.mjs --parties 200 --niveaux debutants --tailles 13,14,15,16,17,18 --adresse niveau --graine sergent-val1 --json val1-b.json
    node essais/outils/calibrer-poids.mjs --corriger val1-a.json,val1-b.json --echelle 6.73 --adresse niveau --sans-interpoler --ecrire
    npm run fabriquer-veillees
    # (de même avec --graine sergent-val2, puis --corriger val2-a.json,val2-b.json)
    npm run fabriquer-veillees && npm run fabriquer-veillees-en
    # avant (le dépôt d'avant) / après : 300 parties par taille, en deux courses
    node essais/outils/simuler-veillees.mjs --parties 300 --niveaux debutants --tailles 6,7,8,9,10,11,12 --adresse niveau --graine sergent --json a.json
    node essais/outils/simuler-veillees.mjs --parties 300 --niveaux debutants --tailles 13,14,15,16,17,18 --adresse niveau --graine sergent --json b.json
    node essais/outils/simuler-veillees.mjs --pretes --parties 30 --niveaux debutants --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse niveau --graine sergent

Étape 6 (adresse 1) : les mêmes commandes avec `--adresse 1` (ou `0.5`) et les graines « cal », « avant », « apres », « variantes »,
au commit `452fb50` ; `--corriger … --echelle 5.68`.

Le simulateur écrit ses tableaux en markdown (`--json` : chaque partie, pour les recouper) ; `--rapide` joue 16 parties par case.
