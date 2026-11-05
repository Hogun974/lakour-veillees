// Pilote automatique du MJ IA aux Veillées de Brumecombe (modules/lakour-mj-ia/scripts/pilote.js) : quand il ne reste plus
// que des compagnons IA vivants (les humains sont morts tôt), en mode autonome, la partie continue seule jusqu'à la victoire.
// Le vrai système lakour-loups, le vrai contenu, le VRAI moteur du MJ IA (file des tours, outils loups_*, compagnons) sur la
// doublure de Foundry (essais/doublures/foundry-loups.mjs, sans la modifier). Aucun appel payant : le narrateur est un
// fournisseur DOUBLURE qui lit la consigne de chaque étape et appelle les outils comme le ferait le modèle ; les compagnons ont
// un fournisseur doublure qui note chaque appel (choix, répliques avec didascalie, votes).
// On vérifie : démarrage seul à la mort du dernier humain, étapes (nuit, aube, débat borné, vote, exécution), victoire puis
// dénouement et arrêt net (sans relancer de partie), jamais deux tours à la fois ; pas de pilote si un humain vit encore, ni en
// mode Validation (un avis au MJ). On mesure le coût d'un jour de pilote (appels au narrateur et aux compagnons).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { installerFoundry, simulerJoueurs, calme, messages } from "./doublures/foundry-loups.mjs";

installerFoundry({ joueurs: 2, contenu: true });
globalThis.DOMParser = class {
  parseFromString(html) { return { querySelectorAll: () => [], body: { textContent: String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() } }; }
};
const { api } = await import("../systems/lakour-loups/scripts/api.mjs");
const { ecouterSocket } = await import("../systems/lakour-loups/scripts/socket.mjs");
const { enregistrerReglages } = await import("../systems/lakour-loups/scripts/reglages.mjs");
const { creerHasard } = await import("../systems/lakour-loups/logique/index.mjs");
const { OUTILS } = await import("../modules/lakour-mj-ia/scripts/outils.js");
const { MoteurMJ } = await import("../modules/lakour-mj-ia/scripts/moteur.js");
const { reinitialiserPrive } = await import("../modules/lakour-mj-ia/scripts/compagnons-jeu.js");
const outil = nom => OUTILS.find(o => o.nom === nom);
const ID = "lakour-mj-ia";
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);

// ------------------------------------------------------------------ le narrateur doublure (il « joue » chaque consigne)
// Il répond à la consigne d'une étape par les appels d'outils qu'elle demande, puis « — » après les résultats (sauf l'aube, le
// débat et le dénouement, racontés). Il note chaque appel au modèle (le coût).
function narrateur() {
  const appels = [];
  const args = {
    nuit: { delai_secondes: 20, peste_victime: "" },
    ouvrir: { action: "ouvrir", candidats: [], duree_secondes: 0, double: false, objet: "execution" },
    clore: { action: "clore", candidats: [], duree_secondes: 0, double: false, objet: "execution" }
  };
  let n = 0;
  const appel = (nom, a) => ({ id: `n${++n}`, nom, args: a });
  return {
    nom: "doublure", appels,
    nouveauFil: () => ({ fournisseur: "doublure", messages: [] }),
    ajouterUtilisateur: (fil, texte) => fil.messages.push({ role: "user", content: texte }),
    ajouterResultats: (fil, resultats) => fil.messages.push({ role: "outils", content: resultats }),
    async envoyer(fil) {
      const dernier = fil.messages.at(-1);
      const consigne = dernier.role === "user" ? dernier.content : "";
      let r = { texte: "—", appels: [] };
      if (consigne) {
        const etape = consigne.includes("[Script]") ? "autre" : /Étape : ([^.]+)\./.exec(consigne)?.[1] ?? (consigne.includes("[Messages et actions des joueurs]") ? "réponse" : "autre");
        if (etape === "la nuit") r = { texte: "La brume tombe sur Brumecombe ; chacun verrouille sa porte.", appels: [appel("loups_nuit", args.nuit)] };
        else if (etape === "l'aube") r = { texte: "L'aube grise se lève sur le village. Qui a vu quelque chose ?", appels: [] };
        else if (etape === "le vote") r = { texte: "Assez parlé : votez.", appels: [appel("loups_vote", args.ouvrir)] };
        else if (etape === "le dépouillement") r = { texte: "On compte les voix.", appels: [appel("loups_vote", args.clore)] };
        else if (etape === "l'exécution") {
          const noms = /Le village a désigné (.+?)\. Appelle/.exec(consigne)[1].split(" et ");
          r = { texte: "La corde attend.", appels: noms.map(v => appel("loups_eliminer", { villageois: v, cause: "vote", reveler: true })) };
        } else if (etape === "le dénouement") r = { texte: "Ainsi finit la veillée.", appels: [] };
        else if (etape === "réponse") r = { texte: "Le temps presse : encore une voix, puis le vote.", appels: [] };
        else if (etape === "autre" && /\[Script\]/.test(consigne)) r = JSON.parse(/\[Script\](.*)$/s.exec(consigne)[1]);
        appels.push({ etape, consigne });
      } else appels.push({ etape: "résultats", consigne: "" });
      fil.messages.push({ role: "assistant", content: r.texte, appels: r.appels });
      return { texte: r.texte, appels: r.appels, usage: { entree: 0, cacheLecture: 0, cacheEcriture: 0, sortie: 0 }, arret: r.appels.length ? "outils" : "fin" };
    }
  };
}

