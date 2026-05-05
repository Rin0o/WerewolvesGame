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
  noDeadOpacity,
  avatarIcon,
  avatarIconSize = 40,
  checkIcon,
  noSelectionBorder,
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
        dead && !noDeadOpacity && styles.dead,
        selected && !noSelectionBorder && { borderWidth: 2, shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
      ]}
    >
      <View style={styles.row}>
        {avatarIcon ? (
          <Image source={avatarIcon} style={[styles.avatarRoleIcon, { width: avatarIconSize, height: avatarIconSize }]} resizeMode="contain" />
        ) : dead && role && ROLE_ICONS[role] ? (
          <Image source={ROLE_ICONS[role]} style={styles.avatarRoleIcon} resizeMode="contain" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: dead ? theme.border : theme.primary }]}>
            <Text style={styles.avatarText}>{nickname?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}

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

          {suspicionLevel && suspicionLevel !== 'neutral' && suspicionLevel !== 'dead' && (
            <Text style={[styles.suspicionLabel, { color: theme.textSecondary }]}>
              {SUSPICION_LABELS[suspicionLevel]}
            </Text>
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
          checkIcon
            ? <Image source={checkIcon} style={styles.checkImg} resizeMode="contain" />
            : <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
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
  avatarRoleIcon: { width: 40, height: 40, marginRight: SPACING.sm },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...FONTS.subheading },
  badge: { ...FONTS.caption, fontWeight: '700', letterSpacing: 1 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  roleIcon: { width: 24, height: 24 },
  roleText: { ...FONTS.body, fontWeight: '700', letterSpacing: 1 },
  suspicionLabel: { ...FONTS.caption, marginTop: 3 },
  suspicionBadge: { marginLeft: SPACING.sm },
  suspicionBadgeIcon: { width: 50, height: 50 },
  check: { fontSize: 20, fontWeight: '700', marginLeft: SPACING.sm },
  checkImg: { width: 36, height: 36, marginLeft: SPACING.sm },
});
