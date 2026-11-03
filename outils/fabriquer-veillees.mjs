// Fabrique les compendiums du module lakour-veillees (système lakour-loups) à partir de modules/lakour-veillees/contenu/ :
// 1. rassemble les documents, 2. les vérifie contre le contrat (docs/loups-contrat.md), 3. écrit les sources JSON (src/),
// 4. compile en LevelDB (packs/), 5. écrit assets/compositions.json.
// Les vérificateurs (verifierDocuments, verifierCompositions, verifierCarte) servent aussi aux essais (essais/veillees-*.test.mjs).
// Usage : npm run fabriquer-veillees        (option --sans-compiler pour vérifier seulement)
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { FETES_VEILLEES, imageDeFete } from "../modules/lakour-veillees/scripts/fetes.js";
import { APPARENCES, CAMPS, EFFETS, MODULE, VICTOIRES, ORDRE_MEUTE, cheminJeton, cleJetonBatiment, cleJetonMetier } from "../modules/lakour-veillees/contenu/aides.mjs";
import { DOCUMENTS } from "../modules/lakour-veillees/contenu/index.mjs";
import { compositions, MIN_JOUEURS, MAX_JOUEURS } from "../modules/lakour-veillees/contenu/compositions.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS } from "../modules/lakour-veillees/contenu/equilibre.mjs";

const RACINE = `modules/${MODULE}`;
export const TYPE_PACK = { roles: "Item", metiers: "Item", batiments: "Item", journaux: "JournalEntry", tables: "RollTable", scenes: "Scene", villageois: "Actor" };
export const TYPE_DOCUMENT = { roles: "role", metiers: "metier", batiments: "batiment", villageois: "villageois" };
export const BATIMENTS_ATTENDUS = ["Chapelle", "Moulin", "Taverne", "Gibet", "Puits", "Forge", "Cimetière", "Pont", "Lavoir", "Grange"];
export const NOMBRE_MAISONS = 18;
export const FICHIER_COMPOSITIONS = `${RACINE}/assets/compositions.json`;
export const FICHIER_EQUILIBRE = `${RACINE}/assets/equilibre.json`;

// Équilibre (contenu/equilibre.mjs) : chaque rôle et chaque bâtiment du contenu y figure, avec le bon camp, et rien d'autre.
export function verifierEquilibre(docs, equilibre = EQUILIBRE, batiments = EQUILIBRE_BATIMENTS) {
  const erreurs = [];
  const roles = docs.filter(d => d.pack === "roles").map(d => d.doc.system);
  const clesBat = docs.filter(d => d.pack === "batiments").map(d => d.doc.system.cle);
  for (const r of roles) {
    const e = equilibre[r.cle];
    if (!e) erreurs.push(`équilibre : rôle ${r.cle} sans poids`);
    else if (e.camp !== r.camp) erreurs.push(`équilibre : ${r.cle} est du camp ${r.camp}, pas ${e.camp}`);
  }
  for (const cle of Object.keys(equilibre)) if (!roles.some(r => r.cle === cle)) erreurs.push(`équilibre : rôle inconnu ${cle}`);
  for (const cle of clesBat) if (!batiments[cle]) erreurs.push(`équilibre : bâtiment ${cle} sans niveau`);
  for (const cle of Object.keys(batiments)) if (!clesBat.includes(cle)) erreurs.push(`équilibre : bâtiment inconnu ${cle}`);
  for (const [cle, e] of Object.entries(equilibre)) {
    if (!["debutants", "classique", "chaos"].includes(e.niveau)) erreurs.push(`équilibre : ${cle}, niveau ${e.niveau}`);
    if (!Number.isFinite(e.poids) || !Number.isInteger(e.joueursMin)) erreurs.push(`équilibre : ${cle}, poids ou joueursMin invalide`);
  }
  return erreurs;
}

