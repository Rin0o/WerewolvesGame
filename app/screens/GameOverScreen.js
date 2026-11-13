import React, { useEffect } from 'react';
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
import usePlayer from '../hooks/usePlayer';
import useHostFailover from '../hooks/useHostFailover';
import { clearSession } from '../utils/session';
import { updateRoom, clearDayChat, clearGhostChat } from '../firebase/roomService';
import GameReplay from '../components/GameReplay';
import { ROLE, ROLE_DEFINITIONS, isPackWolf } from '../constants/roles';
import { ROLE_ICONS, DEAD_ICON } from '../constants/icons';
import useSoundEffect from '../hooks/useSoundEffect';
import { gameOverSound } from '../utils/gameOverSound';
import { DAY, NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';

const VILLAGERS_WIN_BANNER = require('../../assets/villagers_win.webp');
const WEREWOLVES_WIN_BANNER = require('../../assets/werewolves_win.webp');
const LOVERS_WIN_BANNER = require('../../assets/lovers_win.webp');
const WHITE_WOLF_WIN_BANNER = require('../../assets/white_wolf_win.webp');
const LEAVE_ICON = require('../../assets/exit_game.webp');
const PLAY_AGAIN_ICON = require('../../assets/play_again.webp');

export default function GameOverScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  useHostFailover(roomId, playerId, room);
  const { clearGameData } = usePlayer(roomId);

  const winner = room?.winner;
  const isVillagers = winner === 'villagers';
  const isLovers = winner === 'lovers';
  useSoundEffect(gameOverSound(room));

  useEffect(() => {
    if (!room) return;
    if (room.status === 'lobby') {
      clearGameData().then(() => {
        navigation.replace('Lobby', { roomId, playerId, nickname });
      });
    }
  }, [room?.status]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: NIGHT.background }]}>
        <ActivityIndicator size="large" color={NIGHT.accent} />
      </View>
    );
  }

  const { players = [], roles = {}, hostId } = room;
  const isHost = playerId === hostId;
  const t = isVillagers || isLovers ? DAY : NIGHT;

  async function handlePlayAgain() {
    if (!isHost) {
      Alert.alert('Only the host can restart the game.');
      return;
    }
    await clearDayChat(roomId);
    await clearGhostChat(roomId).catch(() => {});
    await updateRoom(roomId, {
      ghostIds: [],
      history: [],
      status: 'lobby',
      phase: 0,
      roles: {},
      nightActions: {},
      eliminatedThisNight: null,
      events: [],
      votes: {},
      winner: null,
      witchPotions: {},
      hunterTriggered: null,
      phaseStartedAt: null,
      players: players
        .filter((p) => !p.isBot)
        .map(({ isNarrator, ...p }) => ({ ...p, isAlive: true, isReady: false })),
    });
  }

  function handleLeave() {
    clearSession();
    navigation.popTo('Home');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Winner banner */}
        <Image
          source={
            isLovers ? LOVERS_WIN_BANNER
              : isVillagers ? VILLAGERS_WIN_BANNER
              : winner === 'white_wolf' ? WHITE_WOLF_WIN_BANNER
              : WEREWOLVES_WIN_BANNER
          }
          style={styles.winnerBanner}
          resizeMode="contain"
        />

        {/* Player roles reveal */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>All Roles Revealed</Text>
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const role = roles[item.id];
            const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.villager;
            const infected = item.id === room.infectedId;
            const teamRole = infected ? ROLE.WEREWOLF : role;
            const isWinner =
              (winner === 'villagers' && (ROLE_DEFINITIONS[teamRole] || roleDef).team === 'villagers') ||
              (winner === 'werewolves' && isPackWolf(teamRole)) ||
              (winner === 'white_wolf' && role === ROLE.WHITE_WOLF) ||
              (winner === 'lovers' && room.lovers?.includes(item.id));
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
                  <Text style={[styles.revealRole, { color: t.textMuted }]}>
                    {roleDef.name}{infected ? ' · infected by the Wolf-Father' : ''}
                  </Text>
                  {!item.isAlive && (
                    <View style={styles.revealDeadRow}>
                      <Image source={DEAD_ICON} style={styles.revealDeadIcon} resizeMode="contain" />
                      <Text style={[styles.revealDead, { color: t.danger }]}>Eliminated</Text>
                    </View>
                  )}
                </View>
                {isWinner && <Text style={styles.winBadge}>🏆</Text>}
              </View>
            );
          }}
        />

        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>What really happened</Text>
        <GameReplay room={room} theme={t} />

        {/* Actions */}
        <View style={styles.actions}>
          {isHost && (
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain}>
              <Image source={PLAY_AGAIN_ICON} style={styles.playAgainIcon} resizeMode="contain" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
            <Image source={LEAVE_ICON} style={styles.leaveIcon} resizeMode="contain" />
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
  winnerBanner: {
    width: '100%',
    height: 220,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
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
  revealDeadRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  revealDeadIcon: { width: 18, height: 18 },
  revealDead: { ...FONTS.body, fontWeight: '600' },
  winBadge: { fontSize: 26 },
  actions: { gap: SPACING.md, marginTop: SPACING.xs, alignItems: 'center', flexDirection: 'row' },
  playAgainBtn: { alignItems: 'center' },
  playAgainIcon: { width: 160, height: 80, marginLeft: 20 },
  leaveBtn: { alignItems: 'center' },
  leaveIcon: { width: 160, height: 80 },
});
