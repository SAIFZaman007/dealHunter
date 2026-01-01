import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../services/apiClient';

const OnboardingForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    propertyType: '',
    strategy: '',
    rentalType: '',
    startingCapital: '',
    targetGeography: '',
    investmentTimeline: '',
    profitGoal: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const response = await authClient.post(
        '/ai/onboarding',
        { profile: formData }
      );
      
      console.log('Onboarding success:', response.data);
      
      if (response.data.success) {
        // Navigate to chat after successful onboarding
        navigate('/chat');
      } else {
        throw new Error('Onboarding failed');
      }
      
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      setError(
        error.response?.data?.error 
        || error.response?.data?.detail 
        || error.message 
        || 'Failed to save profile'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="max-w-2xl mx-auto p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Deal Hunter AI</h1>
          <p className="text-slate-400">
            Let's personalize your investment assistant. Answer a few questions to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question 1 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              1. What type of properties are you seeking?
            </label>
            <select
              value={formData.propertyType}
              onChange={(e) => setFormData({...formData, propertyType: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select...</option>
              <option value="residential">Residential Properties</option>
              <option value="commercial">Commercial Properties</option>
              <option value="land">Land</option>
            </select>
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              2. What's your investment strategy?
            </label>
            <select
              value={formData.strategy}
              onChange={(e) => setFormData({...formData, strategy: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select...</option>
              <option value="fix-and-flip">Fix and Flip</option>
              <option value="rental">Rental Property</option>
            </select>
          </div>

          {/* Question 3 - Conditional */}
          {formData.strategy === 'rental' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                3. What type of rental?
              </label>
              <select
                value={formData.rentalType}
                onChange={(e) => setFormData({...formData, rentalType: e.target.value})}
                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select...</option>
                <option value="short-term">Short Term (Airbnb, VRBO)</option>
                <option value="long-term">Long Term Rental</option>
              </select>
            </div>
          )}

          {/* Additional Fields */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Starting Capital ($)
            </label>
            <input
              type="number"
              value={formData.startingCapital}
              onChange={(e) => setFormData({...formData, startingCapital: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 100000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target Geography
            </label>
            <input
              type="text"
              value={formData.targetGeography}
              onChange={(e) => setFormData({...formData, targetGeography: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Austin, TX"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Investment Timeline
            </label>
            <input
              type="text"
              value={formData.investmentTimeline}
              onChange={(e) => setFormData({...formData, investmentTimeline: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 6-12 months"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Profit Goal ($)
            </label>
            <input
              type="number"
              value={formData.profitGoal}
              onChange={(e) => setFormData({...formData, profitGoal: e.target.value})}
              className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 50000"
              required
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              <strong>Error:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Saving...' : 'Start Investing'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingForm;