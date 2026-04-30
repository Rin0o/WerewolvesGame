import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';

const LYNCH_BTN = require('../../assets/lynch_btn.png');
const SAVE_BTN = require('../../assets/save_btn.png');

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
            style={styles.button}
            onPress={() => onVote('lynch')}
            disabled={!!myVote || disabled}
            activeOpacity={0.8}
          >
            <Image
              source={LYNCH_BTN}
              style={[styles.buttonImage, myVote && myVote !== 'lynch' && styles.buttonDimmed]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => onVote('spare')}
            disabled={!!myVote || disabled}
            activeOpacity={0.8}
          >
            <Image
              source={SAVE_BTN}
              style={[styles.buttonImage, myVote && myVote !== 'spare' && styles.buttonDimmed]}
              resizeMode="contain"
            />
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
    alignItems: 'center',
  },
  buttonImage: {
    width: '100%',
    height: 80,
  },
  buttonDimmed: {
    opacity: 0.3,
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
