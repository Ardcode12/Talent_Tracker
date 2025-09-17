import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AnimatedGradientProps {
  colors?: string[]; // Make colors optional
  style?: any;
  children?: React.ReactNode;
}

// Default gradient colors
const DEFAULT_COLORS = ['#667eea', '#764ba2'];

export const AnimatedGradient: React.FC<AnimatedGradientProps> = ({ 
  colors = DEFAULT_COLORS, // Provide default value
  style, 
  children 
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  // Validate colors array
  const validColors = Array.isArray(colors) && colors.length > 0 ? colors : DEFAULT_COLORS;

  return (
    <View style={[styles.container, style]}>
      <Svg width={width * 2} height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            {validColors.map((color, index) => (
              <Stop
                key={index}
                offset={`${(index / (Math.max(validColors.length - 1, 1))) * 100}%`}
                stopColor={color}
                stopOpacity="0.8"
              />
            ))}
          </LinearGradient>
        </Defs>
        <AnimatedRect
          x="0"
          y="0"
          width={width * 2}
          height="100%"
          fill="url(#gradient)"
          transform={[{ translateX }]}
        />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
});
