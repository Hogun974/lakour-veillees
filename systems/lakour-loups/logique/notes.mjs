// Les notes d'un villageois (system.notes) : un document Actor, que Foundry v14 envoie en entier à TOUS les navigateurs (au
// chargement du monde : World, db.Actor.dump() sans filtre par utilisateur ; à chaque modification : modifyDocument diffusé
// à tous). Un bloc « secret » de l'éditeur (<section class="secret">) n'y est masqué qu'à l'affichage (enrichHTML, secrets) :
// tout joueur le lirait dans la console. Il n'y est donc pas gardé. Logique pure (scripts/garde.mjs l'applique).

const OUVRANTE_SECRET = /<section\b[^>]*\bclass\s*=\s*(["'])(?:(?!\1).)*\bsecret\b(?:(?!\1).)*\1[^>]*>/is;
const BALISE_SECTION = /<(\/?)section\b[^>]*>/gi;

// -> les notes sans leurs blocs secrets (sections imbriquées comprises) ; une section secrète jamais fermée court jusqu'à la fin.
export function retirerBlocsSecrets(html) {
  let texte = String(html ?? "");
  for (let garde = 0; garde < 1000; garde++) {
    const debut = OUVRANTE_SECRET.exec(texte);
    if (!debut) break;
    BALISE_SECTION.lastIndex = debut.index + debut[0].length;
    let profondeur = 1, fin = texte.length, m;
    while ((m = BALISE_SECTION.exec(texte))) {
      profondeur += m[1] ? -1 : 1;
      if (profondeur === 0) { fin = m.index + m[0].length; break; }
    }
    texte = texte.slice(0, debut.index) + texte.slice(fin);
  }
  return texte;
}

export const contientBlocSecret = html => OUVRANTE_SECRET.test(String(html ?? ""));
