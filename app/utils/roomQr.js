const JOIN_PREFIX = 'werewolves://join/';
const ROOM_CODE_PATTERN = /^[A-Z0-9]{5}$/;

export function roomJoinLink(code) {
  return `${JOIN_PREFIX}${code}`;
}

export function roomCodeFromScan(data) {
  const text = (data || '').trim();
  if (!text.toLowerCase().startsWith(JOIN_PREFIX)) return null;
  const code = text.slice(JOIN_PREFIX.length).toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}
