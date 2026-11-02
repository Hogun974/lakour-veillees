// Résolution de la nuit, à l'aube. Logique pure.
//
// resoudreNuit({ villageois, actions, tour, asperges, precedentes, primes, fioles, hasard, chanceEpier, jour })
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
//                lames, horsDAtteinte, taverne, taverneEnJeu, benis, pontBloque }.
// -> { morts, deces, sauves, revelations, messages, changements, asperges, fioles, fiolesVides, voteDouble, enAttente, narrateur,
//      annonces, bilan, pontFranchi }
//    annonces : [msg] publiques (la lame de la Forge) ; bilan : { visites, sorties, victime, loup, sauves, attaques } pour les
//    pouvoirs du matin (Chasseresse, Colporteur de nouvelles, Lavoir) ; pontFranchi : la meute a tué sur l'autre rive.
//    fiolesVides : herboristes dont aucune fiole n'a rien versé (fiole déjà vide, ou soi-même hors danger) : l'usage leur est rendu.
//    messages : [{ destinataire: acteurId | "mj", cle, texte, donnees }]
//
// Conventions tirées des rôles de lakour-veillees (un seul `effet` par rôle) :
// - Herboriste (effet "remede") : sa cible est-elle une victime de la nuit ? remède ; sinon (un autre joueur) poison ;
//   chaque fiole ne sert qu'une fois par partie ;
// - Pyromane (effet "asperger") : se désigner soi-même = embraser ; le feu passe les protections ; la meute ne peut
//   pas le tuer ;
// - Louve mère (effet "mordre") : elle désigne la proie de la meute ; celle-ci est mordue au lieu d'être tuée ;
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
// Ordre : liens d'amour, protections, épier, attaques (meute, tuer), morsure, poison, feu, remède, éclairer,
// informations, silence, échanges, cloche, chagrin en cascade, emporter.
// Tout se joue sur l'état du début de nuit : un mort de la nuit agit encore cette nuit-là.

import { CLE_MEUTE, CLE_PESTE, CAUSES, EFFETS_AUTOMATISES } from "./constantes.mjs";
import { choisir } from "./hasard.mjs";
import { seReveille, agitAvecLaMeute } from "./nuit.mjs";
import { victoireCleDe } from "./victoire.mjs";
import { majoriteMeute } from "./votes.mjs";
import { surLAutreRive } from "./distribution.mjs";

// Un mot porté par le Messager : une ligne, sans balises, 200 caractères au plus.
export function nettoyerMot(texte, longueur = 200) {
  return String(texte ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, longueur);
}

export function apparenceDe(v) {
  if (!v) return "village";
  if (v.role?.apparence) return v.role.apparence;
  // Repli : un rôle de la meute dont la clé dit « déguisé » se montre comme villageois.
  if (v.camp === "meute" && /deguis/.test(v.role?.cle ?? "")) return "village";
  return v.camp;
}

export function effetDeLAction(action, acteur) {
  if (action.effet) return action.effet;
  if (action.roleCle === CLE_MEUTE || action.roleCle === CLE_PESTE) return "tuer";
  return acteur?.role?.effet ?? "";
}

const msg = (destinataire, cle, texte, donnees = {}) => ({ destinataire, cle: `LAKOUR_LOUPS.Nuit.${cle}`, texte, donnees });
const sansCible = role => Number(role?.nuit?.cibles ?? 1) === 0;

export function resoudreNuit({ villageois = [], actions = [], tour = 1, asperges = [], precedentes = [], primes = {}, fioles = {}, hasard = Math.random, chanceEpier = 1 / 3, jour = {} } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  const nom = id => parId.get(id)?.nom ?? id;
  const vivant = id => parId.get(id)?.vivant !== false && parId.has(id);
  const vivantsMeute = villageois.filter(v => v.vivant !== false && v.camp === "meute").map(v => v.id);
  // Effets du jour.
  const hors = new Set(jour.horsDAtteinte ?? []);
  const surveilles = new Set(jour.surveilles ?? []);
  const asiles = new Set(jour.asiles ?? []);
  const taverne = new Set(jour.taverne ?? []);
  const verrous = new Set(jour.verrous ?? []);
  const benis = new Set(jour.benis ?? []);
  const lames = new Set(jour.lames ?? []);
  const loupATaverne = Boolean(jour.taverneEnJeu) && [...taverne].some(id => vivant(id) && parId.get(id).camp === "meute");
  // Les loups qui chassent : ni gardés à l'œil, ni hors d'atteinte (« la meute chasse sans lui »).
  const peutChasser = vivantsMeute.filter(id => !hors.has(id) && !surveilles.has(id));

  const sortie = { morts: [], deces: [], sauves: [], revelations: [], messages: [], changements: [], asperges: [],
    fioles: JSON.parse(JSON.stringify(fioles ?? {})), fiolesVides: [], voteDouble: false, enAttente: [], narrateur: [],
    annonces: [], bilan: null, pontFranchi: false };

  // Les rôles sans cible réveillés cette nuit agissent d'office (l'Ermite guette, le Chasseur apprend sa cible).
  const toutes = [...actions];
  for (const v of villageois) {
    if (v.vivant === false || !v.role?.cle || !sansCible(v.role) || agitAvecLaMeute(v.role) || !seReveille(v.role, tour)) continue;
    if (!toutes.some(a => a.acteurId === v.id && a.roleCle === v.role.cle)) toutes.push({ acteurId: v.id, roleCle: v.role.cle, cibles: [] });
  }

  // Actions retenues : acteur vivant (la meute peut agir sans acteur précis), cibles connues ; une action sans cible
  // d'un rôle qui doit en désigner une est un « je passe ».
  const retenues = [];
  for (const a of toutes) {
    const acteur = parId.get(a.acteurId);
    const deLaMeute = a.roleCle === CLE_MEUTE;
    const deLaPeste = a.roleCle === CLE_PESTE;   // son porteur est mort : il agit quand même
    if (!deLaMeute && !deLaPeste && (!acteur || acteur.vivant === false)) continue;
    if (deLaMeute && !vivantsMeute.length) continue;
    const cibles = [...new Set((a.cibles ?? []).filter(id => parId.has(id)))];
    const passe = !cibles.length && !a.effet && (deLaMeute || deLaPeste || !sansCible(acteur?.role));
    if (passe) continue;
    const effet = effetDeLAction(a, acteur);
    if (deLaPeste) {
      // Ni loup à empêcher, ni porteur à retenir (gardé à l'œil, hors d'atteinte : il est mort).
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
    const absent = cibles.find(c => hors.has(c) && c !== a.acteurId && vivant(c));
    if (absent) {
      sortie.messages.push(deLaPeste ? msg("mj", "PesteBredouille", `La peste n'a trouvé personne chez ${nom(absent)} : il dormait hors d'atteinte.`, { nom: nom(absent) })
        : deLaMeute ? msg("mj", "MeuteBredouille", `La meute n'a trouvé personne chez ${nom(absent)} : il dormait hors d'atteinte.`, { nom: nom(absent) })
        : msg(a.acteurId, "PersonneChez", `Personne ne répond chez ${nom(absent)} cette nuit.`, { nom: nom(absent) }));
      continue;
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
  const proteges = new Set(villageois.filter(v => Number(v.protections) > 0).map(v => v.id));
  for (const a of parEffet("proteger")) {
    const cible = a.cibles[0];
    if (!cible) continue;
    if (precedente(a.acteurId, "proteger")?.cibles?.[0] === cible) {
      sortie.messages.push(msg(a.acteurId, "ProtectionRefusee", `Vous ne pouvez pas protéger ${nom(cible)} deux nuits de suite.`, { nom: nom(cible) }));
      continue;
    }
    proteges.add(cible);
  }

  // 3. La victime de la meute : une seule, à la majorité des choix notés (égalité : le premier noté).
  const actionsMeute = retenues.filter(a => a.roleCle === CLE_MEUTE && a.cibles[0]);
  let victimeMeute = majoriteMeute(actionsMeute.map((a, i) => ({ cible: a.cibles[0], quand: a.quand ?? i })));
  const meuteEntre = cible => {
    // Le loup qui entre : l'un de ceux qui ont choisi cette maison, sinon un loup vivant au hasard.
    const choix = actionsMeute.filter(a => a.cibles[0] === cible && peutChasser.includes(a.acteurId)).map(a => a.acteurId);
    return choisir(choix.length ? choix : peutChasser, hasard);
  };

  // Épier la meute : l'espion entend la proie choisie ; repéré, il devient lui-même la proie.
  for (const a of parEffet("epier")) {
    if (!a.cibles.length || !peutChasser.length) continue;
    if (hasard() < chanceEpier) {
      victimeMeute = a.acteurId;
      sortie.messages.push(msg("mj", "EspionRepere", `${nom(a.acteurId)} a été repéré en épiant la meute : il devient sa victime.`, { nom: nom(a.acteurId) }));
      sortie.messages.push(msg(a.acteurId, "EpierRepere", "Des yeux jaunes se tournent vers vous dans la brume. Vous avez été vu.", {}));
    } else {
      sortie.messages.push(victimeMeute
        ? msg(a.acteurId, "Epier", `Caché dans la brume, vous entendez la meute désigner sa proie : ${nom(victimeMeute)}.`, { nom: nom(victimeMeute) })
        : msg(a.acteurId, "EpierRien", "La meute rôde mais ne s'accorde sur aucune proie.", {}));
    }
  }

  // La victime de la peste noire : la dernière notée (une par nuit).
  const victimePeste = retenues.filter(a => a.roleCle === CLE_PESTE && a.cibles[0]).at(-1)?.cibles[0] ?? null;

  // 4. Attaques.
  const attaques = [];
  if (victimeMeute) attaques.push({ cible: victimeMeute, cause: CAUSES.meute, meute: true, loup: meuteEntre(victimeMeute) });
  // La peste frappe comme la meute (mêmes protections), sans loup qui entre.
  if (victimePeste) attaques.push({ cible: victimePeste, cause: CAUSES.peste, meute: true, peste: true });
  for (const a of parEffet("tuer")) {
    if (a.cibles[0]) attaques.push({ cible: a.cibles[0], cause: a.acteur?.camp === "meute" ? CAUSES.meute : CAUSES.nuit, meute: a.acteur?.camp === "meute" });
  }

  // Une attaque de loup arrêtée avant d'atteindre sa proie : asile de la Chapelle, Taverne sans loup, verrou du Forgeron
  // (le premier seulement). Renvoie la raison, ou "".
  const verrousServis = new Set();
  const sansProtection = cible => taverne.has(cible) && loupATaverne;   // un loup dort à la Taverne : aucune protection ne joue
  const bloqueeALaPorte = cible => {
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

  // Morsure : la proie désignée par la Louve est mordue au lieu d'être tuée, et rejoint la meute (sauf si protégée).
  for (const a of parEffet("mordre")) {
    const cible = a.cibles[0];
    if (!cible || !vivant(cible)) continue;
    for (let i = attaques.length - 1; i >= 0; i--) if (attaques[i].meute && attaques[i].cible === cible) attaques.splice(i, 1);
    const porte = bloqueeALaPorte(cible);
    if (porte) noterBlocage(cible, porte);
    else if (proteges.has(cible) && !sansProtection(cible)) {
      sortie.sauves.push({ acteurId: cible, par: "proteger" });
      sortie.messages.push(msg("mj", "MorsureEvitee", `La morsure sur ${nom(cible)} a été repoussée.`, { nom: nom(cible) }));
    } else if (parId.get(cible).camp !== "meute") {
      sortie.changements.push({ type: "camp", acteurId: cible, camp: "meute" });
      sortie.messages.push(msg(cible, "Mordu", "Une morsure dans la nuit : vous rejoignez la meute, en secret.", {}));
      sortie.messages.push(msg("mj", "MorsureMj", `${nom(cible)} a été mordu et rejoint la meute.`, { nom: nom(cible) }));
    }
  }

  // Les victimes de la nuit (avant remède) : la proie de la meute, même mordue, et les autres attaques.
  const victimes = new Set([...attaques.map(x => x.cible), ...parEffet("mordre").map(a => a.cibles[0]).filter(Boolean)]);

  // 5. Herboriste : remède sur une victime de la nuit ; sur un autre joueur, c'est le poison. Une fiole vide ne verse rien.
  const remedies = new Set();
  for (const a of parEffet("remede")) {
    const c = a.cibles[0];
    if (!c) continue;
    const fiole = victimes.has(c) ? "remede" : c !== a.acteurId ? "poison" : "";
    if (fiole && sortie.fioles[a.acteurId]?.[fiole]) {
      sortie.fiolesVides.push(a.acteurId);
      sortie.messages.push(fiole === "remede"
        ? msg(a.acteurId, "FioleVideRemede", "Votre fiole de remède est vide : rien ne se passe.", {})
        : msg(a.acteurId, "FioleVidePoison", "Votre fiole de poison est vide : rien ne se passe.", {}));
      continue;
    }
    if (!fiole) {
      // Sur soi, hors danger : aucune fiole ne s'ouvre, l'usage lui est rendu (comme une fiole vide).
      sortie.fiolesVides.push(a.acteurId);
      sortie.messages.push(msg(a.acteurId, "FiolesBouchees", "Vous n'étiez pas en danger cette nuit : vos fioles restent bouchées.", {}));
      continue;
    }
    (sortie.fioles[a.acteurId] ??= {})[fiole] = true;
    if (victimes.has(c)) remedies.add(c);
    else if (c !== a.acteurId) {
      attaques.push({ cible: c, cause: CAUSES.poison, traverse: true });
      sortie.messages.push(msg("mj", "Poison", `${nom(a.acteurId)} a versé son poison à ${nom(c)}.`, { qui: nom(a.acteurId), nom: nom(c) }));
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
    if (x.meute) {
      const porte = bloqueeALaPorte(x.cible);
      if (porte) { noterBlocage(x.cible, porte, x.peste); continue; }
    }
    if (remedies.has(x.cible)) {
      sortie.sauves.push({ acteurId: x.cible, par: "remede" });
      sortie.messages.push(msg("mj", "SauveRemede", `${nom(x.cible)} a été sauvé par un remède.`, { nom: nom(x.cible) }));
      continue;
    }
    if (proteges.has(x.cible) && !x.traverse && !(x.meute && sansProtection(x.cible))) {
      sortie.sauves.push({ acteurId: x.cible, par: "proteger" });
      sortie.messages.push(msg("mj", "SauveProtection", `${nom(x.cible)} était protégé cette nuit.`, { nom: nom(x.cible) }));
      continue;
    }
    meurt(x.cible, x.cause);
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
  if (victimeMeute && loupMeute) entrees.push({ loup: loupMeute, cible: victimeMeute });
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
    if (d) {   // deux cibles (le Sourcier) : même camp ou non
      const meme = apparenceDe(parId.get(c)) === apparenceDe(parId.get(d));
      sortie.messages.push(msg(a.acteurId, meme ? "MemeCamp" : "PasMemeCamp",
        meme ? `${nom(c)} et ${nom(d)} sont du même camp.` : `${nom(c)} et ${nom(d)} ne sont pas du même camp.`, { a: nom(c), b: nom(d) }));
    } else {
      const camp = apparenceDe(parId.get(c));
      sortie.messages.push(msg(a.acteurId, "VoirCamp", `Les cendres parlent : ${nom(c)} est du camp « ${camp} ».`, { nom: nom(c), camp }));
    }
  }
  for (const a of parEffet("voir-role-mort")) {
    const c = a.cibles[0];
    if (!c) continue;
    const mort = parId.get(c);
    sortie.messages.push(mort.vivant === false
      ? msg(a.acteurId, "VoirRoleMort", `${nom(c)} était : ${mort.role?.nom ?? mort.role?.cle ?? "?"}.`, { nom: nom(c), role: mort.role?.nom ?? mort.role?.cle ?? "?" })
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
    visites.add(victimeMeute);
  }
  if (victimePeste) visites.add(victimePeste);
  sortie.bilan = { sorties: [...sorties], visites: [...visites], victime: victimeMeute ?? victimePeste ?? "", loup: victimeMeute ? loupMeute ?? "" : "",
    sauves: sortie.sauves.length, attaques: attaques.length };
  // Une proie tuée sur l'autre rive bloque le Pont la nuit suivante : la peste comme la meute (rien ne doit les distinguer).
  const franchi = (victime, cause) => Boolean(victime && sortie.deces.some(d => d.acteurId === victime && d.cause === cause) && surLAutreRive(parId.get(victime)?.maison));
  sortie.pontFranchi = franchi(victimeMeute, CAUSES.meute) || franchi(victimePeste, CAUSES.peste);
  return sortie;
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
