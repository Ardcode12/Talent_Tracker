// frontend/screens/HomeScreen.tsx

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
  Share,
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { ProfessionalIcon } from '../components/ui/ProfessionalIcon';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';
import { GlassmorphicCard } from '../components/GlassmorphicCard';
import { ScrollAnimatedView } from '../components/ScrollAnimatedView';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
import { FloatingActionMenu } from '../components/FloatingActionMenu';
import SearchModal from '../components/SearchModal';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { PostOptionsModal } from '../components/PostOptionsModal';
import { 
  getFeedPosts, 
  getTrendingAthletes, 
  getAnnouncements, 
  getUserStats,
  likePost,
  unlikePost,
  getPerformanceData,
  getSuggestedConnections,
  getImageUrlWithFallback,
  sendConnectionRequest,
  getImageUrl,
  getUnreadCount,
  getNotificationCount,
  sharePost,
} from '../services/api';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

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
  is_own_post?: boolean;
  created_at: string;
}

interface UserStats {
  id: number | null;
  name: string;
  profilePhoto: string | null;
  sport?: string;
  location?: string;
  nationalRank: number | null;
  totalAthletes: number;
  aiScore: number | null;
  weeklyProgress: number;
  percentile: number | null;
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { scrollY, handleScroll, createScrollAnimation } = useScrollAnimations();
  
