// Résolution de la nuit, à l'aube. Logique pure.
//
// resoudreNuit({ villageois, actions, tour, asperges, precedentes, primes, fioles, hasard, chanceEpier, jour, nomsApparents })
//   villageois : [{ id, nom, vivant, camp, maison, amoureux, protections, role: { cle, nom, camp, effet, apparence, nuit } }]
//   actions    : [{ acteurId, roleCle, cibles: [id], effet? }]  — `effet` force la clé ; roleCle "meute" = choix de la meute
//                (le MJ IA note la même action pour chaque loup : la meute n'a qu'UNE victime, à la majorité) ;
//                roleCle "peste" = la victime de la peste noire (peste.mjs ; acteurId : le porteur, mort, ou "").
//                Une action aux cibles vides est un « je passe », sauf pour les rôles à nuit.cibles = 0.
//   asperges   : maisons déjà aspergées par le pyromane (ids des villageois), d'une nuit sur l'autre.
//   precedentes: actions de la nuit d'avant (protéger ou faire taire : jamais deux nuits de suite la même personne).
//   primes     : { chasseurId: cibleId } (le chasseur de primes apprend sa cible la nuit où il se réveille).
//   fioles     : { herboristeId: { remede: true, poison: true } } fioles déjà vidées (une de chaque par partie).
//   jour       : effets posés pendant le jour pour cette nuit (effetsDeLaNuit, jour.mjs) : { verrous, surveilles, asiles,
//                lames, horsDAtteinte, taverne, taverneEnJeu, benis, pontBloque, givre, etoiles }.
//                givre (Almanach des brumes) : aucune protection ni verrou ne tient cette nuit ; etoiles : [acteurId] protégés en
//                secret par le narrateur (la Bonne étoile, la première nuit) ; linceul (Glas du deuil) : rien n'arrête la meute ;
//                present (Veillée d'hiver, fetes.mjs) : acteurId dont le premier coup mortel de la nuit échoue (sortie.presentOuvert) ;
//                masque (Carnaval des masques) : acteurId que la première vision du Village (pas un regard de la meute) voit
//                du camp opposé ; le masque tombe alors (sortie.masqueTombe).
//   actions    : + { roleCle: "deuil", effet: "deuil", cibles: [id] } : la vision du Glas du deuil (le camp, à toute la meute) ;
//                une action de groupe (ni le guet ni l'éloignement du loup noté ne l'arrêtent) ; délivrée : sortie.deuil = la cible.
//   nomsApparents : { village, meute } les noms (dans la langue du monde) du rôle simple de chaque camp, ceux que voit la Liseuse
//                derrière une apparence (NOMS_APPARENTS par défaut : « Villageois », « Loup de Brumecombe »).
//   actions    : + { surprise: Boolean } sur l'action de l'Enfant de la brume, tirée quand elle est notée (api.noterAction) : la
//                meute l'a-t-elle surprise ? Absente : tirée ici (chanceEpier).
//   somnambules: [acteurId] qui rêvent leur rôle (somnambule.mjs) : leurs visions sont fausses ; rolesFactices : [nom de rôle]
//                parmi lesquels un Fossoyeur rêvé lit un faux rôle.
//   Le Pacte, étape 3a (pacte.mjs) : cercle (etat.cercle : les voisins du Furet et du Vieux Sergent) ; aieux : [acteurId] les Aïeux
//                qui ont déjà perdu leur première vie ; furets : [acteurId] les Furets qui ont perdu leur flair ; contamines :
//                [acteurId] les loups contaminés par le Vieux Sergent, qui meurent cette nuit ; sagessePerdue : le village a perdu sa
//                sagesse (les rôles du Village n'agissent plus).
// -> { morts, deces, sauves, revelations, messages, changements, asperges, fioles, fiolesVides, voteDouble, enAttente, narrateur,
//      annonces, bilan, pontFranchi }
//    annonces : [msg] publiques (la lame de la Forge) ; bilan : { visites, sorties, victime, loup, sauves, attaques } pour les
//    pouvoirs du matin (Chasseresse, Colporteur de nouvelles, Lavoir) ; pontFranchi : la meute a tué sur l'autre rive.
//    fiolesVides : herboristes dont aucune fiole n'a rien versé (fiole déjà vide, ou soi-même hors danger) : l'usage leur est rendu.
//    Le Pacte : aieux et furets (les listes à jour), plume (la cible de la plume noire de la Pie, "" sinon), contaminations
//    ([{ sergent, loup }] : le loup mourra la nuit suivante).
//    messages : [{ destinataire: acteurId | "mj", cle, texte, donnees }]
//
// Conventions tirées des rôles de lakour-veillees (un seul `effet` par rôle) :
// - Herboriste (effet "remede", deux cibles au plus) : une cible victime de la nuit reçoit le remède ; un autre joueur, le
//   poison. Elle peut verser les deux la même nuit ; chaque fiole ne sert qu'une fois par partie. Un mordu n'est pas une victime
//   (une infection n'est pas une mort) : rien à sauver chez lui ;
// - Pyromane (effet "asperger") : se désigner soi-même = embraser ; le feu passe les protections ; la meute ne peut
//   pas le tuer ;
// - Louve mère (effet "mordre") : elle désigne la proie de la meute ; celle-ci est mordue au lieu d'être tuée, et devient
//   loup en secret (camp « meute »), en gardant son rôle et son pouvoir de nuit. La garde du Garde du pont n'arrête que
//   l'attaque, jamais l'infection ; une porte que la meute ne passe pas (asile, Taverne, verrou, la clé de la Gardienne), si ;
// - Loup affamé (nuit.tantQueMeuteEntiere) : une seconde victime, seul, chaque nuit tant qu'aucun loup n'est mort ; ensuite
//   son action est ignorée. Un loup qui tue seul ne peut pas tuer un loup ;
// - Enfant de la brume (effet "epier") : si elle épie, elle apprend le nom des loups sortis chasser ; surprise (chanceEpier,
//   RISQUE_ENFANT), c'est elle que la meute dévore à la place de sa proie (cause secrète « epie ») : prise dehors, ni garde ni
//   porte ne la sauvent (un remède, si) ;
// - Liseuse de cendres (effet "voir-role") : le rôle d'un joueur (roleApparent : le Loup déguisé paraît « Villageois ») ;
// - Aïeul (effet "resister") : la première attaque de la meute (un loup qui tue seul, la peste aussi : rien ne doit les distinguer)
//   qui l'aurait tué ne le tue pas, en secret (seule la chronique du MJ le sait) ; un remède ou une garde qui le sauvent lui
//   laissent cette vie. La première morsure de la Louve mère compte comme cette attaque : elle ne l'infecte pas ;
// - Furet (effet "flairer") : le joueur désigné et ses deux voisins vivants (cercle.mjs, trioAutour) ; au moins un loup parmi eux
//   (tel que le voient les visions) : « oui », il garde son flair ; sinon « non », et il le perd pour toujours (furets) ;
// - Pie (effet "plume") : sa cible (ni elle-même) portera deux voix de plus au vote d'exécution du jour ; annoncée au matin ;
// - Vieux Sergent (effet "contaminer") : dévoré par la meute (cause « meute »), il contamine le premier loup vivant à sa gauche
//   (contaminations) ; ce loup meurt la nuit suivante (contamines, cause publique « contamine »), rien ne l'en protège ;
// - Lavandières, Bûcherons (effet "fratrie") : rien à résoudre (ils se reconnaissent au réveil : api.noterAction) ;
// - rôles à nuit.cibles = 0 (Ermite, Chasseur de primes) : leur réveil vaut action, même s'il n'a pas été noté ;
// - Messager (effet "messager") : cibles [expéditeur, destinataire], action.texte = le mot écrit par l'expéditeur ;
// - effets du jour : hors d'atteinte (Passeur, Grange) = ni visité ni agissant ; gardé à l'œil (Garde du guet) = ne vise
//   que sa maison ; asile (Chapelle) et Taverne = la meute n'y tue pas (Taverne : sauf si un loup y dort, et alors sans
//   protection) ; verrou (Forgeron) = la première attaque de loup échoue ; lame (Forge) = la proie blesse un loup ;
//   béni (Curé) = jamais réduit au silence ; Pont bloqué (ou écluse fermée par l'Éclusière) = la meute ne traverse pas
//   vers l'autre rive.
//
// - Peste noire (action "peste") : la victime est attaquée EXACTEMENT comme une proie de la meute (asile, Taverne, verrou,
//   protection, remède, absence, Pont, immunité des tueurs solitaires), mais aucun loup n'entre (ni lanterne, ni sang de la
//   lame, ni sortie) ; cause secrète « peste », publique « nuit » ; bilan.victime la compte, bilan.loup reste vide.
//
// Ordre : liens d'amour, protections, épier, attaques (meute, tuer), morsure, poison, feu, remède, contamination, éclairer,
// informations (camp, rôle, flair), plume, silence, échanges, cloche, chagrin en cascade, contamination du Sergent, emporter.
// Tout se joue sur l'état du début de nuit : un mort de la nuit agit encore cette nuit-là.

