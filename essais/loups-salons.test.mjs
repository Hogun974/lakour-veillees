// Salons vocaux des Veillées : la matrice pure « qui entend qui, qui peut parler » (logique/salons.mjs), ligne par ligne
// du tableau (lakour-mj-ia/docs/voix-et-ecoute.md §3), les loups spéciaux du contenu, le mordu, « les morts voient tout »,
// les préparatifs, la fin, le MJ, les compagnons IA, le réglage, la réponse prudente sans les secrets du MJ, et le secret
// de la ligne envoyée à chaque navigateur. Puis chaque règle est cassée à son tour dans une copie de la logique : la
// batterie doit alors échouer.  Lancer : npm run essais
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as L0 from "../systems/lakour-loups/logique/index.mjs";
import { ROLES } from "../modules/lakour-veillees/contenu/roles.mjs";

const SOURCE = fileURLToPath(new URL("../systems/lakour-loups/logique/", import.meta.url));

// ------------------------------------------------------------------ une table d'essai
// mj : la meneuse ; u1 loup (Loup de Brumecombe), u2 louve mère, u3 et u4 villageois, u5 mort, u6 réduit au silence,
// u7 spectateur (sans villageois) ; deux compagnons IA : c1 loup hurleur, c2 villageois ; un compagnon mort : c3.
const ROLE = { loup: { camp: "meute" }, village: { camp: "village" }, solitaire: { camp: "solitaire" } };
const v = (id, joueur, camp, extra = {}) => ({ id, joueur, vivant: true, silence: false, camp, role: { ...ROLE[camp] }, ...extra });
function tableEssai(extra = {}) {
  return {
    utilisateurs: [{ id: "mj", mj: true }, ...["u1", "u2", "u3", "u4", "u5", "u6", "u7"].map(id => ({ id, mj: false }))],
    villageois: [
      v("l1", "u1", "meute"), v("l2", "u2", "meute"), v("x3", "u3", "village"), v("x4", "u4", "village"),
      v("m5", "u5", "village", { vivant: false }), v("s6", "u6", "village", { silence: true }),
      v("c1", "", "meute"), v("c2", "", "village"), v("c3", "", "meute", { vivant: false })
    ],
    mortsVoientTout: false,
    ...extra
  };
}
const etat = phase => ({ partie: "p", phase });
const SECRETS = { partie: "p" };
const tri = l => [...l].sort();
const TOUS = ["mj", "u1", "u2", "u3", "u4", "u5", "u6", "u7"];
const sauf = (...ids) => TOUS.filter(id => !ids.includes(id));

