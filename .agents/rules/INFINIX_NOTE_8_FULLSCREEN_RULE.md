# 📱 Mobile Full-Screen & Infinix Note 8 Precision Rule (Always-On Mandate)

> **Activation Mode**: **ALWAYS ON** (Berlaku otomatis untuk seluruh pengerjaan fitur baru, pembaruan antarmuka, dan perbaikan UI).  
> **Target Device Utama**: Layar smartphone **Infinix Note 8** (6.95 inci, resolusi 720 × 1640 px, rasio 20.5:9, viewport CSS ~360–412 px lebar, ~800–892 px tinggi) serta seluruh layar mobile Android/iOS guru.  
> **Mandat Mutlak**: **HARAM MEMBUAT FLOATING POPUP / CENTERED MODAL DI TAMPILAN MOBILE.** Seluruh fitur, wizard, formulir, kartu asesmen, dan panel administrasi WAJIB tampil **Full-Screen Viewport (`100dvh`)** yang pas, responsif, dan ergonomis di genggaman satu tangan.

---

## 1. Latar Belakang & Larangan Keras (The Anti-Popup Rule)

### ❌ Mengapa Floating Popup Dilarang di HP Infinix Note 8:
1. **Viewport Terjepit**: Popup mengambang di tengah layar dengan margin 16px–24px menyisakan ruang efektif yang sangat sempit di HP (~320px lebar).
2. **Double Scroll Trap**: Pengguna harus berjuang menggeser konten di dalam modal sambil layar belakang (backdrop) ikut bergeser secara tidak sengaja.
3. **Tertutup Keyboard & Navigasi Sistem**: Tombol aksi ("Simpan", "Lanjut", "Kirim") di bagian bawah modal sering terpotong atau tenggelam di balik virtual keyboard dan gesture bar Android.
4. **Kesan Tidak Profesional**: Dialog kecil mengambang di layar ponsel memberikan kesan aplikasi belum matang / template web desktop yang dipaksakan ke mobile.

---

## 2. Arsitektur Layout Wajib (Full-Screen Page Sheet Pattern)

Di mobile (`< md` atau `< 768px`), setiap komponen interaktif (pembuat soal, formulir izin, koreksi lembar ujian, rekap kehadiran, scanner) WAJIB menggunakan struktur **3-Zone Full Viewport**:

