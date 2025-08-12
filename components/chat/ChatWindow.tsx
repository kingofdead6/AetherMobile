// src/components/chat/ChatWindow.tsx
import React, { useState, useContext, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { SocketContext } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext"; // Adjust path if needed
import { API_BASE_URL } from "../../api";

type Message = {
  _id: string;
  content: string;
  timestamp: string;
};

type ChatWindowProps = {
  route: {
    params: {
      roomId: string;
    };
  };
};

const ChatWindow: React.FC<ChatWindowProps> = ({ route }) => {
  const { socket } = useContext(SocketContext);
  const { state: { userToken } } = useAuth();
  const { roomId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchMessages = async () => {
      if (!userToken) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/chats/${roomId}/messages`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };
    fetchMessages();
  }, [roomId, userToken]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("joinRoom", roomId);
    socket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      socket.off("message");
    };
  }, [socket, roomId]);

  const sendMessage = () => {
    if (message.trim() && socket) {
      socket.emit("sendMessage", { roomId, content: message });
      setMessage("");
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View className="p-2 bg-white rounded-lg mb-2">
      <Text className="text-gray-800">{item.content}</Text>
      <Text className="text-gray-500 text-xs">
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 p-4 bg-[#1a002f]">
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        inverted
      />
      <View className="flex-row pt-2">
        <TextInput
          className="flex-1 p-2 bg-white rounded-lg"
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          className="p-2 bg-[#c6265e] rounded-lg ml-2"
          onPress={sendMessage}
        >
          <Text className="text-white font-bold">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatWindow;