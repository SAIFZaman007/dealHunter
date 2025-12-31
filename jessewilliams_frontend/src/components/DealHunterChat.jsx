import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DealHunterChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId] = useState(uuidv4());
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const conversationStarters = [
    "Starting $5,000. Search Travis County. Build a low-capital flip plan.",
    "Compare Plan A (TX) and Plan B (FL). Recommend optimal solution.",
    "Run advanced analysis with tax and survey insights.",
    "Generate plan and include sensitivity table."
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStarterClick = (starter) => {
    setInput(starter);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Status message
    const statusMessage = {
      role: 'assistant',
      content: '🔍 Searching the web and analyzing market data...',
      isStatus: true
    };
    setMessages(prev => [...prev, statusMessage]);

    try {
      const token = localStorage.getItem('token');
      
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const response = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          agentType: 'deal-hunter'
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Remove status message
      setMessages(prev => prev.filter(m => !m.isStatus));
      setLoading(false);
      setStreaming(true);

      // Add empty assistant message for streaming
      const assistantMessageIndex = messages.length + 1; // +1 for user message
      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedText += parsed.content;
                
                // Update the streaming message
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.streaming) {
                    lastMessage.content = accumulatedText;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      // Finalize the message
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.streaming) {
          delete lastMessage.streaming;
        }
        return newMessages;
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }

      console.error('Error:', error);
      setMessages(prev =>
        prev.filter(m => !m.isStatus).concat({
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.'
        })
      );
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    navigate('/login', { replace: true });
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

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors border border-red-200"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Chat Area - Single Scrollbar */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">📈</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 text-center mb-3">
                Deal Hunter — Real-Estate Investor Agent
              </h2>
              <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
                A formal, ROI-heavy real-estate coach for strategy, comparison, and sensitivity analysis. Ask about market trends, investment strategies, or property evaluations to get data-driven insights tailored to your investment goals.
              </p>

              {/* Conversation Starters */}
              <div className="max-w-3xl mx-auto">
                <p className="text-sm font-medium text-gray-700 mb-3 text-center">Get started with:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {conversationStarters.map((starter, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStarterClick(starter)}
                      className="text-left p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
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
                  <span className="text-white text-sm">🤖</span>
                </div>
              )}

              <div
                className={`max-w-4xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl px-5 py-3 text-left'
                    : msg.isStatus
                    ? 'bg-gray-50 text-gray-600 italic border border-gray-200 rounded-2xl px-5 py-3 text-left'
                    : 'bg-white text-gray-900'
                }`}
              >
                {msg.role === 'user' || msg.isStatus ? (
                  <p className="text-sm leading-relaxed text-left">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none text-left" style={{ textAlign: 'left' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                    {msg.streaming && (
                      <span className="inline-block w-1 h-4 bg-blue-600 animate-pulse ml-1"></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mr-3">
                <span className="text-white text-sm">🤖</span>
              </div>
              <div className="bg-gray-50 rounded-2xl px-5 py-4 border border-gray-200">
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

          <div ref={messagesEndRef} />
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
                disabled={loading || streaming}
              />
              <button
                type="submit"
                disabled={loading || streaming || !input.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
              >
                {loading || streaming ? 'Analyzing...' : 'Send'}
              </button>
            </div>
          </form>

          {/* Footer Caution */}
          <div className="text-center text-xs text-gray-500">
            Deal Hunter can make mistakes. Check important info. •{' '}
            <a href="/terms" className="underline hover:text-gray-700">Terms</a>
            {' • '}
            <a href="/policy" className="underline hover:text-gray-700">Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealHunterChat;