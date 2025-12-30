import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DealHunterChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(uuidv4());
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // ✅ STATUS MESSAGE
    const statusMessage = {
      role: 'assistant',
      content: '🔍 Searching the web and analyzing market data...',
      isStatus: true
    };
    setMessages(prev => [...prev, statusMessage]);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/ai/chat',
        { message: userMessage.content, sessionId, agentType: 'deal-hunter' },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 90000
        }
      );

      // ✅ Remove status message, append real response
      setMessages(prev =>
        prev.filter(m => !m.isStatus).concat({
          role: 'assistant',
          content: response.data.response
        })
      );
    } catch (error) {
      console.error('Error:', error);

      setMessages(prev =>
        prev.filter(m => !m.isStatus).concat({
          role: 'assistant',
          content:
            'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.'
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Deal Hunter</h1>
              <p className="text-sm text-gray-500">
                Real Estate Investment Analyst • GPT-4
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">📈</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 text-center mb-3">
                Deal Hunter – Real-Estate Investor Agent
              </h2>
              <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
                A formal, ROI-heavy real-estate coach for strategy, comparison, and sensitivity analysis. Ask about market trends, investment strategies, or property evaluations to get data-driven insights tailored to your investment goals.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mr-3 mt-1">
                  <span className="text-white text-sm">🏠</span>
                </div>
              )}

              <div
                className={`max-w-4xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl px-5 py-3'
                    : msg.isStatus
                    ? 'bg-gray-50 text-gray-600 italic border border-gray-200 rounded-2xl px-5 py-3'
                    : 'bg-white text-gray-900'
                }`}
              >
                {msg.role === 'user' || msg.isStatus ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* EXISTING loading UI — untouched */}
          {loading && (
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mr-3">
                <span className="text-white text-sm">🏠</span>
              </div>
              <div className="bg-gray-50 rounded-2xl px-5 py-4 border border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <span>🔍</span>
                  <span>
                    Analyzing market data and preparing investment analysis...
                  </span>
                </div>
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={sendMessage} className="mb-3">
            <div className="flex space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your investment criteria or ask for market analysis..."
                className="flex-1 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
              >
                {loading ? 'Analyzing...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DealHunterChat;