// Tables aléatoires du narrateur : noms de villageois, rumeurs, présages de l'aube, morts mystérieuses (récits de mort).
// Textes originaux ; chaque table se tire à 1dN.
import { table } from "./aides.mjs";

const NOMS = [
  "Mathurin Vaudrey", "Ysaline Corbet", "Anselme Ferrand", "Odile Basquin", "Gaspard Lerouge", "Bertille Mauvoisin",
  "Colin Hautecœur", "Perrine Sablon", "Aymeric Fontbrune", "Guillemette Rousseau", "Thibaut Cassagne", "Mahaut Lenoir",
  "Félicien Morteau", "Clémence Dubreuil", "Eudes Carrel", "Jacquette Vignal", "Sylvestre Pradel", "Aliénor Fauchet",
  "Bastien Grenier", "Margot Chênevert", "Honoré Bellefeuille", "Solène Marchais", "Hugon Ravier", "Philippine Aubrac",
  "Léonce Tarride", "Agathe Combemale", "Valentin Brossard", "Isaure Moulinier", "Firmin Delorme", "Rosalie Fougerol",
  "Quentin Labrousse", "Hermine Castagné", "Augustin Pélissier", "Blanche Sorbier", "Josselin Brumaire", "Edmée Vaissière",
  "Norbert Gaillac", "Apolline Ternant", "Baptistin Rochefort", "Ondine Malefosse"
];

const RUMEURS = [
  "Quelqu'un a vu une lanterne traverser le pont après minuit, et personne ne l'a vue revenir.",
  "Le chien des Vaudrey n'aboie plus depuis trois nuits. Il ne mange plus non plus.",
  "On dit que la meunière compte ses sacs de farine deux fois, et qu'il en manque toujours un.",
  "Une des maisons de l'autre rive a laissé ses volets ouverts toute la nuit. Par oubli, ou pour guetter ?",
  "Le curé a changé la serrure de la sacristie. Il n'a pas dit pourquoi.",
  "À la taverne, quelqu'un a payé sa tournée avec une pièce qui sentait la terre mouillée.",
  "La vieille Mahaut jure que les corbeaux se posent toujours sur le même toit.",
  "On a retrouvé des touffes de poils gris accrochées à la haie du lavoir.",
  "Quelqu'un a demandé à la forge une lame courte, sans manche, « pour couper le pain ».",
  "Deux voisins qui ne se parlaient plus depuis dix ans ont été vus se serrer la main sur la place.",
  "Les enfants disent qu'un homme sans visage se tient parfois au bout du cimetière, à l'heure où l'on rentre les bêtes.",
  "Le passeur prétend qu'on lui a demandé de traverser à la nage, une nuit, sans barque ni lumière.",
  "Une femme a pleuré toute une nuit dans une maison où personne n'habite.",
  "On a entendu siffler l'air de la fête des moissons à trois heures du matin, près du puits.",
  "Le garde du guet a trouvé sa pique plantée dans la porte de la chapelle.",
  "Quelqu'un vend des amulettes de sorbier à la sortie de la messe. Elles se vendent très bien.",
  "Le tanneur dit que certaines peaux, cet automne, ont le poil qui repousse après le tannage.",
  "L'aubergiste jure qu'un de ses clients ne touche jamais au pain, seulement à la viande, et crue.",
  "Une lettre sans signature a été glissée sous la porte de la maîtresse d'école. Elle l'a brûlée sans la lire, dit-elle.",
  "On a vu deux silhouettes se disputer devant la grange, puis plus qu'une seule repartir.",
  "La cloche a sonné un coup, seule, à l'heure où personne ne la tire.",
  "Quelqu'un a laissé des traces de pas nus dans la boue du chemin, des traces qui deviennent plus larges vers le bois.",
  "La herboriste a acheté plus de belladone qu'il n'en faut pour soigner un village entier.",
  "On murmure qu'une famille de Brumecombe a déjà eu un loup parmi les siens, il y a trois générations, et qu'on n'a jamais dit lequel."
];

