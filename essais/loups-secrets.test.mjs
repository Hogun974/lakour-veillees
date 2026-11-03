// Les secrets des « Veillées de Brumecombe », sur la doublure de Foundry (qui livre le socket comme le serveur v14 :
// recipients, identifiant de l'émetteur). Ce que vérifient ces essais :
// - le réglage monde « lakour-loups.partie » (livré à TOUS les navigateurs) ne contient aucun secret ; les secrets vivent
//   chez le MJ actif (mémoire + réglage de portée « client ») et y survivent à un rechargement ;
// - chaque message privé du socket a son seul destinataire ; les réponses ne vont qu'au MJ actif ; l'émetteur réel
//   (donné par le serveur) fait foi ;
// - les votes restent cachés jusqu'à la clôture, les vraies causes des morts de nuit aussi ;
// - rien de secret ne passe par le chat (un chuchotement de Foundry est livré à tous) : le carnet secret le remplace.
// Lancer : npm run essais
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installerFoundry, creerObjetMonde, journalHooks, emissions, messages, reglages, envoyerAuMJ, calme, erreurs } from "./doublures/foundry-loups.mjs";

installerFoundry();
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const { ecouterSocket, traiterMessage } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { oublierSecrets, secretsPerdus } = await import("../systems/lakour-loups/scripts/secrets.mjs");
const { mesSecrets, monVote, chargerPrive } = await import("../systems/lakour-loups/scripts/prive.mjs");
const { lirePublic } = await import("../systems/lakour-loups/scripts/donnees.mjs");

let U;
beforeEach(() => {
  installerFoundry();
  enregistrerReglages(() => {});
  ecouterSocket();
  game.lakourLoups = api;
  U = {
    loup: creerObjetMonde("Loup de Brumecombe", "role", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    garde: creerObjetMonde("Garde du pont", "role", { cle: "garde-du-pont", effet: "proteger", nuit: { actif: true, ordre: 20 } }),
    chasseur: creerObjetMonde("Chasseur de primes", "role", { cle: "chasseur-de-primes", camp: "solitaire", victoireCle: "cible-executee", nuit: { actif: true, ordre: 6, cibles: 0, premiereNuitSeulement: true } }),
    juge: creerObjetMonde("Juge de paix", "role", { cle: "juge-de-paix", effet: "annuler-vote", usages: { max: 1, restant: 1 }, nuit: { actif: false, cibles: 0 } }),
    villageois: creerObjetMonde("Villageois", "role", { cle: "villageois" }),
    forgeron: creerObjetMonde("Forgeron", "metier", { cle: "forgeron", jour: { actif: true, invite: "?", cibles: 1 }, usages: { max: 1, restant: 1 } }),
    tisserande: creerObjetMonde("Tisserande", "metier", { cle: "tisserande", jour: { actif: true, invite: "?", cibles: 1 }, usages: { max: 1, restant: 1 } }),
    chapelle: creerObjetMonde("La Chapelle", "batiment", { cle: "chapelle" }),
    taverne: creerObjetMonde("La Taverne", "batiment", { cle: "taverne" })
  };
});

const joueurs = ["u1", "u2", "u3", "u4", "u5", "u6"];
const distribuer = () => api.distribuer({ roles: [U.loup, U.loup, U.garde, U.chasseur, U.juge, U.villageois], metiers: [U.forgeron, U.tisserande],
  joueurs, graine: "secrets", composition: "essai", batiments: [U.chapelle, U.taverne] });
const acteurDe = cle => game.actors.find(a => secretDuMJ.role(a)?.system.cle === cle);
const tous = cle => game.actors.filter(a => secretDuMJ.role(a)?.system.cle === cle);
const metierDe = cle => game.actors.find(a => a.items.find(i => i.type === "metier")?.system.cle === cle);
const publicEtat = () => reglages.get("lakour-loups.partie").valeur;
const commeJoueur = id => { game.user = game.users.get(id); };
const commeMJ = () => { game.user = game.users.get("mj"); };

test("l'état public ne contient ni choix de nuit, ni primes, ni fioles, ni aspergés, ni votes ; le MJ les garde dans un réglage client", async () => {
  await distribuer();
  const [l1] = tous("loup-de-brumecombe");
  const garde = acteurDe("garde-du-pont"), vil = acteurDe("villageois"), chasseur = acteurDe("chasseur-de-primes");
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: garde.id, cibles: [vil.id] });
  await api.noterAction({ acteurId: l1.id, roleCle: "meute", cibles: [vil.id] });
  const pub = publicEtat();
  assert.deepEqual(pub.nuit.actions, []);
  assert.deepEqual(pub.primes, {});
  assert.ok(pub.partie, "un identifiant de partie, public");
  assert.equal(JSON.stringify(pub).includes(vil.id) && JSON.stringify(pub.nuit).includes(vil.id), false);
  const secret = reglages.get("lakour-loups.secrets");
  assert.equal(secret.conf.scope, "client", "portée client : jamais envoyé au serveur");
  // Rangés par [monde][userId] : un autre monde, un autre compte du même navigateur n'y lisent rien.
  assert.deepEqual(Object.keys(secret.valeur), ["brumecombe"]);
  assert.deepEqual(Object.keys(secret.valeur.brumecombe), ["mj"]);
  assert.equal(secret.valeur.brumecombe.mj.nuit.actions.length, 2);
  assert.ok(secret.valeur.brumecombe.mj.primes[chasseur.id], "la prime du Chasseur est chez le MJ");
  assert.ok(secret.valeur.brumecombe.mj.fiches[garde.id]?.role, "le rôle de chacun est chez le MJ");
  assert.equal(api.etat().nuit.actions.length, 2, "le MJ actif voit tout");
  commeJoueur("u1");
  assert.deepEqual(api.etat().nuit.actions, [], "un joueur ne voit que l'état public");
  assert.deepEqual(api.etat().primes, {});
});

