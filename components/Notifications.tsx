import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const notificationsData = [
  { id: '1', message: 'John liked your post', time: '2h ago' },
  { id: '2', message: 'You have a new follower', time: '5h ago' },
  { id: '3', message: 'Anna commented on your photo', time: '1d ago' },
];

const Notifications = () => {
  return (
    <View className="flex-1 bg-[#1a002f] p-4">
      <Text className="text-white text-2xl font-bold mb-4">Notifications</Text>

      {notificationsData.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="notifications-off-outline" size={50} color="#9ca3af" />
          <Text className="text-gray-400 mt-2">No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notificationsData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity className="flex-row items-center bg-[#2d1a4f] p-4 mb-3 rounded-lg">
              <Ionicons name="notifications-outline" size={24} color="#c6265e" />
              <View className="ml-3 flex-1">
                <Text className="text-white text-base">{item.message}</Text>
                <Text className="text-gray-400 text-sm">{item.time}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default Notifications;
