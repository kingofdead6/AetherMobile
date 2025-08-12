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
    const initializeApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        setIsAppReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsAppReady(true);
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