import { CLE_MEUTE, CLE_PESTE, CAUSES, EFFETS_AUTOMATISES, RISQUE_ENFANT } from "./constantes.mjs";
import { campInverse, roleFactice } from "./somnambule.mjs";
import { choisir } from "./hasard.mjs";
import { seReveille, agitAvecLaMeute, meuteEntiere } from "./nuit.mjs";
import { victoireCleDe } from "./victoire.mjs";
import { majoriteMeute } from "./votes.mjs";
import { surLAutreRive } from "./distribution.mjs";
import { CLE_DEUIL } from "./deuil.mjs";
import { trioAutour, premierAGauche } from "./cercle.mjs";
import { EFFET_AIEUL, EFFET_FURET, EFFET_PIE, EFFET_SERGENT, pouvoirPerdu, candidatsDeLaPlume } from "./pacte.mjs";

// Un mot porté par le Messager : une ligne, sans balises, 200 caractères au plus.
export function nettoyerMot(texte, longueur = 200) {
  return String(texte ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, longueur);
}

export function apparenceDe(v) {
  if (!v) return "village";
  if (v.role?.apparence) return v.role.apparence;
  // Repli (anciens objets sans le champ) : un rôle de la meute dont la clé dit « déguisé » se montre comme villageois. Un champ
  // vide (""), c'est un masque tombé (masquesQuiTombent) : la vérité.
  if (v.role && v.role.apparence === undefined && v.camp === "meute" && /deguis/.test(v.role.cle ?? "")) return "village";
  return v.camp;
}

// Le rôle simple de chaque camp, celui que la Liseuse lit derrière une apparence (noms français par défaut ; Foundry passe ceux
// du contenu du monde).
export const NOMS_APPARENTS = Object.freeze({ village: "Villageois", meute: "Loup de Brumecombe" });

// Le rôle qu'une vision de rôle (la Liseuse de cendres) lit sur un joueur : sa carte, { nom, camp } (le camp DU RÔLE : un mordu
// garde sa carte du Village, comme à la table). Une apparence différente du camp du rôle montre le rôle simple de ce camp : le Loup
// déguisé (apparence « village ») paraît « Villageois », le Louvetier (apparence « meute ») « Loup de Brumecombe ». Un masque
// tombé (apparence "") ne cache plus rien.
export function roleApparent(v, noms = NOMS_APPARENTS) {
  const n = { ...NOMS_APPARENTS, ...noms };
  if (!v?.role) return { nom: n.village, camp: "village" };
  const campDuRole = v.role.camp ?? v.camp ?? "village";
  // Sans le champ (anciens objets), seul le repli d'apparenceDe (le déguisé) compte.
  const app = v.role.apparence ?? (apparenceDe(v) !== v.camp ? apparenceDe(v) : "");
  if (app && app !== campDuRole) return { nom: n[app] ?? n.village, camp: app };
  return { nom: v.role.nom ?? v.role.cle ?? "?", camp: campDuRole };
}

export function effetDeLAction(action, acteur) {
  if (action.effet) return action.effet;
  if (action.roleCle === CLE_MEUTE || action.roleCle === CLE_PESTE) return "tuer";
  return acteur?.role?.effet ?? "";
}

// La Gardienne des clés : sa protection ferme la porte (la morsure n'entre pas), quand la garde du Garde du pont ne l'arrête pas.
const CLE_GARDIENNE = "gardienne-des-cles";

const msg = (destinataire, cle, texte, donnees = {}) => ({ destinataire, cle: `LAKOUR_LOUPS.Nuit.${cle}`, texte, donnees });
const sansCible = role => Number(role?.nuit?.cibles ?? 1) === 0;

