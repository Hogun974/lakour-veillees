// Les AMBIGUS, les SOLITAIRES du livre et le LOUP PÂLE (Le Pacte, étape 3b de docs/plan-le-pacte.md) : ce qu'ils ont en commun,
// et ce que l'état garde d'eux. Logique pure.
//
// Les rôles et leur clé d'effet (contenu lakour-veillees, roles.mjs) :
// Ambigus (ils font gagner le camp auquel ils appartiennent ; leur camp, ou leur rôle, peut changer) :
// - Chapardeur (« chaparder », ordre 1, première nuit) : quand il est au paquet, on y ajoute DEUX cartes Villageois ; les deux
//   cartes non distribuées restent au centre, face cachée (secret). La première nuit, il les regarde et peut échanger sa carte
//   contre l'une d'elles ; si les deux sont de la meute, il est obligé d'en prendre une. Il joue ensuite ce rôle jusqu'à la fin,
//   avec ses règles complètes (un rôle de première nuit qui reste à jouer cette nuit-là se joue : son ordre est plus tardif) ;
// - Bateleur (« emprunter », ordre 2, chaque nuit) : trois cartes de rôles à pouvoir de nuit (jamais de la meute), face visible,
//   connues de tous, posées à la distribution (cartesDuBateleur). Chaque nuit, il peut en désigner une et jouer son pouvoir cette
//   nuit-là (son réveil s'ajoute à l'ordre de la nuit, à l'ordre de la carte) ; la carte jouée est retirée (au matin, devant tous) ;
// - Mâtin (« choisir-camp », ordre 38, première nuit) : il se désigne pour rejoindre la meute (dès cette nuit : il chasse avec elle,
//   et compte parmi ses membres pour le Loup affamé), ou passe et reste villageois. Définitif ;
// - Enfant des bois (« modele », ordre 13, première nuit) : il désigne un modèle ; tant que le modèle vit, il est du Village ; le
//   modèle mort (de n'importe quelle façon), il rejoint la meute en secret, et se réveille avec elle dès la nuit suivante ;
// - Chambrière (« devouement ») : un joueur éliminé par le vote, AVANT que sa carte soit retournée, elle peut se dévoiler (sa carte
//   de Chambrière retournée devant tous) et prendre la carte de l'éliminé, sans la montrer : elle devient ce rôle, remis à neuf
//   (usages pleins, fioles pleines, une action de première nuit jouée à la nuit suivante). Ce qui touchait l'éliminé (infecté,
//   amoureux, charmé, Bailli) ne passe pas à elle ; ce qui la touchait est perdu (charmée, Bailli), sauf l'infection. Amoureuse,
//   elle ne peut pas. Le dernier geste de l'éliminé ne joue pas (sa carte est partie avec elle : ni Braconnière, ni liste du
//   Souffre-douleur, ni sagesse de l'Aïeul) ; ce qui tient à SA condamnation, si (Revenant, Rosière, Feu follet, prime).
// Solitaires (leur propre but, quel que soit leur camp) :
// - Feu follet (victoire « premier-tour ») : au paquet, la veillée COMMENCE PAR UN JOUR (débat et vote avant la première nuit). Éliminé
//   au premier tour (par ce premier vote, par la meute la première nuit, par le poison de l'Herboriste la première nuit), il gagne
//   seul ; sinon, au matin de la première nuit, il devient simple villageois (camp du Village) ;
// - Joueur de vielle (« charmer », ordre 80 ; victoire « tous-charmes ») : chaque nuit, il charme deux nouveaux joueurs (pas lui) ;
//   puis tous les charmés se réveillent ensemble (étape « charmes », ORDRE_CHARMES) et se reconnaissent (carnet). Il gagne seul dès
//   que tous les autres vivants sont charmés. Infecté par la Louve mère, il devient loup simple et abandonne son but (ni réveil, ni
//   victoire). Rien n'arrête le charme (ni garde, ni remède), les loups n'y échappent pas, il ne passe pas entre amants ;
// - Illuminé (victoire « autre-groupe ») : le village est partagé en deux groupes par un critère évident, annoncé à tous à la
//   distribution (partagerLeVillage) ; il gagne seul, vivant, quand tous ceux de l'AUTRE groupe sont éliminés. Infecté, il devient loup.
// Loup :
// - Loup pâle (« trahir », ordre 42, une nuit sur deux ; victoire « seul-survivant ») : il chasse chaque nuit avec la meute (elle le
//   croit des siens ; les visions le voient loup) ; une nuit sur deux, après la meute, il se réveille seul et peut dévorer un loup.
//   Il gagne seul s'il est le dernier vivant ; la victoire de la meute ne le compte pas parmi les gagnants.
//
// État PUBLIC etat.ambigus :
//   { bateleur: [{ cle, nom, img }] (ses cartes encore face visible), retirees: [cle] (les cartes jouées, retirées au matin),
//     commenceParLeJour: Boolean (le Feu follet est au paquet), groupes: null | { critere, a: [acteurId], b: [acteurId] } (le
//     partage annoncé pour l'Illuminé), devouements: [{ acteurId, de, tour }] (la Chambrière s'est dévoilée, la carte de « de ») }
// SECRETS etat.ambigusSecret (chez le MJ actif, jamais dans l'état public) :
//   { centre: [role] (les cartes du centre : données d'objet { name, img, system }), chapardes: [acteurId] (les Chapardeurs qui ont
//     regardé), emprunts: { acteurId: { cle, tour, role } } (la carte jouée cette nuit par un Bateleur ; role à plat),
//     modeles: { enfantId: modeleId }, matins: { acteurId: "meute" | "village" }, charmes: [acteurId] }
import { creerHasard, melanger } from "./hasard.mjs";
import { surLAutreRive, numeroDeMaison } from "./distribution.mjs";

