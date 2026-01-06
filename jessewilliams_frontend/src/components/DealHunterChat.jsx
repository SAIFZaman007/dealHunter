import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiClient, API_BASE_URL } from '../services/apiClient';

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

  // ===================================================
  // FILE DOWNLOAD HANDLER - DO NOT AUTO-DOWNLOAD
  // ===================================================
  const handleFileDownload = (fileData, fileName, mimeType) => {
    try {
      console.log('📥 Starting file download:', fileName);
      
      // Decode base64 file data
      const fileBytes = atob(fileData);
      const byteArray = new Uint8Array(fileBytes.length);
      
      for (let i = 0; i < fileBytes.length; i++) {
        byteArray[i] = fileBytes.charCodeAt(i);
      }
      
      // Create blob and download
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log('✅ File downloaded successfully');
    } catch (error) {
      console.error('❌ File download error:', error);
      alert('Failed to download file. Please try again.');
    }
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
    
    // Abort controller for cancellation
    abortControllerRef.current = new AbortController();

    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Check Content-Type to determine response type
    const contentType = response.headers.get('content-type');
    
    // ============================================
    // FILE GENERATION RESPONSE (JSON)
    // ============================================
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      // Remove status message
      setMessages(prev => prev.filter(m => !m.isStatus));
      setLoading(false);

      // Add assistant's text response
      if (data.response) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response 
        }]);
      }

      // ============================================
      // SHOW DOWNLOAD LINK (NO AUTO-DOWNLOAD)
      // ============================================
      if (data.fileGenerated && data.file) {
        console.log('📄 File received, showing download button...');
        
        // Add file download message with button
        const fileMessage = {
          role: 'assistant',
          content: '', // Empty content - will render as download card
          isFile: true,
          fileData: data.file.data,
          fileName: data.file.name,
          mimeType: data.file.mimeType
        };
        
        setMessages(prev => [...prev, fileMessage]);
      }
      
      return;
    }

    // ============================================
    // STREAMING TEXT RESPONSE (SSE)
    // ============================================
    // Remove status message
    setMessages(prev => prev.filter(m => !m.isStatus));
    setLoading(false);
    setStreaming(true);

    // Add empty assistant message for streaming
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

    console.error('Error in sendMessage:', error);
    
    let errorMessage = 'I apologize, but I encountered an error. Please try again.';
    
    // Provide more specific error messages
    if (error.message.includes('503')) {
      errorMessage = 'The AI service is temporarily unavailable. Please try again in a few moments.';
    } else if (error.message.includes('504')) {
      errorMessage = 'The request timed out. Please try again with a shorter query.';
    } else if (error.message.includes('needsOnboarding')) {
      errorMessage = 'Please complete your profile setup before chatting.';
      setTimeout(() => navigate('/onboarding'), 2000);
    } else if (error.message.includes('401') || error.message.includes('403')) {
      errorMessage = 'Your session has expired. Please log in again.';
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }, 2000);
    }
    
    setMessages(prev =>
      prev.filter(m => !m.isStatus).concat({
        role: 'assistant',
        content: errorMessage
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
                Real Estate Investment Analyst • GPT-5.2
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
                    : msg.isFile
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl px-6 py-5 text-left shadow-md'
                    : 'bg-white text-gray-900'
                }`}
              >
                {/* ============================================ */}
                {/* FILE DOWNLOAD CARD */}
                {/* ============================================ */}
                {msg.isFile ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white text-3xl">📄</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-gray-900 mb-1">
                        ✅ File Ready for Download
                      </p>
                      <p className="text-xs text-gray-600 mb-3">
                        <span className="font-semibold">{msg.fileName}</span>
                        <span className="text-gray-400 ml-2">
                          ({(atob(msg.fileData).length / 1024).toFixed(1)} KB)
                        </span>
                      </p>
                      <button
                        onClick={() => handleFileDownload(msg.fileData, msg.fileName, msg.mimeType)}
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 text-sm flex items-center space-x-2 shadow-sm hover:shadow-md"
                      >
                        <span>⬇️</span>
                        <span>
                          Download {msg.fileName.includes('xlsx') ? 'Spreadsheet' : msg.fileName.includes('docx') ? 'Document' : msg.fileName.includes('pptx') ? 'Presentation' : 'File'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : msg.role === 'user' || msg.isStatus ? (
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
                id="chat-input" 
                name="message"
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