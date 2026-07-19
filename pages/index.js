import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import Layout from '../components/Layout';
import RecordTab from '../components/RecordTab';
import HospitalsTab from '../components/HospitalsTab';
import MedicinesTab from '../components/MedicinesTab';
import { Loader2 } from 'lucide-react';
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
  const [selectedHospital, setSelectedHospital] = useState(null);

  // Global Cached States
  const [hospitals, setHospitals] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Initialize selectedHospital from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('medi_selected_hospital_v3');
    if (saved) {
      try {
        setSelectedHospital(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved hospital:', e);
      }
    }
  }, []);

  // Fetch all databases in parallel on startup to cache them
  useEffect(() => {
    if (!loading) {
      fetchAllData();
    }
  }, [loading]);

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [hospRes, medRes, subRes] = await Promise.all([
        supabase.from('hospitals').select('*').order('name'),
        supabase.from('medicines').select(`
          *,
          tablet_submissions (
            hospital_id,
            hospitals (
              name
            )
          )
        `).order('name'),
        supabase.from('tablet_submissions').select(`
          id,
          hospital_id,
          medicine_id,
          image_url,
          created_at,
          medicines (
            name,
            category
          )
        `).order('created_at', { ascending: false })
      ]);

      if (hospRes.error) throw hospRes.error;

      let dbMedicines = medRes.data;
      if (medRes.error) {
        const fallback = await supabase.from('medicines').select('*').order('name');
        if (fallback.error) throw fallback.error;
        dbMedicines = fallback.data;
      }

      setHospitals(hospRes.data || []);
      setMedicines(dbMedicines || []);
      setSubmissions(subRes.data || []);
    } catch (err) {
      console.error('Error prefetching data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleHospitalChange = (hosp) => {
    setSelectedHospital(hosp);
    if (hosp) {
      localStorage.setItem('medi_selected_hospital_v3', JSON.stringify(hosp));
    } else {
      localStorage.removeItem('medi_selected_hospital_v3');
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center gap-4 ${geistSans.variable} ${geistMono.variable} font-sans`}>
        <img
          src="/logo.png"
          alt="Medico Kadapa Logo"
          className="w-24 h-24 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold tracking-wide uppercase">Initializing Medico Kadapa Onboard...</span>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'record':
        return (
          <RecordTab
            staffProfile={staffProfile}
            selectedHospital={selectedHospital}
            setSelectedHospital={handleHospitalChange}
            hospitals={hospitals}
            medicines={medicines}
            setMedicines={setMedicines}
            submissions={submissions}
            setSubmissions={setSubmissions}
            loadingData={loadingData}
            refreshData={fetchAllData}
          />
        );
      case 'hospitals':
        return (
          <HospitalsTab
            hospitals={hospitals}
            setHospitals={setHospitals}
            submissions={submissions}
            setSubmissions={setSubmissions}
            loadingData={loadingData}
            refreshData={fetchAllData}
            setMedicines={setMedicines}
          />
        );
      case 'medicines':
        return (
          <MedicinesTab
            medicines={medicines}
            setMedicines={setMedicines}
            submissions={submissions}
            setSubmissions={setSubmissions}
            loadingData={loadingData}
            refreshData={fetchAllData}
          />
        );
      default:
        return (
          <RecordTab
            staffProfile={staffProfile}
            selectedHospital={selectedHospital}
            setSelectedHospital={handleHospitalChange}
            hospitals={hospitals}
            medicines={medicines}
            setMedicines={setMedicines}
            submissions={submissions}
            setSubmissions={setSubmissions}
            loadingData={loadingData}
            refreshData={fetchAllData}
          />
        );
    }
  };

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedHospital={selectedHospital}
        onHospitalChange={handleHospitalChange}
      >
        {renderActiveTab()}
      </Layout>
    </div>
  );
}
