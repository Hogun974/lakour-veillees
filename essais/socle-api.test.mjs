// Le SOCLE du Pacte dans l'API du système (game.lakourLoups), sur la doublure de Foundry : le cercle fixé à la distribution
// (public, voisins, un gens de passage au bout, la mise en scène du jour qui le suit), le dernier geste de la Braconnière (une
// demande posthume à elle seule — joueur par le socket, compagnon IA par son résolveur —, sa réponse appliquée, la Table qui
// l'attend ; sans réponse, ou si elle passe, le MJ garde la main ; s'il tranche avant, la demande se ferme ; tuée la nuit, elle ne
// choisit qu'une fois toutes les morts tombées), le rôle public (retourné dès la distribution, rien d'autre ne sort ; le rôle seul,
// sans camp), les bâtiments tenus (publics, vacants à la mort, au Registre) et les événements (lus par api.evenements, le présage
// de l'Almanach compris). Chaque vérification est rejouée sur des copies mutées du système (une règle cassée à la fois).
// Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installerFoundry, creerObjetMonde, emissions, reglages, envoyerAuMJ, calme, messages, ajouterScene, FR } from "./doublures/foundry-loups.mjs";
import { PLAN_VILLAGE } from "../modules/lakour-veillees/contenu/village.mjs";

installerFoundry({ contenu: true });
const SYSTEME = fileURLToPath(new URL("../systems/lakour-loups/", import.meta.url));
const CANAL = "system.lakour-loups";
const G = FR.LAKOUR_LOUPS.Gestes.emporter;

async function charger(racine) {
  const m = f => import(pathToFileURL(join(racine, f)).href);
  const [api, socket, reglagesM, L, MJ, plateau] = await Promise.all([m("scripts/api.mjs"), m("scripts/socket.mjs"), m("scripts/reglages.mjs"),
    m("logique/index.mjs"), m("scripts/actions-mj.mjs"), m("scripts/plateau.mjs")]);
  return { api: api.api, attendreGestes: api.attendreGestes, socket, reglages: reglagesM, L, MJ, plateau, racine };
}

// Un monde : sept joueurs simulés à la main (u7 reste spectateur, pour arriver en gens de passage), le contenu (rôles de
// passage), des rôles du monde. Délai des choix : une seconde (une demande sans réponse ne tient pas l'essai).
async function monde(M) {
  installerFoundry({ joueurs: 7, contenu: true });
  M.reglages.enregistrerReglages(() => {});
  M.socket.ecouterSocket();
  game.lakourLoups = M.api;
  M.api.resolveurs.compagnon = null;
  delete globalThis.canvas;
  await game.settings.set("lakour-loups", "delaiChoix", 1);
  await game.settings.set("lakour-loups", "masques", false);
  const role = (nom, system) => creerObjetMonde(nom, "role", system);
  return {
    loup: role("Loup de Brumecombe", { cle: "loup-de-brumecombe", camp: "meute", effet: "tuer", nuit: { actif: true, ordre: 40 } }),
    braco: role("Braconnière", { cle: "braconniere", effet: "emporter", description: "<p>Elle emporte un vivant à sa mort.</p>" }),
    pecheur: role("Pêcheur de nuit", { cle: "pecheur-de-nuit", effet: "tuer", nuit: { actif: true, ordre: 48 }, usages: { max: 1, restant: 1 } }),
    franc: role("Franc-Villageois", { cle: "franc-villageois", public: true, description: "<p>Tout le monde sait qui il est.</p>" }),
    villageois: role("Villageois", { cle: "villageois" }),
    forgeron: creerObjetMonde("Forgeron", "metier", { cle: "forgeron" })
  };
}
const villageois = () => game.actors.filter(a => a.type === "villageois");
const roleDe = a => secretDuMJ.role(a);
const cle = a => roleDe(a)?.system.cle;
const publicBrut = () => reglages.get("lakour-loups.partie").valeur;
const numero = a => Number(/(\d+)/.exec(a.system.maison)?.[1] ?? 0);

