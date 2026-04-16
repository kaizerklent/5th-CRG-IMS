'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/AuthContext';
import { signIn, sendPasswordReset } from '@/lib/firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/admin');
  }, [user, authLoading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/admin');
    } catch (err: any) {
      const c = err?.code || '';
      if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found')
        setError('Invalid email or password.');
      else if (c === 'auth/too-many-requests')
        setError('Too many attempts. Please try again later.');
      else setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email above first.'); return; }
    try { await sendPasswordReset(email); setResetSent(true); setError(null); }
    catch { setError('Could not send reset email. Check the address and try again.'); }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-purple-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-700 mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">5CRG</h1>
          <p className="text-purple-300 text-sm mt-1">Inventory Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Admin Login</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {resetSent && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">Password reset email sent. Check your inbox.</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com" required className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required className="input-base"/>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white font-semibold text-sm rounded-lg transition">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
          <div className="mt-5 text-center">
            <button type="button" onClick={handleForgotPassword}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium transition">
              Forgot your password?
            </button>
          </div>
        </div>
        <p className="text-center text-purple-400 text-xs mt-6">Internal use only — 5CRG Admin</p>
      </div>
    </div>
  );
}
