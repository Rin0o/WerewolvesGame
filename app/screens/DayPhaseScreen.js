import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import PhaseTransition from '../components/PhaseTransition';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import usePlayer from '../hooks/usePlayer';
import { accusePlayer, submitVote, clearVotes, updateRoom, addEvent } from '../firebase/roomService';
import { resolveLynch, startNextNight, hunterShoot } from '../game-logic/gameManager';
import { allVotesIn, tallyVotes } from '../game-logic/voteManager';
import Timer from '../components/Timer';
import VotePanel from '../components/VotePanel';
import PlayerCard from '../components/PlayerCard';
import NotesPanel from '../components/NotesPanel';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';
import { ROLE } from '../constants/roles';

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

  const t = DAY;

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

  // Host resolves votes when all are in
  useEffect(() => {
    if (!room || !gs.isHost || resolving) return;
    if (!room.accusedPlayerId) return;
    const { votes = {}, players = [] } = room;
    if (allVotesIn(votes, players)) {
      setResolving(true);
      resolveLynch(roomId, room, room.accusedPlayerId)
        .catch(() => setResolving(false))
        .then(({ winner }) => {
          if (!winner) setResolving(false);
        });
    }
  }, [room?.votes]);

  if (loading || !room) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const { players = [], roles = {}, phase, accusedPlayerId, votes = {}, events = [], eliminatedThisNight, hunterTriggered } = room;
  const accusedPlayer = accusedPlayerId ? players.find((p) => p.id === accusedPlayerId) : null;
  const voteResults = Object.keys(votes).length > 0 ? tallyVotes(votes) : null;
  const votesRevealed = allVotesIn(votes, players.filter((p) => p.isAlive));

  // Night announcement
  const nightVictim = eliminatedThisNight ? players.find((p) => p.id === eliminatedThisNight) : null;

  async function handleAccuse(targetId) {
    if (!gs.isAlive) return;
    Alert.alert(
      'Accuse Player',
      `Accuse ${players.find((p) => p.id === targetId)?.nickname}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accuse', style: 'destructive', onPress: () => accusePlayer(roomId, targetId) },
      ]
    );
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
        <Text style={[styles.phase, { color: t.textMuted }]}>Day {phase}</Text>
        <Text style={[styles.title, { color: t.primary }]}>☀️ The Village Awakens</Text>
        {!accusedPlayerId && (
          <Timer totalSeconds={DISCUSSION_SECONDS} onExpire={() => {}} theme={t} />
        )}
      </View>

      <ScrollView style={styles.scroll}>
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
            <Text style={[styles.hunterTitle, { color: t.primary }]}>🏹 The Hunter's Final Shot</Text>
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
                  <Text style={styles.submitBtnText}>🏹 Fire!</Text>
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

        {/* Move to next night (host) */}
        {gs.isHost && !accusedPlayerId && !hunterTriggered && (
          <View style={styles.hostActions}>
            <TouchableOpacity
              style={[styles.nightBtn, { backgroundColor: '#1a0a2e' }]}
              onPress={handleNightEnd}
            >
              <Text style={styles.nightBtnText}>🌙 End Discussion — Go to Night</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Notes button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: t.primary }]}
        onPress={() => setNotesOpen(true)}
      >
        <Text style={styles.fabText}>📓</Text>
      </TouchableOpacity>

      <NotesPanel
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        theme={t}
        players={players}
        events={events}
        playerHooks={playerHooks}
      />
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
  playerSection: { padding: SPACING.md },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  hostActions: { padding: SPACING.md },
  nightBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  nightBtnText: { ...FONTS.button, color: '#fff' },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitBtnText: { ...FONTS.button, color: '#fff' },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 24 },
});
