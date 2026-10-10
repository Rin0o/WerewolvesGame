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
import WerewolfChat from '../components/WerewolfChat';
import NarratorDayDashboard from '../components/narrator/NarratorDayDashboard';
import NightAnnouncement from '../components/day/NightAnnouncement';
import HunterSection from '../components/day/HunterSection';
import LynchResultModal from '../components/day/LynchResultModal';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { SUSPICION_LABELS, ROLE_ICONS } from '../constants/icons';
import { ROLE_DEFINITIONS, ROLE } from '../constants/roles';
import { BOT_CONFIG } from '../constants/devConfig';

const DAY_BACKGROUND       = require('../../assets/day_background.png');
const EXIT_GAME_ICON       = require('../../assets/leave.png');
const NOTES_ICON           = require('../../assets/notes.png');
const DAY_CHAT_ICON        = require('../../assets/day_chat.png');
const DAY_CONFIRM_ICON     = require('../../assets/day_confirm.png');
const DAY_CHECK_ICON       = require('../../assets/day_check.png');
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
  const [wolfChatOpen, setWolfChatOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [hunterTarget, setHunterTarget] = useState(null);
  const [showTransition, setShowTransition] = useState(true);
  const [lastLynchResult, setLastLynchResult] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [myVoteTarget, setMyVoteTarget] = useState(null);
  const botVotedRef = useRef(false);
  const shownResultRef = useRef(false);
  const roomRef = useRef(null);
  const resolvingRef = useRef(false);
  const hunterTargetRef = useRef(null);

  const t = DAY;

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
  }, [room?.status]);

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

  const alivePlayers = room?.players?.filter((p) => p.isAlive && !p.isNarrator) || [];
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

  const hadHunterRef = useRef(false);
  const startedNextNightRef = useRef(false);

  useEffect(() => {
    if (room?.hunterTriggered) {
      hadHunterRef.current = true;
      startedNextNightRef.current = false;
      setResultModalVisible(false);
    } else if (hadHunterRef.current && !startedNextNightRef.current && room?.status === 'day' && !room?.winner && gs.isHost) {
      hadHunterRef.current = false;
      startedNextNightRef.current = true;
      startNextNight(roomId, roomRef.current);
    }
  }, [room?.hunterTriggered]);

  roomRef.current = room;
  resolvingRef.current = resolving;
  hunterTargetRef.current = hunterTarget;

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
    setResultModalVisible(false);
    setLastLynchResult(null);
    setMyVoteTarget(null);
    shownResultRef.current = false;
    if (!gs.isHost || resolvingRef.current) return;
    setResolving(true);
    resolveLynch(roomId, roomRef.current)
      .catch(() => setResolving(false))
      .then(({ winner }) => { if (!winner) setResolving(false); });
  }

  async function handleHunterShoot() {
    if (!hunterTarget) return;
    const currentRoom = roomRef.current;
    const { winner } = await hunterShoot(roomId, currentRoom, hunterTarget);
    setLastLynchResult(null);
    setMyVoteTarget(null);
    shownResultRef.current = false;
    if (!winner && gs.isHost && !startedNextNightRef.current) {
      startedNextNightRef.current = true;
      hadHunterRef.current = false;
      startNextNight(roomId, currentRoom);
    }
  }

  async function handleHunterTimerExpire() {
    const currentRoom = roomRef.current;
    if (!currentRoom?.hunterTriggered || currentRoom.hunterTriggered !== playerId) return;
    let target = hunterTargetRef.current;
    if (!target) {
      const eligible = (currentRoom.players || []).filter((p) => p.isAlive && p.id !== currentRoom.hunterTriggered);
      if (eligible.length === 0) return;
      target = eligible[Math.floor(Math.random() * eligible.length)].id;
      setHunterTarget(target);
    }
    const { winner } = await hunterShoot(roomId, currentRoom, target);
    setLastLynchResult(null);
    setMyVoteTarget(null);
    shownResultRef.current = false;
    if (!winner && gs.isHost && !startedNextNightRef.current) {
      startedNextNightRef.current = true;
      hadHunterRef.current = false;
      startNextNight(roomId, currentRoom);
    }
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

      <View style={[styles.header, { backgroundColor: 'rgba(255,245,230,0.95)', borderBottomColor: t.glassBorder }]}>
        <View style={[styles.phaseBadge, { backgroundColor: 'rgba(212,101,26,0.12)', borderColor: 'rgba(212,101,26,0.4)' }]}>
          <Text style={[styles.phaseLabel, { color: t.textMuted }]}>DAY</Text>
          <Text style={[styles.phaseNumber, { color: t.accent }]}>{phase}</Text>
        </View>
        <Text style={[styles.title, { color: t.text, flex: 1, textAlign: 'center' }]}>The Village Awakens</Text>
        <View style={styles.timerSlot}>
          {hunterTriggered && hunterTriggered === playerId ? (
            <Timer totalSeconds={30} onExpire={handleHunterTimerExpire} theme={t} />
          ) : !hunterTriggered && !lastLynchResult && room.gameMode !== 'narrator' ? (
            <Timer totalSeconds={DISCUSSION_SECONDS} onExpire={gs.isHost ? handleTimerExpire : () => {}} theme={t} />
          ) : null}
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

        <NightAnnouncement theme={t} nightVictims={nightVictims} roles={roles} bearTamerGrowl={room.bearTamerGrowl} />

        {gs.myRole === ROLE.BEAR_TAMER && room.bearTamerGrowl !== null && room.bearTamerGrowl !== undefined && (
          <View style={[
            styles.bearGrowlCard,
            { backgroundColor: room.bearTamerGrowl ? 'rgba(180,40,40,0.18)' : 'rgba(40,120,40,0.15)',
              borderColor: room.bearTamerGrowl ? '#C0392B' : '#27AE60' },
          ]}>
            <Text style={styles.bearGrowlEmoji}>🐻</Text>
            <View style={styles.bearGrowlTextBox}>
              <Text style={[styles.bearGrowlTitle, { color: room.bearTamerGrowl ? '#C0392B' : '#27AE60' }]}>
                {room.bearTamerGrowl ? 'The bears are growling!' : 'The bears are silent.'}
              </Text>
              <Text style={[styles.bearGrowlSub, { color: t.text }]}>
                {room.bearTamerGrowl
                  ? 'At least one of your neighbors is a Werewolf.'
                  : 'Neither of your neighbors is a Werewolf.'}
              </Text>
            </View>
          </View>
        )}

        {gs.isNarrator && (
          <NarratorDayDashboard
            theme={t}
            players={players}
            roles={roles}
            votes={votes}
            phase={phase}
            onCloseVotes={() => closeVoting(roomId)}
            lastLynchResult={lastLynchResult}
            hunterTriggered={hunterTriggered}
          />
        )}

        {hunterTriggered && (
          <HunterSection
            theme={t}
            players={players}
            playerId={playerId}
            hunterTriggered={hunterTriggered}
            hunterTarget={hunterTarget}
            onSelectTarget={setHunterTarget}
            onSubmit={handleHunterShoot}
            suspicions={playerHooks.suspicions}
            suspectedRoles={playerHooks.suspectedRoles}
          />
        )}

        {!lastLynchResult && !hunterTriggered && (
          <>
            {gs.isAlive && !gs.isNarrator && (
              <View style={[
                styles.votingForBanner,
                { backgroundColor: t.glassCard, borderColor: myVoteConfirmed ? t.success : myVoteTarget ? t.primary : t.glassBorder },
              ]}>
                {myVoteConfirmed ? (
                  <>
                    <Text style={[styles.bannerStateLabel, { color: t.success }]}>Vote locked in</Text>
                    <View style={styles.bannerLockedRow}>
                      <Image source={DAY_CHECK_ICON} style={styles.bannerCheckImg} resizeMode="contain" />
                      <Text style={[styles.bannerTargetName, { color: t.success }]}>{selectedTarget?.nickname || '?'}</Text>
                    </View>
                  </>
                ) : myVoteTarget ? (
                  <>
                    <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>Voting for</Text>
                    <Text style={[styles.bannerTargetName, { color: t.danger }]}>{selectedTarget?.nickname}</Text>
                    {(() => {
                      const lvl = playerHooks.suspicions[myVoteTarget];
                      const role = playerHooks.suspectedRoles[myVoteTarget];
                      if (!((lvl && lvl !== 'neutral') || role)) return null;
                      const suspicionColor = lvl === 'innocent' ? t.success : lvl === 'very_suspicious' ? t.danger : t.accent;
                      return (
                        <View style={styles.bannerBadgeRow}>
                          {lvl && lvl !== 'neutral' && (
                            <View style={[styles.bannerBadge, { borderColor: suspicionColor }]}>
                              <Text style={[styles.bannerBadgeText, { color: suspicionColor }]}>{SUSPICION_LABELS[lvl]}</Text>
                            </View>
                          )}
                          {role && (
                            <View style={[styles.bannerBadge, { borderColor: t.textSecondary }]}>
                              <Text style={[styles.bannerBadgeText, { color: t.textSecondary }]}>
                                {ROLE_DEFINITIONS[role]?.name || role}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <Text style={[styles.bannerStateLabel, { color: t.textMuted, textAlign: 'center' }]}>
                    Tap a player above to vote
                  </Text>
                )}
              </View>
            )}

            <View style={[styles.playerSection, { backgroundColor: t.glassSection }]}>
              <View style={styles.voteSectionHeader}>
                <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
                  {gs.isNarrator ? 'Players (narrator view)' : gs.isAlive ? 'Tap a player to vote for them' : 'Players (spectating)'}
                </Text>
                <Text style={[styles.voteProgress, { color: t.textMuted }]}>
                  {confirmedCount}/{totalEligible} confirmed
                </Text>
              </View>

              {players.filter((p) => !p.isNarrator).map((item) => {
                const isSelected = !myVoteConfirmed && myVoteTarget === item.id;
                const isMyConfirmedTarget = myVoteConfirmed && myVoteEntry?.target === item.id;
                const theyConfirmed = votes[item.id]?.confirmed === true;
                const aliveRowStyle = {
                  backgroundColor: 'rgba(255,245,230,0.92)',
                  borderColor: (isSelected || isMyConfirmedTarget) ? t.primary : 'rgba(212,101,26,0.18)',
                };
                const deadRowStyle = {
                  backgroundColor: 'rgba(60,30,60,0.72)',
                  borderColor: 'rgba(112,80,184,0.35)',
                };
                return (
                  <View
                    key={item.id}
                    style={[styles.playerRowBg, item.isAlive ? aliveRowStyle : deadRowStyle]}
                  >
                    <View style={styles.playerRowInner}>
                      <View style={styles.playerCardWrap}>
                        <PlayerCard
                          player={item}
                          theme={item.isAlive
                            ? { ...t, surface: 'transparent', border: 'transparent' }
                            : { ...t, surface: 'transparent', border: 'transparent', text: '#F0ECFF', textMuted: '#ffffff', textSecondary: '#C0A8E0', primary: '#7050B8', accent: '#ffffff' }
                          }
                          onPress={() => item.isAlive && item.id !== playerId && gs.isAlive && !gs.isNarrator && handleSelectVote(item.id)}
                          disabled={gs.isNarrator || !gs.isAlive || item.id === playerId || !item.isAlive || myVoteConfirmed}
                          selected={false}
                          roleMap={gs.isNarrator || !item.isAlive ? roles : {}}
                          showRole={gs.isNarrator || !item.isAlive}
                          noDeadOpacity={!item.isAlive}
                          avatarIcon={item.isAlive ? AVATAR_UNKNOWN : AVATAR_DEAD}
                          avatarIconSize={56}
                        />
                      </View>
                      {item.isAlive && theyConfirmed && (
                        <Image source={DAY_CHECK_ICON} style={styles.confirmedBadgeImg} resizeMode="contain" />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

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
        {gs.isNarrator && (
          <TouchableOpacity style={styles.chatBtn} onPress={() => setWolfChatOpen(true)}>
            <Image source={ROLE_ICONS.werewolf} style={styles.chatBtnImg} resizeMode="contain" />
          </TouchableOpacity>
        )}
        {gs.isAlive && !gs.isNarrator && !lastLynchResult && !hunterTriggered && (
          <TouchableOpacity
            style={[styles.confirmBtn, { opacity: (myVoteTarget && !myVoteConfirmed) ? 1 : 0.35 }]}
            onPress={handleConfirmVote}
            disabled={!myVoteTarget || myVoteConfirmed}
            activeOpacity={0.8}
          >
            <Image source={DAY_CONFIRM_ICON} style={styles.confirmBtnImg} resizeMode="contain" />
          </TouchableOpacity>
        )}
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

      {gs.isNarrator && (
        <WerewolfChat
          visible={wolfChatOpen}
          onClose={() => setWolfChatOpen(false)}
          roomId={roomId}
          playerId={playerId}
          nickname={nickname}
          isAlive={false}
          isNarrator={true}
        />
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
    minWidth: 52,
  },
  timerSlot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  phaseNumber: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  title: { ...FONTS.heading, textAlign: 'center' },
  scroll: { flex: 1 },
  bearGrowlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  bearGrowlEmoji: { fontSize: 40 },
  bearGrowlTextBox: { flex: 1 },
  bearGrowlTitle: { ...FONTS.subheading, fontWeight: '700', marginBottom: 2 },
  bearGrowlSub: { ...FONTS.body },
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
  playerRowBg: { marginBottom: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 2 },
  playerRowInner: { flexDirection: 'row', alignItems: 'center' },
  playerCardWrap: { flex: 1 },
  confirmedBadgeImg: { width: 36, height: 36, marginRight: SPACING.sm },
  votingForBanner: {
    margin: SPACING.md,
    marginBottom: 0,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    gap: SPACING.xs,
  },
  bannerStateLabel: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bannerTargetName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 2,
  },
  bannerBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  bannerBadgeText: {
    ...FONTS.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  bannerLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bannerCheckImg: { width: 28, height: 28 },
  confirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBtnImg: { width: '100%', height: 70 },
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
