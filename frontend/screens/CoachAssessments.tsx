// frontend/screens/CoachAssessments.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Avatar from '../components/Avatar';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import { 
  getCoachAssessments, 
  getAssessmentStatistics, 
  getImageUrl 
} from '../services/api';

const { width: screenWidth } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface Athlete {
  id: number;
  name: string;
  profile_photo: string;
  sport: string;
  location: string;
  age: number;
  ai_score: number;
}

interface Assessment {
  id: number;
  athlete: Athlete;
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

interface Stats {
  total_assessments: number;
  average_score: number;
  test_types: { test_type: string; count: number }[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_more: boolean;
}

interface Filters {
  search: string;
  testType: string;
  minScore: string;
  maxScore: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CoachAssessments({ navigation }: any) {
  // State
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<Filters>({
    search: '',
    testType: 'all',
    minScore: '',
    maxScore: '',
    dateFrom: null,
    dateTo: null,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  const debouncedSearch = useDebounce(filters.search, 500);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const loadAssessments = useCallback(async (
    page: number = 1,
    append: boolean = false
  ) => {
    try {
      if (page === 1 && !append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params: Record<string, any> = {
        page,
        limit: 20,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
      };

      // Apply filters
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (filters.testType !== 'all') {
        params.test_type = filters.testType;
      }
      if (filters.minScore) {
        params.min_score = parseFloat(filters.minScore);
      }
      if (filters.maxScore) {
        params.max_score = parseFloat(filters.maxScore);
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom.toISOString();
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo.toISOString();
      }

      const response = await getCoachAssessments(params);

      if (append && page > 1) {
        setAssessments(prev => [...prev, ...(response.data || [])]);
      } else {
        setAssessments(response.data || []);
      }
      
      setStats(response.stats);
      setPagination(response.pagination);

    } catch (err: any) {
      console.error('Error loading assessments:', err);
      setError(err.message || 'Failed to load assessments');
      
      if (!append) {
        setAssessments([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, filters.testType, filters.minScore, filters.maxScore, 
      filters.dateFrom, filters.dateTo, filters.sortBy, filters.sortOrder]);

  const loadStatistics = useCallback(async () => {
    try {
      const statsData = await getAssessmentStatistics();
      setStatistics(statsData);
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial load and filter changes
  useEffect(() => {
    loadAssessments(1, false);
  }, [loadAssessments]);

  // Load statistics when switching to stats view
  useEffect(() => {
    if (viewMode === 'stats') {
      loadStatistics();
    }
  }, [viewMode, loadStatistics]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAssessments(1, false);
    if (viewMode === 'stats') {
      loadStatistics();
    }
  }, [loadAssessments, loadStatistics, viewMode]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination?.has_more) {
      loadAssessments(pagination.page + 1, true);
    }
  }, [loadingMore, pagination, loadAssessments]);

  const handleFilterChange = useCallback((key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      testType: 'all',
      minScore: '',
      maxScore: '',
      dateFrom: null,
      dateTo: null,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
    setShowFilters(false);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setShowFilters(false);
    loadAssessments(1, false);
  }, [loadAssessments]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getScoreColor = useCallback((score: number): string => {
    if (score >= 80) return Theme.colors.success;
    if (score >= 60) return Theme.colors.warning;
    return Theme.colors.error;
  }, []);

  const getTestIcon = useCallback((testType: string): string => {
    const icons: Record<string, string> = {
      'squats': 'fitness-center',
      'shuttle_run': 'directions-run',
      'vertical_jump': 'trending-up',
      'long_jump': 'sports-handball',
      'height_detection': 'height',
    };
    return icons[testType.toLowerCase()] || 'assessment';
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatTestType = useCallback((testType: string): string => {
    return testType.replace(/_/g, ' ').toUpperCase();
  }, []);

  // ============================================================================
  // MEMOIZED COMPONENTS
  // ============================================================================

  const AssessmentCard = useMemo(() => {
    return React.memo(({ item }: { item: Assessment }) => (
      <TouchableOpacity
        style={styles.assessmentCard}
        onPress={() => navigation.navigate('CoachAssessmentDetail', { 
          assessmentId: item.id,
          assessment: item
        })}
        activeOpacity={0.7}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.athleteInfo}>
            <Avatar 
  uri={item.athlete.profile_photo}
  name={item.athlete.name}
  size={50}
  style={styles.athletePhoto}
/>
            <View style={styles.athleteDetails}>
              <View style={styles.athleteNameRow}>
                <Text style={styles.athleteName}>{item.athlete.name}</Text>
                {item.is_personal_best && (
                  <View style={styles.pbBadge}>
                    <Ionicons name="trophy" size={10} color="#fff" />
                    <Text style={styles.pbText}>PB</Text>
                  </View>
                )}
              </View>
              <Text style={styles.athleteMeta}>
                {item.athlete.sport} • {item.athlete.location} • Age {item.athlete.age}
              </Text>
              {item.athlete_best_score > 0 && (
                <Text style={styles.bestScore}>
                  Best: {item.athlete_best_score.toFixed(1)}%
                </Text>
              )}
            </View>
          </View>
          
          {/* Score Badge */}
          <View style={[
            styles.scoreContainer,
            { backgroundColor: getScoreColor(item.ai_score) + '20' }
          ]}>
            <Text style={[
              styles.scoreText,
              { color: getScoreColor(item.ai_score) }
            ]}>
              {item.ai_score?.toFixed(1) || '0'}%
            </Text>
          </View>
        </View>

        {/* Card Content */}
        <View style={styles.cardContent}>
          <View style={styles.testTypeContainer}>
            <MaterialIcons
              name={getTestIcon(item.test_type) as any}
              size={20}
              color={Theme.colors.primary}
            />
            <Text style={styles.testType}>
              {formatTestType(item.test_type)}
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

        {/* Card Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              if (item.video_url) {
                navigation.navigate('VideoPlayer', { videoUrl: item.video_url });
              } else {
                Alert.alert('No Video', 'No video available for this assessment');
              }
            }}
          >
            <Ionicons name="play-circle" size={20} color={Theme.colors.primary} />
            <Text style={styles.actionText}>View Video</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('CoachAssessmentDetail', { 
              assessmentId: item.id 
            })}
          >
            <Ionicons name="document-text" size={20} color={Theme.colors.secondary} />
            <Text style={styles.actionText}>Full Report</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ));
  }, [navigation, getScoreColor, getTestIcon, formatDate, formatTestType]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Assessment Reports</Text>
      <Text style={styles.headerSubtitle}>Review athlete performance</Text>

      {/* View Mode Toggle */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={viewMode === 'list' ? '#fff' : Theme.colors.textSecondary} 
          />
          <Text style={[
            styles.viewModeText, 
            viewMode === 'list' && styles.viewModeTextActive
          ]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'stats' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('stats')}
        >
          <Ionicons 
            name="stats-chart" 
            size={20} 
            color={viewMode === 'stats' ? '#fff' : Theme.colors.textSecondary} 
          />
          <Text style={[
            styles.viewModeText, 
            viewMode === 'stats' && styles.viewModeTextActive
          ]}>
            Statistics
          </Text>
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
                placeholder="Search athlete, sport, or test..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={filters.search}
                onChangeText={(text) => handleFilterChange('search', text)}
                returnKeyType="search"
              />
              {filters.search.length > 0 && (
                <TouchableOpacity onPress={() => handleFilterChange('search', '')}>
                  <Ionicons name="close-circle" size={20} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.filterButton,
                (filters.minScore || filters.maxScore || filters.dateFrom) && 
                  styles.filterButtonActive
              ]}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons 
                name="filter" 
                size={20} 
                color={(filters.minScore || filters.maxScore) ? '#fff' : Theme.colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {/* Test Type Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabsContent}
          >
            <TouchableOpacity
              style={[
                styles.tab, 
                filters.testType === 'all' && styles.activeTab
              ]}
              onPress={() => handleFilterChange('testType', 'all')}
            >
              <Text style={[
                styles.tabText,
                filters.testType === 'all' && styles.activeTabText
              ]}>
                All Tests
              </Text>
            </TouchableOpacity>
            
            {stats?.test_types.map(type => (
              <TouchableOpacity
                key={type.test_type}
                style={[
                  styles.tab,
                  filters.testType === type.test_type && styles.activeTab
                ]}
                onPress={() => handleFilterChange('testType', type.test_type)}
              >
                <Text style={[
                  styles.tabText,
                  filters.testType === type.test_type && styles.activeTabText
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

  const renderStatisticsView = () => (
    <ScrollView style={styles.statisticsContainer}>
      {/* Best Scores by Test Type */}
      {statistics?.best_scores_by_type?.length > 0 && (
        <>
          <Text style={styles.statisticsSection}>Performance by Test Type</Text>
          <View style={styles.testTypeGrid}>
            {statistics.best_scores_by_type.map((item: any) => (
              <View key={item.test_type} style={styles.testTypeCard}>
                <MaterialIcons
                  name={getTestIcon(item.test_type) as any}
                  size={32}
                  color={Theme.colors.primary}
                />
                <Text style={styles.testTypeName}>
                  {formatTestType(item.test_type)}
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
      {statistics?.top_performers?.length > 0 && (
        <>
          <Text style={styles.statisticsSection}>Top Performers</Text>
          <View style={styles.topPerformersContainer}>
            {statistics.top_performers.map((performer: any, index: number) => (
              <TouchableOpacity
                key={performer.id}
                style={styles.topPerformerCard}
                onPress={() => navigation.navigate('AthleteDetail', { athleteId: performer.id })}
              >
                <View style={[
                  styles.topPerformerRank,
                  index === 0 && { backgroundColor: '#FFD700' },
                  index === 1 && { backgroundColor: '#C0C0C0' },
                  index === 2 && { backgroundColor: '#CD7F32' },
                ]}>
                  <Text style={styles.topPerformerRankText}>#{index + 1}</Text>
                </View>
                <Avatar 
  uri={performer.profile_photo}
  name={performer.name}
  size={60}
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
      {statistics?.recent_improvements?.length > 0 && (
        <>
          <Text style={styles.statisticsSection}>Recent Improvements</Text>
          <View style={styles.improvementsContainer}>
            {statistics.recent_improvements.map((improvement: any, index: number) => (
              <View key={index} style={styles.improvementCard}>
                <Avatar 
  uri={improvement.athlete.profile_photo}
  name={improvement.athlete.name}
  size={50}
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

      {/* Empty state for statistics */}
      {!statistics?.best_scores_by_type?.length && 
       !statistics?.top_performers?.length && (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No statistics available</Text>
          <Text style={styles.emptySubtext}>
            Statistics will appear once your athletes complete assessments
          </Text>
        </View>
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

          {/* Score Range */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Score Range</Text>
            <View style={styles.scoreRangeContainer}>
              <TextInput
                style={styles.scoreInput}
                placeholder="Min"
                placeholderTextColor={Theme.colors.textSecondary}
                value={filters.minScore}
                onChangeText={(val) => handleFilterChange('minScore', val)}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={styles.scoreInput}
                placeholder="Max"
                placeholderTextColor={Theme.colors.textSecondary}
                value={filters.maxScore}
                onChangeText={(val) => handleFilterChange('maxScore', val)}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Sort By */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.sortOptions}>
              {[
                { key: 'created_at', label: 'Date' },
                { key: 'ai_score', label: 'Score' },
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOption,
                    filters.sortBy === option.key && styles.sortOptionActive
                  ]}
                  onPress={() => handleFilterChange('sortBy', option.key)}
                >
                  <Text style={[
                    styles.sortOptionText,
                    filters.sortBy === option.key && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort Order */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Order</Text>
            <View style={styles.sortOptions}>
              {[
                { key: 'desc', label: 'Descending', icon: 'arrow-down' },
                { key: 'asc', label: 'Ascending', icon: 'arrow-up' },
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOption,
                    filters.sortOrder === option.key && styles.sortOptionActive
                  ]}
                  onPress={() => handleFilterChange('sortOrder', option.key)}
                >
                  <Ionicons 
                    name={option.icon as any} 
                    size={16} 
                    color={filters.sortOrder === option.key ? '#fff' : Theme.colors.textSecondary} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    filters.sortOrder === option.key && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Apply Button */}
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApplyFilters}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>

          {/* Clear Button */}
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearFilters}
          >
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <FontAwesome5 name="clipboard-list" size={64} color={Theme.colors.textSecondary} />
      <Text style={styles.emptyText}>No assessments found</Text>
      <Text style={styles.emptySubtext}>
        {filters.search || filters.testType !== 'all' || filters.minScore || filters.maxScore
          ? 'Try adjusting your filters'
          : 'Assessments will appear here when athletes complete them'}
      </Text>
      {(filters.search || filters.testType !== 'all' || filters.minScore || filters.maxScore) && (
        <TouchableOpacity 
          style={styles.clearFiltersButton}
          onPress={handleClearFilters}
        >
          <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Theme.colors.primary} />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={Theme.colors.error} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => loadAssessments(1, false)}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading && assessments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading assessments...</Text>
      </View>
    );
  }

  if (error && assessments.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        {renderError()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {viewMode === 'list' ? (
        <FlatList
          data={assessments}
          renderItem={({ item }) => <AssessmentCard item={item} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              tintColor={Theme.colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyList}
          ListFooterComponent={renderFooter}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              tintColor={Theme.colors.primary}
            />
          }
        >
          {renderStatisticsView()}
        </ScrollView>
      )}

      {renderFilterModal()}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  
  // Header
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
  
  // View Mode Toggle
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
  
  // Stats
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
  
  // Search
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
  filterButtonActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  tabsContent: {
    paddingRight: 20,
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
  
  // List
  listContent: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  
  // Assessment Card
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
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
  
  // Empty State
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
  clearFiltersButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Theme.colors.error,
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Footer Loader
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  
  // Statistics View
  statisticsContainer: {
    flex: 1,
    paddingBottom: 100,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  
  // Modal
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
    maxHeight: '80%',
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
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: 18,
    color: Theme.colors.textSecondary,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  sortOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sortOptionActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  sortOptionText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
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

