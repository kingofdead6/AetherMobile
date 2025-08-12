import React, { FC } from 'react';
import { View, Text, ImageBackground, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
};

const HomePage: FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ImageBackground
  source={{ uri: 'https://res.cloudinary.com/dtwa3lxdk/image/upload/v1754643043/ChatGPT_Image_Aug_8_2025_09_49_23_AM_q9ls2o.png' }}
  className="flex-1"
  resizeMode="cover"
>

      <View className="flex-1 items-center justify-center p-4 bg-black/50">
        <Text className="text-white text-3xl font-bold text-center mb-4">
          Welcome to Aether
        </Text>
        <Text className="text-gray-300 text-lg text-center mb-8">
          Capture and Share Your World
        </Text>
        <TouchableOpacity
          className="bg-pink-600 rounded-full py-3 px-6"
          onPress={() => navigation.navigate('Login')}
        >
          <Text className="text-white font-bold text-lg">Get Started</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

export default HomePage;
