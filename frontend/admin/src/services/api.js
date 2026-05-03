import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tuneslam_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tuneslam_admin_token');
      localStorage.removeItem('tuneslam_admin_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register/admin', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/admin/profile', data),
  changePassword: (data) => api.put('/auth/password', data)
};

// Session APIs
export const sessionAPI = {
  getMySessions: () => api.get('/sessions/my-sessions'),
  create: (data) => api.post('/sessions', data),
  get: (sessionName) => api.get(`/sessions/${sessionName}`),
  update: (sessionName, data) => api.put(`/sessions/${sessionName}`, data),
  toggle: (sessionName) => api.post(`/sessions/${sessionName}/toggle`),
  delete: (sessionName) => api.delete(`/sessions/${sessionName}`),
  reset: (sessionName) => api.post(`/sessions/${sessionName}/reset`),
  getParticipants: (sessionName) => api.get(`/sessions/${sessionName}/participants`),
  blockUser: (sessionName, userId) => api.post(`/sessions/${sessionName}/participants/${userId}/block`),
  unblockUser: (sessionName, userId) => api.post(`/sessions/${sessionName}/participants/${userId}/unblock`),
  addToBlacklist: (sessionName, trackId) => api.post(`/sessions/${sessionName}/blacklist`, { trackId }),
  removeFromBlacklist: (sessionName, trackId) => api.delete(`/sessions/${sessionName}/blacklist/${trackId}`)
};

// Queue APIs
export const queueAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}/queue`),
  addSong: (sessionName, trackData, options = {}) => api.post(`/sessions/${sessionName}/queue`, { trackData, ...options }),
  removeSong: (sessionName, songId) => api.delete(`/sessions/${sessionName}/queue/${songId}`),
  vote: (sessionName, songId, voteType) => api.post(`/sessions/${sessionName}/queue/${songId}/vote`, { voteType }),
  getHistory: (sessionName) => api.get(`/sessions/${sessionName}/history`)
};

// Spotify APIs
export const spotifyAPI = {
  getAuthUrl: (sessionName) => api.get(`/spotify/auth?sessionName=${sessionName}`),
  search: (sessionName, query, limit = 20) => api.get(`/spotify/search/${sessionName}?query=${query}&limit=${limit}`),
  getPlaylists: (sessionName) => api.get(`/spotify/playlists/${sessionName}`),
  getGenres: (sessionName) => api.get(`/spotify/genres/${sessionName}`)
};

// User APIs
export const userAPI = {
  getStats: () => api.get('/users/me/stats'),
  getProfile: (userId) => api.get(`/users/${userId}`)
};

export default api;
