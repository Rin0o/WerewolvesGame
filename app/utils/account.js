import { nicknameError } from './profile';

export function accountStatus(user) {
  const signedIn = !!user && !user.isAnonymous;
  const google = user?.providerData?.find((p) => p.providerId === 'google.com');
  return { signedIn, email: signedIn ? (google?.email || user.email || null) : null };
}

export function nicknameAfterSignIn(localNickname, savedNickname) {
  if (savedNickname && !nicknameError(savedNickname)) {
    return { nickname: savedNickname.trim(), save: false };
  }
  return { nickname: localNickname, save: !nicknameError(localNickname) };
}

const ERROR_MESSAGES = {
  not_available: 'Google sign-in only works in the installed app, not in Expo Go.',
  not_configured: "Google sign-in isn't set up for this build yet.",
  no_play_services: 'Google sign-in needs Google Play services on this phone.',
  network: 'Could not reach Google. Check your connection.',
  in_progress: 'A sign-in is already in progress.',
  wrong_account: "That isn't the Google account you signed in with.",
  unknown: 'Something went wrong. Please try again.',
};

export function accountErrorMessage(kind) {
  return ERROR_MESSAGES[kind] || ERROR_MESSAGES.unknown;
}
