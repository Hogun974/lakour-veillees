// Les POLITIQUES de jeu par rôle (Le Pacte, étape 6) : ce que ferait un joueur selon ce qu'il SAIT, pour les joueurs simulés des
// essais (essais/doublures/foundry-loups.mjs, le simulateur essais/outils/simuler-veillees.mjs) et, demain, pour les compagnons IA
// sans modèle (le repli du moteur lakour-mj-ia : docs/equilibre-veillees.md, « À brancher dans le moteur »). Logique pure.
//
// L'ADRESSE (0 à 1) : à chaque décision, le joueur use de son information avec cette probabilité, sinon il fait comme un joueur au
// hasard (le comportement des joueurs simulés d'avant l'étape 6). 0 : toujours au hasard ; 1 : toujours ce qu'il sait.
//
// 1. Le savoir d'un joueur : savoirDuJoueur({ moi, camp, allies, textes, publics, villageois, gabarits, nomsDesRoles, nomsDesCamps,
//    annonces, roles, voisins, registre, role, groupes, charmesAppeles }) — son carnet (textes : visions de la Liseuse et des autres, lanterne, flair
//    du Furet, Enfant de la brume, Fournière, Prieur, Pèlerine, prime du Chasseur, charmes, oies de la Gardeuse ; le Spiritisme ne dit que oui ou non : non
//    lu), le chat public (publics : tombes, rasoir), les rôles révélés (villageois), le Registre (qui a voté contre un loup
//    démasqué) et les annonces du débat (annonces : « X est un loup », dit par Y ; démenties, elles trahissent leur auteur ; vérifiées,
//    elles le rendent fiable). Les textes sont lus d'après les gabarits du dictionnaire du système (LAKOUR_LOUPS, français ou anglais).
//    -> { moi, camp, allies: [id], loups: [id], innocents: [id], roles: { id: cle }, soupcons: { id: n }, utiles: [id], amoureux: [id],
//         menteurs: [id], objectifs: [id] (un solitaire : sa prime, l'autre groupe de l'Illuminé — role, groupes),
//         charmes: [id], vielle: [id], vielleConnue: [id], vielleEnJeu, menaceDeLaVielle (le Joueur de vielle, étape 6c : ci-dessous) }
//    Le Joueur de vielle (Le Pacte, étape 6c ; sa règle ne change pas) : un charmé SAIT qu'il l'est et connaît les autres charmés
//    (son carnet) ; le Joueur de vielle, qui ne se charme jamais, est donc parmi les vivants non charmés (vielle : ses suspects, les
//    plus sûrs d'abord — révélé, accusé au débat, puis les non-charmés qu'on ne sait pas d'un autre rôle ; vielleConnue : ceux que
//    tous savent, révélé ou accusé). Le village le sait aussi autrement : dès que le narrateur appelle les charmés (charmesAppeles :
//    le nombre de nuits où il les a appelés, public, comme à la table), un Joueur de vielle joue (vielleEnJeu), et chaque nuit il en
//    charme deux (menaceDeLaVielle : il peut gagner à la prochaine nuit — un charmé le sait au compte près, les autres l'estiment
//    d'après les nuits d'appel). Les charmés du Village le cherchent ensemble (au vote, un même suspect ; au débat, ils l'accusent :
//    une annonce « solitaire »), le village vote contre un suspect accusé quand la menace est là, et la meute le vise aussi (la nuit et
//    au vote, sous la menace).
// 2. La nuit : politiqueDeNuit({ effet, objet, candidats, nombre, invite, savoir, adresse, hasard, roles, deja }) -> [id]
//    (POLITIQUES[effet] ou POLITIQUES_DES_GESTES[objet] ; roles : { cle: { camp, information, protection } }, l'équilibre du contenu ;
//    deja : ses choix passés pour ce réveil).
// 3. Le vote : politiqueDeVote({ objet, candidats, savoir, adresse, hasard, place }) -> id | "" (place : { rumeur, proie }, ce dont le
//    village et la meute se sont parlé : la rumeur du jour, rumeurDuJour, sur laquelle le village s'accorde ; la proie concertée de la
//    meute, proieDuVoteDeLaMeute). La nuit, la meute s'accorde aussi : une proie commune.
// 4. Le jour : politiqueDuJour({ possibles, savoir, adresse, hasard }) -> { pouvoir, cibles } | null (NATURE_DES_POUVOIRS).
// 5. Le débat : annoncesDuJoueur({ savoir, adresse, hasard, dejaDites }) -> [{ cible, camp }] (ce qu'il dit tout haut ; un loup ment
//    parfois).
import { choisir, melanger, hacher } from "./hasard.mjs";

export const ADRESSE_PAR_DEFAUT = 0.7;
// La part des loups adroits qui accusent un innocent au débat, chaque jour (multipliée par l'adresse).
export const MENSONGE_DE_LA_MEUTE = 0.15;

