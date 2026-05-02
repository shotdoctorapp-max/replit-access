import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions, type Session } from "@/context/SessionContext";
import { scoreToGrade, gradeColor } from "@/utils/grading";

function SessionItem({ session, onPress, onDelete }: {
  session: Session;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const score = session.analysis.overallScore;
  const scoreColor = gradeColor(score, colors);
  const grade = scoreToGrade(score);

  const weakest = Object.entries(session.analysis.components).sort(
    ([, a], [, b]) => a.score - b.score
  )[0];
  const weakestLabel = weakest
    ? weakest[0].replace(/([A-Z])/g, " $1").toLowerCase()
    : "";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
    >
      <Image source={{ uri: session.imageUri }} style={styles.image} />
      <View style={styles.info}>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {new Date(session.timestamp).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: scoreColor }]}>{grade}</Text>
        </View>
        {weakestLabel ? (
          <View style={[styles.tag, { backgroundColor: colors.destructive + "20" }]}>
            <Text style={[styles.tagText, { color: colors.destructive }]}>
              Focus: {weakestLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        <Pressable
          onPress={onDelete}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, deleteSession, loading } = useSessions();

  const handleDelete = (id: string) => {
    Alert.alert("Delete Session", "Remove this analysis from your history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteSession(id);
        },
      },
    ]);
  };

  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((a, s) => a + s.analysis.overallScore, 0) / sessions.length)
      : 0;
  const avgGrade = scoreToGrade(avgScore);
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map(s => s.analysis.overallScore)) : 0;
  const bestGrade = scoreToGrade(bestScore);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionItem
            session={item}
            onPress={() =>
              router.push({ pathname: "/analysis/[id]", params: { id: item.id } })
            }
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
          },
        ]}
        scrollEnabled={!!sessions.length}
        ListHeaderComponent={
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>History</Text>
            {sessions.length > 0 && (
              <View style={[styles.summary, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: colors.primary }]}>{sessions.length}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Sessions</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: gradeColor(avgScore, colors) }]}>
                    {avgGrade}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Avg Grade</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: gradeColor(bestScore, colors) }]}>
                    {bestGrade}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Best</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="history" size={52} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Sessions Yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Analyze your shooting form to start building your history
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 20 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  summary: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    justifyContent: "space-around",
    alignItems: "center",
  },
  summaryItem: { alignItems: "center" },
  summaryNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  divider: { width: 1, height: 32 },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    gap: 12,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 10,
    resizeMode: "cover",
  },
  info: { flex: 1 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 1 },
  score: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scoreSuffix: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tag: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  actions: { alignItems: "center", gap: 12 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
