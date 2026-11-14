import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { replayRounds } from '../utils/replay';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const SECRET_COLOR = '#8A63D2';

export default function GameReplay({ room, theme: t }) {
  const { intro, rounds } = replayRounds(room);
  const [open, setOpen] = useState(() => new Set());

  function toggle(key) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (rounds.length === 0 && intro.length === 0) {
    return <Text style={[styles.empty, { color: t.textMuted }]}>No events recorded.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {intro.map((line, i) => (
        <Text key={`intro-${i}`} style={[styles.intro, { color: t.textMuted }]}>{line}</Text>
      ))}
      <Text style={[styles.legend, { color: t.textMuted }]}>
        <Text style={{ color: SECRET_COLOR, fontWeight: '700' }}>🔒 Secret</Text> lines were hidden during the game. Tap a round to open it.
      </Text>
      {rounds.map((round) => {
        const isOpen = open.has(round.key);
        const isNight = round.key.startsWith('night');
        return (
          <View key={round.key} style={[styles.round, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <TouchableOpacity style={styles.roundHeader} onPress={() => toggle(round.key)} accessibilityRole="button">
              <Text style={[styles.roundTitle, { color: t.text }]}>{isNight ? '🌙' : '☀️'} {round.title}</Text>
              <Text style={[styles.chevron, { color: t.textMuted }]}>{isOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isOpen && round.lines.map((line, i) => (
              <View
                key={i}
                style={[styles.line, { borderLeftColor: line.secret ? SECRET_COLOR : t.primary }]}
              >
                <Text style={[styles.lineText, { color: t.text }]}>
                  {line.secret && <Text style={{ color: SECRET_COLOR }}>🔒 </Text>}
                  {line.text}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  empty: { ...FONTS.caption, fontStyle: 'italic' },
  intro: { ...FONTS.caption },
  legend: { ...FONTS.caption, marginBottom: SPACING.xs },
  round: { borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs },
  roundHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  roundTitle: { ...FONTS.body, fontWeight: '700' },
  chevron: { ...FONTS.caption },
  line: { borderLeftWidth: 2, paddingLeft: SPACING.sm, marginBottom: SPACING.xs },
  lineText: { ...FONTS.caption, lineHeight: 18 },
});
