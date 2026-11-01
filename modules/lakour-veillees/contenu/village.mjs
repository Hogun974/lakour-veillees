// La carte du village de Brumecombe : 42 × 30 cases de 1,5 m, vue de dessus, de nuit.
// Plan (lu par le MJ IA pour placer les jetons) : un fond d'herbe, la place du village (pièce, ouverte sur tout son
// pourtour), et des ÉLÉMENTS nommés : « Maison 1 » à « Maison 18 » et les dix bâtiments (Chapelle, Moulin, Taverne,
// Gibet, Puits, Forge, Cimetière, Pont, Lavoir, Grange). Les maisons 13 à 18 et la Grange sont sur l'autre rive.
// La rivière, les chemins, les arbres et les toits sont du décor dessiné (decorVillage), pas des pièces : ils ne
// créent aucun mur, et la carte reste ouverte comme un plateau de jeu.
import { scene } from "./cartes.mjs";

export const CLE_VILLAGE = "village-de-brumecombe";
export const L = 42, H = 30;

// Place du village : x 13–24, y 10–19.
export const PLACE = { nom: "Place du village", x: 13, y: 10, l: 12, h: 10, sol: "pierre" };

// Maisons (2 × 2 cases), numérotées d'ouest en est et du nord au sud ; 13 à 18 sur l'autre rive.
export const MAISONS = [
  [7, 2], [13, 2], [6, 6], [10, 6], [5, 10], [1, 17], [5, 17], [9, 17], [2, 22], [7, 22], [12, 22], [22, 22],
  [34, 3], [39, 3], [34, 8], [39, 8], [34, 18], [39, 18]
].map(([x, y], i) => ({ nom: `Maison ${i + 1}`, x, y, l: 2, h: 2 }));

// Bâtiments : le nom de l'élément est le « repere » de l'objet batiment (contenu/batiments.mjs).
export const BATIMENTS_CARTE = [
  { nom: "Chapelle", x: 17, y: 2, l: 4, h: 5 },
  { nom: "Cimetière", x: 22, y: 2, l: 6, h: 5 },
  { nom: "Moulin", x: 2, y: 2, l: 3, h: 3 },
  { nom: "Taverne", x: 26, y: 10, l: 4, h: 3 },
  { nom: "Forge", x: 9, y: 10, l: 3, h: 3 },
  { nom: "Gibet", x: 14, y: 11, l: 2, h: 2 },
  { nom: "Puits", x: 18, y: 14, l: 2, h: 2 },
  { nom: "Pont", x: 31, y: 14, l: 3, h: 2 },
  { nom: "Lavoir", x: 27, y: 21, l: 3, h: 2 },
  { nom: "Grange", x: 35, y: 23, l: 5, h: 4 }
];

// Rangée d'ouvertures « passage » sur tout le pourtour intérieur d'une pièce posée sur le fond (aucun mur).
function pourtourOuvert(p) {
  const o = [];
  for (let x = p.x; x < p.x + p.l; x++) o.push({ x, y: p.y, cote: "nord", type: "passage" }, { x, y: p.y + p.h - 1, cote: "sud", type: "passage" });
  for (let y = p.y; y < p.y + p.h; y++) o.push({ x: p.x, y, cote: "ouest", type: "passage" }, { x: p.x + p.l - 1, y, cote: "est", type: "passage" });
  return o;
}

// Lumières : lanternes de la place, bâtiments éclairés, une lanterne devant chaque maison.
const LUMIERES = [
  { x: 13, y: 10, rayon: 3, couleur: "#ffcc77" }, { x: 24, y: 10, rayon: 3, couleur: "#ffcc77" },
  { x: 13, y: 19, rayon: 3, couleur: "#ffcc77" }, { x: 24, y: 19, rayon: 3, couleur: "#ffcc77" },
  { x: 19, y: 7, rayon: 3, couleur: "#d8c8ff" },   // porche de la chapelle
  { x: 28, y: 13, rayon: 3, couleur: "#ff9a40" },  // taverne
  { x: 10, y: 13, rayon: 3, couleur: "#ff6a20" },  // forge
  { x: 30, y: 13, rayon: 2, couleur: "#ffd28a" }, { x: 34, y: 16, rayon: 2, couleur: "#ffd28a" }, // pont
  { x: 28, y: 23, rayon: 2, couleur: "#cfe0ff" },  // lavoir
  { x: 4, y: 5, rayon: 2, couleur: "#ffcc88" },    // moulin
  { x: 37, y: 27, rayon: 2, couleur: "#ffb060" },  // grange
  ...MAISONS.map(m => ({ x: m.x + 1, y: m.y + 2, rayon: 1, couleur: "#ffb85a" }))
];

export const PLAN_VILLAGE = {
  largeur: L, hauteur: H, lumiere: "nuit",
  pieces: [{ nom: "Brumecombe", x: 0, y: 0, l: L, h: H, sol: "herbe" }, PLACE],
  ouvertures: pourtourOuvert(PLACE),
  lumieres: LUMIERES,
  elements: [...MAISONS, ...BATIMENTS_CARTE]
};

// ======================================================================= Décor dessiné

