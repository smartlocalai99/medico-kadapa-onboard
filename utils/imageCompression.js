// Resizes and re-encodes an image file in the browser before upload, so a
// multi-MB phone camera photo doesn't go straight into Supabase Storage at
// full resolution.
export function compressImage(file) {
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
}

export function extractStoragePath(publicUrl) {
  if (!publicUrl) return null;
  const match = publicUrl.match(/\/medicine-images\/(.+)$/);
  return match ? match[1] : null;
}
