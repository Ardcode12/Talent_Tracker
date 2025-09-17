// utils/opportunityAnimations.ts
import { Animated } from 'react-native';

export const createStaggerAnimation = (items: number, delay: number = 100) => {
  const animations = Array(items).fill(0).map(() => new Animated.Value(0));
  
  const startAnimation = () => {
    const animationSequence = animations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: index * delay,
        useNativeDriver: true,
      })
    );
    
    Animated.parallel(animationSequence).start();
  };
  
  return { animations, startAnimation };
};

export const createPulseAnimation = () => {
  const scaleValue = new Animated.Value(1);
  
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  return { scaleValue, startPulse };
};

export const createFloatingAnimation = () => {
  const translateY = new Animated.Value(0);
  
  const startFloating = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  return { translateY, startFloating };
};
