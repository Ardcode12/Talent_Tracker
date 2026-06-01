// admin/src/pages/Events.js
import React, { useState, useEffect } from 'react';
import { 
  FiCalendar, FiMapPin, FiUsers, FiCheck, FiX, 
  FiStar, FiEye
} from 'react-icons/fi';
import { getEvents, approveEvent, featureEvent } from '../services/api-client';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await getEvents(params);
      setEvents(response?.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId, approved, reason = null) => {
    try {
      await approveEvent(eventId, approved, reason);
      loadEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Failed to update event status');
    }
  };

  const handleFeature = async (eventId, featured) => {
    try {
      await featureEvent(eventId, featured);
      loadEvents();
    } catch (error) {
      console.error('Error featuring event:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'approved': return 'bg-emerald-500/20 text-emerald-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getImageUrl = (photo, name) => {
    if (photo && photo.startsWith('http')) return photo;
    if (photo && photo.startsWith('/')) return `http://localhost:8000${photo}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Events</h1>
          <p className="text-gray-400 mt-1">Manage and approve event submissions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium transition-all capitalize ${
              filter === status
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div 
              key={event.id}
              className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.approval_status)}`}>
                    {event.approval_status}
                  </span>
                  {event.is_featured && (
                    <FiStar className="text-yellow-400" size={18} />
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{event.title}</h3>
                
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <FiCalendar size={14} />
                    <span>{event.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBD'}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <FiMapPin size={14} />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FiUsers size={14} />
                    <span>{event.current_participants || 0} / {event.max_participants || '∞'}</span>
                  </div>
                </div>

                {event.creator && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-3">
                    <img
                      src={getImageUrl(event.creator.profile_photo, event.creator.name)}
                      alt={event.creator.name}
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(event.creator.name || 'U')}&background=6366f1&color=fff`;
                      }}
                    />
                    <div>
                      <p className="text-sm text-white">{event.creator.name}</p>
                      <p className="text-xs text-gray-500">Organizer</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-gray-900/30 border-t border-gray-700/50 flex justify-between">
                <button
                  onClick={() => setSelectedEvent(event)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1"
                >
                  <FiEye size={14} />
                  View
                </button>
                
                {event.approval_status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(event.id, true)}
                      className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all"
                      title="Approve"
                    >
                      <FiCheck size={16} />
                    </button>
                    <button
                      onClick={() => handleApprove(event.id, false, 'Rejected by admin')}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                      title="Reject"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-12 text-center">
          <FiCalendar size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Events Found</h3>
          <p className="text-gray-400">
            {filter === 'pending' ? 'No pending events to review' : 'No events match your filter'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Events;