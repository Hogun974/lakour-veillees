# La Gazette de la lune : les 36 cartes, mécaniques à reprendre

*D'après les photos des cartes de Jordan (6 novembre 2026). Mécaniques reprises à l'identique, noms et textes à nous : aucune
phrase des cartes n'est recopiée. Sert de cahier des charges à l'étape 9 de `plan-le-pacte.md`.*

## Le tirage (règles de la variante)

- Paquet de 36 cartes mélangées, posé face cachée. Chaque matin sauf le premier, le dernier joueur éliminé lit la carte du dessus
  à voix haute ; l'effet s'applique aussitôt.
- Trois sortes d'effet, marquées sur la carte : **immédiat** (ce jour), **différé** (la nuit ou le vote à venir), **permanent**
  (jusqu'à la fin de la partie).
- Le narrateur peut ne piocher qu'un matin sur deux ou trois, ou choisir ses cartes, ou poser des cartes permanentes dès le début.
- Avec le **Crieur public** (garde champêtre) : avant la partie, le narrateur lui confie quelques cartes (jamais de Spiritisme) ;
  chaque matin dès le lendemain de sa nomination, on lui demande s'il a une annonce ; s'il lit une carte, elle s'applique.
- Avec la **Liseuse d'étoiles** (gitane) : le narrateur garde les 5 cartes Spiritisme en main ; chaque nuit il lui demande si elle
  veut s'en servir ; si oui, au matin, le premier joueur éliminé lit les 4 questions, la Liseuse en choisit une et désigne le
  « Spirite », qui la pose au **premier mort** ; le mort répond oui ou non, sans mentir. La carte est défaussée.

## L'adaptation en ligne : les traits des personnages

Beaucoup de cartes visent le corps des joueurs réels (filles ou garçons, âge, lunettes, bijou, vêtements, fumeur, habiter le lieu
de la partie). En ligne, ces cartes portent sur des **traits visibles du personnage** de chaque joueur, tirés à la distribution et
affichés sur sa fiche publique : genre (femme / homme), âge (jeune / vieux), lunettes, bijou visible, coiffe sombre, sabots, pipe,
habite le bourg ou un écart. Les questions de Spiritisme et les cartes « filles / garçons / jeunes / vieux » les lisent.

## Ce qui est fait (étape 9)

Code : `systems/lakour-loups/logique/gazette.mjs` (logique pure), `scripts/api.mjs` (section « la Gazette de la lune »), `logique/etat.mjs` (les modes
de vote), Table de jeu (encart, cases de la préparation), `lang/*.json` (`LAKOUR_LOUPS.Gazette`, `LAKOUR_LOUPS.Traits`) ; contenu : la Liseuse d'étoiles
(`roles.mjs`), les textes des cartes (`contenu/gazette.mjs`), les pages des guides (« La Gazette de la lune », « Mener la Gazette de la lune »). Essais :
`essais/gazette-logique.test.mjs`, `essais/gazette-api.test.mjs`, la partie « gazette » de `essais/non-fuite.test.mjs`.

- **Traits** : tirés à la distribution (et pour un arrivant), publics (`etat.traits`), sur la fiche et la carte de la Table, au chat à la distribution.
  Genre et âge moitié-moitié (un âge en années, distinct, départage « le plus jeune ») ; lunettes 30 %, bijou 35 %, sabots 50 %, coiffe sombre 40 %,
  pipe 25 % ; bourg / écart d'après la maison (13 à 18 : l'autre rive). Aucun villageois du contenu n'a de genre ni de portrait : un drapeau
  `flags["lakour-loups"].traits` sur l'acteur (posé par le MJ) est respecté. L'Illuminé : réglage « partageIllumine » (rive, genre, âge, lunettes).
- **Tirage** : réglage « gazette » (et case de la préparation), « gazetteRythme » (1, 2, 3), « gazetteChoix » (le narrateur choisit : api.lireUneCarte,
  Table), permanentes posées dès le début (cases de la préparation, réglage caché « gazettePermanentes »). Le paquet est un secret du MJ ; la carte
  est lue « par » le dernier éliminé (sans mort : le narrateur). L'Almanach est écarté quand la Gazette est en jeu.
