import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useSocket } from '../context/SocketContext';
import { API_BASE_URL } from '../api';

type Notification = {
  _id: string;
  message: string;
  createdAt: string;
  read: boolean;
  notificationType: 'follow' | 'new_message';
  relatedId: string;
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // New state for pull-to-refresh
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      if (id) setUserId(id);
      else setError('No user ID found in storage');
    });
  }, []);

  // Request permission and register device for push notifications
  const setupPushNotifications = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (status !== 'granted') {
        setError('Notification permissions not granted');
        return;
      }

      const projectId = '3d613556-f498-418c-bdcf-0ea33212029d';
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (token && userId) {
        await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, pushToken: token, platform: Platform.OS }),
        });
      }
    } catch (err: any) {
      setError('Error setting up push notifications: ' + err.message);
    }
  }, [userId]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true); // Set refreshing state for pull-to-refresh
    else setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setNotifications(data);
      } else {
        setError(data.message || 'Failed to fetch notifications');
      }
    } catch (err: any) {
      setError('Error fetching notifications: ' + err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setIsLoading(false);
    }
  }, [userId]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    fetchNotifications(true); // Pass true to indicate refresh
  }, [fetchNotifications]);

  // Initialize notifications and push setup
  useEffect(() => {
    if (userId) {
      setupPushNotifications();
      fetchNotifications();
    }
  }, [userId, setupPushNotifications, fetchNotifications]);

  // Handle real-time notifications via socket
  useEffect(() => {
    if (socket && userId) {
      socket.on('receive_notification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
      });

      return () => {
        socket.off('receive_notification');
      };
    }
  }, [socket, userId]);

  // Handle push notification interactions
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const { data, request } = notification;
      if (data && request.content.body) {
        setNotifications(prev => [
          {
            _id: data._id || `${Date.now()}-${Math.random()}`,
            message: request.content.body || 'New notification',
            createdAt: new Date().toISOString(),
            read: false,
            notificationType: data.notificationType as 'follow' | 'new_message',
            relatedId: data.relatedId,
          },
          ...prev,
        ]);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { notification } = response;
      if (notification.request.content.data) {
        const { notificationType, relatedId } = notification.request.content.data;
        navigateToScreen(notificationType, relatedId);
      }
    });

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response?.notification.request.content.data) {
        const { notificationType, relatedId } = response.notification.request.content.data;
        navigateToScreen(notificationType, relatedId);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [navigation]);

  const navigateToScreen = (notificationType: string, relatedId: string) => {
    if (notificationType === 'follow') {
      navigation.navigate('Profile', { userId: relatedId });
    } else if (notificationType === 'new_message') {
      navigation.navigate('Chats', { roomId: relatedId });
    }
  };

  const handleMarkAsRead = async (notificationId: string, notificationType: string, relatedId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => (notif._id === notificationId ? { ...notif, read: true } : notif))
        );
        navigateToScreen(notificationType, relatedId);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to mark notification as read');
      }
    } catch (err: any) {
      setError('Error marking notification as read: ' + err.message);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete notification');
      }
    } catch (err: any) {
      setError('Error deleting notification: ' + err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to mark all notifications as read');
      }
    } catch (err: any) {
      setError('Error marking all notifications as read: ' + err.message);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      className={`flex-row items-center ${item.read ? 'bg-[#2d1a4f]' : 'bg-pink-600/20'} p-4 mb-3 rounded-lg`}
      onPress={() => handleMarkAsRead(item._id, item.notificationType, item.relatedId)}
    >
      <Ionicons name="notifications-outline" size={24} color={item.read ? '#9ca3af' : '#c6265e'} />
      <View className="ml-3 flex-1">
        <Text className="text-white text-base">{item.message}</Text>
        <Text className="text-gray-400 text-sm">{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteNotification(item._id)}
        className="p-2"
      >
        <Ionicons name="close" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#1a002f] p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white text-2xl font-bold">Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text className="text-pink-300 text-sm">Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-red-400 text-center mb-3 text-sm">{error}</Text>
      )}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white/70 text-sm">Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="notifications-off-outline" size={50} color="#9ca3af" />
          <Text className="text-gray-400 mt-2">No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item._id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#c6265e" // Optional: Customize refresh indicator color
              colors={['#c6265e']} // Optional: Customize refresh indicator for Android
            />
          }
        />
      )}
    </View>
  );
};

export default NotificationsScreen;