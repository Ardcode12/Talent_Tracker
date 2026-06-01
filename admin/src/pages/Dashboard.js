// admin/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { 
  FiUsers, FiClipboard, FiTrendingUp, FiAlertTriangle, 
  FiCalendar, FiUserCheck, FiActivity,
  FiArrowUp, FiClock
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { getDashboardStats, getRecentAssessments, getPendingEvents } from '../services/api-client';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading dashboard data...');
      
      const [statsResponse, assessmentsResponse, eventsResponse] = await Promise.all([
        getDashboardStats().catch(err => {
          console.error('Stats error:', err);
          return {};
        }),
        getRecentAssessments(5).catch(err => {
          console.error('Assessments error:', err);
          return { data: [] };
        }),
        getPendingEvents(5).catch(err => {
          console.error('Events error:', err);
          return { data: [] };
        })
      ]);
      
      console.log('📊 Stats:', statsResponse);
      console.log('📋 Assessments:', assessmentsResponse);
      console.log('📅 Events:', eventsResponse);
      
      setStats(statsResponse || {});
      setRecentAssessments(assessmentsResponse?.data || []);
      setPendingEvents(eventsResponse?.data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (photo, name) => {
    if (photo && photo.startsWith('http')) return photo;
    if (photo && photo.startsWith('/')) return `http://localhost:8000${photo}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <FiAlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connection Issue</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back! Here's what's happening.</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p>Last updated</p>
          <p className="text-white font-medium">{new Date().toLocaleString()}</p>
        </div>
      </div>
      
      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<FiUsers />}
          title="Total Athletes"
          value={stats.total_athletes || 0}
          change={stats.new_users_week || 0}
          changeLabel="new this week"
          color="indigo"
        />
        <StatCard
          icon={<FiUserCheck />}
          title="Total Coaches"
          value={stats.total_coaches || 0}
          color="emerald"
        />
        <StatCard
          icon={<FiClipboard />}
          title="Total Assessments"
          value={stats.total_assessments || 0}
          change={stats.new_assessments_week || 0}
          changeLabel="this week"
          color="blue"
        />
        <StatCard
          icon={<FiTrendingUp />}
          title="Avg AI Score"
          value={`${stats.average_score || 0}%`}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AlertCard
          icon={<FiClock />}
          title="Pending Assessments"
          value={stats.pending_assessments || 0}
          link="/assessments?status=pending"
          color="yellow"
        />
        <AlertCard
          icon={<FiCalendar />}
          title="Pending Events"
          value={stats.pending_events || 0}
          link="/events?status=pending"
          color="orange"
        />
        <AlertCard
          icon={<FiAlertTriangle />}
          title="Flagged Items"
          value={stats.flagged_assessments || 0}
          link="/assessments?flagged=true"
          color="red"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assessments */}
        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Recent Assessments</h2>
            <Link to="/assessments" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          {recentAssessments.length > 0 ? (
            <div className="space-y-4">
              {recentAssessments.map((assessment) => (
                <div 
                  key={assessment.id} 
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-700/30 hover:border-gray-600/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={getImageUrl(assessment.athlete_photo, assessment.athlete_name)}
                      alt={assessment.athlete_name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(assessment.athlete_name || 'A')}&background=6366f1&color=fff`;
                      }}
                    />
                    <div>
                      <p className="font-medium text-white">{assessment.athlete_name || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">{assessment.test_type?.replace('_', ' ') || 'Assessment'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      assessment.ai_score >= 80 ? 'text-emerald-400' :
                      assessment.ai_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {assessment.ai_score?.toFixed(1) || 'N/A'}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {assessment.created_at ? new Date(assessment.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FiClipboard size={40} className="mx-auto mb-3 opacity-50" />
              <p>No recent assessments</p>
            </div>
          )}
        </div>

        {/* Pending Events */}
        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Pending Event Approvals</h2>
            <Link to="/events" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          {pendingEvents.length > 0 ? (
            <div className="space-y-4">
              {pendingEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="p-4 bg-gray-900/50 rounded-xl border border-gray-700/30 hover:border-gray-600/50 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-white">{event.title}</h3>
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      Pending
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{event.event_type} • {event.sport}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      By: {event.creator?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.start_date ? new Date(event.start_date).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FiCalendar size={40} className="mx-auto mb-3 opacity-50" />
              <p>No pending events</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700/50">
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton 
            icon={<FiUsers />} 
            label="View Athletes" 
            to="/athletes" 
            color="indigo"
          />
          <QuickActionButton 
            icon={<FiClipboard />} 
            label="Review Assessments" 
            to="/assessments" 
            color="blue"
          />
          <QuickActionButton 
            icon={<FiCalendar />} 
            label="Manage Events" 
            to="/events" 
            color="purple"
          />
          <QuickActionButton 
            icon={<FiActivity />} 
            label="View Analytics" 
            to="/analytics" 
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, title, value, change, changeLabel, color }) => {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]}`}>
          {React.cloneElement(icon, { size: 24, className: 'text-white' })}
        </div>
        {change !== undefined && change > 0 && (
          <div className="flex items-center gap-1 text-emerald-400 text-sm">
            <FiArrowUp size={14} />
            <span>+{change}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-gray-400 text-sm mt-1">{title}</p>
        {changeLabel && (
          <p className="text-xs text-gray-500 mt-1">{changeLabel}</p>
        )}
      </div>
    </div>
  );
};

// Alert Card Component
const AlertCard = ({ icon, title, value, link, color }) => {
  const colorClasses = {
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <Link 
      to={link}
      className={`block p-6 rounded-2xl border ${colorClasses[color]} hover:scale-[1.02] transition-all`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {React.cloneElement(icon, { size: 24 })}
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        </div>
        <FiArrowUp className="rotate-45" size={20} />
      </div>
    </Link>
  );
};

// Quick Action Button
const QuickActionButton = ({ icon, label, to, color }) => {
  const colorClasses = {
    indigo: 'hover:bg-indigo-500/10 hover:border-indigo-500/50 text-indigo-400',
    blue: 'hover:bg-blue-500/10 hover:border-blue-500/50 text-blue-400',
    purple: 'hover:bg-purple-500/10 hover:border-purple-500/50 text-purple-400',
    emerald: 'hover:bg-emerald-500/10 hover:border-emerald-500/50 text-emerald-400',
  };

  return (
    <Link 
      to={to}
      className={`flex items-center gap-3 p-4 rounded-xl border border-gray-700/50 ${colorClasses[color]} transition-all`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="font-medium text-white">{label}</span>
    </Link>
  );
};

export default Dashboard;