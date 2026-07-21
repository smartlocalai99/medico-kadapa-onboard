import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { compressImage } from '../utils/imageCompression';
import { Camera, Check, RotateCcw, Building2, Pill, Loader2, AlertCircle, Sparkles, Search } from 'lucide-react';

const PHOTO_KINDS = [
  { kind: 'box', label: 'Box' },
  { kind: 'sheet', label: 'Sheet' },
];

export default function RecordTab({
  staffProfile,
  selectedHospital,
  setSelectedHospital,
  hospitals,
  medicines,
  setMedicines,
  submissions,
  setSubmissions,
  loadingData,
  refreshData
}) {
  // Selections
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  // photos: { box: { file, preview, sizeKb } | null, sheet: { ... } | null }
  const [photos, setPhotos] = useState({ box: null, sheet: null });

  // Dropdown States
  const [showHospDropdown, setShowHospDropdown] = useState(false);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);

  // Loading/Error states
  const [compressingKind, setCompressingKind] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const fileInputRefs = { box: useRef(null), sheet: useRef(null) };
  const medicineInputRef = useRef(null);
  const hospDropdownRef = useRef(null);

  // Close hospital dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (hospDropdownRef.current && !hospDropdownRef.current.contains(event.target)) {
        setShowHospDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleMedicineSelect = (med) => {
    setSelectedMedicine(med);
    setShowMedicineDropdown(false);
    setMedicineQuery('');
    setErrorMessage('');
    // Clear any previous previews
    setPhotos({ box: null, sheet: null });
  };

  const handleCameraTrigger = (kind) => {
    fileInputRefs[kind].current?.click();
  };

  const handleFileChange = async (kind, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setCompressingKind(kind);

    try {
      const compressed = await compressImage(file);
      const sizeKb = Math.round(compressed.size / 1024);
      const preview = URL.createObjectURL(compressed);
      setPhotos((prev) => ({ ...prev, [kind]: { file: compressed, preview, sizeKb } }));
    } catch (err) {
      console.error('Compression error:', err);
      setErrorMessage('Failed to compress image. Reverting to original.');
      setPhotos((prev) => ({
        ...prev,
        [kind]: { file, preview: URL.createObjectURL(file), sizeKb: Math.round(file.size / 1024) },
      }));
    } finally {
      setCompressingKind(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHospital || !selectedMedicine || (!photos.box && !photos.sheet)) {
      setErrorMessage('Please ensure hospital, drug, and at least one tablet photo are provided.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const medicineUpdates = {};

      for (const { kind } of PHOTO_KINDS) {
        const photo = photos[kind];
        if (!photo) continue;

        const fileExt = photo.file.name.split('.').pop() || 'jpg';
        const fileName = `tablets/${selectedHospital.id}/${selectedMedicine.id}_${kind}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('medicine-images')
          .upload(fileName, photo.file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('medicine-images')
          .getPublicUrl(fileName);

        medicineUpdates[kind === 'box' ? 'box_image_url' : 'sheet_image_url'] = publicUrl;

        try {
          await supabase
            .from('tablet_submissions')
            .insert({
              hospital_id: selectedHospital.id,
              medicine_id: selectedMedicine.id,
              image_url: publicUrl,
              kind,
            });
        } catch (logErr) {
          console.warn('Logging to tablet_submissions failed:', logErr);
        }
      }

      const { error: updateError } = await supabase
        .from('medicines')
        .update(medicineUpdates)
        .eq('id', selectedMedicine.id);

      if (updateError) throw updateError;

      // Update local state reactive arrays instantly
      setMedicines(prev => prev.map(m =>
        m.id === selectedMedicine.id ? { ...m, ...medicineUpdates } : m
      ));

      const userId = staffProfile?.id || 'anon';
      const localUploaded = localStorage.getItem(`uploads_today_${userId}`) || '0';
      localStorage.setItem(`uploads_today_${userId}`, String(parseInt(localUploaded, 10) + 1));

      // Refresh in background to sync database state perfectly
      refreshData();

      setSubmitSuccess(true);

      setTimeout(() => {
        handleResetForNext();
      }, 2000);

    } catch (err) {
      console.error('Error submitting:', err);
      setErrorMessage(err.message || 'Error occurred while saving. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setSelectedMedicine(null);
    setPhotos({ box: null, sheet: null });
    setSubmitSuccess(false);
    setErrorMessage('');
    setMedicineQuery('');

    setTimeout(() => {
      if (medicineInputRef.current) {
        medicineInputRef.current.focus();
      }
    }, 100);
  };

  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(medicineQuery.toLowerCase())
  );

  // If no hospital selected, show centered screen layout
  if (!selectedHospital) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-slate-800 animate-fade-in">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-6 text-center" ref={hospDropdownRef}>
          <div className="flex flex-col items-center">
            <img
              src="/logo.png"
              alt="Medico Kadapa Logo"
              className="w-24 h-24 object-contain mb-4"
            />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Medico Kadapa Onboard</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px] leading-normal">
              Select your hospital location below to configure your tablet image capture workspace.
            </p>
          </div>

          <div className="text-left space-y-2 relative">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Hospital Location
            </label>

            {loadingData && hospitals.length === 0 ? (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-500 text-sm font-bold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading hospitals...
              </div>
            ) : (
              <div className="relative">
                {/* Trigger */}
                <button
                  type="button"
                  onClick={() => setShowHospDropdown(prev => !prev)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 hover:border-slate-300 rounded-2xl py-4 pl-12 pr-10 text-left text-slate-900 focus:outline-none focus:border-emerald-500 transition-all text-sm font-bold flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="truncate">Select a Hospital...</span>
                  </div>
                  <svg className={`fill-current h-4 w-4 text-slate-550 transition-transform duration-200 ${showHospDropdown ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </button>

                {/* Dropdown list */}
                {showHospDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl mt-2 overflow-hidden shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-scale-up">
                    {hospitals.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setSelectedHospital(h);
                          setErrorMessage('');
                          setShowHospDropdown(false);
                        }}
                        className="w-full text-left px-5 py-4 hover:bg-slate-55 transition-colors flex items-center gap-3 font-bold text-xs text-slate-800"
                      >
                        <Building2 className="w-4.5 h-4.5 shrink-0 text-slate-400" />
                        <span className="truncate flex-1">
                          {h.name} {h.code ? `(${h.code})` : ''}
                        </span>
                      </button>
                    ))}
                    {hospitals.length === 0 && (
                      <div className="p-4 text-center text-slate-450 text-xs">No hospitals found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active workspace once hospital is selected
  return (
    <div className="space-y-6 text-slate-800 animate-fade-in pb-16">

      {/* Workspace Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse shrink-0" />
          Upload Tablet Photo
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Capture medicine tablets for hospital catalog</p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-750 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* STEP 1: Search and Select Drug */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">1</span>
          Select Drug / Tablet
        </label>

        {selectedMedicine ? (
          <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl shrink-0">
                <Pill className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate leading-snug">{selectedMedicine.name}</h3>
                <p className="text-xs text-slate-500">Category: {selectedMedicine.category || 'General'}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedMedicine(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all cursor-pointer bg-white shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={medicineInputRef}
                type="text"
                placeholder="Search drug catalog..."
                value={medicineQuery}
                onFocus={() => setShowMedicineDropdown(true)}
                onChange={(e) => {
                  setMedicineQuery(e.target.value);
                  setShowMedicineDropdown(true);
                }}
                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all text-sm font-medium"
              />
            </div>

            {showMedicineDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl mt-2 overflow-hidden shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                {loadingData && medicines.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading medicines...
                  </div>
                ) : (
                  <>
                    {filteredMedicines.slice(0, 15).map((med) => (
                      <button
                        key={med.id}
                        type="button"
                        onClick={() => handleMedicineSelect(med)}
                        className="w-full text-left px-5 py-3.5 hover:bg-slate-100 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800 text-sm block">{med.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono uppercase tracking-wider mt-1 inline-block">{med.category || 'General'}</span>
                        </div>
                        {(med.sheet_image_url || med.box_image_url) && (
                          <img
                            src={med.sheet_image_url || med.box_image_url}
                            alt={med.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        )}
                      </button>
                    ))}

                    {filteredMedicines.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-sm">No medicines found matching "{medicineQuery}"</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: Box + sheet photo capture */}
      {selectedMedicine && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="bg-slate-200 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">2</span>
            Take Tablet Photos
          </label>

          {submitSuccess ? (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-xs animate-scale-up">
              <div className="bg-emerald-600 text-white p-4 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/10">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold text-slate-850">Photo Saved Successfully!</h3>
              <p className="text-sm text-slate-500">The tablet photo has been successfully saved to the medicine catalog.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {PHOTO_KINDS.map(({ kind, label }) => {
                  const photo = photos[kind];
                  const existingUrl = kind === 'box' ? selectedMedicine.box_image_url : selectedMedicine.sheet_image_url;
                  const compressing = compressingKind === kind;

                  return (
                    <div key={kind} className="space-y-2">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</span>

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={fileInputRefs[kind]}
                        onChange={(e) => handleFileChange(kind, e)}
                        className="hidden"
                      />

                      {compressing ? (
                        <div className="border border-slate-200 bg-white rounded-2xl aspect-square flex flex-col items-center justify-center text-center space-y-2 shadow-xs animate-pulse">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                          <p className="text-[10px] text-slate-500 px-2">Optimizing…</p>
                        </div>
                      ) : photo ? (
                        <div className="space-y-2">
                          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center">
                            <img src={photo.preview} alt={`New ${label} preview`} className="w-full h-full object-contain" />
                            <span className="absolute bottom-2 right-2 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-lg text-[9px] font-bold text-emerald-600 tracking-wider shadow-xs">
                              {photo.sizeKb} KB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCameraTrigger(kind)}
                            disabled={submitting}
                            className="w-full border border-slate-200 text-slate-700 font-bold py-2 rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-1.5 active:scale-98 bg-white shadow-xs text-[11px] cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            Retake
                          </button>
                        </div>
                      ) : existingUrl ? (
                        <div className="space-y-2">
                          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center">
                            <img src={existingUrl} alt={`Existing ${label}`} className="w-full h-full object-contain" />
                            <span className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider shadow-xs uppercase">
                              Current
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCameraTrigger(kind)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/15 active:scale-98 text-[11px] cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            Replace
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCameraTrigger(kind)}
                          className="w-full aspect-square border-2 border-dashed border-slate-200 hover:border-emerald-500/50 bg-white rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-all duration-300 group shadow-xs"
                        >
                          <div className="bg-slate-100 border border-slate-200 p-3 rounded-full group-hover:bg-emerald-50 group-hover:border-emerald-100 group-hover:text-emerald-600 transition-all">
                            <Camera className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold text-center px-2">Tap for camera</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || (!photos.box && !photos.sheet)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/15 active:scale-98 text-sm cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Saving...
                  </>
                ) : (
                  'Submit & Save'
                )}
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
