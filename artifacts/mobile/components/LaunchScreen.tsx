import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Props {
  onHide: () => void;
}

const HOLD_MS = 2000;
const FADE_MS = 700;

export function LaunchScreen({ onHide }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => onHide());
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <View style={styles.inner}>
        <MaterialCommunityIcons name="basketball" size={52} color="#FF6B00" style={styles.icon} />
        <Text style={styles.quote}>
          "And see if there be any wicked way in me, and lead me in the way everlasting."
        </Text>
        <Text style={styles.attribution}>Psalm 139:24</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  icon: {
    marginBottom: 8,
    opacity: 0.9,
  },
  quote: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "300",
    textAlign: "center",
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  attribution: {
    color: "#888888",
    fontSize: 13,
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
});
