// API game.lakourLoups du système lakour-loups, éprouvée sans Foundry sur une doublure en mémoire (acteurs, objets,
// réglages, socket, chat, hooks : essais/doublures/foundry-loups.mjs).  Lancer : npm run essais
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installerFoundry, creerObjetMonde, journalHooks, emissions, messages } from "./doublures/foundry-loups.mjs";

installerFoundry();
const { api, recevoirReponse, recevoirVote } = await import("../systems/lakour-loups/scripts/api.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");

let U;   // uuid des objets du monde
beforeEach(() => {
  installerFoundry();
  enregistrerReglages(() => {});
  game.lakourLoups = api;
  U = {
    loup: creerObjetMonde("Loup de Brumecombe", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    garde: creerObjetMonde("Garde du pont", "role", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }),
    veilleuse: creerObjetMonde("Veilleuse de lanterne", "role", { cle: "veilleuse-de-lanterne", effet: "eclairer", nuit: { actif: true, ordre: 30 } }),
    sonneur: creerObjetMonde("Sonneur", "role", { cle: "sonneur", effet: "vote-double", nuit: { actif: true, ordre: 70 }, usages: { max: 1, restant: 1 } }),
    villageois: creerObjetMonde("Villageois", "role", { cle: "villageois" }),
    forgeron: creerObjetMonde("Forgeron", "metier", { cle: "forgeron" }),
    meuniere: creerObjetMonde("Meunière", "metier", { cle: "meuniere" })
  };
});

const joueurs = ["u1", "u2", "u3", "u4", "u5", "u6"];
const distribuer = () => api.distribuer({ roles: [U.loup, U.loup, U.garde, U.veilleuse, U.sonneur, U.villageois], metiers: [U.forgeron, U.meuniere],
  joueurs, graine: "essai", composition: "essai-6", batiments: [] });
const acteurDe = cle => game.actors.find(a => secretDuMJ.role(a)?.system.cle === cle);
const tous = cle => game.actors.filter(a => secretDuMJ.role(a)?.system.cle === cle);

// ------------------------------------------------------------------ essais
test("API : toutes les fonctions du contrat sont là", () => {
  for (const f of ["etat", "villageois", "distribuer", "changerPhase", "ordreDeNuit", "demanderAction", "demanderActionMeute", "noterAction",
    "ouvrirVote", "cloreVote", "eliminer", "proteger", "reduireAuSilence", "changerCamp", "echangerRoles", "verifierVictoire", "ouvrirTable", "resoudreNuit"]) {
    assert.equal(typeof api[f], "function", f);
  }
});

test("API : hors du MJ actif, les fonctions qui écrivent lèvent une erreur claire", async () => {
  game.user = game.users.get("u1");
  await assert.rejects(() => api.changerPhase("nuit"), /Seul le MJ actif/);
  await assert.rejects(() => api.distribuer({ joueurs }), /Seul le MJ actif/);
  assert.throws(() => api.demanderAction({ acteurId: "x" }), /Seul le MJ actif/);
  assert.equal(api.etat().nuit.actions.length, 0, "etat() reste lisible");
});

