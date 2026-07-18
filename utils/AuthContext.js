import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const handleAuthStateChange = async (newSession) => {
      setSession(newSession);
      if (newSession) {
        try {
          const { data, error } = await supabase
            .from('staff_profiles')
            .select('id, full_name, hospital_id, hospitals ( id, name )')
            .eq('id', newSession.user.id)
            .single();
          if (error) throw error;
          setStaffProfile(data);
        } catch (err) {
          console.error('Error fetching staff profile:', err);
          setStaffProfile(null);
        }
      } else {
        setStaffProfile(null);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      handleAuthStateChange(currentSession);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleAuthStateChange(newSession);
    });

    return () => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  // Removed the redirection logic to make the app completely login-free by default.
  // Users can still access /login if they want to sign in, but they won't be forced to.

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, staffProfile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
