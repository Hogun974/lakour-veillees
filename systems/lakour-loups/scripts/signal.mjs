// Le signal « à toi » : chez le joueur seul, un tintement discret (canal « interface » de Foundry, jamais diffusé aux
// autres) et, s'il regarde un autre onglet, le titre de la page qui clignote jusqu'à son retour. Quand on attend quelque
// chose de lui : un choix secret de la nuit, un vote qui s'ouvre. Le MJ n'en a pas ; réglage client « signalTour ».
import { ID } from "../logique/constantes.mjs";

export const VOLUME = 0.5;
let clignotement = null;   // { minuterie, origine, retour }

// -> true si le signal est donné.
export function signaler(texte) {
  if (game.user?.isGM || !game.settings.get(ID, "signalTour")) return false;
  try {
    foundry.audio.AudioHelper.play({ src: CONFIG.sounds?.notification ?? "sounds/notify.wav", volume: VOLUME, autoplay: true, loop: false, channel: "interface" }, false)?.catch?.(() => {});
  } catch { /* sans son : le titre suffit */ }
  clignoterTitre(texte);
  return true;
}

function clignoterTitre(texte) {
  if (typeof document === "undefined" || !document.hidden || clignotement) return;
  const origine = document.title;
  let allume = false;
  const retour = () => { if (!document.hidden) arreterClignotement(); };
  clignotement = { origine, retour, minuterie: setInterval(() => { document.title = (allume = !allume) ? `🔔 ${texte}` : origine; }, 1000) };
  document.addEventListener("visibilitychange", retour);
}

export function arreterClignotement() {
  if (!clignotement) return;
  clearInterval(clignotement.minuterie);
  document.title = clignotement.origine;
  document.removeEventListener("visibilitychange", clignotement.retour);
  clignotement = null;
}
