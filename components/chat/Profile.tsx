import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Modal, Alert, FlatList, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Post from './Post';
import FollowManager from './FollowManager';

type ProfileType = {
  _id: string;
  profile_image: string;
  name: string;
  bio: string;
  followers: string[];
  following: string[];
};

type PostType = {
  _id: string;
  user_id: string;
  content: string;
  likes: string[];
  comments: any[];
  image_urls: string[];
  [key: string]: any;
};

const Profile = () => {
  const { params } = useRoute() as { params: { userId?: string } };
  const { userId } = params || {};
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostType[]>([]);
  const [commentedPosts, setCommentedPosts] = useState<PostType[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFollowManager, setShowFollowManager] = useState(false);
  const [tab, setTab] = useState("your");
  const { state: { userToken }, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = profile?._id;

  const fetchProfileAndPosts = async () => {
    setIsLoading(true);
    try {
      const id = userId || await AsyncStorage.getItem('userId');
      const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${id || ''}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const profileData = await profileResponse.json();
      if (profileResponse.ok) {
        setProfile({
          ...profileData.user,
          profile_image: profileData.user.profile_image
            ? `${profileData.user.profile_image}?t=${Date.now()}`
            : null,
        });
        setBio(profileData.user.bio || "");
        setPostCount(profileData.postCount || 0);
        const normalizedPosts = profileData.posts.map((post: any) => ({
          ...post,
          image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
        }));
        setPosts(normalizedPosts || []);
      } else {
        setError(profileData.message || 'Failed to fetch profile');
      }

      const likedResponse = await fetch(`${API_BASE_URL}/api/posts/liked`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const likedData = await likedResponse.json();
      if (likedResponse.ok) {
        const normalizedLikedPosts = likedData.posts.map((post: any) => ({
          ...post,
          image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
        }));
        setLikedPosts(normalizedLikedPosts || []);
      } else {
        setError(likedData.message || 'Failed to fetch liked posts');
      }

      const commentedResponse = await fetch(`${API_BASE_URL}/api/posts/commented`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const commentedData = await commentedResponse.json();
      if (commentedResponse.ok) {
        const normalizedCommentedPosts = commentedData.posts.map((post: any) => ({
          ...post,
          image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
        }));
        setCommentedPosts(normalizedCommentedPosts || []);
      } else {
        setError(commentedData.message || 'Failed to fetch commented posts');
      }
    } catch (err) {
      setError('Error fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndPosts();
  }, [userId, userToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfileAndPosts();
    setRefreshing(false);
  }, [userId, userToken]);

  const handleImageChange = async () => {
    if (!isEditing) {
      Alert.alert("Edit mode required", "Tap 'Edit Profile' first to change your picture.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setProfileImage(asset);
      setPreviewImage(asset.uri);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('bio', bio);
    if (profileImage) {
      formData.append('profile_image', {
        uri: profileImage.uri,
        type: profileImage.mimeType || 'image/jpeg',
        name: profileImage.fileName || profileImage.uri.split('/').pop() || 'profile.jpg',
      } as any);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userToken}` },
        body: formData,
      });
      if (response.ok) {
        fetchProfileAndPosts();
        setIsEditing(false);
        setPreviewImage(null);
        setProfileImage(null);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLikePost = async (postId: string, setPostsFn: React.Dispatch<React.SetStateAction<PostType[]>>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPostsFn((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: data.likes === post.likes.length
                    ? post.likes.filter((id) => id !== currentUserId)
                    : [...post.likes, currentUserId],
                }
              : post
          )
        );
        if (setPostsFn !== setLikedPosts) {
          setLikedPosts((prev) =>
            data.likes === prev.find((p) => p._id === postId)?.likes.length
              ? prev.filter((p) => p._id !== postId)
              : prev.some((p) => p._id === postId)
              ? prev
              : [posts.find((p) => p._id === postId) || commentedPosts.find((p) => p._id === postId), ...prev].filter(
                  Boolean
                ) as PostType[]
          );
        }
      } else {
        setError(data.message || 'Failed to like/unlike post');
      }
    } catch (err: any) {
      setError('Error liking post: ' + err.message);
      console.error('Like post error:', err);
    }
  };

  const handleAddComment = async (
    postId: string,
    content: string,
    setPostsFn: React.Dispatch<React.SetStateAction<PostType[]>>
  ) => {
    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (response.ok) {
        setPostsFn((prevPosts) =>
          prevPosts.map((post) => (post._id === postId ? { ...post, ...data.post } : post))
        );
        if (setPostsFn !== setCommentedPosts && !commentedPosts.some((p) => p._id === postId)) {
          setCommentedPosts((prev) => [{ ...data.post, image_urls: data.post.image_urls || (data.post.image_url ? [data.post.image_url] : []) }, ...prev]);
        }
      } else {
        setError(data.message || 'Failed to add comment');
      }
    } catch (err: any) {
      setError('Error adding comment: ' + err.message);
      console.error('Add comment error:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        setPosts((prev) => prev.filter((post) => post._id !== postId));
        setPostCount((prev) => prev - 1);
        setLikedPosts((prev) => prev.filter((post) => post._id !== postId));
        setCommentedPosts((prev) => prev.filter((post) => post._id !== postId));
      } else {
        setError(data.message || 'Failed to delete post');
      }
    } catch (err: any) {
      setError('Error deleting post: ' + err.message);
      console.error('Delete post error:', err);
    }
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    setPreviewImage(null);
    setProfileImage(null);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Yes', onPress: signOut },
    ]);
  };

  const getActivePosts = () => {
    switch (tab) {
      case "your": return posts;
      case "liked": return likedPosts;
      case "commented": return commentedPosts;
      default: return posts;
    }
  };

  if (!profile) return <Text className="text-white mt-10">Loading...</Text>;

  return (
    <View className="flex-1 bg-[#1a002f] p-4">
      {/* Profile Info */}
      <View className="flex-row items-center mb-4">
        <TouchableOpacity onPress={handleImageChange}>
          <Image source={{ uri: previewImage || profile.profile_image }} className="w-24 h-24 rounded-full border-2 border-white" />
          <Text className="absolute bottom-0 right-0 bg-pink-600 text-white rounded-full p-1">📷</Text>
        </TouchableOpacity>
        <View className="ml-4">
          <Text className="text-white text-xl font-bold">@{profile.name}</Text>
          <View className="flex-row space-x-4 mt-1">
            <Text className="text-gray-300">{postCount} Posts | </Text>
            <TouchableOpacity onPress={() => setShowFollowManager(true)}>
              <Text className="text-gray-300">{profile.followers.length} Followers | </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFollowManager(true)}>
              <Text className="text-gray-300">{profile.following.length} Following</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bio */}
      {isEditing ? (
        <TextInput
          className="bg-white p-2 rounded-lg w-full h-12 mb-4 text-black"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          placeholder="Bio"
        />
      ) : (
        <Text className="text-gray-300 mb-4 text-left">{bio || 'No bio yet'}</Text>
      )}

      {/* Buttons */}
      {!isEditing ? (
        <View className="flex-row mb-4">
          <TouchableOpacity
            className="flex-1 bg-pink-600 p-3 rounded-lg mr-4"
            onPress={toggleEditMode}
          >
            <Text className="text-white font-bold text-center">Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-red-600 p-3 rounded-lg"
            onPress={handleLogout}
          >
            <Text className="text-white font-bold text-center">Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row mb-4">
          <TouchableOpacity
            className="flex-1 bg-green-600 p-3 rounded-lg mr-4"
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text className="text-white font-bold text-center">
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-500 p-3 rounded-lg"
            onPress={toggleEditMode}
          >
            <Text className="text-white font-bold text-center">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View className="flex-row mb-4">
        {['your', 'liked', 'commented'].map((key) => (
          <TouchableOpacity
            key={key}
            className={`flex-1 p-2 rounded-lg mx-1 ${tab === key ? 'bg-pink-600' : 'bg-purple-900'}`}
            onPress={() => setTab(key)}
          >
            <Text className="text-white text-center">{key === 'your' ? 'My Posts' : key === 'liked' ? 'Likes' : 'Comments'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Posts - 1 per row */}
      <FlatList
        data={getActivePosts()}
        renderItem={({ item }) => (
          <View className="w-full mb-4">
            <Post
              post={item}
              userId={currentUserId || ""}
              onLike={() => handleLikePost(item._id, tab === 'your' ? setPosts : tab === 'liked' ? setLikedPosts : setCommentedPosts)}
              onComment={(postId, content) => handleAddComment(postId, content, tab === 'your' ? setPosts : tab === 'liked' ? setLikedPosts : setCommentedPosts)}
              onDelete={() => handleDeletePost(item._id)}
            />
          </View>
        )}
        keyExtractor={(item) => item._id}
        numColumns={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      />

      {/* Follow Manager Modal */}
      <FollowManager
        isVisible={showFollowManager}
        userId={currentUserId || ""}
        onClose={() => setShowFollowManager(false)}
      />
    </View>
  );
};

export default Profile;