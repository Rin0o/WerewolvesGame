import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS } from '../constants/theme';

const BADGE_COLOR = '#D7263D';
const BADGE_MAX = 9;

export default function BarButton({ source, onPress, unread = 0, accessibilityLabel }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <Image source={source} style={styles.image} resizeMode="contain" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 64 },
  badge: {
    position: 'absolute',
    top: 0,
    right: '12%',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: RADIUS.full,
    backgroundColor: BADGE_COLOR,
    borderWidth: 2,
    borderColor: '#FFF4E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...FONTS.caption, color: '#fff', fontWeight: '800' },
});
