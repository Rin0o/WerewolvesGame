import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';

export default function WolfFatherAction({ theme: t, victimName, onInfect, onKill }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.wolf_father} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Infect or Kill?</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        The pack has chosen <Text style={{ color: t.danger, fontWeight: '800' }}>{victimName}</Text>. You may bite them instead:
        they survive, keep their role and power, and secretly join the pack. You can do this only once per game. If the
        Saviour protected them tonight, the bite fails and you keep it for another night.
      </Text>
      <TouchableOpacity style={[styles.btn, { backgroundColor: t.danger }]} onPress={onInfect}>
        <Text style={styles.btnText}>Infect {victimName}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.skipBtn, { borderColor: t.border }]} onPress={onKill}>
        <Text style={[styles.skipText, { color: t.textSecondary }]}>Let them die</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading, flexShrink: 1 },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  btn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnText: { ...FONTS.button, color: '#fff' },
  skipBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  skipText: { ...FONTS.button },
});
