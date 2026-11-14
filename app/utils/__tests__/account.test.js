import { accountStatus, nicknameAfterSignIn, accountErrorMessage } from '../account';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('accountStatus', () => {
  test('nobody signed in, or an anonymous player, is not signed in', () => {
    expect(accountStatus(null)).toEqual({ signedIn: false, email: null });
    expect(accountStatus({ isAnonymous: true, providerData: [] })).toEqual({ signedIn: false, email: null });
  });

  test('a linked player is signed in with their Google email', () => {
    const user = { isAnonymous: false, email: null, providerData: [{ providerId: 'google.com', email: 'ana@example.com' }] };
    expect(accountStatus(user)).toEqual({ signedIn: true, email: 'ana@example.com' });
  });
});

describe('nicknameAfterSignIn', () => {
  test('a name saved with the account wins over the phone name', () => {
    expect(nicknameAfterSignIn('Phone', ' Saved ')).toEqual({ nickname: 'Saved', save: false });
  });

  test('without a saved name, the phone name is kept and saved', () => {
    expect(nicknameAfterSignIn('Phone', null)).toEqual({ nickname: 'Phone', save: true });
  });

  test('an invalid saved name is ignored', () => {
    expect(nicknameAfterSignIn('Phone', 'X')).toEqual({ nickname: 'Phone', save: true });
  });

  test('an invalid phone name is never saved', () => {
    expect(nicknameAfterSignIn('', null)).toEqual({ nickname: '', save: false });
  });
});

describe('accountErrorMessage', () => {
  test('unknown kinds get the generic message', () => {
    expect(accountErrorMessage('not_configured')).toMatch(/isn't set up/);
    expect(accountErrorMessage(undefined)).toMatch(/went wrong/);
  });
});
