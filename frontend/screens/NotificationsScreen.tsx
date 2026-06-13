// frontend/screens/NotificationsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../constants/Theme';
import {
  getNotifications,
  getImageUrlWithFallback,
  markAllNotificationsRead,
} from '../services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  user?: {
    id: string;
    name: string;
    profile_photo: string;
    sport?: string;
  };
  post_id?: string;
  reference_id?: number;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load + mark read every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications(1, 50);

      const processed = (response.data || []).map((n: any) => ({
        ...n,
        user: n.user
          ? {
              ...n.user,
              profile_photo: getImageUrlWithFallback(n.user.profile_photo, n.user.name),
            }
          : null,
      }));

      setNotifications(processed);
      const unread = processed.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);

      // Mark all as read on server (reduces badge count)
      if (unread > 0) {
        markAllNotificationsRead().catch(() => {});
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  // ── Icon config per type ──────────────────────────────────────────────────
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'connection_request':
        return { name: 'person-add', color: '#667eea', bg: '#667eea20' };
      case 'connection_accepted':
        return { name: 'people', color: '#22c55e', bg: '#22c55e20' };
      case 'new_message':
        return { name: 'chatbubble', color: '#3b82f6', bg: '#3b82f620' };
      case 'post_like':
        return { name: 'heart', color: '#ef4444', bg: '#ef444420' };
      case 'post_comment':
      case 'comment_reply':
        return { name: 'chatbubble-ellipses', color: '#2ecc71', bg: '#2ecc7120' };
      case 'assessment_complete':
        return { name: 'analytics', color: '#FFB300', bg: '#FFB30020' };
      case 'assessment_failed':
        return { name: 'warning', color: '#ef4444', bg: '#ef444420' };
      case 'mention':
        return { name: 'at', color: '#a855f7', bg: '#a855f720' };
      default:
        return { name: 'notifications', color: '#8E8E93', bg: '#8E8E9320' };
    }
  };

  // ── Time formatting ───────────────────────────────────────────────────────
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // ── Navigation on tap ─────────────────────────────────────────────────────
  const handleNotificationPress = (item: Notification) => {
    // Mark this item as read locally so dot disappears immediately
    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - (item.is_read ? 0 : 1)));

    switch (item.type) {
      case 'assessment_complete':
      case 'assessment_failed':
        // Go to the Assessments tab
        navigation.navigate('Main', { screen: 'Assessments' });
        break;
      case 'connection_request':
      case 'connection_accepted':
        navigation.navigate('ConnectionRequests');
        break;
      case 'new_message':
        navigation.navigate('Messages');
        break;
      default:
        break;
    }
  };

  // ── Mark all read ─────────────────────────────────────────────────────────
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);
    const isAssessment =
      item.type === 'assessment_complete' || item.type === 'assessment_failed';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.75}
      >
        {/* Icon circle */}
        <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name as any} size={22} color={icon.color} />
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={3}>
            {item.message}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            {isAssessment && (
              <View style={styles.tapHint}>
                <Ionicons name="arrow-forward-circle" size={14} color={icon.color} />
                <Text style={[styles.tapHintText, { color: icon.color }]}>
                  View Results
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* User avatar if present */}
        {item.user?.profile_photo && (
          <Image source={{ uri: item.user.profile_photo }} style={styles.userPhoto} />
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerBar}>
      <View>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Text style={styles.headerSub}>{unreadCount} unread</Text>
        )}
      </View>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done" size={16} color={Theme.colors.primary} />
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons
          name="notifications-off-outline"
          size={64}
          color={Theme.colors.textSecondary}
        />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        When you receive notifications, they'll appear here.
      </Text>
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderHeader()}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
            colors={[Theme.colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: Theme.colors.elevated,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: Theme.colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30,136,229,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markAllText: {
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Theme.colors.textSecondary,
    fontSize: 16,
  },

  // List
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 76,
  },

  // Notification item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unreadItem: {
    backgroundColor: 'rgba(30,136,229,0.07)',
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Theme.colors.primary,
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: Theme.colors.textTertiary,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userPhoto: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 6,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});