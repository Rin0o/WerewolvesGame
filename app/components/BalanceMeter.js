import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { balanceVerdict } from '../game-logic/balance';
import { BALANCE_BANDS } from '../constants/balance';
import { ROLE } from '../constants/roles';
import { ROLE_ICONS } from '../constants/icons';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const WOLVES_COLOR = '#B8333A';
const BALANCED_COLOR = '#C8962A';
const VILLAGE_COLOR = '#3E9E5C';
const SIDE_COLORS = { wolves: WOLVES_COLOR, balanced: BALANCED_COLOR, village: VILLAGE_COLOR };

export default function BalanceMeter({ villageWin, theme: t, isHost = false, shared = false, onToggleShared }) {
  const verdict = balanceVerdict(villageWin);
  if (!verdict) return null;
  const percent = Math.round(villageWin * 100);
  const lowBand = BALANCE_BANDS.balanced * 100;

  return (
    <View style={[styles.box, { borderColor: t.border }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.textSecondary }]}>Balance</Text>
        <Text style={[styles.verdict, { color: SIDE_COLORS[verdict.side] }]}>{verdict.label}</Text>
      </View>

      <View style={styles.barWrap}>
        <View style={styles.bar}>
          <View style={[styles.zone, { flex: lowBand, backgroundColor: WOLVES_COLOR }]} />
          <View style={[styles.zone, { flex: 100 - 2 * lowBand, backgroundColor: BALANCED_COLOR }]} />
          <View style={[styles.zone, { flex: lowBand, backgroundColor: VILLAGE_COLOR }]} />
        </View>
        <View style={[styles.needle, { left: `${percent}%`, borderColor: t.text }]} />
      </View>
      <View style={styles.ends}>
        <View style={styles.endSide}>
          <Image source={ROLE_ICONS[ROLE.WEREWOLF]} style={styles.endIcon} resizeMode="contain" />
          <Text style={[styles.end, { color: t.textMuted }]}>Wolves</Text>
        </View>
        <View style={styles.endSide}>
          <Text style={[styles.end, { color: t.textMuted }]}>Village</Text>
          <Image source={ROLE_ICONS[ROLE.VILLAGER]} style={styles.endIcon} resizeMode="contain" />
        </View>
      </View>

      <Text style={[styles.caption, { color: t.text }]}>About {percent}% of games won by the village</Text>
      <Text style={[styles.footnote, { color: t.textMuted }]}>An estimate from simulated games, not a promise.</Text>

      {isHost && (
        <View style={styles.shareRow}>
          <Text style={[styles.shareLabel, { color: t.text }]}>Show to players</Text>
          <TouchableOpacity
            style={[styles.toggle, { backgroundColor: shared ? t.success : t.surfaceAlt, borderColor: shared ? t.success : t.border }]}
            onPress={() => onToggleShared(!shared)}
          >
            <Text style={[styles.toggleText, { color: shared ? '#fff' : t.textMuted }]}>{shared ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: 1, marginTop: SPACING.sm, paddingTop: SPACING.sm, gap: SPACING.xs },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...FONTS.caption, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  verdict: { ...FONTS.body, fontWeight: '800' },
  barWrap: { height: 22, justifyContent: 'center', marginTop: SPACING.xs },
  bar: { flexDirection: 'row', height: 12, borderRadius: RADIUS.full, overflow: 'hidden' },
  zone: { height: '100%', opacity: 0.85 },
  needle: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 22,
    marginLeft: -4,
    borderRadius: 3,
    borderWidth: 2,
    backgroundColor: '#FFF4DC',
  },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  endSide: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  endIcon: { width: 28, height: 28 },
  end: { ...FONTS.caption },
  caption: { ...FONTS.body, textAlign: 'center' },
  footnote: { ...FONTS.caption, fontStyle: 'italic', textAlign: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs },
  shareLabel: { ...FONTS.body },
  toggle: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1.5 },
  toggleText: { ...FONTS.caption, fontWeight: '700' },
});
