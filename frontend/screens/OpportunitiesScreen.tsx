// app/(tabs)/opportunities.tsx
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
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';
import { ScrollAnimatedView } from '../components/ScrollAnimatedView';
import { useScrollAnimations } from '../hooks/useScrollAnimations';
import { GlassmorphicCard } from '../components/GlassmorphicCard';
import { 
  UltraGradientBackground,
  FloatingParticles,
  LiquidMorphAnimation,
  PrismaticCard,
  NeonGlowView
} from '../components/UltraPremiumEffects';
import MaskedView from '@react-native-masked-view/masked-view';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Interfaces
interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  sport: string;
  location: string;
  dateTime: string;
  type: 'Scholarship' | 'Trial' | 'Tournament' | 'Training Camp' | 'Government Program';
  eligibility: string;
  image?: string;
  amount?: string;
  benefits?: string[];
  deadline?: string;
  status?: 'Open' | 'Closing Soon' | 'Closed';
  applicants?: number;
  description?: string;
  requirements?: string[];
}

interface Filter {
  id: string;
  label: string;
  value: string;
  active: boolean;
}

// Sample Data
const FEATURED_OPPORTUNITY: Opportunity = {
  id: 'featured',
  title: 'National Athletics Trials 2025',
  organizer: 'Sports Authority of India',
  sport: 'Athletics',
  location: 'New Delhi',
  dateTime: '15 Oct 2025, 8:00 AM',
  type: 'Trial',
  eligibility: 'Age 16-25, National level performance',
  status: 'Open',
  applicants: 1250,
  description: 'Opportunity to represent India at international level',
};

const OPPORTUNITIES_DATA: Opportunity[] = [
  {
    id: '1',
    title: 'National Selection Trials for U18 Football',
    organizer: 'Sports Authority of India (SAI)',
    sport: 'Football',
    location: 'Delhi, India',
    dateTime: '25 Sept 2025, 9:00 AM',
    type: 'Trial',
    eligibility: 'Age 15-20, open for all states',
    status: 'Open',
    applicants: 850,
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
  },
  {
    id: '2',
    title: 'State-Level Sprint Championship',
    organizer: 'Maharashtra Athletics Federation',
    sport: 'Athletics',
    location: 'Mumbai, India',
    dateTime: '10 Oct 2025, 8:00 AM',
    type: 'Tournament',
    eligibility: 'Open category',
    status: 'Closing Soon',
    applicants: 432,
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
  },
];

const SCHOLARSHIPS_DATA: Opportunity[] = [
  {
    id: 's1',
    title: 'Khelo India Scholarship 2025',
    organizer: 'Ministry of Youth Affairs & Sports',
    sport: 'All Sports',
    location: 'Pan India',
    dateTime: 'Apply by 30 Sept 2025',
    type: 'Scholarship',
    amount: '₹50,000 per year',
    benefits: ['Free training support', 'Equipment allowance', 'Medical insurance'],
    eligibility: 'Athletes aged 14-21, all sports',
    deadline: '30 Sept 2025',
    status: 'Open',
  },
  {
    id: 's2',
    title: 'Rural Athletes Development Fund',
    organizer: 'SAI',
    sport: 'All Sports',
    location: 'Rural Areas',
    dateTime: 'Apply by 15 Oct 2025',
    type: 'Scholarship',
    amount: '₹30,000 per year',
    benefits: ['Monthly stipend', 'Travel allowance', 'Coaching support'],
    eligibility: 'Rural athletes under 23',
    deadline: '15 Oct 2025',
    status: 'Open',
  },
];

const TRAINING_CAMPS: Opportunity[] = [
  {
    id: 't1',
    title: 'High Performance Sprinting Camp',
    organizer: 'Indian Athletics Federation',
    sport: 'Athletics',
    location: 'Bangalore SAI Centre',
    dateTime: '1-30 Nov 2025',
    type: 'Training Camp',
    eligibility: 'Sub-12 second 100m runners',
    status: 'Open',
    requirements: ['Performance certificate', 'Medical fitness', 'Coach recommendation'],
  },
  {
    id: 't2',
    title: 'Football Elite Coaching Camp',
    organizer: 'AIFF',
    sport: 'Football',
    location: 'Goa',
    dateTime: '15-29 Dec 2025',
    type: 'Training Camp',
    eligibility: 'State level players',
    status: 'Open',
  },
];

