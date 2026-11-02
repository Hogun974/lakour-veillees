// Les Chroniques de Brumecombe : à chaque fin de partie, chez le MJ actif, la veillée s'ajoute à un journal que tous
// peuvent lire — le palmarès des joueurs, puis chaque veillée, la plus récente d'abord. Les veillées sont gardées dans le
// réglage « chroniques » (les 50 dernières) et le journal est récrit d'après lui : effacé, il revient à la partie suivante.
import { ID } from "../logique/constantes.mjs";
import { palmares } from "../logique/victoire.mjs";
import { t, libelleCamp, libelleCause } from "./donnees.mjs";

export const MAX_CHRONIQUES = 50;
const echapper = s => foundry.utils.escapeHTML(String(s ?? ""));

// La liste du récit : une ligne par villageois (lignes de L.bilanDePartie, avec le nom du joueur ; "" : un joueur IA).
export function listeDuRecit(lignes) {
  const items = lignes.map(l => {
    // Un parti (départ, exil) : ni survivant ni mort, il a quitté la veillée.
    const sort = l.parti ? t(l.parti.comment === "exil" ? "LAKOUR_LOUPS.Recit.Exile" : "LAKOUR_LOUPS.Recit.Parti", { tour: l.parti.tour || "?" })
      : l.vivant ? t("LAKOUR_LOUPS.Recit.Survivant") : t("LAKOUR_LOUPS.Recit.Mort", { tour: l.mort?.tour || "?", cause: libelleCause(l.mort?.cause) });
    const qui = [l.role, libelleCamp(l.camp), l.metier].filter(Boolean).map(echapper).join(" · ");
    return `<li class="camp-${echapper(l.camp)}${l.gagnant ? " gagnant" : ""}${l.vivant ? "" : " mort"}">${l.gagnant ? "🏆 " : ""}<strong>${echapper(l.nom)}</strong> `
      + `<small>(${echapper(l.joueur || t("LAKOUR_LOUPS.Recit.IA"))})</small><br>${qui} — <em>${echapper(sort)}</em></li>`;
  }).join("");
  return `<ul class="loups-recit">${items}</ul>`;
}

const date = quand => new Date(quand).toLocaleDateString(game.i18n.lang, { day: "numeric", month: "long", year: "numeric" });

export function pagePalmares(chroniques) {
  const rangs = palmares(chroniques);
  if (!rangs.length) return `<p>${t("LAKOUR_LOUPS.Chroniques.Vide")}</p>`;
  const tete = ["Joueur", "Veillees", "Victoires", "Survies", "Meute"].map(c => `<th>${t(`LAKOUR_LOUPS.Chroniques.Colonnes.${c}`)}</th>`).join("");
  const lignes = rangs.map((p, i) => `<tr><td>${i === 0 && p.victoires ? "🏆 " : ""}${echapper(p.joueur)}</td><td>${p.parties}</td>`
    + `<td>${p.victoires}</td><td>${p.survies}</td><td>${p.meute}</td></tr>`).join("");
  return `<div class="lakour-loups"><p>${t("LAKOUR_LOUPS.Chroniques.Intro", { n: chroniques.length })}</p>`
    + `<table class="loups-palmares"><thead><tr>${tete}</tr></thead><tbody>${lignes}</tbody></table></div>`;
}

// Une veillée de peste noire (c.peste) le dit dans son titre et en tête de sa page.
export const nomDeVeillee = c => `${t("LAKOUR_LOUPS.Chroniques.Veillee", { date: date(c.quand) })}${c.peste ? ` — ${t("LAKOUR_LOUPS.Peste.Chronique")}` : ""}`;

export function pageVeillee(c) {
  return `<div class="lakour-loups">${c.peste ? `<p><em>☣ ${echapper(t("LAKOUR_LOUPS.Peste.Recit"))}</em></p>` : ""}<p><strong>${echapper(c.vainqueur)}</strong></p>`
    + `<p>${t("LAKOUR_LOUPS.Recit.Resume", { n: c.lignes.length, tours: c.tours })}</p>${listeDuRecit(c.lignes)}</div>`;
}

// Les pages du journal : le palmarès, puis les veillées de la plus récente à la plus ancienne.
export function pagesDesChroniques(chroniques) {
  return [
    { name: t("LAKOUR_LOUPS.Chroniques.Palmares"), type: "text", sort: 0, text: { content: pagePalmares(chroniques) } },
    ...[...chroniques].reverse().map((c, i) => ({ name: nomDeVeillee(c), type: "text", sort: (i + 1) * 100, text: { content: pageVeillee(c) } }))
  ];
}

// Ajoute la veillée finie ({ quand, tours, vainqueur (libellé), lignes, peste? }) et récrit le journal. -> le journal.
export async function consignerVeillee(veillee) {
  const chroniques = [...(game.settings.get(ID, "chroniques") ?? []), veillee].slice(-MAX_CHRONIQUES);
  await game.settings.set(ID, "chroniques", chroniques);
  const pages = pagesDesChroniques(chroniques);
  const journal = game.journal.find(j => j.getFlag?.(ID, "chroniques"));
  if (!journal) {
    return JournalEntry.implementation.create({ name: t("LAKOUR_LOUPS.Chroniques.Titre"), pages, flags: { [ID]: { chroniques: true } },
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
  }
  if (journal.pages.size) await journal.deleteEmbeddedDocuments("JournalEntryPage", journal.pages.map(p => p.id));
  await journal.createEmbeddedDocuments("JournalEntryPage", pages);
  return journal;
}
