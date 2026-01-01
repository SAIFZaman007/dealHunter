/**
 * API Configuration
 * Uses environment variables for backend/AI service URLs
 * Falls back to localhost for development
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export { API_BASE_URL, AI_SERVICE_URL };