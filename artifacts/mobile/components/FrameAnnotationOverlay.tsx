import React, { useEffect, useRef, useState } from "react";
import { Animated, Image as RNImage, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { FrameAnnotation } from "@/context/SessionContext";

interface Props {
  annotations: FrameAnnotation[];
  containerWidth: number;
  containerHeight: number;
  imageUri: string;
  componentFeedback?: Record<string, { score: number; feedback: string; adjustments?: string[] }>;
}

interface RenderedRect {
  offsetX: number;
  offsetY: number;
  renderedW: number;
  renderedH: number;
}

function computeRenderedRect(
  naturalW: number,
  naturalH: number,
  containerW: number,
  containerH: number
): RenderedRect {
  if (!naturalW || !naturalH) {
    return { offsetX: 0, offsetY: 0, renderedW: containerW, renderedH: containerH };
  }
  const naturalAspect = naturalW / naturalH;
  const containerAspect = containerW / containerH;

  let renderedW: number;
  let renderedH: number;

  if (naturalAspect > containerAspect) {
    renderedW = containerW;
    renderedH = containerW / naturalAspect;
  } else {
    renderedH = containerH;
    renderedW = containerH * naturalAspect;
  }

  return {
    offsetX: (containerW - renderedW) / 2,
    offsetY: (containerH - renderedH) / 2,
    renderedW,
    renderedH,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function severityColor(
  severity: FrameAnnotation["severity"],
  colors: ReturnType<typeof useColors>
): string {
  if (severity === "good") return colors.success;
  if (severity === "warning") return colors.warning;
  return colors.destructive;
}

function PulsingDot({ color, selected }: { color: string; selected: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (selected) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.45, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [selected, scale, opacity]);

  const dotSize = selected ? 16 : 13;
  const ringSize = selected ? 28 : 24;

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: "#fff",
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 5,
          elevation: 6,
        }}
      />
    </View>
  );
}

export function FrameAnnotationOverlay({
  annotations,
  containerWidth,
  containerHeight,
  imageUri,
  componentFeedback,
}: Props) {
  const colors = useColors();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setNaturalSize(null);
    setSelectedZone(null);
    if (!imageUri) return;
    RNImage.getSize(
      imageUri,
      (w, h) => setNaturalSize({ width: w, height: h }),
      () => {}
    );
  }, [imageUri]);

  if (!containerWidth || !containerHeight || annotations.length === 0) {
    return null;
  }

  const rect: RenderedRect = naturalSize
    ? computeRenderedRect(naturalSize.width, naturalSize.height, containerWidth, containerHeight)
    : { offsetX: 0, offsetY: 0, renderedW: containerWidth, renderedH: containerHeight };

  function toPixelX(normX: number): number {
    return rect.offsetX + clamp(normX, 0, 1) * rect.renderedW;
  }
  function toPixelY(normY: number): number {
    return rect.offsetY + clamp(normY, 0, 1) * rect.renderedH;
  }

  const selectedAnnotation = annotations.find((a) => a.zone === selectedZone);
  const selectedColor = selectedAnnotation
    ? severityColor(selectedAnnotation.severity, colors)
    : colors.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 1. Dismiss backdrop — only present when a callout is open. Rendered below the dots
           so dots remain tappable on top. Tapping the backdrop dismisses the callout. */}
      {selectedAnnotation && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setSelectedZone(null)}
        />
      )}

      {/* 2. Dot markers — rendered above the backdrop so they intercept their own taps */}
      {annotations.map((ann, idx) => {
        const cx = toPixelX(ann.x);
        const cy = toPixelY(ann.y);
        const color = severityColor(ann.severity, colors);
        const isSelected = selectedZone === ann.zone;

        return (
          <Pressable
            key={`${ann.zone}-${idx}`}
            style={[styles.markerHitArea, { left: cx - 20, top: cy - 20 }]}
            onPress={() =>
              setSelectedZone((prev) => (prev === ann.zone ? null : ann.zone))
            }
          >
            <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <PulsingDot color={color} selected={isSelected} />
            </View>
          </Pressable>
        );
      })}

      {/* 3. Callout card — rendered on top of everything */}
      {selectedAnnotation && (
        <CalloutCard
          annotation={selectedAnnotation}
          color={selectedColor}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          toPixelX={toPixelX}
          toPixelY={toPixelY}
          feedback={componentFeedback?.[selectedAnnotation.zone]?.feedback}
          firstAdjustment={componentFeedback?.[selectedAnnotation.zone]?.adjustments?.[0]}
          colors={colors}
        />
      )}
    </View>
  );
}

function CalloutCard({
  annotation,
  color,
  containerWidth,
  containerHeight,
  toPixelX,
  toPixelY,
  feedback,
  firstAdjustment,
  colors,
}: {
  annotation: FrameAnnotation;
  color: string;
  containerWidth: number;
  containerHeight: number;
  toPixelX: (n: number) => number;
  toPixelY: (n: number) => number;
  feedback?: string;
  firstAdjustment?: string;
  colors: ReturnType<typeof useColors>;
}) {
  const cx = toPixelX(annotation.x);
  const cy = toPixelY(annotation.y);

  const cardWidth = 210;
  const cardHeight = firstAdjustment ? 110 : 80;

  let left = cx + 18;
  let top = cy - cardHeight / 2;

  if (left + cardWidth > containerWidth - 8) {
    left = cx - cardWidth - 18;
  }
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  if (top + cardHeight > containerHeight - 8) {
    top = containerHeight - cardHeight - 8;
  }

  const shortFeedback = feedback
    ? feedback.split(/(?<=\.)\s+/)[0]?.replace(/\.$/, "").trim()
    : null;

  return (
    <View
      style={[
        styles.callout,
        {
          left,
          top,
          width: cardWidth,
          backgroundColor: colors.surface1 + "f2",
          borderColor: color + "80",
        },
      ]}
    >
      <View style={styles.calloutHeader}>
        <View style={[styles.calloutDot, { backgroundColor: color }]} />
        <Text style={[styles.calloutLabel, { color }]} numberOfLines={1}>
          {annotation.label}
        </Text>
      </View>
      {shortFeedback && (
        <Text
          style={[styles.calloutFeedback, { color: colors.foreground }]}
          numberOfLines={3}
        >
          {shortFeedback}
        </Text>
      )}
      {firstAdjustment && (
        <View style={[styles.calloutTipRow, { borderTopColor: color + "30" }]}>
          <Text style={[styles.calloutTipLabel, { color }]}>Tip: </Text>
          <Text style={[styles.calloutTipText, { color: colors.foreground }]} numberOfLines={3}>
            {firstAdjustment}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  markerHitArea: {
    position: "absolute",
  },
  callout: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  calloutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  calloutLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  calloutFeedback: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    opacity: 0.9,
  },
  calloutTipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  calloutTipLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  calloutTipText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
    flex: 1,
    opacity: 0.88,
  },
});
