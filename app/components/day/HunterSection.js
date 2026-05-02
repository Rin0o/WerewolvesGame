import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';

const PLAYER_ROW_DAY = require('../../../assets/player_row_day.png');

export default function HunterSection({ theme: t, players, playerId, hunterTriggered, hunterTarget, onSelectTarget, onSubmit }) {
  return (
    <View style={[styles.hunterBox, { backgroundColor: t.glassBg, borderColor: t.accent }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.hunter} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.hunterTitle, { color: t.primary }]}>The Hunter's Final Shot</Text>
      </View>
      <Text style={[styles.hunterSub, { color: t.textSecondary }]}>
        {hunterTriggered === playerId
          ? 'You are the Hunter! Choose someone to take down with you.'
          : `${players.find((p) => p.id === hunterTriggered)?.nickname} is the Hunter — choosing their final target...`}
      </Text>

      {hunterTriggered === playerId && (
        <>
          <FlatList
            data={players.filter((p) => p.isAlive && p.id !== playerId)}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <ImageBackground source={PLAYER_ROW_DAY} style={styles.playerRowBg} imageStyle={styles.playerRowImg} resizeMode="stretch">
                <PlayerCard
                  player={item}
                  theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                  selected={hunterTarget === item.id}
                  onPress={() => onSelectTarget(item.id)}
                />
              </ImageBackground>
            )}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: hunterTarget ? t.danger : t.border }]}
            onPress={onSubmit}
            disabled={!hunterTarget}
          >
            <View style={styles.btnIconRow}>
              <Image source={ROLE_ICONS.hunter} style={styles.btnIcon} resizeMode="contain" />
              <Text style={styles.submitBtnText}>Fire!</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hunterBox: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
  },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  actionTitleIcon: { width: 40, height: 40 },
  hunterTitle: { ...FONTS.heading, marginBottom: SPACING.xs },
  hunterSub: { ...FONTS.body, marginBottom: SPACING.md },
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden' },
  playerRowImg: { borderRadius: RADIUS.md },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitBtnText: { ...FONTS.button, color: '#fff' },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
});
