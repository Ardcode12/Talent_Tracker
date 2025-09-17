// components/ConnectionCard3D.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Theme } from '../constants/Theme';

interface ConnectionCard3DProps {
  children: React.ReactNode;
  style?: any;
}

export const ConnectionCard3D: React.FC<ConnectionCard3DProps> = ({ children, style }) => {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(rotateX, {
        toValue: 5,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(rotateX, {
        toValue: 0,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    // Idle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateY, {
          toValue: 3,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateY, {
          toValue: -3,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.card,
          style,
          {
            transform: [
              { perspective: 1000 },
              {
                rotateX: rotateX.interpolate({
                  inputRange: [-10, 10],
                  outputRange: ['-10deg', '10deg'],
                }),
              },
              {
                rotateY: rotateY.interpolate({
                  inputRange: [-10, 10],
                  outputRange: ['-10deg', '10deg'],
                }),
              },
              { scale },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
});
