import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRoom from '../hooks/useRoom';
import useGameState from '../hooks/useGameState';
import RoleCard from '../components/RoleCard';
import { NIGHT, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function RoleRevealScreen({ route, navigation }) {
  const { roomId, playerId, nickname } = route.params;
  const { room, loading } = useRoom(roomId);
  const gs = useGameState(room, playerId);
  const [confirmed, setConfirmed] = useState(false);

  const t = NIGHT;

  // Navigate to night phase once confirmed and game is in night status
  React.useEffect(() => {
    if (confirmed && room?.status === 'night') {
      navigation.replace('NightPhase', { roomId, playerId, nickname });
    }
  }, [confirmed, room?.status]);

  if (loading || !room || !gs.myRole) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.accent} />
        <Text style={[styles.waiting, { color: t.textMuted }]}>Assigning roles...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: t.textMuted }]}>Your Secret Role</Text>
        <Text style={[styles.subheading, { color: t.textSecondary }]}>Keep this private</Text>

        <RoleCard
          role={gs.myRole}
          fellowWolves={gs.fellowWolves}
          players={room.players}
        />

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: t.primary }]}
          onPress={() => setConfirmed(true)}
        >
          <Text style={styles.confirmText}>I Understand My Role ✓</Text>
        </TouchableOpacity>

        {confirmed && (
          <Text style={[styles.waitText, { color: t.textMuted }]}>
            Waiting for night to begin...
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waiting: { ...FONTS.body, marginTop: SPACING.md },
  content: { padding: SPACING.md, paddingTop: SPACING.xl },
  heading: { ...FONTS.title, textAlign: 'center', marginBottom: SPACING.xs },
  subheading: { ...FONTS.body, textAlign: 'center', marginBottom: SPACING.lg },
  confirmBtn: {
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  confirmText: { ...FONTS.button, color: '#fff' },
  waitText: { ...FONTS.body, textAlign: 'center', marginTop: SPACING.md },
});
