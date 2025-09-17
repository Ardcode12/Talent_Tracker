// frontend/screens/CreatePostScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import { createPost } from '../services/api'; // ADD THIS IMPORT
import * as ImagePicker from 'expo-image-picker'; // ADD THIS IF YOU WANT IMAGE SUPPORT

export default function CreatePostScreen({ navigation }) {
  const [postText, setPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  
  const handlePost = async () => {
  if (!postText.trim()) {
    Alert.alert('Error', 'Please write something before posting');
    return;
  }

  try {
    setIsPosting(true);
    
    // Create form data
    const formData = new FormData();
    formData.append('text', postText.trim());
    
    if (selectedImage) {
      if (Platform.OS === 'web') {
        // For web, convert image to blob
        try {
          const response = await fetch(selectedImage);
          const blob = await response.blob();
          
          // Create a File object with proper name
          const file = new File([blob], 'post-image.jpg', {
            type: 'image/jpeg'
          });
          
          formData.append('media', file);
        } catch (error) {
          console.error('Error processing image:', error);
          // Continue without image if there's an error
        }
      } else {
        // For mobile
        formData.append('media', {
          uri: selectedImage,
          type: 'image/jpeg',
          name: 'post-image.jpg',
        });
      }
    }

    // Call the API
    await createPost(formData);
    
    Alert.alert('Success', 'Post created successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  } catch (error) {
    console.error('Post creation error:', error);
    Alert.alert('Error', error.message || 'Failed to create post');
  } finally {
    setIsPosting(false);
  }
};

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity 
          onPress={handlePost} 
          disabled={isPosting || !postText.trim()}
        >
          <Text style={[
            styles.postButton, 
            (isPosting || !postText.trim()) && styles.postButtonDisabled
          ]}>
            {isPosting ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <TextInput
          style={styles.textInput}
          placeholder="Share your performance or achievement..."
          placeholderTextColor={Theme.colors.textSecondary}
          multiline
          numberOfLines={4}
          value={postText}
          onChangeText={setPostText}
          editable={!isPosting}
        />
        
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageButton} 
              onPress={removeImage}
            >
              <Ionicons name="close-circle" size={24} color={Theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.mediaOptions}>
          <TouchableOpacity 
            style={styles.mediaButton} 
            onPress={pickImage}
            disabled={isPosting}
          >
            <Ionicons name="image" size={24} color={Theme.colors.primary} />
            <Text style={styles.mediaButtonText}>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.mediaButton, styles.mediaButtonDisabled]} 
            disabled={true}
          >
            <Ionicons name="videocam" size={24} color={Theme.colors.textSecondary} />
            <Text style={[styles.mediaButtonText, { color: Theme.colors.textSecondary }]}>
              Video (Coming Soon)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {isPosting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Creating your post...</Text>
        </View>
      )}
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
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Theme.spacing.xl : Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  postButton: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: Theme.spacing.md,
  },
  textInput: {
    fontSize: 18,
    color: Theme.colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: Theme.spacing.xl,
  },
  imagePreview: {
    marginBottom: Theme.spacing.xl,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: Theme.borderRadius.lg,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  mediaOptions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mediaButtonText: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  mediaButtonDisabled: {
    opacity: 0.5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    color: Theme.colors.text,
    fontSize: 16,
  },
});
