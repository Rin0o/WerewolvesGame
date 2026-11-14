import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';

const PRIVATE_COLOR = '#8A63D2';

export default function ClueLog({ events = [], clues = [], theme }) {
  return (
    <View style={styles.wrap}>
      {clues.length > 0 && (
        <View style={[styles.container, styles.privateBox, { backgroundColor: theme.surfaceAlt, borderColor: PRIVATE_COLOR }]}>
          <Text style={[styles.title, { color: PRIVATE_COLOR }]}>👁 Your clues · only you can see this</Text>
          {[...clues].reverse().map((c) => (
            <View key={c.key} style={[styles.entry, { borderLeftColor: PRIVATE_COLOR }]}>
              <Text style={[styles.text, { color: theme.text }]}>{c.text}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={[styles.container, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>📋 Clue Log</Text>
        {events.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>No events yet.</Text>
        ) : (
          [...events].reverse().map((e, i) => (
            <View key={i} style={[styles.entry, { borderLeftColor: theme.primary }]}>
              <Text style={[styles.text, { color: theme.text }]}>{e}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  container: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  privateBox: { borderWidth: 1.5, borderStyle: 'dashed' },
  title: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    fontWeight: '700',
  },
  empty: {
    ...FONTS.caption,
    fontStyle: 'italic',
  },
  entry: {
    borderLeftWidth: 2,
    paddingLeft: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  text: {
    ...FONTS.caption,
    lineHeight: 18,
  },
});