// Hasard déterministe : la même carte donne toujours la même image.
function hasard(graine) {
  let s = 0;
  for (const c of String(graine)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const r1 = n => Math.round(n * 10) / 10;
const POLICE = "Georgia, 'Times New Roman', serif";
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Chemins (en cases) : [points, largeur].
const CHEMINS = [
  [[[0, 15], [13, 15]], 1.6], [[[25, 15], [30.6, 15]], 1.6], [[[34.4, 15], [42, 15]], 1.6],      // grand-rue
  [[[19, 7], [19, 10]], 1.2], [[[19, 20], [19, 30]], 1.3],                                       // chapelle, route du sud
  [[[3.5, 5], [3.5, 15]], 0.9],                                                                  // chemin du moulin
  [[[3.5, 4.6], [17, 4.6]], 0.6], [[[3.5, 8.6], [19, 8.6]], 0.6],                                // ruelles du nord
  [[[0, 19.6], [13, 19.6]], 0.6], [[[0, 24.6], [29, 24.6]], 0.6], [[[29, 24.6], [29, 23]], 0.5], // ruelles du sud
  [[[37, 1.5], [37, 23]], 0.7], [[[6, 12], [6, 14.2]], 0.5], [[[10.5, 13], [10.5, 14.2]], 0.6],  // rive est, maisons, forge
  [[[28, 13], [28, 14.2]], 0.7], [[[23, 24], [23, 24.6]], 0.4]                                  // taverne, maison 12
];
// Champs labourés (en cases).
const CHAMPS = [{ x: 21, y: 26, l: 9.5, h: 3.6, sens: 0 }, { x: 0.3, y: 0.3, l: 1.5, h: 8.5, sens: 1 }, { x: 40.2, y: 10.4, l: 1.6, h: 3.3, sens: 1 }];
const CARTOUCHE = { x: 0.6, y: 26.2, l: 9.8, h: 3.2 };

// La Brume (rivière) : rive gauche et rive droite ondulées, en cases.
function rives() {
  const g = [], d = [];
  for (let y = -0.5; y <= H + 0.5; y += 1) {
    const o = Math.sin(y * 0.55) * 0.25 + Math.sin(y * 1.3) * 0.08;
    g.push([30.95 + o, y]);
    d.push([34.05 + o * 0.8, y]);
  }
  return { g, d };
}

// Distance d'un point à un segment.
function distSeg([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - u * dx, py - ay - u * dy);
}

// Cases à ne pas couvrir d'arbres : éléments, place, rivière, chemins, champs, cartouche, étiquettes.
function libre(x, y, marge, plan) {
  if (x < 0.3 || y < 0.3 || x > L - 0.3 || y > H - 0.3) return false;
  const dans = (r, m) => x > r.x - m && x < r.x + r.l + m && y > r.y - m && y < r.y + r.h + m;
  if (plan.elements.some(e => dans(e, marge + 0.15))) return false;
  if (dans(PLACE, marge + 0.2) || dans(CARTOUCHE, marge) || CHAMPS.some(c => dans(c, marge))) return false;
  if (x > 30.2 - marge && x < 34.9 + marge) return false;
  if (CHEMINS.some(([pts, l]) => pts.slice(1).some((p, i) => distSeg([x, y], pts[i], p) < l / 2 + marge + 0.1))) return false;
  // Étiquettes sous les bâtiments.
  if (BATIMENTS_CARTE.some(b => x > b.x - 0.6 && x < b.x + b.l + 0.6 && y > b.y + b.h && y < b.y + b.h + 0.9)) return false;
  return true;
}

// Toit à deux pans sur un rectangle (en pixels) : faîtage sur le grand côté, pan éclairé au nord ou à l'ouest.
function toit(x, y, l, h, mat, relief, { cheminee = true, faitage = null } = {}) {
  const horizontal = faitage ? faitage === "h" : l >= h;
  const [clair, sombre, trait] = mat;
  const lc = relief ? `url(#bc-${mat.id}-clair)` : clair, ls = relief ? `url(#bc-${mat.id}-sombre)` : sombre;
  let s = "";
  if (horizontal) {
    const m = y + h / 2;
    s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${r1(h / 2)}" fill="${lc}"/><rect x="${r1(x)}" y="${r1(m)}" width="${r1(l)}" height="${r1(h / 2)}" fill="${ls}"/>`;
    for (let i = 1; i < 4; i++) s += `<path d="M${r1(x)} ${r1(y + (h / 8) * i)}H${r1(x + l)}M${r1(x)} ${r1(m + (h / 8) * i)}H${r1(x + l)}" stroke="${trait}" stroke-width="2" opacity="0.45"/>`;
    s += `<path d="M${r1(x)} ${r1(m)}H${r1(x + l)}" stroke="${trait}" stroke-width="5"/>`;
    if (relief) s += `<path d="M${r1(x)} ${r1(m - 3)}H${r1(x + l)}" stroke="#fff" stroke-width="2" opacity="0.25"/>`;
  } else {
    const m = x + l / 2;
    s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l / 2)}" height="${r1(h)}" fill="${lc}"/><rect x="${r1(m)}" y="${r1(y)}" width="${r1(l / 2)}" height="${r1(h)}" fill="${ls}"/>`;
    for (let i = 1; i < 4; i++) s += `<path d="M${r1(x + (l / 8) * i)} ${r1(y)}V${r1(y + h)}M${r1(m + (l / 8) * i)} ${r1(y)}V${r1(y + h)}" stroke="${trait}" stroke-width="2" opacity="0.45"/>`;
    s += `<path d="M${r1(m)} ${r1(y)}V${r1(y + h)}" stroke="${trait}" stroke-width="5"/>`;
    if (relief) s += `<path d="M${r1(m - 3)} ${r1(y)}V${r1(y + h)}" stroke="#fff" stroke-width="2" opacity="0.25"/>`;
  }
  s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${r1(h)}" fill="none" stroke="#141010" stroke-width="4"/>`;
  if (cheminee) {
    const cx = horizontal ? x + l * 0.72 : x + l * 0.22, cy = horizontal ? y + h * 0.22 : y + h * 0.28;
    s += `<rect x="${r1(cx)}" y="${r1(cy)}" width="16" height="16" fill="#5a4c44" stroke="#1a1414" stroke-width="3"/><rect x="${r1(cx + 4)}" y="${r1(cy + 4)}" width="8" height="8" fill="#111"/>`;
  }
  return s;
}

