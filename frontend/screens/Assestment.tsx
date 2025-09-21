import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Theme } from '../constants/Theme';
import { uploadAssessment, getAssessments, getAssessmentStats } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ASSESSMENT_TESTS = [
  { 
    id: 'shuttle_run',
    name: 'Shuttle Run', 
    icon: 'directions-run', 
    color: '#FF6B6B', 
    unit: 'seconds', 
    description: 'Test your agility and speed' 
  },
  { 
    id: 'vertical_jump', // ✅ Changed from vertical_jump
    name: 'Vertical Jump', 
    icon: 'trending-up', 
    color: '#4ECDC4', 
    unit: 'cm', 
    description: 'Measure explosive power' 
  },
  { 
    id: 'squats',
    name: 'Squats', 
    icon: 'fitness-center', 
    color: '#45B7D1', 
    unit: 'reps', 
    description: 'Test lower body strength' 
  },
  { 
    id: 'height_detection',
    name: 'Sit Ups', 
    icon: 'self-improvement', 
    color: '#F7DC6F', 
    unit: 'cm', 
    description: 'Test Core Strength' 
  },
];

export default function AssessmentScreen() {
  const [selectedTest, setSelectedTest] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [manualScore, setManualScore] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState(false);

  // permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  // ✅ Single useEffect for authentication and data loading
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        setIsAuthenticated(true);
        await loadData();
      } else {
        console.log('User not authenticated, skipping data load');
        setIsAuthenticated(false);
        setStats(null);
        setAssessments([]);
      }
    } catch (error) {
      console.error('Error in checkAuthAndLoadData:', error);
      setIsAuthenticated(false);
    }
  };

  const loadData = async () => {
    try {
      const [assessmentsData, statsData] = await Promise.all([
        getAssessments(),
        getAssessmentStats(),
      ]);
      
      setAssessments(assessmentsData?.data || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setAssessments([]);
      setStats(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleVideoUpload = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions!');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      videoMaxDuration: 60,
    });
    
    if (!result.canceled && result.assets[0]) {
      await uploadVideo(result.assets[0].uri);
    }
  } catch (error) {
    console.error('Video selection error:', error);
    Alert.alert('Error', 'Failed to select video');
  }
};


  const handleLiveRecording = async () => {
    setShowUploadModal(false);
    setShowCameraModal(true);
  };

  const startRecording = async () => {
    if (cameraRef.current) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 30,
          quality: '720p',
        });
        await uploadVideo(video.uri);
      } catch (error) {
        console.error('Recording error:', error);
        Alert.alert('Error', 'Failed to record video');
      } finally {
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const uploadVideo = async (videoUri: string) => {
    try {
      setIsAnalyzing(true);
      setShowCameraModal(false);
      
      const formData = new FormData();
      formData.append('test_type', selectedTest.id);
      
      const videoFile = {
        uri: Platform.OS === 'ios' ? videoUri.replace('file://', '') : videoUri,
        type: 'video/mp4',
        name: 'assessment.mp4'
      };
      // @ts-ignore
      formData.append('video', videoFile);
      
      if (manualScore) {
        formData.append('score', manualScore);
      }
      
      const result = await uploadAssessment(formData);

      setIsAnalyzing(false);
      setShowUploadModal(false);
      setManualScore('');
      
      Alert.alert(
        'Assessment Complete!', 
        `Your ${selectedTest.name} score: ${result.ai_score?.toFixed(1) ?? 'N/A'}%\n\n${result.feedback ?? ''}`, 
        [{ text: 'OK', onPress: () => loadData() }]
      );
    } catch (error) {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze video. Please try again.');
      console.error('Upload error:', error);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>AI Assessments</Text>
      <Text style={styles.headerSubtitle}>Track Your Athletic Performance</Text>
      {stats ? (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_assessments || 0}</Text>
            <Text style={styles.statLabel}>Total Tests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.average_score ? `${stats.average_score.toFixed(1)}%` : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderTestCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.testCard} 
      onPress={() => { 
        setSelectedTest(item); 
        setShowUploadModal(true); 
      }}
    >
      <LinearGradient colors={[item.color, item.color + 'CC']} style={styles.testGradient}>
        <MaterialIcons name={item.icon} size={40} color="#fff" />
        <Text style={styles.testName}>{item.name}</Text>
        <Text style={styles.testDescription}>{item.description}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderAssessment = ({ item }) => (
    <View style={styles.assessmentCard}>
      <View style={styles.assessmentHeader}>
        <Text style={styles.assessmentTest}>
          {ASSESSMENT_TESTS.find((t) => t.id === item.test_type)?.name || item.test_type}
        </Text>
        <Text style={styles.assessmentDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.assessmentScores}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>AI Score</Text>
          <Text style={styles.scoreValue}>{item.ai_score?.toFixed(1) ?? 'N/A'}%</Text>
        </View>
      </View>
      {item.ai_feedback && (
        <Text style={styles.assessmentFeedback}>{item.ai_feedback}</Text>
      )}
    </View>
  );

  // ✅ Show message if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.notAuthenticatedContainer]}>
        <Text style={styles.notAuthenticatedText}>
          Please log in to access AI assessments
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderHeader()}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Test Type</Text>
          <FlatList 
            data={ASSESSMENT_TESTS} 
            renderItem={renderTestCard} 
            keyExtractor={(item) => item.id} 
            numColumns={2} 
            columnWrapperStyle={styles.testGrid} 
            scrollEnabled={false} 
          />
        </View>
        
        {assessments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Assessments</Text>
            {assessments.map((item) => (
              <View key={item.id}>{renderAssessment({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.analyzingText}>AI is analyzing your performance...</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTest?.name}</Text>
                  <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.uploadOption} onPress={handleVideoUpload}>
                  <Ionicons name="cloud-upload" size={32} color={Theme.colors.primary} />
                  <Text style={styles.uploadOptionText}>Upload Video</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadOption} onPress={handleLiveRecording}>
                  <Ionicons name="videocam" size={32} color={Theme.colors.secondary} />
                  <Text style={styles.uploadOptionText}>Record Live</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal visible={showCameraModal} animationType="slide" onRequestClose={() => setShowCameraModal(false)}>
        <View style={styles.cameraContainer}>
          {cameraPermission?.granted && microphonePermission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video">
              <View style={styles.cameraControls}>
                <TouchableOpacity onPress={() => setShowCameraModal(false)}>
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.recordButton, isRecording && styles.recordingButton]} 
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
                <Text style={styles.recordingText}>
                  {isRecording ? 'Recording...' : 'Tap to Record'}
                </Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.noPermission}>
              <Text style={styles.noPermissionText}>Camera/Mic permissions required</Text>
              <TouchableOpacity 
                onPress={async () => { 
                  await requestCameraPermission(); 
                  await requestMicrophonePermission(); 
                }}
              >
                <Text style={{ color: '#fff' }}>Grant Permissions</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}




// --- Styles (unchanged) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: { padding: Theme.spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : 40, backgroundColor: Theme.colors.elevated },
  headerTitle: { fontSize: 32, fontWeight: '900', color: Theme.colors.text, marginBottom: 8 },
  headerSubtitle: { fontSize: 16, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.lg },
  statsContainer: { flexDirection: 'row', gap: Theme.spacing.md },
  statCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: Theme.spacing.md, borderRadius: Theme.borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: Theme.colors.primary },
  statLabel: { fontSize: 12, color: Theme.colors.textSecondary, marginTop: 4 },
  section: { padding: Theme.spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.lg },
  testGrid: { justifyContent: 'space-between' },
  testCard: { width: (SCREEN_WIDTH - Theme.spacing.lg * 3) / 2, marginBottom: Theme.spacing.md },
  testGradient: { padding: Theme.spacing.lg, borderRadius: Theme.borderRadius.lg, alignItems: 'center', height: 160, justifyContent: 'center' },
  testName: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: Theme.spacing.sm },
  testDescription: { fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', marginTop: 4 },
  assessmentCard: { backgroundColor: Theme.colors.surface, padding: Theme.spacing.lg, borderRadius: Theme.borderRadius.lg, marginBottom: Theme.spacing.md },
  assessmentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.md },
  assessmentTest: { fontSize: 16, fontWeight: '600', color: Theme.colors.text },
  assessmentDate: { fontSize: 14, color: Theme.colors.textSecondary },
  assessmentScores: { flexDirection: 'row', gap: Theme.spacing.xl, marginBottom: Theme.spacing.md },
  scoreItem: { alignItems: 'center' },
  notAuthenticatedContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: Theme.spacing.xl,
},
notAuthenticatedText: {
  fontSize: 18,
  color: Theme.colors.textSecondary,
  textAlign: 'center',
},

  scoreLabel: { fontSize: 12, color: Theme.colors.textSecondary },
  scoreValue: { fontSize: 20, fontWeight: '700', color: Theme.colors.primary, marginTop: 4 },
  assessmentFeedback: { fontSize: 14, color: Theme.colors.text, fontStyle: 'italic' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: Theme.colors.elevated, borderTopLeftRadius: Theme.borderRadius.xl, borderTopRightRadius: Theme.borderRadius.xl, padding: Theme.spacing.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.xl },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Theme.colors.text },
  uploadOption: { alignItems: 'center', padding: Theme.spacing.xl, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.borderRadius.lg, marginBottom: Theme.spacing.lg },
  uploadOptionText: { fontSize: 16, color: Theme.colors.text, marginTop: Theme.spacing.sm },
  analyzingContainer: { alignItems: 'center', padding: Theme.spacing.xl * 2 },
  analyzingText: { fontSize: 16, color: Theme.colors.text, marginTop: Theme.spacing.lg },
  manualEntry: { marginTop: Theme.spacing.lg },
  manualLabel: { fontSize: 14, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.sm },
  manualInputRow: { flexDirection: 'row', gap: Theme.spacing.md },
  manualInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.borderRadius.md, padding: Theme.spacing.md, color: Theme.colors.text, fontSize: 16 },
  manualSubmit: { backgroundColor: Theme.colors.primary, paddingHorizontal: Theme.spacing.xl, justifyContent: 'center', borderRadius: Theme.borderRadius.md },
  manualSubmitText: { color: '#fff', fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, justifyContent: 'flex-end' },
  cameraControls: { alignItems: 'center', padding: Theme.spacing.xl },
  recordButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginVertical: Theme.spacing.xl },
  recordingButton: { backgroundColor: 'rgba(255,0,0,0.3)' },
  recordButtonInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ff0000' },
  recordingText: { color: '#fff', fontSize: 16 },
  noPermission: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noPermissionText: { color: '#fff', fontSize: 16 },
});
