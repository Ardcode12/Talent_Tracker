// admin/src/pages/Coaches.js
import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiUser, FiMapPin, FiAward, FiUsers,
  FiMail, FiPhone, FiX
} from 'react-icons/fi';
import { getCoaches } from '../services/api-client';

const Coaches = () => {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoach, setSelectedCoach] = useState(null);

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    try {
      setLoading(true);
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await getCoaches(params);
      setCoaches(response?.data || []);
    } catch (error) {
      console.error('Error loading coaches:', error);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCoaches();
  };

  const getImageUrl = (photo, name) => {
    if (photo && photo.startsWith('http')) return photo;
    if (photo && photo.startsWith('/')) return `http://localhost:8000${photo}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Coach')}&background=2c3e50&color=fff&size=128`;
  };

  if (loading && coaches.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading coaches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Coaches</h1>
          <p className="text-gray-400 mt-1">Manage registered coaches</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{coaches.length}</p>
          <p className="text-gray-400 text-sm">Total Coaches</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-4 border border-gray-700/50">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search coaches by name, email, specialization..."
              className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Coaches Grid */}
      {coaches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div 
              key={coach.id}
              className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden hover:border-indigo-500/50 transition-all"
            >
              <div className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={getImageUrl(coach.profile_photo, coach.name)}
                    alt={coach.name}
                    className="w-16 h-16 rounded-xl object-cover"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.name || 'C')}&background=2c3e50&color=fff`;
                    }}
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg">{coach.name}</h3>
                    <p className="text-sm text-indigo-400">{coach.specialization || 'Coach'}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {coach.experience && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiAward size={14} className="text-yellow-400" />
                      <span>{coach.experience} years experience</span>
                    </div>
                  )}
                  {coach.location && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiMapPin size={14} className="text-emerald-400" />
                      <span>{coach.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-400">
                    <FiUsers size={14} className="text-blue-400" />
                    <span>{coach.connected_athletes || 0} athletes connected</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-900/30 border-t border-gray-700/50 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {coach.events_created || 0} events created
                </span>
                <button
                  onClick={() => setSelectedCoach(coach)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-12 text-center">
          <FiUser size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Coaches Found</h3>
          <p className="text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'No coaches registered yet'}
          </p>
        </div>
      )}

      {/* Coach Detail Modal */}
      {selectedCoach && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img
                  src={getImageUrl(selectedCoach.profile_photo, selectedCoach.name)}
                  alt={selectedCoach.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedCoach.name}</h2>
                  <p className="text-indigo-400">{selectedCoach.specialization || 'Coach'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCoach(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
              >
                <FiX size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{selectedCoach.connected_athletes || 0}</p>
                  <p className="text-sm text-gray-400">Athletes</p>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{selectedCoach.events_created || 0}</p>
                  <p className="text-sm text-gray-400">Events</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                  <FiMail className="text-gray-400" size={18} />
                  <span className="text-white">{selectedCoach.email}</span>
                </div>
                {selectedCoach.phone && (
                  <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                    <FiPhone className="text-gray-400" size={18} />
                    <span className="text-white">{selectedCoach.phone}</span>
                  </div>
                )}
                {selectedCoach.location && (
                  <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                    <FiMapPin className="text-gray-400" size={18} />
                    <span className="text-white">{selectedCoach.location}</span>
                  </div>
                )}
                {selectedCoach.experience && (
                  <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                    <FiAward className="text-gray-400" size={18} />
                    <span className="text-white">{selectedCoach.experience} years experience</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-700">
              <button
                onClick={() => setSelectedCoach(null)}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coaches;