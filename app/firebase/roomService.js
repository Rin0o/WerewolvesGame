import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';

export const CHAT_MESSAGE_MAX = 500;

// ─── Room CRUD ────────────────────────────────────────────────────────────────

export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export async function createRoom(hostId, hostNickname) {
  const code = generateRoomCode();
  const roomRef = doc(collection(db, 'rooms'));

  await setDoc(roomRef, {
    code,
    hostId,
    status: 'lobby',
    phase: 0,
    memberIds: [hostId],
    players: [{ id: hostId, nickname: hostNickname, isAlive: true, isHost: true, isReady: false }],
    roles: {},
    nightActions: {},
    eliminatedThisNight: null,
    events: [],
    votes: {},
    winner: null,
    createdAt: serverTimestamp(),
    phaseStartedAt: null,
    witchPotions: {},
  });

  return { roomId: roomRef.id, code };
}

export async function findRoomByCode(code) {
  const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { roomId: docSnap.id, ...docSnap.data() };
}

export async function getRoom(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  return snap.exists() ? { roomId: snap.id, ...snap.data() } : null;
}

export async function beatHost(roomId) {
  await updateDoc(doc(db, 'rooms', roomId), { hostHeartbeat: increment(1) });
}

export async function takeOverHost(roomId, staleHostId, staleHeartbeat, newHostId) {
  const roomRef = doc(db, 'rooms', roomId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return false;
    const room = snap.data();
    if (room.hostId !== staleHostId || (room.hostHeartbeat ?? null) !== (staleHeartbeat ?? null)) return false;
    tx.update(roomRef, {
      hostId: newHostId,
      hostHeartbeat: (room.hostHeartbeat ?? 0) + 1,
      players: (room.players || []).map((p) => ({ ...p, isHost: p.id === newHostId })),
    });
    return true;
  });
}

export async function joinRoom(roomId, player) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    players: arrayUnion(player),
    memberIds: arrayUnion(player.id),
  });
}

export async function leaveRoom(roomId, playerId) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const { players } = snap.data();
  const updated = players.filter((p) => p.id !== playerId);
  await updateDoc(roomRef, { players: updated, memberIds: arrayRemove(playerId) });
}

function updateLobbyPlayers(roomId, change) {
  const roomRef = doc(db, 'rooms', roomId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists() || snap.data().status !== 'lobby') return false;
    const players = change(snap.data().players || []);
    if (!players) return false;
    tx.update(roomRef, { players });
    return true;
  });
}

export function setPlayerReady(roomId, playerId, isReady) {
  return updateLobbyPlayers(roomId, (players) => players.map((p) => (p.id === playerId ? { ...p, isReady } : p)));
}

function withSeat(player, seat) {
  const { seat: _oldSeat, ...rest } = player;
  return Number.isInteger(seat) ? { ...rest, seat } : rest;
}

export function takeSeat(roomId, playerId, seat, { swap = false } = {}) {
  return updateLobbyPlayers(roomId, (players) => {
    const mover = players.find((p) => p.id === playerId);
    const occupant = players.find((p) => p.id !== playerId && p.seat === seat);
    if (!mover || (occupant && !swap)) return null;
    return players.map((p) => {
      if (p === mover) return withSeat(p, seat);
      if (p === occupant) return withSeat(p, mover.seat);
      return p;
    });
  });
}

// ─── Real-time listener ───────────────────────────────────────────────────────

export function subscribeToRoom(roomId, callback) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) callback({ roomId: snap.id, ...snap.data() });
  });
}

// ─── Game state updates ───────────────────────────────────────────────────────

export async function updateRoom(roomId, data) {
  await updateDoc(doc(db, 'rooms', roomId), data);
}

export async function disconnectPlayer(roomId, playerId) {
  await updateDoc(doc(db, 'rooms', roomId), { disconnectedPlayers: arrayUnion(playerId) });
}

export async function reconnectPlayer(roomId, playerId) {
  await updateDoc(doc(db, 'rooms', roomId), { disconnectedPlayers: arrayRemove(playerId) });
}

export async function eliminatePlayer(roomId, playerId) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const { players } = snap.data();
  const updated = players.map((p) => (p.id === playerId ? { ...p, isAlive: false } : p));
  await updateDoc(roomRef, { players: updated, ghostIds: arrayUnion(playerId) });
}

// ─── Night actions ────────────────────────────────────────────────────────────

export async function acknowledgeRole(roomId, playerId) {
  await updateDoc(doc(db, 'rooms', roomId), { roleAcknowledged: arrayUnion(playerId) });
}

export async function submitNightAction(roomId, role, action) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`nightActions.${role}`]: action,
  });
}

export async function clearNightActions(roomId) {
  await updateDoc(doc(db, 'rooms', roomId), { nightActions: {}, eliminatedThisNight: null });
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export async function confirmDayVote(roomId, voterId, targetId) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`votes.${voterId}`]: { target: targetId, confirmed: true },
  });
}

export async function closeVoting(roomId) {
  await updateDoc(doc(db, 'rooms', roomId), { votesClosed: true });
}

// ─── Day chat ─────────────────────────────────────────────────────────────────

export async function clearDayChat(roomId) {
  const chatRef = collection(db, 'rooms', roomId, 'dayChat');
  const snap = await getDocs(chatRef);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function sendDayMessage(roomId, senderId, senderNickname, text) {
  const chatRef = collection(db, 'rooms', roomId, 'dayChat');
  await addDoc(chatRef, { senderId, senderNickname, text, createdAt: serverTimestamp() });
}

export function subscribeToDayChat(roomId, callback) {
  const chatRef = collection(db, 'rooms', roomId, 'dayChat');
  const q = query(chatRef, orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ─── Private chats (werewolves, sisters, ghosts) ──────────────────────────────

async function clearChat(roomId, chat) {
  const snap = await getDocs(collection(db, 'rooms', roomId, chat));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

async function sendChatMessage(roomId, chat, senderId, senderNickname, text) {
  await addDoc(collection(db, 'rooms', roomId, chat), { senderId, senderNickname, text, createdAt: serverTimestamp() });
}

function subscribeToChat(roomId, chat, callback) {
  const q = query(collection(db, 'rooms', roomId, chat), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function clearWerewolfChat(roomId) {
  return clearChat(roomId, 'werewolfChat');
}

export function sendWerewolfMessage(roomId, senderId, senderNickname, text) {
  return sendChatMessage(roomId, 'werewolfChat', senderId, senderNickname, text);
}

export function subscribeToWerewolfChat(roomId, callback) {
  return subscribeToChat(roomId, 'werewolfChat', callback);
}

export function clearSisterChat(roomId) {
  return clearChat(roomId, 'sisterChat');
}

export function sendSisterMessage(roomId, senderId, senderNickname, text) {
  return sendChatMessage(roomId, 'sisterChat', senderId, senderNickname, text);
}

export function subscribeToSisterChat(roomId, callback) {
  return subscribeToChat(roomId, 'sisterChat', callback);
}

export function clearGhostChat(roomId) {
  return clearChat(roomId, 'ghostChat');
}

export function sendGhostMessage(roomId, senderId, senderNickname, text) {
  return sendChatMessage(roomId, 'ghostChat', senderId, senderNickname, text);
}

export function subscribeToGhostChat(roomId, callback) {
  return subscribeToChat(roomId, 'ghostChat', callback);
}

// ─── Player notes (stored per-device only via AsyncStorage, not Firestore) ───
// See hooks/usePlayer.js for local notes persistence
