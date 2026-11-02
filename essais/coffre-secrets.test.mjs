// Le coffre des secrets : un autre navigateur du MJ reprend la partie là où elle en était.
// - Les secrets sont rangés chiffrés (AES-GCM) dans le réglage monde « coffre » ; la clé reste chez le MJ actif ; chaque
//   joueur connecté reçoit une part de la clé (Shamir, seuil 2), à lui seul.
// - Une part ne suffit pas ; deux parts concordantes rouvrent le coffre ; la part d'un autre joueur est refusée.
// - Tant que le MJ attend ses parts, le coffre de la partie n'est jamais écrasé par des secrets incomplets.
// - Un joueur ne rend sa part qu'à un MJ (l'émetteur donné par le serveur) ; un joueur qui arrive est sollicité.
// - Une nouvelle partie : nouvelle clé ; la remise à zéro vide le coffre.
// Chaque vérification est rejouée sur des copies mutées du système.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, reglages, calme } from "./doublures/foundry-loups.mjs";

installerFoundry();
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const ID = "lakour-loups";

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, reglages, socket, secrets, coffre, donnees, logique] = await Promise.all([m("scripts/api.mjs"), m("scripts/reglages.mjs"),
    m("scripts/socket.mjs"), m("scripts/secrets.mjs"), m("scripts/coffre.mjs"), m("scripts/donnees.mjs"), m("logique/coffre.mjs")]);
  return { api: api.api, reglages, socket, secrets, coffre, donnees, C: logique };
}

const valeur = cle => structuredClone(reglages.get(`${ID}.${cle}`).valeur);
const parts = () => Object.fromEntries(emissions.filter(e => e.type === "part").map(e => [e.recipients?.[0], { partie: e.partie, x: e.x, y: e.y, recipients: e.recipients }]));

async function distribuer(M, graine = "coffre") {
  const role = cle => creerObjetMonde(cle, "role", { cle, ...(cle === "loup" ? { camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } } : {}) });
  const metier = creerObjetMonde("Forgeron", "metier", { cle: "forgeron" });
  await M.api.distribuer({ roles: [role("loup"), role("villageois"), role("villageois"), role("villageois")], metiers: [metier, metier, metier, metier],
    joueurs: ["u1", "u2", "u3", "u4"], graine, composition: "compo-tres-secrete", batiments: [] });
  await M.api.changerPhase("jour");
  await M.coffre.rangement();
  await calme();
  return M.api.etat().partie;
}

async function partie(M) {
  installerFoundry({ joueurs: 4 });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  return distribuer(M);
}

// Le MJ ouvre la partie dans un autre navigateur : ni secrets ni clé dans ce navigateur-là.
function autreNavigateur(M) {
  M.secrets.oublierSecrets();
  M.coffre.oublierCoffre();
  reglages.get(`${ID}.secrets`).valeur = {};
  reglages.get(`${ID}.cleCoffre`).valeur = {};
}

const rendre = (M, part, de) => M.socket.traiterMessage({ type: "partRendue", partie: part.partie, x: part.x, y: part.y, userId: de }, de);

