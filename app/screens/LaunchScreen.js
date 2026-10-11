import React, { useRef } from 'react';
import { Text, ImageBackground, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadProfile } from '../utils/profile';
import { FONTS, SPACING } from '../constants/theme';

export default function LaunchScreen({ navigation }) {
  const leavingRef = useRef(false);

  async function handlePress() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const { nickname } = await loadProfile();
    navigation.replace(nickname ? 'Home' : 'Welcome');
  }

  return (
    <Pressable style={styles.fill} onPress={handlePress}>
      <ImageBackground
        source={require('../../assets/home_page.webp')}
        style={styles.fill}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safe}>
          <Text style={styles.hint}>Tap anywhere to begin</Text>
        </SafeAreaView>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SPACING.lg,
  },
  hint: {
    ...FONTS.subheading,
    color: '#FFE8B0',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
