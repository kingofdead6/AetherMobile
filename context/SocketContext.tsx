
import React, { createContext, useContext, useEffect, useState, useCallback, useRef, PropsWithChildren } from 'react';
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api';

interface SocketContextType {
  socket: Socket | null;
  connectionError: string | null;
  reconnect: () => void;
  updateActiveChatId: (chatId: string) => Promise<void>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connectionError: null,
  reconnect: () => {},
  updateActiveChatId: async () => {},
});

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isInitializing = useRef(false);
  const eventQueue = useRef<{ event: string; data: any }[]>([]);

  const processEventQueue = useCallback(() => {
    if (!socketRef.current?.connected) {
      return;
    }
    while (eventQueue.current.length > 0) {
      const { event, data } = eventQueue.current.shift()!;
      socketRef.current.emit(event, data);
    }
  }, []);

  const queueEvent = useCallback((event: string, data: any) => {
    eventQueue.current.push({ event, data });
    processEventQueue();
  }, [processEventQueue]);

  const initSocket = useCallback(async () => {
    if (isInitializing.current) {
      return;
    }
    isInitializing.current = true;

    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      const storedChatId = await AsyncStorage.getItem('activeChatId');

      if (!token) {
        setConnectionError('No authentication token available. Please log in.');
        isInitializing.current = false;
        return;
      }


      const newSocket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        setConnectionError(null);
        setSocket(newSocket);

        if (userId) {
          newSocket.emit('register', userId);
          if (storedChatId || activeChatId) {
            const chatId = storedChatId || activeChatId;
            queueEvent('join_chat', chatId);
          }
          processEventQueue();
        }
      });

      newSocket.on('connect_error', (err: Error) => {
        console.error('Socket connection error:', err.message);
        setConnectionError(`Connection failed: ${err.message}. Retrying...`);
      });

      newSocket.on('error', (err: { message: string }) => {
        console.error('Socket error:', err.message);
        setConnectionError(err.message || 'Socket error occurred');
      });

      newSocket.on('disconnect', (reason: string) => {
        setConnectionError(`Disconnected: ${reason}. Reconnecting...`);
      });

      isInitializing.current = false;
    } catch (err: any) {
      console.error('Socket initialization failed:', err.message);
      setConnectionError('Failed to initialize socket: ' + err.message);
      isInitializing.current = false;
    }
  }, [activeChatId, queueEvent, processEventQueue]);

  const reconnect = useCallback(() => {
    if (socketRef.current) {

      socketRef.current.disconnect();
      socketRef.current.connect();
    } else {
      initSocket();
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      await initSocket();
    }
    initialize();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      } else {
      }
    };
  }, [initSocket]);

  const updateActiveChatId = useCallback(async (chatId: string) => {
    try {
      setActiveChatId(chatId);
      await AsyncStorage.setItem('activeChatId', chatId);
      if (socketRef.current?.connected) {
        queueEvent('join_chat', chatId);
      } else {
        console.warn('Socket not connected, queuing join_chat event');
        queueEvent('join_chat', chatId);
      }
    } catch (err: any) {
      setConnectionError('Failed to update active chat: ' + err.message);
    }
  }, [queueEvent]);

  useEffect(() => {
    if (!socket || !activeChatId || socket.connected) return;

    const retryInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        queueEvent('join_chat', activeChatId);
        clearInterval(retryInterval);
      }
    }, 1000);

    return () => clearInterval(retryInterval);
  }, [socket, activeChatId, queueEvent]);

  const contextValue = {
    socket,
    connectionError,
    reconnect,
    updateActiveChatId,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext };