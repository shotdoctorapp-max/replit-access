import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import { CourtBackground } from "@/components/CourtBackground";
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

type ResetStep = "email" | "code";

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const [forgotMode, setForgotMode] = React.useState(false);
  const [resetStep, setResetStep] = React.useState<ResetStep>("email");
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [resetError, setResetError] = React.useState("");
  const [resetSuccess, setResetSuccess] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);

  const isLoading = fetchStatus === "fetching";

  const handleSignIn = async () => {
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (!url.startsWith("http")) router.replace("/(tabs)" as any);
        },
      });
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (!url.startsWith("http")) router.replace("/(tabs)" as any);
        },
      });
    }
  };

  const handleForgotSend = async () => {
    setResetError("");
    setResetLoading(true);
    try {
      const { error: createError } = await signIn.create({ identifier: resetEmail });
      if (createError) {
        setResetError(createError.message ?? "Couldn't find an account with that email.");
        return;
      }
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setResetError(sendError.message ?? "Couldn't send reset email. Try again.");
        return;
      }
      setResetStep("code");
    } catch (e: any) {
      setResetError("Couldn't find an account with that email.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotReset = async () => {
    setResetError("");
    setResetLoading(true);
    try {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code: resetCode });
      if (verifyError) {
        setResetError(verifyError.message ?? "Invalid code. Please try again.");
        return;
      }
      const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (submitError) {
        setResetError(submitError.message ?? "Couldn't set new password. Try a stronger one.");
        return;
      }
      if (signIn.status === "complete") {
        setResetSuccess(true);
        await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl("/");
            if (!url.startsWith("http")) router.replace("/(tabs)" as any);
          },
        });
      }
    } catch (e: any) {
      setResetError(e?.errors?.[0]?.message ?? "Invalid code or password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const exitForgot = () => {
    setForgotMode(false);
    setResetStep("email");
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setResetError("");
    setResetSuccess(false);
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>Enter the code sent to your email</Text>
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
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
        </Pressable>
        <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Resend code</Text>
        </Pressable>
        <Pressable onPress={() => signIn.reset()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Start over</Text>
        </Pressable>
      </View>
    );
  }

  if (forgotMode) {
    const busy = resetLoading;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <CourtBackground />
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoRow}>
            <MaterialCommunityIcons name="basketball" size={36} color={GREEN} />
          </View>
          <Text style={styles.title}>Reset password</Text>

          {resetSuccess ? (
            <View style={styles.successBox}>
              <MaterialCommunityIcons name="check-circle" size={40} color={GREEN} />
              <Text style={styles.successText}>Password updated! Signing you in…</Text>
            </View>
          ) : resetStep === "email" ? (
            <>
              <Text style={styles.subtitle}>Enter your email and we'll send a reset code.</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={resetEmail}
                placeholder="your@email.com"
                placeholderTextColor={MUTED}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
              <Pressable
                style={[styles.btn, (!resetEmail || busy) && styles.btnDisabled]}
                onPress={handleForgotSend}
                disabled={!resetEmail || busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Code</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Enter the code sent to {resetEmail} and choose a new password.
              </Text>
              <Text style={styles.label}>6-digit code</Text>
              <TextInput
                style={styles.input}
                value={resetCode}
                placeholder="123456"
                placeholderTextColor={MUTED}
                onChangeText={setResetCode}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                placeholder="••••••••"
                placeholderTextColor={MUTED}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
              />
              {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
              <Pressable
                style={[styles.btn, (!resetCode || !newPassword || busy) && styles.btnDisabled]}
                onPress={handleForgotReset}
                disabled={!resetCode || !newPassword || busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Set New Password</Text>}
              </Pressable>
              <Pressable
                onPress={() => { setResetStep("email"); setResetError(""); }}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
            </>
          )}

          {!resetSuccess && (
            <Pressable onPress={exitForgot} style={styles.linkBtn}>
              <Text style={[styles.linkText, { color: MUTED }]}>Back to Sign In</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <CourtBackground />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="basketball" size={36} color={GREEN} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to Shot Doctor</Text>

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
        {errors?.fields?.identifier && (
          <Text style={styles.error}>{errors.fields.identifier.message}</Text>
        )}

        <View style={styles.passwordRow}>
          <Text style={styles.label}>Password</Text>
          <Pressable onPress={() => { setResetEmail(email); setForgotMode(true); }}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="••••••••"
          placeholderTextColor={MUTED}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />
        {errors?.fields?.password && (
          <Text style={styles.error}>{errors.fields.password.message}</Text>
        )}

        <Pressable
          style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={!email || !password || isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={[styles.footerText, { color: GREEN }]}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28, flexGrow: 1 },
  logoRow: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: MUTED, marginBottom: 36 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#aaa", marginBottom: 6, letterSpacing: 0.5 },
  passwordRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  forgotLink: { fontSize: 12, fontFamily: "Inter_500Medium", color: GREEN },
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
  successBox: { alignItems: "center", gap: 16, paddingVertical: 40 },
  successText: { fontSize: 16, fontFamily: "Inter_500Medium", color: "#fff", textAlign: "center" },
});
