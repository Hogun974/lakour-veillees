// Les fuites de secrets par DÉDUCTION, par ABSENCE ou par DÉLAI (relecture adverse) : rien de secret n'est envoyé à qui ne doit pas le
// savoir, mais ce que le village voit (une carte retournée ou non, une liste de candidats, une annonce qui manque, une attente qui
// n'existe que pour un rôle) le lui apprendrait. essais/non-fuite.test.mjs ne voit pas ces fuites-là : chacune a ici son essai, sur la
// doublure de Foundry, et chaque correction est défaite à son tour dans une copie du système (MUTATIONS) : l'essai doit alors échouer.
// - l'Enfouissement cache toute mort « de la nuit » (poison, feu, peste, Spectre), pas seulement les victimes de la meute ;
// - le Méchant Benêt choisit parmi tous les vivants (loups compris) ; un loup désigné : rien, et personne ne l'apprend ;
// - le Spectre n'ouvre les yeux de la proie qu'après le geste du Toucher mortel sur elle (sinon : villageoise qui connaît la meute) ;
// - la Somnambule parle chaque matin, Liseuse de cendres en jeu ou non (« rien ») ; la Liseuse jouée par un Bateleur, ou en seconde
//   carte, compte ;
// - la Revenue ne ramène jamais un mort qui a tout vu (réglage « mortsVoientTout ») : la carte est alors sans effet ;
// - la même pause avant la révélation d'un condamné après chaque vote d'exécution, Chambrière en jeu ou non ;
// - le Spirite par défaut est tiré au sort parmi les présents (jamais la Liseuse d'étoiles d'office) ;
// - les charmés appelés tout haut au chat par le système (la Table d'un MJ humain), une fois par nuit ;
// - sous l'Exécuteur, le Glas du deuil se tait, et l'Aïeul exécuté emporte la sagesse sans que sa carte se retourne ;
// - un avis du MJ IA au MJ (une erreur d'outil peut citer un rôle) n'est jamais un message de chat, même chuchoté.
// (L'activité de jour masquée, le tintement de jour : essais/activite-nuit.test.mjs, essais/signal.test.mjs ; les oies anonymes :
// essais/pacte-village-api.test.mjs.)  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, envoyerAuMJ, calme, messages } from "./doublures/foundry-loups.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const JOUEURS = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"];

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"), m("logique/index.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, attendreVacances: api.attendreVacances, attendreGazette: api.attendreGazette, socket, reglages: reglagesM, L, racine };
}

