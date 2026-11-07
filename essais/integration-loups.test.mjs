// Essai d'INTÉGRATION des « Veillées de Brumecombe » : le système lakour-loups (API réelle, socket réel), le vrai contenu
// de lakour-veillees (rôles, métiers, bâtiments, compositions.json) et les OUTILS du MJ IA (loups_*), sur la doublure de
// Foundry (essais/doublures/foundry-loups.mjs) avec des joueurs simulés. Des parties complètes, jusqu'à la victoire :
// nuits (dont le mot du Messager), aube (bâtiments qui parlent), pouvoirs de jour (métiers, Conteuse, bâtiments, par la
// Table de jeu des joueurs et par loups_jour), vote (ruban de la Tisserande, Juge de paix qui fait revoter), Puits,
// vote de la Chapelle. À chaque pas : rien de secret dans l'état public ni dans ce que le socket diffuse.
// Avec des COMPAGNONS IA (villageois sans joueur, joués par le cerveau du MJ IA, ici en repli sans IA) : 3 humains simulés et
// des compagnons, jusqu'à la victoire ; les compagnons choisissent la nuit (résolveur du système, sans socket), parlent au
// débat et votent ; à chaque nuit, ce qu'on enverrait au modèle d'un compagnon ne contient aucun secret qu'il ignore.
// Le PLATEAU suit : après chaque outil du narrateur, chaque villageois a un jeton verrouillé sur la scène du village, à sa
// place pour la phase (devant sa maison la nuit et à l'aube, en cercle sur la place pour le vote, au cimetière s'il est
// mort), la lumière est celle de la phase, l'image reste neutre tant que le rôle n'est pas révélé, crâne et silence suivent.
// La partie simulée elle-même (monde, jouerPartie, invariants) vit dans essais/outils/partie-loups.mjs (Le Pacte, étape 6), que le
// simulateur d'équilibre réutilise sans les vérifications ; ici, chaque partie les fait toutes (verifier, par défaut).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calme, erreurs, envoyerAuMJ, emissions, messages, reglages, FR } from "./doublures/foundry-loups.mjs";
import {
  api, outil, monde, jouerPartie, villageois, roleDe, metierDe, secretsEmis, sansHTML, verifierTexte, verifierSecrets, verifierPlateau,
  verifierSavoirDesCompagnons, couverture, couvert, gestesFaits, victoireDuGeste, EQUILIBRE, ROLES, joueursSimules, compagnons
} from "./outils/partie-loups.mjs";
const { creerHasard, choisir, POUVOIRS_JOUR, ROLES_DE_PASSAGE, CLES_DE_FETE } = await import("../systems/lakour-loups/logique/index.mjs");
const { contexteCompagnon } = await import("../modules/lakour-mj-ia/scripts/compagnons.js");

// ------------------------------------------------------------------ les parties
const TAILLES = [6, 8, 10, 13, 15, 18];
const NIVEAUX = ["debutants", "classique", "chaos"];
const GRAINES = ["brume", "lanterne", "cendres", "moulin", "chapelle"];
const bilan = [];

for (const niveau of NIVEAUX) {
  test(`parties complètes, niveau ${niveau} : ${TAILLES.join(", ")} joueurs × ${GRAINES.length} graines, jusqu'à la victoire`, async () => {
    for (const n of TAILLES) for (const graine of GRAINES) bilan.push({ niveau, n, graine, ...await jouerPartie({ n, niveau, graine }) });
  });
}

// La Petite tablée (0.11.0) : 2 à 4 humains simulés et des compagnons IA (repli sans IA), au moins 45 parties par configuration,
// jusqu'à la victoire ; l'équilibre mesuré (part des victoires de la meute par configuration). Les joueurs simulés votent au
// hasard sauf un loup lu dans les cendres ou démasqué : une mesure MÉCANIQUE, plus sévère pour le village que de vrais joueurs.
// (TABLEE_CONFIG='{"h":4,"ia":8}' et TABLEE_GRAINES=15,16 : rejouer une configuration ou une graine seules, avec TRACE_LOUPS.)
// Les deux dernières : les compositions PRÊTES du contenu (petite-tablee-06, -08), mesurées comme les générées.
const TABLEES = process.env.TABLEE_CONFIG ? [JSON.parse(process.env.TABLEE_CONFIG)] : [{ h: 2, ia: 2 }, { h: 2, ia: 4 }, { h: 3, ia: 5 }, { h: 3, ia: 7 }, { h: 4, ia: 8 },
  { h: 2, ia: 4, compo: "petite-tablee-06" }, { h: 3, ia: 5, compo: "petite-tablee-08" }];
const PARTIES_PAR_TABLEE = 45;
const GRAINES_TABLEE = process.env.TABLEE_GRAINES ? process.env.TABLEE_GRAINES.split(",").map(Number) : Array.from({ length: PARTIES_PAR_TABLEE }, (_, i) => i);
const bilanTablee = [];
test(`petite tablée : parties complètes, ${TABLEES.map(c => `${c.h} humains + ${c.ia} IA`).join(", ")} × ${PARTIES_PAR_TABLEE} graines ; équilibre mesuré`, async () => {
  for (const c of TABLEES) for (const i of GRAINES_TABLEE) {
    const graine = `tablee-${i}`;
    bilanTablee.push({ ...c, graine, ...await jouerPartie({ n: c.h, niveau: "petite-tablee", graine: `${graine}-h${c.h}-ia${c.ia}${c.compo ? "-prete" : ""}`, nbCompagnons: c.ia, tablee: true, composition: c.compo ?? "" }) });
  }
  const part = l => l.filter(b => b.camp === "meute").length / l.length;
  const parCamp = l => { const x = {}; for (const b of l) x[b.camp] = (x[b.camp] ?? 0) + 1; return JSON.stringify(x); };
  const tours = l => (l.reduce((x, b) => x + b.tours, 0) / l.length).toFixed(1);
  console.log(`Petite tablée : ${bilanTablee.length} parties ; vainqueurs ${parCamp(bilanTablee)} ; meute ${Math.round(part(bilanTablee) * 100)} % ; ${tours(bilanTablee)} tours`);
  for (const c of TABLEES) {
    const l = bilanTablee.filter(b => b.h === c.h && b.ia === c.ia && (b.compo ?? "") === (c.compo ?? ""));
    console.log(`  ${c.h} humains + ${c.ia} IA (${c.h + c.ia} places${c.compo ? `, composition prête ${c.compo}` : ""}) : ${parCamp(l)} ; meute ${Math.round(part(l) * 100)} % ; ${tours(l)} tours`);
    assert.ok(part(l) >= 0.3 && part(l) <= 0.72, `${c.h} humains + ${c.ia} IA${c.compo ? ` (${c.compo})` : ""} : meute ${Math.round(part(l) * 100)} %, hors de la fourchette`);
  }
  assert.ok(part(bilanTablee) >= 0.38 && part(bilanTablee) <= 0.67, `petite tablée : meute ${Math.round(part(bilanTablee) * 100)} % en tout`);
  for (const effet of ["tablée : le sort tranche", "tablée : humain de l'ombre", "compagnons : répliques au débat"]) assert.ok(couverture.get(effet) > 0, `jamais exercé : ${effet}`);
  // Reproductible.
  const encore = await jouerPartie({ n: 3, niveau: "petite-tablee", graine: "tablee-0-h3-ia5", nbCompagnons: 5, tablee: true });
  const premiere = bilanTablee.find(b => b.h === 3 && b.ia === 5 && !b.compo && b.graine === "tablee-0");
  assert.deepEqual({ vainqueur: encore.camp, tours: encore.tours }, { vainqueur: premiere.camp, tours: premiere.tours });
});

