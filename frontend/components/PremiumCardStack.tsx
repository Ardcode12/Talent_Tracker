import React, { useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { Ultra3DCard } from './Ultra3DCard';
import { Theme } from '../constants/Theme';

const { width } = Dimensions.get('window');

interface CardData {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  character?: string;
}

interface PremiumCardStackProps {
  cards: CardData[];
  title?: string;
}

export const PremiumCardStack: React.FC<PremiumCardStackProps> = ({ cards, title }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width * 0.7}
      >
        {cards.map((card, index) => {
          const inputRange = [
            (index - 1) * width * 0.7,
            index * width * 0.7,
            (index + 1) * width * 0.7,
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={card.id}
              style={{
                transform: [{ scale }],
                opacity,
              }}
            >
              <Ultra3DCard
                image={card.image}
                title={card.title}
                subtitle={card.subtitle}
                character={card.character}
                index={index}
                delay={index * 100}
              />
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.lg,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.md,
  },
});
