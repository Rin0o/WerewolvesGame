import React from 'react';
import { View, Text, Image, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { getSeating, getLivingNeighbours, nicknameOf } from '../game-logic/roles';
import BarButton from './BarButton';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const AVATAR_UNKNOWN = require('../../assets/role_icons/unknown.webp');
const AVATAR_DEAD    = require('../../assets/suspicion_level_icons/dead.webp');
const TABLE_VIEW_ICON = require('../../assets/table_view.webp');
export const TABLE_IMAGE = require('../../assets/table.webp');
const TABLE_SCALE = 1.25;

const NEIGHBOUR_COLOR = '#E8B020';
const TABLE_MAX_SIZE = 380;
const NAME_EXTRA_WIDTH = 28;
const NAME_HEIGHT = 18;

function avatarSizeFor(seatCount) {
  if (seatCount >= 14) return 34;
  if (seatCount >= 10) return 42;
  return 52;
}

export function tableLayout(seatCount, size) {
  const avatar = avatarSizeFor(seatCount);
  const seatWidth = avatar + NAME_EXTRA_WIDTH;
  const seatHeight = avatar + NAME_HEIGHT;
  const radius = (size - Math.max(seatWidth, seatHeight)) / 2;
  const center = size / 2;
  const step = (2 * Math.PI) / Math.max(seatCount, 1);
  const tableImageSize = radius * TABLE_SCALE;
  return {
    avatar,
    seatWidth,
    seatHeight,
    tableImageStyle: {
      position: 'absolute',
      left: center - tableImageSize / 2,
      top: center - tableImageSize / 2,
      width: tableImageSize,
      height: tableImageSize,
    },
    seatStyle(index, bottomIndex) {
      const angle = Math.PI / 2 - (index - bottomIndex) * step;
      return {
        position: 'absolute',
        alignItems: 'center',
        width: seatWidth,
        left: center + radius * Math.cos(angle) - seatWidth / 2,
        top: center + radius * Math.sin(angle) - seatHeight / 2,
      };
    },
  };
}

function neighbourText(players, neighbours) {
  const name = (id) => nicknameOf(players, id);
  const [left, right] = neighbours;
  if (left === right) return `Your only neighbour: ${name(left)}`;
  return `Your neighbours: ${name(left)} and ${name(right)}`;
}

export function SeatingTableButton({ onPress }) {
  return <BarButton source={TABLE_VIEW_ICON} onPress={onPress} accessibilityLabel="Show the table" />;
}

export default function SeatingTable({ visible, onClose, theme: t, players, playerId }) {
  const { width } = useWindowDimensions();
  const seats = getSeating(players || []);
  const me = seats.find((p) => p.id === playerId);
  const neighbours = me?.isAlive ? getLivingNeighbours(players, playerId) : [];
  const myIndex = Math.max(0, seats.findIndex((p) => p.id === playerId));

  const size = Math.min(width - SPACING.md * 4, TABLE_MAX_SIZE);
  const layout = tableLayout(seats.length, size);
  const { avatar } = layout;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: t.modalOverlay }]} onPress={onClose}>
        <View style={[styles.card, { backgroundColor: t.overlay, borderColor: t.glassBorder || t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>The Table</Text>

          <View style={{ width: size, height: size }}>
            <Image source={TABLE_IMAGE} resizeMode="contain" style={layout.tableImageStyle} />
            {seats.map((p, i) => {
              const isMe = p.id === playerId;
              const isNeighbour = neighbours.includes(p.id);
              return (
                <View key={p.id} style={layout.seatStyle(i, myIndex)}>
                  <View
                    style={[
                      styles.avatarRing,
                      {
                        width: avatar + 6,
                        height: avatar + 6,
                        borderColor: isNeighbour ? NEIGHBOUR_COLOR : isMe ? t.primary : 'transparent',
                        opacity: p.isAlive ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Image
                      source={p.isAlive ? AVATAR_UNKNOWN : AVATAR_DEAD}
                      style={{ width: avatar, height: avatar }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.name,
                      {
                        color: isNeighbour ? NEIGHBOUR_COLOR : p.isAlive ? t.text : t.textMuted,
                        fontWeight: isMe || isNeighbour ? '700' : '400',
                      },
                    ]}
                  >
                    {isMe ? 'You' : p.nickname}
                  </Text>
                </View>
              );
            })}
          </View>

          {neighbours.length > 0 && (
            <Text style={[styles.neighbours, { color: t.text }]}>{neighbourText(players, neighbours)}</Text>
          )}
          <Text style={[styles.caption, { color: t.textSecondary }]}>
            Neighbours skip eliminated players.
          </Text>
          <Text style={[styles.caption, { color: t.textMuted }]}>Tap anywhere to close</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  card: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  title: { ...FONTS.subheading },
  avatarRing: {
    borderRadius: RADIUS.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...FONTS.caption, textAlign: 'center' },
  neighbours: { ...FONTS.body, fontWeight: '600', textAlign: 'center' },
  caption: { ...FONTS.caption, textAlign: 'center' },
});
