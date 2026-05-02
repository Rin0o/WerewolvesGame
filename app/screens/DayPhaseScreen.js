import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhaseTransition from '../components/PhaseTransition';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import usePlayer from '../hooks/usePlayer';
import { accusePlayer, submitVote, updateRoom, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { resolveLynch, startNextNight, hunterShoot } from '../game-logic/gameManager';
import { allVotesIn, tallyVotes } from '../game-logic/voteManager';
import Timer from '../components/Timer';
import VotePanel from '../components/VotePanel';
import PlayerCard from '../components/PlayerCard';
import NotesPanel from '../components/NotesPanel';
import NightAnnouncement from '../components/day/NightAnnouncement';
import HunterSection from '../components/day/HunterSection';
import LynchResultCard from '../components/day/LynchResultCard';
import AccusationModal from '../components/day/AccusationModal';
import { DAY, DAY_TIMER_THEME, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { BOT_CONFIG } from '../constants/devConfig';

const DAY_BACKGROUND      = require('../../assets/day_background.png');
const EXIT_GAME_ICON      = require('../../assets/leave.png');
const END_DAY_ICON        = require('../../assets/end_day.png');
const DAY_TIMER           = require('../../assets/day_timer.png');
const NOTES_ICON          = require('../../assets/notes.png');
const PLAYER_ROW_DAY      = require('../../assets/player_row_day.png');
const DAY_SQUARE_CONTAINER = require('../../assets/day_square_container.png');

const DISCUSSION_SECONDS = 240;
const DEFENSE_SECONDS = 30;

export default function DayPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const gs = useGameState(room, playerId);
  const playerHooks = usePlayer(roomId);
  const [notesOpen, setNotesOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [hunterMode, setHunterMode] = useState(false);
  const [hunterTarget, setHunterTarget] = useState(null);
  const [showTransition, setShowTransition] = useState(true);
  const [lastLynchResult, setLastLynchResult] = useState(null);
  const [accuseTarget, setAccuseTarget] = useState(null);
  const botVoteRef = useRef(null);
  const roomRef = useRef(null);
  const resolvingRef = useRef(false);

  const t = DAY;
  const tr = DAY_TIMER_THEME;

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
    if (room.status === 'night') {
      navigation.replace('NightPhase', { roomId, playerId, nickname });
    }
    if (room.status === 'ended') {
      navigation.replace('GameOver', { roomId, playerId, nickname });
    }
    if (room.hunterTriggered === playerId && gs.isAlive === false) {
      setHunterMode(true);
    }
  }, [room?.status, room?.hunterTriggered]);

  useEffect(() => {
    if (!room || !gs.isHost || !room.accusedPlayerId || !BOT_CONFIG.enabled) return;
    if (botVoteRef.current === room.accusedPlayerId) return;
    botVoteRef.current = room.accusedPlayerId;

    const { players = [], votes = {} } = room;
    const aliveBots = players.filter((p) => p.isBot && p.isAlive);
    for (const bot of aliveBots) {
      if (!votes[bot.id]) {
        const vote = Math.random() > 0.5 ? 'lynch' : 'spare';
        submitVote(roomId, bot.id, vote);
      }
    }
  }, [room?.accusedPlayerId]);

  useEffect(() => {
    if (!room || !gs.isHost || resolving) return;
    if (!room.accusedPlayerId) return;
    const { votes = {}, players = [], disconnectedPlayers: disconnected = [] } = room;
    if (allVotesIn(votes, players, disconnected)) {
      setResolving(true);
      resolveLynch(roomId, room, room.accusedPlayerId)
        .catch(() => setResolving(false))
        .then(({ winner }) => {
          if (!winner) setResolving(false);
        });
    }
  }, [room?.votes]);

  const allIn = room
    ? allVotesIn(room.votes || {}, (room.players || []).filter((p) => p.isAlive), room.disconnectedPlayers || [])
    : false;
  useEffect(() => {
    if (!allIn || !room?.accusedPlayerId || !room?.votes) return;
    const votesCopy = { ...room.votes };
    const tally = tallyVotes(votesCopy);
    const accused = room.players?.find((p) => p.id === room.accusedPlayerId);
    setLastLynchResult({
      accusedId: room.accusedPlayerId,
      accusedNickname: accused?.nickname,
      votes: votesCopy,
      lynched: tally.winner === 'lynch',
    });
  }, [allIn]);

  useEffect(() => {
    if (room?.accusedPlayerId) setLastLynchResult(null);
  }, [room?.accusedPlayerId]);

  roomRef.current = room;
  resolvingRef.current = resolving;

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], roles = {}, phase, accusedPlayerId, votes = {}, events = [], eliminatedThisNight, hunterTriggered, disconnectedPlayers: disconnected = [] } = room;
  const accusedPlayer = accusedPlayerId ? players.find((p) => p.id === accusedPlayerId) : null;
  const voteResults = Object.keys(votes).length > 0 ? tallyVotes(votes) : null;
  const votesRevealed = allVotesIn(votes, players.filter((p) => p.isAlive), disconnected);

  const nightVictimIds = Array.isArray(eliminatedThisNight) ? eliminatedThisNight : (eliminatedThisNight ? [eliminatedThisNight] : []);
  const nightVictims = nightVictimIds.map((id) => players.find((p) => p.id === id)).filter(Boolean);

  function handleAccuse(targetId) {
    if (!gs.isAlive) return;
    setAccuseTarget(targetId);
  }

  async function handleVote(vote) {
    if (!gs.isAlive || gs.myVote) return;
    await submitVote(roomId, playerId, vote);
  }

  async function handleNightEnd() {
    if (!gs.isHost) return;
    await startNextNight(roomId, phase);
  }

  async function handleDefenseTimerExpire() {
    if (!gs.isHost || resolvingRef.current || !roomRef.current?.accusedPlayerId) return;
    const currentRoom = roomRef.current;
    const votesCopy = { ...(currentRoom.votes || {}) };
    const tally = tallyVotes(votesCopy);
    const accused = currentRoom.players?.find((p) => p.id === currentRoom.accusedPlayerId);
    setLastLynchResult({
      accusedId: currentRoom.accusedPlayerId,
      accusedNickname: accused?.nickname,
      votes: votesCopy,
      lynched: tally.winner === 'lynch',
    });
    setResolving(true);
    resolveLynch(roomId, currentRoom, currentRoom.accusedPlayerId)
      .catch(() => setResolving(false))
      .then(({ winner }) => { if (!winner) setResolving(false); });
  }

  async function handleHunterShoot() {
    if (!hunterTarget) return;
    await hunterShoot(roomId, room, hunterTarget);
    setHunterMode(false);
  }

  return (
    <ImageBackground source={DAY_BACKGROUND} style={styles.safe} resizeMode="cover" imageStyle={styles.backgroundImg}>
    <SafeAreaView style={styles.safe}>
      {showTransition && (
        <PhaseTransition phase="day" onComplete={() => setShowTransition(false)} />
      )}

      <View style={[styles.header, { borderBottomColor: t.glassBorder, backgroundColor: 'transparent' }]}>
        <View style={styles.headerRow}>
          <ImageBackground source={DAY_SQUARE_CONTAINER} style={styles.phaseContainerBg} resizeMode="contain">
            <Text style={[styles.phase, { color: t.textMuted }]}>Day {phase}</Text>
          </ImageBackground>
          <Text style={[styles.title, { color: t.text, flex: 1, marginLeft: SPACING.sm }]}>The Village Awakens</Text>
        </View>
        <View style={styles.timerBox}>
          <Image source={DAY_TIMER} style={styles.dayTimerImg} resizeMode="contain" />
          {!accusedPlayerId && (
            <View style={styles.timerOverlay}>
              <Timer totalSeconds={DISCUSSION_SECONDS} onExpire={gs.isHost ? handleNightEnd : () => {}} theme={tr} />
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {gs.isLover && gs.myLover && (
          <View style={[styles.loverAnnouncement, { backgroundColor: 'rgba(255,240,248,0.92)', borderColor: '#E85090' }]}>
            <Text style={styles.loverEmoji}>💘</Text>
            <Text style={[styles.loverTitle, { color: '#E85090' }]}>You are in love!</Text>
            <Text style={[styles.announcementText, { color: t.text }]}>
              Your lover is {gs.myLover.nickname}. If they die, you die too.
              {'\n'}If you are the last two alive, you win together.
            </Text>
          </View>
        )}

        <NightAnnouncement theme={t} nightVictims={nightVictims} roles={roles} />

        {hunterTriggered && (
          <HunterSection
            theme={t}
            players={players}
            playerId={playerId}
            hunterTriggered={hunterTriggered}
            hunterTarget={hunterTarget}
            onSelectTarget={setHunterTarget}
            onSubmit={handleHunterShoot}
          />
        )}

        {accusedPlayerId && (
          <View style={[styles.voteSection, { backgroundColor: t.glassCard, borderColor: t.border }]}>
            <Text style={[styles.voteSectionTitle, { color: t.text }]}>
              ⚖️ {accusedPlayer?.nickname} is on trial!
            </Text>
            {!votesRevealed && (
              <>
                <Text style={[styles.defenseLabel, { color: t.textSecondary }]}>Defense time:</Text>
                <Timer totalSeconds={DEFENSE_SECONDS} onExpire={gs.isHost ? handleDefenseTimerExpire : () => {}} theme={t} />
              </>
            )}
            {!gs.isSpectator && !votesRevealed && (
              <VotePanel
                theme={t}
                onVote={handleVote}
                myVote={gs.myVote}
                accusedNickname={accusedPlayer?.nickname}
                disabled={!gs.isAlive}
              />
            )}
            {votesRevealed && voteResults && (
              <VotePanel
                theme={t}
                revealed
                voteCounts={voteResults}
                accusedNickname={accusedPlayer?.nickname}
              />
            )}
            {resolving && <ActivityIndicator color={t.primary} style={{ marginTop: SPACING.sm }} />}
          </View>
        )}

        {lastLynchResult && !accusedPlayerId && !hunterTriggered && (
          <LynchResultCard theme={t} result={lastLynchResult} players={players} roles={roles} />
        )}

        {!accusedPlayerId && (
          <View style={[styles.playerSection, { backgroundColor: t.glassSection }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
              {gs.isAlive ? 'Tap a player to accuse them' : 'Players (spectating)'}
            </Text>
            <FlatList
              data={players}
              keyExtractor={(p) => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <ImageBackground source={PLAYER_ROW_DAY} style={styles.playerRowBg} imageStyle={styles.playerRowImg} resizeMode="stretch">
                  <PlayerCard
                    player={item}
                    theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                    onPress={() => item.isAlive && item.id !== playerId && gs.isAlive && handleAccuse(item.id)}
                    disabled={!gs.isAlive || item.id === playerId || !item.isAlive}
                    roleMap={!item.isAlive ? roles : {}}
                    showRole={!item.isAlive}
                  />
                </ImageBackground>
              )}
            />
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: t.glassBorder, backgroundColor: t.glassToolbar }]}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtnBottom}>
          <Image source={EXIT_GAME_ICON} style={styles.exitGameImg} resizeMode="contain" />
        </TouchableOpacity>
        {gs.isHost && !accusedPlayerId && !hunterTriggered && (
          <TouchableOpacity style={{ flex: 1 }} onPress={handleNightEnd}>
            <Image source={END_DAY_ICON} style={styles.endDayImg} resizeMode="contain" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.notesBtn} onPress={() => setNotesOpen(true)}>
          <Image source={NOTES_ICON} style={styles.notesIcon} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players}
        events={events}
        playerHooks={playerHooks}
      />

      <AccusationModal
        visible={!!accuseTarget}
        target={players.find((p) => p.id === accuseTarget) || null}
        theme={t}
        suspicion={playerHooks.suspicions[accuseTarget]}
        suspectedRole={playerHooks.suspectedRoles[accuseTarget]}
        onConfirm={() => { accusePlayer(roomId, accuseTarget); setAccuseTarget(null); }}
        onCancel={() => setAccuseTarget(null)}
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
    padding: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: SPACING.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  timerBox: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dayTimerImg: { width: '110%', height: 220 },
  timerOverlay: {
    position: 'absolute',
    top: '77%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 1,
  },
  phaseContainerBg: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phase: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  title: { ...FONTS.heading },
  scroll: { flex: 1 },
  loverAnnouncement: {
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  loverEmoji: { fontSize: 32 },
  loverTitle: { ...FONTS.subheading, fontWeight: '700' },
  announcementText: { ...FONTS.body, textAlign: 'center' },
  voteSection: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  voteSectionTitle: { ...FONTS.subheading, textAlign: 'center', marginBottom: SPACING.sm },
  defenseLabel: { ...FONTS.caption, textAlign: 'center', marginBottom: SPACING.xs },
  playerSection: { padding: SPACING.md, borderRadius: RADIUS.lg, margin: SPACING.md },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden' },
  playerRowImg: { borderRadius: RADIUS.md },
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  exitBtnBottom: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  exitGameImg: { width: '100%', height: 70 },
  endDayImg: { width: '100%', height: 70 },
  notesBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notesIcon: { width: '100%', height: 70 },
});
