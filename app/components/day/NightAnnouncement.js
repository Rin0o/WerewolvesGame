import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';
import { RAVEN_VOTES } from '../../game-logic/voteManager';

const BEAR_GROWL_ICON = require('../../../assets/bear_growl.webp');

export default function NightAnnouncement({ theme: t, nightVictims, roles, bearTamerGrowl, ravenMarked = null }) {
  return (
    <View style={[styles.box, { backgroundColor: t.glassBg }]}>
      {nightVictims.length > 0 ? (
        nightVictims.map((v) => (
          <Text key={v.id} style={[styles.text, { color: t.text }]}>
            {v.nickname} was found dead. They were a {roles[v.id] || '?'}.
          </Text>
        ))
      ) : (
        <Text style={[styles.text, { color: t.textSecondary }]}>No one was eliminated last night.</Text>
      )}
      {bearTamerGrowl === true && (
        <View style={styles.growlRow}>
          <Image source={BEAR_GROWL_ICON} style={styles.growlIcon} resizeMode="contain" />
          <Text style={[styles.growl, { color: t.text }]}>The bears growled at dawn.</Text>
        </View>
      )}
      {ravenMarked && (
        <View style={styles.growlRow}>
          <Image source={ROLE_ICONS.raven} style={styles.growlIcon} resizeMode="contain" />
          <Text style={[styles.growl, styles.ravenText, { color: t.text }]}>
            The raven has marked <Text style={styles.ravenName}>{ravenMarked.nickname}</Text>: they start today's vote with {RAVEN_VOTES} votes against them.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    margin: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  text: { ...FONTS.body, textAlign: 'center' },
  growlRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  growlIcon: { width: 44, height: 44 },
  growl: { ...FONTS.body, textAlign: 'center', fontStyle: 'italic' },
  ravenText: { flexShrink: 1 },
  ravenName: { fontWeight: '800', fontStyle: 'normal' },
});
