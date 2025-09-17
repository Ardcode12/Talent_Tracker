// app/(tabs)/connections.tsx
import React, { useRef, useEffect, useState } from 'react';
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
  Modal,
  TextInput,
  SectionList,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';
import { ScrollAnimatedView } from '../components/ScrollAnimatedView';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
// import { GlassmorphicCard } from '../../components/GlassmorphicCard';
import { 
  UltraGradientBackground,
  FloatingParticles,
  LiquidMorphAnimation,
  PrismaticCard,
  NeonGlowView
} from '../components/UltraPremiumEffects';
// import MaskedView from '@react-native-masked-view/masked-view';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Interfaces
interface Connection {
  id: string;
  name: string;
  profilePhoto: string;
  role: 'Athlete' | 'Coach' | 'Scout' | 'Organization';
  sport: string;
  location: string;
  isOnline: boolean;
  lastActive?: string;
  connections?: number;
  performance?: string;
  bio?: string;
  achievements?: string[];
  verified?: boolean;
}

interface ConnectionRequest {
  id: string;
  name: string;
  profilePhoto: string;
  sport: string;
  role: string;
  requestTime: string;
  mutualConnections?: number;
}

interface Group {
  id: string;
  name: string;
  logo: string;
  memberCount: number;
  description: string;
  type: 'Federation' | 'Academy' | 'Community';
}

// Sample Data
const SUGGESTED_CONNECTIONS: Connection[] = [
  {
    id: '1',
    name: 'Rahul Verma',
    profilePhoto: 'https://randomuser.me/api/portraits/men/1.jpg',
    role: 'Athlete',
    sport: 'Sprinter',
    location: 'Mumbai',
    isOnline: true,
    connections: 342,
    performance: '100m - 10.8s',
    verified: true,
  },
  {
    id: '2',
    name: 'Priya Singh',
    profilePhoto: 'https://randomuser.me/api/portraits/women/2.jpg',
    role: 'Coach',
    sport: 'Athletics',
    location: 'Delhi',
    isOnline: false,
    lastActive: '2h ago',
    connections: 567,
    achievements: ['National Coach Award 2023', 'Trained 50+ athletes'],
    verified: true,
  },
  {
    id: '3',
    name: 'Amit Kumar',
    profilePhoto: 'https://randomuser.me/api/portraits/men/3.jpg',
    role: 'Scout',
    sport: 'Football',
    location: 'Bangalore',
    isOnline: true,
    connections: 890,
  },
];

const CONNECTION_REQUESTS: ConnectionRequest[] = [
  {
    id: 'r1',
    name: 'Aman Gupta',
    profilePhoto: 'https://randomuser.me/api/portraits/men/10.jpg',
    sport: 'Football',
    role: 'Athlete',
    requestTime: '2h ago',
    mutualConnections: 5,
  },
  {
    id: 'r2',
    name: 'Sara Khan',
    profilePhoto: 'https://randomuser.me/api/portraits/women/11.jpg',
    sport: 'Basketball',
    role: 'Coach',
    requestTime: '1d ago',
    mutualConnections: 3,
  },
];

const MY_CONNECTIONS: Connection[] = [
  {
    id: 'c1',
    name: 'Neha Sharma',
    profilePhoto: 'https://randomuser.me/api/portraits/women/20.jpg',
    role: 'Athlete',
    sport: 'Basketball',
    location: 'Pune',
    isOnline: true,
    lastActive: 'Active now',
  },
  {
    id: 'c2',
    name: 'Karan Mehta',
    profilePhoto: 'https://randomuser.me/api/portraits/men/21.jpg',
    role: 'Athlete',
    sport: 'Athletics',
    location: 'Chennai',
    isOnline: false,
    lastActive: '1h ago',
  },
];

const GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'Indian Athletics Federation',
    logo: 'https://via.placeholder.com/100',
    memberCount: 5420,
    description: 'Official federation for athletics in India',
    type: 'Federation',
  },
  {
    id: 'g2',
    name: 'Khelo India Academy',
    logo: 'https://via.placeholder.com/100',
    memberCount: 3200,
    description: 'Government sports development program',
    type: 'Academy',
  },
];

const AI_RECOMMENDATIONS = [
  {
    id: 'ai1',
    text: 'Coach specializes in sprint training, matches your sport',
    icon: '🏃‍♂️',
    connectionId: '2',
  },
  {
    id: 'ai2',
    text: '5 athletes from your city with similar performance stats',
    icon: '📍',
    count: 5,
  },
];

