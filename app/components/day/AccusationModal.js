import React from 'react';
import { View, Text, Image, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { ROLE_ICONS, SUSPICION_ICONS, SUSPICION_LABELS } from '../../constants/icons';

const ACCEPT_ICON = require('../../../assets/accept.webp');
const CANCEL_ICON = require('../../../assets/cancel.webp');

export default function AccusationModal({ visible, target, theme: t, suspicion, suspectedRole, onConfirm, onCancel }) {
  if (!target) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: t.modalOverlay }]}>
        <View style={[styles.modal, { backgroundColor: t.surface, borderColor: t.danger }]}>
          <Text style={[styles.heading, { color: t.danger }]}>⚖️ Raise an Accusation</Text>

          <View style={[styles.playerRow, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <View style={[styles.avatar, { backgroundColor: t.primary }]}>
              <Text style={styles.avatarText}>{target.nickname?.[0]?.toUpperCase()}</Text>
            </View>
            <Text style={[styles.playerName, { color: t.text }]}>{target.nickname}</Text>
          </View>

          {suspicion && suspicion !== 'neutral' && (
            <View style={[styles.chip, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <Image source={SUSPICION_ICONS[suspicion]} style={styles.chipIcon} resizeMode="contain" />
              <Text style={[styles.chipText, { color: t.textSecondary }]}>
                Your read: {SUSPICION_LABELS[suspicion]}
              </Text>
            </View>
          )}

          {suspectedRole && (
            <View style={[styles.chip, { backgroundColor: t.surfaceAlt, borderColor: t.primary }]}>
              {ROLE_ICONS[suspectedRole] && (
                <Image source={ROLE_ICONS[suspectedRole]} style={styles.chipIcon} resizeMode="contain" />
              )}
              <Text style={[styles.chipText, { color: t.text }]}>
                Suspected role: {ROLE_DEFINITIONS[suspectedRole]?.name}
              </Text>
            </View>
          )}

          <Text style={[styles.body, { color: t.textSecondary }]}>
            Accusing{' '}
            <Text style={{ fontWeight: '700', color: t.text }}>{target.nickname}</Text>
            {' '}puts them on trial. They will have a moment to defend themselves before the village votes to{' '}
            <Text style={{ color: t.danger, fontWeight: '600' }}>lynch</Text> or{' '}
            <Text style={{ color: t.success, fontWeight: '600' }}>spare</Text> them.
            {'\n\n'}This cannot be undone once confirmed.
          </Text>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.imgBtn} onPress={onCancel}>
              <Image source={CANCEL_ICON} style={styles.imgIcon} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgBtn} onPress={onConfirm}>
              <Image source={ACCEPT_ICON} style={styles.imgIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  heading: { ...FONTS.heading, textAlign: 'center', marginBottom: SPACING.xs },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  playerName: { ...FONTS.subheading, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  chipIcon: { width: 22, height: 22 },
  chipText: { ...FONTS.body, fontWeight: '600' },
  body: { ...FONTS.body, lineHeight: 22, marginTop: SPACING.xs },
  btns: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  imgBtn: { flex: 1, alignItems: 'center' },
  imgIcon: { width: 130, height: 130 },
});
