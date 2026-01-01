/**
 * API Configuration
 * Uses environment variables for backend/AI service URLs
 * Falls back to localhost for development
 * Automatically appends /api prefix if not present
 */

let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

if (!baseUrl.includes('/api')) {
  baseUrl = baseUrl.replace(/\/$/, '') + '/api';
}

const API_BASE_URL = baseUrl;
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export { API_BASE_URL, AI_SERVICE_URL };