export function resoudreNuit({ villageois = [], actions = [], tour = 1, asperges = [], precedentes = [], primes = {}, fioles = {}, hasard = Math.random, chanceEpier = RISQUE_ENFANT, jour = {},
  somnambules = [], rolesFactices = [], nomsApparents = {}, cercle = [], aieux = [], furets = [], contamines = [], sagessePerdue = false } = {}) {
  const noms = { ...NOMS_APPARENTS, ...nomsApparents };
  const reve = new Set(somnambules);
  const parId = new Map(villageois.map(v => [v.id, v]));
  // Le camp que voit une vision : l'apparence, retournée pour le porteur du masque du Carnaval.
  // par : celui qui regarde ; un loup (Loup flaireur, mordu qui lit pour la meute) n'est jamais trompé : il reconnaîtrait le porteur.
  // Le masque ne trompe qu'une vision : la première qui le perce le fait tomber.
  const vu = (id, par) => {
    const a = apparenceDe(parId.get(id));
    if (!id || id !== jour.masque || sortie.masqueTombe || parId.get(par)?.camp === "meute") return a;
    sortie.masqueTombe = true;
    sortie.messages.push(msg("mj", "MasqueTombe", `Le masque du Carnaval de ${nom(id)} a trompé une vision, puis il est tombé.`, { nom: nom(id) }));
    return campInverse(a);
  };
  const nom = id => parId.get(id)?.nom ?? id;
  const vivant = id => parId.get(id)?.vivant !== false && parId.has(id);
  const vivantsMeute = villageois.filter(v => v.vivant !== false && v.camp === "meute").map(v => v.id);
  const entiere = meuteEntiere(villageois);
  // Effets du jour.
  const hors = new Set(jour.horsDAtteinte ?? []);
  const surveilles = new Set(jour.surveilles ?? []);
  const asiles = new Set(jour.asiles ?? []);
  const taverne = new Set(jour.taverne ?? []);
  const verrous = new Set(jour.givre ? [] : jour.verrous ?? []);   // le givre de l'Almanach : aucun verrou ne tient
  const benis = new Set(jour.benis ?? []);
  const lames = new Set(jour.lames ?? []);
  const loupATaverne = Boolean(jour.taverneEnJeu) && [...taverne].some(id => vivant(id) && parId.get(id).camp === "meute");
  // Les loups qui chassent : ni gardés à l'œil, ni hors d'atteinte (« la meute chasse sans lui »).
  const peutChasser = vivantsMeute.filter(id => !hors.has(id) && !surveilles.has(id));

  const sortie = { morts: [], deces: [], sauves: [], revelations: [], messages: [], changements: [], asperges: [],
    fioles: JSON.parse(JSON.stringify(fioles ?? {})), fiolesVides: [], voteDouble: false, enAttente: [], narrateur: [],
    annonces: [], bilan: null, pontFranchi: false, deuil: "", presentOuvert: false, masqueTombe: false,
    aieux: [...new Set(aieux)], furets: [...new Set(furets)], plume: "", contaminations: [] };
  // Le Pacte : la place de chacun autour de la table (le Furet, le Vieux Sergent) ; les rôles du Village sans pouvoir.
  const placesDuCercle = { cercle };
  const sansPouvoir = role => pouvoirPerdu(sagessePerdue, role);
  const aieulEnVie = id => parId.get(id)?.role?.effet === EFFET_AIEUL && !sansPouvoir(parId.get(id)?.role) && !sortie.aieux.includes(id);

  // Les rôles sans cible réveillés cette nuit agissent d'office (l'Ermite guette, le Chasseur apprend sa cible).
  const toutes = [...actions];
  for (const v of villageois) {
    if (v.vivant === false || !v.role?.cle || !sansCible(v.role) || agitAvecLaMeute(v.role) || !seReveille(v.role, tour, { sansPouvoirs: sagessePerdue })) continue;
    if (!toutes.some(a => a.acteurId === v.id && a.roleCle === v.role.cle)) toutes.push({ acteurId: v.id, roleCle: v.role.cle, cibles: [] });
  }

  // Actions retenues : acteur vivant (la meute peut agir sans acteur précis), cibles connues ; une action sans cible
  // d'un rôle qui doit en désigner une est un « je passe ».
  const retenues = [];
  for (const a of toutes) {
    const acteur = parId.get(a.acteurId);
    const deLaMeute = a.roleCle === CLE_MEUTE;
    const deLaPeste = a.roleCle === CLE_PESTE;   // son porteur est mort : il agit quand même
    const duDeuil = a.roleCle === CLE_DEUIL;     // la vision du Glas du deuil : toute la meute, quel que soit le loup noté
    if (!deLaMeute && !deLaPeste && !duDeuil && (!acteur || acteur.vivant === false)) continue;
    // Le village a perdu sa sagesse (pacte.mjs) : l'action d'un rôle du Village ne vaut plus rien (il n'aurait pas dû être réveillé).
    if (!deLaMeute && !deLaPeste && !duDeuil && a.roleCle === acteur?.role?.cle && sansPouvoir(acteur.role)) continue;
    if ((deLaMeute || duDeuil) && !vivantsMeute.length) continue;
    const cibles = [...new Set((a.cibles ?? []).filter(id => parId.has(id)))];
    const passe = !cibles.length && !a.effet && (deLaMeute || deLaPeste || !sansCible(acteur?.role));
    if (passe) continue;
    const effet = effetDeLAction(a, acteur);
    if (deLaPeste || duDeuil) {
      // Ni loup à empêcher, ni porteur à retenir (gardé à l'œil, hors d'atteinte : il est mort) ; la vision ne sort pas de chez soi.
    } else if (deLaMeute) {
      if (!peutChasser.length) {
        sortie.messages.push(msg("mj", "MeuteEmpechee", "Aucun loup n'a pu sortir cette nuit : la meute n'a pas chassé.", {}));
        continue;
      }
    } else if (hors.has(a.acteurId)) {
      sortie.messages.push(msg(a.acteurId, "Empeche", "Loin de chez vous cette nuit, vous n'avez rien pu faire.", {}));
      continue;
    } else if (surveilles.has(a.acteurId) && cibles.some(c => c !== a.acteurId && vivant(c))) {   // une tombe n'est pas une maison
      sortie.messages.push(msg(a.acteurId, "Surveille", "Le garde du guet vous avait à l'œil : vous n'avez pas pu quitter votre maison.", {}));
      continue;
    }
    const absent = duDeuil ? null : cibles.find(c => hors.has(c) && c !== a.acteurId && vivant(c));
    if (absent) {
      sortie.messages.push(deLaPeste ? msg("mj", "PesteBredouille", `La peste n'a trouvé personne chez ${nom(absent)} : il dormait hors d'atteinte.`, { nom: nom(absent) })
        : deLaMeute ? msg("mj", "MeuteBredouille", `La meute n'a trouvé personne chez ${nom(absent)} : il dormait hors d'atteinte.`, { nom: nom(absent) })
        : msg(a.acteurId, "PersonneChez", `Personne ne répond chez ${nom(absent)} cette nuit.`, { nom: nom(absent) }));
      continue;
    }
    // Le Loup affamé : un loup de la meute est mort, sa faim est passée pour toujours (le réveil le sait déjà : nuit.mjs).
    if (!deLaMeute && !deLaPeste && !duDeuil && acteur?.role?.nuit?.tantQueMeuteEntiere && a.roleCle === acteur.role.cle && !entiere) {
      sortie.messages.push(msg("mj", "AffameRassasie", `Un loup est mort : ${nom(a.acteurId)} ne chasse plus seul.`, { nom: nom(a.acteurId) }));
      continue;
    }
    // Un loup qui tue seul ne tue pas un loup (le réveil ne le lui propose pas : jour.mjs, candidatsDeNuit).
    const solo = !deLaMeute && !deLaPeste && !duDeuil && acteur?.role?.camp === "meute" && effet === "tuer";
    if (solo && cibles.some(c => parId.get(c)?.camp === "meute")) {
      cibles.splice(0, cibles.length, ...cibles.filter(c => parId.get(c)?.camp !== "meute"));
      if (!cibles.length) continue;
    }
    const chasse = deLaMeute || deLaPeste || (acteur?.camp === "meute" && effet === "tuer");
    const loin = chasse && jour.pontBloque && cibles.find(c => surLAutreRive(parId.get(c)?.maison));
    if (loin) {
      sortie.messages.push(deLaPeste ? msg("mj", "PestePont", `La peste n'a pas pu traverser le Pont jusqu'à ${nom(loin)}.`, { nom: nom(loin) })
        : msg("mj", "PontBloque", `La meute n'a pas pu traverser le Pont jusqu'à ${nom(loin)}.`, { nom: nom(loin) }));
      continue;
    }
    retenues.push({ ...a, cibles, effet, explicite: Boolean(a.effet), acteur });
  }
  const groupe = a => a.roleCle === CLE_MEUTE || a.roleCle === CLE_PESTE;
  const parEffet = e => retenues.filter(a => a.effet === e && !groupe(a));
  const precedente = (acteurId, effet) => precedentes.find(p => p.acteurId === acteurId && effetDeLAction(p, parId.get(acteurId)) === effet);

  // 1. Liens d'amour (deux cibles, ou l'acteur et sa cible).
  const amours = new Map();
  for (const v of villageois) if (v.amoureux) amours.set(v.id, v.amoureux);
  for (const a of parEffet("lien-amour")) {
    const [x, y] = a.cibles.length >= 2 ? a.cibles : [a.acteurId, a.cibles[0]];
    if (!x || !y || x === y) continue;
    amours.set(x, y); amours.set(y, x);
    sortie.changements.push({ type: "amour", a: x, b: y });
    sortie.messages.push(msg(x, "Amour", `Une flèche de brume vous lie à ${nom(y)} : si l'un meurt, l'autre le suit.`, { nom: nom(y) }));
    sortie.messages.push(msg(y, "Amour", `Une flèche de brume vous lie à ${nom(x)} : si l'un meurt, l'autre le suit.`, { nom: nom(x) }));
  }

  // 2. Protections (celles posées dans la nuit par l'API + celles des rôles), jamais deux nuits de suite la même cible.
  // La Bonne étoile du narrateur (première nuit) protège en secret ; le givre de l'Almanach glace toute protection.
  const proteges = new Set(villageois.filter(v => Number(v.protections) > 0).map(v => v.id));
  // La garde du Garde du pont (et de tout rôle « proteger » qui n'est pas une porte) ne vaut que contre la meute (et la peste, qui
  // frappe comme elle) : ni poison, ni feu, ni harpon, ni noyade, ni morsure. La Gardienne des clés ferme une porte (personne n'y
  // entre) : elle arrête aussi le harpon, la noyade et la morsure de la Louve mère.
  const gardes = new Set();
  const fermees = new Set();
  for (const id of jour.etoiles ?? []) proteges.add(id);
  if (jour.givre) proteges.clear();
  for (const a of parEffet("proteger")) {
    const cible = a.cibles[0];
    if (!cible || jour.givre) continue;
    if (precedente(a.acteurId, "proteger")?.cibles?.[0] === cible) {
      sortie.messages.push(msg(a.acteurId, "ProtectionRefusee", `Vous ne pouvez pas protéger ${nom(cible)} deux nuits de suite.`, { nom: nom(cible) }));
      continue;
    }
    if (a.acteur?.role?.cle === CLE_GARDIENNE) { fermees.add(cible); proteges.add(cible); } else gardes.add(cible);
  }

  // 3. La victime de la meute : une seule, à la majorité des choix notés (égalité : le premier noté).
  const actionsMeute = retenues.filter(a => a.roleCle === CLE_MEUTE && a.cibles[0]);
  let victimeMeute = majoriteMeute(actionsMeute.map((a, i) => ({ cible: a.cibles[0], quand: a.quand ?? i })));
  const meuteEntre = cible => {
    // Le loup qui entre : l'un de ceux qui ont choisi cette maison, sinon un loup vivant au hasard.
    const choix = actionsMeute.filter(a => a.cibles[0] === cible && peutChasser.includes(a.acteurId)).map(a => a.acteurId);
    return choisir(choix.length ? choix : peutChasser, hasard);
  };

  // Épier la meute (l'Enfant de la brume) : elle apprend le nom des loups sortis chasser cette nuit. Surprise (la chance tirée
  // quand son choix a été noté, sinon ici), c'est elle que la meute dévore, en silence, à la place de la proie désignée.
  // Adaptation en ligne : à la table, elle entrouvre les yeux pendant le réveil des loups ; ici, elle choisit d'épier juste avant
  // (ordre 39) et apprend les noms au matin, dans son carnet.
  let surprise = "";
  for (const a of parEffet("epier")) {
    if (!a.cibles.length || !peutChasser.length) continue;
    if (typeof a.surprise === "boolean" ? a.surprise : hasard() < chanceEpier) {
      victimeMeute = a.acteurId;
      surprise = a.acteurId;
      sortie.messages.push(msg("mj", "EspionRepere", `${nom(a.acteurId)} a été surprise en épiant la meute : c'est elle que la meute dévore.`, { nom: nom(a.acteurId) }));
      sortie.messages.push(msg(a.acteurId, "EpierRepere", "Des yeux jaunes se tournent vers vous dans la brume. Vous avez été vu.", {}));
    } else {
      const loups = peutChasser.map(nom).join(", ");
      sortie.messages.push(msg(a.acteurId, "EpierLoups", `Cachée dans la brume, vous voyez passer la meute : ${loups}.`, { noms: loups }));
    }
  }

  // La victime de la peste noire : la dernière notée (une par nuit).
  const victimePeste = retenues.filter(a => a.roleCle === CLE_PESTE && a.cibles[0]).at(-1)?.cibles[0] ?? null;

  // 4. Attaques.
  const attaques = [];
  // L'Enfant surprise est prise dehors : ni porte ni garde ne jouent pour elle (surprise), seul un remède la sauve.
  if (victimeMeute) attaques.push({ cible: victimeMeute, cause: surprise ? CAUSES.epie : CAUSES.meute, meute: true, loup: meuteEntre(victimeMeute),
    ...(surprise ? { surprise: true } : {}) });
  // La peste frappe comme la meute (mêmes protections), sans loup qui entre.
  if (victimePeste) attaques.push({ cible: victimePeste, cause: CAUSES.peste, meute: true, peste: true });
  for (const a of parEffet("tuer")) {
    if (a.cibles[0]) attaques.push({ cible: a.cibles[0], cause: a.acteur?.camp === "meute" ? CAUSES.meute : CAUSES.nuit, meute: a.acteur?.camp === "meute" });
  }

  // Une attaque de loup arrêtée avant d'atteindre sa proie : asile de la Chapelle, Taverne sans loup, verrou du Forgeron
  // (le premier seulement). Renvoie la raison, ou "".
  const verrousServis = new Set();
  const sansProtection = cible => taverne.has(cible) && loupATaverne;   // un loup dort à la Taverne : aucune protection ne joue
  // Le linceul du Glas du deuil (deuil.mjs) : cette nuit, rien n'arrête la meute (ni porte, ni garde, ni remède).
  const linceul = Boolean(jour.linceul);
  const bloqueeALaPorte = cible => {
    if (linceul) return "";
    if (asiles.has(cible)) return "asile";
    if (taverne.has(cible) && !loupATaverne) return "taverne";
    if (verrous.has(cible) && !verrousServis.has(cible) && !sansProtection(cible)) { verrousServis.add(cible); return "verrou"; }
    return "";
  };
  const bloquees = new Set();
  const noterBlocage = (cible, par, peste = false) => {
    bloquees.add(cible);
    sortie.sauves.push({ acteurId: cible, par });
    if (peste) {
      sortie.messages.push(msg("mj", "PesteArretee", `La peste n'a pas pu atteindre ${nom(cible)} (${par}).`, { nom: nom(cible), par }));
      return;
    }
    const cle = { asile: "SauveAsile", taverne: "SauveTaverne", verrou: "SauveVerrou" }[par];
    const texte = { asile: `La meute n'a pas pu entrer à la Chapelle, où dormait ${nom(cible)}.`,
      taverne: `La meute n'a pas osé tuer ${nom(cible)} à la Taverne.`, verrou: `Le verrou du Forgeron a tenu chez ${nom(cible)}.` }[par];
    sortie.messages.push(msg("mj", cle, texte, { nom: nom(cible) }));
  };

  // Morsure : la proie désignée par la Louve est infectée au lieu d'être tuée, et rejoint la meute en secret. La garde du Garde du
  // pont n'arrête que l'attaque, pas l'infection ; une porte que la meute ne passe pas (asile, Taverne, verrou, clé de la
  // Gardienne), si.
  for (const a of parEffet("mordre")) {
    const cible = a.cibles[0];
    if (!cible || !vivant(cible)) continue;
    for (let i = attaques.length - 1; i >= 0; i--) if (attaques[i].meute && attaques[i].cible === cible) attaques.splice(i, 1);
    const porte = cible === surprise ? "" : bloqueeALaPorte(cible);
    if (porte) noterBlocage(cible, porte);
    else if (fermees.has(cible) && cible !== surprise && !sansProtection(cible) && !linceul) {
      sortie.sauves.push({ acteurId: cible, par: "proteger" });
      sortie.messages.push(msg("mj", "MorsureEvitee", `La morsure sur ${nom(cible)} a été repoussée.`, { nom: nom(cible) }));
    } else if (aieulEnVie(cible) && !linceul) {
      // L'Aïeul : la première morsure ne l'infecte pas, elle lui coûte sa première vie (en secret).
      sortie.aieux.push(cible);
      sortie.sauves.push({ acteurId: cible, par: "aieul" });
      sortie.messages.push(msg("mj", "AieulMorsure", `${nom(cible)}, l'Aïeul, a résisté à la morsure : il a perdu sa première vie.`, { nom: nom(cible) }));
    } else if (parId.get(cible).camp !== "meute") {
      sortie.changements.push({ type: "camp", acteurId: cible, camp: "meute" });
      sortie.messages.push(msg(cible, "Mordu", "Une morsure dans la nuit : vous rejoignez la meute, en secret.", {}));
      sortie.messages.push(msg("mj", "MorsureMj", `${nom(cible)} a été mordu et rejoint la meute.`, { nom: nom(cible) }));
    }
  }

  // Les victimes de la nuit (avant remède) : les attaques. Un mordu n'en est pas une : une infection n'est pas une mort.
  const victimes = new Set(attaques.map(x => x.cible));

  // 5. Herboriste : remède sur une victime de la nuit ; sur un autre joueur, c'est le poison. Elle peut verser les deux la même
  // nuit (deux cibles : une victime et un autre joueur). Une fiole vide ne verse rien. Chaque cible qui n'a rien reçu lui rend
  // l'usage pris par noterAction (fiolesVides : une entrée par fiole restée bouchée).
  const remedies = new Set();
  for (const a of parEffet("remede")) {
    const versees = new Set();   // les fioles ouvertes par cette action : une de chaque sorte
    for (const c of a.cibles.slice(0, 2)) {
      const voulue = victimes.has(c) ? "remede" : c !== a.acteurId ? "poison" : "";
      if (!voulue) {
        // Sur soi, hors danger : aucune fiole ne s'ouvre, l'usage lui est rendu (comme une fiole vide).
        sortie.fiolesVides.push(a.acteurId);
        sortie.messages.push(msg(a.acteurId, "FiolesBouchees", "Vous n'étiez pas en danger cette nuit : vos fioles restent bouchées.", {}));
        continue;
      }
      if (versees.has(voulue)) {
        // Deux victimes, ou deux autres joueurs : une seule fiole de chaque sorte.
        sortie.fiolesVides.push(a.acteurId);
        sortie.messages.push(msg(a.acteurId, "FioleDeTrop", `Vous n'avez qu'une fiole de chaque sorte : rien n'est versé à ${nom(c)}.`, { nom: nom(c) }));
        continue;
      }
      versees.add(voulue);
      if (sortie.fioles[a.acteurId]?.[voulue]) {
        sortie.fiolesVides.push(a.acteurId);
        sortie.messages.push(voulue === "remede"
          ? msg(a.acteurId, "FioleVideRemede", "Votre fiole de remède est vide : rien ne se passe.", {})
          : msg(a.acteurId, "FioleVidePoison", "Votre fiole de poison est vide : rien ne se passe.", {}));
        continue;
      }
      (sortie.fioles[a.acteurId] ??= {})[voulue] = true;
      if (voulue === "remede") remedies.add(c);
      else {
        attaques.push({ cible: c, cause: CAUSES.poison, traverse: true });
        sortie.messages.push(msg("mj", "Poison", `${nom(a.acteurId)} a versé son poison à ${nom(c)}.`, { qui: nom(a.acteurId), nom: nom(c) }));
      }
    }
  }
  for (const a of parEffet("poison")) {
    if (a.cibles[0]) attaques.push({ cible: a.cibles[0], cause: CAUSES.poison, traverse: true });
  }

  // 6. Pyromane : asperger s'ajoute ; embraser (se désigner soi-même) brûle toutes les maisons aspergées, protégées ou non.
  let aspergees = new Set(asperges.filter(id => vivant(id)));
  const embrasements = [...parEffet("embraser"), ...parEffet("asperger").filter(a => a.cibles.includes(a.acteurId))];
  for (const a of parEffet("asperger")) for (const id of a.cibles) if (id !== a.acteurId) aspergees.add(id);
  if (embrasements.length) {
    for (const id of aspergees) attaques.push({ cible: id, cause: CAUSES.feu, traverse: true });
    sortie.messages.push(msg("mj", "Embrasement", `Les maisons aspergées s'embrasent : ${[...aspergees].map(nom).join(", ") || "aucune"}.`,
      { noms: [...aspergees].map(nom).join(", ") }));
    aspergees = new Set();
  }

  // 7. Les morts.
  const meurt = (id, cause) => {
    if (!vivant(id) || sortie.morts.includes(id)) return;
    sortie.morts.push(id);
    sortie.deces.push({ acteurId: id, cause });
  };
  for (const x of attaques) {
    if (!vivant(x.cible) || sortie.morts.includes(x.cible)) continue;
    if (x.meute && victoireCleDe(parId.get(x.cible)?.role) === "dernier-survivant") {
      sortie.sauves.push({ acteurId: x.cible, par: "immunite" });
      sortie.messages.push(x.peste ? msg("mj", "PesteArretee", `La peste n'a pas pu atteindre ${nom(x.cible)} (immunite).`, { nom: nom(x.cible), par: "immunite" })
        : msg("mj", "Immunite", `La meute est repartie bredouille de chez ${nom(x.cible)}.`, { nom: nom(x.cible) }));
      continue;
    }
    // Hors d'atteinte (Passeur, Grange) : il ne dort pas chez lui, ni le feu de sa maison ni personne ne l'atteint.
    if (hors.has(x.cible)) {
      sortie.sauves.push({ acteurId: x.cible, par: "absent" });
      continue;
    }
    if (x.meute && !x.surprise) {
      const porte = bloqueeALaPorte(x.cible);
      if (porte) { noterBlocage(x.cible, porte, x.peste); continue; }
    }
    if (linceul && x.meute && !x.peste) { meurt(x.cible, x.cause); continue; }
    // Deux attaques sur la même maison (la meute et le Pêcheur de nuit, à une petite table) : un seul remède, un seul mot au MJ.
    const dejaSauve = par => sortie.sauves.some(s => s.acteurId === x.cible && s.par === par);
    if (remedies.has(x.cible)) {
      if (!dejaSauve("remede")) sortie.messages.push(msg("mj", "SauveRemede", `${nom(x.cible)} a été sauvé par un remède.`, { nom: nom(x.cible) }));
      sortie.sauves.push({ acteurId: x.cible, par: "remede" });
      continue;
    }
    if ((proteges.has(x.cible) || (x.meute && gardes.has(x.cible))) && !x.traverse && !x.surprise && !(x.meute && sansProtection(x.cible))) {
      if (!dejaSauve("proteger")) sortie.messages.push(msg("mj", "SauveProtection", `${nom(x.cible)} était protégé cette nuit.`, { nom: nom(x.cible) }));
      sortie.sauves.push({ acteurId: x.cible, par: "proteger" });
      continue;
    }
    // L'Aïeul : la première attaque de la meute qui l'aurait tué (rien d'autre ne l'a arrêté) lui coûte sa première vie, en secret.
    if (x.meute && aieulEnVie(x.cible)) {
      sortie.aieux.push(x.cible);
      sortie.sauves.push({ acteurId: x.cible, par: "aieul" });
      sortie.messages.push(msg("mj", "AieulResiste", `${nom(x.cible)}, l'Aïeul, a survécu à l'attaque : il a perdu sa première vie.`, { nom: nom(x.cible) }));
      continue;
    }
    // Le présent de la Veillée d'hiver : le premier coup qui devait tuer son porteur échoue, une fois (rien d'autre ne l'a arrêté).
    if (jour.present && x.cible === jour.present && !sortie.presentOuvert) {
      sortie.presentOuvert = true;
      sortie.sauves.push({ acteurId: x.cible, par: "present" });
      sortie.messages.push(msg(x.cible, "PresentOuvert", "Votre présent s'est ouvert cette nuit : un coup mortel vous a manqué. Vous êtes encore en vie.", {}));
      sortie.messages.push(msg("mj", "PresentMj", `Le présent de ${nom(x.cible)} s'est ouvert : il a survécu à un coup mortel.`, { nom: nom(x.cible) }));
      continue;
    }
    meurt(x.cible, x.cause);
  }

  // La contamination du Vieux Sergent : le loup contaminé la nuit d'avant meurt cette nuit ; rien ne l'en protège.
  for (const id of contamines) {
    if (!vivant(id) || sortie.morts.includes(id)) continue;
    meurt(id, CAUSES.contamine);
    sortie.messages.push(msg("mj", "ContamineMort", `${nom(id)} a succombé à la blessure de la vieille épée.`, { nom: nom(id) }));
  }

  // La lame de la Forge : la meute qui atteint celui qui la porte (même s'il survit) y laisse du sang ; un loup tiré au
  // hasard est réduit au silence au jour suivant (sauf s'il est béni). Le village apprend seulement le sang sur le seuil.
  if (victimeMeute && lames.has(victimeMeute) && !bloquees.has(victimeMeute)) {
    const blesse = choisir(peutChasser.filter(id => vivant(id)), hasard);
    if (blesse) {
      if (!benis.has(blesse)) sortie.changements.push({ type: "silence", acteurId: blesse });
      sortie.annonces.push(msg("public", "SangDeBete", "Du sang de bête sur le seuil.", {}));
      sortie.messages.push(msg("mj", "Blesse", `${nom(victimeMeute)} a blessé ${nom(blesse)} avec la lame de la Forge.`, { qui: nom(victimeMeute), nom: nom(blesse) }));
    }
  }

  // 8. Éclairer une maison : tout loup qui y entre (tuer, mordre, flairer…) est démasqué à l'aube.
  const memeMaison = (x, y) => x === y || (parId.get(x)?.maison && parId.get(x)?.maison === parId.get(y)?.maison);
  const entrees = [];   // [{ loup, cible }]
  const loupMeute = attaques.find(x => x.meute && x.loup)?.loup ?? (victimeMeute ? meuteEntre(victimeMeute) : null);
  if (victimeMeute && loupMeute && !surprise) entrees.push({ loup: loupMeute, cible: victimeMeute });   // l'Enfant surprise est prise dehors
  for (const b of retenues) {
    if (groupe(b) || b.acteur?.camp !== "meute") continue;
    for (const c of b.cibles) entrees.push({ loup: b.acteurId, cible: c });
  }
  for (const a of parEffet("eclairer")) {
    const eclairee = a.cibles[0];
    if (!eclairee) continue;
    const vus = [...new Set(entrees.filter(e => e.loup !== a.acteurId && memeMaison(e.cible, eclairee)).map(e => e.loup))];
    for (const loup of vus) sortie.revelations.push({ acteurId: loup, type: "eclairer", public: true, maison: parId.get(eclairee)?.maison ?? "" });
    sortie.messages.push(vus.length
      ? msg(a.acteurId, "EclairerOui", `Votre lanterne a surpris un loup chez ${nom(eclairee)} : ${vus.map(nom).join(", ")}.`,
        { nom: nom(eclairee), loups: vus.map(nom).join(", ") })
      : msg(a.acteurId, "EclairerNon", `Aucun loup n'est entré chez ${nom(eclairee)} cette nuit.`, { nom: nom(eclairee) }));
  }

  // 9. Informations privées.
  for (const a of parEffet("voir-camp")) {
    const [c, d] = a.cibles;
    if (!c) continue;
    // Un Somnambule rêve sa vision : elle est fausse, tirée du VRAI camp (inversé ; « même camp » à l'envers) : jamais mieux
    // qu'une vraie vision (ni Loup déguisé démasqué, ni Louvetier blanchi).
    if (d) {   // deux cibles (le Sourcier) : même camp ou non
      const meme = reve.has(a.acteurId) ? parId.get(c)?.camp !== parId.get(d)?.camp : vu(c, a.acteurId) === vu(d, a.acteurId);
      sortie.messages.push(msg(a.acteurId, meme ? "MemeCamp" : "PasMemeCamp",
        meme ? `${nom(c)} et ${nom(d)} sont du même camp.` : `${nom(c)} et ${nom(d)} ne sont pas du même camp.`, { a: nom(c), b: nom(d) }));
    } else {
      const camp = reve.has(a.acteurId) ? campInverse(parId.get(c)?.camp) : vu(c, a.acteurId);
      sortie.messages.push(msg(a.acteurId, "VoirCamp", `Les cendres parlent : ${nom(c)} est du camp « ${camp} ».`, { nom: nom(c), camp }));
    }
  }
  // La Liseuse de cendres lit le RÔLE (sa carte) : roleApparent (le Loup déguisé paraît « Villageois », un masque du Carnaval
  // montre le rôle simple de l'autre camp). Le mot « meute » reste dans le message quand le rôle vu en est (camp du rôle).
  // Une Liseuse rêvée (Somnambule) se trompe toujours, sur le VRAI camp : un loup paraît « Villageois », tout autre « Loup ».
  for (const a of parEffet("voir-role")) {
    const c = a.cibles[0];
    if (!c) continue;
    let lu;
    if (reve.has(a.acteurId)) lu = parId.get(c)?.camp === "meute" ? { nom: noms.village, camp: "village" } : { nom: noms.meute, camp: "meute" };
    else {
      const avant = sortie.masqueTombe;
      const camp = vu(c, a.acteurId);   // le masque du Carnaval : la première vision du Village le fait tomber
      lu = !avant && sortie.masqueTombe ? { nom: noms[camp] ?? noms.village, camp } : roleApparent(parId.get(c), noms);
    }
    sortie.messages.push(msg(a.acteurId, "VoirRole", `Les cendres parlent : ${nom(c)} est « ${lu.nom} », du camp « ${lu.camp} ».`,
      { nom: nom(c), role: lu.nom, camp: lu.camp }));
  }
  // La vision du Glas du deuil (deuil.mjs) : chaque loup vivant apprend le camp du joueur désigné par la meute.
  for (const a of parEffet("deuil")) {
    const c = a.cibles[0];
    if (!c) continue;
    const camp = apparenceDe(parId.get(c));   // un regard de la meute : le masque ne la trompe pas
    sortie.deuil = c;
    for (const loup of vivantsMeute) {
      sortie.messages.push(msg(loup, "VisionDeuil", `Le glas vous souffle le camp de ${nom(c)} : « ${camp} ».`, { nom: nom(c), camp }));
    }
  }
  for (const a of parEffet("voir-role-mort")) {
    const c = a.cibles[0];
    if (!c) continue;
    const mort = parId.get(c);
    const vrai = mort.role?.nom ?? mort.role?.cle ?? "?";
    // Un mort dont le rôle est déjà révélé se lit tel quel, même en rêve (une contradiction trahirait le Somnambule).
    const lu = reve.has(a.acteurId) && !mort.revele ? roleFactice(vrai, rolesFactices, hasard) : vrai;
    sortie.messages.push(mort.vivant === false
      ? msg(a.acteurId, "VoirRoleMort", `${nom(c)} était : ${lu}.`, { nom: nom(c), role: lu })
      : msg(a.acteurId, "PasMort", `${nom(c)} n'est pas mort.`, { nom: nom(c) }));
  }
  const ontAgi = new Set(retenues.filter(a => a.cibles.length && a.roleCle !== CLE_PESTE).map(a => a.acteurId).filter(Boolean));
  for (const a of parEffet("voir-actif")) {
    const c = a.cibles[0];
    if (c) {
      const oui = c !== a.acteurId && ontAgi.has(c);
      sortie.messages.push(msg(a.acteurId, oui ? "ActifOui" : "ActifNon", oui ? `${nom(c)} est sorti cette nuit.` : `${nom(c)} n'a pas bougé cette nuit.`, { nom: nom(c) }));
    } else {
      const quelquun = choisir([...ontAgi].filter(id => id !== a.acteurId), hasard);
      sortie.messages.push(quelquun
        ? msg(a.acteurId, "ActifVu", `Vous avez vu ${nom(quelquun)} sortir cette nuit.`, { nom: nom(quelquun) })
        : msg(a.acteurId, "ActifPersonne", "Personne n'est sorti cette nuit.", {}));
    }
  }
  // Le Furet flaire un joueur et ses deux voisins vivants (au début de la nuit). Un Furet sans flair n'a rien désigné.
  for (const a of parEffet(EFFET_FURET)) {
    const c = a.cibles[0];
    if (!c || sortie.furets.includes(a.acteurId)) continue;
    const groupe = trioAutour(placesDuCercle, villageois, c);
    if (!groupe.length) continue;
    const noms = groupe.map(nom).join(", ");
    if (groupe.some(id => vu(id, a.acteurId) === "meute")) {
      sortie.messages.push(msg(a.acteurId, "FuretOui", `Votre museau frémit : il y a au moins un loup parmi ${noms}.`, { noms }));
    } else {
      sortie.furets.push(a.acteurId);
      sortie.messages.push(msg(a.acteurId, "FuretNon", `Aucun loup parmi ${noms} : ils sont innocents. Mais votre flair vous a quitté, pour toujours.`, { noms }));
      sortie.messages.push(msg("mj", "FuretPerdu", `${nom(a.acteurId)}, le Furet, n'a flairé aucun loup : il perd son flair.`, { nom: nom(a.acteurId) }));
    }
  }
  // La Pie : sa plume noire (la dernière posée), jamais sur elle-même ni sur un rôle exclu ; annoncée au matin si sa cible vit.
  for (const a of parEffet(EFFET_PIE)) {
    const c = a.cibles[0];
    if (c && vivant(c) && candidatsDeLaPlume(villageois, a.acteurId, [c]).length) sortie.plume = c;
  }
  if (sortie.plume) sortie.messages.push(msg("mj", "Plume", `Une plume noire se posera sur ${nom(sortie.plume)} : deux voix de plus contre lui au vote du jour.`, { nom: nom(sortie.plume) }));

  // Le chasseur de primes apprend sa cible.
  const informes = new Set();
  for (const a of retenues) {
    if (groupe(a) || victoireCleDe(a.acteur?.role) !== "cible-executee" || informes.has(a.acteurId)) continue;
    informes.add(a.acteurId);
    const cible = primes[a.acteurId];
    sortie.messages.push(cible
      ? msg(a.acteurId, "Prime", `Votre cible : ${nom(cible)}. Faites-la condamner par le village.`, { nom: nom(cible) })
      : msg("mj", "PrimeManquante", `${nom(a.acteurId)} n'a pas de cible : désignez-en une.`, { nom: nom(a.acteurId) }));
  }

  // 10. Silence (jamais deux nuits de suite la même gorge), échanges de rôle, cloche.
  for (const a of parEffet("silence")) {
    const c = a.cibles[0];
    if (!c || !vivant(c)) continue;
    if (precedente(a.acteurId, "silence")?.cibles?.[0] === c) {
      sortie.messages.push(msg(a.acteurId, "SilenceRefuse", `Vous ne pouvez pas faire taire ${nom(c)} deux nuits de suite.`, { nom: nom(c) }));
      continue;
    }
    if (benis.has(c)) {
      sortie.messages.push(msg(a.acteurId, "SilenceBeni", `${nom(c)} a été béni : votre hurlement n'a pas prise sur lui.`, { nom: nom(c) }));
      continue;
    }
    sortie.changements.push({ type: "silence", acteurId: c });
  }
  for (const a of parEffet("echanger-role")) {
    const c = a.cibles[0];
    if (!c || c === a.acteurId || !vivant(c)) continue;
    sortie.changements.push({ type: "echange", a: a.acteurId, b: c });
    [sortie.fioles[a.acteurId], sortie.fioles[c]] = [sortie.fioles[c], sortie.fioles[a.acteurId]];   // les fioles suivent le rôle
    for (const id of [a.acteurId, c]) if (!sortie.fioles[id]) delete sortie.fioles[id];
    sortie.messages.push(msg(a.acteurId, "Echange", `Vous avez pris en secret le rôle de ${nom(c)}.`, { nom: nom(c) }));
  }
  // Le Messager remet au destinataire le mot de l'expéditeur (écrit pendant la nuit). Personne d'autre ne le lit.
  for (const a of parEffet("messager")) {
    const [expediteur, destinataire] = a.cibles;
    if (!expediteur || !destinataire || expediteur === destinataire) continue;
    const mot = nettoyerMot(a.texte);
    if (!mot) {
      sortie.messages.push(msg(a.acteurId, "MessagerVide", `${nom(expediteur)} n'a rien écrit : votre besace est restée vide.`, { nom: nom(expediteur) }));
      continue;
    }
    sortie.messages.push(msg(destinataire, "MessageRecu", `Le Messager vous remet un mot de ${nom(expediteur)} : « ${mot} »`, { nom: nom(expediteur), texte: mot }));
    if (a.acteurId !== destinataire) {
      sortie.messages.push(msg(a.acteurId, "MessageRemis", `Vous avez remis le mot de ${nom(expediteur)} à ${nom(destinataire)}.`, { a: nom(expediteur), b: nom(destinataire) }));
    }
  }
  if (parEffet("vote-double").length) {
    sortie.voteDouble = true;
    sortie.messages.push(msg("mj", "Cloche", "La cloche a sonné : le vote du jour est double.", {}));
  }

  // 11. Chagrin : l'amoureux d'un mort meurt aussi, en cascade.
  for (let i = 0; i < sortie.morts.length; i++) {
    const lie = amours.get(sortie.morts[i]);
    if (lie) meurt(lie, CAUSES.chagrin);
  }

  // Le Vieux Sergent dévoré par la meute : le premier loup vivant à sa gauche (après les morts et les morsures de la nuit) est
  // contaminé, et mourra la nuit suivante. Les autres causes de mort ne déclenchent rien.
  if (sortie.deces.some(d => d.cause === CAUSES.meute)) {
    const camps = new Map(sortie.changements.filter(c => c.type === "camp").map(c => [c.acteurId, c.camp]));
    const apres = villageois.map(v => ({ ...v, ...(sortie.morts.includes(v.id) ? { vivant: false } : {}), ...(camps.has(v.id) ? { camp: camps.get(v.id) } : {}) }));
    for (const d of sortie.deces.filter(x => x.cause === CAUSES.meute)) {
      const s = parId.get(d.acteurId);
      if (s?.role?.effet !== EFFET_SERGENT || sansPouvoir(s.role)) continue;
      const loup = premierAGauche(placesDuCercle, apres, d.acteurId, v => v.camp === "meute");
      if (!loup || sortie.contaminations.some(c => c.loup === loup)) continue;
      sortie.contaminations.push({ sergent: d.acteurId, loup });
      sortie.messages.push(msg("mj", "Contamination", `La vieille épée de ${nom(d.acteurId)} a blessé ${nom(loup)} : il mourra la nuit prochaine.`, { qui: nom(d.acteurId), nom: nom(loup) }));
    }
  }

  // 12. Emporter : un mort qui emporte quelqu'un doit encore choisir (le narrateur le lui demande).
  for (const id of sortie.morts) if (parId.get(id)?.role?.effet === "emporter") sortie.enAttente.push({ acteurId: id, effet: "emporter" });

  // Le reste : raconté et arbitré par le narrateur.
  for (const a of retenues) {
    if (groupe(a) || informes.has(a.acteurId)) continue;
    if (!EFFETS_AUTOMATISES.includes(a.effet)) sortie.narrateur.push({ acteurId: a.acteurId, roleCle: a.roleCle, effet: a.effet, cibles: a.cibles });
  }

  sortie.asperges = [...aspergees].filter(id => !sortie.morts.includes(id));

  // Bilan de la nuit (secret, gardé par le MJ) : qui a quitté sa maison, quelles maisons ont reçu de la visite.
  const sorties = new Set(), visites = new Set();
  for (const b of retenues) {
    if (groupe(b)) continue;
    const dehors = b.cibles.filter(c => c !== b.acteurId);
    if (dehors.length) sorties.add(b.acteurId);
    for (const c of dehors) visites.add(c);
  }
  if (victimeMeute) {
    for (const id of peutChasser) sorties.add(id);
    if (!surprise) visites.add(victimeMeute);
  }
  if (victimePeste) visites.add(victimePeste);
  sortie.bilan = { sorties: [...sorties], visites: [...visites], victime: victimeMeute ?? victimePeste ?? "", loup: victimeMeute ? loupMeute ?? "" : "",
    sauves: sortie.sauves.length, attaques: attaques.length };
  // Une proie tuée sur l'autre rive bloque le Pont la nuit suivante : la peste comme la meute (rien ne doit les distinguer).
  const franchi = (victime, cause) => Boolean(victime && sortie.deces.some(d => d.acteurId === victime && d.cause === cause) && surLAutreRive(parId.get(victime)?.maison));
  sortie.pontFranchi = franchi(victimeMeute, CAUSES.meute) || franchi(victimePeste, CAUSES.peste);
  return sortie;
}

