// Simulateur de veillées (hors suite d'essais ; Le Pacte, étape 6) : joue des parties ENTIÈRES des Veillées de Brumecombe avec le
// vrai système, le vrai contenu et les outils du MJ IA sur la doublure de Foundry (essais/outils/partie-loups.mjs, sans les
// vérifications de l'essai d'intégration), des joueurs simulés qui suivent les politiques par rôle (systems/lakour-loups/logique/
// politiques.mjs) avec une ADRESSE donnée, et mesure l'équilibre (docs/equilibre-veillees.md).
//
//   node essais/outils/simuler-veillees.mjs --parties 100 --graine 1                 (tailles 6 à 18 de deux en deux, quatre niveaux)
//   node essais/outils/simuler-veillees.mjs --rapide                                 (16 parties par case, comme essais/veillees-equilibre.test.mjs)
//   node essais/outils/simuler-veillees.mjs --variantes ordinaire,chaine --loups-de-moins 0,1,2 --niveaux classique,le-pacte --tailles 8,12,16
//             (le dosage d'une variante, Le Pacte, étape 6b : des parties APPARIÉES, la même composition du générateur — graine
//             « dosage|<niveau>|<n>|<i> » — jouée telle quelle, puis avec 1, 2… Loups de Brumecombe remplacés par des Villageois ;
//             la variante s'affiche « chaine-1loup »…)
//   options : --tailles 6,8,10  --niveaux debutants,classique,chaos,le-pacte  --adresse 0.4,1 (ou niveau : ADRESSE_DU_NIVEAU)  --variantes ordinaire,vendanges,…
//             --village (la variante « Le Village »)  --pretes (les compositions prêtes au lieu des générées)
//             --fils 8 (fils d'exécution : une doublure par fil ; défaut : 16 au plus, au-delà les fils se gênent)  --json <fichier>
//
// Une case = un niveau × une taille × une adresse × une variante ; chaque partie a sa graine (graine|niveau|taille|adresse|variante|i) :
// même graine, mêmes parties. La composition est celle que tire le générateur du système pour la Table de jeu (api.nouvellePartie,
// niveau et taille donnés), ou la composition prête du contenu (--pretes : « <niveau>-<nn> »).
// Variantes (--variantes) : ordinaire, chandelles, angoissante, chaine, mur, petite (Double visage, petite complication), grande,
// vendanges, envoutement, gazette, village.
// Tableaux markdown : victoires par camp (meute, village, chaque solitaire, amoureux) et durée, par case, par taille et par niveau ;
// les solitaires (la part des parties qu'ils gagnent quand ils sont là) ; l'attribution par rôle (la part des victoires du village
// quand le rôle est là, et quand il n'y est pas, au même niveau).
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { composer } from "../../systems/lakour-loups/logique/composition.mjs";

export const NIVEAUX_SIMULES = ["debutants", "classique", "chaos", "le-pacte"];
export const TAILLES_SIMULEES = [6, 8, 10, 12, 14, 16, 18];
export const PARTIES_RAPIDE = 16;
export const ADRESSES = [0.4, 1];
// L'adresse de RÉFÉRENCE de chaque niveau (Le Pacte, étape 6b, docs/equilibre-veillees.md) : celle d'une vraie soirée à ce niveau,
// celle que la calibration vise (la meute à 50 % des parties gagnées par la meute ou le village). Des débutants se servent mal de ce
// qu'ils savent (0,5) ; une table classique, ou du jeu de soirée, assez bien (0,75) ; une table de chaos, rompue au jeu, de tout (1).
// --adresse niveau (ou adresses: ["niveau"]) : chaque niveau à la sienne.
export const ADRESSE_DU_NIVEAU = { debutants: 0.5, classique: 0.75, chaos: 1, "le-pacte": 0.75 };
export const adresseDe = (adresse, niveau) => (adresse === "niveau" ? ADRESSE_DU_NIVEAU[niveau] ?? 1 : adresse);
export const VARIANTES_SIMULEES = ["ordinaire", "chandelles", "angoissante", "chaine", "mur", "petite", "grande", "vendanges", "envoutement", "gazette", "village"];
const EQUILIBRE = JSON.parse(readFileSync(new URL("../../modules/lakour-veillees/assets/equilibre.json", import.meta.url), "utf8"));
const COMPOSITIONS = JSON.parse(readFileSync(new URL("../../modules/lakour-veillees/assets/compositions.json", import.meta.url), "utf8"));

