import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import { GlassmorphicCard } from './GlassmorphicCard';
import { AnimatedGradient } from './AnimatedGradient';

interface FeedPost {
  id: string;
  userInfo: {
    name: string;
    profilePhoto: string;
    sport: string;
    location?: string;
    timeOfPost: string;
  };
  postContent: {
    text: string;
    media?: string;
    aiVerified: boolean;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

interface FeedPostItemProps {
  item: FeedPost;
  index: number;
}

export const FeedPostItem: React.FC<FeedPostItemProps> = ({ item, index }) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const rotateX = useRef(new Animated.Value(-15)).current;
  
  // Animation for engagement buttons
  const likeScale = useRef(new Animated.Value(1)).current;
  const [liked, setLiked] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1000,
        delay: 300 + index * 150,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        delay: 300 + index * 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay: 300 + index * 150,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(rotateX, {
        toValue: 0,
        duration: 1000,
        delay: 300 + index * 150,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  const handleLike = () => {
    setLiked(!liked);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
        toValue: 1.2,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [
            { translateY },
            { scale },
            { perspective: 1000 },
            {
              rotateX: rotateX.interpolate({
                inputRange: [-15, 0],
                outputRange: ['-15deg', '0deg'],
              }),
            },
          ],
        },
      ]}
    >
      <GlassmorphicCard style={styles.postCard} delay={300 + index * 150}>
        <View style={styles.postHeader}>
          <TouchableOpacity style={styles.profileContainer}>
            <Image 
              source={{ 
                uri: item.userInfo.profilePhoto,
                headers: { Accept: '*/*' }
              }} 
              style={styles.profilePhoto}
              defaultSource={require('../assets/images/icon.png')}
            />
            <View style={styles.profileRing} />
          </TouchableOpacity>
          
          <View style={styles.postUserInfo}>
            <Text style={styles.userName}>{item.userInfo.name}</Text>
            <View style={styles.userMetaContainer}>
              <Text style={styles.userMeta}>
                {item.userInfo.sport} • {item.userInfo.location}
              </Text>
              <Text style={styles.timeText}>{item.userInfo.timeOfPost}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.postText}>{item.postContent.text}</Text>
        
        {item.postContent.aiVerified && (
          <Animated.View style={styles.aiVerifiedContainer}>
            <AnimatedGradient
              colors={[Theme.colors.success, Theme.colors.secondary]}
              style={styles.aiVerifiedBadge}
            >
              <Ionicons name="shield-checkmark" size={16} color={Theme.colors.text} />
              <Text style={styles.aiVerifiedText}>AI Verified Performance</Text>
              <View style={styles.verifiedGlow} />
            </AnimatedGradient>
          </Animated.View>
        )}
        
        {item.postContent.media && (
          <TouchableOpacity style={styles.mediaContainer}>
            <AnimatedGradient
              colors={Theme.colors.gradient.secondary}
              style={styles.mediaGradient}
            >
              <View style={styles.playButtonContainer}>
                <Ionicons name="play" size={32} color={Theme.colors.text} />
              </View>
            </AnimatedGradient>
            <View style={styles.mediaDuration}>
              <Text style={styles.durationText}>2:45</Text>
            </View>
          </TouchableOpacity>
        )}
        
        <View style={styles.engagementContainer}>
          <TouchableOpacity 
            style={styles.engagementButton}
            onPress={handleLike}
          >
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={24} 
                color={liked ? Theme.colors.error : Theme.colors.text} 
              />
            </Animated.View>
            <Text style={[
              styles.engagementCount,
              liked && { color: Theme.colors.error }
            ]}>
              {item.engagement.likes + (liked ? 1 : 0)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="chatbubble-outline" size={22} color={Theme.colors.text} />
            <Text style={styles.engagementCount}>{item.engagement.comments}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="share-social-outline" size={22} color={Theme.colors.text} />
            <Text style={styles.engagementCount}>{item.engagement.shares}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="bookmark-outline" size={22} color={Theme.colors.text} />
          </TouchableOpacity>
        </View>
      </GlassmorphicCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    marginBottom: Theme.spacing.xl,
    padding: Theme.spacing.xl,
    overflow: 'visible',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  profileContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: Theme.spacing.md,
  },
  profileRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    marginRight: Theme.spacing.md,
  },
  postUserInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  userMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  timeText: {
    fontSize: 12,
    color: Theme.colors.primary,
    marginLeft: Theme.spacing.sm,
  },
  moreButton: {
    padding: Theme.spacing.sm,
  },
  postText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
    marginBottom: Theme.spacing.lg,
    fontWeight: '500',
  },
  aiVerifiedContainer: {
    marginBottom: Theme.spacing.lg,
  },
  aiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm + 2,
    borderRadius: Theme.borderRadius.full,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  aiVerifiedText: {
    fontSize: 13,
    color: Theme.colors.text,
    marginLeft: Theme.spacing.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verifiedGlow: {
    position: 'absolute',
    top: 0,
    right: -50,
    width: 100,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ skewX: '-20deg' }],
  },
  mediaContainer: {
    height: 220,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: Theme.spacing.lg,
    position: 'relative',
  },
  mediaGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  mediaDuration: {
    position: 'absolute',
    bottom: Theme.spacing.md,
    right: Theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  durationText: {
    color: Theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  engagementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    padding: Theme.spacing.xs,
  },
  engagementCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
});
