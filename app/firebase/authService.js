import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';

export async function signInAnon() {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