test("le MJ recharge sa page : les secrets reviennent de son navigateur ; un autre navigateur ne les a pas, et le sait", async () => {
  await distribuer();
  await api.changerPhase("nuit");
  await api.noterAction({ acteurId: acteurDe("garde-du-pont").id, cibles: [acteurDe("villageois").id] });
  oublierSecrets();                     // rechargement : la mémoire est vide, le réglage client reste
  assert.equal(api.etat().nuit.actions.length, 1);
  assert.equal(secretsPerdus(lirePublic()), false);
  reglages.get("lakour-loups.secrets").valeur = {};   // autre navigateur
  oublierSecrets();
  assert.equal(api.etat().nuit.actions.length, 0);
  assert.equal(secretsPerdus(lirePublic()), true, "la Table de jeu prévient le MJ");
  // Des secrets d'une autre partie ne se mélangent pas à celle-ci.
  reglages.get("lakour-loups.secrets").valeur = { brumecombe: { mj: { partie: "ancienne", nuit: { actions: [{ acteurId: "x", roleCle: "y", cibles: ["z"] }] } } } };
  oublierSecrets();
  assert.equal(api.etat().nuit.actions.length, 0);
  // Ceux d'un autre compte (même navigateur) ou d'un autre monde : jamais lus.
  const partie = lirePublic().partie;
  reglages.get("lakour-loups.secrets").valeur = { brumecombe: { u1: { partie, nuit: { actions: [{ acteurId: "x", roleCle: "y", cibles: ["z"] }] } } },
    autreMonde: { mj: { partie, nuit: { actions: [{ acteurId: "x", roleCle: "y", cibles: ["z"] }] } } } };
  oublierSecrets();
  assert.equal(api.etat().nuit.actions.length, 0);
  // Un joueur ne lit jamais ce réglage, même le sien.
  commeJoueur("u1");
  oublierSecrets();
  const { secretsMJ } = await import("../systems/lakour-loups/scripts/secrets.mjs");
  assert.deepEqual(secretsMJ(), {});
  commeMJ();
  oublierSecrets();
});

