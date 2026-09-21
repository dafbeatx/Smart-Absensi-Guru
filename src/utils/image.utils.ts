/**
 * Utility for client-side image compression and WebP conversion.
 * Resizes large photo files to specified dimensions and converts them into optimized WebP images
 * (reducing file size from ~3-5MB down to ~20-50KB to conserve Supabase Storage and speed up slow connections).
 */

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function convertToWebP(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      return reject(new Error('File yang dipilih bukan berkas gambar.'));
    }

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

      const rawBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
      const cleanBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Export as image/webp
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Fallback to toDataURL if toBlob returned null
              try {
                const dataUrl = canvas.toDataURL('image/webp', quality);
                const byteString = atob(dataUrl.split(',')[1]);
                const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const fallbackBlob = new Blob([ab], { type: mimeString });
                const webpFile = new File([fallbackBlob], `${cleanBaseName}.webp`, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                return resolve(webpFile);
              } catch (fallbackErr) {
                return reject(new Error('Gagal mengompresi gambar ke WebP: ' + (fallbackErr as Error).message));
              }
            }

            const webpFile = new File([blob], `${cleanBaseName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      } else {
        // Fallback for browsers without canvas.toBlob
        try {
          const dataUrl = canvas.toDataURL('image/webp', quality);
          const byteString = atob(dataUrl.split(',')[1]);
          const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeString });
          const webpFile = new File([blob], `${cleanBaseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(webpFile);
        } catch (err) {
          reject(new Error('Gagal mengonversi gambar: ' + (err as Error).message));
        }
      }
    };

    image.onerror = () => reject(new Error('Format gambar tidak dapat dibaca oleh browser.'));
    reader.onerror = () => reject(new Error('Gagal membaca berkas file gambar.'));
    reader.readAsDataURL(file);
  });
}