const AI_RECOMMENDATIONS: Opportunity[] = [
  {
    id: 'ai1',
    title: 'Sprint Trials in Chennai',
    organizer: 'Tamil Nadu Athletics',
    sport: 'Athletics',
    location: 'Chennai',
    dateTime: '5 Oct 2025',
    type: 'Trial',
    eligibility: 'Matches your 100m sprint stats',
    status: 'Open',
  },
  {
    id: 'ai2',
    title: 'Scholarship for Rural Athletes',
    organizer: 'Government of India',
    sport: 'All Sports',
    location: 'Your District',
    dateTime: 'Apply soon',
    type: 'Scholarship',
    eligibility: 'AI detected eligibility based on location',
    status: 'Open',
  },
];

// Filter Categories
const SPORT_FILTERS: Filter[] = [
  { id: 'all', label: 'All Sports', value: 'all', active: true },
  { id: 'athletics', label: 'Athletics', value: 'athletics', active: false },
  { id: 'football', label: 'Football', value: 'football', active: false },
  { id: 'cricket', label: 'Cricket', value: 'cricket', active: false },
  { id: 'basketball', label: 'Basketball', value: 'basketball', active: false },
];

const TYPE_FILTERS: Filter[] = [
  { id: 'all-types', label: 'All Types', value: 'all', active: true },
  { id: 'scholarship', label: 'Scholarship', value: 'scholarship', active: false },
  { id: 'trial', label: 'Trial', value: 'trial', active: false },
  { id: 'tournament', label: 'Tournament', value: 'tournament', active: false },
  { id: 'camp', label: 'Training Camp', value: 'camp', active: false },
];

