import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface GradientViewProps {
  colors: string[];
  style?: ViewStyle;
  children?: React.ReactNode;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export const GradientView: React.FC<GradientViewProps> = ({ 
  colors, 
  style, 
  children,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 }
}) => {
  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: colors[0] }
        ]} 
      />
      {colors.length > 1 && (
        <View 
          style={[
            StyleSheet.absoluteFillObject,
            { 
              backgroundColor: colors[colors.length - 1], 
              opacity: 0.5 
            }
          ]} 
        />
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  }
});