test("socket : la demande de nuit ne va qu'au joueur visé, l'annulation aussi ; sa réponse ne va qu'au MJ actif", async () => {
  await distribuer();
  const garde = acteurDe("garde-du-pont");
  const promesse = api.demanderAction({ acteurId: garde.id, invite: "Qui gardez-vous ?", delai: 30 });
  const demande = emissions.findLast(e => e.type === "demande");
  assert.deepEqual(demande.recipients, [garde.system.joueur]);
  assert.deepEqual(await promesse, []);
  assert.deepEqual(emissions.findLast(e => e.type === "annuler").recipients, [garde.system.joueur]);
  // Côté joueur : la réponse et le vote partent au seul MJ actif.
  commeJoueur(garde.system.joueur);
  const { envoyerReponse, envoyerVote } = await import("../systems/lakour-loups/scripts/api.mjs");
  envoyerReponse("x", ["y"]);
  assert.deepEqual(emissions.at(-1).recipients, ["mj"]);
  envoyerVote("");
  assert.equal(emissions.at(-1).type, "vote");
  assert.deepEqual(emissions.at(-1).recipients, ["mj"]);
  assert.equal(mesSecrets().vote.cible, "", "son vote est noté chez lui");
});

test("l'émetteur donné par le serveur fait foi : voter, répondre ou user d'un pouvoir à la place d'un autre est refusé", async () => {
  await distribuer();
  await api.changerPhase("jour");
  await api.ouvrirVote({ duree: 0 });
  const [a, b] = game.actors.contents;
  // b se fait passer pour a (userId déclaré = a), mais le serveur dit que c'est b.
  assert.equal(await traiterMessage({ type: "vote", votant: a.id, cible: b.id, userId: a.system.joueur }, b.system.joueur), false);
  assert.equal(await traiterMessage({ type: "vote", votant: a.id, cible: b.id, userId: b.system.joueur }, b.system.joueur), false, "vote au nom d'un autre");
  assert.equal(await traiterMessage({ type: "vote", votant: a.id, cible: b.id, userId: a.system.joueur }, a.system.joueur), true);
  assert.deepEqual(api.etat().vote.votes, { [a.id]: b.id });
  // Un joueur ne peut pas ouvrir une fenêtre, ni écrire dans un carnet, chez un autre (seul un MJ le peut).
  assert.equal(traiterMessage({ type: "secret", entree: { id: "faux", texte: "Tu es loup" } }, "u2"), false);
  assert.equal(traiterMessage({ type: "demande", destinataire: "mj", id: "faux", candidats: [] }, "u2"), false);
  assert.equal(traiterMessage({ type: "hook", nom: "lakourLoups.victoire", args: ["meute"] }, "u2"), false);
  // Un pouvoir de jour pour l'acteur d'un autre : refusé, avec un avis au seul tricheur.
  const forgeron = metierDe("forgeron");
  const tricheur = game.actors.find(x => x.id !== forgeron.id);
  envoyerAuMJ("system.lakour-loups", { type: "jour", acteurId: forgeron.id, pouvoir: "forgeron", cibles: [forgeron.id], userId: tricheur.system.joueur }, { emetteur: tricheur.system.joueur });
  await calme();
  assert.equal(forgeron.items.find(i => i.type === "metier").system.usages.restant, 1);
  assert.deepEqual(emissions.findLast(e => e.type === "avis").recipients, [tricheur.system.joueur]);
  assert.deepEqual(erreurs(), []);
});

