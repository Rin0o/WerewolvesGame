import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Modal, StyleSheet, ScrollView } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { ROLE_ICONS } from '../../constants/icons';

const DISPLAY_SECONDS = 8;

export default function LynchResultModal({ visible, onExpire, theme: t, result, players, roles, willRevote = false }) {
  const [countdown, setCountdown] = useState(DISPLAY_SECONDS);
  const countRef = useRef(DISPLAY_SECONDS);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!visible) {
      countRef.current = DISPLAY_SECONDS;
      setCountdown(DISPLAY_SECONDS);
      return;
    }
    countRef.current = DISPLAY_SECONDS;
    setCountdown(DISPLAY_SECONDS);
    const interval = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        clearInterval(interval);
        onExpireRef.current?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!result) return null;
  const { tallyMap, eliminatedId, tie, votes } = result;

  const sortedEntries = Object.entries(tallyMap).sort(([, a], [, b]) => b - a);
  const totalVotes = sortedEntries.reduce((sum, [, c]) => sum + c, 0);
  const eliminatedPlayer = eliminatedId ? players.find((p) => p.id === eliminatedId) : null;
  const roleKey = eliminatedId ? roles?.[eliminatedId] : null;
  const roleInfo = roleKey ? ROLE_DEFINITIONS[roleKey] : null;

  const isLynch = !!eliminatedId;
  const isTie = !eliminatedId && tie;

  const teamColor = roleInfo?.team === 'werewolves' ? t.danger : t.success;
  const teamLabel = roleInfo?.team === 'werewolves' ? 'Werewolf Team' : 'Village Team';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: isLynch ? t.danger : t.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            <Text style={[styles.header, { color: t.textSecondary }]}>
              {isLynch ? 'THE VILLAGE HAS DECIDED' : isTie ? 'THE VOTE IS TIED' : 'NO VERDICT'}
            </Text>

            {eliminatedPlayer ? (
              <>
                {roleKey && ROLE_ICONS[roleKey] ? (
                  <Image source={ROLE_ICONS[roleKey]} style={styles.roleIcon} resizeMode="contain" />
                ) : roleInfo ? (
                  <Text style={styles.roleEmoji}>{roleInfo.emoji}</Text>
                ) : null}
                <Text style={[styles.victimName, { color: t.danger }]}>{eliminatedPlayer.nickname}</Text>
                <Text style={[styles.verdictChip, { color: t.danger }]}>⚔️ LYNCHED</Text>

                {roleInfo && (
                  <View style={[styles.roleRevealCard, { borderColor: teamColor, backgroundColor: `${teamColor}18` }]}>
                    <View style={[styles.teamBadge, { backgroundColor: teamColor }]}>
                      <Text style={styles.teamBadgeText}>{teamLabel}</Text>
                    </View>
                    <Text style={[styles.roleRevealName, { color: t.text }]}>
                      The <Text style={{ fontWeight: '800' }}>{roleInfo.name}</Text>
                    </Text>
                    <Text style={[styles.roleDescription, { color: t.textSecondary }]}>
                      {roleInfo.description}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.noVictimEmoji}>{isTie ? '⚖️' : '🌫️'}</Text>
                <Text style={[styles.noVictimText, { color: t.textMuted }]}>
                  {isTie && willRevote
                    ? 'The vote is tied. The village will vote again between the tied players.'
                    : isTie
                      ? 'The village could not reach a decision.'
                      : 'The village remained silent.'}
                </Text>
              </>
            )}

            {sortedEntries.length > 0 && (
              <View style={[styles.tallyBox, { borderTopColor: t.border }]}>
                <Text style={[styles.tallyTitle, { color: t.textSecondary }]}>VOTE BREAKDOWN</Text>
                {sortedEntries.map(([targetId, count]) => {
                  const targetName = players.find((p) => p.id === targetId)?.nickname || '?';
                  const isEliminated = targetId === eliminatedId;
                  const barColor = isEliminated ? t.danger : t.accent;
                  const barPct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                  const voters = Object.entries(votes)
                    .filter(([, v]) => v?.confirmed && v?.target === targetId)
                    .map(([vid]) => ({ id: vid, nickname: players.find((p) => p.id === vid)?.nickname || '?' }));

                  return (
                    <View key={targetId} style={[styles.tallyRow, { borderColor: isEliminated ? `${t.danger}40` : `${t.border}80` }]}>
                      <View style={styles.tallyRowHeader}>
                        <Text style={[styles.tallyName, { color: isEliminated ? t.danger : t.text }]}>
                          {targetName}
                        </Text>
                        <Text style={[styles.tallyCount, { color: isEliminated ? t.danger : t.textSecondary }]}>
                          {count} vote{count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={[styles.voteBarBg, { backgroundColor: t.border }]}>
                        <View style={[styles.voteBarFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
                      </View>
                      {voters.length > 0 && (
                        <View style={styles.voterChipRow}>
                          {voters.map(({ id, nickname }) => (
                            <View key={id} style={[styles.voterChip, { borderColor: isEliminated ? `${t.danger}60` : t.border, backgroundColor: isEliminated ? `${t.danger}12` : t.glassBg }]}>
                              <Text style={[styles.voterChipText, { color: isEliminated ? t.danger : t.textMuted }]}>
                                {nickname}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={[styles.countdown, { color: t.textMuted }]}>
              {countdown > 0 ? `Continuing in ${countdown}…` : 'Continuing…'}
            </Text>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,10,5,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  header: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleIcon: { width: 96, height: 96, marginVertical: SPACING.sm },
  roleEmoji: { fontSize: 72 },
  victimName: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  verdictChip: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  roleRevealCard: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  teamBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginBottom: SPACING.xs,
  },
  teamBadgeText: {
    ...FONTS.caption,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roleRevealName: { ...FONTS.body, textAlign: 'center' },
  roleDescription: { ...FONTS.caption, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  noVictimEmoji: { fontSize: 64 },
  noVictimText: { ...FONTS.body, textAlign: 'center' },
  tallyBox: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  tallyTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    alignSelf: 'center',
  },
  tallyRow: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  tallyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tallyName: { ...FONTS.body, fontWeight: '700' },
  tallyCount: { ...FONTS.caption, fontWeight: '600' },
  voteBarBg: {
    width: '100%',
    height: 6,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  voteBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  voterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 2,
  },
  voterChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  voterChipText: {
    ...FONTS.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  countdown: {
    ...FONTS.caption,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
});
