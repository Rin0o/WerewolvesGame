import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInAnon, subscribeToAuth } from '../firebase/authService';
import { createRoom, findRoomByCode, joinRoom } from '../firebase/roomService';
import { DAY, NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function HomeScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsub = subscribeToAuth(async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        const u = await signInAnon();
        setUserId(u.uid);
      }
    });
    return () => unsub();
  }, []);

  function validateNickname() {
    const trimmed = nickname.trim();
    if (!trimmed) { Alert.alert('Missing nickname', 'Please enter your nickname.'); return null; }
    if (trimmed.length < 2) { Alert.alert('Too short', 'Nickname must be at least 2 characters.'); return null; }
    if (trimmed.length > 18) { Alert.alert('Too long', 'Nickname must be 18 characters or fewer.'); return null; }
    return trimmed;
  }

  async function handleCreateRoom() {
    const name = validateNickname();
    if (!name || !userId) return;
    setLoading(true);
    try {
      const { roomId, code } = await createRoom(userId, name);
      navigation.navigate('Lobby', { roomId, playerId: userId, nickname: name });
    } catch (e) {
      Alert.alert('Error', 'Could not create room. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    const name = validateNickname();
    if (!name || !userId) return;
    const code = roomCode.trim().toUpperCase();
    if (!code || code.length !== 5) {
      Alert.alert('Invalid code', 'Room codes are 5 characters long.');
      return;
    }
    setLoading(true);
    try {
      const room = await findRoomByCode(code);
      if (!room) { Alert.alert('Room not found', 'No room with that code exists.'); return; }
      if (room.status !== 'lobby') { Alert.alert('Game in progress', 'This room\'s game has already started.'); return; }
      const alreadyIn = room.players.some((p) => p.id === userId);
      if (!alreadyIn) {
        await joinRoom(room.roomId, { id: userId, nickname: name, isAlive: true, isHost: false, isReady: false });
      }
      navigation.navigate('Lobby', { roomId: room.roomId, playerId: userId, nickname: name });
    } catch (e) {
      Alert.alert('Error', 'Could not join room. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const t = DAY;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.moon}>🌕</Text>
            <Text style={[styles.title, { color: t.primary }]}>Werewolves</Text>
            <Text style={[styles.subtitle, { color: t.textSecondary }]}>of Miller's Hollow</Text>
          </View>

          {/* Nickname */}
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.label, { color: t.textSecondary }]}>Your Nickname</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter your name..."
              placeholderTextColor={t.textMuted}
              maxLength={18}
              autoCapitalize="words"
            />
          </View>

          {/* Create Room */}
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { backgroundColor: t.primary }]}
            onPress={handleCreateRoom}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>🏠 Create Room</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
            <Text style={[styles.dividerText, { color: t.textMuted }]}>or join one</Text>
            <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
          </View>

          {/* Join Room */}
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.label, { color: t.textSecondary }]}>Room Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
              value={roomCode}
              onChangeText={(v) => setRoomCode(v.toUpperCase())}
              placeholder="XXXXX"
              placeholderTextColor={t.textMuted}
              maxLength={5}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, { borderColor: t.primary }]}
            onPress={handleJoinRoom}
            disabled={loading}
          >
            <Text style={[styles.btnText, { color: t.primary }]}>🚪 Join Room</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  moon: { fontSize: 56, marginBottom: SPACING.sm },
  title: { ...FONTS.title, fontSize: 36 },
  subtitle: { ...FONTS.subheading, marginTop: SPACING.xs },
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  label: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, fontWeight: '700' },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...FONTS.body,
  },
  codeInput: { ...FONTS.code, textAlign: 'center', letterSpacing: 8 },
  btn: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  btnPrimary: {},
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 2 },
  btnText: { ...FONTS.button, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { ...FONTS.caption, marginHorizontal: SPACING.sm },
});
