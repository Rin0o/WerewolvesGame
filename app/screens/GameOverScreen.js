import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import { updateRoom } from '../firebase/roomService';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS } from '../constants/icons';
import useSoundEffect from '../hooks/useSoundEffect';
import { DAY, NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function GameOverScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);

  const winner = room?.winner;
  const isVillagers = winner === 'villagers';
  const isLovers = winner === 'lovers';
  useSoundEffect(room ? (isVillagers || isLovers ? 'villagersWin' : 'wolvesWin') : null);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: NIGHT.background }]}>
        <ActivityIndicator size="large" color={NIGHT.accent} />
      </View>
    );
  }

  const { players = [], roles = {}, events = [], hostId } = room;
  const isHost = playerId === hostId;
  const t = isVillagers || isLovers ? DAY : NIGHT;

  async function handlePlayAgain() {
    if (!isHost) {
      Alert.alert('Only the host can restart the game.');
      return;
    }
    await updateRoom(roomId, {
      status: 'lobby',
      phase: 0,
      roles: {},
      nightActions: {},
      eliminatedThisNight: null,
      events: [],
      votes: {},
      accusedPlayerId: null,
      winner: null,
      witchPotions: {},
      hunterTriggered: null,
      phaseStartedAt: null,
      players: players.map((p) => ({ ...p, isAlive: true, isReady: false })),
    });
    navigation.replace('Lobby', { roomId, playerId, nickname });
  }

  function handleLeave() {
    navigation.replace('Home');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Winner banner */}
        <View style={[styles.banner, { backgroundColor: t.surface, borderColor: isLovers ? '#E85090' : isVillagers ? t.success : t.danger }]}>
          <Text style={styles.bannerEmoji}>{isLovers ? '💘' : isVillagers ? '🏡' : '🐺'}</Text>
          <Text style={[styles.bannerTitle, { color: isLovers ? '#E85090' : isVillagers ? t.success : t.danger }]}>
            {isLovers ? 'The Lovers Win!' : isVillagers ? 'Villagers Win!' : 'Werewolves Win!'}
          </Text>
          <Text style={[styles.bannerSub, { color: t.textSecondary }]}>
            {isLovers
              ? 'Bound by Cupid\'s arrow, the two lovers outlasted everyone else!'
              : isVillagers
              ? 'The village has driven out all werewolves!'
              : 'The werewolves have taken over Miller\'s Hollow!'}
          </Text>
        </View>

        {/* Player roles reveal */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>All Roles Revealed</Text>
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const role = roles[item.id];
            const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.villager;
            const isWinner =
              (winner === 'villagers' && roleDef.team === 'villagers') ||
              (winner === 'werewolves' && roleDef.team === 'werewolves');
            return (
              <View style={[
                styles.playerReveal,
                { backgroundColor: t.surface, borderColor: isWinner ? t.success : t.border },
              ]}>
                {ROLE_ICONS[role] ? (
                  <Image source={ROLE_ICONS[role]} style={styles.revealIcon} resizeMode="contain" />
                ) : (
                  <Text style={styles.revealEmoji}>{roleDef.emoji}</Text>
                )}
                <View style={styles.revealInfo}>
                  <Text style={[styles.revealName, { color: t.text }]}>
                    {item.nickname} {item.id === playerId ? '(you)' : ''}
                  </Text>
                  <Text style={[styles.revealRole, { color: t.textMuted }]}>{roleDef.name}</Text>
                  {!item.isAlive && <Text style={[styles.revealDead, { color: t.danger }]}>☠️ Eliminated</Text>}
                </View>
                {isWinner && <Text style={styles.winBadge}>🏆</Text>}
              </View>
            );
          }}
        />

        {/* Event log */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Game Summary</Text>
        <View style={[styles.eventLog, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          {events.length === 0 ? (
            <Text style={[styles.noEvents, { color: t.textMuted }]}>No events recorded.</Text>
          ) : (
            events.map((e, i) => (
              <View key={i} style={[styles.eventEntry, { borderLeftColor: t.primary }]}>
                <Text style={[styles.eventText, { color: t.text }]}>{e}</Text>
              </View>
            ))
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isHost && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: t.primary }]}
              onPress={handlePlayAgain}
            >
              <Text style={styles.btnText}>🔄 Play Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, { borderColor: t.primary }]}
            onPress={handleLeave}
          >
            <Text style={[styles.btnText, { color: t.primary }]}>🚪 Leave</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  banner: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  bannerEmoji: { fontSize: 64, marginBottom: SPACING.sm },
  bannerTitle: { ...FONTS.title, marginBottom: SPACING.xs },
  bannerSub: { ...FONTS.body, textAlign: 'center' },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  playerReveal: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    gap: SPACING.md,
  },
  revealIcon: { width: 48, height: 48 },
  revealEmoji: { fontSize: 40 },
  revealInfo: { flex: 1 },
  revealName: { ...FONTS.subheading, fontWeight: '600' },
  revealRole: { ...FONTS.body },
  revealDead: { ...FONTS.body, fontWeight: '600' },
  winBadge: { fontSize: 26 },
  eventLog: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  noEvents: { ...FONTS.caption, fontStyle: 'italic' },
  eventEntry: {
    borderLeftWidth: 2,
    paddingLeft: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  eventText: { ...FONTS.caption, lineHeight: 18 },
  actions: { gap: SPACING.sm, marginTop: SPACING.xl },
  btn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  btnText: { ...FONTS.button, color: '#fff' },
});