const VERIFICATIONS = {
  async "chiffrement : aller-retour ; mauvaise clé, autre partie ou coffre touché : rien ; taille par blocs"(M) {
    const cle = M.C.nouvelleCle("p1");
    const secret = { partie: "p1", composition: "compo-tres-secrete", primes: { a: "b" } };
    const coffre = await M.C.sceller(secret, cle);
    assert.deepEqual(await M.C.ouvrir(coffre, cle), secret);
    assert.ok(!JSON.stringify(coffre).includes("compo-tres-secrete"));
    assert.equal(await M.C.ouvrir(coffre, M.C.nouvelleCle("p1")), null);
    assert.equal(await M.C.ouvrir({ ...coffre, partie: "p2" }, { ...cle, partie: "p2" }), null);
    const touche = { ...coffre, donnees: (coffre.donnees[0] === "A" ? "B" : "A") + coffre.donnees.slice(1) };
    assert.equal(await M.C.ouvrir(touche, cle), null);
    const long = await M.C.sceller({ partie: "p1", texte: "x".repeat(1500) }, cle);
    assert.equal(long.donnees.length, coffre.donnees.length, "la taille ne trahit pas le contenu");
  },

  async "partage : une part ne suffit pas, deux la rendent ; part fausse : une clé qui n'ouvre rien ; autre partie : rien"(M) {
    const cle = M.C.nouvelleCle("p1");
    const coffre = await M.C.sceller({ partie: "p1" }, cle);
    const [p1, p2, p3] = ["u1", "u2", "u3"].map(u => M.C.partDe(cle, u));
    assert.equal(M.C.reconstituer([p1]), null);
    assert.equal(M.C.reconstituer([p2, p3]).k, cle.k);
    assert.equal(M.C.reconstituer([p1, { ...p2, partie: "p2" }]), null);
    const fausse = { ...p2, y: (BigInt(`0x${p2.y}`) + 12345n).toString(16) };
    assert.equal(await M.C.ouvrir(coffre, M.C.reconstituer([p1, fausse])), null);
    assert.deepEqual(await M.C.ouvrir(coffre, M.C.reconstituer([p1, p3])), { partie: "p1" });
  },

  async "nouvelle partie : coffre chiffré, une part à chaque joueur, à lui seul"(M) {
    const id = await partie(M);
    const coffre = valeur("coffre");
    assert.equal(coffre.partie, id);
    assert.ok(coffre.donnees && !JSON.stringify(coffre).includes("compo-tres-secrete"));
    assert.ok(!JSON.stringify(valeur("partie")).includes("compo-tres-secrete"));
    const p = parts();
    assert.deepEqual(Object.keys(p).sort(), ["u1", "u2", "u3", "u4"]);
    for (const [u, part] of Object.entries(p)) {
      assert.deepEqual(part.recipients, [u]);
      assert.equal(part.partie, id);
    }
  },

  async "autre navigateur du MJ : deux parts rouvrent le coffre ; une seule, ou celle d'un autre, non"(M) {
    const id = await partie(M);
    const avant = structuredClone(M.secrets.secretsMJ());
    const p = parts();
    autreNavigateur(M);
    assert.ok(M.secrets.secretsPerdus(M.donnees.lirePublic()));
    let rappels = 0;
    emissions.length = 0;
    assert.equal(await M.coffre.chercherSecrets(id, () => { rappels++; }), true);
    const demande = emissions.find(e => e.type === "rendrePart");
    assert.deepEqual([...demande.recipients].sort(), ["u1", "u2", "u3", "u4"]);
    await rendre(M, p.u1, "u1");
    assert.equal(rappels, 0, "une part seule ne rouvre rien");
    await rendre(M, p.u2, "u3");
    assert.equal(rappels, 0, "la part d'un autre joueur est refusée");
    await rendre(M, p.u2, "u2");
    assert.equal(rappels, 1);
    assert.deepEqual(M.secrets.secretsMJ(), avant);
    assert.equal(M.secrets.secretsPerdus(M.donnees.lirePublic()), false);
    assert.equal(M.coffre.enAttenteDeParts(), false);
  },

  async "en attente des parts : le coffre n'est jamais écrasé ; un joueur qui arrive est sollicité"(M) {
    const id = await partie(M);
    const p = parts();
    const coffre = valeur("coffre");
    autreNavigateur(M);
    game.users.get("u3").active = false;
    game.users.get("u4").active = false;
    await M.coffre.chercherSecrets(id);
    await M.secrets.garderSecrets({ partie: id, composition: "" });
    await M.coffre.rangement();
    assert.deepEqual(valeur("coffre"), coffre, "des secrets incomplets n'écrasent pas le coffre");
    await rendre(M, p.u1, "u1");
    emissions.length = 0;
    game.users.get("u3").active = true;
    M.coffre.joueurArrive("u3", id);
    assert.deepEqual(emissions.find(e => e.type === "rendrePart")?.recipients, ["u3"]);
    await rendre(M, p.u3, "u3");
    assert.equal(M.secrets.secretsMJ().composition, "compo-tres-secrete");
  },

  async "chez un joueur : sa part gardée ; rendue à un MJ seulement"(M) {
    await partie(M);
    game.user = game.users.get("u1");
    try {
      M.socket.traiterMessage({ type: "part", partie: "p1", x: "ab", y: "cd" }, "mj");
      await calme();
      M.socket.traiterMessage({ type: "part", partie: "p9", x: "1", y: "2" }, "u2");
      await calme();
      assert.deepEqual(valeur("partCoffre"), { partie: "p1", x: "ab", y: "cd" });
      emissions.length = 0;
      M.socket.traiterMessage({ type: "rendrePart", partie: "p1" }, "u2");
      M.socket.traiterMessage({ type: "rendrePart", partie: "p1" });
      M.socket.traiterMessage({ type: "rendrePart", partie: "p2" }, "mj");
      // Sans le filtre du socket : ni sans émetteur, ni à un joueur.
      assert.equal(M.coffre.rendrePart({ partie: "p1" }), false);
      assert.equal(M.coffre.rendrePart({ partie: "p1" }, "u2"), false);
      assert.equal(emissions.length, 0);
      M.socket.traiterMessage({ type: "rendrePart", partie: "p1" }, "mj");
      assert.deepEqual(emissions.map(e => [e.type, e.x, e.y, e.recipients]), [["partRendue", "ab", "cd", ["mj"]]]);
    } finally { game.user = game.users.get("mj"); }
  },

  async "nouvelle partie : nouvelle clé ; remise à zéro : coffre vidé"(M) {
    const id = await partie(M);
    const premiere = parts().u1;
    await M.api.remettreAZero();
    await M.coffre.rangement();
    assert.deepEqual(valeur("coffre"), {});
    emissions.length = 0;
    const id2 = await distribuer(M, "coffre-2");
    assert.notEqual(id2, id);
    assert.equal(valeur("coffre").partie, id2);
    assert.notEqual(parts().u1.y, premiere.y);
  }
};

