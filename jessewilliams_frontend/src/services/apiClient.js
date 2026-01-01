// src/services/apiClient.js
import axios from 'axios';
import { API_BASE_URL, AI_SERVICE_URL } from '../config/api';

// Create auth API client
const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create AI API client
const aiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
[authClient, aiClient].forEach(client => {
  client.interceptors.request.use(
    config => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    error => Promise.reject(error)
  );
});

export { authClient, aiClient, API_BASE_URL, AI_SERVICE_URL };