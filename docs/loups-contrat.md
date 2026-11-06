# Contrat commun — « Les Veillées de Brumecombe »

Trois pièces écrites en parallèle doivent s'emboîter : le **système** `lakour-loups` (dossier `systems/lakour-loups/`),
le **module de contenu** `lakour-veillees` (dossier `modules/lakour-veillees/`) et le **MJ IA** (`modules/lakour-mj-ia/`).
Ce fichier est la seule source de vérité de leurs échanges. Plan général et intentions : `docs/plan-loup-garou.md`.
Foundry v14 (14.369). Tout en français, textes originaux (aucun texte, aucune carte de *Thiercelieux*).

## 1. Système `lakour-loups`

`systems/lakour-loups/system.json` : `id: "lakour-loups"`, `version: "0.11.0"`, `compatibility { minimum: "14", verified: "14.370" }`,
`socket: true`, `esmodules: ["lakour-loups.mjs"]`, langues fr et en, `documentTypes` ci-dessous,
`grid { type: 1, distance: 1.5, units: "m" }`, `primaryTokenAttribute: null`.

### Données (TypeDataModel, `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`)

**Actor `villageois`** (un par joueur ; aussi des villageois non joués pour remplir le village si besoin)
```
system: {
  joueur: String,            // id de l'utilisateur Foundry qui l'incarne ("" = personne)
  compagnon: Boolean = false, // tenu par un compagnon IA (joueur "" ; ses choix passent par api.resolveurs.compagnon)
  vivant: Boolean = true,
  revele: Boolean = false,   // rôle montré à tous (mort révélée, ou pouvoir qui révèle)
  camp: String = "",         // camp PUBLIC : "" tant que le rôle est caché ; le camp actuel une fois révélé (0.9.0)
  maison: String = "",       // repère de la carte où il dort (« Maison 3 », « Taverne »…)
  amoureux: String = "",     // publié à la fin de la partie seulement (0.9.0 ; avant : fiche secrète)
  silence: Boolean = false,  // ne peut pas parler au prochain débat
  protections: Number = 0,   // inutilisé depuis 0.9.0 (fiche secrète) : toujours 0
  notes: HTML                // notes publiques (métier, ce qu'il a dit)
}
```
Depuis 0.9.0, le document ne porte que le PUBLIC. Ce qui est secret d'un villageois vit dans sa **fiche secrète**, dans les secrets du
MJ actif (`etat.fiches`, `logique/fiches.mjs`) : `{ camp ("village" | "meute" | "solitaire", camp ACTUEL : morsure, échange), amoureux,
protections (de la nuit, remises à 0 au jour), role: { name, img, source, system: <le system d'un Item role> } }`. Son rôle n'entre au
document (objet `role`, un seul, et `system.camp`) qu'à sa **révélation publique** : mort révélée, Juge de paix, case « Révélé » du MJ,
fin de partie (tous les rôles, camps et liens d'amour). Révélé de son vivant, il montre le camp de son RÔLE (la lanterne : « meute »),
jamais son camp actuel : une morsure ou un échange restent secrets, rien n'est récrit au document, et un rôle déjà publié n'est pas
remplacé (rôle échangé ou donné ensuite) ; à sa mort révélée et à la fin, son vrai rôle et son vrai camp. Son métier reste l'objet `metier` (un seul, public). Le joueur est
**observateur** (OBSERVER) de son villageois, plus propriétaire : il voit sa fiche, il ne la modifie pas.

**Item `role`**
```
system: {
  cle: String,                  // identifiant stable du rôle (« veilleuse-de-lanterne »)
  camp: String = "village",     // camp de départ : "village" | "meute" | "solitaire"
  description: HTML,            // texte joueur : le pouvoir, en clair
  victoire: HTML,               // condition de victoire si solitaire ("" sinon)
  nuit: {
    actif: Boolean = false,     // agit-il la nuit ?
    ordre: Number = 50,         // ordre de réveil (petit = tôt) ; la meute agit à 40
    premiereNuitSeulement: Boolean = false,
    uneNuitSurDeux: Boolean = false,
    tantQueMeuteEntiere: Boolean = false, // chaque nuit tant qu'aucun mort n'était de la meute (le Loup affamé, Pacte étape 2)
    nuitsImpaires: Boolean = false, // la première nuit, puis une nuit sur deux : 1, 3, 5… (Lavandières, Bûcherons, Pacte étape 3a)
    cibles: Number = 1,         // nombre de joueurs à désigner (0 = action sans cible)
    soiMeme: Boolean = false,   // peut se désigner lui-même
    invite: String = ""         // question posée au joueur (« Quelle maison éclairer cette nuit ? »)
  },
  usages: { max: Number = 0, restant: Number = 0 },   // 0 = illimité
  effet: String = ""            // clé d'effet automatisable (voir §4), "" = arbitré par le narrateur
}
```

**Item `metier`** : `{ cle, description: HTML, jour: { actif: Boolean, invite: String, cibles: Number }, usages: { max, restant }, effet: String }`.
Le pouvoir de jour d'un métier est désigné par sa **clé** (voir §5) ; `effet` reste indicatif.

**Item `batiment`** : `{ cle, description: HTML, regle: HTML, repere: String (nom de l'élément de la carte), effet: String }`.

### État d'une partie : public et secrets

Ce que Foundry v14 livre à chaque navigateur (vérifié dans le code serveur, `server/dist/packages/world.mjs` et
`database/backend/server-backend.mjs`) : **tous** les réglages du monde, **tous** les documents (acteurs, objets, messages de chat,
chuchotements compris) et chaque modification. Rien de secret ne peut donc y être rangé en clair. L'état COMPLET d'une partie
n'existe que chez le MJ actif ; il se range en deux morceaux (`logique/etat.mjs`, `separerEtat` / `fusionnerEtat`) :

- réglage monde **`lakour-loups.partie`** (Object), écrit seulement par le MJ actif (`game.users.activeGM`) : l'état **public** ;
- réglage **`lakour-loups.secrets`**, de portée **`client`** (localStorage du navigateur du MJ, jamais envoyé au serveur), rangé par
  **[monde][userId]** et lu seulement par un MJ, pour lui-même (0.9.0), et mémoire du MJ actif : les **secrets**. Un rechargement du MJ
  les retrouve ; un autre navigateur ou un autre MJ les reprend du **coffre** (ci-dessous) ; sans lui, la Table de jeu le signale et la
  partie continue sans eux ;
- réglage monde **`lakour-loups.coffre`** : les secrets SCELLÉS avec la clé du coffre du MJ IA (`{ partie, chiffre: 1, id, iv,
  donnees }`, AES-GCM 256, bourrage par blocs de 4 Kio ; §6 « Le coffre »). Écrit seulement aux moments publics et au battement :
  jamais au rythme des choix de nuit. Le réglage monde `partie` n'est récrit que s'il change (un choix de nuit ne le touche pas).

```
{
  partie: String,                  // identifiant de la partie (les secrets d'une autre partie sont ignorés)
  phase: "preparation" | "nuit" | "aube" | "jour" | "vote" | "fin",
  tour: Number,                    // n° de la nuit / du jour (1 = première nuit)
  composition: String,             // SECRET : clé de composition utilisée ("" dans l'état public : la composition n'est jamais annoncée)
  peste: null | { active, porteur, victimes, decouverte, crieur },   // SECRET : la variante Peste noire (§1 « Peste noire ») ;
                                   //   absente de l'état public (pas même la clé) jusqu'à la phase "fin", où la partie se dévoile
  batiments: [String],             // uuid des bâtiments en jeu
  batimentsCles: [String],         // leurs clés (« chapelle », « pont »…)
  vote: { ouvert, numero, objet: "execution" | "chapelle" | "bailli", candidats: [acteurId],
          votes: { acteurIdVotant: acteurIdCible },   // SECRET jusqu'à la clôture
          exprimes: [acteurId],                        // public : QUI a voté, pas pour qui
          double, finit (horodatage ms, 0 = sans minuteur), duree, majoriteAbsolue,
          prolonge: acteurId (ruban de la Tisserande), resultat: { decompte, elu, elus, votes, egalite, objet, numero, tour } (public) },
  nuit: { actions: [ { acteurId, roleCle, cibles: [acteurId], quand, effet?, texte? } ] },   // SECRET
  nuitPrecedente: { actions, bilan: { sorties, visites, victime, loup, sauves, attaques } },  // SECRET
  asperges, primes, fioles,        // SECRETS
  morts: [ { acteurId, tour, phase, cause } ],   // cause publique : "nuit" pour meute / poison / feu / épié / peste (vraie cause SECRÈTE) ;
                                                 // "panique" : pendu pour un cri de peste à tort
  vainqueur: "" | "village" | "meute" | "peste" | <acteurId d'un solitaire> ,
  historique: [ { tour, phase, texte } ],        // public (ce qui a été annoncé)
  journalSecret: [ { tour, phase, texte } ],     // SECRET : chronique du MJ (actions de nuit, messages secrets envoyés)
  carnets: { acteurId: [ { id, texte | html, titre, tour, phase, quand } ] },   // SECRET : carnet secret de chaque joueur
  jour: { effets: [ { type, acteurId, cible, nuit } ], benis: [acteurId], rubans: [acteurId], puits, conteuse, appel },   // public
  pont: { bloqueNuit: Number },  // SECRET (0.9.0) : la meute bloquée sur l'autre rive trahirait la vraie cause d'une mort de nuit
  voteDoubleDemain: Boolean,     // SECRET (0.9.0) : la cloche du Sonneur ; publique quand le vote s'ouvre (vote.double)
  fiches: { acteurId: { camp, amoureux, protections, role } },   // SECRET (0.9.0) : tout ce qui est secret d'un villageois
  cimetiere: [acteurId],         // public
  bailli: { actif, acteurId, depuis, succession: null | { de, tour }, election },   // public (0.6.0, §1 « Bailli, Registre, Masques »)
  registre: [ { type, tour, phase, quand, … } ],        // public : le Registre du greffier
  masques: [cle de rôle],                                // SECRET : les Masques de veillée de la meute
  fete: { cle, neige, defile, defileNom },               // public (0.10.0) : la veillée de fête en jeu ("" : aucune), le dernier matin
                                                         //   de neige (n° du tour), le masque du défilé (clé et nom d'un rôle absent)
  secretsDeFete: { masque, masqueTombe, present, presentOuvert, promis },  // SECRET (0.10.0) : qui porte le masque du Carnaval (tombé ?), qui a reçu le présent
                                                         //   d'hiver (et s'il s'est ouvert), qui sont les promis
  petiteTablee: Boolean,          // public (0.11.0) : la Petite tablée (§1 « Petite tablée ») — une règle de la veillée, jamais un secret
  places: Number,                 // public (0.11.0) : les places distribuées (humains + compagnons), annoncées
  cercle: [acteurId],             // public (socle du Pacte) : l'ordre des places autour de la table (logique/cercle.mjs)
  tenures: { cle: acteurId|null },// public (socle du Pacte) : les bâtiments tenus par un joueur, null = vacant (logique/tenures.mjs)
  evenements: [ { cle, tire, debut, fin, type, quand } ],  // public (socle du Pacte) : les événements (logique/evenements.mjs)
  pacte: { innocentSuit, sagessePerdue, gracies, egalite, votants, plume, secondVote },   // public (Pacte, étape 3a ; logique/pacte.mjs)
  pacteSecret: { aieux, furets, contamines, signal },      // SECRET (Pacte, étape 3a) : vies perdues, flair perdu, loups contaminés, signe du Greffier
  ambigus: { bateleur, retirees, commenceParLeJour, groupes, devouements },   // public (Pacte, étape 3b ; logique/ambigus.mjs)
  ambigusSecret: { centre, chapardes, emprunts, modeles, matins, charmes }    // SECRET (Pacte, étape 3b) : centre du Chapardeur, carte jouée
                                                                              //   par le Bateleur, modèles, choix des Mâtins, charmés
}
```
`etat()` rend l'état complet chez le MJ actif, l'état public partout ailleurs.

### Socket « system.lakour-loups » : toujours des destinataires

Le serveur v14 (`server/dist/server/sockets.mjs`, `handleCustomSocket`) livre `game.socket.emit(canal, message, { recipients: [userIds] })`
aux seuls navigateurs de ces utilisateurs (sans `recipients` : à tous les autres) et ajoute l'identifiant de l'émetteur, tiré de la
session, en second argument du récepteur. Le système s'en sert ainsi :
- MJ → un joueur (`recipients: [son userId]`) : `demande` (choix de nuit, ou `mode: "texte"` pour le mot du Messager), `annuler`,
  `secret` (une entrée de son carnet), `carnet` (tout son carnet, sa prime, son vote en cours), `monVote` (accusé), `avis` (refus),
  `salon` (sa ligne des salons vocaux, §1 « Salons vocaux ») ; 0.9.0 : `fiche` (`{ partie, acteurId, fiche: { camp, amoureux, role } }`,
  SA fiche, à chaque changement qui le regarde : rôle, usages restants, camp, lien d'amour — jamais ses protections), `vus` (mort qui
  voit tout : `{ acteurId: { camp, role: { name, img, system: { cle, camp } } } }` des autres, `{}` sinon), `parole` (un mot relayé :
  canal des morts, ou au MJ ; affiché localement) — ces trois-là n'étant acceptés que du MJ ACTIF ;
- joueur → MJ actif seul : `reponse`, `vote`, `jour` (pouvoir de jour), `bonjour` (« renvoie-moi mon carnet, ma fiche, ma vue », et ma
  ligne des salons), `peste` (`{ acteurId }` : « C'est la peste noire ! », pour son propre villageois seulement), `paroleEnvoi`
  (`{ texte, canal: "morts" | "mj" }`, le relais de parole : seulement avec l'émetteur donné par le serveur) ;
- les parts de la clé du coffre passent par le canal du MJ IA (`module.lakour-mj-ia`, `coffre.*`), plus par celui-ci ;
- MJ → tous : `hook`, avec des arguments publics seulement ;
- l'émetteur donné par le serveur fait foi : un message dont `userId` le contredit est rejeté ; ce qui s'adresse à un joueur
  n'est accepté que d'un MJ.

Le **carnet secret** remplace le chuchotement pour tout ce qui est secret (carte de rôle, ce qu'un rôle apprend la nuit, mot du
Messager, Moulin pour la Meunière) : le MJ le garde dans ses secrets, le joueur le range dans son navigateur (réglage client
`lakour-loups.carnet`, rangé par [monde][userId] depuis 0.9.0, avec sa fiche et sa vue de mort) et peut le relire (Table de jeu,
bouton « Carnet secret »).

### API : `game.lakourLoups` (prête au `ready`)

Toutes les fonctions qui écrivent ne marchent que chez le MJ actif ; ailleurs elles lèvent une erreur claire.
```
etat()                                   -> copie de l'état (ci-dessus)
villageois()                             -> acteurs villageois (vivants et morts), avec .role (le rôle que CE navigateur connaît :
                                            api.roleDe) et .metier (objet possédé)
distribuer({ roles: [uuid], metiers: [uuid], joueurs: [userId], compagnons: [nom], maisons: [String] })
                                         -> crée/recycle un villageois par joueur, lui donne un rôle et un métier au hasard
                                            (mélange), règle camp et maison, phase "preparation", tour 0 ; renvoie
                                            [{acteurId, userId, compagnon, roleCle}]. compagnons : un villageois sans joueur
                                            (system.compagnon) par nom, tiré comme les joueurs ; les compagnons d'une partie
                                            précédente sont repris, les autres retirés du village.
                                            Rôle et camp dans les fiches secrètes du MJ (jamais sur le document) ; chaque joueur
                                            reçoit sa fiche et sa carte de rôle (carnet secret) par le socket, personne d'autre, et
                                            observe son villageois (OBSERVER). Sans le coffre du MJ IA : erreur claire, rien n'est
                                            créé (LAKOUR_LOUPS.Erreurs.SansCoffre). Maisons par défaut : maisonsDuVillage(n) (un tiers sur l'autre rive, 13 à 18).
                                            peste: true -> partie de peste noire (rôles de la meute remplacés par un simple
                                            villageois, drapeau secret etat.peste). composition : clé gardée dans les secrets du MJ.
changerPhase(phase)                      -> écrit la phase (tour + 1 quand on passe à "nuit"), remet protections/silence selon la phase,
                                            appelle Hooks.callAll("lakourLoups.phase", phase, etat)
ordreDeNuit()                            -> [{ roleCle, acteurIds }] : rôles vivants à réveiller cette nuit, dans l'ordre (meute groupée)
demanderAction({ acteurId, invite, candidats: [acteurId], nombre, delai })
                                         -> Promise<[acteurId]> : ouvre chez le joueur de cet acteur une fenêtre de choix
                                            (socket "system.lakour-loups") ; résout avec son choix, [] s'il passe ou au délai (ms).
                                            Pour la meute : demanderActionMeute({ invite, candidats, delai }) -> vote des loups vivants,
                                            résolu à la majorité (égalité : premier choisi).
                                            Seuls chassent les loups libres (ni gardés à l'œil, ni hors d'atteinte).
candidatsDeNuit({ acteurId, roleCle })    -> [acteurId] que ce rôle (ou "meute") peut désigner cette nuit, effets du jour compris ;
                                            sans la cible de la nuit d'avant pour « proteger » et « silence » (Garde du pont,
                                            Gardienne des clés, Loup hurleur) ; sans la proie de la meute de cette nuit pour un loup
                                            qui tue seul (Loup affamé)
proiesDeLaNuit()                          -> { proies, mordus, aSauver } (MJ actif, SECRET) : les proies notées jusqu'ici (la proie
                                            de la meute, ou l'Enfant de la brume surprise à sa place ; les victimes du Loup affamé ;
                                            la peste), les mordus de la Louve mère ; aSauver : ce que l'Herboriste apprend
demanderTexte({ acteurId, invite, delai, max }) -> Promise<String> : une phrase écrite chez ce seul joueur ("" s'il passe)
noterAction({ acteurId, roleCle, cibles, effet?, texte? })  -> ajoute à etat.nuit.actions (texte : le mot du Messager) ; l'Enfant
                                            de la brume qui épie : surprise tirée aussitôt (réglage chanceEpier, RISQUE_ENFANT = 1/2),
                                            action.surprise ; l'Herboriste : un usage par cible (deux fioles la même nuit)
resoudreNuit({ chuchoter })               -> { morts, revelations, messages: [{acteurId, texte}], narration, annonces, bilan, … } ;
                                            annonces : textes publics déjà postés au chat ; chuchoter: true -> le système remet
                                            lui-même les messages au carnet secret
ouvrirVote({ candidats, duree, double, objet })  -> vote : chaque joueur vivant voit une fenêtre de vote (et la Table de jeu) ;
                                            voix secrètes jusqu'à la clôture ; objet "chapelle" : asile de la Chapelle ;
                                            avec une durée, le MJ actif le clôt de lui-même à zéro (scripts/fin-du-vote.mjs)
cloreVote()                               -> { decompte: {acteurId: voix}, elu: acteurId|null (égalité = null), elus, votes, objet, numero }
                                            ou { prolonge: acteurId } (ruban de la Tisserande : le vote reste ouvert une minute) ;
                                            un vote "chapelle" met l'élu à l'abri d'office ; sans vote ouvert : erreur (pas de recompte)
pouvoirsDeJour(acteurId)                  -> [{ pouvoir, nom, source, cibles, texte, possible, raison, raisonTexte, candidats: [{id, nom}] }]
                                            ("" : ceux du village, la Chapelle)
agirDeJour({ acteurId, pouvoir, cibles, texte }) -> { pouvoir, annonces } ; erreur claire si impossible (moment, cibles, usage)
envoyerSecret(acteurId, texte)            -> remet un message au carnet secret de ce seul joueur ; carnet(acteurId) -> ses entrées
eliminer(acteurId, { cause, reveler })    -> vivant=false, ajoute aux morts, révèle le rôle si reveler (réglage par défaut :
                                            réglage monde "lakour-loups.revelerALaMort", true) ; tue l'amoureux lié en cascade
proteger(acteurId) / reduireAuSilence(acteurId) / changerCamp(acteurId, camp) / echangerRoles(a, b)
verifierVictoire()                        -> "village" | "meute" | acteurId (solitaire) | "" ; écrit vainqueur et phase "fin" si gagné
                                            ; à la victoire : récit de fin au chat, et la veillée entre aux Chroniques de
                                            Brumecombe (journal lisible par tous, palmarès ; réglage "chroniques", scripts/chroniques.mjs)
ouvrirTable()                             -> ouvre la Table de jeu (fenêtre ApplicationV2) chez soi
```
resolveurs.compagnon                     -> fonction fournie par le MJ IA : (demande) -> [acteurId] (choix de nuit, vote) ou
                                            texte (mode "texte"). demande : { type: "demande" | "vote", mode?, id, acteurId,
                                            acteurNom, invite, candidats: [{ id, nom, img, maison }], nombre, max?, delai, objet?,
                                            numero? }. Voir « Compagnons IA » ci-dessous.
Hooks (tous les navigateurs, arguments publics) : `lakourLoups.phase`, `lakourLoups.vote` (vote reçu : `{ votant }` seulement,
jamais le choix), `lakourLoups.voteClos` (résultat public), `lakourLoups.aube` (`{ tour, morts, annonces }`), `lakourLoups.jour`
(pouvoir de jour appliqué ; sans l'acteur pour la Conteuse), `lakourLoups.elimination` (cause publique), `lakourLoups.victoire`,
`lakourLoups.cri` (`{ acteurId, juste }`, après le verdict d'un cri de peste).
Chez le MJ seulement : `lakourLoups.action` (action reçue), `lakourLoups.secret` (message secret envoyé). Chez un joueur :
`lakourLoups.prive` (son carnet, sa prime ou son vote a changé).

Ajouts 0.3.0 (MJ actif, sauf mention) :
```
nouvellePartie({ memesJoueurs = true, joueurs, compagnons, composition, roles, niveau, graine, peste })
    -> { partie, joueurs: [{ userId, nom, acteurId }], compagnons: [{ nom, acteurId }],
         composition: { cle, libelle, niveau, roles: [cle], batiments: [cle], somme?, verdict?, peste } }
    Remet tout à zéro (état public et secrets, vivants, non révélés, sans silence, rôles et métiers retirés) et redistribue avec
    les MÊMES participants : mêmes humains (memesJoueurs ; sinon `joueurs` [userId] ou les connectés), mêmes villageois
    compagnons (mêmes noms ; `compagnons` [acteurId] pour en choisir). Composition : `roles` (clés ou noms) si donnés, sinon la
    composition prête `composition`, sinon équilibrée (`composer`, niveau, historique pour varier), à défaut les rôles
    précédents rebattus. Plateau remis (jetons neutres devant les maisons, statuts retirés, scène active, lumière de jour).
    Hook lakourLoups.nouvellePartie : chez le MJ ce résumé ; chez tous { partie, joueurs: n, compagnons: n } (JAMAIS la composition).
    peste : true (choisie : rôles de la meute retirés), false (jamais) ; non précisé, une composition GÉNÉRÉE devient une peste
    noire avec la chance du réglage caché « chancePeste » (CHANCE_PESTE = 1/30 ; tirage à part, reproductible avec la graine).
reveiller(roleCle, { delai, cible })  -> réveille un rôle de la nuit (ou "meute", ou "peste") comme loups_nuit : candidats, demande,
                                  mot du Messager, noterAction ; reveilsEnCours() -> [roleCle] ; hook lakourLoups.reveil (MJ).
                                  "peste" : le porteur (mort) choisit par une demande posthume ; sans porteur, cible (acteurId choisi
                                  par le narrateur) ; à défaut ou sans réponse au délai, le hasard -> { roleCle, cibles, hasard }
crierPeste(acteurId)           -> { juste, annonces, vainqueur } : le cri « C'est la peste noire ! » (erreur claire s'il n'est pas
                                  permis) ; peutCrier(acteurId) -> { ok, raison, raisonTexte } (tous, d'après l'état public) ;
                                  chancePeste() -> la chance du réglage caché
remettreAZero()                -> le village vierge (lancement du monde) : partie, secrets et chat effacés, rôles et métiers retirés ;
                                  les compagnons IA quittent le village (api.compagnons.retirer, puis acteur et jetons supprimés) ;
                                  chacun retrouve le jeton de base (imageNeutre, au style plat/relief, prototype et jetons posés,
                                  sans crâne ni silence) ; les villageois des joueurs humains restent. Chroniques et historique gardés.
etapeSuivante({ ignorer })     -> { cle, action, donnees, attente, detail } (logique/etapes.mjs, pour le MJ humain)
contenu()                      -> { roles: [{ cle, nom, camp, poids }], niveaux, equilibre, compositions } (tous)
compagnons                     -> point d'enregistrement déposé par le MJ IA : { disponible, async creer(n) -> [acteurId],
                                  async retirer(acteurId) } ; null sans lui ; hook lakourLoups.compagnons quand il change
plateau.{ mettreEnScene, planifier, attendre, configurer({ jetonNeutre, styliser }), reglerDelais, scene, voulu }
```
`distribuer({ compagnons })` accepte aussi l'id d'un villageois compagnon déjà créé (il garde son nom). `demanderAction` et
`demanderTexte` ne réveillent plus un mort (joueur ou compagnon) : ils rendent `[]` / `""`.

Ajouts 0.4.0 — salons vocaux (voir aussi `lakour-mj-ia/docs/voix-et-ecoute.md` §3) :
```
audibilite(userId)          -> { peutParler: Boolean, auditeurs: [userId], acteursAuditeurs: [acteurId] (chez le MJ actif seulement) }
audibiliteActeur(acteurId)  -> { peutParler: Boolean, auditeurs: [userId], acteursAuditeurs: [acteurId] }   (compagnons IA)
```
Calcul complet chez le MJ actif (camps compris) ; chez un autre navigateur, réponse prudente d'après ce qu'il sait (sa propre
ligne pour lui-même ; pour un autre, aucun camp connu, sauf la meute pour un loup). `auditeurs` ne contient jamais le locuteur ;
`acteursAuditeurs` : les villageois qui entendent (compagnons compris, joueurs humains aussi), hors le locuteur.
Hook `lakourLoups.audibilite` (`{ phase }`, rien d'autre) à chaque changement de la matrice : chez tous pour ce qui est public
(phase, aube, victoire, mort, silence, distribution, nouvelle partie, réglage), chez le MJ actif seul pour ce qui ne l'est pas
(un villageois mordu qui rejoint la meute). Chez le joueur : `lakourLoups.salon` (local) quand sa ligne change.

Ajouts 0.6.0 — le Bailli, le Registre du greffier, les Masques de veillée (§1 « Bailli, Registre, Masques ») :
```
ouvrirVote({ objet: "bailli" })   -> l'élection du Bailli, au débat SANS changer de phase (tous les vivants candidats, ni Gibet, ni cloche,
                                    ni ruban) ; erreur claire si elle n'est pas due (Bailli hors jeu, Bailli vivant, succession en cours,
                                    vote ouvert, déjà une élection ce jour, vote d'exécution déjà fait, fin)
ouvrirVote(…), changerPhase(…)    -> erreur claire (Bailli.Refus.departage) tant qu'une égalité attend le départage du Bailli
cloreVote()                       -> + poids ({ bailli: 2 } à un vote d'exécution), departage: null | { par, candidats, places, choix,
                                    auto? } : si le Bailli a voté pour l'un des ex aequo, sa voix tranche d'office (auto, annoncé
                                    Bailli.TrancheVoix ; une place encore libre d'un vote double attend son choix) ;
                                    le Loup déguisé le plus désigné sans être condamné perd son masque (masquesQuiTombent) ;
                                    vote "bailli" -> + bailli: acteurId | "", sort: Boolean (égalité : le sort)
bailli()                          -> { actif, acteurId, nom, depuis, succession: null | { de, nom, tour }, election: { ok, raison },
                                       possible: { ok, raison, raisonTexte } }   (tous, d'après l'état public)
nommerBailli(acteurId)            -> le narrateur remet le sceau à un vivant (correction, ou choix dicté à voix haute) ; ferme la demande
                                    posthume encore ouverte
trancher([acteurId])              -> le narrateur tranche à la place du Bailli ([] : personne) ; ferme sa demande ; -> le résultat final ;
                                    erreur claire sans égalité en attente
reprendre()                       -> au « ready » du MJ actif (lakour-loups.mjs) : relance le départage en attente et la succession (le reste
                                    du délai des choix compté depuis sa mort, sinon vacance) -> { departage, succession }
registre({ max, depuis })         -> [{ type: "vote" | "mort" | "bailli" | "declaration", tour, phase, quand, …, ligne }] (tous)
registreTexte({ max = 30, depuis }) -> [ligne] : le Registre lisible, pour le contexte du narrateur et des compagnons IA
declarer(acteurId, texte)         -> inscrit la déclaration d'un vivant (MJ actif) ; peutDeclarer(acteurId) -> { ok, raison, raisonTexte }
masques()                         -> [{ cle, nom }] : les Masques de veillée de la meute (MJ actif seulement ; SECRET)
```
Socket : joueur -> MJ actif `{ type: "declaration", acteurId, texte }` (pour son propre villageois). Hooks publics :
`lakourLoups.voteOuvert` (`{ objet, numero }`, à chaque vote ouvert ou rouvert ; l'élection du Bailli n'émet pas `lakourLoups.phase`),
`lakourLoups.bailli` (`{ acteurId, comment: "election" | "sort" | "succession" | "nomme" | "vacance", de? }`), `lakourLoups.registre`
(l'entrée inscrite). Demandes `type: "demande"` nouvelles, au seul Bailli (compagnon : `api.resolveurs.compagnon`) : `objet: "departage"`
(`nombre` = places libres, candidats = ex aequo, il peut se désigner) et `objet: "succession"` (`posthume: true`, candidats = les vivants).
Réglages monde : `bailli` et `masques` (vrais par défaut).

Ajouts 0.7.0 — Dernier souffle, Almanach des brumes, Somnambule, Rosière, Saints du calendrier (§1 « Lot 0.7.0 ») :
```
distribuer({ …, glas }) / nouvellePartie({ …, glas })   -> le Glas final (jour N, 0 : jamais ; public, annoncé au chat)
peutSouffler(acteurId)            -> { ok, aSonSouffle } (tous) : ce mort peut-il voter maintenant, de son Dernier souffle ?
presage()                         -> { actif, cle, tour, nom, effet } (tous) : le présage du jour (ou de la nuit qui vient)
resoudreNuit()                    -> + presage : la clé tirée à cette aube ("" sans Almanach)
somnambules()                     -> [{ acteurId, nom, croit, croitNom, devoile }] (MJ actif ; SECRET)
bonneEtoile(acteurId | "")        -> le narrateur protège en secret ce villageois la PREMIÈRE nuit (erreur claire après sa résolution)
glasFinal(n)                      -> pose (ou lève, 0) le Glas final en cours de partie ; annoncé au chat
verifierVictoire({ finDuJour })   -> finDuJour (optionnel) : le Glas sonne dès le jour N, même sans vote (changerPhase("nuit") l'utilise)
reveiller(roleCle)                -> deux porteurs d'un même rôle hors meute (un Somnambule qui rêve un rôle déjà en jeu) : chacun est réveillé
```
Votes : un mort qui a encore son souffle est admis (socket `vote`, compagnon : demande `type: "vote"` avec `souffle: true`) aux votes
d'exécution seulement ; `resultat.souffles` (consommés) ; Registre « dernier souffle ». Hook public `lakourLoups.presage` (`{ cle, tour }`).
Réglages monde : `dernierSouffle` (vrai par défaut), `almanach` (faux par défaut). Rôles « sur demande » (`equilibre.surDemande`) :
jamais tirés par le générateur.

Ajouts 0.8.0 — Gens de passage, départ et exil, Banc des accusés, Glas du deuil, Nuit de la Saint-Martin (§1 « Lot 0.8.0 ») :
```
accueillir({ userId | acteurId | nom, cle? }) -> { acteurId, nom, cle } (MJ actif) : un gens de passage entre (aube ou débat, hors vote)
peutAccueillir()                  -> { ok, raison, raisonTexte } (tous)
gensDePassage()                   -> [{ acteurId, nom, cle, role, tour, parti }] (tous : rôle PUBLIC, jamais le camp)
partir(acteurId, { comment })     -> true (MJ actif) : "depart" (le joueur s'en va) ou "exil" (vote) ; ni mort ni révélation
ouvrirVote({ objet: "exil" })     -> le vote d'exil : candidats = les gens de passage encore là ; l'élu part (partir, "exil")
accuser(par, contre)              -> { par, contre } (MJ actif) : une accusation au Banc des accusés
peutAccuser(acteurId, contre?)    -> { ok, raison, raisonTexte } (tous) ; banc() -> { actif, accusations, prochain, prochainNom } (tous)
ouvrirVote()                      -> avec le Banc : juge le prochain accusé (vote.banc = { accuse }, un candidat) ; erreur sans accusé
deuil()                           -> { actif, compte } (tous) ; pouvoirsDuDeuil() -> { visions, voix, linceul } (MJ actif ; SECRET)
reveiller("deuil")                -> la vision du Glas du deuil : la meute désigne un joueur (demande comme la meute)
nouvellePartie({ format: "saint-martin" }) / distribuer({ format, autel }) -> la Nuit de la Saint-Martin ; résumé du MJ + composition.autel
nouvellePartie({ format })        -> format non précisé : celui de la partie précédente ("" : ordinaire) ; les partis ne sont pas repris
partir(acteurId)                  -> false si déjà parti ; seul candidat du vote ouvert : le vote se clôt sans élu (resultat.depart, hook voteClos)
autel()                           -> [{ cle, nom }] (MJ actif ; SECRET) : les rôles sous l'autel
```
Socket joueur -> MJ actif : `{ type: "accusation", acteurId, contre, userId }` et `{ type: "depart", acteurId, userId }` (pour soi).
Hooks publics : `lakourLoups.passage` (`{ acteurId, cle, comment: "arrivee" }`), `lakourLoups.depart` (`{ acteurId, comment }`),
`lakourLoups.accusation` (`{ par, contre }`), `lakourLoups.deuil` (`{ compte }`). Demande `type: "vote"` d'un compagnon : `+ banc`
(l'accusé : voter pour lui le condamne, rien l'acquitte) ; `demanderAction({ objet })` : demandes de meute `objet: "deuil-vision"` (la nuit) et
`"deuil-voix"` (à l'ouverture d'un vote d'exécution, après le 2e glas : le candidat que la voix sans visage rejoindra). `resultat` : `+ banc ({ accuse, pour, total })`, `+ deuil` (le candidat de la voix
sans visage). Vainqueur `"brume"` (Saint-Martin : personne). Réglages monde : `gensDePassage` (vrai), `banc` et `glasDuDeuil` (faux).
Étapes du MJ humain : `juger` (action `ouvrirVote`), détail `bancVide` ; l'étape `reveiller` du deuil porte `donnees.deuil`.

Ajouts 0.9.0 — les secrets hors des documents (§6) :
```
roleDe(acteur | id)               -> le rôle que CE navigateur connaît (forme d'objet : name, img, system ; null sinon) : chez le MJ actif,
                                     celui de sa fiche secrète (jamais celui d'un document) ; ailleurs, le sien, ceux qu'un mort voit, ou
                                     un rôle révélé. Le MJ IA lit les rôles par ici (utilitaires.js, roleLoups).
campDe(acteur | id)               -> son camp de même ("" : inconnu de ce navigateur) (MJ IA : campLoups)
fiche(acteurId)                   -> { camp, amoureux, protections, role } | null (MJ actif)
reglerFiche(acteurId, { camp, amoureux, protections })   -> la fiche (MJ actif ; la fiche du villageois du MJ s'en sert)
donnerRole(acteurId, uuid | donnéesDObjet | null)        -> la fiche (MJ actif) : le rôle dans la fiche, son camp ; carte au joueur
reveler(acteurId)                 -> le rôle et le camp DU RÔLE publiés au document (case « Révélé » du MJ, narrateur)
migrer()                          -> { fiches, documents } (MJ actif, au « ready ») : une partie d'avant 0.9.0 passe aux secrets ;
                                     fiches construites, rangées et scellées AVANT de toucher un document ; rejouable sans perte
```
Garde des écritures (relecture 7) : pendant une partie, tant que le MJ actif n'a pas les secrets À JOUR (autre navigateur, autre MJ
devenu actif, secrets plus vieux que le coffre, parts attendues), toute écriture de la partie est refusée (`modifierEtat` : erreur
`LAKOUR_LOUPS.Erreurs.SecretsAbsents` ; votes reçus refusés avec un avis ; `verifierVictoire` ne déclare rien) et le coffre est
cherché. Une nouvelle partie (autre id) envoie TOUTES les fiches à leurs joueurs, même identiques à la précédente.
`ecritureBloquee()` -> true quand, chez le MJ actif, les écritures de la partie sont bloquées (le MJ IA se met alors en pause).
Chez le MJ actif seulement, hook local `lakourLoups.fiches` (une fiche a changé). Garde `preUpdateActor`, `preDeleteActor`,
`preCreateItem`, `preUpdateItem`, `preDeleteItem` (scripts/garde.mjs) : un non-MJ ne modifie ni un villageois ni ses objets.

Ajouts 0.10.0 — les Veillées de fête (§1 « Veillées de fête ») :
```
distribuer({ …, fete }) / nouvellePartie({ …, fete })
                                  -> fete : clé de veillée ("" : aucune) ; non précisée : le réglage monde « veilleeDeFete » (une veillée
                                     nommée, « date » : celle que propose la fête du calendrier du moteur, "" : aucune d'office, sinon
                                     celle de la partie précédente) ; jamais dans une Nuit de la Saint-Martin. nouvellePartie -> + fete
fete()                            -> { cle, nom, aide, fete (id du calendrier), neige (ce matin), defile: { cle, nom } | null } (tous)
secretsDeFete()                   -> { masque, masqueTombe, present, presentOuvert, promis } avec { id, nom } (MJ actif ; SECRET)
veilleesDeFete()                  -> { proposee, calendrier, veillees: [{ cle, nom, aide, fete }] } (tous) : la Table pré-sélectionne
                                     `proposee` (le réglage s'il nomme une veillée, sinon celle de la fête du calendrier ce jour-là)
resoudreNuit()                    -> + neige (Boolean) ; messages : + le murmure des âmes ; narration : + murmure, présent ouvert
```
Hook public `lakourLoups.fete` (`{ cle, quoi: "ouverture" | "neige", tour }`). Registre : entrée `{ type: "fete", quoi: "ouverture" |
"neige" | "defile", cle, role?, nom? }`. Refus de pouvoir de jour `neige`. Réglage monde `veilleeDeFete` ("" par défaut). Préparation de la
Table : liste « Veillée de fête » (`preparation.fete` : null tant que rien n'est choisi, puis "" ou une clé).

Ajouts 0.11.0 — la Petite tablée (§1 « Petite tablée ») :
```
nouvellePartie({ niveau: "petite-tablee" }) / distribuer({ …, tablee })
                                  -> tablee : true, false ; non précisé : une composition prête de ce niveau (« petite-tablee-07 ») la
                                     choisit, sinon le réglage monde « petiteTablee ». Jamais dans une Nuit de la Saint-Martin. nouvellePartie
                                     sans niveau : « petite-tablee » si le réglage est coché (12 places au plus), sinon le niveau précédent ;
                                     le réglage est RÉCRIT à chaque choix explicite (niveau, composition prête, tablee) : il se souvient.
                                     Résumé du MJ : + tablee, glas ; composition.niveau "petite-tablee", libellé « Petite tablée — … ».
logique.composer(n, equilibre, { niveau, … })  -> tant que le réglage « petiteTablee » est coché, une composition de 12 places au plus
                                     (hors peste voulue) est une petite tablée quel que soit le niveau demandé : le MJ IA, qui ne connaît
                                     que les trois niveaux, suit ainsi le choix du MJ (loups_composer, loups_distribuer auto, loups_rejouer)
contenu()                         -> niveaux : + "petite-tablee" ; compositions : + « petite-tablee-04 » … « petite-tablee-12 »
cloreVote()                       -> + sort: [acteurId] (petite tablée : l'égalité en tête tranchée par le sort, sans Bailli en charge) ;
                                     departage.sort: [acteurId] quand le Bailli passe (trancherVote complète par le sort)
verifierVictoire()                -> au régime des deux loups (8 places et plus), la meute doit être PLUS nombreuse (victoire.mjs, strict)
candidatsDeNuit({ roleCle: "meute" }) -> [] la première nuit au régime des deux loups (nuit blanche)
```
Logique pure `logique/tablee.mjs` : `NIVEAU_PETITE_TABLEE`, `TABLEE` (bornes), `nombreDeLoupsTablee`, `ombresTablee`, `deuxLoupsTablee`
(= `nuitBlancheTablee` = `pariteStricteTablee`), `glasTablee`, `verifierTablee({ humains, compagnons })` -> { ok, raison }, `contraintesTablee(places)`
-> [règles violées], `distribuerTablee({ roles, metiers, joueurs, maisons, humains, decrire, graine })` -> { tirage, manques, essais },
`sortTranche({ candidats, places, hasard })`. Réglage monde `petiteTablee` (faux par défaut). Chat : annonce assemblée (`Tablee.AnnonceTete`…, des
nombres, jamais un nom, et seulement les règles qui valent pour la table) + `Tablee.NuitBlanche` au régime des deux loups ; `Tablee.Sort`
à chaque égalité tranchée. Glas : 0 à la distribution = posé d'office (`glasTablee`), un jour donné est gardé. Plus de 12 places au niveau
petite-tablee : la composition retombe sur le niveau classique (avis au MJ), sans le mode. Une Saint-Martin ne touche pas au réglage. Table de jeu : niveau « Petite
tablée » (pré-sélectionné si le réglage s'en souvient), rappel des règles et avis hors des clous (1 à 4 humains, 2 à 8 IA), pastille
« Petite tablée » pendant la partie.

Socle du Pacte (étape 1 de `docs/plan-le-pacte.md`, sans rôle nouveau) :
```
cercle()                          -> [{ acteurId, nom, vivant }] (tous) : l'ordre des places, fixé à la distribution (ordre des maisons,
                                     départage par l'id ; un gens de passage s'assoit au bout) ; le jour, le cercle de la place le suit
voisins(acteurId, { vivantsSeulement = true }) -> { gauche, droite } (tous ; gauche = place précédente, le cercle se referme, morts sautés)
derniersGestes()                  -> [{ acteurId, nom, geste, demande }] (MJ actif) : les mourants dont le geste attend (Braconnière)
tenures() / tenir(cle, acteurId)  -> [{ cle, acteurId, nom }] (tous) / confie un bâtiment à un vivant ("" : vacant) (MJ actif)
evenements()                      -> [{ cle, type, quand, tire, debut, fin, source?, actif }] (tous), le présage de l'Almanach compris
reveler(acteurId, { roleSeul })   -> roleSeul : l'objet de rôle au document, sans camp public (variante Double visage, plus tard)
verifierVictoire()                -> une vérification à la fois (et jamais pendant qu'un dernier geste s'applique)
```
- **Derniers gestes** (`logique/derniers-gestes.mjs`) : un rôle à effet `emporter` qui meurt (hors cause `emporte`) reçoit une demande
  `type: "demande"`, `posthume: true`, `objet: "emporter"`, candidats = les vivants (lui exclu ; la nuit, une fois toutes ses morts
  tombées), à son seul joueur (compagnon IA : `api.resolveurs.compagnon`) ; sa réponse tue la cible (cause `emporte`), puis la victoire
  est vérifiée. Sans réponse au délai, ou s'il passe : avis au MJ (chronique secrète), l'étape `emporter` reste (repli du MJ). Le MJ qui
  emporte avant la réponse ferme la demande (`annuler`) ; une réponse tardive est ignorée. Étape de la Table : `emporter` avec
  `attente: true` et détail `emporterDemande` tant que la question est chez le mourant (le bouton reste). Une mort `emporte` sert le
  plus ancien mourant qui attend. Gardé en mémoire : une page du MJ rechargée ne redemande pas (l'étape reste).
- **Rôle public** : champ d'extension `role.public` (Boolean) ; à la distribution, un tel rôle est retourné devant tous
  (`revelerPubliquement` : objet de rôle, `system.revele`, camp DU RÔLE) et annoncé au chat (`Public.Annonce`) ; jamais un Somnambule.
- **Bâtiments tenus** : à la mort de l'occupant (`ajouterMort`), ses bâtiments deviennent vacants ; Registre : entrée
  `{ type: "vacance", acteurId, batiments }`. Les dix bâtiments communaux (`batimentsCles`) n'y sont pas.
- **Événements** : `type` `immediat` | `differe` (`delai` tours plus tard) | `permanent` (`fin: 0`), `quand` `jour` | `nuit` ;
  `evenementActif(etat, cle, tour, phase)` lit aussi le présage de l'Almanach (immédiat : le jour de son tirage, ou la nuit qui suit
  pour givre et crue), à l'identique de `presageDuJour` / `presageDeLaNuit`.

Le Pacte, étape 3a — les rôles du Village du jeu de soirée (`logique/pacte.mjs`, `docs/plan-le-pacte.md`) :
```
pacte()                           -> { innocentSuit, sagessePerdue, gracies: [{ acteurId, tour, numero }], egalite, votants: { tour, ids, par },
                                       plume: { cible, tour, servi }, secondVote: { tour, numero } } (tous ; l'état public)
designerVotants([acteurId], { par }) -> la liste du Souffre-douleur mort d'une égalité, dictée par le narrateur (MJ actif) ; ferme sa
                                       demande posthume encore ouverte ; erreur claire sans Souffre-douleur ni vivant permis
cloreVote()                       -> + souffreDouleur (il a payé l'égalité), plume (la cible de la plume noire, deux voix sans votant)
resoudreNuit()                    -> + aieux, furets (listes à jour, SECRÈTES), plume, contaminations ([{ sergent, loup }])
eliminer(id, { cause: "vote" })   -> l'Innocent dont la grâce n'a pas servi n'en meurt pas : gracié, carte retournée, [] ; un Aïeul tombé
                                       de la main du village (cause vote, poison, emporte) : la sagesse perdue, annoncée ; un signe du
                                       Greffier fait et les condamnés tombés : le second vote s'ouvre (ouvrirVote)
agirDeJour({ pouvoir: "greffier-begue" }) -> le signe, SECRET : ni annonce, ni révélation, ni hook public (Hooks.callAll local seulement)
```
- **Fratries** (Lavandières par deux, Bûcherons par trois ; effet `fratrie`, `nuit.cibles: 0`, `nuit.nuitsImpaires`) : un seul réveil pour
  tous (ordreDeNuit) ; `noterAction` remet à chacun, une fois par nuit, le nom des autres vivants (`Pacte.FratrieReconnue` la première
  nuit, `FratrieRetrouvee` ensuite, `FratrieSeule`) ; salon vocal « fratrie » la nuit où elles veillent (`logique/salons.mjs` : table
  `villageois[].fratrie`, `ligne.freres` à ses seuls membres). Le générateur tire un groupe en entier ou pas du tout (`equilibre.groupe`).
- **Aïeul** (`resister`) : la première attaque de la meute (un loup seul, la peste aussi) qui l'aurait tué, ou la première morsure de la
  Louve mère, lui coûte sa vie de réserve, en secret (chronique du MJ) ; remède ou garde la lui laissent. Tombé de la main du village
  (`CAUSES_SANS_SAGESSE` : vote, poison, emporte), `pacte.sagessePerdue` (public) : les rôles dont la CARTE est du Village n'ont plus de
  pouvoir (ni réveil : `seReveille({ sansPouvoirs })`, ni action à l'aube, ni pouvoir de jour : refus `sagesse`, ni dernier geste) ; tous
  les métiers non plus ; les charges restent. Réglage monde `innocentSuitAieul` (faux par défaut, pris à la distribution) : un Innocent
  déjà gracié meurt avec lui (cause `sagesse`).
- **Innocent** (`grace`) : condamné par le vote, gracié une fois (`pacte.gracies`, carte retournée) ; plus jamais votant (`filtrerVotants`,
  `votantsAdmis`, `priveDeVote`) ; Bailli, la charge est abolie (`bailli.actif` faux, Registre `bailli` / `abolie`). L'étape « exécuter »
  ne le propose plus pour ce vote.
- **Souffre-douleur** (`egalite`) : à un vote d'exécution (hors Banc), une égalité qui laisse une place vide le condamne à la place des
  ex æquo, avant la voix du Bailli et le sort (`cloreVote({ souffreDouleur })`, `pacte.egalite`). Mort ainsi, dernier geste `votants`
  (`derniers-gestes.mjs`) : demande posthume `objet: "votants"`, `nombre` = les vivants qui votent (un au moins) ; sa liste
  (`pacte.votants`, publique, annoncée) seule vote aux votes d'exécution du lendemain. Sans réponse : tout le monde vote (avis au MJ).
- **Furet** (`flairer`) : le trio autour du joueur désigné (`trioAutour`), au moins un loup tel que le voient les visions ; « non » : son
  flair est perdu (`pacteSecret.furets`), il reste dans l'ordre de nuit sans candidats (`candidatsDeNuit` -> []).
- **Gardeuse d'oies** (`cacarder`) : chaque matin, après les morts : un loup (camp réel) parmi ses deux voisins vivants, ou elle-même
  mordue -> annonce `Pacte.Oies` (chat, Registre `pacte`, hook `lakourLoups.pacte`).
- **Greffier bègue** (`second-vote`, pouvoir de jour `greffier-begue`, phase « vote », `usageDiffere`) : pendant un vote d'exécution ou
  juste après qu'il a condamné ; `pacteSecret.signal` ; quand les condamnés sont tombés (ou graciés), le second vote s'ouvre, annoncé
  sans nom (`Pacte.SecondVote`), l'usage est pris. Refus `secondVote`, `deja`.
- **Vieux Sergent** (`contaminer`) : mort de la cause `meute`, le premier loup vivant à sa gauche (`premierAGauche`) est contaminé
  (`pacteSecret.contamines`) et meurt à la nuit suivante, rien ne l'en protège (cause PUBLIQUE `contamine`).
- **Pie** (`plume`, ordre 46) : sa cible (ni elle-même, ni un rôle de `EXCLUS_DE_LA_PLUME`) vivante au matin est annoncée sans nommer la
  Pie (`Pacte.PlumeMatin`, `pacte.plume`) ; au premier vote d'exécution du jour, deux voix sans votant (`~plume`) contre elle ; un vote
  annulé par le Juge de paix les rend au revote.
- **Franc-Villageois** : `role.public` (socle).
- Registre : entrée `{ type: "pacte", quoi: "grace" | "sagesse" | "votants" | "plume" | "oies" | "second-vote", acteurId?, ids? }` ; un vote
  porte `plume` et `souffreDouleur`. Hook PUBLIC `lakourLoups.pacte` (`{ quoi, acteurId?, ids? }`, jamais le Greffier ni la Pie).

Le Pacte, étape 3b — les ambigus, les solitaires du livre et le Loup pâle (`logique/ambigus.mjs`, `docs/plan-le-pacte.md`) :
```
ambigus()                         -> { bateleur: [{ cle, nom, img }], retirees: [cle], commenceParLeJour, groupes: null | { critere, a: [{ id, nom }],
                                       b }, devouements: [{ acteurId, de, tour }] } (tous ; l'état public)
ambigusSecrets()                  -> { centre: [{ cle, nom }], modeles, matins, charmes, emprunts: { acteurId: { cle, tour } } } (MJ actif ; SECRET)
cartesDuBateleur([cle])           -> le narrateur pose lui-même les cartes du Bateleur (1 à 3 rôles permis, pas au paquet), avant la
                                       première nuit ; annoncé ; erreur claire sinon (Ambigus.Refus.tard, Ambigus.Refus.cartes)
distribuer({ roles })             -> avec un Chapardeur au paquet : deux cartes Villageois ajoutées s'il n'y a pas déjà n + 2 cartes ; les deux
                                       non distribuées au centre (ambigusSecret.centre) ; le paquet entier (distribué et centre) décide des
                                       cartes du Bateleur (tirées hors du paquet), du jour du Feu follet et des bords de l'Illuminé (annoncés)
nouvellePartie({ … })             -> une composition avec le Chapardeur garde n rôles (composer : centre: 2) ; le paquet en compte n + 2
reveiller("chapardeur" | "bateleur") -> une demande dont les candidats sont des CARTES ({ id: "centre-0" | clé, nom, img }) ; la réponse est
                                       notée avec la carte (noterAction({ carte })) ; reveiller("charmes") : les charmés, sans choix
noterAction({ …, carte })         -> applique aussitôt : la carte prise (Chapardeur ; deux loups au centre et rien de choisi : une au hasard),
                                       la carte jouée (Bateleur : son étape s'ajoute à l'ordre de la nuit, `emprunt: true`), le camp du
                                       Mâtin (se désigner = la meute), le modèle de l'Enfant des bois, les deux charmés du Joueur de vielle,
                                       la reconnaissance des charmés (étape « charmes ») ; une action d'une carte empruntée porte son effet
demanderAction({ soiMeme })       -> le « soi-même » d'une carte jouée par le Bateleur
cloreVote()                       -> une Chambrière qui peut se dévouer reçoit aussitôt une demande courte (objet "chambriere", candidats : les
                                       condamnés, au plus DELAI_CHAMBRIERE) ; eliminer(id, { cause: "vote" }) attend sa réponse
eliminer(id, { cause: "vote" })   -> dévouée : le condamné meurt sans que sa carte soit montrée, sa carte de Chambrière est retournée, elle
                                       prend son rôle remis à neuf ; ses derniers gestes et la sagesse de l'Aïeul ne jouent pas ; un modèle
                                       qui meurt (toute cause) fait passer son Enfant des bois à la meute
resoudreNuit()                    -> les cartes jouées par le Bateleur sont retirées au matin (annonce) ; au matin de la première nuit, le
                                       Feu follet vivant devient villageois (camp du Village, carnet)
verifierVictoire()                -> + Feu follet (premier tour), Joueur de vielle (tous charmés), Illuminé (l'autre groupe éliminé), Loup
                                       pâle (dernier vivant) ; la victoire de la meute ne compte jamais le Loup pâle (bilanDePartie)
```
- **Chapardeur** (`chaparder`, ordre 1, première nuit) : les deux cartes du centre lui sont montrées ; obligé si ce sont deux loups. Pris,
  le rôle est remis à neuf ; un rôle de première nuit encore à jouer cette nuit-là se joue à son tour (l'ordre de la nuit est recalculé).
- **Bateleur** (`emprunter`, ordre 2, chaque nuit) : ses cartes (`rolesDuBateleur` : village, pouvoir de nuit chaque nuit, ni groupe, ni
  première nuit, ni lien d'amour ni échange, pas au paquet), trois au hasard (`tirerCartesDuBateleur`, graine) ; la carte jouée cette
  nuit (`ambigusSecret.emprunts`) le réveille à son ordre et se résout avec son rôle (`resoudreNuit({ emprunts })`, `candidatsDeNuit`).
- **Mâtin** (`choisir-camp`, ordre 38, première nuit, `soiMeme`) : candidats = lui seul ; se désigner = la meute, dès cette nuit.
- **Enfant des bois** (`modele`, ordre 13, première nuit) : `enfantsOrphelins` à chaque mort.
- **Chambrière** (`devouement`) : `chambriereDisponible` (vivante, pas amoureuse, pas condamnée, sagesse), `ficheDeLaChambriere` (rôle remis à
  neuf ; `nuit.debut` = la nuit suivante pour un rôle de première nuit, lu par `seReveille` ; infectée, elle le reste), `devouer` (public :
  `ambigus.devouements`, Registre `pacte` / `devouement` ; charme et charge de Bailli perdus), `carteReprise` (gestes du condamné ignorés).
- **Feu follet** (`victoireCle: "premier-tour"`) : `commenceParLeJour` (étape « debat » après la distribution) ; `feuFolletGagne` : mort
  par le vote au tour 0, ou par la meute ou le poison la nuit 1 (phase de nuit ou d'aube).
- **Joueur de vielle** (`charmer`, ordre 80, deux cibles ; `victoireCle: "tous-charmes"`) : `candidatsDuCharme` (ni lui ni un charmé) ;
  étape « charmes » (`CLE_CHARMES`, ordre 81) tant qu'il joue (`vielleEnJeu`) ; mordu : ni réveil ni victoire.
- **Illuminé** (`victoireCle: "autre-groupe"`) : `partagerLeVillage` (`CRITERES_DE_PARTAGE` : la rive, la parité en repli ; d'autres
  critères s'y brancheront, les traits visibles de l'étape 9) ; vivant, pas devenu loup.
- **Loup pâle** (`trahir`, ordre 41, une nuit sur deux ; `victoireCle: "seul-survivant"`, la seule clé de victoire d'un loup) :
  candidats = les loups vivants (lui exclu) ; une attaque de loup (cause `meute`) ; sa proie entre dans `proiesDeLaNuit` (l'Herboriste).
- Registre : entrée `{ type: "pacte", quoi: "devouement", acteurId, ids: [condamné] }` ; hook PUBLIC `lakourLoups.pacte`
  (`{ quoi: "devouement", acteurId, ids }`). Réglages : aucun (la fenêtre de la Chambrière suit `delaiChoix`, au plus 30 s).

### Petite tablée (logique/tablee.mjs, 0.11.0)

Le mode pour peu d'humains (1 à 4) complétés par des compagnons IA (2 à 8), de 4 à 12 places. Ses règles sont PUBLIQUES (guide du
joueur, page « La petite tablée ») ; ce qu'elles contraignent, c'est le tirage, jamais ce qui s'annonce : la composition reste secrète,
et rien de qui tient quoi ne sort du tirage (l'annonce du chat ne porte que des nombres).
- **Composition** (niveau `petite-tablee` du générateur, `tirerTablee` ; compositions prêtes du contenu « petite-tablee-04 » à « -12 ») :
  1 loup jusqu'à 7 places, 2 de 8 à 10, 3 à 11 et 12 (`nombreDeLoupsTablee`) ; dès 6 places, au moins deux rôles de l'OMBRE (loups et
  solitaires : `ombresTablee` ; quatre à 11 et 12 places : trois loups et le Colporteur), le solitaire étant le Colporteur (le Chasseur de primes et le Revenant gagnaient une partie sur quatre ou
  cinq à si peu de votes) ; un loup à pouvoir au plus, une fois sur deux dès 7 places ; une lanterne (deux dès 8), une protection dès 6 ;
  un simple villageois au plus, dès six places (`villageoisTablee`) ; ni Loup déguisé, ni Pyromane, ni Dame du gué (`HORS_TABLEE`) ; ni Gibet ni
  Pont (`HORS_TABLEE_BATIMENTS`) ; les rôles du niveau classique sans leur minimum de joueurs ; cible d'équilibre `cibleTablee(n)`.
- **Partage des camps** (`contraintesTablee(places, regles)`, `reglesTablee`, `distribuerTablee` : règles favorisées tirées en secret,
  puis rôles rebattus jusqu'à satisfaire, 400 essais, sinon le moins mauvais et un avertissement). GARANTI : les humains ne sont jamais
  tous loups (2 et plus) ; à 3 humains ou plus, jamais tous du même camp. FAVORISÉ, tiré en secret à chaque distribution (jamais
  stocké, jamais annoncé) : une lanterne (rôle d'information) chez un humain du Village (`CHANCE_LANTERNE` = 1/2) ; à 3 humains ou
  plus, l'ombre des deux côtés de la table (`CHANCE_OMBRE` = 1/2). Un seul humain : aucune règle de côté. Le reste au hasard ; peste
  noire : les loups comptent comme villageois. Pourquoi pas plus : une règle de côté garantie rend une déduction certaine (à deux
  humains, « l'ombre des deux côtés » dirait au villageois que son ami est de l'ombre). Mesuré (relecture 14, `deduction.mjs`, 12
  compositions × 400 tirages par configuration) : plus aucune déduction « si je suis X, l'autre humain est Y » n'atteint 100 %, sauf
  à 4 places (un seul rôle de l'ombre : le loup sait par la règle que tout le reste est Village) ; à 2 humains, « A village → B ombre »
  22–33 % (tirage libre 25–39 %), « A ombre → B village » 66–93 % (libre 66–86 %) ; à 3 humains, « A village → B ombre » 53–57 % (libre
  33–40 %, la règle garantie « jamais tous du même camp »), « A ombre → B village » 82–93 %. L'annonce du chat ne dit que ce qui
  vaut pour la table (`Tablee.AnnonceTete`, `RegleLoups` dès 2 humains, `RegleCamps` dès 3, `RegleTirage` / `RegleTirageOmbre`,
  `RegleRythme`, `NuitBlanche`). `etat.places` (public) : les places distribuées, sur lesquelles se comptent la nuit blanche et la
  parité stricte (jamais les figurants ni les arrivants).
- **Rythme** : Glas final posé d'office (`glasTablee` : jour 3 jusqu'à 6 places, puis un jour de plus par deux places) si `glas` n'est pas
  donné ; au vote d'exécution, une égalité en tête que le Bailli ne tranche pas (pas de Bailli en charge : `cloreVote`, `resultat.sort` ;
  le Bailli passe : `trancherVote`, `departage.sort`) est tranchée par le sort parmi les ex æquo ; jamais pour la Chapelle, le Bailli,
  l'exil ou le Banc. **Régime des deux loups** (`deuxLoupsTablee`, 8 places et plus) : la première nuit est blanche (la meute ne chasse
  pas, `candidatsDeNuit` -> []) et la meute doit être PLUS nombreuse que les autres vivants pour l'emporter (`verifierVictoire({ strict })`) ;
  à un seul loup, les règles ordinaires.
- **Compagnons** : ils parlent d'abord aux humains (MJ IA, `compagnons.js` : `CONSIGNE_PETITE_TABLEE` dans la consigne de parole,
  `repliReplique` nomme un humain quatre fois sur cinq ; `compagnons-jeu.js`, vue : `humains` (public : `system.joueur`) et
  `petiteTablee` (public)). Un biais de PAROLE seulement : ni les votes ni les choix de nuit ne lisent cette liste.
- **Équilibre mesuré** (essais/integration-loups.test.mjs, joueurs simulés qui votent au hasard sauf un loup lu ou démasqué, 45 parties par
  configuration, dernière mesure, 315 parties) : 2 h + 2 IA 53 %, 2 h + 4 IA 38 %, 3 h + 5 IA 40 %, 3 h + 7 IA 62 %, 4 h + 8 IA 53 % de victoires de
  la meute, compositions prêtes petite-tablee-06 53 % et petite-tablee-08 60 % (51 % en tout ; d'un passage à l'autre, une table bouge de
  quelques points : les réponses des joueurs simulés et des compagnons s'ordonnent dans le temps) ; la borne
  de l'essai est 30–72 % par configuration, 38–67 % en tout. Une mesure MÉCANIQUE : de vrais joueurs lisent leurs lanternes et parlent.
- **Secrets** : rien de neuf n'est secret ; `petiteTablee` est public (état, hook de phase), le réglage aussi. L'essai `non-fuite` passe
  trois parties de petite tablée au crible et vérifie que l'annonce ne nomme personne (mutation : l'annonce qui nomme les humains de
  l'ombre). `essais/petite-tablee.test.mjs` : logique, API, 18 mutations.

### Veillées de fête (logique/fetes.mjs, 0.10.0)

Une variante par fête du calendrier du moteur (`lakour-mj-ia`, `docs/fetes.md`) : `nuit-des-ames` (halloween), `veillee-d-hiver` (noel),
`carnaval-des-masques` (carnaval), `fete-des-promis` (saint-valentin). Une à la fois, choisie à la distribution ; la date ne fait que la
PROPOSER (pré-sélection de la Table, réglage « date »), jamais l'imposer. Tous les tirages se font à la distribution ou à l'aube, chez le
MJ actif ; aucune étape de nuit nouvelle (le MJ IA et le MJ humain mènent la nuit comme d'habitude).
- **Nuit des âmes** : à l'aube d'une nuit meurtrière (au moins trois vivants), l'âme du premier mort (hors chagrin) murmure à un vivant
  tiré au hasard si deux autres vivants tirés au hasard sont du même camp (`apparenceMasquee` : un receveur loup n'est pas trompé par
  un masque) — message secret au receveur ; chaque loup vivant apprend en secret à quelle porte elle a frappé, le nom du receveur seul
  (`murmureDesAmes`, `messagesDuMurmure`).
- **Veillée d'hiver** : un joueur tiré au hasard (tous camps) reçoit le présent (`secretsDeFete.present`, carnet) : dans `resoudreNuit`
  (`jour.present`, d'`effetsDeLaNuit`), la première attaque qui allait le tuer échoue (après hors d'atteinte, immunité, porte, remède,
  protection ; pas contre le linceul, ni le chagrin), une fois (`presentOuvert`, sortie `presentOuvert`). À chaque aube, `tirerNeige`
  (`CHANCE_NEIGE` = 1/3, jamais deux aubes de suite) : `fete.neige = tour`, annoncée ; ce jour-là `verifierPouvoir` refuse (`neige`, sans prendre l'usage)
  `POUVOIRS_DE_TRACES` (Chasseresse, Ramoneuse, Tanneur, Colporteur de nouvelles), le Lavoir se tait (`LavoirNeige`).
- **Carnaval des masques** : un joueur tiré au hasard porte le masque (`secretsDeFete.masque` ; son carnet dit le camp que le masque
  montrera, `apparenceMasquee`) : `jour.masque` retourne le camp vu par la PREMIÈRE vision du Village qui le perce (Liseuse, Sourcier,
  prière de la Pèlerine), puis le masque tombe (`masqueTombe`, sortie `masqueTombe`, note au MJ) ; un regard de la meute (Loup flaireur,
  loup mordu qui lit pour elle, vision du Glas du deuil, receveur loup d'un murmure) n'est jamais trompé : la meute reconnaîtrait le
  porteur. Le défilé (`choisirDefile`) annonce à tous un rôle du Village absent : un des Masques de veillée de la meute si elle en a au
  moins deux (jamais le dernier), sinon un autre absent (ni villageois, ni Somnambule, ni Rosière, ni rôle sur demande).
- **Fête des promis** : deux joueurs du camp Village tirés au hasard apprennent chacun le nom de l'autre (carnet) ; chaque loup apprend
  les deux noms, et chaque nouveau loup aussi (mordu, échange de rôles, gens de passage de la meute). Aucun lien de mort. Moins de deux
  joueurs du Village : pas de promis, et l'annonce le dit (`AnnonceSans`).
Hook public `lakourLoups.fete` : `{ cle, quoi, tour }`, jamais rien d'autre. Équilibre : la neige (une aube sur trois au plus) et le masque
(une vision trompée, puis il tombe) ont été bridés pour ne pas trop servir la meute ; le présent et le défilé servent le Village.
Secrets : `secretsDeFete` dans les secrets du MJ (`separerEtat`), au coffre ; au carnet des seuls concernés ; dévoilés au récit de fin.
Le contenu (`lakour-veillees`, `scripts/fetes.js`) décline chaque fête auprès du moteur (`api.fetes.enregistrer`, au crochet
`lakour-mj-ia.pret`) : nom, description (carte publique), consigne (le narrateur IA ne trahit aucun secret), décor, et le journal de la
veillée (`contenu` : le journal installé du monde, à défaut celui du compendium).

### Lot 0.8.0 (logique/passage.mjs, banc.mjs, deuil.mjs, saintmartin.mjs)

**Gens de passage** (public : `etat.passage = { actif, gens: { acteurId: { cle, tour } } }`, `etat.partis = [{ acteurId, tour, comment }]`) :
rôles `remouleur` (verrou et lame sur une maison, nuit suivante), `montreur-d-ours` (asile), `pelerine` (le camp d'un joueur, en secret),
une fois, de jour (`POUVOIRS_JOUR`, source « role »). Le camp (`campDePassage`) : la meute à 70 % si elle est sous son compte
(`nombreDeLoups(n + 1)`), sinon 15 % ; jamais en peste noire. Il vit dans la FICHE secrète du MJ (comme tout camp depuis 0.9.0 : jamais
sur le document) et dans le journal SECRET ; le rôle d'origine reste « village ». Un parti est `vivant: false` sur son document, dans `etat.partis`, jamais dans `etat.morts` :
ni Dernier souffle, ni gagnant ni perdant (`bilanDePartie({ partis })`), jeton retiré, Bailli vacant, voix en cours retirée.
**Banc des accusés** (public, `etat.banc = { actif, tour, accusations, juges }`) : `verifierAccusation`, `prochainAccuse`, `verdictDuBanc`
(pour × 2 ≥ total pondéré des vivants ; Gibet : >) ; pas de cloche, pas de départage ; une exécution par jour.
**Glas du deuil** (public `etat.deuil = { actif, compte }` ; SECRET `etat.pouvoirsDeuil = { visions, voix, linceul }`) : `sonnerDeuil` à
chaque exécuté hors meute ; vision (étape `deuil`, ordre 41, effet `deuil` : action de toute la meute, ni guet ni éloignement ; `resoudreNuit().deuil` = la cible
vue, seule une vision délivrée est consommée), voix (`choisirVoixDuDeuil` : le choix SECRET de la meute pour le vote n° numero,
`pouvoirsDeuil.cible` ; `voixDuDeuil` : ce choix, sinon un candidat au hasard — jamais les bulletins ; pseudo-votant `VOIX_DU_DEUIL`,
retiré des votes), linceul (`effetsDeLaNuit().linceul` : ni porte, ni protection, ni repousse de morsure contre la meute).
Effets de jour `origine: "passage"` (ours, Rémouleur) : ni l'asile de la Chapelle, ni la lame de la Forge. `voteExecutionDuJour`
lit aussi le Registre (un exil ou une Chapelle peuvent suivre l'exécution) ; la Saint-Martin finit après son dernier vote d'exécution.
**Nuit de la Saint-Martin** (public `etat.format = "saint-martin"` ; SECRET `etat.autel`) : `composerSaintMartin(n)` (n + 3 rôles),
`verifierVictoire({ saintMartin })` (null : partie ordinaire ; false : rien ; true : `victoireSaintMartin`), `saintMartinFinie` ; ni Bailli,
ni Almanach, ni Banc, ni Glas du deuil ; la seconde nuit ne tombe pas (`changerPhase("nuit")` finit la partie).

### Lot 0.7.0 (logique/souffle.mjs, almanach.mjs, somnambule.mjs, calendrier.mjs)

**Dernier souffle** (public, `etat.souffle = { actif, utilises }`) : chaque mort garde UNE voix, au vote d'exécution, pesant 1, consommée
au dépouillement si elle compte (pas par un vote prolongé par le ruban) ; le Gibet ne compte que les morts qui ont soufflé ; les voix qui
manquent sont celles des vivants (`compteDesVoix` : les souffles à part). TANT QU'IL GARDE SA VOIX, un mort ne voit pas les rôles cachés
(`roleVisible` ignore « mortsVoientTout ») ni n'entend la tanière, et les morts se partagent en deux salons (qui gardent leur souffle /
qui voient tout) ; son souffle rendu (ou le réglage coupé), « mortsVoientTout » s'applique.
**Almanach des brumes** (public, `etat.presage = { actif, cle, tour }`) : un présage par aube, jamais deux fois de suite : `ciel-clair`,
`givre` (nuit suivante : ni protection ni verrou), `crue` (nuit suivante : Pont coupé), `foire` (vote à main levée : `vote.mainLevee`,
voix publiques pendant le vote), `brouillard` (pas de déclaration), `glas` (vote double, ce jour-là seulement), `lune-rousse` (majorité absolue), `rumeur`
(indice flou crié), `vent-du-nord` (silences levés), `sceau-brise` (pas de voix double du Bailli). Liste et textes : page des Variantes.
**Somnambule** (SECRET, `etat.somnambules = { acteurId: { croit, vrai, devoile } }`) : il PORTE l'objet du rôle rêvé (Liseuse, Fossoyeur ou
Sourcier, de préférence absent) — carte, fiche, carnet, compagnon IA, console le voient ainsi ; `resoudreNuit({ somnambules, rolesFactices })`
rend ses visions fausses, tirées du VRAI camp (inversé ; « même camp » à l'envers : jamais mieux qu'une vraie vision face au Loup
déguisé ou au Louvetier) et, pour un mort non révélé, un faux rôle hors meute et hors Somnambule (`nomsFactices`) ; à sa mort et à la fin, l'objet devient le vrai
(Somnambule) avant toute révélation ; le Colporteur qui prend le rêve devient le Somnambule. Ni lui, ni la Rosière, ni un rôle « sur
demande » ne sont jamais des masques de la meute. Deux porteurs d'un même rôle : `reveiller` les réveille chacun avec SES candidats.
**Historique** : la composition de la partie en cours reste dans les secrets du MJ (`etat.aConsigner`) et n'entre au réglage monde
`historique` (livré à tous) qu'à la fin (victoire), ou quand la partie est abandonnée (nouvelle distribution, village remis à zéro).
**Rosière** : exécutée par le vote -> `verifierVictoire` rend « meute » (peste noire : « peste »), après les solitaires exécutés.
**Glas final** (public, `etat.glas`) et **Bonne étoile** (SECRET, `etat.bonneEtoile`) : `calendrier.mjs` (`glasSonne`, `etoilesDeLaNuit`). Au glas, un village vide (personne en vie) revient au Village : la partie finit toujours.

### Bailli, Registre, Masques (logique/bailli.mjs, logique/registre.mjs, logique/masques.mjs)

**Le Bailli** (public, `etat.bailli = { actif, acteurId, depuis, succession, election }`, `actif` pris du réglage à la distribution, peste
noire comprise : son absence la trahirait). Un jour sans Bailli vivant, l'élection (`objet: "bailli"`) précède le vote d'exécution (étape
`bailli` du MJ humain, bouton « Élire le Bailli » de la Table et du bandeau) ; une seule par jour ; égalité : le sort ; aucune voix : vacance.
Sa voix pèse 2 au dépouillement d'un vote d'exécution (et dans le total du Gibet). Une égalité qui laisse une place vide est tranchée par lui :
`resultat.departage.enAttente`, demande `departage`, `trancherVote` ; la clôture attend (délai des choix) ; s'il passe, personne ; avec le
Gibet, seulement parmi ceux qui ont la majorité ; le Juge de paix attend le départage. À sa mort (`ajouterMort`), `succession = { de, tour, quand }`,
puis, après toutes les morts de la nuit, demande `succession` posthume (le reste du délai des choix compté depuis `quand`) ; sans réponse :
vacance, nouvelle élection au prochain jour. Étapes d'attente `departage` et `succession` ; tant que le départage attend, ni vote ni phase ;
une page du MJ rechargée reprend les deux (`reprendre`) ; Table de jeu : « Trancher » (un bouton par ex aequo, ou « Personne ») et
« Nommer le Bailli ». Un vote touché pendant le départage entre au Registre sans condamné ; la nuit tombée, aucun condamné.

**Le Registre du greffier** (public, `etat.registre`, 300 entrées au plus) : chaque vote clos (`votes`, `decompte`, `elus`, `poids`,
`departage`, `annule` si le Juge de paix l'a annulé), jamais un vote ouvert ou prolongé ; chaque mort avec sa cause PUBLIQUE (`causePublique`) ;
le Bailli ; les déclarations (un vivant, phases `aube`/`jour`/`vote`, pas réduit au silence en `jour`/`vote`, trois par jour, une ligne de
160 caractères sans balises ; le greffier ne vérifie rien). Table de jeu : section « Registre du greffier » et champ « Déclarer ».

**Les Masques de veillée** (SECRET, `etat.masques` dans les secrets du MJ) : à la distribution d'une partie avec meute (jamais une peste
noire ; réglage `masques`), 2 rôles (un loup seul) ou 3 (une meute) du camp du Village, ni distribués ni « villageois », remis au carnet
secret de chaque loup (texte : nom et pouvoir) ; aussi à un villageois qui rejoint la meute (`changerCamp`, `echangerRoles`). Jamais dans
l'état public, un hook ou un message adressé à un autre qu'un loup.

### Peste noire (logique/peste.mjs)

Une variante RARE, et un secret jusqu'à la fin. Aucun rôle de la meute (`composer(n, equilibre, { peste: true })` ;
`sansMeute(roles)` pour une liste donnée) ; métiers et bâtiments comme d'habitude. Elle survient :
- d'elle-même, quand une partie se compose seule (composition générée par `nouvellePartie`, et par le MJ IA via `loups_composer`,
  `loups_distribuer` mode auto, `loups_rejouer`) : `tirerPeste({ graine, chance })`, `CHANCE_PESTE = 1/30`, réglage monde caché
  `chancePeste` (les essais le mettent à 0) ;
- ou par choix du MJ : `nouvellePartie({ peste: true })`, `distribuer({ peste: true })`, case « Partie peste noire » des
  préparatifs de la Table de jeu, paramètre `peste: "oui"` des outils du MJ IA.

**Nuits.** `ordreDeNuit(villageois, tour, { peste: etat.peste })` : pas de meute ; à l'ordre 40, l'étape `"peste"` (CLE_PESTE).
Tant qu'aucune victime de la peste n'est morte, le narrateur choisit (`reveiller("peste", { cible })` ; Table : « Réveiller : la
peste », avec « Au hasard ») ; ensuite **le porteur** — la dernière victime MORTE de la peste (`etat.peste.porteur`, `suivrePeste` à
l'aube) — désigne la suivante par une demande secrète `posthume` (fenêtre ou carte chez son joueur ; compagnon IA : son cerveau) ;
sans réponse au délai, le hasard. `noterAction({ acteurId: porteur | "", roleCle: "peste", cibles })`. `resoudreNuit` attaque la
victime EXACTEMENT comme une proie de la meute (protections, remède, verrou, asile, Taverne, absence, Pont/écluse, immunité des
tueurs solitaires ; Pont franchi), sans loup qui entre (ni lanterne, ni sang, ni sortie, ni Ermite) ; cause secrète `"peste"`,
publique `"nuit"`, même annonce au chat. Le porteur l'apprend dans son carnet secret (`Peste.CarnetPorteur`).

**Le cri.** Pendant le jour (`aube`, `jour`, `vote`), tout villageois vivant et non réduit au silence (à l'aube, même réduit) peut
crier « C'est la peste noire ! » : bouton du bandeau et de la Table (socket `peste`), bouton du MJ à côté de chaque vivant,
`crierPeste(acteurId)`, outil `loups_peste`, ou un compagnon IA qui l'écrit dans sa réplique. Juste : `etat.peste.decouverte`,
le vote se ferme, `verifierVictoire` -> `"village"` (libellé `Victoire.villagePeste`). Faux : le crieur est éliminé, cause publique
`"panique"` (« pendu pour avoir semé la panique »).

**Fins.** `verifierVictoire({ …, peste })` en peste noire : solitaires « exécuté » / « cible exécutée » d'abord, puis cri juste ->
`"village"` ; un vivant ou aucun -> `"peste"` (VAINQUEUR_PESTE, « Brumecombe s'éteint dans la fièvre », personne ne gagne) ; sinon
rien (ni « plus de loup », ni amants, ni tueur solitaire). Récit de fin et Chroniques (`peste: true`, « Peste noire ») la dévoilent.

**Le secret.** `etat.peste` et `etat.composition` vont dans les secrets du MJ (`separerEtat`) ; l'état public n'a pas la clé
`peste` avant la phase `fin` ; aucun hook public ni message de socket ne la porte (la demande `posthume` ne va qu'au porteur) ;
la composition n'est jamais annoncée (hook `nouvellePartie` public sans composition, Table : composition et marque « Peste noire »
chez le MJ seul). Depuis 0.9.0, aucun document ne porte un rôle ou un camp avant sa révélation (§6) : compter les loups dans la
console ne dit plus rien (0 partout, peste noire ou non).

### Salons vocaux (logique/salons.mjs, scripts/salons.mjs)

Avec la voix intégrée de Foundry (A/V), réglage monde **`salonsAutomatiques`** (« Salons vocaux automatiques », vrai par défaut) :

| Qui parle            | Jour (`aube`, `jour`, `vote`) | Nuit (`nuit`) |
|----------------------|-------------------------------|---------------|
| un vivant            | tous (vivants et morts)       | personne, micro coupé — sauf un loup : les loups (et les morts si `mortsVoientTout`) |
| un mort (ou un spectateur sans villageois) | les morts seulement | les morts seulement |
| un réduit au silence | personne pendant `jour` et `vote` (il parle à l'aube) | personne |

Un spectateur (utilisateur sans villageois, qui n'a jamais joué) n'entend jamais la tanière, même avec `mortsVoientTout`.
Le MJ (tout utilisateur MJ, même s'il incarne un villageois) entend tout et parle à tous. `preparation` et `fin`, ou le réglage
décoché : tout le monde parle à tout le monde. Est loup le villageois dont le camp ACTUEL est `meute` : les sept loups du contenu
(Loup de Brumecombe, affamé, déguisé, Louve mère, hurleur, flaireur, des roseaux), le mordu (à l'aube, `changerCamp` : il est à la tanière
la nuit suivante), pas un loup dont le Colporteur a pris le rôle ; le rôle ne sert que si le camp manque.
Fonction pure : `audibilite(etatPublic, secretsMJ, locuteur, table)` -> `{ peutParler, auditeurs, acteursAuditeurs, salon }`, avec
`table = { villageois, utilisateurs: [{ id, mj }], mortsVoientTout, automatique, loupsConnus }` (`secretsMJ` null : aucun camp connu
hors `loupsConnus`) ; `ligneDe(…, userId, table)` -> `{ phase, salon, peutParler, auditeurs, entend, loups? }` ; salons : `mj`,
`libre`, `village`, `taniere`, `morts`, `nuit`, `silence`.

Chez le MJ actif, à chaque changement, chaque joueur connecté reçoit sa seule ligne (socket `salon`, `recipients: [userId]`,
seulement si elle a changé ; à la connexion et sur `bonjour`, toujours). `entend` et `auditeurs` ne nomment, la nuit, aucun loup
pour un non-loup ; `loups` (acteurIds de la meute) n'est donné qu'à un loup, la nuit. Rien dans un réglage monde ni un document.

Dans chaque navigateur non MJ, d'après sa ligne (code client v14 lu : `AVMaster`, `SimplePeerAVClient`, `CameraViews`) :
- côté ÉMETTEUR, sa voix (son et image) ne part que vers `ligne.auditeurs` : vers les autres pairs, chaque `RTCRtpSender` de
  la connexion porte `null` (`replaceTrack(null)`, sans renégociation), la vraie piste vers les autres. Lu dans le client
  v14 : `client.peers` (Map userId -> pair SimplePeer, rangé juste après sa création, avant la signalisation) ; changement
  d'appareil par `removeStream`/`addStream`. Hypothèse restante (SimplePeer, sans A/V réel) : connexion dans `_pc`. Recalcul à
  chaque ligne, rendu des caméras, réglage A/V, `userConnected`, `peers.set`/`delete`, `addTrack`/`addTransceiver`/
  `removeTrack`, `negotiationneeded`/`signalingstatechange`, et `replaceTrack` de Foundry (autre micro, autre caméra) ;
  ligne d'une autre phase que l'état public, ou pas de ligne en partie : vers les MJ seulement. Repli si l'émetteur ne peut
  pas être trié alors que sa voix ne doit pas aller à tous : micro ET caméra coupés à la source, pour tous, avec un
  avertissement (texte en dur, clé de traduction à faire). `salons.etatEmetteur()`, `salons.voixRepliee()` ;
- en plus (défense en profondeur), les flux de ceux qu'il ne doit pas entendre sont coupés LOCALEMENT : pistes du flux distant (`getMediaStreamForUser`) désactivées
  (son et image), `<video class="user-camera">` muet, voyant « parle » (`ui.webrtc.setUserIsSpeaking`) forcé éteint ; réappliqué
  à chaque rendu des caméras (`renderCameraViews`, `renderCameraPopout`, `rtcSettingsChanged`) ;
- son micro, quand il doit se taire : `game.webrtc.broadcast` et `game.webrtc.client.toggleBroadcast` enveloppés sur l'instance
  (toujours `false` : ni pousser pour parler, ni détection de voix, ni « toujours », ni voyant chez les autres) ;
- aucun réglage A/V persistant n'est écrit (ni `muted`, ni `volume`) ; tout est rendu quand la ligne le permet (préparatifs,
  fin, réglage décoché), si l'A/V est désactivé, et au départ du monde (`beforeunload`). Le MJ n'est jamais coupé.
- Bandeau : « 🔇 La nuit, silence », « 🐺 Tanière : tu parles aux loups », « 👻 Tu parles aux morts », « 🔇 Réduit au silence » ;
  rien sans A/V (mode « Désactivé ») ni pour un vivant le jour.
Limite : appliqué dans chaque navigateur, comme le reste (§6) : un tricheur peut rouvrir SA voix vers tous dans sa console,
mais plus entendre les autres (leur flux ne lui arrive pas). Reste observable : les connexions elles-mêmes (chaque pair
est connecté à tous, ICE/DTLS/RTCP continuent), et la nuit l'absence de paquets venant de chacun (la même pour tous). Le système gère seul
les salons, sans le MJ IA ; le MJ IA consulte `audibilite` pour la voix des IA et la transcription.

### Plateau (scripts/plateau.mjs, logique/plateau.mjs)

La scène du village est celle dont le drapeau `plan` (d'un module de contenu) a des éléments « Maison N » ; `plan.plateau`
précise `seuils` (centre du jeton devant chaque maison), `cercle` ({ x, y, rayon, rayonMin }, en cases) et `cimetiere`.
Chez le MJ actif, à chaque phase, mort, révélation ou silence (hooks du système, sans le MJ IA) : un jeton verrouillé
(`locked`) par villageois, image NEUTRE tant que le rôle est caché (celle du rôle s'il est révélé, et pour tous à la fin),
places (nuit, aube, préparatifs : devant sa maison ; jour, vote, fin : en cercle sur la place ; morts : au cimetière, marqués
puis déplacés), déplacements `Scene#moveTokens` en marche (`action: "walk"`, `constrainOptions.ignoreWalls`), lumière
(`environment.darknessLevel` : nuit 0,85, aube 0,4, vote 0,15, fin 0,3, sinon 0), statuts `dead` (surimpression) et
`silence`, ambiances du MJ IA s'il est actif (« nuit », « tension »). Verrou : `preUpdateToken` et `preMoveToken` refusent
à un non-MJ la place, l'image, le verrou d'un jeton de villageois ; la sous-classe du Token (scripts/jeton.mjs) lui refuse
HUD, configuration et glisser.

Chez chaque joueur, LOCAL (aucun document, aucun réglage monde) : bandeau d'action (scripts/apps/bandeau.mjs), halo des
candidats, sélection, son vote, coche « a voté » (état public `vote.exprimes`), bulles du dépouillement, infobulle. Le clic
sur un jeton qu'il ne contrôle pas est capté par la sous-classe du Token (`_canControl` sur `pointerdown`, `_onClickLeft`) ;
seul le choix validé part au MJ actif (`reponse`, `vote`, `jour`), comme depuis les fenêtres, qui restent en secours.

Parole (scripts/parole.mjs, logique/parole.mjs ; 0.9.0) : pendant une partie (distribuée, pas finie), aucun message de chat ne
porte ce qui ne doit être lu que de quelques-uns — un chuchotement est livré à tous. Un mort n'écrit plus au chat : avec le canal
des morts (réglage `canalDesMorts`), son message part au MJ actif par le socket (`paroleEnvoi`), qui le RELAIE (`parole`,
`recipients` : les autres morts et les MJ) ; chacun l'affiche localement (`ChatLog#postOne` d'un message jamais créé, à défaut une
notification). Un mot « au seul MJ » (chuchotement aux MJ, d'un mort, d'un réduit au silence ou de tout joueur) suit le même relais
(`recipients` : les MJ). Un chuchotement de joueur à joueur est refusé. Un réduit au silence se tait en phases « jour » et « vote » ;
le MJ n'est jamais bloqué ; hors partie, le chat est libre. Refus dans le navigateur de l'auteur (`preCreateChatMessage`), garde chez
le MJ actif (`createChatMessage` : un message passé outre est retiré, son auteur prévenu).
Réglages ajoutés : `canalDesMorts` (monde), `plateauInteractif` (client), `historique` (monde, rôles des dernières parties).

### Compagnons IA (docs/compagnons.md)

Un compagnon IA est un villageois sans joueur, `system.compagnon = true`, joué par le cerveau du MJ IA comme par un joueur.
Il n'a pas de navigateur : `demanderAction`, `demanderTexte` et `demanderActionMeute` (pour un loup compagnon) n'ouvrent pas de
fenêtre par le socket, ils appellent `api.resolveurs.compagnon(demande)` chez le MJ actif ; à l'ouverture d'un vote (et quand le
Juge de paix le fait rejouer), chaque compagnon vivant reçoit une demande `type: "vote"` et sa voix est enregistrée comme celle
d'un joueur ; `cloreVote` attend les voix en cours. La réponse est filtrée comme celle d'un joueur (candidats admis, nombre de
cibles, longueur du mot). Sans résolveur, s'il échoue ou s'il dépasse le délai, le compagnon passe : la partie n'attend jamais.
Son carnet secret (carte de rôle, ce qu'il apprend la nuit, mots du Messager, silence) est gardé chez le MJ comme celui d'un
joueur, sans rien envoyer par le socket : le MJ IA en nourrit son cerveau (`carnet(acteurId)`), avec l'état PUBLIC de la partie.

### Interface

- **Table de jeu** (ApplicationV2 + Handlebars) : phase, tour, minuteur, villageois (vivants, morts, rôles révélés, métiers),
  bâtiments en jeu, **pouvoirs de jour du joueur** (un bouton chacun, grisé avec la raison quand ce n'est pas le moment), effets
  de la nuit prochaine, Conteuse et appel en cours, bouton « Carnet secret » ; pendant un vote : boutons de vote (joueurs vivants),
  qui a déjà voté, décompte visible après clôture. Chez le MJ : commandes, vote de la Chapelle, chronique (publique et secrète).
  Bouton dans les contrôles de scène (calque Jetons) pour l'ouvrir.
- **Fenêtre de choix de nuit** chez le joueur concerné : invite, liste des candidats (ou zone de texte pour le mot du Messager),
  « Passer ». Rien n'apparaît chez les autres. La même fenêtre, en local, sert à choisir la cible d'un pouvoir de jour.
- **Carnet secret** chez chaque joueur : ses messages secrets, sa prime.
- **Fiche de villageois** : rôle et pouvoir visibles seulement de son joueur (`system.joueur`, d'après sa fiche reçue du MJ) et du
  MJ ; métier public ; état (vivant, révélé). Chez le MJ actif, les champs camp, amoureux et protections viennent de ses secrets et y
  retournent (`secret.*` -> `reglerFiche`) ; un rôle déposé sur la fiche va dans la fiche secrète (`donnerRole`), « Révélé » le publie.
- Les morts voient tout (réglage) mais ne votent plus.

## 2. Module de contenu `lakour-veillees`

Même contrat que lakour-40k et lakour-warcraft (`modules/lakour-mj-ia/scripts/contenus.js`) :
- compendiums : `roles` (Item), `metiers` (Item), `batiments` (Item), `journaux` (JournalEntry : guide du joueur visible, guide
  du narrateur caché, règles), `tables` (RollTable : noms de villageois, rumeurs, présages, morts mystérieuses), `scenes` (Scene :
  le village de Brumecombe, avec plan), `villageois` (Actor : quelques villageois non joués / figurants nommés si utile) ;
- `assets/cartes/plans.json` et le plan dans les drapeaux des scènes ; `assets/jetons/<cle>.svg` (+ `3d/`), `figurants.json`,
  `index.json` / `index-3d.json` (jeton de joueur par clé de RÔLE ; jeton neutre `villageois` pour cacher le rôle) ;
- `assets/compositions.json` : `{ "<cle>": { "libelle", "joueurs": [min, max], "niveau": "debutants|classique|chaos",
  "roles": ["<cle de rôle>", …] (autant que de joueurs ; « villageois » pour compléter), "batiments": [cle…] } }` ;
- installateur (`scripts/main.js`, monde `lakour-loups` seulement) : importe guides et la scène du village, recopie les plans.
- Petite tablée (contenu 0.13.0, système 0.11.0) : compositions prêtes « petite-tablee-04 » à « petite-tablee-12 » (niveau
  `petite-tablee`, tirées par le générateur du système à graine fixe — `composerTablee` de `contenu/compositions.mjs` importe
  `composer` —, donc à la cible d'équilibre du mode ; mesurées dans l'essai d'intégration comme les générées) ; page « La petite tablée » du guide du
  joueur, section du guide du narrateur (« Préparer la partie », « Conseils pour un MJ IA »), ligne des Variantes.
- veillées de fête (contenu 0.12.0) : un journal visible par veillée (`fete-<clé>`), une page d'image en tête
  (`assets/fetes/<id de la fête du calendrier>.jpg` : halloween, noel, carnaval, saint-valentin), puis la fête et ses règles ; le guide du
  joueur et celui du narrateur ont une page « Les veillées de fête ». `scripts/fetes.js` (données sans dépendance, identifiant de chaque
  journal vérifié à la fabrication) sert à `main.js`, qui les décline auprès du moteur au crochet `lakour-mj-ia.pret`.
- La carte du village : une maison par joueur (jusqu'à 18, repères « Maison 1 »… « Maison 18 »), la place du village (où l'on
  vote), et les 10 bâtiments (Chapelle, Moulin, Taverne, Gibet, Puits, Forge, Cimetière, Pont, Lavoir, Grange) comme éléments
  nommés, pour que le MJ IA pose les jetons (« devant la chapelle »).

## 3. MJ IA

`CONTENUS["lakour-loups"] = "lakour-veillees"` ; adaptateur `lakour-loups` dans `adaptateurs.js` (pas de jet de dés : `lancer`
lève une erreur claire ; `resumer` donne nom, vivant/mort, métier, rôle) ; outils de narrateur qui appellent `game.lakourLoups`.
Le MJ IA ne révèle jamais un rôle secret en dehors d'un message privé au joueur concerné. Ce que les rôles apprennent la nuit, il
le remet par `envoyerSecret` (carnet secret), jamais par un chuchotement du chat.

MJ IA 0.36.1 (avec le système 0.10.0) : le socle des fêtes (`docs/fetes.md`). Aux Veillées, sa ligne de contexte vient de la veillée EN
JEU (`game.lakourLoups.fete()`, état public), même hors saison : son nom, ses règles (`aide`), la neige et le défilé annoncés, la consigne
de la déclinaison de sa fête et la garde de ses secrets (`fetes-logique.js`, `ligneVeillee`) ; sans veillée en jeu, la fête du calendrier
reste une ambiance (« la date seule ne change rien »). Rien d'autre ne change pour lui : la veillée vient du réglage « veilleeDeFete » quand `loups_distribuer` distribue, ses messages secrets lui sont rendus comme
les autres par `resoudreNuit` (`messages`, `narration`).

MJ IA 0.35.0 (avec le système 0.9.0) :
- il lit rôles et camps par l'API du système (`roleDe`, `campDe`, `fiche` ; `utilitaires.js`, `roleLoups` / `campLoups`), chez le
  MJ actif : `adaptateurs.js` (`resumer`), `compagnons-jeu.js` (la vue d'un compagnon : son rôle, son camp ; les autres, révélés
  seulement), `moteur.js` (distribution secrète du narrateur), `outils.js` (`loups_nuit`, `loups_vote`, `loups_eliminer`…),
  `transcription.js` (la meute, pour router la parole) ; jamais un document ;
- son coffre (`scripts/coffre.js`) scelle aussi les secrets des Veillées : `api.coffre.sceller`, `scellerEnPartant` (passation du MJ
  qui perd la main), `ouvrirScelle`, `scellerAvec`, `siRenouvele`, `siDisponible` (§6) ;
- aux Veillées, ni `noter_memoire` ni `creer_journal` (`horsSystemes`, et refus en garde) : un journal du monde, même réservé au MJ,
  est livré à tous les navigateurs ; ce que le narrateur doit retenir reste dans son fil, chiffré ; `ecrire_chronique` (la chronique de
  campagne, lisible de tous) n'est ni proposé ni accepté pendant une partie en cours (`horsPartieLoups`) : avant et après, oui ;
- la transcription montrée aux MJ (réglage `transcriptionAuMJ`) : affichée localement chez le MJ actif et envoyée aux autres MJ par
  le canal du module (`{ type: "transcription" }`, `recipients` : les MJ), jamais chuchotée aux Veillées (ailleurs, chuchotée aux MJ
  comme avant) ;
- quand `api.ecritureBloquee()` (secrets de la partie en attente chez le MJ actif) : le narrateur n'appelle pas le modèle (un avis au MJ,
  `LAKOUR_MJIA.Erreurs.SecretsVeillees`), un outil `loups_*` reçu rend une erreur « ne relance pas », le pilote automatique s'arrête
  (raison `secrets`, sans se suspendre : il repart quand les secrets reviennent, hook `lakourLoups.secrets`), les compagnons n'appellent
  pas leur modèle ;
- le coût des IA (`seance`, `compagnonsHorsSeance`, réglages monde) reste en mémoire pendant une partie des Veillées et s'écrit d'un
  coup quand elle est finie ou abandonnée, à l'arrêt de la séance et avant de quitter la page : une écriture par décision d'un
  compagnon dirait, la nuit, combien de loups IA se réveillent.

Petite tablée (système 0.11.0, MJ IA inchangé hors compagnons) : le MJ IA la choisit par le réglage monde « petiteTablee » (la Table du
MJ le coche quand le MJ choisit ce niveau ; `api.logique.composer` suit alors le réglage pour toute composition de 12 places au plus :
`loups_composer`, `loups_distribuer` en mode auto, `loups_rejouer`), ou par `loups_distribuer` en mode « composition » avec une
composition prête « petite-tablee-<n> » (le système reconnaît son niveau et applique le mode). Le guide du narrateur le lui dit. Les
compagnons (`compagnons.js`, `compagnons-jeu.js`) parlent d'abord aux humains quand `etat.petiteTablee` (public) est vrai.

Outils `loups_*` (section « Narrateur des Veillées » de `modules/lakour-mj-ia/scripts/outils.js`, `systemes: ["lakour-loups"]`) :
`loups_composer`, `loups_distribuer` (maisons sur les deux rives), `loups_nuit` (candidats de `candidatsDeNuit`, mot du Messager
par `demanderTexte`, messages par `envoyerSecret`, annonces de l'aube rendues au narrateur), `loups_vote` (objet `chapelle`, ruban,
rappel du Juge de paix), `loups_eliminer` (refuse d'exécuter « vote » pendant un vote rouvert), `loups_effet`, et **`loups_jour`**
(action `lister` : pouvoirs de jour possibles ; action `utiliser` : applique celui qu'un joueur annonce, via `agirDeJour`).

**La composition ne s'annonce jamais** aux joueurs (ni rôles en jeu, ni nombre de loups) : `loups_composer` et `loups_distribuer` la
rendent « pour toi seul », l'ouverture d'une nouvelle partie présente le village et les bâtiments sans elle. **Peste noire** (§1) :
- `loups_composer`, `loups_distribuer`, `loups_rejouer` : paramètre `peste` (`"oui"`, `"non"`, `""` = le hasard du système, très
  rare) ; une peste proposée par `loups_composer` reste une peste si ses rôles sont distribués tels quels (mode `roles`) ;
- le narrateur le sait (distribution secrète, état du jeu, sortie des outils : « PESTE NOIRE (secret absolu…) ») et ne le dit
  jamais avant la fin ; `loups_nuit` mène l'étape « la peste » : `peste_victime` (nom, ou « hasard ») tant qu'il n'y a pas de
  porteur, ensuite le système demande au porteur ;
- **`loups_peste`** (`villageois`) : quand un joueur crie « C'est la peste noire ! » à voix haute ; le système tranche ;
- pilote automatique : la consigne de la nuit demande la victime au narrateur la première nuit d'une peste seulement ;
- compagnons IA : ils ignorent la variante (vue publique) ; leur consigne leur permet de crier, prudemment (seulement
  convaincus) ; une réplique qui contient « C'est la peste noire » est transmise à `crierPeste`.

Ce que le MJ IA doit savoir des rôles et métiers ajoutés en 0.6.0 (aucun outil nouveau : tout passe par les mêmes appels) :
- **Loup des roseaux** (meute, `voir-actif`, ordre 45) : réveillé avec la meute puis seul ; `loups_nuit` lui demande une maison, le
  système lui répond au carnet « a agi / n'a pas bougé ».
- **Louvetier** (village, `voir-camp`, ordre 61, `apparence: "meute"`) : les visions le voient de la meute ; le narrateur ne corrige
  jamais (règle à tenir dans la narration).
- **Pêcheur de nuit** (village, `tuer`, une fois par partie, ordre 48) et **Dame du gué** (solitaire, `tuer`, une nuit sur deux,
  ordre 47, `dernier-survivant`) : leurs victimes ne sont pas des « proies de la meute » (ni Louve mère, ni invite de l'Herboriste) ;
  morts annoncés « dans la nuit » sans traces de crocs.
- **Ramoneuse** et **Éclusière** : métiers publics, listés par `pouvoirsDeJour` / `loups_jour` (dont la description cite les douze
  premiers, mais la liste vient du système) ; l'écluse apparaît dans « la nuit prochaine » de la Table de jeu (`Table.Effets.ecluse`).
Le guide du narrateur (journal caché, lu par le MJ IA) reprend ces consignes ; le guide du joueur a une page « Nouveaux visages de la
veillée ».

## 4. Clés d'effet (automatisables par le système, sinon arbitrées par le narrateur)

`tuer`, `proteger`, `voir-camp`, `voir-role-mort`, `eclairer` (démasque un loup qui entre), `silence`, `vote-double`,
`annuler-vote`, `remede`, `poison`, `lien-amour`, `echanger-role`, `mordre` (rejoindre la meute), `emporter` (à sa mort),
`asperger` / `embraser`, `epier`, `messager`, `voir-actif`, `voir-role` (le rôle d'un joueur : la Liseuse de cendres) ; Pacte, étape 3a
(`logique/pacte.mjs`, §1 « Socle du Pacte ») : `resister` (Aïeul), `egalite` (Souffre-douleur), `grace` (Innocent), `fratrie` (Lavandières,
Bûcherons), `flairer` (Furet), `cacarder` (Gardeuse d'oies), `second-vote` (Greffier bègue), `contaminer` (Vieux Sergent), `plume`
(Pie) ; Pacte, étape 3b (`logique/ambigus.mjs`) : `chaparder` (Chapardeur), `emprunter` (Bateleur), `choisir-camp` (Mâtin), `modele` (Enfant
des bois), `devouement` (Chambrière), `charmer` (Joueur de vielle), `trahir` (Loup pâle). `emporter` : le mourant désigne lui-même sa cible (demande posthume,
socle du Pacte), le MJ en repli. Toutes sont désormais appliquées par le système : à l'aube
(`resoudreNuit()`), dont `messager` (le mot écrit par l'expéditeur, `action.texte`, remis au seul destinataire), ou de jour
(`annuler-vote` : le Juge de paix, voir §5). Ce que le système ne connaîtrait pas reste raconté et arbitré par le MJ (`narrateur`).

Un même effet sert plusieurs rôles, réglés autrement (camp, cibles, usages, nuits, `apparence`, `victoireCle`) : un rôle nouveau
n'a pas besoin de code tant qu'il s'en tient à ces clés. Conventions de `resoudreNuit()` qui en découlent (contenu 0.6.0) :
- `tuer` par un rôle **hors meute** (Pêcheur de nuit, une fois par partie ; Dame du gué, une nuit sur deux) : cause `nuit` (pas de
  crocs pour le Tanneur), arrêté par la porte de la Gardienne des clés, un remède ou une absence (Passeur, Grange), **pas** par la
  garde du Garde du pont, le verrou, l'asile de la Chapelle ni la Taverne (réservés aux attaques de loup) ; il atteint les solitaires
  que la meute ne peut pas tuer ;
- `proteger` : la garde (Garde du pont) ne vaut que contre la meute (et la peste) : ni poison, ni feu, ni harpon, ni noyade, ni
  morsure ; la Gardienne des clés ferme une porte (`gardienne-des-cles`) : elle arrête aussi le harpon, la noyade et la morsure ;
- `tuer` par un loup seul à `nuit.tantQueMeuteEntiere` (Loup affamé, ordre 42) : chaque nuit tant qu'aucun mort n'était de la meute
  (`meuteEntiere`, nuit.mjs : un loup, un mordu) ; une autre victime que la proie de la meute, jamais un loup ;
- `mordre` (Louve mère) : la proie de la meute est infectée (camp « meute », rôle et pouvoir de nuit gardés) ; la garde ne l'empêche
  pas, une porte que la meute ne passe pas (asile, Taverne, verrou, clé de la Gardienne) si ; un mordu n'est pas une victime : ni remède
  possible, ni nom donné à l'Herboriste ;
- `remede` (Herboriste, `nuit.cibles: 2`) : une cible victime reçoit le remède, une autre le poison ; les deux la même nuit ; une
  fiole de chaque sorte par partie ; `fiolesVides` : une entrée par fiole restée bouchée (l'usage est rendu) ;
- `epier` (Enfant de la brume) : elle apprend le nom des loups sortis chasser (`EpierLoups`) ; surprise (`action.surprise`, sinon
  `chanceEpier`), c'est elle la proie de la meute (cause secrète `epie`), prise dehors : ni garde ni porte, un remède si ;
- `voir-role` (Liseuse de cendres) : `roleApparent` — la carte du joueur et le camp de cette carte (un mordu garde sa carte du Village) ;
  une apparence montre le rôle simple de ce camp (`nomsApparents` : « Villageois », « Loup de Brumecombe ») ; le masque du Carnaval,
  celui du camp inverse ; une Liseuse rêvée (Somnambule) lit « Villageois » sur un loup, « Loup de Brumecombe » sur tout autre ;
  message `VoirRole` (« Les cendres parlent : X est « rôle », du camp « camp » ») ;
- `voir-actif` avec une cible (Loup des roseaux) : « a agi / n'a pas bougé cette nuit » ; sans cible (Ermite) : un nom tiré au hasard
  parmi ceux qui ont agi ; un loup qui vise une maison y entre (la lanterne le démasque) ;
- `apparence` : camp montré aux visions `voir-camp` (Loup déguisé : `village` ; Louvetier : `meute`) ; le Cimetière et les salons
  suivent le camp réel. Le masque du Loup déguisé tombe (`masquesQuiTombent`, jour.mjs) quand il est le plus désigné d'un vote
  d'exécution sans être condamné (égalité non tranchée, majorité manquée, vote annulé par le Juge de paix) : sa fiche perd
  l'apparence (""), le narrateur le note (`Deguise.MasqueTombe`), le loup l'apprend (`Deguise.Carnet`) ;
- `victoireCle: "dernier-survivant"` (Pyromane, Dame du gué) : la meute ne peut pas le tuer ; le village ne gagne pas tant qu'il vit ;
- `victoireCle` du Pacte, étape 3b : `premier-tour` (Feu follet), `tous-charmes` (Joueur de vielle), `autre-groupe` (Illuminé),
  `seul-survivant` (Loup pâle : un loup, avec son texte de victoire ; il ne gagne jamais avec la meute).

## 5. Pouvoirs de jour (`logique/jour.mjs`)

Désignés par la clé du métier, du rôle ou du bâtiment. Moments : « au matin » = phases `aube`/`jour` (et, pour Chasseresse,
Ramoneuse, Colporteur de nouvelles et Tanneur, le jour qui suit une nuit résolue) ; « pendant le jour » = `aube`/`jour`/`vote`.
Un effet posé de jour vaut pour la nuit suivante (`jour.effets[].nuit = tour + 1`). Tous les métiers sont publics : leur usage
est annoncé au chat avec le nom de celui qui agit.

| Clé | Cible | Effet |
| --- | --- | --- |
| `forgeron` | 1 (soi compris) | verrou : la première attaque de loup contre la maison échoue (poison et feu passent) |
| `meuniere` | — | annonce le nombre de loups vivants |
| `garde` | 1 (pas soi) | gardé à l'œil : la nuit suivante, il ne vise que sa maison ; un loup gardé ne chasse pas |
| `cure` | 1 (soi compris) | béni à vie : plus de silence (hurlement, lame de la Forge) ; parle le premier |
| `chasseresse` | 1 | annonce si le joueur a quitté sa maison la nuit passée (bilan secret ; la meute qui chasse sort) |
| `aubergiste` | 1 (soi compris) | gîte à la Taverne : la meute n'y tue pas (règle de la Taverne si elle est en jeu, un des 3 lits) |
| `apothicaire` | 1 réduit au silence | lui rend la voix |
| `colporteur-de-nouvelles` | — | annonce un indice vrai et flou sur la nuit (`indiceFlou`, ne nomme personne) |
| `tisserande` | 1 | ruban : si le porteur est en tête d'un vote d'exécution, la clôture prolonge le vote d'une minute (une fois) |
| `passeur` | 1 (soi compris) | hors d'atteinte : ni visité (meute, poison, visions), ni brûlé ; n'agit pas |
| `tanneur` | 1 mort de la nuit | annonce « traces de crocs » (meute, épié) ou non, d'après la vraie cause |
| `maitresse-d-ecole` | 1 (le premier) | l'appel : 30 s chacun, dans l'ordre des maisons à partir du joueur choisi |
| `ramoneuse` | 1 vivant (soi compris) | annonce si sa maison a reçu de la visite la nuit passée (`bilan.visites` secret : proie de la meute, cibles des pouvoirs hors soi) ; ni qui, ni pourquoi |
| `eclusiere` | — | écluse fermée (effet `ecluse`, une par nuit) : la nuit suivante, `pontBloque` comme le Pont, même sans lui ; la meute (et un loup qui tue seul) ne vise aucune maison de l'autre rive |
| `juge-de-paix` | — | juste après le dépouillement d'un vote d'exécution, avant l'exécution : se révèle, le vote se rouvre ; le Loup déguisé le plus désigné du vote annulé perd son masque |
| `sonneur` | — | une fois, pendant le jour : à l'aube ou au débat (le prochain vote d'exécution), ou pendant un vote d'exécution ouvert (hors Banc) : se révèle, le vote désigne deux condamnés (`voteDoubleDemain` ou `vote.double`) |
| `conteuse` | 1 (pas soi) | deux minutes sur ce joueur, qui ne peut pas répondre ; annoncé sans nommer la Conteuse |
| `greffier-begue` | — | une fois, pendant un vote d'exécution ou juste après qu'il a condamné : signe SECRET ; le second vote s'ouvre quand les condamnés sont tombés (usage pris alors) ; refusé sans sagesse |
| `taverne` | soi | dort à la Taverne (3 lits) : la meute n'y tue pas, sauf si un loup y dort (alors sans protection) |
| `forge` | soi | une lame par partie : la meute qui l'atteint y laisse du sang, un loup chasseur réduit au silence |
| `grange` | soi | une fois par joueur, deux par nuit : hors d'atteinte |
| `puits` | soi, mort de ce tour | un dernier mot de dix mots au plus, une fois par partie |
| `chapelle` | 1 (le village) | asile (une fois par jour, jamais deux nuits de suite) : la meute n'y entre pas ; vote `objet: "chapelle"` |

À l'aube, sans action : **Moulin** (la Meunière vivante apprend en secret le nombre de loups ; sans elle, annonce publique les
matins pairs), **Lavoir** (indice flou public), **Cimetière** (sans révélation à la mort : camp des morts pas encore annoncés),
**Pont** (maisons 13 à 18 ; après une proie tuée sur l'autre rive, la meute ne peut pas y chasser la nuit suivante ; l'écluse de
l'Éclusière a le même effet, Pont en jeu ou non), **Gibet**
(majorité absolue, inchangé).

## 6. Ce qui reste visible, et pourquoi (0.9.0)

Foundry v14 livre à TOUS les navigateurs les documents (acteurs et leurs objets, journaux, messages de chat, chuchotements compris),
les réglages monde et chacune de leurs modifications (avec son instant) ; le serveur ne filtre que les messages de socket adressés
(`recipients`). D'où la règle : **rien de secret dans un document, un réglage monde ou le chat ; le secret voyage par le socket, à
un seul, et se range chiffré dans le coffre.** L'essai `essais/non-fuite.test.mjs` sérialise, pour chaque joueur, tout ce qu'il
reçoit pendant des parties complètes (documents, réglages monde, chat, socket qui lui est adressé) et vérifie qu'aucun rôle, camp,
choix ni secret d'autrui n'y figure avant sa révélation publique.

**Où vit chaque chose**

| | Qui le reçoit | Ce qu'il contient |
| --- | --- | --- |
| Documents `villageois` | tous | nom, image, maison, vivant, révélé, silence, joueur, compagnon, notes (sans bloc « secret » : retiré à la création et à la modification, `scripts/garde.mjs`, puisque le document entier part chez tous) ; le **métier** (objet et usages : les métiers sont publics, leur usage est annoncé) ; l'**objet `role` et `system.camp` seulement une fois révélés** (et pour tous à la fin, avec `amoureux`). Propriété : LIMITED pour tous, OBSERVER pour son joueur ; personne d'autre que le MJ ne le modifie (serveur, plus `scripts/garde.mjs`). |
| Réglage monde `partie` | tous | l'état PUBLIC (§1) : phase, tour, qui a voté (pas pour qui), résultats des votes clos, morts et cause publique, effets du jour annoncés, Bailli, Registre, présage, gens de passage (rôle public), Banc, compte du deuil, veillée de fête (sa clé, la neige, le masque du défilé), la Petite tablée (le mode, une règle : jamais de quel côté l'ombre est tombée), chronique publique. Récrit seulement s'il change : jamais par un choix de nuit. |
| Réglage monde `coffre` | tous, chiffré | TOUS les secrets de la partie, scellés avec la clé du coffre du MJ IA. Écrit aux moments publics (phase, aube résolue, vote clos, mort, arrivée, départ, distribution, victoire), au battement (une fois par minute pendant une partie, même sans changement, vecteur neuf) et avant de quitter la page ; jamais au rythme de la nuit. |
| Réglages client du MJ (`secrets`, par [monde][userId]) et sa mémoire | le MJ actif | l'état complet : fiches (rôle, camp, amoureux, protections), choix de la nuit et bilan, votes en cours, primes, fioles, aspergés, vraies causes, carnets, composition, peste, masques, rêves, Bonne étoile, autel, pouvoirs du deuil, Pont bloqué, cloche à venir, secrets de fête (masque, présent, promis). |
| Socket, à un seul (`recipients`) | son joueur | sa fiche (`fiche`), sa carte de rôle et son carnet (`secret`, `carnet`), ses demandes (`demande`, `annuler`), son vote (`monVote`), ses refus (`avis`), sa ligne des salons (`salon` : la meute à un loup seulement, la nuit), les mots relayés (`parole`), mort qui voit tout : les rôles des autres (`vus`) ; ses parts de clé (canal du MJ IA). |
| Réglage client du joueur (`carnet`, par [monde][userId]) | lui | ce qu'il a reçu par le socket (carnet, fiche, prime, vote, vue de mort). |
| Chat | tous | annonces publiques, récit de fin ; aucun chuchotement du système ni du MJ IA aux Veillées ; pendant une partie, un joueur ne chuchote plus (relais du MJ, ou refus). |

**Le coffre** (`scripts/coffre.mjs`) est celui du MJ IA (`lakour-mj-ia/scripts/coffre.js`, `coffre-logique.js`), toujours actif dans ce
monde ; sans lui, aucune partie ne se distribue. Clé AES-GCM 256 bits chez le MJ (réglage client du moteur, par [monde][userId]) ;
**aux Veillées, aucune part n'est confiée aux joueurs** (moteur 0.40.1 et suivants : deux loups pourraient réunir les leurs) ; la clé
ne se retrouve que par la **clé de secours** du MJ (exigée : rappel à chaque chargement tant qu'elle n'est pas téléchargée) et le
passage de clé d'un autre MJ ; une clé déjà partagée avec des joueurs est renouvelée une fois. Dans les autres mondes, partage de
Shamir à seuil = majorité des porteurs (jamais moins de 2), une part par compte joueur, envoyée par le MJ ACTIF seul,
gardée par [monde][userId][id de clé] et **accusée** (le compte devient porteur) ; rendue au seul MJ actif ; clé reconstituée
vérifiée par son **empreinte SHA-256** publiée au trousseau ; **renouvellement transactionnel** (un compte créé, supprimé ou qui change
de rôle : la nouvelle clé n'entre en vigueur qu'une fois ses parts accusées par son seuil ; le coffre des Veillées est rescellé
avant, par `siRenouvele`) ; **passage de clé** d'un MJ connecté au MJ actif ; **clé de secours** exportée et réimportée par le MJ
(fenêtre du coffre) ; **avertissement** quand les porteurs ne suffisent pas ou qu'il n'y a qu'un ou deux comptes joueurs (comptes
probablement sans mot de passe : la clé de secours est alors le seul recours sûr).

**Révision du coffre et changement de MJ actif** (relecture 7). Le réglage `coffre` est `{ partie, rev, chiffre, id, iv, donnees }` :
`rev` (en clair, croissante) est la révision ; les secrets du MJ gardent `revCoffre` et `ivCoffre` du dernier coffre qu'il a scellé ou
ouvert (la révision est notée chez lui AVANT l'écriture du réglage). Ses secrets sont **à jour** si c'est ce coffre (même vecteur) ou
s'ils sont STRICTEMENT plus récents (`revCoffre > rev` : à révision égale, un autre contenu — deux scellements calculés depuis la même
révision — n'est pas à jour) ; le coffre est relu juste avant d'écrire (changé entre-temps : rien n'est écrit, il est rouvert). On ne scelle que des secrets à jour ; sinon le coffre est rouvert (le MJ ne
joue jamais sur des secrets périmés : ni fiches, ni état complet). Un MJ actif rechargé (F5) retrouve secrets et révision : il
rescelle comme avant. Un coffre plus récent qui arrive (réglage changé) est rouvert. Changement de MJ actif (`userConnected`, MJ
compris) : celui qui perd la main attend la fin des écritures en cours (elles s'arrêtent sans rien écrire : seul le MJ actif écrit,
vérifié dans la file avant et après chaque modification), scelle aussitôt (passation, `api.coffre.scellerEnPartant` du moteur) puis
vide sa mémoire ; des secrets écrits sans leurs fiches ne passent jamais pour à jour ; celui
qui la prend relit son navigateur et, s'il n'est pas à jour, cherche le coffre (clé du moteur, passage de clé
d'un autre MJ connecté ou clé de secours réimportée ; aux Veillées, aucune part des joueurs). Une nouvelle partie (distribution, « Rejouer », remise à zéro) oublie les parts attendues de l'ancienne ; un
secret rouvert qui n'est pas de la partie publique est refusé. Après un scellement avec le moteur, l'ancienne clé `cleCoffre` (avant
0.9.0) de ce navigateur est effacée. Hook local `lakourLoups.secrets` : l'attente des secrets commence ou finit (alerte de la Table ;
le MJ IA, par `api.ecritureBloquee()`, se met en pause).

**Ce qui reste visible, et pourquoi**
- **Ce qui est public par la règle** : qui a voté (pas pour qui, sauf un jour de foire), le résultat d'un vote clos et le Registre,
  les morts et leur cause publique (« dans la nuit » pour toute mort de nuit), les effets du jour annoncés, le Bailli, les présages,
  le rôle d'un gens de passage (pas son camp), la chronique publique ; les rôles révélés ; la veillée de fête en jeu, la neige du matin
  et le masque du défilé (un rôle que personne ne tient) ; à la fin, tout (rôles, camps, liens d'amour, peste noire, composition à
  l'historique, secrets de la veillée de fête).
- **Les veillées de fête** : le masque, le présent et les promis vivent dans les secrets du MJ (coffre) et au carnet des seuls
  concernés ; la meute apprend, au carnet de chaque loup, les promis et la porte où frappe une âme — jamais ce que l'âme a murmuré.
  Rien de nouveau n'est écrit la nuit : les tirages se font à la distribution et à l'aube.
- **Le rythme public** : l'instant des changements de phase, des votes, des morts annoncées est vu de tous (c'est le jeu) ; pendant
  la nuit, rien n'est écrit au monde (ni l'état public, ni le coffre hors battement, ni les coûts du MJ IA), donc ni le nombre de
  réveils, ni l'instant d'un choix, ni le nombre de loups IA ne se lisent. Le battement du coffre est régulier, chiffré, de taille
  arrondie à 4 Kio : il ne dit pas si quelque chose a changé.
- **Le coffre face à une coalition** : aux Veillées, aucun joueur ne garde de part de la clé : des joueurs complices ne peuvent pas
  la reconstituer. La contrepartie : sans la clé de secours (ou un autre MJ qui l'a), un navigateur du MJ perdu rend le coffre
  illisible. Protection restante : un mot de passe par compte (un compte pris est un joueur de plus, pas une clé).
- **L'activité que Foundry diffuse** (`User#broadcastActivity`, lu dans le client et le serveur 14.370) : le serveur relaie à TOUS
  les autres navigateurs, sans filtre ni droit, le curseur, les pings, la règle, les cibles, les déplacements prévus, le voyant
  « parle » de la voix (`av.speaking`, à chaque changement) et l'état A/V, avec l'heure de l'activité (même un message vide) ; les
  droits `SHOW_CURSOR`, `SHOW_RULER`, `PING_CANVAS` ne sont vérifiés que par l'émetteur. Chez un joueur, la nuit (phase publique
  ou ligne des salons de nuit) et tant qu'il a un choix secret en cours, `scripts/activite.mjs` n'en laisse rien partir ; à la
  tombée de la nuit, chacun envoie le même effacement (curseur, règle, voyant éteint), au matin une seule resynchronisation de
  la voix, une fois la ligne des salons arrivée : un loup et un villageois envoient les mêmes messages
  (`essais/activite-nuit.test.mjs`). Restent visibles : la scène affichée, et l'activité d'un MJ (qu'il évite de pointer un jeton
  la nuit). Ce n'est qu'une enveloppe dans le navigateur du joueur : qui la retire ne trahit que lui-même. Pour plus de sûreté, le MJ
  peut aussi réserver ces trois droits aux MJ (Configuration › Droits des utilisateurs) le temps d'une partie.
- **Le socket** : un message sans émetteur donné par le serveur (v14 le donne toujours) est refusé ; l'auteur déclaré
  (`userId`) ne compte jamais seul. Le HTML d'une entrée du carnet (d'un MJ, quel qu'il soit) est nettoyé par
  `foundry.utils.cleanHTML` avant d'être affiché.
- **Un MJ** (tout utilisateur au rôle MJ) est de confiance par construction : il peut devenir MJ actif et rouvrir le coffre avec les
  joueurs. Un MJ qui n'est pas l'actif n'a ni les secrets ni la fiche de personne (il voit le public).
- **Le navigateur d'un joueur** : sa fiche, son carnet, sa vue de mort y sont en clair (localStorage, par monde et compte : un autre
  compte dans le même navigateur ne les affiche pas, mais quelqu'un qui ouvre les outils de développement de CE profil de navigateur
  les lit). Un tricheur peut, dans son navigateur, passer outre les refus de parole (son chuchotement part alors au serveur, donc à
  tous, avant que la garde du MJ ne le retire) et la coupure locale des voix (salons) ; il ne modifie aucun document de la partie.
- **Un mort qui voit tout** (réglage `mortsVoientTout`, sans Dernier souffle) reçoit les rôles et camps des autres : c'est la règle.
  Le canal écrit des morts se partage comme les salons vocaux : ceux qui gardent leur Dernier souffle entre eux, ceux qui l'ont rendu
  (et voient tout) entre eux ; les MJ lisent tout.
- **Jets de dés privés** pendant une partie : « pour soi » s'affiche chez son auteur seul, sans document ; « MJ seul » et « aveugle »
  partent au relais du MJ avec leur légende, formule et résultat (un jet aveugle n'est pas montré à son auteur). Aucun ne devient un
  message de chat (il serait livré à tous).
- **Le MJ IA** chuchote encore aux MJ ses avis techniques (erreur, budget atteint, pilote automatique) : rien sur les rôles ; ses
  fils (état du jeu, distribution) sont chiffrés (0.34.0) ; la préparation d'un scénario (hors Veillées) se chuchote au MJ.
- **Migration** : une partie commencée avant 0.9.0 (rôles et camps sur les documents, joueurs propriétaires) est reprise au
  « ready » du MJ actif (`api.migrer`) : fiches rangées dans les secrets et scellées d'abord, puis objets de rôle non révélés retirés, camps, amoureux et protections
  effacés des documents, chaque joueur observateur ; ses anciens secrets (réglage `secrets` à l'ancienne) et son ancien coffre (avec
  l'ancienne clé `cleCoffre` du MÊME navigateur) sont repris puis rescellés avec le moteur. Les anciennes parts (seuil 2, rendues à
  n'importe quel MJ) ne servent plus : chaque joueur les efface. Ce qui a été lu avant la mise à jour l'a été : la partie en cours
  n'est pas « rendue » secrète, seulement la suite.
