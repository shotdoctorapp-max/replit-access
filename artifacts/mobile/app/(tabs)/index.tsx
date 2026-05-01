import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/context/SessionContext";
import type { AnalysisResult, Session } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, addSession } = useSessions();
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const recentSessions = sessions.slice(0, 3);
  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.analysis.overallScore, 0) / sessions.length)
      : 0;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library to analyze shots.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      await analyzeImage(asset.uri, asset.base64 ?? "");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access to analyze your shooting form.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      await analyzeImage(asset.uri, asset.base64 ?? "");
    }
  };

  const analyzeImage = async (uri: string, base64: string) => {
    if (!base64) {
      Alert.alert("Error", "Could not read image data.");
      return;
    }

    setAnalyzing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Analysis failed");
      }

      const data = (await response.json()) as { analysis: AnalysisResult; timestamp: string };
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const session: Session = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: data.timestamp,
        imageUri: uri,
        analysis: data.analysis,
      };

      await addSession(session);
      setSelectedImage(null);
      router.push({ pathname: "/analysis/[id]", params: { id: session.id } });
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Analysis Failed", message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>HOOPFORM</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Shooting Analyst</Text>
        </View>
        <MaterialCommunityIcons name="basketball" size={32} color={colors.primary} />
      </View>

      {sessions.length > 0 && (
        <View style={[styles.statsCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <ScoreRing score={avgScore} size={70} strokeWidth={6} fontSize={20} label="Avg Score" />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{sessions.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: sessions.length >= 2 && sessions[0].analysis.overallScore > sessions[1].analysis.overallScore ? colors.success : colors.warning }]}>
              {sessions.length >= 2
                ? (sessions[0].analysis.overallScore - sessions[1].analysis.overallScore > 0 ? "+" : "") +
                  (sessions[0].analysis.overallScore - sessions[1].analysis.overallScore)
                : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Trend</Text>
          </View>
        </View>
      )}

      <View style={styles.actionsSection}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ANALYZE SHOT</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={takePhoto}
          disabled={analyzing}
        >
          <Feather name="camera" size={22} color="#fff" />
          <Text style={styles.primaryActionText}>Take Photo</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={pickImage}
          disabled={analyzing}
        >
          <Feather name="image" size={20} color={colors.foreground} />
          <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
            Upload from Library
          </Text>
        </Pressable>
      </View>

      {analyzing && (
        <View style={[styles.analyzingCard, { backgroundColor: colors.surface1, borderColor: colors.primary + "40" }]}>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          )}
          <View style={styles.analyzingText}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.analyzingLabel, { color: colors.foreground }]}>
              Analyzing biomechanics...
            </Text>
            <Text style={[styles.analyzingSubLabel, { color: colors.mutedForeground }]}>
              AI is evaluating your shooting form
            </Text>
          </View>
        </View>
      )}

      {recentSessions.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT SESSIONS</Text>
            <Pressable onPress={() => router.push("/history")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </Pressable>
          </View>
          {recentSessions.map((session) => {
            const score = session.analysis.overallScore;
            const scoreColor =
              score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.destructive;
            return (
              <Pressable
                key={session.id}
                style={({ pressed }) => [
                  styles.sessionCard,
                  {
                    backgroundColor: colors.surface1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => router.push({ pathname: "/analysis/[id]", params: { id: session.id } })}
              >
                <Image source={{ uri: session.imageUri }} style={styles.sessionImage} />
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>
                    {new Date(session.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={[styles.sessionScore, { color: scoreColor }]}>
                    {score}/100
                  </Text>
                  <Text style={[styles.sessionSummary, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {session.analysis.summary}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      )}

      {sessions.length === 0 && !analyzing && (
        <View style={[styles.emptyState, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="basketball-hoop" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Start Analyzing
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Take a photo or upload an image of your shooting form to get AI-powered biomechanical feedback
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#2a2a45",
  },
  statNumber: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  actionsSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  analyzingCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  previewImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  analyzingText: {
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  analyzingLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  analyzingSubLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  recentSection: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  sessionImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    resizeMode: "cover",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  sessionScore: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  sessionSummary: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
