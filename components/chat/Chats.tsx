import React, { useState, useContext, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SocketContext } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_BASE_URL } from '../../api';

type RootStackParamList = {
  ChatWindow: { roomId: string };
};

type User = {
  _id: string;
  name: string;
  profile_image?: string;
};

type ChatRoom = {
  _id: string;
  user1_id: User;
  user2_id: User;
  lastMessage: string;
  unreadCount: number;
};

const Chats: React.FC = () => {
  const { socket } = useContext(SocketContext);
  const { state: { userToken } } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generates dynamic background color for avatars based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-orange-500',
    ];
    const index = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setCurrentUserId(id || ''));
  }, []);

  const fetchChats = useCallback(async () => {
    if (!userToken) {
      setError('Authentication token missing');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await res.json();
      if (res.ok) {
        setChatRooms(data.map((room: any) => ({
          _id: room._id,
          user1_id: {
            _id: room.user1_id?._id || 'unknown1',
            name: room.user1_id?.name || `User ${room.user1_id?._id?.slice(-4) || '1'}`,
            profile_image: room.user1_id?.profile_image ? `${room.user1_id.profile_image}?t=${Date.now()}` : undefined,
          },
          user2_id: {
            _id: room.user2_id?._id || 'unknown2',
            name: room.user2_id?.name || `User ${room.user2_id?._id?.slice(-4) || '2'}`,
            profile_image: room.user2_id?.profile_image ? `${room.user2_id.profile_image}?t=${Date.now()}` : undefined,
          },
          lastMessage: room.lastMessage || 'No messages yet',
          unreadCount: room.unreadCount || 0,
        })));
        setError('');
      } else {
        setError(data.message || 'Failed to fetch chats');
      }
    } catch (err: any) {
      setError('Error fetching chats: ' + err.message);
      console.error('Error fetching chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  }, [fetchChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: { roomId: string; content: string; sender_id: string; name?: string; profile_image?: string }) => {
      console.log('Received newMessage:', message); // Debug log
      setChatRooms((prev) => {
        const existingRoomIndex = prev.findIndex((room) => room._id === message.roomId);
        const isCurrentUser = message.sender_id === currentUserId;
        if (existingRoomIndex !== -1) {
          const updatedRoom = {
            ...prev[existingRoomIndex],
            lastMessage: message.content || 'Media',
            unreadCount: isCurrentUser ? prev[existingRoomIndex].unreadCount : prev[existingRoomIndex].unreadCount + 1,
          };
          const updatedRooms = [...prev];
          updatedRooms.splice(existingRoomIndex, 1);
          return [updatedRoom, ...updatedRooms];
        } else {
          return [{
            _id: message.roomId,
            user1_id: { _id: currentUserId, name: 'You', profile_image: undefined },
            user2_id: {
              _id: message.sender_id,
              name: message.name || `User ${message.sender_id.slice(-4)}`,
              profile_image: message.profile_image ? `${message.profile_image}?t=${Date.now()}` : undefined,
            },
            lastMessage: message.content || 'Media',
            unreadCount: isCurrentUser ? 0 : 1,
          }, ...prev];
        }
      });
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, currentUserId]);

  const renderChat = ({ item }: { item: ChatRoom }) => {
    const otherUser = item.user1_id._id === currentUserId ? item.user2_id : item.user1_id;
    return (
      <TouchableOpacity
        className="flex-row items-center p-4 my-2 bg-[#2d1a4f] rounded-lg"
        onPress={() => navigation.navigate('ChatWindow', { roomId: item._id })}
      >
        <View className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden mr-4">
          {otherUser.profile_image ? (
            <Image
              source={{ uri: otherUser.profile_image }}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <View className={`w-full h-full ${getAvatarColor(otherUser.name)} flex items-center justify-center`}>
              <Text className="text-white text-xl font-bold">
                {otherUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 bg-[#c6265e] rounded-full h-5 w-5 flex items-center justify-center">
              <Text className="text-white text-xs font-bold">{item.unreadCount}</Text>
            </View>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">{otherUser.name}</Text>
          <Text className="text-gray-400 text-sm" numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 p-4 bg-[#1a002f]">
      {error && <Text className="text-red-400 text-center mb-4">{error}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" color="#c6265e" />
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChat}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-4">No chats to display</Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        />
      )}
    </View>
  );
};

export default Chats;