export function fabriquer(documents = DOCUMENTS) {
  const cles = new Set();
  for (const doc of documents) {
    if (!TYPE_PACK[doc.__pack]) throw new Error(`Compendium inconnu pour ${doc.__cle} : ${doc.__pack}`);
    if (cles.has(doc.__cle)) throw new Error(`Clé en double : ${doc.__cle}`);
    cles.add(doc.__cle);
  }
  const propre = doc => Object.fromEntries(Object.entries(doc).filter(([k]) => !k.startsWith("__")));
  return documents.map(doc => ({ pack: doc.__pack, cle: doc.__cle, doc: structuredClone(propre(doc)) }));
}

const texteDe = v => JSON.stringify(v).replace(/<[^>]+>/g, " ");
const sansBalises = h => String(h ?? "").replace(/<[^>]+>/g, "").trim();

// ---------------------------------------------------------------- Vérification des documents fabriqués
// docs : sortie de fabriquer() ; renvoie la liste des erreurs (vide si tout va bien).
export function verifierDocuments(docs) {
  const erreurs = [];
  const err = (d, m) => erreurs.push(`${d.doc.name ?? d.cle} : ${m}`);
  const du = pack => docs.filter(d => d.pack === pack);

  for (const d of docs) {
    const { doc } = d;
    if (doc._id !== doc._key?.split("!")[2]?.split(".").pop()) err(d, "_key et _id ne correspondent pas");
    if (!doc.flags?.[MODULE]?.cle) err(d, `flags.${MODULE}.cle manquant`);
    if (TYPE_DOCUMENT[d.pack] && doc.type !== TYPE_DOCUMENT[d.pack]) err(d, `type « ${doc.type} » au lieu de « ${TYPE_DOCUMENT[d.pack]} »`);
    if (TYPE_DOCUMENT[d.pack] && doc.system?.cle !== undefined && doc.system.cle !== doc.flags?.[MODULE]?.cle) err(d, "system.cle différent de la clé du drapeau");
    if (/thiercelieux/i.test(texteDe(doc))) err(d, "référence interdite à un jeu édité");
    const effet = doc.system?.effet;
    if (effet !== undefined && effet !== "" && !EFFETS.includes(effet)) err(d, `clé d'effet « ${effet} » inconnue du contrat`);
    const u = doc.system?.usages;
    if (u && (!Number.isInteger(u.max) || u.max < 0 || u.restant !== u.max)) err(d, `usages incohérents (${JSON.stringify(u)})`);
  }

  // Rôles : camps, victoire des solitaires, nuit.
  const roles = du("roles");
  const cles = roles.map(d => d.doc.system.cle);
  if (new Set(cles).size !== cles.length) erreurs.push("rôles : clé de rôle en double");
  if (!cles.includes("villageois")) erreurs.push("rôles : il manque le rôle « villageois »");
  for (const d of roles) {
    const s = d.doc.system, n = s.nuit;
    if (!CAMPS.includes(s.camp)) err(d, `camp « ${s.camp} » inconnu`);
    if (s.camp === "solitaire" && !sansBalises(s.victoire)) err(d, "solitaire sans condition de victoire");
    if (s.camp !== "solitaire" && s.victoire) err(d, "victoire propre hors solitaire");
    if (typeof s.apparence !== "string" || !APPARENCES.includes(s.apparence)) err(d, `apparence « ${s.apparence} » inconnue`);
    if (typeof s.victoireCle !== "string" || !VICTOIRES.includes(s.victoireCle)) err(d, `clé de victoire « ${s.victoireCle} » inconnue`);
    else if (s.victoireCle && s.camp !== "solitaire") err(d, "clé de victoire hors solitaire");
    if (s.apparence && s.apparence === s.camp) err(d, "apparence identique au camp réel (laisser vide)");
    if (!sansBalises(s.description)) err(d, "pouvoir sans description");
    if (d.doc.img !== cheminJeton(s.cle)) err(d, `image ${d.doc.img} au lieu de ${cheminJeton(s.cle)}`);
    if (n.actif) {
      if (!Number.isInteger(n.ordre) || n.ordre < 1 || n.ordre > 99) err(d, `ordre de nuit ${n.ordre} hors de 1–99`);
      if (!n.invite) err(d, "rôle de nuit sans invite");
      if (!Number.isInteger(n.cibles) || n.cibles < 0 || n.cibles > 2) err(d, `nombre de cibles ${n.cibles}`);
      if (n.premiereNuitSeulement && n.uneNuitSurDeux) err(d, "première nuit seulement ET une nuit sur deux");
      if (s.camp !== "meute" && n.ordre === ORDRE_MEUTE) err(d, `un rôle hors meute se réveille à ${ORDRE_MEUTE} (ordre de la meute)`);
      if (s.camp === "meute" && n.ordre < ORDRE_MEUTE) err(d, "un loup se réveille seul avant la meute");
    } else {
      if (n.cibles !== 0 || n.premiereNuitSeulement || n.uneNuitSurDeux || n.soiMeme || n.invite) err(d, "rôle sans action de nuit, mais avec des réglages de nuit");
      if (s.camp === "meute") err(d, "un loup qui ne se réveille pas la nuit");
    }
    if (s.cle === "villageois" && (n.actif || s.effet || s.usages.max || s.camp !== "village")) err(d, "le villageois n'a ni pouvoir ni action");
  }
  // Ordre de nuit : liens et préparatifs avant les protections, protections avant la meute, réactions juste après,
  // le rôle qui interroge les morts en dernier.
  const actifs = roles.filter(d => d.doc.system.nuit.actif).map(d => d.doc.system);
  const ordre = s => s.nuit.ordre;
  const premier = actifs.filter(s => s.effet === "lien-amour");
  const protections = actifs.filter(s => s.effet === "proteger");
  const apres = actifs.filter(s => ["mordre", "remede"].includes(s.effet));
  if (!actifs.some(s => s.camp === "meute" && ordre(s) === ORDRE_MEUTE && s.effet === "tuer")) erreurs.push(`ordre de nuit : aucun loup simple à ${ORDRE_MEUTE}`);
  for (const s of premier) if (protections.some(p => ordre(p) <= ordre(s))) erreurs.push(`ordre de nuit : ${s.cle} doit passer avant les protections`);
  for (const s of protections) if (ordre(s) >= ORDRE_MEUTE) erreurs.push(`ordre de nuit : la protection ${s.cle} passe après la meute`);
  for (const s of apres) if (ordre(s) <= ORDRE_MEUTE) erreurs.push(`ordre de nuit : ${s.cle} réagit à la victime et doit passer après la meute`);
  for (const s of actifs.filter(x => x.effet === "voir-role-mort")) {
    if (actifs.some(x => x !== s && ordre(x) >= ordre(s))) erreurs.push(`ordre de nuit : ${s.cle} interroge les morts et doit passer en dernier`);
  }
  for (const camp of CAMPS) if (!roles.some(d => d.doc.system.camp === camp)) erreurs.push(`rôles : aucun rôle du camp ${camp}`);

  // Métiers.
  for (const d of du("metiers")) {
    const s = d.doc.system;
    if (!sansBalises(s.description)) err(d, "métier sans description");
    if (s.jour.actif ? !s.jour.invite : s.jour.invite || s.jour.cibles) err(d, "réglages de jour incohérents");
    if (!Number.isInteger(s.jour.cibles) || s.jour.cibles < 0 || s.jour.cibles > 2) err(d, `nombre de cibles ${s.jour.cibles}`);
    if (d.doc.img !== cheminJeton(cleJetonMetier(s.cle))) err(d, `image ${d.doc.img}`);
  }

  // Bâtiments : règle, repère qui existe sur la carte du village.
  const scenes = du("scenes");
  const elements = new Set(scenes.flatMap(sc => sc.doc.flags[MODULE].plan.elements.map(e => e.nom)));
  for (const d of du("batiments")) {
    const s = d.doc.system;
    if (!sansBalises(s.regle)) err(d, "bâtiment sans règle");
    if (!sansBalises(s.description)) err(d, "bâtiment sans description");
    if (!elements.has(s.repere)) err(d, `repère « ${s.repere} » absent de la carte`);
    if (d.doc.img !== cheminJeton(cleJetonBatiment(s.cle))) err(d, `image ${d.doc.img}`);
  }
  const reperes = du("batiments").map(d => d.doc.system.repere).sort();
  if (JSON.stringify(reperes) !== JSON.stringify([...BATIMENTS_ATTENDUS].sort())) erreurs.push(`bâtiments : repères ${reperes.join(", ")} au lieu des dix attendus`);

  // Journaux : visibilité, contenu du guide du joueur.
  const journaux = Object.fromEntries(du("journaux").map(d => [d.doc.flags[MODULE].cle, d]));
  const visibilites = { "guide-du-joueur": 2, "guide-du-narrateur": 0, "regles-des-variantes": 2 };
  for (const [cle, niveau] of Object.entries(visibilites)) {
    const j = journaux[cle];
    if (!j) { erreurs.push(`journal ${cle} absent`); continue; }
    if (j.doc.ownership?.default !== niveau) err(j, `visibilité ${j.doc.ownership?.default} au lieu de ${niveau}`);
    if (!j.doc.pages?.length || j.doc.pages.some(p => !sansBalises(p.text?.content))) err(j, "page vide");
    for (const p of j.doc.pages ?? []) if (p._key !== `!journal.pages!${j.doc._id}.${p._id}`) err(j, `clé de page ${p._key}`);
  }
  // Journaux des veillées de fête : visibles, l'identifiant de scripts/fetes.js (le moteur les lie par lui), l'illustration en tête
  // (assets/fetes/<fête du calendrier>.jpg, présente), puis des pages de texte non vides.
  for (const f of FETES_VEILLEES) {
    const j = journaux[f.journal.cle];
    if (!j) { erreurs.push(`journal ${f.journal.cle} absent`); continue; }
    if (j.doc._id !== f.journal.id) err(j, `identifiant ${j.doc._id} au lieu de ${f.journal.id} (scripts/fetes.js)`);
    if (j.doc.name !== f.journal.nom) err(j, `nom différent de celui de scripts/fetes.js (${f.journal.nom})`);
    if (j.doc.ownership?.default !== 2) err(j, `visibilité ${j.doc.ownership?.default} au lieu de 2`);
    const [tete, ...reste] = j.doc.pages ?? [];
    if (tete?.type !== "image" || tete.src !== imageDeFete(f.fete)) err(j, `illustration ${tete?.src} au lieu de ${imageDeFete(f.fete)}`);
    else if (!existsSync(new URL(`../${tete.src}`, import.meta.url))) err(j, `image ${tete.src} absente`);
    if (!reste.length || reste.some(p => p.type !== "text" || !sansBalises(p.text?.content))) err(j, "page vide");
    for (const p of j.doc.pages ?? []) if (p._key !== `!journal.pages!${j.doc._id}.${p._id}`) err(j, `clé de page ${p._key}`);
  }
  if (journaux["guide-du-joueur"]) {
    const texte = sansBalises(journaux["guide-du-joueur"].doc.pages.map(p => p.text.content).join(" "));
    for (const d of [...roles, ...du("metiers"), ...du("batiments")]) if (!texte.includes(d.doc.name)) err(journaux["guide-du-joueur"], `ne cite pas « ${d.doc.name} »`);
  }

  // Tables : au moins 20 résultats, plages contiguës, formule 1dN.
  for (const d of du("tables")) {
    const r = d.doc.results;
    if (r.length < 20) err(d, `${r.length} résultats seulement`);
    if (d.doc.formula !== `1d${r.length}`) err(d, `formule ${d.doc.formula}`);
    r.forEach((x, i) => {
      if (x.range[0] !== i + 1 || x.range[1] !== i + 1) err(d, `plage ${x.range} au rang ${i + 1}`);
      if (!sansBalises(x.description)) err(d, `résultat ${i + 1} vide`);
      if (x._key !== `!tables.results!${d.doc._id}.${x._id}`) err(d, `clé de résultat ${x._key}`);
    });
  }
  const tables = du("tables").map(d => d.doc.flags[MODULE].cle);
  for (const t of ["noms-de-villageois", "rumeurs", "presages-de-l-aube", "morts-mysterieuses"]) if (!tables.includes(t)) erreurs.push(`table ${t} absente`);

  // Scènes : plan dans les drapeaux, carte conforme.
  if (!scenes.length) erreurs.push("aucune scène");
  for (const d of scenes) for (const e of verifierCarte(d.doc.flags[MODULE].plan)) err(d, e);

  // Villageois non joués.
  for (const d of du("villageois")) {
    const s = d.doc.system;
    if (s.joueur !== "" || s.vivant !== true || !CAMPS.includes(s.camp)) err(d, "données de villageois incohérentes");
    if (d.doc.prototypeToken?.texture?.src !== d.doc.img) err(d, "jeton différent de l'image");
  }
  return erreurs;
}

