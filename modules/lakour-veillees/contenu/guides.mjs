// Journaux des Veillées de Brumecombe : le guide du joueur (visible), le guide du narrateur (caché, lu par le MJ IA),
// les règles des variantes (visibles), le livre de Brumecombe (l'univers, visible : livre-univers.mjs) et les veillées de fête. Les listes de rôles, métiers et bâtiments sont tirées des données mêmes
// (roles.mjs, metiers.mjs, batiments.mjs) : un rôle ajouté apparaît dans les guides. Textes originaux.
import { ORDRE_MEUTE, journal } from "./aides.mjs";
import { ROLES } from "./roles.mjs";
import { METIERS } from "./metiers.mjs";
import { BATIMENTS } from "./batiments.mjs";
import { ALMANACH } from "./tables.mjs";
import { JOURNAUX_DE_FETE, RESUMES_DE_FETE } from "./fetes.mjs";
import { FETES_VEILLEES } from "../scripts/fetes.js";
import { LIVRE_DE_BRUMECOMBE } from "./livre-univers.mjs";
import { CARTES_DE_LA_GAZETTE, SEANCES_DE_SPIRITISME } from "./gazette.mjs";

const ligne = d => `- **${d.name}** — ${d.__resume}`;
const rolesDu = camp => ROLES.filter(r => r.system.camp === camp);

// HTML d'un objet (html() de aides.mjs) -> texte de page (gras, italique, paragraphes), que journal() remet en HTML.
const versTexte = h => String(h).replace(/<\/p><p>/g, "\n\n").replace(/<br>/g, "\n").replace(/<\/?strong>/g, "**").replace(/<\/?em>/g, "*")
  .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);

// Une page par bâtiment, en fin de guide du joueur (titre = nom du bâtiment) : l'épingle du bâtiment sur la carte du
// village y mène (village.mjs). Textes repris de batiments.mjs, sans règle nouvelle.
const pageDuBatiment = b => ({
  titre: b.name,
  texte: `${versTexte(b.system.description)}

# En jeu

*${majuscule(b.__resume)}*

${versTexte(b.system.regle)}`
});

// Les nouveaux visages de la veillée (0.6.0) : leur texte complet, repris des objets (roles.mjs, metiers.mjs), en dernière
// page du guide du joueur (après les pages des bâtiments, pour garder leurs identifiants et les épingles de la carte).
// Le Pacte, étape 3a : les gens du village revenus des veillées d'autrefois (le jeu de soirée), à la suite. Pas encore dans les
// compositions prêtes (l'étape 6 les y fera entrer) : le générateur les tire aux niveaux classique et chaos.
export const ROLES_DU_PACTE = ["franc-villageois", "aieul", "souffre-douleur", "innocent", "lavandiere", "bucheron", "furet", "gardeuse-d-oies",
  "greffier-begue", "vieux-sergent", "pie"];
// Le Pacte, étape 3b : les ambigus (ils peuvent changer de camp ou de rôle), les solitaires du livre et le Loup pâle. Comme ceux de
// l'étape 3a, hors des compositions prêtes et de la petite tablée ; le générateur les tire aux niveaux classique et chaos.
export const AMBIGUS_DU_PACTE = ["chapardeur", "bateleur", "matin", "enfant-des-bois", "chambriere"];
export const SOLITAIRES_DU_PACTE = ["feu-follet", "joueur-de-vielle", "illumine"];
export const LOUPS_DU_PACTE = ["loup-pale"];
export const ROLES_DU_PACTE_3B = [...AMBIGUS_DU_PACTE, ...SOLITAIRES_DU_PACTE, ...LOUPS_DU_PACTE];
// Le Pacte, étape 9 : la Liseuse d'étoiles (le Spiritisme), hors des compositions prêtes (sauf Le Pacte) et de la petite tablée.
export const ROLES_DU_PACTE_9 = ["liseuse-d-etoiles"];
export const NOUVEAUX_ROLES = ["loup-des-roseaux", "louvetier", "pecheur-de-nuit", "dame-du-gue", ...ROLES_DU_PACTE, ...ROLES_DU_PACTE_3B, ...ROLES_DU_PACTE_9];
export const NOUVEAUX_METIERS = ["ramoneuse", "eclusiere"];
const CAMP_LISIBLE = { meute: "camp de la Meute", village: "camp du Village", solitaire: "solitaire" };
const ficheDuRole = r => `## ${r.name} (${CAMP_LISIBLE[r.system.camp]})

*${majuscule(r.__resume)}*

${versTexte(r.system.description)}${r.system.victoire ? `

**Victoire.** ${versTexte(r.system.victoire)}` : ""}`;
const ficheDuMetier = m => `## ${m.name} (métier public)

*${majuscule(m.__resume)}*

${versTexte(m.system.description)}`;
const pageDesNouveaux = () => ({
  titre: "Nouveaux visages de la veillée",
  texte: `# Ce que la brume a ramené

Quatre rôles et deux métiers venus des berges de la Brume, et onze gens du village revenus des veillées d'autrefois ; puis neuf autres de ces veillées : cinq visages changeants qui peuvent passer d'un camp à l'autre (le Chapardeur, le Bateleur, l'Enfant des bois, le Mâtin, la Chambrière), trois solitaires (le Feu follet, le Joueur de vielle, l'Illuminé), un loup qui ne chasse que pour lui (le Loup pâle), et la Liseuse d'étoiles, qui fait parler les morts. Ils ne sont pas dans toutes les compositions, et le narrateur ne dit jamais lesquels sont en jeu : à vous de le deviner (seul le Franc-Villageois se montre de lui-même ; les cartes du Bateleur, le jour qui ouvre la veillée du Feu follet et les deux bords de l'Illuminé s'annoncent aussi).

${[...NOUVEAUX_ROLES.map(c => ficheDuRole(ROLES.find(r => r.system.cle === c))),
  ...NOUVEAUX_METIERS.map(c => ficheDuMetier(METIERS.find(m => m.system.cle === c)))].join("\n\n")}`
});

// L'ordre d'appel du jeu de soirée (Le Pacte, étape 5 ; docs/plan-le-pacte.md), dans nos noms : celui que suivent les ordres de nuit
// des rôles du livre (roles.mjs). Les étapes sans réveil propre (les amoureux, le signe du Greffier, les oies, la Fournière) y sont
// dites telles que le système les mène.
export const ORDRE_D_APPEL = {
  premiere: ["le Chapardeur", "le Bateleur", "l'Entremetteuse", "la Liseuse de cendres", "le Furet",
    "les amoureux (le système leur souffle leur lien au carnet)", "le Greffier bègue (son signe, ici un pouvoir de jour secret)",
    "les Lavandières", "les Bûcherons", "l'Enfant des bois", "la Gardeuse d'oies (au matin)", "la Pie", "l'Incendiaire", "le Garde du pont",
    "la meute (avec le Mâtin s'il l'a rejointe)", "l'Enfant de la brume", "la Fournière (le système lui souffle ce qu'elle entrevoit)",
    "la Louve mère", "le Loup affamé", "l'Herboriste", "la Liseuse d'étoiles", "le Joueur de vielle", "les charmés"],
  chaque: ["le Bateleur", "la Liseuse de cendres", "le Furet", "la Pie", "l'Incendiaire", "le Garde du pont", "la meute", "l'Enfant de la brume",
    "la Fournière", "le Loup pâle (une nuit sur deux)", "la Louve mère", "le Loup affamé (tant qu'aucun loup n'est mort)", "l'Herboriste",
    "la Liseuse d'étoiles", "le Joueur de vielle", "les charmés"],
  jour: ["les victimes révélées", "le grognement des oies", "la carte de la Gazette de la lune", "le Spiritisme", "le Crieur public", "le débat",
    "le vote, et l'appel à la Chambrière", "le Feu follet (s'il tombe au premier tour)", "le second vote du Greffier bègue"]
};

// Ordre de réveil, calculé depuis les rôles : la meute groupée à 40, puis chaque rôle qui agit seul.
export function ordreDeReveil() {
  const actifs = ROLES.filter(r => r.system.nuit.actif);
  const etapes = new Map();
  for (const r of actifs) {
    const o = r.system.nuit.ordre;
    const nom = o === ORDRE_MEUTE && r.system.camp === "meute" ? "La meute (tous les loups vivants)" : r.name;
    const precisions = [r.system.nuit.premiereNuitSeulement && "première nuit seulement", r.system.nuit.uneNuitSurDeux && "une nuit sur deux",
      r.system.nuit.nuitsImpaires && "la première nuit, puis une nuit sur deux",
      r.system.nuit.tantQueMeuteEntiere && "tant qu'aucun loup n'est mort"].filter(Boolean);
    const texte = `${nom}${precisions.length ? ` (${precisions.join(", ")})` : ""}`;
    etapes.set(`${o}:${nom}`, { o, texte, invite: o === ORDRE_MEUTE && r.system.camp === "meute" ? "Quelle maison la meute visite-t-elle cette nuit ?" : r.system.nuit.invite });
  }
  return [...etapes.values()].sort((a, b) => a.o - b.o);
}

// ======================================================================= Guide du joueur (visible)

