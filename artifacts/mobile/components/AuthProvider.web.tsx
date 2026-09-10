import {
  ClerkLoaded,
  ClerkProvider,
} from "@clerk/react";
import React from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={publishableKey} proxyUrl={proxyUrl}>
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}