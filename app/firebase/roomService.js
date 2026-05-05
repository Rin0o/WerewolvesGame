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
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';

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

export async function joinRoom(roomId, player) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    players: arrayUnion(player),
  });
}

export async function leaveRoom(roomId, playerId) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const { players } = snap.data();
  const updated = players.filter((p) => p.id !== playerId);
  await updateDoc(roomRef, { players: updated });
}

export async function setPlayerReady(roomId, playerId, isReady) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const { players } = snap.data();
  const updated = players.map((p) => (p.id === playerId ? { ...p, isReady } : p));
  await updateDoc(roomRef, { players: updated });
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

export async function addEvent(roomId, event) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, { events: arrayUnion(event) });
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
  await updateDoc(roomRef, { players: updated });
}

// ─── Night actions ────────────────────────────────────────────────────────────

export async function submitNightAction(roomId, role, action) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`nightActions.${role}`]: action,
  });
}

export async function clearNightActions(roomId) {
  await updateDoc(doc(db, 'rooms', roomId), { nightActions: {}, eliminatedThisNight: null });
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export async function selectDayVote(roomId, voterId, targetId) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`votes.${voterId}`]: { target: targetId, confirmed: false },
  });
}

export async function confirmDayVote(roomId, voterId, targetId) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`votes.${voterId}`]: { target: targetId, confirmed: true },
  });
}

export async function clearVotes(roomId) {
  await updateDoc(doc(db, 'rooms', roomId), { votes: {} });
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

// ─── Werewolf chat ────────────────────────────────────────────────────────────

export async function sendWerewolfMessage(roomId, senderId, senderNickname, text) {
  const chatRef = collection(db, 'rooms', roomId, 'werewolfChat');
  await addDoc(chatRef, {
    senderId,
    senderNickname,
    text,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToWerewolfChat(roomId, callback) {
  const chatRef = collection(db, 'rooms', roomId, 'werewolfChat');
  const q = query(chatRef, orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
}

// ─── Player notes (stored per-device only via AsyncStorage, not Firestore) ───
// See hooks/usePlayer.js for local notes persistence