export const EFFET_CHAPARDEUR = "chaparder";
export const EFFET_BATELEUR = "emprunter";
export const EFFET_MATIN = "choisir-camp";
export const EFFET_ENFANT_DES_BOIS = "modele";
export const EFFET_CHAMBRIERE = "devouement";
export const EFFET_VIELLE = "charmer";
export const EFFET_LOUP_PALE = "trahir";
export const CLE_CHAPARDEUR = "chapardeur";
export const CLE_BATELEUR = "bateleur";
export const CLE_FEU_FOLLET = "feu-follet";
export const CLE_ILLUMINE = "illumine";
export const VICTOIRE_FEU_FOLLET = "premier-tour";
export const VICTOIRE_VIELLE = "tous-charmes";
export const VICTOIRE_ILLUMINE = "autre-groupe";
export const VICTOIRE_LOUP_PALE = "seul-survivant";

// Les charmés se réveillent ensemble, juste après le Joueur de vielle (80) : une étape à eux, sans choix.
export const CLE_CHARMES = "charmes";
export const ORDRE_CHARMES = 81;
// Le Chapardeur : deux cartes Villageois de plus au paquet, les deux non distribuées au centre.
export const CARTES_DU_CENTRE = 2;
export const CLE_VILLAGEOIS = "villageois";
// Le Bateleur : trois cartes face visible.
export const CARTES_DU_BATELEUR = 3;
// La Chambrière : la fenêtre de sa demande, juste après le décompte du vote (adaptation en ligne : sur table, elle lève la main
// avant qu'on retourne la carte du condamné ; ici, une demande courte, et la révélation du condamné l'attend).
export const DELAI_CHAMBRIERE = 30000;

const liste = x => (Array.isArray(x) ? [...new Set(x.map(String).filter(Boolean))] : []);
const vivant = v => Boolean(v) && v.vivant !== false;
const copie = o => JSON.parse(JSON.stringify(o ?? null));

export const ambigusInitial = () => ({ bateleur: [], retirees: [], commenceParLeJour: false, groupes: null, devouements: [] });
export const ambigusSecretInitial = () => ({ centre: [], chapardes: [], emprunts: {}, modeles: {}, matins: {}, charmes: [] });

const carte = c => (c && typeof c === "object" && c.cle ? { cle: String(c.cle), nom: String(c.nom ?? c.cle), img: String(c.img ?? "") } : null);

