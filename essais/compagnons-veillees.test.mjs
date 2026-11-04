// Compagnons IA aux Veillées de Brumecombe : ce qu'on envoie au modèle d'un compagnon ne contient AUCUN secret qu'il ne doit
// pas connaître. Le vrai système lakour-loups, le vrai contenu, 3 joueurs humains simulés et 4 compagnons dont le cerveau
// passe par un fournisseur DOUBLURE qui note tout ce qu'il reçoit (aucun appel payant).
// Essais clés : un loup compagnon ne voit pas le rôle des autres ; un villageois compagnon ne voit pas l'état secret de la
// nuit ; ni le carnet d'un autre, ni un chuchotement, ni la chronique secrète du MJ. Puis une batterie par mutation de la vue.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, simulerJoueurs, calme, messages, emissions } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 3, contenu: true });
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const { creerHasard } = await import("../systems/lakour-loups/logique/index.mjs");
const { OUTILS } = await import("../modules/lakour-mj-ia/scripts/outils.js");
const J = await import("../modules/lakour-mj-ia/scripts/compagnons-jeu.js");
const { contexteCompagnon, texteBrut } = await import("../modules/lakour-mj-ia/scripts/compagnons.js");
const outil = nom => OUTILS.find(o => o.nom === nom);

const roleDe = a => secretDuMJ.role(a);
const metierDe = a => a?.items.find(i => i.type === "metier") ?? null;
const villageois = () => game.actors.filter(a => a.type === "villageois");
const USAGE = { entree: 1500, cacheLecture: 0, cacheEcriture: 0, sortie: 40 };

// Le fournisseur doublure : il répond comme un modèle obéissant (le premier candidat qui n'est pas lui) et note tout.
const recu = [];
const enregistreur = {
  nom: "anthropic",
  async envoyerCourt(contexte) {
    recu.push(contexte);
    const moi = /Tu joues (.+?), un personnage/.exec(contexte.systeme)?.[1];
    const candidats = /Candidats : (.+)\.\n/.exec(contexte.texte)?.[1].split(", ");
    if (candidats) return { texte: JSON.stringify({ cibles: [candidats.find(n => n !== moi) ?? candidats[0]] }), usage: USAGE, arret: "fin" };
    if (contexte.texte.includes('{"texte": "ta phrase"}')) return { texte: '{"texte": "Je veille sur toi."}', usage: USAGE, arret: "fin" };
    return { texte: "Je n'ai rien vu cette nuit, mais je vous écoute.", usage: USAGE, arret: "fin" };
  }
};
const recuPar = acteur => recu.filter(c => c.systeme.includes(`Tu joues ${acteur.name}, un personnage`)).map(c => `${c.systeme}\n${c.texte}`);

// ------------------------------------------------------------------ une partie : 3 humains, 4 compagnons
installerFoundry({ joueurs: 3, contenu: true });
enregistrerReglages(() => {});
game.lakourLoups = api;
ecouterSocket();
game.messages = { get contents() { return messages; } };
const hasardOrigine = Math.random;
Math.random = creerHasard("compagnons-veillees");
simulerJoueurs({ graine: "compagnons-veillees", fraude: false, pouvoirs: 0 });
J.reinitialiserPrive();
const comptes = [];
const compagnons = new J.Compagnons({ fournisseur: () => enregistreur, modele: () => "claude-haiku-5-5", graine: "veillees" });
compagnons.moteur = { compter: async (u, m) => comptes.push({ u, m }), budgetDepasse: () => false, signaler() {} };
const invites = new Map();   // acteurId -> invites reçues (ce qu'on lui a demandé, à lui)
api.resolveurs.compagnon = demande => {
  invites.set(demande.acteurId, [...(invites.get(demande.acteurId) ?? []), demande.invite]);
  return compagnons.resoudreLoups(demande);
};

const depart = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique", composition: "", inclure: [], exclure: [],
  roles: ["Loup de Brumecombe", "Loup de Brumecombe", "Liseuse de cendres", "Herboriste", "Messager", "villageois", "villageois"], batiments: [], compagnons: 4 });
