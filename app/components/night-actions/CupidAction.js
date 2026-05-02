import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';

const PLAYER_ROW_NIGHT = require('../../../assets/player_row_night.png');

export default function CupidAction({ theme: t, players, cupidTargets, onToggleTarget, onSubmit }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.cupid} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Two Lovers</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        Select exactly 2 players to bind together. If one dies, the other follows.
        {cupidTargets.length > 0 ? ` (${cupidTargets.length}/2 selected)` : ''}
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
              selected={cupidTargets.includes(item.id)}
              onPress={() => onToggleTarget(item.id)}
            />
          </ImageBackground>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: cupidTargets.length === 2 ? t.accent : t.border }]}
        onPress={onSubmit}
        disabled={cupidTargets.length !== 2}
      >
        <View style={styles.btnIconRow}>
          <Image source={ROLE_ICONS.cupid} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.submitText}>Bind Their Hearts</Text>
        </View>
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
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
});
