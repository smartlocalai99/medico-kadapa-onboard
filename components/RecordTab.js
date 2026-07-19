import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Camera, Check, RotateCcw, Building2, Pill, Loader2, AlertCircle, Sparkles, Search } from 'lucide-react';

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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [compressedSize, setCompressedSize] = useState(null);

  // Dropdown States
  const [showHospDropdown, setShowHospDropdown] = useState(false);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);

  // Loading/Error states
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const fileInputRef = useRef(null);
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
    setImageFile(null);
    setImagePreview(null);
    setCompressedSize(null);
  };

  const handleCameraTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage('');
      setCompressing(true);

      try {
        const compressed = await compressImage(file);
        setImageFile(compressed);

        const sizeInKb = Math.round(compressed.size / 1024);
        setCompressedSize(sizeInKb);

        const previewUrl = URL.createObjectURL(compressed);
        setImagePreview(previewUrl);
      } catch (err) {
        console.error('Compression error:', err);
        setErrorMessage('Failed to compress image. Reverting to original.');
        setImageFile(file);
        setCompressedSize(Math.round(file.size / 1024));
        setImagePreview(URL.createObjectURL(file));
      } finally {
        setCompressing(false);
      }
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');

          const MAX_WIDTH_OR_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH_OR_HEIGHT) {
              height = Math.round(height * (MAX_WIDTH_OR_HEIGHT / width));
              width = MAX_WIDTH_OR_HEIGHT;
            }
          } else {
            if (height > MAX_WIDTH_OR_HEIGHT) {
              width = Math.round(width * (MAX_WIDTH_OR_HEIGHT / height));
              height = MAX_WIDTH_OR_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, '') + '_compressed.jpg',
                  { type: 'image/jpeg', lastModified: Date.now() }
                );
                resolve(compressedFile);
              } else {
                reject(new Error('Canvas blob extraction failed'));
              }
            },
            'image/jpeg',
            0.70
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async () => {
    if (!selectedHospital || !selectedMedicine || !imageFile) {
      setErrorMessage('Please ensure hospital, drug, and tablet image are all provided.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const fileExt = imageFile.name.split('.').pop() || 'jpg';
      const fileName = `tablets/${selectedHospital.id}/${selectedMedicine.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('medicine-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('medicine-images')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('medicines')
        .update({ image_url: publicUrl })
        .eq('id', selectedMedicine.id);

      if (updateError) throw updateError;

      // Update local state reactive arrays instantly
      setMedicines(prev => prev.map(m =>
        m.id === selectedMedicine.id ? { ...m, image_url: publicUrl } : m
      ));

      const newSub = {
        id: 'temp-' + Date.now(),
        hospital_id: selectedHospital.id,
        medicine_id: selectedMedicine.id,
        image_url: publicUrl,
        created_at: new Date().toISOString(),
        medicines: {
          name: selectedMedicine.name,
          category: selectedMedicine.category
        }
      };
      setSubmissions(prev => [newSub, ...prev]);

      try {
        await supabase
          .from('tablet_submissions')
          .insert({
            hospital_id: selectedHospital.id,
            medicine_id: selectedMedicine.id,
            image_url: publicUrl,
          });
      } catch (logErr) {
        console.warn('Logging to tablet_submissions failed:', logErr);
      }

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
    setImageFile(null);
    setImagePreview(null);
    setCompressedSize(null);
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
              className="w-20 h-20 mb-4"
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
                        {med.image_url && (
                          <img
                            src={med.image_url}
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

      {/* STEP 2: Existing photo display or Camera Capture flow */}
      {selectedMedicine && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="bg-slate-200 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">2</span>
            {selectedMedicine.image_url && !imagePreview ? 'Existing Photo' : 'Take Tablet Photo'}
          </label>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {submitSuccess ? (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-xs animate-scale-up">
              <div className="bg-emerald-600 text-white p-4 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/10">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold text-slate-850">Photo Saved Successfully!</h3>
              <p className="text-sm text-slate-500">The tablet photo has been successfully saved to the medicine catalog.</p>
            </div>
          ) : compressing ? (
            <div className="border border-slate-200 bg-white rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 py-12 shadow-xs animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Optimizing Image...</h3>
              <p className="text-xs text-slate-500">Optimizing image file size for fast uploading...</p>
            </div>
          ) : imagePreview ? (
            /* User captured a new photo, show it with Retake & Submit */
            <div className="space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="New tablet preview"
                  className="w-full h-full object-contain"
                />

                {compressedSize && (
                  <span className="absolute bottom-3 right-3 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-600 tracking-wider shadow-xs">
                    Size: {compressedSize} KB
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCameraTrigger}
                  disabled={submitting}
                  className="flex-1 border border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2 active:scale-98 bg-white shadow-xs text-sm cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/15 active:scale-98 text-sm cursor-pointer"
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
              </div>
            </div>
          ) : selectedMedicine.image_url ? (
            /* Drug already has photo and user hasn't captured a new one yet */
            <div className="space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center">
                <img
                  src={selectedMedicine.image_url}
                  alt="Existing tablet"
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-3 left-3 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider shadow-xs uppercase">
                  Current Photo
                </span>
              </div>
              <button
                type="button"
                onClick={handleCameraTrigger}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/15 active:scale-98 text-sm cursor-pointer"
              >
                <Camera className="w-4 h-4 shrink-0" />
                Replace / Retake Photo
              </button>
            </div>
          ) : (
            /* No photo exists yet */
            <button
              type="button"
              onClick={handleCameraTrigger}
              className="w-full aspect-video border-2 border-dashed border-slate-200 hover:border-emerald-500/50 bg-white rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-slate-600 transition-all duration-300 group py-6 shadow-xs"
            >
              <div className="bg-slate-100 border border-slate-200 p-4 rounded-full group-hover:bg-emerald-50 group-hover:border-emerald-100 group-hover:text-emerald-600 transition-all">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-center">
                <span className="font-bold block text-sm text-slate-700 group-hover:text-slate-900">Open Device Camera</span>
                <span className="text-[11px] text-slate-500 block mt-1">Tap to take a photo of the tablets</span>
              </div>
            </button>
          )}
        </div>
      )}

    </div>
  );
}
