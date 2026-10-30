export type Tier = "Elite" | "Pro" | "Rising" | "Developing" | "Beginner";
export type Severity = "Critical" | "Moderate" | "Minor" | "Good";

export const TIER_COLORS: Record<Tier, string> = {
  Elite:      "#FFD700",
  Pro:        "#A8B2C1",
  Rising:     "#4A9EFF",
  Developing: "#CD7F32",
  Beginner:   "#6B7280",
};

/** A distinct neutral state for an annotation whose component has no usable score. */
export const UNSCORED_COLOR = "#9CA3AF";

export function knownTier(score: unknown): Tier | null {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
    ? scoreToTier(score)
    : null;
}

export function componentTierColor(score: unknown): string {
  const tier = knownTier(score);
  return tier ? TIER_COLORS[tier] : UNSCORED_COLOR;
}

/** Frame-strip summary: weakest *known* tier among components annotated on this frame.
 * Unscored annotations stay neutral individually; a frame with no scored components is neutral.
 */
export function frameTierSummary(
  annotations: readonly { zone: string }[],
  components: Record<string, { score?: number | null } | undefined> | undefined,
): Tier | null {
  const scores = annotations.map(a => components?.[a.zone]?.score)
    .filter((s): s is number => knownTier(s) !== null);
  return scores.length ? scoreToTier(Math.min(...scores)) : null;
}

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

export function scoreToTier(score: number): Tier;
export function scoreToTier(score: null): "Unscored";
export function scoreToTier(score: number | null): Tier | "Unscored";
export function scoreToTier(score: number | null): Tier | "Unscored" {
  if (score === null) return "Unscored";
  if (score >= 85) return "Elite";
  if (score >= 70) return "Pro";
  if (score >= 55) return "Rising";
  if (score >= 40) return "Developing";
  return "Beginner";
}

/** Returns the tier color hex string for a given numeric score. */
export function tierColor(score: number | null | undefined): string {
  return componentTierColor(score);
}

/** Returns the severity level for a given numeric score. */
export function scoreSeverity(score: number): Severity {
  if (score < 55) return "Critical";
  if (score < 70) return "Moderate";
  if (score < 85) return "Minor";
  return "Good";
}
