import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import { setPlayerReady, leaveRoom } from '../firebase/roomService';
import { startGame } from '../game-logic/gameManager';
import { getCompositionForCount } from '../constants/roles';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';

const MIN_PLAYERS = 5;

export default function LobbyScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const [starting, setStarting] = useState(false);

  const t = DAY;

  // Redirect when game starts
  React.useEffect(() => {
    if (room && room.status === 'night') {
      navigation.replace('RoleReveal', { roomId, playerId, nickname });
    }
  }, [room?.status]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], code, hostId } = room;
  const isHost = playerId === hostId;
  const myPlayer = players.find((p) => p.id === playerId);
  const canStart = players.length >= MIN_PLAYERS;
  const composition = getCompositionForCount(players.length);

  async function handleReady() {
    await setPlayerReady(roomId, playerId, !myPlayer?.isReady);
  }

  async function handleStart() {
    if (!canStart) return;
    setStarting(true);
    try {
      await startGame(roomId, players);
    } catch (e) {
      Alert.alert('Error', 'Could not start game.');
      setStarting(false);
    }
  }

  async function handleLeave() {
    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          await leaveRoom(roomId, playerId);
          navigation.replace('Home');
        }
      },
    ]);
  }

  async function shareCode() {
    await Share.share({ message: `Join my Werewolves game! Room code: ${code}` });
  }

  const roleCounts = composition.reduce((acc, r) => {
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      {/* Room Code */}
      <View style={[styles.codeBox, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.codeLabel, { color: t.textSecondary }]}>Room Code</Text>
        <TouchableOpacity onPress={shareCode} activeOpacity={0.7}>
          <Text style={[styles.code, { color: t.primary }]}>{code}</Text>
        </TouchableOpacity>
        <Text style={[styles.codeHint, { color: t.textMuted }]}>Tap to share</Text>
      </View>

      {/* Role Composition */}
      {players.length >= 5 && (
        <View style={[styles.compBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.compTitle, { color: t.textSecondary }]}>Suggested Roles ({players.length} players)</Text>
          <View style={styles.compRow}>
            {Object.entries(roleCounts).map(([role, count]) => (
              <View key={role} style={[styles.rolePill, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
                <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Player List */}
      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
        Players ({players.length}/{canStart ? players.length : `need ${MIN_PLAYERS}`})
      </Text>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.playerRow, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.avatar, { backgroundColor: t.primary }]}>
              <Text style={styles.avatarText}>{item.nickname?.[0]?.toUpperCase()}</Text>
            </View>
            <Text style={[styles.playerName, { color: t.text }]}>{item.nickname}</Text>
            {item.isHost && <Text style={[styles.badge, { color: t.accent }]}>HOST</Text>}
            {item.id === playerId && <Text style={[styles.badge, { color: t.textMuted }]}>YOU</Text>}
            {!item.isHost && (
              <Text style={{ marginLeft: 'auto', fontSize: 18 }}>
                {item.isReady ? '✅' : '⏳'}
              </Text>
            )}
          </View>
        )}
        ListFooterComponent={<View style={{ height: SPACING.xl }} />}
      />

      {/* Actions */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        {!isHost && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: myPlayer?.isReady ? t.success : t.primary }]}
            onPress={handleReady}
          >
            <Text style={styles.btnText}>{myPlayer?.isReady ? '✅ Ready!' : '⏳ Mark Ready'}</Text>
          </TouchableOpacity>
        )}
        {isHost && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: canStart ? t.primary : t.border, opacity: canStart ? 1 : 0.6 }]}
            onPress={handleStart}
            disabled={!canStart || starting}
          >
            {starting ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>
                {canStart ? '🐺 Start Game' : `Need ${MIN_PLAYERS - players.length} more players`}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.leaveBtn, { borderColor: t.danger }]} onPress={handleLeave}>
          <Text style={[styles.leaveText, { color: t.danger }]}>Leave Room</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  codeBox: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  codeLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  code: { ...FONTS.code, fontSize: 40, marginVertical: SPACING.xs },
  codeHint: { ...FONTS.caption, fontStyle: 'italic' },
  compBox: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  compTitle: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: SPACING.xs },
  compRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  roleEmoji: { fontSize: 16 },
  roleCount: { ...FONTS.caption, fontWeight: '700' },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  list: { flex: 1, paddingHorizontal: SPACING.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  playerName: { ...FONTS.body, flex: 1 },
  badge: { ...FONTS.caption, fontWeight: '700', letterSpacing: 1 },
  footer: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
  },
  btn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnText: { ...FONTS.button, color: '#fff' },
  leaveBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  leaveText: { ...FONTS.button },
});
