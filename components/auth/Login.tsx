// Login.tsx (updated to use signIn from AuthContext)
import React, { FC, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Eye, EyeOff } from 'lucide-react-native';
import { API_BASE_URL } from "../../api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from '../../context/AuthContext'; // Import useAuth

// Navigation type
type RootStackParamList = {
  Dashboard: undefined;
  Register: undefined;
};

interface FormData {
  email: string;
  password: string;
}

const Login: FC = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { signIn } = useAuth(); // Use signIn from context

  const handleChange = (name: keyof FormData, value: string) =>
    setFormData({ ...formData, [name]: value });

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');

      await AsyncStorage.setItem('userId', data.user._id);
      signIn(data.token); // Call signIn with token (handles storage and state update)

      // No need to navigate manually; AppNavigator will handle based on state
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back 👋</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) => handleChange('email', text)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={formData.password}
          onChangeText={(text) => handleChange('password', text)}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? 'Logging in...' : 'Log In'}</Text>
      </TouchableOpacity>

      <Text style={styles.signupText}>
        Don’t have an account?{' '}
        <Text
          style={styles.signupLink}
          onPress={() => navigation.navigate('Register')}
        >
          Register
        </Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#1a002f' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#fff', marginBottom: 24 },
  error: { color: '#ff4444', textAlign: 'center', marginBottom: 16 },
  input: { width: '100%', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 16, color: '#333' },
  passwordContainer: { position: 'relative', marginBottom: 16 },
  eyeIcon: { position: 'absolute', right: 12, top: 12 },
  button: { backgroundColor: '#c6265e', padding: 12, borderRadius: 8, alignItems: 'center' },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  signupText: { textAlign: 'center', color: '#ccc', marginTop: 16 },
  signupLink: { color: '#ff6b81', fontWeight: 'bold' },
});

export default Login;