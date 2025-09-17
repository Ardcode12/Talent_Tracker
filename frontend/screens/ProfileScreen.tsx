// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile, logout, getImageUrl } from '../services/api';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('info');
  const [modalVisible, setModalVisible] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  // Profile Content - Initialize with userData from backend
  const [bio, setBio] = useState('');
  const [info, setInfo] = useState({
    age: '',
    height: '',
    weight: '',
    location: '',
  });
  const [skills, setSkills] = useState({
    offense: 88,
    defense: 76,
    stamina: 92,
    teamwork: 85,
    leadership: 80,
  });
  const [achievements, setAchievements] = useState([
    '🏆 Captain - State U21 Basketball Team (2024)',
    '🥇 Winner - Intercollege Tournament (2023)',
    '🥈 Runner-up - South Zone Nationals (2022)',
    '🔥 Selected for National Training Camp (2025)'
  ]);
  const [mediaItems] = useState([
    '🎥 Match Highlights: "State Finals 2024"',
    '📸 Training Session Photos',
    '🎥 Skill Showcase Video'
  ]);
  const [performance] = useState([
    '🏀 Avg Points/Game: 22',
    '🎯 Shooting Accuracy: 64%',
    '💪 Assists/Game: 8',
    '🛡 Rebounds/Game: 10',
    '🔥 Speed Test: 3.1s (20m sprint)'
  ]);

  // Temporary edit state
  const [tempBio, setTempBio] = useState(bio);
  const [tempInfo, setTempInfo] = useState(info);
  const [tempSkills, setTempSkills] = useState(skills);
  const [tempAchievements, setTempAchievements] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('userData');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserData(user);
        
        // Set initial bio and info from user data
        setBio(user.bio || `Dedicated ${user.sport || 'athlete'} player. ${user.role === 'coach' ? 'Passionate about developing talent.' : 'Aiming for excellence.'}`);
        setInfo({
          age: user.age?.toString() || '',
          height: user.height || '',
          weight: user.weight || '',
          location: user.location || '',
        });
        
        // Set profile image
        if (user.profile_image || user.profile_photo) {
          setProfileImage(getImageUrl(user.profile_image || user.profile_photo));
        }
        
        // Parse achievements if stored as string
        if (user.achievements) {
          try {
            const parsedAchievements = JSON.parse(user.achievements);
            if (Array.isArray(parsedAchievements)) {
              setAchievements(parsedAchievements);
            }
          } catch (e) {
            // If not JSON, split by newlines
            if (typeof user.achievements === 'string') {
              setAchievements(user.achievements.split('\n').filter(a => a.trim()));
            }
          }
        }
        
        // Initialize temp values
        setTempBio(user.bio || bio);
        setTempInfo({
          age: user.age?.toString() || '',
          height: user.height || '',
          weight: user.weight || '',
          location: user.location || '',
        });
        setTempAchievements(achievements.join('\n'));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setTempProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
  try {
    setSaving(true);
    
    const formData = new FormData();
    formData.append('userId', userData.id.toString());
    formData.append('age', tempInfo.age || '0');
    formData.append('location', tempInfo.location || '');
    formData.append('bio', tempBio);
    formData.append('height', tempInfo.height || '');
    formData.append('weight', tempInfo.weight || '');

    const achievementsList = tempAchievements
      .split('\n')
      .filter(a => a.trim())
      .map(a => a.trim());
    formData.append('achievements', JSON.stringify(achievementsList));
    formData.append('skills', JSON.stringify(tempSkills));

    if (tempProfileImage) {
      formData.append('profileImage', {
        uri: tempProfileImage,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });
    }

    const response = await updateProfile(formData);

    if (response.user) {
      const updatedUser = response.user;
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUserData(updatedUser);

      setBio(updatedUser.bio || '');
      setInfo({
        age: updatedUser.age?.toString() || '',
        height: updatedUser.height || '',
        weight: updatedUser.weight || '',
        location: updatedUser.location || '',
      });

      setAchievements(
        updatedUser.achievements ? JSON.parse(updatedUser.achievements) : []
      );
      setSkills(
        updatedUser.skills ? JSON.parse(updatedUser.skills) : tempSkills
      );
      setProfileImage(getImageUrl(updatedUser.profile_image));

      Alert.alert('Success', 'Profile updated successfully!');
      setModalVisible(false);
    }
  } catch (error) {
    console.error('Profile update error:', error);
    Alert.alert('Error', error.message || 'Failed to update profile');
  } finally {
    setSaving(false);
  }
};


  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to logout?');
      if (confirmLogout) {
        performLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: performLogout,
          },
        ],
        { cancelable: false }
      );
    }
  };

  const performLogout = async () => {
    try {
      await logout();
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const openEditModal = () => {
    // Reset temp values to current values
    setTempBio(bio);
    setTempInfo(info);
    setTempSkills(skills);
    setTempAchievements(achievements.join('\n'));
    setTempProfileImage(null);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <Animated.View 
          entering={FadeInDown.duration(600)}
          style={styles.profileSection}
        >
          <TouchableOpacity onPress={pickImage} disabled={!modalVisible}>
            <Image
              source={{ uri: tempProfileImage || profileImage || 'https://cdn-icons-png.flaticon.com/512/847/847969.png' }}
              style={[styles.profileImage, modalVisible && styles.profileImageEdit]}
            />
            {modalVisible && (
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.name}>{userData?.name || 'User'}</Text>
          <Text style={styles.role}>{userData?.role || 'Athlete'} • {userData?.sport || 'Sport'}</Text>
          <Text style={styles.bio}>{bio}</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Tabs */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(600)}
          style={styles.tabs}
        >
          {['info', 'achievements', 'skills', 'media', 'performance'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Tab Content */}
        <Animated.View 
          entering={FadeInUp.delay(400).duration(600)}
          style={styles.content}
        >
          {activeTab === 'info' && (
            <View>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={20} color="#FF5722" />
                  <Text style={styles.infoText}>Email: {userData?.email || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={20} color="#FF5722" />
                  <Text style={styles.infoText}>Phone: {userData?.phone || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🎂 Age: {info.age || 'Not specified'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>📏 Height: {info.height || 'Not specified'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>⚖ Weight: {info.weight || 'Not specified'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>📍 Location: {info.location || 'Not specified'}</Text>
                </View>
                {userData?.role === 'coach' && (
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={20} color="#FF5722" />
                    <Text style={styles.infoText}>Experience: {userData?.experience || '0'} years</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {activeTab === 'achievements' && (
            <View>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <View style={styles.achievementContainer}>
                {achievements.length > 0 ? (
                  achievements.map((achievement, index) => (
                    <Text key={index} style={styles.achievementText}>{achievement}</Text>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No achievements added yet</Text>
                )}
              </View>
            </View>
          )}

          {activeTab === 'skills' && (
            <View>
              <Text style={styles.sectionTitle}>Skills</Text>
              {Object.entries(skills).map(([key, value]) => (
                <View key={key} style={styles.skillRow}>
                  <Text style={styles.skillText}>{key.toUpperCase()}</Text>
                  <View style={styles.skillBar}>
                    <View style={[styles.skillFill, { width: `${value}%` }]} />
                  </View>
                  <Text style={styles.skillValue}>{value}%</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'media' && (
            <View>
              <Text style={styles.sectionTitle}>Media</Text>
              <View style={styles.mediaContainer}>
                {mediaItems.map((item, index) => (
                  <Text key={index} style={styles.mediaText}>{item}</Text>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'performance' && (
            <View>
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={styles.performanceContainer}>
                {performance.map((item, index) => (
                  <Text key={index} style={styles.performanceText}>{item}</Text>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
            <Image
              source={{ uri: tempProfileImage || profileImage || 'https://cdn-icons-png.flaticon.com/512/847/847969.png' }}
              style={styles.modalProfileImage}
            />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Bio</Text>
          <TextInput 
            style={[styles.input, { height: 80 }]} 
            value={tempBio} 
            onChangeText={setTempBio} 
            multiline 
            numberOfLines={3}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput 
            style={styles.input} 
            value={tempInfo.age} 
            onChangeText={(val) => setTempInfo({ ...tempInfo, age: val })} 
            keyboardType="numeric"
            placeholder="Enter your age"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Height</Text>
          <TextInput 
            style={styles.input} 
            value={tempInfo.height} 
            onChangeText={(val) => setTempInfo({ ...tempInfo, height: val })} 
            placeholder={'e.g., 6\'0" or 183cm'}
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Weight</Text>
          <TextInput 
            style={styles.input} 
            value={tempInfo.weight} 
            onChangeText={(val) => setTempInfo({ ...tempInfo, weight: val })} 
            placeholder="e.g., 75kg or 165lbs"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput 
            style={styles.input} 
            value={tempInfo.location} 
            onChangeText={(val) => setTempInfo({ ...tempInfo, location: val })} 
            placeholder="City, State/Country"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Achievements (one per line)</Text>
          <TextInput 
            style={[styles.input, { height: 120 }]} 
            value={tempAchievements} 
            onChangeText={setTempAchievements} 
            multiline 
            numberOfLines={5}
            placeholder="🏆 Your achievements here..."
            placeholderTextColor="#666"
          />

          <Text style={styles.sectionTitle}>Skills</Text>
          {Object.entries(tempSkills).map(([key, value]) => (
            <View key={key}>
              <Text style={styles.label}>{key.toUpperCase()} ({value}%)</Text>
              <View style={styles.sliderContainer}>
                <TextInput
                  style={[styles.input, { width: 80 }]}
                  keyboardType="numeric"
                  value={String(value)}
                  onChangeText={(val) => {
                    const num = Math.max(0, Math.min(100, Number(val) || 0));
                    setTempSkills({ ...tempSkills, [key]: num });
                  }}
                  maxLength={3}
                />
                <View style={styles.skillPreview}>
                  <View style={[styles.skillPreviewFill, { width: `${value}%` }]} />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.disabledButton]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => setModalVisible(false)}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  profileSection: { 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#1F1F1F' 
  },
  profileImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    marginBottom: 10,
    backgroundColor: '#333'
  },
  profileImageEdit: {
    opacity: 0.7
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 10,
    right: '50%',
    marginRight: -12,
    backgroundColor: '#FF5722',
    borderRadius: 12,
    padding: 4
  },
  name: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: 'white',
    marginBottom: 5
  },
  role: {
    fontSize: 16,
    color: '#FF5722',
    marginBottom: 10
  },
  bio: { 
    fontSize: 14, 
    color: '#ccc', 
    textAlign: 'center', 
    marginVertical: 10,
    paddingHorizontal: 20
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  editButton: { 
    backgroundColor: '#FF5722', 
    padding: 10, 
    borderRadius: 20, 
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  editButtonText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  logoutButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  tabs: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    backgroundColor: '#1A1A2E', 
    paddingVertical: 10 
  },
  tab: { 
    padding: 5 
  },
  tabText: { 
    color: '#999',
    fontSize: 12
  },
  activeTab: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#FF5722' 
  },
  activeTabText: { 
    color: '#FF5722', 
    fontWeight: 'bold' 
  },
  content: { 
    flex: 1, 
    padding: 15 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: 'white', 
    marginVertical: 10 
  },
  
  // Info tab styles
  infoContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    marginTop: 5
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 10
  },
  infoText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
    flex: 1
  },
  
  // Achievement tab styles
  achievementContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    marginTop: 5
  },
  achievementText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 28,
    marginVertical: 5
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    fontStyle: 'italic'
  },
  
  // Skills styles
  skillRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 8,
    backgroundColor: '#1F1F1F',
    padding: 12,
    borderRadius: 10
  },
  skillText: { 
    width: 100, 
    color: 'white',
    fontWeight: '600'
  },
  skillBar: { 
    flex: 1, 
    height: 10, 
    backgroundColor: '#333', 
    borderRadius: 5, 
    marginHorizontal: 10 
  },
  skillFill: { 
    height: 10, 
    backgroundColor: '#FF5722', 
    borderRadius: 5 
  },
  skillValue: { 
    color: '#ccc',
    fontWeight: 'bold',
    minWidth: 40
  },
  
  // Media tab styles
  mediaContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    marginTop: 5
  },
  mediaText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 28,
    marginVertical: 5
  },
  
  // Performance tab styles
  performanceContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    marginTop: 5
  },
  performanceText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 28,
    marginVertical: 5
  },
  
  // Modal styles
  modalContent: { 
    flex: 1, 
    backgroundColor: '#121212', 
    padding: 20 
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white'
  },
  closeButton: {
    color: '#FF5722',
    fontSize: 28,
    fontWeight: 'bold'
  },
  imagePickerButton: {
    alignItems: 'center',
    marginBottom: 20
  },
  modalProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: '#333'
  },
  changePhotoText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600'
  },
  label: { 
    color: 'white', 
    marginTop: 10,
    fontSize: 16,
    marginBottom: 5
  },
  input: { 
    backgroundColor: '#1F1F1F', 
    color: 'white', 
    padding: 12, 
    borderRadius: 8, 
    marginTop: 5,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  skillPreview: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden'
  },
  skillPreviewFill: {
    height: '100%',
    backgroundColor: '#FF5722'
  },
  saveButton: { 
    backgroundColor: '#FF5722', 
    padding: 15, 
    borderRadius: 10, 
    marginTop: 20, 
    alignItems: 'center' 
  },
  saveButtonText: { 
    color: 'white', 
    fontWeight: 'bold',
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.7
  },
  cancelButton: { 
    backgroundColor: '#333', 
    padding: 15, 
    borderRadius: 10, 
    marginTop: 10, 
    alignItems: 'center',
    marginBottom: 30
  },
  cancelButtonText: { 
    color: 'white',
    fontSize: 16
  },
});