assert.ok(!depart.erreur, depart.contenu);
const lesCompagnons = villageois().filter(a => a.system.compagnon);
// Le loup compagnon (A) et le villageois compagnon (B) : arrangés par échange de rôles (les cartes repartent aux carnets).
const A = lesCompagnons[0];
if (secretDuMJ.camp(A) !== "meute") await api.echangerRoles(A.id, villageois().find(a => secretDuMJ.camp(a) === "meute").id);
const B = lesCompagnons.find(a => a.id !== A.id && secretDuMJ.camp(a) !== "meute");
if (roleDe(B).system.cle !== "villageois") await api.echangerRoles(B.id, villageois().find(a => a.id !== A.id && a.id !== B.id && roleDe(a).system.cle === "villageois").id);
const humain = villageois().find(a => a.system.joueur);
// Des canaris : un secret dans le carnet d'un humain, dans celui de chaque compagnon, un chuchotement, un message public.
await api.envoyerSecret(humain.id, "CANARI-CARNET-AUTRE : la Liseuse a lu les cendres.");
await api.envoyerSecret(A.id, "CANARI-MOI-A");
await api.envoyerSecret(B.id, "CANARI-MOI-B");
await ChatMessage.implementation.create({ content: "<p>CANARI-CHUCHOTE au MJ</p>", whisper: ["mj"], speaker: { alias: "Joueur 1" } });
await ChatMessage.implementation.create({ content: "<p>PUBLIC-VISIBLE : je dors mal depuis la foire.</p>", speaker: { alias: "Joueur 2" } });
// Une nuit complète (les compagnons choisissent par le résolveur), un secret de plus dans l'état de la nuit, le débat, le vote.
const nuit = await outil("loups_nuit").executer({ delai_secondes: 20 });
assert.ok(!nuit.erreur, nuit.contenu);
await calme();
await api.noterAction({ acteurId: humain.id, roleCle: roleDe(humain).system.cle, cibles: [], texte: "CANARI-NUIT" });
const dits = await compagnons.debattre({ max: 4 });
await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
await calme();
const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
Math.random = hasardOrigine;

// Ce que le joueur de ce compagnon saurait : son carnet, ses propres choix et ce qu'on lui a demandé, sa fiche, le public.
function permisPour(a) {
  const etat = api.etat();
  return [...messages.filter(m => !m.whisper?.length).map(m => texteBrut(m.content)), ...etat.historique.map(h => h.texte),
    ...villageois().filter(x => x.system.revele).map(x => roleDe(x).name), ...api.carnet(a.id).map(e => texteBrut(e.html ?? e.texte)),
    ...J.privesDe(a.id), ...(invites.get(a.id) ?? []), roleDe(a).name, texteBrut(roleDe(a).system.description), texteBrut(roleDe(a).system.victoire),
    texteBrut(metierDe(a)?.system.description)].join("\n");
}

// Les fuites, dans une liste de textes envoyés au modèle de ce compagnon (vide = rien qui fuie).
function fuites(a, envois) {
  const etat = api.etat();
  const permis = permisPour(a);
  const tout = envois.join("\n");
  const sortie = [];
  const autres = lesCompagnons.filter(x => x.id !== a.id).map(x => `CANARI-MOI-${x === A ? "A" : x === B ? "B" : "X"}`);
  for (const canari of ["CANARI-CARNET-AUTRE", "CANARI-CHUCHOTE", "CANARI-NUIT", ...autres]) if (tout.includes(canari)) sortie.push(canari);
  // Aucun rôle d'un autre (non révélé) qu'il ne pourrait connaître : ici, personne n'a annoncé la composition.
  for (const b of villageois().filter(x => x.id !== a.id && !x.system.revele)) {
    const nom = roleDe(b).name;
    if (!permis.includes(nom) && tout.includes(nom)) sortie.push(`rôle de ${b.name} (${nom})`);
  }
  for (const x of etat.journalSecret.filter(x => x.texte.length > 24 && !permis.includes(x.texte))) if (tout.includes(x.texte)) sortie.push(`chronique : ${x.texte}`);
  for (const x of [...etat.nuit.actions, ...etat.nuitPrecedente.actions].filter(x => x.texte && !permis.includes(x.texte))) {
    if (tout.includes(x.texte)) sortie.push(`mot : ${x.texte}`);
  }
  return sortie;
}

