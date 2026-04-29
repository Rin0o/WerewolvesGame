import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import { submitNightAction, updateRoom } from '../firebase/roomService';
import { resolveNight } from '../game-logic/gameManager';
import Timer from '../components/Timer';
import WerewolfChat from '../components/WerewolfChat';
import PlayerCard from '../components/PlayerCard';
import PhaseTransition from '../components/PhaseTransition';
import { NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE } from '../constants/roles';
import { getRoleInfo } from '../game-logic/roles';
import { BOT_CONFIG } from '../constants/devConfig';
import RoleCard from '../components/RoleCard';

const ACTION_TIMER = 60;

export default function NightPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const gs = useGameState(room, playerId);
  const [myActionDone, setMyActionDone] = useState(false);
  const [wolfTarget, setWolfTarget] = useState(null);
  const [seerTarget, setSeerTarget] = useState(null);
  const [seerResult, setSeerResult] = useState(null);
  const [witchChoice, setWitchChoice] = useState(null);
  const [witchPoisonTarget, setWitchPoisonTarget] = useState(null);
  const [cupidTargets, setCupidTargets] = useState([]);
  const [thiefChoice, setThiefChoice] = useState(null);
  const [thiefStolenRole, setThiefStolenRole] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showTransition, setShowTransition] = useState(true);
  const botNightRef = useRef(null);
  const pendingDay = useRef(false);

  const t = NIGHT;

  // Navigate when game transitions — defer day navigation if seer is reading their result
  useEffect(() => {
    if (!room) return;
    if (room.status === 'day') {
      if (seerResult) {
        pendingDay.current = true;
      } else {
        navigation.replace('DayPhase', { roomId, playerId, nickname });
      }
    }
    if (room.status === 'ended') {
      navigation.replace('GameOver', { roomId, playerId, nickname });
    }
  }, [room?.status]);

  // Host auto-submits bot night actions at the start of each night
  useEffect(() => {
    if (!room || !gs.isHost || room.status !== 'night' || !BOT_CONFIG.enabled) return;
    if (botNightRef.current === room.phase) return;
    botNightRef.current = room.phase;

    const { players = [], roles = {}, nightActions = {} } = room;
    const aliveBots = players.filter((p) => p.isBot && p.isAlive);
    for (const bot of aliveBots) {
      if (roles[bot.id] === ROLE.WEREWOLF && !nightActions.werewolf) {
        const targets = players.filter((p) => p.isAlive && roles[p.id] !== ROLE.WEREWOLF);
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          submitNightAction(roomId, 'werewolf', target.id);
        }
      }
    }
  }, [room?.phase, room?.status]);

  // Host resolves night when all role actions are in
  useEffect(() => {
    if (!room || !gs.isHost || resolving) return;
    const { nightActions = {}, players = [], roles = {} } = room;
    const aliveWolves = players.filter((p) => p.isAlive && roles[p.id] === ROLE.WEREWOLF);
    const aliveSeer = players.find((p) => p.isAlive && roles[p.id] === ROLE.SEER);
    const aliveWitch = players.find((p) => p.isAlive && roles[p.id] === ROLE.WITCH);
    const aliveCupid = players.find((p) => p.isAlive && roles[p.id] === ROLE.CUPID);
    const aliveThief = players.find((p) => p.isAlive && roles[p.id] === ROLE.THIEF);

    const wolfDone = !!nightActions.werewolf || aliveWolves.length === 0;
    const seerDone = !!nightActions.seer || !aliveSeer;
    const witchDone = nightActions.witchSave !== undefined || nightActions.witchPoison || nightActions.witchSkip || !aliveWitch;
    const cupidDone = !!nightActions.cupid || !aliveCupid || room.phase > 1;
    const thiefDone = !!nightActions.thief || !aliveThief || room.phase > 1 || gs.availableThiefRoles?.length === 0;

    if (wolfDone && seerDone && witchDone && cupidDone && thiefDone) {
      setResolving(true);
      resolveNight(roomId, room).catch(() => setResolving(false));
    }
  }, [room?.nightActions]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  const { players = [], roles = {}, nightActions = {}, phase, witchPotions = {} } = room;
  const alivePlayers = players.filter((p) => p.isAlive && p.id !== playerId);
  const myWitchPotions = witchPotions[playerId] || { save: false, poison: false };
  const victimId = nightActions.werewolf;
  const victimPlayer = victimId ? players.find((p) => p.id === victimId) : null;

  // ── Werewolf Action ──────────────────────────────────────────────────────
  async function submitWolfKill() {
    if (!wolfTarget) return;
    await submitNightAction(roomId, 'werewolf', wolfTarget);
    setMyActionDone(true);
  }

  // ── Seer Action ──────────────────────────────────────────────────────────
  async function submitSeerReveal() {
    if (!seerTarget) return;
    const revealed = roles[seerTarget];
    const isWolf = revealed === ROLE.WEREWOLF;
    setSeerResult(isWolf ? '🐺 They are a Werewolf!' : '✅ They are NOT a Werewolf.');
    await submitNightAction(roomId, 'seer', seerTarget);
    // Don't setMyActionDone yet — wait for player to dismiss the result
  }

  function dismissSeerResult() {
    setSeerResult(null);
    setMyActionDone(true);
    if (pendingDay.current) {
      navigation.replace('DayPhase', { roomId, playerId, nickname });
    }
  }

  // ── Witch Action ──────────────────────────────────────────────────────────
  async function submitWitchSave() {
    await submitNightAction(roomId, 'witchSave', victimId);
    setMyActionDone(true);
  }

  async function submitWitchPoison() {
    if (!witchPoisonTarget) return;
    await submitNightAction(roomId, 'witchPoison', witchPoisonTarget);
    setMyActionDone(true);
  }

  async function submitWitchSkip() {
    await submitNightAction(roomId, 'witchSkip', true);
    setMyActionDone(true);
  }

  async function submitCupidChoice() {
    if (cupidTargets.length !== 2) return;
    await submitNightAction(roomId, 'cupid', cupidTargets);
    setMyActionDone(true);
  }

  async function submitThiefChoice() {
    if (!thiefChoice) return;
    await submitNightAction(roomId, 'thief', thiefChoice);
    setThiefStolenRole(thiefChoice);
  }

  function toggleCupidTarget(id) {
    setCupidTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  }

  async function handleTimerExpire() {
    if (myActionDone) return;
    if (gs.myRole === ROLE.WEREWOLF && !nightActions.werewolf) {
      await submitNightAction(roomId, 'werewolf', alivePlayers[0]?.id || null);
    } else if (gs.myRole === ROLE.SEER && !nightActions.seer) {
      await submitNightAction(roomId, 'seer', alivePlayers[0]?.id || null);
    } else if (gs.myRole === ROLE.WITCH) {
      await submitWitchSkip();
    } else if (gs.myRole === ROLE.CUPID && room.phase === 1) {
      const targets = alivePlayers.slice(0, 2).map((p) => p.id);
      await submitNightAction(roomId, 'cupid', targets);
    } else if (gs.myRole === ROLE.THIEF && room.phase === 1 && gs.availableThiefRoles?.length > 0) {
      await submitNightAction(roomId, 'thief', gs.availableThiefRoles[0]);
    }
    setMyActionDone(true);
  }

  // ── Spectator / waiting view ─────────────────────────────────────────────
  const isSpectator = !gs.isAlive;
  const alreadyActed =
    (gs.myRole === ROLE.WEREWOLF && !!nightActions.werewolf) ||
    (gs.myRole === ROLE.SEER && !!nightActions.seer) ||
    (gs.myRole === ROLE.WITCH && (nightActions.witchSave !== undefined || nightActions.witchPoison || nightActions.witchSkip)) ||
    (gs.myRole === ROLE.CUPID && (!!nightActions.cupid || room?.phase > 1)) ||
    (gs.myRole === ROLE.THIEF && (!!nightActions.thief || room?.phase > 1 || gs.availableThiefRoles?.length === 0));

  const showWaiting = !thiefStolenRole && !seerResult && (isSpectator || alreadyActed || myActionDone ||
    (gs.myRole === ROLE.VILLAGER || gs.myRole === ROLE.HUNTER));

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#050210', '#0D0820', '#1A1035']}
        style={StyleSheet.absoluteFill}
      />
      {showTransition && (
        <PhaseTransition phase="night" onComplete={() => setShowTransition(false)} />
      )}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.phase, { color: t.textMuted }]}>Night {phase}</Text>
        <Text style={[styles.title, { color: t.text }]}>🌙 The Village Sleeps</Text>
        {!showWaiting && <Timer totalSeconds={ACTION_TIMER} onExpire={handleTimerExpire} theme={t} />}
      </View>

      <ScrollView style={styles.scroll}>
        {/* WAITING SCREEN */}
        {showWaiting && (
          <View style={styles.waitContainer}>
            <Text style={styles.moonBig}>🌕</Text>
            <Text style={[styles.waitTitle, { color: t.text }]}>Night is falling...</Text>
            <Text style={[styles.waitSub, { color: t.textMuted }]}>
              {isSpectator
                ? 'You watch from the shadows as a ghost.'
                : myActionDone || alreadyActed
                ? 'Your action has been submitted. Waiting for others...'
                : 'You have no night action. Wait for dawn.'}
            </Text>
            {resolving && (
              <ActivityIndicator color={t.accent} style={{ marginTop: SPACING.lg }} />
            )}
          </View>
        )}

        {/* WEREWOLF ACTION */}
        {!showWaiting && gs.myRole === ROLE.WEREWOLF && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🐺 Choose a Victim</Text>
            <Text style={[styles.actionSub, { color: t.textSecondary }]}>
              Pick a player to eliminate tonight.
            </Text>
            <FlatList
              data={alivePlayers.filter((p) => roles[p.id] !== ROLE.WEREWOLF)}
              keyExtractor={(p) => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  theme={t}
                  selected={wolfTarget === item.id}
                  onPress={() => setWolfTarget(item.id)}
                />
              )}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: wolfTarget ? t.danger : t.border }]}
              onPress={submitWolfKill}
              disabled={!wolfTarget}
            >
              <Text style={styles.submitText}>Confirm Kill</Text>
            </TouchableOpacity>

            {/* Wolf chat */}
            <TouchableOpacity
              style={[styles.chatBtn, { borderColor: t.primary }]}
              onPress={() => setChatVisible(true)}
            >
              <Text style={[styles.chatBtnText, { color: t.accent }]}>🐺 Open Wolf Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SEER RESULT — shown independently so navigation can be deferred */}
        {seerResult && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🔮 Your Vision</Text>
            <Text style={[styles.actionSub, { color: t.textSecondary }]}>
              {players.find((p) => p.id === seerTarget)?.nickname || 'That player'} is...
            </Text>
            <View style={[styles.seerResult, { backgroundColor: t.surfaceAlt, borderColor: t.primary }]}>
              <Text style={[styles.seerResultText, { color: t.text }]}>{seerResult}</Text>
            </View>
            <Text style={[styles.actionSub, { color: t.textMuted, marginTop: SPACING.sm }]}>
              Remember this. Dawn will come soon.
            </Text>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: t.primary, marginTop: SPACING.md }]}
              onPress={dismissSeerResult}
            >
              <Text style={styles.submitText}>Got it — I'm ready</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SEER ACTION */}
        {!showWaiting && gs.myRole === ROLE.SEER && !seerResult && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🔮 Choose Someone to Reveal</Text>
            <Text style={[styles.actionSub, { color: t.textSecondary }]}>
              You will learn if they are a Werewolf.
            </Text>
            <FlatList
              data={alivePlayers}
              keyExtractor={(p) => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  theme={t}
                  selected={seerTarget === item.id}
                  onPress={() => setSeerTarget(item.id)}
                />
              )}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: seerTarget ? t.primary : t.border }]}
              onPress={submitSeerReveal}
              disabled={!seerTarget}
            >
              <Text style={styles.submitText}>Reveal Their Nature</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WITCH ACTION */}
        {!showWaiting && gs.myRole === ROLE.WITCH && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🧙‍♀️ Witch's Turn</Text>
            {victimPlayer ? (
              <Text style={[styles.actionSub, { color: t.textSecondary }]}>
                The werewolves killed: {victimPlayer.nickname}
              </Text>
            ) : (
              <Text style={[styles.actionSub, { color: t.textSecondary }]}>No one was killed tonight.</Text>
            )}

            <View style={styles.witchBtns}>
              {myWitchPotions.save && victimPlayer && (
                <TouchableOpacity
                  style={[styles.witchBtn, { backgroundColor: t.success }]}
                  onPress={submitWitchSave}
                >
                  <Text style={styles.witchBtnText}>🧪 Save {victimPlayer.nickname}</Text>
                </TouchableOpacity>
              )}
              {myWitchPotions.poison && (
                <View>
                  <Text style={[styles.actionSub, { color: t.textSecondary, marginTop: SPACING.md }]}>Poison someone:</Text>
                  <FlatList
                    data={alivePlayers.filter((p) => p.id !== victimId)}
                    keyExtractor={(p) => p.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <PlayerCard
                        player={item}
                        theme={t}
                        selected={witchPoisonTarget === item.id}
                        onPress={() => setWitchPoisonTarget(item.id)}
                      />
                    )}
                  />
                  <TouchableOpacity
                    style={[styles.witchBtn, { backgroundColor: witchPoisonTarget ? t.danger : t.border }]}
                    onPress={submitWitchPoison}
                    disabled={!witchPoisonTarget}
                  >
                    <Text style={styles.witchBtnText}>☠️ Poison</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[styles.witchBtn, { backgroundColor: t.surfaceAlt, borderColor: t.border, borderWidth: 1 }]}
                onPress={submitWitchSkip}
              >
                <Text style={[styles.witchBtnText, { color: t.textMuted }]}>Skip (use no potions)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CUPID ACTION */}
        {!showWaiting && gs.myRole === ROLE.CUPID && room?.phase === 1 && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>💘 Choose Two Lovers</Text>
            <Text style={[styles.actionSub, { color: t.textSecondary }]}>
              Select exactly 2 players to bind together. If one dies, the other follows.
              {cupidTargets.length > 0 ? ` (${cupidTargets.length}/2 selected)` : ''}
            </Text>
            <FlatList
              data={players.filter((p) => p.isAlive)}
              keyExtractor={(p) => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  theme={t}
                  selected={cupidTargets.includes(item.id)}
                  onPress={() => toggleCupidTarget(item.id)}
                />
              )}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: cupidTargets.length === 2 ? t.accent : t.border }]}
              onPress={submitCupidChoice}
              disabled={cupidTargets.length !== 2}
            >
              <Text style={styles.submitText}>💘 Bind Their Hearts</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* THIEF ACTION */}
        {!showWaiting && gs.myRole === ROLE.THIEF && room?.phase === 1 && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🃏 Choose a Role to Steal</Text>
            {gs.availableThiefRoles?.length === 0 ? (
              <Text style={[styles.actionSub, { color: t.textSecondary }]}>
                No roles are available to steal. You remain a Thief and side with the villagers.
              </Text>
            ) : (
              <>
                <Text style={[styles.actionSub, { color: t.textSecondary }]}>
                  These roles are not assigned to any player. Pick one — you will become it immediately.
                </Text>
                {gs.availableThiefRoles.map((role) => {
                  const info = getRoleInfo(role);
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.thiefRoleCard,
                        {
                          backgroundColor: thiefChoice === role ? t.primary : t.surfaceAlt,
                          borderColor: thiefChoice === role ? t.accent : t.border,
                        },
                      ]}
                      onPress={() => setThiefChoice(role)}
                    >
                      <Text style={styles.thiefRoleEmoji}>{info.emoji}</Text>
                      <View style={styles.thiefRoleInfo}>
                        <Text style={[styles.thiefRoleName, { color: t.text }]}>{info.name}</Text>
                        <Text style={[styles.thiefRoleDesc, { color: t.textMuted }]} numberOfLines={2}>
                          {info.ability || info.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: thiefChoice ? t.primary : t.border }]}
                  onPress={submitThiefChoice}
                  disabled={!thiefChoice}
                >
                  <Text style={styles.submitText}>🃏 Steal This Role</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* THIEF STOLEN ROLE REVEAL */}
        {thiefStolenRole && (
          <View style={styles.actionBox}>
            <Text style={[styles.actionTitle, { color: t.accent }]}>🃏 You stole a role!</Text>
            <Text style={[styles.actionSub, { color: t.textSecondary }]}>
              From this moment on, you play as:
            </Text>
            <RoleCard role={thiefStolenRole} />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: t.primary, marginTop: SPACING.sm }]}
              onPress={() => { setMyActionDone(true); setThiefStolenRole(null); }}
            >
              <Text style={styles.submitText}>I understand my new role ✓</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Wolf Chat Modal */}
      <Modal visible={chatVisible} animationType="slide" onRequestClose={() => setChatVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatTitle, { color: t.text }]}>Wolf Pack Chat</Text>
            <TouchableOpacity onPress={() => setChatVisible(false)}>
              <Text style={[styles.closeBtn, { color: t.textMuted }]}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <WerewolfChat
            roomId={roomId}
            currentPlayerId={playerId}
            currentNickname={nickname}
            isNight={room.status === 'night'}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  phase: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  title: { ...FONTS.heading },
  scroll: { flex: 1 },
  waitContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    paddingTop: SPACING.xxl * 2,
  },
  moonBig: { fontSize: 72, marginBottom: SPACING.lg },
  waitTitle: { ...FONTS.heading, textAlign: 'center', marginBottom: SPACING.sm },
  waitSub: { ...FONTS.body, textAlign: 'center', lineHeight: 24 },
  actionBox: { padding: SPACING.md },
  actionTitle: { ...FONTS.heading, marginBottom: SPACING.xs },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  chatBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderWidth: 1.5,
  },
  chatBtnText: { ...FONTS.button },
  seerResult: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  seerResultText: { ...FONTS.heading, textAlign: 'center' },
  witchBtns: { gap: SPACING.sm, marginTop: SPACING.md },
  witchBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  witchBtnText: { ...FONTS.button, color: '#fff' },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  chatTitle: { ...FONTS.heading },
  closeBtn: { ...FONTS.body },
  thiefRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1.5,
    gap: SPACING.sm,
  },
  thiefRoleEmoji: { fontSize: 28 },
  thiefRoleInfo: { flex: 1 },
  thiefRoleName: { ...FONTS.body, fontWeight: '600' },
  thiefRoleDesc: { ...FONTS.caption, lineHeight: 16 },
});