// ---------------------------------------------------------------- Vérification de la carte du village
export function verifierCarte(plan) {
  const erreurs = [];
  const noms = (plan?.elements ?? []).map(e => e.nom);
  for (let i = 1; i <= NOMBRE_MAISONS; i++) if (noms.filter(n => n === `Maison ${i}`).length !== 1) erreurs.push(`repère « Maison ${i} » absent ou en double`);
  const maisons = noms.filter(n => /^Maison \d+$/.test(n));
  if (maisons.length !== NOMBRE_MAISONS) erreurs.push(`${maisons.length} maisons au lieu de ${NOMBRE_MAISONS}`);
  for (const b of BATIMENTS_ATTENDUS) if (noms.filter(n => n === b).length !== 1) erreurs.push(`repère « ${b} » absent ou en double`);
  if (!(plan?.pieces ?? []).some(p => p.nom === "Place du village")) erreurs.push("pièce « Place du village » absente");
  const els = plan?.elements ?? [];
  for (const e of els) {
    if (e.x < 0 || e.y < 0 || e.x + e.l > plan.largeur || e.y + e.h > plan.hauteur) erreurs.push(`« ${e.nom} » hors de la carte`);
  }
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h) erreurs.push(`« ${a.nom} » et « ${b.nom} » se chevauchent`);
    }
  }
  return erreurs;
}

