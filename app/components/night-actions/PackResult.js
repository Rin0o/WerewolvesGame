import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';

export default function PackResult({ theme: t, result, playerId, onDismiss }) {
  const nameOf = (id) => (id === playerId ? 'You' : result.names[id] || '?');
  const victimName = result.victimId ? result.names[result.victimId] || '?' : null;

  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard, borderColor: t.danger }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.werewolf} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>The Pack Has Chosen</Text>
      </View>

      {victimName ? (
        <View style={[styles.verdict, { borderColor: t.danger }]}>
          <Text style={[styles.victimName, { color: t.danger }]}>{victimName}</Text>
          <Text style={[styles.verdictText, { color: t.text }]}>
            {result.drawnByFate
              ? 'The hunt ran out of time, and fate chose them. They will not see the dawn — unless someone intervenes.'
              : 'They will not see the dawn — unless someone intervenes.'}
          </Text>
        </View>
      ) : (
        <View style={[styles.verdict, { borderColor: t.border }]}>
          <Text style={[styles.verdictText, { color: t.text }]}>
            The pack was split twice. Nobody dies by your fangs tonight.
          </Text>
        </View>
      )}

      {result.votes.length > 0 && (
        <View style={styles.votes}>
          <Text style={[styles.votesLabel, { color: t.textSecondary }]}>Pack votes</Text>
          {result.votes.map(({ targetId, wolfIds }) => (
            <Text key={targetId} style={[styles.voteLine, { color: targetId === result.victimId ? t.danger : t.text }]}>
              {result.names[targetId] || '?'} — {wolfIds.map(nameOf).join(', ')}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: t.primary }]} onPress={onDismiss}>
        <Text style={styles.submitText}>Back to the shadows</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: { ...NIGHT_PANEL, borderWidth: 1.5 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading, flexShrink: 1 },
  verdict: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  victimName: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  verdictText: { ...FONTS.body, textAlign: 'center' },
  votes: { marginTop: SPACING.md, gap: 2 },
  votesLabel: { ...FONTS.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  voteLine: { ...FONTS.body },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
});
