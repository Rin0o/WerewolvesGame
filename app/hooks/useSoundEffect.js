import { useEffect } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { SOUND_ASSETS } from '../utils/soundAssets';
import { loadProfile } from '../utils/profile';

export default function useSoundEffect(key) {
  useEffect(() => {
    if (!key || !SOUND_ASSETS[key]) return;

    let player = null;
    let active = true;

    async function load() {
      try {
        const { soundEnabled } = await loadProfile();
        if (!soundEnabled || !active) return;
        await setAudioModeAsync({ playsInSilentMode: true });
        if (!active) return;
        player = createAudioPlayer(SOUND_ASSETS[key]);
        player.play();
      } catch {}
    }

    load();

    return () => {
      active = false;
      try {
        player?.remove();
      } catch {}
      player = null;
    };
  }, [key]);
}