// ------------------------------------------------------------------ les gabarits lus dans le carnet et au chat
// [chemin dans LAKOUR_LOUPS, sens] : le sens dit ce qu'on en apprend.
export const GABARITS_DU_SAVOIR = [
  ["Nuit.VoirRole", "role"], ["Nuit.VoirCamp", "camp"], ["Nuit.VoirRoleMort", "role"], ["Nuit.VisionDeuil", "camp"],
  ["Nuit.EclairerOui", "loups"], ["Nuit.EpierLoups", "loups"], ["Nuit.FuretOui", "trio"], ["Nuit.FuretNon", "innocents"],
  ["Nuit.MemeCamp", "meme"], ["Nuit.PasMemeCamp", "autre"], ["Nuit.ActifOui", "sorti"], ["Nuit.ActifVu", "sorti"],
  ["Nuit.Amour", "amour"], ["Nuit.AmourDouble", "amour"],
  ["Jour.Cimetiere", "camp"], ["Jour.PelerinePrive", "camp"], ["Jour.ConfessionPrive", "role"], ["Jour.RasoirLoup", "loup"],
  ["Jour.RasoirInnocent", "innocent"], ["Village.Fourniere", "loup"], ["Pacte.OiesCarnet", "oies"], ["Pacte.FratrieReconnue", "fratrie"],
  ["Passage.CampSecret", "camp"], ["Fetes.Ames.MurmureMeme", "meme"], ["Fetes.Ames.MurmureAutre", "autre"], ["Nuit.Prime", "prime"],
  ["Ambigus.Charmes", "charmes"], ["Ambigus.CharmeSeul", "charme"]
];
const chemin = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Un gabarit « Les cendres parlent : {nom} est du camp « {camp} ». » -> une expression qui lit nom et camp.
export function lecteurDeGabarit(gabarit) {
  const vus = new Set();
  // Une marque de genre (grammaire.mjs : « chez [lui|elle] ») se lit sous l'une ou l'autre forme.
  const corps = String(gabarit).split(/(\{\w+\}|\[(?:\w+:)?[^[\]|{}]*\|[^[\]|{}]*\])/).map(m => {
    const g = /^\[(?:\w+:)?([^[\]|{}]*)\|([^[\]|{}]*)\]$/.exec(m);
    if (g) return `(?:${echapper(g[1])}|${echapper(g[2])})`;
    const p = /^\{(\w+)\}$/.exec(m);
    if (!p) return echapper(m);
    if (vus.has(p[1])) return `\\k<${p[1]}>`;
    vus.add(p[1]);
    return `(?<${p[1]}>.+?)`;
  }).join("");
  return new RegExp(`^${corps}$`, "u");
}
const lecteursCache = new WeakMap();
function lecteurs(gabarits) {
  if (!gabarits || typeof gabarits !== "object") return [];
  if (lecteursCache.has(gabarits)) return lecteursCache.get(gabarits);
  const l = GABARITS_DU_SAVOIR.map(([p, sens]) => ({ sens, re: typeof chemin(gabarits, p) === "string" ? lecteurDeGabarit(chemin(gabarits, p)) : null })).filter(x => x.re);
  lecteursCache.set(gabarits, l);
  return l;
}
const sansBalises = s => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1").replace(/\s+/g, " ").trim();
const listeDeNoms = s => String(s ?? "").split(/, | et | and /).map(x => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ le savoir d'un joueur
// villageois : [{ id, nom, vivant, revele, camp (public : révélé), role (clé révélée, ou la sienne) }].
// nomsDesRoles : { nom affiché: cle } ; nomsDesCamps : { libellé: camp } ; roles : { cle: { camp, information, protection } } ;
// voisins(id) -> [id] (le cercle, pour les oies) ; annonces : [{ par, cible, camp }].
export function savoirDuJoueur({ moi = "", camp = "village", allies = [], textes = [], publics = [], villageois = [], gabarits = null,
  nomsDesRoles = {}, nomsDesCamps = {}, annonces = [], roles = {}, voisins = null, registre = [], role = "", groupes = null, charmesAppeles = 0 } = {}) {
  const parNom = new Map(villageois.map(v => [v.nom, v.id]));
  const idDe = nom => parNom.get(String(nom ?? "").trim()) ?? "";
  const campDe = libelle => nomsDesCamps[String(libelle ?? "").trim()] ?? ({ meute: "meute", village: "village", solitaire: "solitaire" })[String(libelle ?? "").trim().toLowerCase()] ?? "";
  const loups = new Set(), innocents = new Set(), amoureux = new Set(), connus = new Map(), soupcons = new Map(), menteurs = new Set();
  const soupconner = (id, n) => { if (id && id !== moi) soupcons.set(id, (soupcons.get(id) ?? 0) + n); };
  // Un solitaire découvert n'est pas un innocent : un danger pour le Village aussi (le Revenant excepté : le pendre le fait gagner).
  const solitaires = new Map();
  const marquer = (id, c) => { if (!id) return; if (c === "meute") loups.add(id); else if (c === "solitaire") solitaires.set(id, solitaires.get(id) ?? ""); else if (c) innocents.add(id); };
  let charmes = null;
  const relations = [];
  // Ceux qu'un solitaire veut voir tomber : la cible du Chasseur de primes (son carnet), l'autre groupe de l'Illuminé (public).
  const objectifs = new Set(role === "illumine" && groupes ? (groupes.a?.includes(moi) ? groupes.b : groupes.b?.includes(moi) ? groupes.a : []) ?? [] : []);
  for (const v of villageois) {
    if (v.id === moi) continue;
    if (v.revele && v.camp) marquer(v.id, v.camp);
    if (v.revele && v.role) connus.set(v.id, v.role);
  }
  const lire = (texte, prive) => {
    const t = sansBalises(texte);
    if (!t) return;
    const morceaux = [t, ...t.split(/(?<=[.!?»])\s+/)];
    for (const { sens, re } of lecteurs(gabarits)) {
      const m = morceaux.map(x => re.exec(x)).find(Boolean);
      if (!m) continue;
      const g = m.groups ?? {};
      if (sens === "role") {
        const id = idDe(g.nom), cle = nomsDesRoles[g.role?.trim()] ?? "";
        if (cle) connus.set(id, cle);
        marquer(id, g.camp ? campDe(g.camp) : roles[cle]?.camp ?? "");
        if (cle && solitaires.has(id)) solitaires.set(id, cle);
      } else if (sens === "camp") marquer(idDe(g.nom), campDe(g.camp));
      else if (sens === "loup") marquer(idDe(g.nom), "meute");
      else if (sens === "innocent") marquer(idDe(g.nom), "village");
      else if (sens === "loups") for (const n of listeDeNoms(g.loups ?? g.noms)) marquer(idDe(n), "meute");
      else if (sens === "innocents" || (sens === "fratrie" && camp !== "meute")) for (const n of listeDeNoms(g.noms)) marquer(idDe(n), "village");
      else if (sens === "trio") for (const n of listeDeNoms(g.noms)) soupconner(idDe(n), 1);
      else if (sens === "sorti") soupconner(idDe(g.nom), 0.5);
      else if (sens === "amour" && prive) amoureux.add(idDe(g.nom));
      else if (sens === "prime" && prive && idDe(g.nom)) objectifs.add(idDe(g.nom));
      else if (sens === "charmes" && prive) charmes = new Set([moi, ...listeDeNoms(g.noms).map(idDe).filter(Boolean)]);
      else if (sens === "charme" && prive) charmes = new Set([moi]);
      else if (sens === "meme" || sens === "autre") relations.push({ a: idDe(g.a), b: idDe(g.b), meme: sens === "meme" });
      // Les oies cacardent sans nom au village ; la Gardeuse seule apprend (son carnet) que ce sont les siennes : elle soupçonne ses voisins.
      else if (sens === "oies" && prive && typeof voisins === "function") for (const id of voisins(moi) ?? []) soupconner(id, 1);
    }
  };
  for (const x of textes) lire(x, true);
  for (const x of publics) lire(x, false);
  // Deux joueurs du même camp (ou non) : l'un connu fait connaître l'autre.
  for (let tour = 0; tour < 2; tour++) for (const { a, b, meme } of relations) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!x || !y) continue;
      if (loups.has(x)) meme ? loups.add(y) : innocents.add(y);
      else if (innocents.has(x) && x !== moi) { if (meme) innocents.add(y); else loups.add(y); }
      else if (x === moi && camp) { if (meme) marquer(y, camp === "meute" ? "meute" : "village"); else if (camp !== "meute") loups.add(y); }
    }
  }
  // Les annonces du débat : une annonce démentie (le désigné révélé d'un autre camp) trahit son auteur ; les autres valent un fort
  // soupçon (le loup) ou une présomption d'innocence.
  const revele = new Map(villageois.filter(v => v.revele && v.camp).map(v => [v.id, v.camp]));
  // (Une accusation de jouer de la vielle, « solitaire », n'est jamais démentie : un charmé se trompe de bonne foi.)
  for (const a of annonces) {
    if (a.camp === "solitaire") continue;
    const vrai = revele.get(a.cible);
    if (vrai && (vrai === "meute") !== (a.camp === "meute")) { menteurs.add(a.par); continue; }
  }
  for (const id of menteurs) if (id !== moi) loups.add(id);
  // Une annonce confirmée (le loup désigné, révélé loup) rend son auteur fiable : ses autres annonces valent une vision.
  const fiables = new Set(fiablesDesAnnonces(annonces, revele).filter(id => !menteurs.has(id)));
  // Les accusés de jouer de la vielle (annonces « solitaire » des charmés) : combien de fois.
  const accusesDeVielle = new Map();
  for (const a of annonces) {
    if (menteurs.has(a.par) || a.par === moi || loups.has(a.par)) continue;
    if (a.camp === "solitaire") { if (a.cible !== moi) { accusesDeVielle.set(a.cible, (accusesDeVielle.get(a.cible) ?? 0) + 1); soupconner(a.cible, 1); } continue; }
    if (a.camp === "meute" && fiables.has(a.par) && !revele.has(a.cible)) loups.add(a.cible);
    else if (a.camp === "meute") soupconner(a.cible, 3); else soupconner(a.cible, -2);
  }
  for (const id of fiables) if (id !== moi && !loups.has(id)) innocents.add(id);
  // Le Registre (public) : qui a voté contre un loup démasqué est presque sûrement du Village (la meute ne vote pas contre les siens) ;
  // qui a fait condamner un innocent l'est un peu moins.
  for (const x of registre ?? []) {
    if (x?.type !== "vote" || x.annule || !x.votes) continue;
    for (const [votant, cible] of Object.entries(x.votes)) {
      if (!cible || votant === moi) continue;
      if (revele.get(cible) === "meute") soupconner(votant, -2);
      else if (revele.get(cible) && (x.elus ?? []).includes(cible)) soupconner(votant, 0.5);
    }
  }
  for (const [id, cle] of solitaires) if (id !== moi && !loups.has(id)) soupconner(id, cle === "revenant" ? -10 : cle ? 3 : 0.5);
  for (const id of [...loups]) if (innocents.has(id)) innocents.delete(id);
  const alliesSet = new Set(allies.filter(id => id && id !== moi));
  // Le Joueur de vielle (étape 6c, voir l'en-tête) : ses suspects, la menace.
  const vivantsIds = villageois.filter(v => v.vivant !== false).map(v => v.id);
  const vielleEnJeu = role !== "joueur-de-vielle" && (Boolean(charmes) || Number(charmesAppeles) > 0);
  const vielle = [];
  let menaceDeLaVielle = false;
  if (vielleEnJeu) {
    const possible = id => id !== moi && vivantsIds.includes(id) && !alliesSet.has(id) && !loups.has(id) && !innocents.has(id)
      && (!connus.get(id) || connus.get(id) === "joueur-de-vielle") && (!charmes || !charmes.has(id));
    const revelee = vivantsIds.filter(id => id !== moi && connus.get(id) === "joueur-de-vielle");
    const accuses = [...accusesDeVielle].filter(([id]) => possible(id)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
    const libres = charmes ? vivantsIds.filter(id => !charmes.has(id) && id !== moi) : [];
    for (const id of [...revelee, ...accuses, ...libres.filter(possible).sort()]) if (!vielle.includes(id)) vielle.push(id);
    // Charmé : il peut gagner cette nuit si, lui excepté, il ne reste que deux non-charmés ; sinon : deux charmés par nuit d'appel.
    menaceDeLaVielle = charmes ? libres.length <= 3 : vivantsIds.length - 2 * Number(charmesAppeles) <= 3;
  }
  const vielleConnue = vielle.filter(id => connus.get(id) === "joueur-de-vielle" || accusesDeVielle.has(id));
  // Les rôles utiles (information, protection) connus ou révélés, et ceux qui ont parlé au débat (ils savent quelque chose) : les
  // cibles de la meute, les protégés du Garde.
  const utiles = new Set([...connus].filter(([id, cle]) => roles[cle]?.camp === "village" && (roles[cle]?.information || roles[cle]?.protection)).map(([id]) => id));
  for (const a of annonces) if (!menteurs.has(a.par) && !loups.has(a.par)) utiles.add(a.par);
  loups.delete(moi); innocents.delete(moi); utiles.delete(moi);
  return {
    moi, camp, allies: [...alliesSet], loups: [...loups], innocents: [...innocents], roles: Object.fromEntries(connus), soupcons: Object.fromEntries(soupcons),
    utiles: [...utiles], amoureux: [...amoureux].filter(Boolean), menteurs: [...menteurs], objectifs: [...objectifs].filter(id => id !== moi),
    charmes: charmes ? [...charmes] : [], vielle, vielleConnue, vielleEnJeu, menaceDeLaVielle
  };
}

// ------------------------------------------------------------------ outils de choix
// Le contexte d'une décision : candidats (ids), savoir, adresse, hasard.
function outils({ candidats = [], savoir = {}, adresse = 0, hasard = Math.random }) {
  const ids = candidats.map(c => (typeof c === "object" ? c.id : c)).filter(Boolean);
  const moi = savoir.moi ?? "";
  const loup = savoir.camp === "meute";
  const amis = new Set([...(savoir.allies ?? []), ...(savoir.amoureux ?? [])]);
  const loups = new Set(savoir.loups ?? []), innocents = new Set(savoir.innocents ?? []), utiles = new Set(savoir.utiles ?? []);
  const soupcon = id => (loups.has(id) ? 10 : 0) + (innocents.has(id) ? -10 : 0) + Number(savoir.soupcons?.[id] ?? 0);
  const autres = ids.filter(id => id !== moi);
  const adroit = () => hasard() < adresse;
  const un = l => (l.length ? [choisir(l, hasard)] : []);
  const tirer = (l, n) => melanger(l, hasard).slice(0, Math.max(0, n));
  // Les plus soupçonnés d'abord (à égalité, au hasard).
  const parSoupcon = l => melanger(l, hasard).sort((a, b) => soupcon(b) - soupcon(a));
  // Pour un villageois : les loups connus parmi l', puis les plus soupçonnés ; pour un loup : les non-loups, les utiles d'abord.
  const ennemis = l => (loup ? l.filter(id => !amis.has(id) && id !== moi) : l.filter(id => id !== moi && !amis.has(id) && !innocents.has(id)));
  const inconnus = l => l.filter(id => id !== moi && !amis.has(id) && !loups.has(id) && !innocents.has(id) && !(savoir.roles ?? {})[id]);
  const surs = l => l.filter(id => id === moi ? false : loup ? amis.has(id) : (innocents.has(id) || utiles.has(id) || amis.has(id)) && !loups.has(id));
  // Le Joueur de vielle (étape 6c) : ses suspects parmi l (dans l'ordre du savoir : les plus sûrs d'abord), et celui sur lequel
  // s'accordent ceux qui savent la même chose (les charmés entre eux, la meute) : un tirage commun, comme la proie de la meute, parmi
  // ceux que tous savent (révélé, accusé) s'il y en a, sinon parmi les autres.
  const vielle = l => (savoir.vielle ?? []).filter(id => l.includes(id) && id !== moi && !amis.has(id));
  const vielleCommune = l => {
    const v = vielle(l);
    if (!v.length) return "";
    const connus = v.filter(id => (savoir.vielleConnue ?? []).includes(id));
    return commun(connus.length ? connus : v, `vielle|${[...v].sort().join(",")}`);
  };
  return { ids, moi, loup, amis, loups, innocents, utiles, soupcon, autres, adroit, un, tirer, parSoupcon, ennemis, inconnus, surs, hasard, adresse,
    vielle, vielleCommune, charme: (savoir.charmes ?? []).length > 0, menace: Boolean(savoir.menaceDeLaVielle) };
}
// Le choix au hasard d'avant l'étape 6 (essais/doublures/foundry-loups.mjs, choixDeNuit : « default ») : souvent, n'importe qui.
const auHasard = (o, n) => (o.hasard() < 0.8 ? o.tirer(o.ids, n) : []);

