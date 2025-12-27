// frontend/services/api.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ============================================================================
// API CONFIGURATION
// ============================================================================

const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  } else {
    // Replace this with YOUR computer's IP address
    // To find your IP on Windows: run 'ipconfig' in cmd
    // Look for IPv4 Address under your active network adapter
    
    return 'http://10.174.246.35:8000'; // UPDATE THIS WITH YOUR IP
  }
};

const API_BASE_URL = `${getApiUrl()}/api`;
const BASE_URL = getApiUrl();

// Add logging to debug
console.log('Platform:', Platform.OS);
console.log('API URL:', API_BASE_URL);
console.log('Base URL:', BASE_URL);

// ============================================================================
// IMAGE URL HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a default avatar URL with initials
 * @param {string} name - User's name for generating initials
 * @param {number} size - Size of the avatar image
 * @returns {string} URL to generated avatar
 */
const generateAvatarUrl = (name = 'User', size = 128) => {
  const safeName = encodeURIComponent(name || 'User');
  
  // Color palette matching backend
  const colors = [
    "6366f1", "8b5cf6", "ec4899", "f43f5e", 
    "f97316", "eab308", "22c55e", "14b8a6",
    "06b6d4", "3b82f6", "a855f7", "d946ef"
  ];
  
  // Generate consistent color from name
  let hash = 0;
  const nameStr = name || 'User';
  for (let i = 0; i < nameStr.length; i++) {
    hash += nameStr.charCodeAt(i);
  }
  const bgColor = colors[hash % colors.length];
  
  return `https://ui-avatars.com/api/?background=${bgColor}&color=fff&name=${safeName}&size=${size}&bold=true`;
};

/**
 * Get full image URL (basic version - can return null)
 * @param {string|null} imagePath - The image path from backend
 * @param {string} fallbackName - Name to use for generating avatar (optional)
 * @returns {string|null} Full URL to image or null
 */
export const getImageUrl = (imagePath, fallbackName = null) => {
  // If no image path, generate avatar if we have a name, otherwise return null
  if (!imagePath) {
    return fallbackName ? generateAvatarUrl(fallbackName) : null;
  }
  
  // Check for invalid paths
  if (imagePath === 'null' || imagePath === 'undefined') {
    return fallbackName ? generateAvatarUrl(fallbackName) : null;
  }
  
  // Trim and check for empty string
  const trimmedPath = String(imagePath).trim();
  if (trimmedPath === '') {
    return fallbackName ? generateAvatarUrl(fallbackName) : null;
  }
  
  // If it's already a full URL, return as is
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    return trimmedPath;
  }
  
  // Build full URL from relative path
  if (trimmedPath.startsWith('/')) {
    return `${BASE_URL}${trimmedPath}`;
  }
  
  return `${BASE_URL}/${trimmedPath}`;
};

/**
 * Get image URL with guaranteed fallback (never returns null)
 * @param {string|null} imagePath - The image path from backend
 * @param {string} name - Name to use for generating avatar
 * @param {number} size - Size of fallback avatar
 * @returns {string} Full URL to image or generated avatar
 */
export const getImageUrlWithFallback = (imagePath, name = 'User', size = 128) => {
  // Check if we have a valid image path
  if (imagePath) {
    // Check for invalid string values
    if (imagePath === 'null' || imagePath === 'undefined') {
      return generateAvatarUrl(name, size);
    }
    
    const trimmedPath = String(imagePath).trim();
    if (trimmedPath === '') {
      return generateAvatarUrl(name, size);
    }
    
    // If it's already a full URL, return as is
    if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
      return trimmedPath;
    }
    
    // Build full URL from relative path
    if (trimmedPath.startsWith('/')) {
      return `${BASE_URL}${trimmedPath}`;
    }
    
    return `${BASE_URL}/${trimmedPath}`;
  }
  
  // Generate avatar with initials
  return generateAvatarUrl(name, size);
};

// ============================================================================
// API SERVICE CLASS
// ============================================================================