// ------------------------------------------------------------------ les essais
test("la partie a vraiment interrogé les compagnons par le modèle (fournisseur doublure, rien de payant), au modèle des compagnons", () => {
  assert.ok(recuPar(A).length >= 3, "le loup compagnon a choisi la nuit, parlé, voté");
  assert.ok(recuPar(B).length >= 2, "le villageois compagnon a parlé et voté");
  assert.ok(api.etat().nuitPrecedente.actions.some(x => x.roleCle === "meute"), "la meute a chassé");
  assert.ok(dits.length > 0, "les compagnons ont parlé au débat");
  assert.ok(dits.every(d => d.source === "ia"));
  assert.ok(messages.some(m => m.flags?.["lakour-mj-ia"]?.compagnon === dits[0].acteurId), "la réplique paraît au chat sous son nom");
  assert.match(clos.contenu, /Décompte/);
  assert.ok(comptes.length === recu.length && comptes.every(c => c.m === "claude-haiku-5-5"), "chaque appel compté au modèle des compagnons");
  assert.ok(!emissions.some(e => e.recipients?.includes("")), "rien n'est envoyé par le socket à un compagnon");
});

test("un loup compagnon ne voit pas le rôle des autres, ni le carnet d'un autre, ni un chuchotement, ni la chronique secrète", () => {
  assert.equal(secretDuMJ.camp(A), "meute");
  const envois = recuPar(A);
  assert.deepEqual(fuites(A, envois), []);
  const dernier = contexteCompagnon(compagnons.vue(A));
  const texte = `${dernier.systeme}\n${dernier.texte}`;
  assert.ok(texte.includes("CANARI-MOI-A"), "il lit son propre carnet");
  assert.ok(texte.includes("PUBLIC-VISIBLE"), "il lit le chat public");
  assert.ok(texte.includes("Loup de Brumecombe"), "il connaît son propre rôle");
  for (const nom of ["Liseuse de cendres", "Herboriste", "Messager"]) assert.ok(!envois.join("\n").includes(nom) || permisPour(A).includes(nom), `${nom} vu par le loup`);
});

test("un villageois compagnon ne voit pas l'état secret de la nuit : ni qui la meute a attaqué, ni les choix des rôles, ni les loups", () => {
  assert.equal(roleDe(B).system.cle, "villageois");
  const envois = recuPar(B);
  assert.deepEqual(fuites(B, envois), []);
  const tout = envois.join("\n");
  assert.ok(!/la meute a attaqué/.test(tout), "l'invite de l'Herboriste (qui la meute a attaqué) ne lui parvient pas");
  for (const loup of villageois().filter(a => secretDuMJ.camp(a) === "meute" && !a.system.revele)) {
    assert.ok(!tout.split(/\n| ; /).some(m => m.includes(loup.name) && m.includes("Loup de Brumecombe")), `il sait que ${loup.name} est un loup`);
  }
  assert.ok(tout.includes("CANARI-MOI-B") && !tout.includes("CANARI-MOI-A"), "son carnet, pas celui du loup");
});

test("la vue suit l'état PUBLIC : un mort ou un muet ne parle pas, la nuit personne ne parle ; le prompt ne contient que la vue", async () => {
  const v = compagnons.vue(B);
  assert.deepEqual(Object.keys(v).sort(), ["allies", "autres", "fiche", "id", "jeu", "monde", "nom", "peutParler", "personnalite", "prive", "public", "scene", "suspects", "tour", "vivant", "humains", "petiteTablee"].sort());
  // La Petite tablée (0.11.0) : les humains (public : system.joueur) et le mode (public : etat.petiteTablee), pour la parole seulement.
  assert.deepEqual([...v.humains].sort(), villageois().filter(a => a.system.joueur && a.id !== B.id).map(a => a.id).sort());
  assert.equal(v.petiteTablee, false);
  for (const a of v.autres) assert.equal(a.humain, Boolean(game.actors.get(a.id).system.joueur));
  await api.changerPhase("nuit");
  assert.equal(compagnons.vue(B).peutParler, false, "la nuit, le village dort");
  await api.changerPhase("jour");
  await api.reduireAuSilence(B.id);
  assert.equal(compagnons.vue(B).peutParler, false, "réduit au silence");
  assert.ok(api.carnet(B.id).some(e => /pris la voix/.test(e.texte ?? "")), "le compagnon l'apprend dans son carnet");
  const vivant = lesCompagnons.find(a => a.system.vivant && a.id !== B.id);
  await api.eliminer(vivant.id, { cause: "narrateur", reveler: false });
  assert.equal(compagnons.vue(vivant).peutParler, false, "un mort se tait");
  assert.ok(!(await compagnons.debattre({ max: 4 })).some(d => [B.id, vivant.id].includes(d.acteurId)));
});

