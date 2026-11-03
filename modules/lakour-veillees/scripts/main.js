// Installation du contenu des Veillées de Brumecombe dans un monde lakour-loups : guides et variantes dans le journal
// (le guide du narrateur reste caché), scène du village de Brumecombe, plans des cartes pour le placement des jetons,
// style visuel plat ou relief. Rôles, métiers, bâtiments, tables et villageois non joués restent dans les compendiums :
// la Table de jeu du système et le MJ IA les y lisent. Le plateau du système (jetons posés et mis en scène à chaque phase)
// reçoit d'ici le jeton NEUTRE des Veillées (« villageois », qui cache le rôle) et le style visuel des images.
const ID = "lakour-veillees";
const SYSTEME = "lakour-loups";
// 0.3.0 : plan du village avec son plateau (seuils, cercle, cimetière) ; 0.5.0 (aligné sur module.json) : carte épinglée
// (une épingle par bâtiment vers sa page du guide du joueur, sons), journaux gardant leur identifiant et leur visibilité ;
// 0.8.0 : guides du Bailli, du Registre du greffier et des Masques de veillée (système 0.6.0) ; 0.9.0 : Somnambule, Rosière,
// Almanach des brumes, Dernier souffle et Saints du calendrier (système 0.7.0) ; 0.10.0 : Gens de passage (Rémouleur, Montreur
// d'ours, Pèlerine), Banc des accusés, Glas du deuil, Nuit de la Saint-Martin (système 0.8.0).
const VERSION_CONTENU = "0.11.0";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

// ---------- Style visuel (plat / relief) : réglage du module MJ IA s'il est actif, sinon plat.
// Chaque image du module existe en deux versions : assets/<x>/<f>.svg (plat) et assets/<x>/3d/<f>.svg (relief).
// Si le moteur n'a pas pu enregistrer son réglage (module inactif, ou erreur au chargement), style plat : rien ne bloque.
const styleVisuel = () => (game.settings.settings?.has?.("lakour-mj-ia.styleVisuel") ? game.settings.get("lakour-mj-ia", "styleVisuel") : "2d");

export function cheminSelonStyle(src, style) {
  if (!src?.startsWith(`modules/${ID}/assets/`)) return src;
  const plat = src.replace("/3d/", "/");
  if (style !== "3d") return plat;
  const i = plat.lastIndexOf("/");
  return `${plat.slice(0, i)}/3d${plat.slice(i)}`;
}

async function styliserScene(scene, style) {
  const niveau = scene.levels.contents[0];
  const voulu = cheminSelonStyle(niveau?.background.src, style);
  let n = 0;
  if (niveau && voulu !== niveau.background.src) { await scene.updateEmbeddedDocuments("Level", [{ _id: niveau.id, "background.src": voulu }]); n++; }
  const jetons = scene.tokens.filter(t => cheminSelonStyle(t.texture.src, style) !== t.texture.src)
    .map(t => ({ _id: t.id, "texture.src": cheminSelonStyle(t.texture.src, style) }));
  if (jetons.length) { await scene.updateEmbeddedDocuments("Token", jetons); n += jetons.length; }
  return n;
}

async function styliserActeur(acteur, style) {
  const maj = {};
  if (cheminSelonStyle(acteur.img, style) !== acteur.img) maj.img = cheminSelonStyle(acteur.img, style);
  const tex = acteur.prototypeToken.texture.src;
  if (cheminSelonStyle(tex, style) !== tex) maj["prototypeToken.texture.src"] = cheminSelonStyle(tex, style);
  if (Object.keys(maj).length) await acteur.update(maj);
  return Object.keys(maj).length ? 1 : 0;
}

async function appliquerStyle(style) {
  let n = 0;
  for (const scene of game.scenes) n += await styliserScene(scene, style);
  for (const acteur of game.actors) n += await styliserActeur(acteur, style);
  return n;
}

async function dossier(type, nom) {
  return game.folders.find(f => f.type === type && f.getFlag(ID, "dossier") === nom)
    ?? Folder.implementation.create({ name: nom, type, color: "#3a2a4a", flags: { [ID]: { dossier: nom } } });
}

// Compositions toutes prêtes (assets/compositions.json), pour la Table de jeu et le MJ IA.
export async function compositions() {
  try {
    return await (await fetch(foundry.utils.getRoute(`modules/${ID}/assets/compositions.json`), { cache: "no-store" })).json();
  } catch { return {}; }
}

