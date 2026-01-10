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
  const [copiedIndex, setCopiedIndex] = useState(null);
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
  // COPY TO CLIPBOARD
  // ===================================================
  const handleCopy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy text');
    }
  };

  // ===================================================
  // EDIT MESSAGE - Populate input and allow re-send
  // ===================================================
  const handleEdit = (text) => {
    setInput(text);
    // Focus on input field
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
    }, 100);
  };

  // ===================================================
  // RETRY MESSAGE - Resend the exact same message
  // ===================================================
  const handleRetry = (text) => {
    setInput(text);
    // Auto-submit after a brief delay
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  // ===================================================
  // FEEDBACK RATING - Send to backend
  // ===================================================
  const handleRating = async (messageIndex, rating, userMessage, aiResponse) => {
    try {
      // Update local state first for immediate UI feedback
      setMessages(prev => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex].rating = rating;
        }
        return updated;
      });

      // Send to backend
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/ai/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          messageIndex,
          userMessage,
          aiResponse,
          rating,
          agentType: 'deal-hunter'
        })
      });

      console.log(`✅ Feedback saved: ${rating}`);
    } catch (error) {
      console.error('❌ Failed to save feedback:', error);
      // Revert on error
      setMessages(prev => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          delete updated[messageIndex].rating;
        }
        return updated;
      });
    }
  };

  // ===================================================
  // FILE DOWNLOAD HANDLER
  // ===================================================
  const handleFileDownload = (fileData, fileName, mimeType) => {
    try {
      console.log('📥 Starting file download:', fileName);
      
      const fileBytes = atob(fileData);
      const byteArray = new Uint8Array(fileBytes.length);
      
      for (let i = 0; i < fileBytes.length; i++) {
        byteArray[i] = fileBytes.charCodeAt(i);
      }
      
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
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

    const statusMessage = {
      role: 'assistant',
      content: '🔍 Searching the web and analyzing market data...',
      isStatus: true
    };
    setMessages(prev => [...prev, statusMessage]);

    try {
      const token = localStorage.getItem('token');
      
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

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        setMessages(prev => prev.filter(m => !m.isStatus));
        setLoading(false);

        if (data.response) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: data.response,
            userMessage: userMessage.content // Store for feedback
          }]);
        }

        if (data.fileGenerated && data.file) {
          console.log('📄 File received, showing download button...');
          
          const fileMessage = {
            role: 'assistant',
            content: '',
            isFile: true,
            fileData: data.file.data,
            fileName: data.file.name,
            mimeType: data.file.mimeType
          };
          
          setMessages(prev => [...prev, fileMessage]);
        }
        
        return;
      }

      setMessages(prev => prev.filter(m => !m.isStatus));
      setLoading(false);
      setStreaming(true);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '', 
        streaming: true,
        userMessage: userMessage.content
      }]);

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors border border-red-200"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
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
                Deal Hunter — Real-Estate Investor Agent
              </h2>
              <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
                A formal, ROI-heavy real-estate coach for strategy, comparison, and sensitivity analysis. Ask about market trends, investment strategies, or property evaluations to get data-driven insights tailored to your investment goals.
              </p>

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
            <div key={idx}>
              <div
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mr-3 mt-1">
                    <span className="text-white text-sm">🤖</span>
                  </div>
                )}

                <div className="flex-1 max-w-4xl">
                  <div
                    className={`${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl px-5 py-3 text-left ml-auto max-w-3xl'
                        : msg.isStatus
                        ? 'bg-gray-50 text-gray-600 italic border border-gray-200 rounded-2xl px-5 py-3 text-left'
                        : msg.isFile
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl px-6 py-5 text-left shadow-md'
                        : 'bg-white text-gray-900 border border-gray-100 rounded-2xl px-6 py-4 shadow-sm'
                    }`}
                  >
                    {/* FILE DOWNLOAD CARD */}
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
                      <div className="chat-message-content">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-3 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-bold text-gray-900 mt-3 mb-2 first:mt-0" {...props} />,
                            h4: ({node, ...props}) => <h4 className="text-sm font-bold text-gray-900 mt-3 mb-2 first:mt-0" {...props} />,
                            p: ({node, ...props}) => <p className="text-sm leading-relaxed text-gray-800 mb-3 last:mb-0" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-2" {...props} />,
                            li: ({node, ...props}) => <li className="text-sm leading-relaxed text-gray-800 pl-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
                            code: ({node, inline, ...props}) => 
                              inline 
                                ? <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                                : <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-3" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic text-gray-700" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-700 underline" {...props} />,
                            hr: ({node, ...props}) => <hr className="border-gray-300 my-4" {...props} />,
                            table: ({node, ...props}) => (
                              <div className="overflow-x-auto mb-4">
                                <table className="min-w-full border-collapse border border-gray-300" {...props} />
                              </div>
                            ),
                            thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                            tbody: ({node, ...props}) => <tbody {...props} />,
                            tr: ({node, ...props}) => <tr className="border-b border-gray-300" {...props} />,
                            th: ({node, ...props}) => <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold text-gray-900" {...props} />,
                            td: ({node, ...props}) => <td className="border border-gray-300 px-4 py-2 text-sm text-gray-800" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {msg.streaming && (
                          <span className="inline-block w-1 h-4 bg-blue-600 animate-pulse ml-1"></span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ============================================ */}
                  {/* ACTION BUTTONS */}
                  {/* ============================================ */}
                  {!msg.isStatus && !msg.isFile && !msg.streaming && (
                    <div className={`flex items-center gap-1 mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start ml-11'}`}>
                      {/* USER MESSAGE ACTIONS */}
                      {msg.role === 'user' && (
                        <>
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEdit(msg.content)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Retry Button */}
                          <button
                            onClick={() => handleRetry(msg.content)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Retry message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>

                          {/* Copy Button */}
                          <button
                            onClick={() => handleCopy(msg.content, `user-${idx}`)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Copy message"
                          >
                            {copiedIndex === `user-${idx}` ? (
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}

                      {/* ASSISTANT MESSAGE ACTIONS */}
                      {msg.role === 'assistant' && (
                        <>
                          {/* Copy Button */}
                          <button
                            onClick={() => handleCopy(msg.content, `assistant-${idx}`)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Copy response"
                          >
                            {copiedIndex === `assistant-${idx}` ? (
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>

                          {/* Good Response (Thumbs Up) */}
                          <button
                            onClick={() => handleRating(idx, 'GOOD', msg.userMessage, msg.content)}
                            className={`p-2 rounded-lg transition-colors ${
                              msg.rating === 'GOOD'
                                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                : 'text-gray-500 hover:text-green-600 hover:bg-gray-100'
                            }`}
                            title="Good response"
                          >
                            <svg className="w-4 h-4" fill={msg.rating === 'GOOD' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                          </button>

                          {/* Bad Response (Thumbs Down) */}
                          <button
                            onClick={() => handleRating(idx, 'BAD', msg.userMessage, msg.content)}
                            className={`p-2 rounded-lg transition-colors ${
                              msg.rating === 'BAD'
                                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                            }`}
                            title="Bad response"
                          >
                            <svg className="w-4 h-4" fill={msg.rating === 'BAD' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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