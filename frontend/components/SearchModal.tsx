// frontend/components/SearchModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import { search, getSearchSuggestions } from '../services/api';
import { useDebouncedCallback } from '../hooks/useDebounce';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

export default function SearchModal({ visible, onClose, navigation }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ athletes: [], coaches: [], posts: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Debounced search
  const debouncedSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults({ athletes: [], coaches: [], posts: [] });
        return;
      }
      
      setLoading(true);
      try {
        const response = await search(searchQuery, activeTab);
        setResults(response);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        debouncedSearch(query);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, activeTab]);

  // Get suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length >= 1 && query.length < 3) {
        const sugg = await getSearchSuggestions(query);
        setSuggestions(sugg);
      } else {
        setSuggestions([]);
      }
    };
    
    fetchSuggestions();
  }, [query]);

  const handleResultPress = (type: string, item: any) => {
    onClose();
    Keyboard.dismiss();
    
    if (type === 'athlete' || type === 'coach') {
      navigation.navigate('Profile', { userId: item.id });
    } else if (type === 'post') {
      navigation.navigate('PostDetail', { postId: item.id });
    }
  };

  const renderAthleteItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress('athlete', item)}
    >
      <Image
        source={{ uri: item.profile_photo || 'https://via.placeholder.com/50' }}
        style={styles.resultPhoto}
      />
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultName}>{item.name}</Text>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={16} color={Theme.colors.primary} />
          )}
        </View>
        <Text style={styles.resultMeta}>
          🏃 {item.sport || 'Athlete'} • 📍 {item.location || 'India'}
        </Text>
        {item.ai_score && (
          <Text style={styles.resultScore}>AI Score: {item.ai_score}%</Text>
        )}
      </View>
      {item.national_rank && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{item.national_rank}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCoachItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress('coach', item)}
    >
      <Image
        source={{ uri: item.profile_photo || 'https://via.placeholder.com/50' }}
        style={styles.resultPhoto}
      />
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultName}>{item.name}</Text>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={16} color={Theme.colors.primary} />
          )}
        </View>
        <Text style={styles.resultMeta}>
          🏆 Coach • {item.sport || 'Sports'}
        </Text>
        {item.experience && (
          <Text style={styles.resultScore}>{item.experience} years experience</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPostItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress('post', item)}
    >
      {item.media_url ? (
        <Image
          source={{ uri: item.media_url }}
          style={styles.postThumbnail}
        />
      ) : (
        <View style={[styles.postThumbnail, styles.noMedia]}>
          <Ionicons name="document-text" size={24} color={Theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.postText} numberOfLines={2}>{item.text}</Text>
        <View style={styles.postMeta}>
          <Image
            source={{ uri: item.user?.profile_photo || 'https://via.placeholder.com/20' }}
            style={styles.postUserPhoto}
          />
          <Text style={styles.postUserName}>{item.user?.name}</Text>
          <Text style={styles.postStats}>
            ❤️ {item.likes_count} • 💬 {item.comments_count}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => setQuery(item.text)}
    >
      <Ionicons 
        name={item.type === 'athlete' ? 'person' : 'football'} 
        size={16} 
        color={Theme.colors.textSecondary} 
      />
      <Text style={styles.suggestionText}>{item.text}</Text>
      <Text style={styles.suggestionSubtext}>{item.subtext}</Text>
    </TouchableOpacity>
  );

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'athletes', label: 'Athletes' },
    { key: 'coaches', label: 'Coaches' },
    { key: 'posts', label: 'Posts' },
  ];

  const hasResults = results.athletes.length > 0 || results.coaches.length > 0 || results.posts.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={Theme.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search athletes, coaches, posts..."
              placeholderTextColor={Theme.colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
          </View>
        ) : query.length < 2 ? (
          // Show suggestions
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `sugg_${index}`}
            ListHeaderComponent={
              <Text style={styles.sectionHeader}>
                {suggestions.length > 0 ? 'Suggestions' : 'Start typing to search...'}
              </Text>
            }
            contentContainerStyle={styles.listContent}
          />
        ) : !hasResults ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No results found for "{query}"</Text>
            <Text style={styles.emptySubtext}>Try different keywords</Text>
          </View>
        ) : (
          <FlatList
            data={[
              ...(activeTab === 'all' || activeTab === 'athletes' ? 
                results.athletes.map(a => ({ ...a, _type: 'athlete' })) : []),
              ...(activeTab === 'all' || activeTab === 'coaches' ? 
                results.coaches.map(c => ({ ...c, _type: 'coach' })) : []),
              ...(activeTab === 'all' || activeTab === 'posts' ? 
                results.posts.map(p => ({ ...p, _type: 'post' })) : []),
            ]}
            renderItem={({ item }) => {
              if (item._type === 'athlete') return renderAthleteItem({ item });
              if (item._type === 'coach') return renderCoachItem({ item });
              if (item._type === 'post') return renderPostItem({ item });
              return null;
            }}
            keyExtractor={(item) => `${item._type}_${item.id}`}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Theme.colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  resultPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  resultMeta: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  resultScore: {
    fontSize: 12,
    color: Theme.colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  rankBadge: {
    backgroundColor: Theme.colors.accent + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Theme.colors.accent,
  },
  postThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  noMedia: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postText: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 20,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  postUserPhoto: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  postUserName: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginRight: 8,
  },
  postStats: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  suggestionText: {
    fontSize: 15,
    color: Theme.colors.text,
    flex: 1,
  },
  suggestionSubtext: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 8,
  },
});