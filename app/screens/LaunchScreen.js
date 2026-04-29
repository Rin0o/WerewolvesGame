import React from 'react';
import { View, Image, ImageBackground, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function LaunchScreen({ navigation }) {
  return (
    <ImageBackground
      source={require('../../assets/home_page.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => navigation.replace('Home')}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../assets/play_btn.png')}
              style={styles.playBtn}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  playBtn: {
    width: width * 0.55,
    height: undefined,
    aspectRatio: 3,
  },
});
