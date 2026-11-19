/**
 * G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah (Engine POV 3D)
 * -----------------------------------------------------------------
 * Catatan Integrasi Project Existing (Vite / Webpack / Node + Three.js):
 * - Script ini menggunakan global `THREE` (Three.js r128+).
 * - Jika di project kamu Three.js di-import lewat ES Module:
 *     import * as THREE from "three";
 *     window.THREE = THREE;
 *     import "./game.js";
 */
(function () {
      'use strict';

      // =======================================================================
      // A. AUDIO EFEK SEDERHANA (WEB AUDIO API TANPA URL EKSTERNAL)
      // =======================================================================
      const sfx = {
        ctx: null,
        init() {
          try {
            if (!this.ctx) {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
          } catch (e) { /* Abaikan jika diblokir browser */ }
        },
        playTone(freq, type = 'sine', dur = 0.14, vol = 0.12) {
          try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + dur);
          } catch (e) { /* Aman */ }
        },
        playInteract() {
          this.playTone(520, 'triangle', 0.11, 0.12);
          setTimeout(() => this.playTone(700, 'triangle', 0.14, 0.11), 75);
        },
        playCoin() {
          this.playTone(780, 'sine', 0.1, 0.11);
          setTimeout(() => this.playTone(1040, 'sine', 0.18, 0.12), 90);
        },
        playChapter() {
          [440, 554, 659, 880].forEach((f, idx) => {
            setTimeout(() => this.playTone(f, 'triangle', 0.22, 0.12), idx * 105);
          });
        }
      };

      // =======================================================================
      // B. STATE PERMAINAN & JADWAL SUBUH HARI INI (KAMIS, 19 NOV 2026)
      //    Kemenag RI Kab. Bogor / Ciampea:
      //    Imsak 03:55 | Subuh 04:05 | Syuruq 05:22 | Dzuhur 11:42 | Ashar 15:03
      // =======================================================================
      const SUBUH_START_MIN = 4 * 60 + 5;  // 04:05 WIB
      const SUBUH_END_MIN = 5 * 60 + 22;   // 05:22 WIB

      const HABIT_DESCRIPTIONS = {
        1: 'Bangun Pagi: Melatih kedisiplinan, mengendalikan waktu, dan menyegarkan otak sebelum belajar.',
        2: 'Beribadah: Memulai hari dengan syukur, ketenangan hati, dan doa di Mushola / Masjid.',
        3: 'Berolahraga: Menguatkan fisik, melancarkan peredaran darah, dan menambah kapasitas energi.',
        4: 'Makan Sehat & Bergizi: Memberi nutrisi terbaik agar fokus belajar sepanjang hari.',
        5: 'Gemar Belajar: Menyiapkan perlengkapan sekolah dan membaca materi dengan antusias.',
        6: 'Bermasyarakat: Sopan kepada tetangga, menjaga kebersihan lingkungan, dan memilih pergaulan baik.',
        7: 'Tidur Cepat: Istirahat cukup maksimal pukul 21:00 WIB agar esok hari kembali bugar.'
      };

      const CHAPTER_EDU = {
        1: {
          title: 'Chapter 1 Tuntas: Pagi yang Disiplin!',
          text: 'Hebat! Kamu sudah mempraktikkan Kebiasaan 1 (Bangun Pagi pukul 04:05 WIB) dan Kebiasaan 2 (Beribadah Subuh). Bangun pagi dan beribadah membuat pikiran tenang, hati lapang, dan siap menghadapi hari dengan penuh semangat.'
        },
        2: {
          title: 'Chapter 2 Tuntas: Tubuh Kuat, Otak Siap!',
          text: 'Luar biasa! Kamu sudah menjalankan Kebiasaan 3 (Berolahraga Pagi) sehingga kapasitas energi meningkat, serta Kebiasaan 4 (Makan Sehat & Bergizi) untuk menjaga konsentrasi belajar di kelas.'
        },
        3: {
          title: 'Chapter 3 Tuntas: Bekal Ilmu & Peduli Sesama!',
          text: 'Keren! Kebiasaan 5 (Gemar Belajar) dibuktikan dengan menyiapkan buku & tas sekolah, dan Kebiasaan 6 (Bermasyarakat) terlihat dari sikap ramah pada warga, menjaga kebersihan, dan tegas menolak ajakan bolos.'
        }
      };

      const MISSION_STEPS = [
        {
          chapter: 1,
          zone: 'Zona 1: Kamar Saya (Tengah Kiri)',
          title: 'Kebiasaan 1: Bangun Pagi & Rapikan Kasur',
          hint: 'Dekati kasur & jam alarm di Kamar Saya, lalu tekan [INTERAKSI (E)].',
          targetId: 'bed_alarm',
          targetPos: { x: -8.6, z: 9.8 }
        },
        {
          chapter: 1,
          zone: 'Zona 1: Kamar Mandi (Koridor Belakang)',
          title: 'Kebiasaan 2a: Berwudhu di Kamar Mandi',
          hint: 'Buka pintu Kamar Saya ke Ruang Keluarga, lalu pergi ke Kamar Mandi di pojok belakang kiri.',
          targetId: 'wudhu_tap',
          targetPos: { x: -8.6, z: 16.0 }
        },
        {
          chapter: 1,
          zone: 'Zona 1: Mushola Rumah / Masjid Al-Ikhlas',
          title: 'Kebiasaan 2b: Sholat Subuh Berjamaah / Mushola',
          hint: 'Sholat Subuh di Mushola Keluarga (tengah belakang) ATAU keluar rumah menuju Masjid Al-Ikhlas (+bonus)!',
          targetId: 'prayer_mat',
          targetPos: { x: 0.6, z: 16.0 }
        },
        {
          chapter: 2,
          zone: 'Zona 2: Jalan Komplek (Pos Ronda)',
          title: 'Kebiasaan 3a: Lari Pagi ke Pos Ronda',
          hint: 'Keluar lewat Pintu Utama rumah dan berlari pagi menyentuh lingkaran emas di depan Pos Ronda.',
          targetId: 'jog_cp_1',
          targetPos: { x: -4.2, z: -12.0 }
        },
        {
          chapter: 2,
          zone: 'Zona 2: Persimpangan Jalan Komplek',
          title: 'Kebiasaan 3b: Lari Pagi ke Persimpangan',
          hint: 'Lanjutkan joging sedikit ke utara menuju lingkaran emas kedua agar stamina makin kuat!',
          targetId: 'jog_cp_2',
          targetPos: { x: 0.0, z: -28.0 }
        },
        {
          chapter: 2,
          zone: 'Zona 2: Ruang Makan Keluarga',
          title: 'Kebiasaan 4: Makan Sehat & Bergizi',
          hint: 'Kembali ke Ruang Makan di dalam rumah (dekat Dapur Bunda) untuk memilih menu sarapan sehat!',
          targetId: 'dining_table',
          targetPos: { x: 2.0, z: 10.6 }
        },
        {
          chapter: 3,
          zone: 'Zona 3: Meja Belajar Kamar Saya',
          title: 'Kebiasaan 5: Gemar Belajar & Cek Buku Tas',
          hint: 'Masuk kembali ke Kamar Saya dan periksa buku paket serta tas sekolah di meja belajar.',
          targetId: 'study_desk',
          targetPos: { x: -5.8, z: 11.4 }
        },
        {
          chapter: 3,
          zone: 'Zona 3: Jalan Desa Menuju Sekolah',
          title: 'Kebiasaan 6a: Sapa Pak RT di Jalan',
          hint: 'Berangkat ke sekolah! Di jalan desa, dekati Pak RT di depan rumah warga untuk menyapa sopan.',
          targetId: 'greet_rt',
          targetPos: { x: -5.8, z: -42.0 }
        },
        {
          chapter: 3,
          zone: 'Zona 3: Dekat Warung Bu Siti',
          title: 'Kebiasaan 6b: Buang Sampah pada Tempatnya',
          hint: 'Ada botol plastik di dekat tong sampah samping Warung Bu Siti. Pungut & buang ke tempatnya!',
          targetId: 'trash_bin',
          targetPos: { x: 5.5, z: -62.0 }
        },
        {
          chapter: 3,
          zone: 'Zona 3: Simpang Menuju Jalan Utama',
          title: 'Kebiasaan 6c: Tanggapi Ajakan Teman Nongkrong',
          hint: 'Temanmu mengajak mampir main dulu sebelum sekolah. Berikan keputusan anak hebat!',
          targetId: 'friend_tempt',
          targetPos: { x: -5.0, z: -84.0 }
        },
        {
          chapter: 4,
          zone: 'Zona 4: SMP Terpadu Al-Ittihadiyah',
          title: 'Final Quest: Tiba di Gerbang SMP Terpadu Al-Ittihadiyah',
          hint: 'Menyeberang zebra cross dan bersalaman dengan Guru Piket di depan gerbang sekolah sebelum 07:00!',
          targetId: 'school_gate',
          targetPos: { x: 0.0, z: -112.0 }
        }
      ];

      const gameState = {
        started: false,
        paused: true,
        chapter: 1,
        stepIndex: 0,
        gameMinutes: SUBUH_START_MIN, // 04:05 WIB
        money: 20000,
        energy: 100,
        maxEnergy: 100,
        characterScore: 0,
        donatedMosque: false,
        completedHabits: new Set(),
        greetedFamily: new Set(),
        player: {
          x: -7.2,
          y: 1.65,
          z: 10.2,
          yaw: -Math.PI / 2, // Menghadap arah Timur (ke pintu kamar & ruang keluarga)
          pitch: 0,
          speedWalk: 5.2,
          speedSprint: 8.2,
          sprinting: false,
          bobTimer: 0
        }
      };

      // =======================================================================
      // C. REFERENSI DOM UI
      // =======================================================================
      const dom = {
        canvasContainer: document.getElementById('canvas-container'),
        hudLayer: document.getElementById('hud-layer'),
        crosshair: document.getElementById('crosshair'),
        interactPrompt: document.getElementById('interact-prompt'),
        toastBox: document.getElementById('toast-box'),
        startScreen: document.getElementById('start-screen'),
        choiceModal: document.getElementById('choice-modal'),
        choiceTag: document.getElementById('choice-tag'),
        choiceTitle: document.getElementById('choice-title'),
        choiceDesc: document.getElementById('choice-desc'),
        choiceList: document.getElementById('choice-list'),
        chapterModal: document.getElementById('chapter-modal'),
        chapterModalTitle: document.getElementById('chapter-modal-title'),
        chapterModalEdu: document.getElementById('chapter-modal-edu'),
        reportModal: document.getElementById('report-modal'),
        reportArrivalTime: document.getElementById('report-arrival-time'),
        reportScore: document.getElementById('report-score'),
        reportMoney: document.getElementById('report-money'),
        reportEnergy: document.getElementById('report-energy'),
        reportHabitsSummary: document.getElementById('report-habits-summary'),
        hudChapterBadge: document.getElementById('hud-chapter-badge'),
        hudZone: document.getElementById('hud-zone'),
        hudMissionTitle: document.getElementById('hud-mission-title'),
        hudMissionHint: document.getElementById('hud-mission-hint'),
        hudClock: document.getElementById('hud-clock'),
        hudMoney: document.getElementById('hud-money'),
        hudScore: document.getElementById('hud-score'),
        hudEnergyText: document.getElementById('hud-energy-text'),
        energyFill: document.getElementById('energy-fill'),
        btnStart: document.getElementById('btn-start'),
        btnInteract: document.getElementById('btn-interact'),
        btnSprint: document.getElementById('btn-sprint'),
        btnSprintLabel: document.getElementById('btn-sprint-label'),
        btnNextChapter: document.getElementById('btn-next-chapter'),
        btnRestart: document.getElementById('btn-restart'),
        btnDownloadZip: document.getElementById('btn-download-zip'),
        btnExportHud: document.getElementById('btn-export-hud'),
        joystickZone: document.getElementById('joystick-zone'),
        joystickKnob: document.getElementById('joystick-knob'),
        minimapCanvas: document.getElementById('minimap-canvas')
      };

      let toastTimer = null;
      function showToast(msg, duration = 3600) {
        dom.toastBox.textContent = msg;
        dom.toastBox.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => dom.toastBox.classList.remove('show'), duration);
      }

      function formatClock(totalMins) {
        const m = Math.floor(totalMins) % (24 * 60);
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      }

      function formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
      }

      // =======================================================================
      // D. INISIALISASI THREE.JS, PENCAHAYAAN & LANGIT SUBUH DINAMIS
      // =======================================================================
      let renderer, scene, camera;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35)); // Optimasi FPS PID 4K
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        dom.canvasContainer.appendChild(renderer.domElement);
      } catch (err) {
        showToast('Perangkat WebGL tidak tersedia pada browser ini.');
        return;
      }

      scene = new THREE.Scene();
      const skySubuh = new THREE.Color('#131A2B');
      const skyFajar = new THREE.Color('#D59668');
      const skyPagi = new THREE.Color('#9EC1D6');
      const currentSky = skySubuh.clone();
      scene.background = currentSky.clone();
      scene.fog = new THREE.Fog(currentSky.clone(), 28, 125);

      camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 220);
      camera.rotation.order = 'YXZ';

      // Pencahayaan Alami
      const hemiLight = new THREE.HemisphereLight('#B8C9DE', '#4B3E32', 0.42);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight('#FFE4B8', 0.22);
      sunLight.position.set(28, 14, 18);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 150;
      sunLight.shadow.camera.left = -45;
      sunLight.shadow.camera.right = 45;
      sunLight.shadow.camera.top = 45;
      sunLight.shadow.camera.bottom = -45;
      scene.add(sunLight);

      // Hamparan Bintang Subuh (Terlihat saat 04:05 - 05:15 WIB)
      const starCount = 260;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.42;
        const r = 135;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = 18 + r * Math.cos(phi);
        starPositions[i * 3 + 2] = -35 + r * Math.sin(phi) * Math.sin(theta);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({ color: '#FFF6DC', size: 1.4, transparent: true, opacity: 0.9 });
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      const warmLights = [];
      function addWarmLamp(x, y, z, intensity = 1.3, distance = 13, showBulb = true) {
        const light = new THREE.PointLight('#FFDFAA', intensity, distance, 1.5);
        light.position.set(x, y, z);
        scene.add(light);
        if (showBulb) {
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#FFF3CE' })
          );
          bulb.position.set(x, y + 0.08, z);
          scene.add(bulb);
        }
        warmLights.push({ light, baseIntensity: intensity });
        return light;
      }

      function updateSkyByTime() {
        const m = gameState.gameMinutes;
        // 04:05 (245) - 04:55 (295): Subuh Gelap Berbintang
        // 04:55 (295) - 05:30 (330): Fajar Keemasan menuju Matahari Terbit (05:22)
        // 05:30 (330) - 07:00 (420): Pagi Cerah Alami
        if (m <= 295) {
          currentSky.copy(skySubuh);
          starField.visible = true;
          starMat.opacity = 0.92;
          hemiLight.intensity = 0.44;
          sunLight.intensity = 0.2;
          warmLights.forEach(wl => { wl.light.intensity = wl.baseIntensity; });
        } else if (m <= 330) {
          const t = (m - 295) / 35;
          currentSky.copy(skySubuh).lerp(skyFajar, t);
          starField.visible = t < 0.75;
          starMat.opacity = Math.max(0, 0.92 * (1 - t * 1.4));
          hemiLight.intensity = 0.44 + t * 0.34;
          sunLight.intensity = 0.2 + t * 0.65;
          sunLight.position.set(28, 14 + t * 22, 18 - t * 16);
          warmLights.forEach(wl => { wl.light.intensity = wl.baseIntensity * (1 - t * 0.25); });
        } else {
          const t = Math.min(1, (m - 330) / 55);
          currentSky.copy(skyFajar).lerp(skyPagi, t);
          starField.visible = false;
          hemiLight.intensity = 0.78 + t * 0.24;
          sunLight.intensity = 0.85 + t * 0.4;
          sunLight.position.set(28, 36 + t * 20, 2 - t * 22);
          warmLights.forEach(wl => { wl.light.intensity = wl.baseIntensity * (0.75 - t * 0.35); });
        }
        scene.background.copy(currentSky);
        scene.fog.color.copy(currentSky);
      }

      // =======================================================================
      // E. TEKSTUR PROSEDURAL ALAMI (KANVAS 2D - ANTI AI-SLOP & RINGAN)
      // =======================================================================
      function createProceduralTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        if (type === 'grass') {
          ctx.fillStyle = '#5F7A52';
          ctx.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 1200; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#546E48' : '#6C885D';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
          }
        } else if (type === 'asphalt') {
          ctx.fillStyle = '#4B4B4D';
          ctx.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 1400; i++) {
            const v = 64 + Math.floor(Math.random() * 26);
            ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
          }
          // Marka jalan putus-putus di tengah
          ctx.fillStyle = '#E5DFD2';
          ctx.fillRect(122, 16, 12, 92);
          ctx.fillRect(122, 148, 12, 92);
        } else if (type === 'paving') {
          ctx.fillStyle = '#B8AD9E';
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#928777';
          ctx.lineWidth = 3;
          for (let y = 0; y < 256; y += 32) {
            for (let x = 0; x < 256; x += 64) {
              const ox = (y / 32) % 2 === 0 ? 0 : 32;
              ctx.strokeRect(x + ox - 32, y, 64, 32);
            }
          }
        } else if (type === 'wall_cream') {
          ctx.fillStyle = '#EFE6D5';
          ctx.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 650; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#E7DEC9' : '#F4ECDD';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 6, 4);
          }
        } else if (type === 'tile_living') {
          ctx.fillStyle = '#E7DFCE';
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#C9BEAA';
          ctx.lineWidth = 3;
          for (let y = 0; y < 256; y += 64) {
            for (let x = 0; x < 256; x += 64) {
              ctx.strokeRect(x, y, 64, 64);
            }
          }
        } else if (type === 'tile_bath') {
          ctx.fillStyle = '#C9DFE5';
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#A0BCC5';
          ctx.lineWidth = 3;
          for (let y = 0; y < 256; y += 32) {
            for (let x = 0; x < 256; x += 32) {
              ctx.strokeRect(x, y, 32, 32);
            }
          }
        } else if (type === 'parquet') {
          ctx.fillStyle = '#A88057';
          ctx.fillRect(0, 0, 256, 256);
          for (let y = 0; y < 256; y += 32) {
            ctx.fillStyle = (y / 32) % 2 === 0 ? '#9B734B' : '#B28A60';
            ctx.fillRect(0, y, 256, 30);
            ctx.fillStyle = '#7C5938';
            ctx.fillRect(0, y + 30, 256, 2);
          }
        } else if (type === 'roof_terracotta') {
          ctx.fillStyle = '#9C4D33';
          ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#843E27';
          for (let y = 0; y < 256; y += 24) {
            ctx.fillRect(0, y, 256, 5);
          }
        } else if (type === 'wood') {
          ctx.fillStyle = '#755235';
          ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#5E4027';
          for (let y = 0; y < 256; y += 16) {
            ctx.fillRect(0, y, 256, 3);
          }
        } else if (type === 'mosque_carpet') {
          ctx.fillStyle = '#2F5C46';
          ctx.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 700; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#28503C' : '#376950';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
          }
          ctx.fillStyle = '#D9B15F';
          ctx.fillRect(0, 0, 10, 256);
          ctx.fillRect(128, 0, 10, 256);
          ctx.strokeStyle = 'rgba(229, 198, 130, 0.45)';
          ctx.lineWidth = 4;
          for (let row = 0; row < 2; row++) {
            const sx = row * 128 + 20;
            for (let y = 16; y < 256; y += 64) {
              ctx.strokeRect(sx, y, 96, 48);
            }
          }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
      }

      function createSignTexture(title, subtitle = '', bg = '#2D4739', border = '#E5B25D') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 140;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 512, 140);
        ctx.strokeStyle = border;
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, 500, 128);
        ctx.fillStyle = '#FFFDF8';
        ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, 256, subtitle ? 52 : 70);
        if (subtitle) {
          ctx.fillStyle = '#F2D9A2';
          ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(subtitle, 256, 98);
        }
        return new THREE.CanvasTexture(canvas);
      }

      function createNameTagSprite(text, bgColor = '#3B5946') {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 84;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(10, 10, 340, 64, 24);
        ctx.fill();
        ctx.strokeStyle = '#F2D794';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = '#FFFDF8';
        ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 180, 44);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(1.4, 0.33, 1);
        return sp;
      }

      function createMosqueScheduleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1E1A16';
        ctx.fillRect(0, 0, 640, 300);
        ctx.strokeStyle = '#C88A2E';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, 624, 284);
        ctx.fillStyle = '#E5B25D';
        ctx.font = '800 25px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('JADWAL SHOLAT • MASJID AL-IKHLAS', 320, 44);
        ctx.fillStyle = '#D8CCB8';
        ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Kab. Bogor / Ciampea • Kamis, 19 November 2026', 320, 74);

        const times = [
          { label: 'SUBUH', time: '04:05', active: true },
          { label: 'SYURUQ', time: '05:22', active: false },
          { label: 'DZUHUR', time: '11:42', active: false },
          { label: 'ASHAR', time: '15:03', active: false },
          { label: 'MAGHRIB', time: '17:54', active: false },
          { label: 'ISYA', time: '19:08', active: false }
        ];
        times.forEach((item, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const bx = 26 + col * 200;
          const by = 102 + row * 90;
          ctx.fillStyle = item.active ? '#3B5946' : '#2C251F';
          ctx.fillRect(bx, by, 188, 76);
          ctx.strokeStyle = item.active ? '#E5B25D' : '#6B5846';
          ctx.lineWidth = 3;
          ctx.strokeRect(bx, by, 188, 76);
          ctx.fillStyle = item.active ? '#F7E3B5' : '#C9BCA8';
          ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(item.label, bx + 94, by + 25);
          ctx.fillStyle = item.active ? '#FFFDF8' : '#E5B25D';
          ctx.font = '700 30px "Courier Prime", monospace';
          ctx.fillText(item.time, bx + 94, by + 58);
        });
        return new THREE.CanvasTexture(canvas);
      }

      function createCalligraphyTexture(arabicText, latinSub) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2B4A38';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#D9A84E';
        ctx.lineWidth = 14;
        ctx.strokeRect(10, 10, 236, 236);
        ctx.fillStyle = '#F5DFAA';
        ctx.font = '700 76px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(arabicText, 128, 112);
        ctx.fillStyle = '#E5DAC8';
        ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(latinSub, 128, 198);
        return new THREE.CanvasTexture(canvas);
      }

      // =======================================================================
      // F. MATERIAL & HELPER DUNIA 3D
      // =======================================================================
      const texGrass = createProceduralTexture('grass');
      texGrass.repeat.set(36, 56);
      const texAsphalt = createProceduralTexture('asphalt');
      texAsphalt.repeat.set(1, 22);
      const texPaving = createProceduralTexture('paving');
      texPaving.repeat.set(2, 2);
      const texWallCream = createProceduralTexture('wall_cream');
      const texTileLiving = createProceduralTexture('tile_living');
      texTileLiving.repeat.set(6, 5);
      const texTileBath = createProceduralTexture('tile_bath');
      texTileBath.repeat.set(3, 3);
      const texParquet = createProceduralTexture('parquet');
      texParquet.repeat.set(2, 2);
      const texRoof = createProceduralTexture('roof_terracotta');
      texRoof.repeat.set(4, 4);
      const texWood = createProceduralTexture('wood');
      const texMosqueCarpet = createProceduralTexture('mosque_carpet');
      texMosqueCarpet.repeat.set(3.5, 4.2);

      const matWall = new THREE.MeshStandardMaterial({ map: texWallCream, roughness: 0.85 });
      const matTileBath = new THREE.MeshStandardMaterial({ map: texTileBath, roughness: 0.48 });
      const matWood = new THREE.MeshStandardMaterial({ map: texWood, roughness: 0.78 });
      const matRoof = new THREE.MeshStandardMaterial({ map: texRoof, roughness: 0.82 });
      const matDoor = new THREE.MeshStandardMaterial({ color: '#6E4A2E', roughness: 0.72 });
      const matBrass = new THREE.MeshStandardMaterial({ color: '#D4A548', metalness: 0.55, roughness: 0.35 });

      const colliders = [];
      const interactiveDoors = [];
      const minimapBuildings = [];
      const minimapHouseWalls = [];
      const minimapMosqueWalls = [];
      const animatedCars = [];
      const animatedPeople = [];
      const familyMembers = [];
      const prayingNPCs = [];

      function addCollider(x, z, w, d) {
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }

      function createBox(w, h, d, mat, x, y, z, solid = false, minimapColor = null, castShadow = true) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        scene.add(mesh);
        if (solid) addCollider(x, z, w, d);
        if (minimapColor) minimapBuildings.push({ x, z, w, d, color: minimapColor });
        return mesh;
      }

      function createRoomPlaque(label, x, y, z, rotY = 0) {
        const plaque = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.34, 0.05),
          new THREE.MeshStandardMaterial({ map: createSignTexture(label, '', '#3E2F23', '#D9A043') })
        );
        plaque.position.set(x, y, z);
        plaque.rotation.y = rotY;
        scene.add(plaque);
      }

      function createHouseWindow(x, y, z, w = 1.6, h = 1.3, rotY = 0) {
        const grp = new THREE.Group();
        grp.position.set(x, y, z);
        grp.rotation.y = rotY;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.12), matWood);
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 0.14),
          new THREE.MeshStandardMaterial({ color: '#9EB3BE', roughness: 0.2, metalness: 0.2 })
        );
        const barV = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.16), matWood);
        const barH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.16), matWood);
        grp.add(frame, glass, barV, barH);
        scene.add(grp);
      }

      function createHingedDoor({ name, hingeX, hingeZ, width = 1.2, height = 2.25, closedAngle = 0, openAngle = Math.PI / 2, initiallyOpen = false }) {
        const pivot = new THREE.Group();
        pivot.position.set(hingeX, 0.16, hingeZ);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.09), matDoor);
        leaf.position.set(width / 2, height / 2, 0);
        leaf.castShadow = true;
        const panel1 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.34, 0.11), matWood);
        panel1.position.set(width / 2, height * 0.72, 0);
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.34, 0.11), matWood);
        panel2.position.set(width / 2, height * 0.28, 0);
        const knobF = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matBrass);
        knobF.position.set(width - 0.15, 1.05, 0.07);
        const knobB = knobF.clone();
        knobB.position.z = -0.07;
        pivot.add(leaf, panel1, panel2, knobF, knobB);
        scene.add(pivot);

        const initAngle = initiallyOpen ? openAngle : closedAngle;
        pivot.rotation.y = initAngle;
        const doorObj = {
          name,
          pivot,
          hingeX,
          hingeZ,
          width,
          closedAngle,
          openAngle,
          currentAngle: initAngle,
          isOpen: initiallyOpen,
          pairDoor: null
        };
        interactiveDoors.push(doorObj);
        return doorObj;
      }

      // =======================================================================
      // G. TANAH, JALAN RAYA & ZEBRA CROSS MENUJU SMP TERPADU AL-ITTIHADIYAH
      // =======================================================================
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(240, 260),
        new THREE.MeshStandardMaterial({ map: texGrass, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, -45);
      ground.receiveShadow = true;
      scene.add(ground);

      // Jalan Utama Beraspal dari Depan Rumah (Z = -4) hingga Sekolah (Z = -126)
      const mainRoad = new THREE.Mesh(
        new THREE.PlaneGeometry(7.6, 126),
        new THREE.MeshStandardMaterial({ map: texAsphalt, roughness: 0.88 })
      );
      mainRoad.rotation.x = -Math.PI / 2;
      mainRoad.position.set(0, 0.02, -65);
      mainRoad.receiveShadow = true;
      scene.add(mainRoad);

      // Trotoar Kiri & Kanan Jalan
      [-4.9, 4.9].forEach(tx => {
        const sw = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2, 124),
          new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.9 })
        );
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(tx, 0.03, -64);
        sw.receiveShadow = true;
        scene.add(sw);
      });

      // Zebra Cross di Depan Gerbang SMP Terpadu Al-Ittihadiyah (Z = -105)
      for (let i = -3; i <= 3; i++) {
        createBox(0.65, 0.03, 2.8, new THREE.MeshStandardMaterial({ color: '#EFECE6' }), i * 1.05, 0.025, -105, false, null, false);
      }

      // =======================================================================
      // H. RUMAH KELUARGA REALISTIS STANDAR ARSITEKTUR INDONESIA (22m x 16m)
      //    Depan (Z: 2..6.5)  : Teras -> Ruang Tamu | Kiri: Kamar Ayah&Bunda | Kanan: Kamar Kakak
      //    Tengah (Z: 6.5..13): Ruang Keluarga & Makan | Kiri: Kamar Saya | Kanan: Kamar Adik
      //    Belakang (Z: 13..18): Kiri: Kamar Mandi | Tengah: Mushola Keluarga | Kanan: Dapur
      // =======================================================================
      function createHouseWall(w, h, d, mat, x, y, z, solid = true) {
        const m = createBox(w, h, d, mat, x, y, z, solid, null, false);
        if (solid) minimapHouseWalls.push({ x, z, w, d });
        return m;
      }

      // Halaman Depan & Carport Sepeda + Pagar Rendah (Z: -2.2 .. 2.0)
      const frontYard = new THREE.Mesh(
        new THREE.PlaneGeometry(22.4, 4.4),
        new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 })
      );
      frontYard.rotation.x = -Math.PI / 2;
      frontYard.position.set(0, 0.03, -0.1);
      scene.add(frontYard);
      // Pagar Depan dengan Bukaan Gerbang Tengah (X: -2.2 .. +2.2)
      createBox(8.8, 1.05, 0.22, matWall, -6.6, 0.52, -2.2, true);
      createBox(8.8, 1.05, 0.22, matWall, 6.6, 0.52, -2.2, true);
      createBox(0.38, 1.35, 0.38, matWood, -2.2, 0.68, -2.2, true);
      createBox(0.38, 1.35, 0.38, matWood, 2.2, 0.68, -2.2, true);
      // Teras Depan + 2 Tiang + Kanopi
      createBox(9.2, 0.16, 1.9, new THREE.MeshStandardMaterial({ map: texTileLiving, roughness: 0.6 }), 0, 0.08, 1.05, false);
      createBox(0.28, 3.2, 0.28, matWall, -4.2, 1.7, 0.25, true);
      createBox(0.28, 3.2, 0.28, matWall, 4.2, 1.7, 0.25, true);
      createBox(9.4, 0.22, 2.1, matRoof, 0, 3.35, 1.05, false);

      // Lantai Utama Rumah (Keramik Ruang Tamu/Keluarga)
      createBox(22.0, 0.16, 16.0, new THREE.MeshStandardMaterial({ map: texTileLiving, roughness: 0.65 }), 0, 0.08, 10.0, false);
      // Lantai Parket untuk 4 Kamar Tidur
      const matParquet = new THREE.MeshStandardMaterial({ map: texParquet, roughness: 0.72 });
      [[-7.75, 4.75], [-7.75, 10.25], [7.75, 4.75], [7.75, 10.25]].forEach(([rx, rz]) => {
        const pf = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 5.3), matParquet);
        pf.rotation.x = -Math.PI / 2;
        pf.position.set(rx, 0.17, rz);
        scene.add(pf);
      });
      // Lantai Kamar Mandi (Keramik Biru Lembut)
      const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 4.8), matTileBath);
      bathFloor.rotation.x = -Math.PI / 2;
      bathFloor.position.set(-7.75, 0.17, 15.5);
      scene.add(bathFloor);
      // Karpet Mushola Keluarga
      const musholaFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 3.8),
        new THREE.MeshStandardMaterial({ map: texMosqueCarpet, roughness: 0.9 })
      );
      musholaFloor.rotation.x = -Math.PI / 2;
      musholaFloor.position.set(0.6, 0.17, 15.9);
      scene.add(musholaFloor);

      // Plafon Dalam & Atap Limas Rumah
      const houseCeiling = new THREE.Mesh(
        new THREE.PlaneGeometry(22.0, 16.0),
        new THREE.MeshStandardMaterial({ color: '#F6F0E4', roughness: 0.95, side: THREE.DoubleSide })
      );
      houseCeiling.rotation.x = Math.PI / 2;
      houseCeiling.position.set(0, 3.55, 10.0);
      scene.add(houseCeiling);
      const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(16.6, 3.6, 4), matRoof);
      houseRoof.position.set(0, 5.35, 10.0);
      houseRoof.rotation.y = Math.PI / 4;
      scene.add(houseRoof);

      // Dinding Luar Rumah (Z=2 depan, Z=18 belakang, X=-11 kiri, X=11 kanan)
      // Dinding Depan Z=2 dengan Bukaan Pintu Utama X: -0.7 .. +0.7
      createHouseWall(10.3, 3.5, 0.24, matWall, -5.85, 1.85, 2.0, true);
      createHouseWall(10.3, 3.5, 0.24, matWall, 5.85, 1.85, 2.0, true);
      createBox(1.4, 1.25, 0.24, matWall, 0, 2.98, 2.0, false);
      createHingedDoor({ name: 'Pintu Utama Rumah', hingeX: -0.7, hingeZ: 2.0, width: 1.4, closedAngle: 0, openAngle: Math.PI / 2 });
      createRoomPlaque('PINTU KELUAR', 0, 2.65, 2.16, Math.PI);
      createHouseWindow(-7.8, 1.9, 1.95, 2.1, 1.35, 0);
      createHouseWindow(7.8, 1.9, 1.95, 2.1, 1.35, 0);
      createHouseWindow(-2.6, 1.9, 1.95, 1.5, 1.35, 0);
      createHouseWindow(2.6, 1.9, 1.95, 1.5, 1.35, 0);

      // Dinding Belakang, Kiri & Kanan
      createHouseWall(22.0, 3.5, 0.24, matWall, 0, 1.85, 18.0, true);
      createHouseWall(0.24, 3.5, 16.0, matWall, -11.0, 1.85, 10.0, true);
      createHouseWall(0.24, 3.5, 16.0, matWall, 11.0, 1.85, 10.0, true);

      // Sekat Horizontal Sayap Kiri (X: -11 .. -4.5) -> Z=7.5 (Ayah&Bunda | Kamar Saya) & Z=13.0 (Kamar Saya | Kamar Mandi)
      createHouseWall(6.5, 3.5, 0.22, matWall, -7.75, 1.85, 7.5, true);
      createHouseWall(6.5, 3.5, 0.22, matWall, -7.75, 1.85, 13.0, true);

      // Sekat Vertikal Sayap Kiri (X = -4.5) dengan 3 Pintu Berengsel (Kamar Ayah&Bunda, Kamar Saya, Kamar Mandi)
      // Kamar Ayah&Bunda pintu Z: 5.0..6.2 | Kamar Saya pintu Z: 9.6..10.8 | Kamar Mandi pintu Z: 14.8..16.0
      createHouseWall(0.22, 3.5, 3.0, matWall, -4.5, 1.85, 3.5, true);
      createBox(0.22, 1.25, 1.2, matWall, -4.5, 2.98, 5.6, false);
      createHingedDoor({ name: 'Pintu Kamar Ayah & Bunda', hingeX: -4.5, hingeZ: 5.0, width: 1.2, closedAngle: -Math.PI / 2, openAngle: -Math.PI });
      createRoomPlaque('KAMAR AYAH & BUNDA', -4.35, 2.62, 5.6, Math.PI / 2);

      createHouseWall(0.22, 3.5, 3.4, matWall, -4.5, 1.85, 7.9, true);
      createBox(0.22, 1.25, 1.2, matWall, -4.5, 2.98, 10.2, false);
      createHingedDoor({ name: 'Pintu Kamar Saya', hingeX: -4.5, hingeZ: 9.6, width: 1.2, closedAngle: -Math.PI / 2, openAngle: -Math.PI });
      createRoomPlaque('KAMAR SAYA', -4.35, 2.62, 10.2, Math.PI / 2);

      createHouseWall(0.22, 3.5, 4.0, matWall, -4.5, 1.85, 12.8, true);
      createBox(0.22, 1.25, 1.2, matWall, -4.5, 2.98, 15.4, false);
      createHingedDoor({ name: 'Pintu Kamar Mandi', hingeX: -4.5, hingeZ: 14.8, width: 1.2, closedAngle: -Math.PI / 2, openAngle: -Math.PI });
      createRoomPlaque('KAMAR MANDI', -4.35, 2.62, 15.4, Math.PI / 2);

      createHouseWall(0.22, 3.5, 2.0, matWall, -4.5, 1.85, 17.0, true);

      // Sekat Horizontal Sayap Kanan (X: 4.5 .. 11) -> Z=7.5 (Kamar Kakak | Kamar Adik) & Z=13.0 (Kamar Adik | Dapur)
      createHouseWall(6.5, 3.5, 0.22, matWall, 7.75, 1.85, 7.5, true);
      createHouseWall(6.5, 3.5, 0.22, matWall, 7.75, 1.85, 13.0, true);

      // Sekat Vertikal Sayap Kanan (X = 4.5): Pintu Kamar Kakak (Z:5.0..6.2), Pintu Kamar Adik (Z:9.6..10.8), Bukaan Lebar Dapur (Z:14.2..16.6)
      createHouseWall(0.22, 3.5, 3.0, matWall, 4.5, 1.85, 3.5, true);
      createBox(0.22, 1.25, 1.2, matWall, 4.5, 2.98, 5.6, false);
      createHingedDoor({ name: 'Pintu Kamar Kakak', hingeX: 4.5, hingeZ: 5.0, width: 1.2, closedAngle: -Math.PI / 2, openAngle: 0 });
      createRoomPlaque('KAMAR KAKAK', 4.35, 2.62, 5.6, -Math.PI / 2);

      createHouseWall(0.22, 3.5, 3.4, matWall, 4.5, 1.85, 7.9, true);
      createBox(0.22, 1.25, 1.2, matWall, 4.5, 2.98, 10.2, false);
      createHingedDoor({ name: 'Pintu Kamar Adik', hingeX: 4.5, hingeZ: 9.6, width: 1.2, closedAngle: -Math.PI / 2, openAngle: 0 });
      createRoomPlaque('KAMAR ADIK', 4.35, 2.62, 10.2, -Math.PI / 2);

      createHouseWall(0.22, 3.5, 3.4, matWall, 4.5, 1.85, 12.5, true);
      createBox(0.22, 0.9, 2.4, matWall, 4.5, 3.15, 15.4, false); // Bukaan Dapur Tanpa Pintu (Terhubung ke Ruang Makan)
      createRoomPlaque('DAPUR', 4.35, 2.8, 15.4, -Math.PI / 2);
      createHouseWall(0.22, 3.5, 1.4, matWall, 4.5, 1.85, 17.3, true);

      // =======================================================================
      // I. PERABOTAN DETAIL SETIAP RUANGAN RUMAH
      // =======================================================================
      function createBed(x, z, blanketColor = '#466B53', doubleSize = false) {
        const bw = doubleSize ? 2.1 : 1.35;
        const bd = 2.1;
        createBox(bw, 0.42, bd, matWood, x, 0.37, z, true);
        createBox(bw - 0.1, 0.24, bd - 0.1, new THREE.MeshStandardMaterial({ color: '#F5F0E6' }), x, 0.66, z, false);
        createBox(bw - 0.08, 0.26, bd * 0.6, new THREE.MeshStandardMaterial({ color: blanketColor }), x, 0.67, z + 0.3, false);
        createBox(bw, 1.05, 0.12, matWood, x, 0.72, z - bd / 2, false); // Headboard
        createBox(doubleSize ? 1.5 : 0.75, 0.14, 0.38, new THREE.MeshStandardMaterial({ color: '#FFFDF8' }), x, 0.84, z - bd / 2 + 0.35, false);
      }

      // 1. Kamar Saya (Tengah Kiri: X -11..-4.5, Z 7.5..13)
      createBed(-9.3, 9.2, '#3B5946', false);
      // Nakas + Jam Alarm + Lampu Tidur
      createBox(0.55, 0.52, 0.55, matWood, -8.1, 0.42, 8.35, true);
      createBox(0.22, 0.22, 0.14, new THREE.MeshStandardMaterial({ color: '#B84A32' }), -8.1, 0.78, 8.35, false);
      // Meja Belajar + Kursi + Buku Paket + Tas Sekolah
      createBox(1.65, 0.76, 0.75, matWood, -6.2, 0.54, 12.15, true);
      createBox(0.55, 0.48, 0.55, matWood, -6.2, 0.4, 11.4, true);
      createBox(0.32, 0.09, 0.24, new THREE.MeshStandardMaterial({ color: '#2F5C46' }), -6.5, 0.96, 12.1, false); // Buku Informatika
      createBox(0.34, 0.44, 0.24, new THREE.MeshStandardMaterial({ color: '#3E4F6B' }), -5.7, 1.14, 12.15, false); // Tas Sekolah
      // Lemari Pakaian 2 Pintu
      createBox(1.5, 2.15, 0.65, matWood, -9.8, 1.22, 12.3, true);

      // 2. Kamar Ayah & Bunda (Depan Kiri: X -11..-4.5, Z 2..7.5)
      createBed(-8.8, 4.0, '#7D4E3B', true);
      createBox(1.7, 2.2, 0.65, matWood, -9.8, 1.26, 6.7, true);
      createBox(1.2, 0.75, 0.55, matWood, -6.0, 0.53, 6.8, true);

      // 3. Kamar Kakak (Depan Kanan: X 4.5..11, Z 2..7.5)
      createBed(9.2, 4.0, '#8A5A6E', false);
      createBox(1.4, 0.75, 0.7, matWood, 6.3, 0.53, 6.8, true);
      createBox(1.4, 2.1, 0.65, matWood, 9.8, 1.21, 6.7, true);

      // 4. Kamar Adik (Tengah Kanan: X 4.5..11, Z 7.5..13)
      createBed(9.2, 9.2, '#4A6E82', false);
      createBox(1.3, 0.75, 0.65, matWood, 6.3, 0.53, 12.2, true);
      createBox(1.2, 1.6, 0.55, matWood, 9.8, 0.96, 12.3, true);

      // 5. Kamar Mandi & Keran Wudhu (Belakang Kiri: X -11..-4.5, Z 13..18)
      createBox(1.35, 0.85, 1.35, matTileBath, -9.9, 0.58, 16.9, true); // Bak Mandi
      createBox(1.15, 0.08, 1.15, new THREE.MeshStandardMaterial({ color: '#78B2C4', roughness: 0.2 }), -9.9, 0.96, 16.9, false); // Air Bak
      createBox(0.28, 0.14, 0.14, new THREE.MeshStandardMaterial({ color: '#C5C2BA', metalness: 0.7 }), -9.1, 1.18, 16.9, false); // Keran Wudhu
      createBox(0.7, 0.95, 0.08, new THREE.MeshStandardMaterial({ color: '#B7D0D8', metalness: 0.5, roughness: 0.15 }), -7.5, 1.65, 17.8, false); // Cermin

      // 6. Mushola Keluarga (Belakang Tengah: X -1.5..3.0, Z 14..18)
      createBox(1.3, 0.03, 0.85, new THREE.MeshStandardMaterial({ color: '#9E3D2A' }), 0.6, 0.19, 16.0, false); // Sajadah
      createBox(0.9, 1.1, 0.42, matWood, 2.2, 0.7, 17.5, true); // Rak Al-Qur'an & Mukena
      createRoomPlaque('MUSHOLA KELUARGA', 0.6, 2.55, 17.8, Math.PI);

      // 7. Ruang Tamu, Ruang Keluarga & Ruang Makan (Tengah X: -4.5..4.5)
      // Sofa Ruang Tamu & Meja Kopi
      createBox(2.2, 0.65, 0.85, new THREE.MeshStandardMaterial({ color: '#6E5A49' }), -2.6, 0.48, 3.8, true);
      createBox(1.2, 0.42, 0.7, matWood, -2.6, 0.37, 5.1, true);
      // Ruang Keluarga (Sofa + Rak TV)
      createBox(2.4, 0.68, 0.85, new THREE.MeshStandardMaterial({ color: '#4B6356' }), -2.2, 0.5, 9.5, true);
      createBox(0.55, 0.62, 1.9, matWood, 3.8, 0.47, 8.2, true);
      createBox(0.12, 0.85, 1.35, new THREE.MeshStandardMaterial({ color: '#242220' }), 3.9, 1.22, 8.2, false); // Layar TV
      // Meja Makan & Hidangan Sarapan Sehat (Z=11.3, dekat Dapur)
      createBox(2.0, 0.78, 1.15, matWood, 2.0, 0.55, 11.4, true);
      createBox(0.45, 0.46, 0.45, matWood, 1.4, 0.39, 10.5, true);
      createBox(0.45, 0.46, 0.45, matWood, 2.6, 0.39, 10.5, true);
      // Piring Sarapan & Gelas Air Putih
      createBox(0.32, 0.05, 0.32, new THREE.MeshStandardMaterial({ color: '#FFFDF8' }), 1.65, 0.96, 11.35, false);
      createBox(0.32, 0.05, 0.32, new THREE.MeshStandardMaterial({ color: '#FFFDF8' }), 2.35, 0.96, 11.35, false);
      createBox(0.24, 0.12, 0.24, new THREE.MeshStandardMaterial({ color: '#6B8E56' }), 2.0, 1.0, 11.45, false); // Mangkuk Sayur

      // 8. Dapur Lengkap (Belakang Kanan: X 4.5..11, Z 13..18)
      createBox(4.8, 0.88, 0.85, new THREE.MeshStandardMaterial({ color: '#D8CEBE' }), 8.2, 0.6, 17.4, true); // Kitchen Set
      createBox(0.95, 0.08, 0.6, new THREE.MeshStandardMaterial({ color: '#33302E' }), 7.4, 1.07, 17.35, false); // Kompor 2 Tungku
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#8C8881', metalness: 0.5 }));
      pot.position.set(7.2, 1.18, 17.35);
      scene.add(pot);
      createBox(0.9, 1.95, 0.85, new THREE.MeshStandardMaterial({ color: '#DFE4E6' }), 10.2, 1.12, 14.0, true); // Kulkas

      // =======================================================================
      // J. POS RONDA, MASJID AL-IKHLAS (WALK-IN + PINTU GANDA + WUDHU + SHOLAT)
      // =======================================================================
      // Pos Ronda Komplek (Kiri Depan Jalan Komplek)
      createBox(3.4, 2.7, 3.0, matWood, -8.5, 1.35, -12, true, '#7A5638');
      const posRoof = new THREE.Mesh(new THREE.ConeGeometry(2.85, 1.2, 4), matRoof);
      posRoof.position.set(-8.5, 3.3, -12);
      posRoof.rotation.y = Math.PI / 4;
      scene.add(posRoof);

      // MASJID AL-IKHLAS (X: 13.5..22.5, Z: -19.0..-9.5 + Serambi + Mihrab + Tempat Wudhu)
      function createMosqueWall(w, h, d, mat, x, y, z, solid = true) {
        const m = createBox(w, h, d, mat, x, y, z, solid, null, false);
        if (solid) minimapMosqueWalls.push({ x, z, w, d });
        return m;
      }

      const matMosqueWall = new THREE.MeshStandardMaterial({ color: '#F3EEE2', roughness: 0.8 });
      const matMosqueTrim = new THREE.MeshStandardMaterial({ color: '#3B5E49', roughness: 0.72 });
      const matMosqueGold = new THREE.MeshStandardMaterial({ color: '#C89B3C', metalness: 0.45, roughness: 0.35 });
      const matMosqueFloor = new THREE.MeshStandardMaterial({ map: texMosqueCarpet, roughness: 0.9 });

      // Jalur Paving dari Jalan Komplek menuju Serambi Masjid
      const mosqueWalkway = new THREE.Mesh(
        new THREE.PlaneGeometry(10.0, 2.8),
        new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 })
      );
      mosqueWalkway.rotation.x = -Math.PI / 2;
      mosqueWalkway.position.set(8.6, 0.035, -8.1);
      scene.add(mosqueWalkway);

      // Serambi Selatan Masjid + Tiang + Kanopi + Papan Nama
      createBox(9.4, 0.16, 2.9, new THREE.MeshStandardMaterial({ map: texTileLiving, roughness: 0.55 }), 18.0, 0.08, -8.1, false);
      [13.8, 16.7, 19.5, 22.2].forEach(px => {
        createBox(0.36, 3.6, 0.36, matMosqueWall, px, 1.9, -6.9, true);
        createBox(0.46, 0.22, 0.46, matMosqueTrim, px, 3.62, -6.9, false);
      });
      createBox(9.6, 0.24, 3.1, matMosqueTrim, 18.0, 3.82, -8.1, false);

      const mosqueSignBoard = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 1.0, 0.16),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('MASJID AL-IKHLAS', 'Sholat Subuh Berjamaah • 04:05 WIB', '#264232', '#E5B25D')
        })
      );
      mosqueSignBoard.position.set(18.1, 3.45, -6.68);
      scene.add(mosqueSignBoard);

      // Bedug & Rak Sandal di Serambi
      createBox(0.14, 1.25, 0.14, matWood, 14.2, 0.72, -8.2, true);
      createBox(0.14, 1.25, 0.14, matWood, 15.6, 0.72, -8.2, true);
      createBox(1.65, 0.14, 0.14, matWood, 14.9, 1.32, -8.2, false);
      const bedugDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.15, 16), new THREE.MeshStandardMaterial({ color: '#5E3A22' }));
      bedugDrum.rotation.z = Math.PI / 2;
      bedugDrum.position.set(14.9, 0.88, -8.2);
      scene.add(bedugDrum);
      createBox(1.5, 0.65, 0.45, matWood, 21.1, 0.42, -8.9, true);

      // Tempat Wudhu Masjid di Sisi Timur Serambi
      const mosqueWudhuFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.2), matTileBath);
      mosqueWudhuFloor.rotation.x = -Math.PI / 2;
      mosqueWudhuFloor.position.set(23.65, 0.07, -9.8);
      scene.add(mosqueWudhuFloor);
      createMosqueWall(0.24, 2.3, 5.2, matTileBath, 24.75, 1.15, -9.8, true);
      createMosqueWall(2.3, 1.35, 0.24, matTileBath, 23.65, 0.68, -12.4, true);
      createBox(2.5, 0.16, 5.4, matMosqueTrim, 23.65, 2.45, -9.8, false);
      [-8.4, -9.8, -11.2].forEach(wz => {
        createBox(0.32, 0.14, 0.24, matTileBath, 24.5, 0.88, wz, false);
        createBox(0.24, 0.09, 0.09, new THREE.MeshStandardMaterial({ color: '#C9C4BA', metalness: 0.65 }), 24.3, 0.92, wz, false);
      });
      createRoomPlaque('TEMPAT WUDHU', 23.6, 2.15, -7.25, 0);

      // Lantai Karpet, Plafon, Kubah & Menara Masjid
      createBox(9.0, 0.18, 9.5, matMosqueFloor, 18.0, 0.09, -14.25, false);
      createBox(1.6, 0.18, 2.8, matMosqueFloor, 12.7, 0.09, -14.2, false);
      const mosqueCeiling = new THREE.Mesh(
        new THREE.PlaneGeometry(9.0, 9.5),
        new THREE.MeshStandardMaterial({ color: '#F6F1E6', roughness: 0.9, side: THREE.DoubleSide })
      );
      mosqueCeiling.rotation.x = Math.PI / 2;
      mosqueCeiling.position.set(18.0, 4.18, -14.25);
      scene.add(mosqueCeiling);
      createBox(9.5, 0.35, 10.0, matMosqueTrim, 18.0, 4.35, -14.25, false);

      const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.65, 8), matMosqueWall);
      domeBase.position.set(18.0, 4.82, -14.25);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.15, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), matMosqueTrim);
      dome.position.set(18.0, 5.1, -14.25);
      const domeFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.15, 10), matMosqueGold);
      domeFinial.position.set(18.0, 8.65, -14.25);
      scene.add(domeBase, dome, domeFinial);

      createBox(1.35, 8.2, 1.35, matMosqueWall, 13.4, 4.1, -9.6, false);
      const miniDome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), matMosqueGold);
      miniDome.position.set(13.4, 8.2, -9.6);
      scene.add(miniDome);

      // Dinding Masjid & Pintu Ganda Berengsel
      createMosqueWall(3.5, 4.2, 0.28, matMosqueWall, 15.25, 2.1, -9.5, true);
      createMosqueWall(3.3, 4.2, 0.28, matMosqueWall, 20.85, 2.1, -9.5, true);
      createBox(2.2, 1.75, 0.28, matMosqueWall, 18.1, 3.32, -9.5, false);

      const mosqueDoorLeft = createHingedDoor({
        name: 'Pintu Utama Masjid Al-Ikhlas',
        hingeX: 17.0, hingeZ: -9.5, width: 1.1, height: 2.45, closedAngle: 0, openAngle: Math.PI / 2
      });
      const mosqueDoorRight = createHingedDoor({
        name: 'Pintu Utama Masjid Al-Ikhlas',
        hingeX: 19.2, hingeZ: -9.5, width: 1.1, height: 2.45, closedAngle: Math.PI, openAngle: Math.PI / 2
      });
      mosqueDoorLeft.pairDoor = mosqueDoorRight;
      mosqueDoorRight.pairDoor = mosqueDoorLeft;
      createRoomPlaque('PINTU MASJID', 18.1, 2.75, -9.32, 0);

      createMosqueWall(9.0, 4.2, 0.28, matMosqueWall, 18.0, 2.1, -19.0, true);
      createMosqueWall(0.28, 4.2, 9.5, matMosqueWall, 22.5, 2.1, -14.25, true);
      createMosqueWall(0.28, 4.2, 3.3, matMosqueWall, 13.5, 2.1, -11.15, true);
      createMosqueWall(0.28, 4.2, 3.4, matMosqueWall, 13.5, 2.1, -17.3, true);
      createBox(0.28, 1.1, 2.8, matMosqueTrim, 13.5, 3.65, -14.2, false);
      createMosqueWall(0.28, 3.6, 2.8, matMosqueWall, 11.9, 1.8, -14.2, true);
      createMosqueWall(1.6, 3.6, 0.24, matMosqueWall, 12.7, 1.8, -12.8, true);
      createMosqueWall(1.6, 3.6, 0.24, matMosqueWall, 12.7, 1.8, -15.6, true);
      createBox(1.8, 0.24, 3.1, matMosqueTrim, 12.7, 3.68, -14.2, false);

      createHouseWindow(15.2, 2.1, -9.45, 1.8, 1.7, 0);
      createHouseWindow(20.8, 2.1, -9.45, 1.8, 1.7, 0);
      createHouseWindow(16.0, 2.1, -18.95, 2.0, 1.7, 0);
      createHouseWindow(20.0, 2.1, -18.95, 2.0, 1.7, 0);

      // Interior Masjid Al-Ikhlas: Mihrab, Mimbar, Jam Jadwal Sholat, Kaligrafi, Rak Qur'an, Kotak Amal, Partisi Putri, Chandelier
      createBox(1.25, 0.03, 0.85, new THREE.MeshStandardMaterial({ color: '#9E3D2A' }), 13.1, 0.195, -14.2, false);
      const micStand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 1.38, 8), new THREE.MeshStandardMaterial({ color: '#45423F', metalness: 0.6 }));
      micStand.position.set(12.55, 0.9, -14.2);
      scene.add(micStand);

      // Mimbar Khutbah
      createBox(1.15, 0.32, 1.15, matWood, 14.3, 0.32, -17.1, true);
      createBox(0.95, 1.25, 0.95, matWood, 14.25, 0.95, -17.35, true);
      createBox(1.15, 0.12, 0.45, matWood, 14.55, 1.56, -17.35, false);

      // Jam Digital Jadwal Sholat Kemenag Kab. Bogor (19 Nov 2026) — diposisikan rapi di bawah kaligrafi
      const scheduleBoard = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 0.92, 0.08),
        new THREE.MeshStandardMaterial({ map: createMosqueScheduleTexture() })
      );
      scheduleBoard.position.set(13.68, 1.92, -11.15);
      scheduleBoard.rotation.y = Math.PI / 2;
      scene.add(scheduleBoard);

      // Kaligrafi Allah & Muhammad — simetris mengapit sisi atas Mihrab tanpa tertutup papan jadwal
      const calAllah = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.08),
        new THREE.MeshStandardMaterial({ map: createCalligraphyTexture('الله', 'ALLAH') })
      );
      calAllah.position.set(13.68, 3.28, -16.4);
      calAllah.rotation.y = Math.PI / 2;
      const calMuhammad = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.08),
        new THREE.MeshStandardMaterial({ map: createCalligraphyTexture('محمد', 'MUHAMMAD') })
      );
      calMuhammad.position.set(13.68, 3.28, -12.0);
      calMuhammad.rotation.y = Math.PI / 2;
      scene.add(calAllah, calMuhammad);

      // Rak Al-Qur'an
      createBox(0.55, 1.65, 2.1, matWood, 22.05, 0.98, -14.2, true);
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let b = 0; b < 6; b++) {
          const bc = b % 3 === 0 ? '#2E5B44' : (b % 3 === 1 ? '#8C4024' : '#C88A2E');
          createBox(0.24, 0.28, 0.09, new THREE.MeshStandardMaterial({ color: bc }), 21.95, 0.58 + shelf * 0.45, -14.85 + b * 0.25, false);
        }
      }

      // Kotak Amal Interaktif Masjid
      const charityBoxPos = { x: 20.1, z: -10.35 };
      createBox(0.58, 0.85, 0.52, matWood, charityBoxPos.x, 0.58, charityBoxPos.z, true);
      const charityTag = createNameTagSprite('Kotak Amal Masjid', '#8C4024');
      charityTag.position.set(charityBoxPos.x, 1.48, charityBoxPos.z);
      charityTag.scale.set(1.15, 0.27, 1);
      scene.add(charityTag);

      // Pembatas Shaf Putri & Lampu Gantung Chandelier
      createBox(3.1, 1.55, 0.1, new THREE.MeshStandardMaterial({ color: '#E8DEC8' }), 20.4, 0.95, -15.3, true);
      const chandRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 24), matMosqueGold);
      chandRing.rotation.x = Math.PI / 2;
      chandRing.position.set(18.0, 3.35, -14.25);
      scene.add(chandRing);

      // =======================================================================
      // K. BANGUNAN SEPANJANG JALAN & GEDUNG SMP TERPADU AL-ITTIHADIYAH
      // =======================================================================
      // Rumah Warga Kiri & Kanan Jalan
      [
        { x: -11.5, z: -42, color: '#E8DFCF' },
        { x: 11.5, z: -46, color: '#DDD1BE' },
        { x: -11.5, z: -66, color: '#E3D7C3' },
        { x: -11.5, z: -86, color: '#DDD3C2' },
        { x: 11.5, z: -84, color: '#EAE1D1' }
      ].forEach(h => {
        createBox(7.2, 3.6, 7.6, new THREE.MeshStandardMaterial({ color: h.color, roughness: 0.85 }), h.x, 1.8, h.z, true, '#B39B82');
        const rf = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.0, 4), matRoof);
        rf.position.set(h.x, 4.6, h.z);
        rf.rotation.y = Math.PI / 4;
        scene.add(rf);
      });

      // Warung Sehat Bu Siti (X: 9.8, Z: -62) + Tong Sampah + Botol Plastik
      createBox(5.2, 3.2, 4.8, new THREE.MeshStandardMaterial({ color: '#EFE5D1' }), 9.8, 1.6, -62, true, '#9E6E46');
      createBox(2.2, 0.2, 4.6, new THREE.MeshStandardMaterial({ color: '#3B5946' }), 6.8, 2.7, -62, false); // Kanopi Warung
      const warungSign = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.72, 0.12),
        new THREE.MeshStandardMaterial({ map: createSignTexture('WARUNG BU SITI', 'Jajanan Sehat & Air Mineral', '#7A4C2E', '#F2D794') })
      );
      warungSign.position.set(7.1, 3.3, -62);
      warungSign.rotation.y = -Math.PI / 2;
      scene.add(warungSign);

      // Tong Sampah & Botol (Misi 6b)
      createBox(0.65, 0.9, 0.65, new THREE.MeshStandardMaterial({ color: '#3B6E4C' }), 5.8, 0.45, -60.2, true);
      const litterBottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: '#B5D1DC', roughness: 0.3 })
      );
      litterBottle.position.set(5.1, 0.14, -61.2);
      litterBottle.rotation.z = Math.PI / 2;
      scene.add(litterBottle);

      // GERBANG & GEDUNG 2 LANTAI SMP TERPADU AL-ITTIHADIYAH (Z = -112 .. -132)
      // Lapangan Upacara Sekolah
      const schoolYard = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 24),
        new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 })
      );
      schoolYard.rotation.x = -Math.PI / 2;
      schoolYard.position.set(0, 0.04, -121);
      scene.add(schoolYard);

      // Pilar Gerbang Sekolah & Papan Nama Besar
      createBox(1.1, 4.4, 1.1, new THREE.MeshStandardMaterial({ color: '#F2EBE0' }), -4.6, 2.2, -110.5, true, '#3B5946');
      createBox(1.1, 4.4, 1.1, new THREE.MeshStandardMaterial({ color: '#F2EBE0' }), 4.6, 2.2, -110.5, true, '#3B5946');
      createBox(10.6, 1.25, 0.75, new THREE.MeshStandardMaterial({ color: '#2E4B39' }), 0, 4.65, -110.5, false);
      const schoolBanner = new THREE.Mesh(
        new THREE.BoxGeometry(9.6, 1.1, 0.15),
        new THREE.MeshStandardMaterial({
          map: createSignTexture('SMP TERPADU AL-ITTIHADIYAH', 'Mencetak Generasi Berilmu, Berakhlak & Hebat (G7KAIH)', '#264232', '#E5B25D')
        })
      );
      schoolBanner.position.set(0, 4.65, -110.05);
      scene.add(schoolBanner);

      // Gedung Utama 2 Lantai SMP Terpadu Al-Ittihadiyah
      createBox(26, 7.6, 8.5, new THREE.MeshStandardMaterial({ color: '#EFE8DA' }), 0, 3.8, -128, true, '#3B5946');
      createBox(26.6, 0.35, 9.2, new THREE.MeshStandardMaterial({ color: '#3B5946' }), 0, 3.85, -127.8, false); // Balkon lantai 2
      createBox(27.2, 1.4, 9.8, matRoof, 0, 8.2, -128, false);
      for (let wx = -10; wx <= 10; wx += 4) {
        createHouseWindow(wx, 2.1, -123.7, 1.8, 1.4, 0);
        createHouseWindow(wx, 5.7, -123.7, 1.8, 1.4, 0);
      }
      // Tiang Bendera Merah Putih di Halaman Upacara
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7.8, 10), new THREE.MeshStandardMaterial({ color: '#D8D4CC', metalness: 0.5 }));
      flagPole.position.set(0, 3.9, -119);
      const flagRed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.04), new THREE.MeshStandardMaterial({ color: '#B82E25' }));
      flagRed.position.set(0.78, 7.4, -119);
      const flagWhite = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.04), new THREE.MeshStandardMaterial({ color: '#F7F5F0' }));
      flagWhite.position.set(0.78, 6.92, -119);
      scene.add(flagPole, flagRed, flagWhite);

      // Pepohonan Rindang di Sepanjang Jalan
      function createTree(x, z) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#61432C' }));
        trunk.position.set(x, 1.3, z);
        trunk.castShadow = true;
        const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 0), new THREE.MeshStandardMaterial({ color: '#4B6E44', roughness: 0.9 }));
        crown1.position.set(x, 3.3, z);
        const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), new THREE.MeshStandardMaterial({ color: '#5A7D50', roughness: 0.9 }));
        crown2.position.set(x + 0.5, 4.1, z - 0.3);
        scene.add(trunk, crown1, crown2);
        addCollider(x, z, 0.8, 0.8);
      }
      [
        [-12, -8], [-12, -20], [11, -30], [-12, -52], [11.5, -52],
        [-11.5, -74], [11.5, -74], [-11.5, -96], [11.5, -96],
        [-14, -116], [14, -116], [26, -15]
      ].forEach(([tx, tz]) => createTree(tx, tz));

      // Angkot Desa Lalu-Lalang di Jalan Utama
      function createAngkot(zStart, dir) {
        const car = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.25, 3.7), new THREE.MeshStandardMaterial({ color: '#3F728A', roughness: 0.5 }));
        body.position.y = 0.95;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.55, 2.8), new THREE.MeshStandardMaterial({ color: '#F0EAD8' }));
        roof.position.set(0, 1.78, -0.1);
        car.add(body, roof);
        [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.1], [0.9, -1.1]].forEach(([wx, wz]) => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), new THREE.MeshStandardMaterial({ color: '#242220' }));
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.34, wz);
          car.add(w);
        });
        car.position.set(dir > 0 ? 1.85 : -1.85, 0, zStart);
        if (dir < 0) car.rotation.y = Math.PI;
        scene.add(car);
        animatedCars.push({ mesh: car, dir, speed: 6.2 });
      }
      createAngkot(-30, -1);
      createAngkot(-90, 1);

      // Lampu Hangat Ruangan Rumah, Masjid Al-Ikhlas, Teras & Jalan Komplek
      addWarmLamp(-7.8, 3.3, 4.8, 1.25, 12);
      addWarmLamp(-7.8, 3.3, 10.2, 1.35, 12);
      addWarmLamp(-7.8, 3.3, 15.5, 1.3, 11);
      addWarmLamp(7.8, 3.3, 4.8, 1.25, 12);
      addWarmLamp(7.8, 3.3, 10.2, 1.25, 12);
      addWarmLamp(7.8, 3.3, 15.5, 1.4, 13);
      addWarmLamp(0.0, 3.35, 4.4, 1.45, 14);
      addWarmLamp(0.0, 3.35, 10.0, 1.5, 15);
      addWarmLamp(0.6, 3.3, 15.8, 1.3, 12);
      addWarmLamp(0.0, 3.0, 0.9, 1.3, 13);
      addWarmLamp(18.0, 3.3, -14.25, 1.8, 18);
      addWarmLamp(12.7, 3.05, -14.2, 1.2, 10);
      addWarmLamp(18.1, 3.3, -8.1, 1.35, 14);
      addWarmLamp(-6.8, 4.5, -22, 1.2, 18);
      addWarmLamp(6.8, 4.5, -52, 1.2, 18);

      // =======================================================================
      // L. KARAKTER 3D MANUSIA (PERBAIKAN KARAKTER PEREMPUAN & KELUARGA HIDUP)
      // =======================================================================
      function createPersonNPC({
        name,
        x,
        z,
        shirtColor = '#4A6E58',
        pantsColor = '#3E3A36',
        hijabColor = null,
        apronColor = null,
        hasPeci = false,
        scale = 1.0,
        patrol = null,
        dialogue = '',
        isFamily = false,
        tagColor = '#3B5946'
      }) {
        const root = new THREE.Group();
        root.position.set(x, 0.16, z);
        root.scale.setScalar(scale);

        const isFemale = Boolean(hijabColor);
        const skinMat = new THREE.MeshStandardMaterial({ color: '#E5BA9C', roughness: 0.58 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.82 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: '#332820', roughness: 0.85 });

        // Kaki Kiri & Kanan
        function makeLeg(ox) {
          const piv = new THREE.Group();
          piv.position.set(ox, 0.74, 0);
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(isFemale ? 0.075 : 0.09, isFemale ? 0.068 : 0.082, 0.64, 10),
            pantsMat
          );
          leg.position.y = -0.32;
          const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.22), shoeMat);
          shoe.position.set(0, -0.69, 0.04);
          piv.add(leg, shoe);
          return piv;
        }
        const leftLeg = makeLeg(-0.11);
        const rightLeg = makeLeg(0.11);
        root.add(leftLeg, rightLeg);

        // Badan / Gamis A-Line untuk Perempuan vs Baju Laki-laki
        if (isFemale) {
          const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.52, 14), shirtMat);
          upperTorso.position.y = 1.08;
          upperTorso.scale.set(1.12, 1, 0.78);
          const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.28, 0.68, 16), shirtMat);
          skirt.position.y = 0.52;
          skirt.scale.set(1.1, 1, 0.86);
          const waistBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 14), new THREE.MeshStandardMaterial({ color: hijabColor }));
          waistBelt.position.y = 0.84;
          waistBelt.scale.set(1.12, 1, 0.82);
          root.add(upperTorso, skirt, waistBelt);

          // Celemek Dapur Khusus Bunda (Rapi di Luar Gamis)
          if (apronColor) {
            const apronMat = new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.85 });
            const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), apronMat);
            apronBib.position.set(0, 1.0, 0.16);
            const apronSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.04), apronMat);
            apronSkirt.position.set(0, 0.65, 0.21);
            root.add(apronBib, apronSkirt);
          }
        } else {
          const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.24), shirtMat);
          torso.position.y = 1.05;
          torso.castShadow = true;
          root.add(torso);
        }

        // Leher
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 10), skinMat);
        neck.position.y = 1.38;
        root.add(neck);

        // Lengan Kiri & Kanan
        function makeArm(ox) {
          const piv = new THREE.Group();
          piv.position.set(ox, 1.28, 0);
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.46, 10), shirtMat);
          arm.position.y = -0.23;
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), skinMat);
          hand.position.y = -0.48;
          piv.add(arm, hand);
          return piv;
        }
        const armOffset = isFemale ? 0.23 : 0.28;
        const leftArm = makeArm(-armOffset);
        const rightArm = makeArm(armOffset);
        root.add(leftArm, rightArm);

        // Juntai Kerudung Bahu & Dada Menempel pada Badan (Agar Tidak Ikut Berputar Canggung)
        if (isFemale) {
          const hijabMat = new THREE.MeshStandardMaterial({ color: hijabColor, roughness: 0.78 });
          const hijabCape = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.27, 0.34, 16), hijabMat);
          hijabCape.position.set(0, 1.24, -0.01);
          hijabCape.scale.set(1.08, 1, 0.85);
          const hijabFrontV = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.26, 4), hijabMat);
          hijabFrontV.position.set(0, 1.02, 0.12);
          hijabFrontV.rotation.x = Math.PI;
          hijabFrontV.rotation.y = Math.PI / 4;
          hijabFrontV.scale.set(1.0, 1.0, 0.4);
          const brooch = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), matBrass);
          brooch.position.set(0.06, 1.15, 0.19);
          root.add(hijabCape, hijabFrontV, brooch);
        }

        // Kepala & Wajah Ekspresif
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.56, 0);
        root.add(headGroup);

        if (isFemale) {
          // Kepala Oval Halus & Kerudung Membingkai Wajah Tanpa Menutupi Mata
          const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), skinMat);
          headMesh.scale.set(0.92, 1.05, 0.94);
          headGroup.add(headMesh);

          const hijabMat = new THREE.MeshStandardMaterial({ color: hijabColor, roughness: 0.78 });
          const innerCap = new THREE.Mesh(new THREE.SphereGeometry(0.172, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#4A3C34' }));
          innerCap.position.set(0, 0.025, -0.012);
          const hood = new THREE.Mesh(new THREE.SphereGeometry(0.192, 18, 14), hijabMat);
          hood.position.set(0, 0.015, -0.052);
          hood.scale.set(1.02, 1.06, 1.04);
          const backBun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hijabMat);
          backBun.position.set(0, -0.01, -0.17);
          headGroup.add(innerCap, hood, backBun);

          // Kedua Mata + Kilau + Alis + Pipi Rona Hangat + Senyum
          const eyeWhite = new THREE.MeshBasicMaterial({ color: '#FFFDF8' });
          const eyeIris = new THREE.MeshBasicMaterial({ color: '#261C15' });
          const cheekMat = new THREE.MeshBasicMaterial({ color: '#E29E8B' });
          [-0.055, 0.055].forEach(ex => {
            const ew = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeWhite);
            ew.position.set(ex, 0.015, 0.145);
            const ei = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), eyeIris);
            ei.position.set(ex, 0.015, 0.16);
            const brow = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.012, 0.012), eyeIris);
            brow.position.set(ex, 0.052, 0.15);
            const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), cheekMat);
            cheek.scale.set(1.2, 0.7, 0.4);
            cheek.position.set(ex * 1.45, -0.025, 0.138);
            headGroup.add(ew, ei, brow, cheek);
          });
          const smile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.015), new THREE.MeshBasicMaterial({ color: '#9E4C42' }));
          smile.position.set(0, -0.055, 0.15);
          headGroup.add(smile);
        } else {
          // Kepala Laki-laki
          const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skinMat);
          headGroup.add(headMesh);
          const hair = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.11, 0.32), new THREE.MeshStandardMaterial({ color: '#241D18' }));
          hair.position.set(0, 0.15, -0.01);
          headGroup.add(hair);

          if (hasPeci) {
            const peci = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.33), new THREE.MeshStandardMaterial({ color: '#1E1B18' }));
            peci.position.set(0, 0.21, -0.01);
            headGroup.add(peci);
          }

          const eyeIris = new THREE.MeshBasicMaterial({ color: '#241B15' });
          [-0.068, 0.068].forEach(ex => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.036, 0.02), eyeIris);
            eye.position.set(ex, 0.02, 0.155);
            headGroup.add(eye);
          });
          const smile = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.02), new THREE.MeshBasicMaterial({ color: '#8A483E' }));
          smile.position.set(0, -0.07, 0.155);
          headGroup.add(smile);
        }

        const tag = createNameTagSprite(name, tagColor);
        tag.position.set(0, 2.08, 0);
        root.add(tag);
        scene.add(root);

        const personObj = {
          name,
          root,
          headGroup,
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          patrol,
          patrolIdx: 0,
          speed: isFemale ? 1.05 : 1.15,
          walkPhase: Math.random() * 6,
          dialogue,
          isFamily,
          isFemale
        };
        animatedPeople.push(personObj);
        if (isFamily) familyMembers.push(personObj);
        return personObj;
      }

      // 4 Anggota Keluarga Aktif di Dalam Rumah
      createPersonNPC({
        name: 'Bunda',
        x: 6.5, z: 15.6,
        shirtColor: '#6C846E',
        pantsColor: '#4A594B',
        hijabColor: '#A6634B',
        apronColor: '#F2E7D3',
        patrol: [{ x: 6.8, z: 16.0 }, { x: 4.5, z: 15.4 }, { x: 2.3, z: 12.6 }],
        dialogue: 'Bunda: "Alhamdulillah sudah bangun Subuh, Nak! Jangan lupa wudhu, sholat, olahraga, dan sarapan sehat ya!"',
        isFamily: true,
        tagColor: '#8C4D36'
      });

      createPersonNPC({
        name: 'Ayah',
        x: -1.8, z: 5.8,
        shirtColor: '#E8E0D0',
        pantsColor: '#3B4248',
        hasPeci: true,
        patrol: [{ x: -1.6, z: 5.8 }, { x: 1.5, z: 6.8 }, { x: 0.2, z: 13.5 }],
        dialogue: 'Ayah: "Semangat pagi, Nak! Ayo berangkat tepat waktu ke SMP Terpadu Al-Ittihadiyah dengan disiplin!"',
        isFamily: true,
        tagColor: '#3B5946'
      });

      createPersonNPC({
        name: 'Kakak',
        x: 2.2, z: 7.4,
        shirtColor: '#D4A582',
        pantsColor: '#4D4640',
        hijabColor: '#4A6274',
        scale: 0.96,
        patrol: [{ x: 2.4, z: 7.2 }, { x: -0.6, z: 8.6 }, { x: 1.8, z: 9.8 }],
        dialogue: 'Kakak: "Pastikan buku Informatika dan botol minummu sudah masuk tas sebelum berangkat sekolah ya!"',
        isFamily: true,
        tagColor: '#4A6274'
      });

      createPersonNPC({
        name: 'Adik',
        x: -0.8, z: 7.8,
        shirtColor: '#C88A2E',
        pantsColor: '#3F5266',
        scale: 0.84,
        patrol: [{ x: -0.8, z: 7.8 }, { x: 1.0, z: 8.8 }, { x: -1.2, z: 11.4 }],
        dialogue: 'Adik: "Kakak hebat banget sudah bangun pagi! Nanti aku juga mau ikut lari pagi!"',
        isFamily: true,
        tagColor: '#9E6820'
      });

      // NPC Luar Rumah: Bu Siti, Pak RT, Teman Nongkrong, Guru Piket
      createPersonNPC({
        name: 'Bu Siti (Warung Sehat)',
        x: 6.5, z: -62.5,
        shirtColor: '#8A5B47',
        pantsColor: '#4B3A32',
        hijabColor: '#D6A665',
        dialogue: 'Bu Siti: "Pagi Nak! Jajan di sini ada buah potong & air mineral sehat lho."',
        tagColor: '#7A4C2E'
      });

      createPersonNPC({
        name: 'Pak RT',
        x: -5.8, z: -42.0,
        shirtColor: '#697856',
        pantsColor: '#3E3A34',
        hasPeci: true,
        dialogue: 'Pak RT: "Selamat pagi Nak, rajin sekali berangkat sekolah!"',
        tagColor: '#4A6342'
      });

      createPersonNPC({
        name: 'Raka (Teman)',
        x: -5.0, z: -84.0,
        shirtColor: '#8C4E3E',
        pantsColor: '#2E3B4E',
        scale: 0.95,
        dialogue: 'Raka: "Woi! Mampir main bentar yuk sebelum masuk sekolah!"',
        tagColor: '#9E472A'
      });

      createPersonNPC({
        name: 'Pak Guru Piket',
        x: 0.0, z: -112.0,
        shirtColor: '#C9B38C',
        pantsColor: '#3B362F',
        hasPeci: true,
        dialogue: 'Guru Piket: "Selamat datang di SMP Terpadu Al-Ittihadiyah!"',
        tagColor: '#2E4B39'
      });

      // =======================================================================
      // M. NPC IMAM & JAMAAH SEDANG SHOLAT SUBUH DI MASJID AL-IKHLAS (04:05-05:22)
      // =======================================================================
      function createWorshipperNPC({ name, x, z, kokoColor = '#F5F2EA', sarungColor = '#3A5A48', peciColor = '#1E1B18', isMukena = false, isImam = false }) {
        const root = new THREE.Group();
        root.position.set(x, 0.18, z);
        root.rotation.y = -Math.PI / 2; // Menghadap Kiblat (-X)

        const skinMat = new THREE.MeshStandardMaterial({ color: '#E4B89B', roughness: 0.6 });
        const topMat = new THREE.MeshStandardMaterial({ color: isMukena ? '#F7F5F0' : kokoColor, roughness: 0.78 });
        const botMat = new THREE.MeshStandardMaterial({ color: isMukena ? '#F2EFE9' : sarungColor, roughness: 0.82 });
        const peciMat = new THREE.MeshStandardMaterial({ color: peciColor, roughness: 0.85 });

        function makeLeg(ox) {
          const piv = new THREE.Group();
          piv.position.set(ox, 0.74, 0);
          const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.66, 10), botMat);
          legMesh.position.y = -0.33;
          piv.add(legMesh);
          return piv;
        }
        const leftLegPivot = makeLeg(-0.11);
        const rightLegPivot = makeLeg(0.11);
        root.add(leftLegPivot, rightLegPivot);

        const upperBody = new THREE.Group();
        upperBody.position.set(0, 0.76, 0);
        root.add(upperBody);

        const torso = new THREE.Mesh(
          isMukena ? new THREE.CylinderGeometry(0.19, 0.25, 0.64, 14) : new THREE.BoxGeometry(0.45, 0.62, 0.25),
          topMat
        );
        torso.position.y = 0.31;
        upperBody.add(torso);

        if (isImam) {
          const sorban = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.28), new THREE.MeshStandardMaterial({ color: '#9E3D2A' }));
          sorban.position.set(0.16, 0.36, 0);
          upperBody.add(sorban);
        }

        function makeArm(ox) {
          const piv = new THREE.Group();
          piv.position.set(ox, 0.55, 0);
          const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.46, 10), topMat);
          sleeve.position.y = -0.23;
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
          hand.position.y = -0.48;
          piv.add(sleeve, hand);
          return piv;
        }
        const leftArmPivot = makeArm(-0.28);
        const rightArmPivot = makeArm(0.28);
        upperBody.add(leftArmPivot, rightArmPivot);

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.83, 0);
        upperBody.add(headGroup);

        const head = new THREE.Mesh(isMukena ? new THREE.SphereGeometry(0.17, 14, 12) : new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
        headGroup.add(head);

        if (isMukena) {
          const mukenaHood = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 14), topMat);
          mukenaHood.position.set(0, 0.015, -0.05);
          headGroup.add(mukenaHood);
        } else {
          const peci = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.13, 0.34), peciMat);
          peci.position.set(0, 0.21, -0.01);
          headGroup.add(peci);
        }

        const tag = createNameTagSprite(name, isImam ? '#8C4024' : '#3B5946');
        tag.position.set(0, 2.22, 0);
        tag.scale.set(1.25, 0.29, 1);
        root.add(tag);
        scene.add(root);

        prayingNPCs.push({
          name, root, baseY: 0.18, upperBody, headGroup,
          leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot,
          phaseOffset: isImam ? 0 : 0.35
        });
      }

      createWorshipperNPC({ name: 'Ustadz Hasan (Imam)', x: 13.3, z: -14.2, kokoColor: '#F7F4EC', sarungColor: '#2B4A38', peciColor: '#F5F2EA', isImam: true });
      createWorshipperNPC({ name: 'Pak Budi (Jamaah)', x: 15.8, z: -15.4, kokoColor: '#E8DEC8', sarungColor: '#5C4033' });
      createWorshipperNPC({ name: 'Pak Ridwan (Jamaah)', x: 15.8, z: -14.2, kokoColor: '#D6E0D5', sarungColor: '#2F4858' });
      createWorshipperNPC({ name: 'Mas Farhan (Jamaah)', x: 15.8, z: -13.0, kokoColor: '#DCE3E8', sarungColor: '#4E6E58' });
      createWorshipperNPC({ name: 'Ibu Aminah (Jamaah)', x: 19.6, z: -16.8, isMukena: true });

      // Penanda Lingkaran Emas Tujuan Misi (Beacon Alami)
      const missionBeacon = new THREE.Group();
      const beaconRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.08, 10, 28),
        new THREE.MeshBasicMaterial({ color: '#E5B25D' })
      );
      beaconRing.rotation.x = Math.PI / 2;
      beaconRing.position.y = 0.24;
      const beaconDiamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: '#D9A043', roughness: 0.35, metalness: 0.3 })
      );
      beaconDiamond.position.y = 1.65;
      missionBeacon.add(beaconRing, beaconDiamond);
      scene.add(missionBeacon);

      // =======================================================================
      // N. SISTEM HUD, MISI, PILIHAN EDUKASI & INTERAKSI
      // =======================================================================
      function updateHUD() {
        const step = MISSION_STEPS[gameState.stepIndex];
        if (step) {
          gameState.chapter = step.chapter;
          dom.hudChapterBadge.textContent = `CHAPTER ${step.chapter}`;
          dom.hudZone.textContent = step.zone;
          dom.hudMissionTitle.textContent = step.title;
          dom.hudMissionHint.textContent = step.hint;
          missionBeacon.visible = true;
          missionBeacon.position.set(step.targetPos.x, 0, step.targetPos.z);
        } else {
          missionBeacon.visible = false;
        }

        dom.hudClock.textContent = formatClock(gameState.gameMinutes);
        dom.hudMoney.textContent = formatRupiah(gameState.money);
        dom.hudScore.textContent = String(gameState.characterScore);
        dom.hudEnergyText.textContent = `${Math.round(gameState.energy)} / ${gameState.maxEnergy}`;
        const pct = Math.max(0, Math.min(100, (gameState.energy / gameState.maxEnergy) * 100));
        dom.energyFill.style.width = `${pct}%`;

        document.querySelectorAll('.habit-badge').forEach(el => {
          const h = Number(el.dataset.habit);
          el.classList.toggle('done', gameState.completedHabits.has(h));
        });
      }

      function completeHabit(num, pts = 100) {
        if (!gameState.completedHabits.has(num)) {
          gameState.completedHabits.add(num);
          gameState.characterScore += pts;
        }
      }

      function openChoiceModal({ tag, title, desc, options }) {
        gameState.paused = true;
        dom.choiceTag.textContent = tag;
        dom.choiceTitle.textContent = title;
        dom.choiceDesc.textContent = desc;
        dom.choiceList.innerHTML = '';

        options.forEach(opt => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'choice-option-btn';
          btn.innerHTML = `<div style="font-weight:800; font-size:15px; margin-bottom:2px;">${opt.label}</div><div style="font-size:12px; color:#5D4A3A;">${opt.sub}</div>`;
          btn.addEventListener('click', () => {
            dom.choiceModal.classList.add('is-hidden');
            gameState.paused = false;
            opt.onSelect();
            updateHUD();
          });
          dom.choiceList.appendChild(btn);
        });
        dom.choiceModal.classList.remove('is-hidden');
      }

      function showChapterComplete(chNum) {
        sfx.playChapter();
        gameState.paused = true;
        const info = CHAPTER_EDU[chNum];
        dom.chapterModalTitle.textContent = info.title;
        dom.chapterModalEdu.textContent = info.text;
        dom.chapterModal.classList.remove('is-hidden');
      }

      function showFinalReport() {
        sfx.playChapter();
        completeHabit(7, 100); // Komitmen Tidur Cepat
        updateHUD();
        gameState.paused = true;

        const arrivedOnTime = gameState.gameMinutes <= 7 * 60;
        dom.reportArrivalTime.textContent = `Tiba Pukul ${formatClock(gameState.gameMinutes)} WIB ${arrivedOnTime ? '(Tepat Waktu!)' : '(Hampir Telat)'}`;
        dom.reportScore.textContent = String(gameState.characterScore);
        dom.reportMoney.textContent = formatRupiah(gameState.money);
        dom.reportEnergy.textContent = `${Math.round((gameState.energy / gameState.maxEnergy) * 100)}%`;

        dom.reportHabitsSummary.innerHTML = '';
        for (let i = 1; i <= 7; i++) {
          const card = document.createElement('div');
          card.style.cssText = 'background:#FFFDF8; border:1px solid #C9B59C; border-radius:10px; padding:8px 10px;';
          card.innerHTML = `<strong style="color:#3B5946;">✓ ${i}. </strong>${HABIT_DESCRIPTIONS[i]}`;
          dom.reportHabitsSummary.appendChild(card);
        }
        dom.reportModal.classList.remove('is-hidden');
      }

      function findNearestDoor() {
        let best = null;
        let bestDist = 2.6;
        interactiveDoors.forEach(door => {
          const midX = door.hingeX + Math.cos(door.currentAngle) * (door.width * 0.5);
          const midZ = door.hingeZ - Math.sin(door.currentAngle) * (door.width * 0.5);
          const d = Math.hypot(gameState.player.x - midX, gameState.player.z - midZ);
          if (d < bestDist) {
            bestDist = d;
            best = door;
          }
        });
        return best;
      }

      function findNearestFamily() {
        let best = null;
        let bestDist = 2.6;
        familyMembers.forEach(fm => {
          const d = Math.hypot(gameState.player.x - fm.root.position.x, gameState.player.z - fm.root.position.z);
          if (d < bestDist) {
            bestDist = d;
            best = fm;
          }
        });
        return best;
      }

      function triggerInteraction() {
        if (!gameState.started || gameState.paused) return;
        const step = MISSION_STEPS[gameState.stepIndex];
        const nearDoor = findNearestDoor();

        // 1. Buka pintu tertutup dulu agar mudah melintas
        if (nearDoor && !nearDoor.isOpen) {
          nearDoor.isOpen = true;
          if (nearDoor.pairDoor) nearDoor.pairDoor.isOpen = true;
          sfx.playTone(230, 'triangle', 0.1, 0.1);
          showToast(`${nearDoor.name} dibuka.`);
          return;
        }

        // 2. Kotak Amal Masjid Al-Ikhlas
        const distCharity = Math.hypot(gameState.player.x - charityBoxPos.x, gameState.player.z - charityBoxPos.z);
        if (distCharity <= 2.3) {
          if (!gameState.donatedMosque && gameState.money >= 2000) {
            gameState.donatedMosque = true;
            gameState.money -= 2000;
            gameState.characterScore += 50;
            sfx.playCoin();
            updateHUD();
            showToast('Alhamdulillah! Kamu berinfaq Rp 2.000 di Kotak Amal Masjid (+50 Karakter).');
          } else {
            showToast('Terima kasih sudah berinfaq di Masjid Al-Ikhlas!');
          }
          return;
        }

        // 3. Cek Misi Aktif
        if (step && step.targetId !== 'jog_cp_1' && step.targetId !== 'jog_cp_2') {
          const dist = Math.hypot(gameState.player.x - step.targetPos.x, gameState.player.z - step.targetPos.z);
          const inMosqueMainHall = (
            step.targetId === 'prayer_mat' &&
            gameState.player.x > 13.5 && gameState.player.x < 22.2 &&
            gameState.player.z > -18.8 && gameState.player.z < -9.7
          );
          if (dist <= 3.6 || inMosqueMainHall) {
            sfx.playInteract();

            if (step.targetId === 'bed_alarm') {
              completeHabit(1, 100);
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 4 * 60 + 15);
              gameState.stepIndex++;
              updateHUD();
              showToast('Hebat! Alarm dimatikan & kasur rapi (04:15 WIB). Sekarang berwudhu di Kamar Mandi.');
              return;
            }
            if (step.targetId === 'wudhu_tap') {
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 4 * 60 + 22);
              gameState.stepIndex++;
              updateHUD();
              showToast('Air wudhu segar! Ayo Sholat Subuh di Mushola Keluarga atau berjamaah ke Masjid Al-Ikhlas.');
              return;
            }
            if (step.targetId === 'prayer_mat') {
              completeHabit(2, 100);
              if (inMosqueMainHall) {
                gameState.characterScore += 25;
                showToast('MasyaAllah! Sholat Subuh berjamaah di Masjid Al-Ikhlas (+25 bonus karakter)!');
              }
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 4 * 60 + 45);
              gameState.stepIndex++;
              updateHUD();
              updateSkyByTime();
              showChapterComplete(1);
              return;
            }
            if (step.targetId === 'dining_table') {
              openChoiceModal({
                tag: 'KEBIASAAN 4 • MAKAN SEHAT & BERGIZI',
                title: 'Pilih Menu Sarapan Pagi Ini!',
                desc: 'Diskusikan bersama teman sekelas: menu sarapan mana yang paling baik sebelum belajar di sekolah?',
                options: [
                  {
                    label: '🍚 Nasi Hangat, Telur, Sayur Bayam & Air Putih (Masakan Bunda)',
                    sub: 'Gratis dari rumah • Energi Penuh 100% • +120 Skor Karakter',
                    onSelect: () => {
                      completeHabit(4, 120);
                      gameState.energy = gameState.maxEnergy;
                      gameState.gameMinutes = Math.max(gameState.gameMinutes, 5 * 60 + 45);
                      gameState.stepIndex++;
                      updateSkyByTime();
                      showChapterComplete(2);
                    }
                  },
                  {
                    label: '🍜 Mi Instan & Minuman Kemasan Manis',
                    sub: 'Kurang seimbang • Energi +45% • +50 Skor Karakter',
                    onSelect: () => {
                      completeHabit(4, 50);
                      gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 45);
                      gameState.gameMinutes = Math.max(gameState.gameMinutes, 5 * 60 + 45);
                      gameState.stepIndex++;
                      updateSkyByTime();
                      showToast('Boleh sesekali, tapi sayur & protein masakan Bunda jauh lebih bergizi!');
                      showChapterComplete(2);
                    }
                  }
                ]
              });
              return;
            }
            if (step.targetId === 'study_desk') {
              completeHabit(5, 100);
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 6 * 60 + 5);
              gameState.stepIndex++;
              updateHUD();
              updateSkyByTime();
              showToast('Buku Informatika & tas sekolah lengkap! Saatnya berangkat menuju sekolah.');
              return;
            }
            if (step.targetId === 'greet_rt') {
              gameState.characterScore += 45;
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 6 * 60 + 18);
              gameState.stepIndex++;
              updateHUD();
              showToast('Pak RT: "Waalaikumsalam, sopan sekali kamu Nak! Hati-hati di jalan!" (+45 Karakter)');
              return;
            }
            if (step.targetId === 'trash_bin') {
              litterBottle.visible = false;
              gameState.characterScore += 55;
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 6 * 60 + 30);
              gameState.stepIndex++;
              updateHUD();
              showToast('Lingkungan jadi bersih! Kebersihan sebagian dari iman (+55 Karakter).');
              return;
            }
            if (step.targetId === 'friend_tempt') {
              openChoiceModal({
                tag: 'KEBIASAAN 6 • BERMASYARAKAT & DISIPLIN',
                title: 'Raka Mengajak Nongkrong Sebelum Sekolah',
                desc: 'Raka berkata: "Masih pagi nih, mampir main game sebentar yuk sebelum masuk gerbang!" Apa jawabanmu?',
                options: [
                  {
                    label: '🏫 Tolak dengan Sopan & Ajak Raka Berangkat Bareng ke Sekolah',
                    sub: 'Disiplin waktu & mengajak pada kebaikan • +120 Skor Karakter',
                    onSelect: () => {
                      completeHabit(6, 120);
                      gameState.gameMinutes = Math.max(gameState.gameMinutes, 6 * 60 + 42);
                      gameState.stepIndex++;
                      updateSkyByTime();
                      showChapterComplete(3);
                    }
                  },
                  {
                    label: '🎮 Ikut Mampir Main 15 Menit Dulu',
                    sub: 'Waktu berjalan lebih cepat (berisiko telat!) • +30 Skor Karakter',
                    onSelect: () => {
                      completeHabit(6, 30);
                      gameState.gameMinutes = Math.max(gameState.gameMinutes, 6 * 60 + 57);
                      gameState.stepIndex++;
                      updateSkyByTime();
                      showToast('Waduh, hampir pukul 07:00! Cepat berlari ke gerbang sekolah!');
                      showChapterComplete(3);
                    }
                  }
                ]
              });
              return;
            }
            if (step.targetId === 'school_gate') {
              gameState.characterScore += 150;
              showFinalReport();
              return;
            }
          }
        }

        // 4. Sapa Anggota Keluarga
        const nearFamily = findNearestFamily();
        if (nearFamily) {
          sfx.playInteract();
          if (!gameState.greetedFamily.has(nearFamily.name)) {
            gameState.greetedFamily.add(nearFamily.name);
            gameState.characterScore += 15;
            updateHUD();
          }
          showToast(nearFamily.dialogue, 4200);
          return;
        }

        // 5. Tutup Pintu yang Terbuka
        if (nearDoor && nearDoor.isOpen) {
          nearDoor.isOpen = false;
          if (nearDoor.pairDoor) nearDoor.pairDoor.isOpen = false;
          sfx.playTone(180, 'triangle', 0.1, 0.1);
          showToast(`${nearDoor.name} ditutup.`);
        }
      }

      // =======================================================================
      // O. KONTROL INPUT HYBRID (PID TOUCH + MOUSE JOYSTICK + KEYBOARD PC)
      // =======================================================================
      const keys = {};
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if (k === 'shift') {
          gameState.player.sprinting = true;
          dom.btnSprint.classList.add('active');
        }
        if ((k === 'e' || k === ' ') && gameState.started && !gameState.paused) {
          e.preventDefault();
          triggerInteraction();
        }
      });

      window.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        keys[k] = false;
        if (k === 'shift') {
          gameState.player.sprinting = false;
          dom.btnSprint.classList.remove('active');
        }
      });

      // Virtual Analog Joystick (Unified Pointer Events -> Mendukung Mouse PC & Jari PID)
      const joyInput = { x: 0, y: 0, pointerId: null };
      const joyMaxRadius = 46;

      function updateJoystickFromClient(clientX, clientY) {
        const rect = dom.joystickZone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > joyMaxRadius) {
          dx = (dx / dist) * joyMaxRadius;
          dy = (dy / dist) * joyMaxRadius;
        }
        joyInput.x = dx / joyMaxRadius;
        joyInput.y = dy / joyMaxRadius;
        dom.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      }

      function resetJoystick() {
        joyInput.x = 0;
        joyInput.y = 0;
        joyInput.pointerId = null;
        dom.joystickKnob.style.transform = 'translate(0px, 0px)';
      }

      dom.joystickZone.addEventListener('pointerdown', e => {
        e.stopPropagation();
        e.preventDefault();
        joyInput.pointerId = e.pointerId;
        if (dom.joystickZone.setPointerCapture) {
          try { dom.joystickZone.setPointerCapture(e.pointerId); } catch (err) { /* Aman */ }
        }
        updateJoystickFromClient(e.clientX, e.clientY);
      });

      dom.joystickZone.addEventListener('pointermove', e => {
        if (joyInput.pointerId !== e.pointerId) return;
        e.stopPropagation();
        updateJoystickFromClient(e.clientX, e.clientY);
      });

      dom.joystickZone.addEventListener('pointerup', e => {
        if (joyInput.pointerId === e.pointerId) resetJoystick();
      });
      dom.joystickZone.addEventListener('pointercancel', e => {
        if (joyInput.pointerId === e.pointerId) resetJoystick();
      });

      // Rotasi Kamera Lewat Drag/Swipe di Area Kanvas 3D (Mouse & Sentuh PID)
      const lookState = { pointerId: null, lastX: 0, lastY: 0 };
      renderer.domElement.addEventListener('pointerdown', e => {
        if (!gameState.started || gameState.paused) return;
        lookState.pointerId = e.pointerId;
        lookState.lastX = e.clientX;
        lookState.lastY = e.clientY;
      });

      window.addEventListener('pointermove', e => {
        if (lookState.pointerId !== e.pointerId) return;
        if (!gameState.started || gameState.paused) return;
        const dx = e.clientX - lookState.lastX;
        const dy = e.clientY - lookState.lastY;
        lookState.lastX = e.clientX;
        lookState.lastY = e.clientY;
        gameState.player.yaw -= dx * 0.0052;
        gameState.player.pitch = Math.max(-0.55, Math.min(0.55, gameState.player.pitch - dy * 0.0042));
      });

      window.addEventListener('pointerup', e => {
        if (lookState.pointerId === e.pointerId) lookState.pointerId = null;
      });

      // Tombol UI Utama
      dom.btnInteract.addEventListener('click', triggerInteraction);
      dom.interactPrompt.addEventListener('click', triggerInteraction);

      dom.btnSprint.addEventListener('click', () => {
        gameState.player.sprinting = !gameState.player.sprinting;
        dom.btnSprint.classList.toggle('active', gameState.player.sprinting);
        dom.btnSprintLabel.textContent = gameState.player.sprinting ? 'LARI: AKTIF' : 'LARI CEPAT';
      });

      dom.btnStart.addEventListener('click', () => {
        sfx.init();
        sfx.playInteract();
        gameState.started = true;
        gameState.paused = false;
        dom.startScreen.classList.add('is-hidden');
        dom.hudLayer.classList.remove('is-hidden');
        dom.crosshair.classList.remove('is-hidden');
        updateHUD();
        updateSkyByTime();
        showToast('Subuh pukul 04:05 WIB! Matikan alarm & rapikan kasur di Kamar Saya.');
      });

      dom.btnNextChapter.addEventListener('click', () => {
        sfx.playInteract();
        dom.chapterModal.classList.add('is-hidden');
        gameState.paused = false;
        updateHUD();
      });

      dom.btnRestart.addEventListener('click', () => {
        window.location.reload();
      });

      // =======================================================================
      // O2. GENERATOR BUNDLE .ZIP MURNI JAVASCRIPT (TANPA DEPENDENSI EKSTERNAL)
      //     Mengemas file modular (index.html, styles.css, game.js), standalone,
      //     serta dokumentasi struktur untuk integrasi ke AI Agent & Three.js
      // =======================================================================
      const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          }
          table[i] = c >>> 0;
        }
        return table;
      })();

      function computeCRC32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
          crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }

      function buildZipBlob(fileEntries) {
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        const now = new Date();
        const dosTime = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((now.getSeconds() >> 1) & 0x1F);
        const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0x0F) << 5) | (now.getDate() & 0x1F);

        fileEntries.forEach(entry => {
          const nameBytes = encoder.encode(entry.name);
          const dataBytes = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
          const crc = computeCRC32(dataBytes);

          // Local File Header (30 bytes + filename)
          const localHeader = new ArrayBuffer(30);
          const lv = new DataView(localHeader);
          lv.setUint32(0, 0x04034B50, true);
          lv.setUint16(4, 20, true);
          lv.setUint16(6, 0x0800, true); // UTF-8 flag
          lv.setUint16(8, 0, true);      // STORE (tanpa kompresi agar 100% stabil di semua OS)
          lv.setUint16(10, dosTime, true);
          lv.setUint16(12, dosDate, true);
          lv.setUint32(14, crc, true);
          lv.setUint32(18, dataBytes.length, true);
          lv.setUint32(22, dataBytes.length, true);
          lv.setUint16(26, nameBytes.length, true);
          lv.setUint16(28, 0, true);

          localParts.push(new Uint8Array(localHeader), nameBytes, dataBytes);

          // Central Directory File Header (46 bytes + filename)
          const cdHeader = new ArrayBuffer(46);
          const cv = new DataView(cdHeader);
          cv.setUint32(0, 0x02014B50, true);
          cv.setUint16(4, 20, true);
          cv.setUint16(6, 20, true);
          cv.setUint16(8, 0x0800, true);
          cv.setUint16(10, 0, true);
          cv.setUint16(12, dosTime, true);
          cv.setUint16(14, dosDate, true);
          cv.setUint32(16, crc, true);
          cv.setUint32(20, dataBytes.length, true);
          cv.setUint32(24, dataBytes.length, true);
          cv.setUint16(28, nameBytes.length, true);
          cv.setUint16(30, 0, true);
          cv.setUint16(32, 0, true);
          cv.setUint16(34, 0, true);
          cv.setUint16(36, 0, true);
          cv.setUint32(38, 0, true);
          cv.setUint32(42, offset, true);

          centralParts.push(new Uint8Array(cdHeader), nameBytes);
          offset += 30 + nameBytes.length + dataBytes.length;
        });

        let cdSize = 0;
        centralParts.forEach(part => { cdSize += part.length; });

        // End of Central Directory Record (22 bytes)
        const eocd = new ArrayBuffer(22);
        const ev = new DataView(eocd);
        ev.setUint32(0, 0x06054B50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, fileEntries.length, true);
        ev.setUint16(10, fileEntries.length, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        return new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], { type: 'application/zip' });
      }

      function getCleanBodyMarkup() {
        const bodyClone = document.body.cloneNode(true);
        const canvasHost = bodyClone.querySelector('#canvas-container');
        if (canvasHost) canvasHost.innerHTML = '';
        bodyClone.querySelectorAll('script').forEach(s => s.remove());

        // Reset visibilitas elemen agar bundle selalu mulai bersih dari layar pembuka
        const startEl = bodyClone.querySelector('#start-screen');
        const hudEl = bodyClone.querySelector('#hud-layer');
        const crossEl = bodyClone.querySelector('#crosshair');
        const promptEl = bodyClone.querySelector('#interact-prompt');
        const choiceEl = bodyClone.querySelector('#choice-modal');
        const chapEl = bodyClone.querySelector('#chapter-modal');
        const repEl = bodyClone.querySelector('#report-modal');
        if (startEl) startEl.classList.remove('is-hidden');
        if (hudEl) hudEl.classList.add('is-hidden');
        if (crossEl) crossEl.classList.add('is-hidden');
        if (promptEl) promptEl.classList.add('is-hidden');
        if (choiceEl) choiceEl.classList.add('is-hidden');
        if (chapEl) chapEl.classList.add('is-hidden');
        if (repEl) repEl.classList.add('is-hidden');

        return bodyClone.innerHTML.trim();
      }

      function downloadProjectBundleZip() {
        try {
          sfx.playInteract();
          const styleEl = document.getElementById('game-main-styles');
          const scriptEl = document.getElementById('game-main-script');
          const cssContent = (styleEl ? styleEl.textContent : '').trim();
          const rawJsContent = (scriptEl ? scriptEl.textContent : '').trim();
          const bodyMarkup = getCleanBodyMarkup();

          const gameJsHeader = [
            '/**',
            ' * G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah (Engine POV 3D)',
            ' * -----------------------------------------------------------------',
            ' * Catatan Integrasi Project Existing (Vite / Webpack / Node + Three.js):',
            ' * - Script ini menggunakan global `THREE` (Three.js r128+).',
            ' * - Jika di project kamu Three.js di-import lewat ES Module:',
            ' *     import * as THREE from "three";',
            ' *     window.THREE = THREE;',
            ' *     import "./game.js";',
            ' */',
            ''
          ].join('\n');

          const modularIndexHtml = [
            '<!DOCTYPE html>',
            '<html lang="id">',
            '<head>',
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
            '  <title>G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah</title>',
            '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
            '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
            '  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />',
            '  <!-- Jika project kamu sudah memiliki Tailwind & Three.js lokal, ganti 2 baris CDN di bawah dengan bundle lokalmu -->',
            '  <script src="https://cdn.tailwindcss.com"><\/script>',
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>',
            '  <link rel="stylesheet" href="./styles.css" />',
            '</head>',
            '<body>',
            bodyMarkup,
            '  <script src="./game.js"><\/script>',
            '</body>',
            '</html>'
          ].join('\n');

          const standaloneHtml = [
            '<!DOCTYPE html>',
            '<html lang="id">',
            '<head>',
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
            '  <title>G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah</title>',
            '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
            '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
            '  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />',
            '  <script src="https://cdn.tailwindcss.com"><\/script>',
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>',
            '  <style id="game-main-styles">',
            cssContent,
            '  </style>',
            '</head>',
            '<body>',
            bodyMarkup,
            '  <script id="game-main-script">',
            rawJsContent,
            '  <\/script>',
            '</body>',
            '</html>'
          ].join('\n');

          const agentManifest = JSON.stringify({
            project: 'G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah',
            view: 'First-Person POV (Three.js)',
            targetDevices: ['Papan Interaktif Digital (PID Touchscreen)', 'PC / Laptop (Keyboard + Mouse)'],
            artDirection: {
              style: 'Warm Natural Stylized Low-Poly + Procedural Canvas Textures',
              noNeonColors: true,
              palette: {
                paper: '#F5EFE4',
                panel: '#2A2119',
                border: '#8C7056',
                accentGold: '#D9A043',
                accentSage: '#3B5946',
                accentTerracotta: '#9E472A'
              }
            },
            hudLayout: {
              minimap: 'bottom-left (circular GTA-style radar with auto-zoom inside house & mosque)',
              joystickAndActions: 'bottom-right (PointerEvents supporting both PID touch and PC mouse)',
              cameraLook: 'center canvas swipe/drag'
            },
            prayerSchedule: {
              location: 'Kabupaten Bogor / Ciampea (Kemenag RI)',
              date: '2026-11-19',
              subuhStart: '04:05 WIB',
              syuruqEnd: '05:22 WIB'
            },
            worldZones: {
              familyHouse: {
                boundsX: [-11, 11],
                boundsZ: [2, 18],
                rooms: [
                  'Teras & Ruang Tamu (depan)',
                  'Kamar Ayah & Bunda (depan kiri)',
                  'Kamar Kakak (depan kanan)',
                  'Kamar Saya (tengah kiri)',
                  'Kamar Adik (tengah kanan)',
                  'Ruang Keluarga & Ruang Makan (tengah)',
                  'Kamar Mandi & Wudhu (belakang kiri)',
                  'Mushola Keluarga (belakang tengah)',
                  'Dapur Lengkap (belakang kanan)'
                ]
              },
              masjidAlIkhlas: {
                boundsX: [11.9, 24.8],
                boundsZ: [-19.0, -6.7],
                features: ['Double Hinged Doors', 'Mihrab', 'Mimbar', 'Jadwal Sholat Board', 'Calligraphy Allah & Muhammad', 'Rak Al-Quran', 'Kotak Amal Interactive', 'Tempat Wudhu', 'Subuh Congregational Prayer NPCs']
              },
              villageRoadAndSchool: {
                posRonda: { x: -8.5, z: -12 },
                warungBuSiti: { x: 9.8, z: -62 },
                smpTerpaduAlIttihadiyah: { gateZ: -110.5, buildingZ: -128 }
              }
            },
            chapters: 4,
            missionsCount: MISSION_STEPS.length,
            files: ['index.html', 'styles.css', 'game.js', 'g7kaih_standalone.html', 'README_AGENT.md', 'agent_manifest.json']
          }, null, 2);

          const readmeAgent = [
            '# G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah (Bundle Project)',
            '',
            'Paket ini sudah dipisahkan agar langsung siap dimasukkan ke repository existing (yang sudah memiliki Three.js) dan mudah dipahami/dimodifikasi oleh AI Coding Agent.',
            '',
            '## Struktur File di Dalam Bundle',
            '- `index.html` : Entry point HTML modular (memanggil `styles.css` & `game.js`).',
            '- `styles.css` : Seluruh CSS tata letak HUD, PID touchscreen, modal, dan palet warna alami (tanpa warna neon).',
            '- `game.js` : Seluruh engine 3D Three.js POV, rumah 4 kamar + ruang servis realistis, karakter keluarga hidup, Masjid Al-Ikhlas (*walk-in* + NPC sholat Subuh 04:05 WIB), minimap bulat, joystick PointerEvents, dan 4 Chapter misi G7KAIH.',
            '- `g7kaih_standalone.html` : Versi 1 file mandiri (bisa langsung double-click dibuka di browser atau PID).',
            '- `agent_manifest.json` : Peta koordinat & arsitektur JSON untuk dibaca langsung oleh AI Agent.',
            '',
            '## Cara Integrasi ke Project yang Sudah Ada Three.js',
            '1. Salin `styles.css`, `game.js`, dan markup dari `index.html` ke folder proyekmu (misal `public/` atau `src/g7kaih/`).',
            '2. Jika memakai bundler (Vite / Webpack / React / Vanilla TS) dengan `npm install three`:',
            '   ```js',
            '   import * as THREE from "three";',
            '   window.THREE = THREE;',
            '   import "./game.js";',
            '   ```',
            '3. Pastikan menghapus tag `<script src="...three.min.js">` CDN di `index.html` jika sudah memakai Three.js lokal agar tidak dobel.',
            '',
            '## Panduan Singkat untuk AI Agent Saat Mengembangkan Lanjut',
            '- **Desain Visual**: Dilarang memakai warna neon. Pertahankan palet hangat pagi hari (`#F5EFE4`, `#2A2119`, `#8C7056`, `#D9A043`, `#3B5946`, `#9E472A`).',
            '- **Ergonomi PID**: Minimap bulat tetap di kiri bawah, Virtual Joystick + tombol aksi di kanan bawah, dan kontrol menggunakan `PointerEvent` agar mendukung jari layar sentuh PID sekaligus mouse PC.',
            '- **Pintu & Tabrakan**: Gunakan `createHingedDoor(...)` untuk pintu baru dan `addCollider(x, z, w, d)` untuk objek padat.'
          ].join('\n');

          const zipBlob = buildZipBlob([
            { name: 'g7kaih-al-ittihadiyah/index.html', content: modularIndexHtml },
            { name: 'g7kaih-al-ittihadiyah/styles.css', content: cssContent },
            { name: 'g7kaih-al-ittihadiyah/game.js', content: gameJsHeader + rawJsContent },
            { name: 'g7kaih-al-ittihadiyah/g7kaih_standalone.html', content: standaloneHtml },
            { name: 'g7kaih-al-ittihadiyah/agent_manifest.json', content: agentManifest },
            { name: 'g7kaih-al-ittihadiyah/README_AGENT.md', content: readmeAgent }
          ]);

          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'g7kaih-al-ittihadiyah-bundle.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 4000);

          showToast('Bundle g7kaih-al-ittihadiyah-bundle.zip berhasil diunduh! Siap dimasukkan ke AI Agent.', 4500);
        } catch (err) {
          showToast('Gagal membuat bundle .zip: ' + (err && err.message ? err.message : 'kesalahan browser'));
        }
      }

      if (dom.btnDownloadZip) dom.btnDownloadZip.addEventListener('click', downloadProjectBundleZip);
      if (dom.btnExportHud) dom.btnExportHud.addEventListener('click', downloadProjectBundleZip);

      // =======================================================================
      // P. TABRAKAN, PERGERAKAN PEMAIN & MINIMAP RADAR BULAT GAYA GTA
      // =======================================================================
      function isColliding(nx, nz, r = 0.36) {
        // Batas luar dunia
        if (nx < -26 || nx > 28 || nz < -123 || nz > 17.5) return true;

        // Tabrakan kotak dinding & perabot
        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i];
          if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
            return true;
          }
        }

        // Tabrakan pintu tertutup
        for (let i = 0; i < interactiveDoors.length; i++) {
          const d = interactiveDoors[i];
          if (d.isOpen) continue;
          const x1 = d.hingeX;
          const z1 = d.hingeZ;
          const x2 = x1 + Math.cos(d.closedAngle) * d.width;
          const z2 = z1 - Math.sin(d.closedAngle) * d.width;
          const minX = Math.min(x1, x2) - 0.14;
          const maxX = Math.max(x1, x2) + 0.14;
          const minZ = Math.min(z1, z2) - 0.14;
          const maxZ = Math.max(z1, z2) + 0.14;
          if (nx + r > minX && nx - r < maxX && nz + r > minZ && nz - r < maxZ) {
            return true;
          }
        }
        return false;
      }

      function updatePlayer(dt) {
        if (!gameState.started || gameState.paused) return;

        // Input gabungan Keyboard + Virtual Joystick
        let forward = 0;
        let strafe = 0;
        if (keys['w'] || keys['arrowup']) forward += 1;
        if (keys['s'] || keys['arrowdown']) forward -= 1;
        if (keys['d'] || keys['arrowright']) strafe += 1;
        if (keys['a'] || keys['arrowleft']) strafe -= 1;

        forward -= joyInput.y;
        strafe += joyInput.x;

        const len = Math.hypot(forward, strafe);
        if (len > 1) {
          forward /= len;
          strafe /= len;
        }

        const moving = len > 0.08;
        const canSprint = gameState.player.sprinting && gameState.energy > 6 && moving;
        const speed = canSprint ? gameState.player.speedSprint : gameState.player.speedWalk;

        if (canSprint) {
          gameState.energy = Math.max(5, gameState.energy - dt * 7.5);
        } else if (gameState.energy < gameState.maxEnergy) {
          gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + dt * 2.2);
        }

        const sinY = Math.sin(gameState.player.yaw);
        const cosY = Math.cos(gameState.player.yaw);
        const vx = (-sinY * forward + cosY * strafe) * speed * dt;
        const vz = (-cosY * forward - sinY * strafe) * speed * dt;

        if (!isColliding(gameState.player.x + vx, gameState.player.z)) {
          gameState.player.x += vx;
        }
        if (!isColliding(gameState.player.x, gameState.player.z + vz)) {
          gameState.player.z += vz;
        }

        // Efek langkah kaki halus (ramah PID anti-pusing)
        if (moving) {
          gameState.player.bobTimer += dt * (canSprint ? 10.5 : 7.0);
        }
        const bobOffset = moving ? Math.sin(gameState.player.bobTimer) * 0.032 : 0;

        camera.position.set(gameState.player.x, gameState.player.y + bobOffset, gameState.player.z);
        camera.rotation.y = gameState.player.yaw;
        camera.rotation.x = gameState.player.pitch;

        // Waktu game berjalan perlahan
        gameState.gameMinutes += dt * 0.22;
        updateSkyByTime();

        // Cek Checkpoint Jogging (Chapter 2)
        const step = MISSION_STEPS[gameState.stepIndex];
        if (step && (step.targetId === 'jog_cp_1' || step.targetId === 'jog_cp_2')) {
          const d = Math.hypot(gameState.player.x - step.targetPos.x, gameState.player.z - step.targetPos.z);
          if (d <= 2.3) {
            sfx.playInteract();
            if (step.targetId === 'jog_cp_1') {
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 5 * 60 + 8);
              gameState.stepIndex++;
              showToast('Mantap! Pos 1 tercapai. Lanjut lari pagi ke Pos 2 di persimpangan!');
            } else {
              completeHabit(3, 100);
              gameState.maxEnergy = 120;
              gameState.energy = 115;
              gameState.gameMinutes = Math.max(gameState.gameMinutes, 5 * 60 + 28);
              gameState.stepIndex++;
              showToast('Tubuh makin bugar! Max Energi naik jadi 120. Kembali ke Ruang Makan untuk sarapan sehat!');
            }
            updateHUD();
          }
        }

        // Update Prompt Interaksi Kontekstual
        let promptText = '';
        const nearDoor = findNearestDoor();
        if (nearDoor && !nearDoor.isOpen) {
          promptText = `Buka ${nearDoor.name}`;
        }

        if (!promptText) {
          const dCharity = Math.hypot(gameState.player.x - charityBoxPos.x, gameState.player.z - charityBoxPos.z);
          if (dCharity <= 2.3) {
            promptText = gameState.donatedMosque ? 'Kotak Amal Masjid' : 'Infaq Rp 2.000 di Kotak Amal';
          }
        }

        if (!promptText && step && step.targetId !== 'jog_cp_1' && step.targetId !== 'jog_cp_2') {
          const d = Math.hypot(gameState.player.x - step.targetPos.x, gameState.player.z - step.targetPos.z);
          const inMosque = (
            step.targetId === 'prayer_mat' &&
            gameState.player.x > 13.5 && gameState.player.x < 22.2 &&
            gameState.player.z > -18.8 && gameState.player.z < -9.7
          );
          if (d <= 3.6 || inMosque) {
            promptText = inMosque ? 'Sholat Subuh Berjamaah di Masjid' : (step.title.split(': ')[1] || step.title);
          }
        }

        if (!promptText) {
          const nearFam = findNearestFamily();
          if (nearFam) promptText = `Sapa ${nearFam.name}`;
        }

        if (!promptText && nearDoor && nearDoor.isOpen) {
          promptText = `Tutup ${nearDoor.name}`;
        }

        if (promptText) {
          dom.interactPrompt.textContent = `[E] ${promptText}`;
          dom.interactPrompt.classList.remove('is-hidden');
          dom.btnInteract.classList.remove('inactive');
        } else {
          dom.interactPrompt.classList.add('is-hidden');
          dom.btnInteract.classList.add('inactive');
        }

        // Update tampilan jam & energi secara real-time
        dom.hudClock.textContent = formatClock(gameState.gameMinutes);
        dom.hudEnergyText.textContent = `${Math.round(gameState.energy)} / ${gameState.maxEnergy}`;
        dom.energyFill.style.width = `${Math.max(0, Math.min(100, (gameState.energy / gameState.maxEnergy) * 100))}%`;
      }

      // Render Minimap Radar Bulat Gaya GTA (Auto-Zoom Rumah & Masjid)
      const mCtx = dom.minimapCanvas.getContext('2d');
      function renderMinimap() {
        const w = dom.minimapCanvas.width;
        const h = dom.minimapCanvas.height;
        const cx = w / 2;
        const cy = h / 2;

        const isInsideHouse = (
          gameState.player.x > -11.5 && gameState.player.x < 11.5 &&
          gameState.player.z > 0.5 && gameState.player.z < 18.5
        );
        const isInsideMosque = (
          gameState.player.x > 11.5 && gameState.player.x < 25.0 &&
          gameState.player.z > -19.5 && gameState.player.z < -6.5
        );
        const scale = (isInsideHouse || isInsideMosque) ? 5.2 : 2.25;

        mCtx.clearRect(0, 0, w, h);
        mCtx.fillStyle = '#9BAE89';
        mCtx.fillRect(0, 0, w, h);

        mCtx.save();
        mCtx.translate(cx, cy);
        mCtx.rotate(gameState.player.yaw);
        mCtx.translate(-gameState.player.x * scale, -gameState.player.z * scale);

        // Jalan Utama
        mCtx.fillStyle = '#5A5855';
        mCtx.fillRect(-3.8 * scale, -128 * scale, 7.6 * scale, 126 * scale);

        // Lantai Rumah Keluarga & Zona Khusus
        mCtx.fillStyle = '#EFE6D5';
        mCtx.fillRect(-11 * scale, 2 * scale, 22 * scale, 16 * scale);
        mCtx.fillStyle = '#C6DCE3';
        mCtx.fillRect(-11 * scale, 13 * scale, 6.5 * scale, 5 * scale);
        mCtx.fillStyle = '#C5D9C7';
        mCtx.fillRect(-1.5 * scale, 14 * scale, 4.3 * scale, 3.8 * scale);
        mCtx.fillStyle = '#E5D3B8';
        mCtx.fillRect(4.5 * scale, 13 * scale, 6.5 * scale, 5 * scale);

        // Denah Masjid Al-Ikhlas
        mCtx.fillStyle = '#EFE6D5';
        mCtx.fillRect(13.5 * scale, -9.5 * scale, 9.0 * scale, 2.7 * scale);
        mCtx.fillStyle = '#4E7A61';
        mCtx.fillRect(13.5 * scale, -19.0 * scale, 9.0 * scale, 9.5 * scale);
        mCtx.fillRect(11.9 * scale, -15.6 * scale, 1.6 * scale, 2.8 * scale);
        mCtx.fillStyle = '#C6DCE3';
        mCtx.fillRect(22.5 * scale, -12.4 * scale, 2.3 * scale, 5.2 * scale);

        // Bangunan Luar
        minimapBuildings.forEach(b => {
          mCtx.fillStyle = b.color;
          mCtx.fillRect((b.x - b.w / 2) * scale, (b.z - b.d / 2) * scale, b.w * scale, b.d * scale);
        });

        // Sekat Dinding Rumah & Masjid
        mCtx.fillStyle = '#4B3A2C';
        minimapHouseWalls.forEach(hw => {
          mCtx.fillRect((hw.x - hw.w / 2) * scale, (hw.z - hw.d / 2) * scale, Math.max(2, hw.w * scale), Math.max(2, hw.d * scale));
        });
        mCtx.fillStyle = '#264232';
        minimapMosqueWalls.forEach(mw => {
          mCtx.fillRect((mw.x - mw.w / 2) * scale, (mw.z - mw.d / 2) * scale, Math.max(2, mw.w * scale), Math.max(2, mw.d * scale));
        });

        // Titik Anggota Keluarga
        familyMembers.forEach(fm => {
          mCtx.fillStyle = '#9E472A';
          mCtx.beginPath();
          mCtx.arc(fm.root.position.x * scale, fm.root.position.z * scale, isInsideHouse ? 4.2 : 2.5, 0, Math.PI * 2);
          mCtx.fill();
        });

        // Titik Jamaah Sholat Subuh di Masjid
        if (gameState.gameMinutes >= SUBUH_START_MIN && gameState.gameMinutes <= SUBUH_END_MIN) {
          prayingNPCs.forEach(p => {
            mCtx.fillStyle = '#E5B25D';
            mCtx.beginPath();
            mCtx.arc(p.root.position.x * scale, p.root.position.z * scale, isInsideMosque ? 4.0 : 2.3, 0, Math.PI * 2);
            mCtx.fill();
          });
        }

        // Penanda Tujuan Misi Aktif
        const step = MISSION_STEPS[gameState.stepIndex];
        if (step) {
          mCtx.fillStyle = '#E5B25D';
          mCtx.strokeStyle = '#3E2F23';
          mCtx.lineWidth = 2;
          mCtx.beginPath();
          mCtx.arc(step.targetPos.x * scale, step.targetPos.z * scale, 6, 0, Math.PI * 2);
          mCtx.fill();
          mCtx.stroke();
        }
        mCtx.restore();

        // Penunjuk Arah Utara ('U') Mengikuti Kompas
        const northAngle = gameState.player.yaw - Math.PI / 2;
        const nx = cx + Math.cos(northAngle) * (w * 0.41);
        const ny = cy + Math.sin(northAngle) * (h * 0.41);
        mCtx.fillStyle = '#2A2119';
        mCtx.beginPath();
        mCtx.arc(nx, ny, 12, 0, Math.PI * 2);
        mCtx.fill();
        mCtx.fillStyle = '#E5B25D';
        mCtx.font = '800 13px "Plus Jakarta Sans", sans-serif';
        mCtx.textAlign = 'center';
        mCtx.textBaseline = 'middle';
        mCtx.fillText('U', nx, ny + 1);

        // Panah Pemain di Tengah Radar
        mCtx.fillStyle = '#FFFDF8';
        mCtx.strokeStyle = '#2A2119';
        mCtx.lineWidth = 2.5;
        mCtx.beginPath();
        mCtx.moveTo(cx, cy - 10);
        mCtx.lineTo(cx + 7, cy + 7);
        mCtx.lineTo(cx, cy + 3);
        mCtx.lineTo(cx - 7, cy + 7);
        mCtx.closePath();
        mCtx.fill();
        mCtx.stroke();
      }

      // =======================================================================
      // Q. ANIMASI PINTU, KELUARGA, ANGKOT & SHOLAT SUBUH BERJAMAAH
      // =======================================================================
      function updateDoorsAnimation(dt) {
        interactiveDoors.forEach(door => {
          const target = door.isOpen ? door.openAngle : door.closedAngle;
          door.currentAngle += (target - door.currentAngle) * Math.min(1, dt * 9);
          door.pivot.rotation.y = door.currentAngle;
        });
      }

      function updatePeopleAnimations(dt, now) {
        const tSec = now * 0.001;
        animatedPeople.forEach(p => {
          const distPlayer = Math.hypot(gameState.player.x - p.root.position.x, gameState.player.z - p.root.position.z);
          if (distPlayer < 2.5) {
            // Berhenti sopan, menoleh ke pemain, dan melambai lembut
            const targetYaw = Math.atan2(gameState.player.x - p.root.position.x, gameState.player.z - p.root.position.z);
            let diff = targetYaw - p.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            p.root.rotation.y += diff * Math.min(1, dt * 6);
            p.leftLeg.rotation.x *= 0.85;
            p.rightLeg.rotation.x *= 0.85;
            p.rightArm.rotation.x = -2.2 + Math.sin(tSec * 7) * 0.25;
            p.leftArm.rotation.x *= 0.85;
            return;
          }

          if (p.patrol && p.patrol.length > 1) {
            const target = p.patrol[p.patrolIdx];
            const dx = target.x - p.root.position.x;
            const dz = target.z - p.root.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.25) {
              p.patrolIdx = (p.patrolIdx + 1) % p.patrol.length;
            } else {
              const step = p.speed * dt;
              p.root.position.x += (dx / dist) * step;
              p.root.position.z += (dz / dist) * step;
              const targetYaw = Math.atan2(dx, dz);
              let diff = targetYaw - p.root.rotation.y;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              p.root.rotation.y += diff * Math.min(1, dt * 6);

              p.walkPhase += dt * 5.2;
              const swing = Math.sin(p.walkPhase) * (p.isFemale ? 0.26 : 0.42);
              p.leftLeg.rotation.x = swing;
              p.rightLeg.rotation.x = -swing;
              p.leftArm.rotation.x = -swing * 0.7;
              p.rightArm.rotation.x = swing * 0.7;
            }
          } else {
            p.leftArm.rotation.x = Math.sin(tSec * 1.6 + p.walkPhase) * 0.06;
            p.rightArm.rotation.x = -Math.sin(tSec * 1.6 + p.walkPhase) * 0.06;
          }
        });

        animatedCars.forEach(c => {
          c.mesh.position.z += c.dir * c.speed * dt;
          if (c.dir < 0 && c.mesh.position.z < -102) c.mesh.position.z = -12;
          if (c.dir > 0 && c.mesh.position.z > -12) c.mesh.position.z = -102;
        });
      }

      function updatePrayerAnimations(dt, now) {
        const isSubuhTime = gameState.gameMinutes >= SUBUH_START_MIN && gameState.gameMinutes <= SUBUH_END_MIN;
        const cycleLen = 28.0;

        prayingNPCs.forEach(p => {
          p.root.visible = isSubuhTime;
          if (!isSubuhTime) return;
          const t = ((now * 0.001) - p.phaseOffset + cycleLen * 10) % cycleLen;

          let targetY = p.baseY;
          let bodyPitch = 0;
          let armPitchL = -0.75;
          let armPitchR = -0.80;
          let armYawIn = 0.42;
          let legPitch = 0;
          let headYaw = 0;
          let headPitch = 0.14;

          if (t < 6.0) {
            // Qiyam (Berdiri Bersedekap)
          } else if (t < 10.0) {
            // Rukuk
            bodyPitch = 1.42;
            armPitchL = -1.36;
            armPitchR = -1.36;
            armYawIn = 0.05;
            headPitch = 0;
          } else if (t < 12.5) {
            // I'tidal
            bodyPitch = 0;
            armPitchL = 0.05;
            armPitchR = 0.05;
            armYawIn = 0;
          } else if (t < 17.5) {
            // Sujud 1
            targetY = p.baseY - 0.56;
            legPitch = 1.48;
            bodyPitch = 1.28;
            armPitchL = -1.02;
            armPitchR = -1.02;
            armYawIn = 0.12;
            headPitch = 0.25;
          } else if (t < 20.5) {
            // Duduk Antara Dua Sujud
            targetY = p.baseY - 0.52;
            legPitch = 1.48;
            bodyPitch = 0.04;
            armPitchL = -0.58;
            armPitchR = -0.58;
            armYawIn = 0.12;
          } else if (t < 24.5) {
            // Sujud 2
            targetY = p.baseY - 0.56;
            legPitch = 1.48;
            bodyPitch = 1.28;
            armPitchL = -1.02;
            armPitchR = -1.02;
            armYawIn = 0.12;
            headPitch = 0.25;
          } else {
            // Tasyahud & Salam
            targetY = p.baseY - 0.52;
            legPitch = 1.48;
            bodyPitch = 0.02;
            armPitchL = -0.58;
            armPitchR = -0.58;
            armYawIn = 0.12;
            if (t >= 25.5 && t < 26.8) headYaw = -0.68;
            else if (t >= 26.8) headYaw = 0.68;
          }

          const k = Math.min(1, dt * 5.2);
          p.root.position.y += (targetY - p.root.position.y) * k;
          p.upperBody.rotation.x += (bodyPitch - p.upperBody.rotation.x) * k;
          p.leftLegPivot.rotation.x += (legPitch - p.leftLegPivot.rotation.x) * k;
          p.rightLegPivot.rotation.x += (legPitch - p.rightLegPivot.rotation.x) * k;
          p.leftArmPivot.rotation.x += (armPitchL - p.leftArmPivot.rotation.x) * k;
          p.rightArmPivot.rotation.x += (armPitchR - p.rightArmPivot.rotation.x) * k;
          p.leftArmPivot.rotation.z += (armYawIn - p.leftArmPivot.rotation.z) * k;
          p.rightArmPivot.rotation.z += (-armYawIn - p.rightArmPivot.rotation.z) * k;
          p.headGroup.rotation.y += (headYaw - p.headGroup.rotation.y) * k;
          p.headGroup.rotation.x += (headPitch - p.headGroup.rotation.x) * k;
        });
      }

      // =======================================================================
      // R. LOOP UTAMA & RESIZE RESPONSIF
      // =======================================================================
      let lastTime = performance.now();
      function animate(now) {
        requestAnimationFrame(animate);
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        missionBeacon.rotation.y += dt * 1.4;
        updateDoorsAnimation(dt);
        updatePrayerAnimations(dt, now);
        updatePeopleAnimations(dt, now);
        updatePlayer(dt);
        renderMinimap();
        renderer.render(scene, camera);
      }

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      function startEngine() {
        camera.position.set(gameState.player.x, gameState.player.y, gameState.player.z);
        camera.rotation.y = gameState.player.yaw;
        updateHUD();
        updateSkyByTime();
        lastTime = performance.now();
        requestAnimationFrame(animate);
      }

      if (document.readyState === 'complete') {
        startEngine();
      } else {
        window.addEventListener('load', startEngine);
      }
    })();