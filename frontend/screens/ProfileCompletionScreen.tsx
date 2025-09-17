import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../constants/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateProfile } from '../services/api';

export default function ProfileCompletionScreen({ navigation }) {
  const [profileImage, setProfileImage] = useState(null);
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('userData');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserData(user);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      pickImage();
    } else {
      Alert.alert(
        'Select Profile Photo',
        'Choose from where you want to select an image',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Gallery', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const validateForm = () => {
    // Make profile image optional for now
    // if (!profileImage) {
    //   Alert.alert('Error', 'Please upload your profile image');
    //   return false;
    // }
    if (!age || isNaN(age) || parseInt(age) < 5 || parseInt(age) > 100) {
      Alert.alert('Error', 'Please enter a valid age between 5 and 100');
      return false;
    }
    if (!location || location.trim().length < 3) {
      Alert.alert('Error', 'Please enter your location');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
  if (!validateForm()) return;

  setLoading(true);
  try {
    if (!userData || !userData.id) {
      throw new Error('User data not found');
    }

    // Create form data for profile update
    const formData = new FormData();
    
    // Add required fields with correct types
    formData.append('userId', userData.id.toString());
    formData.append('age', age.toString());
    formData.append('location', location);
    
    // Add profile image if exists
    if (profileImage) {
      if (Platform.OS === 'web') {
        // For web, fetch the image and create a proper blob
        try {
          const response = await fetch(profileImage);
          const blob = await response.blob();
          
          // Determine the file type from the blob or URI
          let fileExtension = 'jpg'; // default
          let mimeType = blob.type || 'image/jpeg';
          
          // Check blob type first
          if (mimeType.includes('png')) {
            fileExtension = 'png';
          } else if (mimeType.includes('gif')) {
            fileExtension = 'gif';
          } else if (mimeType.includes('webp')) {
            fileExtension = 'webp';
          } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
            fileExtension = 'jpg';
          } else {
            // Fallback: try to extract from URI
            const uriParts = profileImage.split('.');
            if (uriParts.length > 1) {
              const ext = uriParts[uriParts.length - 1].toLowerCase();
              if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                fileExtension = ext === 'jpeg' ? 'jpg' : ext;
              }
            }
          }
          
          // Create a new File object with proper type and name
          const file = new File([blob], `profile_${userData.id}.${fileExtension}`, {
            type: mimeType || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`
          });
          
          formData.append('profileImage', file);
          console.log('Web image prepared:', file.name, file.type);
        } catch (error) {
          console.error('Error processing image for web:', error);
          // Continue without image if there's an error
          console.log('Continuing without profile image');
        }
      } else {
        // For mobile (React Native)
        const imageUriParts = profileImage.split('.');
        let imageExtension = 'jpg'; // default
        
        if (imageUriParts.length > 1) {
          imageExtension = imageUriParts[imageUriParts.length - 1].toLowerCase();
          // Normalize jpeg to jpg
          if (imageExtension === 'jpeg') imageExtension = 'jpg';
        }
        
        // Ensure extension is valid
        if (!['jpg', 'png', 'gif', 'webp'].includes(imageExtension)) {
          imageExtension = 'jpg';
        }
        
        formData.append('profileImage', {
          uri: profileImage,
          type: `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}`,
          name: `profile_${userData.id}.${imageExtension}`,
        } as any);
        console.log('Mobile image prepared:', `profile_${userData.id}.${imageExtension}`);
      }
    }

    console.log('Sending profile update with userId:', userData.id);

    // Call API to update profile
    const response = await updateProfile(formData);

    if (response && response.user) {
      // Update user data in AsyncStorage
      const updatedUserData = {
        ...userData,
        ...response.user,
        age: parseInt(age),
        location: location,
        profile_image: response.user.profile_image,
        profile_photo: response.user.profile_image,
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      await AsyncStorage.setItem('profileCompleted', 'true');
      
      // Save user-specific completion flag
      await AsyncStorage.setItem(`profile_completed_${userData.id}`, 'true');

      // Navigate to Main without showing alert
      console.log('Profile saved successfully, navigating to Main');
      
      // Use navigation.reset to ensure clean navigation
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } else {
      throw new Error('Failed to update profile');
    }
  } catch (error: any) {
    console.error('Profile update error:', error);
    Alert.alert(
      'Error', 
      error.message || 'Failed to update profile. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};

const handleSkip = async () => {
  try {
    if (userData && userData.id) {
      // Save skip flags
      await AsyncStorage.setItem('profileCompleted', 'skipped');
      await AsyncStorage.setItem(`profile_completed_${userData.id}`, 'skipped');
    }

    console.log('Skipping profile setup, navigating to Main');
    
    // Navigate to main app using reset
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  } catch (error) {
    console.error('Error skipping profile:', error);
    // Still try to navigate even if storage fails
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }
};


  return (
    <LinearGradient
      colors={Theme.colors.gradient.background}
      style={styles.container}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help us personalize your experience
            </Text>
          </View>

          {/* Welcome message with user name */}
          {userData && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>
                Welcome, {userData.name}! 👋
              </Text>
              <Text style={styles.welcomeSubtext}>
                Let's set up your profile to get started
              </Text>
            </View>
          )}

          {/* Profile Image Upload */}
          <View style={styles.imageSection}>
            <TouchableOpacity 
              style={styles.imageContainer}
              onPress={showImageOptions}
              disabled={loading}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={40} color={Theme.colors.textSecondary} />
                  <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                </View>
              )}
              
              <View style={styles.editIconContainer}>
                <Ionicons name="camera" size={20} color={Theme.colors.text} />
              </View>
            </TouchableOpacity>
            
            <Text style={styles.imageHelperText}>
              Upload a clear photo of yourself (optional)
            </Text>
          </View>

          {/* Age Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Age *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor={Theme.colors.textSecondary}
                value={age}
                onChangeText={(text) => {
                  // Only allow numbers
                  const numericText = text.replace(/[^0-9]/g, '');
                  setAge(numericText);
                }}
                keyboardType="numeric"
                maxLength={3}
                editable={!loading}
              />
              <Ionicons 
                name="calendar-outline" 
                size={20} 
                color={Theme.colors.textSecondary} 
                style={styles.inputIcon}
              />
            </View>
            <Text style={styles.inputHelper}>
              Your age helps us provide age-appropriate content
            </Text>
          </View>

          {/* Location Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Location *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your city/town"
                placeholderTextColor={Theme.colors.textSecondary}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="words"
                editable={!loading}
              />
              <Ionicons 
                name="location-outline" 
                size={20} 
                color={Theme.colors.textSecondary} 
                style={styles.inputIcon}
              />
            </View>
            <Text style={styles.inputHelper}>
              Connect with athletes and coaches near you
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${
                      (profileImage ? 20 : 0) + 
                      (age ? 40 : 0) + 
                      (location ? 40 : 0)
                    }%` 
                  }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {age && location 
                ? 'All required fields completed!' 
                : 'Fill in required fields (*) to continue'}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton, 
              loading && styles.submitButtonDisabled,
              (!age || !location) && styles.submitButtonIncomplete
            ]}
            onPress={handleSubmit}
            disabled={loading || !age || !location}
          >
            <LinearGradient
              colors={
                age && location 
                  ? Theme.colors.gradient.primary 
                  : ['#666', '#555']
              }
              style={styles.submitButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color={Theme.colors.text} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Complete Profile</Text>
                  <Ionicons name="arrow-forward" size={20} color={Theme.colors.text} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Skip Option */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.md,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginBottom: Theme.spacing.xs,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: Theme.colors.primary,
  },
  imagePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: Theme.spacing.sm,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    backgroundColor: Theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.background,
  },
  imageHelperText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Theme.spacing.xl,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    paddingRight: 50,
    fontSize: 16,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    position: 'absolute',
    right: Theme.spacing.lg,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  inputHelper: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  progressContainer: {
    marginBottom: Theme.spacing.xl,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonIncomplete: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
    marginRight: Theme.spacing.sm,
  },
  skipButton: {
    marginTop: Theme.spacing.xl,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
