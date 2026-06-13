import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSessions } from "@/context/SessionContext";
import { useShots } from "@/context/ShotsContext";
import type { AnalysisResult, Session } from "@/context/SessionContext";
import { ScoreRing } from "@/components/ScoreRing";
import { scoreToGrade, gradeColor } from "@/utils/grading";
import { extractFrames } from "@/utils/videoFrames";
import { FilmingTipsSheet, shouldShowFilmingTips } from "@/components/FilmingTipsSheet";
import { CourtBackground } from "@/components/CourtBackground";

const SHARE_URL = process.env.EXPO_PUBLIC_LANDING_URL ?? "https://shotdoc.app";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type AnalyzingStage =
  | "idle"
  | "icloud"
  | "preparing"
  | "extracting"
  | "selecting"
  | "analyzing";

const STAGE_LABELS: Record<AnalyzingStage, string> = {
  idle: "",
  icloud: "Downloading from iCloud…",
  preparing: "Preparing video…",
  extracting: "Extracting key frames…",
  selecting: "AI selecting best moment…",
  analyzing: "Analyzing biomechanics…",
};

const STAGE_ORDER: AnalyzingStage[] = ["extracting", "selecting", "analyzing"];

const STAGE_FLOORS: Record<AnalyzingStage, number> = {
  idle: 0,
  icloud: 0,
  preparing: 0,
  extracting: 0,
  selecting: 25,
  analyzing: 45,
};

const STAGE_CEILINGS: Record<AnalyzingStage, number> = {
  idle: 0,
  icloud: 12,
  preparing: 5,
  extracting: 25,
  selecting: 45,
  analyzing: 92,
};

function buildCreepSequence(
  anim: import("react-native").Animated.Value,
  from: number,
  ceiling: number,
  steps: number,
  stepDuration: number,
  decay: number
): import("react-native").Animated.CompositeAnimation {
  const anims: import("react-native").Animated.CompositeAnimation[] = [];
  for (let i = 1; i <= steps; i++) {
    const fraction = 1 - Math.pow(decay, i);
    anims.push(
      RNAnimated.timing(anim, {
        toValue: from + (ceiling - from) * fraction,
        duration: stepDuration,
        useNativeDriver: false,
      })
    );
  }
  return RNAnimated.sequence(anims);
}


