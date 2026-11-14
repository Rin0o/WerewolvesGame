import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameReplay from '../components/GameReplay';
import { ensureSignedIn } from '../firebase/authService';
import { loadMyGames, countMyGames } from '../firebase/historyService';
import {
  MODE_LABELS, WINNER_LABELS, myEntry, myOutcome, winRate, roleRecord, gameDate,
} from '../utils/matchHistory';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS, DEAD_ICON } from '../constants/icons';
import { SETTINGS_THEME as t, FONTS, RADIUS, SPACING } from '../constants/theme';

const OUTCOME_STYLES = {
  won: { label: 'Won', color: t.success },
  lost: { label: 'Lost', color: t.danger },
  narrator: { label: 'Narrator', color: t.textSecondary },
};
const NARRATOR_EMOJI = '🎙️';

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleName(role) {
  return (ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.villager).name;
}

function RoleIcon({ role, size }) {
  if (ROLE_ICONS[role]) {
    return <Image source={ROLE_ICONS[role]} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return (
    <Text style={{ fontSize: size * 0.7, width: size, textAlign: 'center' }}>
      {role ? ROLE_DEFINITIONS[role]?.emoji ?? '❔' : NARRATOR_EMOJI}
    </Text>
  );
}

function gameSummary(game) {
  const players = (game.players || []).filter((p) => !p.isNarrator).length;
  return [
    formatDate(gameDate(game)),
    MODE_LABELS[game.gameMode] || MODE_LABELS.normal,
    `${players} players`,
    game.withBots ? '🤖 with bots' : null,
  ].filter(Boolean).join(' · ');
}

function OutcomeChip({ outcome }) {
  const style = OUTCOME_STYLES[outcome];
  return (
    <View style={[styles.chip, { borderColor: style.color }]}>
      <Text style={[styles.chipText, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

function GameDetail({ game, uid, onClose }) {
  if (!game) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]}>
        <View style={[styles.header, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>{WINNER_LABELS[game.winner] || 'Game over'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close this game">
            <Text style={[styles.close, { color: t.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.detailMeta, { color: t.textMuted }]}>
            {gameSummary(game)}
            {game.rounds ? ` · ${game.rounds} ${game.rounds === 1 ? 'night' : 'nights'}` : ''}
            {game.code ? ` · room ${game.code}` : ''}
          </Text>
          <Text style={[styles.section, { color: t.textSecondary }]}>The cast</Text>
          {(game.players || []).map((p) => (
            <View
              key={p.id}
              style={[styles.row, { backgroundColor: t.surfaceAlt, borderColor: p.won ? t.success : t.border }]}
            >
              <RoleIcon role={p.isNarrator ? null : p.role} size={44} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                  {p.nickname}{p.id === uid ? ' (you)' : ''}
                </Text>
                <Text style={[styles.caption, { color: t.textMuted }]}>
                  {p.isNarrator ? 'Narrator' : roleName(p.role)}
                  {p.infected ? ' · infected by the Wolf-Father' : ''}
                </Text>
                {!p.alive && !p.isNarrator && (
                  <View style={styles.deadRow}>
                    <Image source={DEAD_ICON} style={styles.deadIcon} resizeMode="contain" />
                    <Text style={[styles.caption, { color: t.danger }]}>Eliminated</Text>
                  </View>
                )}
              </View>
              {p.won && <Text style={styles.trophy}>🏆</Text>}
            </View>
          ))}
          <Text style={[styles.section, { color: t.textSecondary }]}>What really happened</Text>
          {game.events ? (
            <GameReplay room={game} theme={t} />
          ) : (
            <Text style={[styles.note, { color: t.textMuted }]}>
              This game was saved before the app kept the game log.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function MyGamesScreen({ navigation }) {
  const [uid, setUid] = useState(null);
  const [games, setGames] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openGame, setOpenGame] = useState(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const user = await ensureSignedIn();
      setUid(user.uid);
      const [page, counts] = await Promise.all([
        loadMyGames(user.uid),
        countMyGames(user.uid).catch(() => null),
      ]);
      setGames(page.games);
      setCursor(page.last);
      setHasMore(page.hasMore);
      setStats(counts);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (!uid || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadMyGames(uid, cursor);
      setGames((current) => [...current, ...page.games]);
      setCursor(page.last);
      setHasMore(page.hasMore);
    } catch {
      setHasMore(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const rate = stats ? winRate(stats) : null;
  const roles = uid ? roleRecord(games, uid) : [];

  function renderHeader() {
    if (games.length === 0) return null;
    return (
      <View>
        {stats && (
          <View style={[styles.statsCard, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: t.text }]}>{stats.played - stats.narrated}</Text>
              <Text style={[styles.caption, { color: t.textMuted }]}>games</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: t.text }]}>{stats.won}</Text>
              <Text style={[styles.caption, { color: t.textMuted }]}>wins</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: t.text }]}>{rate === null ? '–' : `${rate}%`}</Text>
              <Text style={[styles.caption, { color: t.textMuted }]}>win rate</Text>
            </View>
            {stats.narrated > 0 && (
              <View style={styles.stat}>
                <Text style={[styles.statNumber, { color: t.text }]}>{stats.narrated}</Text>
                <Text style={[styles.caption, { color: t.textMuted }]}>narrated</Text>
              </View>
            )}
          </View>
        )}
        {roles.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.textSecondary }]}>Your roles</Text>
            <View style={styles.roleGrid}>
              {roles.map((r) => (
                <View key={r.role} style={[styles.roleChip, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                  <RoleIcon role={r.role} size={28} />
                  <Text style={[styles.caption, { color: t.text }]}>
                    {r.won}/{r.played} won
                  </Text>
                </View>
              ))}
            </View>
            {hasMore && (
              <Text style={[styles.note, { color: t.textMuted }]}>Roles count the games loaded below.</Text>
            )}
          </>
        )}
        <Text style={[styles.section, { color: t.textSecondary }]}>Games</Text>
      </View>
    );
  }

  function renderGame({ item }) {
    const outcome = myOutcome(item, uid);
    const me = myEntry(item, uid);
    const role = outcome === 'narrator' ? null : me?.role;
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
        onPress={() => setOpenGame(item)}
      >
        <RoleIcon role={role} size={44} />
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {outcome === 'narrator' ? 'Narrator' : roleName(role)}
          </Text>
          <Text style={[styles.caption, { color: t.textMuted }]} numberOfLines={2}>{gameSummary(item)}</Text>
        </View>
        <OutcomeChip outcome={outcome} />
      </TouchableOpacity>
    );
  }

  function renderFooter() {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={[styles.moreBtn, { borderColor: t.border }]}
        onPress={loadMore}
        disabled={loadingMore}
      >
        {loadingMore
          ? <ActivityIndicator color={t.textSecondary} />
          : <Text style={[styles.moreText, { color: t.textSecondary }]}>Load more</Text>}
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
    if (loading) return <ActivityIndicator style={styles.spinner} color={t.textSecondary} />;
    if (failed) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: t.textMuted }]}>Couldn't load your games. Check your connection.</Text>
          <TouchableOpacity style={[styles.moreBtn, { borderColor: t.border }]} onPress={loadFirstPage}>
            <Text style={[styles.moreText, { color: t.textSecondary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: t.text }]}>No games yet.</Text>
        <Text style={[styles.emptyText, { color: t.textMuted }]}>
          Every game you finish from now on is saved here, with your role and whether you won.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.title, { color: t.text }]}>📜 My Games</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back to Home">
          <Text style={[styles.close, { color: t.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        renderItem={renderGame}
        ListHeaderComponent={renderHeader()}
        ListFooterComponent={renderFooter()}
        ListEmptyComponent={renderEmpty()}
        contentContainerStyle={styles.content}
      />
      <GameDetail game={openGame} uid={uid} onClose={() => setOpenGame(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  title: { ...FONTS.heading, flex: 1, marginRight: SPACING.md },
  close: { fontSize: 24 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  section: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { ...FONTS.heading },
  caption: { ...FONTS.caption },
  note: { ...FONTS.caption, fontStyle: 'italic', marginTop: SPACING.xs },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  rowText: { flex: 1 },
  name: { ...FONTS.body, fontWeight: '700' },
  chip: { borderWidth: 1.5, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  chipText: { ...FONTS.caption, fontWeight: '700' },
  moreBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    minWidth: 140,
    alignItems: 'center',
  },
  moreText: { ...FONTS.button },
  spinner: { marginTop: SPACING.xxl },
  empty: { alignItems: 'center', marginTop: SPACING.xxl, paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  emptyText: { ...FONTS.body, textAlign: 'center' },
  detailMeta: { ...FONTS.body, marginBottom: SPACING.sm },
  deadRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadIcon: { width: 16, height: 16 },
  trophy: { fontSize: 24 },
});
