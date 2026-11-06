// La Gazette de la lune (Le Pacte, étape 9 ; docs/gazette-de-la-lune.md) : les 31 cartes Événement et les 5 cartes Spiritisme, telles que
// les guides les montrent (nos noms, nos phrases ; mêmes textes que le système, lang/fr.json : LAKOUR_LOUPS.Gazette). Les règles
// elles-mêmes vivent dans le système (logique/gazette.mjs).

// [clé, nom, effet], dans l'ordre du cahier des charges.
export const CARTES_DE_LA_GAZETTE = [
  ["somnambule", "Somnambule", "Désormais, chaque matin, le narrateur dit à tous le rôle que la Liseuse de cendres a lu dans la nuit, sans dire sur qui."],
  ["inondation", "La Crue", "Le village est sous l'eau : les femmes se réfugient au prieuré, les hommes au cabaret. Pas de vote aujourd'hui. La nuit qui vient, la meute frappe dans un seul des deux refuges et peut y faire deux victimes. (Seulement s'il reste au moins six vivants.)"],
  ["marche-du-malin", "Marché avec le Malin", "Aujourd'hui, juste après le verdict, chaque condamné peut passer un marché : il n'est pas éliminé par ce vote. S'il finit dans le camp perdant, il ne sera pas de la partie suivante."],
  ["lune-noire", "Lune noire", "Le village boude : on débat sans se regarder (caméras coupées, ou en texte seul) ; qui se tourne vers les autres perd son vote aujourd'hui. On se regarde de nouveau pour voter."],
  ["bal-du-samedi", "Bal du samedi", "La moitié la plus jeune du village part danser : les danseurs ne débattent ni ne votent, et personne ne peut voter contre eux. La nuit qui vient, un danseur loup ne chasse pas, et aucun danseur ne peut être dévoré."],
  ["cueillette", "Cueillette en forêt", "Les femmes partent cueillir pour l'Herboriste jusqu'au soir : elles ne débattent ni ne votent, et personne ne peut voter contre elles. À leur retour, l'Herboriste remplit une fiole déjà vide."],
  ["dimanche-de-soleil", "Dimanche de soleil", "Rien de particulier… sauf si le narrateur décide d'appliquer L'Envoûtement pour ce seul tour."],
  ["pile-ou-face", "Pile ou face", "Aujourd'hui, juste après le verdict, on lance une pièce pour chaque condamné : pile, il est gracié ; face, il est éliminé."],
  ["saint-vincent", "La Saint-Vincent", "Le village veut un vrai chef : le Bailli en place est destitué, et un nouveau Bailli est élu aujourd'hui."],
  ["revenante", "Revenue d'entre les vivants", "La dernière victime de la meute n'était qu'évanouie : elle revient aussitôt parmi les vivants, mais en simple Villageois."],
  ["bonnes-manieres", "Les Bonnes manières", "Interdit de couper la parole : chacun parle à son tour, sous l'œil du narrateur ; qui l'enfreint perd son vote aujourd'hui."],
  ["toucher-mortel", "Le Toucher mortel", "Désormais, pour dévorer sa proie, la meute doit aussi la marquer : après son choix, un loup la désigne une seconde fois ; sinon, elle est épargnée."],
  ["jour-des-sots", "Le Jour des sots", "Jusqu'au matin, certains échangent leur pouvoir : l'Herboriste et la Liseuse de cendres, la Braconnière et l'Enfant de la brume, le Garde du pont et l'Aïeul. Les amoureux se détestent : chacun doit voter contre l'autre ; si l'un meurt d'ici au matin, l'autre survit."],
  ["fin-des-vendanges", "Fin des vendanges", "Rien de particulier… sauf si le narrateur décide d'appliquer Les Vendanges pour ce seul tour."],
  ["petit-commis", "Le Petit Commis", "Le plus jeune part chercher de l'aide au village voisin : aujourd'hui il ne débat ni ne vote, et la nuit qui vient il ne peut pas être dévoré. Rentré au matin, sa voix compte triple au vote du jour."],
  ["retour-de-flamme", "Retour de flamme", "La nuit qui vient, si la meute désigne un simple Villageois, il ne meurt pas : il devient loup. Si elle désigne quelqu'un d'autre, sa proie survit et le premier loup à sa gauche est foudroyé. Si la meute ne s'accorde pas, personne ne meurt."],
  ["grande-defiance", "La Grande Défiance", "Le vote du jour change : chacun donne deux voix à ses deux amis préférés, tous en même temps ; ceux qui n'en reçoivent aucune sont éliminés."],
  ["banquet-des-veterans", "Le Banquet des vétérans", "La moitié la plus âgée du village part festoyer jusqu'au soir : les vétérans ne débattent ni ne votent, et personne ne peut voter contre eux."],
  ["depit", "Le Dépit", "Si le prochain éliminé par le village n'est pas un loup, le village revote aussitôt, sans débat, pour éliminer un second suspect."],
  ["executeur", "L'Exécuteur", "Le village élit un Exécuteur. Désormais, lui seul apprend le rôle des condamnés du vote, qui ne sont plus montrés à personne ; libre à lui d'en parler. S'il meurt, il désigne son successeur."],
  ["influences", "Les Influences", "Le prochain vote se fait à tour de rôle et à découvert : le dernier éliminé choisit le premier votant, puis chacun vote à son tour vers la gauche, sans pouvoir se reprendre. On compte comme d'habitude."],
  ["nuit-des-sots", "La Nuit des sots", "La nuit qui vient, les loups deviennent liseuses : chacun lit le rôle d'un joueur. La Braconnière, l'Herboriste et la Liseuse de cendres deviennent loups : ensemble, ils éliminent un joueur. Au matin, tout redevient normal."],
  ["chatiment", "Le Châtiment", "Le dernier éliminé désigne un joueur : celui-ci est éliminé, sauf si au moins deux joueurs témoignent pour lui. S'ils tardent, l'accusé peut lancer un appel."],
  ["battue", "La Battue", "Les hommes partent chasser jusqu'à l'aube : ils ne débattent ni ne votent, et personne ne peut voter contre eux. La nuit qui vient, un chasseur loup ne dévore pas, et aucun chasseur ne peut être dévoré."],
  ["enthousiasme", "L'Enthousiasme", "Si le prochain éliminé par le village est un loup, le village revote aussitôt, sans débat, pour éliminer un second suspect."],
  ["enfouissement", "L'Enfouissement", "Désormais, le rôle des victimes de la meute n'est plus jamais montré."],
  ["mechant-benet", "Le Méchant Benêt", "La nuit qui vient, le premier éliminé de la partie désigne un joueur qui n'est pas loup : celui-ci apprend qui sont les loups et devient leur allié secret. Il reste du Village, ne se réveille pas avec eux, et gagne s'ils gagnent."],
  ["ni-loup-ni-moi", "Ni loup ni moi", "Par superstition, interdit de dire « loup » et « moi » aujourd'hui (au chat, le système le relève ; à voix haute, le narrateur) : qui les dit perd son vote."],
  ["lundi-gris", "Lundi gris", "Rien de particulier… sauf si le narrateur décide d'appliquer La Chaîne des innocents pour ce seul tour."],
  ["spectre", "Le Spectre", "La prochaine proie de la meute ne meurt pas : elle devient loup et désigne un des anciens loups, qui meurt aussitôt à sa place, avec la carte qu'avait la proie."],
  ["cauchemar", "Le Cauchemar", "Au réveil, pas de débat : en partant de la gauche du dernier éliminé, chacun à son tour accuse un villageois ; le ou les plus cités sont éliminés. C'est le vote du jour."]
];

