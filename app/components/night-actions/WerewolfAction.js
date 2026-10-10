import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS, SUSPICION_LABELS } from '../../constants/icons';
import { ROLE_DEFINITIONS } from '../../constants/roles';

const NIGHT_CHAT_ICON    = require('../../../assets/night_chat.png');
const NIGHT_CONFIRM_ICON = require('../../../assets/night_confirm.png');
const NIGHT_CHECK_ICON   = require('../../../assets/night_check.png');

export default function WerewolfAction({ theme: t, players, phase, wolfTarget, onSelectTarget, onSubmit, onOpenChat, suspicions = {}, suspectedRoles = {} }) {
  return (
    <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
      <View style={styles.actionTitleRow}>
        <Image source={ROLE_ICONS.werewolf} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>
          {phase === 1 ? 'First Night — Observe' : 'Choose a Victim'}
        </Text>
      </View>

      {phase === 1 ? (
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
          <View style={[styles.targetBanner, { borderColor: wolfTarget ? t.danger : t.border }]}>
            {wolfTarget ? (
              <>
                <Text style={[styles.bannerStateLabel, { color: t.textSecondary }]}>Targeting</Text>
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
            renderItem={({ item }) => (
              <View style={[styles.playerRowBg, { borderColor: wolfTarget === item.id ? t.danger : t.border }]}>
                <PlayerCard
                  player={item}
                  theme={{ ...t, surface: 'transparent', border: 'transparent' }}
                  selected={wolfTarget === item.id}
                  onPress={() => onSelectTarget(item.id)}
                  checkIcon={NIGHT_CHECK_ICON}
                  noSelectionBorder
                />
              </View>
            )}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { opacity: wolfTarget ? 1 : 0.35 }]}
            onPress={onSubmit}
            disabled={!wolfTarget}
            activeOpacity={0.8}
          >
            <Image source={NIGHT_CONFIRM_ICON} style={styles.submitBtnImg} resizeMode="contain" />
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.chatBtn} onPress={onOpenChat}>
        <Image source={NIGHT_CHAT_ICON} style={styles.chatBtnImg} resizeMode="contain" />
      </TouchableOpacity>
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
  playerRowBg: { marginBottom: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 2, backgroundColor: 'rgba(20,10,50,0.82)' },
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
  submitBtn: { alignItems: 'center', marginTop: SPACING.md },
  submitBtnImg: { width: '100%', height: 70 },
  chatBtn: { alignItems: 'center', marginTop: SPACING.sm },
  chatBtnImg: { width: '100%', height: 70 },
});
