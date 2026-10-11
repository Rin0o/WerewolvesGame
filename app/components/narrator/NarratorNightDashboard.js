import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE, ROLE_DEFINITIONS, isWolfRole } from '../../constants/roles';
import { ROLE_ICONS } from '../../constants/icons';

const SUBPHASE_LABELS = {
  thief:    'Thief Chooses a Role',
  cupid:    'Cupid Selects Lovers',
  wolf_hound: 'Wolf Hound Picks a Side',
  werewolf: 'Werewolves Hunt',
  white_wolf: 'White Wolf Turns on the Pack',
  witch:    'Witch Decides',
  seer:     'Seer Inspects',
  saviour:  'Saviour Protects',
  done:     'Night Resolves',
};

const SUBPHASE_ICON_KEY = {
  thief: 'thief', cupid: 'cupid', wolf_hound: 'wolf_hound', werewolf: 'werewolf',
  white_wolf: 'white_wolf', witch: 'witch', seer: 'seer', saviour: 'saviour',
};

export default function NarratorNightDashboard({
  theme: t,
  players,
  roles,
  nightActions = {},
  phase,
  nightSubPhase,
  actionDone,
  onAdvance,
}) {
  const wolfTargetPlayer  = nightActions.werewolf  ? players.find((p) => p.id === nightActions.werewolf)  : null;
  const saviourProtected  = nightActions.saviour   ? players.find((p) => p.id === nightActions.saviour)   : null;
  const witchSavedPlayer  = nightActions.witchSave ? players.find((p) => p.id === nightActions.witchSave) : null;
  const witchPoisoned     = nightActions.witchPoison ? players.find((p) => p.id === nightActions.witchPoison) : null;
  const cupidLovers       = Array.isArray(nightActions.cupid) ? nightActions.cupid.map((id) => players.find((p) => p.id === id)?.nickname).filter(Boolean) : null;
  const thiefRole         = nightActions.thief;
  const seerTarget        = nightActions.seer ? players.find((p) => p.id === nightActions.seer) : null;
  const seerRevealedRole  = seerTarget ? roles[seerTarget.id] : null;
  const seerIsWolf        = isWolfRole(seerRevealedRole);
  const wolfObserved      = nightActions.werewolfObserved === true;
  const houndSide         = nightActions.wolfHound;
  const whiteWolfPrey     = nightActions.whiteWolf ? players.find((p) => p.id === nightActions.whiteWolf) : null;

  const subPhaseIconKey = SUBPHASE_ICON_KEY[nightSubPhase];
  const subPhaseIcon = subPhaseIconKey ? ROLE_ICONS[subPhaseIconKey] : null;

  const hasAnyAction =
    wolfTargetPlayer || wolfObserved || saviourProtected || witchSavedPlayer ||
    witchPoisoned || nightActions.witchSkip || cupidLovers || thiefRole || seerTarget ||
    houndSide || whiteWolfPrey || nightActions.whiteWolfSkip;

  return (
    <View style={[styles.dashboard, { backgroundColor: t.glassCard, borderColor: t.primary }]}>

      {/* Narrator badge */}
      <View style={[styles.narratorBadge, { backgroundColor: t.primary }]}>
        <Text style={styles.narratorBadgeText}>📖 NARRATOR VIEW</Text>
      </View>

      {/* Current sub-phase */}
      <View style={[styles.subPhaseRow, { borderColor: actionDone ? t.success : t.accent }]}>
        {subPhaseIcon && (
          <Image source={subPhaseIcon} style={styles.subPhaseIcon} resizeMode="contain" />
        )}
        <View style={styles.subPhaseTextCol}>
          <Text style={[styles.subPhaseLabel, { color: t.textSecondary }]}>ACTIVE PHASE</Text>
          <Text style={[styles.subPhaseTitle, { color: t.accent }]}>
            {SUBPHASE_LABELS[nightSubPhase] || 'Waiting...'}
          </Text>
          <Text style={[styles.subPhaseStatus, { color: actionDone ? t.success : t.textMuted }]}>
            {actionDone ? '✓ Action submitted' : '⏳ Waiting for action'}
          </Text>
        </View>
      </View>

      {/* Submitted actions summary */}
      {hasAnyAction && (
        <View style={[styles.actionsBox, { borderColor: t.border }]}>
          <Text style={[styles.actionsTitle, { color: t.textSecondary }]}>SUBMITTED ACTIONS</Text>

          {wolfTargetPlayer && (
            <ActionRow icon={ROLE_ICONS.werewolf} label="Wolf target" value={wolfTargetPlayer.nickname} valueColor={t.danger} theme={t} />
          )}
          {wolfObserved && phase === 1 && (
            <ActionRow icon={ROLE_ICONS.werewolf} label="Wolves" value="Observed (night 1)" valueColor={t.textMuted} theme={t} />
          )}
          {houndSide && (
            <ActionRow
              icon={ROLE_ICONS.wolf_hound}
              label="Wolf Hound chose"
              value={houndSide === ROLE.WEREWOLF ? 'The Pack' : 'The Village'}
              valueColor={houndSide === ROLE.WEREWOLF ? t.danger : t.success}
              theme={t}
            />
          )}
          {whiteWolfPrey && (
            <ActionRow icon={ROLE_ICONS.white_wolf} label="White Wolf devoured" value={whiteWolfPrey.nickname} valueColor={t.danger} theme={t} />
          )}
          {nightActions.whiteWolfSkip && (
            <ActionRow icon={ROLE_ICONS.white_wolf} label="White Wolf" value="Spared the pack" valueColor={t.textMuted} theme={t} />
          )}
          {saviourProtected && (
            <ActionRow icon={ROLE_ICONS.saviour} label="Saviour protected" value={saviourProtected.nickname} valueColor={t.success} theme={t} />
          )}
          {witchSavedPlayer && (
            <ActionRow icon={ROLE_ICONS.witch} label="Witch saved" value={witchSavedPlayer.nickname} valueColor={t.success} theme={t} />
          )}
          {witchPoisoned && (
            <ActionRow icon={ROLE_ICONS.witch} label="Witch poisoned" value={witchPoisoned.nickname} valueColor={t.danger} theme={t} />
          )}
          {nightActions.witchSkip && (
            <ActionRow icon={ROLE_ICONS.witch} label="Witch" value="Did nothing" valueColor={t.textMuted} theme={t} />
          )}
          {seerTarget && (
            <ActionRow
              icon={ROLE_ICONS.seer}
              label="Seer inspected"
              value={`${seerTarget.nickname} → ${seerIsWolf ? '🐺 Werewolf!' : `${ROLE_DEFINITIONS[seerRevealedRole]?.name || 'Villager'}`}`}
              valueColor={seerIsWolf ? t.danger : t.success}
              theme={t}
            />
          )}
          {cupidLovers && (
            <ActionRow icon={ROLE_ICONS.cupid} label="Lovers" value={cupidLovers.join(' ❤️ ')} valueColor={t.accent} theme={t} />
          )}
          {thiefRole && (
            <ActionRow icon={ROLE_ICONS.thief} label="Thief stole" value={ROLE_DEFINITIONS[thiefRole]?.name || thiefRole} valueColor={t.accent} theme={t} />
          )}
        </View>
      )}

      {/* Player roster */}
      <View style={[styles.rosterBox, { borderColor: t.border }]}>
        <Text style={[styles.actionsTitle, { color: t.textSecondary }]}>PLAYERS</Text>
        {players.filter((p) => !p.isNarrator).map((p) => {
          const role = roles[p.id];
          const roleDef = role ? ROLE_DEFINITIONS[role] : null;
          const roleIcon = role ? ROLE_ICONS[role] : null;
          return (
            <View key={p.id} style={styles.rosterRow}>
              <View style={[styles.rosterDot, { backgroundColor: p.isAlive ? t.success : t.textMuted }]} />
              <Text style={[styles.rosterName, { color: p.isAlive ? t.text : t.textMuted }]}>
                {p.nickname}
              </Text>
              {roleIcon ? (
                <Image source={roleIcon} style={styles.rosterRoleIcon} resizeMode="contain" />
              ) : null}
              <Text style={[styles.rosterRole, { color: p.isAlive ? t.accent : t.textMuted }]}>
                {roleDef?.name || '—'}
              </Text>
              {!p.isAlive && <Text style={[styles.rosterDead, { color: t.textMuted }]}> (dead)</Text>}
            </View>
          );
        })}
      </View>

      {/* Action buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: actionDone ? t.success : t.accent }]}
          onPress={onAdvance}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>{actionDone ? 'Next →' : 'Skip →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActionRow({ icon, label, value, valueColor, theme: t }) {
  return (
    <View style={styles.actionRow}>
      {icon ? <Image source={icon} style={styles.actionIcon} resizeMode="contain" /> : <View style={styles.actionIcon} />}
      <Text style={[styles.actionLabel, { color: t.textSecondary }]}>{label}:</Text>
      <Text style={[styles.actionValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  narratorBadge: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  narratorBadgeText: {
    ...FONTS.caption,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  subPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  subPhaseIcon: { width: 36, height: 36 },
  subPhaseTextCol: { flex: 1 },
  subPhaseLabel: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  subPhaseTitle: { ...FONTS.subheading, fontWeight: '700' },
  subPhaseStatus: { ...FONTS.caption, marginTop: 2 },
  actionsBox: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.xs,
  },
  actionsTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 2,
  },
  actionIcon: { width: 20, height: 20 },
  actionLabel: { ...FONTS.caption, fontWeight: '600' },
  actionValue: { ...FONTS.caption, fontWeight: '700', flex: 1 },
  rosterBox: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 3,
  },
  rosterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rosterName: { ...FONTS.body, flex: 1 },
  rosterRoleIcon: { width: 20, height: 20 },
  rosterRole: { ...FONTS.caption, fontWeight: '600' },
  rosterDead: { ...FONTS.caption },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  nextBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    ...FONTS.button,
    color: '#fff',
  },
});