export function normaliserAmbigus(a) {
  const x = a && typeof a === "object" ? a : {};
  const g = x.groupes && typeof x.groupes === "object" ? x.groupes : null;
  return {
    bateleur: (Array.isArray(x.bateleur) ? x.bateleur : []).map(carte).filter(Boolean),
    retirees: liste(x.retirees),
    commenceParLeJour: Boolean(x.commenceParLeJour),
    groupes: g ? { critere: String(g.critere ?? ""), a: liste(g.a), b: liste(g.b) } : null,
    devouements: (Array.isArray(x.devouements) ? x.devouements : []).filter(d => d?.acteurId && d.de)
      .map(d => ({ acteurId: String(d.acteurId), de: String(d.de), tour: Number(d.tour) || 0 }))
  };
}

const objet = o => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
export function normaliserAmbigusSecret(s) {
  const x = objet(s);
  const emprunts = {};
  for (const [id, e] of Object.entries(objet(x.emprunts))) if (e?.cle) emprunts[id] = { cle: String(e.cle), tour: Number(e.tour) || 0, role: copie(e.role) };
  const paires = (o, f = String) => Object.fromEntries(Object.entries(objet(o)).filter(([k, v]) => k && v).map(([k, v]) => [k, f(v)]));
  return {
    centre: (Array.isArray(x.centre) ? x.centre : []).filter(r => r && typeof r === "object").map(copie),
    chapardes: liste(x.chapardes), emprunts, modeles: paires(x.modeles),
    matins: paires(x.matins, v => (v === "meute" ? "meute" : "village")), charmes: liste(x.charmes)
  };
}

// Un rôle « à plat » (comme villageoisAPlat : { cle, nom, camp, effet, apparence, victoireCle, nuit, usages }) d'après des données
// d'objet ({ name, img, system }).
export const roleAPlat = r => (r?.system ? { cle: r.system.cle ?? "", nom: r.name ?? r.system.cle ?? "", camp: r.system.camp ?? "village",
  effet: r.system.effet ?? "", apparence: r.system.apparence ?? "", victoireCle: r.system.victoireCle ?? "", nuit: { ...(r.system.nuit ?? {}) },
  usages: { ...(r.system.usages ?? { max: 0, restant: 0 }) } } : null);

// ------------------------------------------------------------------ remis à neuf
// Un rôle repris en cours de partie (la Chambrière ; le Chapardeur la première nuit) : usages pleins ; un rôle de première nuit
// joue sa première nuit à la nuit `debut` (la nuit qui vient, pour la Chambrière). Données d'objet -> nouvelles données d'objet.
export function remettreANeuf(role, { debut = 1 } = {}) {
  const r = copie(role);
  if (!r?.system) return r;
  const u = r.system.usages;
  if (u && Number(u.max) > 0) r.system.usages = { ...u, restant: Number(u.max) };
  if (r.system.nuit?.premiereNuitSeulement && debut > 1) r.system.nuit = { ...r.system.nuit, debut };
  return r;
}

// ------------------------------------------------------------------ le Chapardeur
// Le paquet joue-t-il le Chapardeur ? Alors deux cartes Villageois de plus, et autant de cartes au centre.
export const paquetDuChapardeur = (cles = []) => cles.includes(CLE_CHAPARDEUR);
// Les cartes à ajouter au paquet de n places (clés de rôle) : deux Villageois s'il y a un Chapardeur et pas déjà n + 2 cartes.
export function cartesAAjouter(cles = [], places = cles.length) {
  if (!paquetDuChapardeur(cles)) return [];
  return Array.from({ length: Math.max(0, places + CARTES_DU_CENTRE - cles.length) }, () => CLE_VILLAGEOIS);
}
// Doit-il prendre une carte ? Les deux cartes du centre sont de la meute.
export const chapardeurOblige = (centre = []) => centre.length > 0 && centre.every(r => (r?.system?.camp ?? r?.camp) === "meute");
// L'échange : la carte prise (index au centre) contre la sienne. -> { centre (nouveau), pris (données d'objet) } ; null si rien.
export function chaparder(centre = [], index, sienne) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= centre.length) return null;
  const nouveau = centre.map(copie);
  const pris = nouveau[i];
  nouveau[i] = copie(sienne);
  return { centre: nouveau, pris: remettreANeuf(pris) };
}

// ------------------------------------------------------------------ le Bateleur
// Ses cartes possibles : un rôle à pouvoir de nuit, jamais de la meute ni solitaire, ni un rôle à groupe (Lavandières,
// Bûcherons), ni un rôle de première nuit seulement, ni un rôle qui ne joue pas chaque nuit, ni un ambigu, ni un rôle déjà au
// paquet (enJeu : les cartes distribuées et celles du centre). roles : [{ cle, camp, nuit, effet, groupe?, surDemande? }].
export const PAS_POUR_LE_BATELEUR = [CLE_BATELEUR, CLE_CHAPARDEUR, "matin", "enfant-des-bois", "chambriere", "somnambule"];
export function rolesDuBateleur(roles = [], enJeu = []) {
  const pris = new Set(enJeu);
  return roles.filter(r => r?.cle && !pris.has(r.cle) && r.camp === "village" && r.nuit?.actif && !r.groupe && !r.surDemande
    && !r.nuit.premiereNuitSeulement && !r.nuit.uneNuitSurDeux && !r.nuit.nuitsImpaires && !r.nuit.tantQueMeuteEntiere
    && !["lien-amour", "echanger-role", "fratrie"].includes(r.effet) && !PAS_POUR_LE_BATELEUR.includes(r.cle)).map(r => r.cle);
}
// Les trois cartes tirées au hasard (graine) parmi les possibles.
export const tirerCartesDuBateleur = ({ possibles = [], graine, hasard } = {}) =>
  melanger(possibles, hasard ?? creerHasard(graine === undefined || graine === null || graine === "" ? undefined : `bateleur|${graine}`)).slice(0, CARTES_DU_BATELEUR);
// Les cartes encore jouables cette nuit (face visible, pas encore jouées ; une carte prise cette nuit l'est déjà).
export function cartesJouables(etat) {
  const a = normaliserAmbigus(etat?.ambigus);
  const prises = new Set([...a.retirees, ...Object.values(normaliserAmbigusSecret(etat?.ambigusSecret).emprunts).map(e => e.cle)]);
  return a.bateleur.filter(c => !prises.has(c.cle));
}
// Les rôles empruntés cette nuit (n° tour) : { acteurId: role à plat }.
export function empruntsDeLaNuit(etat, tour = Number(etat?.tour) || 0) {
  const e = normaliserAmbigusSecret(etat?.ambigusSecret).emprunts;
  return Object.fromEntries(Object.entries(e).filter(([, x]) => x.tour === tour && x.role?.cle).map(([id, x]) => [id, x.role]));
}
// Le rôle qu'un acteur joue pour cette étape de la nuit : la carte empruntée (Bateleur) si l'étape est la sienne, sinon null.
export const roleEmprunte = (etat, acteurId, roleCle, tour) => {
  const r = empruntsDeLaNuit(etat, tour)[acteurId];
  return r && r.cle === roleCle ? r : null;
};

// ------------------------------------------------------------------ l'Enfant des bois
// Les Enfants des bois qui rejoignent la meute quand ce villageois tombe : vivants, encore du Village (pas déjà loups).
export function enfantsOrphelins(etat, villageois = [], mortId) {
  const m = normaliserAmbigusSecret(etat?.ambigusSecret).modeles;
  return villageois.filter(v => vivant(v) && v.id !== mortId && m[v.id] === mortId && v.camp !== "meute" && v.role?.effet === EFFET_ENFANT_DES_BOIS).map(v => v.id);
}

