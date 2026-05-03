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
const AVATAR_UNKNOWN = require('../../assets/role_icons/unknown.png');
const AVATAR_DEAD = require('../../assets/suspicion_level_icons/dead.png');
const SUSPECT_ICON = require('../../assets/suspicion_level_icons/suspect.png');
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
              <View key={p.id} style={styles.playerRowContainer}>
                <ImageBackground
                  source={PLAYER_ROW_BG}
                  style={styles.playerRowBg}
                  imageStyle={styles.playerRowImg}
                  resizeMode="stretch"
                >
                  <PlayerCard
                    player={p}
                    theme={{ ...theme, surface: 'transparent', border: 'transparent' }}
                    suspicionLevel={p.isAlive ? (suspicions[p.id] || 'neutral') : null}
                    suspectedRole={suspectedRoles[p.id]}
                    avatarIcon={!p.isAlive ? AVATAR_DEAD : AVATAR_UNKNOWN}
                    avatarIconSize={56}
                    onPress={p.isAlive ? () => cycleSuspicion(p.id) : null}
                    disabled={false}
                    noDeadOpacity
                  />
                </ImageBackground>
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
                      <Image source={SUSPECT_ICON} style={styles.rolePickerIcon} resizeMode="contain" />
                    )}
                  </ImageBackground>
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
  playerRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  playerRowBg: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  playerRowImg: { borderRadius: RADIUS.md },
  rolePickerBtn: {
    width: 64,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rolePickerBg: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePickerIcon: { width: 50, height: 50 },
  rolePickerEmoji: { fontSize: 40 },
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
