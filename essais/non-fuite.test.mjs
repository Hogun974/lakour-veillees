// Non-fuite (0.9.0) : TOUT ce qu'un joueur reçoit, pendant des parties complètes, sérialisé et passé au crible.
//
// Foundry v14 livre à chaque navigateur tous les documents (acteurs et objets), tous les réglages du monde, tous les messages de
// chat (chuchotements compris) ; le socket du système, seulement ce qui lui est adressé (recipients). Pour chaque joueur, à chaque
// étape (choix de nuit, aube, vote, mort, arrivée, victoire), on sérialise ce qu'il a reçu et on vérifie :
// - aucune clé de rôle d'un autre villageois tant que ce rôle n'est pas public (révélé, partie finie) — sauf ce que son rôle le
//   droit de savoir : son rôle, et, mort qui voit tout, ceux des autres ;
// - aucun camp, amoureux, protection d'un villageois non révélé dans les documents ; aucun objet de rôle sur un document non révélé ;
// - l'état public sans fiches, choix de nuit, votes en cours, primes, fioles, composition, peste, Pont bloqué ni cloche à venir ;
// - aucun chuchotement au chat ; une fiche, un carnet, une demande ne vont qu'à leur joueur ; la meute (« loups » des salons) à un
//   loup seulement ;
// - pendant la nuit, aucun réglage monde n'est écrit (ni l'état public, ni le coffre, ni les compteurs du MJ IA).
// Les veillées de fête (0.10.0) aussi : leurs secrets (masque, présent, promis, murmure des âmes) ne vont qu'aux concernés.
// La Petite tablée (0.11.0) : son annonce publique ne nomme personne (le tirage contraint — qui est de l'ombre, qui tient la
// lanterne — ne sort que par ses nombres) ; ses parties (2 à 4 humains, des compagnons IA) passent au même crible.
// Et la migration d'une partie d'avant 0.9.0 (rôles sur les fiches, joueurs propriétaires) les retire des documents.
// Le socle du Pacte : un rôle PUBLIC dès la distribution (role.public) est retourné face visible, et rien d'autre ne sort avec lui ;
// la Braconnière qui tombe reçoit seule sa demande posthume.
// Le Pacte, étape 5 : les secrets des variantes (souffles des loups, murmures de la nuit, envoûtés, triangle, cartes de Double visage)
// jamais dans l'état public ; le Mur des murmures ne nomme jamais ses auteurs ; l'envoûtement ne va qu'à l'envoûté.
// Le Pacte, étape 9 : la Gazette de la lune — l'ordre du paquet, la main du Crieur public, les pouvoirs échangés du Jour des sots, les
// alliés de la meute, ce qu'a lu la Liseuse de cendres — jamais dans l'état public ; les cartes du Crieur à lui seul ; ce qu'apprend
// l'Exécuteur, l'allié du Méchant Benêt, jamais au chat ; le hook public de la Gazette ne porte que ce que la table voit.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, simulerJoueurs, emissions, messages, reglages, calme, livreA, FR } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 8, contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
// Le système éprouvé (l'original, ou une copie mutée) : ses modules.
let api, enregistrerReglages, ecouterSocket, rangement, L;
async function charger(racine = SYSTEME) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [a, r, s, c] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"), m("scripts/socket.mjs"), m("scripts/coffre.mjs")]);
  ({ api } = a);
  ({ enregistrerReglages } = r);
  ({ ecouterSocket } = s);
  ({ rangement } = c);
  L = api.logique;
}
await charger();

const villageois = () => game.actors.filter(a => a.type === "villageois");
const acteurDe = u => villageois().find(a => a.system.joueur === u) ?? null;
const pub = () => structuredClone(reglages.get("lakour-loups.partie").valeur);
// Ce que le joueur reçoit des documents : chaque acteur (système, objets) — comme game.actors dans sa console.
const documents = () => villageois().map(a => ({ id: a.id, name: a.name, system: a.system, ownership: a.ownership,
  items: a.items.contents.map(i => ({ name: i.name, type: i.type, system: i.system })) }));
// Les réglages du monde (système et MJ IA) : livrés à tous.
const reglagesMonde = () => [...reglages.entries()].filter(([, r]) => r.conf?.scope === "world").map(([k, r]) => [k, r.valeur]);