test("distribuer : un villageois par joueur, rôle et métier, propriété, rôle chuchoté au seul joueur (et au MJ)", async () => {
  const r = await distribuer();
  assert.equal(r.length, 6);
  assert.equal(game.actors.size, 6);
  assert.deepEqual(r.map(x => x.roleCle).sort(), ["garde-du-pont", "loup-de-brumecombe", "loup-de-brumecombe", "sonneur", "veilleuse-de-lanterne", "villageois"]);
  for (const x of r) {
    const a = game.actors.get(x.acteurId);
    assert.equal(a.system.joueur, x.userId);
    // Le joueur OBSERVE son villageois (0.9.0) : il ne peut plus le modifier (se mettre « meute », se donner un rôle).
    assert.equal(a.ownership[x.userId], CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
    assert.equal(a.ownership.default, 1);
    // Le rôle et le camp : dans les secrets du MJ, pas sur le document (Foundry le livre à tous).
    assert.equal(a.items.filter(i => i.type === "role").length, 0, "aucun objet de rôle avant la révélation");
    assert.equal(a.system.camp, "", "aucun camp au document");
    assert.equal(secretDuMJ.role(a).system.cle, x.roleCle);
    assert.equal(secretDuMJ.camp(a), x.roleCle.startsWith("loup") ? "meute" : "village");
    // Sa fiche part à lui seul.
    const f = emissions.findLast(e => e.type === "fiche" && e.acteurId === x.acteurId);
    assert.deepEqual(f.recipients, [x.userId]);
    assert.equal(f.fiche.role.system.cle, x.roleCle);
    assert.match(a.system.maison, /^Maison (\d|1[3-8])$/);
    // Le rôle part dans le carnet secret, par le socket, à ce seul joueur (jamais par le chat, livré à tous).
    const m = emissions.find(e => e.type === "secret" && e.entree.acteurId === x.acteurId);
    assert.ok(m, "rôle remis en secret");
    assert.deepEqual(m.recipients, [x.userId], "personne d'autre");
  }
  assert.deepEqual(messages.filter(m => m.whisper?.length), [], "aucun chuchotement");
  assert.deepEqual(game.actors.map(a => a.system.maison).sort(), ["Maison 1", "Maison 13", "Maison 14", "Maison 2", "Maison 3", "Maison 4"],
    "un tiers du village sur l'autre rive");
  assert.equal(game.actors.filter(a => a.items.some(i => i.type === "metier")).length, 2, "deux métiers pour six joueurs");
  const loups = tous("loup-de-brumecombe");
  const carte = emissions.find(e => e.type === "secret" && e.recipients.includes(loups[0].system.joueur)).entree.html;
  assert.match(carte, new RegExp(loups[1].name), "un loup connaît sa meute");
  const e = api.etat();
  assert.equal(e.phase, "preparation");
  assert.equal(e.tour, 0);
  assert.equal(e.composition, "essai-6");
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.phase"));
  // Redistribuer recycle les mêmes acteurs.
  await distribuer();
  assert.equal(game.actors.size, 6);
  assert.ok(game.actors.filter(a => true).every(a => secretDuMJ.role(a) && a.items.filter(i => i.type === "role").length === 0));
});

test("changerPhase : tour + 1 la nuit, hooks ici et chez les autres sans les secrets", async () => {
  await distribuer();
  await api.changerPhase("nuit");
  assert.equal(api.etat().tour, 1);
  const h = journalHooks.findLast(h => h.nom === "lakourLoups.phase");
  assert.equal(h.args[0], "nuit");
  const diffuse = emissions.findLast(e => e.type === "hook" && e.nom === "lakourLoups.phase");
  assert.equal(diffuse.canal, "system.lakour-loups");
  assert.deepEqual(diffuse.args[1].primes, {});
  await assert.rejects(() => api.changerPhase("sieste"), /Phase inconnue/);
});

test("ordreDeNuit : meute groupée à 40, dans l'ordre", async () => {
  await distribuer();
  await api.changerPhase("nuit");
  const o = api.ordreDeNuit();
  assert.deepEqual(o.map(e => e.roleCle), ["garde-du-pont", "veilleuse-de-lanterne", "meute", "sonneur"]);
  assert.equal(o[2].acteurIds.length, 2);
});

test("demanderAction : demande par socket au seul joueur, réponse du bon joueur seulement, délai -> []", async () => {
  await distribuer();
  const garde = acteurDe("garde-du-pont");
  const cible = acteurDe("villageois");
  const promesse = api.demanderAction({ acteurId: garde.id, invite: "Qui gardez-vous ?", nombre: 1, delai: 5000 });
  const demande = emissions.findLast(e => e.type === "demande");
  assert.equal(demande.destinataire, garde.system.joueur);
  assert.equal(demande.invite, "Qui gardez-vous ?");
  assert.ok(!demande.candidats.some(c => c.id === garde.id), "pas soi-même par défaut");
  assert.equal(recevoirReponse({ id: demande.id, cibles: [cible.id], userId: "u9" }), false, "un autre joueur ne répond pas à sa place");
  assert.equal(recevoirReponse({ id: demande.id, cibles: [cible.id, "inconnu"], userId: garde.system.joueur }), true);
  assert.deepEqual(await promesse, [cible.id]);
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.action"));

  const lente = api.demanderAction({ acteurId: garde.id, delai: 30 });
  assert.deepEqual(await lente, []);
  assert.ok(emissions.some(e => e.type === "annuler"));
  // Joueur absent : réponse vide tout de suite.
  game.users.get(garde.system.joueur).active = false;
  assert.deepEqual(await api.demanderAction({ acteurId: garde.id, delai: 5000 }), []);
});

test("demanderAction : nombre 0 -> [] sans fenêtre ; soi-même seulement si le rôle le permet", async () => {
  await distribuer();
  const garde = acteurDe("garde-du-pont"), veilleuse = acteurDe("veilleuse-de-lanterne");
  const avant = emissions.length;
  assert.deepEqual(await api.demanderAction({ acteurId: garde.id, nombre: 0, delai: 5000 }), []);
  assert.equal(emissions.length, avant, "aucune fenêtre ouverte");
  const tous = game.actors.map(a => a.id);
  api.demanderAction({ acteurId: garde.id, candidats: tous, delai: 20 });
  assert.ok(!emissions.at(-1).candidats.some(c => c.id === garde.id), "le garde (soiMeme false) ne se voit pas");
  const reglee = secretDuMJ.role(veilleuse).toObject();
  reglee.system.nuit.soiMeme = true;
  await api.donnerRole(veilleuse.id, reglee);   // le rôle vit dans la fiche secrète : le MJ l'y règle
  api.demanderAction({ acteurId: veilleuse.id, candidats: tous, delai: 20 });
  assert.ok(emissions.at(-1).candidats.some(c => c.id === veilleuse.id), "la veilleuse (soiMeme) se voit");
  await new Promise(res => setTimeout(res, 40));
});

test("demanderActionMeute : vote des loups vivants, à la majorité", async () => {
  await distribuer();
  const [l1, l2] = tous("loup-de-brumecombe");
  const victime = acteurDe("veilleuse-de-lanterne");
  const autre = acteurDe("villageois");
  const promesse = api.demanderActionMeute({ delai: 5000, candidats: game.actors.map(a => a.id) });
  const demandes = emissions.filter(e => e.type === "demande");
  assert.equal(demandes.length, 2);
  assert.ok(!demandes[0].candidats.some(c => c.id === l1.id || c.id === l2.id), "on ne mange pas les siens");
  const d1 = demandes.find(d => d.acteurId === l1.id), d2 = demandes.find(d => d.acteurId === l2.id);
  recevoirReponse({ id: d2.id, cibles: [victime.id], userId: l2.system.joueur });
  await new Promise(r => setTimeout(r, 5));
  recevoirReponse({ id: d1.id, cibles: [autre.id], userId: l1.system.joueur });
  assert.deepEqual(await promesse, [victime.id], "égalité : le premier choisi");
});

test("nuit complète : noterAction, resoudreNuit (protection, lanterne, mort), messages privés, usages", async () => {
  await distribuer();
  await api.changerPhase("nuit");
  const [l1] = tous("loup-de-brumecombe");
  const garde = acteurDe("garde-du-pont"), veilleuse = acteurDe("veilleuse-de-lanterne"), sonneur = acteurDe("sonneur"), vil = acteurDe("villageois");
  await api.noterAction({ acteurId: garde.id, cibles: [veilleuse.id] });
  await api.noterAction({ acteurId: veilleuse.id, cibles: [vil.id] });
  await api.noterAction({ acteurId: l1.id, roleCle: "meute", cibles: [vil.id] });
  await api.noterAction({ acteurId: sonneur.id, cibles: [] });   // il passe
  assert.equal(secretDuMJ.role(sonneur).system.usages.restant, 1, "passer ne coûte rien");
  await api.noterAction({ acteurId: sonneur.id, cibles: [sonneur.id], effet: "vote-double" });
  assert.equal(api.etat().nuit.actions.length, 5);
  assert.equal(secretDuMJ.role(sonneur).system.usages.restant, 0, "usage consommé");
  await api.proteger(garde.id);
  assert.equal(secretDuMJ.protections(garde), 1);

  await api.changerPhase("aube");
  const nbAvant = messages.length;
  const r = await api.resoudreNuit();
  assert.deepEqual(r.morts, [vil.id]);
  assert.equal(vil.system.vivant, false);
  assert.equal(vil.system.revele, true, "révélé à la mort (réglage par défaut)");
  assert.equal(l1.system.revele, true, "démasqué par la lanterne");
  assert.equal(secretDuMJ.protections(garde), 0, "protections remises à 0");
  assert.equal(r.voteDouble, true);
  const e = api.etat();
  assert.deepEqual(e.morts.map(m => [m.acteurId, m.cause, m.tour]), [[vil.id, "meute", 1]]);
  assert.equal(e.nuit.actions.length, 0);
  assert.equal(e.nuitPrecedente.actions.length, 5);
  assert.equal(e.voteDoubleDemain, true);
  // messages : [{ acteurId, texte }], que le MJ IA chuchote lui-même ; le système ne chuchote rien par défaut.
  const pourVeilleuse = r.messages.find(m => m.acteurId === veilleuse.id);
  assert.match(pourVeilleuse.texte, /lanterne/);
  assert.deepEqual(Object.keys(pourVeilleuse).sort(), ["acteurId", "texte"]);
  assert.ok(r.messages.every(m => game.actors.get(m.acteurId)), "aucun message « mj » parmi les messages des joueurs");
  assert.ok(Array.isArray(r.narration));
  assert.ok(!messages.slice(nbAvant).some(m => /lanterne/.test(m.content)), "pas de doublon avec le MJ IA");
  // Depuis la Table de jeu : { chuchoter: true }.
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: veilleuse.id, cibles: [garde.id] });
  const r2 = await api.resoudreNuit({ chuchoter: true });
  assert.equal(r2.messages.length, 1);
  assert.match(r2.messages[0].texte, /Aucun loup n'est entré chez/);
  const prive = emissions.find(e => e.type === "secret" && e.entree.texte === r2.messages[0].texte);
  assert.ok(prive, "la veilleuse reçoit son message");
  assert.deepEqual(prive.recipients, [veilleuse.system.joueur], "à elle seule");
  assert.ok(api.carnet(veilleuse.id).some(x => x.texte === r2.messages[0].texte), "le MJ en garde la trace");
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.elimination" && h.args[0].acteurId === vil.id));
  assert.deepEqual(await api.resoudreNuit().then(x => x.morts), [], "une nuit ne se résout qu'une fois");
  assert.equal(api.etat().nuitPrecedente.actions.length, 1);
});

