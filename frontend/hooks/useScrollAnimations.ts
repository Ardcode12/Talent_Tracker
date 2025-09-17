import { useRef, useCallback, useEffect } from 'react';
import { Animated, ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface ScrollAnimationConfig {
  inputRange: number[];
  outputRange: number[] | string[];
  extrapolate?: 'extend' | 'clamp' | 'identity';
}

export const useScrollAnimations = () => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        scrollDirection.current = currentScrollY > lastScrollY.current ? 'down' : 'up';
        lastScrollY.current = currentScrollY;
      },
    }
  );

  const createScrollAnimation = useCallback((
    config: ScrollAnimationConfig
  ): Animated.AnimatedInterpolation => {
    return scrollY.interpolate({
      ...config,
      extrapolate: config.extrapolate || 'clamp',
    });
  }, [scrollY]);

  const createParallaxAnimation = useCallback((
    rate: number = 0.5
  ): Animated.AnimatedInterpolation => {
    return scrollY.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [-rate, 0, rate],
    });
  }, [scrollY]);

  return {
    scrollY,
    handleScroll,
    createScrollAnimation,
    createParallaxAnimation,
    scrollDirection: scrollDirection.current,
  };
};
