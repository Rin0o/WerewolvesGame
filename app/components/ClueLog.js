import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';

export default function ClueLog({ events = [], theme }) {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
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