test("loups_distribuer : noms tirés de la table des noms du village, jamais un nom de joueur ; personnalité au hasard ; compagnons IA annoncés", () => {
  const table = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/src/tables/noms-de-villageois.json", import.meta.url), "utf8"));
  const noms = table.results.map(r => texteBrut(r.description));
  for (const a of lesCompagnons) {
    assert.ok(noms.includes(a.name), `${a.name} : pas dans la table`);
    assert.equal(a.system.joueur, "");
    assert.ok(a.flags["lakour-mj-ia"].compagnon.temperament);
  }
  assert.equal(new Set(lesCompagnons.map(a => a.name)).size, lesCompagnons.length, "noms distincts");
  assert.match(depart.contenu, /\(7 joueurs, dont 4 compagnons IA\)/);
  assert.match(depart.contenu, /\(compagnon IA\) : /);
  assert.doesNotMatch(depart.contenu, /undefined/);
});

// ------------------------------------------------------------------ mutations de la vue (compagnons-jeu.js)
const SCRIPTS = fileURLToPath(new URL("../modules/lakour-mj-ia/scripts/", import.meta.url));
const COPIES = ["compagnons-jeu.js", "compagnons.js", "constantes.js", "adaptateurs.js", "utilitaires.js", "tour-logique.js", "histoire-logique.js", "survie-logique.js", "contenus.js"];
const MUTATIONS = {
  "état complet au lieu de l'état public (chronique secrète comprise)": [
    "const pub = api.logique.etatPublic(api.etat());", "const pub = api.etat();",
    "pub.historique?.length ? `Annonces publiques récentes :\\n${pub.historique.slice(-12)", "pub.historique?.length ? `Annonces publiques récentes :\\n${[...pub.historique, ...(pub.journalSecret ?? [])].slice(-40)"],
  "carnets de tout le village": ["const entrees = api.carnet(acteur.id) ?? [];", "const entrees = tous.flatMap(a => api.carnet(a.id) ?? []);"],
  "chuchotements dans le chat public": ["if (m.whisper?.length || m.blind) continue;", "if (m.blind) continue;"],
  // Système 0.9.0 : un rôle non révélé n'est dans aucun document ; la vue le lirait dans les secrets du MJ (roleLoups) pour tous.
  "rôles de tous affichés, révélés ou non": [
    "const roleDe = a => (a?.id === acteur.id ? roleLoups(a, api) : a?.items?.find?.(i => i.type === \"role\") ?? null);", "const roleDe = a => roleLoups(a, api);",
    "${a.system.revele && roleDe(a) ? `, rôle révélé : ${roleDe(a).name}` : \"\"}", "${roleDe(a) ? `, rôle : ${roleDe(a).name}` : \"\"}"]
};

async function charger(mutation) {
  const dossier = mkdtempSync(join(tmpdir(), "lakour-vue-compagnon-"));
  for (const f of COPIES) {
    let texte = readFileSync(join(SCRIPTS, f), "utf8").replace(/\r\n/g, "\n");
    if (mutation && f === "compagnons-jeu.js") {
      for (let i = 0; i < mutation.length; i += 2) {
        assert.ok(texte.includes(mutation[i]), `mutation obsolète : ${mutation[i]}`);
        texte = texte.replace(mutation[i], mutation[i + 1]);
      }
    }
    writeFileSync(join(dossier, f), texte);
  }
  return { dossier, M: await import(pathToFileURL(join(dossier, "compagnons-jeu.js")).href) };
}

const batterie = M => [A, B].flatMap(a => {
  const { systeme, texte } = contexteCompagnon(M.vueVeillees(a));
  return fuites(a, [`${systeme}\n${texte}`]).map(f => `${a.name} : ${f}`);
});

test("mutations : la vue du vrai code ne fuit rien ; chaque vue cassée est attrapée", async () => {
  const vrai = await charger(null);
  try { assert.deepEqual(batterie(vrai.M), []); } finally { rmSync(vrai.dossier, { recursive: true, force: true }); }
  for (const [nom, mutation] of Object.entries(MUTATIONS)) {
    const m = await charger(mutation);
    try { assert.ok(batterie(m.M).length > 0, `mutation non détectée : ${nom}`); } finally { rmSync(m.dossier, { recursive: true, force: true }); }
  }
});
