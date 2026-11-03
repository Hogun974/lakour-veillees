// Les journaux des Veillées de fête (visibles) : une illustration en tête (assets/fetes/<fête du calendrier>.jpg), la fête à
// Brumecombe, puis les règles de la veillée pour les joueurs. Les règles sont celles du système (lakour-loups, logique/fetes.mjs) ;
// les conseils au narrateur sont dans son guide (guides.mjs). Les déclinaisons enregistrées auprès du moteur sont dans
// scripts/fetes.js (partagé avec main.js). Textes originaux.
import { journal } from "./aides.mjs";
import { FETES_VEILLEES, imageDeFete } from "../scripts/fetes.js";

const TEXTES = {
  "nuit-des-ames": {
    legende: "Lanternes de navet sur les rebords des fenêtres de Brumecombe, la nuit des âmes.",
    fete: `# Quand les morts reviennent veiller

La dernière nuit d'octobre, Brumecombe laisse ses portes entrebâillées. On creuse des navets, on y pose une chandelle, on les aligne sur les rebords des fenêtres pour que les morts de l'année retrouvent le chemin du coin du feu. On ne leur parle pas : on les écoute.

Les vieilles disent que les âmes ne mentent jamais. Elles disent aussi qu'elles frappent fort, et que dans la brume, les loups entendent toutes les portes.`,
    regles: `# Le murmure des âmes

Après chaque nuit où quelqu'un est mort, l'âme du **premier mort de la nuit** s'assoit au pied du lit d'un **vivant tiré au hasard** (de n'importe quel camp). Elle lui murmure, dans son carnet secret, si **deux autres vivants, tirés au hasard,** sont **du même camp** ou non — tels que les voient les visions : le Loup déguisé y passe pour un homme du Village, le Louvetier pour un loup.

# Les loups entendent

Chaque loup vivant apprend, en secret, **à quelle porte** l'âme a frappé — jamais ce qu'elle a murmuré.

# En pratique

- Une seule âme par nuit, même si plusieurs sont morts ; aucune après une nuit calme, ni quand il reste moins de trois vivants.
- Ce que l'âme murmure est vrai ; ce que vous en répétez ne l'est pas forcément. Un loup qui reçoit un murmure peut le travestir.
- Celui qui a reçu un murmure devient une proie de choix : à lui de choisir quand le dire.
- Le narrateur ne confirme jamais un murmure, ni qui l'a reçu.`
  },
  "veillee-d-hiver": {
    legende: "Le grand feu de la place de Brumecombe, une nuit de neige.",
    fete: `# Le feu de la place

Au plus froid de l'hiver, Brumecombe allume le grand feu sur la place et veille jusqu'au premier chant du coq. On y boit le vin chaud aux épices, on y chante les complaintes de la rivière gelée.

Cette nuit-là passe la Dame aux grelots. Personne ne l'a jamais vue ; on entend seulement ses grelots dans la neige, et au matin, sur un seul seuil du village, il y a un présent. Celui qui le trouve ne le dit pas toujours.`,
    regles: `# Le présent de la Dame aux grelots

À la distribution, **un joueur tiré au hasard** (de n'importe quel camp) reçoit un présent, en secret, dans son carnet. **La première fois qu'un coup mortel le vise la nuit, ce coup échoue** : la meute, la peste, le poison, le feu, la lame d'un tueur. Une seule fois ; il l'apprend au matin, dans son carnet.

Le présent ne protège ni du chagrin d'un amant, ni du vote du village, ni du linceul du Glas du deuil. Et il ne s'ouvre que si rien d'autre ne l'a déjà sauvé : une protection, un remède, un verrou, la Taverne ou la Chapelle passent avant lui.

# La neige efface les traces

À chaque aube, la neige peut tomber (une chance sur trois, jamais deux aubes de suite) ; elle est annoncée à tous. Ce jour-là, elle a recouvert les traces de la nuit :

- la **Chasseresse**, la **Ramoneuse**, le **Tanneur** et le **Colporteur de nouvelles** ne peuvent rien lire (leur pouvoir n'est pas perdu : il attend un matin sans neige) ;
- le **Lavoir** gelé se tait.

# En pratique

- Celui qui se dit gardé par le présent dit peut-être vrai… ou c'est un loup qui veut détourner la meute d'une autre maison.
- La neige ne change rien à la nuit elle-même : seulement à ce qu'on en apprend au matin.
- Le narrateur ne dit jamais qui a reçu le présent, ni s'il s'est ouvert.`
  },
  "carnaval-des-masques": {
    legende: "Le défilé masqué de Brumecombe derrière le mannequin de paille.",
    fete: `# Le défilé derrière le mannequin

Au Mardi gras, Brumecombe défile masquée derrière le mannequin de paille qu'on brûlera au soir. Crécelles, beignets, farine jetée aux passants : pour un jour, le village marche sur la tête et personne n'est tout à fait soi.

On raconte qu'un masque de trop circule chaque année, et que celui qui le porte trompe jusqu'aux devins. Le défilé, lui, montre toujours un visage que personne au village ne porte.`,
    regles: `# Le masque du Carnaval

À la distribution, **un joueur tiré au hasard** (de n'importe quel camp) porte, en secret, le masque du Carnaval ; lui seul le sait (carnet), avec le camp que le masque montrera. **La première vision du Village qui se pose sur lui le voit du camp opposé** à celui qu'elle verrait — la Liseuse de cendres, le Sourcier (« du même camp ? »), la prière de la Pèlerine —, puis le masque tombe, sans bruit : les visions suivantes voient juste. Un homme du Village masqué paraît loup ; un loup masqué paraît du Village.

Le regard de la meute n'est jamais trompé (Loup flaireur, vision du Glas du deuil, loup qui lit pour elle) : elle connaît les siens.

Le masque est sur le visage, pas sur la carte : un échange de rôles ne le déplace pas.

# Le défilé

À la distribution, le narrateur annonce le masque du défilé : **un rôle du Village que personne ne porte**. Si la meute a reçu au moins deux Masques de veillée, c'est l'un d'eux : elle perd cet alibi, jamais le dernier. Quiconque se réclame de ce rôle ment.

# En pratique

- « Je suis masqué ! » est la défense de celui qu'une vision accuse… vraie une fois, peut-être : il n'y a qu'un masque, et il ne trompe qu'une vision.
- Le narrateur ne dit jamais qui porte le masque.`
  },
  "fete-des-promis": {
    legende: "Des rubans noués aux piles du Pont de Brumecombe, à la mi-février.",
    fete: `# Les rubans sous le Pont

À la mi-février, les jeunes gens de Brumecombe descendent sous le Pont nouer des rubans aux piles de pierre, et se promettent l'un à l'autre devant la rivière. On mange le pain d'épice en cœur, on chante faux, on rougit.

Cette année, deux cœurs du village se sont trouvés. Ils ne l'ont dit à personne. Mais dans les roseaux, des yeux jaunes les ont vus s'embrasser.`,
    regles: `# Les promis

À la distribution, **deux joueurs du camp du Village**, tirés au hasard, deviennent promis. Chacun apprend, en secret, le nom de l'autre : un allié sûr, du Village au moment de la distribution.

# La meute les a vus

Chaque loup apprend, en secret, **les deux noms**. Les promis sont des proies de choix… et des cibles faciles à accuser.

# En pratique

- Ce n'est pas un lien d'amour : la mort de l'un ne tue pas l'autre.
- Une morsure peut faire passer un promis dans la meute : sa promesse ne garantit que le passé.
- Deux loups peuvent se dire promis pour se couvrir : les vrais promis savent qu'ils mentent.
- Le narrateur ne confirme jamais une promesse.`
  }
};

// Un journal par veillée : l'illustration, la fête à Brumecombe, les règles.
export const JOURNAUX_DE_FETE = FETES_VEILLEES.map(f => journal({
  cle: f.journal.cle, nom: f.journal.nom, visible: true,
  pages: [
    { titre: f.nom, image: imageDeFete(f.fete), legende: TEXTES[f.id].legende },
    { titre: "La fête à Brumecombe", texte: TEXTES[f.id].fete },
    { titre: "Les règles de la veillée", texte: TEXTES[f.id].regles }
  ]
}));

// Les veillées en une ligne chacune (guides).
export const RESUMES_DE_FETE = {
  "nuit-des-ames": "après chaque nuit meurtrière, l'âme du premier mort murmure à un vivant tiré au hasard si deux autres vivants sont du même camp ; la meute apprend à quelle porte elle a frappé.",
  "veillee-d-hiver": "un joueur tiré au hasard reçoit en secret un présent qui fait échouer le premier coup mortel de la nuit ; à chaque aube, la neige peut tomber (une fois sur trois, jamais deux aubes de suite) et recouvrir les traces (Chasseresse, Ramoneuse, Tanneur, Colporteur de nouvelles, Lavoir).",
  "carnaval-des-masques": "un joueur tiré au hasard porte en secret le masque du Carnaval (la première vision du Village qui le perce le voit du camp opposé, puis le masque tombe ; la meute n'est jamais trompée) ; le défilé montre à tous un rôle du Village que personne ne porte.",
  "fete-des-promis": "deux joueurs du Village tirés au hasard se savent promis l'un à l'autre (un allié sûr) ; la meute connaît leurs deux noms."
};