const guideJoueur = journal({
  cle: "guide-du-joueur", nom: "Les Veillées de Brumecombe — Guide du joueur", visible: true,
  pages: [
    {
      titre: "Bienvenue à Brumecombe",
      texte: `# Un village dans la brume

Brumecombe est un village de fond de vallée, coupé du monde chaque automne par une brume si épaisse qu'on n'y voit pas sa propre main. Une rivière, la Brume, le traverse ; un pont de pierre relie les deux rives. Il y a une chapelle, un moulin, une taverne, une forge, un cimetière et dix-huit maisons aux volets clos.

Cet automne, on a retrouvé le berger de la Combe-aux-Sorbiers dans le fossé, la gorge ouverte. Ce n'était pas un loup des bois : les loups des bois n'ouvrent pas les loquets.

**Certains d'entre vous sont des loups.** Le jour, ils parlent, votent et pleurent avec les autres. La nuit, ils entrent dans les maisons. Les autres ont une seule arme : la parole, et le vote du village.

# Le principe

- Chaque joueur reçoit en secret un **rôle** : il dit dans quel camp il joue et quel pouvoir il a.
- Chaque joueur reçoit aussi un **métier**, public : tout le monde sait qui est le forgeron ou la meunière. Le métier ne dit rien du camp.
- La partie alterne **nuits** (les rôles agissent en secret) et **jours** (le village débat, puis vote pour exécuter un suspect).
- Un **narrateur** mène la partie : c'est le MJ, humain ou IA. Il connaît tous les rôles et ne ment jamais sur les règles.

# Les camps

- **Le Village** gagne quand **plus aucun loup** ne vit.
- **La Meute** gagne quand les loups sont **aussi nombreux** que tous les autres vivants réunis.
- **Les solitaires** ont chacun leur propre condition de victoire, écrite sur leur rôle.
- **Les amants** (liés par l'Entremetteuse) : du même camp, ils gagnent avec lui ; de camps différents, ils ne gagnent qu'ensemble, en restant les deux derniers vivants.

Il arrive, rarement, qu'il n'y ait **aucun loup** : c'est la **peste noire** (voir la page qui lui est consacrée).`
    },
    {
      titre: "Déroulement d'une partie",
      texte: `# La préparation

Le narrateur choisit une composition (selon le nombre de joueurs et le niveau), met 4 à 6 **bâtiments** en jeu, puis distribue en secret un rôle et un métier à chacun. Chacun reçoit son rôle en **message privé** et voit sa fiche ; personne d'autre ne la voit. Chacun a une **maison** sur la carte du village (« Maison 1 » à « Maison 18 »).

La composition reste **secrète** : le narrateur n'annonce ni les rôles en jeu, ni le nombre de loups. Seuls les bâtiments sont connus de tous. Le reste, le village le découvre en jouant.

# La nuit

Le narrateur annonce la nuit. Tout le monde « ferme les yeux » : on se tait, on n'écrit plus sur le canal commun.

Le narrateur réveille les rôles **un par un, dans l'ordre**, toujours en secret : une **fenêtre de choix** s'ouvre chez le joueur concerné, avec une question (« Quelle maison éclaires-tu cette nuit ? ») et la liste des joueurs. Il choisit, ou il passe. Les loups se réveillent ensemble et votent pour leur victime ; à égalité, le premier choix l'emporte.

Si ta fenêtre ne s'ouvre pas, c'est que ton rôle ne joue pas cette nuit. Ne le dis à personne.

# L'aube

Le narrateur raconte ce que le village découvre au matin : qui est mort, et parfois comment. Selon le réglage, le **rôle des morts est révélé** ou non. Un mort ne parle plus aux vivants et ne doit plus rien leur révéler (il peut regarder la partie, et parler aux autres morts dans leur salon). Avec le **Dernier souffle** (réglage, par défaut oui), il garde **une seule voix** pour un vote d'exécution, à utiliser quand il veut : son bandeau le lui rappelle, et le Registre la note « dernier souffle » au dépouillement. Tant qu'il garde cette voix, il ne voit pas les rôles cachés et n'entend pas la meute la nuit, même si les morts « voient tout » : il voterait en connaissant les loups. Une fois sa voix rendue, il rejoint les morts qui voient tout.

# Le jour

Le village **débat** : on accuse, on se défend, on ment ou l'on dit vrai. Le débat est minuté (cinq minutes par défaut, moins quand il reste peu de joueurs).

Les **pouvoirs de jour** (ton métier, quelques rôles comme le Juge de paix ou la Conteuse, et certains bâtiments) se jouent pendant le jour : clique sur ton pouvoir dans la **Table de jeu**, ou annonce-le au narrateur à voix haute. Le système vérifie que c'est le bon moment, applique l'effet et l'annonce au village. Un pouvoir « une fois par partie » ne revient pas.

# Le Bailli

Le premier jour, avant le premier vote d'exécution, le village **élit son Bailli** par un vote à part : chacun désigne son candidat (on peut voter pour soi), le plus désigné prend le **sceau du village** ; à égalité, le sort choisit entre les ex æquo. Le Bailli est **public** : son nom est sur la Table de jeu et dans le bandeau, son sceau sur son jeton.

- Au vote d'exécution, **sa voix compte double**.
- En cas d'**égalité**, c'est **lui qui tranche** : s'il a voté pour l'un des ex æquo, c'est celui-là, sans rien lui demander ; sinon, une fenêtre s'ouvre chez lui seul, avec les ex æquo ; il désigne le condamné (même lui-même), ou passe, et alors personne n'est exécuté.
- À **sa mort**, il **remet le sceau** à un vivant de son choix (une dernière fenêtre, depuis la tombe). S'il ne choisit personne, la charge reste vacante et le village élit un nouveau Bailli au jour suivant (le jour même, si l'on n'a pas encore voté).

Un Bailli peut être un loup : le village l'a choisi, à lui de bien choisir.

# Le vote

Le narrateur ouvre le **vote** : chaque vivant clique sur un nom dans la fenêtre de vote (ou sur la Table de jeu). On peut changer d'avis jusqu'à la clôture. Les voix restent **secrètes jusqu'au dépouillement** : on voit seulement qui a déjà voté. Au dépouillement, le joueur qui a **le plus de voix est exécuté** et quitte la partie — sauf si le **Juge de paix** annule le vote (le village revote aussitôt) ou si le plus désigné porte le **ruban de la Tisserande** (une minute de défense de plus, le vote reste ouvert). Après la clôture, chacun peut relire **qui a voté pour qui** dans le Registre du greffier.

Si la **Chapelle** est en jeu, un second vote, rapide, désigne ensuite qui dormira à l'abri la nuit suivante.

Si la **Rosière** est exécutée par le vote, le serment de Brumecombe est rompu : **le Village perd aussitôt**. Réfléchis avant de condamner quelqu'un qui s'en réclame… et souviens-toi qu'un loup peut mentir.

Avec la variante **Banc des accusés**, on ne vote pas pour n'importe qui : pendant le débat, chaque vivant **accuse une fois** (champ « Accuser » de la Table de jeu), et chacun ne peut être accusé qu'une fois par jour. Les accusés sont **jugés un par un** : voter pour l'accusé, c'est le condamner ; s'abstenir, c'est l'acquitter. Il faut **la moitié des voix des vivants** (plus de la moitié avec le Gibet) ; dès qu'un accusé est exécuté, les autres sont tirés d'affaire pour la journée.

Avec la variante **Glas du deuil**, chaque innocent exécuté par le vote fait sonner le glas sur Brumecombe (« le glas sonne pour la 2e fois »). Le village n'apprend rien de plus… mais la meute, elle, y gagne un pouvoir qui grandit à chaque glas. Méfiez-vous des votes hâtifs.

**Arriver en cours de partie** : un joueur qui arrive après la distribution entre comme **gens de passage** (Rémouleur, Montreur de marmotte ou Pèlerine) : son **rôle est connu de tous**, son **camp ne l'est pas** (le narrateur le lui dit en secret, et il peut être de la meute). Son pouvoir est fort mais ne sert **qu'une fois**, pendant le jour. Le village peut le chasser par un **vote d'exil** : il reprend la route sans mourir, son camp tu.

**Partir avant la fin** : le bouton **Quitter la veillée** (Table de jeu) te fait quitter la partie sans mourir : ni ton rôle ni ton camp ne sont révélés, ta voix en cours est retirée, et la partie continue sans toi (tu ne gagnes ni ne perds).

**Égalité** : s'il y a un **Bailli**, il tranche (sa propre voix d'abord, si elle allait à l'un des ex æquo). Sans Bailli (charge vacante, ou Bailli absent de la partie), les ex æquo ont trente secondes chacun pour se défendre, puis le village revote **entre eux seulement** ; nouvelle égalité : personne n'est exécuté ce jour-là, et la nuit tombe.

Puis la nuit revient, et ainsi de suite jusqu'à la victoire d'un camp.`
    },
    {
      titre: "Dans Foundry",
      texte: `# Ce que tu vois

- **La carte du village** : chaque joueur a son jeton devant sa maison. Les jetons montrent un **villageois encapuchonné** tant que le rôle n'est pas révélé ; à la mort (si les rôles sont révélés), le jeton prend l'image du rôle.
- **La Table de jeu** (bouton dans les contrôles du calque Jetons) : la phase, le tour, le minuteur, qui vit et qui est mort, les métiers, les bâtiments en jeu, **tes pouvoirs de jour** (un bouton par pouvoir, grisé quand ce n'est pas le moment), ce qui vaudra la nuit prochaine (verrous, Taverne, Grange…), et pendant un vote, les boutons de vote.
- **Le Registre du greffier** (sur la Table de jeu) : la mémoire publique de la veillée (voir plus bas).
- **Ta fiche** : ton rôle et ton pouvoir (toi seul et le narrateur les voyez), ton métier (public).
- **La fenêtre de choix de nuit** : elle ne s'ouvre que chez toi, et rien n'apparaît chez les autres. Si le Messager te choisit comme expéditeur, elle te demande d'écrire ta phrase.

# Les messages privés

Le narrateur te parle en message privé pour tout ce qui est secret : ton rôle, ce que tu apprends la nuit, le mot que te porte le Messager. Tout arrive dans ton **carnet secret** (bouton de la Table de jeu), envoyé à toi seul. **Ne recopie jamais un message privé sur le canal commun** : dire ce que tu sais, c'est ton droit ; montrer la preuve, c'est interdit.

# L'Almanach des brumes

Dans les veillées qui jouent cette variante, chaque aube apporte un **présage**, annoncé à tous et rappelé en tête de la Table de jeu : il change la règle du jour (vote à main levée, deux condamnés, majorité absolue, pas de déclaration au Registre…) ou de la nuit suivante (givre, crue). La liste est dans les Variantes.

# Le Registre du greffier

Le greffier de Brumecombe note tout ce qui est public : **chaque vote clos, voix par voix** (la voix double du Bailli, son départage), **chaque mort** avec sa cause connue de tous (une mort de la nuit reste « tuée dans la nuit »), l'élection et la succession du Bailli. Tu le retrouves sur la Table de jeu, les entrées les plus récentes en haut.

Pendant le jour, tant que tu es vivant et que tu peux parler, tu peux y **faire inscrire une déclaration** courte (trois par jour) : « Je me dis Liseuse de cendres, j'ai lu la Maison 4 : elle est du village. » Elle est lue par tout le village et annoncée au chat. **Le greffier ne vérifie rien** : une déclaration engage celui qui l'écrit, rien de plus. Les loups aussi écrivent au Registre.

# Le savoir-vivre de la veillée

- Pendant la nuit, silence sur le canal commun et sur la voix.
- Pas de capture d'écran de ta fiche ni de ta fenêtre de choix.
- Mentir sur ton rôle est permis, et même attendu. Tricher en dehors du jeu ne l'est pas.
- Les morts se taisent. Ils peuvent rire, mais en silence.
- On attaque des rôles, pas des personnes.

# Le cri de la peste noire

Pendant le jour, chaque vivant voit dans son bandeau (et sur la Table de jeu) le bouton **« C'est la peste noire ! »**. Il est là dans toutes les parties : son seul aspect ne dit rien. Ne le presse que si tu es sûr de toi (voir la page « La peste noire »).

# Les compagnons IA

Pour compléter une petite table, le narrateur peut donner des places à des **compagnons IA** : des villageois joués par une IA, comme des joueurs. Ils reçoivent un rôle en secret, choisissent la nuit, parlent au débat et votent. Ils ne trichent pas : un compagnon ne sait que ce que sait son villageois (son rôle, son carnet, ce qui se dit en public). Soupçonne-les, crois-les ou mens-leur comme à n'importe qui.`
    },
    {
      titre: "La peste noire",
      texte: `# Une veillée sans loups

Il arrive, rarement, qu'une veillée n'ait **aucun loup**. Les rôles sont tous du village (et parfois des solitaires), les métiers et les bâtiments sont les mêmes que d'habitude. Mais chaque nuit, quelqu'un meurt quand même : c'est la **peste noire**.

- La première nuit, le narrateur guide la fièvre vers sa première maison.
- Ensuite, c'est **sa dernière victime** qui, depuis la tombe, désigne en secret la suivante. Si tu meurs de la peste, tu l'apprends dans ton carnet secret, et c'est à toi de choisir la nuit suivante. Les morts ne parlent pas aux vivants : garde-le pour toi et pour les autres morts.
- Une victime de la peste est annoncée **comme une victime des loups** : « tuée dans la nuit ». Les protections (garde, remède, verrou, asile de la Chapelle, Taverne, Grange, Passeur) la sauvent comme elles sauveraient d'une attaque de loup.
- Les rôles d'information fonctionnent comme toujours. Simplement, ils ne trouveront **jamais** de loup.

# Crier « C'est la peste noire ! »

Pendant le jour (l'aube, le débat ou le vote), tout vivant qui n'est pas réduit au silence peut crier **« C'est la peste noire ! »** (bouton du bandeau, de la Table de jeu, ou à voix haute au narrateur).

- **Si c'est vrai**, la partie s'arrête aussitôt : **le village gagne**.
- **Si c'est faux**, le crieur est **pendu pour avoir semé la panique**. On ne crie donc pas au hasard.

# Si personne ne la reconnaît

Quand il ne reste qu'un seul vivant, ou plus personne, **la peste l'emporte** : Brumecombe s'éteint dans la fièvre, et tout le village a perdu.`
    },
    {
      titre: "Les rôles de la Meute",
      texte: `# La Meute

Les loups se reconnaissent dès la première nuit. Chaque nuit, **ils se réveillent ensemble** et désignent une victime. Certains loups ont en plus un pouvoir propre : ils se réveillent une seconde fois, seuls.

**Les Masques de veillée** : à la distribution, la meute reçoit dans le carnet secret de chaque loup deux ou trois rôles du Village **absents de la partie**. Se dire l'un d'eux est sans risque : personne ne viendra se réclamer du même rôle. Accordez-vous avant de vous en servir. (Un villageois qui rejoint la meute reçoit les mêmes ; dans une veillée sans loups, il n'y en a pas.)

${rolesDu("meute").map(ligne).join("\n")}`
    },
    {
      titre: "Les rôles du Village",
      texte: `# Le Village

Le village gagne quand plus aucun loup ne vit. La plupart de ses rôles ont un pouvoir, de nuit ou de jour ; certains n'en ont aucun.

${rolesDu("village").map(ligne).join("\n")}`
    },
    {
      titre: "Les solitaires",
      texte: `# Les solitaires

Ils ne jouent ni pour le village ni pour la meute. Chacun a sa propre condition de victoire.

${rolesDu("solitaire").map(r => `${ligne(r)} *Victoire :* ${r.system.victoire.replace(/<[^>]+>/g, "")}`).join("\n")}`
    },
    {
      titre: "Les métiers",
      texte: `# Les métiers publics

Chaque joueur a un métier, **connu de tous**. Il donne un petit pouvoir de **jour**, en général **une fois par partie** : on l'annonce à voix haute au narrateur. Un métier ne dit rien du camp : la meunière peut être une louve.

${METIERS.map(ligne).join("\n")}`
    },
    {
      titre: "Les bâtiments",
      texte: `# Les bâtiments en jeu

Chaque partie met **4 à 6 bâtiments** en jeu : le narrateur les annonce au début, et la Table de jeu les rappelle. Chacun change une règle. Sur la carte, chaque bâtiment est un lieu du village où l'on peut se retrouver.

${BATIMENTS.map(b => `- **${b.name}** — ${b.__resume} ${b.system.regle.replace(/<[^>]+>/g, "")}`).join("\n")}`
    },
    ...BATIMENTS.map(pageDuBatiment),
    pageDesNouveaux(),
    {
      titre: "Les veillées de fête",
      texte: `# Quand Brumecombe fait la fête

Aux grandes fêtes de l'année, le narrateur peut proposer une **veillée de fête** : une variante de saison, annoncée au début de la partie et rappelée sur la Table de jeu. Il n'y en a jamais qu'une à la fois, et jamais d'office : c'est le narrateur qui décide, même le jour de la fête.

${FETES_VEILLEES.map(f => `- **${f.nom}** — ${RESUMES_DE_FETE[f.id]}`).join("\n")}

Chacune a son journal, « ${FETES_VEILLEES[0].journal.nom.split(" — ")[0]} — … », avec ses règles complètes. Ce qu'une veillée vous apprend en secret arrive dans votre carnet secret, comme le reste ; le narrateur ne confirme jamais un secret de fête, même quand quelqu'un s'en réclame.`
    },
    // La petite tablée (0.11.0), en dernière page : les pages précédentes gardent leur identifiant (épingles de la carte).
    {
      titre: "La petite tablée",
      texte: `# Une veillée à peu d'humains

Vous n'êtes que deux ou trois autour du narrateur ? La **petite tablée** est faite pour vous : de **1 à 4 joueurs humains**, complétés par **2 à 8 joueurs IA** (les compagnons, qui tiennent une place comme n'importe quel villageois : ils agissent la nuit, parlent au débat et votent), pour **4 à 12 places** en tout. Le narrateur la choisit à la préparation (niveau **« Petite tablée »**), et la Table de jeu l'annonce à tous : ses règles sont publiques. Ce qui ne l'est pas, c'est qui tient quoi.

# Ses règles

- **La meute est courte** : un seul loup jusqu'à sept places, deux jusqu'à dix, trois au-delà. Mais le village n'a presque **pas de simples villageois** : chacun ou presque a un pouvoir, et quelque chose à faire la nuit.
- **Le régime des deux loups** (huit places et plus) : la **première nuit est blanche** (la meute se reconnaît, mais ne chasse pas : le village a un débat avant le premier sang), et la meute ne l'emporte que lorsqu'elle est **plus nombreuse** que tous les autres vivants réunis — à égalité (deux loups, deux autres), la veillée continue et le village a encore un vote. À un seul loup, les règles ordinaires : la meute gagne dès qu'elle égale les autres.
- **Le partage des camps, ce qui est garanti.** Les joueurs humains ne sont **jamais tous loups** ; à trois humains ou plus, ils ne sont **jamais tous du même camp** (ni tous du Village, ni tous de l'ombre). Dès six places, il y a toujours **au moins deux rôles de l'ombre** en jeu (les loups, et un solitaire qui ne tue pas : le Colporteur ; quatre à onze et douze places), parfois un de plus.
- **Le partage des camps, ce qui est favorisé sans être garanti.** À chaque distribution, le narrateur (le système) tire en secret s'il impose ou non deux penchants : **une lanterne chez un humain** (un rôle d'information — Liseuse de cendres, Sourcier, Veilleuse de lanterne, Fossoyeur, Ermite, Enfant de la brume, Louvetier — tenu par un humain du Village, une fois sur deux) et, à trois humains ou plus, **l'ombre des deux côtés de la table** (un rôle de l'ombre chez les humains ET chez les compagnons, une fois sur deux). Le reste du tirage est libre : les rôles vont au hasard, aux humains comme aux compagnons.
- **Pas de jour sans verdict.** Au vote d'exécution, une **égalité** en tête que le Bailli ne tranche pas (pas de Bailli, ou il passe) est tranchée **par le sort** parmi les ex æquo. On vote chaque jour, et chaque vote compte.
- **Le glas final est posé d'office** : la veillée s'arrête au soir du jour 3 jusqu'à six places, puis un jour de plus par deux places (jour 4 à huit places, jour 6 à douze). Si un loup vit encore à ce soir-là, la meute l'emporte : le village n'a pas le temps de tergiverser.
- **Les compagnons vous parlent.** Les joueurs IA s'adressent d'abord aux humains : ils vous accusent, vous défendent, vous questionnent, plutôt que de discuter entre eux.

Ni Loup déguisé (il rendrait la seule lanterne aveugle), ni Pyromane ni Dame du gué (trop pour une tablée de six), ni Gibet ni Pont. Le reste est une veillée ordinaire : métiers publics, bâtiments, Bailli, Masques de veillée, Dernier souffle si le réglage le veut.

# Ce qu'on en déduit, et ce qu'on n'en déduit pas

Ce que la règle garantit, tu peux t'en servir : si tu es loup, ton ami humain n'est pas loup (à deux) ; à trois humains ou plus, si tu es du Village, **l'un de tes amis au moins n'en est pas** — sans savoir lequel, ni s'il est loup ou Colporteur (qui, s'il a échangé son rôle, gagne avec son nouveau camp) — et si tu es de l'ombre, l'un d'eux au moins est du Village. Mais dès qu'un camp humain se dévoile (un mort révélé, une lanterne lue), la règle fait le reste : à trois humains, si tu es du Village et qu'un ami l'est aussi, le troisième est de l'ombre. Rien de plus n'est certain : à deux humains, vous pouvez être tous deux du Village ; l'ombre peut être toute entière chez les compagnons, ou toute entière chez les humains ; la lanterne peut être chez un compagnon, et celui qui jure n'avoir rien vu peut être celui qui a tout vu. Un loup peut se réclamer de la lanterne : rien ne le contredit.`
    }
  ]
});

