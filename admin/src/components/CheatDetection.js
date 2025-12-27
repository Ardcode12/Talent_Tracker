import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiEye } from 'react-icons/fi';
import { getAnomalies } from '../services/api-client';

const CheatDetection = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnomalies();
  }, []);

  const loadAnomalies = async () => {
    try {
      const response = await getAnomalies();
      setAnomalies(response.data);
    } catch (error) {
      console.error('Error loading anomalies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center space-x-2 mb-6">
        <FiAlertTriangle className="text-red-500" size={24} />
        <h1 className="text-2xl font-bold">Cheat Detection</h1>
      </div>
      
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">Assessment ID</th>
              <th className="px-6 py-3 text-left">Test Type</th>
              <th className="px-6 py-3 text-left">AI Score</th>
              <th className="px-6 py-3 text-left">Anomaly Score</th>
              <th className="px-6 py-3 text-left">Reasons</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {anomalies.map((anomaly) => (
              <tr key={anomaly.id}>
                <td className="px-6 py-4">{anomaly.id}</td>
                <td className="px-6 py-4">{anomaly.test_type}</td>
                <td className="px-6 py-4">{anomaly.ai_score}%</td>
                <td className="px-6 py-4">{anomaly.anomaly_score}</td>
                <td className="px-6 py-4">
                  <ul className="list-disc list-inside text-sm">
                    {anomaly.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-400 hover:text-blue-300 flex items-center space-x-1">
                    <FiEye size={16} />
                    <span>Review</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CheatDetection;