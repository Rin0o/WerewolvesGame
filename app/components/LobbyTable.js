import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { tableLayout, TABLE_IMAGE } from './SeatingTable';
import CollapseHeader from './CollapseHeader';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const TABLE_MAX_SIZE = 380;
const CANDLE_GOLD = '#FFD27A';

function hintFor({ canSit, isHost, selectedId, mySeat }) {
  if (isHost && selectedId) return 'Now tap another seat to move them there, or swap with whoever sits there.';
  if (isHost) return canSit
    ? 'Tap a free seat to sit down. Tap a player, then another seat, to move or swap them.'
    : 'Tap a player, then another seat, to move or swap them.';
  if (mySeat === -1) return 'Tap a free seat to sit down.';
  return 'Tap another free seat to move.';
}

export default function LobbyTable({ theme: t, chart, standing, playerId, isHost, canSit, selectedId, fillWithBots, onSeatPress }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - SPACING.md * 2, TABLE_MAX_SIZE);
  const layout = tableLayout(chart.length, size);
  const { avatar } = layout;
  const [collapsed, setCollapsed] = useState(false);
  const mySeat = chart.findIndex((p) => p?.id === playerId);
  const bottomSeat = Math.max(0, mySeat);
  const seated = chart.filter(Boolean).length;
  const summary = mySeat === -1 && canSit
    ? `${seated}/${chart.length} seated · you're standing`
    : `${seated}/${chart.length} seated${mySeat === -1 ? '' : ` · you're in seat ${mySeat + 1}`}`;

  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      <CollapseHeader collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} theme={t} label="The table">
        <Text style={[styles.headerText, { color: t.textSecondary }]}>{summary}</Text>
      </CollapseHeader>

      {!collapsed && (
      <>
      <Text style={[styles.hint, { color: t.text }]}>{hintFor({ canSit, isHost, selectedId, mySeat })}</Text>

      <View style={{ width: size, height: size }}>
        <Image source={TABLE_IMAGE} resizeMode="contain" style={layout.tableImageStyle} />
        {chart.map((p, i) => {
          const isMe = p?.id === playerId;
          const isSelected = !!p && p.id === selectedId;
          return (
            <TouchableOpacity
              key={`seat-${i}`}
              style={layout.seatStyle(i, bottomSeat)}
              onPress={() => onSeatPress(i)}
              accessibilityLabel={p ? `Seat ${i + 1}: ${p.nickname}` : `Seat ${i + 1}: free`}
            >
              {p ? (
                <View
                  style={[
                    styles.avatar,
                    {
                      width: avatar,
                      height: avatar,
                      backgroundColor: t.primary,
                      borderColor: isSelected ? CANDLE_GOLD : isMe ? t.textSecondary : t.border,
                      borderWidth: isSelected ? 4 : 2,
                    },
                  ]}
                >
                  <Text style={[styles.initial, { fontSize: avatar * 0.42 }]}>{p.nickname?.[0]?.toUpperCase()}</Text>
                  {!p.isHost && <Text style={[styles.candle, !p.isReady && styles.candleUnlit]}>🕯️</Text>}
                </View>
              ) : (
                <View style={[styles.avatar, styles.freeSeat, { width: avatar, height: avatar, borderColor: t.textSecondary }]}>
                  <Text style={[styles.plus, { color: t.textSecondary, fontSize: avatar * 0.45 }]}>+</Text>
                </View>
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  { color: p ? (isSelected ? CANDLE_GOLD : t.text) : t.textMuted, fontWeight: isMe || isSelected ? '700' : '400' },
                ]}
              >
                {p ? (isMe ? 'You' : p.nickname) : 'Free'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {standing.length > 0 && (
        <Text style={[styles.caption, { color: t.textSecondary }]}>
          Still standing: {standing.map((p) => (p.id === playerId ? 'you' : p.nickname)).join(', ')}
        </Text>
      )}
      <Text style={[styles.caption, { color: t.textMuted }]}>
        {fillWithBots
          ? 'At the start, anyone still standing and the bots take the free seats at random.'
          : 'At the start, anyone still standing takes a free seat at random.'}
      </Text>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  headerText: { ...FONTS.body, fontWeight: '700' },
  hint: { ...FONTS.body, textAlign: 'center' },
  avatar: { borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  freeSeat: { borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'rgba(0,0,0,0.35)' },
  initial: { fontWeight: '700', color: '#fff' },
  plus: { fontWeight: '700' },
  candle: { position: 'absolute', right: -6, top: -6, fontSize: 14 },
  candleUnlit: { opacity: 0.25 },
  name: { ...FONTS.caption, textAlign: 'center' },
  caption: { ...FONTS.caption, textAlign: 'center' },
});
