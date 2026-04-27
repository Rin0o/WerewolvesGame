import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { SOUND_ASSETS } from '../utils/soundAssets';

export default function useSoundEffect(key) {
  const soundRef = useRef(null);

  useEffect(() => {
    if (!key || !SOUND_ASSETS[key]) return;

    let active = true;

    async function load() {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[key]);
        if (!active) {
          sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch {}
    }

    load();

    return () => {
      active = false;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [key]);
}
