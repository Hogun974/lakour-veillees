# Équilibre des Veillées de Brumecombe

*Le Pacte, étape 6 (novembre 2026). Les poids des rôles et la cible du générateur ne sont plus posés à la main : ils sont mesurés
par simulation. Ce document dit comment, avec quelles graines, ce qui a été mesuré avant et après, et comment remesurer.*

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
siens). La référence de la calibration est l'**adresse 1** : des joueurs qui se servent de tout ce qu'ils savent, ce qui reste moins
que ce que de vrais joueurs tirent du débat (le simulateur ne lit ni les mines ni les hésitations).

### Le simulateur

`essais/outils/simuler-veillees.mjs` joue des cases (niveau × taille × adresse × variante) en fils d'exécution (une doublure par fil ;
16 fils au plus : au-delà, les fils se gênent) et rend des tableaux markdown : victoires par camp (meute, village, solitaires,
amoureux) et durée, par case, par taille, par niveau, variantes contre la partie ordinaire, solitaires (la part des parties qu'ils
gagnent quand ils sont là), attribution par rôle (le village quand le rôle est là, et quand il n'y est pas).

### La calibration

`essais/outils/calibrer-poids.mjs` tire des compositions **variées** (le générateur du système vers des cibles tirées de -12 à +12,
aux quatre niveaux, de 6 à 18 joueurs ; une sur six avec Le Village aux niveaux classique et chaos), les fait jouer (adresse 1), et
ajuste une régression logistique :

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

## La calibration (graine « cal », 12 000 parties, adresse 1)

Commande : `node essais/outils/calibrer-poids.mjs --parties 12000 --graine cal --adresse 1 --json cal.json` (17 minutes sur 16 fils),
puis `--depuis cal.json --parties 0 --ecrire` (écrit les poids et le bloc `CIBLES` de `contenu/equilibre.mjs`). 11 997 parties
jouées jusqu'au bout (3 en erreur), dont 11 211 gagnées par le village ou la meute (les autres : solitaires et amoureux).

**L'échelle** : 5,7 poids par unité de logit — un point de poids vaut environ **4,4 points** de victoire du village autour de 50 %.
Les poids retenus sont les poids mesurés, arrondis ; un rôle vu dans moins de 30 parties (les gens de passage, le Somnambule, la
Rosière : jamais tirés par le générateur) garde son poids.

### Poids des rôles

| Rôle | Camp | Parties | Ancien | Mesuré (± 1 écart-type) | Retenu |
|---|---|---|---|---|---|
| liseuse-de-cendres | village | 6441 | +7 | +5.5 ± 0.3 | +6 |
| enfant-de-la-brume | village | 2185 | +3 | +4.4 ± 0.4 | +4 |
| chapardeur | village | 561 | +0 | +4.2 ± 0.7 | +4 |
| louvetier | village | 1286 | +4 | +4 ± 0.5 | +4 |
| veilleuse-de-lanterne | village | 1763 | +5 | +4 ± 0.4 | +4 |
| herboriste | village | 3825 | +5 | +3.7 ± 0.3 | +4 |
| gardeuse-d-oies | village | 2374 | +4 | +3.3 ± 0.4 | +3 |
| incendiaire | village | 103 | +2 | +2.7 ± 1.4 | +3 |
| garde-du-pont | village | 4152 | +4 | +2.6 ± 0.3 | +3 |
| franc-villageois | village | 1262 | +2 | +2.5 ± 0.4 | +3 |
| vieux-sergent | village | 1414 | +3 | +2.5 ± 0.4 | +3 |
| greffier-begue | village | 964 | +3 | +2.3 ± 0.5 | +2 |
| aieul | village | 1865 | +5 | +2.2 ± 0.4 | +2 |
| gardienne-des-cles | village | 781 | +3 | +2.2 ± 0.6 | +2 |
| braconniere | village | 4058 | +3 | +1.8 ± 0.3 | +2 |
| messager | village | 718 | +2 | +1.7 ± 0.6 | +2 |
| juge-de-paix | village | 874 | +3 | +1.6 ± 0.5 | +2 |
| innocent | village | 1425 | +3 | +1.5 ± 0.4 | +2 |
| furet | village | 2665 | +5 | +1.4 ± 0.3 | +1 |
| bateleur | village | 1090 | +4 | +1.4 ± 0.5 | +1 |
| bucheron | village | 509 | +3 | +1.1 ± 0.2 | +1 |
| liseuse-d-etoiles | village | 2417 | +4 | +1 ± 0.4 | +1 |
| souffre-douleur | village | 1264 | +2 | +1 ± 0.4 | +1 |
| sourcier | village | 1402 | +4 | +0.9 ± 0.4 | +1 |
| fossoyeur | village | 4164 | +3 | +0.8 ± 0.4 | +1 |
| ermite | village | 1193 | +3 | +0.8 ± 0.5 | +1 |
| sonneur | village | 759 | +2 | +0.7 ± 0.6 | +1 |
| pie | village | 922 | +3 | +0.7 ± 0.5 | +1 |
| feu-follet | solitaire | 1873 | +0 | +0.6 ± 0.4 | +1 |
| conteuse | village | 728 | +2 | +0.6 ± 0.6 | +1 |
| lavandiere | village | 1130 | +3 | +0.5 ± 0.2 | +0 |
| entremetteuse | village | 623 | -1 | +0.4 ± 0.6 | +0 |
| pecheur-de-nuit | village | 812 | +3 | +0.3 ± 0.5 | +0 |
| revenant | solitaire | 730 | -2 | -0.8 ± 0.6 | -1 |
| chambriere | village | 1268 | +2 | -0.9 ± 0.4 | -1 |
| loup-pale | meute | 898 | -5 | -1.2 ± 0.6 | -1 |
| colporteur | solitaire | 660 | -1 | -1.6 ± 0.7 | -2 |
| dame-du-gue | solitaire | 171 | -5 | -1.8 ± 1.2 | -2 |
| joueur-de-vielle | solitaire | 471 | -4 | -2 ± 0.8 | -2 |
| pyromane | solitaire | 127 | -6 | -2.1 ± 1.3 | -2 |
| chasseur-de-primes | solitaire | 703 | -2 | -2.2 ± 0.7 | -2 |
| illumine | solitaire | 530 | -3 | -2.4 ± 0.7 | -2 |
| matin | village | 543 | -1 | -3.3 ± 0.6 | -3 |
| enfant-des-bois | village | 1174 | +0 | -3.7 ± 0.4 | -4 |
| loup-flaireur | meute | 648 | -8 | -5.3 ± 0.6 | -5 |
| loup-des-roseaux | meute | 681 | -7 | -6.3 ± 0.6 | -6 |
| loup-hurleur | meute | 999 | -7 | -7 ± 0.6 | -7 |
| loup-deguise | meute | 910 | -8 | -7.7 ± 0.6 | -8 |
| loup-affame | meute | 912 | -8 | -11.3 ± 0.5 | -11 |
| louve-mere | meute | 593 | -9 | -12 ± 0.6 | -12 |

Ce que la mesure dit des anciens poids : la **Louve mère** et le **Loup affamé** valent bien plus que posé (-12 et -11, contre -9 et
-8 : la morsure et la seconde victime pèsent lourd), le **Loup pâle** presque rien pour la meute (-1 : il dévore les siens) ;
l'**Enfant des bois** (-4) et le **Mâtin** (-3) passent assez souvent à la meute pour lui profiter ; la **Liseuse de cendres** reste le
premier rôle du Village (+6), suivie de l'Enfant de la brume, du Chapardeur, du Louvetier, de la Veilleuse et de l'Herboriste (+4) ;
plusieurs rôles d'information que les joueurs simulés exploitent mal (Furet, Sourcier, Ermite, Fossoyeur, Liseuse d'étoiles : +1)
et les rôles de jour (Sonneur, Conteuse, Pie : +1) rapportent peu dans le simulateur — de vrais joueurs en tireraient sans doute
davantage (voir « Limites »).