// Le cerveau des compagnons, doublure : le premier candidat qui n'est pas lui ; une réplique avec didascalie ; un mot.
function cerveaux() {
  const appels = [];
  return {
    appels,
    fournisseur: {
      nom: "anthropic",
      async envoyerCourt(c) {
        const moi = /Tu joues (.+?), un personnage/.exec(c.systeme)?.[1];
        const candidats = /Candidats : (.+)\.\n/.exec(c.texte)?.[1].split(", ");
        const usage = { entree: 1500, cacheLecture: 0, cacheEcriture: 0, sortie: 40 };
        if (candidats) { appels.push("decider"); return { texte: JSON.stringify({ cibles: [candidats.find(x => x !== moi) ?? candidats[0]] }), usage, arret: "fin" }; }
        if (c.texte.includes('{"texte": "ta phrase"}')) { appels.push("mot"); return { texte: '{"texte": "Je veille sur toi."}', usage, arret: "fin" }; }
        appels.push("parler");
        return { texte: `*${moi} croise les bras.* — Je n'ai rien vu cette nuit, mais je me méfie.`, usage, arret: "fin" };
      }
    }
  };
}

// ------------------------------------------------------------------ un monde : 2 humains (joueurs simulés), des compagnons
const REGLAGES_MJIA = {
  fournisseur: "anthropic", modeleAnthropic: "claude-opus-5-5", modeleOpenAI: "gpt-6.1-sol", modeleCompagnons: "", budgetSeance: 0, delaiReponse: 0,
  miseEnPlace: false, voix: "aucune", autonomie: "autonome", pilote: true, piloteDelai: 0, piloteEtapes: 60, bavardageCompagnons: "normal",
  compagnonsPrive: {}, compagnonsHorsSeance: { cout: 0, appels: 0, depuis: 0 }, mouvementsBloques: {}, jouerPnj: true, historiqueLoups: [],
  personnaliteActive: "voix", personnalites: [{ id: "voix", nom: "La Voix de la brume", nomAffiche: "La Voix de la brume", consignes: "Narrateur." }],
  seance: { active: true, jetons: { entree: 0, cacheLecture: 0, cacheEcriture: 0, sortie: 0 }, cout: 0 }
};

