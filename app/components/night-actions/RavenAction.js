import React from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';
import { RAVEN_VOTES } from '../../game-logic/voteManager';

const NIGHT_CHECK_ICON = require('../../../assets/night_check.webp');

export default function RavenAction({ theme: t, players, target, onSelectTarget, onSubmit, onSkip }) {
  const targetName = players.find((p) => p.id === target)?.nickname;
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.raven} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Mark a Suspect</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        At dawn the whole village learns who you marked, but not who you are. They start the vote with {RAVEN_VOTES} votes against them.
      </Text>
      <View style={[styles.targetBanner, { borderColor: target ? t.primary : t.border }]}>
        <Text style={[styles.bannerStateLabel, { color: target ? t.textSecondary : t.textMuted }]}>
          {target ? `Marking (+${RAVEN_VOTES} votes)` : 'Select the player to mark'}
        </Text>
        {target && <Text style={[styles.bannerTargetName, { color: t.accent }]}>{targetName}</Text>}
      </View>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.playerRowBg, { borderColor: target === item.id ? t.danger : t.border }]}>
            <PlayerCard
              player={item}
              theme={{ ...t, surface: 'transparent', border: 'transparent' }}
              selected={target === item.id}
              onPress={() => onSelectTarget(item.id)}
              checkIcon={NIGHT_CHECK_ICON}
              noSelectionBorder
            />
          </View>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: target ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!target}
      >
        <Text style={styles.submitText}>Mark This Player</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.skipBtn, { borderColor: t.border }]} onPress={onSkip}>
        <Text style={[styles.skipText, { color: t.textSecondary }]}>Mark no one tonight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading, flexShrink: 1 },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  targetBanner: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  bannerStateLabel: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bannerTargetName: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  playerRowBg: NIGHT_ROW,
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  skipBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  skipText: { ...FONTS.button },
});
