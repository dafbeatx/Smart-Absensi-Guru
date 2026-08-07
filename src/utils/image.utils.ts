/**
 * Utility for client-side image compression and WebP conversion.
 * Resizes large photo files to max 400x400px and converts them into optimized WebP images
 * (reducing file size from ~3-5MB down to ~20-30KB to conserve Supabase Storage).
 */
export async function convertToWebP(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      image.src = e.target?.result as string;
    };

    image.onload = () => {
      let width = image.width;
      let height = image.height;

      // Calculate aspect ratio preserving dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal memproses canvas gambar.'));
        return;
      }

      // Draw image onto canvas
      ctx.drawImage(image, 0, 0, width, height);

      // Export as image/webp
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengompresi gambar ke WebP.'));
            return;
          }

          const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'avatar';
          const webpFile = new File([blob], `${originalName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          resolve(webpFile);
        },
        'image/webp',
        quality
      );
    };

    image.onerror = (err) => reject(err);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
