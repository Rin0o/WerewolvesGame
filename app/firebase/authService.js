import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';

let pendingAnonymousSignIn = null;

export function ensureSignedIn() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!pendingAnonymousSignIn) {
    pendingAnonymousSignIn = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => { pendingAnonymousSignIn = null; });
  }
  return pendingAnonymousSignIn;
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
