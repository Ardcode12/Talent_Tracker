import { LinearGradient } from '../components/SafeLinearGradient';
import React, { useRef, useEffect, useState, useCallback } from 'react';

import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';
import { GlassmorphicCard } from '../components/GlassmorphicCard';
import { ScrollAnimatedView } from '../components/ScrollAnimatedView';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
import { FloatingActionMenu } from '../components/FloatingActionMenu';
import { 
  getFeedPosts, 
  getTrendingAthletes, 
  getAnnouncements, 
  getUserStats,
  likePost,
  unlikePost,
  getPerformanceData,
  getSuggestedConnections,
  sendConnectionRequest,
  getImageUrl  // Add this import
} from '../services/api';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

// Create animated components
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

interface FeedPost {
  id: string;
  user: {
    id: string;
    name: string;
    profile_photo?: string;
    sport?: string;
    location?: string;
  };
  content: {
    text: string;
    media_url?: string;
    media_type?: string;
  };
  is_ai_verified: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked: boolean;
  created_at: string;
}

export default function HomeScreen({ navigation }) {
  const { scrollY, handleScroll, createScrollAnimation } = useScrollAnimations();
  const [feedData, setFeedData] = useState<FeedPost[]>([]);
  const [trendingAthletes, setTrendingAthletes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [suggestedConnections, setSuggestedConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [
        feedResponse, 
        athletesResponse, 
        announcementsResponse, 
        statsResponse,
        performanceResponse,
        connectionsResponse
      ] = await Promise.all([
        getFeedPosts(1, 10),
        getTrendingAthletes(),
        getAnnouncements(),
        getUserStats(),
        getPerformanceData('week'),
        getSuggestedConnections()
      ]);

      setFeedData(feedResponse.data || []);
      setTrendingAthletes(athletesResponse.data || []);
      setAnnouncements(announcementsResponse.data || []);
      setUserStats(statsResponse.data || null);
      setPerformanceData(performanceResponse.data || []);
      setSuggestedConnections(connectionsResponse.data || []);
      setHasMore(feedResponse.data?.length >= 10);
    } catch (err) {
      setError(err.message);
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPage(1);
    await loadInitialData();
    setIsRefreshing(false);
  }, []);

  const loadMorePosts = async () => {
    if (!hasMore || isLoading) return;

    try {
      const nextPage = page + 1;
      const response = await getFeedPosts(nextPage, 10);
      
      if (response.data?.length > 0) {
        setFeedData(prev => [...prev, ...response.data]);
        setPage(nextPage);
        setHasMore(response.data.length >= 10);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more posts:', err);
    }
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      
      // Update local state
      setFeedData(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              is_liked: !isLiked,
              likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1
            }
          : post
      ));
    } catch (err) {
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleConnect = async (userId: string) => {
    try {
      await sendConnectionRequest(userId);
      Alert.alert('Success', 'Connection request sent!');
      
      // Remove from suggestions
      setSuggestedConnections(prev => prev.filter(conn => conn.id !== userId));
    } catch (err) {
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const headerOpacity = createScrollAnimation({
    inputRange: [0, 100],
    outputRange: [0, 1],
  });

  const renderTopNavigation = () => (
    <View style={styles.navigationBar}>
      <View style={styles.navContent}>
        <Text style={styles.appName}>Talent Tracker</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
          <Text style={styles.searchPlaceholder}></Text>
        </View>
        
        <View style={styles.navIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="chatbubble-outline" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderUserGreeting = () => (
    <View style={styles.greetingContainer}>
      <View style={styles.greetingCard}>
        <Text style={styles.greetingText}>Hi, {userStats?.name || 'Athlete'}! Keep pushing your limits 💪</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statCard, { backgroundColor: Theme.colors.accent + '20' }]}>
              <Text style={styles.statIcon}>🥇</Text>
              <Text style={[styles.statValue, { color: Theme.colors.accent }]}>
                {userStats?.nationalRank ? `#${userStats.nationalRank}` : '--'}
              </Text>
              <Text style={styles.statLabel}>National Rank</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statCard, { backgroundColor: Theme.colors.primary + '20' }]}>
              <Text style={styles.statIcon}>🧠</Text>
              <Text style={[styles.statValue, { color: Theme.colors.primary }]}>
                {userStats?.aiScore ? `${userStats.aiScore}%` : '--'}
              </Text>
              <Text style={styles.statLabel}>AI Score</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statCard, { backgroundColor: Theme.colors.success + '20' }]}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={[styles.statValue, { color: Theme.colors.success }]}>
                {userStats?.weeklyProgress ? `+${userStats.weeklyProgress}%` : '+0%'}
              </Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPostInput = () => (
    <TouchableOpacity 
      style={styles.postInputWrapper}
      onPress={() => navigation.navigate('CreatePost')}
    >
      <View style={styles.postInput}>
        <View style={styles.postInputContent}>
          <Image
            source={{ uri: userStats?.profilePhoto || 'https://randomuser.me/api/portraits/men/1.jpg' }}
            style={styles.postInputAvatar}
          />
          <Text style={styles.postInputText}>Share your performance, achievement or update...</Text>
        </View>
        
        <View style={styles.postInputActions}>
          <TouchableOpacity style={styles.postInputAction}>
            <Ionicons name="image" size={20} color={Theme.colors.primary} />
            <Text style={styles.postInputActionText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postInputAction}>
            <Ionicons name="videocam" size={20} color={Theme.colors.secondary} />
            <Text style={styles.postInputActionText}>Video</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // New Assessment Section
  const renderAssessmentSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎯 AI Performance Assessment</Text>
      
      <TouchableOpacity 
        style={styles.assessmentCard}
        onPress={() => navigation.navigate('Assessment')}
      >
        <LinearGradient
          colors={[Theme.colors.primary, Theme.colors.secondary]}
          style={styles.assessmentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.assessmentContent}>
            <View style={styles.assessmentLeft}>
              <Text style={styles.assessmentTitle}>Get Your AI Score</Text>
              <Text style={styles.assessmentDescription}>
                Analyze your performance with our advanced AI system
              </Text>
              <View style={styles.assessmentFeatures}>
                <View style={styles.assessmentFeature}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.assessmentFeatureText}>Video Analysis</Text>
                </View>
                <View style={styles.assessmentFeature}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.assessmentFeatureText}>Instant Results</Text>
                </View>
                <View style={styles.assessmentFeature}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.assessmentFeatureText}>Expert Tips</Text>
                </View>
              </View>
            </View>
            <View style={styles.assessmentRight}>
              <View style={styles.assessmentIconContainer}>
                <FontAwesome5 name="brain" size={48} color="#fff" />
              </View>
              <Text style={styles.assessmentCTA}>Start Now →</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick Assessment Actions */}
      <View style={styles.quickAssessmentActions}>
        <TouchableOpacity 
          style={styles.quickAssessmentButton}
          onPress={() => navigation.navigate('UploadVideo')}
        >
          <Ionicons name="videocam" size={24} color={Theme.colors.primary} />
          <Text style={styles.quickAssessmentText}>Upload Video</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickAssessmentButton}
          onPress={() => navigation.navigate('ViewReports')}
        >
          <Ionicons name="document-text" size={24} color={Theme.colors.secondary} />
          <Text style={styles.quickAssessmentText}>View Reports</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickAssessmentButton}
          onPress={() => navigation.navigate('LiveAssessment')}
        >
          <Ionicons name="camera" size={24} color={Theme.colors.accent} />
          <Text style={styles.quickAssessmentText}>Live Analysis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeedPost = ({ item }: { item: FeedPost }) => {
    // Debug log for image URLs
    console.log('Post media URL:', item.content.media_url);
    console.log('User profile photo:', item.user.profile_photo);
    
    return (
      <View style={styles.postContainer}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <TouchableOpacity 
              style={styles.profileContainer}
              onPress={() => navigation.navigate('Profile', { userId: item.user.id })}
            >
              <Image 
                source={{ uri: item.user.profile_photo || 'https://randomuser.me/api/portraits/men/1.jpg' }} 
                style={styles.profilePhoto}
                onError={(e) => console.log('Profile image error:', e.nativeEvent.error)}
              />
              {item.is_ai_verified && (
                <View style={styles.verifiedIndicator}>
                  <Ionicons name="checkmark" size={10} color={Theme.colors.text} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.postUserInfo}>
              <Text style={styles.userName}>{item.user.name}</Text>
              <Text style={styles.userMeta}>
                {item.user.sport || 'Athlete'} • {item.user.location || 'India'} • {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="ellipsis-vertical" size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.postText}>{item.content.text}</Text>
          
          {item.is_ai_verified && (
            <View style={styles.aiVerifiedBadge}>
              <LinearGradient
                colors={[Theme.colors.verified, Theme.colors.success]}
                style={styles.aiVerifiedGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="shield-checkmark" size={16} color="#fff" />
                <Text style={styles.aiVerifiedText}>AI Verified Performance</Text>
              </LinearGradient>
            </View>
          )}
          
          {item.content.media_url && (
            <TouchableOpacity style={styles.mediaPlaceholder}>
              <Image 
                source={{ uri: item.content.media_url }} 
                style={styles.postMedia}
                onError={(e) => console.log('Post media error:', e.nativeEvent.error)}
                resizeMode="cover"
              />
              {item.content.media_type === 'video' && (
                <View style={styles.playButton}>
                  <Ionicons name="play" size={32} color={Theme.colors.text} />
                </View>
              )}
            </TouchableOpacity>
          )}
          
          <View style={styles.engagementContainer}>
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={() => handleLikePost(item.id, item.is_liked)}
            >
              <Ionicons 
                name={item.is_liked ? "heart" : "heart-outline"} 
                size={24} 
                color={item.is_liked ? Theme.colors.accent : Theme.colors.text} 
              />
              <Text style={styles.engagementCount}>{item.likes_count}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={() => navigation.navigate('Comments', { postId: item.id })}
            >
              <Ionicons name="chatbubble-outline" size={22} color={Theme.colors.text} />
              <Text style={styles.engagementCount}>{item.comments_count}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="share-outline" size={22} color={Theme.colors.text} />
              <Text style={styles.engagementCount}>{item.shares_count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendingAthletes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔥 Trending Athletes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TrendingAthletes')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <AnimatedFlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={trendingAthletes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Theme.spacing.md }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.athleteCard}
            onPress={() => navigation.navigate('Profile', { userId: item.id })}
          >
            <View style={styles.athleteContent}>
              <Image 
                source={{ uri: item.profile_photo || 'https://randomuser.me/api/portraits/men/1.jpg' }} 
                style={styles.athletePhoto} 
              />
              <Text style={styles.athleteName}>{item.name}</Text>
              <Text style={styles.athleteSport}>{item.sport}</Text>
              <Text style={styles.athleteStat}>{item.highlight_stat}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderAnnouncements = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📢 Opportunities & Events</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {announcements.map((announcement, index) => (
          <TouchableOpacity 
            key={announcement.id || index} 
            style={styles.announcementCard}
            onPress={() => navigation.navigate('AnnouncementDetail', { announcementId: announcement.id })}
          >
            <LinearGradient
              colors={Theme.colors.gradient.premium}
              style={styles.announcementGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.announcementText}>
                {announcement.icon} {announcement.title}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSuggestedConnections = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Suggested Connections</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {suggestedConnections.map((connection) => (
          <View key={connection.id} style={styles.connectionCard}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile', { userId: connection.id })}
            >
              <View style={styles.connectionImageContainer}>
                <Image
                  source={{ uri: connection.profile_photo || 'https://randomuser.me/api/portraits/men/1.jpg' }}
                  style={styles.connectionPhoto}
                />
                {connection.is_online && <View style={styles.onlineIndicator} />}
              </View>
              <Text style={styles.connectionName}>{connection.name}</Text>
              <Text style={styles.connectionSport}>{connection.sport}</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={12} color={Theme.colors.error} />
                <Text style={styles.connectionLocation}>{connection.location || 'India'}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.connectButton}
              onPress={() => handleConnect(connection.id)}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
              <Text style={styles.connectButtonPlus}>+</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
      <Text style={styles.loadingText}>Loading your personalized feed...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={48} color={Theme.colors.error} />
      <Text style={styles.errorText}>Unable to load content</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Theme.colors.primary} />
      </View>
    );
  };

  if (isLoading && feedData.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        {renderTopNavigation()}
        {renderLoading()}
      </View>
    );
  }

  if (error && feedData.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        {renderTopNavigation()}
        {renderError()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {renderTopNavigation()}
      
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
          },
        ]}
      >
        <Text style={styles.stickyHeaderText}>AI-Sportify</Text>
      </Animated.View>
      
      <AnimatedFlatList
        data={feedData}
        renderItem={renderFeedPost}
        keyExtractor={(item) => item.id}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
            colors={[Theme.colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {renderUserGreeting()}
            {renderPostInput()}
            {renderAssessmentSection()}
            {trendingAthletes.length > 0 && renderTrendingAthletes()}
            {announcements.length > 0 && renderAnnouncements()}
            {suggestedConnections.length > 0 && renderSuggestedConnections()}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
          </View>
        }
        ListFooterComponent={renderFooter}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />
      
      <FloatingActionMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  navigationBar: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    zIndex: 100,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -1,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchPlaceholder: {
    marginLeft: Theme.spacing.sm,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  navIcons: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickyHeaderText: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  greetingContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
  },
  greetingCard: {
    padding: Theme.spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  greetingText: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xl,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  statItem: {
    flex: 1,
  },
  statCard: {
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: Theme.spacing.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: Theme.spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postInputWrapper: {
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  postInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  postInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  postInputAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  postInputText: {
    flex: 1,
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  postInputActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
  },
  postInputAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  postInputActionText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  feedList: {
    marginTop: Theme.spacing.lg,
  },
  listContent: {
    paddingBottom: 100,
  },
  postContainer: {
    marginVertical: Theme.spacing.sm,
  },
  postCard: {
    backgroundColor: 'rgba(28, 37, 65, 0.4)',
    marginHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  profileContainer: {
    position: 'relative',
    marginRight: Theme.spacing.md,
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  verifiedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.colors.verified,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background,
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
  userMeta: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  postText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
    marginBottom: Theme.spacing.md,
  },
  aiVerifiedBadge: {
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
    borderRadius: Theme.borderRadius.full,
    alignSelf: 'flex-start',
  },
  aiVerifiedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  aiVerifiedText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: Theme.spacing.xs,
    fontWeight: '600',
  },
  mediaPlaceholder: {
    height: 220,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  postMedia: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: Theme.colors.surface,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginTop: -32,
    marginLeft: -32,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  engagementContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginRight: Theme.spacing.xl,
  },
  engagementCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  section: {
    marginTop: Theme.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Theme.colors.text,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  seeAllText: {
    fontSize: 16,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  // Assessment Section Styles
  assessmentCard: {
    marginHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  assessmentGradient: {
    padding: Theme.spacing.xl,
  },
  assessmentContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assessmentLeft: {
    flex: 1,
    marginRight: Theme.spacing.lg,
  },
  assessmentTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: Theme.spacing.sm,
  },
  assessmentDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: Theme.spacing.lg,
  },
  assessmentFeatures: {
    gap: Theme.spacing.sm,
  },
  assessmentFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  assessmentFeatureText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  assessmentRight: {
    alignItems: 'center',
  },
  assessmentIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  assessmentCTA: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
    // Continue from assessmentCTA style
  quickAssessmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  quickAssessmentButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickAssessmentText: {
    marginTop: Theme.spacing.sm,
    fontSize: 12,
    color: Theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  athleteCard: {
    marginRight: Theme.spacing.md,
    width: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  athleteContent: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  athletePhoto: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: Theme.spacing.md,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  athleteName: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  athleteSport: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
  },
  athleteStat: {
    fontSize: 16,
    color: Theme.colors.accent,
    fontWeight: '700',
  },
  announcementCard: {
    marginRight: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  announcementGradient: {
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 280,
  },
  announcementText: {
    fontSize: 16,
    color: Theme.colors.text,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  horizontalScrollContent: {
    paddingLeft: Theme.spacing.md,
    paddingRight: Theme.spacing.md,
  },
  connectionCard: {
    width: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    marginRight: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  connectionImageContainer: {
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  connectionPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  connectionSport: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.xs,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  connectionLocation: {
    fontSize: 12,
    color: Theme.colors.error,
    marginLeft: 4,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.full,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  connectButtonPlus: {
    fontSize: 16,
    fontWeight: '900',
    color: Theme.colors.text,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  errorText: {
    marginTop: Theme.spacing.md,
    fontSize: 18,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
  },
  retryText: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: Theme.spacing.xxl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  footerLoader: {
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
  },
});
