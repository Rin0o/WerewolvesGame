import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { subscribeToDayChat, sendDayMessage, CHAT_MESSAGE_MAX } from '../../firebase/roomService';
import { RADIUS, SPACING, FONTS } from '../../constants/theme';

export default function DayChat({ visible, onClose, theme: t, roomId, playerId, nickname, isAlive }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToDayChat(roomId, setMessages);
    return () => unsub();
  }, [roomId]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !isAlive) return;
    setText('');
    await sendDayMessage(roomId, playerId, nickname, trimmed);
  }

  const reversed = [...messages].reverse();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.text }]}>💬 Village Chat</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={reversed}
            keyExtractor={(m) => m.id}
            inverted
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: t.textMuted }]}>
                No messages yet. Start the discussion!
              </Text>
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === playerId;
              return (
                <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
                  {!isMe && (
                    <Text style={[styles.sender, { color: t.accent }]}>{item.senderNickname}</Text>
                  )}
                  <View style={[
                    styles.bubble,
                    isMe
                      ? [styles.bubbleMe, { backgroundColor: t.primary }]
                      : [styles.bubbleOther, { backgroundColor: t.surfaceAlt, borderColor: t.border }],
                  ]}>
                    <Text style={[styles.msgText, { color: isMe ? '#fff' : t.text }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />

          {isAlive ? (
            <View style={[styles.inputRow, { borderTopColor: t.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]}
                value={text}
                onChangeText={setText}
                maxLength={CHAT_MESSAGE_MAX}
                placeholder="Say something..."
                placeholderTextColor={t.textMuted}
                onSubmitEditing={send}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: t.primary }]}
                onPress={send}
                activeOpacity={0.8}
              >
                <Text style={styles.sendText}>↑</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.spectatingRow, { borderTopColor: t.border }]}>
              <Text style={[styles.spectatingText, { color: t.textMuted }]}>
                👁 Spectating — you cannot send messages
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    height: '82%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#888',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { ...FONTS.heading },
  closeBtn: { padding: SPACING.xs },
  closeText: { fontSize: 20 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  empty: {
    ...FONTS.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  row: { marginVertical: 3 },
  rowMe: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  sender: { ...FONTS.caption, fontWeight: '600', marginBottom: 2, marginLeft: 2 },
  bubble: {
    maxWidth: '78%',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  msgText: { ...FONTS.body },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    ...FONTS.body,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  spectatingRow: {
    padding: SPACING.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  spectatingText: { ...FONTS.caption },
});
