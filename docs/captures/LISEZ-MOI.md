# Captures d'écran du README

Le README (`README.md`, `README.en.md`) et les manifestes (`media`) attendent ces fichiers PNG, à déposer ici. Tant qu'ils
manquent, les images du README sont cassées et les captures du catalogue Foundry aussi (la couverture, elle, existe déjà :
`modules/lakour-veillees/assets/monde/fond.jpg`).

Conseils communs : Foundry en français, fenêtre d'environ 1600 × 900 (ou plus, le README réduit), interface sombre par
défaut, **aucun vrai nom de joueur** (comptes « Mathurin », « Ysaline »… tirés de la table des noms), **aucune clé d'API
visible**, aucune adresse de serveur dans la barre d'adresse (recadrer). Une partie à 8 ou 10 joueurs rend mieux qu'à 6.

| Fichier | Contenu | Comment l'obtenir |
|---|---|---|
| `village.png` | La carte du village de nuit, les jetons neutres devant les maisons, la brume, le bandeau en bas. | Partie distribuée, phase **nuit** (Table de jeu › Nuit). Cadrer toute la carte (zoom arrière à la molette), replier la barre latérale ou la garder pour le chat. |
| `table-de-jeu.png` | La Table de jeu pendant un **débat** : phase jour, minuteur, villageois vivants et morts, métiers, bâtiments en jeu, boutons des pouvoirs de jour, Registre du greffier. | Depuis le compte d'un **joueur** (pas le MJ : la vue du MJ montre la composition). Phase jour, après une première mort. Capturer la seule fenêtre. |
| `vote.png` | Le **vote au clic** sur la carte : les jetons en cercle sur la place, les halos des candidats, la coche « a voté », puis les bulles du dépouillement. | Phase vote, depuis un compte de joueur ; une seconde capture juste après la clôture si les bulles rendent mieux. |
| `carte-de-role.png` | La **carte de rôle** reçue en secret (fenêtre de la carte, avec le jeton du rôle, le pouvoir, le camp). | Juste après la distribution, chez un joueur ; choisir un rôle parlant (Veilleuse de lanterne, Herboriste). Ne pas montrer d'autre fenêtre. |
| `carnet-secret.png` | Le **carnet secret** d'un joueur avec deux ou trois entrées (carte de rôle, ce qu'il a appris la nuit, un mot du Messager). | Table de jeu › Carnet secret, chez un joueur de vision (Liseuse de cendres), après deux nuits. |
| `choix-de-nuit.png` | La **fenêtre de choix de nuit** (invite, liste des maisons, « Passer »), avec derrière elle les maisons allumées sur la carte. | Pendant la nuit, chez le joueur réveillé. |
| `chroniques.png` | Les **Chroniques de Brumecombe** : le palmarès puis le récit d'une veillée finie, rôles dévoilés. | Après une victoire : journal « Chroniques de Brumecombe » (barre latérale › Journaux). |
| `preparatifs.png` | La Table de jeu en **préparation** chez le MJ : nombre de joueurs, niveau, variantes, bâtiments, bouton Distribuer. | Avant la distribution, compte MJ ; vérifier qu'aucune composition n'est affichée si elle doit rester secrète. |
| `mj-ia.png` | Le **MJ IA** en séance : le chat avec le récit de l'aube par le narrateur, une réplique de compagnon IA, la console du MJ IA (sans clé). | Séance démarrée avec le fournisseur factice (aucun coût) ou une vraie clé ; masquer le champ de clé. |
| `fete.png` | Un **journal de veillée de fête** (illustration en tête, la fête à Brumecombe, les règles). | Journaux › « Les Veillées de Brumecombe — Nuit des âmes » (ou une autre fête), première page. |

Format : PNG, 1200 à 1920 px de large, moins de 1 Mo chacun si possible (`pngquant` ou l'export de l'outil de capture).
Les trois premières (`village`, `table-de-jeu`, `vote`) et `carte-de-role` servent aussi dans les manifestes
(`system.json`, `module.json`, champ `media`) : les garder sous ces noms exacts.

## Captures du tutoriel

Les tutoriels (`TUTORIEL.md`, `TUTORIAL.md`) reprennent `preparatifs.png`, `choix-de-nuit.png`, `vote.png` et `mj-ia.png`
(tableau ci-dessus) et attendent en plus ces trois fichiers. Les deux tutoriels partagent les mêmes images (interface en
français ; le tutoriel anglais le signale).

> Pas de capture de l'installation du monde par manifeste : Foundry 14 n'a plus de bouton « Installer un monde » (le monde
> vierge se distribue en archive à décompresser dans `Data/worlds/`). Pas de capture des comptes et mots de passe non plus.

| Fichier | Contenu | Comment l'obtenir |
|---|---|---|
| `tuto-manifeste.png` | L'écran de configuration de Foundry, fenêtre **Installer un système**, l'adresse du manifeste `…/releases/latest/download/system.json` collée dans le champ « URL du manifeste ». | Écran de configuration (hors monde), onglet Systèmes de jeu › Installer un système. Recadrer sur la fenêtre ; aucune adresse de serveur, aucune licence visible. |
| `tuto-coffre.png` | La fenêtre **Coffre du MJ IA** : la mention « Monde à rôles secrets : aucune part… », la date de la clé de secours, les boutons **Télécharger la clé de secours** et **Réimporter une clé de secours**. | Compte MJ, Réglages du jeu › Configurer les réglages › MJ IA › Coffre. Ne pas montrer le fichier téléchargé ni son contenu. |
| `tuto-voix.png` | La section **Voix** de la Table de jeu chez le MJ : **Activer l'audio**, **Donner le micro aux joueurs**, la liste « Sans droit de micro » si elle s'affiche. | Compte MJ, Table de jeu en préparatifs, avant d'activer l'audio (puis une seconde capture après, si elle rend mieux). |
