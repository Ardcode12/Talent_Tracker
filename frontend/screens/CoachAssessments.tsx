import React, { useEffect, useState } from 'react';
import { getCoachAssessments, getAssessmentStatistics, getImageUrl } from '../services/api';

import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import { Picker } from '@react-native-picker/picker';

const { width: screenWidth } = Dimensions.get('window');

interface Assessment {
  id: number;
  athlete: {
    id: number;
    name: string;
    profile_photo: string;
    sport: string;
    location: string;
    age: number;
    ai_score: number;
  };
  test_type: string;
  ai_score: number;
  score: number;
  ai_feedback: string;
  status: string;
  created_at: string;
  video_url: string;
  is_personal_best: boolean;
  athlete_best_score: number;
}

export default function CoachAssessments({ navigation }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestType, setSelectedTestType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'stats'

  useEffect(() => {
    loadAssessments();
    loadStatistics();
  }, [selectedTestType]);

  const loadAssessments = async (resetPage = true) => {
    try {
      if (resetPage) {
        setLoading(true);
        setPage(1);
      }

      const params = {
        page: resetPage ? 1 : page,
        limit: 20,
        ...(searchQuery && { search: searchQuery }),
        ...(selectedTestType !== 'all' && { test_type: selectedTestType }),
        ...(minScore && { min_score: minScore }),
        ...(maxScore && { max_score: maxScore }),
      };

      const response = await getCoachAssessments(params);

      if (resetPage) {
        setAssessments(response.data || []);
      } else {
        setAssessments(prev => [...prev, ...response.data]);
      }

      setStats(response.stats);
      setHasMore(response.data.length >= 20);
      
      if (!resetPage) {
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const statsData = await getAssessmentStatistics();
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAssessments(true);
    loadStatistics();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return Theme.colors.success;
    if (score >= 60) return Theme.colors.warning;
    return Theme.colors.error;
  };

  const getTestIcon = (testType: string) => {
    switch (testType.toLowerCase()) {
      case 'squats':
        return 'fitness';
      case 'shuttle_run':
        return 'directions-run';
      case 'vertical_jump':
        return 'trending-up';
      case 'long_jump':
        return 'sports-handball';
      default:
        return 'assessment';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Assessment Reports</Text>
      <Text style={styles.headerSubtitle}>Review athlete performance</Text>

      {/* Toggle View Mode */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : Theme.colors.textSecondary} />
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'stats' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('stats')}
        >
          <Ionicons name="stats-chart" size={20} color={viewMode === 'stats' ? '#fff' : Theme.colors.textSecondary} />
          <Text style={[styles.viewModeText, viewMode === 'stats' && styles.viewModeTextActive]}>Statistics</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total_assessments}</Text>
            <Text style={styles.statLabel}>Total Assessments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.average_score.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </View>
        </View>
      )}

      {viewMode === 'list' && (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search athlete name, sport, or test type..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => loadAssessments(true)}
              />
            </View>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="filter" size={20} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Test Type Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
          >
            <TouchableOpacity
              style={[styles.tab, selectedTestType === 'all' && styles.activeTab]}
              onPress={() => setSelectedTestType('all')}
            >
              <Text style={[
                styles.tabText,
                selectedTestType === 'all' && styles.activeTabText
              ]}>All Tests</Text>
            </TouchableOpacity>
            {stats?.test_types.map(type => (
              <TouchableOpacity
                key={type.test_type}
                style={[
                  styles.tab,
                  selectedTestType === type.test_type && styles.activeTab
                ]}
                onPress={() => setSelectedTestType(type.test_type)}
              >
                <Text style={[
                  styles.tabText,
                  selectedTestType === type.test_type && styles.activeTabText
                ]}>
                  {type.test_type.replace('_', ' ')} ({type.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  const renderAssessmentCard = ({ item }: { item: Assessment }) => (
    <TouchableOpacity
      style={styles.assessmentCard}
      onPress={() => navigation.navigate('CoachAssessmentDetail', { 
        assessmentId: item.id,
        assessment: item
      })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.athleteInfo}>
          <Image
            source={{ 
  uri: getImageUrl(item.athlete.profile_photo) || 'https://via.placeholder.com/50' 
}}

            style={styles.athletePhoto}
          />
          <View style={styles.athleteDetails}>
            <View style={styles.athleteNameRow}>
              <Text style={styles.athleteName}>{item.athlete.name}</Text>
              {item.is_personal_best && (
                <View style={styles.pbBadge}>
                  <Text style={styles.pbText}>PB</Text>
                </View>
              )}
            </View>
            <Text style={styles.athleteMeta}>
              {item.athlete.sport} • {item.athlete.location} • Age {item.athlete.age}
            </Text>
            {item.athlete_best_score && (
              <Text style={styles.bestScore}>
                Best: {item.athlete_best_score}%
              </Text>
            )}
          </View>
        </View>
        <View style={[
          styles.scoreContainer,
          { backgroundColor: getScoreColor(item.ai_score) + '20' }
        ]}>
          <Text style={[
            styles.scoreText,
            { color: getScoreColor(item.ai_score) }
          ]}>
            {item.ai_score}%
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.testTypeContainer}>
          <MaterialIcons
            name={getTestIcon(item.test_type)}
            size={20}
            color={Theme.colors.primary}
          />
          <Text style={styles.testType}>
            {item.test_type.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>

      {/* AI Feedback Preview */}
      {item.ai_feedback && (
        <Text style={styles.feedbackPreview} numberOfLines={2}>
          {item.ai_feedback}
        </Text>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="play-circle" size={20} color={Theme.colors.primary} />
          <Text style={styles.actionText}>View Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text" size={20} color={Theme.colors.secondary} />
          <Text style={styles.actionText}>Full Report</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderStatisticsView = () => (
    <ScrollView style={styles.statisticsContainer}>
      {/* Best Scores by Test Type */}
      {statistics?.best_scores_by_type && (
        <>
          <Text style={styles.statisticsSection}>Performance by Test Type</Text>
          <View style={styles.testTypeGrid}>
            {statistics.best_scores_by_type.map((item) => (
              <View key={item.test_type} style={styles.testTypeCard}>
                <MaterialIcons
                  name={getTestIcon(item.test_type)}
                  size={32}
                  color={Theme.colors.primary}
                />
                <Text style={styles.testTypeName}>
                  {item.test_type.replace('_', ' ').toUpperCase()}
                </Text>
                <View style={styles.testTypeStats}>
                  <View style={styles.testTypeStat}>
                    <Text style={styles.testTypeStatValue}>{item.best_score}%</Text>
                    <Text style={styles.testTypeStatLabel}>Best</Text>
                  </View>
                  <View style={styles.testTypeStat}>
                    <Text style={styles.testTypeStatValue}>{item.average_score}%</Text>
                    <Text style={styles.testTypeStatLabel}>Avg</Text>
                  </View>
                  <View style={styles.testTypeStat}>
                    <Text style={styles.testTypeStatValue}>{item.total_assessments}</Text>
                    <Text style={styles.testTypeStatLabel}>Tests</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top Performers */}
      {statistics?.top_performers && statistics.top_performers.length > 0 && (
        <>
          <Text style={styles.statisticsSection}>Top Performers</Text>
          <View style={styles.topPerformersContainer}>
            {statistics.top_performers.map((performer, index) => (
              <TouchableOpacity
                key={performer.id}
                style={styles.topPerformerCard}
                onPress={() => navigation.navigate('AthleteDetail', { athleteId: performer.id })}
              >
                <View style={styles.topPerformerRank}>
                  <Text style={styles.topPerformerRankText}>#{index + 1}</Text>
                </View>
                <Image
                  source={{ 
  uri: getImageUrl(performer.profile_photo) || 'https://via.placeholder.com/60' 
}}

                  style={styles.topPerformerPhoto}
                />
                <View style={styles.topPerformerInfo}>
                  <Text style={styles.topPerformerName}>{performer.name}</Text>
                  <Text style={styles.topPerformerSport}>{performer.sport}</Text>
                </View>
                <View style={styles.topPerformerStats}>
                  <Text style={styles.topPerformerScore}>{performer.average_score}%</Text>
                  <Text style={styles.topPerformerTests}>{performer.assessment_count} tests</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Recent Improvements */}
      {statistics?.recent_improvements && statistics.recent_improvements.length > 0 && (
        <>
          <Text style={styles.statisticsSection}>Recent Improvements</Text>
          <View style={styles.improvementsContainer}>
            {statistics.recent_improvements.map((improvement, index) => (
              <View key={index} style={styles.improvementCard}>
                <Image
                  source={{ 
  uri: getImageUrl(improvement.athlete.profile_photo) || 'https://via.placeholder.com/50' 
}}

                  style={styles.improvementPhoto}
                />
                <View style={styles.improvementInfo}>
                  <Text style={styles.improvementName}>{improvement.athlete.name}</Text>
                  <Text style={styles.improvementTest}>
                    {improvement.test_type.replace('_', ' ')}
                  </Text>
                  <Text style={styles.improvementCurrent}>
                    Current: {improvement.current_score}%
                  </Text>
                </View>
                <View style={styles.improvementScoreContainer}>
                  <Ionicons name="trending-up" size={24} color={Theme.colors.success} />
                  <Text style={styles.improvementValue}>+{improvement.improvement}%</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Assessments</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Score Range</Text>
            <View style={styles.scoreRangeContainer}>
              <TextInput
                style={styles.scoreInput}
                placeholder="Min"
                placeholderTextColor={Theme.colors.textSecondary}
                value={minScore}
                onChangeText={setMinScore}
                keyboardType="numeric"
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={styles.scoreInput}
                placeholder="Max"
                placeholderTextColor={Theme.colors.textSecondary}
                value={maxScore}
                onChangeText={setMaxScore}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              setShowFilters(false);
              loadAssessments(true);
            }}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setMinScore('');
              setMaxScore('');
              setShowFilters(false);
              loadAssessments(true);
            }}
          >
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading && assessments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {viewMode === 'list' ? (
        <FlatList
          data={assessments}
          renderItem={renderAssessmentCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={() => hasMore && loadAssessments(false)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="clipboard-list" size={64} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No assessments found</Text>
              <Text style={styles.emptySubtext}>
                Assessments will appear here when athletes complete them
              </Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderStatisticsView()}
        </ScrollView>
      )}

      {renderFilterModal()}
    </View>
  );
}
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
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginBottom: 20,
  },
  viewModeToggle: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  viewModeButtonActive: {
    backgroundColor: Theme.colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  viewModeTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Theme.colors.text,
    paddingVertical: 12,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeTab: {
    backgroundColor: Theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    paddingVertical: 10,
  },
  assessmentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  athleteInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  athletePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  athleteDetails: {
    flex: 1,
  },
  athleteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  athleteMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  pbBadge: {
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pbText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  bestScore: {
    fontSize: 12,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  scoreContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  testTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testType: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  dateText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  feedbackPreview: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginVertical: 8,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: Theme.colors.text,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  
  // Statistics View Styles
  statisticsContainer: {
    flex: 1,
  },
  statisticsSection: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
  },
  testTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    gap: 10,
  },
  testTypeCard: {
    flex: 1,
    minWidth: (screenWidth - 50) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  testTypeName: {
    fontSize: 12,
    color: Theme.colors.text,
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  testTypeStats: {
    flexDirection: 'row',
    gap: 20,
  },
  testTypeStat: {
    alignItems: 'center',
  },
  testTypeStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  testTypeStatLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  topPerformersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  topPerformerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topPerformerRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topPerformerRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topPerformerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  topPerformerInfo: {
    flex: 1,
  },
  topPerformerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  topPerformerSport: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  topPerformerStats: {
    alignItems: 'flex-end',
  },
  topPerformerScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.primary,
  },
  topPerformerTests: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  improvementsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.success + '10',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Theme.colors.success + '30',
  },
  improvementPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  improvementInfo: {
    flex: 1,
  },
  improvementName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  improvementTest: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  improvementCurrent: {
    fontSize: 12,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  improvementScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  improvementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.success,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 10,
  },
  scoreRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rangeSeparator: {
    fontSize: 18,
    color: Theme.colors.textSecondary,
  },
  applyButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
});
