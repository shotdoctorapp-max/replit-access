export type Grade = "A" | "B" | "C" | "D" | "E";

export function scoreToGrade(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

export function gradeColor(
  score: number,
  colors: { success: string; warning: string; destructive: string }
): string {
  if (score >= 70) return colors.success;
  if (score >= 55) return colors.warning;
  return colors.destructive;
}
