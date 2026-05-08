import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const api = axios.create({
  baseURL:  API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tuneslam_player_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Session APIs
export const sessionAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}`),
  registerPlayer: (sessionName) => api.post(`/sessions/${sessionName}/register-player`),
  unregisterPlayer: (sessionName) => api.delete(`/sessions/${sessionName}/register-player`)
};

// Queue APIs
export const queueAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}/queue`)
};

// Player APIs
export const playerAPI = {
  getToken: (sessionName) => api.get(`/sessions/${sessionName}/player-token`),
  updatePlaybackState: (sessionName, state) => 
    api.post(`/sessions/${sessionName}/playback-state`, state)
};

export default api;