test("vote : ouvrir, voter (votes forgés et morts refusés), clore, exécuter, cascade d'amour, victoire", async () => {
  await distribuer();
  const [l1, l2] = tous("loup-de-brumecombe");
  const garde = acteurDe("garde-du-pont"), veilleuse = acteurDe("veilleuse-de-lanterne"), sonneur = acteurDe("sonneur"), vil = acteurDe("villageois");
  await api.changerPhase("jour");
  const v = await api.ouvrirVote({ duree: 60 });
  assert.equal(v.ouvert, true);
  assert.equal(api.etat().phase, "vote");
  assert.ok(v.finit > Date.now() + 50_000, "60 = 60 secondes");
  assert.equal(v.candidats.length, 6);
  for (const a of [garde, veilleuse, sonneur, vil]) assert.equal(await recevoirVote({ votant: a.id, cible: l1.id, userId: a.system.joueur }), true);
  assert.equal(await recevoirVote({ votant: l2.id, cible: garde.id, userId: garde.system.joueur }), false, "on ne vote pas pour un autre");
  await recevoirVote({ votant: l2.id, cible: vil.id, userId: l2.system.joueur });
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.vote"));
  const r = await api.cloreVote();
  assert.equal(r.elu, l1.id);
  assert.equal(r.decompte[l1.id], 4);
  assert.equal(api.etat().vote.ouvert, false);
  assert.equal(await recevoirVote({ votant: vil.id, cible: l1.id, userId: vil.system.joueur }), false, "vote clos");

  assert.deepEqual(await api.eliminer(l1.id, { cause: "vote" }), [l1.id]);
  assert.equal(await api.verifierVictoire(), "");

  // Lien d'amour : l2 et le garde ; la mort de l2 emporte le garde.
  await api.reglerFiche(l2.id, { amoureux: garde.id });
  await api.reglerFiche(garde.id, { amoureux: l2.id });
  assert.equal(l2.system.amoureux, "", "le lien d'amour reste secret (fiche du MJ)");
  const morts = await api.eliminer(l2.id, { cause: "vote", reveler: false });
  assert.deepEqual(morts, [l2.id, garde.id]);
  assert.equal(l2.system.revele, false);
  assert.equal(api.etat().morts.find(m => m.acteurId === garde.id).cause, "chagrin");
  assert.deepEqual(await api.eliminer(l2.id), [], "on ne meurt qu'une fois");

  assert.equal(await api.verifierVictoire(), "village");
  assert.equal(api.etat().phase, "fin");
  assert.equal(api.etat().vainqueur, "village");
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.victoire" && h.args[0] === "village"));
  // Le récit de fin : chaque villageois, son rôle dévoilé, la vraie cause de sa mort, les vainqueurs marqués.
  const recit = messages.filter(m => /loups-recit/.test(m.content)).at(-1)?.content ?? "";
  assert.ok(recit, "le récit de fin est posté");
  for (const a of game.actors.filter(x => x.type === "villageois")) {
    assert.ok(recit.includes(a.name), `${a.name} est dans le récit`);
    assert.ok(recit.includes(secretDuMJ.role(a).name), `le rôle de ${a.name} est dévoilé`);
  }
  assert.match(recit, /victime du chagrin/, "la vraie cause");
  assert.equal(await api.verifierVictoire(), "village");
  assert.equal(messages.filter(m => /loups-recit/.test(m.content)).length, 1, "un seul récit, même si l'on revérifie");
  // Les Chroniques : la veillée entre au journal, lisible par tous, et le récit y renvoie.
  const chroniques = game.journal.find(j => j.getFlag("lakour-loups", "chroniques"));
  assert.ok(chroniques, "le journal des Chroniques est créé");
  assert.equal(chroniques.ownership.default, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER, "tous peuvent le lire");
  assert.ok(recit.includes(`@UUID[${chroniques.uuid}]`), "le récit renvoie aux Chroniques");
  const [palmares, veillee, ...reste] = chroniques.pages.contents.sort((a, b) => a.sort - b.sort);
  assert.equal(reste.length, 0, "le palmarès et une veillée");
  assert.match(palmares.text.content, /loups-palmares/);
  for (const a of game.actors.filter(x => x.type === "villageois")) assert.ok(veillee.text.content.includes(a.name));
  const sauve = game.settings.get("lakour-loups", "chroniques");
  assert.equal(sauve.length, 1, "consignée une fois, même si l'on revérifie");
  assert.equal(sauve[0].lignes.find(l => l.nom === garde.name).joueur, game.users.get(garde.system.joueur).name, "le nom du joueur");
  assert.ok(sauve[0].lignes.every(l => !("id" in l)), "pas d'identifiants d'acteurs : la partie suivante les efface");
});