```
┌────────────────────────────────────────────────────────┐
│ 1. STICKY HEADER (Top Navigation)                      │  <- h-14 / 56px, Sticky Top, Safe Area Top
├────────────────────────────────────────────────────────┤
│                                                        │
│ 2. SCROLLABLE WORKSPACE (Main Content)                 │  <- flex-1, overflow-y-auto, px-4 py-4
│    - Lebar konten: w-full max-w-lg mx-auto             │  <- Pas di layar Infinix Note 8 (720x1640)
│    - Padding kartu & form: 14-16px                     │  <- Tidak ada scroll horizontal
│    - Input text: min-h-[44px], font 16px               │
│                                                        │
├────────────────────────────────────────────────────────┤
│ 3. STICKY ACTION BAR (Thumb Zone / Footer)             │  <- Sticky Bottom, Safe Area Bottom
│    - Tombol CTA: h-12 (48px) Full Width                │  <- Mudah dijangkau jempol satu tangan
└────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Teknis & Dimensi Presisi (Infinix Note 8 Standard)

| Komponen / Properti | Nilai Mobile (Infinix Note 8) | Catatan Khusus Tailwind / CSS |
| :--- | :--- | :--- |
| **Container Height** | **`100dvh`** (`h-[100dvh]`) | Wajib `dvh` (Dynamic Viewport Height) agar tidak tertutup address bar browser mobile. |
| **Container Width** | **`100vw` / `w-full`** | Di mobile dilarang menggunakan margin samping luar (`m-0 rounded-none`). |
| **Safe Area Inset** | `env(safe-area-inset-*)` | `pt-[max(12px,env(safe-area-inset-top))]`, `pb-[max(12px,env(safe-area-inset-bottom))]`. |
| **Tinggi Header** | **`56px`** (`h-14`) | Sticky di `top-0`, `backdrop-blur-md`, z-index `z-20` atau `z-30`. |
| **Tombol Header (Back/Close)** | **`44 × 44px`** | Touch target jempol wajib &ge; 44px (`w-11 h-11 flex items-center justify-center`). |
| **Tinggi Tombol Utama (CTA)** | **`44–48px`** (`h-11` atau `h-12`) | Lebar penuh (`w-full` atau `flex-1`), font-bold, radius `rounded-xl`. |
| **Ukuran Font Input Form** | **`16px`** (`text-base` di mobile) | **WAJIB &ge; 16px** untuk mencegah browser iOS/Android auto-zoom paksa saat fokus input. |
| **Padding Halaman Konten** | **`16px`** (`px-4 py-4`) | Pas di kerapatan layar Infinix Note 8 tanpa teks menyentuh pinggiran kaca layar. |
| **Radius Card Konten** | **`12px–16px`** (`rounded-xl`) | Card di dalam konten tetap rounded rapi; container luar di mobile tetap `rounded-none`. |

---

## 4. Template Standar Komponen (Responsive Mobile-Full, Desktop-Modal)

Setiap modal/fitur interaktif baru WAJIB mengikuti pola template responsif berikut:

```tsx
import React, { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureFullView: React.FC<FeatureModalProps> = ({ isOpen, onClose }) => {
  // Cegah body scroll saat full view aktif di mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // BACKDROP & WRAPPER: Full-screen di mobile, Elegan di Desktop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* MAIN CONTAINER: 100dvh & w-full di mobile; rounded-2xl & max-w-2xl di desktop */}
      <div className="w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-2xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* 1. STICKY HEADER */}
        <header className="h-14 sm:h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5 md:hidden" />
              <X className="w-5 h-5 hidden md:block" />
            </button>
            <div className="truncate">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                Judul Fitur Utama
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Deskripsi atau indikator langkah
              </p>
            </div>
          </div>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          <div className="w-full max-w-lg mx-auto space-y-4">
            
            {/* Kartu Konten */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Nama Form Input
              </label>
              {/* Note: text-base (16px) di mobile mencegah auto-zoom Android/iOS */}
              <input
                type="text"
                placeholder="Masukkan keterangan..."
                className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
              />
            </div>

          </div>
        </main>

        {/* 3. STICKY ACTION BAR (THUMB ZONE) */}
        <footer className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0 z-20 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 sm:h-12 px-4 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {/* action */}}
            className="flex-1 h-11 sm:h-12 px-4 rounded-xl bg-[#023246] hover:bg-[#023246]/90 text-white text-xs sm:text-sm font-bold shadow-md shadow-[#023246]/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Simpan Perubahan
          </button>
        </footer>

      </div>
    </div>
  );
};
```

---

## 5. Checklist Validasi Wajib Sebelum Push (Agent Self-Review)

Sebelum menyatakan tugas pembuatan/pembaruan fitur selesai, jalankan checklist ini:
- [ ] **Bukan Popup Melayang di Mobile**: Apakah di layar lebar `< 768px` komponen memenuhi layar tanpa batas margin/backdrop kosong di kiri/kanan?
- [ ] **Tinggi Dinamis 100dvh**: Apakah menggunakan `h-[100dvh]` dan bukan `h-screen` murni (yang sering terpotong oleh browser bar mobile)?
- [ ] **Sticky Action Bar**: Apakah tombol simpan/aksi utama menempel di bagian bawah viewport dan langsung terlihat tanpa harus scroll panjang mencari tombol submit?
- [ ] **Pencegahan Double-Scroll**: Apakah saat modal dibuka, scrolling halaman belakang (`document.body.style.overflow = 'hidden'`) terkunci rapat?
- [ ] **Sentuhan Ergonomis**: Apakah tombol dan input memiliki tinggi minimum 44px agar ramah jempol satu tangan di HP Infinix Note 8?
- [ ] **Zero Horizontal Overflow**: Apakah tidak ada elemen yang meluap ke samping (`overflow-x-hidden` atau pembatasan teks `truncate`)?
