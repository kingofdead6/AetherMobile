import React, { useEffect, useState } from 'react';
import { SocketProvider } from '../context/SocketContext';
import { AuthProvider } from '../context/AuthContext';
import { RefreshProvider } from '../context/RefreshContext';
import AppNavigator from '../navigation/AppNavigator';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import "../global.css";

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    // Simulate app initialization (e.g., checking auth, socket connection)
    const initializeApp = async () => {
      try {
        // Add any initialization logic here (e.g., AsyncStorage, API checks)
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate 2s delay
        setIsAppReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsAppReady(true); // Proceed even if error to avoid stuck splash
      }
    };
    initializeApp();
  }, []);

  if (!isAppReady) {
    return (
      <View className="flex-1 bg-[#1a002f] items-center justify-center">
        <Text className="text-white text-4xl font-bold mb-6">Aether</Text>
        <ActivityIndicator size="large" color="#c6265e" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <SocketProvider>
        <RefreshProvider>
          <SafeAreaView className="flex-1 bg-[#1a002f]">
            <StatusBar barStyle="light-content" />
            <AppNavigator />
          </SafeAreaView>
        </RefreshProvider>
      </SocketProvider>
    </AuthProvider>
  );
}