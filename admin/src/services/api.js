// admin/src/services/api.js
import axios from 'axios';

// API Base URL - Use localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

console.log('🌐 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: false, // Important for CORS
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token && token !== 'dev-token-bypass-12345') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug log
    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url);
    // Return the data directly
    return response.data;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle 401 Unauthorized - but not for dev token
    const token = localStorage.getItem('adminToken');
    if (error.response?.status === 401 && token !== 'dev-token-bypass-12345') {
      console.warn('🔒 Authentication failed, redirecting to login...');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/';
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('🔴 Network Error - Is the backend running on', API_BASE_URL, '?');
    }
    
    return Promise.reject(error);
  }
);

export default api;