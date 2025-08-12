import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { Heart, MessageCircle, X } from 'lucide-react-native';
import ProfilePopup from './ProfilePopup';

const Post = ({ post, userId, onLike, onComment, onDelete }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [fullScreenComments, setFullScreenComments] = useState(false);

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % (post.image_urls?.length || 0));
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + (post.image_urls?.length || 0)) % (post.image_urls?.length || 0));
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await onComment(post._id, newComment);
    setNewComment('');
  };

  const formatDate = (date) => new Date(date).toLocaleString();

  return (
    <View className="bg-white/10 p-4 rounded-xl border border-white/20 mb-4">
      {/* Header */}
      <View className="flex-row justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => setShowProfilePopup(true)}>
            <Image source={{ uri: post.user_id?.profile_image }} className="w-10 h-10 rounded-full" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProfilePopup(true)}>
            <View>
              <Text className="text-white font-bold">{post.user_id?.name}</Text>
              <Text className="text-gray-400 text-xs">{formatDate(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        </View>
        {post.user_id?._id === userId && (
          <TouchableOpacity onPress={() => onDelete(post._id)}>
            <Text className="text-red-500">Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Images */}
      {post.image_urls?.length > 0 && (
        <View className="relative">
          <Image source={{ uri: post.image_urls[currentImageIndex] }} className="w-full h-64 rounded-lg" />
          {post.image_urls.length > 1 && (
            <View className="flex-row justify-between absolute top-1/2 w-full">
              <TouchableOpacity onPress={handlePrevImage} className="bg-black/50 p-2">
                <Text className="text-white">←</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextImage} className="bg-black/50 p-2">
                <Text className="text-white">→</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <Text className="text-gray-100 my-2">{post.content}</Text>

      {/* Like & Comment Buttons */}
      <View className="flex-row gap-4">
        <TouchableOpacity onPress={() => onLike(post._id)} className="flex-row items-center gap-1">
          <Heart
            color={post.likes?.includes(userId) ? 'red' : 'gray'}
            fill={post.likes?.includes(userId) ? 'red' : 'none'}
            size={24}
          />
          <Text className="text-gray-400">{post.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowComments(true)} className="flex-row items-center gap-1">
          <MessageCircle color="gray" size={24} />
          <Text className="text-gray-400">{post.comments?.length || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <View
            className="bg-[#1a002f] rounded-t-2xl p-4"
            style={{ height: fullScreenComments ? '100%' : '50%' }}
          >
            {/* Close Button */}
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white text-lg font-bold">Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <X color="white" size={24} />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <ScrollView
              onScrollBeginDrag={() => setFullScreenComments(true)}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {post.comments?.length > 0 ? (
                post.comments.map((item, index) => (
                  <View key={index} className="flex-row gap-2 my-2">
                    <Image source={{ uri: item.user_id?.profile_image }} className="w-8 h-8 rounded-full" />
                    <View>
                      <Text className="text-white font-bold">{item.user_id?.name}</Text>
                      <Text className="text-gray-100">{item.content}</Text>
                      <Text className="text-gray-400 text-xs">{formatDate(item.createdAt)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-center mt-4">No comments yet</Text>
              )}
            </ScrollView>

            {/* Add Comment */}
            <View className="flex-row mt-4">
              <TextInput
                className="flex-1 bg-white/90 p-2 rounded-lg"
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Add a comment..."
                placeholderTextColor="#555"
              />
              <TouchableOpacity onPress={handleAddComment} className="bg-pink-600 p-2 rounded-lg ml-2">
                <Text className="text-white">Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Popup */}
      <ProfilePopup
        isVisible={showProfilePopup}
        userId={post.user_id?._id}
        onClose={() => setShowProfilePopup(false)}
      />
    </View>
  );
};

export default Post;