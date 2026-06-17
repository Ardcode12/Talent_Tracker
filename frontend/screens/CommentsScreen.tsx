// frontend/screens/CommentsScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfessionalIcon } from '../components/ui/ProfessionalIcon';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight,
  SlideInLeft,
  Layout 
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';
import { 
  getComments, 
  addComment, 
  deleteComment,
  likeComment,
  unlikeComment,
  getReplies,
  addReply,
  deleteReply,
  likeReply,
  unlikeReply,
  getImageUrlWithFallback 
} from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Reply {
  id: string;
  user: {
    id: string;
    name: string;
    profile_photo: string;
    sport?: string;
  };
  text: string;
  reply_to_user?: {
    id: string;
    name: string;
  } | null;
  likes_count: number;
  is_liked: boolean;
  is_own_reply: boolean;
  created_at: string;
}

interface Comment {
  id: string;
  user: {
    id: string;
    name: string;
    profile_photo: string;
    sport?: string;
  };
  text: string;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  is_own_comment: boolean;
  created_at: string;
  replies: Reply[];
  has_more_replies: boolean;
}

interface PostInfo {
  id: string;
  user_name: string;
  text: string;
}

interface ReplyingTo {
  commentId: string;
  userId: string;
  userName: string;
}

export default function CommentsScreen({ route, navigation }) {
  const { postId, postText, postUserName } = route.params;
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [postInfo, setPostInfo] = useState<PostInfo | null>(null);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadCurrentUser();
    loadComments();
  }, [postId]);

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id?.toString());
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  // frontend/screens/CommentsScreen.tsx
// Find and REPLACE the loadComments function

// frontend/screens/CommentsScreen.tsx
// Replace the entire loadComments, onRefresh, and handleSubmit sections

const loadComments = async () => {
  try {
    setIsLoading(true);
    console.log('[CommentsScreen] Loading comments for post:', postId);
    
    const response = await getComments(postId);
    console.log('[CommentsScreen] Got response');
    
    // Safely extract comments
    let commentsArray: Comment[] = [];
    
    if (response) {
      if (Array.isArray(response.data)) {
        commentsArray = response.data;
      } else if (Array.isArray(response)) {
        commentsArray = response;
      }
    }
    
    // Ensure each comment has required fields
    commentsArray = commentsArray.map(comment => ({
      ...comment,
      id: String(comment.id),
      likes_count: comment.likes_count || 0,
      replies_count: comment.replies_count || 0,
      is_liked: comment.is_liked || false,
      is_own_comment: comment.is_own_comment || false,
      replies: Array.isArray(comment.replies) ? comment.replies : [],
      has_more_replies: comment.has_more_replies || false,
    }));
    
    setComments(commentsArray);
    
    if (response?.post) {
      setPostInfo(response.post);
    }
    
    console.log('[CommentsScreen] Loaded', commentsArray.length, 'comments');
  } catch (error) {
    console.error('[CommentsScreen] Error:', error);
    Alert.alert('Error', 'Failed to load comments');
    setComments([]);
  } finally {
    setIsLoading(false);
  }
};

const onRefresh = useCallback(async () => {
  setIsRefreshing(true);
  try {
    await loadComments();
  } catch (error) {
    console.error('Refresh error:', error);
  } finally {
    setIsRefreshing(false);
  }
}, [postId]);