**Le Village** (la variante) : -0,9 ± 0,5 poids, soit -4 ± 2 points pour le village par rapport à la partie ordinaire.

### Cibles par niveau et par taille

Les cibles retenues (en gras), écrites dans `equilibre.mjs` (`CIBLES`) et visées par le générateur (`cibleDe`), qui les atteint à ±1
partout (vérifié de 6 à 18 joueurs aux quatre niveaux) ; entre parenthèses, la cible de la régression (lissée). Entre les deux : le
**second passage** (`--corriger`, d'après la validation à 400 parties par case des tailles paires, puis à 150 parties des tailles
impaires), la **sécante** entre deux validations pour cinq cases que le second passage avait dépassées (débutants 10, 16 et 18, chaos 12,
Le Pacte 12), et les **bornes** de ce que le générateur atteint (débutants 6, 15, 17 et 18 : à son plancher ou son plafond).

| Niveau | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| debutants | **+0** (+1) | **+1** (+0) | **+0** (-2) | **-3** (-5) | **-6** (-6) | **-8** (-7) | **-8** (-8) | **-11** (-12) | **-13** (-12) | **-13** (-13) | **-16** (-17) | **-18** (-18) | **-17** (-18) |
| classique | **+1** (+3) | **+0** (+0) | **-3** (-2) | **-3** (-2) | **-7** (-5) | **-7** (-9) | **-12** (-10) | **-12** (-12) | **-15** (-13) | **-14** (-15) | **-17** (-16) | **-17** (-18) | **-20** (-19) |
| chaos | **+1** (+3) | **+0** (+1) | **-3** (-2) | **-3** (-3) | **-5** (-5) | **-8** (-8) | **-11** (-11) | **-13** (-12) | **-14** (-13) | **-16** (-14) | **-17** (-18) | **-19** (-18) | **-21** (-19) |
| le-pacte | **+1** (+2) | **+1** (+1) | **-1** (+0) | **+0** (-2) | **-5** (-5) | **-7** (-7) | **-10** (-9) | **-12** (-12) | **-14** (-14) | **-14** (-14) | **-17** (-18) | **-17** (-19) | **-19** (-19) |

