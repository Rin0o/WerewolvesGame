import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PlayerCard from '../PlayerCard';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { NIGHT_PANEL, NIGHT_ROW } from './nightStyles';
import { ROLE_ICONS } from '../../constants/icons';
import { getFoxGroup, nicknameOf } from '../../game-logic/roles';

const NIGHT_CHECK_ICON = require('../../../assets/night_check.webp');

function SniffedGroup({ theme: t, seating, playerId, targetId }) {
  const group = getFoxGroup(seating, targetId);
  return (
    <View style={[styles.groupBox, { borderColor: t.accent }]}>
      <Text style={[styles.groupLabel, { color: t.textSecondary }]}>
        You will sniff {group.length === 1 ? 'only this player' : `these ${group.length} players`}
      </Text>
      {group.map((id) => {
        const isTarget = id === targetId;
        return (
          <View key={id} style={[styles.groupRow, isTarget && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.groupName, { color: isTarget ? t.accent : t.text }]} numberOfLines={1}>
              {nicknameOf(seating, id)}{id === playerId ? ' (you)' : ''}
            </Text>
            <Text style={[styles.groupTag, { color: t.textMuted }]}>
              {isTarget ? 'your choice' : 'neighbour'}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.groupHint, { color: t.textMuted }]}>
        Neighbours are the nearest living players on each side of the table.
      </Text>
    </View>
  );
}

export default function FoxAction({
  theme: t,
  players,
  seating,
  playerId,
  target,
  onSelectTarget,
  onSubmit,
  onSkip,
  result,
  onDismissResult,
}) {
  if (result) {
    return (
      <View style={[styles.actionBox, { backgroundColor: t.glassCard }]}>
        <View style={styles.actionTitleRow}>
          <Image source={ROLE_ICONS.fox} style={styles.actionTitleIcon} resizeMode="contain" />
          <Text style={[styles.actionTitle, { color: t.accent }]}>What Your Nose Tells You</Text>
        </View>
        <View style={[styles.resultBox, { backgroundColor: t.surfaceAlt, borderColor: result.foundWolf ? t.danger : t.success }]}>
          <Image
            source={result.foundWolf ? ROLE_ICONS.werewolf : ROLE_ICONS.villager}
            style={styles.resultIcon}
            resizeMode="contain"
          />
          <Text style={[styles.resultNames, { color: t.text }]}>{result.names.join(' · ')}</Text>
          <Text style={[styles.resultText, { color: result.foundWolf ? t.danger : t.success }]}>
            {result.foundWolf
              ? 'At least one of them is a Werewolf!'
              : 'None of them is a Werewolf.'}
          </Text>
        </View>
        {!result.foundWolf && (
          <View style={[styles.powerLostBox, { borderColor: t.danger }]}>
            <Text style={[styles.powerLostTitle, { color: t.danger }]}>You have lost your power</Text>
            <Text style={[styles.powerLostText, { color: t.text }]}>
              Your nose found no wolf, so it fails you for the rest of the game. You will no longer wake up at night.
            </Text>
          </View>
        )}
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
        <Image source={ROLE_ICONS.fox} style={styles.actionTitleIcon} resizeMode="contain" />
        <Text style={[styles.actionTitle, { color: t.accent }]}>Sniff Out the Pack</Text>
      </View>
      <Text style={[styles.actionSub, { color: t.textSecondary }]}>
        Point at a player to learn whether they or their two neighbours hide a Werewolf.
        If none of them does, you lose your power.
      </Text>
      {target ? (
        <SniffedGroup theme={t} seating={seating} playerId={playerId} targetId={target} />
      ) : (
        <View style={[styles.groupBox, { borderColor: t.border }]}>
          <Text style={[styles.groupLabel, { color: t.textMuted, textAlign: 'center' }]}>
            Select a player to see who you will sniff
          </Text>
        </View>
      )}
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.playerRowBg, { borderColor: target === item.id ? t.danger : t.border }]}>
            <PlayerCard
              player={item}
              theme={{ ...t, surface: 'transparent', border: 'transparent' }}
              selected={target === item.id}
              onPress={() => onSelectTarget(item.id)}
              checkIcon={NIGHT_CHECK_ICON}
              noSelectionBorder
            />
          </View>
        )}
      />
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: target ? t.primary : t.border }]}
        onPress={onSubmit}
        disabled={!target}
      >
        <Text style={styles.submitText}>Sniff Them Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.skipBtn, { borderColor: t.border }]} onPress={onSkip}>
        <Text style={[styles.skipText, { color: t.textSecondary }]}>Stay hidden tonight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBox: NIGHT_PANEL,
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  actionTitleIcon: { width: 40, height: 40 },
  actionTitle: { ...FONTS.heading, flexShrink: 1 },
  actionSub: { ...FONTS.body, marginBottom: SPACING.md },
  groupBox: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  groupLabel: {
    ...FONTS.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  groupName: { fontSize: 20, fontWeight: '800', flexShrink: 1 },
  groupTag: { ...FONTS.caption, fontStyle: 'italic' },
  groupHint: { ...FONTS.caption, marginTop: SPACING.xs },
  playerRowBg: NIGHT_ROW,
  submitBtn: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { ...FONTS.button, color: '#fff' },
  skipBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  skipText: { ...FONTS.button },
  resultBox: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  resultIcon: { width: 72, height: 72, marginBottom: SPACING.sm },
  resultNames: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  resultText: { ...FONTS.heading, textAlign: 'center' },
  powerLostBox: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(192,57,43,0.18)',
    gap: SPACING.xs,
  },
  powerLostTitle: { ...FONTS.heading, textAlign: 'center' },
  powerLostText: { ...FONTS.body, textAlign: 'center' },
});
