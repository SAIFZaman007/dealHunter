import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authClient } from './services/apiClient';

import Signup from './components/Signup';
import Login from './components/Login';
import OnboardingForm from './components/OnboardingForm';
import DealHunterChat from './components/DealHunterChat';
import './App.css';

// 🔒 Protected Route - Requires Authentication
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// 🚀 Public Route - Redirects to chat if already logged in with profile
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (token) {
    return <Navigate to="/chat" replace />;
  }

  return children;
};

// Wrapper to handle root div styling based on route
function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname === '/chat';

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      if (isChatRoute) {
        root.style.padding = '0';
        root.style.maxWidth = '100%';
      } else {
        root.style.padding = '2rem';
        root.style.maxWidth = '1280px';
      }
    }
  }, [isChatRoute]);

  return null;
}

function App() {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    hasProfile: null,
    loading: true
  });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const token = localStorage.getItem('token');

      // Not logged in → direct to login
      if (!token) {
        setAuthState({
          isAuthenticated: false,
          hasProfile: null,
          loading: false
        });
        return;
      }

      // Logged in → check if profile exists
      try {
        const response = await authClient.get('/profile/check');

        setAuthState({
          isAuthenticated: true,
          hasProfile: response.data.hasProfile || false,
          loading: false
        });
      } catch (error) {
        console.error('Profile check error:', error);
        // Token might be invalid, clear and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({
          isAuthenticated: false,
          hasProfile: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setAuthState({
        isAuthenticated: false,
        hasProfile: null,
        loading: false
      });
    }
  };

  //Function to refresh profile status after onboarding/login
  const refreshAuthState = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await authClient.get('/profile/check');
      
      setAuthState({
        isAuthenticated: true,
        hasProfile: response.data.hasProfile || false,
        loading: false
      });
    } catch (error) {
      console.error('Failed to refresh auth state:', error);
    }
  };

  const handleSignupComplete = () => {
    // After signup verification, user needs to complete onboarding
    setAuthState({
      isAuthenticated: true,
      hasProfile: false,
      loading: false
    });
  };

  const handleOnboardingComplete = async () => {
    // Refresh the auth state from server after onboarding
    await refreshAuthState();
  };

  const handleLoginComplete = async () => {
    // Refresh auth state after login
    await refreshAuthState();
  };

  // Show loading spinner during app initialization
  if (authState.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full"></div>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent />
      <Routes>
        {/* ===== PUBLIC ROUTES ===== */}

        {/* Root → Redirect based on auth state */}
        <Route 
          path="/" 
          element={
            authState.isAuthenticated
              ? authState.hasProfile
                ? <Navigate to="/chat" replace />
                : <Navigate to="/onboarding" replace />
              : <Navigate to="/login" replace />
          } 
        />

        {/* SIGNUP: New users start here */}
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <Signup onSignupComplete={handleSignupComplete} />
            </PublicRoute>
          } 
        />

        {/* LOGIN: Existing users log in here */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login onLoginComplete={handleLoginComplete} />  
            </PublicRoute>
          } 
        />

        {/* ===== PROTECTED ROUTES ===== */}

        {/* ONBOARDING: After signup verification (step 2 in flow) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              {authState.hasProfile ? (
                // Already completed onboarding → go to chat
                <Navigate to="/chat" replace />
              ) : (
                // Complete profile onboarding
                <OnboardingForm onComplete={handleOnboardingComplete} />
              )}
            </ProtectedRoute>
          }
        />

        {/* CHAT: Main app (step 3-4 in flow) */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              {!authState.hasProfile ? (
                // Profile not completed → redirect to onboarding
                <Navigate to="/onboarding" replace />
              ) : (
                // Ready for chat
                <DealHunterChat />
              )}
            </ProtectedRoute>
          }
        />

        {/* Catch-all fallback */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;