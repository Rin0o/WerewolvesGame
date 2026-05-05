import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
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
import { confirmDayVote, closeVoting, updateRoom, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { resolveLynch, startNextNight, hunterShoot } from '../game-logic/gameManager';
import { allVotesIn, tallyVotes } from '../game-logic/voteManager';
import Timer from '../components/Timer';
import PlayerCard from '../components/PlayerCard';
import NotesPanel from '../components/NotesPanel';
import DayChat from '../components/day/DayChat';
import NightAnnouncement from '../components/day/NightAnnouncement';
import HunterSection from '../components/day/HunterSection';
import LynchResultModal from '../components/day/LynchResultModal';
import { DAY, DAY_TIMER_THEME, FONTS, RADIUS, SPACING } from '../constants/theme';
import { BOT_CONFIG } from '../constants/devConfig';

const DAY_BACKGROUND       = require('../../assets/day_background.png');
const EXIT_GAME_ICON       = require('../../assets/leave.png');
const DAY_TIMER            = require('../../assets/day_timer.png');
const NOTES_ICON           = require('../../assets/notes.png');
const DAY_CHAT_ICON        = require('../../assets/day_chat.png');
const PLAYER_ROW_DAY       = require('../../assets/player_row_day.png');
const PLAYER_ROW_DEAD      = require('../../assets/player_row_dead.png');
const DAY_SQUARE_CONTAINER = require('../../assets/day_square_container.png');
const AVATAR_UNKNOWN       = require('../../assets/role_icons/unknown.png');
const AVATAR_DEAD          = require('../../assets/suspicion_level_icons/dead.png');

const DISCUSSION_SECONDS = 240;

export default function DayPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const gs = useGameState(room, playerId);
  const playerHooks = usePlayer(roomId);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [hunterMode, setHunterMode] = useState(false);
  const [hunterTarget, setHunterTarget] = useState(null);
  const [showTransition, setShowTransition] = useState(true);
  const [lastLynchResult, setLastLynchResult] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [myVoteTarget, setMyVoteTarget] = useState(null);
  const botVotedRef = useRef(false);
  const shownResultRef = useRef(false);
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
    if (!room || !gs.isHost || room.status !== 'day' || !BOT_CONFIG.enabled || botVotedRef.current) return;
    botVotedRef.current = true;
    const { players = [] } = room;
    const aliveBots = players.filter((p) => p.isBot && p.isAlive);
    for (const bot of aliveBots) {
      const targets = players.filter((p) => p.isAlive && p.id !== bot.id);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        confirmDayVote(roomId, bot.id, target.id);
      }
    }
  }, [room?.status]);

  const alivePlayers = room?.players?.filter((p) => p.isAlive) || [];
  const disconnected = room?.disconnectedPlayers || [];
  const allIn = room
    ? allVotesIn(room.votes || {}, alivePlayers, disconnected)
    : false;

  useEffect(() => {
    if (!room || shownResultRef.current) return;
    const { votesClosed, votes = {} } = room;
    if (!votesClosed && !allIn) return;
    shownResultRef.current = true;
    const votesCopy = { ...votes };
    const { tallyMap, eliminatedId, tie } = tallyVotes(votesCopy);
    setLastLynchResult({ tallyMap, eliminatedId, tie, votes: votesCopy });
    setResultModalVisible(true);
  }, [room?.votesClosed, allIn]);

  useEffect(() => {
    if (room?.hunterTriggered) setResultModalVisible(false);
  }, [room?.hunterTriggered]);

  roomRef.current = room;
  resolvingRef.current = resolving;

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], roles = {}, phase, events = [], eliminatedThisNight, hunterTriggered } = room;
  const votes = room.votes || {};

  const myVoteEntry = votes[playerId];
  const myVoteConfirmed = myVoteEntry?.confirmed === true;

  const nightVictimIds = Array.isArray(eliminatedThisNight) ? eliminatedThisNight : (eliminatedThisNight ? [eliminatedThisNight] : []);
  const nightVictims = nightVictimIds.map((id) => players.find((p) => p.id === id)).filter(Boolean);

  function handleSelectVote(targetId) {
    if (myVoteConfirmed) return;
    setMyVoteTarget((prev) => (prev === targetId ? null : targetId));
  }

  async function handleConfirmVote() {
    if (!myVoteTarget || myVoteConfirmed) return;
    await confirmDayVote(roomId, playerId, myVoteTarget);
  }

  async function handleTimerExpire() {
    if (!gs.isHost || resolvingRef.current) return;
    await closeVoting(roomId);
  }

  async function handleResultExpire() {
    if (!gs.isHost || resolvingRef.current) return;
    setResultModalVisible(false);
    setResolving(true);
    resolveLynch(roomId, roomRef.current)
      .catch(() => setResolving(false))
      .then(({ winner }) => { if (!winner) setResolving(false); });
  }

  async function handleHunterShoot() {
    if (!hunterTarget) return;
    await hunterShoot(roomId, room, hunterTarget);
    setHunterMode(false);
  }

  const selectedTarget = myVoteConfirmed
    ? players.find((p) => p.id === myVoteEntry?.target)
    : players.find((p) => p.id === myVoteTarget);

  const confirmedCount = Object.values(votes).filter((v) => v?.confirmed).length;
  const totalEligible = alivePlayers.filter((p) => !disconnected.includes(p.id)).length;

  return (
    <ImageBackground source={DAY_BACKGROUND} style={styles.safe} resizeMode="cover" imageStyle={styles.backgroundImg}>
    <SafeAreaView style={styles.safe}>
      {showTransition && (
        <PhaseTransition phase="day" onComplete={() => setShowTransition(false)} />
      )}

      <View style={[styles.header, { borderBottomColor: t.glassBorder, backgroundColor: 'transparent' }]}>
        <View style={styles.headerRow}>
          <ImageBackground source={DAY_SQUARE_CONTAINER} style={styles.phaseContainerBg} resizeMode="contain">
            <Text style={[styles.phaseLabel, { color: t.textMuted }]}>Day</Text>
            <Text style={[styles.phaseNumber, { color: t.textMuted }]}>{phase}</Text>
          </ImageBackground>
          <Text style={[styles.title, { color: t.text, flex: 1, marginLeft: SPACING.sm }]}>The Village Awakens</Text>
        </View>
        <View style={styles.timerBox}>
          <Image source={DAY_TIMER} style={styles.dayTimerImg} resizeMode="contain" />
          {!lastLynchResult && (
            <View style={styles.timerOverlay}>
              <Timer totalSeconds={DISCUSSION_SECONDS} onExpire={gs.isHost ? handleTimerExpire : () => {}} theme={tr} />
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
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

        {!lastLynchResult && !hunterTriggered && (
          <>
            <View style={[styles.playerSection, { backgroundColor: t.glassSection }]}>
              <View style={styles.voteSectionHeader}>
                <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
                  {gs.isAlive ? 'Tap a player to vote for them' : 'Players (spectating)'}
                </Text>
                <Text style={[styles.voteProgress, { color: t.textMuted }]}>
                  {confirmedCount}/{totalEligible} confirmed
                </Text>
              </View>

              {players.map((item) => {
                const isSelected = !myVoteConfirmed && myVoteTarget === item.id;
                const isMyConfirmedTarget = myVoteConfirmed && myVoteEntry?.target === item.id;
                const theyConfirmed = votes[item.id]?.confirmed === true;
                return (
                  <ImageBackground
                    key={item.id}
                    source={item.isAlive ? PLAYER_ROW_DAY : PLAYER_ROW_DEAD}
                    style={styles.playerRowBg}
                    imageStyle={styles.playerRowImg}
                    resizeMode="stretch"
                  >
                    <View style={styles.playerRowInner}>
                      <View style={styles.playerCardWrap}>
                        <PlayerCard
                          player={item}
                          theme={item.isAlive
                            ? { ...t, surface: 'transparent', border: 'transparent' }
                            : { ...t, surface: 'transparent', border: 'transparent', text: '#F0ECFF', textMuted: '#ffffff', textSecondary: '#C0A8E0', primary: '#7050B8', accent: '#ffffff' }
                          }
                          onPress={() => item.isAlive && item.id !== playerId && gs.isAlive && handleSelectVote(item.id)}
                          disabled={!gs.isAlive || item.id === playerId || !item.isAlive || myVoteConfirmed}
                          selected={isSelected || isMyConfirmedTarget}
                          roleMap={!item.isAlive ? roles : {}}
                          showRole={!item.isAlive}
                          noDeadOpacity={!item.isAlive}
                          avatarIcon={item.isAlive ? AVATAR_UNKNOWN : AVATAR_DEAD}
                          avatarIconSize={56}
                        />
                      </View>
                      {item.isAlive && theyConfirmed && (
                        <View style={[styles.confirmedBadge, { backgroundColor: t.success }]}>
                          <Text style={styles.confirmedText}>✓</Text>
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                );
              })}
            </View>

            {gs.isAlive && (
              <View style={[styles.confirmSection, { backgroundColor: t.glassCard, borderColor: t.glassBorder }]}>
                {myVoteConfirmed ? (
                  <Text style={[styles.voteLocked, { color: t.success }]}>
                    ✓ Vote locked in for {selectedTarget?.nickname || '?'}
                  </Text>
                ) : myVoteTarget ? (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: t.text }]}>
                      Voting for <Text style={{ fontWeight: '700', color: t.danger }}>{selectedTarget?.nickname}</Text>
                    </Text>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: t.danger }]}
                      onPress={handleConfirmVote}
                    >
                      <Text style={styles.confirmBtnText}>Confirm Vote</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.confirmLabel, { color: t.textMuted }]}>
                    Select a player above to vote
                  </Text>
                )}
              </View>
            )}

            {resolving && <ActivityIndicator color={t.primary} style={{ marginVertical: SPACING.md }} />}
          </>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: t.glassBorder, backgroundColor: t.glassToolbar }]}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtnBottom}>
          <Image source={EXIT_GAME_ICON} style={styles.exitGameImg} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.notesBtn} onPress={() => setNotesOpen(true)}>
          <Image source={NOTES_ICON} style={styles.notesIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatBtn} onPress={() => setChatOpen(true)}>
          <Image source={DAY_CHAT_ICON} style={styles.chatBtnImg} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <LynchResultModal
        visible={resultModalVisible}
        onExpire={handleResultExpire}
        theme={t}
        result={lastLynchResult}
        players={players}
        roles={roles}
      />

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players}
        events={events}
        playerHooks={playerHooks}
      />

      <DayChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        theme={t}
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
  phaseLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  phaseNumber: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
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
  playerSection: { padding: SPACING.md, borderRadius: RADIUS.lg, margin: SPACING.md, marginTop: SPACING.sm },
  voteSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  voteProgress: { ...FONTS.caption },
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden' },
  playerRowImg: { borderRadius: RADIUS.md },
  playerRowInner: { flexDirection: 'row', alignItems: 'center' },
  playerCardWrap: { flex: 1 },
  confirmedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  confirmedText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmSection: {
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  confirmLabel: { ...FONTS.body, flex: 1 },
  confirmBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  confirmBtnText: { ...FONTS.button, color: '#fff' },
  voteLocked: { ...FONTS.body, fontWeight: '600', textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  exitBtnBottom: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  exitGameImg: { width: '100%', height: 70 },
  notesBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notesIcon: { width: '100%', height: 70 },
  chatBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatBtnImg: { width: '100%', height: 70 },
});
