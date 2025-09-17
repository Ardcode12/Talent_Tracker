// components/UltraPremiumAnimations.tsx
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ViewStyle,
} from 'react-native';
import Animated, {
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
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
}

// Holographic Card with Animated Gradient
export const HolographicCard: React.FC<Props> = ({ children, style }) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 3000 }),
        withTiming(1, { duration: 3000 })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scale);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.holographicCard, animatedStyle, style]}>
      <LinearGradient
        colors={['#FF006E', '#8338EC', '#3A86FF', '#FF006E']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <BlurView intensity={80} style={styles.holographicContent}>
        {children}
      </BlurView>
    </Animated.View>
  );
};

// Plasma Background Effect
export const PlasmaBackground: React.FC = () => {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);

  useEffect(() => {
    wave1.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    wave2.value = withRepeat(
      withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    wave3.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(wave1);
      cancelAnimation(wave2);
      cancelAnimation(wave3);
    };
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => {
    const translateX = interpolate(wave1.value, [0, 1], [-200, 200]);
    const translateY = interpolate(wave1.value, [0, 1], [-100, 100]);
    return {
      transform: [{ translateX }, { translateY }],
    };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    const translateX = interpolate(wave2.value, [0, 1], [200, -200]);
    const translateY = interpolate(wave2.value, [0, 1], [100, -100]);
    return {
      transform: [{ translateX }, { translateY }],
    };
  });

  const animatedStyle3 = useAnimatedStyle(() => {
    const scale = interpolate(wave3.value, [0, 0.5, 1], [1, 1.5, 1]);
    return {
      transform: [{ scale }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[styles.plasmaBlob, styles.blob1, animatedStyle1]}>
        <LinearGradient
          colors={['#FF006E80', '#FF006E00']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.plasmaBlob, styles.blob2, animatedStyle2]}>
        <LinearGradient
          colors={['#8338EC80', '#8338EC00']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.plasmaBlob, styles.blob3, animatedStyle3]}>
        <LinearGradient
          colors={['#3A86FF80', '#3A86FF00']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

// Neon Pulse Button
export const NeonPulseButton: React.FC<Props & { onPress?: () => void }> = ({ 
  children, 
  style, 
  onPress 
}) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(glow);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: interpolate(glow.value, [0, 1], [0.3, 0.8]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View style={[styles.neonButton, animatedStyle, style]}>
      <LinearGradient
        colors={['#FF006E', '#8338EC']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {children}
    </Animated.View>
  );
};

// Morphing Shape Background
export const MorphingShapes: React.FC = () => {
  const morph1 = useSharedValue(0);
  const morph2 = useSharedValue(0);

  useEffect(() => {
    morph1.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    morph2.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(morph1);
      cancelAnimation(morph2);
    };
  }, []);

  const shape1Style = useAnimatedStyle(() => {
    const borderRadius = interpolate(morph1.value, [0, 0.5, 1], [20, 100, 20]);
    const rotate = interpolate(morph1.value, [0, 1], [0, 180]);
    return {
      borderRadius,
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const shape2Style = useAnimatedStyle(() => {
    const borderRadius = interpolate(morph2.value, [0, 0.5, 1], [100, 20, 100]);
    const rotate = interpolate(morph2.value, [0, 1], [0, -180]);
    return {
      borderRadius,
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[styles.morphShape, styles.shape1, shape1Style]}>
        <LinearGradient
          colors={['#FF006E20', '#FF006E00']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.morphShape, styles.shape2, shape2Style]}>
        <LinearGradient
          colors={['#3A86FF20', '#3A86FF00']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  holographicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF006E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  holographicContent: {
    flex: 1,
    padding: 20,
  },
  plasmaBlob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  blob1: {
    top: -200,
    left: -200,
  },
  blob2: {
    bottom: -200,
    right: -200,
  },
  blob3: {
    top: '30%',
    left: '20%',
  },
  neonButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#FF006E',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 8,
  },
  morphShape: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  shape1: {
    top: 100,
    left: -50,
  },
  shape2: {
    bottom: 200,
    right: -50,
  },
});
// components/UltraPremiumEffects.tsx - Update the color values
// Replace the existing color values with these professional ones:

// In UltraGradientBackground component:
<LinearGradient
  colors={['rgba(30, 136, 229, 0.3)', 'rgba(94, 53, 177, 0.2)', 'transparent']}
  // ... rest of the gradient
/>

// Second gradient:
<LinearGradient
  colors={['rgba(0, 172, 193, 0.3)', 'rgba(94, 53, 177, 0.2)', 'transparent']}
  // ... rest of the gradient
/>

// In FloatingParticle:
backgroundColor: ['#1E88E5', '#5E35B1', '#00ACC1', '#FFB300'][Math.floor(Math.random() * 4)],

// In LiquidMorphAnimation:
<LinearGradient
  colors={['rgba(30, 136, 229, 0.2)', 'rgba(94, 53, 177, 0.2)', 'rgba(0, 172, 193, 0.2)']}
  // ... rest of the gradient
/>

// In PrismaticCard:
<LinearGradient
  colors={['rgba(30, 136, 229, 0.03)', 'rgba(255, 255, 255, 0.05)', 'rgba(0, 172, 193, 0.03)']}
  // ... rest of the gradient
/>

// In NeonGlowView:
color = '#1E88E5'  // Change default color
