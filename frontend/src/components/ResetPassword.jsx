import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, CheckCircle } from 'lucide-react';
import Galaxy from './effects/Galaxy';
import { apiFetch } from '../utils/api';
import { API_URL } from '../utils/config';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/reset-password/${token}`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password. Token may be invalid or expired.');
      setSuccess(data.message || 'Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
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
        <div className="max-w-md w-full space-y-8 bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-10 rounded-xl shadow-lg">
          <div>
            <div className="mx-auto h-12 w-12 bg-purple-100/20 border border-purple-500/30 rounded-full flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-purple-400" />
            </div>
            <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-white">
              Reset Your Password
            </h2>
            <p className="mt-2 text-center text-xs text-gray-300">
              Enter your new password below.
            </p>
          </div>

          {success ? (
            <div className="p-4 bg-green-950/80 border border-green-800 rounded-lg text-center space-y-3">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto" />
              <p className="text-sm font-medium text-green-200">{success}</p>
              <Link
                to="/login"
                className="inline-block text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="text-red-400 text-sm text-center bg-red-950/60 border border-red-900/80 p-2.5 rounded-lg">
                  {error}
                </div>
              )}
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <input
                    type="password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 text-sm"
                    placeholder="New Password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 border border-white/20 bg-white/5 placeholder-white/50 text-white rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 text-sm"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors cursor-pointer"
                >
                  {isLoading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </div>

              <div className="text-center text-sm text-gray-300">
                Back to <Link to="/login" className="text-purple-400 hover:text-purple-300">Sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
