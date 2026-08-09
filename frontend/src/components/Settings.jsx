import { useState, useEffect } from 'react';
import { X, User, Key, Sliders, Brain, Zap, Trash2, Check, AlertTriangle, RefreshCw, ShieldCheck, Copy } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';

export default function Settings({
  isOpen,
  onClose,
  userUsage,
  handleTogglePlan,
  onChatHistoryCleared,
  selectedTier,
  setSelectedTier
}) {
  const [activeTab, setActiveTab] = useState('account');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Account tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ type: '', msg: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Recovery codes state
  const [regenPassword, setRegenPassword] = useState('');
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [newRegenCodes, setNewRegenCodes] = useState([]);
  const [regenStatus, setRegenStatus] = useState({ type: '', msg: '' });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenCopied, setIsRegenCopied] = useState(false);
  const [recoveryCodesCount, setRecoveryCodesCount] = useState(user.recoveryCodesCount ?? 0);

  // Preferences tab state
  const [defaultTier, setDefaultTier] = useState(() => {
    return localStorage.getItem('defaultModelTier') || 'standard';
  });

  // Memory tab state
  const [memories, setMemories] = useState([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoryError, setMemoryError] = useState(null);
  const [showClearMemoryConfirm, setShowClearMemoryConfirm] = useState(false);
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState({ type: '', msg: '' });

  // Chat Data tab state
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [isClearingChats, setIsClearingChats] = useState(false);

  // Fetch memories when memory tab is selected or modal opens
  const fetchMemories = async () => {
    const userId = user.id || user._id || 'default';
    setIsLoadingMemories(true);
    setMemoryError(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/memory/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      } else {
        setMemoryError('Failed to fetch memories');
      }
    } catch (err) {
      console.error('Error fetching memories:', err);
      setMemoryError('Could not connect to memory service');
    } finally {
      setIsLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'memory') {
      fetchMemories();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Handle set password for Google users
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', msg: '' });

    if (!newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'Please enter and confirm your new password.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', msg: 'New password must be at least 8 characters long.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/set-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordStatus({ type: 'success', msg: 'Password set successfully! You can now log in with email and password.' });
        setNewPassword('');
        setConfirmPassword('');
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        setPasswordStatus({ type: 'error', msg: data.message || 'Failed to set password.' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', msg: 'Network error. Please try again.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', msg: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'Please fill in all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', msg: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', msg: 'New password must be at least 8 characters long.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordStatus({ type: 'success', msg: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', msg: data.message || 'Failed to change password.' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', msg: 'Network error. Please try again.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle recovery codes regeneration
  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    setRegenStatus({ type: '', msg: '' });
    if (!regenPassword) {
      setRegenStatus({ type: 'error', msg: 'Please enter your current password.' });
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/regenerate-recovery-codes`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: regenPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setNewRegenCodes(data.recoveryCodes || []);
        setRecoveryCodesCount(8);
        setRegenPassword('');
        setShowRegenForm(false);
        setRegenStatus({ type: 'success', msg: 'New recovery codes generated successfully!' });
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        setRegenStatus({ type: 'error', msg: data.message || 'Failed to regenerate recovery codes.' });
      }
    } catch (err) {
      setRegenStatus({ type: 'error', msg: 'Network error. Please try again.' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyRegenCodes = () => {
    if (newRegenCodes.length > 0) {
      navigator.clipboard.writeText(newRegenCodes.join('\n'));
      setIsRegenCopied(true);
      setTimeout(() => setIsRegenCopied(false), 2000);
    }
  };

  // Handle default tier change
  const handleDefaultTierChange = (tier) => {
    setDefaultTier(tier);
    localStorage.setItem('defaultModelTier', tier);
    setSelectedTier(tier);
  };

  // Handle clear memory
  const handleClearMemory = async () => {
    const userId = user.id || user._id || 'default';
    setIsClearingMemory(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/memory/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMemories([]);
        setMemoryStatus({ type: 'success', msg: 'All memories have been cleared.' });
        setShowClearMemoryConfirm(false);
      } else {
        setMemoryStatus({ type: 'error', msg: 'Failed to clear memories.' });
      }
    } catch (err) {
      setMemoryStatus({ type: 'error', msg: 'Error connecting to memory service.' });
    } finally {
      setIsClearingMemory(false);
    }
  };

  // Handle clear chat history
  const handleClearChatHistory = async () => {
    setIsClearingChats(true);
    try {
      const res = await apiFetch(`${API_URL}/api/chat/all`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowClearChatConfirm(false);
        onClose();
        if (onChatHistoryCleared) {
          onChatHistoryCleared();
        }
      } else {
        alert('Failed to clear chat history.');
      }
    } catch (err) {
      console.error('Error clearing chat history:', err);
      alert('Error clearing chat history.');
    } finally {
      setIsClearingChats(false);
    }
  };

  const navItems = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'preferences', label: 'AI Preferences', icon: Sliders },
    { id: 'memory', label: 'Memory Management', icon: Brain },
    { id: 'plan', label: 'Plan & Usage', icon: Zap },
    { id: 'chat_data', label: 'Chat Data', icon: Trash2 },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Settings & Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Sidebar Nav + Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Navigation Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-gray-800 p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0 bg-gray-950/50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-blue-400' : 'text-gray-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            
            {/* 1. ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-200">Account Details</h3>
                  <p className="text-xs text-gray-400">Your profile information</p>
                </div>

                <div className="space-y-3 bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Name</label>
                    <div className="text-sm font-medium text-white px-3 py-2 bg-gray-900 rounded-lg border border-gray-800">
                      {user.name || 'User'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                    <div className="text-sm font-medium text-white px-3 py-2 bg-gray-900 rounded-lg border border-gray-800">
                      {user.email || 'user@example.com'}
                    </div>
                  </div>
                </div>

                {/* Password Management Section */}
                <div className="pt-2">
                  {user.authProvider === 'google' && !user.hasLocalPassword ? (
                    /* Set Password Flow for Google Users */
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
                        <Key size={16} className="text-purple-400" />
                        <span>Set a Password</span>
                      </h4>
                      <p className="text-xs text-gray-400 mb-3">
                        You signed in with Google. Set a password to also log in with your email directly.
                      </p>

                      <form onSubmit={handleSetPassword} className="space-y-3">
                        {passwordStatus.msg && (
                          <div className={`p-3 rounded-lg text-xs font-medium border ${
                            passwordStatus.type === 'success'
                              ? 'bg-green-950/60 border-green-800 text-green-300'
                              : 'bg-red-950/60 border-red-800 text-red-300'
                          }`}>
                            {passwordStatus.msg}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block font-medium">New Password</label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                              placeholder="Min 8 characters"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block font-medium">Confirm Password</label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                              placeholder="Confirm password"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isChangingPassword}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 mt-2"
                        >
                          {isChangingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                          <span>Set Password</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* Change Password Flow for Users with Local Password */
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                        <Key size={16} className="text-purple-400" />
                        <span>Change Password</span>
                      </h4>

                      <form onSubmit={handleChangePassword} className="space-y-3">
                        {passwordStatus.msg && (
                          <div className={`p-3 rounded-lg text-xs font-medium border ${
                            passwordStatus.type === 'success'
                              ? 'bg-green-950/60 border-green-800 text-green-300'
                              : 'bg-red-950/60 border-red-800 text-red-300'
                          }`}>
                            {passwordStatus.msg}
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-gray-400 mb-1 block font-medium">Current Password</label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            placeholder="••••••••"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block font-medium">New Password</label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                              placeholder="Min 8 characters"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block font-medium">Confirm New Password</label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                              placeholder="Confirm new password"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isChangingPassword}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 mt-2"
                        >
                          {isChangingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                          <span>Update Password</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Backup Recovery Codes Section */}
                {(user.authProvider === 'local' || user.hasLocalPassword) && (
                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-400" />
                      <span>Backup Recovery Codes</span>
                    </h4>
                    <p className="text-xs text-gray-400 mb-3">
                      Recovery codes let you access your account if you forget your password and lose access to your email.
                    </p>

                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-gray-300 block">Remaining Codes</span>
                          <span className="text-sm font-bold text-green-400">{recoveryCodesCount} of 8 recovery codes remaining</span>
                        </div>
                        {!showRegenForm && (
                          <button
                            type="button"
                            onClick={() => {
                              setRegenStatus({ type: '', msg: '' });
                              setRegenPassword('');
                              setShowRegenForm(true);
                            }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors cursor-pointer"
                          >
                            Regenerate codes
                          </button>
                        )}
                      </div>

                      {regenStatus.msg && (
                        <div className={`p-2.5 rounded-lg text-xs font-medium border ${
                          regenStatus.type === 'success'
                            ? 'bg-green-950/60 border-green-800 text-green-300'
                            : 'bg-red-950/60 border-red-800 text-red-300'
                        }`}>
                          {regenStatus.msg}
                        </div>
                      )}

                      {showRegenForm && (
                        <form onSubmit={handleRegenerateCodes} className="space-y-3 pt-2 border-t border-gray-800">
                          <p className="text-xs text-amber-300">
                            Regenerating codes will invalidate all previous recovery codes. Enter your password to confirm:
                          </p>
                          <div>
                            <input
                              type="password"
                              value={regenPassword}
                              onChange={(e) => setRegenPassword(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-800 focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                              placeholder="Current password"
                              required
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={isRegenerating}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              {isRegenerating ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                              <span>Confirm & Generate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRegenForm(false)}
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {newRegenCodes.length > 0 && (
                        <div className="pt-3 border-t border-gray-800 space-y-3">
                          <p className="text-xs font-semibold text-amber-300">
                            Save your new 8 recovery codes now. They will not be shown again:
                          </p>
                          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 grid grid-cols-2 gap-2 font-mono text-center text-xs font-semibold text-green-400">
                            {newRegenCodes.map((code, idx) => (
                              <div key={idx} className="bg-gray-900 py-1.5 px-2 rounded border border-gray-800 select-all tracking-wider">
                                {code}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyRegenCodes}
                            className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-xs font-medium text-white rounded-lg border border-gray-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            {isRegenCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            <span>{isRegenCopied ? 'Copied to Clipboard!' : 'Copy All New Codes'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. AI PREFERENCES TAB */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-200">AI Preferences</h3>
                  <p className="text-xs text-gray-400">Configure default settings for your AI Assistant sessions</p>
                </div>

                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Default Model Tier
                    </label>
                    <p className="text-xs text-gray-400 mb-3">
                      This tier will automatically be selected whenever you start a new conversation.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {['lite', 'standard', 'pro'].map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => handleDefaultTierChange(tier)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            defaultTier === tier
                              ? 'bg-blue-600/20 border-blue-500 text-white font-medium shadow-sm'
                              : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="capitalize font-semibold text-sm">
                              {tier}
                            </span>
                            {defaultTier === tier && <Check size={14} className="text-blue-400" />}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {tier === 'lite' && 'Fast & low token usage (4x)'}
                            {tier === 'standard' && 'Balanced performance (8x)'}
                            {tier === 'pro' && 'Maximum intelligence (16x)'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. MEMORY MANAGEMENT TAB */}
            {activeTab === 'memory' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-200">Long-Term Memory</h3>
                    <p className="text-xs text-gray-400">Facts and preferences recalled by AI Assistant</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchMemories}
                    disabled={isLoadingMemories}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                    title="Refresh memories"
                  >
                    <RefreshCw size={14} className={isLoadingMemories ? 'animate-spin' : ''} />
                  </button>
                </div>

                {memoryStatus.msg && (
                  <div className={`p-3 rounded-lg text-xs font-medium border ${
                    memoryStatus.type === 'success'
                      ? 'bg-green-950/60 border-green-800 text-green-300'
                      : 'bg-red-950/60 border-red-800 text-red-300'
                  }`}>
                    {memoryStatus.msg}
                  </div>
                )}

                {/* Stored Memories List */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Stored Memories ({memories.length})
                  </label>

                  {isLoadingMemories ? (
                    <div className="p-4 text-center text-xs text-gray-400 italic">
                      Loading memories...
                    </div>
                  ) : memoryError ? (
                    <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-400">
                      {memoryError}
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-xl text-center text-xs text-gray-400 italic">
                      No memories stored yet. Mention facts like "I am a programmer" in chat for AI to remember.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 bg-gray-900 p-3 rounded-xl border border-gray-800">
                      {memories.map((mem, idx) => (
                        <div key={idx} className="text-xs text-gray-300 bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-800/80 flex items-start gap-2">
                          <Brain size={14} className="text-purple-400 shrink-0 mt-0.5" />
                          <span>{mem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clear Memory Action */}
                <div className="pt-2 border-t border-gray-800">
                  {showClearMemoryConfirm ? (
                    <div className="p-3.5 bg-red-950/40 border border-red-900/80 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-red-300 font-semibold">
                        <AlertTriangle size={16} />
                        <span>Are you sure? This cannot be undone.</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleClearMemory}
                          disabled={isClearingMemory}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          {isClearingMemory ? 'Clearing...' : 'Yes, Clear All Memories'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearMemoryConfirm(false)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearMemoryConfirm(true)}
                      disabled={memories.length === 0}
                      className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-900/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                      <span>Clear All Memory</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. PLAN & USAGE TAB */}
            {activeTab === 'plan' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-200">Plan & Usage</h3>
                  <p className="text-xs text-gray-400">View token usage budget and subscription plan status</p>
                </div>

                <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">Current Subscription</span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold uppercase ${
                      userUsage.plan === 'pro'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}>
                      {userUsage.plan} Plan
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-gray-300">
                      <span>Daily Token Consumption</span>
                      <span className="font-mono">{userUsage.used.toLocaleString()} / {userUsage.budget.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          userUsage.used >= userUsage.budget ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, (userUsage.used / userUsage.budget) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePlan}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer mt-2"
                  >
                    {userUsage.plan === 'pro' ? 'Switch to Free Plan' : '🚀 Upgrade to Pro (Demo)'}
                  </button>
                </div>
              </div>
            )}

            {/* 5. CHAT DATA TAB */}
            {activeTab === 'chat_data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-200">Chat Data Management</h3>
                  <p className="text-xs text-gray-400">Manage saved chat conversations and history</p>
                </div>

                <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-xl space-y-3">
                  <div className="text-xs text-gray-300 leading-relaxed">
                    Clearing your chat history will permanently delete all past conversations and messages stored in MongoDB.
                  </div>

                  {showClearChatConfirm ? (
                    <div className="p-3.5 bg-red-950/40 border border-red-900/80 rounded-xl space-y-2.5 mt-2">
                      <div className="flex items-center gap-2 text-xs text-red-300 font-semibold">
                        <AlertTriangle size={16} />
                        <span>Are you sure you want to delete ALL chat history? This cannot be undone.</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleClearChatHistory}
                          disabled={isClearingChats}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                        >
                          {isClearingChats ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          <span>Yes, Delete All Chats</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearChatConfirm(false)}
                          className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearChatConfirm(true)}
                      className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-900/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      <span>Clear All Chat History</span>
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
