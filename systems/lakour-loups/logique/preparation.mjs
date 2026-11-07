// Les onglets de la préparation de partie, à la Table de veillée (templates/table.hbs, scripts/apps/table.mjs). Logique pure.
//
// La préparation (MJ, avant la distribution) se range en cinq onglets : Joueurs (connectés, joueurs IA, micros), Composition (équilibrée ou
// choix des rôles, niveau ; la petite tablée), Village (peste noire, Nuit de la Saint-Martin, Le Village, bâtiments, métiers), Variantes
// (chandelles, Chaîne, Mur, Vendanges, Envoûtement, Double visage et son allégeance loup), Gazette (la Gazette de la lune, le Crieur, les cartes
// permanentes, la veillée de fête). Un onglet sans rien à régler (les variantes d'une Nuit de la Saint-Martin) disparaît. Sous les
// onglets, toujours visibles : un résumé d'une ligne des choix actifs et le bouton « Distribuer ». L'onglet ouvert est retenu par
// navigateur (table.mjs : localStorage) ; un onglet retenu qui a disparu laisse la place au premier.

export const ONGLETS_DE_LA_PREPARATION = Object.freeze([
  { cle: "joueurs", icone: "fa-users" },
  { cle: "composition", icone: "fa-scale-balanced" },
  { cle: "village", icone: "fa-house-chimney-window" },
  { cle: "variantes", icone: "fa-shuffle" },
  { cle: "gazette", icone: "fa-newspaper" }
]);

// Les onglets présents pour cette préparation (le contexte de la Table : preparation) et celui qui est ouvert.
// -> { onglets: [{ cle, icone, actif }], ouvert: { cle: Boolean } }
export function ongletsDeLaPreparation(prep = {}, retenu = "") {
  const present = {
    joueurs: true, composition: true, village: true,
    variantes: Boolean(prep.variantes),
    gazette: Boolean(prep.gazette) || Boolean(prep.fetes && !prep.fetes.saintMartin)
  };
  const la = ONGLETS_DE_LA_PREPARATION.filter(o => present[o.cle]);
  const actif = la.some(o => o.cle === retenu) ? retenu : la[0].cle;
  return {
    onglets: la.map(o => ({ ...o, actif: o.cle === actif })),
    ouvert: Object.fromEntries(ONGLETS_DE_LA_PREPARATION.map(o => [o.cle, o.cle === actif]))
  };
}

// Le résumé d'une ligne des choix actifs (« Le Pacte · Le Village · La Gazette de la lune… »). prep : le contexte de la Table ; t(cle,
// donnees) : la traduction ; niveau : la clé du niveau choisi.
export function resumeDeLaPreparation(prep = {}, t = c => c, { niveau = "" } = {}) {
  const morceaux = [];
  if (prep.saintMartin) morceaux.push(t("LAKOUR_LOUPS.SaintMartin.Preparation"));
  else if (prep.manuel) morceaux.push(t("LAKOUR_LOUPS.Preparation.Resume.Manuel", { n: prep.choisis ?? 0 }));
  else if (niveau) morceaux.push(t(`LAKOUR_LOUPS.Table.Composition.Niveaux.${niveau}`));
  if (prep.peste) morceaux.push(t("LAKOUR_LOUPS.Peste.Preparation"));
  if (prep.village && prep.villagePossible) morceaux.push(t("LAKOUR_LOUPS.Village.Nom"));
  const b = prep.batiments;
  if (b) {
    const mode = (b.modes ?? []).find(m => m.choisi)?.cle ?? "hasard";
    if (mode === "aucun") morceaux.push(t("LAKOUR_LOUPS.Preparation.Resume.SansBatiments"));
    if (mode === "choisis") morceaux.push(t("LAKOUR_LOUPS.Preparation.Resume.BatimentsChoisis", { n: (b.liste ?? []).filter(x => x.coche).length }));
    if (b.metiers === false) morceaux.push(t("LAKOUR_LOUPS.Preparation.Resume.SansMetiers"));
  }
  const v = prep.variantes;
  if (v) {
    for (const c of v.cases ?? []) if (c.coche) morceaux.push(c.nom);
    const dv = (v.doubleVisage ?? []).find(m => m.choisi && m.cle);
    if (dv) morceaux.push(`${t("LAKOUR_LOUPS.Variantes.DoubleVisage.Nom")} (${dv.nom})${v.allegeance?.coche ? ` + ${v.allegeance.nom}` : ""}`);
  }
  const g = prep.gazette;
  if (g?.actif) morceaux.push(t("LAKOUR_LOUPS.Preparation.Gazette"));
  if (g?.crieur) morceaux.push(t("LAKOUR_LOUPS.Preparation.Crieur"));
  const fete = prep.fetes && !prep.fetes.saintMartin ? (prep.fetes.options ?? []).find(o => o.choisie && o.cle) : null;
  if (fete) morceaux.push(fete.nom);
  return morceaux.filter(Boolean).join(" · ");
}