// La cible d'une attaque : loup -> un rôle utile (révélé, ou qui a parlé), sinon un non-loup ; villageois -> un loup connu.
// La meute s'accorde : chaque loup qui voit les mêmes candidats et sait la même chose (les utiles sont publics) choisit la même
// proie — un tirage commun, tiré des candidats eux-mêmes (avec la Veillée aux chandelles angoissante, chaque loup souffle la sienne :
// des loups qui ne s'accordent pas n'ont pas de victime).
const commun = (liste, cle) => [...liste].sort((a, b) => hacher(`${cle}|${a}`) - hacher(`${cle}|${b}`))[0];
function viserPourTuer(o, n = 1) {
  if (o.loup) {
    const proies = o.ennemis(o.autres);
    const utiles = proies.filter(id => o.utiles.has(id));
    const cle = [...o.ids].sort().join(",");
    const adroite = hacher(`adresse|${cle}`) / 4294967296 < o.adresse;
    // Étape 6c : sous la menace du Joueur de vielle (il peut gagner cette nuit), la meute le vise d'abord.
    const vielle = o.menace ? o.vielleCommune(proies) : "";
    if (adroite && vielle) return [vielle];
    if (adroite && utiles.length) return [commun(utiles, cle)];
    const l = proies.length ? proies : o.autres;
    return l.length ? [commun(l, cle)] : [];
  }
  return o.un(o.autres.filter(id => o.loups.has(id))).slice(0, n);
}

