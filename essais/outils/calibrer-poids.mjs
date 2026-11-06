// Calibration des poids des Veillées (hors suite d'essais ; Le Pacte, étape 6, docs/equilibre-veillees.md) : des compositions VARIÉES
// (le générateur du système, composer, vers des cibles tirées au hasard de -12 à +12, aux quatre niveaux et de 6 à 18 joueurs ; une
// sur six avec la variante « Le Village » aux niveaux classique et chaos), jouées jusqu'au bout par le simulateur
// (essais/outils/simuler-veillees.mjs, joueurs d'une adresse donnée), puis une régression logistique
//
//     P(village | village ou meute gagne) = σ( b(niveau, n) + Σ β_r · nombre_r + β_V · [Le Village] )
//
// (rôles distribués comptés, sauf les deux références, le Villageois et le Loup de Brumecombe ; une ordonnée par niveau et par taille,
// qui compte aussi les bâtiments, tirés parmi ceux du niveau ; un léger rappel vers les poids actuels, pour les rôles rares). Les solitaires sont traités à part : leur effet sur la balance
// village / meute est un poids comme un autre, et la part des parties qu'ils gagnent est rapportée (visée : 5 à 20 %).
//
// L'échelle : un rôle du Village (ou solitaire) vaut 1 + β_r·u, un loup à pouvoir -6 + β_r·u (le Villageois +1 et le Loup de Brumecombe
// -6 gardent leur poids, comme avant) ; u (des poids par unité de logit) est celui qui garde les nouveaux poids au plus près des
// anciens. La CIBLE d'une taille et d'un niveau est la somme des poids qui donne une chance sur deux au village :
//     cible(niveau, n) = (n - m) - 6·m - b(niveau, n)·u        (m : les loups de la taille, nombreDeLoups)
// La petite tablée (ses compagnons IA jouent sans les politiques) garde ses compositions : sa cible devient la somme moyenne, aux
// nouveaux poids, des compositions que tiraient les anciens.
//
//   node essais/outils/calibrer-poids.mjs --parties 16000 --graine cal --adresse 1          (simule, ajuste, propose)
//   node essais/outils/calibrer-poids.mjs --depuis a.json,b.json --parties 0                (ajuste des parties déjà jouées, à cette
//             adresse : --json du simulateur ou de la calibration ; avec --parties N, en joue N de plus)
//   node essais/outils/calibrer-poids.mjs --corriger validation.json --echelle 5.68 --ecrire      (second passage des cibles, d'après
//             une validation du simulateur : corrigerCibles ; --sans-interpoler : seules les tailles mesurées bougent)
//   options : --fils 16  --json <fichier> (les parties)  --ecrire (écrit poids et cibles dans modules/lakour-veillees/contenu/equilibre.mjs)
//             --lambda 2 (le rappel vers les anciens poids)
//   node essais/outils/calibrer-poids.mjs --constante chanceEpier --valeurs 0.25,0.5,0.75 --role enfant-de-la-brume --parties 300
//             (une constante du système, réglage par réglage : des parties APPARIÉES, la même composition avec le rôle et sans lui —
//             remplacé par un Villageois —, à chaque valeur ; --variante village pour une constante du Village, sans --role : la part
//             du village à chaque valeur, mêmes compositions)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
import { composer, nombreDeLoups, cibleTablee, equilibreDe } from "../../systems/lakour-loups/logique/composition.mjs";
import { creerHasard } from "../../systems/lakour-loups/logique/hasard.mjs";
import { EQUILIBRE, EQUILIBRE_BATIMENTS } from "../../modules/lakour-veillees/contenu/equilibre.mjs";
import { jouerTaches, NIVEAUX_SIMULES, solitairesDe } from "./simuler-veillees.mjs";

export const REFERENCES = { village: "villageois", meute: "loup-de-brumecombe" };
export const ANCRES = { village: 1, solitaire: 1, meute: -6 };
const TAILLES = Array.from({ length: 13 }, (_, i) => 6 + i);
const EQ = { roles: EQUILIBRE, batiments: EQUILIBRE_BATIMENTS };

