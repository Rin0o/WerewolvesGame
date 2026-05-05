import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Modal, StyleSheet, ScrollView } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import { ROLE_ICONS } from '../../constants/icons';

const DISPLAY_SECONDS = 8;

export default function LynchResultModal({ visible, onExpire, theme: t, result, players, roles }) {
  const [countdown, setCountdown] = useState(DISPLAY_SECONDS);
  const countRef = useRef(DISPLAY_SECONDS);

  useEffect(() => {
    if (!visible) {
      countRef.current = DISPLAY_SECONDS;
      setCountdown(DISPLAY_SECONDS);
      return;
    }
    countRef.current = DISPLAY_SECONDS;
    setCountdown(DISPLAY_SECONDS);
    const interval = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!result) return null;
  const { tallyMap, eliminatedId, tie, votes } = result;

  const sortedEntries = Object.entries(tallyMap).sort(([, a], [, b]) => b - a);
  const eliminatedPlayer = eliminatedId ? players.find((p) => p.id === eliminatedId) : null;
  const roleKey = eliminatedId ? roles?.[eliminatedId] : null;
  const roleInfo = roleKey ? ROLE_DEFINITIONS[roleKey] : null;

  const isLynch = !!eliminatedId;
  const isTie = !eliminatedId && tie;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: isLynch ? t.danger : t.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            <Text style={[styles.header, { color: t.textSecondary }]}>
              {isLynch ? 'THE VILLAGE HAS DECIDED' : isTie ? 'THE VOTE IS TIED' : 'NO VERDICT'}
            </Text>

            {eliminatedPlayer ? (
              <>
                {roleKey && ROLE_ICONS[roleKey] ? (
                  <Image source={ROLE_ICONS[roleKey]} style={styles.roleIcon} resizeMode="contain" />
                ) : roleInfo ? (
                  <Text style={styles.roleEmoji}>{roleInfo.emoji}</Text>
                ) : null}
                <Text style={[styles.victimName, { color: t.danger }]}>{eliminatedPlayer.nickname}</Text>
                <Text style={[styles.verdictChip, { color: t.danger }]}>⚔️ LYNCHED</Text>
                {roleInfo && (
                  <Text style={[styles.roleReveal, { color: t.textMuted }]}>
                    They were the{' '}
                    <Text style={{ fontWeight: '700', color: t.text }}>{roleInfo.name}</Text>
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.noVictimEmoji}>{isTie ? '⚖️' : '🌫️'}</Text>
                <Text style={[styles.noVictimText, { color: t.textMuted }]}>
                  {isTie
                    ? 'The village could not reach a decision.'
                    : 'The village remained silent.'}
                </Text>
              </>
            )}

            {sortedEntries.length > 0 && (
              <View style={[styles.tallyBox, { borderTopColor: t.border }]}>
                <Text style={[styles.tallyTitle, { color: t.textSecondary }]}>VOTE BREAKDOWN</Text>
                {sortedEntries.map(([targetId, count]) => {
                  const name = players.find((p) => p.id === targetId)?.nickname || '?';
                  const voterNames = Object.entries(votes)
                    .filter(([, v]) => v?.confirmed && v?.target === targetId)
                    .map(([vid]) => players.find((p) => p.id === vid)?.nickname || '?')
                    .join(', ');
                  return (
                    <View key={targetId} style={styles.tallyRow}>
                      <Text style={[styles.tallyName, { color: targetId === eliminatedId ? t.danger : t.text }]}>
                        {name} — {count} vote{count !== 1 ? 's' : ''}
                      </Text>
                      {voterNames ? (
                        <Text style={[styles.voterNames, { color: t.textMuted }]}>{voterNames}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={[styles.countdown, { color: t.textMuted }]}>
              {countdown > 0 ? `Continuing in ${countdown}…` : 'Continuing…'}
            </Text>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,10,5,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  header: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleIcon: { width: 96, height: 96, marginVertical: SPACING.sm },
  roleEmoji: { fontSize: 72 },
  victimName: { fontSize: 30, fontWeight: '800', textAlign: 'center', fontFamily: undefined },
  verdictChip: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  roleReveal: { ...FONTS.body, textAlign: 'center' },
  noVictimEmoji: { fontSize: 64 },
  noVictimText: { ...FONTS.body, textAlign: 'center' },
  tallyBox: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
    alignItems: 'flex-start',
    marginTop: SPACING.xs,
  },
  tallyTitle: {
    ...FONTS.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    alignSelf: 'center',
  },
  tallyRow: { gap: 2, width: '100%' },
  tallyName: { ...FONTS.body, fontWeight: '600' },
  voterNames: { ...FONTS.caption, lineHeight: 16 },
  countdown: {
    ...FONTS.caption,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
});