export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, addSession } = useSessions();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const { shotsRemaining, totalFreeShots, isPro, consumeShot } = useShots();
  const [stage, setStage] = useState<AnalyzingStage>("idle");
  const [isCompleting, setIsCompleting] = useState(false);
  const [bestFrameInfo, setBestFrameInfo] = useState<{
    index: number;
    total: number;
  } | null>(null);
  const [showTipsSheet, setShowTipsSheet] = useState(false);

  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const cardOpacity = useRef(new RNAnimated.Value(0)).current;
  const [isCardVisible, setIsCardVisible] = useState(false);
  const activeAnimRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const stageRef = useRef<AnalyzingStage>("idle");
  const [progressPct, setProgressPct] = useState(0);

  React.useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setProgressPct(Math.round(value));
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  const isAnalyzing = stage !== "idle" || isCompleting;

  React.useEffect(() => {
    stageRef.current = stage;
    if (stage === "idle") return;

    activeAnimRef.current?.stop();
    const floor = STAGE_FLOORS[stage];
    const ceiling = STAGE_CEILINGS[stage];
    progressAnim.setValue(floor);

    const startCreep = (initial: boolean) => {
      if (stageRef.current !== stage) return;
      let anim: RNAnimated.CompositeAnimation;
      if (initial) {
        if (stage === "extracting") {
          anim = buildCreepSequence(progressAnim, floor, ceiling, 10, 120, 0.5);
        } else if (stage === "selecting") {
          anim = buildCreepSequence(progressAnim, floor, ceiling, 30, 1400, 0.82);
        } else {
          anim = buildCreepSequence(progressAnim, floor, ceiling, 35, 1600, 0.85);
        }
      } else {
        anim = RNAnimated.timing(progressAnim, {
          toValue: ceiling - 0.01,
          duration: 180000,
          useNativeDriver: false,
        });
      }
      activeAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (finished && stageRef.current === stage) {
          startCreep(false);
        }
      });
    };

    startCreep(true);
  }, [stage]);

  const recentSessions = sessions.slice(0, 3);
  const avgScore =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((acc, s) => acc + s.analysis.overallScore, 0) /
            sessions.length
        )
      : 0;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out Shot Doctor — AI that analyzes your basketball shooting form and tells you exactly how to fix it. 🏀\n${SHARE_URL}`,
        url: SHARE_URL,
      });
    } catch {
      // user cancelled or error — no-op
    }
  };

  const checkShotsOrPaywall = (): boolean => {
    if (isPro) return true;
    if (shotsRemaining <= 0) {
      router.push("/paywall");
      return false;
    }
    return true;
  };

  // Fast copy for already-downloaded ph:// assets. Returns null silently for
  // iCloud-only videos so the caller can pass the original URI to analyzeVideo,
  // which handles the download in-app with a progress stage.
  const resolveVideoUri = async (uri: string): Promise<string | null> => {
    if (!uri.startsWith("ph://")) return uri;
    try {
      const dest = new FileSystem.File(FileSystem.Paths.cache, `shot_${Date.now()}.mov`);
      const src = new FileSystem.File(uri);
      src.copy(dest);
      return dest.uri;
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("PHPhotosErrorDomain") || msg.includes("3164")) {
        // iCloud-only — return null so caller routes through analyzeVideo
        return null;
      }
      Alert.alert("Couldn't load video", "Please try again with a different video.");
      return null;
    }
  };

  const openCamera = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile Only",
        "Video analysis requires the Expo Go app on your iPhone or Android device."
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access to record your shot.");
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 10,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("PHPhotosErrorDomain") || msg.includes("3164")) {
        Alert.alert(
          "Video still downloading",
          "This video is being fetched from iCloud. Please try again in a moment.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Try Again", onPress: () => openCamera() },
          ]
        );
      } else {
        Alert.alert("Camera error", msg || "Something went wrong opening the camera.");
      }
      return;
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = await resolveVideoUri(asset.uri);
      // If fast copy returned null for an iCloud video, pass the raw ph:// URI
      // to analyzeVideo which will handle the in-app download with progress UI.
      const finalUri = uri ?? (asset.uri.startsWith("ph://") ? asset.uri : null);
      if (finalUri) await analyzeVideo(finalUri, asset.duration ?? undefined);
    }
  };

  const recordVideo = async () => {
    if (!checkShotsOrPaywall()) return;
    const show = await shouldShowFilmingTips();
    if (show) {
      setShowTipsSheet(true);
    } else {
      await openCamera();
    }
  };

  const pickVideo = async () => {
    if (!checkShotsOrPaywall()) return;
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile Only",
        "Video analysis requires the Expo Go app on your iPhone or Android device."
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // "limited" = iOS 14+ partial access — still allows the picker to open
    if (status !== "granted" && status !== "limited") {
      Alert.alert("Permission needed", "Please allow access to your video library.");
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      // MediaTypeOptions.Videos is more stable than the array syntax in Expo Go.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      });
    } catch (err) {
      console.error("launchImageLibraryAsync error:", err);
      Alert.alert("Couldn't open library", "Please try again or record directly.");
      return;
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    let uri = asset.uri;

    // PHPickerViewController returns a file:// temp path. Copy to a stable cache
    // path so iOS doesn't clean it up before frame extraction finishes.
    if (uri.startsWith("file://")) {
      try {
        const FileSystemLegacy = await import("expo-file-system/legacy");
        const dest = `${FileSystemLegacy.cacheDirectory}shot_pick_${Date.now()}.mov`;
        await FileSystemLegacy.copyAsync({ from: uri, to: dest });
        uri = dest;
      } catch {
        // Copy failed — proceed with original temp URI (usually still readable)
      }
    }

    // asset.duration from expo-image-picker is in milliseconds (same as openCamera)
    await analyzeVideo(uri, asset.duration ?? undefined);
  };

  const analyzeVideo = async (videoUri: string, durationMs?: number) => {
    const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
    const MAX_DURATION_SECONDS = 60;

    // Size check using the new FileSystem.File API (v19+). getInfoAsync only
    // exists in expo-file-system/legacy — calling it from the new API import
    // throws TypeError (undefined is not a function). ph:// URIs are handled
    // later in the ph:// download block, skip size check for them here.
    if (!videoUri.startsWith("ph://")) {
      try {
        const f = new FileSystem.File(videoUri);
        if (f.size > MAX_FILE_SIZE_BYTES) {
          Alert.alert(
            "Video too large",
            "Please use a video under 100 MB. Try trimming the clip or recording a shorter shot."
          );
          return;
        }
      } catch {
        // Size check failed (e.g. temp file not yet accessible) — proceed anyway.
        // Frame extraction will surface a real error if the file is truly unreadable.
      }
    }

    if (durationMs !== undefined && durationMs > MAX_DURATION_SECONDS * 1000) {
      Alert.alert(
        "Video too long",
        `Please use a video under ${MAX_DURATION_SECONDS} seconds. Trim the clip to just the shot you want analyzed.`
      );
      return;
    }

    setBestFrameInfo(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      cardOpacity.setValue(0);
      setIsCardVisible(true);
      RNAnimated.timing(cardOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      let resolvedUri = videoUri;
      if (videoUri.startsWith("ph://")) {
        // Try MediaLibrary first — it triggers an iCloud download transparently.
        setStage("icloud");
        let mlResolved = false;
        const assetId = videoUri.replace("ph://", "").split("/")[0];
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === "granted") {
            const info = await MediaLibrary.getAssetInfoAsync(assetId, {
              shouldDownloadFromNetwork: true,
            });
            if (info.localUri) {
              resolvedUri = info.localUri;
              mlResolved = true;
            }
          }
        } catch {
          // MediaLibrary path failed — fall through to legacy copy below
        }

        if (!mlResolved) {
          // Legacy copy (works for already-downloaded assets, fails cleanly for iCloud)
          setStage("preparing");
          try {
            const FileSystemEarly = await import("expo-file-system/legacy");
            const dest = `${FileSystemEarly.cacheDirectory}shot_${Date.now()}.mov`;
            await FileSystemEarly.copyAsync({ from: videoUri, to: dest });
            resolvedUri = dest;
          } catch (copyErr) {
            const copyMsg = copyErr instanceof Error ? copyErr.message : "";
            if (copyMsg.includes("PHPhotosErrorDomain") || copyMsg.includes("3164")) {
              throw new Error(
                "Couldn't download the video from iCloud. Make sure you have an internet connection and try again."
              );
            }
            throw copyErr;
          }
        }
      }

      setStage("extracting");
      const { base64Frames, thumbnailUris, timestamps } = await extractFrames(resolvedUri, durationMs);

      setStage("selecting");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/analyze-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ frames: base64Frames, timestamps, mimeType: "image/jpeg" }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((err as { error: string }).error ?? "Analysis failed");
      }

      setStage("analyzing");
      const data = (await response.json()) as {
        analysis: AnalysisResult;
        rhythm?: import("@/context/SessionContext").RhythmAnalysis;
        bestFrameIndex: number;
        totalFrames: number;
        timestamp: string;
        keyFrameIndices?: number[];
      };

      setBestFrameInfo({ index: data.bestFrameIndex, total: data.totalFrames });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const FileSystem = await import("expo-file-system/legacy");
      const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      // Save the best frame thumbnail as a stable file for the analysis screen
      let capturedFrameUri = resolvedUri;
      const bestThumbUri = thumbnailUris[data.bestFrameIndex] ?? thumbnailUris[0];
      if (bestThumbUri) {
        try {
          const destUri = `${FileSystem.cacheDirectory}shotdoc_frame_${sessionId}_best.jpg`;
          await FileSystem.copyAsync({ from: bestThumbUri, to: destUri });
          capturedFrameUri = destUri;
        } catch {
          // fall back to videoUri
        }
      }

      // Select key frames — use server-returned indices when available so annotation
      // coordinates always refer to the exact same frames that are displayed in the strip.
      const totalFrames = data.totalFrames ?? thumbnailUris.length;
      const serverIndices = data.keyFrameIndices;
      const [dipIdx, setPointIdx, releaseIdx] = serverIndices && serverIndices.length >= 3
        ? serverIndices
        : (() => {
            // Fallback: compute locally from rhythm (older server responses)
            const rhythm = data.rhythm;
            let d = Math.floor(totalFrames * 0.20);
            let sp = Math.floor(totalFrames * 0.55);
            let r = Math.floor(totalFrames * 0.78);
            if (rhythm?.dipFrame !== undefined && rhythm.dipFrame >= 0 && rhythm.dipFrame < totalFrames * 0.45) d = rhythm.dipFrame;
            if (rhythm?.setPointFrame !== undefined && rhythm.setPointFrame > d && rhythm.setPointFrame < totalFrames * 0.75) sp = rhythm.setPointFrame;
            else if (rhythm?.armExtendFrame !== undefined && rhythm.armExtendFrame > d + 1) sp = rhythm.armExtendFrame - 1;
            if (rhythm?.armExtendFrame !== undefined && rhythm.armExtendFrame > sp && rhythm.armExtendFrame < totalFrames * 0.95) r = rhythm.armExtendFrame;
            if (sp <= d) sp = Math.min(d + 1, totalFrames - 1);
            if (r <= sp) r = Math.min(sp + 1, totalFrames - 1);
            return [d, sp, r];
          })();

      const candidateFrames: { index: number; label: string }[] = [
        { index: dipIdx,      label: "Dip"       },
        { index: setPointIdx, label: "Set Point"  },
        { index: releaseIdx,  label: "Release"    },
      ];

      // Remove entries whose thumbnail is missing or whose index duplicates an earlier entry
      const seen = new Set<number>();
      const keyFrameEntries = candidateFrames
        .filter((f) => thumbnailUris[f.index] !== undefined && !seen.has(f.index) && seen.add(f.index))
        .slice(0, 3);

      // Copy key frame thumbnails to stable cache paths
      const keyFrameUris: string[] = [];
      const keyFrameLabels: string[] = [];
      for (let i = 0; i < keyFrameEntries.length; i++) {
        const { index, label } = keyFrameEntries[i];
        const src = thumbnailUris[index];
        if (!src) continue;
        try {
          const dest = `${FileSystem.cacheDirectory}shotdoc_frame_${sessionId}_kf${i}.jpg`;
          await FileSystem.copyAsync({ from: src, to: dest });
          keyFrameUris.push(dest);
          keyFrameLabels.push(label);
        } catch {
          // skip this frame if copy fails
        }
      }

      // Copy original video to stable cache path (best-effort)
      let cachedVideoUri: string | undefined;
      try {
        const videoDestUri = `${FileSystem.cacheDirectory}shotdoc_video_${sessionId}.mp4`;
        await FileSystem.copyAsync({ from: resolvedUri, to: videoDestUri });
        cachedVideoUri = videoDestUri;
      } catch {
        // non-fatal — video playback simply won't appear for this session
      }

      const session: Session = {
        id: sessionId,
        timestamp: data.timestamp,
        imageUri: capturedFrameUri,
        analysis: data.analysis,
        rhythm: data.rhythm,
        isVideo: true,
        bestFrameIndex: data.bestFrameIndex,
        totalFrames: data.totalFrames,
        keyFrameUris: keyFrameUris.length > 0 ? keyFrameUris : undefined,
        keyFrameLabels: keyFrameLabels.length > 0 ? keyFrameLabels : undefined,
        videoUri: cachedVideoUri,
      };

      await consumeShot();
      await addSession(session);

      setIsCompleting(true);
      setStage("idle");
      activeAnimRef.current?.stop();
      RNAnimated.timing(progressAnim, {
        toValue: 100,
        duration: 450,
        useNativeDriver: false,
      }).start(() => {
        RNAnimated.timing(cardOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsCompleting(false);
          setIsCardVisible(false);
          progressAnim.setValue(0);
          router.push({ pathname: "/analysis/[id]", params: { id: session.id } });
        });
      });
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Something went wrong";
      const isICloudError = message.includes("iCloud") || message.includes("PHPhotosErrorDomain") || message.includes("3164");
      Alert.alert(isICloudError ? "Video unavailable" : "Video Analysis Failed", message);
      activeAnimRef.current?.stop();
      RNAnimated.timing(cardOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsCardVisible(false);
        progressAnim.setValue(0);
        setIsCompleting(false);
        setStage("idle");
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <CourtBackground />
    <ScrollView
      style={styles.transparentFill}
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>YOUR AI COACH</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Shot Doctor <Text style={{ fontSize: 12, color: colors.mutedForeground }}>v2.1</Text></Text>
        </View>
        <Pressable
          onPress={() => signOut()}
          style={[styles.userChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.userChipText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "Account"}
          </Text>
        </Pressable>
      </View>

      {!isPro && (
        <Pressable
          style={[styles.shotsBar, { backgroundColor: colors.surface1, borderColor: colors.border }]}
          onPress={() => router.push("/paywall")}
        >
          <View style={styles.shotsBarLeft}>
            <MaterialCommunityIcons
              name="basketball-hoop"
              size={16}
              color={shotsRemaining > 0 ? colors.primary : colors.destructive}
            />
            <Text style={[styles.shotsBarLabel, { color: colors.foreground }]}>
              {shotsRemaining > 0
                ? `${shotsRemaining} free shot${shotsRemaining !== 1 ? "s" : ""} remaining`
                : "No shots remaining"}
            </Text>
          </View>
          <View style={styles.shotsDotsRow}>
            {Array.from({ length: totalFreeShots }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.shotDot,
                  {
                    backgroundColor: i < shotsRemaining
                      ? colors.primary
                      : colors.surface3 ?? colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.shotsBarUpgrade, { color: colors.primary }]}>Upgrade</Text>
        </Pressable>
      )}

      {sessions.length > 0 && (
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.surface1, borderColor: colors.border },
          ]}
        >
          <View style={styles.statItem}>
            <ScoreRing
              score={avgScore}
              size={70}
              strokeWidth={6}
              fontSize={20}
              label="Avg Score"
            />
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {sessions.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Sessions
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actionsSection}>
        <Pressable
          style={({ pressed }) => [
            styles.recordBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || isAnalyzing ? 0.75 : 1,
            },
          ]}
          onPress={pickVideo}
          disabled={isAnalyzing}
        >
          <Feather name="upload" size={24} color="#fff" />
          <View style={styles.recordBtnText}>
            <Text style={styles.recordBtnTitle}>Upload Slow-Mo Video</Text>
            <Text style={styles.recordBtnSub}>Record in Slo-Mo, then upload for best results</Text>
          </View>
        </Pressable>

        <View style={styles.privacyRow}>
          <MaterialCommunityIcons name="shield-check-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Your video is deleted from our servers after analysis
          </Text>
        </View>

        <Pressable
          style={[styles.filmingHintRow, { borderColor: colors.border }]}
          onPress={() => setShowTipsSheet(true)}
          hitSlop={6}
        >
          <Feather name="camera" size={14} color={colors.mutedForeground} />
          <Text style={[styles.filmingHintText, { color: colors.mutedForeground }]}>
            How to film for best results
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {isCardVisible && (
        <RNAnimated.View style={{ opacity: cardOpacity }}>
        <View
          style={[
            styles.analyzingCard,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.primary + "40",
            },
          ]}
        >
          <View style={styles.progressCardInner}>
            {/* Completed stages row */}
            {STAGE_ORDER.some((s) => {
              const stageIdx = STAGE_ORDER.indexOf(s);
              const currentIdx = STAGE_ORDER.indexOf(stage as AnalyzingStage);
              return stageIdx < currentIdx || isCompleting;
            }) && (
              <View style={styles.completedRow}>
                {STAGE_ORDER.map((s) => {
                  const stageIdx = STAGE_ORDER.indexOf(s);
                  const currentIdx = isCompleting
                    ? STAGE_ORDER.length
                    : STAGE_ORDER.indexOf(stage as AnalyzingStage);
                  if (stageIdx >= currentIdx) return null;
                  return (
                    <View key={s} style={styles.completedChip}>
                      <Feather name="check" size={11} color={colors.success} />
                      <Text style={[styles.completedChipText, { color: colors.success }]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Progress bar */}
            <View style={styles.progressRow}>
              <View style={[styles.progressTrack, { backgroundColor: colors.surface3 ?? colors.border, flex: 1 }]}>
                <RNAnimated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPctLabel, { color: colors.primary }]}>
                {progressPct}%
              </Text>
            </View>

            {/* Stage label */}
            <Text style={[styles.progressStageLabel, { color: colors.foreground }]}>
              {isCompleting ? "Done!" : STAGE_LABELS[stage]}
            </Text>

            {/* Time hint for analyzing stage */}
            {stage === "analyzing" && !isCompleting && (
              <Text style={[styles.progressTimeHint, { color: colors.mutedForeground }]}>
                Usually 15–25 seconds
              </Text>
            )}

            {/* Privacy reassurance during upload/analysis */}
            {!isCompleting && stage !== "idle" && (
              <View style={styles.progressPrivacyRow}>
                <MaterialCommunityIcons name="shield-check-outline" size={11} color={colors.mutedForeground} />
                <Text style={[styles.progressPrivacyText, { color: colors.mutedForeground }]}>
                  Video deleted after analysis
                </Text>
              </View>
            )}
          </View>
        </View>
        </RNAnimated.View>
      )}

      {recentSessions.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              RECENT SESSIONS
            </Text>
            <Pressable onPress={() => router.push("/history")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </Pressable>
          </View>
          {recentSessions.map((session) => {
            const score = session.analysis.overallScore;
            const scoreColor = gradeColor(score, colors);
            const grade = scoreToGrade(score);
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
                onPress={() =>
                  router.push({
                    pathname: "/analysis/[id]",
                    params: { id: session.id },
                  })
                }
              >
                <View style={styles.sessionImageContainer}>
                  <Image
                    source={{ uri: session.imageUri }}
                    style={styles.sessionImage}
                  />
                  {session.isVideo && (
                    <View
                      style={[
                        styles.videoTag,
                        { backgroundColor: colors.success + "cc" },
                      ]}
                    >
                      <Feather name="video" size={9} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.sessionInfo}>
                  <Text
                    style={[styles.sessionDate, { color: colors.mutedForeground }]}
                  >
                    {new Date(session.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={[styles.sessionScore, { color: scoreColor }]}>
                    {grade}
                  </Text>
                  <Text
                    style={[
                      styles.sessionSummary,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={2}
                  >
                    {session.analysis.summary}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {sessions.length === 0 && !isAnalyzing && (
        <View style={[styles.emptyState, { borderColor: colors.border }]}>
          <MaterialCommunityIcons
            name="basketball-hoop"
            size={48}
            color={colors.mutedForeground}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Record Your First Shot
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Hit Record, take your shot, and get AI biomechanical feedback in seconds
          </Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.shareCard,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={handleShare}
      >
        <MaterialCommunityIcons name="share-variant" size={24} color={colors.primaryForeground} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.shareCardTitle, { color: colors.primaryForeground }]}>
            Share Shot Doctor
          </Text>
          <Text style={[styles.shareCardSub, { color: colors.primaryForeground }]}>
            Know a baller who needs this? Send it.
          </Text>
        </View>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </Pressable>
    </ScrollView>

    <FilmingTipsSheet
      visible={showTipsSheet}
      onConfirm={() => {
        setShowTipsSheet(false);
        pickVideo();
      }}
      onDismiss={() => setShowTipsSheet(false)}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  transparentFill: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  greeting: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 130,
  },
  userChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  shotsBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 10,
  },
  shotsBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  shotsBarLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  shotsDotsRow: {
    flexDirection: "row",
    gap: 5,
  },
  shotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shotsBarUpgrade: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
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
  statItem: { alignItems: "center", flex: 1 },
  statDivider: { width: 1, height: 40 },
  statNumber: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  actionsSection: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 18,
    marginBottom: 12,
  },
  recordBtnText: { flex: 1 },
  recordBtnTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  recordBtnSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  filmingHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filmingHintText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 6,
    opacity: 0.6,
  },
  privacyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  uploadBtnInner: {
    flex: 1,
  },
  uploadBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  uploadBtnSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  recommendedBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  recommendedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.2,
  },
  videoAction: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  videoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  videoActionText: { flex: 1 },
  videoActionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  videoActionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  analyzingCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  progressCardInner: {
    padding: 20,
    gap: 12,
  },
  completedRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  completedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  completedChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressPctLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    minWidth: 36,
    textAlign: "right",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressStageLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  progressTimeHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  progressPrivacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    opacity: 0.55,
  },
  progressPrivacyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  recentSection: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  sessionImageContainer: { position: "relative" },
  sessionImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    resizeMode: "cover",
  },
  videoTag: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  sessionScore: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
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
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
  },
  shareCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  shareCardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    opacity: 0.85,
  },
});