Petite tablée (4 à 12 places) : 4 → +3, 5 → +1, 6 → -1, 7 → +0, 8 → +0, 9 → -5, 10 → -3, 11 → +1, 12 → +0.
Ajustements des variantes (`AJUSTEMENTS`) : vendanges +11, envoutement -7 (section « Les variantes »).

À six joueurs (deux loups contre quatre), aucune composition n'atteignait sa cible : l'**Herboriste** sort maintenant dès 6 joueurs
(`joueursMin` 6 au lieu de 7). Aux grandes tables, le village l'emporte même peu armé : le générateur peut désormais prendre de **0 à
100 %** des places restantes en rôles à pouvoir (de 15 à 70 % avant), ce qui lui laisse atteindre les cibles des deux bouts (une table
de 18 débutants à sa cible : 5 loups, un Fossoyeur, 12 Villageois). Si ces grandes tables trop simples déplaisent, l'autre levier est
le barème des loups (`nombreDeLoups` : 5 dès 16 joueurs), à décider.

**Petite tablée** : ses compagnons IA jouent sans les politiques (le moteur ne les a pas encore), le simulateur ne la mesure donc pas ;
ses cibles sont celles qui gardent ses compositions d'avant aux nouveaux poids (de 4 à 12 places : 4 → +3, 5 → +1, 6 → -1, 7 → +0, 8 → +0, 9 → -5, 10 → -3, 11 → +1, 12 → +0),
et l'essai d'intégration la mesure toujours (bornes 30-72 %). Les rôles du jeu de soirée y restent hors (`PACTE_HORS_TABLEE`), pour la
même raison.

### Solitaires (dans l'échantillon de calibration)

La part des parties qu'un solitaire gagne quand il est distribué (visée : 5 à 20 %) :

| Rôle | Parties | Il gagne |
|---|---|---|
| revenant | 730 | 24 % |
| chasseur-de-primes | 703 | 28 % |
| colporteur | 660 | 0 % |
| pyromane | 127 | 9 % |
| dame-du-gue | 171 | 16 % |
| feu-follet | 1873 | 10 % |
| joueur-de-vielle | 471 | 32 % |
| illumine | 530 | 6 % |
| loup-pale | 898 | 0 % |

Le **Colporteur** ne gagne jamais « seul » : après son échange, il gagne avec son nouveau camp (compté avec la meute ou le village) ;
le **Loup pâle** ne finit jamais dernier vivant (la meute ou le village l'emportent avant). Trois solitaires dépassent 20 % : le
**Joueur de vielle** (deux charmes par nuit, règle du livre ; les charmés simulés le cherchent parmi les non-charmés dès que la moitié
du village l'est, sans assez de succès), le **Chasseur de primes** et le **Revenant** (leurs victoires tombent des premiers votes, au
hasard, avant que le village sache quoi que ce soit). Les poids ne changent pas la part d'un solitaire : il faudrait une règle (un
charme par nuit, une cible tirée parmi les rôles à pouvoir, un Revenant qui ne gagne pas au premier vote…). **Non changé** : à décider
(la règle du Joueur de vielle est celle du livre).

## Les constantes recalibrées

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

## Les mesures

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

