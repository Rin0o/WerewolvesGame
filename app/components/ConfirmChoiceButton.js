import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

export default function ConfirmChoiceButton({ theme: t, icon, label, targetName, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: t.primary, borderColor: t.primaryDark }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image source={icon} style={styles.icon} resizeMode="contain" />
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.target} numberOfLines={1}>{targetName}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  icon: { width: 52, height: 52 },
  textCol: { flex: 1 },
  label: { ...FONTS.caption, color: '#FFE9CC', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  target: { ...FONTS.heading, color: '#fff' },
});