- **Crieur public** : réglage « crieurPublic » (et case), « cartesDuCrieur » (3 par défaut, 5 au plus ; ou api.cartesDuCrieur avant la première nuit) ;
  nommé, gardé ou changé par le Bailli (au délai : le sort, ou le Crieur en place pour un nouveau Bailli) ; l'annonce du matin (une demande avec
  ses cartes) ; révoqué par un pouvoir de jour du Bailli (« crieur-public », après l'annonce, avant le vote). Ni Saint-Martin ni petite tablée.
- **Liseuse d'étoiles** : ordre 51 (après l'Herboriste, avant le Joueur de vielle) ; se désigner = une séance au matin (sans carte restante, rien à
  désigner). Au matin : la carte (au hasard parmi les restantes), la question (au délai : le sort), le Spirite (au délai : elle-même), les désignés
  (au délai : le sort), la réponse calculée sur l'état et les traits. Sans mort, la carte reste en main.

## Les 31 cartes Événement

| # | Chez nous | Sorte | Mécanique (à l'identique) | État (étape 9) |
|---|---|---|---|---|
| 1 | Somnambule (la Liseuse marche en dormant) | permanent | Désormais, chaque matin, le narrateur annonce à tous le rôle découvert la nuit par la Liseuse de cendres, sans dire qui elle a sondé. | fait : permanente ; chaque matin, l'annonce des rôles lus par la Liseuse de cendres (son apparence : le Loup déguisé paraît Villageois), jamais sur qui |
| 2 | La Crue | immédiat + nuit | Le village est inondé : les femmes se réfugient au prieuré, les hommes au cabaret. Pas de vote ce jour. La nuit suivante, la meute doit frapper dans l'un des deux refuges ; il peut y avoir deux victimes. Seulement s'il reste au moins 6 vivants. | fait : refuges annoncés (par le genre) ; « Ouvrir le vote » refusé ce jour ; la nuit, étape `crue` après la meute (une seconde proie du même genre que la première) ; sans effet sous 6 vivants |
| 3 | Marché avec le Malin | immédiat | Juste après le verdict, le condamné peut passer un marché : il n'est pas éliminé par ce vote. S'il est dans le camp perdant à la fin, il est exclu de la partie suivante. | fait : juste après le verdict (api.eliminer, cause « vote ») une demande courte au condamné (se désigner = accepter) ; épargné ; à la fin, s'il est du camp perdant, réglage « exclusDuMalin » : nouvellePartie l'écarte une fois |
| 4 | Lune noire | immédiat | Le village boude : on débat dos au cercle, sans se regarder ; qui se retourne perd son vote. On se remet face au cercle au moment du vote. (En ligne : pas de regards, les caméras coupées pendant le débat, ou débat en texte seul.) | fait : règle annoncée ; le narrateur retire le vote d'un contrevenant (api.priverDeVote, Table « Retirer son vote ») pour les votes d'exécution du jour |
| 5 | Bal du samedi | immédiat + nuit | La moitié la plus jeune forme les danseurs : ils ne débattent ni ne votent ; les vieux ne peuvent pas voter contre eux ; la nuit, un danseur loup ne dévore pas et un danseur ne peut pas être dévoré. | fait : la moitié la plus jeune (l'âge en années, au moins un) : silence, ni vote, pas candidats ; la nuit suivante intouchables, et un danseur loup ne chasse pas |
| 6 | Cueillette en forêt | immédiat | Les femmes partent cueillir pour l'Herboriste jusqu'au soir : ni débat ni vote pour elles, et on ne peut pas voter contre elles. L'Herboriste récupère une fiole déjà vidée, juste avant la nuit. | fait : les femmes, comme le Bal (sans la nuit) ; l'Herboriste vivante retrouve une fiole vidée (le remède d'abord ; son usage rendu) aussitôt |
| 7 | Dimanche de soleil | immédiat | Rien de particulier, sauf si le narrateur applique ce jour la variante « L'Envoûtement ». | fait : rien ; le narrateur peut appliquer l'Envoûtement pour ce tour (api.appliquerLaVarianteDuJour, Table) ; levée au matin suivant |
| 8 | Pile ou face | immédiat | Juste après le verdict, une pièce : pile, le condamné est gracié ; face, il est éliminé. | fait : juste après le verdict, une pièce par condamné (pile : gracié, annoncé) ; avant le Marché |
| 9 | La Saint-Vincent | immédiat | Le village élit un vrai chef : le Bailli en place est destitué et un nouveau Bailli est élu ; il prête serment. | fait : Bailli destitué (Registre « destitue »), élection due ce jour même ; sans Bailli dans la veillée : sans effet ; le Crieur suit le nouveau Bailli |
| 10 | Revenue d'entre les vivants | immédiat | La dernière victime de la meute n'était qu'évanouie : elle revient aussitôt en jeu, mais comme simple Villageois. | fait : la dernière victime de la meute (cause meute ou épiée) revient, carte Villageois (rendue publique) ; adaptation : si les morts voient tout, elle a pu voir des cartes |
| 11 | Les Bonnes manières | immédiat | Interdit de couper la parole : chacun parle à son tour sous la surveillance du narrateur ; qui enfreint perd son vote ce tour. | fait : comme Lune noire (le narrateur retire le vote) |
| 12 | Le Toucher mortel | permanent | Désormais, pour être dévorée, la victime de la meute doit être touchée par l'un des loups ; sinon elle est épargnée. (En ligne : un loup doit « marquer » sa proie d'un geste dans la nuit.) | fait : permanente ; étape `toucher` après la meute : les loups qui chassent désignent de nouveau la proie ; sans geste sur elle, épargnée |
| 13 | Le Jour des sots | immédiat | Certains rôles échangent leur pouvoir ce tour : Herboriste ↔ Liseuse de cendres, Braconnière ↔ Enfant de la brume, Garde du pont ↔ Aïeul. Les amoureux se détestent et votent obligatoirement l'un contre l'autre ; si l'un meurt ce tour, l'autre survit. | fait : jusqu'au matin, effet, réveil et usages échangés entre les deux cartes (Herboriste ↔ Liseuse de cendres, Braconnière ↔ Enfant de la brume, Garde du pont ↔ Aïeul ; les fioles suivent le remède), au carnet des deux ; rendus au matin ; un amoureux ne peut voter que contre son amant ; pas de chagrin ce tour (jour et nuit) |
| 14 | Fin des vendanges | immédiat | Rien de particulier, sauf si le narrateur applique ce jour la variante « Les Vendanges ». | fait : rien ; le narrateur peut appliquer les Vendanges pour ce tour (les pouvoirs éméchés de la nuit qui suit ; pas le loup de plus) |
| 15 | Le Petit Commis | immédiat | Le plus jeune part chercher de l'aide au village voisin : ni débat, ni vote, et il ne peut pas être dévoré. Rappelé le lendemain matin, il reprend sa place et son vote compte triple. | fait : le plus jeune vivant : silence, ni vote (reste candidat : la carte ne le protège pas du vote) ; intouchable la nuit ; le lendemain, voix ×3 aux votes d'exécution (annoncé au matin) |
| 16 | Retour de flamme | nuit | La nuit prochaine, si la meute désigne un simple Villageois, il n'est pas éliminé mais devient loup (le narrateur échange sa carte et le prévient). Sinon la victime survit et le premier loup à sa gauche est foudroyé. Si la meute ne s'accorde pas, aucune victime. | fait : la meute ne tue pas ; unanime sur un simple Villageois : il devient Loup de Brumecombe (carnet, présenté à la meute) ; sur un autre rôle : la proie survit, le premier loup vivant à sa gauche meurt (cause publique « foudre ») ; en désaccord : personne |
| 17 | Grande Défiance | vote | Chaque villageois a 2 voix, qu'il donne à ses 2 amis préférés ; les votes se font tous ensemble ; ceux qui n'obtiennent aucune voix sont éliminés. Remplace le vote du jour. | fait : vote d'exécution `mode: "defiance"` (etat.mjs) : deux amis chacun (un second clic en retire un, jamais soi), voix secrètes jusqu'à la clôture ; ceux qui n'ont aucune voix sont condamnés |
| 18 | Le Banquet des vétérans | immédiat | La moitié la plus âgée part au banquet jusqu'au soir : ni débat ni vote pour eux ; les jeunes ne peuvent pas voter contre eux. | fait : la moitié la plus âgée, comme le Bal (sans la nuit) |
| 19 | Le Dépit | vote | Si le prochain éliminé par le village n'est pas un loup, le village revote aussitôt, sans débat, pour éliminer un second suspect. | fait : en attente jusqu'au prochain éliminé du village (cause « vote ») ; pas un loup (camp actuel) : un vote d'exécution s'ouvre aussitôt ; consommée |
| 20 | L'Exécuteur | permanent | Le village élit un exécuteur. Désormais, seul lui connaît le rôle des éliminés du vote ; il ne montre jamais leur carte (libre à lui d'en parler). S'il est éliminé, il désigne son successeur. | fait : charge élue (vote `executeur`, comme le Bailli, égalité : le sort), ouverte aussitôt ; un condamné du vote n'est plus révélé, son rôle va au carnet de l'Exécuteur ; mort, il désigne son successeur (au délai : le sort) |
| 21 | Les Influences | vote | Le prochain vote se fait à tour de rôle : le dernier éliminé choisit le premier votant, qui garde le doigt tendu sur son choix ; son voisin de gauche fait de même, et ainsi de suite. Résultat compté comme d'habitude. | fait : en attente jusqu'au prochain vote d'exécution : `mode: "suite"` (à tour de rôle, voix publiques) ; le dernier éliminé choisit le premier votant (au délai : le sort), puis vers la gauche ; au délai, le tour passe ; clôture au dernier |
| 22 | La Nuit des sots | nuit | La nuit prochaine, les loups deviennent liseuses (chacun espionne un joueur à tour de rôle) ; la Braconnière, l'Herboriste et la Liseuse de cendres deviennent loups, se réveillent ensemble et éliminent un joueur. Au matin, tout redevient normal. | fait : la nuit suivante, les loups lisent chacun un rôle (étape `sots-voyance`), la Braconnière, l'Herboriste et la Liseuse de cendres sont la meute (ils peuvent dévorer un loup) ; leurs rôles dorment |
| 23 | Le Châtiment | immédiat | Le dernier éliminé désigne un joueur, qui est éliminé, sauf si au moins 2 joueurs témoignent de sa probité (geste de soutien) ; s'ils tardent, le condamné peut lancer un appel. | fait : le dernier éliminé désigne (demande posthume ; au délai, le sort) ; vote `chatiment` : les soutiens désignent l'accusé ; moins de 2 : il tombe (cause publique « chatiment ») ; l'appel : une demande à l'accusé, annoncée |
| 24 | La Battue | immédiat + nuit | Les hommes partent chasser jusqu'à l'aube : ni débat ni vote pour eux ; les femmes ne peuvent pas voter contre eux ; la nuit, un chasseur loup ne dévore pas et un chasseur ne peut pas être dévoré. | fait : les hommes, comme le Bal (avec la nuit) |
| 25 | L'Enthousiasme | vote | Si le prochain éliminé par le village est un loup, le village revote aussitôt, sans débat, pour éliminer un second suspect. | fait : comme le Dépit, quand l'éliminé est un loup |
| 26 | L'Enfouissement | permanent | Désormais, le rôle des victimes de la meute n'est jamais révélé à personne. | fait : permanente ; une victime de la meute (ou l'Enfant de la brume surprise) n'est plus révélée (la fin de partie retourne toutes les cartes) |
| 27 | Le Méchant Benêt | nuit | La nuit, le premier éliminé de la partie désigne un joueur non loup, qui ouvre seul les yeux ; le narrateur lui montre la meute : il devient leur allié secret (reste villageois, ne se réveille pas avec eux, partage leur victoire). | fait : la nuit suivante, étape `benet` en tout début de nuit pour le premier mort (posthume) : un vivant qui n'est pas loup ; il apprend les loups (carnet), allié secret (gazetteSecret.allies) ; gagne avec la meute (récit de fin, Chroniques) |
| 28 | Ni loup ni moi | immédiat | Par superstition, interdit de dire « loup » et « moi » ; qui enfreint perd sa ou ses voix au vote à venir. (En ligne : relevé dans le texte, et à l'oral par le narrateur.) | fait : règle annoncée ; le chat relève « loup(s) » et « moi » (« wolf », « wolves », « me » dans un monde anglais) écrits par un joueur : privé de vote ; à l'oral, le narrateur |
| 29 | Lundi gris | immédiat | Rien de particulier, sauf si le narrateur applique ce jour la variante « La Chaîne des innocents ». | fait : rien ; le narrateur peut appliquer la Chaîne des innocents pour le vote de ce jour |
| 30 | Le Spectre | nuit | Le prochain joueur désigné par la meute ouvre les yeux, les loups gardent les leurs : il devient loup et désigne un des anciens loups, qui est éliminé aussitôt (le narrateur échange leurs cartes). | fait : en attente jusqu'à la prochaine proie ; étape `spectre` : la proie désigne un ancien loup (au délai : le sort) ; les cartes s'échangent (api.echangerRoles), l'ancien loup meurt (cause publique « nuit ») avec la carte de la proie |
| 31 | Le Cauchemar | vote | Au réveil, sans débat, en commençant par le voisin de gauche du dernier éliminé, chacun doit accuser un villageois ; le ou les plus cités sont éliminés. Remplace le vote du jour. | fait : `mode: "suite"` + `cauchemar` : le vote s'ouvre dès la lecture, du voisin de gauche du dernier éliminé vers la gauche ; le ou les plus cités condamnés |

## Les 5 cartes Spiritisme (questions au premier mort, réponse oui / non)

| Carte | Questions (en ligne : les traits sont ceux des personnages) | État (étape 9) |
|---|---|---|
| Séance I | Les 2 joueurs que je désigne sont-ils du même camp ? · Un loup au moins porte-t-il des lunettes ? · L'Herboriste est-elle un homme ? · Le Bailli est-il un simple Villageois ? | fait : la réponse calculée (reponseDeLEsprit) |
| Séance II | Un des loups est-il un homme ? · Un des loups est-il une femme ? · Un des 2 voisins du joueur que je désigne est-il loup ? · Le joueur que je désigne est-il un simple Villageois ? | fait : la réponse calculée (reponseDeLEsprit) |
| Séance III | Suis-je un simple Villageois ? · Un des loups est-il le Bailli ? · Un des loups habite-t-il le bourg (et non un écart) ? · Un des loups fume-t-il la pipe ? | fait : la réponse calculée (reponseDeLEsprit) |
| Séance IV | La Liseuse de cendres a-t-elle découvert au moins un loup ? · Des loups sont-ils voisins ? · Un loup porte-t-il au moins un bijou visible ? · Suis-je un loup ? | fait : la réponse calculée (reponseDeLEsprit) |
| Séance V | Un des loups porte-t-il des sabots ? · Un des loups porte-t-il une coiffe sombre ? · Les loups en vie sont-ils tous des hommes ? · Les loups en vie sont-ils tous des femmes ? | fait : la réponse calculée (reponseDeLEsprit) |

Notes de reprise :
- Les traits du jeu réel (lunettes, jean, haut noir, fumeur, habiter le lieu) deviennent des traits du personnage (lunettes, sabots,
  coiffe sombre, pipe, habite le bourg). Le genre et l'âge sont ceux du personnage.
- « Jour des sots » et « Nuit des sots » utilisent les correspondances de rôles du livre (Sorcière ↔ Voyante, Chasseur ↔ Petite
  fille, Salvateur ↔ Ancien ; Chasseur, Sorcière et Voyante deviennent loups) transposées dans nos rôles.
- Les cartes qui renvoient à une variante (7, 14, 29) appliquent la variante du livre correspondante pour ce seul tour.