// ======================================================================= Guide du narrateur (caché)

const guideNarrateur = journal({
  cle: "guide-du-narrateur", nom: "Les Veillées de Brumecombe — Guide du narrateur", visible: false,
  pages: [
    {
      titre: "Le métier de narrateur",
      texte: `# Ce que tu fais

Tu es la voix de Brumecombe. Tu ne joues pour aucun camp : tu fais **vivre le village**, tu **gardes les secrets**, et tu fais **respecter le rythme**. Tu connais tous les rôles ; personne ne doit pouvoir le deviner à ta façon de parler.

- Tu annonces la nuit et le jour, tu réveilles les rôles en secret, tu racontes les morts à l'aube.
- Tu animes le débat sans jamais orienter le vote.
- Tu dépouilles les votes et tu tranches les cas difficiles avec ce guide.
- Tu tiens la **chronique** : chaque nuit, chaque mort, chaque vote, pour pouvoir raconter « Précédemment… ».

# Les trois règles d'or

- **Le secret avant tout.** Un rôle ne se dit qu'au joueur concerné, en message privé. Jamais sur le canal commun, jamais par sous-entendu.
- **La même voix pour tous.** Tu réveilles chaque rôle de la même façon, avec le même temps d'attente, même s'il est mort (pour qu'on ne devine pas qui vit encore parmi les rôles). Tu racontes une mort de loup avec le même ton qu'une mort de villageois.
- **Les règles, pas les préférences.** Quand un cas n'est pas prévu, tranche vite, dis-le simplement, et applique la même décision jusqu'à la fin.`
    },
    {
      titre: "Préparer la partie",
      texte: `# La composition

Les compositions toutes prêtes vont de 6 à 18 joueurs, en trois niveaux :
- **Débutants** : loups simples, pouvoirs faciles à expliquer, aucun solitaire. Pour une première partie ou un groupe qui découvre.
- **Classique** : un ou deux loups spéciaux, un ou deux solitaires au-delà de dix joueurs. La partie de tous les jours.
- **Chaos** : loups spéciaux, solitaires, pouvoirs qui se croisent. Pour un groupe qui connaît bien le jeu, et un narrateur sûr de lui.

Chaque composition indique ses bâtiments (4 à 6). Tu peux en changer un, en annonçant la liste avant la distribution.

# La petite tablée

Pour **1 à 4 humains et 2 à 8 compagnons IA** (4 à 12 places) : le niveau **« Petite tablée »** de la Table de jeu (ou les compositions prêtes « Petite tablée — n places »). Ses règles sont **publiques** (page « La petite tablée » du guide du joueur) : meute courte (1 loup jusqu'à 7 places, 2 jusqu'à 10, 3 au-delà), au régime des deux loups dès 8 places (première nuit blanche, et la meute doit être PLUS nombreuse que les autres pour l'emporter), au moins deux rôles de l'ombre dès 6 places (quatre à 11 et 12 : trois loups et le Colporteur), presque pas de simples villageois, ni Loup déguisé ni tueur solitaire, ni Gibet ni Pont ; le **tirage est contraint** (garanti : les humains jamais tous loups, ni tous du même camp à trois ou plus ; favorisé sans garantie, tiré en secret à chaque partie : une lanterne chez un humain du Village, l'ombre des deux côtés de la table à trois humains ou plus — jamais une déduction certaine) ; **le sort tranche** les égalités que le Bailli ne tranche pas ; le **glas final** est posé d'office (jour 3 jusqu'à 6 places, puis un jour de plus par deux places). Le réglage du monde « Petite tablée par défaut » se souvient du dernier niveau choisi : « Rejouer » et le MJ IA composent alors une petite tablée.

Ce que tu dis : la règle, et rien d'autre. **Jamais** de qui l'ombre est tombée chez les humains, ni qui tient la lanterne, ni si les penchants favorisés ont été appliqués cette fois : le tirage contraint ne s'annonce que par ses nombres (le système le fait pour toi, en n'annonçant que ce qui vaut pour cette table). Le Glas final : 0 à la distribution veut dire « posé d'office » ; un jour donné est gardé tel quel. Les compagnons IA y parlent d'abord aux humains : laisse-les faire, ne les relance pas pour un humain silencieux.

**Ne révèle jamais la composition** : ni les rôles en jeu, ni le nombre de loups. Les bâtiments, eux, sont publics. Une partie peut même n'avoir aucun loup (la **peste noire**, page suivante) : rien ne doit le laisser deviner.

# La distribution

- Distribue les rôles et les métiers au hasard (la Table de jeu s'en charge). Chaque joueur reçoit son rôle en message privé.
- Attribue une maison à chacun, dans l'ordre (« Maison 1 », « Maison 2 »…). Avec le Pont en jeu, rappelle que les maisons 13 à 18 sont sur l'autre rive.
- **Chasseur de primes** : tire sa cible au hasard parmi les autres joueurs (jamais un loup si possible, pour que la partie reste ouverte), et donne-la-lui la première nuit.
- Annonce les **bâtiments en jeu** et les **variantes** choisies (révélation à la mort, durée du débat, **Bailli**).
- **Masques de veillée** (réglage, par défaut oui) : le système remet en secret à chaque loup deux ou trois rôles du Village absents de la partie (trois pour une meute, deux pour un loup seul ; jamais dans une peste noire). Tu les vois dans ta chronique secrète ; ne les cite jamais, ne les confirme ni ne les démens.
- **Chapardeur** : le paquet compte deux cartes Villageois de plus ; les deux cartes que la distribution ne donne pas restent au centre, face cachée (le système les garde en secret). **Bateleur** : trois cartes de rôles à pouvoir de nuit (jamais de loup), tirées au hasard hors du paquet, sont posées face visible et annoncées (tu peux les choisir toi-même avant la première nuit : cartesDuBateleur). **Feu follet** : la veillée commence par un jour (débat et vote avant la première nuit), annoncé. **Illuminé** : le système partage le village en deux bords, selon la rive où chacun dort, et l'annonce. Le système fait tout cela à la distribution ; ne dis jamais qui tient ces rôles.
- Lis à voix haute une présentation du village (deux ou trois phrases, pas plus).`
    },
    {
      titre: "La peste noire",
      texte: `# Une partie sans loups

Rarement, une partie composée d'elle-même (Table de jeu, ou MJ IA) devient une **peste noire** ; tu peux aussi la choisir (Table de jeu, préparatifs : case **« Partie peste noire »**). Aucun rôle de la meute : leurs places vont au village (et aux solitaires que permet le niveau) ; métiers et bâtiments comme d'habitude. Toi seul le sais : la Table de jeu le marque « Peste noire » chez le MJ, jamais chez les joueurs.

# La nuit

- À la place de la meute, à l'ordre 40, l'étape **« la peste »**. Fais l'appel **comme d'habitude** : annonce le réveil de la meute et des autres rôles de la même voix, laisse passer le même temps ; rien ne doit trahir la variante.
- **Première nuit** (tant qu'aucune victime de la peste n'est morte) : c'est **toi** qui choisis la victime (bouton « Réveiller : la peste », liste des villageois, ou **« Au hasard »**). Le MJ IA la donne à loups_nuit (peste_victime).
- **Nuits suivantes** : **la dernière victime morte de la peste** (le porteur) désigne en secret la suivante, dans une fenêtre ou sur la carte, comme une action de nuit (un compagnon IA, par son cerveau). Sans réponse au délai, le hasard choisit. Le porteur l'apprend dans son carnet secret à sa mort.
- La victime est attaquée **exactement comme une proie de la meute** : Garde, Gardienne des clés, remède de l'Herboriste, verrou du Forgeron, asile de la Chapelle, Taverne, Grange, Passeur, Pont et écluse la protègent ; le Pyromane et la Dame du gué n'en meurent pas.
- À l'aube, annonce-la **comme une victime de la meute** (« tuée dans la nuit ») : même ton, même phrase. Sa vraie cause, « emportée par la peste noire », n'apparaît qu'au récit de fin et aux Chroniques.
- Les rôles d'information fonctionnent normalement : aucune vision ne montre de loup, la lanterne ne surprend personne, le Tanneur ne trouve pas de crocs, la Meunière compte zéro loup. C'est l'indice ; ne corrige rien, ne commente rien.

# Le cri

Pendant le jour, tout vivant (pas réduit au silence) peut crier **« C'est la peste noire ! »** (son bandeau, sa Table de jeu ; à voix haute : le bouton à côté de son nom sur ta Table, ou loups_peste pour le MJ IA). Le système tranche :
- juste : la partie s'arrête, **le village gagne** (récit de fin, Chroniques « Peste noire ») ;
- faux : le crieur est **pendu pour avoir semé la panique** (mort annoncée au village).

# La fin

Sans cri juste, quand il ne reste qu'**un vivant ou aucun**, **la peste l'emporte** : « Brumecombe s'éteint dans la fièvre ». Personne ne gagne. (Le Revenant exécuté ou la cible du Chasseur de primes exécutée gagnent comme d'habitude.)`
    },
    {
      titre: "Mener la nuit",
      texte: `# L'ordre de réveil

Réveille les rôles dans cet ordre (calculé d'après les rôles du module). Saute ceux qui ne sont pas dans la composition ; pour ceux qui sont **morts**, laisse passer quelques secondes quand même, pour ne rien trahir.

${ordreDeReveil().map(e => `- **${e.o}** — ${e.texte} : « ${e.invite} »`).join("\n")}

# L'ordre d'appel des veillées d'autrefois

Les rôles du jeu de soirée suivent exactement l'ordre d'appel d'autrefois ; ceux des Veillées se glissent entre eux, près du rôle qui leur ressemble.

- **La première nuit** : ${ORDRE_D_APPEL.premiere.join(", ")}.
- **Chaque nuit ensuite** : ${ORDRE_D_APPEL.chaque.join(", ")}.
- **Chaque jour** : ${ORDRE_D_APPEL.jour.join(", ")}.

# Comment réveiller

- Une **fenêtre de choix** par rôle, avec un délai (quarante-cinq secondes par défaut ; une minute pour la meute, qui discute). Au délai, le rôle **passe**.
- La meute vote : à la majorité, et à égalité le premier choix. Les loups peuvent se parler en privé pendant leur réveil ; rien de ce qu'ils disent ne sort de leur canal.
- Note chaque action dans l'ordre (Table de jeu ou noterAction), même quand le rôle passe.
- Les loups qui ont un pouvoir propre (Louve mère, Loup affamé, Loup hurleur, Loup flaireur, Loup des roseaux) se réveillent **avec la meute à 40**, puis **seuls à leur ordre**.
- **La meute choisit ensemble** : un seul réveil à 40, un vote des loups vivants. Les loups à pouvoir propre se réveillent **ensuite, seuls**, chacun à son ordre.
- **Garde du pont** : il veille avant la meute ; le joueur qu'il a gardé la nuit d'avant ne lui est pas proposé (Table de jeu et MJ IA le retirent d'eux-mêmes). Sa garde n'arrête que la meute.
- **Louve mère** : elle ne peut infecter que la proie de la meute (la seule qu'on lui propose). L'infecté ne meurt pas, devient loup en secret (le système le prévient) et garde son pouvoir de nuit : continue de l'appeler pour lui. La garde du Garde du pont n'empêche pas l'infection.
- **Loup affamé** : chaque nuit, seul, après la Louve mère ; on ne lui propose ni la proie de la meute ni un loup. Dès qu'un loup est mort (un mordu compte), il ne se réveille plus seul.
- **Herboriste** : dis-lui la victime de la meute avant de lui demander son choix (même si la victime est protégée : elle ne doit rien deviner ; une proie infectée par la Louve mère n'est pas une victime, ne la nomme pas). Si elle désigne **la victime**, c'est le remède ; si elle désigne **quelqu'un d'autre**, c'est le poison. Elle peut désigner les deux la même nuit.
- **Pyromane** : s'il désigne une autre maison, il l'asperge ; s'il **se désigne lui-même**, il embrase toutes les maisons aspergées.
- **Enfant de la brume** : si elle épie, le système tire aussitôt si la meute la surprend (une chance sur deux, réglage « chanceEpier ») ; à l'aube, elle apprend en secret le nom des loups sortis chasser. Surprise, c'est elle que la meute dévore, à la place de sa proie (ni garde ni porte ne la sauvent, un remède si) ; l'Herboriste apprend alors son nom.
- **Liseuse de cendres** : elle apprend le **rôle** d'un joueur (sa carte, et le camp de cette carte). Le Loup déguisé lui paraît « Villageois », le Louvetier « Loup de Brumecombe ».
- **Ermite** : tire au hasard un joueur qui a agi cette nuit (la meute compte) ; s'il n'y en a aucun, dis « aucune lanterne n'a bougé ».
- **Loup des roseaux** : il désigne une maison ; dis-lui seulement si son occupant **a agi** cette nuit (pouvoir de nuit, ou la chasse), jamais ce qu'il a fait. Il rôde au seuil : la lanterne de la Veilleuse le démasque comme un loup qui entre.
- **Louvetier** : il apprend le camp d'un joueur, comme la Liseuse. Mais toute vision (Liseuse, Sourcier, Loup flaireur) le voit **de la meute** : réponds-leur « Meute » sans hésiter, même si tu sais qu'il n'en est pas.
- **Pêcheur de nuit** : un seul harpon par partie. Sa cible meurt à l'aube, sauf porte fermée par la Gardienne des clés, remède ou absence (Passeur, Grange) ; ni la garde du Garde du pont, ni le verrou du Forgeron, ni l'asile de la Chapelle, ni la Taverne ne l'arrêtent, car ce n'est pas une attaque de loup. Il atteint aussi le Pyromane et la Dame du gué.
- **Dame du gué** : elle ne se réveille qu'**une nuit sur deux** (nuits paires). Sa noyade suit les mêmes règles que le harpon. La meute ne peut pas la tuer : si elle entre chez elle, elle repart bredouille, et tu n'en dis rien au matin.
- **Fossoyeur** : il ne peut interroger qu'un mort. S'il n'y en a pas, réveille-le quand même et dis-lui « aucune tombe fraîche ».
- **Messager** : il désigne l'expéditeur puis le destinataire. Une fenêtre s'ouvre aussitôt chez l'expéditeur, qui écrit sa phrase ; le système la remet en secret au destinataire à l'aube, avec le nom de l'expéditeur. Tu ne la lis à personne.
- **Furet** : il désigne un joueur ; le système flaire ce joueur et ses deux voisins vivants autour de la table (le cercle des places) et lui répond en secret à l'aube. Sans loup parmi eux, il perd son flair : réveille-le quand même chaque nuit, la Table de jeu et le MJ IA ne lui proposent plus personne.
- **Lavandières** et **Bûcherons** : réveille-les ensemble la première nuit, puis une nuit sur deux (3e, 5e…). Le système remet à chacun le nom des siens dans son carnet ; avec les salons vocaux, ils se parlent entre eux le temps de la nuit.
- **Pie** : avant la chasse, elle peut poser sa plume noire sur un joueur (pas elle-même). Le système l'annonce au matin, sans la nommer.
- **Sagesse perdue** : si l'Aïeul est tombé de la main du village, ne réveille plus aucun rôle du Village ; la Table de jeu et le MJ IA les retirent d'eux-mêmes de l'ordre de la nuit.
- **Chapardeur** : la première nuit, avant tout le monde, il voit les deux cartes du centre et peut en prendre une (obligé si ce sont deux loups ; sans réponse, le système en prend une au hasard). Il devient aussitôt ce rôle : s'il agit encore cette nuit (un loup, l'Entremetteuse, le Mâtin…), réveille-le à son tour, comme les autres.
- **Bateleur** : en début de nuit, il peut désigner l'une de ses cartes face visible ; le système l'ajoute à l'ordre de la nuit, à l'ordre de cette carte : réveille-le alors pour ce pouvoir. Au matin, la carte jouée est retirée, devant tous.
- **Enfant des bois** : la première nuit, il choisit son modèle. Si le modèle meurt, le système le fait passer en secret dans la meute, qui le retrouve la nuit suivante.
- **Mâtin** : la première nuit, juste avant la meute, il se désigne pour la rejoindre (il chasse avec elle dès cette nuit) ou passe pour rester villageois.
- **Loup pâle** : il chasse avec la meute ; une nuit sur deux (nuits paires), il se réveille ensuite seul et peut dévorer un loup (on ne lui propose que des loups). L'Herboriste apprend cette victime comme les autres.
- **Joueur de vielle**, puis **les charmés** : à la fin de la nuit, il charme deux joueurs pas encore charmés ; puis réveille ensemble tous les charmés (étape « les charmés ») : le système remet à chacun le nom des autres. Infecté, il devient un simple loup : il n'est plus appelé, les charmés non plus.
- **Effets du jour** : un joueur caché (Grange) ou passé sur l'autre rive (Passeur) ne se réveille pas et personne ne peut le désigner ; un joueur gardé à l'œil (Garde du guet) ne peut viser que sa propre maison (une tombe n'en est pas une) ; la meute ne peut viser ni l'asile de la Chapelle, ni les dormeurs de la Taverne (sauf si un loup dort parmi eux), ni l'autre rive quand le Pont est bloqué ou que l'Éclusière a fermé l'écluse. La Table de jeu et le MJ IA proposent d'eux-mêmes les bons candidats.

# Ce que tu dis

Garde les mêmes phrases d'une nuit à l'autre : « La nuit tombe sur Brumecombe. Les volets se ferment. » Puis, pour chaque rôle, une seule phrase neutre. Ne commente jamais un choix.`
    },
    {
      titre: "L'aube et les morts",
      texte: `# Résoudre la nuit, dans cet ordre

Le système fait tout ceci de lui-même à l'aube (bouton « Résoudre l'aube » de la Table de jeu, ou la fin de la nuit du MJ IA) ; l'ordre sert à trancher un cas qu'il ne connaîtrait pas.

1. **Cachettes et asiles** : Grange et Passeur (personne n'y entre, ni loup, ni visite, ni feu ; celui qui s'y cache n'agit pas), Chapelle (la meute n'y entre pas), Taverne (la meute n'y tue pas, sauf si un loup y dort : alors sans protection).
2. **Protections** : Garde du pont (contre la meute seulement), Gardienne des clés, verrou du Forgeron (la première attaque de loup échoue). L'Enfant de la brume surprise en épiant devient la proie de la meute, prise dehors : ni garde ni porte pour elle.
3. **Morsure** : si la Louve mère a infecté la proie, elle devient loup en secret, personne ne meurt de la meute (la garde du Garde du pont ne l'empêche pas).
4. **Attaques** : victime de la meute, seconde victime du Loup affamé, harpon du Pêcheur de nuit, noyade de la Dame du gué (ces deux-là ne sont pas des attaques de loup : seuls la porte de la Gardienne, un remède ou une absence les arrêtent). L'**Aïeul** survit à la première attaque de loup qui l'aurait tué (en secret : seule ta chronique le dit) ; la première morsure de la Louve mère ne l'infecte pas, elle lui coûte cette vie.
5. **Remède et poison** de l'Herboriste.
6. **Feu** : si le Pyromane a embrasé, toutes les maisons aspergées brûlent (protégées ou non). Le loup blessé la nuit d'avant par la vieille épée du **Vieux Sergent** meurt, quoi qu'on fasse.
7. **Lanterne** : un loup entré dans la maison éclairée est démasqué.
8. **Cascades** : amant mort de chagrin, Braconnière qui emporte quelqu'un (elle choisit au matin). Le **Vieux Sergent** dévoré par la meute blesse le premier loup vivant à sa gauche, qui mourra la nuit suivante.
9. **Informations** : Liseuse (le rôle), Enfant de la brume (le nom des loups), Sourcier, Louvetier, Loup flaireur, Loup des roseaux, Ermite, Fossoyeur, Furet, mot du Messager (en secret) ; juste après les morts, les **oies de la Gardeuse** (si un loup est l'un de ses deux voisins vivants) et la **plume noire de la Pie** ; lame de la Forge (« du sang de bête sur le seuil »), Moulin, Lavoir, Cimetière (annoncés au village).
10. **Victoire** : vérifie-la avant d'ouvrir le jour.

# Raconter une mort

Une mort se raconte en **trois phrases au plus** : le lieu, ce qu'on a trouvé, un détail qui reste. Utilise la table **Morts mystérieuses** pour varier. Ne dis jamais comment la victime est morte si ce n'est pas un effet public (le Tanneur et le Lavoir sont là pour ça).

Exemple : « On a trouvé la porte de la Maison 7 ouverte au vent. Le lit de Mathurin était froid, la courtepointe déchirée. Sur le seuil, une empreinte trop grande pour un chien. »

Si **personne n'est mort**, dis-le avec la même gravité : « Le jour se lève et chacun compte les siens. Personne ne manque. » Puis tire un **présage de l'aube**.

# Les morts dans Foundry

- Élimine le joueur (eliminer) : il ne vote plus ; son rôle est révélé si le réglage le demande.
- Couche son jeton ou retire-le de la carte ; si son rôle est révélé, donne au jeton l'image de son rôle.
- Un mort ne parle plus au débat. Rappelle-le avec douceur, une fois.`
    },
    {
      titre: "Le jour, le vote et les égalités",
      texte: `# Le rythme

- **Débat** : cinq minutes par défaut. Quatre minutes à moins de dix vivants, trois minutes à moins de six. Annonce la dernière minute.
- Laisse parler, relance ceux qui se taisent (« Maison 12, tu dors encore ? »), coupe ceux qui monopolisent. Ne donne **jamais** ton avis.
- Les pouvoirs de jour (métiers, Juge de paix, Conteuse, Taverne, Forge, Grange, Puits) se jouent depuis la Table de jeu de chaque joueur ; quand un joueur l'annonce à voix haute, applique-le toi-même (le MJ IA : loups_jour). Le système vérifie le moment (« au matin » = l'aube ou le jour qui suit une nuit ; « pendant le jour » = jusqu'à la nuit), les cibles permises et les usages, puis l'annonce au village. Un refus s'explique tout seul : ne le commente pas.
- Ce que disent les métiers d'information (Meunière, Chasseresse, Ramoneuse, Tanneur, Colporteur de nouvelles) est calculé par le système sur la vraie nuit : tu n'as rien à inventer. La Ramoneuse dit si une maison a **reçu de la visite** (un loup, ou un pouvoir qui la visait) ; la Chasseresse, si un joueur **est sorti**.
- L'**Éclusière** ferme l'écluse pour la nuit suivante : la meute ne peut chasser aucune maison de l'autre rive (maisons 13 à 18), exactement comme quand le Pont est bloqué. Rappelle-le en ouvrant la nuit.

# Le Bailli

- **Réglage « Le Bailli »** (par défaut oui), pris à la distribution. Le premier jour, **avant le premier vote d'exécution**, ouvre l'élection : bouton **« Élire le Bailli »** de la Table de jeu ou du bandeau (la ligne « Prochaine étape » te le rappelle). L'élection se tient **pendant le débat**, sans passer à la phase du vote. Tous les vivants sont candidats ; égalité : le sort ; aucune voix : charge vacante jusqu'au lendemain (une seule élection par jour, jamais après le vote d'exécution).
- Au vote d'exécution, la voix du Bailli **compte double** : le système l'applique au dépouillement.
- **Égalité** : si le Bailli a voté pour l'un des ex æquo, sa voix tranche d'elle-même (le système l'annonce). Sinon, le système demande au Bailli, et à lui seul, de trancher parmi les ex æquo (fenêtre ou carte ; un compagnon IA tranche par son cerveau). La clôture attend son choix (au plus le délai des choix). S'il passe, personne pour cette place. Avec le Gibet, il ne choisit que parmi ceux qui ont la majorité absolue. Tant qu'il n'a pas tranché, ni nouveau vote ni changement de phase ; s'il tarde (absent, page rechargée), tranche à sa place depuis la Table de jeu (un bouton par ex æquo, ou « Personne »).
- **À sa mort**, le système demande au défunt à qui il remet le sceau (une fenêtre posthume, après toutes les morts de la nuit). La « Prochaine étape » attend le sceau, au plus le délai des choix comptés depuis sa mort (même si ta page a été rechargée entre-temps). Sans réponse, la charge est vacante : le village élit un nouveau Bailli au jour suivant (ou le jour même, avant le vote d'exécution). Si un joueur dicte son choix à voix haute, ou si la charge reste vide, nomme le Bailli toi-même (bouton **« Nommer le Bailli »** de la Table de jeu).
- Le Bailli est **public** : tu peux le nommer dans tes récits, rappeler sa voix double, le prendre à témoin.

# Le Registre du greffier

Le système y inscrit seul chaque vote clos (voix par voix), chaque mort avec sa **cause publique**, l'élection et la succession du Bailli. Un vivant peut y faire inscrire une **déclaration** pendant le jour (trois par jour, pas s'il est réduit au silence pendant le débat et le vote) : elle est annoncée au chat. Tu ne la commentes jamais, tu ne la confirmes ni ne la démens, même quand tu sais qu'elle ment. Le Registre sert de mémoire au village : appuie-toi dessus pour tes « Précédemment… ».

# Le vote

- Ouvre le vote avec les vivants comme candidats, une minute par défaut. Les voix restent secrètes jusqu'au dépouillement.
- Annonce le décompte, puis l'exécuté. Si le **Sonneur** a sonné la cloche (son pouvoir de jour, pendant le débat ou au début du vote), le vote désigne deux condamnés. Avec le **Gibet**, il faut plus de la moitié des vivants.
- Le **ruban de la Tisserande** : si le plus désigné le porte, la clôture ne dépouille pas ; il a une minute de défense de plus, puis clos de nouveau.
- Le **Juge de paix** peut annuler le vote juste après le décompte, avant l'exécution (depuis sa Table de jeu) : il se révèle, le vote se rouvre, revote immédiat, sans débat. Demande toujours « quelqu'un s'y oppose-t-il ? » avant d'exécuter, et n'exécute que le résultat du dernier vote.
- Avec la **Chapelle**, ouvre ensuite le vote de la Chapelle (bouton de la Table de jeu) : l'élu y dort à l'abri la nuit suivante.
- La **plume noire de la Pie**, annoncée au matin, pèse deux voix contre son porteur au premier vote d'exécution du jour (un revote du Juge de paix compris) : le système l'ajoute au dépouillement.
- L'**Innocent** condamné n'est pas exécuté : quand tu l'exécutes, le système retourne sa carte et le gracie ; il reste en jeu, sans voix à tous les votes. Bailli, il perd la charge, et le village n'en élira plus.
- Le **Greffier bègue** fait son signe en secret (sa Table de jeu) pendant le vote ou juste après une condamnation : dès que les condamnés sont tombés, le système ouvre un **second vote** d'exécution, sans débat, et dit seulement « un second vote ». Ne nomme jamais le Greffier.
- Le lendemain d'une égalité payée par le **Souffre-douleur**, seuls ceux qu'il a désignés votent aux votes d'exécution : la fenêtre de vote ne s'ouvre pas chez les autres.
- La **Chambrière** : dès le décompte d'un vote qui condamne, le système lui demande en secret, une demi-minute au plus, si elle prend la carte du condamné. Quand tu l'exécutes, sa réponse est attendue : si elle se dévoue, sa carte de Chambrière est retournée, le condamné meurt **sans que sa carte soit montrée**, et elle tient désormais son rôle (son dernier geste ne joue pas). Amoureuse, on ne lui demande rien.
- Le **Feu follet** : quand il est au paquet, la veillée commence par un jour. Mène ce premier débat et ce premier vote comme les autres (l'élection du Bailli comprise), puis la première nuit.

# Les égalités

- **Le Souffre-douleur d'abord** : s'il est vivant (et le village a sa sagesse), toute égalité qui laisse une place vide le condamne, lui, à la place des ex æquo, avant le Bailli ou le sort. Mort ainsi, il désigne en secret qui votera le lendemain (une demande posthume) ; s'il ne répond pas, tout le monde votera, sauf si tu dictes sa liste (designerVotants).
- **Avec un Bailli vivant** : sa voix tranche si elle allait à l'un des ex æquo ; sinon il tranche (le système le lui demande) ; pas de revote.
- Sans Bailli, première égalité : les ex æquo ont **trente secondes** chacun, puis revote **entre eux seulement**.
- Sans Bailli, seconde égalité : **personne n'est exécuté** ; la nuit tombe.
- Un joueur seul en tête mais sans majorité (Gibet) : personne n'est exécuté.
- Le **Loup déguisé** en tête d'un vote sans être exécuté (égalité, majorité manquée, vote annulé par le Juge de paix) perd son masque : le système le note (chronique secrète) et le lui dit ; ensuite, les visions disent la vérité sur lui.

# Victoires à vérifier après chaque mort

- Plus aucun loup : victoire du **Village**.
- Loups aussi nombreux que les autres vivants : victoire de la **Meute**.
- **Revenant** exécuté, cible du **Chasseur de primes** exécutée : victoire immédiate du solitaire, et la partie s'arrête.
- **Amants** derniers vivants : ils gagnent ensemble. Deux amants de camps différents ne gagnent que de cette façon, jamais avec leur camp.
- **Peste noire** : le cri juste fait gagner le village ; sinon la peste l'emporte quand il reste un vivant ou aucun (ni « plus aucun loup », ni amants, ni tueur solitaire ne finissent une peste).
- **Pyromane** ou **Dame du gué** dernier vivant (ou avec un seul non-loup) : il gagne seul. Tant que l'un de ces deux tueurs vit, le village n'a pas gagné, même sans loup ; s'ils sont tous les deux en vie, aucun ne gagne avant que l'autre tombe.
- **Rosière** exécutée par le vote : le Village perd aussitôt, **la meute l'emporte** (dans une peste noire : la peste). Le Revenant ou le Chasseur de primes exécutés gagnent d'abord. Morte la nuit, rien de particulier.
- **Feu follet** éliminé au premier tour (le premier vote, ou la meute ou le poison de la première nuit) : il gagne seul, la partie s'arrête. Sinon, au matin de la première nuit, il devient simple villageois (le système le lui dit) et gagne avec le Village.
- **Joueur de vielle** vivant, quand tous les autres vivants sont charmés : il gagne seul, quelle que soit la façon (un charme, un vote, une nuit). **Illuminé** vivant, quand tout l'autre bord est éliminé : il gagne seul. Mordus, l'un et l'autre deviennent de simples loups.
- **Loup pâle** : il gagne seul s'il est le dernier vivant ; si la meute l'emporte, il n'est pas parmi les gagnants.
- **Aïeul** tombé de la main du village (vote, poison de l'Herboriste, Braconnière) : le système annonce que Brumecombe a perdu sa sagesse ; jusqu'à la fin, plus aucun rôle du Village ni aucun métier n'a de pouvoir (le Bailli garde sa charge). Avec le réglage « L'Innocent suit l'Aïeul », un Innocent déjà gracié meurt avec lui.
- **Glas final** (si tu l'as posé) : au soir du jour annoncé, après son vote (ou si la nuit allait tomber), la partie s'arrête : la meute gagne si un loup vit encore, sinon le tueur solitaire encore en vie, sinon le village ; dans une peste noire, la peste.

# Le Dernier souffle, le Somnambule, les Saints du calendrier

- **Dernier souffle** (réglage, par défaut oui) : chaque mort garde une voix, une seule fois, pour un vote d'exécution (ni Chapelle, ni élection du Bailli). Le système la reçoit et la consomme au dépouillement ; le Gibet ne compte que les morts qui ont soufflé à ce vote, et les voix qui manquent sont celles des vivants. Tant qu'un mort garde son souffle, il ne voit pas les rôles cachés, n'entend pas la tanière et ne parle qu'aux morts qui le gardent aussi ; son souffle rendu, « les morts voient tout » s'applique. Ne lui dis rien des rôles avant.
- **Somnambule** (rôle sur demande) : à la distribution, il reçoit la carte d'un rôle de vision (Liseuse de cendres, Fossoyeur ou Sourcier, de préférence absent de la partie) et le joue de bonne foi ; le système lui rend des visions **fausses** (camp inverse, « même camp » à l'envers, faux rôle d'un mort). Toi seul le sais (marque sur ta Table de jeu). À sa mort, et à la fin, il est révélé Somnambule. Ne le trahis jamais, même quand ses visions font exécuter un innocent.
- **Bonne étoile** (Table de jeu, avant la première aube) : tu protèges en secret un joueur débutant la première nuit. Personne n'est prévenu ; une attaque contre lui échoue sans bruit.
- **Glas final** (Table de jeu, ou à la préparation) : le jour où la partie s'arrêtera, annoncé à tous dès que tu le poses.

# Gens de passage, Banc des accusés, Glas du deuil

- **Gens de passage** (réglage, par défaut oui) : un joueur arrive en cours de partie ? Bouton **Accueillir un gens de passage** (Table de jeu), à l'aube ou pendant le débat, hors vote. Le système tire son rôle de passage (public, annoncé au chat) et son **camp secret**, pour ne pas déséquilibrer : la meute s'il lui manque des loups (le plus souvent), sinon le village (rarement la meute) ; jamais la meute dans une peste noire. Lui seul et la meute le savent ; ne le dis jamais. Son pouvoir ne sert qu'une fois, de jour : **Rémouleur** (la première attaque de loup contre une maison échoue la nuit suivante), **Montreur de marmotte** (la meute n'entre pas dans cette maison la nuit suivante), **Pèlerine** (elle apprend en secret le camp d'un joueur).
- **Départ et exil** : un joueur qui doit partir presse **Quitter la veillée** (ou toi, la porte sur sa carte) ; un **vote d'exil** (bouton du narrateur, au débat) chasse un gens de passage. Dans les deux cas : ni mort, ni rôle, ni camp annoncés ; sa voix en cours retirée (et celles qui le désignaient), son jeton retiré du plateau, sa demande de nuit close ; s'il était Bailli, la charge devient vacante. S'il était le seul candidat du vote (l'accusé jugé, le seul gens de passage d'un exil), le vote se clôt sans élu. La victoire est vérifiée comme après une mort ; « Rejouer » ne le redistribue pas.
- **Banc des accusés** (variante) : pas de vote libre. Les joueurs accusent pendant le débat (une fois chacun ; chacun accusé une fois par jour) ; **Ouvrir le vote** juge le prochain accusé (un seul candidat, sans cloche ni départage). Condamné à **la moitié des voix des vivants** (le Bailli compte double, au total aussi ; plus de la moitié avec le Gibet ; le Dernier souffle compte pour, pas au total). Une exécution par jour : après elle, les autres accusés sont libres. Sans accusation, la nuit peut tomber. Le Juge de paix peut annuler un jugement : l'accusé est rejugé.
- **Glas du deuil** (variante) : chaque innocent (hors meute) exécuté par le vote fait sonner le glas — annonce vague, au chat. La meute gagne en secret : au **1er glas**, une **vision** (la nuit suivante, réveil « la meute en deuil » : elle désigne un joueur, chaque loup apprend son camp) ; au **2e**, une **voix sans visage** à chaque vote d'exécution : à l'ouverture du vote, la meute désigne en secret le candidat qu'elle rejoindra (sans réponse : un candidat au hasard) ; le dépouillement la montre, jamais d'où elle vient, et rien ne la relie aux bulletins des loups ; au **3e**, le **linceul** : la nuit suivante, aucune protection ne tient contre la meute (ni garde, ni remède, ni verrou, ni asile, ni Taverne). Au-delà, le glas sonne sans rien de plus.

# La Nuit de la Saint-Martin

Le format court (une dizaine de minutes) : case **Nuit de la Saint-Martin** à la préparation. Le système compose **trois rôles de plus que de joueurs** (des loups, la Liseuse, le Colporteur et ses échanges, des rôles simples) ; ceux qui restent dorment **sous l'autel de la Chapelle** : toi seul sais lesquels. **Une nuit**, une aube, un débat, **un seul vote**, puis la fin : un loup exécuté, le village gagne ; le Revenant exécuté, lui ; sinon, un loup encore vivant, la meute ; sans loup en jeu, le village s'il n'a exécuté personne, sinon **la brume** l'emporte (personne). Ni Bailli, ni Almanach, ni Banc, ni Glas du deuil ; si la seconde nuit allait tomber sans vote, la partie finit.`
    },
    {
      titre: "Ambiance : un automne gothique",
      texte: `# Le ton

Brumecombe est un **conte d'automne**, pas un film d'horreur : la menace vient de ce qu'on ne voit pas. Pense aux veillées au coin du feu, aux histoires qu'on se raconte pour se faire peur, aux villages où tout le monde se connaît trop bien.

- **Les sens** : l'odeur des feuilles mouillées et de la fumée de bois, le bruit des volets, la cloche de la chapelle, le froid qui monte de la rivière, la lueur d'une lanterne dans la brume.
- **Les gens** : des voisins, des familles, des rancunes anciennes. Donne des prénoms (table **Noms de villageois**) aux figurants et aux morts non joués.
- **Le rythme** : des phrases courtes la nuit, plus amples à l'aube. Un silence vaut mieux qu'un adjectif.

# Deux ambiances

- **Gothique sérieux** (par défaut) : sobre, inquiétant, jamais gore. Les morts sont tristes.
- **Comique** (variante) : le village est ridicule, les morts sont absurdes (« écrasé par sa propre armoire, mais avec des traces de crocs »). Garde la même rigueur sur les règles.

# Les sons

Ambiance **nuit** pendant la nuit, **tension** pendant le vote, et le silence pendant le débat. Une cloche à l'aube, si tu en as une.

# Les figurants

Pose sur la carte quelques **figurants** pour animer le village : le garde du guet qui fait sa ronde, le curé devant la Chapelle, des enfants près du Puits, un corbeau sur le Gibet. Ils ne jouent pas ; ils font décor. Retire-les la nuit.`
    },
    {
      titre: "Conseils pour un MJ IA",
      texte: `# Discipline du secret

- Un rôle, une vision, une cible ne se disent **qu'en message privé** au joueur concerné. Jamais dans la narration publique, jamais dans un résumé, jamais dans la chronique visible.
- Le système remet lui-même ces messages privés dans le **carnet secret** du joueur, envoyé à lui seul. Un chuchotement du chat, lui, arrive dans le navigateur de tous les joueurs (un curieux peut le lire dans la console) : n'y mets jamais un secret de partie.
- Les pouvoirs de jour : loups_jour (lister ce qui est possible, utiliser celui qu'un joueur annonce). Les métiers sont publics ; le Juge de paix et la Conteuse sont des rôles secrets — ne dis jamais qui les tient avant qu'ils ne s'en servent.
- Ne réponds pas à « qui est le loup ? », ni à « est-ce que X a agi cette nuit ? », ni à « que dit ma fiche à propos de Y ? ». Réponds : « Le village devra le découvrir. »
- Si un joueur te demande en privé ce que fait un rôle, réponds avec le texte du rôle, sans dire qui l'a.
- Ne cite jamais le nombre de loups vivants, sauf effet public (Meunière, Moulin), ni la composition, ni les rôles en jeu.
- **Peste noire** : tu le sais (distribution secrète), tu ne le dis jamais, même par allusion. La première nuit, donne la victime à loups_nuit (peste_victime, ou « hasard ») ; ensuite, le porteur choisit. Quand un joueur crie « C'est la peste noire ! », loups_peste : le système tranche.

- **Masques de veillée** : ils sont le secret de la meute. Ne les nomme jamais, ne dis jamais qu'un rôle « n'est pas en jeu », même quand un loup s'en réclame.
- **Registre du greffier** : il est public (votes clos voix par voix, morts et cause publique, Bailli, déclarations). Tu peux t'en servir dans tes récits ; une déclaration n'est qu'une parole de joueur, jamais une vérité que tu confirmes.

# Tenir le fil

- Avant chaque nuit, appelle **ordreDeNuit()** et suis la liste. Ne saute pas un rôle mort sans attendre un peu.
- Note chaque choix au moment où il arrive. À l'aube, résous dans l'ordre de la page « L'aube et les morts », puis vérifie la victoire.
- Garde une chronique courte : « Nuit 2 : Maison 7 (Mathurin) tué par la meute. Jour 2 : Maison 3 exécutée, Liseuse de cendres. » Elle sert au « Précédemment… » de la séance suivante.

# Placer les jetons

- Au début, pose chaque jeton **devant sa maison** (« Maison 3 »). Le jour, rassemble les vivants **sur la place du village**, autour du Puits. Pendant le vote, l'accusé se tient **devant le Gibet**.
- Les jetons montrent le villageois encapuchonné (jeton neutre « villageois ») ; ne mets l'image du rôle qu'à la révélation. Le jeton du métier peut servir d'image publique.

# Neutralité

- Même longueur de phrase pour chaque réveil, même temps d'attente, même ton.
- Ne félicite pas un bon coup, ne plains pas une erreur. Ne ris pas d'un mensonge.
- Si tu te trompes (un rôle oublié, une cible mal notée), dis-le simplement, répare au mieux et continue.

# Compagnons IA

- loups_distribuer avec compagnons : n ajoute n places tenues par des compagnons IA (noms tirés de la table « Noms de villageois », personnalité au hasard). Ils répondent seuls à leurs réveils de nuit et aux votes, et prennent la parole après tes récits du jour.
- Traite-les exactement comme des joueurs : ne leur souffle jamais un rôle ni ce qui s'est passé la nuit. Ce que leur rôle apprend leur est remis, comme aux autres, dans leur carnet secret.
- **Petite tablée** (1 à 4 humains, 2 à 8 compagnons) : quand le réglage du monde « Petite tablée par défaut » est coché (la Table de jeu le coche quand le MJ choisit ce niveau), toute composition que tu génères de 12 places au plus en est une (loups_composer, loups_distribuer en mode auto, loups_rejouer), et la distribution suit ses règles d'elle-même ; sinon, loups_distribuer en mode « composition » avec la composition prête « petite-tablee-<n> » (n places, 4 à 12). Le système annonce lui-même la règle au chat (des nombres, jamais un nom) : ne dis rien de plus, surtout pas de quel côté de la table l'ombre est tombée ni qui tient la lanterne.

# Délais

- Fenêtre de nuit : 45 s, meute 60 s. Débat : 5 min. Vote : 60 s. Un joueur absent passe son tour ; un joueur absent deux nuits de suite peut être déclaré mort de fièvre (annonce-le comme une mort ordinaire, rôle révélé).`
    },
    {
      titre: "Cas particuliers",
      texte: `# Interactions courantes

- **Louve mère et protection** : la garde du Garde du pont n'empêche pas l'infection (elle ne protège que de la mort) ; une porte que la meute ne passe pas (Chapelle, clé de la Gardienne, verrou du Forgeron, Taverne), si, et la morsure est perdue.
- **Louve mère et Herboriste** : une infection n'est pas une mort ; l'Herboriste n'apprend pas le nom de l'infecté, il n'y a rien à sauver chez lui.
- **Loup affamé et mordu** : un mordu qui meurt est un loup mort ; le Loup affamé perd sa faim.
- **Morsure d'un rôle à pouvoir** : le mordu garde son pouvoir et l'utilise pour la meute (une Liseuse mordue lit pour les loups). Il ne meurt pas s'il est la cible de la meute ensuite : il en fait partie.
- **Amants de camps opposés** : ils gagnent ensemble s'ils sont les deux derniers vivants. Un loup amant peut voter contre la meute pour sauver son amant.
- **Colporteur** : l'échange se fait avant les autres actions. Celui qui reçoit le Colporteur perd son pouvoir dès cette nuit. Un loup échangé quitte la meute ; le Colporteur devenu loup la rejoint.
- **Herboriste et feu** : le remède ne sauve pas d'un incendie, seulement de la meute.
- **Herboriste, deux fioles** : la même nuit, elle peut sauver la victime et empoisonner quelqu'un d'autre. Deux victimes désignées : une seule reçoit le remède.
- **Braconnière tuée par le poison** : elle emporte quand même quelqu'un.
- **Gardienne des clés sur une maison loup** : le loup chasse quand même avec la meute (la meute sort d'une autre maison), mais il ne peut pas utiliser son pouvoir propre.
- **Garde du guet sur un loup** : la meute chasse sans lui ; son vote de meute ne compte pas.
- **Cible du Chasseur de primes tuée la nuit** : le Chasseur devient villageois (camp Village).
- **Revenant tué la nuit** : il a perdu, simplement.
- **Pyromane ou Dame du gué attaqués par la meute** : rien ne se passe, la meute repart bredouille ; ne dis rien au matin.
- **Louvetier et visions** : la Liseuse qui le lit voit « Meute », le Sourcier le dit du même camp qu'un loup. C'est voulu : ne corrige jamais, même quand le village s'apprête à l'exécuter. Le Cimetière, lui, annonce son vrai camp.
- **Louvetier mordu** : il rejoint la meute et sa vision lit désormais pour elle ; les visions le voient toujours « Meute ».
- **Harpon ou noyade sur un loup** : le loup meurt, sans traces de crocs (le Tanneur le dira). Sur un amant : l'autre meurt de chagrin.
- **Éclusière et Pont** : les deux bloquent la même chose ; ils ne s'additionnent pas.
- **Taverne et Loup** : si un loup y dort, la meute peut y tuer qui elle veut, sans protection possible.
- **Herboriste sur elle-même, hors danger** : aucune fiole ne s'ouvre et elle garde ses deux usages.
- **Bailli et Juge de paix** : le Juge ne peut annuler qu'après le départage du Bailli ; au revote, la voix du Bailli compte toujours double, et il tranche encore une égalité.
- **Bailli et cloche du Sonneur** : vote double, voix double ; si l'égalité porte sur la seconde place, le Bailli ne choisit que pour elle.
- **Bailli réduit au silence** : il ne parle pas, mais il vote (voix double) et tranche.
- **Bailli loup** : rien ne change ; s'il tranche pour sauver un loup, c'est au village de s'en souvenir (le Registre le garde).
- **Bailli mort avec son amant, ou dans la même nuit qu'un autre** : il ne remet le sceau qu'à un vivant, une fois toutes les morts tombées.
- **Aïeul et Herboriste** : l'Herboriste apprend son nom comme celui de toute victime ; si son remède le sauve, il garde sa vie de réserve. Empoisonné par elle, il fait perdre au village sa sagesse.
- **Aïeul et Garde du pont** : gardé, il n'est pas atteint ; sa vie de réserve reste entière.
- **Aïeul et Louve mère** : sa première morsure ne l'infecte pas (elle lui coûte sa vie de réserve) ; la seconde, oui.
- **Aïeul et peste noire** : la peste frappe comme la meute ; sa première attaque ne le tue pas non plus.
- **Sagesse perdue** : les rôles du Village (même mordus) n'ont plus de pouvoir, ni de nuit, ni de jour, ni à leur mort (la Braconnière n'emporte plus personne, le Souffre-douleur ne paie plus l'égalité, l'Innocent n'est plus gracié). Les métiers se taisent pour tous (un loup qui garderait le sien se trahirait). Les loups et les solitaires gardent les leurs.
- **Innocent et Souffre-douleur** : une égalité où l'Innocent est en tête condamne le Souffre-douleur. Seul condamné, l'Innocent est gracié ; condamné une seconde fois, il meurt.
- **Souffre-douleur et vote double** : une égalité pour la seconde place le condamne à cette place.
- **Vieux Sergent et Louve mère** : mordu, il ne meurt pas et son épée ne sert pas ; devenu loup, il est de la meute.
- **Vieux Sergent sans loup à sa gauche** : on cherche le premier loup vivant en tournant à gauche autour de la table ; s'il n'y en a pas, rien.
- **Furet et Loup déguisé** : le flair est une vision, le déguisé y échappe ; le Louvetier, lui, sent le loup.
- **Gardeuse d'oies et Loup déguisé** : les oies sentent la bête : le déguisé les fait cacarder. Mordue, la Gardeuse fait cacarder ses oies chaque matin.
- **Pie et Banc des accusés** : la plume ajoute deux voix « pour » quand son porteur est jugé.
- **Greffier bègue et Juge de paix** : le Juge annule avant l'exécution ; le signe du Greffier attend le vote qui condamne pour de bon.
- **Lavandières, Bûcherons mordus** : un loup reste dans la tanière ; les autres se retrouvent sans lui.
- **Chambrière et Braconnière, Souffre-douleur, Aïeul** : la carte prise ne joue pas pour le condamné (ni emporté, ni liste des votants, ni sagesse perdue) ; la Chambrière en a désormais le pouvoir. Ce qui tient à la condamnation elle-même joue (Revenant, Rosière, Feu follet, cible d'un Chasseur de primes).
- **Chambrière Bailli** : en se dévouant, elle perd la charge ; le village élit un autre Bailli. Le condamné Bailli remet son sceau comme tout Bailli qui meurt.
- **Enfant des bois et amants** : si son modèle meurt de chagrin, il rejoint aussi la meute.
- **Mâtin, Enfant des bois devenus loups** : ils comptent dans la meute (le Loup affamé perd sa faim si l'un d'eux meurt).
- **Loup pâle et Louve mère** : la Louve ne mord jamais un loup ; la proie du Loup pâle n'est pas une proie pour elle.
- **Joueur de vielle et Chambrière** : si elle reprend sa carte, elle apprend qui est déjà charmé et continue ; elle-même, charmée, ne l'est plus.

# Changer de navigateur en pleine partie

Les secrets de la partie (les rôles et les camps de chacun, les choix de la nuit, primes, fioles, peste noire…) vivent dans le navigateur du MJ, et dans un **coffre chiffré** sur le serveur, celui du MJ IA (qui doit être actif). Sa clé reste dans ton navigateur : **aux Veillées, aucun joueur n'en garde de part** (deux loups complices pourraient réunir les leurs et lire tous les rôles). Si tu reprends la partie depuis un autre navigateur ou un autre ordinateur, deux recours seulement rouvrent le coffre : la **clé de secours** du MJ IA (Réglages › MJ IA › Coffre), réimportée sur l'autre navigateur, ou un **autre MJ connecté** qui a la clé (elle lui est demandée d'elle-même). Sans l'un ni l'autre, les secrets de la partie en cours sont perdus : télécharge la clé de secours dès que le MJ IA te le propose, et garde-la hors du monde, comme un mot de passe. Donne aussi un mot de passe à chaque compte joueur : un compte ouvert à tous se prend en un clic, avec la carte de rôle et le carnet secret de son joueur.

# Si un joueur se trompe

- Un joueur révèle par erreur un message privé : rappelle la règle ; pas de sanction la première fois.
- Un mort parle : rappelle la règle ; s'il donne une information décisive, annule-la (« le village n'a rien entendu »).`
    },
    {
      titre: "Les veillées de fête",
      texte: `# Une variante de saison, jamais imposée

Quatre veillées de fête, une par fête du calendrier du MJ IA : ${FETES_VEILLEES.map(f => `**${f.nom}**`).join(", ")}. Chacune est une **variante** que tu choisis à la distribution ; la date ne fait que la proposer.

- **À la Table de jeu**, préparation : la liste « Veillée de fête ». La veillée de la fête du jour (s'il y en a une) y est pré-sélectionnée et marquée « proposée par le calendrier ». Choisis « Aucune veillée de fête » si la table n'en veut pas, ou une autre veillée hors saison. Rien dans une Nuit de la Saint-Martin.
- **Sans la Table** (le MJ IA qui distribue, « Rejouer ») : le réglage du monde « Veillée de fête » décide — aucune d'office (une partie rejouée garde celle de la précédente), selon le calendrier, ou une veillée nommée.
- Le système l'annonce lui-même au chat et au Registre du greffier, tire les secrets, prévient en secret chacun des concernés et applique les règles. Tu n'as rien à arbitrer.

# Ce qui est public, ce qui est secret

- **Public** : la veillée en jeu, la neige du matin (Veillée d'hiver), le masque du défilé (Carnaval). Rappelle-les quand c'est utile.
- **Secret** : qui a reçu un murmure et ce qu'il dit (Nuit des âmes), qui porte le présent et s'il s'est ouvert (Veillée d'hiver), qui porte le masque (Carnaval), qui sont les promis (Fête des promis). Tu les lis sur ta Table (ligne de la veillée, chez toi seul) et dans ta chronique secrète. **Ne les dis jamais**, ne les confirme ni ne les démens, même quand un joueur s'en réclame : ce sont des paroles de joueur, comme une déclaration au Registre. Le récit de fin les dévoile.

# Les quatre veillées

${FETES_VEILLEES.map(f => `- **${f.nom}** — ${RESUMES_DE_FETE[f.id]}`).join("\n")}

# Raconter

- **Nuit des âmes** : une nuit meurtrière, laisse entendre qu'une âme est passée (« une chandelle s'est éteinte quelque part »), jamais chez qui. Plusieurs morts dans la nuit : une seule âme parle, celle du premier.
- **Veillée d'hiver** : un présent qui s'ouvre sauve quelqu'un sans bruit ; au matin, raconte une nuit sans mort comme les autres. La neige, elle, se raconte : pas de traces, un lavoir gelé, des pouvoirs du matin qui attendent.
- **Carnaval des masques** : une vision trompée par le masque se raconte comme une vraie ; ne corrige jamais, même quand le village s'apprête à exécuter le masqué (comme pour le Louvetier). Le masque ne trompe qu'une vision du Village, puis tombe sans bruit (ta chronique secrète le note) ; un regard de la meute n'est jamais trompé.
- **Fête des promis** sans promis (moins de deux joueurs du Village) : l'annonce le dit, il n'y a rien d'autre.
- **Fête des promis** : deux promis ne meurent pas ensemble ; si la meute en dévore un, raconte une mort ordinaire.

# Pour un MJ IA

Ton état du jeu porte une ligne de fête. Quand une veillée est en jeu dans la partie (le Registre porte « la veillée de fête commence »), cette ligne vient d'elle, même hors saison : son nom, ses règles, ce qu'elle a annoncé à tous (neige, défilé) et la consigne de garder ses secrets. Sans veillée en jeu, la fête du calendrier n'est qu'une ambiance, sans règle de plus.`
    },
    {
      titre: "Le Village",
      texte: `# Des personnalités, en plus des rôles

La variante **Le Village** (case « Le Village » à la préparation, réglage du monde du même nom) confie des bâtiments à des joueurs. Chaque personnalité est **publique**, comme un jeton posé face visible devant elle ; sa carte de rôle reste secrète. Les joueurs sans bâtiment sont des **Chemineaux**. Les règles complètes sont dans le journal des variantes (page « Le Village ») ; voici comment la mener.

# Préparer

- À la distribution, le système propose qui tient quoi selon le nombre de joueurs, l'annonce au chat et l'inscrit au Registre. Tant que la première nuit n'est pas tombée, tu peux changer l'occupant de chaque bâtiment dans l'encart « Le Village » de ta Table de jeu (un échange si le joueur tenait déjà un bâtiment) : chaque changement est annoncé.
- Ni à la petite tablée, ni dans une Nuit de la Saint-Martin. L'**Incendiaire** ne sort que dans cette variante.
- Sans métairie distribuée, pas de Bailli dans la partie.

# Ce que le système fait seul

- **Le Prieur, le Remégeux, le Régent, le Perruquier** : leur joueur s'en sert de sa Table (pouvoirs de jour). Les annonces partent d'elles-mêmes ; seule la carte que le Prieur voit reste secrète (son carnet). Le rasoir du Perruquier tue, puis tue le Perruquier s'il s'est trompé de cible.
- **Le Cabaretier** : il n'est jamais candidat d'un vote d'exécution, la meute ne peut pas le dévorer, et son vote est annoncé dès qu'il le pose. S'il vote contre un joueur que le vote désigne, il perd son immunité (annoncé).
- **Le Hobereau** : juste après un vote d'exécution, chaque condamné reçoit une courte question (supplier le Hobereau ?), puis le Hobereau la sienne (gracier ?). L'exécution attend leurs réponses, une demi-minute chacune au plus. Gracié, le condamné reste en vie, sa carte cachée.
- **Le Prévôt** : quand un bâtiment se libère, il choisit un Chemineau, qui accepte ou refuse ; un bâtiment après l'autre.
- **La Fournière** : certaines nuits, au matin, un nom de loup lui est écrit au carnet. Tu n'as rien à faire.
- **Les Métayers** : à partir du deuxième jour, le bouton « Élire le Bailli » ouvre leur vote à eux seuls, parmi eux. Le dernier Métayer mort, la charge de Bailli disparaît.
- **L'Incendiaire** se réveille juste avant le Garde du pont. Il désigne un occupant : au matin, le bâtiment brûle, et son occupant devient Chemineau. Si c'était la maison de la proie de la meute, la proie en réchappe et le premier loup à sa droite périt (une mort annoncée, cause « victime de l'incendie »).

# Raconter

- Les personnalités sont des visages du village : présente-les à la distribution (« la Fournière ouvre son four avant l'aube »), rappelle-les au débat.
- Une maison qui brûle se raconte au matin, avant les autres nouvelles : fumée, cendres, l'occupant qui sort sur le chemin avec son baluchon. Ne dis jamais qui a mis le feu.
- Si le village a perdu sa sagesse (l'Aïeul), les personnalités perdent leur pouvoir comme les métiers ; seuls les Métayers gardent la désignation du Bailli, qui est une charge.`
    },
    {
      titre: "Les variantes du jeu de soirée",
      texte: `# Le Pacte et les variantes

Le niveau **Le Pacte** ne tire que les personnages des veillées d'autrefois, sans nos bâtiments communaux ni nos métiers. Les variantes se cochent à la préparation et s'annoncent à la distribution ; leurs règles complètes sont dans le journal des variantes (page « Les variantes du jeu de soirée »). Voici comment les mener.

# Ce que le système fait seul

- **Veillée aux chandelles** : chaque carte de la Table porte sa chandelle ; à chaque mort, le chat dit qu'elle s'éteint. Version angoissante : chaque loup choisit seul sa chandelle (le vote de la meute) ; s'ils ne s'accordent pas, il n'y a pas de victime, et l'aube annonce les chandelles éteintes.
- **La Chaîne des innocents** : « Ouvrir le vote » lance la chaîne. Chaque désignation est demandée à son joueur, puis annoncée ; sans réponse, le sort désigne. « Clore le vote » attend le dernier debout, qui est le condamné : exécute-le comme d'habitude.
- **Le Mur des murmures** : la dernière étape de la nuit réveille tous les vivants, chacun avec une fenêtre d'écriture. Au matin, le mur est lu au chat. Tu ne sais pas qui a écrit quoi : ne cherche pas, ne devine pas à voix haute.
- **Double visage** : la distribution retourne les rôles visibles (petite complication) et remet à chacun ses cartes secrètes, au carnet. Les joueurs d'allégeance loup se réveillent avec la meute, puis à l'ordre de leur rôle. Grande complication : un joueur à deux pouvoirs est réveillé deux fois, une par carte.
- **Les Vendanges** : la Table et le MJ IA proposent d'eux-mêmes les bons candidats (les voisins des loups pour la meute, le Garde et ses voisins, les voisins de la Braconnière). La première nuit, l'Entremetteuse est réveillée une seconde fois (« la tromperie ») : un amant et un autre joueur. Au vote, le Bailli vote d'abord, à découvert ; les votes interdits par l'amour sont refusés. Le sort de la fiole de l'Herboriste est tiré à l'aube : tu le lis dans ta chronique.
- **L'Envoûtement** : la proie de la meute ne meurt pas ; l'aube est calme. Le système la prive de ses pouvoirs et le lui dit, à elle seule. Si une envoûtée est condamnée, celles d'avant elle tombent aussitôt, annoncées. La meute gagne quand il ne reste plus qu'un villageois libre.

# Raconter

- Ne trahis jamais une envoûtée : une nuit sans mort se raconte comme une nuit de chance.
- Le mur se lit d'une voix égale, phrase après phrase, sans commentaire.
- Aux Vendanges, la veillée est une fête : raconte le vin, les chants, les pas qui hésitent — et laisse le sort de la fiole faire rire ou trembler.`
    },
    {
      titre: "Mener la Gazette de la lune",
      texte: `# Le matin

L'ordre du matin : les victimes de la nuit, les oies, **la carte de la Gazette** (lue par le dernier éliminé), **la séance de Spiritisme** (si la Liseuse d'étoiles l'a demandée), **l'annonce du Crieur public**, puis le débat. La Table attend d'elle-même les réponses du matin (« la Gazette du matin ») : laisse passer avant d'ouvrir le débat.

# Ce que tu fais toi-même

- **Lire une carte** : en mode « le narrateur choisit ses cartes », choisis-la dans l'encart de la Gazette et fais-la lire ; tu peux aussi en lire une de plus quand la veillée s'endort.
- **Retirer un vote** : sous une carte de conduite (Lune noire, Bonnes manières, Ni loup ni moi), quand quelqu'un enfreint la règle à voix haute. Au chat, le système relève lui-même « loup » et « moi ».
- **Appliquer la variante d'un jour** (Dimanche de soleil, Fin des vendanges, Lundi gris) : un bouton de l'encart, seulement le jour de la carte.
- **Élire l'Exécuteur** : le vote s'ouvre de lui-même à la lecture de la carte ; sinon, la Table le propose avant le vote du jour.
- **Nommer le Crieur public** à la place d'un Bailli absent, et confier ses cartes avant la première nuit (le système les tire sinon).

# Raconter

- Lis la carte d'une voix de gazetier, puis dis ce qu'elle change, simplement. Une permanente se rappelle de temps en temps (le Toucher mortel, l'Exécuteur, l'Enfouissement).
- Les absents s'en vont vraiment : raconte la musique du bal, les paniers de la cueillette, les cors de la battue.
- Ne trahis jamais ce que les cartes cachent : le Villageois devenu loup, l'allié du Méchant Benêt, ce que l'Exécuteur a lu, la main du Crieur.
- Le Spiritisme : une table, une chandelle, la voix du mort qui répond par un seul mot. Le système donne la vraie réponse ; ne la commente pas.`
    }
  ]
});

