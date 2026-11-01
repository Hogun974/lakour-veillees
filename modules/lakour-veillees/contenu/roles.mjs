// Les rôles secrets des Veillées de Brumecombe : la Meute, le Village et les solitaires. Textes originaux.
// Ordre de nuit (petit = tôt) : l'Entremetteuse et les rôles qui préparent la nuit d'abord, les protections avant la
// meute (40), les rôles qui réagissent à la victime juste après, les informations à la fin, le Fossoyeur en dernier.
// Tous les loups se réveillent ensemble à 40 pour choisir la victime de la meute ; un loup dont l'ordre n'est pas 40
// se réveille EN PLUS, seul, à son ordre, pour son pouvoir propre.
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
    resume: "une nuit sur deux, tue seul une seconde victime.",
    pouvoir: `Tu chasses avec la meute, mais ta faim ne s'apaise jamais.

**Une nuit sur deux** (la deuxième, la quatrième…), après la chasse de la meute, tu te réveilles seul et tu choisis une **seconde victime**. Si tu es le dernier loup vivant, ta faim te pousse à chasser toutes les nuits.`,
    nuit: { ordre: 42, cibles: 1, uneNuitSurDeux: true, invite: "Ta faim te ronge : quelle maison visites-tu seul cette nuit ?" }
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
    resume: "une fois par partie, mord la victime de la meute au lieu de la tuer : elle rejoint la meute en secret.",
    pouvoir: `Tu as porté la meute avant qu'elle ait des noms.

Tu chasses chaque nuit avec la meute. **Une fois par partie**, juste après le choix de la meute, tu peux décider de **mordre** la victime au lieu de la tuer : personne ne meurt cette nuit-là, et la victime rejoint la meute en secret. Elle garde son rôle et ses pouvoirs, mais joue désormais pour les loups ; le narrateur la prévient en secret et elle se réveille avec la meute dès la nuit suivante.

Une victime protégée ne peut pas être mordue.`,
    nuit: { ordre: 41, cibles: 1, invite: "La meute a choisi sa proie. Désigne-la pour la mordre au lieu de la tuer, ou passe." }
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
    cle: "liseuse-de-cendres", nom: "Liseuse de cendres", camp: "village", effet: "voir-camp",
    resume: "chaque nuit, apprend le camp d'un joueur.",
    pouvoir: `Tu lis l'avenir dans la cendre froide de l'âtre.

**Chaque nuit**, tu désignes un joueur et le narrateur te dit en secret son **camp** : Village, Meute ou Solitaire. Pas son rôle. À toi de choisir quand dire ce que tu sais, et à qui.`,
    nuit: { ordre: 60, cibles: 1, invite: "Dans quelles cendres lis-tu cette nuit ?" }
  }),
  role({
    cle: "herboriste", nom: "Herboriste", camp: "village", effet: "remede", usages: 2,
    resume: "un remède (sauve la victime de la nuit) et un poison (tue), une fois chacun.",
    pouvoir: `Tes fioles dorment dans la paille, une verte et une noire.

Chaque nuit, après la chasse, le narrateur te dit qui la meute a attaqué. Tu désignes alors un joueur :
- **la victime de la nuit** : tu lui verses ton **remède**, elle survit (une fois par partie) ;
- **n'importe qui d'autre** : tu verses ton **poison** dans son verre, il meurt à l'aube (une fois par partie).

Une seule fiole par nuit. Si la victime, c'est toi, tu peux te sauver toi-même. Passe pour garder tes fioles.`,
    nuit: { ordre: 50, cibles: 1, soiMeme: true, invite: "Désigne la victime pour la sauver, quelqu'un d'autre pour l'empoisonner, ou passe." }
  }),
  role({
    cle: "garde-du-pont", nom: "Garde du pont", camp: "village", effet: "proteger",
    resume: "protège un joueur par nuit, jamais deux fois de suite le même.",
    pouvoir: `Tu tiens le pont depuis vingt hivers et tu sais rester éveillé.

**Chaque nuit**, tu veilles sur un joueur (toi compris) : s'il est attaqué par la meute cette nuit, il survit. Tu ne peux pas protéger **deux nuits de suite** le même joueur. Ta garde n'arrête ni le poison ni le feu.`,
    nuit: { ordre: 20, cibles: 1, soiMeme: true, invite: "Devant quelle porte montes-tu la garde cette nuit ?" }
  }),
  role({
    cle: "sonneur", nom: "Sonneur", camp: "village", effet: "vote-double", usages: 1,
    resume: "une fois par partie, sonne la cloche : le vote du jour désigne deux condamnés.",
    pouvoir: `La corde de la cloche passe par ta fenêtre.

**Une fois par partie**, au début d'un vote, tu peux annoncer que tu sonnes la cloche : **ce vote désigne deux condamnés** au lieu d'un (les deux villageois qui ont le plus de voix ; une égalité pour la seconde place la laisse vide). Tu te révèles en le faisant.`
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
    resume: "peut épier la meute la nuit, mais s'il est repéré, il devient la victime.",
    pouvoir: `Tu ne dors jamais quand il le faudrait.

**Chaque nuit**, tu peux choisir d'**épier** la meute : le narrateur te montre ce que les loups se disent (sans leurs noms, sauf s'ils se trahissent). Mais à chaque fois, tu as **une chance sur trois d'être repéré** : alors la meute te prend pour victime à la place de celle qu'elle avait choisie.`,
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

Les amants gagnent **ensemble**, quel que soit leur camp : si l'un est loup et l'autre villageois, ils ne gagnent qu'en restant les deux derniers vivants. Toi, ensuite, tu joues avec le village.`,
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
    cle: "pecheur-de-nuit", nom: "Pêcheur de nuit", camp: "village", effet: "tuer", usages: 1,
    resume: "une fois par partie, lance son harpon dans la brume : sa cible meurt à l'aube, sauf si elle est protégée.",
    pouvoir: `Tu connais les eaux noires de la Brume, et ce qui y remue après minuit.

**Une fois par partie**, la nuit, tu lances ton **harpon** sur la maison d'un joueur : celui qui y dort **meurt à l'aube**, sauf s'il est protégé cette nuit (Garde du pont, Gardienne des clés) ou sauvé par un remède. Ton harpon atteint aussi ceux que la meute ne peut pas tuer, et il ne laisse aucune trace de crocs.

Vise juste : un harpon perdu dans la poitrine d'un voisin ne revient pas. Tant que tu passes, tu le gardes.`,
    nuit: { ordre: 48, cibles: 1, invite: "Sur quelle maison lances-tu ton harpon cette nuit ? Passe pour le garder." }
  })
];

