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
  const token = localStorage.getItem('token');
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data)
};

// Session APIs
export const sessionAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}`)
};

// Queue APIs
export const queueAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}/queue`),
  addSong: (sessionName, trackData) => api.post(`/sessions/${sessionName}/queue`, { trackData }),
  vote: (sessionName, songId, voteType) => api.post(`/sessions/${sessionName}/queue/${songId}/vote`, { voteType }),
  getUserVote: (sessionName, songId) => api.get(`/sessions/${sessionName}/queue/${songId}/vote`)
};

// Spotify APIs
export const spotifyAPI = {
  search: (sessionName, query, limit = 20) => api.get(`/spotify/search/${sessionName}?query=${query}&limit=${limit}`)
};

// User APIs
export const userAPI = {
  getStats: () => api.get('/users/me/stats')
};

export default api;
