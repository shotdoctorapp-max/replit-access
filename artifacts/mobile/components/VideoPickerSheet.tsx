import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onSelect: (localUri: string, durationSeconds?: number) => void;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0
    ? `${m}:${s.toString().padStart(2, "0")}`
    : `0:${s.toString().padStart(2, "0")}`;
}

export function VideoPickerSheet({ visible, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const screenW = Dimensions.get("window").width;
  const cellW = (screenW - 40 - 8) / 2;
  const cellH = cellW * (9 / 16);

  useEffect(() => {
    if (!visible) return;
    setAssets([]);
    setThumbnails({});
    setErrorMsg(null);
    setLoadingId(null);
    loadVideos();
  }, [visible]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Allow photo library access so we can browse your videos.");
        setLoading(false);
        return;
      }
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 30,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets(result.assets);
      generateThumbnails(result.assets);
    } catch {
      setErrorMsg("Couldn't load your videos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateThumbnails = async (items: MediaLibrary.Asset[]) => {
    for (const asset of items) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        const uri = info.localUri ?? asset.uri;
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 0,
          quality: 0.5,
        });
        setThumbnails((prev) => ({ ...prev, [asset.id]: thumbUri }));
      } catch {
        // keep placeholder
      }
    }
  };

  const handleSelect = async (asset: MediaLibrary.Asset) => {
    if (loadingId) return;
    setLoadingId(asset.id);
    setErrorMsg(null);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id, {
        shouldDownloadFromNetwork: true,
      });
      if (!info.localUri) {
        setErrorMsg("Couldn't load that video — please try another one.");
        setLoadingId(null);
        return;
      }
      onSelect(info.localUri, asset.duration);
    } catch {
      setErrorMsg("Couldn't load that video — please try another one.");
      setLoadingId(null);
    }
  };

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => {
    const thumb = thumbnails[item.id];
    const isLoading = loadingId === item.id;
    return (
      <Pressable
        style={[styles.cell, { width: cellW, height: cellH }]}
        onPress={() => handleSelect(item)}
        disabled={!!loadingId}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder]}>
            <Feather name="film" size={22} color="#444" />
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
        {isLoading && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <ActivityIndicator color="#00C853" size="small" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose a Video</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color="#888" />
          </Pressable>
        </View>

        <Text style={styles.subhead}>
          iCloud videos download automatically when selected
        </Text>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#00C853" size="large" />
            <Text style={styles.loadingText}>Loading videos…</Text>
          </View>
        ) : assets.length === 0 ? (
          <View style={styles.centerBox}>
            <Feather name="video-off" size={40} color="#444" />
            <Text style={styles.emptyText}>No videos found</Text>
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            numColumns={2}
            renderItem={renderItem}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  subhead: {
    color: "#666",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  errorText: {
    color: "#ff5555",
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 10,
    fontFamily: "Inter_400Regular",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  cell: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  thumbPlaceholder: {
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 5,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  loadingOverlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