// Les proies de la nuit en cours, notées jusqu'ici (actions de etat.nuit), telles que la Louve mère peut les mordre et que
// l'Herboriste les apprend : la proie de la meute (l'Enfant de la brume surprise à sa place), les victimes des loups qui tuent
// seuls (le Loup affamé), celle de la peste. mordus : ceux que la Louve a déjà infectés (pas une victime : rien à sauver).
// -> { proies: [acteurId], mordus: [acteurId] }
export function proiesDeLaNuit({ villageois = [], actions = [] } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const role = a => parId.get(a.acteurId)?.role;
  const propre = a => role(a)?.cle === a.roleCle;   // l'action du rôle de son acteur (pas un vote de meute)
  const enfant = actions.find(a => propre(a) && role(a)?.effet === "epier" && a.cibles?.length && a.surprise === true)?.acteurId ?? "";
  const meute = actions.filter(a => a.roleCle === CLE_MEUTE && a.cibles?.[0]);
  const proies = [];
  if (enfant && villageois.some(v => v.vivant !== false && v.camp === "meute")) proies.push(enfant);
  else if (meute.length) proies.push(majoriteMeute(meute.map((a, i) => ({ cible: a.cibles[0], quand: a.quand ?? i }))));
  for (const a of actions) {
    if (a.roleCle === CLE_PESTE || (propre(a) && role(a)?.camp === "meute" && role(a)?.effet === "tuer")) proies.push(...(a.cibles ?? []));
  }
  const mordus = actions.filter(a => propre(a) && role(a)?.effet === "mordre").map(a => a.cibles?.[0]).filter(Boolean);
  return { proies: [...new Set(proies.filter(Boolean))], mordus: [...new Set(mordus)] };
}

