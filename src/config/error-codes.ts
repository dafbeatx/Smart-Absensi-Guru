/**
 * SMART ABSENSI GURU - ERROR CODES REGISTRY
 */

export interface ErrorDefinition {
  code: string;
  message: string;
  solution: string;
}

export const ERROR_CODES: Record<string, ErrorDefinition> = {
  // Authentication Errors (AUTH_xxx)
  AUTH_001: {
    code: 'AUTH_001',
    message: 'Nomor WA / NPP atau PIN 6-digit tidak boleh kosong.',
    solution: 'Pastikan Anda telah mengisi seluruh kolom login.',
  },
  AUTH_002: {
    code: 'AUTH_002',
    message: 'PIN 6-digit yang Anda masukkan salah.',
    solution: 'Periksa kembali PIN Anda atau hubungi Operator untuk reset PIN.',
  },
  AUTH_003: {
    code: 'AUTH_003',
    message: 'Akun Anda terikat pada perangkat HP lain.',
    solution: 'Hubungi Admin Website untuk melakukan Reset Perangkat terdaftar.',
  },
  AUTH_004: {
    code: 'AUTH_004',
    message: 'Sesi login telah kedaluwarsa.',
    solution: 'Silakan lakukan login ulang untuk melanjutkan.',
  },

  // GPS Geofence Errors (GPS_xxx)
  GPS_001: {
    code: 'GPS_001',
    message: 'Akses lokasi GPS tidak diaktifkan pada HP Anda.',
    solution: 'Aktifkan GPS / Lokasi pada pengaturan HP Anda lalu refresh halaman.',
  },
  GPS_002: {
    code: 'GPS_002',
    message: 'Posisi Anda berada di luar area lokasi sekolah.',
    solution: 'Mendekatlah ke papan QR Code di lingkungan area sekolah.',
  },
  GPS_003: {
    code: 'GPS_003',
    message: 'Terdeteksi indikasi penggunaan Fake GPS / lokasi tiruan.',
    solution: 'Matikan aplikasi pihak ketiga peniru lokasi atau fitur geolocation override browser Anda.',
  },
  GPS_004: {
    code: 'GPS_004',
    message: 'Akurasi sinyal GPS HP Anda terlalu rendah (> 50 meter).',
    solution: 'Pastikan Anda berada di area terbuka (outdoor) atau nyalakan Wi-Fi untuk meningkatkan presisi lokasi.',
  },

  // Attendance & QR Errors (ATT_xxx / QR_xxx)
  QR_001: {
    code: 'QR_001',
    message: 'Izin kamera ditolak oleh browser HP Anda.',
    solution: 'Buka izin kamera di browser (klik ikon gembok di URL bar).',
  },
  QR_002: {
    code: 'QR_002',
    message: 'QR Code telah kedaluwarsa atau tidak valid.',
    solution: 'Pindai ulang QR Code terbaru yang tampil di layar sekolah.',
  },
  ATT_001: {
    code: 'ATT_001',
    message: 'Anda sudah melakukan absensi masuk hari ini.',
    solution: 'Absensi masuk hanya diperbolehkan 1 kali per hari.',
  },
  ATT_002: {
    code: 'ATT_002',
    message: 'Waktu absensi pulang belum dibuka.',
    solution: 'Absensi pulang dapat dilakukan mulai pukul 15.30 WIB.',
  },
  ATT_005: {
    code: 'ATT_005',
    message: 'Anda sudah melakukan absensi masuk hari ini.',
    solution: 'Absensi hanya dapat dilakukan 1 kali untuk jam masuk.',
  },

  // Leave Management Errors (LEV_xxx)
  LEV_001: {
    code: 'LEV_001',
    message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.',
    solution: 'Periksa kembali rentang tanggal pengajuan izin Anda.',
  },
  LEV_002: {
    code: 'LEV_002',
    message: 'Tanggal pengajuan jatuh pada hari libur sekolah / nasional.',
    solution: 'Pilih tanggal efektif hari kerja sekolah.',
  },
  LEV_003: {
    code: 'LEV_003',
    message: 'Pengajuan bertabrakan dengan izin lain yang masih aktif.',
    solution: 'Periksa riwayat pengajuan izin Anda yang belum selesai.',
  },
  LEV_004: {
    code: 'LEV_004',
    message: 'Alasan pengajuan izin wajib diisi minimal 10 karakter.',
    solution: 'Tuliskan keterangan alasan pengajuan yang jelas.',
  },

  // System & Network Errors (SYS_xxx)
  SYS_001: {
    code: 'SYS_001',
    message: 'Koneksi internet terputus atau tidak stabil.',
    solution: 'Absensi akan disimpan di memori HP dan otomatis terkirim saat sinyal pulih.',
  },
  SYS_002: {
    code: 'SYS_002',
    message: 'Server Google Apps Script sedang tidak merespons (Timeout).',
    solution: 'Klik tombol [ 🔄 Coba Lagi ] untuk mengulang transaksi.',
  },
} as const;

export const getErrorDefinition = (code: string): ErrorDefinition => {
  return (
    ERROR_CODES[code] || {
      code: code || 'SYS_999',
      message: 'Terjadi kesalahan sistem yang tidak terduga.',
      solution: 'Silakan coba beberapa saat lagi atau hubungi Operator.',
    }
  );
};
