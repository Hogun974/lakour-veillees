# Crédits — Les Veillées de Brumecombe

Jeu original de déduction sociale, de la famille des jeux de « loup-garou » nés du jeu traditionnel *Mafia*, pour un
usage non commercial. Tous les textes de ce module (rôles, métiers, bâtiments, guides, variantes, tables) et la
carte du village de Brumecombe sont originaux. Aucun texte, aucune carte ni aucune illustration d'un jeu édité n'est
reproduit.

## Carte du village

La carte (`assets/cartes/`) est dessinée par programme : rendu commun des cartes La Kour
(`lakour-mj-ia/scripts/cartes-rendu.js`) et décor propre au village (`contenu/village.mjs`). Aucune image extérieure.

## Illustrations

L'illustration de l'écran d'accueil (`assets/monde/`) et celles des veillées de fête (`assets/fetes/<fête>.jpg` : halloween, noel,
carnaval, saint-valentin) ont été générées localement avec ComfyStudio (FLUX.2 klein 9B), sans service distant, pour l'usage
privé de la table. De même pour l'image qui remplace la caméra d'un joueur quand le jeu la coupe (`assets/camera/loup-garou.webp` :
un loup hurlant devant la lune, dans un médaillon de fer forgé) ; son repli `assets/camera/loup-garou.svg` est dessiné à la main,
sans image extérieure.

## Icônes des jetons