// ------------------------------------------------------------------ la nuit, par effet de rôle
// Chaque politique reçoit o (outils) et la demande d ({ nombre, invite, objet, deja, roles }) et rend des ids.
export const POLITIQUES = {
  // La meute (et un loup qui tue seul), le Pêcheur de nuit (harpon : un loup connu, sinon on le garde), la Dame du gué.
  tuer: (o, d) => {
    if (o.loup) return viserPourTuer(o, d.nombre);
    if (!o.adroit()) return auHasard(o, d.nombre);
    const loups = o.autres.filter(id => o.loups.has(id));
    if (loups.length) return o.un(loups);
    return d.solitaire ? o.un(o.parSoupcon(o.autres).slice(0, 3)) : [];
  },
  // Le Loup pâle : un autre loup, une nuit sur deux (il gagne seul).
  trahir: (o, d) => {
    const loups = o.autres.filter(id => o.amis.has(id));
    return o.adroit() && loups.length ? o.un(loups) : auHasard(o, d.nombre);
  },
  // La Louve mère : la proie de la nuit (seule candidate) ; adroite, elle mord toujours.
  mordre: (o, d) => (o.adroit() ? o.tirer(o.autres, 1) : auHasard(o, d.nombre)),
  // Le Loup hurleur : faire taire qui parle (un utile, un accusateur), jamais un loup.
  silence: (o, d) => (o.adroit() ? viserPourTuer(o) : auHasard(o, d.nombre)),
  // Les visions (Liseuse, Sourcier, Louvetier, Loup flaireur, Ermite, Loup des roseaux) : un inconnu, vivant, pas déjà sondé.
  "voir-role": (o, d) => sonder(o, d), "voir-camp": (o, d) => sonder(o, d), "voir-actif": (o, d) => sonder(o, d),
  // La Veilleuse : la lanterne là où la meute frappera (un utile, ou qui a parlé), sinon chez un inconnu.
  eclairer: (o, d) => {
    if (!o.adroit()) return o.tirer(o.ids, d.nombre);
    const utiles = o.autres.filter(id => o.utiles.has(id) && !o.loups.has(id));
    return utiles.length ? o.un(utiles) : o.un(o.inconnus(o.autres).length ? o.inconnus(o.autres) : o.autres);
  },
  // Le Fossoyeur : une tombe dont on ignore le rôle.
  "voir-role-mort": (o, d) => (o.adroit() && o.inconnus(o.ids).length ? o.un(o.inconnus(o.ids)) : o.tirer(o.ids, d.nombre)),
  // L'Herboriste : le remède à la victime (sauf un loup connu), le poison à un loup connu (sinon gardé).
  remede: (o, d) => {
    const attaques = listeDeNoms(/(?:a attaqué|attacked) (.+?)\. /.exec(d.invite ?? "")?.[1] ?? "");
    const victimes = (d.candidatsComplets ?? []).filter(c => attaques.includes(c.nom)).map(c => c.id);
    if (!o.adroit()) {
      if (victimes.length && o.hasard() < 0.6) return o.tirer(victimes, 1);
      return o.hasard() < 0.4 ? o.tirer(o.autres.filter(id => !victimes.includes(id)), 1) : [];
    }
    const sauver = victimes.filter(id => !o.loups.has(id));
    const poison = o.autres.filter(id => o.loups.has(id) && !victimes.includes(id));
    return [...o.tirer(sauver, 1), ...(d.nombre >= 2 || !sauver.length ? o.tirer(poison, 1) : [])].slice(0, Math.max(1, d.nombre));
  },
  // Le Garde du pont, la Gardienne des clés : un utile révélé ou qui a parlé, un sûr ; sinon au hasard (la cible d'hier est déjà retirée).
  proteger: (o, d) => {
    if (!o.adroit()) return o.tirer(o.ids, d.nombre);
    const utiles = o.ids.filter(id => o.utiles.has(id) && !o.loups.has(id) && id !== o.moi);
    const surs = o.surs(o.ids);
    return o.un(utiles.length ? utiles : surs.length ? surs : o.ids.filter(id => !o.loups.has(id)));
  },
  // Le Sonneur : un pouvoir de jour (rien la nuit).
  "vote-double": () => [],
  // La Braconnière (son dernier geste) : un loup connu, sinon le plus soupçonné ; mordue, un utile.
  emporter: (o, d) => (o.adroit() ? (o.loup ? viserPourTuer(o) : o.un(o.parSoupcon(o.ennemis(o.autres)).slice(0, 1))) : auHasard(o, d.nombre)),
  // Le Juge de paix : un pouvoir de jour.
  "annuler-vote": () => [],
  // L'Enfant de la brume : épier (soi), une nuit sur deux à peu près (le risque d'être surprise est le même pour tous).
  epier: (o, d) => (o.ids.includes(o.moi) && o.hasard() < 0.5 ? [o.moi] : []),
  // Le Messager : l'expéditeur et le destinataire, au hasard (le mot ne porte pas d'information simulée).
  messager: (o, d) => o.tirer(o.ids, d.nombre),
  // L'Entremetteuse : deux amants, au hasard.
  "lien-amour": (o, d) => o.tirer(o.ids, d.nombre),
  // Les rôles sans réveil propre (Aïeul, Souffre-douleur, Innocent, Lavandières, Bûcherons, Gardeuse d'oies, Vieux Sergent, Greffier
  // bègue) : s'ils sont réveillés (seconde carte, Bateleur…), au hasard ; leurs gestes ont leur politique (POLITIQUES_DES_GESTES).
  resister: (o, d) => auHasard(o, d.nombre), egalite: (o, d) => auHasard(o, d.nombre), grace: (o, d) => auHasard(o, d.nombre),
  fratrie: (o, d) => auHasard(o, d.nombre), cacarder: (o, d) => auHasard(o, d.nombre), contaminer: (o, d) => auHasard(o, d.nombre),
  "second-vote": () => [],
  // Le Furet : le centre d'un trio d'inconnus.
  flairer: (o, d) => (o.adroit() && o.inconnus(o.autres).length ? o.un(o.inconnus(o.autres)) : auHasard(o, d.nombre)),
  // La Pie : la plume sur un loup connu, sinon le plus soupçonné ; louve, sur un utile.
  plume: (o, d) => (o.adroit() ? (o.loup ? viserPourTuer(o) : o.un(o.parSoupcon(o.ennemis(o.autres)).slice(0, 1))) : auHasard(o, d.nombre)),
  // L'Incendiaire : le bâtiment d'un loup connu ; sinon il garde son feu.
  incendier: (o, d) => (o.adroit() ? o.un(o.ids.filter(id => o.loups.has(id))) : (o.hasard() < 0.5 ? o.tirer(o.ids, 1) : [])),
  // Le Chapardeur : au hasard (le centre est secret).
  chaparder: (o, d) => auHasard(o, d.nombre),
  // Le Bateleur : une carte d'information d'abord (Liseuse, visions), sinon une protection.
  emprunter: (o, d) => {
    if (!o.adroit()) return auHasard(o, d.nombre);
    const cles = (d.candidatsComplets ?? []).map(c => ({ id: c.id, cle: d.nomsDesRoles?.[String(c.nom).split(" — ")[0]] ?? "" }));
    const rang = c => (d.roles?.[c.cle]?.information ? 2 : d.roles?.[c.cle]?.protection ? 1 : 0);
    const meilleurs = cles.sort((a, b) => rang(b) - rang(a)).filter((c, _, l) => rang(c) === rang(l[0])).map(c => c.id);
    return o.un(meilleurs.length ? meilleurs : o.ids);
  },
  // L'Enfant des bois : un modèle sûr (un innocent connu, un rôle utile), sinon au hasard.
  modele: (o, d) => {
    const surs = o.surs(o.autres);
    return o.adroit() && surs.length ? o.un(surs) : o.tirer(o.autres.length ? o.autres : o.ids, 1);
  },
  // Le Mâtin : se désigner, c'est rejoindre la meute ; un choix de goût, pas d'adresse (deux fois sur cinq).
  "choisir-camp": (o, d) => (o.ids.includes(o.moi) && o.hasard() < 0.4 ? [o.moi] : []),
  // La Chambrière : se dévouer pour un condamné sûr (sa carte reste au Village) ; sinon rarement.
  devouement: (o, d) => {
    const surs = o.ids.filter(id => o.innocents.has(id) || o.utiles.has(id));
    return o.adroit() ? o.un(surs) : (o.hasard() < 0.2 ? o.tirer(o.ids, 1) : []);
  },
  // La Liseuse d'étoiles : une séance dès qu'elle le peut.
  spiritisme: (o, d) => (o.ids.includes(o.moi) && (o.adroit() || o.hasard() < 0.5) ? [o.moi] : []),
  // Le Colporteur : échanger, une fois sur deux (avec un rôle utile révélé, s'il en connaît un).
  "echanger-role": (o, d) => {
    if (o.hasard() >= 0.5) return [];
    const utiles = o.autres.filter(id => o.utiles.has(id));
    return o.adroit() && utiles.length ? o.un(utiles) : o.tirer(o.ids, 1);
  },
  // Le Pyromane : asperger, embraser une fois sur quatre.
  asperger: (o, d) => (o.ids.includes(o.moi) && o.hasard() < 0.25 ? [o.moi] : o.tirer(o.autres, 1)),
  // Le Joueur de vielle : deux joueurs qu'il n'a pas encore charmés.
  charmer: (o, d) => {
    const neufs = o.autres.filter(id => !(d.deja ?? []).includes(id));
    return o.adroit() ? o.tirer(neufs.length ? neufs : o.autres, d.nombre) : auHasard(o, d.nombre);
  },
  // Les rôles sans effet (Villageois, Conteuse, Revenant, Chasseur de primes…) : au hasard.
  "": (o, d) => auHasard(o, d.nombre)
};
function sonder(o, d) {
  if (!o.adroit()) return o.tirer(o.ids, d.nombre);
  const neufs = o.inconnus(o.autres).filter(id => !(d.deja ?? []).includes(id));
  // Un villageois sonde d'abord un soupçonné ; un loup, un inconnu au hasard (il cherche les rôles utiles).
  const l = o.loup ? neufs : o.parSoupcon(neufs);
  return (l.length ? (o.loup ? o.tirer(l, d.nombre) : l.slice(0, d.nombre)) : o.tirer(o.autres.length ? o.autres : o.ids, d.nombre));
}