// La batterie : chaque vérification lève une erreur si la règle n'est pas respectée.
const VERIFICATIONS = {
  "jour : un vivant est entendu de tous, vivants et morts": L => {
    for (const phase of ["aube", "jour", "vote"]) {
      const r = L.audibilite(etat(phase), SECRETS, "u3", tableEssai());
      assert.equal(r.peutParler, true, phase);
      assert.deepEqual(tri(r.auditeurs), sauf("u3"), phase);
      assert.deepEqual(tri(r.acteursAuditeurs), ["c1", "c2", "c3", "l1", "l2", "m5", "s6", "x4"], phase);
      assert.equal(r.salon, "village");
    }
    // Un loup, le jour, parle à tous comme les autres.
    assert.deepEqual(tri(L.audibilite(etat("jour"), SECRETS, "u1", tableEssai()).auditeurs), sauf("u1"));
  },
  "jour : un mort n'est entendu que des morts (et du MJ)": L => {
    const r = L.audibilite(etat("jour"), SECRETS, "u5", tableEssai());
    assert.equal(r.peutParler, true);
    assert.deepEqual(tri(r.auditeurs), ["mj", "u7"], "le MJ et le spectateur");
    assert.deepEqual(r.acteursAuditeurs, ["c3"], "le compagnon mort");
    assert.equal(r.salon, "morts");
    // Un compagnon mort parle aux morts.
    const c = L.audibilite(etat("vote"), SECRETS, { acteurId: "c3" }, tableEssai());
    assert.deepEqual(tri(c.auditeurs), ["mj", "u5", "u7"]);
    assert.deepEqual(c.acteursAuditeurs, ["m5"]);
  },
  "jour : un réduit au silence ne parle à personne pendant le débat et le vote": L => {
    for (const phase of ["jour", "vote"]) {
      const r = L.audibilite(etat(phase), SECRETS, "u6", tableEssai());
      assert.deepEqual([r.peutParler, r.auditeurs, r.acteursAuditeurs, r.salon], [false, [], [], "silence"], phase);
    }
    // À l'aube, sa voix n'est pas encore prise ; il entend toujours les autres.
    assert.equal(L.audibilite(etat("aube"), SECRETS, "u6", tableEssai()).peutParler, true);
    assert.ok(L.audibilite(etat("jour"), SECRETS, "u3", tableEssai()).auditeurs.includes("u6"), "il entend");
  },
  "nuit : un vivant se tait, personne ne l'entend": L => {
    for (const qui of ["u3", "u4"]) {
      const r = L.audibilite(etat("nuit"), SECRETS, qui, tableEssai());
      assert.deepEqual([r.peutParler, r.auditeurs, r.acteursAuditeurs, r.salon], [false, [], [], "nuit"], qui);
    }
    assert.equal(L.audibilite(etat("nuit"), SECRETS, { acteurId: "c2" }, tableEssai()).peutParler, false, "compagnon villageois");
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "u6", tableEssai()).peutParler, false, "réduit au silence");
  },
  "nuit : un loup n'est entendu que des loups (et du MJ)": L => {
    const r = L.audibilite(etat("nuit"), SECRETS, "u1", tableEssai());
    assert.equal(r.peutParler, true);
    assert.equal(r.salon, "taniere");
    assert.deepEqual(tri(r.auditeurs), ["mj", "u2"]);
    assert.deepEqual(tri(r.acteursAuditeurs), ["c1", "l2"], "la louve et le compagnon hurleur, pas le compagnon loup mort");
    const c = L.audibilite(etat("nuit"), SECRETS, { acteurId: "c1" }, tableEssai());
    assert.deepEqual(tri(c.auditeurs), ["mj", "u1", "u2"]);
    assert.deepEqual(tri(c.acteursAuditeurs), ["l1", "l2"]);
  },
  "nuit : avec « les morts voient tout », les morts entendent la tanière": L => {
    const r = L.audibilite(etat("nuit"), SECRETS, "u2", tableEssai({ mortsVoientTout: true }));
    assert.deepEqual(tri(r.auditeurs), ["mj", "u1", "u5", "u7"]);
    assert.deepEqual(tri(r.acteursAuditeurs), ["c1", "c3", "l1", "m5"]);
    // Sans le réglage, non.
    assert.deepEqual(tri(L.audibilite(etat("nuit"), SECRETS, "u2", tableEssai()).auditeurs), ["mj", "u1"]);
  },
  "nuit : un mort n'est entendu que des morts": L => {
    for (const mvt of [false, true]) {
      const r = L.audibilite(etat("nuit"), SECRETS, "u5", tableEssai({ mortsVoientTout: mvt }));
      assert.deepEqual(tri(r.auditeurs), ["mj", "u7"], `mortsVoientTout ${mvt}`);
    }
  },
  "les loups spéciaux du contenu sont à la tanière, les autres rôles non": L => {
    for (const r of ROLES) {
      const t = tableEssai();
      t.villageois[2] = { id: "x3", joueur: "u3", vivant: true, silence: false, camp: r.system.camp, role: { camp: r.system.camp } };
      const salon = L.audibilite(etat("nuit"), SECRETS, "u3", t).salon;
      assert.equal(salon, r.system.camp === "meute" ? "taniere" : "nuit", r.system.cle);
    }
    for (const cle of ["loup-de-brumecombe", "louve-mere", "loup-affame", "loup-hurleur", "loup-flaireur", "loup-deguise", "loup-des-roseaux"]) {
      assert.equal(ROLES.find(r => r.system.cle === cle)?.system.camp, "meute", cle);
    }
  },
  "le camp actuel compte : un mordu rejoint la tanière, un loup échangé la quitte": L => {
    const t = tableEssai();
    t.villageois[2].camp = "meute";                                    // mordu : rôle du village, camp meute
    t.villageois[0] = { ...t.villageois[0], camp: "village", role: { camp: "village" } };   // le Colporteur a pris son rôle
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "u3", t).salon, "taniere", "le mordu");
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "u1", t).salon, "nuit", "l'ancien loup");
    assert.ok(L.audibilite(etat("nuit"), SECRETS, "u2", t).auditeurs.includes("u3"), "la louve entend le mordu");
    // Sans camp, le rôle décide.
    t.villageois[3] = { ...t.villageois[3], camp: "", role: { camp: "meute" } };
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "u4", t).salon, "taniere");
  },
  "préparatifs et fin : tout le monde parle à tout le monde": L => {
    for (const phase of ["preparation", "fin"]) {
      for (const qui of ["u1", "u3", "u5", "u6", "u7"]) {
        const r = L.audibilite(etat(phase), SECRETS, qui, tableEssai());
        assert.equal(r.peutParler, true, `${phase} ${qui}`);
        assert.deepEqual(tri(r.auditeurs), sauf(qui), `${phase} ${qui}`);
        assert.equal(r.salon, "libre");
      }
    }
  },
  "le MJ entend tout et parle à tous, à toute phase": L => {
    for (const phase of L0.PHASES) {
      const r = L.audibilite(etat(phase), SECRETS, "mj", tableEssai());
      assert.deepEqual([r.peutParler, tri(r.auditeurs), r.salon], [true, sauf("mj"), "mj"], phase);
      const ligne = L.ligneDe(etat(phase), SECRETS, "mj", tableEssai());
      const parlent = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"].filter(u => L.audibilite(etat(phase), SECRETS, u, tableEssai()).peutParler);
      assert.deepEqual(tri(ligne.entend), parlent, `le MJ entend tous ceux qui parlent (${phase})`);
      for (const u of parlent) assert.ok(L.audibilite(etat(phase), SECRETS, u, tableEssai()).auditeurs.includes("mj"), `${phase} ${u}`);
    }
    // Un MJ qui incarne un villageois reste le MJ.
    const t = tableEssai();
    t.villageois[3].joueur = "mj";
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "mj", t).salon, "mj");
  },
  "un spectateur observe comme un mort": L => {
    const r = L.audibilite(etat("jour"), SECRETS, "u7", tableEssai());
    assert.deepEqual([r.salon, tri(r.auditeurs)], ["morts", ["mj", "u5"]]);
    assert.ok(L.ligneDe(etat("jour"), SECRETS, "u7", tableEssai()).entend.includes("u3"), "il entend les vivants le jour");
  },
  "réglage coupé : tout le monde parle à tout le monde": L => {
    const r = L.audibilite(etat("nuit"), SECRETS, "u3", tableEssai({ automatique: false }));
    assert.deepEqual([r.peutParler, r.salon, tri(r.auditeurs)], [true, "libre", sauf("u3")]);
    assert.equal(L.audibilite(etat("nuit"), SECRETS, "u3", tableEssai()).peutParler, false, "réglage par défaut : actif");
  },
  "sans les secrets du MJ : aucun loup connu, sauf la meute d'un loup": L => {
    assert.equal(L.audibilite(etat("nuit"), null, "u1", tableEssai()).salon, "nuit", "prudent : personne n'est loup");
    const t = tableEssai({ loupsConnus: ["l1", "l2"] });
    const r = L.audibilite(etat("nuit"), null, "u2", t);
    assert.deepEqual([r.salon, tri(r.auditeurs)], ["taniere", ["mj", "u1"]]);
  },
  "la ligne d'un navigateur : qui il entend, qui l'entend, s'il parle": L => {
    const nuitLoup = L.ligneDe(etat("nuit"), SECRETS, "u1", tableEssai());
    assert.deepEqual([nuitLoup.phase, nuitLoup.salon, nuitLoup.peutParler, tri(nuitLoup.auditeurs), tri(nuitLoup.entend), tri(nuitLoup.loups)],
      ["nuit", "taniere", true, ["mj", "u2"], ["mj", "u2"], ["c1", "l1", "l2"]]);
    const jourMort = L.ligneDe(etat("jour"), SECRETS, "u5", tableEssai());
    assert.deepEqual(tri(jourMort.entend), ["mj", "u1", "u2", "u3", "u4", "u7"], "un mort entend les vivants qui parlent et les morts");
    const jourVivant = L.ligneDe(etat("jour"), SECRETS, "u3", tableEssai());
    assert.deepEqual(tri(jourVivant.entend), ["mj", "u1", "u2", "u4"], "un vivant n'entend ni les morts ni le réduit au silence");
    const nuitMort = L.ligneDe(etat("nuit"), SECRETS, "u5", tableEssai({ mortsVoientTout: true }));
    assert.deepEqual(tri(nuitMort.entend), ["mj", "u1", "u2", "u7"]);
    assert.equal(L.ligneDe(etat("nuit"), SECRETS, "u5", tableEssai()).entend.includes("u1"), false, "sans le réglage, pas la tanière");
    const toutes = L.lignesDeTous(etat("nuit"), SECRETS, tableEssai());
    assert.deepEqual(Object.keys(toutes).sort(), TOUS);
  },
  "le secret : la nuit, la ligne d'un non-loup ne nomme aucun loup": L => {
    const LOUPS = ["u1", "u2", "l1", "l2", "c1"];
    for (const qui of ["u3", "u4", "u6"]) {
      for (const mvt of [false, true]) {
        const ligne = L.ligneDe(etat("nuit"), SECRETS, qui, tableEssai({ mortsVoientTout: mvt }));
        const texte = JSON.stringify(ligne);
        for (const id of LOUPS) assert.ok(!texte.includes(`"${id}"`), `${qui} : ${id} dans ${texte}`);
        assert.equal("loups" in ligne, false);
        assert.deepEqual(ligne.entend, ["mj"], `${qui} n'entend que le MJ`);
      }
    }
    // Ni le jour : rien n'y dit qui est loup.
    assert.equal("loups" in L.ligneDe(etat("jour"), SECRETS, "u1", tableEssai()), false);
  },
  "un locuteur inconnu ne parle à personne": L => {
    assert.deepEqual(L.audibilite(etat("jour"), SECRETS, "zz", tableEssai()), { peutParler: false, auditeurs: [], acteursAuditeurs: [], salon: "nuit" });
  }
};

