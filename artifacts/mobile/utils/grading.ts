export type Tier = "Elite" | "Pro" | "Rising" | "Developing" | "Beginner";
export type Severity = "Critical" | "Moderate" | "Minor" | "Good";

export const TIER_COLORS: Record<Tier, string> = {
  Elite:      "#9B59B6", // purple
  Pro:        "#FF4444", // red
  Rising:     "#FFD700", // gold
  Developing: "#A8B2C1", // silver
  Beginner:   "#CD7F32", // bronze
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  Critical: "#FF4444",
  Moderate: "#FF9500",
  Minor:    "#FFD700",
  Good:     "#00C853",
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

/** Returns the severity level for a given numeric score. */
export function scoreSeverity(score: number): Severity {
  if (score < 55) return "Critical";
  if (score < 70) return "Moderate";
  if (score < 85) return "Minor";
  return "Good";
}
