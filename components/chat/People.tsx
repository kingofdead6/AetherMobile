import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Image, ActivityIndicator, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../api";
import { useAuth } from "../../context/AuthContext";
import ProfilePopup from "./ProfilePopup";

interface User {
  _id: string;
  name: string;
  bio: string;
  profile_image?: string;
  followers: string[];
  following: string[];
  isFollowing: boolean;
}

interface ProfileType {
  _id: string;
  following: string[];
}

const People: React.FC = () => {
  const { state: { userToken } } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<ProfileType | null>(null);

  const fetchCurrentUserProfile = useCallback(async () => {
    if (!userToken) {
      setError("Authentication token missing");
      return;
    }
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setError("User ID not found");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/auth/${userId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response for profile:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        setCurrentUserProfile({
          _id: data.user._id,
          following: data.user.following || [],
        });
      } else {
        setError(data.message || "Failed to fetch current user profile");
      }
    } catch (err: any) {
      setError("Error fetching profile: " + err.message);
      console.error('Error fetching profile:', err);
    }
  }, [userToken]);

  const fetchUsers = useCallback(async (query: string = "") => {
    if (!userToken) {
      setError("Authentication token missing");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = query
        ? `${API_BASE_URL}/api/auth/search?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/auth/search`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await res.json();
      if (res.ok) {
        const normalizedUsers = data.map((user: any) => ({
          _id: user._id,
          name: user.name,
          bio: user.bio || "No bio yet",
          profile_image: user.profile_image ? `${user.profile_image}?t=${Date.now()}` : undefined,
          followers: user.followers || [],
          following: user.following || [],
          isFollowing: currentUserProfile?.following.includes(user._id) || false,
        }));
        setUsers(normalizedUsers);
        setFilteredUsers(normalizedUsers);
      } else {
        setError(data.message || "Failed to fetch users");
      }
    } catch (err: any) {
      setError("Error fetching users: " + err.message);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [userToken, currentUserProfile]);

  useEffect(() => {
    fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  useEffect(() => {
    if (currentUserProfile) {
      fetchUsers(); // Initial fetch with no query
    }
  }, [currentUserProfile, fetchUsers]);

  const handleSearch = () => {
    fetchUsers(searchTerm);
  };

  const handleToggleFollow = async (targetUserId: string, isFollowing: boolean) => {
    try {
      const endpoint = `${API_BASE_URL}/api/auth/${targetUserId}/follow`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        setUsers((prev) =>
          prev.map((user) =>
            user._id === targetUserId ? { ...user, isFollowing: data.isFollowing } : user
          )
        );
        setFilteredUsers((prev) =>
          prev.map((user) =>
            user._id === targetUserId ? { ...user, isFollowing: data.isFollowing } : user
          )
        );
        if (actionUser?._id === targetUserId) {
          setActionUser((prev) => (prev ? { ...prev, isFollowing: data.isFollowing } : prev));
        }
        setCurrentUserProfile((prev) =>
          prev
            ? {
                ...prev,
                following: data.isFollowing
                  ? [...prev.following, targetUserId]
                  : prev.following.filter((id) => id !== targetUserId),
              }
            : prev
        );
      } else {
        setError(data.message || 'Failed to follow/unfollow user');
      }
    } catch (err: any) {
      setError(`Error following/unfollowing user: ${err.message}`);
      console.error('Follow toggle error:', err);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      className="flex-row items-center p-3 border-b border-gray-700"
      onPress={() => setActionUser(item)}
    >
      <Image
        source={
          item.profile_image
            ? { uri: item.profile_image }
            : require('../../assets/default-avatar.png')
        }
        className="w-10 h-10 rounded-full mr-3"
      />
      <View>
        <Text className="text-white font-bold">@{item.name}</Text>
        <Text className="text-gray-400 text-xs">{item.bio}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 p-4 bg-[#1a002f]">
      <View className="flex-row items-center mb-4">
        <TextInput
          className="flex-1 bg-white/10 text-white p-3 rounded-lg border border-gray-600 mr-2"
          placeholder="Search by name..."
          placeholderTextColor="#888"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <TouchableOpacity
          className="bg-pink-600 p-3 rounded-lg"
          onPress={handleSearch}
        >
          <Text className="text-white font-bold">Search</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-red-400 text-center mb-4">{error}</Text> : null}
      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-4">
              {searchTerm ? "No users found" : "No users available"}
            </Text>
          }
        />
      )}

      {/* User Action Popup */}
      <Modal
        visible={!!actionUser}
        transparent
        animationType="fade"
        onRequestClose={() => setActionUser(null)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-[#1a002f] rounded-2xl w-[80%] p-6">
            <Text className="text-white text-xl font-bold mb-4 text-center">
              @{actionUser?.name}
            </Text>
            <View className="flex-row justify-between mb-4">
              <TouchableOpacity
                className={`flex-1 p-3 rounded-lg mr-2 ${
                  actionUser?.isFollowing ? 'bg-red-600' : 'bg-pink-600'
                }`}
                onPress={() =>
                  handleToggleFollow(actionUser?._id || '', actionUser?.isFollowing || false)
                }
                disabled={!actionUser || actionUser._id === currentUserProfile?._id}
              >
                <Text className="text-white text-center font-bold">
                  {actionUser?.isFollowing ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 p-3 rounded-lg ml-2 bg-purple-900"
                onPress={() => {
                  setSelectedUserId(actionUser?._id || '');
                  setActionUser(null);
                }}
                disabled={!actionUser}
              >
                <Text className="text-white text-center font-bold">View Profile</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="bg-gray-600 p-3 rounded-lg"
              onPress={() => setActionUser(null)}
            >
              <Text className="text-white text-center font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Popup */}
      <ProfilePopup
        isVisible={!!selectedUserId}
        userId={selectedUserId ?? undefined}
        onClose={() => setSelectedUserId(null)}
      />
    </View>
  );
};

export default People;