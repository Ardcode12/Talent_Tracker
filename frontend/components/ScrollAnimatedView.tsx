import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  ViewStyle,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScrollAnimatedViewProps {
  children: React.ReactNode;
  animation?: 'fadeUp' | 'slideInRight' | 'zoomIn' | 'fadeIn' | 'slideInLeft';
  delay?: number;
  duration?: number;
  style?: ViewStyle;
  threshold?: number;
}

export const ScrollAnimatedView: React.FC<ScrollAnimatedViewProps> = ({
  children,
  animation = 'fadeUp',
  delay = 0,
  duration = 800,
  style,
  threshold = 0.3,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [hasAnimated, setHasAnimated] = useState(false);
  const viewRef = useRef<View>(null);

  useEffect(() => {
    const checkViewVisibility = () => {
      if (viewRef.current && !hasAnimated) {
        viewRef.current.measure((x, y, width, height, pageX, pageY) => {
          const viewBottom = pageY + height;
          const viewTop = pageY;
          const screenBottom = SCREEN_HEIGHT;
          const triggerPoint = screenBottom - (SCREEN_HEIGHT * threshold);

          if (viewTop < triggerPoint && viewBottom > 0) {
            animateIn();
            setHasAnimated(true);
          }
        });
      }
    };

    const timer = setInterval(checkViewVisibility, 100);
    return () => clearInterval(timer);
  }, [hasAnimated]);

  const animateIn = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  };

  const getAnimationStyle = () => {
    switch (animation) {
      case 'fadeUp':
        return {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        };
      case 'slideInRight':
        return {
          opacity: animatedValue,
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
        };
      case 'slideInLeft':
        return {
          opacity: animatedValue,
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 0],
              }),
            },
          ],
        };
      case 'zoomIn':
        return {
          opacity: animatedValue,
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        };
      case 'fadeIn':
        return {
          opacity: animatedValue,
        };
      default:
        return {};
    }
  };

  return (
    <Animated.View
      ref={viewRef}
      style={[
        style,
        getAnimationStyle(),
      ]}
    >
      {children}
    </Animated.View>
  );
};
