import React from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { DB_NAME, initDatabase } from '../src/database/db';

function LoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.loadingText}>Memuat AturWang...</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <React.Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider
          databaseName={DB_NAME}
          onInit={initDatabase}
          useSuspense
        >
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#0F172A',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: '#F8FAFC' },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modal-input"
              options={{
                presentation: 'modal',
                title: 'Catat Transaksi',
                headerShown: true,
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="about"
              options={{
                title: 'Tentang Aplikasi',
                headerShown: true,
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerShadowVisible: false,
              }}
            />
          </Stack>
        </SQLiteProvider>
      </React.Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
});

