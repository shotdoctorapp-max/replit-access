export type Tier = "Elite" | "Pro" | "Rising" | "Beginner";
export type Severity = "Critical" | "Moderate" | "Minor" | "Good";
export const TIER_COLORS: Record<Tier, string> = {
  Beginner: "#EF4444", Rising: "#F59E0B", Pro: "#22C55E", Elite: "#A855F7",
};
export const UNSCORED_COLOR = "#9CA3AF";
export const TIER_ICONS: Record<Tier, string> = {
  Elite: "crown", Pro: "star", Rising: "trending-up", Beginner: "seed-outline",
};
const TIERS: { minimum: number; label: Tier; needsWork: boolean; severity: Severity }[] = [
  { minimum: 85, label: "Elite", needsWork: false, severity: "Good" },
  { minimum: 70, label: "Pro", needsWork: false, severity: "Good" },
  { minimum: 55, label: "Rising", needsWork: true, severity: "Moderate" },
  { minimum: 0, label: "Beginner", needsWork: true, severity: "Critical" },
];
export function scoreToTier(value: unknown): {
  label: Tier | "—"; color: string; needsWork: boolean; score: number | null; severity: Severity | null;
} {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    return { label: "—", color: UNSCORED_COLOR, needsWork: false, score: null, severity: null };
  }
  const tier = TIERS.find(t => value >= t.minimum)!;
  return { label: tier.label, color: TIER_COLORS[tier.label], needsWork: tier.needsWork, score: value, severity: tier.severity };
}
// Compatibility helpers delegate to the single descriptor; no parallel thresholds.
export function knownTier(score: unknown): Tier | null {
  const { label } = scoreToTier(score);
  return label === "—" ? null : label;
}
export const componentTierColor = (score: unknown) => scoreToTier(score).color;
export const tierColor = componentTierColor;
export const scoreSeverity = (score: unknown) => scoreToTier(score).severity;
export function frameTierSummary(
  annotations: readonly { zone: string }[],
  components: Record<string, { score?: number | null } | undefined> | undefined,
): Tier | null {
  const scores = annotations.map(a => components?.[a.zone]?.score)
    .filter((s): s is number => knownTier(s) !== null);
  return scores.length ? knownTier(Math.min(...scores)) : null;
}
