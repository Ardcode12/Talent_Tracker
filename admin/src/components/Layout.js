import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IoHome, IoPeople, IoClipboard, IoBarChart, IoSettings } from 'react-icons/io5';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: IoHome, label: 'Dashboard' },
    { path: '/athletes', icon: IoPeople, label: 'Athletes' },
    { path: '/assessments', icon: IoClipboard, label: 'Assessments' },
    { path: '/analytics', icon: IoBarChart, label: 'Analytics' },
    { path: '/settings', icon: IoSettings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4">
        <div className="text-xl font-bold text-center mb-8">TalentTracker</div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  isActive ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Layout;