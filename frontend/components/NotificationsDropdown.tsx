// frontend/components/NotificationsDropdown.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { ProfessionalIcon } from './ui/ProfessionalIcon';
import { Theme } from '../constants/Theme';
import { getNotifications, markAllNotificationsRead } from '../services/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;

interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  onCountChange?: (count: number) => void;
}

export default function NotificationsDropdown({
  visible,
  onClose,
  navigation,
  onCountChange,
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      loadNotifications();
      // Slide down from top
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Slide back up
      Animated.timing(slideAnim, {
        toValue: -SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await getNotifications(1, 30);
      const data: any[] = response.data || [];
      setNotifications(data);
      const unread = data.filter((n) => !n.is_read).length;
      setUnreadCount(unread);

      // Mark all as read on server immediately so badge drops
      if (unread > 0) {
        markAllNotificationsRead().catch(() => {});
        onCountChange?.(0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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
      default:
        return { name: 'notifications', color: '#8E8E93', bg: '#8E8E9320' };
    }
  };

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
    return `${days}d ago`;
  };

  const handleNotificationPress = (item: any) => {
    // Mark this item read locally immediately
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - (item.is_read ? 0 : 1)));

    onClose();

    // Navigate to the correct screen
    switch (item.type) {
      case 'assessment_complete':
      case 'assessment_failed':
        // Go to Assessments tab
        navigation.navigate('Main', { screen: 'Assessments' });
        break;
      case 'new_message':
        navigation.navigate('Messages');
        break;
      case 'connection_request':
        navigation.navigate('ConnectionRequests');
        break;
      case 'connection_accepted':
        navigation.navigate('Connections');
        break;
      case 'post_like':
      case 'post_comment':
      case 'comment_reply':
        if (item.post_id) {
          navigation.navigate('PostDetail', { postId: item.post_id });
        }
        break;
      default:
        break;
    }
  };

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.type);
    const isAssessment =
      item.type === 'assessment_complete' || item.type === 'assessment_failed';
    const isMessage = item.type === 'new_message';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.75}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
          <ProfessionalIcon name={icon.name as any} size={20} color={icon.color} />
        </View>

        {/* Text */}
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            {(isAssessment || isMessage) && (
              <View style={styles.tapHint}>
                <ProfessionalIcon name="arrow-forward-circle" size={13} color={icon.color} />
                <Text style={[styles.tapHintText, { color: icon.color }]}>
                  {isAssessment ? 'View Results' : 'Open Chat'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Avatar */}
        {item.user?.profile_photo && (
          <Image source={{ uri: item.user.profile_photo }} style={styles.userPhoto} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      {/* Animated top sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} unread</Text>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <ProfessionalIcon name="close" size={20} color={Theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ProfessionalIcon name="notifications-off-outline" size={56} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id?.toString()}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        {/* Footer */}
        <TouchableOpacity
          style={styles.footer}
          onPress={() => {
            onClose();
            navigation.navigate('Notifications');
          }}
        >
          <Text style={styles.footerText}>See All Notifications</Text>
          <ProfessionalIcon name="chevron-forward" size={16} color={Theme.colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Dim overlay below — tap to close */}
      <TouchableOpacity style={styles.bottomOverlay} activeOpacity={1} onPress={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    display: 'none', // not used in top-sheet mode
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: Theme.colors.background,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    // Shadow at the bottom
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    display: 'none', // not needed at top
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: Theme.colors.elevated,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 68,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  unreadItem: {
    backgroundColor: 'rgba(30,136,229,0.07)',
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.primary,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary,
    marginLeft: 6,
  },
  message: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tapHintText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
});