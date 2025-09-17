import React, { useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ViewStyle, 
  Platform, 
  Animated,
  Easing 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';

interface GlassmorphicCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  delay?: number;
  isHoverable?: boolean;
}

export const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  children,
  style,
  intensity = 20,
  delay = 0,
  isHoverable = true,
}) => {
  const scaleValue = useRef(new Animated.Value(0.95)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        delay,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 600,
        delay,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      }),
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 800,
        delay,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['5deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: opacityValue,
          transform: [
            { scale: scaleValue },
            { rotate: rotation },
            { perspective: 1000 },
          ],
        },
      ]}
    >
      <View style={styles.glowEffect} />
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} style={styles.absolute}>
          <View style={styles.gradient} />
        </BlurView>
      ) : (
        <View style={[styles.absolute, styles.androidBackground]} />
      )}
      <View style={styles.borderGradient} />
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  absolute: {
    ...StyleSheet.absoluteFillObject,
  },
  androidBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  borderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  glowEffect: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    backgroundColor: Theme.colors.primary,
    opacity: 0.1,
    borderRadius: Theme.borderRadius.xl,
    transform: [{ scale: 1.2 }],
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