// 3 humains simulés et des compagnons IA (repli sans IA), jusqu'à la victoire.
const COMPAGNONS = [3, 6, 11];
const bilanCompagnons = [];
test(`parties complètes avec 3 humains et des compagnons IA (${COMPAGNONS.join(", ")}) × ${NIVEAUX.length} niveaux × ${GRAINES.length} graines`, async () => {
  for (const niveau of NIVEAUX) for (const nbCompagnons of COMPAGNONS) for (const graine of GRAINES) {
    bilanCompagnons.push({ niveau, nbCompagnons, graine, ...await jouerPartie({ n: 3, niveau, graine: `${graine}-c${nbCompagnons}`, nbCompagnons }) });
  }
  const parCamp = {};
  for (const b of bilanCompagnons) parCamp[b.camp] = (parCamp[b.camp] ?? 0) + 1;
  console.log(`Avec compagnons : ${bilanCompagnons.length} parties ; vainqueurs ${JSON.stringify(parCamp)}`);
  for (const effet of ["compagnons : choix de nuit", "compagnons : répliques au débat", "compagnons : voix"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé : ${effet}`);
  }
  // Reproductible : même graine, même partie, compagnons compris.
  const encore = await jouerPartie({ n: 3, niveau: "classique", graine: "brume-c6", nbCompagnons: 6 });
  const premiere = bilanCompagnons.find(b => b.niveau === "classique" && b.nbCompagnons === 6 && b.graine === "brume");
  assert.deepEqual({ vainqueur: encore.camp, tours: encore.tours }, { vainqueur: premiere.camp, tours: premiere.tours });
});

test("bilan des parties (reproductibles : même graine, même partie) ; chaque pouvoir de jour et chaque bâtiment a servi", async () => {
  assert.equal(bilan.length, TAILLES.length * NIVEAUX.length * GRAINES.length);
  const parCamp = {};
  for (const b of bilan) parCamp[b.camp] = (parCamp[b.camp] ?? 0) + 1;
  const moyenne = (bilan.reduce((s, b) => s + b.tours, 0) / bilan.length).toFixed(1);
  if (process.env.TRACE_LOUPS) for (const b of bilan) console.log(JSON.stringify(b));
  console.log(`Bilan : ${bilan.length} parties ; vainqueurs ${JSON.stringify(parCamp)} ; ${moyenne} tours en moyenne`);
  for (const niveau of NIVEAUX) {
    const l = bilan.filter(b => b.niveau === niveau);
    const c = {};
    for (const b of l) c[b.camp] = (c[b.camp] ?? 0) + 1;
    console.log(`  ${niveau} : ${JSON.stringify(c)} ; ${(l.reduce((s, b) => s + b.tours, 0) / l.length).toFixed(1)} tours`);
  }
  console.log(`  couverture : ${JSON.stringify(Object.fromEntries([...couverture].sort()))}`);
  // Les parties simulées exercent vraiment les métiers de jour, les rôles de jour et les bâtiments.
  // (les Gens de passage n'entrent qu'en cours de partie : leurs pouvoirs sont éprouvés à part, essais/lot3-*.test.mjs ; le signe du
  // Greffier bègue se fait pendant le vote, que les joueurs simulés ne jouent pas : essais/pacte-village-api.test.mjs ; les pouvoirs des
  // personnalités, source « tenure », ne vivent que dans la variante « Le Village », que ces parties ne jouent pas :
  // essais/pacte-personnalites-api.test.mjs et la partie « le-village » de essais/non-fuite.test.mjs ; le pouvoir d'une charge, source
  // « charge » — le Bailli qui révoque le Crieur public —, ne vit qu'avec le Crieur : essais/gazette-api.test.mjs)
  for (const pouvoir of Object.keys(POUVOIRS_JOUR).filter(p => !ROLES_DE_PASSAGE.includes(p) && p !== "greffier-begue" && !["tenure", "charge"].includes(POUVOIRS_JOUR[p].source))) assert.ok(couverture.get(pouvoir) > 0, `pouvoir de jour jamais utilisé : ${pouvoir}`);
  for (const effet of ["mot du Messager remis", "ruban (prolongation)", "juge (revote)", "chapelle (vote)", "hors d'atteinte (nuit)", "Moulin (public)",
    "Moulin (Meunière)", "Lavoir", "Cimetière", "Forge (sang de bête)", "Pont (meute bloquée)", "verrou (attaque arrêtée)"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé dans les parties simulées : ${effet}`);
  }
  const encore = await jouerPartie({ n: 10, niveau: "chaos", graine: "brume" });
  const premiere = bilan.find(b => b.niveau === "chaos" && b.n === 10 && b.graine === "brume");
  assert.deepEqual({ vainqueur: encore.camp, tours: encore.tours }, { vainqueur: premiere.camp, tours: premiere.tours });
});

