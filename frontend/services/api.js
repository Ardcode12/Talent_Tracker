// frontend/services/api.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  } else {
    // Replace this with YOUR computer's IP address
    // To find your IP on Windows: run 'ipconfig' in cmd
    // Look for IPv4 Address under your active network adapter
    return 'http://10.222.108.35:8000'; // UPDATE THIS WITH YOUR IP
  }
};

const API_BASE_URL = `${getApiUrl()}/api`;
const BASE_URL = getApiUrl();

// Add logging to debug
console.log('Platform:', Platform.OS);
console.log('API URL:', API_BASE_URL);
console.log('Base URL:', BASE_URL);

// Helper function to get full image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it starts with /, remove it
  if (imagePath.startsWith('/')) {
    return `${BASE_URL}${imagePath}`;
  }
  
  return `${BASE_URL}/${imagePath}`;
};

class ApiService {
  static async login(email, password) {
    try {
      const url = `${API_BASE_URL}/auth/login`;
      console.log('Login URL:', url);
      console.log('Login attempt for:', email);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      // Store the token and user data
      if (data.token) {
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('isLoggedIn', 'true');
        if (data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Login error in API service:', error);
      if (error.message === 'Network request failed') {
        throw new Error('Cannot connect to server. Please check:\n1. Backend is running on port 8000\n2. IP address is correct\n3. Both devices are on same network');
      }
      throw error;
    }
  }

  static async signup(userData) {
    try {
      const url = `${API_BASE_URL}/auth/signup`;
      console.log('Signup URL:', url);
      console.log('Signup data:', JSON.stringify(userData, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      // Store the token and user data
      if (data.token) {
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('isLoggedIn', 'true');
        if (data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Signup error in API service:', error);
      if (error.message === 'Network request failed') {
        throw new Error('Cannot connect to server. Please check:\n1. Backend is running on port 8000\n2. IP address is correct\n3. Both devices are on same network');
      }
      throw error;
    }
  }

  static async updateProfile(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const url = `${API_BASE_URL}/users/profile`;
      console.log('Update Profile URL:', url);
      console.log('Auth Token exists:', !!token);
      
      // Debug FormData
      if (formData instanceof FormData) {
        console.log('FormData contents:');
        for (let [key, value] of formData.entries()) {
          if (value instanceof File || (value && typeof value === 'object' && value.uri)) {
            console.log(`${key}: [File/Image]`);
          } else {
            console.log(`${key}:`, value);
          }
        }
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - let fetch set it
        },
        body: formData,
      });

      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        console.error('Server error response:', data);
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Profile update error:', error);
      if (error.message === 'Network request failed') {
        throw new Error('Cannot connect to server. Please check:\n1. Backend is running on port 8000\n2. IP address is correct\n3. Both devices are on same network');
      }
      throw error;
    }
  }

  static async logout() {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData', 'isLoggedIn', 'profileCompleted']);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Assessment methods
  static async uploadAssessment(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/assessments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
        body: formData,
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }
      return data;
    } catch (error) {
      console.error('Assessment upload error:', error);
      throw error;
    }
  }

  static async getAssessments(testType = null) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return { data: [] };
      }

      const url = testType 
        ? `${API_BASE_URL}/assessments?test_type=${testType}`
        : `${API_BASE_URL}/assessments`;

      const response = await fetch(url, {
  headers: { 
    'Authorization': `Bearer ${token}` 
  },
});

// ✅ Safe JSON parse
const text = await response.text();
let data;
try {
  data = JSON.parse(text);
} catch (err) {
  console.error("Bad JSON:", err, "Raw response:", text);
  return { data: [] }; // fallback
}

if (!response.ok) {
  throw new Error(data.detail || 'Fetch failed');
}
return data;

    } catch (error) {
      console.error('Get assessments error:', error);
      return { data: [] };
    }
  }

  static async getAssessmentStats() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/assessments/stats`, {
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Fetch failed');
      }
      return data;
    } catch (error) {
      console.error('Get assessment stats error:', error);
      return null;
    }
  }

  // Additional useful methods
  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async getAuthToken() {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  static async makeAuthenticatedRequest(endpoint, options = {}) {
    try {
      const token = await this.getAuthToken();
      
      if (!token) {
        console.warn('No auth token found for authenticated request');
        // Return empty data instead of throwing error
        return { data: [] };
      }
      
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Authenticated request to:', url);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired or invalid
          console.warn('Authentication failed, token might be expired');
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('isLoggedIn');
          // Return empty data instead of throwing
          return { data: [] };
        }
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      if (error.message === 'Network request failed') {
        console.error('Network request failed - check your connection and IP address');
      }
      // Return empty data for non-critical errors
      return { data: [] };
    }
  }

  // Make a public request (no auth required)
  static async makePublicRequest(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Public request to:', url);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Public API request error:', error);
      return { data: [] };
    }
  }

  // Profile specific methods
  static async uploadProfileImage(imageUri) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // For web, convert to blob
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('image', blob, 'profile.jpg');
      } else {
        // For mobile
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        });
      }

      const response = await fetch(`${API_BASE_URL}/users/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to upload image');
      }

      return data;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }

  // HOME SCREEN SPECIFIC METHODS
  static async getFeedPosts(page = 1, limit = 10) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        // No token, return empty feed
        return { data: [], total: 0, page: 1 };
      }
      const response = await this.makeAuthenticatedRequest(`/posts/feed?page=${page}&limit=${limit}`);
      
      // Process image URLs in the response
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(post => ({
          ...post,
          user: {
            ...post.user,
            profile_photo: getImageUrl(post.user.profile_photo)
          },
          content: {
            ...post.content,
            media_url: getImageUrl(post.content.media_url)
          }
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      return { data: [], total: 0, page: 1 };
    }
  }

  static async getTrendingAthletes() {
    try {
      // This should be a public endpoint
      const response = await this.makePublicRequest('/athletes/trending');
      
      // Process image URLs in the response
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(athlete => ({
          ...athlete,
          profile_photo: getImageUrl(athlete.profile_photo)
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching trending athletes:', error);
      return { data: [] };
    }
  }

  static async getAnnouncements() {
    try {
      // This should be a public endpoint
      return await this.makePublicRequest('/announcements');
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return { data: [] };
    }
  }

  static async getUserStats() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        // Return guest stats
        return { 
          data: {
            name: 'Guest',
            profilePhoto: null,
            nationalRank: null,
            aiScore: null,
            weeklyProgress: 0
          }
        };
      }
      const response = await this.makeAuthenticatedRequest('/users/stats');
      
      // Process image URL
      if (response.data && response.data.profilePhoto) {
        response.data.profilePhoto = getImageUrl(response.data.profilePhoto);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return { 
        data: {
          name: 'Guest',
          profilePhoto: null,
          nationalRank: null,
          aiScore: null,
          weeklyProgress: 0
        }
      };
    }
  }

  // Post interactions
  static async likePost(postId) {
    try {
      return await this.makeAuthenticatedRequest(`/posts/${postId}/like`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  static async unlikePost(postId) {
    try {
      return await this.makeAuthenticatedRequest(`/posts/${postId}/unlike`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }

  static async createPost(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Log what we're sending
      console.log('Creating post...');
      if (formData instanceof FormData) {
        for (let [key, value] of formData.entries()) {
          console.log(`${key}:`, value);
        }
      }

      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - let the browser set it
        },
        body: formData,
      });

      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        console.error('Server error:', data);
        throw new Error(data.detail || 'Failed to create post');
      }

      return data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  static async getComments(postId) {
    try {
      const response = await this.makeAuthenticatedRequest(`/posts/${postId}/comments`);
      
      // Process image URLs in comments
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(comment => ({
          ...comment,
          user: {
            ...comment.user,
            profile_photo: getImageUrl(comment.user.profile_photo)
          }
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return { data: [] };
    }
  }

  static async addComment(postId, text) {
    try {
      const formData = new FormData();
      formData.append('text', text);
      
      const token = await this.getAuthToken();
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to add comment');
      }

      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Performance data
  static async getPerformanceData(period = 'week') {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [] };
      }
      return await this.makeAuthenticatedRequest(`/users/performance?period=${period}`);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      return { data: [] };
    }
  }

  // Connections
  static async getSuggestedConnections() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [] };
      }
      const response = await this.makeAuthenticatedRequest('/connections/suggestions');
      
      // Process image URLs
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(connection => ({
          ...connection,
          profile_photo: getImageUrl(connection.profile_photo)
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching suggested connections:', error);
      return { data: [] };
    }
  }

  static async sendConnectionRequest(userId) {
    try {
      return await this.makeAuthenticatedRequest(`/connections/request/${userId}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error sending connection request:', error);
      throw error;
    }
  }

  // Check if user is logged in
  static async isLoggedIn() {
    try {
      const token = await this.getAuthToken();
      const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
      return !!(token && isLoggedIn === 'true');
    } catch (error) {
      return false;
    }
  }

  // Test connection
  static async testConnection() {
    try {
      const url = `${BASE_URL}/api/health`;
      console.log('Testing connection to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Connection test result:', data);
      return data;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw new Error('Cannot connect to backend server');
    }
  }
}

// Export individual functions for easier imports
export const login = ApiService.login.bind(ApiService);
export const signup = ApiService.signup.bind(ApiService);
export const logout = ApiService.logout.bind(ApiService);
export const isLoggedIn = ApiService.isLoggedIn.bind(ApiService);
export const getCurrentUser = ApiService.getCurrentUser.bind(ApiService);
export const getAuthToken = ApiService.getAuthToken.bind(ApiService);
export const updateProfile = ApiService.updateProfile.bind(ApiService);
export const uploadProfileImage = ApiService.uploadProfileImage.bind(ApiService);
export const getFeedPosts = ApiService.getFeedPosts.bind(ApiService);
export const getTrendingAthletes = ApiService.getTrendingAthletes.bind(ApiService);
export const getAnnouncements = ApiService.getAnnouncements.bind(ApiService);
export const getUserStats = ApiService.getUserStats.bind(ApiService);
export const likePost = ApiService.likePost.bind(ApiService);
export const unlikePost = ApiService.unlikePost.bind(ApiService);
export const createPost = ApiService.createPost.bind(ApiService);
export const getComments = ApiService.getComments.bind(ApiService);
export const addComment = ApiService.addComment.bind(ApiService);
export const getPerformanceData = ApiService.getPerformanceData.bind(ApiService);
export const getSuggestedConnections = ApiService.getSuggestedConnections.bind(ApiService);
export const sendConnectionRequest = ApiService.sendConnectionRequest.bind(ApiService);
export const testConnection = ApiService.testConnection.bind(ApiService);
export const uploadAssessment = ApiService.uploadAssessment.bind(ApiService);
export const getAssessments = ApiService.getAssessments.bind(ApiService);
export const getAssessmentStats = ApiService.getAssessmentStats.bind(ApiService);

export default ApiService;
