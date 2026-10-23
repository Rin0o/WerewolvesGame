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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import usePlayer from '../hooks/usePlayer';
import useHostFailover from '../hooks/useHostFailover';
import { submitNightAction, updateRoom, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { clearSession } from '../utils/session';
import {
  resolveNight,
  computeNightSequence,
  nextNightSubPhase,
  isSubPhaseDone,
  advanceNightUpdate,
  isQuietFirstNight,
  livingWolves,
  wolfPrey,
  wolfVoteOutcome,
  wolfOutcomeUpdate,
  leadingWolfTarget,
  WOLF_OUTCOME,
  playersStillReading,
  ROLE_REVEAL_STEP,
} from '../game-logic/gameManager';
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
import WolfHoundAction from '../components/night-actions/WolfHoundAction';
import WhiteWolfAction from '../components/night-actions/WhiteWolfAction';
import NotesPanel from '../components/NotesPanel';
import SeatingTable, { SeatingTableButton } from '../components/SeatingTable';
import MyRoleButton from '../components/MyRoleButton';
import BarButton from '../components/BarButton';
import GameOptionsModal from '../components/GameOptionsModal';
import ConfirmChoiceButton from '../components/ConfirmChoiceButton';
import { ROLE_ICONS } from '../constants/icons';
import useUnreadMessages from '../hooks/useUnreadMessages';
import { NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE, isWolfRole } from '../constants/roles';

const SUBPHASE_TIMER = 45;
const SUBPHASE_TIMER_OVERRIDES = { thief: 30, cupid: 30, wolf_hound: 15, seer: 25, saviour: 25, white_wolf: 25 };
const OBSERVE_ONLY_WEREWOLF_TIMER = 15;
const WOLF_REVOTE_SECONDS = 30;
const FORCE_START_AFTER_MS = 60000;
const WAIT_TITLE_COLOR = '#FFF1CC';
const WAIT_SUB_COLOR = '#EDE3FF';
const BOT_WOLF_MIN_DELAY_MS = 4000;
const BOT_WOLF_MAX_DELAY_MS = 10000;

function botDelay() {
  return BOT_WOLF_MIN_DELAY_MS + Math.random() * (BOT_WOLF_MAX_DELAY_MS - BOT_WOLF_MIN_DELAY_MS);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function subPhaseSeconds(subPhase, room) {
  if (subPhase === 'werewolf' && isQuietFirstNight(room)) return OBSERVE_ONLY_WEREWOLF_TIMER;
  if (subPhase === 'werewolf' && room.nightActions?.wolfRevoteTargets) return WOLF_REVOTE_SECONDS;
  return SUBPHASE_TIMER_OVERRIDES[subPhase] ?? SUBPHASE_TIMER;
}

const SUBPHASE_TO_ROLE = {
  werewolf: ROLE.WEREWOLF,
  witch: ROLE.WITCH,
  seer: ROLE.SEER,
  cupid: ROLE.CUPID,
  thief: ROLE.THIEF,
  saviour: ROLE.SAVIOUR,
  wolf_hound: ROLE.WOLF_HOUND,
  white_wolf: ROLE.WHITE_WOLF,
};

const SUBPHASE_FLAVOR = {
  reveal:   { title: 'The Village Gathers...', sub: 'The night begins once everyone has read their role.' },
  thief:   { title: 'A Shadow Stirs...', sub: 'A mysterious figure examines the unclaimed roles.' },
  cupid:    { title: 'Cupid Takes Aim...', sub: 'An arrow of fate is about to be loosed upon two souls.' },
  wolf_hound: { title: 'A Hound Howls...', sub: 'A restless creature decides where its loyalty lies.' },
  werewolf: { title: 'The Pack Hunts...', sub: 'Wolves prowl the darkness in silence.' },
  white_wolf: { title: 'A Pale Shape Moves...', sub: 'Something stalks the pack while it sleeps.' },
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
  white_wolf: 'The White Wolf turned on the pack and devoured you.',
};

const NIGHT_BACKGROUND = require('../../assets/night_background.webp');
const NOTES_ICON       = require('../../assets/notes.webp');
const NIGHT_CHAT_ICON  = require('../../assets/night_chat.webp');
const DEAD_ICON        = require('../../assets/suspicion_level_icons/dead.webp');
const OPTIONS_ICON     = require('../../assets/options.webp');
const MOON_IMAGE       = require('../../assets/moon_borderless.webp');

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
  const [houndChoice, setHoundChoice] = useState(null);
  const [whiteWolfTarget, setWhiteWolfTarget] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showTransition, setShowTransition] = useState(true);
  const [eliminatedOverlay, setEliminatedOverlay] = useState(false);
  const [canForceStart, setCanForceStart] = useState(false);
  const canUseWolfChat = isWolfRole(gs.myRole) || !!gs.isNarrator;
  const unreadWolfMessages = useUnreadMessages(roomId, 'werewolf', playerId, {
    isOpen: chatVisible,
    enabled: canUseWolfChat,
  });
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
    const { nightSubPhase } = room;
    const revealing = nightSubPhase === ROLE_REVEAL_STEP;
    if (room.gameMode === 'narrator' && !revealing) return;
    if (!nightSubPhase) {
      const seq = computeNightSequence(room);
      updateRoom(roomId, { nightSubPhase: seq[0] || 'done' });
      return;
    }
    if (nightSubPhase === 'done' || resolvingRef.current) return;
    const activePlayerLeft = !revealing && !computeNightSequence(room).includes(nightSubPhase);
    if (!isSubPhaseDone(nightSubPhase, room) && !activePlayerLeft) return;
    advanceFrom(room);
  }, [room?.nightActions, room?.nightSubPhase, room?.status, room?.disconnectedPlayers, room?.roleAcknowledged, gs.isHost]);

  useEffect(() => {
    setCanForceStart(false);
    if (room?.nightSubPhase !== ROLE_REVEAL_STEP) return;
    const timer = setTimeout(() => setCanForceStart(true), FORCE_START_AFTER_MS);
    return () => clearTimeout(timer);
  }, [room?.nightSubPhase]);

  useEffect(() => {
    if (!room || room.status !== 'night' || room.nightSubPhase !== ROLE_REVEAL_STEP) return;
    if (gs.isNarrator || !gs.isAlive) return;
    if (!(room.roleAcknowledged || []).includes(playerId)) {
      navigation.replace('RoleReveal', { roomId, playerId, nickname });
    }
  }, [room?.nightSubPhase, gs.isNarrator]);

  function advanceFrom(current) {
    const next = nextNightSubPhase(current, current.nightSubPhase);
    if (next === 'done') {
      setResolving(true);
      resolveNight(roomId, roomRef.current).catch(() => setResolving(false));
    } else {
      updateRoom(roomId, advanceNightUpdate(current, next));
    }
  }

  useEffect(() => {
    subPhaseTimerExpiredRef.current = false;
    setMyActionDone(false);
  }, [room?.nightSubPhase]);

  useEffect(() => {
    if (gs.isHost && subPhaseTimerExpiredRef.current) handleTimerExpire();
  }, [gs.isHost]);

  useEffect(() => {
    if (!gs.isHost || !room || room.status !== 'night' || room.nightSubPhase !== 'werewolf') return;
    if (isQuietFirstNight(room) || isSubPhaseDone('werewolf', room)) return;
    const update = wolfOutcomeUpdate(wolfVoteOutcome(room));
    if (update) updateRoom(roomId, update);
  }, [room?.nightActions, room?.nightSubPhase, room?.status, room?.disconnectedPlayers, gs.isHost]);

  useEffect(() => {
    subPhaseTimerExpiredRef.current = false;
    setWolfTarget(null);
  }, [room?.nightActions?.wolfRevoteTargets]);

  useEffect(() => {
    if (!gs.isHost || !room || room.status !== 'night' || room.nightSubPhase !== 'werewolf') return;
    if (isSubPhaseDone('werewolf', room)) return;
    const wolves = livingWolves(room);
    const botWolves = wolves.filter((w) => w.isBot);
    if (botWolves.length === 0) return;
    const quiet = isQuietFirstNight(room);
    if (quiet && botWolves.length < wolves.length) return;

    const timers = (quiet ? botWolves.slice(0, 1) : botWolves).map((bot) => setTimeout(() => {
      const current = roomRef.current;
      if (!current || current.status !== 'night' || current.nightSubPhase !== 'werewolf') return;
      if (isSubPhaseDone('werewolf', current)) return;
      if (quiet) {
        submitNightAction(roomId, 'werewolfObserved', true);
        return;
      }
      const votes = current.nightActions?.wolfVotes || {};
      if (votes[bot.id]) return;
      const allowed = current.nightActions?.wolfRevoteTargets || wolfPrey(current).map((p) => p.id);
      const target = leadingWolfTarget(current) || (allowed.length > 0 ? randomItem(allowed) : null);
      if (target) submitNightAction(roomId, `wolfVotes.${bot.id}`, target);
    }, botDelay()));
    return () => timers.forEach(clearTimeout);
  }, [room?.nightSubPhase, room?.phase, room?.nightActions?.wolfRevoteTargets, gs.isHost]);

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
    if (currentRoom && isQuietFirstNight(currentRoom)) {
      await submitNightAction(roomId, 'werewolfObserved', true);
      setMyActionDone(true);
    } else if (wolfTarget) {
      await submitNightAction(roomId, `wolfVotes.${playerId}`, wolfTarget);
    }
  }

  async function submitSeerReveal() {
    if (!seerTarget) return;
    setSeerResult({
      name: players.find((p) => p.id === seerTarget)?.nickname || '?',
      isWolf: isWolfRole(roles[seerTarget]),
    });
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

  async function submitHoundChoice() {
    if (!houndChoice) return;
    await submitNightAction(roomId, 'wolfHound', houndChoice);
    setMyActionDone(true);
  }

  async function submitWhiteWolfKill() {
    if (!whiteWolfTarget) return;
    await submitNightAction(roomId, 'whiteWolf', whiteWolfTarget);
    setMyActionDone(true);
  }

  async function submitWhiteWolfSkip() {
    await submitNightAction(roomId, 'whiteWolfSkip', true);
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
        if (isQuietFirstNight(currentRoom)) {
          await submitNightAction(roomId, 'werewolfObserved', true);
        } else {
          const update = wolfOutcomeUpdate(wolfVoteOutcome(currentRoom, { force: true }));
          if (update) await updateRoom(roomId, update);
        }
        break;
      }
      case 'wolf_hound':
        await submitNightAction(roomId, 'wolfHound', ROLE.VILLAGER);
        break;
      case 'white_wolf':
        await submitNightAction(roomId, 'whiteWolfSkip', true);
        break;
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
    let currentRoom = roomRef.current;
    if (!currentRoom) return;
    const { nightSubPhase: step, nightActions: actions = {} } = currentRoom;
    if (step === 'werewolf' && !isQuietFirstNight(currentRoom) && !isSubPhaseDone('werewolf', currentRoom)) {
      const outcome = wolfVoteOutcome(currentRoom, { force: true });
      const update = wolfOutcomeUpdate(outcome);
      if (update) await updateRoom(roomId, update);
      if (outcome.type === WOLF_OUTCOME.REVOTE) return;
      if (outcome.type === WOLF_OUTCOME.KILL) currentRoom = { ...currentRoom, nightActions: { ...actions, werewolf: outcome.target } };
      if (outcome.type === WOLF_OUTCOME.NO_KILL) currentRoom = { ...currentRoom, nightActions: { ...actions, wolfNoKill: true } };
    }
    const next = nextNightSubPhase(currentRoom, currentRoom.nightSubPhase);
    if (next === 'done') {
      setResolving(true);
      resolveNight(roomId, currentRoom).catch(() => setResolving(false));
    } else {
      updateRoom(roomId, advanceNightUpdate(currentRoom, next));
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
  const isMyTurn = gs.isAlive && !gs.isNarrator
    && (gs.myRole === activeRole || (nightSubPhase === 'werewolf' && isWolfRole(gs.myRole)));
  const showSeerResult = !!seerResult;
  const showThiefReveal = !!thiefStolenRole;
  const showAction = isMyTurn && !myActionDone && !actionAlreadyInFirestore && !showSeerResult && !showThiefReveal;
  const showWaiting = !gs.isNarrator && !showAction && !showSeerResult && !showThiefReveal;
  const myWolfVote = nightActions.wolfVotes?.[playerId];
  const canConfirmWolfVote = showAction && nightSubPhase === 'werewolf' && !isQuietFirstNight(room)
    && !!wolfTarget && wolfTarget !== myWolfVote;
  const stillReading = playersStillReading(room);
  const readyCount = (room.roleAcknowledged || []).length;

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
        <MyRoleButton theme={t} gs={gs} room={room} />
        <Text
          style={[styles.title, { color: t.text, flex: 1, textAlign: 'center' }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          The Village goes to sleep
        </Text>
        <View style={styles.timerSlot}>
          {nightSubPhase && nightSubPhase !== 'done' && nightSubPhase !== ROLE_REVEAL_STEP && !resolving && room.gameMode !== 'narrator' && (
            <Timer key={`${nightSubPhase}:${nightActions.wolfRevoteTargets ? 'revote' : 'vote'}`} totalSeconds={subPhaseSeconds(nightSubPhase, room)} onExpire={handleSubPhaseTimerExpire} theme={t} />
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
          <View style={styles.waitScene}>
            <View style={styles.moonGlow}>
              <Image source={MOON_IMAGE} style={styles.moonBig} resizeMode="contain" />
            </View>
            <View style={styles.waitVeil}>
            {nightSubPhase === ROLE_REVEAL_STEP ? (
              <>
                <Text style={styles.waitTitle}>{SUBPHASE_FLAVOR.reveal.title}</Text>
                <Text style={styles.waitSub}>{SUBPHASE_FLAVOR.reveal.sub}</Text>
                <Text style={[styles.revealCount, { color: t.accent }]}>
                  {readyCount} of {readyCount + stillReading.length} ready
                </Text>
                {stillReading.length > 0 && (
                  <Text style={styles.waitSub}>
                    Still reading: {stillReading.map((p) => p.nickname).join(', ')}
                  </Text>
                )}
                {gs.isHost && canForceStart && (
                  <TouchableOpacity
                    style={[styles.forceStartBtn, { borderColor: t.accent }]}
                    onPress={() => advanceFrom(room)}
                  >
                    <Text style={[styles.forceStartText, { color: t.accent }]}>Start anyway</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : resolving || nightSubPhase === 'done' ? (
              <>
                <Text style={styles.waitTitle}>{SUBPHASE_FLAVOR.done.title}</Text>
                <Text style={styles.waitSub}>{SUBPHASE_FLAVOR.done.sub}</Text>
                <ActivityIndicator color={t.accent} style={{ marginTop: SPACING.lg }} />
              </>
            ) : !gs.isAlive ? (
              <>
                <Text style={styles.waitTitle}>Night is falling...</Text>
                <Text style={styles.waitSub}>You watch from the shadows as a ghost.</Text>
              </>
            ) : nightSubPhase && SUBPHASE_FLAVOR[nightSubPhase] ? (
              <>
                <Text style={styles.waitTitle}>{SUBPHASE_FLAVOR[nightSubPhase].title}</Text>
                <Text style={styles.waitSub}>{SUBPHASE_FLAVOR[nightSubPhase].sub}</Text>
              </>
            ) : (
              <>
                <Text style={styles.waitTitle}>Night is falling...</Text>
                <Text style={styles.waitSub}>Wait for dawn.</Text>
              </>
            )}
            </View>
          </View>
        )}

        {showAction && nightSubPhase === 'wolf_hound' && (
          <WolfHoundAction
            theme={t}
            choice={houndChoice}
            onSelect={setHoundChoice}
            onSubmit={submitHoundChoice}
          />
        )}

        {showAction && nightSubPhase === 'werewolf' && (
          <WerewolfAction
            theme={t}
            players={alivePlayers.filter((p) => !isWolfRole(roles[p.id])
              && (!nightActions.wolfRevoteTargets || nightActions.wolfRevoteTargets.includes(p.id)))}
            revoteTargets={nightActions.wolfRevoteTargets || null}
            observeOnly={isQuietFirstNight(room)}
            pack={livingWolves(room)}
            packVotes={nightActions.wolfVotes || {}}
            playerId={playerId}
            wolfTarget={wolfTarget}
            onSelectTarget={setWolfTarget}
            onSubmit={submitWolfAction}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {showAction && nightSubPhase === 'white_wolf' && (
          <WhiteWolfAction
            theme={t}
            players={alivePlayers.filter((p) => roles[p.id] === ROLE.WEREWOLF)}
            target={whiteWolfTarget}
            onSelectTarget={setWhiteWolfTarget}
            onSubmit={submitWhiteWolfKill}
            onSkip={submitWhiteWolfSkip}
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

      {canConfirmWolfVote && (
        <ConfirmChoiceButton
          theme={t}
          icon={ROLE_ICONS.werewolf}
          label={myWolfVote ? 'Change your vote' : 'Confirm your vote'}
          targetName={players.find((p) => p.id === wolfTarget)?.nickname}
          onPress={submitWolfAction}
        />
      )}

      <View style={[styles.bottomBar, { borderTopColor: t.border, backgroundColor: t.glassToolbar }]}>
        <BarButton source={NOTES_ICON} onPress={() => setNotesOpen(true)} accessibilityLabel="Notes" />
        <SeatingTableButton onPress={() => setTableOpen(true)} />
        {canUseWolfChat && (
          <BarButton
            source={NIGHT_CHAT_ICON}
            onPress={() => setChatVisible(true)}
            unread={unreadWolfMessages}
            accessibilityLabel="Wolf chat"
          />
        )}
        <BarButton source={OPTIONS_ICON} onPress={() => setOptionsOpen(true)} accessibilityLabel="Options" />
      </View>

      <GameOptionsModal
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        theme={t}
        room={room}
        onLeave={handleExit}
      />

      <WerewolfChat
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        roomId={roomId}
        playerId={playerId}
        nickname={nickname}
        isAlive={gs.isAlive && !gs.isNarrator}
        isNarrator={gs.isNarrator}
      />

      <SeatingTable
        visible={tableOpen}
        onClose={() => setTableOpen(false)}
        theme={t}
        players={players}
        playerId={playerId}
      />

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players.filter((p) => !p.isNarrator)}
        events={events}
        playerHooks={playerHooks}
      />

      <Modal
        visible={eliminatedOverlay}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => navigation.replace('DayPhase', { roomId, playerId, nickname })}
      >
        <View style={styles.eliminatedOverlay}>
          <Image source={DEAD_ICON} style={styles.eliminatedIcon} resizeMode="contain" />
          <Text style={styles.eliminatedTitle}>You were eliminated</Text>
          <Text style={styles.eliminatedCause}>
            {DEATH_MESSAGES[room.nightDeathCauses?.[playerId]] || 'You did not survive the night.'}
          </Text>
          <Text style={styles.eliminatedSub}>
            You will watch the rest of the game as a ghost. Keep your secrets — the dead do not speak.
          </Text>
          <TouchableOpacity
            style={styles.eliminatedBtn}
            onPress={() => navigation.replace('DayPhase', { roomId, playerId, nickname })}
          >
            <Text style={styles.eliminatedBtnText}>Continue as a ghost</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  title: { ...FONTS.heading, textAlign: 'center' },
  phaseLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  phaseNumber: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  waitScene: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    gap: SPACING.xs,
  },
  moonGlow: {
    width: 132,
    height: 132,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: 'rgba(192,132,245,0.10)',
    shadowColor: '#C084F5',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  moonBig: { width: 124, height: 124 },
  revealCount: { ...FONTS.subheading, marginTop: SPACING.md },
  forceStartBtn: {
    marginTop: SPACING.lg,
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  forceStartText: { ...FONTS.button },
  waitVeil: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(8,4,24,0.6)',
  },
  waitTitle: {
    ...FONTS.heading,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    color: WAIT_TITLE_COLOR,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  waitSub: {
    ...FONTS.body,
    textAlign: 'center',
    lineHeight: 24,
    color: WAIT_SUB_COLOR,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eliminatedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,2,12,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  eliminatedIcon: { width: 168, height: 168, marginBottom: SPACING.md },
  eliminatedTitle: {
    ...FONTS.title,
    color: '#F2E6FF',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(192,132,245,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  eliminatedCause: {
    ...FONTS.subheading,
    color: '#E8A0C8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  eliminatedSub: {
    ...FONTS.body,
    color: '#A898C8',
    textAlign: 'center',
    lineHeight: 22,
  },
  eliminatedBtn: {
    marginTop: SPACING.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(242,230,255,0.5)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 4,
  },
  eliminatedBtnText: {
    ...FONTS.button,
    color: '#F2E6FF',
  },
});
