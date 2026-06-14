import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getRoleInfo } from '../game-logic/roles';
import { NIGHT, RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_ICONS } from '../constants/icons';

const ROLE_IMAGES = {
  villager: require('../../assets/roles/villager.png'),
  werewolf: require('../../assets/roles/werewolf.png'),
  seer: require('../../assets/roles/seer.png'),
  witch: require('../../assets/roles/witch.png'),
  hunter: require('../../assets/roles/hunter.png'),
  thief: require('../../assets/roles/thief.png'),
  cupid:      require('../../assets/roles/cupid.png'),
  saviour:    require('../../assets/roles/saviour.png'),
  bear_tamer: require('../../assets/roles/bear_tamer.png'),
};

export default function RoleCard({ role, fellowWolves = [], players = [] }) {
  const info = getRoleInfo(role);
  const wolves = fellowWolves
    .map((id) => players.find((p) => p.id === id)?.nickname || id)
    .filter(Boolean);
  const image = ROLE_IMAGES[role] || null;

  return (
    <View style={styles.card}>
      {image ? (
        <Image source={image} style={styles.roleImage} resizeMode="contain" />
      ) : (
        <Text style={styles.emoji}>{info.emoji}</Text>
      )}
      {wolves.length > 0 && (
        <View style={styles.wolvesBox}>
          <View style={styles.wolvesLabelRow}>
            <Image source={ROLE_ICONS.werewolf} style={styles.wolvesLabelIcon} resizeMode="contain" />
            <Text style={styles.wolvesLabel}>Fellow Werewolves</Text>
          </View>
          {wolves.map((name) => (
            <Text key={name} style={styles.wolfName}>• {name}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NIGHT.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    margin: SPACING.xs,
    borderWidth: 2,
    borderColor: NIGHT.primary,
    shadowColor: NIGHT.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  roleImage: {
    width: '100%',
    height: 480,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  wolvesBox: {
    marginTop: SPACING.lg,
    backgroundColor: 'rgba(123,79,212,0.2)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: NIGHT.primary,
  },
  wolvesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  wolvesLabelIcon: { width: 32, height: 32 },
  wolvesLabel: { ...FONTS.subheading, color: NIGHT.accent },
  wolfName: {
    ...FONTS.body,
    color: NIGHT.text,
  },
});
