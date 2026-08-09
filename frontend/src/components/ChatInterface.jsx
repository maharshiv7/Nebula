import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Send, Bot, User as UserIcon, MessageSquare, Plus, Image as ImageIcon, FileText, Paperclip, X, Pencil, Zap, PanelLeftClose, PanelLeftOpen, Copy, Check, RefreshCw, Menu, ChevronDown, Settings as SettingsIcon, Lock } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import TransparencyPanel from './TransparencyPanel';
import ReactMarkdown from 'react-markdown';
import Orb from './effects/Orb';
import Settings from './Settings';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';


const GREETINGS = [
  "What's on your mind?",
  "Ready when you are.",
  "What can I help you figure out?",
  "Let's get started.",
  "What are we working on?",
  "Ask me anything."
];

export default function ChatInterface() {
  const { chatId } = useParams();
  const navigate = useNavigate();

  const randomGreeting = useMemo(() => {
    return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  }, [chatId]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(''); // E.g. "thinking..."
  const [chatHistory, setChatHistory] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tier & Usage state (initialized from defaultModelTier if set)
  const [selectedTier, setSelectedTier] = useState(() => {
    return localStorage.getItem('defaultModelTier') || 'standard';
  });
  const [userUsage, setUserUsage] = useState({ used: 0, budget: 1000, plan: 'free' });

  // File upload state
  const [attachedFile, setAttachedFile] = useState(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showTierMenu, setShowTierMenu] = useState(false);

  // Message edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const tierMenuRef = useRef(null);
  const imageInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const skipNextFetchRef = useRef(false); // true right after we create a new chat locally
  const user = JSON.parse(localStorage.getItem('user'));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusMessage]);

  // Close popup menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowPlusMenu(false);
      }
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target)) {
        setShowTierMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch current user details (plan & usage)
  const fetchUserData = async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/auth/me`);
      if (res.ok) {
        const userData = await res.json();
        const maxB = userData.plan === 'pro' ? 5000 : 1000;
        setUserUsage({
          used: userData.dailyTokensUsed || 0,
          budget: maxB,
          plan: userData.plan || 'free'
        });
      }
    } catch (err) {
      console.error('Error fetching user usage:', err);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // Force Lite model tier for Free users
  useEffect(() => {
    if (userUsage.plan === 'free' && selectedTier !== 'lite') {
      setSelectedTier('lite');
    }
  }, [userUsage.plan, selectedTier]);

  // Toggle Pro / Free Plan (Demo)
  const handleTogglePlan = async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/auth/toggle-plan`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        const newPlan = data.user.plan;
        const maxB = newPlan === 'pro' ? 5000 : 1000;
        setUserUsage({
          used: data.user.dailyTokensUsed || 0,
          budget: maxB,
          plan: newPlan
        });
      }
    } catch (err) {
      console.error('Error toggling plan:', err);
    }
  };

  // Fetch sidebar chat history
  const fetchChatHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/chat/history`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
        setHistoryError(null);
      } else {
        setHistoryError('Failed to load chats');
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setHistoryError('Failed to load chats');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, [chatId]);

  // Fetch messages when chatId URL parameter changes
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    // Skip this fetch if we just created this chat ourselves and are already
    // streaming its first response - refetching now would overwrite the live
    // in-progress assistant message with stale (incomplete) DB data.
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/chat/${chatId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();
  }, [chatId, navigate]);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await apiFetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file);
    }
    setShowPlusMenu(false);
    e.target.value = '';
  };

  const formatLocalTime = (isoString) => {
    try {
      const date = isoString ? new Date(isoString) : new Date();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const humanizeErrorMessage = (rawError) => {
    // Log the full raw technical error to console for debugging
    console.error('[SSE Technical Error]:', rawError);

    if (!rawError) {
      return 'Something went wrong. Please try again.';
    }

    const errStr = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
    const lower = errStr.toLowerCase();

    if (
      lower.includes('decommissioned') ||
      lower.includes('deprecated') ||
      lower.includes('model_not_found') ||
      (lower.includes('model') && (lower.includes('not available') || lower.includes('not found') || lower.includes('decommission')))
    ) {
      return 'The selected AI model is currently unavailable. Please try switching tiers.';
    }

    if (
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('etimedout')
    ) {
      return 'This is taking longer than expected, please try again.';
    }

    if (
      lower.includes('500') ||
      lower.includes('502') ||
      lower.includes('503') ||
      lower.includes('504') ||
      lower.includes('internal server error') ||
      lower.includes('server error')
    ) {
      return 'Something went wrong on our end. Please try again.';
    }

    if (
      lower.includes('network') ||
      lower.includes('failed to fetch') ||
      lower.includes('econnrefused') ||
      lower.includes('connection')
    ) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    if (
      lower.includes('400') ||
      lower.includes('403') ||
      lower.includes('401') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('bad request')
    ) {
      return 'Your request could not be processed. Please try again.';
    }

    return 'Something went wrong. Please try again.';
  };

  const handleCopyMessage = (msgId, rawContent) => {
    if (!rawContent) return;
    const textToCopy = rawContent.split('\n\n[Attached file content]:')[0];
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy message:', err);
    });
  };

  const handleRegenerateResponse = async (assistantIdx) => {
    if (isLoading) return;

    let userMsgIndex = -1;
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        userMsgIndex = i;
        break;
      }
    }

    if (userMsgIndex === -1) return;

    const userMsg = messages[userMsgIndex];
    let rawText = userMsg.content || '';
    rawText = rawText.replace(/^\[Attached: [^\]]+\]\n?/, '').split('\n\n[Attached file content]:')[0];

    const truncated = messages.slice(0, userMsgIndex);
    setMessages(truncated);

    await triggerStreamResponse(rawText);
  };

  // Convert model's math notation into properly-formatted $$ blocks that
  // remark-math actually recognizes as display math (opening/closing $$ each
  // MUST be on their own line - remark-math treats $$content$$ on one line
  // as inline math attempt, which fails to parse for complex expressions).
  const preprocessMathContent = (text) => {
    if (!text) return text;

    // Convert legacy "[ ... ]" LaTeX brackets to $$ ... $$
    let processed = text.replace(/\[([^\[\]]*\\[a-zA-Z]+[^\[\]]*)\]/g, (match, inner) => `$$${inner.trim()}$$`);

    // Find every $$...$$ block (whether it was already like that, or just
    // converted above) and reformat it into the required multi-line form:
    //   \n$$\ncontent\n$$\n
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, inner) => {
      const cleanInner = inner.trim();
      return `\n\n$$\n${cleanInner}\n$$\n\n`;
    });

    return processed;
  };

  // Generic stream runner
  const triggerStreamResponse = async (userMessageText, fileToAttach = null) => {
    const tempUserId = Date.now();
    const displayContent = fileToAttach
      ? `[Attached: ${fileToAttach.name}]\n${userMessageText}`
      : userMessageText;

    setMessages(prev => [...prev, { role: 'user', content: displayContent, _id: tempUserId, createdAt: new Date().toISOString() }]);
    setIsLoading(true);
    setStatusMessage('Connecting...');

    try {
      const formData = new FormData();
      formData.append('message', userMessageText || `[Attached File: ${fileToAttach?.name}]`);
      formData.append('tier', selectedTier);
      if (chatId) formData.append('chatId', chatId);
      if (fileToAttach) formData.append('file', fileToAttach);

      const response = await apiFetch(`${API_URL}/api/chat`, {
        method: 'POST',
        body: formData
      });

      // Handle daily budget limit or tier restrictions
      if (response.status === 403) {
        const errorBody = await response.json().catch(() => ({}));
        const limitMsg = errorBody.message || 'Standard and Pro models require a subscription. Upgrade to unlock them.';
        setMessages(prev => [
          ...prev.filter(msg => msg._id !== tempUserId),
          {
            role: 'assistant',
            content: `🔒 **Tier Restricted / Limit Reached**\n${limitMsg}`,
            isUpgradePrompt: true,
            _id: Date.now() + 1,
            createdAt: new Date().toISOString()
          }
        ]);
        setIsLoading(false);
        setStatusMessage('');
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Network response was not ok');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let assistantMsgId = null;
      let currentAssistantText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.type === 'metadata') {
                if (!chatId && data.chatId) {
                  skipNextFetchRef.current = true;
                  navigate(`/chat/${data.chatId}`, { replace: true });
                }
                assistantMsgId = Date.now() + 1;
                setMessages(prev => [
                  ...prev.filter(msg => msg._id !== tempUserId),
                  data.userMessage,
                  { role: 'assistant', content: '', _id: assistantMsgId, createdAt: new Date().toISOString() }
                ]);
                setStatusMessage('');
                fetchChatHistory();
              }
              else if (data.type === 'status') {
                setStatusMessage(data.content);
              }
              else if (data.type === 'token') {
                setStatusMessage('');
                currentAssistantText += data.content;
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, content: currentAssistantText }
                      : msg
                  )
                );
              }
              else if (data.type === 'sources') {
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, sources: data.content }
                      : msg
                  )
                );
              }
              else if (data.type === 'model_info') {
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, model_used: data.content }
                      : msg
                  )
                );
              }
              else if (data.type === 'verification') {
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, verification: data.content }
                      : msg
                  )
                );
              }
              else if (data.type === 'memory_recalled') {
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, memory_recalled: data.content }
                      : msg
                  )
                );
              }
              else if (data.type === 'usage_update') {
                setUserUsage(data.content);
              }
              else if (data.type === 'error') {
                setStatusMessage('');
                const friendlyMsg = humanizeErrorMessage(data.content);
                currentAssistantText += `\n\n⚠️ ${friendlyMsg}`;
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, content: currentAssistantText }
                      : msg
                  )
                );
              }
              else if (data.type === 'done') {
                setStatusMessage('');
              }
            } catch (err) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

    } catch (error) {
      console.error("Failed to send message:", error);
      setStatusMessage('Error communicating with server.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userMessageText = input.trim();
    const currentFile = attachedFile;

    setInput('');
    setAttachedFile(null);
    setShowPlusMenu(false);

    await triggerStreamResponse(userMessageText, currentFile);
  };

  // Save edited user message
  const handleSaveEdit = async (messageId, newContentText) => {
    const trimmed = newContentText.trim();
    if (!trimmed || isLoading) return;

    try {
      const res = await apiFetch(`${API_URL}/api/chat/${chatId}/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: trimmed })
      });

      if (!res.ok) {
        throw new Error('Failed to update message');
      }

      const msgIndex = messages.findIndex(m => m._id === messageId);
      if (msgIndex !== -1) {
        const truncated = messages.slice(0, msgIndex);
        setMessages(truncated);
      }

      setEditingMessageId(null);
      setEditText('');

      await triggerStreamResponse(trimmed);
    } catch (err) {
      console.error("Error saving message edit:", err);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 font-sans">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept=".png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={documentInputRef}
        accept=".pdf,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-16 bg-transparent' : 'w-64 bg-gray-900'} transition-all duration-300 ease-in-out text-white flex flex-col overflow-hidden shrink-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}>
        {/* Sidebar Header with Toggle & Mobile Close Button */}
        <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center px-2 border-b-0' : 'justify-between border-b border-gray-800'}`}>
          {!isSidebarCollapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent truncate">
              AI Assistant
            </h1>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer hidden md:block"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer md:hidden"
              title="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* New Chat Button */}
          {isSidebarCollapsed ? (
            <div className="flex justify-center mb-1">
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  navigate('/');
                }}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="New Chat"
              >
                <Plus size={20} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMobileSidebarOpen(false);
                navigate('/');
              }}
              className="w-full text-left px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer mb-1"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>
          )}

          {/* Usage Meter Card - Hidden when collapsed */}
          {!isSidebarCollapsed && (
            <div className="p-3.5 my-3 bg-gray-800/80 border border-gray-700/80 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <Zap size={13} className="text-yellow-400" /> Token Budget
                </span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                  userUsage.plan === 'pro'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                    : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                }`}>
                  {userUsage.plan}
                </span>
              </div>
              <div className="text-xs font-semibold text-white font-mono">
                {userUsage.used.toLocaleString()} / {userUsage.budget.toLocaleString()} tokens used today
              </div>
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    userUsage.used >= userUsage.budget ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, (userUsage.used / userUsage.budget) * 100)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleTogglePlan}
                className="w-full text-center py-1.5 mt-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                {userUsage.plan === 'pro' ? 'Switch to Free Plan' : '🚀 Upgrade to Pro (Demo)'}
              </button>
            </div>
          )}

          {/* Subtle Horizontal Divider - Hidden when collapsed */}
          {!isSidebarCollapsed && <div className="border-t border-gray-800/60 my-4" />}

          {/* Past Conversations Section */}
          {isSidebarCollapsed ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Past Conversations"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          ) : (
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2.5 px-1">
                Past Conversations
              </div>
              <div className="space-y-1">
                {isLoadingHistory ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-2 py-2 italic">
                    <RefreshCw size={12} className="animate-spin text-blue-400 shrink-0" />
                    <span>Loading chats...</span>
                  </div>
                ) : historyError ? (
                  <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded-lg space-y-2">
                    <div className="text-xs text-red-400 font-medium">{historyError}</div>
                    <button
                      type="button"
                      onClick={fetchChatHistory}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-red-300 hover:text-white bg-red-900/60 hover:bg-red-800 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : chatHistory.length === 0 ? (
                  <div className="text-xs text-gray-500 italic px-2 py-1">No past chats yet</div>
                ) : (
                  chatHistory.map((chat) => (
                    <button
                      key={chat._id}
                      onClick={() => {
                        setIsMobileSidebarOpen(false);
                        navigate(`/chat/${chat._id}`);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm truncate flex items-center gap-2 cursor-pointer ${
                        chatId === chat._id
                          ? 'bg-gray-800 text-white font-medium border-l-2 border-blue-500'
                          : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0" />
                      <span className="truncate">{chat.title || `Chat ${chat._id.slice(-4)}`}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className={`p-3.5 flex ${isSidebarCollapsed ? 'flex-col items-center gap-3 justify-center border-t-0' : 'items-center justify-between border-t border-gray-800'}`}>
          {isSidebarCollapsed ? (
            <>
              <div
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0 cursor-default"
                title={user?.name || 'User Profile'}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                title="Settings"
              >
                <SettingsIcon size={18} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate w-24">{user?.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                  title="Settings"
                >
                  <SettingsIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden min-w-0">
        {/* Mobile Top Header Bar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800/80 bg-gray-900/60 md:hidden relative z-20 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors cursor-pointer"
            title="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI Assistant
          </h1>
          <button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              navigate('/');
            }}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors cursor-pointer"
            title="New Chat"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-6">
          {messages.length === 0 ? (
            <div className="relative h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4 overflow-hidden px-4">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] max-w-[85vw] max-h-[85vw]">
                  <Orb />
                </div>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-200">{randomGreeting}</h2>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={msg._id || idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Timestamp ABOVE message bubble */}
                  <span className="text-[10px] text-gray-400 font-medium mb-1 px-1">
                    {formatLocalTime(msg.createdAt)}
                  </span>

                  <div className={`flex gap-4 max-w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-800/60 flex items-center justify-center shrink-0">
                        <Bot size={18} className="text-purple-400" />
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    {editingMessageId === msg._id ? (
                      /* Inline Edit Input */
                      <div className="w-[480px] max-w-[85vw] bg-gray-900 border border-blue-500/50 rounded-xl p-3 shadow-md">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-gray-100 placeholder-gray-500 bg-transparent focus:outline-none resize-none min-h-[60px]"
                          placeholder="Edit your message..."
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditText('');
                            }}
                            className="px-3 py-1 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg._id, editText)}
                            className="px-3 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Message Bubble */
                      <div className={`group relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl max-w-[90%] sm:max-w-[80%] ${msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                          : 'bg-white/5 backdrop-blur-md border border-white/10 text-gray-100 rounded-bl-sm'
                        }`}>

                        {/* Hover Edit Pencil Icon for User Messages */}
                        {msg.role === 'user' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msg._id);
                              setEditText(msg.content ? msg.content.split('\n\n[Attached file content]:')[0] : '');
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 text-white/80 hover:text-white bg-blue-700/60 hover:bg-blue-700 rounded-full cursor-pointer"
                            title="Edit message"
                          >
                            <Pencil size={12} />
                          </button>
                        )}

                        {/* Hover Actions for Assistant Messages: Regenerate & Copy */}
                        {msg.role === 'assistant' && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex items-center gap-1 z-10">
                            <button
                              type="button"
                              onClick={() => handleRegenerateResponse(idx)}
                              disabled={isLoading}
                              className="p-1 text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-800 rounded-full cursor-pointer disabled:opacity-50"
                              title="Regenerate response"
                            >
                              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg._id || idx, msg.content)}
                              className="p-1 text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-800 rounded-full cursor-pointer"
                              title={copiedMessageId === (msg._id || idx) ? "Copied!" : "Copy message"}
                            >
                              {copiedMessageId === (msg._id || idx) ? (
                                <Check size={12} className="text-green-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        )}

                        {msg.role === 'assistant' && (msg.model_used || msg.memory_recalled) && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {msg.model_used && (
                              <div className="text-[10px] font-mono font-medium text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800 inline-block">
                                ⚡ {msg.model_used}
                              </div>
                            )}
                            {msg.memory_recalled && (
                              <div className="text-[10px] font-medium text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800 inline-flex items-center gap-1">
                                🧠 Memory Recalled ({msg.memory_recalled.length})
                              </div>
                            )}
                          </div>
                        )}

                        <div className="prose prose-sm prose-invert max-w-none leading-relaxed text-sm sm:text-[15px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {preprocessMathContent(msg.content ? msg.content.split('\n\n[Attached file content]:')[0] : '')}
                          </ReactMarkdown>
                        </div>

                        {/* Render inline Upgrade button if restricted or limit reached */}
                        {msg.isUpgradePrompt && userUsage.plan === 'free' && (
                          <button
                            type="button"
                            onClick={handleTogglePlan}
                            className="mt-3 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Zap size={14} className="text-yellow-400" />
                            <span>Upgrade to Pro (Demo)</span>
                          </button>
                        )}

                        {/* Render Transparency Panel & System Pipeline Log */}
                        {msg.role === 'assistant' && (
                          <TransparencyPanel msg={msg} />
                        )}
                      </div>
                    )}

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                        <UserIcon size={18} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Status Indicator */}
              {statusMessage && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-800/60 flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-purple-400" />
                  </div>
                  <div className="px-5 py-2 rounded-2xl bg-white/5 text-gray-300 rounded-bl-sm border border-white/10 backdrop-blur-xl flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-xs italic">{statusMessage}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="relative z-10 p-3 pb-4 sm:p-6 shrink-0">
          <div className="max-w-3xl mx-auto relative">

            {/* Attached File Preview Tag */}
            {attachedFile && (
              <div className="mb-2.5 flex justify-start">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/80 border border-blue-800 text-blue-300 rounded-lg text-xs font-medium shadow-xs">
                  <Paperclip size={14} className="text-blue-400 shrink-0" />
                  <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-blue-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Single Centered Pill-Shaped Container */}
            <form onSubmit={sendMessage} className="relative flex items-center bg-white/5 backdrop-blur-md border border-white/20 rounded-full px-3 sm:px-4 py-2 sm:py-3 shadow-lg gap-2">

              {/* Plus Button & Popup Menu */}
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800/80 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                  title="Attach File"
                >
                  <Plus size={20} className={`transition-transform ${showPlusMenu ? 'rotate-45 text-blue-400' : ''}`} />
                </button>

                {/* Popup Menu ABOVE the button */}
                {showPlusMenu && (
                  <div className="absolute bottom-full left-0 mb-3 bg-gray-900 rounded-xl shadow-xl border border-gray-800 py-1.5 z-30 min-w-[150px] animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ImageIcon size={16} className="text-purple-400" />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileText size={16} className="text-blue-400" />
                      <span>Upload File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Text Input Field */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message AI Assistant..."
                className="flex-1 bg-transparent focus:outline-none text-white placeholder-white/50 text-sm sm:text-[15px] px-2 py-1"
                disabled={isLoading && !messages.length}
              />

              {/* Compact Model Tier Dropdown Selector */}
              <div className="relative shrink-0" ref={tierMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowTierMenu(!showTierMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/80 hover:bg-gray-800/90 text-gray-300 hover:text-white border border-gray-700/60 rounded-full text-xs font-medium transition-colors cursor-pointer"
                  title="Select Model Tier"
                >
                  <span className={`capitalize font-medium ${
                    selectedTier === 'pro' ? 'text-indigo-400' : selectedTier === 'standard' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showTierMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showTierMenu && (
                  <div className="absolute bottom-full right-0 mb-3 bg-gray-900 rounded-xl shadow-xl border border-gray-800 py-1.5 z-30 min-w-[130px] animate-fadeIn">
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800 mb-1">
                      Model Tier
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTier('lite');
                        setShowTierMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-gray-800 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        selectedTier === 'lite' ? 'text-blue-400 font-semibold bg-gray-800/50' : 'text-gray-300'
                      }`}
                    >
                      <span>Lite</span>
                      {selectedTier === 'lite' && <Check size={12} className="text-blue-400" />}
                    </button>
                    <button
                      type="button"
                      disabled={userUsage.plan === 'free'}
                      onClick={() => {
                        if (userUsage.plan === 'free') return;
                        setSelectedTier('standard');
                        setShowTierMenu(false);
                      }}
                      title={userUsage.plan === 'free' ? 'Upgrade to Pro to unlock' : 'Standard Tier'}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between transition-colors ${
                        userUsage.plan === 'free'
                          ? 'opacity-50 cursor-not-allowed text-gray-500'
                          : selectedTier === 'standard' ? 'text-purple-400 font-semibold bg-gray-800/50 cursor-pointer hover:bg-gray-800' : 'text-gray-300 cursor-pointer hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        Standard
                        {userUsage.plan === 'free' && <Lock size={12} className="text-gray-400 shrink-0" />}
                      </span>
                      {selectedTier === 'standard' && <Check size={12} className="text-purple-400" />}
                    </button>
                    <button
                      type="button"
                      disabled={userUsage.plan === 'free'}
                      onClick={() => {
                        if (userUsage.plan === 'free') return;
                        setSelectedTier('pro');
                        setShowTierMenu(false);
                      }}
                      title={userUsage.plan === 'free' ? 'Upgrade to Pro to unlock' : 'Pro Tier'}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between transition-colors ${
                        userUsage.plan === 'free'
                          ? 'opacity-50 cursor-not-allowed text-gray-500'
                          : selectedTier === 'pro' ? 'text-indigo-400 font-semibold bg-gray-800/50 cursor-pointer hover:bg-gray-800' : 'text-gray-300 cursor-pointer hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        Pro
                        {userUsage.plan === 'free' && <Lock size={12} className="text-gray-400 shrink-0" />}
                      </span>
                      {selectedTier === 'pro' && <Check size={12} className="text-indigo-400" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!input.trim() && !attachedFile) || isLoading}
                className="p-2.5 rounded-full bg-blue-600 text-white disabled:bg-gray-800 disabled:text-gray-600 hover:bg-blue-700 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              >
                <Send size={18} />
              </button>
            </form>

            <div className="text-center mt-2 text-xs text-gray-500">
              AI Assistant can analyze images, PDFs, and Word documents.
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userUsage={userUsage}
        handleTogglePlan={handleTogglePlan}
        selectedTier={selectedTier}
        setSelectedTier={setSelectedTier}
        onChatHistoryCleared={() => {
          fetchChatHistory();
          setMessages([]);
          navigate('/');
        }}
      />
    </div>
  );
}