`essais/veillees-equilibre.test.mjs` (dans `npm run essais`, une minute sur 8 fils) : 16 parties par case, graine « rapide », adresse 1,
quatre niveaux × 6, 10, 14 et 18 joueurs, compositions générées. Il échoue si la meute sort de **30-70 %** (des parties gagnées par la
meute ou le village) à un niveau ou à une taille, si une partie finit en erreur, si les solitaires gagnent plus d'une partie sur trois
de celles où ils sont (ou l'un d'eux plus d'une sur deux, sur 20 parties au moins), et vérifie que le simulateur est déterministe.
Mesuré à l'écriture : débutants 34 %, classique 45 %, chaos 52 %, Le Pacte 42 % ; 6 joueurs 38 %, 10 : 37 %, 14 : 45 %, 18 : 55 % ;
solitaires 24 victoires sur 102 parties. Deux autres essais : `essais/politiques-veillees.test.mjs` (le contrat : chaque effet de rôle,
pouvoir de jour et geste a sa politique ; le savoir lu en français et en anglais ; les choix de l'adresse 1 et de l'adresse 0) et
`essais/calibration-veillees.test.mjs` (la régression retrouve des effets connus ; l'échelle, la cible, l'échantillon). Les compositions
prêtes sont contrôlées par `essais/veillees-compositions.test.mjs` (chacune est celle du générateur, à ±2 de sa cible).

## Limites

- **Ce que le simulateur ne joue pas** : le débat lui-même (mines, hésitations, plaidoiries, contre-annonces), les rôles que l'on
  prétend tenir, la Gazette autrement qu'au hasard (ses demandes au narrateur et aux joueurs se tranchent au hasard), les pouvoirs
  narratifs (Conteuse, Maîtresse d'école : sans effet mécanique ici). Les rôles qui vivent de ce que les joueurs en font (Furet,
  Sourcier, Ermite, Liseuse d'étoiles, Pie, Sonneur) y valent sans doute moins qu'à une vraie table : leurs poids sont des planchers.
- **L'adresse 1 est la référence, et elle pèse lourd** : à l'adresse 0,5, la meute gagne 80 à 95 % des parties gagnées par la meute
  ou le village, surtout aux grandes tables, que la calibration arme peu (le village d'adresse 1 s'y accorde si bien qu'il lui faut peu de
  rôles). Une table qui se sert mal de ce qu'elle sait trouvera la meute bien plus forte que ne le promet la cible. **À décider** : une
  adresse de référence par niveau (par exemple 0,5 pour les débutants, 0,75 pour le classique, 1 pour le chaos et Le Pacte), ou une
  seule plus basse ; l'outil recalibre à n'importe quelle adresse (`--adresse`), une heure et demie de calcul.
- **Une graine, une partie** : les mesures se rejouent à l'identique (mêmes graines, même code). Une règle, une politique ou un poids
  qui change déplace tout : remesurer avant de conclure (commandes plus bas).

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

## Remesurer

Toutes les mesures se rejouent à l'identique (mêmes graines, même code ; 16 fils, une machine de 32 cœurs logiques) :

    # avant / après, compositions générées (400 parties par case à l'adresse 1 : ±5 points ; 150 à l'adresse 0,5)
    node essais/outils/simuler-veillees.mjs --parties 400 --adresse 1 --graine apres --json apres-1.json            (~25 min)
    node essais/outils/simuler-veillees.mjs --parties 150 --adresse 0.5 --graine apres --json apres-05.json         (~8 min)
    node essais/outils/simuler-veillees.mjs --parties 150 --tailles 7,9,11,13,15,17 --adresse 1 --graine apres      (~6 min)
    # compositions prêtes (30 parties chacune)
    node essais/outils/simuler-veillees.mjs --pretes --parties 30 --tailles 6,7,8,9,10,11,12,13,14,15,16,17,18 --adresse 1 --graine apres
    # variantes contre la partie ordinaire
    node essais/outils/simuler-veillees.mjs --variantes ordinaire,chandelles,angoissante,chaine,mur,petite,grande,vendanges,envoutement,gazette,village \
      --niveaux classique,le-pacte --tailles 8,12,16 --parties 50 --adresse 1 --graine variantes
    # recalibrer : poids et cibles (régression), puis second passage des cibles d'après une validation
    node essais/outils/calibrer-poids.mjs --parties 12000 --graine cal --adresse 1 --json cal.json
    node essais/outils/calibrer-poids.mjs --depuis cal.json --parties 0 --ecrire
    node essais/outils/simuler-veillees.mjs --parties 400 --adresse 1 --graine apres --json validation.json
    node essais/outils/calibrer-poids.mjs --corriger validation.json --echelle 5.68 --ecrire
    npm run fabriquer-veillees && npm run fabriquer-veillees-en

Le simulateur écrit ses tableaux en markdown (`--json` : chaque partie, pour les recouper) ; `--rapide` joue 16 parties par case.