const PRESAGES = [
  "Le jour se lève sans soleil. La brume est si basse qu'on ne voit plus le clocher.",
  "Un corbeau s'est posé sur le gibet et refuse de s'envoler, même quand on lui jette des pierres.",
  "L'eau du puits est tiède ce matin, comme si quelque chose y avait dormi.",
  "Toutes les feuilles du tilleul de la place sont tombées en une seule nuit.",
  "Le coq des Fougerol a chanté treize fois, puis s'est tu pour de bon.",
  "Sur la rivière, un tapis de feuilles rousses remonte le courant.",
  "Les chiens du village se sont tous tournés vers la même maison, sans aboyer.",
  "La cloche de la chapelle porte une longue rayure fraîche, comme une griffe sur du métal.",
  "Il a gelé cette nuit, mais seulement sur les seuils des maisons.",
  "Une chouette blanche est restée sur le toit du moulin jusqu'au lever du jour.",
  "Le vent tourne au nord. Les anciens disent que c'est le vent des choix difficiles.",
  "Les bougies de la chapelle ont toutes brûlé jusqu'au bout, alors que personne ne les avait allumées.",
  "On a trouvé un cercle de champignons noirs au milieu de la place.",
  "Le linge étendu au lavoir est sec, mais il sent la fumée.",
  "Une rangée de petites pierres blanches mène d'une maison à une autre. Personne ne dit les avoir posées.",
  "La lune est encore visible en plein jour, pâle et énorme au-dessus de la combe.",
  "Les pommes du verger ont toutes une tache brune, au même endroit.",
  "La forge s'est rallumée seule pendant la nuit ; le forgeron jure qu'il l'avait couverte.",
  "Une odeur de miel brûlé flotte sur tout le village et ne se dissipe pas.",
  "Les sorbiers du cimetière sont couverts de baies rouges, alors qu'ils étaient nus hier.",
  "Le vieux puits renvoie un écho de trop : quand on crie un nom, il en répond deux.",
  "Un renard traverse la place au grand jour, regarde chacun en face, et repart vers le bois.",
  "La brume s'est levée d'un coup, et pendant une minute on a vu tout le village très net, comme dans un miroir.",
  "Personne n'a rêvé cette nuit. Absolument personne."
];

const MORTS = [
  "La porte était entrouverte et le feu éteint. Dans le lit défait, il ne restait qu'une forme creusée et un peu de terre noire.",
  "On l'a trouvé assis à sa table, la cuillère encore à la main, les yeux tournés vers la fenêtre. Sur la vitre, une buée en forme de main.",
  "Les volets avaient été arrachés de l'extérieur. Dans la neige fondue du seuil, des empreintes qui commencent humaines et finissent autrement.",
  "Le corps reposait au bord du puits, enveloppé dans sa propre courtepointe, comme si quelqu'un avait voulu le border une dernière fois.",
  "Sa maison était parfaitement rangée. Trop rangée. Seul le loquet de la porte portait des marques de dents.",
  "On l'a retrouvé dans le lavoir, au matin, flottant parmi les draps. Personne n'avait entendu de cri.",
  "Une traînée de feuilles mouillées menait de sa porte jusqu'à la lisière du bois. Elle s'arrêtait net.",
  "Les poules du voisin étaient toutes vivantes, et toutes silencieuses. Chez lui, la chandelle brûlait encore.",
  "Il gisait sur le pont, une main tendue vers l'autre rive, comme s'il avait voulu prévenir quelqu'un.",
  "Sa chaise à bascule balançait encore quand on est entré. Elle était vide ; le corps était derrière la porte.",
  "On a d'abord cru à une chute dans l'escalier. Puis on a vu que l'escalier avait été griffé de haut en bas.",
  "La chambre sentait la cire chaude et le fer. Sur l'oreiller, une seule plume de corbeau.",
  "Sa lanterne était posée devant la maison, toujours allumée, comme pour qu'on le retrouve vite.",
  "Il était couché dans le foin de la grange, paisible. Seule sa main serrait une poignée de poils gris.",
  "La porte était fermée à double tour, de l'intérieur. La fenêtre aussi. Et pourtant.",
  "On l'a trouvé au pied du gibet, assis, le dos contre le poteau, comme s'il avait attendu toute la nuit.",
  "Le chat de la maison n'a pas voulu entrer. Il miaule encore sur le seuil.",
  "Sur la table, deux bols de soupe servis, un seul entamé. L'autre convive n'a jamais été retrouvé.",
  "La cheminée était pleine de cendres froides où l'on voyait encore la forme d'une lettre brûlée.",
  "Ses sabots étaient alignés devant la porte, bien droits. Ses pieds nus, eux, étaient couverts de boue jusqu'aux genoux.",
  "On a cherché toute la matinée. On l'a trouvé dans le cimetière, allongé sur une tombe qui n'était pas la sienne.",
  "Rien n'était cassé, rien n'avait été volé. Seul le miroir de la chambre avait été retourné contre le mur.",
  "Les draps étaient tachés de cire rouge et non de sang. C'est le médecin qui l'a dit. Personne ne l'a cru.",
  "Le vent avait éteint toutes les chandelles de la maison, sauf celle qui brûlait à son chevet."
];