// ------------------------------------------------------------------ la Chambrière
// Celle qui peut se dévouer pour ce condamné : vivante, avec son pouvoir (sansPouvoirs : la sagesse perdue), ni amoureuse, ni
// condamnée elle-même ; le condamné vit encore. -> acteurId | ""
export function chambriereDisponible(villageois = [], condamnes = [], { sansPouvoirs = false } = {}) {
  const vises = new Set(condamnes);
  if (![...vises].some(id => vivant(villageois.find(v => v.id === id)))) return "";
  return villageois.find(v => vivant(v) && v.role?.effet === EFFET_CHAMBRIERE && !v.amoureux && !vises.has(v.id)
    && !(sansPouvoirs && (v.role.camp ?? "village") === "village"))?.id ?? "";
}
// Le condamné dont la carte a été reprise (ses gestes de mort ne jouent pas) ?
export const carteReprise = (etat, acteurId) => normaliserAmbigus(etat?.ambigus).devouements.some(d => d.de === acteurId);
// Le dévouement (etat déjà normalisé, modifié sur place) : public (la carte de Chambrière retournée, la reprise de celle de « de ») ;
// la charmée ne l'est plus ; Bailli, la charge devient vacante (le village en élira un autre). -> { etat, bailli: Boolean }
export function devouer(etat, { chambriere, de }) {
  const a = normaliserAmbigus(etat.ambigus);
  a.devouements.push({ acteurId: chambriere, de, tour: Number(etat.tour) || 0 });
  etat.ambigus = a;
  const s = normaliserAmbigusSecret(etat.ambigusSecret);
  s.charmes = s.charmes.filter(id => id !== chambriere);
  delete s.modeles[chambriere];
  delete s.emprunts[chambriere];
  etat.ambigusSecret = s;
  const bailli = Boolean(etat.bailli?.actif && etat.bailli.acteurId === chambriere);
  if (bailli) etat.bailli = { ...etat.bailli, acteurId: "", succession: null };
  return { etat, bailli };
}
// Sa nouvelle fiche (normalisée) : le rôle de l'éliminé remis à neuf ; le camp de ce rôle, sauf si elle était infectée (camp de la
// meute sur une carte qui n'en est pas) : elle le reste. Ni amoureux (elle ne l'est pas), ni rien de l'éliminé.
export function ficheDeLaChambriere(sienne, role, { tour = 0 } = {}) {
  const neuf = remettreANeuf(role, { debut: tour + 1 });
  const infectee = sienne?.camp === "meute" && (sienne?.role?.system?.camp ?? "village") !== "meute";
  return { ...sienne, role: neuf, camp: infectee ? "meute" : neuf?.system?.camp ?? "village", amoureux: "" };
}

// ------------------------------------------------------------------ le Feu follet
// La veillée commence-t-elle par un jour ? Le Feu follet est au paquet (distribué ou au centre).
export const commenceParLeJour = (cles = []) => cles.includes(CLE_FEU_FOLLET);
// A-t-il gagné ? Éliminé au premier tour : par le premier vote (tour 0, celui d'avant la première nuit), ou par la meute ou le
// poison de la première nuit (tour 1, avant le jour).
export const CAUSES_DU_PREMIER_TOUR = { vote: 0, meute: 1, poison: 1 };
export function feuFolletGagne(v, morts = []) {
  const m = morts.find(x => x.acteurId === v?.id);
  if (!m || !(m.cause in CAUSES_DU_PREMIER_TOUR) || m.tour !== CAUSES_DU_PREMIER_TOUR[m.cause]) return false;
  return m.cause === "vote" || !["jour", "vote"].includes(m.phase);
}

// ------------------------------------------------------------------ le Joueur de vielle
// Qui il peut charmer cette nuit : un vivant, pas lui, pas déjà charmé.
export const candidatsDuCharme = (ids = [], vielleId, charmes = []) => ids.filter(id => id !== vielleId && !charmes.includes(id));
// Les charmés de la nuit (etat normalisé, modifié sur place) : ajoutés à la liste.
export function charmer(etat, ids = []) {
  const s = normaliserAmbigusSecret(etat.ambigusSecret);
  s.charmes = [...new Set([...s.charmes, ...ids])];
  etat.ambigusSecret = s;
  return etat;
}
// Un Joueur de vielle qui joue encore (vivant, pas devenu loup) ?
export const vielleEnJeu = (villageois = []) => villageois.some(v => vivant(v) && v.role?.effet === EFFET_VIELLE && v.camp !== "meute");
// Les charmés vivants (ils se réveillent ensemble tant qu'un Joueur de vielle joue).
export const charmesVivants = (villageois = [], charmes = []) => villageois.filter(v => vivant(v) && charmes.includes(v.id)).map(v => v.id);

