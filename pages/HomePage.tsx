import React, { FC } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Hero from '../components/Hero';

// If you have a defined navigation stack type, replace "any" with it
type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

const HomePage: FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Hero />
      <View style={styles.ctaSection}>
        <Text style={styles.ctaText}>Connect with friends and share your moments!</Text>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a002f', alignItems: 'center', justifyContent: 'center' },
  ctaSection: { padding: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 24 },
  loginButton: { backgroundColor: '#c6265e', padding: 12, borderRadius: 8, marginBottom: 12, width: '80%' },
  loginButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  registerButton: { backgroundColor: '#fff', padding: 12, borderRadius: 8, width: '80%' },
  registerButtonText: { color: '#c6265e', fontWeight: 'bold', textAlign: 'center' },
});

export default HomePage;
