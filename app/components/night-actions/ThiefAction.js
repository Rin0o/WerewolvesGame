import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import RoleCard from '../RoleCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';
import { getRoleInfo } from '../../game-logic/roles';

export default function ThiefAction({ theme: t, availableRoles, thiefChoice, thiefStolenRole, onSelectRole, onSubmit, onDismissReveal }) {
  if (thiefStolenRole) {
    return (
      <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
        <View style={styles.actionTitleRow}>
          <Image source={ROLE_ICONS.thief} style={styles.actionTitleIcon} resizeMode="contain" />
          <Text style={[styles.actionTitle, { color: t.accent }]}>You stole a role!</Text>
        </View>
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>
          From this moment on, you play as:
        </Text>
        <RoleCard role={thiefStolenRole} />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: t.primary, marginTop: SPACING.sm }]}
          onPress={onDismissReveal}
        >
          <Text style={styles.submitText}>I understand my new role ✓</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.thief} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose a Role to Steal</Text>
      </View>

      {availableRoles.length === 0 ? (
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>
          No roles are available to steal. You remain a Thief and side with the villagers.
        </Text>
      ) : (
        <>
          <Text style={[styles.actionSub, { color: t.textSecondary }]}>
            These roles are not assigned to any player. Pick one — you will become it immediately.
          </Text>
          {availableRoles.map((role) => {
            const info = getRoleInfo(role);
            return (
              <TouchableOpacity
                key={role}
                style={[
                  styles.thiefRoleCard,
                  {
                    backgroundColor: thiefChoice === role ? t.primary : t.surfaceAlt,
                    borderColor: thiefChoice === role ? t.accent : t.border,
                  },
                ]}
                onPress={() => onSelectRole(role)}
              >
                {ROLE_ICONS[role] ? (
                  <Image source={ROLE_ICONS[role]} style={styles.thiefRoleIcon} resizeMode="contain" />
                ) : (
                  <Text style={styles.thiefRoleEmoji}>{info.emoji}</Text>
                )}
                <View style={styles.thiefRoleInfo}>
                  <Text style={[styles.thiefRoleName, { color: t.text }]}>{info.name}</Text>
                  <Text style={[styles.thiefRoleDesc, { color: t.textMuted }]} numberOfLines={2}>
                    {info.ability || info.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: thiefChoice ? t.primary : t.border }]}
            onPress={onSubmit}
            disabled={!thiefChoice}
          >
            <View style={styles.btnIconRow}>
              <Image source={ROLE_ICONS.thief} style={styles.btnIcon} resizeMode="contain" />
              <Text style={styles.submitText}>Steal This Role</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
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
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
  thiefRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  thiefRoleIcon: { width: 44, height: 44 },
  thiefRoleEmoji: { fontSize: 40 },
  thiefRoleInfo: { flex: 1 },
  thiefRoleName: { ...FONTS.subheading, fontWeight: '600' },
  thiefRoleDesc: { ...FONTS.body, lineHeight: 20 },
});