export default function OpportunitiesScreen() {
  const { scrollY, handleScroll, createScrollAnimation } = useScrollAnimations();
  const [selectedTab, setSelectedTab] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [savedOpportunities, setSavedOpportunities] = useState<string[]>([]);
  const [appliedOpportunities, setAppliedOpportunities] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Animations
  const heroAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hero section animation
    Animated.timing(heroAnimation, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for featured card
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnimation, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleSaveOpportunity = (id: string) => {
    setSavedOpportunities(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApplyOpportunity = (id: string) => {
    setAppliedOpportunities(prev => [...prev, id]);
  };

  // Render Header with Search and Filters
  const renderHeader = () => (
    <>
      <UltraGradientBackground />
      <FloatingParticles />
      
      <View style={styles.header}>
        <ScrollAnimatedView animation="fadeIn" duration={1000}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Opportunities</Text>
            <Text style={styles.headerSubtitle}>Unlock Your Potential</Text>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <BlurView intensity={80} style={styles.searchBlur}>
              <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search opportunities..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
              />
              <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                <Ionicons name="filter" size={20} color={Theme.colors.primary} />
              </TouchableOpacity>
            </BlurView>
          </View>
          
          {/* Quick Filters */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickFilters}
          >
            {TYPE_FILTERS.map((filter, index) => (
              <ScrollAnimatedView
                key={filter.id}
                animation="slideInRight"
                delay={index * 100}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filter.active && styles.filterChipActive
                  ]}
                  onPress={() => {/* Handle filter */}}
                >
                  <Text style={[
                    styles.filterChipText,
                    filter.active && styles.filterChipTextActive
                  ]}>{filter.label}</Text>
                </TouchableOpacity>
              </ScrollAnimatedView>
            ))}
          </ScrollView>
        </ScrollAnimatedView>
      </View>
    </>
  );

  // Render Featured Opportunity
  const renderFeaturedOpportunity = () => (
    <ScrollAnimatedView animation="fadeUp" delay={200}>
      <TouchableOpacity style={styles.featuredContainer}>
        <Animated.View style={[
          styles.featuredCard,
          {
            transform: [
              { scale: pulseAnimation },
              {
                translateY: floatingAnimation.interpolate({
                  inputRange: [-10, 0],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}>
          <LinearGradient
            colors={Theme.colors.gradient.premium}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Shimmer Effect */}
          <Animated.View
            style={[
              styles.shimmer,
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
              colors={['transparent', 'rgba(255,255,255,0.2)', 'transparent']}
              style={styles.shimmerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
          
          <View style={styles.featuredContent}>
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={16} color={Theme.colors.accent} />
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
            
            <Text style={styles.featuredTitle}>{FEATURED_OPPORTUNITY.title}</Text>
            <Text style={styles.featuredOrganizer}>{FEATURED_OPPORTUNITY.organizer}</Text>
            
            <View style={styles.featuredDetails}>
              <View key="location" style={styles.featuredDetailItem}>
                <Ionicons name="location" size={16} color={Theme.colors.text} />
                <Text style={styles.featuredDetailText}>{FEATURED_OPPORTUNITY.location}</Text>
              </View>
              <View key="calendar" style={styles.featuredDetailItem}>
                <Ionicons name="calendar" size={16} color={Theme.colors.text} />
                <Text style={styles.featuredDetailText}>{FEATURED_OPPORTUNITY.dateTime}</Text>
              </View>
            </View>
            
            <View style={styles.featuredStats}>
              <View style={styles.featuredStat}>
                <Text style={styles.featuredStatNumber}>{FEATURED_OPPORTUNITY.applicants}</Text>
                <Text style={styles.featuredStatLabel}>Applied</Text>
              </View>
              <View style={styles.featuredStatDivider} />
              <View style={styles.featuredStat}>
                <Text style={styles.featuredStatNumber}>15</Text>
                <Text style={styles.featuredStatLabel}>Days Left</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.featuredButton}>
              <Text style={styles.featuredButtonText}>Apply Now</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </ScrollAnimatedView>
  );

  // Render Opportunity Card
  const renderOpportunityCard = ({ item, index }: { item: Opportunity; index: number }) => {
    const isSaved = savedOpportunities.includes(item.id);
    const isApplied = appliedOpportunities.includes(item.id);
    
    return (
      <ScrollAnimatedView
        animation="slideInRight"
        delay={index * 100}
        style={styles.opportunityCard}
      >
        <PrismaticCard>
          <TouchableOpacity style={styles.cardContent}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.cardImage} />
            )}
            
            <View style={styles.cardHeader}>
              <View style={styles.cardTypeBadge}>
                <Text style={styles.cardTypeText}>{item.type}</Text>
              </View>
              {item.status === 'Closing Soon' && (
                <View style={styles.closingSoonBadge}>
                  <Text style={styles.closingSoonText}>Closing Soon</Text>
                </View>
              )}
            </View>
            
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardOrganizer}>{item.organizer}</Text>
              
              <View style={styles.cardDetails}>
                <View key={`${item.id}-location`} style={styles.cardDetailRow}>
                  <Ionicons name="location-outline" size={14} color={Theme.colors.textSecondary} />
                  <Text style={styles.cardDetailText}>{item.location}</Text>
                </View>
                <View key={`${item.id}-calendar`} style={styles.cardDetailRow}>
                  <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} />
                  <Text style={styles.cardDetailText}>{item.dateTime}</Text>
                </View>
                <View key={`${item.id}-people`} style={styles.cardDetailRow}>
                  <Ionicons name="people-outline" size={14} color={Theme.colors.textSecondary} />
                  <Text style={styles.cardDetailText}>{item.eligibility}</Text>
                </View>
              </View>
              
              {item.applicants && (
                <View style={styles.applicantsContainer}>
                  <View style={styles.applicantsAvatars}>
                    {[1, 2, 3].map((i) => (
                      <Image
                        key={`avatar-${item.id}-${i}`}
                        source={{ uri: `https://randomuser.me/api/portraits/men/${i + 20}.jpg` }}
                        style={[styles.applicantAvatar, { marginLeft: i > 1 ? -10 : 0 }]}
                      />
                    ))}
                  </View>
                  <Text style={styles.applicantsText}>+{item.applicants} applied</Text>
                </View>
              )}
              
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.saveButton, isSaved && styles.savedButton]}
                  onPress={() => handleSaveOpportunity(item.id)}
                >
                  <Ionicons 
                    name={isSaved ? "bookmark" : "bookmark-outline"} 
                    size={20} 
                    color={isSaved ? Theme.colors.accent : Theme.colors.text} 
                  />
                  <Text style={[styles.saveButtonText, isSaved && styles.savedButtonText]}>
                    {isSaved ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.applyButton, isApplied && styles.appliedButton]}
                  onPress={() => handleApplyOpportunity(item.id)}
                  disabled={isApplied}
                >
                  <Text style={styles.applyButtonText}>
                    {isApplied ? 'Applied' : 'Apply Now'}
                  </Text>
                  {!isApplied && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </PrismaticCard>
      </ScrollAnimatedView>
    );
  };

  // Render Scholarship Card
  const renderScholarshipCard = (scholarship: Opportunity, index: number) => (
    <ScrollAnimatedView
      key={scholarship.id}
      animation="fadeUp"
      delay={index * 100}
      style={styles.scholarshipCard}
    >
      <LinearGradient
        colors={['rgba(255, 179, 0, 0.1)', 'rgba(255, 179, 0, 0.05)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.scholarshipContent}>
        <View style={styles.scholarshipHeader}>
          <FontAwesome5 name="graduation-cap" size={24} color={Theme.colors.accent} />
          <View style={styles.scholarshipBadge}>
            <Text style={styles.scholarshipBadgeText}>SCHOLARSHIP</Text>
          </View>
        </View>
        
        <Text style={styles.scholarshipTitle}>{scholarship.title}</Text>
        <Text style={styles.scholarshipAmount}>{scholarship.amount}</Text>
        
        {scholarship.benefits && (
          <View style={styles.benefitsList}>
            {scholarship.benefits.map((benefit, i) => (
              <View key={`benefit-${scholarship.id}-${i}`} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={16} color={Theme.colors.success} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        )}
        
        <View style={styles.scholarshipFooter}>
          <Text style={styles.deadlineText}>Deadline: {scholarship.deadline}</Text>
          <TouchableOpacity style={styles.scholarshipApplyButton}>
            <Text style={styles.scholarshipApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollAnimatedView>
  );

  // Render Training Camp Card
  const renderTrainingCampCard = (camp: Opportunity, index: number) => (
    <ScrollAnimatedView
      key={camp.id}
      animation="slideInLeft"
      delay={index * 100}
      style={styles.campCard}
    >
      <View style={styles.campCardContent}>
        <View style={styles.campIcon}>
          <MaterialIcons name="sports" size={32} color={Theme.colors.primary} />
        </View>
        
        <View style={styles.campInfo}>
          <Text style={styles.campTitle}>{camp.title}</Text>
          <Text style={styles.campOrganizer}>{camp.organizer}</Text>
          
          <View style={styles.campDetails}>
            <View key={`${camp.id}-location`} style={styles.campDetailItem}>
              <Ionicons name="location" size={12} color={Theme.colors.textSecondary} />
              <Text style={styles.campDetailText}>{camp.location}</Text>
            </View>
            <View key={`${camp.id}-calendar`} style={styles.campDetailItem}>
              <Ionicons name="calendar" size={12} color={Theme.colors.textSecondary} />
              <Text style={styles.campDetailText}>{camp.dateTime}</Text>
            </View>
          </View>
          
          {camp.requirements && (
            <View style={styles.requirementsTags}>
              {camp.requirements.slice(0, 2).map((req, i) => (
                <View key={`req-${camp.id}-${i}`} style={styles.requirementTag}>
                  <Text style={styles.requirementTagText}>{req}</Text>
                </View>
              ))}
              {camp.requirements.length > 2 && (
                <Text style={styles.moreRequirements}>+{camp.requirements.length - 2} more</Text>
              )}
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.campApplyButton}>
          <Text style={styles.campApplyText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </ScrollAnimatedView>
  );

  // Render AI Recommendations
  const renderAIRecommendations = () => (
    <View style={styles.aiSection}>
      <ScrollAnimatedView animation="fadeIn">
        <View style={styles.sectionHeader}>
          <View style={styles.aiHeaderIcon}>
            <MaterialCommunityIcons name="robot" size={24} color={Theme.colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>AI Recommendations for You</Text>
        </View>
      </ScrollAnimatedView>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {AI_RECOMMENDATIONS.map((rec, index) => (
          <ScrollAnimatedView
            key={rec.id}
            animation="fadeUp"
            delay={index * 100}
            style={styles.aiCard}
          >
            <NeonGlowView color={Theme.colors.primary}>
              <View style={styles.aiCardContent}>
                <View style={styles.aiMatchBadge}>
                  <Text style={styles.aiMatchText}>AI MATCH</Text>
                </View>
                
                <Text style={styles.aiCardTitle}>{rec.title}</Text>
                <Text style={styles.aiCardReason}>{rec.eligibility}</Text>
                
                <View key={`ai-detail-${rec.id}`} style={styles.aiCardDetails}>
                  <Ionicons name="location" size={14} color={Theme.colors.textSecondary} />
                  <Text style={styles.aiCardDetailText}>{rec.location}</Text>
                </View>
                
                <TouchableOpacity style={styles.aiApplyButton}>
                  <Text style={styles.aiApplyText}>Apply</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </NeonGlowView>
          </ScrollAnimatedView>
        ))}
      </ScrollView>
    </View>
  );

  // Render Applied/Saved Section
  const renderAppliedSavedSection = () => (
    <View style={styles.trackingSection}>
      <ScrollAnimatedView animation="slideInLeft">
        <Text style={styles.sectionTitle}>Your Applications</Text>
      </ScrollAnimatedView>
      
      <ScrollAnimatedView animation="fadeUp" delay={200}>
        <View style={styles.statsContainer}>
          <View key="stat-applied" style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Theme.colors.primary + '20' }]}>
              <Ionicons name="paper-plane" size={24} color={Theme.colors.primary} />
            </View>
            <Text style={styles.statNumber}>{appliedOpportunities.length}</Text>
            <Text style={styles.statLabel}>Applied</Text>
          </View>
          
          <View key="stat-saved" style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Theme.colors.accent + '20' }]}>
              <Ionicons name="bookmark" size={24} color={Theme.colors.accent} />
            </View>
            <Text style={styles.statNumber}>{savedOpportunities.length}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          
          <View key="stat-selected" style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Theme.colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={24} color={Theme.colors.success} />
            </View>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Selected</Text>
          </View>
        </View>
      </ScrollAnimatedView>
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
        <View style={styles.notificationContent}>
          <View style={styles.notificationIcon}>
            <Ionicons name="notifications" size={20} color="#fff" />
          </View>
          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle}>3 New Opportunities in Athletics</Text>
            <Text style={styles.notificationSubtitle}>1 scholarship deadline approaching</Text>
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
        {renderFeaturedOpportunity()}
        {renderNotificationsBanner()}
        
        {/* Opportunities Feed */}
        <View style={styles.section}>
          <ScrollAnimatedView animation="slideInLeft">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Opportunities</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
          </ScrollAnimatedView>
          
          {OPPORTUNITIES_DATA.map((opportunity, index) => (
            <React.Fragment key={opportunity.id}>
              {renderOpportunityCard({ item: opportunity, index })}
            </React.Fragment>
          ))}
        </View>
        
        {/* Scholarships Section */}
        <View style={styles.section}>
          <ScrollAnimatedView animation="slideInRight">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Scholarships</Text>
              <FontAwesome5 name="graduation-cap" size={20} color={Theme.colors.accent} />
            </View>
          </ScrollAnimatedView>
          
          {SCHOLARSHIPS_DATA.map((scholarship, index) => (
            <React.Fragment key={scholarship.id}>
              {renderScholarshipCard(scholarship, index)}
            </React.Fragment>
          ))}
        </View>
        
        {/* Training Camps */}
        <View style={styles.section}>
          <ScrollAnimatedView animation="slideInLeft">
            <Text style={styles.sectionTitle}>Training Camps & Workshops</Text>
          </ScrollAnimatedView>
          
          {TRAINING_CAMPS.map((camp, index) => (
            <React.Fragment key={camp.id}>
              {renderTrainingCampCard(camp, index)}
            </React.Fragment>
          ))}
        </View>
        
        {/* AI Recommendations */}
        {renderAIRecommendations()}
        
        {/* Applied/Saved Section */}
        {renderAppliedSavedSection()}
        
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
              <Text style={styles.modalTitle}>Filters</Text>
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
  },
  headerContent: {
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
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
  },
  searchContainer: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
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
  quickFilters: {
    paddingHorizontal: Theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: Theme.colors.text,
  },
  featuredContainer: {
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  featuredCard: {
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    overflow: 'hidden',
    minHeight: 240,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerGradient: {
    width: '50%',
    height: '100%',
  },
  featuredContent: {
    position: 'relative',
    zIndex: 1,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
    marginBottom: Theme.spacing.md,
  },
  featuredBadgeText: {
    color: Theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  featuredTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  featuredOrganizer: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: Theme.spacing.lg,
  },
  featuredDetails: {
    flexDirection: 'row',
    gap: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  featuredDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  featuredDetailText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  featuredStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  featuredStat: {
    alignItems: 'center',
  },
  featuredStatNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  featuredStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  featuredStatDivider: {
    width: 1,
    height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: Theme.spacing.xl,
  },
  featuredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.full,
    gap: Theme.spacing.sm,
  },
  featuredButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  notificationBanner: {
    marginHorizontal: Theme.spacing.md,
    marginVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
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
  opportunityCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  cardContent: {
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  cardHeader: {
    position: 'absolute',
    top: Theme.spacing.md,
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTypeBadge: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  cardTypeText: {
    color: Theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  closingSoonBadge: {
    backgroundColor: Theme.colors.error,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  closingSoonText: {
    color: Theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    padding: Theme.spacing.lg,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  cardOrganizer: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.md,
  },
  cardDetails: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  cardDetailText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  applicantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  applicantsAvatars: {
    flexDirection: 'row',
    marginRight: Theme.spacing.sm,
  },
  applicantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  applicantsText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  savedButton: {
    backgroundColor: Theme.colors.accent + '20',
    borderColor: Theme.colors.accent,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  savedButtonText: {
    color: Theme.colors.accent,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
  appliedButton: {
    backgroundColor: Theme.colors.success,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  scholarshipCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.accent + '30',
  },
  scholarshipContent: {
    padding: Theme.spacing.lg,
  },
  scholarshipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  scholarshipBadge: {
    backgroundColor: Theme.colors.accent + '20',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  scholarshipBadgeText: {
    color: Theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scholarshipTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  scholarshipAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: Theme.colors.accent,
    marginBottom: Theme.spacing.md,
  },
  benefitsList: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  benefitText: {
    fontSize: 14,
    color: Theme.colors.text,
  },
  scholarshipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  scholarshipApplyButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.borderRadius.full,
  },
  scholarshipApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  campCard: {
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  campCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  campIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  campInfo: {
    flex: 1,
  },
  campTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  campOrganizer: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
  },
  campDetails: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  campDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  campDetailText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  requirementsTags: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
    alignItems: 'center',
  },
  requirementTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  requirementTagText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  moreRequirements: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  campApplyButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
  },
  campApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  aiSection: {
    marginTop: Theme.spacing.xxl,
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
  aiCard: {
    width: 280,
    marginLeft: Theme.spacing.md,
    marginRight: Theme.spacing.sm,
  },
  aiCardContent: {
    padding: Theme.spacing.lg,
  },
  aiMatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
    marginBottom: Theme.spacing.md,
  },
  aiMatchText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.text,
    letterSpacing: 0.5,
  },
  aiCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  aiCardReason: {
    fontSize: 14,
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.md,
  },
  aiCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.lg,
  },
  aiCardDetailText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  aiApplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
  aiApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  trackingSection: {
    marginTop: Theme.spacing.xxl,
    marginHorizontal: Theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
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
