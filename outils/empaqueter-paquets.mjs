// Empaquette le système et le module de contenu pour une publication (GitHub Releases, installation dans Foundry VTT) :
//   dist/system.json       manifeste du système, « manifest » et « download » pointés sur la publication
//   dist/lakour-loups.zip  systems/lakour-loups/ entier (system.json à la racine de l'archive)
//   dist/module.json       manifeste du module de contenu, même traitement
//   dist/lakour-veillees.zip  modules/lakour-veillees/ sans src/, contenu/ ni essais/ (packs/ compilés exigés)
//   dist/lakour-veillees-en.json + dist/lakour-veillees-en.zip  le module anglais engendré par `npm run fabriquer-veillees-en`
//                          (modules/lakour-veillees-en/, non versionné) : manifeste publié sous son propre nom (Foundry lit un
//                          manifeste sous n'importe quel nom ; « module.json » reste celui du module français). Facultatif :
//                          s'il n'a pas été fabriqué, il est passé avec un avertissement (le workflow, lui, exige l'archive).
// Les archives sont écrites sans dépendance (zip « deflate » maison, node:zlib). Le monde est empaqueté à part
// (npm run empaqueter-monde, s'il existe) ; le workflow .github/workflows/release.yml appelle les deux.
// Usage : node outils/empaqueter-paquets.mjs [--tag v0.11.1] [--depot Hogun974/lakour-veillees] [--sortie dist]
//   --tag    : nom de l'étiquette (par défaut : $GITHUB_REF_NAME, sinon « v<version du système> ») ;
//              « download » vise releases/download/<tag>/<zip>, « manifest » reste sur releases/latest/download/.
//   --depot  : dépôt GitHub (par défaut : $GITHUB_REPOSITORY, sinon Hogun974/lakour-veillees).
//   --sortie : dossier de sortie (vidé des fichiers produits ici, jamais des autres).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEPOT_PAR_DEFAUT = "Hogun974/lakour-veillees";

// manifeste : fichier lu dans le dossier du paquet ; publie (par défaut le même nom) : nom du manifeste écrit dans la sortie et
// visé par « manifest » ; facultatif : paquet passé (avec avertissement) si son dossier n'a pas été engendré.
export const PAQUETS = [
  { id: "lakour-loups", type: "system", dossier: "systems/lakour-loups", manifeste: "system.json", zip: "lakour-loups.zip", exclure: [] },
  { id: "lakour-veillees", type: "module", dossier: "modules/lakour-veillees", manifeste: "module.json", zip: "lakour-veillees.zip",
    exclure: ["src", "contenu", "essais"], exiger: ["packs"] },
  { id: "lakour-veillees-en", type: "module", dossier: "modules/lakour-veillees-en", manifeste: "module.json", publie: "lakour-veillees-en.json",
    zip: "lakour-veillees-en.zip", exclure: ["src", "contenu", "essais"], exiger: ["packs"], facultatif: true,
    fabrication: "npm run fabriquer-veillees-en" }
];

// ---------------------------------------------------------------- Arguments

export function lireArguments(argv = process.argv.slice(2), env = process.env) {
  const options = { tag: env.GITHUB_REF_NAME || "", depot: env.GITHUB_REPOSITORY || DEPOT_PAR_DEFAUT, sortie: "dist" };
  for (let i = 0; i < argv.length; i++) {
    const [cle, valeur] = argv[i].startsWith("--") && argv[i].includes("=") ? argv[i].slice(2).split(/=(.*)/s) : [argv[i].replace(/^--/, ""), argv[++i]];
    if (!(cle in options)) throw new Error(`Option inconnue : --${cle} (attendu : --tag, --depot, --sortie)`);
    if (valeur === undefined) throw new Error(`Option --${cle} sans valeur`);
    options[cle] = valeur;
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.depot)) throw new Error(`Dépôt GitHub invalide : « ${options.depot} » (attendu : proprietaire/depot)`);
  return options;
}

// ---------------------------------------------------------------- Manifeste publié

export function urlsDePublication(depot, tag, manifeste, zip) {
  const base = `https://github.com/${depot}/releases`;
  return { manifest: `${base}/latest/download/${manifeste}`, download: `${base}/download/${encodeURIComponent(tag)}/${zip}` };
}