// ---------------------------------------------------------------- Vérification des compositions
// compos : { cle: { libelle, joueurs: [min, max], niveau, roles, batiments } } ; roles : [{ cle, camp }] ; batiments : [cle].
export function verifierCompositions(compos, roles, batiments) {
  const erreurs = [];
  const camp = Object.fromEntries(roles.map(r => [r.cle, r.camp]));
  const niveaux = new Set();
  const couvert = { debutants: new Set(), classique: new Set(), chaos: new Set() };
  for (const [cle, c] of Object.entries(compos)) {
    const e = m => erreurs.push(`${cle} : ${m}`);
    if (!c.libelle) e("sans libellé");
    if (!(c.niveau in couvert)) { e(`niveau « ${c.niveau} » inconnu`); continue; }
    niveaux.add(c.niveau);
    const [min, max] = c.joueurs ?? [];
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max || min < MIN_JOUEURS || max > MAX_JOUEURS) { e(`plage de joueurs ${c.joueurs}`); continue; }
    for (const r of c.roles) if (!(r in camp)) e(`rôle « ${r} » inconnu`);
    // Pour chaque taille de la plage : exactement autant de rôles que de joueurs, en complétant par des villageois
    // (une liste plus longue que la taille ne se raccourcit qu'en retirant des villageois).
    for (let n = min; n <= max; n++) {
      const villageois = c.roles.filter(r => r === "villageois").length;
      const ajuste = c.roles.length <= n ? n : (c.roles.length - n <= villageois ? n : c.roles.length);
      if (ajuste !== n) e(`${c.roles.length} rôles pour ${n} joueurs, impossible à ajuster avec des villageois`);
      couvert[c.niveau].add(n);
    }
    if (c.roles.length !== min) e(`${c.roles.length} rôles pour ${min} joueurs`);
    const meute = c.roles.filter(r => camp[r] === "meute").length;
    if (meute < 1) e("aucun loup");
    if (meute * 2 >= c.roles.length) e(`trop de loups (${meute} sur ${c.roles.length})`);
    for (const r of new Set(c.roles)) if (!["villageois", "loup-de-brumecombe"].includes(r) && c.roles.filter(x => x === r).length > 1) e(`rôle « ${r} » en double`);
    if (!Array.isArray(c.batiments) || c.batiments.length < 4 || c.batiments.length > 6) e(`${c.batiments?.length} bâtiments (4 à 6 attendus)`);
    for (const b of c.batiments ?? []) if (!batiments.includes(b)) e(`bâtiment « ${b} » inconnu`);
    if (new Set(c.batiments).size !== c.batiments?.length) e("bâtiment en double");
  }
  for (const [niveau, tailles] of Object.entries(couvert)) {
    for (let n = MIN_JOUEURS; n <= MAX_JOUEURS; n++) if (!tailles.has(n)) erreurs.push(`niveau ${niveau} : aucune composition pour ${n} joueurs`);
  }
  return erreurs;
}

