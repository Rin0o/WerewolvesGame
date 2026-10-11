import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';
import { ROLE } from '../../constants/roles';

const SIDES = [
  { role: ROLE.VILLAGER, name: 'The Village', text: 'Stay a Villager and hunt the wolves by day.' },
  { role: ROLE.WEREWOLF, name: 'The Pack', text: 'Become a Werewolf and wake with the pack tonight.' },
];

export default function WolfHoundAction({ theme: t, choice, onSelect, onSubmit }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.wolf_hound} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Your Side</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        Nobody will know which side you picked. This choice is final.
      </Text>

      {SIDES.map((side) => (
        <TouchableOpacity
          key={side.role}
          style={[
            styles.sideCard,
            {
              backgroundColor: choice === side.role ? t.primary : t.surfaceAlt,
              borderColor: choice === side.role ? t.accent : t.border,
            },
          ]}
          onPress={() => onSelect(side.role)}
        >
          <Image source={ROLE_ICONS[side.role]} style={styles.sideIcon} resizeMode="contain" />
          <View style={styles.sideInfo}>
            <Text style={[styles.sideName, { color: t.text }]}>{side.name}</Text>
            <Text style={[styles.sideText, { color: t.textMuted }]}>{side.text}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: choice ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!choice}
      >
        <View style={styles.btnIconRow}>
          <Image source={ROLE_ICONS.wolf_hound} style={styles.btnIcon} resizeMode="contain" />
          <Text style={styles.submitText}>Swear Allegiance</Text>
        </View>
      </TouchableOpacity>
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
  sideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  sideIcon: { width: 52, height: 52 },
  sideInfo: { flex: 1 },
  sideName: { ...FONTS.subheading, fontWeight: '600' },
  sideText: { ...FONTS.body, lineHeight: 20 },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
});
