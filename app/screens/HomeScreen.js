import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInAnon, subscribeToAuth } from '../firebase/authService';
import { createRoom, findRoomByCode, joinRoom, getRoom } from '../firebase/roomService';
import { forgetRoomSnapshot } from '../hooks/useRoom';
import { loadSession, clearSession, screenForStatus } from '../utils/session';
import { loadProfile, sameNickname } from '../utils/profile';
import SettingsPanel from '../components/SettingsPanel';
import QrScannerModal from '../components/QrScannerModal';
import { NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';

const MOON_IMAGE = require('../../assets/moon_borderless.webp');
const HOME_BACKGROUND = require('../../assets/home_background.webp');
const SETTINGS_ICON = require('../../assets/home_settings.webp');
const MOONLIGHT_TITLE = '#FFF1CC';
const MOONLIGHT_TEXT = '#EDE3FF';
const MOONLIGHT_LINE = 'rgba(237,227,255,0.45)';
const LANTERN_GOLD = '#E8C060';
const DARK_GLASS = 'rgba(13,8,32,0.78)';
const SETTINGS_THEME = {
  ...NIGHT,
  surface: '#1E1340',
  surfaceAlt: '#33246A',
  border: 'rgba(232,192,96,0.65)',
  primary: '#9A6BF5',
  text: MOONLIGHT_TITLE,
  textSecondary: LANTERN_GOLD,
  textMuted: '#CDBFEA',
  modalOverlay: 'rgba(0,0,0,0.65)',
};

const STATUS_LABELS = {
  lobby: 'waiting in the lobby',
  night: 'in progress (night)',
  day:   'in progress (day)',
  ended: 'finished',
};

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [resumable, setResumable] = useState(null);

  useEffect(() => {
    let active = true;
    loadProfile().then((saved) => {
      if (!active) return;
      if (!saved.nickname) navigation.replace('Welcome');
      else setProfile(saved);
    });
    return () => { active = false; };
  }, [navigation]);

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

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function checkForResumableGame() {
      const session = await loadSession();
      if (!session || session.playerId !== userId) {
        if (active) setResumable(null);
        return;
      }
      try {
        const room = await getRoom(session.roomId);
        const stillInRoom = room?.players?.some((p) => p.id === userId);
        if (!room || !stillInRoom || !screenForStatus(room.status)) {
          await clearSession();
          if (active) setResumable(null);
          return;
        }
        if (active) setResumable({ ...session, code: room.code, status: room.status });
      } catch {
        if (active) setResumable(null);
      }
    }

    checkForResumableGame();
    const unsubscribe = navigation.addListener('focus', checkForResumableGame);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, navigation]);

  function handleRejoin() {
    if (!resumable) return;
    const { roomId, playerId, nickname: savedNickname, status } = resumable;
    forgetRoomSnapshot(roomId);
    setResumable(null);
    navigation.navigate(screenForStatus(status), { roomId, playerId, nickname: savedNickname });
  }

  async function handleForgetGame() {
    await clearSession();
    setResumable(null);
  }

  async function handleCreateRoom() {
    const name = profile?.nickname;
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

  function handleJoinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (!code || code.length !== 5) {
      Alert.alert('Invalid code', 'Room codes are 5 characters long.');
      return;
    }
    joinByCode(code);
  }

  function handleCodeScanned(code) {
    setScannerOpen(false);
    setRoomCode(code);
    joinByCode(code);
  }

  async function joinByCode(code) {
    const name = profile?.nickname;
    if (!name || !userId || loading) return;
    setLoading(true);
    try {
      const room = await findRoomByCode(code);
      if (!room) { Alert.alert('Room not found', 'No room with that code exists.'); return; }
      if (room.status !== 'lobby') { Alert.alert('Game in progress', 'This room\'s game has already started.'); return; }
      const alreadyIn = room.players.some((p) => p.id === userId);
      if (!alreadyIn && room.players.some((p) => sameNickname(p.nickname, name))) {
        Alert.alert('Name already taken', `Someone in this room is already called ${name}. Change your name in ⚙️ settings.`);
        return;
      }
      if (!alreadyIn) {
        await joinRoom(room.roomId, { id: userId, nickname: name, isAlive: true, isHost: false, isReady: false });
      }
      forgetRoomSnapshot(room.roomId);
      navigation.navigate('Lobby', { roomId: room.roomId, playerId: userId, nickname: name });
    } catch (e) {
      Alert.alert('Error', 'Could not join room. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const t = NIGHT;

  if (!profile) {
    return (
      <View style={[styles.safe, styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return (
    <ImageBackground source={HOME_BACKGROUND} style={[styles.safe, { backgroundColor: t.background }]} resizeMode="cover">
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} hitSlop={12} accessibilityLabel="Settings">
              <Image source={SETTINGS_ICON} style={styles.settingsIcon} resizeMode="contain" />
            </TouchableOpacity>
            <View style={styles.headerVeil}>
              <Image source={MOON_IMAGE} style={styles.moon} resizeMode="contain" />
              <Text style={[styles.title, styles.moonlit, { color: MOONLIGHT_TITLE }]}>Werewolves</Text>
              <Text style={[styles.subtitle, styles.moonlit, { color: MOONLIGHT_TEXT }]}>of Miller's Hollow</Text>
              <Text style={[styles.playingAs, styles.moonlit, { color: MOONLIGHT_TEXT }]}>
                Playing as <Text style={[styles.playingAsName, { color: MOONLIGHT_TITLE }]}>{profile.nickname}</Text>
              </Text>
            </View>
          </View>

          {resumable && (
            <View style={[styles.card, styles.resumeCard]}>
              <Text style={[styles.label, { color: t.accent }]}>Game in progress</Text>
              <Text style={[styles.resumeText, { color: t.text }]}>
                Room {resumable.code} is {STATUS_LABELS[resumable.status]}. You're playing as {resumable.nickname}.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, styles.resumeBtn]}
                onPress={handleRejoin}
              >
                <Text style={styles.btnText}>↩️ Rejoin Game</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForgetGame}>
                <Text style={[styles.forgetText, { color: t.textMuted }]}>Not now — forget this game</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Create Room */}
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleCreateRoom}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={MOONLIGHT_TITLE} /> : (
              <Text style={styles.btnText}>🏠 Create Room</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: MOONLIGHT_LINE }]} />
            <Text style={[styles.dividerText, styles.moonlit, { color: MOONLIGHT_TEXT }]}>or join one</Text>
            <View style={[styles.dividerLine, { backgroundColor: MOONLIGHT_LINE }]} />
          </View>

          {/* Join Room */}
          <View style={[styles.card, { borderColor: t.primary }]}>
            <Text style={[styles.label, { color: t.accent }]}>Room Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.primary }]}
              value={roomCode}
              onChangeText={(v) => setRoomCode(v.toUpperCase())}
              placeholder="XXXXX"
              placeholderTextColor={t.textMuted}
              maxLength={5}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleJoinRoom}
            disabled={loading}
          >
            <Text style={[styles.btnText, { color: LANTERN_GOLD }]}>🚪 Join Room</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setScannerOpen(true)}
            disabled={loading}
          >
            <Text style={[styles.btnText, { color: LANTERN_GOLD }]}>📷 Scan QR Code</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <TouchableOpacity style={styles.closeAppBtn} onPress={() => BackHandler.exitApp()}>
              <Text style={[styles.closeAppText, styles.moonlit, { color: MOONLIGHT_TEXT }]}>Close the app</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SettingsPanel
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={SETTINGS_THEME}
        profile={profile}
        onProfileChange={setProfile}
      />

      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCodeScanned={handleCodeScanned}
        theme={t}
      />
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  settingsBtn: { position: 'absolute', top: SPACING.sm - SPACING.xxl, right: -SPACING.sm, zIndex: 10, padding: SPACING.xs },
  settingsIcon: { width: 52, height: 52 },
  playingAs: { ...FONTS.body, marginTop: SPACING.md },
  playingAsName: { fontWeight: '700' },
  content: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  headerVeil: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(8,4,24,0.55)',
  },
  moonlit: {
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  moon: { width: 88, height: 88, marginBottom: SPACING.sm },
  title: { ...FONTS.title, fontSize: 36 },
  subtitle: { ...FONTS.subheading, marginTop: SPACING.xs },
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    backgroundColor: DARK_GLASS,
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
  btnPrimary: { backgroundColor: NIGHT.primaryDark, borderWidth: 1.5, borderColor: LANTERN_GOLD },
  btnSecondary: { backgroundColor: DARK_GLASS, borderWidth: 2, borderColor: LANTERN_GOLD },
  btnText: { ...FONTS.button, color: MOONLIGHT_TITLE },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { ...FONTS.caption, marginHorizontal: SPACING.sm },
  resumeCard: { borderWidth: 2, borderColor: LANTERN_GOLD },
  resumeText: { ...FONTS.body, marginBottom: SPACING.md },
  resumeBtn: { marginBottom: SPACING.sm },
  forgetText: { ...FONTS.caption, textAlign: 'center' },
  closeAppBtn: { alignSelf: 'center', marginTop: SPACING.xl, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  closeAppText: { ...FONTS.body, fontWeight: '600', textDecorationLine: 'underline' },
});