// Rôles et bâtiments tels que les compositions les citent.
export const rolesPourCompositions = docs => docs.filter(d => d.pack === "roles").map(d => ({ cle: d.doc.system.cle, camp: d.doc.system.camp }));
export const batimentsPourCompositions = docs => docs.filter(d => d.pack === "batiments").map(d => d.doc.system.cle);

// Lancé directement (npm run fabriquer-veillees) ; importé par les essais, on ne fait que fabriquer().
if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const docs = fabriquer();
  const compos = compositions();
  const erreurs = [...verifierDocuments(docs), ...verifierCompositions(compos, rolesPourCompositions(docs), batimentsPourCompositions(docs)), ...verifierEquilibre(docs)];
  if (erreurs.length) {
    console.error(`Contenu non conforme au contrat :\n- ${erreurs.join("\n- ")}`);
    process.exit(1);
  }
  const parPack = Object.groupBy(docs, d => d.pack);
  for (const [pack, liste] of Object.entries(parPack)) {
    const dossier = `${RACINE}/src/${pack}`;
    rmSync(dossier, { recursive: true, force: true });
    mkdirSync(dossier, { recursive: true });
    for (const { cle, doc } of liste) writeFileSync(`${dossier}/${cle.split(":")[1]}.json`, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`${pack.padEnd(12)} ${liste.length} documents`);
  }
  mkdirSync(`${RACINE}/assets`, { recursive: true });
  writeFileSync(FICHIER_COMPOSITIONS, `${JSON.stringify(compos, null, 2)}\n`);
  console.log(`compositions ${Object.keys(compos).length} (${FICHIER_COMPOSITIONS})`);
  writeFileSync(FICHIER_EQUILIBRE, `${JSON.stringify({ roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS }, null, 2)}\n`);
  if (!process.argv.includes("--sans-compiler")) {
    for (const pack of Object.keys(parPack)) {
      rmSync(`${RACINE}/packs/${pack}`, { recursive: true, force: true });
      await compilePack(`${RACINE}/src/${pack}`, `${RACINE}/packs/${pack}`);
    }
    console.log("compendiums compilés dans", `${RACINE}/packs/`);
  }
}
