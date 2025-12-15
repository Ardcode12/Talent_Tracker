import React, { useEffect, useState } from 'react';
import { 
  getCoachDashboardStats, 
  getCoachAthletes, 
  getCoachDashboardFeed,
  getAssessmentStatistics ,
  getImageUrl
} from '../services/api';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';

const { width: screenWidth } = Dimensions.get('window');

export default function CoachDashboard({ navigation }) {
  const [stats, setStats] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [athletePosts, setAthletePosts] = useState([]);
  const [assessmentStats, setAssessmentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'posts', 'performance'

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [statsRes, athletesRes, feedRes, assessmentStatsRes] = await Promise.all([
        getCoachDashboardStats(),
        getCoachAthletes({ limit: 10 }),
        getCoachDashboardFeed(1, 5),
        getAssessmentStatistics()
      ]);
      
      if (statsRes) setStats(statsRes);
      if (athletesRes?.data) setAthletes(athletesRes.data);
      if (feedRes?.data) setAthletePosts(feedRes.data);
      if (assessmentStatsRes) setAssessmentStats(assessmentStatsRes);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderPerformanceCard = ({ title, value, subtitle, icon, color }) => (
    <View style={[styles.performanceCard, { borderLeftColor: color }]}>
      <View style={styles.performanceCardHeader}>
        <MaterialIcons name={icon} size={24} color={color} />
        <Text style={styles.performanceCardTitle}>{title}</Text>
      </View>
      <Text style={styles.performanceCardValue}>{value}</Text>
      {subtitle && <Text style={styles.performanceCardSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderTopPerformer = ({ item }) => (
    <TouchableOpacity 
      style={styles.topPerformerCard}
      onPress={() => navigation.navigate('AthleteDetail', { athleteId: item.id })}
    >
      <Image
        source={{ uri: item.profile_photo || 'https://via.placeholder.com/50' }}
        style={styles.topPerformerPhoto}
      />
      <View style={styles.topPerformerInfo}>
        <Text style={styles.topPerformerName}>{item.name}</Text>
        <Text style={styles.topPerformerSport}>{item.sport}</Text>
      </View>
      <View style={styles.topPerformerScore}>
        <Text style={styles.topPerformerScoreValue}>{item.average_score}%</Text>
        <Text style={styles.topPerformerScoreLabel}>Avg Score</Text>
      </View>
    </TouchableOpacity>
  );

  const renderAthletePost = ({ item }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.user.profile_photo || 'https://via.placeholder.com/40' }}
          style={styles.postUserPhoto}
        />
        <View style={styles.postUserInfo}>
          <Text style={styles.postUserName}>{item.user.name}</Text>
          <Text style={styles.postMeta}>
            {item.user.sport} • AI Score: {item.user.ai_score}%
          </Text>
        </View>
        {item.is_ai_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={16} color={Theme.colors.success} />
          </View>
        )}
      </View>
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content.text}
      </Text>
      <View style={styles.postFooter}>
        <Text style={styles.postTime}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.postStats}>
          <Ionicons name="heart" size={16} color={Theme.colors.error} />
          <Text style={styles.postStatText}>{item.likes_count}</Text>
          <Ionicons name="chatbubble" size={16} color={Theme.colors.primary} />
          <Text style={styles.postStatText}>{item.comments_count}</Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {['overview', 'posts', 'performance'].map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverviewContent = () => (
    <>
      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('CoachAssessments')}
        >
          <LinearGradient
            colors={Theme.colors.gradient.primary}
            style={styles.quickActionGradient}
          >
            <Ionicons name="analytics" size={24} color="#fff" />
            <Text style={styles.quickActionText}>View All Assessments</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Athletes')}
        >
          <LinearGradient
            colors={Theme.colors.gradient.secondary}
            style={styles.quickActionGradient}
          >
            <FontAwesome5 name="users" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Manage Athletes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Recent Athletes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Athletes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Athletes')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={athletes.slice(0, 5)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.athleteCardCompact}
            onPress={() => navigation.navigate('AthleteDetail', { athleteId: item.id })}
          >
            <Image
              source={{ uri: item.profile_photo || 'https://via.placeholder.com/60' }}
              style={styles.athletePhotoCompact}
            />
            <Text style={styles.athleteNameCompact} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.athleteScoreCompact}>{item.ai_score}%</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    </>
  );

  const renderPostsContent = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Athletes' Recent Posts</Text>
      </View>
      
      <FlatList
        data={athletePosts}
        renderItem={renderAthletePost}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="newspaper" size={48} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No recent posts from your athletes</Text>
          </View>
        }
      />
    </>
  );

  const renderPerformanceContent = () => (
    <>
      {/* Best Scores by Test Type */}
      {assessmentStats?.best_scores_by_type && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assessment Performance</Text>
          </View>
          
          <View style={styles.performanceGrid}>
            {assessmentStats.best_scores_by_type.map((score) => (
              <View key={score.test_type} style={styles.scoreCard}>
                <Text style={styles.scoreCardTitle}>
                  {score.test_type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.scoreCardBest}>
                  Best: {score.best_score}%
                </Text>
                <Text style={styles.scoreCardAvg}>
                  Avg: {score.average_score}%
                </Text>
                <Text style={styles.scoreCardCount}>
                  {score.total_assessments} tests
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top Performers */}
      {assessmentStats?.top_performers && assessmentStats.top_performers.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
          </View>
          
          <FlatList
            data={assessmentStats.top_performers}
            renderItem={renderTopPerformer}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        </>
      )}

      {/* Recent Improvements */}
      {assessmentStats?.recent_improvements && assessmentStats.recent_improvements.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Improvements</Text>
          </View>
          
          <View style={styles.improvementsContainer}>
            {assessmentStats.recent_improvements.map((improvement, index) => (
              <View key={index} style={styles.improvementCard}>
                <Image
                  source={{ uri: improvement.athlete.profile_photo || 'https://via.placeholder.com/40' }}
                  style={styles.improvementPhoto}
                />
                <View style={styles.improvementInfo}>
                  <Text style={styles.improvementName}>{improvement.athlete.name}</Text>
                  <Text style={styles.improvementTest}>
                    {improvement.test_type.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.improvementScore}>
                  <Ionicons name="trending-up" size={20} color={Theme.colors.success} />
                  <Text style={styles.improvementValue}>+{improvement.improvement}%</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadDashboardData();
          }} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={Theme.colors.gradient.coach}
            style={StyleSheet.absoluteFillObject}
          />
          
          <View style={styles.headerContent}>
            <View style={styles.profileSection}>
  <Image
    source={{ 
      uri: getImageUrl(stats?.coach_info?.profile_photo) || 'https://via.placeholder.com/100' 
    }}
    style={styles.profilePhoto}
  />
  <View style={styles.profileInfo}>
    <Text style={styles.coachName}>{stats?.coach_info?.name || 'Coach'}</Text>
    <Text style={styles.coachSpecialization}>
      {stats?.coach_info?.specialization || 'General'} Coach
    </Text>
    <Text style={styles.coachExperience}>
      {stats?.coach_info?.experience || 0} years experience
    </Text>
  </View>
</View>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
  <View style={styles.statCard}>
    <FontAwesome5 name="users" size={24} color={Theme.colors.primary} />
    <Text style={styles.statNumber}>{stats?.connected_athletes || 0}</Text>
    <Text style={styles.statLabel}>Athletes</Text>
  </View>
  
  <View style={styles.statCard}>
    <Ionicons name="document-text" size={24} color={Theme.colors.secondary} />
    <Text style={styles.statNumber}>{stats?.total_assessments || 0}</Text>
    <Text style={styles.statLabel}>Reviews</Text>
  </View>
  
  <View style={styles.statCard}>
    <Ionicons name="notifications" size={24} color={Theme.colors.accent} />
    <Text style={styles.statNumber}>{stats?.pending_requests || 0}</Text>
    <Text style={styles.statLabel}>Requests</Text>
  </View>
</View>
          </View>
        </View>

        {/* Tabs */}
        {renderTabs()}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverviewContent()}
          {activeTab === 'posts' && renderPostsContent()}
          {activeTab === 'performance' && renderPerformanceContent()}
        </View>
      </ScrollView>
    </View>
  );
}

// Add these additional styles to your existing styles
const additionalStyles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: Theme.colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activeTab: {
    backgroundColor: Theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    paddingBottom: 20,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  athleteCardCompact: {
    alignItems: 'center',
    marginRight: 15,
    width: 80,
  },
  athletePhotoCompact: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  athleteNameCompact: {
    fontSize: 12,
    color: Theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  athleteScoreCompact: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postUserPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  postMeta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  verifiedBadge: {
    backgroundColor: Theme.colors.success + '20',
    borderRadius: 15,
    padding: 5,
  },
  postContent: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 20,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postTime: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postStatText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    gap: 10,
  },
  scoreCard: {
    flex: 1,
    minWidth: (screenWidth - 50) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreCardTitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  scoreCardBest: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.success,
    marginBottom: 4,
  },
  scoreCardAvg: {
    fontSize: 16,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  scoreCardCount: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  topPerformerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topPerformerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  topPerformerInfo: {
    flex: 1,
  },
  topPerformerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  topPerformerSport: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  topPerformerScore: {
    alignItems: 'center',
  },
  topPerformerScoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  topPerformerScoreLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  improvementsContainer: {
    paddingHorizontal: 20,
  },
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.success + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.success + '30',
  },
  improvementPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  improvementInfo: {
    flex: 1,
  },
  improvementName: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  improvementTest: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  improvementScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  improvementValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.success,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 10,
  },
});

// Merge styles
// Merge the existing styles with additional styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    marginLeft: 20,
  },
  coachName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  coachSpecialization: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  coachExperience: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  seeAllText: {
    fontSize: 16,
    color: Theme.colors.primary,
  },
  
  // Add all the additional styles
  ...additionalStyles,
});
