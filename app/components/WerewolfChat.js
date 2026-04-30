import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { subscribeToWerewolfChat, sendWerewolfMessage } from '../firebase/roomService';
import { NIGHT, RADIUS, SPACING, FONTS } from '../constants/theme';
import { ROLE_ICONS } from '../constants/icons';

export default function WerewolfChat({ roomId, currentPlayerId, currentNickname, isNight }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToWerewolfChat(roomId, setMessages);
    return () => unsub();
  }, [roomId]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !isNight) return;
    setText('');
    await sendWerewolfMessage(roomId, currentPlayerId, currentNickname, trimmed);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <Image source={ROLE_ICONS.werewolf} style={styles.headerIcon} resizeMode="contain" />
        <Text style={styles.header}>Wolf Pack Chat</Text>
      </View>
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        style={styles.list}
        renderItem={({ item }) => {
          const isMe = item.senderId === currentPlayerId;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
              {!isMe && (
                <Text style={styles.sender}>{item.senderNickname}</Text>
              )}
              <Text style={[styles.msgText, { color: isMe ? '#fff' : NIGHT.text }]}>{item.text}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Wolves only.</Text>
        }
      />
      {isNight && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Whisper to the pack..."
            placeholderTextColor={NIGHT.textMuted}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Text style={styles.sendText}>↑</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isNight && (
        <Text style={styles.locked}>🔒 Chat locked during day phase</Text>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NIGHT.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: NIGHT.primary,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  headerIcon: { width: 22, height: 22 },
  header: { ...FONTS.subheading, color: NIGHT.accent },
  list: {
    flex: 1,
    marginBottom: SPACING.sm,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: 2,
  },
  bubbleMe: {
    backgroundColor: NIGHT.primary,
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    backgroundColor: NIGHT.surfaceAlt,
    alignSelf: 'flex-start',
  },
  sender: {
    ...FONTS.caption,
    color: NIGHT.accent,
    marginBottom: 2,
    fontWeight: '600',
  },
  msgText: {
    ...FONTS.body,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  input: {
    flex: 1,
    backgroundColor: NIGHT.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: NIGHT.text,
    borderWidth: 1,
    borderColor: NIGHT.border,
    ...FONTS.body,
  },
  sendBtn: {
    backgroundColor: NIGHT.primary,
    borderRadius: RADIUS.md,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  empty: {
    ...FONTS.caption,
    color: NIGHT.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  locked: {
    ...FONTS.caption,
    color: NIGHT.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
