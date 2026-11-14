jest.mock('../config', () => ({ auth: { currentUser: null }, db: 'db', GOOGLE_WEB_CLIENT_ID: 'web-client-id' }));
jest.mock('../authService', () => ({ ensureSignedIn: jest.fn(() => Promise.resolve({ uid: 'anon' })) }));
jest.mock('../historyService', () => ({ forgetMyGames: jest.fn(() => Promise.resolve()) }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: {
    credential: jest.fn((idToken) => ({ idToken })),
    credentialFromError: jest.fn(() => null),
  },
  linkWithCredential: jest.fn(() => Promise.resolve()),
  signInWithCredential: jest.fn(() => Promise.resolve()),
  reauthenticateWithCredential: jest.fn(() => Promise.resolve()),
  deleteUser: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, collection, id) => `${collection}/${id}`),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'server-time'),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
    revokeAccess: jest.fn(() => Promise.resolve()),
  },
  isSuccessResponse: (response) => response.type === 'success',
  statusCodes: { SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in_progress', PLAY_SERVICES_NOT_AVAILABLE: 'no_play' },
}));

import {
  GoogleAuthProvider, linkWithCredential, signInWithCredential, reauthenticateWithCredential, deleteUser, signOut,
} from 'firebase/auth';
import { setDoc, deleteDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config';
import { ensureSignedIn } from '../authService';
import { forgetMyGames } from '../historyService';
import {
  linkGoogleAccount, switchToGoogleAccount, signOutToAnonymous, saveNickname, deleteAccount, AccountError,
} from '../accountService';

const GOOGLE_USER = { uid: 'g-1', isAnonymous: false };
const ANONYMOUS_USER = { uid: 'anon', isAnonymous: true };

function pickerReturns(idToken = 'token') {
  GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken } });
}

function pickerCancelled() {
  GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });
}

function failure(code) {
  return Object.assign(new Error(code), { code });
}

async function kindOf(promise) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AccountError);
    return error.kind;
  }
  throw new Error('expected an AccountError');
}

function expectInOrder(...mocks) {
  const steps = mocks.map((m) => m.mock.invocationCallOrder[0]);
  steps.forEach((step) => expect(step).toBeDefined());
  expect(steps).toEqual([...steps].sort((a, b) => a - b));
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = ANONYMOUS_USER;
  pickerReturns();
});

describe('linkGoogleAccount', () => {
  it('links the Google account to the current player, keeping their id', async () => {
    await expect(linkGoogleAccount()).resolves.toEqual({ status: 'linked' });
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
    expect(linkWithCredential).toHaveBeenCalledWith({ uid: 'anon' }, { idToken: 'token' });
  });

  it('does nothing when the player closes the account picker', async () => {
    pickerCancelled();
    await expect(linkGoogleAccount()).resolves.toEqual({ status: 'cancelled' });
    GoogleSignin.signIn.mockRejectedValue(failure('cancelled'));
    await expect(linkGoogleAccount()).resolves.toEqual({ status: 'cancelled' });
    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  it('hands back the credential when the Google account already has a player', async () => {
    linkWithCredential.mockRejectedValueOnce(failure('auth/credential-already-in-use'));
    GoogleAuthProvider.credentialFromError.mockReturnValueOnce({ existing: true });
    await expect(linkGoogleAccount()).resolves.toEqual({ status: 'already_linked', credential: { existing: true } });
    expect(GoogleSignin.signOut).not.toHaveBeenCalled();
  });

  it('maps errors to the kinds the settings show', async () => {
    GoogleSignin.signIn.mockRejectedValueOnce(failure('10'));
    expect(await kindOf(linkGoogleAccount())).toBe('not_configured');
    GoogleSignin.signIn.mockRejectedValueOnce(failure('no_play'));
    expect(await kindOf(linkGoogleAccount())).toBe('no_play_services');
    GoogleSignin.signIn.mockRejectedValueOnce(failure('in_progress'));
    expect(await kindOf(linkGoogleAccount())).toBe('in_progress');
    linkWithCredential.mockRejectedValueOnce(failure('auth/network-request-failed'));
    expect(await kindOf(linkGoogleAccount())).toBe('network');
    linkWithCredential.mockRejectedValueOnce(failure('auth/operation-not-allowed'));
    expect(await kindOf(linkGoogleAccount())).toBe('not_configured');
    linkWithCredential.mockRejectedValueOnce(failure('auth/something-new'));
    expect(await kindOf(linkGoogleAccount())).toBe('unknown');
  });

  it('forgets the Google account on the phone when linking fails', async () => {
    linkWithCredential.mockRejectedValueOnce(failure('auth/network-request-failed'));
    await kindOf(linkGoogleAccount());
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});

describe('switching and signing out', () => {
  it('switches to the existing player', async () => {
    await switchToGoogleAccount({ existing: true });
    expect(signInWithCredential).toHaveBeenCalledWith(auth, { existing: true });
  });

  it('signs out to a new anonymous player', async () => {
    await signOutToAnonymous();
    expectInOrder(GoogleSignin.signOut, signOut, ensureSignedIn);
  });
});

describe('saveNickname', () => {
  it('saves the name only for a signed-in player', async () => {
    await saveNickname('Anna');
    expect(setDoc).not.toHaveBeenCalled();
    auth.currentUser = GOOGLE_USER;
    await saveNickname('Anna');
    expect(setDoc).toHaveBeenCalledWith('users/g-1', { nickname: 'Anna', updatedAt: 'server-time' });
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    auth.currentUser = GOOGLE_USER;
  });

  it('does nothing for an anonymous player', async () => {
    auth.currentUser = ANONYMOUS_USER;
    await expect(deleteAccount()).resolves.toEqual({ status: 'cancelled' });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('deletes nothing when the player cancels the fresh sign-in', async () => {
    pickerCancelled();
    await expect(deleteAccount()).resolves.toEqual({ status: 'cancelled' });
    expect(forgetMyGames).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('confirms the account, then leaves the history, deletes the name, then the user', async () => {
    await expect(deleteAccount()).resolves.toEqual({ status: 'deleted' });
    expect(forgetMyGames).toHaveBeenCalledWith('g-1');
    expect(deleteDoc).toHaveBeenCalledWith('users/g-1');
    expect(deleteUser).toHaveBeenCalledWith(GOOGLE_USER);
    expectInOrder(reauthenticateWithCredential, forgetMyGames, deleteDoc, deleteUser, GoogleSignin.revokeAccess, ensureSignedIn);
  });

  it('keeps everything when the player picks another Google account', async () => {
    reauthenticateWithCredential.mockRejectedValueOnce(failure('auth/user-mismatch'));
    expect(await kindOf(deleteAccount())).toBe('wrong_account');
    expect(forgetMyGames).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('keeps the name and the user when leaving the history fails', async () => {
    forgetMyGames.mockRejectedValueOnce(failure('unavailable'));
    expect(await kindOf(deleteAccount())).toBe('unknown');
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
