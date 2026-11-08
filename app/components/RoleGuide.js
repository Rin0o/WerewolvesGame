import React, { useState } from 'react';
import { View, Text, Image, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ROLE, ROLE_DEFINITIONS, SIDE_CHANGING_ROLES } from '../constants/roles';
import { ROLE_ICONS } from '../constants/icons';
import RoleInfoModal from './RoleInfoModal';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const ALL_ROLES = Object.keys(ROLE_DEFINITIONS);
const SECTIONS = [
  { title: 'The Village', roles: ALL_ROLES.filter((r) => ROLE_DEFINITIONS[r].team === 'villagers' && !SIDE_CHANGING_ROLES.includes(r)) },
  { title: 'The Werewolves', roles: ALL_ROLES.filter((r) => ROLE_DEFINITIONS[r].team === 'werewolves' && r !== ROLE.WHITE_WOLF) },
  { title: 'Alone', roles: [ROLE.WHITE_WOLF] },
  { title: 'Either side', roles: SIDE_CHANGING_ROLES },
];

export default function RoleGuide({ visible, onClose, theme: t }) {
  const [openRole, setOpenRole] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]}>
        <View style={[styles.header, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>📖 Role Guide</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close the role guide">
            <Text style={[styles.close, { color: t.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.intro, { color: t.textMuted }]}>Tap a role to read its card.</Text>
          {SECTIONS.map((section) => (
            <View key={section.title}>
              <Text style={[styles.section, { color: t.textSecondary }]}>{section.title}</Text>
              {section.roles.map((role) => {
                const info = ROLE_DEFINITIONS[role];
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.row, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
                    onPress={() => setOpenRole(role)}
                  >
                    {ROLE_ICONS[role] ? (
                      <Image source={ROLE_ICONS[role]} style={styles.icon} resizeMode="contain" />
                    ) : (
                      <Text style={styles.emoji}>{info.emoji}</Text>
                    )}
                    <View style={styles.rowText}>
                      <Text style={[styles.name, { color: t.text }]}>{info.name}</Text>
                      <Text style={[styles.description, { color: t.textMuted }]} numberOfLines={2}>
                        {info.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <RoleInfoModal visible={!!openRole} onClose={() => setOpenRole(null)} theme={t} role={openRole} showCard />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  title: { ...FONTS.heading },
  close: { fontSize: 24 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  intro: { ...FONTS.caption, textAlign: 'center', marginBottom: SPACING.sm },
  section: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  icon: { width: 48, height: 48 },
  emoji: { fontSize: 36, width: 48, textAlign: 'center' },
  rowText: { flex: 1 },
  name: { ...FONTS.body, fontWeight: '700' },
  description: { ...FONTS.caption },
});
