import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import PlayerCard from './PlayerCard';
import ClueLog from './ClueLog';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';

const ROLE_OPTIONS = Object.keys(ROLE_DEFINITIONS);

export default function NotesPanel({ visible, onClose, theme, players, events, playerHooks }) {
  const { notes, updateNotes, suspicions, cycleSuspicion, suspectedRoles, setSuspectedRole, SUSPICION_LABELS } = playerHooks;
  const [rolePickerFor, setRolePickerFor] = useState(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>📓 Notes & Deduction</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Player board */}
            <Text style={[styles.section, { color: theme.textSecondary }]}>Player Board</Text>
            {players.map((p) => (
              <View key={p.id}>
                <PlayerCard
                  player={p}
                  theme={theme}
                  suspicion={SUSPICION_LABELS[suspicions[p.id]] || SUSPICION_LABELS.neutral}
                  suspectedRole={suspectedRoles[p.id]}
                  onPress={() => cycleSuspicion(p.id)}
                  disabled={false}
                />
                <TouchableOpacity
                  onPress={() => setRolePickerFor(p.id)}
                  style={[styles.rolePicker, { borderColor: theme.border }]}
                >
                  <Text style={[styles.rolePickerText, { color: theme.textMuted }]}>
                    Suspected role: {suspectedRoles[p.id] || 'tap to set'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Notepad */}
            <Text style={[styles.section, { color: theme.textSecondary }]}>Personal Notes</Text>
            <TextInput
              style={[styles.notepad, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
              multiline
              value={notes}
              onChangeText={updateNotes}
              placeholder="Write your deductions here..."
              placeholderTextColor={theme.textMuted}
              textAlignVertical="top"
            />

            {/* Clue log */}
            <Text style={[styles.section, { color: theme.textSecondary }]}>Game Events</Text>
            <ClueLog events={events} theme={theme} />
            <View style={{ height: SPACING.xl }} />
          </ScrollView>
        </View>
      </View>

      {/* Role picker modal */}
      <Modal visible={!!rolePickerFor} transparent animationType="fade" onRequestClose={() => setRolePickerFor(null)}>
        <TouchableOpacity style={styles.roleOverlay} onPress={() => setRolePickerFor(null)}>
          <View style={[styles.rolePick, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.rolePickTitle, { color: theme.text }]}>Suspected Role</Text>
            {ROLE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => { setSuspectedRole(rolePickerFor, r); setRolePickerFor(null); }}
                style={[styles.roleOption, { borderColor: theme.border }]}
              >
                <Text style={[styles.roleOptionText, { color: theme.text }]}>
                  {ROLE_DEFINITIONS[r].emoji} {ROLE_DEFINITIONS[r].name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => { setSuspectedRole(rolePickerFor, null); setRolePickerFor(null); }}>
              <Text style={[styles.clearRole, { color: theme.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#888',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.heading,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  closeText: {
    fontSize: 20,
  },
  section: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  notepad: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    minHeight: 100,
    ...FONTS.body,
  },
  rolePicker: {
    borderTopWidth: 1,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginTop: -4,
    marginBottom: SPACING.xs,
  },
  rolePickerText: {
    ...FONTS.caption,
  },
  roleOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rolePick: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: 260,
    borderWidth: 1,
  },
  rolePickTitle: {
    ...FONTS.subheading,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  roleOption: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  roleOptionText: {
    ...FONTS.body,
  },
  clearRole: {
    ...FONTS.caption,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
