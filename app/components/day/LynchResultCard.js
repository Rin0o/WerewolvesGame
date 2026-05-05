import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { ROLE_ICONS } from '../../constants/icons';

export default function LynchResultCard({ theme: t, result, players, roles }) {
  const { tallyMap, eliminatedId, tie, votes } = result;

  const sortedEntries = Object.entries(tallyMap).sort(([, a], [, b]) => b - a);
  const verdict = eliminatedId ? '⚔️ Lynched' : tie ? '⚖️ Tied — No Verdict' : '🌫️ No Votes Cast';
  const eliminatedPlayer = eliminatedId ? players.find((p) => p.id === eliminatedId) : null;
  const roleKey = eliminatedId ? roles?.[eliminatedId] : null;
  const roleInfo = roleKey ? ROLE_DEFINITIONS[roleKey] : null;

  return (
    <View style={[styles.card, { borderColor: eliminatedId ? t.danger : t.textSecondary, backgroundColor: eliminatedId ? t.glassLynched : t.glassCard }]}>
      <Text style={[styles.verdict, { color: eliminatedId ? t.danger : t.textSecondary }]}>
        {verdict}
      </Text>

      {eliminatedPlayer && (
        <Text style={[styles.name, { color: t.text }]}>{eliminatedPlayer.nickname}</Text>
      )}

      {roleInfo && (
        <View style={styles.roleRow}>
          <Text style={[styles.roleLabel, { color: t.textSecondary }]}>They were the</Text>
          {ROLE_ICONS[roleKey] ? (
            <Image source={ROLE_ICONS[roleKey]} style={styles.roleIcon} resizeMode="contain" />
          ) : (
            <Text style={[styles.roleLabel, { color: t.textSecondary }]}>{roleInfo.emoji}</Text>
          )}
          <Text style={[styles.roleLabel, { color: t.textSecondary }]}>{roleInfo.name}</Text>
        </View>
      )}

      {sortedEntries.length > 0 && (
        <View style={[styles.tallySection, { borderTopColor: t.border }]}>
          {sortedEntries.map(([targetId, count]) => {
            const targetName = players.find((p) => p.id === targetId)?.nickname || '?';
            const voterNames = Object.entries(votes)
              .filter(([, v]) => v?.confirmed && v?.target === targetId)
              .map(([vid]) => players.find((p) => p.id === vid)?.nickname || '?')
              .join(', ');
            return (
              <View key={targetId} style={styles.tallyRow}>
                <Text style={[styles.tallyName, { color: targetId === eliminatedId ? t.danger : t.text }]}>
                  {targetName} — {count} vote{count !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.voterNames, { color: t.textMuted }]}>{voterNames}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    gap: SPACING.xs,
  },
  verdict: { ...FONTS.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  name: { ...FONTS.heading },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleIcon: { width: 26, height: 26 },
  roleLabel: { ...FONTS.body },
  tallySection: { marginTop: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: 1, gap: SPACING.xs },
  tallyRow: { gap: 2 },
  tallyName: { ...FONTS.body, fontWeight: '600' },
  voterNames: { ...FONTS.caption, lineHeight: 16 },
});
