import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const MAX_CHARS = 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function BugReportSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMessage("");
      setStatus("idle");
      setErrorMsg("");
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    Keyboard.dismiss();
    setStatus("loading");
    setErrorMsg("");

    const deviceInfo = {
      model: Device.modelName ?? "unknown",
      osVersion: Device.osVersion ?? "unknown",
      appVersion: Application.nativeApplicationVersion ?? "unknown",
      buildVersion: Application.nativeBuildVersion ?? "unknown",
      sdkVersion: Constants.expoConfig?.sdkVersion ?? "unknown",
      platform: Platform.OS,
    };

    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: trimmed, deviceInfo }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatus("success");
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  };

  const handleClose = () => {
    if (status === "loading") return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />
      <Pressable style={styles.backdropPress} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kvWrapper}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.heading, { color: colors.foreground }]}>Report a Bug</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              disabled={status === "loading"}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {status === "success" ? (
            <View style={styles.successContainer}>
              <View style={[styles.successIcon, { backgroundColor: colors.success + "20" }]}>
                <Feather name="check-circle" size={32} color={colors.success} />
              </View>
              <Text style={[styles.successText, { color: colors.foreground }]}>
                Thanks, your report was sent!
              </Text>
              <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                We'll look into it soon.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
                Describe what happened and we'll take a look.
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.surface3,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Describe what happened…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={MAX_CHARS}
                  value={message}
                  onChangeText={setMessage}
                  editable={status !== "loading"}
                  autoFocus={false}
                  textAlignVertical="top"
                />
                <Text
                  style={[
                    styles.charCount,
                    {
                      color:
                        message.length > MAX_CHARS * 0.9
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {message.length}/{MAX_CHARS}
                </Text>
              </View>

              {status === "error" && (
                <View style={[styles.errorBanner, { backgroundColor: "#FF4D4D20", borderColor: "#FF4D4D50" }]}>
                  <Feather name="alert-circle" size={14} color="#FF4D4D" />
                  <Text style={[styles.errorText, { color: "#FF4D4D" }]}>{errorMsg}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor:
                      message.trim().length === 0 || status === "loading"
                        ? colors.primary + "60"
                        : colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={handleSend}
                disabled={message.trim().length === 0 || status === "loading"}
              >
                {status === "loading" ? (
                  <Text style={[styles.sendText, { color: colors.primaryForeground }]}>
                    Sending…
                  </Text>
                ) : (
                  <>
                    <Feather name="send" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.sendText, { color: colors.primaryForeground }]}>
                      Send Report
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  kvWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    pointerEvents: "box-none",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 16,
  },
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    minHeight: 100,
    maxHeight: 180,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
