import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';

import PlayerCard from './PlayerCard';
import ClueLog from './ClueLog';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS } from '../constants/icons';

const PLAYER_ROW_BG = require('../../assets/player_row.png');
const PLAYER_SUSPICION_BTN_BG = require('../../assets/player_suspicion_btn.png');
const ROLE_OPTIONS = Object.keys(ROLE_DEFINITIONS);

export default function NotesPanel({ visible, onClose, theme, players, events, playerHooks }) {
  const { notes, updateNotes, suspicions, cycleSuspicion, suspectedRoles, setSuspectedRole } = playerHooks;
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
              <ImageBackground
                key={p.id}
                source={PLAYER_ROW_BG}
                style={styles.playerRowBg}
                imageStyle={styles.playerRowImg}
                resizeMode="stretch"
              >
                <View style={styles.playerRow}>
                  <View style={styles.playerCardWrap}>
                    <PlayerCard
                      player={p}
                      theme={{ ...theme, surface: 'transparent', border: 'transparent' }}
                      suspicionLevel={suspicions[p.id] || 'neutral'}
                      suspectedRole={suspectedRoles[p.id]}
                      onPress={() => cycleSuspicion(p.id)}
                      disabled={false}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => setRolePickerFor(p.id)}
                    style={styles.rolePickerBtn}
                  >
                    <ImageBackground
                      source={PLAYER_SUSPICION_BTN_BG}
                      style={styles.rolePickerBg}
                      resizeMode="stretch"
                    >
                      {suspectedRoles[p.id] && ROLE_ICONS[suspectedRoles[p.id]] ? (
                        <Image
                          source={ROLE_ICONS[suspectedRoles[p.id]]}
                          style={styles.rolePickerIcon}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.rolePickerEmoji}>🎭</Text>
                      )}
                    </ImageBackground>
                  </TouchableOpacity>
                </View>
              </ImageBackground>
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
                <View style={styles.roleOptionRow}>
                  {ROLE_ICONS[r] ? (
                    <Image source={ROLE_ICONS[r]} style={styles.roleOptionIcon} resizeMode="contain" />
                  ) : (
                    <Text style={styles.roleOptionEmoji}>{ROLE_DEFINITIONS[r].emoji}</Text>
                  )}
                  <Text style={[styles.roleOptionText, { color: theme.text }]}>
                    {ROLE_DEFINITIONS[r].name}
                  </Text>
                </View>
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
  title: { ...FONTS.heading },
  closeBtn: { padding: SPACING.xs },
  closeText: { fontSize: 20 },
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
  playerRowBg: {
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  playerRowImg: { borderRadius: RADIUS.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  playerCardWrap: { flex: 1 },
  rolePickerBtn: {
    width: 64,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rolePickerBg: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePickerIcon: { width: 40, height: 40 },
  rolePickerEmoji: { fontSize: 32 },
  roleOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rolePick: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: 300,
    borderWidth: 1,
  },
  rolePickTitle: {
    ...FONTS.subheading,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  roleOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  roleOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  roleOptionIcon: { width: 34, height: 34 },
  roleOptionEmoji: { fontSize: 30, width: 34, textAlign: 'center' },
  roleOptionText: { ...FONTS.body, fontWeight: '600' },
  clearRole: {
    ...FONTS.caption,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
