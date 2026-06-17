// frontend/screens/EventsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Dimensions, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { ProfessionalIcon } from '../components/ui/ProfessionalIcon';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from '../components/SafeLinearGradient';
import { Theme } from '../constants/Theme';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const EVENT_TYPES = ['All', 'Training', 'Trial', 'Competition', 'Workshop', 'Camp'];

const EVENT_TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  Training:     { icon: 'barbell-outline',     color: '#3b82f6', bg: '#3b82f620' },
  Trial:        { icon: 'clipboard-outline',    color: '#FFB300', bg: '#FFB30020' },
  Competition:  { icon: 'trophy-outline',       color: '#ef4444', bg: '#ef444420' },
  Workshop:     { icon: 'school-outline',       color: '#8b5cf6', bg: '#8b5cf620' },
  Camp:         { icon: 'flame-outline',        color: '#22c55e', bg: '#22c55e20' },
  All:          { icon: 'calendar-outline',     color: '#667eea', bg: '#667eea20' },
};

function getConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG['All'];
}

function formatDate(isoStr: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(isoStr: string) {
  if (!isoStr) return null;
  const diff = new Date(isoStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  return days;
}

export default function EventsScreen({ navigation }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [userRole, setUserRole] = useState<string>('athlete');
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadUserRole();
      loadEvents();
    }, [activeFilter])
  );

  const loadUserRole = async () => {
    const role = await AsyncStorage.getItem('userRole');
    setUserRole(role || 'athlete');
  };

  const loadEvents = async () => {
    try {
      const params = activeFilter !== 'All' ? `?event_type=${activeFilter}` : '';
      const res = await ApiService.get(`/api/events/${params}`);
      setEvents(res.data || []);
    } catch (e) {
      console.error('Error loading events:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleRegister = async (event: any) => {
    if (event.is_registered) {
      // Unregister
      Alert.alert('Cancel Registration', 'Do you want to cancel your registration?', [
        { text: 'No' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.delete(`/api/events/${event.id}/register`);
              setEvents(prev => prev.map(e =>
                e.id === event.id ? { ...e, is_registered: false, current_participants: e.current_participants - 1 } : e
              ));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to unregister');
            }
          }
        }
      ]);
      return;
    }

    setRegisteringId(event.id);
    try {
      await ApiService.post(`/api/events/${event.id}/register`, {});
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, is_registered: true, current_participants: e.current_participants + 1 } : e
      ));
      Alert.alert('✅ Registered!', `You have registered for "${event.title}"`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to register');
    } finally {
      setRegisteringId(null);
    }
  };

  const renderFilterTab = (type: string) => {
    const cfg = getConfig(type);
    const isActive = activeFilter === type;
    return (
      <TouchableOpacity
        key={type}
        style={[styles.filterTab, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]}
        onPress={() => setActiveFilter(type)}
        activeOpacity={0.75}
      >
        <ProfessionalIcon name={cfg.icon as any} size={13} color={isActive ? '#fff' : Theme.colors.textSecondary} />
        <Text style={[styles.filterTabText, isActive && { color: '#fff', fontWeight: '700' }]}>{type}</Text>
      </TouchableOpacity>
    );
  };

  const renderEvent = ({ item: event }: { item: any }) => {
    const cfg = getConfig(event.event_type);
    const deadlineDays = event.registration_deadline ? daysLeft(event.registration_deadline) : null;
    const isFull = event.slots_left !== null && event.slots_left <= 0;
    const isCoachEvent = userRole === 'coach' && event.created_by === event.creator?.id;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('EventDetail', { event })}
      >
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
          <ProfessionalIcon name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{event.event_type}</Text>
        </View>

        {/* Title */}
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>

        {/* Coach info */}
        {event.creator && (
          <View style={styles.coachRow}>
            <Image
              source={{ uri: event.creator.profile_photo || `https://ui-avatars.com/api/?name=${event.creator.name}&background=random` }}
              style={styles.coachAvatar}
            />
            <Text style={styles.coachName}>{event.creator.name}</Text>
            <View style={styles.verifiedBadge}>
              <ProfessionalIcon name="checkmark-circle" size={13} color={Theme.colors.primary} />
              <Text style={styles.verifiedText}>Verified Coach</Text>
            </View>
          </View>
        )}

        {/* Details row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <ProfessionalIcon name="calendar-outline" size={13} color={Theme.colors.textSecondary} />
            <Text style={styles.detailText}>{formatDate(event.start_date)}</Text>
          </View>
          {event.location && (
            <View style={styles.detailItem}>
              <ProfessionalIcon name="location-outline" size={13} color={Theme.colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>{event.location}</Text>
            </View>
          )}
          {event.sport && (
            <View style={styles.detailItem}>
              <FontAwesome5 name="running" size={11} color={Theme.colors.textSecondary} />
              <Text style={styles.detailText}>{event.sport}</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {event.max_participants && (
            <View style={styles.statChip}>
              <ProfessionalIcon name="people-outline" size={13} color={Theme.colors.textSecondary} />
              <Text style={styles.statChipText}>
                {event.current_participants}/{event.max_participants}
              </Text>
            </View>
          )}
          {deadlineDays !== null && deadlineDays > 0 && (
            <View style={[styles.statChip, { backgroundColor: deadlineDays <= 3 ? '#ef444415' : undefined }]}>
              <ProfessionalIcon name="time-outline" size={13} color={deadlineDays <= 3 ? '#ef4444' : Theme.colors.textSecondary} />
              <Text style={[styles.statChipText, deadlineDays <= 3 && { color: '#ef4444' }]}>
                {deadlineDays}d left
              </Text>
            </View>
          )}
          {deadlineDays !== null && deadlineDays <= 0 && (
            <View style={[styles.statChip, { backgroundColor: '#ef444415' }]}>
              <Text style={[styles.statChipText, { color: '#ef4444' }]}>Closed</Text>
            </View>
          )}
        </View>

        {/* Action */}
        {userRole === 'athlete' && (
          <TouchableOpacity
            style={[
              styles.registerBtn,
              event.is_registered && styles.registeredBtn,
              isFull && !event.is_registered && styles.fullBtn,
            ]}
            onPress={() => handleRegister(event)}
            disabled={isFull && !event.is_registered || registeringId === event.id}
          >
            {registeringId === event.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <ProfessionalIcon
                  name={event.is_registered ? 'checkmark-circle' : isFull ? 'ban-outline' : 'add-circle-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.registerBtnText}>
                  {event.is_registered ? 'Registered ✓' : isFull ? 'Full' : 'Register'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {userRole === 'coach' && event.created_by === event.creator?.id && (
          <View style={styles.coachActions}>
            <TouchableOpacity
              style={styles.coachActionBtn}
              onPress={() => navigation.navigate('EventRegistrations', { eventId: event.id, title: event.title })}
            >
              <ProfessionalIcon name="people-outline" size={14} color={Theme.colors.primary} />
              <Text style={[styles.coachActionText, { color: Theme.colors.primary }]}>
                View {event.current_participants} Registrations
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ProfessionalIcon name="calendar-outline" size={64} color={Theme.colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Events Yet</Text>
      <Text style={styles.emptyText}>
        {userRole === 'coach'
          ? 'Create your first event for athletes to register!'
          : 'Check back soon for upcoming events and trials.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={styles.headerSub}>{events.length} upcoming</Text>
        </View>
        {userRole === 'coach' && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <LinearGradient
              colors={[Theme.colors.primary, Theme.colors.secondary]}
              style={styles.createBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ProfessionalIcon name="add" size={18} color="#fff" />
              <Text style={styles.createBtnText}>Create</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={EVENT_TYPES}
          keyExtractor={t => t}
          renderItem={({ item }) => renderFilterTab(item)}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      {/* Events list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: Theme.colors.elevated,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Theme.colors.text },
  headerSub: { fontSize: 13, color: Theme.colors.textSecondary, marginTop: 2 },

  createBtn: { borderRadius: 20, overflow: 'hidden' },
  createBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterContainer: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterTabText: { fontSize: 12, color: Theme.colors.textSecondary, fontWeight: '600' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Theme.colors.textSecondary, fontSize: 15 },

  listContent: { padding: 16, gap: 14, paddingBottom: 40 },

  eventCard: {
    backgroundColor: Theme.colors.elevated,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 10,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },

  eventTitle: { fontSize: 17, fontWeight: '800', color: Theme.colors.text, marginBottom: 10, lineHeight: 22 },

  coachRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  coachAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  coachName: { fontSize: 13, color: Theme.colors.textSecondary, fontWeight: '600', flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontSize: 11, color: Theme.colors.primary, fontWeight: '600' },

  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: Theme.colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statChipText: { fontSize: 11, color: Theme.colors.textSecondary, fontWeight: '600' },

  registerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Theme.colors.primary, borderRadius: 14,
    paddingVertical: 12,
  },
  registeredBtn: { backgroundColor: '#22c55e' },
  fullBtn: { backgroundColor: '#6b7280' },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  coachActions: { alignItems: 'flex-start' },
  coachActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  coachActionText: { fontSize: 13, fontWeight: '600' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