const MUTATIONS = [
  ["scripts/secrets.mjs", "  surGarde?.(secret);\n", "", "le coffre suit les secrets"],
  ["scripts/coffre.mjs", "    if (coffre.partie === partie) return;", "", "coffre jamais écrasé en attente"],
  ["scripts/coffre.mjs", "    for (const id of joueursConnectes()) envoyerPart(id, partie);\n", "", "parts distribuées"],
  ["scripts/coffre.mjs", "  emettre({ type: \"part\", ...C.partDe(c, userId) }, [userId]);", "  emettre({ type: \"part\", ...C.partDe(c, userId) });", "part à lui seul"],
  ["scripts/coffre.mjs", "  if (C.abscisse(userId).toString(16) !== String(x)) return false;", "", "part d'un autre refusée"],
  ["scripts/coffre.mjs", "  if (game.user.isGM || !emetteur || !game.users.get(emetteur)?.isGM) return false;", "  if (game.user.isGM) return false;", "rendue à un MJ seulement"],
  ["scripts/coffre.mjs", "  if (aRetrouver === partie) emettre({ type: \"rendrePart\", partie }, [userId]);\n", "", "joueur qui arrive sollicité"],
  ["scripts/coffre.mjs", "    if (coffre.partie) await game.settings.set(ID, \"coffre\", {});\n", "", "remise à zéro : coffre vidé"],
  ["logique/coffre.mjs", "  const complete = clair.padEnd(Math.ceil((clair.length + 1) / TAILLE_BLOC) * TAILLE_BLOC, \" \");", "  const complete = clair;", "taille par blocs"],
  ["logique/coffre.mjs", "    return secret?.partie === coffre.partie ? secret : null;", "    return secret;", "autre partie refusée"]
];

async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-coffre-mutant-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  try { return await charger(dossier); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
  }
  return liste;
}

test("coffre : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("coffre : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
