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
import useHostFailover from '../hooks/useHostFailover';
import { clearSession } from '../utils/session';
import { confirmDayVote, closeVoting, disconnectPlayer, reconnectPlayer, sendDayMessage } from '../firebase/roomService';
import { botVoteTarget, botDayChatter, botVoteLine } from '../game-logic/botChat';
import { resolveLynch, startNextNight, hunterShoot, tiedForRevote, startRevote, TIE_RULE } from '../game-logic/gameManager';
import { tallyVotes } from '../game-logic/voteManager';
import { discussionSecondsFor, allDayVotesCast, votingDone, humansAllVoted, botsYetToVote, botMaySpeak } from '../game-logic/hostDecisions';
import Timer from '../components/Timer';
import PlayerCard from '../components/PlayerCard';
import NotesPanel from '../components/NotesPanel';
import DayChat from '../components/day/DayChat';
import PrivateChat from '../components/PrivateChat';
import NarratorDayDashboard from '../components/narrator/NarratorDayDashboard';
import NightAnnouncement from '../components/day/NightAnnouncement';
import HunterSection from '../components/day/HunterSection';
import LynchResultModal from '../components/day/LynchResultModal';
import SeatingTable, { SeatingTableButton } from '../components/SeatingTable';
import MyRoleButton from '../components/MyRoleButton';
import BarButton from '../components/BarButton';
import GameOptionsModal from '../components/GameOptionsModal';
import ConfirmChoiceButton from '../components/ConfirmChoiceButton';
import useUnreadMessages from '../hooks/useUnreadMessages';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { SUSPICION_LABELS, ROLE_ICONS } from '../constants/icons';
import { ROLE_DEFINITIONS, ROLE } from '../constants/roles';

const DAY_BACKGROUND       = require('../../assets/day_background.webp');
const NOTES_ICON           = require('../../assets/notes.webp');
const DAY_CHAT_ICON        = require('../../assets/day_chat.webp');
const DAY_CONFIRM_ICON     = require('../../assets/day_confirm.webp');
const DAY_CHECK_ICON       = require('../../assets/day_check.webp');
const AVATAR_UNKNOWN       = require('../../assets/role_icons/unknown.webp');
const AVATAR_DEAD          = require('../../assets/suspicion_level_icons/dead.webp');
const BEAR_GROWL_ICON      = require('../../assets/bear_growl.webp');
const OPTIONS_ICON         = require('../../assets/options.webp');

const HUNTER_SHOT_SECONDS = 20;
const REVOTE_SECONDS = 60;
const BOT_VOTE_THINKING_MS = [30000, 90000];
const BOT_VOTE_QUICK_MS = [2000, 5000];
const BOT_CHAT_MS = [6000, 28000];

function randomBetween([minMs, maxMs]) {
  return minMs + Math.random() * (maxMs - minMs);
}