// Les demandes qui ne sont pas un réveil de rôle (derniers gestes, personnalités, charges, variantes, Gazette) : par objet.
export const POLITIQUES_DES_GESTES = {
  emporter: (o, d) => POLITIQUES.emporter(o, d),
  // Le Souffre-douleur : qui votera demain — les sûrs, jamais un loup connu.
  votants: (o, d) => (o.adroit() ? o.tirer(o.ids.filter(id => !o.loups.has(id) && (!o.loup || o.amis.has(id) || id === o.moi)), d.nombre) : auHasard(o, d.nombre)),
  // Le Bailli mourant, le Prévôt : un sûr (un loup : un allié).
  succession: (o, d) => (o.adroit() && o.surs(o.ids).length ? o.un(o.surs(o.ids)) : auHasard(o, d.nombre)),
  prevot: (o, d) => (o.adroit() && o.surs(o.ids).length ? o.un(o.surs(o.ids)) : auHasard(o, d.nombre)),
  logement: (o, d) => (o.adroit() ? o.tirer(o.ids, 1) : auHasard(o, d.nombre)),
  // Le Bailli qui départage : le plus soupçonné (un loup : un non-loup).
  departage: (o, d) => (o.adroit() ? o.parSoupcon(o.ennemis(o.ids)).slice(0, d.nombre) : auHasard(o, d.nombre)),
  // La Chaîne des innocents : on désigne celui dont on GARANTIT l'innocence (il s'assied ; le dernier debout est condamné) — un villageois,
  // le plus sûr (jamais un loup connu) ; un loup, un autre loup (la meute se blanchit), sinon le moins soupçonné.
  chaine: (o, d) => {
    if (!o.adroit()) return auHasard(o, d.nombre);
    if (o.loup) { const amis = o.autres.filter(id => o.amis.has(id)); return amis.length ? [choisir(amis, o.hasard)] : o.parSoupcon(o.autres).slice(-1); }
    const permis = o.autres.filter(id => !o.loups.has(id));
    return (permis.length ? o.parSoupcon(permis) : o.parSoupcon(o.autres)).slice(-1);
  },
  chambriere: (o, d) => POLITIQUES.devouement(o, d),
  // Le Hobereau : gracier un sûr ; la supplique : la demander toujours.
  grace: (o, d) => (o.adroit() ? o.ids.filter(id => o.surs([id]).length) : auHasard(o, d.nombre)),
  supplique: (o, d) => o.tirer(o.ids, d.nombre)
};

// La décision de nuit (ou d'un geste) : -> [id], au plus « nombre ».
// candidats : [{ id, nom }] ; roles : l'équilibre du contenu ({ cle: { camp, information, protection } }) ; nomsDesRoles : { nom: cle }.
export function politiqueDeNuit({ effet = "", objet = "", candidats = [], nombre = 1, invite = "", savoir = {}, adresse = ADRESSE_PAR_DEFAUT,
  hasard = Math.random, roles = {}, nomsDesRoles = {}, deja = [], solitaire = false } = {}) {
  const o = outils({ candidats, savoir, adresse, hasard });
  // Un loup qui chasse (la meute, ou un rôle sans politique propre) : sa proie.
  if (o.loup && !objet && (effet === "tuer" || !effet || !POLITIQUES[effet])) return viserPourTuer(o, nombre);
  const f = (objet && POLITIQUES_DES_GESTES[objet]) || POLITIQUES[effet] || POLITIQUES[""];
  const choix = f(o, { nombre, invite, objet, deja, roles, nomsDesRoles, solitaire, candidatsComplets: candidats.filter(c => typeof c === "object") });
  return [...new Set(choix.filter(id => o.ids.includes(id)))].slice(0, Math.max(0, nombre));
}

