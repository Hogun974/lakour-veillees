// Les rôles secrets des Veillées de Brumecombe : la Meute, le Village et les solitaires. Textes originaux.
// Ordre de nuit (petit = tôt) : l'Entremetteuse et les rôles qui préparent la nuit d'abord, les protections avant la
// meute (40), les rôles qui réagissent à la victime juste après, les informations à la fin, le Fossoyeur en dernier.
// Tous les loups se réveillent ensemble à 40 pour choisir la victime de la meute ; un loup dont l'ordre n'est pas 40
// se réveille EN PLUS, seul, à son ordre, pour son pouvoir propre.
// Le Pacte, étape 3a (docs/plan-le-pacte.md) : les rôles du Village du jeu de soirée, placés dans l'ordre d'appel du livre entre nos
// ordres : le Furet après l'Entremetteuse (7), les Lavandières et les Bûcherons après le Messager (11, 12), la Pie juste après la
// chasse (46). Leurs règles vivent dans le système (logique/pacte.mjs).
import { ORDRE_MEUTE, role } from "./aides.mjs";

// ======================================================================= La Meute

const MEUTE = [
  role({
    cle: "loup-de-brumecombe", nom: "Loup de Brumecombe", camp: "meute", effet: "tuer",
    resume: "chaque nuit, avec la meute, choisit la victime.",
    pouvoir: `Le jour, tu es un voisin comme un autre. La nuit, tu retrouves la meute dans la brume.

**Chaque nuit**, avec les autres loups, tu choisis une maison où entrer : celui qui y dort meurt, sauf s'il est protégé. Les loups se reconnaissent entre eux dès la première nuit.`,
    nuit: { ordre: ORDRE_MEUTE, cibles: 1, invite: "Quelle maison la meute visite-t-elle cette nuit ?" }
  }),
  role({
    cle: "loup-affame", nom: "Loup affamé", camp: "meute", effet: "tuer",
    resume: "chaque nuit, tant qu'aucun loup n'est mort, tue seul une seconde victime.",
    pouvoir: `Tu chasses avec la meute, mais ta faim ne s'apaise jamais.

**Chaque nuit**, quand la meute s'est rendormie, tu te réveilles seul et tu choisis une **seconde victime** : une autre que la proie de la meute, et jamais un loup.

Ta faim tient à la meute entière : **dès qu'un loup est mort** (un loup de toujours ou un mordu, de quelque façon qu'il soit tombé), elle s'éteint pour toujours, et tu ne chasses plus qu'avec les autres.`,
    nuit: { ordre: 42, cibles: 1, tantQueMeuteEntiere: true, invite: "Ta faim te ronge : quelle autre maison visites-tu seul cette nuit ?" }
  }),
  role({
    cle: "loup-deguise", nom: "Loup déguisé", camp: "meute", effet: "tuer", apparence: "village",
    resume: "apparaît comme villageois à toute vision ; perd son masque s'il survit à un vote qui l'a désigné.",
    pouvoir: `Tu portes un visage d'emprunt cousu de patience.

Tu chasses chaque nuit avec la meute. **Toute vision te voit comme un villageois du camp du Village** (Liseuse de cendres, Sourcier, Loup flaireur…). La Veilleuse de lanterne te démasque comme les autres si tu entres dans la maison qu'elle éclaire.

Si tu es **le plus désigné d'un vote sans être exécuté** (égalité, vote annulé, majorité manquée), le masque tombe : à partir de là, les visions disent la vérité sur toi.`,
    nuit: { ordre: ORDRE_MEUTE, cibles: 1, invite: "Quelle maison la meute visite-t-elle cette nuit ?" }
  }),
  role({
    cle: "louve-mere", nom: "Louve mère", camp: "meute", effet: "mordre", usages: 1,
    resume: "une fois par partie, infecte la proie de la meute au lieu de la tuer : elle devient loup en secret.",
    pouvoir: `Tu as porté la meute avant qu'elle ait des noms.

Tu chasses chaque nuit avec la meute. **Une fois par partie**, juste après le choix de la meute, tu peux **infecter** sa proie au lieu qu'elle meure : la victime **ne meurt pas**, et devient en secret un **loup de la meute**. Le narrateur la prévient en secret ; dès la nuit suivante, elle se réveille avec la meute et chasse avec elle. Si elle avait un pouvoir de nuit, elle le garde : le narrateur l'appelle encore pour lui, et elle s'en sert désormais pour les loups.

La garde du Garde du pont n'arrête pas ta morsure : elle protège de la mort, pas de toi. Une porte fermée à la meute (l'asile de la Chapelle, la clé de la Gardienne, le verrou du Forgeron), si. Une infection n'est pas une mort : cette nuit-là, il n'y a personne à sauver.`,
    nuit: { ordre: 41, cibles: 1, invite: "La meute a choisi sa proie. Désigne-la pour l'infecter au lieu de la tuer, ou passe." }
  }),
  role({
    cle: "loup-hurleur", nom: "Loup hurleur", camp: "meute", effet: "silence",
    resume: "chaque nuit, impose le silence à un joueur pour le débat du lendemain.",
    pouvoir: `Ton cri traverse les volets et glace les gorges.

Tu chasses chaque nuit avec la meute. Puis, **chaque nuit**, tu désignes un joueur : au matin, il est **réduit au silence** et ne pourra ni parler ni écrire pendant le débat du jour. Il peut voter. Tu ne peux pas choisir deux nuits de suite le même joueur.`,
    nuit: { ordre: 43, cibles: 1, invite: "Ton hurlement cherche une gorge : qui se taira demain ?" }
  }),
  role({
    cle: "loup-flaireur", nom: "Loup flaireur", camp: "meute", effet: "voir-camp",
    resume: "chaque nuit, flaire un joueur et apprend son camp.",
    pouvoir: `Ton museau lit les seuils mieux qu'un registre.

Tu chasses chaque nuit avec la meute. Puis, **chaque nuit**, tu flaires la porte d'un joueur et le narrateur te dit en secret son **camp** (Village, Meute ou Solitaire). Tu peux partager ce que tu sais avec la meute la nuit suivante.`,
    nuit: { ordre: 44, cibles: 1, invite: "Quel seuil veux-tu flairer cette nuit ?" }
  }),
  role({
    cle: "loup-des-roseaux", nom: "Loup des roseaux", camp: "meute", effet: "voir-actif",
    resume: "chaque nuit, guette une maison depuis les roseaux et apprend si son occupant a agi.",
    pouvoir: `Tu connais chaque touffe de roseaux entre le Pont et le Moulin, et personne ne t'y voit attendre.

Tu chasses chaque nuit avec la meute. Puis, **chaque nuit**, tu guettes la maison d'un joueur : le narrateur te dit en secret s'il **a agi** cette nuit (un pouvoir de nuit, ou la chasse), sans dire ce qu'il a fait. De quoi repérer ceux qui cachent un pouvoir, et les désigner à la meute la nuit suivante.

Guetter, c'est rôder au seuil : si la Veilleuse de lanterne éclaire la maison que tu guettes, tu es démasqué.`,
    nuit: { ordre: 45, cibles: 1, invite: "Depuis les roseaux, quelle porte guettes-tu cette nuit ?" }
  })
];