// ------------------------------------------------------------------ l'échantillon
// -> [{ c: { niveau, n, adresse, variante, roles, batiments, somme, cible }, i }]
export function echantillon(parties, { graine = "cal", adresse = 1, equilibre = EQ } = {}) {
  const h = creerHasard(`echantillon|${graine}`);
  const taches = [];
  for (let i = 0; i < parties; i++) {
    const niveau = NIVEAUX_SIMULES[i % NIVEAUX_SIMULES.length];
    const n = TAILLES[Math.floor(h() * TAILLES.length)];
    const cible = Math.round(-12 + 24 * h());
    const village = (niveau === "classique" || niveau === "chaos") && h() < 1 / 6;
    const c = composer(n, equilibre, { niveau, cible, graine: `cal|${graine}|${i}`, village, essais: 400 });
    taches.push({ c: { niveau, n, adresse, variante: village ? "village" : "ordinaire", roles: c.roles, batiments: c.batiments, somme: c.somme, cible }, i });
  }
  return taches;
}

// ------------------------------------------------------------------ la régression
// Résout A x = b (A symétrique définie positive) par Cholesky ; renvoie aussi l'inverse de la diagonale (les variances).
function resoudre(A, b) {
  const n = b.length;
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i][j] = s / L[j][j];
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  // Diagonale de l'inverse : colonnes de L^-1.
  const diag = new Float64Array(n);
  const Linv = Array.from({ length: n }, () => new Float64Array(n));
  for (let j = 0; j < n; j++) {
    for (let i = j; i < n; i++) {
      let s = i === j ? 1 : 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Linv[k][j];
      Linv[i][j] = s / L[i][i];
    }
  }
  for (let i = 0; i < n; i++) { let s = 0; for (let k = i; k < n; k++) s += Linv[k][i] ** 2; diag[i] = s; }
  return { x, diag };
}

// Les lignes : [{ x: [[indice, valeur]], y }] ; params : [{ nom, type, prior, lambda }]. IRLS (Newton) avec rappel ridge.
export function logistique(lignes, params, { iterations = 60 } = {}) {
  const p = params.length;
  // Départ à zéro (partir des rappels saturait les parties très déséquilibrées : Newton divergeait), pas bornés.
  const beta = new Float64Array(p);
  let variances = new Float64Array(p);
  for (let it = 0; it < iterations; it++) {
    const H = Array.from({ length: p }, () => new Float64Array(p));
    const g = new Float64Array(p);
    for (const { x, y } of lignes) {
      let eta = 0;
      for (const [j, v] of x) eta += beta[j] * v;
      const mu = 1 / (1 + Math.exp(-eta));
      const w = Math.max(mu * (1 - mu), 1e-9);
      for (const [j, v] of x) {
        g[j] += (y - mu) * v;
        for (const [k, u] of x) H[j][k] += w * v * u;
      }
    }
    for (let j = 0; j < p; j++) { const l = params[j].lambda ?? 0; H[j][j] += l; g[j] -= l * (beta[j] - (params[j].prior ?? 0)); }
    const { x: pas, diag } = resoudre(H, g);
    const plus = Math.max(...pas.map(Math.abs));
    const facteur = plus > 1 ? 1 / plus : 1;
    let max = 0;
    for (let j = 0; j < p; j++) { beta[j] += facteur * pas[j]; max = Math.max(max, Math.abs(facteur * pas[j])); }
    variances = diag;
    if (max < 1e-7) break;
  }
  return { beta: [...beta], erreurs: [...variances].map(Math.sqrt) };
}

