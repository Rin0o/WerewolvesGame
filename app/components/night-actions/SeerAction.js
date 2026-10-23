import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS, SUSPICION_LABELS } from '../../constants/icons';
import { ROLE_DEFINITIONS } from '../../constants/roles';

const NIGHT_CHECK_ICON  = require('../../../assets/night_check.webp');

export default function SeerAction({ theme: t, players, seerTarget, onSelectTarget, onSubmit, seerResult, onDismissResult, suspicions = {}, suspectedRoles = {} }) {
  if (seerResult) {
    return (
      <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
        <View style={styles.actionTitleRow}>
          <Image source={ROLE_ICONS.seer} style={styles.actionTitleIcon} resizeMode="contain" />
          <Text style={[styles.actionTitle, { color: t.accent }]}>Your Vision</Text>
        </View>
        <View style={[styles.seerResult, { backgroundColor: t.surfaceAlt, borderColor: seerResult.isWolf ? t.danger : t.success }]}>
          <Image
            source={seerResult.isWolf ? ROLE_ICONS.werewolf : ROLE_ICONS.villager}
            style={styles.seerResultIcon}
            resizeMode="contain"
          />
          <Text style={[styles.seerResultName, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {seerResult.name}
          </Text>
          <Text style={[styles.seerResultText, { color: seerResult.isWolf ? t.danger : t.success }]}>
            {seerResult.isWolf ? 'is a Werewolf!' : 'is NOT a Werewolf.'}
          </Text>
        </View>
        <Text style={[styles.actionSub, { color: t.textMuted, marginTop: SPACING.sm }]}>
          Remember this. Dawn will come soon.
        </Text>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: t.primary, marginTop: SPACING.md }]}
          onPress={onDismissResult}
        >
          <Text style={styles.submitText}>Got it — I'm ready</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.seer} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Choose Someone to Reveal</Text>
      </View>
      <View style={[styles.targetBanner, { borderColor: seerTarget ? t.primary : t.border }]}>
        {seerTarget ? (
          <>
            <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>Revealing</Text>
            <Text style={[styles.bannerTargetName, { color: t.accent }]}>
              {players.find((p) => p.id === seerTarget)?.nickname}
            </Text>
            {(() => {
              const lvl = suspicions[seerTarget];
              const role = suspectedRoles[seerTarget];
              if (!((lvl && lvl !== 'neutral') || role)) return null;
              const suspicionColor = lvl === 'innocent' ? t.success : lvl === 'very_suspicious' ? t.danger : t.accent;
              return (
                <View style={styles.bannerBadgeRow}>
                  {lvl && lvl !== 'neutral' && (
                    <View style={[styles.bannerBadge, { borderColor: suspicionColor }]}>
                      <Text style={[styles.bannerBadgeText, { color: suspicionColor }]}>{SUSPICION_LABELS[lvl]}</Text>
                    </View>
                  )}
                  {role && (
                    <View style={[styles.bannerBadge, { borderColor: t.textSecondary }]}>
                      <Text style={[styles.bannerBadgeText, { color: t.textSecondary }]}>
                        {ROLE_DEFINITIONS[role]?.name || role}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </>
        ) : (
          <Text style={[styles.bannerStateLabel, { color: t.textMuted, textAlign: 'center' }]}>
            Select someone to reveal
          </Text>
        )}
      </View>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.playerRowBg, { borderColor: seerTarget === item.id ? t.danger : t.border }]}>
            <PlayerCard
              player={item}
              theme={{ ...t, surface: 'transparent', border: 'transparent' }}
              selected={seerTarget === item.id}
              onPress={() => onSelectTarget(item.id)}
              checkIcon={NIGHT_CHECK_ICON}
              noSelectionBorder
            />
          </View>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: seerTarget ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!seerTarget}
      >
        <Text style={styles.submitText}>Reveal Their Nature</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  targetBanner: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  bannerStateLabel: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bannerTargetName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 2,
  },
  bannerBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  bannerBadgeText: {
    ...FONTS.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  playerRowBg: NIGHT_ROW,
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  seerResult: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  seerResultIcon: { width: 72, height: 72, marginBottom: SPACING.sm },
  seerResultName: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  seerResultText: { ...FONTS.heading, textAlign: 'center' },
});
