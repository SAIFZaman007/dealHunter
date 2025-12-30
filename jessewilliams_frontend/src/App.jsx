import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import Signup from './components/Signup';
import Login from './components/Login';
import OnboardingForm from './components/OnboardingForm';
import DealHunterChat from './components/DealHunterChat';
import './App.css';

// 🔒 Auth Guard
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [hasProfile, setHasProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkProfileStatus();
  }, []);

  const checkProfileStatus = async () => {
    try {
      const token = localStorage.getItem('token');

      // Not logged in → no need to check profile
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(
        'http://localhost:3000/api/profile/check',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setHasProfile(response.data.hasProfile);
    } catch (error) {
      console.error('Profile check error:', error);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  // ⏳ Initial app boot guard
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              {hasProfile ? (
                <Navigate to="/chat" replace />
              ) : (
                <OnboardingForm onComplete={() => setHasProfile(true)} />
              )}
            </ProtectedRoute>
          }
        />

        {/* Chat Route */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              {!hasProfile ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <DealHunterChat />
              )}
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
