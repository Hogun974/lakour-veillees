# Licence du contenu — Les Veillées de Brumecombe

*English summary at the end.*

Ce dépôt réunit du **code** et du **contenu de jeu**, sous deux licences :

| Quoi | Licence |
|---|---|
| Le code : système `lakour-loups`, scripts, outils, essais, gabarits, styles, traductions de l'interface | **MIT** : voir [`LICENSE`](LICENSE) |
| Les textes et les images originaux écrits ou produits pour LaKour | **CC BY-NC-SA 4.0** : ce fichier |
| Ce qui vient de tiers (icônes des jetons) | **sa licence d'origine** : voir plus bas |

Titulaire des droits sur le code et le contenu original : **Hogun974**, 2026.

## Sous CC BY-NC-SA 4.0 : les textes et les images

Licence Creative Commons **Attribution – Pas d'utilisation commerciale – Partage dans les mêmes conditions 4.0
International** : <https://creativecommons.org/licenses/by-nc-sa/4.0/> (résumé en français :
<https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr> ; texte juridique :
<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.fr>).

Sont sous cette licence :

- `modules/lakour-veillees/contenu/` : les textes et les données de jeu (rôles, métiers, bâtiments, village, guides du
  joueur et du narrateur, variantes, compositions, équilibre, tables, fêtes, livre d'univers, figurants…), y compris les
  dictionnaires anglais de `contenu/en/` ;
- `modules/lakour-veillees/src/` et `modules/lakour-veillees/packs/` : les compendiums engendrés de `contenu/` ;
- `modules/lakour-veillees-en/` (module anglais engendré, non versionné) : le même contenu, traduit ;
- `monde/` : les sources du monde vierge (journaux, scène du village, dossiers, réglages, titre et description de
  `world.json` et `world.en.json`) ;
- les images produites pour le projet : `modules/lakour-veillees/assets/monde/` (écran d'accueil), `assets/fetes/`
  (veillées de fête), `assets/cartes/` (carte du village, dessinée par programme) et la mise en forme des jetons de
  `assets/jetons/` (médaillons, couleurs, relief ; les silhouettes restent sous CC BY 3.0, voir plus bas), ainsi que les
  données de `assets/` (`compositions.json`, `equilibre.json`, figurants, plans).

Quand un même fichier mêle code et texte (les `.mjs` de `contenu/`), les textes, noms et données de jeu qu'il contient
sont sous CC BY-NC-SA 4.0 et le code JavaScript qui les assemble sous MIT.

### Attribution attendue

Créditer **« LaKour — Hogun974 »**, avec le lien vers le dépôt (<https://github.com/Hogun974/lakour-veillees>), le nom
et le lien de la licence, et l'indication des modifications. Par exemple :

> D'après *Les Veillées de Brumecombe*, LaKour — Hogun974 (https://github.com/Hogun974/lakour-veillees), licence
> CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/). Modifié.

Pas d'utilisation commerciale ; une adaptation se partage sous la même licence.

## Sous MIT : le code

`systems/lakour-loups/` (tout le système : logique, scripts, gabarits, styles, traductions de l'interface `lang/`,
`system.json`), `modules/lakour-veillees/scripts/`, `templates/`, `lang/`, `module.json`, `outils/`, `essais/`, `docs/`
(documentation du code), `.github/`, `package.json`.

## Sous licence tierce

| Quoi | Où | Licence | Mention |
|---|---|---|---|
| Silhouettes des jetons : icônes de [game-icons.net](https://game-icons.net) | `modules/lakour-veillees/assets/jetons/` | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | auteurs icône par icône dans `modules/lakour-veillees/CREDITS.md` |

Les illustrations (`assets/monde/`, `assets/fetes/`) ont été générées localement avec le modèle d'IA FLUX.2 klein 9B,
publié sous licence non commerciale : elles sont partagées sous CC BY-NC-SA 4.0 dans la mesure où le projet détient des
droits sur elles, et leur usage reste aussi soumis aux conditions de ce modèle. Les sons d'ambiance viennent du moteur
`modules/lakour-mj-ia` (sous-module), qui a son propre dépôt et sa propre licence (MIT).

Les Veillées de Brumecombe sont un jeu original de la famille du loup-garou (jeux de déduction sociale nés du jeu
traditionnel *Mafia*) : rien n'est repris des *Loups-garous de Thiercelieux* ni d'un autre jeu édité, et ce projet n'est
affilié à aucun de leurs éditeurs. Foundry VTT (Foundry Virtual Tabletop) est une marque de Foundry Gaming, LLC ; ce
projet n'est ni affilié à Foundry Gaming ni approuvé par elle.

## English summary

The **code** in this repository (the `lakour-loups` system, scripts, tools, tests, templates, styles, interface
translations) is under the **MIT** licence (see `LICENSE`). The **original texts and images** written or made for LaKour
— `contenu/` and its English dictionaries, `src/`, `packs/`, the generated `lakour-veillees-en` module, `monde/` and the
images and data in `assets/` — are under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**
(<https://creativecommons.org/licenses/by-nc-sa/4.0/>). Credit **"LaKour — Hogun974"** with a link to the repository and
to the licence, and indicate changes; no commercial use; adaptations are shared under the same licence. The token
silhouettes are game-icons.net icons under CC BY 3.0 (credits in `CREDITS.md`). The illustrations were generated locally
with the non-commercial FLUX.2 klein 9B model. This is an original game, not affiliated with the publishers of any
published werewolf game. Foundry VTT is a trademark of Foundry Gaming, LLC; this project is not affiliated with or
endorsed by it.
