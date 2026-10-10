import React from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';

export default function SaviourAction({ theme: t, players, lastProtected, saviourTarget, onSelectTarget, onSubmit }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        {ROLE_ICONS.saviour ? (
          <Image source={ROLE_ICONS.saviour} style={styles.actionTitleIcon} resizeMode="contain" />
        ) : (
          <Text style={styles.actionTitleEmoji}>🛡️</Text>
        )}
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Someone to Protect</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        Your chosen player cannot be killed by the werewolves tonight.
      </Text>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const isLastProtected = item.id === lastProtected;
          return (
            <View style={isLastProtected && styles.disabledRow}>
              <View style={[styles.playerRowBg, { borderColor: saviourTarget === item.id ? t.primary : t.border }]}>
                <PlayerCard
                  player={item}
                  theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                  selected={saviourTarget === item.id}
                  onPress={isLastProtected ? undefined : () => onSelectTarget(item.id)}
                />
              </View>
              {isLastProtected && (
                <View style={styles.protectedBadge}>
                  <Text style={[styles.protectedText, { color: t.textMuted }]}>Protected last night</Text>
                </View>
              )}
            </View>
          );
        }}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: saviourTarget ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!saviourTarget}
      >
        <Text style={styles.submitText}>Protect This Player</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitleEmoji: { fontSize: 28 },
  actionTitle: { ...FONTS.heading },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  playerRowBg: { marginBottom: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 2, backgroundColor: 'rgba(20,10,50,0.82)' },
  disabledRow: { opacity: 0.45 },
  protectedBadge: { alignItems: 'center', marginTop: -SPACING.xs, marginBottom: SPACING.xs },
  protectedText: { ...FONTS.caption, fontStyle: 'italic' },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
});
