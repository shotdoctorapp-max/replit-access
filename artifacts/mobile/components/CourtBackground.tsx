import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path } from "react-native-svg";

export function CourtBackground() {
  const { width } = useWindowDimensions();
  const stroke = "#00C853";
  const op = 0.24;
  const cx = width / 2;

  const keyW = width * 0.38;
  const keyH = 110;
  const keyX = cx - keyW / 2;
  const ftRadius = keyW / 2;
  const ftCY = keyH + 10;

  const arcR = width * 0.58;
  const arcStartX = cx - arcR * 0.88;
  const arcEndX   = cx + arcR * 0.88;
  const arcY      = ftCY + 30;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="none">
      <LinearGradient
        colors={["rgba(0,200,83,0.28)", "rgba(0,0,0,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
      />
      <Svg width={width} height={500} style={{ position: "absolute", top: 0 }}>
        <Line x1={cx - 18} y1={6} x2={cx + 18} y2={6} stroke={stroke} strokeWidth={2} opacity={op * 1.4} />
        <Circle cx={cx} cy={18} r={11} fill="none" stroke={stroke} strokeWidth={1.5} opacity={op * 1.4} />
        <Path d={`M ${keyX} 10 L ${keyX} ${keyH} L ${keyX + keyW} ${keyH} L ${keyX + keyW} 10`}
          fill="none" stroke={stroke} strokeWidth={1} opacity={op} />
        <Circle cx={cx} cy={ftCY} r={ftRadius} fill="none" stroke={stroke} strokeWidth={1} opacity={op} />
        <Path
          d={`M ${arcStartX} ${ftCY} Q ${cx} ${arcY + arcR * 0.55} ${arcEndX} ${ftCY}`}
          fill="none" stroke={stroke} strokeWidth={1} opacity={op} />
      </Svg>
    </Animated.View>
  );
}
