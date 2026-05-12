import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd2uxUHZsvlQpCCCt_ix76NkO-pbqNRoVIzWX2qUzmgG2_rrQ/viewform?usp=dialog";

export const FEEDBACK_SUPPRESSED_KEY = "@shotdoc:feedback_suppressed";

interface Props {
  visible: boolean;
  onClose: () => void;
  onNeverShow: () => void;
}

export function FeedbackSheet({ visible, onClose, onNeverShow }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
  }, [visible, slideAnim, backdropAnim]);

  const handleGiveFeedback = () => {
    Linking.openURL(FEEDBACK_FORM_URL).catch(() => {});
    onClose();
  };

  const handleNeverShow = () => {
    onNeverShow();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />
      <Pressable style={styles.backdropPress} onPress={onClose} />

      <View style={styles.kvWrapper} pointerEvents="box-none">
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
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.iconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <MaterialCommunityIcons
                name="star-circle-outline"
                size={36}
                color={colors.primary}
              />
            </View>
          </View>

          <Text style={[styles.heading, { color: colors.foreground }]}>
            Enjoying Shot Doctor?
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We're in beta and your feedback shapes the app. Takes 60 seconds.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGiveFeedback}
          >
            <Feather name="message-square" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Give Feedback
            </Text>
            <Feather name="external-link" size={14} color={colors.primaryForeground} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.neverShowBtn, { opacity: pressed ? 0.5 : 1 }]}
            onPress={handleNeverShow}
          >
            <Text style={[styles.neverShowText, { color: colors.mutedForeground }]}>
              Never show again
            </Text>
          </Pressable>
        </Animated.View>
      </View>
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
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  closeBtn: {
    padding: 4,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  neverShowBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: Platform.OS === "ios" ? 4 : 0,
  },
  neverShowText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
});
