import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS, SUSPICION_ICONS, SUSPICION_LABELS } from '../constants/icons';

export default function PlayerCard({
  player,
  theme,
  onPress,
  selected,
  showRole,
  roleMap,
  suspicionLevel,
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
            <View style={styles.roleRow}>
              {ROLE_ICONS[role] && (
                <Image source={ROLE_ICONS[role]} style={styles.roleIcon} resizeMode="contain" />
              )}
              <Text style={[styles.roleText, { color: theme.accent }]}>
                {ROLE_DEFINITIONS[role]?.name?.toUpperCase() || role.toUpperCase()}
              </Text>
            </View>
          )}

          {suspicionLevel && suspicionLevel !== 'neutral' && (
            <View style={styles.suspicionRow}>
              {SUSPICION_ICONS[suspicionLevel] && (
                <Image source={SUSPICION_ICONS[suspicionLevel]} style={styles.suspicionIcon} resizeMode="contain" />
              )}
              <Text style={[styles.suspicionText, { color: theme.textSecondary }]}>
                {SUSPICION_LABELS[suspicionLevel]}
              </Text>
            </View>
          )}

          {suspectedRole && (
            <View style={[styles.suspectedChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.primary }]}>
              {ROLE_ICONS[suspectedRole] && (
                <Image source={ROLE_ICONS[suspectedRole]} style={styles.chipIcon} resizeMode="contain" />
              )}
              <Text style={[styles.suspectedChipText, { color: theme.text }]}>
                {ROLE_DEFINITIONS[suspectedRole]?.name || suspectedRole}
              </Text>
            </View>
          )}
        </View>

        {suspicionLevel && (
          <View style={styles.suspicionBadge}>
            {SUSPICION_ICONS[suspicionLevel] && (
              <Image source={SUSPICION_ICONS[suspicionLevel]} style={styles.suspicionBadgeIcon} resizeMode="contain" />
            )}
          </View>
        )}

        {selected && !suspicionLevel && (
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
  dead: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...FONTS.subheading },
  badge: { ...FONTS.caption, fontWeight: '700', letterSpacing: 1 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roleIcon: { width: 16, height: 16 },
  roleText: { ...FONTS.caption, fontWeight: '700', letterSpacing: 1 },
  suspicionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  suspicionIcon: { width: 14, height: 14 },
  suspicionText: { ...FONTS.caption },
  suspectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginTop: 4,
    gap: 4,
  },
  chipIcon: { width: 12, height: 12 },
  suspectedChipText: { ...FONTS.caption, fontWeight: '700' },
  suspicionBadge: { marginLeft: SPACING.sm },
  suspicionBadgeIcon: { width: 26, height: 26 },
  check: { fontSize: 20, fontWeight: '700', marginLeft: SPACING.sm },
});
