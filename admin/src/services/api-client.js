import api from './api';

// Athletes API
export const getAthletes = async (params = {}) => {
  const queryParams = new URLSearchParams(params);
  return api.get(`/athletes?${queryParams}`);
};

export const getAthleteDetails = async (athleteId) => {
  return api.get(`/athletes/${athleteId}`);
};

export const exportAthletes = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return api.get(`/athletes/export?${params}`);
};

// Assessments API
export const getAssessments = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return api.get(`/assessments?${params}`);
};

export const verifyAssessment = async (id, verified, feedback) => {
  return api.put(`/assessments/${id}/verify`, { verified, feedback });
};

// Analytics API
export const getTalentMap = async () => {
  return api.get('/analytics/talent-map');
};

export const getPerformanceTrends = async (days = 30) => {
  return api.get(`/analytics/performance-trends?days=${days}`);
};

// Settings API
export const updateBenchmarks = async (benchmarks) => {
  return api.put('/benchmarks', benchmarks);
};

export const getUsageStats = async () => {
  return api.get('/usage-stats');
};

// Dashboard API
export const getStats = async () => {
  return api.get('/dashboard/stats');
};

export const getRecentAssessments = async (limit = 5) => {
  return api.get(`/assessments?limit=${limit}&status=pending`);
};

// ✅ Add this missing function for CheatDetection.js
export const getAnomalies = async () => {
  return api.get('/analytics/anomalies');
};