// Matériaux de toit : [pan clair, pan sombre, trait], avec un id pour les dégradés du relief.
const MATERIAUX = {
  ardoise: Object.assign(["#5d6472", "#3c414c", "#22252c"], { id: "ardoise" }),
  tuile: Object.assign(["#9a5038", "#6e3424", "#3a1a12"], { id: "tuile" }),
  chaume: Object.assign(["#9c844c", "#6e5c32", "#3e3218"], { id: "chaume" }),
  bois: Object.assign(["#7a4a30", "#55311f", "#2e1a10"], { id: "bois" })
};
const MATERIAU_MAISON = ["chaume", "tuile", "ardoise", "chaume", "tuile", "chaume", "ardoise", "tuile", "chaume", "tuile", "ardoise", "chaume",
  "tuile", "chaume", "ardoise", "chaume", "tuile", "ardoise"];

function defsDecor(t, relief) {
  let d = `<filter id="bc-brume" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${t * 0.45}"/></filter>`
    + `<filter id="bc-ombre" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${t * 0.08}"/></filter>`
    + `<radialGradient id="bc-vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#05070d" stop-opacity="0"/><stop offset="1" stop-color="#05070d" stop-opacity="0.6"/></radialGradient>`
    + `<radialGradient id="bc-lune" cx="0.85" cy="0.08" r="0.5"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0.16"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="bc-eau" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#152a3c"/><stop offset="0.5" stop-color="#244a64"/><stop offset="1" stop-color="#152a3c"/></linearGradient>`
    + `<radialGradient id="bc-braise" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff0a0"/><stop offset="0.4" stop-color="#ff8a20"/><stop offset="1" stop-color="#7a1a00"/></radialGradient>`
    + `<radialGradient id="bc-arbre" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient>`;
  if (relief) {
    for (const m of Object.values(MATERIAUX)) {
      d += `<linearGradient id="bc-${m.id}-clair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset="1" stop-color="${m[1]}"/></linearGradient>`
        + `<linearGradient id="bc-${m.id}-sombre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>`;
    }
  }
  return `<defs>${d}</defs>`;
}

// Ombre portée (relief) d'un rectangle ou d'un cercle, vers le bas-droite.
const ombreRect = (x, y, l, h, t) => `<rect x="${r1(x + t * 0.18)}" y="${r1(y + t * 0.22)}" width="${r1(l)}" height="${r1(h)}" fill="#000" opacity="0.5" filter="url(#bc-ombre)"/>`;
const ombreRond = (cx, cy, r, t) => `<circle cx="${r1(cx + t * 0.16)}" cy="${r1(cy + t * 0.2)}" r="${r1(r)}" fill="#000" opacity="0.45" filter="url(#bc-ombre)"/>`;

