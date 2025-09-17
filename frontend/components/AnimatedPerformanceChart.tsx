// components/AnimatedPerformanceChart.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  data: number[];
  title: string;
}

export const AnimatedPerformanceChart: React.FC<Props> = ({ data, title }) => {
  const animations = useRef(data.map(() => new Animated.Value(0))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in the container
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Animate each bar with stagger effect
    const animationSequence = animations.map((anim, index) => 
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        delay: index * 100,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animationSequence).start();
  }, []);

  const maxValue = Math.max(...data);
  const chartHeight = 150;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Chart Container */}
      <View style={styles.chartContainer}>
        {/* Background Grid Lines */}
        <View style={styles.gridLines}>
          {[0, 25, 50, 75, 100].map((value, index) => (
            <View key={index} style={[styles.gridLine, { bottom: `${value}%` }]} />
          ))}
        </View>

        {/* Animated Bars */}
        <View style={styles.barsContainer}>
          {data.map((value, index) => {
            const barHeight = (value / maxValue) * chartHeight;
            
            return (
              <View key={index} style={styles.barWrapper}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      transform: [
                        {
                          scaleY: animations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1],
                          }),
                        },
                      ],
                      opacity: animations[index].interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.8, 1],
                      }),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[Theme.colors.primary, Theme.colors.secondary]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                </Animated.View>
                
                {/* Animated Dot on top */}
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      bottom: barHeight - 6,
                      opacity: animations[index],
                      transform: [
                        {
                          scale: animations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1.2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                
                {/* Value Label */}
                <Animated.View
                  style={[
                    styles.valueLabel,
                    {
                      bottom: barHeight + 10,
                      opacity: animations[index],
                    },
                  ]}
                >
                  <Text style={styles.valueLabelText}>{value}</Text>
                </Animated.View>
              </View>
            );
          })}
        </View>

        {/* Connect dots with lines */}
        <View style={styles.linesContainer} pointerEvents="none">
          {data.map((value, index) => {
            if (index === data.length - 1) return null;
            
            const currentHeight = (value / maxValue) * chartHeight;
            const nextHeight = (data[index + 1] / maxValue) * chartHeight;
            const lineLength = Math.sqrt(
              Math.pow(SCREEN_WIDTH / data.length, 2) + 
              Math.pow(nextHeight - currentHeight, 2)
            );
            const angle = Math.atan2(
              nextHeight - currentHeight,
              SCREEN_WIDTH / data.length
            ) * (180 / Math.PI);

            return (
              <Animated.View
                key={`line-${index}`}
                style={[
                  styles.line,
                  {
                    bottom: currentHeight - 1,
                    left: (index + 0.5) * (SCREEN_WIDTH / data.length) - 20,
                    width: lineLength,
                    transform: [
                      { rotate: `${angle}deg` },
                      {
                        scaleX: animations[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                    ],
                    opacity: animations[index],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Labels */}
      <View style={styles.labels}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <Text key={day} style={styles.label}>{day}</Text>
        ))}
      </View>

      {/* Performance Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Average</Text>
          <Text style={styles.summaryValue}>
            {Math.round(data.reduce((a, b) => a + b, 0) / data.length)}%
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Peak</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.success }]}>
            {Math.max(...data)}%
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Improvement</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.accent }]}>
            +{data[data.length - 1] - data[0]}%
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
    marginVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.lg,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chartContainer: {
    height: 180,
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    paddingHorizontal: 10,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: '60%',
    borderRadius: Theme.borderRadius.sm,
    overflow: 'hidden',
    transformOrigin: 'bottom',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.primary,
    borderWidth: 2,
    borderColor: Theme.colors.background,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  valueLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  valueLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  linesContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: Theme.colors.primary,
    opacity: 0.5,
    transformOrigin: 'left center',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
  },
});
