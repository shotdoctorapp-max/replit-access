import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const DONT_SHOW_KEY = "filming_tips_dont_show";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

function AngleIcon({ color }: { color: string }) {
  return (
    <View style={diagramStyles.container}>
      <View style={[diagramStyles.court, { borderColor: color + "40" }]}>
        <View style={[diagramStyles.hoop, { borderColor: color }]} />
        <View style={[diagramStyles.playerBody, { backgroundColor: color + "cc" }]} />
        <View style={[diagramStyles.playerHead, { backgroundColor: color + "cc" }]} />
        <View style={[diagramStyles.sideArrow, { borderTopColor: color }]} />
        <Text style={[diagramStyles.sideLabel, { color: color }]}>SIDE</Text>
      </View>
    </View>
  );
}

function DistanceIcon({ color }: { color: string }) {
  return (
    <View style={diagramStyles.container}>
      <View style={[diagramStyles.court, { borderColor: color + "40" }]}>
        <View style={[diagramStyles.fullHead, { backgroundColor: color + "cc" }]} />
        <View style={[diagramStyles.fullTorso, { backgroundColor: color + "cc" }]} />
        <View style={[diagramStyles.fullLegs, { backgroundColor: color + "cc" }]} />
        <View style={[diagramStyles.bracketTop, { borderColor: color }]} />
        <View style={[diagramStyles.bracketBottom, { borderColor: color }]} />
      </View>
    </View>
  );
}

export function FilmingTipsSheet({ visible, onConfirm, onDismiss }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [dontShow, setDontShow] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDontShow(false);
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
          toValue: 400,
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

  const handleConfirm = async () => {
    if (dontShow) {
      await AsyncStorage.setItem(DONT_SHOW_KEY, "true");
    }
    onConfirm();
  };

  const accentColor = colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />
      <Pressable style={styles.backdropPress} onPress={onDismiss} />

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

        <Text style={[styles.heading, { color: colors.foreground }]}>
          Quick Filming Tips
        </Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Two things that make a big difference in your analysis
        </Text>

        <View style={styles.tipsRow}>
          <View
            style={[
              styles.tipCard,
              { backgroundColor: colors.surface3, borderColor: colors.border },
            ]}
          >
            <AngleIcon color={accentColor} />
            <Text style={[styles.tipTitle, { color: colors.foreground }]}>
              Side / Profile View
            </Text>
            <Text style={[styles.tipBody, { color: colors.mutedForeground }]}>
              Film from the side so the AI can see your full shooting motion
            </Text>
          </View>

          <View
            style={[
              styles.tipCard,
              { backgroundColor: colors.surface3, borderColor: colors.border },
            ]}
          >
            <DistanceIcon color={accentColor} />
            <Text style={[styles.tipTitle, { color: colors.foreground }]}>
              Full Body in Frame
            </Text>
            <Text style={[styles.tipBody, { color: colors.mutedForeground }]}>
              Step back so your feet and hands are visible throughout the shot
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: accentColor,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleConfirm}
        >
          <Feather name="video" size={18} color="#000" />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            Got it — Start Recording
          </Text>
        </Pressable>

        <Pressable
          style={styles.dontShowRow}
          onPress={() => setDontShow((v) => !v)}
          hitSlop={8}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: dontShow ? accentColor : colors.border,
                backgroundColor: dontShow ? accentColor : "transparent",
              },
            ]}
          >
            {dontShow && <Feather name="check" size={11} color="#000" />}
          </View>
          <Text style={[styles.dontShowText, { color: colors.mutedForeground }]}>
            Don't show again
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

export async function shouldShowFilmingTips(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(DONT_SHOW_KEY);
    return val !== "true";
  } catch {
    return true;
  }
}

const diagramStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  court: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  hoop: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 14,
    height: 8,
    borderRadius: 2,
    borderWidth: 2,
  },
  playerBody: {
    position: "absolute",
    bottom: 14,
    left: "50%",
    marginLeft: -5,
    width: 10,
    height: 22,
    borderRadius: 3,
  },
  playerHead: {
    position: "absolute",
    bottom: 38,
    left: "50%",
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sideArrow: {
    position: "absolute",
    bottom: 6,
    right: 8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  sideLabel: {
    position: "absolute",
    bottom: 4,
    right: 4,
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  fullHead: {
    position: "absolute",
    top: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fullTorso: {
    position: "absolute",
    top: 20,
    width: 14,
    height: 20,
    borderRadius: 3,
  },
  fullLegs: {
    position: "absolute",
    top: 42,
    width: 10,
    height: 18,
    borderRadius: 3,
  },
  bracketTop: {
    position: "absolute",
    top: 4,
    left: 8,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  bracketBottom: {
    position: "absolute",
    bottom: 4,
    left: 8,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  tipsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  tipCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  tipTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  dontShowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dontShowText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