// Les options d'une variante pour jouerPartie (la voie de api.nouvellePartie).
// Plusieurs variantes ensemble : « chaine+petite ».
export function optionsDeVariante(v) {
  const o = { variantes: {}, village: false, gazette: false };
  if (String(v ?? "").includes("+")) {
    for (const x of String(v).split("+").map(optionsDeVariante)) Object.assign(o, { village: o.village || x.village, gazette: o.gazette || x.gazette, variantes: { ...o.variantes, ...x.variantes } });
    return o;
  }
  if (v === "village") o.village = true;
  else if (v === "gazette") o.gazette = true;
  else if (v === "petite" || v === "grande") o.variantes.doubleVisage = v;
  else if (v === "angoissante") Object.assign(o.variantes, { chandelles: true, angoissante: true });
  else if (v && v !== "ordinaire") o.variantes[v] = true;
  return o;
}

// Les cas : [{ niveau, n, adresse, variante, pretes }].
export function casDe({ tailles = TAILLES_SIMULEES, niveaux = NIVEAUX_SIMULES, adresses = ADRESSES, variantes = ["ordinaire"], pretes = false, village = false } = {}) {
  const cas = [];
  for (const niveau of niveaux) for (const n of tailles) for (const a of adresses) for (const variante of variantes) {
    if (pretes && !COMPOSITIONS[`${niveau}-${String(n).padStart(2, "0")}`]) continue;
    const adresse = adresseDe(a, niveau);
    cas.push({ niveau, n, adresse, variante: village && variante === "ordinaire" ? "village" : variante, pretes });
  }
  return cas;
}

// Une partie d'un cas (dans un fil qui a chargé la doublure).
async function jouerUne(jouerPartie, c, i, graine) {
  const g = `s${graine}|${c.niveau}|${c.n}|${c.adresse}|${c.variante}|${c.pretes ? "p" : "g"}|${i}`;
  const base = { n: c.n, niveau: c.niveau, graine: g, verifier: false, adresse: c.adresse, ...optionsDeVariante(c.variante) };
  if (c.pretes) base.composition = `${c.niveau}-${String(c.n).padStart(2, "0")}`;
  if (c.reglages) base.reglages = c.reglages;
  if (c.roles) Object.assign(base, { roles: c.roles, batiments: c.batiments?.length ? c.batiments : "aucun", metiers: c.niveau !== "le-pacte" });
  const t0 = performance.now();
  try {
    const r = await jouerPartie(base);
    return { ...r, duree: Math.round(performance.now() - t0), cas: cleDuCas(c), variante: c.moins ? `${c.variante}-${c.moins}loup` : c.variante, adresse: c.adresse, niveau: c.niveau, n: c.n, i, ...(c.somme !== undefined ? { somme: c.somme, cible: c.cible } : {}), ...(c.etiquette !== undefined ? { etiquette: c.etiquette } : {}) };
  } catch (e) {
    return { erreur: String(e.message).split("\n")[0], cas: cleDuCas(c), variante: c.variante, adresse: c.adresse, niveau: c.niveau, n: c.n, i, roles: c.roles ?? [], ...(c.etiquette !== undefined ? { etiquette: c.etiquette } : {}) };
  }
}
export const cleDuCas = c => `${c.niveau}|${c.n}|${c.adresse}|${c.variante}`;

// Les tâches (une par partie), réparties entre les fils ; chaque fil a sa propre doublure (un monde Foundry en mémoire).
// taches : [{ c (cas, avec roles/batiments éventuels), i }]
export async function jouerTaches(taches, { graine = "1", fils = Math.max(1, Math.min(16, cpus().length - 1)), progres = null } = {}) {
  if (fils <= 1 || taches.length < 2) {
    const { jouerPartie } = await import("./partie-loups.mjs");
    const sortie = [];
    for (const t of taches) { sortie.push(await jouerUne(jouerPartie, t.c, t.i, graine)); progres?.(sortie.length, taches.length); }
    return sortie;
  }
  const lots = Array.from({ length: Math.min(fils, taches.length) }, () => []);
  taches.forEach((t, k) => lots[k % lots.length].push(t));
  let faites = 0;
  const resultats = await Promise.all(lots.map(lot => new Promise((resoudre, rejeter) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { lot, graine }, stdout: true, stderr: true });
    w.stdout.resume(); w.stderr.resume();   // la doublure parle (avertissements du système) : on ne l'écoute pas
    const sortie = [];
    w.on("message", m => {
      if (m?.fin) return resoudre(sortie);
      sortie.push(m); faites++; progres?.(faites, taches.length);
    });
    w.on("error", rejeter);
    w.on("exit", code => { if (code !== 0) rejeter(new Error(`fil terminé avec le code ${code}`)); });
  })));
  return resultats.flat();
}

