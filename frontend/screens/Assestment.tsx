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
  AppState,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Theme } from '../constants/Theme';
import { uploadAssessment, getAssessments, getAssessmentStats, getAssessmentStatus } from '../services/api';

const fixEmojiEncoding = (text: string | null | undefined): string => {
  if (!text) return '';
  
  try {
    // Check if it looks like mojibake (incorrectly decoded UTF-8)
    // Common pattern: Ã¢ÂÂ or Ã°Â etc.
    if (text.includes('Ã') || text.includes('Â') || text.includes('ð')) {
      // Try to fix by encoding as Latin-1 and decoding as UTF-8
      const bytes = new Uint8Array([...text].map(c => c.charCodeAt(0)));
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    }
    return text;
  } catch (e) {
    // If fix fails, return original
    return text;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ASSESSMENT_TESTS = [
  { 
    id: 'shuttle_run',
    name: 'Shuttle Run', 
    icon: 'directions-run', 
    color: '#FF6B6B', 
    unit: 'seconds', 
    description: 'Test your agility and speed',
    instructions: [
      'Record from a **straight angle** covering the entire **10m track**.',
      'A **10-meter** running distance is **compulsory**.',
      'Exactly **4 laps** (3 direction changes) must be completed.',
      'Ensure your **full body is visible** at all times.'
    ]
  },
  { 
    id: 'vertical_jump', // ✅ Changed from vertical_jump
    name: 'Vertical Jump', 
    icon: 'trending-up', 
    color: '#4ECDC4', 
    unit: 'cm', 
    description: 'Measure explosive power',
    instructions: [
      'Record from a **side-on angle**.',
      'Ensure your **full body (head to feet)** is visible throughout the jump.',
      '**Start recording before** the jump and **stop after** landing.',
      'Normal **30fps video** works — slow-motion also supported for better accuracy.',
    ]
  },
  { 
    id: 'squats',
    name: 'Squats', 
    icon: 'fitness-center', 
    color: '#45B7D1', 
    unit: 'reps', 
    description: 'Test lower body strength',
    instructions: [
      'Record from a **side-on angle**.',
      'Perform as many **continuous reps** as possible.',
      'Ensure the **hips go below the knees** for a valid rep.',
      'Aim for **50+ reps** for an Elite score!'
    ]
  },
  { 
    id: 'height_detection',
    name: 'Sit Ups', 
    icon: 'self-improvement', 
    color: '#F7DC6F', 
    unit: 'cm', 
    description: 'Test Core Strength',
    instructions: [
      'Record from a **side-on angle**.',
      'Ensure your **full body is visible**.',
      'Perform **continuous repetitions** with proper form.'
    ]
  },
];

const renderInstructionText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ color: Theme.colors.accent, fontWeight: 'bold' }}>
          {part.substring(2, part.length - 2)}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
};

