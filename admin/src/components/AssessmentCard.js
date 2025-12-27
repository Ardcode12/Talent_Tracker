import React from 'react';
import { FiVideo, FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const AssessmentCard = ({ assessment, onView }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500';
      case 'verified': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'verified': return <FiCheckCircle />;
      case 'rejected': return <FiAlertCircle />;
      default: return <FiClock />;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">{assessment.test_type}</h3>
            <p className="text-gray-400">Athlete ID: {assessment.user_id}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-white text-sm ${getStatusColor(assessment.status)}`}>
              {getStatusIcon(assessment.status)}
              <span className="ml-1">{assessment.status}</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FiVideo />
              <span className="font-bold text-xl">{assessment.ai_score}%</span>
            </div>
            <p className="text-gray-400">
              {new Date(assessment.created_at).toLocaleString()}
            </p>
          </div>
          
          <button
            className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
            onClick={() => onView(assessment)}
          >
            <span>Review</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentCard;