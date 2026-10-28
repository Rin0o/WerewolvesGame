import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getRoleInfo } from '../game-logic/roles';
import { NIGHT, RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_ICONS } from '../constants/icons';

const ROLE_IMAGES = {
  villager: require('../../assets/roles/villager.webp'),
  werewolf: require('../../assets/roles/werewolf.webp'),
  seer: require('../../assets/roles/seer.webp'),
  witch: require('../../assets/roles/witch.webp'),
  hunter: require('../../assets/roles/hunter.webp'),
  thief: require('../../assets/roles/thief.webp'),
  cupid:      require('../../assets/roles/cupid.webp'),
  saviour:    require('../../assets/roles/saviour.webp'),
  bear_tamer: require('../../assets/roles/bear_tamer.webp'),
  sister:     require('../../assets/roles/sisters.webp'),
  white_wolf: require('../../assets/roles/white_wolf.webp'),
  wolf_hound: require('../../assets/roles/wolf_hound.webp'),
  fox:        require('../../assets/roles/fox.webp'),
  wild_child: require('../../assets/roles/wild_child.webp'),
  village_idiot: require('../../assets/roles/village_idiot.webp'),
  raven:      require('../../assets/roles/raven.webp'),
  big_bad_wolf: require('../../assets/roles/big_bad_wolf.webp'),
};

export default function RoleCard({ role, fellowWolves = [], fellowSisters = [], players = [] }) {
  const info = getRoleInfo(role);
  const wolves = fellowWolves
    .map((id) => players.find((p) => p.id === id)?.nickname || id)
    .filter(Boolean);
  const sisters = fellowSisters
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
      {sisters.length > 0 && (
        <View style={styles.sistersBox}>
          <View style={styles.wolvesLabelRow}>
            <Image source={ROLE_ICONS.sister} style={styles.wolvesLabelIcon} resizeMode="contain" />
            <Text style={styles.sistersLabel}>Your Sister</Text>
          </View>
          {sisters.map((name) => (
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
  sistersBox: {
    marginTop: SPACING.lg,
    backgroundColor: 'rgba(212,100,150,0.2)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#C06090',
  },
  sistersLabel: { ...FONTS.subheading, color: '#E090C0' },
  wolvesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  wolvesLabelIcon: { width: 32, height: 32 },
  wolvesLabel: { ...FONTS.subheading, color: NIGHT.accent },
  wolfName: {
    ...FONTS.body,
    color: NIGHT.text,
  },
});
