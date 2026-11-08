import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  subscribeToWerewolfChat,
  sendWerewolfMessage,
  subscribeToSisterChat,
  sendSisterMessage,
  subscribeToGhostChat,
  sendGhostMessage,
  CHAT_MESSAGE_MAX,
} from '../firebase/roomService';
import { NIGHT, RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_ICONS } from '../constants/icons';

const SEND_ICON = require('../../assets/send_night.webp');
const DEATH_CHAT_ICON = require('../../assets/death_chat.webp');

const CHATS = {
  werewolf: {
    title: 'Wolf Pack Chat',
    icon: ROLE_ICONS.werewolf,
    empty: 'No messages yet. Wolves only.',
    placeholder: 'Whisper to the pack...',
    narratorNote: '📖 Narrator — observing the wolf pack',
    deadNote: '🐺 You are dead — watching from the shadows',
    subscribe: subscribeToWerewolfChat,
    send: sendWerewolfMessage,
  },
  sister: {
    title: 'Sisters Chat',
    icon: ROLE_ICONS.sister,
    empty: 'No messages yet. Only you and your sister can read this.',
    placeholder: 'Whisper to your sister...',
    narratorNote: '📖 Narrator — observing the sisters',
    deadNote: '🕯️ You are dead — watching over your sister',
    subscribe: subscribeToSisterChat,
    send: sendSisterMessage,
  },
  ghost: {
    title: 'Death Chat',
    icon: DEATH_CHAT_ICON,
    empty: 'No messages yet. Only the dead and the narrator can read this.',
    placeholder: 'Speak from beyond...',
    ghostsPost: true,
    subscribe: subscribeToGhostChat,
    send: sendGhostMessage,
  },
};

export default function PrivateChat({ chat, visible, onClose, roomId, playerId, nickname, isAlive, isNarrator = false }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const config = CHATS[chat];
  const canPost = config.ghostsPost ? !isAlive || isNarrator : isAlive;

  const t = NIGHT;

  useEffect(() => {
    if (!roomId) return;
    const unsub = config.subscribe(roomId, setMessages);
    return () => unsub();
  }, [roomId, chat]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !canPost) return;
    setText('');
    try {
      await config.send(roomId, playerId, nickname, trimmed);
    } catch {
      setText(trimmed);
    }
  }

  const reversed = [...messages].reverse();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.primary }]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Image source={config.icon} style={styles.headerIcon} resizeMode="contain" />
            <Text style={[styles.title, { color: t.accent }]}>{config.title}</Text>
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
                {config.empty}
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

          {canPost ? (
            <View style={[styles.inputRow, { borderTopColor: t.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]}
                value={text}
                onChangeText={setText}
                maxLength={CHAT_MESSAGE_MAX}
                placeholder={config.placeholder}
                placeholderTextColor={t.textMuted}
                onSubmitEditing={send}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.8} accessibilityLabel="Send">
                <Image source={SEND_ICON} style={styles.sendIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          ) : isNarrator ? (
            <View style={[styles.spectatingRow, { borderTopColor: t.border }]}>
              <Text style={[styles.spectatingText, { color: t.textMuted }]}>
                {config.narratorNote}
              </Text>
            </View>
          ) : (
            <View style={[styles.spectatingRow, { borderTopColor: t.border }]}>
              <Text style={[styles.spectatingText, { color: t.textMuted }]}>
                {config.deadNote}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    height: '82%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 2,
    paddingTop: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  headerIcon: { width: 28, height: 28 },
  title: { ...FONTS.heading, flex: 1 },
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
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { width: 52, height: 52 },
  spectatingRow: {
    padding: SPACING.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  spectatingText: { ...FONTS.caption },
});