function sol(t, plan) {
  let s = "";
  // Champs labourés.
  for (const c of CHAMPS) {
    const x = c.x * t, y = c.y * t, l = c.l * t, h = c.h * t;
    s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${r1(h)}" fill="#4a4128" stroke="#2c2616" stroke-width="4" rx="6"/>`;
    const n = Math.floor((c.sens ? l : h) / 22);
    for (let i = 1; i < n; i++) {
      s += c.sens
        ? `<path d="M${r1(x + i * 22)} ${r1(y + 6)}V${r1(y + h - 6)}" stroke="#36301c" stroke-width="5" opacity="0.8"/>`
        : `<path d="M${r1(x + 6)} ${r1(y + i * 22)}H${r1(x + l - 6)}" stroke="#36301c" stroke-width="5" opacity="0.8"/>`;
    }
  }
  // Chemins : bordure sombre, terre battue, cailloux.
  const h = hasard("chemins");
  const trace = pts => `M${pts.map(([x, y]) => `${r1(x * t)} ${r1(y * t)}`).join("L")}`;
  s += CHEMINS.map(([pts, l]) => `<path d="${trace(pts)}" fill="none" stroke="#2e2618" stroke-width="${r1(l * t + 12)}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  s += CHEMINS.map(([pts, l]) => `<path d="${trace(pts)}" fill="none" stroke="#5e4b30" stroke-width="${r1(l * t)}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  s += CHEMINS.map(([pts, l]) => `<path d="${trace(pts)}" fill="none" stroke="#6e593a" stroke-width="${r1(l * t * 0.45)}" stroke-linecap="round" stroke-dasharray="${r1(t * 0.3)} ${r1(t * 0.45)}" opacity="0.6"/>`).join("");
  for (const [pts, l] of CHEMINS) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k < n; k++) {
        const u = h(), off = (h() - 0.5) * l * 0.8;
        const nx = by - ay, ny = ax - bx, nn = Math.hypot(nx, ny) || 1;
        s += `<circle cx="${r1((ax + (bx - ax) * u + (nx / nn) * off) * t)}" cy="${r1((ay + (by - ay) * u + (ny / nn) * off) * t)}" r="${r1(2 + h() * 3)}" fill="#3e3222" opacity="0.7"/>`;
      }
    }
  }
  // La Brume : lit, rives boueuses, reflets, roseaux.
  const { g, d } = rives();
  const lit = `M${g.map(([x, y]) => `${r1(x * t)} ${r1(y * t)}`).join("L")}L${[...d].reverse().map(([x, y]) => `${r1(x * t)} ${r1(y * t)}`).join("L")}Z`;
  s += `<path d="${lit}" fill="#2a2418" stroke="#2a2418" stroke-width="${r1(t * 0.35)}" stroke-linejoin="round"/>`;
  s += `<path d="${lit}" fill="url(#bc-eau)"/>`;
  const hr = hasard("riviere");
  for (let y = 0.4; y < H; y += 0.55) {
    const x = 31.4 + hr() * 1.9 + Math.sin(y * 0.55) * 0.25;
    s += `<path d="M${r1(x * t)} ${r1(y * t)}q${r1(t * 0.15)} -6 ${r1(t * 0.3)} 0" fill="none" stroke="#7fb0d0" stroke-width="2.5" opacity="${r1(0.25 + hr() * 0.3)}"/>`;
  }
  for (const [rive, sens] of [[g, -1], [d, 1]]) {
    for (const [x, y] of rive) {
      if (y > 13.2 && y < 16.8) continue; // sous le pont
      for (let k = 0; k < 3; k++) {
        const bx = (x + sens * (0.05 + hr() * 0.15)) * t, by = (y + hr()) * t;
        s += `<path d="M${r1(bx)} ${r1(by)}l${r1(sens * (4 + hr() * 8))} ${r1(-14 - hr() * 12)}" stroke="#4a5a2a" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
  }
  // Canal du lavoir vers la rivière.
  s += `<path d="M${29.8 * t} ${22.4 * t}H${31.1 * t}" stroke="#2a2418" stroke-width="26"/><path d="M${29.8 * t} ${22.4 * t}H${31.1 * t}" stroke="#244a64" stroke-width="16"/>`;
  return s;
}

function arbres(t, plan, relief) {
  const h = hasard("arbres");
  const couleurs = ["#2f4228", "#3a4a26", "#5e5220", "#6e3c1a", "#4a3a22", "#7a5a1e", "#2a3a2a"];
  const poses = [];
  for (let y = 0.6; y < H; y += 1.05) {
    for (let x = 0.6; x < L; x += 1.05) {
      const px = x + (h() - 0.5) * 0.7, py = y + (h() - 0.5) * 0.7;
      const bord = Math.min(px, py, L - px, H - py);
      const p = bord < 2.5 ? 0.8 : bord < 4 ? 0.4 : 0.1;
      const rayon = 0.32 + h() * 0.28;
      if (h() > p || !libre(px, py, rayon, plan)) continue;
      if (poses.some(([qx, qy, qr]) => Math.hypot(qx - px, qy - py) < (qr + rayon) * 0.75)) continue;
      poses.push([px, py, rayon, couleurs[Math.floor(h() * couleurs.length)], h() < 0.12]);
    }
  }
  let ombres = "", feuillages = "";
  for (const [x, y, rayon, couleur, nu] of poses) {
    const cx = x * t, cy = y * t, r = rayon * t;
    if (relief) ombres += ombreRond(cx, cy, r, t);
    if (nu) {
      // Arbre dénudé : branches en étoile.
      feuillages += `<g stroke="#3a2c20" stroke-width="5" stroke-linecap="round">${[0, 1, 2, 3, 4, 5].map(i => {
        const a = i * 1.05 + rayon * 7;
        return `<path d="M${r1(cx)} ${r1(cy)}L${r1(cx + Math.cos(a) * r)} ${r1(cy + Math.sin(a) * r)}"/>`;
      }).join("")}</g><circle cx="${r1(cx)}" cy="${r1(cy)}" r="7" fill="#3a2c20"/>`;
      continue;
    }
    feuillages += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${couleur}" stroke="#141a10" stroke-width="3"/>`;
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + rayon * 5, d = r * 0.45;
      feuillages += `<circle cx="${r1(cx + Math.cos(a) * d)}" cy="${r1(cy + Math.sin(a) * d)}" r="${r1(r * 0.45)}" fill="${couleur}" stroke="#000" stroke-opacity="0.25" stroke-width="2"/>`;
    }
    if (relief) feuillages += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="url(#bc-arbre)"/>`;
  }
  return ombres + feuillages;
}

// Bâtiments et maisons, d'après leur nom.
function batiments(t, plan, relief) {
  let s = "";
  const P = e => ({ x: e.x * t, y: e.y * t, l: e.l * t, h: e.h * t });
  const par = nom => plan.elements.find(e => e.nom === nom);

  // Le rendu commun dessine chaque élément en caisses : on les recouvre du sol de la pièce (mêmes motifs, alignés sur
  // l'origine), sauf le Puits, que le rendu commun dessine déjà en puits, et le Pont, que son tablier recouvre.
  for (const e of plan.elements.filter(x => !["Puits", "Pont"].includes(x.nom))) {
    const surPlace = e.x >= PLACE.x && e.y >= PLACE.y && e.x + e.l <= PLACE.x + PLACE.l && e.y + e.h <= PLACE.y + PLACE.h;
    s += `<rect x="${e.x * t - 2}" y="${e.y * t - 2}" width="${e.l * t + 4}" height="${e.h * t + 4}" fill="url(#sol-${surPlace ? "pierre" : "herbe"})"/>`;
  }

  // Maisons : toit, numéro sur une plaque.
  plan.elements.filter(e => /^Maison \d+$/.test(e.nom)).forEach(e => {
    const n = Number(e.nom.split(" ")[1]);
    const { x, y, l, h } = P(e), m = t * 0.08;
    const mat = MATERIAUX[MATERIAU_MAISON[(n - 1) % MATERIAU_MAISON.length]];
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += toit(x + m, y + m, l - 2 * m, h - 2 * m, mat, relief, { faitage: n % 3 === 0 ? "v" : "h" });
    s += `<circle cx="${r1(x + l / 2)}" cy="${r1(y + h / 2)}" r="${r1(t * 0.33)}" fill="#ece2c6" stroke="#2a2016" stroke-width="4"/>`
      + `<text x="${r1(x + l / 2)}" y="${r1(y + h / 2 + 13)}" text-anchor="middle" font-family="${POLICE}" font-size="38" font-weight="bold" fill="#2a2016">${n}</text>`;
  });

  // Chapelle : nef d'ardoise, abside, clocher carré à toit pyramidal, croix.
  {
    const { x, y, l, h } = P(par("Chapelle")), m = t * 0.1;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += `<path d="M${r1(x + l * 0.2)} ${r1(y + m + 30)}A${r1(l * 0.3)} ${r1(l * 0.3)} 0 0 1 ${r1(x + l * 0.8)} ${r1(y + m + 30)}Z" fill="#3c414c" stroke="#141010" stroke-width="4"/>`;
    s += toit(x + l * 0.14, y + m + 28, l * 0.72, h * 0.62, MATERIAUX.ardoise, relief, { cheminee: false, faitage: "v" });
    const cx = x + l / 2, ty = y + h * 0.66, c = t * 0.95;
    s += `<rect x="${r1(cx - c / 2)}" y="${r1(ty)}" width="${r1(c)}" height="${r1(c)}" fill="#6a6258" stroke="#141010" stroke-width="4"/>`;
    s += [[0, 0, c, 0], [c, 0, c, c], [c, c, 0, c], [0, c, 0, 0]].map(([ax, ay, bx, by], i) =>
      `<path d="M${r1(cx - c / 2 + ax)} ${r1(ty + ay)}L${r1(cx - c / 2 + bx)} ${r1(ty + by)}L${r1(cx)} ${r1(ty + c / 2)}Z" fill="${["#5d6472", "#3c414c", "#2c3038", "#4a505c"][i]}" stroke="#141010" stroke-width="2"/>`).join("");
    s += `<path d="M${r1(cx)} ${r1(ty + c / 2 - 26)}V${r1(ty + c / 2 + 26)}M${r1(cx - 16)} ${r1(ty + c / 2 - 8)}H${r1(cx + 16)}" stroke="#d8c890" stroke-width="7" stroke-linecap="round"/>`;
  }

  // Cimetière : muret, herbe sombre, tombes, croix, un if.
  {
    const e = par("Cimetière"), { x, y, l, h } = P(e), m = t * 0.12;
    s += `<rect x="${r1(x + m)}" y="${r1(y + m)}" width="${r1(l - 2 * m)}" height="${r1(h - 2 * m)}" fill="#2c3826" stroke="#77736a" stroke-width="10"/>`;
    s += `<rect x="${r1(x + l * 0.42)}" y="${r1(y + h - m - 8)}" width="${r1(l * 0.16)}" height="16" fill="#2c3826"/>`; // grille
    s += `<path d="M${r1(x + l * 0.42)} ${r1(y + h - m)}H${r1(x + l * 0.58)}" stroke="#1a1a1a" stroke-width="4" stroke-dasharray="6 6"/>`;
    const hc = hasard("tombes");
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const tx = x + m + 26 + col * ((l - 2 * m - 52) / 6), ty = y + m + 40 + row * ((h - 2 * m - 80) / 2);
        if (col === 6 && row === 0) continue; // place de l'if
        const pench = (hc() - 0.5) * 16;
        if (relief) s += `<rect x="${r1(tx - 9 + 8)}" y="${r1(ty - 13 + 10)}" width="18" height="26" rx="7" fill="#000" opacity="0.45"/>`;
        s += hc() < 0.35
          ? `<path d="M${r1(tx)} ${r1(ty - 16)}V${r1(ty + 16)}M${r1(tx - 10)} ${r1(ty - 6)}H${r1(tx + 10)}" stroke="#8d8a80" stroke-width="6" stroke-linecap="round" transform="rotate(${r1(pench)} ${r1(tx)} ${r1(ty)})"/>`
          : `<rect x="${r1(tx - 9)}" y="${r1(ty - 13)}" width="18" height="26" rx="7" fill="#8d8a80" stroke="#2a2824" stroke-width="3" transform="rotate(${r1(pench)} ${r1(tx)} ${r1(ty)})"/>`;
      }
    }
    const ix = x + l - m - 42, iy = y + m + 42;
    if (relief) s += ombreRond(ix, iy, 36, t);
    s += `<circle cx="${r1(ix)}" cy="${r1(iy)}" r="36" fill="#1c2a1c" stroke="#0c120c" stroke-width="3"/><circle cx="${r1(ix - 10)}" cy="${r1(iy - 8)}" r="18" fill="#26382a"/>`;
  }

  // Moulin : tour ronde, toit conique, quatre ailes.
  {
    const { x, y, l, h } = P(par("Moulin")), cx = x + l / 2, cy = y + h / 2, R = t * 0.95;
    if (relief) s += ombreRond(cx, cy, R, t);
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R)}" fill="#6a6258" stroke="#141010" stroke-width="5"/>`;
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R * 0.82)}" fill="${relief ? "url(#bc-chaume-clair)" : "#8a7444"}"/>`;
    for (let i = 0; i < 12; i++) s += `<path d="M${r1(cx)} ${r1(cy)}L${r1(cx + Math.cos(i * 0.52) * R * 0.82)} ${r1(cy + Math.sin(i * 0.52) * R * 0.82)}" stroke="#4a3c22" stroke-width="2.5"/>`;
    for (let i = 0; i < 4; i++) {
      const a = 20 + i * 90;
      s += `<g transform="rotate(${a} ${r1(cx)} ${r1(cy)})">${relief ? `<rect x="${r1(cx + 14)}" y="${r1(cy - 10)}" width="${r1(t * 1.4)}" height="${r1(t * 0.3)}" fill="#000" opacity="0.4" transform="translate(10 14)"/>` : ""}`
        + `<rect x="${r1(cx + 14)}" y="${r1(cy - 14)}" width="${r1(t * 1.4)}" height="${r1(t * 0.3)}" fill="#c9b893" stroke="#3a2c1c" stroke-width="3"/>`
        + [0.3, 0.55, 0.8, 1.05, 1.3].map(f => `<path d="M${r1(cx + 14 + t * f)} ${r1(cy - 14)}v${r1(t * 0.3)}" stroke="#3a2c1c" stroke-width="2"/>`).join("")
        + `<path d="M${r1(cx)} ${r1(cy)}H${r1(cx + t * 1.45)}" stroke="#3a2c1c" stroke-width="5"/></g>`;
    }
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="12" fill="#2a2016"/>`;
  }

  // Taverne : grand toit de tuiles, cheminée qui fume, enseigne, tonneaux.
  {
    const { x, y, l, h } = P(par("Taverne")), m = t * 0.08;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += toit(x + m, y + m, l - 2 * m, h * 0.8, MATERIAUX.tuile, relief);
    s += `<rect x="${r1(x + m)}" y="${r1(y + h * 0.8 + m)}" width="${r1(l - 2 * m)}" height="${r1(h * 0.2 - 2 * m)}" fill="#4a3424" stroke="#141010" stroke-width="3"/>`;
    for (let i = 0; i < 4; i++) s += `<circle cx="${r1(x + m + 30 + i * 34)}" cy="${r1(y + h * 0.9)}" r="13" fill="#6a4a2a" stroke="#2a1a10" stroke-width="3"/><circle cx="${r1(x + m + 30 + i * 34)}" cy="${r1(y + h * 0.9)}" r="5" fill="#3a2614"/>`;
    s += `<rect x="${r1(x + l - 110)}" y="${r1(y + h * 0.82)}" width="70" height="40" rx="4" fill="#3a2614" stroke="#c9a24a" stroke-width="3"/>`
      + `<path d="M${r1(x + l - 92)} ${r1(y + h * 0.82 + 12)}h22v16h-22z" fill="#c9a24a"/>`;
  }

  // Forge : toit d'ardoise sombre, appentis ouvert avec foyer rougeoyant et enclume.
  {
    const { x, y, l, h } = P(par("Forge")), m = t * 0.08;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += toit(x + m, y + m, l - 2 * m, h * 0.58, MATERIAUX.ardoise, relief);
    s += `<rect x="${r1(x + m)}" y="${r1(y + h * 0.58 + m)}" width="${r1(l - 2 * m)}" height="${r1(h * 0.42 - 2 * m)}" fill="#3a3430" stroke="#141010" stroke-width="4"/>`;
    s += `<circle cx="${r1(x + l * 0.3)}" cy="${r1(y + h * 0.78)}" r="${r1(t * 0.3)}" fill="#2a2420" stroke="#141010" stroke-width="3"/><circle cx="${r1(x + l * 0.3)}" cy="${r1(y + h * 0.78)}" r="${r1(t * 0.22)}" fill="url(#bc-braise)"/>`;
    s += `<path d="M${r1(x + l * 0.58)} ${r1(y + h * 0.72)}h60l-10 14h-14v12h22v10h-56v-10h22v-12h-14z" fill="#5a5c62" stroke="#141010" stroke-width="3"/>`;
  }

  // Gibet : estrade de planches, poteau, potence, corde.
  {
    const { x, y, l, h } = P(par("Gibet")), m = t * 0.12;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += `<rect x="${r1(x + m)}" y="${r1(y + m)}" width="${r1(l - 2 * m)}" height="${r1(h - 2 * m)}" fill="#5a4330" stroke="#1a120a" stroke-width="5"/>`;
    for (let i = 1; i < 6; i++) s += `<path d="M${r1(x + m)} ${r1(y + m + i * (h - 2 * m) / 6)}H${r1(x + l - m)}" stroke="#2e2014" stroke-width="2.5"/>`;
    s += `<rect x="${r1(x + m + 14)}" y="${r1(y + m + 14)}" width="22" height="22" fill="#2a1c10"/>`
      + `<path d="M${r1(x + m + 25)} ${r1(y + m + 25)}H${r1(x + l * 0.62)}" stroke="#2a1c10" stroke-width="14" stroke-linecap="square"/>`
      + `<path d="M${r1(x + l * 0.62)} ${r1(y + m + 25)}V${r1(y + h * 0.48)}" stroke="#a89060" stroke-width="3"/>`
      + `<circle cx="${r1(x + l * 0.62)}" cy="${r1(y + h * 0.52)}" r="11" fill="none" stroke="#a89060" stroke-width="4"/>`
      + `<rect x="${r1(x + l * 0.55)}" y="${r1(y + h * 0.66)}" width="${r1(l * 0.16)}" height="${r1(h * 0.14)}" fill="#141010"/>`; // trappe
  }

  // Puits (dessiné par le rendu commun) : on ajoute la traverse et le seau.
  {
    const { x, y, l, h } = P(par("Puits")), cy = y + h / 2;
    s += `<path d="M${r1(x + 22)} ${r1(cy)}H${r1(x + l - 22)}" stroke="#5a3e24" stroke-width="12" stroke-linecap="round"/>`
      + `<circle cx="${r1(x + 22)}" cy="${r1(cy)}" r="10" fill="#3a2614"/><circle cx="${r1(x + l - 22)}" cy="${r1(cy)}" r="10" fill="#3a2614"/>`
      + `<rect x="${r1(x + l / 2 - 12)}" y="${r1(cy + 10)}" width="24" height="20" rx="3" fill="#6a4a2a" stroke="#2a1a10" stroke-width="3"/>`;
  }

  // Pont : tablier de pierre, parapets, bornes.
  {
    const e = par("Pont"), x = (e.x - 0.4) * t, y = (e.y + 0.12) * t, l = (e.l + 0.8) * t, h = (e.h - 0.24) * t;
    if (relief) s += ombreRect(x, y, l, h, t);
    s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${r1(h)}" fill="#6a6258" stroke="#141010" stroke-width="4"/>`;
    for (let i = 1; i < 10; i++) s += `<path d="M${r1(x + (i * l) / 10)} ${r1(y + 14)}V${r1(y + h - 14)}" stroke="#4e4740" stroke-width="2"/>`;
    for (const py of [y + 7, y + h - 7]) s += `<path d="M${r1(x)} ${r1(py)}H${r1(x + l)}" stroke="#4a443e" stroke-width="16"/><path d="M${r1(x)} ${r1(py - 3)}H${r1(x + l)}" stroke="#8a8278" stroke-width="4"/>`;
    for (const [bx, by] of [[x, y + 7], [x + l, y + 7], [x, y + h - 7], [x + l, y + h - 7]]) s += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="14" fill="#7a7268" stroke="#141010" stroke-width="3"/>`;
  }

  // Lavoir : bassin de pierre et appentis.
  {
    const { x, y, l, h } = P(par("Lavoir")), m = t * 0.08;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += `<rect x="${r1(x + m)}" y="${r1(y + h * 0.42)}" width="${r1(l - 2 * m)}" height="${r1(h * 0.58 - m)}" fill="#7a7268" stroke="#141010" stroke-width="4"/>`
      + `<rect x="${r1(x + m + 14)}" y="${r1(y + h * 0.42 + 14)}" width="${r1(l - 2 * m - 28)}" height="${r1(h * 0.58 - m - 28)}" fill="#244a64"/>`
      + `<path d="M${r1(x + m + 30)} ${r1(y + h * 0.72)}q20 -6 40 0t40 0t40 0" fill="none" stroke="#7fb0d0" stroke-width="2.5" opacity="0.6"/>`;
    s += toit(x + m, y + m, l - 2 * m, h * 0.42, MATERIAUX.tuile, relief, { cheminee: false });
  }

  // Grange : grand toit de planches, porte charretière ; meules de foin à côté.
  {
    const { x, y, l, h } = P(par("Grange")), m = t * 0.08;
    if (relief) s += ombreRect(x + m, y + m, l - 2 * m, h - 2 * m, t);
    s += toit(x + m, y + m, l - 2 * m, h - 2 * m, MATERIAUX.bois, relief, { cheminee: false });
    s += `<rect x="${r1(x + l / 2 - 50)}" y="${r1(y + h - m - 10)}" width="100" height="10" fill="#2a1a10"/>`;
    for (const [fx, fy] of [[40.6, 24.2], [40.7, 25.6]]) {
      if (relief) s += ombreRond(fx * t, fy * t, 34, t);
      s += `<circle cx="${r1(fx * t)}" cy="${r1(fy * t)}" r="34" fill="#a08a4a" stroke="#4a3c1c" stroke-width="3"/><circle cx="${r1(fx * t)}" cy="${r1(fy * t)}" r="16" fill="none" stroke="#6e5c2a" stroke-width="3"/>`;
    }
  }
  return s;
}

// Nuit : teinte bleue, lune, vignette ; puis lueurs des lumières par-dessus.
function nuit(t, plan, relief) {
  let s = `<rect width="${L * t}" height="${H * t}" fill="#0a1630" opacity="${relief ? 0.26 : 0.3}"/>`
    + `<rect width="${L * t}" height="${H * t}" fill="url(#bc-lune)"/>`;
  s += plan.lumieres.map((l, i) => {
    const id = `bc-lueur${i}`, cx = (l.x + 0.5) * t, cy = (l.y + 0.5) * t, r = l.rayon * t * 0.9;
    return `<radialGradient id="${id}"><stop offset="0" stop-color="${l.couleur}" stop-opacity="0.38"/><stop offset="1" stop-color="${l.couleur}" stop-opacity="0"/></radialGradient>`
      + `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="url(#${id})"/>`
      + `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${l.rayon > 1 ? 9 : 6}" fill="#fff4cc" opacity="0.9"/>`;
  }).join("");
  // Brume : longues nappes floues le long de la rivière et dans les creux.
  const h = hasard("brume");
  const nappes = [[32.5, 4, 3, 2.2], [32.5, 22, 3.2, 3], [6, 27, 6, 1.6], [38, 13, 3, 1.4], [2, 13, 3, 1.5], [26, 28, 6, 1.2], [12, 1, 5, 1.2]];
  s += `<g filter="url(#bc-brume)">${nappes.map(([x, y, rx, ry]) => `<ellipse cx="${r1(x * t)}" cy="${r1(y * t)}" rx="${r1(rx * t)}" ry="${r1(ry * t)}" fill="#dfe6f0" opacity="${r1(0.1 + h() * 0.08)}"/>`).join("")}</g>`;
  s += `<rect width="${L * t}" height="${H * t}" fill="url(#bc-vignette)"/>`;
  return s;
}

