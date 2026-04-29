import React, { useRef } from 'react';
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
import { setPlayerReady, leaveRoom, updateRoom } from '../firebase/roomService';
import { startGame } from '../game-logic/gameManager';
import { ROLE, ROLE_DEFINITIONS, getCompositionForCount, buildCustomComposition } from '../constants/roles';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { BOT_CONFIG } from '../constants/devConfig';

const MIN_PLAYERS = 5;
const SPECIAL_ROLES = [ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF];

export default function LobbyScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const customInitDone = useRef(false);

  const t = DAY;

  React.useEffect(() => {
    if (room && room.status === 'night') {
      navigation.replace('RoleReveal', { roomId, playerId, nickname });
    }
  }, [room?.status]);

  // When host switches to custom mode, write default customRoles once
  React.useEffect(() => {
    if (!room || customInitDone.current || room.customRoles) return;
    if (playerId !== room.hostId) return;
    if ((room.gameMode || 'normal') !== 'custom') return;
    customInitDone.current = true;
    const humanCount = room.players.filter((p) => !p.isBot).length;
    const botCount = BOT_CONFIG.enabled ? BOT_CONFIG.bots.length : 0;
    const total = Math.max(MIN_PLAYERS, humanCount + botCount);
    updateRoom(roomId, {
      customRoles: { playerCount: total, werewolf: 1, seer: true, witch: false, hunter: false, cupid: false, thief: false },
    });
  }, [room?.gameMode, room?.customRoles]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], code, hostId, customRoles, gameMode: rawMode } = room;
  const gameMode = rawMode || 'normal';
  const isHost = playerId === hostId;
  const myPlayer = players.find((p) => p.id === playerId);
  const humanPlayers = players.filter((p) => !p.isBot);
  const botCount = BOT_CONFIG.enabled ? BOT_CONFIG.bots.length : 0;
  const effectiveCount = humanPlayers.length + botCount;

  // Normal mode derived values
  const normalComposition = getCompositionForCount(effectiveCount);
  const normalRoleCounts = normalComposition.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const normalCanStart = effectiveCount >= MIN_PLAYERS;

  // Custom mode derived values
  const cfg = customRoles || { playerCount: MIN_PLAYERS, werewolf: 1, seer: true, witch: false, hunter: false, cupid: false, thief: false };
  const usedSlots = cfg.werewolf + SPECIAL_ROLES.filter((r) => cfg[r]).length;
  const villagerCount = cfg.playerCount - usedSlots;
  const isValidConfig = villagerCount >= 1 && cfg.werewolf >= 1;
  const customCanStart = isValidConfig && effectiveCount === cfg.playerCount;
  const customComposition = isValidConfig ? buildCustomComposition(cfg) : [];
  const customRoleCounts = customComposition.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});

  const canStart = gameMode === 'normal' ? normalCanStart : customCanStart;

  async function setMode(mode) {
    await updateRoom(roomId, { gameMode: mode });
    // Reset customInitDone so defaults get written on first switch to custom
    if (mode === 'custom') customInitDone.current = false;
  }

  async function patchConfig(patch) {
    await updateRoom(roomId, { customRoles: { ...cfg, ...patch } });
  }

  function changePlayerCount(delta) {
    patchConfig({ playerCount: Math.max(MIN_PLAYERS, cfg.playerCount + delta) });
  }

  function changeWerewolves(delta) {
    patchConfig({ werewolf: Math.max(1, cfg.werewolf + delta) });
  }

  function toggleSpecialRole(role) {
    patchConfig({ [role]: !cfg[role] });
  }

  async function handleReady() {
    await setPlayerReady(roomId, playerId, !myPlayer?.isReady);
  }

  async function handleStart() {
    if (!canStart) return;
    try {
      const composition = gameMode === 'custom' ? buildCustomComposition(cfg) : null;
      await startGame(roomId, players, composition);
    } catch (e) {
      Alert.alert('Error', 'Could not start game.');
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

  function startBtnLabel() {
    if (gameMode === 'normal') {
      return normalCanStart ? '🐺 Start Game' : `Need ${MIN_PLAYERS - effectiveCount} more player(s)`;
    }
    if (!isValidConfig) return 'Invalid composition';
    if (effectiveCount < cfg.playerCount) return `Waiting for ${cfg.playerCount - effectiveCount} more player(s)`;
    if (effectiveCount > cfg.playerCount) return `${effectiveCount - cfg.playerCount} too many players`;
    return '🐺 Start Game';
  }

  const header = (
    <>
      {/* Room Code */}
      <View style={[styles.codeBox, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.codeLabel, { color: t.textSecondary }]}>Room Code</Text>
        <TouchableOpacity onPress={shareCode} activeOpacity={0.7}>
          <Text style={[styles.code, { color: t.primary }]}>{code}</Text>
        </TouchableOpacity>
        <Text style={[styles.codeHint, { color: t.textMuted }]}>Tap to share</Text>
      </View>

      {/* Mode selector — host only */}
      {isHost && (
        <View style={[styles.modeSelector, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <TouchableOpacity
            style={[styles.modeTab, gameMode === 'normal' && { backgroundColor: t.primary }]}
            onPress={() => setMode('normal')}
          >
            <Text style={[styles.modeTabText, { color: gameMode === 'normal' ? '#fff' : t.textMuted }]}>
              🐺 Normal Game
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, gameMode === 'custom' && { backgroundColor: t.primary }]}
            onPress={() => setMode('custom')}
          >
            <Text style={[styles.modeTabText, { color: gameMode === 'custom' ? '#fff' : t.textMuted }]}>
              🎮 Custom Game
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Non-host mode label */}
      {!isHost && (
        <View style={[styles.modeBadge, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.modeBadgeText, { color: t.textSecondary }]}>
            {gameMode === 'custom' ? '🎮 Custom Game' : '🐺 Normal Game'}
          </Text>
        </View>
      )}

      {/* Normal mode — auto composition preview */}
      {gameMode === 'normal' && effectiveCount >= MIN_PLAYERS && (
        <View style={[styles.compBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.compTitle, { color: t.textSecondary }]}>
            Roles for {effectiveCount} players
          </Text>
          <View style={styles.compRow}>
            {Object.entries(normalRoleCounts).map(([role, count]) => (
              <View key={role} style={[styles.rolePill, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
                {count > 1 && <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Custom mode — host config panel */}
      {gameMode === 'custom' && isHost && (
        <View style={[styles.configBox, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.configTitle, { color: t.text }]}>Role Configuration</Text>

          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: t.text }]}>Players</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: t.border }]} onPress={() => changePlayerCount(-1)}>
                <Text style={[styles.stepBtnText, { color: t.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: t.primary }]}>{cfg.playerCount}</Text>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: t.border }]} onPress={() => changePlayerCount(1)}>
                <Text style={[styles.stepBtnText, { color: t.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: t.text }]}>🐺 Werewolves</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: t.border }]} onPress={() => changeWerewolves(-1)}>
                <Text style={[styles.stepBtnText, { color: t.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: t.primary }]}>{cfg.werewolf}</Text>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: t.border }]} onPress={() => changeWerewolves(1)}>
                <Text style={[styles.stepBtnText, { color: t.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {SPECIAL_ROLES.map((role) => {
            const info = ROLE_DEFINITIONS[role];
            const enabled = !!cfg[role];
            return (
              <View key={role} style={styles.configRow}>
                <Text style={[styles.configLabel, { color: t.text }]}>{info.emoji} {info.name}</Text>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: enabled ? t.success : t.surfaceAlt, borderColor: enabled ? t.success : t.border }]}
                  onPress={() => toggleSpecialRole(role)}
                >
                  <Text style={[styles.toggleText, { color: enabled ? '#fff' : t.textMuted }]}>
                    {enabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={[styles.configRow, { borderTopWidth: 1, borderTopColor: t.border, marginTop: SPACING.xs, paddingTop: SPACING.sm }]}>
            <Text style={[styles.configLabel, { color: t.textMuted }]}>🏡 Villagers (auto-filled)</Text>
            <Text style={[styles.stepValue, { color: villagerCount >= 1 ? t.success : t.danger }]}>
              {villagerCount}
            </Text>
          </View>

          {villagerCount < 1 && (
            <Text style={[styles.configWarning, { color: t.danger }]}>
              Too many roles — reduce roles or increase player count.
            </Text>
          )}
          {isValidConfig && effectiveCount !== cfg.playerCount && (
            <Text style={[styles.configWarning, { color: t.accent }]}>
              {effectiveCount < cfg.playerCount
                ? `Need ${cfg.playerCount - effectiveCount} more player(s) to join.`
                : `${effectiveCount - cfg.playerCount} too many players in room.`}
            </Text>
          )}

          {isValidConfig && (
            <View style={styles.previewRow}>
              {Object.entries(customRoleCounts).map(([role, count]) => (
                <View key={role} style={[styles.rolePill, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                  <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
                  {count > 1 && <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Custom mode — non-host read-only summary */}
      {gameMode === 'custom' && !isHost && isValidConfig && (
        <View style={[styles.compBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.compTitle, { color: t.textSecondary }]}>
            Roles for {cfg.playerCount} players
          </Text>
          <View style={styles.compRow}>
            {Object.entries(customRoleCounts).map(([role, count]) => (
              <View key={role} style={[styles.rolePill, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
                {count > 1 && <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bot notice */}
      {BOT_CONFIG.enabled && (
        <View style={[styles.compBox, { backgroundColor: '#1a0a2e', borderColor: '#6B4FA0' }]}>
          <Text style={[styles.compTitle, { color: '#A78BD4' }]}>
            🤖 Bot mode active — {botCount} bot{botCount !== 1 ? 's' : ''} will join on start
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
        Players ({humanPlayers.length}{gameMode === 'custom' ? `/${cfg.playerCount}` : ''})
      </Text>
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <FlatList
        data={humanPlayers}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
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
            disabled={!canStart}
          >
            <Text style={styles.btnText}>{startBtnLabel()}</Text>
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
  listContent: { paddingHorizontal: SPACING.md },
  codeBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  codeLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  code: { ...FONTS.code, fontSize: 40, marginVertical: SPACING.xs },
  codeHint: { ...FONTS.caption, fontStyle: 'italic' },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  modeTab: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  modeTabText: { ...FONTS.button },
  modeBadge: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modeBadgeText: { ...FONTS.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  configBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  configTitle: { ...FONTS.subheading, marginBottom: SPACING.sm },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  configLabel: { ...FONTS.body },
  configWarning: { ...FONTS.caption, marginTop: SPACING.xs, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, lineHeight: 24 },
  stepValue: { ...FONTS.subheading, minWidth: 28, textAlign: 'center' },
  toggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  toggleText: { ...FONTS.caption, fontWeight: '700' },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  compBox: {
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
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
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