// ------------------------------------------------------------------ l'Illuminé
// Les critères de partage : (villageois) -> "a" | "b". Adaptation en ligne : la rive (maisons du bourg, maisons de l'autre rive) ;
// depuis l'étape 9, les traits visibles des personnages (gazette.mjs : v.traits) — le genre, l'âge, les lunettes — au choix du
// narrateur (réglage « partageIllumine ») ; la parité des maisons sert de repli quand un groupe est vide.
export const CRITERES_DE_PARTAGE = {
  rive: v => (surLAutreRive(v.maison) ? "b" : "a"),
  genre: v => (v.traits?.genre === "homme" ? "b" : "a"),
  age: v => (v.traits?.age === "vieux" ? "b" : "a"),
  lunettes: v => (v.traits?.lunettes ? "b" : "a"),
  parite: v => (numeroDeMaison(v.maison) % 2 === 0 ? "b" : "a")
};
// Les critères que le narrateur peut choisir (réglage « partageIllumine »), annoncés au début.
export const CRITERES_DE_L_ILLUMINE = ["rive", "genre", "age", "lunettes"];
export const criteresDuPartage = choix => [...new Set([CRITERES_DE_L_ILLUMINE.includes(choix) ? choix : "rive", "rive", "parite"])];
// Le partage du village en deux groupes : { critere, a: [acteurId], b: [acteurId] }. Un critère qui laisse un groupe vide cède la
// place au suivant ; aucun : null.
export function partagerLeVillage(villageois = [], criteres = ["rive", "parite"]) {
  for (const critere of criteres) {
    const f = CRITERES_DE_PARTAGE[critere];
    if (!f) continue;
    const a = villageois.filter(v => f(v) === "a").map(v => v.id), b = villageois.filter(v => f(v) === "b").map(v => v.id);
    if (a.length && b.length) return { critere, a, b };
  }
  return null;
}

// ------------------------------------------------------------------ les victoires (victoire.mjs)
// Le Joueur de vielle, l'Illuminé, le Loup pâle : l'id du gagnant, ou "". vivants : les vivants (à plat) ; charmes : [acteurId] ;
// groupes : etat.ambigus.groupes.
export function victoireDesAmbigus({ villageois = [], vivants = villageois.filter(vivant), charmes = [], groupes = null, victoireCleDe = r => r?.victoireCle ?? "" } = {}) {
  const parId = new Map(villageois.map(v => [v.id, v]));
  for (const v of vivants) {
    const cle = victoireCleDe(v.role);
    if (cle === VICTOIRE_VIELLE && v.camp === "solitaire" && vivants.every(x => x.id === v.id || charmes.includes(x.id))) return v.id;
    if (cle === VICTOIRE_ILLUMINE && v.camp === "solitaire" && groupes) {
      const autre = groupes.a.includes(v.id) ? groupes.b : groupes.b.includes(v.id) ? groupes.a : [];
      if (autre.length && autre.every(id => parId.get(id)?.vivant === false)) return v.id;
    }
    if (cle === VICTOIRE_LOUP_PALE && vivants.length === 1) return v.id;
  }
  return "";
}
// Le contexte de victoire d'un état (complet : les charmés sont un secret ; public : vide).
export const contexteDesAmbigus = etat => ({ charmes: normaliserAmbigusSecret(etat?.ambigusSecret).charmes, groupes: normaliserAmbigus(etat?.ambigus).groupes });
// Les options de l'ordre de la nuit (nuit.mjs) : les rôles empruntés par le Bateleur, les charmés.
export const nuitDesAmbigus = (etat, tour) => ({ emprunts: empruntsDeLaNuit(etat, tour), charmes: normaliserAmbigusSecret(etat?.ambigusSecret).charmes });
