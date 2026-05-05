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
import { submitNightAction, updateRoom, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { resolveNight } from '../game-logic/gameManager';
import Timer from '../components/Timer';
import WerewolfChat from '../components/WerewolfChat';
import PhaseTransition from '../components/PhaseTransition';
import WerewolfAction from '../components/night-actions/WerewolfAction';
import SeerAction from '../components/night-actions/SeerAction';
import WitchAction from '../components/night-actions/WitchAction';
import CupidAction from '../components/night-actions/CupidAction';
import ThiefAction from '../components/night-actions/ThiefAction';
import SaviourAction from '../components/night-actions/SaviourAction';
import { NIGHT, FONTS, RADIUS, SPACING, NIGHT_TIMER_THEME } from '../constants/theme';
import { ROLE } from '../constants/roles';
import { BOT_CONFIG } from '../constants/devConfig';

const ACTION_TIMER = 60;

const NIGHT_BACKGROUND     = require('../../assets/night_background.png');
const NIGHT_TIMER          = require('../../assets/night_timer.png');

export default function NightPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
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
  const [resolving, setResolving] = useState(false);
  const [showTransition, setShowTransition] = useState(true);
  const botNightRef = useRef(null);
  const pendingDay = useRef(false);
  const roomRef = useRef(null);
  const resolvingRef = useRef(false);

  const t = NIGHT;
  const tr = NIGHT_TIMER_THEME;

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
      'You will be eliminated at the end of this phase if you leave. Are you sure?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await disconnectPlayer(roomId, playerId);
            navigation.navigate('Home');
          },
        },
      ]
    );
  }

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

  useEffect(() => {
    if (!room || !gs.isHost || room.status !== 'night' || !BOT_CONFIG.enabled) return;
    if (botNightRef.current === room.phase) return;
    botNightRef.current = room.phase;

    const { players = [], roles = {}, nightActions = {} } = room;
    if (room.phase === 1) return;
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

  useEffect(() => {
    if (!room || !gs.isHost || resolving) return;
    const { nightActions = {}, players = [], roles = {}, disconnectedPlayers: disconnected = [] } = room;
    const activeWolves = players.filter((p) => p.isAlive && roles[p.id] === ROLE.WEREWOLF && !disconnected.includes(p.id));
    const activeSeer = players.find((p) => p.isAlive && roles[p.id] === ROLE.SEER && !disconnected.includes(p.id));
    const activeWitch = players.find((p) => p.isAlive && roles[p.id] === ROLE.WITCH && !disconnected.includes(p.id));
    const activeCupid = players.find((p) => p.isAlive && roles[p.id] === ROLE.CUPID && !disconnected.includes(p.id));
    const activeThief = players.find((p) => p.isAlive && roles[p.id] === ROLE.THIEF && !disconnected.includes(p.id));
    const activeSaviour = players.find((p) => p.isAlive && roles[p.id] === ROLE.SAVIOUR && !disconnected.includes(p.id));

    const wolfDone = room.phase === 1 || !!nightActions.werewolf || activeWolves.length === 0;
    const seerDone = !!nightActions.seer || !activeSeer;
    const witchDone = room.phase === 1 || nightActions.witchSave !== undefined || nightActions.witchPoison || nightActions.witchSkip || !activeWitch;
    const cupidDone = !!nightActions.cupid || !activeCupid || room.phase > 1;
    const thiefDone = !!nightActions.thief || !activeThief || room.phase > 1 || gs.availableThiefRoles?.length === 0;
    const saviourDone = !!nightActions.saviour || !activeSaviour;

    if (wolfDone && seerDone && witchDone && cupidDone && thiefDone && saviourDone) {
      setResolving(true);
      resolveNight(roomId, room).catch(() => setResolving(false));
    }
  }, [room?.nightActions]);

  useEffect(() => {
    if (!gs.isHost || !room || room.status !== 'night') return;
    const startedAt = room.phaseStartedAt ? new Date(room.phaseStartedAt).getTime() : Date.now();
    const deadline = startedAt + (ACTION_TIMER + 5) * 1000;
    const delay = Math.max(0, deadline - Date.now());
    let cancelled = false;
    const id = setTimeout(async () => {
      if (cancelled || resolvingRef.current) return;
      const currentRoom = roomRef.current;
      if (!currentRoom || currentRoom.status !== 'night') return;
      setResolving(true);
      resolveNight(roomId, currentRoom).catch(() => setResolving(false));
    }, delay);
    return () => { cancelled = true; clearTimeout(id); };
  }, [room?.phase, room?.status]);

  roomRef.current = room;
  resolvingRef.current = resolving;

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  const { players = [], roles = {}, nightActions = {}, phase, witchPotions = {}, saviourLastProtected = null } = room;
  const alivePlayers = players.filter((p) => p.isAlive && p.id !== playerId);
  const myWitchPotions = witchPotions[playerId] || { save: false, poison: false };
  const victimId = nightActions.werewolf;
  const victimPlayer = victimId ? players.find((p) => p.id === victimId) : null;

  async function submitWolfKill() {
    if (!wolfTarget) return;
    await submitNightAction(roomId, 'werewolf', wolfTarget);
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

  async function handleTimerExpire() {
    if (myActionDone) return;
    if (gs.myRole === ROLE.WEREWOLF && !nightActions.werewolf && room.phase > 1) {
      await submitNightAction(roomId, 'werewolf', alivePlayers[0]?.id || null);
    } else if (gs.myRole === ROLE.SEER && !nightActions.seer) {
      await submitNightAction(roomId, 'seer', alivePlayers[0]?.id || null);
    } else if (gs.myRole === ROLE.WITCH && room.phase > 1) {
      await submitWitchSkip();
    } else if (gs.myRole === ROLE.CUPID && room.phase === 1) {
      const targets = alivePlayers.slice(0, 2).map((p) => p.id);
      await submitNightAction(roomId, 'cupid', targets);
    } else if (gs.myRole === ROLE.THIEF && room.phase === 1 && gs.availableThiefRoles?.length > 0) {
      await submitNightAction(roomId, 'thief', gs.availableThiefRoles[0]);
    } else if (gs.myRole === ROLE.SAVIOUR && !nightActions.saviour) {
      const validTargets = players.filter((p) => p.isAlive && p.id !== saviourLastProtected);
      if (validTargets.length > 0) {
        await submitNightAction(roomId, 'saviour', validTargets[0].id);
      }
    }
    setMyActionDone(true);
  }

  const isSpectator = !gs.isAlive;
  const alreadyActed =
    (gs.myRole === ROLE.WEREWOLF && !!nightActions.werewolf) ||
    (gs.myRole === ROLE.SEER && !!nightActions.seer) ||
    (gs.myRole === ROLE.WITCH && (room?.phase === 1 || nightActions.witchSave !== undefined || nightActions.witchPoison || nightActions.witchSkip)) ||
    (gs.myRole === ROLE.CUPID && (!!nightActions.cupid || room?.phase > 1)) ||
    (gs.myRole === ROLE.THIEF && (!!nightActions.thief || room?.phase > 1 || gs.availableThiefRoles?.length === 0)) ||
    (gs.myRole === ROLE.SAVIOUR && !!nightActions.saviour);

  const showWaiting = !thiefStolenRole && !seerResult && (isSpectator || alreadyActed || myActionDone ||
    (gs.myRole === ROLE.VILLAGER || gs.myRole === ROLE.HUNTER));

  return (
    <ImageBackground source={NIGHT_BACKGROUND} style={styles.safe} resizeMode="cover" imageStyle={styles.backgroundImg}>
    <SafeAreaView style={styles.safe}>
      {showTransition && (
        <PhaseTransition phase="night" onComplete={() => setShowTransition(false)} />
      )}

      <ImageBackground source={NIGHT_TIMER} style={[styles.header, { borderBottomColor: t.border }]} resizeMode="stretch">
        <View style={styles.phaseCounter}>
          <Text style={[styles.phaseLabel, { color: t.textSecondary }]}>Night</Text>
          <Text style={[styles.phaseNumber, { color: t.textSecondary }]}>{phase}</Text>
        </View>
        {!showWaiting && (
          <View style={styles.timerSlot}>
            <Timer totalSeconds={ACTION_TIMER} onExpire={handleTimerExpire} theme={tr} />
          </View>
        )}
        <View style={styles.headerTitleSlot}>
          <Text style={[styles.title, { color: t.text }]}>The Village goes to sleep</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.scroll}>
        {showWaiting && (
          <View style={[styles.waitContainer, { backgroundColor: t.glassWait }]}>
            <Text style={styles.moonBig}>🌕</Text>
            <Text style={[styles.waitTitle, { color: t.text }]}>Night is falling...</Text>
            <Text style={[styles.waitSub, { color: t.textMuted }]}>
              {isSpectator
                ? 'You watch from the shadows as a ghost.'
                : myActionDone || alreadyActed
                ? 'Your action has been submitted. Waiting for others...'
                : 'You have no night action. Wait for dawn.'}
            </Text>
            {resolving && <ActivityIndicator color={t.accent} style={{ marginTop: SPACING.lg }} />}
          </View>
        )}

        {!showWaiting && gs.myRole === ROLE.WEREWOLF && (
          <WerewolfAction
            theme={t}
            players={alivePlayers.filter((p) => roles[p.id] !== ROLE.WEREWOLF)}
            phase={phase}
            wolfTarget={wolfTarget}
            onSelectTarget={setWolfTarget}
            onSubmit={submitWolfKill}
            onOpenChat={() => setChatVisible(true)}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {(seerResult || (!showWaiting && gs.myRole === ROLE.SEER && !seerResult)) && (
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

        {!showWaiting && gs.myRole === ROLE.WITCH && (
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

        {!showWaiting && gs.myRole === ROLE.CUPID && room?.phase === 1 && (
          <CupidAction
            theme={t}
            players={players.filter((p) => p.isAlive)}
            cupidTargets={cupidTargets}
            onToggleTarget={toggleCupidTarget}
            onSubmit={submitCupidChoice}
          />
        )}

        {(!showWaiting && gs.myRole === ROLE.THIEF && room?.phase === 1) || thiefStolenRole ? (
          <ThiefAction
            theme={t}
            availableRoles={gs.availableThiefRoles || []}
            thiefChoice={thiefChoice}
            thiefStolenRole={thiefStolenRole}
            onSelectRole={setThiefChoice}
            onSubmit={submitThiefChoice}
            onDismissReveal={() => { setMyActionDone(true); setThiefStolenRole(null); }}
          />
        ) : null}

        {!showWaiting && gs.myRole === ROLE.SAVIOUR && (
          <SaviourAction
            theme={t}
            players={players.filter((p) => p.isAlive && p.id !== saviourLastProtected)}
            saviourTarget={saviourTarget}
            onSelectTarget={setSaviourTarget}
            onSubmit={submitSaviourProtect}
          />
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <WerewolfChat
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        roomId={roomId}
        playerId={playerId}
        nickname={nickname}
        isAlive={gs.isAlive}
      />
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  backgroundImg: { transform: [{ scale: 1 }] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 200,
    borderBottomWidth: 1,
  },
  phaseCounter: {
    position: 'absolute',
    top: '2%',
    left: '7%',
    width: '17%',
    height: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSlot: {
    position: 'absolute',
    top: '0',
    right: '3%',
    width: '25%',
    height: '35%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleSlot: {
    position: 'absolute',
    left: '17%',
    right: '17%',
    bottom: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
