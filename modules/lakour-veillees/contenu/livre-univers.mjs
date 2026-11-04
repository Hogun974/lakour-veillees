// Le livre de Brumecombe : le chapitre d'univers des Veillées, lisible des joueurs avant la première veillée. Pas une règle de
// plus, pas un secret de partie : la vallée, son histoire, ses maisons, sa foi, ce qu'on raconte des loups, la Veillée comme
// coutume (cohérente avec les règles publiques du guide du joueur), le calendrier, des visages, des rumeurs, le parler local et
// le récit d'une première nuit. Les liens @UUID mènent aux rôles, métiers et bâtiments des compendiums. Textes originaux.
import { MODULE, journal } from "./aides.mjs";
import { ROLES } from "./roles.mjs";
import { METIERS } from "./metiers.mjs";
import { BATIMENTS } from "./batiments.mjs";

// Lien vers un objet d'un compendium du module (@UUID[Compendium.lakour-veillees.<pack>.Item.<id>]{libellé}) ; une clé inconnue
// est une erreur de fabrication, pour qu'un rôle renommé ne laisse pas un lien mort dans le livre.
const lien = (liste, pack, cle, libelle) => {
  const d = liste.find(x => x.system.cle === cle);
  if (!d) throw new Error(`Livre de Brumecombe : ${pack}:${cle} introuvable`);
  return `@UUID[Compendium.${MODULE}.${pack}.Item.${d._id}]{${libelle ?? d.name}}`;
};
const r = (cle, libelle) => lien(ROLES, "roles", cle, libelle);
const m = (cle, libelle) => lien(METIERS, "metiers", cle, libelle);
const b = (cle, libelle) => lien(BATIMENTS, "batiments", cle, libelle);

export const CLE_LIVRE = "livre-de-brumecombe";

