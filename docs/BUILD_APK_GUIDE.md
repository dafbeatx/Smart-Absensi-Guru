# Panduan Kompilasi APK Release & Penandatanganan Keystore (Smart-Absensi-Guru)

Dokumen ini menyediakan panduan lengkap mengenai cara mengompilasi aplikasi **Smart-Absensi-Guru** menjadi file **`.apk` Release** yang aman dari pemblokiran **Google Play Protect**.

---

## 🔑 1. Membuat Keystore Penandatanganan (Release Key)

Jalankan perintah berikut di Terminal / PowerShell untuk membuat file Keystore resmi aplikasi:

```bash
keytool -genkey -v -keystore android/app/release-key.keystore -alias smartabsensi -keyalg RSA -keysize 2048 -validity 10000
```
* **Keterangan:** Anda akan diminta memasukkan password keystore, nama organisasi/sekolah, dan lokasi.
* **Format Penandatanganan:** Otomatis mendukung **APK Signature Scheme v1 & v2** agar tidak ditandai sebagai aplikasi berbahaya pada Android 11+.

---

## ⚙️ 2. Konfigurasi `key.properties`

1. Masuk ke folder `android/app/`.
2. Buat file baru bernama `key.properties` (atau salin dari `key.properties.example`):
   ```properties
   storePassword=password_keystore_anda
   keyPassword=password_alias_anda
   keyAlias=smartabsensi
   storeFile=release-key.keystore
   ```

---

## 🛠️ 3. Kompilasi APK via Android Studio / Command Line

### Opsi A: Via Android Studio (Rekomendasi Grafis)
1. Buka folder `android/` di **Android Studio**.
2. Tunggu proses *Gradle Sync* selesai.
3. Pilih menu **Build > Generate Signed Bundle / APK**.
4. Pilih **APK** > Masukkan lokasi `release-key.keystore` dan password.
5. Centang **V1 (JAR Signature)** dan **V2 (Full APK Signature)**.
6. Klik **Create** / **Finish**. File `.apk` akan siap di folder `android/app/release/`.

### Opsi B: Via Terminal CLI
```bash
# 1. Build web asset terbaru
npm run build

# 2. Sinkronkan ke Android
npx cap sync android

# 3. Pindah ke folder android dan jalankan gradlew assembleRelease
cd android
./gradlew assembleRelease
```
* **Hasil Build APK Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
* **Hasil Build APK Release:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 🛡️ 4. Pengujian & Penanganan Google Play Protect saat Sideloading

Jika file `.apk` dipasang langsung di HP (sideloading via WhatsApp/Flashdisk) dan Play Protect menampilkan dialog *"Blocked by Play Protect"*:

1. **Pengujian Lokal:** Pada dialog peringatan di HP, tekan **Detail Selengkapnya (More details)** > **Tetap pasang (Install anyway)**.
2. **Distribusi Resmi Sekolah:** Daftarkan hash sertifikat Keystore Anda ke formulir banding resmi Google Play Protect agar tidak muncul peringatan sama sekali bagi pengguna lain:
   👉 **[Formulir Google Play Protect Developer Appeals](https://support.google.com/googleplay/android-developer/contact/protectappeals)**
