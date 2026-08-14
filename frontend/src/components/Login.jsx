import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, KeyRound, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import Galaxy from './effects/Galaxy';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';
import InlineAlert from './InlineAlert';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'forgot'
  const [forgotSubMode, setForgotSubMode] = useState('email'); // 'email' | 'code'
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setMessage('');
    try {
      const res = await apiFetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Google login failed');
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email || !email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send reset email');
      setMessage(data.message || 'If an account exists for this email, a password reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverWithCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email || !email.trim() || !recoveryCode || !recoveryCode.trim() || !newRecoveryPassword || !confirmRecoveryPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newRecoveryPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/recover-with-code`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: recoveryCode,
          newPassword: newRecoveryPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid recovery code');
      setMessage(data.message || 'Password recovered successfully! You can now log in with your new password.');
      setRecoveryCode('');
      setNewRecoveryPassword('');
      setConfirmRecoveryPassword('');
      setForgotSubMode('email');
    } catch (err) {
      setError(err.message || 'Invalid recovery code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <Galaxy
          mouseRepulsion
          mouseInteraction={false}
          density={3}
          glowIntensity={0.4}
          saturation={0.8}
          hueShift={200}
          twinkleIntensity={1}
          rotationSpeed={0.15}
          repulsionStrength={2.5}
          autoCenterRepulsion={0}
          starSpeed={0.3}
          speed={1.3}
        />
      </div>
      <div className="relative z-10 flex items-center justify-center min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-10 rounded-2xl shadow-xl">
          <div>
            <div className="mx-auto h-12 w-12 bg-blue-100/20 border border-blue-500/30 rounded-full flex items-center justify-center">
              <LogIn className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-white">
              {authMode === 'password' && 'Sign in to Nebula'}
              {authMode === 'forgot' && 'Reset Your Password'}
            </h2>
          </div>

          {/* Google Sign-In Section */}
          {authMode === 'password' && (
            <>
              <div className="flex justify-center pt-2">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in failed')}
                  theme="filled_black"
                  shape="pill"
                  text="continue_with"
                />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900/80 px-2 text-gray-400 font-medium rounded">OR</span>
                </div>
              </div>
            </>
          )}

          {error && <InlineAlert severity="error">{error}</InlineAlert>}
          {message && <div className="text-blue-300 text-sm text-center bg-blue-950/60 border border-blue-900/80 p-3 rounded-xl backdrop-blur-md">{message}</div>}

          {/* MODE 1: Standard Password Login */}
          {authMode === 'password' && (
            <form className="mt-4 space-y-4" onSubmit={handlePasswordLogin} autoComplete="off">
              <input type="password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} />
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <input
                    type="email"
                    name="email-nofill"
                    autoComplete="off"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    name="password-nofill"
                    autoComplete="off"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMessage('');
                    setAuthMode('forgot');
                    setForgotSubMode('email');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
                >
                  Forgot password?
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </div>

              <div className="text-center text-sm text-gray-300 pt-2 border-t border-white/10">
                Don't have an account? <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-semibold">Sign up</Link>
              </div>
            </form>
          )}

          {/* MODE 3: Forgot Password & Recovery */}
          {authMode === 'forgot' && (
            <div className="mt-4 space-y-5">
              {/* Google Sign-In Callout */}
              <div className="p-3.5 bg-blue-950/60 border border-blue-800/60 rounded-lg text-center space-y-2">
                <p className="text-xs text-blue-200 font-medium leading-relaxed">
                  Have a Google account with this email? Just sign in with Google instead — no password needed.
                </p>
                <div className="flex justify-center pt-1">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in failed')}
                    theme="filled_black"
                    shape="pill"
                    text="continue_with"
                  />
                </div>
              </div>

              {forgotSubMode === 'email' ? (
                <form onSubmit={handleForgotPassword} className="space-y-4" autoComplete="off">
                  <input type="password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} />
                  <p className="text-xs text-gray-300 text-center">
                    Enter your email address to receive a password reset link.
                  </p>
                  <div>
                    <input
                      type="email"
                      name="email-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none relative block w-full px-3 py-2.5 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Sending Link...' : 'Send Reset Link'}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMessage('');
                        setForgotSubMode('code');
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound size={14} />
                      <span>Use a recovery code instead</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRecoverWithCode} className="space-y-4" autoComplete="off">
                  <input type="password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} />
                  <p className="text-xs text-gray-300 text-center">
                    Enter your email, one unused recovery code, and your new password.
                  </p>
                  <div className="space-y-2">
                    <input
                      type="email"
                      name="email-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-md focus:outline-none focus:ring-purple-500 text-sm"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      type="text"
                      name="code-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-md focus:outline-none focus:ring-purple-500 font-mono text-center tracking-widest text-sm uppercase"
                      placeholder="Recovery Code (e.g. A3F9-K2M7)"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                    />
                    <input
                      type="password"
                      name="password-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-md focus:outline-none focus:ring-purple-500 text-sm"
                      placeholder="New Password (min 8 chars)"
                      value={newRecoveryPassword}
                      onChange={(e) => setNewRecoveryPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      name="confirm-password-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-md focus:outline-none focus:ring-purple-500 text-sm"
                      placeholder="Confirm New Password"
                      value={confirmRecoveryPassword}
                      onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Resetting Password...' : 'Reset Password with Code'}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMessage('');
                        setForgotSubMode('email');
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Mail size={14} />
                      <span>Send email reset link instead</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-2 text-center border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMessage('');
                    setAuthMode('password');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to password login</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
