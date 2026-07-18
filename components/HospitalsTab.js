import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Building2, ArrowLeft, Trash2, Camera, Loader2, AlertCircle, Search, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function HospitalsTab() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');

  // Selected Hospital details view
  const [activeHospital, setActiveHospital] = useState(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  // Reupload States
  const [uploadingSubmission, setUploadingSubmission] = useState(null);
  const fileInputRef = useRef(null);

  // Deletion States
  const [deletingHospId, setDeletingHospId] = useState(null);

  useEffect(() => {
    fetchHospitalsAndSubmissions();
  }, []);

  // Fetch hospitals and submissions directly from Supabase DB
  const fetchHospitalsAndSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch hospitals from DB
      let dbHospitals = [];
      const { data: dataWithCode, error: fetchWithCodeErr } = await supabase
        .from('hospitals')
        .select('id, name, code')
        .order('name');
      
      if (fetchWithCodeErr) {
        console.warn('Failed to query hospitals with "code". Falling back.');
        const { data: dataFallback, error: fetchFallbackErr } = await supabase
          .from('hospitals')
          .select('id, name')
          .order('name');
        
        if (fetchFallbackErr) throw fetchFallbackErr;
        dbHospitals = dataFallback || [];
      } else {
        dbHospitals = dataWithCode || [];
      }

      setHospitals(dbHospitals);

      // 2. Fetch all tablet submissions with medicine details
      const { data: subs, error: subsErr } = await supabase
        .from('tablet_submissions')
        .select(`
          id,
          hospital_id,
          medicine_id,
          image_url,
          created_at,
          medicines (
            name,
            category
          )
        `)
        .order('created_at', { ascending: false });

      if (subsErr) {
        console.warn('Submissions fetch failed (tablet_submissions table may not exist yet).');
      } else {
        setSubmissions(subs || []);
      }
    } catch (err) {
      console.error('Error fetching hospitals/submissions:', err);
      setError('Could not connect to database. Please make sure database is initialized.');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionsForHospital = (hospitalId) => {
    return submissions.filter(s => s.hospital_id === hospitalId);
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

  const handleDeleteHospital = async (hospId, hospName) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete "${hospName}". This will permanently delete this hospital and all its associated tablet photo records.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981', 
      cancelButtonColor: '#f43f5e', 
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setDeletingHospId(hospId);
    setError('');

    try {
      const { error: deleteErr } = await supabase
        .from('hospitals')
        .delete()
        .eq('id', hospId);

      if (deleteErr) throw deleteErr;

      // Update local state lists
      setHospitals(prev => prev.filter(h => h.id !== hospId));
      setSubmissions(prev => prev.filter(s => s.hospital_id !== hospId));

      Swal.fire({
        title: 'Deleted!',
        text: `"${hospName}" has been successfully removed.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error('Error deleting hospital:', err);
      const isForeignKey = err.message?.includes('foreign key');
      Swal.fire({
        title: 'Cannot Delete Hospital',
        text: isForeignKey
          ? `Cannot delete "${hospName}" because it is referenced in active patient prescriptions or dispenses.`
          : `Failed to delete hospital: ${err.message}`,
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setDeletingHospId(null);
    }
  };

  const handleDeletePhoto = async (submissionId, medicineId, medicineName) => {
    const result = await Swal.fire({
      title: 'Delete Tablet Photo?',
      text: `Are you sure you want to delete the tablet photo for "${medicineName}" at this hospital?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, delete photo',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      // 1. Delete from tablet_submissions
      const { error: deleteErr } = await supabase
        .from('tablet_submissions')
        .delete()
        .eq('id', submissionId);

      if (deleteErr) throw deleteErr;

      // 2. Set medicines.image_url to null
      const { error: updateErr } = await supabase
        .from('medicines')
        .update({ image_url: null })
        .eq('id', medicineId);

      if (updateErr) throw updateErr;

      // 3. Update local state
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));

      Swal.fire({
        title: 'Photo Deleted!',
        text: `Tablet photo for "${medicineName}" has been deleted.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error('Error deleting photo:', err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to delete photo: ' + err.message,
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReuploadClick = (sub) => {
    setUploadingSubmission(sub);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file && uploadingSubmission) {
      setLoading(true);
      try {
        // Compress image client side
        const compressedFile = await compressImage(file);

        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `tablets/${uploadingSubmission.hospital_id}/${uploadingSubmission.medicine_id}_${Date.now()}.${fileExt}`;
        
        // 1. Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('medicine-images')
          .upload(fileName, compressedFile, { upsert: true });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('medicine-images')
          .getPublicUrl(fileName);

        // 3. Update medicines image_url in DB
        const { error: updateMedErr } = await supabase
          .from('medicines')
          .update({ image_url: publicUrl })
          .eq('id', uploadingSubmission.medicine_id);

        if (updateMedErr) throw updateMedErr;

        // 4. Update tablet_submissions image_url in DB
        const { error: updateSubErr } = await supabase
          .from('tablet_submissions')
          .update({ image_url: publicUrl })
          .eq('id', uploadingSubmission.id);

        if (updateSubErr) throw updateSubErr;

        // 5. Update local state
        setSubmissions(prev => prev.map(s => 
          s.id === uploadingSubmission.id ? { ...s, image_url: publicUrl } : s
        ));

        Swal.fire({
          title: 'Success!',
          text: 'Tablet photo updated successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981'
        });

      } catch (err) {
        console.error('Error reuploading photo:', err);
        Swal.fire({
          title: 'Upload Failed',
          text: err.message || 'Failed to upload image',
          icon: 'error',
          confirmButtonColor: '#10b981'
        });
      } finally {
        setLoading(false);
        setUploadingSubmission(null);
      }
    }
  };

  // Render detail view list of tablets for selected hospital
  const hospitalSubmissions = activeHospital ? getSubmissionsForHospital(activeHospital.id) : [];
  const filteredSubmissions = hospitalSubmissions.filter(s => 
    s.medicines?.name?.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
    s.medicines?.category?.toLowerCase().includes(detailSearchQuery.toLowerCase())
  );

  if (activeHospital) {
    return (
      <div className="space-y-5 text-slate-800 pb-16">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setActiveHospital(null);
              setDetailSearchQuery('');
            }}
            className="p-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition cursor-pointer active:scale-95 bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate max-w-[280px]">
              {activeHospital.name}
            </h2>
            <p className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase mt-0.5">
              Code: {activeHospital.code || 'None'} · {hospitalSubmissions.length} Photos
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Hidden Camera Input for Reupload */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Search Bar for detailed view */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tablet photos..."
            value={detailSearchQuery}
            onChange={(e) => setDetailSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Submissions List */}
        {loading && submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-450 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-sm font-semibold">Updating catalog...</span>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-500 text-sm font-medium">
            No tablet photos recorded here matching your search
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((sub) => (
              <div 
                key={sub.id}
                className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-50">
                    <img 
                      src={sub.image_url} 
                      alt={sub.medicines?.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 text-sm truncate leading-snug">
                      {sub.medicines?.name || 'Unknown Tablet'}
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono uppercase tracking-wider inline-block mt-1">
                      {sub.medicines?.category || 'General'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleReuploadClick(sub)}
                    className="text-[10px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 bg-white cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Replace
                  </button>

                  <button
                    onClick={() => handleDeletePhoto(sub.id, sub.medicine_id, sub.medicines?.name)}
                    className="p-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer active:scale-95"
                    title="Delete photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render General Hospitals List
  return (
    <div className="space-y-5 text-slate-800 animate-fade-in pb-16">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-600" />
          Hospitals
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Select a hospital to view recorded tablets</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading && hospitals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-450 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold">Loading hospitals...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {hospitals.map((hosp) => {
            const count = getSubmissionsForHospital(hosp.id).length;
            return (
              <div
                key={hosp.id}
                className="w-full bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-4 hover:border-slate-350 hover:bg-slate-50/30 transition shadow-xs group"
              >
                <button
                  onClick={() => setActiveHospital(hosp)}
                  className="flex-1 text-left flex items-center gap-3 cursor-pointer active:scale-99"
                >
                  <div className="bg-slate-50 text-slate-600 border border-slate-100 p-2.5 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-850 leading-snug">{hosp.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-black tracking-wider">
                        CODE: {hosp.code || 'NONE'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">•</span>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {count} {count === 1 ? 'tablet' : 'tablets'} photographed
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleDeleteHospital(hosp.id, hosp.name)}
                    disabled={deletingHospId === hosp.id}
                    className="p-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer active:scale-95"
                    title="Delete Hospital"
                  >
                    {deletingHospId === hosp.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <ChevronRight 
                    onClick={() => setActiveHospital(hosp)}
                    className="w-5 h-5 text-slate-350 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all cursor-pointer" 
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