// Les parties jouées -> lignes et paramètres.
function preparer(resultats, { anciens = EQUILIBRE, u0 = null, lambda = 2 } = {}) {
  const roles = Object.keys(anciens).filter(c => c !== REFERENCES.village && c !== REFERENCES.meute);
  // Les bâtiments ne sont pas des variables : le générateur les tire parmi ceux du niveau (quatre pour débutants, toujours les mêmes),
  // leurs effets ne se séparent pas de l'ordonnée du niveau et de la taille, qui les compte (la cible vaut pour les bâtiments du niveau).
  const batiments = [];
  const cellules = [...new Set(resultats.map(r => `${r.niveau}|${r.n}`))].sort();
  const params = [
    ...roles.map(cle => ({ nom: cle, type: "role", lambda, prior: u0 ? (anciens[cle].poids - ANCRES[anciens[cle].camp]) / u0 : 0 })),
    ...batiments.map(cle => ({ nom: cle, type: "batiment", lambda, prior: 0 })),
    { nom: "le-village", type: "variante", lambda, prior: 0 },
    ...cellules.map(cle => ({ nom: cle, type: "ordonnee", lambda: 0.01, prior: 0 }))
  ];
  const indice = new Map(params.map((q, i) => [`${q.type}|${q.nom}`, i]));
  const lignes = [];
  for (const r of resultats) {
    if (r.erreur || (r.camp !== "village" && r.camp !== "meute")) continue;
    const compte = new Map();
    // Les rôles DISTRIBUÉS (avec le Chapardeur, les deux cartes du centre ne jouent pas).
    for (const c of r.roles) if (indice.has(`role|${c}`)) compte.set(c, (compte.get(c) ?? 0) + 1);
    const x = [...compte].map(([c, n]) => [indice.get(`role|${c}`), n]);
    for (const b of r.batiments ?? []) if (indice.has(`batiment|${b}`)) x.push([indice.get(`batiment|${b}`), 1]);
    if (r.variante === "village") x.push([indice.get("variante|le-village"), 1]);
    x.push([indice.get(`ordonnee|${r.niveau}|${r.n}`), 1]);
    lignes.push({ x, y: r.camp === "village" ? 1 : 0, r });
  }
  return { lignes, params };
}

// L'échelle u : celle qui garde les nouveaux poids (ancre + β·u) au plus près des anciens, chaque rôle pesé par ses parties.
function echelle(params, beta, frequences, anciens = EQUILIBRE) {
  let num = 0, den = 0;
  params.forEach((q, j) => {
    if (q.type !== "role") return;
    const f = frequences.get(q.nom) ?? 0;
    const ecart = anciens[q.nom].poids - ANCRES[anciens[q.nom].camp];
    num += f * beta[j] * ecart; den += f * beta[j] ** 2;
  });
  return den > 0 && num > 0 ? num / den : 1;
}

export function calibrer(resultats, { lambda = 2, anciens = EQUILIBRE } = {}) {
  const joues = resultats.filter(r => !r.erreur);
  const frequences = new Map();
  for (const r of joues) for (const c of new Set(r.roles)) frequences.set(c, (frequences.get(c) ?? 0) + 1);
  // Premier passage, sans rappel vers les anciens poids : l'échelle ; second passage : rappel vers les anciens à cette échelle.
  const a = preparer(joues, { anciens, lambda: 0.5 });
  const premier = logistique(a.lignes, a.params);
  const u1 = echelle(a.params, premier.beta, frequences, anciens);
  const b = preparer(joues, { anciens, u0: u1, lambda });
  const second = logistique(b.lignes, b.params);
  const u = echelle(b.params, second.beta, frequences, anciens);
  const poids = {}, batiments = {}, ordonnees = {};
  b.params.forEach((q, j) => {
    const beta = second.beta[j], se = second.erreurs[j];
    if (q.type === "role") {
      const camp = anciens[q.nom].camp;
      poids[q.nom] = { ancien: anciens[q.nom].poids, brut: ANCRES[camp] + beta * u, erreur: se * u, parties: frequences.get(q.nom) ?? 0, camp };
    } else if (q.type === "batiment") batiments[q.nom] = { brut: beta * u, erreur: se * u };
    else if (q.type === "variante") batiments["le-village"] = { brut: beta * u, erreur: se * u };
    else ordonnees[q.nom] = { b: beta, erreur: se };
  });
  for (const [cle, x] of Object.entries(poids)) x.nouveau = x.parties >= 30 ? Math.round(x.brut) : x.ancien;
  // Les cibles par niveau et par taille (parties ordinaires : sans Le Village, dont l'effet est rapporté à part).
  const cibles = {};
  for (const [cle, o] of Object.entries(ordonnees)) {
    const [niveau, n] = [cle.split("|")[0], Number(cle.split("|")[1])];
    const m = nombreDeLoups(n);
    (cibles[niveau] ??= {})[n] = { brute: (n - m) - 6 * m - o.b * u, erreur: o.erreur * u, parties: b.lignes.filter(l => l.r.niveau === niveau && l.r.n === n).length };
  }
  // Lissage : une taille et ses deux voisines (même nombre de loups), pesées 1-2-1.
  for (const niveau of Object.keys(cibles)) for (const n of Object.keys(cibles[niveau]).map(Number)) {
    const t = cibles[niveau];
    const voisines = [n - 1, n + 1].filter(k => t[k] && nombreDeLoups(k) === nombreDeLoups(n));
    t[n].lissee = (2 * t[n].brute + voisines.reduce((s, k) => s + t[k].brute, 0)) / (2 + voisines.length);
    t[n].cible = Math.round(t[n].lissee);
  }
  return { u, poids, batiments, cibles, parties: joues.length, ajustees: b.lignes.length, solitaires: solitairesDe(joues) };
}