  // State
  const [feedData, setFeedData] = useState<FeedPost[]>([]);
  const [trendingAthletes, setTrendingAthletes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [suggestedConnections, setSuggestedConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Search & Notifications state
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Post Options Modal state
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showPostOptions, setShowPostOptions] = useState(false);

  useEffect(() => {
    loadInitialData();
    loadCounts();
    
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCounts = async () => {
    try {
      const [notifCount, msgCount] = await Promise.all([
        getNotificationCount(),
        getUnreadCount()
      ]);
      setNotificationCount(notifCount);
      setMessageCount(msgCount);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

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
      
      if (statsResponse.data?.id) {
        setCurrentUserId(statsResponse.data.id);
      }
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
    await loadCounts();
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
      setSuggestedConnections(prev => prev.filter(conn => conn.id !== userId));
    } catch (err) {
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  // Handle post deletion from modal
  const handlePostDeleted = (postId: string) => {
    setFeedData(prev => prev.filter(post => post.id !== postId));
  };

  // Handle share post
  const handleSharePost = async (post: FeedPost) => {
    try {
      const shareLink = `https://talenttracker.app/post/${post.id}`;
      
      const result = await Share.share({
        message: Platform.OS === 'ios' 
          ? post.content.text 
          : `${post.content.text}\n\n${shareLink}`,
        url: Platform.OS === 'ios' ? shareLink : undefined,
        title: `Post by ${post.user.name}`,
      });

      // Track share if successful
      if (result.action === Share.sharedAction) {
        try {
          await sharePost(post.id, 'external');
          // Update local share count
          setFeedData(prev => prev.map(p => 
            p.id === post.id 
              ? { ...p, shares_count: p.shares_count + 1 }
              : p
          ));
        } catch (e) {
          // Silently fail tracking
        }
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Handle edit post
  const handleEditPost = (postId: string) => {
    const post = feedData.find(p => p.id === postId);
    if (post) {
      navigation.navigate('EditPost', { 
        postId,
        currentText: post.content.text 
      });
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

  // ==========================================
  // RENDER: TOP NAVIGATION
  // ==========================================
  const renderTopNavigation = () => (
    <View style={[styles.navigationBar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.navContent}>
        <Text style={styles.appName}>TalentTracker</Text>
        
        {/* Search Button */}
        <TouchableOpacity 
          style={styles.searchContainer}
          onPress={() => setShowSearch(true)}
          activeOpacity={0.7}
        >
          <ProfessionalIcon name="search" size={20} color={Theme.colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search</Text>
        </TouchableOpacity>
        
        <View style={styles.navIcons}>
          {/* Notifications */}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowNotifications(true)}
          >
            <ProfessionalIcon name="notifications-outline" size={24} color={Theme.colors.text} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Messages */}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Messages')}
          >
            <ProfessionalIcon name="chatbubble-outline" size={24} color={Theme.colors.text} />
            {messageCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {messageCount > 9 ? '9+' : messageCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ==========================================
  // RENDER: USER GREETING WITH STATS
  // ==========================================
  const renderUserGreeting = () => (
    <View style={styles.greetingContainer}>
      <View style={styles.greetingCard}>
        {/* Profile Row */}
        <View style={styles.profileRow}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileTouchable}
          >
            <Image
              source={{ 
                uri: getImageUrlWithFallback(userStats?.profilePhoto, userStats?.name || 'Athlete')
              }}
              style={styles.greetingAvatar}
            />
            <View style={styles.onlineIndicatorSmall} />
          </TouchableOpacity>
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingText}>
              Hi, {userStats?.name || 'Athlete'}! 👋
            </Text>
            <Text style={styles.greetingSubtext}>
              {userStats?.sport ? `${userStats.sport} Athlete` : 'Keep pushing your limits'}
            </Text>
          </View>
        </View>
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {/* National Rank */}
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Rankings')}
          >
            <View style={[styles.statCard, { backgroundColor: Theme.colors.accent + '20' }]}>
              <Text style={styles.statIcon}>🥇</Text>
              <Text style={[styles.statValue, { color: Theme.colors.accent }]}>
                {userStats?.nationalRank ? `#${userStats.nationalRank}` : '--'}
              </Text>
              <Text style={styles.statLabel}>National Rank</Text>
              {userStats?.totalAthletes > 0 && (
                <Text style={styles.statSubLabel}>
                  of {userStats.totalAthletes}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          
          {/* AI Score */}
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Assessments')}
          >
            <View style={[styles.statCard, { backgroundColor: Theme.colors.primary + '20' }]}>
              <Text style={styles.statIcon}>🧠</Text>
              <Text style={[styles.statValue, { color: Theme.colors.primary }]}>
                {userStats?.aiScore ? `${userStats.aiScore}%` : '--'}
              </Text>
              <Text style={styles.statLabel}>AI Score</Text>
              {userStats?.percentile !== null && userStats?.percentile !== undefined && (
                <Text style={styles.statSubLabel}>
                  Top {(100 - userStats.percentile).toFixed(0)}%
                </Text>
              )}
            </View>
          </TouchableOpacity>
          
          {/* Weekly Progress */}
          <View style={styles.statItem}>
            <View style={[styles.statCard, { backgroundColor: Theme.colors.success + '20' }]}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={[styles.statValue, { color: Theme.colors.success }]}>
                {userStats?.weeklyProgress 
                  ? `${userStats.weeklyProgress > 0 ? '+' : ''}${userStats.weeklyProgress}%` 
                  : '+0%'}
              </Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>
        </View>
        
        {/* No AI Score Message */}
        {!userStats?.aiScore && (
          <TouchableOpacity 
            style={styles.noScoreContainer}
            onPress={() => navigation.navigate('Assessments')}
          >
            <ProfessionalIcon name="analytics-outline" size={20} color={Theme.colors.primary} />
            <Text style={styles.noScoreText}>
              Complete an assessment to get your AI Score & National Rank
            </Text>
            <ProfessionalIcon name="chevron-forward" size={16} color={Theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ==========================================
  // RENDER: POST INPUT
  // ==========================================
  const renderPostInput = () => (
    <TouchableOpacity 
      style={styles.postInputWrapper}
      onPress={() => navigation.navigate('CreatePost')}
      activeOpacity={0.8}
    >
      <View style={styles.postInput}>
        <View style={styles.postInputContent}>
          <Image
            source={{ 
              uri: getImageUrlWithFallback(userStats?.profilePhoto, userStats?.name || 'Athlete')
            }}
            style={styles.postInputAvatar}
          />
          <Text style={styles.postInputText}>
            Share your performance, achievement or update...
          </Text>
        </View>
        
        <View style={styles.postInputActions}>
          <TouchableOpacity 
            style={styles.postInputAction}
            onPress={() => navigation.navigate('CreatePost', { mediaType: 'photo' })}
          >
            <ProfessionalIcon name="image" size={20} color={Theme.colors.primary} />
            <Text style={styles.postInputActionText}>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.postInputAction}
            onPress={() => navigation.navigate('CreatePost', { mediaType: 'video' })}
          >
            <ProfessionalIcon name="videocam" size={20} color={Theme.colors.secondary} />
            <Text style={styles.postInputActionText}>Video</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.postInputAction}
            onPress={() => navigation.navigate('Assessments')}
          >
            <ProfessionalIcon name="analytics" size={20} color={Theme.colors.accent} />
            <Text style={styles.postInputActionText}>AI Score</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ==========================================
  // RENDER: ASSESSMENT SECTION
  // ==========================================

  // ==========================================
  // RENDER: FEED POST
  // ==========================================
  const renderFeedPost = ({ item }: { item: FeedPost }) => {
    const isOwnPost = item.user.id.toString() === currentUserId?.toString() || item.is_own_post;
    
    return (
      <View style={styles.postContainer}>
        <View style={styles.postCard}>
          {/* Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity 
              style={styles.profileContainer}
              onPress={() => {
                if (!isOwnPost) {
                  navigation.navigate('UserProfile', { userId: parseInt(item.user.id) });
                }
              }}
            >
              <Image 
                source={{ 
                  uri: getImageUrlWithFallback(item.user.profile_photo, item.user.name) 
                }} 
                style={styles.profilePhoto}
              />
              {item.is_ai_verified && (
                <View style={styles.verifiedIndicator}>
                  <ProfessionalIcon name="checkmark" size={10} color={Theme.colors.text} />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.postUserInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{item.user.name}</Text>
                {!isOwnPost && (
                  <TouchableOpacity 
                    style={styles.miniConnectButton}
                    onPress={() => handleConnect(item.user.id)}
                  >
                    <ProfessionalIcon name="person-add" size={14} color={Theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.userMeta}>
                {item.user.sport || 'Athlete'} • {item.user.location || 'India'} • {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            
            {/* More Options Button */}
            <TouchableOpacity 
              style={styles.moreButton}
              onPress={() => {
                setSelectedPost(item);
                setShowPostOptions(true);
              }}
            >
              <ProfessionalIcon name="ellipsis-vertical" size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <Text style={styles.postText}>{item.content.text}</Text>
          
          {/* AI Verified Badge */}
          {item.is_ai_verified && (
            <View style={styles.aiVerifiedBadge}>
              <LinearGradient
                colors={[Theme.colors.success, Theme.colors.primary]}
                style={styles.aiVerifiedGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <ProfessionalIcon name="shield-checkmark" size={16} color="#fff" />
                <Text style={styles.aiVerifiedText}>AI Verified Performance</Text>
              </LinearGradient>
            </View>
          )}
          
          {/* Media */}
{item.content.media_url && (
             <TouchableOpacity style={styles.mediaPlaceholder}>
               <Image 
                 source={{ uri: item.content.media_url }} 
                 style={styles.postMedia}
                 resizeMode="cover"
               />
               {item.content.media_type === 'video' && (
                 <View style={styles.playButton}>
                   <ProfessionalIcon name="play" size={32} color={Theme.colors.text} />
                 </View>
               )}
             </TouchableOpacity>
           )}
           
           {/* Engagement */}
           <View style={styles.engagementContainer}>
             {/* Like Button */}
             <TouchableOpacity 
               style={styles.engagementButton}
               onPress={() => handleLikePost(item.id, item.is_liked)}
             >
               <ProfessionalIcon 
                 name={item.is_liked ? "heart" : "heart-outline"} 
                 size={24} 
                 color={item.is_liked ? Theme.colors.accent : Theme.colors.text} 
               />
               <Text style={[
                 styles.engagementCount,
                 item.is_liked && { color: Theme.colors.accent }
               ]}>
                 {item.likes_count}
               </Text>
             </TouchableOpacity>
             
             {/* Comment Button */}
             <TouchableOpacity 
               style={styles.engagementButton}
               onPress={() => navigation.navigate('Comments', { 
                 postId: item.id,
                 postText: item.content.text,
                 postUserName: item.user.name
               })}
             >
               <ProfessionalIcon name="chatbubble-outline" size={22} color={Theme.colors.text} />
               <Text style={styles.engagementCount}>{item.comments_count}</Text>
             </TouchableOpacity>
             
             {/* Share Button */}
             <TouchableOpacity 
               style={styles.engagementButton}
               onPress={() => handleSharePost(item)}
             >
               <ProfessionalIcon name="share-outline" size={22} color={Theme.colors.text} />
               <Text style={styles.engagementCount}>{item.shares_count}</Text>
             </TouchableOpacity>
             
             {/* Bookmark Button */}
             <TouchableOpacity style={styles.engagementButton}>
               <ProfessionalIcon name="bookmark-outline" size={22} color={Theme.colors.text} />
             </TouchableOpacity>
            </View>
         </View>
      </View>
     );
   };

  // ==========================================
  // RENDER: TRENDING ATHLETES
  // ==========================================
  const renderTrendingAthletes = () => {
    if (!trendingAthletes || trendingAthletes.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <ProfessionalIcon name="flame" size={20} color="#FF6B35" style={styles.sectionTitleIcon} />
            <Text style={styles.sectionTitle}>Trending Athletes</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TrendingAthletes')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={trendingAthletes}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={{ paddingHorizontal: Theme.spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.athleteCard}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            >
              <View style={styles.athleteContent}>
                <Image 
                  source={{ 
                    uri: getImageUrlWithFallback(item.profile_photo, item.name) 
                  }} 
                  style={styles.athletePhoto} 
                />
                <Text style={styles.athleteName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.athleteSport}>{item.sport}</Text>
                <Text style={styles.athleteStat}>{item.highlight_stat}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  // ==========================================
  // RENDER: ANNOUNCEMENTS
  // ==========================================
  const renderAnnouncements = () => {
    if (!announcements || announcements.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <ProfessionalIcon name="megaphone" size={20} color={Theme.colors.primary} style={styles.sectionTitleIcon} />
          <Text style={styles.sectionTitle}>Opportunities & Events</Text>
        </View>

        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {announcements.map((announcement, index) => (
            <TouchableOpacity 
              key={announcement.id || index} 
              style={styles.announcementCard}
              onPress={() => navigation.navigate('AnnouncementDetail', { announcementId: announcement.id })}
            >
              <LinearGradient
                colors={Theme.colors.gradient?.premium || [Theme.colors.primary, Theme.colors.secondary]}
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
  };

  // ==========================================
  // RENDER: SUGGESTED CONNECTIONS
  // ==========================================
  const renderSuggestedConnections = () => {
    if (!suggestedConnections || suggestedConnections.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <ProfessionalIcon name="people" size={20} color={Theme.colors.secondary} style={styles.sectionTitleIcon} />
            <Text style={styles.sectionTitle}>Suggested Connections</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Connections')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {suggestedConnections.map((connection) => (
            <View key={connection.id} style={styles.connectionCard}>
              <TouchableOpacity
                onPress={() => navigation.navigate('UserProfile', { userId: connection.id })}
              >
                <View style={styles.connectionImageContainer}>
                  <Image
                    source={{ 
                      uri: getImageUrlWithFallback(connection.profile_photo, connection.name) 
                    }}
                    style={styles.connectionPhoto}
                  />
                  {connection.is_online && <View style={styles.onlineIndicator} />}
                </View>
                <Text style={styles.connectionName} numberOfLines={1}>{connection.name}</Text>
                <Text style={styles.connectionSport}>{connection.sport}</Text>
                <View style={styles.locationContainer}>
                  <ProfessionalIcon name="location" size={12} color={Theme.colors.error} />
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
  };

  // ==========================================
  // RENDER: LOADING
  // ==========================================
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
      <Text style={styles.loadingText}>Loading your personalized feed...</Text>
    </View>
  );

  // ==========================================
  // RENDER: ERROR
  // ==========================================
  const renderError = () => (
    <View style={styles.errorContainer}>
      <ProfessionalIcon name="alert-circle" size={48} color={Theme.colors.error} />
      <Text style={styles.errorText}>Unable to load content</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // RENDER: FOOTER
  // ==========================================
  const renderFooter = () => {
    if (!hasMore) return (
      <View style={styles.endOfFeed}>
        <Text style={styles.endOfFeedText}>You're all caught up! 🎉</Text>
      </View>
    );
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Theme.colors.primary} />
      </View>
    );
  };

  // ==========================================
  // RENDER: EMPTY FEED
  // ==========================================
  const renderEmptyFeed = () => (
    <View style={styles.emptyFeedContainer}>
      <ProfessionalIcon name="newspaper-outline" size={64} color={Theme.colors.textSecondary} />
      <Text style={styles.emptyFeedTitle}>No posts yet</Text>
      <Text style={styles.emptyFeedText}>
        Be the first to share your achievements!
      </Text>
      <TouchableOpacity 
        style={styles.createFirstPostButton}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <ProfessionalIcon name="add" size={20} color="#fff" />
        <Text style={styles.createFirstPostText}>Create Post</Text>
      </TouchableOpacity>
    </View>
  );

  // ==========================================
  // MAIN RETURN
  // ==========================================
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
          { opacity: headerOpacity },
        ]}
      >
        <Text style={styles.stickyHeaderText}>TalentTracker</Text>
      </Animated.View>
      
      <AnimatedFlatList
        data={feedData}
        renderItem={renderFeedPost}
        keyExtractor={(item) => item.id?.toString()}
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
            {renderTrendingAthletes()}
            {renderAnnouncements()}
            {renderSuggestedConnections()}
            
            {feedData.length > 0 && (
              <View style={styles.feedHeader}>
                <Text style={styles.feedHeaderTitle}>📰 Your Feed</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={renderEmptyFeed}
        ListFooterComponent={renderFooter}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />
      
      <FloatingActionMenu />
      
      {/* Search Modal */}
      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        navigation={navigation}
      />
      
      {/* Notifications Dropdown */}
      <NotificationsDropdown
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        navigation={navigation}
        onCountChange={(count) => setNotificationCount(count)}
      />

      {/* Post Options Modal */}
      <PostOptionsModal
        visible={showPostOptions}
        onClose={() => {
          setShowPostOptions(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        currentUserId={currentUserId?.toString()}
        onPostDeleted={handlePostDeleted}
        onEditPost={(postId) => {
          // For now, show alert. You can create an EditPostScreen later
          Alert.alert('Edit Post', 'Edit feature coming soon!');
        }}
        navigation={navigation}
      />
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  navigationBar: {
    paddingBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
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
    gap: Theme.spacing.sm,
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Theme.colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 15,
    zIndex: 99,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickyHeaderText: {
    fontSize: 20,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  profileTouchable: {
    marginRight: Theme.spacing.md,
    position: 'relative',
  },
  greetingAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  onlineIndicatorSmall: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  greetingSubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 4,
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
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: Theme.spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 9,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  noScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary + '15',
    marginTop: Theme.spacing.lg,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    gap: Theme.spacing.sm,
  },
  noScoreText: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '500',
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
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  postInputText: {
    flex: 1,
    fontSize: 15,
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
    fontSize: 12,
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
    fontSize: 20,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: 0,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    gap: 8,
  },
  sectionTitleIcon: {
    marginRight: 2,
  },
  seeAllText: {
    fontSize: 14,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
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
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginBottom: Theme.spacing.sm,
  },
  assessmentDescription: {
    fontSize: 14,
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
    fontSize: 13,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
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
    fontSize: 11,
    color: Theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  athleteCard: {
    marginRight: Theme.spacing.md,
    width: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  athleteContent: {
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  athletePhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: Theme.spacing.md,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  athleteSport: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
  },
  athleteStat: {
    fontSize: 14,
    color: Theme.colors.accent,
    fontWeight: '700',
  },
  announcementCard: {
    marginRight: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginLeft: Theme.spacing.md,
  },
  announcementGradient: {
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 260,
  },
  announcementText: {
    fontSize: 15,
    color: Theme.colors.text,
    fontWeight: '700',
  },
  horizontalScrollContent: {
    paddingLeft: Theme.spacing.md,
    paddingRight: Theme.spacing.md,
  },
  connectionCard: {
    width: 150,
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
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  connectionName: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  connectionSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  connectionLocation: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
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
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  connectButtonPlus: {
    fontSize: 14,
    fontWeight: '900',
    color: Theme.colors.text,
    marginLeft: 4,
  },
  feedHeader: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.xxl,
    paddingBottom: Theme.spacing.md,
  },
  feedHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  listContent: {
    paddingBottom: 120,
  },
  postContainer: {
    marginVertical: Theme.spacing.sm,
  },
  postCard: {
    backgroundColor: 'rgba(28, 37, 65, 0.4)',
    marginHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  verifiedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  postUserInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  miniConnectButton: {
    padding: 4,
    backgroundColor: Theme.colors.primary + '20',
    borderRadius: 12,
  },
  userMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  postText: {
    fontSize: 15,
    color: Theme.colors.text,
    lineHeight: 22,
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
    fontSize: 12,
    color: '#fff',
    marginLeft: Theme.spacing.xs,
    fontWeight: '600',
  },
  mediaPlaceholder: {
    height: 250,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  postMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginTop: -30,
    marginLeft: -30,
    borderRadius: 30,
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
    padding: 4,
  },
  engagementCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 15,
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
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    marginTop: Theme.spacing.lg,
  },
  retryText: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyFeedContainer: {
    paddingVertical: Theme.spacing.xxl * 2,
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyFeedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
  },
  emptyFeedText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  createFirstPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    marginTop: Theme.spacing.xl,
    gap: 8,
  },
  createFirstPostText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLoader: {
    paddingVertical: Theme.spacing.xl,
    alignItems: 'center',
  },
  endOfFeed: {
    paddingVertical: Theme.spacing.xxl,
    alignItems: 'center',
  },
  endOfFeedText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
});