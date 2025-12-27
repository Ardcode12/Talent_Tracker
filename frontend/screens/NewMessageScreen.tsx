// frontend/screens/NewMessageScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import ApiService, { startConversation, getImageUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NewMessageScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [starting, setStarting] = useState(null); // Track which user we're starting chat with

  useEffect(() => {
    loadUserRole();
  }, []);

  useEffect(() => {
    if (currentUserRole) {
      loadUsers();
    }
  }, [currentUserRole, searchQuery]);

  const loadUserRole = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserRole(user.role || 'athlete');
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Use the new messaging-specific endpoint
      const params = new URLSearchParams({
        search: searchQuery,
        page: '1',
        limit: '50'
      });
      
      const response = await ApiService.makeAuthenticatedRequest(
        `/messaging/available-users?${params}`
      );
      
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to connections endpoint
      try {
        const fallbackResponse = await ApiService.makeAuthenticatedRequest('/connections');
        setUsers(fallbackResponse.data || []);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.sport?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUserSelect = async (user) => {
    try {
      setStarting(user.id);
      
      // Check if conversation already exists
      if (user.existingConversationId) {
        navigation.replace('ChatScreen', {
          conversationId: user.existingConversationId,
          otherUser: {
            id: parseInt(user.id),
            name: user.name,
            profile_photo: user.profilePhoto,
            sport: user.sport,
            role: user.role,
            is_online: user.isOnline
          }
        });
        return;
      }
      
      // Start new conversation
      const response = await startConversation(parseInt(user.id));
      
      navigation.replace('ChatScreen', {
        conversationId: response.conversation_id,
        otherUser: response.other_user || {
          id: parseInt(user.id),
          name: user.name,
          profile_photo: user.profilePhoto,
          sport: user.sport,
          role: user.role,
          is_online: user.isOnline
        }
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    } finally {
      setStarting(null);
    }
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        starting === item.id && styles.userItemDisabled
      ]}
      onPress={() => handleUserSelect(item)}
      disabled={starting !== null}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: item.profilePhoto || 'https://via.placeholder.com/50' }}
          style={styles.userAvatar}
        />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.existingConversationId && (
            <View style={styles.existingBadge}>
              <Text style={styles.existingBadgeText}>Chat exists</Text>
            </View>
          )}
        </View>
        <Text style={styles.userDetails}>
          {item.role === 'coach' ? '🏆' : '🏃'} {item.role} • {item.sport || 'Sport'} • {item.location || 'Location'}
        </Text>
      </View>
      
      {starting === item.id ? (
        <ActivityIndicator size="small" color={Theme.colors.primary} />
      ) : (
        <Ionicons name="chatbubble-outline" size={22} color={Theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color={Theme.colors.textSecondary} />
      <Text style={styles.emptyText}>No connections found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery 
          ? 'Try a different search term'
          : 'Connect with athletes and coaches first to message them'
        }
      </Text>
      {!searchQuery && (
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={() => navigation.navigate('Connections')}
        >
          <Text style={styles.connectButtonText}>Find Connections</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, sport, or location..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color={Theme.colors.primary} />
        <Text style={styles.infoBannerText}>
          You can message users you're connected with
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your connections...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            filteredUsers.length === 0 && styles.emptyListContent
          ]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Theme.colors.text,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userItemDisabled: {
    opacity: 0.6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  existingBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  existingBadgeText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  userDetails: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});