import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Pill, Search, Plus, Loader2, X, AlertCircle, Camera, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

const ITEMS_PER_PAGE = 15;

export default function MedicinesTab() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Upload/Camera State for creating or updating image from list
  const [uploadingMedId, setUploadingMedId] = useState(null);
  const fileInputRef = useRef(null);

  // Loading indicator states for delete actions
  const [deletingId, setDeletingId] = useState(null);
  const [clearingPhotoId, setClearingPhotoId] = useState(null);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('medicines')
        .select(`
          *,
          tablet_submissions (
            hospital_id,
            hospitals (
              name
            )
          )
        `)
        .order('name');
      
      if (fetchErr) {
        console.warn('Joined query failed. Loading fallback medicines.');
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('medicines')
          .select('*')
          .order('name');
        if (fallbackErr) throw fallbackErr;
        setMedicines(fallbackData || []);
      } else {
        setMedicines(data || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load medicines: ' + err.message);
    } finally {
      setLoading(false);
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

  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Medicine name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('medicines')
        .insert({
          name: name.trim(),
          category: category.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setMedicines(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setIsModalOpen(false);
      setName('');
      setCategory('');
      setCurrentPage(1);

      Swal.fire({
        title: 'Added!',
        text: `"${data.name}" has been successfully added to catalog.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create medicine.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMedicine = async (medId, medName) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete "${medName}" from the catalog. This will permanently remove its references in the database.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, delete medicine',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setDeletingId(medId);
    setError('');

    try {
      const { error: deleteErr } = await supabase
        .from('medicines')
        .delete()
        .eq('id', medId);

      if (deleteErr) throw deleteErr;

      setMedicines(prev => prev.filter(m => m.id !== medId));
      
      const remainingFiltered = filteredMedicines.filter(m => m.id !== medId);
      const newTotalPages = Math.ceil(remainingFiltered.length / ITEMS_PER_PAGE);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }

      Swal.fire({
        title: 'Deleted!',
        text: `"${medName}" has been deleted from catalog.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error(err);
      const isForeignKey = err.message?.includes('foreign key');
      Swal.fire({
        title: 'Cannot Delete Medicine',
        text: isForeignKey 
          ? `Cannot delete "${medName}" because it is currently prescribed to patients.`
          : `Failed to delete medicine: ${err.message}`,
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePhotoOnly = async (medId, medName) => {
    const result = await Swal.fire({
      title: 'Delete Photo?',
      text: `Are you sure you want to delete only the tablet photo for "${medName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, clear photo',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setClearingPhotoId(medId);
    setError('');

    try {
      // 1. Clear medicines.image_url
      const { error: updateErr } = await supabase
        .from('medicines')
        .update({ image_url: null })
        .eq('id', medId);

      if (updateErr) throw updateErr;

      // 2. Delete entries in tablet_submissions
      const { error: deleteErr } = await supabase
        .from('tablet_submissions')
        .delete()
        .eq('medicine_id', medId);

      if (deleteErr) {
        console.warn('Could not delete submissions associated with medicine:', deleteErr);
      }

      setMedicines(prev => prev.map(m => 
        m.id === medId ? { ...m, image_url: null, tablet_submissions: [] } : m
      ));

      Swal.fire({
        title: 'Photo Cleared!',
        text: `Tablet photo for "${medName}" has been removed.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to delete photo: ' + err.message,
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setClearingPhotoId(null);
    }
  };

  const handleImageClick = (medId) => {
    setUploadingMedId(medId);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file && uploadingMedId) {
      setLoading(true);
      try {
        // Compress image client side
        const compressedFile = await compressImage(file);

        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `tablets/catalog/${uploadingMedId}_${Date.now()}.${fileExt}`;
        
        // 1. Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('medicine-images')
          .upload(fileName, compressedFile, { upsert: true });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('medicine-images')
          .getPublicUrl(fileName);

        // 3. Update DB
        const { error: updateError } = await supabase
          .from('medicines')
          .update({ image_url: publicUrl })
          .eq('id', uploadingMedId);

        if (updateError) throw updateError;

        setMedicines(prev => prev.map(med => 
          med.id === uploadingMedId ? { ...med, image_url: publicUrl } : med
        ));

        Swal.fire({
          title: 'Success!',
          text: 'Tablet photo updated successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981'
        });

      } catch (err) {
        console.error(err);
        Swal.fire({
          title: 'Upload Failed',
          text: err.message || 'Failed to upload image',
          icon: 'error',
          confirmButtonColor: '#10b981'
        });
      } finally {
        setLoading(false);
        setUploadingMedId(null);
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.category && m.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCount = filteredMedicines.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentMedicines = filteredMedicines.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const masterCount = medicines.length;
  const countWithImages = medicines.filter(m => m.image_url).length;
  const percentComplete = masterCount > 0 ? Math.round((countWithImages / masterCount) * 100) : 0;

  return (
    <div className="space-y-5 text-slate-800 animate-fade-in pb-16">
      
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-emerald-600 animate-pulse" />
            Medicines Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Master medicine list & photos</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Add Drug
        </button>
      </div>

      {/* Progress Bar for photo coverage */}
      {masterCount > 0 && (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">Tablet Photo Coverage</span>
            <span className="text-emerald-600">{countWithImages} / {masterCount} ({percentComplete}%)</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-500 shadow-xs" 
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search medicines..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 transition-all text-sm font-medium"
        />
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* List */}
      {loading && !uploadingMedId && medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-450 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold">Loading medicines...</span>
        </div>
      ) : filteredMedicines.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-sm font-medium">
          No medicines found
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {currentMedicines.map((med) => {
            const hospitalNames = Array.from(
              new Set(
                med.tablet_submissions
                  ?.map(ts => ts.hospitals?.name)
                  .filter(Boolean)
              )
            );

            return (
              <div 
                key={med.id} 
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs hover:border-slate-350 hover:shadow-md transition duration-300 flex flex-col justify-between"
              >
                {/* 1. Image Header */}
                <div className="relative aspect-square w-full bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {med.image_url ? (
                    <img 
                      src={med.image_url} 
                      alt={med.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <button 
                      onClick={() => handleImageClick(med.id)}
                      className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-600 transition cursor-pointer bg-slate-50/50 border-none"
                      title="Upload tablet photo"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">No Photo</span>
                    </button>
                  )}
                </div>
                
                {/* 2. Card Content Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight min-h-[32px] tracking-tight" title={med.name}>
                      {med.name}
                    </h3>
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider inline-block">
                      {med.category || 'General'}
                    </span>
                  </div>

                  <div className="border-t border-slate-100/80 pt-2">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      Hospital Location
                    </span>
                    <p className="text-[9px] text-slate-500 font-bold truncate mt-1 leading-snug" title={hospitalNames.join(', ') || 'No hospital submissions yet'}>
                      {hospitalNames.join(', ') || 'No submissions yet'}
                    </p>
                  </div>
                </div>

                {/* 3. Card Footer Action Panel */}
                <div className="p-3 pt-0 flex flex-col gap-1.5 shrink-0">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleImageClick(med.id)}
                      className={`flex-1 text-[9px] font-extrabold uppercase tracking-wider py-2 rounded-xl transition border flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                        med.image_url
                          ? 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                          : 'border-emerald-500/20 text-emerald-700 bg-emerald-50 hover:bg-emerald-100/60'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      {med.image_url ? 'Replace' : 'Capture'}
                    </button>

                    <button
                      onClick={() => handleDeleteMedicine(med.id, med.name)}
                      disabled={deletingId === med.id}
                      className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition cursor-pointer active:scale-95 shrink-0"
                      title="Delete medicine from catalog"
                    >
                      {deletingId === med.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {med.image_url && (
                    <button
                      onClick={() => handleDeletePhotoOnly(med.id, med.name)}
                      disabled={clearingPhotoId === med.id}
                      className="w-full text-[9px] font-extrabold uppercase tracking-wider py-1.5 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 cursor-pointer active:scale-95 disabled:opacity-40"
                    >
                      {clearingPhotoId === med.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                      ) : (
                        'Clear Photo Only'
                      )}
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            className="border border-slate-200 text-slate-655 bg-white hover:bg-slate-100 font-bold px-4 py-2.5 rounded-xl transition text-xs active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            Previous
          </button>
          
          <span className="text-xs text-slate-500 font-bold">
            Page {currentPage} of {totalPages} <span className="text-slate-400 font-medium">({totalCount} items)</span>
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            className="border border-slate-200 text-slate-655 bg-white hover:bg-slate-100 font-bold px-4 py-2.5 rounded-xl transition text-xs active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 relative animate-scale-up">
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 border border-slate-100 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-600" /> Add New Medicine
            </h3>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateMedicine} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Paracetamol 650mg"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Analgesic, Antibiotic, etc."
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="flex-1 border border-slate-200 text-slate-655 bg-white hover:bg-slate-100 font-bold py-3 rounded-xl transition text-sm active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-1.5 text-sm shadow-md shadow-emerald-500/10 active:scale-98 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" /> Saving...
                    </>
                  ) : (
                    'Save Medicine'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
