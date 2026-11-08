import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';

import ClueLog from './ClueLog';
import { RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ROLE_ICONS, SUSPICION_ICONS } from '../constants/icons';

const SUSPECT_ICON = require('../../assets/suspicion_level_icons/suspect.webp');

const ALL_ROLES = Object.keys(ROLE_DEFINITIONS);

const SUSPICION_LEVELS = ['innocent', 'neutral', 'suspicious', 'very_suspicious'];

const SUSPICION_LABELS_SHORT = {
  innocent: 'Safe',
  neutral: 'Neutral',
  suspicious: 'Sus',
  very_suspicious: 'Very Sus',
};

const SUSPICION_COLORS = {
  innocent: '#27AE60',
  neutral: '#888',
  suspicious: '#E8A020',
  very_suspicious: '#C0392B',
};

function PlayerBoardCard({ player, theme, suspicion, suspectedRole, onSelectSuspicion, onPickRole }) {
  const isDead = !player.isAlive;
  const currentSuspicion = suspicion || 'neutral';
  const activeColor = SUSPICION_COLORS[currentSuspicion];

  const isDay = theme.background === '#FFF8F0';
  const cardBg = isDead
    ? (isDay ? '#E8DFF0' : '#2A1848')
    : (isDay ? '#FFFAF4' : '#221545');
  const cardBorder = isDead
    ? (isDay ? '#B8A0D8' : '#5A3A90')
    : (suspicion && suspicion !== 'neutral' ? activeColor : (isDay ? '#D4B896' : '#3D2570'));
  const nameColor = isDead
    ? (isDay ? '#5A3880' : '#C8B8E8')
    : (isDay ? '#2C1810' : '#E8D8FF');
  const chipBg = isDay ? '#F0E8DC' : '#1A1035';
  const chipBorder = isDay ? '#C8A880' : '#3D2570';
  const chipTextColor = isDead
    ? (isDay ? '#7A5080' : '#C0A8E0')
    : (isDay ? '#7A5C44' : '#A080C8');
  const placeholderColor = isDay ? '#A08060' : '#6050A0';

  return (
    <View style={[
      styles.boardCard,
      {
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderLeftWidth: 3,
        borderLeftColor: isDead ? (isDay ? '#9070B8' : '#7B4FD4') : (suspicion && suspicion !== 'neutral' ? activeColor : cardBorder),
      },
    ]}>
      <View style={styles.cardHeader}>
        <View style={styles.nameArea}>
          <Text style={[styles.playerName, { color: nameColor }]} numberOfLines={1}>
            {player.nickname}
          </Text>
          {isDead && (
            <View style={[styles.deadBadge, { backgroundColor: isDay ? 'rgba(144,112,184,0.2)' : 'rgba(123,79,212,0.25)' }]}>
              <Text style={[styles.deadBadgeText, { color: isDay ? '#7A50A0' : '#C084F5' }]}>Eliminated</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={onPickRole} style={styles.roleChip} activeOpacity={0.7}>
          {suspectedRole && ROLE_ICONS[suspectedRole] ? (
            <View style={[styles.roleChipInner, { borderColor: chipBorder, backgroundColor: chipBg }]}>
              <Image source={ROLE_ICONS[suspectedRole]} style={styles.roleChipIcon} resizeMode="contain" />
              <Text style={[styles.roleChipName, { color: chipTextColor }]} numberOfLines={1}>
                {ROLE_DEFINITIONS[suspectedRole]?.name}
              </Text>
            </View>
          ) : (
            <View style={[styles.roleChipEmpty, { borderColor: chipBorder }]}>
              <Image source={SUSPECT_ICON} style={styles.roleChipIconSm} resizeMode="contain" />
              <Text style={[styles.roleChipPlaceholder, { color: placeholderColor }]}>Role?</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {!isDead && (
        <View style={styles.suspicionStrip}>
          {SUSPICION_LEVELS.map((level) => {
            const isActive = currentSuspicion === level;
            const color = SUSPICION_COLORS[level];
            return (
              <TouchableOpacity
                key={level}
                onPress={() => onSelectSuspicion(level)}
                style={[
                  styles.suspicionBtn,
                  {
                    borderColor: isActive ? color : (isDay ? '#C8A880' : '#3D2570'),
                    backgroundColor: isActive ? `${color}28` : (isDay ? 'rgba(255,248,240,0.6)' : 'rgba(20,10,50,0.5)'),
                  },
                ]}
                activeOpacity={0.7}
              >
                <Image
                  source={SUSPICION_ICONS[level]}
                  style={[styles.suspicionIcon, { opacity: isActive ? 1 : 0.55 }]}
                  resizeMode="contain"
                />
                <Text style={[
                  styles.suspicionLabel,
                  { color: isActive ? color : (isDay ? '#7A5C44' : '#9880C0'), fontWeight: isActive ? '700' : '500' },
                ]}>
                  {SUSPICION_LABELS_SHORT[level]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function NotesPanel({ visible, onClose, theme, players, events, playerHooks, roleOptions = ALL_ROLES }) {
  const { notes, updateNotes, suspicions, setSuspicion, suspectedRoles, setSuspectedRole } = playerHooks;
  const [rolePickerFor, setRolePickerFor] = useState(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Notes & Deduction</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: theme.textSecondary }]}>Player Board</Text>
            {players.map((p) => (
              <PlayerBoardCard
                key={p.id}
                player={p}
                theme={theme}
                suspicion={suspicions[p.id]}
                suspectedRole={suspectedRoles[p.id]}
                onSelectSuspicion={(level) => setSuspicion(p.id, level)}
                onPickRole={() => setRolePickerFor(p.id)}
              />
            ))}

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

            <Text style={[styles.section, { color: theme.textSecondary }]}>Game Events</Text>
            <ClueLog events={events} clues={playerHooks.clues} theme={theme} />
            <View style={{ height: SPACING.xl }} />
          </ScrollView>
        </View>
      </View>

      <Modal visible={!!rolePickerFor} transparent animationType="fade" onRequestClose={() => setRolePickerFor(null)}>
        <View style={styles.roleOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRolePickerFor(null)} />
          <View style={[styles.rolePick, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.rolePickTitle, { color: theme.text }]}>Suspected Role</Text>
            <ScrollView style={styles.roleGridScroll} contentContainerStyle={styles.roleGrid}>
              {roleOptions.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => { setSuspectedRole(rolePickerFor, r); setRolePickerFor(null); }}
                  style={[styles.roleOption, { borderColor: theme.border }]}
                >
                  {ROLE_ICONS[r] ? (
                    <Image source={ROLE_ICONS[r]} style={styles.roleOptionIcon} resizeMode="contain" />
                  ) : (
                    <Text style={styles.roleOptionEmoji}>{ROLE_DEFINITIONS[r].emoji}</Text>
                  )}
                  <Text style={[styles.roleOptionText, { color: theme.text }]} numberOfLines={2}>
                    {ROLE_DEFINITIONS[r].name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.clearRoleBtn, { borderTopColor: theme.border }]}
              onPress={() => { setSuspectedRole(rolePickerFor, null); setRolePickerFor(null); }}
            >
              <Text style={[styles.clearRole, { color: theme.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  boardCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  nameArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  deadBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  deadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roleChip: {
    flexShrink: 0,
  },
  roleChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    maxWidth: 110,
  },
  roleChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
  },
  roleChipIcon: { width: 20, height: 20 },
  roleChipIconSm: { width: 16, height: 16, opacity: 0.5 },
  roleChipName: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  roleChipPlaceholder: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  suspicionStrip: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  suspicionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  suspicionIcon: {
    width: 20,
    height: 20,
  },
  suspicionLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  roleOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rolePick: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
  },
  rolePickTitle: {
    ...FONTS.subheading,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  roleGridScroll: { flexGrow: 0 },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.xs,
  },
  roleOption: {
    width: '49%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  roleOptionIcon: { width: 32, height: 32 },
  roleOptionEmoji: { fontSize: 26, width: 32, textAlign: 'center' },
  roleOptionText: { ...FONTS.caption, fontWeight: '700', flexShrink: 1 },
  clearRoleBtn: {
    borderTopWidth: 1,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  clearRole: {
    ...FONTS.body,
    textAlign: 'center',
  },
});