// ======================================================================= Le Village

const VILLAGE = [
  role({
    cle: "villageois", nom: "Villageois", camp: "village",
    resume: "aucun pouvoir, une voix.",
    pouvoir: `Tu n'as ni don ni secret. Tu as mieux : des yeux, des oreilles et une voix au vote.

Écoute qui parle trop, qui se tait, qui change d'avis. C'est toi que la meute veut convaincre ; c'est toi qui décides.`
  }),
  role({
    cle: "veilleuse-de-lanterne", nom: "Veilleuse de lanterne", camp: "village", effet: "eclairer",
    resume: "éclaire une maison chaque nuit : un loup qui y entre est démasqué à l'aube.",
    pouvoir: `Tu marches la nuit avec ta lanterne, et la brume s'écarte devant toi.

**Chaque nuit**, tu éclaires une maison (la tienne comprise). Si un **loup** y entre cette nuit (pour tuer, mordre ou flairer), il est **démasqué à l'aube** : le narrateur annonce son nom à tout le village. Ta lumière ne protège personne.`,
    nuit: { ordre: 25, cibles: 1, soiMeme: true, invite: "Quelle maison éclaires-tu cette nuit ?" }
  }),
  role({
    cle: "liseuse-de-cendres", nom: "Liseuse de cendres", camp: "village", effet: "voir-role",
    resume: "chaque nuit, apprend le rôle d'un joueur.",
    pouvoir: `Tu lis l'avenir dans la cendre froide de l'âtre.

**Chaque nuit**, tu désignes un joueur et le narrateur te dit en secret **son rôle** : la carte qu'il a reçue, et le camp de cette carte (Village, Meute ou Solitaire). À toi de choisir quand dire ce que tu sais, et à qui.

Certains trompent les cendres : le Loup déguisé t'apparaît en simple Villageois, le Louvetier en Loup de Brumecombe.`,
    nuit: { ordre: 60, cibles: 1, invite: "Dans quelles cendres lis-tu cette nuit ?" }
  }),
  role({
    cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", usages: 2,
    resume: "un remède (sauve la victime de la meute) et un poison (tue), une fois chacun, les deux la même nuit si elle veut.",
    pouvoir: `Tes fioles dorment dans la paille, une verte et une noire.

Chaque nuit, après la chasse, le narrateur te dit qui la meute a attaqué. Tu peux alors :
- verser ton **remède** à la victime : elle survit (une fois par partie) ;
- verser ton **poison** dans le verre de n'importe qui d'autre : il meurt à l'aube (une fois par partie).

Tu peux te servir des **deux fioles la même nuit** : désigne la victime et celui que tu empoisonnes. Si la victime, c'est toi, tu peux te sauver toi-même. Le remède sauve de la meute, pas du feu ; et quand la Louve mère infecte sa proie au lieu de la tuer, personne ne meurt : le narrateur n'a pas de victime à te nommer. Passe pour garder tes fioles.`,
    nuit: { ordre: 50, cibles: 2, soiMeme: true, invite: "Désigne la victime pour la sauver, quelqu'un d'autre pour l'empoisonner, les deux, ou passe." }
  }),
  role({
    cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger",
    resume: "protège un joueur par nuit, jamais deux fois de suite le même.",
    pouvoir: `Tu tiens le pont depuis vingt hivers et tu sais rester éveillé.

**Chaque nuit**, avant la chasse, tu veilles sur un joueur (toi compris) : si la meute l'attaque cette nuit, il survit. Tu ne peux pas veiller **deux nuits de suite** sur le même joueur (le narrateur ne te le propose pas). Ta garde n'arrête que la meute : ni le poison, ni le feu, ni le harpon, ni la noyade, ni la morsure de la Louve mère qui fait d'une proie un loup.`,
    nuit: { ordre: 20, cibles: 1, soiMeme: true, invite: "Devant quelle porte montes-tu la garde cette nuit ?" }
  }),
  role({
    cle: "sonneur", nom: "Sonneur", camp: "village", effet: "vote-double", usages: 1,
    resume: "une fois par partie, de jour, sonne la cloche : le vote désigne deux condamnés.",
    pouvoir: `La corde de la cloche passe par ta fenêtre.

**Une fois par partie**, pendant le débat ou au début d'un vote, tu sonnes la cloche (ton pouvoir de jour, sur la Table de jeu, ou à voix haute au narrateur) : **le vote d'exécution désigne deux condamnés** au lieu d'un (les deux joueurs qui ont le plus de voix ; une égalité pour la seconde place la laisse vide, sauf si le Bailli la tranche). Tu te révèles en le faisant.`
  }),
  role({
    cle: "fossoyeur", nom: "Fossoyeur", camp: "village", effet: "voir-role-mort",
    resume: "chaque matin, apprend le rôle exact d'un mort.",
    pouvoir: `Tu ranges les morts, et les morts te parlent.

**Chaque nuit**, en dernier, tu désignes un joueur mort (de la nuit ou d'avant) : le narrateur te dit en secret son **rôle exact**, même si les rôles ne sont pas révélés à la mort. Tu dois attendre qu'il y ait un mort.`,
    nuit: { ordre: 90, cibles: 1, invite: "Quelle tombe interroges-tu cette nuit ?" }
  }),
  role({
    cle: "braconniere", nom: "Braconnière", camp: "village", effet: "emporter",
    resume: "si elle meurt, elle emporte un joueur de son choix.",
    pouvoir: `Tes collets tiennent encore quand toi tu tombes.

**Quand tu meurs**, de nuit ou au vote, tu désignes aussitôt un joueur vivant : il meurt avec toi. Si tu es réduite au silence, tu peux le désigner du doigt.`
  }),
  role({
    cle: "conteuse", nom: "Conteuse", camp: "village", usages: 1,
    resume: "une fois par partie, impose deux minutes de débat sur un joueur, qui ne peut pas répondre.",
    pouvoir: `Tu sais raconter les gens mieux qu'ils ne se racontent eux-mêmes.

**Une fois par partie**, au début d'un débat, tu désignes un joueur : pendant **deux minutes**, le village ne parle que de lui, et il **ne peut pas répondre**. Ensuite le débat reprend normalement.`
  }),
  role({
    cle: "juge-de-paix", nom: "Juge de paix", camp: "village", effet: "annuler-vote", usages: 1,
    resume: "une fois par partie, annule un vote : le village revote.",
    pouvoir: `Tu portes l'écharpe et le registre.

**Une fois par partie**, juste après le dépouillement et avant l'exécution, tu peux **annuler le vote** : personne n'est exécuté et le village **revote** aussitôt, sans nouveau débat. Tu te révèles en le faisant.`
  }),
  role({
    cle: "enfant-de-la-brume", nom: "Enfant de la brume", camp: "village", effet: "epier",
    resume: "peut épier la meute la nuit et apprendre le nom des loups ; surprise, c'est elle que la meute dévore.",
    pouvoir: `Tu ne dors jamais quand il le faudrait.

**Chaque nuit**, pendant que la meute chasse, tu peux choisir d'**épier** (ou rester sagement au lit). Si tu épies, le narrateur te dit en secret **le nom de tous les loups** sortis chasser cette nuit. Mais tu peux être **surprise** (une chance sur deux) : alors c'est **toi que la meute dévore**, en silence, à la place de la proie qu'elle avait choisie. Prise dehors, ni la garde du Garde du pont ni une porte close ne te sauvent ; un remède, si.

Tu ne peux pas te faire passer pour un loup.`,
    nuit: { ordre: 39, cibles: 1, soiMeme: true, invite: "Désigne-toi pour te glisser hors du lit et épier la meute, ou passe." }
  }),
  role({
    cle: "ermite", nom: "Ermite", camp: "village", effet: "voir-actif",
    resume: "chaque nuit, apprend le nom d'un joueur qui a agi (sans savoir ce qu'il a fait).",
    pouvoir: `De ta cabane au-dessus du village, tu vois les lanternes qui bougent.

**Chaque nuit**, à la fin de la nuit, le narrateur te donne en secret le nom d'**un joueur qui a agi** cette nuit (pouvoir de nuit ou chasse de la meute), tiré au hasard. Tu ne sais pas ce qu'il a fait.`,
    nuit: { ordre: 70, cibles: 0, invite: "Tu guettes les lanternes. Le narrateur va te souffler un nom." }
  }),
  role({
    cle: "messager", nom: "Messager", camp: "village", effet: "messager",
    resume: "chaque nuit, porte un message secret entre deux joueurs.",
    pouvoir: `Tu connais tous les raccourcis et toutes les boîtes aux lettres.

**Chaque nuit**, tu peux porter un **message secret** : tu désignes un expéditeur et un destinataire (toi compris), dans cet ordre. L'expéditeur écrit aussitôt une phrase, dans une fenêtre qui ne s'ouvre que chez lui ; le narrateur la remet au destinataire à l'aube, avec le nom de l'expéditeur. Personne d'autre ne la lit.`,
    nuit: { ordre: 10, cibles: 2, soiMeme: true, invite: "Qui écrit, et à qui portes-tu son message cette nuit ?" }
  }),
  role({
    cle: "entremetteuse", nom: "Entremetteuse", camp: "village", effet: "lien-amour",
    resume: "unit deux amants la première nuit, puis joue avec le village.",
    pouvoir: `Tu as marié la moitié du village et tu n'as pas dit ton dernier mot.

**La première nuit**, tu désignes deux joueurs (toi comprise) : ils deviennent **amants**. Le narrateur les prévient en secret ; ils apprennent le nom l'un de l'autre, pas leur rôle. Si l'un meurt, l'autre meurt de chagrin aussitôt.

Deux amants du même camp gagnent avec lui. Deux amants de **camps différents** (un loup et un villageois, par exemple) ne gagnent **qu'ensemble, en restant les deux derniers vivants** : plus avec leur camp. Toi, ensuite, tu joues avec le village.`,
    nuit: { ordre: 5, cibles: 2, soiMeme: true, premiereNuitSeulement: true, invite: "Quels deux cœurs lies-tu cette nuit ?" }
  }),
  role({
    cle: "gardienne-des-cles", nom: "Gardienne des clés", camp: "village", effet: "proteger",
    resume: "chaque nuit, verrouille une maison : personne n'y entre, personne n'en sort.",
    pouvoir: `Toutes les clés du village pendent à ta ceinture.

**Chaque nuit**, tu verrouilles une maison (pas la tienne) : **personne n'y entre** cette nuit (ni loup, ni visite), mais **celui qui y dort ne peut pas agir** non plus. Tu ne peux pas verrouiller deux nuits de suite la même maison.`,
    nuit: { ordre: 15, cibles: 1, invite: "Quelle porte verrouilles-tu cette nuit ?" }
  }),
  role({
    cle: "sourcier", nom: "Sourcier", camp: "village", effet: "voir-camp",
    resume: "une nuit sur deux, apprend si deux joueurs sont du même camp.",
    pouvoir: `Ta baguette de coudrier tremble entre deux personnes qui se ressemblent.

**Une nuit sur deux**, tu désignes **deux joueurs** et le narrateur te dit en secret s'ils sont **du même camp** ou non. Rien de plus.`,
    nuit: { ordre: 62, cibles: 2, uneNuitSurDeux: true, invite: "Entre quels deux joueurs fais-tu passer ta baguette ?" }
  }),
  role({
    cle: "louvetier", nom: "Louvetier", camp: "village", effet: "voir-camp", apparence: "meute",
    resume: "chaque nuit, apprend le camp d'un joueur ; mais il sent le loup : toute vision le voit de la meute.",
    pouvoir: `Tu traques les loups depuis tant d'hivers que tu as fini par prendre leur odeur.

**Chaque nuit**, tu suis la piste d'un joueur et le narrateur te dit en secret son **camp** : Village, Meute ou Solitaire.

Mais **toute vision te voit du camp de la Meute** (Liseuse de cendres, Sourcier, Loup flaireur…). Si l'on t'accuse sur la foi des cendres, ce sera ta parole contre la leur : choisis bien le moment de dire ce que tu sais. Les loups, eux, savent que tu n'es pas des leurs.`,
    nuit: { ordre: 61, cibles: 1, invite: "Sur quelle piste lâches-tu tes chiens cette nuit ?" }
  }),
  role({
    cle: "somnambule", nom: "Somnambule", camp: "village",
    resume: "croit tenir un rôle de vision (Liseuse de cendres, Fossoyeur ou Sourcier), mais il rêve : ses visions sont fausses.",
    pouvoir: `Tu marchais la nuit, les yeux ouverts, et tu croyais voir.

**Tu ne savais pas que tu étais Somnambule.** À la distribution, tu as reçu la carte d'un rôle de vision (Liseuse de cendres, Fossoyeur ou Sourcier) et tu l'as joué de bonne foi : chaque nuit, tu te levais, tu désignais, et le narrateur te répondait. Mais tu rêvais : **tes visions étaient fausses**, toujours plausibles, jamais vraies.

Tu es bien du camp du **Village**, et tu gagnes avec lui. On ne découvre ta vraie nature qu'à ta mort (ou à la fin de la partie).`
  }),
  role({
    cle: "rosiere", nom: "Rosière", camp: "village",
    resume: "la fierté du village : si le village l'exécute par le vote, le Village perd aussitôt.",
    pouvoir: `Tu portes la couronne de roses de l'année, et tout Brumecombe s'est juré de te garder.

Tu n'as aucun pouvoir, mais **ta vie est le serment du village** : si le village t'**exécute par le vote**, le serment est rompu et **le Village perd aussitôt** (la meute l'emporte). La nuit, tu meurs comme tout le monde, sans que rien d'autre ne se passe.

À toi de te faire croire sans te dévoiler trop tôt : une Rosière qui se déclare devient la cible préférée des loups, et un loup qui se dit Rosière peut sauver sa peau.`
  }),
  role({
    cle: "pecheur-de-nuit", nom: "Pêcheur de nuit", camp: "village", effet: "tuer", usages: 1,
    resume: "une fois par partie, lance son harpon dans la brume : sa cible meurt à l'aube, sauf si elle est protégée.",
    pouvoir: `Tu connais les eaux noires de la Brume, et ce qui y remue après minuit.

**Une fois par partie**, la nuit, tu lances ton **harpon** sur la maison d'un joueur : celui qui y dort **meurt à l'aube**, sauf si la Gardienne des clés a fermé sa porte cette nuit ou s'il est sauvé par un remède (la garde du Garde du pont n'arrête que la meute). Ton harpon atteint aussi ceux que la meute ne peut pas tuer, et il ne laisse aucune trace de crocs.

Vise juste : un harpon perdu dans la poitrine d'un voisin ne revient pas. Tant que tu passes, tu le gardes.`,
    nuit: { ordre: 48, cibles: 1, invite: "Sur quelle maison lances-tu ton harpon cette nuit ? Passe pour le garder." }
  }),

  // --------------------------------------------------------------- les rôles du Village du jeu de soirée (Le Pacte, étape 3a)
  role({
    cle: "franc-villageois", nom: "Franc-Villageois", camp: "village", public: true,
    resume: "aucun pouvoir, mais sa carte est retournée dès la distribution : tout le village sait qu'il est innocent.",
    pouvoir: `Tu n'as aucun pouvoir, et tout Brumecombe le sait : ta carte est **retournée devant tous dès la distribution**. Personne ne peut douter que tu es du camp du **Village**.

C'est ta force : ta parole ne cache rien, et tu peux guider le vote sans qu'on te soupçonne. C'est aussi ta faiblesse : la meute sait qu'elle ne pourra jamais te faire accuser à sa place.`
  }),
  role({
    cle: "aieul", nom: "Aïeul", camp: "village", effet: "resister",
    resume: "la meute doit l'attaquer deux fois pour le tuer ; s'il tombe de la main du village, les villageois perdent leurs pouvoirs.",
    pouvoir: `Tu as vu passer plus d'hivers que quiconque à Brumecombe, et ta peau est dure comme l'écorce.

**La première fois que la meute t'attaque**, tu survis, en secret : ta carte reste cachée et le village n'en sait rien. **La seconde fois**, tu meurs. La première morsure de la Louve mère compte pour cette première attaque : elle ne fait pas de toi un loup. Si un remède de l'Herboriste te sauve d'une attaque, tu gardes ta vie de réserve.

Mais tu es la sagesse du village : si **le village** te fait mourir (le vote, le poison de l'Herboriste, la Braconnière), Brumecombe perd la tête, et **tous les villageois perdent leurs pouvoirs** jusqu'à la fin de la partie : les rôles du Village comme les métiers. Le Bailli garde sa charge.`
  }),
  role({
    cle: "souffre-douleur", nom: "Souffre-douleur", camp: "village", effet: "egalite",
    resume: "si le vote finit à égalité, c'est lui qui est exécuté ; il désigne alors qui votera le lendemain.",
    pouvoir: `On t'a toujours tout mis sur le dos, et ça ne changera pas aujourd'hui.

Si un **vote d'exécution finit à égalité**, aucun des ex æquo n'est exécuté : **c'est toi**, avant toute autre règle (avant même la voix du Bailli).

Mort ainsi, tu as un dernier mot : tu désignes en secret **qui votera** au vote d'exécution du lendemain (un joueur au moins). Ceux que tu n'as pas désignés ne votent pas ce jour-là. Ta liste peut sauver un innocent, ou livrer le village à la meute.`
  }),
  role({
    cle: "innocent", nom: "Innocent", camp: "village", effet: "grace",
    resume: "si le village vote contre lui, il est gracié : sa carte est retournée, il reste en jeu, mais ne vote plus.",
    pouvoir: `Tout Brumecombe te connaît, et personne ne te croit capable de faire du mal à une mouche.

Si **le village vote contre toi**, ta carte est retournée au moment de l'exécution : le village comprend son erreur et te **gracie**. Tu restes en jeu et tu peux encore parler, mais tu **ne voteras plus jamais**. Si tu étais Bailli, tu perds la charge, et personne ne la reprendra.

La nuit, tu meurs comme tout le monde : la meute ne fait pas de grâce, la Braconnière non plus. Et le village ne te graciera qu'une fois.`
  }),
  role({
    cle: "lavandiere", nom: "Lavandière", camp: "village", effet: "fratrie",
    resume: "elles sont deux : elles se reconnaissent la première nuit, puis se retrouvent une nuit sur deux pour se concerter.",
    pouvoir: `Vous êtes deux, et vous battez le linge au lavoir depuis l'enfance : vous vous connaissez mieux que personne.

**La première nuit**, les Lavandières se réveillent ensemble et **se reconnaissent** : le narrateur vous dit en secret le nom de l'autre. Ensuite, **une nuit sur deux** (la troisième, la cinquième…), vous vous réveillez de nouveau ensemble et pouvez **vous concerter** en secret, le temps de votre réveil.

Vous êtes du camp du **Village** toutes les deux : au moins une personne à Brumecombe est digne de votre confiance.`,
    nuit: { ordre: 11, cibles: 0, nuitsImpaires: true, invite: "Les Lavandières se retrouvent au lavoir : le narrateur vous souffle les vôtres." }
  }),
  role({
    cle: "bucheron", nom: "Bûcheron", camp: "village", effet: "fratrie",
    resume: "ils sont trois : ils se reconnaissent la première nuit, puis se retrouvent une nuit sur deux pour se concerter.",
    pouvoir: `Vous êtes trois frères, et vous abattez les chênes de la forêt de Brumecombe depuis que vous tenez une hache.

**La première nuit**, les Bûcherons se réveillent ensemble et **se reconnaissent** : le narrateur vous dit en secret le nom des deux autres. Ensuite, **une nuit sur deux** (la troisième, la cinquième…), vous vous réveillez de nouveau ensemble et pouvez **vous concerter** en secret, le temps de votre réveil.

Vous êtes tous trois du camp du **Village** : à trois, vous pesez déjà dans un vote.`,
    nuit: { ordre: 12, cibles: 0, nuitsImpaires: true, invite: "Les Bûcherons se retrouvent à la coupe : le narrateur vous souffle les vôtres." }
  }),
  role({
    cle: "furet", nom: "Furet", camp: "village", effet: "flairer",
    resume: "chaque nuit, flaire un joueur et ses deux voisins : apprend s'il y a un loup parmi eux ; sinon, il perd son flair.",
    pouvoir: `Tu te faufiles sous les portes et rien ne t'échappe, tant que ton nez ne te trompe pas.

**Chaque nuit**, tu désignes un joueur : tu flaires **lui et ses deux voisins vivants** (à sa gauche et à sa droite autour de la table). Le narrateur te dit en secret s'il y a **au moins un loup** parmi ces trois-là :
- **oui** : tu gardes ton flair ;
- **non** : ces trois-là sont innocents, mais ton flair te quitte **pour toujours**. Le narrateur te réveille encore chaque nuit, pour que personne ne remarque rien, mais tu n'as plus rien à désigner.`,
    nuit: { ordre: 7, cibles: 1, invite: "Quelle maison flaires-tu cette nuit, avec ses deux voisines ?" }
  }),
  role({
    cle: "gardeuse-d-oies", nom: "Gardeuse d'oies", camp: "village", effet: "cacarder",
    resume: "chaque matin, ses oies cacardent si un loup est l'un de ses deux voisins.",
    pouvoir: `Tes oies ne suivent que toi, et elles ne supportent pas l'odeur du loup.

**Chaque matin**, juste après l'annonce des morts de la nuit, si **un loup** est l'un de tes **deux voisins vivants** (à ta gauche et à ta droite autour de la table), le narrateur annonce à tout le village : « **les oies de** *(ton nom)* **cacardent** ». Sinon, il ne dit rien.

Si la meute fait de toi un loup (la morsure de la Louve mère), tes oies cacardent chaque matin, tant que tu vis.`
  }),
  role({
    cle: "greffier-begue", nom: "Greffier bègue", camp: "village", effet: "second-vote", usages: 1,
    resume: "une fois par partie, pendant ou juste après un vote qui condamne, déclenche en secret un second vote, sans débat.",
    pouvoir: `Tu tiens la plume du tribunal, et ta langue fourche quand l'émotion te prend.

**Une fois par partie**, pendant un vote d'exécution ou juste après qu'il a désigné un condamné, tu fais un **signe discret** au narrateur (ton pouvoir de jour, sur la Table de jeu) : dès que le condamné est tombé, il annonce **un second vote d'exécution**, aussitôt, **sans débat**. Ce vote suit les règles ordinaires.

Personne ne sait que c'est toi : le narrateur dit seulement « un second vote ». Si le vote ne condamne personne, ton signe est perdu, mais pas ton pouvoir : tu pourras le refaire un autre jour.`
  }),
  role({
    cle: "vieux-sergent", nom: "Vieux Sergent", camp: "village", effet: "contaminer",
    resume: "si la meute le dévore, sa vieille épée blesse le premier loup à sa gauche, qui meurt la nuit suivante.",
    pouvoir: `Tu as servi trente ans sous les drapeaux, et ta vieille épée rouillée ne quitte jamais ton chevet.

Si **la meute te dévore**, tu meurs, mais ta lame a mordu : le **premier loup vivant à ta gauche** autour de la table est blessé. La rouille fait son œuvre : il **meurt la nuit suivante**, et sa mort est annoncée au matin d'après. Rien ne le protège.

Mort d'une autre façon (le vote, le poison, les flammes…), ton épée ne sert à rien.`
  }),
  role({
    cle: "pie", nom: "Pie", camp: "village", effet: "plume",
    resume: "chaque nuit, pose une plume noire sur un joueur : il aura deux voix de plus contre lui au vote du jour.",
    pouvoir: `Tu ramasses tout ce qui brille, et tu sais sous quel toit chacun cache ses secrets.

**Chaque nuit**, après la chasse, tu peux désigner un joueur (pas toi). Au matin, le narrateur annonce à tous : « **une plume noire désigne** *(son nom)* ». Au **vote d'exécution** de ce jour, il compte **deux voix de plus** contre lui. Personne ne sait d'où vient la plume.

Passe si tu ne veux désigner personne.`,
    nuit: { ordre: 46, cibles: 1, invite: "Sur quel seuil poses-tu ta plume noire cette nuit ? Passe pour n'en poser aucune." }
  })
];

