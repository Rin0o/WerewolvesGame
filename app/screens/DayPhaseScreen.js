import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import PhaseTransition from '../components/PhaseTransition';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import usePlayer from '../hooks/usePlayer';
import { accusePlayer, submitVote, clearVotes, updateRoom, addEvent, disconnectPlayer, reconnectPlayer } from '../firebase/roomService';
import { resolveLynch, startNextNight, hunterShoot } from '../game-logic/gameManager';
import { allVotesIn, tallyVotes } from '../game-logic/voteManager';
import Timer from '../components/Timer';
import VotePanel from '../components/VotePanel';
import PlayerCard from '../components/PlayerCard';
import NotesPanel from '../components/NotesPanel';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE, ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS, SUSPICION_ICONS, SUSPICION_LABELS } from '../constants/icons';
import { BOT_CONFIG } from '../constants/devConfig';

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

  const t = DAY;

  // Reconnect when screen gains focus (returning player)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      reconnectPlayer(roomId, playerId);
    });
    return unsubscribe;
  }, [navigation]);

  // Block hardware back (Android) and swipe-back gesture (iOS)
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
    // Hunter trigger for current player
    if (room.hunterTriggered === playerId && gs.isAlive === false) {
      setHunterMode(true);
    }
  }, [room?.status, room?.hunterTriggered]);

  // Host auto-submits bot votes when an accusation is set
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

  // Host resolves votes when all are in
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

  // Snapshot votes the moment they're all in, before resolveLynch wipes them
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

  // Clear result when a new accusation starts
  useEffect(() => {
    if (room?.accusedPlayerId) setLastLynchResult(null);
  }, [room?.accusedPlayerId]);

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

  // Night announcement
  const nightVictim = eliminatedThisNight ? players.find((p) => p.id === eliminatedThisNight) : null;

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

  async function handleHunterShoot() {
    if (!hunterTarget) return;
    await hunterShoot(roomId, room, hunterTarget);
    setHunterMode(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#FF8C42', '#D4651A', '#FFF8F0']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
      />
      {showTransition && (
        <PhaseTransition phase="day" onComplete={() => setShowTransition(false)} />
      )}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: 'rgba(212,101,26,0.3)', backgroundColor: 'transparent' }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.phase, { color: t.textMuted }]}>Day {phase}</Text>
          <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
            <Text style={[styles.exitText, { color: t.textMuted }]}>✕ Leave</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: t.primary }]}>☀️ The Village Awakens</Text>
        {!accusedPlayerId && (
          <Timer totalSeconds={DISCUSSION_SECONDS} onExpire={() => {}} theme={t} />
        )}
      </View>

      <ScrollView style={styles.scroll}>
        {/* Lover reveal banner — shown once lovers are set */}
        {gs.isLover && gs.myLover && (
          <View style={[styles.announcement, { backgroundColor: '#FFF0F8', borderColor: '#E85090' }]}>
            <Text style={styles.announcementEmoji}>💘</Text>
            <Text style={[styles.announcementTitle, { color: '#E85090' }]}>You are in love!</Text>
            <Text style={[styles.announcementText, { color: t.text }]}>
              Your lover is {gs.myLover.nickname}. If they die, you die too.
              {'\n'}If you are the last two alive, you win together.
            </Text>
          </View>
        )}

        {/* Night announcement */}
        {nightVictim ? (
          <View style={[styles.announcement, { backgroundColor: '#FFF0DC', borderColor: t.danger }]}>
            <Text style={styles.announcementEmoji}>🌅</Text>
            <Text style={[styles.announcementTitle, { color: t.danger }]}>Dawn breaks...</Text>
            <Text style={[styles.announcementText, { color: t.text }]}>
              {nightVictim.nickname} was found dead. They were a {roles[nightVictim.id] || '?'}.
            </Text>
          </View>
        ) : (
          <View style={[styles.announcement, { backgroundColor: '#F0FFF4', borderColor: t.success }]}>
            <Text style={styles.announcementEmoji}>🌅</Text>
            <Text style={[styles.announcementTitle, { color: t.success }]}>The village was peaceful!</Text>
            <Text style={[styles.announcementText, { color: t.text }]}>No one was eliminated last night.</Text>
          </View>
        )}

        {/* Hunter mode */}
        {hunterTriggered && (
          <View style={[styles.hunterBox, { backgroundColor: '#FFF8F0', borderColor: t.accent }]}>
            <View style={styles.actionTitleRow}>
              <Image source={ROLE_ICONS.hunter} style={styles.actionTitleIcon} resizeMode="contain" />
              <Text style={[styles.hunterTitle, { color: t.primary }]}>The Hunter's Final Shot</Text>
            </View>
            <Text style={[styles.hunterSub, { color: t.textSecondary }]}>
              {hunterTriggered === playerId
                ? 'You are the Hunter! Choose someone to take down with you.'
                : `${players.find((p) => p.id === hunterTriggered)?.nickname} is the Hunter — choosing their final target...`}
            </Text>
            {hunterTriggered === playerId && (
              <>
                <FlatList
                  data={players.filter((p) => p.isAlive && p.id !== playerId)}
                  keyExtractor={(p) => p.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <PlayerCard
                      player={item}
                      theme={t}
                      selected={hunterTarget === item.id}
                      onPress={() => setHunterTarget(item.id)}
                    />
                  )}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: hunterTarget ? t.danger : t.border }]}
                  onPress={handleHunterShoot}
                  disabled={!hunterTarget}
                >
                  <View style={styles.btnIconRow}>
                    <Image source={ROLE_ICONS.hunter} style={styles.btnIcon} resizeMode="contain" />
                    <Text style={styles.submitBtnText}>Fire!</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Active Accusation + Defense + Vote */}
        {accusedPlayerId && (
          <View style={[styles.voteSection, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.voteSectionTitle, { color: t.text }]}>
              ⚖️ {accusedPlayer?.nickname} is on trial!
            </Text>
            {!votesRevealed && (
              <>
                <Text style={[styles.defenseLabel, { color: t.textSecondary }]}>Defense time:</Text>
                <Timer totalSeconds={DEFENSE_SECONDS} onExpire={() => {}} theme={t} />
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

        {/* Lynch result — persists after votes are cleared */}
        {lastLynchResult && !accusedPlayerId && !hunterTriggered && (
          <View style={[
            styles.lynchResult,
            { borderColor: lastLynchResult.lynched ? t.danger : t.success,
              backgroundColor: lastLynchResult.lynched ? '#FFF0DC' : '#F0FFF4' }
          ]}>
            <Text style={[styles.lynchResultVerdict, { color: lastLynchResult.lynched ? t.danger : t.success }]}>
              {lastLynchResult.lynched ? '⚔️ Lynched' : '🛡️ Spared'}
            </Text>
            <Text style={[styles.lynchResultName, { color: t.text }]}>
              {lastLynchResult.accusedNickname}
            </Text>

            <View style={styles.lynchTally}>
              <Text style={[styles.lynchTallyItem, { color: t.danger }]}>
                ⚔️ {Object.values(lastLynchResult.votes).filter((v) => v === 'lynch').length} lynch
              </Text>
              <Text style={[styles.lynchTallyItem, { color: t.success }]}>
                🛡️ {Object.values(lastLynchResult.votes).filter((v) => v === 'spare').length} spare
              </Text>
            </View>

            {['lynch', 'spare'].map((decision) => {
              const names = Object.entries(lastLynchResult.votes)
                .filter(([, v]) => v === decision)
                .map(([id]) => players.find((p) => p.id === id)?.nickname || '?')
                .join(', ');
              if (!names) return null;
              return (
                <Text key={decision} style={[styles.lynchVoterRow, { color: decision === 'lynch' ? t.danger : t.success }]}>
                  {decision === 'lynch' ? '⚔️' : '🛡️'} {names}
                </Text>
              );
            })}

            {lastLynchResult.lynched && roles[lastLynchResult.accusedId] && (() => {
              const roleKey = roles[lastLynchResult.accusedId];
              const info = ROLE_DEFINITIONS[roleKey];
              return (
                <View style={styles.lynchRoleRow}>
                  <Text style={[styles.lynchRole, { color: t.textSecondary }]}>They were</Text>
                  {ROLE_ICONS[roleKey] ? (
                    <Image source={ROLE_ICONS[roleKey]} style={styles.lynchRoleIcon} resizeMode="contain" />
                  ) : (
                    <Text style={[styles.lynchRole, { color: t.textSecondary }]}>{info?.emoji}</Text>
                  )}
                  <Text style={[styles.lynchRole, { color: t.textSecondary }]}>{info?.name}</Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* Player List (accusation targets) */}
        {!accusedPlayerId && (
          <View style={styles.playerSection}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
              {gs.isAlive ? 'Tap a player to accuse them' : 'Players (spectating)'}
            </Text>
            <FlatList
              data={players}
              keyExtractor={(p) => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  theme={t}
                  onPress={() => item.isAlive && item.id !== playerId && gs.isAlive && handleAccuse(item.id)}
                  disabled={!gs.isAlive || item.id === playerId || !item.isAlive}
                  roleMap={!item.isAlive ? roles : {}}
                  showRole={!item.isAlive}
                />
              )}
            />
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Bottom toolbar — Notes always visible; End Discussion when host can act */}
      <View style={[styles.bottomBar, { borderTopColor: 'rgba(212,101,26,0.3)', backgroundColor: 'rgba(255,248,240,0.97)' }]}>
        {gs.isHost && !accusedPlayerId && !hunterTriggered && (
          <TouchableOpacity
            style={[styles.nightBtn, { flex: 1 }]}
            onPress={handleNightEnd}
          >
            <Text style={styles.nightBtnText}>🌙 End Discussion</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.notesBtn, { backgroundColor: t.primary, flex: 1 }]}
          onPress={() => setNotesOpen(true)}
        >
          <Text style={styles.notesBtnText}>📓 Notes</Text>
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

      {/* Accuse confirmation modal */}
      {(() => {
        const target = players.find((p) => p.id === accuseTarget);
        if (!target) return null;
        const suspicion = playerHooks.suspicions[accuseTarget];
        const suspectedRole = playerHooks.suspectedRoles[accuseTarget];
        return (
          <Modal visible={!!accuseTarget} transparent animationType="fade" onRequestClose={() => setAccuseTarget(null)}>
            <View style={styles.accuseOverlay}>
              <View style={[styles.accuseModal, { backgroundColor: t.surface, borderColor: t.danger }]}>
                <Text style={[styles.accuseHeading, { color: t.danger }]}>⚖️ Raise an Accusation</Text>

                <View style={[styles.accusePlayerRow, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                  <View style={[styles.accuseAvatar, { backgroundColor: t.primary }]}>
                    <Text style={styles.accuseAvatarText}>{target.nickname?.[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.accusePlayerName, { color: t.text }]}>{target.nickname}</Text>
                </View>

                {(suspicion && suspicion !== 'neutral') && (
                  <View style={[styles.accuseChip, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                    <Image source={SUSPICION_ICONS[suspicion]} style={styles.accuseChipIcon} resizeMode="contain" />
                    <Text style={[styles.accuseChipText, { color: t.textSecondary }]}>
                      Your read: {SUSPICION_LABELS[suspicion]}
                    </Text>
                  </View>
                )}

                {suspectedRole && (
                  <View style={[styles.accuseChip, { backgroundColor: t.surfaceAlt, borderColor: t.primary }]}>
                    {ROLE_ICONS[suspectedRole] && (
                      <Image source={ROLE_ICONS[suspectedRole]} style={styles.accuseChipIcon} resizeMode="contain" />
                    )}
                    <Text style={[styles.accuseChipText, { color: t.text }]}>
                      Suspected role: {ROLE_DEFINITIONS[suspectedRole]?.name}
                    </Text>
                  </View>
                )}

                <Text style={[styles.accuseBody, { color: t.textSecondary }]}>
                  Accusing{' '}
                  <Text style={{ fontWeight: '700', color: t.text }}>{target.nickname}</Text>
                  {' '}puts them on trial. They will have a moment to defend themselves before the village votes to{' '}
                  <Text style={{ color: t.danger, fontWeight: '600' }}>lynch</Text> or{' '}
                  <Text style={{ color: t.success, fontWeight: '600' }}>spare</Text> them.
                  {'\n\n'}This cannot be undone once confirmed.
                </Text>

                <View style={styles.accuseBtns}>
                  <TouchableOpacity
                    style={[styles.accuseBtn, { backgroundColor: t.surfaceAlt, borderColor: t.border, borderWidth: 1 }]}
                    onPress={() => setAccuseTarget(null)}
                  >
                    <Text style={[styles.accuseBtnText, { color: t.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.accuseBtn, { backgroundColor: t.danger }]}
                    onPress={() => { setAccuseTarget(null); accusePlayer(roomId, accuseTarget); }}
                  >
                    <Text style={[styles.accuseBtnText, { color: '#fff' }]}>Accuse</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: SPACING.xs,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  exitBtn: { padding: SPACING.xs },
  exitText: { ...FONTS.caption },
  phase: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 2 },
  title: { ...FONTS.heading },
  scroll: { flex: 1 },
  announcement: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  announcementEmoji: { fontSize: 36, marginBottom: SPACING.sm },
  announcementTitle: { ...FONTS.heading, marginBottom: SPACING.xs },
  announcementText: { ...FONTS.body, textAlign: 'center' },
  hunterBox: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
  },
  hunterTitle: { ...FONTS.heading, marginBottom: SPACING.xs },
  hunterSub: { ...FONTS.body, marginBottom: SPACING.md },
  voteSection: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  voteSectionTitle: { ...FONTS.subheading, textAlign: 'center', marginBottom: SPACING.sm },
  defenseLabel: { ...FONTS.caption, textAlign: 'center', marginBottom: SPACING.xs },
  lynchResult: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    gap: SPACING.xs,
  },
  lynchResultVerdict: { ...FONTS.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  lynchResultName: { ...FONTS.heading },
  lynchTally: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  lynchTallyItem: { ...FONTS.subheading, fontWeight: '700' },
  lynchVoterRow: { ...FONTS.caption, lineHeight: 18 },
  lynchRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  lynchRoleIcon: { width: 26, height: 26 },
  lynchRole: { ...FONTS.body },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  actionTitleIcon: { width: 40, height: 40 },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
  playerSection: { padding: SPACING.md },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  nightBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    backgroundColor: '#1a0a2e',
  },
  nightBtnText: { ...FONTS.button, color: '#fff' },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitBtnText: { ...FONTS.button, color: '#fff' },
  bottomBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
  },
  notesBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  notesBtnText: { ...FONTS.button, color: '#fff' },
  accuseOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  accuseModal: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  accuseHeading: {
    ...FONTS.heading,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  accusePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  accuseAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accuseAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  accusePlayerName: { ...FONTS.subheading, fontWeight: '700' },
  accuseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  accuseChipIcon: { width: 22, height: 22 },
  accuseChipText: { ...FONTS.body, fontWeight: '600' },
  accuseBody: {
    ...FONTS.body,
    lineHeight: 22,
    marginTop: SPACING.xs,
  },
  accuseBtns: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  accuseBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  accuseBtnText: { ...FONTS.button },
});
