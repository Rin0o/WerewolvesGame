import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'werewolves.activeSession';

export async function saveSession({ roomId, playerId, nickname }) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, nickname }));
  } catch {}
}

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function screenForStatus(status) {
  switch (status) {
    case 'lobby': return 'Lobby';
    case 'night': return 'NightPhase';
    case 'day':   return 'DayPhase';
    case 'ended': return 'GameOver';
    default:      return null;
  }
}
