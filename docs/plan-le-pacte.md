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

Les 36 cartes Événement de nouvelle lune et les cartes Spiritisme attendent les photos de Jordan : leurs effets seront repris à
l'identique avec nos propres textes. Le cadre (tirage, effets immédiats / différés / permanents) se construit avant.

## Les noms (français / anglais)

Colonne « livre » : la fonction du personnage, pour s'y retrouver ; jamais affichée en jeu.

### Loups
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| loup-garou simple | Loup de Brumecombe | Wolf of Brumecombe | `loup-de-brumecombe` | existe |
| grand méchant loup | Loup affamé | Ravenous Wolf | `loup-affame` | aligné (étape 2 : chaque nuit tant qu'aucun loup n'est mort) |
| infect père des loups | Louve mère | Wolf Mother | `louve-mere` | aligné (étape 2 : infection, la garde ne l'arrête pas) |
| loup-garou blanc | Loup pâle | Pale Wolf | `loup-pale` | nouveau |

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
| pyromane (incendie un bâtiment) | Incendiaire | Firebrand | `incendiaire` | nouveau |

### Ambigus
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| voleur | Chapardeur | Pilferer | `chapardeur` | nouveau |
| comédien | Bateleur | Mountebank | `bateleur` | nouveau |
| chien-loup | Mâtin | Mastiff | `matin` | nouveau |
| enfant sauvage | Enfant des bois | Woods Child | `enfant-des-bois` | nouveau |
| servante dévouée | Chambrière | Chambermaid | `chambriere` | nouveau |

### Solitaires
| Livre | Chez nous | English | Clé | État |
|---|---|---|---|---|
| ange | Feu follet | Will-o'-the-Wisp | `feu-follet` | nouveau |
| joueur de flûte | Joueur de vielle | Hurdy-Gurdy Player | `joueur-de-vielle` | nouveau |
| abominable sectaire | Illuminé | Zealot | `illumine` | nouveau |

### Charges et médium
| Livre | Chez nous | English | État |
|---|---|---|---|
| capitaine | Bailli (charge élue) | Bailiff | aligné (étape 2 : sa voix tranche l'égalité d'office) ; reste : parmi les métayers avec les bâtiments (étape 4) |
| garde champêtre | Crieur public | Town Crier | nouveau |
| gitane (sans philtre) | Liseuse d'étoiles | Stargazer | nouveau (cartes Spiritisme : photos) |

### Personnalités du village (bâtiments tenus par un joueur)
| Livre | Personnage / bâtiment | English | État |
|---|---|---|---|
| fermiers (6 fermes) | Métayers / les métairies | Tenant Farmers / farmsteads | nouveau |
| confesseur / église | Prieur / le prieuré | Prior / priory | nouveau |
| rebouteux / masure | Remégeux / la masure | Bonesetter / hovel | nouveau |
| institutrice / école | Régent / l'école | Schoolmaster / school | nouveau |
| boulanger / boulangerie | Fournière / le fournil | Oven-Keeper / bakehouse | nouveau |
| barbier / échoppe | Perruquier / l'échoppe | Wigmaker / shop | nouveau |
| tavernier / taverne | Cabaretier / le cabaret | Alehouse Keeper / alehouse | nouveau |
| bailli / sa maison | Prévôt / la prévôté | Provost / provostry | nouveau |
| châtelain / manoir | Hobereau / le manoir | Squire / manor | nouveau |
| vagabonds | Chemineaux | Drifters | nouveau |

### Variantes du livre
| Livre | Chez nous | English | État |
|---|---|---|---|
| clair de lune | Veillée aux chandelles | Candlelight | nouveau |
| communauté des hameaux | Les Hameaux | The Hamlets | nouveau |
| « c'est sûrement pas lui » | La Chaîne des innocents | Chain of Innocents | nouveau |
| murs-murs | Le Mur des murmures | Whispering Wall | nouveau |
| double « je » (petite / grande complication) | Double visage | Two Faces | nouveau |
| fête de la moisson | Les Vendanges | Grape Harvest | nouveau |
| peste noire | Peste noire | Black Plague | vérifié (étape 2 : identique ; guide : l'appel comme d'habitude) |
| fascination lycanthropique | L'Envoûtement | The Thrall | nouveau |
| nouvelle lune (36 événements) | La Gazette de la lune | Moon Gazette | cadre maintenant, cartes après les photos |

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
| 3 | Nouveaux rôles : villageois, puis ambigus, puis solitaires, puis Loup pâle | 3a fait (les onze rôles du Village, `logique/pacte.mjs`, poids provisoires, hors compositions prêtes et petite tablée) ; reste 3b ambigus, 3c solitaires, 3d Loup pâle ; reste au moteur MJ IA (étape 8) : voir plus bas |
| 4 | Personnalités du village, Chemineaux, Incendiaire ; Crieur public, Liseuse d'étoiles (la Pie est faite à l'étape 3a ; son filtre exclura le Chemineau) | à faire |
| 5 | Variantes du livre ; mode « Le Pacte » (composition fidèle au livre) ; ordre d'appel du livre | à faire |
| 6 | Simulateur (`essais/outils/simuler-veillees.mjs`), politiques par effet pour les joueurs simulés et les compagnons, calibration des poids par régression, cibles par taille ; compositions prêtes passées au générateur | à faire |
| 7 | Anglais (dictionnaires, guides retraduits), jetons, carte (repères des bâtiments), guides du joueur et du narrateur | à faire |
| 8 | Publication (système, module, moteur si les compagnons changent), déploiement LaKour, essai en vrai | à faire |
| 9 | Cartes Événement et Spiritisme : mécaniques consignées dans `gazette-de-la-lune.md` (photos reçues le 6 nov.) ; traits visibles des personnages | à faire après l'étape 4 |
| 10 | Webcam (après les rôles) : réglage MJ « caméras permises » dans le moteur commun (tous les modules) ; aux Veillées, image de remplacement quand il le faut (nuit, morts, comme la coupure du micro de `salons.mjs` / `activite.mjs`) : logo de loup-garou fait sur ComfyStudio | à faire |
| 11 | Musiques ComfyStudio pour les modules et mondes (version interne) | après le reste |

Chaque étape : essais verts (`npm run essais`), fabrication fr et en, un commit par étape.

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