test("Chroniques : une veillée de plus récrit le journal (palmarès, la plus récente d'abord), 50 au plus", async () => {
  const { consignerVeillee, MAX_CHRONIQUES } = await import("../systems/lakour-loups/scripts/chroniques.mjs");
  const ligne = (joueur, gagnant) => ({ nom: `V-${joueur}`, joueur, role: "Villageois", camp: "village", metier: "", vivant: true, mort: null, gagnant });
  const j1 = await consignerVeillee({ quand: Date.UTC(2026, 9, 1), tours: 3, vainqueur: "Le village", lignes: [ligne("Ana", true), ligne("", false)] });
  const j2 = await consignerVeillee({ quand: Date.UTC(2026, 10, 1), tours: 5, vainqueur: "La meute", lignes: [ligne("Ana", false), ligne("Bo", true)] });
  assert.equal(j2, j1, "le même journal");
  assert.equal(game.journal.size, 1);
  const pages = j2.pages.contents.sort((a, b) => a.sort - b.sort);
  assert.equal(pages.length, 3);
  assert.match(pages[1].text.content, /La meute/, "la plus récente d'abord");
  assert.match(pages[2].text.content, /Le village/);
  assert.match(pages[0].text.content, /Ana/);
  assert.doesNotMatch(pages[0].text.content, /joueur IA/, "les joueurs IA hors du palmarès");
  for (let i = 0; i < MAX_CHRONIQUES; i++) await consignerVeillee({ quand: i, tours: 1, vainqueur: "x", lignes: [] });
  assert.equal(game.settings.get("lakour-loups", "chroniques").length, MAX_CHRONIQUES);
  assert.equal(j2.pages.size, MAX_CHRONIQUES + 1, "les anciennes pages ne s'empilent pas");
});