// ------------------------------------------------------------------ le vote
// objet : "execution" (et les votes qui condamnent), "chapelle", "bailli" ; place : { rumeur (le soupçon qui court au village),
// proie (la proie concertée de la meute) }.
export function politiqueDeVote({ objet = "execution", candidats = [], savoir = {}, adresse = ADRESSE_PAR_DEFAUT, hasard = Math.random, place = {} } = {}) {
  const o = outils({ candidats, savoir, adresse, hasard });
  const pasMoi = o.ids.filter(id => id !== o.moi);
  if (objet === "chapelle" || objet === "bailli") {
    // Un abri (la Chapelle) ou le sceau (le Bailli) : un loup à un allié (ou à lui-même pour le sceau), un villageois à un sûr.
    if (o.loup) return o.un(o.ids.filter(id => o.amis.has(id) || (objet === "bailli" && id === o.moi)))[0] ?? place.rumeur ?? "";
    const surs = o.adroit() ? o.surs(o.ids).filter(id => o.utiles.has(id)).concat(o.surs(o.ids)) : [];
    return surs[0] ?? (objet === "bailli" ? o.un(o.ids.filter(id => !o.loups.has(id)))[0] : place.rumeur) ?? "";
  }
  // Un solitaire adroit vote contre ceux qu'il veut voir tomber (sa prime, l'autre groupe), sinon il suit la rumeur.
  if (savoir.camp === "solitaire") {
    const vises = pasMoi.filter(id => (savoir.objectifs ?? []).includes(id));
    if (vises.length && o.adroit()) return choisir(vises, hasard);
    return place.rumeur && place.rumeur !== o.moi ? place.rumeur : o.un(pasMoi)[0] ?? "";
  }
  if (o.loup) {
    // La meute vote d'un bloc sa proie concertée ; adroite, elle suit la rumeur du village quand elle tombe sur un innocent. Sous la
    // menace du Joueur de vielle (étape 6c), elle vote contre lui (la rumeur, si elle le désigne).
    const vielle = o.menace ? o.vielleCommune(o.ennemis(pasMoi)) : "";
    if (vielle && o.adroit()) return o.vielle(pasMoi).includes(place.rumeur) ? place.rumeur : vielle;
    if (o.adroit() && place.rumeur && !o.amis.has(place.rumeur) && place.rumeur !== o.moi) return place.rumeur;
    if (place.proie && place.proie !== o.moi && !o.amis.has(place.proie)) return place.proie;
    return o.un(o.ennemis(pasMoi))[0] ?? "";
  }
  // Un villageois : un loup connu ; sinon (adroit) le plus soupçonné s'il l'est vraiment, jamais un innocent connu ; sinon la rumeur.
  // Adroit, il s'accorde avec le village : la rumeur du jour d'abord, si elle vaut ses meilleurs soupçons (trois loups annoncés : on
  // en pend un, plutôt que de partager ses voix entre les trois).
  const connus = pasMoi.filter(id => o.loups.has(id) && !o.amis.has(id));
  const x = hasard();
  // Le Joueur de vielle (étape 6c) : un charmé, adroit, vote avec les autres charmés contre le suspect commun quand la vielle peut
  // gagner cette nuit (avant même un loup connu : la meute ne gagne pas en une nuit) ; un villageois qui ne l'est pas, contre un
  // accusé de jouer de la vielle sous la même menace (après un loup connu : il ne sait la menace qu'à peu près).
  const vielle = o.vielleCommune(pasMoi);
  const adroitVielle = vielle && o.menace && o.adroit();
  if (adroitVielle && o.charme) return vielle;
  if (connus.length && o.adroit()) return connus.includes(place.rumeur) ? place.rumeur : choisir(connus, hasard);
  if (connus.length && hasard() < 0.85) return choisir(connus, hasard);
  if (adroitVielle && (savoir.vielleConnue ?? []).includes(vielle)) return o.vielle(pasMoi).includes(place.rumeur) ? place.rumeur : vielle;
  if (o.adroit()) {
    const suspects = o.parSoupcon(o.ennemis(pasMoi)).filter(id => o.soupcon(id) >= 1);
    // Charmé, sans menace encore : avec les autres charmés, contre le suspect commun, quand il en reste peu (trois au plus) ou qu'il
    // ne soupçonne personne d'autre fortement (un loup annoncé, ou mieux).
    if (o.charme && vielle && (o.vielle(pasMoi).length <= 3 || !suspects.some(id => o.soupcon(id) >= 3))) return vielle;
    if (suspects.length) return suspects.includes(place.rumeur) && o.soupcon(place.rumeur) >= o.soupcon(suspects[0]) - 1 ? place.rumeur : suspects[0];
    if (place.rumeur && place.rumeur !== o.moi && !o.innocents.has(place.rumeur) && !o.amis.has(place.rumeur)) return place.rumeur;
    return o.un(o.ennemis(pasMoi))[0] ?? "";
  }
  return x < 0.1 ? "" : x < 0.7 && place.rumeur !== o.moi ? place.rumeur ?? "" : choisir(pasMoi, hasard) ?? "";
}
// La rumeur du jour (ce qui court au village) : le plus soupçonné par l'ensemble des annonces, sinon au hasard.
// Les auteurs d'annonces confirmées : un loup qu'ils ont désigné a été révélé loup. revele : Map id -> camp révélé.
export function fiablesDesAnnonces(annonces = [], revele = new Map()) {
  return [...new Set(annonces.filter(a => a.camp === "meute" && revele.get(a.cible) === "meute").map(a => a.par))];
}
// fiables : les auteurs dont une annonce s'est vérifiée (leurs annonces comptent triple).
export function rumeurDuJour({ candidats = [], annonces = [], menteurs = [], hasard = Math.random, adresse = ADRESSE_PAR_DEFAUT, connus = [], fiables = [] } = {}) {
  const ids = candidats.map(c => (typeof c === "object" ? c.id : c));
  if (hasard() < adresse) {
    const score = new Map();
    for (const id of connus) if (ids.includes(id)) score.set(id, (score.get(id) ?? 0) + 5);
    // (Étape 6c : une accusation de jouer de la vielle, « solitaire », compte comme une annonce de loup.)
    for (const a of annonces) if (!menteurs.includes(a.par) && ids.includes(a.cible) && (a.camp === "meute" || a.camp === "solitaire")) score.set(a.cible, (score.get(a.cible) ?? 0) + (fiables.includes(a.par) ? 3 : 1));
    for (const id of menteurs) if (ids.includes(id)) score.set(id, (score.get(id) ?? 0) + 5);
    const max = Math.max(0, ...score.values());
    if (max > 0) return choisir([...score].filter(([, s]) => s === max).map(([id]) => id), hasard);
  }
  return choisir(ids, hasard);
}
// La proie de la meute au vote : un utile (révélé, ou qui a parlé), sinon un non-loup au hasard.
export function proieDuVoteDeLaMeute({ candidats = [], savoir = {}, adresse = ADRESSE_PAR_DEFAUT, hasard = Math.random } = {}) {
  const o = outils({ candidats, savoir, adresse, hasard });
  const proies = o.ennemis(o.ids);
  const utiles = proies.filter(id => o.utiles.has(id));
  return (o.adroit() && utiles.length ? choisir(utiles, hasard) : choisir(proies, hasard)) ?? "";
}

