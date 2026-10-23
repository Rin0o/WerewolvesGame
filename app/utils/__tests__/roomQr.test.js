import { roomJoinLink, roomCodeFromScan } from '../roomQr';

describe('room QR codes', () => {
  it('reads back the code from our own join link', () => {
    expect(roomCodeFromScan(roomJoinLink('AB12C'))).toBe('AB12C');
  });

  it('accepts lower case and surrounding spaces', () => {
    expect(roomCodeFromScan('  werewolves://join/ab12c \n')).toBe('AB12C');
    expect(roomCodeFromScan('WEREWOLVES://JOIN/AB12C')).toBe('AB12C');
  });

  it('ignores QR codes that are not ours', () => {
    expect(roomCodeFromScan('https://example.com/join/AB12C')).toBeNull();
    expect(roomCodeFromScan('AB12C')).toBeNull();
    expect(roomCodeFromScan('werewolves://lobby/AB12C')).toBeNull();
  });

  it('rejects malformed room codes', () => {
    expect(roomCodeFromScan('werewolves://join/')).toBeNull();
    expect(roomCodeFromScan('werewolves://join/AB12')).toBeNull();
    expect(roomCodeFromScan('werewolves://join/AB12CD')).toBeNull();
    expect(roomCodeFromScan('werewolves://join/AB-2C')).toBeNull();
    expect(roomCodeFromScan('werewolves://join/AB12C/extra')).toBeNull();
  });

  it('copes with empty scans', () => {
    expect(roomCodeFromScan('')).toBeNull();
    expect(roomCodeFromScan(null)).toBeNull();
    expect(roomCodeFromScan(undefined)).toBeNull();
  });
});
