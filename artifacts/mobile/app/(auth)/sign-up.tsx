import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GREEN = "#00C853";
const BG = "#000";
const SURFACE = "#111";
const BORDER = "#222";
const MUTED = "#666";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const isLoading = fetchStatus === "fetching";
  const needsVerify =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  const handleSignUp = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (!url.startsWith("http")) router.replace("/(tabs)" as any);
        },
      });
    }
  };

  if (needsVerify) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="basketball" size={36} color={GREEN} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a code to {email}</Text>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="6-digit code"
          placeholderTextColor={MUTED}
          onChangeText={setCode}
          keyboardType="numeric"
          autoFocus
        />
        {errors?.fields?.code && (
          <Text style={styles.error}>{errors.fields.code.message}</Text>
        )}
        <Pressable style={[styles.btn, isLoading && styles.btnDisabled]} onPress={handleVerify} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Email</Text>}
        </Pressable>
        <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Resend code</Text>
        </Pressable>
        <View nativeID="clerk-captcha" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="basketball" size={36} color={GREEN} />
        </View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Get 3 free shots to start</Text>

        <View style={styles.trialBadge}>
          <MaterialCommunityIcons name="gift-outline" size={16} color={GREEN} />
          <Text style={styles.trialText}>3 free analyses included — no card required</Text>
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          placeholder="your@email.com"
          placeholderTextColor={MUTED}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {errors?.fields?.emailAddress && (
          <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
        )}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="••••••••"
          placeholderTextColor={MUTED}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        {errors?.fields?.password && (
          <Text style={styles.error}>{errors.fields.password.message}</Text>
        )}

        <Pressable
          style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
          onPress={handleSignUp}
          disabled={!email || !password || isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={[styles.footerText, { color: GREEN }]}>Sign In</Text>
            </Pressable>
          </Link>
        </View>

        <View nativeID="clerk-captcha" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28, backgroundColor: BG, flexGrow: 1 },
  logoRow: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED, marginBottom: 20 },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GREEN + "15",
    borderWidth: 1,
    borderColor: GREEN + "40",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 28,
  },
  trialText: { fontSize: 13, fontFamily: "Inter_500Medium", color: GREEN, flex: 1 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#aaa", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    marginBottom: 16,
  },
  error: { fontSize: 12, color: "#FF5252", fontFamily: "Inter_400Regular", marginTop: -10, marginBottom: 10 },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkText: { color: GREEN, fontSize: 14, fontFamily: "Inter_500Medium" },
});
