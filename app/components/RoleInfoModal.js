import React from 'react';
import { View, Text, Image, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { getRoleInfo } from '../game-logic/roles';
import { ROLE_ICONS } from '../constants/icons';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const TEAM_LABELS = {
  villagers: 'Village',
  werewolves: 'Werewolves',
};

export default function RoleInfoModal({ visible, onClose, theme: t, role, title, groups = [], children }) {
  if (!role) return null;
  const info = getRoleInfo(role);
  const shownGroups = groups.filter((g) => g.names.length > 0);
  const teamLabel = role === 'white_wolf' ? 'Alone' : TEAM_LABELS[info.team] || info.team;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: t.modalOverlay }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: t.overlay, borderColor: t.glassBorder || t.border }]}>
          <ScrollView contentContainerStyle={styles.content}>
            {title && <Text style={[styles.caption, { color: t.textSecondary }]}>{title}</Text>}
            {ROLE_ICONS[role] ? (
              <Image source={ROLE_ICONS[role]} style={styles.icon} resizeMode="contain" />
            ) : (
              <Text style={styles.emoji}>{info.emoji}</Text>
            )}
            <Text style={[styles.name, { color: t.text }]}>{info.name}</Text>
            <View style={[styles.teamChip, { borderColor: info.team === 'werewolves' ? t.danger : t.success }]}>
              <Text style={[styles.teamText, { color: info.team === 'werewolves' ? t.danger : t.success }]}>
                Team: {teamLabel}
              </Text>
            </View>
            <Text style={[styles.body, { color: t.textSecondary, fontStyle: 'italic' }]}>{info.description}</Text>

            {shownGroups.map((group) => (
              <View key={group.label} style={[styles.group, { borderColor: t.accent }]}>
                <Text style={[styles.sectionLabel, { color: t.accent }]}>{group.label}</Text>
                {group.names.map((name) => (
                  <Text key={name} style={[styles.body, { color: t.text }]}>• {name}</Text>
                ))}
              </View>
            ))}

            <Text style={[styles.sectionLabel, { color: t.primary }]}>Goal</Text>
            <Text style={[styles.body, { color: t.text }]}>{info.goal}</Text>
            {info.ability && (
              <>
                <Text style={[styles.sectionLabel, { color: t.primary }]}>Ability</Text>
                <Text style={[styles.body, { color: t.text }]}>{info.ability}</Text>
              </>
            )}
            {children}
            <Text style={[styles.caption, { color: t.textMuted, marginTop: SPACING.md }]}>Tap outside to close</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  card: { width: '100%', maxWidth: 420, maxHeight: '85%', borderRadius: RADIUS.lg, borderWidth: 1 },
  content: { padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  icon: { width: 96, height: 96 },
  emoji: { fontSize: 64 },
  name: { ...FONTS.heading },
  teamChip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 3 },
  teamText: { ...FONTS.caption, fontWeight: '700' },
  group: { alignSelf: 'stretch', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: 2 },
  sectionLabel: { ...FONTS.subheading, alignSelf: 'flex-start', marginTop: SPACING.sm },
  body: { ...FONTS.body, alignSelf: 'stretch' },
  caption: { ...FONTS.caption, textAlign: 'center' },
});
