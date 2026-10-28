import React from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ROLE_ICONS } from '../constants/icons';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

export default function TurnedWolfNotice({ notice, onDismiss }) {
  return (
    <Modal
      visible={!!notice}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {notice && (
        <View style={styles.overlay}>
          <View style={styles.iconRow}>
            <Image source={ROLE_ICONS[notice.fromRole] || ROLE_ICONS.villager} style={styles.icon} resizeMode="contain" />
            <Text style={styles.arrow}>→</Text>
            <Image source={ROLE_ICONS.werewolf} style={styles.icon} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.cause}>{notice.cause}</Text>
          <View style={styles.changes}>
            {notice.changes.map((change) => (
              <Text key={change} style={styles.change}>• {change}</Text>
            ))}
          </View>
          <View style={styles.packBox}>
            <Text style={styles.packLabel}>Your pack</Text>
            <Text style={styles.packNames}>
              {notice.pack.length > 0 ? notice.pack.join(', ') : 'You are the last wolf standing.'}
            </Text>
          </View>
          <Text style={styles.secret}>Nobody else was told. Keep your new nature hidden.</Text>
          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>I join the pack</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12,2,6,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  icon: { width: 104, height: 104 },
  arrow: { fontSize: 36, color: '#E05050', fontWeight: '800' },
  title: {
    ...FONTS.title,
    color: '#FFD9D9',
    textAlign: 'center',
    textShadowColor: 'rgba(224,80,80,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  cause: { ...FONTS.subheading, color: '#F0B0B0', fontStyle: 'italic', textAlign: 'center' },
  changes: { alignSelf: 'stretch', gap: SPACING.xs },
  change: { ...FONTS.body, color: '#EDE3FF', lineHeight: 22 },
  packBox: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: 'rgba(224,80,80,0.6)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  packLabel: { ...FONTS.caption, color: '#E05050', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  packNames: { ...FONTS.subheading, color: '#FFF1CC', textAlign: 'center' },
  secret: { ...FONTS.caption, color: '#A898C8', textAlign: 'center' },
  button: {
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,217,217,0.6)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 4,
  },
  buttonText: { ...FONTS.button, color: '#FFD9D9' },
});