test("votes cachés jusqu'à la clôture : le public sait QUI a voté ; chacun reçoit l'accusé de SON vote ; le décompte paraît à la clôture", async () => {
  await distribuer();
  await api.changerPhase("jour");
  await api.ouvrirVote({ duree: 0 });
  const [a, b, c] = game.actors.contents;
  for (const x of [a, b]) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: c.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  assert.deepEqual(publicEtat().vote.votes, {});
  assert.deepEqual(publicEtat().vote.exprimes.sort(), [a.id, b.id].sort());
  const diffuses = emissions.filter(e => e.type === "hook" && e.nom === "lakourLoups.vote");
  assert.deepEqual(diffuses.map(e => Object.keys(e.args[0])), [["votant"], ["votant"]], "le choix ne part pas chez les autres");
  const accuse = emissions.filter(e => e.type === "monVote");
  assert.deepEqual(accuse.map(e => e.recipients), [[a.system.joueur], [b.system.joueur]]);
  // Côté joueur : l'accusé affiche son vote, et seulement pour ce vote-ci.
  commeJoueur(a.system.joueur);
  traiterMessage(accuse[0], "mj");
  assert.equal(monVote(publicEtat().vote.numero), c.id);
  assert.equal(monVote(publicEtat().vote.numero + 1), "");
  commeMJ();
  const r = await api.cloreVote();
  assert.equal(r.elu, c.id);
  assert.deepEqual(publicEtat().vote.resultat.votes, { [a.id]: c.id, [b.id]: c.id }, "public après la clôture");
});

test("vraies causes des morts de nuit : le public lit « dans la nuit », le MJ la vraie cause ; le chat aussi", async () => {
  await distribuer();
  const vil = acteurDe("villageois");
  await api.eliminer(vil.id, { cause: "poison", reveler: false });
  assert.equal(publicEtat().morts[0].cause, "nuit");
  assert.equal(api.etat().morts[0].cause, "poison");
  assert.equal(emissions.findLast(e => e.nom === "lakourLoups.elimination").args[0].cause, "nuit");
  assert.ok(journalHooks.findLast(h => h.nom === "lakourLoups.elimination").args[0].cause === "poison", "ici, chez le MJ, la vraie");
  assert.doesNotMatch(messages.at(-1).content, /poison/);
  await api.eliminer(acteurDe("garde-du-pont").id, { cause: "vote" });
  assert.equal(publicEtat().morts[1].cause, "vote", "une exécution reste publique");
});

test("carnet secret : rôle, prime et messages de la nuit vont au seul joueur concerné ; il les retrouve en se reconnectant ; aucun chuchotement", async () => {
  await distribuer();
  const chasseur = acteurDe("chasseur-de-primes");
  const cartes = emissions.filter(e => e.type === "secret");
  assert.equal(cartes.length, 6);
  for (const e of cartes) assert.deepEqual(e.recipients, [game.actors.get(e.entree.acteurId).system.joueur]);
  assert.deepEqual(messages.filter(m => m.whisper?.length), []);
  const prime = api.etat().primes[chasseur.id];
  assert.match(cartes.find(e => e.entree.acteurId === chasseur.id).entree.html, new RegExp(game.actors.get(prime).name));
  await api.envoyerSecret(chasseur.id, "Une ombre a traversé la place.");
  // Il se reconnecte : « bonjour » -> tout son carnet, sa prime, à lui seul.
  const depuis = emissions.length;
  envoyerAuMJ("system.lakour-loups", { type: "bonjour", userId: chasseur.system.joueur }, { emetteur: chasseur.system.joueur });
  await calme();
  const carnet = emissions.slice(depuis).find(e => e.type === "carnet");
  assert.deepEqual(carnet.recipients, [chasseur.system.joueur]);
  assert.equal(carnet.entrees.length, 2);
  assert.equal(carnet.prime, prime);
  // Chez lui : le carnet est rangé dans son navigateur (réglage client), pour CETTE partie.
  commeJoueur(chasseur.system.joueur);
  traiterMessage(carnet, "mj");
  assert.equal(mesSecrets().prime, prime);
  assert.equal(mesSecrets().entrees.length, 2);
  assert.equal(reglages.get("lakour-loups.carnet").conf.scope, "client");
  chargerPrive("une-autre-partie");
  assert.equal(mesSecrets().entrees.length, 0, "une autre partie, un carnet vide");
  chargerPrive(publicEtat().partie);
  assert.equal(mesSecrets().entrees.length, 2, "relu depuis son navigateur");
});

