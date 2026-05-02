import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';

const PLAYER_ROW_NIGHT = require('../../../assets/player_row_night.png');

export default function WerewolfAction({ theme: t, players, phase, wolfTarget, onSelectTarget, onSubmit, onOpenChat }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.werewolf} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>
          {phase === 1 ? 'First Night — Observe' : 'Choose a Victim'}
        </Text>
      </View>

      {phase === 1 ? (
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>
          The first night is for watching. No hunt tonight — coordinate with your pack.
        </Text>
      ) : (
        <>
          <Text style={[styles.actionSub, { color: t.textSecondary }]}>
            Pick a player to eliminate tonight.
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
                  selected={wolfTarget === item.id}
                  onPress={() => onSelectTarget(item.id)}
                />
              </ImageBackground>
            )}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: wolfTarget ? t.danger : t.border }]}
            onPress={onSubmit}
            disabled={!wolfTarget}
          >
            <Text style={styles.submitText}>Confirm Kill</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.chatBtn, { borderColor: t.primary }]}
        onPress={onOpenChat}
      >
        <View style={styles.btnIconRow}>
          <Image source={ROLE_ICONS.werewolf} style={styles.btnIcon} resizeMode="contain" />
          <Text style={[styles.chatBtnText, { color: t.accent }]}>Open Wolf Chat</Text>
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
  chatBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderWidth: 1.5,
  },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
  chatBtnText: { ...FONTS.button },
});
