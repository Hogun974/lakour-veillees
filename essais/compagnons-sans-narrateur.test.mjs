// Joueurs IA aux Veillées SANS narrateur IA : un MJ humain mène la Table, aucune séance du MJ IA n'est lancée
// (modules/lakour-mj-ia/scripts/compagnons-veillees.js). Le vrai système lakour-loups, le vrai contenu, le vrai moteur du MJ IA
// (pour ses compagnons et son compteur) sur la doublure de Foundry ; 2 joueurs humains simulés ; 4 compagnons créés par le point
// d'enregistrement game.lakourLoups.compagnons.creer (le bouton « + Joueur IA » de la Table). Le « MJ humain » est une doublure
// qui fait ce que fait la Table : distribuer, réveiller chaque rôle la nuit, lever le jour, ouvrir et clore le vote.
// On vérifie la nuit (les compagnons choisissent par leur cerveau), leurs répliques de jour (style théâtre), leurs réponses aux
// humains, leur vote, le compteur « compagnons hors séance » — et que le narrateur n'est JAMAIS appelé. Aucun appel payant.
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { installerFoundry, simulerJoueurs, calme, messages, journalHooks, erreursHooks } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 2, contenu: true });
globalThis.DOMParser = class {
  parseFromString(html) { return { querySelectorAll: () => [], body: { textContent: String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() } }; }
};
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const { creerHasard } = await import("../systems/lakour-loups/logique/index.mjs");
const { MoteurMJ } = await import("../modules/lakour-mj-ia/scripts/moteur.js");
const { CompagnonsSansNarrateur } = await import("../modules/lakour-mj-ia/scripts/compagnons-veillees.js");
const { reinitialiserPrive, estCompagnon } = await import("../modules/lakour-mj-ia/scripts/compagnons-jeu.js");
const { ecouteActive } = await import("../modules/lakour-mj-ia/scripts/ecoute.js");
const ID = "lakour-mj-ia";
const villageois = () => game.actors.filter(a => a.type === "villageois");

// ------------------------------------------------------------------ le monde, comme au « ready » du MJ IA, SANS séance
installerFoundry({ joueurs: 2, contenu: true });
enregistrerReglages(() => {});
for (const [k, v] of Object.entries({
  fournisseur: "anthropic", modeleAnthropic: "claude-opus-5-5", modeleCompagnons: "", budgetSeance: 5, delaiReponse: 0, miseEnPlace: false, voix: "aucune",
  autonomie: "autonome", pilote: true, piloteDelai: 0, piloteEtapes: 60, bavardageCompagnons: "normal", compagnonsPrive: {},
  compagnonsHorsSeance: { cout: 0, appels: 0, depuis: 0 }, mouvementsBloques: {}, personnaliteActive: "voix",
  personnalites: [{ id: "voix", nom: "La Voix", nomAffiche: "La Voix" }],
  seance: { active: false, jetons: { entree: 0, cacheLecture: 0, cacheEcriture: 0, sortie: 0 }, cout: 0 }
})) game.settings.register(ID, k, { default: v });
game.lakourLoups = api;
ecouterSocket();
Object.assign(game, { world: { id: "brumecombe", title: "Brumecombe" }, combats: { active: null }, journal: [], messages: { get contents() { return messages; } },
  modules: new Map([[ID, { api: {} }]]) });
reinitialiserPrive();
const hasardOrigine = Math.random;
Math.random = creerHasard("sans-narrateur");
simulerJoueurs({ graine: "sans-narrateur", fraude: false, pouvoirs: 0 });