class ApiService {
  
  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================
  
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
          if (data.user.role) {
            await AsyncStorage.setItem('userRole', data.user.role);
          }
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
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const text = await response.text();
      console.log('Response status:', response.status);
      
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
          if (data.user.role) {
            await AsyncStorage.setItem('userRole', data.user.role);
          }
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

  static async logout() {
    try {
      await AsyncStorage.multiRemove([
        'authToken', 
        'userData', 
        'isLoggedIn', 
        'profileCompleted', 
        'userRole'
      ]);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  static async isLoggedIn() {
    try {
      const token = await this.getAuthToken();
      const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
      return !!(token && isLoggedIn === 'true');
    } catch (error) {
      return false;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================
// ============================================
// ALL ATHLETES METHODS (For Coach Dashboard)
// ============================================

static async getAllAthletes(params = {}) {
  try {
    const token = await this.getAuthToken();
    if (!token) {
      return { data: [], pagination: {} };
    }
    
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.sport) queryParams.append('sport', params.sport);
    if (params.min_score) queryParams.append('min_score', params.min_score);
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_order) queryParams.append('sort_order', params.sort_order);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    const url = `/coach/all-athletes?${queryParams.toString()}`;
    const response = await this.makeAuthenticatedRequest(url);
    
    // Process image URLs
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map(athlete => ({
        ...athlete,
        profile_photo: getImageUrlWithFallback(athlete.profile_photo, athlete.name)
      }));
    }
    
    return response;
  } catch (error) {
    console.error('Error fetching all athletes:', error);
    return { data: [], pagination: {} };
  }
}

static async getTopAthletes(limit = 10, sport = null) {
  try {
    const token = await this.getAuthToken();
    if (!token) {
      return { data: [] };
    }
    
    const params = new URLSearchParams({ limit: limit.toString() });
    if (sport) params.append('sport', sport);
    
    const response = await this.makeAuthenticatedRequest(`/coach/top-athletes?${params}`);
    
    // Process image URLs
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map(athlete => ({
        ...athlete,
        profile_photo: getImageUrlWithFallback(athlete.profile_photo, athlete.name)
      }));
    }
    
    return response;
  } catch (error) {
    console.error('Error fetching top athletes:', error);
    return { data: [] };
  }
}

static async getActiveAthletes(hours = 24, limit = 10) {
  try {
    const token = await this.getAuthToken();
    if (!token) {
      return { data: [] };
    }
    
    const response = await this.makeAuthenticatedRequest(
      `/coach/active-athletes?hours=${hours}&limit=${limit}`
    );
    
    // Process image URLs
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map(athlete => ({
        ...athlete,
        profile_photo: getImageUrlWithFallback(athlete.profile_photo, athlete.name)
      }));
    }
    
    return response;
  } catch (error) {
    console.error('Error fetching active athletes:', error);
    return { data: [] };
  }
}

