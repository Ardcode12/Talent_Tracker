// app/(tabs)/connections.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Theme } from '../constants/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '../services/api';
import { startConversation } from '../services/api';
import { useNavigation } from '@react-navigation/native';

 // ADD THIS LINE


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_URL = 'http://10.194.241.35:8000/api'; // Update with your backend URL

// Interfaces
interface Connection {
  id: string;
  name: string;
  profilePhoto: string;
  role: string;
  sport: string;
  location: string;
  bio?: string;
  isOnline: boolean;
  lastActive?: string;
  connections?: number;
  performance?: string;
  verified?: boolean;
  age?: number;
  experience?: number;
  achievements?: string;
  hasPendingRequest?: boolean;
  requestStatus?: string;
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
  type: string;
}

export default function ConnectionsScreen() {
  // State
   const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedTab, setSelectedTab] = useState('discover');
  const [selectedRole, setSelectedRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Connection | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Data states
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [availableConnections, setAvailableConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Get auth token
  const getAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  // Fetch helper function
  const fetchWithAuth = async (url: string, options: any = {}) => {
    const token = await getAuthToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
// Add this function after your other handler functions
const handleMessage = async (user: Connection) => {
  try {
    const response = await startConversation(user.id);
    navigation.navigate('ChatScreen', {
      conversationId: response.conversation_id,
      otherUser: user
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    Alert.alert('Error', 'Failed to start conversation');
  }
};

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  // Fetch all data
  const fetchData = async (resetPage = true) => {
  try {
    if (resetPage) {
      setLoading(true);
      setCurrentPage(1);
    }

    const [connectionsData, requestsData, groupsData] = await Promise.all([
      fetchWithAuth(`${API_URL}/connections`),
      fetchWithAuth(`${API_URL}/connections/requests`),
      fetchWithAuth(`${API_URL}/connections/groups`),
    ]);

    // Process profile photos for connections
    const processedConnections = (connectionsData.data || []).map(conn => ({
      ...conn,
      profilePhoto: getImageUrl(conn.profilePhoto)
    }));

    // Process profile photos for requests
    const processedRequests = (requestsData.data || []).map(req => ({
      ...req,
      profilePhoto: getImageUrl(req.profilePhoto)
    }));

    setMyConnections(processedConnections);
    setPendingRequests(processedRequests);
    setGroups(groupsData.data || []);

    // Fetch available connections
    await fetchAvailableConnections(1, true);

  } catch (error) {
    console.error('Error fetching data:', error);
    Alert.alert('Error', 'Failed to load connections');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  // Fetch available connections with filters
  const fetchAvailableConnections = async (page = 1, reset = false) => {
  try {
    if (!reset && loadingMore) return;
    
    setLoadingMore(true);
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(selectedRole !== 'all' && { role: selectedRole }),
      ...(searchText && { search: searchText }),
    });

    const response = await fetchWithAuth(`${API_URL}/connections/available?${params}`);
    
    // Process profile photos
    const processedData = (response.data || []).map(user => ({
      ...user,
      profilePhoto: getImageUrl(user.profilePhoto)
    }));
    
    if (reset) {
      setAvailableConnections(processedData);
    } else {
      setAvailableConnections(prev => [...prev, ...processedData]);
    }
    
    setCurrentPage(page);
    setTotalPages(response.pagination?.pages || 1);
    
  } catch (error) {
    console.error('Error fetching available connections:', error);
  } finally {
    setLoadingMore(false);
  }
};

  // Send connection request
  const handleConnect = async (connectionId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/connections/request/${connectionId}`, {
        method: 'POST',
      });
      
      Alert.alert('Success', 'Connection request sent!');
      
      // Update the user's pending status in the list
      setAvailableConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId 
            ? { ...conn, hasPendingRequest: true, requestStatus: 'pending' }
            : conn
        )
      );
      
      // Close modal if open
      setShowUserModal(false);
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  // Other handler functions remain the same...
  const handleAcceptRequest = async (requestId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/connections/accept/${requestId}`, {
        method: 'POST',
      });
      
      Alert.alert('Success', 'Connection request accepted!');
      await fetchData();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleIgnoreRequest = async (requestId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/connections/reject/${requestId}`, {
        method: 'DELETE',
      });
      
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      Alert.alert('Success', 'Request ignored');
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    Alert.alert(
      'Remove Connection',
      'Are you sure you want to remove this connection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetchWithAuth(`${API_URL}/connections/remove/${connectionId}`, {
                method: 'DELETE',
              });
              
              setMyConnections(prev => prev.filter(c => c.id !== connectionId));
              Alert.alert('Success', 'Connection removed');
            } catch (error) {
              console.error('Error removing connection:', error);
              Alert.alert('Error', 'Failed to remove connection');
            }
          },
        },
      ]
    );
  };

  // Calculate time ago
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Refetch when search or role filter changes
    const delayDebounce = setTimeout(() => {
      if (selectedTab === 'discover') {
        fetchAvailableConnections(1, true);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchText, selectedRole]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // Render Header
  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={['rgba(20, 27, 45, 0.95)', 'rgba(20, 27, 45, 0.8)']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Connections</Text>
        <Text style={styles.headerSubtitle}>Build Your Sports Network</Text>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => setSelectedTab('connections')}
          >
            <Text style={styles.statNumber}>{myConnections.length}</Text>
            <Text style={styles.statLabel}>Connections</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => setSelectedTab('requests')}
          >
            <Text style={styles.statNumber}>{pendingRequests.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => setSelectedTab('discover')}
          >
            <Text style={styles.statNumber}>{availableConnections.length}+</Text>
            <Text style={styles.statLabel}>Discover</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <BlurView intensity={80} style={styles.searchBlur}>
          <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, sport, or location..."
            placeholderTextColor={Theme.colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
        </BlurView>
      </View>
      
      {/* Main Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.mainTabs}
      >
        {[
          { id: 'discover', label: 'Discover', icon: 'compass' },
          { id: 'connections', label: 'My Connections', icon: 'people' },
          { id: 'requests', label: 'Requests', icon: 'person-add' },
          { id: 'groups', label: 'Groups', icon: 'people-circle' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.mainTabButton,
              selectedTab === tab.id && styles.mainTabButtonActive
            ]}
            onPress={() => setSelectedTab(tab.id)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={selectedTab === tab.id ? Theme.colors.text : Theme.colors.textSecondary} 
            />
            <Text style={[
              styles.mainTabText,
              selectedTab === tab.id && styles.mainTabTextActive
            ]}>{tab.label}</Text>
            {tab.id === 'requests' && pendingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Role Filter (only for Discover tab) */}
      {selectedTab === 'discover' && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.roleFilter}
        >
          {['All', 'Athletes', 'Coaches', 'Scouts'].map(role => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleButton,
                selectedRole === role.toLowerCase() && styles.roleButtonActive
              ]}
              onPress={() => setSelectedRole(role.toLowerCase())}
            >
              <Text style={[
                styles.roleButtonText,
                selectedRole === role.toLowerCase() && styles.roleButtonTextActive
              ]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render Discover Tab (All available athletes and coaches)
  const renderDiscoverTab = () => {
    const renderUserCard = ({ item }: { item: Connection }) => (
      <TouchableOpacity
        style={styles.discoverCard}
        onPress={() => {
          setSelectedUser(item);
          setShowUserModal(true);
        }}
      >
        <View style={styles.discoverCardContent}>
          <View style={styles.discoverCardHeader}>
            <View style={styles.profileSection}>
              <Image 
  source={{ uri: item.profilePhoto || 'https://via.placeholder.com/80' }} 
  style={styles.discoverPhoto}
  onError={(e) => {
    console.log('Image load error:', e.nativeEvent.error);
  }}
/>

              {item.isOnline && <View style={styles.onlineIndicator} />}
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
            
            <View style={styles.discoverInfo}>
              <Text style={styles.discoverName}>{item.name}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{item.role}</Text>
              </View>
              <Text style={styles.discoverSport}>{item.sport}</Text>
              
              <View style={styles.discoverMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={12} color={Theme.colors.textSecondary} />
                  <Text style={styles.metaText}>{item.location || 'Not specified'}</Text>
                </View>
                {item.experience && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time" size={12} color={Theme.colors.textSecondary} />
                    <Text style={styles.metaText}>{item.experience}y exp</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {item.bio && (
            <Text style={styles.discoverBio} numberOfLines={2}>
              {item.bio}
            </Text>
          )}
          
          <View style={styles.discoverStats}>
            {item.connections !== undefined && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{item.connections}</Text>
                <Text style={styles.statLabel}>Connections</Text>
              </View>
            )}
            {item.performance && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{item.performance.split(': ')[1]}</Text>
                <Text style={styles.statLabel}>AI Score</Text>
              </View>
            )}
            {item.age && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{item.age}</Text>
                <Text style={styles.statLabel}>Age</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.connectButton,
              item.hasPendingRequest && styles.pendingButton
            ]}
            onPress={() => !item.hasPendingRequest && handleConnect(item.id)}
            disabled={item.hasPendingRequest}
          >
            {item.hasPendingRequest ? (
              <>
                <Ionicons name="hourglass" size={18} color="#fff" />
                <Text style={styles.connectButtonText}>Request Pending</Text>
              </>
            ) : (
              <>
                <Ionicons name="person-add" size={18} color="#fff" />
                <Text style={styles.connectButtonText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );

    return (
      <FlatList
        data={availableConnections}
        renderItem={renderUserCard}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.discoverRow}
        contentContainerStyle={styles.discoverContent}
        onEndReached={() => {
          if (currentPage < totalPages && !loadingMore) {
            fetchAvailableConnections(currentPage + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>No users found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your filters or search terms
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={Theme.colors.primary}
          />
        }
      />
    );
  };

  // Render Connection Requests Tab
  const renderRequestsTab = () => {
    if (pendingRequests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-add-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No pending requests</Text>
          <Text style={styles.emptyStateText}>
            When someone sends you a connection request, it will appear here
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent}>
        {pendingRequests.map(request => (
          <View key={request.id} style={styles.requestFullCard}>
            <Image 
              source={{ uri: request.profilePhoto || 'https://via.placeholder.com/60' }} 
              style={styles.requestFullPhoto} 
            />
            
            <View style={styles.requestFullInfo}>
              <Text style={styles.requestFullName}>{request.name}</Text>
              <Text style={styles.requestFullRole}>{request.role} • {request.sport}</Text>
              
              {request.mutualConnections > 0 && (
                <View style={styles.mutualContainer}>
                  <Ionicons name="people" size={14} color={Theme.colors.primary} />
                  <Text style={styles.mutualText}>
                    {request.mutualConnections} mutual connections
                  </Text>
                </View>
              )}
              
              <Text style={styles.requestTime}>{getTimeAgo(request.requestTime)}</Text>
            </View>
            
            <View style={styles.requestFullActions}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={() => handleAcceptRequest(request.id)}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={() => handleIgnoreRequest(request.id)}
              >
                <Ionicons name="close" size={18} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // Render My Connections Tab
  const renderConnectionsTab = () => {
    const filteredConnections = myConnections.filter(c => 
      !searchText || 
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.sport?.toLowerCase().includes(searchText.toLowerCase()) ||
      c.location?.toLowerCase().includes(searchText.toLowerCase())
    );

    if (filteredConnections.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>
            {searchText ? 'No connections found' : 'No connections yet'}
          </Text>
          <Text style={styles.emptyStateText}>
            {searchText 
              ? `No connections matching "${searchText}"`
              : 'Start building your network by connecting with athletes and coaches'
            }
          </Text>
          {!searchText && (
            <TouchableOpacity 
              style={styles.discoverButton}
              onPress={() => setSelectedTab('discover')}
            >
              <Text style={styles.discoverButtonText}>Discover People</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent}>
        {filteredConnections.map(connection => (
          <TouchableOpacity 
            key={connection.id} 
            style={styles.connectionFullCard}
            onPress={() => {
              setSelectedUser(connection);
              setShowUserModal(true);
            }}
          >
            <View style={styles.connectionFullContent}>
              <View style={styles.connectionFullLeft}>
                <Image 
                  source={{ uri: connection.profilePhoto || 'https://via.placeholder.com/60' }} 
                  style={styles.connectionFullPhoto} 
                />
                <View style={[styles.statusIndicator, {
                  backgroundColor: connection.isOnline ? Theme.colors.success : Theme.colors.textSecondary,
                }]} />
              </View>
              
              <View style={styles.connectionFullInfo}>
                <Text style={styles.connectionFullName}>{connection.name}</Text>
                <Text style={styles.connectionFullRole}>
                  {connection.role} • {connection.sport}
                </Text>
                <Text style={styles.connectionFullStatus}>
                  {connection.isOnline ? 'Active now' : connection.lastActive ? getTimeAgo(connection.lastActive) : 'Offline'}
                </Text>
              </View>
              
              <View style={styles.connectionFullActions}>
                <TouchableOpacity 
  style={styles.messageButton}
  onPress={() => handleMessage(connection)}
>
  <Ionicons name="chatbubble" size={20} color={Theme.colors.primary} />
</TouchableOpacity>

                <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => handleRemoveConnection(connection.id)}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render Groups Tab
  const renderGroupsTab = () => {
    if (groups.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="people-circle-outline" size={64} color={Theme.colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No groups available</Text>
          <Text style={styles.emptyStateText}>
            Groups and academies will appear here when available
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent}>
        <View style={styles.groupsGrid}>
          {groups.map(group => (
            <TouchableOpacity key={group.id} style={styles.groupFullCard}>
              <Image 
                source={{ uri: group.logo || 'https://via.placeholder.com/100' }} 
                style={styles.groupFullLogo} 
              />
              <Text style={styles.groupFullName}>{group.name}</Text>
              <Text style={styles.groupFullType}>{group.type}</Text>
              <Text style={styles.groupFullDescription} numberOfLines={2}>
                {group.description}
              </Text>
              
              <View style={styles.groupFullStats}>
                <Ionicons name="people" size={16} color={Theme.colors.textSecondary} />
                <Text style={styles.groupFullMembers}>{group.memberCount} members</Text>
              </View>
              
              <TouchableOpacity style={styles.joinGroupButton}>
                <Text style={styles.joinGroupText}>Request to Join</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  // User Profile Modal
  const renderUserModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setShowUserModal(false)}
          />
          
          <View style={styles.modalContent}>
            <ScrollView>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowUserModal(false)}
                >
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
                
                <Image 
                  source={{ uri: selectedUser.profilePhoto || 'https://via.placeholder.com/120' }}
                  style={styles.modalProfilePhoto}
                />
                
                {selectedUser.verified && (
                  <View style={styles.modalVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color={Theme.colors.primary} />
                  </View>
                )}
                
                <Text style={styles.modalName}>{selectedUser.name}</Text>
                <Text style={styles.modalRole}>{selectedUser.role} • {selectedUser.sport}</Text>
                
                {selectedUser.isOnline && (
                  <View style={styles.modalOnlineStatus}>
                    <View style={styles.modalOnlineDot} />
                    <Text style={styles.modalOnlineText}>Active now</Text>
                  </View>
                )}
              </View>
              
              {/* Modal Body */}
              <View style={styles.modalBody}>
                {/* Bio */}
                {selectedUser.bio && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>About</Text>
                    <Text style={styles.modalBio}>{selectedUser.bio}</Text>
                  </View>
                )}
                
                {/* Details */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Details</Text>
                  <View style={styles.modalDetails}>
                    {selectedUser.location && (
                      <View style={styles.modalDetailItem}>
                        <Ionicons name="location" size={16} color={Theme.colors.textSecondary} />
                        <Text style={styles.modalDetailText}>{selectedUser.location}</Text>
                      </View>
                    )}
                    {selectedUser.age && (
                      <View style={styles.modalDetailItem}>
                        <Ionicons name="calendar" size={16} color={Theme.colors.textSecondary} />
                        <Text style={styles.modalDetailText}>{selectedUser.age} years old</Text>
                      </View>
                    )}
                    {selectedUser.experience && (
                      <View style={styles.modalDetailItem}>
                        <Ionicons name="time" size={16} color={Theme.colors.textSecondary} />
                        <Text style={styles.modalDetailText}>{selectedUser.experience} years experience</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                {/* Achievements */}
                {selectedUser.achievements && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Achievements</Text>
                    <Text style={styles.modalAchievements}>{selectedUser.achievements}</Text>
                  </View>
                )}
                
                {/* Stats */}
                <View style={styles.modalStats}>
                  {selectedUser.connections !== undefined && (
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatValue}>{selectedUser.connections}</Text>
                      <Text style={styles.modalStatLabel}>Connections</Text>
                    </View>
                  )}
                  {selectedUser.performance && (
                    <View style={styles.modalStatBox}>
                      <Text style={styles.modalStatValue}>
                        {selectedUser.performance.split(': ')[1]}
                      </Text>
                      <Text style={styles.modalStatLabel}>AI Score</Text>
                    </View>
                  )}
                </View>
                
                {/* Action Button */}
                {!myConnections.find(c => c.id === selectedUser.id) && (
                  <TouchableOpacity
                    style={[
                      styles.modalConnectButton,
                      selectedUser.hasPendingRequest && styles.pendingButton
                    ]}
                    onPress={() => !selectedUser.hasPendingRequest && handleConnect(selectedUser.id)}
                    disabled={selectedUser.hasPendingRequest}
                  >
                    {selectedUser.hasPendingRequest ? (
                      <>
                        <Ionicons name="hourglass" size={20} color="#fff" />
                        <Text style={styles.modalConnectText}>Request Pending</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="person-add" size={20} color="#fff" />
                        <Text style={styles.modalConnectText}>Send Connection Request</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Main render based on selected tab
  const renderContent = () => {
    switch (selectedTab) {
      case 'discover':
        return renderDiscoverTab();
      case 'connections':
        return renderConnectionsTab();
      case 'requests':
        return renderRequestsTab();
      case 'groups':
        return renderGroupsTab();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {renderHeader()}
      {renderContent()}
      {renderUserModal()}
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
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  // ... continuing from styles

  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: 4,
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
    flex: 1,
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
  mainTabs: {
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  mainTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  mainTabButtonActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  mainTabTextActive: {
    color: Theme.colors.text,
  },
  tabBadge: {
    backgroundColor: Theme.colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: Theme.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  roleFilter: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  roleButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: Theme.spacing.sm,
  },
  roleButtonActive: {
    backgroundColor: Theme.colors.secondary,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  roleButtonTextActive: {
    color: Theme.colors.text,
  },

  // Discover Tab Styles
  discoverContent: {
    paddingHorizontal: Theme.spacing.sm,
    paddingTop: Theme.spacing.md,
    paddingBottom: 100,
  },
  discoverRow: {
    justifyContent: 'space-between',
  },
  discoverCard: {
    flex: 0.48,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  discoverCardContent: {
    padding: Theme.spacing.md,
  },
  discoverCardHeader: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.sm,
  },
  profileSection: {
    position: 'relative',
    marginRight: Theme.spacing.sm,
  },
  discoverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  discoverSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  discoverMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },
  discoverBio: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
    lineHeight: 16,
  },
  discoverStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    gap: 6,
  },
  pendingButton: {
    backgroundColor: Theme.colors.secondary,
  },
  connectButtonText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMore: {
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
  },

  // Requests Tab Styles
  scrollContent: {
    flex: 1,
    padding: Theme.spacing.md,
  },
  requestFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  requestFullPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Theme.spacing.md,
  },
  requestFullInfo: {
    flex: 1,
  },
  requestFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  requestFullRole: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  mutualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  mutualText: {
    fontSize: 12,
    color: Theme.colors.primary,
  },
  requestTime: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  requestFullActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  acceptButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Connections Tab Styles
  connectionFullCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  connectionFullContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  connectionFullLeft: {
    position: 'relative',
    marginRight: Theme.spacing.md,
  },
  connectionFullPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  connectionFullInfo: {
    flex: 1,
  },
  connectionFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  connectionFullRole: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  connectionFullStatus: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  connectionFullActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  messageButton: {
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary + '20',
  },
  moreButton: {
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  discoverButton: {
    marginTop: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
  discoverButtonText: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  // Groups Tab Styles
  groupsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  groupFullCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  groupFullLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  groupFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  groupFullType: {
    fontSize: 12,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Theme.spacing.sm,
  },
  groupFullDescription: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  groupFullStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Theme.spacing.md,
  },
  groupFullMembers: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  joinGroupButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.full,
  },
  joinGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: Theme.spacing.md,
    right: Theme.spacing.md,
    padding: Theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Theme.borderRadius.full,
  },
  modalProfilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: Theme.spacing.md,
    borderWidth: 3,
    borderColor: Theme.colors.primary,
  },
  modalVerifiedBadge: {
    position: 'absolute',
    top: 80,
    right: SCREEN_WIDTH / 2 - 80,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  modalRole: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
  },
  modalOnlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.success,
  },
  modalOnlineText: {
    fontSize: 14,
    color: Theme.colors.success,
  },
  modalBody: {
    padding: Theme.spacing.xl,
  },
  modalSection: {
    marginBottom: Theme.spacing.xl,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  modalBio: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  modalDetails: {
    gap: Theme.spacing.sm,
  },
  modalDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  modalDetailText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  modalAchievements: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.xl,
    paddingVertical: Theme.spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalStatBox: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  modalConnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    gap: Theme.spacing.sm,
  },
  modalConnectText: {
    color: Theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
