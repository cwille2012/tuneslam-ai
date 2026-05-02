import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Session APIs
export const sessionAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}`)
};

// Queue APIs
export const queueAPI = {
  get: (sessionName) => api.get(`/sessions/${sessionName}/queue`)
};

export default api;
