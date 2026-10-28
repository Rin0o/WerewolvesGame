import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import useHostFailover from '../hooks/useHostFailover';
import { saveSession, clearSession } from '../utils/session';
import { setPlayerReady, leaveRoom, updateRoom } from '../firebase/roomService';
import { startGame, TIE_RULE } from '../game-logic/gameManager';
import { ROLE, ROLE_DEFINITIONS, getCompositionForCount, buildCustomComposition } from '../constants/roles';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { botSeats } from '../game-logic/bots';
import { ROLE_ICONS } from '../constants/icons';
import RoomQrCode from '../components/RoomQrCode';
import RoleInfoModal from '../components/RoleInfoModal';
import { roomJoinLink } from '../utils/roomQr';

const MIN_PLAYERS = 5;
const SPECIAL_ROLES = [ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.SAVIOUR, ROLE.BEAR_TAMER, ROLE.SISTER, ROLE.FOX, ROLE.WHITE_WOLF, ROLE.WOLF_HOUND];

export default function LobbyScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  useHostFailover(roomId, playerId, room);
  const customInitDone = useRef(false);
  const [starting, setStarting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [infoRole, setInfoRole] = useState(null);

  React.useEffect(() => {
    saveSession({ roomId, playerId, nickname });
  }, [roomId, playerId, nickname]);

  const t = DAY;

  React.useEffect(() => {
    if (room && room.status === 'night') {
      const me = room.players?.find((p) => p.id === playerId);
      if (me?.isNarrator) {
        navigation.replace('NightPhase', { roomId, playerId, nickname });
      } else {
        navigation.replace('RoleReveal', { roomId, playerId, nickname });
      }
    }
  }, [room?.status]);

  // When host switches to custom mode, write default customRoles once
  React.useEffect(() => {
    if (!room || customInitDone.current || room.customRoles) return;
    if (playerId !== room.hostId) return;
    if ((room.gameMode || 'normal') !== 'custom') return;
    customInitDone.current = true;
    const humanCount = room.players.filter((p) => !p.isBot).length;
    const total = Math.max(MIN_PLAYERS, humanCount);
    updateRoom(roomId, {
      customRoles: { playerCount: total, werewolf: 1, seer: true, witch: false, hunter: false, cupid: false, thief: false, saviour: false, bear_tamer: false, sister: false, fox: false, white_wolf: false, wolf_hound: false },
    });
  }, [room?.gameMode, room?.customRoles]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], code, hostId, customRoles, gameMode: rawMode, classicFirstNight = false, fillWithBots = false, botChat = false } = room;
  const gameMode = rawMode || 'normal';
  const revoteOnTie = room.tieRule === TIE_RULE.REVOTE;
  const isHost = playerId === hostId;
  const myPlayer = players.find((p) => p.id === playerId);
  const humanPlayers = players.filter((p) => !p.isBot);

  // In narrator mode the host is excluded from role-play, so subtract 1 from the count
  const narratorOffset = gameMode === 'narrator' ? 1 : 0;
  const playingHumans = humanPlayers.length - narratorOffset;

  const cfg = customRoles || { playerCount: MIN_PLAYERS, werewolf: 1, seer: true, witch: false, hunter: false, cupid: false, thief: false, saviour: false, bear_tamer: false, sister: false, fox: false, white_wolf: false, wolf_hound: false };

  const botsAvailable = gameMode !== 'narrator';
  const botTarget = gameMode === 'custom' ? cfg.playerCount : MIN_PLAYERS;
  const botCount = botsAvailable && fillWithBots ? botSeats(playingHumans, botTarget) : 0;
  const effectiveCount = playingHumans + botCount;

  // Normal mode derived values
  const normalComposition = getCompositionForCount(Math.max(1, effectiveCount));
  const normalRoleCounts = normalComposition.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const normalCanStart = effectiveCount >= MIN_PLAYERS;

  // Custom mode derived values
  const usedSlots = cfg.werewolf + SPECIAL_ROLES.reduce((acc, r) => acc + (cfg[r] ? (r === ROLE.SISTER ? 2 : 1) : 0), 0);
  const villagerCount = cfg.playerCount - usedSlots;
  const isValidConfig = villagerCount >= 1 && cfg.werewolf >= 1;
  const customCanStart = isValidConfig && effectiveCount === cfg.playerCount;
  const customComposition = isValidConfig ? buildCustomComposition(cfg) : [];
  const customRoleCounts = customComposition.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});

  const canStart = gameMode === 'normal' || gameMode === 'narrator' ? normalCanStart : customCanStart;

  async function setMode(mode) {
    await updateRoom(roomId, { gameMode: mode });
    // Reset customInitDone so defaults get written on first switch to custom
    if (mode === 'custom') customInitDone.current = false;
  }

  function setClassicFirstNight(classic) {
    updateRoom(roomId, { classicFirstNight: classic });
  }

  function setTieRule(tieRule) {
    updateRoom(roomId, { tieRule });
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
    if (!canStart || starting) return;
    setStarting(true);
    try {
      const gamePlayers = players.map(({ isNarrator, ...p }) =>
        (gameMode === 'narrator' && p.id === playerId ? { ...p, isNarrator: true } : p)
      );
      const composition = gameMode === 'custom' ? buildCustomComposition(cfg) : null;
      await startGame(roomId, gamePlayers, { composition, classicFirstNight, botCount });
    } catch (e) {
      setStarting(false);
      Alert.alert('Error', 'Could not start game.');
    }
  }

  async function handleLeave() {
    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          await leaveRoom(roomId, playerId);
          await clearSession();
          navigation.popTo('Home');
        }
      },
    ]);
  }

  async function shareCode() {
    await Share.share({ message: `Join my Werewolves game! Room code: ${code}` });
  }

  function setFillWithBots(fill) {
    updateRoom(roomId, { fillWithBots: fill });
  }

  function setBotChat(enabled) {
    updateRoom(roomId, { botChat: enabled });
  }

  function startLabelWithBots() {
    if (botCount === 0) return '🐺 Start Game';
    return `🐺 Start with ${botCount} bot${botCount !== 1 ? 's' : ''}`;
  }

  function startBtnLabel() {
    if (starting) return 'Starting...';
    if (gameMode === 'narrator') {
      return normalCanStart ? '🐺 Start Game (Narrator)' : `Need ${MIN_PLAYERS - effectiveCount} more player(s)`;
    }
    if (gameMode === 'normal') {
      return normalCanStart ? startLabelWithBots() : `Need ${MIN_PLAYERS - effectiveCount} more player(s)`;
    }
    if (!isValidConfig) return 'Invalid composition';
    if (effectiveCount < cfg.playerCount) return `Waiting for ${cfg.playerCount - effectiveCount} more player(s)`;
    if (effectiveCount > cfg.playerCount) return `${effectiveCount - cfg.playerCount} too many players`;
    return startLabelWithBots();
  }

  function botHint() {
    if (!fillWithBots) return 'Off — the game waits for real players.';
    if (botCount > 0) {
      return `${botCount} bot${botCount !== 1 ? 's' : ''} will join. Bots only play Werewolf, Villager or Sister.`;
    }
    return 'The table is full — no bots needed.';
  }

  function renderRolePill(role, count, backgroundColor) {
    return (
      <TouchableOpacity
        key={role}
        style={[styles.rolePill, { backgroundColor, borderColor: t.border }]}
        onPress={() => setInfoRole(role)}
      >
        {ROLE_ICONS[role] ? (
          <Image source={ROLE_ICONS[role]} style={styles.roleIcon} resizeMode="contain" />
        ) : (
          <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
        )}
        {count > 1 && <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>}
      </TouchableOpacity>
    );
  }

  const header = (
    <>
      {/* Room Code */}
      <View style={[styles.codeBox, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.codeLabel, { color: t.textSecondary }]}>Room Code</Text>
        <Text style={[styles.code, { color: t.primary }]}>{code}</Text>
        <View style={styles.codeActions}>
          <TouchableOpacity style={[styles.codeActionBtn, { borderColor: t.primary }]} onPress={shareCode}>
            <Text style={[styles.codeActionText, { color: t.primary }]}>📤 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.codeActionBtn, { borderColor: t.primary }]} onPress={() => setQrOpen(true)}>
            <Text style={[styles.codeActionText, { color: t.primary }]}>🔳 Show QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode selector — host only */}
      {isHost && (
        <View style={[styles.modeSelector, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <TouchableOpacity
            style={[styles.modeTab, gameMode === 'normal' && { backgroundColor: t.primary }]}
            onPress={() => setMode('normal')}
          >
            <Text style={[styles.modeTabText, { color: gameMode === 'normal' ? '#fff' : t.textMuted }]}>
              🐺 Normal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, gameMode === 'custom' && { backgroundColor: t.primary }]}
            onPress={() => setMode('custom')}
          >
            <Text style={[styles.modeTabText, { color: gameMode === 'custom' ? '#fff' : t.textMuted }]}>
              🎮 Custom
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, gameMode === 'narrator' && { backgroundColor: t.primary }]}
            onPress={() => setMode('narrator')}
          >
            <Text style={[styles.modeTabText, { color: gameMode === 'narrator' ? '#fff' : t.textMuted }]}>
              📖 Narrator
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Non-host mode label */}
      {!isHost && (
        <View style={[styles.modeBadge, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.modeBadgeText, { color: t.textSecondary }]}>
            {gameMode === 'custom' ? '🎮 Custom Game' : gameMode === 'narrator' ? '📖 Narrator Mode' : '🐺 Normal Game'}
          </Text>
        </View>
      )}

      {/* First night rule — host picks, everyone sees */}
      <View style={[styles.firstNightBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
        <Text style={[styles.compTitle, { color: t.textSecondary }]}>First Night</Text>
        {isHost ? (
          <View style={styles.firstNightTabs}>
            <TouchableOpacity
              style={[styles.modeTab, !classicFirstNight && { backgroundColor: t.primary }]}
              onPress={() => setClassicFirstNight(false)}
            >
              <Text style={[styles.modeTabText, { color: !classicFirstNight ? '#fff' : t.textMuted }]}>🌙 Quiet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, classicFirstNight && { backgroundColor: t.primary }]}
              onPress={() => setClassicFirstNight(true)}
            >
              <Text style={[styles.modeTabText, { color: classicFirstNight ? '#fff' : t.textMuted }]}>🩸 Classic</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.modeBadgeText, { color: t.text }]}>{classicFirstNight ? '🩸 Classic' : '🌙 Quiet'}</Text>
        )}
        <Text style={[styles.firstNightHint, { color: t.textMuted }]}>
          {classicFirstNight
            ? 'The wolves hunt from night 1. The Seer, Witch and Saviour also wake on night 1.'
            : 'On night 1 the wolves only meet each other. Hunting and the Seer, Witch and Saviour start on night 2.'}
        </Text>
      </View>

      {/* Tied vote rule — host picks, everyone sees */}
      <View style={[styles.firstNightBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
        <Text style={[styles.compTitle, { color: t.textSecondary }]}>Tied Vote</Text>
        {isHost ? (
          <View style={styles.firstNightTabs}>
            <TouchableOpacity
              style={[styles.modeTab, !revoteOnTie && { backgroundColor: t.primary }]}
              onPress={() => setTieRule(TIE_RULE.NO_LYNCH)}
            >
              <Text style={[styles.modeTabText, { color: !revoteOnTie ? '#fff' : t.textMuted }]}>🕊️ No lynch</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, revoteOnTie && { backgroundColor: t.primary }]}
              onPress={() => setTieRule(TIE_RULE.REVOTE)}
            >
              <Text style={[styles.modeTabText, { color: revoteOnTie ? '#fff' : t.textMuted }]}>⚖️ Vote again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.modeBadgeText, { color: t.text }]}>{revoteOnTie ? '⚖️ Vote again' : '🕊️ No lynch'}</Text>
        )}
        <Text style={[styles.firstNightHint, { color: t.textMuted }]}>
          {revoteOnTie
            ? 'On a tie the village votes once more, only between the tied players. A second tie spares everyone.'
            : 'On a tie nobody is lynched and night falls.'}
        </Text>
      </View>

      {/* Normal / Narrator mode — auto composition preview */}
      {(gameMode === 'normal' || gameMode === 'narrator') && effectiveCount >= MIN_PLAYERS && (
        <View style={[styles.compBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.compTitle, { color: t.textSecondary }]}>
            Roles for {effectiveCount} player{effectiveCount !== 1 ? 's' : ''}{gameMode === 'narrator' ? ' (host is narrator)' : ''}
          </Text>
          <Text style={[styles.firstNightHint, { color: t.textMuted }]}>Tap a role to see what it does.</Text>
          <View style={styles.compRow}>
            {Object.entries(normalRoleCounts).map(([role, count]) => renderRolePill(role, count, t.surface))}
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
            <TouchableOpacity style={styles.configLabelRow} onPress={() => setInfoRole(ROLE.WEREWOLF)}>
              {ROLE_ICONS.werewolf ? (
                <Image source={ROLE_ICONS.werewolf} style={styles.configLabelIcon} resizeMode="contain" />
              ) : (
                <Text>🐺 </Text>
              )}
              <Text style={[styles.configLabel, { color: t.text }]}>Werewolves</Text>
              <Text style={[styles.infoHint, { color: t.textMuted }]}>ⓘ</Text>
            </TouchableOpacity>
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
                <TouchableOpacity style={styles.configLabelRow} onPress={() => setInfoRole(role)}>
                  {ROLE_ICONS[role] ? (
                    <Image source={ROLE_ICONS[role]} style={styles.configLabelIcon} resizeMode="contain" />
                  ) : (
                    <Text>{info.emoji} </Text>
                  )}
                  <Text style={[styles.configLabel, { color: t.text }]}>{info.name}</Text>
                  <Text style={[styles.infoHint, { color: t.textMuted }]}>ⓘ</Text>
                </TouchableOpacity>
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
            <TouchableOpacity style={styles.configLabelRow} onPress={() => setInfoRole(ROLE.VILLAGER)}>
              {ROLE_ICONS.villager ? (
                <Image source={ROLE_ICONS.villager} style={styles.configLabelIcon} resizeMode="contain" />
              ) : (
                <Text>🏡 </Text>
              )}
              <Text style={[styles.configLabel, { color: t.textMuted }]}>Villagers (auto-filled)</Text>
              <Text style={[styles.infoHint, { color: t.textMuted }]}>ⓘ</Text>
            </TouchableOpacity>
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
              {Object.entries(customRoleCounts).map(([role, count]) => renderRolePill(role, count, t.surfaceAlt))}
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
          <Text style={[styles.firstNightHint, { color: t.textMuted }]}>Tap a role to see what it does.</Text>
          <View style={styles.compRow}>
            {Object.entries(customRoleCounts).map(([role, count]) => renderRolePill(role, count, t.surface))}
          </View>
        </View>
      )}

      {/* Fill empty seats with bots — host picks, everyone sees (not in narrator mode) */}
      {botsAvailable && (
        <View style={[styles.firstNightBox, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <View style={styles.configRow}>
            <View style={styles.configLabelRow}>
              <Text style={[styles.configLabel, { color: t.text }]}>🤖 Fill empty seats with bots</Text>
            </View>
            {isHost ? (
              <TouchableOpacity
                style={[styles.toggle, { backgroundColor: fillWithBots ? t.success : t.surface, borderColor: fillWithBots ? t.success : t.border }]}
                onPress={() => setFillWithBots(!fillWithBots)}
              >
                <Text style={[styles.toggleText, { color: fillWithBots ? '#fff' : t.textMuted }]}>
                  {fillWithBots ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.modeBadgeText, { color: t.text }]}>{fillWithBots ? 'ON' : 'OFF'}</Text>
            )}
          </View>
          <Text style={[styles.firstNightHint, { color: t.textMuted }]}>{botHint()}</Text>
          {fillWithBots && (
            <>
              <View style={[styles.configRow, styles.botChatRow]}>
                <View style={styles.configLabelRow}>
                  <Text style={[styles.configLabel, { color: t.text }]}>💬 Bots write in the chats</Text>
                </View>
                {isHost ? (
                  <TouchableOpacity
                    style={[styles.toggle, { backgroundColor: botChat ? t.success : t.surface, borderColor: botChat ? t.success : t.border }]}
                    onPress={() => setBotChat(!botChat)}
                  >
                    <Text style={[styles.toggleText, { color: botChat ? '#fff' : t.textMuted }]}>
                      {botChat ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.modeBadgeText, { color: t.text }]}>{botChat ? 'ON' : 'OFF'}</Text>
                )}
              </View>
              <Text style={[styles.firstNightHint, { color: t.textMuted }]}>
                {botChat ? 'Bots comment the night and announce their votes.' : 'Off — bots vote silently.'}
              </Text>
            </>
          )}
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
            {item.isHost && <Text style={[styles.badge, { color: t.accent }]}>{gameMode === 'narrator' ? 'NARRATOR' : 'HOST'}</Text>}
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
            disabled={!canStart || starting}
          >
            <Text style={styles.btnText}>{startBtnLabel()}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.leaveBtn, { borderColor: t.danger }]} onPress={handleLeave}>
          <Text style={[styles.leaveText, { color: t.danger }]}>Leave Room</Text>
        </TouchableOpacity>
      </View>

      <RoleInfoModal visible={!!infoRole} onClose={() => setInfoRole(null)} theme={t} role={infoRole} />

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={[styles.qrOverlay, { backgroundColor: t.modalOverlay }]} onPress={() => setQrOpen(false)}>
          <View style={[styles.qrPanel, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.codeLabel, { color: t.textSecondary }]}>Room {code}</Text>
            <View style={styles.qrWrap}>
              <RoomQrCode value={roomJoinLink(code)} size={260} />
            </View>
            <Text style={[styles.codeHint, { color: t.textMuted }]}>
              Scan with 📷 Scan QR Code on the Home screen
            </Text>
            <TouchableOpacity
              style={[styles.codeActionBtn, styles.qrCloseBtn, { borderColor: t.primary }]}
              onPress={() => setQrOpen(false)}
            >
              <Text style={[styles.codeActionText, { color: t.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  codeHint: { ...FONTS.caption, fontStyle: 'italic', textAlign: 'center' },
  codeActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  codeActionBtn: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  codeActionText: { ...FONTS.button, fontSize: 15 },
  qrOverlay: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  qrPanel: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, alignItems: 'center' },
  qrWrap: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  qrCloseBtn: { marginTop: SPACING.lg, alignSelf: 'stretch' },
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
  firstNightBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  firstNightTabs: { flexDirection: 'row', gap: SPACING.xs },
  firstNightHint: { ...FONTS.caption, marginTop: SPACING.xs },
  configBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  configTitle: { ...FONTS.subheading, marginBottom: SPACING.sm },
  botChatRow: { marginTop: SPACING.md },
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
    gap: 6,
  },
  roleIcon: { width: 28, height: 28 },
  roleEmoji: { fontSize: 22 },
  roleCount: { ...FONTS.body, fontWeight: '700' },
  configLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  configLabelIcon: { width: 28, height: 28 },
  infoHint: { fontSize: 14, marginLeft: 2 },
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
