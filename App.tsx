import React from 'react';
import { StatusBar } from 'react-native';
import { SocketProvider } from './context/SocketContext';
import AppNavigator from './navigation/AppNavigator';
if (typeof document !== "undefined") {
  import("./global.css");
}

const RootLayout: React.FC = () => {
  return (
    <SocketProvider>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </SocketProvider>
  );
};

export default RootLayout;
