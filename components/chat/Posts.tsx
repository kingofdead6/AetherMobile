import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { SocketContext } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../api";
import Post from "./Post";

interface Post {
  _id: string;
  user_id: string;
  content: string;
  image_urls: string[];
  likes: string[];
  comments: any[];
  user: {
    username: string;
    profile_image?: string;
  };
}

interface TypedSocket {
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
}

const Posts: React.FC = () => {
  const { socket, connectionError } = useContext(SocketContext);
  const { state: { userToken } } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [postImages, setPostImages] = useState<any[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setCurrentUserId(id || ''));
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!userToken) {
      setError("Authentication token missing");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/followed`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        const normalizedPosts = data.posts.map((post: any) => ({
          _id: post._id,
          user_id: post.user_id,
          content: post.content,
          image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
          likes: post.likes || [],
          comments: post.comments || [],
          user: {
            username: post.user?.username || post.user?.name || "Unknown",
            profile_image: post.user?.profile_image ? `${post.user.profile_image}?t=${Date.now()}` : undefined,
          },
        }));
        setPosts(normalizedPosts);
      } else {
        setError(data.message || "Failed to fetch posts");
      }
    } catch (err: any) {
      setError("Error fetching posts: " + err.message);
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!socket) {
      console.log("Socket not available yet");
      return;
    }

    const handleNewPost = (post: Post) => {
      const normalizedPost = {
        ...post,
        image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
        likes: post.likes || [],
        comments: post.comments || [],
        user: {
          username: post.user?.username || post.user?.name || "Unknown",
          profile_image: post.user?.profile_image ? `${post.user.profile_image}?t=${Date.now()}` : undefined,
        },
      };
      setPosts((prev) => [normalizedPost, ...prev]);
    };

    socket.on("newPost", handleNewPost);

    return () => {
      socket.off("newPost", handleNewPost);
    };
  }, [socket]);

  const handleImageChange = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newImages = result.assets;
      if (newImages.length + postImages.length > 5) {
        setError("Maximum 5 images allowed");
        return;
      }
      const validImages = newImages.filter(asset => {
        if (!asset.mimeType?.startsWith('image/')) {
          setError("Please select valid image files (e.g., JPG, PNG)");
          return false;
        }
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          setError("Each image must be less than 5MB");
          return false;
        }
        return true;
      });
      setPostImages([...postImages, ...validImages]);
      setPreviewImages([...previewImages, ...validImages.map(asset => asset.uri)]);
      setError("");
    }
  };

  const removeImage = (index: number) => {
    setPostImages(postImages.filter((_, i) => i !== index));
    setPreviewImages(previewImages.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (!newContent.trim()) {
      setError("Post content is required");
      return;
    }
    if (postImages.length === 0) {
      setError("At least one image is required");
      return;
    }
    setIsLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("content", newContent);
    postImages.forEach((image, index) => {
      formData.append("images", {
        uri: image.uri,
        type: image.mimeType || 'image/jpeg',
        name: image.fileName || `image_${index}.jpg`,
      } as any);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: formData,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        const newPost = {
          _id: data.post._id,
          user_id: data.post.user_id,
          content: data.post.content,
          image_urls: data.post.image_urls || [],
          likes: data.post.likes || [],
          comments: data.post.comments || [],
          user: {
            username: data.post.user?.username || data.post.user?.name || "Unknown",
            profile_image: data.post.user?.profile_image ? `${data.post.user.profile_image}?t=${Date.now()}` : undefined,
          },
        };
        setPosts((prev) => [newPost, ...prev]);
        if (socket) socket.emit('newPost', newPost);
        setNewContent("");
        setPostImages([]);
        setPreviewImages([]);
        setIsModalVisible(false);
      } else {
        setError(data.message || "Failed to create post");
      }
    } catch (err: any) {
      setError("Error creating post: " + err.message);
      console.error('Create post error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
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
        setPosts((prev) =>
          prev.map((post) =>
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
      } else {
        setError(data.message || 'Failed to like/unlike post');
      }
    } catch (err: any) {
      setError('Error liking post: ' + err.message);
      console.error('Like post error:', err);
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
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
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        setPosts((prev) =>
          prev.map((post) =>
            post._id === postId ? { ...post, ...data.post } : post
          )
        );
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
      if (!response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Expected JSON response');
      }
      const data = await response.json();
      if (response.ok) {
        setPosts((prev) => prev.filter((post) => post._id !== postId));
      } else {
        setError(data.message || 'Failed to delete post');
      }
    } catch (err: any) {
      setError('Error deleting post: ' + err.message);
      console.error('Delete post error:', err);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View className="w-full mb-4">
      <Post
        post={item}
        userId={currentUserId}
        onLike={() => handleLikePost(item._id)}
        onComment={(postId, content) => handleAddComment(postId, content)}
        onDelete={() => handleDeletePost(item._id)}
      />
    </View>
  );

  return ( 
    <View className="flex-1 p-4 bg-[#1a002f]">
      {error && <Text className="text-red-400 text-center mb-4">{error}</Text>}
      {connectionError && <Text className="text-red-400 text-center mb-4">{connectionError}</Text>}
      {isLoading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-4">No posts to display</Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        />
      )}
      <TouchableOpacity
        className="absolute bottom-4 right-4 bg-[#c6265e] w-12 h-12 rounded-full justify-center items-center"
        onPress={() => setIsModalVisible(true)}
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </TouchableOpacity>
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-center p-4">
          <View className="bg-[#1a002f] rounded-2xl p-6">
            <Text className="text-white text-xl font-bold mb-4">Create Post</Text>
            <TextInput
              className="p-3 bg-white/10 text-white rounded-lg mb-4 border border-gray-600"
              placeholder="What's on your mind? (280 characters max)"
              placeholderTextColor="#888"
              value={newContent}
              onChangeText={setNewContent}
              multiline
              maxLength={280}
            />
            <View className="flex-row flex-wrap mb-4">
              {previewImages.map((url, index) => (
                <View key={index} className="relative m-1">
                  <Image
                    source={{ uri: url }}
                    className="w-20 h-20 rounded-lg"
                  />
                  <TouchableOpacity
                    className="absolute top-0 right-0 bg-red-600 rounded-full p-1"
                    onPress={() => removeImage(index)}
                  >
                    <Text className="text-white text-xs">X</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <TouchableOpacity
              className="p-3 bg-purple-900 rounded-lg mb-4"
              onPress={handleImageChange}
            >
              <Text className="text-white text-center">Add Images (1-5)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="p-3 bg-pink-600 rounded-lg mb-2"
              onPress={handleCreatePost}
              disabled={isLoading || !newContent.trim() || postImages.length === 0}
            >
              <Text className="text-white font-bold text-center">
                {isLoading ? "Posting..." : "Post"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="p-3 bg-gray-600 rounded-lg"
              onPress={() => {
                setIsModalVisible(false);
                setNewContent("");
                setPostImages([]);
                setPreviewImages([]);
                setError("");
              }}
            >
              <Text className="text-white font-bold text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Posts;