// Étiquettes : bâtiments (bandeau), place, rivière, cartouche du titre.
function etiquettes(t, plan) {
  const bandeau = (texte, cx, cy) => {
    const largeur = texte.length * 19 + 34;
    return `<rect x="${r1(cx - largeur / 2)}" y="${r1(cy - 22)}" width="${r1(largeur)}" height="44" rx="8" fill="#ece2c6" fill-opacity="0.92" stroke="#3a2e1e" stroke-width="3"/>`
      + `<text x="${r1(cx)}" y="${r1(cy + 10)}" text-anchor="middle" font-family="${POLICE}" font-size="30" fill="#2a2016">${esc(texte)}</text>`;
  };
  let s = "";
  for (const b of BATIMENTS_CARTE) {
    const dessous = { Pont: [0, 1.0], Puits: [0, 0.55], Gibet: [0, 0.55] }[b.nom] ?? [0, 0.45];
    s += bandeau(b.nom, (b.x + b.l / 2 + dessous[0]) * t, (b.y + b.h + dessous[1]) * t);
  }
  s += `<text x="${19 * t}" y="${r1(19.55 * t)}" text-anchor="middle" font-family="${POLICE}" font-size="44" font-style="italic" fill="#ece2c6" opacity="0.6">Place du village</text>`;
  s += `<text transform="translate(${r1(32.7 * t)} ${r1(7 * t)}) rotate(90)" text-anchor="middle" font-family="${POLICE}" font-size="46" font-style="italic" fill="#bcd6ea" opacity="0.65" letter-spacing="8">la Brume</text>`;
  s += `<text transform="translate(${r1(32.7 * t)} ${r1(25 * t)}) rotate(90)" text-anchor="middle" font-family="${POLICE}" font-size="30" font-style="italic" fill="#bcd6ea" opacity="0.5">vers les marais</text>`;
  const c = CARTOUCHE, x = c.x * t, y = c.y * t, l = c.l * t, h = c.h * t;
  s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(l)}" height="${r1(h)}" rx="14" fill="#1a1612" fill-opacity="0.85" stroke="#b89a5a" stroke-width="5"/>`
    + `<rect x="${r1(x + 14)}" y="${r1(y + 14)}" width="${r1(l - 28)}" height="${r1(h - 28)}" rx="8" fill="none" stroke="#b89a5a" stroke-width="2" opacity="0.7"/>`
    + `<text x="${r1(x + l / 2)}" y="${r1(y + h * 0.5)}" text-anchor="middle" font-family="${POLICE}" font-size="96" fill="#ece2c6" letter-spacing="6">Brumecombe</text>`
    + `<text x="${r1(x + l / 2)}" y="${r1(y + h * 0.78)}" text-anchor="middle" font-family="${POLICE}" font-size="34" font-style="italic" fill="#c9b890">les Veillées — une maison par joueur</text>`;
  // Rose des vents.
  const rx = 39.6 * t, ry = 28 * t;
  s += `<g opacity="0.75"><circle cx="${r1(rx)}" cy="${r1(ry)}" r="70" fill="#1a1612" fill-opacity="0.6" stroke="#b89a5a" stroke-width="3"/>`
    + `<path d="M${r1(rx)} ${r1(ry - 62)}L${r1(rx + 14)} ${r1(ry)}L${r1(rx)} ${r1(ry + 62)}L${r1(rx - 14)} ${r1(ry)}Z" fill="#ece2c6"/>`
    + `<path d="M${r1(rx - 62)} ${r1(ry)}L${r1(rx)} ${r1(ry - 14)}L${r1(rx + 62)} ${r1(ry)}L${r1(rx)} ${r1(ry + 14)}Z" fill="#b89a5a"/>`
    + `<text x="${r1(rx)}" y="${r1(ry - 74)}" text-anchor="middle" font-family="${POLICE}" font-size="30" fill="#ece2c6">N</text></g>`;
  return s;
}

export function decorVillage(plan, { t, style }) {
  const relief = style === "3d";
  return `<g id="decor-brumecombe">${defsDecor(t, relief)}${sol(t, plan)}${arbres(t, plan, relief)}${batiments(t, plan, relief)}${nuit(t, plan, relief)}${etiquettes(t, plan)}</g>`;
}

export const CARTES = [
  scene({
    cle: CLE_VILLAGE, nom: "Brumecombe — le village", plan: PLAN_VILLAGE, decor: decorVillage, visionDesJetons: false, obscurite: 0.55,
    description: "Le village de Brumecombe, de nuit : dix-huit maisons (« Maison 1 » à « Maison 18 » ; 13 à 18 sur l'autre rive de la Brume), la place du village où l'on débat et vote, et les dix bâtiments (Chapelle, Cimetière, Moulin, Taverne, Forge, Gibet, Puits, Pont, Lavoir, Grange). Chaque joueur a son jeton devant sa maison ; le jour, on se rassemble sur la place autour du Puits, et l'accusé se tient devant le Gibet."
  })
];