Les silhouettes des jetons (`assets/jetons/`) sont des icônes de **[game-icons.net](https://game-icons.net)**,
publiées sous licence **Creative Commons Attribution 3.0 (CC BY 3.0)** :
<https://creativecommons.org/licenses/by/3.0/>. Source : <https://github.com/game-icons/icons>.

Icons made by Caro Asercion, Cathelineau, DarkZaitzev, Delapouite, Lorc, Skoll, from game-icons.net (CC BY 3.0).

Modifications : tracés recolorés et composés dans un médaillon (anneau de couleur selon le camp du rôle — rouge pour
la Meute, vert pour le Village, violet pour les solitaires, gris de pierre pour le jeton neutre qui cache le rôle —,
bronze pour les métiers, ardoise pour les bâtiments, ambre pour les figurants ; fond en dégradé, ombre, version en
relief). Fichiers produits par `outils/fabriquer-jetons-veillees.mjs` ; les correspondances sont dans
`contenu/jetons.mjs`.

| Icône | Auteur | Utilisée pour |
|---|---|---|
| [hyena-head](https://game-icons.net/1x1/caro-asercion/hyena-head.html) | Caro Asercion | Rôle — Loup pâle |
| [spinning-wheel](https://game-icons.net/1x1/caro-asercion/spinning-wheel.html) | Caro Asercion | Métier — Tisserande |
| [nun-face](https://game-icons.net/1x1/cathelineau/nun-face.html) | Cathelineau | Figurant — Religieuse |
| [big-gear](https://game-icons.net/1x1/darkzaitzev/big-gear.html) | DarkZaitzev | Rôle — Joueur de vielle |
| [hooded-figure](https://game-icons.net/1x1/darkzaitzev/hooded-figure.html) | DarkZaitzev | Figurant — Silhouette dans la brume |
| [animal-hide](https://game-icons.net/1x1/delapouite/animal-hide.html) | Delapouite | Rôle — Montreur de marmotte ; Métier — Tanneur |
| [baby-face](https://game-icons.net/1x1/delapouite/baby-face.html) | Delapouite | Rôle — Innocent ; Figurant — Enfant |
| [bandit](https://game-icons.net/1x1/delapouite/bandit.html) | Delapouite | Rôle — Chapardeur |
| [barn](https://game-icons.net/1x1/delapouite/barn.html) | Delapouite | Bâtiment — La Grange |
| [bow-arrow](https://game-icons.net/1x1/delapouite/bow-arrow.html) | Delapouite | Métier — Chasseresse |
| [broom](https://game-icons.net/1x1/delapouite/broom.html) | Delapouite | Métier — Ramoneuse ; Figurant — Lavandière |
| [carnival-mask](https://game-icons.net/1x1/delapouite/carnival-mask.html) | Delapouite | Rôle — Bateleur |
| [church](https://game-icons.net/1x1/delapouite/church.html) | Delapouite | Bâtiment — La Chapelle |
| [dwarf-face](https://game-icons.net/1x1/delapouite/dwarf-face.html) | Delapouite | Rôle — Aïeul |
| [empty-wood-bucket](https://game-icons.net/1x1/delapouite/empty-wood-bucket.html) | Delapouite | Rôle — Lavandière ; Bâtiment — Le Lavoir |
| [falcon-moon](https://game-icons.net/1x1/delapouite/falcon-moon.html) | Delapouite | Rôle — Gardeuse d'oies |
| [farmer](https://game-icons.net/1x1/delapouite/farmer.html) | Delapouite | Rôle — Franc-Villageois ; Figurant — Paysan |
| [flour](https://game-icons.net/1x1/delapouite/flour.html) | Delapouite | Métier — Meunière |
| [fog](https://game-icons.net/1x1/delapouite/fog.html) | Delapouite | Rôle — Enfant de la brume |
| [graveyard](https://game-icons.net/1x1/delapouite/graveyard.html) | Delapouite | Bâtiment — Le Cimetière |
| [herbs-bundle](https://game-icons.net/1x1/delapouite/herbs-bundle.html) | Delapouite | Rôle — Herboriste |
| [jewel-crown](https://game-icons.net/1x1/delapouite/jewel-crown.html) | Delapouite | Rôle — Rosière |
| [miner](https://game-icons.net/1x1/delapouite/miner.html) | Delapouite | Rôle — Bûcheron |
| [pilgrim-hat](https://game-icons.net/1x1/delapouite/pilgrim-hat.html) | Delapouite | Rôle — Pèlerine |
| [rat](https://game-icons.net/1x1/delapouite/rat.html) | Delapouite | Rôle — Furet |
| [sitting-dog](https://game-icons.net/1x1/delapouite/sitting-dog.html) | Delapouite | Rôle — Mâtin ; Figurant — Chien de ferme |
| [sniffing-dog](https://game-icons.net/1x1/delapouite/sniffing-dog.html) | Delapouite | Rôle — Loup flaireur |
| [stone-bridge](https://game-icons.net/1x1/delapouite/stone-bridge.html) | Delapouite | Rôle — Garde du pont ; Bâtiment — Le Pont |
| [target-poster](https://game-icons.net/1x1/delapouite/target-poster.html) | Delapouite | Rôle — Chasseur de primes |
| [tavern-sign](https://game-icons.net/1x1/delapouite/tavern-sign.html) | Delapouite | Bâtiment — La Taverne |
| [teacher](https://game-icons.net/1x1/delapouite/teacher.html) | Delapouite | Métier — Maîtresse d'école |
| [torch](https://game-icons.net/1x1/delapouite/torch.html) | Delapouite | Rôle — Pyromane |
| [well](https://game-icons.net/1x1/delapouite/well.html) | Delapouite | Bâtiment — Le Puits |
| [windmill](https://game-icons.net/1x1/delapouite/windmill.html) | Delapouite | Bâtiment — Le Moulin |
| [wood-canoe](https://game-icons.net/1x1/delapouite/wood-canoe.html) | Delapouite | Métier — Passeur |
| [anchor](https://game-icons.net/1x1/lorc/anchor.html) | Lorc | Métier — Éclusière |
| [anvil](https://game-icons.net/1x1/lorc/anvil.html) | Lorc | Métier — Forgeron |
| [anvil-impact](https://game-icons.net/1x1/lorc/anvil-impact.html) | Lorc | Bâtiment — La Forge |
| [beer-stein](https://game-icons.net/1x1/lorc/beer-stein.html) | Lorc | Métier — Aubergiste |
| [bestial-fangs](https://game-icons.net/1x1/lorc/bestial-fangs.html) | Lorc | Rôle — Loup affamé |
| [burning-meteor](https://game-icons.net/1x1/lorc/burning-meteor.html) | Lorc | Rôle — Feu follet |
| [candle-light](https://game-icons.net/1x1/lorc/candle-light.html) | Lorc | Rôle — Somnambule |
| [cat](https://game-icons.net/1x1/lorc/cat.html) | Lorc | Figurant — Chat |
| [circular-sawblade](https://game-icons.net/1x1/lorc/circular-sawblade.html) | Lorc | Rôle — Rémouleur |
| [cowled](https://game-icons.net/1x1/lorc/cowled.html) | Lorc | Villageois (rôle caché) |
| [crystal-ball](https://game-icons.net/1x1/lorc/crystal-ball.html) | Lorc | Rôle — Liseuse de cendres ; Rôle — Liseuse d'étoiles |
| [cultist](https://game-icons.net/1x1/lorc/cultist.html) | Lorc | Rôle — Illuminé |
| [cupidon-arrow](https://game-icons.net/1x1/lorc/cupidon-arrow.html) | Lorc | Rôle — Entremetteuse |
| [domino-mask](https://game-icons.net/1x1/lorc/domino-mask.html) | Lorc | Rôle — Loup déguisé |
| [droplets](https://game-icons.net/1x1/lorc/droplets.html) | Lorc | Rôle — Sourcier |
| [envelope](https://game-icons.net/1x1/lorc/envelope.html) | Lorc | Rôle — Messager |
| [fire-silhouette](https://game-icons.net/1x1/lorc/fire-silhouette.html) | Lorc | Rôle — Incendiaire |
| [gavel](https://game-icons.net/1x1/lorc/gavel.html) | Lorc | Rôle — Juge de paix |
| [ghost](https://game-icons.net/1x1/lorc/ghost.html) | Lorc | Rôle — Revenant |
| [gibbet](https://game-icons.net/1x1/lorc/gibbet.html) | Lorc | Bâtiment — Le Gibet |
| [halberd](https://game-icons.net/1x1/lorc/halberd.html) | Lorc | Métier — Garde du guet |
| [harpoon-trident](https://game-icons.net/1x1/lorc/harpoon-trident.html) | Lorc | Rôle — Pêcheur de nuit |
| [hood](https://game-icons.net/1x1/lorc/hood.html) | Lorc | Rôle — Ermite |
| [hound](https://game-icons.net/1x1/lorc/hound.html) | Lorc | Rôle — Louvetier |
| [imp](https://game-icons.net/1x1/lorc/imp.html) | Lorc | Rôle — Enfant des bois |
| [lantern-flame](https://game-icons.net/1x1/lorc/lantern-flame.html) | Lorc | Rôle — Veilleuse de lanterne |
| [open-book](https://game-icons.net/1x1/lorc/open-book.html) | Lorc | Rôle — Conteuse |
| [paw-heart](https://game-icons.net/1x1/lorc/paw-heart.html) | Lorc | Rôle — Louve mère |
| [prayer](https://game-icons.net/1x1/lorc/prayer.html) | Lorc | Métier — Curé |
| [quill-ink](https://game-icons.net/1x1/lorc/quill-ink.html) | Lorc | Rôle — Greffier bègue |
| [raven](https://game-icons.net/1x1/lorc/raven.html) | Lorc | Rôle — Pie ; Figurant — Corbeau |
| [ringing-bell](https://game-icons.net/1x1/lorc/ringing-bell.html) | Lorc | Rôle — Sonneur |
| [robe](https://game-icons.net/1x1/lorc/robe.html) | Lorc | Rôle — Chambrière |
| [scroll-unfurled](https://game-icons.net/1x1/lorc/scroll-unfurled.html) | Lorc | Métier — Colporteur de nouvelles |
| [skeleton-key](https://game-icons.net/1x1/lorc/skeleton-key.html) | Lorc | Rôle — Gardienne des clés |
| [spectre](https://game-icons.net/1x1/lorc/spectre.html) | Lorc | Rôle — Dame du gué |
| [swap-bag](https://game-icons.net/1x1/lorc/swap-bag.html) | Lorc | Rôle — Colporteur |
| [visored-helm](https://game-icons.net/1x1/lorc/visored-helm.html) | Lorc | Rôle — Vieux Sergent |
| [werewolf](https://game-icons.net/1x1/lorc/werewolf.html) | Lorc | Rôle — Loup des roseaux |
| [wolf-head](https://game-icons.net/1x1/lorc/wolf-head.html) | Lorc | Rôle — Loup de Brumecombe |
| [wolf-howl](https://game-icons.net/1x1/lorc/wolf-howl.html) | Lorc | Rôle — Loup hurleur |
| [wolf-trap](https://game-icons.net/1x1/lorc/wolf-trap.html) | Lorc | Rôle — Braconnière |
| [goat](https://game-icons.net/1x1/skoll/goat.html) | Skoll | Rôle — Souffre-douleur |
| [hasty-grave](https://game-icons.net/1x1/skoll/hasty-grave.html) | Skoll | Rôle — Fossoyeur |
| [pestle-mortar](https://game-icons.net/1x1/skoll/pestle-mortar.html) | Skoll | Métier — Apothicaire |

## Licence

Les textes et les images originaux de ce module sont sous licence **CC BY-NC-SA 4.0**
(<https://creativecommons.org/licenses/by-nc-sa/4.0/>), attribution « LaKour — Hogun974 » ; son code (scripts, gabarits,
styles, `lang/`) est sous licence **MIT**. Le détail et les mentions des tiers sont dans `LICENCE-CONTENU.md` et
`LICENSE`, livrés dans l'archive avec ce fichier. Les icônes de game-icons.net créditées ci-dessus restent sous CC BY 3.0.
Foundry VTT est une marque de Foundry Gaming, LLC ; ce module n'y est pas affilié.
