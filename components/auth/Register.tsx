import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Eye, EyeOff } from 'lucide-react-native';
import { API_BASE_URL } from '../../api';

// Define your navigation param list type
type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone_number: string;
}

const Register: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone_number: '',
  });
  const [error, setError] = useState<string>('');

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleChange = (name: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone_number: formData.phone_number,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');

      navigation.navigate('Login');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an Account</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={formData.name}
        onChangeText={(text) => handleChange('name', text)}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) => handleChange('email', text)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={formData.phone_number}
        onChangeText={(text) => handleChange('phone_number', text)}
        keyboardType="phone-pad"
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
          onPress={() => setShowPassword((prev) => !prev)}
          style={styles.eyeIcon}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={formData.confirmPassword}
        onChangeText={(text) => handleChange('confirmPassword', text)}
        secureTextEntry={!showPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <Text style={styles.loginText}>
        Already have an account?{' '}
        <Text
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          Login
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
  buttonText: { color: '#fff', fontWeight: 'bold' },
  loginText: { textAlign: 'center', color: '#ccc', marginTop: 16 },
  loginLink: { color: '#ff6b81', fontWeight: 'bold' },
});

export default Register;
