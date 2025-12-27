import React, { useState, useEffect } from 'react';
import { FiUsers, FiClipboard, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { getStats, getRecentAssessments } from '../services/api-client';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsResponse, assessmentsResponse] = await Promise.all([
        getStats(),
        getRecentAssessments(5)
      ]);
      
      setStats(statsResponse);
      setRecentAssessments(assessmentsResponse.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<FiUsers size={24} />}
          title="Total Athletes"
          value={stats.total_athletes || 0}
          color="text-blue-500"
        />
        <StatCard
          icon={<FiClipboard size={24} />}
          title="Pending Assessments"
          value={stats.pending_assessments || 0}
          color="text-yellow-500"
        />
        <StatCard
          icon={<FiTrendingUp size={24} />}
          title="Avg AI Score"
          value={stats.average_score ? `${stats.average_score}%` : 'N/A'}
          color="text-green-500"
        />
        <StatCard
          icon={<FiAlertTriangle size={24} />}
          title="Flagged Assessments"
          value={stats.flagged_assessments || 0}
          color="text-red-500"
        />
      </div>

      {/* Recent Assessments */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Assessments</h2>
        {recentAssessments.length > 0 ? (
          <div className="space-y-4">
            {recentAssessments.map((assessment) => (
              <div key={assessment.id} className="border-b border-gray-700 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{assessment.test_type}</h3>
                    <p className="text-gray-400">Athlete ID: {assessment.user_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{assessment.ai_score}%</p>
                    <p className="text-xs text-gray-400">
                      {new Date(assessment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No recent assessments</p>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <div className="bg-gray-800 rounded-lg p-6 flex items-center space-x-4">
    <div className={`p-3 rounded-full bg-gray-700 ${color}`}>{icon}</div>
    <div>
      <p className="text-gray-400">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

export default Dashboard;