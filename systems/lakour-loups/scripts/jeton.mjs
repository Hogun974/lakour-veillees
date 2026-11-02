// Le jeton d'un villageois sur le canevas (CONFIG.Token.objectClass, sous-classe du Token de Foundry v14).
//
// Capter le clic d'un joueur sur un jeton qu'il ne contrôle pas. Dans Foundry v14, le MouseInteractionManager d'un jeton
// ne déclenche _onClickLeft que si _canControl(user, event) l'autorise, et Token#_canControl refuse un non-propriétaire
// (document.canUserModify « update »). Le survol, lui, est permis à tous (Token#_canHover). Le ciblage (hook targetToken)
// demanderait l'outil « cible » et laisserait une trace publique (les cibles d'un utilisateur sont diffusées) ; écouter
// le canevas à part obligerait à refaire le test de collision et l'ordre des jetons empilés. La méthode retenue : une
// sous-classe du Token qui
//   - autorise le clic (_canControl, sur pointerdown seulement) quand le plateau local attend ce jeton
//     (plateau-local.mjs : candidat d'une demande de nuit, d'un pouvoir de jour, ou d'un vote ouvert) ;
//   - prend ce clic (_onClickLeft, _onClickLeft2) sans contrôler le jeton : rien n'est sélectionné au sens de Foundry,
//     aucun document n'est modifié, seul l'état local du joueur change ;
//   - refuse aux joueurs le HUD, la configuration et le glisser d'un jeton de villageois (le verrou fait le reste) ;
//   - dessine par-dessus le jeton, CHEZ CE JOUEUR SEUL, le halo des candidats, la sélection, son vote, la coche « a voté »
//     (publique : état public vote.exprimes), les bulles du dépouillement et le sceau du Bailli (public : état public bailli).
import * as local from "./plateau-local.mjs";

const COULEURS = { lanterne: 0xf0a742, choix: 0xffd27a, vote: 0xd2553c, mousse: 0x8fb06a, nuit: 0x15121a, bord: 0x4a3a33, parchemin: 0xeadfc8 };