// [nom, [les quatre questions]] : posées par le Spirite au premier mort, qui répond oui ou non sans mentir.
export const SEANCES_DE_SPIRITISME = [
  ["Séance I", ["Les deux joueurs que je désigne sont-ils du même camp ?", "Un loup au moins porte-t-il des lunettes ?", "L'Herboriste est-elle un homme ?", "Le Bailli est-il un simple Villageois ?"]],
  ["Séance II", ["Un des loups est-il un homme ?", "Un des loups est-il une femme ?", "Un des deux voisins du joueur que je désigne est-il loup ?", "Le joueur que je désigne est-il un simple Villageois ?"]],
  ["Séance III", ["Suis-je un simple Villageois ?", "Un des loups est-il le Bailli ?", "Un des loups habite-t-il le bourg (et non un écart) ?", "Un des loups fume-t-il la pipe ?"]],
  ["Séance IV", ["La Liseuse de cendres a-t-elle découvert au moins un loup ?", "Des loups sont-ils voisins ?", "Un loup porte-t-il au moins un bijou visible ?", "Suis-je un loup ?"]],
  ["Séance V", ["Un des loups porte-t-il des sabots ?", "Un des loups porte-t-il une coiffe sombre ?", "Les loups en vie sont-ils tous des hommes ?", "Les loups en vie sont-ils tous des femmes ?"]]
];
