import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ProfilePopup from './ProfilePopup';
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  _id: string;
  name: string;
  profile_image?: string;
  isFollowing: boolean;
}

interface FollowManagerProps {
  isVisible: boolean;
  userId: string;
  onClose: () => void;
}

const FollowManager: React.FC<FollowManagerProps> = ({ isVisible, userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const { state: { userToken } } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setCurrentUserId(id || ''));
  }, []);

  const fetchFollows = useCallback(async () => {
    if (!userId || !userToken) {
      setError('User ID or token missing');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${userId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        setError(profileData.message || 'Failed to fetch profile');
        setLoading(false);
        return;
      }

      const { followers: followerIds, following: followingIds } = profileData.user;

      const followerPromises = followerIds.map(async (id: string) => {
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/${id}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const userData = await userResponse.json();
        if (!userResponse.ok) return null;
        const followResponse = await fetch(`${API_BASE_URL}/api/auth/isFollowing/${id}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const followData = await followResponse.json();
        return { ...userData.user, isFollowing: followData.isFollowing };
      });
      const followerUsers = (await Promise.all(followerPromises)).filter(Boolean) as User[];
      setFollowers(followerUsers);

      const followingPromises = followingIds.map(async (id: string) => {
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/${id}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const userData = await userResponse.json();
        if (!userResponse.ok) return null;
        return { ...userData.user, isFollowing: true };
      });
      const followingUsers = (await Promise.all(followingPromises)).filter(Boolean) as User[];
      setFollowing(followingUsers);
    } catch (error) {
      setError('Error fetching follows');
      console.error('Error fetching follows:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, userToken]);

  useEffect(() => {
    if (isVisible && userId) {
      fetchFollows();
    }
  }, [isVisible, userId, fetchFollows]);

  const handleToggleFollow = async (targetUserId: string) => {
    try {
      const endpoint = `${API_BASE_URL}/api/auth/${targetUserId}/follow`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Expected JSON, received ${contentType || 'unknown content type'}`);
      }

      const data = await response.json();
      if (response.ok) {
        setFollowers((prev) =>
          prev.map((user) =>
            user._id === targetUserId ? { ...user, isFollowing: data.isFollowing } : user
          )
        );
        setFollowing((prev) =>
          data.isFollowing
            ? [...prev, { ...followers.find((u) => u._id === targetUserId) || { _id: targetUserId, name: 'Unknown', profile_image: undefined, isFollowing: true }, isFollowing: true }]
            : prev.filter((u) => u._id !== targetUserId)
        );
      } else {
        setError(data.message || 'Failed to follow/unfollow user');
      }
    } catch (error: any) {
      setError(`Error following/unfollowing user: ${error.message}`);
      console.error('Follow toggle error:', error);
    }
  };

  const getActiveUsers = () => (tab === 'followers' ? followers : following);

  return (
    <>
      <Modal visible={isVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-[#1a002f] rounded-2xl w-[90%] max-h-[90%] p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Follow Manager</Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-white text-lg">✖</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="flex-row mb-4">
              {['followers', 'following'].map((key) => (
                <TouchableOpacity
                  key={key}
                  className={`flex-1 p-2 rounded-lg mx-1 ${tab === key ? 'bg-pink-600' : 'bg-purple-900'}`}
                  onPress={() => setTab(key as 'followers' | 'following')}
                >
                  <Text className="text-white text-center capitalize">{key}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text className="text-red-400 text-center mb-4">{error}</Text> : null}

            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : getActiveUsers().length === 0 ? (
              <Text className="text-gray-400 text-center">
                {tab === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </Text>
            ) : (
              <FlatList
                data={getActiveUsers()}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View className="flex-row items-center justify-between mb-3">
                    <TouchableOpacity
                      onPress={() => setSelectedProfileId(item._id)}
                      className="flex-row items-center"
                    >
                      <Image
                        source={
                          item.profile_image
                            ? { uri: `${item.profile_image}?t=${Date.now()}` }
                            : require('../../assets/default-avatar.png')
                        }
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <Text className="text-white">{item.name}</Text>
                    </TouchableOpacity>
                    {item._id !== currentUserId && (
                      <TouchableOpacity
                        onPress={() => handleToggleFollow(item._id)}
                        className={`${item.isFollowing ? 'bg-red-600' : 'bg-pink-600'} py-1 px-3 rounded-lg`}
                      >
                        <Text className="text-white text-sm">{item.isFollowing ? 'Unfollow' : 'Follow'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              onPress={onClose}
              className="bg-red-600 py-2 px-4 rounded-lg mt-4"
            >
              <Text className="text-white text-center">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ProfilePopup
        isVisible={!!selectedProfileId}
        userId={selectedProfileId ?? undefined}
        onClose={() => setSelectedProfileId(null)}
      />
    </>
  );
};

export default FollowManager;