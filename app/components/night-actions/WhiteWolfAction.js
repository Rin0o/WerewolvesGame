import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';

const NIGHT_CONFIRM_ICON = require('../../../assets/night_confirm.webp');
const NIGHT_CHECK_ICON   = require('../../../assets/night_check.webp');

export default function WhiteWolfAction({ theme: t, players, target, onSelectTarget, onSubmit, onSkip }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.white_wolf} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Turn on the Pack</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        The pack sleeps. You may devour one of your fellow werewolves — or spare them tonight.
      </Text>

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
              onPress={() => onSelectTarget(target === item.id ? null : item.id)}
              checkIcon={NIGHT_CHECK_ICON}
              noSelectionBorder
            />
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.submitBtn, { opacity: target ? 1 : 0.35 }]}
        onPress={onSubmit}
        disabled={!target}
        activeOpacity={0.8}
      >
        <Image source={NIGHT_CONFIRM_ICON} style={styles.submitBtnImg} resizeMode="contain" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.skipBtn, { borderColor: t.border }]} onPress={onSkip}>
        <Text style={[styles.skipText, { color: t.textSecondary }]}>Spare the pack tonight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  playerRowBg: NIGHT_ROW,
  submitBtn: { alignItems: 'center', marginTop: SPACING.md },
  submitBtnImg: { width: '100%', height: 70 },
  skipBtn: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  skipText: { ...FONTS.button },
});
