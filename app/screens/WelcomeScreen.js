import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile, nicknameError, NICKNAME_MAX } from '../utils/profile';
import { DAY, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function WelcomeScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const t = DAY;

  async function handleContinue() {
    const problem = nicknameError(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    await updateProfile({ nickname: nickname.trim() });
    navigation.replace('Home');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.moon}>🌕</Text>
            <Text style={[styles.title, { color: t.primary }]}>Welcome, traveller</Text>
            <Text style={[styles.subtitle, { color: t.textSecondary }]}>
              What should the village call you?
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.label, { color: t.textSecondary }]}>Your Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: error ? t.danger : t.border }]}
              value={nickname}
              onChangeText={(value) => { setNickname(value); setError(null); }}
              placeholder="Enter your name..."
              placeholderTextColor={t.textMuted}
              maxLength={NICKNAME_MAX}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
            <Text style={[styles.hint, { color: t.textMuted }]}>
              You can change it later in ⚙️ settings.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: t.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  moon: { fontSize: 56, marginBottom: SPACING.sm },
  title: { ...FONTS.title, textAlign: 'center' },
  subtitle: { ...FONTS.subheading, marginTop: SPACING.xs, textAlign: 'center' },
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  label: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, fontWeight: '700' },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...FONTS.body,
  },
  error: { ...FONTS.caption, marginTop: SPACING.xs },
  hint: { ...FONTS.caption, marginTop: SPACING.sm },
  btn: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  btnText: { ...FONTS.button, color: '#fff' },
});
