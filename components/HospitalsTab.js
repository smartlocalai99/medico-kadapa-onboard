import React, { useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Building2, ArrowLeft, Trash2, Camera, Loader2, AlertCircle, Search, ChevronRight, UserCheck, Upload, Edit, Image } from 'lucide-react';
import Swal from 'sweetalert2';

export default function HospitalsTab({
  hospitals,
  setHospitals,
  submissions,
  setSubmissions,
  loadingData,
  refreshData,
  setMedicines,
  selectedHospital,
  setSelectedHospital
}) {
  const [error, setError] = useState('');

  // Selected Hospital details view
  const [activeHospital, setActiveHospital] = useState(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  // Reupload States for Submissions & Hospital Assets
  const [uploadingSubmission, setUploadingSubmission] = useState(null);
  const [uploadingHospitalAsset, setUploadingHospitalAsset] = useState(null); // { hospitalId, assetType: 'logo' | 'doctor' }
  const fileInputRef = useRef(null);
  const assetFileInputRef = useRef(null);

  // Doctor details editing modal / state
  const [editingDoctorHosp, setEditingDoctorHosp] = useState(null);
  const [doctorNameInput, setDoctorNameInput] = useState('');
  const [savingDoctorInfo, setSavingDoctorInfo] = useState(false);

  // Deletion States
  const [deletingHospId, setDeletingHospId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Drilling into a hospital here also makes it the app's active hospital,
  // so Record tab and the header pill are already scoped to it afterward.
  const openHospitalDetail = (hosp) => {
    setActiveHospital(hosp);
    setSelectedHospital(hosp);
  };

  const getSubmissionsForHospital = (hospitalId) => {
    const seenMedicineIds = new Set();
    const latestPerMedicine = [];
    for (const s of submissions) {
      if (s.hospital_id !== hospitalId) continue;
      if (seenMedicineIds.has(s.medicine_id)) continue;
      seenMedicineIds.add(s.medicine_id);
      latestPerMedicine.push(s);
    }
    return latestPerMedicine;
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

  const extractStoragePath = (publicUrl) => {
    if (!publicUrl) return null;
    const match = publicUrl.match(/\/medicine-images\/(.+)$/);
    return match ? match[1] : null;
  };

  const triggerAssetUpload = (hospId, assetType) => {
    setUploadingHospitalAsset({ hospitalId: hospId, assetType });
    if (assetFileInputRef.current) {
      assetFileInputRef.current.click();
    }
  };

  const handleAssetFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingHospitalAsset) return;

    const { hospitalId, assetType } = uploadingHospitalAsset;
    setLoading(true);

    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop() || 'jpg';
      const fileName = `hospitals/${hospitalId}/${assetType}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('medicine-images')
        .upload(fileName, compressed, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('medicine-images')
        .getPublicUrl(fileName);

      const fieldToUpdate = assetType === 'logo' ? 'logo_url' : 'doctor_image_url';

      const { error: updateErr } = await supabase
        .from('hospitals')
        .update({ [fieldToUpdate]: publicUrl })
        .eq('id', hospitalId);

      if (updateErr) throw updateErr;

      setHospitals(prev => prev.map(h => h.id === hospitalId ? { ...h, [fieldToUpdate]: publicUrl } : h));
      if (activeHospital?.id === hospitalId) {
        setActiveHospital(prev => ({ ...prev, [fieldToUpdate]: publicUrl }));
      }
      if (selectedHospital?.id === hospitalId) {
        const updated = { ...selectedHospital, [fieldToUpdate]: publicUrl };
        setSelectedHospital(updated);
        localStorage.setItem('medi_selected_hospital_v3', JSON.stringify(updated));
      }

      refreshData();

      Swal.fire({
        title: 'Uploaded!',
        text: `${assetType === 'logo' ? 'Hospital Logo' : 'Doctor Photo'} updated successfully.`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error(`Error uploading hospital ${assetType}:`, err);
      Swal.fire({
        title: 'Upload Failed',
        text: err.message || 'Could not upload image.',
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(false);
      setUploadingHospitalAsset(null);
    }
  };

  const handleSaveDoctorName = async () => {
    if (!editingDoctorHosp) return;
    setSavingDoctorInfo(true);

    try {
      const nameVal = doctorNameInput.trim();
      const { error: updateErr } = await supabase
        .from('hospitals')
        .update({ doctor_name: nameVal || null })
        .eq('id', editingDoctorHosp.id);

      if (updateErr) throw updateErr;

      setHospitals(prev => prev.map(h => h.id === editingDoctorHosp.id ? { ...h, doctor_name: nameVal || null } : h));
      if (activeHospital?.id === editingDoctorHosp.id) {
        setActiveHospital(prev => ({ ...prev, doctor_name: nameVal || null }));
      }
      if (selectedHospital?.id === editingDoctorHosp.id) {
        const updated = { ...selectedHospital, doctor_name: nameVal || null };
        setSelectedHospital(updated);
        localStorage.setItem('medi_selected_hospital_v3', JSON.stringify(updated));
      }

      refreshData();
      setEditingDoctorHosp(null);

      Swal.fire({
        title: 'Updated!',
        text: 'Doctor name updated successfully.',
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error('Error saving doctor name:', err);
      Swal.fire({
        title: 'Update Failed',
        text: err.message || 'Could not update doctor name.',
        icon: 'error',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setSavingDoctorInfo(false);
    }
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
      cancelButtonText: 'Cancel',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    setDeletingHospId(hospId);
    setError('');

    try {
      const hospSubs = submissions.filter(s => s.hospital_id === hospId);
      const filePathsToDelete = hospSubs
        .map(s => extractStoragePath(s.image_url))
        .filter(Boolean);

      const { error: deleteSubsErr } = await supabase
        .from('tablet_submissions')
        .delete()
        .eq('hospital_id', hospId);

      if (deleteSubsErr) throw deleteSubsErr;

      const { error: deleteErr } = await supabase
        .from('hospitals')
        .delete()
        .eq('id', hospId);

      if (deleteErr) throw deleteErr;

      if (filePathsToDelete.length > 0) {
        await supabase.storage
          .from('medicine-images')
          .remove(filePathsToDelete);
      }

      setHospitals(prev => prev.filter(h => h.id !== hospId));
      setSubmissions(prev => prev.filter(s => s.hospital_id !== hospId));

      refreshData();

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

  const handleDeletePhoto = async (sub, medicineName) => {
    const result = await Swal.fire({
      title: 'Delete Tablet Photo?',
      text: `Are you sure you want to delete the tablet photo for "${medicineName}" at this hospital?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, delete photo',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const storagePath = extractStoragePath(sub.image_url);
      if (storagePath) {
        await supabase.storage
          .from('medicine-images')
          .remove([storagePath]);
      }

      const { error: deleteErr } = await supabase
        .from('tablet_submissions')
        .delete()
        .eq('id', sub.id);

      if (deleteErr) throw deleteErr;

      const { error: updateErr } = await supabase
        .from('medicines')
        .update({ image_url: null })
        .eq('id', sub.medicine_id);

      if (updateErr) throw updateErr;

      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      setMedicines(prev => prev.map(m => m.id === sub.medicine_id ? { ...m, image_url: null } : m));

      refreshData();

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
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file && uploadingSubmission) {
      setLoading(true);
      try {
        const oldImageUrl = uploadingSubmission.image_url;

        const compressedFile = await compressImage(file);
        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `tablets/${uploadingSubmission.hospital_id}/${uploadingSubmission.medicine_id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('medicine-images')
          .upload(fileName, compressedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('medicine-images')
          .getPublicUrl(fileName);

        const { error: updateMedErr } = await supabase
          .from('medicines')
          .update({ image_url: publicUrl })
          .eq('id', uploadingSubmission.medicine_id);

        if (updateMedErr) throw updateMedErr;

        const { error: updateSubErr } = await supabase
          .from('tablet_submissions')
          .update({ image_url: publicUrl })
          .eq('id', uploadingSubmission.id);

        if (updateSubErr) throw updateSubErr;

        const oldPath = extractStoragePath(oldImageUrl);
        if (oldPath) {
          try {
            await supabase.storage.from('medicine-images').remove([oldPath]);
          } catch (cleanupErr) {
            console.warn('Failed to remove old tablet image from storage:', cleanupErr);
          }
        }

        setSubmissions(prev => prev.map(s => 
          s.id === uploadingSubmission.id ? { ...s, image_url: publicUrl } : s
        ));
        setMedicines(prev => prev.map(m => 
          m.id === uploadingSubmission.medicine_id ? { ...m, image_url: publicUrl } : m
        ));

        refreshData();

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

  const hospitalSubmissions = activeHospital ? getSubmissionsForHospital(activeHospital.id) : [];
  const filteredSubmissions = hospitalSubmissions.filter(s => 
    s.medicines?.name?.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
    s.medicines?.category?.toLowerCase().includes(detailSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 text-slate-800 animate-fade-in pb-16">

      {/* Hidden file input for logo & doctor photos */}
      <input
        type="file"
        accept="image/*"
        ref={assetFileInputRef}
        onChange={handleAssetFileChange}
        className="hidden"
      />

      {/* Hidden Camera Input for Reupload Submissions */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Doctor Name Edit Modal */}
      {editingDoctorHosp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 relative animate-scale-up">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" /> Edit Doctor Details
            </h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Doctor Name
              </label>
              <input
                type="text"
                value={doctorNameInput}
                onChange={(e) => setDoctorNameInput(e.target.value)}
                placeholder="e.g. Dr. K. Vardhan Reddy"
                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoctorHosp(null)}
                className="flex-1 border border-slate-200 text-slate-655 bg-white hover:bg-slate-100 font-bold py-2.5 rounded-xl text-xs active:scale-98 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDoctorName}
                disabled={savingDoctorInfo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md shadow-emerald-500/10 active:scale-98 cursor-pointer"
              >
                {savingDoctorInfo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED HOSPITAL VIEW */}
      {activeHospital ? (
        <div className="space-y-5 text-slate-800">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setActiveHospital(null);
                  setDetailSearchQuery('');
                }}
                className="p-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition cursor-pointer active:scale-95 bg-white shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight truncate max-w-[200px]">
                  {activeHospital.name}
                </h2>
                <p className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase mt-0.5">
                  Code: {activeHospital.code || 'None'} · {hospitalSubmissions.length} Photos
                </p>
              </div>
            </div>
          </div>

          {/* Hospital Logo & Doctor Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Hospital Branding & Medical In-Charge
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Hospital Logo Block */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center justify-center text-center relative group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center mb-2 shadow-xs">
                  {activeHospital.logo_url ? (
                    <img src={activeHospital.logo_url} alt="Hospital logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-700 block truncate w-full">Hospital Logo</span>
                <button
                  type="button"
                  onClick={() => triggerAssetUpload(activeHospital.id, 'logo')}
                  className="mt-2 text-[9px] bg-white hover:bg-slate-100 text-emerald-600 border border-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Upload Logo
                </button>
              </div>

              {/* Doctor Photo & Info Block */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center justify-center text-center relative group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center mb-2 shadow-xs">
                  {activeHospital.doctor_image_url ? (
                    <img src={activeHospital.doctor_image_url} alt="Doctor" className="w-full h-full object-cover" />
                  ) : (
                    <UserCheck className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-800 block truncate w-full">
                  {activeHospital.doctor_name || 'No Doctor Set'}
                </span>
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => triggerAssetUpload(activeHospital.id, 'doctor')}
                    className="text-[9px] bg-white hover:bg-slate-100 text-emerald-600 border border-slate-200 px-2 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                    title="Upload Doctor Image"
                  >
                    <Upload className="w-3 h-3" /> Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoctorHosp(activeHospital);
                      setDoctorNameInput(activeHospital.doctor_name || '');
                    }}
                    className="text-[9px] bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                    title="Edit Doctor Name"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

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
          {loadingData && submissions.length === 0 ? (
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
                      onClick={() => handleDeletePhoto(sub, sub.medicines?.name)}
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
      ) : (
        /* GENERAL HOSPITALS LIST */
        <div className="space-y-5 text-slate-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Hospitals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a hospital to view recorded tablets or upload logo & doctor image</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

          {loadingData && hospitals.length === 0 ? (
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
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-350 hover:bg-slate-50/30 transition shadow-xs group"
                  >
                    <button
                      onClick={() => openHospitalDetail(hosp)}
                      className="flex-1 text-left flex items-center gap-3 cursor-pointer active:scale-99 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="bg-slate-50 text-slate-600 border border-slate-100 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors overflow-hidden shrink-0 w-11 h-11 flex items-center justify-center">
                          {hosp.logo_url ? (
                            <img
                              src={hosp.logo_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>

                        {hosp.doctor_image_url && (
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-200 bg-white shrink-0 shadow-2xs" title={`Doctor: ${hosp.doctor_name || 'In-Charge'}`}>
                            <img
                              src={hosp.doctor_image_url}
                              alt="Doctor"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-850 leading-snug truncate">{hosp.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 truncate">
                          <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                            {count} {count === 1 ? 'tablet' : 'tablets'}
                          </span>
                          {hosp.doctor_name && (
                            <>
                              <span className="text-[10px] text-slate-400 font-bold">•</span>
                              <span className="text-[10px] text-slate-500 font-bold truncate">
                                {hosp.doctor_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerAssetUpload(hosp.id, 'logo');
                        }}
                        className="text-[9px] font-bold text-emerald-600 border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100 p-2 rounded-xl transition cursor-pointer active:scale-95 flex items-center gap-1"
                        title="Upload Logo"
                      >
                        <Upload className="w-3 h-3" /> Logo
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerAssetUpload(hosp.id, 'doctor');
                        }}
                        className="text-[9px] font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer active:scale-95 flex items-center gap-1"
                        title="Upload Doctor Image"
                      >
                        <UserCheck className="w-3 h-3" /> Doctor
                      </button>

                      <button
                        onClick={() => handleDeleteHospital(hosp.id, hosp.name)}
                        disabled={deletingHospId === hosp.id}
                        className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer active:scale-95"
                        title="Delete Hospital"
                      >
                        {deletingHospId === hosp.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      
                      <ChevronRight
                        onClick={() => openHospitalDetail(hosp)}
                        className="w-5 h-5 text-slate-350 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all cursor-pointer" 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

