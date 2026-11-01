// Installation du contenu des Veillées de Brumecombe dans un monde lakour-loups : guides et variantes dans le journal
// (le guide du narrateur reste caché), scène du village de Brumecombe, plans des cartes pour le placement des jetons,
// style visuel plat ou relief. Rôles, métiers, bâtiments, tables et villageois non joués restent dans les compendiums :
// la Table de jeu du système et le MJ IA les y lisent.
const ID = "lakour-veillees";
const SYSTEME = "lakour-loups";
const VERSION_CONTENU = "0.1.0";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

// ---------- Style visuel (plat / relief) : réglage du module MJ IA s'il est actif, sinon plat.
// Chaque image du module existe en deux versions : assets/<x>/<f>.svg (plat) et assets/<x>/3d/<f>.svg (relief).
const styleVisuel = () => (game.modules.get("lakour-mj-ia")?.active ? game.settings.get("lakour-mj-ia", "styleVisuel") : "2d");

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

export async function installer() {
  const rapport = [];
  const nomDossier = game.i18n.localize("LAKOURVEIL.Titre");

  // Guides et variantes : visibilité de chaque journal fixée par le compendium (guide du narrateur caché).
  const journaux = await game.packs.get(`${ID}.journaux`).getDocuments();
  for (const j of journaux) {
    if (game.journal.find(x => x.getFlag(ID, "cle") === j.getFlag(ID, "cle"))) continue;
    await JournalEntry.implementation.create({ ...game.journal.fromCompendium(j), folder: (await dossier("JournalEntry", nomDossier)).id });
    rapport.push(j.name);
  }

  // Scène du village ; les dessins (étiquettes des pièces) prennent le MJ pour auteur.
  const scenes = await game.packs.get(`${ID}.scenes`)?.getDocuments() ?? [];
  for (const s of scenes) {
    const cle = s.getFlag(ID, "cle");
    if (game.scenes.find(x => x.getFlag(ID, "cle") === cle)) continue;
    const donnees = game.scenes.fromCompendium(s);
    donnees.drawings = donnees.drawings?.map(d => ({ ...d, author: game.user.id }));
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

Hooks.once("ready", async () => {
  game.modules.get(ID).api = { installer, cheminSelonStyle, compositions };
  if (!game.user.isGM || game.user !== game.users.activeGM || game.system.id !== SYSTEME) return;
  if (game.settings.get(ID, "installe") === VERSION_CONTENU) return;
  const ok = await DialogV2.confirm({
    window: { title: "LAKOURVEIL.Titre" },
    content: `<p>${game.i18n.localize("LAKOURVEIL.Proposer")}</p>`,
    rejectClose: false
  });
  if (ok) await installer();
});
