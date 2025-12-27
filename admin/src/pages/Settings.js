import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiUsers } from 'react-icons/fi';  // ✅ Added FiUsers
import { updateBenchmarks } from '../services/api-client';  // ✅ Removed unused getUsageStats

const Settings = () => {
  const [benchmarks, setBenchmarks] = useState({
    shuttle_run: { beginner: 50, intermediate: 70, advanced: 85 },
    vertical_jump: { beginner: 40, intermediate: 60, advanced: 80 },
    squats: { beginner: 30, intermediate: 50, advanced: 70 }
  });
  const [usageStats, setUsageStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      // In a real app, this would fetch from API
      // For now, we'll use mock data
      const mockStats = {
        total_users: 1242,
        active_users: 856,
        total_assessments: 3456,
        recent_assessments: 78,
        version_distribution: {
          android: { latest: 75, outdated: 25 },
          ios: { latest: 80, outdated: 20 }
        }
      };
      
      setUsageStats(mockStats);
    } catch (error) {
      console.error('Error loading settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBenchmarks = async () => {
    try {
      await updateBenchmarks(benchmarks);
      alert('Benchmarks saved successfully');
    } catch (error) {
      console.error('Error saving benchmarks:', error);
      alert('Error saving benchmarks');
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
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Benchmarks */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Performance Benchmarks</h2>
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2"
              onClick={handleSaveBenchmarks}
            >
              <FiSave />
              <span>Save</span>
            </button>
          </div>
          
          <div className="space-y-6">
            {Object.entries(benchmarks).map(([testType, levels]) => (
              <div key={testType}>
                <h3 className="font-bold mb-3 capitalize">{testType.replace('_', ' ')}</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(levels).map(([level, score]) => (
                    <div key={level}>
                      <label className="block text-sm font-medium mb-1 capitalize">
                        {level}
                      </label>
                      <input
                        type="number"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                        value={score}
                        onChange={(e) => setBenchmarks({
                          ...benchmarks,
                          [testType]: {
                            ...levels,
                            [level]: parseInt(e.target.value) || 0
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Stats */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">System Statistics</h2>
          
          <div className="space-y-4">
            <StatItem
              icon={<FiUsers />}
              title="Total Users"
              value={usageStats.total_users}
            />
            
            <StatItem
              icon={<FiUsers />}
              title="Active Users (30d)"
              value={usageStats.active_users}
            />
            
            <StatItem
              icon={<FiRefreshCw />}
              title="Total Assessments"
              value={usageStats.total_assessments}
            />
            
            <StatItem
              icon={<FiRefreshCw />}
              title="Recent Assessments (7d)"
              value={usageStats.recent_assessments}
            />
            
            <div className="mt-6">
              <h3 className="font-bold mb-3">App Versions</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Android Latest</span>
                  <span>{usageStats.version_distribution?.android?.latest}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Android Outdated</span>
                  <span>{usageStats.version_distribution?.android?.outdated}%</span>
                </div>
                <div className="flex justify-between">
                  <span>iOS Latest</span>
                  <span>{usageStats.version_distribution?.ios?.latest}%</span>
                </div>
                <div className="flex justify-between">
                  <span>iOS Outdated</span>
                  <span>{usageStats.version_distribution?.ios?.outdated}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ icon, title, value }) => (
  <div className="flex items-center space-x-3 bg-gray-700 rounded-lg p-3">
    <div className="p-2 bg-gray-600 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-gray-400">{title}</p>
      <p className="font-bold text-xl">{value}</p>
    </div>
  </div>
);

export default Settings;