// La petite tablée : la cible qui garde ses compositions (la somme moyenne, aux nouveaux poids, de celles que tiraient les anciens).
export function ciblesDeLaTablee(nouveaux, { anciens = EQUILIBRE, tirages = 300 } = {}) {
  const sortie = {};
  const nouvelEq = { roles: Object.fromEntries(Object.entries(anciens).map(([c, r]) => [c, { ...r, poids: nouveaux[c] ?? r.poids }])), batiments: EQUILIBRE_BATIMENTS };
  for (let n = 4; n <= 12; n++) {
    let s = 0;
    for (let i = 0; i < tirages; i++) s += equilibreDe(composer(n, { roles: anciens, batiments: EQUILIBRE_BATIMENTS }, { niveau: "petite-tablee", cible: cibleTablee(n), graine: `tablee|${n}|${i}`, essais: 300 }).roles, nouvelEq);
    sortie[n] = Math.round(s / tirages);
  }
  return sortie;
}

// ------------------------------------------------------------------ une constante du système (réglage par réglage)
// -> taches appariées : pour chaque composition (classique ou chaos, 8 à 16 joueurs, qui a le rôle), à chaque valeur, avec et sans lui.
export function tachesDeConstante({ constante, valeurs, role = "", variante = "ordinaire", parties = 300, graine = "constante", adresse = 1, equilibre = EQ }) {
  const h = creerHasard(`constante|${graine}`);
  const taches = [];
  for (let i = 0; i < parties; i++) {
    const niveau = i % 2 ? "chaos" : "classique";
    const n = 8 + Math.floor(h() * 9);
    const c = composer(n, equilibre, { niveau, graine: `constante|${graine}|${i}`, inclure: role ? [role] : [], village: variante === "village", essais: 400 });
    for (const v of valeurs) for (const avec of role ? [true, false] : [true]) {
      const roles = avec ? c.roles : c.roles.map(r => (r === role ? "villageois" : r));
      taches.push({ c: { niveau, n, adresse, variante, roles, batiments: c.batiments, reglages: { [constante]: v }, valeur: v, avec, etiquette: taches.length }, i });
    }
  }
  return taches;
}
export function bilanDeConstante(taches, resultats) {
  const lignes = new Map();
  resultats.forEach((r, k) => {
    const t = taches[k];
    if (r.erreur) return;
    const cle = `${t.c.valeur}|${t.c.avec ? "avec" : "sans"}`;
    const x = lignes.get(cle) ?? { parties: 0, village: 0, meute: 0 };
    x.parties++; if (r.camp === "village") x.village++; if (r.camp === "meute") x.meute++;
    lignes.set(cle, x);
  });
  return [...lignes].sort().map(([cle, x]) => ({ valeur: Number(cle.split("|")[0]), avec: cle.endsWith("avec"), ...x, part: x.village / Math.max(1, x.parties) }));
}

