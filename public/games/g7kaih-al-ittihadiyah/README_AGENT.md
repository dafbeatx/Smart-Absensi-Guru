# G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah (Bundle Project)

Paket ini sudah dipisahkan agar langsung siap dimasukkan ke repository existing (yang sudah memiliki Three.js) dan mudah dipahami/dimodifikasi oleh AI Coding Agent.

## Struktur File di Dalam Bundle
- `index.html` : Entry point HTML modular (memanggil `styles.css` & `game.js`).
- `styles.css` : Seluruh CSS tata letak HUD, PID touchscreen, modal, dan palet warna alami (tanpa warna neon).
- `game.js` : Seluruh engine 3D Three.js POV, rumah 4 kamar + ruang servis realistis, karakter keluarga hidup, Masjid Al-Ikhlas (*walk-in* + NPC sholat Subuh 04:05 WIB), minimap bulat, joystick PointerEvents, dan 4 Chapter misi G7KAIH.
- `g7kaih_standalone.html` : Versi 1 file mandiri (bisa langsung double-click dibuka di browser atau PID).
- `agent_manifest.json` : Peta koordinat & arsitektur JSON untuk dibaca langsung oleh AI Agent.

## Cara Integrasi ke Project yang Sudah Ada Three.js
1. Salin `styles.css`, `game.js`, dan markup dari `index.html` ke folder proyekmu (misal `public/` atau `src/g7kaih/`).
2. Jika memakai bundler (Vite / Webpack / React / Vanilla TS) dengan `npm install three`:
   ```js
   import * as THREE from "three";
   window.THREE = THREE;
   import "./game.js";
   ```
3. Pastikan menghapus tag `<script src="...three.min.js">` CDN di `index.html` jika sudah memakai Three.js lokal agar tidak dobel.

## Panduan Singkat untuk AI Agent Saat Mengembangkan Lanjut
- **Desain Visual**: Dilarang memakai warna neon. Pertahankan palet hangat pagi hari (`#F5EFE4`, `#2A2119`, `#8C7056`, `#D9A043`, `#3B5946`, `#9E472A`).
- **Ergonomi PID**: Minimap bulat tetap di kiri bawah, Virtual Joystick + tombol aksi di kanan bawah, dan kontrol menggunakan `PointerEvent` agar mendukung jari layar sentuh PID sekaligus mouse PC.
- **Pintu & Tabrakan**: Gunakan `createHingedDoor(...)` untuk pintu baru dan `addCollider(x, z, w, d)` untuk objek padat.