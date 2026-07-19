import React, { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { Camera, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient light */}
        <div className="absolute -top-24 -left-24 w-48 h-48 " />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 " />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <img
            src="/logo.png"
            alt="Medico Kadapa Logo"
            className="w-24 h-24 object-contain mb-4 animate-pulse"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Medico Kadapa Onboard
          </h1>
          <p className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase mt-1">
            Tablet Photo Recorder
          </p>
          <p className="text-slate-500 text-sm mt-3 text-center leading-relaxed">
            Sign in with your hospital staff credentials to upload medicine images.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl flex items-start gap-3 mb-6 relative z-10">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-450" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@hospital.com"
                className="w-full bg-white border border-slate-250 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 transition-all duration-300 font-medium text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-450" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-250 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 transition-all duration-300 font-medium text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-98 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer text-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
