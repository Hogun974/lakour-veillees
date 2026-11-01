// Les bâtiments de Brumecombe : chaque partie en met 4 à 6 en jeu, et chacun change une règle. Chacun est aussi
// un élément nommé de la carte du village (repere = nom exact de l'élément), où le MJ IA rassemble les jetons
// (« devant la Chapelle »). Textes originaux.
import { batiment } from "./aides.mjs";

export const BATIMENTS = [
  batiment({
    cle: "chapelle", nom: "La Chapelle", repere: "Chapelle", effet: "proteger",
    resume: "le village y met un joueur à l'abri chaque nuit.",
    description: `Une chapelle de pierre grise au nord de la place, avec un clocher trop haut pour elle. La porte n'a jamais eu de serrure.`,
    regle: `**Asile.** Chaque jour, après le vote, le village désigne à main levée (un second vote, rapide) un joueur vivant qui **dormira à la Chapelle** : la meute ne peut pas l'attaquer la nuit suivante. Jamais deux nuits de suite le même joueur. Le poison et le feu passent la porte.`
  }),
  batiment({
    cle: "moulin", nom: "Le Moulin", repere: "Moulin",
    resume: "la meule compte les loups vivants.",
    description: `Le moulin à vent sur la butte de l'ouest. Ses ailes tournent même quand il n'y a pas de vent, disent les enfants.`,
    regle: `**La meule qui compte.** Chaque matin, la Meunière (si quelqu'un a ce métier) apprend en secret le **nombre de loups encore vivants**. Sans Meunière vivante, le narrateur l'annonce à tout le village **un matin sur deux** (après la deuxième nuit, la quatrième…).`
  }),
  batiment({
    cle: "taverne", nom: "La Taverne", repere: "Taverne", effet: "proteger",
    resume: "ceux qui y dorment se protègent, sauf si un loup est parmi eux.",
    description: `La Taverne du Chaudron Fêlé, au bord de la place : trois lits à l'étage, un feu qui ne s'éteint jamais.`,
    regle: `**Dortoir.** Chaque jour, jusqu'à **trois joueurs** peuvent annoncer qu'ils dormiront à la Taverne. La nuit suivante, la meute **ne peut tuer aucun d'eux**… sauf si **un loup** dort parmi eux : alors elle peut y tuer celui de son choix, et aucune protection ne joue. L'hôte de l'Aubergiste prend l'un des trois lits. Le poison et le feu atteignent les dormeurs comme ailleurs.`
  }),
  batiment({
    cle: "gibet", nom: "Le Gibet", repere: "Gibet",
    resume: "une exécution exige la majorité absolue.",
    description: `Une potence de chêne noirci au coin de la place. On ne s'en sert presque jamais, et c'est déjà trop.`,
    regle: `**Majorité absolue.** Pour exécuter un joueur, il faut que **plus de la moitié des vivants** aient voté pour lui. Sinon, personne n'est exécuté ce jour-là.`
  }),
  batiment({
    cle: "puits", nom: "Le Puits", repere: "Puits",
    resume: "un mort peut transmettre un dernier mot.",
    description: `Le vieux puits au milieu de la place. Ceux qui se penchent dessus entendent parfois leur nom.`,
    regle: `**Dernier mot.** **Une fois par partie**, un joueur qui vient de mourir (cette nuit ou ce jour) peut confier au puits un **dernier mot de dix mots au plus**, que le narrateur lit au village. Le premier mort qui le demande l'obtient.`
  }),
  batiment({
    cle: "forge", nom: "La Forge", repere: "Forge",
    resume: "une lame qui blesse la meute.",
    description: `La forge à l'ouest de la place, toujours rouge, toujours chaude. Le forgeron dort à côté de l'enclume.`,
    regle: `**Une lame sous l'oreiller.** **Une fois par partie**, pendant le jour, un joueur peut annoncer qu'il emporte une **lame** de la forge. Si la meute l'attaque la nuit suivante, la lame ne le protège pas (il meurt, sauf protection), mais il **blesse un loup** tiré au hasard parmi ceux qui chassaient : ce loup est **réduit au silence** au jour suivant (le narrateur dit seulement « du sang de bête sur le seuil »).`
  }),
  batiment({
    cle: "cimetiere", nom: "Le Cimetière", repere: "Cimetière",
    resume: "le camp des morts finit par se savoir.",
    description: `Le cimetière derrière la chapelle, ses croix penchées et son if qui ne perd jamais ses aiguilles.`,
    regle: `**Les tombes parlent.** Si les rôles ne sont **pas révélés à la mort**, le narrateur annonce chaque matin le **camp** (pas le rôle) de chaque joueur mort depuis le matin précédent, les morts de la nuit compris. Si les rôles sont révélés à la mort, le Cimetière est sans effet.`
  }),
  batiment({
    cle: "pont", nom: "Le Pont", repere: "Pont",
    resume: "la meute ne traverse pas deux nuits de suite.",
    description: `Le pont de pierre sur la Brume, la rivière qui coupe le village. Les maisons 13 à 18 sont sur l'autre rive.`,
    regle: `**L'autre rive.** Les maisons **13 à 18** sont de l'autre côté du Pont ; environ un tiers des joueurs y dort, quelle que soit la taille du village. Si la meute a tué sur l'autre rive une nuit, elle **ne peut pas traverser** la nuit suivante : aucune maison de l'autre rive ne peut être sa proie.`
  }),
  batiment({
    cle: "lavoir", nom: "Le Lavoir", repere: "Lavoir",
    resume: "chaque matin, un indice vrai mais flou.",
    description: `Le lavoir couvert au bord de la rivière : on y lave le linge, et surtout les réputations.`,
    regle: `**Les bavardages.** Chaque matin, le narrateur rapporte ce qu'on dit au lavoir : un **indice vrai mais flou** sur la nuit passée (« quelqu'un est sorti par la porte de derrière », « la victime avait de la visite deux nuits plus tôt »). Il ne nomme jamais personne.`
  }),
  batiment({
    cle: "grange", nom: "La Grange", repere: "Grange", effet: "proteger",
    resume: "une cachette où l'on ne peut ni être trouvé ni agir.",
    description: `La grange des Vaudrey sur l'autre rive, pleine de foin et de courants d'air.`,
    regle: `**Cachette.** **Une fois par partie et par joueur**, on peut annoncer pendant le jour qu'on se cache dans la Grange : la nuit suivante, on **ne peut pas être trouvé** (aucune visite ne réussit, et le feu d'une maison vide ne tue personne), mais on **ne peut pas agir**. Deux joueurs au plus par nuit.`
  })
];