// Un guide déjà installé d'une version précédente reprend les pages du compendium (avec leurs identifiants : les épingles
// les visent) et la visibilité du compendium (les installations d'avant 0.5.0 la perdaient) ; son nom, son dossier et les
// droits donnés à chaque joueur restent. Les retouches faites à la main dans ses pages sont perdues.
async function rafraichirJournal(existant, source) {
  if (existant.getFlag(ID, "version") === VERSION_CONTENU) return false;
  // Les pages que le MJ IA a ajoutées ou réécrites (modifier_scenario) restent telles quelles, avec leur historique.
  const gardees = new Set(existant.pages.filter(p => p.getFlag("lakour-mj-ia", "ajoutee") || p.getFlag("lakour-mj-ia", "historique")?.length).map(p => p.id));
  const remplacees = existant.pages.filter(p => !gardees.has(p.id)).map(p => p.id);
  if (remplacees.length) await existant.deleteEmbeddedDocuments("JournalEntryPage", remplacees);
  await existant.createEmbeddedDocuments("JournalEntryPage", source.pages.filter(p => !gardees.has(p.id)).map(p => p.toObject()), { keepId: true });
  await existant.update({ "ownership.default": source.ownership.default, [`flags.${ID}.version`]: VERSION_CONTENU });
  return true;
}

// Sons d'ambiance, zones et épingles de la carte du module, marqués comme tels. Les épingles visent les journaux du monde
// (journaux : identifiant au compendium -> identifiant dans le monde ; les pages gardent les leurs).
const COLLECTIONS_VIVANTES = [["AmbientSound", "sounds"], ["Region", "regions"], ["Note", "notes"]];
export function carteVivante(donnees, journaux) {
  const marque = d => foundry.utils.mergeObject(d, { [`flags.${ID}.carte`]: true }, { inplace: false });
  return {
    sounds: (donnees.sounds ?? []).map(marque),
    regions: (donnees.regions ?? []).map(marque),
    notes: (donnees.notes ?? []).map(n => marque({ ...n, entryId: journaux.get(n.entryId) ?? n.entryId }))
  };
}

// Une carte déjà importée d'une version précédente reçoit les sons, zones et épingles du module : ceux d'avant (marqués,
// ou portant l'identifiant d'un document du compendium, comme les sons déduits importés avant 0.5.0) sont remplacés ; ses
// jetons, ses lumières et ce que le MJ y a ajouté restent.
export async function rafraichirScene(scene, source, journaux) {
  if (scene.getFlag(ID, "version") === VERSION_CONTENU) return false;
  const donnees = source.toObject();
  const vivante = carteVivante(donnees, journaux);
  for (const [type, champ] of COLLECTIONS_VIVANTES) {
    const duModule = new Set((donnees[champ] ?? []).map(d => d._id));
    const anciens = scene[champ].filter(d => d.getFlag(ID, "carte") || duModule.has(d.id)).map(d => d.id);
    if (anciens.length) await scene.deleteEmbeddedDocuments(type, anciens);
    if (vivante[champ].length) await scene.createEmbeddedDocuments(type, vivante[champ], { keepId: true });
  }
  await scene.setFlag(ID, "version", VERSION_CONTENU);
  return true;
}

// Une seule installation à la fois (bouton cliqué deux fois, ou pendant la proposition du « ready ») ; une erreur est montrée
// au MJ au lieu de laisser l'installation à moitié faite sans rien dire.
let installationEnCours = null;
export function installer() {
  installationEnCours ??= installerContenu()
    .catch(erreur => {
      console.error(`${ID} | installation`, erreur);
      globalThis.ui?.notifications?.error?.(`Les Veillées : installation interrompue (${erreur.message}). Le détail est dans la console (F12).`, { permanent: true });
    })
    .finally(() => { installationEnCours = null; });
  return installationEnCours;
}

async function installerContenu() {
  const rapport = [];
  const nomDossier = game.i18n.localize("LAKOURVEIL.Titre");
  const journauxDuMonde = new Map();   // identifiant au compendium -> identifiant dans le monde

  // Guides et variantes : visibilité de chaque journal fixée par le compendium (guide du joueur et variantes visibles,
  // guide du narrateur caché), d'où clearOwnership: false.
  const journaux = await game.packs.get(`${ID}.journaux`).getDocuments();
  for (const j of journaux) {
    const existant = game.journal.find(x => x.getFlag(ID, "cle") === j.getFlag(ID, "cle"));
    if (existant) {
      journauxDuMonde.set(j.id, existant.id);
      if (await rafraichirJournal(existant, j)) rapport.push(`${j.name} (mis à jour)`);
      continue;
    }
    // Même identifiant qu'au compendium (s'il est libre) : les épingles de la carte le visent.
    const libre = !game.journal.get(j.id);
    const donnees = foundry.utils.mergeObject(game.journal.fromCompendium(j, { keepId: libre, clearOwnership: false }), { [`flags.${ID}.version`]: VERSION_CONTENU });
    const cree = await JournalEntry.implementation.create({ ...donnees, folder: (await dossier("JournalEntry", nomDossier)).id }, { keepId: libre });
    journauxDuMonde.set(j.id, cree.id);
    rapport.push(j.name);
  }

  // Scène du village ; les dessins (étiquettes des pièces) prennent le MJ pour auteur ; sons et épingles raccordés.
  const scenes = await game.packs.get(`${ID}.scenes`)?.getDocuments() ?? [];
  for (const s of scenes) {
    const cle = s.getFlag(ID, "cle");
    const existante = game.scenes.find(x => x.getFlag(ID, "cle") === cle);
    if (existante) {
      if (await rafraichirScene(existante, s, journauxDuMonde)) rapport.push(`${s.name} (sons et épingles)`);
      continue;
    }
    const donnees = game.scenes.fromCompendium(s);
    donnees.drawings = donnees.drawings?.map(d => ({ ...d, author: game.user.id }));
    Object.assign(donnees, carteVivante(donnees, journauxDuMonde));
    foundry.utils.setProperty(donnees, `flags.${ID}.version`, VERSION_CONTENU);
    await Scene.implementation.create({ ...donnees, folder: (await dossier("Scene", nomDossier)).id });
    rapport.push(s.name);
  }

  // Plan de chaque carte (maisons, bâtiments, place), recopié dans les scènes déjà importées s'il a changé.
  try {
    const plans = await (await fetch(foundry.utils.getRoute(`modules/${ID}/assets/cartes/plans.json`), { cache: "no-store" })).json();
    for (const scene of game.scenes.filter(x => plans[x.getFlag(ID, "cle")])) {
      const plan = plans[scene.getFlag(ID, "cle")];
      if (!foundry.utils.objectsEqual(scene.getFlag(ID, "plan") ?? {}, plan)) await scene.setFlag(ID, "plan", plan);
    }
  } catch (erreur) { console.warn(`${ID} | plans des cartes`, erreur); }

  await appliquerStyle(styleVisuel());
  await game.settings.set(ID, "installe", VERSION_CONTENU);
  ui.notifications.info(game.i18n.format("LAKOURVEIL.Installe", { liste: rapport.join(", ") || game.i18n.localize("LAKOURVEIL.RienDeNeuf") }));
}

