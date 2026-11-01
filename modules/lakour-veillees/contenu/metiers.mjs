// Les métiers publics de Brumecombe : chaque joueur en reçoit un, visible de tous, en plus de son rôle secret.
// Un petit pouvoir de jour, une fois par partie, qui anime le débat sans livrer le camp. Textes originaux.
import { metier } from "./aides.mjs";

export const METIERS = [
  metier({
    cle: "forgeron", nom: "Forgeron", effet: "proteger", usages: 1,
    resume: "forge un verrou : la prochaine attaque de loup contre une maison échoue.",
    pouvoir: `Ton marteau s'entend de la place, et ta porte ne ferme jamais tout à fait.

**Une fois par partie**, pendant le jour, tu forges un **verrou** pour la maison d'un joueur (la tienne comprise) : la nuit suivante, la **première attaque de loup** contre cette maison échoue (le poison et le feu passent). Tout le monde sait à qui tu l'as donné.`,
    jour: { invite: "À quelle maison donnes-tu ton verrou ?", cibles: 1 }
  }),
  metier({
    cle: "meuniere", nom: "Meunière", usages: 1,
    resume: "annonce combien de loups vivent encore.",
    pouvoir: `La meule tourne plus lentement quand la meute rôde, tu le sens dans tes bras.

**Une fois par partie**, au début d'un jour, tu demandes au narrateur combien de **loups vivent encore** : il le dit à voix haute, pour tout le village.`,
    jour: { invite: "Veux-tu demander à la meule combien de loups vivent encore ?", cibles: 0 }
  }),
  metier({
    cle: "garde", nom: "Garde du guet", usages: 1,
    resume: "garde un joueur à l'œil : il ne peut visiter aucune autre maison la nuit suivante.",
    pouvoir: `Tu fais la ronde avec ta pique et ton sifflet.

**Une fois par partie**, pendant le jour, tu annonces que tu **gardes un joueur à l'œil** : la nuit suivante, il ne peut utiliser **aucun pouvoir qui vise une autre maison** que la sienne (s'il est loup, la meute chasse sans lui).`,
    jour: { invite: "Qui gardes-tu à l'œil cette nuit ?", cibles: 1 }
  }),
  metier({
    cle: "cure", nom: "Curé", usages: 1,
    resume: "bénit un joueur : il ne peut pas être réduit au silence et parle le premier.",
    pouvoir: `Ta chapelle est froide mais tes mots réchauffent.

**Une fois par partie**, pendant le jour, tu **bénis** un joueur (toi compris) : jusqu'à la fin de la partie, il **ne peut plus être réduit au silence**, et il parle le premier au débat suivant.`,
    jour: { invite: "Qui bénis-tu ?", cibles: 1 }
  }),
  metier({
    cle: "chasseresse", nom: "Chasseresse", effet: "voir-actif", usages: 1,
    resume: "apprend si un joueur a quitté sa maison cette nuit.",
    pouvoir: `Tu lis la boue des chemins comme d'autres lisent l'almanach.

**Une fois par partie**, au matin, tu désignes un joueur : le narrateur dit à tout le village s'il a **quitté sa maison** la nuit passée (pouvoir de nuit ou chasse), sans dire ce qu'il a fait.`,
    jour: { invite: "Quelles traces suis-tu ce matin ?", cibles: 1 }
  }),
  metier({
    cle: "aubergiste", nom: "Aubergiste", usages: 1,
    resume: "offre le gîte : un joueur dort à la Taverne la nuit suivante.",
    pouvoir: `Ta salle est la seule du village où l'on parle à voix haute après la nuit tombée.

**Une fois par partie**, pendant le jour, tu offres le **gîte** à un joueur (toi compris) : la nuit suivante, il dort à la **Taverne** et non chez lui. La meute qui entre dans sa maison la trouve vide (le poison et le feu, eux, l'atteignent). Si la Taverne est en jeu, il y prend l'un des trois lits et sa règle s'applique.`,
    jour: { invite: "À qui offres-tu un lit à la Taverne cette nuit ?", cibles: 1 }
  }),
  metier({
    cle: "apothicaire", nom: "Apothicaire", usages: 1,
    resume: "rend la parole à un joueur réduit au silence.",
    pouvoir: `Sirop de coquelicot, miel et sauge : rien ne résiste à tes pastilles.

**Une fois par partie**, au début d'un débat, tu **rends la parole** à un joueur réduit au silence.`,
    jour: { invite: "À qui rends-tu la voix ?", cibles: 1 }
  }),
  metier({
    cle: "colporteur-de-nouvelles", nom: "Colporteur de nouvelles", usages: 1,
    resume: "obtient du narrateur un indice vrai mais flou sur la nuit.",
    pouvoir: `Tu sais tout avant tout le monde, et tu le dis plus fort.

**Une fois par partie**, au matin, tu demandes au narrateur une **nouvelle** de la nuit : un indice **vrai mais flou**, qu'il annonce à tout le village (« deux maisons voisines ont eu de la visite », « la victime connaissait celui qui l'a trouvée »).`,
    jour: { invite: "Veux-tu crier la nouvelle du matin ?", cibles: 0 }
  }),
  metier({
    cle: "tisserande", nom: "Tisserande", usages: 1,
    resume: "noue un ruban : le joueur désigné au vote gagne une minute de défense.",
    pouvoir: `Ton métier claque du matin au soir, et tu connais tous les fils.

**Une fois par partie**, pendant le jour, tu noues un **ruban** au poignet d'un joueur : s'il est le plus désigné d'un vote, le dépouillement attend : il gagne **une minute de défense** de plus, pendant laquelle le vote reste ouvert. Le ruban ne sert qu'une fois.`,
    jour: { invite: "Au poignet de qui noues-tu ton ruban ?", cibles: 1 }
  }),
  metier({
    cle: "passeur", nom: "Passeur", effet: "proteger", usages: 1,
    resume: "fait traverser un joueur : il ne peut ni être visité ni agir la nuit suivante.",
    pouvoir: `Ta barque connaît la rivière par cœur, même sous la brume.

**Une fois par partie**, pendant le jour, tu fais **traverser la rivière** à un joueur (toi compris) : la nuit suivante, il dort de l'autre côté du **Pont**, hors d'atteinte. Personne ne peut le visiter, mais il ne peut pas agir non plus.`,
    jour: { invite: "Qui fais-tu traverser ce soir ?", cibles: 1 }
  }),
  metier({
    cle: "tanneur", nom: "Tanneur", usages: 1,
    resume: "examine un mort de la nuit : traces de crocs ou non.",
    pouvoir: `Les peaux n'ont plus de secret pour toi, ni celles des bêtes ni celles des gens.

**Une fois par partie**, au matin, tu examines un **mort de la nuit** : le narrateur dit à tout le village s'il porte des **traces de crocs** (la meute) ou non (poison, feu, chagrin, collet).`,
    jour: { invite: "Quel corps examines-tu ce matin ?", cibles: 1 }
  }),
  metier({
    cle: "maitresse-d-ecole", nom: "Maîtresse d'école", usages: 1,
    resume: "fait l'appel : chacun parle trente secondes, à tour de rôle.",
    pouvoir: `Tu as appris à lire à la moitié du village, et l'autre moitié te craint encore.

**Une fois par partie**, au début d'un débat, tu **fais l'appel** : tu désignes qui parle en premier, puis chaque joueur vivant parle **trente secondes**, à tour de rôle, dans l'ordre des maisons, avant le débat libre.`,
    jour: { invite: "Qui parle en premier à l'appel ?", cibles: 1 }
  })
];
