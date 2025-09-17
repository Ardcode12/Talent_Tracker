// components/UltraAnimatedFeedPost.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  SlideInRight,
  SlideInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';

interface Props {
  post: any;
  index: number;
}

export const UltraAnimatedFeedPost: React.FC<Props> = ({ post, index }) => {
  const [liked, setLiked] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const likeScale = useSharedValue(1);
  const cardScale = useSharedValue(0.8);
  const cardRotate = useSharedValue(-5);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  React.useEffect(() => {
    cardScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
    cardRotate.value = withSpring(0, {
      damping: 15,
      stiffness: 100,
    });
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { rotate: `${cardRotate.value}deg` },
    ],
  }));

  const handleLike = () => {
    'worklet';
    likeScale.value = withSpring(0.8, {}, () => {
      likeScale.value = withSpring(1.3, {}, () => {
        likeScale.value = withSpring(1);
      });
    });
    
    // Animate floating heart
    heartScale.value = 0;
    heartOpacity.value = 1;
    heartScale.value = withSpring(3, {
      damping: 15,
      stiffness: 100,
    });
    heartOpacity.value = withTiming(0, {
      duration: 1500,
    });
    
    runOnJS(setLiked)(!liked);
    runOnJS(setShowHeart)(true);
    runOnJS(setTimeout)(() => runOnJS(setShowHeart)(false), 1500);
  };

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: heartScale.value },
      { translateY: interpolate(heartScale.value, [0, 3], [0, -100]) },
    ],
    opacity: heartOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, cardAnimatedStyle]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <BlurView intensity={20} style={styles.blurContainer}>
        {/* Animated Header */}
        <Animated.View 
          entering={SlideInRight.delay(index * 50).springify()}
          style={styles.header}
        >
          <View style={styles.userInfo}>
            <Animated.View
              entering={ZoomIn.delay(index * 50 + 100).springify()}
              style={styles.avatarContainer}
            >
              <Image source={{ uri: post.userInfo.profilePhoto }} style={styles.avatar} />
              {post.postContent.aiVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                </View>
              )}
            </Animated.View>
            
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{post.userInfo.name}</Text>
              <View style={styles.metaContainer}>
                <Text style={styles.sport}>{post.userInfo.sport}</Text>
                <View style={styles.dot} />
                <Text style={styles.location}>{post.userInfo.location}</Text>
                <View style={styles.dot} />
                <Text style={styles.time}>{post.userInfo.timeOfPost}</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
        </Animated.View>

        {/* Content */}
        <Animated.View 
          entering={FadeIn.delay(index * 50 + 200).springify()}
        >
          <Text style={styles.postText}>{post.postContent.text}</Text>
          
          {post.postContent.aiVerified && (
            <View style={styles.aiVerifiedContainer}>
              <LinearGradient
                colors={['#4ADE80', '#22C55E']}
                style={styles.aiVerifiedGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
                <Text style={styles.aiVerifiedText}>AI Verified Performance</Text>
              </LinearGradient>
            </View>
          )}
          
          {post.postContent.media && (
            <TouchableOpacity style={styles.mediaContainer}>
              <Image source={{ uri: post.postContent.media }} style={styles.media} />
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={24} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Engagement Bar */}
        <Animated.View 
          entering={SlideInUp.delay(index * 50 + 300).springify()}
          style={styles.engagementBar}
        >
          <TouchableOpacity onPress={handleLike} style={styles.engagementButton}>
            <Animated.View style={likeAnimatedStyle}>
              <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={24} 
                color={liked ? "#FF006E" : "#666"} 
              />
            </Animated.View>
            <Text style={[styles.engagementText, liked && styles.likedText]}>
              {post.engagement.likes + (liked ? 1 : 0)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#666" />
            <Text style={styles.engagementText}>{post.engagement.comments}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="share-outline" size={22} color="#666" />
            <Text style={styles.engagementText}>{post.engagement.shares}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.engagementButton, styles.saveButton]}>
            <Ionicons name="bookmark-outline" size={22} color="#666" />
          </TouchableOpacity>
        </Animated.View>
      </BlurView>

      {/* Heart Animation Overlay - Using Animated Icon instead of Lottie */}
      {showHeart && (
        <View style={styles.heartOverlay} pointerEvents="none">
          <Animated.View style={heartAnimatedStyle}>
            <Ionicons name="heart" size={80} color="#FF006E" />
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  blurContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF006E',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 2,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sport: {
    fontSize: 14,
    color: '#FF006E',
    fontWeight: '600',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#666',
    marginHorizontal: 6,
  },
  location: {
    fontSize: 14,
    color: '#8338EC',
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  moreButton: {
    padding: 4,
  },
  postText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    marginBottom: 16,
  },
  aiVerifiedContainer: {
    marginBottom: 16,
  },
  aiVerifiedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  aiVerifiedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  mediaContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: 200,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  engagementText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  likedText: {
    color: '#FF006E',
  },
  saveButton: {
    marginLeft: 'auto',
    marginRight: 0,
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
