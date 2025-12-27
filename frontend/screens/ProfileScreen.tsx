// frontend/screens/ProfileScreen.tsx - COMPLETE FILE

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { 
  updateProfile, 
  logout, 
  getImageUrl,
  getAssessmentStats,
  sendConnectionRequest,
  startConversation,
} from '../services/api';
import ApiService from '../services/api';
import { Theme } from '../constants/Theme';
import { GlassmorphicCard } from '../components/GlassmorphicCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// INTERFACES
// ============================================
interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  sport?: string;
  location?: string;
  age?: number;
  bio?: string;
  height?: string;
  weight?: string;
  achievements?: string;
  profile_image?: string;
  profile_photo?: string;
  ai_score?: number;
  national_rank?: number;
  experience?: number;
  is_online?: boolean;
  is_verified?: boolean;
}

interface AssessmentStats {
  total_assessments: number;
  average_score: number | null;
  current_ai_score: number | null;
  national_rank: number | null;
  total_athletes: number;
  percentile: number | null;
  by_test_type: Record<string, { count: number; average_score: number; best_score: number }>;
}

interface ConnectionStats {
  total: number;
  pending: number;
}

interface UserPost {
  id: string;
  text: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get params safely
  const routeParams = route?.params as { userId?: number; athleteId?: number; athlete?: any } | undefined;
  const viewingUserId = routeParams?.userId || routeParams?.athleteId || null;
  const passedAthleteData = routeParams?.athlete || null;
  
