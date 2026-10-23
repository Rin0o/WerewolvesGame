import React, { useEffect, useState } from 'react';
import { View, Text, Image, Modal, Pressable, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { loadProfile, updateProfile } from '../utils/profile';
import { TIE_RULE } from '../game-logic/gameManager';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const LEAVE_ICON = require('../../assets/leave.webp');
const MODE_LABELS ={ normal: 'Normal', custom: 'Custom', narrator: 'Narrator' };

function RuleRow({ theme: t, label, value }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={[styles.ruleLabel, { color: t.textSecondary }]}>{label}</Text>
      <Text style={[styles.ruleValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

export default function GameOptionsModal({ visible, onClose, theme: t, room, onLeave }) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (!visible) return;
    loadProfile().then((profile) => setSoundEnabled(profile.soundEnabled));
  }, [visible]);

  function toggleSound(enabled) {
    setSoundEnabled(enabled);
    updateProfile({ soundEnabled: enabled });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: t.modalOverlay }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: t.overlay, borderColor: t.glassBorder || t.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.text }]}>Options</Text>
            <TouchableOpacity style={styles.closeX} onPress={onClose} hitSlop={12} accessibilityLabel="Close options">
              <Text style={[styles.closeXText, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.section, { borderColor: t.glassBorder || t.border }]}>
            <View style={styles.soundRow}>
              <Text style={[styles.soundLabel, { color: t.text }]}>Sound effects</Text>
              <Switch
                value={soundEnabled}
                onValueChange={toggleSound}
                trackColor={{ true: t.primary }}
                accessibilityLabel="Sound effects"
              />
            </View>
          </View>

          <View style={[styles.section, { borderColor: t.glassBorder || t.border }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>This game</Text>
            <RuleRow theme={t} label="Room" value={room?.code || '—'} />
            <RuleRow theme={t} label="Mode" value={MODE_LABELS[room?.gameMode] || MODE_LABELS.normal} />
            <RuleRow theme={t} label="First night" value={room?.classicFirstNight ? 'Classic' : 'Quiet'} />
            <RuleRow
              theme={t}
              label="Tied vote"
              value={room?.tieRule === TIE_RULE.REVOTE ? 'Vote again' : 'No lynch'}
            />
          </View>

          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={() => { onClose(); onLeave(); }}
            accessibilityLabel="Leave game"
          >
            <Image source={LEAVE_ICON} style={styles.leaveImg} resizeMode="contain" />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  card: { width: '100%', maxWidth: 400, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, gap: SPACING.md },
  headerRow: { justifyContent: 'center' },
  title: { ...FONTS.heading, textAlign: 'center' },
  closeX: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: SPACING.xs },
  closeXText: { fontSize: 22, fontWeight: '700' },
  section: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
  sectionTitle: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: SPACING.xs },
  soundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soundLabel: { ...FONTS.body, fontWeight: '600' },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ruleLabel: { ...FONTS.body },
  ruleValue: { ...FONTS.body, fontWeight: '700' },
  leaveBtn: { marginTop: SPACING.md, alignItems: 'center' },
  leaveImg: { width: 110, height: 110 },
});
