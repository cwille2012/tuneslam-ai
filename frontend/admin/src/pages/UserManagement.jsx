import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';

function UserManagement() {
  const { sessionName } = useParams();
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadParticipants();
  }, [sessionName]);

  const loadParticipants = async () => {
    try {
      const response = await sessionAPI.getParticipants(sessionName);
      setParticipants(response.data.participants);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId) => {
    if (!confirm('Block this user from the session?')) return;
    
    try {
      await sessionAPI.blockUser(sessionName, userId);
      loadParticipants();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block user');
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await sessionAPI.unblockUser(sessionName, userId);
      loadParticipants();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card">
          <h1>User Management</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Session: {sessionName}
          </p>
        </div>

        {error && (
          <div className="card">
            <div className="error-message">{error}</div>
          </div>
        )}

        <div className="card">
          <h2>Participants ({participants.length})</h2>
          
          {participants.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>
              No participants yet
            </p>
          ) : (
            <table style={{ width: '100%', marginTop: '16px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}> Karma</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Songs Added</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => {
                  // Fix: Extract userId properly (might be object or string)
                  const participantId = participant.userId?._id || participant.userId;
                  // Fix: Check if this is the admin's own account (convert both to strings)
                  const isOwnAccount = String(user?._id) === String(participantId);
                  // Fix: Handle songsAdded as array or number
                  const songsCount = Array.isArray(participant.songsAdded) 
                    ? participant.songsAdded.length 
                    : (participant.songsAdded || 0);
                  
                  return (
                    <tr
                      key={participantId}
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        {participant.userId?.username || participant.username}
                        {isOwnAccount && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '12px', 
                            color: 'var(--primary-color)',
                            background: 'rgba(29, 185, 84, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            You
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {participant.userId?.karma || participant.karma || 0}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {songsCount}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {participant.isBlocked ? (
                          <span style={{ color: 'var(--error-color)', fontWeight: '600' }}>
                            🚫 Blocked
                          </span>
                        ) : (
                          <span style={{ color: 'var(--success-color)' }}>
                            ✅ Active
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {isOwnAccount ? (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            (Your Account)
                          </span>
                        ) : participant.isBlocked ? (
                          <button
                            onClick={() => handleUnblockUser(participantId)}
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px' }}
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockUser(participantId)}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px' }}
                          >
                            Block
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
