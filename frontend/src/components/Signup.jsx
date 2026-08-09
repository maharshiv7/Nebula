import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ShieldAlert, Copy, Check, Key } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import Galaxy from './effects/Galaxy';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [isCopied, setIsCopied] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google sign up failed');
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Google sign up failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Signup failed');
      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
        setRecoveryCodes(data.recoveryCodes);
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCodes = () => {
    if (recoveryCodes.length > 0) {
      navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
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
        <div className="max-w-md w-full space-y-6 bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-10 rounded-xl shadow-lg">
          {recoveryCodes.length > 0 ? (
            <div className="space-y-5">
              <div>
                <div className="mx-auto h-12 w-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center">
                  <Key className="h-6 w-6 text-amber-400" />
                </div>
                <h2 className="mt-3 text-center text-xl sm:text-2xl font-extrabold text-white">
                  Save Your Recovery Codes
                </h2>
              </div>

              <div className="p-3.5 bg-amber-950/70 border border-amber-800/80 rounded-lg space-y-2">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200 leading-relaxed font-medium">
                    Save these somewhere safe. You'll need one if you ever forget your password and can't access your email. They won't be shown again.
                  </p>
                </div>
              </div>

              <div className="bg-black/60 border border-white/10 rounded-lg p-3 grid grid-cols-2 gap-2 font-mono text-center text-sm font-semibold text-green-400">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx} className="bg-white/5 py-1.5 px-2 rounded border border-white/5 tracking-wider select-all">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="flex-1 py-2.5 px-3 border border-white/20 text-xs font-semibold rounded-md text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gray-300" />}
                  <span>{isCopied ? 'Copied to Clipboard!' : 'Copy All Codes'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors cursor-pointer"
              >
                I've saved these
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="mx-auto h-12 w-12 bg-green-100/20 border border-green-500/30 rounded-full flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-green-400" />
                </div>
                <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-white">
                  Create your account
                </h2>
              </div>

              {/* Google Sign Up Section */}
              <div className="flex justify-center pt-2">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign up failed')}
                  theme="filled_black"
                  shape="pill"
                  text="signup_with"
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

              <form className="mt-4 space-y-6" onSubmit={handleSignup} autoComplete="off">
                <input type="password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} />
                {error && <div className="text-red-400 text-sm text-center bg-red-950/60 border border-red-900/80 p-2.5 rounded-lg">{error}</div>}
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
                    <input
                      type="text"
                      name="fullname-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 text-sm"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      name="email-nofill"
                      autoComplete="off"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 text-sm"
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
                      className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 text-sm"
                      placeholder="Password (min 8 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                  </button>
                </div>
                <div className="text-center text-sm text-gray-300">
                  Already have an account? <Link to="/login" className="text-green-400 hover:text-green-300 font-semibold">Sign in</Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}