export default function AssessmentScreen() {
  const [selectedTest, setSelectedTest] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [manualScore, setManualScore] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  // Banner shown after upload submitted to background
  const [uploadBanner, setUploadBanner] = useState<{ visible: boolean; testName: string } | null>(null);
  // Track pending assessment IDs for polling
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  // In-app result toast shown when a completed assessment is detected
  const [resultToast, setResultToast] = useState<{ visible: boolean; testName: string; score: string; feedback: string } | null>(null);
  // Selected assessment for full report modal
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState(false);

  // permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  // ✅ Single useEffect for authentication and data loading
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // ── Auto-poll while there are pending assessments ─────────────────────────
  // Every 6 seconds, refresh data. Stops when no more pending IDs.
  useEffect(() => {
    if (pendingIds.length === 0) return; // nothing to watch

    const interval = setInterval(() => {
      loadData(); // loadData will detect completion and show toast + clear pendingIds
    }, 6000);

    // Also refresh when app comes back to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') loadData();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [pendingIds]);

  // Auto-dismiss banner after 8 seconds
  useEffect(() => {
    if (uploadBanner?.visible) {
      const timer = setTimeout(() => setUploadBanner(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [uploadBanner]);

  // Auto-dismiss result toast after 7 seconds
  useEffect(() => {
    if (resultToast?.visible) {
      const timer = setTimeout(() => setResultToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [resultToast]);

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
      const [assessmentData, statsData] = await Promise.all([
        getAssessments(),
        getAssessmentStats(),
      ]);
      const list = assessmentData?.data || [];
      setAssessments(list);
      setStats(statsData?.data || statsData || null);

      // Check if any previously pending assessments are now done
      if (pendingIds.length > 0) {
        const nowDone = list.filter(
          (a: any) => pendingIds.includes(a.id) && a.status === 'completed'
        );
        if (nowDone.length > 0) {
          const latest = nowDone[0];
          const testName =
            ASSESSMENT_TESTS.find((t) => t.id === latest.test_type)?.name || latest.test_type;
          setResultToast({
            visible: true,
            testName,
            score: latest.ai_score != null ? `${latest.ai_score.toFixed(1)}%` : 'N/A',
            feedback: latest.ai_feedback || '',
          });
          // Remove completed ones from pending list
          setPendingIds(prev => prev.filter(id => !nowDone.map((a: any) => a.id).includes(id)));
        }
      }
    } catch (error) {
      console.error('Error loading assessment data:', error);
    } finally {
      setRefreshing(false);
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
      setIsUploading(true);
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

      // Upload — backend returns immediately with status: "processing"
      const result = await uploadAssessment(formData);

      // Close modal and show banner right away
      setIsUploading(false);
      setShowUploadModal(false);
      setManualScore('');

      if (result?.id) {
        // Track this ID for polling
        setPendingIds(prev => [...prev, result.id]);
      }

      setUploadBanner({ visible: true, testName: selectedTest.name });

      // Reload list to show the new "processing" card
      await loadData();

    } catch (error) {
      setIsUploading(false);
      Alert.alert('Upload Failed', 'Could not upload the video. Please check your connection and try again.');
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
          {/* Average of ALL scores - for Assessment page */}
          <Text style={styles.statValue}>
            {stats.average_score ? `${stats.average_score.toFixed(1)}%` : 'N/A'}
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
        <View style={styles.statCard}>
          {/* Average of BEST scores - used for ranking */}
          <Text style={styles.statValue}>
            {stats.current_ai_score ? `${stats.current_ai_score.toFixed(1)}%` : 'N/A'}
          </Text>
          <Text style={styles.statLabel}>Rank Score</Text>
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
        setModalStep(1);
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

  // ── Rich card (tappable → opens full report) ────────────────────────────────
  const renderAssessment = ({ item }: any) => {
    const testMeta = ASSESSMENT_TESTS.find((t) => t.id === item.test_type);
    const isProcessing = item.status === 'processing';
    const isFailed = item.status === 'failed';
    const score = item.ai_score != null ? item.ai_score : null;

    const scoreColor = score == null ? '#8E8E93'
      : score >= 75 ? '#22c55e' : score >= 50 ? '#FFB300' : '#ef4444';
    const accentColor = testMeta?.color ?? '#667eea';

    // Extract first meaningful tip line from feedback
    const tipLine = item.ai_feedback
      ? item.ai_feedback.split('\n').find((l: string) => l.trim().length > 10) ?? ''
      : '';

    // Time formatting
    const dateObj = new Date(item.created_at);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity
        style={styles.richCard}
        onPress={() => !isProcessing && setSelectedAssessment(item)}
        activeOpacity={isProcessing ? 1 : 0.78}
      >
        {/* Left accent bar */}
        <View style={[styles.richCardAccent, { backgroundColor: accentColor }]} />

        <View style={styles.richCardBody}>
          {/* Top row: test name + score */}
          <View style={styles.richCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.richCardTestName}>{testMeta?.name || item.test_type}</Text>
              <Text style={styles.richCardDateTime}>{dateStr}  ·  {timeStr}</Text>
            </View>

            {/* Score circle */}
            {isProcessing ? (
              <View style={styles.richCardScoreCircle}>
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            ) : isFailed ? (
              <View style={[styles.richCardScoreCircle, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}>
                <Ionicons name="warning" size={20} color="#ef4444" />
              </View>
            ) : (
              <View style={[styles.richCardScoreCircle, {
                backgroundColor: scoreColor + '15',
                borderColor: scoreColor + '50',
              }]}>
                <Text style={[styles.richCardScoreNum, { color: scoreColor }]}>
                  {score != null ? score.toFixed(0) : '—'}
                </Text>
                {score != null && <Text style={[styles.richCardScoreUnit, { color: scoreColor }]}>%</Text>}
              </View>
            )}
          </View>

          {/* Status or tip line */}
          {isProcessing && (
            <View style={styles.richCardTipRow}>
              <Ionicons name="time-outline" size={13} color="#3b82f6" />
              <Text style={[styles.richCardTip, { color: '#3b82f6' }]}>
                AI is analysing your video in the background…
              </Text>
            </View>
          )}
          {isFailed && (
            <View style={styles.richCardTipRow}>
              <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
              <Text style={[styles.richCardTip, { color: '#ef4444' }]}>
                Analysis failed — tap to see what went wrong
              </Text>
            </View>
          )}
          {!isProcessing && !isFailed && tipLine.length > 0 && (
            <View style={styles.richCardTipRow}>
              <Ionicons name="bulb-outline" size={13} color={scoreColor} />
              <Text style={styles.richCardTip} numberOfLines={2}>{tipLine}</Text>
            </View>
          )}

          {/* Bottom: score bar + "Full report" hint */}
          {!isProcessing && !isFailed && score != null && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.richCardBarBg}>
                <View style={[
                  styles.richCardBarFill,
                  { width: `${Math.min(100, score)}%` as any, backgroundColor: scoreColor }
                ]} />
              </View>
              <Text style={styles.richCardViewReport}>View full report →</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Full report modal ────────────────────────────────────────────────────
  const renderReportModal = () => {
    if (!selectedAssessment) return null;
    const item = selectedAssessment;
    const testMeta = ASSESSMENT_TESTS.find((t) => t.id === item.test_type);
    const score = item.ai_score != null ? item.ai_score : null;
    const isFailed = item.status === 'failed';

    const scoreColor = score == null ? Theme.colors.textSecondary
      : score >= 75 ? '#22c55e' : score >= 50 ? '#FFB300' : '#ef4444';
    const scoreLabel = score == null ? 'No Score'
      : score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs Work';

    return (
      <Modal
        visible={!!selectedAssessment}
        animationType="slide"
        transparent={false}
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAssessment(null)}
      >
        <View style={styles.reportFullScreen}>

          {/* Header */}
          <View style={styles.reportHeader}>
            <View style={styles.reportHandle} />
            <View style={styles.reportHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {testMeta && (
                    <View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: testMeta.color }]} />
                  )}
                  <Text style={styles.reportTitle}>{testMeta?.name || item.test_type}</Text>
                </View>
                <Text style={styles.reportDate}>
                  {new Date(item.created_at).toLocaleDateString('en-IN', {
                    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAssessment(null)} style={styles.reportClose}>
                <Ionicons name="close" size={20} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {/* Score hero */}
            {!isFailed && (
              <View style={styles.reportScoreBlock}>
                <Text style={[styles.reportScoreBig, { color: scoreColor }]}>
                  {score != null ? `${score.toFixed(1)}%` : 'N/A'}
                </Text>
                <Text style={[styles.reportScoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>

                {score != null && (
                  <View style={styles.reportBarBg}>
                    <View style={[
                      styles.reportBarFill,
                      { width: `${Math.min(100, score)}%` as any, backgroundColor: scoreColor }
                    ]} />
                  </View>
                )}
              </View>
            )}

            {/* Failed banner */}
            {isFailed && (
              <View style={styles.reportFailedBanner}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.failedTitle}>Analysis Failed</Text>
                  <Text style={styles.failedSubtitle}>
                    Please try again with a clearer video at the correct angle.
                  </Text>
                </View>
              </View>
            )}

            {/* AI Feedback section */}
            {item.ai_feedback && (
              <View style={styles.reportFeedbackBlock}>
                <View style={styles.reportSectionHeader}>
                  <Ionicons name="document-text-outline" size={16} color={Theme.colors.primary} />
                  <Text style={styles.reportSectionTitle}>AI Feedback</Text>
                </View>
                <Text style={styles.reportFeedbackText}>
                  {fixEmojiEncoding(item.ai_feedback)}
                </Text>
              </View>
            )}

            {/* Test Info section */}
            <View style={styles.reportMetaBlock}>
              <View style={styles.reportSectionHeader}>
                <Ionicons name="information-circle-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.reportSectionTitle}>Test Details</Text>
              </View>
              <View style={styles.reportMetaRow}>
                <Ionicons name="fitness-outline" size={14} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={styles.reportMetaKey}>Test Type</Text>
                <Text style={styles.reportMetaVal}>{testMeta?.name || item.test_type}</Text>
              </View>
              <View style={styles.reportMetaRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color={isFailed ? '#ef4444' : '#22c55e'} style={{ marginRight: 8 }} />
                <Text style={styles.reportMetaKey}>Status</Text>
                <Text style={[styles.reportMetaVal, { color: isFailed ? '#ef4444' : '#22c55e' }]}>
                  {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                </Text>
              </View>
              <View style={styles.reportMetaRow}>
                <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={styles.reportMetaKey}>Date &amp; Time</Text>
                <Text style={styles.reportMetaVal}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
              {item.ai_score != null && (
                <View style={styles.reportMetaRow}>
                  <Ionicons name="analytics-outline" size={14} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
                  <Text style={styles.reportMetaKey}>AI Score</Text>
                  <Text style={[styles.reportMetaVal, { color: scoreColor, fontWeight: '800' }]}>
                    {item.ai_score.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Result toast (shown after analysis completes) ── */}
      {resultToast?.visible && (
        <TouchableOpacity
          style={styles.resultToast}
          onPress={() => setResultToast(null)}
          activeOpacity={0.9}
        >
          <View style={styles.resultToastInner}>
            <View style={styles.resultToastIcon}>
              <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultToastTitle}>
                {resultToast.testName} Complete 🎉
              </Text>
              <Text style={styles.resultToastScore}>Score: {resultToast.score}</Text>
              {resultToast.feedback ? (
                <Text style={styles.resultToastFeedback} numberOfLines={2}>
                  {fixEmojiEncoding(resultToast.feedback)}
                </Text>
              ) : null}
            </View>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Upload banner (shown while uploading) ── */}
      {uploadBanner?.visible && (
        <TouchableOpacity
          style={styles.uploadBanner}
          onPress={() => setUploadBanner(null)}
          activeOpacity={0.9}
        >
          <View style={styles.uploadBannerInner}>
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadBannerTitle}>Analysing {uploadBanner.testName}…</Text>
              <Text style={styles.uploadBannerSub}>You'll get a notification when it's done.</Text>
            </View>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
          </View>
        </TouchableOpacity>
      )}
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
            {isUploading ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.analyzingText}>Uploading video…</Text>
                <Text style={styles.analyzingSubText}>Please wait while we upload your video.</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTest?.name}</Text>
                  <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {modalStep === 1 ? (
                  <>
                    {selectedTest?.instructions && (
                      <View style={styles.instructionsContainer}>
                        <Text style={styles.instructionsTitle}>Instructions:</Text>
                        {selectedTest.instructions.map((inst: string, index: number) => (
                          <Text key={index} style={styles.instructionText}>
                            • {renderInstructionText(inst)}
                          </Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity 
                      style={styles.nextButton} 
                      onPress={() => setModalStep(2)}
                    >
                      <Text style={styles.nextButtonText}>Next</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.uploadOption} onPress={handleVideoUpload}>
                      <Ionicons name="cloud-upload" size={32} color={Theme.colors.primary} />
                      <Text style={styles.uploadOptionText}>Upload Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadOption} onPress={handleLiveRecording}>
                      <Ionicons name="videocam" size={32} color={Theme.colors.secondary} />
                      <Text style={styles.uploadOptionText}>Record Live</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.backButton} 
                      onPress={() => setModalStep(1)}
                    >
                      <Ionicons name="arrow-back" size={20} color="#ccc" />
                      <Text style={styles.backButtonText}>Back to Instructions</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Assessment Report Modal */}
      {renderReportModal()}

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
  assessmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
  assessmentTest: { fontSize: 16, fontWeight: '700', color: Theme.colors.text },
  assessmentDate: { fontSize: 13, color: Theme.colors.textSecondary },
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
  instructionsContainer: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 10, marginBottom: 20 },
  instructionsTitle: { color: Theme.colors.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  instructionText: { color: '#ccc', fontSize: 14, marginBottom: 4, lineHeight: 20 },
  nextButton: { backgroundColor: Theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: Theme.borderRadius.md, marginTop: 10, gap: 8 },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, marginTop: 10, gap: 8 },
  backButtonText: { color: '#ccc', fontSize: 16 },
  uploadOption: { alignItems: 'center', padding: Theme.spacing.xl, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.borderRadius.lg, marginBottom: Theme.spacing.lg },
  uploadOptionText: { fontSize: 16, color: Theme.colors.text, marginTop: Theme.spacing.sm },
  analyzingContainer: { alignItems: 'center', padding: Theme.spacing.xl * 2 },
  analyzingText: { fontSize: 16, color: Theme.colors.text, marginTop: Theme.spacing.lg, fontWeight: '600' },
  analyzingSubText: { fontSize: 13, color: Theme.colors.textSecondary, marginTop: 6, textAlign: 'center' },
  // Upload banner
  uploadBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 16,
    right: 16,
    zIndex: 999,
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden',
  },
  uploadBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.secondary,
    padding: 14,
    borderRadius: Theme.borderRadius.md,
  },
  uploadBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  uploadBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // ── Result toast ───────────────────────────────────────────────────────────
  resultToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: Theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  resultToastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2e1a',
    borderWidth: 1,
    borderColor: '#22c55e40',
    padding: 14,
    borderRadius: Theme.borderRadius.md,
    gap: 12,
  },
  resultToastIcon: { flexShrink: 0 },
  resultToastTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultToastScore: { color: '#22c55e', fontWeight: '700', fontSize: 14, marginTop: 2 },
  resultToastFeedback: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3, lineHeight: 16 },

  // ── Assessment card variants ───────────────────────────────────────────────
  assessmentCard: {
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  assessmentCardProcessing: {
    borderColor: '#3b82f640',
    backgroundColor: '#0f1929',
  },
  assessmentCardFailed: {
    borderColor: '#ef444440',
    backgroundColor: '#1e0f0f',
  },
  assessmentTestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  assessmentTestDot: { width: 10, height: 10, borderRadius: 5 },

  // Processing state
  processingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    marginTop: 4,
  },
  processingTitle: { fontSize: 14, fontWeight: '700', color: '#3b82f6', marginBottom: 3 },
  processingSubtitle: { fontSize: 12, color: Theme.colors.textSecondary, lineHeight: 17 },

  // Failed state
  failedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    marginTop: 4,
  },
  failedTitle: { fontSize: 14, fontWeight: '700', color: '#ef4444', marginBottom: 3 },
  failedSubtitle: { fontSize: 12, color: Theme.colors.textSecondary, lineHeight: 17 },

  // Score row
  scoreRow: { marginTop: 8, gap: 8 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scorePillLabel: { fontSize: 13, color: Theme.colors.textSecondary, fontWeight: '500' },
  scorePillValue: { fontSize: 24, fontWeight: '900', color: Theme.colors.primary },
  scoreBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  scoreBarFill: { height: 6, borderRadius: 3 },

  // Old fields kept for compat
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

  // ── Compact card extras ────────────────────────────────────────────────────
  compactScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  compactScoreChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  compactScoreText: {
    fontSize: 16,
    fontWeight: '800',
  },
  tapHintText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontStyle: 'italic',
  },

  // ── Rich assessment card ────────────────────────────────────────────────────
  richCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  richCardAccent: {
    width: 5,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  richCardBody: {
    flex: 1,
    padding: 14,
  },
  richCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  richCardTestName: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 3,
  },
  richCardDateTime: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  richCardScoreCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  richCardScoreNum: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  richCardScoreUnit: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: -2,
  },
  richCardTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  richCardTip: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  richCardBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  richCardBarFill: {
    height: 4,
    borderRadius: 2,
  },
  richCardViewReport: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ── Report modal ────────────────────────────────────────────────────────────
  reportFullScreen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  reportHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  reportHeader: {
    backgroundColor: Theme.colors.elevated,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  reportDate: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  reportClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 2,
  },
  // Section header row (icon + label)
  reportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  // Score hero in report
  reportScoreBlock: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reportScoreBig: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
  },
  reportScoreLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
  },
  reportBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reportBarFill: {
    height: 8,
    borderRadius: 4,
  },
  // Failed banner in report
  reportFailedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  // Feedback section
  reportFeedbackBlock: {
    margin: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
  },
  reportSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reportFeedbackText: {
    fontSize: 15,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  // Meta table
  reportMetaBlock: {
    margin: 16,
    marginTop: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
  },
  reportMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  reportMetaKey: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  reportMetaVal: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
    flex: 2,
    textAlign: 'right',
  },
});


