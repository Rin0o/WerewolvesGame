import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';

export default function NightAnnouncement({ theme: t, nightVictims, roles, bearTamerGrowl }) {
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
        <Text style={[styles.growl, { color: t.text }]}>🐻 The bears growled at dawn.</Text>
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
  growl: { ...FONTS.body, textAlign: 'center', fontStyle: 'italic', marginTop: SPACING.xs },
});
