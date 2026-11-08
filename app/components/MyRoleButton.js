import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import RoleInfoModal from './RoleInfoModal';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { relatedGroups } from '../utils/relatedGroups';
import { ROLE_ICONS } from '../constants/icons';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const SHOW_ROLE_ICON = require('../../assets/show_role.webp');
const ROLE_ORDER = Object.keys(ROLE_DEFINITIONS);

function RolesInGame({ theme: t, composition, onSelectRole }) {
  const entries = Object.entries(composition)
    .sort(([a], [b]) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return (
    <View style={styles.rolesSection}>
      <Text style={[styles.rolesTitle, { color: t.primary }]}>Roles in this game</Text>
      <Text style={[styles.rolesHint, { color: t.textMuted }]}>As dealt at the start. Tap one to read it.</Text>
      <View style={styles.rolesRow}>
        {entries.map(([role, count]) => (
          <TouchableOpacity
            key={role}
            style={[styles.rolePill, { borderColor: t.border }]}
            onPress={() => onSelectRole(role)}
          >
            {ROLE_ICONS[role] ? (
              <Image source={ROLE_ICONS[role]} style={styles.roleIcon} resizeMode="contain" />
            ) : (
              <Text style={styles.roleEmoji}>{ROLE_DEFINITIONS[role]?.emoji}</Text>
            )}
            {count > 1 && <Text style={[styles.roleCount, { color: t.text }]}>{count}×</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function MyRoleButton({ theme: t, gs, room }) {
  const [open, setOpen] = useState(false);
  const [infoRole, setInfoRole] = useState(null);
  if (!gs.myRole || gs.isNarrator) return null;
  const composition = room?.roleComposition;

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)} accessibilityLabel="Show my role">
        <Image source={SHOW_ROLE_ICON} style={styles.icon} resizeMode="contain" />
      </TouchableOpacity>
      <RoleInfoModal
        visible={open}
        onClose={() => setOpen(false)}
        theme={t}
        role={gs.myRole}
        title="Your secret role"
        groups={relatedGroups(gs, room)}
        infected={!!gs.isInfected}
      >
        {composition && <RolesInGame theme={t} composition={composition} onSelectRole={setInfoRole} />}
        <RoleInfoModal visible={!!infoRole} onClose={() => setInfoRole(null)} theme={t} role={infoRole} />
      </RoleInfoModal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 4 },
  icon: { width: 44, height: 44 },
  rolesSection: { alignSelf: 'stretch', marginTop: SPACING.md, gap: SPACING.xs },
  rolesTitle: { ...FONTS.subheading },
  rolesHint: { ...FONTS.caption },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  roleIcon: { width: 40, height: 40 },
  roleEmoji: { fontSize: 28 },
  roleCount: { ...FONTS.body, fontWeight: '700' },
});