export function classeJetonLoups(Base) {
  return class JetonLoups extends Base {
    get estVillageois() { return this.actor?.type === "villageois"; }

    // Le plateau attend-il un clic sur ce jeton ?
    #pourLePlateau() { return this.estVillageois && local.accepteClic(this.actor.id); }

    _canControl(user, event) {
      if (event?.type === "pointerdown" && this.#pourLePlateau()) return true;
      return super._canControl(user, event);
    }

    _onClickLeft(event) {
      if (this.#pourLePlateau()) {
        event.stopPropagation?.();
        local.cliquer(this.actor.id);
        return;
      }
      return super._onClickLeft(event);
    }

    _onClickLeft2(event) {
      if (this.#pourLePlateau()) { event.stopPropagation?.(); return; }
      return super._onClickLeft2(event);
    }

    _canHUD(user, event) {
      if (this.estVillageois && !user.isGM) return false;
      return super._canHUD(user, event);
    }

    _canConfigure(user, event) {
      if (this.estVillageois && !user.isGM) return false;
      return super._canConfigure(user, event);
    }

    _canDragLeftStart(user, event, options) {
      if (this.estVillageois && !user.isGM) return false;
      return super._canDragLeftStart(user, event, options);
    }

    async _draw(options) {
      await super._draw(options);
      if (!this.lakourDecor || this.lakourDecor.destroyed) {
        this.lakourDecor = this.addChild(new PIXI.Container());
        this.lakourDecor.eventMode = "none";
      }
      this.dessinerDecor();
    }

    _refreshState() {
      super._refreshState();
      this.dessinerDecor();
    }

    // Les surimpressions locales de ce jeton (rien n'est écrit dans un document).
    dessinerDecor() {
      const d = this.lakourDecor;
      if (!d || d.destroyed) return;
      for (const c of d.removeChildren()) c.destroy({ children: true });
      d.halo = null;
      if (!this.estVillageois || this.document.isSecret) return;
      const decor = local.decorDe(this.actor.id);
      const w = this.w, h = this.h, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
      if (decor.candidat && !decor.choisi && !decor.monVote) {
        const halo = new PIXI.Graphics();
        halo.beginFill(COULEURS.lanterne, 0.14).drawCircle(cx, cy, r + 10).endFill();
        halo.lineStyle(4, COULEURS.lanterne, 0.9).drawCircle(cx, cy, r + 7);
        d.halo = d.addChild(halo);
      }
      if (decor.choisi || decor.monVote) {
        const couleur = decor.monVote ? COULEURS.vote : COULEURS.choix;
        const anneau = new PIXI.Graphics();
        anneau.lineStyle(10, 0x000000, 0.35).drawCircle(cx, cy, r + 9);
        anneau.lineStyle(6, couleur, 1).drawCircle(cx, cy, r + 9);
        d.addChild(anneau);
        d.addChild(pastille(w - r * 0.22, r * 0.22, r * 0.3, couleur, decor.monVote ? "main" : "coche"));
      }
      if (decor.aVote) d.addChild(pastille(w - r * 0.22, h - r * 0.22, r * 0.26, COULEURS.mousse, "coche"));
      if (decor.bailli) d.addChild(pastille(r * 0.22, r * 0.22, r * 0.28, COULEURS.lanterne, "sceau"));
      if (decor.bulle !== null && decor.bulle !== undefined) d.addChild(bulle(cx, -r * 0.35, String(decor.bulle), r));
    }
  };
}

// Une pastille ronde avec une coche, une main levée ou le sceau du Bailli (dessinés, sans police d'icônes).
function pastille(x, y, r, couleur, signe) {
  const g = new PIXI.Graphics();
  g.beginFill(COULEURS.nuit, 0.95).lineStyle(Math.max(2, r * 0.18), couleur, 1).drawCircle(x, y, r).endFill();
  g.lineStyle(Math.max(2, r * 0.22), couleur, 1);
  if (signe === "coche") {
    g.moveTo(x - r * 0.45, y + r * 0.02).lineTo(x - r * 0.1, y + r * 0.38).lineTo(x + r * 0.5, y - r * 0.35);
  } else if (signe === "sceau") {
    // Le sceau du Bailli : un pommeau, un manche et la semelle du tampon.
    g.lineStyle(0).beginFill(couleur, 1).drawCircle(x, y - r * 0.38, r * 0.16).endFill();
    g.beginFill(couleur, 1).drawRect(x - r * 0.08, y - r * 0.26, r * 0.16, r * 0.34).endFill();
    g.beginFill(couleur, 1).drawRoundedRect(x - r * 0.42, y + r * 0.08, r * 0.84, r * 0.26, r * 0.06).endFill();
  } else {
    // Main levée : une paume et trois doigts.
    g.lineStyle(0).beginFill(couleur, 1).drawRoundedRect(x - r * 0.38, y - r * 0.05, r * 0.76, r * 0.5, r * 0.15).endFill();
    for (const dx of [-0.28, 0, 0.28]) g.beginFill(couleur, 1).drawRoundedRect(x + r * dx - r * 0.1, y - r * 0.5, r * 0.2, r * 0.55, r * 0.1).endFill();
  }
  return g;
}

// La bulle des voix au-dessus d'un jeton, après le dépouillement.
function bulle(cx, y, texte, r) {
  const c = new PIXI.Container();
  const taille = Math.max(18, r * 0.55);
  const Texte = foundry.canvas?.containers?.PreciseText ?? PIXI.Text;
  const style = new PIXI.TextStyle({ fontFamily: "Signika, Georgia, serif", fontSize: taille, fontWeight: "bold", fill: "#15121a" });
  const tx = new Texte(texte, style);
  tx.anchor?.set(0.5, 0.5);
  const l = Math.max(taille * 1.5, tx.width + taille * 0.8), hauteur = taille * 1.35;
  const g = new PIXI.Graphics();
  g.beginFill(0xf0a742, 0.96).lineStyle(3, 0x15121a, 0.9).drawRoundedRect(cx - l / 2, y - hauteur / 2, l, hauteur, hauteur / 2).endFill();
  g.beginFill(0xf0a742, 0.96).lineStyle(0).drawPolygon([cx - 8, y + hauteur / 2 - 1, cx + 8, y + hauteur / 2 - 1, cx, y + hauteur / 2 + 10]).endFill();
  tx.position.set(cx, y);
  c.addChild(g, tx);
  return c;
}

// Le halo des candidats respire doucement (chez ce joueur seul).
let pouls = null;
export function animerHalos() {
  const c = globalThis.canvas;
  if (!c?.app?.ticker || pouls) return;
  pouls = () => {
    const a = 0.55 + 0.45 * Math.sin(Date.now() / 260);
    for (const tk of c.tokens?.placeables ?? []) if (tk.lakourDecor?.halo && !tk.lakourDecor.halo.destroyed) tk.lakourDecor.halo.alpha = a;
  };
  c.app.ticker.add(pouls);
}

// Redessine les surimpressions de tous les jetons (l'état local a changé).
export function rafraichirJetons() {
  for (const tk of globalThis.canvas?.tokens?.placeables ?? []) {
    if (typeof tk.dessinerDecor === "function") tk.dessinerDecor();
  }
}