async function monde(M, { pauseDuVerdict = 0 } = {}) {
  installerFoundry({ joueurs: 10, contenu: true, pauseDuVerdict });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  game.messages = { get contents() { return messages; } };
  for (const [cle, v] of [["delaiChoix", 1], ["masques", false], ["bailli", false], ["dernierSouffle", false], ["revelerALaMort", true]]) await game.settings.set("lakour-loups", cle, v);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    villageois: role("Villageois", { cle: "villageois" }),
    herbo: role("Herboriste", { cle: "herboriste", effet: "remede", usages: { max: 2, restant: 2 }, nuit: { actif: true, ordre: 50, cibles: 2, soiMeme: true } }),
    aieul: role("Aïeul", { cle: "aieul", effet: "resister" }),
    chambriere: role("Chambrière", { cle: "chambriere", effet: "devouement" }),
    vielle: role("Joueur de vielle", { cle: "joueur-de-vielle", camp: "solitaire", effet: "charmer", victoireCle: "tous-charmes", victoire: "<p>Tous charmés.</p>",
      nuit: { actif: true, ordre: 60, cibles: 2 } }),
    etoiles: role("Liseuse d'étoiles", { cle: "liseuse-d-etoiles", effet: "spiritisme", nuit: { actif: true, ordre: 51, cibles: 1, soiMeme: true } })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const tous = c => villageois().filter(a => cle(a) === c);
const n = (U, k, r = "villageois") => Array.from({ length: k }, () => U[r]);
const pub = () => game.settings.get("lakour-loups", "partie");
async function partie(M, roles, { gazette = { actif: true, choix: true }, graine = "fuites" } = {}) {
  await M.api.distribuer({ roles, metiers: [], joueurs: JOUEURS.slice(0, roles.length), graine, composition: "essai", batiments: [], gazette });
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandeDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id).at(-1);
const repondre = (d, ids) => envoyerAuMJ(CANAL, { type: "reponse", id: d.id, cibles: ids, texte: "", userId: d.destinataire }, { emetteur: d.destinataire });
async function repondreA(acteur, ids, k, message) {
  await attendre(() => demandeDe(acteur, k), message);
  const d = demandeDe(acteur, k);
  repondre(d, typeof ids === "function" ? ids(d) : ids);
  return d;
}
const carnetDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "secret" && e.recipients?.[0] === acteur.system.joueur).map(e => e.entree.texte ?? "").join("\n");
const chat = (depuis = 0) => messages.slice(depuis).map(m => String(m.content).replace(/<[^>]+>/g, " ").replace(/&#0?39;|&#x27;/g, "'").replace(/&quot;/g, "\"")).join("\n");
async function voter(votes) {
  for (const [a, cible] of votes) envoyerAuMJ(CANAL, { type: "vote", votant: a.id, cible: cible?.id ?? "", userId: a.system.joueur }, { emetteur: a.system.joueur });
  await calme();
}
async function aube(M) {
  await M.api.changerPhase("aube");
  const r = await M.api.resoudreNuit({ chuchoter: true });
  await calme();
  return r;
}
async function nuit(M, proie = null, autres = []) {
  await M.api.changerPhase("nuit");
  const loup = villageois().find(a => a.system.vivant && secretDuMJ.camp(a) === "meute");
  if (proie && loup) await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [proie.id] });
  for (const x of autres) await M.api.noterAction(x);
  return aube(M);
}
const cache = a => !game.actors.get(a.id).system.revele && !game.actors.get(a.id).items.some(i => i.type === "role");

