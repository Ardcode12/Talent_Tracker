// admin/src/components/AssessmentCard.js
import React from 'react';
import { FiEye, FiCheck, FiX, FiClock } from 'react-icons/fi';

const AssessmentCard = ({ assessment, onView }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500/20 text-emerald-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatTestType = (type) => {
    if (!type) return 'Unknown';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getImageUrl = (photo, name) => {
    if (photo && photo.startsWith('http')) return photo;
    if (photo && photo.startsWith('/')) return `http://localhost:8000${photo}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'A')}&background=6366f1&color=fff`;
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-all">
      <div className="flex items-center gap-4">
        {/* Athlete Photo */}
        <img
          src={getImageUrl(assessment.athlete_photo, assessment.athlete_name)}
          alt={assessment.athlete_name}
          className="w-12 h-12 rounded-xl object-cover"
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(assessment.athlete_name || 'A')}&background=6366f1&color=fff`;
          }}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate">{assessment.athlete_name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(assessment.status)}`}>
              {assessment.status}
            </span>
          </div>
          <p className="text-sm text-gray-400">{formatTestType(assessment.test_type)}</p>
        </div>

        {/* Score */}
        <div className="text-right">
          <p className={`text-2xl font-bold ${getScoreColor(assessment.ai_score)}`}>
            {assessment.ai_score ? `${assessment.ai_score}%` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(assessment.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <button
          onClick={() => onView(assessment)}
          className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-all"
        >
          <FiEye size={18} />
        </button>
      </div>

      {/* AI Feedback Preview */}
      {assessment.ai_feedback && (
        <div className="mt-3 p-3 bg-gray-900/50 rounded-lg">
          <p className="text-xs text-gray-400 line-clamp-2">{assessment.ai_feedback}</p>
        </div>
      )}
    </div>
  );
};

export default AssessmentCard;