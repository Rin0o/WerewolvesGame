import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import useSoundEffect from '../hooks/useSoundEffect';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const HOLD_MS = 1400;
const FADE_MS = 700;

export default function PhaseTransition({ phase, onComplete }) {
  useSoundEffect(phase === 'night' ? 'night' : 'day');

  const opacity = useSharedValue(0);
  const iconScale = useSharedValue(0.5);
  const iconOpacity = useSharedValue(0);

  const isNight = phase === 'night';

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onComplete)();
      }))
    );

    iconOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 500 })
    );

    iconScale.value = withDelay(
      200,
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.out(Easing.back(1.5)) }),
        withDelay(HOLD_MS - 200, withTiming(1.4, { duration: FADE_MS }))
      )
    );
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const gradientColors = isNight
    ? ['#050210', '#0D0820', '#1A1035', '#2A1860']
    : ['#FF8C42', '#D4651A', '#FFE8CC', '#FFF8F0'];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, overlayStyle]} pointerEvents="none">
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: isNight ? 0 : 1 }}
        end={{ x: 0.5, y: isNight ? 1 : 0 }}
      />
      <Animated.Text style={[styles.icon, iconStyle]}>
        {isNight ? '🌙' : '🌅'}
      </Animated.Text>
      <Animated.Text style={[styles.label, { color: isNight ? '#C8A8FF' : '#FFF8F0' }, iconStyle]}>
        {isNight ? 'Night Falls...' : 'Dawn Breaks...'}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  icon: {
    fontSize: 80,
  },
  label: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
