import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SocketContext } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';

type User = {
  _id: string;
  name: string;
  profile_image?: string;
  username?: string;
};

type Message = {
  _id?: string;
  tempId?: string;
  chat_id: string;
  sender_id: User;
  content: string;
  file_url?: string;
  file_type?: 'image' | 'video' | 'pdf';
  createdAt: string;
  status: 'sending' | 'sent';
  seenBy?: string[];
  replyTo?: Message;
  isDeleted?: boolean;
};

type ChatWindowProps = {
  route: { params: { roomId: string } };
  navigation: any;
};

const ChatWindow: React.FC<ChatWindowProps> = ({ route, navigation }) => {
  const { socket, updateActiveChatId, reconnect, queueEvent } = useContext(SocketContext);
  const { state: { userToken } } = useAuth();
  const { roomId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; y: number; isSent: boolean } | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [contextMenuAnim] = useState(new Animated.Value(0)); // Added for animation
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRefs = useRef<{ [key: string]: any }>({});
  const visibleMessages = useRef<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const contextMenuRef = useRef<View>(null); // Added for click outside detection
  const touchCountRef = useRef<{ [key: string]: number }>({}); // Added for long press detection

  const windowWidth = Dimensions.get('window').width;

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    []
  );

  const throttle = (func: (...args: any[]) => void, wait: number) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= wait) {
        lastCall = now;
        func(...args);
      }
    };
  };

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      if (id) setCurrentUserId(id);
      else setError('No user ID found in storage');
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const scrollToMessage = (messageId: string) => {
    const index = messages.findIndex(m => m._id === messageId || m.tempId === messageId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setTimeout(() => {
        const messageElement = messageRefs.current[messageId];
        if (messageElement) {
          messageElement.setNativeProps({ style: { backgroundColor: 'rgba(255, 255, 0, 0.2)' } });
          setTimeout(() => {
            messageElement.setNativeProps({ style: { backgroundColor: 'transparent' } });
          }, 2000);
        }
      }, 300);
    }
  };

  const fetchMessages = useCallback(async () => {
    if (!userToken || !roomId) {
      setError('Missing token or room ID');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Expected JSON response');
      }
      const data = await res.json();
      if (res.ok) {
        const sanitizedMessages = data.map((msg: Message) => ({
          ...msg,
          sender_id: {
            _id: msg.sender_id?._id || 'unknown',
            name: msg.sender_id?.name || 'Unknown',
            profile_image: msg.sender_id?.profile_image || undefined,
            username: msg.sender_id?.username,
          },
          seenBy: msg.seenBy || [],
        }));
        setMessages(sanitizedMessages);
        setUpdateTrigger(prev => prev + 1);
        scrollToBottom();
      } else {
        setError(data.message || 'Failed to fetch messages');
      }
    } catch (err: any) {
      setError('Error fetching messages: ' + err.message);
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, userToken, scrollToBottom]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const markMessagesAsSeen = useCallback((messageIds: string[]) => {
    if (messageIds.length > 0 && socket) {
      if (socket.connected) {
        socket.emit('mark_messages_seen', { chatId: roomId, messageIds });
      } else {
        queueEvent('mark_messages_seen', { chatId: roomId, messageIds });
        reconnect();
      }
    } else {
      console.warn('Socket not available or no message IDs');
      if (socket) reconnect();
    }
  }, [socket, roomId, reconnect, queueEvent]);

  const throttledMarkMessagesAsSeen = useCallback(
    throttle((messageIds: string[]) => {
      markMessagesAsSeen(messageIds);
    }, 300),
    [markMessagesAsSeen]
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    updateActiveChatId(roomId);
    socket.emit('join_chat', roomId);

    socket.on('receive_message', (msg: Message) => {
      try {
        const sanitizedMsg = {
          ...msg,
          sender_id: {
            _id: msg.sender_id?._id || 'unknown',
            name: msg.sender_id?.name || 'Unknown',
            profile_image: msg.sender_id?.profile_image || undefined,
            username: msg.sender_id?.username,
          },
          status: 'sent',
          seenBy: msg.seenBy || [],
        };
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id || m.tempId === msg.tempId)) {
            return prev.map(m => (m.tempId === msg.tempId ? { ...sanitizedMsg } : { ...m }));
          }
          return [...prev, sanitizedMsg];
        });
        setUpdateTrigger(prev => prev + 1);
        setReplyingTo(null);
        scrollToBottom();
      } catch (err: any) {
        setError('Error processing message: ' + err.message);
        console.error('Socket message error:', err);
      }
    });

    socket.on('message_updated', (updatedMessage: Message) => {
      setMessages(prev =>
        prev.map(msg => (msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : { ...msg }))
      );
      setUpdateTrigger(prev => prev + 1);
    });

    socket.on('message_deleted', (deletedMessage: Message) => {
      setMessages(prev =>
        prev.map(msg => (msg._id === deletedMessage._id ? { ...msg, ...deletedMessage } : { ...msg }))
      );
      setUpdateTrigger(prev => prev + 1);
    });

    socket.on('message_seen', ({ messageId, userId }: { messageId: string; userId: string }) => {
      if (!messageId || !userId) {
        console.warn('Invalid message_seen event data:', { messageId, userId });
        return;
      }
      setMessages(prev => {
        const newMessages = prev.map(msg =>
          msg._id === messageId
            ? { ...msg, seenBy: [...new Set([...(msg.seenBy || []), userId])] }
            : { ...msg }
        );
        return newMessages;
      });
      setUpdateTrigger(prev => prev + 1);
    });

    socket.on('messages_seen', ({ messageIds, userId }: { messageIds: string[]; userId: string }) => {
      if (!messageIds?.length || !userId) {
        console.warn('Invalid messages_seen event data:', { messageIds, userId });
        return;
      }
      setMessages(prev => {
        const newMessages = prev.map(msg =>
          messageIds.includes(msg._id!)
            ? { ...msg, seenBy: [...new Set([...(msg.seenBy || []), userId])] }
            : { ...msg }
        );
        return newMessages;
      });
      setUpdateTrigger(prev => prev + 1);
    });

    socket.on('unseen_messages', ({ messageIds }: { messageIds: string[] }) => {
      if (messageIds.length > 0) {
        throttledMarkMessagesAsSeen(messageIds);
      }
    });

    socket.on('typing', ({ userId }: { userId: string }) => {
      if (userId !== currentUserId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    socket.on('message_error', ({ tempId, error }: { tempId: string; error: string }) => {
      setError(error);
      setMessages(prev => prev.filter(msg => msg.tempId !== tempId));
      setUpdateTrigger(prev => prev + 1);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.off('receive_message');
      socket.off('message_updated');
      socket.off('message_deleted');
      socket.off('message_seen');
      socket.off('messages_seen');
      socket.off('unseen_messages');
      socket.off('typing');
      socket.off('message_error');
      socket.off('error');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, roomId, currentUserId, scrollToBottom, updateActiveChatId]);

  useEffect(() => {
    if (newMessage.trim() && socket && socket.connected) {
      socket.emit('typing', { chatId: roomId, userId: currentUserId });
    }
  }, [newMessage, socket, roomId, currentUserId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!flatListRef.current || !messages.length || !currentUserId) return;

      const visibleMessageIds = visibleMessages.current.filter(id =>
        messages.some(
          msg =>
            msg._id === id &&
            msg.sender_id._id !== currentUserId &&
            !msg.seenBy?.includes(currentUserId)
        )
      );
      if (visibleMessageIds.length > 0) {
        throttledMarkMessagesAsSeen(visibleMessageIds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [messages, currentUserId, throttledMarkMessagesAsSeen]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const newVisibleMessageIds = viewableItems
        .map(item => item.item._id)
        .filter((id): id is string => !!id && messages.some(msg => msg._id === id && msg.sender_id._id !== currentUserId));
      visibleMessages.current = newVisibleMessageIds;
      if (newVisibleMessageIds.length > 0) {
        throttledMarkMessagesAsSeen(newVisibleMessageIds);
      }
    },
    [messages, currentUserId, throttledMarkMessagesAsSeen]
  );

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile || !socket || !currentUserId) {
      return;
    }

    const tempId = `${Date.now()}-${Math.random()}`;
    const tempMessage: Message = {
      chat_id: roomId,
      sender_id: { _id: currentUserId, name: 'You', profile_image: undefined },
      content: newMessage,
      file_url: selectedFile ? selectedFile.uri : undefined,
      file_type: selectedFile
        ? selectedFile.type.startsWith('image')
          ? 'image'
          : selectedFile.type.startsWith('video')
            ? 'video'
            : 'pdf'
        : undefined,
      tempId,
      createdAt: new Date().toISOString(),
      status: 'sending',
      seenBy: [currentUserId],
      replyTo: replyingTo || undefined,
    };

    setMessages(prev => [...prev, tempMessage]);
    setUpdateTrigger(prev => prev + 1);
    setNewMessage('');
    setSelectedFile(null);
    setReplyingTo(null);
    scrollToBottom();

    try {
      const formData = new FormData();
      formData.append('content', newMessage || '');
      formData.append('tempId', tempId);
      formData.append('chat_id', roomId);
      formData.append('sender_id', currentUserId);
      if (replyingTo) {
        formData.append('replyTo', JSON.stringify({
          _id: replyingTo._id,
          content: replyingTo.content,
          sender_id: replyingTo.sender_id,
          file_url: replyingTo.file_url,
          file_type: replyingTo.file_type,
          isDeleted: replyingTo.isDeleted || false,
        }));
      }
      if (selectedFile) {
        formData.append('file', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type,
        } as any);
      }

      const res = await fetch(`${API_BASE_URL}/api/chats/${roomId}/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send message');
      }
      setMessages(prev =>
        prev.map(msg =>
          msg.tempId === tempId ? { ...msg, _id: data._id, status: 'sent' } : { ...msg }
        )
      );
      setUpdateTrigger(prev => prev + 1);
    } catch (err: any) {
      setError('Error sending message: ' + err.message);
      setMessages(prev => prev.filter(msg => msg.tempId !== tempId));
      setUpdateTrigger(prev => prev + 1);
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${roomId}/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to edit message');
      }
      if (socket) {
        socket.emit('updateMessage', { chatId: roomId, messageId, content });
      }
      setEditingMessageId(null);
      setEditContent('');
      setContextMenu(null);
      setUpdateTrigger(prev => prev + 1);
    } catch (err: any) {
      setError('Error editing message: ' + err.message);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete message');
      }
      if (socket) {
        socket.emit('deleteMessage', { chatId: roomId, messageId });
      }
      setContextMenu(null);
      setUpdateTrigger(prev => prev + 1);
    } catch (err: any) {
      setError('Error deleting message: ' + err.message);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access media library denied');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: `media-${Date.now()}.${asset.type === 'image' ? 'jpg' : 'mp4'}`,
        type: asset.type === 'image' ? 'image/jpeg' : 'video/mp4',
      });
    }
  };

  const formatTimestamp = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const createPanResponder = (item: Message) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 50) { // Swipe right threshold
          setReplyingTo(item);
        }
      },
      onPanResponderRelease: () => {},
    });
  };

  // Added animation for context menu
  const showContextMenu = (messageId: string, isSent: boolean) => {
    setContextMenu({ messageId, y: 0, isSent });
    Animated.timing(contextMenuAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideContextMenu = () => {
    Animated.timing(contextMenuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setContextMenu(null);
    });
  };

  // Added for click outside detection
  useEffect(() => {
    const handleOutsideClick = (event: any) => {
      if (contextMenu && contextMenuRef.current) {
        contextMenuRef.current.measure((x, y, width, height, pageX, pageY) => {
          const touchX = event.nativeEvent.pageX;
          const touchY = event.nativeEvent.pageY;
          if (
            touchX < pageX ||
            touchX > pageX + width ||
            touchY < pageY ||
            touchY > pageY + height
          ) {
            hideContextMenu();
          }
        });
      }
    };

    return () => {};
  }, [contextMenu]);

  const renderMessage = ({ item }: { item: Message }) => {
    if (!item.sender_id) {
      item.sender_id = { _id: 'unknown', name: 'Unknown', username: undefined };
    }
    const isSent = item.sender_id._id === currentUserId;
    const seenByOthers = (item.seenBy || []).filter(id => id !== item.sender_id._id).length;
    const panResponder = createPanResponder(item);

    // Added for long press detection
    const handlePress = () => {
      const messageId = item._id || item.tempId!;
      touchCountRef.current[messageId] = (touchCountRef.current[messageId] || 0) + 1;

      if (touchCountRef.current[messageId] >= 3) {
        showContextMenu(messageId, isSent);
        touchCountRef.current[messageId] = 0; // Reset counter
      }
    };

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={(event) => {
          if (contextMenu) {
            hideContextMenu();
          }
        }}
        className={`flex-row ${isSent ? 'justify-end' : 'justify-start'} mb-3 px-4 relative`}
        {...panResponder.panHandlers}
      >
        <View
          className="flex-row items-end"
          ref={el => (messageRefs.current[item._id || item.tempId!] = el)}
        >
          <TouchableOpacity
            className="p-2 bg-gray-800 rounded-full mr-2"
            onPress={() => {
              if (contextMenu?.messageId === (item._id || item.tempId!)) {
                hideContextMenu();
              } else {
                showContextMenu(item._id || item.tempId!, isSent);
              }
            }}
            onLongPress={handlePress}
          >
            <Ionicons name="ellipsis-vertical" size={16} color="white" />
          </TouchableOpacity>
          <View
            className={`max-w-full p-3 rounded-lg shadow-md ${
              isSent ? 'bg-pink-800' : 'bg-gray-700'
            }`}
          >
            <Text className={`text-sm font-semibold mb-1 text-white`}>
              {isSent ? 'You' : item.sender_id.name || item.sender_id.username || 'Unknown'}
            </Text>
            {item.isDeleted ? (
              <Text className="text-gray-400 text-sm italic">This message was deleted</Text>
            ) : (
              <>
                {item.replyTo && (
                  <TouchableOpacity
                    className={`mb-2 p-2 rounded-lg border-l-4 ${
                      isSent ? 'bg-pink-700/30 border-pink-300' : 'bg-gray-800/90 border-gray-500'
                    }`}
                    onPress={() => scrollToMessage(item.replyTo?._id!)}
                  >
                    <Text className={`text-sm font-medium ${isSent ? 'text-pink-200' : 'text-gray-300'}`}>
                      Replying to{' '}
                      {item.replyTo.sender_id?._id === currentUserId
                        ? 'yourself'
                        : item.replyTo.sender_id?.name || item.replyTo.sender_id?.username || 'Unknown'}
                    </Text>
                    <Text className={`text-sm truncate ${isSent ? 'text-pink-100' : 'text-gray-200'}`}>
                      {item.replyTo.isDeleted
                        ? 'Deleted message'
                        : item.replyTo.content || (item.replyTo.file_type ? `[${item.replyTo.file_type}]` : '[Media]')}
                    </Text>
                  </TouchableOpacity>
                )}
                {item.file_type === 'image' && item.file_url && (
                  <Image
                    source={{ uri: item.file_url }}
                    className="w-full rounded-lg mb-2"
                    style={{ aspectRatio: 4 / 3 }}
                    resizeMode="contain"
                  />
                )}
                {item.file_type === 'video' && item.file_url && (
                  <Video
                    source={{ uri: item.file_url }}
                    className="w-full rounded-lg mb-2"
                    style={{ aspectRatio: 16 / 9 }}
                    useNativeControls
                    resizeMode="contain"
                  />
                )}
                {item.file_type === 'pdf' && item.file_url && (
                  <Text className="text-pink-400 text-sm underline mb-2">View PDF</Text>
                )}
                {editingMessageId === (item._id || item.tempId) ? (
                  <View className="flex-col gap-2">
                    <TextInput
                      className="p-2 bg-gray-800 text-white rounded-lg border border-gray-600"
                      value={editContent}
                      onChangeText={setEditContent}
                    />
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="px-4 py-2 bg-pink-600 rounded-lg"
                        onPress={() => handleEditMessage(item._id!, editContent)}
                      >
                        <Text className="text-white text-sm font-bold">Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-2 bg-gray-600 rounded-lg"
                        onPress={() => {
                          setEditingMessageId(null);
                          setEditContent('');
                          setContextMenu(null);
                        }}
                      >
                        <Text className="text-white text-sm font-bold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {item.content && <Text className="text-sm text-white">{item.content}</Text>}
                    <View className="flex-row items-center justify-end gap-1 mt-2">
                      <Text className="text-xs text-white">{formatTimestamp(item.createdAt)}</Text>
                      {isSent && (
                        <View className="flex-row items-center gap-1 transition-opacity duration-300">
                          {item.status === 'sending' ? (
                            <Text className="text-xs text-white">Sending...</Text>
                          ) : seenByOthers > 0 ? (
                            <>
                              <Ionicons name="checkmark-done" size={14} color="#60a5fa" className="animate-pulse" />
                              <Text className="text-xs text-white">
                                Seen{seenByOthers > 1 ? ` by ${seenByOthers}` : ''}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={14} color="#d1d5db" />
                              <Text className="text-xs text-white">Sent</Text>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  </>
                )}
                {contextMenu && contextMenu.messageId === (item._id || item.tempId) && (
                  <Animated.View
                    ref={contextMenuRef}
                    className="absolute bg-gray-800 rounded-lg p-2 shadow-lg flex-col gap-2 z-10"
                    style={{
                      top: 10,
                      right: isSent ? 10 : undefined,
                      left: isSent ? 0 : undefined,
                      width: 120,
                      opacity: contextMenuAnim,
                      transform: [
                        {
                          scale: contextMenuAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    }}
                  >
                    <TouchableOpacity
                      className="flex-row items-center p-2 hover:bg-gray-700 rounded"
                      onPress={() => {
                        setReplyingTo(item);
                        hideContextMenu();
                      }}
                    >
                      <Ionicons name="return-up-back" size={16} color="white" />
                      <Text className="text-white text-sm ml-2">Reply</Text>
                    </TouchableOpacity>
                    {isSent && !item.isDeleted && (
                      <>
                        <TouchableOpacity
                          className="flex-row items-center p-2 hover:bg-gray-700 rounded"
                          onPress={() => {
                            setEditingMessageId(item._id || item.tempId!);
                            setEditContent(item.content || '');
                            hideContextMenu();
                          }}
                        >
                          <Ionicons name="pencil" size={16} color="white" />
                          <Text className="text-white text-sm ml-2">Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-row items-center p-2 hover:bg-gray-700 rounded"
                          onPress={() => handleDeleteMessage(item._id!)}
                        >
                          <Ionicons name="trash" size={16} color="white" />
                          <Text className="text-white text-sm ml-2">Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </Animated.View>
                )}
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#1a002f]">
      {error && (
        <Text className="text-red-400 text-center p-3 bg-red-900/30 border-b border-red-700/40 text-sm">
          {error}
        </Text>
      )}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c6265e" />
        </View>
      ) : (
       <KeyboardAvoidingView
  behavior="padding"
  keyboardVerticalOffset={80} // adjust until the input is at the middle
  style={{ flex: 1 }}
>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item._id || item.tempId || `fallback-${Math.random()}`}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            extraData={{ messages, updateTrigger }}
            ListFooterComponent={
              isTyping ? (
                <View className="flex-row justify-start px-4 py-2">
                  <View className="bg-gray-700 p-3 rounded-lg shadow-md">
                    <View className="flex-row space-x-1">
                      <View
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '0s' }}
                      />
                      <View
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <View
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </View>
                  </View>
                </View>
              ) : null
            }
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
            onScrollToIndexFailed={info => {
              console.warn('Scroll to index failed:', info);
              scrollToBottom();
            }}
          />
          {replyingTo && (
            <View className="p-3 bg-gray-700 rounded-lg border-l-4 border-pink-600 flex-row items-center justify-between">
              <View>
                <Text className="text-pink-300 text-sm font-medium">
                  Replying to{' '}
                  {replyingTo.sender_id._id === currentUserId
                    ? 'yourself'
                    : replyingTo.sender_id.name || replyingTo.sender_id.username || 'Unknown'}
                </Text>
                <Text className="text-white text-sm truncate">
                  {replyingTo.isDeleted
                    ? 'Deleted message'
                    : replyingTo.content || (replyingTo.file_type ? `[${replyingTo.file_type}]` : '[Media]')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
          {selectedFile && (
            <View className="p-3 bg-gray-800 flex-row items-center justify-between">
              <Text className="text-white text-sm">Selected: {selectedFile.name}</Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <Ionicons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}
          <View className="flex-row p-4 bg-[#1a002f] border-t border-gray-800 items-center">
            <TouchableOpacity className="p-3 bg-gray-700 rounded-lg mr-2" onPress={pickImage}>
              <Ionicons name="image" size={20} color="white" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              className="flex-1 p-3 bg-gray-800 text-white rounded-lg border border-gray-600"
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              onFocus={() => {
                setTimeout(() => {
                  scrollToBottom();
                }, 300);
              }}
            />
            <TouchableOpacity
              className="p-3 bg-[#c6265e] rounded-lg ml-2"
              onPress={handleSendMessage}
              disabled={!newMessage.trim() && !selectedFile}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

export default ChatWindow;