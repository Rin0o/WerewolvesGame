import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, SPACING } from '../constants/theme';

const TOUCH_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

export default function CollapseHeader({ collapsed, onToggle, theme: t, children, summary, label }) {
  return (
    <TouchableOpacity
      style={styles.header}
      onPress={onToggle}
      hitSlop={TOUCH_SLOP}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={label}
    >
      <View style={styles.title}>{children}</View>
      <Text style={[styles.side, { color: t.textMuted }]}>
        {summary ? `${summary}  ` : ''}{collapsed ? '▼' : '▲'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    alignSelf: 'stretch',
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  title: { flexShrink: 1 },
  side: { ...FONTS.body, fontWeight: '700' },
});