// ------------------------------------------------------------------ le second passage des cibles
// Une validation (parties du simulateur, compositions générées à la cible, adresse de la calibration) donne, dans chaque case, la part
// p du village parmi les parties gagnées par le village ou la meute : un pas de Newton sur la cible, amorti (× 0,8),
// cible' = cible - u · logit(p) — là où la régression, additive, se trompe (les compositions extrêmes, l'effet de parité des tailles). Les
// tailles non mesurées prennent la correction moyenne de leurs voisines de même nombre de loups (sinon des plus proches). Puis la cible
// est bornée à ce que le générateur atteint (au-delà, il prendrait la composition la plus proche : la cible ne serait qu'un vœu).
// interpoler (vrai par défaut) : faux, seules les tailles mesurées bougent (une validation des seules tailles impaires, par exemple).
export function corrigerCibles(resultats, { u, cibles, adresse = 1, equilibre = EQ, amorti = 0.8, interpoler = true } = {}) {
  const r = resultats.filter(x => !x.erreur && Number(x.adresse) === adresse && (x.camp === "village" || x.camp === "meute"));
  const sortie = {}, bornees = [];
  for (const [niveau, t] of Object.entries(cibles)) {
    const ici = r.filter(x => x.niveau === niveau);
    if (!ici.length) { sortie[niveau] = { ...t }; continue; }
    const corr = {};
    for (const n of new Set(ici.map(x => x.n))) {
      const l = ici.filter(x => x.n === n);
      const p = Math.min(0.95, Math.max(0.05, l.filter(x => x.camp === "village").length / l.length));
      corr[n] = -amorti * u * Math.log(p / (1 - p));
    }
    sortie[niveau] = {};
    for (const n of Object.keys(t).map(Number)) {
      let d = corr[n];
      if (d === undefined && !interpoler) d = 0;
      if (d === undefined) {
        const memes = [n - 1, n + 1].filter(k => corr[k] !== undefined && nombreDeLoups(k) === nombreDeLoups(n));
        const l = memes.length ? memes : [n - 1, n + 1].filter(k => corr[k] !== undefined);
        d = l.length ? l.reduce((s, k) => s + corr[k], 0) / l.length : 0;
      }
      let min = Infinity, max = -Infinity;
      for (let g = 0; g < 4; g++) {
        min = Math.min(min, composer(n, equilibre, { niveau, cible: -60, graine: `borne${g}`, essais: 600 }).somme);
        max = Math.max(max, composer(n, equilibre, { niveau, cible: 60, graine: `borne${g}`, essais: 600 }).somme);
      }
      const voulue = Math.round(t[n] + d);
      sortie[niveau][n] = Math.min(max, Math.max(min, voulue));
      if (sortie[niveau][n] !== voulue) bornees.push(`${niveau} ${n} : ${voulue} hors de [${min}, ${max}] -> ${sortie[niveau][n]}`);
    }
  }
  return { cibles: sortie, bornees };
}

// ------------------------------------------------------------------ écriture dans le contenu
const FICHIER_EQUILIBRE = new URL("../../modules/lakour-veillees/contenu/equilibre.mjs", import.meta.url);
export function ecrireEquilibre({ poids, cibles }) {
  let s = readFileSync(FICHIER_EQUILIBRE, "utf8");
  for (const [cle, p] of Object.entries(poids ?? {})) {
    const re = new RegExp(`(\\n  "${cle}": \\{ camp: "[a-z]+", poids: )(-?\\d+(?:\\.\\d+)?)`);
    if (!re.test(s)) throw new Error(`equilibre.mjs : rôle ${cle} introuvable`);
    s = s.replace(re, `$1${p}`);
  }
  const bloc = `// <cibles> (écrit par essais/outils/calibrer-poids.mjs)\nexport const CIBLES = {\n${Object.entries(cibles).map(([niveau, t]) =>
    `  "${niveau}": { ${Object.entries(t).map(([n, c]) => `${n}: ${c}`).join(", ")} }`).join(",\n")}\n};\n// </cibles>`;
  if (!/\/\/ <cibles>[\s\S]*\/\/ <\/cibles>/.test(s)) throw new Error("equilibre.mjs : bloc <cibles> introuvable");
  s = s.replace(/\/\/ <cibles>[\s\S]*\/\/ <\/cibles>/, bloc);
  writeFileSync(FICHIER_EQUILIBRE, s);
}