const moteur = new MoteurMJ();
// Le narrateur : il ne doit jamais être appelé (ni tour, ni modèle).
const narrateur = [];
moteur.fournisseur = { nom: "espion", nouveauFil: () => ({ messages: [] }), ajouterUtilisateur() {}, ajouterResultats() {}, async envoyer() { narrateur.push("envoyer"); return { texte: "", appels: [], usage: {} }; } };
const tour = moteur.tour.bind(moteur);
moteur.tour = (...a) => { narrateur.push("tour"); return tour(...a); };
// Le cerveau des compagnons, doublure : le premier candidat qui n'est pas lui ; une réplique avec didascalie.
const appels = [];
moteur.compagnons.cerveaux.fournisseur = () => ({
  nom: "anthropic",
  async envoyerCourt(c) {
    const moi = /Tu joues (.+?), un personnage/.exec(c.systeme)?.[1];
    const candidats = /Candidats : (.+)\.\n/.exec(c.texte)?.[1].split(", ");
    const usage = { entree: 2000, cacheLecture: 0, cacheEcriture: 0, sortie: 50 };
    if (candidats) { appels.push({ moi, type: "decider" }); return { texte: JSON.stringify({ cibles: [candidats.find(x => x !== moi) ?? candidats[0]] }), usage, arret: "fin" }; }
    if (c.texte.includes('{"texte": "ta phrase"}')) { appels.push({ moi, type: "mot" }); return { texte: '{"texte": "Méfie-toi du moulin."}', usage, arret: "fin" }; }
    appels.push({ moi, type: "parler", texte: c.texte });
    return { texte: `*${moi} se gratte la barbe.* — Moi, je n'ai rien entendu cette nuit.`, usage, arret: "fin" };
  }
});
// Ce que branche main.js au « ready » : résolveur (séance ou non), point d'enregistrement, hooks de phase et de chat.
api.resolveurs.compagnon = d => moteur.compagnons.resoudreLoups(d);
const sansNarrateur = new CompagnonsSansNarrateur({ moteur });
Hooks.on("lakourLoups.phase", phase => sansNarrateur.surPhase(phase));
const creer = ChatMessage.implementation.create;
ChatMessage.implementation.create = async d => {
  const m = await creer({ ...d });
  m.getFlag = (s, k) => m.flags?.[s]?.[k];
  moteur.recevoir(m);          // hors séance : le moteur ne fait rien
  sansNarrateur.surMessage(m);
  return m;
};
const attendre = async (cond, n = 500) => { for (let i = 0; i < n && !cond(); i++) await new Promise(r => setTimeout(r, 1)); assert.ok(cond(), "délai dépassé"); };

// ------------------------------------------------------------------ la partie
test("point d'enregistrement : le MJ IA dépose game.lakourLoups.compagnons (hook) ; « + Joueur IA » crée 4 compagnons", async () => {
  sansNarrateur.enregistrer();
  assert.equal(api.compagnons?.disponible, true);
  assert.ok(journalHooks.some(h => h.nom === "lakourLoups.compagnons" && h.args[0]?.disponible));
  const ids = await api.compagnons.creer(4);
  assert.equal(ids.length, 4);
  assert.ok(ids.every(id => estCompagnon(game.actors.get(id))));
  assert.equal(ecouteActive({ seanceIA: moteur.actif, compagnonsVivants: ids.length }), true, "des compagnons vivants : l'écoute de la parole a lieu d'être");
  assert.equal(moteur.actif, false, "aucune séance du MJ IA");
});

test("le MJ humain distribue : les joueurs IA tiennent des places comme les joueurs", async () => {
  const noms = villageois().filter(estCompagnon).map(a => a.name).sort();
  await api.nouvellePartie({ memesJoueurs: false, niveau: "debutants" });
  assert.equal(villageois().length, 6);
  assert.deepEqual(villageois().filter(estCompagnon).map(a => a.name).sort(), noms, "les mêmes joueurs IA, avec leur nom");
  assert.ok(villageois().every(a => a.items.find(i => i.type === "role")), "chacun a un rôle");
  assert.equal(game.settings.get(ID, "compagnonsHorsSeance").cout, 0, "nouvelle partie : compteur hors séance à zéro");
});

