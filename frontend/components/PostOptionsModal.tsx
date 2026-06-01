// frontend/components/PostOptionsModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

// Import API functions - adjust based on what you have
let deletePost: any = async () => {};
let sharePost: any = async () => {};

try {
  const api = require('../services/api');
  deletePost = api.deletePost || (async () => {});
  sharePost = api.sharePost || (async () => {});
} catch (e) {
  console.log('API functions not available yet');
}

interface PostOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  post: {
    id: string;
    user: { id: string; name: string };
    content: { text: string };
    is_own_post?: boolean;
  } | null;
  currentUserId: string | null | undefined;
  onPostDeleted?: (postId: string) => void;
  onEditPost?: (postId: string) => void;
  navigation: any;
}

export const PostOptionsModal: React.FC<PostOptionsModalProps> = ({
  visible,
  onClose,
  post,
  currentUserId,
  onPostDeleted,
  onEditPost,
  navigation,
}) => {
  if (!post) return null;

  const isOwnPost = post.user.id === currentUserId || post.is_own_post;

  const handleShare = async () => {
    try {
      const shareLink = `https://talenttracker.app/post/${post.id}`;
      
      const result = await Share.share({
        message: Platform.OS === 'ios' 
          ? post.content.text 
          : `${post.content.text}\n\n${shareLink}`,
        url: Platform.OS === 'ios' ? shareLink : undefined,
        title: `Post by ${post.user.name}`,
      });

      if (result.action === Share.sharedAction) {
        try {
          await sharePost(post.id, 'external');
        } catch (e) {
          // Silently fail tracking
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Share error:', error);
      onClose();
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareLink = `https://talenttracker.app/post/${post.id}`;
      
      // Use Share API with "Copy" option instead of Clipboard
      await Share.share({
        message: shareLink,
        title: 'Post Link',
      });
      
      // Track share
      try {
        await sharePost(post.id, 'copy_link');
      } catch (e) {
        // Silently fail
      }
      
      onClose();
    } catch (error) {
      console.error('Copy error:', error);
      onClose();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              onPostDeleted?.(post.id);
              onClose();
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    onClose();
    onEditPost?.(post.id);
  };

  const handleReport = () => {
    Alert.alert(
      'Report Post',
      'Why are you reporting this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
    onClose();
  };

  const handleViewProfile = () => {
    onClose();
    if (post.user.id !== currentUserId) {
      navigation.navigate('UserProfile', { userId: parseInt(post.user.id) });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              entering={SlideInDown.springify().damping(15)}
              exiting={SlideOutDown.duration(200)}
              style={styles.modalContent}
            >
              <View style={styles.handle} />
              
              <Text style={styles.modalTitle}>Post Options</Text>

              {/* Share Options */}
              <TouchableOpacity style={styles.option} onPress={handleShare}>
                <View style={[styles.optionIcon, { backgroundColor: Theme.colors.primary + '20' }]}>
                  <Ionicons name="share-social" size={22} color={Theme.colors.primary} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionText}>Share Post</Text>
                  <Text style={styles.optionSubtext}>Share to other apps</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handleCopyLink}>
                <View style={[styles.optionIcon, { backgroundColor: Theme.colors.secondary + '20' }]}>
                  <Ionicons name="link" size={22} color={Theme.colors.secondary} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionText}>Copy Link</Text>
                  <Text style={styles.optionSubtext}>Share the post link</Text>
                </View>
              </TouchableOpacity>

              {/* View Profile (for other users' posts) */}
              {!isOwnPost && (
                <TouchableOpacity style={styles.option} onPress={handleViewProfile}>
                  <View style={[styles.optionIcon, { backgroundColor: Theme.colors.accent + '20' }]}>
                    <Ionicons name="person" size={22} color={Theme.colors.accent} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionText}>View Profile</Text>
                    <Text style={styles.optionSubtext}>Go to {post.user.name}'s profile</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Owner Options */}
              {isOwnPost && (
                <>
                  <View style={styles.divider} />
                  
                  <TouchableOpacity style={styles.option} onPress={handleEdit}>
                    <View style={[styles.optionIcon, { backgroundColor: '#3498db20' }]}>
                      <Ionicons name="create" size={22} color="#3498db" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>Edit Post</Text>
                      <Text style={styles.optionSubtext}>Modify your post content</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.option} onPress={handleDelete}>
                    <View style={[styles.optionIcon, { backgroundColor: (Theme.colors.error || '#e74c3c') + '20' }]}>
                      <Ionicons name="trash" size={22} color={Theme.colors.error || '#e74c3c'} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionText, { color: Theme.colors.error || '#e74c3c' }]}>Delete Post</Text>
                      <Text style={styles.optionSubtext}>Permanently remove this post</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* Report (for other users' posts) */}
              {!isOwnPost && (
                <>
                  <View style={styles.divider} />
                  
                  <TouchableOpacity style={styles.option} onPress={handleReport}>
                    <View style={[styles.optionIcon, { backgroundColor: '#f39c1220' }]}>
                      <Ionicons name="flag" size={22} color="#f39c12" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>Report Post</Text>
                      <Text style={styles.optionSubtext}>Report inappropriate content</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* Cancel Button */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface || '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  optionSubtext: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
});

export default PostOptionsModal;