// ------------------------------------------------------------------ le débat
// Ce qu'un joueur dit tout haut : un villageois adroit, les loups qu'il a découverts (une fois chacun) ; un loup adroit, parfois, un
// innocent qu'il accuse (MENSONGE_DE_LA_MEUTE) ; un charmé du Village adroit (étape 6c), le suspect commun des charmés quand il en
// reste peu (trois au plus) ou que la vielle menace : « il joue de la vielle » (camp « solitaire », une fois chacun).
// -> [{ cible, camp: "meute" | "solitaire" }]
export function annoncesDuJoueur({ savoir = {}, adresse = ADRESSE_PAR_DEFAUT, hasard = Math.random, dejaDites = [], vivants = [] } = {}) {
  const dites = new Set(dejaDites);
  const vivant = id => !vivants.length || vivants.includes(id);
  if (savoir.camp === "meute") {
    if (hasard() >= adresse * MENSONGE_DE_LA_MEUTE) return [];
    const amis = new Set(savoir.allies ?? []);
    const cibles = vivants.filter(id => id !== savoir.moi && !amis.has(id) && !dites.has(id));
    const c = choisir(cibles, hasard);
    return c ? [{ cible: c, camp: "meute" }] : [];
  }
  if (savoir.camp !== "village") return [];
  const loups = (savoir.loups ?? []).filter(id => vivant(id) && !dites.has(id) && hasard() < adresse).map(cible => ({ cible, camp: "meute" }));
  if ((savoir.charmes ?? []).length && (savoir.vielle ?? []).length) {
    const o = outils({ candidats: vivants.length ? vivants : savoir.vielle, savoir, adresse, hasard });
    const suspects = o.vielle(o.ids);
    const cible = suspects.length <= 3 || o.menace ? o.vielleCommune(o.ids) : "";
    if (cible && vivant(cible) && !dites.has(cible) && !loups.some(x => x.cible === cible) && hasard() < adresse) loups.push({ cible, camp: "solitaire" });
  }
  return loups;
}

// ------------------------------------------------------------------ le jour
// La nature de chaque pouvoir de jour (logique/jour.mjs, POUVOIRS_JOUR) : à qui il sert.
// amical : sur soi ou un sûr (un loup : sur un allié) ; hostile : sur un soupçonné (un loup : sur un utile) ; enquete : sur un
// inconnu ; seul : sans cible (utile tôt) ; vote : au vote (Juge de paix, Greffier, Sonneur) ; narrateur : pas un joueur.
export const NATURE_DES_POUVOIRS = {
  forgeron: "amical", meuniere: "seul", garde: "hostile", cure: "amical", chasseresse: "enquete", aubergiste: "amical", apothicaire: "amical",
  "colporteur-de-nouvelles": "seul", tisserande: "amical", passeur: "amical", tanneur: "enquete", "maitresse-d-ecole": "seul", ramoneuse: "enquete",
  eclusiere: "seul", "juge-de-paix": "vote", conteuse: "hostile", sonneur: "vote", remouleur: "amical", "montreur-d-ours": "amical",
  pelerine: "enquete", "greffier-begue": "vote", prieure: "enquete", masure: "amical", ecole: "hostile", echoppe: "rasoir",
  "crieur-public": "seul", taverne: "amical", forge: "amical", grange: "amical", puits: "seul", chapelle: "narrateur"
};
// possibles : [{ pouvoir, candidats: [{ id, nom }], cibles }] (pouvoirsDe, filtrés sur possible) ; pouvoirs : la part des jours où il
// use d'un pouvoir (0,5 : comme avant). -> { pouvoir, cibles } | null
export function politiqueDuJour({ possibles = [], savoir = {}, adresse = ADRESSE_PAR_DEFAUT, hasard = Math.random, pouvoirs = 0.5 } = {}) {
  if (!possibles.length || hasard() >= pouvoirs) return null;
  const o = outils({ candidats: [], savoir, adresse, hasard });
  if (!o.adroit()) {
    const p = choisir(possibles, hasard);
    return { pouvoir: p.pouvoir, cibles: o.tirer((p.candidats ?? []).map(c => c.id), p.cibles) };
  }
  const options = [];
  for (const p of possibles) {
    const ids = (p.candidats ?? []).map(c => c.id);
    const n = Math.max(0, Number(p.cibles) || 0);
    const nature = NATURE_DES_POUVOIRS[p.pouvoir] ?? "seul";
    const x = outils({ candidats: ids, savoir, adresse: 1, hasard });
    let cibles = null;
    // (Le Sonneur : la cloche, quand le village tient un loup ; le Juge de paix et le Greffier jouent au vote : annulerLeVote.)
    if (!n) cibles = nature !== "vote" ? [] : p.pouvoir === "sonneur" && !o.loup && (savoir.loups ?? []).length ? [] : null;
    else if (nature === "amical") {
      const surs = x.surs(ids).filter(id => o.utiles.has(id) || o.loup);
      cibles = surs.length ? x.tirer(surs, n) : ids.includes(o.moi) && (o.utiles.size === 0 || o.loup) ? [o.moi] : null;
    } else if (nature === "hostile") {
      const vises = o.loup ? x.ennemis(ids).filter(id => o.utiles.has(id)) : x.parSoupcon(x.ennemis(ids)).filter(id => x.soupcon(id) >= 1);
      cibles = vises.length ? vises.slice(0, n) : null;
    } else if (nature === "rasoir") {
      // Le rasoir du Perruquier : seulement sur un loup sûr (il meurt avec un innocent).
      const sur = o.loup ? [] : ids.filter(id => o.loups.has(id));
      cibles = sur.length ? x.tirer(sur, 1) : null;
    } else if (nature === "enquete") {
      const neufs = x.inconnus(ids);
      cibles = neufs.length ? x.parSoupcon(neufs).slice(0, n) : x.tirer(ids, n);
    }
    if (cibles) options.push({ pouvoir: p.pouvoir, cibles, rang: nature === "rasoir" || nature === "hostile" ? 2 : nature === "enquete" ? 1.5 : 1 });
  }
  if (!options.length) return null;
  const max = Math.max(...options.map(x => x.rang));
  const p = choisir(options.filter(x => x.rang === max), hasard);
  return { pouvoir: p.pouvoir, cibles: p.cibles };
}
// Après un vote d'exécution, le Juge de paix (vote) annule-t-il ? Oui, adroit, si un condamné est un innocent sûr (ou un allié du
// loup) ; sinon comme avant (six fois sur dix).
export function annulerLeVote({ elus = [], savoir = {}, adresse = ADRESSE_PAR_DEFAUT, hasard = Math.random } = {}) {
  const o = outils({ candidats: elus, savoir, adresse, hasard });
  if (!o.adroit()) return hasard() < 0.6;
  return elus.some(id => (o.loup ? o.amis.has(id) || id === o.moi : o.innocents.has(id) || o.utiles.has(id) || id === o.moi))
    && !elus.some(id => !o.loup && o.loups.has(id));
}
