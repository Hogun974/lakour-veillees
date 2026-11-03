// Journaux des Veillées de Brumecombe : le guide du joueur (visible), le guide du narrateur (caché, lu par le MJ IA)
// et les règles des variantes (visibles). Les listes de rôles, métiers et bâtiments sont tirées des données mêmes
// (roles.mjs, metiers.mjs, batiments.mjs) : un rôle ajouté apparaît dans les guides. Textes originaux.
import { ORDRE_MEUTE, journal } from "./aides.mjs";
import { ROLES } from "./roles.mjs";
import { METIERS } from "./metiers.mjs";
import { BATIMENTS } from "./batiments.mjs";
import { ALMANACH } from "./tables.mjs";

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
export const NOUVEAUX_ROLES = ["loup-des-roseaux", "louvetier", "pecheur-de-nuit", "dame-du-gue"];
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

Quatre rôles et deux métiers venus des berges de la Brume. Ils ne sont pas dans toutes les compositions, et le narrateur ne dit jamais lesquels sont en jeu : à vous de le deviner.

${[...NOUVEAUX_ROLES.map(c => ficheDuRole(ROLES.find(r => r.system.cle === c))),
  ...NOUVEAUX_METIERS.map(c => ficheDuMetier(METIERS.find(m => m.system.cle === c)))].join("\n\n")}`
});

// Ordre de réveil, calculé depuis les rôles : la meute groupée à 40, puis chaque rôle qui agit seul.
export function ordreDeReveil() {
  const actifs = ROLES.filter(r => r.system.nuit.actif);
  const etapes = new Map();
  for (const r of actifs) {
    const o = r.system.nuit.ordre;
    const nom = o === ORDRE_MEUTE && r.system.camp === "meute" ? "La meute (tous les loups vivants)" : r.name;
    const precisions = [r.system.nuit.premiereNuitSeulement && "première nuit seulement", r.system.nuit.uneNuitSurDeux && "une nuit sur deux"].filter(Boolean);
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
- **Les amants** (liés par l'Entremetteuse) gagnent ensemble s'ils sont les deux derniers vivants, quel que soit leur camp ; sinon chacun gagne avec son camp.

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
- En cas d'**égalité**, c'est **lui qui tranche** : une fenêtre s'ouvre chez lui seul, avec les ex æquo ; il désigne le condamné (même lui-même), ou passe, et alors personne n'est exécuté.
- À **sa mort**, il **remet le sceau** à un vivant de son choix (une dernière fenêtre, depuis la tombe). S'il ne choisit personne, la charge reste vacante et le village élit un nouveau Bailli au jour suivant (le jour même, si l'on n'a pas encore voté).

Un Bailli peut être un loup : le village l'a choisi, à lui de bien choisir.

# Le vote

Le narrateur ouvre le **vote** : chaque vivant clique sur un nom dans la fenêtre de vote (ou sur la Table de jeu). On peut changer d'avis jusqu'à la clôture. Les voix restent **secrètes jusqu'au dépouillement** : on voit seulement qui a déjà voté. Au dépouillement, le joueur qui a **le plus de voix est exécuté** et quitte la partie — sauf si le **Juge de paix** annule le vote (le village revote aussitôt) ou si le plus désigné porte le **ruban de la Tisserande** (une minute de défense de plus, le vote reste ouvert). Après la clôture, chacun peut relire **qui a voté pour qui** dans le Registre du greffier.

Si la **Chapelle** est en jeu, un second vote, rapide, désigne ensuite qui dormira à l'abri la nuit suivante.

Si la **Rosière** est exécutée par le vote, le serment de Brumecombe est rompu : **le Village perd aussitôt**. Réfléchis avant de condamner quelqu'un qui s'en réclame… et souviens-toi qu'un loup peut mentir.

Avec la variante **Banc des accusés**, on ne vote pas pour n'importe qui : pendant le débat, chaque vivant **accuse une fois** (champ « Accuser » de la Table de jeu), et chacun ne peut être accusé qu'une fois par jour. Les accusés sont **jugés un par un** : voter pour l'accusé, c'est le condamner ; s'abstenir, c'est l'acquitter. Il faut **la moitié des voix des vivants** (plus de la moitié avec le Gibet) ; dès qu'un accusé est exécuté, les autres sont tirés d'affaire pour la journée.

Avec la variante **Glas du deuil**, chaque innocent exécuté par le vote fait sonner le glas sur Brumecombe (« le glas sonne pour la 2e fois »). Le village n'apprend rien de plus… mais la meute, elle, y gagne un pouvoir qui grandit à chaque glas. Méfiez-vous des votes hâtifs.

**Arriver en cours de partie** : un joueur qui arrive après la distribution entre comme **gens de passage** (Rémouleur, Montreur d'ours ou Pèlerine) : son **rôle est connu de tous**, son **camp ne l'est pas** (le narrateur le lui dit en secret, et il peut être de la meute). Son pouvoir est fort mais ne sert **qu'une fois**, pendant le jour. Le village peut le chasser par un **vote d'exil** : il reprend la route sans mourir, son camp tu.

**Partir avant la fin** : le bouton **Quitter la veillée** (Table de jeu) te fait quitter la partie sans mourir : ni ton rôle ni ton camp ne sont révélés, ta voix en cours est retirée, et la partie continue sans toi (tu ne gagnes ni ne perds).

**Égalité** : s'il y a un **Bailli**, il tranche. Sans Bailli (charge vacante, ou Bailli absent de la partie), les ex æquo ont trente secondes chacun pour se défendre, puis le village revote **entre eux seulement** ; nouvelle égalité : personne n'est exécuté ce jour-là, et la nuit tombe.

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
    pageDesNouveaux()
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

**Ne révèle jamais la composition** : ni les rôles en jeu, ni le nombre de loups. Les bâtiments, eux, sont publics. Une partie peut même n'avoir aucun loup (la **peste noire**, page suivante) : rien ne doit le laisser deviner.

# La distribution

- Distribue les rôles et les métiers au hasard (la Table de jeu s'en charge). Chaque joueur reçoit son rôle en message privé.
- Attribue une maison à chacun, dans l'ordre (« Maison 1 », « Maison 2 »…). Avec le Pont en jeu, rappelle que les maisons 13 à 18 sont sur l'autre rive.
- **Chasseur de primes** : tire sa cible au hasard parmi les autres joueurs (jamais un loup si possible, pour que la partie reste ouverte), et donne-la-lui la première nuit.
- Annonce les **bâtiments en jeu** et les **variantes** choisies (révélation à la mort, durée du débat, **Bailli**).
- **Masques de veillée** (réglage, par défaut oui) : le système remet en secret à chaque loup deux ou trois rôles du Village absents de la partie (trois pour une meute, deux pour un loup seul ; jamais dans une peste noire). Tu les vois dans ta chronique secrète ; ne les cite jamais, ne les confirme ni ne les démens.
- Lis à voix haute une présentation du village (deux ou trois phrases, pas plus).`
    },
    {
      titre: "La peste noire",
      texte: `# Une partie sans loups

Rarement, une partie composée d'elle-même (Table de jeu, ou MJ IA) devient une **peste noire** ; tu peux aussi la choisir (Table de jeu, préparatifs : case **« Partie peste noire »**). Aucun rôle de la meute : leurs places vont au village (et aux solitaires que permet le niveau) ; métiers et bâtiments comme d'habitude. Toi seul le sais : la Table de jeu le marque « Peste noire » chez le MJ, jamais chez les joueurs.

# La nuit

- À la place de la meute, à l'ordre 40, l'étape **« la peste »**.
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

# Comment réveiller

- Une **fenêtre de choix** par rôle, avec un délai (quarante-cinq secondes par défaut ; une minute pour la meute, qui discute). Au délai, le rôle **passe**.
- La meute vote : à la majorité, et à égalité le premier choix. Les loups peuvent se parler en privé pendant leur réveil ; rien de ce qu'ils disent ne sort de leur canal.
- Note chaque action dans l'ordre (Table de jeu ou noterAction), même quand le rôle passe.
- Les loups qui ont un pouvoir propre (Louve mère, Loup affamé, Loup hurleur, Loup flaireur, Loup des roseaux) se réveillent **avec la meute à 40**, puis **seuls à leur ordre**.
- **La meute choisit ensemble** : un seul réveil à 40, un vote des loups vivants. Les loups à pouvoir propre se réveillent **ensuite, seuls**, chacun à son ordre.
- **Herboriste** : dis-lui la victime de la meute avant de lui demander son choix (même si la victime est protégée : elle ne doit rien deviner). Si elle désigne **la victime**, c'est le remède ; si elle désigne **quelqu'un d'autre**, c'est le poison. Une fiole par nuit.
- **Pyromane** : s'il désigne une autre maison, il l'asperge ; s'il **se désigne lui-même**, il embrase toutes les maisons aspergées.
- **Enfant de la brume** : s'il épie, montre-lui ce que la meute s'est dit, sans les noms. Tire un dé à trois faces : sur un 1, il est repéré et devient la victime de la meute à la place de la sienne.
- **Ermite** : tire au hasard un joueur qui a agi cette nuit (la meute compte) ; s'il n'y en a aucun, dis « aucune lanterne n'a bougé ».
- **Loup des roseaux** : il désigne une maison ; dis-lui seulement si son occupant **a agi** cette nuit (pouvoir de nuit, ou la chasse), jamais ce qu'il a fait. Il rôde au seuil : la lanterne de la Veilleuse le démasque comme un loup qui entre.
- **Louvetier** : il apprend le camp d'un joueur, comme la Liseuse. Mais toute vision (Liseuse, Sourcier, Loup flaireur) le voit **de la meute** : réponds-leur « Meute » sans hésiter, même si tu sais qu'il n'en est pas.
- **Pêcheur de nuit** : un seul harpon par partie. Sa cible meurt à l'aube, sauf protection (Garde du pont, Gardienne des clés), remède ou absence (Passeur, Grange) ; ni le verrou du Forgeron, ni l'asile de la Chapelle, ni la Taverne ne l'arrêtent, car ce n'est pas une attaque de loup. Il atteint aussi le Pyromane et la Dame du gué.
- **Dame du gué** : elle ne se réveille qu'**une nuit sur deux** (nuits paires). Sa noyade suit les mêmes règles que le harpon. La meute ne peut pas la tuer : si elle entre chez elle, elle repart bredouille, et tu n'en dis rien au matin.
- **Fossoyeur** : il ne peut interroger qu'un mort. S'il n'y en a pas, réveille-le quand même et dis-lui « aucune tombe fraîche ».
- **Messager** : il désigne l'expéditeur puis le destinataire. Une fenêtre s'ouvre aussitôt chez l'expéditeur, qui écrit sa phrase ; le système la remet en secret au destinataire à l'aube, avec le nom de l'expéditeur. Tu ne la lis à personne.
- **Effets du jour** : un joueur caché (Grange) ou passé sur l'autre rive (Passeur) ne se réveille pas et personne ne peut le désigner ; un joueur gardé à l'œil (Garde du guet) ne peut viser que sa propre maison (une tombe n'en est pas une) ; la meute ne peut viser ni l'asile de la Chapelle, ni les dormeurs de la Taverne (sauf si un loup dort parmi eux), ni l'autre rive quand le Pont est bloqué ou que l'Éclusière a fermé l'écluse. La Table de jeu et le MJ IA proposent d'eux-mêmes les bons candidats.

# Ce que tu dis

Garde les mêmes phrases d'une nuit à l'autre : « La nuit tombe sur Brumecombe. Les volets se ferment. » Puis, pour chaque rôle, une seule phrase neutre. Ne commente jamais un choix.`
    },
    {
      titre: "L'aube et les morts",
      texte: `# Résoudre la nuit, dans cet ordre

Le système fait tout ceci de lui-même à l'aube (bouton « Résoudre l'aube » de la Table de jeu, ou la fin de la nuit du MJ IA) ; l'ordre sert à trancher un cas qu'il ne connaîtrait pas.

1. **Cachettes et asiles** : Grange et Passeur (personne n'y entre, ni loup, ni visite, ni feu ; celui qui s'y cache n'agit pas), Chapelle (la meute n'y entre pas), Taverne (la meute n'y tue pas, sauf si un loup y dort : alors sans protection).
2. **Protections** : Garde du pont, Gardienne des clés, verrou du Forgeron (la première attaque de loup échoue).
3. **Morsure** : si la Louve mère a mordu, la victime change de camp, personne ne meurt de la meute.
4. **Attaques** : victime de la meute, seconde victime du Loup affamé, harpon du Pêcheur de nuit, noyade de la Dame du gué (ces deux-là ne sont pas des attaques de loup : seuls une protection, un remède ou une absence les arrêtent).
5. **Remède et poison** de l'Herboriste.
6. **Feu** : si le Pyromane a embrasé, toutes les maisons aspergées brûlent (protégées ou non).
7. **Lanterne** : un loup entré dans la maison éclairée est démasqué.
8. **Cascades** : amant mort de chagrin, Braconnière qui emporte quelqu'un (elle choisit au matin).
9. **Informations** : Liseuse, Sourcier, Louvetier, Loup flaireur, Loup des roseaux, Ermite, Fossoyeur, mot du Messager (en secret) ; lame de la Forge (« du sang de bête sur le seuil »), Moulin, Lavoir, Cimetière (annoncés au village).
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
- **Égalité** : le système demande au Bailli, et à lui seul, de trancher parmi les ex æquo (fenêtre ou carte ; un compagnon IA tranche par son cerveau). La clôture attend son choix (au plus le délai des choix). S'il passe, personne pour cette place. Avec le Gibet, il ne choisit que parmi ceux qui ont la majorité absolue. Tant qu'il n'a pas tranché, ni nouveau vote ni changement de phase ; s'il tarde (absent, page rechargée), tranche à sa place depuis la Table de jeu (un bouton par ex æquo, ou « Personne »).
- **À sa mort**, le système demande au défunt à qui il remet le sceau (une fenêtre posthume, après toutes les morts de la nuit). La « Prochaine étape » attend le sceau, au plus le délai des choix comptés depuis sa mort (même si ta page a été rechargée entre-temps). Sans réponse, la charge est vacante : le village élit un nouveau Bailli au jour suivant (ou le jour même, avant le vote d'exécution). Si un joueur dicte son choix à voix haute, ou si la charge reste vide, nomme le Bailli toi-même (bouton **« Nommer le Bailli »** de la Table de jeu).
- Le Bailli est **public** : tu peux le nommer dans tes récits, rappeler sa voix double, le prendre à témoin.

# Le Registre du greffier

Le système y inscrit seul chaque vote clos (voix par voix), chaque mort avec sa **cause publique**, l'élection et la succession du Bailli. Un vivant peut y faire inscrire une **déclaration** pendant le jour (trois par jour, pas s'il est réduit au silence pendant le débat et le vote) : elle est annoncée au chat. Tu ne la commentes jamais, tu ne la confirmes ni ne la démens, même quand tu sais qu'elle ment. Le Registre sert de mémoire au village : appuie-toi dessus pour tes « Précédemment… ».

# Le vote

- Ouvre le vote avec les vivants comme candidats, une minute par défaut. Les voix restent secrètes jusqu'au dépouillement.
- Annonce le décompte, puis l'exécuté. Avec le **Sonneur**, chaque voix compte double. Avec le **Gibet**, il faut plus de la moitié des vivants.
- Le **ruban de la Tisserande** : si le plus désigné le porte, la clôture ne dépouille pas ; il a une minute de défense de plus, puis clos de nouveau.
- Le **Juge de paix** peut annuler le vote juste après le décompte, avant l'exécution (depuis sa Table de jeu) : il se révèle, le vote se rouvre, revote immédiat, sans débat. Demande toujours « quelqu'un s'y oppose-t-il ? » avant d'exécuter, et n'exécute que le résultat du dernier vote.
- Avec la **Chapelle**, ouvre ensuite le vote de la Chapelle (bouton de la Table de jeu) : l'élu y dort à l'abri la nuit suivante.

# Les égalités

- **Avec un Bailli vivant** : il tranche (le système le lui demande) ; pas de revote.
- Sans Bailli, première égalité : les ex æquo ont **trente secondes** chacun, puis revote **entre eux seulement**.
- Sans Bailli, seconde égalité : **personne n'est exécuté** ; la nuit tombe.
- Un joueur seul en tête mais sans majorité (Gibet) : personne n'est exécuté.
- Le **Loup déguisé** en tête d'un vote sans être exécuté perd son masque : note-le.

# Victoires à vérifier après chaque mort

- Plus aucun loup : victoire du **Village**.
- Loups aussi nombreux que les autres vivants : victoire de la **Meute**.
- **Revenant** exécuté, cible du **Chasseur de primes** exécutée : victoire immédiate du solitaire (la partie continue pour les autres si tu le souhaites, ou s'arrête : annonce-le au début).
- **Amants** derniers vivants : ils gagnent ensemble.
- **Peste noire** : le cri juste fait gagner le village ; sinon la peste l'emporte quand il reste un vivant ou aucun (ni « plus aucun loup », ni amants, ni tueur solitaire ne finissent une peste).
- **Pyromane** ou **Dame du gué** dernier vivant (ou avec un seul non-loup) : il gagne seul. Tant que l'un de ces deux tueurs vit, le village n'a pas gagné, même sans loup ; s'ils sont tous les deux en vie, aucun ne gagne avant que l'autre tombe.
- **Rosière** exécutée par le vote : le Village perd aussitôt, **la meute l'emporte** (dans une peste noire : la peste). Le Revenant ou le Chasseur de primes exécutés gagnent d'abord. Morte la nuit, rien de particulier.
- **Glas final** (si tu l'as posé) : au soir du jour annoncé, après son vote (ou si la nuit allait tomber), la partie s'arrête : la meute gagne si un loup vit encore, sinon le tueur solitaire encore en vie, sinon le village ; dans une peste noire, la peste.

# Le Dernier souffle, le Somnambule, les Saints du calendrier

- **Dernier souffle** (réglage, par défaut oui) : chaque mort garde une voix, une seule fois, pour un vote d'exécution (ni Chapelle, ni élection du Bailli). Le système la reçoit et la consomme au dépouillement ; le Gibet ne compte que les morts qui ont soufflé à ce vote, et les voix qui manquent sont celles des vivants. Tant qu'un mort garde son souffle, il ne voit pas les rôles cachés, n'entend pas la tanière et ne parle qu'aux morts qui le gardent aussi ; son souffle rendu, « les morts voient tout » s'applique. Ne lui dis rien des rôles avant.
- **Somnambule** (rôle sur demande) : à la distribution, il reçoit la carte d'un rôle de vision (Liseuse de cendres, Fossoyeur ou Sourcier, de préférence absent de la partie) et le joue de bonne foi ; le système lui rend des visions **fausses** (camp inverse, « même camp » à l'envers, faux rôle d'un mort). Toi seul le sais (marque sur ta Table de jeu). À sa mort, et à la fin, il est révélé Somnambule. Ne le trahis jamais, même quand ses visions font exécuter un innocent.
- **Bonne étoile** (Table de jeu, avant la première aube) : tu protèges en secret un joueur débutant la première nuit. Personne n'est prévenu ; une attaque contre lui échoue sans bruit.
- **Glas final** (Table de jeu, ou à la préparation) : le jour où la partie s'arrêtera, annoncé à tous dès que tu le poses.

# Gens de passage, Banc des accusés, Glas du deuil

- **Gens de passage** (réglage, par défaut oui) : un joueur arrive en cours de partie ? Bouton **Accueillir un gens de passage** (Table de jeu), à l'aube ou pendant le débat, hors vote. Le système tire son rôle de passage (public, annoncé au chat) et son **camp secret**, pour ne pas déséquilibrer : la meute s'il lui manque des loups (le plus souvent), sinon le village (rarement la meute) ; jamais la meute dans une peste noire. Lui seul et la meute le savent ; ne le dis jamais. Son pouvoir ne sert qu'une fois, de jour : **Rémouleur** (la première attaque de loup contre une maison échoue la nuit suivante), **Montreur d'ours** (la meute n'entre pas dans cette maison la nuit suivante), **Pèlerine** (elle apprend en secret le camp d'un joueur).
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

# Délais

- Fenêtre de nuit : 45 s, meute 60 s. Débat : 5 min. Vote : 60 s. Un joueur absent passe son tour ; un joueur absent deux nuits de suite peut être déclaré mort de fièvre (annonce-le comme une mort ordinaire, rôle révélé).`
    },
    {
      titre: "Cas particuliers",
      texte: `# Interactions courantes

- **Louve mère et protection** : une victime protégée ne peut pas être mordue ; la morsure est perdue.
- **Morsure d'un rôle à pouvoir** : le mordu garde son pouvoir et l'utilise pour la meute (une Liseuse mordue lit pour les loups). Il ne meurt pas s'il est la cible de la meute ensuite : il en fait partie.
- **Amants de camps opposés** : ils gagnent ensemble s'ils sont les deux derniers vivants. Un loup amant peut voter contre la meute pour sauver son amant.
- **Colporteur** : l'échange se fait avant les autres actions. Celui qui reçoit le Colporteur perd son pouvoir dès cette nuit. Un loup échangé quitte la meute ; le Colporteur devenu loup la rejoint.
- **Herboriste et feu** : le remède ne sauve pas d'un incendie, seulement de la meute.
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

# Changer de navigateur en pleine partie

Les secrets de la partie (les rôles et les camps de chacun, les choix de la nuit, primes, fioles, peste noire…) vivent dans le navigateur du MJ, et dans un **coffre chiffré** sur le serveur, celui du MJ IA (qui doit être actif). Chaque compte joueur garde un morceau de la clé, inutilisable seul. Si tu reprends la partie depuis un autre navigateur ou un autre ordinateur, il faut que **la majorité des joueurs** soient connectés pour rouvrir le coffre : les secrets reviennent d'eux-mêmes, en quelques secondes. Sans eux, un message te prévient, et le coffre s'ouvrira dès qu'ils seront là. Plus simple encore : garde la **clé de secours** du MJ IA (Réglages › MJ IA › Coffre) et réimporte-la sur l'autre navigateur. Donne un mot de passe à chaque compte joueur : un compte ouvert à tous est un morceau de clé que n'importe qui peut prendre.

# Si un joueur se trompe

- Un joueur révèle par erreur un message privé : rappelle la règle ; pas de sanction la première fois.
- Un mort parle : rappelle la règle ; s'il donne une information décisive, annule-la (« le village n'a rien entendu »).`
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
- **Glas final** et **Bonne étoile** : réglages du narrateur, à la Table de jeu (le jour où la partie s'arrête ; un débutant protégé en secret la première nuit).
- **Somnambule** et **Rosière** : rôles « sur demande », jamais tirés d'office ; le narrateur les ajoute à la main.
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
    }
  ]
});

export const GUIDES = [guideJoueur, guideNarrateur, variantes];