test("resoudreNuit : Herboriste — un second poison ne verse rien, l'usage est rendu, le remède reste", async () => {
  await distribuer();
  const h = acteurDe("villageois"), garde = acteurDe("garde-du-pont"), veilleuse = acteurDe("veilleuse-de-lanterne"), [l1] = tous("loup-de-brumecombe");
  await api.donnerRole(h.id, { name: "Herboriste", type: "role",
    system: { cle: "herboriste", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 1, soiMeme: true }, usages: { max: 2, restant: 2 } } });
  const usages = () => secretDuMJ.role(h).system.usages.restant;
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: h.id, cibles: [garde.id] });
  assert.deepEqual((await api.resoudreNuit()).morts, [garde.id], "premier poison");
  assert.equal(usages(), 1);
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: h.id, cibles: [veilleuse.id] });
  const r = await api.resoudreNuit();
  assert.deepEqual(r.morts, [], "fiole de poison vide");
  assert.deepEqual(r.fiolesVides, [h.id]);
  assert.match(r.messages.find(m => m.acteurId === h.id).texte, /fiole de poison est vide/);
  assert.equal(usages(), 1, "l'usage est rendu");
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: l1.id, roleCle: "meute", cibles: [veilleuse.id] });
  await api.noterAction({ acteurId: h.id, cibles: [veilleuse.id] });
  assert.deepEqual((await api.resoudreNuit()).morts, [], "le remède sauve la victime");
  assert.equal(usages(), 0);
  assert.deepEqual(api.etat().fioles, { [h.id]: { poison: true, remede: true } });
});

