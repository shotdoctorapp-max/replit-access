export type Tier = "Elite" | "Pro" | "Rising" | "Developing" | "Beginner";

export const TIER_COLORS: Record<Tier, string> = {
  Elite:      "#FFD700", // gold
  Pro:        "#A8B2C1", // silver
  Rising:     "#4A9EFF", // blue
  Developing: "#CD7F32", // bronze
  Beginner:   "#6B7280", // grey
};

/** Icon name (MaterialCommunityIcons) for each tier */
export const TIER_ICONS: Record<Tier, string> = {
  Elite:      "crown",
  Pro:        "star",
  Rising:     "trending-up",
  Developing: "dumbbell",
  Beginner:   "seed-outline",
};

export function scoreToTier(score: number): Tier {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Pro";
  if (score >= 55) return "Rising";
  if (score >= 40) return "Developing";
  return "Beginner";
}

/** Returns the tier color hex string for a given numeric score. */
export function tierColor(score: number): string {
  return TIER_COLORS[scoreToTier(score)];
}
