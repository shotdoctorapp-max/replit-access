import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  ClerkProvider as NativeClerkProvider,
  ClerkLoaded as NativeClerkLoaded,
} from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import {
  ClerkLoaded as WebClerkLoaded,
  ClerkProvider as WebClerkProvider,
} from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { LaunchScreen } from "@/components/LaunchScreen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionProvider } from "@/context/SessionContext";
import { ShotsProvider } from "@/context/ShotsContext";
import { setBaseUrl } from "@workspace/api-client-react";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function ConfigErrorScreen() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: "600",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Something went wrong
      </Text>
      <Text style={{ color: "#999999", fontSize: 14, textAlign: "center" }}>
        The app is missing required configuration. Please update to the latest
        version or contact support.
      </Text>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ animation: "none" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      <Stack.Screen name="analysis/[id]" />
    </Stack>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") {
    return (
      <WebClerkProvider
        publishableKey={publishableKey!}
        proxyUrl={proxyUrl}
      >
        <WebClerkLoaded>{children}</WebClerkLoaded>
      </WebClerkProvider>
    );
  }

  return (
    <NativeClerkProvider
      publishableKey={publishableKey!}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <NativeClerkLoaded>{children}</NativeClerkLoaded>
    </NativeClerkProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [showLaunch, setShowLaunch] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!publishableKey) {
    return <ConfigErrorScreen />;
  }

  return (
    <>
      <AuthProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <ShotsProvider>
                  <GestureHandlerRootView>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </ShotsProvider>
              </SessionProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </AuthProvider>
      {showLaunch && <LaunchScreen onHide={() => setShowLaunch(false)} />}
    </>
  );
}
