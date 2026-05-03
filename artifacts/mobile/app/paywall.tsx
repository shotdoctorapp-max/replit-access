import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#00C853";
const BG = "#000";
const SURFACE = "#111";
const BORDER = "#222";

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: "$9.99",
    period: "/mo",
    tag: null,
    highlight: false,
  },
  {
    id: "yearly",
    label: "Yearly",
    price: "$59.99",
    period: "/yr",
    tag: "Best Value — 50% off",
    highlight: true,
  },
];

const PERKS = [
  { icon: "infinity", text: "Unlimited shot analyses" },
  { icon: "chart-line", text: "Full session history & trends" },
  { icon: "brain", text: "Advanced AI biomechanics" },
  { icon: "lightning-bolt", text: "Priority analysis speed" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState("yearly");

  const handleSubscribe = () => {
    Alert.alert(
      "Coming Soon",
      "Payment processing will be available in the next update. Stay tuned!",
      [{ text: "Got it" }]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: BG }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
          paddingBottom: insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Feather name="x" size={22} color="#666" />
      </Pressable>

      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="basketball" size={48} color={GREEN} />
        </View>
        <Text style={styles.heroTitle}>Unlock Shot Doctor Pro</Text>
        <Text style={styles.heroSubtitle}>
          You've used your 3 free shots. Upgrade to keep improving your game.
        </Text>
      </View>

      <View style={styles.perksCard}>
        {PERKS.map((perk) => (
          <View key={perk.icon} style={styles.perkRow}>
            <View style={styles.perkIcon}>
              <MaterialCommunityIcons name={perk.icon as any} size={18} color={GREEN} />
            </View>
            <Text style={styles.perkText}>{perk.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plansSection}>
        {PLANS.map((plan) => (
          <Pressable
            key={plan.id}
            style={[
              styles.planCard,
              {
                borderColor: selected === plan.id ? GREEN : BORDER,
                backgroundColor: selected === plan.id ? GREEN + "10" : SURFACE,
              },
            ]}
            onPress={() => setSelected(plan.id)}
          >
            {plan.tag && (
              <View style={styles.planTag}>
                <Text style={styles.planTagText}>{plan.tag}</Text>
              </View>
            )}
            <View style={styles.planRow}>
              <View style={[
                styles.radioOuter,
                { borderColor: selected === plan.id ? GREEN : "#444" },
              ]}>
                {selected === plan.id && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPriceLine}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.subscribeBtn, { opacity: pressed ? 0.8 : 1 }]}
        onPress={handleSubscribe}
      >
        <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Subscriptions auto-renew. Cancel anytime. Payment is charged at confirmation.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24 },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 8,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: GREEN + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#888",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  perksCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GREEN + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#ddd",
    flex: 1,
  },
  plansSection: { gap: 12, marginBottom: 28 },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },
  planTag: {
    backgroundColor: GREEN,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
  },
  planTagText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: 0.3,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN,
  },
  planInfo: { flex: 1 },
  planLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    marginBottom: 2,
  },
  planPriceLine: {},
  planPrice: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  planPeriod: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#666",
  },
  subscribeBtn: {
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  subscribeBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
    lineHeight: 16,
  },
});
