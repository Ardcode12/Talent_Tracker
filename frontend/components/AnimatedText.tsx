import React, { useEffect, useRef } from 'react';
import { Animated, Text, TextStyle, View, StyleSheet } from 'react-native';

interface AnimatedTextProps {
  children: string;
  style?: TextStyle;
  delay?: number;
  duration?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  children,
  style,
  delay = 0,
  duration = 1500,
}) => {
  const animatedValues = useRef(
    children.split('').map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(30),
      scale: new Animated.Value(0.5),
    }))
  ).current;

  useEffect(() => {
    const animations = animatedValues.map((values, index) => {
      const charDelay = delay + (index * duration) / children.length / 2;
      
      return Animated.parallel([
        Animated.timing(values.opacity, {
          toValue: 1,
          duration: duration / children.length * 2,
          delay: charDelay,
          useNativeDriver: true,
        }),
        Animated.spring(values.translateY, {
          toValue: 0,
          delay: charDelay,
          damping: 8,
          stiffness: 100,
          useNativeDriver: true,
        }),
        Animated.spring(values.scale, {
          toValue: 1,
          delay: charDelay,
          damping: 12,
          stiffness: 180,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(30, animations).start();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[style, styles.hiddenText]}>{children}</Text>
      <View style={styles.animatedContainer}>
        {children.split('').map((char, index) => (
          <Animated.Text
            key={index}
            style={[
              style,
              styles.animatedChar,
              {
                opacity: animatedValues[index].opacity,
                transform: [
                  { translateY: animatedValues[index].translateY },
                  { scale: animatedValues[index].scale },
                ],
              },
            ]}
          >
            {char}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  hiddenText: {
    opacity: 0,
  },
  animatedContainer: {
    position: 'absolute',
    flexDirection: 'row',
    top: 0,
    left: 0,
  },
  animatedChar: {
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
