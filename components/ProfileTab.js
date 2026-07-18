import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { User, Building, LogIn, LogOut, Award, Calendar } from 'lucide-react';
import { useRouter } from 'next/router';

export default function ProfileTab() {
  const { staffProfile, logout } = useAuth();
  const [uploadsCount, setUploadsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUserStats();
  }, [staffProfile]);

  const fetchUserStats = async () => {
    setLoadingStats(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const userId = staffProfile?.id || 'anon';

      if (staffProfile) {
        // Query tablet submissions for this logged in user created today
        const { count, error } = await supabase
          .from('tablet_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', userId)
          .gte('created_at', today.toISOString());

        if (!error && count !== null) {
          setUploadsCount(count);
          return;
        }
      }
      
      // Fallback: If anonymous or table query failed, read from localStorage
      const localUploaded = localStorage.getItem(`uploads_today_${userId}`);
      if (localUploaded) {
        setUploadsCount(parseInt(localUploaded, 10));
      } else {
        setUploadsCount(0);
      }
    } catch (err) {
      console.warn('Could not load upload stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const handleSignInRedirect = () => {
    router.push('/login');
  };

  const isGuest = !staffProfile;

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" />
          {isGuest ? 'Collector Profile' : 'My Profile'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Account & session information</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden shadow-xs">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl border border-emerald-100 shadow-xs">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {isGuest ? 'Anonymous Agent' : staffProfile.full_name}
            </h3>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
              {isGuest ? 'Guest Collector' : 'Hospital Staff'}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3.5">
          <div className="flex items-center gap-3">
            <Building className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-black">Assigned Hospital</span>
              <span className="text-sm font-bold text-slate-750 block truncate">
                {isGuest ? 'Select on Record tab' : (staffProfile.hospitals?.name || 'Not assigned')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-black">Session Active Since</span>
              <span className="text-sm font-bold text-slate-750 block">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-black">Tablet Photos Today</span>
          <span className="text-2xl font-black text-slate-900">{uploadsCount} uploads</span>
          <p className="text-[10px] text-slate-500 mt-1">Goal: complete the catalog!</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3.5 rounded-2xl shadow-xs">
          <Award className="w-8 h-8" />
        </div>
      </div>

      {/* Bottom login/logout button */}
      {isGuest ? (
        <button
          onClick={handleSignInRedirect}
          className="w-full bg-emerald-555 hover:bg-emerald-650 text-white font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 shadow-md shadow-emerald-500/10 cursor-pointer text-sm"
        >
          <LogIn className="w-5 h-5" />
          Sign In as Staff Profile
        </button>
      ) : (
        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 text-sm shadow-xs cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      )}

    </div>
  );
}
