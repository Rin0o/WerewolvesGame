// Place MP3 files in assets/sounds/ then replace null with require()
// Recommended free sources: freesound.org, mixkit.co, zapsplat.com
//
// night.mp3        — wolf howl
// day.mp3          — rooster crow or morning bell
// wolves-win.mp3   — ominous / dark sting
// villagers-win.mp3 — triumphant / cheerful fanfare

export const SOUND_ASSETS = {
  night: require('../../assets/sounds/night.mp3'),
  day: require('../../assets/sounds/day.mp3'),
  wolvesWin: require('../../assets/sounds/wolves-win.mp3'),
  villagersWin: require('../../assets/sounds/villagers-win.mp3'),
};