// Le manifeste tel qu'il est publié : version inchangée, « manifest » et « download » pointés sur la publication.
export function manifestePublie(source, { depot, tag, manifeste, zip }) {
  if (!source.id || !source.version) throw new Error(`Manifeste ${manifeste} sans id ou sans version`);
  const { manifest, download } = urlsDePublication(depot, tag, manifeste, zip);
  return { ...source, manifest, download };
}

// ---------------------------------------------------------------- Archive zip (format PKZIP, entrées « deflate », noms UTF-8)

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(donnees) {
  let c = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) c = TABLE_CRC[(c ^ donnees[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Date et heure au format MS-DOS (résolution 2 s, pas avant 1980).
function dateDos(date) {
  const d = date.getTime() < Date.UTC(1980, 0, 1) ? new Date(Date.UTC(1980, 0, 1)) : date;
  const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { heure, jour };
}

// fichiers : [{ nom (chemin / dans l'archive), donnees (Buffer), date }] -> Buffer de l'archive.
export function fabriquerZip(fichiers) {
  const locaux = [], centraux = [];
  let decalage = 0;
  for (const f of [...fichiers].sort((a, b) => a.nom.localeCompare(b.nom))) {
    const nom = Buffer.from(f.nom, "utf8");
    if (nom.length > 0xffff) throw new Error(`Nom trop long dans l'archive : ${f.nom}`);
    const brut = f.donnees;
    let compresse = deflateRawSync(brut, { level: 9 }), methode = 8;
    if (compresse.length >= brut.length) { compresse = brut; methode = 0; }
    const crc = crc32(brut);
    const { heure, jour } = dateDos(f.date ?? new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version nécessaire : 2.0 (deflate)
    local.writeUInt16LE(0x0800, 6);      // noms en UTF-8
    local.writeUInt16LE(methode, 8);
    local.writeUInt16LE(heure, 10);
    local.writeUInt16LE(jour, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compresse.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);    // fait par : Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(methode, 10);
    central.writeUInt16LE(heure, 12);
    central.writeUInt16LE(jour, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compresse.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt16LE(0, 30);        // extra
    central.writeUInt16LE(0, 32);        // commentaire
    central.writeUInt16LE(0, 34);        // disque
    central.writeUInt16LE(0, 36);        // attributs internes
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // attributs externes : fichier ordinaire rw-r--r--
    central.writeUInt32LE(decalage, 42);
    locaux.push(local, nom, compresse);
    centraux.push(central, nom);
    decalage += local.length + nom.length + compresse.length;
  }
  if (decalage > 0xffffffff || fichiers.length > 0xffff) throw new Error("Archive trop grande pour le format zip classique");
  const tailleCentral = centraux.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  fin.writeUInt16LE(0, 20);
  return Buffer.concat([...locaux, ...centraux, fin]);
}

// Lecture d'une archive produite ici (vérification et essais) : [{ nom, taille, crc }].
export function lireZip(archive) {
  const finPos = archive.length - 22;
  if (archive.readUInt32LE(finPos) !== 0x06054b50) throw new Error("Fin d'archive introuvable");
  const nombre = archive.readUInt16LE(finPos + 10);
  let pos = archive.readUInt32LE(finPos + 16);
  const entrees = [];
  for (let i = 0; i < nombre; i++) {
    if (archive.readUInt32LE(pos) !== 0x02014b50) throw new Error("Entrée centrale invalide");
    const longueurNom = archive.readUInt16LE(pos + 28), extra = archive.readUInt16LE(pos + 30), commentaire = archive.readUInt16LE(pos + 32);
    entrees.push({ nom: archive.toString("utf8", pos + 46, pos + 46 + longueurNom), taille: archive.readUInt32LE(pos + 24), crc: archive.readUInt32LE(pos + 16) });
    pos += 46 + longueurNom + extra + commentaire;
  }
  return entrees;
}

// ---------------------------------------------------------------- Parcours d'un dossier

const IGNORES = new Set([".DS_Store", "Thumbs.db", ".git", ".gitignore", ".gitattributes", "node_modules"]);

export function listerFichiers(dossier, exclure = []) {
  const resultat = [];
  const parcourir = (chemin) => {
    for (const entree of readdirSync(chemin, { withFileTypes: true })) {
      if (IGNORES.has(entree.name)) continue;
      const complet = join(chemin, entree.name);
      const relatif = relative(dossier, complet).split(/[\\/]/).join("/");
      if (exclure.includes(relatif)) continue;
      if (entree.isDirectory()) parcourir(complet);
      else if (entree.isFile()) resultat.push(relatif);
    }
  };
  parcourir(dossier);
  return resultat.sort();
}

// ---------------------------------------------------------------- Empaquetage

export function empaqueter(paquet, { depot, tag, sortie, racine = RACINE }) {
  const dossier = join(racine, paquet.dossier);
  const fabrication = paquet.fabrication ?? "npm run fabriquer-veillees";
  if (!existsSync(join(dossier, paquet.manifeste))) throw new Error(`${paquet.dossier}/${paquet.manifeste} introuvable${paquet.facultatif ? ` : lancer « ${fabrication} » avant d'empaqueter` : ""}`);
  for (const d of paquet.exiger ?? []) {
    if (!existsSync(join(dossier, d)) || !readdirSync(join(dossier, d)).length) {
      throw new Error(`${paquet.dossier}/${d}/ manquant ou vide : lancer « ${fabrication} » avant d'empaqueter`);
    }
  }
  const source = JSON.parse(readFileSync(join(dossier, paquet.manifeste), "utf8"));
  if (source.id !== paquet.id) throw new Error(`${paquet.manifeste} : id « ${source.id} » au lieu de « ${paquet.id} »`);
  const nomPublie = paquet.publie ?? paquet.manifeste;
  const publie = manifestePublie(source, { depot, tag, manifeste: nomPublie, zip: paquet.zip });
  const texteManifeste = `${JSON.stringify(publie, null, 2)}\n`;
  const fichiers = listerFichiers(dossier, paquet.exclure).map(nom => {
    const chemin = join(dossier, nom);
    return nom === paquet.manifeste
      ? { nom, donnees: Buffer.from(texteManifeste), date: statSync(chemin).mtime }
      : { nom, donnees: readFileSync(chemin), date: statSync(chemin).mtime };
  });
  const archive = fabriquerZip(fichiers);
  mkdirSync(sortie, { recursive: true });
  writeFileSync(join(sortie, nomPublie), texteManifeste);
  writeFileSync(join(sortie, paquet.zip), archive);
  return { id: publie.id, version: publie.version, fichiers: fichiers.length, octets: archive.length, sha256: createHash("sha256").update(archive).digest("hex"),
    manifeste: join(sortie, nomPublie), zip: join(sortie, paquet.zip), download: publie.download, manifest: publie.manifest };
}

// Tous les paquets ; un paquet facultatif dont le dossier n'existe pas (module anglais non fabriqué) est passé, signalé dans
// « passes » : [{ id, raison }].
export function empaqueterTout(options, racine = RACINE) {
  const tag = options.tag || `v${JSON.parse(readFileSync(join(racine, PAQUETS[0].dossier, PAQUETS[0].manifeste), "utf8")).version}`;
  const sortie = resolve(racine, options.sortie);
  const resultats = [], passes = [];
  for (const p of PAQUETS) {
    if (p.facultatif && !existsSync(join(racine, p.dossier, p.manifeste))) {
      passes.push({ id: p.id, raison: `${p.dossier}/ absent : lancer « ${p.fabrication ?? "npm run fabriquer-veillees"} » pour le publier` });
      continue;
    }
    resultats.push(empaqueter(p, { depot: options.depot, tag, sortie, racine }));
  }
  resultats.passes = passes;
  return resultats;
}

// Lancé directement (node outils/empaqueter-paquets.mjs) ; importé par les essais, rien ne s'exécute.
// Lancé directement ? Comparaison de chemins (et non d'URL bricolée « file:/// » + argv[1], fausse sous Linux où argv[1]
// commence déjà par « / » : le script ne faisait alors rien, sans erreur, sur le runner GitHub ubuntu-latest).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = lireArguments();
    const resultats = empaqueterTout(options);
    for (const r of resultats) {
      console.log(`${r.id} ${r.version} : ${r.fichiers} fichiers, ${(r.octets / 1024).toFixed(0)} Kio, sha256 ${r.sha256.slice(0, 12)}…`);
      console.log(`  ${posix.normalize(r.zip.split(/[\\/]/).join("/"))}  <-  ${r.download}`);
      console.log(`  ${posix.normalize(r.manifeste.split(/[\\/]/).join("/"))}  (manifest : ${r.manifest})`);
    }
    for (const p of resultats.passes) console.warn(`avertissement : ${p.id} non empaqueté (${p.raison})`);
  } catch (erreur) {
    console.error(`Empaquetage impossible : ${erreur.message}`);
    process.exit(1);
  }
}
