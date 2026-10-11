import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import usePlayer from '../hooks/usePlayer';
import useHostFailover from '../hooks/useHostFailover';
import { submitNightAction, updateRoom, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { clearSession } from '../utils/session';
import { resolveNight, computeNightSequence, nextNightSubPhase, isSubPhaseDone } from '../game-logic/gameManager';
import { getAvailableRolesForThief } from '../game-logic/roles';
import Timer from '../components/Timer';
import WerewolfChat from '../components/WerewolfChat';
import PhaseTransition from '../components/PhaseTransition';
import WerewolfAction from '../components/night-actions/WerewolfAction';
import NarratorNightDashboard from '../components/narrator/NarratorNightDashboard';
import SeerAction from '../components/night-actions/SeerAction';
import WitchAction from '../components/night-actions/WitchAction';
import CupidAction from '../components/night-actions/CupidAction';
import ThiefAction from '../components/night-actions/ThiefAction';
import SaviourAction from '../components/night-actions/SaviourAction';
import NotesPanel from '../components/NotesPanel';
import { NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE } from '../constants/roles';
import { BOT_CONFIG } from '../constants/devConfig';

const SUBPHASE_TIMER = 45;
const SUBPHASE_TIMER_OVERRIDES = { thief: 15, cupid: 15, seer: 30, saviour: 30 };
const FIRST_NIGHT_WEREWOLF_TIMER = 15;

function subPhaseSeconds(subPhase, phase) {
  if (subPhase === 'werewolf' && phase === 1) return FIRST_NIGHT_WEREWOLF_TIMER;
  return SUBPHASE_TIMER_OVERRIDES[subPhase] ?? SUBPHASE_TIMER;
}

const SUBPHASE_TO_ROLE = {
  werewolf: ROLE.WEREWOLF,
  witch: ROLE.WITCH,
  seer: ROLE.SEER,
  cupid: ROLE.CUPID,
  thief: ROLE.THIEF,
  saviour: ROLE.SAVIOUR,
};

const SUBPHASE_FLAVOR = {
  thief:    { title: 'A Shadow Stirs...', sub: 'A mysterious figure examines the unclaimed roles.' },
  cupid:    { title: 'Cupid Takes Aim...', sub: 'An arrow of fate is about to be loosed upon two souls.' },
  werewolf: { title: 'The Pack Hunts...', sub: 'Wolves prowl the darkness in silence.' },
  witch:    { title: 'The Witch Brews...', sub: 'A potion is being carefully considered.' },
  seer:     { title: 'The Seer Dreams...', sub: 'A mystic peers into the souls of the village.' },
  saviour:  { title: 'A Guardian Watches...', sub: 'Someone is being chosen for protection tonight.' },
  done:     { title: 'The Night Passes...', sub: 'The actions of the night are being resolved.' },
};

const DEATH_MESSAGES = {
  werewolves: 'The werewolves chose you as their victim tonight.',
  poison:     "The witch's poison claimed you in the night.",
  heartbreak: 'Your lover was killed tonight, and you died of a broken heart.',
  abandoned:  'You left the village and were lost in the night.',
};

const NIGHT_BACKGROUND = require('../../assets/night_background.webp');
const NOTES_ICON       = require('../../assets/notes.webp');
const LEAVE_ICON       = require('../../assets/exit_game.webp');
const NIGHT_CHAT_ICON  = require('../../assets/night_chat.webp');

export default function NightPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  useHostFailover(roomId, playerId, room);
  const gs = useGameState(room, playerId);
  const playerHooks = usePlayer(roomId);
  const [myActionDone, setMyActionDone] = useState(false);
  const [wolfTarget, setWolfTarget] = useState(null);
  const [seerTarget, setSeerTarget] = useState(null);
  const [seerResult, setSeerResult] = useState(null);
  const [witchChoice, setWitchChoice] = useState(null);
  const [witchPoisonTarget, setWitchPoisonTarget] = useState(null);
  const [cupidTargets, setCupidTargets] = useState([]);
  const [thiefChoice, setThiefChoice] = useState(null);
  const [thiefStolenRole, setThiefStolenRole] = useState(null);
  const [saviourTarget, setSaviourTarget] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showTransition, setShowTransition] = useState(true);
  const [eliminatedOverlay, setEliminatedOverlay] = useState(false);
  const pendingDay = useRef(false);
  const roomRef = useRef(null);
  const resolvingRef = useRef(false);
  const subPhaseTimerExpiredRef = useRef(false);

  const t = NIGHT;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      reconnectPlayer(roomId, playerId);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    navigation.setOptions({ gestureEnabled: false });
    return () => handler.remove();
  }, [navigation]);

  function handleExit() {
    Alert.alert(
      'Leave Game',
      'You will be eliminated at the end of this night if you leave. Are you sure?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await disconnectPlayer(roomId, playerId);
            await clearSession();
            navigation.popTo('Home');
          },
        },
      ]
    );
  }

  useEffect(() => {
    if (!room) return;
    if (room.status === 'day') {
      const wasEliminated = Array.isArray(room.eliminatedThisNight) && room.eliminatedThisNight.includes(playerId);
      if (wasEliminated) {
        setEliminatedOverlay(true);
        return;
      }
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

  useEffect(() => {
    if (!gs.isHost || !room || room.status !== 'night') return;
    if (room.gameMode === 'narrator') return;
    const { nightSubPhase } = room;
    if (!nightSubPhase) {
      const seq = computeNightSequence(room);
      updateRoom(roomId, { nightSubPhase: seq[0] || 'done' });
      return;
    }
    if (nightSubPhase === 'done' || resolvingRef.current) return;
    const activePlayerLeft = !computeNightSequence(room).includes(nightSubPhase);
    if (!isSubPhaseDone(nightSubPhase, room) && !activePlayerLeft) return;
    const next = nextNightSubPhase(room, nightSubPhase);
    if (next === 'done') {
      setResolving(true);
      resolveNight(roomId, roomRef.current).catch(() => setResolving(false));
    } else {
      updateRoom(roomId, { nightSubPhase: next });
    }
  }, [room?.nightActions, room?.nightSubPhase, room?.status, room?.disconnectedPlayers, gs.isHost]);

  useEffect(() => {
    subPhaseTimerExpiredRef.current = false;
  }, [room?.nightSubPhase]);

  useEffect(() => {
    if (gs.isHost && subPhaseTimerExpiredRef.current) handleTimerExpire();
  }, [gs.isHost]);

  useEffect(() => {
    if (!gs.isHost || !room || !BOT_CONFIG.enabled || room.status !== 'night') return;
    const { nightSubPhase, players = [], roles = {}, nightActions = {}, phase } = room;
    if (!nightSubPhase || nightSubPhase === 'done') return;
    if (isSubPhaseDone(nightSubPhase, room)) return;
    const aliveBots = players.filter((p) => p.isBot && p.isAlive);
    if (nightSubPhase === 'werewolf' && phase === 1 && !nightActions.werewolfObserved) {
      if (aliveBots.some((b) => roles[b.id] === ROLE.WEREWOLF)) {
        submitNightAction(roomId, 'werewolfObserved', true);
      }
    } else if (nightSubPhase === 'werewolf' && phase > 1 && !nightActions.werewolf) {
      const botWolves = aliveBots.filter((b) => roles[b.id] === ROLE.WEREWOLF);
      if (botWolves.length > 0) {
        const targets = players.filter((p) => p.isAlive && roles[p.id] !== ROLE.WEREWOLF && !p.isNarrator);
        if (targets.length > 0) {
          submitNightAction(roomId, 'werewolf', targets[Math.floor(Math.random() * targets.length)].id);
        }
      }
    }
  }, [room?.nightSubPhase, gs.isHost]);

  roomRef.current = room;
  resolvingRef.current = resolving;

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  const { players = [], roles = {}, nightActions = {}, phase, events = [], witchPotions = {}, saviourLastProtected = null } = room;
  const alivePlayers = players.filter((p) => p.isAlive && p.id !== playerId && !p.isNarrator);
  const myWitchPotions = witchPotions[playerId] || { save: false, poison: false };
  const victimId = nightActions.werewolf;
  const victimPlayer = victimId ? players.find((p) => p.id === victimId) : null;

  async function submitWolfAction() {
    const currentRoom = roomRef.current;
    if (currentRoom?.phase === 1) {
      await submitNightAction(roomId, 'werewolfObserved', true);
    } else {
      if (!wolfTarget) return;
      await submitNightAction(roomId, 'werewolf', wolfTarget);
    }
    setMyActionDone(true);
  }

  async function submitSeerReveal() {
    if (!seerTarget) return;
    const revealed = roles[seerTarget];
    const isWolf = revealed === ROLE.WEREWOLF;
    setSeerResult(isWolf ? '🐺 They are a Werewolf!' : '✅ They are NOT a Werewolf.');
    await submitNightAction(roomId, 'seer', seerTarget);
  }

  function dismissSeerResult() {
    setSeerResult(null);
    setMyActionDone(true);
    if (pendingDay.current) {
      navigation.replace('DayPhase', { roomId, playerId, nickname });
    }
  }

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

  async function submitSaviourProtect() {
    if (!saviourTarget) return;
    await submitNightAction(roomId, 'saviour', saviourTarget);
    setMyActionDone(true);
  }

  function toggleCupidTarget(id) {
    setCupidTargets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  }

  function handleSubPhaseTimerExpire() {
    subPhaseTimerExpiredRef.current = true;
    handleTimerExpire();
  }

  async function handleTimerExpire() {
    if (!gs.isHost) return;
    const currentRoom = roomRef.current;
    if (!currentRoom || currentRoom.status !== 'night') return;
    const subPhase = currentRoom.nightSubPhase;
    if (!subPhase || subPhase === 'done') return;
    if (isSubPhaseDone(subPhase, currentRoom)) return;

    const { players: rPlayers = [], roles: rRoles = {}, saviourLastProtected: svlp = null } = currentRoom;
    switch (subPhase) {
      case 'werewolf': {
        if (currentRoom.phase === 1) {
          await submitNightAction(roomId, 'werewolfObserved', true);
        } else {
          const tgts = rPlayers.filter((p) => p.isAlive && rRoles[p.id] !== ROLE.WEREWOLF && !p.isNarrator);
          if (tgts.length > 0) await submitNightAction(roomId, 'werewolf', tgts[0].id);
        }
        break;
      }
      case 'seer': {
        const tgts = rPlayers.filter((p) => p.isAlive);
        if (tgts.length > 0) await submitNightAction(roomId, 'seer', tgts[0].id);
        break;
      }
      case 'witch':
        await submitNightAction(roomId, 'witchSkip', true);
        break;
      case 'cupid': {
        const tgts = rPlayers.filter((p) => p.isAlive).slice(0, 2).map((p) => p.id);
        if (tgts.length === 2) await submitNightAction(roomId, 'cupid', tgts);
        break;
      }
      case 'thief': {
        const avail = getAvailableRolesForThief(rRoles);
        if (avail.length > 0) await submitNightAction(roomId, 'thief', avail[0]);
        break;
      }
      case 'saviour': {
        const tgts = rPlayers.filter((p) => p.isAlive && p.id !== svlp);
        if (tgts.length > 0) await submitNightAction(roomId, 'saviour', tgts[0].id);
        break;
      }
      default: break;
    }
  }

  async function doNarratorAdvance() {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const next = nextNightSubPhase(currentRoom, currentRoom.nightSubPhase);
    if (next === 'done') {
      setResolving(true);
      resolveNight(roomId, currentRoom).catch(() => setResolving(false));
    } else {
      updateRoom(roomId, { nightSubPhase: next });
    }
  }

  function handleNarratorAdvance() {
    const done = isSubPhaseDone(nightSubPhase, room);
    if (!done) {
      Alert.alert(
        'Skip active role?',
        `The active player hasn't acted yet. Advance anyway?`,
        [
          { text: 'Wait', style: 'cancel' },
          { text: 'Advance', style: 'destructive', onPress: doNarratorAdvance },
        ]
      );
    } else {
      doNarratorAdvance();
    }
  }

  const nightSubPhase = room?.nightSubPhase;
  const activeRole = SUBPHASE_TO_ROLE[nightSubPhase];
  const actionAlreadyInFirestore = nightSubPhase ? isSubPhaseDone(nightSubPhase, room) : false;
  const isMyTurn = gs.isAlive && !gs.isNarrator && gs.myRole === activeRole;
  const showSeerResult = !!seerResult;
  const showThiefReveal = !!thiefStolenRole;
  const showAction = isMyTurn && !myActionDone && !actionAlreadyInFirestore && !showSeerResult && !showThiefReveal;
  const showWaiting = !gs.isNarrator && !showAction && !showSeerResult && !showThiefReveal;

  return (
    <ImageBackground source={NIGHT_BACKGROUND} style={styles.safe} resizeMode="cover" imageStyle={styles.backgroundImg}>
    <SafeAreaView style={styles.safe}>
      {showTransition && (
        <PhaseTransition phase="night" onComplete={() => setShowTransition(false)} />
      )}

      <View style={[styles.header, { backgroundColor: 'rgba(13,8,32,0.82)', borderBottomColor: t.border }]}>
        <View style={[styles.phaseBadge, { backgroundColor: 'rgba(123,79,212,0.20)', borderColor: 'rgba(123,79,212,0.5)' }]}>
          <Text style={[styles.phaseLabel, { color: t.textSecondary }]}>NIGHT</Text>
          <Text style={[styles.phaseNumber, { color: t.accent }]}>{phase}</Text>
        </View>
        <Text style={[styles.title, { color: t.text, flex: 1, textAlign: 'center' }]}>The Village goes to sleep</Text>
        <View style={styles.timerSlot}>
          {nightSubPhase && nightSubPhase !== 'done' && !resolving && room.gameMode !== 'narrator' && (
            <Timer key={nightSubPhase} totalSeconds={subPhaseSeconds(nightSubPhase, phase)} onExpire={handleSubPhaseTimerExpire} theme={t} />
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {gs.isNarrator && (
          <NarratorNightDashboard
            theme={t}
            players={players}
            roles={roles}
            nightActions={nightActions}
            phase={phase}
            nightSubPhase={nightSubPhase}
            actionDone={actionAlreadyInFirestore}
            onAdvance={handleNarratorAdvance}
          />
        )}

        {showWaiting && (
          <View style={[styles.waitContainer, { backgroundColor: t.glassWait }]}>
            <Text style={styles.moonBig}>🌕</Text>
            {resolving || nightSubPhase === 'done' ? (
              <>
                <Text style={[styles.waitTitle, { color: t.text }]}>{SUBPHASE_FLAVOR.done.title}</Text>
                <Text style={[styles.waitSub, { color: t.textMuted }]}>{SUBPHASE_FLAVOR.done.sub}</Text>
                <ActivityIndicator color={t.accent} style={{ marginTop: SPACING.lg }} />
              </>
            ) : !gs.isAlive ? (
              <>
                <Text style={[styles.waitTitle, { color: t.text }]}>Night is falling...</Text>
                <Text style={[styles.waitSub, { color: t.textMuted }]}>You watch from the shadows as a ghost.</Text>
              </>
            ) : nightSubPhase && SUBPHASE_FLAVOR[nightSubPhase] ? (
              <>
                <Text style={[styles.waitTitle, { color: t.text }]}>{SUBPHASE_FLAVOR[nightSubPhase].title}</Text>
                <Text style={[styles.waitSub, { color: t.textMuted }]}>{SUBPHASE_FLAVOR[nightSubPhase].sub}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.waitTitle, { color: t.text }]}>Night is falling...</Text>
                <Text style={[styles.waitSub, { color: t.textMuted }]}>Wait for dawn.</Text>
              </>
            )}
          </View>
        )}

        {showAction && gs.myRole === ROLE.WEREWOLF && (
          <WerewolfAction
            theme={t}
            players={alivePlayers.filter((p) => roles[p.id] !== ROLE.WEREWOLF)}
            phase={phase}
            wolfTarget={wolfTarget}
            onSelectTarget={setWolfTarget}
            onSubmit={submitWolfAction}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {(showSeerResult || (showAction && gs.myRole === ROLE.SEER)) && (
          <SeerAction
            theme={t}
            players={alivePlayers}
            seerTarget={seerTarget}
            onSelectTarget={setSeerTarget}
            onSubmit={submitSeerReveal}
            seerResult={seerResult}
            onDismissResult={dismissSeerResult}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {showAction && gs.myRole === ROLE.WITCH && (
          <WitchAction
            theme={t}
            players={alivePlayers}
            victimPlayer={victimPlayer}
            victimId={victimId}
            witchPotions={myWitchPotions}
            witchChoice={witchChoice}
            witchPoisonTarget={witchPoisonTarget}
            onSelectChoice={setWitchChoice}
            onSelectPoisonTarget={setWitchPoisonTarget}
            onSave={submitWitchSave}
            onPoison={submitWitchPoison}
            onSkip={submitWitchSkip}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {showAction && gs.myRole === ROLE.CUPID && (
          <CupidAction
            theme={t}
            players={players.filter((p) => p.isAlive)}
            cupidTargets={cupidTargets}
            onToggleTarget={toggleCupidTarget}
            onSubmit={submitCupidChoice}
          />
        )}

        {(showThiefReveal || (showAction && gs.myRole === ROLE.THIEF)) && (
          <ThiefAction
            theme={t}
            availableRoles={gs.availableThiefRoles || []}
            thiefChoice={thiefChoice}
            thiefStolenRole={thiefStolenRole}
            onSelectRole={setThiefChoice}
            onSubmit={submitThiefChoice}
            onDismissReveal={() => { setMyActionDone(true); setThiefStolenRole(null); }}
          />
        )}

        {showAction && gs.myRole === ROLE.SAVIOUR && (
          <SaviourAction
            theme={t}
            players={players.filter((p) => p.isAlive)}
            lastProtected={saviourLastProtected}
            saviourTarget={saviourTarget}
            onSelectTarget={setSaviourTarget}
            onSubmit={submitSaviourProtect}
          />
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: t.border, backgroundColor: t.glassToolbar }]}>
        <TouchableOpacity style={styles.barBtn} onPress={handleExit}>
          <Image source={LEAVE_ICON} style={styles.barBtnImg} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={() => setNotesOpen(true)}>
          <Image source={NOTES_ICON} style={styles.barBtnImg} resizeMode="contain" />
        </TouchableOpacity>
        {(gs.myRole === ROLE.WEREWOLF || gs.isNarrator) && (
          <TouchableOpacity style={styles.barBtn} onPress={() => setChatVisible(true)}>
            <Image source={NIGHT_CHAT_ICON} style={styles.barBtnImg} resizeMode="contain" />
          </TouchableOpacity>
        )}
      </View>

      <WerewolfChat
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        roomId={roomId}
        playerId={playerId}
        nickname={nickname}
        isAlive={gs.isAlive && !gs.isNarrator}
        isNarrator={gs.isNarrator}
      />

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players.filter((p) => !p.isNarrator)}
        events={events}
        playerHooks={playerHooks}
      />

      {eliminatedOverlay && (
        <View style={styles.eliminatedOverlay}>
          <View style={styles.eliminatedCard}>
            <Text style={styles.eliminatedSkull}>💀</Text>
            <Text style={styles.eliminatedTitle}>You were eliminated</Text>
            <Text style={styles.eliminatedSub}>
              {DEATH_MESSAGES[room.nightDeathCauses?.[playerId]] || 'You did not survive the night.'} You will join the village as a ghost.
            </Text>
            <TouchableOpacity
              style={styles.eliminatedBtn}
              onPress={() => navigation.replace('DayPhase', { roomId, playerId, nickname })}
            >
              <Text style={styles.eliminatedBtnText}>Continue to Day</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  backgroundImg: { transform: [{ scale: 1 }] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  phaseBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    minWidth: 60,
  },
  timerSlot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  barBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barBtnImg: { width: '100%', height: 70 },
  title: { ...FONTS.heading, textAlign: 'center' },
  phaseLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  phaseNumber: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
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
  eliminatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,2,18,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  eliminatedCard: {
    backgroundColor: 'rgba(30,12,50,0.98)',
    borderWidth: 2,
    borderColor: '#E85090',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginHorizontal: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  eliminatedSkull: { fontSize: 80 },
  eliminatedTitle: {
    ...FONTS.title,
    color: '#E85090',
    textAlign: 'center',
  },
  eliminatedSub: {
    ...FONTS.body,
    color: '#C0A8E8',
    textAlign: 'center',
    lineHeight: 24,
  },
  eliminatedBtn: {
    marginTop: SPACING.sm,
    backgroundColor: '#E85090',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  eliminatedBtnText: {
    ...FONTS.button,
    color: '#fff',
  },
});