const VERIFICATIONS = {
  async "Enfouissement : un mort du poison, du feu ou de la peste (publiquement « mort dans la nuit ») n'est pas révélé non plus"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.herbo, ...n(U, 6)]);
    const vs = tous("villageois");
    await nuit(M);
    await M.api.lireUneCarte("enfouissement");
    const k = messages.length;
    for (const [x, cause] of [[vs[0], "poison"], [vs[1], "feu"], [vs[2], "peste"]]) {
      await M.api.eliminer(x.id, { cause });
      assert.equal(game.actors.get(x.id).system.vivant, false);
      assert.ok(cache(x), `${cause} : la carte reste cachée (sinon le village saurait que ce n'était pas la meute)`);
    }
    assert.doesNotMatch(chat(k), /Villageois/, "le chat ne dit aucun rôle");
    // Une mort qui n'est pas « de la nuit » reste révélée (la carte ne cache que la nuit).
    await M.api.eliminer(vs[3].id, { cause: "narrateur" });
    assert.ok(game.actors.get(vs[3].id).system.revele);
  },

  async "Méchant Benêt : le premier mort choisit parmi tous les vivants, loups compris ; un loup désigné, rien, et personne ne l'apprend"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, ...n(U, 6)]);
    const loups = tous("loup-de-brumecombe");
    const vs = tous("villageois");
    await nuit(M, vs[0]);
    await M.api.lireUneCarte("mechant-benet");
    await M.api.changerPhase("nuit");
    const k = emissions.length;
    const m = messages.length;
    const p = M.api.reveiller("benet", { delai: 5000 });
    const d = await repondreA(vs[0], [loups[0].id], k, "le premier mort désigne");
    await p;
    const ids = d.candidats.map(c => c.id).sort();
    assert.deepEqual(ids, villageois().filter(a => a.system.vivant).map(a => a.id).sort(), "tous les vivants : la meute n'est pas montrée en creux");
    assert.deepEqual(M.api.gazetteSecrets().allies, [], "un loup désigné : pas d'allié");
    for (const a of villageois()) assert.ok(!/Benêt/.test(carnetDe(a, k)), `${a.name} n'apprend rien`);
    assert.doesNotMatch(chat(m), /Benêt/, "rien au village");
  },

  async "Spectre et Toucher mortel : la proie n'ouvre les yeux (et ne voit la meute) qu'après le geste du Toucher sur elle"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.loup, ...n(U, 6)]);
    const [l1, l2] = tous("loup-de-brumecombe");
    const vs = tous("villageois");
    await nuit(M);
    await M.api.lireUneCarte("toucher-mortel");
    await M.api.lireUneCarte("spectre");
    await M.api.changerPhase("nuit");
    for (const l of [l1, l2]) await M.api.noterAction({ acteurId: l.id, roleCle: "meute", cibles: [vs[1].id] });
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "toucher"), "le Toucher attend son geste");
    assert.ok(!M.api.ordreDeNuit().some(e => e.roleCle === "spectre"), "pas de Spectre avant le Toucher : elle apprendrait la meute");
    // Sans toucher, elle est épargnée : villageoise, elle n'a rien vu.
    const k = emissions.length;
    await aube(M);
    assert.ok(game.actors.get(vs[1].id).system.vivant, "épargnée faute de toucher");
    assert.ok(!emissions.slice(k).some(e => e.type === "demande" && e.acteurId === vs[1].id), "jamais réveillée");
    // Touchée : le Spectre suit.
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    for (const l of [l1, l2]) await M.api.noterAction({ acteurId: l.id, roleCle: "meute", cibles: [vs[2].id] });
    await M.api.noterAction({ acteurId: l1.id, roleCle: "toucher", cibles: [vs[2].id] });
    assert.ok(M.api.ordreDeNuit().some(e => e.roleCle === "spectre" && e.acteurIds[0] === vs[2].id), "touchée : elle ouvre les yeux");
  },

  async "Somnambule : chaque matin, même sans Liseuse de cendres (« rien ») ; la Liseuse jouée par un Bateleur ou en seconde carte compte"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, ...n(U, 7)]);
    await nuit(M);
    await M.api.lireUneCarte("somnambule");
    await M.api.changerPhase("jour");
    const m = messages.length;
    await nuit(M);
    assert.match(chat(m), /La Somnambule a dormi d'un sommeil sans rêve/, "sans Liseuse en jeu, elle parle quand même : son silence dirait la composition");
    // La lecture d'une Liseuse empruntée (le Bateleur) ou d'une seconde carte : l'étape « liseuse-de-cendres », l'effet de la carte.
    const vs = [{ id: "b", role: { cle: "bateleur", nom: "Bateleur" } }, { id: "x", role: { cle: "villageois", nom: "Villageois" } }, { id: "z", role: { cle: "herboriste", nom: "Herboriste", effet: "voir-role" } }];
    assert.deepEqual(M.L.rolesLusParLaLiseuse([{ acteurId: "b", roleCle: "liseuse-de-cendres", effet: "voir-role", cibles: ["x"] }], vs), ["Villageois"]);
    assert.deepEqual(M.L.rolesLusParLaLiseuse([{ acteurId: "z", roleCle: "herboriste", cibles: ["x"] }], vs), [], "un autre rôle qui lit (le Jour des sots) n'est pas la Liseuse");
  },

  async "Revenue : un mort qui a tout vu (les cartes des autres, la tanière) ne revient jamais ; la carte est sans effet"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "mortsVoientTout", true);
    await partie(M, [U.loup, ...n(U, 7)]);
    const vs = tous("villageois");
    await nuit(M, vs[0]);
    await calme();
    assert.equal(game.actors.get(vs[0].id).system.vivant, false);
    assert.ok(emissions.some(e => e.type === "vus" && e.recipients?.[0] === vs[0].system.joueur && Object.keys(e.vus).length), "ce mort a reçu les cartes des autres");
    assert.deepEqual(pub().gazetteSecret.aVuTout ?? [], [], "ce qu'il a vu reste un secret du MJ");
    const m = messages.length;
    await M.api.lireUneCarte("revenante");
    assert.equal(game.actors.get(vs[0].id).system.vivant, false, "il ne revient pas parmi les vivants avec ce qu'il sait");
    assert.match(chat(m), /Personne ne revient d'entre les morts/);
    assert.ok(M.api.gazetteSecrets().aVuTout.includes(vs[0].id));
  },

  async "Chambrière : la même pause avant la révélation après chaque vote d'exécution, qu'elle soit en jeu ou non ; un refus rapide ne l'abrège pas"(M) {
    for (const avec of [false, true]) {
      const U = await monde(M, { pauseDuVerdict: 1 });
      await partie(M, avec ? [U.loup, U.chambriere, ...n(U, 5)] : [U.loup, ...n(U, 6)], { graine: `pause-${avec}` });
      const vs = tous("villageois");
      const ch = tous("chambriere")[0];
      await M.api.changerPhase("jour");
      await M.api.ouvrirVote({ duree: 0 });
      await voter(villageois().filter(a => a.id !== vs[0].id).map(a => [a, vs[0]]));
      const k = emissions.length;
      const r = await M.api.cloreVote();
      assert.deepEqual(r.elus, [vs[0].id]);
      const t0 = Date.now();
      const fin = M.api.eliminer(vs[0].id, { cause: "vote" });
      if (avec) await repondreA(ch, [], k, "la Chambrière refuse aussitôt");
      await fin;
      const attente = Date.now() - t0;
      assert.ok(attente >= 900, `${avec ? "avec" : "sans"} Chambrière : la révélation attend la pause (${attente} ms)`);
      assert.equal(game.actors.get(vs[0].id).system.vivant, false);
    }
  },

  async "Spiritisme : sans désignation, le Spirite est tiré au sort parmi les présents, jamais la Liseuse d'étoiles d'office"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.etoiles, ...n(U, 5)], { gazette: {} });
    const [et] = tous("liseuse-d-etoiles");
    const vs = tous("villageois");
    await nuit(M, vs[0]);
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: et.id, roleCle: "liseuse-d-etoiles", cibles: [et.id] });
    const k = emissions.length;
    const hasard = Math.random;
    try {
      await aube(M);
      const dq = await repondreA(et, d => [d.candidats[0].id], k, "la question");
      await attendre(() => demandeDe(et, emissions.indexOf(dq) + 1)?.objet === "seance-spirite", "on lui demande le Spirite");
      // Elle ne répond pas : le sort tranche. Un sort qui ne tombe jamais sur elle (le dernier présent qui n'est pas elle).
      const presents = demandeDe(et, emissions.indexOf(dq) + 1).candidats.map(c => c.id);
      const i = presents.findLastIndex(id => id !== et.id);
      Math.random = () => (i + 0.5) / presents.length;
      await M.attendreGazette();
    } finally { Math.random = hasard; }
    const s = M.api.gazette().spiritisme;
    assert.ok(s.derniere, "la séance a eu lieu");
    assert.notEqual(s.derniere.spirite, et.id, "la Liseuse d'étoiles n'est pas nommée d'office");
  },

  async "les charmés : l'appel tout haut au chat par le système (la Table d'un MJ humain), sans nom, une fois par nuit"(M) {
    const U = await monde(M);
    await partie(M, [U.loup, U.vielle, ...n(U, 4)]);
    const [vielle] = tous("joueur-de-vielle");
    const [x, y] = tous("villageois");
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: vielle.id, roleCle: "joueur-de-vielle", cibles: [x.id, y.id] });
    const m = messages.length;
    await M.api.reveiller("charmes", { delai: 1000 });
    const appels = messages.slice(m).filter(z => z.flags?.["lakour-loups"]?.appelDesCharmes);
    assert.equal(appels.length, 1, "l'appel, au chat public");
    assert.ok(!appels[0].whisper?.length);
    assert.deepEqual(appels[0].flags["lakour-loups"].appelDesCharmes, { partie: pub().partie, tour: pub().tour });
    assert.match(chat(m), /Les charmés, ouvrez les yeux/);
    for (const a of [vielle, x, y]) assert.ok(!chat(m).includes(a.name), "personne n'est nommé");
    // Le MJ IA l'a déjà dit cette nuit (son drapeau) : le système ne le répète pas.
    const m2 = messages.length;
    messages.push({ content: "Les charmés, ouvrez les yeux…", flags: { "lakour-mj-ia": { appelDesCharmes: { partie: pub().partie, tour: pub().tour + 1 } } } });
    await M.api.changerPhase("jour");
    await M.api.changerPhase("nuit");
    await M.api.reveiller("charmes", { delai: 1000 });
    assert.equal(messages.slice(m2).filter(z => z.flags?.["lakour-loups"]?.appelDesCharmes).length, 0, "une fois par nuit");
  },

  async "Exécuteur : le Glas du deuil se tait ; l'Aïeul exécuté emporte la sagesse sans que sa carte se retourne, l'annonce sans nom"(M) {
    const U = await monde(M);
    await game.settings.set("lakour-loups", "glasDuDeuil", true);
    await partie(M, [U.loup, U.aieul, ...n(U, 6)]);
    const [aieul] = tous("aieul");
    const vs = tous("villageois");
    await nuit(M);
    await M.api.lireUneCarte("executeur");
    await voter(villageois().filter(a => a.system.vivant).map(a => [a, vs[1]]));
    await M.api.cloreVote();
    assert.equal(M.api.gazette().executeur.acteurId, vs[1].id);
    const m = messages.length;
    const compte = pub().deuil?.compte ?? 0;
    await M.api.eliminer(vs[2].id, { cause: "vote" });
    assert.doesNotMatch(chat(m), /glas/i, "le glas ne dit pas qu'un condamné caché était innocent");
    assert.equal(pub().deuil?.compte ?? 0, compte);
    const m2 = messages.length;
    await M.api.eliminer(aieul.id, { cause: "vote" });
    assert.ok(cache(aieul), "sa carte ne se retourne pas");
    assert.match(chat(m2), /L'Aïeul est tombé de la main du village : Brumecombe a perdu sa sagesse/, "la perte reste publique");
    assert.ok(!chat(m2).includes(`${aieul.name}, l'Aïeul`), "sans dire qui était l'Aïeul");
    assert.ok(!M.api.registre().some(e => e.type === "pacte" && e.quoi === "sagesse" && e.acteurId), "le Registre ne le nomme pas");
  }
};

