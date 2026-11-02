// L'infobulle d'un jeton de villageois au survol (hook hoverToken, local) : nom, métier (public), état (vivant, mort,
// réduit au silence, Bailli, a voté) et rôle s'il est révélé. Le MJ voit aussi le rôle caché ; un joueur voit le sien.
import { ID } from "../logique/constantes.mjs";
import { t, lireEtat, roleDe, metierDe, libelleCamp, libelleCause, monVillageois } from "./donnees.mjs";

const echapper = s => foundry.utils.escapeHTML(String(s ?? ""));

// Les lignes de l'infobulle d'un acteur, pour l'utilisateur courant.
export function contenuInfobulle(acteur) {
  if (acteur?.type !== "villageois") return null;
  const etat = lireEtat();
  const role = roleDe(acteur), metier = metierDe(acteur);
  const moi = monVillageois();
  const soi = moi?.id === acteur.id;
  const revele = acteur.system.revele || etat.phase === "fin";
  const etats = [];
  if (!acteur.system.vivant) {
    const mort = etat.morts.find(m => m.acteurId === acteur.id);
    etats.push({ cle: "mort", texte: mort ? `${t("LAKOUR_LOUPS.Table.Mort")} · ${libelleCause(mort.cause)}` : t("LAKOUR_LOUPS.Table.Mort") });
  } else etats.push({ cle: "vivant", texte: t("LAKOUR_LOUPS.Infobulle.Vivant") });
  if (acteur.system.vivant && acteur.system.silence) etats.push({ cle: "silence", texte: t("LAKOUR_LOUPS.Table.Silence") });
  if (acteur.system.vivant && etat.bailli?.actif && etat.bailli.acteurId === acteur.id) etats.push({ cle: "bailli", texte: t("LAKOUR_LOUPS.Bailli.Titre") });
  if (etat.vote.ouvert && etat.vote.exprimes.includes(acteur.id)) etats.push({ cle: "vote", texte: t("LAKOUR_LOUPS.Vote.AVote") });
  let roleTexte = "", roleCache = false;
  if (role && (revele || soi || game.user.isGM)) {
    roleTexte = `${role.name} · ${libelleCamp(acteur.system.camp)}`;
    roleCache = !revele;
  }
  return { nom: acteur.name, soi, metier: metier?.name ?? "", maison: acteur.system.maison, etats, role: roleTexte, roleCache, camp: revele ? acteur.system.camp : "" };
}

function element() {
  let el = document.getElementById(`${ID}-infobulle`);
  if (!el) {
    el = document.createElement("div");
    el.id = `${ID}-infobulle`;
    el.className = `${ID} loups-infobulle`;
    el.setAttribute("role", "tooltip");
    (document.getElementById("interface") ?? document.body).append(el);
  }
  return el;
}

export function montrerInfobulle(jeton, survole) {
  const el = element();
  const c = survole ? contenuInfobulle(jeton?.actor) : null;
  if (!c || !globalThis.canvas?.ready) { el.classList.remove("visible"); return; }
  el.innerHTML = `<div class="lib-nom">${echapper(c.nom)}${c.soi ? ` <span class="lib-soi">${echapper(t("LAKOUR_LOUPS.Infobulle.Toi"))}</span>` : ""}</div>`
    + (c.metier ? `<div class="lib-ligne"><i class="fa-solid fa-hammer"></i> ${echapper(c.metier)}</div>` : "")
    + (c.maison ? `<div class="lib-ligne"><i class="fa-solid fa-door-closed"></i> ${echapper(c.maison)}</div>` : "")
    + `<div class="lib-etats">${c.etats.map(e => `<span class="lib-etat ${e.cle}">${echapper(e.texte)}</span>`).join("")}</div>`
    + (c.role ? `<div class="lib-role ${c.roleCache ? "cache" : `camp-${c.camp}`}"><i class="fa-solid ${c.roleCache ? "fa-lock" : "fa-mask"}"></i> ${echapper(c.role)}</div>` : "");
  const haut = canvas.clientCoordinatesFromCanvas({ x: jeton.center.x, y: jeton.y });
  el.style.left = `${Math.round(haut.x)}px`;
  el.style.top = `${Math.round(haut.y - 10)}px`;
  el.classList.add("visible");
}

export function brancherInfobulle() {
  Hooks.on("hoverToken", (jeton, survole) => montrerInfobulle(jeton, survole));
  Hooks.on("canvasPan", () => element().classList.remove("visible"));
}
