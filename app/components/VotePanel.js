import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';

export default function VotePanel({ theme, onVote, myVote, voteCounts, revealed, accusedNickname, disabled }) {
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Vote: Lynch or Spare {accusedNickname}?
      </Text>

      {revealed && voteCounts && (
        <View style={styles.results}>
          <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Results</Text>
          <View style={styles.resultRow}>
            <Text style={[styles.resultCount, { color: theme.danger }]}>⚔️ Lynch: {voteCounts.lynch}</Text>
            <Text style={[styles.resultCount, { color: theme.success }]}>🛡️ Spare: {voteCounts.spare}</Text>
          </View>
        </View>
      )}

      {!revealed && (
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: myVote === 'lynch' ? theme.danger : theme.surfaceAlt, borderColor: theme.danger },
            ]}
            onPress={() => onVote('lynch')}
            disabled={!!myVote || disabled}
          >
            <Text style={[styles.buttonText, { color: myVote === 'lynch' ? '#fff' : theme.danger }]}>
              ⚔️ Lynch
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: myVote === 'spare' ? theme.success : theme.surfaceAlt, borderColor: theme.success },
            ]}
            onPress={() => onVote('spare')}
            disabled={!!myVote || disabled}
          >
            <Text style={[styles.buttonText, { color: myVote === 'spare' ? '#fff' : theme.success }]}>
              🛡️ Spare
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {myVote && !revealed && (
        <Text style={[styles.waiting, { color: theme.textMuted }]}>
          You voted {myVote}. Waiting for others...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  title: {
    ...FONTS.subheading,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buttonText: {
    ...FONTS.button,
  },
  waiting: {
    ...FONTS.caption,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  results: {
    marginBottom: SPACING.md,
  },
  resultLabel: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resultCount: {
    ...FONTS.subheading,
    fontWeight: '700',
  },
});
