import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LaunchScreen from './app/screens/LaunchScreen';
import WelcomeScreen from './app/screens/WelcomeScreen';
import HomeScreen from './app/screens/HomeScreen';
import LobbyScreen from './app/screens/LobbyScreen';
import RoleRevealScreen from './app/screens/RoleRevealScreen';
import NightPhaseScreen from './app/screens/NightPhaseScreen';
import DayPhaseScreen from './app/screens/DayPhaseScreen';
import GameOverScreen from './app/screens/GameOverScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Launch"
          screenOptions={{ headerShown: false, animation: 'fade' }}
        >
          <Stack.Screen name="Launch" component={LaunchScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="RoleReveal" component={RoleRevealScreen} />
          <Stack.Screen name="NightPhase" component={NightPhaseScreen} />
          <Stack.Screen name="DayPhase" component={DayPhaseScreen} />
          <Stack.Screen name="GameOver" component={GameOverScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
