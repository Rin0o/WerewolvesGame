import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUSPICION_LABELS } from '../constants/icons';

const SUSPICION_LEVELS = ['innocent', 'neutral', 'suspicious', 'very_suspicious'];

/**
 * Manages per-player local state:
 *  - suspicion levels for each player
 *  - suspected role tags
 *  - personal notepad text
 * All data stored in AsyncStorage, keyed by roomId.
 */
export default function usePlayer(roomId) {
  const [notes, setNotes] = useState('');
  const [suspicions, setSuspicions] = useState({});
  const [suspectedRoles, setSuspectedRoles] = useState({});
  const storageKey = `player_notes_${roomId}`;

  useEffect(() => {
    if (!roomId) return;
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setNotes(parsed.notes || '');
          setSuspicions(parsed.suspicions || {});
          setSuspectedRoles(parsed.suspectedRoles || {});
        } catch {}
      }
    });
  }, [roomId]);

  async function persist(next) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }

  function updateNotes(text) {
    setNotes(text);
    persist({ notes: text, suspicions, suspectedRoles });
  }

  function cycleSuspicion(playerId) {
    const current = suspicions[playerId] || 'neutral';
    const idx = SUSPICION_LEVELS.indexOf(current);
    const next = SUSPICION_LEVELS[(idx + 1) % SUSPICION_LEVELS.length];
    const updated = { ...suspicions, [playerId]: next };
    setSuspicions(updated);
    persist({ notes, suspicions: updated, suspectedRoles });
  }

  function setSuspectedRole(playerId, role) {
    const updated = { ...suspectedRoles, [playerId]: role };
    setSuspectedRoles(updated);
    persist({ notes, suspicions, suspectedRoles: updated });
  }

  async function clearGameData() {
    setSuspicions({});
    setSuspectedRoles({});
    await persist({ notes, suspicions: {}, suspectedRoles: {} });
  }

  return {
    notes,
    updateNotes,
    suspicions,
    cycleSuspicion,
    suspectedRoles,
    setSuspectedRole,
    clearGameData,
    SUSPICION_LABELS,
  };
}
