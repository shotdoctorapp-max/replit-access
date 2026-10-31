import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

export type ShootingHand = "right" | "left";
export const SHOOTING_HAND_KEY = "@shotdoc_shooting_hand";
export async function getShootingHand(): Promise<ShootingHand | null> {
  const saved = await AsyncStorage.getItem(SHOOTING_HAND_KEY);
  if (saved === "right" || saved === "left") return saved;
  const hand = await new Promise<ShootingHand | null>(resolve => {
    Alert.alert("Which hand do you shoot with?", "This helps identify your shooting arm, not your guide arm.", [
      { text: "Right", onPress: () => resolve("right") },
      { text: "Left", onPress: () => resolve("left") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
  if (hand) await AsyncStorage.setItem(SHOOTING_HAND_KEY, hand);
  return hand;
}
