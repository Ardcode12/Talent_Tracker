// admin/src/services/api-client.js
import api from './api';

// ============================================================================
// DASHBOARD
// ============================================================================

export const getDashboardStats = async () => {
  return api.get('/api/admin/dashboard/stats');
};

export const getRecentAssessments = async (limit = 5) => {
  return api.get(`/api/admin/assessments?limit=${limit}&status=pending`);
};

export const getPendingEvents = async (limit = 5) => {
  return api.get(`/api/admin/events?status=pending&limit=${limit}`);
};

// ============================================================================
// ATHLETES
// ============================================================================

export const getAthletes = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      queryParams.append(key, value);
    }
  });
  return api.get(`/api/admin/athletes?${queryParams}`);
};

export const getAthleteDetails = async (athleteId) => {
  return api.get(`/api/admin/athletes/${athleteId}`);
};

export const verifyAthlete = async (athleteId, verified) => {
  return api.put(`/api/admin/athletes/${athleteId}/verify`, { verified });
};

export const deactivateAthlete = async (athleteId) => {
  return api.delete(`/api/admin/athletes/${athleteId}`);
};

export const exportAthletes = async (filters = {}) => {
  console.log('Exporting athletes with filters:', filters);
  return { message: 'Export started' };
};

// ============================================================================
// COACHES
// ============================================================================

export const getCoaches = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return api.get(`/api/admin/coaches?${queryParams}`);
};

// ============================================================================
// ASSESSMENTS
// ============================================================================

export const getAssessments = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      params.append(snakeKey, value);
    }
  });
  return api.get(`/api/admin/assessments?${params}`);
};

export const getAssessmentDetails = async (assessmentId) => {
  return api.get(`/api/admin/assessments/${assessmentId}`);
};

export const verifyAssessment = async (id, verified, feedback = null) => {
  return api.put(`/api/admin/assessments/${id}/verify`, { verified, feedback });
};

// ============================================================================
// EVENTS
// ============================================================================

export const getEvents = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      queryParams.append(key, value);
    }
  });
  return api.get(`/api/admin/events?${queryParams}`);
};

export const getEventDetails = async (eventId) => {
  return api.get(`/api/admin/events/${eventId}`);
};

export const approveEvent = async (eventId, approved, rejectionReason = null) => {
  return api.put(`/api/admin/events/${eventId}/approve`, { 
    approved, 
    rejection_reason: rejectionReason 
  });
};

export const featureEvent = async (eventId, featured) => {
  return api.put(`/api/admin/events/${eventId}/feature`, { featured });
};

export const deleteEvent = async (eventId) => {
  return api.delete(`/api/admin/events/${eventId}`);
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const getTalentMap = async () => {
  return api.get('/api/admin/analytics/talent-map');
};

export const getPerformanceTrends = async (days = 30) => {
  return api.get(`/api/admin/analytics/performance-trends?days=${days}`);
};

export const getAnalyticsOverview = async () => {
  return api.get('/api/admin/analytics/overview');
};

// ============================================================================
// CHEAT DETECTION
// ============================================================================

export const getAnomalies = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return api.get(`/api/admin/cheat-detection/anomalies?${queryParams}`);
};

export const reviewAnomaly = async (assessmentId, isValid, notes = null) => {
  return api.post(`/api/admin/cheat-detection/${assessmentId}/review`, { 
    is_valid: isValid, 
    notes 
  });
};

// ============================================================================
// SETTINGS
// ============================================================================

export const getBenchmarks = async () => {
  return api.get('/api/admin/settings/benchmarks');
};

export const updateBenchmarks = async (benchmarks) => {
  return api.put('/api/admin/settings/benchmarks', { benchmarks });
};

export const getUsageStats = async () => {
  return api.get('/api/admin/settings/usage-stats');
};

// ============================================================================
// STATS (backwards compatibility)
// ============================================================================

export const getStats = getDashboardStats;