import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUSPICION_LABELS } from '../constants/icons';
import { privateClues, addClues } from '../utils/privateClues';

const SUSPICION_LEVELS = ['innocent', 'neutral', 'suspicious', 'very_suspicious'];
const EMPTY_NOTES = { notes: '', suspicions: {}, suspectedRoles: {}, clues: [] };

/**
 * Manages per-player local state:
 *  - suspicion levels for each player
 *  - suspected role tags
 *  - personal notepad text
 *  - private clues (privateClues), recorded as they appear in the room; a clue also sets the
 *    suspicion of the players it names, only if the player hasn't set one yet
 * All data stored in AsyncStorage, keyed by roomId.
 */
export default function usePlayer(roomId, room = null, playerId = null) {
  const [data, setData] = useState(EMPTY_NOTES);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(EMPTY_NOTES);
  const storageKey = `player_notes_${roomId}`;

  useEffect(() => {
    if (!roomId) return;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          dataRef.current = { ...EMPTY_NOTES, ...parsed };
          setData(dataRef.current);
        } catch {}
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [roomId]);

  function update(change) {
    const next = change(dataRef.current);
    if (next === dataRef.current) return Promise.resolve();
    dataRef.current = next;
    setData(next);
    return AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }

  const clues = loaded && room ? privateClues(room, playerId) : [];
  const clueKeys = clues.map((c) => c.key).join('|');
  useEffect(() => {
    if (clues.length > 0) update((current) => addClues(current, clues));
  }, [loaded, clueKeys]);

  function updateNotes(text) {
    update((current) => ({ ...current, notes: text }));
  }

  function cycleSuspicion(targetId) {
    update((current) => {
      const idx = SUSPICION_LEVELS.indexOf(current.suspicions[targetId] || 'neutral');
      const next = SUSPICION_LEVELS[(idx + 1) % SUSPICION_LEVELS.length];
      return { ...current, suspicions: { ...current.suspicions, [targetId]: next } };
    });
  }

  function setSuspicion(targetId, level) {
    update((current) => ({ ...current, suspicions: { ...current.suspicions, [targetId]: level } }));
  }

  function setSuspectedRole(targetId, role) {
    update((current) => ({ ...current, suspectedRoles: { ...current.suspectedRoles, [targetId]: role } }));
  }

  function clearGameData() {
    dataRef.current = EMPTY_NOTES;
    setData(EMPTY_NOTES);
    return AsyncStorage.setItem(storageKey, JSON.stringify(EMPTY_NOTES));
  }

  return {
    notes: data.notes,
    updateNotes,
    suspicions: data.suspicions,
    cycleSuspicion,
    setSuspicion,
    suspectedRoles: data.suspectedRoles,
    setSuspectedRole,
    clues: data.clues,
    clearGameData,
    SUSPICION_LABELS,
  };
}
