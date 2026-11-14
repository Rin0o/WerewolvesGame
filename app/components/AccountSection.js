import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { auth } from '../firebase/config';
import { subscribeToAuth } from '../firebase/authService';
import {
  linkGoogleAccount,
  switchToGoogleAccount,
  cancelGoogleSwitch,
  signOutToAnonymous,
  deleteAccount,
  loadSavedNickname,
  saveNickname,
} from '../firebase/accountService';
import { accountStatus, accountErrorMessage, nicknameAfterSignIn } from '../utils/account';
import { updateProfile } from '../utils/profile';
import { clearSession } from '../utils/session';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

export default function AccountSection({ theme: t, profile, onProfileChange }) {
  const [status, setStatus] = useState(() => accountStatus(auth.currentUser));
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToAuth((user) => setStatus(accountStatus(user))), []);

  function refresh() {
    setStatus(accountStatus(auth.currentUser));
  }

  async function run(action) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Google account', accountErrorMessage(error?.kind));
    } finally {
      refresh();
      setBusy(false);
    }
  }

  async function syncNickname() {
    const { nickname, save } = nicknameAfterSignIn(profile.nickname, await loadSavedNickname());
    if (save) await saveNickname(nickname);
    if (nickname !== profile.nickname) onProfileChange(await updateProfile({ nickname }));
  }

  function handleSignIn() {
    run(async () => {
      const result = await linkGoogleAccount();
      if (result.status === 'linked') await syncNickname();
      if (result.status === 'already_linked') confirmSwitch(result.credential);
    });
  }

  function confirmSwitch(credential) {
    Alert.alert(
      'This Google account already has a player',
      "Switch to it to get its name and games back. The games you played anonymously on this phone won't carry over.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => cancelGoogleSwitch() },
        {
          text: 'Switch',
          onPress: () => run(async () => {
            await switchToGoogleAccount(credential);
            await clearSession();
            await syncNickname();
          }),
        },
      ],
      { cancelable: true, onDismiss: () => cancelGoogleSwitch() },
    );
  }

  function handleSignOut() {
    Alert.alert(
      'Sign out?',
      "You'll play as a new anonymous player on this phone. Sign in again any time to get your games back.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          onPress: () => run(async () => {
            await signOutToAnonymous();
            await clearSession();
          }),
        },
      ],
    );
  }

  function handleDelete() {
    Alert.alert(
      'Delete your account?',
      "Your account and saved name are deleted for good. You'll keep playing anonymously on this phone. Google will ask you to confirm.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(async () => {
            const result = await deleteAccount();
            if (result.status !== 'deleted') return;
            await clearSession();
            Alert.alert('Account deleted', "You're now playing anonymously on this phone.");
          }),
        },
      ],
    );
  }

  return (
    <View style={[styles.section, { borderColor: t.border }]}>
      <Text style={[styles.label, { color: t.textSecondary }]}>Your Account</Text>

      {status.signedIn ? (
        <>
          <Text style={[styles.text, { color: t.text }]}>
            Signed in with Google{status.email ? ` as ${status.email}` : ''}.
          </Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>Your name and games follow you to any phone.</Text>
          {busy ? <ActivityIndicator color={t.primary} style={styles.busy} /> : (
            <View style={styles.links}>
              <TouchableOpacity onPress={handleSignOut} hitSlop={8}>
                <Text style={[styles.link, { color: t.primary }]}>Sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} hitSlop={8}>
                <Text style={[styles.link, { color: t.danger }]}>Delete my account</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.text, { color: t.text }]}>Playing anonymously.</Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Your games stay on this phone. Sign in to keep them on any phone.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { borderColor: t.primary }]}
            onPress={handleSignIn}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={t.primary} /> : (
              <Text style={[styles.btnText, { color: t.primary }]}>Sign in with Google</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, marginTop: SPACING.lg, paddingTop: SPACING.md },
  label: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, fontWeight: '700' },
  text: { ...FONTS.body },
  hint: { ...FONTS.caption, marginTop: SPACING.xs },
  btn: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  btnText: { ...FONTS.button },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md },
  link: { ...FONTS.body, fontWeight: '600', textDecorationLine: 'underline' },
  busy: { marginTop: SPACING.md },
});