// Les lignes que les veillées de fête n'écrivent que pour le MJ (chronique secrète, narration) : leur forme, d'après les traductions.
const modele = texte => new RegExp(texte.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\w+\}/g, ".+?"));
const F = FR.LAKOUR_LOUPS;
const LIGNES_SECRETES_DE_FETE = [...Object.values(F.Fetes.Journal), F.Fetes.Ames.MjMeme, F.Fetes.Ames.MjAutre, F.Nuit.PresentMj, F.Nuit.MasqueTombe].map(modele);
// Ce que le chat montre, entités HTML décodées (une apostrophe échappée ne doit pas cacher une fuite).
const decoder = t => String(t).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;|&apos;/gi, "'").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// ------------------------------------------------------------------ le crible
function crible(etat) {
  const fuites = [];
  const fuite = (u, quoi) => fuites.push(`${etat.etape} — ${u} : ${quoi}`);
  const p = pub();
  const fin = p.phase === "fin";
  const fiches = Object.fromEntries(villageois().map(a => [a.id, secretDuMJ.fiche(a)]));
  const cleDe = id => fiches[id]?.role?.system?.cle ?? "";
  const publies = new Set(villageois().filter(a => a.system.revele || fin).map(a => a.id));
  const passage = new Set(Object.values(p.passage?.gens ?? {}).map(g => g.cle));
  const docs = JSON.stringify(documents());
  const monde = JSON.stringify(reglagesMonde());
  const nouveauxMessages = messages.slice(etat.vusMessages);
  const chat = JSON.stringify(nouveauxMessages);
  etat.vusMessages = messages.length;

  // L'état public : rien de secret.
  if (Object.keys(p.fiches ?? {}).length) fuite("*", "fiches dans l'état public");
  if (p.nuit?.actions?.length) fuite("*", "choix de nuit dans l'état public");
  if (Object.keys(p.primes ?? {}).length || Object.keys(p.fioles ?? {}).length || (p.asperges ?? []).length) fuite("*", "primes, fioles ou aspergés publics");
  if (p.vote?.ouvert && !p.vote.mainLevee && Object.keys(p.vote.votes ?? {}).length) fuite("*", "votes en cours publics");
  if (!fin && (p.composition || "peste" in p)) fuite("*", "composition ou peste publiques avant la fin");
  if (Number(p.pont?.bloqueNuit) || p.voteDoubleDemain) fuite("*", "Pont bloqué ou cloche à venir publics");
  if ((p.masques ?? []).length || Object.keys(p.somnambules ?? {}).length || (p.journalSecret ?? []).length) fuite("*", "masques, rêves ou chronique secrète publics");
  if (Object.values(p.secretsDeFete ?? {}).some(x => (Array.isArray(x) ? x.length : x))) fuite("*", "secrets de fête publics");
  // Le Pacte, étape 3b : le centre du Chapardeur, la carte jouée par le Bateleur, le camp du Mâtin, le modèle de l'Enfant des bois,
  // les charmés ne sortent jamais dans l'état public.
  if (p.ambigusSecret && JSON.stringify(L.normaliserAmbigusSecret(p.ambigusSecret)) !== JSON.stringify(L.ambigusSecretInitial())) fuite("*", "secrets des ambigus publics");
  const charmes = api.etat().ambigusSecret?.charmes ?? [];
  // Le Pacte, étape 5 : les secrets des variantes ; le mur sans auteur (les phrases des essais ne nomment personne).
  if (p.variantesSecret && JSON.stringify(L.normaliserVariantesSecret(p.variantesSecret)) !== JSON.stringify(L.variantesSecretInitial())) fuite("*", "secrets des variantes publics");
  for (const texte of p.variantes?.murmures?.textes ?? []) for (const a of villageois()) if (texte.includes(a.name)) fuite("*", `le mur nomme ${a.name}`);
  const envoutes = (api.etat().variantesSecret?.envoutes ?? []).map(e => e.acteurId);
  // Le Pacte, étape 9 : les secrets de la Gazette ; le Crieur public seul a sa main ; l'Exécuteur, l'allié de la meute, à leur seul carnet.
  if (p.gazetteSecret && JSON.stringify(L.normaliserGazetteSecret(p.gazetteSecret)) !== JSON.stringify(L.gazetteSecretInitial())) fuite("*", "secrets de la Gazette publics");
  for (const m of nouveauxMessages) if (/Vous seul le savez|Les cartes de votre charge|les loups sont .+ Vous voilà leur allié|vous avez le pouvoir de la carte/.test(decoder(m.content))) fuite("*", "un secret de la Gazette au chat");
  const crieur = p.gazette?.crieur?.acteurId ?? "";
  // Le Pacte, étape 4 : la carte que le Prieur a vue, ce qu'a entrevu la Fournière, jamais au chat ; le hook public du village ne
  // porte que ce que la table voit.
  for (const m of nouveauxMessages) if (/vous a montré sa carte|qui rentre chez lui en rasant les murs/.test(decoder(m.content))) fuite("*", "un secret du Prieur ou de la Fournière au chat");
  // La Petite tablée : son annonce (chat) ne porte que des nombres, jamais un nom de villageois.
  for (const m of nouveauxMessages) {
    const t = decoder(m.content);
    if (!t.includes(F.Tablee.Nom)) continue;
    for (const a of villageois()) if (t.includes(a.name)) fuite("*", `l'annonce de la petite tablée nomme ${a.name}`);
  }
  const fete = api.etat().secretsDeFete ?? {};
  // Le chat : aucun chuchotement pendant une partie (il serait livré à tous).
  for (const m of nouveauxMessages) if (m.whisper?.length) fuite("*", `chuchotement au chat : ${String(m.content).slice(0, 80)}`);
  // Les veillées de fête : leurs lignes secrètes ni au chat, ni dans un réglage monde, ni dans un message diffusé sans destinataire ;
  // le hook public de la veillée ne porte que { cle, quoi, tour }.
  const diffuses = emissions.slice(etat.vusDiffusion ?? 0).filter(e => !e.recipients);
  etat.vusDiffusion = emissions.length;
  for (const [ou, texte] of [["chat", nouveauxMessages.map(m => decoder(m.content)).join("\n")], ["réglages monde", monde], ["socket sans destinataire", JSON.stringify(diffuses)]]) {
    for (const m of LIGNES_SECRETES_DE_FETE) if (m.test(texte)) fuite("*", `une ligne secrète de la veillée de fête (${m.source.slice(0, 50)}) dans ${ou}`);
  }
  // Le signe du Greffier bègue est secret : jamais de hook public qui le porte.
  for (const e of diffuses.filter(e => e.type === "hook" && e.nom === "lakourLoups.jour" && JSON.stringify(e.args).includes("greffier-begue"))) fuite("*", "le signe du Greffier dans un hook public");
  for (const e of diffuses.filter(e => e.type === "hook" && e.nom === "lakourLoups.village")) {
    if (Object.keys(e.args?.[0] ?? {}).some(k => !["quoi", "acteurId", "ids", "cle", "loup"].includes(k))) fuite("*", `hook public du village trop bavard : ${JSON.stringify(e.args)}`);
  }
  for (const e of diffuses.filter(e => e.type === "hook" && e.nom === "lakourLoups.gazette")) {
    if (Object.keys(e.args?.[0] ?? {}).some(k => !["quoi", "cle", "acteurId", "ids", "source"].includes(k))) fuite("*", `hook public de la Gazette trop bavard : ${JSON.stringify(e.args)}`);
  }
  for (const e of diffuses.filter(e => e.type === "hook" && e.nom === "lakourLoups.fete")) {
    if (JSON.stringify(Object.keys(e.args?.[0] ?? {}).sort()) !== JSON.stringify(["cle", "quoi", "tour"])) fuite("*", `hook public de la veillée trop bavard : ${JSON.stringify(e.args)}`);
  }
  // Les documents : rien de secret sur un villageois non révélé.
  for (const a of villageois()) {
    if (publies.has(a.id)) continue;
    if (a.items.some(i => i.type === "role")) fuite("*", `objet de rôle sur ${a.name}, non révélé`);
    if (a.system.camp) fuite("*", `camp de ${a.name} au document`);
    if (a.system.amoureux || a.system.protections) fuite("*", `amoureux ou protections de ${a.name} au document`);
    if (a.system.joueur && Number(a.ownership?.[a.system.joueur]) > CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) fuite("*", `${a.name} : son joueur en est propriétaire`);
  }

  for (const u of game.users.filter(x => !x.isGM).map(x => x.id)) {
    const moi = acteurDe(u);
    const recus = emissions.slice(etat.vusSockets[u] ?? 0).filter(e => livreA(e, u) && e.canal === "system.lakour-loups");
    etat.vusSockets[u] = emissions.length;
    // Ce qu'il a le droit de connaître : son rôle (tous ceux qu'il a tenus), les rôles publics, ceux des gens de passage ;
    // tout, mort qui voit tout (sans Dernier souffle), ou la partie finie.
    const connues = (etat.connues[u] ??= new Set());
    if (moi && cleDe(moi.id)) connues.add(cleDe(moi.id));
    const parti = moi && L.estParti(p, moi.id);
    // Le Pacte, étape 9 : une Revenue d'entre les vivants a pu tout voir pendant qu'elle était morte (les rôles reçus alors, le seul
    // tour de son retour : adaptation notée, docs/gazette-de-la-lune.md).
    const revenue = moi && p.registre?.some(x => x.type === "gazette" && x.quoi === "revenante" && x.acteurId === moi.id && x.tour === p.tour);
    const voitTout = fin || revenue || (moi && !moi.system.vivant && !parti && game.settings.get("lakour-loups", "mortsVoientTout") && !L.aSonSouffle(p, { id: moi.id, vivant: false }));
    const loup = moi && fiches[moi.id]?.camp === "meute";
    const secretes = new Set();
    for (const a of villageois()) {
      const cle = cleDe(a.id);
      if (!cle || cle === "villageois" || publies.has(a.id) || voitTout || connues.has(cle) || passage.has(cle)) continue;
      // Une même clé tenue par un autre, révélé : publique.
      if (villageois().some(b => publies.has(b.id) && cleDe(b.id) === cle)) continue;
      secretes.add(cle);
    }
    const sockets = JSON.stringify(recus);
    for (const cle of secretes) {
      for (const [ou, texte] of [["documents", docs], ["réglages monde", monde], ["chat", chat], ["socket", sockets]]) {
        // Une valeur (pas un nom de champ : « conteuse » est aussi une clé de l'état public, jour.conteuse), hors le pouvoir de jour
        // annoncé à tous sans son acteur (« pouvoir »: « conteuse » — la règle : on sait qu'une Conteuse a parlé, pas qui).
        if (new RegExp(`(?<!"pouvoir":)"${cle}"(?!\\s*:)`).test(texte) || texte.includes(`|${cle}|`)) fuite(u, `la clé de rôle « ${cle} » (un autre villageois) dans ${ou}`);
      }
    }
    // Ce qui lui est adressé est bien à lui.
    for (const m of recus) {
      if (!m.recipients && ["demande", "annuler", "secret", "carnet", "monVote", "avis", "fiche", "vus", "parole", "salon"].includes(m.type)) fuite(u, `${m.type} sans destinataire`);
      if (m.type === "fiche" && m.acteurId !== moi?.id) fuite(u, "la fiche d'un autre");
      if (m.type === "fiche" && m.fiche && "protections" in m.fiche) fuite(u, "ses protections (secret du MJ)");
      if ((m.type === "secret" && m.entree?.acteurId && m.entree.acteurId !== moi?.id) || (m.type === "carnet" && m.acteurId !== moi?.id)) fuite(u, "le carnet d'un autre");
      if (m.type === "demande" && m.destinataire !== u) fuite(u, "la demande d'un autre");
      if (m.type === "vus" && Object.keys(m.vus ?? {}).length && !voitTout) fuite(u, "les rôles des autres sans y avoir droit");
      if (m.type === "salon" && (m.ligne?.loups ?? []).length && !loup) fuite(u, "la meute dans la ligne d'un non-loup");
      // Le Pacte : une fratrie (Lavandières, Bûcherons) n'est connue que des siens.
      if (m.type === "salon" && (m.ligne?.freres ?? []).length && !m.ligne.freres.includes(moi?.id)) fuite(u, "une fratrie dans la ligne d'un autre");
      // Les veillées de fête : chaque secret à ses seuls destinataires.
      const t = m.type === "secret" ? String(m.entree?.texte ?? "") : "";
      if (/le masque s'est posé sur ton visage/.test(t) && moi?.id !== fete.masque) fuite(u, "le masque du Carnaval d'un autre");
      if (/présent sur ton seuil/.test(t) && moi?.id !== fete.present) fuite(u, "le présent d'un autre");
      if (/ton cœur s'est lié/.test(t) && !(fete.promis ?? []).includes(moi?.id)) fuite(u, "une promesse qui n'est pas la sienne");
      if (/(une âme a frappé à la porte|Les promis de la fête s'affichent)/.test(t) && !loup) fuite(u, "ce que la meute entend, à un non-loup");
      if (/s'est assise au pied de votre lit/.test(t) && etat.murmures) etat.murmures.push(u);
      // Le Pacte, étape 3b : le réveil des charmés, à eux seuls.
      if (/Un air de vielle vous a charmés/.test(t) && !charmes.includes(moi?.id)) fuite(u, "le charme d'un autre");
      // Le Pacte, étape 5 : l'explication de sa place (« Comment jouer : son rôle »), à lui seul.
      const titre = m.type === "secret" ? String(m.entree?.titre ?? "") : "";
      if (/^Comment jouer : /.test(titre) && titre !== `Comment jouer : ${fiches[moi?.id]?.role?.name ?? ""}`) fuite(u, `l'explication d'un autre (${titre})`);
      // Le Pacte, étape 5 : l'envoûtement, à l'envoûté seul.
      if (/vous êtes envoûté/.test(t) && !envoutes.includes(moi?.id)) fuite(u, "l'envoûtement d'un autre");
      // Le Pacte, étape 9 : les cartes du Crieur public, à lui seul (et au Crieur qu'il était, s'il a été remplacé).
      if (/Les cartes de votre charge/.test(t) && moi?.id !== crieur && !etat.crieurs?.includes(moi?.id)) fuite(u, "les cartes du Crieur public, à un autre");
    }
  }
  return fuites;
}

// Les écritures de réglages monde pendant la nuit (horodatage public des choix de nuit).
function espionnerEcritures(etat) {
  const set = game.settings.set;
  game.settings.set = async (m, c, v) => {
    if (etat.enNuit && reglages.get(`${m}.${c}`)?.conf?.scope === "world") etat.ecrituresNocturnes.push(`${m}.${c}`);
    return set.call(game.settings, m, c, v);
  };
}

// ------------------------------------------------------------------ une partie complète
// publics : les clés de rôle du contenu rendues publiques pour cette partie (role.public, le Franc-Villageois du livre).
async function partie({ graine, peste = false, gens = false, compagnons = 0, revelerALaMort = true, joueurs = 7, roles = [], fete = "", niveau = "chaos", publics = [],
  village = false, variantes = {}, gazette = null } = {}) {
  installerFoundry({ joueurs: 8, contenu: true });
  for (const pack of game.packs.contents ?? [...game.packs.values()]) {
    for (const d of pack.documents?.contents ?? []) if (d.type === "role" && publics.includes(d.system?.cle)) d.system = { ...d.system, public: true };
  }
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  await game.settings.set("lakour-loups", "revelerALaMort", revelerALaMort);
  await game.settings.set("lakour-loups", "gensDePassage", gens);
  // Le Village : la Fournière entrevoit un loup chaque nuit (sa chance est un réglage caché), pour que l'essai la voie à l'œuvre.
  if (village) await game.settings.set("lakour-loups", "chanceFourniere", 1);
  // Les compagnons IA : un cerveau simple (le premier candidat ; un mot quelconque).
  api.resolveurs.compagnon = d => (d.mode === "texte" ? "Rien vu." : [d.candidats.find(c => c.id !== d.acteurId)?.id].filter(Boolean));
  const etat = { etape: "début", vusMessages: 0, vusSockets: {}, connues: {}, enNuit: false, ecrituresNocturnes: [], murmures: [] };
  espionnerEcritures(etat);
  const humains = Array.from({ length: joueurs }, (_, i) => `u${i + 1}`);
  const ia = Array.from({ length: compagnons }, (_, i) => `Compagnon ${i + 1}`);
  simulerJoueurs({ graine: `${graine}-joueurs`, fraude: false, mortsVotent: false, pouvoirs: 0.6 });
  // Les compagnons d'abord créés (comme par le MJ IA), puis la partie.
  const ids = [];
  for (const nom of ia) ids.push((await Actor.implementation.create({ name: nom, type: "villageois", system: { joueur: "", compagnon: true } })).id);
  await api.nouvellePartie({ memesJoueurs: false, joueurs: humains, compagnons: ids, graine, peste, niveau, roles, fete, village, variantes, ...(gazette ? { gazette } : {}) });
  await calme();
  await rangement();
  const fuites = [];
  const etape = async nom => { await calme(); await api.attendreGazette?.(); await rangement(); etat.crieurs = [...new Set([...(etat.crieurs ?? []), pub().gazette?.crieur?.acteurId].filter(Boolean))];
    etat.etape = nom; fuites.push(...crible(etat)); };
  await etape("distribution");
  // Les rôles publics : retournés dès la distribution (l'objet de rôle au document, le camp du rôle), et eux seuls.
  const publicsReveles = villageois().filter(a => publics.includes(secretDuMJ.role(a)?.system.cle))
    .map(a => a.system.revele && a.items.some(i => i.type === "role" && i.system.cle === secretDuMJ.role(a).system.cle));
  const autresReveles = villageois().filter(a => !publics.includes(secretDuMJ.role(a)?.system.cle) && (a.system.revele || a.items.some(i => i.type === "role"))).length;
  for (let tour = 1; tour <= 12 && !api.etat().vainqueur; tour++) {
    await api.changerPhase("nuit");
    await etape(`nuit ${tour}`);
    etat.enNuit = true;
    for (const e of api.ordreDeNuit()) {
      try { await api.reveiller(e.roleCle, { delai: 300, cible: "" }); } catch { /* rien à réveiller */ }
      await calme();
      fuites.push(...crible({ ...etat, etape: `nuit ${tour}, ${e.roleCle}` }));
      Object.assign(etat, { vusMessages: messages.length });
    }
    etat.enNuit = false;
    await api.changerPhase("aube");
    await api.resoudreNuit({ chuchoter: true });
    await etape(`aube ${tour}`);
    if (await api.verifierVictoire()) break;
    await api.changerPhase("jour");
    await etape(`jour ${tour}`);
    // Un gens de passage arrive au premier jour (u8, jusque-là spectateur).
    if (gens && tour === 1 && api.peutAccueillir().ok) {
      await api.accueillir({ userId: "u8" });
      await etape("arrivée d'un gens de passage");
    }
    try {
      if (api.bailli().election.ok) { await api.ouvrirVote({ objet: "bailli", duree: 0 }); await calme(); await api.cloreVote(); }
    } catch { /* pas d'élection */ }
    let r = null;
    try {
      await api.ouvrirVote({ duree: 0 });
      await calme();
      await etape(`vote ${tour} ouvert`);
      r = await api.cloreVote();
      if (r?.prolonge) { await calme(); r = await api.cloreVote(); }
    } catch { r = null; }
    if (r?.elu && game.actors.get(r.elu)?.system.vivant && r.objet === "execution") await api.eliminer(r.elu, { cause: "vote" });
    await etape(`vote ${tour} clos`);
    if (await api.verifierVictoire()) break;
  }
  await etape("fin");
  return { fuites, nocturnes: etat.ecrituresNocturnes, vainqueur: api.etat().vainqueur, morts: api.etat().morts.length, fete: api.etat().fete.cle, tablee: api.etat().petiteTablee,
    secretsDeFete: api.etat().secretsDeFete, murmures: etat.murmures, publicsReveles, autresReveles,
    cles: villageois().map(a => secretDuMJ.role(a)?.system.cle), centre: api.etat().ambigusSecret.centre.map(r => r.system?.cle),
    devouements: api.ambigus().devouements.length, village: api.village().actif, variantes: L.choixDesVariantes(api.etat().variantes),
    envoutes: (api.etat().variantesSecret?.envoutes ?? []).length,
    gazette: { tirees: api.gazette().tirees.length, crieur: Boolean(api.registre().some(x => x.type === "gazette" && x.quoi === "crieur")) } };
}

// Des compositions variées : rôles d'information, de lien, d'échange, solitaires, loups spéciaux, Somnambule.
const PARTIES = [
  { graine: "brume", joueurs: 7 },
  { graine: "lanterne", joueurs: 6, compagnons: 2, roles: ["loup-de-brumecombe", "louve-mere", "herboriste", "entremetteuse", "liseuse-de-cendres", "colporteur", "messager", "fossoyeur"] },
  { graine: "cendres", joueurs: 7, revelerALaMort: false, roles: ["loup-deguise", "loup-des-roseaux", "louvetier", "somnambule", "chasseur-de-primes", "juge-de-paix", "sonneur"] },
  { graine: "fievre", joueurs: 7, peste: true },
  { graine: "passage", joueurs: 7, gens: true, roles: ["loup-de-brumecombe", "loup-hurleur", "veilleuse-de-lanterne", "pyromane", "ermite", "sourcier", "garde-du-pont"] },
  { graine: "roseaux", joueurs: 5, compagnons: 3, roles: ["loup-affame", "loup-flaireur", "dame-du-gue", "pecheur-de-nuit", "braconniere", "gardienne-des-cles", "rosiere", "conteuse"] },
  // Le socle du Pacte : un rôle public dès la distribution (ici la Conteuse, rendue publique pour l'essai), une Braconnière qui choisit.
  { graine: "public", joueurs: 7, compagnons: 1, publics: ["conteuse"], roles: ["loup-de-brumecombe", "loup-hurleur", "conteuse", "braconniere", "liseuse-de-cendres", "garde-du-pont", "herboriste", "villageois"] },
  // Le Pacte, étape 3a : les rôles du Village du jeu de soirée (fratrie et son salon, Furet, Pie, Greffier, Aïeul…), avec des compagnons IA.
  { graine: "pacte-village", joueurs: 8, compagnons: 7, roles: ["loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "revenant",
    "aieul", "souffre-douleur", "innocent", "lavandiere", "lavandiere", "furet", "gardeuse-d-oies", "greffier-begue", "vieux-sergent", "pie"] },
  // Le Pacte, étape 3b : les ambigus, les solitaires du livre et le Loup pâle (le centre du Chapardeur, les cartes du Bateleur, le
  // camp du Mâtin, le modèle de l'Enfant des bois, les charmés, la Chambrière), avec des compagnons IA.
  { graine: "pacte-ambigus-b", joueurs: 8, compagnons: 6, roles: ["loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "loup-pale", "chapardeur", "bateleur",
    "matin", "enfant-des-bois", "chambriere", "joueur-de-vielle", "illumine", "feu-follet", "liseuse-de-cendres", "herboriste"] },
  // Le Pacte, étape 4 : la variante « Le Village » (personnalités publiques, Chemineaux, l'Incendiaire, la Pie), avec des compagnons IA.
  { graine: "le-village", joueurs: 8, compagnons: 4, village: true, roles: ["loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "incendiaire", "pie",
    "aieul", "liseuse-de-cendres", "herboriste", "garde-du-pont", "villageois", "villageois", "villageois"] },
  // Le Pacte, étape 5 : le mode « Le Pacte » et les variantes du jeu de soirée (chandelles angoissantes, mur, envoûtement ; Double visage,
  // Vendanges, Chaîne des innocents), avec des compagnons IA.
  { graine: "pacte-variantes-c", joueurs: 8, compagnons: 2, niveau: "le-pacte", variantes: { chandelles: true, angoissante: true, mur: true, envoutement: true } },
  { graine: "pacte-visages", joueurs: 8, compagnons: 1, variantes: { doubleVisage: "petite", vendanges: true, chaine: true, mur: true } },
  // Le Pacte, étape 9 : la Gazette de la lune (une carte chaque matin), le Crieur public et ses cartes, la Liseuse d'étoiles et ses séances.
  { graine: "gazette", joueurs: 8, compagnons: 3, gazette: { actif: true, crieur: true, cartesDuCrieur: 3, permanentes: ["executeur", "enfouissement"] },
    roles: ["loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "liseuse-d-etoiles", "liseuse-de-cendres", "herboriste", "braconniere", "garde-du-pont",
      "aieul", "villageois", "villageois"] },
  // Les veillées de fête (0.10.0), dont une avec des compagnons IA et une en peste noire.
  { graine: "ames", joueurs: 7, fete: "nuit-des-ames" },
  { graine: "hiver", joueurs: 6, compagnons: 2, fete: "veillee-d-hiver" },
  { graine: "masques", joueurs: 7, fete: "carnaval-des-masques", roles: ["loup-de-brumecombe", "loup-deguise", "liseuse-de-cendres", "sourcier", "colporteur", "herboriste", "garde-du-pont"] },
  { graine: "promis", joueurs: 7, fete: "fete-des-promis" },
  { graine: "fievre-promis", joueurs: 7, peste: true, fete: "fete-des-promis" },
  // La Petite tablée (0.11.0) : 2, 3 et 4 humains avec des compagnons IA, au niveau « petite-tablee ».
  { graine: "tablee-deux", joueurs: 2, compagnons: 4, niveau: "petite-tablee" },
  { graine: "tablee-trois", joueurs: 3, compagnons: 5, niveau: "petite-tablee" },
  { graine: "tablee-quatre", joueurs: 4, compagnons: 8, niveau: "petite-tablee" }
];

for (const p of PARTIES) {
  test(`non-fuite : partie « ${p.graine} » (${p.joueurs} joueurs${p.compagnons ? `, ${p.compagnons} IA` : ""}${p.peste ? ", peste noire" : ""}${p.gens ? ", gens de passage" : ""}${p.revelerALaMort === false ? ", morts non révélés" : ""}${p.fete ? `, ${p.fete}` : ""}${p.niveau === "petite-tablee" ? ", petite tablée" : ""})`, async () => {
    const r = await partie(p);
    assert.ok(r.morts > 0, "la partie a eu lieu");
    assert.ok(r.vainqueur, "jusqu'à la victoire");
    assert.equal(r.tablee, p.niveau === "petite-tablee", "le mode public de la petite tablée");
    assert.equal(r.village, Boolean(p.village), "la variante « Le Village »");
    if (p.gazette) assert.ok(r.gazette.tirees > 0 && r.gazette.crieur, "la Gazette a été lue, le Crieur nommé");
    for (const [c, valeur] of Object.entries(p.variantes ?? {})) assert.equal(r.variantes[c], valeur, `la variante « ${c} »`);
    if (p.variantes?.envoutement) assert.ok(r.envoutes > 0, "au moins un envoûté");
    // (Avec le Chapardeur, deux cartes du paquet restent au centre ; une Chambrière dévouée tient désormais un autre rôle.)
    // (La Gazette change des cartes en cours de partie : le Spectre, le Retour de flamme, la Revenue.)
    for (const cle of p.roles ?? []) if (!p.peste && !p.gazette) assert.ok(r.cles.includes(cle) || r.centre.includes(cle) || cle === "somnambule" || (cle === "chambriere" && r.devouements), `${cle} distribué`);
    if (p.publics?.length) {
      assert.ok(r.publicsReveles.length && r.publicsReveles.every(Boolean), "le rôle public est retourné dès la distribution");
      assert.equal(r.autresReveles, 0, "aucun autre rôle retourné à la distribution");
    }
    assert.deepEqual(r.fuites.slice(0, 15), [], `${r.fuites.length} fuite(s)`);
    assert.deepEqual(r.nocturnes, [], "aucun réglage monde écrit pendant la nuit");
    if (p.fete) {
      assert.equal(r.fete, p.fete, "la veillée de fête est en jeu");
      const s = r.secretsDeFete;
      if (p.fete === "veillee-d-hiver") assert.ok(s.present, "un présent");
      if (p.fete === "carnaval-des-masques") assert.ok(s.masque, "un masque");
      if (p.fete === "fete-des-promis") assert.equal(s.promis.length, 2, "deux promis");
      if (p.fete === "nuit-des-ames") assert.ok(r.murmures.length > 0, "au moins un murmure des âmes");
    }
  });
}

// ------------------------------------------------------------------ le crible lui-même attrape une fuite
test("non-fuite : le crible attrape un rôle au document, un chuchotement, une fiche mal adressée, une écriture nocturne", async () => {
  installerFoundry({ joueurs: 8, contenu: true });
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  await api.nouvellePartie({ memesJoueurs: false, joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "crible", niveau: "classique" });
  await calme();
  const etat = { etape: "essai", vusMessages: 0, vusSockets: {}, connues: {}, enNuit: false, ecrituresNocturnes: [] };
  assert.deepEqual(crible(etat), []);
  const [a, b] = villageois().filter(x => secretDuMJ.role(x)?.system.cle !== "villageois");
  await a.createEmbeddedDocuments("Item", [{ name: secretDuMJ.role(a).name, type: "role", system: structuredClone(secretDuMJ.role(a).system) }]);
  assert.ok(crible(etat).some(f => f.includes("objet de rôle")), "un objet de rôle sur un document");
  for (const i of a.items.filter(x => x.type === "role")) a.items.delete(i.id);
  await ChatMessage.implementation.create({ content: "psst", whisper: ["mj"] });
  assert.ok(crible(etat).some(f => f.includes("chuchotement")), "un chuchotement");
  game.socket.emit("system.lakour-loups", { type: "fiche", partie: "x", acteurId: b.id, fiche: { camp: "village", amoureux: "", role: { name: secretDuMJ.role(b).name, system: structuredClone(secretDuMJ.role(b).system) } } }, { recipients: [a.system.joueur] });
  assert.ok(crible(etat).some(f => f.includes("la fiche d'un autre")), "une fiche mal adressée");
  await ChatMessage.implementation.create({ content: `<div>${F.Fetes.Journal.Present.replace("{nom}", a.name)}</div>` });
  assert.ok(crible(etat).some(f => f.includes("ligne secrète de la veillée")), "une ligne secrète de fête au chat");
  game.socket.emit("system.lakour-loups", { type: "hook", nom: "lakourLoups.fete", args: [{ cle: "veillee-d-hiver", quoi: "ouverture", tour: 0, present: a.id }] });
  assert.ok(crible(etat).some(f => f.includes("hook public de la veillée trop bavard")), "un hook public bavard");
  espionnerEcritures(etat);
  etat.enNuit = true;
  await game.settings.set("lakour-loups", "coffre", { essai: 1 });
  assert.deepEqual(etat.ecrituresNocturnes, ["lakour-loups.coffre"]);
});

// ------------------------------------------------------------------ migration d'une partie d'avant 0.9.0
test("migration : une partie d'avant 0.9.0 (rôles et camps sur les fiches, joueurs propriétaires) passe aux secrets du MJ", async () => {
  installerFoundry({ joueurs: 4 });
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  // L'état d'avant : public (la phase, le Pont public), rôles et camps sur les documents, amoureux, protections, propriétaires.
  const creer = async (nom, joueur, system, role) => {
    const a = await Actor.implementation.create({ name: nom, type: "villageois", system: { joueur, ...system }, ownership: { default: 1, [joueur]: 3 } });
    await a.createEmbeddedDocuments("Item", [{ name: role.name, type: "role", system: role.system }]);
    return a;
  };
  const loup = await creer("Loup", "u1", { camp: "meute" }, { name: "Loup de Brumecombe", system: { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer" } });
  const amie = await creer("Amie", "u2", { camp: "village", protections: 1 }, { name: "Herboriste", system: { cle: "herboriste", camp: "village", usages: { max: 2, restant: 1 } } });
  const mort = await creer("Mort", "u3", { camp: "village", vivant: false, revele: true }, { name: "Garde du pont", system: { cle: "garde-du-pont", camp: "village" } });
  await amie.update({ "system.amoureux": loup.id });
  reglages.get("lakour-loups.partie").valeur = { ...L.etatInitial(), partie: "ancienne", phase: "jour", tour: 2, pont: { bloqueNuit: 3 } };
  const r = await api.migrer();
  assert.equal(r.fiches, 3);
  // Les documents : plus rien de secret ; le rôle d'un mort révélé reste (public).
  for (const a of [loup, amie]) {
    assert.equal(a.items.filter(i => i.type === "role").length, 0, `${a.name} : objet de rôle retiré`);
    assert.equal(a.system.camp, "");
    assert.equal(a.system.amoureux, "");
    assert.equal(a.system.protections, 0);
  }
  assert.equal(mort.items.filter(i => i.type === "role").length, 1, "le rôle révélé reste au document");
  for (const [a, u] of [[loup, "u1"], [amie, "u2"], [mort, "u3"]]) assert.equal(a.ownership[u], CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER, `${a.name} : observateur`);
  // Les secrets du MJ : chaque fiche, le Pont ; l'état public ne les a plus.
  assert.equal(secretDuMJ.camp(loup), "meute");
  assert.equal(secretDuMJ.role(amie).system.usages.restant, 1);
  assert.equal(secretDuMJ.amoureux(amie), loup.id);
  assert.equal(secretDuMJ.protections(amie), 1);
  assert.equal(api.etat().pont.bloqueNuit, 3, "le Pont passe aux secrets");
  assert.equal(pub().pont.bloqueNuit, 0, "et quitte l'état public");
  assert.equal(api.etat().secretsIncomplets, true, "sans les secrets d'avant, la Table le signale");
  // Chaque joueur reçoit sa fiche, à lui seul.
  const f = emissions.filter(e => e.type === "fiche");
  for (const [a, u] of [[loup, "u1"], [amie, "u2"]]) assert.deepEqual(f.findLast(e => e.acteurId === a.id)?.recipients, [u]);
  // Une seconde fois : rien à faire.
  assert.deepEqual(await api.migrer(), { fiches: 0, documents: 0 });
});

// ------------------------------------------------------------------ mutations : chaque règle cassée fait fuir quelque chose
// Une partie (« lanterne » : lien d'amour, échange, Herboriste, IA) rejouée sur des copies du système où une règle est cassée.
const MUTATIONS = [
  ["scripts/api.mjs", "vivant: true, revele: false, camp: \"\",\n        maison: att.maison,", "vivant: true, revele: false, camp: roleData.system?.camp ?? \"village\",\n        maison: att.maison,", "camp au document"],
  ["scripts/api.mjs", "      if (metierData) await acteur.createEmbeddedDocuments(\"Item\", [metierData]);", "      await acteur.createEmbeddedDocuments(\"Item\", [roleData, metierData].filter(Boolean));", "rôle au document"],
  ["scripts/api.mjs", "{ default: NIVEAUX().LIMITED, [att.joueur]: NIVEAUX().OBSERVER }", "{ default: NIVEAUX().LIMITED, [att.joueur]: NIVEAUX().OWNER }", "joueur observateur"],
  ["scripts/api.mjs", "emettre({ type: \"fiche\", partie, acteurId, fiche: L.ficheDuJoueur(fiche) }, [userId]);", "emettre({ type: \"fiche\", partie, acteurId, fiche: L.ficheDuJoueur(fiche) });", "fiche à son seul joueur"],
  ["scripts/api.mjs", "      await modifierEtat(e => majFiche(majFiche(e, c.a, f => ({ ...f, amoureux: c.b })), c.b, f => ({ ...f, amoureux: c.a })));",
    "      await game.actors.get(c.a)?.update({ \"system.amoureux\": c.b });", "lien d'amour secret"],
  ["scripts/api.mjs", "    if (!L.egaux(pub, brut)) await game.settings.set(ID, \"partie\", pub);", "    await game.settings.set(ID, \"partie\", pub);", "rien d'écrit la nuit"],
  ["logique/etat.mjs", "    \"fiches\", \"pont\", \"voteDoubleDemain\", \"secretsIncomplets\", \"secretsDeFete\"]) pub[cle]", "    \"pont\", \"voteDoubleDemain\", \"secretsIncomplets\", \"secretsDeFete\"]) pub[cle]", "fiches hors de l'état public"],
  ["logique/fiches.mjs", "  return { camp: x.camp, amoureux: x.amoureux, role: x.role ? copie(x.role) : null, ...(x.seconde", "  return { ...x, role: x.role ? copie(x.role) : null, ...(x.seconde", "protections hors de la fiche du joueur"],
  // Les veillées de fête (rejouées sur leur partie : l'indice dans PARTIES).
  ["logique/etat.mjs", "\"secretsIncomplets\", \"secretsDeFete\"]) pub[cle]", "\"secretsIncomplets\"]) pub[cle]", "secrets de fête hors de l'état public", PARTIES.findIndex(p => p.graine === "hiver")],
  ["scripts/api.mjs", "    for (const loup of tousLesVillageois().filter(x => x.system.vivant && campDe(x) === \"meute\")) {\n      await prevenir(loup.id",
    "    for (const loup of tousLesVillageois().filter(x => x.system.vivant)) {\n      await prevenir(loup.id", "les promis : à la meute seule", PARTIES.findIndex(p => p.graine === "promis")],
  ["logique/fetes.mjs", "  const loups = vivants.filter(v => v.camp === \"meute\").map(v => v.id);", "  const loups = vivants.map(v => v.id);", "la porte des âmes : aux loups seuls", PARTIES.findIndex(p => p.graine === "ames")],
  ["scripts/api.mjs", "    await prevenir(secrets.masque, t(\"LAKOUR_LOUPS.Fetes.carnaval-des-masques.Carnet\"", "    for (const a of acteurs) await prevenir(a.id, t(\"LAKOUR_LOUPS.Fetes.carnaval-des-masques.Carnet\"", "le masque : à son seul porteur", PARTIES.findIndex(p => p.graine === "masques")],
  // M1 (relecture 10) : les secrets de la veillée dans le hook PUBLIC d'ouverture ; M2 : les lignes secrètes du MJ postées au chat.
  ["scripts/api.mjs", "annoncer(\"lakourLoups.fete\", [{ cle, quoi: \"ouverture\", tour: lireEtat().tour }]);", "annoncer(\"lakourLoups.fete\", [{ cle, quoi: \"ouverture\", tour: lireEtat().tour, ...secrets }]);", "M1 : le hook public sans secret", PARTIES.findIndex(p => p.graine === "hiver")],
  ["scripts/api.mjs", "  for (const texte of annonces) await annonceChat(echapper(texte));\n  annoncer(\"lakourLoups.fete\"", "  for (const texte of [...annonces, ...pourMJ]) await annonceChat(echapper(texte));\n  annoncer(\"lakourLoups.fete\"", "M2 : les lignes du MJ hors du chat", PARTIES.findIndex(p => p.graine === "hiver")],
  ["scripts/api.mjs", "    for (const texte of annonces) await annonceChat(echapper(texte));\n    if (envoyer)", "    for (const texte of [...annonces, ...narration]) await annonceChat(echapper(texte));\n    if (envoyer)", "la narration de l'aube hors du chat", PARTIES.findIndex(p => p.graine === "ames")],
  // La Petite tablée (0.11.0) : l'annonce publique qui nommerait les humains de l'ombre, ou le mode retiré de l'état public (il est
  // public par la règle, et la partie doit le porter).
  ["scripts/api.mjs", "      const morceaux = [t(\"LAKOUR_LOUPS.Tablee.AnnonceTete\", { humains: h, compagnons: nomsCompagnons.length }),",
    "      const morceaux = [t(\"LAKOUR_LOUPS.Tablee.AnnonceTete\", { humains: h, compagnons: nomsCompagnons.length }) + \" \" + sortie.filter(s => !s.compagnon && campDe(game.actors.get(s.acteurId)) !== \"village\").map(s => game.actors.get(s.acteurId).name).join(\", \"),",
    "petite tablée : l'annonce nomme les humains de l'ombre", PARTIES.findIndex(p => p.graine === "tablee-trois")],
  // Le Pacte, étape 3a : la ligne de salon d'une fratrie, à ses seuls membres.
  ["logique/salons.mjs", "  if (a.salon === \"fratrie\") ligne.freres = ids(liste.filter(p => p.vivant && !p.loup && !p.mj && p.fratrie === moi.fratrie).map(p => p.acteurId));",
    "  ligne.freres = ids(liste.filter(p => p.fratrie).map(p => p.acteurId));", "fratries : les siens à eux seuls", PARTIES.findIndex(p => p.graine === "pacte-village")],
  // Le Pacte, étape 3b : les secrets des ambigus hors de l'état public ; le réveil des charmés, à eux seuls.
  ["logique/etat.mjs", "  pub.ambigusSecret = ambigusSecretInitial();", "", "ambigus : leurs secrets hors de l'état public", PARTIES.findIndex(p => p.graine === "pacte-ambigus-b")],
  ["scripts/api.mjs", "  const ids = L.charmesVivants(villageoisAPlat(), etat.ambigusSecret.charmes);", "  const ids = villageoisAPlat().filter(v => v.vivant).map(v => v.id);", "charmés : à eux seuls", PARTIES.findIndex(p => p.graine === "pacte-ambigus-b")],
  // Le Pacte, étape 4 : la Fournière entrevoit un loup en secret (son carnet), jamais au chat.
  ["scripts/api.mjs", "      if (game.actors.get(x.acteurId)?.system.vivant) messages.push({ acteurId: x.acteurId, texte: t(\"LAKOUR_LOUPS.Village.Fourniere\", { nom: nomDe(x.loup) }) });",
    "      await annonceChat(echapper(t(\"LAKOUR_LOUPS.Village.Fourniere\", { nom: nomDe(x.loup) })));", "Fournière : son carnet, pas le chat", PARTIES.findIndex(p => p.graine === "le-village")],
  // Le Pacte, étape 5 : l'explication de la distribution, à son seul joueur.
  ["scripts/api.mjs", "  return envoyerSecret(acteur.id, { html: parties.join(\"\"),", "  return envoyerSecret(tousLesVillageois().find(x => x.system.joueur && x.id !== acteur.id)?.id ?? acteur.id, { html: parties.join(\"\"),", "explication : à son seul joueur", 0],
  // Le Pacte, étape 5 : les secrets des variantes hors de l'état public ; le mur sans auteur ; l'envoûtement à l'envoûté seul.
  ["logique/etat.mjs", "  pub.variantesSecret = variantesSecretInitial();", "", "variantes : leurs secrets hors de l'état public", PARTIES.findIndex(p => p.graine === "pacte-variantes-c")],
  ["scripts/api.mjs", "      if (texte) await modifierEtat(e => L.graverUnMurmure(e, texte));", "      if (texte) await modifierEtat(e => L.graverUnMurmure(e, \`\${nomDe(id)} : \${texte}\`));", "mur : sans auteur", PARTIES.findIndex(p => p.graine === "pacte-variantes-c")],
  ["scripts/api.mjs", "    if (envoyer) for (const m of messages) await envoyerSecret(m.acteurId, { texte: m.texte });", "    if (envoyer) for (const m of messages) await envoyerSecret(m.texte.includes(\"envoûté\") ? villageoisAPlat().filter(v => v.vivant && v.joueur && v.id !== m.acteurId).at(-1)?.id ?? m.acteurId : m.acteurId, { texte: m.texte });", "envoûtement : à l'envoûté seul", PARTIES.findIndex(p => p.graine === "pacte-variantes-c")]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fuite-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

test("non-fuite : chaque règle cassée est détectée par une partie complète", async () => {
  const passees = [];
  try {
    for (const [fichier, avant, apres, regle, indice = 1] of MUTATIONS.filter(m => !process.env.NON_FUITE_SEULES || process.env.NON_FUITE_SEULES.split("|").some(s => m[3].includes(s)))) {
      await chargerMutant(fichier, avant, apres);
      let r;
      try { r = await partie(PARTIES[indice]); } catch { continue; }
      if (!r.fuites.length && !r.nocturnes.length) passees.push(`${regle} (${fichier})`);
    }
  } finally { await charger(); }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});