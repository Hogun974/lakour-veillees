# Contrat commun — « Les Veillées de Brumecombe »

Trois pièces écrites en parallèle doivent s'emboîter : le **système** `lakour-loups` (dossier `systems/lakour-loups/`),
le **module de contenu** `lakour-veillees` (dossier `modules/lakour-veillees/`) et le **MJ IA** (`modules/lakour-mj-ia/`).
Ce fichier est la seule source de vérité de leurs échanges. Plan général et intentions : `docs/plan-loup-garou.md`.
Foundry v14 (14.369). Tout en français, textes originaux (aucun texte, aucune carte de *Thiercelieux*).

## 1. Système `lakour-loups`

`systems/lakour-loups/system.json` : `id: "lakour-loups"`, `version: "0.4.0"`, `compatibility { minimum: "14", verified: "14.369" }`,
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
  camp: String = "village",  // "village" | "meute" | "solitaire" — camp ACTUEL (peut changer : morsure, échange)
  maison: String = "",       // repère de la carte où il dort (« Maison 3 », « Taverne »…)
  amoureux: String = "",     // id de l'acteur lié (lien d'amour), "" sinon
  silence: Boolean = false,  // ne peut pas parler au prochain débat
  protections: Number = 0,   // protections actives cette nuit (remises à 0 à l'aube)
  notes: HTML                // notes publiques (métier, ce qu'il a dit)
}
```
Son rôle est l'objet `role` qu'il possède (un seul) ; son métier, l'objet `metier` (un seul, public).

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
- réglage **`lakour-loups.secrets`**, de portée **`client`** (localStorage du navigateur du MJ, jamais envoyé au serveur) et mémoire
  du MJ actif : les **secrets**. Un rechargement du MJ les retrouve ; un autre navigateur ou un autre MJ ne les a pas (la Table de
  jeu le signale, la partie continue sans les choix déjà faits, les primes ni les fioles).

```
{
  partie: String,                  // identifiant de la partie (les secrets d'une autre partie sont ignorés)
  phase: "preparation" | "nuit" | "aube" | "jour" | "vote" | "fin",
  tour: Number,                    // n° de la nuit / du jour (1 = première nuit)
  composition: String,             // clé de composition utilisée
  batiments: [String],             // uuid des bâtiments en jeu
  batimentsCles: [String],         // leurs clés (« chapelle », « pont »…)
  vote: { ouvert, numero, objet: "execution" | "chapelle", candidats: [acteurId],
          votes: { acteurIdVotant: acteurIdCible },   // SECRET jusqu'à la clôture
          exprimes: [acteurId],                        // public : QUI a voté, pas pour qui
          double, finit (horodatage ms, 0 = sans minuteur), duree, majoriteAbsolue,
          prolonge: acteurId (ruban de la Tisserande), resultat: { decompte, elu, elus, votes, egalite, objet, numero, tour } (public) },
  nuit: { actions: [ { acteurId, roleCle, cibles: [acteurId], quand, effet?, texte? } ] },   // SECRET
  nuitPrecedente: { actions, bilan: { sorties, visites, victime, loup, sauves, attaques } },  // SECRET
  asperges, primes, fioles,        // SECRETS
  morts: [ { acteurId, tour, phase, cause } ],   // cause publique : "nuit" pour meute / poison / feu / épié (vraie cause SECRÈTE)
  vainqueur: "" | "village" | "meute" | <acteurId d'un solitaire> ,
  historique: [ { tour, phase, texte } ],        // public (ce qui a été annoncé)
  journalSecret: [ { tour, phase, texte } ],     // SECRET : chronique du MJ (actions de nuit, messages secrets envoyés)
  carnets: { acteurId: [ { id, texte | html, titre, tour, phase, quand } ] },   // SECRET : carnet secret de chaque joueur
  jour: { effets: [ { type, acteurId, cible, nuit } ], benis: [acteurId], rubans: [acteurId], puits, conteuse, appel },   // public
  pont: { bloqueNuit: Number }, cimetiere: [acteurId]   // public
}
```
`etat()` rend l'état complet chez le MJ actif, l'état public partout ailleurs.

### Socket « system.lakour-loups » : toujours des destinataires

Le serveur v14 (`server/dist/server/sockets.mjs`, `handleCustomSocket`) livre `game.socket.emit(canal, message, { recipients: [userIds] })`
aux seuls navigateurs de ces utilisateurs (sans `recipients` : à tous les autres) et ajoute l'identifiant de l'émetteur, tiré de la
session, en second argument du récepteur. Le système s'en sert ainsi :
- MJ → un joueur (`recipients: [son userId]`) : `demande` (choix de nuit, ou `mode: "texte"` pour le mot du Messager), `annuler`,
  `secret` (une entrée de son carnet), `carnet` (tout son carnet, sa prime, son vote en cours), `monVote` (accusé), `avis` (refus),
  `salon` (sa ligne des salons vocaux, §1 « Salons vocaux ») ;
- joueur → MJ actif seul : `reponse`, `vote`, `jour` (pouvoir de jour), `bonjour` (« renvoie-moi mon carnet », et ma ligne des salons) ;
- MJ → tous : `hook`, avec des arguments publics seulement ;
- l'émetteur donné par le serveur fait foi : un message dont `userId` le contredit est rejeté ; ce qui s'adresse à un joueur
  n'est accepté que d'un MJ.

Le **carnet secret** remplace le chuchotement pour tout ce qui est secret (carte de rôle, ce qu'un rôle apprend la nuit, mot du
Messager, Moulin pour la Meunière) : le MJ le garde dans ses secrets, le joueur le range dans son navigateur (réglage client
`lakour-loups.carnet`) et peut le relire (Table de jeu, bouton « Carnet secret »).

### API : `game.lakourLoups` (prête au `ready`)

Toutes les fonctions qui écrivent ne marchent que chez le MJ actif ; ailleurs elles lèvent une erreur claire.
```
etat()                                   -> copie de l'état (ci-dessus)
villageois()                             -> acteurs villageois (vivants et morts), avec .role et .metier (objets possédés)
distribuer({ roles: [uuid], metiers: [uuid], joueurs: [userId], compagnons: [nom], maisons: [String] })
                                         -> crée/recycle un villageois par joueur, lui donne un rôle et un métier au hasard
                                            (mélange), règle camp et maison, phase "preparation", tour 0 ; renvoie
                                            [{acteurId, userId, compagnon, roleCle}]. compagnons : un villageois sans joueur
                                            (system.compagnon) par nom, tiré comme les joueurs ; les compagnons d'une partie
                                            précédente sont repris, les autres retirés du village.
                                            Chaque joueur reçoit son rôle dans son carnet secret et voit sa fiche (OWNER), personne
                                            d'autre. Maisons par défaut : maisonsDuVillage(n) (un tiers sur l'autre rive, 13 à 18).
