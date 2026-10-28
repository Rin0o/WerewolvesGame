import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { tallyVotes } from '../../game-logic/voteManager';

export default function NarratorDayDashboard({
  theme: t,
  players,
  roles,
  votes,
  voters,
  phase,
  onCloseVotes,
  lastLynchResult,
  hunterTriggered,
}) {
  const confirmedCount = Object.values(votes).filter((v) => v?.confirmed).length;
  const { tallyMap } = tallyVotes(votes);
  const sortedTally = Object.entries(tallyMap).sort(([, a], [, b]) => b - a);
  const maxVotes = sortedTally.length > 0 ? sortedTally[0][1] : 0;

  return (
    <View style={[styles.dashboard, { backgroundColor: t.glassCard, borderColor: t.primary }]}>

      <View style={[styles.narratorBadge, { backgroundColor: t.primary }]}>
        <Text style={styles.narratorBadgeText}>📖 NARRATOR VIEW</Text>
      </View>

      {/* Per-voter breakdown */}
      <View style={[styles.section, { borderColor: t.border }]}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
          VOTES — {confirmedCount}/{voters.length} CONFIRMED
        </Text>
        {voters.map((voter) => {
          const vote = votes[voter.id];
          const target = vote?.target ? players.find((p) => p.id === vote.target) : null;
          const confirmed = vote?.confirmed === true;
          return (
            <View key={voter.id} style={styles.voterRow}>
              <Text style={[styles.voterName, { color: t.text }]} numberOfLines={1}>
                {voter.nickname}
              </Text>
              <Text style={[styles.arrow, { color: t.textMuted }]}>→</Text>
              {confirmed ? (
                <Text style={[styles.targetName, { color: t.danger, fontWeight: '700' }]} numberOfLines={1}>
                  {target?.nickname || '?'}
                </Text>
              ) : target ? (
                <Text style={[styles.targetName, { color: t.textMuted, fontStyle: 'italic' }]} numberOfLines={1}>
                  {target?.nickname} (pending)
                </Text>
              ) : (
                <Text style={[styles.targetName, { color: t.textMuted }]}>—</Text>
              )}
              {confirmed && <Text style={[styles.checkMark, { color: t.success }]}>✓</Text>}
            </View>
          );
        })}
      </View>

      {/* Tally summary */}
      {sortedTally.length > 0 && (
        <View style={[styles.section, { borderColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>TALLY</Text>
          {sortedTally.map(([targetId, count]) => {
            const target = players.find((p) => p.id === targetId);
            const roleDef = ROLE_DEFINITIONS[roles[targetId]];
            const fillPct = maxVotes > 0 ? count / maxVotes : 0;
            return (
              <View key={targetId} style={styles.tallyRow}>
                <Text style={[styles.tallyName, { color: t.text }]} numberOfLines={1}>
                  {target?.nickname || '?'}
                </Text>
                {roleDef && (
                  <Text style={[styles.tallyRole, { color: t.textMuted }]}> ({roleDef.name})</Text>
                )}
                <View style={[styles.barTrack, { backgroundColor: t.border }]}>
                  <View style={[styles.barFill, { flex: fillPct, backgroundColor: t.danger }]} />
                  <View style={{ flex: 1 - fillPct }} />
                </View>
                <Text style={[styles.tallyCount, { color: t.danger }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {!lastLynchResult && !hunterTriggered && (
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: t.danger }]}
          onPress={onCloseVotes}
          activeOpacity={0.8}
        >
          <Text style={styles.closeBtnText}>Close Votes</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    margin: SPACING.md,
    marginBottom: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  narratorBadge: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  narratorBadgeText: {
    ...FONTS.caption,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  section: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  sectionTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: SPACING.xs,
  },
  voterName: {
    ...FONTS.body,
    width: 90,
  },
  arrow: {
    ...FONTS.caption,
  },
  targetName: {
    ...FONTS.body,
    flex: 1,
  },
  checkMark: {
    ...FONTS.body,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 3,
  },
  tallyName: {
    ...FONTS.body,
    width: 80,
  },
  tallyRole: {
    ...FONTS.caption,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    borderRadius: 4,
  },
  tallyCount: {
    ...FONTS.body,
    fontWeight: '700',
    width: 20,
    textAlign: 'right',
  },
  closeBtn: {
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  closeBtnText: {
    ...FONTS.button,
    color: '#fff',
  },
});
