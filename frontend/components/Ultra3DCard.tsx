import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Theme } from '../constants/Theme';
import { ScrollAnimatedView } from './ScrollAnimatedView';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = 200;

interface Ultra3DCardProps {
  image: string;
  title: string;
  subtitle: string;
  description?: string;
  index?: number;
  onPress?: () => void;
}

export const Ultra3DCard: React.FC<Ultra3DCardProps> = ({
  image,
  title,
  subtitle,
  description,
  index = 0,
  onPress,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: 1,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(animatedValue, {
      toValue: 1,
      tension: 40,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedValue, {
      toValue: 0,
      tension: 40,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const cardScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  return (
    <ScrollAnimatedView
      animation="fadeUp"
      delay={index * 150}
      style={styles.container}
    >
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { scale: Animated.multiply(cardScale, scaleValue) },
                { perspective: 1000 },
              ],
            },
          ]}
        >
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            <View style={styles.imageOverlay} />
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {description && (
              <Text style={styles.description} numberOfLines={2}>
                {description}
              </Text>
            )}
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </ScrollAnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  imageContainer: {
    width: '100%',
    height: CARD_HEIGHT * 0.6,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
});
