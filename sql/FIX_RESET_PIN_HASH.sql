-- ============================================================================
-- SMART ABSENSI GURU — FIX: Reset Semua PIN ke Default (123456)
-- ============================================================================
-- MASALAH: Hash PIN yang tersimpan di database dibuat oleh tool/script lain
-- yang menggunakan algoritma hashing berbeda dari aplikasi (SHA-256 Web Crypto).
-- Akibatnya, login selalu gagal meskipun PIN benar.
--
-- SOLUSI: Update semua pin_hash ke SHA-256('123456') yang valid.
-- Setelah menjalankan ini, semua user bisa login dengan PIN: 123456
-- Kemudian mereka bisa ganti PIN melalui fitur "Ubah PIN" di aplikasi.
--
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- SHA-256 hash dari PIN '123456' = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
UPDATE public.users
SET pin_hash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
WHERE account_status = 'ACTIVE';

-- Verifikasi: cek hasilnya
SELECT id, full_name, phone_number, LEFT(pin_hash, 12) || '...' AS pin_hash_prefix, account_status
FROM public.users
ORDER BY full_name;
