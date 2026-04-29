import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';

export default function PlayerCard({
  player,
  theme,
  onPress,
  selected,
  showRole,
  roleMap,
  suspicion,
  suspectedRole,
  disabled,
}) {
  const { nickname, isAlive, isHost } = player;
  const role = roleMap?.[player.id];
  const dead = !isAlive;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || dead}
      activeOpacity={0.75}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: selected ? theme.primary : theme.border },
        dead && styles.dead,
        selected && { borderWidth: 2, shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: dead ? theme.border : theme.primary }]}>
          <Text style={styles.avatarText}>{nickname?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: dead ? theme.textMuted : theme.text }]}>
              {nickname}
            </Text>
            {isHost && <Text style={[styles.badge, { color: theme.accent }]}>HOST</Text>}
            {dead && <Text style={[styles.badge, { color: theme.textMuted }]}>DEAD</Text>}
          </View>
          {showRole && role && (
            <Text style={[styles.role, { color: theme.accent }]}>
              {role.toUpperCase()}
            </Text>
          )}
          {suspicion && (
            <Text style={[styles.suspicion, { color: theme.textSecondary }]}>{suspicion}</Text>
          )}
          {suspectedRole && (
            <View style={[styles.suspectedChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.primary }]}>
              <Text style={[styles.suspectedChipText, { color: theme.text }]}>
                {ROLE_DEFINITIONS[suspectedRole]?.emoji} {ROLE_DEFINITIONS[suspectedRole]?.name || suspectedRole}
              </Text>
            </View>
          )}
        </View>
        {selected && (
          <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    borderWidth: 1,
  },
  dead: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...FONTS.subheading,
  },
  badge: {
    ...FONTS.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  role: {
    ...FONTS.caption,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  suspicion: {
    ...FONTS.caption,
    marginTop: 2,
  },
  suspectedChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  suspectedChipText: {
    ...FONTS.caption,
    fontWeight: '700',
  },
  check: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
});