const handleSubmit = async () => {
  const trimmedText = inputText.trim();
  if (!trimmedText) return;
  
  Keyboard.dismiss();
  
  try {
    setIsSubmitting(true);
    
    if (replyingTo) {
      // Adding a reply
      const response = await addReply(
        postId, 
        replyingTo.commentId, 
        trimmedText,
        replyingTo.userId !== currentUserId ? parseInt(replyingTo.userId) : null
      );
      
      if (response && response.reply) {
        setComments(prev => prev.map(comment => {
          if (comment.id === replyingTo.commentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), response.reply],
              replies_count: (response.replies_count || comment.replies_count || 0) + 1,
              has_more_replies: false
            };
          }
          return comment;
        }));
        
        setExpandedReplies(prev => new Set(prev).add(replyingTo.commentId));
      }
      
      setReplyingTo(null);
    } else {
      // Adding a new comment
      const response = await addComment(postId, trimmedText);
      
      if (response && response.comment) {
        const newComment: Comment = {
          ...response.comment,
          id: String(response.comment.id),
          replies: [],
          replies_count: 0,
          has_more_replies: false,
          likes_count: 0,
          is_liked: false,
          is_own_comment: true,
        };
        
        setComments(prev => [newComment, ...prev]);
        
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    }
    
    setInputText('');
  } catch (error: any) {
    console.error('Error submitting:', error);
    Alert.alert('Error', error?.message || 'Failed to submit');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikeComment(postId, commentId);
      } else {
        await likeComment(postId, commentId);
      }
      
      setComments(prev => prev.map(comment => 
        comment.id === commentId
          ? {
              ...comment,
              is_liked: !isLiked,
              likes_count: isLiked ? comment.likes_count - 1 : comment.likes_count + 1
            }
          : comment
      ));
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleDeleteComment = (commentId: string, isOwnComment: boolean) => {
    if (!isOwnComment) {
      Alert.alert('Error', 'You can only delete your own comments');
      return;
    }

    Alert.alert(
      'Delete Comment',
      'Are you sure? This will also delete all replies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(postId, commentId);
              setComments(prev => prev.filter(c => c.id !== commentId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  // ==========================================
  // REPLY ACTIONS
  // ==========================================

  const handleReplyPress = (comment: Comment, replyToUser?: { id: string; name: string }) => {
    const targetUser = replyToUser || { id: comment.user.id, name: comment.user.name };
    
    setReplyingTo({
      commentId: comment.id,
      userId: targetUser.id,
      userName: targetUser.name
    });
    
    setInputText(`@${targetUser.name} `);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setInputText('');
    Keyboard.dismiss();
  };

  const handleLoadMoreReplies = async (commentId: string) => {
    if (loadingReplies.has(commentId)) return;
    
    try {
      setLoadingReplies(prev => new Set(prev).add(commentId));
      
      const response = await getReplies(postId, commentId, 1, 50);
      
      if (response.data) {
        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              replies: response.data,
              has_more_replies: response.has_more
            };
          }
          return comment;
        }));
        
        setExpandedReplies(prev => new Set(prev).add(commentId));
      }
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setLoadingReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleLikeReply = async (commentId: string, replyId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikeReply(postId, commentId, replyId);
      } else {
        await likeReply(postId, commentId, replyId);
      }
      
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: comment.replies.map(reply =>
              reply.id === replyId
                ? {
                    ...reply,
                    is_liked: !isLiked,
                    likes_count: isLiked ? reply.likes_count - 1 : reply.likes_count + 1
                  }
                : reply
            )
          };
        }
        return comment;
      }));
    } catch (error) {
      console.error('Error liking reply:', error);
    }
  };

  const handleDeleteReply = (commentId: string, replyId: string, isOwnReply: boolean) => {
    if (!isOwnReply) {
      Alert.alert('Error', 'You can only delete your own replies');
      return;
    }

    Alert.alert(
      'Delete Reply',
      'Are you sure you want to delete this reply?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReply(postId, commentId, replyId);
              
              setComments(prev => prev.map(comment => {
                if (comment.id === commentId) {
                  return {
                    ...comment,
                    replies: comment.replies.filter(r => r.id !== replyId),
                    replies_count: Math.max(0, comment.replies_count - 1)
                  };
                }
                return comment;
              }));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete reply');
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  // ==========================================
  // RENDER: REPLY ITEM
  // ==========================================

  const renderReply = (reply: Reply, comment: Comment) => (
    <Animated.View 
      key={reply.id}
      entering={SlideInLeft.springify()}
      layout={Layout.springify()}
      style={styles.replyContainer}
    >
      <TouchableOpacity
        onPress={() => {
          if (reply.user.id !== currentUserId) {
            navigation.navigate('UserProfile', { userId: parseInt(reply.user.id) });
          }
        }}
      >
        <Image
          source={{ uri: reply.user.profile_photo }}
          style={styles.replyAvatar}
        />
      </TouchableOpacity>
      
      <View style={styles.replyContent}>
        <View style={styles.replyBubble}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyUserName}>{reply.user.name}</Text>
            {reply.reply_to_user && (
              <Text style={styles.replyToText}>
                → <Text style={styles.replyToName}>@{reply.reply_to_user.name}</Text>
              </Text>
            )}
          </View>
          <Text style={styles.replyText}>{reply.text}</Text>
        </View>
        
        <View style={styles.replyActions}>
          <Text style={styles.replyTime}>{formatTimeAgo(reply.created_at)}</Text>
          
          <TouchableOpacity
            style={styles.replyActionButton}
            onPress={() => handleLikeReply(comment.id, reply.id, reply.is_liked)}
          >
            <Text style={[
              styles.replyActionText,
              reply.is_liked && { color: Theme.colors.accent }
            ]}>
              {reply.likes_count > 0 ? `${reply.likes_count} likes` : 'Like'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.replyActionButton}
            onPress={() => handleReplyPress(comment, { id: reply.user.id, name: reply.user.name })}
          >
            <Text style={styles.replyActionText}>Reply</Text>
          </TouchableOpacity>
          
          {reply.is_own_reply && (
            <TouchableOpacity
              style={styles.replyActionButton}
              onPress={() => handleDeleteReply(comment.id, reply.id, reply.is_own_reply)}
            >
              <Text style={[styles.replyActionText, { color: Theme.colors.error }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );

  // ==========================================
  // RENDER: COMMENT ITEM
  // ==========================================

  const renderComment = ({ item, index }: { item: Comment; index: number }) => (
    <Animated.View 
      entering={SlideInRight.delay(index * 50).springify()}
      layout={Layout.springify()}
      style={styles.commentContainer}
    >
      {/* Main Comment */}
      <View style={styles.commentRow}>
        <TouchableOpacity
          onPress={() => {
            if (item.user.id !== currentUserId) {
              navigation.navigate('UserProfile', { userId: parseInt(item.user.id) });
            }
          }}
        >
          <Image
            source={{ uri: item.user.profile_photo }}
            style={styles.commentAvatar}
          />
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUserName}>{item.user.name}</Text>
              {item.user.sport && (
                <Text style={styles.commentUserSport}>• {item.user.sport}</Text>
              )}
            </View>
            <Text style={styles.commentText}>{item.text}</Text>
          </View>
          
          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLikeComment(item.id, item.is_liked)}
            >
              <Text style={[
                styles.actionText,
                item.is_liked && { color: Theme.colors.accent, fontWeight: '700' }
              ]}>
                {item.likes_count > 0 ? `${item.likes_count} likes` : 'Like'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleReplyPress(item)}
            >
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            
            {item.is_own_comment && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteComment(item.id, item.is_own_comment)}
              >
                <Text style={[styles.actionText, { color: Theme.colors.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Like Button on right */}
        <TouchableOpacity
          style={styles.likeSideButton}
          onPress={() => handleLikeComment(item.id, item.is_liked)}
        >
          <ProfessionalIcon 
            name={item.is_liked ? "heart" : "heart-outline"} 
            size={16} 
            color={item.is_liked ? Theme.colors.accent : Theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Replies Section */}
      {(item.replies.length > 0 || item.replies_count > 0) && (
        <View style={styles.repliesSection}>
          {/* View Replies Button */}
          {item.replies_count > 0 && !expandedReplies.has(item.id) && (
            <TouchableOpacity
              style={styles.viewRepliesButton}
              onPress={() => handleLoadMoreReplies(item.id)}
            >
              <View style={styles.repliesLine} />
              {loadingReplies.has(item.id) ? (
                <ActivityIndicator size="small" color={Theme.colors.textSecondary} />
              ) : (
                <Text style={styles.viewRepliesText}>
                  View {item.replies_count} {item.replies_count === 1 ? 'reply' : 'replies'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Render Replies */}
          {expandedReplies.has(item.id) && item.replies.map(reply => renderReply(reply, item))}
          
          {/* Load More Replies */}
          {expandedReplies.has(item.id) && item.has_more_replies && (
            <TouchableOpacity
              style={styles.loadMoreReplies}
              onPress={() => handleLoadMoreReplies(item.id)}
            >
              {loadingReplies.has(item.id) ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more replies</Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Hide Replies */}
          {expandedReplies.has(item.id) && item.replies.length > 0 && (
            <TouchableOpacity
              style={styles.hideRepliesButton}
              onPress={() => {
                setExpandedReplies(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(item.id);
                  return newSet;
                });
              }}
            >
              <Text style={styles.hideRepliesText}>Hide replies</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );

  const renderHeader = () => (
    <View style={styles.postPreview}>
      <Text style={styles.postPreviewLabel}>Commenting on:</Text>
      <Text style={styles.postPreviewText} numberOfLines={2}>
        {postText || postInfo?.text || 'Post'}
      </Text>
      <Text style={styles.postPreviewUser}>
        by {postUserName || postInfo?.user_name || 'User'}
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ProfessionalIcon name="chatbubble-outline" size={64} color={Theme.colors.textSecondary} />
      <Text style={styles.emptyTitle}>No comments yet</Text>
      <Text style={styles.emptyText}>Be the first to comment!</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ProfessionalIcon name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={styles.headerRight}>
          <Text style={styles.commentCount}>{comments.length}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={Theme.colors.primary}
              />
            }
          />
        )}

        {/* Reply Indicator */}
        {replyingTo && (
          <Animated.View 
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.replyingToContainer}
          >
            <Text style={styles.replyingToText}>
              Replying to <Text style={styles.replyingToName}>@{replyingTo.userName}</Text>
            </Text>
            <TouchableOpacity onPress={handleCancelReply}>
              <ProfessionalIcon name="close" size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={replyingTo ? `Reply to @${replyingTo.userName}...` : "Write a comment..."}
            placeholderTextColor={Theme.colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSubmitting) && styles.sendButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!inputText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ProfessionalIcon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  commentCount: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
  postPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.primary,
  },
  postPreviewLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  postPreviewText: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 20,
  },
  postPreviewUser: {
    fontSize: 12,
    color: Theme.colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },
  
  // Comment Styles
  commentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  commentUserSport: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginLeft: 6,
  },
  commentText: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
    gap: 16,
  },
  commentTime: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  actionButton: {
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  likeSideButton: {
    padding: 8,
    marginLeft: 8,
  },
  
  // Replies Section
  repliesSection: {
    marginLeft: 52,
    marginTop: 8,
  },
  viewRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  repliesLine: {
    width: 24,
    height: 1,
    backgroundColor: Theme.colors.textSecondary,
    marginRight: 8,
  },
  viewRepliesText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  
  // Reply Styles
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyContent: {
    flex: 1,
  },
  replyBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderTopLeftRadius: 4,
    padding: 10,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  replyUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  replyToText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginLeft: 4,
  },
  replyToName: {
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 13,
    color: Theme.colors.text,
    lineHeight: 18,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 4,
    gap: 12,
  },
  replyTime: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  replyActionButton: {
    paddingVertical: 2,
  },
  replyActionText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  loadMoreReplies: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  hideRepliesButton: {
    paddingVertical: 8,
  },
  hideRepliesText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Reply Indicator
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyingToText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  replyingToName: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: Theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 16,
    fontSize: 15,
    color: Theme.colors.text,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});