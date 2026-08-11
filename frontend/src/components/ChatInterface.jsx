import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Send, Sparkles, User as UserIcon, MessageSquare, Plus, Image as ImageIcon, FileText, Paperclip, X, Pencil, Zap, PanelLeftClose, PanelLeftOpen, Copy, Check, RefreshCw, Menu, ChevronDown, Settings as SettingsIcon, Lock } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import TransparencyPanel from './TransparencyPanel';
import ReactMarkdown from 'react-markdown';
import Orb from './effects/Orb';
import Settings from './Settings';
import InlineAlert from './InlineAlert';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';


const getGreetingsPool = (name) => [
  `What's on your mind, ${name}?`,
  `Ready when you are, ${name}.`,
  `What can I help you figure out, ${name}?`,
  `Good to see you, ${name} - what are we working on?`,
  `Hey ${name}, what's up?`,
  `What's on the agenda, ${name}?`,
  `Here whenever you need me, ${name}.`,
  `What's the plan, ${name}?`,
  `Ready to dive in, ${name}?`,
  `What's brewing, ${name}?`,
  `Let's talk it through, ${name}.`,
  `${name}, ask me anything.`
];

export default function ChatInterface() {
  const { chatId } = useParams();
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      return null;
    }
  }, []);

  const firstName = useMemo(() => {
    return user?.name ? user.name.trim().split(' ')[0] : 'there';
  }, [user]);

  const randomGreeting = useMemo(() => {
    const pool = getGreetingsPool(firstName);
    return pool[Math.floor(Math.random() * pool.length)];
  }, [chatId, firstName]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [tierAnim, setTierAnim] = useState(false);
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
      setIsMessagesLoading(false);
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
      setIsMessagesLoading(true);
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
      } finally {
        setIsMessagesLoading(false);
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

  const handleSelectTier = (tier) => {
    setSelectedTier(tier);
    setShowTierMenu(false);
    setTierAnim(true);
    setTimeout(() => setTierAnim(false), 300);
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
                setStreamingMessageId(assistantMsgId);
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
                if (assistantMsgId) setStreamingMessageId(assistantMsgId);
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
                setStreamingMessageId(null);
                const friendlyMsg = humanizeErrorMessage(data.content);
                setMessages(prev =>
                  prev.map(msg =>
                    msg._id === assistantMsgId
                      ? { ...msg, content: friendlyMsg, isError: true }
                      : msg
                  )
                );
              }
              else if (data.type === 'done') {
                setStatusMessage('');
                setStreamingMessageId(null);
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
      setStreamingMessageId(null);
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
    <div className="flex h-screen bg-black font-sans">
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
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-16 bg-black/90 border-r border-neutral-800/80' : 'w-64 bg-black/95 border-r border-neutral-800/80'} transition-all duration-300 ease-in-out text-white flex flex-col overflow-hidden shrink-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}>
        {/* Sidebar Header with Toggle & Mobile Close Button */}
        <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center px-2 border-b-0' : 'justify-between border-b border-neutral-800/80'}`}>
          {!isSidebarCollapsed && (
            <h1 className="text-xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-fuchsia-500 bg-clip-text text-transparent truncate drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              Nebula
            </h1>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer hidden md:block"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer md:hidden"
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
                className="p-2.5 text-gray-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-cyan-500/60 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center hover:shadow-[0_0_12px_rgba(6,182,212,0.4)]"
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
              className="w-full text-left px-4 py-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/60 rounded-xl transition-all duration-200 text-sm font-medium flex items-center gap-2 cursor-pointer mb-1 hover:shadow-[0_0_14px_rgba(6,182,212,0.4)]"
            >
              <Plus size={18} className="text-cyan-400" />
              <span>New Chat</span>
            </button>
          )}

          {/* Usage Meter Card - Hidden when collapsed */}
          {!isSidebarCollapsed && (
            <div className="p-3.5 my-3 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-2.5 shadow-inner">
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
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    userUsage.used >= userUsage.budget ? 'bg-red-500' : 'bg-cyan-500'
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
          {!isSidebarCollapsed && <div className="border-t border-neutral-800/80 my-4" />}

          {/* Past Conversations Section */}
          {isSidebarCollapsed ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-purple-500/40 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]"
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
                    <RefreshCw size={12} className="animate-spin text-cyan-400 shrink-0" />
                    <span>Loading chats...</span>
                  </div>
                ) : historyError ? (
                  <InlineAlert
                    severity="error"
                    action={
                      <button
                        type="button"
                        onClick={fetchChatHistory}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-red-300 hover:text-white bg-red-900/60 hover:bg-red-800 px-2 py-1 rounded transition-colors duration-200 cursor-pointer"
                      >
                        <RefreshCw size={11} />
                        <span>Retry</span>
                      </button>
                    }
                  >
                    {historyError}
                  </InlineAlert>
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
                      className={`w-full text-left px-3 py-2 rounded-xl transition-all duration-200 text-sm truncate flex items-center gap-2 cursor-pointer ${
                        chatId === chat._id
                          ? 'bg-neutral-900 text-white font-medium border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                          : 'text-gray-400 hover:bg-neutral-900/80 hover:text-gray-200 hover:shadow-[0_0_12px_rgba(168,85,247,0.35)] hover:border hover:border-purple-500/30'
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate">{chat.title || `Chat ${chat._id.slice(-4)}`}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className={`p-3.5 flex ${isSidebarCollapsed ? 'flex-col items-center gap-3 justify-center border-t-0' : 'items-center justify-between border-t border-neutral-800/80'}`}>
          {isSidebarCollapsed ? (
            <>
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-sm font-bold shrink-0 cursor-default shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                title={user?.name || 'User Profile'}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-950/40 border border-transparent hover:border-purple-500/40 rounded-lg transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                title="Settings"
              >
                <SettingsIcon size={18} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/40 rounded-lg transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 overflow-hidden group/profile cursor-default">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-sm font-bold shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate w-24 text-gray-200">{user?.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-950/40 border border-transparent hover:border-purple-500/40 rounded-lg transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  title="Settings"
                >
                  <SettingsIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/40 rounded-lg transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(244,63,94,0.5)]"
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
      <div className="flex-1 flex flex-col bg-deep-vignette relative overflow-hidden min-w-0">
        {/* Persistent Glowing & Pulsing Neon Background Watermark Logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none">
          <div className="flex flex-row items-center justify-center gap-3 sm:gap-5 animate-neon-pulse transform -translate-y-6">
            <Sparkles className="w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.9)] shrink-0" />
            <span className="font-extrabold tracking-widest uppercase text-white neon-text-glow text-4xl sm:text-6xl md:text-7xl lg:text-8xl whitespace-nowrap">
              NEBULA
            </span>
          </div>
        </div>

        {/* Mobile Top Header Bar */}
        <div className="flex items-center justify-between p-3 border-b border-neutral-800/80 bg-black/80 md:hidden relative z-20 shrink-0 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 text-gray-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-fuchsia-500 bg-clip-text text-transparent">
            NEBULA
          </h1>
          <button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              navigate('/');
            }}
            className="p-2 text-gray-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title="New Chat"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-6">
          {isMessagesLoading ? (
            <div className="space-y-6 max-w-4xl mx-auto p-4 animate-pulse">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-purple-950/50 border border-purple-800/40 shrink-0 flex items-center justify-center">
                  <Sparkles size={18} className="text-purple-400/50" />
                </div>
                <div className="space-y-2.5 flex-1 max-w-[75%] bg-neutral-900/40 border border-white/10 rounded-2xl rounded-bl-sm p-4 backdrop-blur-xs">
                  <div className="h-3.5 bg-white/10 rounded-md w-3/4" />
                  <div className="h-3.5 bg-white/10 rounded-md w-1/2" />
                </div>
              </div>
              <div className="flex gap-4 justify-end items-start">
                <div className="space-y-2.5 flex-1 max-w-[65%] bg-cyan-600/20 border border-cyan-500/20 rounded-2xl rounded-br-sm p-4 backdrop-blur-xs flex flex-col items-end">
                  <div className="h-3.5 bg-white/20 rounded-md w-full" />
                  <div className="h-3.5 bg-white/20 rounded-md w-2/3" />
                </div>
                <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-purple-950/50 border border-purple-800/40 shrink-0 flex items-center justify-center">
                  <Sparkles size={18} className="text-purple-400/50" />
                </div>
                <div className="space-y-2.5 flex-1 max-w-[80%] bg-neutral-900/40 border border-white/10 rounded-2xl rounded-bl-sm p-4 backdrop-blur-xs">
                  <div className="h-3.5 bg-white/10 rounded-md w-5/6" />
                  <div className="h-3.5 bg-white/10 rounded-md w-2/3" />
                  <div className="h-3.5 bg-white/10 rounded-md w-2/5" />
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="relative h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4 overflow-hidden px-4 z-10">
              <div className="relative z-10 flex flex-col items-center max-w-xl space-y-3">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">{randomGreeting}</h2>
                <p className="text-xs sm:text-sm text-gray-400">Type your message below to begin</p>
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
                      <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-800/60 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                        <Sparkles size={18} className="text-purple-400" />
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    {editingMessageId === msg._id ? (
                      /* Inline Edit Input */
                      <div className="w-[480px] max-w-[85vw] bg-black border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl p-3">
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
                            className="px-3 py-1 rounded-md text-xs font-medium text-gray-300 bg-neutral-800 hover:bg-neutral-700 transition-colors duration-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg._id, editText)}
                            className="px-3 py-1 rounded-md text-xs font-medium text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-colors duration-200 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Message Bubble */
                      <div className={`group relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl max-w-[90%] sm:max-w-[80%] ${msg.role === 'user'
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-sm shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                          : 'bg-neutral-900/60 backdrop-blur-xs border border-white/10 text-gray-100 rounded-bl-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                        }`}>

                        {/* Hover Edit Pencil Icon for User Messages */}
                        {msg.role === 'user' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msg._id);
                              setEditText(msg.content ? msg.content.split('\n\n[Attached file content]:')[0] : '');
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 p-1 text-white/80 hover:text-white bg-blue-700/60 hover:bg-blue-700 rounded-full cursor-pointer"
                            title="Edit message"
                          >
                            <Pencil size={12} />
                          </button>
                        )}

                        {/* Hover Actions for Assistant Messages: Regenerate & Copy */}
                        {msg.role === 'assistant' && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 flex items-center gap-1 z-10">
                            <button
                              type="button"
                              onClick={() => handleRegenerateResponse(idx)}
                              disabled={isLoading}
                              className="p-1 text-gray-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-full cursor-pointer disabled:opacity-50 transition-colors duration-200"
                              title="Regenerate response"
                            >
                              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg._id || idx, msg.content)}
                              className="p-1 text-gray-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-full cursor-pointer transition-colors duration-200"
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

                        {msg.isError ? (
                          <InlineAlert severity="error" title="Connection Error">
                            {msg.content}
                          </InlineAlert>
                        ) : msg.isUpgradePrompt ? (
                          <InlineAlert
                            severity="warning"
                            title="Tier Restricted / Limit Reached"
                            action={
                              userUsage.plan === 'free' && (
                                <button
                                  type="button"
                                  onClick={handleTogglePlan}
                                  className="mt-1 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                                >
                                  <Zap size={14} className="text-yellow-400" />
                                  <span>Upgrade to Pro (Demo)</span>
                                </button>
                              )
                            }
                          >
                            {msg.content}
                          </InlineAlert>
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none leading-relaxed text-sm sm:text-[15px]">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {preprocessMathContent(msg.content ? msg.content.split('\n\n[Attached file content]:')[0] : '')}
                            </ReactMarkdown>
                            {msg._id === streamingMessageId && (
                              <span className="inline-block w-0.5 h-4 ml-1 bg-cyan-400 align-middle animate-cursor-blink" aria-hidden="true" />
                            )}
                          </div>
                        )}

                        {/* Render Transparency Panel & System Pipeline Log */}
                        {msg.role === 'assistant' && (
                          <TransparencyPanel msg={msg} />
                        )}
                      </div>
                    )}

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                        <UserIcon size={18} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Status Indicator */}
              {statusMessage && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-800/60 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                    <Sparkles size={18} className="text-purple-400" />
                  </div>
                  <div className="px-5 py-2 rounded-2xl bg-neutral-900/80 text-gray-300 rounded-bl-sm border border-neutral-800 backdrop-blur-md flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/80 border border-cyan-800 text-cyan-300 rounded-lg text-xs font-medium shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                  <Paperclip size={14} className="text-cyan-400 shrink-0" />
                  <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="text-cyan-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Single Centered Pill-Shaped Container with Glowing Neon Treatment */}
            <form onSubmit={sendMessage} className="relative flex items-center bg-black/85 backdrop-blur-md border border-cyan-500/50 hover:border-purple-500/70 focus-within:border-cyan-400 neon-input-pill rounded-full px-3 sm:px-4 py-2 sm:py-3 transition-all duration-300 gap-2">

              {/* Plus Button & Popup Menu */}
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-neutral-800/80 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                  title="Attach File"
                >
                  <Plus size={20} className={`transition-transform ${showPlusMenu ? 'rotate-45 text-cyan-400' : ''}`} />
                </button>

                {/* Popup Menu ABOVE the button */}
                {showPlusMenu && (
                  <div className="absolute bottom-full left-0 mb-3 bg-neutral-950 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-neutral-800 py-1.5 z-30 min-w-[150px] animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2 hover:bg-neutral-800 text-gray-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ImageIcon size={16} className="text-purple-400" />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2 hover:bg-neutral-800 text-gray-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileText size={16} className="text-cyan-400" />
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-gray-300 hover:text-white border border-neutral-700/60 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                    tierAnim ? 'scale-105 ring-2 ring-purple-500/50' : ''
                  }`}
                  title="Select Model Tier"
                >
                  <span className={`capitalize font-medium ${
                    selectedTier === 'pro' ? 'text-indigo-400' : selectedTier === 'standard' ? 'text-purple-400' : 'text-cyan-400'
                  }`}>
                    {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showTierMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showTierMenu && (
                  <div className="absolute bottom-full right-0 mb-3 bg-neutral-950 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-neutral-800 py-1.5 z-30 min-w-[130px] animate-fadeIn">
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-neutral-800 mb-1">
                      Model Tier
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTier('lite')}
                      className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-xs font-medium flex items-center justify-between transition-colors duration-200 cursor-pointer ${
                        selectedTier === 'lite' ? 'text-cyan-400 font-semibold bg-neutral-800/50' : 'text-gray-300'
                      }`}
                    >
                      <span>Lite</span>
                      {selectedTier === 'lite' && <Check size={12} className="text-cyan-400" />}
                    </button>
                    <button
                      type="button"
                      disabled={userUsage.plan === 'free'}
                      onClick={() => {
                        if (userUsage.plan === 'free') return;
                        handleSelectTier('standard');
                      }}
                      title={userUsage.plan === 'free' ? 'Upgrade to Pro to unlock' : 'Standard Tier'}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between transition-colors duration-200 ${
                        userUsage.plan === 'free'
                          ? 'opacity-50 cursor-not-allowed text-gray-500'
                          : selectedTier === 'standard' ? 'text-purple-400 font-semibold bg-neutral-800/50 cursor-pointer hover:bg-neutral-800' : 'text-gray-300 cursor-pointer hover:bg-neutral-800'
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
                        handleSelectTier('pro');
                      }}
                      title={userUsage.plan === 'free' ? 'Upgrade to Pro to unlock' : 'Pro Tier'}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between transition-colors duration-200 ${
                        userUsage.plan === 'free'
                          ? 'opacity-50 cursor-not-allowed text-gray-500'
                          : selectedTier === 'pro' ? 'text-indigo-400 font-semibold bg-neutral-800/50 cursor-pointer hover:bg-neutral-800' : 'text-gray-300 cursor-pointer hover:bg-neutral-800'
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
                className="p-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white disabled:bg-neutral-800 disabled:text-neutral-600 shadow-[0_0_12px_rgba(6,182,212,0.5)] transition-all duration-200 flex items-center justify-center cursor-pointer shrink-0"
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