export default function DayPhaseScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  useHostFailover(roomId, playerId, room);
  const gs = useGameState(room, playerId);
  const playerHooks = usePlayer(roomId);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [wolfChatOpen, setWolfChatOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const unreadDayMessages = useUnreadMessages(roomId, 'day', playerId, { isOpen: chatOpen });
  const unreadWolfMessages = useUnreadMessages(roomId, 'werewolf', playerId, {
    isOpen: wolfChatOpen,
    enabled: !!gs.isNarrator,
  });
  const [resolving, setResolving] = useState(false);
  const [hunterTarget, setHunterTarget] = useState(null);
  const [showTransition, setShowTransition] = useState(true);
  const [lastLynchResult, setLastLynchResult] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [myVoteTarget, setMyVoteTarget] = useState(null);
  const shownResultRef = useRef(false);
  const roomRef = useRef(null);
  const resolvingRef = useRef(false);
  const hunterTargetRef = useRef(null);
  const discussionTimerExpiredRef = useRef(false);
  const discussionSecondsRef = useRef(null);
  const botTargetsRef = useRef({});

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
            await clearSession();
            navigation.popTo('Home');
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

  const alivePlayers = room?.players?.filter((p) => p.isAlive && !p.isNarrator) || [];
  const disconnected = room?.disconnectedPlayers || [];
  const allIn = room ? allDayVotesCast(room) : false;
  if (room && discussionSecondsRef.current === null) {
    discussionSecondsRef.current = discussionSecondsFor(alivePlayers.length);
  }
  const everyHumanVoted = room ? humansAllVoted(room) : true;

  function botTargetFor(current, botId) {
    const key = `${current.phase}:${(current.revoteTargets || []).join(',')}:${botId}`;
    const planned = botTargetsRef.current[key];
    const allowed = current.revoteTargets?.length ? current.revoteTargets : null;
    const stillValid = planned && (current.players || []).some((p) => p.id === planned && p.isAlive)
      && (!allowed || allowed.includes(planned));
    if (!stillValid) botTargetsRef.current[key] = botVoteTarget(current, botId);
    return botTargetsRef.current[key];
  }

  useEffect(() => {
    if (!gs.isHost || !room?.botChat) return;
    const timers = botsYetToVote(room).flatMap((bot) => {
      const lines = botDayChatter(room, bot.id, botTargetFor(room, bot.id));
      const delays = lines.map(() => randomBetween(BOT_CHAT_MS)).sort((a, b) => a - b);
      return lines.map((text, i) => setTimeout(() => {
        if (botMaySpeak(roomRef.current, bot.id)) sendDayMessage(roomId, bot.id, bot.nickname, text).catch(() => {});
      }, delays[i]));
    });
    return () => timers.forEach(clearTimeout);
  }, [room?.status, room?.phase, room?.revoteTargets, room?.botChat, gs.isHost]);

  useEffect(() => {
    if (!gs.isHost) return;
    const timing = everyHumanVoted ? BOT_VOTE_QUICK_MS : BOT_VOTE_THINKING_MS;
    const timers = botsYetToVote(room).map((bot) => setTimeout(() => {
      const current = roomRef.current;
      if (!botMaySpeak(current, bot.id) || current.votes?.[bot.id]) return;
      const target = botTargetFor(current, bot.id);
      if (!target) return;
      if (current.botChat) sendDayMessage(roomId, bot.id, bot.nickname, botVoteLine(current, target)).catch(() => {});
      confirmDayVote(roomId, bot.id, target);
    }, randomBetween(timing)));
    return () => timers.forEach(clearTimeout);
  }, [room?.status, room?.votesClosed, room?.revoteTargets, everyHumanVoted, gs.isHost]);

  useEffect(() => {
    discussionTimerExpiredRef.current = false;
    setMyVoteTarget(null);
  }, [room?.revoteTargets]);

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
    } else if (hadHunterRef.current && room?.hunterDiedDuring !== 'day') {
      hadHunterRef.current = false;
    } else if (hadHunterRef.current && !startedNextNightRef.current && room?.status === 'day' && !room?.winner && gs.isHost) {
      hadHunterRef.current = false;
      startedNextNightRef.current = true;
      startNextNight(roomId);
    }
  }, [room?.hunterTriggered, gs.isHost]);

  useEffect(() => {
    const current = roomRef.current;
    if (!gs.isHost || !current || current.status !== 'day') return;
    if (current.hunterTriggered || resultModalVisible || resolvingRef.current) return;
    if (votingDone(current)) handleResultExpire();
    else if (discussionTimerExpiredRef.current) handleTimerExpire();
  }, [gs.isHost]);

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

  function handleDiscussionTimerExpire() {
    discussionTimerExpiredRef.current = true;
    handleTimerExpire();
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
    const tied = tiedForRevote(roomRef.current);
    if (tied) {
      startRevote(roomId, roomRef.current, tied);
      return;
    }
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
    if (!winner && gs.isHost && !startedNextNightRef.current && currentRoom.hunterDiedDuring === 'day') {
      startedNextNightRef.current = true;
      hadHunterRef.current = false;
      startNextNight(roomId);
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
    if (!winner && gs.isHost && !startedNextNightRef.current && currentRoom.hunterDiedDuring === 'day') {
      startedNextNightRef.current = true;
      hadHunterRef.current = false;
      startNextNight(roomId);
    }
  }

  const selectedTarget = myVoteConfirmed
    ? players.find((p) => p.id === myVoteEntry?.target)
    : players.find((p) => p.id === myVoteTarget);

  const revoteTargets = room.revoteTargets?.length ? room.revoteTargets : null;
  const canBeVoted = (id) => !revoteTargets || revoteTargets.includes(id);
  const canConfirmVote = gs.isAlive && !gs.isNarrator && !lastLynchResult && !hunterTriggered
    && !!myVoteTarget && !myVoteConfirmed;
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
        <MyRoleButton theme={t} gs={gs} room={room} />
        <Text
          style={[styles.title, { color: t.text, flex: 1, textAlign: 'center' }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          The Village Awakens
        </Text>
        <View style={styles.timerSlot}>
          {hunterTriggered && hunterTriggered === playerId ? (
            <Timer totalSeconds={HUNTER_SHOT_SECONDS} onExpire={handleHunterTimerExpire} theme={t} />
          ) : !hunterTriggered && !lastLynchResult && room.gameMode !== 'narrator' ? (
            <Timer
              key={revoteTargets ? 'revote' : 'discussion'}
              totalSeconds={revoteTargets ? REVOTE_SECONDS : discussionSecondsRef.current}
              onExpire={handleDiscussionTimerExpire}
              theme={t}
            />
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
            <Image
              source={room.bearTamerGrowl ? BEAR_GROWL_ICON : ROLE_ICONS.bear_tamer}
              style={styles.bearGrowlIcon}
              resizeMode="contain"
            />
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
            {revoteTargets && (
              <View style={[styles.revoteBanner, { backgroundColor: t.glassCard, borderColor: t.accent }]}>
                <Text style={styles.revoteIcon}>⚖️</Text>
                <View style={styles.revoteTextCol}>
                  <Text style={[styles.bannerStateLabel, { color: t.accent }]}>Tie — vote again</Text>
                  <Text style={[styles.revoteText, { color: t.text }]}>
                    Only {revoteTargets.map((id) => players.find((p) => p.id === id)?.nickname || '?').join(' and ')} can be chosen.
                    A second tie spares everyone.
                  </Text>
                </View>
              </View>
            )}
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
                    style={[
                      styles.playerRowBg,
                      item.isAlive ? aliveRowStyle : deadRowStyle,
                      item.isAlive && !canBeVoted(item.id) && styles.notInRevote,
                    ]}
                  >
                    <View style={styles.playerRowInner}>
                      <View style={styles.playerCardWrap}>
                        <PlayerCard
                          player={item}
                          theme={item.isAlive
                            ? { ...t, surface: 'transparent', border: 'transparent' }
                            : { ...t, surface: 'transparent', border: 'transparent', text: '#F0ECFF', textMuted: '#ffffff', textSecondary: '#C0A8E0', primary: '#7050B8', accent: '#ffffff' }
                          }
                          onPress={() => item.isAlive && item.id !== playerId && gs.isAlive && !gs.isNarrator && canBeVoted(item.id) && handleSelectVote(item.id)}
                          disabled={gs.isNarrator || !gs.isAlive || item.id === playerId || !item.isAlive || myVoteConfirmed || !canBeVoted(item.id)}
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

      {canConfirmVote && (
        <ConfirmChoiceButton
          theme={t}
          icon={DAY_CONFIRM_ICON}
          label="Confirm your vote"
          targetName={selectedTarget?.nickname}
          onPress={handleConfirmVote}
        />
      )}

      <View style={[styles.bottomBar, { borderTopColor: t.glassBorder, backgroundColor: t.glassToolbar }]}>
        <BarButton source={NOTES_ICON} onPress={() => setNotesOpen(true)} accessibilityLabel="Notes" />
        <BarButton
          source={DAY_CHAT_ICON}
          onPress={() => setChatOpen(true)}
          unread={unreadDayMessages}
          accessibilityLabel="Village chat"
        />
        <SeatingTableButton onPress={() => setTableOpen(true)} />
        {gs.isNarrator && (
          <BarButton
            source={ROLE_ICONS.werewolf}
            onPress={() => setWolfChatOpen(true)}
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

      <LynchResultModal
        visible={resultModalVisible}
        onExpire={handleResultExpire}
        theme={t}
        result={lastLynchResult}
        players={players}
        roles={roles}
        willRevote={!!lastLynchResult?.tie && room.tieRule === TIE_RULE.REVOTE && !revoteTargets}
      />

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players}
        events={events}
        playerHooks={playerHooks}
      />

      <SeatingTable
        visible={tableOpen}
        onClose={() => setTableOpen(false)}
        theme={t}
        players={players}
        playerId={playerId}
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
        <PrivateChat
          chat="werewolf"
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
    width: 72,
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
  bearGrowlIcon: { width: 56, height: 56 },
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
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  notInRevote: { opacity: 0.45 },
  revoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    margin: SPACING.md,
    marginBottom: 0,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
  },
  revoteIcon: { fontSize: 32 },
  revoteTextCol: { flex: 1, gap: 2 },
  revoteText: { ...FONTS.body },
});
