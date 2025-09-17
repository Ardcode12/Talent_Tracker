// components/FloatingActionMenu.tsx
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FloatingActionMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useSharedValue(0);

  const toggleMenu = () => {
    animation.value = withSpring(isOpen ? 0 : 1, {
      damping: 15,
      stiffness: 150,
    });
    setIsOpen(!isOpen);
  };

  const mainButtonStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      animation.value,
      [0, 1],
      [0, 45],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const menuItems = [
    { icon: 'fitness', color: Theme.colors.primary, label: 'Training' },      
    { icon: 'analytics', color: Theme.colors.secondary, label: 'Analytics' },   
    { icon: 'trophy', color: Theme.colors.accent, label: 'Compete' },        
    { icon: 'people', color: Theme.colors.info, label: 'Connect' },        
  ];

  return (
    <View style={styles.container}>
      {/* Menu Items */}
      {menuItems.map((item, index) => {
        const itemStyle = useAnimatedStyle(() => {
          const translateY = interpolate(
            animation.value,
            [0, 1],
            [0, -(80 + index * 70)],
            Extrapolate.CLAMP
          );
          const opacity = interpolate(
            animation.value,
            [0, 0.5, 1],
            [0, 0.5, 1],
            Extrapolate.CLAMP
          );
          const scale = interpolate(
            animation.value,
            [0, 1],
            [0.5, 1],
            Extrapolate.CLAMP
          );
          return {
            transform: [{ translateY }, { scale }],
            opacity,
          };
        });

        return (
          <Animated.View
            key={item.icon}
            style={[styles.menuItem, itemStyle]}
          >
            <TouchableOpacity style={[styles.menuButton, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon as any} size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main Button */}
      <TouchableOpacity onPress={toggleMenu} style={styles.mainButton}>
        <BlurView intensity={90} style={StyleSheet.absoluteFillObject} />
        <Animated.View style={mainButtonStyle}>
          <Ionicons name="add" size={32} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
  },
  mainButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary + 'E6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  menuItem: {
    position: 'absolute',
    bottom: 0,
  },
  menuButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
