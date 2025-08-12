import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import HomePage from '../components/Hero';
import Login from '../components/auth/Login';
import Register from '../components/auth/Register';
import Posts from '../components/chat/Posts';
import People from '../components/chat/People';
import Chats from '../components/chat/Chats';
import Profile from '../components/chat/Profile';
import ChatWindow from '../components/chat/ChatWindow';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Notifications from '@/components/Notifications';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  DashboardTabs: undefined;
  ChatWindow: { roomId: string };
  Profile: { userId?: string };
  Posts: undefined;
  People: undefined;
  Chats: undefined;
};

const AuthStackNavigator = createStackNavigator();
const LoggedInStackNavigator = createStackNavigator();
const TabNavigator = createBottomTabNavigator();

const Header: React.FC<{ isLoggedIn: boolean; navigation?: any }> = ({ isLoggedIn, navigation }) => {
  return (
    <View className="flex-row items-center justify-between p-4 bg-[#1a002f] border-b border-gray-800">
      {/* Left - App Name */}
      <Text className="text-white text-2xl font-bold">Aether</Text>

      {/* Right - Notifications Icon if logged in */}
      {isLoggedIn && (
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};
const DashboardTabs = () => {
  return (
    <TabNavigator.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a002f',
          borderTopColor: '#2d1a4f',
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarActiveTintColor: '#c6265e',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' },
      }}
    >
      <TabNavigator.Screen
        name="Posts"
        component={Posts}
        options={{
          tabBarLabel: 'Posts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={24} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="People"
        component={People}
        options={{
          tabBarLabel: 'People',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={24} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="Chats"
        component={Chats}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={24} color={color} />
          ),
        }}
      />
    </TabNavigator.Navigator>
  );
};

const AuthStack = () => {
  const { state } = useAuth();
  return (
    <AuthStackNavigator.Navigator
      screenOptions={({ navigation }) => ({
        header: () => <Header isLoggedIn={!!state.userToken} navigation={navigation} />,
      })}
    >
      <AuthStackNavigator.Screen name="Home" component={HomePage} />
      <AuthStackNavigator.Screen name="Login" component={Login} />
      <AuthStackNavigator.Screen name="Register" component={Register} />
    </AuthStackNavigator.Navigator>
  );
};


const LoggedInStack = () => {
  const { state } = useAuth();
  return (
    <LoggedInStackNavigator.Navigator
      screenOptions={({ navigation }) => ({
        header: () => <Header isLoggedIn={!!state.userToken} navigation={navigation} />,
      })}
    >
      <LoggedInStackNavigator.Screen name="DashboardTabs" component={DashboardTabs} />
      <LoggedInStackNavigator.Screen name="ChatWindow" component={ChatWindow} />
      <LoggedInStackNavigator.Screen name="Notifications" component={Notifications}
      />
    </LoggedInStackNavigator.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { state } = useAuth();

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a002f' }}>
        <ActivityIndicator size="large" color="#c6265e" />
      </View>
    );
  }

  return state.userToken ? <LoggedInStack /> : <AuthStack />;
};

export default AppNavigator;