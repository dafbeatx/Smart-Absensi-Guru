import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📜 Syarat & Ketentuan Presensi Guru"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-slate-700 text-xs sm:text-sm">
        {/* Intro Alert */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
          <span className="text-lg shrink-0">ℹ️</span>
          <p className="text-xs text-emerald-900 leading-relaxed font-medium">
            Syarat dan Ketentuan ini berlaku bagi seluruh Pendidik dan Tenaga Kependidikan dalam penggunaan aplikasi <strong>Smart Absensi Guru</strong>.
          </p>
        </div>

        {/* Section 1 */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-extrabold text-[#023246] flex items-center gap-1.5 text-xs sm:text-sm">
            <span>1.</span> Ketentuan Umum Presensi Digital
          </h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs leading-relaxed pl-1">
            <li>Guru wajib melakukan presensi masuk dan presensi pulang sesuai dengan jam kerja yang ditetapkan sekolah.</li>
            <li>Presensi dianggap sah apabila berhasil diverifikasi melalui pemindaian <strong>QR Code Resmi Sekolah</strong> dan lokasi GPS terdeteksi aktif.</li>
            <li>Keterlambatan atau kepulangan awal akan tercatat secara otomatis oleh sistem presensi.</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-extrabold text-[#023246] flex items-center gap-1.5 text-xs sm:text-sm">
            <span>2.</span> Keamanan Akun & Binding Perangkat (HP)
          </h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs leading-relaxed pl-1">
            <li>Satu akun Guru terikat secara eksklusif pada <strong>1 (satu) perangkat HP</strong> (Device Binding) untuk mencegah penyalahgunaan.</li>
            <li>PIN 6-digit rahasia menjadi tanggung jawab pribadi Guru dan tidak boleh diberitahukan kepada orang lain.</li>
            <li>Apabila terjadi pergantian HP atau perangkat rusak, Guru wajib mengajukan reset binding HP ke Admin/Operator sekolah.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-extrabold text-[#023246] flex items-center gap-1.5 text-xs sm:text-sm">
            <span>3.</span> Ketentuan Lokasi GPS & Radius Geofence
          </h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs leading-relaxed pl-1">
            <li>Presensi hanya dapat dilakukan jika berada di dalam <strong>Radius Geofence Sekolah</strong> yang telah ditentukan.</li>
            <li>Penggunaan aplikasi manipulasi lokasi (<em>Fake GPS / Mock Location</em>) dilarang keras dan akan dicatat sebagai bentuk pelanggaran disiplin.</li>
            <li>Pastikan GPS/Lokasi HP diaktifkan dengan mode akurasi tinggi sebelum melakukan scan QR Code.</li>
          </ul>
        </div>

        {/* Section 4 */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-extrabold text-[#023246] flex items-center gap-1.5 text-xs sm:text-sm">
            <span>4.</span> Pengajuan Izin / Cuti & Koreksi Absen
          </h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs leading-relaxed pl-1">
            <li>Pengajuan Izin/Cuti dilakukan melalui fitur di aplikasi dengan melampirkan alasan sah dan dokumen pendukung (bila diperlukan).</li>
            <li>Seluruh permohonan Cuti/Izin membutuhkan persetujuan resmi dari <strong>Kepala Sekolah</strong>.</li>
            <li>Permohonan koreksi absen wajib diajukan maksimal <strong>3 x 24 jam</strong> setelah terjadinya kendala presensi.</li>
          </ul>
        </div>

        {/* Section 5 */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-extrabold text-[#023246] flex items-center gap-1.5 text-xs sm:text-sm">
            <span>5.</span> Kerahasiaan Data & Log Audit
          </h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs leading-relaxed pl-1">
            <li>Seluruh data presensi dan aktivitas pengguna dicatat dalam <em>Immutable Audit Log</em> untuk menjamin transparansi data.</li>
            <li>Data pribadi Guru dilindungi dan hanya dipergunakan untuk keperluan administrasi dan kepegawaian sekolah.</li>
          </ul>
        </div>

        {/* Footer Note */}
        <div className="pt-2 text-center text-[11px] text-slate-500 font-semibold border-t border-slate-200">
          Sistem Smart Absensi Guru &copy; 2026 — Tim Pengembang & Manajemen Sekolah
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 flex justify-end">
        <Button variant="primary" onClick={onClose} className="w-full sm:w-auto font-bold text-xs">
          Saya Mengerti & Paham
        </Button>
      </div>
    </Modal>
  );
};
