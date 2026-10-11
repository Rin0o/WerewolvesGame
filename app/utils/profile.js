import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'werewolves.profile';
const DEFAULT_PROFILE = { nickname: '', soundEnabled: true };

const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 18;

let cachedProfile = null;

export async function loadProfile() {
  if (cachedProfile) return cachedProfile;
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    cachedProfile = { ...DEFAULT_PROFILE, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    cachedProfile = { ...DEFAULT_PROFILE };
  }
  return cachedProfile;
}

export async function updateProfile(changes) {
  const current = await loadProfile();
  cachedProfile = { ...current, ...changes };
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));
  } catch {}
  return cachedProfile;
}

export function nicknameError(rawNickname) {
  const nickname = (rawNickname || '').trim();
  if (!nickname) return 'Please enter a name.';
  if (nickname.length < NICKNAME_MIN) return `Your name must be at least ${NICKNAME_MIN} characters.`;
  if (nickname.length > NICKNAME_MAX) return `Your name must be ${NICKNAME_MAX} characters or fewer.`;
  return null;
}

export function sameNickname(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}
