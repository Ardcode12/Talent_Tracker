// admin/src/pages/Athletes.js
import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiDownload, FiUserPlus, FiFilter, FiX, 
  FiCheckCircle, FiMapPin, FiAward, FiTrendingUp,
  FiEye, FiEdit, FiTrash2, FiUser, FiMail, FiPhone
} from 'react-icons/fi';
import { getAthletes, verifyAthlete, deactivateAthlete } from '../services/api-client';

const Athletes = () => {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sport: '',
    location: '',
    minScore: '',
    maxScore: '',
    verifiedOnly: false
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    loadAthletes();
  }, [pagination.page]);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      
      if (searchTerm) params.search = searchTerm;
      if (filters.sport) params.sport = filters.sport;
      if (filters.location) params.location = filters.location;
      if (filters.minScore) params.min_score = parseFloat(filters.minScore);
      if (filters.maxScore) params.max_score = parseFloat(filters.maxScore);
      if (filters.verifiedOnly) params.verified_only = true;
      
      const response = await getAthletes(params);
      
      console.log('Athletes response:', response);
      
      setAthletes(response.data || []);
      if (response.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error loading athletes:', error);
      setAthletes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAthletes();
  };

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowFilters(false);
    loadAthletes();
  };

  const handleClearFilters = () => {
    setFilters({
      sport: '',
      location: '',
      minScore: '',
      maxScore: '',
      verifiedOnly: false
    });
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(loadAthletes, 100);
  };

  const handleVerify = async (athleteId, verified) => {
    try {
      await verifyAthlete(athleteId, verified);
      loadAthletes();
      if (selectedAthlete?.id === athleteId) {
        setSelectedAthlete(prev => ({ ...prev, is_verified: verified }));
      }
    } catch (error) {
      console.error('Error verifying athlete:', error);
      alert('Failed to update verification status');
    }
  };

  const handleDeactivate = async (athleteId) => {
    if (!window.confirm('Are you sure you want to deactivate this athlete?')) return;
    
    try {
      await deactivateAthlete(athleteId);
      loadAthletes();
      setSelectedAthlete(null);
    } catch (error) {
      console.error('Error deactivating athlete:', error);
      alert('Failed to deactivate athlete');
    }
  };

  const getImageUrl = (photo, name) => {
    if (photo && photo.startsWith('http')) {
      return photo;
    }
    if (photo && photo.startsWith('/')) {
      return `http://localhost:8000${photo}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Athlete')}&background=6366f1&color=fff&size=128`;
  };

  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading && athletes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading athletes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Athletes</h1>
          <p className="text-gray-400 mt-1">Manage and view all registered athletes</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{pagination.total}</p>
          <p className="text-gray-400 text-sm">Total Athletes</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-4 border border-gray-700/50">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search athletes by name, email, location..."
              className="w-full bg-gray-900/50 border border-gray-600 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl flex items-center gap-2 transition-all ${
              showFilters || filters.sport || filters.location || filters.minScore || filters.maxScore
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <FiFilter size={18} />
            Filters
          </button>
          
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all"
          >
            Search
          </button>
        </form>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Sport</label>
              <select
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                value={filters.sport}
                onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
              >
                <option value="">All Sports</option>
                <option value="athletics">Athletics</option>
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="cricket">Cricket</option>
                <option value="swimming">Swimming</option>
                <option value="tennis">Tennis</option>
                <option value="badminton">Badminton</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Location</label>
              <input
                type="text"
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="Any location"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Min Score</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="0"
                value={filters.minScore}
                onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Max Score</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="100"
                value={filters.maxScore}
                onChange={(e) => setFilters({ ...filters, maxScore: e.target.value })}
              />
            </div>
            
            <div className="flex items-end gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all"
              >
                Apply
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Athletes Grid */}
      {athletes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {athletes.map((athlete) => (
            <div 
              key={athlete.id}
              className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden hover:border-indigo-500/50 transition-all group"
            >
              <div className="p-5">
                {/* Profile Header */}
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={getImageUrl(athlete.profile_photo, athlete.name)}
                    alt={athlete.name}
                    className="w-14 h-14 rounded-xl object-cover"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(athlete.name || 'A')}&background=6366f1&color=fff`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white truncate">{athlete.name}</h3>
                      {athlete.is_verified && (
                        <FiCheckCircle className="text-blue-400 flex-shrink-0" size={16} />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{athlete.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <p className={`text-xl font-bold ${getScoreColor(athlete.ai_score)}`}>
                      {athlete.ai_score ? `${athlete.ai_score}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">AI Score</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-white">
                      #{athlete.national_rank || '-'}
                    </p>
                    <p className="text-xs text-gray-500">Rank</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  {athlete.sport && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiAward size={14} className="text-indigo-400" />
                      <span className="capitalize">{athlete.sport}</span>
                    </div>
                  )}
                  {athlete.location && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiMapPin size={14} className="text-emerald-400" />
                      <span className="truncate">{athlete.location}</span>
                    </div>
                  )}
                  {athlete.age && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiUser size={14} className="text-yellow-400" />
                      <span>{athlete.age} years old</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 bg-gray-900/30 border-t border-gray-700/50 flex justify-between items-center">
                <button
                  onClick={() => setSelectedAthlete(athlete)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1"
                >
                  <FiEye size={14} />
                  View
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(athlete.id, !athlete.is_verified)}
                    className={`p-1.5 rounded-lg transition-all ${
                      athlete.is_verified 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-gray-700 text-gray-400 hover:text-blue-400'
                    }`}
                    title={athlete.is_verified ? 'Unverify' : 'Verify'}
                  >
                    <FiCheckCircle size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-12 text-center">
          <FiUser size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Athletes Found</h3>
          <p className="text-gray-400">
            {searchTerm || filters.sport || filters.location 
              ? 'Try adjusting your search or filters' 
              : 'No athletes registered yet'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    pagination.page === pageNum
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {pagination.pages > 5 && (
              <>
                <span className="text-gray-500">...</span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: pagination.pages }))}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    pagination.page === pagination.pages
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {pagination.pages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            Next
          </button>
        </div>
      )}

      {/* Athlete Detail Modal */}
      {selectedAthlete && (
        <AthleteDetailModal 
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
          onVerify={handleVerify}
          onDeactivate={handleDeactivate}
          getImageUrl={getImageUrl}
        />
      )}
    </div>
  );
};

// Athlete Detail Modal Component
const AthleteDetailModal = ({ athlete, onClose, onVerify, onDeactivate, getImageUrl }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img
              src={getImageUrl(athlete.profile_photo, athlete.name)}
              alt={athlete.name}
              className="w-16 h-16 rounded-xl object-cover"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(athlete.name || 'A')}&background=6366f1&color=fff`;
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{athlete.name}</h2>
                {athlete.is_verified && (
                  <FiCheckCircle className="text-blue-400" size={18} />
                )}
              </div>
              <p className="text-gray-400">{athlete.sport || 'Athlete'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
          >
            <FiX size={24} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <FiTrendingUp className="mx-auto text-indigo-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">
                {athlete.ai_score ? `${athlete.ai_score}%` : 'N/A'}
              </p>
              <p className="text-xs text-gray-400">AI Score</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <FiAward className="mx-auto text-yellow-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">
                #{athlete.national_rank || '-'}
              </p>
              <p className="text-xs text-gray-400">National Rank</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <FiUser className="mx-auto text-emerald-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">
                {athlete.age || '-'}
              </p>
              <p className="text-xs text-gray-400">Age</p>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                <FiMail className="text-gray-400" size={18} />
                <span className="text-white">{athlete.email}</span>
              </div>
              {athlete.phone && (
                <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                  <FiPhone className="text-gray-400" size={18} />
                  <span className="text-white">{athlete.phone}</span>
                </div>
              )}
              {athlete.location && (
                <div className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-4">
                  <FiMapPin className="text-gray-400" size={18} />
                  <span className="text-white">{athlete.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sport Info */}
          {athlete.sport && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Sport</h3>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <p className="text-white capitalize">{athlete.sport}</p>
              </div>
            </div>
          )}

          {/* Join Date */}
          {athlete.created_at && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Member Since</h3>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <p className="text-white">
                  {new Date(athlete.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={() => onDeactivate(athlete.id)}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <FiTrash2 size={18} />
            Deactivate
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onVerify(athlete.id, !athlete.is_verified)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                athlete.is_verified
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <FiCheckCircle size={18} />
              {athlete.is_verified ? 'Unverify' : 'Verify'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Athletes;