async function monde(graine, { compagnons = 6, reglages = {} } = {}) {
  installerFoundry({ joueurs: 2, contenu: true });
  enregistrerReglages(() => {});
  for (const [k, v] of Object.entries({ ...REGLAGES_MJIA, ...reglages })) game.settings.register(ID, k, { default: v });
  game.lakourLoups = api;
  ecouterSocket();
  Object.assign(game, { world: { id: "brumecombe", title: "Brumecombe" }, system: { id: "lakour-loups", title: "Les Veillées", version: "1" },
    combats: { active: null }, journal: [], paused: false, messages: { get contents() { return messages; } } });
  foundry.applications.apps = { FilePicker: { implementation: { createDirectory: async () => {}, upload: async (_s, d, f) => ({ path: `${d}/${f.name}` }) } } };
  reinitialiserPrive();
  const hasardOrigine = Math.random;
  Math.random = creerHasard(`${graine}-monde`);
  const joueurs = simulerJoueurs({ graine: `${graine}-joueurs`, fraude: false, pouvoirs: 0 });
  // Le moteur du MJ IA, branché comme au « ready » : résolveur des compagnons, messages du chat proposés au moteur.
  const moteur = new MoteurMJ();
  game.modules.get(ID).api = { ...game.modules.get(ID).api, moteur };   // le coffre du MJ IA y est déjà (doublure)
  api.resolveurs.compagnon = d => moteur.compagnons.resoudreLoups(d);
  const mj = narrateur();
  const ia = cerveaux();
  moteur.fournisseur = mj;
  moteur.fil = mj.nouveauFil();
  moteur.systeme = "Tu es le narrateur.";
  moteur.compagnons.cerveaux.fournisseur = () => ia.fournisseur;
  // Temps virtuel pour le pilote ; la voix est coupée (voix « aucune »).
  moteur.pilote.horloge = { t: 0, maintenant() { return this.t; }, attendre(ms) { this.t += ms; return new Promise(r => setTimeout(r, 0)); } };
  const creer = ChatMessage.implementation.create;
  ChatMessage.implementation.create = async d => {
    // Comme Foundry : le serveur pose l'auteur (le créateur, ici le MJ) ; le moteur ne croit le drapeau « compagnon » que d'un MJ.
    const m = await creer({ ...d, author: game.user });
    Object.assign(m, { getFlag: (s, k) => m.flags?.[s]?.[k], update: async u => Object.assign(m, u), delete: async () => { messages.splice(messages.indexOf(m), 1); } });
    moteur.recevoir(m);   // le hook createChatMessage du MJ IA (appelé par Foundry pendant la création, chez le créateur)
    return m;
  };
  // Jamais deux tours du MJ à la fois ; jamais une étape du pilote pendant un tour.
  const controle = { chevauchements: 0, etapesPendantTour: 0 };
  const tour = moteur.tour.bind(moteur);
  moteur.tour = (...a) => { if (moteur.enCours && moteur.pilote.enEtape) controle.etapesPendantTour++; return tour(...a); };
  const debattre = moteur.compagnons.debattre.bind(moteur.compagnons);
  moteur.compagnons.debattre = o => { if (!moteur.auRepos()) controle.etapesPendantTour++; return debattre(o); };
  // La partie : 2 humains (villageois, pas loups) et des compagnons, distribution par l'outil du narrateur.
  const depart = await outil("loups_distribuer").executer({ joueurs: [], mode: "auto", niveau: "debutants", roles: [], batiments: [], inclure: [], exclure: [], composition: "", compagnons });
  assert.ok(!depart.erreur, depart.contenu);
  for (const h of villageois().filter(a => a.system.joueur && secretDuMJ.camp(a) === "meute")) {
    const autre = villageois().find(a => a.system.compagnon && secretDuMJ.camp(a) !== "meute");
    await api.echangerRoles(h.id, autre.id);
  }
  await moteur.chaine;   // fil neuf de la nouvelle partie
  return { moteur, mj, ia, joueurs, controle, restaurer: () => { Math.random = hasardOrigine; } };
}