// ======================================================================= Les solitaires

const SOLITAIRES = [
  role({
    cle: "revenant", nom: "Revenant", camp: "solitaire", victoireCle: "execute",
    resume: "gagne s'il est exécuté par le village.",
    pouvoir: `Tu es déjà mort une fois. Tu veux qu'on te le rende officiel.

Tu n'as aucun pouvoir de nuit. Ton seul but : te faire **exécuter par le vote du village**. Une mort de nuit ne compte pas.`,
    victoire: `Tu gagnes **seul et aussitôt** si le village t'exécute au vote : la partie s'arrête sur ta victoire.`
  }),
  role({
    cle: "colporteur", nom: "Colporteur", camp: "solitaire", effet: "echanger-role", usages: 1,
    resume: "échange en secret son rôle avec un autre joueur, une fois ; gagne avec son nouveau camp.",
    pouvoir: `Tout s'échange, à Brumecombe, même ce qu'on est.

**Une fois par partie**, la nuit, tu désignes un joueur : vous **échangez vos rôles** en secret. Le narrateur vous dit à tous deux votre nouveau rôle. L'autre devient Colporteur, sans pouvoir d'échange (il est déjà usé).`,
    victoire: `Tant que tu n'as pas échangé, tu ne peux pas gagner. Après l'échange, tu gagnes avec le **camp de ton nouveau rôle**. Celui qui a reçu ton rôle reste solitaire et ne gagne que s'il est encore vivant à la fin de la partie.`,
    nuit: { ordre: 8, cibles: 1, invite: "Avec qui échanges-tu ta besace cette nuit ? Passe pour la garder." }
  }),
  role({
    cle: "chasseur-de-primes", nom: "Chasseur de primes", camp: "solitaire", victoireCle: "cible-executee",
    resume: "reçoit une cible au début : gagne si elle est exécutée de jour.",
    pouvoir: `Quelqu'un t'a payé pour qu'un voisin finisse au gibet.

**La première nuit**, le narrateur te donne en secret le nom de ta **cible**, tirée au hasard parmi les autres joueurs. Tu n'as pas d'autre pouvoir que ta langue.`,
    victoire: `Tu gagnes **seul et aussitôt** si ta cible est exécutée par le vote du village, que tu sois vivant ou non. Si elle meurt d'une autre façon, tu deviens un simple villageois et joues avec le village.`,
    nuit: { ordre: 6, cibles: 0, premiereNuitSeulement: true, invite: "Le narrateur te glisse le nom de ta cible." }
  }),
  role({
    cle: "pyromane", nom: "Pyromane", camp: "solitaire", effet: "asperger", victoireCle: "dernier-survivant",
    resume: "asperge une maison par nuit ; une nuit, met le feu à toutes les maisons aspergées ; gagne seul.",
    pouvoir: `L'huile de lampe sent bon, et les maisons sont en bois.

**Chaque nuit**, tu fais l'une de ces deux choses :
- **asperger** d'huile une maison (celui qui y dort ne le sait pas) ;
- **embraser** (tu te désignes toi-même) : toutes les maisons aspergées brûlent, et ceux qui y dorment meurent à l'aube, protégés ou non.

La meute ne peut pas te tuer : quand elle entre chez toi, elle repart bredouille.`,
    victoire: `Tu gagnes **seul** si tu es le dernier vivant, ou le dernier avec un seul autre joueur qui n'est pas un loup.`,
    nuit: { ordre: 55, cibles: 1, soiMeme: true, invite: "Quelle maison asperges-tu ? Désigne-toi pour embraser toutes les maisons aspergées." }
  }),
  role({
    cle: "dame-du-gue", nom: "Dame du gué", camp: "solitaire", effet: "tuer", victoireCle: "dernier-survivant",
    resume: "une nuit sur deux, attire un joueur au gué où il se noie ; la meute ne peut pas la tuer ; gagne seule.",
    pouvoir: `À Brumecombe, on dit qu'une femme pâle lave son linge au gué quand la brume monte, et que ceux qui s'approchent pour l'aider ne reviennent pas.

**Une nuit sur deux** (la deuxième, la quatrième…), tu chantes au bord de l'eau et tu désignes un joueur : il suit ta voix jusqu'au gué et **se noie**. On le trouve mort à l'aube, sauf si la Gardienne des clés a fermé sa porte cette nuit ou s'il est sauvé par un remède (la garde du Garde du pont n'arrête que la meute).

La meute ne peut pas te tuer : quand elle entre chez toi, elle n'y trouve que de l'eau froide. Le vote, le poison, le feu et le harpon, si.`,
    victoire: `Tu gagnes **seule** si tu es la dernière vivante, ou la dernière avec un seul autre joueur qui n'est pas un loup.`,
    nuit: { ordre: 47, cibles: 1, uneNuitSurDeux: true, invite: "Ton chant monte sur la rivière : qui suit ta voix jusqu'au gué cette nuit ?" }
  })
];

