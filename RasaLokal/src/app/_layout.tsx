import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="tracking" />
        <Stack.Screen name="driver" />
        <Stack.Screen name="driver-register" />
        <Stack.Screen name="location" />
        <Stack.Screen name="account-details" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="seller" />
      </Stack>
    </GestureHandlerRootView>
  );
}
