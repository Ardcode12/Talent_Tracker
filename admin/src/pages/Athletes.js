import React, { useState, useEffect } from 'react';
import { FiSearch, FiDownload, FiUserPlus } from 'react-icons/fi';
import { getAthletes, exportAthletes } from '../services/api-client';
import AthleteCard from '../components/AthleteCard';

const Athletes = () => {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    sport: '',
    location: '',
    minScore: '',
    maxScore: ''
  });

  useEffect(() => {
    loadAthletes();
  }, [filters]);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      const response = await getAthletes({
        search: searchTerm,
        ...filters,
        page: 1,
        limit: 20
      });
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportAthletes({ ...filters, search: searchTerm });
      alert('Athletes exported successfully');
    } catch (error) {
      console.error('Error exporting athletes:', error);
      alert('Error exporting athletes');
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Athletes</h1>
        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2">
          <FiUserPlus />
          <span>Add Athlete</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search athletes..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="bg-gray-700 rounded-lg px-4 py-2"
            value={filters.sport}
            onChange={(e) => setFilters({...filters, sport: e.target.value})}
          >
            <option value="">All Sports</option>
            <option value="athletics">Athletics</option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
          </select>
          
          <input
            type="text"
            placeholder="Location"
            className="bg-gray-700 rounded-lg px-4 py-2"
            value={filters.location}
            onChange={(e) => setFilters({...filters, location: e.target.value})}
          />
          
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Min Score"
              className="bg-gray-700 rounded-lg px-4 py-2 w-24"
              value={filters.minScore}
              onChange={(e) => setFilters({...filters, minScore: e.target.value})}
            />
            <input
              type="number"
              placeholder="Max Score"
              className="bg-gray-700 rounded-lg px-4 py-2 w-24"
              value={filters.maxScore}
              onChange={(e) => setFilters({...filters, maxScore: e.target.value})}
            />
          </div>
          
          <button
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center space-x-2"
            onClick={handleExport}
          >
            <FiDownload />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Athletes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {athletes.map((athlete) => (
          <AthleteCard key={athlete.id} athlete={athlete} />
        ))}
      </div>
    </div>
  );
};

export default Athletes;