// Simule les cas, `parties` parties chacun. -> Promise<[résultat]>
export async function simuler({ parties = 100, graine = "1", fils, progres, loupsDeMoins = null, ...options } = {}) {
  const taches = loupsDeMoins ? tachesDeDosage(casDe(options), parties, loupsDeMoins)
    : casDe(options).flatMap(c => Array.from({ length: parties }, (_, i) => ({ c, i })));
  return jouerTaches(taches, { graine, fils, progres });
}

// Le dosage (Le Pacte, étape 6b) : pour chaque cas et chaque partie, la composition du générateur (la même pour toutes les variantes
// et tous les dosages : graine « dosage|<niveau>|<n>|<i> »), avec `k` Loups de Brumecombe remplacés par des Villageois (k parmi
// loupsDeMoins ; 0 : telle quelle). La graine de la partie ne dépend pas de k : seules les cartes changent.
export function tachesDeDosage(cas, parties, loupsDeMoins = [0]) {
  const eq = { roles: EQUILIBRE.roles, batiments: EQUILIBRE.batiments, cibles: EQUILIBRE.cibles };
  const taches = [];
  for (const c of cas) for (let i = 0; i < parties; i++) {
    const compo = composer(c.n, eq, { niveau: c.niveau, graine: `dosage|${c.niveau}|${c.n}|${i}`, essais: 600 });
    for (const k of loupsDeMoins) {
      let reste = k;
      const roles = compo.roles.map(r => (r === "loup-de-brumecombe" && reste-- > 0 ? "villageois" : r));
      taches.push({ c: { ...c, roles, batiments: compo.batiments, moins: k }, i });
    }
  }
  return taches;
}

if (!isMainThread && workerData?.lot) {
  const { jouerPartie } = await import("./partie-loups.mjs");
  for (const t of workerData.lot) parentPort.postMessage(await jouerUne(jouerPartie, t.c, t.i, workerData.graine));
  parentPort.postMessage({ fin: true });
}

// ------------------------------------------------------------------ mesures
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : "—");
const moyenne = l => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
export const SOLITAIRES = Object.entries(EQUILIBRE.roles).filter(([, r]) => r.camp === "solitaire").map(([c]) => c);
// Le camp vainqueur d'une partie, pour les tableaux : meute, village, amoureux, ou la clé du solitaire.
export const campVainqueur = r => (r.camp === "meute" || r.camp === "village" || r.camp === "amoureux" ? r.camp : SOLITAIRES.includes(r.camp) ? r.camp : r.camp === "loup-pale" ? "loup-pale" : "autre");
// La marge à 95 % d'une part p sur n parties (en points).
export const marge = (p, n) => (n ? Math.round(196 * Math.sqrt(Math.max(p * (1 - p), 0.0001) / n)) : 0);

export function bilanDe(l) {
  const ok = l.filter(r => !r.erreur);
  const c = {};
  for (const r of ok) c[campVainqueur(r)] = (c[campVainqueur(r)] ?? 0) + 1;
  const solitaires = SOLITAIRES.reduce((s, k) => s + (c[k] ?? 0), 0) + (c["loup-pale"] ?? 0) + (c.autre ?? 0);
  return { parties: ok.length, erreurs: l.length - ok.length, meute: c.meute ?? 0, village: c.village ?? 0, amoureux: c.amoureux ?? 0, solitaires, parCamp: c,
    tours: Math.round(10 * moyenne(ok.map(r => r.tours))) / 10, partMeute: ok.length ? (c.meute ?? 0) / ok.length : 0, partVillage: ok.length ? (c.village ?? 0) / ok.length : 0 };
}
const ligne = (nom, b) => `| ${nom} | ${b.parties}${b.erreurs ? ` (${b.erreurs} err.)` : ""} | ${pct(b.meute, b.parties)} | ${pct(b.village, b.parties)} | ${pct(b.solitaires, b.parties)} | ${pct(b.amoureux, b.parties)} | ±${marge(b.partMeute, b.parties)} | ${b.tours} |`;
const ENTETE = ["| Case | Parties | Meute | Village | Solitaires | Amoureux | Marge (95 %) | Tours |", "|---|---|---|---|---|---|---|---|"];

