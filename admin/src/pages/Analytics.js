import React, { useState, useEffect } from 'react';
import { FiMap, FiActivity, FiUsers } from 'react-icons/fi';
import { getTalentMap, getPerformanceTrends } from '../services/api-client';

const Analytics = () => {
  const [talentMap, setTalentMap] = useState({});
  const [performanceTrends, setPerformanceTrends] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      const [mapData, trendsData] = await Promise.all([
        getTalentMap(),
        getPerformanceTrends(30)
      ]);
      
      setTalentMap(mapData);
      setPerformanceTrends(trendsData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
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
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Talent Distribution Map */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FiMap className="text-blue-400" size={24} />
            <h2 className="text-xl font-bold">Talent Distribution</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">By Region</h3>
              <div className="space-y-2">
                {talentMap.regional_distribution?.map((region, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{region.location}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(region.count / 100) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-400">{region.count} athletes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">By Sport</h3>
              <div className="space-y-2">
                {talentMap.sport_distribution?.map((sport, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{sport.sport}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${(sport.count / 100) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-400">{sport.count} athletes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Trends */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FiActivity className="text-green-400" size={24} />
            <h2 className="text-xl font-bold">Performance Trends</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Average Scores (Last 30 Days)</h3>
              <div className="bg-gray-700 rounded-lg p-4">
                {performanceTrends.trends?.length > 0 ? (
                  <div className="space-y-2">
                    {performanceTrends.trends.slice(0, 7).map((day, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{day.date}</span>
                        <span className="font-bold">{day.avg_score}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No trend data available</p>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Top Improving Athletes</h3>
              <div className="space-y-3">
                {performanceTrends.top_improving?.length > 0 ? (
                  performanceTrends.top_improving.slice(0, 5).map((athlete, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                      <div>
                        <p className="font-medium">{athlete.name}</p>
                        <p className="text-sm text-gray-400">Improvement: +{athlete.improvement}%</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{athlete.current_avg}%</p>
                        <p className="text-xs text-gray-400">Best: {athlete.best_score}%</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No improving athletes data</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;