test("resoudreNuit : fiole vide rendue AVANT l'échange — le Colporteur qui prend le rôle de l'Herboriste reste épuisé", async () => {
  await distribuer();
  const h = acteurDe("villageois"), garde = acteurDe("garde-du-pont"), veilleuse = acteurDe("veilleuse-de-lanterne");
  const remplacer = (a, d) => api.donnerRole(a.id, d);
  await remplacer(h, { name: "Herboriste", type: "role", system: { cle: "herboriste", effet: "remede", nuit: { actif: true, ordre: 50, cibles: 1, soiMeme: true }, usages: { max: 2, restant: 2 } } });
  await remplacer(garde, { name: "Colporteur", type: "role", system: { cle: "colporteur", camp: "solitaire", effet: "echanger-role", nuit: { actif: true, ordre: 8, cibles: 1 }, usages: { max: 1, restant: 1 } } });
  // Nuit 1 : premier poison (la fiole de poison est vidée).
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: h.id, cibles: [veilleuse.id] });
  await api.resoudreNuit();
  // Nuit 2 : le Colporteur échange avec l'Herboriste, qui tente un second poison (fiole vide, usage rendu).
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: garde.id, cibles: [h.id] });
  await api.noterAction({ acteurId: h.id, cibles: [acteurDe("villageois")?.id ?? garde.id] });
  const r = await api.resoudreNuit();
  assert.deepEqual(r.fiolesVides, [h.id]);
  const roleDeH = secretDuMJ.role(h), roleDuGarde = secretDuMJ.role(garde);
  assert.equal(roleDeH.system.cle, "colporteur", "l'échange a eu lieu");
  assert.equal(roleDeH.system.usages.restant, 0, "le Colporteur reste épuisé : l'usage rendu ne lui revient pas");
  assert.equal(roleDuGarde.system.cle, "herboriste");
  assert.equal(roleDuGarde.system.usages.restant, 1, "l'Herboriste récupère l'usage de sa fiole vide");
});

test("silence, changement de camp, échange de rôles", async () => {
  await distribuer();
  const garde = acteurDe("garde-du-pont"), vil = acteurDe("villageois"), [l1] = tous("loup-de-brumecombe");
  await api.reduireAuSilence(vil.id);
  assert.equal(vil.system.silence, true);
  await api.changerPhase("nuit");
  assert.equal(vil.system.silence, false, "le silence ne dure qu'un débat");
  await api.changerCamp(vil.id, "meute");
  assert.equal(secretDuMJ.camp(vil), "meute");
  await assert.rejects(() => api.changerCamp(vil.id, "lune"), /Camp inconnu/);
  await api.echangerRoles(garde.id, l1.id);
  assert.equal(secretDuMJ.role(garde).system.cle, "loup-de-brumecombe");
  assert.equal(secretDuMJ.camp(garde), "meute");
  assert.equal(secretDuMJ.role(l1).system.cle, "garde-du-pont");
  assert.equal(secretDuMJ.camp(l1), "village");
});

test("etat() d'un joueur : sans les choix secrets de la nuit", async () => {
  await distribuer();
  await api.changerPhase("nuit");
  const [l1] = tous("loup-de-brumecombe");
  await api.noterAction({ acteurId: l1.id, roleCle: "meute", cibles: [acteurDe("villageois").id] });
  assert.equal(api.etat().nuit.actions.length, 1);
  game.user = game.users.get("u1");
  assert.equal(api.etat().nuit.actions.length, 0);
});