// Bouton « Installer » dans les réglages du module : relancer l'installation à tout moment.
class FenetreInstallation extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-installation`,
    window: { title: "LAKOURVEIL.Titre", icon: "fa-solid fa-moon" },
    position: { width: 460, height: "auto" },
    actions: { installer: FenetreInstallation.#installer }
  };

  static PARTS = { corps: { template: `modules/${ID}/templates/installation.hbs` } };

  async _prepareContext() {
    return { systemeOk: game.system.id === SYSTEME, installe: game.settings.get(ID, "installe") };
  }

  static async #installer() {
    await installer();
    this.render();
  }
}

Hooks.once("init", () => {
  game.settings.register(ID, "installe", { scope: "world", config: false, type: String, default: "" });
  game.settings.registerMenu(ID, "installation", {
    name: "LAKOURVEIL.Titre",
    label: "LAKOURVEIL.Ouvrir",
    hint: "LAKOURVEIL.Aide",
    icon: "fa-solid fa-moon",
    type: FenetreInstallation,
    restricted: true
  });
});

// Style changé dans le MJ IA : on bascule carte et jetons (MJ actif seulement, pour n'écrire qu'une fois).
Hooks.on("lakourStyleVisuel", async style => {
  if (game.user !== game.users.activeGM || game.system.id !== SYSTEME) return;
  const n = await appliquerStyle(style);
  if (n) ui.notifications.info(game.i18n.format("LAKOURVEIL.StyleApplique", { n }));
});

// Un villageois ou une carte importés plus tard du compendium arrivent en version plate.
Hooks.on("createActor", acteur => {
  if (game.user === game.users.activeGM && game.system.id === SYSTEME && styleVisuel() === "3d") styliserActeur(acteur, "3d");
});
Hooks.on("createScene", scene => {
  if (game.user === game.users.activeGM && game.system.id === SYSTEME && styleVisuel() === "3d") styliserScene(scene, "3d");
});

// Le plateau du système lakour-loups : l'image neutre des jetons (jamais celle d'un rôle caché) et le style visuel.
const JETON_NEUTRE = `modules/${ID}/assets/jetons/villageois.svg`;
function configurerPlateau(api = game.lakourLoups) {
  api?.plateau?.configurer?.({ jetonNeutre: JETON_NEUTRE, styliser: src => cheminSelonStyle(src, styleVisuel()) });
}
Hooks.on("lakourLoups.pret", api => { if (game.system.id === SYSTEME) configurerPlateau(api); });
Hooks.on("lakourStyleVisuel", () => { if (game.system.id === SYSTEME && game.user === game.users.activeGM) game.lakourLoups?.plateau?.planifier?.(); });

Hooks.once("ready", async () => {
  game.modules.get(ID).api = { installer, cheminSelonStyle, compositions };
  if (game.system.id === SYSTEME) configurerPlateau();
  if (!game.user.isGM || game.user !== game.users.activeGM || game.system.id !== SYSTEME) return;
  if (game.settings.get(ID, "installe") === VERSION_CONTENU) return;
  const ok = await DialogV2.confirm({
    window: { title: "LAKOURVEIL.Titre" },
    content: `<p>${game.i18n.localize("LAKOURVEIL.Proposer")}</p>`,
    rejectClose: false
  });
  if (ok) await installer();
});
