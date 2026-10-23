import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS, SUSPICION_LABELS } from '../../constants/icons';
import { ROLE_DEFINITIONS } from '../../constants/roles';

const NIGHT_CONFIRM_ICON = require('../../../assets/night_confirm.webp');
const NIGHT_CHECK_ICON   = require('../../../assets/night_check.webp');

export default function WerewolfAction({
  theme: t, players, observeOnly, revoteTargets = null, pack = [], packVotes = {}, playerId, wolfTarget,
  onSelectTarget, onSubmit, suspicions = {}, suspectedRoles = {},
}) {
  const myVote = packVotes[playerId];
  const votesCast = pack.filter((w) => packVotes[w.id]).length;
  const votersFor = (targetId) => pack.filter((w) => packVotes[w.id] === targetId)
    .map((w) => (w.id === playerId ? 'You' : w.nickname));

  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.werewolf} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>
          {observeOnly ? 'First Night — Observe' : 'Choose a Victim'}
        </Text>
      </View>

      {observeOnly ? (
        <>
          <Text style={[styles.actionSub, { color: t.textSecondary }]}>
            The first night is for watching. No hunt tonight — coordinate with your pack.
          </Text>
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} activeOpacity={0.8}>
            <Image source={NIGHT_CONFIRM_ICON} style={styles.submitBtnImg} resizeMode="contain" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          {revoteTargets && (
            <View style={[styles.revoteBanner, { borderColor: t.accent }]}>
              <Text style={[styles.bannerStateLabel, { color: t.accent }]}>The pack is split — vote again</Text>
              <Text style={[styles.actionSub, { color: t.text, marginBottom: 0 }]}>
                Choose between {players.map((p) => p.nickname).join(' and ')}. If the pack is split again, nobody dies tonight.
              </Text>
            </View>
          )}
          <View style={[styles.targetBanner, { borderColor: wolfTarget ? t.danger : t.border }]}>
            {wolfTarget ? (
              <>
                <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>
                  {wolfTarget === myVote ? 'Your vote' : 'Targeting'}
                </Text>
                <Text style={[styles.bannerTargetName, { color: t.danger }]}>
                  {players.find((p) => p.id === wolfTarget)?.nickname}
                </Text>
                {(() => {
                  const lvl = suspicions[wolfTarget];
                  const role = suspectedRoles[wolfTarget];
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
                Select a target to eliminate
              </Text>
            )}
          </View>
          <FlatList
            data={players}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const voters = votersFor(item.id);
              return (
                <View style={[styles.playerRowBg, { borderColor: wolfTarget === item.id ? t.danger : t.border }]}>
                  <PlayerCard
                    player={item}
                    theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                    selected={wolfTarget === item.id}
                    onPress={() => onSelectTarget(item.id)}
                    checkIcon={NIGHT_CHECK_ICON}
                    noSelectionBorder
                  />
                  {voters.length > 0 && (
                    <Text style={[styles.packVoteLine, { color: t.danger }]}>
                      🐺 {voters.join(', ')}
                    </Text>
                  )}
                </View>
              );
            }}
          />
          <Text style={[styles.packProgress, { color: t.textSecondary }]}>
            {myVote
              ? `Pack votes: ${votesCast} of ${pack.length}. The hunt ends when every wolf has voted — you can still change yours.`
              : `Pack votes: ${votesCast} of ${pack.length}. The victim with the most votes is taken; a tie means a second vote.`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  playerRowBg: NIGHT_ROW,
  revoteBanner: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
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
  packVoteLine: { ...FONTS.caption, fontWeight: '700', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  packProgress: { ...FONTS.caption, textAlign: 'center', marginTop: SPACING.sm },
  submitBtn: { alignItems: 'center', marginTop: SPACING.md },
  submitBtnImg: { width: '100%', height: 70 },
});
