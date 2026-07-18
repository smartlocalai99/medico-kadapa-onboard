import React from 'react';
import { Camera, Building2, Pill } from 'lucide-react';

export default function Layout({ children, activeTab, setActiveTab, selectedHospital, onHospitalChange }) {
  const tabs = [
    { id: 'record', label: 'Record', icon: Camera },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'medicines', label: 'Medicines', icon: Pill },
  ];

  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-900 flex justify-center overflow-hidden">
      {/* Mobile-first layout container */}
      <div className="w-full max-w-md bg-white h-full flex flex-col relative shadow-xl border-x border-slate-200 overflow-hidden">

        {/* Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-xs shrink-0 z-40">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Medico Kadapa Onboard Logo"
              className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm"
            />
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                Medico Kadapa Onboard
              </h1>
              <p className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase leading-none mt-0.5">
                Tablet Capture
              </p>
            </div>
          </div>

          {selectedHospital ? (
            <button
              onClick={() => onHospitalChange(null)}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 py-1.5 px-3 rounded-full text-emerald-700 font-bold transition text-[10px] uppercase cursor-pointer max-w-[140px]"
              title="Click to change location"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{selectedHospital.code || selectedHospital.name}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 py-1 px-2.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Live DB</span>
            </div>
          )}
        </header>

        {/* Content area */}
        <main className="flex-1 p-5 overflow-y-auto pb-8">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-3 shadow-lg shrink-0 z-40">
          <div className="grid grid-cols-3 justify-items-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-300 relative ${isActive
                      ? 'text-emerald-600 scale-105'
                      : 'text-slate-400 hover:text-slate-655 hover:bg-slate-55'
                    }`}
                >
                  <Icon className="w-5.5 h-5.5" />
                  <span className="text-[10px] font-bold mt-1 tracking-wide">{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 w-5 h-0.5 bg-emerald-650 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
