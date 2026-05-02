import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { ROLE_ICONS } from '../../constants/icons';

export default function LynchResultCard({ theme: t, result, players, roles }) {
  const { lynched, accusedNickname, accusedId, votes } = result;

  return (
    <View style={[
      styles.card,
      {
        borderColor: lynched ? t.danger : t.success,
        backgroundColor: lynched ? t.glassLynched : t.glassSpared,
      },
    ]}>
      <Text style={[styles.verdict, { color: lynched ? t.danger : t.success }]}>
        {lynched ? '⚔️ Lynched' : '🛡️ Spared'}
      </Text>
      <Text style={[styles.name, { color: t.text }]}>{accusedNickname}</Text>

      <View style={styles.tally}>
        <Text style={[styles.tallyItem, { color: t.danger }]}>
          ⚔️ {Object.values(votes).filter((v) => v === 'lynch').length} lynch
        </Text>
        <Text style={[styles.tallyItem, { color: t.success }]}>
          🛡️ {Object.values(votes).filter((v) => v === 'spare').length} spare
        </Text>
      </View>

      {['lynch', 'spare'].map((decision) => {
        const names = Object.entries(votes)
          .filter(([, v]) => v === decision)
          .map(([id]) => players.find((p) => p.id === id)?.nickname || '?')
          .join(', ');
        if (!names) return null;
        return (
          <Text key={decision} style={[styles.voterRow, { color: decision === 'lynch' ? t.danger : t.success }]}>
            {decision === 'lynch' ? '⚔️' : '🛡️'} {names}
          </Text>
        );
      })}

      {lynched && roles[accusedId] && (() => {
        const roleKey = roles[accusedId];
        const info = ROLE_DEFINITIONS[roleKey];
        return (
          <View style={styles.roleRow}>
            <Text style={[styles.roleLabel, { color: t.textSecondary }]}>They were</Text>
            {ROLE_ICONS[roleKey] ? (
              <Image source={ROLE_ICONS[roleKey]} style={styles.roleIcon} resizeMode="contain" />
            ) : (
              <Text style={[styles.roleLabel, { color: t.textSecondary }]}>{info?.emoji}</Text>
            )}
            <Text style={[styles.roleLabel, { color: t.textSecondary }]}>{info?.name}</Text>
          </View>
        );
      })()}
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
  tally: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  tallyItem: { ...FONTS.subheading, fontWeight: '700' },
  voterRow: { ...FONTS.caption, lineHeight: 18 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  roleIcon: { width: 26, height: 26 },
  roleLabel: { ...FONTS.body },
});