async function partie(M, U, roles) {
  await M.api.distribuer({ roles, metiers: [U.forgeron], joueurs: ["u1", "u2", "u3", "u4", "u5", "u6"], graine: "socle", composition: "essai", batiments: [] });
  return { de: c => villageois().find(a => cle(a) === c), tous: c => villageois().filter(a => cle(a) === c) };
}
async function attendre(condition, message) {
  for (let i = 0; i < 4000; i++) {
    if (condition()) return;
    await new Promise(r => setImmediate(r));
  }
  assert.fail(`jamais arrivé : ${message}`);
}
const demandesA = (acteur, depuis = 0) => emissions.slice(depuis).filter(e => e.type === "demande" && e.acteurId === acteur.id);
const demandeDe = (acteur, depuis = 0) => demandesA(acteur, depuis).at(-1);
function repondre(demande, cibles, qui = demande.destinataire) {
  envoyerAuMJ(CANAL, { type: "reponse", id: demande.id, cibles: cibles.map(a => a.id), userId: qui }, { emetteur: qui });
}
const notesDuMJ = M => M.api.etat().journalSecret.map(x => x.texte);
const remplir = (modele, d) => modele.replace(/\{(\w+)\}/g, (_, k) => d[k] ?? "");

const VERIFICATIONS = {
  async "cercle : fixé à la distribution dans l'ordre des maisons, public ; voisins (morts sautés) ; un arrivant au bout"(M) {
    const U = await monde(M);
    await partie(M, U, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const attendu = [...villageois()].sort((a, b) => numero(a) - numero(b) || a.id.localeCompare(b.id)).map(a => a.id);
    assert.deepEqual(publicBrut().cercle, attendu, "l'ordre des maisons, dans l'état public");
    assert.deepEqual(M.api.cercle().map(x => x.acteurId), attendu);
    const [a, b, c] = attendu;
    assert.deepEqual(M.api.voisins(b), { gauche: a, droite: c });
    assert.deepEqual(M.api.voisins(a).gauche, attendu.at(-1), "le cercle se referme");
    await M.api.changerPhase("jour");
    await M.api.eliminer(b, { cause: "vote" });
    assert.deepEqual(M.api.voisins(a).droite, c, "le mort est sauté");
    assert.deepEqual(M.api.voisins(a, { vivantsSeulement: false }).droite, b);
    assert.equal(M.api.cercle().find(x => x.acteurId === b).vivant, false);
    // Un gens de passage (u7) s'assoit au bout, sans déplacer personne.
    const r = await M.api.accueillir({ userId: "u7" });
    assert.deepEqual(publicBrut().cercle, [...attendu, r.acteurId]);
    assert.deepEqual(M.api.voisins(r.acteurId), { gauche: attendu.at(-1), droite: a });
  },

  async "cercle : la mise en scène du jour, sur la place, suit l'ordre des places"(M) {
    const U = await monde(M);
    ajouterScene({ nom: "Brumecombe", plan: PLAN_VILLAGE });
    await partie(M, U, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    await M.api.changerPhase("jour");
    const position = id => { const j = M.api.plateau.voulu().jetons.get(id); return `${j.x}:${j.y}`; };
    const cercle = publicBrut().cercle;
    const premiere = position(cercle[0]);
    // Le même village, le cercle à l'envers : la première place du cercle va au dernier de l'ancien ordre.
    reglages.get("lakour-loups.partie").valeur = { ...publicBrut(), cercle: [...cercle].reverse() };
    assert.equal(position(cercle.at(-1)), premiere, "la première place suit le cercle de la partie");
    assert.notEqual(position(cercle[0]), premiere);
  },

  async "geste : la Braconnière éliminée reçoit seule une demande posthume ; sa réponse emporte un vivant ; la Table l'attend"(M) {
    const U = await monde(M);
    const { de } = await partie(M, U, [U.loup, U.braco, U.villageois, U.villageois, U.villageois, U.villageois]);
    const braco = de("braconniere");
    await M.api.changerPhase("jour");
    const n = emissions.length;
    await M.api.eliminer(braco.id, { cause: "vote" });
    await attendre(() => demandeDe(braco, n), "la demande posthume");
    const d = demandeDe(braco, n);
    assert.deepEqual([d.posthume, d.objet, d.invite], [true, "emporter", G.Invite]);
    assert.deepEqual(d.recipients, [braco.system.joueur], "à elle seule");
    const vivants = villageois().filter(a => a.system.vivant).map(a => a.id).sort();
    assert.deepEqual(d.candidats.map(c => c.id).sort(), vivants, "les vivants, elle exceptée");
    const e = M.api.etapeSuivante();
    assert.deepEqual([e.cle, e.action, e.attente, e.detail.cle], ["emporter", "emporter", true, "emporterDemande"], "la Table l'attend, le bouton reste");
    assert.deepEqual(M.api.derniersGestes().map(g => [g.acteurId, g.geste, g.demande]), [[braco.id, "emporter", true]]);
    const cible = game.actors.get(d.candidats[1].id);
    repondre(d, [cible]);
    await attendre(() => !cible.system.vivant, "la cible emportée");
    await calme();
    await M.attendreGestes();
    assert.equal(M.api.etat().morts.at(-1).cause, "emporte");
    assert.ok(notesDuMJ(M).includes(remplir(G.Choisi, { nom: braco.name, cibles: cible.name })), "le MJ est prévenu");
    assert.notEqual(M.api.etapeSuivante().cle, "emporter", "le geste est fait");
    assert.deepEqual(M.api.derniersGestes(), []);
    // Une seconde réponse (la même demande) n'emporte personne de plus.
    const autre = game.actors.get(d.candidats[2].id);
    repondre(d, [autre]);
    await calme();
    await M.attendreGestes();
    assert.ok(autre.system.vivant);
  },

  async "geste : si elle passe, le MJ garde la main (une seule demande) ; sans réponse au délai aussi"(M) {
    const U = await monde(M);
    const { de } = await partie(M, U, [U.loup, U.braco, U.villageois, U.villageois, U.villageois, U.villageois]);
    const braco = de("braconniere");
    await M.api.changerPhase("jour");
    const n = emissions.length;
    await M.api.eliminer(braco.id, { cause: "vote" });
    await attendre(() => demandeDe(braco, n), "la demande posthume");
    repondre(demandeDe(braco, n), []);
    await attendre(() => notesDuMJ(M).includes(remplir(G.Personne, { nom: braco.name })), "le MJ prévenu");
    await M.attendreGestes();
    assert.equal(demandesA(braco, n).length, 1, "une seule demande par mort");
    const e = M.api.etapeSuivante();
    assert.deepEqual([e.cle, e.attente, e.detail.cle], ["emporter", false, "emporter"], "l'étape du MJ, en repli");
    const cible = villageois().find(a => a.system.vivant && a.id !== braco.id);
    await M.MJ.emporter(cible.id);
    assert.equal(cible.system.vivant, false);
    assert.notEqual(M.api.etapeSuivante().cle, "emporter");
    // Sans réponse : au délai (une seconde), le MJ est prévenu de même.
    const U2 = await monde(M);
    const p2 = await partie(M, U2, [U2.loup, U2.braco, U2.villageois, U2.villageois, U2.villageois, U2.villageois]);
    const b2 = p2.de("braconniere");
    await M.api.changerPhase("jour");
    const n2 = emissions.length;
    await M.api.eliminer(b2.id, { cause: "vote" });
    await attendre(() => demandeDe(b2, n2), "la demande posthume");
    await M.attendreGestes();
    assert.ok(notesDuMJ(M).includes(remplir(G.Personne, { nom: b2.name })), "au délai, le MJ est prévenu");
    assert.equal(M.api.etapeSuivante().cle, "emporter");
  },

  async "geste : le MJ tranche avant elle — sa fenêtre se ferme, sa réponse tardive est ignorée"(M) {
    const U = await monde(M);
    const { de } = await partie(M, U, [U.loup, U.braco, U.villageois, U.villageois, U.villageois, U.villageois]);
    const braco = de("braconniere");
    await M.api.changerPhase("jour");
    const n = emissions.length;
    await M.api.eliminer(braco.id, { cause: "vote" });
    await attendre(() => demandeDe(braco, n), "la demande posthume");
    const d = demandeDe(braco, n);
    const [x, y] = d.candidats.map(c => game.actors.get(c.id));
    await M.MJ.emporter(x.id);
    assert.ok(emissions.slice(n).some(e => e.type === "annuler" && e.id === d.id && e.recipients?.[0] === braco.system.joueur), "sa fenêtre se ferme");
    repondre(d, [y]);
    await calme();
    await M.attendreGestes();
    assert.ok(y.system.vivant, "sa réponse tardive n'emporte personne");
    assert.equal(M.api.etat().morts.filter(m => m.cause === "emporte").length, 1);
  },

  async "geste : une Braconnière compagnon IA choisit par son résolveur ; tuée la nuit, une fois toutes les morts tombées"(M) {
    const U = await monde(M);
    const { de } = await partie(M, U, [U.loup, U.pecheur, U.braco, U.villageois, U.villageois, U.villageois]);
    const loup = de("loup-de-brumecombe"), pecheur = de("pecheur-de-nuit"), braco = de("braconniere");
    const victime = villageois().find(a => cle(a) === "villageois");
    // Sa place passe à un compagnon IA (sans joueur).
    await braco.update({ "system.joueur": "", "system.compagnon": true });
    const recues = [];
    M.api.resolveurs.compagnon = async demande => { recues.push(demande); return [demande.candidats.at(-1).id]; };
    await M.api.changerPhase("nuit");
    await M.api.noterAction({ acteurId: loup.id, roleCle: "meute", cibles: [braco.id] });
    await M.api.noterAction({ acteurId: pecheur.id, roleCle: "pecheur-de-nuit", cibles: [victime.id] });
    await M.api.changerPhase("aube");
    const r = await M.api.resoudreNuit({ chuchoter: true });
    assert.deepEqual(r.morts.sort(), [braco.id, victime.id].sort());
    await attendre(() => recues.some(x => x.objet === "emporter"), "la demande au résolveur");
    await M.attendreGestes();
    const d = recues.find(x => x.objet === "emporter");
    assert.deepEqual([d.acteurId, d.posthume], [braco.id, true]);
    assert.ok(!d.candidats.some(c => c.id === victime.id || c.id === braco.id), "ni un mort de la même nuit, ni elle-même");
    const cible = game.actors.get(d.candidats.at(-1).id);
    assert.equal(cible.system.vivant, false, "son choix est appliqué");
    assert.equal(M.api.etat().morts.at(-1).cause, "emporte");
  },

  async "rôle public : retourné dès la distribution, devant tous, et lui seul ; le rôle seul, sans son camp"(M) {
    const U = await monde(M);
    const { de } = await partie(M, U, [U.loup, U.franc, U.villageois, U.villageois, U.villageois, U.villageois]);
    const franc = de("franc-villageois"), loup = de("loup-de-brumecombe");
    const objet = franc.items.find(i => i.type === "role");
    assert.ok(objet && objet.system.cle === "franc-villageois", "l'objet de rôle au document");
    assert.deepEqual([franc.system.revele, franc.system.camp], [true, "village"]);
    assert.ok(messages.some(m => m.content.includes(remplir(FR.LAKOUR_LOUPS.Public.Annonce, { nom: franc.name, role: "Franc-Villageois" }))), "annoncé au chat");
    for (const a of villageois().filter(x => x.id !== franc.id)) {
      assert.ok(!a.items.some(i => i.type === "role") && !a.system.revele && !a.system.camp, `${a.name} : rien de retourné`);
    }
    // Rien de la meute ne sort avec lui : ni dans l'état public, ni dans le chat, ni vers un autre que le loup.
    assert.ok(!JSON.stringify(publicBrut()).includes("loup-de-brumecombe"));
    assert.ok(!messages.some(m => m.content.includes("Loup de Brumecombe")));
    for (const e of emissions.filter(x => JSON.stringify(x).includes("loup-de-brumecombe"))) assert.deepEqual(e.recipients, [loup.system.joueur], `${e.type} hors du loup`);
    // Le rôle seul (variante Double visage, plus tard) : l'objet de rôle, sans le camp public.
    const autre = villageois().find(a => cle(a) === "villageois");
    await M.api.reveler(autre.id, { roleSeul: true });
    assert.ok(autre.items.some(i => i.type === "role"));
    assert.deepEqual([autre.system.revele, autre.system.camp], [true, ""]);
    await M.api.reveler(loup.id);
    assert.equal(loup.system.camp, "meute", "la révélation ordinaire publie le camp du rôle");
  },

  async "tenures : un bâtiment confié (public) ; à la mort de l'occupant, vacant et inscrit au Registre"(M) {
    const U = await monde(M);
    await partie(M, U, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    const [a, b] = villageois();
    await M.api.tenir("prieure", a.id);
    await M.api.tenir("fournil", b.id);
    assert.deepEqual(publicBrut().tenures, { prieure: a.id, fournil: b.id });
    assert.deepEqual(M.api.tenures().map(x => [x.cle, x.nom]), [["prieure", a.name], ["fournil", b.name]]);
    await M.api.changerPhase("jour");
    await M.api.eliminer(a.id, { cause: "vote" });
    assert.deepEqual(publicBrut().tenures, { prieure: null, fournil: b.id });
    const x = M.api.registre().find(y => y.type === "vacance");
    assert.deepEqual([x.acteurId, x.batiments], [a.id, ["prieure"]]);
    assert.ok(M.api.registreTexte().some(l => l === remplir(FR.LAKOUR_LOUPS.Registre.Vacance, { tour: 0, nom: a.name, batiments: "prieure" })));
    await assert.rejects(() => M.api.tenir("prieure", a.id), /mort/);
    await assert.rejects(() => M.api.tenir("", b.id));
    await M.api.tenir("fournil", "");
    assert.deepEqual(publicBrut().tenures.fournil, null, "libéré par le MJ");
  },

  async "événements : api.evenements lit le registre et le présage de l'Almanach, actifs selon le tour et la phase"(M) {
    const U = await monde(M);
    await partie(M, U, [U.loup, U.villageois, U.villageois, U.villageois, U.villageois, U.villageois]);
    await M.api.changerPhase("nuit");
    await M.api.changerPhase("aube");
    // Comme l'écrirait un tirage du MJ actif (Gazette de la lune, plus tard) : un événement de jour, un présage de nuit.
    const p = M.L.tirerEvenement({ ...publicBrut(), presage: { actif: true, cle: "givre", tour: 1 } }, { cle: "foire-aux-bestiaux", definition: { type: "immediat", quand: "jour" } });
    reglages.get("lakour-loups.partie").valeur = p;
    const ev = M.api.evenements();
    assert.deepEqual(ev.map(x => [x.cle, x.actif, x.source ?? ""]), [["foire-aux-bestiaux", true, ""], ["givre", false, "almanach"]]);
    reglages.get("lakour-loups.partie").valeur = { ...p, phase: "nuit", tour: 2 };
    assert.deepEqual(M.api.evenements().map(x => [x.cle, x.actif]), [["givre", true]], "la foire est finie ; le givre tient la nuit");
  }
};

const MUTATIONS = [
  ["scripts/api.mjs", "      e.cercle = L.ordreDesPlaces(enJeu);\n", "", "cercle : fixé à la distribution"],
  ["scripts/plateau.mjs", ", morts: etat.morts, cercle: etat.cercle });", ", morts: etat.morts });", "mise en scène : le cercle de la partie"],
  ["scripts/api.mjs", "    suivreGestes();\n    suivreSuccession();\n    diffuserVus();", "    suivreSuccession();\n    diffuserVus();", "geste : demandé à la mort"],
  ["scripts/api.mjs", "annonces }]);\n    suivreGestes();", "annonces }]);", "geste : demandé après la nuit"],
  ["scripts/api.mjs", "  if (mortsDeLaNuit) return gestes;\n", "", "geste : après toutes les morts de la nuit"],
  ["scripts/api.mjs", "nombre: L.nombreDuGeste(geste, candidats), posthume: true, objet: def.objet })", "nombre: L.nombreDuGeste(geste, candidats), objet: def.objet })", "geste : demande posthume"],
  ["scripts/api.mjs", "    gestesDemandes.add(cle(g));\n", "", "geste : une demande par mort"],
  ["scripts/api.mjs", "    else for (const id of v.cibles) await api.eliminer(id, { cause: def.cause });\n", "", "geste : appliqué"],
  ["scripts/api.mjs", "    fermerGestes(cause);\n", "", "geste : le MJ tranche, la demande se ferme"],
  ["scripts/api.mjs", "if (v.raison === \"personne\") await noterPourMJ(", "if (false) await noterPourMJ(", "geste : le MJ prévenu"],
  ["scripts/api.mjs", ", ...[...gestesEnCours.keys()].map(id => `geste:${id}`)", "", "geste : la Table attend"],
  ["scripts/api.mjs", "    await revelerLesRolesPublics(sortie.map(s => s.acteurId));\n", "", "rôle public : retourné"],
  ["scripts/api.mjs", "if (!role?.system?.public || etat.somnambules?.[id]) continue;", "if (etat.somnambules?.[id]) continue;", "rôle public : lui seul"],
  ["scripts/api.mjs", "if (camp && !sansCamp && a.system.camp !== camp)", "if (camp && a.system.camp !== camp)", "rôle seul : sans camp"],
  ["scripts/api.mjs", "if (!a.system.vivant) throw new Error(t(\"LAKOUR_LOUPS.Tenures.Refus.mort\"", "if (false) throw new Error(t(\"LAKOUR_LOUPS.Tenures.Refus.mort\"", "tenures : pas un mort"]
];

const dossiersARetirer = [];
async function chargerMutant(fichier, avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-socle-api-"));
  cpSync(join(SYSTEME, "logique"), join(dossier, "logique"), { recursive: true });
  cpSync(join(SYSTEME, "scripts"), join(dossier, "scripts"), { recursive: true });
  const chemin = join(dossier, fichier);
  const texte = readFileSync(chemin, "utf8");
  assert.ok(texte.includes(avant), `mutation introuvable dans ${fichier} : ${avant}`);
  writeFileSync(chemin, texte.replace(avant, apres));
  dossiersARetirer.push(dossier);
  return charger(dossier);
}

async function echecs(M) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { await verifier(M); } catch (e) { liste.push({ nom, e }); }
    finally { game.user = game.users.get("mj"); await calme().catch(() => {}); await M.attendreGestes().catch(() => {}); }
  }
  return liste;
}

test("socle (API) : le système d'origine passe toute la batterie", async () => {
  const e = await echecs(await charger(SYSTEME));
  assert.deepEqual(e.map(x => `${x.nom} : ${x.e.message}`), []);
});

test("socle (API) : chaque règle cassée est détectée par la batterie", async () => {
  const passees = [];
  for (const [fichier, avant, apres, regle] of MUTATIONS) {
    if (!(await echecs(await chargerMutant(fichier, avant, apres))).length) passees.push(`${regle} (${fichier})`);
  }
  for (const d of dossiersARetirer.splice(0)) rmSync(d, { recursive: true, force: true });
  assert.deepEqual(passees, [], "mutations passées inaperçues");
});