function echecs(L) {
  const liste = [];
  for (const [nom, verifier] of Object.entries(VERIFICATIONS)) {
    try { verifier(L); } catch (e) { liste.push(`${nom} : ${e.message.split("\n")[0]}`); }
  }
  return liste;
}

test("salons vocaux : la logique d'origine passe toute la batterie", () => {
  assert.deepEqual(echecs(L0), []);
});

// ------------------------------------------------------------------ mutations
const MUTATIONS = [
  ["if (a.mj || salonL === \"mj\" || salonL === \"libre\" || salonL === \"village\") return true;", "if (a.mj || salonL === \"mj\" || salonL === \"libre\") return true;", "le jour, tous entendent un vivant"],
  ["if (a.mj || salonL === \"mj\"", "if (salonL === \"mj\"", "le MJ entend tout"],
  ["return (a.vivant && a.loup) || (!a.vivant && Boolean(mortsVoientTout));", "return (a.vivant && a.loup) || !a.vivant;", "morts voient tout : réglage"],
  ["return (a.vivant && a.loup) || (!a.vivant && Boolean(mortsVoientTout));", "return a.loup || (!a.vivant && Boolean(mortsVoientTout));", "un loup mort n'est plus à la tanière"],
  ["return (a.vivant && a.loup) || (!a.vivant && Boolean(mortsVoientTout));", "return a.vivant || Boolean(mortsVoientTout);", "la tanière pour les loups seuls"],
  ["if (salonL === \"morts\") return !a.vivant;", "if (salonL === \"morts\") return true;", "les vivants n'entendent pas les morts"],
  ["  return camp === \"meute\";", "  return v.role?.camp === \"meute\";", "camp actuel (mordu, échange)"],
  ["const camp = v.camp || v.role?.camp || \"\";", "const camp = v.camp || \"\";", "le rôle si le camp manque"],
  ["if (secrets === null || secrets === undefined) return (table.loupsConnus ?? []).includes(v.id);", "", "sans secrets, aucun camp connu"],
  ["if (p.mj) return \"mj\";", "", "le salon du MJ"],
  ["if (mjs.has(u.id)) liste.push(", "if (false) liste.push(", "un MJ reste le MJ"],
  ["export const PHASES_LIBRES = [\"preparation\", \"fin\"];", "export const PHASES_LIBRES = [\"preparation\"];", "la fin est libre"],
  ["export const PHASES_LIBRES = [\"preparation\", \"fin\"];", "export const PHASES_LIBRES = [\"fin\"];", "les préparatifs sont libres"],
  ["export const PHASES_DU_JOUR_MUET = [\"jour\", \"vote\"];", "export const PHASES_DU_JOUR_MUET = [\"jour\"];", "silence pendant le vote"],
  ["export const PHASES_DU_JOUR_MUET = [\"jour\", \"vote\"];", "export const PHASES_DU_JOUR_MUET = [\"jour\", \"vote\", \"aube\"];", "l'aube n'est pas muette"],
  ["if (p.silence && (PHASES_DU_JOUR_MUET.includes(phase) || PHASES_DE_NUIT.includes(phase))) return \"silence\";", "", "réduit au silence"],
  ["if (!automatique || !phase || PHASES_LIBRES.includes(phase)) return \"libre\";", "if (!phase || PHASES_LIBRES.includes(phase)) return \"libre\";", "réglage coupé"],
  ["  if (!p.vivant) return \"morts\";", "", "le salon des morts"],
  ["if (PHASES_DE_NUIT.includes(phase)) return p.loup ? \"taniere\" : \"nuit\";", "if (PHASES_DE_NUIT.includes(phase)) return \"taniere\";", "la nuit, seuls les loups"],
  ["if (PHASES_DE_NUIT.includes(phase)) return p.loup ? \"taniere\" : \"nuit\";", "if (PHASES_DE_NUIT.includes(phase)) return \"nuit\";", "la tanière"],
  ["if (a.salon === \"taniere\") ligne.loups =", "if (true) ligne.loups =", "secret : la meute aux seuls loups"],
  ["const entendus = moi ? liste.filter(l => l.userId && entend(moi, l, salonDe(l, phase, options), table.mortsVoientTout)) : [];", "const entendus = liste.filter(l => l.userId);", "qui il entend"],
  ["mj: false, vivant: false, silence: false, loup: false, spectateur: true", "mj: false, vivant: true, silence: false, loup: false, spectateur: true", "un spectateur observe"],
  ["if (a === l || !peutParlerDans(salonL)) return false;", "if (a === l) return false;", "qui se tait n'est entendu de personne"],
  ["if (!l) return { peutParler: false,", "if (!l) return { peutParler: true,", "locuteur inconnu"]
];