// ======================================================================= Les solitaires

const SOLITAIRES = [
  role({
    cle: "revenant", nom: "Revenant", camp: "solitaire", victoireCle: "execute",
    resume: "gagne s'il est exécuté par le village.",
    pouvoir: `Tu es déjà mort une fois. Tu veux qu'on te le rende officiel.

Tu n'as aucun pouvoir de nuit. Ton seul but : te faire **exécuter par le vote du village**. Une mort de nuit ne compte pas.`,
    victoire: `Tu gagnes **seul et aussitôt** si le village t'exécute au vote. La partie continue pour les autres.`
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

**Une nuit sur deux** (la deuxième, la quatrième…), tu chantes au bord de l'eau et tu désignes un joueur : il suit ta voix jusqu'au gué et **se noie**. On le trouve mort à l'aube, sauf s'il était protégé cette nuit ou sauvé par un remède.

La meute ne peut pas te tuer : quand elle entre chez toi, elle n'y trouve que de l'eau froide. Le vote, le poison, le feu et le harpon, si.`,
    victoire: `Tu gagnes **seule** si tu es la dernière vivante, ou la dernière avec un seul autre joueur qui n'est pas un loup.`,
    nuit: { ordre: 47, cibles: 1, uneNuitSurDeux: true, invite: "Ton chant monte sur la rivière : qui suit ta voix jusqu'au gué cette nuit ?" }
  })
];

export const ROLES = [...MEUTE, ...VILLAGE, ...SOLITAIRES];
