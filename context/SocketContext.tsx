// SocketContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from "react";
import io, { Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../api";

// Context type
interface SocketContextType {
  socket: Socket | null;
  connectionError: string | null;
}

// Create the context with default values
const SocketContext = createContext<SocketContextType>({
  socket: null,
  connectionError: null,
});

// Hook to consume socket context
export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

// Provider component
export const SocketProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let newSocket: Socket | null = null;

    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");

        if (!token) {
          setConnectionError("No authentication token available. Please log in.");
          console.log("No token found in AsyncStorage");
          return; // Don't init socket without token
        }

        console.log("Initializing socket with token:", token); // For debugging

        newSocket = io(API_BASE_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        newSocket.on("connect", () => {
          console.log("Socket connected:", newSocket?.id);
          if (userId) {
            newSocket?.emit("register", userId);
            console.log(`User ${userId} registered`);
          }
          setConnectionError(null);
          setSocket(newSocket);
        });

        newSocket.on("connect_error", (err: Error) => {
          console.error("Socket connection error:", err.message);
          setConnectionError(err.message || "Connection failed");
        });

        newSocket.on("error", (err: Error) => {
          console.error("Socket error:", err.message);
          setConnectionError(err.message || "Socket error occurred");
        });
      } catch (err) {
        console.error("Socket initialization failed:", err);
        setConnectionError("Failed to initialize socket");
      }
    };

    initSocket();

    return () => {
      if (newSocket) {
        console.log("Disconnecting socket:", newSocket.id);
        newSocket.disconnect();
      } else {
        console.log("No socket to disconnect");
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext };