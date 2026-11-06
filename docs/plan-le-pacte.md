# Plan « Le Pacte » : les Veillées identiques au jeu de soirée de Jordan

*Décidé le 6 novembre 2026. Feuille de route du chantier ; tenir à jour la colonne « État ».*

## Le but

Jordan veut retrouver aux Veillées **exactement** le jeu qu'il fait en soirée avec ses amis : la boîte complète du jeu de loups-garous
classique avec ses extensions (personnages, bâtiments du village, événements de nouvelle lune, variantes). Ses consignes :

- **mécaniques identiques**, pas approchantes : chaque rôle, bâtiment, charge et variante du livre fait ici exactement ce qu'il fait
  sur table (adapté au jeu en ligne seulement là où la table physique n'a pas d'équivalent, adaptation notée) ;
- **noms changés** (univers de Brumecombe) pour rester loin de la marque ; aucun texte du livre recopié, règles réécrites ;
- **nos créations gardées** (« plus est mieux que moins ») : rôles, bâtiments, présages et variantes propres aux Veillées restent
  disponibles en option ; un nom qui entre en conflit avec le livre est renommé ;
- **français et anglais** pour tout (rôles, guides, aides, interface) ;
- **tout rééquilibré**, mesuré par simulation et non plus seulement par poids posés à la main ;
- ensuite, musiques par ComfyStudio pour les modules et mondes (contenu IA : version interne Forgejo seulement).

Les cartes Événement de nouvelle lune (31, plus 5 cartes Spiritisme) sont reprises à l'identique avec nos propres textes (photos de
Jordan du 6 novembre ; cahier des charges : `docs/gazette-de-la-lune.md`) : fait à l'étape 9.

## Les noms (français / anglais)

Colonne « livre » : la fonction du personnage, pour s'y retrouver ; jamais affichée en jeu.

### Loups
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| loup-garou simple | Loup de Brumecombe | Wolf of Brumecombe | `loup-de-brumecombe` | existe |
| grand méchant loup | Loup affamé | Ravenous Wolf | `loup-affame` | aligné (étape 2 : chaque nuit tant qu'aucun loup n'est mort) |
| infect père des loups | Louve mère | Mother Wolf | `louve-mere` | aligné (étape 2 : infection, la garde ne l'arrête pas) |
| loup-garou blanc | Loup pâle | Pale Wolf | `loup-pale` | fait (étape 3b : ordre 41, une nuit sur deux, dévore un loup ; victoire `seul-survivant`, jamais gagnant avec la meute) |

### Villageois
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| simple villageois | Villageois | Villager | `villageois` | existe |
| villageois-villageois | Franc-Villageois | Plain Villager | `franc-villageois` | fait (étape 3a : rôle public dès la distribution) |
| voyante | Liseuse de cendres | Ash Reader | `liseuse-de-cendres` | aligné (étape 2 : voit le rôle, effet `voir-role`) |
| cupidon | Entremetteuse | Matchmaker | `entremetteuse` | vérifié (étape 2 : amants de camps différents jamais gagnants avec leur camp) |
| sorcière | Herboriste | Herbalist | `herboriste` | aligné (étape 2 : deux fioles la même nuit) |
| chasseur | Braconnière | Poacher | `braconniere` | aligné (étape 1 : elle choisit elle-même) |
| petite fille | Enfant de la brume | Mist Child | `enfant-de-la-brume` | aligné (étape 2 : noms des loups, surprise 1/2 à recalibrer) |
| salvateur | Garde du pont | Bridge Warden | `garde-du-pont` | aligné (étape 2 : contre la meute seulement, cible d'hier retirée des candidats) |
| ancien | Aïeul | Greybeard | `aieul` | fait (étape 3a : vie de réserve secrète contre la meute et la morsure ; sagesse perdue s'il tombe du vote, du poison ou de la Braconnière ; réglage « L'Innocent suit l'Aïeul ») |
| bouc émissaire | Souffre-douleur | Whipping Boy | `souffre-douleur` | fait (étape 3a : paie l'égalité avant le Bailli et le sort ; dernier geste « votants » pour les votes d'exécution du lendemain) |
| idiot du village | Innocent | Village Innocent | `innocent` | fait (étape 3a : gracié une fois au vote, carte retournée, sans voix ; la charge de Bailli abolie) |
| deux sœurs | Lavandières (2) | Washerwomen | `lavandiere` | fait (étape 3a : nuits 1, 3, 5… ; noms au carnet, salon vocal « fratrie » ; tirées par deux) |
| trois frères | Bûcherons (3) | Woodcutters | `bucheron` | fait (étape 3a : comme les Lavandières, tirés par trois, niveau chaos) |
| renard | Furet | Ferret | `furet` | fait (étape 3a : trio autour du joueur désigné ; « non » : flair perdu, réveillé sans candidats) |
| montreur d'ours | Gardeuse d'oies | Goose Girl | `gardeuse-d-oies` | fait (étape 3a : annonce au matin après les morts ; mordue, chaque matin) |
| juge bègue | Greffier bègue | Stammering Clerk | `greffier-begue` | fait (étape 3a : pouvoir de jour secret ; second vote ouvert dès que les condamnés sont tombés) |
| chevalier à l'épée rouillée | Vieux Sergent | Old Sergeant | `vieux-sergent` | fait (étape 3a : premier loup vivant à gauche, mort la nuit suivante, cause publique « contamine ») |
| corbeau | Pie | Magpie | `pie` | fait (étape 3a : ordre 46, annonce anonyme au matin, deux voix au premier vote d'exécution du jour ; filtre `EXCLUS_DE_LA_PLUME` prêt pour le Chemineau) |
| pyromane (incendie un bâtiment) | Incendiaire | Firebrand | `incendiaire` | fait (étape 4 : ordre 19, une fois ; un bâtiment désigné par son occupant, détruit au matin ; la maison de la proie : pas de victime, premier loup vivant à droite carbonisé, cause publique `incendie` ; seulement avec « Le Village », `equilibre.village`) |

### Ambigus
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| voleur | Chapardeur | Pilferer | `chapardeur` | fait (étape 3b : ordre 1 ; deux Villageois de plus au paquet, le centre secret ; obligé si deux loups) |
| comédien | Bateleur | Mountebank | `bateleur` | fait (étape 3b : ordre 2 ; trois cartes tirées hors du paquet, annoncées, réglables (`cartesDuBateleur`) ; la carte jouée le réveille à son ordre, retirée au matin) |
| chien-loup | Mâtin | Mastiff | `matin` | fait (étape 3b : ordre 38, première nuit ; se désigner = la meute dès cette nuit) |
| enfant sauvage | Enfant des bois | Woods Child | `enfant-des-bois` | fait (étape 3b : ordre 13 ; modèle mort, toute cause : loup en secret) |
| servante dévouée | Chambrière | Chambermaid | `chambriere` | fait (étape 3b : demande courte au décompte, l'exécution l'attend ; rôle remis à neuf, `nuit.debut` ; gestes du condamné ignorés) |

### Solitaires
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| ange | Feu follet | Will-o'-the-Wisp | `feu-follet` | fait (étape 3b : la veillée commence par un jour, annoncé ; victoire `premier-tour` ; villageois au matin de la nuit 1) |
| joueur de flûte | Joueur de vielle | Hurdy-Gurdy Player | `joueur-de-vielle` | fait (étape 3b : ordre 80, deux charmés par nuit, réveil « charmes » à 81 ; victoire `tous-charmes`) |
| abominable sectaire | Illuminé | Zealot | `illumine` | fait (étape 3b : partage par la rive, annoncé, critères branchables pour l'étape 9 ; victoire `autre-groupe`) |

### Charges et médium
| Livre | Chez nous | English | État |
|---|---|---|---|
| capitaine | Bailli (charge élue) | Bailiff | aligné (étape 2 : sa voix tranche l'égalité d'office) ; étape 4 : dans « Le Village », désigné par les Métayers parmi eux à partir du deuxième jour, succession parmi eux, aboli avec le dernier |
| garde champêtre | Crieur public | Town Crier | fait (étape 9 : charge publique nommée par le Bailli, jamais lui-même ; N cartes secrètes confiées avant la partie, retirées du paquet de la Gazette ; une annonce chaque matin dès le lendemain ; révocable par le Bailli après l'annonce et avant le vote, pouvoir de jour `crieur-public` ; transmise s'il devient Bailli ; remplacé s'il meurt ; un nouveau Bailli garde ou change ; réglages « crieurPublic », « cartesDuCrieur ») |
| gitane (sans philtre) | Liseuse d'étoiles | Stargazer | fait (étape 9 : `liseuse-d-etoiles`, effet `spiritisme`, ordre 51 ; se désigner = une séance au matin ; 5 cartes Spiritisme du narrateur, hors du paquet ; la réponse vraie de l'esprit du premier mort, calculée ; poids provisoire +4, classique, 8 joueurs ; hors petite tablée et compositions prêtes, sauf Le Pacte) |

### Personnalités du village (bâtiments tenus par un joueur)
| Livre | Personnage / bâtiment | English | État |
|---|---|---|---|
| fermiers (6 fermes) | Métayers / les métairies | Tenant Farmers / farmsteads | fait (étape 4 : `metairie-1` à `metairie-6` ; le Bailli désigné par eux, parmi eux, dès le 2e jour ; ils gardent ce droit sans sagesse) |
| confesseur / église | Prieur / le prieuré | Prior / priory | fait (étape 4 : `prieure`, pouvoir de jour unique ; la carte au carnet du Prieur) |
| rebouteux / masure | Remégeux / la masure | Bonesetter / hovel | fait (étape 4 : `masure`, unique ; rend un pouvoir unique servi) |
| institutrice / école | Régent / l'école | Schoolmaster / school | fait (étape 4 : `ecole`, au débat, un ou deux privés de vote ce jour ; ne vote jamais) |
| boulanger / boulangerie | Fournière / le fournil | Oven-Keeper / bakehouse | fait (étape 4 : `fournil` ; adaptation : une chance sur trois d'entrevoir un loup, `CHANCE_FOURNIERE`, réglage caché `chanceFourniere`, à recalibrer à l'étape 6) |
| barbier / échoppe | Perruquier / l'échoppe | Wigmaker / shop | fait (étape 4 : `echoppe`, unique ; cause publique `rasoir`, une mort du village pour l'Aïeul) |
| tavernier / taverne | Cabaretier / le cabaret | Alehouse Keeper / alehouse | fait (étape 4 : `cabaret` ; ni proie ni candidat ; vote public ; immunité perdue s'il vote contre un condamné) |
| bailli / sa maison | Prévôt / la prévôté | Provost / provostry | fait (étape 4 : `prevote` ; demandes « prevot » puis « logement », le pouvoir rétabli) |
| châtelain / manoir | Hobereau / le manoir | Squire / manor | fait (étape 4 : `manoir`, unique ; demandes « supplique » puis « grace » après le vote, carte cachée) |
| vagabonds | Chemineaux | Drifters | fait (étape 4 : sans bâtiment ; hors de portée du Régent, du Perruquier, de la Pie et de l'Incendiaire) |

### Variantes du livre
| Livre | Chez nous | English | État |
|---|---|---|---|
| clair de lune | Veillée aux chandelles | Candlelight | fait (étape 5 : réglage « chandelles », la chandelle sur la carte de la Table, éteinte à la mort ; angoissante, réglage « chandellesAngoissantes » : chaque loup souffle la sienne, plus d'une éteinte = pas de victime, annoncé au matin) |
| communauté des hameaux | Les Hameaux | The Hamlets | **pas fait** : proposition chiffrée plus bas (« Les Hameaux : proposition »), à décider |
| « c'est sûrement pas lui » | La Chaîne des innocents | Chain of Innocents | fait (étape 5 : réglage « chaineDesInnocents » ; le vote d'exécution devient la chaîne, du voisin de gauche du dernier éliminé ; sans réponse, le sort ; pas de Banc avec elle) |
| murs-murs | Le Mur des murmures | Whispering Wall | fait (étape 5 : réglage « murDesMurmures » ; étape « mur » en fin de nuit, tous les vivants ; phrases gardées SANS auteur, lues au matin) |
| double « je » (petite / grande complication) | Double visage | Two Faces | fait (étape 5 : réglage « doubleVisage » = "" / "petite" / "grande" ; 7 à 18 joueurs, second paquet dès 10 : 3 loups jusqu'à 13, 4 au-delà ; la seconde carte dans la fiche) |
| fête de la moisson | Les Vendanges | Grape Harvest | fait (étape 5 : réglage « vendanges » ; un loup de plus ; les douze pouvoirs éméchés) |
| peste noire | Peste noire | Black Plague | vérifié (étape 2 : identique ; guide : l'appel comme d'habitude) ; étape 5 : jouable au niveau « Le Pacte » ; exclut Double visage, Vendanges, Envoûtement |
| fascination lycanthropique | L'Envoûtement | The Thrall | fait (étape 5 : réglage « envoutement » ; envoûtés secrets, pouvoirs perdus, chute des précédents, victoire de la meute à l'avant-dernier) |
| nouvelle lune (31 événements, 5 Spiritisme) | La Gazette de la lune | Moon Gazette | fait (étape 9 : `logique/gazette.mjs` ; réglages « gazette », « gazetteRythme », « gazetteChoix », permanentes dès le début ; l'Almanach écarté ; carte par carte : `docs/gazette-de-la-lune.md`, colonne « État ») |

### Renommages de nos créations (conflits)
- Gens de passage « Montreur d'ours » → **Montreur de marmotte** (Marmot Showman) : le nom est celui d'un rôle du livre qui fait
  autre chose. Fait (étape 2), clé `montreur-d-ours` gardée.
- Le métier « Curé », la Taverne, l'Aubergiste et la Maîtresse d'école restent : les personnalités du livre prennent d'autres
  noms (Prieur, Cabaretier, Régent).

## Les règles à reprendre (résumé de travail)

Ordre d'appel du livre, dans nos clés. **Première nuit** : Chapardeur, Bateleur, Entremetteuse, Liseuse, Furet, amoureux,
Greffier bègue (son signe), Lavandières, Bûcherons, Enfant des bois, Gardeuse d'oies (au matin), Pie, Incendiaire, Garde du pont,
meute (avec le Mâtin s'il a choisi la meute), Enfant de la brume, Fournière, Louve mère, Loup affamé, Herboriste, Liseuse
d'étoiles, Joueur de vielle, charmés. **Chaque nuit** : Bateleur, Liseuse, Furet, Pie, Incendiaire, Garde du pont, meute, Enfant de
la brume, Fournière, Loup pâle (une nuit sur deux), Louve mère, Loup affamé (tant qu'aucun loup n'est mort), Herboriste, Liseuse
d'étoiles, Joueur de vielle, charmés. **Chaque jour** : révélation des victimes, grognement des oies, Spiritisme, Crieur public,
débat, vote et appel à la Chambrière, Feu follet (s'il est éliminé au 1er tour), second vote du Greffier.

Socle à créer d'abord (servira à plusieurs rôles) :
- **le cercle** : ordre des places autour de la table, fixé à la distribution, affiché ; voisins de gauche et de droite (Furet,
  Gardeuse d'oies, Vieux Sergent, Double visage) ; les morts sautés ;
- **choix d'un mourant** : la Braconnière, le Souffre-douleur, le Bailli désignent eux-mêmes (`demandeLibre` posthume) ;
- **rôle public** dès la distribution (Franc-Villageois, Double visage, jetons « rôle visible » des personnalités) ;
- **bâtiments tenus** : `etat.tenures` (bâtiment → occupant), vacance à la mort, réattribution par le Prévôt ;
- **charges** : modèle du Bailli généralisé (Crieur public nommé par le Bailli, révocable) ;
- **événements** : `etat.evenements` (immédiat, différé, permanent), généralisant l'Almanach.

## Les étapes

| # | Étape | État |
|---|---|---|
| 1 | Socle (cercle, choix posthumes, rôle public, tenures, charges, événements) | fait (sauf les charges : Crieur public avec l'étape 4) ; reste au moteur MJ IA (étape 8) : ne plus dire au narrateur de « demander » à la Braconnière qui emporter (`loups_eliminer`, `loups_nuit`) et une consigne de compagnon pour l'objet `emporter` |
| 2 | Aligner les rôles existants (Loup affamé, Louve mère, Liseuse, Herboriste, Braconnière, Enfant de la brume, Garde du pont, Entremetteuse, Bailli, Peste noire) | fait, avec nos créations corrigées (Sonneur : pouvoir de jour ; Loup déguisé : le masque tombe ; Revenant : la partie s'arrête ; garde du Garde du pont contre la meute seulement, d'où le harpon et la noyade arrêtés par la seule Gardienne) ; reste au moteur MJ IA (étape 8) : Herboriste et proies de la nuit (`api.proiesDeLaNuit`), nom du Montreur de marmotte, consigne du Sonneur |
| 3 | Nouveaux rôles : villageois, puis ambigus, puis solitaires, puis Loup pâle | fait : 3a (les onze rôles du Village, `logique/pacte.mjs`) et 3b (les cinq ambigus, les trois solitaires du livre et le Loup pâle, `logique/ambigus.mjs`) ; poids provisoires (Mâtin -1, Enfant des bois 0, Feu follet 0 pour garder le générateur à ±2), hors compositions prêtes et petite tablée ; reste au moteur MJ IA (étape 8) : voir plus bas |
| 4 | Personnalités du village, Chemineaux, Incendiaire (la variante « Le Village ») | fait : `logique/personnalites.mjs` (état public `etat.village`, tenures du socle), réglage « leVillage » et case de la Table de jeu, encart « Le Village » (le narrateur change la proposition avant la première nuit), personnalités sur les cartes de la Table et les fiches ; Incendiaire (poids provisoire +2, `equilibre.village`), hors petite tablée et compositions prêtes ; guides fr et en (page « Le Village » des variantes et du guide du narrateur). Le Crieur public et la Liseuse d'étoiles passent à l'étape 9, avec les cartes ; reste au moteur MJ IA (étape 8) : voir plus bas |
| 5 | Variantes du livre ; mode « Le Pacte » (composition fidèle au livre) ; ordre d'appel du livre | fait, sauf les Hameaux (proposition chiffrée ci-dessous, à décider) : `logique/variantes.mjs` (état public `etat.variantes`, secrets `etat.variantesSecret`), un réglage monde par variante (non par défaut) et ses cases à la préparation de la Table, recopiées à la distribution ; niveau `le-pacte` du générateur (`ROLES_DU_LIVRE`, ni bâtiment ni métier ; compositions prêtes `le-pacte-06` à `-18`), proposé d'abord par la Table ; ordres de nuit du livre (Entremetteuse 3, Liseuse 4, Pie 14, Enfant de la brume 41, Loup pâle 42, Louve mère 43, Loup affamé 44…), page « Mener la nuit » ; guides fr et en (« Le Pacte », « Les variantes du jeu de soirée ») ; reste au moteur MJ IA (étape 8) : voir plus bas |
| 6 | Simulateur (`essais/outils/simuler-veillees.mjs`), politiques par effet pour les joueurs simulés et les compagnons, calibration des poids par régression, cibles par taille ; compositions prêtes passées au générateur | à faire |
| 7 | Anglais (dictionnaires, guides retraduits), jetons, carte (repères des bâtiments), guides du joueur et du narrateur | à faire |
| 8 | Publication (système, module, moteur si les compagnons changent), déploiement LaKour, essai en vrai | à faire |
| 9 | Cartes Événement et Spiritisme : mécaniques consignées dans `gazette-de-la-lune.md` (photos reçues le 6 nov.) ; traits visibles des personnages ; le Crieur public (charge nommée par le Bailli, socle « charges ») et la Liseuse d'étoiles (Spiritisme), venus de l'étape 4 | fait : traits visibles (publics, `etat.traits` ; un drapeau `traits` sur l'acteur respecté ; l'Illuminé partage selon la rive ou un trait, réglage « partageIllumine ») ; la Gazette (31 cartes, toutes faites, adaptations dans `gazette-de-la-lune.md` ; votes « defiance » et « suite », objets « executeur » et « chatiment » dans `etat.mjs`) ; le Crieur public ; l'Exécuteur ; la Liseuse d'étoiles et le Spiritisme (20 questions, réponse calculée) ; Table (traits, encart, cases), fiches, fenêtre de vote ; guides fr et en (pages « La Gazette de la lune », « Mener la Gazette de la lune ») ; reste au moteur MJ IA (étape 8) : voir plus bas |
| 10 | Webcam (après les rôles) : réglage MJ « caméras permises » dans le moteur commun (tous les modules) ; aux Veillées, image de remplacement quand il le faut (nuit, morts, comme la coupure du micro de `salons.mjs` / `activite.mjs`) : logo de loup-garou fait sur ComfyStudio | à faire |
| 11 | Musiques ComfyStudio pour les modules et mondes (version interne) | après le reste |
| 12 | Hameaux (décision de Jordan, 6 nov.) : les DEUX options, après la publication : d'abord B (un monde Foundry par hameau, relais entre mondes : ce qui suffit à Jordan), puis A (plusieurs hameaux dans un même monde : pour la communauté). Conception chiffrée plus haut. | après la publication |

Chaque étape : essais verts (`npm run essais`), fabrication fr et en, un commit par étape.

## Étape 5 : choix tranchés et adaptations

- **Ordre d'appel** : les rôles du livre suivent l'ordre résumé plus haut (première nuit, chaque nuit). Les étapes du livre sans réveil
  propre restent où le système les mène : les amoureux apprennent leur lien au carnet ; le signe du Greffier bègue est un pouvoir de jour
  secret ; les oies grognent au matin ; la Fournière n'a pas d'étape (le système lui souffle ce qu'elle entrevoit). Nos créations sont à
  côté du rôle qui leur ressemble ; la résolution de l'aube ne dépend pas des numéros (par effet).
- **Mode « Le Pacte »** : niveau `le-pacte` (après le chaos dans `NIVEAUX`, la petite tablée reste la dernière ; la Table l'affiche en premier
  et le présélectionne). Dosage du niveau classique (0 à 1 loup spécial, 0 à 1 solitaire), tous les rôles du livre quel que soit leur niveau,
  `joueursMin` gardé ; ni bâtiments communaux ni métiers (le jeu de soirée n'en a pas). Générateur à ±2 vérifié (6 à 18 joueurs). Les
  poids restent ceux posés à la main (étape 6).
- **Veillée aux chandelles** : adaptation : la chandelle est sur la carte de chacun à la Table de jeu (allumée tant qu'il vit), et le chat
  dit qu'elle s'éteint à chaque mort ; pas de lumière sur le jeton du plateau. Angoissante : un loup qui ne souffle rien n'éteint rien
  (seules comptent les chandelles soufflées) ; une seule chandelle soufflée sur un joueur protégé ne s'annonce pas (la garde joue comme
  d'habitude).
- **Chaîne des innocents** : adaptation : au délai d'une désignation, le sort assied un debout (la chaîne ne s'arrête jamais) ; sans mort
  encore (Feu follet), elle part du Bailli, sinon de la première place du cercle ; le Cabaretier immunisé n'est pas debout ; ni voix double,
  ni plume, ni Souffre-douleur (pas de voix) ; un Innocent gracié désigne quand même (ce n'est pas un vote) ; pas de Banc.
- **Mur des murmures** : une étape « mur » (ordre 95, après le Fossoyeur) réveille tous les vivants : une fenêtre d'écriture chacun
  (120 caractères). Les phrases entrent au secret du MJ sans auteur et déjà mêlées ; l'étape est notée sans acteur ; au matin, le mur est
  public (`etat.variantes.murmures`) et lu au chat.
- **Double visage** : 7 à 18 joueurs ; au-delà de 9, un second paquet (les sept pouvoirs puis deux Villageois, dans cet ordre) et 3 loups
  d'allégeance jusqu'à 13 joueurs, 4 au-delà. Petite complication : le rôle visible est retourné devant tous sans camp (révélation « rôle
  seul »), l'allégeance fait le camp de la fiche. Grande complication : les cartes visibles et les allégeances mêlées, deux par joueur ; la
  carte principale est le pouvoir passif s'il y en a un (Aïeul, Souffre-douleur, Braconnière), la seconde vit dans la fiche
  (`fiche.seconde`) : elle se réveille à son ordre (comme une carte du Bateleur) et ses passifs jouent (Aïeul, Souffre-douleur,
  Braconnière) ; deux fois la même carte n'en donne qu'une. La Liseuse lit les cartes secrètes (l'allégeance, ou les deux cartes).
- **Vendanges** : un loup de plus (le générateur, ou un Villageois d'une composition prête remplacé ; jamais les rôles choisis à la main).
  Meute : un voisin vivant d'un loup vivant (le Loup affamé aussi). Liseuse : le désigné et ses deux voisins, rôles mêlés. Braconnière : ses
  deux voisins vivants. Enfant de la brume : elle voit l'Herboriste (son nom, ce qu'elle verse), sans risque. Chapardeur : échange au matin
  avec le joueur désigné, sans centre. Bailli : il vote seul et d'abord, à découvert (les autres sont refusés jusqu'à son vote, au plus le
  délai des choix). Souffre-douleur : à la place d'un voisin condamné (son geste « votants » suit). Herboriste : une fiole, une cible, le
  sort au matin (quatre issues égales ; « guéri » ne sauve qu'une victime de la nuit ; « Villageois » donne le rôle simple et le camp du
  Village). Entremetteuse : la première nuit, une étape « tromperie » (un des deux amants et un autre joueur) ; le trompé est l'autre amant ;
  le trompeur et l'amant se lient, le trompé aime le trompeur sans l'entraîner ; aux votes, deux amants ne votent pas l'un contre l'autre,
  sauf le trompeur contre le trompé. Garde : lui ou ses deux voisins. Joueur de vielle : un charmé par nuit.
- **Envoûtement** : toute attaque de loup sur un non-loup envoûte au lieu de tuer (la garde, le remède, la porte l'empêchent comme une mort ;
  l'Aïeul perd d'abord sa vie de réserve) ; la carte de l'envoûté reste (même nom), sans pouvoir (ni réveil, ni effet, ni seconde carte, ni
  pouvoir de jour) ; condamné par le village (cause « vote »), il entraîne les envoûtés d'avant lui (cause publique « envoute ») ; la meute
  gagne quand il reste au plus un vivant hors de la meute qui ne soit pas envoûté (la parité ordinaire vaut toujours).
- **Exclusions** : aucune variante dans une Nuit de la Saint-Martin ; ni Double visage, ni Vendanges, ni Envoûtement à la petite tablée ou
  dans une peste noire (et elles empêchent le tirage d'une peste) ; une peste choisie les écarte.

## Étape 5 : deux ajouts demandés par Jordan (faits)

- **Partie simple, sans bâtiments ni métiers** : réglage monde « batimentsDuVillage » (`hasard` par défaut, comme avant ; `aucun` ; `choisis`,
  liste dans le réglage caché « batimentsChoisis ») et réglage « metiersEnJeu » (oui par défaut) ; à la préparation de la Table, une ligne
  « Bâtiments du village : aucun / tirés au hasard / choisis » (cases des dix bâtiments quand ils sont choisis) et une case « Métiers ».
  `nouvellePartie({ batiments: "aucun" | "hasard" | [cle], metiers })` les applique à toute composition (générée, prête, choisie à la main)
  et les retient ; `api.logique.composer` (le générateur du MJ IA) suit le réglage des bâtiments. Sans bâtiment, `etat.batimentsCles` est vide :
  aucun effet de bâtiment, les repères de la carte restent des décors. Le Pacte n'en tire aucun (« choisis » en ajoute) et ne distribue
  jamais de métier ; Le Village (personnalités) reste une case à part : Le Pacte sans Le Village se joue donc sans aucun bâtiment.
- **Explication à la distribution** : chaque joueur HUMAIN reçoit, à son seul carnet secret (qui s'ouvre aussitôt et se rouvre par
  « Carnet secret » ou le rôle du bandeau), une entrée « Comment jouer : <son rôle> » : ce que fait son rôle (sa description), quand le
  narrateur l'appelle (d'après ses réglages de nuit) et ce qu'il lui demandera (l'invite), ses usages, comment il gagne (son texte de
  victoire, sinon celle de son camp), sa seconde carte (Double visage), son métier (description, pouvoir de jour) et sa personnalité (Le
  Village). Textes des objets du contenu installé (français ou anglais), libellés du système (`LAKOUR_LOUPS.Explication`). Les compagnons IA
  n'en reçoivent pas. Non-fuite : le crible vérifie qu'une explication ne parle que du rôle de son destinataire (mutation : envoyée à un autre).

## Les Hameaux : proposition (non faite, à décider)

Sur table : plusieurs villages complets en même temps, chacun son meneur et ses loups ; un joueur quitte son village (sauf la nuit, ou juste
désigné par le vote) avec sa carte secrète et demande à entrer ailleurs (le meneur l'autorise ; un plafond de départs par village) ; des
personnages identiques peuvent coexister ; des loups qui désertent un village le font gagner à ses villageois.

**Pourquoi pas maintenant** : un monde de Foundry ne porte qu'UNE partie. L'état (réglage monde `lakour-loups.partie`, secrets du MJ actif,
coffre) est unique ; `tousLesVillageois()` et `villageoisAPlat()` rendent tout le village ; la phase, la nuit, le vote, le Bailli, le cercle, le
Registre, les salons vocaux, le plateau et la Table de jeu supposent une seule veillée ; un seul MJ actif écrit. Il n'existe pas de découpage
« sans refondre l'état ».

**Option A — des hameaux dans un même monde** (la plus fidèle) :
- état : `etat.hameaux = { cle: <état d'une partie> }` et secrets rangés par hameau (`etat.mjs` séparer/fusionner, `secrets.mjs`,
  `coffre.mjs` : environ 300 lignes) ; un champ public `system.hameau` par villageois ;
- API (`scripts/api.mjs`, 3 900 lignes) : un hameau courant pour chaque fonction qui lit ou écrit (environ 120 fonctions),
  `tousLesVillageois` filtré par hameau, socket et hooks portant le hameau, nouvelles fonctions (`quitterLeHameau`, `demanderAEntrer`,
  `accueillirDansLeHameau` : la fiche secrète suit le joueur), victoire « les loups ont déserté » : environ 1 500 lignes changées ;
- la logique pure (`logique/*.mjs`) reçoit déjà un état et des villageois : presque rien à changer, sauf la victoire par désertion et le
  plafond de départs (environ 150 lignes) ;
- Table de jeu (un onglet par hameau pour le MJ, son hameau pour le joueur), salons vocaux (par hameau), plateau (une scène, ou une zone,
  par hameau) : environ 800 lignes ;
- plusieurs meneurs : Foundry n'a qu'un MJ actif qui écrit ; les autres meneurs passeraient par lui (demandes de socket « meneur »), ou
  tous les hameaux seraient menés par le même MJ (humain, ou un narrateur IA par hameau dans le moteur : environ 800 lignes de plus dans
  `lakour-mj-ia`) ;
- essais : environ 1 500 lignes (les essais actuels gardés sur un hameau par défaut).
- **Coût estimé** : 5 000 à 6 000 lignes touchées, 8 à 12 jours de travail d'agent, risque de régression élevé (tout le système passe par
  l'état) ; à placer après l'étape 6 (simulateur), qui le testerait mieux.

**Option B — un monde Foundry par hameau** : un serveur Foundry par monde (une licence chacun) et un relais entre mondes pour le passage
d'un joueur (sa fiche secrète chiffrée d'un coffre à l'autre, l'accord du meneur d'arrivée, le plafond de départs) : un service sur le serveur
LaKour, deux API (`exporterLeJoueur`, `importerLeJoueur`), la victoire par désertion annoncée d'un monde à l'autre. Coût : 2 000 à 3 000 lignes
(service, API, Table), mais une infrastructure de plus à tenir, et les joueurs changent de monde (reconnexion) à chaque passage.

**Sans rien coder** (pis-aller) : plusieurs mondes LaKour ouverts en même temps, chacun sa veillée ; un joueur qui « change de village »
quitte sa veillée (« Quitter la veillée ») et entre dans l'autre comme gens de passage — sans garder sa carte (ce n'est pas la règle du livre).

## À faire dans le moteur commun (`lakour-mj-ia`, étape 8)

Relevé aux étapes 1 et 2 (lignes de `scripts/outils.js` au 6 novembre) :
- `loups_eliminer` / `loups_nuit` : ne plus dire au narrateur de « demander » à la Braconnière qui elle emporte (elle choisit
  elle-même, demande posthume) ; consigne aux compagnons pour la demande « emporter ».
- `loups_nuit` (l. 1520, 1548-1553, 1559) : pour la Louve, `api.proiesDeLaNuit().proies` ; pour l'invite de l'Herboriste,
  `api.proiesDeLaNuit().aSauver` (sinon l'infecté est nommé à l'Herboriste et l'Enfant surprise ne l'est pas).
- l. 1738 : « Montreur d'ours » → « Montreur de marmotte ».
- `loups_jour` (l. 1980-1986) : ajouter le Sonneur (cloche, vote double) ; l. 1631 : le paramètre `double` renvoie à la cloche.
- l. 1701 : `loups_vote clore` peut porter `departage.auto` (la voix du Bailli a tranché).
- Compagnons : l'Herboriste reçoit une demande à 2 cibles (sauver la victime, empoisonner un autre).

Relevé à l'étape 3a (les rôles du Village ; lignes de `scripts/outils.js` et `scripts/compagnons-jeu.js` au 6 novembre) :
- `loups_eliminer` (outils.js l. 1896-1926) : `eliminer` d'un Innocent condamné rend `[]` (gracié, carte retournée) : dire au narrateur
  de raconter la grâce (`api.pacte().gracies`), pas une mort ; après une exécution, un second vote peut s'être ouvert de lui-même (signe du
  Greffier bègue) : si `api.etat().vote.ouvert`, lui dire « un second vote, sans débat » puis `loups_vote clore` ; un Aïeul exécuté
  annonce la sagesse perdue (le chat le dit déjà).
- `loups_vote` (l. 1620-1734) : à la clôture, `resultat.souffreDouleur` (l'égalité payée : ne pas proposer de revote) et
  `resultat.plume` (les deux voix de la plume noire) ; le lendemain d'une égalité payée, seuls `api.pacte().votants.ids` votent.
- `loups_jour` (l. 1979 et suivantes) : le pouvoir `greffier-begue` (signe secret : ne jamais l'annoncer ni nommer le Greffier ; refus
  `secondVote`, `deja`) et le refus `sagesse` (village sans sagesse : plus de pouvoir de rôle du Village ni de métier).
- `loups_nuit` (l. 1521-1582) : rien d'obligatoire (fratries à `cibles: 0` notées une par une, Furet sans flair sans candidats, Pie
  filtrée par `candidatsDeNuit`) ; une phrase de narration pour le réveil des Lavandières et des Bûcherons serait bienvenue.
- `compagnons-jeu.js` (`sujetDemandeLoups`, l. 364) : la demande posthume `objet: "votants"` (le Souffre-douleur choisit PLUSIEURS
  votants, `nombre` = tous les candidats) tombe aujourd'hui dans « posthume » (une cible) : lui donner son sujet et sa consigne ; la
  demande `objet: "emporter"` (étape 1) attend toujours la sienne.
- Compagnons, la nuit : les Lavandières et les Bûcherons compagnons pourraient se parler dans leur salon « fratrie »
  (`api.audibiliteActeur` rend leurs auditeurs) ; aujourd'hui seule la tanière fait parler les compagnons la nuit.
- Contexte du narrateur et des compagnons : l'état public `api.pacte()` (sagesse perdue, Innocents graciés, liste des votants, plume du
  jour) et le hook public `lakourLoups.pacte` (`{ quoi, acteurId?, ids? }`).

Relevé à l'étape 3b (les ambigus, les solitaires du livre, le Loup pâle ; lignes de `scripts/outils.js` et `scripts/compagnons-jeu.js` au
6 novembre) :
- `loups_nuit` (outils.js l. 1494-1582) : il réveille lui-même chaque étape de `api.ordreDeNuit()` par `api.demanderAction` (sauf la peste
  et le deuil). Pour les étapes `chapardeur`, `bateleur` et `charmes`, et pour toute étape marquée `emprunt: true` (la carte jouée par le
  Bateleur), appeler `api.reveiller(roleCle, { delai })` : le Chapardeur et le Bateleur choisissent une CARTE (candidats `{ id, nom, img }`),
  et la carte empruntée a son propre rôle (invite, effet, cibles, « soi-même »), que `roleLoups(acteur)` (le Bateleur) ne donne pas. Sans
  ce changement, rien ne casse (`candidatsDeNuit` rend [] : le Chapardeur garde sa carte, sauf deux loups au centre où le système en prend
  une au hasard ; le Bateleur ne joue jamais ; les charmés se reconnaissent quand même, `noterAction`), mais ces deux rôles ne servent à
  rien. Le plus simple : `api.reveiller` pour toutes les étapes (il sait la meute, la peste, le deuil, le Messager, la Louve, l'Herboriste).
- `loups_nuit` l. 1574 : la proie du Loup pâle (effet `trahir`) n'entre pas dans `proies` ; l'invite de l'Herboriste doit la nommer
  (`api.proiesDeLaNuit().aSauver`, déjà demandé à l'étape 2, la contient).
- `loups_distribuer` / `loups_rejouer` (l. 1341, 1451) : rendre au narrateur ce que la table voit de la mise en place (`api.ambigus()` :
  les cartes du Bateleur, « la veillée commence par un jour » du Feu follet, les deux bords de l'Illuminé) et, pour lui seul, le centre
  du Chapardeur (`api.ambigusSecrets().centre`) ; avec le Feu follet, lui dire d'ouvrir d'abord le débat et le vote (`loups_vote`), puis
  seulement la nuit. La composition générée garde n rôles et porte `centre: 2` (le paquet en compte n + 2).
- `loups_eliminer` (l. 1896-1926) : après un vote, l'exécution peut attendre la Chambrière (au plus 30 s) ; si
  `api.ambigus().devouements` contient `{ de: condamné }`, dire au narrateur : « la Chambrière s'est dévouée ; ne révèle pas la carte du
  condamné » et ne pas imprimer « Rôle de X » comme une révélation (l. 1922).
- `compagnons-jeu.js` (`sujetDemandeLoups`, l. 364) : trois objets de demande nouveaux — `chapardeur` (deux cartes du centre : prendre
  une carte, ou passer), `bateleur` (une carte face visible à jouer cette nuit, ou passer), `chambriere` (désigner le condamné = se dévouer
  et prendre sa carte, ou passer) ; et la consigne du Mâtin (se désigner = rejoindre la meute). Aujourd'hui elles tombent dans le cas
  général (un candidat au hasard).
- Contexte du narrateur et des compagnons : l'état public `api.ambigus()`, les secrets `api.ambigusSecrets()` (MJ), le hook
  `lakourLoups.pacte` (`quoi: "devouement"`) ; les compagnons charmés lisent leurs charmés dans leur carnet (`Ambigus.Charmes`).

Relevé à l'étape 4 (la variante « Le Village » ; lignes de `scripts/outils.js` et `scripts/compagnons-jeu.js` au 6 novembre) — rien ne casse
sans ces changements (la variante se règle par le monde : réglage « leVillage » ; les demandes ont un délai), mais le MJ IA la mène mal :
- `loups_composer` (outils.js l. 1306-1340) : passer `village` (le réglage « leVillage », ou un paramètre) à `api.logique.composer` ; sinon
  le générateur du MJ IA ne tire jamais l'Incendiaire. `loups_distribuer` / `loups_rejouer` (l. 1341-1490) : un paramètre `village` pour
  `distribuer` / `nouvellePartie`, et, après la distribution, rendre au narrateur `api.village()` (qui tient quel bâtiment, les Chemineaux :
  public, à présenter) ; il peut changer la proposition par `api.installer(cle, acteurId)` avant la première nuit.
- `loups_jour` (l. 1979-2030) : la description cite les pouvoirs des personnalités (Prieur, Remégeux, Régent, Perruquier ; source
  `tenure`, publics) ; `decrire` dit « désigne 2 » pour le Régent, qui en désigne un ou deux (`ciblesMin`) ; après le Perruquier, le
  système a déjà éliminé (cause `rasoir`) et vérifié la victoire : le dire au narrateur ; la carte vue par le Prieur n'est qu'au carnet
  du Prieur, ne jamais la raconter.
- `loups_vote` (l. 1620-1734) : la description de l'objet « bailli » (« tous les vivants candidats ») — dans « Le Village », les Métayers
  vivants seuls, à partir du deuxième jour (les refus `jourDeux` et `metayers` viennent de `api.bailli().election`) ; le Cabaretier n'est
  jamais candidat, son vote est annoncé au chat ; à la clôture, l'immunité perdue est annoncée, et l'exécution attend la supplique au
  Hobereau (deux fenêtres courtes) : le dire au narrateur.
- `loups_eliminer` (l. 1896-1926) : `eliminer` d'un condamné gracié par le Hobereau rend `[]` (vivant, carte cachée, `api.village().graces`) :
  ne pas écrire « meurt » ni « Rôle de X » ; raconter la grâce.
- `loups_nuit` (l. 1494-1582) : rien d'obligatoire (l'Incendiaire désigne un occupant parmi `candidatsDeNuit`) ; au matin, le bâtiment brûlé
  et le loup carbonisé sont dans `annonces` ; ce qu'entrevoit la Fournière est dans `messages` (à remettre comme les autres).
- `compagnons-jeu.js` (`sujetDemandeLoups`, l. 364) : quatre objets de demande nouveaux — `supplique` (le condamné supplie le Hobereau : le
  désigner, ou passer), `grace` (le Hobereau gracie le condamné, ou lui-même), `prevot` (le Prévôt loge un Chemineau), `logement` (le
  Chemineau accepte en se désignant) ; aujourd'hui ils tombent dans le cas général (un candidat au hasard : un compagnon supplie et accepte
  toujours). Les compagnons devraient connaître leur personnalité (`api.personnalite(acteurId)`), et le Cabaretier compagnon que son vote est
  public.
- Contexte du narrateur et des compagnons : l'état public `api.village()` (personnalités, Chemineaux, bâtiments brûlés, privés de vote du
  Régent, graciés du Hobereau) et le hook public `lakourLoups.village` (`{ quoi, acteurId?, ids?, cle? }`).

Relevé à l'étape 5 (le mode « Le Pacte », les variantes, l'ordre d'appel ; lignes de `scripts/outils.js` et `scripts/compagnons-jeu.js` au
6 novembre) — rien ne casse sans ces changements (les variantes se règlent par le monde ; les demandes nouvelles ont un délai, avec le sort
ou « passer » en repli), mais le MJ IA les mène mal :
- `loups_composer` (outils.js l. 1306-1340) : accepter le niveau `le-pacte` (le générateur du système le connaît : `api.contenu().niveaux`) et
  passer `loupsEnPlus: 1` aux Vendanges ; `loups_distribuer` / `loups_rejouer` (l. 1341-1490) : un paramètre `variantes` pour `distribuer` /
  `nouvellePartie` (sinon les réglages monde décident, ce qui suffit), et rendre au narrateur `résumé.variantes` (publiques, à annoncer) ;
  Double visage : laisser `nouvellePartie` faire la composition (ne pas passer de `roles`).
- `loups_nuit` (l. 1494-1582) : passer par `api.reveiller(roleCle)` pour les étapes nouvelles — « mur » (tous les vivants écrivent ; ne
  JAMAIS noter ces phrases avec `noterAction` ni les garder avec leur auteur), « tromperie » (deux cibles : un des deux amants et un autre
  joueur ; invite `Variantes.Vendanges.InviteTromperie`), les étapes `seconde: true` (la seconde carte de Double visage : `roleLoups` ne la
  connaît pas) et le Chapardeur des Vendanges (candidats : des joueurs, `candidatsDeNuit`) ; à la meute, garder `demanderActionMeute` (la
  Veillée aux chandelles angoissante y compte les chandelles : ne pas recompter à la majorité). Les candidats des Vendanges (meute, Garde)
  viennent déjà de `candidatsDeNuit`.
- `loups_vote` (l. 1620-1734) : avec la Chaîne des innocents (`api.etat().vote.chaine`), `ouvrirVote` lance la chaîne et `cloreVote` l'attend :
  ne pas faire voter, ne pas proposer de revote ; dire au narrateur de raconter chaque innocent qui s'assied (chat) ; aux Vendanges, le
  Bailli vote d'abord (`vote.bailliDabord`, son vote annoncé) : laisser au minuteur le temps de son délai.
- `loups_eliminer` (l. 1896-1926) : `eliminer` peut rendre plusieurs morts (le triangle des Vendanges, la chute des envoûtés) : les raconter
  toutes ; la chandelle qui s'éteint est déjà au chat.
- `compagnons-jeu.js` (`sujetDemandeLoups`, l. 364) : deux demandes nouvelles — `objet: "chaine"` (désigner un debout dont on garantit
  l'innocence ; un loup peut blanchir un loup) et le mode « texte » du mur (une courte phrase anonyme, sans se nommer, autre chose que le mot
  du Messager : l'invite `Variantes.Mur.Invite` les distingue) ; un compagnon envoûté (sa fiche : rôle sans effet) ne doit plus se croire
  armé ; aux Vendanges, un compagnon amoureux ne reçoit plus son amant dans ses candidats de vote (le système filtre déjà).
- Contexte du narrateur et des compagnons : l'état public `api.etat().variantes` (les variantes en jeu, la chaîne du vote ouvert, le mur du
  matin, les chandelles d'une meute en désaccord) et le hook public `lakourLoups.variante` (`{ quoi, tour?, ids?, acteurId? }`) ; les secrets
  `variantesSecret` (envoûtés, triangle, cartes de Double visage) sont au MJ : ne jamais les raconter.
- L'ordre de réveil a changé : les consignes du narrateur qui citent un ordre (la Liseuse en fin de nuit, la Pie après la chasse, l'Enfant
  de la brume avant la meute) sont à revoir ; `api.ordreDeNuit()` reste la référence.

Relevé à l'étape 9 (la Gazette de la lune, les traits, le Crieur public, l'Exécuteur, la Liseuse d'étoiles ; `scripts/outils.js` et
`scripts/compagnons-jeu.js` au 6 novembre) — rien ne casse sans ces changements (la Gazette se règle par le monde ; toute demande nouvelle a un
délai, avec le sort ou « passer » en repli), mais le MJ IA la mène mal :
- `loups_distribuer` / `loups_rejouer` (l. 1341-1490) : un paramètre `gazette` (`{ actif, crieur, rythme, choix, permanentes, cartesDuCrieur }`)
  pour `distribuer` / `nouvellePartie` ; rendre au narrateur les traits visibles (`api.traits()` : publics, à décrire), et l'annonce de la Gazette
  et du Crieur (au chat).
- Après `resoudreNuit` (`loups_nuit`, l. 1494-1582) : attendre `api.attendreGazette()` avant d'ouvrir le débat (la séance de Spiritisme et
  l'annonce du Crieur sont des demandes) ; la carte du matin est dans `api.gazette().tirees` (déjà au chat : la raconter, pas la relire). Un
  matin peut avoir ouvert un vote de lui-même (le Cauchemar, le Châtiment, l'élection de l'Exécuteur) : si `api.etat().vote.ouvert`, ne pas
  changer de phase (`changerPhase("jour")` le fermerait), le laisser aller à son terme.
- `loups_nuit` : passer par `api.reveiller(roleCle)` pour les étapes nouvelles — `toucher` (le geste de la meute), `crue` (la seconde proie),
  `spectre` (la proie désigne un ancien loup), `benet` (le premier mort, posthume), `sots-voyance` (chaque loup lit un rôle) — et pour la meute
  d'une Nuit des sots (la Braconnière, l'Herboriste et la Liseuse de cendres : `api.reveiller("meute")` les trouve ; ne pas filtrer par camp) ;
  la Liseuse d'étoiles se désigne pour dire oui (`candidatsDeNuit` ne propose qu'elle).
- `loups_vote` (l. 1620-1734) : la Crue refuse le vote (`Gazette.Refus.inondation`) : aller à la nuit ; les objets `executeur` et `chatiment`
  (sans changer de phase) ; `vote.mode` : « defiance » (deux voix par votant : `recevoirVote` deux fois, un second vote pour le même ami le
  retire), « suite » (à tour de rôle : seul `vote.ordre[vote.rang]` peut voter ; le système appelle chacun, ne pas clore avant le dernier) ;
  `resultat.cauchemar`, `resultat.mode`, `resultat.soutiens` ; le Jour des sots refuse à un amoureux tout vote contre un autre que son amant.
- `loups_eliminer` (l. 1896-1926) : `eliminer` d'un condamné peut rendre `[]` (Pile ou face : pile ; Marché avec le Malin accepté) ; avec un
  Exécuteur, la carte du condamné n'est pas retournée (ne pas écrire « Rôle de X ») ; après l'élimination, un second vote peut s'être ouvert (le
  Dépit, l'Enthousiasme) : « un second vote, sans débat ».
- Le narrateur : `api.priverDeVote(acteurId)` sous une carte de conduite (Lune noire, Bonnes manières, Ni loup ni moi) ; `api.releverLaParole(
  acteurId, texte)` pour ce qui est dit à voix haute (transcriptions des salons vocaux) sous Ni loup ni moi ; `api.lireUneCarte(cle)` (mode
  « le narrateur choisit ») ; `api.appliquerLaVarianteDuJour()` (Dimanche de soleil, Fin des vendanges, Lundi gris) ; `api.nommerCrieur`,
  `api.cartesDuCrieur` ; un outil `loups_gazette` (lire, priver, appliquer, nommer) serait le plus simple.
- `compagnons-jeu.js` (`sujetDemandeLoups`, l. 364) : des objets de demande nouveaux — `marche` (se désigner = accepter le marché), `appel`
  (se désigner = appeler au secours), `chatiment` et `influences` (posthumes : un vivant), `executeur` (posthume : un successeur),
  `crieur-nommer`, `crieur-transmettre`, `crieur-garder` (le Bailli), `crieur-annonce` (des CARTES : `{ id: clé, nom }`, ou passer),
  `seance-question` (des questions), `seance-spirite`, `seance-designer` (1 ou 2 joueurs), `spectre`, `benet` (posthume), `toucher` et
  `crue` (la meute) ; une demande de vote avec `mode: "defiance"` (`nombre: 2`, jamais soi) ou `mode: "suite"` (son tour). Aujourd'hui elles
  tombent dans le cas général (un candidat au hasard : un compagnon accepte toujours le marché, lit toujours une carte).
- Contexte du narrateur et des compagnons : les traits (`api.traits()`), les cartes en jeu et le Crieur (`api.gazette()`), le hook public
  `lakourLoups.gazette` (`{ quoi, cle?, acteurId?, ids?, source? }`) ; pour le Crieur compagnon seul, sa main (`api.gazetteSecrets().main`) ;
  l'allié du Méchant Benêt et ce qu'a lu l'Exécuteur sont au carnet de leur compagnon. Ne jamais raconter les secrets de la Gazette (paquet,
  main, alliés, pouvoirs échangés).
