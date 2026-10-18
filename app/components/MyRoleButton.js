import React, { useState } from 'react';
import { Image, TouchableOpacity, StyleSheet } from 'react-native';
import RoleInfoModal from './RoleInfoModal';
import { ROLE } from '../constants/roles';

const SHOW_ROLE_ICON = require('../../assets/show_role.webp');

function namesOf(ids, players) {
  return ids
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => (p.isAlive ? p.nickname : `${p.nickname} (dead)`));
}

export function relatedGroups(gs, room) {
  const players = room?.players || [];
  const groups = [
    { label: 'Your pack', names: namesOf(gs.fellowWolves || [], players) },
    { label: 'Your sister', names: namesOf(gs.fellowSisters || [], players) },
    { label: 'Your lover', names: gs.myLover ? namesOf([gs.myLover.id], players) : [] },
  ];
  if (gs.myRole === ROLE.CUPID && room?.lovers) {
    groups.push({ label: 'The lovers you bound', names: namesOf(room.lovers, players) });
  }
  return groups;
}

export default function MyRoleButton({ theme: t, gs, room }) {
  const [open, setOpen] = useState(false);
  if (!gs.myRole || gs.isNarrator) return null;

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
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 4 },
  icon: { width: 54, height: 54 },
});
