import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS, SUSPICION_LABELS } from '../../constants/icons';
import { ROLE_DEFINITIONS } from '../../constants/roles';

const PLAYER_ROW_DAY = require('../../../assets/player_row_day.png');

export default function HunterSection({ theme: t, players, playerId, hunterTriggered, hunterTarget, onSelectTarget, onSubmit, suspicions = {}, suspectedRoles = {} }) {
  return (
    <View style={[styles.hunterBox, { backgroundColor: t.glassBg, borderColor: t.accent }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.hunter} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.hunterTitle, { color: t.primary }]}>The Hunter's Final Shot</Text>
      </View>
      <Text style={[styles.hunterSub, { color: t.textSecondary }]}>
        {hunterTriggered === playerId
          ? 'You are the Hunter! Choose someone to take down with you.'
          : `${players.find((p) => p.id === hunterTriggered)?.nickname} is the Hunter — choosing their final target...`}
      </Text>

      {hunterTriggered === playerId && (
        <>
          <View style={[styles.targetBanner, { borderColor: hunterTarget ? t.danger : t.border }]}>
            {hunterTarget ? (
              <>
                <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>Taking down</Text>
                <Text style={[styles.bannerTargetName, { color: t.danger }]}>
                  {players.find((p) => p.id === hunterTarget)?.nickname}
                </Text>
                {(() => {
                  const lvl = suspicions[hunterTarget];
                  const role = suspectedRoles[hunterTarget];
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
                Choose your final target
              </Text>
            )}
          </View>
          <FlatList
            data={players.filter((p) => p.isAlive && p.id !== playerId)}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <ImageBackground source={PLAYER_ROW_DAY} style={styles.playerRowBg} imageStyle={styles.playerRowImg} resizeMode="stretch">
                <PlayerCard
                  player={item}
                  theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                  selected={hunterTarget === item.id}
                  onPress={() => onSelectTarget(item.id)}
                />
              </ImageBackground>
            )}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: hunterTarget ? t.danger : t.border }]}
            onPress={onSubmit}
            disabled={!hunterTarget}
          >
            <View style={styles.btnIconRow}>
              <Image source={ROLE_ICONS.hunter} style={styles.btnIcon} resizeMode="contain" />
              <Text style={styles.submitBtnText}>Fire!</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hunterBox: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
  },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  actionTitleIcon: { width: 40, height: 40 },
  hunterTitle: { ...FONTS.heading, marginBottom: SPACING.xs },
  hunterSub: { ...FONTS.body, marginBottom: SPACING.md },
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
  playerRowBg: { marginBottom: SPACING.xs, overflow: 'hidden' },
  playerRowImg: { borderRadius: RADIUS.md },
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitBtnText: { ...FONTS.button, color: '#fff' },
  btnIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnIcon: { width: 26, height: 26 },
});