// L'Almanach des brumes (variante, réglage « almanach » du système) : un présage par aube, qui change la règle du jour ou de la
// nuit suivante. Le système tire et applique lui-même le présage (logique/almanach.mjs) ; cette liste en donne le texte au
// narrateur (et le texte à lire), dans le même ordre que le système : une page des Variantes (guides.mjs), pas une table à tirer.
export const ALMANACH = [
  ["ciel-clair", "Ciel clair", "Le ciel est lavé, la brume se tient au fond des combes. Rien ne change aujourd'hui."],
  ["givre", "Nuit de givre", "Le givre a pris les serrures et les manches des piques. La nuit prochaine, aucune protection ne tient : ni garde, ni gardienne, ni verrou."],
  ["crue", "Crue de la rivière", "La Brume a passé ses berges dans la nuit. La nuit prochaine, le Pont est sous l'eau : la meute ne chasse pas l'autre rive."],
  ["foire", "Jour de foire", "Les marchands sont sur la place, on parle fort et l'on vote à main levée : aujourd'hui, chacun voit les voix pendant le vote."],
  ["brouillard", "Brouillard épais", "On ne voit pas sa main devant soi. Le greffier range sa plume : aucune déclaration au Registre aujourd'hui."],
  ["glas", "Le glas", "La cloche a sonné seule avant l'aube, deux coups lents. Aujourd'hui, le vote désigne deux condamnés."],
  ["lune-rousse", "Lune rousse", "La lune s'est couchée rouge sur les toits. Aujourd'hui, il faut plus de la moitié du village pour condamner."],
  ["rumeur", "Jour de marché", "Au marché, une nouvelle court de bouche en bouche : le narrateur en crie une, vraie mais floue, sur la nuit passée."],
  ["vent-du-nord", "Vent du nord", "Le vent du nord a soufflé toute la nuit et emporté les silences : chacun peut parler aujourd'hui."],
  ["sceau-brise", "Sceau fêlé", "Le sceau du village s'est fendu sur la table du Bailli. Aujourd'hui, sa voix ne compte pas double."]
];

export const TABLES = [
  table({ cle: "noms-de-villageois", nom: "Noms de villageois", description: "Prénoms et noms de familles de Brumecombe, pour les figurants, les morts d'autrefois et les voisins dont on parle.", resultats: NOMS }),
  table({ cle: "rumeurs", nom: "Rumeurs du village", description: "Ce qu'on se dit à mi-voix sur la place. À glisser dans un débat qui s'essouffle : une rumeur n'est ni vraie ni fausse, elle donne à parler.", resultats: RUMEURS }),
  table({ cle: "presages-de-l-aube", nom: "Présages de l'aube", description: "Pour les matins où personne n'est mort, ou pour ouvrir le jour. Aucun présage ne désigne un joueur.", resultats: PRESAGES }),
  table({ cle: "morts-mysterieuses", nom: "Morts mystérieuses", description: "Récits de mort pour l'aube : trois phrases au plus. Adapte le lieu (« Maison 7 »), le nom, et retire tout détail qui livrerait la cause si elle doit rester secrète.", resultats: MORTS })
];
