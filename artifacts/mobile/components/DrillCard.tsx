import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { DrillRecommendation } from "@/context/SessionContext";

const AREA_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  stance: "shoe-print",
  hipAlignment: "human-handsup",
  elbowPosition: "arm-flex",
  gripPosition: "hand-back-left",
  setPoint: "basketball",
  followThrough: "arrow-up-circle",
  balance: "scale-balance",
  eyeTracking: "eye",
};

interface DrillCardProps {
  drill: DrillRecommendation;
  index: number;
}

export function DrillCard({ drill, index }: DrillCardProps) {
  const colors = useColors();
  const iconName = AREA_ICONS[drill.targetArea] ?? "basketball";

  return (
    <View style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + "20" }]}>
        <MaterialCommunityIcons name={iconName} size={22} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.number, { color: colors.mutedForeground }]}>
            DRILL {String(index + 1).padStart(2, "0")}
          </Text>
          <View style={[styles.tag, { backgroundColor: colors.surface3 }]}>
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>
              {drill.targetArea.replace(/([A-Z])/g, " $1").toLowerCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{drill.name}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {drill.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  number: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
