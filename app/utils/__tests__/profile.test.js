jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { nicknameError, sameNickname, NICKNAME_MAX } from '../profile';

describe('nicknameError', () => {
  it('accepts names from 2 to 18 characters', () => {
    expect(nicknameError('Al')).toBeNull();
    expect(nicknameError('A'.repeat(NICKNAME_MAX))).toBeNull();
  });

  it('asks for a name when it is empty or only spaces', () => {
    expect(nicknameError('')).toMatch(/enter a name/);
    expect(nicknameError('   ')).toMatch(/enter a name/);
    expect(nicknameError(null)).toMatch(/enter a name/);
  });

  it('rejects names that are too short or too long', () => {
    expect(nicknameError('A')).toMatch(/at least 2/);
    expect(nicknameError('A'.repeat(NICKNAME_MAX + 1))).toMatch(/18 characters or fewer/);
  });

  it('measures the name without surrounding spaces', () => {
    expect(nicknameError(' A ')).toMatch(/at least 2/);
    expect(nicknameError(`  ${'A'.repeat(NICKNAME_MAX)}  `)).toBeNull();
  });
});

describe('sameNickname', () => {
  it('treats names as equal regardless of case and surrounding spaces', () => {
    expect(sameNickname('Ana', 'ana')).toBe(true);
    expect(sameNickname(' ANA ', 'ana')).toBe(true);
  });

  it('tells different names apart', () => {
    expect(sameNickname('Ana', 'Anna')).toBe(false);
    expect(sameNickname('Ana', '')).toBe(false);
  });

  it('copes with missing names', () => {
    expect(sameNickname(null, undefined)).toBe(true);
    expect(sameNickname(null, 'Ana')).toBe(false);
  });
});