test("pouvoir de jour par la Table de jeu : le joueur l'envoie au MJ, qui applique et annonce ; le Juge de paix rouvre le vote", async () => {
  await distribuer();
  await api.changerPhase("jour");
  const forgeron = metierDe("forgeron");
  const garde = acteurDe("garde-du-pont");
  envoyerAuMJ("system.lakour-loups", { type: "jour", acteurId: forgeron.id, pouvoir: "forgeron", cibles: [garde.id], userId: forgeron.system.joueur }, { emetteur: forgeron.system.joueur });
  await calme();
  assert.equal(forgeron.items.find(i => i.type === "metier").system.usages.restant, 0);
  assert.ok(publicEtat().jour.effets.some(x => x.type === "verrou" && x.cible === garde.id), "un effet annoncé est public");
  assert.match(messages.at(-1).content, /forge un verrou/);
  // Le vote, puis le Juge.
  await api.ouvrirVote({ duree: 0 });
  const juge = acteurDe("juge-de-paix");
  const vise = acteurDe("villageois");
  for (const x of game.actors.contents) envoyerAuMJ("system.lakour-loups", { type: "vote", votant: x.id, cible: vise.id, userId: x.system.joueur }, { emetteur: x.system.joueur });
  await calme();
  const r = await api.cloreVote();
  assert.deepEqual(r.elus, [vise.id]);
  assert.equal(emissions.findLast(e => e.nom === "lakourLoups.voteClos").args[0].elu, vise.id);
  envoyerAuMJ("system.lakour-loups", { type: "jour", acteurId: juge.id, pouvoir: "juge-de-paix", cibles: [], userId: juge.system.joueur }, { emetteur: juge.system.joueur });
  await calme();
  assert.equal(api.etat().vote.ouvert, true);
  assert.equal(juge.system.revele, true);
  assert.equal(emissions.findLast(e => e.type === "hook" && e.nom === "lakourLoups.phase").args[0], "vote", "les fenêtres de vote se rouvrent");
  // Le vote de la Chapelle : l'élu y dort à l'abri.
  await api.cloreVote();
  await api.ouvrirVote({ duree: 0, objet: "chapelle" });
  envoyerAuMJ("system.lakour-loups", { type: "vote", votant: garde.id, cible: vise.id, userId: garde.system.joueur }, { emetteur: garde.system.joueur });
  await calme();
  const c = await api.cloreVote();
  assert.equal(c.objet, "chapelle");
  assert.ok(api.etat().jour.effets.some(x => x.type === "asile" && x.cible === vise.id));
});

test("ruban de la Tisserande par l'API : la clôture prolonge le vote, sans rien dévoiler du décompte", async () => {
  await distribuer();
  await api.changerPhase("jour");
  const tisserande = metierDe("tisserande");
  const vise = acteurDe("villageois");
  await api.agirDeJour({ acteurId: tisserande.id, pouvoir: "tisserande", cibles: [vise.id] });
  await api.ouvrirVote({ duree: 0 });
  envoyerAuMJ("system.lakour-loups", { type: "vote", votant: tisserande.id, cible: vise.id, userId: tisserande.system.joueur }, { emetteur: tisserande.system.joueur });
  await calme();
  const r = await api.cloreVote();
  assert.equal(r.prolonge, vise.id);
  assert.deepEqual(r.decompte, {});
  assert.equal(publicEtat().vote.ouvert, true);
  assert.ok(publicEtat().vote.finit > Date.now());
  assert.deepEqual(publicEtat().vote.votes, {});
  assert.equal((await api.cloreVote()).elu, vise.id);
  await assert.rejects(() => api.agirDeJour({ acteurId: tisserande.id, pouvoir: "tisserande", cibles: [vise.id] }), /déjà servi/);
});