// ------------------------------------------------------------------ tableaux
const signe = x => `${x >= 0 ? "+" : ""}${x}`;
export function tableaux(c) {
  const l = [`Échelle : ${Math.round(c.u * 100) / 100} poids par unité de logit (un point de poids ≈ ${Math.round(100 / c.u / 4)} points de victoire du village autour de 50 %). Parties : ${c.parties} (${c.ajustees} gagnées par le village ou la meute).`, "",
    "### Poids des rôles", "", "| Rôle | Camp | Parties | Ancien | Mesuré (± 1 écart-type) | Retenu |", "|---|---|---|---|---|---|"];
  for (const [cle, x] of Object.entries(c.poids).sort((a, b) => b[1].brut - a[1].brut)) {
    l.push(`| ${cle} | ${x.camp} | ${x.parties} | ${signe(x.ancien)} | ${signe(Math.round(x.brut * 10) / 10)} ± ${Math.round(x.erreur * 10) / 10} | ${signe(x.nouveau)} |`);
  }
  l.push("", "### Bâtiments et variante (effet mesuré, en poids)", "", "| | Effet (± 1 écart-type) |", "|---|---|");
  for (const [cle, x] of Object.entries(c.batiments)) l.push(`| ${cle} | ${signe(Math.round(x.brut * 10) / 10)} ± ${Math.round(x.erreur * 10) / 10} |`);
  l.push("", "### Cibles par niveau et par taille (somme des poids pour une chance sur deux)", "", `| Niveau | ${TAILLES.join(" | ")} |`, `|---|${TAILLES.map(() => "---").join("|")}|`);
  for (const [niveau, t] of Object.entries(c.cibles)) l.push(`| ${niveau} | ${TAILLES.map(n => (t[n] ? `${signe(t[n].cible)} (${signe(Math.round(t[n].brute))}±${Math.round(t[n].erreur)})` : "—")).join(" | ")} |`);
  l.push("", "### Solitaires (dans l'échantillon)", "", "| Rôle | Parties | Il gagne |", "|---|---|---|");
  for (const [cle, x] of Object.entries(c.solitaires)) l.push(`| ${cle} | ${x.parties} | ${Math.round(100 * x.part)} % |`);
  return l.join("\n");
}