export const LIVRE_DE_BRUMECOMBE = journal({
  cle: CLE_LIVRE, nom: "Les Veillées de Brumecombe — Le livre de Brumecombe", visible: true,
  pages: [
    {
      titre: "Avant d'ouvrir les volets",
      texte: `# Ce que ce livre est, et ce qu'il n'est pas

On ne naît pas à Brumecombe par hasard, et l'on n'y arrive jamais tout à fait par hasard non plus. Si vous tenez ce livre, c'est que vous allez y passer un automne : une maison vous attend, avec son numéro peint à la chaux sur le linteau, un métier qu'on vous donnera sur la place, et une chaise à la veillée.

Ce livre raconte le village tel que ses habitants le connaissent : la vallée et sa brume, les dix-huit maisons et ceux qui y vivent, la chapelle et ce qu'on y croit, les fêtes de l'année, les histoires qu'on se répète à voix basse quand la cloche a sonné. Il dit ce que le village sait des loups, ce qui est en grande partie ce que le village *croit* savoir. Il explique pourquoi, chaque automne, Brumecombe se réunit pour veiller, et comment cette coutume s'est donné ses lois.

Ce livre n'est pas un livre de règles. Les règles sont dans le guide du joueur, et le narrateur les connaît mieux que personne. Rien de ce qui est écrit ici ne vous dira qui est loup : personne ne le sait, c'est bien le malheur de Brumecombe. Mais quand vous accuserez votre voisin de la Maison 9 d'avoir laissé sa lanterne allumée, vous saurez de quelle lanterne il s'agit, et pourquoi on n'aime pas ça.

> On apprend le village comme on apprend un visage : d'abord de loin, puis trop près.
> — Mère Ysaline, sur son banc

Lisez-le d'une traite ou par morceaux, le soir, avant que la brume ne tombe. Et quand elle tombera, fermez les volets.`
    },
    {
      titre: "La vallée et la brume",
      texte: `# Une combe au bout des chemins

Brumecombe est tout au fond d'une vallée étroite, qu'on appelle la combe, entre deux versants de hêtres et de sapins qui se touchent presque au-dessus du village. On y descend par un seul chemin carrossable, qui vient du nord et finit sur la place ; les autres chemins sont des sentes de bûcherons et de bergers, qui montent vers les pâtures d'été et se perdent dans les bois. Le colporteur qui vient deux fois l'an dit qu'il y a une ville à trois jours de marche. Personne, ou presque, n'est allé vérifier.

Au milieu de la combe coule la Brume. C'est une rivière lente et noire, venue des tourbières du haut, qui traverse le village du nord au sud et le coupe en deux. Sur sa rive ouest, la place, la chapelle, le moulin, la forge, la taverne, et les maisons 1 à 12. Sur la rive est, qu'on appelle simplement l'autre rive, six maisons, les maisons 13 à 18, la grange des Vaudrey et des prés qui montent vers le bois. Entre les deux, ${b("pont", "le pont")} de pierre, à trois arches, le seul passage à pied sec ; plus au sud, un gué que seuls les enfants et les ivrognes empruntent. Le lavoir est au bord de l'eau, sous le pont, et l'écluse un peu en amont règle le niveau des biefs.

La Brume donne son nom au village, et le village lui a rendu ce nom au brouillard qui monte d'elle. Car la rivière fume. Dès que l'air fraîchit, une vapeur se lève de l'eau noire, rampe sur les berges, remplit les ruelles, et quand elle a tout pris, on ne voit plus le clocher depuis la place.

# Les quatre saisons, et la cinquième

Le printemps vient tard. On débourre les bêtes en avril, les sorbiers fleurissent blanc le long du cimetière, la Brume grossit de la fonte et passe parfois ses berges. L'été est court et plein : les foins, la moisson sur les terrasses de l'autre rive, les enfants au gué, les soirs longs où l'on reste sur le pas des portes. Jusqu'à la fin d'août, Brumecombe est un village comme un autre, et il arrive qu'on l'oublie.

Puis vient l'automne, et l'automne ferme la vallée.

Cela se fait en quelques jours, toujours entre la fin de septembre et la première semaine d'octobre. La brume de la rivière, qui se levait le soir et se dissipait au matin, un jour ne se dissipe plus. Elle s'épaissit, elle monte sur les versants, elle bouche le chemin du nord. Le colporteur fait son dernier passage. Les bergers redescendent les bêtes de la Combe-aux-Sorbiers. Et un matin, en ouvrant ses volets, on ne voit plus sa propre main au bout de son bras. Les anciens disent que ce jour-là, « la vallée a mis son couvercle ». Elle le gardera jusqu'aux premières neiges, qui tassent la brume, et jusqu'au vrai froid de janvier qui la fait enfin retomber sur l'eau.

Pendant ces semaines-là, Brumecombe n'a plus de dehors. On ne sort pas du village : on s'y perdrait à vingt pas. Et c'est pendant ces semaines-là, depuis aussi longtemps qu'on s'en souvienne, que les loups entrent dans les maisons.

> La brume, c'est pas de l'eau. C'est le bois qui descend voir ce qu'on fait.
> — Hugon Ravier, le vieux meunier

# Ce que la brume fait aux gens

On vit autrement dans la brume. On marche en suivant les murs. On se parle de loin, par la voix, et l'on apprend à reconnaître chacun à sa toux, à son pas, au grincement de sa porte. Les lanternes des seuils font dans le blanc des taches rousses qui n'éclairent rien mais disent : ici, quelqu'un. Les chiens aboient pour rien. Le moulin, sur sa butte à l'ouest, tourne sans qu'on sente de vent.

On vit aussi plus près les uns des autres. On sait qui a rentré son bois, qui est rentré tard. Dans un village où l'on ne peut rien voir, on écoute tout, et l'on retient. Ce que le village appelle la Veillée est né de cela : de l'impossibilité de voir, et de la nécessité de savoir quand même.`
    },
    {
      titre: "Une histoire de Brumecombe",
      texte: `# Les premières pierres

On dit que Brumecombe a été fondée par des charbonniers, qui descendaient de la forêt pour vendre leur charbon et qui, un hiver, ont trouvé la vallée plus douce que les crêtes. On dit aussi que c'étaient des gens qui fuyaient quelque chose, une guerre ou une dette, et qui ont choisi la combe précisément parce qu'on ne la voit pas depuis la route. Les deux histoires s'accordent sur un point : les premiers arrivés se sont installés sur la rive ouest, là où la place est aujourd'hui, autour d'une source qui est devenue ${b("puits", "le puits")}. La chapelle a été bâtie ensuite, trop petite d'abord, puis agrandie, et dotée d'un clocher que la fierté des maçons a fait beaucoup trop haut pour elle. On y a pendu une cloche venue d'ailleurs, dont personne ne sait plus le nom.

Le moulin est plus vieux que le village, ou presque : un moulin à vent, sur la butte de l'ouest, là où la brume est la plus mince. Il a brûlé deux fois et a été reconstruit deux fois sur les mêmes fondations. Les Ravier le tiennent depuis quatre générations, et la meule, dit-on, connaît les bras de chaque meunière qui l'a tournée.

# Le pont

Pendant longtemps, l'autre rive n'a pas existé. On y menait les bêtes par le gué, on y coupait du foin, mais on n'y dormait pas. C'est un hiver de crue, où la Brume a emporté trois hommes qui tentaient de ramener leurs vaches, qu'on a décidé le pont. Il a fallu six étés, et le premier maçon y a laissé une jambe. On a gravé une date sur la pile du milieu ; l'eau l'a effacée avant que les enfants des maçons sachent lire. Mais le pont tient.

Alors on a bâti de l'autre côté : six maisons, et la grange des Vaudrey, la plus grande bâtisse du village. Les gens de l'autre rive sont des gens de Brumecombe, nul ne le conteste. Simplement, quand la brume est là, le pont est long, et la rive est seule.

# La première veillée

Il n'y a pas de date pour la première veillée non plus ; il y a un récit, que chaque famille tient d'une grand-mère et que personne ne raconte tout à fait de la même façon.

Un automne, la brume tombée, on a trouvé un homme mort dans sa maison, la porte ouverte et le lit déchiré. On a dit : un loup des bois. On a renforcé les portes. La nuit suivante, une autre maison, à l'autre bout du village. Et la porte, cette fois, avait été ouverte par le loquet, de l'intérieur ou par quelqu'un qui savait comment on l'ouvre.

Le village s'est réuni sur la place, dans la brume, et il a compris quelque chose de pire que les loups : que les loups étaient parmi eux. Qu'ils avaient un visage de jour et une faim de nuit. Que personne ne pouvait prouver qu'il n'en était pas. Alors, puisqu'on ne pouvait pas voir, on a décidé de parler. Chacun dirait où il avait dormi, ce qu'il avait entendu, ce qu'il pensait de son voisin. Et le soir, avant que la brume ne reprenne tout, le village désignerait celui qu'il croyait être le loup.

Le premier désigné, dit le récit, était innocent. Le deuxième aussi. Le troisième, quand on l'a mis au gibet, a ri. C'est ainsi que Brumecombe a appris en même temps qu'on pouvait se tromper, et qu'on pouvait avoir raison.

> La première veillée, on l'a faite avec la peur. Les autres, on les a faites avec la peur et une méthode. C'est tout ce qui nous sépare des bêtes.
> — Frère Anselme, un soir de Toussaint

# Les années de loups

Depuis, il y a des automnes sans loups, où la brume tombe et se relève sans qu'une porte s'ouvre, et où l'on veille quand même, par prudence, et parce que c'est devenu une fête autant qu'une peur. Et il y a les années de loups. Les anciens les comptent sur leurs doigts, comme les crues : l'année des trois maisons, l'année où l'on a pendu la tisserande et où les loups ont continué, l'année où le Bailli lui-même a fini au gibet sans que personne sache jamais si l'on avait eu raison.

Et il y a *l'autre automne*, celui dont Mère Ysaline parle en baissant la voix. Un automne où l'on mourait chaque nuit, où l'on a veillé, accusé, pendu, et où il n'y avait pas de loup du tout. C'était une fièvre, venue de l'eau ou des tourbières, qui passait de maison en maison comme une main. Depuis, quand quelqu'un crie sur la place « c'est la peste noire ! », tout le monde se tait, parce qu'il a peut-être raison, et parce que s'il a tort, c'est lui qu'on pendra pour avoir semé la panique.

# Ce que les anciens racontent encore

Que les loups de Brumecombe ne sont pas les loups de la forêt, mais quelque chose que la forêt a laissé dans le sang de certaines familles, il y a longtemps, et qui se réveille avec la brume. Que personne ne choisit d'être loup, et que c'est pour cela qu'il faut pendre sans haine. Que le pont a été construit pour les bêtes, mais qu'il sert surtout, maintenant, à savoir de quel côté on dort. Et que chaque veillée, depuis la première, a été écrite dans un registre, et que le registre n'a jamais brûlé, même quand le moulin brûlait.`
    },
    {
      titre: "Les dix-huit maisons",
      texte: `# On ne dit pas « chez les Corbet », on dit « la Quatre »

À Brumecombe, les maisons ont un numéro, peint à la chaux sur le linteau et repeint chaque automne avant la brume. Cela vient de la Veillée : quand il a fallu, à la première, dire où chacun dormait, le greffier de l'époque a numéroté les maisons d'ouest en est et du nord au sud, pour qu'on puisse dire « la Sept a eu de la visite » sans se tromper de Vaudrey. L'habitude est restée, et avec elle une étrange pudeur : on accuse une maison plus facilement qu'un nom.

Les maisons 1 à 12 sont sur la rive du village. Les maisons 13 à 18 sont sur l'autre rive, de l'autre côté du pont, avec la grange. Une maison de Brumecombe, c'est une pièce basse avec l'âtre, une chambre ou deux, un grenier, une étable sous le même toit pour la chaleur, et des volets pleins, en chêne, qui ferment de l'intérieur avec une barre. Devant la porte, un crochet pour la lanterne du seuil. Sur la porte, des clous.

# De quoi l'on vit

On vit de peu et de tout : des bêtes qu'on monte l'été à la Combe-aux-Sorbiers, du seigle des terrasses de l'autre rive, des pommes du verger, du bois qu'on coupe et du charbon qu'on cuit encore un peu, comme les fondateurs. La rivière donne des truites, et le gué, certaines nuits, des choses qu'on ne mange pas.

Mais un village coupé du monde quatre mois par an a besoin de tous les métiers, et Brumecombe les a tous, ou presque. Chaque maison en tient un, et le village le sait, parce que c'est un savoir qu'on ne peut pas cacher : on entend ${m("forgeron", "le forgeron")} depuis la place, on voit ${m("ramoneuse", "la ramoneuse")} sur les toits, et quand ${m("meuniere", "la meunière")} ne tourne pas, tout le monde manque de pain.

Il y a la forge, à l'ouest de la place, dont la porte ne ferme jamais tout à fait et où l'on va chercher des clous, des verrous, et parfois, l'automne, une lame. Il y a le moulin et sa meunière, qu'on dit capable de sentir dans ses bras quand la meute rôde. Il y a ${m("garde", "le garde du guet")}, avec sa pique et son sifflet, qui garde un villageois à l'œil pour toute une nuit. Il y a ${m("cure", "le curé")} de la chapelle, ${m("chasseresse", "la chasseresse")} qui lit la boue des chemins, ${m("aubergiste", "l'aubergiste")} du Chaudron Fêlé et ses trois lits à l'étage, ${m("apothicaire", "l'apothicaire")} et ses pastilles de sauge qui rendent la voix, ${m("colporteur-de-nouvelles", "le colporteur de nouvelles")} qui sait tout avant tout le monde et le crie plus fort, ${m("tisserande", "la tisserande")} et ses rubans, ${m("passeur", "le passeur")} dont la barque connaît la Brume par cœur, ${m("tanneur", "le tanneur")} qui reconnaît une morsure sur une peau, ${m("maitresse-d-ecole", "la maîtresse d'école")} qui a appris à lire à la moitié du village et que l'autre moitié craint encore, la ramoneuse qui voit tous les seuils du haut des toits, et ${m("eclusiere", "l'éclusière")} qui règle le niveau de la rivière et peut, en fermant ses vannes, noyer le gué pour une nuit.

Le métier est public, et c'est une règle plus ancienne que la Veillée : on ne cache pas ce qu'on fait de ses mains. Ce qu'on fait de ses nuits, c'est autre chose.

# Le marché, le lavoir, la taverne

Le marché se tient sur la place, le jeudi, autour du puits : trois ou quatre étals, le fromage des pâtures, les pommes, les clous. Dans la brume, il continue, plus serré, à la voix : « qui est là ? », « la Onze ». On y apprend plus de choses qu'on n'y achète.

${b("lavoir", "Le lavoir")}, couvert, au bord de la rivière, est le second lieu où le village se raconte. Odile Basquin y lave le linge de tout le monde, et donc elle sait tout : les draps changés deux fois dans la semaine, la chemise déchirée, la manche qu'on a frottée trop fort. Ce qu'on dit au lavoir n'est jamais tout à fait faux. Ce n'est jamais tout à fait précis non plus.

${b("taverne", "La taverne")} du Chaudron Fêlé, au bord de la place, est la seule maison du village où l'on parle à voix haute après la nuit tombée. Gaspard Lerouge ne sert plus après le couvre-feu, mais il laisse la lampe allumée et le feu ne s'éteint jamais. Il y a trois lits à l'étage, et les années de loups, il se trouve toujours trois villageois pour vouloir y dormir ensemble, sur la foi d'un vieux dicton : *la meute n'entre pas où l'on dort à trois.* Le dicton a une fin que les prudents connaissent : *sauf si elle y dort déjà.*

# Les rivalités

Les Vaudrey et les Corbet ne se parlent plus depuis une histoire de bornage sur l'autre rive, vieille de deux générations, et chaque automne, quand il faut désigner quelqu'un, les deux familles s'en souviennent avec beaucoup de précision. Les gens de la place trouvent ceux de l'autre rive secrets ; ceux de l'autre rive trouvent ceux de la place bavards, et disent que les loups, s'il y en a, dorment près de la taverne, parce que c'est là qu'on ment le mieux. Et il y a les rivalités qu'on ne dit pas : celles qui viennent d'une veillée passée, d'un vote où l'on a vu, au dépouillement, qui avait écrit quel nom.

Tout cela fait de Brumecombe un village normal : un village où l'on a toujours une bonne raison d'accuser son voisin, et où cette raison n'a souvent rien à voir avec les loups.`
    },
    {
      titre: "La foi et les superstitions",
      texte: `# La chapelle

${b("chapelle", "La chapelle")} est au nord de la place, en pierre grise, avec son clocher trop haut et sa porte qui n'a jamais eu de serrure. Frère Anselme y dit l'office du dimanche et sonne la cloche deux fois le jour : à l'aube, pour dire que la nuit est finie et que l'on peut ouvrir, et au couvre-feu, pour dire qu'il faut fermer. Les années de brume, ces deux coups de cloche sont le seul moyen qu'a le village de savoir l'heure, et de savoir qu'il est encore ensemble.

La foi de Brumecombe est simple et ancienne. On y mêle sans gêne ce que le curé enseigne et ce que les grands-mères savaient avant lui. On allume des cierges pour les morts de l'année. On fait bénir les clous. On ne laisse jamais la porte de la chapelle fermée, parce que, dit-on, *une porte fermée ne protège que de ce qui frappe*, et ce que l'on craint ne frappe pas.

Depuis les années de loups, la chapelle est aussi un asile. Celui que le village y envoie dormir, d'un vote rapide, à main levée, après le grand vote du jour, y passe la nuit sous l'autel, avec une chandelle. On dit que la meute n'y entre pas. On ne dit pas pourquoi : certains croient que c'est la pierre bénite, d'autres que c'est la lumière, d'autres encore que c'est simplement parce que tout le village sait qui y dort et que les loups, qui sont du village, n'aiment pas être attendus.

# Les lanternes

Chaque maison a sa lanterne de seuil, qu'on allume à la cloche du soir et qu'on laisse brûler jusqu'à l'aube. Ce n'est pas pour y voir : dans la brume, une lanterne n'éclaire que la brume. C'est pour être vu, pour dire « ici, on veille », et pour que ceux qui passent sachent qu'ils passent devant une maison et pas devant une tombe. Une lanterne éteinte avant l'aube est un mauvais signe, et l'on va frapper.

Il y a une autre lanterne, dont on parle à mi-voix : celle de la veilleuse. Dans chaque génération, dit-on, il y a une femme, parfois un homme, qui marche la nuit avec sa lampe et devant qui la brume s'écarte. Elle choisit une porte, elle y pose sa lumière, et si un loup entre par cette porte cette nuit-là, au matin tout le village sait son nom. Les enfants disent que la veilleuse est toujours vieille. Les anciens disent que non.

# Les cendres

Le soir, avant de couvrir le feu, on lisse les cendres de l'âtre avec le dos de la pelle. Au matin, on regarde. Un pas de bête, une forme, une griffure : on dit que les cendres gardent ce qui est passé devant l'âtre pendant la nuit. La plupart des gens n'y voient rien. Quelques-uns y voient quelque chose, et c'est à eux qu'on demande, l'automne, de lire pour les autres. On ne les croit pas toujours. On les écoute toujours.

# Le sel, les clous, le sorbier

Sur chaque seuil, à la tombée de la brume, on verse une ligne de sel. Cela ne sert à rien contre les loups, le village le sait depuis longtemps, mais le sel dit la ligne, et la ligne dit : jusqu'ici, c'est chez moi. On ne la franchit pas sans frapper.

Les clous de la forge, plantés dans la porte, en croix ou en rangée, sont la vraie protection, celle en laquelle on croit. Un clou forgé un vendredi et refroidi dans l'eau de la Brume tient le loquet, disent les uns ; tient le loup, disent les autres. Le forgeron, lui, dit qu'un verrou vaut mieux que douze clous, et chaque automne il en forge un, un seul, qu'il donne à la maison qui le lui demande le plus fort, et tout le village sait laquelle.

Le sorbier, enfin. Il y en a au cimetière, qui ne perdent jamais toutes leurs baies, et dans la combe du haut qui porte leur nom. On en accroche une branche au-dessus de la porte, le jour de la Toussaint, et on la laisse jusqu'au printemps. Personne n'a jamais vu un loup reculer devant un sorbier. Personne n'a jamais retiré la branche non plus.

> Le sel, c'est pour nous. Les clous, c'est pour la porte. Le sorbier, c'est pour pas avoir à choisir.
> — Mahaut Lenoir, la vieille Mahaut

# Les présages

Il y a enfin l'almanach, que Mère Ysaline tient de mémoire et que le greffier a fini par écrire. Il dit ce que l'aube annonce : un ciel clair, une nuit de givre où les serrures prennent, une crue qui coupe le pont, la lune couchée rousse sur les toits. Chaque signe a son sens, et chaque sens change un peu la journée. Il ne dit jamais qui est loup. Il dit seulement comment le jour s'y prendra pour le découvrir.`
    },
    {
      titre: "La Meute dans les contes",
      texte: `# Ce que le village croit savoir

Ce qui suit n'est pas une science. C'est ce que l'on raconte à Brumecombe, à la veillée, au lavoir, et aux enfants pour qu'ils rentrent avant la cloche. Une partie est vraie. Une partie ne l'est pas. Le village n'a jamais réussi à faire la part des deux, et les loups, naturellement, ne l'y aident pas.

# Ils ont un visage

On dit que les loups de Brumecombe sont des gens de Brumecombe. Le jour, ils moulent le grain, tannent les peaux, pleurent aux enterrements et votent à la veillée. On dit qu'ils se reconnaissent entre eux, à l'odeur ou au regard, dès la première nuit de brume ; qu'ils chassent ensemble, qu'ils se concertent, et qu'ils choisissent chaque nuit une seule porte. Là-dessus, le village ne se trompe pas.

# Ils ont des noms

Les contes donnent aux loups des noms, comme aux vents. ${r("loup-de-brumecombe", "Le loup de Brumecombe")} est le loup ordinaire, celui qui a un voisin le jour et une faim la nuit. ${r("loup-affame", "L'affamé")} ne s'apaise jamais : on dit qu'une nuit sur deux, après la chasse de la meute, il ressort seul. ${r("louve-mere", "La louve mère")} est la plus vieille et la plus redoutée, parce qu'elle ne tue pas toujours : elle mord, et le mordu se réveille des leurs, sans que rien ne paraisse. ${r("loup-hurleur", "Le hurleur")} crie dans la brume, et celui qui l'a entendu de trop près se lève au matin sans voix, pour toute une journée. ${r("loup-flaireur", "Le flaireur")} lit les seuils et sait, en reniflant une porte, de quel camp est celui qui dort derrière. ${r("loup-des-roseaux", "Le loup des roseaux")} ne chasse pas mieux que les autres, mais il attend, dans les roseaux entre le pont et le moulin, et il voit qui sort de chez soi. Et il y a ${r("loup-deguise", "le déguisé")}, dont on parle le moins parce qu'on en a le plus peur : celui qui porte, dit le conte, *un visage d'emprunt cousu de patience*, et que même les cendres ne trahissent pas, tant qu'on ne l'a pas désigné une fois en face.

Les contes disent-ils vrai ? Ceux qui ont vécu plusieurs années de loups affirment que chaque nom correspond à quelque chose qu'ils ont vu. Mais ils ajoutent qu'on n'a jamais vu tous ces loups le même automne, et qu'on ne sait jamais, en début de veillée, lesquels sont descendus de la forêt cette année-là.

# Ce qui les arrête, dit-on

On dit qu'ils n'entrent pas dans une maison dont ${r("gardienne-des-cles", "la gardienne des clés")} a tourné la clé, mais que celui qui y dort n'en sort pas non plus. On dit qu'ils reculent devant ${r("garde-du-pont", "le garde du pont")} quand il veille sur une porte, et qu'ils n'entrent pas à la chapelle quand le village y a mis quelqu'un. On dit que le verrou du forgeron fait échouer leur première attaque, et que s'ils entrent dans la maison que la veilleuse éclaire, ils sont perdus. On dit que la meute ne traverse pas le pont deux nuits de suite : que si elle a tué sur l'autre rive, la nuit suivante, elle reste de ce côté-ci. Ceux de l'autre rive comptent là-dessus. Ceux de la place aussi, dans l'autre sens.

On dit aussi des choses que le village ne vérifie jamais. Que le sel les brûle : c'est faux, et tout le monde le sait, et tout le monde en met. Que le sorbier les fait reculer : personne n'a vu. Qu'ils sont toujours trois : les années de loups n'ont jamais eu le même compte, et la meunière le sait mieux que personne. Qu'ils ne chassent pas la première nuit : certaines années, c'est vrai, et c'est précisément ces années-là qu'on a eu tort de le croire. Qu'un loup ne peut pas mentir sous le clocher : on a pendu des innocents sous le clocher. Qu'ils ne saignent pas : le forgeron, qui a vu du sang de bête sur un seuil au matin, dit que si.

# Ce que les loups savent, dit-on

Le plus troublant de ce qu'on raconte, c'est que les loups connaissent le village mieux que le village ne se connaît. Qu'ils savent quels visages personne ne porte, cette année-là, et qu'ils s'en servent : se dire liseuse quand il n'y a pas de liseuse, gardienne quand il n'y a pas de gardienne. Qu'ils écoutent ce qu'on dit sur la place avec plus d'attention que n'importe qui, parce qu'ils ont plus à y perdre. Et que c'est pour cela que le village a fini par préférer les faits aux cris : qui a dormi où, qui est sorti, qui a changé d'avis au vote.

> On n'attrape pas un loup en lui faisant peur. On l'attrape en l'ennuyant : on compte, on recompte, on demande encore. Un loup, ça se fatigue de mentir avant qu'un honnête homme se fatigue de dire vrai.
> — Honoré Bellefeuille, Bailli sortant`
    },
    {
      titre: "La Veillée, une coutume",
      texte: `# Pourquoi l'on se réunit

La Veillée est la réponse de Brumecombe à la brume. Puisqu'on ne peut pas voir, on parle ; puisqu'on ne peut pas savoir, on décide. Elle commence le jour où la vallée met son couvercle, ou le lendemain de la première porte ouverte, et elle dure tant qu'il reste des loups à trouver, ou des gens pour les chercher. Ses lois ne sont écrites que dans le registre, et chacun les connaît comme il connaît le chemin du puits.

# Le soir : la cloche et les volets

Au couvre-feu, Frère Anselme sonne. On rentre les bêtes, on allume la lanterne du seuil, on verse le sel, on barre les volets. Puis on se tait. C'est la première loi de la Veillée, et la plus vieille : la nuit, personne ne parle. Ce qu'on entend la nuit, on le garde pour le matin. Ceux qui ont quelque chose à faire la nuit, et il y en a, de l'un et l'autre camp, le font sans un mot.

# L'aube : les morts

À la cloche de l'aube, on ouvre, et on compte. On va frapper aux lanternes éteintes. On trouve, ou on ne trouve pas. Le village se rassemble autour du puits, et le greffier note : telle maison, tel mort, et ce qu'on en sait, ce qui est souvent peu. Un mort de la nuit est *tué dans la nuit* ; on n'écrit pas plus que ce que tout le monde a vu. Selon les années, on dit au village ce que le mort était ; d'autres années, on l'enterre sans rien dire, et il faut le fossoyeur, ou le cimetière lui-même, pour qu'on le sache. Le tanneur, s'il examine le corps, dit s'il y a eu des crocs. Le lavoir, s'il a bavardé, dit ce qu'il a entendu.

Les morts ne parlent plus aux vivants. C'est la seconde loi, et l'on y tient plus qu'à toutes les autres : un mort qui parlerait saurait des choses que les vivants ne doivent pas savoir. On leur laisse une voix, une seule, qu'on appelle le dernier souffle, pour un vote de leur choix ; après quoi ils se taisent pour de bon et regardent. Et quand ${b("puits", "le puits")} est en jeu, le premier mort qui le demande peut y confier dix mots, pas un de plus, que le greffier lit à tous.

# Le jour : la parole

Puis on parle. C'est le débat, et il a son rituel. On se tient en cercle autour du puits ; on prend la parole en nommant sa maison ; on dit ce qu'on a vu, ce qu'on croit, ce qu'on reproche. On ment, si l'on veut : la Veillée n'interdit pas le mensonge, elle le suppose. Ce qu'elle interdit, c'est d'en sortir : de montrer un papier, d'apporter une preuve qui vient d'ailleurs que de sa propre bouche. On n'attaque pas une personne, on attaque une maison et ce qu'elle a fait. Et chacun peut faire inscrire au registre, trois fois le jour, une déclaration : « je dis que la Quatre est du village », « je dis que je suis la liseuse ». Le greffier l'écrit. Il ne vérifie rien. Ce qu'on a fait écrire vous suit.

# Le Bailli

Le premier jour de la Veillée, avant tout autre vote, le village élit son Bailli. Chacun nomme qui il veut, soi-même compris ; le plus nommé reçoit le sceau, un cachet de plomb sur un cordon de cuir, que le greffier garde d'une année sur l'autre. Le Bailli ne commande pas : il tranche. Sa voix compte double au vote. Quand deux maisons ont le même nombre de voix, c'est lui qui désigne, ou qui refuse de désigner, et alors personne ne monte au gibet ce jour-là. Quand il meurt, et il meurt souvent, car tout le monde sait qui il est, il remet le sceau de sa main à qui il veut ; s'il n'en a pas eu le temps, le village réélit. Un Bailli peut être un loup. Le village l'a choisi.

> Le sceau, ça ne pèse rien. C'est ce qu'il y a au bout du cordon qui pèse.
> — Honoré Bellefeuille, le jour où il l'a rendu

# Le vote

Vers le soir, avant la cloche, on vote. Chacun écrit un nom sur un bout d'ardoise et le remet au greffier ; on peut en changer jusqu'à ce que le greffier ferme sa boîte. Nul ne voit les ardoises avant le dépouillement : on voit seulement qui a déjà remis la sienne. Puis le greffier lit, voix par voix, et le village entend qui a écrit quel nom. C'est la troisième loi : le vote est secret jusqu'à ce qu'il soit public. Le plus nommé monte au gibet. S'il porte au poignet le ruban de la tisserande, on lui laisse une minute, une seule, pour parler encore. Si le juge de paix se lève et annule, on recommence sur-le-champ, sans débat. Les années où ${b("gibet", "le gibet")} est dressé au coin de la place, il faut plus de la moitié des vivants pour pendre ; les autres années, le plus de voix suffit.

Il y a des années où l'on vote autrement : celles du banc des accusés, où chacun accuse une fois et où les accusés sont jugés l'un après l'autre ; celles du glas, où chaque innocent pendu fait sonner la cloche, et où la meute, on ne sait comment, en tire quelque chose. Le greffier annonce la coutume de l'année avant la première nuit. Il n'y revient plus.

# Le gibet

${b("gibet", "Le gibet")} est en chêne noirci, au coin de la place. On ne s'en sert presque jamais, dit le village, et c'est déjà trop. Celui qu'on y mène a droit à ses derniers mots, et on les écoute. Si c'était un loup, le village respire une nuit. Si ce n'en était pas un, personne ne s'excuse : la Veillée ne demande pas pardon, elle demande de recommencer. Il y a une exception, et elle est grave. Si la rosière de l'année, celle qui porte la couronne et que tout le village a juré de garder, est pendue par le village, la Veillée s'arrête : le serment est rompu, et Brumecombe a perdu. On y pense à deux fois avant de pendre une femme qui se dit rosière. On y pense trois fois avant de la croire.

# La fin

La Veillée s'arrête quand il n'y a plus de loup, et le village le sait parce que la brume, cette nuit-là, ne frappe à aucune porte. Elle s'arrête aussi, les mauvaises années, quand les loups sont aussi nombreux que ceux qui restent : alors il n'y a plus de vote qui tienne, et Brumecombe s'endort pour ne plus se réveiller. Entre les deux, il y a tous les automnes de Brumecombe, et le registre les garde tous.`
    },
    {
      titre: "Une année à Brumecombe",
      texte: `# Le calendrier des fêtes

Brumecombe compte l'année par ses fêtes plus que par ses mois, et chaque fête a sa part de veillée, parce que dans ce village on ne sait pas se réunir sans se demander qui, dans le cercle, n'est pas ce qu'il paraît.

# La Fête des promis, à la mi-février

Quand la Brume est prise et que la brume, elle, est retombée sur l'eau, les jeunes gens descendent sous le pont nouer des rubans aux piles de pierre, et se promettent l'un à l'autre devant la rivière. On mange le pain d'épice en cœur, on chante faux, on rougit. Les promesses se font à voix basse, et on ne les dit pas aux parents avant Pâques. Les années où la fête tombe pendant une veillée, le village se souvient que les roseaux ont des yeux, et que deux promis qui se taisent sont deux proies faciles à nommer.

# Le Carnaval des masques, au Mardi gras

On défile, masqués, derrière le mannequin de paille qu'on brûlera au soir sur la place. Crécelles, beignets, farine jetée aux passants : pour un jour, le village marche sur la tête et personne n'est tout à fait soi. Le mannequin porte toujours un visage que personne au village ne porte, et c'est la seule règle du défilé : on ne se déguise pas en son voisin. On raconte qu'un masque de trop circule chaque année, et que celui qui le porte trompe jusqu'aux cendres. Une fois.

# Le printemps et l'été

À la Saint-Jean, on allume un feu sur la butte du moulin et l'on couronne la rosière de l'année : une jeune fille du village, choisie pour sa réputation, à qui l'on remet une couronne de roses et le serment de tous. C'est une fierté, et c'est un poids : l'automne venu, elle est celle qu'on ne peut pas pendre sans se perdre. Puis viennent les foins, la moisson sur l'autre rive, la fête des moissons et son air qu'on siffle, et le marché d'été où passent les gens de passage : ${r("remouleur", "un rémouleur")} et sa meule à pédale, ${r("montreur-d-ours", "un montreur d'ours")} dont la bête danse sur la place et dort en travers des seuils, ${r("pelerine", "une pèlerine")} en route vers un sanctuaire lointain. Brumecombe les accueille, les nourrit, et les regarde partir avant la brume. Ceux qui arrivent après la brume, on les accueille aussi. On les regarde davantage, et le village peut, d'un vote, les remettre sur le chemin : on appelle cela l'exil, et ce n'est pas une mort.

# L'automne : la Veillée

Fin septembre, la vallée met son couvercle. On repeint les numéros, on remonte les bêtes, on rentre le bois, on fait bénir les clous. Le greffier sort le registre et le sceau. Et la Veillée commence, qui tient tout l'automne, et dont les lois sont dites à la page précédente.

# La Nuit des âmes, dernière nuit d'octobre

On creuse des navets, on y pose une chandelle, on les aligne sur les rebords des fenêtres pour que les morts de l'année retrouvent le chemin du coin du feu, et l'on laisse les portes entrebâillées, cette nuit-là seulement. On ne leur parle pas : on les écoute. Les vieilles disent que les âmes ne mentent jamais, et qu'elles murmurent des choses vraies à ceux qu'elles choisissent. Elles disent aussi qu'elles frappent fort, et que dans la brume, les loups entendent toutes les portes. La Toussaint, au matin, on accroche le sorbier.

# La Saint-Martin, le onze novembre

On tue le cochon, on boit le vin nouveau, et le village se donne une veillée courte, en une seule nuit, pour les enfants et pour les soirs où l'on n'a pas le cœur à un automne entier. Frère Anselme cache sous l'autel trois rôles de plus qu'il n'y a de gens dans le cercle, et personne ne sait lesquels dorment là ; on veille une nuit, on parle un matin, on vote une fois. Pendre un loup sauve le village. Épargner un loup le perd. Et pendre un innocent quand il n'y avait pas de loup du tout laisse la brume l'emporter.

# La Veillée d'hiver, au plus froid

Les premières neiges tassent la brume ; le vrai froid la fait retomber. Alors Brumecombe allume le grand feu sur la place et veille jusqu'au premier chant du coq, en buvant le vin chaud aux épices et en chantant les complaintes de la rivière gelée. Cette nuit-là passe la Dame aux grelots. Personne ne l'a jamais vue ; on entend seulement ses grelots dans la neige, et au matin, sur un seul seuil du village, il y a un présent. Celui qui le trouve ne le dit pas toujours. La neige, elle, a souvent effacé les traces de la nuit, et ceux dont le métier est de lire la boue attendent un matin sans neige.

Puis la Brume prend, le chemin du nord se rouvre, le colporteur revient, et Brumecombe redevient, jusqu'au prochain automne, un village comme un autre, qui compte ses morts et repeint ses linteaux.`
    },
    {
      titre: "Visages de Brumecombe",
      texte: `# Ceux qu'on ne joue pas

Les dix-huit maisons sont à vous. Mais un village ne tient pas qu'à ses maisons, et il y a des gens de Brumecombe qui ne sont d'aucune maison numérotée, ou qui n'y dorment plus : ils tiennent la chapelle, la taverne, le registre, le banc du puits. Ils ne sont pas dans le cercle au vote. Ils en sont le décor, la mémoire, et parfois le témoin.

# Frère Anselme, le curé

Un vieux prêtre au dos voûté, qui connaît chaque famille depuis trois générations et chaque péché depuis un peu moins. Il sonne la cloche à l'aube et au couvre-feu et ne ferme jamais la porte de sa chapelle. Il bénit les clous sans y croire tout à fait, et il veille les morts sans leur poser de questions. Il a vu plus de veillées que n'importe qui en vie, et quand on lui demande ce qu'il en pense, il répond que Dieu voit tout et que c'est bien dommage qu'il ne vote pas.

# Gaspard Lerouge, l'aubergiste

Gros, rieur, et plus attentif qu'il n'en a l'air. Il tient le Chaudron Fêlé, ses trois lits, et son feu qui ne s'éteint jamais. Il ne sert plus à boire après le couvre-feu, mais il laisse la lampe allumée, et il se souvient de qui a payé sa tournée avec quelle pièce. Il a une opinion sur chacun, et il la garde pour lui.

# Hugon Ravier, le vieux meunier

Il a tenu le moulin cinquante ans et l'a remis à qui le tourne aujourd'hui, mais il monte encore chaque matin sur la butte regarder les ailes, qui tournent, dit-il, même sans vent, parce que la brume pousse. Il parle peu, et toujours du temps, sauf quand ce n'est pas le cas, et alors on l'écoute.

# Honoré Bellefeuille, le Bailli sortant

Il a porté le sceau l'automne dernier, jusqu'au bout, ce qui est rare, et l'a rendu au greffier le dernier jour sans un mot de plus que « voilà ». On ne sait pas s'il a bien tranché. On sait qu'il a tranché, chaque fois, sans trembler, et que deux familles ne lui parlent plus. Il dit qu'il ne se présentera pas cette année. Il le disait aussi l'an dernier.

# Sylvestre Pradel, le greffier

Il tient le registre, la boîte aux ardoises et le sceau entre deux veillées. Il écrit tout ce qui est public et rien d'autre. Il ne vérifie jamais une déclaration ; il la note, avec le nom de celui qui l'a faite, et il dit que c'est bien assez. Il n'a jamais voté, par principe. Il connaît tous les votes de tous les automnes, par métier.

# Mère Ysaline, la doyenne

La plus vieille du village. Elle passe ses journées sur le banc près du puits et se souvient de « l'autre automne », celui dont personne ne veut parler, celui où l'on a pendu sans qu'il y ait de loup. Elle tient l'almanach de mémoire. Elle ne nomme jamais personne. Elle dit : « la Sept, cette année, a une drôle de lanterne », et elle regarde ailleurs.

# Bastien Grenier, garde du guet

Il fait la ronde avec sa pique et son sifflet, et ne siffle jamais. On le voit souvent appuyé au parapet du pont, à regarder la brume. Il dit qu'il a vu, une nuit, une lanterne traverser le pont et ne pas revenir. Il n'a pas dit dans quel sens.

# Odile Basquin, lavandière

Elle lave le linge de tout le village et sait donc tout : qui a déchiré sa chemise, qui a du sang sur ses manches, qui a changé de draps deux fois cette semaine. Elle le dit au lavoir, à qui est là, sans jamais donner le nom tout de suite. Le nom vient plus tard, quand l'eau est froide.

# Mahaut Lenoir, la vieille Mahaut

Elle habite au bord du cimetière, nourrit les corbeaux, et jure qu'ils se posent toujours sur le même toit. Elle vend, à la sortie de la messe, des amulettes de sorbier qui se vendent très bien. Elle est la seule du village à dire tout haut qu'une des familles de Brumecombe a eu un loup parmi les siens, il y a trois générations. Elle ne dit pas laquelle. Elle en est peut-être.

# Le petit Colin

Huit ans, et partout. Il colle son oreille aux portes, court sur le pont, descend au gué quand on le lui interdit, et raconte ce qu'il a vu à qui veut l'entendre, en inventant le reste. Une partie de ce qu'il raconte est vraie. On ne sait pas laquelle, et lui non plus.

# Noiraude, la chienne des Vaudrey

Une chienne de berger, noire, qui dort devant la grange de l'autre rive. Elle aboie à chaque passant. Sauf, ces derniers temps, à un seul.`
    },
    {
      titre: "Rumeurs et mystères",
      texte: `# Ce qu'on se dit à mi-voix

Un village dans la brume vit de rumeurs comme de pain. En voici dix, de cet automne, telles qu'on les entend au lavoir, à la taverne ou sur le banc du puits. Elles se glissent dans un débat qui s'essouffle. Elles ne prouvent rien. Trois au moins sont fausses, et le village ne sait pas lesquelles ; le narrateur, lui, ne le dira jamais.

- **La lanterne du pont.** Bastien Grenier a vu une lanterne traverser le pont après minuit, et ne l'a pas vue revenir. Il dit qu'elle allait vers l'autre rive. Ceux de l'autre rive disent que non.
- **Le chien qui ne mange plus.** Noiraude n'aboie plus depuis trois nuits, et ne touche plus à sa gamelle. Les Vaudrey disent qu'elle est vieille. Mathurin Vaudrey, lui, a cloué deux clous de plus sur sa porte.
- **Le sac de farine.** On dit que la meunière compte ses sacs deux fois, et qu'il en manque toujours un. On dit aussi que quelqu'un, la nuit, nourrit quelque chose.
- **Les volets ouverts.** Une maison de l'autre rive a laissé ses volets ouverts toute la nuit. Par oubli, disent les uns. Pour guetter, disent les autres. Pour sortir, dit le petit Colin.
- **La serrure de la sacristie.** Frère Anselme a changé la serrure de la sacristie, lui qui ne ferme jamais la chapelle. Il n'a pas dit pourquoi. On n'a pas osé demander.
- **La pièce qui sentait la terre.** À la taverne, quelqu'un a payé sa tournée avec une pièce qui sentait la terre mouillée. Gaspard Lerouge l'a gardée. Il ne dit pas à qui il l'a prise.
- **Les poils de la haie.** On a retrouvé des touffes de poils gris accrochées à la haie du lavoir, à hauteur d'homme. Le tanneur dit que c'est du chien. Odile Basquin dit que le tanneur n'a pas regardé longtemps.
- **La lame sans manche.** Quelqu'un a demandé à la forge une lame courte, sans manche, « pour couper le pain ». Le forgeron l'a faite. Il ne dit pas pour qui.
- **La poignée de main.** Deux voisins qui ne se parlaient plus depuis dix ans ont été vus se serrer la main sur la place, à l'heure où l'on rentre les bêtes. Depuis, ils ne se parlent plus de nouveau.
- **Le loup dans la famille.** La vieille Mahaut jure qu'une famille de Brumecombe a déjà eu un loup parmi les siens, il y a trois générations, et qu'on n'a jamais dit laquelle. Chaque famille est sûre que ce n'est pas la sienne.

# Les mystères qui restent

Il y a aussi ce que le village n'explique pas. Le puits, où ceux qui se penchent entendent parfois leur nom. La cloche, qui a sonné un coup, seule, une nuit où personne ne la tirait. Le moulin, qui tourne sans vent. Le registre, qui n'a jamais brûlé. Et le gué, où une femme pâle lave son linge quand la brume monte, et où ceux qui descendent l'aider ne remontent pas. On le dit aux enfants pour qu'ils n'y aillent pas. On ne le dit pas aux adultes, parce qu'eux, ils y vont quand même.`
    },
    {
      titre: "Le parler de Brumecombe",
      texte: `# Un lexique

On parle à Brumecombe comme ailleurs dans les combes, avec des mots que la brume a usés et quelques-uns qu'elle a faits. En voici quinze, qu'on entendra sur la place dès la première veillée.

- **La Brume, la brume.** Avec la majuscule, la rivière. Sans, ce qui en monte. « La Brume est haute » parle d'eau ; « la brume est tombée » parle de l'automne, et c'est une mauvaise nouvelle.
- **Mettre le couvercle.** Ce que fait la vallée à la fin de septembre, quand la brume ne se lève plus. « Depuis que la vallée a mis son couvercle » veut dire : depuis le début de la Veillée.
- **La Quatre, la Onze, la Dix-sept.** Les maisons, par leur numéro. On dit « la Quatre a eu de la visite » et chacun comprend. On ne dit le nom qu'au gibet.
- **L'autre rive.** Les maisons 13 à 18 et la grange, de l'autre côté du pont. Pour ceux de l'autre rive, l'autre rive, c'est la place. Cela fait deux « autres », et jamais un « ici ».
- **Avoir de la visite.** Avoir reçu quelqu'un, la nuit, qui n'a pas frappé. Un loup, ou autre chose : la ramoneuse voit la visite, elle ne voit pas le visiteur.
- **Être sorti.** Avoir quitté sa maison la nuit, pour quelque raison que ce soit. On ne demande pas pourquoi au lavoir. On le demande sur la place.
- **Lire les cendres.** Deviner, au sens large : « il lit les cendres, celui-là » se dit de quelqu'un qui en sait trop. Au sens propre, c'est le don de la liseuse, et l'on ne plaisante pas avec.
- **Faire le roseau.** Guetter sans être vu, rester dans l'ombre d'un débat et attendre. On le reproche. On le fait.
- **Un masque.** Un menteur, ou ce qu'il porte. « C'est un masque » se dit d'un argument trop beau, d'un alibi trop net, d'un villageois qui se réclame d'un don qu'il n'a pas.
- **Le dernier souffle.** La voix qu'un mort garde pour un vote, une seule. « Il a soufflé » veut dire qu'il l'a rendue. « Il souffle encore » veut dire qu'il faut se méfier du dépouillement.
- **Embrumé.** Perdu, confus, qui ne sait plus où il a dormi. Se dit d'un ivrogne, et d'un villageois qui change d'avis trois fois dans un débat.
- **Mettre au Registre.** Faire inscrire une déclaration chez le greffier. « Je te mets au Registre » est une menace ; « je me mets au Registre » est un serment, qui n'engage que celui qui le fait.
- **Aller au gué.** Disparaître. Mourir, parfois, sans qu'on sache comment. « Il est allé au gué » se dit à voix basse, et l'on ne précise pas.
- **Un sans-cloche.** Un étranger, un gens de passage : quelqu'un qui n'a pas entendu la cloche de l'aube de Brumecombe assez de fois pour qu'on sache ce qu'il vaut.
- **Veiller.** Tout à la fois : rester éveillé, se réunir, débattre, voter, et attendre que l'automne finisse. « On veille » est la phrase la plus courte et la plus lourde du village.`
    },
    {
      titre: "La première veillée",
      texte: `# Le soir où la brume est tombée

Cela s'est fait comme chaque année, et comme chaque année, personne n'était prêt.

Le matin, encore, on voyait le clocher. Vers midi, la Brume a fumé plus blanc que d'ordinaire, et la vapeur, au lieu de se défaire sur les berges, s'est mise à monter dans les ruelles, à prendre la place par le bas, comme une eau. À trois heures, le moulin n'était plus qu'une tache sur la butte. À quatre, il n'y avait plus de butte. Hugon Ravier est redescendu sans rien dire, et il a fermé la porte de la forge en passant, parce que le forgeron ne la ferme jamais tout à fait.

On a repeint les derniers numéros à la hâte. La Quatorze avait attendu trop longtemps ; sa chaux coulait sur le linteau, et le petit Colin a dit que ça faisait un visage. On a rentré les bêtes. On a versé le sel. Sur l'autre rive, Mathurin Vaudrey a cloué un clou de plus, et Noiraude l'a regardé faire sans aboyer.

Puis la cloche a sonné le couvre-feu, deux coups lents, et le village s'est tu d'un seul coup, comme on souffle une chandelle.

# La cloche, les volets

Il y a un moment, chaque soir d'automne, entre le dernier coup de cloche et le premier volet qui se ferme, où Brumecombe est tout entier dehors et tout entier silencieux. On se voit, de seuil à seuil, pour la dernière fois de la journée. On compte. On regarde qui regarde. Ce soir-là, Gaspard Lerouge, sur le pas du Chaudron Fêlé, a levé sa lampe comme pour dire bonsoir, et l'a baissée sans le dire. Bastien Grenier a fait sa ronde jusqu'au pont et s'est arrêté au parapet, plus longtemps que d'habitude. Odile Basquin a remonté son linge du lavoir, et elle a eu l'air de compter les draps.

Puis les volets. Le premier, c'est toujours la Deux, qui a des enfants. Après, on ne sait plus : un claquement, un autre, la barre qu'on pousse, et le bruit se perd dans la brume avant d'avoir fini d'être un bruit. Les lanternes des seuils, une à une, ont fait leurs taches rousses dans le blanc. Dix-huit taches, ce soir-là. On les a comptées depuis la chapelle, Frère Anselme et le greffier, et le greffier a écrit : *première nuit, dix-huit lanternes*.

# La nuit

De ce qui s'est passé cette nuit-là, le village ne sait que ce que chacun en a entendu de son lit, et chacun a entendu quelque chose.

La Brume, d'abord, qui parlait plus fort que d'habitude, comme si l'eau avait quelque chose à dire sous le pont. Un chien, du côté de la grange, qui a commencé à aboyer et qui s'est arrêté net. Un pas, peut-être, dans la ruelle de la forge, un pas lourd et lent, qui n'était pas un pas de sabots. Le petit Colin jure avoir entendu chanter, très loin, du côté du gué. Mère Ysaline, qui ne dort plus, dit qu'à un moment la brume est devenue plus épaisse, puis plus mince, comme si quelque chose de grand était passé entre la chapelle et le puits.

Et puis le cri. Un seul, bref, du côté de l'autre rive ou du côté de la place, on ne s'accorde pas, et le silence après, qui a duré jusqu'à l'aube.

# L'aube

La cloche. On ouvre. On compte.

Dix-sept lanternes. La dix-huitième s'était éteinte avant l'aube, et la porte, en dessous, battait au vent qu'il n'y avait pas. On y est allé à plusieurs, le forgeron devant, avec un marteau qu'il n'a pas eu à lever. On est ressorti sans rien dire.

Sur la place, autour du puits, le village s'est mis en cercle, et le greffier a ouvert le registre à une page blanche. Il a écrit la date, qu'on n'écrit jamais sur le pont mais toujours dans le registre. Il a écrit le numéro de la maison, et *tué dans la nuit*, et rien d'autre, parce qu'on ne sait rien d'autre. Puis il a levé la tête, et il a dit la phrase qu'on dit chaque année, et qui ouvre la Veillée :

« Le village a perdu quelqu'un. Il est temps de parler. »

Et Brumecombe a parlé. Ce qu'il a dit, qui il a cru, qui il a nommé au soir, et s'il a eu raison, ce livre ne le raconte pas. C'est votre automne. Fermez les volets.`
    }
  ]
});
