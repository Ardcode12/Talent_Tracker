// admin/src/components/Layout.js
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  IoHome, IoPeople, IoClipboard, IoBarChart, IoSettings,
  IoCalendar, IoLogOut, IoMenu, IoClose, IoPersonCircle
} from 'react-icons/io5';
import { FiUsers } from 'react-icons/fi';

const Layout = ({ children, onLogout }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  const navItems = [
    { path: '/', icon: IoHome, label: 'Dashboard' },
    { path: '/athletes', icon: IoPeople, label: 'Athletes' },
    { path: '/coaches', icon: FiUsers, label: 'Coaches' },
    { path: '/assessments', icon: IoClipboard, label: 'Assessments' },
    { path: '/events', icon: IoCalendar, label: 'Events' },
    { path: '/analytics', icon: IoBarChart, label: 'Analytics' },
    { path: '/settings', icon: IoSettings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-800/50 backdrop-blur-xl border-r border-gray-700/50 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-lg font-bold">TT</span>
              </div>
              {sidebarOpen && (
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  TalentTracker
                </span>
              )}
            </Link>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-all lg:hidden"
            >
              {sidebarOpen ? <IoClose size={20} /> : <IoMenu size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25' 
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <Icon size={22} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700/50">
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                  <IoPersonCircle size={24} />
                </div>
                <div>
                  <p className="font-medium text-sm">{adminUser.name || 'Admin'}</p>
                  <p className="text-xs text-gray-400">{adminUser.role || 'Administrator'}</p>
                </div>
              </div>
            )}
            <button
              onClick={onLogout}
              className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
              title="Logout"
            >
              <IoLogOut size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;