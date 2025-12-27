// frontend/screens/CoachProfileScreen.tsx
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Theme } from '../constants/Theme';
import ApiService, { getImageUrl, logout } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CoachData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  sport?: string;
  specialization?: string;
  location?: string;
  age?: number;
  bio?: string;
  height?: string;
  weight?: string;
  achievements?: string;
  experience?: number;
  profile_image?: string;
  profile_photo?: string;
}

interface CoachStats {
  connected_athletes: number;
  total_assessments: number;
  pending_requests: number;
  top_performers: any[];
  recent_improvements: any[];
}

export default function CoachProfileScreen() {
  const navigation = useNavigation();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [modalVisible, setModalVisible] = useState(false);
  const [userData, setUserData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Stats
  const [coachStats, setCoachStats] = useState<CoachStats | null>(null);
  const [connectedAthletes, setConnectedAthletes] = useState<any[]>([]);
  const [assessmentStats, setAssessmentStats] = useState<any>(null);

  // Edit state
  const [tempBio, setTempBio] = useState('');
  const [tempInfo, setTempInfo] = useState({
    age: '',
    location: '',
    experience: '',
    specialization: '',
  });
  const [tempAchievements, setTempAchievements] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    try {
      setLoading(true);
      await loadUserData();
      await Promise.all([
        loadCoachStats(),
        loadConnectedAthletes(),
        loadAssessmentStats(),
      ]);
    } catch (error) {
      console.error('Error loading coach profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('userData');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserData(user);
        
        if (user.profile_image || user.profile_photo) {
          setProfileImage(getImageUrl(user.profile_image || user.profile_photo));
        }
        
        // Initialize edit values
        setTempBio(user.bio || '');
        setTempInfo({
          age: user.age?.toString() || '',
          location: user.location || '',
          experience: user.experience?.toString() || '',
          specialization: user.specialization || user.sport || '',
        });
        setTempAchievements(user.achievements || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadCoachStats = async () => {
    try {
      const stats = await ApiService.getCoachDashboardStats();
      if (stats) {
        setCoachStats(stats);
      }
    } catch (error) {
      console.error('Error loading coach stats:', error);
    }
  };

  const loadConnectedAthletes = async () => {
    try {
      const response = await ApiService.getCoachAthletes({ limit: 10 });
      if (response?.data) {
        setConnectedAthletes(response.data);
      }
    } catch (error) {
      console.error('Error loading connected athletes:', error);
    }
  };

  const loadAssessmentStats = async () => {
    try {
      const stats = await ApiService.getAssessmentStatistics();
      if (stats) {
        setAssessmentStats(stats);
      }
    } catch (error) {
      console.error('Error loading assessment stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
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
      formData.append('achievements', tempAchievements);

      if (tempProfileImage) {
        formData.append('profileImage', {
          uri: tempProfileImage,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);
      }

      const response = await ApiService.updateProfile(formData);

      if (response.user) {
        // Update with coach-specific fields
        const updatedUser = {
          ...response.user,
          experience: parseInt(tempInfo.experience) || userData.experience,
          specialization: tempInfo.specialization || userData.specialization,
        };
        
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        setUserData(updatedUser);
        setProfileImage(getImageUrl(response.user.profile_image));
        
        Alert.alert('Success', 'Profile updated successfully!');
        setModalVisible(false);
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const openEditModal = () => {
    setTempBio(userData?.bio || '');
    setTempInfo({
      age: userData?.age?.toString() || '',
      location: userData?.location || '',
      experience: userData?.experience?.toString() || '',
      specialization: userData?.specialization || userData?.sport || '',
    });
    setTempAchievements(userData?.achievements || '');
    setTempProfileImage(null);
    setModalVisible(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // ============================================
  // RENDER: Profile Header
  // ============================================
  const renderProfileHeader = () => (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.profileHeader}>
      <LinearGradient
        colors={['#2c3e50', '#3498db', 'transparent']}
        style={styles.headerGradient}
      />
      
      {/* Coach Badge */}
      <View style={styles.coachBadge}>
        <FontAwesome5 name="user-tie" size={12} color="#fff" />
        <Text style={styles.coachBadgeText}>COACH</Text>
      </View>
      
      <View style={styles.profileImageContainer}>
        <Image
          source={{ 
            uri: profileImage || 'https://via.placeholder.com/120' 
          }}
          style={styles.profileImage}
        />
        <View style={styles.editPhotoButton}>
          <TouchableOpacity onPress={openEditModal}>
            <Ionicons name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.userName}>{userData?.name || 'Coach'}</Text>
      <Text style={styles.userSpecialization}>
        {userData?.specialization || userData?.sport || 'Sports'} Coach
      </Text>
      
      {userData?.experience && (
        <View style={styles.experienceBadge}>
          <Ionicons name="time" size={14} color={Theme.colors.accent} />
          <Text style={styles.experienceText}>
            {userData.experience} years experience
          </Text>
        </View>
      )}
      
      {userData?.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={Theme.colors.textSecondary} />
          <Text style={styles.locationText}>{userData.location}</Text>
        </View>
      )}
      
      {userData?.bio && (
        <Text style={styles.bioText}>{userData.bio}</Text>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity 
          style={styles.statItem}
          onPress={() => navigation.navigate('Athletes' as never)}
        >
          <Text style={styles.statValue}>
            {coachStats?.connected_athletes || 0}
          </Text>
          <Text style={styles.statLabel}>Athletes</Text>
        </TouchableOpacity>
        
        <View style={styles.statDivider} />
        
        <TouchableOpacity 
          style={styles.statItem}
          onPress={() => navigation.navigate('Assessments' as never)}
        >
          <Text style={styles.statValue}>
            {coachStats?.total_assessments || 0}
          </Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </TouchableOpacity>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {coachStats?.pending_requests || 0}
          </Text>
          <Text style={styles.statLabel}>Requests</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => Alert.alert('Share', 'Share profile feature coming soon!')}
        >
          <Ionicons name="share-social-outline" size={20} color={Theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ============================================
  // RENDER: Tabs
  // ============================================
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid-outline' },
    { id: 'athletes', label: 'Athletes', icon: 'people-outline' },
    { id: 'performance', label: 'Performance', icon: 'analytics-outline' },
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
            <Text style={[
              styles.tabText, 
              activeTab === tab.id && styles.activeTabText
            ]}>
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
      {/* Coach Stats Card */}
      <View style={styles.coachStatsCard}>
        <LinearGradient
          colors={['#2c3e50', '#34495e']}
          style={styles.coachStatsGradient}
        >
          <View style={styles.coachStatsContent}>
            <View style={styles.coachStatItem}>
              <FontAwesome5 name="users" size={24} color="#3498db" />
              <Text style={styles.coachStatValue}>
                {coachStats?.connected_athletes || 0}
              </Text>
              <Text style={styles.coachStatLabel}>Connected Athletes</Text>
            </View>
            
            <View style={styles.coachStatDivider} />
            
            <View style={styles.coachStatItem}>
              <Ionicons name="document-text" size={24} color="#2ecc71" />
              <Text style={styles.coachStatValue}>
                {coachStats?.total_assessments || 0}
              </Text>
              <Text style={styles.coachStatLabel}>Assessments Reviewed</Text>
            </View>
            
            <View style={styles.coachStatDivider} />
            
            <View style={styles.coachStatItem}>
              <Ionicons name="notifications" size={24} color="#e74c3c" />
              <Text style={styles.coachStatValue}>
                {coachStats?.pending_requests || 0}
              </Text>
              <Text style={styles.coachStatLabel}>Pending Requests</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Athletes' as never)}
          >
            <LinearGradient
              colors={['#3498db', '#2980b9']}
              style={styles.quickActionGradient}
            >
              <FontAwesome5 name="users" size={24} color="#fff" />
              <Text style={styles.quickActionText}>View Athletes</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Assessments' as never)}
          >
            <LinearGradient
              colors={['#2ecc71', '#27ae60']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="analytics" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Assessments</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Messages' as never)}
          >
            <LinearGradient
              colors={['#9b59b6', '#8e44ad']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="chatbubbles" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Messages</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setActiveTab('athletes')}
          >
            <LinearGradient
              colors={['#e74c3c', '#c0392b']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="person-add" size={24} color="#fff" />
              <Text style={styles.quickActionText}>Find Athletes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Performers */}
      {assessmentStats?.top_performers && assessmentStats.top_performers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 Top Performers</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Assessments' as never)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {assessmentStats.top_performers.slice(0, 3).map((performer: any, index: number) => (
            <View key={performer.id} style={styles.performerCard}>
              <View style={styles.performerRank}>
                <Text style={styles.performerRankText}>#{index + 1}</Text>
              </View>
              <Image
                source={{ uri: performer.profile_photo || 'https://via.placeholder.com/50' }}
                style={styles.performerPhoto}
              />
              <View style={styles.performerInfo}>
                <Text style={styles.performerName}>{performer.name}</Text>
                <Text style={styles.performerSport}>{performer.sport}</Text>
              </View>
              <View style={styles.performerScore}>
                <Text style={styles.performerScoreValue}>{performer.average_score}%</Text>
                <Text style={styles.performerScoreLabel}>Avg Score</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Improvements */}
      {assessmentStats?.recent_improvements && assessmentStats.recent_improvements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Recent Improvements</Text>
          {assessmentStats.recent_improvements.slice(0, 3).map((improvement: any, index: number) => (
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
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Athletes Tab
  // ============================================
  const renderAthletesTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      {connectedAthletes.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            👥 Connected Athletes ({connectedAthletes.length})
          </Text>
          
          {connectedAthletes.map((athlete) => (
            <TouchableOpacity 
              key={athlete.id} 
              style={styles.athleteCard}
              onPress={() => navigation.navigate('AthleteDetail', { athleteId: athlete.id })}
            >
              <Image
                source={{ uri: athlete.profile_photo || 'https://via.placeholder.com/60' }}
                style={styles.athletePhoto}
              />
              <View style={styles.athleteInfo}>
                <Text style={styles.athleteName}>{athlete.name}</Text>
                <Text style={styles.athleteMeta}>
                  {athlete.sport} • {athlete.location || 'No location'}
                </Text>
                {athlete.latest_assessment && (
                  <Text style={styles.athleteLastAssessment}>
                    Last: {athlete.latest_assessment.test_type} - {athlete.latest_assessment.ai_score}%
                  </Text>
                )}
              </View>
              <View style={styles.athleteScore}>
                <Text style={styles.athleteScoreValue}>{athlete.ai_score || 0}%</Text>
                <Text style={styles.athleteScoreLabel}>AI Score</Text>
              </View>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Athletes' as never)}
          >
            <Text style={styles.viewAllButtonText}>View All Athletes</Text>
            <Ionicons name="arrow-forward" size={18} color={Theme.colors.primary} />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <FontAwesome5 name="users" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Athletes Connected</Text>
          <Text style={styles.emptyStateText}>
            Connect with athletes to track their progress and provide guidance
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Connections' as never)}
          >
            <Text style={styles.emptyStateButtonText}>Find Athletes</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Performance Tab
  // ============================================
  const renderPerformanceTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      {assessmentStats?.best_scores_by_type && assessmentStats.best_scores_by_type.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>📊 Assessment Statistics</Text>
          
          {assessmentStats.best_scores_by_type.map((stat: any) => (
            <View key={stat.test_type} style={styles.performanceCard}>
              <View style={styles.performanceHeader}>
                <MaterialIcons 
                  name={getTestTypeIcon(stat.test_type)} 
                  size={24} 
                  color={getTestTypeColor(stat.test_type)} 
                />
                <Text style={styles.performanceName}>
                  {formatTestTypeName(stat.test_type)}
                </Text>
              </View>
              
              <View style={styles.performanceStats}>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>{stat.best_score}%</Text>
                  <Text style={styles.performanceStatLabel}>Best Score</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>{stat.average_score}%</Text>
                  <Text style={styles.performanceStatLabel}>Average</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>{stat.total_assessments}</Text>
                  <Text style={styles.performanceStatLabel}>Total Tests</Text>
                </View>
              </View>
            </View>
          ))}
          
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Assessments' as never)}
          >
            <Text style={styles.viewAllButtonText}>View All Assessments</Text>
            <Ionicons name="arrow-forward" size={18} color={Theme.colors.primary} />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Assessment Data</Text>
          <Text style={styles.emptyStateText}>
            Assessment statistics will appear here as your athletes complete tests
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // ============================================
  // RENDER: Info Tab
  // ============================================
  const renderInfoTab = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.tabContent}>
      <Text style={styles.sectionTitle}>👤 Personal Information</Text>
      
      <View style={styles.infoCard}>
        {renderInfoRow('mail-outline', 'Email', userData?.email || 'Not provided')}
        {renderInfoRow('call-outline', 'Phone', userData?.phone || 'Not provided')}
        {renderInfoRow('calendar-outline', 'Age', userData?.age ? `${userData.age} years` : 'Not specified')}
        {renderInfoRow('location-outline', 'Location', userData?.location || 'Not specified')}
      </View>
      
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🏅 Coaching Details</Text>
      <View style={styles.infoCard}>
        {renderInfoRow('trophy-outline', 'Specialization', userData?.specialization || userData?.sport || 'Not specified')}
        {renderInfoRow('time-outline', 'Experience', userData?.experience ? `${userData.experience} years` : 'Not specified')}
        {renderInfoRow('people-outline', 'Connected Athletes', coachStats?.connected_athletes?.toString() || '0')}
        {renderInfoRow('document-text-outline', 'Assessments Reviewed', coachStats?.total_assessments?.toString() || '0')}
      </View>

      {/* Achievements Section */}
      {userData?.achievements && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🏆 Achievements</Text>
          <View style={styles.achievementsCard}>
            {parseAchievements(userData.achievements).map((achievement, index) => (
              <View key={index} style={styles.achievementItem}>
                <Ionicons name="star" size={16} color={Theme.colors.accent} />
                <Text style={styles.achievementText}>{achievement}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );

  const renderInfoRow = (icon: string, label: string, value: string) => (
    <>
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
    </>
  );

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
            <Text style={styles.modalTitle}>Edit Coach Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
            <Image
              source={{ 
                uri: tempProfileImage || profileImage || 'https://via.placeholder.com/120' 
              }}
              style={styles.modalProfileImage}
            />
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
              placeholder="Tell athletes about yourself and your coaching style..."
              placeholderTextColor={Theme.colors.textSecondary}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Specialization</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.specialization}
                onChangeText={(val) => setTempInfo({ ...tempInfo, specialization: val })}
                placeholder="e.g., Basketball, Football"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
            <View style={[styles.formSection, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Experience (years)</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.experience}
                onChangeText={(val) => setTempInfo({ ...tempInfo, experience: val })}
                keyboardType="numeric"
                placeholder="e.g., 10"
                placeholderTextColor={Theme.colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                value={tempInfo.age}
                onChangeText={(val) => setTempInfo({ ...tempInfo, age: val })}
                keyboardType="numeric"
                placeholder="Your age"
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

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Achievements & Certifications</Text>
            <TextInput
              style={[styles.formInput, styles.textAreaLarge]}
              value={tempAchievements}
              onChangeText={setTempAchievements}
              multiline
              numberOfLines={6}
              placeholder="🏆 List your achievements and certifications (one per line)..."
              placeholderTextColor={Theme.colors.textSecondary}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
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
    return testType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading coach profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {renderProfileHeader()}
        {renderTabs()}
        
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'athletes' && renderAthletesTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
        {activeTab === 'info' && renderInfoTab()}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {renderEditModal()}
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

  // Profile Header
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
    height: 220,
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  coachBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
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
    borderColor: '#2c3e50',
    backgroundColor: Theme.colors.surface,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  userSpecialization: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
    marginBottom: 8,
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    gap: 6,
  },
  experienceText: {
    color: Theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
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

  // Stats Row
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
    fontSize: 24,
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

  // Action Buttons
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
    backgroundColor: '#2c3e50',
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

  // Tabs
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
    borderBottomColor: '#2c3e50',
  },
  tabText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2c3e50',
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: 16,
  },

  // Coach Stats Card
  coachStatsCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  coachStatsGradient: {
    padding: 20,
  },
  coachStatsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  coachStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  coachStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  coachStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
  coachStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Section
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

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 56) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Performer Card
  performerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  performerRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  performerRankText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  performerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  performerSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  performerScore: {
    alignItems: 'flex-end',
  },
  performerScoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  performerScoreLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },

  // Improvement Card
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.success + '15',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
    fontWeight: '700',
    color: Theme.colors.success,
  },

  // Athlete Card
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  athletePhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  athleteMeta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  athleteLastAssessment: {
    fontSize: 11,
    color: Theme.colors.primary,
    marginTop: 4,
  },
  athleteScore: {
    alignItems: 'flex-end',
  },
  athleteScoreValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  athleteScoreLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },

  // Performance Card
  performanceCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  performanceName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  performanceStatItem: {
    alignItems: 'center',
  },
  performanceStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  performanceStatLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },

  // View All Button
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  viewAllButtonText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  // Info Card
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

  // Achievements
  achievementsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    gap: 10,
  },
  achievementText: {
    color: Theme.colors.text,
    fontSize: 14,
    flex: 1,
  },

  // Empty State
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
  emptyStateButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal
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
    backgroundColor: '#2c3e50',
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