  // State
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [modalVisible, setModalVisible] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  
  const [assessmentStats, setAssessmentStats] = useState<AssessmentStats | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({ total: 0, pending: 0 });
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [tempBio, setTempBio] = useState('');
  const [tempInfo, setTempInfo] = useState({ age: '', height: '', weight: '', location: '' });
  const [tempAchievements, setTempAchievements] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);

  // ============================================
  // LOAD DATA ON FOCUS
  // ============================================
  useFocusEffect(
    useCallback(() => {
      console.log('=== ProfileScreen Focus ===');
      console.log('viewingUserId:', viewingUserId);
      
      const determineProfileOwnership = async () => {
        try {
          setLoading(true);
          
          const userStr = await AsyncStorage.getItem('userData');
          if (!userStr) {
            setLoading(false);
            return;
          }
          
          const currentUser = JSON.parse(userStr);
          setCurrentUserId(currentUser.id);
          
          // If NO viewingUserId is passed, it's OWN profile
          if (!viewingUserId) {
            console.log('>>> Loading OWN profile');
            setIsOwnProfile(true);
            await loadOwnProfile(currentUser);
          } else if (viewingUserId === currentUser.id) {
            console.log('>>> Loading OWN profile (ID match)');
            setIsOwnProfile(true);
            await loadOwnProfile(currentUser);
          } else {
            console.log('>>> Loading OTHER user profile:', viewingUserId);
            setIsOwnProfile(false);
            await loadOtherUserProfile(viewingUserId);
          }
          
        } catch (error) {
          console.error('Error:', error);
        } finally {
          setLoading(false);
        }
      };
      
      determineProfileOwnership();
    }, [viewingUserId])
  );

  // ============================================
  // LOAD OWN PROFILE
  // ============================================
  const loadOwnProfile = async (currentUser: any) => {
    try {
      setUserData(currentUser);
      
      if (currentUser.profile_image || currentUser.profile_photo) {
        setProfileImage(getImageUrl(currentUser.profile_image || currentUser.profile_photo));
      }
      
      setTempBio(currentUser.bio || '');
      setTempInfo({
        age: currentUser.age?.toString() || '',
        height: currentUser.height || '',
        weight: currentUser.weight || '',
        location: currentUser.location || '',
      });
      setTempAchievements(currentUser.achievements || '');
      
      await Promise.all([
        loadOwnAssessmentStats(),
        loadOwnConnectionStats(),
        loadOwnPosts(),
      ]);
    } catch (error) {
      console.error('Error loading own profile:', error);
    }
  };

  const loadOwnAssessmentStats = async () => {
    try {
      const stats = await getAssessmentStats();
      if (stats) setAssessmentStats(stats);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadOwnConnectionStats = async () => {
    try {
      const [conn, req] = await Promise.all([
        ApiService.makeAuthenticatedRequest('/connections'),
        ApiService.makeAuthenticatedRequest('/connections/requests'),
      ]);
      setConnectionStats({
        total: conn?.data?.length || 0,
        pending: req?.data?.length || 0,
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadOwnPosts = async () => {
    try {
      setPostsLoading(true);
      const response = await ApiService.makeAuthenticatedRequest('/posts/my-posts?limit=50');
      if (response?.data && Array.isArray(response.data)) {
        setUserPosts(response.data.map((post: any) => ({
          id: String(post.id),
          text: post.text || post.content?.text || '',
          media_url: post.media_url || post.content?.media_url || null,
          media_type: post.media_type || post.content?.media_type || null,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          created_at: post.created_at || new Date().toISOString(),
        })));
      }
    } catch (error) {
      console.error('Error:', error);
      setUserPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  // ============================================
  // LOAD OTHER USER PROFILE
  // ============================================
  const loadOtherUserProfile = async (userId: number) => {
    try {
      if (passedAthleteData) {
        setUserData({
          id: passedAthleteData.id,
          name: passedAthleteData.name,
          email: passedAthleteData.email || '',
          phone: passedAthleteData.phone,
          role: passedAthleteData.role || 'athlete',
          sport: passedAthleteData.sport,
          location: passedAthleteData.location,
          age: passedAthleteData.age,
          bio: passedAthleteData.bio,
          height: passedAthleteData.height,
          weight: passedAthleteData.weight,
          achievements: passedAthleteData.achievements,
          profile_image: passedAthleteData.profile_photo,
          profile_photo: passedAthleteData.profile_photo,
          ai_score: passedAthleteData.ai_score,
          national_rank: passedAthleteData.national_rank,
          is_online: passedAthleteData.is_online,
          is_verified: passedAthleteData.is_verified,
        });
        setProfileImage(passedAthleteData.profile_photo);
        setConnectionStatus(passedAthleteData.connection_status || null);
      }
      
      const response = await ApiService.makeAuthenticatedRequest(`/users/${userId}`);
      
      if (response?.user) {
        const user = response.user;
        setUserData({
          id: user.id,
          name: user.name,
          email: user.email || '',
          phone: user.phone,
          role: user.role || 'athlete',
          sport: user.sport,
          location: user.location,
          age: user.age,
          bio: user.bio,
          height: user.height,
          weight: user.weight,
          achievements: user.achievements,
          profile_image: user.profile_photo || user.profile_image,
          profile_photo: user.profile_photo,
          ai_score: user.ai_score,
          national_rank: user.national_rank,
          is_online: user.is_online,
          is_verified: user.is_verified,
        });
        
        if (user.profile_photo || user.profile_image) {
          setProfileImage(getImageUrl(user.profile_photo || user.profile_image));
        }
        
        setConnectionStatus(response.connection_status || null);
        
        if (user.connection_count !== undefined) {
          setConnectionStats(prev => ({ ...prev, total: user.connection_count }));
        }
      }
      
      await Promise.all([
        loadOtherUserPosts(userId),
        loadOtherUserAssessmentStats(userId),
      ]);
      
    } catch (error) {
      console.error('Error:', error);
      if (!passedAthleteData) {
        Alert.alert('Error', 'Failed to load profile');
        navigation.goBack();
      }
    }
  };

  const loadOtherUserPosts = async (userId: number) => {
    try {
      setPostsLoading(true);
      const response = await ApiService.makeAuthenticatedRequest(`/posts/user/${userId}?limit=20`);
      if (response?.data && Array.isArray(response.data)) {
        setUserPosts(response.data.map((post: any) => ({
          id: String(post.id),
          text: post.text || post.content?.text || '',
          media_url: post.media_url || post.content?.media_url || null,
          media_type: post.media_type || post.content?.media_type || null,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          created_at: post.created_at || new Date().toISOString(),
        })));
      } else {
        setUserPosts([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setUserPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadOtherUserAssessmentStats = async (userId: number) => {
    try {
      const response = await ApiService.makeAuthenticatedRequest(`/assessments/user/${userId}/stats`);
      if (response) {
        setAssessmentStats(response);
      } else {
        setAssessmentStats({
          total_assessments: 0,
          average_score: null,
          current_ai_score: null,
          national_rank: null,
          total_athletes: 0,
          percentile: null,
          by_test_type: {}
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ============================================
  // HANDLERS
  // ============================================
  const onRefresh = async () => {
    setRefreshing(true);
    if (isOwnProfile) {
      const userStr = await AsyncStorage.getItem('userData');
      if (userStr) await loadOwnProfile(JSON.parse(userStr));
    } else if (viewingUserId) {
      await loadOtherUserProfile(viewingUserId);
    }
    setRefreshing(false);
  };

  const handleConnect = async () => {
    if (!userData?.id) return;
    try {
      setSendingRequest(true);
      await sendConnectionRequest(userData.id);
      setConnectionStatus('pending');
      Alert.alert('Success', 'Connection request sent!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleMessage = async () => {
    if (!userData?.id) return;
    try {
      const response = await startConversation(userData.id);
      navigation.navigate('ChatScreen' as never, {
        conversationId: response.conversation_id,
        otherUser: userData
      } as never);
    } catch (error) {
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setTempProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!userData) return;
    try {
      setSaving(true);
      
      const formData = new FormData();
      formData.append('userId', userData.id.toString());
      formData.append('age', tempInfo.age || '0');
      formData.append('location', tempInfo.location || '');
      formData.append('bio', tempBio);
      formData.append('height', tempInfo.height || '');
      formData.append('weight', tempInfo.weight || '');
      formData.append('achievements', tempAchievements);

      if (tempProfileImage) {
        formData.append('profileImage', {
          uri: tempProfileImage,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);
      }

      const response = await updateProfile(formData);

      if (response.user) {
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        setUserData(response.user);
        setProfileImage(getImageUrl(response.user.profile_image));
        Alert.alert('Success', 'Profile updated!');
        setModalVisible(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  const openEditModal = () => {
    setTempBio(userData?.bio || '');
    setTempInfo({
      age: userData?.age?.toString() || '',
      height: userData?.height || '',
      weight: userData?.weight || '',
      location: userData?.location || '',
    });
    setTempAchievements(userData?.achievements || '');
    setTempProfileImage(null);
    setModalVisible(true);
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const parseAchievements = (achievements: string): string[] => {
    if (!achievements) return [];
    try {
      const parsed = JSON.parse(achievements);
      if (Array.isArray(parsed)) return parsed.filter(a => a && a.trim());
    } catch {
      return achievements.split('\n').filter(a => a && a.trim());
    }
    return [];
  };

  const getTestTypeIcon = (testType: string): string => {
    const icons: Record<string, string> = {
      'shuttle_run': 'directions-run',
      'vertical_jump': 'trending-up',
      'squats': 'fitness-center',
      'height_detection': 'height',
    };
    return icons[testType] || 'sports';
  };

  const getTestTypeColor = (testType: string): string => {
    const colors: Record<string, string> = {
      'shuttle_run': '#FF6B6B',
      'vertical_jump': '#4ECDC4',
      'squats': '#45B7D1',
      'height_detection': '#F7DC6F',
    };
    return colors[testType] || Theme.colors.primary;
  };

  const formatTestTypeName = (testType: string): string => {
    return testType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // ============================================
  // RENDER: Profile Header
  // ============================================
  const renderProfileHeader = () => (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.profileHeader}>
      <LinearGradient
        colors={[Theme.colors.primary + '30', Theme.colors.secondary + '20', 'transparent']}
        style={styles.headerGradient}
      />
      
      {/* Back Button for External Profiles */}
      {!isOwnProfile && (
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
      )}
      
      <View style={styles.profileImageContainer}>
        <Image
          source={{ uri: profileImage || 'https://via.placeholder.com/120' }}
          style={styles.profileImage}
        />
        {userData?.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={24} color={Theme.colors.success} />
          </View>
        )}
        {userData?.is_online && <View style={styles.onlineBadge} />}
      </View>
      
      <Text style={styles.userName}>{userData?.name || 'User'}</Text>
      <Text style={styles.userRole}>
        {userData?.role?.charAt(0).toUpperCase() + (userData?.role?.slice(1) || '')} 
        {userData?.sport ? ` • ${userData.sport}` : ''}
      </Text>
      
      {userData?.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={Theme.colors.textSecondary} />
          <Text style={styles.locationText}>{userData.location}</Text>
        </View>
      )}
      
      {userData?.bio && <Text style={styles.bioText}>{userData.bio}</Text>}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {userData?.ai_score?.toFixed(0) || assessmentStats?.current_ai_score?.toFixed(0) || '--'}%
          </Text>
          <Text style={styles.statLabel}>AI Score</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            #{userData?.national_rank || assessmentStats?.national_rank || '--'}
          </Text>
          <Text style={styles.statLabel}>Rank</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{connectionStats.total}</Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{userPosts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>

      {/* Action Buttons */}
      {isOwnProfile ? (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Share', 'Coming soon!')}>
            <Ionicons name="share-social-outline" size={20} color={Theme.colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.externalActionButtons}>
          {connectionStatus === 'accepted' ? (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#2ecc71" />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          ) : connectionStatus === 'pending' ? (
            <View style={styles.pendingBadge}>
              <Ionicons name="hourglass" size={18} color="#f39c12" />
              <Text style={styles.pendingText}>Request Pending</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={sendingRequest}>
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.connectButtonText}>Connect</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <Ionicons name="chatbubble" size={18} color={Theme.colors.primary} />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Tabs
  // ============================================
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid-outline' },
    { id: 'assessments', label: 'Assessments', icon: 'analytics-outline' },
    { id: 'posts', label: 'Posts', icon: 'newspaper-outline' },
    { id: 'info', label: 'Info', icon: 'person-outline' },
  ];

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={18} 
              color={activeTab === tab.id ? Theme.colors.primary : Theme.colors.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ============================================
  // RENDER: Overview Tab
  // ============================================
  const renderOverviewTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      {/* AI Score Card */}
      <GlassmorphicCard style={styles.scoreCard}>
        <LinearGradient
          colors={[Theme.colors.primary, Theme.colors.secondary]}
          style={styles.scoreCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.scoreCardContent}>
            <View>
              <Text style={styles.scoreCardTitle}>
                {isOwnProfile ? 'Your AI Score' : `${userData?.name?.split(' ')[0]}'s AI Score`}
              </Text>
              <Text style={styles.scoreCardValue}>
                {userData?.ai_score?.toFixed(1) || assessmentStats?.current_ai_score?.toFixed(1) || '0'}%
              </Text>
              <Text style={styles.scoreCardSubtext}>Average of best scores per test type</Text>
            </View>
            <View style={styles.scoreCardIcon}>
              <FontAwesome5 name="brain" size={40} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>
      </GlassmorphicCard>

      {/* Quick Stats Grid */}
      <View style={styles.quickStatsGrid}>
        <View style={styles.quickStatCard}>
          <Ionicons name="trophy" size={24} color={Theme.colors.accent} />
          <Text style={styles.quickStatValue}>#{userData?.national_rank || '--'}</Text>
          <Text style={styles.quickStatLabel}>National Rank</Text>
        </View>
        
        <View style={styles.quickStatCard}>
          <Ionicons name="fitness" size={24} color={Theme.colors.primary} />
          <Text style={styles.quickStatValue}>{assessmentStats?.total_assessments || 0}</Text>
          <Text style={styles.quickStatLabel}>Assessments</Text>
        </View>
        
        <View style={styles.quickStatCard}>
          <Ionicons name="people" size={24} color={Theme.colors.secondary} />
          <Text style={styles.quickStatValue}>{connectionStats.total}</Text>
          <Text style={styles.quickStatLabel}>Connections</Text>
        </View>
        
        <View style={styles.quickStatCard}>
          <Ionicons name="star" size={24} color="#FFD700" />
          <Text style={styles.quickStatValue}>{assessmentStats?.average_score?.toFixed(0) || '--'}%</Text>
          <Text style={styles.quickStatLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Achievements */}
      {userData?.achievements && parseAchievements(userData.achievements).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Achievements</Text>
          <View style={styles.achievementsCard}>
            {parseAchievements(userData.achievements).map((achievement, index) => (
              <View key={index} style={styles.achievementItem}>
                <Text style={styles.achievementText}>{achievement}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Posts */}
      {userPosts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 Recent Posts</Text>
            <TouchableOpacity onPress={() => setActiveTab('posts')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {userPosts.slice(0, 2).map((post) => (
            <View key={post.id} style={styles.recentPostCard}>
              <Text style={styles.recentPostText} numberOfLines={2}>{post.text || 'No content'}</Text>
              <View style={styles.recentPostMeta}>
                <Text style={styles.recentPostDate}>{formatDate(post.created_at)}</Text>
                <View style={styles.recentPostStats}>
                  <Ionicons name="heart" size={12} color={Theme.colors.error} />
                  <Text style={styles.recentPostStatText}>{post.likes_count}</Text>
                  <Ionicons name="chatbubble" size={12} color={Theme.colors.textSecondary} />
                  <Text style={styles.recentPostStatText}>{post.comments_count}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Assessments Tab
  // ============================================
  const renderAssessmentsTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      {assessmentStats?.by_test_type && Object.keys(assessmentStats.by_test_type).length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>📊 Assessment Breakdown</Text>
          
          {Object.entries(assessmentStats.by_test_type).map(([testType, stats]) => (
            <View key={testType} style={styles.assessmentCard}>
              <View style={styles.assessmentHeader}>
                <View style={[styles.assessmentIconContainer, { backgroundColor: getTestTypeColor(testType) + '20' }]}>
                  <MaterialIcons name={getTestTypeIcon(testType) as any} size={24} color={getTestTypeColor(testType)} />
                </View>
                <View style={styles.assessmentInfo}>
                  <Text style={styles.assessmentName}>{formatTestTypeName(testType)}</Text>
                  <Text style={styles.assessmentCount}>{stats.count} assessment{stats.count !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.assessmentScores}>
                  <Text style={styles.bestScoreLabel}>Best</Text>
                  <Text style={[styles.bestScoreValue, { color: getTestTypeColor(testType) }]}>{stats.best_score}%</Text>
                </View>
              </View>
              
              <View style={styles.scoreBarContainer}>
                <View style={styles.scoreBarBackground}>
                  <View style={[styles.scoreBarFill, { width: `${stats.best_score}%`, backgroundColor: getTestTypeColor(testType) }]} />
                </View>
                <Text style={styles.averageScoreText}>Avg: {stats.average_score}%</Text>
              </View>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Assessments Yet</Text>
          <Text style={styles.emptyStateText}>
            {isOwnProfile ? 'Complete AI assessments to track performance' : 'No assessments completed yet'}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Posts Tab
  // ============================================
  const renderPostsTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      {postsLoading ? (
        <View style={styles.loadingStateContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingStateText}>Loading posts...</Text>
        </View>
      ) : userPosts.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>📝 Posts ({userPosts.length})</Text>
          {userPosts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postText}>{post.text || 'No content'}</Text>
              
              {post.media_url && (
                <Image source={{ uri: getImageUrl(post.media_url) || '' }} style={styles.postMedia} resizeMode="cover" />
              )}
              
              <View style={styles.postFooter}>
                <Text style={styles.postDate}>{formatDate(post.created_at)}</Text>
                <View style={styles.postStats}>
                  <View style={styles.postStat}>
                    <Ionicons name="heart" size={16} color={Theme.colors.error} />
                    <Text style={styles.postStatText}>{post.likes_count}</Text>
                  </View>
                  <View style={styles.postStat}>
                    <Ionicons name="chatbubble-outline" size={16} color={Theme.colors.textSecondary} />
                    <Text style={styles.postStatText}>{post.comments_count}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="newspaper-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
          <Text style={styles.emptyStateText}>
            {isOwnProfile ? 'Share your achievements!' : 'No posts shared yet'}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Info Tab
  // ============================================
  const renderInfoTab = () => {
    const renderInfoRow = (icon: string, label: string, value: string) => (
      <React.Fragment key={label}>
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name={icon as any} size={20} color={Theme.colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
      </React.Fragment>
    );

    return (
      <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
        <Text style={styles.sectionTitle}>👤 Personal Information</Text>
        
        <View style={styles.infoCard}>
          {isOwnProfile && renderInfoRow('mail-outline', 'Email', userData?.email || 'Not provided')}
          {isOwnProfile && renderInfoRow('call-outline', 'Phone', userData?.phone || 'Not provided')}
          {renderInfoRow('calendar-outline', 'Age', userData?.age ? `${userData.age} years` : 'Not specified')}
          {renderInfoRow('resize-outline', 'Height', userData?.height || 'Not specified')}
          {renderInfoRow('barbell-outline', 'Weight', userData?.weight || 'Not specified')}
          {renderInfoRow('location-outline', 'Location', userData?.location || 'Not specified')}
        </View>
        
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🏅 Sport Details</Text>
        <View style={styles.infoCard}>
          {renderInfoRow('trophy-outline', 'Sport', userData?.sport || 'Not specified')}
          {renderInfoRow('person-outline', 'Role', userData?.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Not specified')}
        </View>
      </Animated.View>
    );
  };

  // ============================================
  // RENDER: Edit Modal
  // ============================================
  const renderEditModal = () => (
    <Modal visible={modalVisible} animationType="slide">
      <SafeAreaView style={styles.modalContainer}>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
            <Image source={{ uri: tempProfileImage || profileImage || 'https://via.placeholder.com/120' }} style={styles.modalProfileImage} />
            <View style={styles.cameraIconOverlay}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Bio</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={tempBio}
              onChangeText={setTempBio}
              multiline
              numberOfLines={4}
              placeholder="Tell us about yourself..."
              placeholderTextColor={Theme.colors.textSecondary}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.age}
                onChangeText={(val) => setTempInfo({ ...tempInfo, age: val })}
                keyboardType="numeric"
                placeholder="Age"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
            <View style={[styles.formSection, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.location}
                onChangeText={(val) => setTempInfo({ ...tempInfo, location: val })}
                placeholder="City, State"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Height</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.height}
                onChangeText={(val) => setTempInfo({ ...tempInfo, height: val })}
                placeholder="e.g., 5'10"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
            <View style={[styles.formSection, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Weight</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.weight}
                onChangeText={(val) => setTempInfo({ ...tempInfo, weight: val })}
                placeholder="e.g., 75kg"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Achievements</Text>
            <TextInput
              style={[styles.formInput, styles.textAreaLarge]}
              value={tempAchievements}
              onChangeText={setTempAchievements}
              multiline
              numberOfLines={6}
              placeholder="🏆 List achievements (one per line)..."
              placeholderTextColor={Theme.colors.textSecondary}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
      >
        {renderProfileHeader()}
        {renderTabs()}
        
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'assessments' && renderAssessmentsTab()}
        {activeTab === 'posts' && renderPostsTab()}
        {activeTab === 'info' && renderInfoTab()}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {isOwnProfile && renderEditModal()}
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Theme.colors.textSecondary,
    fontSize: 16,
  },
  loadingStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingStateText: {
    marginTop: 12,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 40,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    padding: 2,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2ecc71',
    borderWidth: 3,
    borderColor: Theme.colors.background,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: Theme.colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    marginLeft: 4,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  bioText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Theme.colors.border,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 10,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 6,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  iconButton: {
    backgroundColor: Theme.colors.surface,
    padding: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  externalActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
  },
  messageButtonText: {
    color: Theme.colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  connectedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc7120',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    borderWidth: 2,
    borderColor: '#2ecc71',
  },
  connectedText: {
    color: '#2ecc71',
    fontWeight: '700',
    fontSize: 15,
  },
  pendingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f39c1220',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  pendingText: {
    color: '#f39c12',
    fontWeight: '700',
    fontSize: 15,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Theme.colors.primary,
  },
  tabText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: Theme.colors.primary,
  },
  tabContent: {
    paddingHorizontal: 16,
  },
  scoreCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scoreCardGradient: {
    padding: 20,
  },
  scoreCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreCardTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoreCardValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
  },
  scoreCardSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  scoreCardIcon: {
    opacity: 0.9,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 12,
  },
  seeAllText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  achievementsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  achievementItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  achievementText: {
    color: Theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  recentPostCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recentPostText: {
    color: Theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  recentPostMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  recentPostDate: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
  },
  recentPostStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentPostStatText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    marginRight: 10,
  },
  assessmentCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  assessmentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  assessmentInfo: {
    flex: 1,
  },
  assessmentName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  assessmentCount: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  assessmentScores: {
    alignItems: 'flex-end',
  },
  bestScoreLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  bestScoreValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: Theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  averageScoreText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    minWidth: 70,
  },
  postCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  postText: {
    color: Theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  postMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: Theme.colors.background,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  postDate: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: 14,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginLeft: 66,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  imagePickerContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.surface,
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 24,
    right: -4,
    backgroundColor: Theme.colors.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.background,
  },
  changePhotoText: {
    marginTop: 8,
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 18,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 140,
    textAlignVertical: 'top',
  },
});