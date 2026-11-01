// Journaux des Veillées de Brumecombe : le guide du joueur (visible), le guide du narrateur (caché, lu par le MJ IA)
// et les règles des variantes (visibles). Les listes de rôles, métiers et bâtiments sont tirées des données mêmes
// (roles.mjs, metiers.mjs, batiments.mjs) : un rôle ajouté apparaît dans les guides. Textes originaux.
import { ORDRE_MEUTE, journal } from "./aides.mjs";
import { ROLES } from "./roles.mjs";
import { METIERS } from "./metiers.mjs";
import { BATIMENTS } from "./batiments.mjs";

const ligne = d => `- **${d.name}** — ${d.__resume}`;
const rolesDu = camp => ROLES.filter(r => r.system.camp === camp);

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
- **Les amants** (liés par l'Entremetteuse) gagnent ensemble s'ils sont les deux derniers vivants, quel que soit leur camp ; sinon chacun gagne avec son camp.`
    },
    {
      titre: "Déroulement d'une partie",
      texte: `# La préparation

Le narrateur choisit une composition (selon le nombre de joueurs et le niveau), met 4 à 6 **bâtiments** en jeu, puis distribue en secret un rôle et un métier à chacun. Chacun reçoit son rôle en **message privé** et voit sa fiche ; personne d'autre ne la voit. Chacun a une **maison** sur la carte du village (« Maison 1 » à « Maison 18 »).

# La nuit

Le narrateur annonce la nuit. Tout le monde « ferme les yeux » : on se tait, on n'écrit plus sur le canal commun.

Le narrateur réveille les rôles **un par un, dans l'ordre**, toujours en secret : une **fenêtre de choix** s'ouvre chez le joueur concerné, avec une question (« Quelle maison éclaires-tu cette nuit ? ») et la liste des joueurs. Il choisit, ou il passe. Les loups se réveillent ensemble et votent pour leur victime ; à égalité, le premier choix l'emporte.

Si ta fenêtre ne s'ouvre pas, c'est que ton rôle ne joue pas cette nuit. Ne le dis à personne.

# L'aube

Le narrateur raconte ce que le village découvre au matin : qui est mort, et parfois comment. Selon le réglage, le **rôle des morts est révélé** ou non. Un mort ne parle plus, ne vote plus, et ne doit plus rien révéler aux vivants (il peut regarder la partie).

# Le jour

Le village **débat** : on accuse, on se défend, on ment ou l'on dit vrai. Le débat est minuté (cinq minutes par défaut, moins quand il reste peu de joueurs).

Les **pouvoirs de jour** (ton métier, quelques rôles comme le Juge de paix ou la Conteuse, et certains bâtiments) se jouent pendant le jour : clique sur ton pouvoir dans la **Table de jeu**, ou annonce-le au narrateur à voix haute. Le système vérifie que c'est le bon moment, applique l'effet et l'annonce au village. Un pouvoir « une fois par partie » ne revient pas.

# Le vote

Le narrateur ouvre le **vote** : chaque vivant clique sur un nom dans la fenêtre de vote (ou sur la Table de jeu). On peut changer d'avis jusqu'à la clôture. Les voix restent **secrètes jusqu'au dépouillement** : on voit seulement qui a déjà voté. Au dépouillement, le joueur qui a **le plus de voix est exécuté** et quitte la partie — sauf si le **Juge de paix** annule le vote (le village revote aussitôt) ou si le plus désigné porte le **ruban de la Tisserande** (une minute de défense de plus, le vote reste ouvert).

Si la **Chapelle** est en jeu, un second vote, rapide, désigne ensuite qui dormira à l'abri la nuit suivante.

**Égalité** : les ex æquo ont trente secondes chacun pour se défendre, puis le village revote **entre eux seulement**. Nouvelle égalité : personne n'est exécuté ce jour-là, et la nuit tombe.

Puis la nuit revient, et ainsi de suite jusqu'à la victoire d'un camp.`
    },
    {
      titre: "Dans Foundry",
      texte: `# Ce que tu vois

- **La carte du village** : chaque joueur a son jeton devant sa maison. Les jetons montrent un **villageois encapuchonné** tant que le rôle n'est pas révélé ; à la mort (si les rôles sont révélés), le jeton prend l'image du rôle.
- **La Table de jeu** (bouton dans les contrôles du calque Jetons) : la phase, le tour, le minuteur, qui vit et qui est mort, les métiers, les bâtiments en jeu, **tes pouvoirs de jour** (un bouton par pouvoir, grisé quand ce n'est pas le moment), ce qui vaudra la nuit prochaine (verrous, Taverne, Grange…), et pendant un vote, les boutons de vote.
- **Ta fiche** : ton rôle et ton pouvoir (toi seul et le narrateur les voyez), ton métier (public).
- **La fenêtre de choix de nuit** : elle ne s'ouvre que chez toi, et rien n'apparaît chez les autres. Si le Messager te choisit comme expéditeur, elle te demande d'écrire ta phrase.

# Les messages privés

Le narrateur te parle en message privé pour tout ce qui est secret : ton rôle, ce que tu apprends la nuit, le mot que te porte le Messager. Tout arrive dans ton **carnet secret** (bouton de la Table de jeu), envoyé à toi seul. **Ne recopie jamais un message privé sur le canal commun** : dire ce que tu sais, c'est ton droit ; montrer la preuve, c'est interdit.

# Le savoir-vivre de la veillée

- Pendant la nuit, silence sur le canal commun et sur la voix.
- Pas de capture d'écran de ta fiche ni de ta fenêtre de choix.
- Mentir sur ton rôle est permis, et même attendu. Tricher en dehors du jeu ne l'est pas.
- Les morts se taisent. Ils peuvent rire, mais en silence.
- On attaque des rôles, pas des personnes.

# Les compagnons IA

Pour compléter une petite table, le narrateur peut donner des places à des **compagnons IA** : des villageois joués par une IA, comme des joueurs. Ils reçoivent un rôle en secret, choisissent la nuit, parlent au débat et votent. Ils ne trichent pas : un compagnon ne sait que ce que sait son villageois (son rôle, son carnet, ce qui se dit en public). Soupçonne-les, crois-les ou mens-leur comme à n'importe qui.`
    },
    {
      titre: "Les rôles de la Meute",
      texte: `# La Meute

Les loups se reconnaissent dès la première nuit. Chaque nuit, **ils se réveillent ensemble** et désignent une victime. Certains loups ont en plus un pouvoir propre : ils se réveillent une seconde fois, seuls.

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

# La distribution

- Distribue les rôles et les métiers au hasard (la Table de jeu s'en charge). Chaque joueur reçoit son rôle en message privé.
- Attribue une maison à chacun, dans l'ordre (« Maison 1 », « Maison 2 »…). Avec le Pont en jeu, rappelle que les maisons 13 à 18 sont sur l'autre rive.
- **Chasseur de primes** : tire sa cible au hasard parmi les autres joueurs (jamais un loup si possible, pour que la partie reste ouverte), et donne-la-lui la première nuit.
- Annonce les **bâtiments en jeu** et les **variantes** choisies (révélation à la mort, durée du débat).
- Lis à voix haute une présentation du village (deux ou trois phrases, pas plus).`
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
- Les loups qui ont un pouvoir propre (Louve mère, Loup affamé, Loup hurleur, Loup flaireur) se réveillent **avec la meute à 40**, puis **seuls à leur ordre**.
- **La meute choisit ensemble** : un seul réveil à 40, un vote des loups vivants. Les loups à pouvoir propre se réveillent **ensuite, seuls**, chacun à son ordre.
- **Herboriste** : dis-lui la victime de la meute avant de lui demander son choix (même si la victime est protégée : elle ne doit rien deviner). Si elle désigne **la victime**, c'est le remède ; si elle désigne **quelqu'un d'autre**, c'est le poison. Une fiole par nuit.
- **Pyromane** : s'il désigne une autre maison, il l'asperge ; s'il **se désigne lui-même**, il embrase toutes les maisons aspergées.
- **Enfant de la brume** : s'il épie, montre-lui ce que la meute s'est dit, sans les noms. Tire un dé à trois faces : sur un 1, il est repéré et devient la victime de la meute à la place de la sienne.
- **Ermite** : tire au hasard un joueur qui a agi cette nuit (la meute compte) ; s'il n'y en a aucun, dis « aucune lanterne n'a bougé ».
- **Fossoyeur** : il ne peut interroger qu'un mort. S'il n'y en a pas, réveille-le quand même et dis-lui « aucune tombe fraîche ».
- **Messager** : il désigne l'expéditeur puis le destinataire. Une fenêtre s'ouvre aussitôt chez l'expéditeur, qui écrit sa phrase ; le système la remet en secret au destinataire à l'aube, avec le nom de l'expéditeur. Tu ne la lis à personne.
- **Effets du jour** : un joueur caché (Grange) ou passé sur l'autre rive (Passeur) ne se réveille pas et personne ne peut le désigner ; un joueur gardé à l'œil (Garde du guet) ne peut viser que sa propre maison (une tombe n'en est pas une) ; la meute ne peut viser ni l'asile de la Chapelle, ni les dormeurs de la Taverne (sauf si un loup dort parmi eux), ni l'autre rive quand le Pont est bloqué. La Table de jeu et le MJ IA proposent d'eux-mêmes les bons candidats.

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
4. **Attaques** : victime de la meute, seconde victime du Loup affamé.
5. **Remède et poison** de l'Herboriste.
6. **Feu** : si le Pyromane a embrasé, toutes les maisons aspergées brûlent (protégées ou non).
7. **Lanterne** : un loup entré dans la maison éclairée est démasqué.
8. **Cascades** : amant mort de chagrin, Braconnière qui emporte quelqu'un (elle choisit au matin).
9. **Informations** : Liseuse, Sourcier, Loup flaireur, Ermite, Fossoyeur, mot du Messager (en secret) ; lame de la Forge (« du sang de bête sur le seuil »), Moulin, Lavoir, Cimetière (annoncés au village).
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
- Ce que disent les métiers d'information (Meunière, Chasseresse, Tanneur, Colporteur de nouvelles) est calculé par le système sur la vraie nuit : tu n'as rien à inventer.

# Le vote

- Ouvre le vote avec les vivants comme candidats, une minute par défaut. Les voix restent secrètes jusqu'au dépouillement.
- Annonce le décompte, puis l'exécuté. Avec le **Sonneur**, chaque voix compte double. Avec le **Gibet**, il faut plus de la moitié des vivants.
- Le **ruban de la Tisserande** : si le plus désigné le porte, la clôture ne dépouille pas ; il a une minute de défense de plus, puis clos de nouveau.
- Le **Juge de paix** peut annuler le vote juste après le décompte, avant l'exécution (depuis sa Table de jeu) : il se révèle, le vote se rouvre, revote immédiat, sans débat. Demande toujours « quelqu'un s'y oppose-t-il ? » avant d'exécuter, et n'exécute que le résultat du dernier vote.
- Avec la **Chapelle**, ouvre ensuite le vote de la Chapelle (bouton de la Table de jeu) : l'élu y dort à l'abri la nuit suivante.

# Les égalités

- Première égalité : les ex æquo ont **trente secondes** chacun, puis revote **entre eux seulement**.
- Seconde égalité : **personne n'est exécuté** ; la nuit tombe.
- Un joueur seul en tête mais sans majorité (Gibet) : personne n'est exécuté.
- Le **Loup déguisé** en tête d'un vote sans être exécuté perd son masque : note-le.

# Victoires à vérifier après chaque mort

- Plus aucun loup : victoire du **Village**.
- Loups aussi nombreux que les autres vivants : victoire de la **Meute**.
- **Revenant** exécuté, cible du **Chasseur de primes** exécutée : victoire immédiate du solitaire (la partie continue pour les autres si tu le souhaites, ou s'arrête : annonce-le au début).
- **Amants** derniers vivants : ils gagnent ensemble.
- **Pyromane** dernier vivant (ou avec un seul non-loup) : il gagne seul.`
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
- Ne cite jamais le nombre de loups vivants, sauf effet public (Meunière, Moulin).

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
- **Pyromane attaqué par la meute** : rien ne se passe, la meute repart bredouille ; ne dis rien au matin.
- **Taverne et Loup** : si un loup y dort, la meute peut y tuer qui elle veut, sans protection possible.

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
- **Ambiance** : gothique sérieux (par défaut) ou comique.`
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
- Au moins **un rôle d'information** (Liseuse de cendres, Sourcier, Veilleuse de lanterne) et **un rôle de protection** (Garde du pont, Gardienne des clés, Herboriste) pour le village.
- **Un solitaire** à partir de dix joueurs ; deux à partir de quinze. Le Pyromane est le plus difficile à arrêter : ne l'ajoutez qu'avec une Liseuse ou un Sourcier.
- Gardez **au moins un quart de villageois sans pouvoir** : ce sont eux qui font les votes honnêtes.
- **4 bâtiments** pour une partie simple, **6** pour une partie riche ; évitez le Gibet à moins de huit joueurs, il bloque trop de votes.`
    }
  ]
});

export const GUIDES = [guideJoueur, guideNarrateur, variantes];
