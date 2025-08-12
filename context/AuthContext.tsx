// auth/AuthContext.tsx (new file)
import React, { createContext, useContext, useEffect, useReducer, PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  isLoading: boolean;
  userToken: string | null;
}

interface AuthContextType {
  signIn: (token: string) => void;
  signOut: () => void;
  state: AuthState;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const authReducer = (prevState: AuthState, action: { type: string; token?: string }) => {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        ...prevState,
        userToken: action.token ?? null,
        isLoading: false,
      };
    case 'SIGN_IN':
      return {
        ...prevState,
        userToken: action.token ?? null,
      };
    case 'SIGN_OUT':
      return {
        ...prevState,
        userToken: null,
      };
    default:
      return prevState;
  }
};

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    userToken: null,
  });

  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken: string | null = null;
      try {
        userToken = await AsyncStorage.getItem('token');
      } catch (e) {
        console.error('Restoring token failed', e);
      }
      dispatch({ type: 'RESTORE_TOKEN', token: userToken ?? undefined });
    };
    bootstrapAsync();
  }, []);

  const signIn = async (token: string) => {
    try {
      await AsyncStorage.setItem('token', token);
      dispatch({ type: 'SIGN_IN', token });
    } catch (e) {
      console.error('Saving token failed', e);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userId');
      dispatch({ type: 'SIGN_OUT' });
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };

  return (
    <AuthContext.Provider value={{ signIn, signOut, state }}>
      {children}
    </AuthContext.Provider>
  );
};