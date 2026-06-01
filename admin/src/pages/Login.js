// admin/src/pages/Login.js
import React, { useState } from 'react';
import { FiMail, FiLock, FiAlertCircle, FiLogIn, FiZap } from 'react-icons/fi';
import api from '../services/api';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@talenttracker.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/admin/auth/login', { 
        email, 
        password 
      });
      
      console.log('Login response:', response);
      
      if (response.token && response.admin) {
        onLogin(response.token, response.admin);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Login failed';
      setError(`${errorMessage}. Try the Dev Login button below.`);
    } finally {
      setLoading(false);
    }
  };

  // Dev bypass - skip authentication for development
  const handleDevLogin = () => {
    console.log('🔧 Dev Login - Bypassing authentication');
    const mockAdmin = {
      id: 1,
      email: 'admin@talenttracker.com',
      name: 'Admin User',
      role: 'admin'
    };
    onLogin('dev-token-bypass-12345', mockAdmin);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
            <span className="text-3xl font-bold text-white">TT</span>
          </div>
          <h1 className="text-4xl font-bold text-white">TalentTracker</h1>
          <p className="text-gray-400 mt-2 text-lg">Admin Dashboard</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-400">
              <FiAlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="admin@talenttracker.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <FiLogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Dev Login - FOR DEVELOPMENT ONLY */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-500 text-xs mb-4">
              Having trouble? Use Dev Login for testing
            </p>
            <button
              onClick={handleDevLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <FiZap size={18} />
              Dev Login (Skip Auth)
            </button>
          </div>

          {/* Credentials hint */}
          <div className="mt-6 p-4 bg-gray-900/50 rounded-xl">
            <p className="text-gray-400 text-sm text-center">
              <span className="text-gray-500">Default credentials:</span><br />
              <span className="text-indigo-400 font-mono">admin@talenttracker.com</span> / <span className="text-indigo-400 font-mono">admin123</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          © 2024 TalentTracker. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;