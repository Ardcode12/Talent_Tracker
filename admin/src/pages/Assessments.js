import React, { useState, useEffect } from 'react';
import { FiFilter, FiCheck, FiX, FiEye } from 'react-icons/fi';
import { getAssessments, verifyAssessment } from '../services/api-client';
import AssessmentCard from '../components/AssessmentCard';

const Assessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    testType: '',
    status: '',
    page: 1,
    limit: 20
  });
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  useEffect(() => {
    loadAssessments();
  }, [filters]);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const response = await getAssessments(filters);
      setAssessments(response.data);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id, verified, feedback) => {
    try {
      await verifyAssessment(id, verified, feedback);
      // Refresh assessments
      loadAssessments();
      setSelectedAssessment(null);
    } catch (error) {
      console.error('Error verifying assessment:', error);
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
        <h1 className="text-2xl font-bold">Assessment Review</h1>
        <div className="flex space-x-2">
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
            value={filters.testType}
            onChange={(e) => setFilters({...filters, testType: e.target.value})}
          >
            <option value="">All Test Types</option>
            <option value="shuttle_run">Shuttle Run</option>
            <option value="vertical_jump">Vertical Jump</option>
            <option value="squats">Squats</option>
            <option value="height_detection">Height Detection</option>
          </select>
          
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Assessments List */}
      <div className="space-y-4">
        {assessments.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            onView={(assessment) => setSelectedAssessment(assessment)}
          />
        ))}
      </div>

      {/* Review Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold">Review Assessment</h2>
              <p className="text-gray-400">{selectedAssessment.test_type}</p>
            </div>
            
            <div className="p-6">
              {/* Video Player */}
              <div className="bg-black rounded-lg aspect-video mb-6 flex items-center justify-center">
                <video
                  src={selectedAssessment.video_url}
                  controls
                  className="max-w-full max-h-[60vh]"
                />
              </div>
              
              {/* AI Feedback */}
              <div className="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-2">AI Analysis</h3>
                <p className="text-gray-300">{selectedAssessment.ai_feedback}</p>
              </div>
              
              {/* Verification Form */}
              <div className="flex space-x-4">
                <button
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center space-x-2"
                  onClick={() => handleVerify(
                    selectedAssessment.id, 
                    true, 
                    "Assessment verified by admin"
                  )}
                >
                  <FiCheck />
                  <span>Verify</span>
                </button>
                
                <button
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center space-x-2"
                  onClick={() => handleVerify(
                    selectedAssessment.id, 
                    false, 
                    "Assessment rejected by admin"
                  )}
                >
                  <FiX />
                  <span>Reject</span>
                </button>
                
                <button
                  className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg"
                  onClick={() => setSelectedAssessment(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessments;