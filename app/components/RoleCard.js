import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getRoleInfo } from '../game-logic/roles';
import { NIGHT, RADIUS, SPACING, FONTS } from '../constants/theme';

const ROLE_IMAGES = {
  villager: require('../../assets/roles/villager.png'),
  werewolf: require('../../assets/roles/werewolf.png'),
  seer: require('../../assets/roles/seer.png'),
  witch: require('../../assets/roles/witch.png'),
  hunter: require('../../assets/roles/hunter.png'),
  thief: require('../../assets/roles/thief.png'),
  cupid: require('../../assets/roles/cupid.png'),
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
      <Text style={styles.name}>{info.name}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>Description</Text>
      <Text style={styles.text}>{info.description}</Text>
      <Text style={styles.label}>Your Goal</Text>
      <Text style={styles.text}>{info.goal}</Text>
      {info.ability && (
        <>
          <Text style={styles.label}>Special Ability</Text>
          <Text style={styles.text}>{info.ability}</Text>
        </>
      )}
      {wolves.length > 0 && (
        <View style={styles.wolvesBox}>
          <Text style={styles.wolvesLabel}>🐺 Fellow Werewolves</Text>
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
    padding: SPACING.xl,
    margin: SPACING.md,
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
    height: 260,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  name: {
    ...FONTS.title,
    color: NIGHT.accent,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: NIGHT.border,
    marginVertical: SPACING.md,
  },
  label: {
    ...FONTS.caption,
    color: NIGHT.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  text: {
    ...FONTS.body,
    color: NIGHT.text,
    lineHeight: 22,
  },
  wolvesBox: {
    marginTop: SPACING.lg,
    backgroundColor: 'rgba(123,79,212,0.2)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: NIGHT.primary,
  },
  wolvesLabel: {
    ...FONTS.subheading,
    color: NIGHT.accent,
    marginBottom: SPACING.sm,
  },
  wolfName: {
    ...FONTS.body,
    color: NIGHT.text,
  },
});
