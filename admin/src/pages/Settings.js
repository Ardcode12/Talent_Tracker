// admin/src/pages/Settings.js
import React, { useState, useEffect } from 'react';
import { 
  FiSave, FiRefreshCw, FiUsers, FiSettings, FiDatabase,
  FiShield, FiAlertTriangle, FiCheck, FiInfo, FiServer,
  FiActivity, FiClipboard, FiMail, FiBell, FiLock
} from 'react-icons/fi';
import { getBenchmarks, updateBenchmarks, getUsageStats } from '../services/api-client';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('benchmarks');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Benchmarks State
  const [benchmarks, setBenchmarks] = useState({
    shuttle_run: { beginner: 50, intermediate: 70, advanced: 85, elite: 95 },
    vertical_jump: { beginner: 40, intermediate: 60, advanced: 80, elite: 90 },
    squats: { beginner: 30, intermediate: 50, advanced: 70, elite: 85 },
    height_detection: { beginner: 95, intermediate: 97, advanced: 98, elite: 99 }
  });
  
  // Usage Stats State
  const [usageStats, setUsageStats] = useState({
    total_users: 0,
    active_users: 0,
    total_assessments: 0,
    recent_assessments: 0,
    total_posts: 0,
    total_messages: 0
  });
  
  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    enableNotifications: true,
    enableEmailAlerts: false,
    autoVerifyHighScores: false,
    autoVerifyThreshold: 90,
    maintenanceMode: false,
    debugMode: false,
    maxUploadSize: 100,
    sessionTimeout: 30,
    enableCheatDetection: true,
    cheatDetectionSensitivity: 'medium'
  });
  
  // Admin Settings State
  const [adminSettings, setAdminSettings] = useState({
    requireTwoFactor: false,
    passwordExpiry: 90,
    maxLoginAttempts: 5,
    ipWhitelist: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const [benchmarksRes, statsRes] = await Promise.all([
        getBenchmarks().catch(() => ({ benchmarks: {} })),
        getUsageStats().catch(() => ({}))
      ]);
      
      if (benchmarksRes?.benchmarks) {
        setBenchmarks(prev => ({ ...prev, ...benchmarksRes.benchmarks }));
      }
      
      if (statsRes) {
        setUsageStats(prev => ({ ...prev, ...statsRes }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBenchmarks = async () => {
    try {
      setSaving(true);
      await updateBenchmarks(benchmarks);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving benchmarks:', error);
      alert('Failed to save benchmarks');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    try {
      setSaving(true);
      // In a real app, this would call an API
      console.log('Saving system settings:', systemSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving system settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminSettings = async () => {
    try {
      setSaving(true);
      // In a real app, this would call an API
      console.log('Saving admin settings:', adminSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving admin settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'benchmarks', label: 'Performance Benchmarks', icon: FiActivity },
    { id: 'system', label: 'System Settings', icon: FiSettings },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'stats', label: 'Usage Statistics', icon: FiDatabase },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Configure system preferences and benchmarks</p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400">
            <FiCheck size={18} />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 p-6">
        
        {/* Benchmarks Tab */}
        {activeTab === 'benchmarks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Performance Benchmarks</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Set score thresholds for different skill levels
                </p>
              </div>
              <button
                onClick={handleSaveBenchmarks}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <FiSave size={18} />
                )}
                Save Benchmarks
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(benchmarks).map(([testType, levels]) => (
                <div key={testType} className="bg-gray-900/50 rounded-xl p-5">
                  <h3 className="font-bold text-white mb-4 capitalize flex items-center gap-2">
                    <FiActivity className="text-indigo-400" />
                    {testType.replace(/_/g, ' ')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(levels).map(([level, score]) => (
                      <div key={level}>
                        <label className="block text-sm font-medium text-gray-400 mb-2 capitalize">
                          {level}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={score}
                            onChange={(e) => setBenchmarks({
                              ...benchmarks,
                              [testType]: {
                                ...levels,
                                [level]: parseInt(e.target.value) || 0
                              }
                            })}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Benchmark Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
              <FiInfo className="text-blue-400 mt-0.5" size={20} />
              <div>
                <p className="text-blue-400 font-medium">How Benchmarks Work</p>
                <p className="text-gray-400 text-sm mt-1">
                  These thresholds determine how athletes are classified based on their AI scores.
                  Athletes scoring above the "Elite" threshold are considered top performers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Settings Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">System Settings</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Configure general system behavior
                </p>
              </div>
              <button
                onClick={handleSaveSystemSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <FiSave size={18} />
                )}
                Save Settings
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notifications */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiBell className="text-yellow-400" />
                  Notifications
                </h3>
                <div className="space-y-4">
                  <ToggleSetting
                    label="Enable Push Notifications"
                    description="Send notifications to users"
                    checked={systemSettings.enableNotifications}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, enableNotifications: checked })}
                  />
                  <ToggleSetting
                    label="Email Alerts"
                    description="Send email alerts for important events"
                    checked={systemSettings.enableEmailAlerts}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, enableEmailAlerts: checked })}
                  />
                </div>
              </div>

              {/* Auto Verification */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiCheck className="text-emerald-400" />
                  Auto Verification
                </h3>
                <div className="space-y-4">
                  <ToggleSetting
                    label="Auto-Verify High Scores"
                    description="Automatically verify assessments above threshold"
                    checked={systemSettings.autoVerifyHighScores}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, autoVerifyHighScores: checked })}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Auto-Verify Threshold
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={systemSettings.autoVerifyThreshold}
                        onChange={(e) => setSystemSettings({ 
                          ...systemSettings, 
                          autoVerifyThreshold: parseInt(e.target.value) || 0 
                        })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cheat Detection */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiAlertTriangle className="text-red-400" />
                  Cheat Detection
                </h3>
                <div className="space-y-4">
                  <ToggleSetting
                    label="Enable Cheat Detection"
                    description="Automatically flag suspicious assessments"
                    checked={systemSettings.enableCheatDetection}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, enableCheatDetection: checked })}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Detection Sensitivity
                    </label>
                    <select
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={systemSettings.cheatDetectionSensitivity}
                      onChange={(e) => setSystemSettings({ 
                        ...systemSettings, 
                        cheatDetectionSensitivity: e.target.value 
                      })}
                    >
                      <option value="low">Low - Fewer false positives</option>
                      <option value="medium">Medium - Balanced</option>
                      <option value="high">High - Strict detection</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Server Settings */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiServer className="text-purple-400" />
                  Server Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Max Upload Size (MB)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={systemSettings.maxUploadSize}
                      onChange={(e) => setSystemSettings({ 
                        ...systemSettings, 
                        maxUploadSize: parseInt(e.target.value) || 100 
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={systemSettings.sessionTimeout}
                      onChange={(e) => setSystemSettings({ 
                        ...systemSettings, 
                        sessionTimeout: parseInt(e.target.value) || 30 
                      })}
                    />
                  </div>
                  <ToggleSetting
                    label="Maintenance Mode"
                    description="Disable access for non-admin users"
                    checked={systemSettings.maintenanceMode}
                    onChange={(checked) => setSystemSettings({ ...systemSettings, maintenanceMode: checked })}
                    danger
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Security Settings</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Configure admin security preferences
                </p>
              </div>
              <button
                onClick={handleSaveAdminSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <FiSave size={18} />
                )}
                Save Security Settings
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Authentication */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiLock className="text-indigo-400" />
                  Authentication
                </h3>
                <div className="space-y-4">
                  <ToggleSetting
                    label="Require Two-Factor Auth"
                    description="Require 2FA for all admin accounts"
                    checked={adminSettings.requireTwoFactor}
                    onChange={(checked) => setAdminSettings({ ...adminSettings, requireTwoFactor: checked })}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Password Expiry (days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={adminSettings.passwordExpiry}
                      onChange={(e) => setAdminSettings({ 
                        ...adminSettings, 
                        passwordExpiry: parseInt(e.target.value) || 90 
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Set to 0 to disable password expiry</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Max Login Attempts
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={adminSettings.maxLoginAttempts}
                      onChange={(e) => setAdminSettings({ 
                        ...adminSettings, 
                        maxLoginAttempts: parseInt(e.target.value) || 5 
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Access Control */}
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiShield className="text-emerald-400" />
                  Access Control
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      IP Whitelist
                    </label>
                    <textarea
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                      placeholder="Enter IP addresses (one per line)..."
                      value={adminSettings.ipWhitelist}
                      onChange={(e) => setAdminSettings({ 
                        ...adminSettings, 
                        ipWhitelist: e.target.value 
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty to allow all IPs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <FiAlertTriangle className="text-yellow-400 mt-0.5" size={20} />
              <div>
                <p className="text-yellow-400 font-medium">Security Reminder</p>
                <p className="text-gray-400 text-sm mt-1">
                  Always use strong passwords and enable two-factor authentication for enhanced security.
                  Regularly review admin access and remove unused accounts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Usage Statistics</h2>
                <p className="text-gray-400 text-sm mt-1">
                  System usage and performance metrics
                </p>
              </div>
              <button
                onClick={loadSettings}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all"
              >
                <FiRefreshCw size={18} />
                Refresh
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard 
                icon={<FiUsers />} 
                label="Total Users" 
                value={usageStats.total_users} 
                color="indigo"
              />
              <StatCard 
                icon={<FiUsers />} 
                label="Active Users (30d)" 
                value={usageStats.active_users} 
                color="emerald"
              />
              <StatCard 
                icon={<FiClipboard />} 
                label="Total Assessments" 
                value={usageStats.total_assessments} 
                color="blue"
              />
              <StatCard 
                icon={<FiClipboard />} 
                label="Recent (7d)" 
                value={usageStats.recent_assessments} 
                color="purple"
              />
              <StatCard 
                icon={<FiActivity />} 
                label="Total Posts" 
                value={usageStats.total_posts} 
                color="pink"
              />
              <StatCard 
                icon={<FiMail />} 
                label="Total Messages" 
                value={usageStats.total_messages} 
                color="yellow"
              />
            </div>

            {/* App Version Distribution */}
            {usageStats.version_distribution && (
              <div className="bg-gray-900/50 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FiServer className="text-purple-400" />
                  App Version Distribution
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Android</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Latest Version</span>
                        <span className="text-emerald-400 font-medium">
                          {usageStats.version_distribution.android?.latest || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: `${usageStats.version_distribution.android?.latest || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Outdated</span>
                        <span className="text-yellow-400 font-medium">
                          {usageStats.version_distribution.android?.outdated || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full" 
                          style={{ width: `${usageStats.version_distribution.android?.outdated || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">iOS</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Latest Version</span>
                        <span className="text-emerald-400 font-medium">
                          {usageStats.version_distribution.ios?.latest || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: `${usageStats.version_distribution.ios?.latest || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Outdated</span>
                        <span className="text-yellow-400 font-medium">
                          {usageStats.version_distribution.ios?.outdated || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full" 
                          style={{ width: `${usageStats.version_distribution.ios?.outdated || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Info */}
            <div className="bg-gray-900/50 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <FiInfo className="text-blue-400" />
                System Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">API Version</p>
                  <p className="text-white font-medium">1.0.0</p>
                </div>
                <div>
                  <p className="text-gray-400">Database</p>
                  <p className="text-white font-medium">PostgreSQL</p>
                </div>
                <div>
                  <p className="text-gray-400">Server</p>
                  <p className="text-white font-medium">FastAPI / Uvicorn</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Updated</p>
                  <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Toggle Setting Component
const ToggleSetting = ({ label, description, checked, onChange, danger = false }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`font-medium ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked 
            ? danger ? 'bg-red-500' : 'bg-indigo-500' 
            : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    indigo: 'text-indigo-400 bg-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
    pink: 'text-pink-400 bg-pink-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
  };

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 text-center">
      <div className={`inline-flex p-2 rounded-lg ${colorClasses[color]} mb-2`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <p className="text-2xl font-bold text-white">{value || 0}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
};

export default Settings;