// Applique le résultat de resoudreNuit() à des villageois « à plat » et renvoie de nouveaux villageois :
// morts, changements de camp, liens d'amour, silences, échanges de rôle (le camp suit le nouveau rôle),
// protections remises à 0 (elles ne valaient que pour cette nuit).
export function appliquerResolution(villageois = [], r = {}) {
  const nouveaux = villageois.map(v => JSON.parse(JSON.stringify(v)));
  const parId = new Map(nouveaux.map(v => [v.id, v]));
  for (const c of r.changements ?? []) {
    if (c.type === "camp" && parId.has(c.acteurId)) parId.get(c.acteurId).camp = c.camp;
    else if (c.type === "amour" && parId.has(c.a) && parId.has(c.b)) { parId.get(c.a).amoureux = c.b; parId.get(c.b).amoureux = c.a; }
    else if (c.type === "silence" && parId.has(c.acteurId)) parId.get(c.acteurId).silence = true;
    else if (c.type === "echange" && parId.has(c.a) && parId.has(c.b)) {
      const a = parId.get(c.a), b = parId.get(c.b);
      [a.role, b.role] = [b.role, a.role];
      a.camp = a.role?.camp ?? a.camp;
      b.camp = b.role?.camp ?? b.camp;
    }
  }
  for (const id of r.morts ?? []) if (parId.has(id)) parId.get(id).vivant = false;
  for (const v of nouveaux) v.protections = 0;
  return nouveaux;
}

// Cascade d'amour hors de la nuit (vote, poison du jour…) : renvoie les ids qui meurent, dans l'ordre.
export function cascadeAmour(villageois, premierMort) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const morts = [premierMort];
  for (let i = 0; i < morts.length; i++) {
    const lie = parId.get(morts[i])?.amoureux;
    if (lie && parId.get(lie)?.vivant !== false && !morts.includes(lie)) morts.push(lie);
  }
  return morts;
}
