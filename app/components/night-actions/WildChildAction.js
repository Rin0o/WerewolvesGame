import React from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';

const NIGHT_CHECK_ICON = require('../../../assets/night_check.webp');

export default function WildChildAction({ theme: t, players, model, onSelectModel, onSubmit }) {
  const modelName = players.find((p) => p.id === model)?.nickname;
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.wild_child} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Your Role Model</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        While your role model lives, you are a villager. If they die, by any means, you become a Werewolf and join the pack.
      </Text>
      <View style={[styles.targetBanner, { borderColor: model ? t.primary : t.border }]}>
        <Text style={[styles.bannerStateLabel, { color: model ? t.textSecondary : t.textMuted }]}>
          {model ? 'Your role model' : 'Select the player you admire'}
        </Text>
        {model && <Text style={[styles.bannerTargetName, { color: t.accent }]}>{modelName}</Text>}
      </View>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.playerRowBg, { borderColor: model === item.id ? t.primary : t.border }]}>
            <PlayerCard
              player={item}
              theme={{ ...t, surface: 'transparent', border: 'transparent' }}
              selected={model === item.id}
              onPress={() => onSelectModel(item.id)}
              checkIcon={NIGHT_CHECK_ICON}
              noSelectionBorder
            />
          </View>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: model ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!model}
      >
        <Text style={styles.submitText}>Follow This Player</Text>
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
});