// ------------------------------------------------------------------ les veillées de fête (0.10.0)
// Les mêmes parties complètes, menées par les outils du MJ IA, avec chaque veillée de fête : elles vont au bout sans erreur ni fuite,
// et leurs effets sont exercés. La part des victoires de la meute est comparée à celle des parties ordinaires, mais les joueurs
// simulés votent et choisissent au hasard : cette comparaison ne mesure que les effets MÉCANIQUES (le présent qui sauve, la neige
// qui grise des pouvoirs). Elle ne dit RIEN de l'équilibre des veillées d'information (murmure des âmes, masque, défilé, promis),
// qui tient à ce que des joueurs font de leurs secrets : celles-là ne sont pas mesurées ici.
const TAILLES_FETE = [6, 10, 15];
const bilanFetes = [];
test(`parties complètes avec chaque veillée de fête (${TAILLES_FETE.join(", ")} joueurs × ${NIVEAUX.length} niveaux × ${GRAINES.length} graines) ; équilibre MÉCANIQUE seulement (joueurs au hasard)`, async () => {
  const ordinaires = [];
  for (const niveau of NIVEAUX) for (const n of TAILLES_FETE) for (const graine of GRAINES) {
    ordinaires.push(bilan.find(b => b.niveau === niveau && b.n === n && b.graine === graine) ?? { niveau, n, graine, ...await jouerPartie({ n, niveau, graine }) });
  }
  const part = l => l.filter(b => b.camp === "meute").length / l.length;
  const tours = l => (l.reduce((x, b) => x + b.tours, 0) / l.length).toFixed(1);
  const parCamp = l => { const c = {}; for (const b of l) c[b.camp] = (c[b.camp] ?? 0) + 1; return JSON.stringify(c); };
  console.log(`Veillées de fête — ordinaires : ${parCamp(ordinaires)} ; ${tours(ordinaires)} tours`);
  for (const fete of CLES_DE_FETE) {
    const l = [];
    for (const niveau of NIVEAUX) for (const n of TAILLES_FETE) for (const graine of GRAINES) l.push({ fete, niveau, n, graine, ...await jouerPartie({ n, niveau, graine, fete }) });
    bilanFetes.push(...l);
    console.log(`  ${fete} : ${parCamp(l)} ; ${tours(l)} tours ; meute ${Math.round(part(l) * 100)} % (ordinaires : ${Math.round(part(ordinaires) * 100)} %)${["veillee-d-hiver"].includes(fete) ? "" : " — veillée d'information : non mesurée par des joueurs au hasard"}`);
    assert.ok(Math.abs(part(l) - part(ordinaires)) <= 0.2, `${fete} : ses effets mécaniques déséquilibrent la partie : meute ${part(l)} contre ${part(ordinaires)}`);
  }
  for (const effet of ["fête : neige", "fête : présent", "fête : présent ouvert", "fête : murmure des âmes", "fête : défilé", "fête : masque", "fête : promis"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé : ${effet}`);
  }
});

// ------------------------------------------------------------------ bogues trouvés par l'intégration (essais ciblés)
const acteurDuRole = cle => villageois().find(a => roleDe(a)?.system.cle === cle);
async function preparer(n, composition, graine = "cible") {
  monde(n, graine);
  const r = await outil("loups_distribuer").executer({ joueurs: [], composition, niveau: "" });
  assert.ok(!r.erreur, r.contenu);
  return r.contenu;
}
// La plus petite composition prête du niveau le plus simple (débutants, puis classique, puis chaos) qui a ce rôle : depuis l'étape 6 du Pacte, elles sortent du générateur
// (à graine fixe), et un essai qui veut un rôle le cherche. -> [n, clé]
const COMPOSITIONS = JSON.parse(readFileSync(new URL("../modules/lakour-veillees/assets/compositions.json", import.meta.url), "utf8"));
function preteAvec(role) {
  const [cle, c] = Object.entries(COMPOSITIONS).filter(([, c]) => ["debutants", "classique", "chaos"].includes(c.niveau) && c.roles.includes(role))
    .sort((a, b) => NIVEAUX.indexOf(a[1].niveau) - NIVEAUX.indexOf(b[1].niveau) || a[1].joueurs[0] - b[1].joueurs[0])[0] ?? [];
  assert.ok(cle, `aucune composition prête avec « ${role} »`);
  return [c.joueurs[0], cle];
}
const demandesDe = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id);

test("loups_distribuer, 18 joueurs : un métier pour chacun (12 métiers), rôles et bâtiments nommés, pas de clés", async () => {
  const texte = await preparer(18, "classique-18");
  for (const a of villageois()) assert.equal(a.items.filter(i => i.type === "metier").length, 1, `${a.name} sans métier`);
  verifierTexte(texte, "loups_distribuer");
  assert.match(texte, /: Loup de Brumecombe/);
  assert.match(texte, /Bâtiments en jeu : La Chapelle, Le Moulin, La Taverne, Le Puits, Le Cimetière, Le Gibet\./);
  assert.deepEqual(api.etat().batimentsCles, ["chapelle", "moulin", "taverne", "puits", "cimetiere", "gibet"]);
});

test("loups_nuit : la meute chasse avec l'invite des loups, même si la Louve mère est la première de la meute ; la Louve ne mord que la proie", async () => {
  // Depuis l'étape 6b du Pacte, la Louve mère (poids -13) ne sort plus d'aucune composition prête : une composition choisie.
  monde(10, "cible");
  const r = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "chaos", composition: "", batiments: [], inclure: [], exclure: [],
    roles: ["louve-mere", "loup-de-brumecombe", "loup-de-brumecombe", "liseuse-de-cendres", "herboriste"] });
  assert.ok(!r.erreur, r.contenu);
  const premier = api.ordreDeNuit().find(e => e.roleCle === "meute").acteurIds[0];
  const louve = acteurDuRole("louve-mere");
  if (louve.id !== premier) await api.echangerRoles(premier, louve.id);   // entre deux loups : les camps ne bougent pas
  assert.equal(roleDe(game.actors.get(premier)).system.cle, "louve-mere");
  const loups = villageois().filter(a => secretDuMJ.camp(a) === "meute");
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const meute = api.etat().nuitPrecedente.actions.find(x => x.roleCle === "meute");
  for (const l of loups) {
    const [chasse] = demandesDe(l, depuis);
    assert.equal(chasse.invite, ROLES["loup-de-brumecombe"].system.nuit.invite, `${l.name} (${roleDe(l).system.cle})`);
  }
  const [, morsure] = demandesDe(game.actors.get(premier), depuis);
  assert.equal(morsure.invite, ROLES["louve-mere"].system.nuit.invite);
  assert.deepEqual(morsure.candidats.map(c => c.id), meute.cibles);
});

test("loups_nuit : l'Herboriste apprend qui la meute a attaqué", async () => {
  await preparer(...preteAvec("herboriste"));
  const herboriste = acteurDuRole("herboriste");
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const proie = api.etat().nuitPrecedente.actions.find(x => x.roleCle === "meute").cibles[0];
  const [d] = demandesDe(herboriste, depuis);
  assert.ok(d.invite.startsWith(`Cette nuit, la meute a attaqué ${game.actors.get(proie).name}. `), d.invite);
  assert.ok(d.invite.endsWith(ROLES.herboriste.system.nuit.invite));
});

test("loups_nuit : le Fossoyeur interroge les tombes (les morts), pas les vivants ; il l'apprend dans son carnet secret", async () => {
  await preparer(...preteAvec("fossoyeur"));
  const fossoyeur = acteurDuRole("fossoyeur");
  const mort = villageois().find(a => a.id !== fossoyeur.id && secretDuMJ.camp(a) !== "meute");
  await api.eliminer(mort.id, { cause: "narrateur", reveler: false });
  const depuis = emissions.length;
  await outil("loups_nuit").executer({ delai_secondes: 20 });
  const [d] = demandesDe(fossoyeur, depuis);
  assert.deepEqual(d.candidats.map(c => c.id), [mort.id]);
  const appris = secretsEmis(depuis).find(e => e.recipients[0] === fossoyeur.system.joueur && /était :/.test(e.entree.texte));
  assert.ok(appris?.entree.texte.includes(`${mort.name} était : ${roleDe(mort).name}`), "il apprend le rôle du mort");
  assert.ok(!messages.some(m => m.whisper?.length), "rien au chat");
});

test("loups_nuit : le Messager fait écrire l'expéditeur, le destinataire seul reçoit le mot ; rien ne fuit", async () => {
  // Le hasard du système (qui la meute dévore, l'Enfant surprise, le Pyromane…) tiré d'une graine : l'essai rejoue toujours la même partie (il échouait
  // une fois sur deux : un Messager dévoré la nuit même de son mot était compté comme n'ayant rien porté).
  const hasardOrigine = Math.random;
  Math.random = creerHasard("messager-monde");
  try { await essaiDuMessager(); } finally { Math.random = hasardOrigine; }
});
async function essaiDuMessager() {
  await preparer(...preteAvec("messager"));
  // Un Messager à coup sûr : celui de la composition, sinon le premier villageois sans pouvoir de nuit le devient.
  let messager = acteurDuRole("messager");
  if (!messager) {
    messager = villageois().find(a => secretDuMJ.camp(a) === "village" && !roleDe(a).system.nuit.actif);
    await messager.deleteEmbeddedDocuments("Item", [roleDe(messager).id]);
    await messager.createEmbeddedDocuments("Item", [{ ...structuredClone(ROLES.messager), _id: undefined }]);
  }
  let depuis = 0;
  for (let nuit = 0; nuit < 4; nuit++) {
    depuis = emissions.length;
    await outil("loups_nuit").executer({ delai_secondes: 20 });
    if (api.etat().vainqueur) break;
    const porte = api.etat().nuitPrecedente.actions.find(x => x.acteurId === messager.id && x.texte);
    // (Un Messager dévoré cette nuit-là a porté son mot quand même : un mort de la nuit agit encore cette nuit.)
    if (!porte) continue;
    const [exp, dest] = porte.cibles;
    const demande = emissions.slice(depuis).find(e => e.type === "demande" && e.mode === "texte");
    assert.deepEqual(demande.recipients, [game.actors.get(exp).system.joueur], "seul l'expéditeur écrit");
    const mot = secretsEmis(depuis).find(e => e.entree.texte.includes(porte.texte));
    assert.deepEqual(mot.recipients, [game.actors.get(dest).system.joueur], "seul le destinataire lit");
    assert.ok(!JSON.stringify(reglages.get("lakour-loups.partie").valeur).includes(porte.texte), "le mot n'est pas dans l'état public");
    assert.ok(!emissions.filter(e => e.type === "hook").some(e => JSON.stringify(e.args).includes(porte.texte)), "ni dans ce qui est diffusé");
    verifierSecrets("messager");
    await calme();   // les joueurs simulés finissent de réagir à l'aube avant l'essai suivant (identifiants réutilisés)
    return;
  }
  assert.fail("le Messager n'a porté aucun mot en quatre nuits");
}

test("loups_vote sous le Gibet : sans majorité absolue, le texte le dit (ni « égalité » ni « aucun vote »)", async () => {
  await calme();   // rien de l'essai précédent ne doit arriver dans ce monde-ci
  monde(12, "gibet", { simules: false });
  await outil("loups_distribuer").executer({ joueurs: [], composition: "classique-12", niveau: "" });
  await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false });
  assert.equal(api.etat().vote.majoriteAbsolue, true);
  const [a, b, ...autres] = villageois();
  for (const x of autres.slice(0, 4)) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: a.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  for (const x of autres.slice(4, 6)) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: b.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  assert.deepEqual(reglages.get("lakour-loups.partie").valeur.vote.votes, {}, "les voix restent secrètes jusqu'à la clôture");
  assert.equal(reglages.get("lakour-loups.partie").valeur.vote.exprimes.length, 6, "on sait seulement qui a voté");
  const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false });
  assert.match(clos.contenu, new RegExp(`${a.name} : 4, ${b.name} : 2\\. Pas de majorité absolue \\(le Gibet l'exige\\) : personne n'est désigné\\.`));
  // Le moteur 27e7559 : clore un vote déjà clos (son minuteur, un vote à tour de rôle fini) rend son résultat, sans erreur ni recompte.
  const numero = api.etat().vote.numero;
  const encore = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false });
  assert.ok(!encore.erreur, encore.contenu);
  assert.equal(encore.contenu, clos.contenu, "le même résultat");
  assert.equal(api.etat().vote.numero, numero, "aucun vote de plus");
});

// Le moteur 27e7559 (Le Pacte) : la Braconnière choisit ELLE-MÊME qui elle emporte (le système lui fait une demande posthume, les
// derniers gestes) ; le narrateur ne le lui demande plus et n'emporte personne à sa place. Avant, il était prié de « demander qui ».
test("loups_eliminer : la Braconnière condamnée par le vote choisit elle-même qui elle emporte ; le narrateur ne tue pas un mort", async () => {
  await preparer(...preteAvec("braconniere"));
  const braconniere = acteurDuRole("braconniere");
  const vivantsAvant = new Set(villageois().filter(a => a.system.vivant && a.id !== braconniere.id).map(a => a.id));
  const r = await outil("loups_eliminer").executer({ villageois: braconniere.name, cause: "vote", reveler: true });
  verifierTexte(r.contenu, "loups_eliminer");
  assert.match(r.contenu, new RegExp(`${braconniere.name} choisit lui-même qui il emporte dans la tombe \\(une demande lui est faite\\) : ne le lui demande pas et n'emporte personne à sa place\\.`));
  assert.doesNotMatch(r.contenu, /demande-lui qui/);
  assert.ok(api.derniersGestes().some(g => g.acteurId === braconniere.id && g.geste === "emporter" && g.demande), "la demande posthume est faite");
  // Son joueur (simulé) répond : sa cible tombe, cause « emporte », sans outil du narrateur ; s'il passe, le geste reste au MJ (sans
  // demande en cours : le narrateur ne l'applique que si le joueur le dit tout haut).
  await gestesFaits();
  const emportes = villageois().filter(a => vivantsAvant.has(a.id) && !a.system.vivant);
  assert.ok(emportes.length <= 1, "une seule personne emportée");
  if (emportes.length) assert.deepEqual(api.derniersGestes(), [], "son geste est fait");
  else assert.deepEqual(api.derniersGestes().map(g => [g.acteurId, g.geste, g.demande]), [[braconniere.id, "emporter", false]], "il a passé : au MJ");
  // Un narrateur qui l'emporterait quand même (ou qui élimine un mort) : le système l'a déjà fait tomber, personne d'autre ne meurt.
  const vivants = villageois().filter(a => a.system.vivant).length;
  for (const mort of [braconniere, ...emportes]) {
    const r2 = await outil("loups_eliminer").executer({ villageois: mort.name, cause: "emporte", reveler: true });
    assert.ok(!r2.erreur, r2.contenu);
    assert.match(r2.contenu, new RegExp(`^${mort.name} est déjà mort \\(le système l'a fait tomber\\) : n'élimine personne d'autre`));
    assert.equal(villageois().filter(a => a.system.vivant).length, vivants, "personne d'autre ne meurt");
  }
});

// Le moteur 27e7559 (Le Pacte) : les compagnons sans modèle décident par les politiques du système et leur vue contient le jeu de
// soirée (le Village, les traits, les cartes du Bateleur, les deux groupes de l'Illuminé, la Gazette, le Crieur). Sur les VRAIES
// données (vrai système, vrai contenu, vrai moteur) : ce qu'on enverrait à leur modèle ne contient aucune clé brute ni aucun
// identifiant (verifierTexte), aucun secret qu'ils ignorent (verifierSavoirDesCompagnons), à chaque pas d'un jour et d'une nuit. Et la
// distribution du jeu de soirée : avec le Chapardeur, le système reçoit n + 2 cartes (deux au centre) ; « le-pacte » n'a aucun métier.
const ROLES_DU_PACTE_AVEC_COMPAGNONS = ["loup-de-brumecombe", "loup-de-brumecombe", "loup-de-brumecombe", "bateleur", "illumine", "chapardeur",
  "liseuse-de-cendres", "herboriste", "pie", "aieul"];
const gazettesVues = [];
for (const graine of ["pacte-compagnons-1", "pacte-compagnons-2", "pacte-compagnons-3"]) {
  test(`le Pacte avec des compagnons IA (${graine}) : Village, traits, Bateleur, Illuminé, Gazette dans leur vue, sans clé brute ni secret ; n + 2 cartes, aucun métier`, async () => {
    // Reproductible : le hasard du monde (distribution, nuit, Gazette…) tiré de la graine, comme dans jouerPartie.
    const hasardOrigine = Math.random;
    Math.random = creerHasard(`${graine}-monde`);
    try { await partieDuPacte(graine); } finally { Math.random = hasardOrigine; }
  });
}
// Les compositions prêtes du jeu de soirée qui ont le Chapardeur (n cartes au contenu) : le paquet a n + 2 cartes, deux au centre.
test("loups_distribuer, compositions prêtes du Pacte avec le Chapardeur : n + 2 cartes (deux au centre), aucun métier, rien de brut", async () => {
  for (const [cle, c] of Object.entries(COMPOSITIONS).filter(([, c]) => c.niveau === "le-pacte" && c.roles.includes("chapardeur"))) {
    const n = c.joueurs[0];
    const texte = await preparer(n, cle);
    verifierTexte(texte, `loups_distribuer ${cle}`);
    verifierSecrets(`loups_distribuer ${cle}`);
    assert.equal(villageois().length, n);
    const centre = api.etat().ambigusSecret.centre.map(x => x.system.cle);
    assert.equal(centre.length, 2, `${cle} : le centre du Chapardeur`);
    assert.deepEqual([...villageois().map(a => roleDe(a).system.cle), ...centre].filter(x => x !== "villageois").sort(), c.roles.filter(x => x !== "villageois").sort(), `${cle} : la composition entière`);
    for (const a of villageois()) assert.equal(a.items.filter(i => i.type === "metier").length, 0, `${cle} : ${a.name} a un métier au jeu de soirée`);
  }
});
test("le Pacte avec des compagnons IA : une carte de la Gazette en cours est passée dans leur vue", () => {
  assert.ok(gazettesVues.some(Boolean), `jamais : ${JSON.stringify(gazettesVues)}`);
});
async function partieDuPacte(graine) {
  {
    monde(4, graine);
    const nbCompagnons = 6, total = 10;
    const r = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "le-pacte", composition: "", batiments: [], inclure: [], exclure: [],
      roles: ROLES_DU_PACTE_AVEC_COMPAGNONS, compagnons: nbCompagnons, village: "oui", gazette: "oui-crieur", variantes: ["mur"] });
    assert.ok(!r.erreur, r.contenu);
    verifierTexte(r.contenu, "loups_distribuer");
    verifierSecrets("loups_distribuer");
    assert.match(r.contenu, /\(10 joueurs, dont 6 compagnons IA\)/);
    // n + 2 cartes : dix places, deux cartes au centre (des Villageois ajoutés si la liste n'en a pas assez), toutes de la composition.
    assert.equal(villageois().length, total);
    const centre = api.etat().ambigusSecret.centre.map(x => x.system.cle);
    assert.equal(centre.length, 2, "le centre du Chapardeur");
    const distribues = [...villageois().map(a => roleDe(a).system.cle), ...centre];
    for (const cle of ROLES_DU_PACTE_AVEC_COMPAGNONS) assert.ok(distribues.includes(cle), `${cle} au paquet`);
    assert.equal(distribues.length, total + 2);
    // Le jeu de soirée : ni métier, ni bâtiment communal.
    for (const a of villageois()) assert.equal(a.items.filter(i => i.type === "metier").length, 0, `${a.name} a un métier au jeu de soirée`);
    assert.match(r.contenu, /Bâtiments en jeu : aucun\./);
    assert.ok(api.village().actif, "la variante « Le Village »");
    assert.ok(api.gazette().actif && api.gazette().crieur.actif, "la Gazette et son Crieur");
    const lesCompagnons = villageois().filter(a => a.system.compagnon);
    assert.equal(lesCompagnons.length, nbCompagnons);
    // Ce qu'on enverrait au modèle de chacun : la vue du jeu de soirée, et rien de brut.
    const verifierLesVues = ou => {
      verifierSavoirDesCompagnons(ou);
      for (const a of lesCompagnons) {
        const { systeme, texte } = contexteCompagnon(compagnons.vue(a));
        verifierTexte(`${systeme}\n${texte}`, `${ou}, vue de ${a.name}`);
      }
    };
    const scene = contexteCompagnon(compagnons.vue(lesCompagnons[0])).texte;
    assert.match(scene, /Le Village \(public\) : /);
    assert.match(scene, /Traits visibles \(publics\) : /);
    // (Les cartes du Bateleur et les deux bords de l'Illuminé dits comme le chat les annonce, sans nommer ces rôles : la composition
    // ne s'annonce pas — le moteur nommait les deux rôles, verifierSavoirDesCompagnons l'a vu ; corrigé dans le moteur.)
    assert.match(scene, /Le village est partagé en deux bords \(annoncé\) : .+ \| .+\./);
    if (api.ambigus().bateleur.length) assert.match(scene, /Cartes posées face visible au milieu de la table \(une nuit, quelqu'un pourra jouer l'une d'elles\) : /);
    assert.match(scene, /Variantes de la veillée \(publiques\) : le Mur des murmures/);
    verifierLesVues("distribution");
    // Jusqu'à quatre jours : la nuit, l'aube (la Gazette du matin, le Crieur), le débat (annonces et pouvoirs de jour des compagnons),
    // le vote (un second vote ouvert de lui-même compris), les exécutions ; la vue repassée au crible à chaque pas.
    let gazetteVue = false;
    const fini = () => Boolean(api.etat().vainqueur);
    for (let jour = 1; jour <= 4 && !fini(); jour++) {
      const nuit = await outil("loups_nuit").executer({ delai_secondes: 20, peste_victime: "" });
      assert.ok(!nuit.erreur, nuit.contenu);
      await gestesFaits();
      verifierTexte(nuit.contenu, "loups_nuit");
      verifierSecrets("loups_nuit");
      verifierLesVues(`nuit ${jour}`);
      if (fini()) break;
      if (api.gazette().enCours?.length) {
        assert.match(contexteCompagnon(compagnons.vue(lesCompagnons[0])).texte, /Gazette de la lune, cartes en cours : /);
        gazetteVue = true;
      }
      await calme();
      const dits = await compagnons.debattre({ max: 4 });
      for (const d of dits) verifierTexte(d.texte, `réplique de ${d.nom}`);
      await gestesFaits();
      verifierSecrets("débat");
      verifierLesVues(`débat ${jour}`);
      if (fini()) break;
      if (!api.etat().vote.ouvert) {
        const ouvert = await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
        if (ouvert.erreur) { assert.match(ouvert.contenu, /pas de vote/i, ouvert.contenu); continue; }   // la Crue de la Gazette
        verifierTexte(ouvert.contenu, "loups_vote");
      }
      // Le vote, puis un second vote ouvert de lui-même (le Greffier, le Dépit, l'Enthousiasme) : clos et exécuté avant la nuit.
      for (let n = 0; n < 4 && api.etat().vote.ouvert && !fini(); n++) {
        await calme();
        const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
        assert.ok(!clos.erreur, clos.contenu);
        verifierTexte(clos.contenu, "loups_vote");
        await gestesFaits();
        if (api.etat().vote.ouvert) continue;   // le ruban de la Tisserande, le Juge de paix
        const designes = /Désignés? : (.+) \(loups_eliminer pour chacun\)/.exec(clos.contenu)?.[1].split(" et ") ?? [];
        for (const nom of designes) {
          const r2 = await outil("loups_eliminer").executer({ villageois: nom, cause: "vote", reveler: true });
          assert.ok(!r2.erreur, r2.contenu);
          verifierTexte(r2.contenu, "loups_eliminer");
          await gestesFaits();
          if (fini()) break;
        }
        verifierSecrets("vote");
        verifierLesVues(`vote ${jour}`);
      }
    }
    gazettesVues.push(gazetteVue);
    if (process.env.TRACE_LOUPS) console.log(`${graine} : ${api.etat().tour} tours, vainqueur ${api.etat().vainqueur || "aucun"}, Gazette en cours vue : ${gazetteVue}`);
    // Sans modèle, les compagnons ont décidé par les politiques du système (source « politique »), pas par le repli d'avant seulement.
    assert.ok(compagnons.cerveaux.journal.some(x => x.operation === "decider" && x.source === "politique"), "aucune décision par les politiques");
  }
}

test("loups_effet : protéger, faire taire, changer de camp, échanger les rôles (cartes remises aux deux seuls joueurs)", async () => {
  await preparer(8, "classique-08");
  const [a, b] = villageois();
  const ra = roleDe(a).name, rb = roleDe(b).name;
  const effet = async (nom, cibles, camp = "") => {
    const r = await outil("loups_effet").executer({ effet: nom, cibles, camp });
    assert.ok(!r.erreur, r.contenu);
    verifierTexte(r.contenu, "loups_effet");
    return r.contenu;
  };
  assert.match(await effet("proteger", [a.name]), new RegExp(`« proteger » appliqué à ${a.name}`));
  assert.equal(secretDuMJ.protections(a), 1);
  await effet("silence", [b.name]);
  assert.equal(b.system.silence, true);
  await effet("changer_camp", [a.name], "solitaire");
  assert.equal(secretDuMJ.camp(a), "solitaire");
  const depuis = emissions.length;
  assert.match(await effet("echanger_roles", [a.name, b.name]), new RegExp(`appliqué à ${a.name} et ${b.name}`));
  assert.deepEqual([roleDe(a).name, roleDe(b).name], [rb, ra]);
  const cartes = secretsEmis(depuis).filter(e => e.entree.html?.startsWith("<carte"));
  assert.deepEqual(cartes.map(e => e.recipients), [[a.system.joueur], [b.system.joueur]]);
  assert.ok((await outil("loups_effet").executer({ effet: "proteger", cibles: ["Personne"], camp: "" })).erreur);
});

test("loups_jour : lister puis utiliser un métier ; refus clair hors du moment ; le Juge de paix fait revoter et loups_eliminer attend", async () => {
  monde(8, "jour", { simules: false });
  await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: ["Loup de Brumecombe", "Loup de Brumecombe", "Juge de paix", "Liseuse de cendres"], batiments: ["chapelle", "taverne", "forge"], inclure: [], exclure: [], composition: "" });
  const forgeron = villageois().find(a => metierDe(a).system.cle === "forgeron");
  const juge = acteurDuRole("juge-de-paix");
  assert.match((await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "Forgeron", cibles: [forgeron.name], texte: "" })).contenu,
    /refusé — Ce n'est pas le moment/);
  await api.changerPhase("jour");
  const liste = await outil("loups_jour").executer({ action: "lister", villageois: "", pouvoir: "", cibles: [], texte: "" });
  verifierTexte(liste.contenu, "loups_jour");
  assert.match(liste.contenu, new RegExp(`${forgeron.name} : Forgeron — désigne 1`));
  assert.match(liste.contenu, /Le village : La Chapelle/);
  const r = await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "forgeron", cibles: [juge.name], texte: "" });
  assert.ok(!r.erreur, r.contenu);
  assert.match(r.contenu, new RegExp(`forge un verrou pour la maison de ${juge.name}`));
  assert.equal(metierDe(forgeron).system.usages.restant, 0);
  assert.ok((await outil("loups_jour").executer({ action: "utiliser", villageois: forgeron.name, pouvoir: "Forgeron", cibles: [juge.name], texte: "" })).erreur, "une fois par partie");
  // Le premier jour, sans Bailli, le MJ IA refuse le vote d'exécution tant que l'élection est due (système 0.6.0) : le village
  // élit d'abord son Bailli, au débat (ici le forgeron, à l'unanimité).
  assert.ok((await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false })).erreur, "l'élection d'abord");
  const election = await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "bailli" });
  assert.ok(!election.erreur, election.contenu);
  for (const x of villageois()) await envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: forgeron.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  assert.match((await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false })).contenu, new RegExp(`${forgeron.name} est le nouveau Bailli`));
  // Le vote : le Juge de paix annule juste après le dépouillement.
  await outil("loups_vote").executer({ action: "ouvrir", candidats: [], duree_secondes: 0, double: false });
  const cible = villageois().find(a => a.id !== juge.id);
  for (const x of villageois()) await envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: cible.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  const clos = await outil("loups_vote").executer({ action: "clore", candidats: [], duree_secondes: 0, double: false });
  assert.match(clos.contenu, /Juge de paix/, "le narrateur est prévenu");
  const annule = await outil("loups_jour").executer({ action: "utiliser", villageois: juge.name, pouvoir: "Juge de paix", cibles: [], texte: "" });
  assert.ok(!annule.erreur, annule.contenu);
  assert.equal(api.etat().vote.ouvert, true, "le village revote");
  assert.equal(juge.system.revele, true);
  assert.ok((await outil("loups_eliminer").executer({ villageois: cible.name, cause: "vote", reveler: true })).erreur, "pas d'exécution pendant le revote");
  assert.equal(cible.system.vivant, true);
  verifierSecrets("loups_jour");
});

// ------------------------------------------------------------------ composition choisie par l'IA ou par les joueurs
test("loups_composer : proposition équilibrée pour les joueurs connectés, annoncée par camps et noms, avec les clés à reprendre", async () => {
  monde(11, "compo");
  const r = await outil("loups_composer").executer({ nombre_joueurs: 0, niveau: "classique", inclure: ["Sonneur"], exclure: ["liseuse-de-cendres"] });
  assert.ok(!r.erreur, r.contenu);
  verifierTexte(r.contenu.split("\nClés")[0], "loups_composer");
  assert.match(r.contenu, /pour 11 joueurs \(classique, (équilibrée|favorable)/);
  assert.match(r.contenu, /Meute : .*Village : .*Sonneur/);
  assert.doesNotMatch(r.contenu.split("\nClés")[0], /Liseuse de cendres/);
  const cles = JSON.parse(/roles = (\[[^\]]*\])/.exec(r.contenu)[1]);
  assert.equal(cles.length, 11);
  assert.equal(villageois().length, 0, "rien n'est distribué");
  assert.match((await outil("loups_composer").executer({ nombre_joueurs: 8, niveau: "classique", inclure: ["Sorcière"], exclure: [] })).contenu, /Rôles inconnus : Sorcière/);
});

test("loups_distribuer mode roles : la liste choisie (noms ou clés), complétée de villageois ; trop de rôles refusés", async () => {
  monde(8, "choisie");
  const r = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: ["Loup de Brumecombe", "loup-de-brumecombe", "Liseuse de cendres", "Herboriste", "sonneur"], batiments: [], inclure: [], exclure: [], composition: "" });
  assert.ok(!r.erreur, r.contenu);
  const cles = villageois().map(a => roleDe(a).system.cle).sort();
  assert.deepEqual(cles, ["herboriste", "liseuse-de-cendres", "loup-de-brumecombe", "loup-de-brumecombe", "sonneur", "villageois", "villageois", "villageois"]);
  assert.equal(api.etat().composition, "choisie");
  assert.ok(api.etat().batiments.length >= 4, "bâtiments tirés selon le niveau");
  monde(6, "trop");
  const trop = await outil("loups_distribuer").executer({ joueurs: [], mode: "roles", niveau: "classique",
    roles: Array(7).fill("villageois"), batiments: [], inclure: [], exclure: [], composition: "" });
  assert.match(trop.contenu, /7 rôles pour 6 joueurs/);
});