changerPhase(phase)                      -> écrit la phase (tour + 1 quand on passe à "nuit"), remet protections/silence selon la phase,
                                            appelle Hooks.callAll("lakourLoups.phase", phase, etat)
ordreDeNuit()                            -> [{ roleCle, acteurIds }] : rôles vivants à réveiller cette nuit, dans l'ordre (meute groupée)
demanderAction({ acteurId, invite, candidats: [acteurId], nombre, delai })
                                         -> Promise<[acteurId]> : ouvre chez le joueur de cet acteur une fenêtre de choix
                                            (socket "system.lakour-loups") ; résout avec son choix, [] s'il passe ou au délai (ms).
                                            Pour la meute : demanderActionMeute({ invite, candidats, delai }) -> vote des loups vivants,
                                            résolu à la majorité (égalité : premier choisi).
                                            Seuls chassent les loups libres (ni gardés à l'œil, ni hors d'atteinte).
candidatsDeNuit({ acteurId, roleCle })    -> [acteurId] que ce rôle (ou "meute") peut désigner cette nuit, effets du jour compris
demanderTexte({ acteurId, invite, delai, max }) -> Promise<String> : une phrase écrite chez ce seul joueur ("" s'il passe)
noterAction({ acteurId, roleCle, cibles, effet?, texte? })  -> ajoute à etat.nuit.actions (texte : le mot du Messager)
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
ouvrirTable()                             -> ouvre la Table de jeu (fenêtre ApplicationV2) chez soi
```
resolveurs.compagnon                     -> fonction fournie par le MJ IA : (demande) -> [acteurId] (choix de nuit, vote) ou
                                            texte (mode "texte"). demande : { type: "demande" | "vote", mode?, id, acteurId,
                                            acteurNom, invite, candidats: [{ id, nom, img, maison }], nombre, max?, delai, objet?,
                                            numero? }. Voir « Compagnons IA » ci-dessous.
Hooks (tous les navigateurs, arguments publics) : `lakourLoups.phase`, `lakourLoups.vote` (vote reçu : `{ votant }` seulement,
jamais le choix), `lakourLoups.voteClos` (résultat public), `lakourLoups.aube` (`{ tour, morts, annonces }`), `lakourLoups.jour`
(pouvoir de jour appliqué ; sans l'acteur pour la Conteuse), `lakourLoups.elimination` (cause publique), `lakourLoups.victoire`.
Chez le MJ seulement : `lakourLoups.action` (action reçue), `lakourLoups.secret` (message secret envoyé). Chez un joueur :
`lakourLoups.prive` (son carnet, sa prime ou son vote a changé).

Ajouts 0.3.0 (MJ actif, sauf mention) :
```
nouvellePartie({ memesJoueurs = true, joueurs, compagnons, composition, roles, niveau, graine })
    -> { partie, joueurs: [{ userId, nom, acteurId }], compagnons: [{ nom, acteurId }],
         composition: { cle, libelle, niveau, roles: [cle], batiments: [cle], somme?, verdict? } }
    Remet tout à zéro (état public et secrets, vivants, non révélés, sans silence, rôles et métiers retirés) et redistribue avec
    les MÊMES participants : mêmes humains (memesJoueurs ; sinon `joueurs` [userId] ou les connectés), mêmes villageois
    compagnons (mêmes noms ; `compagnons` [acteurId] pour en choisir). Composition : `roles` (clés ou noms) si donnés, sinon la
    composition prête `composition`, sinon équilibrée (`composer`, niveau, historique pour varier), à défaut les rôles
    précédents rebattus. Plateau remis (jetons neutres devant les maisons, statuts retirés, scène active, lumière de jour).
    Hook lakourLoups.nouvellePartie : chez le MJ ce résumé ; chez tous { partie, joueurs: n, compagnons: n, composition: { cle, libelle } }.
reveiller(roleCle, { delai })  -> réveille un rôle de la nuit (ou "meute") comme loups_nuit : candidats, demande, mot du
                                  Messager, noterAction ; reveilsEnCours() -> [roleCle] ; hook lakourLoups.reveil (MJ)
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

### Salons vocaux (logique/salons.mjs, scripts/salons.mjs)

Avec la voix intégrée de Foundry (A/V), réglage monde **`salonsAutomatiques`** (« Salons vocaux automatiques », vrai par défaut) :

| Qui parle            | Jour (`aube`, `jour`, `vote`) | Nuit (`nuit`) |
|----------------------|-------------------------------|---------------|
| un vivant            | tous (vivants et morts)       | personne, micro coupé — sauf un loup : les loups (et les morts si `mortsVoientTout`) |
| un mort (ou un spectateur sans villageois) | les morts seulement | les morts seulement |
| un réduit au silence | personne pendant `jour` et `vote` (il parle à l'aube) | personne |

Le MJ (tout utilisateur MJ, même s'il incarne un villageois) entend tout et parle à tous. `preparation` et `fin`, ou le réglage
décoché : tout le monde parle à tout le monde. Est loup le villageois dont le camp ACTUEL est `meute` : les six loups du contenu
(Loup de Brumecombe, affamé, déguisé, Louve mère, hurleur, flaireur), le mordu (à l'aube, `changerCamp` : il est à la tanière
la nuit suivante), pas un loup dont le Colporteur a pris le rôle ; le rôle ne sert que si le camp manque.
Fonction pure : `audibilite(etatPublic, secretsMJ, locuteur, table)` -> `{ peutParler, auditeurs, acteursAuditeurs, salon }`, avec
`table = { villageois, utilisateurs: [{ id, mj }], mortsVoientTout, automatique, loupsConnus }` (`secretsMJ` null : aucun camp connu
hors `loupsConnus`) ; `ligneDe(…, userId, table)` -> `{ phase, salon, peutParler, auditeurs, entend, loups? }` ; salons : `mj`,
`libre`, `village`, `taniere`, `morts`, `nuit`, `silence`.

Chez le MJ actif, à chaque changement, chaque joueur connecté reçoit sa seule ligne (socket `salon`, `recipients: [userId]`,
seulement si elle a changé ; à la connexion et sur `bonjour`, toujours). `entend` et `auditeurs` ne nomment, la nuit, aucun loup
pour un non-loup ; `loups` (acteurIds de la meute) n'est donné qu'à un loup, la nuit. Rien dans un réglage monde ni un document.

Dans chaque navigateur non MJ, d'après sa ligne (code client v14 lu : `AVMaster`, `SimplePeerAVClient`, `CameraViews`) :
- les flux de ceux qu'il ne doit pas entendre sont coupés LOCALEMENT : pistes du flux distant (`getMediaStreamForUser`) désactivées
  (son et image), `<video class="user-camera">` muet, voyant « parle » (`ui.webrtc.setUserIsSpeaking`) forcé éteint ; réappliqué
  à chaque rendu des caméras (`renderCameraViews`, `renderCameraPopout`, `rtcSettingsChanged`) ;
- son micro, quand il doit se taire : `game.webrtc.broadcast` et `game.webrtc.client.toggleBroadcast` enveloppés sur l'instance
  (toujours `false` : ni pousser pour parler, ni détection de voix, ni « toujours », ni voyant chez les autres) ;
- aucun réglage A/V persistant n'est écrit (ni `muted`, ni `volume`) ; tout est rendu quand la ligne le permet (préparatifs,
  fin, réglage décoché), si l'A/V est désactivé, et au départ du monde (`beforeunload`). Le MJ n'est jamais coupé.
- Bandeau : « 🔇 La nuit, silence », « 🐺 Tanière : tu parles aux loups », « 👻 Tu parles aux morts », « 🔇 Réduit au silence » ;
  rien sans A/V (mode « Désactivé ») ni pour un vivant le jour.
Limite : appliqué dans chaque navigateur (contournable par un tricheur dans la console), comme le reste (§6). Le système gère seul
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

Parole (scripts/parole.mjs) : un mort n'écrit plus au chat public (canal des morts : chuchoté aux morts et au MJ, réglage
`canalDesMorts`) ; un villageois réduit au silence se tait en phases « jour » et « vote » ; le MJ n'est jamais bloqué. Refus
dans le navigateur de l'auteur (`preCreateChatMessage`), garde chez le MJ actif (`createChatMessage` : message retiré).
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
- **Fiche de villageois** : rôle et pouvoir visibles seulement du propriétaire et du MJ ; métier public ; état (vivant, révélé).
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
- La carte du village : une maison par joueur (jusqu'à 18, repères « Maison 1 »… « Maison 18 »), la place du village (où l'on
  vote), et les 10 bâtiments (Chapelle, Moulin, Taverne, Gibet, Puits, Forge, Cimetière, Pont, Lavoir, Grange) comme éléments
  nommés, pour que le MJ IA pose les jetons (« devant la chapelle »).

## 3. MJ IA

`CONTENUS["lakour-loups"] = "lakour-veillees"` ; adaptateur `lakour-loups` dans `adaptateurs.js` (pas de jet de dés : `lancer`
lève une erreur claire ; `resumer` donne nom, vivant/mort, métier, rôle) ; outils de narrateur qui appellent `game.lakourLoups`.
Le MJ IA ne révèle jamais un rôle secret en dehors d'un message privé au joueur concerné. Ce que les rôles apprennent la nuit, il
le remet par `envoyerSecret` (carnet secret), jamais par un chuchotement du chat.

Outils `loups_*` (section « Narrateur des Veillées » de `modules/lakour-mj-ia/scripts/outils.js`, `systemes: ["lakour-loups"]`) :
`loups_composer`, `loups_distribuer` (maisons sur les deux rives), `loups_nuit` (candidats de `candidatsDeNuit`, mot du Messager
par `demanderTexte`, messages par `envoyerSecret`, annonces de l'aube rendues au narrateur), `loups_vote` (objet `chapelle`, ruban,
rappel du Juge de paix), `loups_eliminer` (refuse d'exécuter « vote » pendant un vote rouvert), `loups_effet`, et **`loups_jour`**
(action `lister` : pouvoirs de jour possibles ; action `utiliser` : applique celui qu'un joueur annonce, via `agirDeJour`).

## 4. Clés d'effet (automatisables par le système, sinon arbitrées par le narrateur)

`tuer`, `proteger`, `voir-camp`, `voir-role-mort`, `eclairer` (démasque un loup qui entre), `silence`, `vote-double`,
`annuler-vote`, `remede`, `poison`, `lien-amour`, `echanger-role`, `mordre` (rejoindre la meute), `emporter` (à sa mort),
`asperger` / `embraser`, `epier`, `messager`, `voir-actif`. Toutes sont désormais appliquées par le système : à l'aube
(`resoudreNuit()`), dont `messager` (le mot écrit par l'expéditeur, `action.texte`, remis au seul destinataire), ou de jour
(`annuler-vote` : le Juge de paix, voir §5). Ce que le système ne connaîtrait pas reste raconté et arbitré par le MJ (`narrateur`).

## 5. Pouvoirs de jour (`logique/jour.mjs`)

Désignés par la clé du métier, du rôle ou du bâtiment. Moments : « au matin » = phases `aube`/`jour` (et, pour Chasseresse,
Colporteur de nouvelles et Tanneur, le jour qui suit une nuit résolue) ; « pendant le jour » = `aube`/`jour`/`vote`.
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
| `juge-de-paix` | — | juste après le dépouillement d'un vote d'exécution, avant l'exécution : se révèle, le vote se rouvre |
| `conteuse` | 1 (pas soi) | deux minutes sur ce joueur, qui ne peut pas répondre ; annoncé sans nommer la Conteuse |
| `taverne` | soi | dort à la Taverne (3 lits) : la meute n'y tue pas, sauf si un loup y dort (alors sans protection) |
| `forge` | soi | une lame par partie : la meute qui l'atteint y laisse du sang, un loup chasseur réduit au silence |
| `grange` | soi | une fois par joueur, deux par nuit : hors d'atteinte |
| `puits` | soi, mort de ce tour | un dernier mot de dix mots au plus, une fois par partie |
| `chapelle` | 1 (le village) | asile (une fois par jour, jamais deux nuits de suite) : la meute n'y entre pas ; vote `objet: "chapelle"` |

À l'aube, sans action : **Moulin** (la Meunière vivante apprend en secret le nombre de loups ; sans elle, annonce publique les
matins pairs), **Lavoir** (indice flou public), **Cimetière** (sans révélation à la mort : camp des morts pas encore annoncés),
**Pont** (maisons 13 à 18 ; après une proie tuée sur l'autre rive, la meute ne peut pas y chasser la nuit suivante), **Gibet**
(majorité absolue, inchangé).

## 6. Ce qui reste visible (limites de Foundry v14)

- Les **objets `role`** sont des objets possédés par l'acteur : Foundry les livre à tous les navigateurs ; un joueur curieux lit
  tous les rôles dans la console (`game.actors`). Les cacher demanderait de sortir le rôle des documents du monde (le garder dans
  les secrets du MJ et l'envoyer à son seul joueur), ce qui touche aussi l'adaptateur du MJ IA.
- Tout **message de chat**, chuchotement compris, est livré à tous : le système n'en chuchote plus, mais un message privé posté
  par un autre outil (ex. `message_prive` du MJ IA) reste lisible dans la console.
- Ce que l'état public garde par nature : qui a voté (pas pour qui), les effets du jour annoncés, les morts et leur cause
  publique, le résultat d'un vote clos, la chronique publique.