export function mesurer(resultats) {
  const groupes = cle => { const g = new Map(); for (const r of resultats) { const k = cle(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); } return g; };
  return {
    parCas: groupes(r => `${r.niveau}|${r.variante}|${r.adresse}|${r.n}`),
    parNiveau: groupes(r => `${r.niveau}|${r.variante}|${r.adresse}`),
    parTaille: groupes(r => `${r.variante}|${r.adresse}|${r.n}`),
    parVariante: groupes(r => `${r.variante}|${r.adresse}`),
    resultats
  };
}

export function tableaux(m, { titre = "" } = {}) {
  const l = [];
  const trier = map => [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr", { numeric: true }));
  if (titre) l.push(`## ${titre}`, "");
  l.push("### Par niveau (toutes tailles)", "", ...ENTETE);
  for (const [k, v] of trier(m.parNiveau)) { const [niveau, variante, adresse] = k.split("|"); l.push(ligne(`${niveau}${variante !== "ordinaire" ? ` — ${variante}` : ""}, adresse ${adresse}`, bilanDe(v))); }
  l.push("", "### Par taille (tous niveaux)", "", ...ENTETE);
  for (const [k, v] of trier(m.parTaille)) { const [variante, adresse, n] = k.split("|"); l.push(ligne(`${n} joueurs${variante !== "ordinaire" ? ` — ${variante}` : ""}, adresse ${adresse}`, bilanDe(v))); }
  l.push("", "### Par case (niveau × taille)", "", ...ENTETE);
  for (const [k, v] of trier(m.parCas)) { const [niveau, variante, adresse, n] = k.split("|"); l.push(ligne(`${niveau}${variante !== "ordinaire" ? ` — ${variante}` : ""}, ${n}, adresse ${adresse}`, bilanDe(v))); }
  if ([...m.parVariante.keys()].some(k => !k.startsWith("ordinaire|"))) {
    l.push("", "### Variantes contre la partie ordinaire (mêmes niveaux, tailles et graines)", "", "| Variante | Adresse | Parties | Meute | Village | Solitaires | Écart meute (points) | Tours |", "|---|---|---|---|---|---|---|---|");
    for (const [k, v] of trier(m.parVariante)) {
      const [variante, adresse] = k.split("|");
      const b = bilanDe(v), o = bilanDe(m.parVariante.get(`ordinaire|${adresse}`) ?? []);
      l.push(`| ${variante} | ${adresse} | ${b.parties} | ${pct(b.meute, b.parties)} | ${pct(b.village, b.parties)} | ${pct(b.solitaires, b.parties)} | ${o.parties && variante !== "ordinaire" ? `${Math.round(100 * (b.partMeute - o.partMeute)) >= 0 ? "+" : ""}${Math.round(100 * (b.partMeute - o.partMeute))}` : "—"} | ${b.tours} |`);
    }
  }
  l.push("", ...tableauSolitaires(m.resultats), "", ...tableauAttribution(m.resultats));
  return l.join("\n");
}

// Les solitaires : dans les parties où chacun est distribué, la part qu'il gagne.
export function solitairesDe(resultats) {
  const ok = resultats.filter(r => !r.erreur);
  const sortie = {};
  for (const s of [...SOLITAIRES, "loup-pale"]) {
    const avec = ok.filter(r => r.roles?.includes(s));
    if (!avec.length) continue;
    sortie[s] = { parties: avec.length, victoires: avec.filter(r => r.camp === s).length, part: avec.filter(r => r.camp === s).length / avec.length };
  }
  return sortie;
}
function tableauSolitaires(resultats) {
  const s = solitairesDe(resultats);
  const l = ["### Solitaires (parties où il est distribué)", "", "| Rôle | Parties | Il gagne | Marge (95 %) |", "|---|---|---|---|"];
  for (const [cle, x] of Object.entries(s).sort((a, b) => b[1].parties - a[1].parties)) l.push(`| ${cle} | ${x.parties} | ${pct(x.victoires, x.parties)} | ±${marge(x.part, x.parties)} |`);
  return l;
}
// L'attribution par rôle : la part des victoires du village quand le rôle est distribué, et quand il ne l'est pas, dans les mêmes
// niveaux (la différence est brute : la taille et les autres rôles se mêlent ; la calibration, elle, les sépare).
export function attributionDe(resultats) {
  const ok = resultats.filter(r => !r.erreur);
  const roles = [...new Set(ok.flatMap(r => r.roles ?? []))].sort();
  return roles.map(cle => {
    const niveaux = new Set(ok.filter(r => r.roles.includes(cle)).map(r => r.niveau));
    const memes = ok.filter(r => niveaux.has(r.niveau));
    const avec = memes.filter(r => r.roles.includes(cle)), sans = memes.filter(r => !r.roles.includes(cle));
    const pv = l => (l.length ? l.filter(r => r.camp === "village").length / l.length : 0);
    return { cle, avec: avec.length, sans: sans.length, villageAvec: pv(avec), villageSans: pv(sans), ecart: pv(avec) - pv(sans) };
  });
}
function tableauAttribution(resultats) {
  const l = ["### Attribution par rôle (victoires du village, rôle présent contre absent, mêmes niveaux)", "",
    "| Rôle | Poids | Parties avec | Village avec | Parties sans | Village sans | Écart (points) |", "|---|---|---|---|---|---|---|"];
  for (const x of attributionDe(resultats).sort((a, b) => b.ecart - a.ecart)) {
    if (x.cle === "villageois" || x.cle === "loup-de-brumecombe") continue;
    l.push(`| ${x.cle} | ${EQUILIBRE.roles[x.cle]?.poids ?? "?"} | ${x.avec} | ${Math.round(100 * x.villageAvec)} % | ${x.sans} | ${Math.round(100 * x.villageSans)} % | ${x.ecart >= 0 ? "+" : ""}${Math.round(100 * x.ecart)} |`);
  }
  return l;
}

// ------------------------------------------------------------------ ligne de commande
function lireOptions(argv) {
  const liste = s => String(s).split(",").map(x => x.trim()).filter(Boolean);
  const o = { parties: 100, graine: "1", fils: Math.max(1, Math.min(16, cpus().length - 1)), json: null, tailles: TAILLES_SIMULEES, niveaux: NIVEAUX_SIMULES, adresses: ADRESSES,
    variantes: ["ordinaire"], village: false, pretes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--parties") o.parties = Number(argv[++i]);
    else if (a === "--graine") o.graine = String(argv[++i]);
    else if (a === "--tailles") o.tailles = liste(argv[++i]).map(Number);
    else if (a === "--niveaux") o.niveaux = liste(argv[++i]);
    else if (a === "--adresse") o.adresses = liste(argv[++i]).map(x => (x === "niveau" ? x : Number(x)));
    else if (a === "--variantes") o.variantes = liste(argv[++i]);
    else if (a === "--village") o.village = true;
    else if (a === "--pretes") o.pretes = true;
    else if (a === "--fils") o.fils = Number(argv[++i]);
    else if (a === "--json") o.json = argv[++i];
    else if (a === "--rapide") o.parties = PARTIES_RAPIDE;
    else if (a === "--loups-de-moins") o.loupsDeMoins = liste(argv[++i]).map(Number);
  }
  return o;
}

if (isMainThread && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const o = lireOptions(process.argv.slice(2));
  const debut = performance.now();
  let dernier = 0;
  const resultats = await simuler({ ...o, progres: (f, t) => { if (performance.now() - dernier > 15000) { dernier = performance.now(); process.stderr.write(`  ${f}/${t} parties (${Math.round((performance.now() - debut) / 1000)} s)\n`); } } });
  const m = mesurer(resultats);
  console.log(tableaux(m, { titre: `${o.pretes ? "Compositions prêtes" : "Compositions générées"} — ${o.parties} parties par case, graine ${o.graine}` }));
  const erreurs = resultats.filter(r => r.erreur);
  if (erreurs.length) console.log(`\n${erreurs.length} parties en erreur, par exemple : ${erreurs.slice(0, 3).map(r => `${r.cas} #${r.i} : ${r.erreur}`).join(" ; ")}`);
  console.log(`\n(${resultats.length} parties, graine ${o.graine}, ${Math.round((performance.now() - debut) / 1000)} s, ${o.fils} fils)`);
  if (o.json) writeFileSync(o.json, JSON.stringify({ options: o, resultats }, null, 1));
}
