import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Modal, Alert, FlatList, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Post from './Post';
import FollowManager from './FollowManager';

type ProfileType = {
  _id: string;
  profile_image?: string;
  name: string;
  bio?: string;
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

type Props = {
  isVisible: boolean;
  onClose: () => void;
  userId?: string;
};

const ProfilePopup = ({ isVisible, onClose, userId }: Props) => {
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
  const [showFollowManager, setShowFollowManager] = useState(false);
  const [tab, setTab] = useState("your");
  const [refreshing, setRefreshing] = useState(false);
  const { state: { userToken } } = useAuth();
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
            : undefined,
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
    if (isVisible) fetchProfileAndPosts();
  }, [isVisible, userId, userToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfileAndPosts();
    setRefreshing(false);
  }, [userId, userToken]);

  const handleImageChange = async () => {
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

  const getActivePosts = () => {
    switch (tab) {
      case "your": return posts;
      case "liked": return likedPosts;
      case "commented": return commentedPosts;
      default: return posts;
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 justify-center items-center">
        <View className="bg-[#1a002f] rounded-2xl w-[90%] max-h-[90%] p-4">
          <ScrollView>
            <TouchableOpacity className="self-end mb-2" onPress={onClose}>
              <Text className="text-white text-lg">✖</Text>
            </TouchableOpacity>

            {profile ? (
              <>
                <View className="flex-row items-center mb-4">
                  <TouchableOpacity onPress={handleImageChange}>
                    <Image
                      source={previewImage
                        ? { uri: previewImage }
                        : profile.profile_image
                          ? { uri: profile.profile_image }
                          : require('../../assets/default-avatar.png')}
                      className="w-20 h-20 rounded-full border-2 border-white"
                    />
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
                    <Text className="text-gray-300 mb-4 text-left">{bio || 'No bio yet'}</Text>
                  </View>
                </View>

                <View className="flex-row mb-4">
                  {['your', 'liked', 'commented'].map((key) => (
                    <TouchableOpacity
                      key={key}
                      className={`flex-1 p-2 rounded-lg mx-1 ${tab === key ? 'bg-pink-600' : 'bg-purple-900'}`}
                      onPress={() => setTab(key)}
                    >
                      <Text className="text-white text-center">
                        {key === 'your' ? 'Posts' : key === 'liked' ? 'Likes' : 'Comments'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FlatList
                  data={getActivePosts()}
                  renderItem={({ item }) => (
                    <View className="w-full mb-4">
                      <Post
                        post={item}
                        userId={currentUserId}
                        onLike={() => handleLikePost(item._id, tab === 'your' ? setPosts : tab === 'liked' ? setLikedPosts : setCommentedPosts)}
                        onComment={(postId, content) => handleAddComment(postId, content, tab === 'your' ? setPosts : tab === 'liked' ? setLikedPosts : setCommentedPosts)}
                        onDelete={() => handleDeletePost(item._id)}
                      />
                    </View>
                  )}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                  }
                />
              </>
            ) : (
              <Text className="text-white">Loading...</Text>
            )}
          </ScrollView>
        </View>
      </View>

      <FollowManager
        isVisible={showFollowManager}
        userId={currentUserId || ""}
        onClose={() => setShowFollowManager(false)}
      />
    </Modal>
  );
};

export default ProfilePopup;