const MUTATIONS = [
  ["logique/gazette.mjs", "  if (cause && causePublique(cause) === \"nuit\" && cartePosee(etat, \"enfouissement\")) return \"enfouissement\";",
    "  if ([\"meute\", \"epie\"].includes(cause) && cartePosee(etat, \"enfouissement\")) return \"enfouissement\";", "Enfouissement : toute mort de la nuit"],
  ["logique/gazette.mjs", "    case CLE_BENET: return vivants.map(v => v.id);", "    case CLE_BENET: return vivants.filter(v => v.camp !== \"meute\").map(v => v.id);", "Benêt : tous les vivants"],
  ["scripts/api.mjs", "  if (campDe(game.actors.get(cible)) === \"meute\") {", "  if (false) {", "Benêt : un loup désigné, rien"],
  ["logique/gazette.mjs", "    if (cartePosee(etat, \"spectre\") && touchee && !sots", "    if (cartePosee(etat, \"spectre\") && !sots", "Spectre : après le Toucher"],
  ["scripts/api.mjs", "  if (L.cartePosee(e, \"somnambule\")) {", "  if (L.cartePosee(e, \"somnambule\") && villageoisAPlat().some(v => v.role?.cle === \"liseuse-de-cendres\")) {", "Somnambule : chaque matin"],
  ["logique/gazette.mjs", "  const deLaLiseuse = a => a.roleCle === CLE_LISEUSE_DE_CENDRES || (", "  const deLaLiseuse = a => (", "Somnambule : la Liseuse empruntée"],
  ["logique/gazette.mjs", "      if (m && !aToutVu(etat, m.acteurId)) sortie.gestes.push(", "      if (m) sortie.gestes.push(", "Revenue : jamais qui a tout vu"],
  ["scripts/api.mjs", "    if (temoin && !L.aToutVu(etat, temoin.id) && !temoinsNotes.has(cleTemoin)) {", "    if (false) {", "Revenue : il a tout vu, noté"],
  ["scripts/api.mjs", "    if (pause > 0) devouement = { partie: etat.partie, numero: resultat.numero, chambriere: \"\", promesse: Promise.resolve(\"\"), fin };", "",
    "Chambrière : la fausse attente"],
  ["scripts/api.mjs", "    if (reste > 0 && !L.partieFinie(lireEtat())) await new Promise(r => setTimeout(r, reste));", "", "Chambrière : toute la pause"],
  ["scripts/api.mjs", "  const spirite = presents.includes(sp) ? sp : L.choisir(presents.length ? presents : vivants) ?? s.par;",
    "  const spirite = presents.includes(sp) ? sp : presents.includes(s.par) ? s.par : (presents[0] ?? s.par);", "Spiritisme : le sort"],
  ["scripts/api.mjs", "async function reveillerLesCharmes(entree) {\n  await appelerLesCharmes();", "async function reveillerLesCharmes(entree) {", "charmés : l'appel au chat"],
  ["scripts/api.mjs", "  if (deja || !reglage(\"annoncesEnChat\")) return;", "  if (!reglage(\"annoncesEnChat\")) return;", "charmés : une fois par nuit"],
  ["scripts/api.mjs", "    if (cause === \"vote\" && cacheParLaGazette !== \"executeur\") await sonnerLeDeuil(acteur);", "    if (cause === \"vote\") await sonnerLeDeuil(acteur);", "Exécuteur : le glas se tait"],
  ["scripts/api.mjs", "{ cache: Boolean(cacheParLaGazette) && !montrer }", "{ cache: false }", "Exécuteur : la sagesse sans nom"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-fuites-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, () => apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M, seules = null) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    if (seules && !seules.some(s => nom.includes(s))) continue;
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally {
      game.user = game.users.get("mj");
      await calme().catch(() => {});
      await M.attendreGestes().catch(() => {});
      await M.attendreVacances().catch(() => {});
      await M.attendreGazette().catch(() => {});
    }
  }
  return liste;
}

test("fuites par déduction : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.stack}`), []);
});

// Pour aller vite : chaque mutation n'est rejouée que sur les vérifications de son sujet (le début de son nom, avant « : »).
const VERIFICATIONS_DE = { Enfouissement: ["Enfouissement"], "Benêt": ["Méchant Benêt"], Spectre: ["Spectre"], Somnambule: ["Somnambule"], Revenue: ["Revenue"],
  "Chambrière": ["Chambrière"], Spiritisme: ["Spiritisme"], "charmés": ["les charmés"], "Exécuteur": ["Exécuteur"] };
test("fuites par déduction : chaque correction défaite est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    const sujet = VERIFICATIONS_DE[regle.split(" :")[0]];
    assert.ok(sujet, `le sujet de la mutation « ${regle} »`);
    const e = await echecs(await chargerMutant(fichier, avant, apres), sujet);
    // TRACE_FUITES=1 : ce qui a fait échouer chaque mutant (vérifier que c'est bien l'essai visé).
    if (process.env.TRACE_FUITES) console.log(`${regle} -> ${e.map(x => x.e.message.split("\n")[0]).join(" / ") || "rien"}`);
    if (!e.length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
