import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import Layout from '../components/Layout';
import RecordTab from '../components/RecordTab';
import HospitalsTab from '../components/HospitalsTab';
import MedicinesTab from '../components/MedicinesTab';
import { Loader2 } from 'lucide-react';
import { Geist, Geist_Mono } from 'next/font/google';
import { applyHospitalChange } from '../utils/hospitalDirectory.mjs';

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

  useEffect(() => {
    if (loading) return undefined;

    const channel = supabase
      .channel('hospital-directory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospitals' },
        (change) => {
          setHospitals((current) => applyHospitalChange(current, change));

          if (change.eventType === 'UPDATE') {
            const savedHospital = localStorage.getItem(
              'medi_selected_hospital_v3',
            );
            if (savedHospital) {
              try {
                if (JSON.parse(savedHospital)?.id === change.new?.id) {
                  localStorage.setItem(
                    'medi_selected_hospital_v3',
                    JSON.stringify(change.new),
                  );
                }
              } catch (error) {
                console.error('Error updating saved hospital:', error);
              }
            }
            setSelectedHospital((current) => {
              if (current?.id !== change.new?.id) return current;
              return change.new;
            });
          }

          if (change.eventType === 'DELETE') {
            const savedHospital = localStorage.getItem(
              'medi_selected_hospital_v3',
            );
            if (savedHospital) {
              try {
                if (JSON.parse(savedHospital)?.id === change.old?.id) {
                  localStorage.removeItem('medi_selected_hospital_v3');
                }
              } catch (error) {
                console.error('Error removing saved hospital:', error);
              }
            }
            setSelectedHospital((current) => {
              if (current?.id !== change.old?.id) return current;
              return null;
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loading]);

  // Supabase/PostgREST caps any single response at the project's max-rows
  // setting (1000 by default) no matter what .limit() the client requests —
  // so tables larger than that silently lose everything past row 1000
  // (e.g. medicines starting with "T" onward once the catalog passed 1000
  // rows) unless fetched in successive .range() pages like this.
  const fetchAllRows = async (buildQuery) => {
    const PAGE_SIZE = 1000;
    let rows = [];
    let from = 0;
    for (;;) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows = rows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  };

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [hospData, dbMedicines, subData] = await Promise.all([
        fetchAllRows(() => supabase.from('hospitals').select('*').order('name')),
        (async () => {
          try {
            return await fetchAllRows(() => supabase.from('medicines').select(`
              *,
              tablet_submissions (
                hospital_id,
                hospitals (
                  name
                )
              )
            `).order('name'));
          } catch (medErr) {
            console.warn('Joined medicines query failed, falling back to plain select:', medErr);
            return await fetchAllRows(() => supabase.from('medicines').select('*').order('name'));
          }
        })(),
        fetchAllRows(() => supabase.from('tablet_submissions').select(`
          id,
          hospital_id,
          medicine_id,
          image_url,
          created_at,
          medicines (
            name,
            category
          )
        `).order('created_at', { ascending: false }))
      ]);

      setHospitals(hospData || []);
      setMedicines(dbMedicines || []);
      setSubmissions(subData || []);

      // Synchronize selectedHospital with freshly fetched hospital data from DB
      if (hospData && hospData.length > 0) {
        const savedRaw = localStorage.getItem('medi_selected_hospital_v3');
        if (savedRaw) {
          try {
            const savedObj = JSON.parse(savedRaw);
            const latestHospital = hospData.find(h => h.id === savedObj.id);
            if (latestHospital) {
              setSelectedHospital(latestHospital);
              localStorage.setItem('medi_selected_hospital_v3', JSON.stringify(latestHospital));
            }
          } catch (e) {
            console.error('Error syncing saved hospital:', e);
          }
        }
      }
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
            key={selectedHospital?.id || 'no-hospital'}
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
            selectedHospital={selectedHospital}
            setSelectedHospital={handleHospitalChange}
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
            key={selectedHospital?.id || 'no-hospital'}
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
