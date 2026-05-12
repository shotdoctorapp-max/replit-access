import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CourtBackground } from "@/components/CourtBackground";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STORAGE_KEY = "@shotdoc_onboarding_done";

type Slide = {
  id: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  headline: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "basketball",
    headline: "Welcome to Shot Doctor",
    body: "Your personal AI shooting coach. Analyze your form and fix it — fast.",
  },
  {
    id: "2",
    icon: "video-outline",
    headline: "Record or Upload",
    body: "Film a slow-mo clip from the side. 10 seconds is all it takes.",
  },
  {
    id: "3",
    icon: "eye-outline",
    headline: "AI Spots Everything",
    body: "Instant feedback on your Setup, Release, and Follow-through.",
  },
  {
    id: "4",
    icon: "chart-line",
    headline: "Track Your Progress",
    body: "See how your shot improves with every session.",
  },
];

const GREEN = "#00C853";
const MUTED = "#666";

export default function OnboardingScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast = activeIndex === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    router.replace("/(auth)/sign-in");
  };

  const handleNext = () => {
    if (isLast) {
      finish();
      return;
    }
    const next = activeIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { height: windowHeight }]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={item.icon} size={80} color={GREEN} />
      </View>
      <Text style={styles.headline}>{item.headline}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CourtBackground />

      {/* Skip button */}
      {!isLast && (
        <Pressable style={styles.skipBtn} onPress={finish} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
      />

      {/* Bottom area: dots + CTA */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.8 : 1 }]}
          onPress={handleNext}
        >
          <Text style={styles.ctaText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
          {!isLast && (
            <MaterialCommunityIcons name="chevron-right" size={20} color="#000" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  skipBtn: {
    position: "absolute",
    top: 58,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: MUTED,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {},
  slide: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  iconWrap: {
    marginBottom: 32,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,200,83,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  body: {
    color: "#aaa",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 16,
    gap: 20,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 7,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: GREEN,
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#333",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    width: "100%",
  },
  ctaText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
