// Add this component to components/GradientMask.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Mask } from 'react-native-svg';
import { Theme } from '../constants/Theme';

interface GradientMaskProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export const GradientMask: React.FC<GradientMaskProps> = ({ style, children }) => {
  return (
    <View style={[styles.container, style]}>
      <Svg style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Mask id="mask">
            <LinearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="white" stopOpacity="0" />
              <Stop offset="20%" stopColor="white" stopOpacity="1" />
              <Stop offset="80%" stopColor="white" stopOpacity="1" />
              <Stop offset="100%" stopColor="white" stopOpacity="0" />
            </LinearGradient>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
          </Mask>
        </Defs>
      </Svg>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
