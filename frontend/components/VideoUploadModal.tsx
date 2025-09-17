import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { uploadVideo, getVideoAnalysis } from '../services/videoUpload';
import { Theme } from '../constants/Theme';

interface VideoUploadModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTest: any;
  onAnalysisComplete: (results: any) => void;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  visible,
  onClose,
  selectedTest,
  onAnalysisComplete,
}) => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const video = useRef<Video>(null);

  const pickVideoFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your gallery');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick video from gallery');
      console.error(error);
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to use camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record video');
      console.error(error);
    }
  };

  const handleUpload = async () => {
    if (!selectedVideo || !selectedTest) return;

    setIsAnalyzing(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 0.9) {
            clearInterval(progressInterval);
            return 0.9;
          }
          return prev + 0.1;
        });
      }, 500);

      // Upload video
      const uploadResult = await uploadVideo(
        selectedVideo,
        selectedTest.id,
        'user123' // Replace with actual user ID
      );

      clearInterval(progressInterval);
      setUploadProgress(1);

      // Wait for analysis
      setTimeout(async () => {
        const analysisResults = await getVideoAnalysis(uploadResult.analysisId);
        
        setIsAnalyzing(false);
        onAnalysisComplete(analysisResults);
        onClose();
        
        Alert.alert(
          'Analysis Complete!',
          `Your ${selectedTest.name} score: ${analysisResults.score} ${selectedTest.unit}`,
          [{ text: 'View Details' }]
        );
      }, 2000);
    } catch (error) {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze video. Please try again.');
      console.error(error);
    }
  };

  const resetModal = () => {
    setSelectedVideo(null);
    setIsAnalyzing(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalOverlay} onPress={resetModal} />
        
        <View style={styles.modalContent}>
          <BlurView intensity={100} style={StyleSheet.absoluteFillObject} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedTest?.name || 'Upload Performance Video'}
            </Text>
            <TouchableOpacity onPress={resetModal}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <Ionicons name="analytics" size={64} color={Theme.colors.primary} />
                <Text style={styles.analyzingText}>Analyzing your performance...</Text>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { width: `${uploadProgress * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(uploadProgress * 100)}%
                  </Text>
                </View>
                
                <ActivityIndicator size="large" color={Theme.colors.primary} />
              </View>
            ) : selectedVideo ? (
              <View style={styles.videoContainer}>
                <Video
                  ref={video}
                  style={styles.video}
                  source={{ uri: selectedVideo }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                />
                
                <View style={styles.videoActions}>
                  <TouchableOpacity 
                    style={styles.changeButton}
                    onPress={() => setSelectedVideo(null)}
                  >
                    <Text style={styles.changeButtonText}>Change Video</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.analyzeButton}
                    onPress={handleUpload}
                  >
                    <Text style={styles.analyzeButtonText}>Start Analysis</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.uploadOptions}>
                <TouchableOpacity 
                  style={styles.optionCard}
                  onPress={recordVideo}
                >
                  <Ionicons name="videocam" size={40} color={Theme.colors.primary} />
                  <Text style={styles.optionTitle}>Record Video</Text>
                  <Text style={styles.optionSubtitle}>Use camera to record</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.optionCard}
                  onPress={pickVideoFromGallery}
                >
                  <Ionicons name="folder-open" size={40} color={Theme.colors.secondary} />
                  <Text style={styles.optionTitle}>Choose from Gallery</Text>
                  <Text style={styles.optionSubtitle}>Select existing video</Text>
                </TouchableOpacity>
                
                <View style={styles.tips}>
                  <Text style={styles.tipsTitle}>Tips for best results:</Text>
                  <Text style={styles.tipItem}>• Good lighting</Text>
                  <Text style={styles.tipItem}>• Stable camera</Text>
                  <Text style={styles.tipItem}>• Full body visible</Text>
                  <Text style={styles.tipItem}>• Max 60 seconds</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    height: '70%',
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    backgroundColor: Theme.colors.elevated,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  modalBody: {
    flex: 1,
    padding: Theme.spacing.lg,
  },
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  analyzingText: {
    fontSize: 18,
    color: Theme.colors.text,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  progressContainer: {
    width: '80%',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    color: Theme.colors.text,
    marginTop: Theme.spacing.sm,
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: 300,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'black',
  },
  videoActions: {
    marginTop: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  changeButton: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  changeButtonText: {
    fontSize: 16,
    color: Theme.colors.text,
  },
  analyzeButton: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  uploadOptions: {
    gap: Theme.spacing.lg,
  },
  optionCard: {
    padding: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: Theme.spacing.sm,
  },
  optionSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  tips: {
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.primary + '10',
    borderRadius: Theme.borderRadius.md,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  tipItem: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
});
