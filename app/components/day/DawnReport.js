import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FONTS, RADIUS, SPACING } from '../../constants/theme';
import { ROLE_ICONS } from '../../constants/icons';
import { publicDawnNews, privateDawnNews, dawnSummary } from '../../utils/dawnReport';

const ROW_STAGGER_MS = 150;
const ROW_FADE_MS = 400;
const PRIVATE_COLOR = '#5A35A8';

const EXTRA_ICONS = {
  bear_growl: require('../../../assets/bear_growl.webp'),
  moon: require('../../../assets/moon_borderless.webp'),
  dead: require('../../../assets/suspicion_level_icons/dead.webp'),
};
const EYE_ICON = require('../../../assets/show_role.webp');

const TEAM_CHIPS = {
  villagers: { label: 'Village', color: '#27AE60' },
  werewolves: { label: 'Wolves', color: '#C0392B' },
};

function iconFor(key) {
  return ROLE_ICONS[key] || EXTRA_ICONS[key] || EXTRA_ICONS.dead;
}

function toneColor(tone, t) {
  switch (tone) {
    case 'danger': return t.danger;
    case 'warning': return t.primaryDark;
    case 'private': return PRIVATE_COLOR;
    default: return t.textSecondary;
  }
}

function NewsRow({ item, index, theme: t }) {
  const color = toneColor(item.tone, t);
  const chip = TEAM_CHIPS[item.team];
  return (
    <Animated.View
      entering={FadeInDown.delay(index * ROW_STAGGER_MS).duration(ROW_FADE_MS)}
      style={[styles.row, { borderLeftColor: color, backgroundColor: `${color}14` }]}
    >
      <Image source={iconFor(item.icon)} style={styles.rowIcon} resizeMode="contain" />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{item.title}</Text>
        <Text style={[styles.rowDetail, { color: t.text }]}>{item.detail}</Text>
        {chip && (
          <View style={[styles.teamChip, { backgroundColor: chip.color }]}>
            <Text style={styles.teamChipText}>{chip.label}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function DawnReport({ theme: t, room, playerId }) {
  const [collapsed, setCollapsed] = useState(false);
  const publicNews = publicDawnNews(room);
  const privateNews = privateDawnNews(room, playerId);

  return (
    <View style={[styles.frame, { borderColor: t.primary, backgroundColor: t.glassCard }]}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: t.primary }]}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.8}
        accessibilityLabel={collapsed ? 'Show the dawn report' : 'Fold the dawn report'}
      >
        <Text style={styles.headerText}>☀ DAWN · DAY {room.phase}</Text>
        <Text style={styles.chevron}>{collapsed ? '▼' : '▲'}</Text>
      </TouchableOpacity>

      {collapsed ? (
        <TouchableOpacity onPress={() => setCollapsed(false)} activeOpacity={0.7}>
          <Text style={[styles.summary, { color: t.text }]} numberOfLines={2}>
            {dawnSummary(publicNews, privateNews.length)}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.body}>
          {publicNews.map((item, i) => (
            <NewsRow key={item.key} item={item} index={i} theme={t} />
          ))}

          {privateNews.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(publicNews.length * ROW_STAGGER_MS).duration(ROW_FADE_MS)}
              style={[styles.privateBox, { borderColor: PRIVATE_COLOR }]}
            >
              <View style={styles.privateHeader}>
                <Image source={EYE_ICON} style={styles.eyeIcon} resizeMode="contain" />
                <Text style={[styles.privateLabel, { color: PRIVATE_COLOR }]}>Only you can see this</Text>
              </View>
              {privateNews.map((item, i) => (
                <NewsRow key={item.key} item={item} index={publicNews.length + 1 + i} theme={t} />
              ))}
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    margin: SPACING.md,
    borderWidth: 3,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#2C1810',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerText: { ...FONTS.subheading, color: '#FFF8F0', fontWeight: '800', letterSpacing: 2, flex: 1, textAlign: 'center' },
  chevron: { color: '#FFF8F0', fontSize: 14, fontWeight: '800' },
  body: { padding: SPACING.sm, gap: SPACING.sm },
  summary: { ...FONTS.body, fontWeight: '600', textAlign: 'center', padding: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.sm,
    borderLeftWidth: 5,
    borderRadius: RADIUS.sm,
  },
  rowIcon: { width: 52, height: 52 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...FONTS.subheading, fontWeight: '800' },
  rowDetail: { ...FONTS.body },
  teamChip: { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2, marginTop: 2 },
  teamChipText: { ...FONTS.caption, color: '#fff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  privateBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: 'rgba(112,80,184,0.08)',
  },
  privateHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  eyeIcon: { width: 22, height: 22 },
  privateLabel: { ...FONTS.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
});
