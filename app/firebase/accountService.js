import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  reauthenticateWithCredential,
  deleteUser,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, GOOGLE_WEB_CLIENT_ID } from './config';
import { ensureSignedIn } from './authService';

const DEVELOPER_ERROR = '10';

let googleModule;
let configured = false;

function googleSignIn() {
  if (googleModule === undefined) {
    try {
      googleModule = require('@react-native-google-signin/google-signin');
    } catch {
      googleModule = null;
    }
  }
  return googleModule;
}

export class AccountError extends Error {
  constructor(kind, cause) {
    super(kind);
    this.kind = kind;
    this.cause = cause;
  }
}

function errorKind(error) {
  if (error instanceof AccountError) return error.kind;
  const code = error?.code;
  if (code === DEVELOPER_ERROR) return 'not_configured';
  const statusCodes = googleSignIn()?.statusCodes;
  if (statusCodes && code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'no_play_services';
  if (statusCodes && code === statusCodes.IN_PROGRESS) return 'in_progress';
  if (code === 'auth/network-request-failed') return 'network';
  if (code === 'auth/user-mismatch') return 'wrong_account';
  if (code === 'auth/invalid-credential' || code === 'auth/operation-not-allowed') return 'not_configured';
  return 'unknown';
}

async function googleCredential() {
  const google = googleSignIn();
  if (!google) throw new AccountError('not_available');
  if (!GOOGLE_WEB_CLIENT_ID) throw new AccountError('not_configured');
  if (!configured) {
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await google.GoogleSignin.signIn();
    if (!google.isSuccessResponse(response) || !response.data.idToken) return null;
    return GoogleAuthProvider.credential(response.data.idToken);
  } catch (error) {
    if (error?.code === google.statusCodes.SIGN_IN_CANCELLED) return null;
    throw new AccountError(errorKind(error), error);
  }
}

async function forgetGoogleOnThisPhone() {
  try {
    await googleSignIn()?.GoogleSignin.signOut();
  } catch {}
}

export async function linkGoogleAccount() {
  const credential = await googleCredential();
  if (!credential) return { status: 'cancelled' };
  const user = await ensureSignedIn();
  try {
    await linkWithCredential(user, credential);
    return { status: 'linked' };
  } catch (error) {
    if (error?.code === 'auth/credential-already-in-use') {
      return { status: 'already_linked', credential: GoogleAuthProvider.credentialFromError(error) || credential };
    }
    await forgetGoogleOnThisPhone();
    throw new AccountError(errorKind(error), error);
  }
}

export async function switchToGoogleAccount(credential) {
  try {
    await signInWithCredential(auth, credential);
  } catch (error) {
    await forgetGoogleOnThisPhone();
    throw new AccountError(errorKind(error), error);
  }
}

export async function cancelGoogleSwitch() {
  await forgetGoogleOnThisPhone();
}

export async function signOutToAnonymous() {
  await forgetGoogleOnThisPhone();
  await signOut(auth);
  return ensureSignedIn();
}

function profileDoc(uid) {
  return doc(db, 'users', uid);
}

export async function loadSavedNickname() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  try {
    const snapshot = await getDoc(profileDoc(user.uid));
    return snapshot.exists() ? snapshot.data().nickname ?? null : null;
  } catch {
    return null;
  }
}

export async function saveNickname(nickname) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    await setDoc(profileDoc(user.uid), { nickname, updatedAt: serverTimestamp() });
  } catch {}
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { status: 'cancelled' };
  await forgetGoogleOnThisPhone();
  const credential = await googleCredential();
  if (!credential) return { status: 'cancelled' };
  try {
    await reauthenticateWithCredential(user, credential);
    await deleteDoc(profileDoc(user.uid));
    await deleteUser(user);
  } catch (error) {
    throw new AccountError(errorKind(error), error);
  }
  try {
    await googleSignIn()?.GoogleSignin.revokeAccess();
  } catch {}
  await forgetGoogleOnThisPhone();
  await ensureSignedIn();
  return { status: 'deleted' };
}