const attendrePilote = async (moteur, limite = 20000) => {
  for (let i = 0; i < limite && (moteur.pilote.boucle || !moteur.auRepos()); i++) await new Promise(r => setTimeout(r, 0));
  assert.equal(moteur.pilote.boucle, null, "le pilote tourne encore");
};

// Les humains meurent tôt : une première nuit (ils répondent par leur navigateur), puis le narrateur les fait exécuter dans un
// tour ordinaire (« [Script] » : la réponse du modèle doublure). À la fin de ce tour, le pilote démarre seul.
async function lesHumainsMeurent(moteur) {
  const nuit = await outil("loups_nuit").executer({ delai_secondes: 20 });
  assert.ok(!nuit.erreur, nuit.contenu);
  await calme();
  const humains = villageois().filter(a => a.system.joueur && a.system.vivant);
  const script = { texte: "Le village a tranché.", appels: humains.map((h, i) => ({ id: `h${i}`, nom: "loups_eliminer", args: { villageois: h.name, cause: "narrateur", reveler: true } })) };
  await moteur.tour(`[Messages et actions des joueurs]\n[Script]${JSON.stringify(script)}`);
}

// ------------------------------------------------------------------ les essais
const BILAN = [];
for (const graine of ["brume", "lanterne", "cendres"]) {
  test(`graine « ${graine} » : les humains meurent tôt, le pilote mène les compagnons jusqu'à la victoire, raconte le dénouement et s'arrête`, async () => {
    const { moteur, mj, ia, controle, restaurer } = await monde(graine);
    try {
      assert.equal(moteur.pilote.enMarche, false, "un humain vivant : pas de pilote");
      await lesHumainsMeurent(moteur);
      assert.ok(villageois().filter(a => a.system.joueur).every(a => !a.system.vivant), "les humains sont morts");
      assert.equal(api.etat().vainqueur, "", "la partie continue sans eux");
      await new Promise(r => setTimeout(r, 0));
      assert.equal(moteur.pilote.enMarche, true, "le pilote a démarré seul, à la fin du tour où le dernier humain est mort");
      const appelsAvant = mj.appels.length, iaAvant = ia.appels.length, partie = api.etat().partie;
      await attendrePilote(moteur);
      const p = moteur.pilote;
      const etapes = p.journal.map(j => j.etape);
      assert.ok(api.etat().vainqueur, `pas de vainqueur : ${etapes.join(", ")}`);
      assert.equal(p.dernierArret.raison, "victoire");
      assert.equal(etapes.at(-1), "denouement");
      assert.equal(etapes.filter(e => e === "denouement").length, 1);
      assert.equal(controle.etapesPendantTour, 0, "une étape pendant un tour du MJ");
      // Les jours : nuit, aube, au plus deux tours de parole, vote, dépouillement, exécution.
      const jours = etapes.join(" ").split("nuit").slice(1).map(j => j.trim().split(" ").filter(Boolean));
      for (const j of jours) assert.ok(j.filter(e => e === "debat").length <= 2, `débat trop long : ${j.join(", ")}`);
      if (process.env.TRACE_PILOTE) console.log(graine, etapes.join(", "), api.etat().vainqueur);
      assert.ok(etapes.includes("vote-ouvrir") || etapes[0] === "nuit");
      // Les compagnons ont vraiment joué : choix de nuit, répliques (avec didascalie) au débat, votes.
      const repliques = messages.filter(m => m.flags?.[ID]?.compagnon);
      assert.ok(repliques.length > 0, "aucune réplique au débat");
      assert.ok(repliques.every(m => /^<p><em class="lakour-mjia-didascalie">/.test(m.content)), "didascalie en italique");
      assert.ok(ia.appels.includes("decider"), "les compagnons ont choisi et voté par leur cerveau");
      // Le narrateur n'a jamais relancé de partie ; tous ses récits sont au chat.
      assert.equal(api.etat().phase, "fin");
      assert.equal(api.etat().partie, partie, "aucune autre partie relancée");
      assert.ok(messages.some(m => m.flags?.[ID]?.narration && /Ainsi finit la veillée/.test(m.content)), "le dénouement est raconté");
      // Arrêt net : plus rien ne bouge.
      const n = mj.appels.length;
      moteur.pilote.verifier();
      await new Promise(r => setTimeout(r, 5));
      assert.equal(moteur.pilote.enMarche, false);
      assert.equal(mj.appels.length, n);
      // Le coût d'un jour de pilote.
      const nbJours = etapes.filter(e => e === "aube").length;
      BILAN.push({ graine, etapes: etapes.length, jours: nbJours, vainqueur: api.etat().vainqueur, mj: mj.appels.length - appelsAvant, compagnons: ia.appels.length - iaAvant,
        tours: mj.appels.slice(appelsAvant).filter(a => a.etape !== "résultats").length });
    } finally {
      moteur.pilote.arreter("seance");
      restaurer();
    }
  });
}

