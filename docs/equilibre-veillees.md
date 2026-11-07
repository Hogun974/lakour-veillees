# Équilibre des Veillées de Brumecombe

*Le Pacte, étapes 6 et 6b (novembre 2026). Les poids des rôles et la cible du générateur ne sont plus posés à la main : ils sont
mesurés par simulation. L'étape 6 les a calibrés avec des joueurs simulés parfaits (adresse 1) ; l'étape 6b les recalibre avec une
**adresse par niveau**, celle d'une vraie soirée (débutants 0,5 ; classique et Le Pacte 0,75 ; chaos 1), retouche deux solitaires
(Revenant, Chasseur de primes) et chiffre les variantes du livre que leur règle déséquilibre. Ce document dit comment, avec quelles
graines, ce qui a été mesuré avant et après, et comment remesurer.*

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
  soupçons ; un charmé cherche le Joueur de vielle parmi les non-charmés ; un solitaire découvert est visé (jamais le Revenant) ;
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
de l'équilibre (la meute à 70 % au lieu de 86 %). Le levier qui resterait est le barème des loups (`nombreDeLoups`), **à
décider** : avec **un loup de moins** et le village le plus armé, la meute de débutants à 0,5 retombe à 33 % (8 joueurs), 38 % (10),
51 % (12), 63 % (14), 68 % (16), 56 % (18) (80 parties par case). De même, à **six joueurs** (deux loups), le classique et Le Pacte
à 0,75 restent au plafond du générateur (la meute vers 60-65 %).

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
  la moitié du village l'est, sans s'accorder sur qui) : **à décider** — un charme par nuit (comme aux Vendanges), ou des charmés qui
  s'accordent au vote (une politique).

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
  l'avertissement seul (prévenir la meute qu'elle part de loin). Un réglage « allégeance loup de plus » serait à décider.

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
s'écarte de plus de **20 points** de la mesure longue à un niveau (référence : débutants 70 %, les trois autres 50 %), sort de
**30-80 %** à une taille, si une partie finit en erreur, si les solitaires gagnent plus d'une partie sur trois de celles où ils sont
(ou l'un d'eux plus d'une sur deux, sur 20 parties au moins), et vérifie que le simulateur est déterministe. Mesuré à l'écriture :
débutants 72 %, classique 47 %, chaos 41 %, Le Pacte 39 % ; 6 joueurs 58 %, 10 : 44 %, 14 : 47 %, 18 : 50 % ; solitaires 12
victoires sur 87 parties. Deux autres essais : `essais/politiques-veillees.test.mjs` (le contrat : chaque effet de rôle,
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
- **Les débutants restent au-dessus de 60 %** à leur adresse (0,5) : le générateur n'a pas de quoi armer davantage leur village. Le
  levier restant est le barème des loups (un loup de moins aux débutants : mesuré plus haut), **à décider** ; de même pour les tables
  de six joueurs du classique et de Le Pacte.
- **Le Joueur de vielle** gagne toujours un tiers des parties où il est (règle du livre inchangée) : **à décider** (voir « Solitaires »).
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

Étape 6 (adresse 1) : les mêmes commandes avec `--adresse 1` (ou `0.5`) et les graines « cal », « avant », « apres », « variantes »,
au commit `452fb50` ; `--corriger … --echelle 5.68`.

Le simulateur écrit ses tableaux en markdown (`--json` : chaque partie, pour les recouper) ; `--rapide` joue 16 parties par case.