async function chargerMutant(avant, apres) {
  const dossier = mkdtempSync(join(tmpdir(), "loups-salons-mutant-"));
  for (const f of readdirSync(SOURCE)) {
    let texte = readFileSync(join(SOURCE, f), "utf8");
    if (f === "salons.mjs") {
      assert.ok(texte.includes(avant), `mutation introuvable : ${avant}`);
      texte = texte.replace(avant, apres);
    }
    writeFileSync(join(dossier, f), texte);
  }
  try { return await import(pathToFileURL(join(dossier, "index.mjs")).href); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
}

for (const [avant, apres, regle] of MUTATIONS) {
  test(`mutation des salons « ${regle} » : détectée`, async () => {
    const L = await chargerMutant(avant, apres);
    assert.ok(echecs(L).length > 0, `la règle « ${regle} » cassée passe inaperçue`);
  });
}

test("voix du monde : audio désactivé, joueurs sans droit de micro (le MJ n'en a pas besoin)", () => {
  const u = (nom, isGM, diffuse) => ({ nom, isGM, diffuse });
  assert.deepEqual(L0.diagnosticVoix({ mode: 0, utilisateurs: [u("DEUS", true, true), u("Hogun974", false, false)] }),
    { desactive: true, muets: ["Hogun974"], pret: false });
  assert.deepEqual(L0.diagnosticVoix({ mode: 1, utilisateurs: [u("DEUS", true, false), u("Ana", false, true)] }), { desactive: false, muets: [], pret: true });
  assert.equal(L0.diagnosticVoix({ mode: 3, utilisateurs: [] }).pret, true, "audio et vidéo : la voix marche aussi");
});
