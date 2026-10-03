/**
 * PondFish Customer Mobile Application Entry Point
 * Traceability: PondFish Customer Mobile App Specification (CP-01 & CP-02)
 * Orchestrates customer authentication state machine, secure storage, and dashboard entry.
 */

import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { colors } from './src/theme/colors';

import SplashScreen from './src/screens/SplashScreen';
import PhoneAuthScreen from './src/screens/PhoneAuthScreen';
import OtpVerifyScreen from './src/screens/OtpVerifyScreen';
import ProfileCompletionScreen from './src/screens/ProfileCompletionScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('SPLASH');
  const [screenParams, setScreenParams] = useState({});

  function handleNavigate(targetScreen, params = {}) {
    setScreenParams(params);
    setCurrentScreen(targetScreen);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      <View style={styles.screenContainer}>
        {currentScreen === 'SPLASH' && (
          <SplashScreen onNavigate={handleNavigate} />
        )}

        {currentScreen === 'PHONE_AUTH' && (
          <PhoneAuthScreen onNavigate={handleNavigate} />
        )}

        {currentScreen === 'OTP_VERIFY' && (
          <OtpVerifyScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'PROFILE_COMPLETION' && (
          <ProfileCompletionScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'HOME' && (
          <HomeScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  screenContainer: {
    flex: 1,
  },
});
