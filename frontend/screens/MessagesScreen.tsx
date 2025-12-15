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
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import {
  getConversations,
  startConversation,
  getUnreadCount,
} from '../services/api';

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    loadConversations();
    checkUnreadCount();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkUnreadCount = async () => {
    const count = await getUnreadCount();
    setUnreadTotal(count);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
    checkUnreadCount();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastMessageTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => navigation.navigate('ChatScreen', { 
        conversationId: item.id,
        otherUser: item.other_user
      })}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: item.other_user.profile_photo || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        {item.is_online && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName}>{item.other_user.name}</Text>
          {item.last_message_at && (
            <Text style={styles.timestamp}>
              {formatLastMessageTime(item.last_message_at)}
            </Text>
          )}
        </View>
        
        <View style={styles.conversationFooter}>
          <Text 
            style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.unreadMessage
            ]}
            numberOfLines={1}
          >
            {item.last_message_preview || 'Start a conversation'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.userRole}>
          {item.other_user.role === 'coach' ? 'Coach' : 'Athlete'} • {item.other_user.sport}
        </Text>
      </View>
    </TouchableOpacity>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {unreadTotal > 0 && (
          <View style={styles.totalUnreadBadge}>
            <Text style={styles.totalUnreadText}>{unreadTotal} unread</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="chatbubbles-outline" 
              size={64} 
              color={Theme.colors.textSecondary} 
            />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation with an {' '}
              {navigation.getState().routes[0].params?.userRole === 'coach' ? 'athlete' : 'athlete or coach'}
            </Text>
          </View>
        }
      />

      {/* New Message FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewMessage')}
      >
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  totalUnreadBadge: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalUnreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Theme.colors.text,
  },
  listContent: {
    paddingBottom: 80,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 15,
    color: Theme.colors.textSecondary,
    marginRight: 8,
  },
  unreadMessage: {
    color: Theme.colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: Theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userRole: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
