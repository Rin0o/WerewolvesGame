import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS, DEAD_ICON, SUSPICION_LABELS } from '../../constants/icons';
import { ROLE_DEFINITIONS } from '../../constants/roles';

const PLAYER_ROW_NIGHT  = require('../../../assets/player_row_night.png');
const NIGHT_CHECK_ICON  = require('../../../assets/night_check.png');
const WITCH_LIVE_POTION  = require('../../../assets/role_actions/live_potion.png');
const WITCH_DEATH_POTION = require('../../../assets/role_actions/death_potion.png');
const WITCH_DO_NOTHING   = require('../../../assets/role_actions/witch_do_nothing.png');

export default function WitchAction({
  theme: t,
  players,
  victimPlayer,
  victimId,
  witchPotions,
  witchChoice,
  witchPoisonTarget,
  onSelectChoice,
  onSelectPoisonTarget,
  onSave,
  onPoison,
  onSkip,
  suspicions = {},
  suspectedRoles = {},
}) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.witch} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Witch's Turn</Text>
      </View>

      {victimPlayer ? (
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>
          The werewolves killed: {victimPlayer.nickname}
        </Text>
      ) : (
        <Text style={[styles.actionSub, { color: t.textSecondary }]}>No one was killed tonight.</Text>
      )}

      <View style={styles.witchActionRow}>
        <TouchableOpacity
          style={[styles.witchActionBtn, (!witchPotions.save || !victimPlayer) && styles.witchActionDimmed]}
          onPress={onSave}
          disabled={!witchPotions.save || !victimPlayer}
        >
          <Image source={WITCH_LIVE_POTION} style={styles.witchActionImg} resizeMode="contain" />
          <Text style={[styles.witchActionLabel, { color: t.textSecondary }]}>
            {witchPotions.save ? 'Save' : 'Used'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.witchActionBtn,
            !witchPotions.poison && styles.witchActionDimmed,
            witchChoice === 'poison' && { borderColor: t.accent, borderWidth: 2 },
          ]}
          onPress={() => onSelectChoice(witchChoice === 'poison' ? null : 'poison')}
          disabled={!witchPotions.poison}
        >
          <Image source={WITCH_DEATH_POTION} style={styles.witchActionImg} resizeMode="contain" />
          <Text style={[styles.witchActionLabel, { color: t.textSecondary }]}>
            {witchPotions.poison ? 'Poison' : 'Used'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.witchActionBtn} onPress={onSkip}>
          <Image source={WITCH_DO_NOTHING} style={styles.witchActionImg} resizeMode="contain" />
          <Text style={[styles.witchActionLabel, { color: t.textSecondary }]}>Do Nothing</Text>
        </TouchableOpacity>
      </View>

      {witchChoice === 'poison' && witchPotions.poison && (
        <>
          <View style={[styles.targetBanner, { borderColor: witchPoisonTarget ? t.primaryDark : t.accent, marginTop: SPACING.md }]}>
            {witchPoisonTarget ? (
              <>
                <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>Poisoning</Text>
                <Text style={[styles.bannerTargetName, { color: t.accent }]}>
                  {players.find((p) => p.id === witchPoisonTarget)?.nickname}
                </Text>
                {(() => {
                  const lvl = suspicions[witchPoisonTarget];
                  const role = suspectedRoles[witchPoisonTarget];
                  if (!((lvl && lvl !== 'neutral') || role)) return null;
                  const suspicionColor = lvl === 'innocent' ? t.success : lvl === 'very_suspicious' ? t.danger : t.primaryDark;
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
                Choose who to poison
              </Text>
            )}
          </View>
          <FlatList
            data={players.filter((p) => p.id !== victimId)}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <ImageBackground
                source={PLAYER_ROW_NIGHT}
                style={[styles.playerRowBg, { borderWidth: 3, borderColor: witchPoisonTarget === item.id ? t.accent : 'transparent' }]}
                imageStyle={styles.playerRowImg}
                resizeMode="stretch"
              >
                <PlayerCard
                  player={item}
                  theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                  selected={witchPoisonTarget === item.id}
                  onPress={() => onSelectPoisonTarget(item.id)}
                  checkIcon={NIGHT_CHECK_ICON}
                  noSelectionBorder
                />
              </ImageBackground>
            )}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: witchPoisonTarget ? t.danger : t.border, marginTop: SPACING.sm }]}
            onPress={onPoison}
            disabled={!witchPoisonTarget}
          >
            <View style={styles.btnIconRow}>
              <Image source={DEAD_ICON} style={styles.btnIcon} resizeMode="contain" />
              <Text style={styles.submitText}>Confirm Poison</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
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
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden', borderRadius: RADIUS.md },
  playerRowImg: { borderRadius: RADIUS.md },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
  witchActionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  witchActionBtn: { flex: 1, alignItems: 'center', borderRadius: RADIUS.md, padding: SPACING.xs },
  witchActionImg: { width: '100%', height: 100 },
  witchActionLabel: { ...FONTS.caption, marginTop: 4, fontWeight: '600' },
  witchActionDimmed: { opacity: 0.3 },
});
