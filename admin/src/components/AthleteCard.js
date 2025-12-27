import React from 'react';
import { FiUser, FiMapPin, FiAward, FiTrendingUp } from 'react-icons/fi';

const AthleteCard = ({ athlete }) => {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden transition-transform hover:scale-105">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
            <FiUser size={24} className="text-gray-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{athlete.name}</h3>
            <p className="text-gray-400">{athlete.email}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-gray-300">
            <FiMapPin />
            <span>{athlete.location || 'Not specified'}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-gray-300">
            <FiAward />
            <span>{athlete.sport || 'Not specified'}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiTrendingUp className="text-blue-400" />
              <span className="font-bold text-xl">{athlete.ai_score}%</span>
            </div>
            <span className="bg-gray-700 px-2 py-1 rounded text-sm">
              Rank #{athlete.national_rank}
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-700 px-6 py-3 flex justify-end space-x-2">
        <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
          View
        </button>
        <button className="text-gray-400 hover:text-gray-300 text-sm font-medium">
          Edit
        </button>
      </div>
    </div>
  );
};

export default AthleteCard;