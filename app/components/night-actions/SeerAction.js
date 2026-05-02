import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';

const PLAYER_ROW_NIGHT = require('../../../assets/player_row_night.png');

export default function SeerAction({ theme: t, players, seerTarget, onSelectTarget, onSubmit, seerResult, onDismissResult }) {
  if (seerResult) {
    return (
      <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
        <View style={styles.actionTitleRow}>
          <Image source={ROLE_ICONS.seer} style={styles.actionTitleIcon} resizeMode="contain" />
          <Text style={[styles.actionTitle, { color: t.accent }]}>Your Vision</Text>
        </View>
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>
          {players.find((p) => p.id === seerTarget)?.nickname || 'That player'} is...
        </Text>
        <View style={[styles.seerResult, { backgroundColor: t.surfaceAlt, borderColor: t.primary }]}>
          <Text style={[styles.seerResultText, { color: t.text }]}>{seerResult}</Text>
        </View>
        <Text style={[styles.actionSub, { color: t.textMuted, marginTop: SPACING.sm }]}>
          Remember this. Dawn will come soon.
        </Text>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: t.primary, marginTop: SPACING.md }]}
          onPress={onDismissResult}
        >
          <Text style={styles.submitText}>Got it — I'm ready</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.seer} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Someone to Reveal</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        You will learn if they are a Werewolf.
      </Text>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <ImageBackground source={PLAYER_ROW_NIGHT} style={styles.playerRowBg} imageStyle={styles.playerRowImg} resizeMode="stretch">
            <PlayerCard
              player={item}
              theme={{ ...t, surface: 'transparent', border: 'transparent' }}
              selected={seerTarget === item.id}
              onPress={() => onSelectTarget(item.id)}
            />
          </ImageBackground>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: seerTarget ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!seerTarget}
      >
        <Text style={styles.submitText}>Reveal Their Nature</Text>
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
  actionTitle: { ...FONTS.heading },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden' },
  playerRowImg: { borderRadius: RADIUS.md },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  seerResult: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  seerResultText: { ...FONTS.heading, textAlign: 'center' },
});
