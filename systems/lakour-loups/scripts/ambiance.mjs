// Ambiances sonores de la veillée, chez le MJ actif, à chaque phase : si le module MJ IA est actif (même sans séance de
// narrateur), sa playlist « Ambiances (MJ IA) » et ses sons (modules/lakour-mj-ia/assets/sons/index.json) : « nuit » la
// nuit, « tension » pendant le vote, rien aux autres phases. Sans le module, rien.
import { ID } from "../logique/constantes.mjs";
import { ambianceDePhase } from "../logique/etapes.mjs";
import { estMJActif } from "./canal.mjs";

const MJ_IA = "lakour-mj-ia";
const NOM_PLAYLIST = "Ambiances (MJ IA)";
export const VOLUME = 0.3;
let derniere = null;

export const ambiancesDisponibles = () => Boolean(game.modules?.get?.(MJ_IA)?.active && game.playlists);

// Joue l'ambiance de cette phase (ou coupe la précédente). -> la clé jouée, "" (coupée) ou null (rien à faire).
export async function ambiancePourPhase(phase) {
  if (!estMJActif() || !ambiancesDisponibles()) return null;
  const voulue = ambianceDePhase(phase);
  if (voulue === derniere) return null;
  derniere = voulue;
  let playlist = game.playlists.find(p => p.getFlag?.(MJ_IA, "ambiances") || p.name === NOM_PLAYLIST);
  try {
    if (!voulue) {
      if (playlist) for (const s of playlist.sounds.filter(x => x.playing)) await s.update({ playing: false });
      return "";
    }
    const index = await (await fetch(foundry.utils.getRoute(`modules/${MJ_IA}/assets/sons/index.json`), { cache: "no-store" })).json().catch(() => ({}));
    const son = index[voulue];
    if (!son) return null;
    playlist ??= await Playlist.implementation.create({ name: NOM_PLAYLIST, mode: CONST.PLAYLIST_MODES?.DISABLED ?? -1, flags: { [MJ_IA]: { ambiances: true } } });
    let piste = playlist.sounds.find(s => s.getFlag?.(MJ_IA, "ambiance") === voulue);
    if (!piste) [piste] = await playlist.createEmbeddedDocuments("PlaylistSound", [{ name: son.libelle, path: son.fichier, repeat: true, fade: 2000, flags: { [MJ_IA]: { ambiance: voulue } } }]);
    for (const autre of playlist.sounds.filter(s => s.playing && s.id !== piste.id)) await autre.update({ playing: false });
    await piste.update({ playing: true, volume: VOLUME });
    return voulue;
  } catch (e) {
    console.warn(`${ID} | ambiance ${voulue}`, e);
    return null;
  }
}

export function oublierAmbiance() { derniere = null; }
