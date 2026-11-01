// Villageois non joués de Brumecombe (compendium « villageois ») : des figurants nommés que le narrateur pose sur la
// carte pour animer le village, ou dont il raconte la mort quand il manque de joueurs. Ils n'ont ni rôle ni métier :
// ils ne jouent pas. Leur jeton est celui d'un type de figurant (assets/jetons/figurants.json).
import { villageois } from "./aides.mjs";

export const ACTEURS = [
  villageois({ cle: "frere-anselme", nom: "Frère Anselme, le curé", jeton: "metier-cure", maison: "Chapelle",
    notes: "Un vieux prêtre au dos voûté qui connaît chaque famille depuis trois générations. Il sonne la cloche à l'aube et au couvre-feu, et ne ferme jamais la porte de sa chapelle." }),
  villageois({ cle: "bastien-grenier", nom: "Bastien Grenier, garde du guet", jeton: "metier-garde", maison: "Pont",
    notes: "Il fait la ronde avec sa pique et son sifflet, et ne siffle jamais. On le voit souvent appuyé au parapet du pont, à regarder la brume." }),
  villageois({ cle: "mere-ysaline", nom: "Mère Ysaline, la doyenne", jeton: "villageois", maison: "Puits",
    notes: "La plus vieille du village. Elle passe ses journées sur le banc près du puits et se souvient de « l'autre automne », celui dont personne ne veut parler." }),
  villageois({ cle: "odile-basquin", nom: "Odile Basquin, lavandière", jeton: "figurant-lavandiere", maison: "Lavoir",
    notes: "Elle lave le linge de tout le village et sait donc tout : qui a déchiré sa chemise, qui a du sang sur ses manches, qui a changé de draps deux fois cette semaine." }),
  villageois({ cle: "petit-colin", nom: "Le petit Colin", jeton: "figurant-enfant", maison: "Place du village",
    notes: "Un gamin de huit ans qui court partout et colle son oreille aux portes. Il raconte ce qu'il a vu à qui veut l'entendre, et invente le reste." }),
  villageois({ cle: "gaspard-lerouge", nom: "Gaspard Lerouge, l'aubergiste", jeton: "metier-aubergiste", maison: "Taverne",
    notes: "Gros, rieur, et plus attentif qu'il n'en a l'air. Il ne sert plus à boire après le couvre-feu, mais il laisse la lampe allumée." }),
  villageois({ cle: "la-vieille-noiraude", nom: "Noiraude, le chien des Vaudrey", jeton: "figurant-chien", maison: "Grange",
    notes: "Une chienne de berger noire qui dort devant la grange. Elle aboie à chaque passant… sauf, ces derniers temps, à un seul." })
];