static async getRisingStars(days = 30, limit = 10) {
  try {
    const token = await this.getAuthToken();
    if (!token) {
      return { data: [] };
    }
    
    const response = await this.makeAuthenticatedRequest(
      `/coach/rising-stars?days=${days}&limit=${limit}`
    );
    
    // Process image URLs
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map(item => ({
        ...item,
        athlete: item.athlete ? {
          ...item.athlete,
          profile_photo: getImageUrlWithFallback(item.athlete.profile_photo, item.athlete.name)
        } : null
      }));
    }
    
    return response;
  } catch (error) {
    console.error('Error fetching rising stars:', error);
    return { data: [] };
  }
}
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
      
      const publicEndpoints = ['/athletes/trending', '/announcements'];
      const isPublicEndpoint = publicEndpoints.some(ep => endpoint.includes(ep));
      
      if (!token && !isPublicEndpoint) {
        console.warn('No auth token found for authenticated request');
        return { data: [] };
      }
      
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Authenticated request to:', url);
      
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const text = await response.text();
      
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        console.error('Received HTML instead of JSON');
        throw new Error('Server returned HTML instead of JSON');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 401 && !isPublicEndpoint) {
          console.warn('Authentication failed, token might be expired');
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('isLoggedIn');
          return { data: [] };
        }
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      return { data: [] };
    }
  }

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

  // ==========================================
  // PROFILE METHODS
  // ==========================================

  static async updateProfile(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const url = `${API_BASE_URL}/users/profile`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
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
      console.error('Profile update error:', error);
      throw error;
    }
  }

  static async uploadProfileImage(imageUri) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('image', blob, 'profile.jpg');
      } else {
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

  // ==========================================
  // COACH SPECIFIC METHODS
  // ==========================================

  static async getCoachDashboardStats() {
    try {
      const token = await this.getAuthToken();
      if (!token) return null;
      
      const response = await this.makeAuthenticatedRequest('/coach/dashboard-stats');
      
      // Process coach photo
      if (response.coach_info) {
        response.coach_info.profile_photo = getImageUrlWithFallback(
          response.coach_info.profile_photo,
          response.coach_info.name
        );
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching coach dashboard stats:', error);
      return null;
    }
  }

  static async getCoachAthletes(params = {}) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [], pagination: {} };
      }
      
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/coach/athletes?${queryParams}` : '/coach/athletes';
      
      const response = await this.makeAuthenticatedRequest(url);
      
      // Process image URLs with fallback names
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(athlete => ({
          ...athlete,
          profile_photo: getImageUrlWithFallback(
            athlete.profile_photo || athlete.profile_image,
            athlete.name || 'Athlete'
          )
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching coach athletes:', error);
      return { data: [], pagination: {} };
    }
  }

  static async getAthleteDetails(athleteId) {
    try {
      const token = await this.getAuthToken();
      if (!token) return null;
      
      const response = await this.makeAuthenticatedRequest(`/coach/athlete/${athleteId}`);
      
      // Process athlete photo
      if (response.athlete) {
        response.athlete.profile_photo = getImageUrlWithFallback(
          response.athlete.profile_photo,
          response.athlete.name
        );
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching athlete details:', error);
      return null;
    }
  }

  static async getCoachAssessments(params = {}) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [], stats: null };
      }
      
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/coach/assessments?${queryParams}` : '/coach/assessments';
      
      const response = await this.makeAuthenticatedRequest(url);
      
      // Process image URLs with athlete names for fallback
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(assessment => ({
          ...assessment,
          athlete: assessment.athlete ? {
            ...assessment.athlete,
            profile_photo: getImageUrlWithFallback(
              assessment.athlete.profile_photo,
              assessment.athlete.name || 'Athlete'
            )
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching coach assessments:', error);
      return { data: [], stats: null };
    }
  }

  static async getCoachDashboardFeed(page = 1, limit = 20) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [], total: 0 };
      }
      
      const response = await this.makeAuthenticatedRequest(
        `/coach/dashboard/feed?page=${page}&limit=${limit}`
      );
      
      // Process image URLs
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(post => ({
          ...post,
          user: post.user ? {
            ...post.user,
            profile_photo: getImageUrlWithFallback(
              post.user.profile_photo,
              post.user.name
            )
          } : null,
          content: {
            ...post.content,
            media_url: getImageUrl(post.content?.media_url)
          }
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching coach dashboard feed:', error);
      return { data: [], total: 0 };
    }
  }

  static async getAssessmentStatistics() {
    try {
      const token = await this.getAuthToken();
      if (!token) return null;
      
      const response = await this.makeAuthenticatedRequest('/coach/assessments/statistics');
      
      // Process top performers
      if (response.top_performers) {
        response.top_performers = response.top_performers.map(performer => ({
          ...performer,
          profile_photo: getImageUrlWithFallback(
            performer.profile_photo,
            performer.name || 'Athlete'
          )
        }));
      }
      
      // Process recent improvements
      if (response.recent_improvements) {
        response.recent_improvements = response.recent_improvements.map(item => ({
          ...item,
          athlete: item.athlete ? {
            ...item.athlete,
            profile_photo: getImageUrlWithFallback(
              item.athlete.profile_photo,
              item.athlete.name || 'Athlete'
            )
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching assessment statistics:', error);
      return null;
    }
  }

  static async getCoachProfile() {
    try {
      const response = await this.makeAuthenticatedRequest('/coach/profile');
      
      if (response.profile) {
        response.profile.profile_photo = getImageUrlWithFallback(
          response.profile.profile_photo,
          response.profile.name
        );
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching coach profile:', error);
      return null;
    }
  }

  static async updateCoachProfile(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const url = `${API_BASE_URL}/coach/profile`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update coach profile');
      }

      return data;
    } catch (error) {
      console.error('Coach profile update error:', error);
      throw error;
    }
  }

  // ==========================================
  // ASSESSMENT METHODS
  // ==========================================

  static async uploadAssessment(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/assessments/upload`, {
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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Bad JSON:", err);
        return { data: [] };
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

      if (response.status === 401) {
        return null;
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Stats parse error:", text);
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get assessment stats error:', error);
      return null;
    }
  }

  // ==========================================
  // USER STATS METHODS
  // ==========================================

  static async getUserStats() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { 
          data: {
            id: null,
            name: 'Guest',
            profilePhoto: null,
            nationalRank: null,
            totalAthletes: 0,
            aiScore: null,
            weeklyProgress: 0,
            percentile: null
          }
        };
      }
      
      const response = await this.makeAuthenticatedRequest('/users/stats');
      
      if (response.data && response.data.profilePhoto) {
        response.data.profilePhoto = getImageUrl(response.data.profilePhoto);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return { 
        data: {
          id: null,
          name: 'Guest',
          profilePhoto: null,
          nationalRank: null,
          totalAthletes: 0,
          aiScore: null,
          weeklyProgress: 0,
          percentile: null
        }
      };
    }
  }

  static async getUserStatsWithRank() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { 
          data: {
            id: null,
            name: 'Guest',
            profilePhoto: null,
            nationalRank: null,
            totalAthletes: 0,
            aiScore: null,
            weeklyProgress: 0,
            percentile: null,
            assessmentBreakdown: {}
          }
        };
      }
      
      const response = await this.makeAuthenticatedRequest('/users/stats');
      
      if (response.data && response.data.profilePhoto) {
        response.data.profilePhoto = getImageUrl(response.data.profilePhoto);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return { 
        data: {
          id: null,
          name: 'Guest',
          profilePhoto: null,
          nationalRank: null,
          totalAthletes: 0,
          aiScore: null,
          weeklyProgress: 0,
          percentile: null
        }
      };
    }
  }

  static async getDetailedStats() {
    try {
      const response = await this.makeAuthenticatedRequest('/users/stats/detailed');
      
      if (response.user && response.user.profilePhoto) {
        response.user.profilePhoto = getImageUrl(response.user.profilePhoto);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching detailed stats:', error);
      return null;
    }
  }

  static async getEnhancedUserStats() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { 
          data: {
            name: 'Guest',
            profilePhoto: null,
            nationalRank: null,
            aiScore: null,
            weeklyProgress: 0,
            totalAthletes: 0,
            percentile: null
          }
        };
      }
      
      const statsResponse = await this.makeAuthenticatedRequest('/users/stats');
      
      const userData = await AsyncStorage.getItem('userData');
      let rankData = { national_rank: null, total_athletes: 0, percentile: null };
      
      if (userData) {
        const user = JSON.parse(userData);
        try {
          rankData = await this.getUserRank(user.id);
        } catch (e) {
          console.log('Could not fetch rank data');
        }
      }
      
      return {
        data: {
          ...statsResponse.data,
          profilePhoto: getImageUrl(statsResponse.data?.profilePhoto),
          nationalRank: rankData.national_rank,
          totalAthletes: rankData.total_athletes,
          percentile: rankData.percentile
        }
      };
    } catch (error) {
      console.error('Error fetching enhanced user stats:', error);
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

  // ==========================================
  // RANKING METHODS
  // ==========================================

  static async getNationalRankings(sport = null, page = 1, limit = 50) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (sport) params.append('sport', sport);
      
      const response = await this.makePublicRequest(`/rankings/national?${params}`);
      
      if (response.data) {
        response.data = response.data.map(r => ({
          ...r,
          profile_photo: getImageUrlWithFallback(r.profile_photo, r.name)
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Get rankings error:', error);
      return { data: [], total: 0 };
    }
  }

  static async getUserRank(userId) {
    try {
      return await this.makeAuthenticatedRequest(`/rankings/user/${userId}`);
    } catch (error) {
      console.error('Get user rank error:', error);
      return { national_rank: null, total_athletes: 0, percentile: null };
    }
  }

  static async getMyRank() {
    try {
      const response = await this.makeAuthenticatedRequest('/rankings/me');
      
      if (response.profile_photo) {
        response.profile_photo = getImageUrl(response.profile_photo);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching my rank:', error);
      return {
        national_rank: null,
        total_athletes: 0,
        percentile: null,
        ai_score: null
      };
    }
  }

  static async recalculateRankings() {
    try {
      return await this.makeAuthenticatedRequest('/rankings/recalculate', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error recalculating rankings:', error);
      return null;
    }
  }

  // ==========================================
  // FEED & POSTS METHODS
  // ==========================================

  static async getFeedPosts(page = 1, limit = 10) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [], total: 0, page: 1 };
      }
      
      const response = await this.makeAuthenticatedRequest(`/posts/feed?page=${page}&limit=${limit}`);
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(post => ({
          ...post,
          user: post.user ? {
            ...post.user,
            profile_photo: getImageUrlWithFallback(post.user.profile_photo, post.user.name)
          } : null,
          content: {
            ...post.content,
            media_url: getImageUrl(post.content?.media_url)
          }
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      return { data: [], total: 0, page: 1 };
    }
  }

  static async getMyPosts(page = 1, limit = 50) {
    try {
      const response = await this.makeAuthenticatedRequest(`/posts/my-posts?page=${page}&limit=${limit}`);
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(post => ({
          ...post,
          text: post.text || post.content?.text || '',
          media_url: getImageUrl(post.media_url || post.content?.media_url),
          user: post.user ? {
            ...post.user,
            profile_photo: getImageUrlWithFallback(post.user.profile_photo, post.user.name)
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching my posts:', error);
      return { data: [], total: 0, page: 1 };
    }
  }

  static async createPost(formData) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create post');
      }

      return data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

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

  static async getComments(postId) {
    try {
      const response = await this.makeAuthenticatedRequest(`/posts/${postId}/comments`);
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(comment => ({
          ...comment,
          user: comment.user ? {
            ...comment.user,
            profile_photo: getImageUrlWithFallback(comment.user.profile_photo, comment.user.name)
          } : null
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

  static async getTrendingAthletes() {
    try {
      const response = await this.makePublicRequest('/athletes/trending');
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(athlete => ({
          ...athlete,
          profile_photo: getImageUrlWithFallback(athlete.profile_photo, athlete.name)
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
      return await this.makePublicRequest('/announcements');
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return { data: [] };
    }
  }

  // ==========================================
  // SEARCH METHODS
  // ==========================================

  static async search(query, type = 'all', page = 1, limit = 20) {
    try {
      const params = new URLSearchParams({
        q: query,
        type,
        page: page.toString(),
        limit: limit.toString()
      });
      
      const response = await this.makeAuthenticatedRequest(`/search?${params}`);
      
      if (response.athletes) {
        response.athletes = response.athletes.map(a => ({
          ...a,
          profile_photo: getImageUrlWithFallback(a.profile_photo, a.name)
        }));
      }
      if (response.coaches) {
        response.coaches = response.coaches.map(c => ({
          ...c,
          profile_photo: getImageUrlWithFallback(c.profile_photo, c.name)
        }));
      }
      if (response.posts) {
        response.posts = response.posts.map(p => ({
          ...p,
          media_url: getImageUrl(p.media_url),
          user: p.user ? {
            ...p.user,
            profile_photo: getImageUrlWithFallback(p.user.profile_photo, p.user.name)
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Search error:', error);
      return { athletes: [], coaches: [], posts: [], query };
    }
  }

  static async getSearchSuggestions(query) {
    try {
      const response = await this.makePublicRequest(`/search/suggestions?q=${encodeURIComponent(query)}`);
      return response.suggestions || [];
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  }

  // ==========================================
  // NOTIFICATION METHODS
  // ==========================================

  static async getNotifications(page = 1, limit = 20) {
    try {
      const response = await this.makeAuthenticatedRequest(`/notifications?page=${page}&limit=${limit}`);
      
      if (response.data) {
        response.data = response.data.map(n => ({
          ...n,
          user: n.user ? {
            ...n.user,
            profile_photo: getImageUrlWithFallback(n.user.profile_photo, n.user.name)
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Get notifications error:', error);
      return { data: [], total: 0, unread_count: 0 };
    }
  }

  static async getNotificationCount() {
    try {
      const response = await this.makeAuthenticatedRequest('/notifications/count');
      return response.count || 0;
    } catch (error) {
      console.error('Get notification count error:', error);
      return 0;
    }
  }

  // ==========================================
  // CONNECTION METHODS
  // ==========================================

  static async getSuggestedConnections() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { data: [] };
      }
      
      const response = await this.makeAuthenticatedRequest('/connections/suggestions');
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(connection => ({
          ...connection,
          profile_photo: getImageUrlWithFallback(connection.profile_photo, connection.name)
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

  // ==========================================
  // MESSAGING METHODS
  // ==========================================

  static async getConversations() {
    try {
      const response = await this.makeAuthenticatedRequest('/conversations');
      
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.map(conv => ({
          ...conv,
          other_user: conv.other_user ? {
            ...conv.other_user,
            profile_photo: getImageUrlWithFallback(conv.other_user.profile_photo, conv.other_user.name)
          } : null
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { data: [] };
    }
  }

  static async startConversation(recipientId) {
    try {
      return await this.makeAuthenticatedRequest('/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: recipientId })
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  static async getMessages(conversationId, page = 1) {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/conversations/${conversationId}/messages?page=${page}`
      );
      
      if (response.messages && Array.isArray(response.messages)) {
        response.messages = response.messages.map(msg => ({
          ...msg,
          sender: msg.sender ? {
            ...msg.sender,
            profile_photo: getImageUrlWithFallback(msg.sender.profile_photo, msg.sender.name)
          } : null,
          attachment_url: getImageUrl(msg.attachment_url)
        }));
      }
      
      if (response.conversation && response.conversation.other_user) {
        response.conversation.other_user.profile_photo = getImageUrlWithFallback(
          response.conversation.other_user.profile_photo,
          response.conversation.other_user.name
        );
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], conversation: null };
    }
  }

  static async sendMessage(conversationId, text, attachment = null) {
    try {
      const messageData = { text };
      
      if (attachment) {
        messageData.attachment_url = attachment.url;
        messageData.attachment_type = attachment.type;
      }
      
      return await this.makeAuthenticatedRequest(
        `/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(messageData)
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async editMessage(messageId, text) {
    try {
      return await this.makeAuthenticatedRequest(`/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({ text })
      });
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  static async deleteMessage(messageId) {
    try {
      return await this.makeAuthenticatedRequest(`/messages/${messageId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  static async markConversationRead(conversationId) {
    try {
      return await this.makeAuthenticatedRequest(
        `/conversations/${conversationId}/read`,
        { method: 'POST' }
      );
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  static async getUnreadCount() {
    try {
      const response = await this.makeAuthenticatedRequest('/messages/unread-count');
      return response.unread_count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  // ==========================================
  // PERFORMANCE DATA
  // ==========================================

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

  // ==========================================
  // TEST CONNECTION
  // ==========================================

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

} // End of ApiService class

// ============================================================================
// EXPORTS
// ============================================================================

// Export individual functions for easier imports
export const login = ApiService.login.bind(ApiService);
export const signup = ApiService.signup.bind(ApiService);
export const logout = ApiService.logout.bind(ApiService);
export const isLoggedIn = ApiService.isLoggedIn.bind(ApiService);
export const getCurrentUser = ApiService.getCurrentUser.bind(ApiService);
export const getAuthToken = ApiService.getAuthToken.bind(ApiService);

// Profile
export const updateProfile = ApiService.updateProfile.bind(ApiService);
export const uploadProfileImage = ApiService.uploadProfileImage.bind(ApiService);

// Coach
export const getCoachDashboardStats = ApiService.getCoachDashboardStats.bind(ApiService);
export const getCoachAthletes = ApiService.getCoachAthletes.bind(ApiService);
export const getAthleteDetails = ApiService.getAthleteDetails.bind(ApiService);
export const getCoachAssessments = ApiService.getCoachAssessments.bind(ApiService);
export const getCoachDashboardFeed = ApiService.getCoachDashboardFeed.bind(ApiService);
export const getAssessmentStatistics = ApiService.getAssessmentStatistics.bind(ApiService);
export const getCoachProfile = ApiService.getCoachProfile.bind(ApiService);
export const updateCoachProfile = ApiService.updateCoachProfile.bind(ApiService);

// Assessments
export const uploadAssessment = ApiService.uploadAssessment.bind(ApiService);
export const getAssessments = ApiService.getAssessments.bind(ApiService);
export const getAssessmentStats = ApiService.getAssessmentStats.bind(ApiService);

// User Stats
export const getUserStats = ApiService.getUserStats.bind(ApiService);
export const getUserStatsWithRank = ApiService.getUserStatsWithRank.bind(ApiService);
export const getDetailedStats = ApiService.getDetailedStats.bind(ApiService);
export const getEnhancedUserStats = ApiService.getEnhancedUserStats.bind(ApiService);

// Rankings
export const getNationalRankings = ApiService.getNationalRankings.bind(ApiService);
export const getUserRank = ApiService.getUserRank.bind(ApiService);
export const getMyRank = ApiService.getMyRank.bind(ApiService);
export const recalculateRankings = ApiService.recalculateRankings.bind(ApiService);

// Posts & Feed
export const getFeedPosts = ApiService.getFeedPosts.bind(ApiService);
export const getMyPosts = ApiService.getMyPosts.bind(ApiService);
export const createPost = ApiService.createPost.bind(ApiService);
export const likePost = ApiService.likePost.bind(ApiService);
export const unlikePost = ApiService.unlikePost.bind(ApiService);
export const getComments = ApiService.getComments.bind(ApiService);
export const addComment = ApiService.addComment.bind(ApiService);
export const getTrendingAthletes = ApiService.getTrendingAthletes.bind(ApiService);
export const getAnnouncements = ApiService.getAnnouncements.bind(ApiService);

// Search
export const search = ApiService.search.bind(ApiService);
export const getSearchSuggestions = ApiService.getSearchSuggestions.bind(ApiService);

// Notifications
export const getNotifications = ApiService.getNotifications.bind(ApiService);
export const getNotificationCount = ApiService.getNotificationCount.bind(ApiService);

// Connections
export const getSuggestedConnections = ApiService.getSuggestedConnections.bind(ApiService);
export const sendConnectionRequest = ApiService.sendConnectionRequest.bind(ApiService);

// Messaging
export const getConversations = ApiService.getConversations.bind(ApiService);
export const startConversation = ApiService.startConversation.bind(ApiService);
export const getMessages = ApiService.getMessages.bind(ApiService);
export const sendMessage = ApiService.sendMessage.bind(ApiService);
export const editMessage = ApiService.editMessage.bind(ApiService);
export const deleteMessage = ApiService.deleteMessage.bind(ApiService);
export const markConversationRead = ApiService.markConversationRead.bind(ApiService);
export const getUnreadCount = ApiService.getUnreadCount.bind(ApiService);
// All Athletes (Coach)
export const getAllAthletes = ApiService.getAllAthletes.bind(ApiService);
export const getTopAthletes = ApiService.getTopAthletes.bind(ApiService);
export const getActiveAthletes = ApiService.getActiveAthletes.bind(ApiService);
export const getRisingStars = ApiService.getRisingStars.bind(ApiService);
// Performance
export const getPerformanceData = ApiService.getPerformanceData.bind(ApiService);

// Test
export const testConnection = ApiService.testConnection.bind(ApiService);

// Default export
export default ApiService;