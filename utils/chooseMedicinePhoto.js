import Swal from 'sweetalert2';

export function chooseMedicinePhoto(cameraInput, galleryInput) {
  const openInput = (input) => {
    if (!input) return;
    // Allow selecting the same photo again after cancelling or replacing it.
    input.value = '';
    input.click();
  };

  return Swal.fire({
    title: 'Choose photo',
    text: 'Take a new photo or select one from your gallery.',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Camera',
    denyButtonText: 'Gallery',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#059669',
    denyButtonColor: '#2563eb',
    // Open the picker from the button callback, preserving user activation.
    preConfirm: () => openInput(cameraInput),
    preDeny: () => openInput(galleryInput),
  });
}