// ------------------------------------------------------------------ ligne de commande
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const o = { parties: 16000, graine: "cal", adresse: 1, fils: Math.max(1, Math.min(16, cpus().length - 1)), json: null, depuis: null, ecrire: false, lambda: 2,
    constante: "", valeurs: [], role: "", variante: "ordinaire" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--parties") o.parties = Number(argv[++i]);
    else if (a === "--graine") o.graine = String(argv[++i]);
    else if (a === "--adresse") o.adresse = Number(argv[++i]);
    else if (a === "--fils") o.fils = Number(argv[++i]);
    else if (a === "--json") o.json = argv[++i];
    else if (a === "--depuis") o.depuis = argv[++i];
    else if (a === "--ecrire") o.ecrire = true;
    else if (a === "--lambda") o.lambda = Number(argv[++i]);
    else if (a === "--constante") o.constante = argv[++i];
    else if (a === "--valeurs") o.valeurs = argv[++i].split(",").map(Number);
    else if (a === "--role") o.role = argv[++i];
    else if (a === "--variante") o.variante = argv[++i];
    else if (a === "--corriger") o.corriger = argv[++i];
    else if (a === "--echelle") o.echelle = Number(argv[++i]);
    else if (a === "--sans-interpoler") o.sansInterpoler = true;
  }
  if (o.corriger) {
    // Le second passage : les cibles du contenu, corrigées d'après une validation (--echelle : celle de la calibration).
    const { CIBLES } = await import("../../modules/lakour-veillees/contenu/equilibre.mjs");
    const resultats = o.corriger.split(",").flatMap(f => JSON.parse(readFileSync(f, "utf8")).resultats);
    const { cibles, bornees } = corrigerCibles(resultats, { u: o.echelle || 5.68, cibles: CIBLES, adresse: o.adresse, interpoler: !o.sansInterpoler });
    for (const b of bornees) console.log(`  bornée : ${b}`);
    for (const [niveau, t] of Object.entries(cibles)) console.log(`${niveau} : ${JSON.stringify(t)}\n   avant : ${JSON.stringify(CIBLES[niveau])}`);
    if (o.ecrire) { ecrireEquilibre({ poids: {}, cibles }); console.log("Cibles écrites dans modules/lakour-veillees/contenu/equilibre.mjs."); }
    process.exit(0);
  }
  if (o.constante) {
    const debut = performance.now();
    const taches = tachesDeConstante({ ...o, parties: o.parties === 16000 ? 300 : o.parties });
    // Les parties d'une paire (avec, sans) et des valeurs d'une même composition ont la même graine ; jouerTaches rend les résultats lot
    // par lot : on les remet dans l'ordre des tâches (étiquette).
    const resultats = await jouerTaches(taches, { graine: o.graine, fils: o.fils });
    const parK = new Map(resultats.map(r => [r.etiquette, r]));
    const b = bilanDeConstante(taches, taches.map((_, k) => parK.get(k)));
    console.log(`### ${o.constante}${o.role ? ` (${o.role}, avec et sans)` : ""}${o.variante !== "ordinaire" ? `, variante ${o.variante}` : ""}, adresse ${o.adresse}

| Valeur | | Parties | Village | Meute |
|---|---|---|---|---|`);
    for (const x of b) console.log(`| ${x.valeur} | ${o.role ? (x.avec ? "avec" : "sans") : ""} | ${x.parties} | ${Math.round(100 * x.part)} % | ${Math.round(100 * x.meute / Math.max(1, x.parties))} % |`);
    console.log(`
(${resultats.length} parties, ${Math.round((performance.now() - debut) / 1000)} s)`);
    if (o.json) writeFileSync(o.json, JSON.stringify({ options: o, bilan: b }, null, 1));
    process.exit(0);
  }
  const debut = performance.now();
  // Des parties déjà jouées (--depuis a.json,b.json : celles de cette adresse, compositions générées ou tirées), et d'autres à jouer.
  let resultats = (o.depuis ? o.depuis.split(",") : []).flatMap(f => JSON.parse(readFileSync(f, "utf8")).resultats.filter(r => Number(r.adresse) === o.adresse && !r.erreur));
  if (o.parties > 0) {
    const taches = echantillon(o.parties, { graine: o.graine, adresse: o.adresse });
    let dernier = 0;
    const joues = await jouerTaches(taches, { graine: o.graine, fils: o.fils, progres: (f, t) => { if (performance.now() - dernier > 30000) { dernier = performance.now(); process.stderr.write(`  ${f}/${t} parties (${Math.round((performance.now() - debut) / 1000)} s)\n`); } } });
    if (o.json) writeFileSync(o.json, JSON.stringify({ options: o, resultats: joues }, null, 1));
    resultats = [...resultats, ...joues];
  }
  const c = calibrer(resultats, { lambda: o.lambda });
  const nouveaux = Object.fromEntries(Object.entries(c.poids).map(([k, x]) => [k, x.nouveau]));
  const tablee = ciblesDeLaTablee(nouveaux);
  console.log(tableaux(c));
  console.log(`\nPetite tablée (cibles qui gardent ses compositions) : ${JSON.stringify(tablee)}`);
  const cibles = { ...Object.fromEntries(Object.entries(c.cibles).map(([niveau, t]) => [niveau, Object.fromEntries(Object.entries(t).map(([n, x]) => [n, x.cible]))])), "petite-tablee": tablee };
  if (o.ecrire) { ecrireEquilibre({ poids: nouveaux, cibles }); console.log("\nPoids et cibles écrits dans modules/lakour-veillees/contenu/equilibre.mjs (relancer npm run fabriquer-veillees et -en)."); }
  else console.log(`\nCibles proposées : ${JSON.stringify(cibles)}`);
  console.log(`\n(${resultats.length} parties, graine ${o.graine}, adresse ${o.adresse}, ${Math.round((performance.now() - debut) / 1000)} s)`);
}
