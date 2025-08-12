import React, { FC } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
};

const HomePage: FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View className="flex-1 items-center justify-center p-4 bg-gradient-to-b from-[#1a002f] to-[#2d1a4f]">
      <Image
        source={require('../assets/hero-image.png')}
        className="w-full h-64 rounded-lg mb-6"
        resizeMode="cover"
      />
      <Text className="text-white text-3xl font-bold text-center mb-4">
        Welcome to Aether
      </Text>
      <Text className="text-gray-400 text-lg text-center mb-8">
        Capture and Share Your World
      </Text>
      <TouchableOpacity
        className="bg-pink-600 rounded-full py-3 px-6"
        onPress={() => navigation.navigate('Login')}
      >
        <Text className="text-white font-bold text-lg">Get Started</Text>
      </TouchableOpacity>
    </View>
  );
};

export default HomePage;