test("loups_distribuer auto : rôles imposés et exclus respectés ; l'historique fait varier la partie suivante", async () => {
  monde(12, "auto");
  await outil("loups_distribuer").executer({ joueurs: [], mode: "auto", niveau: "classique", roles: [], batiments: [], inclure: ["Conteuse"], exclure: ["Garde du pont"], composition: "" });
  const premiere = villageois().map(a => roleDe(a).system.cle);
  assert.ok(premiere.includes("conteuse") && !premiere.includes("garde-du-pont"));
  // La composition en cours reste secrète (réglage monde livré à tous) : elle n'entre à l'historique qu'à la fin de la partie,
  // ou quand une nouvelle distribution l'abandonne.
  // (Une partie d'un essai précédent, abandonnée par cette distribution, a pu y entrer : on compte à partir d'ici.)
  const avant = game.settings.get("lakour-mj-ia", "historiqueLoups").length;
  const cle = h => [...h.roles].sort().join();
  assert.ok(!game.settings.get("lakour-mj-ia", "historiqueLoups").some(h => cle(h) === [...premiere].sort().join()),
    "la partie en cours n'est pas publiée");
  await outil("loups_distribuer").executer({ joueurs: [], mode: "auto", niveau: "classique", roles: [], batiments: [], inclure: [], exclure: [], composition: "" });
  const historique = game.settings.get("lakour-mj-ia", "historiqueLoups");
  assert.equal(historique.length, avant + 1, "la partie abandonnée est mémorisée");
  assert.deepEqual([...historique.at(-1).roles].sort(), [...premiere].sort());
});

