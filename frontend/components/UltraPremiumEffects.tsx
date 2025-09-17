// components/UltraPremiumEffects.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ViewStyle,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedGradientBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
}

// Ultra Gradient Animation Background
export const UltraGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({ children, style }) => {
  const animValue1 = useRef(new Animated.Value(0)).current;
  const animValue2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(animValue1, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue1, {
            toValue: 0,
            duration: 10000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(animValue2, {
            toValue: 1,
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue2, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const translateX1 = animValue1.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  const translateY1 = animValue1.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  const translateX2 = animValue2.interpolate({
    inputRange: [0, 1],
    outputRange: [200, -200],
  });

  const translateY2 = animValue2.interpolate({
    inputRange: [0, 1],
    outputRange: [100, -100],
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <Animated.View
        style={[
          styles.gradientBlob,
          styles.blob1,
          {
            transform: [{ translateX: translateX1 }, { translateY: translateY1 }],
          },
        ]}
      >
        <LinearGradient
          colors={[`${Theme.colors.primary}30`, `${Theme.colors.secondary}20`, 'transparent']}
          style={styles.gradientFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.gradientBlob,
          styles.blob2,
          {
            transform: [{ translateX: translateX2 }, { translateY: translateY2 }],
          },
        ]}
      >
        <LinearGradient
          colors={[`${Theme.colors.info}30`, `${Theme.colors.success}20`, 'transparent']}
          style={styles.gradientFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {children}
    </View>
  );
};

// Floating Particles Effect
export const FloatingParticles: React.FC = () => {
  const particles = Array.from({ length: 15 });
  
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((_, index) => (
        <FloatingParticle key={index} delay={index * 400} />
      ))}
    </View>
  );
};

const FloatingParticle: React.FC<{ delay: number }> = ({ delay }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const startX = Math.random() * SCREEN_WIDTH;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animValue, {
          toValue: 1,
          duration: 8000 + Math.random() * 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT + 50, -100],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1.2],
  });

  const particleColors = [Theme.colors.primary, Theme.colors.secondary, Theme.colors.info, Theme.colors.success];

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          transform: [{ translateY }, { scale }],
          opacity,
          backgroundColor: particleColors[Math.floor(Math.random() * particleColors.length)],
        },
      ]}
    />
  );
};

// Liquid Morph Animation
export const LiquidMorphAnimation: React.FC = () => {
  const morph1 = useSharedValue(0);
  const morph2 = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    morph1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    morph2.value = withRepeat(
      withSequence(
        withDelay(2000, withTiming(1, { duration: 3000 })),
        withTiming(0, { duration: 3000 })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 5000 }),
        withTiming(0.8, { duration: 5000 })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(morph1);
      cancelAnimation(morph2);
      cancelAnimation(scale);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(morph1.value, [0, 1], [-100, 100]);
    const translateY = interpolate(morph2.value, [0, 1], [-50, 50]);
    
    return {
      transform: [
        { translateX },
        { translateY },
        { scale: scale.value },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <ReAnimated.View style={[styles.liquidMorph, animatedStyle]}>
        <LinearGradient
          colors={[`${Theme.colors.primary}20`, `${Theme.colors.secondary}20`, `${Theme.colors.info}20`]}
          style={styles.liquidShape}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </ReAnimated.View>
    </View>
  );
};

// Prismatic Card Effect
export const PrismaticCard: React.FC<AnimatedGradientBackgroundProps> = ({ children, style }) => {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  useEffect(() => {
    rotateX.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 2000 }),
        withTiming(-5, { duration: 2000 })
      ),
      -1,
      true
    );
    
    rotateY.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 3000 }),
        withTiming(-10, { duration: 3000 })
      ),
      -1,
      true
    );

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    return () => {
      cancelAnimation(rotateX);
      cancelAnimation(rotateY);
    };
  }, []);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <ReAnimated.View style={[styles.prismaticCard, animatedStyle, style]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.03)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Shimmer overlay */}
      <Animated.View
        style={[
          styles.shimmerOverlay,
          {
            transform: [{ translateX: shimmerTranslateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.1)', 'transparent']}
          style={styles.shimmerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>
      
      <View style={styles.prismaticOverlay} />
      {children}
    </ReAnimated.View>
  );
};

// Neon Glow Effect
export const NeonGlowView: React.FC<AnimatedGradientBackgroundProps & { color?: string }> = ({ 
  children, 
  style, 
  color = Theme.colors.primary 
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={[styles.neonContainer, style]}>
      <Animated.View
        style={[
          styles.neonGlow,
          {
            opacity: glowOpacity,
            shadowColor: color,
            backgroundColor: color + '20',
          },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  gradientBlob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    overflow: 'hidden',
  },
  blob1: {
    top: -200,
    left: -200,
  },
  blob2: {
    bottom: -200,
    right: -200,
  },
  gradientFill: {
    flex: 1,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  liquidMorph: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
  },
  liquidShape: {
    flex: 1,
  },
  prismaticCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  prismaticOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmerGradient: {
    width: 100,
    height: '100%',
  },
  neonContainer: {
    position: 'relative',
  },
  neonGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
});
