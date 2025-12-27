// frontend/screens/CoachDashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, FadeInRight } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../constants/Theme';
import SearchModal from '../components/SearchModal';
import {
  getCoachDashboardStats,
  getCoachAthletes,
  getCoachDashboardFeed,
  getAssessmentStatistics,
  getUnreadCount,
  getNotificationCount,
  getImageUrl,
  getAllAthletes,
  getTopAthletes,
  getActiveAthletes,
  getRisingStars,
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CoachDashboard({ navigation }) {
  // Data States
  const [stats, setStats] = useState(null);
  const [connectedAthletes, setConnectedAthletes] = useState([]);
  const [topAthletes, setTopAthletes] = useState([]);
  const [activeAthletes, setActiveAthletes] = useState([]);
  const [risingStars, setRisingStars] = useState([]);
  const [athletePosts, setAthletePosts] = useState([]);
  const [assessmentStats, setAssessmentStats] = useState(null);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadCounts();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        statsRes,
        connectedRes,
        topAthletesRes,
        activeAthletesRes,
        risingStarsRes,
        feedRes,
        assessmentStatsRes
      ] = await Promise.all([
        getCoachDashboardStats(),
        getCoachAthletes({ limit: 10 }),
        getTopAthletes(10),
        getActiveAthletes(24, 10),
        getRisingStars(30, 10),
        getCoachDashboardFeed(1, 5),
        getAssessmentStatistics(),
      ]);

      console.log('Dashboard Stats:', statsRes);
      console.log('Top Athletes:', topAthletesRes);
      console.log('Active Athletes:', activeAthletesRes);
      console.log('Rising Stars:', risingStarsRes);

      if (statsRes) setStats(statsRes);
      if (connectedRes?.data) setConnectedAthletes(connectedRes.data);
      if (topAthletesRes?.data) setTopAthletes(topAthletesRes.data);
      if (activeAthletesRes?.data) setActiveAthletes(activeAthletesRes.data);
      if (risingStarsRes?.data) setRisingStars(risingStarsRes.data);
      if (feedRes?.data) setAthletePosts(feedRes.data);
      if (assessmentStatsRes) setAssessmentStats(assessmentStatsRes);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCounts = async () => {
    try {
      const [unread, notifications] = await Promise.all([
        getUnreadCount(),
        getNotificationCount(),
      ]);
      setUnreadMessages(unread || 0);
      setNotificationCount(notifications || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardData(), loadCounts()]);
  };

  // Navigate to athlete profile
  // In CoachDashboard.tsx - Update navigateToAthleteProfile function
// In CoachDashboard.tsx - Make sure navigation uses 'UserProfile' screen

const navigateToAthleteProfile = (athlete) => {
  console.log('Navigating to athlete profile:', athlete.id, athlete.name);
  navigation.navigate('UserProfile', {
    userId: athlete.id,
    athlete: athlete
  });
};

  // Helper Functions
  const formatTestTypeName = (testType) => {
    if (!testType) return '';
    return testType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTestTypeColor = (testType) => {
    const colors = {
      shuttle_run: '#FF6B6B',
      vertical_jump: '#4ECDC4',
      squats: '#45B7D1',
      height_detection: '#F7DC6F',
    };
    return colors[testType] || Theme.colors.primary;
  };

  // ============================================
  // RENDER: Dashboard Header
  // ============================================
  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.topNav}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>{getGreeting()},</Text>
          <Text style={styles.coachNameText}>
            {stats?.coach_info?.name || 'Coach'} 👋
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={22} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {(stats?.pending_requests > 0 || notificationCount > 0) && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {(stats?.pending_requests || 0) + notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Image
              source={{
                uri: stats?.coach_info?.profile_photo || 
                     getImageUrl(stats?.coach_info?.profile_photo) || 
                     'https://via.placeholder.com/40',
              }}
              style={styles.headerAvatar}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary Cards */}
      <Animated.View 
        entering={FadeInDown.delay(200).duration(500)} 
        style={styles.statsCardsContainer}
      >
        <TouchableOpacity 
          style={styles.statsCard}
          onPress={() => navigation.navigate('Athletes')}
        >
          <View style={[styles.statsCardIcon, { backgroundColor: '#667eea20' }]}>
            <FontAwesome5 name="users" size={20} color="#667eea" />
          </View>
          <Text style={styles.statsCardNumber}>
            {stats?.connected_athletes || 0}
          </Text>
          <Text style={styles.statsCardLabel}>Connected</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statsCard}
          onPress={() => navigation.navigate('Assessments')}
        >
          <View style={[styles.statsCardIcon, { backgroundColor: '#2ecc7120' }]}>
            <Ionicons name="clipboard-outline" size={22} color="#2ecc71" />
          </View>
          <Text style={styles.statsCardNumber}>
            {stats?.total_assessments || 0}
          </Text>
          <Text style={styles.statsCardLabel}>Reviews</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statsCard}
          onPress={() => navigation.navigate('ConnectionRequests')}
        >
          <View style={[styles.statsCardIcon, { backgroundColor: '#e74c3c20' }]}>
            <Ionicons name="git-pull-request" size={22} color="#e74c3c" />
          </View>
          <Text style={styles.statsCardNumber}>
            {stats?.pending_requests || 0}
          </Text>
          <Text style={styles.statsCardLabel}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statsCard}
          onPress={() => navigation.navigate('Messages')}
        >
          <View style={[styles.statsCardIcon, { backgroundColor: '#3498db20' }]}>
            <Ionicons name="chatbubbles-outline" size={22} color="#3498db" />
          </View>
          <Text style={styles.statsCardNumber}>{unreadMessages}</Text>
          <Text style={styles.statsCardLabel}>Messages</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ============================================
  // RENDER: Quick Actions
  // ============================================
  const renderQuickActions = () => (
    <Animated.View 
      entering={FadeInDown.delay(300).duration(500)} 
      style={styles.section}
    >
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsScroll}
      >
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Assessments')}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="analytics" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Assessments</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Athletes')}
        >
          <LinearGradient
            colors={['#11998e', '#38ef7d']}
            style={styles.quickActionGradient}
          >
            <FontAwesome5 name="users" size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>My Athletes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => setShowSearchModal(true)}
        >
          <LinearGradient
            colors={['#f093fb', '#f5576c']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="search" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Find</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Messages')}
        >
          <LinearGradient
            colors={['#4facfe', '#00f2fe']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="chatbubbles" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Notifications')}
        >
          <LinearGradient
            colors={['#ff6b6b', '#ee5a5a']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="notifications" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <LinearGradient
            colors={['#fa709a', '#fee140']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="person" size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );

  // ============================================
  // RENDER: Top Performing Athletes (ALL Athletes)
  // ============================================
  const renderTopAthletes = () => (
    <Animated.View 
      entering={FadeInDown.delay(400).duration(500)} 
      style={styles.section}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>🏆 Top Performing Athletes</Text>
          <Text style={styles.sectionSubtitle}>Highest AI scores across all sports</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSearchModal(true)}>
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {topAthletes.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.athletesScroll}
        >
          {topAthletes.map((athlete, index) => (
            <Animated.View
              key={athlete.id}
              entering={FadeInRight.delay(index * 50).duration(400)}
            >
              <TouchableOpacity
                style={styles.topAthleteCard}
                onPress={() => navigateToAthleteProfile(athlete)}
              >
                {/* Rank Badge */}
                <View style={[
                  styles.rankBadge,
                  { backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#667eea' }
                ]}>
                  <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                </View>
                
                {/* Profile Photo */}
                <View style={styles.athletePhotoContainer}>
                  <Image
                    source={{ uri: athlete.profile_photo || 'https://via.placeholder.com/70' }}
                    style={styles.topAthletePhoto}
                  />
                  {athlete.is_online && <View style={styles.onlineIndicator} />}
                  {athlete.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#2ecc71" />
                    </View>
                  )}
                </View>
                
                {/* Athlete Info */}
                <Text style={styles.topAthleteName} numberOfLines={1}>
                  {athlete.name?.split(' ')[0] || 'Athlete'}
                </Text>
                
                {/* AI Score */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreValue}>{athlete.ai_score || 0}%</Text>
                </View>
                
                {/* Sport & Location */}
                <Text style={styles.topAthleteSport} numberOfLines={1}>
                  {athlete.sport || 'Sport'}
                </Text>
                <Text style={styles.topAthleteLocation} numberOfLines={1}>
                  📍 {athlete.location || 'Location'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <FontAwesome5 name="trophy" size={40} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateText}>No athletes found</Text>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Active Athletes (Online/Recently Active)
  // ============================================
  const renderActiveAthletes = () => (
    <Animated.View 
      entering={FadeInDown.delay(500).duration(500)} 
      style={styles.section}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>🟢 Active Now</Text>
          <Text style={styles.sectionSubtitle}>Athletes active in the last 24 hours</Text>
        </View>
      </View>

      {activeAthletes.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.athletesScroll}
        >
          {activeAthletes.map((athlete, index) => (
            <Animated.View
              key={athlete.id}
              entering={FadeInRight.delay(index * 50).duration(400)}
            >
              <TouchableOpacity
                style={styles.activeAthleteCard}
                onPress={() => navigateToAthleteProfile(athlete)}
              >
                <View style={styles.activePhotoContainer}>
                  <Image
                    source={{ uri: athlete.profile_photo || 'https://via.placeholder.com/60' }}
                    style={styles.activeAthletePhoto}
                  />
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: athlete.is_online ? '#2ecc71' : '#f39c12' }
                  ]} />
                </View>
                
                <Text style={styles.activeAthleteName} numberOfLines={1}>
                  {athlete.name?.split(' ')[0]}
                </Text>
                
                <Text style={styles.activeAthleteScore}>
                  {athlete.ai_score || 0}%
                </Text>
                
                <Text style={styles.activeAthleteSport} numberOfLines={1}>
                  {athlete.sport || 'Sport'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyStateSmall}>
          <Ionicons name="people-outline" size={30} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTextSmall}>No active athletes</Text>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Rising Stars (Biggest Improvements)
  // ============================================
  const renderRisingStars = () => {
    if (risingStars.length === 0) return null;

    return (
      <Animated.View 
        entering={FadeInDown.delay(600).duration(500)} 
        style={styles.section}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>📈 Rising Stars</Text>
            <Text style={styles.sectionSubtitle}>Biggest improvements this month</Text>
          </View>
        </View>

        {risingStars.slice(0, 5).map((item, index) => (
          <TouchableOpacity
            key={item.athlete?.id || index}
            style={styles.risingStarCard}
            onPress={() => item.athlete && navigateToAthleteProfile(item.athlete)}
          >
            <View style={styles.risingStarRank}>
              <Text style={styles.risingStarRankText}>{index + 1}</Text>
            </View>
            
            <Image
              source={{ uri: item.athlete?.profile_photo || 'https://via.placeholder.com/45' }}
              style={styles.risingStarPhoto}
            />
            
            <View style={styles.risingStarInfo}>
              <Text style={styles.risingStarName}>{item.athlete?.name}</Text>
              <Text style={styles.risingStarSport}>{item.athlete?.sport}</Text>
              <Text style={styles.risingStarProgress}>
                {item.old_score}% → {item.new_score}%
              </Text>
            </View>
            
            <View style={styles.improvementBadge}>
              <Ionicons name="trending-up" size={14} color="#fff" />
              <Text style={styles.improvementText}>+{item.improvement}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>
    );
  };

  // ============================================
  // RENDER: Your Connected Athletes
  // ============================================
  const renderConnectedAthletes = () => (
    <Animated.View 
      entering={FadeInDown.delay(700).duration(500)} 
      style={styles.section}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>👥 Your Athletes</Text>
          <Text style={styles.sectionSubtitle}>Athletes connected to you</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Athletes')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {connectedAthletes.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.athletesScroll}
        >
          {connectedAthletes.slice(0, 8).map((athlete, index) => (
            <Animated.View
              key={athlete.id}
              entering={FadeInRight.delay(index * 50).duration(400)}
            >
              <TouchableOpacity
                style={styles.athleteCard}
                onPress={() => navigateToAthleteProfile(athlete)}
              >
                <Image
                  source={{ uri: athlete.profile_photo || 'https://via.placeholder.com/70' }}
                  style={styles.athleteCardPhoto}
                />
                <Text style={styles.athleteCardName} numberOfLines={1}>
                  {athlete.name?.split(' ')[0] || 'Athlete'}
                </Text>
                <View style={styles.athleteCardScore}>
                  <Text style={styles.athleteCardScoreText}>
                    {athlete.ai_score || 0}%
                  </Text>
                </View>
                <Text style={styles.athleteCardSport} numberOfLines={1}>
                  {athlete.sport || 'Sport'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}

          <TouchableOpacity
            style={styles.addAthleteCard}
            onPress={() => setShowSearchModal(true)}
          >
            <View style={styles.addAthleteIcon}>
              <Ionicons name="add" size={30} color="#667eea" />
            </View>
            <Text style={styles.addAthleteText}>Find More</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.emptyAthletes}>
          <FontAwesome5 name="users" size={40} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyAthletesText}>No athletes connected yet</Text>
          <TouchableOpacity
            style={styles.emptyAthletesButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Text style={styles.emptyAthletesButtonText}>Find Athletes</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={['#667eea']}
          />
        }
      >
        {renderHeader()}
        {renderQuickActions()}
        {renderTopAthletes()}
        {renderActiveAthletes()}
        {renderRisingStars()}
        {renderConnectedAthletes()}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        navigation={navigation}
      />
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

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  coachNameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Stats Cards
  statsCardsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statsCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsCardNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  statsCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Quick Actions
  quickActionsScroll: {
    paddingRight: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  quickActionGradient: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },

  // Top Athletes Cards
  athletesScroll: {
    paddingRight: 16,
  },
  topAthleteCard: {
    width: 130,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  athletePhotoContainer: {
    position: 'relative',
    marginTop: 10,
  },
  topAthletePhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#667eea',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderColor: Theme.colors.surface,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Theme.colors.surface,
    borderRadius: 10,
  },
  topAthleteName: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 10,
    textAlign: 'center',
  },
  scoreContainer: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  topAthleteSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  topAthleteLocation: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // Active Athletes
  activeAthleteCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  activePhotoContainer: {
    position: 'relative',
  },
  activeAthletePhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  activeAthleteName: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  activeAthleteScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
    marginTop: 2,
  },
  activeAthleteSport: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // Rising Stars
  risingStarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2ecc7130',
  },
  risingStarRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  risingStarRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  risingStarPhoto: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },
  risingStarInfo: {
    flex: 1,
  },
  risingStarName: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  risingStarSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  risingStarProgress: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  improvementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  improvementText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Connected Athletes (Your Athletes)
  athleteCard: {
    alignItems: 'center',
    marginRight: 14,
    width: 85,
  },
  athleteCardPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  athleteCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  athleteCardScore: {
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  athleteCardScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  athleteCardSport: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  addAthleteCard: {
    width: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAthleteIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAthleteText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },

  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 10,
  },
  emptyStateSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    gap: 10,
  },
  emptyStateTextSmall: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  emptyAthletes: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
  },
  emptyAthletesText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 10,
    marginBottom: 16,
  },
  emptyAthletesButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyAthletesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});