// ------------------------------------------------------------------ la PESTE NOIRE, partie complète
// Une partie de peste noire (loups_distribuer, peste « oui ») menée par les outils du narrateur jusqu'à la fin : aucun rôle de la
// meute ; la première nuit, la peste frappe la victime du narrateur (peste_victime) ; ensuite, son porteur (la dernière victime,
// MORTE) la désigne par une demande secrète (posthume) — joueur simulé ou compagnon IA ; chaque victime meurt comme une proie de
// la meute (cause publique « nuit », même annonce) ; rien de la peste dans l'état public, les hooks, le socket ni le chat avant la
// fin (sauf l'annonce d'un cri) ; à la fin : extinction (vainqueur « peste ») ou cri juste (loups_peste : le village gagne).
const MORT_PUBLIQUE = new RegExp(FR.LAKOUR_LOUPS.Causes.nuit);
const CRI = /C'est la peste noire/;
async function jouerPeste({ n, graine, nbCompagnons = 0, crierAuJour = 0 }) {
  monde(n, graine);
  const hasardOrigine = Math.random;
  Math.random = creerHasard(`${graine}-monde`);
  const h = creerHasard(`${graine}-mj`);
  const textes = [];
  const appeler = async (nom, args) => {
    const r = await outil(nom).executer(args);
    await gestesFaits();   // une Braconnière tombée a choisi qui elle emporte (derniers gestes)
    textes.push(`${nom} ${JSON.stringify(args)}\n${r.contenu}`);
    assert.ok(!r.erreur, `${nom} en erreur : ${r.contenu}`);
    verifierTexte(r.contenu, nom);
    verifierSecrets(nom);
    await verifierPlateau(nom);
    return r.contenu;
  };
  // Avant la fin, aucun mot de peste dans le chat public, sauf l'annonce d'un cri.
  const chatSansPeste = ou => {
    if (api.etat().phase === "fin") return;
    for (const m of messages) {
      const t = sansHTML(m.content);
      if (!CRI.test(t)) assert.doesNotMatch(t, /peste|fièvre/i, `${ou} : la peste trahie au chat : ${t}`);
    }
  };
  try {
    const depart = await appeler("loups_distribuer", { joueurs: [], composition: "", niveau: "classique", peste: "oui", ...(nbCompagnons ? { compagnons: nbCompagnons } : {}) });
    assert.match(depart, /PESTE NOIRE \(secret absolu/, "le narrateur sait que c'est la peste");
    assert.match(depart, /Composition, pour toi seul/);
    const equilibre = EQUILIBRE;
    assert.ok(villageois().every(a => equilibre.roles[roleDe(a).system.cle]?.camp !== "meute" && secretDuMJ.camp(a) !== "meute"), "aucun rôle de la meute");
    assert.equal(api.etat().peste.active, true);
    assert.ok(!("peste" in reglages.get("lakour-loups.partie").valeur), "drapeau absent de l'état public");
    let fin = "", tour = 0;
    while (!fin) {
      tour += 1;
      assert.ok(tour <= 30, "plus de 30 tours");
      const avant = api.etat();
      const porteur = avant.peste.porteur;
      const vivantsAvant = villageois().filter(a => a.system.vivant);
      const victimeVoulue = porteur ? "" : choisir(vivantsAvant, h).name;
      const nbEmis = emissions.length, nbChat = messages.length;
      const nuit = await appeler("loups_nuit", { delai_secondes: 20, peste_victime: victimeVoulue });
      chatSansPeste(`nuit ${tour}`);
      const e = api.etat();
      const peste = e.nuitPrecedente.actions.filter(x => x.roleCle === "peste");
      assert.equal(peste.length, 1, "une étape de la peste par nuit");
      assert.ok(!e.nuitPrecedente.actions.some(x => x.roleCle === "meute"), "pas de meute");
      assert.equal(peste[0].acteurId, porteur, "notée au nom du porteur (aucun la première fois)");
      // (Les demandes posthumes du porteur : pas celle d'une Braconnière qui choisit qui elle emporte.)
      const demandes = emissions.slice(nbEmis).filter(x => x.type === "demande" && x.posthume && x.objet !== "emporter");
      if (!porteur) {
        assert.equal(demandes.length, 0, "pas de porteur : personne n'est réveillé pour la peste");
        // La victime choisie par le narrateur (sauf si elle était hors d'atteinte : alors le hasard).
        if (!/\(au hasard\)/.test(nuit)) assert.deepEqual(peste[0].cibles.map(id => game.actors.get(id).name), [victimeVoulue], "la victime choisie par le narrateur");
        assert.match(nuit, /la peste \(ton choix\) →/);
        couvert("peste : choix du narrateur");
      } else {
        const p = game.actors.get(porteur);
        assert.equal(p.system.vivant, false, "le porteur est mort");
        if (!peste[0].cibles.length) {
          // Personne à frapper (tous les vivants à l'abri : Taverne, Grange, Chapelle…) : rien à demander au porteur.
          assert.equal(demandes.length, 0, "personne à désigner : le porteur n'est pas réveillé");
          couvert("peste : personne à frapper");
        } else if (p.system.joueur) {
          // Le porteur, mort, reçoit SA demande (à lui seul) ; son choix est noté, ou le hasard s'il passe.
          assert.equal(demandes.length, 1, "le porteur est réveillé, mort");
          assert.deepEqual(demandes[0].recipients, [p.system.joueur]);
          assert.ok(demandes[0].candidats.every(c => vivantsAvant.some(v => v.id === c.id)), "candidats vivants");
          const reponse = joueursSimules.journal.reponses.find(r => r.id === demandes[0].id);
          if (reponse?.cibles.length) { assert.deepEqual(peste[0].cibles, reponse.cibles, "le choix du porteur"); couvert("peste : choix du porteur"); }
          else { assert.match(nuit, /\(au hasard\)/); couvert("peste : hasard"); }
        } else {
          assert.equal(demandes.length, 0, "un compagnon porteur répond par son cerveau, sans socket");
          couvert("peste : porteur compagnon");
        }
      }
      // La victime morte de la peste : cause secrète « peste », publique « nuit », même annonce qu'une proie de la meute.
      const morts = e.morts.filter(m => m.tour === e.tour && m.cause === "peste");
      for (const m of morts) {
        const nom = game.actors.get(m.acteurId).name;
        assert.ok(messages.slice(nbChat).some(x => sansHTML(x.content).includes(nom) && MORT_PUBLIQUE.test(sansHTML(x.content))), `${nom} : annonce de mort ordinaire`);
        if (!e.vainqueur) assert.equal(e.peste.porteur, m.acteurId, "la victime devient le porteur");
        const mort = game.actors.get(m.acteurId);
        if (mort.system.joueur) assert.ok(secretsEmis(nbEmis).some(x => x.entree.acteurId === m.acteurId && /peste noire/.test(x.entree.texte ?? "")), "le porteur l'apprend dans son carnet");
        else assert.ok(api.carnet(m.acteurId).some(x => /peste noire/.test(x.texte ?? "")), "le compagnon porteur l'apprend dans son carnet");
        couvert("peste : victime");
      }
      if (nbCompagnons) verifierSavoirDesCompagnons(`peste, nuit ${tour}`);
      if (/VICTOIRE/.test(nuit)) { fin = nuit; break; }
      await calme();
      // Le jour : un cri juste arrête la partie.
      if (crierAuJour && tour >= crierAuJour) {
        const crieur = choisir(villageois().filter(a => a.system.vivant && !a.system.silence), h);
        fin = await appeler("loups_peste", { villageois: crieur.name });
        assert.match(fin, /C'était bien la peste noire/);
        break;
      }
      await appeler("loups_vote", { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
      await calme();
      let clos = await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
      for (let i = 0; (/porte le ruban de la Tisserande/.test(clos) || api.etat().vote.ouvert) && i < 8; i++) {
        await calme();
        clos = await appeler("loups_vote", { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" });
      }
      for (const nom of /Désignés? : (.+) \(loups_eliminer pour chacun\)/.exec(clos)?.[1].split(" et ") ?? []) {
        const t = await appeler("loups_eliminer", { villageois: nom, cause: "vote", reveler: true });
        if (/VICTOIRE/.test(t)) { fin = t; break; }
      }
      // Une Braconnière exécutée a emporté quelqu'un d'elle-même (dernier geste) : la partie a pu finir là.
      if (!fin && api.etat().vainqueur) fin = api.etat().vainqueur === "peste" ? "VICTOIRE : la peste noire (dernier geste d'une Braconnière)." : victoireDuGeste();
      chatSansPeste(`jour ${tour}`);
    }
    const e = api.etat();
    assert.equal(e.phase, "fin");
    const pub = reglages.get("lakour-loups.partie").valeur;
    assert.equal(pub.peste?.active, true, "à la fin, la partie se dévoile");
    const chat = messages.map(m => sansHTML(m.content)).join("\n");
    assert.ok(chat.includes(FR.LAKOUR_LOUPS.Peste.Recit), "le récit de fin dévoile la peste");
    // (La vraie cause d'une mort de peste : s'il y en a eu une — un remède peut sauver la première victime, et un cri juste finir la
    // veillée avant la suivante.)
    if (e.morts.some(m => m.cause === "peste")) assert.ok(chat.includes(FR.LAKOUR_LOUPS.Causes.peste), "la vraie cause, au récit");
    else couvert("peste : aucune victime avant la fin");
    const journal = game.journal.find(j => j.getFlag("lakour-loups", "chroniques"));
    assert.ok(journal.pages.some(p => p.name.includes(FR.LAKOUR_LOUPS.Peste.Chronique)), "les Chroniques : Peste noire");
    if (game.actors.get(e.vainqueur)) {
      // Un solitaire l'emporte avant le cri ou l'extinction (le Chasseur de primes dont la cible est exécutée) : la règle de la
      // peste le permet (les solitaires d'abord). Depuis que la Braconnière choisit elle-même qui elle emporte, les parties
      // tirées changent, et il arrive.
      assert.equal(roleDe(game.actors.get(e.vainqueur)).system.camp, "solitaire", "un solitaire vainqueur");
      assert.match(fin, /VICTOIRE/);
      couvert("peste : solitaire");
    } else if (crierAuJour) {
      assert.equal(e.vainqueur, "village");
      assert.match(fin, /VICTOIRE : village/);
      assert.ok(chat.includes(FR.LAKOUR_LOUPS.Victoire.villagePeste));
      couvert("peste : cri juste");
    } else {
      assert.equal(e.vainqueur, "peste");
      assert.ok(villageois().filter(a => a.system.vivant).length <= 1, "la peste l'emporte quand il reste un vivant ou aucun");
      assert.match(fin, /VICTOIRE : la peste noire/);
      assert.ok(chat.includes(FR.LAKOUR_LOUPS.Victoire.peste));
      couvert("peste : extinction");
    }
    verifierSecrets("fin de la peste");
    assert.deepEqual(erreurs(), []);
    return { vainqueur: e.vainqueur, tours: tour };
  } catch (err) {
    throw new Error(`peste, ${n} joueurs${nbCompagnons ? ` et ${nbCompagnons} compagnons` : ""}, graine « ${graine} » : ${err.message}\n--- derniers échanges :\n${textes.slice(-4).join("\n\n")}`, { cause: err });
  } finally {
    Math.random = hasardOrigine;
  }
}

test("PESTE NOIRE : parties complètes (humains, compagnons IA), extinction ou cri juste ; aucun secret avant la fin", async () => {
  for (const graine of GRAINES) {
    await jouerPeste({ n: 8, graine: `${graine}-peste` });
    await jouerPeste({ n: 3, graine: `${graine}-peste-c`, nbCompagnons: 5 });
    await jouerPeste({ n: 10, graine: `${graine}-peste-cri`, crierAuJour: 2 });
  }
  for (const effet of ["peste : choix du narrateur", "peste : choix du porteur", "peste : porteur compagnon", "peste : victime", "peste : extinction", "peste : cri juste"]) {
    assert.ok(couverture.get(effet) > 0, `jamais exercé : ${effet}`);
  }
  // Reproductible.
  const a = await jouerPeste({ n: 8, graine: "brume-peste" });
  const b = await jouerPeste({ n: 8, graine: "brume-peste" });
  assert.deepEqual(a, b);
});

test("cri « C'est la peste noire ! » dans une partie ordinaire : le crieur est pendu pour avoir semé la panique, la partie continue", async () => {
  monde(10, "panique");
  const hasardOrigine = Math.random;
  Math.random = creerHasard("panique-monde");
  try {
    await outil("loups_distribuer").executer({ joueurs: [], composition: "classique-10", niveau: "", peste: "" });
    assert.equal(api.etat().peste, null);
    await outil("loups_nuit").executer({ delai_secondes: 20, peste_victime: "" });
    await calme();
    // Un mort ne crie pas ; un vivant, le jour, oui.
    const mort = villageois().find(a => !a.system.vivant);
    if (mort) assert.match((await outil("loups_peste").executer({ villageois: mort.name })).contenu, /Cri refusé/);
    const crieur = villageois().find(a => a.system.vivant && secretDuMJ.camp(a) !== "meute" && !a.system.silence);
    const r = await outil("loups_peste").executer({ villageois: crieur.name });
    assert.match(r.contenu, /Ce n'était pas la peste/);
    assert.equal(crieur.system.vivant, false);
    const pub = reglages.get("lakour-loups.partie").valeur;
    assert.equal(pub.morts.find(m => m.acteurId === crieur.id).cause, "panique");
    assert.ok(messages.some(m => sansHTML(m.content).includes(FR.LAKOUR_LOUPS.Causes.panique)), "annonce : pendu pour avoir semé la panique");
    const elim = emissions.filter(e => e.type === "hook" && e.nom === "lakourLoups.elimination").at(-1);
    assert.equal(elim.args[0].cause, "panique");
    verifierSecrets("cri faux");
    // Il ne crie pas deux fois (il est mort) ; la nuit, personne ne crie.
    assert.match((await outil("loups_peste").executer({ villageois: crieur.name })).contenu, /Cri refusé/);
    await api.changerPhase("nuit");
    const autre = villageois().find(a => a.system.vivant);
    assert.match((await outil("loups_peste").executer({ villageois: autre.name })).contenu, /Cri refusé/);
  } finally {
    Math.random = hasardOrigine;
  }
});