// ======================================================================= Les gens de passage
// Pour un joueur qui arrive en cours de partie (réglage « gensDePassage » du système) : son rôle est PUBLIC, son camp SECRET
// (tiré par le système : Village ou Meute) ; son pouvoir sert une fois, de jour. L'objet porte le camp « village » : c'est le
// camp tiré, sur le villageois, qui compte.

const PASSAGE = [
  role({
    cle: "remouleur", nom: "Rémouleur", camp: "village", usages: 1,
    resume: "gens de passage : une fois, de jour, affûte la serrure d'une maison : la première attaque de loup la nuit suivante échoue.",
    pouvoir: `Tu passes de village en village avec ta meule à pédale, et tu repars avant l'hiver.

Ton rôle est **connu de tous**, ton camp **ne l'est pas** : le narrateur te l'a dit en secret (Village ou Meute).

**Une fois**, pendant le jour, tu affûtes la serrure et le couteau d'une maison (la tienne comprise) : la nuit suivante, **la première attaque de loup contre elle échoue**, et si la meute la touche malgré tout, elle y laisse du sang.`
  }),
  role({
    // Le Montreur de marmotte (anciennement « Montreur d'ours », nom d'un rôle du livre qui fait autre chose) : la clé reste.
    cle: "montreur-d-ours", nom: "Montreur de marmotte", camp: "village", usages: 1,
    resume: "gens de passage : une fois, de jour, installe sa marmotte sur un seuil : la meute n'y entre pas la nuit suivante.",
    pouvoir: `Ta marmotte danse sur la place au son du flageolet, et siffle dès qu'une ombre approche d'un seuil.

Ton rôle est **connu de tous**, ton camp **ne l'est pas** : le narrateur te l'a dit en secret (Village ou Meute).

**Une fois**, pendant le jour, tu installes ta marmotte sur le seuil d'un joueur (toi compris) : **la meute n'entre pas** chez lui la nuit suivante.`
  }),
  role({
    cle: "pelerine", nom: "Pèlerine", camp: "village", usages: 1,
    resume: "gens de passage : une fois, de jour, prie sur un seuil et apprend en secret le camp de ce joueur.",
    pouvoir: `Tu marches vers un sanctuaire lointain, et Brumecombe n'est qu'une étape.

Ton rôle est **connu de tous**, ton camp **ne l'est pas** : le narrateur te l'a dit en secret (Village ou Meute).

**Une fois**, pendant le jour, tu pries longuement sur le seuil d'un autre joueur : le village le voit, mais toi seule apprends **son camp** (tel que le voient les visions).`
  })
];

export const ROLES = [...MEUTE, ...VILLAGE, ...SOLITAIRES, ...PASSAGE];
