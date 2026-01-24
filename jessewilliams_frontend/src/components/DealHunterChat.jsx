import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE_URL } from '../services/apiClient';
import ChatSidebar from './ChatSidebar';

const DealHunterChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
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
    loadUserInfo();
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
  const handleClickOutside = (event) => {
    const headerMenu = document.querySelector('.relative');
    if (headerMenuOpen && headerMenu && !headerMenu.contains(event.target)) {
      setHeaderMenuOpen(false);
    }
  };
  
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [headerMenuOpen]);

  const loadUserInfo = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStarterClick = (starter) => {
    setInput(starter);
  };

  // ===================================================
  // SESSION MANAGEMENT
  // ===================================================
  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setInput('');
  };

  const handleSessionSelect = async (selectedSessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/chat/sessions/${selectedSessionId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setSessionId(selectedSessionId);
        
        // Convert database messages to UI format
        const loadedMessages = data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          userMessage: msg.role === 'assistant' ? data.messages.find(m => 
            m.messageIndex === msg.messageIndex - 1 && m.role === 'user'
          )?.content : undefined,
          hasFile: msg.hasFile,
          fileData: msg.fileData?.data,
          fileName: msg.fileData?.name,
          mimeType: msg.fileData?.mimeType,
          isFile: msg.hasFile
        }));

        setMessages(loadedMessages);
        console.log('✅ Loaded session:', selectedSessionId);
      }
    } catch (error) {
      console.error('âŒ Failed to load session:', error);
      alert('Failed to load chat history');
    }
  };

  // ===================================================
  // SAVE MESSAGE TO DATABASE
  // ===================================================
  const saveMessageToDB = async (message, role, fileData = null) => {
    try {
      const token = localStorage.getItem('token');
      
      if (role === 'user') {
        // Create or continue session
        const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId,
            message,
            agentType: 'deal-hunter'
          })
        });

        const data = await response.json();
        if (data.success && !sessionId) {
          setSessionId(data.session.id);
          return data.session.id;
        }
        return sessionId;
      } else if (role === 'assistant') {
        // Save AI response
        await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            response: message,
            hasFile: !!fileData,
            fileData
          })
        });
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
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
  // EDIT MESSAGE
  // ===================================================
  const handleEdit = (text) => {
    setInput(text);
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
    }, 100);
  };

  // ===================================================
  // RETRY MESSAGE
  // ===================================================
  const handleRetry = (text) => {
    setInput(text);
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  // ===================================================
  // FEEDBACK RATING
  // ===================================================
  const handleRating = async (messageIndex, rating, userMessage, aiResponse) => {
    try {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex].rating = rating;
        }
        return updated;
      });

      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/ai/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: sessionId || uuidv4(),
          messageIndex,
          userMessage,
          aiResponse,
          rating,
          agentType: 'deal-hunter'
        })
      });

      console.log(`✅ Feedback saved: ${rating}`);
    } catch (error) {
      console.error('Failed to save feedback:', error);
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
      console.log('Starting file download:', fileName);
      
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
      console.error('File download error:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  // ===================================================
  // SEND MESSAGE WITH DATABASE PERSISTENCE
  // ===================================================
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message to database
    const currentSessionId = await saveMessageToDB(input, 'user');

    const statusMessage = {
      role: 'assistant',
      content: '🤖 Searching the web and analyzing market data...',
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
          sessionId: currentSessionId,
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

        if (data.response || (data.fileGenerated && data.file)) {
           // Combine text response and file into ONE message
           const combinedMessage = {
           role: 'assistant',
           content: data.response || '',
           userMessage: userMessage.content,
           // Add file data if present
           ...(data.fileGenerated && data.file ? {
           hasFile: true,
           fileData: data.file.data,
           fileName: data.file.name,
           mimeType: data.file.mimeType
         } : {})
      };

      // Save to database
      await saveMessageToDB(
        data.response || '', 
        'assistant',
        data.fileGenerated && data.file ? {
        data: data.file.data,
        name: data.file.name,
        mimeType: data.file.mimeType
        } : null
      );
        setMessages(prev => [...prev, combinedMessage]);
      }
      

        // if (data.fileGenerated && data.file) {
        //   console.log('📄 File received, showing download button...');
          
        //   const fileMessage = {
        //     role: 'assistant',
        //     content: '',
        //     isFile: true,
        //     fileData: data.file.data,
        //     fileName: data.file.name,
        //     mimeType: data.file.mimeType
        //   };

        //   // Save file info to database
        //   await saveMessageToDB('', 'assistant', {
        //     data: data.file.data,
        //     name: data.file.name,
        //     mimeType: data.file.mimeType
        //   });
          
        //   setMessages(prev => [...prev, fileMessage]);
        // }
        
        return;
      }

      // Handle streaming response
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

      // Save complete streaming response to database
      await saveMessageToDB(accumulatedText, 'assistant');

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

  const handlePinCurrentChat = async () => {
  if (!sessionId) {
    alert('No active chat to pin');
    setHeaderMenuOpen(false);
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${API_BASE_URL}/chat/sessions/${sessionId}/pin`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();
    if (data.success) {
      alert(data.isPinned ? 'Chat pinned successfully' : 'Chat unpinned successfully');
    }
  } catch (error) {
    console.error('Failed to pin chat:', error);
    alert('Failed to pin chat');
  }
  setHeaderMenuOpen(false);
};

const handleDeleteCurrentChat = async () => {
  if (!sessionId) {
    alert('No active chat to delete');
    setHeaderMenuOpen(false);
    return;
  }

  if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
    setHeaderMenuOpen(false);
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${API_BASE_URL}/chat/sessions/${sessionId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();
    if (data.success) {
      console.log('✅ Chat deleted successfully');
      handleNewChat();
    } else {
      alert('Failed to delete chat. Please try again.');
    }
  } catch (error) {
    console.error('Failed to delete chat:', error);
    alert('Failed to delete chat. Please try again.');
  }
  setHeaderMenuOpen(false);
};

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentSessionId={sessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        user={user}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-screen">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
  <div className="flex items-center justify-between w-full">
    {/* Left Side: Sidebar Toggle + Subtitle */}
    <div className="flex items-center space-x-3">
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Toggle sidebar"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="4" rx="1" fill="currentColor"/>
          <rect x="3" y="10" width="13" height="4" rx="1" fill="currentColor"/>
          <rect x="3" y="16" width="18" height="4" rx="1" fill="currentColor"/>
        </svg>
      </button>

      {/* Subtitle */}
      <p className="text-sm text-gray-600 font-medium hidden sm:block">
        Real Estate Investment Analyst • GPT-5.2
      </p>
    </div>

    {/* Right Side: 3-Dot Menu */}
    <div className="relative">
      <button
        onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Chat options"
      >
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>

      {headerMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <button
            onClick={handlePinCurrentChat}
            disabled={!sessionId}
            className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 rounded-t-lg transition-colors ${
              !sessionId 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
            </svg>
            <span>{sessionId ? 'Pin Chat' : 'No Active Chat'}</span>
          </button>
          <button
            onClick={handleDeleteCurrentChat}
            disabled={!sessionId}
            className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 rounded-b-lg transition-colors ${
              !sessionId 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-red-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{sessionId ? 'Delete Chat' : 'No Active Chat'}</span>
          </button>
        </div>
      )}
    </div>
  </div>
</header>

        {/* Chat Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl">📊</span>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 text-center mb-3">
                  Deal Hunter — Real-Estate Investor Assistant
                </h2>
                <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
                  A formal, ROI-heavy real-estate coach for strategy, comparison, and sensitivity analysis. Ask about market trends, investment strategies, or property evaluations to get data-driven insights tailored to your investment goals.
                </p>

                <div className="max-w-3xl mx-auto">
                  <p className="text-sm font-medium text-gray-700 mb-3 text-center">Get started with :</p>
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
          <span className="text-white text-sm">✴</span>
        </div>
      )}

      <div className="flex-1 max-w-4xl">
        {/* Main message content */}
        <div
          className={`${
            msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-2xl px-5 py-3 text-left ml-auto max-w-3xl'
              : msg.isStatus
              ? 'bg-gray-50 text-gray-600 italic border border-gray-200 rounded-2xl px-5 py-3 text-left'
              : 'bg-white text-gray-900 border border-gray-100 rounded-2xl px-6 py-4 shadow-sm'
          }`}
        >
          {msg.role === 'user' || msg.isStatus ? (
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

        {/* File download section - INSIDE same message bubble */}
        {msg.hasFile && msg.fileData && (
          <div className="mt-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl px-6 py-5 shadow-md">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl">📄</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-base text-left font-bold text-gray-900 mb-1">
                  ✅ File Ready for Download
                </p>
                <p className="text-xs text-gray-600 mb-3 text-left">
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
          </div>
        )}

        {/* Action Buttons - AFTER everything */}
        {!msg.isStatus && !msg.streaming && (
          <div className={`flex items-center gap-1 mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start ml-11'}`}>
            {msg.role === 'user' && (
              <>
                <button
                  onClick={() => handleEdit(msg.content)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleRetry(msg.content)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Retry message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
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

            {msg.role === 'assistant' && (
              <>
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
            Deal Hunter can make mistakes. Check important info. • {' '}
            <a href="/terms" className="underline hover:text-gray-700">Terms</a>
            {' • '}
            <a href="/policy" className="underline hover:text-gray-700">Policy</a>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DealHunterChat;