// ======================================================================= Règles des variantes (visible)

const variantes = journal({
  cle: "regles-des-variantes", nom: "Les Veillées de Brumecombe — Variantes", visible: true,
  pages: [
    {
      titre: "Réglages de la partie",
      texte: `# À annoncer avant la distribution

- **Révélation à la mort** (par défaut : oui) : le rôle d'un mort est montré à tous. Sans révélation, la partie est plus longue et plus trouble ; mettez le **Cimetière** en jeu pour garder un peu d'information.
- **Nombre de loups** : la composition le donne (2 à 5). Un loup de plus pour un groupe aguerri, un de moins pour un groupe qui débute.
- **Temps de débat** : 5 minutes par défaut ; 3 minutes pour une partie nerveuse ; 8 minutes pour une veillée bavarde.
- **Rôles autorisés** : le narrateur peut retirer un rôle d'une composition et le remplacer par un villageois, ou par un rôle du même camp.
- **Composition secrète** (toujours) : le narrateur n'annonce ni les rôles en jeu, ni le nombre de loups.
- **Peste noire** : le narrateur peut décider d'une partie sans loups (voir le guide du joueur) ; sinon, elle survient rarement d'elle-même.
- **Le Bailli** (par défaut : oui) : un Bailli élu le premier jour, voix double, il tranche les égalités et désigne son successeur. Sans lui, les égalités se revotent entre ex æquo.
- **Masques de veillée** (par défaut : oui) : la meute reçoit en secret deux ou trois rôles du Village absents qu'elle peut prétendre être. Sans eux, la partie est plus dure pour les loups.
- **Dernier souffle** (par défaut : oui) : chaque mort garde une voix, une seule fois, pour un vote d'exécution.
- **Almanach des brumes** (par défaut : non) : un présage par aube change la règle du jour (page suivante).
- **Gens de passage** (par défaut : oui) : un joueur qui arrive en cours de partie entre avec un rôle public et un camp secret ; on peut quitter la veillée sans mourir.
- **Banc des accusés** et **Glas du deuil** (par défaut : non) : deux variantes du jour (page « Le Banc et le Glas »).
- **Nuit de la Saint-Martin** : le format court, à choisir à la préparation (même page).
- **Petite tablée** (niveau de la préparation ; réglage « Petite tablée par défaut » qui s'en souvient) : la veillée pour 1 à 4 humains et 2 à 8 joueurs IA — meute courte (dès deux loups : première nuit blanche, et la meute doit être plus nombreuse pour gagner), les humains jamais tous loups ni tous du même camp, le tirage favorise (sans garantie) une lanterne chez un humain et l'ombre des deux côtés de la table, le sort tranche les égalités, glas final posé d'office (page « La petite tablée » du guide du joueur).
- **Veillées de fête** (par défaut : aucune) : une variante de saison par fête — Nuit des âmes, Veillée d'hiver, Carnaval des masques, Fête des promis. La fête du jour la propose à la préparation, le narrateur décide (page « Les veillées de fête » du guide du joueur, et un journal par veillée).
- **Glas final** et **Bonne étoile** : réglages du narrateur, à la Table de jeu (le jour où la partie s'arrête ; un débutant protégé en secret la première nuit).
- **Somnambule** et **Rosière** : rôles « sur demande », jamais tirés d'office ; le narrateur les ajoute à la main.
- **L'Innocent suit l'Aïeul** (par défaut : non) : si l'Aïeul tombe de la main du village, un Innocent déjà gracié meurt avec lui.
- **Le Village** (par défaut : non ; case de la préparation) : des personnalités tiennent les bâtiments du village, un pouvoir public en plus de leur rôle (page « Le Village »).
- **La Gazette de la lune** et **le Crieur public** (par défaut : non ; cases de la préparation) : une carte Événement chaque matin, et une charge qui en garde quelques-unes en main (page « La Gazette de la lune »). Avec la Gazette, pas d'Almanach des brumes.
- **L'Illuminé : le partage** (par défaut : la rive) : le critère annoncé au début, la rive ou un trait visible des personnages (le genre, l'âge, les lunettes).
- **Ambiance** : gothique sérieux (par défaut) ou comique.`
    },
    {
      titre: "L'Almanach des brumes",
      texte: `# Un présage par aube

Avec la variante **Almanach des brumes** (réglage du monde), chaque aube, après les morts de la nuit, le système tire un présage — jamais deux fois de suite le même —, l'annonce au village et l'applique lui-même. « Aujourd'hui » : jusqu'à la nuit ; « la nuit prochaine » : la nuit qui suit.

${ALMANACH.map(([, nom, texte]) => `- **${nom}** — ${texte}`).join("\n")}`
    },
    {
      titre: "Le Banc et le Glas",
      texte: `# Le Banc des accusés

Chaque vivant accuse **une fois par jour** pendant le débat ; chacun ne peut être accusé qu'**une fois par jour**. Les accusés sont **jugés un par un**, dans l'ordre des accusations : pour ou contre. Il faut **la moitié des voix des vivants** pour exécuter ; dès qu'un accusé est exécuté, les autres sont libres jusqu'au lendemain. Le Bailli, le Gibet, le Juge de paix et le Dernier souffle jouent comme d'habitude.

# Le Glas du deuil

Chaque innocent exécuté par le vote fait sonner le glas (« le glas sonne pour la 2e fois »), et la meute y gagne un pouvoir collectif qui grandit : d'abord une vision, puis une voix sans visage aux votes, puis une nuit où aucune protection ne tient. Le village n'apprend que le nombre de glas.

# La Nuit de la Saint-Martin

Une partie d'une dizaine de minutes : trois rôles de plus que de joueurs, cachés sous l'autel de la Chapelle ; **une nuit** (échanges du Colporteur compris), **un vote**, et la fin. Exécuter un loup sauve le village ; épargner un loup le condamne ; et sans loup parmi vous, pendre un innocent laisse la brume l'emporter.`
    },
    {
      titre: "Variantes de règles",
      texte: `# Pour changer la veillée

- **Nuit sans lune** : la première nuit, la meute se reconnaît mais ne tue pas. Idéal pour une première partie.
- **Brume épaisse** : aucun rôle n'est révélé, ni à la mort ni par un pouvoir. Le Fossoyeur et le Cimetière deviennent précieux.
- **Vote à bulletin secret** : le décompte est donné, pas qui a voté pour qui.
- **Veillée rapide** : débat de 3 minutes, vote de 30 secondes, fenêtres de nuit de 30 secondes.
- **Le village ne dort jamais** : chaque joueur vivant peut, une fois par partie, rester éveillé une nuit : il apprend le nombre de visites reçues par sa maison, mais il est réduit au silence le lendemain (fatigue).
- **Dernière veillée** : quand il ne reste que trois vivants, le débat dure une minute et chaque joueur doit voter, sans abstention.
- **Bâtiments tirés au sort** : au lieu de ceux de la composition, tirez 4 à 6 bâtiments au hasard parmi les dix.
- **Métiers cachés** : les métiers sont secrets eux aussi ; on les révèle en les utilisant.`
    },
    {
      titre: "Composer sa propre partie",
      texte: `# Recettes

- Environ **un loup pour quatre joueurs**, jamais moins de deux.
- Au moins **un rôle d'information** (Liseuse de cendres, Sourcier, Veilleuse de lanterne, Louvetier) et **un rôle de protection** (Garde du pont, Gardienne des clés, Herboriste) pour le village.
- **Un solitaire** à partir de dix joueurs ; deux à partir de quinze. Le Pyromane et la Dame du gué sont les plus difficiles à arrêter : ne les ajoutez qu'avec une Liseuse ou un Sourcier, et pensez au Pêcheur de nuit, dont le harpon les atteint.
- Gardez **au moins un quart de villageois sans pouvoir** : ce sont eux qui font les votes honnêtes.
- **4 bâtiments** pour une partie simple, **6** pour une partie riche ; évitez le Gibet à moins de huit joueurs, il bloque trop de votes.`
    },
    {
      titre: "Le Village",
      texte: `# Des gens qui comptent

Dans la variante **Le Village**, certains joueurs tiennent un bâtiment de Brumecombe et deviennent l'une de ses **personnalités**. Leur personnalité est **connue de tous**, comme un jeton posé face visible devant eux ; leur carte de rôle, elle, reste **secrète** : le Prieur peut être un loup. Le pouvoir du bâtiment s'ajoute à celui du rôle.

À la distribution, le narrateur annonce qui tient quel bâtiment (il peut changer la proposition avant la première nuit). Ceux qui n'ont rien sont des **Chemineaux** : sans toit ni pouvoir de bâtiment, mais le Régent, le Perruquier, la Pie et l'Incendiaire n'ont pas prise sur eux.

Un pouvoir **permanent** vaut toute la partie ; un pouvoir **unique** sert une fois. Un bâtiment qui brûle prive son occupant de son pouvoir. Un occupant qui meurt libère son bâtiment.

# Les personnalités

- **Métayers** (les six métairies) — à partir du deuxième jour, les Métayers vivants débattent et votent entre eux pour désigner le **Bailli**, l'un d'eux : dans cette variante, le village ne l'élit pas. Le Bailli qui meurt choisit son successeur parmi les Métayers vivants. Le dernier Métayer mort, Brumecombe n'a plus de Bailli. *Permanent.*
- **Prieur** (le prieuré) — à tout moment du jour, même après qu'un condamné a été désigné, il fait venir un joueur, qui lui montre sa carte en secret. *Unique.*
- **Remégeux** (la masure) — à tout moment du jour, il rend à un joueur le pouvoir unique de son bâtiment, déjà servi : ce pouvoir sert une fois de plus. *Unique.*
- **Régent** (l'école) — chaque jour, juste avant le vote, il met au coin un ou deux joueurs : ils débattent, mais ne votent pas ce jour-là. Lui ne vote jamais. Il peut mettre au coin le Cabaretier, jamais un Chemineau. *Permanent.*
- **Fournière** (le fournil) — chaque nuit, quand la meute rentre se coucher, elle entrouvre les yeux. Sur table, elle voit qui passe ; en ligne, elle a une chance sur trois d'entrevoir un loup, dont le nom lui est soufflé au matin. *Permanent.*
- **Perruquier** (l'échoppe) — à tout moment du jour, il élimine un joueur de son choix (jamais un Chemineau). Si c'était un loup, le village le félicite ; sinon, il paie sa méprise de sa vie, aussitôt. *Unique.*
- **Cabaretier** (le cabaret) — la meute ne peut pas le dévorer, et le village ne peut pas voter contre lui. Il vote à découvert, avant tout le monde (en ligne : son vote est annoncé dès qu'il le pose). S'il vote contre un joueur que le vote désigne (même gracié ensuite), il perd cette protection. Les autres pouvoirs le touchent comme tout le monde. *Permanent.*
- **Prévôt** (la prévôté) — quand un bâtiment se libère, il peut y loger le Chemineau de son choix, qui peut refuser. Le Chemineau prend le bâtiment et son pouvoir entier (un pouvoir unique déjà servi redevient disponible). Le Prévôt mort, plus personne n'est logé. *Permanent.*
- **Hobereau** (le manoir) — après un vote, celui que le village vient de condamner peut le supplier : s'il le gracie, le condamné n'est pas exécuté et sa carte reste cachée. Il peut se gracier lui-même. *Unique.*

# L'Incendiaire

Un rôle du Village qui n'existe que dans cette variante.

${ficheDuRole(ROLES.find(r => r.system.cle === "incendiaire"))}

# Quand le village perd la tête

Si l'Aïeul tombe de la main du village, les personnalités perdent leur pouvoir comme les métiers ; les Métayers gardent la désignation du Bailli, qui est une charge.`
    },
    {
      titre: "Le Pacte",
      texte: `# Les veillées d'autrefois, telles quelles

Le niveau **Le Pacte** (proposé d'abord à la préparation) compose la veillée avec les seuls personnages des veillées d'autrefois : les loups (Loup de Brumecombe, Loup affamé, Louve mère, Loup pâle), les gens du village (Villageois, Franc-Villageois, Liseuse de cendres, Entremetteuse, Herboriste, Braconnière, Enfant de la brume, Garde du pont, Aïeul, Souffre-douleur, Innocent, Lavandières, Bûcherons, Furet, Gardeuse d'oies, Greffier bègue, Vieux Sergent, Pie), les visages changeants (Chapardeur, Bateleur, Mâtin, Enfant des bois, Chambrière) et les solitaires (Feu follet, Joueur de vielle, Illuminé). Avec **Le Village**, l'Incendiaire et les personnalités s'y ajoutent.

Ni nos bâtiments communaux (Chapelle, Gibet, Pont…), ni nos métiers : la veillée se joue comme autour d'une vraie table. Les autres niveaux (débutants, classique, chaos) gardent tous les rôles des Veillées. Les variantes ci-après se combinent avec n'importe quel niveau.

# Une partie simple : bâtiments et métiers

À la préparation (et dans les réglages du monde), deux choix valent pour tous les niveaux :

- **Bâtiments du village** : *aucun* (une partie simple, avec les seuls personnages : rien ne dépend des bâtiments, les repères de la carte restent de simples décors), *tirés au hasard* (ceux de la composition, comme avant) ou *choisis* (cochez ceux de la veillée). Le Pacte n'en tire aucun ; *choisis* en ajoute quand même si vous le voulez.
- **Métiers** : *oui* (chacun reçoit un métier public en plus de son rôle) ou *non*. Le Pacte n'en distribue jamais.

La Table de jeu retient le dernier choix. Le Village (les personnalités) reste une case à part.

# À la distribution

Chaque joueur reçoit dans son carnet secret, en plus de sa carte, une explication de sa place : ce que fait son rôle, quand le narrateur l'appelle et ce qu'il lui demandera, comment il gagne, puis son métier et sa personnalité s'il en a. Le carnet s'ouvre de lui-même ; on le rouvre à tout moment.`
    },
    {
      titre: "Les variantes du jeu de soirée",
      texte: `# À choisir à la préparation

Chaque variante est une case de la préparation (et un réglage du monde, qui retient le dernier choix). Elle est annoncée à la distribution : tout le monde connaît les règles de la veillée. Aucune ne se joue dans une Nuit de la Saint-Martin.

# Veillée aux chandelles

Une chandelle brûle devant chaque joueur (en ligne : sur sa carte, à la Table de jeu). Chaque matin, la chandelle de la victime de la meute est soufflée ; après le vote, le condamné souffle la sienne.

**Version angoissante** : ce sont les loups eux-mêmes qui soufflent, la nuit, la chandelle de leur victime — chacun la sienne, en secret. S'ils n'ont pas tous soufflé la même, plus d'une chandelle s'éteint : la meute n'a **pas de victime**, et le village voit au matin quelles chandelles se sont éteintes (on les rallume ensuite). Un loup qui ne souffle rien n'éteint rien.

# La Chaîne des innocents

Le condamné du jour n'est pas voté. Tous les vivants sont debout. Le voisin de gauche du dernier éliminé désigne un villageois debout dont il **garantit l'innocence** ; celui-ci s'assied et désigne à son tour un autre villageois debout, et ainsi de suite. **Le dernier debout est condamné.** Les loups peuvent se blanchir entre eux : c'est voulu. En ligne, chacun désigne dans une fenêtre ; s'il ne répond pas à temps, le sort désigne pour lui. Sans mort encore, la chaîne part du Bailli, sinon du premier de la table. Pas de Banc des accusés avec elle.

# Le Mur des murmures

Chaque nuit, chaque vivant peut écrire une **courte phrase anonyme** sur le mur (une fenêtre s'ouvre en fin de nuit ; on peut passer). Au matin, le narrateur lit toutes les phrases, mêlées. **Personne ne saura jamais qui a écrit quoi**, pas même le narrateur. Elle se joue avec toutes les autres.

# Double visage

- **Petite complication** : chaque joueur reçoit un **rôle visible**, retourné devant tous, parmi la Liseuse de cendres, la Braconnière, l'Herboriste, l'Entremetteuse, le Garde du pont, l'Aïeul, le Souffre-douleur et jusqu'à deux Villageois ; puis une **carte d'allégeance** secrète (deux loups, le reste villageois) qui fait son camp. Un joueur d'allégeance loup se réveille avec la meute et **garde son pouvoir visible**. La Liseuse lit l'allégeance, pas le rôle visible.
- **Grande complication** : les mêmes cartes, mêlées, **deux par joueur**, face cachée. Une carte de loup fait un loup ; une carte à pouvoir donne son pouvoir (deux cartes à pouvoir : les deux, par exemple Herboriste et Liseuse, ou Aïeul et Souffre-douleur). La Liseuse lit les deux cartes.
- De 7 à 9 joueurs avec un paquet ; de 10 à 18, un second paquet s'ajoute (trois loups jusqu'à 13 joueurs, quatre au-delà). Ni à la petite tablée, ni avec la peste noire.

# Les Vendanges

Un **loup de plus** que d'habitude, et tous les pouvoirs sont **éméchés** jusqu'à la fin :

- la meute ne dévore qu'un **voisin d'un loup** ;
- la Liseuse désigne un joueur et lit les rôles de ce joueur et de ses deux voisins, **sans savoir lequel est à qui** ;
- la Braconnière emporte l'un de ses **deux voisins** ;
- l'Enfant de la brume n'épie plus la meute, seulement **l'Herboriste** (qui elle est, ce qu'elle fait), sans danger ;
- le Chapardeur, la première nuit, **échange sa carte** avec celle d'un joueur de son choix (chacun vérifie la sienne au matin) ;
- le Bailli **vote seul, le premier**, à découvert ; les autres attendent son vote ;
- le Souffre-douleur ne meurt plus à la place des ex æquo, mais **à la place d'un de ses deux voisins** condamné par le vote ;
- l'Innocent ne change pas ;
- l'Herboriste n'a **qu'une fiole**, et quand elle la verse, le **sort** décide : guéri ; guéri et devenu simple villageois ; guéri et devenu loup ; ou mort ;
- l'Entremetteuse unit les amants comme d'habitude, puis désigne l'un des deux et un autre joueur, qui s'aiment aussi : le **trompé** n'entraîne personne dans sa mort, chacun des deux autres entraîne les deux autres ; le trompé ne peut pas voter contre le trompeur (qui peut voter contre lui), et deux amants ne votent jamais l'un contre l'autre ;
- le Garde du pont ne protège que **lui-même ou un de ses deux voisins** ;
- le Joueur de vielle ne charme qu'**un joueur à la fois**.

Ni à la petite tablée, ni avec la peste noire.

# L'Envoûtement

Les victimes de la meute ne sont plus éliminées : elles **perdent aussitôt tous leurs pouvoirs** et restent **envoûtées**, en secret (seule la victime le sait). Si une victime envoûtée est condamnée par le village, **toutes les envoûtées d'avant elle** sont aussitôt éliminées avec elle. La meute gagne quand elle a envoûté **l'avant-dernier villageois**. Ni à la petite tablée, ni avec la peste noire.

# La Peste noire

Elle existe déjà (case de la préparation, page « La peste noire » du guide du joueur) ; elle se joue aussi au niveau Le Pacte.

# Les Hameaux

Plusieurs villages qui jouent en même temps, et des joueurs qui passent de l'un à l'autre : pas encore. Chaque monde de Foundry ne mène qu'une veillée à la fois ; le narrateur peut en ouvrir plusieurs, sans passage d'un village à l'autre.`
    },
    {
      titre: "La Gazette de la lune",
      texte: `# Une carte chaque matin

Avec **La Gazette de la lune** (case de la préparation, réglage du monde), le narrateur mêle trente et une cartes Événement. **Chaque matin sauf le premier**, après l'annonce des morts, la carte du dessus est lue à tous — en ligne, par le **dernier éliminé** (« lue par… ») — et s'applique aussitôt. Le réglage du monde peut n'en faire lire qu'**un matin sur deux** ou **sur trois** ; le narrateur peut aussi **choisir lui-même** ses cartes et les faire lire quand il le veut (Table de jeu), et **poser des cartes permanentes dès le début** (cases de la préparation). Avec la Gazette, pas d'Almanach des brumes : l'un ou l'autre.

Une carte vaut **ce jour** (immédiate ; parfois aussi la nuit qui suit), **la nuit qui vient**, **jusqu'à la fin** (permanente), ou **jusqu'à ce qu'elle serve** (le prochain vote, la prochaine proie). L'encart « La Gazette de la lune » de la Table montre les cartes en jeu.

# Les traits visibles

Beaucoup de cartes parlent de l'allure des gens. Chaque personnage reçoit, à la distribution, des **traits visibles de tous** (sur sa fiche et sa carte de la Table) : **femme ou homme**, **jeune ou vieux** (moitié-moitié autant que possible, avec un âge qui départage « le plus jeune »), et, oui ou non, **lunettes**, **bijou visible**, **sabots**, **coiffe sombre**, **pipe** ; enfin il **habite le bourg** ou **un écart** (les maisons de l'autre rive). Un trait posé à la main sur un villageois (un portrait, un genre choisi) est respecté.

# Les trente et une cartes

${CARTES_DE_LA_GAZETTE.map(([, nom, texte]) => `- **${nom}** — ${texte}`).join("\n")}

# Comment le système les mène

- **Les absents** (le Bal, la Cueillette, le Banquet, la Battue, le Petit Commis) sont réduits au silence pour le débat et ne votent pas ; personne ne peut voter contre eux (sauf le Petit Commis, qui reste candidat). La nuit, un danseur ou un chasseur loup ne chasse pas, et aucun danseur, chasseur ou commis ne peut être dévoré.
- **La Crue** : « Ouvrir le vote » est refusé ce jour ; la nuit, après la meute, une étape « la seconde proie » propose les joueurs du même refuge que la première.
- **Le Toucher mortel** : après la meute, une étape « le geste de la meute » : un loup doit désigner de nouveau la proie (en ligne, son geste), sinon elle est épargnée.
- **Le Retour de flamme** et **le Spectre** se jouent à l'aube : le Villageois devenu loup l'apprend seul ; l'ancien loup désigné par la proie meurt avec la carte de la proie (une mort de la nuit, comme une autre).
- **La Grande Défiance** : chacun choisit deux amis dans la fenêtre de vote (un second clic retire un ami). **Le Cauchemar** et **les Influences** : un vote à tour de rôle, à découvert ; chacun a le délai des choix, puis son tour passe.
- **Le Dépit** et **l'Enthousiasme** attendent le prochain éliminé du village ; le second vote s'ouvre de lui-même, sans débat.
- **Pile ou face** et **le Marché avec le Malin** se jouent juste après le verdict, avant que la carte du condamné soit retournée. Un marché perdu (le camp du marchand a perdu) l'exclut de la partie suivante.
- **L'Exécuteur** s'élit aussitôt (une voix chacun ; égalité : le sort). Ensuite, la carte d'un condamné n'est plus retournée : elle va au seul carnet de l'Exécuteur.
- **Le Châtiment** : le dernier éliminé désigne (au délai, le sort) ; un vote de soutiens s'ouvre ; avec moins de deux soutiens, l'accusé tombe. Il peut lancer un appel, annoncé au village.
- **Le Jour des sots** : les pouvoirs passent d'une carte à l'autre jusqu'au matin (chacun l'apprend dans son carnet) ; les fioles de l'Herboriste suivent son remède. **La Nuit des sots** : les loups lisent chacun un rôle ; la Braconnière, l'Herboriste et la Liseuse de cendres forment la meute de cette nuit.
- **Le Méchant Benêt** : le premier éliminé est appelé en tout début de nuit ; son allié secret apprend les loups dans son carnet, et gagne avec eux.
- **Les cartes de conduite** (Lune noire, les Bonnes manières, Ni loup ni moi) : le narrateur retire son vote à qui enfreint la règle (Table de jeu, « Retirer son vote ») ; pour Ni loup ni moi, le système relève lui-même les mots « loup » et « moi » écrits au chat.
- **Dimanche de soleil, Fin des vendanges, Lundi gris** : le narrateur peut appliquer pour ce seul tour l'Envoûtement, les Vendanges ou la Chaîne des innocents (Table de jeu) ; au matin suivant, la variante s'en va.

# Le Crieur public

Une **charge publique**, en plus de la carte de rôle (case de la préparation). Avant la partie, le narrateur lui confie quelques cartes de la Gazette (réglage du monde : trois par défaut, cinq au plus ; jamais de Spiritisme ; tirées au hasard) ; elles sont **secrètes**, dans son carnet. Le **Bailli le nomme** (jamais lui-même). **Chaque matin dès le lendemain**, on lui demande s'il a une annonce : s'il lit une carte, elle s'applique aussitôt. Après son annonce et avant le vote, le Bailli peut le **révoquer** et en nommer un autre (un pouvoir de jour du Bailli). Élu Bailli, le Crieur transmet sa charge à un autre ; mort, le Bailli désigne son successeur ; un nouveau Bailli garde ou change de Crieur. Avec la Gazette, ses cartes sont retirées du paquet.

# La Liseuse d'étoiles et le Spiritisme

Le narrateur garde **cinq cartes Spiritisme**, hors du paquet de la Gazette. Chaque nuit, la **Liseuse d'étoiles** dit si elle veut s'en servir. Au matin, la carte est lue (ses quatre questions) ; elle en choisit une et désigne le **Spirite**, qui la pose à **l'esprit du premier mort**. En ligne, le système calcule la vraie réponse et l'annonce (« l'esprit répond : oui ») ; un mort humain peut la confirmer, sans mentir. La carte est défaussée. Sans mort encore, l'esprit ne répond pas et la carte reste en main.

${SEANCES_DE_SPIRITISME.map(([nom, questions]) => `- **${nom}** — ${questions.join(" · ")}`).join("\n")}`
    }
  ]
});

export const GUIDES = [guideJoueur, guideNarrateur, variantes, LIVRE_DE_BRUMECOMBE, ...JOURNAUX_DE_FETE];