export default function ConnectionsScreen() {
  const { scrollY, handleScroll, createScrollAnimation } = useScrollAnimations();
  const [selectedTab, setSelectedTab] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pendingRequests, setPendingRequests] = useState(CONNECTION_REQUESTS);
  const [myConnections, setMyConnections] = useState(MY_CONNECTIONS);
  
  // Animations
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const networkAnimation = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for online indicators
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect for cards
    Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Network animation
    Animated.loop(
      Animated.timing(networkAnimation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    // Wave animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleConnect = (connectionId: string) => {
    // Handle connection logic
  };

  const handleAcceptRequest = (requestId: string) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (request) {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      // Add to connections logic
    }
  };

  const handleIgnoreRequest = (requestId: string) => {
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
  };

  // Render Header
  const renderHeader = () => (
    <>
      <UltraGradientBackground />
      <LiquidMorphAnimation />
      <FloatingParticles />
      
      <View style={styles.header}>
        <ScrollAnimatedView animation="fadeIn" duration={1000}>
          {/* Network Animation Background */}
          <Animated.View style={[styles.networkBackground, {
            opacity: networkAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.6, 0.3],
            }),
          }]}>
            <NetworkLines />
          </Animated.View>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Connections</Text>
            <Text style={styles.headerSubtitle}>Expand Your Network</Text>
            
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{myConnections.length}</Text>
                <Text style={styles.statLabel}>Connections</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{pendingRequests.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>Groups</Text>
              </View>
            </View>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <BlurView intensity={80} style={styles.searchBlur}>
              <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search athletes, coaches, scouts..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
              />
              <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                <Ionicons name="filter" size={20} color={Theme.colors.primary} />
              </TouchableOpacity>
            </BlurView>
          </View>
          
          {/* Category Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
          >
            {['All', 'Athletes', 'Coaches', 'Scouts', 'Organizations'].map((tab, index) => (
              <ScrollAnimatedView
                key={tab}
                animation="slideInRight"
                delay={index * 50}
              >
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    selectedTab === tab.toLowerCase() && styles.tabButtonActive
                  ]}
                  onPress={() => setSelectedTab(tab.toLowerCase())}
                >
                  <Text style={[
                    styles.tabButtonText,
                    selectedTab === tab.toLowerCase() && styles.tabButtonTextActive
                  ]}>{tab}</Text>
                </TouchableOpacity>
              </ScrollAnimatedView>
            ))}
          </ScrollView>
        </ScrollAnimatedView>
      </View>
    </>
  );

  // Render Connection Requests Section
  const renderConnectionRequests = () => {
    if (pendingRequests.length === 0) return null;

    return (
      <View style={styles.section}>
        <ScrollAnimatedView animation="slideInLeft">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connection Requests</Text>
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{pendingRequests.length}</Text>
            </View>
          </View>
        </ScrollAnimatedView>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pendingRequests.map((request, index) => (
            <ScrollAnimatedView
              key={request.id}
              animation="fadeUp"
              delay={index * 100}
              style={styles.requestCard}
            >
              <PrismaticCard>
                <View style={styles.requestContent}>
                  {/* Animated Glow Background */}
                  <Animated.View style={[styles.requestGlow, {
                    opacity: glowAnimation,
                  }]} />
                  
                  <Image source={{ uri: request.profilePhoto }} style={styles.requestPhoto} />
                  <Text style={styles.requestName}>{request.name}</Text>
                  <Text style={styles.requestRole}>{request.role} • {request.sport}</Text>
                  
                  {request.mutualConnections && (
                    <View style={styles.mutualContainer}>
                      <Ionicons name="people" size={14} color={Theme.colors.primary} />
                      <Text style={styles.mutualText}>
                        {request.mutualConnections} mutual connections
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.requestActions}>
                    <TouchableOpacity 
                      style={styles.acceptButton}
                      onPress={() => handleAcceptRequest(request.id)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.ignoreButton}
                      onPress={() => handleIgnoreRequest(request.id)}
                    >
                      <Text style={styles.ignoreButtonText}>Ignore</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.requestTime}>{request.requestTime}</Text>
                </View>
              </PrismaticCard>
            </ScrollAnimatedView>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render Suggested Connections
  const renderSuggestedConnections = () => (
    <View style={styles.section}>
      <ScrollAnimatedView animation="slideInLeft">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggested Connections</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
      </ScrollAnimatedView>
      
      {SUGGESTED_CONNECTIONS.map((connection, index) => (
        <ScrollAnimatedView
          key={connection.id}
          animation="slideInRight"
          delay={index * 100}
          style={styles.connectionCard}
        >
          <TouchableOpacity>
            <View style={styles.connectionCardContent}>
              {/* Shimmer Effect */}
              <Animated.View
                style={[
                  styles.shimmerOverlay,
                  {
                    transform: [{
                      translateX: shimmerAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
                  style={styles.shimmerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>
              
              <View style={styles.connectionLeft}>
                <View style={styles.profilePhotoContainer}>
                  <Image source={{ uri: connection.profilePhoto }} style={styles.profilePhoto} />
                  {connection.isOnline && (
                    <Animated.View style={[styles.onlineIndicator, {
                      transform: [{ scale: pulseAnimation }],
                    }]} />
                  )}
                  {connection.verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.connectionCenter}>
                <Text style={styles.connectionName}>{connection.name}</Text>
                <Text style={styles.connectionRole}>
                  {connection.role} • {connection.sport}
                </Text>
                <View style={styles.connectionMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="location" size={12} color={Theme.colors.textSecondary} />
                    <Text style={styles.metaText}>{connection.location}</Text>
                  </View>
                  {connection.connections && (
                    <View style={styles.metaItem}>
                      <Ionicons name="people" size={12} color={Theme.colors.textSecondary} />
                      <Text style={styles.metaText}>{connection.connections} connections</Text>
                    </View>
                  )}
                </View>
                {connection.performance && (
                  <View style={styles.performanceBadge}>
                    <Text style={styles.performanceText}>{connection.performance}</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.connectionRight}>
                <TouchableOpacity 
                  style={styles.connectButton}
                  onPress={() => handleConnect(connection.id)}
                >
                  <Ionicons name="add" size={20} color={Theme.colors.primary} />
                  <Text style={styles.connectButtonText}>Connect</Text>
                </TouchableOpacity>
                {connection.isOnline ? (
                  <Text style={styles.statusText}>Active now</Text>
                ) : (
                  <Text style={styles.statusText}>{connection.lastActive}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </ScrollAnimatedView>
      ))}
    </View>
  );

  // Render AI Smart Recommendations
  const renderAIRecommendations = () => (
    <View style={styles.section}>
      <ScrollAnimatedView animation="fadeIn">
        <View style={styles.sectionHeader}>
          <View style={styles.aiHeaderIcon}>
            <MaterialCommunityIcons name="robot" size={24} color={Theme.colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>AI Smart Recommendations</Text>
        </View>
      </ScrollAnimatedView>
      
      {AI_RECOMMENDATIONS.map((rec, index) => (
        <ScrollAnimatedView
          key={rec.id}
          animation="bounceIn"
          delay={index * 150}
        >
          <TouchableOpacity style={styles.aiRecommendationCard}>
            <LinearGradient
              colors={[Theme.colors.primary + '10', Theme.colors.secondary + '10']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            
            <View style={styles.aiCardContent}>
              <Text style={styles.aiIcon}>{rec.icon}</Text>
              <View style={styles.aiTextContent}>
                <Text style={styles.aiRecommendationText}>{rec.text}</Text>
                {rec.count && (
                  <View style={styles.aiCountBadge}>
                    <Text style={styles.aiCountText}>{rec.count} matches</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.aiActionButton}>
                <Text style={styles.aiActionText}>View All</Text>
                <Ionicons name="arrow-forward" size={16} color={Theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </ScrollAnimatedView>
      ))}
    </View>
  );

  // Render My Connections
  const renderMyConnections = () => (
    <View style={styles.section}>
      <ScrollAnimatedView animation="slideInLeft">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Connections</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All ({myConnections.length})</Text>
          </TouchableOpacity>
        </View>
      </ScrollAnimatedView>
      
      {myConnections.slice(0, 3).map((connection, index) => (
        <ScrollAnimatedView
          key={connection.id}
          animation="fadeUp"
          delay={index * 100}
        >
          <TouchableOpacity style={styles.myConnectionCard}>
            <View style={styles.myConnectionContent}>
              <View style={styles.myConnectionLeft}>
                <Image source={{ uri: connection.profilePhoto }} style={styles.myConnectionPhoto} />
                <View style={[styles.statusIndicator, {
                  backgroundColor: connection.isOnline ? Theme.colors.success : Theme.colors.textSecondary,
                }]} />
              </View>
              
              <View style={styles.myConnectionInfo}>
                <Text style={styles.myConnectionName}>{connection.name}</Text>
                <Text style={styles.myConnectionRole}>{connection.sport}</Text>
                <Text style={styles.myConnectionStatus}>
                  {connection.isOnline ? 'Active now' : connection.lastActive}
                </Text>
              </View>
              
              <View style={styles.myConnectionActions}>
                <TouchableOpacity style={styles.messageButton}>
                  <Ionicons name="chatbubble" size={20} color={Theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileButton}>
                  <Ionicons name="person" size={20} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </ScrollAnimatedView>
      ))}
    </View>
  );

  // Render Popular Profiles (Leaderboard)
  const renderPopularProfiles = () => (
    <View style={styles.section}>
      <ScrollAnimatedView animation="fadeIn">
        <Text style={styles.sectionTitle}>Popular Profiles</Text>
      </ScrollAnimatedView>
      
      <View style={styles.leaderboardContainer}>
        <ScrollAnimatedView animation="slideInLeft" delay={100}>
          <TouchableOpacity style={styles.leaderboardCard}>
            <LinearGradient
              colors={[Theme.colors.accent + '20', Theme.colors.accent + '10']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.leaderboardEmoji}>🏆</Text>
            <View style={styles.leaderboardContent}>
              <Text style={styles.leaderboardTitle}>Top Connected Athlete</Text>
              <Text style={styles.leaderboardName}>Rahul Verma</Text>
              <Text style={styles.leaderboardSport}>Sprinter • 1.2k connections</Text>
            </View>
          </TouchableOpacity>
        </ScrollAnimatedView>
        
        <ScrollAnimatedView animation="slideInRight" delay={200}>
          <TouchableOpacity style={styles.leaderboardCard}>
            <LinearGradient
              colors={[Theme.colors.primary + '20', Theme.colors.primary + '10']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.leaderboardEmoji}>⚡</Text>
            <View style={styles.leaderboardContent}>
              <Text style={styles.leaderboardTitle}>Trending Coach</Text>
              <Text style={styles.leaderboardName}>Priya Singh</Text>
              <Text style={styles.leaderboardSport}>Athletics • 890 connections</Text>
            </View>
          </TouchableOpacity>
        </ScrollAnimatedView>
      </View>
    </View>
  );

  // Render Groups Section
  const renderGroups = () => (
    <View style={styles.section}>
      <ScrollAnimatedView animation="slideInLeft">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Join Groups & Academies</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Explore</Text>
          </TouchableOpacity>
        </View>
      </ScrollAnimatedView>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {GROUPS.map((group, index) => (
          <ScrollAnimatedView
            key={group.id}
            animation="zoomIn"
            delay={index * 100}
            style={styles.groupCard}
          >
            <NeonGlowView color={Theme.colors.primary}>
              <TouchableOpacity style={styles.groupContent}>
                <Image source={{ uri: group.logo }} style={styles.groupLogo} />
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupType}>{group.type}</Text>
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {group.description}
                </Text>
                
                <View style={styles.groupStats}>
                  <Ionicons name="people" size={16} color={Theme.colors.textSecondary} />
                  <Text style={styles.groupMemberCount}>{group.memberCount} members</Text>
                </View>
                
                <TouchableOpacity style={styles.joinGroupButton}>
                  <Text style={styles.joinGroupText}>Request to Join</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </NeonGlowView>
          </ScrollAnimatedView>
        ))}
      </ScrollView>
    </View>
  );

  // Render Notifications Banner
  const renderNotificationsBanner = () => (
    <ScrollAnimatedView animation="bounceIn" delay={300}>
      <TouchableOpacity style={styles.notificationBanner}>
        <LinearGradient
          colors={[Theme.colors.primary, Theme.colors.secondary]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        
        {/* Animated Wave Effect */}
        <Animated.View style={[styles.waveEffect, {
          opacity: waveAnimation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.3, 0],
          }),
          transform: [{
            scale: waveAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 2],
            }),
          }],
        }]} />
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationIcon}>
            <Ionicons name="notifications" size={20} color="#fff" />
          </View>
          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle}>5 New Coaches joined your network</Text>
            <Text style={styles.notificationSubtitle}>2 Pending Requests waiting for approval</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    </ScrollAnimatedView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {renderHeader()}
      
      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {renderNotificationsBanner()}
        {renderConnectionRequests()}
        {renderAIRecommendations()}
        {renderSuggestedConnections()}
        {renderPopularProfiles()}
        {renderMyConnections()}
        {renderGroups()}
        
        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>
      
      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            onPress={() => setShowFilterModal(false)}
          />
          <View style={styles.filterModalContent}>
            <BlurView intensity={100} style={StyleSheet.absoluteFillObject} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Connections</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
            {/* Add filter options here */}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Network Lines Component
const NetworkLines = () => (
  <View style={StyleSheet.absoluteFillObject}>
    {Array.from({ length: 5 }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.networkLine,
          {
            top: `${20 * i}%`,
            transform: [{ rotate: `${45 + i * 15}deg` }],
          },
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: Theme.spacing.md,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  networkBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  networkLine: {
    position: 'absolute',
    width: 200,
    height: 1,
    backgroundColor: Theme.colors.primary,
    opacity: 0.2,
  },
  headerContent: {
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: 4,
    textShadowColor: Theme.colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: Theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchContainer: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
    zIndex: 1,
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    marginHorizontal: Theme.spacing.sm,
    fontSize: 16,
    color: Theme.colors.text,
  },
  categoryTabs: {
    paddingHorizontal: Theme.spacing.md,
    zIndex: 1,
  },
  tabButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabButtonActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Theme.colors.text,
  },
  section: {
    marginTop: Theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  seeAllText: {
    fontSize: 16,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  requestBadge: {
    backgroundColor: Theme.colors.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: Theme.spacing.sm,
  },
  requestBadgeText: {
    color: Theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  requestCard: {
    width: 200,
    marginLeft: Theme.spacing.md,
    marginRight: Theme.spacing.sm,
  },
  requestContent: {
    alignItems: 'center',
    padding: Theme.spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  requestGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.primary,
    top: -50,
    right: -50,
  },
  requestPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Theme.spacing.md,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
  },
  requestName: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  requestRole: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  mutualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Theme.spacing.md,
  },
  mutualText: {
    fontSize: 12,
    color: Theme.colors.primary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.success,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    gap: 4,
  },
  acceptButtonText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  ignoreButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ignoreButtonText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
        fontWeight: '600',
  },
  requestTime: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  connectionCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  connectionCardContent: {
    flexDirection: 'row',
    padding: Theme.spacing.lg,
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '200%',
  },
  shimmerGradient: {
    flex: 1,
  },
  connectionLeft: {
    marginRight: Theme.spacing.md,
  },
  profilePhotoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.colors.success,
    borderWidth: 3,
    borderColor: Theme.colors.background,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionCenter: {
    flex: 1,
  },
  connectionName: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  connectionRole: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
  },
  connectionMeta: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  performanceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.primary + '20',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  performanceText: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  connectionRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
  },
  connectButtonText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  aiHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  aiRecommendationCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
  },
  aiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  aiIcon: {
    fontSize: 32,
    marginRight: Theme.spacing.md,
  },
  aiTextContent: {
    flex: 1,
  },
  aiRecommendationText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 22,
  },
  aiCountBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  aiCountText: {
    fontSize: 14,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  aiActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiActionText: {
    fontSize: 14,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  myConnectionCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  myConnectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  myConnectionLeft: {
    position: 'relative',
    marginRight: Theme.spacing.md,
  },
  myConnectionPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  myConnectionInfo: {
    flex: 1,
  },
  myConnectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  myConnectionRole: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  myConnectionStatus: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  myConnectionActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  messageButton: {
    padding: 8,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary + '20',
  },
  profileButton: {
    padding: 8,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  leaderboardContainer: {
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  leaderboardCard: {
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leaderboardEmoji: {
    fontSize: 48,
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -24,
    opacity: 0.3,
  },
  leaderboardContent: {
    zIndex: 1,
  },
  leaderboardTitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leaderboardName: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  leaderboardSport: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  groupCard: {
    width: 220,
    marginLeft: Theme.spacing.md,
    marginRight: Theme.spacing.sm,
  },
  groupContent: {
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  groupLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  groupType: {
    fontSize: 12,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Theme.spacing.sm,
  },
  groupDescription: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Theme.spacing.md,
  },
  groupMemberCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  joinGroupButton: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
  joinGroupText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  notificationBanner: {
    marginHorizontal: Theme.spacing.md,
    marginVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  waveEffect: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  filterModalContent: {
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  bottomSpacing: {
    height: 100,
  },
});