test("la nuit : le MJ réveille chaque rôle depuis la Table ; les joueurs IA choisissent par leur cerveau", async () => {
  await api.changerPhase("nuit");
  for (const { roleCle } of api.ordreDeNuit()) await api.reveiller(roleCle, { delai: 20000 });
  await calme();
  await api.changerPhase("aube");
  await api.resoudreNuit();
  const compagnonsQuiAgissent = api.etat().nuitPrecedente.actions.filter(a => estCompagnon(game.actors.get(a.acteurId)));
  assert.ok(appels.some(a => a.type === "decider"), "un compagnon a choisi la nuit");
  assert.ok(compagnonsQuiAgissent.every(a => game.actors.get(a.acteurId).system.vivant || api.etat().morts.some(m => m.acteurId === a.acteurId)));
  assert.equal(messages.filter(m => m.flags?.[ID]?.compagnon).length, 0, "la nuit, personne ne parle");
});

test("le jour se lève : les joueurs IA vivants débattent (style théâtre) ; ils répondent à un joueur humain, jamais entre eux", async () => {
  if (api.etat().vainqueur) return;
  await api.changerPhase("jour");
  await attendre(() => sansNarrateur.journal.some(j => j.cause === "jour"));
  const jour = sansNarrateur.journal.find(j => j.cause === "jour");
  const vivants = villageois().filter(a => estCompagnon(a) && a.system.vivant).length;
  assert.equal(jour.dits.length, Math.min(2, vivants), "au plus le bavardage (normal : 2)");
  const repliques = messages.filter(m => m.flags?.[ID]?.compagnon);
  assert.ok(repliques.every(m => /^<p><em class="lakour-mjia-didascalie">.+ se gratte la barbe\.<\/em> — Moi/.test(m.content)));
  for (const r of repliques) assert.ok(game.actors.get(r.flags[ID].compagnon).system.vivant, "un mort a parlé");
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sansNarrateur.journal.length, 1, "leurs répliques ne relancent personne");
  // Un joueur humain parle : ils lui répondent (le nom cité parle d'abord).
  const vise = villageois().find(a => estCompagnon(a) && a.system.vivant);
  await ChatMessage.implementation.create({ content: `<p>${vise.name}, tu étais où hier soir ?</p>`, speaker: { alias: "Joueur 1" }, author: game.users.get("u1") });
  await attendre(() => sansNarrateur.journal.some(j => j.cause === "humain"));
  assert.ok(appels.filter(a => a.type === "parler").at(-1).texte.includes(`${vise.name}, tu étais où hier soir ?`), "la question est entendue");
  assert.equal(sansNarrateur.journal.find(j => j.cause === "humain").dits[0].acteurId, vise.id, "celui qu'on interpelle répond d'abord");
});

test("le vote : les joueurs IA votent dans le même vote que les humains ; le narrateur n'a jamais été appelé ; coût hors séance compté", async () => {
  if (api.etat().vainqueur) return;
  await api.ouvrirVote({});
  await calme();
  const r = await api.cloreVote();
  const votants = Object.keys(r.votes ?? {});
  const compagnonsVivants = villageois().filter(a => estCompagnon(a) && a.system.vivant).map(a => a.id);
  assert.ok(compagnonsVivants.every(id => votants.includes(id)), "chaque joueur IA vivant a voté");
  assert.ok(votants.some(id => !estCompagnon(game.actors.get(id))), "les humains aussi");
  assert.deepEqual(narrateur, [], "le narrateur n'est jamais appelé");
  const hors = game.settings.get(ID, "compagnonsHorsSeance");
  assert.equal(hors.appels, appels.length, "chaque appel des compagnons au compteur hors séance");
  assert.ok(hors.cout > 0);
  assert.equal(game.settings.get(ID, "seance").cout, 0);
  assert.deepEqual(erreursHooks, [], "aucune erreur dans les écouteurs de hooks");
  Math.random = hasardOrigine;
});
