import React, { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import Layout from '../components/Layout';
import RecordTab from '../components/RecordTab';
import HospitalsTab from '../components/HospitalsTab';
import MedicinesTab from '../components/MedicinesTab';
import { Loader2, Camera } from 'lucide-react';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function Home() {
  const { staffProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('record');

  // Loading Screen
  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center gap-4 ${geistSans.variable} ${geistMono.variable} font-sans`}>
        <img 
          src="/logo.jpeg" 
          alt="Medico Kadapa Logo" 
          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-md animate-pulse"
        />
        <div className="flex items-center gap-2 text-slate-550">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold tracking-wide uppercase">Initializing Medico Kadapa Onboard...</span>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'record':
        return <RecordTab staffProfile={staffProfile} />;
      case 'hospitals':
        return <HospitalsTab />;
      case 'medicines':
        return <MedicinesTab />;
      default:
        return <RecordTab staffProfile={staffProfile} />;
    }
  };

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderActiveTab()}
      </Layout>
    </div>
  );
}