test("bilan : coût d'un jour de pilote (appels au narrateur et aux compagnons)", () => {
  assert.equal(BILAN.length, 3);
  for (const b of BILAN) {
    console.log(`Pilote « ${b.graine} » : ${b.etapes} étapes, ${b.jours} jours, victoire ${b.vainqueur} ; narrateur ${b.mj} appels (${b.tours} tours), `
      + `compagnons ${b.compagnons} appels ; par jour ≈ ${(b.mj / b.jours).toFixed(1)} appels au narrateur (${(b.tours / b.jours).toFixed(1)} tours), `
      + `${(b.compagnons / b.jours).toFixed(1)} aux compagnons.`);
    assert.ok(b.mj / b.jours <= 14, "un jour de pilote coûte au plus ~14 appels au narrateur");
  }
});

test("un humain vit encore : pas de pilote ; en mode Validation, pas de pilote non plus, un avis au MJ (une seule fois)", async () => {
  const { moteur, restaurer } = await monde("moulin");
  try {
    const nuit = await outil("loups_nuit").executer({ delai_secondes: 20 });
    assert.ok(!nuit.erreur);
    await calme();
    const humains = villageois().filter(a => a.system.joueur && a.system.vivant);
    await moteur.tour(`[Messages et actions des joueurs]\n[Script]${JSON.stringify({ texte: "Un seul part.", appels: [{ id: "h", nom: "loups_eliminer", args: { villageois: humains[0].name, cause: "narrateur", reveler: true } }] })}`);
    await new Promise(r => setTimeout(r, 0));
    if (villageois().some(a => a.system.joueur && a.system.vivant)) assert.equal(moteur.pilote.enMarche, false, "un humain vivant : le pilote attend");
    // Mode Validation : le dernier humain meurt, pas de pilote, un avis.
    await game.settings.set(ID, "autonomie", "validation");
    for (const h of villageois().filter(a => a.system.joueur && a.system.vivant)) await api.eliminer(h.id, { cause: "narrateur" });
    moteur.pilote.verifier(); moteur.pilote.verifier();
    assert.equal(moteur.pilote.enMarche, false);
    const avis = messages.filter(m => /LAKOUR_MJIA\.Pilote\.Validation/.test(m.content ?? ""));
    assert.equal(avis.length, 1, "un avis au MJ humain");
    assert.deepEqual(avis[0].whisper, ["mj"], "chuchoté au MJ");
    // Passé en autonome : il démarre ; un humain revient (le Puits, un joueur rattaché…) : il rend la main.
    await game.settings.set(ID, "autonomie", "autonome");
    moteur.pilote.verifier();
    assert.equal(moteur.pilote.enMarche, true);
    const h = villageois().find(a => a.system.joueur);
    await h.update({ "system.vivant": true });
    moteur.pilote.verifier();
    assert.equal(moteur.pilote.enMarche, false);
    assert.equal(moteur.pilote.dernierArret.raison, "humain");
    await attendrePilote(moteur);
  } finally {
    moteur.pilote.arreter("seance");
    restaurer();
  }
});
