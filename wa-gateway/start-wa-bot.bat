@echo off
title Smart Absensi Guru - WhatsApp Gateway Bot
color 0A

echo ================================================================
echo    SMART ABSENSI GURU - WHATSAPP GATEWAY (BAILEYS MULTI-DEVICE)
echo    100%% GRATIS - BEBAS KARTU KREDIT - TEXT-ONLY PRIVACY SAFE
echo ================================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Menginstal dependensi pertama kali...
    call npm install
)

set PORT=3000
set GATEWAY_SECRET=SmataWaSecure2026
set TZ=Asia/Jakarta

echo [1/3] Menjalankan WhatsApp Bot Server pada port 3000...
start /b node server.js

echo.
echo [2/3] Membuka halaman Scan QR di browser Anda...
timeout /t 3 >nul
start http://localhost:3000/qr

echo.
echo [3/3] Membuka Terowongan HTTPS Publik Gratis (Localtunnel)...
echo ================================================================
echo  CATATAN:
echo  1. Scan kode QR yang muncul di browser dengan WhatsApp HP Anda.
echo  2. Salin URL publik HTTPS di bawah ini untuk dimasukkan ke Vercel:
echo     - Variabel WA_GATEWAY_URL di Vercel: (Lihat URL HTTPS di bawah)
echo     - Variabel WA_GATEWAY_SECRET: SmataWaSecure2026
echo ================================================================
echo.

call npx localtunnel --port 3000
pause
