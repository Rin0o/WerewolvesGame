import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { updateProfile, nicknameError, NICKNAME_MAX } from '../utils/profile';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '?';

export default function SettingsPanel({ visible, onClose, theme: t, profile, onProfileChange }) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setNickname(profile.nickname);
      setError(null);
    }
  }, [visible]);

  async function handleSoundToggle(soundEnabled) {
    onProfileChange(await updateProfile({ soundEnabled }));
  }

  async function handleSave() {
    const problem = nicknameError(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    onProfileChange(await updateProfile({ nickname: nickname.trim() }));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: t.modalOverlay }]}>
        <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.primary }]}>⚙️ Settings</Text>

          <Text style={[styles.label, { color: t.textSecondary }]}>Your Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: error ? t.danger : t.border }]}
            value={nickname}
            onChangeText={(value) => { setNickname(value); setError(null); }}
            placeholder="Enter your name..."
            placeholderTextColor={t.textMuted}
            maxLength={NICKNAME_MAX}
            autoCapitalize="words"
          />
          {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Applies to rooms you create or join from now on.
          </Text>

          <View style={[styles.row, { borderColor: t.border }]}>
            <Text style={[styles.rowLabel, { color: t.text }]}>Sound effects</Text>
            <Switch
              value={profile.soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ true: t.primary, false: t.border }}
            />
          </View>

          <Text style={[styles.version, { color: t.textMuted }]}>Version {APP_VERSION}</Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: t.primary }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: t.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: t.primary }]} onPress={handleSave}>
              <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  panel: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  title: { ...FONTS.heading, textAlign: 'center', marginBottom: SPACING.lg },
  label: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, fontWeight: '700' },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...FONTS.body,
  },
  error: { ...FONTS.caption, marginTop: SPACING.xs },
  hint: { ...FONTS.caption, marginTop: SPACING.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
  },
  rowLabel: { ...FONTS.body },
  version: { ...FONTS.caption, textAlign: 'center', marginTop: SPACING.lg },
  buttons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  btn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 2 },
  btnText: { ...FONTS.button },
});
